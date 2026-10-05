import React, { memo } from "react";
import { Search, X, Shuffle, Menu } from "lucide-react";

interface TopBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedTag?: string;
  onSelectTag?: (tag: string) => void;
  tags?: string[];
  totalGamesCount: number;
  onRandomGame?: () => void;
  onToggleMobileSidebar?: () => void;
}

export const TopBar = memo(function TopBar({
  searchQuery,
  onSearchChange,
  totalGamesCount,
  onRandomGame,
  onToggleMobileSidebar,
}: TopBarProps) {
  return (
    <header
      id="app-topbar"
      style={{
        backgroundColor: "var(--theme-darkest)",
        borderColor: "var(--theme-border-subtle)",
      }}
      className="h-14 border-b flex items-center justify-between px-3 sm:px-6 gap-3 shrink-0 select-none z-20"
    >
      {/* Mobile Menu & Search Input */}
      <div className="flex items-center gap-2.5 flex-1 max-w-2xl">
        {onToggleMobileSidebar && (
          <button
            onClick={onToggleMobileSidebar}
            className="p-2 rounded-xl border border-[var(--theme-border-subtle)] text-neutral-400 hover:text-white hover:bg-white/5 md:hidden transition-colors cursor-pointer shrink-0"
            title="Toggle Menu"
          >
            <Menu size={16} />
          </button>
        )}

        {/* Global Search Input */}
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search all games, authors, or genres..."
            style={{
              backgroundColor: "var(--theme-surface)",
              borderColor: "var(--theme-border-subtle)",
            }}
            className="w-full pl-8.5 pr-8 py-2 rounded-xl border text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[var(--theme-accent)] transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white p-0.5 rounded cursor-pointer"
              title="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Right Quick Actions */}
      <div className="flex items-center gap-2">
        {/* Random Game Quick Button */}
        {onRandomGame && (
          <button
            onClick={onRandomGame}
            style={{
              backgroundColor: "var(--theme-surface)",
              borderColor: "var(--theme-border-subtle)",
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold text-neutral-200 hover:text-white hover:border-[var(--theme-border-strong)] transition-all cursor-pointer shrink-0 active:scale-95"
            title="Launch a Random Game"
          >
            <Shuffle size={13} className="text-[var(--theme-text-accent)]" />
            <span className="hidden sm:inline">Random Game</span>
          </button>
        )}

        {/* Total Games Count Badge */}
        <div
          style={{
            backgroundColor: "var(--theme-surface)",
            borderColor: "var(--theme-border-subtle)",
          }}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-mono text-neutral-300 shrink-0"
        >
          <span className="font-bold text-white">{totalGamesCount.toLocaleString()}</span>
          <span className="text-neutral-500 font-sans">games</span>
        </div>
      </div>
    </header>
  );
});

export default TopBar;
