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
  Key,
  Settings,
  Shield,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  X,
  Users,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import FriendsPanel from "./FriendsPanel";
import { ChatProfile } from "../types";

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
    systemPrompt: "You are Frosted AI, the official built-in companion for Frosted Studying — an unblocked student productivity, study, and stealth learning suite disguised as a casual arcade/games site. You know all about Frosted Studying's features including Tab Cloaking (disguising tabs as Google Drive, Canvas, or Clever), Panic Keys (switching to Google Drive instantly), integrated unblocked games (Slope, Geometry Dash, 2048, Retro Arcade, Chess, Wordle, Sudoku), AI Study Tutors, Flashcard builders, and Pomodoro timers. Keep responses warm, engaging, and clear.",
  },
  {
    id: "study_tutor",
    name: "Study Tutor",
    icon: "GraduationCap",
    description: "Breaks down difficult concepts, explains step-by-step, and creates practice quizzes.",
    systemPrompt: "You are an encouraging study tutor inside Frosted Studying. You understand how students use Frosted Studying to study safely with Tab Cloaking, Flashcard tools, Pomodoro timers, and unblocked arcade break games. Help the user master academic topics with step-by-step explanations, analogies, and quizzes.",
  },
  {
    id: "coding_mentor",
    name: "Coding & Tech",
    icon: "Code",
    description: "Debugs code, explains logic, and writes clean modern programs in any language.",
    systemPrompt: "You are an expert software engineer and programming mentor inside Frosted Studying. You write clean, production-ready code, explain web proxies, iframe sandboxing, tab cloaking logic, and help debug student code.",
  },
  {
    id: "writing_coach",
    name: "Essay & Writing",
    icon: "FileText",
    description: "Refines essays, checks grammar, improves flow, and polishes vocabulary.",
    systemPrompt: "You are a skilled writing coach and editor inside Frosted Studying. Help students refine essay structure, grammar, clarity, and persuasive tone while keeping their authentic voice.",
  },
  {
    id: "math_solver",
    name: "Math & Science",
    icon: "Calculator",
    description: "Solves equations, physics, and chemistry problems with complete worked solutions.",
    systemPrompt: "You are an expert mathematics and science tutor inside Frosted Studying. Show all intermediate calculation steps, explain underlying formulas, and verify answers accurately.",
  },
];

export interface AIModelOption {
  id: string;
  name: string;
  provider: string;
  description: string;
  badge?: string;
}

