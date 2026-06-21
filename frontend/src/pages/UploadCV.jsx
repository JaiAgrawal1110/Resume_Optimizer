import { useState, useEffect } from "react";
import { API_BASE, apiFetch } from "../api";

export default function UploadCV() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [masterCV, setMasterCV] = useState(null);

  useEffect(() => {
    // On load, show whatever master CV is already saved, if any
    apiFetch("/master-cv")
      .then((data) => setMasterCV(data.master_cv))
      .catch(() => {}); // 404 if none uploaded yet — fine, ignore
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
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Master CV</h1>

      <form onSubmit={handleUpload} className="flex items-center gap-3 mb-6">
        <input
          type="file"
          accept=".pdf,.docx,.txt"
          onChange={(e) => setFile(e.target.files[0])}
          className="border border-gray-300 rounded px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={!file || loading}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
        >
          {loading ? "Structuring..." : "Upload & Structure"}
        </button>
      </form>

      {error && <div className="text-red-600 text-sm mb-4">{error}</div>}

      {masterCV && (
        <div className="border border-gray-200 rounded p-4 bg-gray-50">
          <h2 className="font-semibold text-lg mb-2">{masterCV.name}</h2>
          <p className="text-sm text-gray-600 mb-3">{masterCV.summary}</p>

          <div className="grid grid-cols-2 gap-4 text-sm mb-3">
            <div>{masterCV.email}</div>
            <div>{masterCV.phone}</div>
            <div>{masterCV.location}</div>
            <div>
              {masterCV.linkedin_url && (
                <a href={masterCV.linkedin_url} target="_blank" rel="noreferrer" className="text-blue-600 underline mr-3">
                  LinkedIn
                </a>
              )}
              {masterCV.github_url && (
                <a href={masterCV.github_url} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                  GitHub
                </a>
              )}
            </div>
          </div>

          <div className="text-sm mb-2">
            <strong>{masterCV.experience?.length || 0}</strong> experience entries,{" "}
            <strong>{masterCV.projects?.length || 0}</strong> projects,{" "}
            <strong>{masterCV.education?.length || 0}</strong> education entries
          </div>

          <details className="text-xs mt-3">
            <summary className="cursor-pointer text-gray-500">View full structured JSON</summary>
            <pre className="bg-white border border-gray-200 rounded p-2 mt-2 overflow-auto max-h-96">
              {JSON.stringify(masterCV, null, 2)}
            </pre>
          </details>
        </div>
      )}

      {!masterCV && !error && (
        <div className="text-sm text-gray-500">No master CV uploaded yet — upload one above.</div>
      )}
    </div>
  );
}
