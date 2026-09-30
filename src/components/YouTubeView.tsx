import React, { useState, useEffect, useDeferredValue } from "react";
import {
  Search,
  Flame,
  Gamepad2,
  Tv,
  Cpu,
  Mic,
  BookOpen,
  Film,
  Play,
  Volume2,
  X,
  ExternalLink,
  Eye,
  CheckCircle,
  Share2,
  Sparkles,
} from "lucide-react";
import { YouTubeVideo } from "../types";
import { useMusicPlayer, AudioTrack } from "../context/MusicPlayerContext";

interface YouTubeViewProps {
  isActive?: boolean;
  onBackToHome?: () => void;
  onActiveVideoChange?: (title: string | null) => void;
}

const YOUTUBE_CATEGORIES = [
  { id: "all", label: "Trending", icon: Flame },
  { id: "gaming", label: "Gaming", icon: Gamepad2 },
  { id: "entertainment", label: "Entertainment", icon: Tv },
  { id: "tech", label: "Tech & Science", icon: Cpu },
  { id: "podcasts", label: "Podcasts", icon: Mic },
  { id: "music", label: "Music Videos", icon: Film },
  { id: "study", label: "Tutorials & Study", icon: BookOpen },
];

const POPULAR_SEARCHES = [
  "Minecraft Gameplay",
  "MrBeast",
  "Veritasium",
  "Joe Rogan Experience",
  "Lofi Girl Live",
  "Tech News 2026",
  "GTA 6 News",
  "Marques Brownlee",
  "Kurzgesagt",
];

