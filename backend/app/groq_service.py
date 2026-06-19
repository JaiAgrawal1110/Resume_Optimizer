"""
groq_service.py
Phase 2: structures raw CV text into the canonical master_cv JSON schema
(see models.py) using Groq's llama-3.3-70b-versatile in JSON Object Mode.

llama-3.3-70b-versatile does NOT support strict JSON-Schema-constrained
output (that's gpt-oss-only on Groq as of writing) — so we use
`response_format={"type": "json_object"}` (guarantees syntactically valid
JSON, not schema-conformant JSON) plus strong prompt-level schema
instructions, and validate/repair with Pydantic as the safety net.
"""

import json
import os

from groq import Groq
from pydantic import ValidationError

from app.models import MasterCV

GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
MAX_STRUCTURING_RETRIES = 2  # total attempts = 1 + this

_client: Groq | None = None


class CVStructuringError(Exception):
    """Raised when Groq fails to produce valid, schema-conformant JSON
    after all retries are exhausted."""


def get_client() -> Groq:
    global _client
    if _client is None:
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key or api_key == "your_groq_api_key_here":
            raise CVStructuringError(
                "GROQ_API_KEY is not set. Add your real key to .env "
                "(see .env.example) and restart the backend."
            )
        _client = Groq(api_key=api_key)
    return _client


SYSTEM_PROMPT = """You are a precise CV/resume parser. You convert raw, \
messily-extracted resume text into a single clean JSON object that matches \
an exact schema. You never invent, embellish, or infer information that \
isn't present in the source text. You only reorganize and clean up what's \
already there.

Output ONLY a single JSON object. No markdown fences, no commentary, no \
preamble — your entire response must be valid JSON.

SCHEMA (all fields required at the top level; use null or [] if genuinely \
absent from the source text):

{
  "name": string,
  "location": string | null,
  "email": string | null,
  "phone": string | null,
  "linkedin_url": string | null,
  "github_url": string | null,
  "summary": string | null,
  "skills": { "<category name>": ["skill", ...], ... },
  "education": [
    { "institution": string, "degree": string, "location": string | null,
      "start_date": string | null, "end_date": string | null, "gpa": string | null }
  ],
  "experience": [
    { "title": string, "organization": string, "location": string | null,
      "start_date": string | null, "end_date": string | null,
      "bullets": [string, ...], "tech_stack": [string, ...] }
  ],
  "projects": [
    { "name": string, "tech_stack": [string, ...], "link": string | null,
      "bullets": [string, ...] }
  ],
  "leadership": [
    { "title": string, "organization": string | null, "description": string }
  ]
}

RULES:
- "skills": preserve the source CV's own category groupings exactly as \
given (e.g. if the CV groups skills under "Programming", "ML / AI", \
"Cloud & DevOps", keep those category names — don't invent a different \
taxonomy).
- "experience" vs "leadership": paid/internship jobs and freelance/contract \
work go in "experience". Hackathons, mentorship roles, club/society \
positions, and similar non-employment activities go in "leadership".
- "experience" and "projects" bullets: copy the achievement bullets \
verbatim from the source text (fix only obvious OCR/extraction artifacts \
like stray duplicated lines or broken spacing) — do not rewrite, \
summarize, or shorten them. Full fidelity at this stage; tailoring/trimming \
happens in a later step.
- "tech_stack" for experience: infer only from technologies explicitly \
named in that entry's own bullets or header — do not pull from unrelated \
sections.
- If the source text has an obvious duplicate/copy-paste artifact (e.g. a \
title and date line repeated twice in a row for the same role), collapse \
it into a single clean entry — use your judgment, this is a text-extraction \
glitch, not two separate roles.
- Extract ALL experience, project, and leadership entries present in the \
source — do not omit any for length or relevance. Selection/trimming for a \
specific job happens in a separate downstream step, not here.
- Dates: preserve the source's original format as a string (e.g. "Feb 2025 \
\u2013 Jul 2025"). Do not reformat or normalize.
- "linkedin_url" / "github_url" / project "link": the source text may \
include a "[Hyperlinks found in document]" block listing raw URLs \
extracted from clickable links/icons that have no visible URL text (e.g. \
a "LinkedIn" icon next to the name is a link, not visible text). Match \
each URL to the right field by domain: a linkedin.com URL near the top of \
the document (header/contact area) -> "linkedin_url"; a github.com URL in \
the header that looks like a profile (e.g. github.com/username, no extra \
path segments) -> "github_url"; a github.com URL appearing next to a \
specific project entry (often with a repo path, or just a § icon next to \
that project's title) -> that project's "link". Never fabricate a URL that \
isn't in the hyperlinks block or visible text. Do not include the \
"[Hyperlinks found in document]" block itself in any output field.
"""


def _build_user_prompt(raw_text: str) -> str:
    return f"Raw CV text:\n\n{raw_text}\n\nConvert this into the JSON schema described in the system prompt. Output only the JSON object."


def _call_groq(raw_text: str, repair_note: str | None = None) -> str:
    client = get_client()

    user_content = _build_user_prompt(raw_text)
    if repair_note:
        user_content += (
            f"\n\nYour previous output was invalid: {repair_note}\n"
            "Fix this and output only the corrected JSON object."
        )

    response = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        response_format={"type": "json_object"},
        temperature=0.1,  # low temperature: this is extraction, not creative writing
        max_tokens=8000,
    )
    return response.choices[0].message.content


def structure_cv(raw_text: str) -> MasterCV:
    """
    Converts raw CV text into a validated MasterCV object.

    Retries up to MAX_STRUCTURING_RETRIES times if Groq returns malformed
    JSON or JSON that fails schema validation, feeding the specific error
    back to the model so it can self-correct.

    Raises CVStructuringError if all attempts are exhausted.
    """
    last_error: str | None = None

    for attempt in range(1 + MAX_STRUCTURING_RETRIES):
        try:
            raw_response = _call_groq(raw_text, repair_note=last_error)
        except Exception as e:
            last_error = f"Groq API call failed: {e}"
            continue

        try:
            parsed = json.loads(raw_response)
        except json.JSONDecodeError as e:
            last_error = f"Response was not valid JSON: {e}"
            continue

        try:
            return MasterCV.model_validate(parsed)
        except ValidationError as e:
            last_error = f"JSON did not match the required schema: {e}"
            continue

    raise CVStructuringError(
        f"Failed to structure CV after {1 + MAX_STRUCTURING_RETRIES} attempts. "
        f"Last error: {last_error}"
    )
