import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Sparkles,
  Bot,
  Send,
  Plus,
  Trash2,
  Edit3,
  Copy,
  Check,
  RotateCcw,
  Square,
  Paperclip,
  X,
  PanelLeftClose,
  PanelLeft,
  Search,
  Brain,
  Code2,
  Zap,
  BookOpen,
  MessageSquare,
  ChevronDown,
  Cpu,
  User,
  Wand2,
  CheckCircle2,
  FileText,
  AlertCircle
} from "lucide-react";
import Markdown from "react-markdown";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  model?: string;
  provider?: string;
  attachments?: { name: string; type: string; url?: string; data?: string }[];
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  model: string;
  persona: string;
  messages: ChatMessage[];
}

export interface ModelOption {
  id: string;
  name: string;
  provider: string;
  badge: string;
  badgeColor: string;
  description: string;
  icon: typeof Sparkles;
}

const MODEL_OPTIONS: ModelOption[] = [
  {
    id: "gemini-3.1-flash-lite",
    name: "Gemini 3.1 Flash-Lite",
    provider: "Google AI",
    badge: "Unlimited & Keyless",
    badgeColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    description: "Google's ultra-fast Flash-Lite model running directly on the backend. No keys, no quotas, and infinite capacity via automatic offline fallback.",
    icon: Sparkles,
  },
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    provider: "Google AI",
    badge: "Keyless API",
    badgeColor: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    description: "Advanced Google Gemini model optimized for complex coding, math and science problems.",
    icon: Brain,
  }
];

export interface PersonaOption {
  id: string;
  name: string;
  systemPrompt: string;
  icon: typeof Wand2;
}

const PERSONA_OPTIONS: PersonaOption[] = [
  {
    id: "general",
    name: "General Assistant",
    systemPrompt:
      "You are a helpful, articulate, and friendly AI assistant. Give comprehensive, well-structured answers formatted in clean Markdown. Use headings, bullet points, and code blocks with language tags when appropriate.",
    icon: Bot,
  },
  {
    id: "coder",
    name: "Code Mentor",
    systemPrompt:
      "You are an expert Principal Software Engineer and Computer Science Tutor. Provide clean, production-ready, type-safe code with brief explanations of key design decisions. Always format code blocks with language identifiers (e.g. ```typescript, ```python, ```sql).",
    icon: Code2,
  },
  {
    id: "tutor",
    name: "Math & Science Tutor",
    systemPrompt:
      "You are a patient, encouraging STEM Academic Tutor. Break down math, physics, and science problems step-by-step. Show clearly defined steps, formulas, and verified checks.",
    icon: BookOpen,
  },
  {
    id: "writer",
    name: "Creative Writer",
    systemPrompt:
      "You are a master creative writer and editor. Craft engaging stories, polished essays, or compelling prose with rich vocabulary and clear flow.",
    icon: Wand2,
  },
  {
    id: "concise",
    name: "Concise Summarizer",
    systemPrompt:
      "You are a high-efficiency executive assistant. Provide direct, bulleted, zero-fluff answers and key takeaways. Keep explanations tight and actionable.",
    icon: Zap,
  },
];

const SUGGESTED_PROMPTS = [
  {
    title: "Explain Quantum Computing",
    subtitle: "In simple, everyday analogies",
    prompt: "Explain the fundamentals of quantum computing using simple everyday analogies that anyone can understand.",
    icon: Sparkles,
    color: "from-blue-600/20 to-cyan-600/20 text-cyan-400 border-cyan-500/30",
  },
  {
    title: "Debug React Hook Issues",
    subtitle: "Identify race conditions & leaks",
    prompt: "How do I prevent memory leaks and infinite re-render loops in React useEffect hooks? Show code examples with best practices.",
    icon: Code2,
    color: "from-amber-600/20 to-yellow-600/20 text-amber-400 border-amber-500/30",
  },
  {
    title: "Plan 7-Day Study Schedule",
    subtitle: "For final exams & revision",
    prompt: "Create an effective 7-day study plan for college exams balancing revision, active recall, and rest breaks.",
    icon: BookOpen,
    color: "from-emerald-600/20 to-teal-600/20 text-emerald-400 border-emerald-500/30",
  },
  {
    title: "DeepSeek Reasoning Test",
    subtitle: "Solve logic & math puzzles",
    prompt: "A bat and a ball cost $1.10 in total. The bat costs $1.00 more than the ball. How much does the ball cost? Show step-by-step math reasoning.",
    icon: Brain,
    color: "from-purple-600/20 to-indigo-600/20 text-purple-400 border-purple-500/30",
  },
];

