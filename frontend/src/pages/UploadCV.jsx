import { useState, useEffect } from "react";
import { Upload, Mail, Phone, MapPin, Linkedin, Github, Loader2, ChevronDown, FileCheck2 } from "lucide-react";
import { API_BASE, apiFetch } from "../api";

export default function UploadCV() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [masterCV, setMasterCV] = useState(null);
  const [showJson, setShowJson] = useState(false);

  useEffect(() => {
    apiFetch("/master-cv")
      .then((data) => setMasterCV(data.master_cv))
      .catch(() => {});
  }, []);

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_BASE}/upload-cv`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Upload failed");
      setMasterCV(data.master_cv);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Master CV</h1>
        <p className="text-slate-500 mt-1">Upload once. Every tailored resume is generated from this.</p>
      </div>

      <form onSubmit={handleUpload} className="mb-8">
        <label className="group flex flex-col items-center justify-center gap-3 border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-2xl p-10 cursor-pointer transition-colors bg-white">
          <div className="w-12 h-12 rounded-full bg-indigo-50 group-hover:bg-indigo-100 flex items-center justify-center transition-colors">
            <Upload className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="text-center">
            <span className="text-sm font-medium text-slate-700">
              {file ? file.name : "Click to choose a file"}
            </span>
            <p className="text-xs text-slate-400 mt-1">PDF, DOCX, or TXT</p>
          </div>
          <input
            type="file"
            accept=".pdf,.docx,.txt"
            onChange={(e) => setFile(e.target.files[0])}
            className="hidden"
          />
        </label>

        <button
          type="submit"
          disabled={!file || loading}
          className="mt-4 w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-medium px-4 py-3 rounded-xl text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shadow-indigo-200"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Structuring with AI...
            </>
          ) : (
            <>
              <FileCheck2 className="w-4 h-4" /> Upload & Structure
            </>
          )}
        </button>
      </form>

      {error && (
        <div className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {masterCV && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">{masterCV.name}</h2>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">{masterCV.summary}</p>

          <div className="grid grid-cols-2 gap-3 mt-5 text-sm">
            {masterCV.email && (
              <div className="flex items-center gap-2 text-slate-600">
                <Mail className="w-3.5 h-3.5 text-slate-400" /> {masterCV.email}
              </div>
            )}
            {masterCV.phone && (
              <div className="flex items-center gap-2 text-slate-600">
                <Phone className="w-3.5 h-3.5 text-slate-400" /> {masterCV.phone}
              </div>
            )}
            {masterCV.location && (
              <div className="flex items-center gap-2 text-slate-600">
                <MapPin className="w-3.5 h-3.5 text-slate-400" /> {masterCV.location}
              </div>
            )}
            <div className="flex items-center gap-3">
              {masterCV.linkedin_url && (
                <a href={masterCV.linkedin_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800">
                  <Linkedin className="w-3.5 h-3.5" /> LinkedIn
                </a>
              )}
              {masterCV.github_url && (
                <a href={masterCV.github_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800">
                  <Github className="w-3.5 h-3.5" /> GitHub
                </a>
              )}
            </div>
          </div>

          <div className="flex gap-2 mt-5">
            <span className="text-xs font-medium bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full">
              {masterCV.experience?.length || 0} experience
            </span>
            <span className="text-xs font-medium bg-violet-50 text-violet-700 px-3 py-1.5 rounded-full">
              {masterCV.projects?.length || 0} projects
            </span>
            <span className="text-xs font-medium bg-slate-100 text-slate-700 px-3 py-1.5 rounded-full">
              {masterCV.education?.length || 0} education
            </span>
          </div>

          <button
            onClick={() => setShowJson(!showJson)}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mt-5 transition-colors"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showJson ? "rotate-180" : ""}`} />
            {showJson ? "Hide" : "View"} full structured JSON
          </button>
          {showJson && (
            <pre className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-2 overflow-auto max-h-96 text-xs text-slate-700">
              {JSON.stringify(masterCV, null, 2)}
            </pre>
          )}
        </div>
      )}

      {!masterCV && !error && (
        <div className="text-center text-sm text-slate-400 py-8">No master CV uploaded yet.</div>
      )}
    </div>
  );
}
