import React, { useState, useEffect, useDeferredValue } from "react";
import {
  Music,
  Search,
  Headphones,
  Flame,
  Sparkles,
  Heart,
  Play,
  Pause,
  Plus,
  Disc,
  X,
  Volume2,
  VolumeX,
  Volume1,
  LayoutGrid,
  List as ListIcon,
  Shuffle,
  Share2,
  Check,
  SkipBack,
  SkipForward,
  Repeat,
  Repeat1,
  Trash2,
  Radio,
} from "lucide-react";
import { useMusic, Track } from "../context/MusicContext";

interface MusicViewProps {
  isActive?: boolean;
}

type TabType = "discover" | "chillhop" | "synthwave" | "collection" | "player";

const QUICK_SUGGESTIONS = [
  "Lofi Girl Radio",
  "Chillhop Music",
  "Synthwave 80s",
  "ODESZA",
  "Tycho",
  "Petit Biscuit",
  "Kudasai",
  "Flamingosis",
  "Nightcore Mix",
  "Gaming Lo-Fi",
];

export default function MusicView({ isActive = true }: MusicViewProps) {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    queue,
    isShuffle,
    repeatMode,
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
    playbackEngine,
    favorites,
    toggleFavorite,
    isFavorite,
  } = useMusic();

  const [activeTab, setActiveTab] = useState<TabType>("discover");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDeferredValue(searchQuery);
  // Curated Fallback Tracks
  const DEFAULT_FALLBACK_TRACKS: Track[] = [
    {
      id: "5yx6BWlEVcY",
      youtubeId: "5yx6BWlEVcY",
      title: "Chillhop Radio - Jazzy & Lo-Fi Beats",
      artist: "Chillhop Music",
      duration: "Live",
      thumbnail: "https://i.ytimg.com/vi/5yx6BWlEVcY/hqdefault.jpg",
      permalinkUrl: "https://music.youtube.com/watch?v=5yx6BWlEVcY",
    },
    {
      id: "4xDzrJKXOOY",
      youtubeId: "4xDzrJKXOOY",
      title: "Synthwave Radio - Chill Synth / Retro Beats",
      artist: "Lofi Girl",
      duration: "Live",
      thumbnail: "https://i.ytimg.com/vi/4xDzrJKXOOY/hqdefault.jpg",
      permalinkUrl: "https://music.youtube.com/watch?v=4xDzrJKXOOY",
    },
    {
      id: "jfKfPfyJRdk",
      youtubeId: "jfKfPfyJRdk",
      title: "Lofi Hip Hop Radio - Beats to Relax/Study to",
      artist: "Lofi Girl",
      duration: "Live",
      thumbnail: "https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg",
      permalinkUrl: "https://music.youtube.com/watch?v=jfKfPfyJRdk",
    },
    {
      id: "x3bfa3DZ8JM",
      youtubeId: "x3bfa3DZ8JM",
      title: "A Moment Apart",
      artist: "ODESZA",
      duration: "3:54",
      thumbnail: "https://i.ytimg.com/vi/x3bfa3DZ8JM/hqdefault.jpg",
      permalinkUrl: "https://music.youtube.com/watch?v=x3bfa3DZ8JM",
    },
    {
      id: "z3wAjJXbYzA",
      youtubeId: "z3wAjJXbYzA",
      title: "A Walk",
      artist: "Tycho",
      duration: "5:17",
      thumbnail: "https://i.ytimg.com/vi/z3wAjJXbYzA/hqdefault.jpg",
      permalinkUrl: "https://music.youtube.com/watch?v=z3wAjJXbYzA",
    },
    {
      id: "n61ULEU7CO0",
      youtubeId: "n61ULEU7CO0",
      title: "Best of Lofi Hip Hop Study Mix",
      artist: "Lofi Girl",
      duration: "1:24:15",
      thumbnail: "https://i.ytimg.com/vi/n61ULEU7CO0/hqdefault.jpg",
      permalinkUrl: "https://music.youtube.com/watch?v=n61ULEU7CO0",
    },
  ];

  const [tracks, setTracks] = useState<Track[]>(DEFAULT_FALLBACK_TRACKS);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedTrackId, setCopiedTrackId] = useState<string | null>(null);

  // Fetch tracks with AbortController and graceful fallback
  useEffect(() => {
    const controller = new AbortController();

    if (activeTab === "collection") {
      setTracks(favorites);
      return;
    }

    if (activeTab === "player") {
      return;
    }

    async function fetchTracks() {
      setIsLoading(true);
      try {
        const query = deferredSearch.trim();
        let endpoint = "";

        if (query) {
          endpoint = `/api/music/search?q=${encodeURIComponent(query)}`;
        } else {
          const category =
            activeTab === "chillhop"
              ? "chillhop"
              : activeTab === "synthwave"
              ? "synthwave"
              : "all";
          endpoint = `/api/music/trending?category=${category}`;
        }

        const res = await fetch(endpoint, { signal: controller.signal });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.tracks) && data.tracks.length > 0) {
            setTracks(data.tracks);
          }
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          // Keep existing tracks or use fallback
          setTracks((prev) => (prev.length > 0 ? prev : DEFAULT_FALLBACK_TRACKS));
        }
      } finally {
        setIsLoading(false);
      }
    }

    fetchTracks();

    return () => {
      controller.abort();
    };
  }, [activeTab, deferredSearch, favorites]);

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs <= 0) return "0:00";
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${mins}:${s < 10 ? "0" : ""}${s}`;
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setIsLoading(true);
    try {
      // If it looks like a URL or an 11-char YouTube ID, resolve it directly
      if (/^https?:\/\//i.test(query) || /^[a-zA-Z0-9_-]{11}$/.test(query)) {
        const res = await fetch(`/api/music/resolve?url=${encodeURIComponent(query)}`);
        if (res.ok) {
          const track = await res.json();
          if (track && track.id) {
            setTracks((prev) => [track, ...prev.filter((t) => t.id !== track.id)]);
            playTrack(track, [track, ...tracks]);
            return;
          }
        }
      }

      // Keyword search
      const res = await fetch(`/api/music/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.tracks) && data.tracks.length > 0) {
          setTracks(data.tracks);
          playTrack(data.tracks[0], data.tracks);
        }
      }
    } catch (err) {
      // quiet fallback
    } finally {
      setIsLoading(false);
    }
  };

  const handleShare = (track: Track) => {
    const url = track.permalinkUrl || `https://music.youtube.com/watch?v=${track.youtubeId || track.id}`;
    navigator.clipboard.writeText(url);
    setCopiedTrackId(track.id);
    setTimeout(() => setCopiedTrackId(null), 2000);
  };

  const spotlightTrack = currentTrack || tracks[0];

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 flex flex-col flex-1 animate-fadeIn">
      {/* Header & Primary Navigation */}
      <div
        style={{ borderColor: "var(--theme-border-subtle)" }}
        className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b"
      >
        <div className="flex items-center gap-3">
          <div
            style={{
              backgroundColor: "var(--theme-accent)",
              color: "#ffffff",
              boxShadow: "0 4px 18px var(--theme-border-strong)",
            }}
            className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
          >
            <Music size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Music</h1>
            <p style={{ color: "var(--theme-text-muted)" }} className="text-xs mt-0.5">
              Powered by music.youtube.com & yt-dlp with full-length audio
            </p>
          </div>
        </div>

        {/* Segmented Control */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full lg:w-auto">
          <div
            style={{
              backgroundColor: "var(--theme-surface)",
              borderColor: "var(--theme-border-subtle)",
            }}
            className="flex items-center gap-1 p-1 border rounded-2xl overflow-x-auto no-scrollbar w-full sm:w-auto"
          >
            <button
              type="button"
              onClick={() => {
                setActiveTab("discover");
                setSearchQuery("");
              }}
              style={{
                backgroundColor: activeTab === "discover" ? "var(--theme-accent)" : "transparent",
                color: activeTab === "discover" ? "#ffffff" : "var(--theme-text-muted)",
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap"
            >
              <Flame size={14} />
              <span>Discover</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("chillhop");
                setSearchQuery("");
              }}
              style={{
                backgroundColor: activeTab === "chillhop" ? "var(--theme-accent)" : "transparent",
                color: activeTab === "chillhop" ? "#ffffff" : "var(--theme-text-muted)",
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap"
            >
              <Headphones size={14} />
              <span>Lo-Fi</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("synthwave");
                setSearchQuery("");
              }}
              style={{
                backgroundColor: activeTab === "synthwave" ? "var(--theme-accent)" : "transparent",
                color: activeTab === "synthwave" ? "#ffffff" : "var(--theme-text-muted)",
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap"
            >
              <Sparkles size={14} />
              <span>Synthwave</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("collection");
                setSearchQuery("");
              }}
              style={{
                backgroundColor: activeTab === "collection" ? "var(--theme-accent)" : "transparent",
                color: activeTab === "collection" ? "#ffffff" : "var(--theme-text-muted)",
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap"
            >
              <Heart size={14} />
              <span>Favorites ({favorites.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("player")}
              style={{
                backgroundColor: activeTab === "player" ? "var(--theme-accent)" : "transparent",
                color: activeTab === "player" ? "#ffffff" : "var(--theme-text-accent)",
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap"
            >
              <Disc size={14} className={isPlaying && activeTab === "player" ? "animate-spin" : ""} />
              <span>Player</span>
            </button>
          </div>

          {activeTab !== "player" && (
            <div
              style={{
                backgroundColor: "var(--theme-surface)",
                borderColor: "var(--theme-border-subtle)",
              }}
              className="flex items-center gap-1 p-1 border rounded-xl shrink-0 ml-auto"
            >
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                style={{
                  backgroundColor: viewMode === "grid" ? "rgba(255,255,255,0.12)" : "transparent",
                  color: viewMode === "grid" ? "#ffffff" : "var(--theme-text-muted)",
                }}
                className="p-1.5 rounded-lg transition-colors cursor-pointer"
                title="Grid View"
              >
                <LayoutGrid size={14} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                style={{
                  backgroundColor: viewMode === "list" ? "rgba(255,255,255,0.12)" : "transparent",
                  color: viewMode === "list" ? "#ffffff" : "var(--theme-text-muted)",
                }}
                className="p-1.5 rounded-lg transition-colors cursor-pointer"
                title="List View"
              >
                <ListIcon size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Dedicated Player Tab */}
      {activeTab === "player" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-start">
          {/* Turntable Console */}
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

            {/* Vinyl Turntable */}
            <div className="relative flex flex-col items-center justify-center py-6 z-10">
              <div
                style={{ borderColor: "rgba(255,255,255,0.08)", animationDuration: "14s" }}
                className={`w-60 h-60 sm:w-68 sm:h-68 rounded-full border-4 shadow-2xl overflow-hidden relative bg-black/90 flex items-center justify-center ${
                  isPlaying ? "animate-spin" : ""
                }`}
              >
                <div
                  style={{ borderColor: "rgba(255,255,255,0.15)" }}
                  className="w-36 h-36 sm:w-40 sm:h-40 rounded-full overflow-hidden border-2 shadow-inner relative z-10 bg-neutral-900"
                >
                  <img
                    src={currentTrack?.thumbnail || "https://i.ytimg.com/vi/5yx6BWlEVcY/hqdefault.jpg"}
                    alt={currentTrack?.title || "Album"}
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

            {/* Track Info */}
            <div className="flex items-center justify-between gap-4 z-10 relative">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight truncate">
                    {currentTrack?.title || "No Track Playing"}
                  </h2>
                  {currentTrack && (
                    <span
                      style={{
                        backgroundColor: playbackEngine === "yt-dlp" ? "rgba(16, 185, 129, 0.15)" : "rgba(59, 130, 246, 0.15)",
                        color: playbackEngine === "yt-dlp" ? "#34d399" : "#60a5fa",
                      }}
                      className="text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider shrink-0"
                    >
                      {playbackEngine === "yt-dlp" ? "yt-dlp Audio" : "Browser Engine"}
                    </span>
                  )}
                </div>
                <p style={{ color: "var(--theme-text-muted)" }} className="text-sm font-medium truncate mt-0.5">
                  {currentTrack?.artist || "Select a song from Discover or search YouTube Music"}
                </p>
              </div>

              {currentTrack && (
                <button
                  type="button"
                  onClick={() => toggleFavorite(currentTrack)}
                  style={{
                    backgroundColor: "rgba(255,255,255,0.06)",
                    borderColor: "var(--theme-border-subtle)",
                  }}
                  className="p-3 rounded-2xl border text-neutral-300 hover:text-rose-400 transition-colors cursor-pointer"
                  title="Favorite"
                >
                  <Heart size={18} className={isFavorite(currentTrack.id) ? "fill-rose-500 text-rose-500" : ""} />
                </button>
              )}
            </div>

            {/* Scrubber */}
            <div className="space-y-2 z-10 relative">
              <input
                type="range"
                min="0"
                max={duration || 100}
                step="0.5"
                value={currentTime}
                onChange={(e) => seek(parseFloat(e.target.value))}
                style={{ accentColor: "var(--theme-accent)" }}
                className="w-full h-2 rounded-lg bg-white/10 cursor-pointer transition-all"
              />
              <div style={{ color: "var(--theme-text-muted)" }} className="flex items-center justify-between text-xs font-mono tabular-nums">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between gap-2 z-10 relative pt-2">
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

              <button
                type="button"
                onClick={prevTrack}
                style={{ backgroundColor: "rgba(255,255,255,0.05)", borderColor: "var(--theme-border-subtle)" }}
                className="p-3 rounded-2xl border text-neutral-200 hover:text-white transition-all cursor-pointer active:scale-95"
                title="Previous"
              >
                <SkipBack size={20} />
              </button>

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
                {isPlaying ? <Pause size={26} className="fill-white" /> : <Play size={26} className="fill-white translate-x-0.5" />}
              </button>

              <button
                type="button"
                onClick={nextTrack}
                style={{ backgroundColor: "rgba(255,255,255,0.05)", borderColor: "var(--theme-border-subtle)" }}
                className="p-3 rounded-2xl border text-neutral-200 hover:text-white transition-all cursor-pointer active:scale-95"
                title="Next"
              >
                <SkipForward size={20} />
              </button>

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

            {/* Volume */}
            <div style={{ borderColor: "var(--theme-border-subtle)" }} className="flex items-center gap-3 pt-4 border-t text-xs z-10 relative">
              <button type="button" onClick={toggleMute} style={{ color: "var(--theme-text-muted)" }} className="hover:text-white cursor-pointer">
                {isMuted || volume === 0 ? <VolumeX size={16} /> : volume < 50 ? <Volume1 size={16} /> : <Volume2 size={16} />}
              </button>
              <input
                type="range"
                min="0"
                max="100"
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(parseInt(e.target.value, 10))}
                style={{ accentColor: "var(--theme-accent)" }}
                className="flex-1 h-1.5 rounded-lg bg-white/10 cursor-pointer"
              />
              <span style={{ color: "var(--theme-text-muted)" }} className="font-mono text-[11px] tabular-nums w-8">
                {isMuted ? "0%" : `${volume}%`}
              </span>
            </div>
          </div>

          {/* Up Next Queue */}
          <div
            style={{
              backgroundColor: "var(--theme-surface)",
              borderColor: "var(--theme-border-subtle)",
            }}
            className="lg:col-span-5 border rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl flex flex-col h-full min-h-[500px]"
          >
            <div style={{ borderColor: "var(--theme-border-subtle)" }} className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-white">Up Next ({queue.length})</h3>
            </div>

            <div className="flex-1 flex flex-col space-y-2 overflow-y-auto max-h-[460px] custom-scrollbar pr-1">
              {queue.length === 0 ? (
                <div style={{ color: "var(--theme-text-muted)" }} className="p-12 text-center space-y-1">
                  <Disc size={28} className="mx-auto text-neutral-500 mb-2" />
                  <p className="text-xs">Queue is empty</p>
                </div>
              ) : (
                queue.map((track, idx) => {
                  const isCurrent = track.id === currentTrack?.id;
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
                          <img src={track.thumbnail} alt={track.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-white truncate leading-tight">{track.title}</h4>
                          <p style={{ color: "var(--theme-text-muted)" }} className="text-[11px] truncate mt-0.5">
                            {track.artist}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFromQueue(idx);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-neutral-400 hover:text-red-400 transition-opacity cursor-pointer"
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
          </div>
        </div>
      ) : (
        <>
          {/* Spotlight Hero Banner */}
          {activeTab === "discover" && !searchQuery && spotlightTrack && (
            <div
              style={{
                backgroundColor: "var(--theme-surface)",
                borderColor: "var(--theme-border-subtle)",
              }}
              className="relative overflow-hidden rounded-3xl border p-6 sm:p-8 shadow-xl"
            >
              <div
                style={{ backgroundColor: "var(--theme-accent)" }}
                className="absolute -top-32 -right-32 w-80 h-80 rounded-full blur-3xl pointer-events-none opacity-15"
              />

              <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
                <div
                  style={{ borderColor: "var(--theme-border-subtle)" }}
                  className="relative group shrink-0 w-40 h-40 sm:w-44 sm:h-44 rounded-2xl overflow-hidden shadow-2xl bg-black/50 border"
                >
                  <img
                    src={spotlightTrack.thumbnail}
                    alt={spotlightTrack.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                  {isPlaying && currentTrack?.id === spotlightTrack.id && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center gap-1 px-4">
                      <div style={{ backgroundColor: "var(--theme-accent)" }} className="w-1.5 h-6 rounded-full animate-bounce" />
                      <div className="w-1.5 h-10 bg-white rounded-full animate-bounce [animation-delay:0.2s]" />
                      <div style={{ backgroundColor: "var(--theme-accent)" }} className="w-1.5 h-8 rounded-full animate-bounce [animation-delay:0.1s]" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-3 text-center md:text-left">
                  <div className="space-y-1">
                    <div style={{ color: "var(--theme-text-muted)" }} className="flex items-center justify-center md:justify-start gap-2 text-xs">
                      <span>Featured YouTube Music</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono text-neutral-300">{spotlightTrack.duration || "3:30"}</span>
                    </div>

                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-snug">
                      {spotlightTrack.title}
                    </h2>
                    <p style={{ color: "var(--theme-text-accent)" }} className="text-sm font-medium">
                      {spotlightTrack.artist}
                    </p>
                  </div>

                  <div className="flex items-center justify-center md:justify-start gap-3 pt-1 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        if (currentTrack?.id === spotlightTrack.id) {
                          togglePlay();
                        } else {
                          playTrack(spotlightTrack, tracks);
                        }
                      }}
                      style={{ backgroundColor: "var(--theme-accent)", color: "#ffffff" }}
                      className="px-6 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-md hover:opacity-90 active:scale-95 flex items-center gap-2"
                    >
                      {isPlaying && currentTrack?.id === spotlightTrack.id ? (
                        <>
                          <Pause size={15} className="fill-white" />
                          <span>Pause</span>
                        </>
                      ) : (
                        <>
                          <Play size={15} className="fill-white translate-x-0.5" />
                          <span>Play Now</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => addToQueue(spotlightTrack)}
                      style={{ backgroundColor: "rgba(255,255,255,0.06)", borderColor: "var(--theme-border-subtle)" }}
                      className="px-4 py-2.5 rounded-xl border text-white font-semibold text-xs transition-colors hover:bg-white/10 cursor-pointer flex items-center gap-1.5"
                    >
                      <Plus size={14} />
                      <span>Add to Queue</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleFavorite(spotlightTrack)}
                      style={{ backgroundColor: "rgba(255,255,255,0.06)", borderColor: "var(--theme-border-subtle)" }}
                      className="p-2.5 rounded-xl border text-neutral-300 hover:text-rose-400 transition-colors cursor-pointer"
                      title={isFavorite(spotlightTrack.id) ? "Saved" : "Favorite"}
                    >
                      <Heart size={16} className={isFavorite(spotlightTrack.id) ? "fill-rose-500 text-rose-500" : ""} />
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab("player")}
                      style={{ backgroundColor: "rgba(255,255,255,0.06)", borderColor: "var(--theme-border-subtle)", color: "var(--theme-text-accent)" }}
                      className="p-2.5 rounded-xl border hover:bg-white/10 transition-colors cursor-pointer"
                      title="Open Full Player"
                    >
                      <Disc size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Search Bar */}
          <form onSubmit={handleSearchSubmit} className="space-y-2">
            <div
              style={{
                backgroundColor: "var(--theme-surface)",
                borderColor: "var(--theme-border-subtle)",
              }}
              className="flex items-center gap-2 p-2 rounded-2xl border shadow-inner transition-colors focus-within:border-white/30"
            >
              <div style={{ color: "var(--theme-text-muted)" }} className="pl-3">
                <Search size={16} />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search songs, artists, or paste a music.youtube.com link..."
                className="flex-1 bg-transparent text-sm text-white placeholder-neutral-500 focus:outline-none px-2"
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery("")} className="p-1.5 text-neutral-400 hover:text-white">
                  <X size={15} />
                </button>
              )}
              <button
                type="submit"
                disabled={!searchQuery.trim()}
                style={{ backgroundColor: "var(--theme-accent)", color: "#ffffff" }}
                className="px-4 py-2 rounded-xl disabled:opacity-40 font-bold text-xs transition-all cursor-pointer shrink-0 shadow-sm flex items-center gap-1.5"
              >
                <span>Search</span>
              </button>
            </div>

            {!searchQuery && activeTab !== "collection" && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs text-neutral-400">
                <span style={{ color: "var(--theme-text-muted)" }} className="text-[11px] font-medium shrink-0">
                  Suggestions:
                </span>
                {QUICK_SUGGESTIONS.map((artist) => (
                  <button
                    key={artist}
                    type="button"
                    onClick={() => setSearchQuery(artist)}
                    style={{
                      backgroundColor: "rgba(255,255,255,0.04)",
                      borderColor: "var(--theme-border-subtle)",
                      color: "var(--theme-text-muted)",
                    }}
                    className="px-3 py-1 rounded-lg border hover:text-white hover:bg-white/10 text-[11px] whitespace-nowrap transition-colors cursor-pointer shrink-0"
                  >
                    {artist}
                  </button>
                ))}
              </div>
            )}
          </form>

          {/* Track Grid / List */}
          <div className="space-y-4">
            <div style={{ color: "var(--theme-text-muted)" }} className="flex items-center justify-between text-xs">
              <span className="font-semibold uppercase tracking-wider text-neutral-300">
                {searchQuery ? `Results for "${searchQuery}"` : activeTab === "chillhop" ? "Lo-Fi Collection" : activeTab === "synthwave" ? "Synthwave Collection" : activeTab === "collection" ? "Favorite Tracks" : "Curated Music"}
              </span>
              <span>{tracks.length} tracks</span>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div key={i} style={{ backgroundColor: "var(--theme-surface)" }} className="rounded-2xl p-3.5 space-y-3 border border-white/5 animate-pulse">
                    <div className="aspect-square rounded-xl bg-white/5" />
                    <div className="h-4 bg-white/10 rounded w-3/4" />
                    <div className="h-3 bg-white/5 rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : tracks.length === 0 ? (
              <div
                style={{
                  backgroundColor: "var(--theme-surface)",
                  borderColor: "var(--theme-border-subtle)",
                }}
                className="p-16 text-center space-y-2 border rounded-3xl"
              >
                <Disc size={32} className="mx-auto text-neutral-500" />
                <p className="text-sm font-semibold text-white">No tracks found</p>
                <p style={{ color: "var(--theme-text-muted)" }} className="text-xs max-w-sm mx-auto">
                  Try searching for an artist like &quot;Lofi Girl&quot; or paste a YouTube Music link above.
                </p>
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {tracks.map((track, idx) => {
                  const isCurrent = currentTrack?.id === track.id && isPlaying;
                  const fav = isFavorite(track.id);

                  return (
                    <div
                      key={`${track.id}-${idx}`}
                      onClick={() => {
                        if (currentTrack?.id === track.id) {
                          togglePlay();
                        } else {
                          playTrack(track, tracks);
                        }
                      }}
                      style={{
                        backgroundColor: "var(--theme-surface)",
                        borderColor: isCurrent ? "var(--theme-border-strong)" : "var(--theme-border-subtle)",
                        boxShadow: isCurrent ? "0 0 20px var(--theme-border-strong)" : "none",
                      }}
                      className="group border rounded-2xl p-3 flex flex-col space-y-3 transition-all duration-200 cursor-pointer relative overflow-hidden hover:bg-white/5"
                    >
                      <div className="aspect-square rounded-xl overflow-hidden bg-black/60 relative border border-white/5">
                        <img
                          src={track.thumbnail}
                          alt={track.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                          loading="lazy"
                        />

                        {track.duration && (
                          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md font-mono text-[10px] text-white">
                            {track.duration}
                          </div>
                        )}

                        <div
                          className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${
                            isCurrent ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                          }`}
                        >
                          <div
                            style={{ backgroundColor: "var(--theme-accent)" }}
                            className="w-11 h-11 rounded-full text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform"
                          >
                            {isCurrent ? <Pause size={18} className="fill-white" /> : <Play size={18} className="fill-white translate-x-0.5" />}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start justify-between gap-2 min-w-0 flex-1">
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-white truncate leading-tight group-hover:underline">
                            {track.title}
                          </h4>
                          <p style={{ color: "var(--theme-text-muted)" }} className="text-[11px] truncate mt-1">
                            {track.artist}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(track);
                            }}
                            className="p-1 rounded-lg text-neutral-400 hover:text-rose-400 transition-colors"
                            title={fav ? "Saved" : "Favorite"}
                          >
                            <Heart size={14} className={fav ? "fill-rose-500 text-rose-500" : ""} />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              addToQueue(track);
                            }}
                            className="p-1 rounded-lg text-neutral-400 hover:text-white transition-colors"
                            title="Add to queue"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                style={{
                  backgroundColor: "var(--theme-surface)",
                  borderColor: "var(--theme-border-subtle)",
                }}
                className="border rounded-2xl overflow-hidden shadow-sm divide-y divide-white/5"
              >
                {tracks.map((track, idx) => {
                  const isCurrent = currentTrack?.id === track.id && isPlaying;
                  const fav = isFavorite(track.id);

                  return (
                    <div
                      key={`${track.id}-${idx}`}
                      onClick={() => {
                        if (currentTrack?.id === track.id) {
                          togglePlay();
                        } else {
                          playTrack(track, tracks);
                        }
                      }}
                      style={{
                        backgroundColor: isCurrent ? "rgba(255,255,255,0.06)" : "transparent",
                      }}
                      className="flex items-center justify-between gap-4 p-3 hover:bg-white/5 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <span className="w-5 text-center text-xs font-mono text-neutral-500 group-hover:text-white">
                          {isCurrent ? (
                            <span style={{ backgroundColor: "var(--theme-accent)" }} className="w-2 h-2 rounded-full inline-block animate-ping" />
                          ) : (
                            idx + 1
                          )}
                        </span>

                        <div className="w-9 h-9 rounded-xl overflow-hidden bg-black/60 shrink-0 border border-white/10 relative">
                          <img src={track.thumbnail} alt={track.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-white truncate leading-tight group-hover:underline">
                            {track.title}
                          </h4>
                          <p style={{ color: "var(--theme-text-muted)" }} className="text-[11px] truncate mt-0.5">
                            {track.artist}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {track.duration && (
                          <span style={{ color: "var(--theme-text-muted)" }} className="font-mono text-xs tabular-nums">
                            {track.duration}
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(track);
                          }}
                          className="p-1.5 text-neutral-400 hover:text-rose-400 transition-colors"
                        >
                          <Heart size={14} className={fav ? "fill-rose-500 text-rose-500" : ""} />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            addToQueue(track);
                          }}
                          className="p-1.5 text-neutral-400 hover:text-white transition-colors"
                        >
                          <Plus size={14} />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShare(track);
                          }}
                          className="p-1.5 text-neutral-400 hover:text-white transition-colors"
                        >
                          {copiedTrackId === track.id ? <Check size={14} className="text-emerald-400" /> : <Share2 size={14} />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
