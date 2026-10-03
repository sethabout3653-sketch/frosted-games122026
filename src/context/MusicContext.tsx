import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from "react";

export interface Track {
  id: string;
  youtubeId: string;
  title: string;
  artist: string;
  duration?: string;
  durationSec?: number;
  thumbnail: string;
  permalinkUrl?: string;
  genre?: string;
  source?: string;
  streamUrl?: string;
}

export type MediaMode = "audio" | "video";
export type MusicTabType = "home" | "artists" | "genres" | "library" | "player";

interface MusicContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  queue: Track[];
  isShuffle: boolean;
  repeatMode: "off" | "all" | "one";
  mediaMode: MediaMode;
  setMediaMode: (mode: MediaMode) => void;
  toggleMediaMode: () => void;
  activeTab: MusicTabType;
  setActiveTab: (tab: MusicTabType) => void;
  openFullPlayer: (onOpenMusicView?: () => void) => void;
  toggleFullPlayer: (onOpenMusicView?: () => void) => void;
  playTrack: (track: Track, newQueue?: Track[]) => void;
  togglePlay: () => void;
  seek: (seconds: number) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  favorites: Track[];
  toggleFavorite: (track: Track) => void;
  isFavorite: (id: string) => boolean;
  getStreamUrl: (track: Track, mode: MediaMode) => string;
}

const MusicContext = createContext<MusicContextType | null>(null);

const STORAGE_FAVORITES_KEY = "frosted_music_favorites_v9";
const STORAGE_MEDIA_MODE_KEY = "frosted_music_media_mode";

