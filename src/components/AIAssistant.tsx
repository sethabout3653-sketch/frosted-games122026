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
  Cpu,
  HelpCircle,
  GraduationCap,
  Code,
  FileText,
  Calculator,
  Compass,
  Download,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  ArrowDown,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

export function parseThoughtAndContent(raw: string): {
  thought: string;
  answer: string;
  isStillThinking: boolean;
} {
  if (!raw) return { thought: "", answer: "", isStillThinking: false };

  // 1. Check for <think> tags (closed or currently open/streaming)
  const openTag = raw.indexOf("<think>");
  const closeTag = raw.indexOf("</think>");

  if (openTag !== -1) {
    if (closeTag !== -1) {
      const thought = raw.slice(openTag + 7, closeTag).trim();
      const answer = (raw.slice(0, openTag) + raw.slice(closeTag + 8)).trim();
      return { thought, answer, isStillThinking: false };
    } else {
      // Open unclosed tag -> currently streaming thinking
      const thought = raw.slice(openTag + 7).trim();
      const beforeThink = raw.slice(0, openTag).trim();
      return { thought, answer: beforeThink, isStillThinking: true };
    }
  }

  // 2. Check for alternative tags like ```thought ... ```
  const altMatch = raw.match(/```(?:thought|thinking)\s*([\s\S]*?)```/i);
  if (altMatch) {
    const thought = altMatch[1].trim();
    const answer = raw.replace(altMatch[0], "").trim();
    return { thought, answer, isStillThinking: false };
  }

  return { thought: "", answer: raw, isStillThinking: false };
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

export interface AIPersona {
  id: string;
  name: string;
  icon: string;
  description: string;
  systemPrompt: string;
}

const PERSONAS: AIPersona[] = [
  {
    id: "general",
    name: "Helpful Friend",
    icon: "Compass",
    description: "Friendly, natural companion for answering questions, brainstorms, and conversation.",
    systemPrompt: "You are a friendly, knowledgeable, and natural AI companion inside Frosted Studying. Keep responses clear, helpful, engaging, and warm without being robotic or stiff.",
  },
  {
    id: "study_tutor",
    name: "Study Tutor",
    icon: "GraduationCap",
    description: "Breaks down difficult concepts, explains step-by-step, and creates practice quizzes.",
    systemPrompt: "You are an encouraging and patient study tutor. Help the user master topics with clear step-by-step explanations, helpful analogies, practice questions, and memory tricks. Avoid overly robotic textbook jargon unless requested.",
  },
  {
    id: "coding_mentor",
    name: "Coding & Tech",
    icon: "Code",
    description: "Debugs code, explains logic, and writes clean modern programs in any language.",
    systemPrompt: "You are an expert software engineer and programming mentor. Write clean, production-ready, readable code. Include brief explanations of why code works and how to fix bugs.",
  },
  {
    id: "writing_coach",
    name: "Essay & Writing",
    icon: "FileText",
    description: "Refines essays, checks grammar, improves flow, and polishes vocabulary.",
    systemPrompt: "You are a skilled writing coach and editor. Help improve essay structure, grammar, clarity, and persuasive tone while keeping the user's authentic voice.",
  },
  {
    id: "math_solver",
    name: "Math & Science",
    icon: "Calculator",
    description: "Solves equations, physics, and chemistry problems with complete worked solutions.",
    systemPrompt: "You are an expert mathematics and science tutor. Show all intermediate calculation steps, explain the underlying formulas, and verify answers for accuracy.",
  },
];

export interface AIModelOption {
  id: string;
  name: string;
  provider: string;
  description: string;
  badge?: string;
}

const GITHUB_MODELS: AIModelOption[] = [
  {
    id: "gemini-3.5-flash",
    name: "Gemini 3.5 Flash",
    provider: "Google DeepMind",
    description: "Ultra-fast multimodal flash model with lightning responses.",
    badge: "Free Forever • Ultra Fast",
  },
  {
    id: "gemini-3.6-flash",
    name: "Gemini 3.6 Flash",
    provider: "Google DeepMind",
    description: "Optimized reasoning and coding intelligence flash tier.",
    badge: "Free Forever • Balanced",
  },
  {
    id: "gemini-3.7-flash",
    name: "Gemini 3.7 Flash",
    provider: "Google DeepMind",
    description: "State-of-the-art hybrid thinking and complex problem solving.",
    badge: "Free Forever • Smartest",
  },
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    provider: "Google DeepMind",
    description: "Next-gen experimental Flash architecture for extreme depth.",
    badge: "Free Forever • Experimental",
  },
];

