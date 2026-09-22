import React, { useState, useEffect, useDeferredValue } from "react";
import {
  Search,
  Flame,
  Headphones,
  Sparkles,
  Heart,
  History,
  Play,
  X,
  Radio,
  Compass,
  Music,
  Video as VideoIcon,
  Disc3,
  Layers,
} from "lucide-react";
import { YouTubeVideo } from "../types";
import YouTubePlayer, { extractYouTubeId } from "./YouTubePlayer";
import {
  getSavedVideos,
  getWatchHistory,
  clearWatchHistory,
  isVideoSaved,
  toggleSaveVideo,
} from "../lib/youtubeStorage";

interface YouTubeViewProps {
  isActive?: boolean;
  onBackToHome?: () => void;
  onActiveVideoChange?: (videoTitle: string | null) => void;
}

const CATEGORIES = [
  { id: "all", label: "Top Charts", icon: Flame },
  { id: "explore", label: "Explore & New", icon: Sparkles },
  { id: "study", label: "Study & Lofi", icon: Headphones },
  { id: "pop", label: "Pop Hits", icon: Disc3 },
  { id: "hiphop", label: "Hip Hop & Rap", icon: Music },
  { id: "electronic", label: "EDM & Dance", icon: Radio },
  { id: "rock", label: "Rock & Indie", icon: Compass },
  { id: "favorites", label: "Saved Tracks", icon: Heart },
  { id: "history", label: "History", icon: History },
];

