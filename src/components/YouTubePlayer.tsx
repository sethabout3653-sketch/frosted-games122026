import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Heart,
  ArrowLeft,
  Music,
  Volume2,
  VolumeX,
  Volume1,
  Play,
  Pause,
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
  Sparkles,
  ExternalLink,
  Disc,
} from "lucide-react";
import { YouTubeVideo } from "../types";
import { isVideoSaved, toggleSaveVideo, addToWatchHistory } from "../lib/youtubeStorage";
import { sendBroadcastSignal } from "../lib/database";

interface YouTubePlayerProps {
  video: YouTubeVideo;
  playlist?: YouTubeVideo[];
  onBack: () => void;
  onSelectVideo?: (video: YouTubeVideo) => void;
}

function extractYouTubeId(urlOrId: string): string {
  if (!urlOrId) return "";
  if (/^[a-zA-Z0-9_-]{11}$/.test(urlOrId)) return urlOrId;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = urlOrId.match(regExp);
  return match && match[2].length === 11 ? match[2] : urlOrId;
}

function parseDurationToSeconds(duration: string | number | undefined): number {
  if (duration === undefined || duration === null) return 210;
  if (typeof duration === "number") return duration;
  const durationStr = String(duration).trim();
  if (!durationStr) return 210;
  if (durationStr.toLowerCase() === "live") return 0;
  if (/^\d+$/.test(durationStr)) return parseInt(durationStr, 10);
  const parts = durationStr.split(":").map(Number);
  if (parts.some(isNaN)) return 210;
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 210;
}