export default function YouTubeView({
  isActive = true,
  onBackToHome,
  onActiveVideoChange,
}: YouTubeViewProps) {
  const { playTrack } = useMusicPlayer();
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDeferredValue(searchQuery);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeWatchVideo, setActiveWatchVideo] = useState<YouTubeVideo | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Fetch videos from backend
  useEffect(() => {
    let isCancelled = false;

    async function fetchVideos() {
      setIsLoading(true);
      try {
        const query = deferredSearch.trim();
        let endpoint = "";
        if (query) {
          endpoint = `/api/youtube/search?q=${encodeURIComponent(query)}`;
        } else {
          endpoint = `/api/youtube/trending?category=${selectedCategory}`;
        }

        const res = await fetch(endpoint);
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        const items = data.videos || data.tracks || [];

        if (!isCancelled && Array.isArray(items)) {
          setVideos(
            items.map((item: any) => ({
              id: item.id || `yt-${Date.now()}`,
              title: item.title || "YouTube Video",
              channelTitle: item.channelTitle || item.artist || "YouTube Creator",
              views: item.views || "Popular",
              duration: item.duration || "10:00",
              thumbnail: item.thumbnail || `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
              description: item.descriptionSnippet || item.description || "",
              mediaType: "video",
              isMusic: Boolean(item.isMusic),
              permalinkUrl: `https://www.youtube.com/watch?v=${(item.id || "").replace(/^yt-/, "")}`,
            }))
          );
        }
      } catch (err) {
        console.warn("YouTube search error:", err);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }

    fetchVideos();

    return () => {
      isCancelled = true;
    };
  }, [deferredSearch, selectedCategory]);

  useEffect(() => {
    if (onActiveVideoChange) {
      onActiveVideoChange(activeWatchVideo ? activeWatchVideo.title : null);
    }
  }, [activeWatchVideo, onActiveVideoChange]);

  const handlePlayInAudio = (v: YouTubeVideo, e: React.MouseEvent) => {
    e.stopPropagation();
    const cleanId = (v.id || "").replace(/^yt-/, "");
    const track: AudioTrack = {
      id: `yt-${cleanId}`,
      title: v.title,
      artist: v.channelTitle || "YouTube Creator",
      channelTitle: v.channelTitle,
      duration: v.duration,
      thumbnail: v.thumbnail,
      mediaType: "audio",
      isMusic: true,
      sourceType: "youtube",
      permalinkUrl: `https://www.youtube.com/watch?v=${cleanId}`,
      mediaUrl: `/api/youtube/stream/${cleanId}`,
    };
    playTrack(track);
  };

  const handleCopyLink = (videoId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `https://www.youtube.com/watch?v=${videoId.replace(/^yt-/, "")}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 space-y-6 flex flex-col flex-1 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-500 shadow-md">
            <Film size={20} />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <span>YouTube Video Hub</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                All Videos & Gaming
              </span>
            </h1>
            <p className="text-xs text-neutral-400">
              Explore gaming, podcasts, tutorials, documentaries, entertainment & all YouTube content
            </p>
          </div>
        </div>

        {onBackToHome && (
          <button
            onClick={onBackToHome}
            className="px-3.5 py-1.5 rounded-xl border border-white/10 hover:border-white/20 text-xs font-semibold text-neutral-300 hover:text-white transition-colors cursor-pointer"
          >
            Back to Games
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 bg-[#121522] p-2 rounded-2xl border border-white/10 shadow-inner focus-within:border-red-500/60 transition-colors">
          <div className="pl-3 text-neutral-400">
            <Search size={16} />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search all of YouTube: gaming, tech, podcasts, comedy, tutorials..."
            className="flex-1 bg-transparent text-sm text-white placeholder-neutral-500 focus:outline-none px-2"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="p-1.5 text-neutral-400 hover:text-white"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Popular Search Suggestions */}
        {!searchQuery && selectedCategory === "all" && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs text-neutral-400">
            <span className="text-[11px] font-bold text-neutral-500 mr-1 shrink-0">Popular:</span>
            {POPULAR_SEARCHES.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => setSearchQuery(term)}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white text-[11px] whitespace-nowrap transition-colors cursor-pointer shrink-0"
              >
                {term}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar select-none">
        {YOUTUBE_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = selectedCategory === cat.id && !searchQuery;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setSelectedCategory(cat.id);
                setSearchQuery("");
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                isActive
                  ? "bg-red-600 border-red-500 text-white shadow-md shadow-red-600/30"
                  : "bg-white/5 border-white/5 text-neutral-400 hover:text-white hover:bg-white/10"
              }`}
            >
              <Icon size={14} className={isActive ? "text-white" : "text-neutral-400"} />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Video Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 py-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse space-y-3 bg-white/5 p-3 rounded-2xl border border-white/5">
              <div className="w-full aspect-video bg-white/10 rounded-xl" />
              <div className="h-4 bg-white/10 rounded w-3/4" />
              <div className="h-3 bg-white/5 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : videos.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center border border-white/5 rounded-3xl bg-white/[0.02]">
          <Film size={40} className="text-neutral-600 mb-3" />
          <h3 className="text-base font-bold text-white mb-1">No videos found</h3>
          <p className="text-xs text-neutral-400">Try searching with different keywords</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {videos.map((video) => {
            const cleanId = (video.id || "").replace(/^yt-/, "");
            return (
              <div
                key={video.id}
                onClick={() => setActiveWatchVideo(video)}
                className="group relative flex flex-col bg-[#111420]/80 hover:bg-[#161a29] border border-white/5 hover:border-white/15 rounded-2xl overflow-hidden shadow-lg transition-all duration-200 cursor-pointer hover:shadow-xl hover:-translate-y-0.5"
              >
                {/* Thumbnail Container */}
                <div className="relative aspect-video w-full overflow-hidden bg-black/60">
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  {video.duration && (
                    <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/85 text-[11px] font-mono font-bold text-white shadow">
                      {video.duration}
                    </span>
                  )}
                  {/* Hover Overlay Button */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      className="w-10 h-10 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform cursor-pointer"
                      title="Watch Video"
                    >
                      <Play size={18} className="fill-white translate-x-0.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handlePlayInAudio(video, e)}
                      className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md text-white flex items-center justify-center shadow-lg transition-colors cursor-pointer"
                      title="Play in Background Music Player"
                    >
                      <Volume2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="p-3 flex flex-col flex-1 justify-between gap-2">
                  <h3
                    className="text-xs sm:text-sm font-bold text-white line-clamp-2 group-hover:text-red-400 transition-colors"
                    title={video.title}
                  >
                    {video.title}
                  </h3>

                  <div className="flex items-center justify-between text-[11px] text-neutral-400">
                    <span className="truncate max-w-[150px] font-medium text-neutral-300">
                      {video.channelTitle}
                    </span>
                    {video.views && (
                      <span className="shrink-0 text-neutral-500 flex items-center gap-1">
                        <Eye size={11} />
                        {video.views}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Video Watch Theater Modal */}
      {activeWatchVideo && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
          <div className="relative w-full max-w-4xl bg-[#121524] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[95vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#0e111d]">
              <div className="flex items-center gap-2 truncate mr-3">
                <Film size={16} className="text-red-400 shrink-0" />
                <h3 className="text-sm font-bold text-white truncate">
                  {activeWatchVideo.title}
                </h3>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={(e) => handleCopyLink(activeWatchVideo.id, e)}
                  className="px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-neutral-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Share2 size={12} />
                  <span>{copiedLink ? "Copied!" : "Share"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveWatchVideo(null)}
                  className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Embed Video Player */}
            <div className="relative w-full aspect-video bg-black">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${activeWatchVideo.id.replace(/^yt-/, "")}?autoplay=1&playsinline=1&rel=0`}
                title={activeWatchVideo.title}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>

            {/* Video Info Footer */}
            <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#0e111d] border-t border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-400 font-bold text-sm">
                  {activeWatchVideo.channelTitle?.[0] || "Y"}
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                    <span>{activeWatchVideo.channelTitle}</span>
                    <CheckCircle size={12} className="text-blue-400" />
                  </h4>
                  <p className="text-[11px] text-neutral-400">
                    {activeWatchVideo.views}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => handlePlayInAudio(activeWatchVideo, e)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-indigo-600/30"
                >
                  <Volume2 size={14} />
                  <span>Listen in Audio Player</span>
                </button>
                <a
                  href={`https://www.youtube.com/watch?v=${activeWatchVideo.id.replace(/^yt-/, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <ExternalLink size={13} />
                  <span>YouTube</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
