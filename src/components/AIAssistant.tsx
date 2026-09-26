import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Sparkles,
  Send,
  Square,
  Copy,
  Check,
  RotateCcw,
  Trash2,
  Plus,
  MessageSquare,
  Bot,
  User,
  ChevronDown,
  ChevronUp,
  Brain,
  GraduationCap,
  Code,
  FileText,
  Calculator,
  Compass,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  ArrowDown,
  Key,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  X,
  Users,
  BookOpen,
  Zap,
  HelpCircle,
  Download,
  Sliders,
  Settings2,
  Flame,
  Wand2,
  Globe,
  Play,
  Maximize2,
  FolderPlus,
  FileCode,
  MonitorPlay,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import FriendsPanel from "./FriendsPanel";
import PersonaModal from "./PersonaModal";
import { ChatProfile } from "../types";
import {
  AIPersona,
  DEFAULT_PERSONAS,
  getAllPersonas,
  getCustomPersonas,
  saveCustomPersona,
} from "../lib/personas";

export function parseThoughtAndContent(raw: string): {
  thought: string;
  answer: string;
  isStillThinking: boolean;
} {
  if (!raw) return { thought: "", answer: "", isStillThinking: false };

  // Strip any <think> tags completely so answers render directly
  const cleanAnswer = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<think>[\s\S]*/gi, "")
    .replace(/```(?:thought|thinking)[\s\S]*?```/gi, "")
    .trim();

  return { thought: "", answer: cleanAnswer || raw, isStillThinking: false };
}

export interface ChatThread {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: AIMessage[];
  model: string;
  personaId: string;
}

export interface AIMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  modelUsed?: string;
  isError?: boolean;
}

export interface AIModelOption {
  id: string;
  name: string;
  provider: string;
  description: string;
  badge?: string;
}

const AVAILABLE_MODELS: AIModelOption[] = [
  {
    id: "openrouter/free",
    name: "OpenRouter Auto (Free)",
    provider: "OpenRouter Auto-Router",
    description: "Automatically routes to active, 100% free models without managing model availability.",
    badge: "Auto Free",
  },
  {
    id: "meta-llama/llama-3.3-70b-instruct:free",
    name: "Llama 3.3 70B (Free)",
    provider: "Meta via OpenRouter",
    description: "Deep reasoning, analysis, and versatile STEM problem solving (100% Free).",
    badge: "Recommended",
  },
  {
    id: "qwen/qwen-2.5-coder-32b-instruct:free",
    name: "Qwen 2.5 Coder 32B (Free)",
    provider: "Alibaba via OpenRouter",
    description: "Optimized for software development, debugging, and algorithms (100% Free).",
    badge: "Coder",
  },
  {
    id: "meta-llama/llama-3.1-8b-instruct:free",
    name: "Llama 3.1 8B (Free)",
    provider: "Meta via OpenRouter",
    description: "Sub-second low latency for rapid answers and study notes (100% Free).",
    badge: "Ultra Fast",
  },
  {
    id: "google/gemini-2.0-flash-exp:free",
    name: "Gemini 2.0 Flash (Free)",
    provider: "Google via OpenRouter",
    description: "Multimodal speed, real-time responses, and broad knowledge (100% Free).",
    badge: "Fast Vision",
  },
  {
    id: "mistralai/mistral-small-24b-instruct-2501:free",
    name: "Mistral Small 24B (Free)",
    provider: "Mistral via OpenRouter",
    description: "Compact high-performance reasoning and writing model (100% Free).",
    badge: "Balanced",
  },
  {
    id: "microsoft/phi-4:free",
    name: "Phi-4 14B (Free)",
    provider: "Microsoft via OpenRouter",
    description: "High-grade mathematical problem solving and logic (100% Free).",
    badge: "Math & Logic",
  },
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash (Built-in)",
    provider: "Google GenAI",
    description: "Ultra-fast multimodal assistant engine.",
    badge: "Built-in",
  },
];

// =========================================================================
// 🚀 Interactive App Runner, Canvas Sandbox, & File Creator Component
// =========================================================================
interface AppSandboxArtifactProps {
  code: string;
  language: string;
  rawHeader?: string;
  isStreaming?: boolean;
}

