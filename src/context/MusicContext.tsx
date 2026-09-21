import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from "react";
import { YouTubeVideo } from "../types";
import { extractYouTubeId } from "../components/YouTubePlayer";

export interface MusicContextType {
  currentTrack: YouTubeVideo | null;
  isPlaying: boolean;
  queue: YouTubeVideo[];
  queueIndex: number;
  volume: number;
  isMuted: boolean;
  playbackPosition: number;
  duration: number;
  repeatMode: "off" | "all" | "one";
  isShuffle: boolean;
  likedTracks: YouTubeVideo[];
  history: YouTubeVideo[];
  isExpandedPlayer: boolean;
  setIsExpandedPlayer: (val: boolean) => void;
  playTrack: (track: YouTubeVideo, newQueue?: YouTubeVideo[]) => void;
  togglePlay: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  seekTo: (seconds: number) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  toggleRepeat: () => void;
  toggleShuffle: () => void;
  toggleLike: (track: YouTubeVideo) => void;
  isLiked: (id: string) => boolean;
  addToQueue: (track: YouTubeVideo) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  playQueueIndex: (index: number) => void;
}

const MusicContext = createContext<MusicContextType | null>(null);

const STORAGE_KEY_LIKED = "frosted_music_liked";
const STORAGE_KEY_HISTORY = "frosted_music_history";
const STORAGE_KEY_VOL = "frosted_music_volume";

