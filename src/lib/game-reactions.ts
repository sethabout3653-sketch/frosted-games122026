import { useState, useEffect, useCallback } from "react";

const GAME_REACTIONS_STORAGE_KEY = "frosted_game_reactions_v1";
const GAME_REACTIONS_CHANGE_EVENT = "frosted_game_reactions_changed";
const USER_UID_STORAGE_KEY = "frosted_device_uid";

export const PRESET_GAME_EMOJIS = [
  { emoji: "🔥", label: "Fire / Hype" },
  { emoji: "👑", label: "Masterpiece / GOAT" },
  { emoji: "🎮", label: "Top Gameplay" },
  { emoji: "❤️", label: "Loved It" },
  { emoji: "💀", label: "Hard / Difficult" },
  { emoji: "🚀", label: "Addictive" },
  { emoji: "😂", label: "Funny / Fun" },
  { emoji: "⚡", label: "Intense" },
  { emoji: "🏆", label: "Champion / S-Tier" },
  { emoji: "🤯", label: "Mind Blown" },
  { emoji: "🕹️", label: "Nostalgic" },
  { emoji: "👾", label: "Retro Classic" },
  { emoji: "💯", label: "100% Perfect" },
  { emoji: "✨", label: "Cozy / Aesthetic" },
  { emoji: "💩", label: "Trash / Troll" },
];

export const SUGGESTED_GAME_TEXT_REACTIONS = [
  "10/10",
  "W Game",
  "Nostalgic",
  "Rage Quit",
  "S Tier",
  "Peak",
  "Chill Vibes",
  "Speedrun!",
  "Hardcore",
  "Absolute Cinema",
  "Goated",
  "Classic",
];

// Map of gameId -> Record<reactionKey, string[] (array of uids)>
type GameReactionsMap = Record<string, Record<string, string[]>>;

function getDeviceUid(): string {
  try {
    let uid = localStorage.getItem(USER_UID_STORAGE_KEY);
    if (!uid) {
      uid = "usr_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
      localStorage.setItem(USER_UID_STORAGE_KEY, uid);
    }
    return uid;
  } catch {
    return "guest_user";
  }
}

function getAllGameReactions(): GameReactionsMap {
  try {
    const raw = localStorage.getItem(GAME_REACTIONS_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch (e) {
    console.warn("Failed to load game reactions:", e);
    return {};
  }
}

function saveAllGameReactions(data: GameReactionsMap) {
  try {
    localStorage.setItem(GAME_REACTIONS_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("Failed to save game reactions:", e);
  }
}

/**
 * Get reactions for a specific game.
 */
export function getGameReactions(gameId: string | number): Record<string, string[]> {
  const all = getAllGameReactions();
  return all[String(gameId)] || {};
}

/**
 * Toggle a reaction for a game.
 */
export function toggleGameReaction(
  gameId: string | number,
  reactionKey: string,
  userUid?: string
): Record<string, string[]> {
  const uid = userUid || getDeviceUid();
  const cleanKey = reactionKey.trim();
  if (!cleanKey) return getGameReactions(gameId);

  const all = getAllGameReactions();
  const gId = String(gameId);
  const current = all[gId] || {};
  const users = current[cleanKey] || [];
  const hasReacted = users.includes(uid);

  let newUsers: string[];
  if (hasReacted) {
    newUsers = users.filter((u) => u !== uid);
  } else {
    newUsers = [...users, uid];
  }

  const updatedReactions = { ...current };
  if (newUsers.length > 0) {
    updatedReactions[cleanKey] = newUsers;
  } else {
    delete updatedReactions[cleanKey];
  }

  all[gId] = updatedReactions;
  saveAllGameReactions(all);

  window.dispatchEvent(
    new CustomEvent(GAME_REACTIONS_CHANGE_EVENT, {
      detail: { gameId: gId, reactions: updatedReactions },
    })
  );

  return updatedReactions;
}

/**
 * React hook to read and manipulate reactions for a given game in real-time.
 */
export function useGameReactions(gameId: string | number) {
  const [reactions, setReactions] = useState<Record<string, string[]>>(() =>
    getGameReactions(gameId)
  );
  const uid = getDeviceUid();

  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ gameId: string; reactions: Record<string, string[]> }>;
      if (customEvent.detail && customEvent.detail.gameId === String(gameId)) {
        setReactions(customEvent.detail.reactions);
      } else if (!customEvent.detail) {
        setReactions(getGameReactions(gameId));
      }
    };

    window.addEventListener(GAME_REACTIONS_CHANGE_EVENT, handleUpdate);
    window.addEventListener("storage", handleUpdate);

    // Initial load
    setReactions(getGameReactions(gameId));

    return () => {
      window.removeEventListener(GAME_REACTIONS_CHANGE_EVENT, handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [gameId]);

  const toggle = useCallback(
    (reactionKey: string) => {
      return toggleGameReaction(gameId, reactionKey, uid);
    },
    [gameId, uid]
  );

  const addCustomReaction = useCallback(
    (customText: string) => {
      const clean = customText.trim();
      if (!clean) return;
      return toggleGameReaction(gameId, clean, uid);
    },
    [gameId, uid]
  );

  const userReactionKeys = Object.entries(reactions)
    .filter(([_, users]) => users.includes(uid))
    .map(([key]) => key);

  return {
    reactions,
    userReactions: userReactionKeys,
    toggleReaction: toggle,
    addCustomReaction,
    deviceUid: uid,
  };
}
