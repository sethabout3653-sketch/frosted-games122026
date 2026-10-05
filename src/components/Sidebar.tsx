import React, { memo, useState } from "react";
import {
  Snowflake,
  Gamepad2,
  MessageSquare,
  Music,
  Sparkles,
  Phone,
  Palette,
  Settings,
  ChevronLeft,
  ChevronRight,
  Headphones,
  Radio,
} from "lucide-react";
import { useCall } from "../context/CallContext";
import { ChatProfile } from "../types";
import { getOrCreateUserTag } from "../lib/friends";
import CallMenuDropdown from "./CallMenuDropdown";

interface SidebarProps {
  currentView: "home" | "game" | "chat" | "assistant" | "music";
  onNavigate: (view: "home" | "chat" | "assistant" | "music") => void;
  selectedTag?: string;
  onSelectTag?: (tag: string) => void;
  onOpenSettings?: () => void;
  onOpenTheme?: () => void;
  profile?: ChatProfile | null;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar = memo(function Sidebar({
  currentView,
  onNavigate,
  onOpenSettings,
  onOpenTheme,
  profile,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const { onlineUsers, isInVoiceSession } = useCall();
  const [isCallMenuOpen, setIsCallMenuOpen] = useState(false);

  const myTag = profile?.tag || getOrCreateUserTag(profile?.username || "Guest");

  const NAV_ITEMS = [
    {
      id: "home" as const,
      label: "Games",
      icon: Gamepad2,
      active: currentView === "home" || currentView === "game",
      onClick: () => onNavigate("home"),
    },
    {
      id: "chat" as const,
      label: "Chat & Friends",
      icon: MessageSquare,
      active: currentView === "chat",
      badge: onlineUsers.length > 0 ? String(onlineUsers.length) : null,
      onClick: () => onNavigate("chat"),
    },
    {
      id: "assistant" as const,
      label: "AI Assistant",
      icon: Sparkles,
      active: currentView === "assistant",
      onClick: () => onNavigate("assistant"),
    },
    {
      id: "music" as const,
      label: "Music Lounge",
      icon: Music,
      active: currentView === "music",
      onClick: () => onNavigate("music"),
    },
  ];

  return (
    <aside
      id="app-sidebar"
      style={{
        backgroundColor: "var(--theme-darkest)",
        borderColor: "var(--theme-border-subtle)",
      }}
      className={`h-full flex flex-col border-r shrink-0 transition-all duration-200 z-30 select-none ${
        collapsed ? "w-16" : "w-56 lg:w-60"
      }`}
    >
      {/* Brand Header */}
      <div
        style={{ borderColor: "var(--theme-border-subtle)" }}
        className="h-14 flex items-center justify-between px-3 border-b shrink-0"
      >
        <button
          onClick={() => onNavigate("home")}
          className="flex items-center gap-2.5 text-left group cursor-pointer focus:outline-none min-w-0"
          title="Frosted Hub"
        >
          <div
            style={{
              backgroundColor: "var(--theme-surface)",
              borderColor: "var(--theme-border-strong)",
            }}
            className="flex h-8.5 w-8.5 items-center justify-center rounded-xl text-white border shrink-0 transition-all group-hover:scale-105"
          >
            <Snowflake
              size={18}
              className="text-[var(--theme-text-accent)] transition-transform duration-300 group-hover:rotate-90"
            />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-black tracking-tight text-white group-hover:text-[var(--theme-text-accent)] transition-colors truncate">
                Frosted
              </span>
              <span className="text-[10px] text-neutral-400 font-medium -mt-0.5 truncate">
                Study & Games
              </span>
            </div>
          )}
        </button>

        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer hidden md:flex"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        )}
      </div>

      {/* Main Navigation Section */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-1 custom-scrollbar">
        {!collapsed && (
          <p className="px-2.5 pt-1.5 pb-1 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
            Menu
          </p>
        )}

        <div className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = item.active;

            return (
              <button
                key={item.id}
                onClick={item.onClick}
                style={{
                  backgroundColor: isActive ? "var(--theme-surface)" : "transparent",
                  borderColor: isActive ? "var(--theme-border)" : "transparent",
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  isActive
                    ? "text-white shadow-sm font-bold"
                    : "text-neutral-400 hover:text-white hover:bg-white/5"
                } ${collapsed ? "justify-center px-0" : ""}`}
                title={item.label}
              >
                <div className="relative shrink-0">
                  <Icon
                    size={16}
                    className={
                      isActive ? "text-[var(--theme-text-accent)]" : "text-neutral-400"
                    }
                  />
                  {item.id === "chat" && onlineUsers.length > 0 && collapsed && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400" />
                  )}
                </div>

                {!collapsed && (
                  <div className="flex items-center justify-between flex-1 min-w-0">
                    <span className="truncate">{item.label}</span>
                    {item.badge && (
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* In-Call Status Banner (if connected to voice) */}
        {isInVoiceSession && !collapsed && (
          <div className="mt-4 p-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-xs text-emerald-400 flex items-center gap-2">
            <Radio size={14} className="animate-pulse shrink-0" />
            <span className="truncate font-semibold text-[11px]">Connected to Voice Lounge</span>
          </div>
        )}
      </div>

      {/* Footer / Utilities & Call Dock */}
      <div
        style={{ borderColor: "var(--theme-border-subtle)" }}
        className="p-2.5 border-t shrink-0 space-y-2"
      >
        {/* Quick action buttons */}
        <div className={`relative flex items-center gap-1.5 ${collapsed ? "flex-col" : "justify-between"}`}>
          <button
            id="sidebar-voice-lounge-btn"
            onClick={() => setIsCallMenuOpen((prev) => !prev)}
            style={{
              backgroundColor: isCallMenuOpen ? "var(--theme-accent)" : "var(--theme-surface)",
              borderColor: isCallMenuOpen ? "var(--theme-border-strong)" : "var(--theme-border-subtle)",
            }}
            className={`flex items-center gap-1.5 p-2 rounded-xl border text-xs text-neutral-300 hover:text-emerald-400 hover:border-emerald-500/30 transition-all cursor-pointer ${
              collapsed ? "w-full justify-center" : "flex-1"
            }`}
            title="Start Call / Voice Lounge"
          >
            <Phone size={13} className={isCallMenuOpen ? "text-white" : "text-emerald-400"} />
            {!collapsed && <span className="font-semibold text-[11px]">Call</span>}
          </button>

          {onOpenTheme && (
            <button
              onClick={onOpenTheme}
              style={{
                backgroundColor: "var(--theme-surface)",
                borderColor: "var(--theme-border-subtle)",
              }}
              className="p-2 rounded-xl border text-neutral-300 hover:text-white hover:border-[var(--theme-border-strong)] transition-all cursor-pointer"
              title="Theme Customizer"
            >
              <Palette size={13} />
            </button>
          )}

          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              style={{
                backgroundColor: "var(--theme-surface)",
                borderColor: "var(--theme-border-subtle)",
              }}
              className="p-2 rounded-xl border text-neutral-300 hover:text-white hover:border-[var(--theme-border-strong)] transition-all cursor-pointer"
              title="Settings"
            >
              <Settings size={13} />
            </button>
          )}

          <CallMenuDropdown
            isOpen={isCallMenuOpen}
            onClose={() => setIsCallMenuOpen(false)}
            onOpenSettings={onOpenSettings}
            positionMode="fixed"
          />
        </div>

        {/* User Profile Card */}
        {profile && (
          <div
            style={{
              backgroundColor: "var(--theme-surface)",
              borderColor: "var(--theme-border-subtle)",
            }}
            className="p-2 rounded-xl border flex items-center gap-2 min-w-0"
          >
            <div className="relative shrink-0">
              <img
                src={
                  profile.photoURL && !profile.photoURL.includes("bottts")
                    ? profile.photoURL
                    : `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(
                        profile.username || "Guest"
                      )}`
                }
                alt={profile.username || "User"}
                className="w-7 h-7 rounded-lg object-cover border border-[var(--theme-border)]"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-neutral-900" />
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate leading-tight">
                  @{profile.username || "Guest"}
                </p>
                <p className="text-[10px] font-mono text-neutral-400 truncate leading-tight">
                  {myTag}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
});

export default Sidebar;
