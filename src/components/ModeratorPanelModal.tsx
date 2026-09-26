import React, { useState, useEffect, useMemo } from "react";
import {
  ShieldAlert,
  X,
  Search,
  Ban,
  Unlock,
  VolumeX,
  AlertTriangle,
  Clock,
  Trash2,
  Lock,
  MessageSquare,
  ListFilter,
  Check,
  User,
  Plus,
  RefreshCw,
  Sparkles,
  Zap,
  Cpu,
  Video,
  Image as ImageIcon,
  Volume2,
  ShieldCheck,
  CheckCircle2,
  AlertOctagon,
  ArrowRight,
  FileCode,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { db, doc, setDoc, deleteDoc, collection, onSnapshot, getDocs, query, limit, orderBy } from "../supabase-adapter";
import { sendBroadcastSignal } from "../lib/database";
import { wsClient } from "../lib/websocket-client";
import { MemberUser, ChatMessage } from "../types";

interface ModeratorPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: { uid: string; username: string; photoURL: string };
  onlineUsers: MemberUser[];
  bannedList: any[];
  onUnbanUser: (target: string) => Promise<void>;
  onPurgeMessages?: (count: number) => Promise<void>;
  onToggleChatLock?: (locked: boolean) => void;
  isChatLocked?: boolean;
  slowmodeCooldown?: number;
  onSetSlowmode?: (seconds: number) => void;
}

type ModTab = "members" | "banned" | "chat_controls" | "blacklist" | "ai_moderation" | "audit_log";

