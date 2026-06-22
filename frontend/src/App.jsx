import { useState } from "react";
import Dashboard from "./pages/Dashboard";
import HistoryPage from "./pages/HistoryPage";

export default function App() {
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div className="min-h-screen grid-texture">
      <div className="hero-glow fixed inset-0 pointer-events-none" />

      {/* Navbar */}
      <nav style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(7,7,14,0.8)", backdropFilter: "blur(12px)" }}
        className="sticky top-0 z-20 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div style={{ background: "linear-gradient(135deg, #6D28D9, #2DD4BF)", borderRadius: 10 }}
            className="w-8 h-8 flex items-center justify-center text-white font-bold text-sm">
            R
          </div>
          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 15, color: "#E8E8F0", letterSpacing: "-0.02em" }}>
            AI Resume Tailor
          </span>
        </div>
        <button onClick={() => setShowHistory(!showHistory)} className="btn-ghost">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          History
        </button>
      </nav>

      {showHistory ? <HistoryPage onBack={() => setShowHistory(false)} /> : <Dashboard />}
    </div>
  );
}
