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
  Terminal,
  Heart,
  ListMusic,
  Disc,
  ArrowLeft,
  Share2,
  Check,
  Zap,
  Clock,
  Sparkles,
  Download,
  Info,
  Radio,
  Plus,
  Trash2,
} from "lucide-react";
import { useMusicPlayer, AudioTrack } from "../context/MusicPlayerContext";
import MusicVisualizer, { VisualizerMode } from "./MusicVisualizer";
import AudioEqualizerModal from "./AudioEqualizerModal";
import YtDlpPipelineDrawer from "./YtDlpPipelineDrawer";
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
    playbackRate,
    repeatMode,
    isShuffle,
    queue,
    queueIndex,
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
    customPlaylists,
    addTrackToPlaylist,
    createCustomPlaylist,
  } = useMusicPlayer();

  const [activeTab, setActiveTab] = useState<"queue" | "visualizer" | "info">("queue");
  const [visualizerMode, setVisualizerMode] = useState<VisualizerMode>("spectrum");
  const [isEqOpen, setIsEqOpen] = useState(false);
  const [isPipelineOpen, setIsPipelineOpen] = useState(false);
  const [isVinylSpinning, setIsVinylSpinning] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isSaved, setIsSaved] = useState(() => (currentTrack ? isVideoSaved(currentTrack.id) : false));
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");

  if (!currentTrack) {
    return (
      <div className="w-full flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
        <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center text-neutral-400">
          <Disc size={40} className="animate-spin" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-white">No Track Selected</h3>
          <p className="text-xs text-neutral-400">Select any track from the library or radio stations to begin streaming.</p>
        </div>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            Browse Library
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
    const url = currentTrack.mediaUrl || window.location.href;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 space-y-6 flex flex-col flex-1 animate-fadeIn">
      {/* Top Bar with Back and Quick Actions */}
      <div className="flex items-center justify-between gap-4 pb-3 border-b border-white/5">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-neutral-300 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>Back</span>
            </button>
          )}
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <span className="text-indigo-400 font-bold uppercase tracking-wider text-[10px] bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
              Audio Stream
            </span>
            <span>&bull;</span>
            <span className="font-mono text-[11px]">
              {currentTrack.sourceType ? String(currentTrack.sourceType).toUpperCase() : "SOUNDCLOUD"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Share */}
          <button
            type="button"
            onClick={handleShare}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 hover:text-white transition-colors cursor-pointer"
            title="Share track"
          >
            {copiedLink ? <Check size={14} className="text-emerald-400" /> : <Share2 size={14} />}
          </button>
        </div>
      </div>

      {/* Main Studio Console Layout (2-Column Desktop Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-start">
        {/* Left Column: Artwork Deck, Ambient Halo, Scrubber & Primary Audio Controls */}
        <div className="lg:col-span-7 bg-[#10131d] border border-white/10 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden">
          {/* Background Ambient Glow derived from art */}
          <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-indigo-600/15 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-pink-600/10 blur-3xl pointer-events-none" />

          {/* Turntable / Album Deck View */}
          <div className="relative flex flex-col items-center justify-center py-4 z-10">
            <div className="relative group">
              {/* Vinyl Disc Backdrop */}
              <div
                className={`w-64 h-64 sm:w-72 sm:h-72 rounded-full border-4 border-[#1a1d2b] shadow-2xl overflow-hidden relative bg-black flex items-center justify-center ${
                  isPlaying && isVinylSpinning ? "animate-spin" : ""
                }`}
                style={{ animationDuration: "12s" }}
              >
                {/* Vinyl Grooves Texture */}
                <div className="absolute inset-0 rounded-full border border-white/5" />
                <div className="absolute inset-4 rounded-full border border-white/5" />
                <div className="absolute inset-8 rounded-full border border-white/5" />
                <div className="absolute inset-12 rounded-full border border-white/5" />

                {/* Center Album Artwork */}
                <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-full overflow-hidden border-2 border-white/20 shadow-inner relative z-10 bg-neutral-900">
                  <img
                    src={currentTrack.thumbnail}
                    alt={currentTrack.title}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  {/* Center Spindle Hole */}
                  <div className="absolute inset-0 m-auto w-6 h-6 rounded-full bg-[#10131d] border-2 border-white/40 shadow-inner" />
                </div>
              </div>

              {/* Tonearm Simulation (Decorative Clean Studio Detail) */}
              <div className="absolute -top-3 -right-6 w-12 h-28 pointer-events-none opacity-40 hidden sm:block">
                <div className="w-3 h-3 rounded-full bg-white/40 border border-white/60 mx-auto" />
                <div className="w-1 h-20 bg-gradient-to-b from-white/60 to-white/20 mx-auto rotate-12 origin-top" />
              </div>
            </div>
          </div>

          {/* Track Title & Artist Details */}
          <div className="flex items-center justify-between gap-4 z-10 relative">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight truncate">
                {currentTrack.title}
              </h2>
              <p className="text-sm text-neutral-400 font-medium truncate mt-0.5">
                {currentTrack.artist || currentTrack.channelTitle || "Unknown Artist"}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleToggleFavorite}
                className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 hover:text-rose-400 transition-colors cursor-pointer"
                title={isSaved ? "Saved to Favorites" : "Add to Favorites"}
              >
                <Heart size={18} className={isSaved ? "fill-rose-500 text-rose-500" : ""} />
              </button>
            </div>
          </div>

          {/* Scrubber Progress Bar */}
          <div className="space-y-2 z-10 relative">
            <div className="relative group flex items-center">
              <input
                type="range"
                min="0"
                max={duration || 100}
                step="0.5"
                value={currentTime}
                onChange={(e) => seek(parseFloat(e.target.value))}
                className="w-full h-2 rounded-lg bg-white/10 accent-indigo-500 cursor-pointer transition-all"
              />
            </div>

            <div className="flex items-center justify-between text-xs font-mono tabular-nums text-neutral-400">
              <span>{formatTime(currentTime)}</span>
              <div className="flex items-center gap-2">
                {isBuffering && (
                  <span className="text-indigo-400 text-[10px] uppercase font-bold animate-pulse">
                    Buffering Stream...
                  </span>
                )}
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          </div>

          {/* Primary Audio Transport Controls */}
          <div className="flex items-center justify-between gap-2 z-10 relative pt-2">
            {/* Shuffle */}
            <button
              type="button"
              onClick={toggleShuffle}
              className={`p-3 rounded-2xl border transition-colors cursor-pointer ${
                isShuffle
                  ? "bg-indigo-600/30 border-indigo-500/50 text-indigo-400"
                  : "bg-white/5 border-white/5 text-neutral-400 hover:text-white"
              }`}
              title="Shuffle queue"
            >
              <Shuffle size={18} />
            </button>

            {/* Previous Track */}
            <button
              type="button"
              onClick={prevTrack}
              className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-200 hover:text-white transition-all cursor-pointer active:scale-95"
              title="Previous Track"
            >
              <SkipBack size={20} />
            </button>

            {/* Big Play / Pause Button */}
            <button
              type="button"
              onClick={togglePlay}
              className="w-16 h-16 rounded-3xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-xl shadow-indigo-600/40 transition-all cursor-pointer hover:scale-105 active:scale-95"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause size={28} className="fill-white" />
              ) : (
                <Play size={28} className="fill-white translate-x-0.5" />
              )}
            </button>

            {/* Next Track */}
            <button
              type="button"
              onClick={nextTrack}
              className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-200 hover:text-white transition-all cursor-pointer active:scale-95"
              title="Next Track"
            >
              <SkipForward size={20} />
            </button>

            {/* Repeat Mode */}
            <button
              type="button"
              onClick={toggleRepeat}
              className={`p-3 rounded-2xl border transition-colors cursor-pointer ${
                repeatMode !== "off"
                  ? "bg-indigo-600/30 border-indigo-500/50 text-indigo-400"
                  : "bg-white/5 border-white/5 text-neutral-400 hover:text-white"
              }`}
              title={`Repeat: ${repeatMode}`}
            >
              {repeatMode === "one" ? <Repeat1 size={18} /> : <Repeat size={18} />}
            </button>
          </div>

          {/* Volume Slider & DSP status bar */}
          <div className="flex items-center justify-between gap-4 pt-4 border-t border-white/5 text-xs text-neutral-400 z-10 relative">
            <div className="flex items-center gap-2 flex-1 max-w-xs">
              <button
                type="button"
                onClick={toggleMute}
                className="text-neutral-400 hover:text-white transition-colors cursor-pointer"
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
                className="flex-1 h-1.5 rounded-lg bg-white/10 accent-indigo-500 cursor-pointer"
              />
              <span className="font-mono text-[11px] tabular-nums w-8">
                {isMuted ? "0%" : `${volume}%`}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {bassBoost > 0 && (
                <span className="flex items-center gap-1 text-indigo-400 font-mono text-[11px]">
                  <Zap size={12} /> Bass +{bassBoost}
                </span>
              )}
              {sleepTimerRemaining !== null && (
                <span className="flex items-center gap-1 text-purple-400 font-mono text-[11px]">
                  <Clock size={12} /> {Math.ceil(sleepTimerRemaining / 60)}m
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Active Queue, Custom Playlists & Stream Architecture Specs */}
        <div className="lg:col-span-5 bg-[#10131d] border border-white/10 rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl flex flex-col h-full min-h-[500px]">
          {/* Tab Bar */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-1 p-1 bg-black/40 rounded-2xl border border-white/5">
              <button
                type="button"
                onClick={() => setActiveTab("queue")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "queue"
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Queue ({queue.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("info")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "info"
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Stream Details
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsPipelineOpen(true)}
              className="text-xs text-neutral-400 hover:text-emerald-400 transition-colors flex items-center gap-1"
            >
              <Terminal size={12} />
              <span>CLI Spec</span>
            </button>
          </div>

          {/* Queue Tab Content */}
          {activeTab === "queue" && (
            <div className="flex-1 flex flex-col space-y-2 overflow-y-auto max-h-[460px] custom-scrollbar pr-1">
              {queue.map((track, idx) => {
                const isCurrent = track.id === currentTrack.id;
                return (
                  <div
                    key={`${track.id}-${idx}`}
                    onClick={() => playTrack(track)}
                    className={`flex items-center justify-between gap-3 p-2.5 rounded-2xl border transition-all cursor-pointer group ${
                      isCurrent
                        ? "bg-indigo-600/20 border-indigo-500/40 text-white shadow-md"
                        : "bg-white/5 border-white/5 hover:bg-white/10 text-neutral-300"
                    }`}
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
                          <div className="absolute inset-0 bg-indigo-900/60 flex items-center justify-center">
                            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4
                          className={`text-xs font-bold truncate leading-tight ${
                            isCurrent ? "text-indigo-300" : "text-white"
                          }`}
                        >
                          {track.title}
                        </h4>
                        <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                          {track.artist || track.channelTitle || "Audio Stream"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {track.duration && (
                        <span className="font-mono text-[11px] text-neutral-400 tabular-nums">
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

          {/* Info Tab Content */}
          {activeTab === "info" && (
            <div className="flex-1 space-y-4 text-xs text-neutral-300 overflow-y-auto">
              <div className="bg-black/30 p-4 rounded-2xl border border-white/5 space-y-2">
                <span className="font-bold text-white uppercase text-[10px] tracking-wider text-indigo-400">
                  Audio Stream Engine
                </span>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-neutral-500">Source:</span>{" "}
                    <strong className="text-white">{currentTrack.sourceType || "Direct Audio"}</strong>
                  </div>
                  <div>
                    <span className="text-neutral-500">Processing:</span>{" "}
                    <strong className="text-white">Web Audio 10-Band DSP</strong>
                  </div>
                  <div>
                    <span className="text-neutral-500">Sample Rate:</span>{" "}
                    <strong className="text-white">48,000 Hz Hi-Fi</strong>
                  </div>
                  <div>
                    <span className="text-neutral-500">Mode:</span>{" "}
                    <strong className="text-white">High Quality Audio Playback</strong>
                  </div>
                </div>
              </div>

              <div className="bg-black/30 p-4 rounded-2xl border border-white/5 space-y-2">
                <span className="font-bold text-white uppercase text-[10px] tracking-wider text-emerald-400">
                  Audio Stream Engine
                </span>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  High performance SoundCloud audio playback with smooth seeking and offline caching.
                </p>
                <div className="p-2 bg-black/60 rounded-xl font-mono text-[10px] text-emerald-300 overflow-x-auto">
                  yt-dlp -x --audio-format mp3 --download-archive archive.txt &quot;{currentTrack.id}&quot;
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <AudioEqualizerModal isOpen={isEqOpen} onClose={() => setIsEqOpen(false)} />
      <YtDlpPipelineDrawer isOpen={isPipelineOpen} onClose={() => setIsPipelineOpen(false)} />
    </div>
  );
}
