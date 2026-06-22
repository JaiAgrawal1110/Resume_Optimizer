import { useState, useEffect } from "react";
import { API_BASE, apiFetch } from "../api";

function Spinner() {
  return (
    <svg className="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
    </svg>
  );
}

const INSIGHTS = [
  { icon: "⚡", title: "AI-Driven Keywords", desc: "Instantly surfaces job-specific terms from the JD." },
  { icon: "🎯", title: "Skill Optimization", desc: "Highlights matching competencies for ATS systems." },
  { icon: "📄", title: "One-Page Guarantee", desc: "LaTeX rendering enforces strict one-page layout." },
  { icon: "📊", title: "ATS Score", desc: "Get an instant match score with gap analysis." },
];

export default function Dashboard() {
  const [cvFile, setCvFile] = useState(null);
  const [cvLoading, setCvLoading] = useState(false);
  const [cvError, setCvError] = useState(null);
  const [masterCV, setMasterCV] = useState(null);

  const [jdText, setJdText] = useState("");
  const [jdFile, setJdFile] = useState(null);
  const [tailorLoading, setTailorLoading] = useState(false);
  const [tailorError, setTailorError] = useState(null);
  const [result, setResult] = useState(null);

  const [atsLoading, setAtsLoading] = useState(false);
  const [atsResult, setAtsResult] = useState(null);

  useEffect(() => {
    apiFetch("/master-cv").then(d => setMasterCV(d.master_cv)).catch(() => {});
  }, []);

  async function handleUploadCV(e) {
    e.preventDefault();
    if (!cvFile) return;
    setCvLoading(true); setCvError(null);
    try {
      const fd = new FormData(); fd.append("file", cvFile);
      const res = await fetch(`${API_BASE}/upload-cv`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Upload failed");
      setMasterCV(data.master_cv);
    } catch (err) { setCvError(err.message); }
    finally { setCvLoading(false); }
  }

  async function handleTailor(e) {
    e.preventDefault();
    setTailorLoading(true); setTailorError(null); setResult(null); setAtsResult(null);
    try {
      const fd = new FormData();
      if (jdFile) fd.append("jd_file", jdFile);
      else fd.append("job_description", jdText);
      const res = await fetch(`${API_BASE}/tailor`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Tailoring failed");
      setResult(data);
    } catch (err) { setTailorError(err.message); }
    finally { setTailorLoading(false); }
  }

  async function handleATS() {
    if (!result?.generation_id) return;
    setAtsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/ats-score/${result.generation_id}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      setAtsResult(data);
    } catch (err) { setTailorError(err.message); }
    finally { setAtsLoading(false); }
  }

  const scoreColor = !atsResult ? "" : atsResult.score >= 75 ? "#2DD4BF" : atsResult.score >= 50 ? "#F59E0B" : "#EF4444";

  return (
    <div className="relative z-10 max-w-7xl mx-auto px-6 py-10">
      {/* Hero headline */}
      <div className="mb-10">
        <p className="step-label mb-3">AI-Powered Resume Engine</p>
        <h1 className="display-font text-5xl font-bold mb-3" style={{ color: "#F0F0FF", letterSpacing: "-0.02em", lineHeight: 1.15 }}>
          Build a Tailored Resume
        </h1>
        <p style={{ color: "#5A5A78", fontSize: 15 }}>Upload your CV, drop in a job description, generate and download.</p>
      </div>

      {/* 3-column grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.4fr", gap: 16, alignItems: "start" }}>

        {/* ── CARD 1: Master CV ── */}
        <div className="card" style={{ minHeight: 520 }}>
          <div className="card-header flex items-center justify-between">
            <span className="step-label">Step 1</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#C4C4E0" }}>Master CV</span>
          </div>
          <div style={{ padding: 16 }}>
            <form onSubmit={handleUploadCV}>
              <label className="upload-zone block mb-3 cursor-pointer">
                <div style={{ color: "#6D28D9", marginBottom: 8 }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: "0 auto 6px" }}>
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                </div>
                <div style={{ fontSize: 12, color: cvFile ? "#A0A0C8" : "#4A4A60", marginBottom: 4 }}>
                  {cvFile ? cvFile.name : "Click to choose file"}
                </div>
                <div style={{ fontSize: 11, color: "#3A3A55" }}>PDF · DOCX · TXT</div>
                <input type="file" accept=".pdf,.docx,.txt" onChange={e => setCvFile(e.target.files[0])} style={{ display: "none" }} />
              </label>
              <button type="submit" className="btn-primary" disabled={!cvFile || cvLoading}>
                {cvLoading ? <><Spinner /> Structuring...</> : <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  Upload & Structure
                </>}
              </button>
            </form>

            {cvError && <div className="error-strip mt-3">{cvError}</div>}

            {masterCV && (
              <div className="fade-in" style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#E0E0F0", marginBottom: 8 }}>{masterCV.name}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                  <span style={{ fontSize: 11, background: "rgba(109,40,217,0.15)", color: "#A78BFA", padding: "3px 10px", borderRadius: 20, fontWeight: 600 }}>
                    {masterCV.experience?.length || 0} exp
                  </span>
                  <span style={{ fontSize: 11, background: "rgba(45,212,191,0.1)", color: "#5EEAD4", padding: "3px 10px", borderRadius: 20, fontWeight: 600 }}>
                    {masterCV.projects?.length || 0} projects
                  </span>
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#4A4A70", marginBottom: 8 }}>
                  Tailoring Insights
                </div>
                {INSIGHTS.map((ins, i) => (
                  <div key={i} className="insight-item">
                    <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{ins.icon}</span>
                    <div><strong>{ins.title}</strong>{ins.desc}</div>
                  </div>
                ))}
              </div>
            )}
            {!masterCV && !cvError && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#3A3A55", marginBottom: 8 }}>
                  Tailoring Insights
                </div>
                {INSIGHTS.map((ins, i) => (
                  <div key={i} className="insight-item">
                    <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{ins.icon}</span>
                    <div><strong>{ins.title}</strong>{ins.desc}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── CARD 2: Job Description ── */}
        <div className="card" style={{ minHeight: 520 }}>
          <div className="card-header flex items-center justify-between">
            <span className="step-label">Step 2</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#C4C4E0" }}>Job Description</span>
          </div>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", height: "calc(100% - 48px)" }}>
            <form onSubmit={handleTailor} style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
              <textarea
                className="input-dark"
                placeholder="Paste job description here..."
                value={jdText}
                onChange={e => { setJdText(e.target.value); if (e.target.value) setJdFile(null); }}
                disabled={!!jdFile}
                rows={9}
                style={{ flex: 1 }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
                <span style={{ fontSize: 10, color: "#3A3A55", fontWeight: 600, letterSpacing: "0.08em" }}>OR</span>
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
              </div>
              <label style={{
                display: "flex", alignItems: "center", gap: 8, padding: "9px 12px",
                border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10,
                cursor: "pointer", fontSize: 12, color: jdFile ? "#A0A0C8" : "#4A4A60",
                background: "rgba(255,255,255,0.03)", transition: "all 0.15s"
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
                {jdFile ? jdFile.name : "Upload JD file (PDF / DOCX / TXT)"}
                <input type="file" accept=".pdf,.docx,.txt" onChange={e => { setJdFile(e.target.files[0]); if (e.target.files[0]) setJdText(""); }} style={{ display: "none" }} />
              </label>
              <button type="submit" className="btn-primary" disabled={(!jdText && !jdFile) || tailorLoading || !masterCV}>
                {tailorLoading ? <><Spinner /> Tailoring (~30s)...</> : <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                  </svg>
                  Generate Tailored Resume
                </>}
              </button>
              {!masterCV && <div style={{ fontSize: 11, color: "#3A3A55", textAlign: "center" }}>Upload a master CV first</div>}
            </form>
            {tailorError && <div className="error-strip" style={{ marginTop: 10 }}>{tailorError}</div>}
          </div>
        </div>

        {/* ── CARD 3: Result + PDF Preview ── */}
        <div className="card" style={{ minHeight: 520 }}>
          <div className="card-header flex items-center justify-between">
            <span className="step-label">Step 3</span>
            <div style={{ display: "flex", gap: 6 }}>
              {result?.pdf_ready && (
                <>
                  <a href={`${API_BASE}/download/${result.generation_id}`}
                    style={{ textDecoration: "none" }}
                    className="btn-ghost" download>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    Download
                  </a>
                  <button className="btn-ghost" onClick={handleATS} disabled={atsLoading}>
                    {atsLoading ? <Spinner /> : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                      </svg>
                    )}
                    {atsLoading ? "Scoring..." : "ATS Score"}
                  </button>
                </>
              )}
              <span style={{ fontSize: 13, fontWeight: 700, color: "#C4C4E0" }}>Result</span>
            </div>
          </div>
          <div style={{ padding: 16 }}>
            {!result && !tailorLoading && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400, gap: 12 }}>
                <div style={{ width: 48, height: 64, border: "1.5px dashed rgba(109,40,217,0.3)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(109,40,217,0.4)" strokeWidth="1.5">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                  </svg>
                </div>
                <p style={{ fontSize: 12, color: "#3A3A55", textAlign: "center" }}>Generate a resume to see the preview here</p>
              </div>
            )}

            {tailorLoading && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400, gap: 14 }}>
                <div style={{ width: 36, height: 36, border: "2px solid rgba(109,40,217,0.2)", borderTop: "2px solid #6D28D9", borderRadius: "50%" }} className="spin" />
                <p style={{ fontSize: 12, color: "#5A5A78" }}>Tailoring your resume with AI...</p>
              </div>
            )}

            {result && (
              <div className="fade-in">
                {/* Status bar */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                  {result.pdf_ready ? (
                    <span style={{ fontSize: 11, background: "rgba(45,212,191,0.1)", color: "#2DD4BF", padding: "3px 10px", borderRadius: 20, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                      PDF Ready
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, background: "rgba(239,68,68,0.1)", color: "#FCA5A5", padding: "3px 10px", borderRadius: 20, fontWeight: 600 }}>Issue</span>
                  )}
                  {result.page_count && <span style={{ fontSize: 11, color: "#4A4A60" }}>{result.page_count} page</span>}
                  {result.trim_attempts > 0 && <span style={{ fontSize: 11, color: "#4A4A60" }}>trimmed {result.trim_attempts}x</span>}
                </div>

                {result.pdf_warning && <div className="error-strip" style={{ marginBottom: 12 }}>{result.pdf_warning}</div>}

                {/* ATS result */}
                {atsResult && (
                  <div className="fade-in success-strip" style={{ marginBottom: 12 }}>
                    <div style={{ fontWeight: 700, fontSize: 20, color: scoreColor, marginBottom: 4 }}>{atsResult.score}<span style={{ fontSize: 12, color: "#4A4A60" }}>/100</span></div>
                    <div style={{ marginBottom: 3 }}><strong style={{ color: "#7070A0" }}>Matched: </strong>{atsResult.matched_keywords.slice(0, 6).join(", ")}{atsResult.matched_keywords.length > 6 ? "..." : ""}</div>
                    <div><strong style={{ color: "#7070A0" }}>Missing: </strong>{atsResult.missing_keywords.slice(0, 4).join(", ")}{atsResult.missing_keywords.length > 4 ? "..." : ""}</div>
                  </div>
                )}

                {/* PDF Preview iframe */}
                {result.pdf_ready && (
                  <div style={{ border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
                    <div style={{ padding: "6px 12px", background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 11, color: "#4A4A60", display: "flex", alignItems: "center", gap: 6 }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/></svg>
                      PREVIEW
                    </div>
                    <iframe
                      src={`${API_BASE}/preview/${result.generation_id}`}
                      style={{ width: "100%", height: 420, border: "none", display: "block" }}
                      title="Resume Preview"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
