import React, { useState, useEffect, useDeferredValue } from "react";
import {
  Music,
  Video as VideoIcon,
  Search,
  Flame,
  Radio,
  Sparkles,
  Heart,
  History,
  TrendingUp,
  Headphones,
  Compass,
  ArrowLeft,
  X,
  Play,
  Volume2,
} from "lucide-react";
import { YouTubeVideo } from "../types";
import YouTubePlayer from "./YouTubePlayer";
import { getSavedVideos, getWatchHistory, toggleSaveVideo, isVideoSaved } from "../lib/youtubeStorage";

interface YouTubeViewProps {
  isActive?: boolean;
  onBackToHome?: () => void;
  onActiveVideoChange?: (title: string | null) => void;
}

const MUSIC_CATEGORIES = [
  { id: "all", label: "Top Charts", icon: Flame },
  { id: "study", label: "Lofi & Study", icon: Headphones },
  { id: "pop", label: "Pop Hits", icon: Sparkles },
  { id: "hiphop", label: "Hip-Hop", icon: TrendingUp },
  { id: "electronic", label: "Electronic / EDM", icon: Radio },
  { id: "rock", label: "Rock & Alternative", icon: Music },
  { id: "favorites", label: "Favorites", icon: Heart },
  { id: "history", label: "Recently Played", icon: History },
];

const LOCAL_FALLBACK_TRACKS: Record<string, YouTubeVideo[]> = {
  all: [
    {
      id: "jfKfPfyJRdk",
      title: "lofi hip hop radio 📚 - beats to relax/study to",
      channelTitle: "Lofi Girl",
      artist: "Lofi Girl",
      views: "Live • 45K watching",
      duration: "Live",
      thumbnail: "https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg",
      mediaType: "audio",
      isMusic: true,
      descriptionSnippet: "Chill study beats and instrumental lo-fi hip hop.",
    },
    {
      id: "4xDzrJKXOOY",
      title: "synthwave radio 🌌 - chill synth / retro beats",
      channelTitle: "Lofi Girl",
      artist: "Lofi Girl",
      views: "Live • 12K watching",
      duration: "Live",
      thumbnail: "https://i.ytimg.com/vi/4xDzrJKXOOY/hqdefault.jpg",
      mediaType: "audio",
      isMusic: true,
      descriptionSnippet: "Chill synthwave and retrowave beats for coding and gaming.",
    },
    {
      id: "fJ9rUzIMcZQ",
      title: "Bohemian Rhapsody",
      channelTitle: "Queen",
      artist: "Queen",
      views: "1.7B views",
      duration: "5:59",
      thumbnail: "https://i.ytimg.com/vi/fJ9rUzIMcZQ/hqdefault.jpg",
      mediaType: "video",
      isMusic: true,
    },
    {
      id: "JGwWNGJdvx8",
      title: "Shape of You",
      channelTitle: "Ed Sheeran",
      artist: "Ed Sheeran",
      views: "6.2B views",
      duration: "4:23",
      thumbnail: "https://i.ytimg.com/vi/JGwWNGJdvx8/hqdefault.jpg",
      mediaType: "video",
      isMusic: true,
    },
    {
      id: "09R8_2nJtjg",
      title: "Sugar",
      channelTitle: "Maroon 5",
      artist: "Maroon 5",
      views: "4.0B views",
      duration: "5:01",
      thumbnail: "https://i.ytimg.com/vi/09R8_2nJtjg/hqdefault.jpg",
      mediaType: "video",
      isMusic: true,
    },
    {
      id: "kXYiU_JCYtU",
      title: "Numb",
      channelTitle: "Linkin Park",
      artist: "Linkin Park",
      views: "2.2B views",
      duration: "3:07",
      thumbnail: "https://i.ytimg.com/vi/kXYiU_JCYtU/hqdefault.jpg",
      mediaType: "video",
      isMusic: true,
    },
  ],
  study: [
    {
      id: "jfKfPfyJRdk",
      title: "lofi hip hop radio - beats to relax/study to",
      channelTitle: "Lofi Girl",
      artist: "Lofi Girl",
      views: "Live • 45K watching",
      duration: "Live",
      thumbnail: "https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg",
      mediaType: "audio",
      isMusic: true,
    },
    {
      id: "4xDzrJKXOOY",
      title: "synthwave radio - chill synth / retro beats",
      channelTitle: "Lofi Girl",
      artist: "Lofi Girl",
      views: "Live • 12K watching",
      duration: "Live",
      thumbnail: "https://i.ytimg.com/vi/4xDzrJKXOOY/hqdefault.jpg",
      mediaType: "audio",
      isMusic: true,
    },
    {
      id: "5qap5aO4i9A",
      title: "Lofi Hip Hop Radio 24/7 - Chill Study Beats",
      channelTitle: "ChilledCow",
      artist: "Chillhop Music",
      views: "2.1M views",
      duration: "Live",
      thumbnail: "https://i.ytimg.com/vi/5qap5aO4i9A/hqdefault.jpg",
      mediaType: "audio",
      isMusic: true,
    },
  ],
  pop: [
    {
      id: "JGwWNGJdvx8",
      title: "Shape of You",
      channelTitle: "Ed Sheeran",
      artist: "Ed Sheeran",
      views: "6.2B views",
      duration: "4:23",
      thumbnail: "https://i.ytimg.com/vi/JGwWNGJdvx8/hqdefault.jpg",
      mediaType: "video",
      isMusic: true,
    },
    {
      id: "09R8_2nJtjg",
      title: "Sugar",
      channelTitle: "Maroon 5",
      artist: "Maroon 5",
      views: "4.0B views",
      duration: "5:01",
      thumbnail: "https://i.ytimg.com/vi/09R8_2nJtjg/hqdefault.jpg",
      mediaType: "video",
      isMusic: true,
    },
  ],
};

