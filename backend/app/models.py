"""
models.py
Pydantic models for the canonical master_cv JSON schema.

This schema is the contract between:
- groq_service.py (produces it from raw CV text)
- the frontend review/edit form (Phase 8)
- SQLite storage (master_cv.json_data)
- tailoring engine (Phase 3, consumes + rewrites a subset of this)

Used as the validation safety net on top of Groq's JSON Object Mode, since
llama-3.3-70b-versatile doesn't support strict JSON-Schema-constrained output.
"""

from typing import Optional
from pydantic import BaseModel, Field


class EducationEntry(BaseModel):
    institution: str
    degree: str
    location: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    gpa: Optional[str] = None


class ExperienceEntry(BaseModel):
    title: str
    organization: str
    location: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    bullets: list[str] = Field(default_factory=list)
    tech_stack: list[str] = Field(default_factory=list)


class ProjectEntry(BaseModel):
    name: str
    tech_stack: list[str] = Field(default_factory=list)
    link: Optional[str] = None
    bullets: list[str] = Field(default_factory=list)


class LeadershipEntry(BaseModel):
    title: str
    organization: Optional[str] = None
    description: str


class MasterCV(BaseModel):
    name: str
    location: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None

    summary: Optional[str] = None

    # Preserves whatever skill categories actually exist in the source CV
    # rather than forcing a fixed set (e.g. "Programming", "ML / AI", ...).
    skills: dict[str, list[str]] = Field(default_factory=dict)

    education: list[EducationEntry] = Field(default_factory=list)
    experience: list[ExperienceEntry] = Field(default_factory=list)
    projects: list[ProjectEntry] = Field(default_factory=list)
    leadership: list[LeadershipEntry] = Field(default_factory=list)
