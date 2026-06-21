import { useState } from "react";
import UploadCV from "./pages/UploadCV";
import TailorPage from "./pages/TailorPage";
import HistoryPage from "./pages/HistoryPage";

const TABS = [
  { key: "upload", label: "Upload/Edit CV", component: UploadCV },
  { key: "tailor", label: "Tailor", component: TailorPage },
  { key: "history", label: "History", component: HistoryPage },
];

export default function App() {
  const [activeTab, setActiveTab] = useState("upload");
  const ActiveComponent = TABS.find((t) => t.key === activeTab).component;

  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-gray-200 px-6 py-3 flex items-center gap-1">
        <span className="font-bold text-lg mr-6">AI Resume Tailor</span>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 rounded text-sm ${
              activeTab === tab.key ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <ActiveComponent />
    </div>
  );
}
