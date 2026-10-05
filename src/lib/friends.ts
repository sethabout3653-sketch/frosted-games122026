// Persistent Real-Time Friends & Direct Messaging System for Frosted Studying

export interface FriendProfile {
  uid: string;
  username: string;
  tag: string; // e.g. "#4821"
  photoURL: string;
  status: "online" | "idle" | "dnd" | "offline";
  customStatus?: string;
  activity?: {
    type?: string;
    name?: string;
    details?: string;
  };
  lastSeen: number;
  isBot?: boolean;
}

export interface FriendRequest {
  id: string;
  fromUid: string;
  fromUsername: string;
  fromTag: string;
  fromPhotoURL: string;
  toUid: string;
  toUsername: string;
  status: "pending" | "accepted" | "declined";
  createdAt: number;
}

export interface DirectMessage {
  id: string;
  senderUid: string;
  receiverUid: string;
  text: string;
  timestamp: number;
  attachment?: string;
  attachmentType?: string;
  attachmentName?: string;
  studyShare?: {
    title: string;
    type: "flashcards" | "notes" | "game_invite";
    data?: any;
  };
}

const FRIENDS_STORAGE_KEY = "frosted_friends_v1";
const REQUESTS_STORAGE_KEY = "frosted_friend_requests_v1";
const MESSAGES_STORAGE_KEY = "frosted_dm_messages_v1";
const MY_PROFILE_KEY = "frosted_my_friend_profile_v1";

// Preset Interactive Study Friends (Empty by default - user adds real friends)
export const DEFAULT_STUDY_BUDDIES: FriendProfile[] = [];

// Generates a consistent Tag for a user (e.g. #4821)
export function getOrCreateUserTag(username: string): string {
  if (!username) return "#1000";
  // If tag is already formatted as #1234, return it directly
  if (username.startsWith("#") && /^#\d{4}$/.test(username)) {
    return username;
  }
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = (hash << 5) - hash + username.charCodeAt(i);
    hash |= 0;
  }
  const tagNum = Math.abs(hash % 9000) + 1000;
  return `#${tagNum}`;
}

// Loads stored friends list
export function getStoredFriends(): FriendProfile[] {
  try {
    const raw = localStorage.getItem(FRIENDS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Filter out fake bots and broken fake friends (empty names, bots, or numeric tag names)
        return parsed
          .filter((f) => {
            if (!f) return false;
            if (f.isBot) return false;
            const uid = (f.uid || "").toLowerCase();
            if (
              uid.startsWith("user_bot_") ||
              uid.includes("echo_bot") ||
              uid.includes("fake") ||
              uid.startsWith("bot_") ||
              uid === "echo_companion" ||
              uid === "echo_sound_test"
            ) {
              return false;
            }
            const uname = (f.username || "").trim();
            if (
              !uname ||
              /^\d{3,5}$/.test(uname) ||
              uname.toLowerCase().includes("bot") ||
              uname.toLowerCase().includes("echo companion")
            ) {
              return false;
            }
            return true;
          })
          .map((f) => ({
            ...f,
            photoURL: (f.photoURL || "").includes("bottts")
              ? f.photoURL.replace("bottts", "thumbs")
              : (f.photoURL || `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(f.username || "User")}`),
            tag: f.tag || getOrCreateUserTag(f.username || "User"),
          }));
      }
    }
  } catch {}
  return [];
}

// Saves friends list
export function saveStoredFriends(friends: FriendProfile[]) {
  try {
    localStorage.setItem(FRIENDS_STORAGE_KEY, JSON.stringify(friends));
  } catch {}
}

// Loads pending requests
export function getStoredFriendRequests(): FriendRequest[] {
  try {
    const raw = localStorage.getItem(REQUESTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

// Saves pending requests
export function saveStoredFriendRequests(requests: FriendRequest[]) {
  try {
    localStorage.setItem(REQUESTS_STORAGE_KEY, JSON.stringify(requests));
  } catch {}
}

// Loads DM messages
export function getStoredDMMessages(friendUid: string): DirectMessage[] {
  try {
    const raw = localStorage.getItem(`${MESSAGES_STORAGE_KEY}_${friendUid}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

// Saves DM messages
export function saveStoredDMMessages(friendUid: string, messages: DirectMessage[]) {
  try {
    localStorage.setItem(`${MESSAGES_STORAGE_KEY}_${friendUid}`, JSON.stringify(messages.slice(-200)));
  } catch {}
}