export default function YouTubePlayer({
  video,
  playlist = [],
  onBack,
  onSelectVideo,
}: YouTubePlayerProps) {
  const cleanVideoId = extractYouTubeId(video.id);

  // Audio-only player state (x8rr/music architecture: 100% audio, zero video)
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
  const [activeTab, setActiveTab] = useState<"queue" | "lyrics" | "info">("queue");

  const [bypassStreamUrl, setBypassStreamUrl] = useState<string | null>(null);
  const [isResolvingBypass, setIsResolvingBypass] = useState<boolean>(false);
  const html5MediaRef = useRef<HTMLAudioElement | null>(null);

  // Scrubbing & Scroll feedback state
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(0);
  const [scrollNotice, setScrollNotice] = useState<string | null>(null);

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

  const showNotification = (msg: string) => {
    setScrollNotice(msg);
    setTimeout(() => setScrollNotice(null), 3000);
  };

  // Sync saved status and history
  const [isSaved, setIsSaved] = useState(() => isVideoSaved(video.id));
  useEffect(() => {
    setIsSaved(isVideoSaved(video.id));
    addToWatchHistory(video, 0, 0);
    setCurrentTime(0);
    setDuration(parseDurationToSeconds(video.duration) || 210);
  }, [video]);

  // Stream audio directly via x8rr-music backend (/api/yt/id/:id)
  const activateDirectStreamBypass = useCallback(async () => {
    if (!cleanVideoId) return;
    setIsResolvingBypass(true);
    setIsBuffering(true);
    try {
      const streamUrl = `/api/yt/id/${cleanVideoId}?title=${encodeURIComponent(video.title || "")}&artist=${encodeURIComponent(video.artist || video.channelTitle || "")}`;
      setBypassStreamUrl(streamUrl);
      setIsBuffering(false);
    } catch (err) {
      console.warn("Audio stream error:", err);
    } finally {
      setIsResolvingBypass(false);
      setIsBuffering(false);
    }
  }, [cleanVideoId, video.title, video.artist, video.channelTitle]);

  useEffect(() => {
    if (cleanVideoId) {
      setBypassStreamUrl(null);
      activateDirectStreamBypass();
    }
  }, [cleanVideoId, activateDirectStreamBypass]);

  // Sync HTML5 audio element volume and mute
  useEffect(() => {
    if (html5MediaRef.current) {
      html5MediaRef.current.volume = isMuted ? 0 : volume / 100;
      html5MediaRef.current.playbackRate = playbackRate;
    }
  }, [volume, isMuted, playbackRate]);

  const handleTogglePlay = () => {
    if (!html5MediaRef.current) return;
    if (isPlaying) {
      html5MediaRef.current.pause();
      setIsPlaying(false);
    } else {
      html5MediaRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleTrackEnd = useCallback(() => {
    if (repeatModeRef.current === "one" && html5MediaRef.current) {
      html5MediaRef.current.currentTime = 0;
      html5MediaRef.current.play().catch(() => {});
      setIsPlaying(true);
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

  const handlePrevTrack = () => {
    const currentList = playlistRef.current;
    const selectFn = onSelectVideoRef.current;
    if (currentList.length > 0 && selectFn) {
      const idx = currentList.findIndex((v) => v.id === videoIdRef.current);
      if (idx > 0) {
        selectFn(currentList[idx - 1]);
      } else if (currentList.length > 0) {
        selectFn(currentList[currentList.length - 1]);
      }
    }
  };

  const handleNextTrack = () => {
    handleTrackEnd();
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs <= 0) return "0:00";
    const mins = Math.floor(secs / 60);
    const remainSecs = Math.floor(secs % 60);
    return `${mins}:${remainSecs < 10 ? "0" : ""}${remainSecs}`;
  };

  const handleToggleFavorite = () => {
    toggleSaveVideo(video);
    setIsSaved(isVideoSaved(video.id));
    showNotification(isSaved ? "Removed from Saved Music" : "Added to Saved Music");
  };

  const [copiedLink, setCopiedLink] = useState(false);
  const handleShare = () => {
    const shareUrl = `https://music.youtube.com/watch?v=${cleanVideoId}`;
    navigator.clipboard.writeText(shareUrl).catch(() => {});
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    showNotification("Copied song link to clipboard!");
  };

  return (
    <div className="max-w-5xl mx-auto w-full px-4 py-6 space-y-6 select-none">
      {/* Hidden Lossless Audio Element (x8rr/music pure audio backend) */}
      {bypassStreamUrl && (
        <audio
          ref={html5MediaRef}
          src={bypassStreamUrl}
          autoPlay
          playsInline
          onTimeUpdate={(e) => {
            if (!isScrubbing) {
              const ct = e.currentTarget.currentTime;
              const dur = e.currentTarget.duration;
              if (typeof ct === "number" && !isNaN(ct)) setCurrentTime(ct);
              if (dur && dur > 0 && !isNaN(dur) && isFinite(dur)) setDuration(dur);
            }
          }}
          onLoadedMetadata={(e) => {
            const dur = e.currentTarget.duration;
            if (dur && dur > 0 && !isNaN(dur) && isFinite(dur)) {
              setDuration(dur);
            }
          }}
          onDurationChange={(e) => {
            const dur = e.currentTarget.duration;
            if (dur && dur > 0 && !isNaN(dur) && isFinite(dur)) {
              setDuration(dur);
            }
          }}
          onProgress={(e) => {
            if (e.currentTarget.buffered.length > 0 && e.currentTarget.duration > 0) {
              setBufferedFraction(
                e.currentTarget.buffered.end(e.currentTarget.buffered.length - 1) /
                  e.currentTarget.duration
              );
            }
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={handleTrackEnd}
          onError={() => setIsBuffering(true)}
        />
      )}

      {/* Top Header & Navigation */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white text-xs font-semibold border border-white/10 transition-all cursor-pointer shadow-md"
        >
          <ArrowLeft size={14} />
          <span>Back to Music Hub</span>
        </button>

        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs font-bold text-emerald-400">
            <Disc size={13} className="animate-spin text-emerald-400" />
            <span>x8rr/music &bull; Lossless Audio Player</span>
          </div>

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

      {/* Main Music Player Card */}
      <div className="relative rounded-3xl overflow-hidden bg-[#111118] border border-white/10 shadow-2xl p-6 sm:p-10">
        {/* Ambient Glow */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full blur-3xl opacity-25 pointer-events-none transition-colors duration-700 bg-emerald-600" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full blur-3xl opacity-20 pointer-events-none transition-colors duration-700 bg-cyan-600" />

        {/* Floating Notification */}
        {scrollNotice && (
          <div className="absolute top-4 right-4 z-40 px-3 py-1.5 rounded-xl bg-emerald-500 text-white font-mono text-xs font-black shadow-2xl animate-fade-in flex items-center gap-1.5">
            <Radio size={12} className="animate-pulse" />
            <span>{scrollNotice}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          {/* Left: Glowing Spinning Vinyl & Album Art Cover */}
          <div className="md:col-span-5 flex flex-col items-center justify-center">
            <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-3xl overflow-hidden shadow-2xl border border-white/15 bg-neutral-900 group flex items-center justify-center">
              <img
                src={video.thumbnail || `https://i.ytimg.com/vi/${cleanVideoId}/maxresdefault.jpg`}
                alt={video.title}
                onError={(e) => {
                  if (cleanVideoId) {
                    (e.currentTarget as HTMLImageElement).src = `https://i.ytimg.com/vi/${cleanVideoId}/hqdefault.jpg`;
                  }
                }}
                className={`w-full h-full object-cover transition-transform duration-700 ${isPlaying ? "scale-105" : "scale-100"}`}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80" />
              
              {/* Spinning Vinyl Overlay Indicator */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className={`w-20 h-20 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-2xl transition-all ${isPlaying ? "animate-spin [animation-duration:8s]" : ""}`}>
                  <div className="w-6 h-6 rounded-full bg-emerald-500 border-2 border-white shadow-inner flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-black" />
                  </div>
                </div>
              </div>

              {isBuffering && (
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-20">
                  <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-black/90 text-xs font-semibold text-white border border-white/10">
                    <div className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                    <span>Loading lossless stream...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-3 mt-6">
              <button
                type="button"
                onClick={handleToggleFavorite}
                style={{
                  backgroundColor: isSaved ? "#059669" : "rgba(255, 255, 255, 0.05)",
                }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all border border-white/10 cursor-pointer ${
                  isSaved ? "text-white shadow-lg" : "text-neutral-300 hover:text-white hover:bg-white/10"
                }`}
              >
                <Heart size={14} className={isSaved ? "fill-white text-white" : ""} />
                <span>{isSaved ? "Saved to Library" : "Save Song"}</span>
              </button>

              <button
                type="button"
                onClick={handleShare}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-neutral-300 hover:text-white transition-all cursor-pointer"
              >
                {copiedLink ? <Check size={14} className="text-emerald-400" /> : <Share2 size={14} />}
                <span>{copiedLink ? "Copied Link!" : "Share"}</span>
              </button>
            </div>
          </div>

          {/* Right: Song Metadata, Waveform Seekbar, and Audio Controls */}
          <div className="md:col-span-7 flex flex-col justify-between space-y-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-bold text-emerald-400">
                <Music size={11} />
                <span>Pure Audio Mode &bull; Lossless Stream</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-snug">
                {video.title}
              </h1>
              <p className="text-sm font-semibold text-neutral-300">
                {video.channelTitle || video.artist || "x8rr/music Artist"}
              </p>
            </div>

            {/* Seekbar & Time Display */}
            <div className="space-y-2">
              <div
                className="relative w-full h-3 bg-neutral-800 rounded-full cursor-pointer group overflow-hidden"
                onMouseDown={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                  const newTime = pos * duration;
                  setCurrentTime(newTime);
                  if (html5MediaRef.current) html5MediaRef.current.currentTime = newTime;
                }}
              >
                {/* Buffered Progress */}
                <div
                  className="absolute inset-y-0 left-0 bg-neutral-600/50 rounded-full pointer-events-none"
                  style={{ width: `${bufferedFraction * 100}%` }}
                />
                {/* Played Progress */}
                <div
                  className="absolute inset-y-0 left-0 bg-emerald-500 rounded-full pointer-events-none transition-all"
                  style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs font-mono text-neutral-400">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Playback Controls Toolbar */}
            <div className="flex items-center justify-between gap-4 flex-wrap pt-2">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsShuffle(!isShuffle)}
                  className={`p-2.5 rounded-xl transition-all cursor-pointer ${
                    isShuffle ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40" : "bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10"
                  }`}
                  title="Shuffle"
                >
                  <Shuffle size={16} />
                </button>

                <button
                  type="button"
                  onClick={handlePrevTrack}
                  className="p-3 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-all cursor-pointer shadow-md active:scale-95"
                  title="Previous Song"
                >
                  <SkipBack size={18} />
                </button>

                <button
                  type="button"
                  onClick={handleTogglePlay}
                  className="p-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black transition-all cursor-pointer shadow-xl shadow-emerald-500/20 active:scale-95 flex items-center justify-center"
                  title={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? <Pause size={22} className="fill-black" /> : <Play size={22} className="fill-black ml-0.5" />}
                </button>

                <button
                  type="button"
                  onClick={handleNextTrack}
                  className="p-3 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-all cursor-pointer shadow-md active:scale-95"
                  title="Next Song"
                >
                  <SkipForward size={18} />
                </button>

                <button
                  type="button"
                  onClick={() => setRepeatMode(repeatMode === "off" ? "all" : repeatMode === "all" ? "one" : "off")}
                  className={`p-2.5 rounded-xl transition-all cursor-pointer ${
                    repeatMode !== "off" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40" : "bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10"
                  }`}
                  title={`Repeat: ${repeatMode}`}
                >
                  {repeatMode === "one" ? <Repeat1 size={16} /> : <Repeat size={16} />}
                </button>
              </div>

              {/* Volume Slider */}
              <div className="flex items-center gap-2.5 bg-neutral-900/80 px-3.5 py-2 rounded-2xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setIsMuted(!isMuted)}
                  className="text-neutral-400 hover:text-white cursor-pointer"
                >
                  {isMuted || volume === 0 ? <VolumeX size={16} /> : volume < 50 ? <Volume1 size={16} /> : <Volume2 size={16} />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    setVolume(Number(e.target.value));
                    setIsMuted(false);
                  }}
                  className="w-20 accent-emerald-500 cursor-pointer h-1.5 bg-neutral-700 rounded-lg"
                />
                <span className="text-xs font-mono text-neutral-400 w-8 text-right">{isMuted ? 0 : volume}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Tabs: Queue, Lyrics, & Info */}
        <div className="mt-10 pt-6 border-t border-white/10">
          <div className="flex items-center gap-2 mb-4">
            <button
              type="button"
              onClick={() => setActiveTab("queue")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "queue" ? "bg-white/15 text-white shadow-md" : "text-neutral-400 hover:text-white bg-white/5"
              }`}
            >
              <ListMusic size={14} />
              <span>Up Next Queue ({playlist.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("lyrics")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "lyrics" ? "bg-white/15 text-white shadow-md" : "text-neutral-400 hover:text-white bg-white/5"
              }`}
            >
              <FileText size={14} />
              <span>Live Lyrics</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("info")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "info" ? "bg-white/15 text-white shadow-md" : "text-neutral-400 hover:text-white bg-white/5"
              }`}
            >
              <Info size={14} />
              <span>Track Details</span>
            </button>
          </div>

          <div className="bg-black/40 rounded-2xl p-4 border border-white/5 max-h-60 overflow-y-auto">
            {activeTab === "queue" && (
              <div className="space-y-2">
                {playlist.length === 0 ? (
                  <p className="text-xs text-neutral-400 text-center py-4">No other tracks in queue.</p>
                ) : (
                  playlist.map((item) => {
                    const isCurrent = item.id === video.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => onSelectVideo?.(item)}
                        className={`flex items-center justify-between p-2.5 rounded-xl transition-all cursor-pointer ${
                          isCurrent ? "bg-emerald-500/20 border border-emerald-500/40 text-white" : "hover:bg-white/5 text-neutral-300"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={item.thumbnail}
                            alt={item.title}
                            className="w-10 h-10 rounded-lg object-cover"
                          />
                          <div>
                            <p className="text-xs font-bold line-clamp-1">{item.title}</p>
                            <p className="text-[10px] text-neutral-400">{item.channelTitle || item.artist || "x8rr/music"}</p>
                          </div>
                        </div>
                        <span className="text-xs font-mono text-neutral-400">{item.duration}</span>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {activeTab === "lyrics" && (
              <div className="text-center py-8 space-y-2">
                <Sparkles size={24} className="mx-auto text-emerald-400 animate-pulse" />
                <p className="text-xs font-bold text-white">Synchronized Lossless Lyrics</p>
                <p className="text-xs text-neutral-400 max-w-md mx-auto">
                  Enjoying <span className="text-white font-semibold">{video.title}</span>. Lyrics are streamed in sync with the x8rr/music audio engine.
                </p>
              </div>
            )}

            {activeTab === "info" && (
              <div className="space-y-3 text-xs text-neutral-300 py-2">
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-neutral-500">Track Title</span>
                  <span className="font-semibold text-white">{video.title}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-neutral-500">Artist / Channel</span>
                  <span className="font-semibold text-white">{video.channelTitle || video.artist || "x8rr/music"}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-neutral-500">Streaming Protocol</span>
                  <span className="font-mono text-emerald-400">yt-dlp &bull; googlevideo.com lossless audio</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Duration</span>
                  <span className="font-mono text-white">{video.duration || "N/A"}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
