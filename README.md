# AI Resume Tailor

Converts a master CV + a target job description into a tailored, ATS-optimized,
strictly one-page LaTeX resume — compiled to PDF, scored against the JD, and
self-corrected in a feedback loop until it fits one page.

## Stack
- Frontend: React + Vite + TailwindCSS
- Backend: FastAPI (Python 3.11)
- AI: Groq (`llama-3.3-70b-versatile`)
- Rendering: Jinja2 → fixed LaTeX template → `pdflatex` (TeX Live, in Docker)
- Validation: PyPDF2 page-count check
- Storage: SQLite (multi-user-ready schema)

## Project status

This repo is being built in strict phase order (see project plan). Current state:

- [x] Phase 0 — Project setup (this scaffold)
- [x] Phase 1 — CV parsing
- [ ] Phase 2 — CV structuring (AI)
- [ ] Phase 3 — Tailoring engine (AI)
- [ ] Phase 4 — LaTeX rendering
- [ ] Phase 5 — Compilation
- [ ] Phase 6 — Page-check loop
- [ ] Phase 7 — ATS scoring (AI)
- [ ] Phase 8 — Frontend
- [ ] Phase 9 — Integration & hardening

## Setup

1. Copy the env template and add your Groq API key:
   ```bash
   cp .env.example .env
   # edit .env and set GROQ_API_KEY
   ```

2. Build and start both services:
   ```bash
   docker-compose up --build
   ```

3. Visit:
   - Frontend: http://localhost:5173
   - Backend health check: http://localhost:8000/health

## Repo structure

```
ai-resume-tailor/
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── data/                 # SQLite db lives here
│   └── app/
│       ├── main.py           # FastAPI entrypoint
│       ├── templates/        # fixed LaTeX template(s)
│       └── generated/        # per-generation .tex/.pdf output (shared volume)
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        └── main.jsx
```

## Key design principles
- **LLM = content, Python = structure.** The model only ever returns JSON; Python
  owns all LaTeX generation, escaping, and macro placement.
- **One fixed LaTeX template** — visual consistency guaranteed; only entry content varies.
- **Page-count loop, not truncation** — overflow is fixed by re-prompting the model to
  genuinely cut content, up to 3 attempts, then compiling again.
- **Multi-user-ready schema from day one** — `user_id` exists on all tables even
  though auth isn't built yet.
