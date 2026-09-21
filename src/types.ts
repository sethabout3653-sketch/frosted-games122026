export interface Game {
  id: number | string;
  name: string;
  cover: string;
  url: string;
  author?: string;
  authorLink?: string;
  featured?: boolean;
  special?: string[];
  source?: "catalog" | "luminsdk";
  luminId?: string;
  isMod?: boolean;
  _search?: string;
}

export type SortOption = "name" | "id" | "popular";

export interface UserActivity {
  type: "playing" | "searching" | "scrolling" | "chatting" | "idle";
  gameName?: string;
  gameCover?: string;
  query?: string;
  tag?: string;
  channel?: string;
  text?: string;
  startedAt?: number;
  timestamp?: number;
}

export interface ChatProfile {
  uid: string;
  username: string;
  photoURL: string;
  isMuted?: boolean;
  isVideoOn?: boolean;
  isVideoLoading?: boolean;
  status?: "online" | "left" | "offline";
  lastSeen?: number;
  timestamp?: number;
  activity?: UserActivity;
}

export interface ChatMessage {
  id: string;
  channelId?: string;
  uid: string;
  username: string;
  photoURL: string;
  text?: string;
  gif?: string;
  gifTitle?: string;
  attachment?: string;
  attachmentType?: string;
  attachmentName?: string;
  attachmentSize?: number;
  timestamp: number;
  reactions?: Record<string, string[]>;
  _isOptimistic?: boolean;
}

export interface VoiceSignal {
  id: string;
  uid: string;
  targetUid: string;
  type: "offer" | "answer" | "candidate";
  sdp: string;
  timestamp: number;
}

export interface YouTubeStreamFormat {
  url: string;
  proxyUrl?: string;
  quality: string;
  resolution?: string;
  mimeType?: string;
  container?: string;
  fps?: number;
  hasAudio?: boolean;
  hasVideo?: boolean;
  bitrate?: number;
  itag?: number;
  isDirectGooglevideo?: boolean;
}

export interface YouTubeVideo {
  id: string;
  title: string;
  channelTitle?: string;
  channelId?: string;
  channelThumbnail?: string;
  views?: string | number;
  likes?: string | number;
  publishedTime?: string;
  duration?: string;
  thumbnail: string;
  description?: string;
  descriptionSnippet?: string;
  category?: string;
  streamUrl?: string;
  streamFormats?: YouTubeStreamFormat[];
  hlsUrl?: string;
  isShort?: boolean;
  isMusic?: boolean;
}

