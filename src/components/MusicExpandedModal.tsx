import React, { useState, useEffect } from "react";
import {
  X,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Repeat,
  Shuffle,
  Volume2,
  VolumeX,
  Heart,
  ListMusic,
  Disc3,
  Sparkles,
  ExternalLink,
  Clock,
  Radio,
  Trash2,
} from "lucide-react";
import { useMusic } from "../context/MusicContext";

function formatSeconds(secs: number): string {
  if (isNaN(secs) || secs < 0) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

export default function MusicExpandedModal() {
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
    repeatMode,
    toggleRepeat,
    isShuffle,
    toggleShuffle,
    isLiked,
    toggleLike,
    queue,
    queueIndex,
    playQueueIndex,
    removeFromQueue,
    isExpandedPlayer,
    setIsExpandedPlayer,
  } = useMusic();

  const [activeTab, setActiveTab] = useState<"vibe" | "queue" | "info">("vibe");

  if (!isExpandedPlayer || !currentTrack) return null;

  const liked = isLiked(currentTrack.id);
  const progressPercent = duration > 0 ? Math.min(100, (playbackPosition / duration) * 100) : 0;

  return (
    <div
      id="music-expanded-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 backdrop-blur-2xl bg-black/85 transition-all duration-300 animate-in fade-in"
    >
      {/* Dynamic Ambient Blur Glow behind the player */}
      <div
        className="absolute -inset-10 opacity-30 blur-3xl pointer-events-none transition-all duration-700"
        style={{
          backgroundImage: `radial-gradient(circle at center, var(--theme-accent, #6366f1) 0%, transparent 70%)`,
        }}
      />

      <div
        style={{
          backgroundColor: "rgba(18, 18, 24, 0.95)",
          borderColor: "var(--theme-border-subtle, rgba(255, 255, 255, 0.12))",
        }}
        className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border shadow-2xl shadow-black/80 overflow-hidden ring-1 ring-white/10"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-white/5 border border-white/10 text-[var(--theme-text-accent,#818cf8)]">
              <Disc3 size={20} className={isPlaying ? "animate-spin" : ""} style={{ animationDuration: "6s" }} />
            </span>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
                <span>Listening Lounge</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30">
                  {isPlaying ? "Playing" : "Paused"}
                </span>
              </h3>
              <p className="text-xs text-neutral-400 truncate max-w-[280px] sm:max-w-md">
                {currentTrack.channelTitle || "YouTube Music"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab switchers: Vibe / Queue / Details */}
            <div className="flex p-1 bg-white/5 rounded-xl border border-white/5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab("vibe")}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeTab === "vibe" ? "bg-white/15 text-white" : "text-neutral-400 hover:text-white"
                }`}
              >
                Vibe
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("queue")}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "queue" ? "bg-white/15 text-white" : "text-neutral-400 hover:text-white"
                }`}
              >
                <span>Queue</span>
                {queue.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px]">
                    {queue.length}
                  </span>
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsExpandedPlayer(false)}
              className="p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              title="Close expanded view"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col md:flex-row gap-8 items-center justify-center min-h-[360px]">
          {activeTab === "vibe" && (
            <>
              {/* Spinning Vinyl Album Record Art */}
              <div className="relative flex items-center justify-center shrink-0 w-64 h-64 sm:w-80 sm:h-80 select-none">
                {/* Vinyl Disc Body */}
                <div
                  className={`w-full h-full rounded-full bg-gradient-to-tr from-neutral-950 via-neutral-900 to-neutral-950 border-4 border-neutral-800 shadow-2xl flex items-center justify-center relative overflow-hidden transition-transform duration-700 ${
                    isPlaying ? "rotate-animation" : ""
                  }`}
                  style={{
                    boxShadow: "0 0 40px rgba(0,0,0,0.8), inset 0 0 25px rgba(255,255,255,0.05)",
                    animation: isPlaying ? "spin 12s linear infinite" : "none",
                  }}
                >
                  {/* Subtle Vinyl Grooves */}
                  <div className="absolute inset-4 rounded-full border border-white/5 pointer-events-none" />
                  <div className="absolute inset-8 rounded-full border border-white/5 pointer-events-none" />
                  <div className="absolute inset-12 rounded-full border border-white/5 pointer-events-none" />
                  <div className="absolute inset-16 rounded-full border border-white/10 pointer-events-none" />

                  {/* Album Artwork Center Sticker */}
                  <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full overflow-hidden border-4 border-neutral-900 relative shadow-inner">
                    <img
                      src={currentTrack.thumbnail}
                      alt={currentTrack.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    {/* Center spindle hole */}
                    <div className="absolute inset-0 m-auto w-5 h-5 rounded-full bg-neutral-950 border-2 border-neutral-600 shadow-inner" />
                  </div>
                </div>

                {/* Subtle needle arm simulation indicator */}
                <div
                  className={`absolute -top-3 -right-2 w-16 h-28 pointer-events-none transition-transform duration-500 origin-top-right ${
                    isPlaying ? "rotate-6" : "-rotate-12 opacity-70"
                  }`}
                >
                  <div className="w-2.5 h-20 bg-gradient-to-b from-neutral-300 to-neutral-500 rounded-full shadow-lg m-auto" />
                  <div className="w-5 h-6 bg-amber-400 rounded-sm shadow-md mt-1 mx-auto" />
                </div>
              </div>

              {/* Track Details & Visualizer Bars */}
              <div className="flex-1 w-full flex flex-col justify-center space-y-5 text-center md:text-left">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-[var(--theme-text-accent,#818cf8)] mb-3">
                    <Sparkles size={13} />
                    <span>Now Streaming</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-white leading-tight line-clamp-2">
                    {currentTrack.title}
                  </h2>
                  <p className="text-sm font-medium text-neutral-300 mt-1">
                    {currentTrack.channelTitle || "YouTube Creator"}
                  </p>
                  {currentTrack.views && (
                    <p className="text-xs text-neutral-500 mt-1 flex items-center justify-center md:justify-start gap-1.5">
                      <Radio size={12} />
                      <span>{currentTrack.views}</span>
                      {currentTrack.publishedTime && (
                        <>
                          <span>&bull;</span>
                          <span>{currentTrack.publishedTime}</span>
                        </>
                      )}
                    </p>
                  )}
                </div>

                {/* Animated Organic Audio Wave Bars */}
                <div className="flex items-end justify-center md:justify-start gap-1 h-12 py-1 px-1">
                  {[24, 45, 78, 92, 60, 35, 80, 100, 70, 40, 85, 95, 60, 40, 75, 90, 50, 30].map(
                    (height, idx) => (
                      <span
                        key={idx}
                        className="w-1.5 rounded-full transition-all duration-300"
                        style={{
                          height: isPlaying ? `${Math.max(15, (height * (0.6 + ((idx % 3) * 0.2))))}%` : "15%",
                          backgroundColor:
                            idx % 2 === 0
                              ? "var(--theme-accent, #6366f1)"
                              : "var(--theme-text-accent, #818cf8)",
                          opacity: isPlaying ? 0.9 : 0.25,
                          animation: isPlaying
                            ? `pulse ${(0.6 + (idx % 5) * 0.15).toFixed(2)}s ease-in-out infinite alternate`
                            : "none",
                        }}
                      />
                    )
                  )}
                </div>

                {/* Quick actions: Like & YouTube Open */}
                <div className="flex items-center justify-center md:justify-start gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => toggleLike(currentTrack)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      liked
                        ? "bg-red-500/20 text-red-400 border-red-500/40 shadow-sm"
                        : "bg-white/5 text-neutral-300 border-white/10 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    <Heart size={15} className={liked ? "fill-red-400 text-red-400" : ""} />
                    <span>{liked ? "Saved to Favorites" : "Save Track"}</span>
                  </button>

                  <a
                    href={`https://www.youtube.com/watch?v=${currentTrack.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white border border-white/10 text-xs font-medium transition-colors"
                  >
                    <span>YouTube</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            </>
          )}

          {activeTab === "queue" && (
            <div className="w-full h-full flex flex-col space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                  Up Next ({queue.length})
                </span>
                <span className="text-xs text-neutral-500">
                  Click any track to jump
                </span>
              </div>

              {queue.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-12 text-center text-neutral-400">
                  <ListMusic size={36} className="text-neutral-600 mb-2" />
                  <p className="text-sm font-medium">Queue is currently empty</p>
                  <p className="text-xs text-neutral-500 mt-1">
                    Add tracks from the music tab to keep the session rolling!
                  </p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto max-h-[320px] space-y-1.5 pr-2">
                  {queue.map((t, idx) => {
                    const isCurrent = idx === queueIndex;
                    return (
                      <div
                        key={`${t.id}-${idx}`}
                        onClick={() => playQueueIndex(idx)}
                        className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                          isCurrent
                            ? "bg-white/10 border-[var(--theme-accent,#6366f1)] text-white shadow-md"
                            : "bg-white/5 border-transparent hover:bg-white/10 text-neutral-300"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xs font-mono font-semibold text-neutral-500 w-5 text-right">
                            {idx + 1}
                          </span>
                          <img
                            src={t.thumbnail}
                            alt={t.title}
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 rounded-lg object-cover shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate">{t.title}</p>
                            <p className="text-[11px] text-neutral-400 truncate">
                              {t.channelTitle || "YouTube"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 ml-3">
                          {t.duration && (
                            <span className="text-[11px] text-neutral-400 font-mono">
                              {t.duration}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFromQueue(idx);
                            }}
                            className="p-1 text-neutral-500 hover:text-red-400 transition-colors"
                            title="Remove from queue"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Bottom Controls Deck */}
        <div className="p-6 bg-black/40 border-t border-white/10 shrink-0 space-y-4">
          {/* Seek Bar */}
          <div className="space-y-1.5">
            <div className="relative group cursor-pointer">
              <input
                type="range"
                min={0}
                max={duration > 0 ? duration : 180}
                value={playbackPosition}
                onChange={(e) => seekTo(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[var(--theme-accent,#6366f1)] hover:h-2 transition-all"
              />
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400">
              <span>{formatSeconds(playbackPosition)}</span>
              <span>{formatSeconds(duration)}</span>
            </div>
          </div>

          {/* Primary Transport Buttons */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* Left Options: Shuffle & Repeat */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleShuffle}
                className={`p-2 rounded-xl transition-colors cursor-pointer ${
                  isShuffle ? "text-[var(--theme-text-accent,#818cf8)] bg-white/10" : "text-neutral-400 hover:text-white"
                }`}
                title="Shuffle Queue"
              >
                <Shuffle size={17} />
              </button>
              <button
                type="button"
                onClick={toggleRepeat}
                className={`p-2 rounded-xl transition-colors cursor-pointer relative ${
                  repeatMode !== "off"
                    ? "text-[var(--theme-text-accent,#818cf8)] bg-white/10"
                    : "text-neutral-400 hover:text-white"
                }`}
                title={`Repeat: ${repeatMode}`}
              >
                <Repeat size={17} />
                {repeatMode === "one" && (
                  <span className="absolute top-1 right-1 text-[9px] font-bold text-white bg-indigo-600 rounded-full px-1">
                    1
                  </span>
                )}
              </button>
            </div>

            {/* Center Controls: Prev / Big Play-Pause / Next */}
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={prevTrack}
                className="p-3 text-neutral-300 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                title="Previous Track"
              >
                <SkipBack size={22} />
              </button>

              <button
                type="button"
                onClick={togglePlay}
                style={{
                  backgroundColor: "var(--theme-accent, #6366f1)",
                }}
                className="w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl shadow-indigo-950/60 hover:scale-105 active:scale-95 transition-all cursor-pointer ring-2 ring-white/20"
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause size={24} className="fill-white" /> : <Play size={24} className="fill-white ml-0.5" />}
              </button>

              <button
                type="button"
                onClick={nextTrack}
                className="p-3 text-neutral-300 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                title="Next Track"
              >
                <SkipForward size={22} />
              </button>
            </div>

            {/* Right Controls: Volume Slider */}
            <div className="flex items-center gap-2 w-32 sm:w-40">
              <button
                type="button"
                onClick={toggleMute}
                className="p-2 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted || volume === 0 ? <VolumeX size={17} /> : <Volume2 size={17} />}
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
          </div>
        </div>
      </div>
    </div>
  );
}
