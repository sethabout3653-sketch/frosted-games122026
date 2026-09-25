import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  db,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  getDoc,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  setDoc,
  updateDoc,
  cassandra,
  handleFirestoreError,
  OperationType,
  toTimestampMs,
  compareMessagesChronological,
  sendBroadcastSignal,
  subscribeBroadcastSignals,
} from "../supabase-adapter";
import { ChatMessage, ChatProfile, UserActivity } from "../types";
import { wsClient } from "../lib/websocket-client";
import { getCurrentActivity, onActivityChanged, getVoiceState, broadcastPresenceUpdate } from "../lib/activity-tracker";
import { isAllowedUsername, isGuestUser, purgeNonAllowedUsers } from "../lib/user-filter";
import ActivityBadge from "./ActivityBadge";
import ModeratorPanelModal from "./ModeratorPanelModal";
import { checkTextModeration } from "../utils/moderation";
import { useCall } from "../context/CallContext";
import { playChatSound } from "../lib/ringtone-synthesizer";
import {
  Send,
  Image as ImageIcon,
  Plus,
  X,
  Trash2,
  Users,
  Search,
  Hash,
  Mic,
  MicOff,
  Volume2,
  Video,
  MonitorUp,
  ShieldAlert,
  AlertTriangle,
  Ban,
  Upload,
  SmilePlus,
  Sparkles,
  Smile,
  Phone,
  PhoneCall,
  AtSign,
  User as UserIcon,
  Shield,
  Radio,
  Check,
  ChevronDown,
  ChevronRight,
  UserCheck,
  Unlock,
  Clock,
} from "lucide-react";

import GiphyPicker from "./GiphyPicker";
import MediaAttachment from "./MediaAttachment";
import { detectMediaType, formatFileSize } from "../utils/mediaUtils";

const CHAT_QUICK_REACTIONS = ["👍", "❤️", "😂", "🔥", "💀", "🚀"];

const CHAT_EMOJI_CATEGORIES = [
  {
    name: "Gaming & Hype",
    emojis: ["🎮", "🕹️", "👾", "🏆", "🔥", "⚡", "👑", "🎯", "🎲", "🚀", "💯", "🛡️"],
  },
  {
    name: "Emotions & Faces",
    emojis: ["❤️", "😂", "💀", "😭", "🤯", "😎", "🥳", "🥺", "😍", "🤩", "🤔", "😴"],
  },
  {
    name: "Gestures & Badges",
    emojis: ["👍", "👎", "👏", "🙌", "👀", "🫡", "🗿", "💩", "🎉", "✨", "🤝", "💪"],
  },
  {
    name: "Vibes & Cozy",
    emojis: ["❄️", "☕", "🌟", "🍕", "🍔", "🌙", "🍀", "💎", "⭐", "🎵", "🍦", "🍿"],
  },
];

const POPULAR_TEXT_REACTIONS = [
  "W",
  "10/10",
  "L",
  "Fr",
  "Cap",
  "Based",
  "Goated",
  "Skill issue",
  "GG",
  "Real",
  "Facts",
  "Cinema",
];

export function isUserModerator(username: string, uid?: string): boolean {
  const name = (username || "").trim().toLowerCase();
  const id = (uid || "").trim().toLowerCase();
  return (
    name.includes("logicgatesobviously") ||
    name.includes("sethplayz12") ||
    id.includes("logicgatesobviously") ||
    id.includes("sethplayz12")
  );
}

interface ChatPanelProps {
  profile: ChatProfile;
  activeChannel?: string;
  onSelectVoice?: () => void;
  showMembersSidebar?: boolean;
  setShowMembersSidebar?: (show: boolean | ((prev: boolean) => boolean)) => void;
  voiceUsers?: any[];
}

interface MemberUser {
  uid: string;
  username: string;
  photoURL: string;
  lastSeen?: number;
  status?: "online" | "left" | "offline";
  isMuted?: boolean;
  isVideoOn?: boolean;
  isScreenSharing?: boolean;
  inVoice?: boolean;
  inCall?: boolean;
  channelName?: string;
  activity?: UserActivity;
}

let globalMessagesCache: ChatMessage[] = [];
let globalMessagesLoaded = false;
const CACHE_KEY = "lumos_chat_messages_v5";
const DELETED_CACHE_KEY = "lumos_deleted_msg_ids_v1";

const getCachedDeletedIds = (): Set<string> => {
  const set = new Set<string>();
  try {
    const raw = localStorage.getItem(DELETED_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((id: string) => {
          if (typeof id === "string") set.add(id);
        });
      }
    }
  } catch {}
  return set;
};

const saveDeletedMessageId = (id: string) => {
  try {
    const set = getCachedDeletedIds();
    set.add(id);
    const arr = Array.from(set).slice(-500);
    localStorage.setItem(DELETED_CACHE_KEY, JSON.stringify(arr));
  } catch {}
};

try {
  localStorage.removeItem("lumos_chat_messages_v4");
  localStorage.removeItem("lumos_chat_messages_v3");
  localStorage.removeItem("lumos_chat_messages_v2");
  localStorage.removeItem("lumos_chat_messages_v1");
} catch {}

const getCachedMessages = (): ChatMessage[] => {
  const deleted = getCachedDeletedIds();
  if (globalMessagesCache.length > 0) {
    return globalMessagesCache.filter((m) => !deleted.has(m.id));
  }
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const filtered = (parsed as ChatMessage[]).filter((m) => !deleted.has(m.id));
        globalMessagesCache = filtered;
        globalMessagesLoaded = true;
        return filtered;
      }
    }
  } catch (e) {
    console.warn("Failed reading cached messages:", e);
  }
  return [];
};

const saveCachedMessages = (msgs: ChatMessage[]) => {
  const deleted = getCachedDeletedIds();
  const valid = msgs.filter((m) => !deleted.has(m.id));
  globalMessagesCache = valid;
  globalMessagesLoaded = true;
  try {
    // Cache the most recent 60 messages for fast startup
    const toSave = valid.slice(-60).map((m) => {
      // Avoid overflowing localStorage quota on huge base64 data
      if (m.attachment && m.attachment.length > 100000) {
        return { ...m, attachment: "" };
      }
      return m;
    });
    localStorage.setItem(CACHE_KEY, JSON.stringify(toSave));
  } catch {
    // Ignore storage quota errors
  }
};