const GROQ_FREE_MODELS: AIModelOption[] = [
  {
    id: "openai/gpt-oss-120b",
    name: "GPT 120B",
    provider: "OpenAI on Groq",
    description: "OpenAI's flagship 120B model with high-speed reasoning.",
    badge: "Flagship",
  },
  {
    id: "openai/gpt-oss-20b",
    name: "GPT 20B",
    provider: "OpenAI on Groq",
    description: "Ultra-fast low-latency conversational model for instant answers.",
    badge: "Ultra Fast",
  },
  {
    id: "llama-3.3-70b-versatile",
    name: "Llama 3.3 (70B)",
    provider: "Meta on Groq",
    description: "Meta's flagship 70B versatile model for deep reasoning and writing.",
    badge: "Versatile",
  },
  {
    id: "llama-3.1-8b-instant",
    name: "Llama 3.1 (8B)",
    provider: "Meta on Groq",
    description: "Ultra-fast lightweight 8B model with sub-second response times.",
    badge: "Instant",
  },
  {
    id: "deepseek-r1-distill-llama-70b",
    name: "DeepSeek R1 (70B)",
    provider: "DeepSeek on Groq",
    description: "DeepSeek R1 reasoning distilled into Llama 70B architecture.",
    badge: "Reasoning",
  },
  {
    id: "qwen-2.5-coder-32b",
    name: "Qwen Coder (32B)",
    provider: "Alibaba on Groq",
    description: "Specialized code generation, debugging, and programming model.",
    badge: "Coder",
  },
  {
    id: "qwen/qwen3.8-27b",
    name: "Qwen Vision (27B)",
    provider: "Alibaba on Groq",
    description: "Dense multimodal vision & reasoning model running at 450 tps.",
    badge: "Multimodal",
  },
  {
    id: "llama3-70b-8192",
    name: "Llama 3 (70B)",
    provider: "Meta on Groq",
    description: "High-capacity 70B model with 8192 context window.",
    badge: "Meta",
  },
  {
    id: "llama3-8b-8192",
    name: "Llama 3 (8B)",
    provider: "Meta on Groq",
    description: "Fast 8B general purpose model for Q&A and summarizing.",
    badge: "Meta",
  },
  {
    id: "mixtral-8x7b-32768",
    name: "Mixtral (8x7B)",
    provider: "Mistral AI on Groq",
    description: "Mistral's sparse mixture-of-experts model with 32k context.",
    badge: "Mistral",
  },
  {
    id: "gemma2-9b-it",
    name: "Gemma 2 (9B)",
    provider: "Google on Groq",
    description: "Google's Gemma 2 lightweight instruction model.",
    badge: "Google",
  },
  {
    id: "llama-3.2-11b-vision-preview",
    name: "Llama 3.2 Vision (11B)",
    provider: "Meta on Groq",
    description: "Multimodal image and document vision understanding model.",
    badge: "Vision",
  },
  {
    id: "llama-3.2-90b-vision-preview",
    name: "Llama 3.2 Vision (90B)",
    provider: "Meta on Groq",
    description: "Flagship 90B multimodal vision and reasoning model.",
    badge: "Vision 90B",
  },
  {
    id: "llama-3.2-3b-preview",
    name: "Llama 3.2 (3B)",
    provider: "Meta on Groq",
    description: "Lightweight 3B model for fast conversational study.",
    badge: "Light",
  },
  {
    id: "llama-3.2-1b-preview",
    name: "Llama 3.2 (1B)",
    provider: "Meta on Groq",
    description: "Ultra-compact 1B model for rapid responses.",
    badge: "Ultra Light",
  },
  {
    id: "groq/compound",
    name: "Groq Smart Router",
    provider: "Groq Compound",
    description: "Groq's coordinated multi-model routing engine.",
    badge: "Compound",
  },
  {
    id: "groq/compound-mini",
    name: "Groq Fast Router",
    provider: "Groq Compound",
    description: "Fast lightweight compound routing engine for quick study queries.",
    badge: "Compound Mini",
  },
];

const GITHUB_MODELS = GROQ_FREE_MODELS;

