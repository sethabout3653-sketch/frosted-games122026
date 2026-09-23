import { useEffect, useRef, useState, useCallback } from "react";
import { UserActivity, ChatProfile } from "../types";
import { wsClient } from "./websocket-client";
import { db, doc, setDoc, toTimestampMs } from "../supabase-adapter";

const ADJECTIVES = ["Frost", "Neon", "Shadow", "Cosmic", "Pixel", "Solar", "Echo", "Vortex", "Apex", "Cyber", "Nova", "Hyper"];
const NOUNS = ["Runner", "Knight", "Fox", "Falcon", "Ninja", "Wolf", "Pilot", "Gamer", "Ghost", "Hawk", "Spark", "Viper"];

// Persistent or Session Profile Retriever
export function getSavedProfile(): ChatProfile {
  try {
    const params = new URLSearchParams(window.location.search);
    const urlUser = params.get("user");
    if (urlUser && urlUser.trim().toLowerCase() !== "anonymous") {
      return {
        uid: "user_" + urlUser.toLowerCase().replace(/[^a-z0-9]/g, ""),
        username: urlUser.trim(),
        photoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(urlUser.trim())}`,
      };
    }

    const sessionSaved = sessionStorage.getItem("frosted_chat_profile");
    if (sessionSaved) {
      const parsed = JSON.parse(sessionSaved);
      if (parsed && parsed.username && parsed.username.trim().toLowerCase() !== "anonymous") {
        return parsed;
      }
    }

    const saved = localStorage.getItem("frosted_chat_profile");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.username && parsed.username.trim().toLowerCase() !== "anonymous") {
        let tabId = sessionStorage.getItem("frosted_tab_id");
        if (!tabId) {
          tabId = Math.random().toString(36).substring(2, 6);
          sessionStorage.setItem("frosted_tab_id", tabId);
        }
        const profile = {
          ...parsed,
          uid: parsed.uid.includes("_tab_") ? parsed.uid : `${parsed.uid}_tab_${tabId}`,
        };
        sessionStorage.setItem("frosted_chat_profile", JSON.stringify(profile));
        return profile;
      }
    }

    // Auto-generate a consistent, real profile if none set yet
    let tabId = sessionStorage.getItem("frosted_tab_id");
    if (!tabId) {
      tabId = Math.random().toString(36).substring(2, 6);
      sessionStorage.setItem("frosted_tab_id", tabId);
    }
    const randAdj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const randNoun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    const randNum = Math.floor(100 + Math.random() * 900);
    const generatedUsername = `${randAdj}_${randNoun}_${randNum}`;
    const generatedUid = `user_${generatedUsername.toLowerCase()}_tab_${tabId}`;
    const generatedPhoto = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(generatedUsername)}`;

    const autoProfile: ChatProfile = {
      uid: generatedUid,
      username: generatedUsername,
      photoURL: generatedPhoto,
    };

    sessionStorage.setItem("frosted_chat_profile", JSON.stringify(autoProfile));
    localStorage.setItem("frosted_chat_profile", JSON.stringify(autoProfile));
    return autoProfile;
  } catch (e) {
    const fallbackName = `Player_${Math.floor(100 + Math.random() * 900)}`;
    return {
      uid: `user_${fallbackName.toLowerCase()}`,
      username: fallbackName,
      photoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(fallbackName)}`,
    };
  }
}

export function saveUserProfile(profile: ChatProfile) {
  try {
    sessionStorage.setItem("frosted_chat_profile", JSON.stringify(profile));
    localStorage.setItem("frosted_chat_profile", JSON.stringify(profile));
    window.dispatchEvent(new CustomEvent("frosted_profile_updated", { detail: profile }));
    broadcastPresenceUpdate();
  } catch (e) {}
}

// Global in-memory current user activity state
let currentGlobalActivity: UserActivity = {
  type: "scrolling",
  text: "Browsing games",
  startedAt: Date.now(),
  timestamp: Date.now(),
};

let lastPlayingTimestamp = 0;
let activeCurrentView: "home" | "game" | "chat" | "youtube" = "home";
let cachedSelectedGame: { name: string; cover?: string } | null = null;
let cachedVideoTitle: string | null = null;

// Global in-memory voice state
let currentVoiceState = {
  inVoice: false,
  isMuted: false,
  isVideoOn: false,
  isVideoLoading: false,
  isScreenSharing: false,
  isScreenAudioOn: false,
  channelName: "General Voice",
};

const activityListeners = new Set<(activity: UserActivity) => void>();
const voiceStateListeners = new Set<(voiceState: typeof currentVoiceState) => void>();

export function setVoiceState(state: Partial<typeof currentVoiceState>) {
  currentVoiceState = { ...currentVoiceState, ...state };
  voiceStateListeners.forEach((cb) => {
    try {
      cb(currentVoiceState);
    } catch (e) {}
  });
  broadcastPresenceUpdate();
}

export function getVoiceState() {
  return currentVoiceState;
}

export function onVoiceStateChanged(cb: (vs: typeof currentVoiceState) => void): () => void {
  voiceStateListeners.add(cb);
  cb(currentVoiceState);
  return () => {
    voiceStateListeners.delete(cb);
  };
}

export function updateGlobalActivity(activity: Partial<UserActivity>) {
  const now = Date.now();
  const prev = currentGlobalActivity;

  // Anti-flicker Hysteresis: Protect active 'playing' state from micro-glitches
  if (activity.type === "playing") {
    lastPlayingTimestamp = now;
  } else if (prev.type === "playing" && (now - lastPlayingTimestamp < 2500 || activeCurrentView === "game" || activeCurrentView === "youtube")) {
    // Hold the playing state to prevent millisecond glitching back to scrolling/chatting
    if (activity.type === "scrolling" || activity.type === "searching") {
      return;
    }
  }

  let computedText = activity.text;
  if (!computedText) {
    if (activity.type === "playing") {
      computedText = `Playing ${activity.gameName || "Game"}`;
    } else if (activity.type === "searching") {
      computedText = activity.query ? `Searching: "${activity.query}"` : "Searching for games";
    } else if (activity.type === "chatting") {
      computedText = activity.channel ? `In Chat #${activity.channel}` : "In Frosted Chat";
    } else if (activity.type === "scrolling") {
      computedText = activity.tag && activity.tag !== "all" ? `Browsing ${activity.tag}` : "Browsing games";
    } else {
      computedText = "Browsing games";
    }
  }

  const isSameTypeAndTarget =
    prev.type === activity.type &&
    prev.gameName === activity.gameName &&
    prev.query === activity.query &&
    prev.tag === activity.tag &&
    prev.channel === activity.channel;

  const nextActivity: UserActivity = {
    ...prev,
    ...activity,
    text: computedText,
    startedAt: isSameTypeAndTarget ? prev.startedAt || now : now,
    timestamp: now,
  };

  currentGlobalActivity = nextActivity;
  activityListeners.forEach((cb) => {
    try {
      cb(nextActivity);
    } catch (e) {}
  });

  // Broadcast instantly via WebSockets and save to persistent presence
  broadcastPresenceUpdate(nextActivity);
}