export default function ChatPanel({
  profile,
  activeChannel = "general",
  showMembersSidebar = true,
  setShowMembersSidebar,
  onSelectVoice,
  voiceUsers: propVoiceUsers = [],
}: ChatPanelProps) {
  const callCtx = useCall();
  const [selectedUserProfile, setSelectedUserProfile] = useState<MemberUser | null>(null);
  const [voiceUsersMap, setVoiceUsersMap] = useState<Map<string, any>>(new Map());

  const handleStartDirectCall = (user: MemberUser, type: "audio" | "video") => {
    if (!user || user.uid === profile.uid) return;
    callCtx?.startDirectCall(
      {
        uid: user.uid,
        username: user.username,
        photoURL: user.photoURL,
        status: user.status,
        activity: user.activity,
      },
      type
    );
  };

  const handleMentionUser = (username: string) => {
    if (!username) return;
    const mentionTag = `@${username.trim()} `;
    setText((prev) => (prev ? `${prev} ${mentionTag}` : mentionTag));
    inputRef.current?.focus();
  };

  const initialCache = getCachedMessages();
  const [messages, setMessages] = useState<ChatMessage[]>(initialCache);
  const [messageLimit, setMessageLimit] = useState(50);

  // Moderator Action States
  const [activeModeration, setActiveModeration] = useState<any | null>(null);
  const [modTargetUser, setModTargetUser] = useState<MemberUser | null>(null);
  const [modActionType, setModActionType] = useState<"kick" | "ban">("kick");
  const [modReason, setModReason] = useState("");
  const [modBanDuration, setModBanDuration] = useState<number>(5 * 60 * 1000); // 5 mins

  // Real-time synchronization of slowmode & chat lock from Firestore
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "chat_settings", "global"), (snap: any) => {
      const exists = typeof snap?.exists === "function" ? snap.exists() : !!snap?.exists;
      if (exists) {
        const data = typeof snap.data === "function" ? snap.data() : (snap.data || snap);
        if (data) {
          if (typeof data.slowmode === "number") {
            setSlowmodeCooldown(data.slowmode);
          }
          if (typeof data.isLocked === "boolean") {
            setIsChatLocked(data.isLocked);
          }
        }
      }
    });
    return () => unsub();
  }, []);
  const [bannedList, setBannedList] = useState<any[]>([]);
  const [showBannedModal, setShowBannedModal] = useState(false);
  const [showModSuiteModal, setShowModSuiteModal] = useState(false);
  const [isChatLocked, setIsChatLocked] = useState(false);
  const [slowmodeCooldown, setSlowmodeCooldown] = useState(0);
  const lastUserMessageTimeRef = useRef<number>(0);
  const [manualUnbanInput, setManualUnbanInput] = useState("");
  const [unbanSuccessMsg, setUnbanSuccessMsg] = useState<string | null>(null);
  const [unbanErrorMsg, setUnbanErrorMsg] = useState<string | null>(null);
  const [isUnbanning, setIsUnbanning] = useState(false);

  const [hasMoreOlderMessages, setHasMoreOlderMessages] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [memberUsers, setMemberUsers] = useState<MemberUser[]>([]);
  const [activeVoiceUsers, setActiveVoiceUsers] = useState<
    Record<string, { isMuted?: boolean; isVideoOn?: boolean }>
  >({});
  const [text, setText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showGiphy, setShowGiphy] = useState(false);
  const [attachment, setAttachment] = useState<string | null>(null);
  const [attachmentType, setAttachmentType] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [attachmentSize, setAttachmentSize] = useState<number | null>(null);
  const [moderationWarning, setModerationWarning] = useState<{
    open: boolean;
    title: string;
    reason: string;
    mediaType?: string;
  } | null>(null);

  const showModerationAlert = (
    title?: string, 
    reason?: string, 
    mediaType?: string
  ) => {
    playChatSound("warning");
    setModerationWarning({
      open: true,
      title: title || "Hold on a second",
      reason: reason || "Your message contains language or content that doesn't follow community guidelines. Please adjust your message and try again.",
      mediaType,
    });
  };
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadingFileInfo, setUploadingFileInfo] = useState<{ name: string; size: number } | null>(null);
  const uploadAbortControllerRef = useRef<AbortController | null>(null);
  const uploadSessionIdRef = useRef<number>(0);
  const stagedBlobUrlRef = useRef<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const [isDeletingAllUsers, setIsDeletingAllUsers] = useState(false);

  const handleDeleteAllUsers = async () => {
    if (!window.confirm("Are you sure you want to delete all stored users except 'giggity', 'SethPlayz12', and 'logicgatesobviously'?")) {
      return;
    }
    setIsDeletingAllUsers(true);
    try {
      const count = await purgeNonAllowedUsers();
      alert(`User database cleanup complete! Removed ${count} non-allowed profile records.`);
    } catch (err: any) {
      console.error("Error clearing users:", err);
      alert("Error clearing users: " + err.message);
    } finally {
      setIsDeletingAllUsers(false);
    }
  };
  const [typingUsers, setTypingUsers] = useState<any[]>([]);
  const [isLocalTyping, setIsLocalTyping] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(initialCache.length === 0);
  const typingTimeoutRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isInitialLoadRef = useRef<boolean>(true);
  const isUserScrolledUpRef = useRef<boolean>(false);
  const lastKnownLatestMsgIdRef = useRef<string | null>(null);
  const lastKnownLatestMsgTimestampRef = useRef<number>(0);
  const deletedMessageIdsRef = useRef<Set<string>>(getCachedDeletedIds());
  const isLoadingOlderRef = useRef<boolean>(false);
  const prevScrollHeightRef = useRef<number>(0);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reaction picker menu state
  const [activeReactionMenuMsgId, setActiveReactionMenuMsgId] = useState<string | null>(null);
  const [customReactionInput, setCustomReactionInput] = useState("");
  const reactionPopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleReactionClickOutside(e: MouseEvent) {
      if (reactionPopoverRef.current && !reactionPopoverRef.current.contains(e.target as Node)) {
        setActiveReactionMenuMsgId(null);
      }
    }
    if (activeReactionMenuMsgId) {
      document.addEventListener("mousedown", handleReactionClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleReactionClickOutside);
    };
  }, [activeReactionMenuMsgId]);

  // Real-time moderation enforcement listener & unban signals
  useEffect(() => {
    if (!profile?.uid) return;

    // 1. Direct document snapshot listener on target UID
    const unsubUid = onSnapshot(doc(db, "moderation_actions", profile.uid), (docSnap: any) => {
      const exists = typeof docSnap?.exists === "function" ? docSnap.exists() : !!docSnap?.exists;
      if (exists) {
        const data = typeof docSnap.data === "function" ? docSnap.data() : (docSnap.data || docSnap);
        if (data?.type === "ban") {
          if (data.banUntil === -1 || Date.now() < data.banUntil) {
            setActiveModeration(data);
          } else {
            // Ban expired, clean up
            deleteDoc(doc(db, "moderation_actions", profile.uid)).catch(() => {});
            deleteDoc(doc(db, "banned_users", profile.uid)).catch(() => {});
            if (profile.username) {
              deleteDoc(doc(db, "moderation_banned_names", profile.username.trim().toLowerCase())).catch(() => {});
            }
            setActiveModeration(null);
          }
        } else if (data?.type === "kick") {
          setActiveModeration(data);
        }
      } else {
        // Also check if banned by username
        if (profile.username) {
          getDoc(doc(db, "moderation_banned_names", profile.username.trim().toLowerCase())).then((nameSnap: any) => {
            const nameExists = typeof nameSnap?.exists === "function" ? nameSnap.exists() : !!nameSnap?.exists;
            if (nameExists) {
              const nameData = typeof nameSnap.data === "function" ? nameSnap.data() : (nameSnap.data || nameSnap);
              if (nameData?.banUntil === -1 || Date.now() < nameData.banUntil) {
                setActiveModeration(nameData);
                return;
              }
            }
            setActiveModeration((prev: any) => (prev?.type === "kick" ? prev : null));
          }).catch(() => {
            setActiveModeration((prev: any) => (prev?.type === "kick" ? prev : null));
          });
        } else {
          setActiveModeration((prev: any) => (prev?.type === "kick" ? prev : null));
        }
      }
    });

    // 2. Real-time WebRTC / WebSocket broadcast signal listener for instant 0ms enforcement
    const unsubSignals = subscribeBroadcastSignals(profile.uid, (sig: any) => {
      if (!sig) return;
      const myUid = profile.uid;
      const myName = (profile.username || "").toLowerCase();
      const targetUid = sig.targetUid;
      const targetName = (sig.targetUsername || "").toLowerCase();

      if (sig.type === "moderation_action") {
        if (targetUid === myUid || (targetName && targetName === myName)) {
          setActiveModeration({
            type: sig.action || sig.type,
            reason: sig.reason,
            bannedBy: sig.bannedBy,
            banUntil: sig.banUntil,
            timestamp: sig.timestamp || Date.now(),
          });
        }
      } else if (sig.type === "moderation_unban") {
        if (targetUid === myUid || (targetName && targetName === myName)) {
          setActiveModeration(null);
        }
      } else if (sig.type === "warning") {
        if (targetUid === myUid || (targetName && targetName === myName) || targetUid === "all") {
          showModerationAlert("⚠️ Moderator Warning", `Warning from @${sig.moderator || "Moderator"}: ${sig.reason || "Please follow community guidelines"}`);
        }
      } else if (sig.type === "mute") {
        if (targetUid === myUid || (targetName && targetName === myName)) {
          showModerationAlert("🔇 Account Muted", `You have been muted by @${sig.moderator || "Moderator"}. Reason: ${sig.reason || "Violated guidelines"}`);
        }
      } else if (sig.type === "unmute") {
        if (targetUid === myUid || (targetName && targetName === myName)) {
          showModerationAlert("🔊 Unmuted", `You have been unmuted by @${sig.moderator || "Moderator"}.`);
        }
      } else if (sig.type === "purge_chat" || sig.type === "clear_chat") {
        const count = sig.count || 50;
        setMessages((prev) => {
          const updated = prev.slice(0, Math.max(0, prev.length - count));
          saveCachedMessages(updated);
          return updated;
        });
      } else if (sig.type === "chat_lock_changed") {
        setIsChatLocked(Boolean(sig.isLocked));
      } else if (sig.type === "slowmode_changed") {
        setSlowmodeCooldown(Number(sig.seconds || 0));
      } else if (sig.type === "mod_announcement") {
        showModerationAlert(`📣 Announcement from @${sig.moderator || "Moderator"}`, sig.text || sig.reason);
      }
    });

    // 3. Real-time global chat settings listener (Chat Lock & Slowmode over WebSockets/DB)
    const unsubChatSettings = onSnapshot(doc(db, "chat_settings", "global"), (snap: any) => {
      const exists = typeof snap?.exists === "function" ? snap.exists() : !!snap?.exists;
      if (exists) {
        const data = typeof snap.data === "function" ? snap.data() : (snap.data || snap);
        if (typeof data?.isLocked === "boolean") {
          setIsChatLocked(data.isLocked);
        }
        if (typeof data?.slowmode === "number") {
          setSlowmodeCooldown(data.slowmode);
        }
      }
    });

    return () => {
      unsubUid();
      unsubSignals();
      unsubChatSettings();
    };
  }, [profile?.uid, profile?.username]);

  // Live timer for ban countdown
  useEffect(() => {
    if (!activeModeration || activeModeration.type !== "ban" || activeModeration.banUntil === -1) return;
    const interval = setInterval(() => {
      if (Date.now() >= activeModeration.banUntil) {
        deleteDoc(doc(db, "moderation_actions", profile.uid)).catch(() => {});
        deleteDoc(doc(db, "banned_users", profile.uid)).catch(() => {});
        if (profile.username) {
          deleteDoc(doc(db, "moderation_banned_names", profile.username.trim().toLowerCase())).catch(() => {});
        }
        setActiveModeration(null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [activeModeration, profile?.uid, profile?.username]);

  // Immediately terminate calls/audio when under active moderation
  useEffect(() => {
    if (activeModeration) {
      try {
        callCtx.endActiveCall();
        callCtx.declineIncomingCall();
        callCtx.cancelOutgoingCall();
      } catch (e) {}
    }
  }, [activeModeration]);

  // Real-time listener for banned users collection (for moderators to view and unban)
  useEffect(() => {
    if (!profile?.username) return;
    const isMod = isUserModerator(profile.username, profile.uid);
    if (!isMod) return;

    const unsub = onSnapshot(collection(db, "banned_users"), (snap: any) => {
      const list: any[] = [];
      const now = Date.now();
      if (snap && snap.docs) {
        snap.docs.forEach((d: any) => {
          const data = typeof d.data === "function" ? d.data() : d;
          if (data && (data.banUntil === -1 || now < data.banUntil)) {
            list.push({ id: d.id, ...data });
          }
        });
      }
      setBannedList(list);
    });

    return () => unsub();
  }, [profile?.username, profile?.uid]);

  // Handler to unban any user (by UID or Username)
  const handleUnbanUser = async (targetUidOrName: string) => {
    const clean = (targetUidOrName || "").trim();
    if (!clean) return;

    if (!isUserModerator(profile.username, profile.uid)) {
      setUnbanErrorMsg("Only moderators can unban users.");
      setTimeout(() => setUnbanErrorMsg(null), 3500);
      return;
    }

    setIsUnbanning(true);
    try {
      // Find matching user in bannedList if present
      const match = bannedList.find(
        (b) =>
          b.uid === clean ||
          b.id === clean ||
          b.username?.toLowerCase() === clean.toLowerCase() ||
          b.targetUsername?.toLowerCase() === clean.toLowerCase()
      );

      const targetUid = match ? (match.uid || match.id || match.targetUid) : clean;
      const targetUsername = match ? (match.username || match.targetUsername) : clean;

      // 1. Delete from moderation_actions and banned_users and moderation_banned_names
      await deleteDoc(doc(db, "moderation_actions", targetUid)).catch(() => {});
      await deleteDoc(doc(db, "banned_users", targetUid)).catch(() => {});
      if (targetUsername) {
        await deleteDoc(doc(db, "moderation_banned_names", targetUsername.trim().toLowerCase())).catch(() => {});
      }

      // Also clean by clean value itself if clean is a username
      await deleteDoc(doc(db, "moderation_banned_names", clean.toLowerCase())).catch(() => {});

      // 2. Broadcast real-time unban signal to target client
      const unbanSig = {
        type: "moderation_unban",
        targetUid,
        targetUsername,
        unbannedBy: profile.username,
        timestamp: Date.now(),
      };

      sendBroadcastSignal(unbanSig);
      try {
        wsClient.sendSignal(unbanSig);
      } catch (e) {}

      // 3. Update local state
      setBannedList((prev) =>
        prev.filter(
          (b) =>
            b.uid !== targetUid &&
            b.id !== targetUid &&
            b.targetUid !== targetUid &&
            b.username?.toLowerCase() !== targetUsername.toLowerCase() &&
            b.username?.toLowerCase() !== clean.toLowerCase()
        )
      );

      setManualUnbanInput("");
      setUnbanSuccessMsg(`Successfully unbanned "${targetUsername}"!`);
      setTimeout(() => setUnbanSuccessMsg(null), 3500);
    } catch (err: any) {
      setUnbanErrorMsg("Failed to unban user: " + (err?.message || "Unknown error"));
      setTimeout(() => setUnbanErrorMsg(null), 3500);
    } finally {
      setIsUnbanning(false);
    }
  };

  const updateTypingStatus = async (typing: boolean) => {
    if (!profile || (activeModeration && activeModeration.type === "ban")) return;
    const typingRef = doc(db, "typing", `${activeChannel}_${profile.uid}`);
    if (typing) {
      setIsLocalTyping(true);
      await setDoc(typingRef, {
        uid: profile.uid,
        username: profile.username,
        channelId: activeChannel,
        timestamp: Date.now(),
      }).catch((err) => console.warn("Error setting typing status:", err));
    } else {
      setIsLocalTyping(false);
      await deleteDoc(typingRef).catch((err) => console.warn("Error deleting typing status:", err));
    }
  };

  // Listen for active typing users in the current channel
  useEffect(() => {
    if (!profile?.uid) return;
    const q = query(collection(db, "typing"));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: any[] = [];
        const now = Date.now();
        snapshot.docs.forEach((d: any) => {
          const data = d.data();
          if (
            data.uid !== profile.uid &&
            data.channelId === activeChannel &&
            data.timestamp > now - 10000
          ) {
            list.push(data);
          }
        });
        setTypingUsers(list);
      },
      (error) => {
        console.warn("Typing listener error:", error);
      }
    );

    return () => unsub();
  }, [activeChannel, profile?.uid]);

  // Periodic pruning of dead typing heartbeats
  useEffect(() => {
    const checkStale = setInterval(() => {
      const now = Date.now();
      setTypingUsers((prev) =>
        prev.filter((user) => user.timestamp > now - 10000)
      );
    }, 1500);
    return () => clearInterval(checkStale);
  }, []);

  // Cleanup local typing state and reset scroll position on active channel change
  useEffect(() => {
    if (isLocalTyping) {
      updateTypingStatus(false);
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    isInitialLoadRef.current = true;
    isUserScrolledUpRef.current = false;
    lastKnownLatestMsgIdRef.current = null;
    lastKnownLatestMsgTimestampRef.current = 0;
    setShowScrollBottomBtn(false);
  }, [activeChannel]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (profile) {
        const typingRef = doc(db, "typing", `${activeChannel}_${profile.uid}`);
        deleteDoc(typingRef).catch(() => {});
      }
    };
  }, []);

  // 1-second tick to continuously evaluate active vs dead/lagging peers in real-time
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Real-time listener for voice users combining Firestore and WebSocket
  useEffect(() => {
    const unsubWsVoice = wsClient.onCollectionChange("voice_users", (change) => {
      if (!change || !change.data) return;
      const data = change.data as any;
      if (!data.uid && !data.username) return;

      const uid = data.uid || data.username;
      const uname = (data.username || "").trim();
      const now = Date.now();
      const ts = toTimestampMs(data.timestamp || data.lastSeen || now);

      if (change.op === "delete" || data.status === "left") {
        setActiveVoiceUsers((prev) => {
          const next = { ...prev };
          delete next[uid];
          return next;
        });
        setVoiceUsersMap((prev) => {
          const next = new Map(prev);
          next.delete(uid);
          if (uname) next.delete(uname.toLowerCase());
          return next;
        });
        return;
      }

      const voiceObj = {
        ...data,
        uid,
        username: uname || "User",
        timestamp: ts,
        inVoice: true,
      };

      setActiveVoiceUsers((prev) => ({ ...prev, [uid]: voiceObj }));
      setVoiceUsersMap((prev) => {
        const next = new Map(prev);
        next.set(uid, voiceObj);
        if (uname) next.set(uname.toLowerCase(), voiceObj);
        return next;
      });
    });

    const unsubVoice = onSnapshot(
      collection(db, "voice_users"),
      (snapshot: any) => {
        const now = Date.now();
        const vMap = new Map<string, any>();
        const voiceMembers: MemberUser[] = [];
        const rawDict: Record<string, any> = {};

        snapshot.docs.forEach((d: any) => {
          const data = d.data() as any;
          const uname = (data?.username || "").trim();
          const uid = data?.uid || d.id;
          if (!uid || !uname) return;

          const ts = toTimestampMs(data.timestamp || data.lastSeen || now);
          const isAlive = (ts > 0 && Math.abs(now - ts) <= 60000) || uid === profile?.uid;
          if (!isAlive) return;

          const voiceObj = {
            ...data,
            uid,
            username: uname,
            timestamp: ts,
            inVoice: true,
          };

          rawDict[uid] = voiceObj;
          vMap.set(uid, voiceObj);
          vMap.set(uname.toLowerCase(), voiceObj);

          voiceMembers.push({
            uid,
            username: uname,
            photoURL: data.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(uname)}`,
            status: "online",
            lastSeen: ts,
            isMuted: Boolean(data.isMuted),
            isVideoOn: Boolean(data.isVideoOn),
            isScreenSharing: Boolean(data.isScreenSharing),
            inVoice: true,
            channelName: data.channelName || "General Voice",
            activity: data.activity,
          });
        });

        setActiveVoiceUsers(rawDict);
        setVoiceUsersMap(vMap);

        // Immediately merge active voice users into memberUsers so they appear in general chat
        if (voiceMembers.length > 0) {
          setMemberUsers((prev) => {
            const map = new Map<string, MemberUser>();
            prev.forEach((u) => map.set((u.username || u.uid).toLowerCase(), u));
            voiceMembers.forEach((vu) => {
              const key = (vu.username || vu.uid).toLowerCase();
              const existing = map.get(key);
              map.set(key, { ...existing, ...vu });
            });
            return Array.from(map.values());
          });
        }
      },
      (error) => {
        console.warn("ChatPanel voice_users listener error:", error);
      }
    );

    return () => {
      unsubWsVoice();
      unsubVoice();
    };
  }, [profile?.uid]);

  // Sync propVoiceUsers if provided from parent Chat component
  useEffect(() => {
    if (!propVoiceUsers || propVoiceUsers.length === 0) return;
    const now = Date.now();
    const voiceMembers: MemberUser[] = [];
    const vMap = new Map<string, any>(voiceUsersMap);

    propVoiceUsers.forEach((vu) => {
      const uname = (vu.username || "").trim();
      const uid = vu.uid;
      if (!uid || !uname) return;

      const ts = toTimestampMs(vu.timestamp || vu.lastSeen || now);
      if (Math.abs(now - ts) > 60000 && uid !== profile.uid) return;

      const vObj = { ...vu, uid, username: uname, timestamp: ts, inVoice: true };
      vMap.set(uid, vObj);
      vMap.set(uname.toLowerCase(), vObj);

      voiceMembers.push({
        uid,
        username: uname,
        photoURL: vu.photoURL || "",
        status: "online",
        lastSeen: ts,
        isMuted: Boolean(vu.isMuted),
        isVideoOn: Boolean(vu.isVideoOn),
        isScreenSharing: Boolean(vu.isScreenSharing),
        inVoice: true,
        channelName: vu.channelName || "General Voice",
        activity: vu.activity,
      });
    });

    setVoiceUsersMap(vMap);

    if (voiceMembers.length > 0) {
      setMemberUsers((prev) => {
        const map = new Map<string, MemberUser>();
        prev.forEach((u) => map.set((u.username || u.uid).toLowerCase(), u));
        voiceMembers.forEach((vu) => {
          const key = (vu.username || vu.uid).toLowerCase();
          const existing = map.get(key);
          map.set(key, { ...existing, ...vu });
        });
        return Array.from(map.values());
      });
    }
  }, [propVoiceUsers, profile.uid]);

  const [localActivity, setLocalActivity] = useState<UserActivity>(() => getCurrentActivity());

  useEffect(() => {
    return onActivityChanged((act) => {
      setLocalActivity(act);
    });
  }, []);

  // Presence & Left Website tracking with fast 2.5s heartbeat + real-time activity
  useEffect(() => {
    if (!profile) return;
    const presenceRef = doc(db, "presence", profile.uid);

    const markOnline = () => {
      broadcastPresenceUpdate();
    };

    const markLeft = async () => {
      try {
        await setDoc(presenceRef, {
          uid: profile.uid,
          username: profile.username,
          photoURL: profile.photoURL || "",
          status: "left",
          lastSeen: Date.now(),
          timestamp: Date.now(),
          inVoice: false,
        }, { merge: true }).catch(() => {});
      } catch (e) {}
    };

    markOnline();
    const interval = setInterval(markOnline, 2500); // 2.5s rapid heartbeat for real-time accuracy

    const handleUnload = () => {
      markLeft();
    };

    window.addEventListener("beforeunload", handleUnload);
    window.addEventListener("pagehide", handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleUnload);
      window.removeEventListener("pagehide", handleUnload);
    };
  }, [profile]);

  // Real-time member presence listener (WebSocket 0ms + Firestore/Database fallback)
  useEffect(() => {
    // 1. Instant WebSocket listener for 0ms presence changes
    const unsubWs = wsClient.onCollectionChange("presence", (change) => {
      if (!change || !change.data) return;
      const data = change.data as any;
      if (!data.uid) return;

      setMemberUsers((prev) => {
        const existingIdx = prev.findIndex((u) => u.uid === data.uid);
        const unameClean = (data.username || "").toLowerCase();
        const vInfo = voiceUsersMap.get(data.uid) || voiceUsersMap.get(unameClean);

        const updatedUser: MemberUser = {
          uid: data.uid,
          username: data.username || "User",
          photoURL: data.photoURL || "",
          status: data.status || "online",
          lastSeen: toTimestampMs(data.lastSeen || data.timestamp || Date.now()),
          isMuted: vInfo?.isMuted ?? (data.isMuted || false),
          isVideoOn: vInfo?.isVideoOn ?? (data.isVideoOn || false),
          isScreenSharing: vInfo?.isScreenSharing ?? (data.isScreenSharing || false),
          inVoice: Boolean(vInfo) || Boolean(data.inVoice),
          channelName: vInfo?.channelName || data.channelName,
          activity: data.activity,
        };

        if (change.op === "delete" || data.status === "left") {
          return prev.map((u) => (u.uid === data.uid ? { ...u, status: "left", inVoice: false } : u));
        }

        if (existingIdx >= 0) {
          const next = [...prev];
          next[existingIdx] = { ...next[existingIdx], ...updatedUser };
          return next;
        } else {
          return [updatedUser, ...prev];
        }
      });
    });

    // 2. Snapshot listener for database sync
    const q = query(
      collection(db, "presence"),
      orderBy("lastSeen", "desc"),
      limit(50)
    );
    const unsub = onSnapshot(
      q,
      (snapshot: any) => {
        const users: MemberUser[] = [];
        snapshot.forEach((docSnap: any) => {
          const data = docSnap.data() as any;
          const uname = (data.username || "").trim();
          if (!uname || !isAllowedUsername(uname, docSnap.id, profile?.uid)) {
            return;
          }
          const unameClean = uname.toLowerCase();
          const vInfo = voiceUsersMap.get(docSnap.id) || voiceUsersMap.get(unameClean);

          users.push({
            uid: docSnap.id,
            username: uname,
            photoURL: data.photoURL || "",
            status: data.status || "online",
            lastSeen: toTimestampMs(data.lastSeen),
            isMuted: vInfo?.isMuted ?? (data.isMuted || false),
            isVideoOn: vInfo?.isVideoOn ?? (data.isVideoOn || false),
            isScreenSharing: vInfo?.isScreenSharing ?? (data.isScreenSharing || false),
            inVoice: Boolean(vInfo) || Boolean(data.inVoice),
            channelName: vInfo?.channelName || data.channelName,
            activity: data.activity,
          });
        });

        // Ensure current profile is present if valid and not already in the list by unique UID
        if (profile?.uid && !users.some((u) => u.uid === profile.uid)) {
          const myVInfo = voiceUsersMap.get(profile.uid) || voiceUsersMap.get((profile.username || "").toLowerCase());
          users.unshift({
            uid: profile.uid,
            username: profile.username,
            photoURL: profile.photoURL,
            status: "online",
            lastSeen: Date.now(),
            inVoice: Boolean(myVInfo),
            isMuted: Boolean(myVInfo?.isMuted),
            isVideoOn: Boolean(myVInfo?.isVideoOn),
            isScreenSharing: Boolean(myVInfo?.isScreenSharing),
            channelName: myVInfo?.channelName,
            activity: getCurrentActivity(),
          });
        }

        setMemberUsers((prev) => {
          const newUserMap = new Map<string, MemberUser>();
          // 1. Start with new users from database
          users.forEach(u => newUserMap.set(u.uid, u));
          // 2. Merge with existing users from RAM (WebSocket) if they are more recent
          prev.forEach(u => {
            const existing = newUserMap.get(u.uid);
            if (!existing || (u.lastSeen && u.lastSeen > (existing.lastSeen || 0))) {
              newUserMap.set(u.uid, { ...existing, ...u });
            }
          });
          return Array.from(newUserMap.values());
        });
      },
      (error) => {
        console.warn("ChatPanel presence listener error:", error);
      }
    );

    return () => {
      unsubWs();
      unsub();
    };
  }, [profile, voiceUsersMap]);

  // Real-time message subscription with instant local rendering and fast pagination
  useEffect(() => {
    if (!globalMessagesLoaded && initialCache.length === 0) {
      setIsLoadingMessages(true);
    }
    const q = query(
      collection(db, "messages"),
      orderBy("timestamp", "desc"),
      limit(messageLimit)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot: any) => {
        const newMessages: ChatMessage[] = [];
        snapshot.forEach((docSnap: any) => {
          if (deletedMessageIdsRef.current.has(docSnap.id)) {
            return;
          }
          const data = docSnap.data() as any;
          newMessages.push({
            id: docSnap.id,
            ...data,
            timestamp: toTimestampMs(data.timestamp),
          } as ChatMessage);
        });

        // If returned messages equal or exceed limit, more older messages exist
        setHasMoreOlderMessages(newMessages.length >= messageLimit);

        setMessages((prev) => {
          const now = Date.now();
          // Keep only true local optimistic messages that haven't arrived in the snapshot yet (<8s old)
          const pending = prev.filter(
            (m) =>
              !deletedMessageIdsRef.current.has(m.id) &&
              Boolean((m as any)._isOptimistic) &&
              now - (toTimestampMs(m.timestamp) || 0) < 8000 &&
              !newMessages.some((sm) => sm.id === m.id)
          );

          const combinedMap = new Map<string, ChatMessage>();
          newMessages.forEach((m) => {
            if (!deletedMessageIdsRef.current.has(m.id)) {
              combinedMap.set(m.id, m);
            }
          });
          pending.forEach((m) => {
            if (!deletedMessageIdsRef.current.has(m.id)) {
              combinedMap.set(m.id, m);
            }
          });

          const finalMessages = Array.from(combinedMap.values()).sort(compareMessagesChronological);
          saveCachedMessages(finalMessages);
          return finalMessages;
        });
        setIsLoadingMessages(false);
        setIsLoadingOlder(false);

        // 1. If we just loaded older messages from the top, PRESERVE exact scroll position
        if (isLoadingOlderRef.current) {
          requestAnimationFrame(() => {
            if (chatContainerRef.current && prevScrollHeightRef.current > 0) {
              const newScrollHeight = chatContainerRef.current.scrollHeight;
              const heightDiff = newScrollHeight - prevScrollHeightRef.current;
              chatContainerRef.current.scrollTop += heightDiff;
            }
            isLoadingOlderRef.current = false;
            prevScrollHeightRef.current = 0;
          });
          return;
        }

        // 2. Initial load: scroll to bottom once
        if (isInitialLoadRef.current) {
          isInitialLoadRef.current = false;
          if (newMessages.length > 0) {
            const latest = [...newMessages].sort(compareMessagesChronological).pop();
            lastKnownLatestMsgIdRef.current = latest?.id || null;
            lastKnownLatestMsgTimestampRef.current = latest ? toTimestampMs(latest.timestamp) : 0;
          }
          window.setTimeout(() => scrollToBottom("auto"), 50);
          return;
        }

        // 3. Detect if a brand new message actually arrived (must be strictly newer timestamp)
        const latestMessage = newMessages.length > 0
          ? [...newMessages].sort(compareMessagesChronological).pop()
          : null;

        const latestTimestamp = latestMessage ? toTimestampMs(latestMessage.timestamp) : 0;
        const isStrictlyNewer = latestTimestamp > lastKnownLatestMsgTimestampRef.current;

        const isNewIncomingMessage =
          Boolean(latestMessage) &&
          isStrictlyNewer &&
          latestMessage?.id !== lastKnownLatestMsgIdRef.current;

        if (latestMessage) {
          lastKnownLatestMsgIdRef.current = latestMessage.id;
          if (latestTimestamp > lastKnownLatestMsgTimestampRef.current) {
            lastKnownLatestMsgTimestampRef.current = latestTimestamp;
          }
          if (isNewIncomingMessage && latestMessage.uid !== profile.uid) {
            playChatSound("receive");
          }
        }

        // 4. CRITICAL: When scrolling or reading through older messages,
        // DO NOT automatically jump or scroll to latest messages!
        const container = chatContainerRef.current;
        if (!container) return;

        const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        const isAtBottom = distanceFromBottom <= 40 && !isUserScrolledUpRef.current;

        // Only maintain bottom pin if user is already at the bottom AND a new message arrived
        if (isAtBottom && isNewIncomingMessage) {
          window.setTimeout(() => scrollToBottom("smooth"), 30);
        }
      },
      (error) => {
        setIsLoadingMessages(false);
        setIsLoadingOlder(false);
        handleFirestoreError(error, OperationType.LIST, "messages");
      }
    );

    // Listen to real-time deletion events via WebSocket so deleted messages vanish instantly and permanently
    const unsubWsMsg = wsClient.onCollectionChange("messages", (change) => {
      if (!change || !change.id) return;
      if (change.op === "delete") {
        deletedMessageIdsRef.current.add(change.id);
        saveDeletedMessageId(change.id);
        playChatSound("delete");
        setMessages((prev) => {
          const updated = prev.filter((m) => m.id !== change.id);
          saveCachedMessages(updated);
          return updated;
        });
      }
    });

    return () => {
      unsubscribe();
      unsubWsMsg();
    };
  }, [messageLimit]);

  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    // Mark as scrolled up if more than 40px away from the bottom
    const isScrolledUp = distanceFromBottom > 40;
    isUserScrolledUpRef.current = isScrolledUp;
    setShowScrollBottomBtn(distanceFromBottom > 140);
  };

  const handleLoadOlderMessages = () => {
    if (chatContainerRef.current) {
      prevScrollHeightRef.current = chatContainerRef.current.scrollHeight;
      isLoadingOlderRef.current = true;
    }
    setIsLoadingOlder(true);
    setMessageLimit((prev) => prev + 50);
  };

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior,
      });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior });
    }
  };

  const handleDeleteMessage = async (msgId: string, event?: React.MouseEvent) => {
    // 1. Explicitly blur active element so Chromium/WebKit doesn't scroll to the top of the container
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    const targetMsg = messages.find((m) => m.id === msgId);
    if (!targetMsg) return;

    const isMyMsg = targetMsg.uid === profile.uid || targetMsg.username === profile.username;
    const isAuthorMod = isUserModerator(targetMsg.username, targetMsg.uid);
    const isCurrentMod = isUserModerator(profile.username, profile.uid);

    // CRITICAL: You cannot delete messages sent by another moderator!
    if (isAuthorMod && !isMyMsg) {
      showModerationAlert("Action Forbidden", "You cannot delete messages sent by another moderator.");
      return;
    }

    if (!isMyMsg && !isCurrentMod) {
      showModerationAlert("Permission Denied", "Only moderators can delete other users' messages.");
      return;
    }

    // 2. Mark this message ID as deleted permanently in local tombstones
    deletedMessageIdsRef.current.add(msgId);
    saveDeletedMessageId(msgId);

    // 3. Snapshot scroll metrics before DOM manipulation
    const container = chatContainerRef.current;
    let savedScrollTop = 0;
    let savedScrollHeight = 0;
    let wasAtBottom = false;
    let msgElOffsetTop = 0;
    let msgElHeight = 0;

    if (container) {
      savedScrollTop = container.scrollTop;
      savedScrollHeight = container.scrollHeight;
      const distanceFromBottom = savedScrollHeight - savedScrollTop - container.clientHeight;
      wasAtBottom = distanceFromBottom <= 60 && !isUserScrolledUpRef.current;

      const msgEl = document.getElementById(`msg-item-${msgId}`);
      if (msgEl) {
        msgElOffsetTop = msgEl.offsetTop;
        msgElHeight = msgEl.offsetHeight;
      }
    }

    // 4. Remove immediately from UI state and local cache
    setMessages((prev) => {
      const updated = prev.filter((m) => m.id !== msgId && !deletedMessageIdsRef.current.has(m.id));
      saveCachedMessages(updated);
      return updated;
    });

    // 5. Precisely lock and preserve scroll position so the view NEVER jumps up or shifts!
    if (container) {
      requestAnimationFrame(() => {
        if (!chatContainerRef.current) return;
        const cont = chatContainerRef.current;
        if (wasAtBottom) {
          cont.scrollTop = cont.scrollHeight - cont.clientHeight;
        } else {
          // If the removed element was above the current scroll view, adjust scrollTop so position is stable
          if (msgElOffsetTop + msgElHeight <= savedScrollTop && msgElHeight > 0) {
            cont.scrollTop = Math.max(0, savedScrollTop - msgElHeight);
          } else {
            cont.scrollTop = savedScrollTop;
          }
        }
      });
    }

    try {
      playChatSound("delete");
      await deleteDoc(doc(db, "messages", msgId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `messages/${msgId}`);
    }
  };

  const handleReactMessage = async (msgId: string, emojiOrText: string) => {
    const cleanKey = emojiOrText.trim().slice(0, 30);
    if (!cleanKey) return;
    const msg = messages.find((m) => m.id === msgId);
    if (!msg) return;

    playChatSound("reaction");

    const currentReactions = msg.reactions || {};
    const users = currentReactions[cleanKey] || [];
    const hasReacted = users.includes(profile.uid);

    let newUsers;
    if (hasReacted) {
      newUsers = users.filter((u) => u !== profile.uid);
    } else {
      newUsers = [...users, profile.uid];
    }

    const newReactions = { ...currentReactions };
    if (newUsers.length > 0) {
      newReactions[cleanKey] = newUsers;
    } else {
      delete newReactions[cleanKey];
    }

    // Optimistic update
    setMessages((prev) => {
      const updated = prev.map((m) => {
        if (m.id === msgId) {
          return { ...m, reactions: newReactions };
        }
        return m;
      });
      saveCachedMessages(updated);
      return updated;
    });

    try {
      await updateDoc(doc(db, "messages", msgId), { reactions: newReactions });
    } catch (error) {
      console.warn("Failed to update reaction", error);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const currentText = text.trim();

    // /clear or /delete-all command to instantly wipe non-moderator messages
    if (currentText === "/clear" || currentText === "/clearall" || currentText === "/delete-all") {
      if (!isUserModerator(profile.username, profile.uid)) {
        showModerationAlert("Permission Denied", "Only moderators can run clearance commands.");
        setText("");
        return;
      }
      setText("");
      // Preserve other moderators' messages (cannot delete other moderators' messages)
      const messagesToDelete = messages.filter((m) => {
        const isMy = m.uid === profile.uid || m.username === profile.username;
        const isOtherMod = isUserModerator(m.username, m.uid) && !isMy;
        return !isOtherMod;
      });
      messagesToDelete.forEach((m) => {
        deletedMessageIdsRef.current.add(m.id);
        saveDeletedMessageId(m.id);
      });
      const preservedMessages = messages.filter((m) => {
        const isMy = m.uid === profile.uid || m.username === profile.username;
        const isOtherMod = isUserModerator(m.username, m.uid) && !isMy;
        return isOtherMod;
      });
      setMessages(preservedMessages);
      saveCachedMessages(preservedMessages);
      try {
        for (const msg of messagesToDelete) {
          await deleteDoc(doc(db, "messages", msg.id)).catch(() => {});
        }
      } catch (err) {}
      return;
    }

    // Check if user is a guest
    if (isGuestUser(profile.username)) {
      showModerationAlert("Guest Access Restricted", "Guest users do not have access to chat or calls. Please log in with an authorized account.");
      return;
    }

    // Check if user is currently banned
    if (activeModeration && activeModeration.type === "ban") {
      showModerationAlert("Account Banned", "You are currently banned and cannot send messages.");
      return;
    }

    let currentAttachment = attachment;
    const currentType = attachmentType;
    const currentName = attachmentName;
    const currentSize = attachmentSize;
    if (!currentText && !currentAttachment) return;

    // Check Chat Lock
    if (isChatLocked && !isUserModerator(profile.username, profile.uid)) {
      showModerationAlert("Chat Temporarily Paused", "Chat has been temporarily locked by community moderators. Please wait a moment.");
      return;
    }

    // Check Slowmode Cooldown
    if (slowmodeCooldown > 0) {
      const now = Date.now();
      const storedLastTs = localStorage.getItem("last_msg_ts");
      const lastTs = storedLastTs ? Number(storedLastTs) : lastUserMessageTimeRef.current;
      const elapsed = (now - lastTs) / 1000;

      if (elapsed < slowmodeCooldown) {
        const remaining = Math.ceil(slowmodeCooldown - elapsed);
        showModerationAlert("Slowmode Active", `Channel slowmode is enabled (${slowmodeCooldown}s). Please wait ${remaining} second${remaining === 1 ? "" : "s"} before sending another message.`);
        return;
      }
      lastUserMessageTimeRef.current = now;
      localStorage.setItem("last_msg_ts", String(now));
    }

    if (isUploading || (currentAttachment && currentAttachment.startsWith("blob:"))) {
      showModerationAlert(
        "Still uploading",
        "Please wait a moment for your file to finish uploading before sending.",
        currentType || undefined
      );
      return;
    }

    // Strict moderation check for text content
    if (currentText) {
      const textCheck = checkTextModeration(currentText);
      if (!textCheck.safe) {
        showModerationAlert(
          "Can't send this message",
          textCheck.reason || "Your message contains words that aren't allowed in chat. Please edit it and try again.",
          currentType || undefined
        );
        return;
      }
    }

    // Strict moderation check for attachment name
    if (currentName) {
      const nameCheck = checkTextModeration(currentName);
      if (!nameCheck.safe) {
        showModerationAlert(
          "Can't send this file",
          nameCheck.reason || "The file name contains words that aren't allowed.",
          currentType || undefined
        );
        return;
      }
    }

    // Attach original file name, MIME type, and size to the URL so all other users receive exact name & extension
    if (currentAttachment && currentName && !currentAttachment.startsWith("data:") && !currentAttachment.includes("?name=") && !currentAttachment.includes("&name=")) {
      const sep = currentAttachment.includes("?") ? "&" : "?";
      currentAttachment = `${currentAttachment}${sep}name=${encodeURIComponent(currentName)}&type=${encodeURIComponent(currentType || "")}&size=${currentSize || 0}`;
    }

    const msgId = "doc_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
    // const tempId = "temp_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
    const now = Date.now();

    // Optimistically show message immediately on sender's screen (0ms latency)
    const optimisticMsg: ChatMessage = {
      id: msgId,
      channelId: activeChannel,
      uid: profile.uid,
      username: profile.username,
      photoURL: profile.photoURL || "",
      timestamp: now,
      _isOptimistic: true,
      ...(currentText ? { text: currentText } : {}),
      ...(currentAttachment ? { 
        attachment: currentAttachment,
        attachmentType: currentType || undefined,
        attachmentName: currentName || undefined,
        attachmentSize: currentSize || undefined,
      } : {}),
    };

    setMessages((prev) =>
      [...prev.filter((m) => m.id !== msgId), optimisticMsg].sort(compareMessagesChronological)
    );
    playChatSound("send");
    setText("");
    if (isLocalTyping) {
      updateTypingStatus(false);
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    setAttachment(null);
    setAttachmentType(null);
    setAttachmentName(null);
    setAttachmentSize(null);
    setIsUploading(false);
    setUploadProgress(null);
    setUploadingFileInfo(null);
    stagedBlobUrlRef.current = null;
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    inputRef.current?.focus();
    isUserScrolledUpRef.current = false;
    window.setTimeout(() => scrollToBottom("smooth"), 10);

    try {
      const msgData: Record<string, any> = {
        channelId: activeChannel,
        uid: profile.uid,
        username: profile.username,
        photoURL: profile.photoURL || "",
        timestamp: now,
      };

      if (currentText) {
        msgData.text = currentText;
      }
      if (currentAttachment) {
        msgData.attachment = currentAttachment;
        if (currentType) msgData.attachmentType = currentType;
        if (currentName) msgData.attachmentName = currentName;
        if (currentSize) msgData.attachmentSize = currentSize;
      }

      // Check moderation for text and media (images, videos, gifs, and their titles)
      try {
        const modRes = await fetch("/api/moderate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            text: currentText, 
            mediaUrl: currentAttachment && !currentAttachment.startsWith("blob:") ? currentAttachment : undefined,
            mediaTitle: currentName || undefined,
            mediaType: currentType || undefined,
            mediaSize: currentSize || undefined,
          }),
        });

        if (modRes.ok) {
          const modData = await modRes.json();
          if (modData && modData.safe === false) {
            // Unsafe content or title detected
            setMessages((prev) => prev.filter((m) => m.id !== msgId));
            showModerationAlert(
              "Can't send this message",
              modData.reason || "This content doesn't meet our community guidelines. Please adjust it and try again.",
              currentType || undefined
            );
            return;
          }
        }
      } catch (err) {
        console.warn("Moderation check skipped due to temporary network notice:", err);
      }

      await setDoc(doc(db, "messages", msgId), msgData);
    } catch (error) {
      // Revert optimistic message if writing failed
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
      handleFirestoreError(error, OperationType.CREATE, "messages");
    }
  };

  const handleSendGif = async (gifUrl: string, gifTitle?: string) => {
    if (!gifUrl) return;

    // Check GIF title and URL text before sending
    if (gifTitle) {
      const titleCheck = checkTextModeration(gifTitle);
      if (!titleCheck.safe) {
        showModerationAlert(
          "Can't send this GIF",
          titleCheck.reason || "This GIF contains words that aren't allowed in chat. Please choose a different one.",
          "image/gif"
        );
        return;
      }
    }

    const msgId = "doc_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
    const now = Date.now();

    // Optimistically show GIF immediately (0ms latency)
    const optimisticMsg: ChatMessage = {
      id: msgId,
      channelId: activeChannel,
      uid: profile.uid,
      username: profile.username,
      photoURL: profile.photoURL || "",
      gif: gifUrl,
      gifTitle: gifTitle || undefined,
      timestamp: now,
      _isOptimistic: true,
    };

    setMessages((prev) =>
      [...prev.filter((m) => m.id !== msgId), optimisticMsg].sort(compareMessagesChronological)
    );
    setShowGiphy(false);
    isUserScrolledUpRef.current = false;
    window.setTimeout(() => scrollToBottom("smooth"), 10);

    try {
      const msgData: Record<string, any> = {
        channelId: activeChannel,
        uid: profile.uid,
        username: profile.username,
        photoURL: profile.photoURL || "",
        gif: gifUrl,
        timestamp: now,
      };
      if (gifTitle) {
        msgData.gifTitle = gifTitle;
      }

      // Check moderation for GIF and its title
      try {
        const modRes = await fetch("/api/moderate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            mediaUrl: gifUrl,
            mediaTitle: gifTitle || "GIF",
            mediaType: "image/gif"
          }),
        });

        if (modRes.ok) {
          const modData = await modRes.json();
          if (modData && modData.safe === false) {
            // Unsafe GIF or GIF title detected
            setMessages((prev) => prev.filter((m) => m.id !== msgId));
            showModerationAlert(
              "Can't send this GIF",
              modData.reason || "This GIF doesn't meet our community guidelines. Please pick another one.",
              "image/gif"
            );
            return;
          }
        }
      } catch (err) {
        console.warn("GIF moderation check skipped due to temporary network notice:", err);
      }

      await setDoc(doc(db, "messages", msgId), msgData);
    } catch (error) {
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
      handleFirestoreError(error, OperationType.CREATE, "messages");
    }
  };

  const cancelUpload = () => {
    // 1. Invalidate session so pending callbacks are discarded
    uploadSessionIdRef.current++;

    // 2. Abort XHR request
    if (uploadAbortControllerRef.current) {
      try {
        uploadAbortControllerRef.current.abort();
      } catch (e) {}
      uploadAbortControllerRef.current = null;
    }

    // 3. Clean up blob memory if one was generated
    if (stagedBlobUrlRef.current) {
      try {
        URL.revokeObjectURL(stagedBlobUrlRef.current);
      } catch (e) {}
      stagedBlobUrlRef.current = null;
    }

    // 4. Wipe attachment state cleanly
    setAttachment(null);
    setAttachmentType(null);
    setAttachmentName(null);
    setAttachmentSize(null);
    setIsUploading(false);
    setUploadProgress(null);
    setUploadingFileInfo(null);

    // 5. Reset file input value so user can immediately re-select
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadFile = async (file: File) => {
    // Abort any existing upload and start a new session
    if (uploadAbortControllerRef.current) {
      try {
        uploadAbortControllerRef.current.abort();
      } catch (e) {}
    }

    if (stagedBlobUrlRef.current) {
      try {
        URL.revokeObjectURL(stagedBlobUrlRef.current);
      } catch (e) {}
      stagedBlobUrlRef.current = null;
    }

    // Pre-check filename against slurs, curse words, and sexual terms
    const nameCheck = checkTextModeration(file.name);
    if (!nameCheck.safe) {
      showModerationAlert(
        "Can't attach this file",
        `The file "${file.name}" has a name that isn't allowed: ${nameCheck.reason || "Please rename the file and try again."}`,
        file.type
      );
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    const sessionId = ++uploadSessionIdRef.current;
    const abortController = new AbortController();
    uploadAbortControllerRef.current = abortController;

    // 1. Synchronously stage instant preview in 0ms
    let localBlobUrl = "";
    try {
      localBlobUrl = URL.createObjectURL(file);
      stagedBlobUrlRef.current = localBlobUrl;
    } catch (e) {
      localBlobUrl = "";
    }

    setAttachment(localBlobUrl || "pending");
    setAttachmentType(file.type || "application/octet-stream");
    setAttachmentName(file.name);
    setAttachmentSize(file.size);

    setIsUploading(true);
    setUploadProgress(5);
    setUploadingFileInfo({ name: file.name, size: file.size });

    try {
      const result: any = await (cassandra.storage as any).upload(
        file,
        (percent: number) => {
          if (uploadSessionIdRef.current === sessionId) {
            setUploadProgress(percent);
          }
        },
        abortController
      );

      // If user cancelled or switched files in the meantime, ignore this result completely
      if (uploadSessionIdRef.current !== sessionId) return;

      const url = typeof result === "string" ? result : result?.url || "";
      const resMime = typeof result === "object" ? result?.mimetype : null;
      const resName = typeof result === "object" ? result?.filename : null;
      const resSize = typeof result === "object" ? result?.size : null;

      const finalUrl = url || localBlobUrl;
      const finalMime = resMime || file.type || "application/octet-stream";
      const finalName = resName || file.name || "attachment";
      const finalSize = resSize || file.size || 0;

      if (finalUrl) {
        setAttachment(finalUrl);
      }
      setAttachmentType(finalMime);
      setAttachmentName(finalName);
      setAttachmentSize(finalSize);
    } catch (error: any) {
      if (uploadSessionIdRef.current !== sessionId) return;

      if (error?.isModerationBlock || error?.message?.includes("blocked")) {
        cancelUpload();
        showModerationAlert(
          "Can't attach this file",
          error.reason || error.message || `This file doesn't meet our community guidelines. Please choose a different file.`,
          file.type
        );
        return;
      }

      if (error?.message?.includes("cancelled") || error?.message?.includes("aborted")) {
        console.log("Upload cancelled by user");
        return;
      }
      console.warn("Storage upload fallback invoked:", error);
      // Fallback already has localBlobUrl in attachment
      if (!attachment && localBlobUrl) {
        setAttachment(localBlobUrl);
      }
    } finally {
      if (uploadSessionIdRef.current === sessionId) {
        setIsUploading(false);
        setUploadProgress(null);
        setUploadingFileInfo(null);
        uploadAbortControllerRef.current = null;
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
      e.preventDefault();
      const file = e.clipboardData.files[0];
      uploadFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      uploadFile(file);
    }
    // Always clear input value so picking the same file again or picking a new file fires onChange properly
    if (e.target) {
      e.target.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      uploadFile(file);
    }
  };

  const formatTimestamp = (ts: number) => {
    if (!ts) return "";
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const channelMessages = useMemo(() => {
    return messages.filter((m) => {
      // If message is malformed (has no text, attachment, or gif), filter it out
      if (!m.text && !m.attachment && !m.gif) {
        return false;
      }
      // If message has channelId, ensure it belongs to activeChannel (case-insensitive)
      if (m.channelId && activeChannel && m.channelId.toLowerCase() !== activeChannel.toLowerCase()) {
        return false;
      }
      return true;
    });
  }, [messages, activeChannel]);

  const filteredMessages = useMemo(() => {
    const list = searchQuery.trim()
      ? channelMessages.filter(
          (m) =>
            m.text?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            m.username.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : channelMessages;

    return [...list].sort(compareMessagesChronological);
  }, [channelMessages, searchQuery]);

  // Unified computation for In-Voice Users, Online Users, and Left Users
  const {
    activeOnlineUsers,
    inVoiceUsers,
    standardOnlineUsers,
    leftUsers,
  } = useMemo(() => {
    const userMap = new Map<string, MemberUser>();
    const myNameClean = (profile.username || "").trim().toLowerCase();
    const now = currentTime;

    // 1. Ingest all candidates from memberUsers, voiceUsersMap, and CallContext
    const candidates: MemberUser[] = [...memberUsers];

    voiceUsersMap.forEach((vu) => {
      candidates.push({
        uid: vu.uid,
        username: vu.username,
        photoURL: vu.photoURL || "",
        status: "online",
        lastSeen: toTimestampMs(vu.timestamp || now),
        isMuted: Boolean(vu.isMuted),
        isVideoOn: Boolean(vu.isVideoOn),
        isScreenSharing: Boolean(vu.isScreenSharing),
        inVoice: true,
        channelName: vu.channelName || "General Voice",
        activity: vu.activity,
      });
    });

    if (callCtx?.onlineUsers) {
      callCtx.onlineUsers.forEach((cu) => {
        candidates.push({
          uid: cu.uid,
          username: cu.username,
          photoURL: cu.photoURL || "",
          status: (cu.status as any) || "online",
          lastSeen: now,
          activity: cu.activity,
        });
      });
    }

    candidates.forEach((u) => {
      const uNameClean = (u.username || "").trim().toLowerCase();
      if (!uNameClean || uNameClean === "anonymous" || !isAllowedUsername(uNameClean, u.uid, profile.uid)) return;

      const isMe = u.uid === profile.uid || uNameClean === myNameClean;
      const lastSeenMs = toTimestampMs(u.lastSeen);
      const vInfo = voiceUsersMap.get(u.uid) || voiceUsersMap.get(uNameClean);
      const isVoiceActive = isMe
        ? Boolean(getVoiceState().inVoice || vInfo)
        : Boolean(vInfo || (u.inVoice && u.status !== "left"));

      // Heartbeat window: 60s for all active participants to prevent flickering
      const timeDiff = Math.abs(now - lastSeenMs);
      const isRecentlyActive = timeDiff < 60000;
      const isValid = isMe || isVoiceActive || (isRecentlyActive && u.status !== "left");

      if (isValid) {
        const existing = userMap.get(uNameClean);
        const effectiveVoice = isVoiceActive;
        const effectiveMuted = vInfo?.isMuted ?? u.isMuted ?? existing?.isMuted ?? false;
        const effectiveVideo = vInfo?.isVideoOn ?? u.isVideoOn ?? existing?.isVideoOn ?? false;
        const effectiveScreen = vInfo?.isScreenSharing ?? u.isScreenSharing ?? existing?.isScreenSharing ?? false;

        userMap.set(uNameClean, {
          ...existing,
          ...u,
          uid: isMe ? profile.uid : (u.uid || existing?.uid || uNameClean),
          inVoice: effectiveVoice,
          isMuted: effectiveMuted,
          isVideoOn: effectiveVideo,
          isScreenSharing: effectiveScreen,
          channelName: vInfo?.channelName || u.channelName || existing?.channelName || (effectiveVoice ? "General Voice" : undefined),
          status: "online",
          lastSeen: Math.max(lastSeenMs, toTimestampMs(existing?.lastSeen) || 0),
          activity: isMe ? (getCurrentActivity() || localActivity || u.activity) : (u.activity || existing?.activity),
        });
      }
    });

    const all = Array.from(userMap.values()).sort((a, b) => {
      const aIsMe = a.uid === profile.uid || (a.username || "").toLowerCase() === myNameClean;
      const bIsMe = b.uid === profile.uid || (b.username || "").toLowerCase() === myNameClean;
      if (aIsMe) return -1;
      if (bIsMe) return 1;
      if (a.inVoice && !b.inVoice) return -1;
      if (!a.inVoice && b.inVoice) return 1;
      return (a.username || "").localeCompare(b.username || "");
    });

    const inVoice = all.filter((u) => u.inVoice);
    const standard = all.filter((u) => !u.inVoice);

    const onlineKeys = new Set(all.map((u) => (u.username || "").toLowerCase()));
    const leftMap = new Map<string, MemberUser>();
    memberUsers.forEach((u) => {
      const key = (u.username || "").trim().toLowerCase();
      if (!key || onlineKeys.has(key) || u.uid === profile.uid || key === myNameClean) return;
      const lastSeenMs = toTimestampMs(u.lastSeen);
      if (now - lastSeenMs < 120000) {
        leftMap.set(key, u);
      }
    });

    return {
      activeOnlineUsers: all,
      inVoiceUsers: inVoice,
      standardOnlineUsers: standard,
      leftUsers: Array.from(leftMap.values()).sort((a, b) => (a.username || "").localeCompare(b.username || "")),
    };
  }, [memberUsers, profile.uid, profile.username, currentTime, voiceUsersMap, callCtx?.onlineUsers, localActivity]);

  const renderAttachment = (msg: ChatMessage) => {
    if (!msg.attachment) return null;

    return (
      <MediaAttachment
        url={msg.attachment}
        type={msg.attachmentType}
        name={msg.attachmentName}
        size={msg.attachmentSize}
      />
    );
  };

  return (
    <div 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex-1 flex w-full h-full min-h-0 bg-[#03040c] text-white overflow-hidden relative ${
        isDragging ? "ring-2 ring-indigo-500 ring-inset bg-neutral-950/90" : ""
      }`}
    >
      {isDragging && (
        <div className="absolute inset-0 bg-black/75 backdrop-blur-sm z-50 flex flex-col items-center justify-center border-2 border-dashed border-indigo-500/60 m-3 rounded-2xl pointer-events-none animate-in fade-in duration-150">
          <div className="p-6 bg-[#121420] border border-white/10 rounded-2xl shadow-2xl flex flex-col items-center gap-3 text-center max-w-xs">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Upload size={22} className="animate-pulse" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Drop your file here</p>
              <p className="text-xs text-neutral-400 mt-1">Photos, videos, audio clips, or documents</p>
            </div>
          </div>
        </div>
      )}
      {/* Center Chat View matching Image 2 */}
      <div
        style={{ backgroundColor: "var(--theme-chat-bg)" }}
        className="flex-1 flex flex-col min-w-0 h-full"
      >
        {/* Chat Header Bar */}
        <div
          style={{
            backgroundColor: "var(--theme-surface)",
            borderColor: "var(--theme-border-subtle)",
          }}
          className="h-12 px-4 border-b flex items-center justify-between flex-shrink-0"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span
              style={{ color: "var(--theme-text-accent)" }}
              className="text-xl font-bold"
            >
              #
            </span>
            <span className="text-sm font-bold text-white tracking-wide">
              {activeChannel}
            </span>
            <span
              style={{ color: "var(--theme-text-muted)" }}
              className="text-xs font-normal hidden sm:inline ml-1 opacity-80"
            >
              main room
            </span>

            {/* Online Member Pill */}
            <span className="hidden md:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[11px] text-neutral-300 font-medium ml-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{activeOnlineUsers.length} Online</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Search Bar */}
            <div className="relative">
              <Search
                style={{ color: "var(--theme-text-muted)" }}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search messages"
                style={{
                  backgroundColor: "var(--theme-darkest)",
                  borderColor: "var(--theme-border-subtle)",
                }}
                className="h-8 w-32 sm:w-44 border rounded-md pl-8 pr-3 text-xs text-white placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-[var(--theme-border-strong)] transition-all duration-150"
              />
            </div>

            {/* Toggle Member Sidebar Button */}
            {setShowMembersSidebar && (
              <button
                onClick={() => setShowMembersSidebar((prev) => !prev)}
                style={{
                  backgroundColor: showMembersSidebar ? "var(--theme-accent)" : "transparent",
                  borderColor: showMembersSidebar ? "var(--theme-border-strong)" : "transparent",
                  color: showMembersSidebar ? "#ffffff" : "var(--theme-text-muted)",
                }}
                className="p-1.5 rounded-md border transition-all duration-150 active:scale-95 hover:text-white"
                title="Toggle Member List"
              >
                <Users size={18} />
              </button>
            )}

            {/* Moderator Banned Users Management Button */}
            {isUserModerator(profile.username, profile.uid) && (
              <button
                type="button"
                onClick={() => setShowBannedModal(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-950/70 hover:bg-red-900/90 border border-red-700/60 text-xs font-bold text-red-200 transition-all duration-150 active:scale-95 cursor-pointer shadow-sm hover:text-white"
                title="Open Banned Users & Unban Control"
              >
                <Ban size={13} className="text-red-400" />
                <span className="hidden sm:inline">Banned</span>
                {bannedList.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-extrabold leading-none">
                    {bannedList.length}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* 🛡️ Moderation Alert Banner */}
        {moderationWarning && moderationWarning.open && (
          <div className="bg-gradient-to-r from-red-950/95 via-rose-950/90 to-neutral-950 text-white px-4 py-2.5 border-b border-red-500/50 flex items-center justify-between gap-3 text-xs shadow-xl animate-in slide-in-from-top-2 flex-shrink-0 z-10">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 flex-shrink-0">
                <ShieldAlert size={14} className="animate-pulse" />
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-extrabold text-red-200 tracking-wide">{moderationWarning.title}:</span>
                <span className="text-neutral-200 truncate font-medium">{moderationWarning.reason}</span>
              </div>
            </div>
            <button
              onClick={() => setModerationWarning(null)}
              className="px-2 py-1 rounded-md bg-red-900/40 hover:bg-red-800/60 text-red-200 text-[11px] font-bold transition-all cursor-pointer flex-shrink-0 border border-red-700/50"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Scrollable Chat Area */}
        <div
          ref={chatContainerRef}
          onScroll={handleScroll}
          style={{ overflowAnchor: "none" }}
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 relative"
        >
          {/* Welcome Channel Banner matching Image 2 */}
          <div className="mb-8 pt-2">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0c1642] to-[#04081c] border border-indigo-800/40 flex items-center justify-center text-3xl font-extrabold text-white mb-3 shadow-lg shadow-indigo-950/40 group hover:scale-105 transition-transform duration-200">
              <Hash size={36} className="text-indigo-300" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-1">
              Welcome to #{activeChannel}!
            </h1>
            <p className="text-indigo-200/70 text-xs sm:text-sm">
              This is the start of the #{activeChannel} channel.
            </p>
            <div className="border-b border-indigo-950/40 mt-6" />
          </div>

          {/* Loading Indicator */}
          {isLoadingMessages ? (
            <div className="flex flex-col items-center justify-center py-10 opacity-75">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-400 mb-4"></div>
              <p className="text-indigo-200/80 text-sm animate-pulse text-center px-4">
                Loading messages... getting the chat ready
              </p>
            </div>
          ) : (
            <>
              {/* Load Older Messages button if available */}
              {hasMoreOlderMessages && (
                <div className="flex justify-center -mt-2 mb-4">
                  <button
                    onClick={handleLoadOlderMessages}
                    disabled={isLoadingOlder}
                    className="px-4 py-1.5 rounded-full bg-[#080f33] hover:bg-[#0e1b56] border border-indigo-800/50 text-xs font-semibold text-indigo-200 hover:text-white transition-all duration-150 cursor-pointer flex items-center gap-2 shadow-md active:scale-95 disabled:opacity-50"
                  >
                    {isLoadingOlder ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                        <span>Loading older messages...</span>
                      </>
                    ) : (
                      <span>↑ Load older messages</span>
                    )}
                  </button>
                </div>
              )}

              {/* Messages Stream */}
              {filteredMessages.map((msg, mIdx) => {
            const isMe =
              msg.uid === profile.uid ||
              (msg.username === profile.username &&
                msg.photoURL === profile.photoURL);

            const authorVoice = inVoiceUsers.find(
              (vu) => vu.uid === msg.uid || vu.username.toLowerCase() === (msg.username || "").toLowerCase()
            );
            const authorOnline = activeOnlineUsers.find(
              (ou) => ou.uid === msg.uid || ou.username.toLowerCase() === (msg.username || "").toLowerCase()
            );
            const openAuthorProfile = () => {
              setSelectedUserProfile(
                authorVoice ||
                  authorOnline || {
                    uid: msg.uid || `user_${msg.username}`,
                    username: msg.username || "User",
                    photoURL: msg.photoURL || "",
                    status: "online",
                  }
              );
            };

            return (
              <div
                id={`msg-item-${msg.id}`}
                key={`${msg.id || "msg"}-${mIdx}`}
                className="flex gap-3.5 group hover:bg-[#070e2f]/50 p-1.5 -mx-1.5 rounded-lg transition-colors duration-150 relative"
              >
                {/* Avatar Circle */}
                <div
                  onClick={openAuthorProfile}
                  className="w-10 h-10 rounded-full overflow-hidden bg-neutral-800 border border-indigo-950 flex-shrink-0 flex items-center justify-center font-bold text-white text-sm shadow-sm transition-transform duration-150 group-hover:scale-105 cursor-pointer relative"
                  title={`View ${msg.username}'s profile`}
                >
                  {msg.photoURL ? (
                    <img
                      src={msg.photoURL}
                      alt={msg.username || "User"}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{(msg.username || "?").charAt(0).toUpperCase()}</span>
                  )}
                  {authorVoice && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#070e2f] flex items-center justify-center text-[7px]" title="In Voice">
                      <Volume2 size={7} className="text-white" />
                    </span>
                  )}
                </div>

                {/* Message Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      onClick={openAuthorProfile}
                      className="text-sm font-bold text-white hover:underline hover:text-indigo-200 cursor-pointer transition-colors"
                    >
                      {msg.username}
                    </span>
                    {isUserModerator(msg.username, msg.uid) && (
                      <span className="bg-red-950/80 text-red-400 border border-red-800/60 text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider flex-shrink-0" title="Community Moderator">
                        MOD
                      </span>
                    )}
                    {isMe && (
                      <span className="bg-[#0a1236] text-indigo-300 border border-indigo-700/80 text-[8px] font-bold px-1 py-0.2 rounded uppercase tracking-wider flex-shrink-0">
                        YOU
                      </span>
                    )}
                    {authorVoice && (
                      <button
                        type="button"
                        onClick={onSelectVoice}
                        className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-300 bg-emerald-950/90 border border-emerald-600/70 px-1.5 py-0.2 rounded-full hover:bg-emerald-900 transition-colors cursor-pointer"
                        title="In General Voice — click to join voice channel"
                      >
                        <Volume2 size={9} className="text-emerald-400 animate-pulse" />
                        <span>In Voice</span>
                      </button>
                    )}
                    <span className="text-[11px] text-indigo-300/60 font-normal">
                      {formatTimestamp(msg.timestamp)}
                    </span>
                  </div>

                  {msg.text && (
                    <p className="text-sm text-neutral-100 mt-1 whitespace-pre-wrap break-words leading-relaxed font-normal">
                      {msg.text}
                    </p>
                  )}

                  {msg.gif && (
                    <div className="mt-2 max-w-xs w-full rounded-xl overflow-hidden border border-indigo-900/40 bg-neutral-950/80 shadow-md group">
                      <div className="relative bg-black/40 flex items-center justify-center">
                        <img
                          src={msg.gif}
                          alt={msg.gifTitle || "GIF"}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-auto object-contain rounded-t-xl"
                        />
                      </div>
                      <div className="px-2.5 py-1.5 bg-neutral-900/90 border-t border-neutral-800/70 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="px-1.5 py-0.5 rounded bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-[9px] font-mono font-bold flex-shrink-0">
                            GIF
                          </span>
                          <span className="text-xs text-neutral-300 truncate font-medium" title={msg.gifTitle || "GIF Animation"}>
                            {msg.gifTitle || "GIF Animation"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {msg.attachment && renderAttachment(msg)}

                  {/* Reactions Display */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {msg.reactions && Object.keys(msg.reactions).length > 0 &&
                      Object.entries(msg.reactions).map(([reactionKey, users]) => {
                        const userList = Array.isArray(users) ? (users as string[]) : [];
                        const isReactedByMe = userList.includes(profile.uid);
                        const isCustomText = reactionKey.length > 2 || !/\p{Extended_Pictographic}/u.test(reactionKey);

                        return (
                          <button
                            key={reactionKey}
                            id={`chat-msg-reaction-${reactionKey}`}
                            type="button"
                            onClick={() => handleReactMessage(msg.id, reactionKey)}
                            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-semibold border transition-all duration-150 cursor-pointer active:scale-95 ${
                              isReactedByMe
                                ? "bg-indigo-600/30 border-indigo-400/60 text-indigo-100 shadow-sm shadow-indigo-950/50"
                                : "bg-[#080f33]/80 border-indigo-900/50 text-indigo-300 hover:bg-[#0e1b56] hover:text-white"
                            }`}
                            title={`Reactions: ${userList.length} (${isReactedByMe ? "You reacted. Click to remove" : "Click to react"})`}
                          >
                            {isCustomText ? (
                              <span className="font-bold text-[11px] tracking-tight text-amber-300/90 font-mono">
                                {reactionKey}
                              </span>
                            ) : (
                              <span className="text-xs leading-none">{reactionKey}</span>
                            )}
                            <span className="text-[10px] font-mono opacity-80">{userList.length}</span>
                          </button>
                        );
                      })}

                    {/* Quick Add Reaction Button on Chips row */}
                    <button
                      type="button"
                      onClick={() => {
                        setCustomReactionInput("");
                        setActiveReactionMenuMsgId(activeReactionMenuMsgId === msg.id ? null : msg.id);
                      }}
                      className="flex items-center justify-center h-6 w-6 rounded-lg bg-white/[0.04] hover:bg-indigo-600/20 text-neutral-400 hover:text-indigo-200 border border-white/5 hover:border-indigo-500/40 text-xs transition-all duration-150 cursor-pointer"
                      title="Add reaction or custom text"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>

                {/* Actions (Delete, React) Hover Bar */}
                <div className="absolute right-2 -top-3.5 sm:top-2 sm:opacity-0 sm:group-hover:opacity-100 opacity-100 transition-opacity flex items-center gap-0.5 bg-[#080f35]/95 backdrop-blur-md border border-indigo-900/60 rounded-xl p-1 shadow-2xl z-10">
                  {CHAT_QUICK_REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => handleReactMessage(msg.id, emoji)}
                      className="p-1 hover:bg-[#0e1b56] rounded-lg text-sm transition-colors duration-150 cursor-pointer active:scale-90"
                      title={`React with ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}

                  {/* More Reactions & Custom Text Reaction Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setCustomReactionInput("");
                      setActiveReactionMenuMsgId(activeReactionMenuMsgId === msg.id ? null : msg.id);
                    }}
                    className={`p-1.5 rounded-lg text-xs transition-all duration-150 cursor-pointer active:scale-90 flex items-center gap-1 ${
                      activeReactionMenuMsgId === msg.id
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                        : "text-indigo-300 hover:text-white hover:bg-[#0e1b56]"
                    }`}
                    title="Add reaction or custom text reaction"
                  >
                    <SmilePlus size={15} />
                  </button>

                  {(() => {
                    const isMyMsg = msg.uid === profile.uid || msg.username === profile.username;
                    const isAuthorMod = isUserModerator(msg.username, msg.uid);
                    const isCurrentMod = isUserModerator(profile.username, profile.uid);
                    const canDelete = isMyMsg || (isCurrentMod && !isAuthorMod);
                    if (!canDelete) return null;
                    return (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          (e.currentTarget as HTMLElement)?.blur();
                          handleDeleteMessage(msg.id, e);
                        }}
                        className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-[#0e1b56] rounded-lg transition-colors duration-150 cursor-pointer ml-0.5 border-l border-indigo-950/60 active:scale-90"
                        title="Delete Message"
                      >
                        <Trash2 size={14} />
                      </button>
                    );
                  })()}
                </div>

                {/* Floating Rich Reaction & Custom Text Popover */}
                {activeReactionMenuMsgId === msg.id && (
                  <div
                    ref={reactionPopoverRef}
                    className="absolute right-2 top-8 sm:top-10 z-50 w-72 sm:w-80 rounded-2xl border border-indigo-500/30 bg-[#090e2b]/95 p-3.5 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 text-left"
                    style={{ maxHeight: "380px" }}
                  >
                    <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-indigo-900/50">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-200">
                        <Sparkles size={14} className="text-amber-400" />
                        <span>Reactions & Custom Text</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveReactionMenuMsgId(null)}
                        className="text-neutral-400 hover:text-white p-1 rounded-md transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {/* Custom Text Reaction Input Form */}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (customReactionInput.trim()) {
                          handleReactMessage(msg.id, customReactionInput.trim());
                          setCustomReactionInput("");
                          setActiveReactionMenuMsgId(null);
                        }
                      }}
                      className="mb-3"
                    >
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={customReactionInput}
                          onChange={(e) => setCustomReactionInput(e.target.value)}
                          placeholder="Type your own reaction (e.g. 10/10, W, GG)..."
                          maxLength={30}
                          className="flex-1 h-8 rounded-xl bg-black/50 border border-indigo-900/60 px-2.5 text-xs text-white placeholder-indigo-300/40 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        />
                        <button
                          type="submit"
                          disabled={!customReactionInput.trim()}
                          className="h-8 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer flex-shrink-0"
                        >
                          React
                        </button>
                      </div>
                    </form>

                    {/* Popular Quick Custom Text Badges */}
                    <div className="mb-3">
                      <div className="text-[10px] font-bold text-indigo-300/70 uppercase tracking-wider mb-1.5">
                        Popular Text Reactions
                      </div>
                      <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto pr-1">
                        {POPULAR_TEXT_REACTIONS.map((txt) => (
                          <button
                            key={txt}
                            type="button"
                            onClick={() => {
                              handleReactMessage(msg.id, txt);
                              setActiveReactionMenuMsgId(null);
                            }}
                            className="px-2 py-0.5 rounded-lg bg-indigo-950/70 hover:bg-indigo-700/60 border border-indigo-800/60 hover:border-indigo-400 text-[11px] font-bold text-amber-200 hover:text-white transition-all duration-150 cursor-pointer active:scale-95"
                          >
                            {txt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Categorized Emojis */}
                    <div className="overflow-y-auto max-h-40 space-y-2.5 pr-1">
                      {CHAT_EMOJI_CATEGORIES.map((cat) => (
                        <div key={cat.name}>
                          <div className="text-[10px] font-bold text-indigo-300/60 uppercase tracking-wider mb-1">
                            {cat.name}
                          </div>
                          <div className="grid grid-cols-6 gap-1">
                            {cat.emojis.map((em) => (
                              <button
                                key={em}
                                type="button"
                                onClick={() => {
                                  handleReactMessage(msg.id, em);
                                  setActiveReactionMenuMsgId(null);
                                }}
                                className="h-8 w-8 rounded-lg hover:bg-indigo-600/30 text-base flex items-center justify-center transition-all duration-150 cursor-pointer active:scale-90 hover:scale-110"
                                title={`React with ${em}`}
                              >
                                {em}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
            </>
          )}

          {/* Floating Jump to Latest button */}
          {showScrollBottomBtn && (
            <div className="sticky bottom-2 flex justify-center z-30 pointer-events-none pb-2">
              <button
                onClick={() => {
                  isUserScrolledUpRef.current = false;
                  scrollToBottom("smooth");
                }}
                className="pointer-events-auto px-4 py-1.5 rounded-full bg-[#080f33] hover:bg-[#0e1b56] text-white border border-indigo-800/60 text-xs font-semibold shadow-2xl transition-all duration-150 flex items-center gap-1.5 cursor-pointer active:scale-95 hover:border-indigo-600/70"
              >
                <span>Latest messages</span>
                <span className="text-sm font-bold text-indigo-300">↓</span>
              </button>
            </div>
          )}
        </div>

        {/* Giphy Picker Drawer */}
        {showGiphy && (
          <GiphyPicker
            onSelectGif={handleSendGif}
            onClose={() => setShowGiphy(false)}
          />
        )}

        {/* Attachment Preview Drawer */}
        <AnimatePresence>
          {(attachment || isUploading) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="p-3 border-t border-white/10 bg-[#0c0e18] flex items-center justify-between gap-4 flex-shrink-0 overflow-hidden"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1 max-w-xl">
                <div className="relative flex-shrink-0">
                  {(() => {
                    const stagedType = detectMediaType(attachment || "", attachmentType || "", attachmentName || "");
                    if (stagedType === "image" && attachment && attachment !== "pending") {
                      return (
                        <img
                          src={attachment}
                          alt="Preview"
                          className="h-11 w-11 object-cover rounded-xl border border-white/10 bg-neutral-900 shadow-sm"
                        />
                      );
                    }
                    if (stagedType === "video") {
                      return (
                        <div className="h-11 w-11 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-sm">
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>
                        </div>
                      );
                    }
                    if (stagedType === "audio") {
                      return (
                        <div className="h-11 w-11 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-sm">
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                        </div>
                      );
                    }
                    return (
                      <div className="h-11 w-11 rounded-xl bg-neutral-800 border border-white/10 flex items-center justify-center text-neutral-300 shadow-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
                      </div>
                    );
                  })()}

                  {isUploading && (
                    <div className="absolute -bottom-1 -right-1 bg-indigo-500 text-white rounded-full p-0.5 shadow-md">
                      <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-semibold text-white truncate">
                      {attachmentName || uploadingFileInfo?.name || "Attached file"}
                    </span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {(attachmentSize || uploadingFileInfo?.size) && (
                        <span className="text-[11px] text-neutral-400 font-medium">
                          {formatFileSize(attachmentSize || uploadingFileInfo?.size || 0)}
                        </span>
                      )}
                      {isUploading ? (
                        <span className="text-[11px] text-indigo-400 font-medium">
                          {uploadProgress !== null ? `${Math.round(uploadProgress)}%` : "Uploading..."}
                        </span>
                      ) : (
                        <span className="text-[10px] text-emerald-300 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          Ready
                        </span>
                      )}
                    </div>
                  </div>

                  {isUploading ? (
                    <div className="w-full bg-neutral-800 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-indigo-500 h-1.5 rounded-full transition-all duration-150 ease-out"
                        style={{ width: `${Math.max(5, uploadProgress ?? 5)}%` }}
                      />
                    </div>
                  ) : (
                    <p className="text-[11px] text-neutral-400 truncate">Ready to send with your message</p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={cancelUpload}
                title={isUploading ? "Cancel upload" : "Remove file"}
                aria-label={isUploading ? "Cancel upload" : "Remove file"}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white border border-white/10 transition-colors flex-shrink-0 cursor-pointer"
              >
                <X size={15} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom Message Input Bar matching Image 2 */}
        <div
          style={{
            backgroundColor: "var(--theme-chat-bg)",
            borderColor: "var(--theme-border-subtle)",
          }}
          className="px-4 pt-3 pb-2 sm:pb-2.5 border-t flex-shrink-0"
        >
          {typingUsers.length > 0 && (
            <div
              style={{ color: "var(--theme-text-muted)" }}
              className="flex items-center gap-2 text-xs mb-2 pl-2 animate-in fade-in duration-150"
            >
              <div className="flex items-center gap-1">
                <span className="relative flex h-1.5 w-1.5 mr-1">
                  <span
                    style={{ backgroundColor: "var(--theme-accent)" }}
                    className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                  />
                  <span
                    style={{ backgroundColor: "var(--theme-text-accent)" }}
                    className="relative inline-flex rounded-full h-1.5 w-1.5"
                  />
                </span>
                <span style={{ color: "var(--theme-text-accent)" }} className="font-bold">
                  {typingUsers.length <= 3 
                    ? typingUsers.map((u) => u.username).join(", ") 
                    : "Several people"}
                </span>
                <span>{typingUsers.length === 1 ? " is typing..." : " are typing..."}</span>
              </div>
            </div>
          )}
          <form
            onSubmit={handleSendMessage}
            onPaste={handlePaste}
            style={{
              backgroundColor: "var(--theme-chat-input)",
              borderColor: "var(--theme-border-subtle)",
            }}
            className="border rounded-xl px-4 py-2.5 flex items-center gap-3 transition-all duration-150 shadow-lg shadow-black/40 focus-within:border-[var(--theme-border-strong)]"
          >
            <input
              ref={inputRef}
              type="text"
              disabled={isLoadingMessages}
              value={text}
              onChange={(e) => {
                const val = e.target.value;
                setText(val);
                if (val.trim()) {
                  if (!isLocalTyping) {
                    updateTypingStatus(true);
                  }
                  if (typingTimeoutRef.current) {
                    clearTimeout(typingTimeoutRef.current);
                  }
                  typingTimeoutRef.current = setTimeout(() => {
                    updateTypingStatus(false);
                  }, 4000);
                } else {
                  if (isLocalTyping) {
                    updateTypingStatus(false);
                  }
                  if (typingTimeoutRef.current) {
                    clearTimeout(typingTimeoutRef.current);
                    typingTimeoutRef.current = null;
                  }
                }
              }}
              placeholder={isLoadingMessages ? "Loading..." : `Message #${activeChannel}...`}
              className="flex-1 bg-transparent text-sm text-white placeholder-neutral-400 focus:outline-none disabled:opacity-50"
            />

            {/* Action Tools: File, GIF, Send */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={isLoadingMessages}
                onClick={() => fileInputRef.current?.click()}
                style={{ color: "var(--theme-text-muted)" }}
                className="hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors duration-150 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer active:scale-90"
                title="Attach Any File"
              >
                <Plus size={18} />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                disabled={isLoadingMessages}
                onChange={handleFileChange}
              />

              <button
                type="button"
                disabled={isLoadingMessages}
                onClick={() => setShowGiphy(!showGiphy)}
                style={{
                  backgroundColor: showGiphy ? "var(--theme-accent)" : "var(--theme-hover)",
                  borderColor: showGiphy ? "var(--theme-border-strong)" : "var(--theme-border-subtle)",
                  color: showGiphy ? "#ffffff" : "var(--theme-text-accent)",
                }}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold tracking-wider transition-all duration-150 disabled:opacity-40 cursor-pointer active:scale-95 border"
                title="Choose GIF"
              >
                GIF
              </button>

              <button
                type="submit"
                disabled={isLoadingMessages || (!text.trim() && !attachment) || isUploading}
                style={{
                  backgroundColor: "var(--theme-accent)",
                  borderColor: "var(--theme-border)",
                  color: "#ffffff",
                }}
                className="p-2 rounded-lg hover:brightness-110 border disabled:opacity-40 transition-all duration-150 ml-1 cursor-pointer active:scale-90"
                title="Send Message"
              >
                <Send size={15} />
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Right Members Sidebar ("IN VOICE & CALLS", "ONLINE", "OFFLINE") */}
      {showMembersSidebar && (
        <aside
          style={{
            backgroundColor: "var(--theme-chat-sidebar)",
            borderColor: "var(--theme-border-subtle)",
          }}
          className="w-60 border-l flex flex-col h-full flex-shrink-0 select-none"
        >
          <div className="flex-1 overflow-y-auto p-3 space-y-5">
            {/* 🛡️ Moderator Quick Bar */}
            {isUserModerator(profile.username, profile.uid) && (
              <div className="p-2.5 rounded-xl bg-gradient-to-r from-red-950/60 via-[#121429] to-indigo-950/40 border border-red-800/50 space-y-2 shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-red-300">
                    <ShieldAlert size={14} className="text-red-400 animate-pulse" />
                    <span>Mod Panel</span>
                  </div>
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-red-950 border border-red-800/60 text-red-300">
                    PASS
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowModSuiteModal(true)}
                    className="py-1.5 px-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer shadow active:scale-95"
                    title="Open Full Moderator Dashboard"
                  >
                    <ShieldAlert size={11} />
                    <span>Mod Suite</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowBannedModal(true)}
                    className="py-1.5 px-2 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-800/60 text-red-200 text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                    title="View Banned Accounts"
                  >
                    <Ban size={11} />
                    <span>Banned ({bannedList.length})</span>
                  </button>
                </div>
              </div>
            )}

            {/* 🟢 ONLINE SECTION */}
            <div>
              <div className="flex items-center justify-between mb-2 px-1">
                <h3 className="text-[10px] font-bold text-neutral-400 tracking-wider uppercase">
                  ONLINE — {standardOnlineUsers.length}
                </h3>
                <button
                  onClick={handleDeleteAllUsers}
                  disabled={isDeletingAllUsers}
                  className="p-1 hover:bg-rose-500/20 rounded text-neutral-500 hover:text-rose-400 transition-colors cursor-pointer"
                  title="Force clear and reset all users presence"
                >
                  <Trash2 size={10} className={isDeletingAllUsers ? "animate-spin" : ""} />
                </button>
              </div>
              <div className="space-y-1">
                {standardOnlineUsers.map((user, uIdx) => {
                  const isCurrentUser = user.uid === profile.uid;
                  const userActivity = isCurrentUser ? (localActivity || user.activity) : user.activity;

                  return (
                    <div
                      key={`online-${user.uid || "online"}-${uIdx}`}
                      className="group relative flex items-start gap-2.5 p-1.5 rounded-lg hover:bg-neutral-900/60 border border-transparent hover:border-white/5 transition-all duration-150 cursor-pointer"
                      onClick={() => setSelectedUserProfile(user)}
                    >
                      {/* Avatar with Green Online Dot */}
                      <div className="relative mt-0.5 flex-shrink-0">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-neutral-800 border border-neutral-800 flex items-center justify-center text-xs font-bold text-white">
                          {user.photoURL ? (
                            <img
                              src={user.photoURL}
                              alt={user.username || "User"}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span>{(user.username || "?").charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#030514]" />
                      </div>

                      {/* Username & Status Label & Activity */}
                      <div className="flex-1 min-w-0 flex flex-col">
                        <div className="flex items-center justify-between gap-1 w-full">
                          <div className="flex items-center gap-1 min-w-0">
                            <span className="text-xs font-bold text-neutral-200 group-hover:text-white truncate">
                              {user.username}
                            </span>
                            {isUserModerator(user.username, user.uid) && (
                              <span className="bg-red-950/80 text-red-400 border border-red-800/60 text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider flex-shrink-0" title="Community Moderator">
                                MOD
                              </span>
                            )}
                            {isCurrentUser && (
                              <span className="bg-[#0a1236] text-indigo-300 border border-indigo-700/80 text-[9px] font-bold px-1 py-0.2 rounded uppercase tracking-wider flex-shrink-0">
                                YOU
                              </span>
                            )}
                          </div>

                          {/* Hover action toolbar */}
                          <div className="hidden group-hover:flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            {!isCurrentUser && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleStartDirectCall(user, "audio")}
                                  className="p-1 rounded bg-white/10 hover:bg-emerald-600/30 text-emerald-300 hover:text-white transition-colors"
                                  title="Call Direct Audio"
                                >
                                  <Phone size={10} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleStartDirectCall(user, "video")}
                                  className="p-1 rounded bg-white/10 hover:bg-indigo-600/30 text-indigo-300 hover:text-white transition-colors"
                                  title="Call Direct Video"
                                >
                                  <Video size={10} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMentionUser(user.username)}
                                  className="p-1 rounded bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white transition-colors"
                                  title="Mention in chat"
                                >
                                  <AtSign size={10} />
                                </button>
                              </>
                            )}
                            {isUserModerator(profile.username, profile.uid) && !isCurrentUser && !isUserModerator(user.username, user.uid) && (
                              <button
                                onClick={() => {
                                  setModTargetUser(user);
                                  setModActionType("kick");
                                  setModReason("");
                                }}
                                className="p-1 hover:bg-red-500/20 rounded text-red-400 hover:text-red-300 transition-colors cursor-pointer active:scale-95"
                                title="Kick or Ban User"
                              >
                                <ShieldAlert size={10} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Real-Time Activity Badge */}
                        {userActivity ? (
                          <div className="mt-0.5">
                            <ActivityBadge activity={userActivity} compact />
                          </div>
                        ) : (
                          <span className="text-[10px] text-neutral-400/80 font-medium mt-0.5">
                            Online
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 💤 OFFLINE SECTION */}
            {leftUsers.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2 px-1">
                  <h3 className="text-[10px] font-bold text-neutral-500 tracking-wider uppercase">
                    OFFLINE — {leftUsers.length}
                  </h3>
                </div>
                <div className="space-y-1 opacity-70">
                  {leftUsers.slice(0, 15).map((user, uIdx) => (
                    <div
                      key={`left-${user.uid || "left"}-${uIdx}`}
                      className="flex items-center gap-2 p-1 rounded-lg hover:bg-neutral-900/40 transition-colors cursor-pointer"
                      onClick={() => setSelectedUserProfile(user)}
                    >
                      <div className="relative flex-shrink-0">
                        <div className="w-6 h-6 rounded-full overflow-hidden bg-neutral-800 grayscale flex items-center justify-center text-[10px] font-bold text-neutral-400">
                          {user.photoURL ? (
                            <img src={user.photoURL} alt={user.username} className="w-full h-full object-cover" />
                          ) : (
                            <span>{(user.username || "?").charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-neutral-600 border-2 border-[#030514]" />
                      </div>
                      <span className="text-xs text-neutral-400 truncate flex-1">
                        {user.username}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* 👤 Interactive User Profile Popover / Modal */}
      <AnimatePresence>
        {selectedUserProfile && (
          <motion.div
            key="user-profile-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setSelectedUserProfile(null)}
            className="fixed inset-0 z-[99998] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              key="user-profile-card"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-sm bg-[#0e1122] border border-indigo-500/30 rounded-2xl shadow-2xl overflow-hidden text-white"
            >
              {/* Header Gradient Banner */}
              <div className="h-20 bg-gradient-to-r from-indigo-900 via-purple-900 to-emerald-950 relative">
                <button
                  type="button"
                  onClick={() => setSelectedUserProfile(null)}
                  className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/40 hover:bg-black/70 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Profile Body */}
              <div className="px-5 pb-5 pt-0 relative">
                {/* Large Avatar */}
                <div className="-mt-10 mb-3 flex items-end justify-between">
                  <div className="relative">
                    <div className={`w-20 h-20 rounded-2xl overflow-hidden border-4 border-[#0e1122] bg-neutral-800 shadow-xl ${
                      selectedUserProfile.inVoice ? "ring-2 ring-emerald-400" : ""
                    }`}>
                      {selectedUserProfile.photoURL ? (
                        <img
                          src={selectedUserProfile.photoURL}
                          alt={selectedUserProfile.username}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl font-bold bg-indigo-900 text-white">
                          {(selectedUserProfile.username || "?").charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <span
                      className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-[#0e1122] ${
                        selectedUserProfile.inVoice
                          ? "bg-emerald-400 animate-pulse"
                          : selectedUserProfile.status === "online"
                          ? "bg-emerald-500"
                          : "bg-neutral-500"
                      }`}
                    />
                  </div>

                  {/* Status Tag */}
                  <div>
                    {selectedUserProfile.inVoice ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-bold shadow-sm">
                        <Volume2 size={12} className="text-emerald-400 animate-pulse" />
                        <span>In General Voice</span>
                      </span>
                    ) : selectedUserProfile.status === "online" ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span>Online</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-800 border border-neutral-700 text-neutral-400 text-xs">
                        <span>Offline</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Name & Role */}
                <div className="space-y-1 mb-4">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white">
                      {selectedUserProfile.username}
                    </h2>
                    {isUserModerator(selectedUserProfile.username, selectedUserProfile.uid) && (
                      <span className="bg-red-950/80 text-red-400 border border-red-800/60 text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider" title="Community Moderator">
                        MOD
                      </span>
                    )}
                    {selectedUserProfile.uid === profile.uid && (
                      <span className="bg-[#0a1236] text-indigo-300 border border-indigo-700/80 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                        YOU
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-400 font-mono">
                    ID: {selectedUserProfile.uid.slice(0, 16)}
                  </p>
                </div>

                {/* Rich Activity / Playing Info */}
                {(selectedUserProfile.activity || selectedUserProfile.inVoice) && (
                  <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-2 mb-4">
                    {selectedUserProfile.inVoice && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-neutral-400 font-medium">Voice Channel:</span>
                        <span className="text-emerald-300 font-bold flex items-center gap-1">
                          <Volume2 size={12} /> General Voice
                        </span>
                      </div>
                    )}
                    {selectedUserProfile.activity && (
                      <div>
                        <span className="text-[11px] text-neutral-400 font-medium block mb-1">
                          Currently Active:
                        </span>
                        <ActivityBadge activity={selectedUserProfile.activity} />
                      </div>
                    )}
                  </div>
                )}

                {/* Direct Action Buttons */}
                <div className="space-y-2 pt-1">
                  {selectedUserProfile.uid !== profile.uid ? (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            handleStartDirectCall(selectedUserProfile, "audio");
                            setSelectedUserProfile(null);
                          }}
                          className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 border border-emerald-400/30"
                        >
                          <Phone size={14} />
                          <span>Voice Call</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleStartDirectCall(selectedUserProfile, "video");
                            setSelectedUserProfile(null);
                          }}
                          className="py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 border border-indigo-400/30"
                        >
                          <Video size={14} />
                          <span>Video Call</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          handleMentionUser(selectedUserProfile.username);
                          setSelectedUserProfile(null);
                        }}
                        className="w-full py-2 px-3 rounded-xl bg-neutral-800/80 hover:bg-neutral-700/80 text-neutral-200 hover:text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-white/5 active:scale-95"
                      >
                        <AtSign size={13} />
                        <span>Mention @{selectedUserProfile.username} in Chat</span>
                      </button>

                      {selectedUserProfile.inVoice && onSelectVoice && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectVoice();
                            setSelectedUserProfile(null);
                          }}
                          className="w-full py-2 px-3 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-emerald-600/40 active:scale-95"
                        >
                          <Volume2 size={13} />
                          <span>Join General Voice with {selectedUserProfile.username}</span>
                        </button>
                      )}

                      {/* 🛡️ Protected Moderator notice if target is a moderator */}
                      {isUserModerator(selectedUserProfile.username, selectedUserProfile.uid) && (
                        <div className="p-2.5 rounded-xl bg-red-950/40 border border-red-800/40 flex items-center gap-2 text-xs text-red-300">
                          <ShieldAlert size={16} className="text-red-400 flex-shrink-0" />
                          <div className="text-left">
                            <span className="font-bold block text-red-200">Protected Moderator</span>
                            <span className="text-[10px] text-red-400/80">Moderators cannot be kicked, banned, or moderated.</span>
                          </div>
                        </div>
                      )}

                      {/* 🛡️ Moderator Actions for non-moderators */}
                      {isUserModerator(profile.username, profile.uid) && !isUserModerator(selectedUserProfile.username, selectedUserProfile.uid) && (
                        <div className="pt-2 border-t border-white/10 space-y-1.5">
                          {bannedList.some(
                            (b) =>
                              b.uid === selectedUserProfile.uid ||
                              b.id === selectedUserProfile.uid ||
                              b.targetUid === selectedUserProfile.uid ||
                              b.username?.toLowerCase() === selectedUserProfile.username?.toLowerCase()
                          ) ? (
                            <button
                              type="button"
                              onClick={async () => {
                                await handleUnbanUser(selectedUserProfile.uid);
                                setSelectedUserProfile(null);
                              }}
                              className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95"
                            >
                              <Check size={14} />
                              <span>Unban {selectedUserProfile.username}</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setModTargetUser(selectedUserProfile);
                                setModActionType("kick");
                                setModReason("");
                                setSelectedUserProfile(null);
                              }}
                              className="w-full py-2.5 px-3 rounded-xl bg-red-950/60 hover:bg-red-900/80 text-red-300 hover:text-red-100 border border-red-800/60 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-sm"
                            >
                              <ShieldAlert size={14} className="text-red-400" />
                              <span>Moderate User (Kick / Ban)</span>
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-2 text-xs text-neutral-400">
                      This is your profile.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Friendly Community Moderation Warning Modal */}
      <AnimatePresence>
        {moderationWarning && moderationWarning.open && (
          <motion.div
            key="moderation-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={() => setModerationWarning(null)}
            className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          >
            <motion.div
              key="moderation-card"
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-sm bg-[#121420] border border-amber-500/20 rounded-2xl p-6 shadow-2xl overflow-hidden text-white flex flex-col items-center text-center space-y-3.5"
            >
              {/* Soft friendly warning icon */}
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-sm">
                <AlertTriangle size={24} />
              </div>

              <div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  {moderationWarning.title || "Friendly Heads-Up"}
                </h3>
                <p className="text-[11px] text-amber-300/80 font-medium mt-0.5">
                  Community Guideline Note
                </p>
              </div>

              <div className="bg-[#090b16] border border-white/5 rounded-xl p-3 w-full">
                <p className="text-xs text-neutral-200 leading-relaxed break-words">
                  {moderationWarning.reason}
                </p>
              </div>

              <p className="text-[11px] text-neutral-400 leading-normal">
                Please rephrase your message and keep the conversation friendly for all members.
              </p>

              <button
                type="button"
                onClick={() => setModerationWarning(null)}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs tracking-wide transition-all shadow-md active:scale-[0.98] cursor-pointer"
              >
                Got It, Thanks!
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Moderation Action Configuration Dialog for Moderators */}
      {modTargetUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
          <div className="bg-[#121420] border border-white/10 rounded-2xl p-5 max-w-sm w-full text-left space-y-4 shadow-2xl text-white">
            <div className="flex items-center justify-between border-b border-indigo-900/40 pb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <ShieldAlert size={16} className="text-red-400" />
                <span>Moderator Action</span>
              </h3>
              <button
                onClick={() => setModTargetUser(null)}
                className="text-neutral-400 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="text-xs space-y-1 text-neutral-300">
              <p>
                Target User: <span className="text-white font-bold">{modTargetUser.username}</span>
              </p>
              <p className="text-neutral-500">UID: {modTargetUser.uid}</p>
            </div>

            {/* Action Type Tabs */}
            <div className="grid grid-cols-2 gap-2 bg-[#090e2b] p-1 rounded-xl border border-indigo-950">
              <button
                type="button"
                onClick={() => setModActionType("kick")}
                className={`py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  modActionType === "kick"
                    ? "bg-indigo-600 text-white"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Kick (One-time)
              </button>
              <button
                type="button"
                onClick={() => setModActionType("ban")}
                className={`py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  modActionType === "ban"
                    ? "bg-red-600 text-white"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Ban (Timed)
              </button>
            </div>

            {/* Reason Input */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-neutral-400 tracking-wider uppercase">
                Reason / Message
              </label>
              <input
                type="text"
                value={modReason}
                onChange={(e) => setModReason(e.target.value)}
                placeholder="e.g. Please be respectful"
                className="w-full bg-[#090e2b] text-white placeholder-neutral-500 text-xs rounded-xl border border-indigo-950 p-2.5 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Ban Duration Select */}
            {modActionType === "ban" && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-neutral-400 tracking-wider uppercase">
                  Ban Duration
                </label>
                <select
                  value={modBanDuration}
                  onChange={(e) => setModBanDuration(Number(e.target.value))}
                  className="w-full bg-[#090e2b] text-white text-xs rounded-xl border border-indigo-950 p-2.5 focus:outline-none focus:border-indigo-500"
                >
                  <option value={5 * 60 * 1000}>5 Minutes</option>
                  <option value={30 * 60 * 1000}>30 Minutes</option>
                  <option value={2 * 60 * 60 * 1000}>2 Hours</option>
                  <option value={24 * 60 * 60 * 1000}>24 Hours</option>
                  <option value={-1}>Permanent</option>
                </select>
              </div>
            )}

            {/* Submit / Cancel Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModTargetUser(null)}
                className="flex-1 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!modTargetUser) return;
                  if (isUserModerator(modTargetUser.username, modTargetUser.uid)) {
                    alert("You cannot kick or ban another moderator.");
                    setModTargetUser(null);
                    return;
                  }
                  if (!modReason.trim()) {
                    alert("Please provide a reason.");
                    return;
                  }
                  const banUntil = modActionType === "ban"
                    ? (modBanDuration === -1 ? -1 : Date.now() + modBanDuration)
                    : 0;

                  const actionPayload = {
                    type: modActionType,
                    targetUid: modTargetUser.uid,
                    targetUsername: modTargetUser.username,
                    bannedBy: profile.username,
                    reason: modReason.trim(),
                    banUntil,
                    timestamp: Date.now(),
                  };

                  // 1. Write to database collections
                  await setDoc(doc(db, "moderation_actions", modTargetUser.uid), actionPayload);
                  if (modTargetUser.username) {
                    await setDoc(doc(db, "moderation_banned_names", modTargetUser.username.trim().toLowerCase()), actionPayload);
                  }

                  if (modActionType === "ban") {
                    await setDoc(doc(db, "banned_users", modTargetUser.uid), {
                      uid: modTargetUser.uid,
                      username: modTargetUser.username,
                      bannedBy: profile.username,
                      reason: modReason.trim(),
                      banUntil,
                      timestamp: Date.now(),
                    });
                  }

                  // 2. Real-time signaling via WebRTC signals & WebSockets for instant 0ms enforcement
                  const broadcastPayload = {
                    type: "moderation_action",
                    action: modActionType,
                    targetUid: modTargetUser.uid,
                    targetUsername: modTargetUser.username,
                    bannedBy: profile.username,
                    reason: modReason.trim(),
                    banUntil,
                    timestamp: Date.now(),
                  };

                  sendBroadcastSignal(broadcastPayload);
                  try {
                    wsClient.sendSignal(broadcastPayload);
                  } catch (e) {}

                  // 3. Update local banned list if ban
                  if (modActionType === "ban") {
                    setBannedList((prev) => [
                      ...prev.filter((u) => u.uid !== modTargetUser.uid && u.id !== modTargetUser.uid),
                      { id: modTargetUser.uid, ...actionPayload },
                    ]);
                  }

                  setModTargetUser(null);
                  setModReason("");
                }}
                className={`flex-1 py-2 rounded-xl text-white font-bold text-xs cursor-pointer transition-colors ${
                  modActionType === "ban" ? "bg-red-600 hover:bg-red-500" : "bg-indigo-600 hover:bg-indigo-500"
                }`}
              >
                Apply Action
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Real-time Enforced Ban/Kick Interstitial Screens */}
      {activeModeration && activeModeration.type === "kick" && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[999999] flex items-center justify-center p-4">
          <div className="bg-[#121420] border border-red-500/30 rounded-2xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl text-white animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mx-auto">
              <ShieldAlert size={24} />
            </div>
            <h3 className="text-lg font-bold text-white">You have been kicked</h3>
            <p className="text-sm text-neutral-400">
              Reason: <span className="text-red-400 font-semibold">{activeModeration.reason}</span>
            </p>
            <p className="text-xs text-neutral-500">
              Kicked by: {activeModeration.bannedBy}
            </p>
            <button
              onClick={async () => {
                await deleteDoc(doc(db, "moderation_actions", profile.uid)).catch(() => {});
                if (profile.username) {
                  await deleteDoc(doc(db, "moderation_banned_names", profile.username.trim().toLowerCase())).catch(() => {});
                }
                setActiveModeration(null);
              }}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl cursor-pointer transition-colors shadow-lg active:scale-95"
            >
              Rejoin Chat
            </button>
          </div>
        </div>
      )}

      {activeModeration && activeModeration.type === "ban" && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-lg z-[999999] flex items-center justify-center p-4">
          <div className="bg-[#121420] border border-red-500/50 rounded-2xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl text-white animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center text-red-500 mx-auto animate-pulse">
              <Ban size={24} />
            </div>
            <h3 className="text-lg font-bold text-white">You have been banned</h3>
            <p className="text-sm text-neutral-400">
              Reason: <span className="text-red-400 font-semibold">{activeModeration.reason}</span>
            </p>
            <p className="text-xs text-neutral-500">
              Banned by: {activeModeration.bannedBy}
            </p>
            <p className="text-sm text-indigo-400 font-semibold">
              {activeModeration.banUntil === -1 ? (
                "This ban is Permanent"
              ) : (
                `Ban expires: ${new Date(activeModeration.banUntil).toLocaleTimeString()}`
              )}
            </p>
            <p className="text-xs text-neutral-500">
              {activeModeration.banUntil === -1
                ? "Contact a community moderator to be unbanned."
                : "You will automatically rejoin once the ban timer expires or when unbanned."}
            </p>
          </div>
        </div>
      )}

      {/* 🛡️ Dedicated Banned Users & Unban Management Modal for Moderators */}
      {showBannedModal && isUserModerator(profile.username, profile.uid) && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-[#0f1224] border border-red-900/50 rounded-2xl max-w-lg w-full p-6 text-white shadow-2xl space-y-5 text-left animate-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-indigo-950 pb-3 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-red-950/80 border border-red-700/60 flex items-center justify-center text-red-400">
                  <Ban size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white leading-tight">
                    Banned Users & Unban Control
                  </h3>
                  <p className="text-[11px] text-neutral-400">
                    Review currently banned accounts and restore access
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBannedModal(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Notification messages */}
            {unbanSuccessMsg && (
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-150 flex-shrink-0">
                <Check size={16} className="text-emerald-400 flex-shrink-0" />
                <span>{unbanSuccessMsg}</span>
              </div>
            )}
            {unbanErrorMsg && (
              <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-150 flex-shrink-0">
                <AlertTriangle size={16} className="text-red-400 flex-shrink-0" />
                <span>{unbanErrorMsg}</span>
              </div>
            )}

            {/* Manual Unban Form */}
            <div className="bg-[#090b18] p-3.5 rounded-xl border border-indigo-950 space-y-2 flex-shrink-0">
              <label className="text-[10px] font-extrabold text-indigo-300 tracking-wider uppercase block">
                Quick Unban (By Username or UID)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualUnbanInput}
                  onChange={(e) => setManualUnbanInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleUnbanUser(manualUnbanInput);
                    }
                  }}
                  placeholder="Enter username or UID to unban..."
                  className="flex-1 bg-[#121630] border border-indigo-900/60 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => handleUnbanUser(manualUnbanInput)}
                  disabled={isUnbanning || !manualUnbanInput.trim()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-md active:scale-95 flex-shrink-0"
                >
                  <Unlock size={13} />
                  <span>Unban</span>
                </button>
              </div>
            </div>

            {/* Banned Users List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[140px]">
              <div className="flex items-center justify-between text-[11px] font-bold text-neutral-400 mb-1 px-1">
                <span>CURRENTLY BANNED ({bannedList.length})</span>
              </div>

              {bannedList.length === 0 ? (
                <div className="text-center py-10 space-y-2 border border-dashed border-indigo-950/60 rounded-xl bg-[#090b18]/40">
                  <div className="w-10 h-10 rounded-full bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
                    <Check size={20} />
                  </div>
                  <p className="text-xs font-bold text-neutral-300">No Banned Users</p>
                  <p className="text-[11px] text-neutral-500 max-w-xs mx-auto">
                    All users currently have active access to the chat and channels.
                  </p>
                </div>
              ) : (
                bannedList.map((bUser, idx) => {
                  const targetName = bUser.username || bUser.targetUsername || "Unknown User";
                  const targetId = bUser.uid || bUser.targetUid || bUser.id;
                  const isPerm = bUser.banUntil === -1;
                  const expiryText = isPerm
                    ? "Permanent"
                    : `Expires ${new Date(bUser.banUntil).toLocaleTimeString()}`;

                  return (
                    <div
                      key={`banned-${targetId}-${idx}`}
                      className="p-3 rounded-xl bg-[#090b18] border border-red-950 hover:border-red-900/60 flex items-center justify-between gap-3 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-red-950/80 border border-red-700/60 flex items-center justify-center text-red-400 font-bold text-xs flex-shrink-0">
                          <Ban size={15} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white truncate">
                              {targetName}
                            </span>
                            <span className="text-[10px] text-neutral-500 font-mono truncate max-w-[100px]">
                              {targetId}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-neutral-400 mt-0.5">
                            <span className="text-red-400 truncate">
                              Reason: {bUser.reason || "No reason"}
                            </span>
                            <span>•</span>
                            <span className="text-indigo-300 flex items-center gap-1 flex-shrink-0">
                              <Clock size={10} />
                              {expiryText}
                            </span>
                          </div>
                          {bUser.bannedBy && (
                            <p className="text-[9px] text-neutral-500 mt-0.5">
                              Banned by: {bUser.bannedBy}
                            </p>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleUnbanUser(targetId)}
                        disabled={isUnbanning}
                        className="px-3 py-1.5 bg-emerald-600/90 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95 flex-shrink-0 disabled:opacity-40"
                        title={`Unban ${targetName}`}
                      >
                        <Unlock size={12} />
                        <span>Unban</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="pt-2 border-t border-indigo-950 flex justify-end flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowBannedModal(false)}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🛡️ Full Featured Community Moderator Suite Modal */}
      <ModeratorPanelModal
        isOpen={showModSuiteModal && isUserModerator(profile.username, profile.uid)}
        onClose={() => setShowModSuiteModal(false)}
        profile={profile}
        onlineUsers={activeOnlineUsers}
        bannedList={bannedList}
        onUnbanUser={handleUnbanUser}
        onPurgeMessages={async (count) => {
          const toDelete = messages.slice(-count);
          for (const m of toDelete) {
            await deleteDoc(doc(db, "messages", m.id)).catch(() => {});
            wsClient.sendChange("delete", "messages", m.id);
          }
          setMessages((prev) => {
            const updated = prev.slice(0, Math.max(0, prev.length - count));
            saveCachedMessages(updated);
            return updated;
          });
          sendBroadcastSignal({
            type: "purge_chat",
            count,
            moderator: profile.username,
            timestamp: Date.now(),
          });
        }}
        onToggleChatLock={async (locked) => {
          setIsChatLocked(locked);
          await setDoc(doc(db, "chat_settings", "global"), { isLocked: locked, updatedAt: Date.now() }, { merge: true }).catch(() => {});
          wsClient.sendChange("set", "chat_settings", "global", { isLocked: locked, updatedAt: Date.now() });
          sendBroadcastSignal({
            type: "chat_lock_changed",
            isLocked: locked,
            moderator: profile.username,
            timestamp: Date.now(),
          });
        }}
        isChatLocked={isChatLocked}
        slowmodeCooldown={slowmodeCooldown}
        onSetSlowmode={async (sec) => {
          setSlowmodeCooldown(sec);
          await setDoc(doc(db, "chat_settings", "global"), { slowmode: sec, updatedAt: Date.now() }, { merge: true }).catch(() => {});
          wsClient.sendChange("set", "chat_settings", "global", { slowmode: sec, updatedAt: Date.now() });
          sendBroadcastSignal({
            type: "slowmode_changed",
            seconds: sec,
            moderator: profile.username,
            timestamp: Date.now(),
          });
        }}
      />
    </div>
  );
}