const QUICK_STARTERS = [
  {
    title: "Explain a Complex Concept",
    prompt: "Can you explain how neural networks work using a simple everyday analogy?",
    icon: "💡",
  },
  {
    title: "Study Quiz Generator",
    prompt: "Create a 5-question multiple choice practice quiz on Photosynthesis with an answer key and explanations.",
    icon: "📝",
  },
  {
    title: "Code Debugger & Refactor",
    prompt: "Here is a piece of code I'm trying to improve. Can you review it for bugs and suggest a cleaner version?",
    icon: "⚡",
  },
  {
    title: "Essay Outline & Hook",
    prompt: "I need to write an argumentative essay about the impact of social media on attention spans. Can you help me brainstorm an engaging hook and a 3-part outline?",
    icon: "✍️",
  },
];

const DEFAULT_ENDPOINT = "https://models.github.ai/inference";
export const DEFAULT_GITHUB_PAT = "";

export default function AIAssistant() {
  // Config state - pre-configured with default key
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem("github_models_pat") || "");
  const [endpoint, setEndpoint] = useState<string>(() => localStorage.getItem("github_models_endpoint") || DEFAULT_ENDPOINT);
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    const saved = localStorage.getItem("github_models_selected");
    if (saved && (saved.includes("gemini-3.5") || saved.includes("gemini-3.6") || saved.includes("gemini-3.7") || saved.includes("gemini-3.8"))) {
      return saved;
    }
    return "gemini-3.7-flash";
  });
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>("general");
  const [temperature, setTemperature] = useState<number>(0.7);

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
      model: "gemini-3.7-flash",
      personaId: "general",
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
  const [inputPrompt, setInputPrompt] = useState<string>("" );
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState<boolean>(false);

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
    return threads.find((t) => t.id === activeThreadId) || threads[0];
  }, [threads, activeThreadId]);

  const activePersona = useMemo(() => {
    return PERSONAS.find((p) => p.id === selectedPersonaId) || PERSONAS[0];
  }, [selectedPersonaId]);

  // Auto-scroll logic
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

  // Switch or create threads
  const handleCreateNewThread = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    setInputPrompt("");

    // If current thread is already empty, just stay on it
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
  };

  const handleExportChat = () => {
    if (!activeThread || activeThread.messages.length === 0) return;
    let markdown = `# ${activeThread.title}\n*Model: ${selectedModel} | Exported on ${new Date().toLocaleString()}*\n\n---\n\n`;
    activeThread.messages.forEach((msg) => {
      const sender = msg.role === "user" ? "**You**" : `**Frosted AI (${msg.modelUsed || selectedModel})**`;
      markdown += `${sender}:\n${msg.content}\n\n`;
    });

    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeThread.title.replace(/[^a-zA-Z0-9_-]/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Send message & stream completion
  const handleSendMessage = async (textToSend?: string) => {
    const rawContent = (textToSend !== undefined ? textToSend : inputPrompt).trim();
    if (!rawContent || isGenerating) return;

    const effectiveKey = apiKey.trim() || DEFAULT_GITHUB_PAT;
    const currentTargetThreadId = activeThreadId;

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

    // Update title if first message
    const currentThreadMessages = activeThread.id === currentTargetThreadId ? activeThread.messages : [];
    const shouldUpdateTitle = currentThreadMessages.length === 0;
    const cleanTitle = shouldUpdateTitle
      ? rawContent.slice(0, 36) + (rawContent.length > 36 ? "..." : "")
      : (activeThread.title || "Conversation");

    setThreads((prev) =>
      prev.map((t) => {
        if (t.id === currentTargetThreadId) {
          return {
            ...t,
            title: cleanTitle,
            updatedAt: Date.now(),
            messages: [...t.messages, userMessage, initialAssistantMessage],
          };
        }
        return t;
      })
    );

    setIsGenerating(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Prepare message payload
    const systemInstruction = activePersona.systemPrompt;
    const conversationHistory = currentThreadMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const apiMessages = [
      { role: "system", content: systemInstruction },
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

      // Primary proxy call (handles streaming from GitHub Models or ultra-fast Gemini fallback)
      let response: Response | null = await fetch("/api/ai/chat", {
        method: "POST",
        headers: fetchHeaders,
        body: JSON.stringify({
          model: selectedModel,
          messages: apiMessages,
          temperature: temperature,
          stream: true,
          endpoint: endpoint.trim() || DEFAULT_ENDPOINT,
          customKey: effectiveKey || undefined,
        }),
        signal: controller.signal,
      }).catch(() => null);

      if (!response || !response.ok) {
        // Non-streaming fallback retry
        response = await fetch("/api/ai/chat", {
          method: "POST",
          headers: fetchHeaders,
          body: JSON.stringify({
            model: selectedModel,
            messages: apiMessages,
            temperature: temperature,
            stream: false,
            customKey: effectiveKey || undefined,
          }),
          signal: controller.signal,
        });
      }

      if (!response.ok) {
        let errSnippet = "";
        try {
          errSnippet = await response.text();
        } catch {}
        throw new Error(`HTTP ${response.status}: ${errSnippet.slice(0, 160)}`);
      }

      let accumulatedContent = "";
      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("application/json") || !response.body) {
        const data = await response.json();
        accumulatedContent =
          data.choices?.[0]?.message?.content ||
          data.choices?.[0]?.delta?.content ||
          data.data?.choices?.[0]?.message?.content ||
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
            if (!trimmed || trimmed.startsWith(":")) continue; // keep-alive
            if (trimmed === "data: [DONE]") continue;

            if (trimmed.startsWith("data:")) {
              const jsonStr = trimmed.slice(5).trim();
              try {
                const parsed = JSON.parse(jsonStr);
                const delta = parsed.choices?.[0]?.delta?.content || "";
                if (delta) {
                  accumulatedContent += delta;
                  // Live update assistant message in target thread
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

        // Leftover buffer
        if (buffer.trim().startsWith("data:") && !buffer.includes("[DONE]")) {
          try {
            const parsed = JSON.parse(buffer.trim().slice(5).trim());
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
          } catch {}
        }
      }

      // If empty response returned, indicate error or provide direct retry message
      if (!accumulatedContent.trim()) {
        const errorFallback = "Unable to receive an AI response at this moment. Please check your prompt or try again.";
        setThreads((prev) =>
          prev.map((t) => {
            if (t.id === currentTargetThreadId) {
              return {
                ...t,
                messages: t.messages.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, content: errorFallback }
                    : m
                ),
              };
            }
            return t;
          })
        );
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        // User stopped generation manually
      } else {
        const errorMsg = `Error generating response: ${err.message || "Failed to reach AI service. Please try again."}`;
        setThreads((prev) =>
          prev.map((t) => {
            if (t.id === currentTargetThreadId) {
              return {
                ...t,
                messages: t.messages.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, content: errorMsg }
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
    // Find last user message
    const lastUserIndex = [...activeThread.messages].reverse().findIndex((m) => m.role === "user");
    if (lastUserIndex === -1) return;
    const realIndex = activeThread.messages.length - 1 - lastUserIndex;
    const lastUserMsg = activeThread.messages[realIndex];

    // Remove everything after this user message
    const trimmed = activeThread.messages.slice(0, realIndex);
    setThreads((prev) =>
      prev.map((t) => (t.id === activeThread.id ? { ...t, messages: trimmed } : t))
    );

    // Re-send
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

  return (
    <div className="flex-1 w-full h-full flex flex-col md:flex-row overflow-hidden bg-transparent select-text">
      {/* Mobile Drawer Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Left Chat Threads & Persona Sidebar */}
      <aside
        style={{
          backgroundColor: "var(--theme-darkest)",
          borderColor: "var(--theme-border-subtle)",
        }}
        className={`fixed md:static inset-y-0 left-0 z-40 md:z-10 w-72 flex flex-col border-r transition-all duration-300 ease-in-out backdrop-blur-xl ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full md:-translate-x-full md:w-0 md:border-none md:p-0"
        } ${!isSidebarOpen ? "overflow-hidden" : ""}`}
      >
        {/* Sidebar Header */}
        <div className="p-3.5 border-b border-[var(--theme-border-subtle)] flex items-center justify-between gap-2 shrink-0">
          <button
            onClick={handleCreateNewThread}
            style={{
              backgroundColor: "var(--theme-surface)",
              borderColor: "var(--theme-border)",
            }}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold text-white hover:bg-white/10 transition-all duration-150 shadow-sm cursor-pointer active:scale-95"
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

        {/* Study Persona Switcher */}
        <div className="px-3 pt-3 pb-2 border-b border-[var(--theme-border-subtle)]">
          <div className="flex items-center justify-between mb-1.5 px-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--theme-text-muted)]">
              Study Persona
            </span>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowPersonaDropdown(!showPersonaDropdown)}
              style={{
                backgroundColor: "var(--theme-surface)",
                borderColor: "var(--theme-border-subtle)",
              }}
              className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl border text-xs font-semibold text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2 truncate">
                <span className="p-1 rounded-lg bg-white/10 text-[var(--theme-text-accent)]">
                  {activePersona.icon === "GraduationCap" && <GraduationCap size={13} />}
                  {activePersona.icon === "Code" && <Code size={13} />}
                  {activePersona.icon === "FileText" && <FileText size={13} />}
                  {activePersona.icon === "Calculator" && <Calculator size={13} />}
                  {activePersona.icon === "Compass" && <Compass size={13} />}
                </span>
                <span className="truncate">{activePersona.name}</span>
              </div>
              <ChevronDown size={14} className="text-neutral-400 shrink-0" />
            </button>

            {showPersonaDropdown && (
              <>
                <div className="fixed inset-0 z-50" onClick={() => setShowPersonaDropdown(false)} />
                <div
                  style={{
                    backgroundColor: "var(--theme-darkest)",
                    borderColor: "var(--theme-border)",
                  }}
                  className="absolute top-full left-0 right-0 mt-1 z-50 p-1.5 rounded-2xl border shadow-2xl backdrop-blur-2xl space-y-1"
                >
                  {PERSONAS.map((persona) => (
                    <button
                      key={persona.id}
                      onClick={() => {
                        setSelectedPersonaId(persona.id);
                        setShowPersonaDropdown(false);
                      }}
                      className={`w-full flex flex-col text-left px-2.5 py-2 rounded-xl text-xs transition-colors cursor-pointer ${
                        selectedPersonaId === persona.id
                          ? "bg-[var(--theme-accent)] text-white font-bold"
                          : "text-neutral-300 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{persona.name}</span>
                        {selectedPersonaId === persona.id && <Check size={13} className="text-[var(--theme-text-accent)]" />}
                      </div>
                      <span className="text-[10px] text-neutral-400 line-clamp-1 font-normal mt-0.5">
                        {persona.description}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Chat History List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          <div className="px-2 py-1 text-[10px] uppercase font-bold tracking-wider text-[var(--theme-text-muted)]">
            Conversations
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
                  title="Delete conversation"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>

        {/* Sidebar Footer / Model Status */}
        <div className="p-3 border-t border-[var(--theme-border-subtle)] flex items-center justify-between gap-2 shrink-0">
          <div
            style={{
              backgroundColor: "var(--theme-surface)",
              borderColor: "var(--theme-border-subtle)",
            }}
            className="flex-1 flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs font-semibold text-neutral-300 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50 animate-pulse" />
              <span className="text-xs truncate text-emerald-400 font-bold">Free Forever &bull; Unlimited</span>
            </div>
            <Sparkles size={13} className="text-[var(--theme-text-accent)] shrink-0" />
          </div>
        </div>
      </aside>

      {/* Main Chat Center Pane */}
      <main className="flex-1 flex flex-col min-w-0 h-full relative">
        {/* Top Header Bar */}
        <header
          style={{
            backgroundColor: "var(--theme-darkest)",
            borderColor: "var(--theme-border-subtle)",
          }}
          className="h-14 px-3 sm:px-6 border-b flex items-center justify-between gap-3 shrink-0 backdrop-blur-xl z-20"
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
                title="Open Chat Sidebar"
              >
                <PanelLeftOpen size={16} />
              </button>
            )}

            {/* Model Selector Pill */}
            <div className="relative">
              <button
                onClick={() => setShowModelDropdown(!showModelDropdown)}
                style={{
                  backgroundColor: "var(--theme-surface)",
                  borderColor: "var(--theme-border)",
                }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold text-white hover:bg-white/5 transition-all shadow-sm cursor-pointer"
              >
                <Sparkles size={13} className="text-[var(--theme-text-accent)]" />
                <span>{selectedModel}</span>
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
                    className="absolute top-full left-0 mt-1.5 w-64 sm:w-72 z-50 p-1.5 rounded-2xl border shadow-2xl backdrop-blur-2xl space-y-1"
                  >
                    <div className="px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider text-[var(--theme-text-muted)] flex items-center justify-between">
                      <span>Available Models</span>
                      <span className="text-emerald-400 font-semibold">Ready</span>
                    </div>
                    {GITHUB_MODELS.map((model) => (
                      <button
                        key={model.id}
                        onClick={() => {
                          setSelectedModel(model.id);
                          localStorage.setItem("github_models_selected", model.id);
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

            <div className="hidden sm:flex items-center gap-1.5 text-xs text-neutral-400 truncate">
              <span>&bull;</span>
              <span className="truncate">{activePersona.name}</span>
            </div>
          </div>

          {/* Right Action Icons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCreateNewThread}
              style={{
                backgroundColor: "var(--theme-surface)",
                borderColor: "var(--theme-border)",
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold text-white hover:bg-white/10 transition-all cursor-pointer shadow-sm active:scale-95"
              title="Start a new chat"
            >
              <Plus size={14} className="text-[var(--theme-text-accent)]" />
              <span className="hidden sm:inline">New Chat</span>
            </button>

            {activeThread.messages.length > 0 && (
              <>
                <button
                  onClick={handleExportChat}
                  className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                  title="Export conversation as Markdown"
                >
                  <Download size={15} />
                </button>
                <button
                  onClick={handleClearCurrentChat}
                  className="p-2 rounded-xl text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  title="Clear conversation"
                >
                  <RotateCcw size={15} />
                </button>
              </>
            )}
          </div>
        </header>

        {/* Chat Scroll Area */}
        <div
          ref={chatScrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 sm:px-8 py-5 space-y-5 custom-scrollbar min-h-0"
        >
          {/* Welcome Screen / Empty State */}
          {activeThread.messages.length === 0 ? (
            <div className="w-full max-w-4xl mx-auto py-8 sm:py-12 flex flex-col items-center text-center">
              {/* Avatar Icon */}
              <div
                style={{
                  backgroundColor: "var(--theme-surface)",
                  borderColor: "var(--theme-border)",
                }}
                className="h-16 w-16 rounded-2xl border flex items-center justify-center shadow-xl shadow-black/30 mb-4"
              >
                <Sparkles size={28} className="text-[var(--theme-text-accent)]" />
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Frosted AI Study Assistant
              </h2>
              <p className="text-xs sm:text-sm text-neutral-400 mt-1 max-w-md">
                100% Free Forever &bull; Unlimited Prompts &bull; Gemini 3.5 – 3.8 Flash Models. Ask homework questions, brainstorm topics, solve equations, or debug code.
              </p>

              {/* Quick Prompt Cards */}
              <div className="w-full mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                {QUICK_STARTERS.map((starter, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(starter.prompt)}
                    style={{
                      backgroundColor: "var(--theme-surface)",
                      borderColor: "var(--theme-border-subtle)",
                    }}
                    className="p-4 rounded-2xl border text-xs text-neutral-300 hover:text-white hover:border-[var(--theme-border)] hover:bg-white/5 transition-all duration-150 flex flex-col justify-between gap-2.5 group cursor-pointer shadow-sm"
                  >
                    <div className="flex items-center gap-2 font-bold text-white">
                      <span>{starter.icon}</span>
                      <span className="group-hover:text-[var(--theme-text-accent)] transition-colors text-sm">
                        {starter.title}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                      {starter.prompt}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            // Message Feed - full wide container
            <div className="w-full max-w-5xl lg:max-w-6xl mx-auto space-y-4">
              {activeThread.messages.map((message) => {
                const isUser = message.role === "user";
                return (
                  <div
                    key={message.id}
                    className={`flex items-start gap-3.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}
                  >
                    {/* Avatar */}
                    <div
                      style={{
                        backgroundColor: isUser ? "var(--theme-accent)" : "var(--theme-surface)",
                        borderColor: isUser ? "var(--theme-border-strong)" : "var(--theme-border)",
                      }}
                      className="h-8 w-8 rounded-xl border flex items-center justify-center shrink-0 text-white shadow-md text-xs font-bold"
                    >
                      {isUser ? <User size={15} /> : <Bot size={15} className="text-[var(--theme-text-accent)]" />}
                    </div>

                    {/* Message Bubble */}
                    <div className={`flex flex-col max-w-[90%] sm:max-w-[85%] ${isUser ? "items-end" : "items-start"}`}>
                      <div
                        style={{
                          backgroundColor: isUser ? "var(--theme-accent)" : "var(--theme-surface)",
                          borderColor: isUser ? "var(--theme-border)" : "var(--theme-border-subtle)",
                        }}
                        className={`px-4 py-3 rounded-2xl border text-xs sm:text-sm text-neutral-100 shadow-md ${
                          isUser ? "rounded-tr-sm" : "rounded-tl-sm"
                        } ${message.isError ? "border-rose-500/40 bg-rose-500/10 text-rose-200" : ""}`}
                      >
                        {isUser ? (
                          <div className="whitespace-pre-wrap font-medium">{message.content}</div>
                        ) : (() => {
                          const { thought, answer, isStillThinking } = parseThoughtAndContent(message.content);
                          const isExpanded = expandedThoughts[message.id] ?? true;
                          const thoughtWords = thought ? thought.split(/\s+/).filter(Boolean).length : 0;

                          return (
                            <div className="w-full space-y-3">
                              {/* Thinking Process Panel */}
                              {(thought || isStillThinking) && (
                                <div className="rounded-2xl border border-purple-500/30 bg-purple-950/20 backdrop-blur-md overflow-hidden transition-all shadow-sm">
                                  <button
                                    type="button"
                                    onClick={() => toggleThought(message.id)}
                                    className="w-full px-3.5 py-2.5 flex items-center justify-between gap-2 bg-purple-900/20 hover:bg-purple-900/30 transition-colors text-left cursor-pointer border-b border-purple-500/20"
                                  >
                                    <div className="flex items-center gap-2 text-xs font-bold text-purple-300">
                                      <Brain size={14} className={isStillThinking ? "text-purple-400 animate-pulse" : "text-purple-400"} />
                                      <span>
                                        {isStillThinking
                                          ? "Thinking through problem..."
                                          : `Thought Process (${thoughtWords} ${thoughtWords === 1 ? "word" : "words"})`}
                                      </span>
                                      {isStillThinking && (
                                        <span className="flex items-center gap-1 text-[10px] font-bold text-purple-300 px-1.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30 animate-pulse">
                                          <Loader2 size={10} className="animate-spin" />
                                          <span>Active</span>
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1 text-purple-400 text-xs">
                                      <span className="text-[11px] text-purple-300/70 font-medium">
                                        {isExpanded ? "Collapse" : "Show thinking"}
                                      </span>
                                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    </div>
                                  </button>

                                  {isExpanded && (
                                    <div className="p-3.5 text-xs text-purple-200/90 whitespace-pre-wrap leading-relaxed font-mono bg-black/40 border-t border-purple-500/10 max-h-72 overflow-y-auto custom-scrollbar select-text">
                                      {thought || "Analyzing prompt and formulating optimal strategy..."}
                                      {isStillThinking && (
                                        <span className="inline-block w-1.5 h-3.5 ml-1 bg-purple-400 animate-pulse align-middle" />
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Final Answer Markdown */}
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
                                              className="px-1.5 py-0.5 rounded bg-black/40 text-[var(--theme-text-accent)] font-mono text-[11px]"
                                              {...props}
                                            >
                                              {children}
                                            </code>
                                          );
                                        }

                                        const codeId = "code-" + Math.random().toString(36).slice(2);
                                        const isCopied = copiedCodeId === codeId;

                                        return (
                                          <div className="my-2 rounded-xl overflow-hidden border border-[var(--theme-border-subtle)] bg-black/60 shadow-lg">
                                            <div className="px-3 py-1.5 bg-white/5 border-b border-white/5 flex items-center justify-between text-[10px] text-neutral-400 font-mono">
                                              <span>{match?.[1] || "code"}</span>
                                              <button
                                                onClick={() => handleCopyText(codeContent, codeId)}
                                                className="flex items-center gap-1 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                                              >
                                                {isCopied ? (
                                                  <>
                                                    <Check size={11} className="text-emerald-400" />
                                                    <span className="text-emerald-400 font-bold">Copied!</span>
                                                  </>
                                                ) : (
                                                  <>
                                                    <Copy size={11} />
                                                    <span>Copy</span>
                                                  </>
                                                )}
                                              </button>
                                            </div>
                                            <pre className="p-3 overflow-x-auto text-[11px] font-mono text-neutral-200 leading-relaxed custom-scrollbar">
                                              <code>{children}</code>
                                            </pre>
                                          </div>
                                        );
                                      },
                                      p({ children }) {
                                        return <p className="mb-2 last:mb-0">{children}</p>;
                                      },
                                      ul({ children }) {
                                        return <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>;
                                      },
                                      ol({ children }) {
                                        return <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>;
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
                                          <blockquote className="border-l-2 border-[var(--theme-text-accent)] pl-3 my-2 text-neutral-300 italic">
                                            {children}
                                          </blockquote>
                                        );
                                      },
                                    }}
                                  >
                                    {answer}
                                  </ReactMarkdown>
                                ) : isStillThinking ? (
                                  <div className="flex items-center gap-1.5 text-purple-300/80 py-1 text-xs">
                                    <Loader2 size={13} className="animate-spin text-purple-400" />
                                    <span>Formulating response from thinking steps...</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 text-neutral-400 py-1">
                                    <Loader2 size={13} className="animate-spin text-[var(--theme-text-accent)]" />
                                    <span className="text-xs">Thinking...</span>
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
                            title="Copy message answer"
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

        {/* Floating Scroll To Bottom Button */}
        {showScrollBottom && (
          <button
            onClick={() => scrollToBottom(true)}
            style={{
              backgroundColor: "var(--theme-surface)",
              borderColor: "var(--theme-border)",
            }}
            className="absolute bottom-24 right-6 p-2 rounded-full border shadow-xl text-white hover:bg-white/10 transition-all z-20 cursor-pointer animate-bounce"
            title="Scroll to bottom"
          >
            <ArrowDown size={16} />
          </button>
        )}

        {/* Input Composer Area */}
        <div
          style={{
            backgroundColor: "var(--theme-darkest)",
            borderColor: "var(--theme-border-subtle)",
          }}
          className="p-3 sm:p-5 border-t backdrop-blur-xl shrink-0 z-20"
        >
          <div className="w-full max-w-5xl lg:max-w-6xl mx-auto flex flex-col gap-2 px-1 sm:px-4">
            {/* Input Container */}
            <div
              style={{
                backgroundColor: "var(--theme-surface)",
                borderColor: "var(--theme-border)",
              }}
              className="relative flex items-end gap-2 p-2.5 sm:p-3 rounded-2xl border shadow-inner focus-within:ring-1 focus-within:ring-[var(--theme-border-strong)] transition-all"
            >
              <textarea
                ref={textareaRef}
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Message Frosted AI (${selectedModel})... (Enter to send, Shift+Enter for newline)`}
                rows={1}
                className="flex-1 max-h-36 min-h-[40px] bg-transparent resize-none px-2 py-1.5 text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none custom-scrollbar"
                style={{ height: "auto" }}
              />

              {/* Stop / Send Button */}
              {isGenerating ? (
                <button
                  type="button"
                  onClick={handleStopGeneration}
                  className="p-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 transition-all cursor-pointer active:scale-95 shrink-0"
                  title="Stop generating"
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
                  title="Send message"
                >
                  <Send size={16} />
                </button>
              )}
            </div>

            {/* Input Sub-bar */}
            <div className="flex items-center justify-between text-[11px] text-neutral-400 px-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
                <span className="font-medium text-neutral-300">Frosted AI Companion &bull; {selectedModel}</span>
                <span className="text-[10px] font-bold text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                  Free Forever &bull; Unlimited
                </span>
              </div>

              {activeThread.messages.length > 0 && !isGenerating && (
                <button
                  onClick={handleRegenerate}
                  className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
                >
                  <RotateCcw size={11} />
                  <span>Regenerate last reply</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
