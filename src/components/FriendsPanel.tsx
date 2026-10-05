import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Users,
  UserPlus,
  UserCheck,
  UserX,
  MessageSquare,
  Search,
  Check,
  Copy,
  Plus,
  X,
  Send,
  Sparkles,
  Phone,
  Video,
  Smile,
  Paperclip,
  Share2,
  Clock,
  MoreVertical,
  Shield,
  Circle,
  FileText,
  Gamepad2,
  BookOpen,
  Volume2,
  Trash2,
} from "lucide-react";
import {
  FriendProfile,
  FriendRequest,
  DirectMessage,
  getStoredFriends,
  saveStoredFriends,
  getStoredFriendRequests,
  saveStoredFriendRequests,
  getStoredDMMessages,
  saveStoredDMMessages,
  getOrCreateUserTag,
} from "../lib/friends";
import { ChatProfile } from "../types";
import { useCall } from "../context/CallContext";
import { playChatSound } from "../lib/ringtone-synthesizer";
import { sendBroadcastSignal, subscribeBroadcastSignals } from "../lib/database";

interface FriendsPanelProps {
  profile: ChatProfile;
  onOpenVoiceChat?: () => void;
  onSelectDirectMessage?: (friend: FriendProfile) => void;
}

export default function FriendsPanel({
  profile,
  onOpenVoiceChat,
  onSelectDirectMessage,
}: FriendsPanelProps) {
  const [currentProfile, setCurrentProfile] = useState<ChatProfile>(profile);
  const [friends, setFriends] = useState<FriendProfile[]>(getStoredFriends);
  const [requests, setRequests] = useState<FriendRequest[]>(getStoredFriendRequests);
  const [activeTab, setActiveTab] = useState<"online" | "all" | "pending" | "add">("online");
  const [searchQuery, setSearchQuery] = useState("");
  const [addUsernameInput, setAddUsernameInput] = useState("");
  const [addFeedback, setAddFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [copiedTag, setCopiedTag] = useState(false);

  // Active Direct Message state
  const [activeDMFriend, setActiveDMFriend] = useState<FriendProfile | null>(null);
  const activeDMFriendRef = useRef<FriendProfile | null>(null);
  const [dmMessages, setDmMessages] = useState<DirectMessage[]>([]);
  const [dmInputText, setDmInputText] = useState("");
  const dmMessagesEndRef = useRef<HTMLDivElement>(null);

  const { startDirectCall, onlineUsers } = useCall();

  // Keep profile synchronized
  useEffect(() => {
    setCurrentProfile(profile);
  }, [profile]);

  useEffect(() => {
    const handleProfileUpdate = (e: any) => {
      if (e.detail) {
        setCurrentProfile(e.detail);
      }
    };
    const handleFriendsUpdate = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        setFriends(e.detail);
      } else {
        setFriends(getStoredFriends());
      }
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "frosted_chat_profile" && e.newValue) {
        try {
          setCurrentProfile(JSON.parse(e.newValue));
        } catch {}
      }
      if (e.key === "frosted_friends_v1") {
        setFriends(getStoredFriends());
      }
    };

    window.addEventListener("frosted_profile_updated", handleProfileUpdate);
    window.addEventListener("frosted_friends_updated", handleFriendsUpdate);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("frosted_profile_updated", handleProfileUpdate);
      window.removeEventListener("frosted_friends_updated", handleFriendsUpdate);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  // Current user's tag & profile details
  const myTag = useMemo(
    () => currentProfile.tag || getOrCreateUserTag(currentProfile.username || "Guest"),
    [currentProfile.username, currentProfile.tag]
  );
  const fullUserTag = `@${currentProfile.username || "Guest"}${myTag}`;

  // Load DM messages when active friend changes
  useEffect(() => {
    activeDMFriendRef.current = activeDMFriend;
    if (activeDMFriend) {
      const stored = getStoredDMMessages(activeDMFriend.uid);
      setDmMessages(stored);
      // Auto scroll
      setTimeout(() => {
        dmMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [activeDMFriend]);

  // Real-time synchronization for friend requests, accepted statuses, and direct messages
  useEffect(() => {
    if (!currentProfile?.uid) return;

    const unsub = subscribeBroadcastSignals(currentProfile.uid, (sig) => {
      if (!sig || !sig.type) return;

      // 1. Incoming Friend Request
      if (sig.type === "friend_request_sent") {
        const isForMe =
          sig.targetUid === currentProfile.uid ||
          (sig.toUsername && sig.toUsername.toLowerCase() === (currentProfile.username || "").toLowerCase());

        if (isForMe && sig.fromUid !== currentProfile.uid) {
          const newReq: FriendRequest = {
            id: sig.id || `req_${Date.now()}`,
            fromUid: sig.fromUid,
            fromUsername: sig.fromUsername,
            fromTag: sig.fromTag || getOrCreateUserTag(sig.fromUsername),
            fromPhotoURL:
              sig.fromPhotoURL ||
              `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(sig.fromUsername)}`,
            toUid: currentProfile.uid,
            toUsername: currentProfile.username,
            status: "pending",
            createdAt: sig.createdAt || Date.now(),
          };

          setRequests((prev) => {
            if (prev.some((r) => r.fromUid === newReq.fromUid)) return prev;
            const updated = [newReq, ...prev];
            saveStoredFriendRequests(updated);
            return updated;
          });

          playChatSound("join");
        }
      }

      // 2. Friend Request Accepted
      if (sig.type === "friend_request_accepted") {
        const isForMe =
          sig.targetUid === currentProfile.uid || sig.targetUid?.startsWith(currentProfile.uid);

        if (isForMe) {
          const acceptedFriend: FriendProfile = {
            uid: sig.fromUid,
            username: sig.fromUsername,
            tag: sig.fromTag || getOrCreateUserTag(sig.fromUsername),
            photoURL:
              sig.fromPhotoURL ||
              `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(sig.fromUsername)}`,
            status: "online",
            customStatus: "Friended • Connected",
            lastSeen: Date.now(),
          };

          setFriends((prev) => {
            const updated = [acceptedFriend, ...prev.filter((f) => f.uid !== acceptedFriend.uid)];
            saveStoredFriends(updated);
            return updated;
          });

          playChatSound("send");
        }
      }

      // 3. Direct Message Received
      if (sig.type === "direct_dm_message" && sig.message) {
        const msg = sig.message;
        const isForMe =
          sig.targetUid === currentProfile.uid || msg.receiverUid === currentProfile.uid;

        if (isForMe && msg.senderUid !== currentProfile.uid) {
          const senderUid = msg.senderUid;
          const currentMsgs = getStoredDMMessages(senderUid);
          const updated = [...currentMsgs.filter((m) => m.id !== msg.id), msg];
          saveStoredDMMessages(senderUid, updated);

          if (activeDMFriendRef.current?.uid === senderUid) {
            setDmMessages(updated);
            setTimeout(() => {
              dmMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 50);
          }

          playChatSound("send");
        }
      }
    });

    return () => unsub();
  }, [currentProfile.uid, currentProfile.username]);

  // Handle Copy Friend Tag
  const handleCopyTag = () => {
    navigator.clipboard.writeText(fullUserTag);
    setCopiedTag(true);
    playChatSound("send");
    setTimeout(() => setCopiedTag(false), 2000);
  };

  // 1-Click Direct Add from the Online Players list
  const handleAddOnlinePlayerDirect = (player: any) => {
    if (!player || !player.uid) return;

    if (
      player.uid === currentProfile.uid ||
      player.username.toLowerCase() === (currentProfile.username || "").toLowerCase()
    ) {
      setAddFeedback({ type: "error", msg: "You cannot add yourself as a friend!" });
      return;
    }

    const alreadyFriend = friends.find(
      (f) =>
        f.uid === player.uid ||
        f.username.toLowerCase() === player.username.toLowerCase()
    );
    if (alreadyFriend) {
      setAddFeedback({
        type: "error",
        msg: `@${player.username} is already on your friends list!`,
      });
      return;
    }

    const playerTag = player.tag || getOrCreateUserTag(player.username);
    const playerPhoto =
      player.photoURL && !player.photoURL.includes("bottts")
        ? player.photoURL
        : `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(player.username)}`;

    // Broadcast real-time friend request signal
    sendBroadcastSignal({
      type: "friend_request_sent",
      id: `freq_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      fromUid: currentProfile.uid,
      fromUsername: currentProfile.username,
      fromTag: myTag,
      fromPhotoURL:
        currentProfile.photoURL && !currentProfile.photoURL.includes("bottts")
          ? currentProfile.photoURL
          : `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(currentProfile.username)}`,
      targetUid: player.uid,
      toUsername: player.username,
      toTag: playerTag,
      createdAt: Date.now(),
    });

    const newFriend: FriendProfile = {
      uid: player.uid,
      username: player.username,
      tag: playerTag,
      photoURL: playerPhoto,
      status: "online",
      customStatus: player.activity?.details || "Online & studying",
      lastSeen: Date.now(),
    };

    const updatedFriends = [newFriend, ...friends.filter((f) => f.uid !== newFriend.uid)];
    setFriends(updatedFriends);
    saveStoredFriends(updatedFriends);
    window.dispatchEvent(new CustomEvent("frosted_friends_updated", { detail: updatedFriends }));

    setAddFeedback({
      type: "success",
      msg: `Added @${newFriend.username}${newFriend.tag} to your friends list!`,
    });
    setAddUsernameInput("");
    playChatSound("send");

    setTimeout(() => {
      setActiveTab("all");
    }, 400);
  };

  // Handle Adding Friend by searching username or tag
  const handleSendFriendRequest = (targetInput?: string) => {
    const rawTarget = (targetInput || addUsernameInput).trim().replace(/^@/, "");
    if (!rawTarget) return;

    let matchedOnline: any = undefined;

    // Strategy 1: Check if input is pure gamer tag (e.g. "#4821" or "4821")
    if (/^#?\d{3,5}$/.test(rawTarget)) {
      const searchTag = (rawTarget.startsWith("#") ? rawTarget : `#${rawTarget}`).toUpperCase();
      matchedOnline = onlineUsers.find((u) => {
        const uTag = (u.tag || getOrCreateUserTag(u.username)).toUpperCase();
        return uTag === searchTag;
      });
    }

    // Strategy 2: If input contains "#" like "Frost_Wolf_382#4821" or "@Frost_Wolf_382#4821"
    if (!matchedOnline && rawTarget.includes("#")) {
      const parts = rawTarget.split("#");
      const namePart = parts[0].trim().toLowerCase();
      const tagDigits = parts[1].trim().replace(/\D/g, "");
      const searchTag = tagDigits ? `#${tagDigits}`.toUpperCase() : "";

      // Try exact name AND tag match first
      matchedOnline = onlineUsers.find((u) => {
        const uName = u.username.toLowerCase();
        const uTag = (u.tag || getOrCreateUserTag(u.username)).toUpperCase();
        if (namePart && searchTag) {
          return uName === namePart && uTag === searchTag;
        }
        if (searchTag) {
          return uTag === searchTag;
        }
        return uName === namePart;
      });

      // If still not matched, check if tag matches alone or name matches alone
      if (!matchedOnline && searchTag) {
        matchedOnline = onlineUsers.find((u) => {
          const uTag = (u.tag || getOrCreateUserTag(u.username)).toUpperCase();
          return uTag === searchTag;
        });
      }
      if (!matchedOnline && namePart) {
        matchedOnline = onlineUsers.find((u) => u.username.toLowerCase() === namePart);
      }
    }

    // Strategy 3: Username exact or case-insensitive match
    if (!matchedOnline) {
      const searchName = rawTarget.toLowerCase();
      matchedOnline = onlineUsers.find(
        (u) =>
          u.username.toLowerCase() === searchName ||
          u.uid.toLowerCase() === searchName ||
          u.username.toLowerCase().replace(/[^a-z0-9]/g, "") === searchName.replace(/[^a-z0-9]/g, "")
      );
    }

    // Strategy 4: Substring match on username
    if (!matchedOnline) {
      const searchName = rawTarget.toLowerCase();
      if (searchName.length >= 3) {
        matchedOnline = onlineUsers.find((u) => u.username.toLowerCase().includes(searchName));
      }
    }

    // CRITICAL: If no real user is currently online or found, DO NOT CREATE A FAKE FRIEND!
    if (!matchedOnline) {
      setAddFeedback({
        type: "error",
        msg: `No online player found matching "${rawTarget}". Check the gamer tag (e.g. #4821) or click Add next to their name in the Online Players list below!`,
      });
      return;
    }

    // Prevent adding yourself
    if (
      matchedOnline.uid === currentProfile.uid ||
      matchedOnline.username.toLowerCase() === (currentProfile.username || "").toLowerCase()
    ) {
      setAddFeedback({ type: "error", msg: "You cannot add yourself as a friend!" });
      return;
    }

    // Check if already friends
    const existing = friends.find(
      (f) =>
        f.uid === matchedOnline.uid ||
        f.username.toLowerCase() === matchedOnline.username.toLowerCase()
    );
    if (existing) {
      setAddFeedback({
        type: "error",
        msg: `@${existing.username}${existing.tag || ""} is already on your friends list!`,
      });
      return;
    }

    // Add the real verified online player
    handleAddOnlinePlayerDirect(matchedOnline);
  };

  // Handle removing a friend
  const handleRemoveFriend = (friendUid: string, friendName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Remove @${friendName} from your friends list?`)) {
      const updated = friends.filter((f) => f.uid !== friendUid);
      setFriends(updated);
      saveStoredFriends(updated);
      window.dispatchEvent(new CustomEvent("frosted_friends_updated", { detail: updated }));
      if (activeDMFriend?.uid === friendUid) {
        setActiveDMFriend(null);
      }
    }
  };

  // Accept incoming friend request
  const handleAcceptRequest = (req: FriendRequest) => {
    const friendPhoto =
      req.fromPhotoURL && !req.fromPhotoURL.includes("bottts")
        ? req.fromPhotoURL
        : `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(req.fromUsername)}`;

    const newFriend: FriendProfile = {
      uid: req.fromUid,
      username: req.fromUsername,
      tag: req.fromTag || getOrCreateUserTag(req.fromUsername),
      photoURL: friendPhoto,
      status: "online",
      customStatus: "Friended • Online",
      lastSeen: Date.now(),
    };

    const updatedFriends = [newFriend, ...friends.filter((f) => f.uid !== newFriend.uid)];
    setFriends(updatedFriends);
    saveStoredFriends(updatedFriends);
    window.dispatchEvent(new CustomEvent("frosted_friends_updated", { detail: updatedFriends }));

    // Send real-time accepted signal to the sender
    sendBroadcastSignal({
      type: "friend_request_accepted",
      fromUid: currentProfile.uid,
      fromUsername: currentProfile.username,
      fromTag: myTag,
      fromPhotoURL:
        currentProfile.photoURL && !currentProfile.photoURL.includes("bottts")
          ? currentProfile.photoURL
          : `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(currentProfile.username)}`,
      targetUid: req.fromUid,
    });

    const updatedReqs = requests.filter((r) => r.id !== req.id);
    setRequests(updatedReqs);
    saveStoredFriendRequests(updatedReqs);

    setActiveTab("all");
    playChatSound("join");
  };

  // Decline request
  const handleDeclineRequest = (reqId: string) => {
    const updatedReqs = requests.filter((r) => r.id !== reqId);
    setRequests(updatedReqs);
    saveStoredFriendRequests(updatedReqs);
  };

  // Send Direct Message to Friend
  const handleSendDM = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!dmInputText.trim() || !activeDMFriend) return;

    const newMsg: DirectMessage = {
      id: "dm_" + Date.now(),
      senderUid: profile.uid,
      receiverUid: activeDMFriend.uid,
      text: dmInputText.trim(),
      timestamp: Date.now(),
    };

    const updated = [...dmMessages, newMsg];
    setDmMessages(updated);
    saveStoredDMMessages(activeDMFriend.uid, updated);
    setDmInputText("");
    playChatSound("send");

    // Broadcast DM in real-time to the target friend
    sendBroadcastSignal({
      type: "direct_dm_message",
      targetUid: activeDMFriend.uid,
      message: newMsg,
    });

    setTimeout(() => {
      dmMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  // Share Study Flashcard Deck in DM
  const handleShareStudyDeck = () => {
    if (!activeDMFriend) return;

    const shareMsg: DirectMessage = {
      id: "dm_share_" + Date.now(),
      senderUid: profile.uid,
      receiverUid: activeDMFriend.uid,
      text: "📚 Shared a Study Flashcard Deck: Chemistry Active Recall Master Deck!",
      timestamp: Date.now(),
      studyShare: {
        title: "Chemistry Active Recall Master Deck",
        type: "flashcards",
      },
    };

    const updated = [...dmMessages, shareMsg];
    setDmMessages(updated);
    saveStoredDMMessages(activeDMFriend.uid, updated);
    playChatSound("send");

    // Broadcast deck share in real-time
    sendBroadcastSignal({
      type: "direct_dm_message",
      targetUid: activeDMFriend.uid,
      message: shareMsg,
    });

    setTimeout(() => {
      dmMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  // Filtered friends
  const onlineFriends = useMemo(() => friends.filter((f) => f.status === "online"), [friends]);
  const pendingIncoming = useMemo(() => requests.filter((r) => r.status === "pending" && r.toUid === currentProfile.uid), [requests, currentProfile.uid]);

  const availableOnlinePlayers = useMemo(() => {
    return onlineUsers.filter((u) => {
      if (u.uid === currentProfile.uid || u.username.toLowerCase() === (currentProfile.username || "").toLowerCase()) return false;
      if (u.uid === "echo_bot_assistant" || u.username.toLowerCase().includes("echo")) return false;
      const isFriend = friends.some((f) => f.username.toLowerCase() === u.username.toLowerCase() || f.uid === u.uid);
      return !isFriend;
    });
  }, [onlineUsers, currentProfile.uid, currentProfile.username, friends]);

  const displayedFriends = useMemo(() => {
    let list = activeTab === "online" ? onlineFriends : friends;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((f) => f.username.toLowerCase().includes(q) || (f.tag && f.tag.toLowerCase().includes(q)));
    }
    return list;
  }, [activeTab, onlineFriends, friends, searchQuery]);

  return (
    <div className="flex flex-col h-full w-full bg-[var(--theme-darkest)] text-white overflow-hidden relative">
      {/* Header Bar */}
      <div className="p-3 sm:p-4 border-b border-[var(--theme-border-subtle)] flex flex-wrap items-center justify-between gap-3 bg-[var(--theme-darker)]/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src={currentProfile.photoURL || `https://api.dicebear.com/7.x/thumbs/svg?seed=${currentProfile.username}`}
              alt={currentProfile.username}
              className="w-10 h-10 rounded-xl border border-[var(--theme-border)] object-cover shadow-sm"
            />
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 border-2 border-[var(--theme-darkest)] shadow-sm" />
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm text-white">{currentProfile.username}</span>
              <span className="text-xs text-neutral-400 font-mono font-medium">{myTag}</span>
            </div>
            <p className="text-[11px] text-emerald-400 font-medium">Online &bull; Frosted Studying</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyTag}
            style={{ backgroundColor: "var(--theme-surface)", borderColor: "var(--theme-border)" }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold text-neutral-200 hover:text-white transition-all cursor-pointer shadow-sm active:scale-95"
            title="Copy your friend tag to share with classmates"
          >
            {copiedTag ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            <span>{copiedTag ? "Copied Tag!" : "Copy My Tag"}</span>
          </button>

          <button
            onClick={() => setActiveTab("add")}
            style={{ backgroundColor: "var(--theme-accent)", borderColor: "var(--theme-border-strong)" }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold text-white transition-all cursor-pointer shadow-md active:scale-95 hover:brightness-110"
          >
            <UserPlus size={14} />
            <span>Add Friend</span>
          </button>
        </div>
      </div>

      {/* Friends Sub-Navigation Bar */}
      <div className="px-3 py-2 border-b border-[var(--theme-border-subtle)] flex items-center justify-between gap-2 bg-[var(--theme-darkest)]/60 text-xs">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          <button
            onClick={() => { setActiveTab("online"); setActiveDMFriend(null); }}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "online" && !activeDMFriend
                ? "bg-[var(--theme-surface)] text-white border border-[var(--theme-border)]"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <Circle size={8} className="fill-emerald-400 text-emerald-400" />
            <span>Online ({onlineFriends.length})</span>
          </button>

          <button
            onClick={() => { setActiveTab("all"); setActiveDMFriend(null); }}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "all" && !activeDMFriend
                ? "bg-[var(--theme-surface)] text-white border border-[var(--theme-border)]"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <Users size={13} />
            <span>All Friends ({friends.length})</span>
          </button>

          <button
            onClick={() => { setActiveTab("pending"); setActiveDMFriend(null); }}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 relative ${
              activeTab === "pending" && !activeDMFriend
                ? "bg-[var(--theme-surface)] text-white border border-[var(--theme-border)]"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <Clock size={13} />
            <span>Pending</span>
            {pendingIncoming.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-[10px] font-black text-white">
                {pendingIncoming.length}
              </span>
            )}
          </button>
        </div>

        {/* Search Friends Input */}
        <div className="relative hidden sm:block w-48">
          <Search size={12} className="absolute left-2.5 top-2.5 text-neutral-400" />
          <input
            type="text"
            placeholder="Search friends..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ backgroundColor: "var(--theme-surface)", borderColor: "var(--theme-border-subtle)" }}
            className="w-full pl-7 pr-2.5 py-1 rounded-xl border text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[var(--theme-accent)] transition-all"
          />
        </div>
      </div>

      {/* Main Friends Content Area */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Active DM Conversation Window */}
        {activeDMFriend ? (
          <div className="flex-1 flex flex-col h-full bg-[var(--theme-darkest)] z-10">
            {/* DM Header */}
            <div className="p-3 border-b border-[var(--theme-border-subtle)] flex items-center justify-between bg-[var(--theme-darker)]">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveDMFriend(null)}
                  className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                  title="Back to friends list"
                >
                  <X size={16} />
                </button>

                <div className="relative">
                  <img
                    src={
                      activeDMFriend.photoURL && !activeDMFriend.photoURL.includes("bottts")
                        ? activeDMFriend.photoURL
                        : `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(activeDMFriend.username)}`
                    }
                    alt={activeDMFriend.username}
                    className="w-8 h-8 rounded-xl object-cover border border-[var(--theme-border-subtle)]"
                  />
                  <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-[var(--theme-darkest)] ${
                    activeDMFriend.status === "online" ? "bg-emerald-400" : "bg-amber-400"
                  }`} />
                </div>

                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs sm:text-sm text-white">{activeDMFriend.username}</span>
                    <span className="text-[11px] text-neutral-400 font-mono">{activeDMFriend.tag}</span>
                  </div>
                  <p className="text-[10px] text-neutral-400 truncate">{activeDMFriend.customStatus || "Studying on Frosted Studying"}</p>
                </div>
              </div>

              {/* Call Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => startDirectCall({ uid: activeDMFriend.uid, username: activeDMFriend.username, photoURL: activeDMFriend.photoURL }, "audio")}
                  style={{ backgroundColor: "var(--theme-surface)", borderColor: "var(--theme-border)" }}
                  className="p-2 rounded-xl border text-emerald-400 hover:bg-emerald-500/20 transition-all cursor-pointer active:scale-95"
                  title="Start Voice Call"
                >
                  <Phone size={15} />
                </button>

                <button
                  onClick={() => startDirectCall({ uid: activeDMFriend.uid, username: activeDMFriend.username, photoURL: activeDMFriend.photoURL }, "video")}
                  style={{ backgroundColor: "var(--theme-surface)", borderColor: "var(--theme-border)" }}
                  className="p-2 rounded-xl border text-cyan-400 hover:bg-cyan-500/20 transition-all cursor-pointer active:scale-95"
                  title="Start Video Call"
                >
                  <Video size={15} />
                </button>

                <button
                  onClick={handleShareStudyDeck}
                  style={{ backgroundColor: "var(--theme-surface)", borderColor: "var(--theme-border)" }}
                  className="p-2 rounded-xl border text-[var(--theme-text-accent)] hover:bg-white/5 transition-all cursor-pointer active:scale-95 flex items-center gap-1 text-xs font-semibold"
                  title="Share Study Flashcard Deck"
                >
                  <BookOpen size={14} />
                  <span className="hidden sm:inline">Share Deck</span>
                </button>
              </div>
            </div>

            {/* DM Message Log */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 custom-scrollbar">
              {dmMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-6 text-neutral-400 space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-[var(--theme-surface)] border border-[var(--theme-border)] flex items-center justify-center text-[var(--theme-text-accent)] shadow-lg">
                    <MessageSquare size={22} />
                  </div>
                  <h3 className="font-bold text-white text-sm">Start Direct Message with @{activeDMFriend.username}</h3>
                  <p className="text-xs max-w-xs text-neutral-400">
                    Send a message, invite them to a study call, or share flashcards!
                  </p>
                </div>
              ) : (
                dmMessages.map((msg) => {
                  const isMe = msg.senderUid === profile.uid;
                  return (
                    <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                      <div
                        style={{
                          backgroundColor: isMe ? "var(--theme-accent)" : "var(--theme-surface)",
                          borderColor: isMe ? "var(--theme-border-strong)" : "var(--theme-border)",
                        }}
                        className={`max-w-[85%] sm:max-w-md px-3.5 py-2.5 rounded-2xl border text-xs text-white shadow-md space-y-1 ${
                          isMe ? "rounded-tr-xs" : "rounded-tl-xs"
                        }`}
                      >
                        {msg.studyShare && (
                          <div className="p-2.5 rounded-xl bg-black/20 border border-white/10 flex items-center gap-2 mb-1.5">
                            <BookOpen size={16} className="text-amber-400 shrink-0" />
                            <div>
                              <p className="font-bold text-xs text-amber-300">{msg.studyShare.title}</p>
                              <p className="text-[10px] text-neutral-300">Click to import into Active Recall Study Mode</p>
                            </div>
                          </div>
                        )}
                        <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                        <span className="block text-[9px] text-neutral-300/70 text-right font-mono mt-1">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={dmMessagesEndRef} />
            </div>

            {/* DM Input Bar */}
            <form onSubmit={handleSendDM} className="p-3 border-t border-[var(--theme-border-subtle)] bg-[var(--theme-darker)] flex items-center gap-2">
              <input
                type="text"
                placeholder={`Message @${activeDMFriend.username}...`}
                value={dmInputText}
                onChange={(e) => setDmInputText(e.target.value)}
                style={{ backgroundColor: "var(--theme-surface)", borderColor: "var(--theme-border)" }}
                className="flex-1 px-3.5 py-2 rounded-xl border text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[var(--theme-accent)] transition-all"
              />
              <button
                type="submit"
                disabled={!dmInputText.trim()}
                style={{
                  backgroundColor: dmInputText.trim() ? "var(--theme-accent)" : "var(--theme-surface)",
                  borderColor: dmInputText.trim() ? "var(--theme-border-strong)" : "var(--theme-border)",
                }}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                  dmInputText.trim() ? "text-white shadow-md active:scale-95" : "text-neutral-500 cursor-not-allowed"
                }`}
              >
                <Send size={15} />
              </button>
            </form>
          </div>
        ) : activeTab === "add" ? (
          /* Add Friend Form & Suggested Partners */
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-6 max-w-xl mx-auto w-full custom-scrollbar">
            <div className="space-y-2 text-center sm:text-left">
              <h2 className="text-lg font-black text-white flex items-center justify-center sm:justify-start gap-2">
                <UserPlus className="text-[var(--theme-text-accent)]" size={20} />
                <span>Add Friend by Tag</span>
              </h2>
              <p className="text-xs text-neutral-400">
                Enter your classmate's username tag (e.g. <code className="text-emerald-400 font-mono">@giggity#8291</code> or <code className="text-emerald-400 font-mono">@frosty_alex</code>) to connect!
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendFriendRequest();
              }}
              className="space-y-3"
            >
              <div className="relative">
                <input
                  type="text"
                  placeholder="Enter username or @username#1234..."
                  value={addUsernameInput}
                  onChange={(e) => {
                    setAddUsernameInput(e.target.value);
                    setAddFeedback(null);
                  }}
                  style={{ backgroundColor: "var(--theme-surface)", borderColor: "var(--theme-border)" }}
                  className="w-full pl-4 pr-28 py-3 rounded-2xl border text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[var(--theme-accent)] transition-all shadow-inner"
                />
                <button
                  type="submit"
                  disabled={!addUsernameInput.trim()}
                  style={{ backgroundColor: "var(--theme-accent)", borderColor: "var(--theme-border-strong)" }}
                  className="absolute right-1.5 top-1.5 bottom-1.5 px-4 rounded-xl border text-xs font-bold text-white transition-all cursor-pointer shadow-md hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Friend
                </button>
              </div>

              {addFeedback && (
                <div className={`p-3 rounded-xl border text-xs font-medium ${
                  addFeedback.type === "success"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                }`}>
                  {addFeedback.msg}
                </div>
              )}
            </form>

            {/* Active Connected Players in Room */}
            <div className="mt-8 pt-6 border-t border-[var(--theme-border-subtle)] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                  <Users size={14} className="text-emerald-400" />
                  <span>Online Players You Can Add ({availableOnlinePlayers.length})</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  Live
                </span>
              </div>

              {availableOnlinePlayers.length === 0 ? (
                <div className="p-4 rounded-2xl border border-[var(--theme-border-subtle)] bg-white/5 text-center text-xs text-neutral-400 space-y-1">
                  <p className="font-semibold text-neutral-300">No other players online right now</p>
                  <p className="text-[11px] text-neutral-500">
                    When classmates or friends open Frosted on their devices, they appear here live! You can also share your tag ({fullUserTag}) with them.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {availableOnlinePlayers.map((player) => (
                    <div
                      key={player.uid}
                      style={{ backgroundColor: "var(--theme-surface)", borderColor: "var(--theme-border)" }}
                      className="p-3 rounded-2xl border flex items-center justify-between gap-3 shadow-sm hover:border-[var(--theme-border-strong)] transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          <img
                            src={player.photoURL || `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(player.username)}`}
                            alt={player.username}
                            className="w-9 h-9 rounded-xl object-cover border border-emerald-400/40"
                          />
                          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-neutral-900" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-white truncate">@{player.username}</span>
                            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded border border-emerald-500/20">
                              {getOrCreateUserTag(player.username)}
                            </span>
                          </div>
                          <p className="text-[10px] text-neutral-400 truncate">
                            {player.activity?.details || "Online & studying"}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleAddOnlinePlayerDirect(player)}
                        style={{ backgroundColor: "var(--theme-accent)", borderColor: "var(--theme-border-strong)" }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-bold text-white shadow-sm hover:brightness-110 active:scale-95 transition-all cursor-pointer shrink-0"
                      >
                        <UserPlus size={13} />
                        <span>Add</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : activeTab === "pending" ? (
          /* Pending Requests View */
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 max-w-xl mx-auto w-full custom-scrollbar">
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
              <Clock size={16} />
              <span>Pending Requests ({requests.length})</span>
            </h2>

            {requests.length === 0 ? (
              <div className="text-center py-12 text-neutral-500 space-y-2">
                <UserCheck size={32} className="mx-auto text-neutral-600" />
                <p className="text-xs">No pending friend requests.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {requests.map((req) => (
                  <div
                    key={req.id}
                    style={{ backgroundColor: "var(--theme-surface)", borderColor: "var(--theme-border)" }}
                    className="p-3 rounded-2xl border flex items-center justify-between gap-3 shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={req.fromPhotoURL || `https://api.dicebear.com/7.x/thumbs/svg?seed=${req.fromUsername}`}
                        alt={req.fromUsername}
                        className="w-9 h-9 rounded-xl object-cover"
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-white">@{req.fromUsername}</span>
                          <span className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                            {req.fromTag || getOrCreateUserTag(req.fromUsername)}
                          </span>
                        </div>
                        <p className="text-[10px] text-neutral-400">Incoming Friend Request</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAcceptRequest(req)}
                        className="p-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                      >
                        <UserCheck size={14} />
                        <span>Accept</span>
                      </button>
                      <button
                        onClick={() => handleDeclineRequest(req.id)}
                        className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition-all cursor-pointer"
                      >
                        <UserX size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Main Friends List View (Online / All) */
          <div className="flex-1 p-3 sm:p-4 overflow-y-auto space-y-2 custom-scrollbar">
            {displayedFriends.length === 0 ? (
              <div className="text-center py-16 text-neutral-500 space-y-3">
                <Users size={36} className="mx-auto text-neutral-600" />
                <h3 className="font-bold text-white text-sm">
                  {activeTab === "online" ? "No Friends Online Right Now" : "No Friends Added Yet"}
                </h3>
                <p className="text-xs text-neutral-400 max-w-xs mx-auto">
                  Add your classmates or study partners using their friend tag to chat and study together!
                </p>
                <button
                  onClick={() => setActiveTab("add")}
                  style={{ backgroundColor: "var(--theme-accent)", borderColor: "var(--theme-border-strong)" }}
                  className="px-4 py-2 rounded-xl border text-xs font-bold text-white shadow-md hover:brightness-110 transition-all cursor-pointer"
                >
                  Find & Add Friends
                </button>
              </div>
            ) : (
              displayedFriends.map((friend) => (
                <div
                  key={friend.uid}
                  style={{ backgroundColor: "var(--theme-surface)", borderColor: "var(--theme-border-subtle)" }}
                  className="p-3 rounded-2xl border flex items-center justify-between gap-3 shadow-sm hover:border-[var(--theme-border)] transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <img
                        src={
                          friend.photoURL && !friend.photoURL.includes("bottts")
                            ? friend.photoURL
                            : `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(friend.username)}`
                        }
                        alt={friend.username}
                        className="w-10 h-10 rounded-xl object-cover border border-[var(--theme-border-subtle)]"
                      />
                      <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--theme-darkest)] ${
                        friend.status === "online" ? "bg-emerald-400 shadow-sm shadow-emerald-400/50 animate-pulse" : "bg-amber-400"
                      }`} />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs sm:text-sm text-white truncate">@{friend.username}</span>
                        <span className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20 shrink-0">
                          {friend.tag || getOrCreateUserTag(friend.username)}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-400 truncate">{friend.customStatus || "Studying on Frosted Studying"}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => setActiveDMFriend(friend)}
                      style={{ backgroundColor: "var(--theme-darker)", borderColor: "var(--theme-border)" }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold text-white hover:bg-white/10 transition-all cursor-pointer shadow-sm active:scale-95"
                    >
                      <MessageSquare size={13} className="text-[var(--theme-text-accent)]" />
                      <span>Message</span>
                    </button>

                    <button
                      onClick={() => startDirectCall({ uid: friend.uid, username: friend.username, photoURL: friend.photoURL }, "audio")}
                      className="p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-all cursor-pointer active:scale-95"
                      title="Start Voice Call"
                    >
                      <Phone size={14} />
                    </button>

                    <button
                      onClick={() => startDirectCall({ uid: friend.uid, username: friend.username, photoURL: friend.photoURL }, "video")}
                      className="p-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 transition-all cursor-pointer active:scale-95"
                      title="Start Video Call"
                    >
                      <Video size={14} />
                    </button>

                    <button
                      onClick={(e) => handleRemoveFriend(friend.uid, friend.username, e)}
                      className="p-2 rounded-xl text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
                      title="Remove Friend"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
