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
  Music,
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

const CURATED_SHORTS: YouTubeVideo[] = [
  {
    id: "2K08A375tFE",
    title: "Can Water Float on Air? 🤯 (Science Experiment)",
    channelTitle: "Science Lab",
    views: "89M views",
    publishedTime: "3mo ago",
    duration: "0:45",
    thumbnail: "https://i.ytimg.com/vi/2K08A375tFE/hqdefault.jpg",
    isShort: true,
  },
  {
    id: "L_LUpnjgPso",
    title: "Flying to Paris just to get a fresh baguette! 🇫🇷",
    channelTitle: "MrBeast",
    views: "142M views",
    publishedTime: "1mo ago",
    duration: "0:58",
    thumbnail: "https://i.ytimg.com/vi/L_LUpnjgPso/hqdefault.jpg",
    isShort: true,
  },
  {
    id: "X_mE7uD9P6g",
    title: "Insane Magic Illusion Trick! How did he do that? 🪄",
    channelTitle: "Zach King",
    views: "98M views",
    publishedTime: "6mo ago",
    duration: "0:42",
    thumbnail: "https://i.ytimg.com/vi/X_mE7uD9P6g/hqdefault.jpg",
    isShort: true,
  },
  {
    id: "z3_7bS_A13E",
    title: "Super satisfying kinetic sand carving compilation ASMR 🔪",
    channelTitle: "ASMR satisfying",
    views: "67M views",
    publishedTime: "5mo ago",
    duration: "0:50",
    thumbnail: "https://i.ytimg.com/vi/z3_7bS_A13E/hqdefault.jpg",
    isShort: true,
  },
  {
    id: "9n7U2-KzUmg",
    title: "Insane City Roof Parkour Jump! DO NOT TRY THIS! 🏃‍♂️",
    channelTitle: "Parkour Pro",
    views: "45M views",
    publishedTime: "2mo ago",
    duration: "0:35",
    thumbnail: "https://i.ytimg.com/vi/9n7U2-KzUmg/hqdefault.jpg",
    isShort: true,
  },
  {
    id: "S90fH_YnIvs",
    title: "3 History Facts They Didn't Teach You In School! 📜",
    channelTitle: "History Revealed",
    views: "12M views",
    publishedTime: "8mo ago",
    duration: "0:59",
    thumbnail: "https://i.ytimg.com/vi/S90fH_YnIvs/hqdefault.jpg",
    isShort: true,
  },
  {
    id: "uH6N0O-9SgA",
    title: "This visual drawing illusion will melt your brain! ✏️",
    channelTitle: "Art Masterclass",
    views: "31M views",
    publishedTime: "4mo ago",
    duration: "0:48",
    thumbnail: "https://i.ytimg.com/vi/uH6N0O-9SgA/hqdefault.jpg",
    isShort: true,
  },
  {
    id: "q8qK_mU6X8Y",
    title: "Cooking standard fast food at home but gourmet! 🍔",
    channelTitle: "Chef Gordon",
    views: "53M views",
    publishedTime: "1mo ago",
    duration: "0:55",
    thumbnail: "https://i.ytimg.com/vi/q8qK_mU6X8Y/hqdefault.jpg",
    isShort: true,
  },
  {
    id: "C2_I2eGj1sA",
    title: "Satisfying high power laser rust cleaning ⚡",
    channelTitle: "LaserTech",
    views: "74M views",
    publishedTime: "2mo ago",
    duration: "0:40",
    thumbnail: "https://i.ytimg.com/vi/C2_I2eGj1sA/hqdefault.jpg",
    isShort: true,
  },
  {
    id: "d6y2tY87wXg",
    title: "Perfect satisfy flapjack pancake flip challenge! 🥞",
    channelTitle: "Baking Beats",
    views: "18M views",
    publishedTime: "3mo ago",
    duration: "0:30",
    thumbnail: "https://i.ytimg.com/vi/d6y2tY87wXg/hqdefault.jpg",
    isShort: true,
  }
];

