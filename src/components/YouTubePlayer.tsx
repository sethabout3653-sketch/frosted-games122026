import React, { useState, useEffect, useRef } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  RotateCcw,
  RotateCw,
  Settings,
  Heart,
  Share2,
  ArrowLeft,
  Tv,
  Check,
  ExternalLink,
  Film,
  Sparkles,
  Link as LinkIcon,
  Copy,
} from "lucide-react";
import { YouTubeVideo, YouTubeStreamFormat } from "../types";
import { isVideoSaved, toggleSaveVideo, addToWatchHistory } from "../lib/youtubeStorage";

interface YouTubePlayerProps {
  video: YouTubeVideo;
  onBack?: () => void;
  onSelectRelated?: (video: YouTubeVideo) => void;
  autoPlayNext?: boolean;
}

export default function YouTubePlayer({
  video,
  onBack,
  onSelectRelated,
  autoPlayNext = true,
}: YouTubePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLooping, setIsLooping] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showCustomUrlInput, setShowCustomUrlInput] = useState(false);
  const [customDirectUrl, setCustomDirectUrl] = useState("");
  const [activeStreamUrl, setActiveStreamUrl] = useState<string>("");
  const [streamFormats, setStreamFormats] = useState<YouTubeStreamFormat[]>([]);
  const [selectedQuality, setSelectedQuality] = useState<string>("auto");
  const [isLoadingStream, setIsLoadingStream] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showFullDesc, setShowFullDesc] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setIsSaved(isVideoSaved(video.id));
  }, [video.id]);

  // Fetch video stream info and direct format URLs
  useEffect(() => {
    let isMounted = true;
    setStreamError(null);

    // If video object already has a direct streamUrl (e.g. direct googlevideo URL)
    if (video.streamUrl) {
      setActiveStreamUrl(video.streamUrl);
      setStreamFormats(video.streamFormats || []);
      return;
    }

    async function fetchStreams() {
      setIsLoadingStream(true);
      try {
        const res = await fetch(`/api/youtube/stream/${video.id}`);
        if (!res.ok) throw new Error("Stream service unreachable");
        const data = await res.json();

        if (isMounted) {
          if (data.formats && data.formats.length > 0) {
            setStreamFormats(data.formats);
            const initial = data.streamUrl || data.formats[0].url;
            setActiveStreamUrl(initial);
          } else if (data.streamUrl) {
            setActiveStreamUrl(data.streamUrl);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setStreamError("Direct stream format unavailable for this video.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingStream(false);
        }
      }
    }

    fetchStreams();

    return () => {
      isMounted = false;
    };
  }, [video.id, video.streamUrl, video.streamFormats]);

  // Sync Video time updates
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const cur = videoRef.current.currentTime;
    const dur = videoRef.current.duration || 0;
    setCurrentTime(cur);
    setDuration(dur);

    // Update buffered progress
    if (videoRef.current.buffered.length > 0) {
      setBufferedEnd(videoRef.current.buffered.end(videoRef.current.buffered.length - 1));
    }

    // Periodically update watch history
    if (Math.floor(cur) % 5 === 0) {
      addToWatchHistory(video, cur, dur);
    }
  };

  const handleTogglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const target = parseFloat(e.target.value);
    videoRef.current.currentTime = target;
    setCurrentTime(target);
  };

  const handleSkip = (seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.currentTime + seconds, duration));
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
    }
    setIsMuted(val === 0);
  };

  const handleToggleMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    setShowSpeedMenu(false);
  };

  const handleQualityChange = (format: YouTubeStreamFormat) => {
    setSelectedQuality(format.quality || format.resolution || "Direct");
    const nextUrl = format.proxyUrl || format.url;
    setActiveStreamUrl(nextUrl);
    if (videoRef.current) {
      const cur = videoRef.current.currentTime;
      const wasPlaying = !videoRef.current.paused;
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.currentTime = cur;
          if (wasPlaying) videoRef.current.play().catch(() => {});
        }
      }, 100);
    }
    setShowQualityMenu(false);
  };

  const handleToggleFullscreen = () => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleApplyCustomUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customDirectUrl.trim()) return;
    const trimmed = customDirectUrl.trim();
    setActiveStreamUrl(trimmed);
    setShowCustomUrlInput(false);
    if (videoRef.current) {
      videoRef.current.src = trimmed;
      videoRef.current.play().catch(() => {});
    }
  };

  const handleToggleFavorite = () => {
    const next = toggleSaveVideo(video);
    setIsSaved(next);
  };

  const handleCopyLink = () => {
    const streamToCopy = activeStreamUrl || `https://www.youtube.com/watch?v=${video.id}`;
    navigator.clipboard.writeText(streamToCopy);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const formatSeconds = (sec: number) => {
    if (isNaN(sec)) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  // Autohide controls on inactivity
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap pb-1">
        <button
          id="yt-back-btn"
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#272727] hover:bg-[#383838] text-white text-xs font-semibold transition-colors cursor-pointer"
        >
          <ArrowLeft size={14} />
          <span>Back</span>
        </button>
      </div>

      {/* Video Player Canvas Container */}
      <div
        ref={playerContainerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => isPlaying && setShowControls(false)}
        className={`relative rounded-2xl overflow-hidden bg-black border border-white/10 shadow-2xl group select-none transition-all duration-300 ${
          isTheaterMode ? "w-full max-h-[85vh] aspect-video" : "w-full aspect-video"
        }`}
      >
        {activeStreamUrl ? (
          <video
            ref={videoRef}
            src={activeStreamUrl}
            autoPlay
            playsInline
            loop={isLooping}
            onTimeUpdate={handleTimeUpdate}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => {
              setIsPlaying(false);
              if (autoPlayNext && onSelectRelated) {
                // Auto-advance
              }
            }}
            onClick={handleTogglePlay}
            onDoubleClick={handleToggleFullscreen}
            className="w-full h-full object-contain bg-black cursor-pointer"
          />
        ) : (
          /* Clean Direct Ad-Free Player Fallback when stream is loading or resolving */
          <div className="w-full h-full relative flex items-center justify-center bg-[#070b1e]">
            {isLoadingStream ? (
              <div className="text-center space-y-3 p-6">
                <div className="h-10 w-10 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs font-bold text-indigo-200">Resolving direct video stream format...</p>
                <p className="text-[11px] text-neutral-400">Loading googlevideo media tracks</p>
              </div>
            ) : (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0&modestbranding=1`}
                title={video.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full border-0"
              />
            )}
          </div>
        )}

        {/* Custom Video Controls Overlay (Only for direct HTML5 video stream) */}
        {activeStreamUrl && (
          <div
            className={`absolute inset-0 flex flex-col justify-between p-3 sm:p-4 bg-gradient-to-t from-black/90 via-transparent to-black/50 transition-opacity duration-300 pointer-events-none ${
              showControls ? "opacity-100" : "opacity-0"
            }`}
          >
            {/* Top Bar: Title & Direct Stream Badge */}
            <div className="flex items-center justify-between pointer-events-auto">
              <div className="flex items-center gap-2 max-w-[70%]">
                <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider">
                  Direct Stream
                </span>
                <h2 className="text-xs sm:text-sm font-bold text-white truncate drop-shadow-md">
                  {video.title}
                </h2>
              </div>
              <div className="text-[11px] text-neutral-300 font-medium">
                {video.channelTitle}
              </div>
            </div>

            {/* Bottom Controls Bar */}
            <div className="space-y-2 pointer-events-auto">
              {/* Progress Scrubber Bar */}
              <div className="relative flex items-center group/scrubber cursor-pointer">
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  step={0.1}
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-1.5 hover:h-2.5 rounded-lg appearance-none bg-white/20 accent-rose-500 transition-all cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #f43f5e ${(currentTime / (duration || 1)) * 100}%, rgba(255,255,255,0.2) 0%)`,
                  }}
                />
              </div>

              {/* Action Buttons Row */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  {/* Play / Pause */}
                  <button
                    type="button"
                    onClick={handleTogglePlay}
                    className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-all cursor-pointer active:scale-95"
                    title={isPlaying ? "Pause (Space)" : "Play (Space)"}
                  >
                    {isPlaying ? <Pause size={18} /> : <Play size={18} className="fill-white" />}
                  </button>

                  {/* Skip -10s / +10s */}
                  <button
                    type="button"
                    onClick={() => handleSkip(-10)}
                    className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-all cursor-pointer"
                    title="Rewind 10 seconds"
                  >
                    <RotateCcw size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSkip(10)}
                    className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-all cursor-pointer"
                    title="Forward 10 seconds"
                  >
                    <RotateCw size={16} />
                  </button>

                  {/* Volume Slider & Mute Toggle */}
                  <div className="flex items-center gap-1 group/vol">
                    <button
                      type="button"
                      onClick={handleToggleMute}
                      className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-all cursor-pointer"
                      title={isMuted ? "Unmute (M)" : "Mute (M)"}
                    >
                      {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="w-14 sm:w-20 h-1 bg-white/30 accent-rose-500 rounded-lg cursor-pointer"
                    />
                  </div>

                  {/* Time Tracker */}
                  <div className="text-[11px] font-mono text-neutral-300 font-semibold pl-1">
                    {formatSeconds(currentTime)} / {formatSeconds(duration)}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Speed Switcher Menu */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                      className="px-2 py-1 rounded-lg hover:bg-white/20 text-white text-xs font-bold font-mono transition-all cursor-pointer"
                    >
                      {playbackSpeed}x
                    </button>
                    {showSpeedMenu && (
                      <div className="absolute bottom-9 right-0 bg-[#0d143a] border border-indigo-500/40 rounded-xl p-1.5 shadow-2xl z-30 flex flex-col gap-1 min-w-[75px]">
                        {[0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => handleSpeedChange(s)}
                            className={`px-2 py-1 text-xs rounded-lg font-mono text-left font-bold ${
                              playbackSpeed === s ? "bg-rose-500 text-white" : "text-neutral-300 hover:bg-white/10"
                            }`}
                          >
                            {s}x
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Stream Quality Formats */}
                  {streamFormats.length > 0 && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowQualityMenu(!showQualityMenu)}
                        className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-all cursor-pointer text-xs flex items-center gap-1 font-semibold"
                        title="Stream Resolution"
                      >
                        <Settings size={15} />
                        <span className="hidden sm:inline">{selectedQuality}</span>
                      </button>
                      {showQualityMenu && (
                        <div className="absolute bottom-9 right-0 bg-[#0d143a] border border-indigo-500/40 rounded-xl p-1.5 shadow-2xl z-30 flex flex-col gap-1 min-w-[120px]">
                          {streamFormats.map((f, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => handleQualityChange(f)}
                              className="px-2.5 py-1 text-xs rounded-lg text-left font-semibold text-neutral-300 hover:bg-white/10 hover:text-white"
                            >
                              {f.quality || f.resolution} ({f.container || "mp4"})
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Theater Mode */}
                  <button
                    type="button"
                    onClick={() => setIsTheaterMode(!isTheaterMode)}
                    className={`p-1.5 rounded-lg hover:bg-white/20 text-white transition-all cursor-pointer ${
                      isTheaterMode ? "text-rose-400" : ""
                    }`}
                    title="Theater mode"
                  >
                    <Tv size={16} />
                  </button>

                  {/* Fullscreen */}
                  <button
                    type="button"
                    onClick={handleToggleFullscreen}
                    className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-all cursor-pointer"
                    title="Fullscreen (F)"
                  >
                    {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Video Details & Meta Info Card */}
      <div className="space-y-3 pt-2">
        <h1 className="text-lg sm:text-xl font-bold text-white leading-snug">
          {video.title}
        </h1>

        <div className="flex items-center justify-between gap-4 flex-wrap pb-1">
          {/* Channel Info & Subscribe Button */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#272727] overflow-hidden border border-white/5 shrink-0 flex items-center justify-center">
              {video.channelThumbnail ? (
                <img
                  src={video.channelThumbnail}
                  alt={video.channelTitle}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-white font-bold text-sm">
                  {(video.channelTitle || "Y")[0].toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white leading-tight">
                {video.channelTitle}
              </h2>
              <p className="text-xs text-neutral-400 font-normal">Official Channel</p>
            </div>
            <button
              type="button"
              className="ml-2 px-4 py-2 rounded-full bg-white hover:bg-neutral-200 text-black text-xs font-bold transition-colors cursor-pointer"
            >
              Subscribe
            </button>
          </div>

          {/* Save Action */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleFavorite}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                isSaved
                  ? "bg-red-600 text-white"
                  : "bg-[#272727] hover:bg-[#383838] text-white"
              }`}
            >
              <Heart size={14} className={isSaved ? "fill-white" : ""} />
              <span>{isSaved ? "Saved" : "Save"}</span>
            </button>
          </div>
        </div>

        {/* Expandable Description Box */}
        {video.description && (
          <div
            onClick={() => setShowFullDesc(!showFullDesc)}
            className="p-3.5 rounded-2xl bg-[#272727]/80 hover:bg-[#272727] transition-colors cursor-pointer space-y-1.5"
          >
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              {video.views && <span>{video.views}</span>}
              {video.views && video.publishedTime && <span>•</span>}
              {video.publishedTime && <span>{video.publishedTime}</span>}
            </div>
            <p
              className={`text-xs text-neutral-300 leading-relaxed whitespace-pre-line ${
                showFullDesc ? "" : "line-clamp-2"
              }`}
            >
              {video.description}
            </p>
            {video.description.length > 120 && (
              <span className="text-xs font-bold text-neutral-400 hover:text-white inline-block pt-0.5">
                {showFullDesc ? "Show less" : "...more"}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