export default function YouTubeView({
  isActive = true,
  onBackToHome,
  onActiveVideoChange,
}: YouTubeViewProps) {
  const [selectedVideo, setSelectedVideo] = useState<YouTubeVideo | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const deferredSearch = useDeferredValue(searchQuery);

  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [mediaFilter, setMediaFilter] = useState<"all" | "audio" | "video">("all");
  const [savedCount, setSavedCount] = useState<number>(0);

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

  // Load music tracks based on category, filter, and search directly with resilient fallback
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

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const res = await fetch(endpoint, { signal: controller.signal }).catch(() => null);
        clearTimeout(timeoutId);

        if (res && res.ok) {
          const data = await res.json().catch(() => null);
          if (!isCancelled && data && Array.isArray(data.videos) && data.videos.length > 0) {
            setVideos(data.videos);
            return;
          }
        }

        // Fallback to local curated tracks if network or external API is slow
        if (!isCancelled) {
          const fallback = LOCAL_FALLBACK_TRACKS[selectedCategory] || LOCAL_FALLBACK_TRACKS.all || [];
          setVideos(fallback);
        }
      } catch (e) {
        // Fallback gracefully without noisy console errors
        if (!isCancelled) {
          const fallback = LOCAL_FALLBACK_TRACKS[selectedCategory] || LOCAL_FALLBACK_TRACKS.all || [];
          setVideos(fallback);
        }
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

                      {/* Media Type Badge */}
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
                if (val && (selectedCategory === "favorites" || selectedCategory === "history")) {
                  setSelectedCategory("all");
                }
              }}
              placeholder="Search songs, artists, albums, or paste music.youtube.com link..."
              className="w-full pl-10 pr-10 py-2 rounded-xl bg-[#1a1a24] border border-white/10 focus:border-[var(--theme-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)] text-sm text-white placeholder-neutral-400 transition-colors shadow-inner"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 p-1 rounded-full text-neutral-400 hover:text-white transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Right: Audio Only / Music Video Filter Pill */}
        <div className="flex items-center bg-[#181822] p-1 rounded-xl border border-white/5 shrink-0">
          <button
            type="button"
            onClick={() => setMediaFilter("all")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all duration-150 ${
              mediaFilter === "all"
                ? "bg-[var(--theme-accent)] text-white shadow-md"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            All Tracks
          </button>
          <button
            type="button"
            onClick={() => setMediaFilter("audio")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 ${
              mediaFilter === "audio"
                ? "bg-emerald-600 text-white shadow-md"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <Music size={12} />
            Audio Only
          </button>
          <button
            type="button"
            onClick={() => setMediaFilter("video")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 ${
              mediaFilter === "video"
                ? "bg-indigo-600 text-white shadow-md"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <VideoIcon size={12} />
            Music Videos
          </button>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {MUSIC_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isSelected = selectedCategory === cat.id;
          const count = cat.id === "favorites" ? savedCount : null;

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setSelectedCategory(cat.id);
                if (cat.id === "favorites" || cat.id === "history") {
                  setSearchQuery("");
                }
              }}
              style={{
                backgroundColor: isSelected ? "var(--theme-accent)" : "#181822",
                borderColor: isSelected ? "var(--theme-border)" : "rgba(255,255,255,0.05)",
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-all duration-150 shadow-sm cursor-pointer ${
                isSelected
                  ? "text-white shadow-md scale-[1.02]"
                  : "text-neutral-300 hover:bg-[#20202e] hover:text-white"
              }`}
            >
              <Icon size={14} className={isSelected ? "text-white" : "text-neutral-400"} />
              <span>{cat.label}</span>
              {count !== null && count > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-white/20 text-white text-[10px] font-bold">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Video Cards Grid */}
      <div className="space-y-4 pt-2">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse space-y-3">
                <div className="aspect-video bg-neutral-800/60 rounded-2xl border border-white/5" />
                <div className="flex gap-3">
                  <div className="w-9 h-9 rounded-xl bg-neutral-800 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-neutral-800 rounded w-4/5" />
                    <div className="h-3 bg-neutral-800 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : videos.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-[#181824] border border-white/10 flex items-center justify-center text-neutral-400 shadow-inner">
              <Music size={28} />
            </div>
            <h3 className="text-base font-bold text-white">No tracks found</h3>
            <p className="text-xs text-neutral-400 max-w-sm">
              {selectedCategory === "favorites"
                ? "You haven't saved any tracks yet. Click the heart icon on any music card to save it!"
                : "Try searching for another song, artist, album, or switch categories."}
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
                  onClick={() => setSelectedVideo(vid)}
                  className="group cursor-pointer flex flex-col space-y-2.5 transition-transform duration-200"
                >
                  {/* Thumbnail / Cover Container */}
                  <div className="relative aspect-video rounded-2xl overflow-hidden bg-[#161620] border border-white/10 group-hover:border-[var(--theme-accent)] shadow-md group-hover:shadow-xl transition-all duration-200">
                    <img
                      src={vid.thumbnail}
                      alt={vid.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                    />

                    {/* Hover Play Overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div
                        style={{ backgroundColor: "var(--theme-accent)" }}
                        className="w-11 h-11 rounded-full flex items-center justify-center text-white shadow-xl transform scale-90 group-hover:scale-100 transition-transform"
                      >
                        <Play size={18} className="fill-white ml-0.5" />
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
