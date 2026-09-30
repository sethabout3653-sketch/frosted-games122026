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
  Music2,
} from "lucide-react";
import { useMusicPlayer } from "../context/MusicPlayerContext";
import { isVideoSaved, toggleSaveVideo } from "../lib/youtubeStorage";

interface MiniPlayerDockProps {
  onExpand?: () => void;
}

export default function MiniPlayerDock({ onExpand }: MiniPlayerDockProps) {
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
  } = useMusicPlayer();

  if (!currentTrack) return null;

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs <= 0) return "0:00";
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${mins}:${s < 10 ? "0" : ""}${s}`;
  };

  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const isSaved = isVideoSaved(currentTrack.id);

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPercent = parseFloat(e.target.value);
    if (duration > 0) {
      seek((newPercent / 100) * duration);
    }
  };

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 bg-[#0d0f18]/95 backdrop-blur-2xl border-t border-indigo-500/20 shadow-[0_-8px_32px_rgba(0,0,0,0.6)] px-4 sm:px-6 py-2.5 transition-all duration-300">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Left: Artwork, Track Details & Favorite */}
        <div className="flex items-center gap-3 min-w-0 w-1/4 sm:w-1/3">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl overflow-hidden bg-black/60 shrink-0 border border-white/10 relative shadow-md">
            <img
              src={currentTrack.thumbnail}
              alt={currentTrack.title}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            {isPlaying && (
              <div className="absolute inset-0 bg-indigo-500/20 backdrop-blur-[1px] flex items-center justify-center">
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h4 className="text-xs sm:text-sm font-bold text-white truncate leading-tight">
              {currentTrack.title}
            </h4>
            <p className="text-[11px] text-neutral-400 truncate mt-0.5 font-medium">
              {currentTrack.artist || currentTrack.channelTitle || "Audio Stream"}
            </p>
          </div>

          <button
            type="button"
            onClick={() => toggleSaveVideo(currentTrack)}
            className="hidden sm:flex p-1.5 rounded-lg text-neutral-400 hover:text-rose-400 transition-colors cursor-pointer shrink-0"
            title={isSaved ? "Saved to Favorites" : "Add to Favorites"}
          >
            <Heart size={16} className={isSaved ? "fill-rose-500 text-rose-500" : ""} />
          </button>
        </div>

        {/* Center: Controls & Scrubber */}
        <div className="flex flex-col items-center gap-1 flex-1 max-w-xl">
          {/* Audio Buttons */}
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={toggleShuffle}
              className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer hidden sm:block ${
                isShuffle ? "text-indigo-400" : "text-neutral-400 hover:text-white"
              }`}
              title="Shuffle"
            >
              <Shuffle size={15} />
            </button>

            <button
              type="button"
              onClick={prevTrack}
              className="p-1.5 rounded-lg text-neutral-300 hover:text-white transition-colors cursor-pointer"
              title="Previous Track"
            >
              <SkipBack size={18} />
            </button>

            <button
              type="button"
              onClick={togglePlay}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 transition-transform active:scale-95 cursor-pointer"
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
              className="p-1.5 rounded-lg text-neutral-300 hover:text-white transition-colors cursor-pointer"
              title="Next Track"
            >
              <SkipForward size={18} />
            </button>

            <button
              type="button"
              onClick={toggleRepeat}
              className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer hidden sm:block ${
                repeatMode !== "off" ? "text-indigo-400" : "text-neutral-400 hover:text-white"
              }`}
              title={`Repeat: ${repeatMode}`}
            >
              {repeatMode === "one" ? <Repeat1 size={15} /> : <Repeat size={15} />}
            </button>
          </div>

          {/* Time Scrubber */}
          <div className="w-full flex items-center gap-2 text-[10px] sm:text-xs font-mono text-neutral-400">
            <span className="w-9 text-right shrink-0">{formatTime(currentTime)}</span>
            <div className="relative flex-1 flex items-center group cursor-pointer">
              <input
                type="range"
                min={0}
                max={100}
                step={0.1}
                value={progressPercent}
                onChange={handleSeekChange}
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:bg-white/20 transition-all"
              />
            </div>
            <span className="w-9 text-left shrink-0">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Right: Volume & Extras */}
        <div className="flex items-center justify-end gap-3 w-1/4 sm:w-1/3">
          <div className="hidden md:flex items-center gap-2">
            <button
              type="button"
              onClick={toggleMute}
              className="text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-20 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
