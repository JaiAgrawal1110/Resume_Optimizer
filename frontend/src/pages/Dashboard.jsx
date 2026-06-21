import { useState, useEffect } from "react";
import {
  Upload, Download, Loader2, Sparkles, CheckCircle2, AlertTriangle,
  Gauge, FileCheck2, FileText,
} from "lucide-react";
import { API_BASE, apiFetch } from "../api";

export default function Dashboard() {
  // Master CV state
  const [cvFile, setCvFile] = useState(null);
  const [cvLoading, setCvLoading] = useState(false);
  const [cvError, setCvError] = useState(null);
  const [masterCV, setMasterCV] = useState(null);

  // JD / tailoring state
  const [jdText, setJdText] = useState("");
  const [jdFile, setJdFile] = useState(null);
  const [tailorLoading, setTailorLoading] = useState(false);
  const [tailorError, setTailorError] = useState(null);
  const [result, setResult] = useState(null);

  // ATS state
  const [atsLoading, setAtsLoading] = useState(false);
  const [atsResult, setAtsResult] = useState(null);

  useEffect(() => {
    apiFetch("/master-cv")
      .then((data) => setMasterCV(data.master_cv))
      .catch(() => {});
  }, []);

  async function handleUploadCV(e) {
    e.preventDefault();
    if (!cvFile) return;
    setCvLoading(true);
    setCvError(null);
    try {
      const formData = new FormData();
      formData.append("file", cvFile);
      const res = await fetch(`${API_BASE}/upload-cv`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Upload failed");
      setMasterCV(data.master_cv);
    } catch (err) {
      setCvError(err.message);
    } finally {
      setCvLoading(false);
    }
  }

  async function handleTailor(e) {
    e.preventDefault();
    setTailorLoading(true);
    setTailorError(null);
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
      setTailorError(err.message);
    } finally {
      setTailorLoading(false);
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
      setTailorError(err.message);
    } finally {
      setAtsLoading(false);
    }
  }

  const scoreColor =
    atsResult?.score >= 75 ? "text-emerald-600" : atsResult?.score >= 50 ? "text-amber-500" : "text-red-500";

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Build a Tailored Resume</h1>
        <p className="text-slate-500 mt-1">Upload your CV, drop in a job description, generate and download.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Column 1: Master CV */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">1</div>
            <h2 className="font-semibold text-slate-900">Master CV</h2>
          </div>

          <form onSubmit={handleUploadCV} className="space-y-3">
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 hover:border-indigo-300 rounded-xl p-6 cursor-pointer transition-colors">
              <Upload className="w-5 h-5 text-slate-400" />
              <span className="text-xs text-slate-600 text-center px-2 truncate max-w-full">
                {cvFile ? cvFile.name : "Choose PDF / DOCX / TXT"}
              </span>
              <input type="file" accept=".pdf,.docx,.txt" onChange={(e) => setCvFile(e.target.files[0])} className="hidden" />
            </label>
            <button
              type="submit"
              disabled={!cvFile || cvLoading}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-medium px-3 py-2.5 rounded-xl text-sm transition-all disabled:opacity-40"
            >
              {cvLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck2 className="w-4 h-4" />}
              {cvLoading ? "Structuring..." : "Upload & Structure"}
            </button>
          </form>

          {cvError && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-3">{cvError}</div>}

          {masterCV && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="font-semibold text-sm text-slate-900">{masterCV.name}</div>
              <div className="flex gap-1.5 mt-2 flex-wrap">
                <span className="text-[11px] font-medium bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full">
                  {masterCV.experience?.length || 0} exp
                </span>
                <span className="text-[11px] font-medium bg-violet-50 text-violet-700 px-2 py-1 rounded-full">
                  {masterCV.projects?.length || 0} projects
                </span>
              </div>
            </div>
          )}
          {!masterCV && !cvError && <div className="text-xs text-slate-400 mt-4">No CV uploaded yet.</div>}
        </div>

        {/* Column 2: Job Description */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center text-xs font-bold text-violet-700">2</div>
            <h2 className="font-semibold text-slate-900">Job Description</h2>
          </div>

          <form onSubmit={handleTailor} className="space-y-3 flex-1 flex flex-col">
            <textarea
              placeholder="Paste job description..."
              value={jdText}
              onChange={(e) => { setJdText(e.target.value); if (e.target.value) setJdFile(null); }}
              disabled={!!jdFile}
              rows={5}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400 disabled:bg-slate-50 resize-none"
            />
            <label className="flex items-center gap-2 text-xs text-slate-600 border border-slate-200 rounded-xl px-3 py-2 cursor-pointer hover:border-violet-300 transition-colors">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              {jdFile ? jdFile.name : "or upload JD file"}
              <input
                type="file" accept=".pdf,.docx,.txt"
                onChange={(e) => { setJdFile(e.target.files[0]); if (e.target.files[0]) setJdText(""); }}
                className="hidden"
              />
            </label>
            <button
              type="submit"
              disabled={(!jdText && !jdFile) || tailorLoading || !masterCV}
              className="mt-auto w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 active:scale-[0.99] text-white font-medium px-3 py-2.5 rounded-xl text-sm transition-all disabled:opacity-40"
            >
              {tailorLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {tailorLoading ? "Tailoring (~30s)..." : "Generate Tailored Resume"}
            </button>
            {!masterCV && <div className="text-[11px] text-slate-400 text-center">Upload a master CV first</div>}
          </form>

          {tailorError && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-3">{tailorError}</div>}
        </div>

        {/* Column 3: Results / Actions */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700">3</div>
            <h2 className="font-semibold text-slate-900">Result</h2>
          </div>

          {!result && <div className="text-xs text-slate-400">Generate a resume to see results here.</div>}

          {result && (
            <div className="space-y-3 flex-1 flex flex-col">
              <div className="flex items-center gap-2 flex-wrap text-xs">
                {result.pdf_ready ? (
                  <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" /> PDF ready
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full font-medium">
                    <AlertTriangle className="w-3.5 h-3.5" /> Issue
                  </span>
                )}
                {result.page_count != null && <span className="text-slate-400">{result.page_count}p</span>}
              </div>

              {result.pdf_warning && (
                <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
                  {result.pdf_warning}
                </div>
              )}

              {result.pdf_ready && (
                <a
                  href={`${API_BASE}/download/${result.generation_id}`}
                  className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-3 py-2.5 rounded-xl transition-colors"
                >
                  <Download className="w-4 h-4" /> Download PDF
                </a>
              )}

              <button
                onClick={handleAtsScore}
                disabled={atsLoading}
                className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium px-3 py-2.5 rounded-xl transition-colors disabled:opacity-40"
              >
                {atsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gauge className="w-4 h-4" />}
                {atsLoading ? "Scoring..." : "Run ATS Score"}
              </button>

              {atsResult && (
                <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                  <div className={`text-2xl font-bold ${scoreColor}`}>{atsResult.score}<span className="text-sm text-slate-400">/100</span></div>
                  <div className="text-[11px] text-slate-600"><strong>Matched:</strong> {atsResult.matched_keywords.join(", ") || "—"}</div>
                  <div className="text-[11px] text-slate-600"><strong>Missing:</strong> {atsResult.missing_keywords.join(", ") || "—"}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
