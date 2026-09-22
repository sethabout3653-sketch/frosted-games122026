import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Heart,
  ArrowLeft,
  Music,
  Video as VideoIcon,
  Volume2,
  VolumeX,
  Volume1,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  ListMusic,
  FileText,
  Info,
  Share2,
  Check,
  Radio,
  Sliders,
  ExternalLink,
  Sparkles,
  Maximize2,
} from "lucide-react";
import { YouTubeVideo } from "../types";
import { isVideoSaved, toggleSaveVideo, addToWatchHistory } from "../lib/youtubeStorage";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export function extractYouTubeId(urlOrId: string): string {
  const trimmed = (urlOrId || "").trim();
  if (!trimmed) return "";

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const embedRegex = /\/(embed|v)\/([a-zA-Z0-9_-]{11})/;
    const embedMatch = trimmed.match(embedRegex);
    if (embedMatch && embedMatch[2]) {
      return embedMatch[2];
    }

    const watchRegex = /(v=|vi=|\/v\/|\/vi\/|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/;
    const watchMatch = trimmed.match(watchRegex);
    if (watchMatch && watchMatch[2]) {
      return watchMatch[2];
    }

    if (trimmed.includes("?")) {
      const urlObj = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
      const v = urlObj.searchParams.get("v") || urlObj.searchParams.get("vi");
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) {
        return v;
      }
    }
  } catch (e) {
    console.warn("Failed to parse YouTube URL:", e);
  }

  return trimmed;
}

function parseDurationToSeconds(durationStr?: string): number {
  if (!durationStr) return 0;
  const parts = durationStr.split(":").map(Number);
  if (parts.some(isNaN)) return 0;
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return parts[0] || 0;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const sFormatted = s < 10 ? `0${s}` : `${s}`;
  if (h > 0) {
    const mFormatted = m < 10 ? `0${m}` : `${m}`;
    return `${h}:${mFormatted}:${sFormatted}`;
  }
  return `${m}:${sFormatted}`;
}

interface YouTubePlayerProps {
  video: YouTubeVideo;
  playlist?: YouTubeVideo[];
  onBack?: () => void;
  onSelectVideo?: (video: YouTubeVideo) => void;
}

