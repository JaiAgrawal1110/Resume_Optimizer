import { useState, useEffect } from "react";
import { Download, Gauge, Clock } from "lucide-react";
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
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">History</h1>
        <p className="text-slate-500 mt-1">Every tailored resume you've generated.</p>
      </div>

      {error && (
        <div className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {history.length === 0 && !error && (
        <div className="text-center text-sm text-slate-400 py-12">No tailoring runs yet.</div>
      )}

      <div className="space-y-3">
        {history.map((h) => (
          <div
            key={h.id}
            className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center justify-between gap-4 hover:border-indigo-200 transition-colors"
          >
            <div className="min-w-0">
              <div className="text-sm text-slate-700 truncate">{h.job_description_snippet}...</div>
              <div className="flex items-center gap-3 text-xs text-slate-400 mt-1.5">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {h.created_at}
                </span>
                {h.ats_score != null && (
                  <span className="flex items-center gap-1">
                    <Gauge className="w-3 h-3" /> {h.ats_score}/100
                  </span>
                )}
              </div>
            </div>
            {h.pdf_path && (
              <a
                href={`${API_BASE}/download/${h.id}`}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors shrink-0"
              >
                <Download className="w-3.5 h-3.5" /> Download
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
