import React, { memo } from "react";
import { Search, Snowflake, MessageSquare, SlidersHorizontal, X, Sparkles, Gamepad2, Phone, Heart, Music, Shuffle, Settings } from "lucide-react";
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
  currentView?: "home" | "game" | "chat" | "youtube" | "assistant";
  onGoHome?: () => void;
  onChatClick?: () => void;
  onYouTubeClick?: () => void;
  onAssistantClick?: () => void;
  onOpenSettings?: () => void;
  onOpenTheme?: () => void;
  onRandomGame?: () => void;
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
  onYouTubeClick,
  onAssistantClick,
  onOpenSettings,
  onOpenTheme,
  onRandomGame,
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
  const isYouTube = currentView === "youtube";
  const isAssistant = currentView === "assistant";

  return (
    <header
      id="app-header"
      className="sticky top-0 z-40 w-full border-b border-[var(--theme-border-subtle)] bg-[var(--theme-darkest)]/90 px-4 md:px-6 py-2.5 shadow-xl transition-all duration-200 backdrop-blur-md"
    >
      <div className="flex w-full flex-row items-center justify-between gap-3">
        {/* Brand Logo & Primary View Dock (Visible on Mobile) */}
        <div className="flex items-center justify-between gap-3 sm:gap-4 flex-wrap md:hidden">
          <button
            id="frosted-logo-btn"
            onClick={handleLogoClick}
            className="flex items-center gap-2.5 text-left group cursor-pointer focus:outline-none rounded-xl transition-all duration-200 active:scale-95 shrink-0"
            title="Frosted Studying Home"
          >
            <div
              style={{
                backgroundColor: "var(--theme-surface)",
                borderColor: "var(--theme-border-strong)",
              }}
              className="relative flex h-8 w-8 items-center justify-center rounded-xl text-white border shadow-md shadow-[var(--theme-darkest)] transition-all duration-200 group-hover:scale-105 group-hover:border-white/30"
            >
              <Snowflake
                size={16}
                className="text-[var(--theme-text-accent)] transition-transform duration-300 group-hover:rotate-45"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-bold tracking-tight text-white group-hover:text-[var(--theme-text-accent)] transition-colors">
                Frosted
              </span>
            </div>
          </button>

          {/* Frosted Navigation Segmented Dock on Mobile */}
          <nav
            style={{
              backgroundColor: "var(--theme-surface)",
              borderColor: "var(--theme-border-subtle)",
            }}
            className="flex items-center gap-0.5 p-1 rounded-xl border shadow-inner flex-wrap sm:flex-nowrap"
          >
            {/* Games Hub Tab */}
            <button
              id="nav-games-btn"
              type="button"
              onClick={onGoHome}
              style={{
                backgroundColor: isHome ? "var(--theme-accent)" : "transparent",
                borderColor: isHome ? "var(--theme-border-strong)" : "transparent",
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-150 cursor-pointer ${
                isHome
                  ? "text-white shadow-sm ring-1 ring-white/20 font-bold"
                  : "text-neutral-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Gamepad2 size={14} className={isHome ? "text-white" : "text-neutral-400"} />
              <span>Games</span>
            </button>

            {/* Social Chat Tab */}
            <button
              id="nav-chat-btn"
              type="button"
              onClick={onChatClick}
              style={{
                backgroundColor: isChat ? "var(--theme-accent)" : "transparent",
                borderColor: isChat ? "var(--theme-border-strong)" : "transparent",
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-150 cursor-pointer ${
                isChat
                  ? "text-white shadow-sm ring-1 ring-white/20 font-bold"
                  : "text-neutral-400 hover:text-white hover:bg-white/5"
              }`}
              title="Social Chat"
            >
              <MessageSquare size={14} className={isChat ? "text-white" : "text-neutral-400"} />
              <span>Chat</span>
            </button>

            {/* AI Assistant Tab */}
            <button
              id="nav-ai-btn"
              type="button"
              onClick={onAssistantClick}
              style={{
                backgroundColor: isAssistant ? "var(--theme-accent)" : "transparent",
                borderColor: isAssistant ? "var(--theme-border-strong)" : "transparent",
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-150 cursor-pointer ${
                isAssistant
                  ? "text-white shadow-sm ring-1 ring-white/20 font-bold"
                  : "text-neutral-400 hover:text-white hover:bg-white/5"
              }`}
              title="Study Assistant"
            >
              <Sparkles size={14} className={isAssistant ? "text-amber-300 animate-pulse" : "text-amber-400"} />
              <span>Assistant</span>
            </button>

            {/* Music Tab */}
            <button
              id="nav-music-btn"
              type="button"
              onClick={onYouTubeClick}
              style={{
                backgroundColor: isYouTube ? "var(--theme-accent)" : "transparent",
                borderColor: isYouTube ? "var(--theme-border-strong)" : "transparent",
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-150 cursor-pointer ${
                isYouTube
                  ? "text-white shadow-sm ring-1 ring-white/20 font-bold"
                  : "text-neutral-400 hover:text-white hover:bg-white/5"
              }`}
              title="Music & Lo-Fi"
            >
              <Music size={14} className={isYouTube ? "text-white" : "text-neutral-400"} />
              <span>Music</span>
            </button>

            {/* Calling & Voice Tab */}
            <div className="relative">
              <button
                id="nav-call-btn"
                type="button"
                onClick={() => setIsCallMenuOpen(!isCallMenuOpen)}
                style={{
                  backgroundColor: isCallMenuOpen ? "var(--theme-accent)" : "transparent",
                  borderColor: isCallMenuOpen ? "var(--theme-border-strong)" : "transparent",
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-150 cursor-pointer ${
                  isCallMenuOpen
                    ? "text-white shadow-sm ring-1 ring-white/20 font-bold"
                    : "text-neutral-400 hover:text-white hover:bg-white/5"
                }`}
                title="Voice Calls"
              >
                <Phone size={13} className={isCallMenuOpen || onlineUsers.length > 0 ? "text-emerald-400" : "text-neutral-400"} />
                <span>Call</span>
                {onlineUsers.length > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
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

        {/* Desktop View Context / Breadcrumbs */}
        <div className="hidden md:flex items-center gap-3">
          {currentView === "home" && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white tracking-tight">Explore Games</span>
              {selectedTag !== "all" && (
                <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-white/10 text-neutral-300 border border-white/10">
                  {selectedTag === "favorites" ? "❤️ Favorites" : formatTagLabel(selectedTag)}
                </span>
              )}
            </div>
          )}
          {currentView === "game" && (
            <span className="text-sm font-bold text-white tracking-tight">Playing Game</span>
          )}
          {currentView === "chat" && (
            <span className="text-sm font-bold text-white tracking-tight">Community Chat & Lounge</span>
          )}
          {currentView === "assistant" && (
            <span className="text-sm font-bold text-white tracking-tight">Frosted AI Assistant</span>
          )}
          {currentView === "youtube" && (
            <span className="text-sm font-bold text-white tracking-tight">Music & Lo-Fi Lounge</span>
          )}
        </div>

        {/* Right Controls: Search, Quick Filter, Palette & Settings */}
        <div className="flex items-center gap-2 flex-wrap lg:flex-nowrap ml-auto">
          {currentView === "home" && (
            <>
              {/* Search Library Input */}
              <div className="relative flex-1 sm:w-64 lg:w-60">
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
                  className="h-9 w-full rounded-xl border pl-9 pr-7 text-xs text-white placeholder-neutral-500 transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-[var(--theme-border-strong)] focus:border-transparent font-medium"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="absolute top-1/2 right-2.5 -translate-y-1/2 text-[var(--theme-text-muted)] hover:text-white transition-colors cursor-pointer"
                    title="Clear search"
                  >
                    <X size={13} />
                  </button>
                ) : null}
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
                className={`h-9 px-3 rounded-xl border text-xs font-semibold transition-all duration-150 cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  selectedTag === "favorites"
                    ? "text-rose-200 ring-1 ring-rose-500/30 shadow-sm font-bold"
                    : "text-neutral-300 hover:text-white hover:border-white/20"
                }`}
                title="Favorites"
              >
                <Heart
                  size={13}
                  className={`transition-transform duration-150 ${
                    selectedTag === "favorites"
                      ? "fill-rose-400 text-rose-400 scale-110"
                      : "text-rose-400"
                  }`}
                />
                <span className="hidden sm:inline">Favorites</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
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
                  className="h-9 rounded-xl border px-3 text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-[var(--theme-border-strong)] cursor-pointer transition-all duration-150 font-medium"
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
            </>
          )}

          {/* Theme Palette Button */}
          <button
            id="frosted-theme-btn"
            type="button"
            onClick={onOpenTheme}
            style={{
              backgroundColor: "var(--theme-surface)",
              borderColor: "var(--theme-border-subtle)",
            }}
            className="h-9 px-3 rounded-xl border text-white transition-all duration-150 cursor-pointer flex items-center gap-2 shadow-sm hover:border-[var(--theme-border-strong)] active:scale-95 shrink-0"
            title="Palette & Atmosphere"
            aria-label="Palette & Atmosphere"
          >
            <div
              className="w-3.5 h-3.5 rounded-full border border-white/80 shadow-sm shrink-0 ring-1 ring-white/20"
              style={{
                background:
                  "conic-gradient(from 0deg, #60a5fa, #34d399, #f59e0b, #f43f5e, #a855f7, #60a5fa)",
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
            className="h-9 w-9 rounded-xl border text-white transition-all duration-150 cursor-pointer flex items-center justify-center shadow-sm hover:border-[var(--theme-border-strong)] active:scale-95 shrink-0"
            title="Settings & Tab Cloaking"
            aria-label="Settings"
          >
            <Settings size={15} className="text-neutral-300 hover:text-white" />
          </button>
        </div>
      </div>
    </header>
  );
});

export default Header;
