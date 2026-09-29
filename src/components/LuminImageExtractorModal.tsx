import React, { useState, useMemo } from "react";
import { X, Search, Copy, Check, Download, Image as ImageIcon, Code, Sparkles, ExternalLink, RefreshCw, Terminal, Layers } from "lucide-react";
import luminGamesRaw from "../lumin-games.json";
import { toast } from "sonner";

interface LuminImageExtractorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LuminImageExtractorModal({ isOpen, onClose }: LuminImageExtractorModalProps) {
  const [activeTab, setActiveTab] = useState<"explorer" | "code" | "test">("explorer");
  const [search, setSearch] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  
  // Single game image test state
  const [testId, setTestId] = useState("selenite/wordlebot");
  const [testSession, setTestSession] = useState("60919094aa4265e2fd2bc9e9b1874e4e");
  const [testResultUrl, setTestResultUrl] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const filteredGames = useMemo(() => {
    if (!search.trim()) return luminGamesRaw.slice(0, 120);
    const q = search.toLowerCase().trim();
    return luminGamesRaw
      .filter((g) => g.name.toLowerCase().includes(q) || g.id.toLowerCase().includes(q))
      .slice(0, 150);
  }, [search]);

  if (!isOpen) return null;

  const handleCopyUrl = (url: string, idx: number) => {
    const fullUrl = window.location.origin + url;
    navigator.clipboard.writeText(fullUrl);
    setCopiedIndex(idx);
    toast.success("Copied raw game image URL to clipboard!");
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleCopyCodeSnippet = (codeText: string) => {
    navigator.clipboard.writeText(codeText);
    setCopiedCode(true);
    toast.success("Copied code snippet!");
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleRunTestFetch = async () => {
    setIsTesting(true);
    try {
      const res = await fetch("/api/v1/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      let session = testSession;
      if (res.ok) {
        const data = await res.json();
        if (data.session_id) {
          session = data.session_id;
          setTestSession(session);
        }
      }
      const rawUrl = `/api/lumin-icon/${session}/${testId}`;
      setTestResultUrl(rawUrl);
      toast.success("Successfully fetched raw game image token!");
    } catch {
      setTestResultUrl(`/api/lumin-icon/${testSession}/${testId}`);
    } finally {
      setIsTesting(false);
    }
  };

  const sampleJsCode = `// 1. Initialize LuminSDK in Headless Mode (Zero Default UI/Theme)
Lumin.init({
  container: '#lumin-hidden-container', // Element target
  renderUI: false,                     // Disables default Lumin theme & layout injection
  onLoad: function(data) {
    console.log("Raw Lumin games received:", data.games.length);
    
    // Loop through raw games payload and extract image URLs
    data.games.forEach(game => {
      const title = game.title || game.name;
      const imageUrl = game.image; // Raw game thumbnail image URL
      
      // Render custom image with zero default SDK theme
      const img = document.createElement('img');
      img.src = imageUrl;
      img.alt = title;
      img.className = 'my-custom-game-thumbnail';
      document.getElementById('my-custom-grid').appendChild(img);
    });
  }
});`;

  const sampleReactCode = `// React Custom Lumin Image Proxy Component
import React, { useEffect, useState } from "react";

export function LuminGameImage({ token, title }: { token: string; title: string }) {
  // Use high-speed server proxy to ensure fresh session prefix & zero CORS blocks
  const rawImageUrl = \`/api/lumin-icon/\${token}\`;

  return (
    <div className="relative rounded-2xl overflow-hidden aspect-square border border-white/10 bg-neutral-900 group">
      <img
        src={rawImageUrl}
        alt={title}
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        loading="lazy"
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3">
        <h4 className="text-xs font-bold text-white truncate">{title}</h4>
      </div>
    </div>
  );
}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-5xl h-[90vh] max-h-[780px] rounded-3xl border border-white/15 bg-neutral-950/95 text-white shadow-2xl shadow-black/80 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-inner">
              <ImageIcon size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                LuminSDK Raw Game Images
                <span className="rounded-full bg-cyan-500/20 px-2.5 py-0.5 text-[10px] font-extrabold text-cyan-300 border border-cyan-500/30">
                  renderUI: false
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                Extract actual game covers & thumbnails with zero default SDK theme or layout
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-white/10 px-5 py-2.5 bg-neutral-900/60">
          <button
            onClick={() => setActiveTab("explorer")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "explorer"
                ? "bg-cyan-500 text-black shadow-md shadow-cyan-500/30"
                : "text-neutral-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Layers size={14} />
            <span>Raw Images Library ({luminGamesRaw.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("code")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "code"
                ? "bg-cyan-500 text-black shadow-md shadow-cyan-500/30"
                : "text-neutral-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Code size={14} />
            <span>SDK Integration Code</span>
          </button>

          <button
            onClick={() => setActiveTab("test")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "test"
                ? "bg-cyan-500 text-black shadow-md shadow-cyan-500/30"
                : "text-neutral-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Terminal size={14} />
            <span>Live Asset Tester</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === "explorer" && (
            <div className="space-y-4">
              {/* Search input */}
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search 1,169+ games by name or Lumin ID..."
                  className="w-full h-10 rounded-2xl border border-white/10 bg-white/5 pl-10 pr-4 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-all"
                />
              </div>

              {/* Grid of raw game images */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
                {filteredGames.map((game, idx) => {
                  const rawIconUrl = `/api/lumin-icon/${game.image_token}`;
                  return (
                    <div
                      key={game.id}
                      className="group relative flex flex-col rounded-2xl border border-white/10 bg-neutral-900/80 p-2 overflow-hidden transition-all duration-200 hover:border-cyan-500/50 hover:bg-neutral-900 shadow-md"
                    >
                      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-black">
                        <img
                          src={rawIconUrl}
                          alt={game.name}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                          <button
                            onClick={() => handleCopyUrl(rawIconUrl, idx)}
                            className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500 text-black shadow-lg hover:scale-105 transition-transform cursor-pointer"
                            title="Copy Raw Image URL"
                          >
                            {copiedIndex === idx ? <Check size={14} /> : <Copy size={14} />}
                          </button>

                          <a
                            href={rawIconUrl}
                            download={`${game.name.replace(/[^a-zA-Z0-9]/g, "_")}_cover.png`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20 text-white shadow-lg hover:scale-105 transition-transform cursor-pointer"
                            title="Open / Download Image"
                          >
                            <Download size={14} />
                          </a>
                        </div>
                      </div>

                      <div className="mt-2 px-1">
                        <h4 className="truncate text-xs font-bold text-white group-hover:text-cyan-300 transition-colors">
                          {game.name}
                        </h4>
                        <p className="truncate text-[10px] font-mono text-neutral-400 mt-0.5">
                          {game.id}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "code" && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4">
                <h3 className="text-sm font-bold text-cyan-300 flex items-center gap-2">
                  <Sparkles size={16} />
                  How to get actual game images without the default SDK theme
                </h3>
                <p className="text-xs text-neutral-300 mt-1.5 leading-relaxed">
                  To get raw game image URLs and completely bypass the SDK's built-in grid layout, styles, and default themes, pass <code className="rounded bg-black/40 px-1.5 py-0.5 text-cyan-300 font-mono text-[11px]">renderUI: false</code> inside your <code className="rounded bg-black/40 px-1.5 py-0.5 text-cyan-300 font-mono text-[11px]">Lumin.init()</code> options.
                </p>
              </div>

              {/* Vanilla JS Snippet */}
              <div className="rounded-2xl border border-white/10 bg-neutral-900 overflow-hidden">
                <div className="flex items-center justify-between bg-white/5 px-4 py-2.5 border-b border-white/10">
                  <span className="text-xs font-bold text-neutral-300 font-mono">Vanilla JavaScript / HTML</span>
                  <button
                    onClick={() => handleCopyCodeSnippet(sampleJsCode)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-white/10 bg-white/5 text-[11px] font-semibold text-neutral-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    {copiedCode ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    <span>{copiedCode ? "Copied" : "Copy Code"}</span>
                  </button>
                </div>
                <pre className="p-4 text-xs font-mono text-cyan-200 overflow-x-auto leading-relaxed bg-black/50">
                  {sampleJsCode}
                </pre>
              </div>

              {/* React Component Snippet */}
              <div className="rounded-2xl border border-white/10 bg-neutral-900 overflow-hidden">
                <div className="flex items-center justify-between bg-white/5 px-4 py-2.5 border-b border-white/10">
                  <span className="text-xs font-bold text-neutral-300 font-mono">React Custom Image Component</span>
                  <button
                    onClick={() => handleCopyCodeSnippet(sampleReactCode)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-white/10 bg-white/5 text-[11px] font-semibold text-neutral-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    {copiedCode ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    <span>{copiedCode ? "Copied" : "Copy Code"}</span>
                  </button>
                </div>
                <pre className="p-4 text-xs font-mono text-cyan-200 overflow-x-auto leading-relaxed bg-black/50">
                  {sampleReactCode}
                </pre>
              </div>
            </div>
          )}

          {activeTab === "test" && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-white/10 bg-neutral-900 p-5 space-y-4">
                <h3 className="text-sm font-bold text-white">Live Asset Fetch Test</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 mb-1">Game ID</label>
                    <input
                      type="text"
                      value={testId}
                      onChange={(e) => setTestId(e.target.value)}
                      placeholder="e.g. selenite/wordlebot"
                      className="w-full h-10 rounded-xl border border-white/10 bg-black/50 px-3 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-400 mb-1">Session ID</label>
                    <input
                      type="text"
                      value={testSession}
                      onChange={(e) => setTestSession(e.target.value)}
                      placeholder="Session Token"
                      className="w-full h-10 rounded-xl border border-white/10 bg-black/50 px-3 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                    />
                  </div>
                </div>

                <button
                  onClick={handleRunTestFetch}
                  disabled={isTesting}
                  className="px-4 py-2.5 rounded-xl bg-cyan-500 text-black text-xs font-bold hover:bg-cyan-400 transition-colors cursor-pointer flex items-center gap-2"
                >
                  <RefreshCw size={14} className={isTesting ? "animate-spin" : ""} />
                  <span>Fetch Fresh Raw Image Token</span>
                </button>

                {testResultUrl && (
                  <div className="mt-4 p-4 rounded-xl border border-cyan-500/30 bg-black/60 flex flex-col sm:flex-row items-center gap-4">
                    <img
                      src={testResultUrl}
                      alt="Tested Cover"
                      className="h-28 w-28 rounded-xl object-cover border border-white/20 shadow-lg bg-black"
                    />
                    <div className="flex-1 space-y-2 text-left w-full">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-md border border-emerald-500/30">
                        Status: 200 OK
                      </span>
                      <p className="text-xs font-mono text-neutral-300 break-all bg-black/40 p-2 rounded-lg border border-white/5">
                        {window.location.origin + testResultUrl}
                      </p>
                      <button
                        onClick={() => handleCopyUrl(testResultUrl, -1)}
                        className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/10 text-xs font-bold text-white hover:bg-white/20 transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <Copy size={12} />
                        <span>Copy URL</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