const AppSandboxArtifact = React.memo(function AppSandboxArtifact({ code, language, rawHeader, isStreaming }: AppSandboxArtifactProps) {
  const [activeTab, setActiveTab] = useState<"preview" | "code">("code");
  const [copied, setCopied] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Set active tab to preview once it finishes streaming
  useEffect(() => {
    if (!isStreaming) {
      setActiveTab("preview");
    } else {
      setActiveTab("code");
    }
  }, [isStreaming]);

  // Determine filename from header like ```html:pong.html or default
  const filenameMatch = rawHeader?.match(/[:\s]([a-zA-Z0-9_\-.]+\.[a-zA-Z0-9]+)/);
  const defaultExt = language === "python" ? "py" : language === "javascript" || language === "js" ? "js" : language === "json" ? "json" : language === "markdown" || language === "md" ? "md" : "html";
  const filename = filenameMatch ? filenameMatch[1] : `app.${defaultExt}`;

  const isHtmlOrWeb = !isStreaming && (language === "html" || language === "htm" || language === "svg" || code.includes("<!DOCTYPE") || code.includes("<html") || (code.includes("<canvas") && code.includes("<script")));

  const handleDownload = () => {
    const mime = isHtmlOrWeb ? "text/html;charset=utf-8" : language === "json" ? "application/json" : "text/plain;charset=utf-8";
    const blob = new Blob([code], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleOpenInNewTab = () => {
    const blob = new Blob([code], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`my-3.5 rounded-2xl overflow-hidden border border-cyan-500/30 bg-[#080d1a] shadow-2xl transition-all ${isFullscreen ? "fixed inset-2 sm:inset-6 z-50 flex flex-col bg-[#050814]" : ""}`}>
      {/* Sandbox Header Bar */}
      <div className="px-3.5 py-2.5 bg-gradient-to-r from-cyan-950/60 via-[#0a1226] to-indigo-950/60 border-b border-cyan-500/20 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shrink-0">
            {isHtmlOrWeb ? <MonitorPlay size={13} /> : <FileCode size={13} />}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-white text-xs truncate flex items-center gap-1.5">
              <span>{filename}</span>
              {isStreaming ? (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[9px] font-bold border border-amber-400/30 animate-pulse">
                  WRITING FILE...
                </span>
              ) : isHtmlOrWeb ? (
                <span className="px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 font-mono text-[9px] font-bold border border-cyan-400/30">
                  LIVE APP
                </span>
              ) : null}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isHtmlOrWeb && !isStreaming && (
            <div className="flex items-center rounded-xl bg-black/40 border border-white/10 p-0.5 mr-1">
              <button
                type="button"
                onClick={() => setActiveTab("preview")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  activeTab === "preview" ? "bg-cyan-500 text-black shadow-md font-extrabold" : "text-neutral-400 hover:text-white"
                }`}
              >
                <Play size={10} fill={activeTab === "preview" ? "currentColor" : "none"} />
                <span>Run App</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("code")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  activeTab === "code" ? "bg-cyan-500 text-black shadow-md font-extrabold" : "text-neutral-400 hover:text-white"
                }`}
              >
                <Code size={11} />
                <span>Code</span>
              </button>
            </div>
          )}

          {isHtmlOrWeb && activeTab === "preview" && !isStreaming && (
            <button
              type="button"
              onClick={() => setIframeKey((k) => k + 1)}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border border-white/10 transition-colors cursor-pointer"
              title="Restart App"
            >
              <RotateCcw size={12} />
            </button>
          )}

          {isHtmlOrWeb && !isStreaming && (
            <button
              type="button"
              onClick={handleOpenInNewTab}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border border-white/10 transition-colors cursor-pointer"
              title="Open App in New Tab"
            >
              <ExternalLink size={12} />
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border border-white/10 transition-colors cursor-pointer"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            <Maximize2 size={12} />
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={isStreaming}
            className={`px-2 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
              isStreaming
                ? "bg-white/5 text-neutral-500 border-white/5 cursor-not-allowed"
                : "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/40"
            }`}
            title="Download File"
          >
            <Download size={11} />
            <span className="hidden sm:inline">Save</span>
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border border-white/10 transition-colors cursor-pointer"
            title="Copy Code"
          >
            {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
          </button>
        </div>
      </div>

      {/* Sandbox Body / Live Iframe / Code View */}
      {isHtmlOrWeb && activeTab === "preview" && !isStreaming ? (
        <div className={`w-full bg-black relative ${isFullscreen ? "flex-1 min-h-[400px]" : "h-80 sm:h-96"}`}>
          <iframe
            key={iframeKey}
            srcDoc={code}
            title={filename}
            sandbox="allow-scripts allow-modals allow-forms allow-same-origin allow-popups"
            className="w-full h-full border-0 bg-neutral-900 rounded-b-2xl"
          />
        </div>
      ) : (
        <div className="relative">
          {isStreaming && (
            <div className="absolute top-3 right-4 z-10 flex items-center gap-1.5 bg-amber-500/10 text-amber-300 px-2 py-1 rounded-lg border border-amber-500/20 text-[10px] font-bold">
              <Loader2 size={11} className="animate-spin text-amber-400" />
              <span>Streaming complete application...</span>
            </div>
          )}
          <pre className={`p-3.5 overflow-x-auto text-[11px] font-mono text-neutral-200 leading-relaxed custom-scrollbar bg-black/60 select-text ${isFullscreen ? "flex-1 max-h-none" : "max-h-80"}`}>
            <code>{code}</code>
          </pre>
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.code === nextProps.code &&
         prevProps.language === nextProps.language &&
         prevProps.rawHeader === nextProps.rawHeader &&
         prevProps.isStreaming === nextProps.isStreaming;
});

const QUICK_ACTIONS = [
  {
    label: "Search Web",
    promptPrefix: "Search the live internet and find the latest up-to-date information, sources, and guides on:\n\n",
    icon: "🌐",
  },
  {
    label: "Make a Game",
    promptPrefix: "Build a complete, fun, self-contained single-file HTML5 Canvas game with controls, score system, sound effects, and restart button for:\n\n",
    icon: "🎮",
  },
  {
    label: "Build an App",
    promptPrefix: "Create a complete, responsive single-file HTML/CSS/JS web application with a modern dark theme and interactive features for:\n\n",
    icon: "📱",
  },
  {
    label: "Create a File",
    promptPrefix: "Create a complete, ready-to-run file with code, data, and full implementation for:\n\n",
    icon: "📁",
  },
  {
    label: "Explain Simply",
    promptPrefix: "Explain this concept in plain, simple English with an everyday analogy:\n\n",
    icon: "💡",
  },
  {
    label: "Debug Code",
    promptPrefix: "Please review this code for bugs, logic errors, and performance improvements:\n\n```\n\n```",
    icon: "🔍",
  },
];

const PROMPT_SUGGESTIONS = [
  {
    title: "🎮 Create a Retro Arcade Game",
    desc: "Build a complete playable Space Invaders or Flappy Bird Canvas game in a single file.",
    prompt: "Build a complete, interactive HTML5 Canvas arcade space shooter game in a single file with score, sound effects, and keyboard controls.",
    icon: "🕹️",
  },
  {
    title: "📱 Build an Interactive Tool / Calculator",
    desc: "Create a sleek scientific calculator, pomodoro timer, or audio visualizer.",
    prompt: "Build a complete, responsive dark-themed scientific calculator and unit converter in a single-file HTML/CSS/JS app.",
    icon: "⚡",
  },
  {
    title: "🌐 Research Live Web Information",
    desc: "Search the internet for the latest 2026 tech breakthroughs, news, and releases.",
    prompt: "Search the live web and provide an up-to-date summary with source links on the latest AI, science, and computing breakthroughs.",
    icon: "🌐",
  },
  {
    title: "📁 Generate a Full Python / Data File",
    desc: "Create a complete Python script or structured JSON dataset ready to download.",
    prompt: "Write a complete, fully-commented Python automation script with error handling and sample dataset ready to run.",
    icon: "🐍",
  },
];

export default function AIAssistant() {
  const [showFriendsModal, setShowFriendsModal] = useState<boolean>(false);
  const [showPersonaModal, setShowPersonaModal] = useState<boolean>(false);

  const [chatProfile, setChatProfile] = useState<ChatProfile>(() => {
    try {
      const sessionSaved = sessionStorage.getItem("frosted_chat_profile");
      if (sessionSaved) {
        const parsed = JSON.parse(sessionSaved);
        if (parsed?.username) return parsed;
      }
      const saved = localStorage.getItem("frosted_chat_profile");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.username) return parsed;
      }
    } catch {}
    return {
      uid: "user_guest",
      username: "Guest",
      photoURL: "https://api.dicebear.com/7.x/bottts/svg?seed=Guest",
    };
  });

  useEffect(() => {
    const handleProfileUpdate = (e: any) => {
      if (e.detail) {
        setChatProfile(e.detail);
      }
    };
    window.addEventListener("frosted_profile_updated", handleProfileUpdate);
    return () => window.removeEventListener("frosted_profile_updated", handleProfileUpdate);
  }, []);

  const [webSearchEnabled, setWebSearchEnabled] = useState<boolean>(true);
  const [apiKey] = useState<string>(() => localStorage.getItem("openrouter_api_key") || localStorage.getItem("groq_api_key") || "");
  const [availableModels, setAvailableModels] = useState<AIModelOption[]>(AVAILABLE_MODELS);
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    const saved = localStorage.getItem("frosted_ai_model");
    if (saved && AVAILABLE_MODELS.some((m) => m.id === saved)) {
      return saved;
    }
    return "meta-llama/llama-3.3-70b-instruct:free";
  });

  // Persona management
  const [personas, setPersonas] = useState<AIPersona[]>(() => getAllPersonas());
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>(() => {
    const saved = localStorage.getItem("frosted_selected_persona_id");
    const all = getAllPersonas();
    if (saved && all.some((p: AIPersona) => p.id === saved)) return saved;
    return all[0]?.id || "frosted-assistant";
  });

  const refreshPersonas = useCallback(() => {
    const all = getAllPersonas();
    setPersonas(all);
  }, []);

  const activePersona = useMemo(() => {
    return personas.find((p: AIPersona) => p.id === selectedPersonaId) || personas[0] || DEFAULT_PERSONAS[0];
  }, [personas, selectedPersonaId]);

  const [temperature, setTemperature] = useState<number>(() => activePersona.temperature ?? 0.7);

  useEffect(() => {
    if (activePersona.temperature !== undefined) {
      setTemperature(activePersona.temperature);
    }
  }, [activePersona]);

  // Modals & UI state
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [showModelDropdown, setShowModelDropdown] = useState<boolean>(false);
  const [showPersonaDropdown, setShowPersonaDropdown] = useState<boolean>(false);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [expandedThoughts, setExpandedThoughts] = useState<Record<string, boolean>>({});

  const toggleThought = (msgId: string) => {
    setExpandedThoughts((prev) => ({
      ...prev,
      [msgId]: !(prev[msgId] ?? true),
    }));
  };

  // Sync live available models from server
  useEffect(() => {
    fetch("/api/ai/models")
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.models) && data.models.length > 0) {
          const merged = [
            AVAILABLE_MODELS[0],
            ...data.models.filter((m: any) => m.id !== "gemini-3.8-flash")
          ];
          setAvailableModels(merged);
        }
      })
      .catch(() => {});
  }, []);

  // Threads state
  const [threads, setThreads] = useState<ChatThread[]>(() => {
    try {
      const saved = localStorage.getItem("frosted_ai_threads");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    const defaultThread: ChatThread = {
      id: "thread-" + Date.now(),
      title: "New Conversation",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
      model: "gemini-3.8-flash",
      personaId: selectedPersonaId,
    };
    return [defaultThread];
  });

  const [activeThreadId, setActiveThreadId] = useState<string>(() => {
    try {
      const savedActive = localStorage.getItem("frosted_ai_active_thread_id");
      if (savedActive) return savedActive;
    } catch {}
    return threads[0]?.id || "thread-" + Date.now();
  });

  // Current input and streaming status
  const [inputPrompt, setInputPrompt] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Persist threads & active thread
  useEffect(() => {
    try {
      localStorage.setItem("frosted_ai_threads", JSON.stringify(threads));
    } catch {}
  }, [threads]);

  useEffect(() => {
    try {
      localStorage.setItem("frosted_ai_active_thread_id", activeThreadId);
    } catch {}
  }, [activeThreadId]);

  const activeThread = useMemo(() => {
    return threads.find((t) => t.id === activeThreadId) || threads[0] || {
      id: "thread-" + Date.now(),
      title: "New Conversation",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
      model: "gemini-3.8-flash",
      personaId: selectedPersonaId,
    };
  }, [threads, activeThreadId, selectedPersonaId]);

  useEffect(() => {
    if (activeThread && activeThread.id !== activeThreadId) {
      setActiveThreadId(activeThread.id);
    }
  }, [activeThread, activeThreadId]);

  const currentModelObj = availableModels.find((m) => m.id === selectedModel);
  const currentModelDisplayName = currentModelObj ? currentModelObj.name : selectedModel;

  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
    }
  }, []);

  const handleScroll = () => {
    if (!chatScrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatScrollContainerRef.current;
    const isFarFromBottom = scrollHeight - scrollTop - clientHeight > 160;
    setShowScrollBottom(isFarFromBottom);
  };

  useEffect(() => {
    scrollToBottom(false);
  }, [activeThreadId, scrollToBottom]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSelectPersona = (persona: AIPersona) => {
    setSelectedPersonaId(persona.id);
    localStorage.setItem("frosted_selected_persona_id", persona.id);
    refreshPersonas();
    showToast(`Active persona: ${persona.name}`);
  };

  // Switch or create threads
  const handleCreateNewThread = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    setInputPrompt("");

    if (activeThread && activeThread.messages.length === 0) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
      return;
    }

    const newId = "thread-" + Date.now();
    const newThread: ChatThread = {
      id: newId,
      title: "New Conversation",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
      model: selectedModel,
      personaId: selectedPersonaId,
    };
    setThreads((prev) => [newThread, ...prev]);
    setActiveThreadId(newId);
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
  };

  const handleDeleteThread = (e: React.MouseEvent, threadId: string) => {
    e.stopPropagation();
    setThreads((prev) => {
      const filtered = prev.filter((t) => t.id !== threadId);
      if (filtered.length === 0) {
        const fresh: ChatThread = {
          id: "thread-" + Date.now(),
          title: "New Conversation",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messages: [],
          model: selectedModel,
          personaId: selectedPersonaId,
        };
        setActiveThreadId(fresh.id);
        return [fresh];
      }
      if (activeThreadId === threadId) {
        setActiveThreadId(filtered[0].id);
      }
      return filtered;
    });
  };

  const handleClearCurrentChat = () => {
    if (!activeThread) return;
    setThreads((prev) =>
      prev.map((t) =>
        t.id === activeThread.id
          ? { ...t, messages: [], updatedAt: Date.now() }
          : t
      )
    );
    showToast("Conversation cleared");
  };

  const handleExportChat = () => {
    if (!activeThread || activeThread.messages.length === 0) {
      showToast("No messages in current chat to export.");
      return;
    }

    let markdown = `# ${activeThread.title}\n*Persona: ${activePersona.name} | Model: ${selectedModel} | Exported on ${new Date().toLocaleString()}*\n\n---\n\n`;
    activeThread.messages.forEach((msg) => {
      const sender = msg.role === "user" ? "**You**" : `**${activePersona.name} (${msg.modelUsed || selectedModel})**`;
      markdown += `${sender}:\n${msg.content}\n\n`;
    });

    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeThread.title.replace(/[^a-zA-Z0-9_-]/g, "_")}_Export.md`;
    a.click();
    URL.revokeObjectURL(url);

    showToast("Exported to Markdown file");
  };

  // Send message & stream completion
  const handleSendMessage = async (textToSend?: string) => {
    const rawContent = (textToSend !== undefined ? textToSend : inputPrompt).trim();
    if (!rawContent || isGenerating) return;

    const effectiveKey = apiKey.trim();
    const currentTargetThreadId = activeThread?.id || activeThreadId || ("thread-" + Date.now());
    if (activeThreadId !== currentTargetThreadId) {
      setActiveThreadId(currentTargetThreadId);
    }

    setInputPrompt("");

    const userMessage: AIMessage = {
      id: "msg-" + Date.now(),
      role: "user",
      content: rawContent,
      timestamp: Date.now(),
    };

    const assistantMsgId = "msg-assistant-" + Date.now();
    const initialAssistantMessage: AIMessage = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      timestamp: Date.now(),
      modelUsed: selectedModel,
    };

    const currentThreadMessages = activeThread?.messages || [];
    const shouldUpdateTitle = currentThreadMessages.length === 0;
    const cleanTitle = shouldUpdateTitle
      ? rawContent.slice(0, 36) + (rawContent.length > 36 ? "..." : "")
      : (activeThread.title || "Conversation");

    setThreads((prev) => {
      const exists = prev.some((t) => t.id === currentTargetThreadId);
      if (!exists) {
        const newThread: ChatThread = {
          id: currentTargetThreadId,
          title: cleanTitle,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messages: [userMessage, initialAssistantMessage],
          model: selectedModel,
          personaId: selectedPersonaId,
        };
        return [newThread, ...prev];
      }
      return prev.map((t) => {
        if (t.id === currentTargetThreadId) {
          return {
            ...t,
            title: cleanTitle,
            updatedAt: Date.now(),
            messages: [...t.messages, userMessage, initialAssistantMessage],
          };
        }
        return t;
      });
    });

    setIsGenerating(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Persona Directives
    const personaDirectives = `You are ${activePersona.name}.
