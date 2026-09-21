import React, { memo } from "react";
import { Search, Snowflake, MessageSquare, SlidersHorizontal, X, Sparkles, Gamepad2, Phone, Heart } from "lucide-react";
import { formatTagLabel } from "../utils";
import { useCall } from "../context/CallContext";
import { useFavorites } from "../lib/favorites";
import CallMenuDropdown from "./CallMenuDropdown";

interface HeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedTag: string;
  setSelectedTag: (tag: string) => void;
  tags: string[];
  currentView?: "home" | "game" | "chat";
  onGoHome?: () => void;
  onChatClick?: () => void;
  onOpenSettings?: () => void;
  onOpenTheme?: () => void;
}

const Header = memo(function Header({
  searchQuery,
  setSearchQuery,
  selectedTag,
  setSelectedTag,
  tags,
  currentView = "home",
  onGoHome,
  onChatClick,
  onOpenSettings,
  onOpenTheme,
}: HeaderProps) {
  const { isCallMenuOpen, setIsCallMenuOpen, onlineUsers } = useCall();
  const { count: favoriteCount } = useFavorites();

  const handleLogoClick = () => {
    setSearchQuery("");
    setSelectedTag("all");
    if (onGoHome) {
      onGoHome();
    }
  };

  const handleToggleFavorites = () => {
    if (selectedTag === "favorites") {
      setSelectedTag("all");
    } else {
      setSelectedTag("favorites");
    }
    if (onGoHome && currentView !== "home") {
      onGoHome();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (onGoHome && currentView !== "home") {
      onGoHome();
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
  };

  const handleTagSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedTag(val);
    if (onGoHome && currentView !== "home") {
      onGoHome();
    }
  };

  const isHome = currentView === "home" || currentView === "game";
  const isChat = currentView === "chat";

  return (
    <header
      id="app-header"
      className="sticky top-0 z-40 w-full border-b border-[var(--theme-border-subtle)] bg-[var(--theme-darkest)]/90 px-3 sm:px-6 py-2.5 shadow-xl shadow-black/40 backdrop-blur-xl transition-all duration-200"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Brand Logo & Primary View Tabs */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <button
            id="frosted-logo-btn"
            onClick={handleLogoClick}
            className="flex items-center gap-2.5 text-left group cursor-pointer focus:outline-none rounded-xl transition-transform duration-150 active:scale-95 shrink-0"
            title="Return to Home Library"
          >
            <span
              style={{
                backgroundColor: "var(--theme-surface)",
                borderColor: "var(--theme-border)",
              }}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-white border shadow-md transition-all duration-200 group-hover:scale-105"
            >
              <Snowflake
                size={18}
                className="text-[var(--theme-text-accent)] transition-transform duration-300 group-hover:rotate-45"
              />
            </span>
            <div className="flex flex-col">
              <span className="text-base sm:text-lg font-black tracking-tight text-white group-hover:text-[var(--theme-text-accent)] transition-colors">
                Frosted Studying
              </span>
              <span className="text-[10px] text-[var(--theme-text-muted)] font-medium -mt-1 hidden sm:inline">
                Cozy games & study companion
              </span>
            </div>
          </button>

          {/* Frosted Navigation Mode Tabs */}
          <nav
            style={{
              backgroundColor: "var(--theme-surface)",
              borderColor: "var(--theme-border-subtle)",
            }}
            className="flex items-center gap-1 p-1 rounded-2xl border shadow-inner"
          >
            {/* Games Hub Tab */}
            <button
              id="nav-games-btn"
              type="button"
              onClick={onGoHome}
              style={{
                backgroundColor: isHome ? "var(--theme-accent)" : "transparent",
                borderColor: isHome ? "var(--theme-border)" : "transparent",
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all duration-150 cursor-pointer ${
                isHome
                  ? "text-white shadow-md ring-1 ring-white/15"
                  : "text-neutral-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Gamepad2 size={14} className={isHome ? "text-[var(--theme-text-accent)]" : ""} />
              <span>Games</span>
            </button>

            {/* Social Chat Tab */}
            <button
              id="nav-chat-btn"
              type="button"
              onClick={onChatClick}
              style={{
                backgroundColor: isChat ? "var(--theme-accent)" : "transparent",
                borderColor: isChat ? "var(--theme-border)" : "transparent",
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all duration-150 cursor-pointer ${
                isChat
                  ? "text-white shadow-md ring-1 ring-white/15"
                  : "text-neutral-400 hover:text-white hover:bg-white/5"
              }`}
              title="Community Social Chat"
            >
              <MessageSquare size={14} className={isChat ? "text-[var(--theme-text-accent)]" : ""} />
              <span>Chat</span>
            </button>

            {/* Direct Calling & Group Voice Tab */}
            <div className="relative">
              <button
                id="nav-call-btn"
                type="button"
                onClick={() => setIsCallMenuOpen(!isCallMenuOpen)}
                style={{
                  backgroundColor: isCallMenuOpen ? "var(--theme-accent)" : "transparent",
                  borderColor: isCallMenuOpen ? "var(--theme-border)" : "transparent",
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all duration-150 cursor-pointer ${
                  isCallMenuOpen
                    ? "text-white shadow-md ring-1 ring-white/15"
                    : "text-neutral-400 hover:text-white hover:bg-white/5"
                }`}
                title="Call People (Direct 1-on-1 or Group Channel)"
              >
                <Phone size={13} className={isCallMenuOpen || onlineUsers.length > 0 ? "text-emerald-400" : ""} />
                <span>Call</span>
                {onlineUsers.length > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {onlineUsers.length}
                  </span>
                )}
              </button>

              <CallMenuDropdown
                isOpen={isCallMenuOpen}
                onClose={() => setIsCallMenuOpen(false)}
                onOpenSettings={onOpenSettings}
              />
            </div>
          </nav>
        </div>

        {/* Right Search, Genre Filter, Theme & Settings */}
        <div className="flex items-center gap-2 flex-wrap lg:flex-nowrap">
          {/* Search Bar (Visible everywhere or active) */}
          <div className="relative flex-1 sm:w-60 lg:w-56">
            <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[var(--theme-text-muted)] pointer-events-none" />
            <input
              id="game-search-input"
              type="text"
              value={searchQuery}
              onChange={handleInputChange}
              placeholder="Search library..."
              style={{
                backgroundColor: "var(--theme-surface)",
                borderColor: "var(--theme-border-subtle)",
              }}
              className="h-8.5 w-full rounded-xl border pl-8.5 pr-7 text-xs text-white placeholder-neutral-500 transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-[var(--theme-border-strong)]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 text-[var(--theme-text-muted)] hover:text-white transition-colors cursor-pointer"
                title="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Quick Favorites Button */}
          <button
            id="header-favorites-btn"
            type="button"
            onClick={handleToggleFavorites}
            style={{
              backgroundColor: selectedTag === "favorites" ? "rgba(244, 63, 94, 0.2)" : "var(--theme-surface)",
              borderColor: selectedTag === "favorites" ? "rgba(244, 63, 94, 0.6)" : "var(--theme-border-subtle)",
            }}
            className={`h-8.5 px-3 rounded-xl border text-xs font-bold transition-all duration-150 cursor-pointer flex items-center gap-1.5 shrink-0 ${
              selectedTag === "favorites"
                ? "text-rose-300 ring-1 ring-rose-500/30 shadow-md shadow-rose-950/40"
                : "text-neutral-300 hover:text-white hover:border-white/20"
            }`}
            title="Show Favorite Games"
          >
            <Heart
              size={13}
              className={`transition-transform duration-200 ${
                selectedTag === "favorites"
                  ? "fill-rose-400 text-rose-400 scale-110"
                  : "text-rose-400/80"
              }`}
            />
            <span className="hidden sm:inline">Favorites</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-extrabold ${
                selectedTag === "favorites"
                  ? "bg-rose-500 text-white"
                  : "bg-white/10 text-neutral-300"
              }`}
            >
              {favoriteCount}
            </span>
          </button>

          {/* Genre Category Dropdown */}
          <div className="hidden sm:block">
            <select
              id="tag-filter-select"
              value={selectedTag}
              onChange={handleTagSelect}
              style={{
                backgroundColor: "var(--theme-surface)",
                borderColor: "var(--theme-border-subtle)",
              }}
              className="h-8.5 rounded-xl border px-2.5 text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-[var(--theme-border-strong)] cursor-pointer transition-all duration-150"
            >
              <option value="all" style={{ backgroundColor: "var(--theme-darkest)" }} className="text-white">
                All Genres
              </option>
              <option value="favorites" style={{ backgroundColor: "var(--theme-darkest)" }} className="text-rose-300 font-bold">
                ❤️ Favorites ({favoriteCount})
              </option>
              {tags.map((tag) => (
                <option key={tag} value={tag} style={{ backgroundColor: "var(--theme-darkest)" }} className="text-white">
                  {formatTagLabel(tag)}
                </option>
              ))}
            </select>
          </div>

          {/* Theme Color Wheel Button */}
          <button
            id="frosted-theme-btn"
            type="button"
            onClick={onOpenTheme}
            style={{
              backgroundColor: "var(--theme-surface)",
              borderColor: "var(--theme-border-subtle)",
            }}
            className="h-8.5 px-3 rounded-xl border text-white transition-all duration-150 cursor-pointer flex items-center gap-2 shadow-sm hover:brightness-110 active:scale-95 shrink-0"
            title="Color Wheel & Atmosphere"
            aria-label="Color Wheel & Atmosphere"
          >
            <div
              className="w-3.5 h-3.5 rounded-full border border-white/80 shadow-sm shrink-0"
              style={{
                background:
                  "conic-gradient(from 0deg, #00ffff, #00ff66, #80ff00, #ffff00, #ff0000, #ff00ff, #0000ff, #00ffff)",
              }}
            />
            <span className="text-xs font-semibold hidden md:inline">Theme</span>
          </button>

          {/* Settings Button */}
          <button
            id="frosted-settings-btn"
            type="button"
            onClick={onOpenSettings}
            style={{
              backgroundColor: "var(--theme-surface)",
              borderColor: "var(--theme-border-subtle)",
            }}
            className="h-8.5 w-8.5 rounded-xl border text-white transition-all duration-150 cursor-pointer flex items-center justify-center shadow-sm hover:brightness-110 active:scale-95 shrink-0"
            title="Workspace & Tab Stealth Preferences"
            aria-label="Settings"
          >
            <SlidersHorizontal size={15} className="text-neutral-300 hover:text-white" />
          </button>
        </div>
      </div>
    </header>
  );
});

export default Header;

