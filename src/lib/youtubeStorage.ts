import { YouTubeVideo } from "../types";

const SAVED_VIDEOS_KEY = "frosted_yt_saved_videos";
const WATCH_HISTORY_KEY = "frosted_yt_watch_history";
const LAST_PLAYED_KEY = "frosted_yt_last_played";

export interface HistoryItem {
  video: YouTubeVideo;
  watchedAt: number;
  lastPosition?: number;
  duration?: number;
}

export function safeJsonStringify(obj: any): string {
  const cache = new Set();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === "object" && value !== null) {
      if (cache.has(value)) {
        return undefined; // Circular reference found, discard key
      }
      cache.add(value);
      
      // If it is any DOM Element or React Fiber Node, discard it to avoid circular structure errors
      if (
        value instanceof Element || 
        (value.constructor && value.constructor.name && (
          value.constructor.name.includes("HTML") || 
          value.constructor.name.includes("Fiber") ||
          value.constructor.name.includes("Element")
        ))
      ) {
        return undefined;
      }
    }
    return value;
  });
}

export function getSavedVideos(): YouTubeVideo[] {
  try {
    const raw = localStorage.getItem(SAVED_VIDEOS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function isVideoSaved(videoId: string): boolean {
  const saved = getSavedVideos();
  return saved.some((v) => v.id === videoId);
}

export function toggleSaveVideo(video: YouTubeVideo): boolean {
  const saved = getSavedVideos();
  const index = saved.findIndex((v) => v.id === video.id);
  let isNowSaved = false;

  if (index >= 0) {
    saved.splice(index, 1);
    isNowSaved = false;
  } else {
    saved.unshift(video);
    isNowSaved = true;
  }

  try {
    localStorage.setItem(SAVED_VIDEOS_KEY, safeJsonStringify(saved.slice(0, 100)));
  } catch (e) {
    console.error("Failed to persist saved video:", e);
  }

  return isNowSaved;
}

export function getWatchHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(WATCH_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addToWatchHistory(video: YouTubeVideo, lastPosition: number = 0, duration: number = 0) {
  const history = getWatchHistory();
  const existingIdx = history.findIndex((h) => h.video.id === video.id);

  const item: HistoryItem = {
    video,
    watchedAt: Date.now(),
    lastPosition,
    duration,
  };

  if (existingIdx >= 0) {
    history.splice(existingIdx, 1);
  }
  history.unshift(item);

  try {
    localStorage.setItem(WATCH_HISTORY_KEY, safeJsonStringify(history.slice(0, 50)));
    localStorage.setItem(LAST_PLAYED_KEY, safeJsonStringify(item));
  } catch (e) {
    console.error("Failed to save history:", e);
  }
}

export function clearWatchHistory() {
  try {
    localStorage.removeItem(WATCH_HISTORY_KEY);
  } catch {}
}