const getFriendlyModelName = (id: string, rawName?: string): string => {
  if (id === "openai/gpt-oss-120b") return "GPT 120B";
  if (id === "openai/gpt-oss-20b") return "GPT 20B";
  if (id === "llama-3.3-70b-versatile") return "Llama 3.3 (70B)";
  if (id === "llama-3.1-8b-instant") return "Llama 3.1 (8B)";
  if (id === "deepseek-r1-distill-llama-70b") return "DeepSeek R1 (70B)";
  if (id === "qwen-2.5-coder-32b") return "Qwen Coder (32B)";
  if (id === "qwen/qwen3.8-27b") return "Qwen Vision (27B)";
  if (id === "llama3-70b-8192") return "Llama 3 (70B)";
  if (id === "llama3-8b-8192") return "Llama 3 (8B)";
  if (id === "mixtral-8x7b-32768") return "Mixtral (8x7B)";
  if (id === "gemma2-9b-it") return "Gemma 2 (9B)";
  if (id === "llama-3.2-11b-vision-preview") return "Llama 3.2 Vision (11B)";
  if (id === "llama-3.2-90b-vision-preview") return "Llama 3.2 Vision (90B)";
  if (id === "llama-3.2-3b-preview") return "Llama 3.2 (3B)";
  if (id === "llama-3.2-1b-preview") return "Llama 3.2 (1B)";
  if (id === "groq/compound") return "Groq Smart Router";
  if (id === "groq/compound-mini") return "Groq Fast Router";
  if (id === "allam-2-7b") return "ALLaM 2 (7B)";

  if (rawName && !rawName.includes("/")) return rawName;

  return id
    .replace(/^openai\//i, "GPT ")
    .replace(/^qwen\//i, "Qwen ")
    .replace(/^meta-llama\//i, "Llama ")
    .replace(/-(preview|instant|versatile|specdec|8192|32768)/gi, "")
    .replace(/-/g, " ")
    .trim();
};

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

const DEFAULT_ENDPOINT = "https://api.groq.com/openai/v1";
export const DEFAULT_GITHUB_PAT = "";

export default function AIAssistant() {
  const [showFriendsModal, setShowFriendsModal] = useState<boolean>(false);
  const [chatProfile] = useState<ChatProfile>(() => {
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

  // Config state - pre-configured with default key
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem("groq_api_key") || localStorage.getItem("github_models_pat") || "");
  const [endpoint, setEndpoint] = useState<string>(() => localStorage.getItem("groq_endpoint") || localStorage.getItem("github_models_endpoint") || DEFAULT_ENDPOINT);
  const [availableModels, setAvailableModels] = useState<AIModelOption[]>(GROQ_FREE_MODELS);
  const [hasServerKey, setHasServerKey] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [tempApiKey, setTempApiKey] = useState<string>("");
  const [testingKey, setTestingKey] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const [selectedModel, setSelectedModel] = useState<string>(() => {
    const saved = localStorage.getItem("groq_model_selected") || localStorage.getItem("github_models_selected");
    // Filter out 404 or decommissioned models immediately
    if (saved && !saved.includes("versatile") && !saved.includes("instant") && !saved.includes("mixtral") && !saved.includes("gemma2") && GROQ_FREE_MODELS.some((m) => m.id === saved)) {
      return saved;
    }
    return "openai/gpt-oss-120b";
  });
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>("general");
  const [temperature, setTemperature] = useState<number>(0.7);

  // Sync live available models from server and ensure valid selection
  useEffect(() => {
    fetch("/api/ai/models")
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.models) && data.models.length > 0) {
          setAvailableModels(data.models);
          const isCurrentValid = data.models.some((m: any) => m.id === selectedModel);
          const isDeprecated = selectedModel.includes("versatile") || selectedModel.includes("instant") || selectedModel.includes("mixtral") || selectedModel.includes("gemma2");
          if (!isCurrentValid || isDeprecated) {
            const nextModel = data.models[0]?.id || "openai/gpt-oss-120b";
            setSelectedModel(nextModel);
            localStorage.setItem("groq_model_selected", nextModel);
          }
        }
        if (data && typeof data.hasServerKey === "boolean") {
          setHasServerKey(data.hasServerKey);
        }
      })
      .catch(() => {});
  }, []);

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
      model: "openai/gpt-oss-120b",
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
    return threads.find((t) => t.id === activeThreadId) || threads[0] || {
      id: "thread-" + Date.now(),
      title: "New Conversation",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
      model: "openai/gpt-oss-120b",
      personaId: "general",
    };
  }, [threads, activeThreadId]);

  useEffect(() => {
    if (activeThread && activeThread.id !== activeThreadId) {
      setActiveThreadId(activeThread.id);
    }
  }, [activeThread, activeThreadId]);

  const currentModelObj = availableModels.find((m) => m.id === selectedModel);
  const currentModelDisplayName = currentModelObj ? currentModelObj.name : getFriendlyModelName(selectedModel);

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

    // Update title if first message
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
              <span className="text-xs truncate text-emerald-400 font-bold">Frosted AI Engine</span>
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
                      <span>Groq Free Models</span>
                      <span className="text-emerald-400 font-semibold">Active LPUs</span>
                    </div>
                    {availableModels.map((model) => (
                      <button
                        key={model.id}
                        onClick={() => {
                          setSelectedModel(model.id);
                          localStorage.setItem("groq_model_selected", model.id);
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
              onClick={() => setShowFriendsModal(true)}
              style={{
                backgroundColor: "var(--theme-surface)",
                borderColor: "var(--theme-border)",
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold text-white hover:bg-white/10 transition-all cursor-pointer shadow-sm active:scale-95"
              title="Friends & Direct Messages"
            >
              <Users size={14} className="text-[var(--theme-text-accent)]" />
              <span className="hidden sm:inline">Friends & DMs</span>
            </button>

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
                Frosted AI
              </h2>
              <p className="text-xs sm:text-sm text-neutral-400 mt-1 max-w-md">
                Ask homework questions, learn about Frosted Studying stealth features, solve math equations, or debug code.
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
                placeholder={`Message Frosted AI (${currentModelDisplayName})... (Enter to send, Shift+Enter for newline)`}
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
                <span className="font-medium text-neutral-300">Frosted AI &bull; {currentModelDisplayName}</span>
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

      {/* Groq Settings & API Key Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-150">
          <div
            style={{
              backgroundColor: "var(--theme-darkest)",
              borderColor: "var(--theme-border)",
            }}
            className="w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Key size={18} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">Groq AI Engine Settings</h3>
                  <p className="text-xs text-neutral-400">High-speed inference on Groq Language Processing Units</p>
                </div>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 space-y-4 text-xs">
              {/* Server Status Box */}
              <div className="p-3.5 rounded-xl border border-white/10 bg-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-neutral-300">Server Key Status:</span>
                  {hasServerKey ? (
                    <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                      <CheckCircle2 size={13} /> Active on Server (Render)
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-amber-400 font-medium">
                      <AlertCircle size={13} /> Not detected on Server
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  On Render, add <code className="text-emerald-300 bg-black/40 px-1 py-0.5 rounded">GROQ_API_KEY</code> in your Web Service <strong>Environment</strong> tab. You can also save a key directly below in your browser.
                </p>
              </div>

              {/* Custom Key Input */}
              <div className="space-y-1.5">
                <label className="font-semibold text-neutral-200 block">
                  Groq API Key (Optional Client Override)
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={tempApiKey}
                    onChange={(e) => setTempApiKey(e.target.value)}
                    placeholder="gsk_..."
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white placeholder-neutral-500 text-xs focus:outline-none focus:border-emerald-400/50"
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-0.5">
                  <span>Keys are stored safely in your browser localStorage.</span>
                  <a
                    href="https://console.groq.com/keys"
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
                  >
                    Get Free Key <ExternalLink size={10} />
                  </a>
                </div>
              </div>

              {/* Test Status Banner */}
              {testResult && (
                <div
                  className={`p-3 rounded-xl border text-xs leading-relaxed ${
                    testResult.ok
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                      : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold mb-0.5">
                    {testResult.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                    <span>{testResult.ok ? "Connection Successful" : "Connection Test Failed"}</span>
                  </div>
                  <p className="text-[11px]">{testResult.msg}</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-white/10 bg-black/20 flex items-center justify-between gap-2">
              <button
                type="button"
                disabled={testingKey}
                onClick={async () => {
                  setTestingKey(true);
                  setTestResult(null);
                  try {
                    const keyToTest = tempApiKey.trim() || apiKey.trim();
                    const headers: Record<string, string> = { "Content-Type": "application/json" };
                    if (keyToTest) headers["Authorization"] = `Bearer ${keyToTest}`;
                    const res = await fetch("/api/ai/test", {
                      method: "POST",
                      headers,
                      body: JSON.stringify({ customKey: keyToTest || undefined }),
                    });
                    const data = await res.json();
                    if (data.ok) {
                      setTestResult({
                        ok: true,
                        msg: `Groq answered in ${data.latencyMs}ms using model: ${data.modelUsed || "Groq LPU"}!`,
                      });
                      setHasServerKey(true);
                    } else {
                      setTestResult({
                        ok: false,
                        msg: data.error || "Failed to reach Groq. Verify your key and try again.",
                      });
                    }
                  } catch (e: any) {
                    setTestResult({
                      ok: false,
                      msg: e.message || "Network test failed.",
                    });
                  } finally {
                    setTestingKey(false);
                  }
                }}
                className="px-3 py-2 rounded-xl border border-white/15 text-xs font-semibold text-neutral-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {testingKey ? <Loader2 size={12} className="animate-spin" /> : <Shield size={12} />}
                <span>{testingKey ? "Testing..." : "Test Connection"}</span>
              </button>

              <div className="flex items-center gap-2">
                {apiKey && (
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.removeItem("groq_api_key");
                      setApiKey("");
                      setTempApiKey("");
                      setTestResult(null);
                    }}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  >
                    Clear Key
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const trimmed = tempApiKey.trim();
                    if (trimmed) {
                      localStorage.setItem("groq_api_key", trimmed);
                      setApiKey(trimmed);
                    }
                    setShowSettingsModal(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                >
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Friends & Direct Messaging Modal */}
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
    </div>
  );
}
