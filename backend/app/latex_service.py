"""
latex_service.py
Phase 4: fills the one fixed, pre-approved LaTeX template with AI-generated
content (a TailoredCV). The LLM never writes LaTeX — it only ever produced
JSON (Phase 2/3). This module owns ALL LaTeX structure, macro placement,
and character escaping.

Design principle (per the project plan): escaping happens in Python, on the
data, BEFORE it reaches the template — not via Jinja filters scattered
through the template. This keeps every text field provably escaped exactly
once, with one exception: linkedin_url/github_url, which are used as raw
\\href URLs and must NOT be escaped (escaping would break the link, e.g. a
literal "_" in a LinkedIn slug would become "\\_" and 404).
"""

import os
import re
import subprocess
from pathlib import Path

from jinja2 import Environment, FileSystemLoader

from app.models import TailoredCV

TEMPLATE_DIR = Path(__file__).parent / "templates"
TEMPLATE_NAME = "resume_template.tex.jinja"
GENERATED_DIR = Path(__file__).parent / "generated"


class LatexRenderError(Exception):
    pass


# ---------------------------------------------------------------------------
# Escaping
# ---------------------------------------------------------------------------

# Order matters: backslash must be escaped first, or we'd double-escape the
# backslashes inserted by the other replacements.
_LATEX_ESCAPE_MAP = [
    ("\\", r"\textbackslash{}"),
    ("&", r"\&"),
    ("%", r"\%"),
    ("$", r"\$"),
    ("#", r"\#"),
    ("_", r"\_"),
    ("{", r"\{"),
    ("}", r"\}"),
    ("~", r"\textasciitilde{}"),
    ("^", r"\textasciicircum{}"),
]


def escape_latex(text: str | None) -> str:
    """Escapes LaTeX special characters in a plain text string. None/empty
    safe — returns ''."""
    if not text:
        return ""
    result = text
    for char, replacement in _LATEX_ESCAPE_MAP:
        result = result.replace(char, replacement)
    return result


def _escape_list(items: list[str]) -> list[str]:
    return [escape_latex(item) for item in items]


# ---------------------------------------------------------------------------
# Data preparation: walk the TailoredCV and escape every text field that
# will be rendered as visible text. URL fields are passed through raw.
# ---------------------------------------------------------------------------


def _prepare_template_data(cv: TailoredCV) -> dict:
    return {
        "name": escape_latex(cv.name),
        "location": escape_latex(cv.location),
        "phone": escape_latex(cv.phone),
        # NOT escaped: used as a raw \href{mailto:...} target. A literal
        # "_" in an email address (very common) would otherwise become
        # "\_" inside the href and break the mailto link.
        "email": cv.email or "",
        # NOT escaped: used as raw \href URLs. A literal "_" or "%" in a
        # real URL must reach pdflatex unchanged or the link breaks.
        "linkedin_url": cv.linkedin_url or "",
        "github_url": cv.github_url or "",
        "summary": escape_latex(cv.summary),
        "skills": {
            escape_latex(category): _escape_list(items)
            for category, items in cv.skills.items()
        },
        "education": [
            {
                "degree": escape_latex(edu.degree),
                "institution": escape_latex(edu.institution),
                "location": escape_latex(edu.location),
                "start_date": escape_latex(edu.start_date),
                "end_date": escape_latex(edu.end_date),
                "gpa": escape_latex(edu.gpa),
            }
            for edu in cv.education
        ],
        "experience": [
            {
                "title": escape_latex(exp.title),
                "organization": escape_latex(exp.organization),
                "location": escape_latex(exp.location),
                "start_date": escape_latex(exp.start_date),
                "end_date": escape_latex(exp.end_date),
                "bullets": _escape_list(exp.bullets),
            }
            for exp in cv.experience
        ],
        "projects": [
            {
                "name": escape_latex(proj.name),
                "tech_stack": _escape_list(proj.tech_stack),
                "bullets": _escape_list(proj.bullets),
            }
            for proj in cv.projects
        ],
        "leadership": [
            {
                "title": escape_latex(lead.title),
                "organization": escape_latex(lead.organization),
                "description": escape_latex(lead.description),
            }
            for lead in cv.leadership
        ],
    }


# ---------------------------------------------------------------------------
# Jinja2 environment with LaTeX-safe (non-clashing) delimiters
# ---------------------------------------------------------------------------

_jinja_env = Environment(
    loader=FileSystemLoader(str(TEMPLATE_DIR)),
    block_start_string=r"\BLOCK{",
    block_end_string="}",
    variable_start_string=r"\VAR{",
    variable_end_string="}",
    comment_start_string=r"\#{",
    comment_end_string="}",
    line_statement_prefix="%%",
    line_comment_prefix="%#",
    trim_blocks=True,
    lstrip_blocks=True,
    autoescape=False,  # escaping is handled manually in _prepare_template_data
)


def render_tex(cv: TailoredCV) -> str:
    """Fills the fixed LaTeX template with an already-escaped copy of the
    given TailoredCV. Returns the complete .tex source as a string."""
    template = _jinja_env.get_template(TEMPLATE_NAME)
    data = _prepare_template_data(cv)
    return template.render(**data)


def save_tex(tex_source: str, generation_id: int) -> Path:
    """Writes the rendered .tex source to the shared generated/ volume,
    named by generation_id so each tailoring run's output is traceable."""
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    tex_path = GENERATED_DIR / f"resume_{generation_id}.tex"
    tex_path.write_text(tex_source, encoding="utf-8")
    return tex_path