export default function ModeratorPanelModal({
  isOpen,
  onClose,
  profile,
  onlineUsers,
  bannedList,
  onUnbanUser,
  onPurgeMessages,
  onToggleChatLock,
  isChatLocked = false,
  slowmodeCooldown = 0,
  onSetSlowmode,
}: ModeratorPanelModalProps) {
  const [activeTab, setActiveTab] = useState<ModTab>("members");
  const [userSearch, setUserSearch] = useState("");
  const [bannedSearch, setBannedSearch] = useState("");
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [blacklistedWords, setBlacklistedWords] = useState<string[]>([]);
  const [newBlacklistWord, setNewBlacklistWord] = useState("");
  const [announcementText, setAnnouncementText] = useState("");

  // Target action modal state
  const [selectedUser, setSelectedUser] = useState<MemberUser | null>(null);
  const [actionType, setActionType] = useState<"mute" | "warn" | "kick" | "ban">("mute");
  const [actionReason, setActionReason] = useState("");
  const [muteDuration, setMuteDuration] = useState(15 * 60 * 1000); // 15 mins
  const [banDuration, setBanDuration] = useState(24 * 60 * 60 * 1000); // 24 hours

  // AI Moderation test state
  const [aiTestType, setAiTestType] = useState<"text" | "image" | "audio" | "video">("text");
  const [aiTestContent, setAiTestContent] = useState("");
  const [aiTestRunning, setAiTestRunning] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<any>(null);
  const [moderationModels, setModerationModels] = useState<any>(null);

  // Feedback notifications
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  // Fetch moderation models info
  useEffect(() => {
    if (activeTab === "ai_moderation") {
      fetch("/api/moderation/models")
        .then((r) => r.json())
        .then((data) => setModerationModels(data))
        .catch(() => {});
    }
  }, [activeTab]);

  const handleRunAiTest = async () => {
    if (!aiTestContent.trim()) {
      showToast("Please enter text or a media link to inspect", "error");
      return;
    }
    setAiTestRunning(true);
    setAiTestResult(null);
    try {
      const res = await fetch("/api/moderation/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: aiTestType,
          content: aiTestContent.trim(),
        }),
      });
      const data = await res.json();
      setAiTestResult(data);
    } catch (err: any) {
      setAiTestResult({ safe: false, error: err?.message || "Failed to execute moderation test" });
    } finally {
      setAiTestRunning(false);
    }
  };

  // Fetch blacklisted words and audit logs in real time
  useEffect(() => {
    if (!isOpen) return;

    // Listen to audit logs
    const unsubAudit = onSnapshot(
      query(collection(db, "mod_audit_logs"), orderBy("timestamp", "desc"), limit(50)),
      (snapshot: any) => {
        const logs = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
        setAuditLogs(logs);
      },
      () => {}
    );

    // Listen to custom word blacklist
    const unsubBlacklist = onSnapshot(
      collection(db, "mod_blacklist_words"),
      (snapshot: any) => {
        const words = snapshot.docs.map((d: any) => d.data()?.word).filter(Boolean);
        setBlacklistedWords(words);
      },
      () => {}
    );

    return () => {
      unsubAudit();
      unsubBlacklist();
    };
  }, [isOpen]);

  const recordAuditLog = async (actionName: string, targetName: string, details: string) => {
    try {
      const logId = "log_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
      await setDoc(doc(db, "mod_audit_logs", logId), {
        id: logId,
        moderator: profile.username,
        action: actionName,
        target: targetName,
        details,
        timestamp: Date.now(),
      });
    } catch (e) {}
  };

  const handleApplyUserAction = async () => {
    if (!selectedUser) return;
    if (!actionReason.trim()) {
      showToast("Please include a brief note explaining the action", "error");
      return;
    }

    const targetUid = selectedUser.uid;
    const targetUsername = selectedUser.username;
    const now = Date.now();

    try {
      if (actionType === "warn") {
        const warnPayload = {
          type: "warning",
          targetUid,
          targetUsername,
          moderator: profile.username,
          reason: actionReason.trim(),
          timestamp: now,
        };

        const warnId = "warn_" + now + "_" + Math.random().toString(36).substring(2, 6);
        await setDoc(doc(db, "user_warnings", warnId), warnPayload);
        wsClient.sendChange("set", "user_warnings", warnId, warnPayload);

        // Real-time broadcast signal
        sendBroadcastSignal(warnPayload);
        try {
          wsClient.sendSignal(warnPayload);
        } catch (e) {}

        await recordAuditLog("Warning Issued", targetUsername, actionReason.trim());
        showToast(`Warning sent to @${targetUsername}`);
      } else if (actionType === "mute") {
        const expiresAt = muteDuration === -1 ? -1 : now + muteDuration;
        const mutePayload = {
          type: "mute",
          targetUid,
          targetUsername,
          moderator: profile.username,
          reason: actionReason.trim(),
          expiresAt,
          timestamp: now,
        };

        await setDoc(doc(db, "user_mutes", targetUid), mutePayload);
        wsClient.sendChange("set", "user_mutes", targetUid, mutePayload);

        sendBroadcastSignal(mutePayload);
        try {
          wsClient.sendSignal(mutePayload);
        } catch (e) {}

        const durationLabel = muteDuration === -1 ? "Permanent" : `${Math.round(muteDuration / 60000)}m`;
        await recordAuditLog(`Muted (${durationLabel})`, targetUsername, actionReason.trim());
        showToast(`Muted @${targetUsername} for ${durationLabel}`);
      } else if (actionType === "kick") {
        const kickPayload = {
          targetUid,
          targetUsername,
          bannedBy: profile.username,
          reason: actionReason.trim(),
          timestamp: now,
        };

        await setDoc(doc(db, "moderation_actions", targetUid), { type: "kick", ...kickPayload });
        wsClient.sendChange("set", "moderation_actions", targetUid, { type: "kick", ...kickPayload });
        if (targetUsername) {
          await setDoc(doc(db, "moderation_banned_names", targetUsername.trim().toLowerCase()), { type: "kick", ...kickPayload });
          wsClient.sendChange("set", "moderation_banned_names", targetUsername.trim().toLowerCase(), { type: "kick", ...kickPayload });
        }

        const signalPayload = { type: "moderation_action", action: "kick", ...kickPayload };
        sendBroadcastSignal(signalPayload);
        try {
          wsClient.sendSignal(signalPayload);
        } catch (e) {}

        await recordAuditLog("Kicked User", targetUsername, actionReason.trim());
        showToast(`Kicked @${targetUsername} from the session`);
      } else if (actionType === "ban") {
        const banUntil = banDuration === -1 ? -1 : now + banDuration;
        const banPayload = {
          targetUid,
          targetUsername,
          bannedBy: profile.username,
          reason: actionReason.trim(),
          banUntil,
          timestamp: now,
        };

        await setDoc(doc(db, "banned_users", targetUid), { type: "ban", ...banPayload });
        wsClient.sendChange("set", "banned_users", targetUid, { type: "ban", ...banPayload });
        await setDoc(doc(db, "moderation_actions", targetUid), { type: "ban", ...banPayload });
        wsClient.sendChange("set", "moderation_actions", targetUid, { type: "ban", ...banPayload });
        if (targetUsername) {
          await setDoc(doc(db, "moderation_banned_names", targetUsername.trim().toLowerCase()), { type: "ban", ...banPayload });
          wsClient.sendChange("set", "moderation_banned_names", targetUsername.trim().toLowerCase(), { type: "ban", ...banPayload });
        }

        const signalPayload = { type: "moderation_action", action: "ban", ...banPayload };
        sendBroadcastSignal(signalPayload);
        try {
          wsClient.sendSignal(signalPayload);
        } catch (e) {}

        const durationLabel = banDuration === -1 ? "Permanent" : `${Math.round(banDuration / 3600000)}h`;
        await recordAuditLog(`Banned (${durationLabel})`, targetUsername, actionReason.trim());
        showToast(`Banned @${targetUsername} (${durationLabel})`);
      }

      setSelectedUser(null);
      setActionReason("");
    } catch (err: any) {
      showToast(err?.message || "Failed to execute moderation action", "error");
    }
  };

  const handleAddBlacklistWord = async (e: React.FormEvent) => {
    e.preventDefault();
    const word = newBlacklistWord.trim().toLowerCase();
    if (!word) return;

    if (blacklistedWords.includes(word)) {
      showToast("Word is already on the blacklist", "error");
      return;
    }

    try {
      const wordId = word.replace(/[^a-z0-9]/g, "_");
      const wordPayload = {
        word,
        addedBy: profile.username,
        timestamp: Date.now(),
      };
      await setDoc(doc(db, "mod_blacklist_words", wordId), wordPayload);
      wsClient.sendChange("set", "mod_blacklist_words", wordId, wordPayload);
      await recordAuditLog("Added Blacklisted Word", word, `Word: "${word}"`);
      setNewBlacklistWord("");
      showToast(`Added "${word}" to auto-mod blacklist`);
    } catch (err) {
      showToast("Could not add word to blacklist", "error");
    }
  };

  const handleRemoveBlacklistWord = async (word: string) => {
    try {
      const wordId = word.replace(/[^a-z0-9]/g, "_");
      await deleteDoc(doc(db, "mod_blacklist_words", wordId));
      wsClient.sendChange("delete", "mod_blacklist_words", wordId);
      await recordAuditLog("Removed Blacklisted Word", word, `Word: "${word}"`);
      showToast(`Removed "${word}" from blacklist`);
    } catch (err) {
      showToast("Could not remove word", "error");
    }
  };

  const filteredMembers = useMemo(() => {
    if (!userSearch.trim()) return onlineUsers;
    const q = userSearch.toLowerCase();
    return onlineUsers.filter((u) => u.username.toLowerCase().includes(q) || u.uid.toLowerCase().includes(q));
  }, [onlineUsers, userSearch]);

  const filteredBanned = useMemo(() => {
    if (!bannedSearch.trim()) return bannedList;
    const q = bannedSearch.toLowerCase();
    return bannedList.filter(
      (b) =>
        (b.username || b.targetUsername || "").toLowerCase().includes(q) ||
        (b.uid || b.targetUid || b.id || "").toLowerCase().includes(q)
    );
  }, [bannedList, bannedSearch]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-4xl bg-[#0b0e1e] border border-red-500/25 rounded-2xl text-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="px-5 py-4 bg-gradient-to-r from-red-950/80 via-[#121630] to-indigo-950/80 border-b border-red-500/20 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400 shadow-md">
                <ShieldAlert size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-extrabold text-white tracking-tight">Community Moderator Suite</h2>
                  <span className="bg-red-950 text-red-300 border border-red-800/60 text-[9px] font-mono font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    MOD PASS
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Logged in as <span className="text-white font-bold">{profile.username}</span> • Live Real-time Chat Enforcement
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Toast Notification */}
          <AnimatePresence>
            {feedbackMsg && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`mx-5 mt-3 p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                  feedbackMsg.type === "success"
                    ? "bg-emerald-950/80 border-emerald-500/40 text-emerald-200"
                    : "bg-red-950/80 border-red-500/40 text-red-200"
                }`}
              >
                {feedbackMsg.type === "success" ? <Check size={15} className="text-emerald-400" /> : <AlertTriangle size={15} className="text-red-400" />}
                <span>{feedbackMsg.text}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation Tabs */}
          <div className="px-5 pt-3 border-b border-white/10 flex items-center gap-2 overflow-x-auto shrink-0 bg-[#070914]">
            <button
              type="button"
              onClick={() => setActiveTab("members")}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "members"
                  ? "border-red-500 text-white bg-white/5 rounded-t-xl"
                  : "border-transparent text-neutral-400 hover:text-white hover:bg-white/[0.02]"
              }`}
            >
              <User size={14} className={activeTab === "members" ? "text-red-400" : ""} />
              <span>Members ({onlineUsers.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("banned")}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "banned"
                  ? "border-red-500 text-white bg-white/5 rounded-t-xl"
                  : "border-transparent text-neutral-400 hover:text-white hover:bg-white/[0.02]"
              }`}
            >
              <Ban size={14} className={activeTab === "banned" ? "text-red-400" : ""} />
              <span>Banned ({bannedList.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("chat_controls")}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "chat_controls"
                  ? "border-red-500 text-white bg-white/5 rounded-t-xl"
                  : "border-transparent text-neutral-400 hover:text-white hover:bg-white/[0.02]"
              }`}
            >
              <Zap size={14} className={activeTab === "chat_controls" ? "text-amber-400" : ""} />
              <span>Chat Controls</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("blacklist")}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "blacklist"
                  ? "border-red-500 text-white bg-white/5 rounded-t-xl"
                  : "border-transparent text-neutral-400 hover:text-white hover:bg-white/[0.02]"
              }`}
            >
              <ListFilter size={14} className={activeTab === "blacklist" ? "text-red-400" : ""} />
              <span>Auto-Mod Words ({blacklistedWords.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("ai_moderation")}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "ai_moderation"
                  ? "border-emerald-500 text-white bg-emerald-950/20 rounded-t-xl"
                  : "border-transparent text-neutral-400 hover:text-white hover:bg-white/[0.02]"
              }`}
            >
              <Cpu size={14} className={activeTab === "ai_moderation" ? "text-emerald-400" : "text-neutral-400"} />
              <span className="flex items-center gap-1.5">
                <span>AI Moderation</span>
                <span className="px-1.5 py-0.2 bg-emerald-500/20 border border-emerald-500/40 text-[9px] font-mono text-emerald-300 rounded font-bold">
                  OPENROUTER
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("audit_log")}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "audit_log"
                  ? "border-red-500 text-white bg-white/5 rounded-t-xl"
                  : "border-transparent text-neutral-400 hover:text-white hover:bg-white/[0.02]"
              }`}
            >
              <Clock size={14} className={activeTab === "audit_log" ? "text-indigo-400" : ""} />
              <span>Audit Log</span>
            </button>
          </div>

          {/* Main Content Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-[320px]">
            {/* 1. MEMBERS TAB */}
            {activeTab === "members" && (
              <div className="space-y-3">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search online members by name or UID..."
                    className="w-full bg-[#080b1a] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {filteredMembers.map((member) => {
                    const isSelf = member.uid === profile.uid;

                    return (
                      <div
                        key={member.uid}
                        className="p-3 rounded-xl bg-[#080b1a] border border-white/5 hover:border-white/15 transition-all flex items-center justify-between gap-3 group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative w-9 h-9 rounded-full overflow-hidden bg-neutral-800 border border-white/20 shrink-0">
                            {member.photoURL ? (
                              <img src={member.photoURL} alt={member.username} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center font-bold text-xs bg-indigo-900 text-white">
                                {member.username.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#080b1a]" />
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-white truncate">{member.username}</span>
                              {isSelf && <span className="bg-indigo-950 text-indigo-300 border border-indigo-700/60 text-[8px] font-extrabold px-1.5 py-0.2 rounded uppercase">YOU</span>}
                            </div>
                            <p className="text-[10px] text-neutral-400 truncate mt-0.5">
                              {member.activity?.text || "Active in community"}
                            </p>
                          </div>
                        </div>

                        {!isSelf && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedUser(member);
                              setActionType("mute");
                              setActionReason("");
                            }}
                            className="px-3 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/80 border border-red-800/60 text-red-200 text-xs font-bold transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm flex items-center gap-1"
                          >
                            <ShieldAlert size={12} />
                            <span>Moderate</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. BANNED USERS TAB */}
            {activeTab === "banned" && (
              <div className="space-y-3">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="text"
                    value={bannedSearch}
                    onChange={(e) => setBannedSearch(e.target.value)}
                    placeholder="Search banned accounts..."
                    className="w-full bg-[#080b1a] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
                  />
                </div>

                {filteredBanned.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
                    <Check size={28} className="text-emerald-400 mx-auto mb-2" />
                    <p className="text-xs font-bold text-neutral-300">No Banned Users</p>
                    <p className="text-[11px] text-neutral-500 mt-1">Everyone currently has full active access.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredBanned.map((bUser, idx) => {
                      const targetName = bUser.username || bUser.targetUsername || "User";
                      const targetId = bUser.uid || bUser.targetUid || bUser.id;
                      const isPerm = bUser.banUntil === -1;
                      const expiryText = isPerm ? "Permanent" : `Expires ${new Date(bUser.banUntil).toLocaleTimeString()}`;

                      return (
                        <div
                          key={`ban-${targetId}-${idx}`}
                          className="p-3.5 rounded-xl bg-[#080b1a] border border-red-950 hover:border-red-900/60 flex items-center justify-between gap-3 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-red-950/80 border border-red-700/60 flex items-center justify-center text-red-400 font-bold text-xs shrink-0">
                              <Ban size={16} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-white truncate">{targetName}</span>
                                <span className="text-[10px] text-neutral-500 font-mono truncate">{targetId}</span>
                              </div>
                              <p className="text-[11px] text-red-300 mt-0.5 truncate">
                                Reason: {bUser.reason || "Violated guidelines"}
                              </p>
                              <p className="text-[10px] text-neutral-400 mt-0.5 flex items-center gap-1">
                                <Clock size={10} />
                                <span>{expiryText}</span>
                                {bUser.bannedBy && <span>• By @{bUser.bannedBy}</span>}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={async () => {
                              await onUnbanUser(targetId);
                              showToast(`Unbanned @${targetName}`);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all cursor-pointer flex items-center gap-1 shrink-0 shadow-sm active:scale-95"
                          >
                            <Unlock size={13} />
                            <span>Unban</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 3. CHAT CONTROLS TAB */}
            {activeTab === "chat_controls" && (
              <div className="space-y-4">
                {/* Slowmode Section */}
                <div className="p-4 rounded-xl bg-[#080b1a] border border-white/10 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock size={16} className="text-amber-400" />
                      <div>
                        <h4 className="text-xs font-bold text-white">Channel Slowmode Cooldown</h4>
                        <p className="text-[11px] text-neutral-400">Limits how frequently members can post messages</p>
                      </div>
                    </div>
                    {slowmodeCooldown > 0 && (
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                        {slowmodeCooldown}s Cooldown Active
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    {[0, 3, 5, 10, 30, 60].map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => {
                          if (onSetSlowmode) {
                            onSetSlowmode(sec);
                            recordAuditLog("Set Slowmode", "Channel", sec === 0 ? "Disabled" : `${sec} seconds`);
                            showToast(sec === 0 ? "Slowmode disabled" : `Slowmode set to ${sec}s`);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          slowmodeCooldown === sec
                            ? "bg-amber-500 text-black border-amber-400 shadow-md"
                            : "bg-white/5 border-white/10 hover:bg-white/10 text-neutral-300"
                        }`}
                      >
                        {sec === 0 ? "Off" : `${sec}s`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bulk Message Purge */}
                <div className="p-4 rounded-xl bg-[#080b1a] border border-white/10 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Trash2 size={16} className="text-red-400" />
                    <div>
                      <h4 className="text-xs font-bold text-white">Bulk Message Purge</h4>
                      <p className="text-[11px] text-neutral-400">Clears recent chat history in case of spam or unwanted messages</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    {[10, 25, 50, 100].map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={async () => {
                          if (confirm(`Are you sure you want to delete the last ${count} messages?`)) {
                            if (onPurgeMessages) {
                              await onPurgeMessages(count);
                              recordAuditLog("Purged Messages", "Channel", `Deleted ${count} messages`);
                              showToast(`Purged last ${count} messages`);
                            }
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl bg-red-950/60 hover:bg-red-900/80 border border-red-800/60 text-red-200 text-xs font-bold transition-all cursor-pointer active:scale-95 shadow-sm"
                      >
                        Delete Last {count}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Lock / Unlock Chat */}
                <div className="p-4 rounded-xl bg-[#080b1a] border border-white/10 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Lock size={16} className={isChatLocked ? "text-red-400" : "text-emerald-400"} />
                    <div>
                      <h4 className="text-xs font-bold text-white">Emergency Chat Lock</h4>
                      <p className="text-[11px] text-neutral-400">
                        {isChatLocked ? "Chat is currently locked for non-moderators" : "Pause all non-moderator chat postings"}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const nextState = !isChatLocked;
                      if (onToggleChatLock) {
                        onToggleChatLock(nextState);
                        recordAuditLog("Toggle Chat Lock", "Channel", nextState ? "Locked" : "Unlocked");
                        showToast(nextState ? "Chat locked for members" : "Chat unlocked");
                      }
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md active:scale-95 ${
                      isChatLocked
                        ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                        : "bg-red-600 hover:bg-red-500 text-white"
                    }`}
                  >
                    {isChatLocked ? "Unlock Chat" : "Lock Chat"}
                  </button>
                </div>

                {/* Broadcast System Announcement */}
                <div className="p-4 rounded-xl bg-[#080b1a] border border-white/10 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-indigo-400" />
                    <div>
                      <h4 className="text-xs font-bold text-white">Broadcast System Announcement</h4>
                      <p className="text-[11px] text-neutral-400">Sends an instant real-time banner alert to all connected members over WebSockets</p>
                    </div>
                  </div>

                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const text = announcementText.trim();
                      if (!text) return;

                      const annPayload = {
                        type: "mod_announcement",
                        text,
                        moderator: profile.username,
                        timestamp: Date.now(),
                      };

                      sendBroadcastSignal(annPayload);
                      try {
                        wsClient.sendSignal(annPayload);
                      } catch (err) {}

                      await recordAuditLog("Broadcast Announcement", "Community", text);
                      setAnnouncementText("");
                      showToast("Broadcast announcement sent to all members over WebSockets!");
                    }}
                    className="flex gap-2 pt-1"
                  >
                    <input
                      type="text"
                      value={announcementText}
                      onChange={(e) => setAnnouncementText(e.target.value)}
                      placeholder="Type announcement message to broadcast live..."
                      className="flex-1 bg-[#0f132a] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="submit"
                      disabled={!announcementText.trim()}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-xs transition-all cursor-pointer shadow-md active:scale-95 flex-shrink-0"
                    >
                      Broadcast
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* 4. AUTO-MOD BLACKLIST TAB */}
            {activeTab === "blacklist" && (
              <div className="space-y-4">
                <form onSubmit={handleAddBlacklistWord} className="flex gap-2">
                  <input
                    type="text"
                    value={newBlacklistWord}
                    onChange={(e) => setNewBlacklistWord(e.target.value)}
                    placeholder="Add forbidden word or phrase..."
                    className="flex-1 bg-[#080b1a] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
                  />
                  <button
                    type="submit"
                    disabled={!newBlacklistWord.trim()}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-md shrink-0"
                  >
                    <Plus size={14} />
                    <span>Add Word</span>
                  </button>
                </form>

                <div>
                  <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">
                    Active Blacklisted Words ({blacklistedWords.length})
                  </h4>

                  {blacklistedWords.length === 0 ? (
                    <div className="p-6 text-center border border-dashed border-white/10 rounded-xl text-neutral-500 text-xs">
                      No custom blacklisted words added yet.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto">
                      {blacklistedWords.map((word) => (
                        <span
                          key={word}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-red-950/70 border border-red-800/60 text-red-200 text-xs font-semibold"
                        >
                          <span>{word}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveBlacklistWord(word)}
                            className="hover:text-white cursor-pointer ml-1 text-red-400"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 5. AI MODERATION (OPENROUTER ENGINE) TAB */}
            {activeTab === "ai_moderation" && (
              <div className="space-y-4">
                {/* Header overview */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/50 via-[#0a1024] to-indigo-950/40 border border-emerald-500/30 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                      <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                        <span>OpenRouter Multi-Modal Moderation Engine</span>
                      </h4>
                    </div>
                    <p className="text-xs text-neutral-300 leading-relaxed">
                      Every medium is inspected with dedicated, specialized models via OpenRouter & multimodal AI pipelines.
                    </p>
                  </div>

                  <div className="shrink-0 flex items-center gap-2 bg-emerald-900/30 border border-emerald-500/30 px-3 py-1.5 rounded-xl text-emerald-300 text-xs font-mono font-bold">
                    <ShieldCheck size={16} className="text-emerald-400" />
                    <span>Active & Enforcing</span>
                  </div>
                </div>

                {/* Model Configuration Matrix */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* 1. Video Moderation */}
                  <div className="p-3.5 rounded-xl bg-[#080b1a] border border-white/10 hover:border-indigo-500/40 transition-all space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs">
                        <Video size={16} />
                        <span>VIDEO MODERATION MODEL</span>
                      </div>
                      <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-700/50 font-mono font-bold px-2 py-0.5 rounded-md">
                        VISION + OCR + AUDIO
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-mono font-bold text-white">google/gemini-2.0-flash-exp:free</div>
                      <div className="text-[11px] font-mono text-neutral-400">+ meta-llama/llama-3.2-11b-vision-instruct:free</div>
                      <div className="text-[11px] font-mono text-neutral-400">+ deepseek/deepseek-chat:free (timeline synthesis)</div>
                    </div>
                    <p className="text-[11px] text-neutral-400">
                      Samples multi-frame visual keyframes across the timeline, extracts & transcribes audio speech, and checks for nudity, gore, or prohibited acts.
                    </p>
                  </div>

                  {/* 2. Audio Moderation */}
                  <div className="p-3.5 rounded-xl bg-[#080b1a] border border-white/10 hover:border-amber-500/40 transition-all space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                        <Volume2 size={16} />
                        <span>AUDIO MODERATION MODEL</span>
                      </div>
                      <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-700/50 font-mono font-bold px-2 py-0.5 rounded-md">
                        ACOUSTICS + TEXT GUARD
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-mono font-bold text-white">meta-llama/llama-guard-3-8b</div>
                      <div className="text-[11px] font-mono text-neutral-400">+ spectrogram vision acoustics</div>
                      <div className="text-[11px] font-mono text-neutral-400">+ deterministic regex keyword guard</div>
                    </div>
                    <p className="text-[11px] text-neutral-400">
                      Transcribes spoken voice tracks, evaluates spoken slurs and vulgarity, and analyzes spectrogram frequencies for moaning and erotic sounds.
                    </p>
                  </div>

                  {/* 3. Image Moderation */}
                  <div className="p-3.5 rounded-xl bg-[#080b1a] border border-white/10 hover:border-emerald-500/40 transition-all space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                        <ImageIcon size={16} />
                        <span>IMAGE MODERATION MODEL</span>
                      </div>
                      <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-700/50 font-mono font-bold px-2 py-0.5 rounded-md">
                        MULTIMODAL VISION
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-mono font-bold text-white">google/gemini-2.0-flash-exp:free</div>
                      <div className="text-[11px] font-mono text-neutral-400">Fallback: meta-llama/llama-3.2-11b-vision-instruct:free</div>
                    </div>
                    <p className="text-[11px] text-neutral-400">
                      Evaluates static images, photos, artwork, and animated GIFs for nudity, sexual content, violence, hate symbols, and OCR overlays.
                    </p>
                  </div>

                  {/* 4. Text Moderation */}
                  <div className="p-3.5 rounded-xl bg-[#080b1a] border border-white/10 hover:border-red-500/40 transition-all space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-red-400 font-bold text-xs">
                        <MessageSquare size={16} />
                        <span>TEXT & CHAT MODERATION MODEL</span>
                      </div>
                      <span className="text-[10px] bg-red-950 text-red-300 border border-red-700/50 font-mono font-bold px-2 py-0.5 rounded-md">
                        OPENROUTER LLAMA GUARD
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-mono font-bold text-white">meta-llama/llama-guard-3-8b</div>
                      <div className="text-[11px] font-mono text-neutral-400">Fallback: meta-llama/llama-3.1-8b-instruct:free</div>
                    </div>
                    <p className="text-[11px] text-neutral-400">
                      Ultra-fast check on all live chat messages, usernames, and file titles against slurs, harassment, and disallowed profanity.
                    </p>
                  </div>
                </div>

                {/* Interactive Moderation Test Bench */}
                <div className="p-4 rounded-xl bg-[#080b1a] border border-white/10 space-y-3">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <h5 className="text-xs font-extrabold text-white flex items-center gap-2">
                      <Sparkles size={14} className="text-amber-400" />
                      <span>Live Moderation Test Bench</span>
                    </h5>
                    <span className="text-[10px] text-neutral-400">Test any text or media link with the respective OpenRouter model</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {(["text", "image", "audio", "video"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          setAiTestType(m);
                          setAiTestResult(null);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer ${
                          aiTestType === m
                            ? "bg-emerald-600 text-white shadow-sm"
                            : "bg-white/5 text-neutral-400 hover:text-white"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={aiTestContent}
                      onChange={(e) => setAiTestContent(e.target.value)}
                      placeholder={
                        aiTestType === "text"
                          ? "Type a sample chat message or sentence to test..."
                          : `Enter ${aiTestType} URL (e.g. /uploads/sample.${aiTestType === "image" ? "png" : aiTestType === "audio" ? "mp3" : "mp4"} or external link)...`
                      }
                      className="flex-1 bg-[#050713] text-xs text-white border border-white/10 rounded-xl px-3.5 py-2.5 placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={handleRunAiTest}
                      disabled={aiTestRunning}
                      className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md shrink-0"
                    >
                      {aiTestRunning ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          <span>Inspecting...</span>
                        </>
                      ) : (
                        <>
                          <Zap size={14} />
                          <span>Inspect with OpenRouter</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Test Result Output Box */}
                  {aiTestResult && (
                    <div
                      className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                        aiTestResult.safe
                          ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-200"
                          : "bg-red-950/40 border-red-500/40 text-red-200"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold">
                          {aiTestResult.safe ? (
                            <CheckCircle2 size={16} className="text-emerald-400" />
                          ) : (
                            <AlertOctagon size={16} className="text-red-400" />
                          )}
                          <span className="uppercase tracking-wide">
                            {aiTestResult.safe ? "Content Approved (SAFE)" : "Content Flagged (UNSAFE)"}
                          </span>
                        </div>
                        {aiTestResult.model && (
                          <span className="font-mono text-[10px] bg-black/40 px-2 py-0.5 rounded border border-white/10 text-white">
                            Model: {aiTestResult.model}
                          </span>
                        )}
                      </div>

                      {aiTestResult.reason && (
                        <p className="text-[11px] text-neutral-200">
                          <strong>Reason:</strong> {aiTestResult.reason}
                        </p>
                      )}

                      {aiTestResult.transcript && (
                        <p className="text-[11px] text-neutral-300">
                          <strong>Audio Transcript:</strong> "{aiTestResult.transcript}"
                        </p>
                      )}

                      {aiTestResult.extractedText && (
                        <p className="text-[11px] text-neutral-300">
                          <strong>OCR Extracted Text:</strong> "{aiTestResult.extractedText}"
                        </p>
                      )}

                      {aiTestResult.moderator && (
                        <div className="text-[10px] text-neutral-400 pt-1 border-t border-white/10">
                          Processed by: <span className="text-white font-semibold">{aiTestResult.moderator}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 6. AUDIT LOG TAB */}
            {activeTab === "audit_log" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-neutral-400 px-1 mb-1 font-bold">
                  <span>RECENT MODERATOR ACTIONS</span>
                </div>

                {auditLogs.length === 0 ? (
                  <div className="p-8 text-center text-xs text-neutral-500 border border-dashed border-white/10 rounded-xl">
                    No moderation actions logged yet.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="p-3 rounded-xl bg-[#080b1a] border border-white/5 flex items-start justify-between gap-3 text-xs">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-red-400">{log.action}</span>
                            <span className="text-neutral-400">Target: <strong className="text-white">@{log.target}</strong></span>
                          </div>
                          <p className="text-[11px] text-neutral-300">{log.details}</p>
                          <p className="text-[10px] text-neutral-500">By @{log.moderator}</p>
                        </div>
                        <span className="text-[10px] text-neutral-500 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Modal Sub-dialog for Selected User */}
          <AnimatePresence>
            {selectedUser && (
              <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100000] flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-[#121630] border border-red-500/40 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl text-white text-left"
                >
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <ShieldAlert size={16} className="text-red-400" />
                      <span>Moderate @{selectedUser.username}</span>
                    </h3>
                    <button onClick={() => setSelectedUser(null)} className="text-neutral-400 hover:text-white cursor-pointer">
                      <X size={16} />
                    </button>
                  </div>

                  {/* Action Selector */}
                  <div className="grid grid-cols-4 gap-1 bg-[#080b1a] p-1 rounded-xl border border-white/10">
                    {(["mute", "warn", "kick", "ban"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setActionType(t)}
                        className={`py-1.5 text-[11px] font-bold capitalize rounded-lg transition-colors cursor-pointer ${
                          actionType === t ? "bg-red-600 text-white" : "text-neutral-400 hover:text-white"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  {/* Duration Select for Mute / Ban */}
                  {actionType === "mute" && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-neutral-400 uppercase">Mute Duration</label>
                      <select
                        value={muteDuration}
                        onChange={(e) => setMuteDuration(Number(e.target.value))}
                        className="w-full bg-[#080b1a] text-xs rounded-xl border border-white/10 p-2.5 text-white focus:outline-none"
                      >
                        <option value={5 * 60 * 1000}>5 Minutes</option>
                        <option value={15 * 60 * 1000}>15 Minutes</option>
                        <option value={60 * 60 * 1000}>1 Hour</option>
                        <option value={24 * 60 * 60 * 1000}>24 Hours</option>
                        <option value={-1}>Permanent Mute</option>
                      </select>
                    </div>
                  )}

                  {actionType === "ban" && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-neutral-400 uppercase">Ban Duration</label>
                      <select
                        value={banDuration}
                        onChange={(e) => setBanDuration(Number(e.target.value))}
                        className="w-full bg-[#080b1a] text-xs rounded-xl border border-white/10 p-2.5 text-white focus:outline-none"
                      >
                        <option value={1 * 60 * 60 * 1000}>1 Hour</option>
                        <option value={24 * 60 * 60 * 1000}>24 Hours</option>
                        <option value={7 * 24 * 60 * 60 * 1000}>7 Days</option>
                        <option value={-1}>Permanent Ban</option>
                      </select>
                    </div>
                  )}

                  {/* Reason Input */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase">Reason / Note for User</label>
                    <input
                      type="text"
                      value={actionReason}
                      onChange={(e) => setActionReason(e.target.value)}
                      placeholder="Friendly explanation (e.g. Please be respectful)..."
                      className="w-full bg-[#080b1a] text-xs rounded-xl border border-white/10 p-2.5 text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedUser(null)}
                      className="flex-1 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyUserAction}
                      className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition-colors cursor-pointer shadow-md"
                    >
                      Confirm {actionType.toUpperCase()}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