${activePersona.systemPrompt}
Tone & Style: ${activePersona.toneStyle || "Helpful, clear, and friendly"}
Formatting: Use clean Markdown formatting when helpful. Provide direct, thoughtful, and natural responses.`;

    const conversationHistory = currentThreadMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const apiMessages = [
      { role: "system", content: personaDirectives },
      ...conversationHistory,
      { role: "user", content: rawContent },
    ];

    try {
      const fetchHeaders: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (effectiveKey) {
        fetchHeaders["Authorization"] = `Bearer ${effectiveKey}`;
      }

      let response: Response | null = await fetch("/api/ai/chat", {
        method: "POST",
        headers: fetchHeaders,
        body: JSON.stringify({
          model: selectedModel,
          messages: apiMessages,
          systemPrompt: personaDirectives,
          temperature: temperature,
          stream: true,
          enableWebSearch: webSearchEnabled,
          customKey: effectiveKey || undefined,
        }),
        signal: controller.signal,
      }).catch(() => null);

      if (!response || !response.ok) {
        response = await fetch("/api/ai/chat", {
          method: "POST",
          headers: fetchHeaders,
          body: JSON.stringify({
            model: selectedModel,
            messages: apiMessages,
            systemPrompt: personaDirectives,
            temperature: temperature,
            stream: false,
            enableWebSearch: webSearchEnabled,
            customKey: effectiveKey || undefined,
          }),
          signal: controller.signal,
        });
      }

      if (!response.ok) {
        throw new Error(`Unable to complete response (${response.status})`);
      }

      let accumulatedContent = "";
      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("application/json") || !response.body) {
        const data = await response.json();
        accumulatedContent =
          data.text ||
          data.choices?.[0]?.message?.content ||
          data.choices?.[0]?.delta?.content ||
          "";

        setThreads((prev) =>
          prev.map((t) => {
            if (t.id === currentTargetThreadId) {
              return {
                ...t,
                messages: t.messages.map((m) =>
                  m.id === assistantMsgId ? { ...m, content: accumulatedContent } : m
                ),
              };
            }
            return t;
          })
        );
      } else {
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(":")) continue;
            if (trimmed === "data: [DONE]") continue;

            if (trimmed.startsWith("data:")) {
              const jsonStr = trimmed.slice(5).trim();
              try {
                const parsed = JSON.parse(jsonStr);
                const delta = parsed.choices?.[0]?.delta?.content || "";
                if (delta) {
                  accumulatedContent += delta;
                  setThreads((prev) =>
                    prev.map((t) => {
                      if (t.id === currentTargetThreadId) {
                        return {
                          ...t,
                          messages: t.messages.map((m) =>
                            m.id === assistantMsgId
                              ? { ...m, content: accumulatedContent }
                              : m
                          ),
                        };
                      }
                      return t;
                    })
                  );
                }
              } catch (err) {}
            }
          }
        }
      }

      if (!accumulatedContent.trim()) {
        const fallbackMsg = "Here is what you need. Let me know what you'd like to explore next!";
        setThreads((prev) =>
          prev.map((t) => {
            if (t.id === currentTargetThreadId) {
              return {
                ...t,
                messages: t.messages.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, content: fallbackMsg }
                    : m
                ),
              };
            }
            return t;
          })
        );
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        const errorMsg = `Unable to generate reply right now. Please try sending again in a moment.`;
        setThreads((prev) =>
          prev.map((t) => {
            if (t.id === currentTargetThreadId) {
              return {
                ...t,
                messages: t.messages.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, content: errorMsg, isError: true }
                    : m
                ),
              };
            }
            return t;
          })
        );
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
      setTimeout(() => {
        scrollToBottom(true);
      }, 50);
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleRegenerate = () => {
    if (isGenerating || activeThread.messages.length === 0) return;
    const lastUserIndex = [...activeThread.messages].reverse().findIndex((m) => m.role === "user");
    if (lastUserIndex === -1) return;
    const realIndex = activeThread.messages.length - 1 - lastUserIndex;
    const lastUserMsg = activeThread.messages[realIndex];

    const trimmed = activeThread.messages.slice(0, realIndex);
    setThreads((prev) =>
      prev.map((t) => (t.id === activeThread.id ? { ...t, messages: trimmed } : t))
    );

    handleSendMessage(lastUserMsg.content);
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCodeId(id);
    setTimeout(() => {
      setCopiedCodeId(null);
    }, 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleApplyQuickAction = (prefix: string) => {
    setInputPrompt((prev) => (prev ? `${prefix}${prev}` : prefix));
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  };

  const isCustomIcon = activePersona.icon?.startsWith("http");

  return (
    <div className="flex-1 w-full h-full flex flex-col md:flex-row overflow-hidden bg-transparent select-text">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 right-6 z-50 px-4 py-2.5 rounded-xl bg-[#121829] border border-cyan-500/40 text-white text-xs font-semibold shadow-2xl animate-in fade-in slide-in-from-top-2 duration-150 flex items-center gap-2">
          <CheckCircle2 size={14} className="text-cyan-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Left Sidebar */}
      <aside
        style={{
          backgroundColor: "var(--theme-darkest)",
          borderColor: "var(--theme-border-subtle)",
        }}
        className={`fixed md:static inset-y-0 left-0 z-40 md:z-10 w-72 flex flex-col border-r transition-all duration-300 ease-in-out backdrop-blur-2xl ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full md:-translate-x-full md:w-0 md:border-none md:p-0"
        } ${!isSidebarOpen ? "overflow-hidden" : ""}`}
      >
        {/* New Chat Button */}
        <div className="p-3.5 border-b border-[var(--theme-border-subtle)] flex items-center justify-between gap-2 shrink-0">
          <button
            onClick={handleCreateNewThread}
            style={{
              backgroundColor: "var(--theme-surface)",
              borderColor: "var(--theme-border)",
            }}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold text-white hover:border-[var(--theme-border-strong)] hover:bg-white/5 transition-all duration-150 shadow-sm cursor-pointer active:scale-95"
          >
            <Plus size={15} className="text-[var(--theme-text-accent)]" />
            <span>New Chat</span>
          </button>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <PanelLeftClose size={18} />
          </button>
        </div>



        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          <div className="px-2 py-1 text-[10px] uppercase font-bold tracking-wider text-[var(--theme-text-muted)]">
            History
          </div>
          {threads.map((thread) => {
            const isActive = thread.id === activeThread.id;
            return (
              <div
                key={thread.id}
                onClick={() => setActiveThreadId(thread.id)}
                style={{
                  backgroundColor: isActive ? "var(--theme-surface)" : "transparent",
                  borderColor: isActive ? "var(--theme-border)" : "transparent",
                }}
                className={`group flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs cursor-pointer border transition-all duration-150 ${
                  isActive
                    ? "text-white font-semibold shadow-sm"
                    : "text-neutral-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <MessageSquare size={13} className={isActive ? "text-[var(--theme-text-accent)] shrink-0" : "shrink-0 opacity-60"} />
                  <span className="truncate">{thread.title || "New Chat"}</span>
                </div>
                <button
                  onClick={(e) => handleDeleteThread(e, thread.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-neutral-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-all cursor-pointer"
                  title="Delete chat"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>


      </aside>

      {/* Main Chat Workspace */}
      <main className="flex-1 flex flex-col min-w-0 h-full relative">
        {/* Header Bar */}
        <header
          style={{
            backgroundColor: "var(--theme-darkest)",
            borderColor: "var(--theme-border-subtle)",
          }}
          className="h-14 px-3 sm:px-6 border-b flex items-center justify-between gap-3 shrink-0 backdrop-blur-2xl z-20"
        >
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                style={{
                  backgroundColor: "var(--theme-surface)",
                  borderColor: "var(--theme-border)",
                }}
                className="p-2 rounded-xl border text-neutral-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer shrink-0"
                title="Open Sidebar"
              >
                <PanelLeftOpen size={16} />
              </button>
            )}

            {/* Model Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowModelDropdown(!showModelDropdown)}
                style={{
                  backgroundColor: "var(--theme-surface)",
                  borderColor: "var(--theme-border)",
                }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold text-white hover:border-[var(--theme-border-strong)] transition-all shadow-sm cursor-pointer"
              >
                <Sparkles size={13} className="text-[var(--theme-text-accent)]" />
                <span className="max-w-[130px] sm:max-w-[180px] truncate">
                  {currentModelDisplayName}
                </span>
                <ChevronDown size={13} className="text-neutral-400" />
              </button>

              {showModelDropdown && (
                <>
                  <div className="fixed inset-0 z-50" onClick={() => setShowModelDropdown(false)} />
                  <div
                    style={{
                      backgroundColor: "var(--theme-darkest)",
                      borderColor: "var(--theme-border)",
                    }}
                    className="absolute top-full left-0 mt-1.5 w-64 sm:w-72 z-50 p-1.5 rounded-2xl border shadow-2xl backdrop-blur-2xl space-y-1 max-h-80 overflow-y-auto custom-scrollbar"
                  >
                    <div className="px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider text-[var(--theme-text-muted)] flex items-center justify-between">
                      <span>Inference Engines</span>
                    </div>
                    {availableModels.map((model) => (
                      <button
                        key={model.id}
                        onClick={() => {
                          setSelectedModel(model.id);
                          localStorage.setItem("frosted_ai_model", model.id);
                          setShowModelDropdown(false);
                        }}
                        className={`w-full flex flex-col text-left px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer ${
                          selectedModel === model.id
                            ? "bg-[var(--theme-accent)] text-white font-bold"
                            : "text-neutral-300 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">{model.name}</span>
                          {model.badge && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/10 text-[var(--theme-text-accent)]">
                              {model.badge}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-neutral-400 font-normal mt-0.5 line-clamp-1">
                          {model.description}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Clean branding title instead of active persona pill */}
            <span className="text-xs font-black text-cyan-400 tracking-wider hidden sm:inline select-none uppercase px-1">
              FROSTED AI
            </span>
          </div>

          {/* Action Tools */}
          <div className="flex items-center gap-1.5">

            <button
              onClick={() => setShowFriendsModal(true)}
              style={{
                backgroundColor: "var(--theme-surface)",
                borderColor: "var(--theme-border)",
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold text-white hover:bg-white/10 transition-all cursor-pointer shadow-sm active:scale-95"
              title="Friends & Messages"
            >
              <Users size={14} className="text-[var(--theme-text-accent)]" />
              <span className="hidden sm:inline">Friends</span>
            </button>

            {activeThread.messages.length > 0 && (
              <>
                <button
                  onClick={handleExportChat}
                  style={{
                    backgroundColor: "var(--theme-surface)",
                    borderColor: "var(--theme-border)",
                  }}
                  className="p-2 rounded-xl border text-neutral-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                  title="Export chat to Markdown"
                >
                  <Download size={14} />
                </button>
                <button
                  onClick={handleClearCurrentChat}
                  className="p-2 rounded-xl text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  title="Clear conversation"
                >
                  <RotateCcw size={14} />
                </button>
              </>
            )}
          </div>
        </header>

        {/* Chat Feed */}
        <div
          ref={chatScrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 sm:px-8 py-5 space-y-5 custom-scrollbar min-h-0"
        >
          {activeThread.messages.length === 0 ? (
            <div className="w-full max-w-4xl mx-auto py-8 sm:py-12 flex flex-col items-center text-center">
              {/* Persona Avatar Display */}
              <div
                className="h-20 w-20 rounded-3xl flex items-center justify-center shadow-2xl mb-4 text-3xl shrink-0 overflow-hidden ring-4 ring-cyan-500/30 transition-transform hover:scale-105"
                style={{
                  backgroundColor: `${activePersona.accentColor || "#38bdf8"}25`,
                  borderColor: activePersona.accentColor || "#38bdf8",
                  boxShadow: `0 0 25px ${activePersona.accentColor || "#38bdf8"}35`,
                }}
              >
                {isCustomIcon ? (
                  <img src={activePersona.icon} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span>{activePersona.icon}</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {activePersona.name}
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-neutral-400 mt-1.5 max-w-md leading-relaxed">
                {activePersona.tagline || activePersona.description}
              </p>

              {/* Starter Prompts */}
              <div className="w-full mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                {PROMPT_SUGGESTIONS.map((starter, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(starter.prompt)}
                    style={{
                      backgroundColor: "var(--theme-surface)",
                      borderColor: "var(--theme-border-subtle)",
                    }}
                    className="p-4 rounded-2xl border text-xs text-neutral-300 hover:text-white hover:border-[var(--theme-border)] hover:bg-white/5 transition-all duration-150 flex flex-col justify-between gap-2 group cursor-pointer shadow-sm"
                  >
                    <div className="flex items-center gap-2 font-bold text-white">
                      <span>{starter.icon}</span>
                      <span className="group-hover:text-[var(--theme-text-accent)] transition-colors text-sm">
                        {starter.title}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed font-normal">
                      {starter.desc}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="w-full max-w-5xl lg:max-w-6xl mx-auto space-y-4">
              {activeThread.messages.map((message, messageIdx) => {
                const isUser = message.role === "user";
                const isMessageGenerating = isGenerating && messageIdx === activeThread.messages.length - 1;
                return (
                  <div
                    key={message.id}
                    className={`flex items-start gap-3.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}
                  >
                    {/* Message Avatar */}
                    <div
                      style={{
                        backgroundColor: isUser
                          ? "var(--theme-accent)"
                          : `${activePersona.accentColor || "#38bdf8"}25`,
                        borderColor: isUser
                          ? "var(--theme-border-strong)"
                          : `${activePersona.accentColor || "#38bdf8"}50`,
                      }}
                      className="h-9 w-9 rounded-2xl border flex items-center justify-center shrink-0 text-white shadow-md text-sm font-bold overflow-hidden"
                    >
                      {isUser ? (
                        <User size={16} />
                      ) : isCustomIcon ? (
                        <img src={activePersona.icon} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span>{activePersona.icon}</span>
                      )}
                    </div>

                    <div className={`flex flex-col max-w-[92%] sm:max-w-[85%] ${isUser ? "items-end" : "items-start"}`}>
                      {/* Name / Role Pill */}
                      <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-neutral-400">
                        <span className="font-bold text-neutral-200">
                          {isUser ? "You" : activePersona.name}
                        </span>
                      </div>

                      <div
                        style={{
                          backgroundColor: isUser ? "var(--theme-accent)" : "#131826",
                          borderColor: isUser ? "var(--theme-border)" : "rgba(255,255,255,0.08)",
                        }}
                        className={`px-4 py-3.5 rounded-2xl border text-xs sm:text-sm text-neutral-100 shadow-lg ${
                          isUser ? "rounded-tr-sm" : "rounded-tl-sm"
                        } ${message.isError ? "border-rose-500/40 bg-rose-500/10 text-rose-200" : ""}`}
                      >
                        {isUser ? (
                          <div className="whitespace-pre-wrap font-medium leading-relaxed">{message.content}</div>
                        ) : (() => {
                          const { thought, answer, isStillThinking } = parseThoughtAndContent(message.content);
                          const isExpanded = expandedThoughts[message.id] ?? true;

                          return (
                            <div className="w-full space-y-3">
                              {/* Thinking Process */}
                              {(thought || isStillThinking) && (
                                <div className="rounded-2xl border border-indigo-500/30 bg-indigo-950/20 backdrop-blur-md overflow-hidden transition-all shadow-sm">
                                  <button
                                    type="button"
                                    onClick={() => toggleThought(message.id)}
                                    className="w-full px-3.5 py-2 flex items-center justify-between gap-2 bg-indigo-900/20 hover:bg-indigo-900/30 transition-colors text-left cursor-pointer border-b border-indigo-500/20"
                                  >
                                    <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
                                      <Brain size={14} className={isStillThinking ? "text-indigo-400 animate-pulse" : "text-indigo-400"} />
                                      <span>
                                        {isStillThinking ? "Thinking through problem..." : "Reasoning Process"}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1 text-indigo-400 text-xs">
                                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    </div>
                                  </button>

                                  {isExpanded && (
                                    <div className="p-3 text-xs text-indigo-200/90 whitespace-pre-wrap leading-relaxed font-mono bg-black/40 max-h-72 overflow-y-auto custom-scrollbar select-text">
                                      {thought || "Analyzing steps..."}
                                      {isStillThinking && (
                                        <span className="inline-block w-1.5 h-3.5 ml-1 bg-indigo-400 animate-pulse align-middle" />
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Answer Markdown */}
                              <div className="prose prose-invert prose-xs sm:prose-sm max-w-none leading-relaxed break-words">
                                {answer ? (
                                  <ReactMarkdown
                                    components={{
                                      code({ className, children, ...props }) {
                                        const match = /language-(\w+)/.exec(className || "");
                                        const codeContent = String(children).replace(/\n$/, "");
                                        const isInline = !match && !String(children).includes("\n");

                                        if (isInline) {
                                          return (
                                            <code
                                              className="px-1.5 py-0.5 rounded bg-black/50 text-cyan-300 font-mono text-[11px]"
                                              {...props}
                                            >
                                              {children}
                                            </code>
                                          );
                                        }

                                        const lang = (match?.[1] || "code").toLowerCase();
                                        return (
                                          <AppSandboxArtifact
                                            code={codeContent}
                                            language={lang}
                                            rawHeader={className}
                                            isStreaming={isMessageGenerating}
                                          />
                                        );
                                      },
                                      p({ children }) {
                                        return <p className="mb-2.5 last:mb-0 leading-relaxed">{children}</p>;
                                      },
                                      ul({ children }) {
                                        return <ul className="list-disc pl-4 mb-2.5 space-y-1">{children}</ul>;
                                      },
                                      ol({ children }) {
                                        return <ol className="list-decimal pl-4 mb-2.5 space-y-1">{children}</ol>;
                                      },
                                      h1({ children }) {
                                        return <h1 className="text-base font-bold text-white mb-2 mt-3">{children}</h1>;
                                      },
                                      h2({ children }) {
                                        return <h2 className="text-sm font-bold text-white mb-1.5 mt-2.5">{children}</h2>;
                                      },
                                      h3({ children }) {
                                        return <h3 className="text-xs font-bold text-white mb-1 mt-2">{children}</h3>;
                                      },
                                      blockquote({ children }) {
                                        return (
                                          <blockquote className="border-l-2 border-cyan-400 pl-3 my-2 text-neutral-300 italic">
                                            {children}
                                          </blockquote>
                                        );
                                      },
                                    }}
                                  >
                                    {answer}
                                  </ReactMarkdown>
                                ) : isStillThinking ? (
                                  <div className="flex items-center gap-1.5 text-indigo-300 py-1 text-xs">
                                    <Loader2 size={13} className="animate-spin text-indigo-400" />
                                    <span>Thinking through steps...</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 text-neutral-400 py-1">
                                    <Loader2 size={13} className="animate-spin text-cyan-400" />
                                    <span className="text-xs">Generating response...</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Message Actions */}
                      {!isUser && message.content && (
                        <div className="flex items-center gap-2 mt-1 px-1 text-[10px] text-neutral-500">
                          <span>{message.modelUsed || selectedModel}</span>
                          <span>&bull;</span>
                          <button
                            onClick={() => {
                              const parsed = parseThoughtAndContent(message.content);
                              const textToCopy = parsed.answer || message.content;
                              handleCopyText(textToCopy, message.id);
                            }}
                            className="hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                            title="Copy reply"
                          >
                            {copiedCodeId === message.id ? (
                              <Check size={11} className="text-emerald-400" />
                            ) : (
                              <Copy size={11} />
                            )}
                            <span>{copiedCodeId === message.id ? "Copied" : "Copy"}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Scroll To Bottom Button */}
        {showScrollBottom && (
          <button
            onClick={() => scrollToBottom(true)}
            style={{
              backgroundColor: "var(--theme-surface)",
              borderColor: "var(--theme-border)",
            }}
            className="absolute bottom-24 right-6 p-2.5 rounded-full border shadow-2xl text-white hover:bg-white/10 transition-all z-20 cursor-pointer animate-bounce"
            title="Scroll to bottom"
          >
            <ArrowDown size={16} />
          </button>
        )}

        {/* Composer */}
        <div
          style={{
            backgroundColor: "var(--theme-darkest)",
            borderColor: "var(--theme-border-subtle)",
          }}
          className="p-3 sm:p-5 border-t backdrop-blur-2xl shrink-0 z-20"
        >
          <div className="w-full max-w-5xl lg:max-w-6xl mx-auto flex flex-col gap-2 px-1 sm:px-4">
            <div
              style={{
                backgroundColor: "var(--theme-surface)",
                borderColor: "var(--theme-border)",
              }}
              className="relative flex items-end gap-2 p-2.5 sm:p-3 rounded-2xl border shadow-inner focus-within:border-cyan-500/50 focus-within:ring-1 focus-within:ring-cyan-500/30 transition-all"
            >
              <textarea
                ref={textareaRef}
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask me anything... (Automatic Web Search, App Builder, and File Creator are active)"
                rows={1}
                className="flex-1 max-h-36 min-h-[40px] bg-transparent resize-none px-2 py-1.5 text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none custom-scrollbar"
                style={{ height: "auto" }}
              />

              {isGenerating ? (
                <button
                  type="button"
                  onClick={handleStopGeneration}
                  className="p-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 transition-all cursor-pointer active:scale-95 shrink-0"
                  title="Stop"
                >
                  <Square size={16} fill="currentColor" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  disabled={!inputPrompt.trim()}
                  style={{
                    backgroundColor: inputPrompt.trim() ? "var(--theme-accent)" : "transparent",
                    borderColor: inputPrompt.trim() ? "var(--theme-border-strong)" : "transparent",
                  }}
                  className={`p-2.5 rounded-xl border transition-all duration-150 shrink-0 cursor-pointer active:scale-95 ${
                    inputPrompt.trim()
                      ? "text-white shadow-md"
                      : "text-neutral-500 cursor-not-allowed opacity-50"
                  }`}
                  title="Send"
                >
                  <Send size={16} />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] text-neutral-400 px-2">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span className="font-semibold text-neutral-200">
                  {activePersona.name} &bull; {currentModelDisplayName}
                </span>
              </div>

              {activeThread.messages.length > 0 && !isGenerating && (
                <button
                  onClick={handleRegenerate}
                  className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer text-[11px]"
                >
                  <RotateCcw size={11} />
                  <span>Regenerate response</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Friends Modal */}
      {showFriendsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-2xl h-[85vh] rounded-3xl border border-[var(--theme-border)] bg-[var(--theme-darkest)] shadow-2xl overflow-hidden flex flex-col relative">
            <button
              onClick={() => setShowFriendsModal(false)}
              className="absolute top-3 right-3 z-20 p-2 rounded-xl bg-black/40 text-neutral-400 hover:text-white hover:bg-black/60 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
            <FriendsPanel profile={chatProfile} />
          </div>
        </div>
      )}

      {/* Choose Persona Modal */}
      <PersonaModal
        isOpen={showPersonaModal}
        onClose={() => {
          setShowPersonaModal(false);
          refreshPersonas();
        }}
        selectedPersonaId={selectedPersonaId}
        onSelectPersona={(persona: AIPersona) => {
          handleSelectPersona(persona);
          setShowPersonaModal(false);
        }}
      />
    </div>
  );
}
