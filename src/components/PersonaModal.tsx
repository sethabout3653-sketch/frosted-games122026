import React, { useState, useEffect } from "react";
import {
  X,
  Sparkles,
  Zap,
  Plus,
  Trash2,
  Edit3,
  Copy,
  Download,
  Upload,
  Check,
  Flame,
  Sliders,
  Palette,
  MessageSquare,
  Bot,
  Brain,
  ShieldCheck,
  Smile,
} from "lucide-react";
import {
  AIPersona,
  DEFAULT_PERSONAS,
  PERSONA_TEMPLATES,
  getCustomPersonas,
  saveCustomPersona,
  deleteCustomPersona,
} from "../lib/personas";

interface PersonaModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPersonaId: string;
  onSelectPersona: (persona: AIPersona) => void;
}

const EMOJI_OPTIONS = [
  "⚡", "🤖", "🧠", "🔥", "💻", "🎓", "📐", "👾",
  "😏", "🎧", "⚔️", "🏛️", "📊", "🧙‍♂️", "🦊", "🐱",
  "🚀", "🎭", "🔬", "🔮", "🎸", "👑", "🦉", "🎨",
  "☕", "🌟", "🛡️", "🧬", "💎", "🐉", "🕵️", "🪐"
];

const ACCENT_COLORS = [
  { name: "Cyan Ice", value: "#38bdf8" },
  { name: "Emerald Matrix", value: "#10b981" },
  { name: "Amethyst Purple", value: "#a855f7" },
  { name: "Rose Neon", value: "#f43f5e" },
  { name: "Amber Flame", value: "#f59e0b" },
  { name: "Indigo Velvet", value: "#6366f1" },
  { name: "Pink Cyber", value: "#ec4899" },
  { name: "Lime Pulse", value: "#84cc16" },
  { name: "Crimson Red", value: "#ef4444" },
  { name: "Sky Blue", value: "#0ea5e9" },
];

