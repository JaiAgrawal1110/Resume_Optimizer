import { useState } from "react";
import { FileText, Sparkles, History } from "lucide-react";
import UploadCV from "./pages/UploadCV";
import TailorPage from "./pages/TailorPage";
import HistoryPage from "./pages/HistoryPage";

const TABS = [
  { key: "upload", label: "Upload / Edit CV", icon: FileText, component: UploadCV },
  { key: "tailor", label: "Tailor", icon: Sparkles, component: TailorPage },
  { key: "history", label: "History", icon: History, component: HistoryPage },
];

export default function App() {
  const [activeTab, setActiveTab] = useState("upload");
  const ActiveComponent = TABS.find((t) => t.key === activeTab).component;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <nav className="sticky top-0 z-10 backdrop-blur-md bg-white/80 border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg text-slate-900 tracking-tight">AI Resume Tailor</span>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-white text-indigo-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </nav>
      <ActiveComponent />
    </div>
  );
}
