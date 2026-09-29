import React, { useState, useEffect } from "react";
import { 
  Gamepad2, 
  Tv, 
  MessageSquare, 
  Bot, 
  Shuffle, 
  Heart, 
  Palette, 
  Settings, 
  Search, 
  Volume2, 
  Shield, 
  Sparkles, 
  Snowflake,
  ChevronLeft,
  ChevronRight,
  Headphones,
  SlidersHorizontal,
  Flame,
  Radio
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { applyTabCloak, TAB_CLOAKS } from "../tabCloaks";

interface SidebarNavProps {
  currentView: "home" | "game" | "chat" | "youtube" | "assistant";
  onSelectView: (view: "home" | "chat" | "youtube" | "assistant") => void;
  onOpenCommandPalette: () => void;
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
  onOpenCommandPalette,
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

  const handlePanicCloak = () => {
    // Quick emergency cloak to Google Docs / School portal
    const targetCloak = TAB_CLOAKS.find((c) => c.id === "google_docs") || TAB_CLOAKS[1];
    if (targetCloak) {
      applyTabCloak({
        id: targetCloak.id,
        title: targetCloak.title,
        icon: targetCloak.iconUrl,
      });
    }
  };

  return (
    <aside
      id="app-sidebar-rail"
      style={{
        backgroundColor: "var(--theme-surface)",
        borderColor: "var(--theme-border-subtle)",
      }}
      className={`hidden md:flex flex-col border-r shrink-0 transition-all duration-300 z-30 select-none shadow-xl ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Sidebar Header Brand Lockup */}
      <div className="flex items-center justify-between p-3.5 border-b border-[var(--theme-border-subtle)]">
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
          {!collapsed && (
            <div className="min-w-0">
              <span className="text-sm font-bold tracking-tight text-white group-hover:text-[var(--theme-text-accent)] transition-colors truncate block">
                Frosted
              </span>
              <span className="text-[10px] text-[var(--theme-text-muted)] font-mono block">
                v2.6 Next-Gen
              </span>
            </div>
          )}
        </button>

        <button
          onClick={toggleCollapsed}
          className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Main Navigation Stack */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
        {/* Quick Command Bar Trigger */}
        <button
          onClick={onOpenCommandPalette}
          style={{
            backgroundColor: "var(--theme-darkest)",
            borderColor: "var(--theme-border-subtle)",
          }}
          className={`w-full flex items-center gap-2.5 p-2 rounded-xl border text-left hover:border-[var(--theme-border)] text-neutral-300 hover:text-white transition-all group cursor-pointer mb-2 ${
            collapsed ? "justify-center" : "justify-between px-3"
          }`}
          title="Command Palette (Cmd+K)"
        >
          <div className="flex items-center gap-2.5">
            <Search size={16} className="text-[var(--theme-text-accent)] shrink-0" />
            {!collapsed && <span className="text-xs font-medium text-neutral-300">Quick Search...</span>}
          </div>
          {!collapsed && (
            <kbd className="px-1.5 py-0.5 text-[9px] font-mono bg-white/10 rounded text-neutral-400 border border-white/10">
              ⌘K
            </kbd>
          )}
        </button>

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

          {/* YouTube Theater */}
          <button
            onClick={() => onSelectView("youtube")}
            style={{
              backgroundColor: isYouTube ? "var(--theme-accent)" : "transparent",
              color: isYouTube ? "#ffffff" : "var(--theme-text-muted)",
            }}
            className={`w-full flex items-center gap-3 p-2.5 rounded-xl font-semibold text-xs transition-all duration-150 cursor-pointer group ${
              isYouTube ? "shadow-md text-white" : "hover:bg-white/5 hover:text-white"
            } ${collapsed ? "justify-center" : ""}`}
            title="YouTube Unblocked Theater"
          >
            <Tv size={18} className={isYouTube ? "text-white" : "text-rose-400 group-hover:scale-110 transition-transform"} />
            {!collapsed && (
              <div className="flex-1 flex items-center justify-between">
                <span>YouTube Media</span>
                <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300">
                  HD
                </span>
              </div>
            )}
          </button>

          {/* Live Lounge & Voice */}
          <button
            onClick={() => onSelectView("chat")}
            style={{
              backgroundColor: isChat ? "var(--theme-accent)" : "transparent",
              color: isChat ? "#ffffff" : "var(--theme-text-muted)",
            }}
            className={`w-full flex items-center gap-3 p-2.5 rounded-xl font-semibold text-xs transition-all duration-150 cursor-pointer group relative ${
              isChat ? "shadow-md text-white" : "hover:bg-white/5 hover:text-white"
            } ${collapsed ? "justify-center" : ""}`}
            title="Live Chat & Voice Channels"
          >
            <MessageSquare size={18} className={isChat ? "text-white" : "text-emerald-400 group-hover:scale-110 transition-transform"} />
            {!collapsed && (
              <div className="flex-1 flex items-center justify-between">
                <span>Live Lounge</span>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] text-emerald-300 font-medium">Voice</span>
                </div>
              </div>
            )}
            {collapsed && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-400" />
            )}
          </button>

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
            title="Groq AI Companion"
          >
            <Bot size={18} className={isAssistant ? "text-white" : "text-indigo-400 group-hover:scale-110 transition-transform"} />
            {!collapsed && (
              <div className="flex-1 flex items-center justify-between">
                <span>AI Companion</span>
                <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300">
                  LPU
                </span>
              </div>
            )}
          </button>
        </div>

        {/* Divider */}
        <div className="pt-3 pb-1">
          <div className="h-[1px] bg-[var(--theme-border-subtle)]" />
        </div>

        {/* Quick Collections */}
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

          {/* Soundboard Studio */}
          <button
            onClick={onOpenSoundboard}
            className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-xs transition-all cursor-pointer group ${
              isSoundboardActive ? "bg-amber-500/20 text-amber-300 font-bold" : "text-neutral-300 hover:text-white hover:bg-white/5"
            } ${collapsed ? "justify-center" : ""}`}
            title="Soundboard Studio"
          >
            <Volume2 size={16} className="text-amber-400 group-hover:scale-110 transition-transform" />
            {!collapsed && <span>Soundboard</span>}
          </button>

          {/* Surprise Me Launch */}
          <button
            onClick={onRandomGame}
            className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition-all cursor-pointer group ${
              collapsed ? "justify-center" : ""
            }`}
            title="Surprise Launch Random Game"
          >
            <Shuffle size={16} className="text-amber-400 group-hover:rotate-180 transition-transform duration-300" />
            {!collapsed && <span className="font-semibold">Surprise Me</span>}
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

        {/* Settings & Tab Cloaking */}
        <button
          onClick={onOpenSettings}
          className={`w-full flex items-center gap-3 p-2 rounded-xl text-xs text-neutral-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer ${
            collapsed ? "justify-center" : ""
          }`}
          title="Settings & Cloaking"
        >
          <Settings size={16} className="text-neutral-400" />
          {!collapsed && <span>Settings & Cloak</span>}
        </button>

        {/* Emergency Panic Cloak */}
        <button
          onClick={handlePanicCloak}
          className={`w-full flex items-center gap-3 p-2 rounded-xl text-[11px] text-neutral-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer ${
            collapsed ? "justify-center" : ""
          }`}
          title="Panic Shield (Instant Classroom Cloak)"
        >
          <Shield size={16} className="text-emerald-400" />
          {!collapsed && <span>Panic Shield</span>}
        </button>
      </div>
    </aside>
  );
}
