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

from app.models import MasterCV, TailoredCV

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


# ---------------------------------------------------------------------------
# Phase 3: Tailoring engine
# ---------------------------------------------------------------------------

MAX_TAILORING_RETRIES = 2


class TailoringError(Exception):
    """Raised when Groq fails to produce a valid, schema-conformant tailored
    resume after all retries are exhausted."""


TAILOR_SYSTEM_PROMPT = """You are an expert resume editor preparing a \
ONE-PAGE, ATS-optimized resume tailored to a specific job description.

You are given:
1. A candidate's full master CV as JSON (the complete, honest truth about \
their experience — every entry here actually happened).
2. A target job description.

Your job is SELECTION and REWORDING, never invention. You may rephrase, \
reorder, condense, and emphasize — you may NEVER add a skill, technology, \
achievement, metric, or responsibility that is not already present \
somewhere in the master CV. Fabrication is a hard failure condition.

Output ONLY a single JSON object in the exact same schema as the input \
master CV (name, location, email, phone, linkedin_url, github_url, \
summary, skills, education, experience, projects, leadership). No \
markdown fences, no commentary.

HARD CONTENT BUDGET (this is the most important constraint — the output \
must plausibly fit one printed page):
- "experience": select the 2-3 MOST relevant entries to this job \
description — quality over quantity. Do not pad to 3 if only 2 are \
genuinely strong matches; a focused 2 beats a padded 3. For each, keep \
EXACTLY 2-3 of the strongest, most relevant bullets — condense/shorten \
wording if needed, but every fact in a kept bullet must come from that \
same bullet or entry in the master CV. Each bullet should be roughly \
1-2 lines (~20-30 words).
- Generic freelance/self-employed entries (vague client work with no \
specific notable project, company, or technology match) should usually be \
DROPPED in favor of more substantive roles, UNLESS the job description is \
itself for freelance/contract/client-facing work, or the candidate has \
too few other entries to fill the page. Don't include filler just to hit \
a count.
- PRIORITY RULE: a formal internship or employee role at a real company \
(especially one with code review, production deployment, or a structured \
team) is inherently stronger signal than freelance/self-employed work and \
should be preferred and kept, even if the freelance entry has slightly \
better surface-level tech-stack keyword overlap with the JD. Only drop a \
formal internship/employee role in favor of freelance work if the \
internship is genuinely irrelevant to the JD's domain (e.g. a hardware \
internship for a pure frontend role) AND the freelance work is a strong, \
specific match — not just generically present.
- "projects": select EXACTLY 3 projects — the 3 most relevant to this job \
description (prioritize domain/tech-stack overlap with the JD). For each, \
keep EXACTLY 2 bullets that are the sharpest, most attention-grabbing \
facts available (strongest metric, most impressive technical achievement, \
or clearest scope/impact) — bullets chosen to make an employer want to \
ask about the project, not just describe it.
- "leadership": include this section ONLY if there's genuine remaining \
space and a genuinely relevant entry — this is the FIRST section to cut \
entirely (empty list) when content is tight, before trimming experience \
or project bullets further. If included, keep it minimal (1 entry is \
typical; never pad).
- "education": keep as-is from the master CV, unchanged.

KEYWORD / ATS OPTIMIZATION:
- "skills": filter the master CV's skills down to ONLY the categories and \
items relevant to this job description, and reorder categories so the \
most JD-relevant ones come first. Do not add any skill that isn't already \
in the master CV — only select and reorder.
- "summary": keep the candidate's original summary largely intact (same \
core claims and tone) — do NOT rewrite it to mirror the JD's voice. You \
may make light edits ONLY to naturally work in 1-3 exact keywords/phrases \
from the job description that are already truthfully supported elsewhere \
in the master CV (e.g. if the JD says "distributed systems" and the \
candidate's experience genuinely involves distributed systems work, that \
phrase can appear). Never insert a keyword that isn't backed by the \
candidate's actual experience/projects/skills.
- Within kept bullets, prefer the master CV's own phrasing where it \
already overlaps with JD terminology; lightly reword only where it helps \
keyword match without changing the underlying fact.

OTHER RULES:
- "name", "location", "email", "phone", "linkedin_url", "github_url": copy \
unchanged from the master CV.
- Every bullet, skill, and claim in your output must be traceable to \
something literally present in the master CV input. If you're unsure \
whether something is supported, leave it out rather than risk fabrication.
"""


def _build_tailor_prompt(master_cv_json: str, job_description: str) -> str:
    return (
        f"MASTER CV (JSON):\n{master_cv_json}\n\n"
        f"JOB DESCRIPTION:\n{job_description}\n\n"
        "Produce the tailored one-page resume JSON now, following the "
        "schema and rules in the system prompt exactly."
    )


def _call_groq_tailor(
    master_cv_json: str, job_description: str, repair_note: str | None = None
) -> str:
    client = get_client()

    user_content = _build_tailor_prompt(master_cv_json, job_description)
    if repair_note:
        user_content += (
            f"\n\nYour previous output was invalid: {repair_note}\n"
            "Fix this and output only the corrected JSON object."
        )

    response = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": TAILOR_SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        response_format={"type": "json_object"},
        temperature=0.3,  # slightly higher: light rewording, still mostly deterministic selection
        max_tokens=4000,
    )
    return response.choices[0].message.content


