import { useState } from "react";
import { API_BASE, apiFetch } from "../api";

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
      if (jdFile) {
        formData.append("jd_file", jdFile);
      } else {
        formData.append("job_description", jdText);
      }
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
      const data = await apiFetch(`/ats-score/${result.generation_id}`, { method: "POST" });
      setAtsResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setAtsLoading(false);
    }
  }

  const cv = result?.tailored_cv;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Tailor Resume</h1>

      <form onSubmit={handleTailor} className="space-y-3 mb-6">
        <textarea
          placeholder="Paste job description here..."
          value={jdText}
          onChange={(e) => {
            setJdText(e.target.value);
            if (e.target.value) setJdFile(null);
          }}
          disabled={!!jdFile}
          rows={6}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm disabled:bg-gray-100"
        />
        <div className="text-xs text-gray-500">— or —</div>
        <input
          type="file"
          accept=".pdf,.docx,.txt"
          onChange={(e) => {
            setJdFile(e.target.files[0]);
            if (e.target.files[0]) setJdText("");
          }}
          className="text-sm"
        />
        <button
          type="submit"
          disabled={(!jdText && !jdFile) || loading}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
        >
          {loading ? "Tailoring (this can take 20-40s)..." : "Generate Tailored Resume"}
        </button>
      </form>

      {error && <div className="text-red-600 text-sm mb-4">{error}</div>}

      {result && (
        <div className="border border-gray-200 rounded p-4 bg-gray-50 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <span className={result.pdf_ready ? "text-green-700" : "text-amber-700"}>
                {result.pdf_ready ? "PDF ready" : "PDF issue"}
              </span>
              {result.page_count != null && <span className="text-gray-500"> · {result.page_count} page(s)</span>}
              {result.trim_attempts > 0 && (
                <span className="text-gray-500"> · trimmed {result.trim_attempts}x to fit</span>
              )}
            </div>
            {result.pdf_ready && (
              <a
                href={`${API_BASE}/download/${result.generation_id}`}
                className="bg-green-600 text-white px-3 py-1.5 rounded text-sm"
              >
                Download PDF
              </a>
            )}
          </div>

          {result.pdf_warning && <div className="text-amber-700 text-sm">{result.pdf_warning}</div>}

          <div>
            <h3 className="font-semibold text-sm mb-1">Summary</h3>
            <p className="text-sm text-gray-700">{cv.summary}</p>
          </div>

          <div>
            <h3 className="font-semibold text-sm mb-1">Experience ({cv.experience.length})</h3>
            {cv.experience.map((exp, i) => (
              <div key={i} className="text-sm mb-1">
                <strong>{exp.title}</strong> — {exp.organization}
              </div>
            ))}
          </div>

          <div>
            <h3 className="font-semibold text-sm mb-1">Projects ({cv.projects.length})</h3>
            {cv.projects.map((p, i) => (
              <div key={i} className="text-sm mb-1">
                {p.name}
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-gray-200">
            <button
              onClick={handleAtsScore}
              disabled={atsLoading}
              className="bg-purple-600 text-white px-3 py-1.5 rounded text-sm disabled:opacity-50"
            >
              {atsLoading ? "Scoring..." : "Run ATS Score"}
            </button>

            {atsResult && (
              <div className="mt-3 text-sm">
                <div className="text-lg font-bold mb-1">{atsResult.score}/100</div>
                <div className="mb-1">
                  <strong>Matched:</strong> {atsResult.matched_keywords.join(", ") || "—"}
                </div>
                <div className="mb-1">
                  <strong>Missing:</strong> {atsResult.missing_keywords.join(", ") || "—"}
                </div>
                <ul className="list-disc list-inside text-gray-700">
                  {atsResult.suggestions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
