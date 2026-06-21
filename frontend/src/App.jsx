import { useState } from "react";
import { Sparkles, History } from "lucide-react";
import Dashboard from "./pages/Dashboard";
import HistoryPage from "./pages/HistoryPage";

export default function App() {
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <nav className="sticky top-0 z-10 backdrop-blur-md bg-white/80 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg text-slate-900 tracking-tight">AI Resume Tailor</span>
          </div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              showHistory ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <History className="w-4 h-4" />
            History
          </button>
        </div>
      </nav>
      {showHistory ? <HistoryPage /> : <Dashboard />}
    </div>
  );
}