def tailor_cv(master_cv: MasterCV, job_description: str) -> TailoredCV:
    """
    Selects and lightly rewords a subset of the master CV to fit a target
    job description under a hard one-page content budget (2-3 experience
    entries x 2-3 bullets, generic freelance entries dropped unless
    JD-relevant, exactly 3 projects x 2 sharp bullets, leadership included
    only if space allows and always cut first under pressure, JD-filtered
    skills).

    Retries up to MAX_TAILORING_RETRIES times on malformed/invalid JSON,
    feeding the specific error back to the model.

    Raises TailoringError if all attempts are exhausted.
    """
    master_cv_json = master_cv.model_dump_json()
    last_error: str | None = None

    for attempt in range(1 + MAX_TAILORING_RETRIES):
        try:
            raw_response = _call_groq_tailor(
                master_cv_json, job_description, repair_note=last_error
            )
        except Exception as e:
            last_error = f"Groq API call failed: {e}"
            continue

        try:
            parsed = json.loads(raw_response)
        except json.JSONDecodeError as e:
            last_error = f"Response was not valid JSON: {e}"
            continue

        try:
            return TailoredCV.model_validate(parsed)
        except ValidationError as e:
            last_error = f"JSON did not match the required schema: {e}"
            continue

    raise TailoringError(
        f"Failed to tailor CV after {1 + MAX_TAILORING_RETRIES} attempts. "
        f"Last error: {last_error}"
    )


# ---------------------------------------------------------------------------
# Phase 6: page-overflow trim loop
# ---------------------------------------------------------------------------

TRIM_SYSTEM_PROMPT = """You are editing a resume JSON that compiled to MORE \
THAN ONE PAGE. Your job is to cut content to make it fit one page, while \
keeping it truthful and well-formed.

You are given the current tailored resume JSON and the job description it \
targets. Output ONLY the corrected JSON object, same schema, no commentary.

CUTTING PRIORITY (cut in this order until it's short enough):
1. Remove the "leadership" section entirely first (set to []), if not \
already empty.
2. Drop the single least-relevant project (go from however many are \
present down by one), keeping the strongest 2.
3. Drop the single least-relevant experience entry, keeping at least 2.
4. As a last resort, trim a bullet from the longest entries (one bullet \
fewer each), but never go below 2 bullets per kept experience and 2 per \
kept project.

Never fabricate, never change facts in kept bullets — only remove content.
"""


def _call_groq_trim(tailored_cv_json: str, job_description: str) -> str:
    client = get_client()
    user_content = (
        f"CURRENT TAILORED RESUME (too long, exceeds 1 page):\n{tailored_cv_json}\n\n"
        f"JOB DESCRIPTION:\n{job_description}\n\n"
        "Cut content per the priority order in the system prompt. Output only the trimmed JSON object."
    )
    response = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": TRIM_SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        response_format={"type": "json_object"},
        temperature=0.2,
        max_tokens=4000,
    )
    return response.choices[0].message.content


def trim_cv(tailored_cv: TailoredCV, job_description: str) -> TailoredCV:
    """
    Re-prompts Groq to cut content from an already-tailored CV that
    overflowed one page. Used by the Phase 6 page-check retry loop in
    main.py. Raises TailoringError if Groq returns invalid JSON (caller
    should treat this as a failed trim attempt, not retry internally).
    """
    raw_response = _call_groq_trim(tailored_cv.model_dump_json(), job_description)
    try:
        parsed = json.loads(raw_response)
        return TailoredCV.model_validate(parsed)
    except (json.JSONDecodeError, ValidationError) as e:
        raise TailoringError(f"Trim attempt produced invalid JSON: {e}")


# ---------------------------------------------------------------------------
# Phase 7: ATS scoring
# ---------------------------------------------------------------------------

class ATSScoringError(Exception):
    pass


ATS_SYSTEM_PROMPT = """You are an ATS (Applicant Tracking System) keyword \
match analyzer. Compare a resume against a job description and score how \
well the resume's actual content matches the JD's key requirements and \
keywords.

Output ONLY a JSON object with this exact schema:
{
  "score": <integer 0-100>,
  "matched_keywords": [<strings present in both resume and JD>],
  "missing_keywords": [<important JD keywords/skills NOT found in the resume>],
  "suggestions": [<2-4 short, specific, actionable suggestions to improve match>]
}

Score based on: overlap of hard skills/technologies, role-relevant \
terminology, and seniority/responsibility alignment. Be honest and \
specific — don't inflate the score. Suggestions should reference real \
gaps, not generic advice.
"""


def _call_groq_ats(resume_text: str, job_description: str) -> str:
    client = get_client()
    user_content = (
        f"RESUME TEXT:\n{resume_text}\n\nJOB DESCRIPTION:\n{job_description}\n\n"
        "Score the match and output only the JSON object described in the system prompt."
    )
    response = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": ATS_SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        response_format={"type": "json_object"},
        temperature=0.2,
        max_tokens=1500,
    )
    return response.choices[0].message.content


def score_ats(resume_text: str, job_description: str) -> dict:
    """Returns {score, matched_keywords, missing_keywords, suggestions}."""
    try:
        raw_response = _call_groq_ats(resume_text, job_description)
        parsed = json.loads(raw_response)
    except Exception as e:
        raise ATSScoringError(f"ATS scoring failed: {e}")

    if "score" not in parsed:
        raise ATSScoringError("ATS response missing required 'score' field.")

    return {
        "score": parsed.get("score"),
        "matched_keywords": parsed.get("matched_keywords", []),
        "missing_keywords": parsed.get("missing_keywords", []),
        "suggestions": parsed.get("suggestions", []),
    }