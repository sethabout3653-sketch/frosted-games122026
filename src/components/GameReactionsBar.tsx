import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  PRESET_GAME_EMOJIS,
  SUGGESTED_GAME_TEXT_REACTIONS,
  useGameReactions,
} from "../lib/game-reactions";
import { SmilePlus, Plus, Heart, Sparkles, X, Check } from "lucide-react";

interface GameReactionsBarProps {
  gameId: string | number;
  gameName?: string;
  compact?: boolean;
}

export default function GameReactionsBar({
  gameId,
  gameName = "Game",
  compact = false,
}: GameReactionsBarProps) {
  const { reactions, userReactions, toggleReaction, addCustomReaction } =
    useGameReactions(gameId);

  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [customText, setCustomText] = useState("");
  const [activeTab, setActiveTab] = useState<"quick" | "text">("quick");
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close popover on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setIsPopoverOpen(false);
      }
    }
    if (isPopoverOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isPopoverOpen]);

  const handleCustomSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = customText.trim();
    if (!clean) return;
    addCustomReaction(clean);
    setCustomText("");
    setIsPopoverOpen(false);
  };

  const handleSelectPresetEmoji = (emoji: string) => {
    toggleReaction(emoji);
  };

  const handleSelectSuggestedText = (text: string) => {
    addCustomReaction(text);
    setIsPopoverOpen(false);
  };

  // Top quick emojis displayed right in the bar for 1-click reacting
  const topQuickEmojis = ["🔥", "👑", "🎮", "❤️", "💀", "🚀", "😂", "⚡"];

  const activeReactionsEntries = Object.entries(reactions).filter(
    ([_, users]) => users.length > 0
  );

  return (
    <div className="relative flex flex-wrap items-center gap-1.5 select-none">
      {/* Existing Reaction Chips */}
      {activeReactionsEntries.map(([key, users]) => {
        const isUserActive = userReactions.includes(key);
        const count = users.length;
        const isTextReaction = key.length > 3 || !/\p{Emoji}/u.test(key);

        return (
          <button
            key={key}
            id={`reaction-chip-${key.replace(/[^a-zA-Z0-9]/g, "-")}`}
            type="button"
            onClick={() => toggleReaction(key)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all duration-150 cursor-pointer active:scale-95 ${
              isUserActive
                ? "bg-[var(--theme-accent)] border-[var(--theme-border-strong)] text-white shadow-sm ring-1 ring-white/20"
                : "bg-white/[0.04] border-white/10 text-neutral-300 hover:bg-white/[0.08] hover:text-white"
            }`}
            title={
              isUserActive
                ? `You and ${count - 1} others reacted with ${key} (Click to remove)`
                : `${count} players reacted with ${key} (Click to react)`
            }
          >
            <span className={isTextReaction ? "font-bold text-[11px] text-[var(--theme-indigo-200)]" : "text-sm"}>
              {key}
            </span>
            <span className="text-[11px] font-mono opacity-80">{count}</span>
          </button>
        );
      })}

      {/* Quick 1-Click Emoji Triggers (when space permits or not compact) */}
      {!compact && (
        <div className="hidden sm:flex items-center gap-1 bg-white/[0.03] border border-white/5 rounded-xl p-0.5">
          {topQuickEmojis.map((emoji) => {
            const isUserActive = userReactions.includes(emoji);
            return (
              <button
                key={emoji}
                type="button"
                onClick={() => handleSelectPresetEmoji(emoji)}
                className={`w-7 h-7 flex items-center justify-center rounded-lg text-sm transition-all duration-150 cursor-pointer ${
                  isUserActive
                    ? "bg-[var(--theme-indigo-500)]/40 text-white scale-105 shadow-inner"
                    : "hover:bg-white/10 text-neutral-300 hover:scale-110 active:scale-95"
                }`}
                title={`React with ${emoji}`}
              >
                {emoji}
              </button>
            );
          })}
        </div>
      )}

      {/* Add Custom / Full Reaction Popover Trigger */}
      <div className="relative" ref={popoverRef}>
        <button
          id="btn-add-game-reaction"
          type="button"
          onClick={() => {
            setIsPopoverOpen((prev) => !prev);
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border text-xs font-semibold transition-all duration-150 cursor-pointer active:scale-95 ${
            isPopoverOpen
              ? "bg-white/20 border-white/30 text-white"
              : "bg-white/[0.05] border-white/10 text-neutral-300 hover:bg-white/[0.1] hover:text-white"
          }`}
          title="Add a custom reaction or emoji to this game"
        >
          <SmilePlus size={13} className="text-[var(--theme-indigo-300)]" />
          <span className="text-[11px] font-medium hidden xs:inline">React</span>
          <Plus size={11} className="opacity-70" />
        </button>

        {/* Floating Popover Drawer */}
        <AnimatePresence>
          {isPopoverOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -6 }}
              transition={{ duration: 0.15 }}
              className="absolute left-0 bottom-full mb-2 z-50 w-72 sm:w-80 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-darkest)]/95 backdrop-blur-xl p-3 shadow-2xl shadow-black/80"
              style={{
                backgroundColor: "var(--theme-darkest)",
                borderColor: "var(--theme-border-strong)",
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
                <div className="flex items-center gap-1.5">
                  <Sparkles size={14} className="text-[var(--theme-indigo-300)]" />
                  <span className="text-xs font-bold text-white">React to {gameName}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPopoverOpen(false)}
                  className="p-1 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={13} />
                </button>
              </div>

              {/* Custom Reaction Text Input */}
              <form onSubmit={handleCustomSubmit} className="mb-3">
                <div className="flex items-center gap-1.5 bg-white/[0.06] border border-white/10 rounded-xl px-2.5 py-1 focus-within:border-[var(--theme-indigo-400)] focus-within:ring-1 focus-within:ring-[var(--theme-indigo-400)]/40 transition-all">
                  <input
                    ref={inputRef}
                    type="text"
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    maxLength={32}
                    placeholder="Type custom reaction (e.g., 10/10, W Game)..."
                    className="flex-1 bg-transparent text-xs text-white placeholder-neutral-500 focus:outline-none py-1"
                  />
                  <button
                    type="submit"
                    disabled={!customText.trim()}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      customText.trim()
                        ? "bg-[var(--theme-indigo-500)] text-white hover:bg-[var(--theme-indigo-600)] active:scale-95"
                        : "bg-white/5 text-neutral-500 cursor-not-allowed"
                    }`}
                  >
                    Post
                  </button>
                </div>
              </form>

              {/* Suggested Custom Text Reactions */}
              <div className="mb-3">
                <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Popular Text Reactions
                </div>
                <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto pr-1">
                  {SUGGESTED_GAME_TEXT_REACTIONS.map((tag) => {
                    const isUserActive = userReactions.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleSelectSuggestedText(tag)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border transition-all cursor-pointer ${
                          isUserActive
                            ? "bg-[var(--theme-indigo-500)]/30 border-[var(--theme-indigo-400)] text-white"
                            : "bg-white/[0.04] border-white/5 text-neutral-300 hover:bg-white/[0.1] hover:text-white"
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Preset Emoji Reactions Grid */}
              <div>
                <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Emoji Reactions
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {PRESET_GAME_EMOJIS.map(({ emoji, label }) => {
                    const isUserActive = userReactions.includes(emoji);
                    return (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          handleSelectPresetEmoji(emoji);
                        }}
                        className={`flex flex-col items-center justify-center p-1.5 rounded-xl border transition-all cursor-pointer group ${
                          isUserActive
                            ? "bg-[var(--theme-indigo-500)]/30 border-[var(--theme-indigo-400)] shadow-sm scale-105"
                            : "bg-white/[0.03] border-white/5 hover:bg-white/[0.08] hover:border-white/15"
                        }`}
                        title={label}
                      >
                        <span className="text-base group-hover:scale-115 transition-transform">
                          {emoji}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
