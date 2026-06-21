import { useState } from "react";
import { Upload, Download, Loader2, Sparkles, CheckCircle2, AlertTriangle, Gauge } from "lucide-react";
import { API_BASE } from "../api";

export default function TailorPage() {
  const [jdText, setJdText] = useState("");
  const [jdFile, setJdFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [atsLoading, setAtsLoading] = useState(false);
  const [atsResult, setAtsResult] = useState(null);

  async function handleTailor(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setAtsResult(null);
    try {
      const formData = new FormData();
      if (jdFile) formData.append("jd_file", jdFile);
      else formData.append("job_description", jdText);
      const res = await fetch(`${API_BASE}/tailor`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Tailoring failed");
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAtsScore() {
    if (!result?.generation_id) return;
    setAtsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/ats-score/${result.generation_id}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Scoring failed");
      setAtsResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setAtsLoading(false);
    }
  }

  const cv = result?.tailored_cv;
  const scoreColor =
    atsResult?.score >= 75 ? "text-emerald-600" : atsResult?.score >= 50 ? "text-amber-500" : "text-red-500";

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Tailor Resume</h1>
        <p className="text-slate-500 mt-1">Paste a job description and get a one-page, ATS-ready PDF.</p>
      </div>

      <form onSubmit={handleTailor} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3 mb-8">
        <textarea
          placeholder="Paste job description here..."
          value={jdText}
          onChange={(e) => {
            setJdText(e.target.value);
            if (e.target.value) setJdFile(null);
          }}
          disabled={!!jdFile}
          rows={6}
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 disabled:bg-slate-50 resize-none"
        />
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-xs text-slate-400 font-medium">OR</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 border border-slate-200 rounded-xl px-4 py-2.5 cursor-pointer hover:border-indigo-300 transition-colors w-fit">
          <Upload className="w-4 h-4 text-slate-400" />
          {jdFile ? jdFile.name : "Upload JD file"}
          <input
            type="file"
            accept=".pdf,.docx,.txt"
            onChange={(e) => {
              setJdFile(e.target.files[0]);
              if (e.target.files[0]) setJdText("");
            }}
            className="hidden"
          />
        </label>

        <button
          type="submit"
          disabled={(!jdText && !jdFile) || loading}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-medium px-4 py-3 rounded-xl text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shadow-indigo-200"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Tailoring with AI (~20-40s)...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" /> Generate Tailored Resume
            </>
          )}
        </button>
      </form>

      {error && (
        <div className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {result && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 text-sm">
              {result.pdf_ready ? (
                <span className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full font-medium">
                  <CheckCircle2 className="w-4 h-4" /> PDF ready
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-amber-700 bg-amber-50 px-3 py-1.5 rounded-full font-medium">
                  <AlertTriangle className="w-4 h-4" /> PDF issue
                </span>
              )}
              {result.page_count != null && (
                <span className="text-slate-400">{result.page_count} page(s)</span>
              )}
            </div>
            {result.pdf_ready && (
              <a
                href={`${API_BASE}/download/${result.generation_id}`}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors shadow-sm shadow-emerald-200"
              >
                <Download className="w-4 h-4" /> Download PDF
              </a>
            )}
          </div>

          {result.pdf_warning && (
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              {result.pdf_warning}
            </div>
          )}

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Summary</h3>
            <p className="text-sm text-slate-700 leading-relaxed">{cv.summary}</p>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
              Experience ({cv.experience.length})
            </h3>
            <div className="space-y-1.5">
              {cv.experience.map((exp, i) => (
                <div key={i} className="text-sm text-slate-700">
                  <span className="font-medium">{exp.title}</span>
                  <span className="text-slate-400"> — {exp.organization}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
              Projects ({cv.projects.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {cv.projects.map((p, i) => (
                <span key={i} className="text-xs bg-violet-50 text-violet-700 px-2.5 py-1 rounded-full">
                  {p.name}
                </span>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <button
              onClick={handleAtsScore}
              disabled={atsLoading}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors disabled:opacity-40 shadow-sm shadow-violet-200"
            >
              {atsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gauge className="w-4 h-4" />}
              {atsLoading ? "Scoring..." : "Run ATS Score"}
            </button>

            {atsResult && (
              <div className="mt-4 bg-slate-50 rounded-xl p-4 space-y-3">
                <div className={`text-3xl font-bold ${scoreColor}`}>{atsResult.score}<span className="text-base text-slate-400">/100</span></div>
                <div className="text-sm">
                  <span className="font-medium text-slate-700">Matched: </span>
                  <span className="text-slate-600">{atsResult.matched_keywords.join(", ") || "—"}</span>
                </div>
                <div className="text-sm">
                  <span className="font-medium text-slate-700">Missing: </span>
                  <span className="text-slate-600">{atsResult.missing_keywords.join(", ") || "—"}</span>
                </div>
                {atsResult.suggestions.length > 0 && (
                  <ul className="text-sm text-slate-600 list-disc list-inside space-y-1">
                    {atsResult.suggestions.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