export function MusicProvider({ children }: { children: ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [queue, setQueue] = useState<Track[]>([]);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<"off" | "all" | "one">("off");
  const [activeTab, setActiveTab] = useState<MusicTabType>("home");

  const [mediaMode, setMediaModeState] = useState<MediaMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_MEDIA_MODE_KEY);
      return saved === "video" ? "video" : "audio";
    } catch {
      return "audio";
    }
  });

  const [favorites, setFavorites] = useState<Track[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_FAVORITES_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Dedicated Native Audio element & YouTube Player instance
  const nativeAudioRef = useRef<HTMLAudioElement | null>(null);
  const ytPlayerRef = useRef<any>(null);
  const isYtReadyRef = useRef<boolean>(false);
  const pendingTrackRef = useRef<Track | null>(null);

  // Mutable refs for state
  const repeatModeRef = useRef(repeatMode);
  useEffect(() => {
    repeatModeRef.current = repeatMode;
  }, [repeatMode]);

  const queueRef = useRef(queue);
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const currentTrackRef = useRef(currentTrack);
  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  const isShuffleRef = useRef(isShuffle);
  useEffect(() => {
    isShuffleRef.current = isShuffle;
  }, [isShuffle]);

  const volumeRef = useRef(volume);
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  const isMutedRef = useRef(isMuted);
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Stream URL generator
  const getStreamUrl = useCallback((track: Track, mode: MediaMode) => {
    const target = track.youtubeId || track.id;
    return `/api/music/stream?id=${encodeURIComponent(target)}&mode=${mode}&title=${encodeURIComponent(
      track.title || ""
    )}&artist=${encodeURIComponent(track.artist || "")}&url=${encodeURIComponent(
      track.permalinkUrl || ""
    )}`;
  }, []);

  // Initialize YouTube Iframe API
  useEffect(() => {
    const win = window as any;

    if (!document.getElementById("yt-iframe-api-script")) {
      const tag = document.createElement("script");
      tag.id = "yt-iframe-api-script";
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
    }

    const initPlayer = () => {
      if (win.YT && win.YT.Player && !ytPlayerRef.current) {
        try {
          const container = document.getElementById("frosted-yt-player");
          if (!container) return;

          ytPlayerRef.current = new win.YT.Player("frosted-yt-player", {
            height: "200",
            width: "320",
            playerVars: {
              autoplay: 1,
              controls: 0,
              disablekb: 1,
              enablejsapi: 1,
              fs: 0,
              iv_load_policy: 3,
              modestbranding: 1,
              playsinline: 1,
              rel: 0,
              origin: window.location.origin,
            },
            events: {
              onReady: (event: any) => {
                isYtReadyRef.current = true;
                try {
                  event.target.setVolume(volumeRef.current);
                  if (isMutedRef.current) event.target.mute();
                  else event.target.unMute();
                } catch (e) {}

                if (pendingTrackRef.current) {
                  const t = pendingTrackRef.current;
                  pendingTrackRef.current = null;
                  const vid = t.youtubeId || t.id;
                  if (vid) {
                    try {
                      event.target.loadVideoById(vid);
                      event.target.playVideo();
                      setIsPlaying(true);
                    } catch (e) {}
                  }
                }
              },
              onStateChange: (event: any) => {
                // 1 = PLAYING, 2 = PAUSED, 0 = ENDED, 3 = BUFFERING
                if (event.data === 1) {
                  setIsPlaying(true);
                  const dur = event.target.getDuration();
                  if (dur && dur > 0) setDuration(dur);
                } else if (event.data === 2) {
                  setIsPlaying(false);
                } else if (event.data === 0) {
                  handleTrackEnded();
                }
              },
              onError: () => {
                // Fall back to native audio element streaming
                if (currentTrackRef.current && nativeAudioRef.current) {
                  const fallbackUrl = getStreamUrl(currentTrackRef.current, "audio");
                  nativeAudioRef.current.src = fallbackUrl;
                  nativeAudioRef.current.play().catch(() => {});
                }
              },
            },
          });
        } catch (e) {
          console.warn("[YouTube API Init Error]", e);
        }
      }
    };

    if (win.YT && win.YT.Player) {
      initPlayer();
    } else {
      const prevCallback = win.onYouTubeIframeAPIReady;
      win.onYouTubeIframeAPIReady = () => {
        if (typeof prevCallback === "function") prevCallback();
        initPlayer();
      };
    }

    const checkInterval = setInterval(() => {
      if (win.YT && win.YT.Player && !ytPlayerRef.current) {
        initPlayer();
      }
    }, 1000);

    // Polling interval to sync current time & duration with YouTube Player
    const syncInterval = setInterval(() => {
      if (ytPlayerRef.current && isYtReadyRef.current) {
        try {
          const state = ytPlayerRef.current.getPlayerState?.();
          if (state === 1) {
            const curr = ytPlayerRef.current.getCurrentTime?.();
            const dur = ytPlayerRef.current.getDuration?.();
            if (typeof curr === "number" && !isNaN(curr)) {
              setCurrentTime(curr);
            }
            if (typeof dur === "number" && !isNaN(dur) && dur > 0) {
              setDuration(dur);
            }
          }
        } catch (e) {}
      }
    }, 500);

    return () => {
      clearInterval(checkInterval);
      clearInterval(syncInterval);
    };
  }, [getStreamUrl]);

  // Open / Toggle Full Player view
  const openFullPlayer = useCallback((onOpenMusicView?: () => void) => {
    setActiveTab("player");
    if (onOpenMusicView) {
      onOpenMusicView();
    }
  }, []);

  const toggleFullPlayer = useCallback((onOpenMusicView?: () => void) => {
    setActiveTab((prev) => {
      if (prev === "player") {
        return "home";
      } else {
        if (onOpenMusicView) onOpenMusicView();
        return "player";
      }
    });
  }, []);

  // Playback Navigation & Loop Handling
  const playTrack = useCallback(
    (track: Track, newQueue?: Track[]) => {
      setCurrentTrack(track);
      setIsPlaying(true);

      // Pre-populate track duration so scrubber displays full music duration immediately
      let initialDuration = track.durationSec || 0;
      if (!initialDuration && track.duration) {
        const parts = track.duration.split(":").map(Number);
        if (parts.length === 2) initialDuration = (parts[0] || 0) * 60 + (parts[1] || 0);
        if (parts.length === 3) initialDuration = (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
      }
      if (initialDuration > 0) {
        setDuration(initialDuration);
      }

      if (newQueue && newQueue.length > 0) {
        setQueue(newQueue);
      } else {
        setQueue((prev) => (prev.some((t) => t.id === track.id) ? prev : [track, ...prev]));
      }

      const videoId = track.youtubeId || track.id;

      // 1. YouTube Client Player
      if (ytPlayerRef.current && isYtReadyRef.current && videoId) {
        try {
          ytPlayerRef.current.loadVideoById(videoId);
          ytPlayerRef.current.playVideo();
          ytPlayerRef.current.setVolume(volume);
          if (isMuted) {
            ytPlayerRef.current.mute();
          } else {
            ytPlayerRef.current.unMute();
          }
          setIsPlaying(true);
        } catch (e) {
          console.warn("[YouTube playback error]", e);
        }
      } else {
        pendingTrackRef.current = track;
      }

      // 2. Fallback native audio if direct stream
      if (track.source === "direct" || track.permalinkUrl?.endsWith(".mp3")) {
        const streamUrl = track.permalinkUrl || getStreamUrl(track, "audio");
        if (nativeAudioRef.current) {
          nativeAudioRef.current.src = streamUrl;
          nativeAudioRef.current
            .play()
            .then(() => setIsPlaying(true))
            .catch(() => {});
        }
      }
    },
    [getStreamUrl, volume, isMuted]
  );

  const handleTrackEnded = useCallback(() => {
    const currentRepeat = repeatModeRef.current;

    if (currentRepeat === "one") {
      if (ytPlayerRef.current && isYtReadyRef.current) {
        try {
          ytPlayerRef.current.seekTo(0, true);
          ytPlayerRef.current.playVideo();
          setIsPlaying(true);
          return;
        } catch (e) {}
      }
      if (nativeAudioRef.current) {
        nativeAudioRef.current.currentTime = 0;
        nativeAudioRef.current
          .play()
          .then(() => setIsPlaying(true))
          .catch(() => {});
      }
      return;
    }

    const currentQueue = queueRef.current;
    const activeTrack = currentTrackRef.current;
    const shuffleOn = isShuffleRef.current;

    if (currentQueue.length === 0) {
      setIsPlaying(false);
      return;
    }

    if (shuffleOn) {
      const randomIndex = Math.floor(Math.random() * currentQueue.length);
      playTrack(currentQueue[randomIndex]);
      return;
    }

    const currentIndex = currentQueue.findIndex((t) => t.id === activeTrack?.id);

    if (currentIndex !== -1 && currentIndex < currentQueue.length - 1) {
      playTrack(currentQueue[currentIndex + 1]);
    } else if (currentRepeat === "all") {
      playTrack(currentQueue[0]);
    } else {
      setIsPlaying(false);
    }
  }, [playTrack]);

  // Initialize Native Audio Element
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    nativeAudioRef.current = audio;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => {
      if (audio.currentTime > 0) {
        setCurrentTime(audio.currentTime);
      }
    };
    const onDurationChange = () => {
      if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };
    const onEnded = () => {
      handleTrackEnded();
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("ended", onEnded);
      audio.pause();
      audio.src = "";
    };
  }, [handleTrackEnded]);

  // Sync volume
  useEffect(() => {
    const targetVol = isMuted ? 0 : volume / 100;
    if (nativeAudioRef.current) {
      nativeAudioRef.current.volume = targetVol;
    }
    if (ytPlayerRef.current && isYtReadyRef.current) {
      try {
        ytPlayerRef.current.setVolume(volume);
        if (isMuted) ytPlayerRef.current.mute();
        else ytPlayerRef.current.unMute();
      } catch (e) {}
    }
  }, [volume, isMuted]);

  // Save favorites & media mode
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_FAVORITES_KEY, JSON.stringify(favorites));
    } catch (e) {}
  }, [favorites]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_MEDIA_MODE_KEY, mediaMode);
    } catch (e) {}
  }, [mediaMode]);

  const setMediaMode = useCallback((newMode: MediaMode) => {
    setMediaModeState(newMode);
  }, []);

  const toggleMediaMode = useCallback(() => {
    setMediaMode(mediaMode === "audio" ? "video" : "audio");
  }, [mediaMode, setMediaMode]);

  // Play / Pause
  const togglePlay = useCallback(() => {
    if (!currentTrack) {
      if (queue.length > 0) {
        playTrack(queue[0]);
      }
      return;
    }

    if (isPlaying) {
      if (ytPlayerRef.current && isYtReadyRef.current) {
        try {
          ytPlayerRef.current.pauseVideo();
        } catch (e) {}
      }
      if (nativeAudioRef.current) {
        nativeAudioRef.current.pause();
      }
      setIsPlaying(false);
    } else {
      if (ytPlayerRef.current && isYtReadyRef.current) {
        try {
          ytPlayerRef.current.playVideo();
          setIsPlaying(true);
        } catch (e) {}
      } else if (nativeAudioRef.current && nativeAudioRef.current.src) {
        nativeAudioRef.current
          .play()
          .then(() => setIsPlaying(true))
          .catch(() => {});
      } else {
        playTrack(currentTrack);
      }
    }
  }, [currentTrack, isPlaying, playTrack, queue]);

  // Seek
  const seek = useCallback((seconds: number) => {
    setCurrentTime(seconds);
    if (ytPlayerRef.current && isYtReadyRef.current) {
      try {
        ytPlayerRef.current.seekTo(seconds, true);
      } catch (e) {}
    }
    if (nativeAudioRef.current && nativeAudioRef.current.duration) {
      nativeAudioRef.current.currentTime = seconds;
    }
  }, []);

  const setVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(100, vol));
    setVolumeState(clamped);
    if (clamped > 0 && isMuted) {
      setIsMuted(false);
    }
  }, [isMuted]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const toggleShuffle = useCallback(() => {
    setIsShuffle((prev) => !prev);
  }, []);

  const toggleRepeat = useCallback(() => {
    setRepeatMode((prev) => (prev === "off" ? "all" : prev === "all" ? "one" : "off"));
  }, []);

  const nextTrack = useCallback(() => {
    if (queue.length === 0) return;
    if (isShuffle) {
      const randomIndex = Math.floor(Math.random() * queue.length);
      playTrack(queue[randomIndex]);
      return;
    }

    const currentIndex = queue.findIndex((t) => t.id === currentTrack?.id);
    if (currentIndex !== -1 && currentIndex < queue.length - 1) {
      playTrack(queue[currentIndex + 1]);
    } else {
      playTrack(queue[0]);
    }
  }, [queue, isShuffle, currentTrack, playTrack]);

  const prevTrack = useCallback(() => {
    if (queue.length === 0) return;
    if (currentTime > 4) {
      seek(0);
      return;
    }

    const currentIndex = queue.findIndex((t) => t.id === currentTrack?.id);
    if (currentIndex > 0) {
      playTrack(queue[currentIndex - 1]);
    } else {
      playTrack(queue[queue.length - 1]);
    }
  }, [queue, currentTrack, currentTime, seek, playTrack]);

  const addToQueue = useCallback((track: Track) => {
    setQueue((prev) => [...prev, track]);
  }, []);

  const removeFromQueue = useCallback((index: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const toggleFavorite = useCallback((track: Track) => {
    setFavorites((prev) => {
      const exists = prev.some((t) => t.id === track.id);
      if (exists) {
        return prev.filter((t) => t.id !== track.id);
      } else {
        return [track, ...prev];
      }
    });
  }, []);

  const isFavorite = useCallback(
    (id: string) => {
      return favorites.some((t) => t.id === id);
    },
    [favorites]
  );

  return (
    <MusicContext.Provider
      value={{
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        volume,
        isMuted,
        queue,
        isShuffle,
        repeatMode,
        mediaMode,
        setMediaMode,
        toggleMediaMode,
        activeTab,
        setActiveTab,
        openFullPlayer,
        toggleFullPlayer,
        playTrack,
        togglePlay,
        seek,
        setVolume,
        toggleMute,
        toggleShuffle,
        toggleRepeat,
        nextTrack,
        prevTrack,
        addToQueue,
        removeFromQueue,
        favorites,
        toggleFavorite,
        isFavorite,
        getStreamUrl,
      }}
    >
      {children}

      {/* YouTube Player Engine (mounted with real dimensions offscreen so browser allows autoplay & events) */}
      <div
        id="frosted-hidden-yt-player-container"
        style={{
          position: "fixed",
          width: "320px",
          height: "200px",
          right: "0px",
          bottom: "0px",
          opacity: 0.001,
          pointerEvents: "none",
          zIndex: -9999,
          overflow: "hidden",
        }}
        aria-hidden="true"
      >
        <div id="frosted-yt-player" />
      </div>
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
