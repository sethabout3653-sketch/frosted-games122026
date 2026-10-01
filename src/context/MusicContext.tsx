import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from "react";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

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
}

export type PlaybackEngine = "yt-dlp" | "client";

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
  playbackEngine: PlaybackEngine;
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
}

const MusicContext = createContext<MusicContextType | null>(null);

const STORAGE_FAVORITES_KEY = "frosted_music_favorites_yt_v3";

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
  const [playbackEngine, setPlaybackEngine] = useState<PlaybackEngine>("yt-dlp");
  const [favorites, setFavorites] = useState<Track[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_FAVORITES_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Native HTML5 Audio for direct yt-dlp streaming
  const nativeAudioRef = useRef<HTMLAudioElement | null>(null);

  // Client Bridge Player for YouTube bot detection fallback
  const clientPlayerRef = useRef<any>(null);
  const isClientPlayerReadyRef = useRef(false);
  const activeEngineRef = useRef<PlaybackEngine>("yt-dlp");
  const intervalRef = useRef<any>(null);

  // Initialize Native Audio Element (yt-dlp stream)
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    nativeAudioRef.current = audio;

    const onPlay = () => {
      if (activeEngineRef.current === "yt-dlp") {
        setIsPlaying(true);
      }
    };
    const onPause = () => {
      if (activeEngineRef.current === "yt-dlp") {
        setIsPlaying(false);
      }
    };
    const onTimeUpdate = () => {
      if (activeEngineRef.current === "yt-dlp") {
        setCurrentTime(audio.currentTime);
      }
    };
    const onDurationChange = () => {
      if (activeEngineRef.current === "yt-dlp" && audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const onEnded = () => {
      if (activeEngineRef.current === "yt-dlp") {
        if (repeatMode === "one") {
          audio.currentTime = 0;
          audio.play().catch(() => {});
        } else {
          handleNext();
        }
      }
    };
    const onError = () => {
      // If yt-dlp backend stream is blocked by YouTube's datacenter IP bot detector, fallback to client player
      if (activeEngineRef.current === "yt-dlp" && currentTrack) {
        switchToClientPlayer(currentTrack);
      }
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.pause();
      audio.src = "";
    };
  }, [repeatMode, currentTrack]);

  // Initialize Client Bridge Player (fallback for YouTube IP blocks)
  useEffect(() => {
    let container = document.getElementById("yt-audio-player-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "yt-audio-player-container";
      container.style.position = "absolute";
      container.style.top = "-9999px";
      container.style.left = "-9999px";
      container.style.width = "1px";
      container.style.height = "1px";
      container.style.overflow = "hidden";
      container.style.pointerEvents = "none";
      document.body.appendChild(container);

      const playerDiv = document.createElement("div");
      playerDiv.id = "yt-hidden-audio-frame";
      container.appendChild(playerDiv);
    }

    function createClientPlayer() {
      if (clientPlayerRef.current) return;
      try {
        clientPlayerRef.current = new window.YT.Player("yt-hidden-audio-frame", {
          height: "1",
          width: "1",
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: (event: any) => {
              isClientPlayerReadyRef.current = true;
              event.target.setVolume(isMuted ? 0 : volume);
            },
            onStateChange: (event: any) => {
              if (activeEngineRef.current !== "client") return;
              if (event.data === 1) {
                setIsPlaying(true);
                const dur = clientPlayerRef.current?.getDuration?.() || 0;
                if (dur > 0) setDuration(dur);
              } else if (event.data === 2) {
                setIsPlaying(false);
              } else if (event.data === 0) {
                if (repeatMode === "one") {
                  clientPlayerRef.current?.seekTo(0, true);
                  clientPlayerRef.current?.playVideo();
                } else {
                  handleNext();
                }
              }
            },
          },
        });
      } catch (err) {}
    }

    if (window.YT && window.YT.Player) {
      createClientPlayer();
    } else {
      const existingScript = document.getElementById("yt-iframe-api-script");
      if (!existingScript) {
        const tag = document.createElement("script");
        tag.id = "yt-iframe-api-script";
        tag.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(tag);
      }
      window.onYouTubeIframeAPIReady = () => {
        createClientPlayer();
      };
    }

    // High frequency time updater for client engine
    intervalRef.current = setInterval(() => {
      if (activeEngineRef.current === "client" && clientPlayerRef.current && isClientPlayerReadyRef.current) {
        try {
          const state = clientPlayerRef.current.getPlayerState?.();
          if (state === 1) {
            const curr = clientPlayerRef.current.getCurrentTime?.() || 0;
            const dur = clientPlayerRef.current.getDuration?.() || 0;
            setCurrentTime(curr);
            if (dur > 0 && dur !== duration) setDuration(dur);
          }
        } catch (e) {}
      }
    }, 400);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [repeatMode]);

  // Sync volume
  useEffect(() => {
    if (nativeAudioRef.current) {
      nativeAudioRef.current.volume = isMuted ? 0 : volume / 100;
    }
    if (clientPlayerRef.current && isClientPlayerReadyRef.current) {
      try {
        if (isMuted) {
          clientPlayerRef.current.mute();
        } else {
          clientPlayerRef.current.unMute();
          clientPlayerRef.current.setVolume(volume);
        }
      } catch (e) {}
    }
  }, [volume, isMuted]);

  // Save favorites
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_FAVORITES_KEY, JSON.stringify(favorites));
    } catch (e) {}
  }, [favorites]);

  const switchToClientPlayer = useCallback((track: Track) => {
    activeEngineRef.current = "client";
    setPlaybackEngine("client");

    if (nativeAudioRef.current) {
      nativeAudioRef.current.pause();
      nativeAudioRef.current.src = "";
    }

    const ytId = track.youtubeId || track.id;
    if (clientPlayerRef.current && isClientPlayerReadyRef.current) {
      try {
        clientPlayerRef.current.loadVideoById({ videoId: ytId, startSeconds: 0 });
        clientPlayerRef.current.playVideo();
        setIsPlaying(true);
      } catch (e) {}
    }
  }, []);

  const playTrack = useCallback((track: Track, newQueue?: Track[]) => {
    setCurrentTrack(track);
    if (newQueue && newQueue.length > 0) {
      setQueue(newQueue);
    } else {
      setQueue((prev) => (prev.some((t) => t.id === track.id) ? prev : [track, ...prev]));
    }

    // Default to yt-dlp native audio streaming
    activeEngineRef.current = "yt-dlp";
    setPlaybackEngine("yt-dlp");

    if (clientPlayerRef.current && isClientPlayerReadyRef.current) {
      try {
        clientPlayerRef.current.stopVideo();
      } catch (e) {}
    }

    if (nativeAudioRef.current) {
      const streamUrl = `/api/music/stream?id=${encodeURIComponent(track.youtubeId || track.id)}&url=${encodeURIComponent(track.permalinkUrl || "")}`;
      nativeAudioRef.current.src = streamUrl;
      nativeAudioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch(() => {
          // If browser or datacenter IP rejects raw stream, use client player bridge
          switchToClientPlayer(track);
        });
    }
  }, [switchToClientPlayer]);

  const togglePlay = useCallback(() => {
    if (!currentTrack) return;

    if (activeEngineRef.current === "yt-dlp" && nativeAudioRef.current) {
      if (isPlaying) {
        nativeAudioRef.current.pause();
        setIsPlaying(false);
      } else {
        nativeAudioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    } else if (activeEngineRef.current === "client" && clientPlayerRef.current) {
      try {
        if (isPlaying) {
          clientPlayerRef.current.pauseVideo();
          setIsPlaying(false);
        } else {
          clientPlayerRef.current.playVideo();
          setIsPlaying(true);
        }
      } catch (e) {}
    }
  }, [isPlaying, currentTrack]);

  const seek = useCallback((seconds: number) => {
    if (activeEngineRef.current === "yt-dlp" && nativeAudioRef.current) {
      nativeAudioRef.current.currentTime = seconds;
      setCurrentTime(seconds);
    } else if (activeEngineRef.current === "client" && clientPlayerRef.current) {
      try {
        clientPlayerRef.current.seekTo(seconds, true);
        setCurrentTime(seconds);
      } catch (e) {}
    }
  }, []);

  const setVolume = useCallback((vol: number) => {
    setVolumeState(vol);
    if (isMuted && vol > 0) setIsMuted(false);
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

  const handleNext = useCallback(() => {
    if (queue.length === 0 || !currentTrack) return;
    const currentIndex = queue.findIndex((t) => t.id === currentTrack.id);
    if (currentIndex === -1) {
      if (queue.length > 0) playTrack(queue[0]);
      return;
    }
    if (isShuffle) {
      const nextIdx = Math.floor(Math.random() * queue.length);
      playTrack(queue[nextIdx]);
    } else if (currentIndex < queue.length - 1) {
      playTrack(queue[currentIndex + 1]);
    } else if (repeatMode === "all") {
      playTrack(queue[0]);
    } else {
      setIsPlaying(false);
    }
  }, [queue, currentTrack, isShuffle, repeatMode, playTrack]);

  const handlePrev = useCallback(() => {
    if (queue.length === 0 || !currentTrack) return;
    if (currentTime > 3) {
      seek(0);
      return;
    }
    const currentIndex = queue.findIndex((t) => t.id === currentTrack.id);
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
    (id: string) => favorites.some((t) => t.id === id),
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
        playbackEngine,
        playTrack,
        togglePlay,
        seek,
        setVolume,
        toggleMute,
        toggleShuffle,
        toggleRepeat,
        nextTrack: handleNext,
        prevTrack: handlePrev,
        addToQueue,
        removeFromQueue,
        favorites,
        toggleFavorite,
        isFavorite,
      }}
    >
      {children}
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
