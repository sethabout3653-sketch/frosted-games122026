import React, { useState, useEffect, useDeferredValue } from "react";
import {
  Search,
  Flame,
  Gamepad2,
  Headphones,
  Sparkles,
  Tv,
  Film,
  Heart,
  History,
  Play,
  RotateCcw,
  X,
  Radio,
  ExternalLink,
  Link as LinkIcon,
  Check,
  Compass,
} from "lucide-react";
import { YouTubeVideo } from "../types";
import YouTubePlayer from "./YouTubePlayer";
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
  { id: "all", label: "All Latest", icon: Flame },
  { id: "gaming", label: "Gaming", icon: Gamepad2 },
  { id: "study", label: "Study & Lofi", icon: Headphones },
  { id: "music", label: "Music", icon: Radio },
  { id: "tech", label: "Tech & Science", icon: Sparkles },
  { id: "entertainment", label: "Entertainment", icon: Film },
  { id: "favorites", label: "Saved Videos", icon: Heart },
  { id: "history", label: "Watch History", icon: History },
];

const CURATED_CREATORS = [
  { name: "Lofi Girl", id: "UCSJ4gkVC6NrvII8umztf0Ow", tag: "Study Beats" },
  { name: "MrBeast", id: "UCX6OQ3DkcsbYNE6H8uQQuVA", tag: "Challenges" },
  { name: "IGN", id: "UCKy1dAqELo0zrOtPkf0eTMw", tag: "Gaming News" },
  { name: "Kurzgesagt", id: "UCsXVk37bltHxD1rDPwtNM8Q", tag: "Science" },
  { name: "Fireship", id: "UCsBjURrPoezykLs9EqgamOA", tag: "Tech in 100s" },
  { name: "GameSpot", id: "UC9CuvdOVfMPvKCiWD4QSNLA", tag: "Trailers" },
  { name: "PewDiePie", id: "UC-lHJZR3Gqxm24_Vd_AJ5Yw", tag: "Gaming" },
  { name: "Monstercat", id: "UCWzS3Z3R4U2x5z3t0yF-l9w", tag: "EDM" },
];