export default function YouTubeView({ isActive, onBackToHome, onActiveVideoChange }: YouTubeViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<"videos" | "shorts" | "music">("videos");
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

  // Load videos based on category, search, and active sub-tab
  useEffect(() => {
    let isCancelled = false;

    if (selectedCategory === "favorites") {
      let saved = getSavedVideos();
      if (activeSubTab === "shorts") {
        saved = saved.filter(v => v.isShort || v.title?.toLowerCase().includes("shorts") || v.title?.toLowerCase().includes("short"));
      } else if (activeSubTab === "music") {
        saved = saved.filter(v => v.isMusic || v.title?.toLowerCase().includes("music") || v.channelTitle?.toLowerCase().includes("music"));
      } else {
        saved = saved.filter(v => !v.isShort);
      }
      setVideos(saved);
      setIsLoading(false);
      return;
    }

    if (selectedCategory === "history") {
      const historyItems = getWatchHistory();
      let hVideos = historyItems.map((h) => h.video);
      if (activeSubTab === "shorts") {
        hVideos = hVideos.filter(v => v.isShort || v.title?.toLowerCase().includes("shorts") || v.title?.toLowerCase().includes("short"));
      } else if (activeSubTab === "music") {
        hVideos = hVideos.filter(v => v.isMusic || v.title?.toLowerCase().includes("music") || v.channelTitle?.toLowerCase().includes("music"));
      } else {
        hVideos = hVideos.filter(v => !v.isShort);
      }
      setVideos(hVideos);
      setIsLoading(false);
      return;
    }

    async function loadVideos() {
      setIsLoading(true);
      try {
        let endpoint = `/api/youtube/trending?category=${selectedCategory}`;
        
        if (activeSubTab === "shorts") {
          const q = deferredSearch.trim() ? `${deferredSearch.trim()} shorts` : "youtube shorts funny trending viral compilation";
          endpoint = `/api/youtube/search?q=${encodeURIComponent(q)}`;
        } else if (activeSubTab === "music") {
          if (deferredSearch.trim()) {
            endpoint = `/api/youtube/search?q=${encodeURIComponent(deferredSearch.trim() + " official music video")}`;
          } else {
            // If study category is selected, use study, else default music trending
            const cat = selectedCategory === "study" || selectedCategory === "lofi" ? "study" : "music";
            endpoint = `/api/youtube/trending?category=${cat}`;
          }
        } else {
          if (deferredSearch.trim()) {
            endpoint = `/api/youtube/search?q=${encodeURIComponent(deferredSearch.trim())}`;
          } else {
            endpoint = `/api/youtube/trending?category=${selectedCategory}`;
          }
        }

        const res = await fetch(endpoint);
        if (!res.ok) throw new Error("Failed to load feed");
        const data = await res.json();

        if (!isCancelled && data.videos) {
          // Process and tag videos dynamically
          const processed = data.videos.map((v: any) => {
            const titleLower = (v.title || "").toLowerCase();
            const channelLower = (v.channelTitle || "").toLowerCase();
            const looksLikeShort = activeSubTab === "shorts" || 
                                   titleLower.includes("shorts") || 
                                   titleLower.includes("short") ||
                                   (v.duration && parseInt(v.duration.split(":")[0], 10) === 0 && parseInt(v.duration.split(":")[1], 10) <= 60);
            
            const looksLikeMusic = activeSubTab === "music" ||
                                   titleLower.includes("music video") ||
                                   titleLower.includes("official audio") ||
                                   titleLower.includes("song") ||
                                   titleLower.includes("lyric") ||
                                   channelLower.includes("music") ||
                                   channelLower.includes("vevo") ||
                                   selectedCategory === "music" ||
                                   selectedCategory === "study";

            return {
              ...v,
              isShort: looksLikeShort,
              isMusic: looksLikeMusic && !looksLikeShort,
            };
          });

          let filtered = processed;
          if (activeSubTab === "shorts") {
            // Filter strictly for videos under 2:00 duration or containing shorts keyword
            filtered = processed.filter((v: any) => {
              const dur = v.duration || "";
              const titleLower = (v.title || "").toLowerCase();
              if (titleLower.includes("compilation") || titleLower.includes("longest") || titleLower.includes("marathon") || titleLower.includes("full episode") || titleLower.includes("best of") || titleLower.includes("history of")) {
                return false;
              }
              const parts = dur.split(":");
              if (parts.length === 2) {
                const mins = parseInt(parts[0], 10);
                const secs = parseInt(parts[1], 10);
                if (mins === 0 || (mins === 1 && secs <= 30)) {
                  return true;
                }
              }
              return titleLower.includes("shorts") || titleLower.includes("short");
            });

            // Prepend curated shorts if there's no search query and user is browsing Trending Shorts
            if (!deferredSearch.trim() && selectedCategory === "all") {
              const existingIds = new Set(filtered.map((f: any) => f.id));
              const uniqueCurated = CURATED_SHORTS.filter(c => !existingIds.has(c.id));
              filtered = [...uniqueCurated, ...filtered];
            }
          }

          setVideos(filtered);
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
  }, [selectedCategory, deferredSearch, activeSubTab]);

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

    const videoId = extractYouTubeId(raw);
    if (videoId && videoId.length === 11) {
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
    <div className="w-full min-h-[calc(100vh-120px)] p-3 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Search & Navigation Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap pb-3 border-b border-white/5">
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

                // If input is a full YouTube link, automatically parse and select the video!
                const lower = val.toLowerCase();
                if (lower.includes("youtube.com") || lower.includes("youtu.be") || lower.includes("youtube-nocookie.com")) {
                  const extractedId = extractYouTubeId(val);
                  if (extractedId && extractedId.length === 11) {
                    const parsedVideo: YouTubeVideo = {
                      id: extractedId,
                      title: `Pasted YouTube Video (${extractedId})`,
                      channelTitle: "YouTube Embed Player",
                      thumbnail: `https://i.ytimg.com/vi/${extractedId}/hqdefault.jpg`,
                    };
                    setSelectedVideo(parsedVideo);
                    setSearchQuery(""); // Clear the search bar
                  }
                }
              }}
              placeholder={`Search in ${activeSubTab === "shorts" ? "Shorts" : activeSubTab === "music" ? "Music" : "Videos"}...`}
              className="w-full h-10 pl-10 pr-10 rounded-full bg-[#121212] border border-[#303030] text-sm text-white placeholder-neutral-400 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
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

      {/* Main Sub-Tabs Segmented Controller */}
      <div className="flex p-1 bg-[#121212]/90 border border-white/5 rounded-xl max-w-lg mx-auto sm:mx-0">
        <button
          type="button"
          onClick={() => {
            setActiveSubTab("videos");
            setSelectedCategory("all");
            setSearchQuery("");
          }}
          className={`flex-1 py-2 px-3 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === "videos"
              ? "bg-[#272727] text-white shadow-sm"
              : "text-neutral-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Tv size={15} />
          <span>Youtube Videos</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveSubTab("shorts");
            setSelectedCategory("all");
            setSearchQuery("");
          }}
          className={`flex-1 py-2 px-3 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === "shorts"
              ? "bg-red-600 text-white shadow-sm"
              : "text-neutral-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Compass size={15} />
          <span>Youtube Shorts</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveSubTab("music");
            setSelectedCategory("all");
            setSearchQuery("");
          }}
          className={`flex-1 py-2 px-3 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === "music"
              ? "bg-amber-600 text-white shadow-sm"
              : "text-neutral-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Music size={15} />
          <span>Youtube Music</span>
        </button>
      </div>

      {/* Category Filter Pills Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {(() => {
          const subTabCategories = (() => {
            if (activeSubTab === "shorts") {
              return [
                { id: "all", label: "Trending Shorts", icon: Compass },
                { id: "favorites", label: "Saved Shorts", icon: Heart },
                { id: "history", label: "Watch History", icon: History },
              ];
            }
            if (activeSubTab === "music") {
              return [
                { id: "all", label: "Trending Music", icon: Music },
                { id: "study", label: "Study & Lofi", icon: Headphones },
                { id: "favorites", label: "Saved Music", icon: Heart },
                { id: "history", label: "Watch History", icon: History },
              ];
            }
            return CATEGORIES;
          })();

          return subTabCategories.map((cat) => {
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
          });
        })()}
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
          <div className={`grid gap-x-4 gap-y-6 ${
            activeSubTab === "shorts"
              ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
              : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
          }`}>
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="space-y-3 animate-pulse">
                <div className={`rounded-xl bg-[#272727] ${activeSubTab === "shorts" ? "aspect-[9/16]" : "aspect-video"}`} />
                <div className="flex gap-3">
                  {activeSubTab !== "shorts" && <div className="w-9 h-9 rounded-full bg-[#272727] shrink-0" />}
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
            <p className="text-sm font-semibold text-neutral-300">No content found</p>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto">
              Try entering a search or change the active category filter.
            </p>
          </div>
        ) : (
          <div className={`grid gap-x-4 gap-y-7 ${
            activeSubTab === "shorts"
              ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
              : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
          }`}>
            {videos.map((vid) => {
              const saved = isVideoSaved(vid.id);
              const channelInitial = (vid.channelTitle || "Y")[0].toUpperCase();

              // 1. YouTube Shorts Vertical Card UI
              if (activeSubTab === "shorts") {
                return (
                  <div
                    key={vid.id}
                    id={`yt-card-${vid.id}`}
                    onClick={() => {
                      setSelectedVideo(vid);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="group cursor-pointer relative aspect-[9/16] rounded-2xl overflow-hidden bg-[#181818] shadow-md border border-white/5 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl"
                  >
                    {/* Thumbnail */}
                    <img
                      src={vid.thumbnail}
                      alt={vid.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                    />

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent flex flex-col justify-end p-3 sm:p-4 space-y-1.5 pointer-events-none">
                      {/* Play Badge */}
                      <div className="absolute top-3 left-3 h-7 w-7 rounded-full bg-red-600/90 flex items-center justify-center text-white shadow-md">
                        <Play size={12} className="fill-white ml-0.5" />
                      </div>

                      <h3 className="text-xs sm:text-sm font-bold text-white line-clamp-2 leading-snug drop-shadow-md">
                        {vid.title}
                      </h3>
                      
                      <div className="flex items-center gap-1 text-[10px] text-neutral-300 font-semibold drop-shadow-md truncate">
                        <span className="truncate">{vid.channelTitle}</span>
                      </div>

                      {vid.views && (
                        <span className="text-[10px] text-neutral-400 font-medium drop-shadow-sm">
                          {vid.views}
                        </span>
                      )}
                    </div>

                    {/* Quick Save Bookmark */}
                    <button
                      type="button"
                      onClick={(e) => handleToggleFavoriteCard(e, vid)}
                      className={`absolute top-3 right-3 h-7 w-7 rounded-full flex items-center justify-center transition-all cursor-pointer z-10 ${
                        saved
                          ? "bg-red-600 text-white shadow-md"
                          : "bg-black/60 text-white/80 hover:bg-black/90 hover:text-white"
                      }`}
                      title={saved ? "Saved" : "Save short"}
                    >
                      <Heart size={13} className={saved ? "fill-white" : ""} />
                    </button>
                  </div>
                );
              }

              // 2. Standard Videos / Music Card UI
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
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-[#181818] transition-all duration-200">
                    <img
                      src={vid.thumbnail}
                      alt={vid.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                    />

                    {/* Play Hover Overlay */}
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className={`h-10 w-10 rounded-full text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform ${
                        activeSubTab === "music" ? "bg-amber-600" : "bg-red-600"
                      }`}>
                        <Play size={18} className="fill-white ml-0.5" />
                      </div>
                    </div>

                    {/* Music specific tag */}
                    {activeSubTab === "music" && (
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-amber-600/90 text-white font-bold text-[9px] tracking-wider uppercase flex items-center gap-1 z-10 shadow-sm">
                        <Music size={9} />
                        <span>Music</span>
                      </div>
                    )}

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
                      className={`absolute top-2 right-2 h-7 w-7 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                        saved
                          ? (activeSubTab === "music" ? "bg-amber-600" : "bg-red-600") + " text-white shadow-md"
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