export function getCurrentActivity(): UserActivity {
  return currentGlobalActivity;
}

export function onActivityChanged(cb: (act: UserActivity) => void): () => void {
  activityListeners.add(cb);
  cb(currentGlobalActivity);
  return () => {
    activityListeners.delete(cb);
  };
}

let lastBroadcastTs = 0;
let pendingBroadcastTimer: any = null;

export function broadcastPresenceUpdate(activity?: UserActivity) {
  const profile = getSavedProfile();
  if (!profile || !profile.uid) return;

  const active = activity || currentGlobalActivity;
  const now = Date.now();

  const presencePayload = {
    uid: profile.uid,
    username: profile.username,
    photoURL: profile.photoURL || "",
    status: "online",
    lastSeen: now,
    timestamp: now,
    activity: active,
    inVoice: currentVoiceState.inVoice,
    isMuted: currentVoiceState.isMuted,
    isVideoOn: currentVoiceState.isVideoOn,
    isVideoLoading: currentVoiceState.isVideoLoading,
    isScreenSharing: currentVoiceState.isScreenSharing,
    isScreenAudioOn: currentVoiceState.isScreenAudioOn,
    channelName: currentVoiceState.channelName,
  };

  // 1. Instant 0ms WebSocket Broadcast
  try {
    wsClient.setUserUid(profile.uid);
    wsClient.sendChange("set", "presence", profile.uid, presencePayload);
  } catch (e) {}

  // 2. Throttle persistent database writes to avoid hammering
  if (now - lastBroadcastTs > 1500) {
    lastBroadcastTs = now;
    if (pendingBroadcastTimer) clearTimeout(pendingBroadcastTimer);
    try {
      setDoc(doc(db, "presence", profile.uid), presencePayload, { merge: true }).catch(() => {});
    } catch (e) {}
  } else if (!pendingBroadcastTimer) {
    pendingBroadcastTimer = setTimeout(() => {
      pendingBroadcastTimer = null;
      lastBroadcastTs = Date.now();
      try {
        setDoc(doc(db, "presence", profile.uid), {
          ...presencePayload,
          lastSeen: Date.now(),
          timestamp: Date.now(),
        }, { merge: true }).catch(() => {});
      } catch (e) {}
    }, 1500);
  }
}