export default function YouTubeView({ isActive, onBackToHome, onActiveVideoChange }: YouTubeViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDeferredValue(searchQuery);

  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<YouTubeVideo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [directUrlInput, setDirectUrlInput] = useState("");
  const [showDirectUrlBox, setShowDirectUrlBox] = useState(false);
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

  // Load videos based on category or search
  useEffect(() => {
    let isCancelled = false;

    if (selectedCategory === "favorites") {
      setVideos(getSavedVideos());
      setIsLoading(false);
      return;
    }

    if (selectedCategory === "history") {
      const historyItems = getWatchHistory();
      setVideos(historyItems.map((h) => h.video));
      setIsLoading(false);
      return;
    }

    async function loadVideos() {
      setIsLoading(true);
      try {
        let endpoint = `/api/youtube/trending?category=${selectedCategory}`;
        if (deferredSearch.trim()) {
          endpoint = `/api/youtube/search?q=${encodeURIComponent(deferredSearch.trim())}`;
        }

        const res = await fetch(endpoint);
        if (!res.ok) throw new Error("Failed to load feed");
        const data = await res.json();

        if (!isCancelled && data.videos) {
          setVideos(data.videos);
        }
      } catch (e) {
        console.error("Failed to load YouTube videos:", e);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }

    loadVideos();

    return () => {
      isCancelled = true;
    };
  }, [selectedCategory, deferredSearch]);

  const handleSelectChannel = async (channelId: string, channelName: string) => {
    setIsLoading(true);
    setSearchQuery("");
    try {
      const res = await fetch(`/api/youtube/channel/${channelId}`);
      const data = await res.json();
      if (data.videos) {
        setVideos(data.videos);
      }
    } catch (e) {
      console.error("Error loading channel feed:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayDirectUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = directUrlInput.trim();
    if (!raw) return;

    // Check if it's a direct googlevideo URL or custom video URL
    if (raw.includes("googlevideo.com") || raw.endsWith(".mp4") || raw.endsWith(".webm")) {
      const customVideo: YouTubeVideo = {
        id: "direct_stream_" + Date.now(),
        title: "Direct GoogleVideo Stream",
        channelTitle: "Direct Stream Source",
        thumbnail: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80",
        streamUrl: raw,
      };
      setSelectedVideo(customVideo);
      setDirectUrlInput("");
      setShowDirectUrlBox(false);
      return;
    }

    // Check if it's a YouTube link (e.g. youtube.com/watch?v=... or youtu.be/...)
    let videoId = "";
    if (raw.includes("watch?v=")) {
      videoId = raw.split("watch?v=")[1].split("&")[0];
    } else if (raw.includes("youtu.be/")) {
      videoId = raw.split("youtu.be/")[1].split("?")[0];
    } else if (raw.length === 11) {
      videoId = raw;
    }

    if (videoId) {
      const parsedVideo: YouTubeVideo = {
        id: videoId,
        title: `YouTube Video (${videoId})`,
        channelTitle: "YouTube",
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      };
      setSelectedVideo(parsedVideo);
      setDirectUrlInput("");
      setShowDirectUrlBox(false);
    }
  };

  const handleToggleFavoriteCard = (e: React.MouseEvent, vid: YouTubeVideo) => {
    e.stopPropagation();
    toggleSaveVideo(vid);
    refreshSavedCount();
    if (selectedCategory === "favorites") {
      setVideos(getSavedVideos());
    }
  };

  // If a video is currently selected, show the rich HTML5 video player
  if (selectedVideo) {
    return (
      <div className="w-full min-h-[calc(100vh-120px)] p-3 sm:p-6 space-y-6">
        <YouTubePlayer
          video={selectedVideo}
          onBack={() => setSelectedVideo(null)}
          onSelectRelated={(v) => setSelectedVideo(v)}
        />

        {/* Up Next & Recommended Videos Grid */}
        <div className="w-full max-w-7xl mx-auto space-y-4 pt-4">
          <h3 className="text-base font-bold text-white">
            Up Next
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-7">
            {videos
              .filter((v) => v.id !== selectedVideo.id)
              .slice(0, 8)
              .map((v) => {
                const channelInit = (v.channelTitle || "Y")[0].toUpperCase();
                return (
                  <div
                    key={v.id}
                    onClick={() => {
                      setSelectedVideo(v);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="group cursor-pointer flex flex-col space-y-2.5"
                  >
                    <div className="relative aspect-video rounded-xl overflow-hidden bg-[#181818] group-hover:rounded-none transition-all duration-200">
                      <img
                        src={v.thumbnail}
                        alt={v.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                      />
                      {v.duration && (
                        <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 text-white font-mono text-[11px] font-medium">
                          {v.duration}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex gap-3 px-0.5">
                      <div className="w-9 h-9 rounded-full bg-[#272727] overflow-hidden shrink-0 mt-0.5 border border-white/5 flex items-center justify-center">
                        {v.channelThumbnail ? (
                          <img
                            src={v.channelThumbnail}
                            alt={v.channelTitle}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-white font-bold text-xs">{channelInit}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-white line-clamp-2 leading-snug group-hover:text-neutral-200 transition-colors">
                          {v.title}
                        </h4>
                        <p className="text-xs text-neutral-400 mt-1 truncate">{v.channelTitle}</p>
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
      <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap pb-2 border-b border-white/5">
        {/* Left: YouTube Branding */}
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-red-600 flex items-center justify-center text-white shadow-md shadow-red-950/40">
            <Tv size={18} />
          </div>
          <span className="text-lg font-bold tracking-tight text-white font-sans">
            YouTube
          </span>
        </div>

        {/* Center: Search Bar */}
        <div className="flex-1 max-w-2xl min-w-[240px]">
          <div className="relative flex items-center">
            <Search size={16} className="absolute left-3.5 text-neutral-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (selectedCategory === "favorites" || selectedCategory === "history") {
                  setSelectedCategory("all");
                }
              }}
              placeholder="Search YouTube..."
              className="w-full h-10 pl-10 pr-10 rounded-full bg-[#121212] border border-[#303030] text-sm text-white placeholder-neutral-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
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

      {/* Category Filter Pills Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat.id && !searchQuery;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setSelectedCategory(cat.id);
                setSearchQuery("");
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                isSelected
                  ? "bg-white text-black"
                  : "bg-[#272727] hover:bg-[#383838] text-white"
              }`}
            >
              <span>{cat.label}</span>
              {cat.id === "favorites" && savedCount > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${isSelected ? "bg-black/10 text-black" : "bg-white/20 text-white"}`}>
                  {savedCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Video Feed Grid */}
      <div className="space-y-4">
        {selectedCategory === "history" && videos.length > 0 && (
          <div className="flex items-center justify-between pt-1">
            <h2 className="text-sm font-bold text-white">Watch History</h2>
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
                <div className="aspect-video rounded-xl bg-[#272727]" />
                <div className="flex gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#272727] shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-[#272727] rounded w-5/6" />
                    <div className="h-3 bg-[#272727] rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : videos.length === 0 ? (
          <div className="py-16 text-center space-y-3 bg-[#121212]/50 rounded-2xl border border-white/5">
            <Tv size={40} className="mx-auto text-neutral-600" />
            <p className="text-sm font-semibold text-neutral-300">No videos found</p>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto">
              Try searching for a different keyword or paste a YouTube link.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-7">
            {videos.map((vid) => {
              const saved = isVideoSaved(vid.id);
              const channelInitial = (vid.channelTitle || "Y")[0].toUpperCase();

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
                  {/* Thumbnail */}
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-[#181818] group-hover:rounded-none transition-all duration-200">
                    <img
                      src={vid.thumbnail}
                      alt={vid.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                    />

                    {/* Play Hover Overlay */}
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="h-10 w-10 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                        <Play size={18} className="fill-white ml-0.5" />
                      </div>
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
                      className={`absolute top-1.5 right-1.5 h-7 w-7 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                        saved
                          ? "bg-red-600 text-white shadow-md"
                          : "bg-black/60 text-white/80 hover:bg-black/90 hover:text-white"
                      }`}
                      title={saved ? "Saved" : "Save video"}
                    >
                      <Heart size={13} className={saved ? "fill-white" : ""} />
                    </button>
                  </div>

                  {/* Card Info Details */}
                  <div className="flex gap-3 px-0.5">
                    {/* Channel Avatar */}
                    <div className="w-9 h-9 rounded-full bg-[#272727] overflow-hidden shrink-0 mt-0.5 border border-white/5 flex items-center justify-center">
                      {vid.channelThumbnail ? (
                        <img
                          src={vid.channelThumbnail}
                          alt={vid.channelTitle}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-white font-bold text-xs">{channelInitial}</span>
                      )}
                    </div>

                    {/* Title & Metadata */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-white line-clamp-2 leading-snug group-hover:text-neutral-200 transition-colors">
                        {vid.title}
                      </h3>

                      <p className="text-xs text-neutral-400 hover:text-white transition-colors mt-1 truncate">
                        {vid.channelTitle}
                      </p>

                      <div className="flex items-center gap-1.5 text-xs text-neutral-400 font-normal mt-0.5">
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
