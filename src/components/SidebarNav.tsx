import React, { useState } from "react";
import { 
  Gamepad2, 
  MessageSquare, 
  Bot, 
  Heart, 
  Palette, 
  Snowflake,
  Music,
  ChevronLeft,
  ChevronRight,
  Phone
} from "lucide-react";
import { useCall } from "../context/CallContext";
import CallMenuDropdown from "./CallMenuDropdown";

interface SidebarNavProps {
  currentView: "home" | "game" | "chat" | "youtube" | "assistant";
  onSelectView: (view: "home" | "chat" | "youtube" | "assistant") => void;
  onOpenTheme: () => void;
  onOpenSettings: () => void;
  onRandomGame: () => void;
  onFilterFavorites: () => void;
  onOpenSoundboard: () => void;
  favoritesCount: number;
  totalGamesCount: number;
  isSoundboardActive?: boolean;
}

export default function SidebarNav({
  currentView,
  onSelectView,
  onOpenTheme,
  onOpenSettings,
  onRandomGame,
  onFilterFavorites,
  onOpenSoundboard,
  favoritesCount,
  totalGamesCount,
  isSoundboardActive,
}: SidebarNavProps) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("frosted_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });

  const { isCallMenuOpen, setIsCallMenuOpen, onlineUsers } = useCall();

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("frosted_sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  };

  const isHome = currentView === "home" || currentView === "game";
  const isChat = currentView === "chat";
  const isYouTube = currentView === "youtube";
  const isAssistant = currentView === "assistant";

  return (
    <aside
      id="app-sidebar-rail"
      style={{
        backgroundColor: "var(--theme-surface)",
        borderColor: "var(--theme-border-subtle)",
      }}
      className={`hidden md:flex flex-col h-screen sticky top-0 border-r shrink-0 transition-all duration-300 z-30 select-none shadow-xl ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Sidebar Header Brand Lockup */}
      <div className={`flex items-center border-b border-[var(--theme-border-subtle)] ${collapsed ? "justify-center p-2 h-14" : "justify-between p-3.5"}`}>
        {collapsed ? (
          <button
            onClick={toggleCollapsed}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white border border-white/10 shadow-sm transition-all duration-150 cursor-pointer"
            title="Expand Sidebar"
          >
            <ChevronRight size={18} />
          </button>
        ) : (
          <>
            <button
              onClick={() => onSelectView("home")}
              className="flex items-center gap-2.5 text-left group cursor-pointer focus:outline-none min-w-0"
            >
              <div
                style={{
                  backgroundColor: "var(--theme-accent)",
                  borderColor: "var(--theme-border-strong)",
                }}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-white border shadow-md shrink-0 group-hover:scale-105 transition-transform"
              >
                <Snowflake size={18} className="text-white transition-transform duration-300 group-hover:rotate-45" />
              </div>
              <div className="min-w-0">
                <span className="text-sm font-bold tracking-tight text-white group-hover:text-[var(--theme-text-accent)] transition-colors truncate block">
                  Frosted
                </span>
              </div>
            </button>

            <button
              onClick={toggleCollapsed}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0 border border-transparent hover:border-white/5"
              title="Collapse Sidebar"
            >
              <ChevronLeft size={16} />
            </button>
          </>
        )}
      </div>

      {/* Main Navigation Stack */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
        {/* Navigation Items */}
        <div className="space-y-1">
          {/* Games Library */}
          <button
            onClick={() => onSelectView("home")}
            style={{
              backgroundColor: isHome ? "var(--theme-accent)" : "transparent",
              color: isHome ? "#ffffff" : "var(--theme-text-muted)",
            }}
            className={`w-full flex items-center gap-3 p-2.5 rounded-xl font-semibold text-xs transition-all duration-150 cursor-pointer group ${
              isHome ? "shadow-md text-white" : "hover:bg-white/5 hover:text-white"
            } ${collapsed ? "justify-center" : ""}`}
            title="Browse Games Catalog"
          >
            <Gamepad2 size={18} className={isHome ? "text-white" : "text-cyan-400 group-hover:scale-110 transition-transform"} />
            {!collapsed && (
              <div className="flex-1 flex items-center justify-between">
                <span>Games Library</span>
                <span className="text-[10px] font-mono font-normal opacity-70">
                  {totalGamesCount > 0 ? totalGamesCount.toLocaleString() : ""}
                </span>
              </div>
            )}
          </button>

          {/* Music View */}
          <button
            onClick={() => onSelectView("youtube")}
            style={{
              backgroundColor: isYouTube ? "var(--theme-accent)" : "transparent",
              color: isYouTube ? "#ffffff" : "var(--theme-text-muted)",
            }}
            className={`w-full flex items-center gap-3 p-2.5 rounded-xl font-semibold text-xs transition-all duration-150 cursor-pointer group ${
              isYouTube ? "shadow-md text-white" : "hover:bg-white/5 hover:text-white"
            } ${collapsed ? "justify-center" : ""}`}
            title="Music Player"
          >
            <Music size={18} className={isYouTube ? "text-white" : "text-rose-400 group-hover:scale-110 transition-transform"} />
            {!collapsed && (
              <div className="flex-1 flex items-center justify-between">
                <span>Music</span>
              </div>
            )}
          </button>

          {/* Chat */}
          <button
            onClick={() => onSelectView("chat")}
            style={{
              backgroundColor: isChat ? "var(--theme-accent)" : "transparent",
              color: isChat ? "#ffffff" : "var(--theme-text-muted)",
            }}
            className={`w-full flex items-center gap-3 p-2.5 rounded-xl font-semibold text-xs transition-all duration-150 cursor-pointer group relative ${
              isChat ? "shadow-md text-white" : "hover:bg-white/5 hover:text-white"
            } ${collapsed ? "justify-center" : ""}`}
            title="Live Chat Rooms"
          >
            <MessageSquare size={18} className={isChat ? "text-white" : "text-emerald-400 group-hover:scale-110 transition-transform"} />
            {!collapsed && (
              <div className="flex-1 flex items-center justify-between">
                <span>Chat</span>
              </div>
            )}
          </button>

          {/* Voice Lounge Tab */}
          <div className="relative">
            <button
              onClick={() => setIsCallMenuOpen(!isCallMenuOpen)}
              className={`w-full flex items-center gap-3 p-2.5 rounded-xl font-semibold text-xs text-neutral-300 hover:text-white hover:bg-white/5 transition-all cursor-pointer group ${
                collapsed ? "justify-center" : ""
              }`}
              title="Voice Lounge & Calls"
            >
              <Phone size={18} className="text-emerald-400 group-hover:scale-110 transition-transform" />
              {!collapsed && (
                <div className="flex-1 flex items-center justify-between">
                  <span>Voice Lounge</span>
                  {onlineUsers.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {onlineUsers.length}
                    </span>
                  )}
                </div>
              )}
            </button>
          </div>

          {/* AI Assistant */}
          <button
            onClick={() => onSelectView("assistant")}
            style={{
              backgroundColor: isAssistant ? "var(--theme-accent)" : "transparent",
              color: isAssistant ? "#ffffff" : "var(--theme-text-muted)",
            }}
            className={`w-full flex items-center gap-3 p-2.5 rounded-xl font-semibold text-xs transition-all duration-150 cursor-pointer group ${
              isAssistant ? "shadow-md text-white" : "hover:bg-white/5 hover:text-white"
            } ${collapsed ? "justify-center" : ""}`}
            title="AI Assistant"
          >
            <Bot size={18} className={isAssistant ? "text-white" : "text-indigo-400 group-hover:scale-110 transition-transform"} />
            {!collapsed && (
              <div className="flex-1 flex items-center justify-between">
                <span>AI Assistant</span>
              </div>
            )}
          </button>
        </div>

        {/* Divider */}
        <div className="pt-3 pb-1">
          <div className="h-[1px] bg-[var(--theme-border-subtle)]" />
        </div>

        {/* Quick Shortcuts */}
        <div className="space-y-1">
          {!collapsed && (
            <div className="px-2 py-1 text-[10px] font-bold tracking-wider uppercase text-neutral-400">
              Quick Shortcuts
            </div>
          )}

          {/* Favorites Filter */}
          <button
            onClick={onFilterFavorites}
            className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-xs text-neutral-300 hover:text-white hover:bg-white/5 transition-all cursor-pointer group ${
              collapsed ? "justify-center" : ""
            }`}
            title="My Starred Favorites"
          >
            <Heart size={16} className="text-rose-400 fill-rose-400/20 group-hover:scale-110 transition-transform" />
            {!collapsed && (
              <div className="flex-1 flex items-center justify-between">
                <span>Favorites</span>
                {favoritesCount > 0 && (
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-rose-500/20 text-rose-300">
                    {favoritesCount}
                  </span>
                )}
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Sidebar Footer Utilities */}
      <div className="p-2 border-t border-[var(--theme-border-subtle)] bg-[var(--theme-darkest)]/40 space-y-1">
        {/* Themes & Canvas */}
        <button
          onClick={onOpenTheme}
          className={`w-full flex items-center gap-3 p-2 rounded-xl text-xs text-neutral-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer ${
            collapsed ? "justify-center" : ""
          }`}
          title="Themes & Visual Canvas"
        >
          <Palette size={16} className="text-cyan-400" />
          {!collapsed && <span>Theme Suite</span>}
        </button>
      </div>

      {/* Non-clipping fixed position overlay for the Voice Calls */}
      <CallMenuDropdown
        isOpen={isCallMenuOpen}
        onClose={() => setIsCallMenuOpen(false)}
        onOpenSettings={onOpenSettings}
        positionMode="fixed"
      />
    </aside>
  );
}