/**
 * React Hook to synchronize view, search query, selected game, and scroll events to real-time activity
 */
export function useActivityTracker({
  currentView,
  selectedGame,
  searchQuery,
  selectedTag,
  activeChannel,
  activeVideoTitle,
}: {
  currentView: "home" | "game" | "chat" | "youtube";
  selectedGame?: { name: string; cover?: string } | null;
  searchQuery?: string;
  selectedTag?: string;
  activeChannel?: string;
  activeVideoTitle?: string | null;
}) {
  const lastScrollTimeRef = useRef(0);

  // Sync state changes to global activity
  useEffect(() => {
    activeCurrentView = currentView;
    if (selectedGame) cachedSelectedGame = selectedGame;
    if (activeVideoTitle) cachedVideoTitle = activeVideoTitle;

    if (currentView === "youtube") {
      const musicTitle = activeVideoTitle || cachedVideoTitle;
      updateGlobalActivity({
        type: "playing",
        gameName: musicTitle ? `Frosted Music: ${musicTitle}` : "Frosted Music",
        text: musicTitle ? `Listening to: ${musicTitle}` : "Listening to Frosted Music",
      });
      return;
    }

    if (currentView === "game") {
      const gameToUse = selectedGame || cachedSelectedGame;
      if (gameToUse) {
        updateGlobalActivity({
          type: "playing",
          gameName: gameToUse.name,
          gameCover: gameToUse.cover,
          text: `Playing ${gameToUse.name}`,
        });
        return;
      }
    }

    if (currentView === "chat") {
      updateGlobalActivity({
        type: "chatting",
        channel: activeChannel || "general",
        text: activeChannel ? `In #${activeChannel}` : "In Frosted Chat",
      });
      return;
    }

    // Home view
    if (searchQuery && searchQuery.trim().length > 0) {
      updateGlobalActivity({
        type: "searching",
        query: searchQuery.trim(),
        text: `Searching: "${searchQuery.trim()}"`,
      });
      return;
    }

    // Scrolling / Browsing games catalog
    updateGlobalActivity({
      type: "scrolling",
      tag: selectedTag || "all",
      text: selectedTag && selectedTag !== "all" ? `Browsing ${selectedTag}` : "Browsing games",
    });
  }, [currentView, selectedGame?.name, searchQuery, selectedTag, activeChannel, activeVideoTitle]);

  // Track window scroll when on home view
  useEffect(() => {
    if (currentView !== "home") return;

    const handleScroll = () => {
      const now = Date.now();
      if (now - lastScrollTimeRef.current > 2000) {
        lastScrollTimeRef.current = now;
        if (!searchQuery?.trim()) {
          updateGlobalActivity({
            type: "scrolling",
            tag: selectedTag || "all",
            text: selectedTag && selectedTag !== "all" ? `Browsing ${selectedTag}` : "Scrolling games",
          });
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [currentView, searchQuery, selectedTag]);

  // Periodic heartbeat every 3 seconds to keep WebSocket presence and lastSeen active
  useEffect(() => {
    const heartbeat = setInterval(() => {
      broadcastPresenceUpdate();
    }, 3000);

    return () => clearInterval(heartbeat);
  }, []);
}