export default function YouTubeView({
  isActive,
  onBackToHome,
  onActiveVideoChange,
}: YouTubeViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [mediaFilter, setMediaFilter] = useState<"all" | "audio" | "video">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDeferredValue(searchQuery);

  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<YouTubeVideo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  // Sync title with activity tracker
  useEffect(() => {
    if (onActiveVideoChange) {
      onActiveVideoChange(selectedVideo ? selectedVideo.title : null);
    }
  }, [selectedVideo, onActiveVideoChange]);

  // Update saved count
  const refreshSavedCount = () => {
    setSavedCount(getSavedVideos().length);
  };

  useEffect(() => {
    refreshSavedCount();
  }, [selectedVideo]);

  // Load music tracks based on category, filter, and search directly from music.youtube.com
  useEffect(() => {
    let isCancelled = false;

    if (selectedCategory === "favorites") {
      let saved = getSavedVideos();
      if (mediaFilter === "audio") saved = saved.filter((v) => v.mediaType === "audio");
      else if (mediaFilter === "video") saved = saved.filter((v) => v.mediaType === "video");
      setVideos(saved);
      setIsLoading(false);
      return;
    }

    if (selectedCategory === "history") {
      const historyItems = getWatchHistory();
      let histVideos = historyItems.map((h) => h.video);
      if (mediaFilter === "audio") histVideos = histVideos.filter((v) => v.mediaType === "audio");
      else if (mediaFilter === "video") histVideos = histVideos.filter((v) => v.mediaType === "video");
      setVideos(histVideos);
      setIsLoading(false);
      return;
    }

    async function loadVideos() {
      setIsLoading(true);
      try {
        const filterParam = mediaFilter === "all" ? "" : `&filter=${mediaFilter === "audio" ? "songs" : "videos"}`;
        let endpoint = `/api/youtube/trending?category=${selectedCategory}${filterParam}`;
        if (deferredSearch.trim()) {
          endpoint = `/api/youtube/search?q=${encodeURIComponent(deferredSearch.trim())}${filterParam}`;
        }

        const res = await fetch(endpoint);
        if (!res.ok) throw new Error("Failed to load YouTube Music feed");
        const data = await res.json();

        if (!isCancelled && data.videos) {
          setVideos(data.videos);
        }
      } catch (e) {
        console.error("Failed to load music:", e);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }

    loadVideos();

    return () => {
      isCancelled = true;
    };
  }, [selectedCategory, deferredSearch, mediaFilter]);

  const handleToggleFavoriteCard = (e: React.MouseEvent, vid: YouTubeVideo) => {
    e.stopPropagation();
    toggleSaveVideo(vid);
    refreshSavedCount();
    if (selectedCategory === "favorites") {
      setVideos(getSavedVideos());
    }
  };

  // If a video is currently selected, show the player
  if (selectedVideo) {
    return (
      <div className="w-full min-h-[calc(100vh-120px)] p-3 sm:p-6 space-y-6">
        <YouTubePlayer
          video={selectedVideo}
          playlist={videos}
          onBack={() => setSelectedVideo(null)}
          onSelectVideo={(v) => setSelectedVideo(v)}
        />

        {/* Up Next in YouTube Music Grid */}
        <div className="w-full max-w-7xl mx-auto space-y-4 pt-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Music size={16} className="text-[var(--theme-text-accent)]" />
            <span>More from YouTube Music</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-7">
            {videos
              .filter((v) => v.id !== selectedVideo.id)
              .slice(0, 8)
              .map((v) => {
                const isAudio = v.mediaType === "audio";
                return (
                  <div
                    key={v.id}
                    onClick={() => {
                      setSelectedVideo(v);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="group cursor-pointer flex flex-col space-y-2.5"
                  >
                    <div className="relative aspect-video rounded-xl overflow-hidden bg-[#181818] border border-white/5 group-hover:border-[var(--theme-accent)] transition-all duration-200">
                      <img
                        src={v.thumbnail}
                        alt={v.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                      />

                      {/* Media Type Badge: AUDIO ONLY vs MUSIC VIDEO */}
                      <div
                        style={{ backgroundColor: isAudio ? "#059669" : "#4f46e5" }}
                        className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-md text-white font-black text-[9px] tracking-wider uppercase flex items-center gap-1 z-10 shadow-lg ring-1 ring-white/20"
                      >
                        {isAudio ? <Music size={9} /> : <VideoIcon size={9} />}
                        <span>{isAudio ? "AUDIO ONLY" : "MUSIC VIDEO"}</span>
                      </div>

                      {v.duration && (
                        <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 text-white font-mono text-[11px] font-medium">
                          {v.duration}
                        </span>
                      )}
                    </div>

                    <div className="flex gap-3 px-0.5">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-white line-clamp-2 leading-snug group-hover:text-[var(--theme-text-accent)] transition-colors">
                          {v.title}
                        </h4>
                        <p className="text-xs text-neutral-400 mt-1 truncate">
                          {v.channelTitle || v.artist || "YouTube Music"}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-[calc(100vh-120px)] p-3 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Top Search & Navigation Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap pb-3 border-b border-white/5">
        {/* Left: YouTube Music Branding */}
        <div className="flex items-center gap-2.5">
          <div
            style={{
              backgroundColor: "var(--theme-accent)",
              borderColor: "var(--theme-border)",
            }}
            className="h-9 w-9 rounded-xl border flex items-center justify-center text-white shadow-md transition-colors"
          >
            <Music size={18} className="text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-extrabold tracking-tight text-white font-sans flex items-center gap-1.5">
              YouTube Music
            </span>
            <span className="text-[10px] text-neutral-400 font-medium tracking-wide">
              Audio Tracks & Music Videos &bull; music.youtube.com
            </span>
          </div>
        </div>

        {/* Center: Search Bar */}
        <div className="flex-1 max-w-xl min-w-[240px]">
          <div className="relative flex items-center">
            <Search size={16} className="absolute left-3.5 text-neutral-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                const val = e.target.value;
                setSearchQuery(val);
                if (selectedCategory === "favorites" || selectedCategory === "history") {
                  setSelectedCategory("all");
                }

                // If input is a full YouTube/YouTube Music link, parse and select
                const lower = val.toLowerCase();
                if (lower.includes("youtube.com") || lower.includes("youtu.be") || lower.includes("youtube-nocookie.com")) {
                  const extractedId = extractYouTubeId(val);
                  if (extractedId && extractedId.length === 11) {
                    const parsedVideo: YouTubeVideo = {
                      id: extractedId,
                      title: `Playing Track (${extractedId})`,
                      channelTitle: "YouTube Music",
                      thumbnail: `https://i.ytimg.com/vi/${extractedId}/hqdefault.jpg`,
                      mediaType: lower.includes("music.youtube.com") ? "audio" : "video",
                    };
                    setSelectedVideo(parsedVideo);
                    setSearchQuery("");
                  }
                }
              }}
              placeholder="Search songs, artists, albums, or paste music.youtube.com link..."
              className="w-full h-10 pl-10 pr-10 rounded-full bg-[#121212] border border-[#303030] text-sm text-white placeholder-neutral-400 focus:outline-none focus:border-[var(--theme-accent)] focus:ring-1 focus:ring-[var(--theme-accent)] transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 text-neutral-400 hover:text-white p-1 rounded-full cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Category Tabs & Media Type Toggle Filter */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Category Filter Pills Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none flex-1">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id && !searchQuery;
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setSearchQuery("");
                }}
                style={{
                  backgroundColor: isSelected ? "var(--theme-accent)" : "rgba(255, 255, 255, 0.05)",
                  borderColor: isSelected ? "var(--theme-border)" : "transparent",
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 whitespace-nowrap cursor-pointer flex items-center gap-1.5 border ${
                  isSelected
                    ? "text-white shadow-md ring-1 ring-white/20"
                    : "text-neutral-300 hover:text-white hover:bg-white/10"
                }`}
              >
                <Icon size={13} className={isSelected ? "text-white" : "text-neutral-400"} />
                <span>{cat.label}</span>
                {cat.id === "favorites" && savedCount > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${isSelected ? "bg-white/20 text-white" : "bg-white/10 text-neutral-300"}`}>
                    {savedCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Media Type Filter (All / Audio Songs / Video & Audio) */}
        <div className="flex items-center bg-[#151515] p-1 rounded-xl border border-white/10 shrink-0">
          <button
            type="button"
            onClick={() => setMediaFilter("all")}
            style={{
              backgroundColor: mediaFilter === "all" ? "var(--theme-accent)" : "transparent",
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              mediaFilter === "all"
                ? "text-white shadow-sm"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            All Music
          </button>
          <button
            type="button"
            onClick={() => setMediaFilter("audio")}
            style={{
              backgroundColor: mediaFilter === "audio" ? "#10b981" : "transparent",
            }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              mediaFilter === "audio"
                ? "text-white shadow-sm"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <Music size={11} />
            <span>Audio Tracks</span>
          </button>
          <button
            type="button"
            onClick={() => setMediaFilter("video")}
            style={{
              backgroundColor: mediaFilter === "video" ? "var(--theme-accent)" : "transparent",
            }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              mediaFilter === "video"
                ? "text-white shadow-sm"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <VideoIcon size={11} />
            <span>Video & Audio</span>
          </button>
        </div>
      </div>

      {/* Main YouTube Music Feed Grid */}
      <div className="space-y-4">
        {selectedCategory === "history" && videos.length > 0 && (
          <div className="flex items-center justify-between pt-1">
            <h2 className="text-sm font-bold text-white">Listening History</h2>
            <button
              type="button"
              onClick={() => {
                clearWatchHistory();
                setVideos([]);
              }}
              className="text-xs text-red-400 hover:text-red-300 font-semibold cursor-pointer"
            >
              Clear History
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-3 animate-pulse">
                <div className="rounded-2xl bg-[#202028] aspect-video" />
                <div className="flex gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#202028] shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-[#202028] rounded w-5/6" />
                    <div className="h-3 bg-[#202028] rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : videos.length === 0 ? (
          <div className="py-16 text-center space-y-3 bg-[#121212]/50 rounded-2xl border border-white/5">
            <Music size={40} className="mx-auto text-neutral-600" />
            <p className="text-sm font-semibold text-neutral-300">No tracks found on YouTube Music</p>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto">
              Try searching for an artist, track title, or switch category.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-7">
            {videos.map((vid) => {
              const saved = isVideoSaved(vid.id);
              const isAudio = vid.mediaType === "audio";

              return (
                <div
                  key={vid.id}
                  id={`yt-card-${vid.id}`}
                  onClick={() => {
                    setSelectedVideo(vid);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="group cursor-pointer flex flex-col space-y-2.5"
                >
                  {/* Thumbnail Area */}
                  <div className="relative aspect-video rounded-2xl overflow-hidden bg-[#181820] border border-white/5 group-hover:border-[var(--theme-accent)] transition-all duration-200 shadow-md">
                    <img
                      src={vid.thumbnail}
                      alt={vid.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                    />

                    {/* Play Hover Overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div
                        style={{ backgroundColor: isAudio ? "#10b981" : "var(--theme-accent)" }}
                        className="h-11 w-11 rounded-full text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform"
                      >
                        <Play size={20} className="fill-white ml-0.5" />
                      </div>
                    </div>

                    {/* Audio vs Video Badge */}
                    <div
                      style={{ backgroundColor: isAudio ? "#059669" : "#4f46e5" }}
                      className="absolute top-2 left-2 px-2.5 py-0.5 rounded-lg text-white font-black text-[9px] tracking-wider uppercase flex items-center gap-1 z-10 shadow-lg ring-1 ring-white/20"
                    >
                      {isAudio ? <Music size={10} /> : <VideoIcon size={10} />}
                      <span>{isAudio ? "AUDIO ONLY" : "MUSIC VIDEO"}</span>
                    </div>

                    {/* Duration Badge */}
                    {vid.duration && (
                      <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 text-white font-mono text-[11px] font-medium">
                        {vid.duration}
                      </span>
                    )}

                    {/* Quick Save Bookmark Button */}
                    <button
                      type="button"
                      onClick={(e) => handleToggleFavoriteCard(e, vid)}
                      style={{
                        backgroundColor: saved ? "var(--theme-accent)" : undefined,
                      }}
                      className={`absolute top-2 right-2 h-7 w-7 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                        saved
                          ? "text-white shadow-md"
                          : "bg-black/60 text-white/80 hover:bg-black/90 hover:text-white"
                      }`}
                      title={saved ? "Saved" : "Save track"}
                    >
                      <Heart size={13} className={saved ? "fill-white" : ""} />
                    </button>
                  </div>

                  {/* Card Info Details */}
                  <div className="flex gap-3 px-0.5">
                    {/* Album/Artist Icon */}
                    <div className="w-9 h-9 rounded-xl bg-[#202028] overflow-hidden shrink-0 mt-0.5 border border-white/5 flex items-center justify-center text-white">
                      {isAudio ? <Music size={14} className="text-emerald-400" /> : <VideoIcon size={14} className="text-indigo-400" />}
                    </div>

                    {/* Title & Metadata */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-white line-clamp-2 leading-snug group-hover:text-[var(--theme-text-accent)] transition-colors">
                        {vid.title}
                      </h3>

                      <p className="text-xs text-neutral-400 hover:text-white transition-colors mt-0.5 truncate">
                        {vid.channelTitle || vid.artist || "YouTube Music"}
                      </p>

                      <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 font-normal mt-0.5">
                        {vid.views && <span>{vid.views}</span>}
                        {vid.views && vid.publishedTime && <span>•</span>}
                        {vid.publishedTime && <span>{vid.publishedTime}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
