import React, { useState, useRef, useEffect, useMemo } from "react";
import { useCall, CallUser } from "../context/CallContext";
import {
  Phone,
  Video,
  Users,
  User,
  Music,
  Volume2,
  Headphones,
  Search,
  X,
  Sparkles,
  Gamepad2,
  BookOpen,
  UserCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { getSavedProfile } from "../lib/activity-tracker";
import { getAllRingtones, getSavedRingtone } from "../lib/ringtone-synthesizer";

interface CallMenuDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings?: () => void;
}

export default function CallMenuDropdown({ isOpen, onClose, onOpenSettings }: CallMenuDropdownProps) {
  const { onlineUsers, voiceUserCount, startDirectCall, joinGeneralVoice } = useCall();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const myProfile = getSavedProfile();
  const [searchQuery, setSearchQuery] = useState("");

  const [ringtoneState, setRingtoneState] = useState(() => {
    const saved = getSavedRingtone();
    const all = getAllRingtones();
    return all.find((r) => r.id === saved) || all[0];
  });

  useEffect(() => {
    const updateRingtone = () => {
      const saved = getSavedRingtone();
      const all = getAllRingtones();
      setRingtoneState(all.find((r) => r.id === saved) || all[0]);
    };
    window.addEventListener("ringtone_changed", updateRingtone);
    window.addEventListener("ringtone_list_updated", updateRingtone);
    updateRingtone();
    return () => {
      window.removeEventListener("ringtone_changed", updateRingtone);
      window.removeEventListener("ringtone_list_updated", updateRingtone);
    };
  }, [isOpen]);

  const currentRingtone = ringtoneState;

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  // Filter users by search
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return onlineUsers;
    const q = searchQuery.toLowerCase().trim();
    return onlineUsers.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        (u.activity?.gameName || "").toLowerCase().includes(q) ||
        (u.activity?.details || "").toLowerCase().includes(q)
    );
  }, [onlineUsers, searchQuery]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        id="header-call-dropdown"
        initial={{ opacity: 0, y: 8, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.96 }}
        transition={{ duration: 0.16 }}
        className="absolute top-full right-0 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 mt-2 w-84 sm:w-96 rounded-2xl border border-white/15 bg-neutral-900/95 text-white shadow-2xl backdrop-blur-xl z-50 overflow-hidden"
        style={{
          boxShadow: "0 20px 50px -10px rgba(0, 0, 0, 0.7), 0 0 25px rgba(16, 185, 129, 0.12)",
        }}
      >
        {/* Phone Header */}
        <div className="p-3.5 px-4 border-b border-white/10 flex items-center justify-between bg-neutral-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center">
              <Phone size={15} className="text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight leading-none">Phone</h3>
              <p className="text-[11px] text-neutral-400 mt-1 flex items-center gap-1.5 leading-none">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>{myProfile?.username ? `${myProfile.username} • Available` : "Available"}</span>
              </p>
            </div>
          </div>

          {onOpenSettings && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenSettings();
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white text-[11px] transition-colors cursor-pointer"
              title="Customize Incoming Call Ringtone"
            >
              <Music size={12} className="text-emerald-400" />
              <span>Ringtone</span>
            </button>
          )}
        </div>

        {/* Scrollable Content */}
        <div className="max-h-[420px] overflow-y-auto p-3 space-y-3.5">
          {/* GENERAL VOICE CHANNEL CARD */}
          <div className="p-3.5 rounded-2xl border border-emerald-500/25 bg-gradient-to-b from-emerald-500/10 to-transparent hover:border-emerald-500/40 transition-all shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                  <Volume2 size={18} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-xs font-bold text-white">General Voice</h4>
                    {voiceUserCount > 0 ? (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                        <span>{voiceUserCount} Connected</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-neutral-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                        Voice Lounge
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-0.5 truncate">
                    Join voice, video & screen share with everyone
                  </p>
                </div>
              </div>
            </div>

            <button
              id="join-general-voice-btn"
              type="button"
              onClick={() => {
                onClose();
                joinGeneralVoice();
              }}
              className="mt-3 w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white transition-all cursor-pointer shadow-sm shadow-emerald-950/40 hover:scale-[1.01] active:scale-[0.99]"
            >
              <Headphones size={13} />
              <span>Join General Voice</span>
            </button>
          </div>

          {/* CONTACTS / CALL PEOPLE SECTION */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-neutral-300 tracking-wide">
                Contacts ({onlineUsers.length})
              </span>
              {onlineUsers.length > 0 && (
                <span className="text-[10px] text-emerald-400 font-medium">
                  {onlineUsers.length} Online
                </span>
              )}
            </div>

            {/* Search Input if multiple users online */}
            {onlineUsers.length > 3 && (
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search contacts..."
                  className="w-full pl-8 pr-7 py-1.5 text-xs bg-white/5 border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            )}

            {/* Contact List */}
            {onlineUsers.length === 0 ? (
              <div className="p-4 rounded-xl border border-white/5 bg-black/20 text-center space-y-2">
                <div className="w-9 h-9 rounded-full bg-white/5 text-neutral-400 flex items-center justify-center mx-auto">
                  <User size={16} />
                </div>
                <p className="text-xs text-neutral-300 font-medium">No contacts online right now</p>
                <p className="text-[11px] text-neutral-500 leading-relaxed max-w-xs mx-auto">
                  When other people open the app, they appear here for direct voice and video calls.
                </p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-3 text-center text-xs text-neutral-400">
                No contacts match &ldquo;{searchQuery}&rdquo;
              </div>
            ) : (
              <div className="space-y-1.5">
                {filteredUsers.map((user) => {
                  const activityLabel =
                    user.activity?.details ||
                    (user.activity?.state === "playing"
                      ? `Playing ${user.activity.gameName || "Games"}`
                      : "Active now");

                  return (
                    <div
                      key={user.uid}
                      id={`contact-row-${user.uid}`}
                      className="p-2.5 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-between gap-2 group"
                    >
                      {/* Avatar and Contact Info */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative w-8 h-8 rounded-full overflow-hidden border border-white/20 bg-neutral-800 shrink-0">
                          <img
                            src={
                              user.photoURL ||
                              `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.username)}`
                            }
                            alt={user.username}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-400 border border-neutral-900" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate group-hover:text-emerald-300 transition-colors" title={user.username}>
                            {user.username}
                          </p>
                          <p className="text-[10px] text-neutral-400 truncate flex items-center gap-1 mt-0.5">
                            {user.activity?.state === "playing" ? (
                              <Gamepad2 size={10} className="text-emerald-400 shrink-0" />
                            ) : (
                              <BookOpen size={10} className="text-blue-400 shrink-0" />
                            )}
                            <span className="truncate">{activityLabel}</span>
                          </p>
                        </div>
                      </div>

                      {/* Phone App Style Call Buttons: Audio & Video */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          id={`call-audio-${user.uid}`}
                          type="button"
                          onClick={() => {
                            onClose();
                            startDirectCall(user, "audio");
                          }}
                          className="w-8 h-8 rounded-full flex items-center justify-center bg-emerald-600/25 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-sm"
                          title={`Audio call ${user.username}`}
                        >
                          <Phone size={13} />
                        </button>

                        <button
                          id={`call-video-${user.uid}`}
                          type="button"
                          onClick={() => {
                            onClose();
                            startDirectCall(user, "video");
                          }}
                          className="w-8 h-8 rounded-full flex items-center justify-center bg-blue-600/25 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30 transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-sm"
                          title={`Video call ${user.username}`}
                        >
                          <Video size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer info: Selected Ringtone */}
        <div className="p-2.5 px-3.5 bg-neutral-950/60 border-t border-white/10 text-[10px] text-neutral-400 flex items-center justify-between">
          <span className="flex items-center gap-1.5 truncate">
            <Music size={11} className="text-emerald-400 shrink-0" />
            <span className="truncate">Ringtone: <b className="text-neutral-200">{currentRingtone.name}</b></span>
          </span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
