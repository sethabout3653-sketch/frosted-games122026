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

  // Dedicated Native Audio element
  const nativeAudioRef = useRef<HTMLAudioElement | null>(null);

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

  // Stream URL generator
  const getStreamUrl = useCallback((track: Track, mode: MediaMode) => {
    const target = track.youtubeId || track.id;
    return `/api/music/stream?id=${encodeURIComponent(target)}&mode=${mode}&title=${encodeURIComponent(
      track.title || ""
    )}&artist=${encodeURIComponent(track.artist || "")}&url=${encodeURIComponent(
      track.permalinkUrl || ""
    )}`;
  }, []);

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
        return "home"; // Back to discover or search!
      } else {
        if (onOpenMusicView) onOpenMusicView();
        return "player"; // Open full screen player!
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

      const streamUrl = getStreamUrl(track, "audio");

      if (nativeAudioRef.current) {
        nativeAudioRef.current.src = streamUrl;
        nativeAudioRef.current
          .play()
          .then(() => setIsPlaying(true))
          .catch(() => {
            setIsPlaying(true);
          });
      }
    },
    [getStreamUrl]
  );

  const handleTrackEnded = useCallback(() => {
    const currentRepeat = repeatModeRef.current;

    if (currentRepeat === "one") {
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
      setCurrentTime(audio.currentTime);
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

  // Switch between Audio and Video
  const setMediaMode = useCallback(
    (newMode: MediaMode) => {
      setMediaModeState(newMode);
    },
    []
  );

  const toggleMediaMode = useCallback(() => {
    setMediaMode(mediaMode === "audio" ? "video" : "audio");
  }, [mediaMode, setMediaMode]);

  // Play / Pause
  const togglePlay = useCallback(() => {
    if (!currentTrack) return;

    if (nativeAudioRef.current && nativeAudioRef.current.src) {
      if (isPlaying) {
        nativeAudioRef.current.pause();
        setIsPlaying(false);
      } else {
        nativeAudioRef.current
          .play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(true));
      }
    } else {
      setIsPlaying((prev) => !prev);
    }
  }, [currentTrack, isPlaying]);

  // Seek
  const seek = useCallback((seconds: number) => {
    if (nativeAudioRef.current && nativeAudioRef.current.src) {
      nativeAudioRef.current.currentTime = seconds;
      setCurrentTime(seconds);
    }
  }, []);

  // Volume & Mute
  const setVolume = useCallback((vol: number) => {
    const clamped = Math.min(100, Math.max(0, vol));
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
    const currentQueue = queueRef.current;
    if (currentQueue.length === 0) return;

    if (isShuffleRef.current) {
      const randomIndex = Math.floor(Math.random() * currentQueue.length);
      playTrack(currentQueue[randomIndex]);
      return;
    }

    const currentIndex = currentQueue.findIndex((t) => t.id === currentTrackRef.current?.id);
    if (currentIndex !== -1 && currentIndex < currentQueue.length - 1) {
      playTrack(currentQueue[currentIndex + 1]);
    } else if (repeatModeRef.current === "all") {
      playTrack(currentQueue[0]);
    } else {
      setIsPlaying(false);
    }
  }, [playTrack]);

  const prevTrack = useCallback(() => {
    const currentQueue = queueRef.current;
    if (currentQueue.length === 0) return;

    if (nativeAudioRef.current && nativeAudioRef.current.currentTime > 3) {
      nativeAudioRef.current.currentTime = 0;
      setCurrentTime(0);
      return;
    }

    const currentIndex = currentQueue.findIndex((t) => t.id === currentTrackRef.current?.id);
    if (currentIndex > 0) {
      playTrack(currentQueue[currentIndex - 1]);
    } else {
      playTrack(currentQueue[currentQueue.length - 1]);
    }
  }, [playTrack]);

  const addToQueue = useCallback((track: Track) => {
    setQueue((prev) => [...prev, track]);
  }, []);

  const removeFromQueue = useCallback((index: number) => {
    setQueue((prev) => prev.filter((_, idx) => idx !== index));
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