export default function YouTubePlayer({
  video,
  playlist = [],
  onBack,
  onSelectVideo,
}: YouTubePlayerProps) {
  const cleanVideoId = extractYouTubeId(video.id);

  // Media Mode: "audio" (album art & pure audio) vs "video" (embedded video stream with our custom UI)
  const [mediaMode, setMediaMode] = useState<"audio" | "video">(
    video.mediaType === "video" ? "video" : "audio"
  );

  // Playback state
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(parseDurationToSeconds(video.duration) || 210);
  const [bufferedFraction, setBufferedFraction] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<"off" | "all" | "one">("off");

  // Scrubbing & Scroll feedback state
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(0);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState(0);
  const [scrollNotice, setScrollNotice] = useState<string | null>(null);
  const [centerAction, setCenterAction] = useState<{ type: "play" | "pause"; id: number } | null>(null);
  const centerActionTimeoutRef = useRef<any>(null);

  // UI state
  const [activeTab, setActiveTab] = useState<"queue" | "lyrics" | "details">("queue");
  const [isSaved, setIsSaved] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  // Player & Engine Refs
  const ytPlayerRef = useRef<any>(null);
  const isPlayerReadyRef = useRef<boolean>(false);
  const loadedVideoIdRef = useRef<string>("");
  const scrubBarRef = useRef<HTMLDivElement | null>(null);
  const scrollNoticeTimeoutRef = useRef<any>(null);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const bufferingTimeoutRef = useRef<any>(null);

  const volumeRef = useRef<number>(100);
  const isMutedRef = useRef<boolean>(false);
  const repeatModeRef = useRef<"off" | "all" | "one">("off");
  const isShuffleRef = useRef<boolean>(false);
  const playlistRef = useRef<YouTubeVideo[]>(playlist);
  const onSelectVideoRef = useRef<typeof onSelectVideo>(onSelectVideo);
  const videoIdRef = useRef<string>(video.id);

  useEffect(() => {
    volumeRef.current = volume;
    isMutedRef.current = isMuted;
    repeatModeRef.current = repeatMode;
    isShuffleRef.current = isShuffle;
    playlistRef.current = playlist;
    onSelectVideoRef.current = onSelectVideo;
    videoIdRef.current = video.id;
  });

  // Sync saved status and history
  useEffect(() => {
    setIsSaved(isVideoSaved(video.id));
    addToWatchHistory(video, 0, 0);
  }, [video.id]);

  // Load YouTube Iframe API if not loaded
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const first = document.getElementsByTagName("script")[0];
      if (first && first.parentNode) {
        first.parentNode.insertBefore(tag, first);
      } else {
        document.head.appendChild(tag);
      }
    }
  }, []);

  // Handle Track Completion
  const handleTrackEnd = useCallback(() => {
    if (repeatModeRef.current === "one") {
      if (isPlayerReadyRef.current && ytPlayerRef.current?.seekTo) {
        ytPlayerRef.current.seekTo(0, true);
        ytPlayerRef.current.playVideo?.();
        setIsPlaying(true);
      }
      return;
    }
    const currentList = playlistRef.current;
    const selectFn = onSelectVideoRef.current;
    if (currentList.length > 0 && selectFn) {
      const idx = currentList.findIndex((v) => v.id === videoIdRef.current);
      if (isShuffleRef.current) {
        const rand = Math.floor(Math.random() * currentList.length);
        selectFn(currentList[rand]);
      } else if (idx !== -1 && idx < currentList.length - 1) {
        selectFn(currentList[idx + 1]);
      } else if (repeatModeRef.current === "all" && currentList.length > 0) {
        selectFn(currentList[0]);
      }
    }
  }, []);

  // Main Audio & Video Playback Engine with controls=0 (Stripping YouTube Default UI)
  useEffect(() => {
    if (!cleanVideoId) return;

    if (loadedVideoIdRef.current === cleanVideoId && isPlayerReadyRef.current) {
      return;
    }

    if (ytPlayerRef.current && isPlayerReadyRef.current && typeof ytPlayerRef.current.loadVideoById === "function") {
      try {
        loadedVideoIdRef.current = cleanVideoId;
        ytPlayerRef.current.loadVideoById(cleanVideoId);
        ytPlayerRef.current.setVolume?.(volumeRef.current);
        if (isMutedRef.current) ytPlayerRef.current.mute?.();
        else ytPlayerRef.current.unMute?.();
        setIsPlaying(true);
        return;
      } catch (e) {
        console.warn("loadVideoById error:", e);
      }
    }

    isPlayerReadyRef.current = false;
    loadedVideoIdRef.current = cleanVideoId;

    let pollTimer: any;
    let attempts = 0;

    const setupPlayer = () => {
      attempts++;
      const hostEl = document.getElementById("yt-unified-iframe-inner");
      if (!hostEl || !window.YT || !window.YT.Player) {
        if (attempts < 40) {
          pollTimer = setTimeout(setupPlayer, 120);
        }
        return;
      }

      try {
        ytPlayerRef.current = new window.YT.Player("yt-unified-iframe-inner", {
          videoId: cleanVideoId,
          playerVars: {
            autoplay: 1,
            controls: 0, // NO default YouTube controls UI - replaced with our custom UI!
            disablekb: 1, // Disable default keyboard shortcuts to use our custom key bindings
            fs: 0,
            modestbranding: 1,
            rel: 0,
            iv_load_policy: 3,
            enablejsapi: 1,
            origin: window.location.origin,
            playsinline: 1,
          },
          events: {
            onReady: (e: any) => {
              isPlayerReadyRef.current = true;
              try {
                e.target.setVolume?.(volumeRef.current);
                if (isMutedRef.current) e.target.mute?.();
                e.target.playVideo?.();
                const dur = e.target.getDuration?.();
                if (dur && dur > 0) setDuration(dur);
                setIsPlaying(true);
              } catch {}
            },
            onError: (err: any) => {
              console.warn("Player Error:", err);
            },
            onStateChange: (e: any) => {
              try {
                if (!window.YT) return;
                if (e.data === window.YT.PlayerState.PLAYING) {
                  if (bufferingTimeoutRef.current) {
                    clearTimeout(bufferingTimeoutRef.current);
                    bufferingTimeoutRef.current = null;
                  }
                  setIsPlaying(true);
                  setIsBuffering(false);
                  const dur = e.target.getDuration?.();
                  if (dur && dur > 0) setDuration(dur);
                } else if (e.data === window.YT.PlayerState.PAUSED) {
                  if (bufferingTimeoutRef.current) {
                    clearTimeout(bufferingTimeoutRef.current);
                    bufferingTimeoutRef.current = null;
                  }
                  setIsPlaying(false);
                  setIsBuffering(false);
                } else if (e.data === window.YT.PlayerState.BUFFERING) {
                  // Only show buffering indicator if it lasts longer than 750ms (prevents split-second flicker)
                  if (!bufferingTimeoutRef.current) {
                    bufferingTimeoutRef.current = setTimeout(() => {
                      setIsBuffering(true);
                    }, 750);
                  }
                } else if (e.data === window.YT.PlayerState.ENDED) {
                  if (bufferingTimeoutRef.current) {
                    clearTimeout(bufferingTimeoutRef.current);
                    bufferingTimeoutRef.current = null;
                  }
                  setIsPlaying(false);
                  setIsBuffering(false);
                  handleTrackEnd();
                }
              } catch {}
            },
          },
        });
      } catch (err) {
        console.error("Error creating player engine:", err);
      }
    };

    setupPlayer();

    return () => {
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [cleanVideoId, handleTrackEnd]);

  // Periodic time update
  useEffect(() => {
    const interval = setInterval(() => {
      if (isScrubbing) return;
      if (isPlayerReadyRef.current && ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === "function") {
        try {
          const cur = ytPlayerRef.current.getCurrentTime();
          const dur = ytPlayerRef.current.getDuration?.();
          const frac = ytPlayerRef.current.getVideoLoadedFraction?.() || 0;
          if (typeof cur === "number" && !isNaN(cur)) setCurrentTime(cur);
          if (dur && dur > 0 && !isNaN(dur)) setDuration(dur);
          setBufferedFraction(frac);
        } catch {}
      }
    }, 250);

    return () => clearInterval(interval);
  }, [isScrubbing]);

  // Direct Seek
  const handleSeek = (targetSec: number) => {
    const clamped = Math.max(0, Math.min(duration, targetSec));
    setCurrentTime(clamped);
    if (isPlayerReadyRef.current && ytPlayerRef.current?.seekTo) {
      try {
        ytPlayerRef.current.seekTo(clamped, true);
      } catch {}
    }
  };

  // Play / Pause Handlers
  const handlePlay = () => {
    setIsPlaying(true);
    if (bufferingTimeoutRef.current) {
      clearTimeout(bufferingTimeoutRef.current);
      bufferingTimeoutRef.current = null;
    }
    setIsBuffering(false);
    triggerCenterAnimation("play");
    if (isPlayerReadyRef.current && ytPlayerRef.current?.playVideo) {
      try {
        ytPlayerRef.current.playVideo();
      } catch {}
    }
  };

  const handlePause = () => {
    setIsPlaying(false);
    if (bufferingTimeoutRef.current) {
      clearTimeout(bufferingTimeoutRef.current);
      bufferingTimeoutRef.current = null;
    }
    setIsBuffering(false);
    if (centerActionTimeoutRef.current) {
      clearTimeout(centerActionTimeoutRef.current);
    }
    setCenterAction(null);
    if (isPlayerReadyRef.current && ytPlayerRef.current?.pauseVideo) {
      try {
        ytPlayerRef.current.pauseVideo();
      } catch {}
    }
  };

  const handleTogglePlay = () => {
    if (isPlaying) handlePause();
    else handlePlay();
  };

  const triggerCenterAnimation = (action: "play") => {
    if (centerActionTimeoutRef.current) {
      clearTimeout(centerActionTimeoutRef.current);
    }
    setCenterAction({ type: action, id: Date.now() });
    centerActionTimeoutRef.current = setTimeout(() => {
      setCenterAction(null);
    }, 450);
  };

  const handleSkip10 = (delta: number) => {
    handleSeek(currentTime + delta);
    showNotification(delta > 0 ? `+${delta}s` : `${delta}s`);
  };

  const showNotification = (msg: string) => {
    setScrollNotice(msg);
    if (scrollNoticeTimeoutRef.current) clearTimeout(scrollNoticeTimeoutRef.current);
    scrollNoticeTimeoutRef.current = setTimeout(() => setScrollNotice(null), 1200);
  };

  const handlePreviousTrack = () => {
    if (currentTime > 3) {
      handleSeek(0);
      return;
    }
    if (playlist.length > 0 && onSelectVideo) {
      const idx = playlist.findIndex((v) => v.id === video.id);
      if (idx > 0) {
        onSelectVideo(playlist[idx - 1]);
      } else {
        handleSeek(0);
      }
    } else {
      handleSeek(0);
    }
  };

  const handleNextTrack = () => {
    if (playlist.length > 0 && onSelectVideo) {
      const idx = playlist.findIndex((v) => v.id === video.id);
      if (isShuffle) {
        const rand = Math.floor(Math.random() * playlist.length);
        onSelectVideo(playlist[rand]);
      } else if (idx !== -1 && idx < playlist.length - 1) {
        onSelectVideo(playlist[idx + 1]);
      } else {
        onSelectVideo(playlist[0]);
      }
    }
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    const muted = newVol === 0;
    setIsMuted(muted);
    if (isPlayerReadyRef.current && ytPlayerRef.current) {
      try {
        if (muted) ytPlayerRef.current.mute?.();
        else {
          ytPlayerRef.current.unMute?.();
          ytPlayerRef.current.setVolume?.(newVol);
        }
      } catch {}
    }
  };

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    if (isPlayerReadyRef.current && ytPlayerRef.current) {
      try {
        if (next) ytPlayerRef.current.mute?.();
        else {
          ytPlayerRef.current.unMute?.();
          ytPlayerRef.current.setVolume?.(volume || 80);
        }
      } catch {}
    }
  };

  const handleRateChange = (rate: number) => {
    setPlaybackRate(rate);
    setShowSpeedMenu(false);
    if (isPlayerReadyRef.current && ytPlayerRef.current?.setPlaybackRate) {
      try {
        ytPlayerRef.current.setPlaybackRate(rate);
      } catch {}
    }
  };

  const handleToggleRepeat = () => {
    if (repeatMode === "off") setRepeatMode("all");
    else if (repeatMode === "all") setRepeatMode("one");
    else setRepeatMode("off");
  };

  // Duration Wheel Scrolling
  useEffect(() => {
    const scrubEl = scrubBarRef.current;
    if (!scrubEl) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!duration || duration <= 0) return;

      const delta = e.deltaY !== 0 ? -e.deltaY : e.deltaX;
      if (Math.abs(delta) < 2) return;

      const step = 4;
      const direction = delta > 0 ? 1 : -1;
      const nextTime = Math.max(0, Math.min(duration, currentTime + direction * step));

      handleSeek(nextTime);
      showNotification(`${direction > 0 ? "+" : ""}${direction * step}s (${formatTime(nextTime)})`);
    };

    scrubEl.addEventListener("wheel", handleWheel, { passive: false });
    return () => scrubEl.removeEventListener("wheel", handleWheel);
  }, [duration, currentTime]);

  // Click & Drag Scrubbing
  const calculateScrubTimeFromEvent = (e: MouseEvent | React.MouseEvent | TouchEvent | React.TouchEvent) => {
    if (!scrubBarRef.current || !duration) return 0;
    const rect = scrubBarRef.current.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * duration;
  };

  const handleScrubStart = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const target = calculateScrubTimeFromEvent(e);
    setIsScrubbing(true);
    setScrubTime(target);
    setCurrentTime(target);
  };

  useEffect(() => {
    if (!isScrubbing) return;

    const onMouseMove = (e: MouseEvent) => {
      const target = calculateScrubTimeFromEvent(e);
      setScrubTime(target);
      setCurrentTime(target);
    };

    const onTouchMove = (e: TouchEvent) => {
      const target = calculateScrubTimeFromEvent(e);
      setScrubTime(target);
      setCurrentTime(target);
    };

    const onEnd = (e: MouseEvent | TouchEvent) => {
      const target = calculateScrubTimeFromEvent(e);
      setIsScrubbing(false);
      handleSeek(target);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("touchmove", onTouchMove);
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchend", onEnd);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchend", onEnd);
    };
  }, [isScrubbing, duration]);

  const handleScrubMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrubBarRef.current || !duration) return;
    const rect = scrubBarRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPosition(ratio * 100);
    setHoverTime(ratio * duration);
  };

  const handleScrubMouseLeave = () => setHoverTime(null);

  // Fullscreen video request
  const handleToggleFullscreen = () => {
    if (videoContainerRef.current) {
      if (!document.fullscreenElement) {
        videoContainerRef.current.requestFullscreen?.().catch(() => {});
      } else {
        document.exitFullscreen?.().catch(() => {});
      }
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      if (e.code === "Space" || e.code === "KeyK") {
        e.preventDefault();
        handleTogglePlay();
      } else if (
        (e.code.startsWith("Digit") || e.code.startsWith("Numpad")) &&
        e.key >= "0" &&
        e.key <= "9"
      ) {
        e.preventDefault();
        const digit = parseInt(e.key, 10);
        if (!isNaN(digit) && digit >= 0 && digit <= 9 && duration > 0) {
          const targetTime = (digit / 10) * duration;
          handleSeek(targetTime);
          showNotification(`${digit * 10}% (${formatTime(targetTime)})`);
        }
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        handleSkip10(-5);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        handleSkip10(5);
      } else if (e.code === "KeyJ") {
        e.preventDefault();
        handleSkip10(-10);
      } else if (e.code === "KeyL") {
        e.preventDefault();
        handleSkip10(10);
      } else if (e.code === "KeyM") {
        e.preventDefault();
        handleToggleMute();
      } else if (e.code === "KeyV") {
        e.preventDefault();
        setMediaMode((prev) => (prev === "audio" ? "video" : "audio"));
      } else if (e.code === "KeyF") {
        e.preventDefault();
        handleToggleFullscreen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, currentTime, duration, isMuted, volume]);

  const handleToggleFavorite = () => {
    const next = toggleSaveVideo(video);
    setIsSaved(next);
  };

  const handleShare = () => {
    const url = `https://music.youtube.com/watch?v=${cleanVideoId}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const effectiveTime = isScrubbing ? scrubTime : currentTime;
  const progressPercent = duration > 0 ? (effectiveTime / duration) * 100 : 0;
  const bufferPercent = Math.min(100, Math.max(0, bufferedFraction * 100));
  const upNextList = playlist.length > 0 ? playlist.filter((v) => v.id !== video.id) : [];

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 select-none">
      {/* Top Navigation Bar with SONG / VIDEO Switcher */}
      <div className="flex items-center justify-between gap-3 flex-wrap pb-1">
        <button
          id="yt-back-btn"
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold transition-all border border-white/5 hover:border-white/10 cursor-pointer shadow-sm active:scale-95"
        >
          <ArrowLeft size={14} />
          <span>Back to Music Hub</span>
        </button>

        {/* Seamless Song vs Video Switcher */}
        <div className="flex items-center p-1 rounded-2xl bg-neutral-900 border border-white/15 shadow-lg">
          <button
            type="button"
            onClick={() => setMediaMode("audio")}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              mediaMode === "audio"
                ? "bg-emerald-600 text-white shadow-md"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <Music size={14} />
            <span>Song (Audio)</span>
          </button>
          <button
            type="button"
            onClick={() => setMediaMode("video")}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              mediaMode === "video"
                ? "bg-emerald-600 text-white shadow-md"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <VideoIcon size={14} />
            <span>Music Video</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={`https://music.youtube.com/watch?v=${cleanVideoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white text-xs font-medium border border-white/5 transition-all"
          >
            <ExternalLink size={12} />
            <span>YouTube Music</span>
          </a>
        </div>
      </div>

      {/* Main Player Card */}
      <div className="relative rounded-3xl overflow-hidden bg-[#111118] border border-white/10 shadow-2xl p-5 sm:p-8">
        {/* Ambient Glow */}
        <div
          className="absolute -top-32 -left-32 w-96 h-96 rounded-full blur-3xl opacity-20 pointer-events-none transition-colors duration-700 bg-emerald-600"
        />

        {/* Floating Notification */}
        {scrollNotice && (
          <div className="absolute top-4 right-4 z-40 px-3 py-1.5 rounded-xl bg-emerald-500 text-white font-mono text-xs font-black shadow-2xl animate-fade-in flex items-center gap-1.5">
            <Radio size={12} className="animate-pulse" />
            <span>{scrollNotice}</span>
          </div>
        )}

        {/* ----------------- VIDEO MODE VIEWPORT ----------------- */}
        {/* Displayed cleanly at the top when in video mode */}
        <div className={mediaMode === "video" ? "block space-y-5" : "hidden"}>
          <div
            ref={videoContainerRef}
            className="relative w-full aspect-video max-h-[65vh] rounded-2xl overflow-hidden bg-black border border-white/10 shadow-2xl group flex items-center justify-center mx-auto"
          >
            {/* The Unified Video Screen: Clean video frame with all YouTube watermark and header overlays cropped out */}
            <div className="w-full h-full relative overflow-hidden bg-black flex items-center justify-center">
              <div
                className="absolute pointer-events-none"
                style={{
                  width: "120%",
                  height: "132%",
                  top: "-16%",
                  left: "-10%",
                }}
              >
                <div id="yt-unified-iframe-inner" className="w-full h-full" />
              </div>

              {/* Clean Paused Screen Mask: Completely eliminates YouTube's built-in pause screen, play icons, and recommendations */}
              <div
                className={`absolute inset-0 z-[8] bg-black flex items-center justify-center transition-opacity duration-300 pointer-events-none overflow-hidden ${
                  !isPlaying ? "opacity-100" : "opacity-0"
                }`}
              >
                {(video.thumbnail || cleanVideoId) && (
                  <>
                    <img
                      src={video.thumbnail || `https://i.ytimg.com/vi/${cleanVideoId}/maxresdefault.jpg`}
                      alt={video.title}
                      onError={(e) => {
                        if (cleanVideoId) {
                          (e.currentTarget as HTMLImageElement).src = `https://i.ytimg.com/vi/${cleanVideoId}/hqdefault.jpg`;
                        }
                      }}
                      className="absolute inset-0 w-full h-full object-cover filter blur-xl opacity-35 scale-110"
                    />
                    <img
                      src={video.thumbnail || `https://i.ytimg.com/vi/${cleanVideoId}/maxresdefault.jpg`}
                      alt={video.title}
                      onError={(e) => {
                        if (cleanVideoId) {
                          (e.currentTarget as HTMLImageElement).src = `https://i.ytimg.com/vi/${cleanVideoId}/hqdefault.jpg`;
                        }
                      }}
                      className="relative z-10 max-h-full max-w-full object-contain mx-auto shadow-2xl"
                    />
                  </>
                )}
              </div>
            </div>

            {/* Custom Transparent Click-to-Play/Pause Overlay Layer */}
            <div
              onClick={handleTogglePlay}
              className="absolute inset-0 cursor-pointer z-10 flex items-center justify-center select-none"
            >
              {/* Smooth Ripple Fade-Out Center Play Action Animation */}
              {centerAction && centerAction.type === "play" && (
                <div
                  key={centerAction.id}
                  className="pointer-events-none p-6 rounded-full bg-black/70 backdrop-blur-md text-white border border-white/25 shadow-2xl animate-ripple-fade"
                >
                  <Play size={42} className="fill-white ml-1 text-white" />
                </div>
              )}
            </div>

            {/* Top Right Quick Controls */}
            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 z-20 pointer-events-auto">
              <button
                type="button"
                onClick={handleToggleFullscreen}
                className="p-2 rounded-xl bg-black/70 hover:bg-black/90 text-white backdrop-blur-md border border-white/10 cursor-pointer shadow-lg active:scale-95 transition-all"
                title="Toggle Fullscreen (F)"
              >
                <Maximize2 size={16} />
              </button>
            </div>

            {/* Buffering Indicator */}
            {isBuffering && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-20 pointer-events-none">
                <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-black/80 text-xs font-semibold text-white border border-white/10">
                  <div className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                  <span>Loading stream...</span>
                </div>
              </div>
            )}
          </div>

          {/* Video Metadata Header */}
          <div className="flex items-start justify-between gap-4 flex-wrap pt-1">
            <div className="space-y-1 max-w-2xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-bold text-emerald-400">
                <VideoIcon size={11} />
                <span>Music Video &bull; Custom Pure Screen</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-snug">
                {video.title}
              </h1>
              <p className="text-sm font-semibold text-neutral-300">
                {video.channelTitle || video.artist || "YouTube Music Artist"}
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleFavorite}
                style={{
                  backgroundColor: isSaved ? "#059669" : "rgba(255, 255, 255, 0.05)",
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border border-white/10 cursor-pointer ${
                  isSaved ? "text-white shadow-md" : "text-neutral-300 hover:text-white hover:bg-white/10"
                }`}
              >
                <Heart size={13} className={isSaved ? "fill-white text-white" : ""} />
                <span>{isSaved ? "Saved" : "Save"}</span>
              </button>

              <button
                type="button"
                onClick={handleShare}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-neutral-300 hover:text-white transition-all cursor-pointer"
              >
                {copiedLink ? <Check size={13} className="text-emerald-400" /> : <Share2 size={13} />}
                <span>{copiedLink ? "Copied!" : "Share"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* ----------------- AUDIO MODE VIEWPORT (ALBUM ART & EQUALIZER) ----------------- */}
        <div className={mediaMode === "audio" ? "block" : "hidden"}>
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-center gap-8 sm:gap-12">
            {/* High-Resolution Album Artwork */}
            <div className="relative shrink-0 group">
              <div className="w-60 h-60 sm:w-80 sm:h-80 rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-neutral-900 relative">
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  referrerPolicy="no-referrer"
                  className={`w-full h-full object-cover transition-transform duration-700 ${
                    isPlaying ? "scale-105" : "scale-100 opacity-90"
                  }`}
                />

                {/* Status Badge */}
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-emerald-600/90 backdrop-blur-md border border-white/20 text-white font-black text-[10px] tracking-widest uppercase flex items-center gap-1.5 shadow-xl">
                  <Music size={11} />
                  <span>STUDIO AUDIO</span>
                </div>

                {/* Audio Frequency Equalizer Animation */}
                {isPlaying && (
                  <div className="absolute bottom-3 right-3 px-2.5 py-1.5 rounded-xl bg-black/70 backdrop-blur-md border border-white/10 flex items-end gap-1 shadow-lg">
                    <span className="w-1.5 h-3 bg-emerald-400 rounded-full animate-[bounce_0.8s_ease-in-out_infinite]" />
                    <span className="w-1.5 h-5 bg-emerald-400 rounded-full animate-[bounce_0.6s_ease-in-out_0.2s_infinite]" />
                    <span className="w-1.5 h-2 bg-emerald-400 rounded-full animate-[bounce_0.9s_ease-in-out_0.1s_infinite]" />
                    <span className="w-1.5 h-4 bg-emerald-400 rounded-full animate-[bounce_0.7s_ease-in-out_0.3s_infinite]" />
                  </div>
                )}

                {/* Buffering Indicator */}
                {isBuffering && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                    <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-black/80 text-xs font-semibold text-white border border-white/10">
                      <div className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                      <span>Loading audio stream...</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Song Metadata */}
            <div className="flex-1 w-full max-w-xl flex flex-col justify-between space-y-6 text-center md:text-left">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-400">
                  <Sparkles size={12} />
                  <span>Now Playing &bull; High Definition Stream</span>
                </div>

                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-snug line-clamp-2">
                  {video.title}
                </h1>

                <p className="text-base font-semibold text-neutral-300 flex items-center justify-center md:justify-start gap-1.5">
                  <span>{video.channelTitle || video.artist || "YouTube Music Artist"}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                </p>
              </div>

              {/* Action buttons for Audio Mode */}
              <div className="flex items-center justify-center md:justify-start gap-2.5">
                <button
                  type="button"
                  onClick={handleToggleFavorite}
                  style={{
                    backgroundColor: isSaved ? "#059669" : "rgba(255, 255, 255, 0.05)",
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border border-white/10 cursor-pointer ${
                    isSaved ? "text-white shadow-md" : "text-neutral-300 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <Heart size={13} className={isSaved ? "fill-white text-white" : ""} />
                  <span>{isSaved ? "Saved" : "Save"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleShare}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-neutral-300 hover:text-white transition-all cursor-pointer"
                >
                  {copiedLink ? <Check size={13} className="text-emerald-400" /> : <Share2 size={13} />}
                  <span>{copiedLink ? "Copied!" : "Share"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMediaMode("video")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-xs font-semibold text-emerald-400 transition-all cursor-pointer"
                >
                  <VideoIcon size={13} />
                  <span>Watch Video</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ----------------- UNIVERSAL CUSTOM CONTROLLER BAR (AUDIO & VIDEO) ----------------- */}
        <div className="mt-8 pt-6 border-t border-white/10 space-y-4">
          {/* HIGH-PRECISION DURATION TIMELINE SCRUBBER */}
          <div className="space-y-1.5">
            <div
              ref={scrubBarRef}
              onMouseDown={handleScrubStart}
              onTouchStart={handleScrubStart}
              onMouseMove={handleScrubMouseMove}
              onMouseLeave={handleScrubMouseLeave}
              className="group relative w-full h-8 flex items-center cursor-pointer touch-none"
              title="Click, drag, or scroll mouse wheel over this bar to seek anywhere in the track"
            >
              <div className="w-full h-2 group-hover:h-3 rounded-full bg-white/15 overflow-hidden transition-all relative">
                <div
                  style={{ width: `${bufferPercent}%` }}
                  className="absolute left-0 top-0 bottom-0 bg-white/25 rounded-full transition-all duration-300"
                />
                <div
                  style={{
                    width: `${progressPercent}%`,
                    backgroundColor: "#10b981",
                  }}
                  className="absolute left-0 top-0 bottom-0 rounded-full"
                />
              </div>

              <div
                style={{ left: `${progressPercent}%` }}
                className={`absolute -translate-x-1/2 w-4 h-4 rounded-full bg-white shadow-xl pointer-events-none transition-transform duration-100 ${
                  isScrubbing ? "scale-125 ring-4 ring-emerald-500/40" : "group-hover:scale-110"
                }`}
              />

              {hoverTime !== null && (
                <div
                  style={{ left: `${hoverPosition}%` }}
                  className="absolute bottom-7 -translate-x-1/2 px-2.5 py-1 rounded-lg bg-neutral-900 border border-white/20 text-white font-mono text-xs font-bold shadow-2xl pointer-events-none"
                >
                  {formatTime(hoverTime)}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-xs font-mono font-medium text-neutral-400 px-0.5">
              <span>{formatTime(effectiveTime)}</span>
              <span className="text-[11px] text-neutral-500 font-sans font-normal hidden sm:inline">
                Scroll mouse wheel over bar to seek &bull; Press Space to Play/Pause
              </span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* PRIMARY PLAYBACK & VOLUME CONTROLS */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* Center controls */}
            <div className="flex items-center gap-2 sm:gap-3 mx-auto sm:mx-0">
              <button
                type="button"
                onClick={() => setIsShuffle(!isShuffle)}
                style={{
                  color: isShuffle ? "#10b981" : undefined,
                }}
                className={`p-2.5 rounded-full transition-colors cursor-pointer ${
                  isShuffle ? "bg-emerald-500/20" : "text-neutral-400 hover:text-white hover:bg-white/5"
                }`}
                title={isShuffle ? "Shuffle On" : "Shuffle Off"}
              >
                <Shuffle size={17} />
              </button>

              <button
                type="button"
                onClick={handlePreviousTrack}
                className="p-2.5 rounded-full text-neutral-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Previous (or Restart)"
              >
                <SkipBack size={19} />
              </button>

              <button
                type="button"
                onClick={() => handleSkip10(-10)}
                className="p-2.5 rounded-full text-neutral-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer relative"
                title="Rewind 10 seconds (J)"
              >
                <RotateCcw size={17} />
                <span className="absolute text-[8px] font-bold top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                  10
                </span>
              </button>

              <button
                type="button"
                onClick={handleTogglePlay}
                style={{ backgroundColor: "#059669" }}
                className="h-12 w-12 sm:h-14 sm:w-14 rounded-full text-white flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer ring-4 ring-emerald-500/20"
                title={isPlaying ? "Pause (Space)" : "Play (Space)"}
              >
                {isPlaying ? (
                  <Pause size={22} className="fill-white" />
                ) : (
                  <Play size={22} className="fill-white ml-0.5" />
                )}
              </button>

              <button
                type="button"
                onClick={() => handleSkip10(10)}
                className="p-2.5 rounded-full text-neutral-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer relative"
                title="Forward 10 seconds (L)"
              >
                <RotateCw size={17} />
                <span className="absolute text-[8px] font-bold top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                  10
                </span>
              </button>

              <button
                type="button"
                onClick={handleNextTrack}
                className="p-2.5 rounded-full text-neutral-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Next Track"
              >
                <SkipForward size={19} />
              </button>

              <button
                type="button"
                onClick={handleToggleRepeat}
                style={{
                  color: repeatMode !== "off" ? "#10b981" : undefined,
                }}
                className={`p-2.5 rounded-full transition-colors cursor-pointer ${
                  repeatMode !== "off" ? "bg-emerald-500/20" : "text-neutral-400 hover:text-white hover:bg-white/5"
                }`}
                title={`Repeat: ${repeatMode}`}
              >
                {repeatMode === "one" ? <Repeat1 size={17} /> : <Repeat size={17} />}
              </button>
            </div>

            {/* Right side controls (Volume & Speed) */}
            <div className="flex items-center gap-3 mx-auto sm:mx-0">
              <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={handleToggleMute}
                  className="text-neutral-300 hover:text-white transition-colors cursor-pointer"
                  title={isMuted ? "Unmute (M)" : "Mute (M)"}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX size={16} />
                  ) : volume < 50 ? (
                    <Volume1 size={16} />
                  ) : (
                    <Volume2 size={16} />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(Number(e.target.value))}
                  className="w-16 sm:w-24 h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <span className="text-[11px] font-mono text-neutral-400 w-6 text-right">
                  {isMuted ? 0 : volume}%
                </span>
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-neutral-300 hover:text-white cursor-pointer"
                >
                  <Sliders size={12} />
                  <span>{playbackRate}x</span>
                </button>

                {showSpeedMenu && (
                  <div className="absolute bottom-full mb-2 right-0 w-24 bg-neutral-900 border border-white/15 rounded-xl shadow-2xl p-1.5 z-30 space-y-0.5">
                    {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => handleRateChange(rate)}
                        className={`w-full text-left px-2.5 py-1 rounded-lg text-xs font-mono transition-colors ${
                          playbackRate === rate
                            ? "bg-emerald-600 text-white font-bold"
                            : "text-neutral-300 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================= TABBED CONTENT: UP NEXT / LYRICS / DETAILS ================= */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center gap-2 border-b border-white/10 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab("queue")}
            className={`flex items-center gap-2 px-4 py-2 font-bold text-xs sm:text-sm border-b-2 transition-all cursor-pointer ${
              activeTab === "queue"
                ? "text-white font-black border-emerald-500"
                : "text-neutral-400 hover:text-white border-transparent"
            }`}
          >
            <ListMusic size={15} />
            <span>Up Next &bull; Queue ({upNextList.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("lyrics")}
            className={`flex items-center gap-2 px-4 py-2 font-bold text-xs sm:text-sm border-b-2 transition-all cursor-pointer ${
              activeTab === "lyrics"
                ? "text-white font-black border-emerald-500"
                : "text-neutral-400 hover:text-white border-transparent"
            }`}
          >
            <FileText size={15} />
            <span>Lyrics</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("details")}
            className={`flex items-center gap-2 px-4 py-2 font-bold text-xs sm:text-sm border-b-2 transition-all cursor-pointer ${
              activeTab === "details"
                ? "text-white font-black border-emerald-500"
                : "text-neutral-400 hover:text-white border-transparent"
            }`}
          >
            <Info size={15} />
            <span>Song Details</span>
          </button>
        </div>

        {/* Tab 1: Queue */}
        {activeTab === "queue" && (
          <div className="space-y-3">
            {upNextList.length === 0 ? (
              <div className="p-8 text-center bg-white/5 rounded-2xl border border-white/5">
                <ListMusic size={32} className="mx-auto text-neutral-500 mb-2" />
                <p className="text-sm font-semibold text-neutral-300">Queue is empty</p>
                <p className="text-xs text-neutral-500 mt-1">Search songs or select from categories to add tracks.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {upNextList.map((t, i) => (
                  <div
                    key={t.id + "-" + i}
                    onClick={() => onSelectVideo?.(t)}
                    className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all cursor-pointer group"
                  >
                    <img
                      src={t.thumbnail}
                      alt={t.title}
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 rounded-xl object-cover shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-white truncate group-hover:text-emerald-400 transition-colors">
                        {t.title}
                      </p>
                      <p className="text-[11px] text-neutral-400 truncate">
                        {t.channelTitle || t.artist || "YouTube Music"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Lyrics */}
        {activeTab === "lyrics" && (
          <div className="p-8 rounded-3xl bg-white/5 border border-white/5 text-center space-y-3">
            <FileText size={32} className="mx-auto text-emerald-400/80" />
            <h3 className="text-base font-bold text-white">Lyrics for &ldquo;{video.title}&rdquo;</h3>
            <p className="text-xs text-neutral-400 max-w-md mx-auto leading-relaxed">
              Sing along with your favorite tracks. Dynamic synchronized lyrics for this song will appear here when available.
            </p>
          </div>
        )}

        {/* Tab 3: Song Details */}
        {activeTab === "details" && (
          <div className="p-6 rounded-3xl bg-white/5 border border-white/5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
            <div className="space-y-1">
              <span className="text-neutral-500 uppercase tracking-wider font-bold text-[10px]">Title</span>
              <p className="text-white font-semibold">{video.title}</p>
            </div>
            <div className="space-y-1">
              <span className="text-neutral-500 uppercase tracking-wider font-bold text-[10px]">Artist / Channel</span>
              <p className="text-white font-semibold">{video.channelTitle || video.artist || "YouTube Music"}</p>
            </div>
            <div className="space-y-1">
              <span className="text-neutral-500 uppercase tracking-wider font-bold text-[10px]">Track Duration</span>
              <p className="text-white font-mono font-semibold">{formatTime(duration)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
