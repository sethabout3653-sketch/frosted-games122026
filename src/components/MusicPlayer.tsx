import React, { useState } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  Volume1,
  Sliders,
  Heart,
  Disc,
  ArrowLeft,
  Share2,
  Check,
  Zap,
  Clock,
  Trash2,
  SlidersHorizontal,
} from "lucide-react";
import { useMusicPlayer, AudioTrack } from "../context/MusicPlayerContext";
import MusicVisualizer, { VisualizerMode } from "./MusicVisualizer";
import AudioEqualizerModal from "./AudioEqualizerModal";
import { isVideoSaved, toggleSaveVideo } from "../lib/youtubeStorage";

interface MusicPlayerProps {
  onBack?: () => void;
}

export default function MusicPlayer({ onBack }: MusicPlayerProps) {
  const {
    currentTrack,
    isPlaying,
    isBuffering,
    currentTime,
    duration,
    volume,
    isMuted,
    repeatMode,
    isShuffle,
    queue,
    togglePlay,
    seek,
    setVolume,
    toggleMute,
    toggleRepeat,
    toggleShuffle,
    nextTrack,
    prevTrack,
    removeFromQueue,
    playTrack,
    activePreset,
    bassBoost,
    sleepTimerRemaining,
  } = useMusicPlayer();

  const [activeTab, setActiveTab] = useState<"queue" | "visualizer">("queue");
  const [visualizerMode, setVisualizerMode] = useState<VisualizerMode>("spectrum");
  const [isEqOpen, setIsEqOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isSaved, setIsSaved] = useState(() => (currentTrack ? isVideoSaved(currentTrack.id) : false));

  if (!currentTrack) {
    return (
      <div
        style={{
          backgroundColor: "var(--theme-surface)",
          borderColor: "var(--theme-border-subtle)",
        }}
        className="w-full flex-1 flex flex-col items-center justify-center p-12 text-center space-y-4 border rounded-3xl"
      >
        <div
          style={{
            backgroundColor: "rgba(255,255,255,0.06)",
            color: "var(--theme-text-accent)",
          }}
          className="w-16 h-16 rounded-3xl flex items-center justify-center"
        >
          <Disc size={32} className="animate-spin" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-white">No Track Selected</h3>
          <p
            style={{ color: "var(--theme-text-muted)" }}
            className="text-xs"
          >
            Select any song from Discover or your collection to start listening.
          </p>
        </div>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            style={{
              backgroundColor: "var(--theme-accent)",
              color: "#ffffff",
            }}
            className="px-5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-md hover:opacity-90"
          >
            Browse Music
          </button>
        )}
      </div>
    );
  }

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs <= 0) return "0:00";
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${mins}:${s < 10 ? "0" : ""}${s}`;
  };

  const handleToggleFavorite = () => {
    toggleSaveVideo(currentTrack);
    setIsSaved(!isSaved);
  };

  const handleShare = () => {
    const url = currentTrack.permalinkUrl || currentTrack.mediaUrl || window.location.href;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 flex flex-col flex-1 animate-fadeIn">
      {/* Top Bar */}
      <div
        style={{ borderColor: "var(--theme-border-subtle)" }}
        className="flex items-center justify-between gap-4 pb-3 border-b"
      >
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              style={{
                backgroundColor: "var(--theme-surface)",
                borderColor: "var(--theme-border-subtle)",
                color: "var(--theme-text-accent)",
              }}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border hover:bg-white/10 text-xs font-semibold transition-colors cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>Back</span>
            </button>
          )}
          <span
            style={{ color: "var(--theme-text-muted)" }}
            className="text-xs font-medium"
          >
            Now Playing
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* EQ Button */}
          <button
            type="button"
            onClick={() => setIsEqOpen(true)}
            style={{
              backgroundColor: "var(--theme-surface)",
              borderColor: "var(--theme-border-subtle)",
              color: "var(--theme-text-accent)",
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border hover:bg-white/10 text-xs font-medium transition-colors cursor-pointer"
          >
            <SlidersHorizontal size={14} style={{ color: "var(--theme-accent)" }} />
            <span>Equalizer ({activePreset})</span>
          </button>

          {/* Share */}
          <button
            type="button"
            onClick={handleShare}
            style={{
              backgroundColor: "var(--theme-surface)",
              borderColor: "var(--theme-border-subtle)",
              color: "var(--theme-text-accent)",
            }}
            className="p-2 rounded-xl border hover:bg-white/10 transition-colors cursor-pointer"
            title="Share track"
          >
            {copiedLink ? <Check size={14} className="text-emerald-400" /> : <Share2 size={14} />}
          </button>
        </div>
      </div>

      {/* Main Console Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-start">
        {/* Left Column: Turntable & Playback Controls */}
        <div
          style={{
            backgroundColor: "var(--theme-surface)",
            borderColor: "var(--theme-border-subtle)",
          }}
          className="lg:col-span-7 border rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl relative overflow-hidden"
        >
          <div
            style={{ backgroundColor: "var(--theme-accent)" }}
            className="absolute -top-24 -left-24 w-80 h-80 rounded-full blur-3xl pointer-events-none opacity-15"
          />

          {/* Turntable Artwork */}
          <div className="relative flex flex-col items-center justify-center py-4 z-10">
            <div className="relative group">
              <div
                style={{
                  borderColor: "rgba(255,255,255,0.08)",
                  animationDuration: "14s",
                }}
                className={`w-60 h-60 sm:w-68 sm:h-68 rounded-full border-4 shadow-2xl overflow-hidden relative bg-black/90 flex items-center justify-center ${
                  isPlaying ? "animate-spin" : ""
                }`}
              >
                {/* Center Artwork */}
                <div
                  style={{ borderColor: "rgba(255,255,255,0.15)" }}
                  className="w-36 h-36 sm:w-40 sm:h-40 rounded-full overflow-hidden border-2 shadow-inner relative z-10 bg-neutral-900"
                >
                  <img
                    src={currentTrack.thumbnail}
                    alt={currentTrack.title}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div
                    style={{ backgroundColor: "var(--theme-surface)" }}
                    className="absolute inset-0 m-auto w-5 h-5 rounded-full border border-white/40 shadow-inner"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Title & Artist */}
          <div className="flex items-center justify-between gap-4 z-10 relative">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight truncate">
                {currentTrack.title}
              </h2>
              <p
                style={{ color: "var(--theme-text-muted)" }}
                className="text-sm font-medium truncate mt-0.5"
              >
                {currentTrack.artist || currentTrack.channelTitle || "Artist"}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleToggleFavorite}
                style={{
                  backgroundColor: "rgba(255,255,255,0.06)",
                  borderColor: "var(--theme-border-subtle)",
                }}
                className="p-3 rounded-2xl border text-neutral-300 hover:text-rose-400 transition-colors cursor-pointer"
                title={isSaved ? "Saved to Favorites" : "Save to Favorites"}
              >
                <Heart size={18} className={isSaved ? "fill-rose-500 text-rose-500" : ""} />
              </button>
            </div>
          </div>

          {/* Scrubber */}
          <div className="space-y-2 z-10 relative">
            <div className="relative group flex items-center">
              <input
                type="range"
                min="0"
                max={duration || 100}
                step="0.5"
                value={currentTime}
                onChange={(e) => seek(parseFloat(e.target.value))}
                style={{
                  accentColor: "var(--theme-accent)",
                }}
                className="w-full h-2 rounded-lg bg-white/10 cursor-pointer transition-all"
              />
            </div>

            <div
              style={{ color: "var(--theme-text-muted)" }}
              className="flex items-center justify-between text-xs font-mono tabular-nums"
            >
              <span>{formatTime(currentTime)}</span>
              <div className="flex items-center gap-2">
                {isBuffering && (
                  <span
                    style={{ color: "var(--theme-accent)" }}
                    className="text-[10px] uppercase font-bold animate-pulse"
                  >
                    Buffering...
                  </span>
                )}
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          </div>

          {/* Primary Controls */}
          <div className="flex items-center justify-between gap-2 z-10 relative pt-2">
            {/* Shuffle */}
            <button
              type="button"
              onClick={toggleShuffle}
              style={{
                backgroundColor: isShuffle ? "var(--theme-accent)" : "rgba(255,255,255,0.05)",
                color: isShuffle ? "#ffffff" : "var(--theme-text-muted)",
              }}
              className="p-3 rounded-2xl transition-colors cursor-pointer"
              title="Shuffle"
            >
              <Shuffle size={18} />
            </button>

            {/* Previous Track */}
            <button
              type="button"
              onClick={prevTrack}
              style={{
                backgroundColor: "rgba(255,255,255,0.05)",
                borderColor: "var(--theme-border-subtle)",
              }}
              className="p-3 rounded-2xl border text-neutral-200 hover:text-white transition-all cursor-pointer active:scale-95"
              title="Previous"
            >
              <SkipBack size={20} />
            </button>

            {/* Big Play / Pause */}
            <button
              type="button"
              onClick={togglePlay}
              style={{
                backgroundColor: "var(--theme-accent)",
                color: "#ffffff",
                boxShadow: "0 4px 24px var(--theme-border-strong)",
              }}
              className="w-16 h-16 rounded-3xl flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause size={26} className="fill-white" />
              ) : (
                <Play size={26} className="fill-white translate-x-0.5" />
              )}
            </button>

            {/* Next Track */}
            <button
              type="button"
              onClick={nextTrack}
              style={{
                backgroundColor: "rgba(255,255,255,0.05)",
                borderColor: "var(--theme-border-subtle)",
              }}
              className="p-3 rounded-2xl border text-neutral-200 hover:text-white transition-all cursor-pointer active:scale-95"
              title="Next"
            >
              <SkipForward size={20} />
            </button>

            {/* Repeat */}
            <button
              type="button"
              onClick={toggleRepeat}
              style={{
                backgroundColor: repeatMode !== "off" ? "var(--theme-accent)" : "rgba(255,255,255,0.05)",
                color: repeatMode !== "off" ? "#ffffff" : "var(--theme-text-muted)",
              }}
              className="p-3 rounded-2xl transition-colors cursor-pointer"
              title={`Repeat: ${repeatMode}`}
            >
              {repeatMode === "one" ? <Repeat1 size={18} /> : <Repeat size={18} />}
            </button>
          </div>

          {/* Volume Slider */}
          <div
            style={{ borderColor: "var(--theme-border-subtle)" }}
            className="flex items-center justify-between gap-4 pt-4 border-t text-xs z-10 relative"
          >
            <div className="flex items-center gap-2 flex-1 max-w-xs">
              <button
                type="button"
                onClick={toggleMute}
                style={{ color: "var(--theme-text-muted)" }}
                className="hover:text-white transition-colors cursor-pointer"
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
                min="0"
                max="100"
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(parseInt(e.target.value, 10))}
                style={{
                  accentColor: "var(--theme-accent)",
                }}
                className="flex-1 h-1.5 rounded-lg bg-white/10 cursor-pointer"
              />
              <span
                style={{ color: "var(--theme-text-muted)" }}
                className="font-mono text-[11px] tabular-nums w-8"
              >
                {isMuted ? "0%" : `${volume}%`}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {bassBoost > 0 && (
                <span
                  style={{ color: "var(--theme-text-accent)" }}
                  className="flex items-center gap-1 font-mono text-[11px]"
                >
                  <Zap size={12} /> Bass +{bassBoost}
                </span>
              )}
              {sleepTimerRemaining !== null && (
                <span
                  style={{ color: "var(--theme-accent)" }}
                  className="flex items-center gap-1 font-mono text-[11px]"
                >
                  <Clock size={12} /> {Math.ceil(sleepTimerRemaining / 60)}m
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Queue & Visualizer */}
        <div
          style={{
            backgroundColor: "var(--theme-surface)",
            borderColor: "var(--theme-border-subtle)",
          }}
          className="lg:col-span-5 border rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl flex flex-col h-full min-h-[500px]"
        >
          {/* Tab Header */}
          <div
            style={{ borderColor: "var(--theme-border-subtle)" }}
            className="flex items-center justify-between border-b pb-3"
          >
            <div
              style={{
                backgroundColor: "rgba(0,0,0,0.3)",
                borderColor: "var(--theme-border-subtle)",
              }}
              className="flex items-center gap-1 p-1 rounded-2xl border"
            >
              <button
                type="button"
                onClick={() => setActiveTab("queue")}
                style={{
                  backgroundColor: activeTab === "queue" ? "var(--theme-accent)" : "transparent",
                  color: activeTab === "queue" ? "#ffffff" : "var(--theme-text-muted)",
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              >
                Queue ({queue.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("visualizer")}
                style={{
                  backgroundColor: activeTab === "visualizer" ? "var(--theme-accent)" : "transparent",
                  color: activeTab === "visualizer" ? "#ffffff" : "var(--theme-text-muted)",
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              >
                Visualizer
              </button>
            </div>
          </div>

          {/* Queue Tab */}
          {activeTab === "queue" && (
            <div className="flex-1 flex flex-col space-y-2 overflow-y-auto max-h-[460px] custom-scrollbar pr-1">
              {queue.length === 0 ? (
                <div
                  style={{ color: "var(--theme-text-muted)" }}
                  className="p-12 text-center space-y-1"
                >
                  <Disc size={28} className="mx-auto text-neutral-500 mb-2" />
                  <p className="text-xs">Queue is empty</p>
                </div>
              ) : (
                queue.map((track, idx) => {
                  const isCurrent = track.id === currentTrack.id;
                  return (
                    <div
                      key={`${track.id}-${idx}`}
                      onClick={() => playTrack(track)}
                      style={{
                        backgroundColor: isCurrent ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.03)",
                        borderColor: isCurrent ? "var(--theme-border-strong)" : "var(--theme-border-subtle)",
                      }}
                      className="flex items-center justify-between gap-3 p-2.5 rounded-2xl border transition-all cursor-pointer group hover:bg-white/5"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-black/50 shrink-0 relative border border-white/10">
                          <img
                            src={track.thumbnail}
                            alt={track.title}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          {isCurrent && isPlaying && (
                            <div
                              style={{ backgroundColor: "var(--theme-accent)" }}
                              className="absolute inset-0 opacity-60 flex items-center justify-center"
                            >
                              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-white truncate leading-tight">
                            {track.title}
                          </h4>
                          <p
                            style={{ color: "var(--theme-text-muted)" }}
                            className="text-[11px] truncate mt-0.5"
                          >
                            {track.artist || track.channelTitle || "Artist"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {track.duration && (
                          <span
                            style={{ color: "var(--theme-text-muted)" }}
                            className="font-mono text-[11px] tabular-nums"
                          >
                            {track.duration}
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFromQueue(idx);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-neutral-400 hover:text-red-400 transition-opacity"
                          title="Remove"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Visualizer Tab */}
          {activeTab === "visualizer" && (
            <div className="flex-1 flex flex-col space-y-4">
              <div
                style={{
                  backgroundColor: "rgba(0,0,0,0.3)",
                  borderColor: "var(--theme-border-subtle)",
                }}
                className="flex items-center gap-1.5 p-1 rounded-xl border"
              >
                {(["spectrum", "waveform", "circular", "ambient"] as VisualizerMode[]).map((vMode) => (
                  <button
                    key={vMode}
                    type="button"
                    onClick={() => setVisualizerMode(vMode)}
                    style={{
                      backgroundColor: visualizerMode === vMode ? "rgba(255,255,255,0.15)" : "transparent",
                      color: visualizerMode === vMode ? "#ffffff" : "var(--theme-text-muted)",
                    }}
                    className="flex-1 py-1 text-[11px] font-semibold uppercase tracking-wider rounded-lg transition-colors capitalize"
                  >
                    {vMode}
                  </button>
                ))}
              </div>

              <div className="flex-1 min-h-[300px] rounded-2xl bg-black/60 border border-white/5 p-4 flex items-center justify-center relative overflow-hidden">
                <MusicVisualizer mode={visualizerMode} height={280} className="w-full h-full" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Equalizer Modal */}
      <AudioEqualizerModal isOpen={isEqOpen} onClose={() => setIsEqOpen(false)} />
    </div>
  );
}
