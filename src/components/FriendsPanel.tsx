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
  generateBotDMResponse,
  DEFAULT_STUDY_BUDDIES,
} from "../lib/friends";
import { ChatProfile } from "../types";
import { useCall } from "../context/CallContext";
import { playChatSound } from "../lib/ringtone-synthesizer";

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
  const [friends, setFriends] = useState<FriendProfile[]>(getStoredFriends);
  const [requests, setRequests] = useState<FriendRequest[]>(getStoredFriendRequests);
  const [activeTab, setActiveTab] = useState<"online" | "all" | "pending" | "add">("online");
  const [searchQuery, setSearchQuery] = useState("");
  const [addUsernameInput, setAddUsernameInput] = useState("");
  const [addFeedback, setAddFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [copiedTag, setCopiedTag] = useState(false);

  // Active Direct Message state
  const [activeDMFriend, setActiveDMFriend] = useState<FriendProfile | null>(null);
  const [dmMessages, setDmMessages] = useState<DirectMessage[]>([]);
  const [dmInputText, setDmInputText] = useState("");
  const dmMessagesEndRef = useRef<HTMLDivElement>(null);

  const { startDirectCall } = useCall();

  // Current user's tag & profile details
  const myTag = useMemo(() => getOrCreateUserTag(profile.username || "Guest"), [profile.username]);
  const fullUserTag = `@${profile.username || "Guest"}${myTag}`;

  // Load DM messages when active friend changes
  useEffect(() => {
    if (activeDMFriend) {
      const stored = getStoredDMMessages(activeDMFriend.uid);
      setDmMessages(stored);
      // Auto scroll
      setTimeout(() => {
        dmMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [activeDMFriend]);

  // Handle Copy Friend Tag
  const handleCopyTag = () => {
    navigator.clipboard.writeText(fullUserTag);
    setCopiedTag(true);
    playChatSound("send");
    setTimeout(() => setCopiedTag(false), 2000);
  };

  // Handle Sending Friend Request
  const handleSendFriendRequest = (targetUsername?: string) => {
    const rawTarget = (targetUsername || addUsernameInput).trim().replace(/^@/, "");
    if (!rawTarget) return;

    // Check if already friends
    const cleanTargetName = rawTarget.split("#")[0].toLowerCase();
    const existing = friends.find((f) => f.username.toLowerCase() === cleanTargetName);
    if (existing) {
      setAddFeedback({ type: "error", msg: `@${existing.username} is already on your friends list!` });
      return;
    }

    // Check if pending request exists
    const existingReq = requests.find((r) => r.toUsername.toLowerCase() === cleanTargetName);
    if (existingReq) {
      setAddFeedback({ type: "error", msg: `Friend request to @${cleanTargetName} is already pending!` });
      return;
    }

    // Check if adding built-in study buddy
    const preset = DEFAULT_STUDY_BUDDIES.find((b) => b.username.toLowerCase() === cleanTargetName);
    if (preset) {
      const updated = [preset, ...friends.filter((f) => f.uid !== preset.uid)];
      setFriends(updated);
      saveStoredFriends(updated);
      setAddFeedback({ type: "success", msg: `Added @${preset.username} to your friends list!` });
      setAddUsernameInput("");
      playChatSound("send");
      return;
    }

    // Create new pending friend request
    const newReq: FriendRequest = {
      id: "req_" + Date.now(),
      fromUid: profile.uid,
      fromUsername: profile.username || "Guest",
      fromTag: myTag,
      fromPhotoURL: profile.photoURL || "",
      toUid: "user_" + cleanTargetName,
      toUsername: cleanTargetName,
      status: "pending",
      createdAt: Date.now(),
    };

    const updatedReqs = [newReq, ...requests];
    setRequests(updatedReqs);
    saveStoredFriendRequests(updatedReqs);

    setAddFeedback({ type: "success", msg: `Friend request sent to @${cleanTargetName}!` });
    setAddUsernameInput("");
    playChatSound("send");
  };

  // Accept incoming friend request
  const handleAcceptRequest = (req: FriendRequest) => {
    const newFriend: FriendProfile = {
      uid: req.fromUid,
      username: req.fromUsername,
      tag: req.fromTag,
      photoURL: req.fromPhotoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${req.fromUsername}`,
      status: "online",
      customStatus: "Studying on Frosted Studying 📚",
      lastSeen: Date.now(),
    };

    const updatedFriends = [newFriend, ...friends];
    setFriends(updatedFriends);
    saveStoredFriends(updatedFriends);

    const updatedReqs = requests.filter((r) => r.id !== req.id);
    setRequests(updatedReqs);
    saveStoredFriendRequests(updatedReqs);

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

    setTimeout(() => {
      dmMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  // Filtered friends
  const onlineFriends = useMemo(() => friends.filter((f) => f.status === "online"), [friends]);
  const pendingIncoming = useMemo(() => requests.filter((r) => r.status === "pending" && r.toUid === profile.uid), [requests, profile.uid]);

  const displayedFriends = useMemo(() => {
    let list = activeTab === "online" ? onlineFriends : friends;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((f) => f.username.toLowerCase().includes(q) || f.tag.toLowerCase().includes(q));
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
              src={profile.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${profile.username}`}
              alt={profile.username}
              className="w-10 h-10 rounded-xl border border-[var(--theme-border)] object-cover shadow-sm"
            />
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 border-2 border-[var(--theme-darkest)] shadow-sm" />
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm text-white">{profile.username}</span>
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
                    src={activeDMFriend.photoURL}
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
                  placeholder="Enter username tag..."
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
                  Send Request
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
                        src={req.fromPhotoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${req.fromUsername}`}
                        alt={req.fromUsername}
                        className="w-9 h-9 rounded-xl object-cover"
                      />
                      <div>
                        <span className="font-bold text-xs text-white">@{req.fromUsername}</span>
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
                        src={friend.photoURL}
                        alt={friend.username}
                        className="w-10 h-10 rounded-xl object-cover border border-[var(--theme-border-subtle)]"
                      />
                      <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--theme-darkest)] ${
                        friend.status === "online" ? "bg-emerald-400 shadow-sm shadow-emerald-400/50 animate-pulse" : "bg-amber-400"
                      }`} />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs sm:text-sm text-white truncate">@{friend.username}</span>
                        <span className="text-[10px] text-neutral-400 font-mono shrink-0">{friend.tag}</span>
                      </div>
                      <p className="text-[11px] text-neutral-400 truncate">{friend.customStatus || "Studying on Frosted Studying"}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
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
                      title="Start Study Call"
                    >
                      <Phone size={14} />
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
