import { useState, useEffect } from "react";
import { API_BASE, apiFetch } from "../api";

export default function HistoryPage() {
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiFetch("/history")
      .then((data) => setHistory(data.history))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">History</h1>

      {error && <div className="text-red-600 text-sm mb-4">{error}</div>}

      {history.length === 0 && !error && (
        <div className="text-sm text-gray-500">No tailoring runs yet.</div>
      )}

      <div className="space-y-2">
        {history.map((h) => (
          <div key={h.id} className="border border-gray-200 rounded p-3 flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-800">{h.job_description_snippet}...</div>
              <div className="text-xs text-gray-500 mt-1">
                {h.created_at} {h.ats_score != null && `· ATS score: ${h.ats_score}/100`}
              </div>
            </div>
            {h.pdf_path && (
              <a
                href={`${API_BASE}/download/${h.id}`}
                className="bg-green-600 text-white px-3 py-1.5 rounded text-sm shrink-0 ml-3"
              >
                Download
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