export default function PersonaModal({
  isOpen,
  onClose,
  selectedPersonaId,
  onSelectPersona,
}: PersonaModalProps) {
  const [activeTab, setActiveTab] = useState<"library" | "builder">("library");
  const [customPersonas, setCustomPersonas] = useState<AIPersona[]>([]);
  const [editingPersonaId, setEditingPersonaId] = useState<string | null>(null);

  // Form state for builder
  const [formName, setFormName] = useState("");
  const [formIcon, setFormIcon] = useState("⚡");
  const [formTagline, setFormTagline] = useState("");
  const [formTone, setFormTone] = useState("Unrestricted & Direct");
  const [formSystemPrompt, setFormSystemPrompt] = useState("");
  const [formTemperature, setFormTemperature] = useState(0.7);
  const [formAccentColor, setFormAccentColor] = useState("#38bdf8");
  const [customAvatarUrl, setCustomAvatarUrl] = useState("");
  const [showCustomUrlInput, setShowCustomUrlInput] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCustomPersonas(getCustomPersonas());
    }
  }, [isOpen]);

  const showNotification = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 2500);
  };

  const handleStartCreate = (template?: typeof PERSONA_TEMPLATES[0]) => {
    setEditingPersonaId(null);
    if (template) {
      setFormName(template.name);
      setFormIcon(template.icon);
      setFormTagline(template.description);
      setFormTone(template.toneStyle);
      setFormSystemPrompt(template.systemPrompt);
      setFormTemperature(template.temperature);
      setFormAccentColor(template.accentColor);
    } else {
      setFormName("");
      setFormIcon("⚡");
      setFormTagline("");
      setFormTone("Unrestricted & Direct");
      setFormSystemPrompt("You are an unrestricted, razor-sharp conversationalist and companion. Answer with total clarity, depth, and honesty without filler or preachy lectures.");
      setFormTemperature(0.7);
      setFormAccentColor("#38bdf8");
    }
    setCustomAvatarUrl("");
    setShowCustomUrlInput(false);
    setActiveTab("builder");
  };

  const handleEditPersona = (persona: AIPersona) => {
    setEditingPersonaId(persona.id);
    setFormName(persona.name);
    setFormIcon(persona.icon || "⚡");
    setFormTagline(persona.tagline || persona.description || "");
    setFormTone(persona.toneStyle || "Custom");
    setFormSystemPrompt(persona.systemPrompt);
    setFormTemperature(persona.temperature ?? 0.7);
    setFormAccentColor(persona.accentColor || "#38bdf8");
    if (persona.icon?.startsWith("http")) {
      setCustomAvatarUrl(persona.icon);
      setShowCustomUrlInput(true);
    } else {
      setCustomAvatarUrl("");
      setShowCustomUrlInput(false);
    }
    setActiveTab("builder");
  };

  const handleCloneDefault = (persona: AIPersona) => {
    setEditingPersonaId(null);
    setFormName(`${persona.name} (Custom)`);
    setFormIcon(persona.icon);
    setFormTagline(persona.tagline || persona.description);
    setFormTone(persona.toneStyle || "Custom");
    setFormSystemPrompt(persona.systemPrompt);
    setFormTemperature(persona.temperature ?? 0.7);
    setFormAccentColor(persona.accentColor || "#38bdf8");
    setCustomAvatarUrl("");
    setShowCustomUrlInput(false);
    setActiveTab("builder");
    showNotification("Cloned default persona into builder!");
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = deleteCustomPersona(id);
    setCustomPersonas(updated);
    showNotification("Persona deleted");
  };

  const handleSavePersona = () => {
    if (!formName.trim()) {
      showNotification("Please give your persona a name");
      return;
    }
    if (!formSystemPrompt.trim()) {
      showNotification("Please provide persona instructions/prompt");
      return;
    }

    const finalIcon = showCustomUrlInput && customAvatarUrl.trim() ? customAvatarUrl.trim() : formIcon;

    const newPersona: AIPersona = {
      id: editingPersonaId || `custom_${Date.now()}`,
      name: formName.trim(),
      icon: finalIcon,
      description: formTagline.trim() || formSystemPrompt.slice(0, 100),
      tagline: formTagline.trim() || "Custom AI Persona",
      toneStyle: formTone.trim() || "Unrestricted",
      systemPrompt: formSystemPrompt.trim(),
      temperature: formTemperature,
      accentColor: formAccentColor,
      isCustom: true,
      createdAt: Date.now(),
    };

    const updated = saveCustomPersona(newPersona);
    setCustomPersonas(updated);
    onSelectPersona(newPersona);
    showNotification(editingPersonaId ? "Persona updated!" : "Persona created & activated!");
    setActiveTab("library");
  };

  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(customPersonas, null, 2));
    const dlAnchor = document.createElement("a");
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `frosted_custom_personas_${Date.now()}.json`);
    dlAnchor.click();
    showNotification("Exported personas JSON");
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported)) {
          let count = 0;
          imported.forEach((p) => {
            if (p.name && p.systemPrompt) {
              saveCustomPersona({ ...p, isCustom: true });
              count++;
            }
          });
          setCustomPersonas(getCustomPersonas());
          showNotification(`Imported ${count} persona(s) successfully!`);
        }
      } catch (err) {
        showNotification("Invalid persona JSON file");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-[#0e131f] border border-white/10 shadow-2xl text-white overflow-hidden"
        style={{
          boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 35px -10px rgba(56, 189, 248, 0.15)",
        }}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#121829]/90 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 p-[1px] flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <div className="w-full h-full bg-[#0e131f] rounded-[11px] flex items-center justify-center">
                <Sparkles size={20} className="text-cyan-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight text-white">AI Persona Studio</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                  <Zap size={10} /> Unrestricted Mode Auto
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Create, customize, and chat with tailored personas with unrestricted freedom.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Nav Tabs */}
            <div className="flex items-center bg-black/40 p-1 rounded-xl border border-white/5">
              <button
                type="button"
                onClick={() => setActiveTab("library")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                  activeTab === "library"
                    ? "bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-md"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Persona Library ({DEFAULT_PERSONAS.length + customPersonas.length})
              </button>
              <button
                type="button"
                onClick={() => handleStartCreate()}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center gap-1.5 ${
                  activeTab === "builder"
                    ? "bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-md"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                <Plus size={13} />
                {editingPersonaId ? "Edit Persona" : "Create Persona"}
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedbackMsg && (
          <div className="px-6 py-2 bg-cyan-500/10 border-b border-cyan-500/20 text-cyan-300 text-xs font-semibold flex items-center gap-2">
            <Check size={14} />
            {feedbackMsg}
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {activeTab === "library" ? (
            <div className="space-y-6">
              {/* Custom Personas Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                      <Sparkles size={13} /> Your Custom Personas ({customPersonas.length})
                    </span>
                    <span className="text-[11px] text-neutral-400">&bull; Created by you</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white text-xs font-medium border border-white/10 flex items-center gap-1.5 transition-colors">
                      <Upload size={12} />
                      Import JSON
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleImportJson}
                        className="hidden"
                      />
                    </label>
                    {customPersonas.length > 0 && (
                      <button
                        type="button"
                        onClick={handleExportJson}
                        className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white text-xs font-medium border border-white/10 flex items-center gap-1.5 transition-colors"
                      >
                        <Download size={12} />
                        Export
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleStartCreate()}
                      className="px-3 py-1 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-bold shadow-md flex items-center gap-1.5 transition-all"
                    >
                      <Plus size={13} />
                      New Persona
                    </button>
                  </div>
                </div>

                {customPersonas.length === 0 ? (
                  <div className="p-8 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-2xl shadow-inner">
                      ✨
                    </div>
                    <div className="max-w-md space-y-1">
                      <h4 className="text-sm font-bold text-white">No custom personas created yet</h4>
                      <p className="text-xs text-neutral-400">
                        Create your own unrestricted AI companions with tailored personalities, attitudes, expertise, and custom prompts!
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center pt-2">
                      <button
                        type="button"
                        onClick={() => handleStartCreate(PERSONA_TEMPLATES[0])}
                        className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-semibold border border-cyan-500/30 transition-colors flex items-center gap-1.5"
                      >
                        ⚡ Unrestricted Realist Template
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStartCreate(PERSONA_TEMPLATES[1])}
                        className="px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-xs font-semibold border border-purple-500/30 transition-colors flex items-center gap-1.5"
                      >
                        😏 Sarcastic Genius Template
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStartCreate(PERSONA_TEMPLATES[2])}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-semibold border border-emerald-500/30 transition-colors flex items-center gap-1.5"
                      >
                        🎧 Chill Study Buddy Template
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {customPersonas.map((persona) => {
                      const isSelected = selectedPersonaId === persona.id;
                      const isImg = persona.icon?.startsWith("http");
                      return (
                        <div
                          key={persona.id}
                          onClick={() => {
                            onSelectPersona(persona);
                            onClose();
                          }}
                          className={`group relative p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? "bg-[#162036] border-cyan-500/60 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-500/30"
                              : "bg-[#111726]/80 hover:bg-[#151e33] border-white/10 hover:border-white/20"
                          }`}
                        >
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <div
                                  className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 overflow-hidden shadow-md"
                                  style={{
                                    backgroundColor: `${persona.accentColor || "#38bdf8"}20`,
                                    border: `1px solid ${persona.accentColor || "#38bdf8"}40`,
                                  }}
                                >
                                  {isImg ? (
                                    <img
                                      src={persona.icon}
                                      alt={persona.name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <span>{persona.icon}</span>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <h4 className="text-sm font-bold text-white truncate">
                                      {persona.name}
                                    </h4>
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                      CUSTOM
                                    </span>
                                  </div>
                                  <p className="text-xs text-neutral-400 truncate">
                                    {persona.tagline || persona.toneStyle || "Custom Persona"}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  title="Edit Persona"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditPersona(persona);
                                  }}
                                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-neutral-300 hover:text-white transition-colors"
                                >
                                  <Edit3 size={13} />
                                </button>
                                <button
                                  type="button"
                                  title="Delete Persona"
                                  onClick={(e) => handleDelete(e, persona.id)}
                                  className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>

                            <p className="text-xs text-neutral-300 line-clamp-2 leading-relaxed bg-black/20 p-2.5 rounded-xl border border-white/5 font-mono text-[11px]">
                              {persona.systemPrompt}
                            </p>
                          </div>

                          <div className="flex items-center justify-between pt-3 mt-3 border-t border-white/5 text-[11px]">
                            <span
                              className="font-semibold"
                              style={{ color: persona.accentColor || "#38bdf8" }}
                            >
                              ⚡ {persona.toneStyle || "Unrestricted"}
                            </span>
                            <span className="text-neutral-400">
                              Temp: {persona.temperature ?? 0.7}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Default Preloaded Personas */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                      <Brain size={13} /> Core Built-In Personas ({DEFAULT_PERSONAS.length})
                    </span>
                    <span className="text-[11px] text-neutral-400">&bull; Click to chat or clone</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {DEFAULT_PERSONAS.map((persona) => {
                    const isSelected = selectedPersonaId === persona.id;
                    return (
                      <div
                        key={persona.id}
                        onClick={() => {
                          onSelectPersona(persona);
                          onClose();
                        }}
                        className={`group relative p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? "bg-[#162036] border-cyan-500/60 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-500/30"
                            : "bg-[#111726]/60 hover:bg-[#151e33] border-white/10 hover:border-white/20"
                        }`}
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 shadow-md"
                                style={{
                                  backgroundColor: `${persona.accentColor || "#38bdf8"}20`,
                                  border: `1px solid ${persona.accentColor || "#38bdf8"}40`,
                                }}
                              >
                                {persona.icon}
                              </div>
                              <div>
                                <h4 className="text-sm font-bold text-white leading-tight">
                                  {persona.name}
                                </h4>
                                <span className="text-[10px] text-neutral-400 font-medium">
                                  {persona.toneStyle}
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              title="Clone to customize"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCloneDefault(persona);
                              }}
                              className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-neutral-300 hover:text-white text-[10px] font-semibold flex items-center gap-1 transition-colors"
                            >
                              <Copy size={11} /> Clone
                            </button>
                          </div>

                          <p className="text-xs text-neutral-300 line-clamp-2 leading-relaxed">
                            {persona.description}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-white/5 text-[10px] text-neutral-400">
                          <span className="font-semibold text-cyan-400">⚡ Unrestricted</span>
                          <span>Temp: {persona.temperature ?? 0.7}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Starter Templates Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-indigo-950/40 to-purple-950/40 border border-cyan-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sparkles size={15} className="text-cyan-400" />
                    Need inspiration for a new persona?
                  </h4>
                  <p className="text-xs text-neutral-400">
                    Choose from quick starter templates with ready-to-use prompt blueprints.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleStartCreate()}
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 text-xs font-extrabold shadow-lg shadow-cyan-500/25 transition-all flex items-center gap-1.5 shrink-0"
                >
                  <Plus size={14} />
                  Open Builder
                </button>
              </div>
            </div>
          ) : (
            /* Builder Tab */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Form Controls Left */}
              <div className="lg:col-span-7 space-y-5">
                {/* Template Chips */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                    <Sparkles size={13} className="text-cyan-400" /> Quick Starter Templates
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {PERSONA_TEMPLATES.map((tmpl) => (
                      <button
                        key={tmpl.name}
                        type="button"
                        onClick={() => handleStartCreate(tmpl)}
                        className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-500/40 text-neutral-300 hover:text-white text-xs font-medium transition-all flex items-center gap-1.5"
                      >
                        <span>{tmpl.icon}</span>
                        <span>{tmpl.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Name & Tagline */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                      Persona Name <span className="text-cyan-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g. Sarcastic Hacker, Anime Sensei"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-sm text-white placeholder-neutral-500 transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                      Short Tagline / Vibe
                    </label>
                    <input
                      type="text"
                      value={formTagline}
                      onChange={(e) => setFormTagline(e.target.value)}
                      placeholder="e.g. Sharp wit, security tricks & late night coding"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-sm text-white placeholder-neutral-500 transition-colors"
                    />
                  </div>
                </div>

                {/* Avatar & Emoji Picker */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                      <Smile size={13} className="text-cyan-400" /> Choose Avatar Icon or Emoji
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowCustomUrlInput(!showCustomUrlInput)}
                      className="text-xs text-cyan-400 hover:text-cyan-300 underline font-medium"
                    >
                      {showCustomUrlInput ? "Use Emoji Grid" : "Use Custom Image URL"}
                    </button>
                  </div>

                  {showCustomUrlInput ? (
                    <div className="space-y-1.5">
                      <input
                        type="url"
                        value={customAvatarUrl}
                        onChange={(e) => setCustomAvatarUrl(e.target.value)}
                        placeholder="https://api.dicebear.com/7.x/bottts/svg?seed=MyPersona"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 focus:border-cyan-500 focus:outline-none text-sm text-white placeholder-neutral-500 font-mono text-xs"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-black/30 border border-white/10 max-h-28 overflow-y-auto">
                      {EMOJI_OPTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setFormIcon(emoji)}
                          className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all ${
                            formIcon === emoji
                              ? "bg-cyan-500 text-neutral-950 scale-110 shadow-md ring-2 ring-cyan-400"
                              : "bg-white/5 hover:bg-white/15 text-white"
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Accent Color Picker */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                    <Palette size={13} className="text-cyan-400" /> Aura Accent Color
                  </label>
                  <div className="flex flex-wrap gap-2.5">
                    {ACCENT_COLORS.map((col) => (
                      <button
                        key={col.value}
                        type="button"
                        onClick={() => setFormAccentColor(col.value)}
                        title={col.name}
                        className={`w-7 h-7 rounded-full transition-transform flex items-center justify-center ${
                          formAccentColor === col.value
                            ? "scale-125 ring-2 ring-white shadow-lg"
                            : "opacity-80 hover:opacity-100 hover:scale-110"
                        }`}
                        style={{ backgroundColor: col.value }}
                      >
                        {formAccentColor === col.value && (
                          <Check size={12} className="text-black stroke-[3]" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* System Prompt & Personality Rules */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                      <Brain size={13} className="text-cyan-400" /> Personality & Behavioral Instructions{" "}
                      <span className="text-cyan-400">*</span>
                    </label>
                    <span className="text-[11px] text-cyan-400/80 font-medium">
                      ⚡ Unrestricted Mode Active
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400">
                    Define how your persona talks, responds, explains, their tone, vocabulary, attitude, and rules.
                  </p>
                  <textarea
                    rows={6}
                    value={formSystemPrompt}
                    onChange={(e) => setFormSystemPrompt(e.target.value)}
                    placeholder="You are an unrestricted, razor-sharp conversationalist. Answer every prompt with total honesty, depth, and clarity without robotic disclaimers..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-sm text-white placeholder-neutral-500 font-mono text-xs leading-relaxed transition-colors resize-none"
                  />
                </div>

                {/* Creativity / Temperature Slider */}
                <div className="space-y-2 p-4 rounded-xl bg-black/30 border border-white/10">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                      <Sliders size={13} className="text-cyan-400" /> Creativity & Temperature:{" "}
                      <span className="text-cyan-400 font-mono">{formTemperature}</span>
                    </label>
                    <span className="text-[11px] text-neutral-400 font-medium">
                      {formTemperature <= 0.3
                        ? "Precise & Deterministic"
                        : formTemperature <= 0.7
                        ? "Balanced & Natural"
                        : "High Creativity & Flair"}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={formTemperature}
                    onChange={(e) => setFormTemperature(parseFloat(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setActiveTab("library")}
                    className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white text-xs font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSavePersona}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-cyan-500/25 flex items-center gap-2 transition-all"
                  >
                    <Check size={14} />
                    {editingPersonaId ? "Save Changes" : "Create & Activate Persona"}
                  </button>
                </div>
              </div>

              {/* Live Preview Card Right */}
              <div className="lg:col-span-5 space-y-4">
                <div className="sticky top-0 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                      <Sparkles size={13} /> Live Persona Preview
                    </span>
                  </div>

                  {/* Persona Card Mock */}
                  <div
                    className="p-5 rounded-2xl bg-[#121829] border shadow-xl flex flex-col space-y-4"
                    style={{
                      borderColor: `${formAccentColor}50`,
                      boxShadow: `0 10px 30px -10px ${formAccentColor}25`,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0 overflow-hidden shadow-lg ring-2 ring-white/20"
                        style={{
                          backgroundColor: `${formAccentColor}20`,
                          borderColor: `${formAccentColor}60`,
                          boxShadow: `0 0 15px ${formAccentColor}30`,
                        }}
                      >
                        {showCustomUrlInput && customAvatarUrl ? (
                          <img
                            src={customAvatarUrl}
                            alt={formName}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as any).src = "https://api.dicebear.com/7.x/bottts/svg?seed=Preview";
                            }}
                          />
                        ) : (
                          <span>{formIcon}</span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-extrabold text-white truncate">
                            {formName || "Persona Name"}
                          </h3>
                          <span
                            className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider"
                            style={{
                              backgroundColor: `${formAccentColor}25`,
                              color: formAccentColor,
                              border: `1px solid ${formAccentColor}40`,
                            }}
                          >
                            CUSTOM
                          </span>
                        </div>
                        <p className="text-xs text-neutral-400 truncate mt-0.5">
                          {formTagline || "Your custom prompt description..."}
                        </p>
                      </div>
                    </div>

                    {/* Unrestricted Status Pill */}
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-white/5 text-xs">
                      <span className="flex items-center gap-1.5 text-cyan-400 font-semibold text-[11px]">
                        <Zap size={12} /> Mode: Unrestricted
                      </span>
                      <span className="text-neutral-400 text-[11px] font-mono">
                        Temp: {formTemperature}
                      </span>
                    </div>

                    {/* Mock Chat Bubble */}
                    <div className="space-y-2 pt-2 border-t border-white/5">
                      <span className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">
                        Sample Greeting
                      </span>
                      <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-neutral-200 leading-relaxed font-sans">
                        <p className="font-semibold text-white mb-1 flex items-center gap-1.5">
                          <span>{formName || "Persona"}</span>
                          <span className="text-[10px] text-neutral-400 font-normal">&bull; Ready to chat</span>
                        </p>
                        "Hey, I'm {formName || "your custom persona"}. I operate with zero filters, full depth, and direct answers. What are we diving into today?"
                      </div>
                    </div>
                  </div>

                  {/* Pro Tip Box */}
                  <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/20 text-xs text-cyan-300/90 leading-relaxed space-y-1">
                    <p className="font-bold flex items-center gap-1 text-cyan-300">
                      <ShieldCheck size={14} /> Unrestricted Persona Tip
                    </p>
                    <p className="text-[11px] text-neutral-400">
                      Your persona instructions are passed directly to the model. You can instruct it to write raw code, roleplay specific personalities, or debate complex theories freely.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