export function MusicProvider({ children }: { children: ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<YouTubeVideo | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [queue, setQueue] = useState<YouTubeVideo[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [volume, setVolumeState] = useState(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY_VOL);
      return v !== null ? parseFloat(v) : 0.85;
    } catch {
      return 0.85;
    }
  });
  const [isMuted, setIsMuted] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [repeatMode, setRepeatMode] = useState<"off" | "all" | "one">("off");
  const [isShuffle, setIsShuffle] = useState(false);
  const [isExpandedPlayer, setIsExpandedPlayer] = useState(false);

  // Liked tracks from local storage
  const [likedTracks, setLikedTracks] = useState<YouTubeVideo[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LIKED);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // History from local storage
  const [history, setHistory] = useState<YouTubeVideo[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_HISTORY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const positionTimerRef = useRef<number | null>(null);

  // Save liked tracks
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_LIKED, JSON.stringify(likedTracks));
    } catch (e) {
      // Storage quota or disabled
    }
  }, [likedTracks]);

  // Save history
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history.slice(0, 50)));
    } catch (e) {
      // Storage quota or disabled
    }
  }, [history]);

  // Save volume
  const setVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setVolumeState(clamped);
    if (clamped > 0 && isMuted) {
      setIsMuted(false);
    }
    try {
      localStorage.setItem(STORAGE_KEY_VOL, clamped.toString());
    } catch (e) {}

    // Send to iframe if active
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({
          event: "command",
          func: "setVolume",
          args: [Math.round(clamped * 100)],
        }),
        "*"
      );
    }
  }, [isMuted]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({
            event: "command",
            func: next ? "mute" : "unMute",
            args: [],
          }),
          "*"
        );
      }
      return next;
    });
  }, []);

  // PostMessage helper to YouTube embed
  const postIframeCommand = useCallback((func: string, args: any[] = []) => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({
            event: "command",
            func,
            args,
          }),
          "*"
        );
      } catch (err) {
        // Cross origin safety
      }
    }
  }, []);

  // Parse duration string into seconds (e.g. "3:45" or "1:02:30")
  const parseDurationString = (dur?: string): number => {
    if (!dur) return 180;
    const parts = dur.split(":").map((p) => parseInt(p, 10));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return parts[0] * 60 + parts[1];
    }
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return 180;
  };

  // Play a specific track
  const playTrack = useCallback(
    (track: YouTubeVideo, newQueue?: YouTubeVideo[]) => {
      setCurrentTrack(track);
      setIsPlaying(true);
      setPlaybackPosition(0);
      const estimatedSec = parseDurationString(track.duration);
      setDuration(estimatedSec);

      // Add to history
      setHistory((prev) => {
        const filtered = prev.filter((t) => t.id !== track.id);
        return [track, ...filtered];
      });

      if (newQueue && newQueue.length > 0) {
        setQueue(newQueue);
        const idx = newQueue.findIndex((t) => t.id === track.id);
        setQueueIndex(idx !== -1 ? idx : 0);
      } else {
        setQueue((prev) => {
          if (!prev.some((t) => t.id === track.id)) {
            return [...prev, track];
          }
          return prev;
        });
      }
    },
    []
  );

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => {
      const next = !prev;
      if (next) {
        postIframeCommand("playVideo");
      } else {
        postIframeCommand("pauseVideo");
      }
      return next;
    });
  }, [postIframeCommand]);

  const nextTrack = useCallback(() => {
    if (queue.length === 0) return;
    if (repeatMode === "one" && currentTrack) {
      // Replay current
      setPlaybackPosition(0);
      postIframeCommand("seekTo", [0, true]);
      postIframeCommand("playVideo");
      return;
    }

    let nextIdx = queueIndex + 1;
    if (isShuffle) {
      nextIdx = Math.floor(Math.random() * queue.length);
    }

    if (nextIdx < queue.length) {
      setQueueIndex(nextIdx);
      playTrack(queue[nextIdx]);
    } else if (repeatMode === "all" && queue.length > 0) {
      setQueueIndex(0);
      playTrack(queue[0]);
    } else {
      setIsPlaying(false);
      setPlaybackPosition(0);
    }
  }, [queue, queueIndex, repeatMode, isShuffle, currentTrack, playTrack, postIframeCommand]);

  const prevTrack = useCallback(() => {
    if (playbackPosition > 5) {
      // Restart current track if played more than 5s
      setPlaybackPosition(0);
      postIframeCommand("seekTo", [0, true]);
      return;
    }
    if (queueIndex > 0 && queue.length > 0) {
      const prevIdx = queueIndex - 1;
      setQueueIndex(prevIdx);
      playTrack(queue[prevIdx]);
    } else {
      setPlaybackPosition(0);
      postIframeCommand("seekTo", [0, true]);
    }
  }, [playbackPosition, queueIndex, queue, playTrack, postIframeCommand]);

  const seekTo = useCallback(
    (seconds: number) => {
      setPlaybackPosition(seconds);
      postIframeCommand("seekTo", [seconds, true]);
    },
    [postIframeCommand]
  );

  const toggleRepeat = useCallback(() => {
    setRepeatMode((prev) => {
      if (prev === "off") return "all";
      if (prev === "all") return "one";
      return "off";
    });
  }, []);

  const toggleShuffle = useCallback(() => {
    setIsShuffle((prev) => !prev);
  }, []);

  const toggleLike = useCallback((track: YouTubeVideo) => {
    setLikedTracks((prev) => {
      const exists = prev.some((t) => t.id === track.id);
      if (exists) {
        return prev.filter((t) => t.id !== track.id);
      }
      return [track, ...prev];
    });
  }, []);

  const isLiked = useCallback(
    (id: string) => {
      return likedTracks.some((t) => t.id === id);
    },
    [likedTracks]
  );

  const addToQueue = useCallback((track: YouTubeVideo) => {
    setQueue((prev) => {
      if (prev.some((t) => t.id === track.id)) return prev;
      return [...prev, track];
    });
  }, []);

  const removeFromQueue = useCallback((index: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
    setQueueIndex(0);
  }, []);

  const playQueueIndex = useCallback(
    (index: number) => {
      if (index >= 0 && index < queue.length) {
        setQueueIndex(index);
        playTrack(queue[index]);
      }
    },
    [queue, playTrack]
  );

  // Position ticker when playing
  useEffect(() => {
    if (!isPlaying) {
      if (positionTimerRef.current) {
        clearInterval(positionTimerRef.current);
        positionTimerRef.current = null;
      }
      return;
    }

    positionTimerRef.current = window.setInterval(() => {
      setPlaybackPosition((prev) => {
        if (duration > 0 && prev >= duration) {
          nextTrack();
          return 0;
        }
        return prev + 1;
      });
    }, 1000);

    return () => {
      if (positionTimerRef.current) {
        clearInterval(positionTimerRef.current);
        positionTimerRef.current = null;
      }
    };
  }, [isPlaying, duration, nextTrack]);

  // Handle messages from the YouTube iframe if available
  useEffect(() => {
    const handleWindowMessage = (event: MessageEvent) => {
      try {
        if (typeof event.data === "string") {
          const data = JSON.parse(event.data);
          // YouTube API state changes: 0 = ended, 1 = playing, 2 = paused
          if (data.event === "onStateChange") {
            if (data.info === 0) {
              nextTrack();
            } else if (data.info === 1) {
              setIsPlaying(true);
            } else if (data.info === 2) {
              setIsPlaying(false);
            }
          }
        }
      } catch (err) {}
    };

    window.addEventListener("message", handleWindowMessage);
    return () => window.removeEventListener("message", handleWindowMessage);
  }, [nextTrack]);

  const cleanVideoId = currentTrack ? extractYouTubeId(currentTrack.id) : "";

  return (
    <MusicContext.Provider
      value={{
        currentTrack,
        isPlaying,
        queue,
        queueIndex,
        volume,
        isMuted,
        playbackPosition,
        duration,
        repeatMode,
        isShuffle,
        likedTracks,
        history,
        isExpandedPlayer,
        setIsExpandedPlayer,
        playTrack,
        togglePlay,
        nextTrack,
        prevTrack,
        seekTo,
        setVolume,
        toggleMute,
        toggleRepeat,
        toggleShuffle,
        toggleLike,
        isLiked,
        addToQueue,
        removeFromQueue,
        clearQueue,
        playQueueIndex,
      }}
    >
      {children}

      {/* Hidden Persistent Audio/Video Player Engine */}
      {cleanVideoId && (
        <div
          id="global-music-engine"
          className="fixed -bottom-[9999px] -right-[9999px] opacity-0 pointer-events-none w-1 h-1 overflow-hidden"
          aria-hidden="true"
        >
          <iframe
            ref={iframeRef}
            key={cleanVideoId}
            src={`https://www.youtube-nocookie.com/embed/${cleanVideoId}?autoplay=1&enablejsapi=1&origin=${encodeURIComponent(
              typeof window !== "undefined" ? window.location.origin : ""
            )}&playsinline=1&controls=0&rel=0`}
            title="Music Player Audio Stream"
            allow="autoplay; encrypted-media"
            className="w-1 h-1"
          />
        </div>
      )}
    </MusicContext.Provider>
  );
}

export function useMusic() {
  const context = useContext(MusicContext);
  if (!context) {
    throw new Error("useMusic must be used within a MusicProvider");
  }
  return context;
}