export default function AiAssistant() {
  // Saved state initialization
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    try {
      const saved = localStorage.getItem("frosted_ai_conversations");
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });

  const [activeConvId, setActiveConvId] = useState<string | null>(() => {
    try {
      return localStorage.getItem("frosted_ai_active_id") || null;
    } catch (e) {
      return null;
    }
  });

  const [selectedModel, setSelectedModel] = useState<string>(() => {
    try {
      return localStorage.getItem("frosted_ai_model") || "gemini-3.1-flash-lite";
    } catch (e) {
      return "gemini-3.1-flash-lite";
    }
  });

  const [selectedPersona, setSelectedPersona] = useState<string>("general");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchHistory, setSearchHistory] = useState("");
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [attachments, setAttachments] = useState<{ name: string; type: string; data: string }[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Sync to local storage
  useEffect(() => {
    try {
      localStorage.setItem("frosted_ai_conversations", JSON.stringify(conversations));
    } catch (e) {}
  }, [conversations]);

  useEffect(() => {
    try {
      if (activeConvId) localStorage.setItem("frosted_ai_active_id", activeConvId);
      else localStorage.removeItem("frosted_ai_active_id");
    } catch (e) {}
  }, [activeConvId]);

  useEffect(() => {
    try {
      localStorage.setItem("frosted_ai_model", selectedModel);
    } catch (e) {}
  }, [selectedModel]);

  // Auto scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const currentConv = conversations.find((c) => c.id === activeConvId);

  useEffect(() => {
    scrollToBottom();
  }, [currentConv?.messages, isLoading, scrollToBottom]);

  // Auto-resize input textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [inputMessage]);

  // Start new conversation
  const handleNewChat = useCallback(() => {
    setActiveConvId(null);
    setInputMessage("");
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, []);

  // Handle sending a message
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if ((!text && attachments.length === 0) || isLoading) return;

    let convId = activeConvId;
    let convList = [...conversations];

    const newUserMsg: ChatMessage = {
      id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      role: "user",
      content: text,
      timestamp: Date.now(),
      attachments: attachments.length > 0 ? [...attachments] : undefined,
    };

    if (!convId || !convList.some((c) => c.id === convId)) {
      // Create new conversation
      const newTitle = text.slice(0, 36) || "New Conversation";
      const newConv: Conversation = {
        id: `conv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        title: newTitle,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        model: selectedModel,
        persona: selectedPersona,
        messages: [newUserMsg],
      };
      convList = [newConv, ...convList];
      convId = newConv.id;
      setConversations(convList);
      setActiveConvId(convId);
    } else {
      // Append to existing conversation
      convList = convList.map((c) => {
        if (c.id === convId) {
          return {
            ...c,
            updatedAt: Date.now(),
            messages: [...c.messages, newUserMsg],
          };
        }
        return c;
      });
      setConversations(convList);
    }

    setInputMessage("");
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setIsLoading(true);

    const activePersonaObj = PERSONA_OPTIONS.find((p) => p.id === selectedPersona);
    const systemPrompt = activePersonaObj?.systemPrompt || PERSONA_OPTIONS[0].systemPrompt;

    const currentMessages = convList.find((c) => c.id === convId)?.messages || [newUserMsg];

    try {
      abortControllerRef.current = new AbortController();

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          messages: currentMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          model: selectedModel,
          systemPrompt,
          temperature: 0.7,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();

      const assistantMsg: ChatMessage = {
        id: `ast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        role: "assistant",
        content: data.text || "I was unable to generate a response. Please try again.",
        timestamp: Date.now(),
        model: data.model || selectedModel,
        provider: data.provider || "ai-studio",
      };

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === convId) {
            return {
              ...c,
              updatedAt: Date.now(),
              messages: [...c.messages, assistantMsg],
            };
          }
          return c;
        })
      );
    } catch (err: any) {
      if (err.name !== "AbortError") {
        const errorMsg: ChatMessage = {
          id: `err_${Date.now()}`,
          role: "assistant",
          content: "⚠️ An error occurred while generating a response. Please check your network connection and try again.",
          timestamp: Date.now(),
          model: selectedModel,
        };
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? { ...c, messages: [...c.messages, errorMsg] } : c))
        );
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  };

  const handleDeleteConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeConvId === id) {
      setActiveConvId(null);
    }
  };

  const handleStartRename = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingConvId(conv.id);
    setEditingTitle(conv.title);
  };

  const handleSaveRename = (id: string, e: React.FormEvent | React.FocusEvent) => {
    e.preventDefault();
    if (editingTitle.trim()) {
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: editingTitle.trim() } : c))
      );
    }
    setEditingConvId(null);
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(id);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setAttachments((prev) => [
          ...prev,
          {
            name: file.name,
            type: file.type || "file",
            data: result,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const filteredConvs = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchHistory.toLowerCase())
  );

  const activeModelObj = MODEL_OPTIONS.find((m) => m.id === selectedModel) || MODEL_OPTIONS[0];
  const activePersonaObj = PERSONA_OPTIONS.find((p) => p.id === selectedPersona) || PERSONA_OPTIONS[0];

  return (
    <div className="flex flex-1 w-full h-[calc(100vh-57px)] bg-[var(--theme-darkest)] text-neutral-100 overflow-hidden relative">
      {/* ── Left Navigation Sidebar (ChatGPT / Claude Style) ── */}
      <aside
        className={`flex flex-col bg-[var(--theme-surface)]/90 border-r border-[var(--theme-border-subtle)] backdrop-blur-xl transition-all duration-300 z-20 shrink-0 ${
          isSidebarOpen ? "w-64 sm:w-72" : "w-0 overflow-hidden border-none"
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-3 border-b border-[var(--theme-border-subtle)] flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleNewChat}
            className="flex-1 flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-[var(--theme-accent-hover)] to-[var(--theme-accent)] hover:from-[var(--theme-accent)] hover:to-[var(--theme-accent-hover)] border border-[var(--theme-border-subtle)] text-white font-semibold text-xs tracking-wide shadow-lg shadow-[var(--theme-darkest)]/40 transition-all duration-150 active:scale-95 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Plus size={16} />
              <span>New Chat</span>
            </div>
            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono">⌘K</span>
          </button>

          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="p-2 rounded-xl hover:bg-[var(--theme-hover)] text-neutral-400 hover:text-white transition-colors cursor-pointer"
            title="Collapse Sidebar"
          >
            <PanelLeftClose size={18} />
          </button>
        </div>

        {/* History Search Bar */}
        <div className="px-3 pt-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 size-3.5" />
            <input
              type="text"
              value={searchHistory}
              onChange={(e) => setSearchHistory(e.target.value)}
              placeholder="Search conversations..."
              className="w-full bg-[var(--theme-darkest)]/80 border border-[var(--theme-border-subtle)] rounded-xl pl-8 pr-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-[var(--theme-border)]/50"
            />
            {searchHistory && (
              <button
                type="button"
                onClick={() => setSearchHistory("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Conversation History List */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1 custom-scrollbar">
          {filteredConvs.length === 0 ? (
            <div className="p-6 text-center text-neutral-500 text-xs">
              <MessageSquare size={24} className="mx-auto mb-2 opacity-40" />
              <p>No chat history yet</p>
              <p className="text-[10px] mt-1 text-neutral-600">Start a new chat to begin!</p>
            </div>
          ) : (
            filteredConvs.map((conv) => {
              const isActive = conv.id === activeConvId;
              const isEditing = conv.id === editingConvId;

              return (
                <div
                  key={conv.id}
                  onClick={() => setActiveConvId(conv.id)}
                  className={`group relative flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all duration-150 cursor-pointer ${
                    isActive
                      ? "bg-[var(--theme-accent)]/30 text-[var(--theme-text-accent)] border border-[var(--theme-border-subtle)] font-medium"
                      : "text-neutral-400 hover:text-neutral-200 hover:bg-[var(--theme-hover)]/60"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                    <MessageSquare size={14} className={isActive ? "text-[var(--theme-text-accent)] shrink-0" : "text-neutral-500 shrink-0"} />

                    {isEditing ? (
                      <form onSubmit={(e) => handleSaveRename(conv.id, e)} className="flex-1">
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onBlur={(e) => handleSaveRename(conv.id, e)}
                          autoFocus
                          className="w-full bg-[var(--theme-darkest)] border border-[var(--theme-border)] rounded px-1.5 py-0.5 text-xs text-white focus:outline-none"
                        />
                      </form>
                    ) : (
                      <span className="truncate">{conv.title}</span>
                    )}
                  </div>

                  {!isEditing && (
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity shrink-0">
                      <button
                        type="button"
                        onClick={(e) => handleStartRename(conv, e)}
                        className="p-1 hover:text-white text-neutral-500 transition-colors"
                        title="Rename"
                      >
                        <Edit3 size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteConversation(conv.id, e)}
                        className="p-1 hover:text-red-400 text-neutral-500 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-[var(--theme-border-subtle)] bg-[var(--theme-darkest)]/40 flex items-center justify-between text-[11px] text-neutral-500">
          <div className="flex items-center gap-2">
            <Bot size={14} className="text-[var(--theme-text-accent)]" />
            <span className="font-medium text-neutral-400">Frosted AI</span>
          </div>
          {conversations.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (confirm("Are you sure you want to clear all chat history?")) {
                  setConversations([]);
                  setActiveConvId(null);
                }
              }}
              className="hover:text-red-400 transition-colors"
              title="Clear all conversations"
            >
              Clear All
            </button>
          )}
        </div>
      </aside>

      {/* ── Main Chat Stage ── */}
      <main className="flex-1 flex flex-col min-w-0 bg-[var(--theme-darkest)] relative">
        {/* Top Control Bar (Model & Persona Dropdowns + Sidebar Toggle) */}
        <header className="h-14 border-b border-[var(--theme-border-subtle)] px-4 flex items-center justify-between gap-3 bg-[var(--theme-surface)]/40 backdrop-blur-md z-10">
          <div className="flex items-center gap-2">
            {!isSidebarOpen && (
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 rounded-xl bg-[var(--theme-surface)] border border-[var(--theme-border-subtle)] hover:bg-[var(--theme-hover)] text-neutral-300 hover:text-white transition-colors cursor-pointer mr-1"
                title="Open Sidebar"
              >
                <PanelLeft size={18} />
              </button>
            )}

            {/* Automatic Gemini AI Badge (No Selector) */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--theme-surface)] border border-[var(--theme-border-subtle)]">
              <Sparkles size={14} className="text-blue-400" />
              <span className="text-xs font-bold text-white tracking-wide">Gemini 3.1 Flash-Lite</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded border bg-emerald-500/20 text-emerald-400 border-emerald-500/30 font-semibold uppercase">
                Unlimited Keyless
              </span>
            </div>

            {/* Persona Selector Dropdown */}
            <div className="relative group hidden sm:block">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--theme-surface)] border border-[var(--theme-border-subtle)] hover:border-[var(--theme-border)] transition-colors cursor-pointer text-xs font-semibold text-neutral-300">
                <activePersonaObj.icon size={14} className="text-purple-400" />
                <span>{activePersonaObj.name}</span>
                <ChevronDown size={13} className="text-neutral-500" />
              </div>

              <div className="absolute top-full left-0 mt-1.5 w-60 bg-[var(--theme-surface)] border border-[var(--theme-border-subtle)] rounded-2xl shadow-2xl p-1.5 hidden group-hover:block z-30 space-y-1">
                <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-neutral-500 font-bold">
                  Assistant Persona Mode
                </div>
                {PERSONA_OPTIONS.map((persona) => {
                  const Icon = persona.icon;
                  const isSelected = persona.id === selectedPersona;
                  return (
                    <button
                      key={persona.id}
                      type="button"
                      onClick={() => setSelectedPersona(persona.id)}
                      className={`w-full text-left p-2 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer ${
                        isSelected ? "bg-[var(--theme-accent)]/30 border border-[var(--theme-border)] text-[var(--theme-text-accent)] font-medium" : "text-neutral-300 hover:bg-[var(--theme-hover)]/70"
                      }`}
                    >
                      <Icon size={15} className={isSelected ? "text-purple-400" : "text-neutral-400"} />
                      <span className="text-xs">{persona.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Online</span>
            </span>
          </div>
        </header>

        {/* Conversation Body / Welcome Empty View */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar">
          {!currentConv || currentConv.messages.length === 0 ? (
            /* ── Welcome Screen (ChatGPT / Grok Style) ── */
            <div className="max-w-2xl mx-auto h-full flex flex-col items-center justify-center text-center py-12 px-4 select-none">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-[var(--theme-accent-hover)] via-[var(--theme-accent)] to-[var(--theme-text-muted)] p-0.5 shadow-2xl shadow-[var(--theme-accent)]/20 mb-6 animate-bounce">
                <div className="w-full h-full bg-[var(--theme-darkest)] rounded-[22px] flex items-center justify-center">
                  <Sparkles size={32} className="text-[var(--theme-text-accent)]" />
                </div>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
                What can I help with today?
              </h1>
              <p className="text-xs sm:text-sm text-neutral-400 max-w-md mb-8">
                Powered by <span className="text-[var(--theme-text-accent)] font-semibold">{activeModelObj.name}</span>. Ask code questions, break down complex concepts, or draft study guides.
              </p>

              {/* Prompt Suggestions Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl">
                {SUGGESTED_PROMPTS.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendMessage(item.prompt)}
                      className="p-3.5 rounded-2xl bg-[var(--theme-surface)]/80 border border-[var(--theme-border-subtle)] hover:border-[var(--theme-border)] hover:bg-[var(--theme-hover)]/90 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl group cursor-pointer flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-xs font-bold text-neutral-200 group-hover:text-[var(--theme-text-accent)] transition-colors">
                          {item.title}
                        </span>
                        <div className={`p-1.5 rounded-xl bg-gradient-to-br ${item.color} border`}>
                          <Icon size={14} />
                        </div>
                      </div>
                      <p className="text-[11px] text-neutral-400 line-clamp-1">{item.subtitle}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ── Active Messages Thread ── */
            <div className="max-w-3xl mx-auto space-y-6">
              {currentConv.messages.map((msg) => {
                const isUser = msg.role === "user";
                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3 sm:gap-4 ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    {!isUser && (
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[var(--theme-accent-hover)] to-[var(--theme-accent)] flex items-center justify-center shrink-0 text-white shadow-md shadow-[var(--theme-darkest)]/50 mt-1">
                        <Bot size={18} />
                      </div>
                    )}

                    <div className={`max-w-[85%] sm:max-w-[80%] flex flex-col ${isUser ? "items-end" : "items-start"}`}>
                      {/* Message Bubble */}
                      <div
                        className={`rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                          isUser
                            ? "bg-[var(--theme-accent)] text-white rounded-tr-none border border-[var(--theme-border)] shadow-lg shadow-[var(--theme-darkest)]/30"
                            : "bg-[var(--theme-surface)]/80 border border-[var(--theme-border-subtle)] text-neutral-200 rounded-tl-none shadow-md"
                        }`}
                      >
                        {/* Attachments if any */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-3">
                            {msg.attachments.map((att, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/30 border border-white/10 text-[11px]"
                              >
                                <FileText size={12} className="text-[var(--theme-text-accent)]" />
                                <span className="truncate max-w-[120px]">{att.name}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Text Content */}
                        {isUser ? (
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        ) : (
                          <div className="markdown-body space-y-2">
                            <Markdown
                              components={{
                                code({ node, inline, className, children, ...props }: any) {
                                  const match = /language-(\w+)/.exec(className || "");
                                  const codeText = String(children).replace(/\n$/, "");
                                  if (!inline) {
                                    return (
                                      <div className="relative group/code my-3 rounded-xl overflow-hidden border border-[var(--theme-border-subtle)] bg-[var(--theme-darkest)]">
                                        <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--theme-surface)] border-b border-[var(--theme-border-subtle)] text-[10px] text-neutral-400 font-mono">
                                          <span>{match ? match[1] : "code"}</span>
                                          <button
                                            type="button"
                                            onClick={() => handleCopyText(codeText, `${msg.id}_code`)}
                                            className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
                                          >
                                            {copiedMsgId === `${msg.id}_code` ? (
                                              <>
                                                <Check size={12} className="text-emerald-400" />
                                                <span className="text-emerald-400">Copied</span>
                                              </>
                                            ) : (
                                              <>
                                                <Copy size={12} />
                                                <span>Copy</span>
                                              </>
                                            )}
                                          </button>
                                        </div>
                                        <pre className="p-3 text-xs font-mono text-neutral-200 overflow-x-auto">
                                          <code>{children}</code>
                                        </pre>
                                      </div>
                                    );
                                  }
                                  return (
                                    <code
                                      className="bg-[var(--theme-hover)]/80 text-[var(--theme-text-accent)] px-1.5 py-0.5 rounded text-[11px] font-mono"
                                      {...props}
                                    >
                                      {children}
                                    </code>
                                  );
                                },
                              }}
                            >
                              {msg.content}
                            </Markdown>
                          </div>
                        )}
                      </div>

                      {/* Message Footer Actions */}
                      <div className="flex items-center gap-2 mt-1 px-1 text-[10px] text-neutral-500">
                        <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        {!isUser && (
                          <>
                            <span>•</span>
                            <button
                              type="button"
                              onClick={() => handleCopyText(msg.content, msg.id)}
                              className="hover:text-neutral-300 transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              {copiedMsgId === msg.id ? (
                                <Check size={11} className="text-emerald-400" />
                              ) : (
                                <Copy size={11} />
                              )}
                              <span>{copiedMsgId === msg.id ? "Copied" : "Copy"}</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {isUser && (
                      <div className="w-8 h-8 rounded-xl bg-[var(--theme-surface)] border border-[var(--theme-border-subtle)] flex items-center justify-center shrink-0 text-neutral-300 mt-1">
                        <User size={16} />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Loading Typing Indicator */}
              {isLoading && (
                <div className="flex gap-3 items-center text-neutral-400 text-xs py-2">
                  <div className="w-8 h-8 rounded-xl bg-[var(--theme-accent)]/30 border border-[var(--theme-border-subtle)] flex items-center justify-center text-[var(--theme-text-accent)] animate-pulse">
                    <Bot size={18} />
                  </div>
                  <div className="flex items-center gap-1.5 bg-[var(--theme-surface)] border border-[var(--theme-border-subtle)] px-3 py-2 rounded-2xl">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--theme-text-accent)] animate-ping" />
                    <span className="text-neutral-400 text-xs">Generating response...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* ── Input Controls Bar (Bottom) ── */}
        <div className="p-3 sm:p-4 border-t border-[var(--theme-border-subtle)] bg-[var(--theme-surface)]/60 backdrop-blur-xl">
          <div className="max-w-3xl mx-auto space-y-2">
            {/* Attachments Preview Bar */}
            {attachments.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {attachments.map((att, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-[var(--theme-darkest)] border border-[var(--theme-border-subtle)] text-xs text-neutral-200 shrink-0"
                  >
                    <FileText size={13} className="text-[var(--theme-text-accent)]" />
                    <span className="truncate max-w-[120px] text-[11px]">{att.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(index)}
                      className="text-neutral-400 hover:text-white"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Main Text Input Box */}
            <div className="relative flex items-end gap-2 bg-[var(--theme-darkest)] border border-[var(--theme-border-subtle)] focus-within:border-[var(--theme-border)]/80 rounded-2xl p-2.5 shadow-2xl transition-all">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-[var(--theme-hover)] transition-colors cursor-pointer shrink-0"
                title="Attach file or code snippet"
              >
                <Paperclip size={18} />
              </button>

              <textarea
                ref={textareaRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={`Ask ${activeModelObj.name} anything... (Shift+Enter for new line)`}
                rows={1}
                className="flex-1 bg-transparent text-xs sm:text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none resize-none max-h-44 py-1.5"
              />

              {isLoading ? (
                <button
                  type="button"
                  onClick={handleStopGeneration}
                  className="p-2.5 rounded-xl bg-red-600/80 hover:bg-red-600 text-white transition-all cursor-pointer shrink-0"
                  title="Stop generating"
                >
                  <Square size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  disabled={!inputMessage.trim() && attachments.length === 0}
                  className={`p-2.5 rounded-xl transition-all cursor-pointer shrink-0 ${
                    inputMessage.trim() || attachments.length > 0
                      ? "bg-[var(--theme-accent)] hover:bg-[var(--theme-accent-hover)] text-white border border-[var(--theme-border-subtle)] shadow-lg shadow-[var(--theme-darkest)]/50"
                      : "bg-[var(--theme-hover)] text-neutral-500 cursor-not-allowed"
                  }`}
                  title="Send Message"
                >
                  <Send size={16} />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between text-[10px] text-neutral-500 px-1">
              <span>AI can make mistakes. Verify important facts.</span>
              <span className="hidden sm:inline">Model: {activeModelObj.name}</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
