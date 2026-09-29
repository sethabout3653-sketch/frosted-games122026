import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search, Gamepad2, Tv, MessageSquare, Bot, Shuffle, Sparkles, Palette, Shield, Settings, Heart, Volume2, X } from "lucide-react";
import { Game } from "../types";
import { TAB_CLOAKS, applyTabCloak } from "../tabCloaks";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  games: Game[];
  onSelectGame: (game: Game) => void;
  onSwitchView: (view: "home" | "chat" | "youtube" | "assistant") => void;
  onOpenTheme: () => void;
  onOpenSettings: () => void;
  onRandomGame: () => void;
}

export default function CommandPalette({
  isOpen,
  onClose,
  games,
  onSelectGame,
  onSwitchView,
  onOpenTheme,
  onOpenSettings,
  onRandomGame,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Open
          const evt = new CustomEvent("open-command-palette");
          window.dispatchEvent(evt);
        }
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const filteredGames = useMemo(() => {
    if (!query.trim()) return games.slice(0, 8);
    const q = query.toLowerCase().trim();
    return games
      .filter((g) => {
        const nameMatch = g.name.toLowerCase().includes(q);
        const tagMatch = g.special?.some((t) => t.toLowerCase().includes(q));
        const authorMatch = g.author?.toLowerCase().includes(q);
        return nameMatch || tagMatch || authorMatch;
      })
      .slice(0, 10);
  }, [games, query]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/70 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -10 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          style={{
            backgroundColor: "var(--theme-surface)",
            borderColor: "var(--theme-border-strong)",
          }}
          className="relative w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden z-10 flex flex-col max-h-[80vh]"
        >
          {/* Search Input Bar */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--theme-border-subtle)] bg-[var(--theme-darkest)]/60">
            <Search size={18} className="text-[var(--theme-text-accent)] shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type a game title, command, or feature..."
              className="flex-1 bg-transparent text-sm text-white placeholder-neutral-400 outline-none font-medium"
            />
            <div className="flex items-center gap-1.5">
              <kbd className="px-2 py-0.5 text-[10px] font-mono bg-white/10 rounded text-neutral-300 border border-white/10">
                ESC
              </kbd>
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
            {/* Quick Navigation Commands */}
            {!query && (
              <div>
                <div className="px-2 pb-1.5 text-[11px] font-semibold tracking-wider text-neutral-400 uppercase">
                  Quick Navigation
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  <button
                    onClick={() => {
                      onSwitchView("home");
                      onClose();
                    }}
                    className="flex items-center gap-2 p-2.5 rounded-xl border border-[var(--theme-border-subtle)] bg-[var(--theme-darkest)]/40 hover:bg-white/10 hover:border-white/20 text-left transition-all group cursor-pointer"
                  >
                    <Gamepad2 size={16} className="text-cyan-400 shrink-0" />
                    <span className="text-xs font-medium text-neutral-200 group-hover:text-white">Games Hub</span>
                  </button>
                  <button
                    onClick={() => {
                      onSwitchView("youtube");
                      onClose();
                    }}
                    className="flex items-center gap-2 p-2.5 rounded-xl border border-[var(--theme-border-subtle)] bg-[var(--theme-darkest)]/40 hover:bg-white/10 hover:border-white/20 text-left transition-all group cursor-pointer"
                  >
                    <Tv size={16} className="text-rose-400 shrink-0" />
                    <span className="text-xs font-medium text-neutral-200 group-hover:text-white">YouTube</span>
                  </button>
                  <button
                    onClick={() => {
                      onSwitchView("chat");
                      onClose();
                    }}
                    className="flex items-center gap-2 p-2.5 rounded-xl border border-[var(--theme-border-subtle)] bg-[var(--theme-darkest)]/40 hover:bg-white/10 hover:border-white/20 text-left transition-all group cursor-pointer"
                  >
                    <MessageSquare size={16} className="text-emerald-400 shrink-0" />
                    <span className="text-xs font-medium text-neutral-200 group-hover:text-white">Live Lounge</span>
                  </button>
                  <button
                    onClick={() => {
                      onSwitchView("assistant");
                      onClose();
                    }}
                    className="flex items-center gap-2 p-2.5 rounded-xl border border-[var(--theme-border-subtle)] bg-[var(--theme-darkest)]/40 hover:bg-white/10 hover:border-white/20 text-left transition-all group cursor-pointer"
                  >
                    <Bot size={16} className="text-indigo-400 shrink-0" />
                    <span className="text-xs font-medium text-neutral-200 group-hover:text-white">AI Assistant</span>
                  </button>
                </div>
              </div>
            )}

            {/* Games matching query */}
            <div>
              <div className="px-2 pb-1.5 text-[11px] font-semibold tracking-wider text-neutral-400 uppercase flex items-center justify-between">
                <span>{query ? `Matching Games (${filteredGames.length})` : "Popular Quick Launch"}</span>
                {!query && (
                  <button
                    onClick={() => {
                      onRandomGame();
                      onClose();
                    }}
                    className="flex items-center gap-1 text-[10px] text-amber-400 hover:underline cursor-pointer lowercase"
                  >
                    <Shuffle size={10} />
                    <span>surprise launch</span>
                  </button>
                )}
              </div>

              <div className="space-y-1">
                {filteredGames.length === 0 ? (
                  <div className="py-6 text-center text-xs text-neutral-400">
                    No games found matching &ldquo;{query}&rdquo;
                  </div>
                ) : (
                  filteredGames.map((game) => (
                    <button
                      key={game.id}
                      onClick={() => {
                        onSelectGame(game);
                        onClose();
                      }}
                      className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-white/10 border border-transparent hover:border-[var(--theme-border-subtle)] transition-all group cursor-pointer text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {game.cover ? (
                          <img
                            src={game.cover}
                            alt={game.name}
                            className="w-8 h-8 rounded-lg object-cover bg-black/50 shrink-0"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center shrink-0">
                            <Gamepad2 size={16} className="text-neutral-400" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-neutral-200 group-hover:text-white truncate">
                            {game.name}
                          </div>
                          <div className="text-[10px] text-neutral-400 truncate">
                            {game.author || "Instant Unblocked Game"}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-medium text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0">
                        Launch ↵
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Quick Actions Footer */}
            <div className="pt-2 border-t border-[var(--theme-border-subtle)] flex items-center justify-between text-xs text-neutral-400 px-1">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    onOpenTheme();
                    onClose();
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                >
                  <Palette size={12} className="text-cyan-400" />
                  <span>Themes & Canvas</span>
                </button>
                <button
                  onClick={() => {
                    onOpenSettings();
                    onClose();
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                >
                  <Settings size={12} className="text-amber-400" />
                  <span>Settings & Cloak</span>
                </button>
              </div>
              <div className="text-[10px] text-neutral-500 hidden sm:block">
                Press <kbd className="px-1.5 py-0.5 bg-white/10 rounded font-mono text-neutral-300">↑</kbd> <kbd className="px-1.5 py-0.5 bg-white/10 rounded font-mono text-neutral-300">↓</kbd> to navigate
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
