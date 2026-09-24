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
        // Filter out any leftover fake bots
        return parsed.filter((f) => !f.isBot && !f.uid.startsWith("user_bot_"));
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

// Automated response logic for interactive study buddies
export function generateBotDMResponse(botFriend: FriendProfile, userText: string): string {
  const text = userText.toLowerCase();

  if (text.includes("hello") || text.includes("hi") || text.includes("hey") || text.includes("yo")) {
    return `Hey! 👋 Great to see you studying on Frosted Studying! How's your session going?`;
  }
  if (text.includes("game") || text.includes("play") || text.includes("slope") || text.includes("dash")) {
    return `Nice! I love playing Slope and Geometry Dash during quick 5-minute Pomodoro breaks. What's your top score? 🎮`;
  }
  if (text.includes("tab") || text.includes("cloak") || text.includes("panic")) {
    return `Pro tip: You can press the Panic key (~ or Esc) anytime to instantly hide your tab as Google Drive or Canvas LMS! 🛡️`;
  }
  if (text.includes("math") || text.includes("calc") || text.includes("quiz") || text.includes("study")) {
    return `Need a quick study break or help with a topic? Frosted AI can generate custom active recall flashcards for you anytime! 📚✨`;
  }
  if (text.includes("flashcard") || text.includes("note")) {
    return `I can help you review your flashcards or quiz you on any chapter whenever you want! ⚡`;
  }

  const responses = [
    `That's awesome! Staying focused is so much easier with Frosted Studying's Lofi timer. 🎧`,
    `Got it! Let me know if you want to team up for a study session or compare flashcard decks! 🚀`,
    `100%! I'm currently using Frosted AI to review my notes for tomorrow's exam. 📖`,
    `Sound good! Keep crushing your study goals today! 🔥`,
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}
