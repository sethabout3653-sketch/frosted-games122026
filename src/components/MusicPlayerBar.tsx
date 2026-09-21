import React from "react";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Heart,
  Maximize2,
  Disc3,
  X,
} from "lucide-react";
import { useMusic } from "../context/MusicContext";

function formatSeconds(secs: number): string {
  if (isNaN(secs) || secs < 0) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

export default function MusicPlayerBar() {
  const {
    currentTrack,
    isPlaying,
    togglePlay,
    nextTrack,
    prevTrack,
    playbackPosition,
    duration,
    seekTo,
    volume,
    setVolume,
    isMuted,
    toggleMute,
    isLiked,
    toggleLike,
    setIsExpandedPlayer,
    clearQueue,
  } = useMusic();

  if (!currentTrack) return null;

  const liked = isLiked(currentTrack.id);
  const progressPercent = duration > 0 ? Math.min(100, (playbackPosition / duration) * 100) : 0;

  return (
    <div
      id="music-persistent-player-bar"
      style={{
        backgroundColor: "rgba(14, 16, 24, 0.92)",
        borderColor: "var(--theme-border-subtle, rgba(255, 255, 255, 0.12))",
      }}
      className="fixed bottom-0 inset-x-0 z-40 border-t shadow-2xl backdrop-blur-xl transition-all duration-200 select-none"
    >
      {/* Top Thin Scrubbing Track Bar */}
      <div className="relative w-full h-1 group cursor-pointer bg-white/10 hover:h-2 transition-all">
        <div
          className="h-full bg-[var(--theme-accent,#6366f1)] transition-all duration-150 relative"
          style={{ width: `${progressPercent}%` }}
        >
          <span className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <input
          type="range"
          min={0}
          max={duration > 0 ? duration : 180}
          value={playbackPosition}
          onChange={(e) => seekTo(parseFloat(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3 sm:gap-6">
        {/* Left: Track Info & Vinyl Thumbnail */}
        <div className="flex items-center gap-3 min-w-0 max-w-[200px] sm:max-w-xs md:max-w-sm">
          <div
            onClick={() => setIsExpandedPlayer(true)}
            className="relative w-11 h-11 rounded-xl overflow-hidden shrink-0 cursor-pointer group shadow-md border border-white/10"
            title="Open Listening Lounge"
          >
            <img
              src={currentTrack.thumbnail}
              alt={currentTrack.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
              <Disc3 size={18} className={isPlaying ? "animate-spin" : ""} style={{ animationDuration: "4s" }} />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <h4
              onClick={() => setIsExpandedPlayer(true)}
              className="text-xs sm:text-sm font-bold text-white truncate cursor-pointer hover:text-[var(--theme-text-accent,#818cf8)] transition-colors leading-tight"
            >
              {currentTrack.title}
            </h4>
            <p className="text-[11px] text-neutral-400 truncate mt-0.5">
              {currentTrack.channelTitle || "YouTube Music"}
            </p>
          </div>

          <button
            type="button"
            onClick={() => toggleLike(currentTrack)}
            className="p-1.5 text-neutral-400 hover:text-white transition-colors cursor-pointer shrink-0"
            title={liked ? "Remove from Liked" : "Like Track"}
          >
            <Heart size={16} className={liked ? "fill-red-400 text-red-400" : ""} />
          </button>
        </div>

        {/* Center: Playback Controls */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              type="button"
              onClick={prevTrack}
              className="p-1.5 sm:p-2 text-neutral-300 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
              title="Previous Track"
            >
              <SkipBack size={17} />
            </button>

            <button
              type="button"
              onClick={togglePlay}
              style={{
                backgroundColor: "var(--theme-accent, #6366f1)",
              }}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer ring-1 ring-white/20"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause size={17} className="fill-white" /> : <Play size={17} className="fill-white ml-0.5" />}
            </button>

            <button
              type="button"
              onClick={nextTrack}
              className="p-1.5 sm:p-2 text-neutral-300 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
              title="Next Track"
            >
              <SkipForward size={17} />
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono text-neutral-400">
            <span>{formatSeconds(playbackPosition)}</span>
            <span>/</span>
            <span>{formatSeconds(duration)}</span>
          </div>
        </div>

        {/* Right: Volume & Expand */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="hidden md:flex items-center gap-1.5 w-28">
            <button
              type="button"
              onClick={toggleMute}
              className="p-1 text-neutral-400 hover:text-white transition-colors cursor-pointer"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted || volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[var(--theme-accent,#6366f1)]"
            />
          </div>

          <button
            type="button"
            onClick={() => setIsExpandedPlayer(true)}
            className="p-2 text-neutral-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            title="Open Listening Lounge (Vibe & Queue)"
          >
            <Maximize2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
