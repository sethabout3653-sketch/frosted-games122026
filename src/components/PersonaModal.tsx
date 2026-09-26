import React from "react";
import { X, Check, Sparkles } from "lucide-react";
import { AIPersona, DEFAULT_PERSONAS } from "../lib/personas";

interface PersonaModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPersonaId?: string;
  onSelectPersona: (persona: AIPersona) => void;
}

export default function PersonaModal({
  isOpen,
  onClose,
  selectedPersonaId,
  onSelectPersona,
}: PersonaModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[85vh] flex flex-col bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                Choose AI Persona
              </h2>
              <p className="text-xs text-slate-400">
                Select an assistant personality tailored for your tasks
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Personas Grid */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 custom-scrollbar">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {DEFAULT_PERSONAS.map((persona) => {
              const isSelected = selectedPersonaId === persona.id;

              return (
                <button
                  key={persona.id}
                  onClick={() => {
                    onSelectPersona(persona);
                    onClose();
                  }}
                  className={`w-full p-4 rounded-2xl border text-left transition-all duration-150 flex flex-col justify-between gap-3 cursor-pointer group ${
                    isSelected
                      ? "bg-slate-800/90 border-cyan-500 ring-1 ring-cyan-500/40 shadow-lg shadow-cyan-500/10"
                      : "bg-slate-800/40 hover:bg-slate-800/80 border-slate-700/60 hover:border-slate-600"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 w-full">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 border border-white/10"
                        style={{
                          backgroundColor: `${persona.accentColor || "#38bdf8"}25`,
                        }}
                      >
                        <span>{persona.icon}</span>
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-sm text-white group-hover:text-cyan-300 transition-colors truncate">
                          {persona.name}
                        </h3>
                        <p className="text-[11px] text-slate-400 line-clamp-1">
                          {persona.tagline}
                        </p>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="p-1 rounded-full bg-cyan-500 text-white shrink-0">
                        <Check size={14} />
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-slate-300/90 leading-relaxed line-clamp-2">
                    {persona.description}
                  </p>

                  <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                    <span className="truncate">Tone: {persona.toneStyle}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between text-xs text-slate-400">
          <span>Click any persona to activate it immediately.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
