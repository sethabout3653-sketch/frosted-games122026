import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  MessageSquare,
  Gamepad2,
  Volume2,
  Mic,
  MicOff,
  Video,
  MonitorUp,
  ChevronDown,
  Search,
  LogOut,
  X,
  PhoneOff,
  Headphones,
  User as UserIcon,
} from "lucide-react";
import ProfileSetup from "./ProfileSetup";
import ChatPanel from "./ChatPanel";
import VoiceChannel from "./VoiceChannel";
import FriendsPanel from "./FriendsPanel";
import { ChatProfile, ChatMessage } from "../types";
import { isAllowedUsername, isGuestUser } from "../lib/user-filter";
import { saveUserProfile, setVoiceState, getSavedProfile } from "../lib/activity-tracker";
import { wsClient } from "../lib/websocket-client";
import { getOrCreateUserTag } from "../lib/friends";
import { useCall } from "../context/CallContext";
import { SOUND_ASSETS } from "../lib/ringtone-synthesizer";
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  where,
  writeBatch,
  deleteDoc,
  updateDoc,
  doc,
  db,
  handleFirestoreError,
  OperationType,
  toTimestampMs,
} from "../supabase-adapter";

export default function Chat({
  isOpen,
  onClose,
  onOpenVoiceChat,
  persistent = false,
  initialTab = "chat",
  autoJoinVoice = false,
  onVoiceSessionStarted,
  onTabChange,
}: {
  isOpen?: boolean;
  onClose?: () => void;
  onOpenVoiceChat?: () => void;
  persistent?: boolean;
  initialTab?: "chat" | "voice" | "profile" | "friends";
  onTabChange?: (tab: "chat" | "voice" | "profile" | "friends") => void;
  autoJoinVoice?: boolean;
  onVoiceSessionStarted?: () => void;
}) {
  const [profile, setProfile] = useState<ChatProfile | null>(() => {
    return getSavedProfile();
  });

  const { isInVoiceSession, joinGeneralVoice, leaveGeneralVoice } = useCall();
  const [activeTab, setActiveTabState] = useState<"chat" | "voice" | "profile" | "friends">(initialTab || "chat");

  const setActiveTab = useCallback((tab: "chat" | "voice" | "profile" | "friends") => {
    setActiveTabState(tab);
    onTabChange?.(tab);
  }, [onTabChange]);
  const [activeChannel, setActiveChannel] = useState<string>("general");
  const [channelSearch, setChannelSearch] = useState<string>("");
  const [showMembersSidebar, setShowMembersSidebar] = useState<boolean>(true);
  const [notification, setNotification] = useState<ChatMessage | null>(null);
  const messageSoundRef = useRef<HTMLAudioElement | null>(null);

  // Sync tab when initialTab changes from parent
  useEffect(() => {
    if (initialTab) {
      setActiveTabState(initialTab);
    }
  }, [initialTab]);

  // Handle immediate joining to General Voice
  useEffect(() => {
    if (autoJoinVoice) {
      setActiveTab("voice");
      joinGeneralVoice();
      onVoiceSessionStarted?.();
    }
  }, [autoJoinVoice, onVoiceSessionStarted, joinGeneralVoice]);

  // Global event listener for instant joining to General Voice from anywhere
  useEffect(() => {
    const handleGlobalJoinVoice = () => {
      setActiveTab("voice");
    };
    window.addEventListener("join_general_voice", handleGlobalJoinVoice);
    return () => window.removeEventListener("join_general_voice", handleGlobalJoinVoice);
  }, []);

  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const [rawVoiceUsers, setRawVoiceUsers] = useState<
    Array<{
      uid: string;
      username: string;
      photoURL: string;
      isMuted?: boolean;
      isVideoOn?: boolean;
      isScreenSharing?: boolean;
      isScreenAudioOn?: boolean;
      timestamp?: number;
      lastSeen?: number;
    }>
  >([]);

  // 1-second tick to continuously drop dead/disconnected users within a few seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Filter out anonymous users and deduplicate by username (keeping most recent)
  const voiceUsers = useMemo(() => {
    const userMap = new Map<string, any>();
    
    rawVoiceUsers.forEach(u => {
      if (!u || !u.uid) return;
      
      const existing = userMap.get(u.uid);
      if (!existing || (u.timestamp || 0) > (existing.timestamp || 0) || u.uid === profile?.uid) {
        userMap.set(u.uid, u);
      }
    });

    return Array.from(userMap.values()).sort((a, b) => {
      if (profile && a.uid === profile.uid) return -1;
      if (profile && b.uid === profile.uid) return 1;
      return (a.username || "").localeCompare(b.username || "");
    });
  }, [rawVoiceUsers, profile?.uid]);

  const sessionStartRef = useRef(Date.now());
  const isOpenRef = useRef(isOpen);
  const profileRef = useRef(profile);
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const initialSnapshotProcessedRef = useRef<boolean>(false);
  const notificationTimeoutRef = useRef<any>(null);

  // Real-time listener for voice users combining voice_users and presence collections
  useEffect(() => {
    let latestVoiceDocs: any[] = [];
    let latestPresenceDocs: any[] = [];

    const mergeAndSetVoiceUsers = () => {
      const now = Date.now();
      const userMap = new Map<string, any>();
      const myNameClean = (profile?.username || "").trim().toLowerCase();

      // 1. Ingest from voice_users collection
      latestVoiceDocs.forEach((d) => {
        const data = d.data();
        const uname = (data?.username || "").trim();
        const uUid = data?.uid || "";
        if (!uUid || !uname || !isAllowedUsername(uname, uUid, profile?.uid)) {
          return;
        }
        const ts = toTimestampMs(data.timestamp || data.lastSeen);
        const isSelf = uUid === profile?.uid;
        if (isSelf && !isInVoiceSession) return;
        if (ts > 0 && Math.abs(now - ts) <= 60000 && data.inVoice !== false) {
          const existing = userMap.get(uUid);
          if (!existing || isSelf || ts > (existing.timestamp || 0)) {
            userMap.set(uUid, { ...data, uid: isSelf ? profile?.uid : uUid, timestamp: ts });
          }
        }
      });

      // 2. Ingest from presence collection (users who have inVoice: true)
      latestPresenceDocs.forEach((d) => {
        const data = d.data();
        const uname = (data?.username || "").trim();
        const uUid = data?.uid || "";
        if (!uUid || !uname || !isAllowedUsername(uname, uUid, profile?.uid)) {
          return;
        }
        const isSelf = uUid === profile?.uid;
        if (isSelf && !isInVoiceSession) return;

        if (data.inVoice) {
          const ts = toTimestampMs(data.lastSeen || data.timestamp);
          if (ts > 0 && Math.abs(now - ts) <= 60000) {
            const existing = userMap.get(uUid);
            if (!existing || isSelf || ts > (existing.timestamp || 0)) {
              userMap.set(uUid, {
                uid: isSelf ? profile?.uid : uUid,
                username: uname,
                photoURL: data.photoURL || existing?.photoURL || "",
                isMuted: data.isMuted !== undefined ? data.isMuted : existing?.isMuted ?? false,
                isVideoOn: data.isVideoOn !== undefined ? data.isVideoOn : existing?.isVideoOn ?? false,
                isScreenSharing: data.isScreenSharing !== undefined ? data.isScreenSharing : existing?.isScreenSharing ?? false,
                isScreenAudioOn: data.isScreenAudioOn !== undefined ? data.isScreenAudioOn : existing?.isScreenAudioOn ?? false,
                timestamp: Math.max(ts, existing?.timestamp || 0),
              });
            }
          }
        }
      });

      setRawVoiceUsers(Array.from(userMap.values()));
    };

    const unsubVoiceUsers = onSnapshot(
      collection(db, "voice_users"),
      (snapshot) => {
        latestVoiceDocs = snapshot.docs;
        mergeAndSetVoiceUsers();
      },
      (error) => {
        console.warn("Chat voice_users listener error:", error);
      }
    );

    const unsubPresence = onSnapshot(
      collection(db, "presence"),
      (snapshot) => {
        latestPresenceDocs = snapshot.docs;
        mergeAndSetVoiceUsers();
      },
      (error) => {
        console.warn("Chat presence listener error:", error);
      }
    );

    return () => {
      unsubVoiceUsers();
      unsubPresence();
    };
  }, [profile?.uid]);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  // Real-time message listener for instant audio & toast notifications
  useEffect(() => {
    const q = query(
      collection(db, "messages"),
      orderBy("timestamp", "desc"),
      limit(5)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (snapshot.empty) {
          initialSnapshotProcessedRef.current = true;
          return;
        }

        // On the very first snapshot, register all existing messages as seen and never play sound
        if (!initialSnapshotProcessedRef.current) {
          initialSnapshotProcessedRef.current = true;
          snapshot.docs.forEach((d: any) => {
            seenMessageIdsRef.current.add(d.id);
          });
          return;
        }

        const currentProfile = profileRef.current;
        const now = Date.now();

        snapshot.docs.forEach((docSnap: any) => {
          const msgId = docSnap.id;
          if (seenMessageIdsRef.current.has(msgId)) {
            return;
          }
          seenMessageIdsRef.current.add(msgId);

          const rawData = docSnap.data() as any;
          const msg = { id: msgId, ...rawData } as ChatMessage;
          const msgTime = toTimestampMs(msg.timestamp);

          // Strictly ignore any message created before this session/tab was loaded
          if (!msgTime || msgTime < sessionStartRef.current) {
            return;
          }

          const ageMs = now - msgTime;
          // Only trigger notification & sound if message was just sent (within 15 seconds)
          // If it was sent a long time ago, don't do notification and sound
          if (ageMs > 15000 || ageMs < -5000) {
            return;
          }

          const isMe =
            currentProfile &&
            (msg.uid === currentProfile.uid ||
              (msg.username === currentProfile.username &&
                msg.photoURL === currentProfile.photoURL));

          if (!isMe) {
            try {
              messageSoundRef.current ||= new Audio(SOUND_ASSETS.message);
              messageSoundRef.current.currentTime = 0;
              messageSoundRef.current.volume = 0.8;
              messageSoundRef.current.play().catch(() => {});
            } catch (e) {}

            if (!isOpenRef.current) {
              if (notificationTimeoutRef.current) {
                clearTimeout(notificationTimeoutRef.current);
              }
              setNotification(msg);
              notificationTimeoutRef.current = setTimeout(() => {
                setNotification(null);
                notificationTimeoutRef.current = null;
              }, 4000);
            }
          }
        });
      },
      (error) => {
        console.warn("Chat notifications listener error:", error);
      }
    );

    return () => {
      unsubscribe();
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
    };
  }, []);

  const handleProfileComplete = async (p: {
    username: string;
    photoURL: string;
    tag?: string;
  }) => {
    const computedTag = p.tag || getOrCreateUserTag(p.username);
    const newProfile: ChatProfile = {
      uid:
        profile?.uid || "user_" + Math.random().toString(36).substring(2, 11),
      username: p.username,
      photoURL: p.photoURL,
      tag: computedTag,
    };
    try {
      localStorage.setItem("frosted_has_signed_in", "true");
      sessionStorage.setItem("frosted_has_signed_in", "true");
    } catch (e) {}
    setProfile(newProfile);
    saveUserProfile(newProfile);
    setActiveTab("chat");

    // Update previous messages
    try {
      const q = query(
        collection(db, "messages"),
        where("uid", "==", newProfile.uid)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const batch = writeBatch();
        snapshot.docs.forEach((d: any) => {
          batch.update(doc(db, "messages", d.id), {
            username: newProfile.username,
            photoURL: newProfile.photoURL,
          });
        });
        await batch.commit();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "messages");
    }
  };

  const handleLogoutProfile = () => {
    try {
      localStorage.removeItem("frosted_chat_profile");
      sessionStorage.removeItem("frosted_chat_profile");
      localStorage.removeItem("frosted_has_signed_in");
      sessionStorage.removeItem("frosted_has_signed_in");
    } catch (e) {}
    setProfile(null);
    setActiveTab("profile");
  };

  return (
    <>
      {/* 1. Main Discord Chat Shell (only shown when chat is open) */}
      {isOpen && (
        <div
          id="frosted-chat-shell"
          style={{
            backgroundColor: "var(--theme-chat-bg)",
            borderColor: "var(--theme-border-subtle)",
          }}
          className="flex-1 w-full flex border animate-in fade-in min-h-0 overflow-hidden text-white backdrop-blur-xl"
        >
          {!profile || activeTab === "profile" ? (
            /* If not logged in or editing profile, show Profile Setup modal */
            <div
              style={{ backgroundColor: "var(--theme-chat-bg)" }}
              className="flex-1 w-full flex items-center justify-center"
            >
              <ProfileSetup
                initialUsername={profile?.username}
                initialTag={profile?.tag}
                initialPhotoURL={profile?.photoURL}
                onComplete={handleProfileComplete}
                onCancel={profile ? () => setActiveTab("chat") : undefined}
              />
            </div>
          ) : (
            /* Discord Main App Shell */
            <div className="flex-1 flex w-full h-full overflow-hidden">
          {/* Column 1: Leftmost Narrow Server Rail (~60px) matching Image 2 */}
          <aside
            style={{
              backgroundColor: "var(--theme-chat-rail)",
              borderColor: "var(--theme-border-subtle)",
            }}
            className="w-16 border-r flex flex-col items-center justify-between py-4 flex-shrink-0 z-20 transition-colors duration-200"
          >
            {/* Top Gamepad Button (Go back to games list) */}
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={onClose}
                style={{
                  backgroundColor: "var(--theme-accent)",
                  borderColor: "var(--theme-border)",
                  color: "var(--theme-text-accent)",
                }}
                className="w-11 h-11 rounded-2xl border hover:text-white hover:brightness-110 flex items-center justify-center transition-all cursor-pointer shadow-sm group"
                title="Return to Games Catalog"
              >
                <Gamepad2 size={20} className="group-hover:scale-110 transition-transform" />
              </button>

              <div
                style={{ backgroundColor: "var(--theme-border-subtle)" }}
                className="w-8 h-[1px] my-1"
              />

              {/* Active Chat Button (Squircle with MessageSquare icon) */}
              <button
                onClick={() => setActiveTab("chat")}
                style={{
                  backgroundColor: activeTab === "chat" ? "var(--theme-accent)" : "var(--theme-surface)",
                  borderColor: activeTab === "chat" ? "var(--theme-border-strong)" : "var(--theme-border-subtle)",
                }}
                className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-lg border hover:brightness-110 ${
                  activeTab === "chat"
                    ? "text-white scale-105"
                    : "text-neutral-400"
                }`}
                title="Community Chat"
              >
                <MessageSquare size={20} strokeWidth={2.2} />
              </button>
            </div>

            {/* Bottom User Avatar & Logout */}
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={() => setActiveTab("profile")}
                className="relative group cursor-pointer"
                title="Edit Profile"
              >
                <div
                  style={{
                    backgroundColor: "var(--theme-surface)",
                    borderColor: "var(--theme-border-subtle)",
                  }}
                  className="w-10 h-10 rounded-full overflow-hidden border group-hover:border-white transition-colors"
                >
                  <img
                    src={profile.photoURL}
                    alt={profile.username}
                    className="w-full h-full object-cover"
                  />
                </div>
                {/* Online dot badge matching theme accent */}
                <span
                  style={{ backgroundColor: "var(--theme-text-accent)" }}
                  className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#02030a] shadow-sm"
                />
              </button>

              <button
                onClick={handleLogoutProfile}
                className="p-2 text-neutral-400 hover:text-red-400 transition-colors rounded-lg hover:bg-white/10"
                title="Switch Profile / Logout"
              >
                <LogOut size={16} />
              </button>
            </div>
          </aside>

          {/* Column 2: Channels Sidebar (~220px) */}
          <aside
            style={{
              backgroundColor: "var(--theme-darkest)",
              borderColor: "var(--theme-border-subtle)",
            }}
            className="w-56 border-r flex flex-col h-full flex-shrink-0 hidden sm:flex transition-colors duration-200"
          >
            {/* Top Channel Search */}
            <div
              style={{ borderColor: "var(--theme-border-subtle)" }}
              className="p-3 border-b"
            >
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--theme-text-muted)]" />
                <input
                  type="text"
                  value={channelSearch}
                  onChange={(e) => setChannelSearch(e.target.value)}
                  placeholder="Find a channel"
                  style={{
                    backgroundColor: "var(--theme-surface)",
                    borderColor: "var(--theme-border-subtle)",
                  }}
                  className="w-full border text-xs text-white placeholder-neutral-400 rounded-md pl-8 pr-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[var(--theme-border-strong)] transition-all duration-150"
                />
              </div>
            </div>

            {/* Channels & Voice Navigation */}
            <div className="flex-1 overflow-y-auto p-2 space-y-4">
              {/* SOCIAL & FRIENDS Section */}
              <div>
                <div className="flex items-center gap-1 text-[10px] font-bold text-[var(--theme-text-muted)] tracking-wider uppercase px-2.5 py-1.5">
                  <ChevronDown size={12} />
                  <span>DIRECT MESSAGES</span>
                </div>
                <div className="space-y-0.5 mt-0.5">
                  <button
                    onClick={() => setActiveTab("friends")}
                    style={{
                      backgroundColor: activeTab === "friends" ? "var(--theme-accent)" : "transparent",
                      borderColor: activeTab === "friends" ? "var(--theme-border-strong)" : "transparent",
                    }}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all duration-150 cursor-pointer border ${
                      activeTab === "friends"
                        ? "text-white shadow-sm"
                        : "text-neutral-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <UserIcon size={15} className="text-[var(--theme-text-accent)]" />
                    <span>Friends & DMs</span>
                  </button>
                </div>
              </div>

              {/* CHANNELS Section */}
              <div>
                <div className="flex items-center gap-1 text-[10px] font-bold text-[var(--theme-text-muted)] tracking-wider uppercase px-2.5 py-1.5">
                  <ChevronDown size={12} />
                  <span>CHANNELS</span>
                </div>
                <div className="space-y-0.5 mt-0.5">
                  <button
                    onClick={() => {
                      setActiveTab("chat");
                      setActiveChannel("general");
                    }}
                    style={{
                      backgroundColor: activeTab === "chat" && activeChannel === "general" ? "var(--theme-accent)" : "transparent",
                      borderColor: activeTab === "chat" && activeChannel === "general" ? "var(--theme-border-strong)" : "transparent",
                    }}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all duration-150 cursor-pointer border ${
                      activeTab === "chat" && activeChannel === "general"
                        ? "text-white shadow-sm"
                        : "text-neutral-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <span className="text-base text-[var(--theme-text-accent)] font-bold">#</span>
                    <span>general</span>
                  </button>
                </div>
              </div>

              {/* VOICE Section */}
              <div>
                <div className="flex items-center gap-1 text-[10px] font-bold text-[var(--theme-text-muted)] tracking-wider uppercase px-2.5 py-1.5">
                  <ChevronDown size={12} />
                  <span>VOICE</span>
                </div>
                <div className="space-y-0.5 mt-0.5">
                  <button
                    onClick={() => {
                      setActiveTab("voice");
                      joinGeneralVoice();
                    }}
                    style={{
                      backgroundColor: activeTab === "voice" ? "var(--theme-accent)" : "transparent",
                      borderColor: activeTab === "voice" ? "var(--theme-border-strong)" : "transparent",
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all duration-150 cursor-pointer border ${
                      activeTab === "voice"
                        ? "text-white shadow-sm"
                        : "text-neutral-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Volume2
                        size={15}
                        className={
                          activeTab === "voice"
                            ? "text-[var(--theme-text-accent)]"
                            : "text-neutral-400"
                        }
                      />
                      <span>General Voice</span>
                    </div>
                    {voiceUsers.length > 0 && (
                      <span
                        style={{
                          backgroundColor: "var(--theme-surface)",
                          borderColor: "var(--theme-border-subtle)",
                        }}
                        className="text-[10px] font-bold text-white px-1.5 py-0.2 rounded-full border"
                      >
                        {voiceUsers.length}
                      </span>
                    )}
                  </button>

                  {/* Users currently in General Voice */}
                  {voiceUsers.length > 0 && (
                    <div className="ml-4 pl-2 border-l border-indigo-900/40 my-1 space-y-1">
                      {voiceUsers.map((vUser, vIdx) => (
                        <div
                          key={`${vUser.uid || "vuser"}-${vIdx}`}
                          onClick={() => {
                            setActiveTab("voice");
                            joinGeneralVoice();
                          }}
                          className="flex items-center justify-between py-1 px-1.5 rounded text-xs text-neutral-300 hover:bg-[#080d28] transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2 truncate">
                            {vUser.photoURL ? (
                              <img
                                src={vUser.photoURL}
                                alt={vUser.username || "User"}
                                className="w-4 h-4 rounded-full object-cover border border-indigo-900 flex-shrink-0"
                              />
                            ) : (
                              <div className="w-4 h-4 rounded-full bg-neutral-800 border border-indigo-900 flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                                {(vUser.username || "?").charAt(0).toUpperCase()}
                              </div>
                            )}
                            <span className="truncate text-[11px] font-medium text-neutral-300">
                              {vUser.username || "User"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {vUser.isScreenSharing && (
                              <span className="flex items-center gap-0.5 text-[9px] font-extrabold text-indigo-300 bg-[#0c1642] border border-indigo-700/80 px-1 py-0.2 rounded shadow-sm animate-pulse">
                                <MonitorUp size={10} />
                                <span>LIVE</span>
                              </span>
                            )}
                            {vUser.isVideoOn && (
                              <Video size={11} className="text-indigo-400" />
                            )}
                            {vUser.isMuted ? (
                              <MicOff size={11} className="text-red-400" />
                            ) : (
                              <Mic size={11} className="text-indigo-400" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Discord Voice Connected Bar in Left Sidebar when viewing text chat */}
            {isInVoiceSession && activeTab === "chat" && (
              <div
                style={{
                  backgroundColor: "var(--theme-surface)",
                  borderColor: "var(--theme-border-subtle)",
                }}
                className="px-3 py-2 border-t flex items-center justify-between"
              >
                <button
                  onClick={() => setActiveTab("voice")}
                  className="flex items-center gap-2 text-left cursor-pointer group min-w-0 flex-1"
                  title="Switch to Voice Channel"
                >
                  <span
                    style={{ backgroundColor: "var(--theme-accent)" }}
                    className="w-2 h-2 rounded-full animate-pulse flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <p
                      style={{ color: "var(--theme-text-accent)" }}
                      className="text-[11px] font-bold group-hover:underline truncate"
                    >
                      Voice Connected
                    </p>
                    <p
                      style={{ color: "var(--theme-text-muted)" }}
                      className="text-[10px] truncate"
                    >
                      General Voice
                    </p>
                  </div>
                </button>
                <button
                  onClick={() => {
                    leaveGeneralVoice();
                  }}
                  className="p-1.5 text-neutral-400 hover:text-rose-400 rounded-md hover:bg-white/10 transition-colors cursor-pointer flex-shrink-0 ml-1"
                  title="Disconnect from Voice"
                >
                  <PhoneOff size={14} />
                </button>
              </div>
            )}

            {/* Bottom User Bar matching Image 2 */}
            <div
              style={{
                backgroundColor: "var(--theme-chat-rail)",
                borderColor: "var(--theme-border-subtle)",
              }}
              className="p-3 border-t flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative">
                  <div
                    style={{ borderColor: "var(--theme-border-subtle)" }}
                    className="w-8 h-8 rounded-full overflow-hidden bg-neutral-800 border"
                  >
                    <img
                      src={profile.photoURL}
                      alt={profile.username}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span
                    style={{ backgroundColor: "var(--theme-text-accent)" }}
                    className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-black"
                  />
                </div>
                <span className="text-xs font-bold text-white truncate max-w-[100px]">
                  {profile.username}
                </span>
              </div>

              <button
                onClick={() => setActiveTab("profile")}
                style={{ color: "var(--theme-text-accent)" }}
                className="p-1.5 hover:text-white rounded-lg hover:bg-white/10 transition-colors duration-150 cursor-pointer active:scale-90"
                title="Edit Profile"
              >
                <UserIcon size={15} />
              </button>
            </div>
          </aside>

          {/* Column 3 & 4: Main Chat view */}
          <div
            style={{ backgroundColor: "var(--theme-chat-bg)" }}
            className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative"
          >
            {activeTab === "friends" ? (
              <FriendsPanel
                profile={profile}
                onOpenVoiceChat={() => {
                  setActiveTab("voice");
                  joinGeneralVoice();
                }}
              />
            ) : activeTab === "voice" && !isInVoiceSession ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-[#020617] via-[#080d28] to-[#020617] text-white overflow-y-auto">
                <div className="max-w-md w-full bg-[#0a1033]/80 border border-indigo-500/30 rounded-3xl p-8 shadow-2xl backdrop-blur-xl space-y-6">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto shadow-lg shadow-emerald-950/50">
                    <Volume2 size={32} />
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-white tracking-tight">General Voice Lounge</h2>
                    <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">
                      Connect with everyone online for low-latency HD audio, webcam video, and screen sharing.
                    </p>
                  </div>

                  {/* Connected Users Status */}
                  <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-neutral-300">Connected Members</span>
                      <span className="text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30 text-[10px]">
                        {voiceUsers.length} Active
                      </span>
                    </div>
                    {voiceUsers.length === 0 ? (
                      <p className="text-[11px] text-neutral-500 italic py-1">No one is currently in voice. Be the first to join!</p>
                    ) : (
                      <div className="flex items-center justify-center gap-2 flex-wrap pt-1">
                        {voiceUsers.map((u, i) => (
                          <div key={u.uid || i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-xs">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="font-medium text-neutral-200">{u.username || "User"}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Join Button */}
                  <button
                    type="button"
                    onClick={() => {
                      joinGeneralVoice();
                    }}
                    className="w-full py-3.5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-sm transition-all cursor-pointer shadow-lg shadow-emerald-950/60 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <Headphones size={18} />
                    <span>Join General Voice</span>
                  </button>
                </div>
              </div>
            ) : (
              <ChatPanel
                profile={profile}
                activeChannel={activeChannel}
                voiceUsers={voiceUsers}
                onSelectVoice={() => {
                  setActiveTab("voice");
                  joinGeneralVoice();
                }}
                showMembersSidebar={showMembersSidebar}
                setShowMembersSidebar={setShowMembersSidebar}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )}

  {/* 2. Toast notification when chat is closed */}
  {!isOpen && notification && (
    <div className="fixed top-6 right-6 z-50 bg-[#060b24] border border-indigo-800/40 rounded-2xl p-4 shadow-2xl shadow-black/80 flex items-center gap-4 animate-in slide-in-from-top fade-in hover:bg-[#0b143c] transition-colors cursor-pointer">
      <div
        className="flex items-center gap-3"
        onClick={() => {
          setNotification(null);
          onOpenVoiceChat?.();
        }}
      >
        <img
          src={notification.photoURL}
          alt=""
          className="w-10 h-10 rounded-full object-cover border border-indigo-900"
        />
        <div className="flex flex-col">
          <span className="text-xs font-bold text-white">
            {notification.username} sent a message
          </span>
          <span className="text-sm text-indigo-300/80 line-clamp-1">
            {notification.text ||
              (notification.gif ? "Sent a GIF" : "Sent an attachment")}
          </span>
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setNotification(null);
        }}
        className="text-indigo-300/60 hover:text-white p-1 rounded-full transition-colors cursor-pointer"
      >
        <X size={16} />
      </button>
    </div>
  )}
</>
);
}
