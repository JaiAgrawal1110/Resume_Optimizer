import { useState, useEffect } from "react";
import { API_BASE, apiFetch } from "../api";

export default function HistoryPage({ onBack }) {
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiFetch("/history").then(d => setHistory(d.history)).catch(err => setError(err.message));
  }, []);

  return (
    <div className="relative z-10 max-w-3xl mx-auto px-6 py-10">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <button onClick={onBack} className="btn-ghost">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Back
        </button>
        <h1 className="display-font" style={{ fontSize: 28, color: "#F0F0FF", fontWeight: 700 }}>History</h1>
      </div>

      {error && <div className="error-strip mb-4">{error}</div>}
      {history.length === 0 && !error && (
        <div style={{ textAlign: "center", color: "#3A3A55", fontSize: 13, padding: "60px 0" }}>No tailoring runs yet.</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {history.map(h => (
          <div key={h.id} className="card" style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, color: "#C0C0D8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {h.job_description_snippet}...
              </div>
              <div style={{ display: "flex", gap: 10, fontSize: 11, color: "#4A4A60", marginTop: 5 }}>
                <span>{h.created_at?.slice(0, 16)}</span>
                {h.ats_score != null && <span style={{ color: "#2DD4BF" }}>ATS {h.ats_score}/100</span>}
              </div>
            </div>
            {h.pdf_path && (
              <a href={`${API_BASE}/download/${h.id}`} className="btn-teal" style={{ flexShrink: 0, textDecoration: "none", padding: "7px 14px", fontSize: 12 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
