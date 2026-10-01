import React from "react";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Heart,
  Repeat,
  Repeat1,
  Shuffle,
  Maximize2,
  Download,
} from "lucide-react";
import { useMusic } from "../context/MusicContext";

interface MusicDockProps {
  onExpand?: () => void;
}

export default function MusicDock({ onExpand }: MusicDockProps) {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    togglePlay,
    nextTrack,
    prevTrack,
    seek,
    volume,
    isMuted,
    setVolume,
    toggleMute,
    repeatMode,
    toggleRepeat,
    isShuffle,
    toggleShuffle,
    toggleFavorite,
    isFavorite,
    toggleFullPlayer,
  } = useMusic();

  if (!currentTrack) return null;

  const handleExpandClick = () => {
    toggleFullPlayer(onExpand);
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs <= 0) return "0:00";
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${mins}:${s < 10 ? "0" : ""}${s}`;
  };

  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const fav = isFavorite(currentTrack.id);

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPercent = parseFloat(e.target.value);
    if (duration > 0) {
      seek((newPercent / 100) * duration);
    }
  };

  return (
    <div
      style={{
        backgroundColor: "var(--theme-chat-rail)",
        borderColor: "var(--theme-border-strong)",
      }}
      className="fixed bottom-0 inset-x-0 z-50 backdrop-blur-2xl border-t shadow-[0_-8px_32px_rgba(0,0,0,0.6)] px-4 sm:px-6 py-2.5 transition-all duration-300"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Left: Artwork, Track Info & Favorite */}
        <div
          onClick={handleExpandClick}
          className="flex items-center gap-3 min-w-0 w-1/4 sm:w-1/3 cursor-pointer group"
        >
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl overflow-hidden bg-black/60 shrink-0 border border-white/10 relative shadow-md">
            <img
              src={currentTrack.thumbnail}
              alt={currentTrack.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              referrerPolicy="no-referrer"
            />
            {isPlaying && (
              <div
                style={{ backgroundColor: "var(--theme-accent)" }}
                className="absolute inset-0 opacity-40 backdrop-blur-[1px] flex items-center justify-center"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h4 className="text-xs sm:text-sm font-bold text-white truncate leading-tight group-hover:underline">
              {currentTrack.title}
            </h4>
            <div className="flex items-center gap-2 mt-0.5">
              <p
                style={{ color: "var(--theme-text-muted)" }}
                className="text-[11px] truncate font-medium"
              >
                {currentTrack.artist}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(currentTrack);
            }}
            className="hidden sm:flex p-1.5 rounded-lg text-neutral-400 hover:text-rose-400 transition-colors cursor-pointer shrink-0"
            title={fav ? "Saved" : "Favorite"}
          >
            <Heart size={16} className={fav ? "fill-rose-500 text-rose-500" : ""} />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const url = `/api/music/download?id=${encodeURIComponent(currentTrack.youtubeId || currentTrack.id)}&title=${encodeURIComponent(currentTrack.title || "")}&artist=${encodeURIComponent(currentTrack.artist || "")}`;
              window.open(url, "_blank");
            }}
            className="hidden sm:flex p-1.5 rounded-lg text-neutral-400 hover:text-cyan-400 transition-colors cursor-pointer shrink-0"
            title="Download Track (.mp3)"
          >
            <Download size={16} />
          </button>
        </div>

        {/* Center: Controls & Scrubber */}
        <div className="flex flex-col items-center gap-1 flex-1 max-w-xl">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={toggleShuffle}
              style={{
                color: isShuffle ? "var(--theme-accent)" : "var(--theme-text-muted)",
              }}
              className="p-1.5 rounded-lg text-xs transition-colors cursor-pointer hidden sm:block hover:text-white"
              title="Shuffle"
            >
              <Shuffle size={15} />
            </button>

            <button
              type="button"
              onClick={prevTrack}
              className="p-1.5 rounded-lg text-neutral-300 hover:text-white transition-colors cursor-pointer active:scale-95"
              title="Previous"
            >
              <SkipBack size={18} />
            </button>

            <button
              type="button"
              onClick={togglePlay}
              style={{
                backgroundColor: "var(--theme-accent)",
                color: "#ffffff",
                boxShadow: "0 2px 14px var(--theme-border-strong)",
              }}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-transform active:scale-95 cursor-pointer hover:opacity-90"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause size={18} className="fill-white" />
              ) : (
                <Play size={18} className="fill-white translate-x-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={nextTrack}
              className="p-1.5 rounded-lg text-neutral-300 hover:text-white transition-colors cursor-pointer active:scale-95"
              title="Next"
            >
              <SkipForward size={18} />
            </button>

            <button
              type="button"
              onClick={toggleRepeat}
              style={{
                color: repeatMode !== "off" ? "var(--theme-accent)" : "var(--theme-text-muted)",
              }}
              className="p-1.5 rounded-lg text-xs transition-colors cursor-pointer hidden sm:block hover:text-white"
              title={`Repeat: ${repeatMode}`}
            >
              {repeatMode === "one" ? <Repeat1 size={15} /> : <Repeat size={15} />}
            </button>
          </div>

          <div
            style={{ color: "var(--theme-text-muted)" }}
            className="w-full flex items-center gap-2 text-[10px] sm:text-xs font-mono"
          >
            <span className="w-9 text-right shrink-0">{formatTime(currentTime)}</span>
            <div className="relative flex-1 flex items-center group cursor-pointer">
              <input
                type="range"
                min={0}
                max={100}
                step={0.1}
                value={progressPercent}
                onChange={handleSeekChange}
                style={{
                  accentColor: "var(--theme-accent)",
                }}
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer hover:bg-white/20 transition-all"
              />
            </div>
            <span className="w-9 text-left shrink-0">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Right: Volume & Expand */}
        <div className="flex items-center justify-end gap-3 w-1/4 sm:w-1/3">
          <div className="hidden md:flex items-center gap-2">
            <button
              type="button"
              onClick={toggleMute}
              style={{ color: "var(--theme-text-muted)" }}
              className="hover:text-white transition-colors cursor-pointer"
            >
              {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              style={{
                accentColor: "var(--theme-accent)",
              }}
              className="w-20 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {onExpand && (
            <button
              type="button"
              onClick={handleExpandClick}
              style={{
                color: "var(--theme-text-accent)",
                backgroundColor: "rgba(255,255,255,0.06)",
              }}
              className="p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer text-xs font-semibold flex items-center gap-1"
              title="Expand Music Player"
            >
              <Maximize2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
