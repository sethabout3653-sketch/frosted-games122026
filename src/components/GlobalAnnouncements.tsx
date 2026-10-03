import React, { useState, useEffect, useRef } from "react";
import { Megaphone, X, AlertTriangle, ShieldAlert, Sparkles, Volume2, Clock, CheckCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { db, doc, onSnapshot, toTimestampMs } from "../supabase-adapter";
import { subscribeBroadcastSignals } from "../lib/database";
import { getSavedProfile } from "../lib/activity-tracker";
import { wsClient } from "../lib/websocket-client";

interface AnnouncementData {
  id?: string;
  text: string;
  moderator?: string;
  timestamp?: number;
  active?: boolean;
}

interface WarningData {
  id?: string;
  moderator: string;
  reason: string;
  timestamp: number;
}

interface ModerationActionData {
  type: "kick" | "ban" | "mute";
  bannedBy?: string;
  moderator?: string;
  reason?: string;
  banUntil?: number;
  expiresAt?: number;
  timestamp?: number;
}

export default function GlobalAnnouncements() {
  const [announcement, setAnnouncement] = useState<AnnouncementData | null>(null);
  const [dismissedAnnIds, setDismissedAnnIds] = useState<Set<string>>(() => {
    try {
      const saved = sessionStorage.getItem("frosted_dismissed_announcements");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const [activeWarning, setActiveWarning] = useState<WarningData | null>(null);
  const [activeAction, setActiveAction] = useState<ModerationActionData | null>(null);
  const [myProfile, setMyProfile] = useState(() => getSavedProfile());
  const soundRef = useRef<HTMLAudioElement | null>(null);

  // Keep profile synchronized
  useEffect(() => {
    const handleProfileUpdate = () => {
      setMyProfile(getSavedProfile());
    };
    window.addEventListener("frosted_profile_updated", handleProfileUpdate);
    window.addEventListener("storage", handleProfileUpdate);
    return () => {
      window.removeEventListener("frosted_profile_updated", handleProfileUpdate);
      window.removeEventListener("storage", handleProfileUpdate);
    };
  }, []);

  const playNotificationSound = () => {
    try {
      if (!soundRef.current) {
        soundRef.current = new Audio("/audio/discord-join.mp3");
      }
      soundRef.current.currentTime = 0;
      soundRef.current.volume = 0.65;
      soundRef.current.play().catch(() => {});
    } catch (e) {}
  };

  // 1. Listen for global announcement document in real-time
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "announcements", "global"), (snap: any) => {
      const exists = typeof snap?.exists === "function" ? snap.exists() : !!snap?.exists;
      if (exists) {
        const data = typeof snap.data === "function" ? snap.data() : (snap.data || snap);
        if (data && data.text && data.active !== false) {
          const annId = data.id || `ann_${data.timestamp || ""}_${data.text.slice(0, 15)}`;
          if (!dismissedAnnIds.has(annId)) {
            setAnnouncement({
              id: annId,
              text: data.text,
              moderator: data.moderator || "Community Staff",
              timestamp: toTimestampMs(data.timestamp),
              active: true,
            });
          }
        } else {
          setAnnouncement(null);
        }
      } else {
        setAnnouncement(null);
      }
    });

    return () => unsub();
  }, [dismissedAnnIds]);

  // 2. Real-time WebSocket and Broadcast Signals for Announcements & Targeted Mod Actions
  useEffect(() => {
    const currentProf = myProfile || getSavedProfile();
    const myUid = currentProf?.uid || "";
    const myUsername = (currentProf?.username || "").trim().toLowerCase();

    const unsub = subscribeBroadcastSignals(myUid || "all", (sig: any) => {
      if (!sig || !sig.type) return;

      // Handle Global Announcements across any page
      if (sig.type === "mod_announcement") {
        const annId = sig.id || `ann_${sig.timestamp || Date.now()}_${(sig.text || "").slice(0, 15)}`;
        setAnnouncement({
          id: annId,
          text: sig.text || sig.message || "",
          moderator: sig.moderator || "Staff",
          timestamp: sig.timestamp || Date.now(),
          active: true,
        });
        playNotificationSound();
      }

      // Handle clearing announcements
      if (sig.type === "mod_announcement_cleared" || sig.type === "clear_announcement") {
        setAnnouncement(null);
      }

      // Handle Targeted Warnings
      if (sig.type === "warning") {
        const targetUid = String(sig.targetUid || "").trim();
        const targetUser = String(sig.targetUsername || "").trim().toLowerCase();

        const isForMe =
          (myUid && (targetUid === myUid || targetUid.split("_tab_")[0] === myUid.split("_tab_")[0])) ||
          (myUsername && targetUser === myUsername);

        if (isForMe) {
          setActiveWarning({
            id: sig.id || `warn_${Date.now()}`,
            moderator: sig.moderator || "Moderator",
            reason: sig.reason || "Violating community guidelines",
            timestamp: sig.timestamp || Date.now(),
          });
          playNotificationSound();
        }
      }

      // Handle Targeted Kicks and Bans
      if (sig.type === "moderation_action") {
        const targetUid = String(sig.targetUid || "").trim();
        const targetUser = String(sig.targetUsername || "").trim().toLowerCase();

        const isForMe =
          (myUid && (targetUid === myUid || targetUid.split("_tab_")[0] === myUid.split("_tab_")[0])) ||
          (myUsername && targetUser === myUsername);

        if (isForMe) {
          setActiveAction({
            type: sig.action || "kick",
            bannedBy: sig.bannedBy || "Moderator",
            reason: sig.reason || "Action taken by moderator",
            banUntil: sig.banUntil,
            expiresAt: sig.expiresAt,
            timestamp: sig.timestamp || Date.now(),
          });
          playNotificationSound();
        }
      }
    });

    return () => unsub();
  }, [myProfile?.uid, myProfile?.username]);

  // 3. Persistent listener for targeted moderation actions on this UID
  useEffect(() => {
    const currentProf = myProfile || getSavedProfile();
    const myUid = currentProf?.uid;
    if (!myUid) return;

    const unsub = onSnapshot(doc(db, "moderation_actions", myUid), (snap: any) => {
      const exists = typeof snap?.exists === "function" ? snap.exists() : !!snap?.exists;
      if (exists) {
        const data = typeof snap.data === "function" ? snap.data() : (snap.data || snap);
        if (data && (data.type === "kick" || data.type === "ban")) {
          setActiveAction({
            type: data.type,
            bannedBy: data.bannedBy || "Moderator",
            reason: data.reason || "Administrative action",
            banUntil: data.banUntil,
            timestamp: data.timestamp || Date.now(),
          });
        }
      } else {
        setActiveAction(null);
      }
    });

    return () => unsub();
  }, [myProfile?.uid]);

  const handleDismissAnnouncement = () => {
    if (announcement?.id) {
      setDismissedAnnIds((prev) => {
        const next = new Set(prev).add(announcement.id!);
        try {
          sessionStorage.setItem("frosted_dismissed_announcements", JSON.stringify(Array.from(next)));
        } catch {}
        return next;
      });
    }
    setAnnouncement(null);
  };

  return (
    <>
      {/* 📣 1. GLOBAL SYSTEM ANNOUNCEMENT BANNER (Visible across EVERY page) */}
      <AnimatePresence>
        {announcement && announcement.text && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -40, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-3 inset-x-3 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-[9999] max-w-2xl w-full pointer-events-auto"
          >
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-950/95 via-[#0b1236]/95 to-purple-950/95 border border-indigo-500/40 p-4 sm:p-4.5 shadow-[0_12px_40px_rgba(0,0,0,0.8),0_0_24px_rgba(99,102,241,0.25)] backdrop-blur-2xl text-white">
              {/* Animated glow background beam */}
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-purple-500/15 to-pink-500/10 animate-pulse pointer-events-none" />

              <div className="relative flex items-start gap-3.5">
                {/* Megaphone Icon */}
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/30 text-white">
                  <Megaphone size={20} className="animate-bounce" />
                </div>

                {/* Announcement Content */}
                <div className="flex-1 min-w-0 pr-6">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      Live Global Announcement
                    </span>
                    <span className="text-xs text-neutral-300 font-semibold">
                      from <span className="text-indigo-200 underline decoration-indigo-400/50">@{announcement.moderator}</span>
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-neutral-100 font-medium leading-relaxed break-words selection:bg-indigo-500 selection:text-white">
                    {announcement.text}
                  </p>
                </div>

                {/* Dismiss Button */}
                <button
                  type="button"
                  onClick={handleDismissAnnouncement}
                  className="absolute top-0 right-0 p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                  title="Dismiss announcement"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ⚠️ 2. TARGETED USER WARNING MODAL (Pops up anywhere on the site) */}
      <AnimatePresence>
        {activeWarning && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="max-w-md w-full rounded-3xl bg-[#0e122b] border border-amber-500/40 p-6 shadow-2xl shadow-amber-950/60 text-white space-y-5"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <AlertTriangle size={26} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">Official Moderator Warning</h3>
                  <p className="text-xs text-amber-300 font-medium">Issued by @{activeWarning.moderator}</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-2">
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-neutral-400">Note from staff:</span>
                <p className="text-sm text-neutral-200 leading-relaxed italic">
                  &ldquo;{activeWarning.reason}&rdquo;
                </p>
              </div>

              <p className="text-xs text-neutral-400">
                Please follow all community rules and guidelines to avoid mutes or permanent bans.
              </p>

              <button
                type="button"
                onClick={() => setActiveWarning(null)}
                className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-bold text-sm transition-all cursor-pointer shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
              >
                <CheckCircle size={16} />
                <span>I Understand</span>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ⛔ 3. TARGETED KICK OR BAN FULLSCREEN NOTICE */}
      <AnimatePresence>
        {activeAction && (
          <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 animate-in fade-in">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="max-w-lg w-full rounded-3xl bg-[#0b0e24] border border-red-500/50 p-6 sm:p-8 shadow-2xl shadow-red-950/80 text-white space-y-6 text-center"
            >
              <div className="w-16 h-16 mx-auto rounded-3xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 shadow-xl shadow-red-500/20">
                <ShieldAlert size={34} />
              </div>

              <div className="space-y-1.5">
                <h2 className="text-2xl font-black tracking-tight text-white">
                  {activeAction.type === "ban" ? "Account Suspended" : "Removed From Session"}
                </h2>
                <p className="text-xs text-neutral-400">
                  Administrative action applied by @{activeAction.bannedBy || "Staff"}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-black/50 border border-red-500/20 text-left space-y-1.5">
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-red-400">Reason provided:</span>
                <p className="text-sm text-neutral-200 leading-relaxed font-medium">
                  {activeAction.reason || "Violation of community rules."}
                </p>
              </div>

              {activeAction.banUntil && activeAction.banUntil !== -1 && (
                <div className="flex items-center justify-center gap-2 text-xs font-mono text-neutral-300">
                  <Clock size={14} className="text-neutral-400" />
                  <span>Expires at: {new Date(activeAction.banUntil).toLocaleTimeString()}</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  window.location.reload();
                }}
                className="w-full py-3.5 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs transition-colors cursor-pointer"
              >
                Refresh Session
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
