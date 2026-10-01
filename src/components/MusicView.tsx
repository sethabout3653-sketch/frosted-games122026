import React, { useState, useEffect, useDeferredValue, useRef } from "react";
import {
  Music,
  Search,
  Headphones,
  Flame,
  Radio,
  Sparkles,
  Heart,
  History,
  TrendingUp,
  Sliders,
  Terminal,
  Upload,
  Play,
  Pause,
  Plus,
  Disc,
  X,
  Volume2,
  VolumeX,
  FolderPlus,
  Layers,
  ArrowRight,
  Link as LinkIcon,
  Check,
  LayoutGrid,
  List as ListIcon,
  Shuffle,
  Clock,
  Share2,
  Maximize2,
  Zap,
  Music2,
  ListMusic,
  ExternalLink,
} from "lucide-react";
import {
  useMusicPlayer,
  CURATED_RADIO_STATIONS,
  AudioTrack,
} from "../context/MusicPlayerContext";
import MusicPlayer from "./MusicPlayer";
import AudioEqualizerModal from "./AudioEqualizerModal";
import YtDlpPipelineDrawer from "./YtDlpPipelineDrawer";
import MusicVisualizer from "./MusicVisualizer";
import { getSavedVideos, getWatchHistory, toggleSaveVideo, isVideoSaved } from "../lib/youtubeStorage";

interface MusicViewProps {
  isActive?: boolean;
  onBackToHome?: () => void;
}

type MainTab = "discover" | "chillhop" | "synthwave" | "collection" | "studio";

const QUICK_SUGGESTIONS = [
  "Chillhop Music",
  "Synthwave",
  "Flamingosis",
  "ODESZA",
  "San Holo",
  "Kudasai",
  "idealism",
  "potsu",
  "Tycho",
  "Petit Biscuit",
];

export default function MusicView({
  isActive = true,
  onBackToHome,
}: MusicViewProps) {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    playTrack,
    togglePlay,
    addToQueue,
    seek,
    volume,
    setVolume,
    isMuted,
    toggleMute,
    toggleShuffle,
    isShuffle,
    resolveAndPlayUrl,
    importLocalFiles,
    customPlaylists,
    createCustomPlaylist,
    isResolvingUrl,
    activePreset,
    bassBoost,
    sleepTimerRemaining,
  } = useMusicPlayer();

  const [activeTab, setActiveTab] = useState<MainTab>("discover");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const deferredSearch = useDeferredValue(searchQuery);
  const [tracks, setTracks] = useState<AudioTrack[]>(CURATED_RADIO_STATIONS);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isEqOpen, setIsEqOpen] = useState<boolean>(false);
  const [isPipelineOpen, setIsPipelineOpen] = useState<boolean>(false);
  const [urlStatus, setUrlStatus] = useState<string | null>(null);
  const [copiedTrackId, setCopiedTrackId] = useState<string | null>(null);
  const [collectionSubTab, setCollectionSubTab] = useState<"favorites" | "history" | "playlists" | "local">("favorites");
  const [newPlaylistTitle, setNewPlaylistTitle] = useState("");
  const [showNewPlaylistModal, setShowNewPlaylistModal] = useState(false);

  const isDirectUrl = /^(https?:\/\/)?(www\.)?(soundcloud\.com|snd\.sc)\/.+$/i.test(
    searchQuery.trim()
  );

  // SpotLight Track (Currently Playing OR First Curated Track)
  const spotlightTrack = currentTrack || tracks[0] || CURATED_RADIO_STATIONS[0];
  const isSpotlightSaved = isVideoSaved(spotlightTrack.id);

  // Format seconds into m:ss
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs <= 0) return "0:00";
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${mins}:${s < 10 ? "0" : ""}${s}`;
  };

  // Fetch tracks based on active tab and search
  useEffect(() => {
    let isCancelled = false;

    if (activeTab === "collection") {
      if (collectionSubTab === "favorites") {
        const saved = getSavedVideos();
        setTracks(
          saved.map((v) => ({
            ...v,
            mediaType: "audio",
            isMusic: true,
            sourceType: "soundcloud",
          }))
        );
        return;
      }

      if (collectionSubTab === "history") {
        const history = getWatchHistory();
        setTracks(
          history.map((h) => ({
            ...h.video,
            mediaType: "audio",
            isMusic: true,
            sourceType: "soundcloud",
          }))
        );
        return;
      }

      if (collectionSubTab === "playlists") {
        const allPlaylistTracks = customPlaylists.flatMap((p) => p.tracks);
        setTracks(allPlaylistTracks);
        return;
      }

      if (collectionSubTab === "local") {
        return;
      }
    }

    if (activeTab === "studio") {
      return;
    }

    async function fetchSoundCloudTracks() {
      setIsLoading(true);
      setUrlStatus(null);
      try {
        const query = deferredSearch.trim();

        if (query) {
          // Direct SoundCloud URL Extraction
          if (isDirectUrl) {
            setUrlStatus("Resolving audio stream...");
            try {
              const res = await fetch(`/api/soundcloud/resolve?url=${encodeURIComponent(query)}`);
              if (res.ok) {
                const item = await res.json();
                if (!isCancelled && item && item.id) {
                  const resolved: AudioTrack = {
                    id: item.id,
                    title: item.title || "SoundCloud Track",
                    channelTitle: item.artist || "SoundCloud Artist",
                    artist: item.artist || "SoundCloud Artist",
                    thumbnail: item.thumbnail || "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&q=80",
                    duration: item.duration || "3:30",
                    mediaType: "audio",
                    isMusic: true,
                    permalinkUrl: item.permalinkUrl || query,
                    mediaUrl: item.mediaUrl || `/api/soundcloud/stream?url=${encodeURIComponent(query)}`,
                    sourceType: "soundcloud",
                  };
                  setTracks([resolved]);
                  setUrlStatus("Track stream resolved!");
                  setIsLoading(false);
                  return;
                }
              }
            } catch (e) {}
          }

          // SoundCloud Search
          const searchRes = await fetch(`/api/soundcloud/search?q=${encodeURIComponent(query)}`).catch(() => null);
          if (searchRes && searchRes.ok) {
            const data = await searchRes.json().catch(() => null);
            const items = data?.tracks || [];
            if (!isCancelled && Array.isArray(items) && items.length > 0) {
              setTracks(items);
              setIsLoading(false);
              return;
            }
          }
        } else {
          // Category-based fetch
          const categoryParam = activeTab === "chillhop" ? "study" : activeTab === "synthwave" ? "electronic" : "all";
          const trendRes = await fetch(`/api/soundcloud/trending?category=${categoryParam}`).catch(() => null);
          if (trendRes && trendRes.ok) {
            const data = await trendRes.json().catch(() => null);
            const items = data?.tracks || [];
            if (!isCancelled && Array.isArray(items) && items.length > 0) {
              setTracks(items);
              setIsLoading(false);
              return;
            }
          }
        }

        // Final fallback
        if (!isCancelled) {
          if (activeTab === "chillhop") {
            setTracks(CURATED_RADIO_STATIONS.filter((t) => t.id.includes("chillhop") || t.id.includes("kudasai") || t.id.includes("idealism") || t.id.includes("potsu") || t.id.includes("sleepy")));
          } else if (activeTab === "synthwave") {
            setTracks(CURATED_RADIO_STATIONS.filter((t) => t.id.includes("synthwave") || t.id.includes("tycho") || t.id.includes("odesza") || t.id.includes("bonobo")));
          } else {
            setTracks(CURATED_RADIO_STATIONS);
          }
        }
      } catch (err) {
        if (!isCancelled) {
          setTracks(CURATED_RADIO_STATIONS);
        }
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }

    fetchSoundCloudTracks();

    return () => {
      isCancelled = true;
    };
  }, [activeTab, collectionSubTab, deferredSearch, isDirectUrl, customPlaylists]);

  // Handle Form Submit (Search or Direct Link)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    if (isDirectUrl) {
      setUrlStatus("Connecting to stream...");
      const res = await resolveAndPlayUrl(query);
      if (res.success && res.track) {
        setUrlStatus("Playback started!");
      } else {
        setUrlStatus(`Error: ${res.error || "Could not resolve audio stream"}`);
      }
    } else if (tracks.length > 0) {
      playTrack(tracks[0], tracks);
    }
  };

  const handleCopyLink = (track: AudioTrack) => {
    const url = track.permalinkUrl || track.mediaUrl || window.location.href;
    navigator.clipboard.writeText(url);
    setCopiedTrackId(track.id);
    setTimeout(() => setCopiedTrackId(null), 2000);
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      importLocalFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      importLocalFiles(e.target.files);
    }
  };

  const handleCreatePlaylist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistTitle.trim()) return;
    createCustomPlaylist(newPlaylistTitle.trim());
    setNewPlaylistTitle("");
    setShowNewPlaylistModal(false);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 flex flex-col flex-1 animate-fadeIn">
      {/* Top Header & Navigation Bar */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-white/10">
        {/* Brand & Subtitle */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#ff5500] to-[#ff2200] flex items-center justify-center text-white shadow-lg shadow-[#ff5500]/25 shrink-0">
            <Radio size={22} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-white tracking-tight">
                SoundCloud Music
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#ff5500]/15 text-[#ff7700] border border-[#ff5500]/30 uppercase tracking-wide">
                Hi-Fi Audio
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Live streaming, lo-fi beats, synthwave & 10-band studio DSP
            </p>
          </div>
        </div>

        {/* Primary Tab Navigation & View Mode Toggles */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full lg:w-auto">
          {/* Main Segmented Tabs */}
          <div className="flex items-center gap-1 p-1 bg-white/5 border border-white/10 rounded-2xl overflow-x-auto no-scrollbar w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                setActiveTab("discover");
                setSearchQuery("");
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "discover"
                  ? "bg-[#ff5500] text-white shadow-md shadow-[#ff5500]/30"
                  : "text-neutral-400 hover:text-white"
              }`}
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
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "chillhop"
                  ? "bg-[#ff5500] text-white shadow-md shadow-[#ff5500]/30"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <Headphones size={14} />
              <span>Lo-Fi & Chill</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("synthwave");
                setSearchQuery("");
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "synthwave"
                  ? "bg-[#ff5500] text-white shadow-md shadow-[#ff5500]/30"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <Zap size={14} />
              <span>Synthwave</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("collection");
                setSearchQuery("");
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "collection"
                  ? "bg-[#ff5500] text-white shadow-md shadow-[#ff5500]/30"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <Heart size={14} />
              <span>Collection</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("studio")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "studio"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/40"
                  : "text-indigo-400 hover:text-indigo-300"
              }`}
            >
              <Disc size={14} className={activeTab === "studio" ? "animate-spin" : ""} />
              <span>Studio Deck</span>
            </button>
          </div>

          {/* Equalizer & View Mode Controls */}
          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            <button
              type="button"
              onClick={() => setIsEqOpen(true)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
              title="Open 10-Band Equalizer"
            >
              <Sliders size={15} className="text-[#ff7700]" />
              <span className="hidden sm:inline">EQ</span>
            </button>

            {activeTab !== "studio" && (
              <div className="flex items-center gap-1 p-1 bg-white/5 border border-white/10 rounded-xl">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    viewMode === "grid"
                      ? "bg-white/20 text-white shadow-sm"
                      : "text-neutral-400 hover:text-white"
                  }`}
                  title="Grid Layout"
                >
                  <LayoutGrid size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    viewMode === "list"
                      ? "bg-white/20 text-white shadow-sm"
                      : "text-neutral-400 hover:text-white"
                  }`}
                  title="Compact List Layout"
                >
                  <ListIcon size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Render Full Studio Deck if activeTab is 'studio' */}
      {activeTab === "studio" ? (
        <MusicPlayer onBack={() => setActiveTab("discover")} />
      ) : (
        <>
          {/* Spotlight Hero Deck (Widescreen Glass Banner) */}
          {activeTab === "discover" && !searchQuery && spotlightTrack && (
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#141829] via-[#101322] to-[#0c0e18] border border-white/10 shadow-2xl p-6 sm:p-8">
              {/* Background ambient light mesh derived from artwork */}
              <div
                className="absolute -top-32 -right-32 w-96 h-96 rounded-full blur-3xl pointer-events-none opacity-20 bg-[#ff5500]"
              />
              <div
                className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full blur-3xl pointer-events-none opacity-20 bg-indigo-600"
              />

              <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
                {/* Square Album Cover with Live Soundwave Indicator */}
                <div className="relative group shrink-0 w-44 h-44 sm:w-48 sm:h-48 rounded-2xl overflow-hidden shadow-2xl bg-black/60 border border-white/10">
                  <img
                    src={spotlightTrack.thumbnail}
                    alt={spotlightTrack.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />

                  {isPlaying && currentTrack?.id === spotlightTrack.id && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center gap-1 px-4">
                      <div className="w-1.5 h-8 bg-[#ff5500] rounded-full animate-bounce" />
                      <div className="w-1.5 h-12 bg-white rounded-full animate-bounce [animation-delay:0.2s]" />
                      <div className="w-1.5 h-6 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                      <div className="w-1.5 h-10 bg-[#ff5500] rounded-full animate-bounce [animation-delay:0.1s]" />
                    </div>
                  )}

                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-black/70 backdrop-blur-md text-[10px] font-bold uppercase tracking-wider text-white border border-white/10 flex items-center gap-1">
                    <Sparkles size={10} className="text-[#ff7700]" />
                    <span>Featured</span>
                  </div>
                </div>

                {/* Hero Details & Interactive Player Controls */}
                <div className="flex-1 min-w-0 space-y-4 text-center md:text-left">
                  <div className="space-y-1">
                    <div className="flex items-center justify-center md:justify-start gap-2 text-xs text-neutral-400">
                      <span>SoundCloud Master Audio</span>
                      <span>·</span>
                      <span>{spotlightTrack.views || "1.5M plays"}</span>
                      <span>·</span>
                      <span className="font-mono text-neutral-300">{spotlightTrack.duration || "3:30"}</span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-snug">
                      {spotlightTrack.title}
                    </h2>
                    <p className="text-sm font-semibold text-[#ff7700]">
                      {spotlightTrack.artist || spotlightTrack.channelTitle || "SoundCloud Artist"}
                    </p>
                  </div>

                  {spotlightTrack.descriptionSnippet && (
                    <p className="text-xs text-neutral-400 max-w-xl line-clamp-2 leading-relaxed">
                      {spotlightTrack.descriptionSnippet}
                    </p>
                  )}

                  {/* Primary CTA Buttons */}
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
                      className="px-6 py-3 rounded-2xl bg-gradient-to-r from-[#ff5500] to-[#ff3300] hover:from-[#ff6600] hover:to-[#ff4400] text-white font-bold text-xs transition-all cursor-pointer shadow-lg shadow-[#ff5500]/30 hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
                    >
                      {isPlaying && currentTrack?.id === spotlightTrack.id ? (
                        <>
                          <Pause size={16} className="fill-white" />
                          <span>Pause Track</span>
                        </>
                      ) : (
                        <>
                          <Play size={16} className="fill-white translate-x-0.5" />
                          <span>Play Now</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => addToQueue(spotlightTrack)}
                      className="px-4 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs transition-all cursor-pointer flex items-center gap-2"
                    >
                      <Plus size={14} />
                      <span>Add to Queue</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleSaveVideo(spotlightTrack)}
                      className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 hover:text-rose-400 transition-colors cursor-pointer"
                      title={isSpotlightSaved ? "Saved to Favorites" : "Save to Favorites"}
                    >
                      <Heart size={16} className={isSpotlightSaved ? "fill-rose-500 text-rose-500" : ""} />
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab("studio")}
                      className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                      title="Open in Studio Deck"
                    >
                      <Disc size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Search Bar & Direct URL Resolver */}
          <form onSubmit={handleSubmit} className="space-y-2">
            <div className="flex items-center gap-2 bg-[#121524] p-2.5 rounded-2xl border border-white/10 shadow-inner focus-within:border-[#ff5500]/70 transition-colors">
              <div className="pl-3 text-neutral-400">
                {isDirectUrl ? <LinkIcon size={18} className="text-[#ff5500]" /> : <Search size={18} />}
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search SoundCloud tracks, artists, or paste any SoundCloud link..."
                className="flex-1 bg-transparent text-sm text-white placeholder-neutral-500 focus:outline-none px-2"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="p-1.5 text-neutral-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              )}

              <button
                type="submit"
                disabled={!searchQuery.trim()}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#ff5500] to-[#ff3300] hover:opacity-90 disabled:opacity-40 text-white text-xs font-bold transition-all cursor-pointer shrink-0 shadow-md shadow-[#ff5500]/30 flex items-center gap-1.5"
              >
                {isDirectUrl ? (
                  <>
                    <Play size={12} className="fill-white" />
                    <span>Play Stream</span>
                  </>
                ) : (
                  <span>Search</span>
                )}
              </button>
            </div>

            {/* Quick Suggestion Pills */}
            {!searchQuery && activeTab !== "collection" && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs text-neutral-400">
                <span className="text-[11px] font-bold text-neutral-500 shrink-0">Popular Artists:</span>
                {QUICK_SUGGESTIONS.map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => setSearchQuery(sug)}
                    className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer shrink-0 border border-white/5"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            )}

            {urlStatus && (
              <div className="px-3.5 py-2 rounded-xl bg-[#ff5500]/10 border border-[#ff5500]/30 text-xs font-mono text-[#ff8800] flex items-center gap-2">
                <span className="animate-spin">&bull;</span>
                <span>{urlStatus}</span>
              </div>
            )}
          </form>

          {/* Collection Sub-Tabs Navigation */}
          {activeTab === "collection" && (
            <div className="flex items-center justify-between gap-4 pb-2 border-b border-white/5 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCollectionSubTab("favorites")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    collectionSubTab === "favorites"
                      ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
                      : "bg-white/5 text-neutral-400 hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Heart size={14} className={collectionSubTab === "favorites" ? "fill-white" : ""} />
                    <span>Favorites ({getSavedVideos().length})</span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setCollectionSubTab("history")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    collectionSubTab === "history"
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                      : "bg-white/5 text-neutral-400 hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <History size={14} />
                    <span>Recently Played ({getWatchHistory().length})</span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setCollectionSubTab("playlists")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    collectionSubTab === "playlists"
                      ? "bg-amber-600 text-white shadow-md shadow-amber-600/30"
                      : "bg-white/5 text-neutral-400 hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <ListMusic size={14} />
                    <span>Playlists ({customPlaylists.length})</span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setCollectionSubTab("local")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    collectionSubTab === "local"
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                      : "bg-white/5 text-neutral-400 hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Upload size={14} />
                    <span>Local Files</span>
                  </span>
                </button>
              </div>

              {collectionSubTab === "playlists" && (
                <button
                  type="button"
                  onClick={() => setShowNewPlaylistModal(true)}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  <FolderPlus size={14} />
                  <span>New Playlist</span>
                </button>
              )}
            </div>
          )}

          {/* Local Audio File Dropzone */}
          {activeTab === "collection" && collectionSubTab === "local" && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              className="border-2 border-dashed border-[#ff5500]/30 hover:border-[#ff5500]/60 bg-[#ff5500]/5 rounded-3xl p-12 text-center space-y-4 transition-colors cursor-pointer"
            >
              <div className="w-16 h-16 rounded-3xl bg-[#ff5500]/10 border border-[#ff5500]/20 flex items-center justify-center text-[#ff5500] mx-auto">
                <Upload size={28} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">Drag & Drop Audio Files</h3>
                <p className="text-xs text-neutral-400 max-w-md mx-auto">
                  Play MP3, WAV, FLAC, M4A, or OGG tracks instantly with zero upload time.
                </p>
              </div>
              <div>
                <label className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#ff5500] to-[#ff3300] hover:opacity-90 text-white text-xs font-bold transition-all cursor-pointer shadow-lg shadow-[#ff5500]/30">
                  <FolderPlus size={14} />
                  <span>Select Audio Files</span>
                  <input
                    type="file"
                    multiple
                    accept="audio/*,.mp3,.wav,.flac,.m4a,.ogg"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}

          {/* Track Catalog Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-neutral-400">
              <span className="font-bold uppercase tracking-wider text-neutral-300">
                {searchQuery
                  ? `Results for "${searchQuery}"`
                  : activeTab === "chillhop"
                  ? "Lo-Fi & Study Station Tracks"
                  : activeTab === "synthwave"
                  ? "Synthwave & Electronic Tracks"
                  : activeTab === "collection"
                  ? `${collectionSubTab.toUpperCase()} Tracks`
                  : "Curated SoundCloud Releases"}
              </span>
              <span>{tracks.length} tracks</span>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div
                    key={i}
                    className="bg-[#121524] rounded-2xl p-4 space-y-3 border border-white/5 animate-pulse"
                  >
                    <div className="aspect-square rounded-xl bg-white/5" />
                    <div className="h-4 bg-white/10 rounded w-3/4" />
                    <div className="h-3 bg-white/5 rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : tracks.length === 0 ? (
              <div className="p-16 text-center text-neutral-400 space-y-3 bg-[#101322] border border-white/5 rounded-3xl">
                <Disc size={36} className="mx-auto text-neutral-500" />
                <p className="text-sm font-semibold text-white">No tracks found</p>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                  Try searching for an artist like &quot;Chillhop Music&quot; or pasting a SoundCloud URL above.
                </p>
              </div>
            ) : viewMode === "grid" ? (
              /* GRID VIEW */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {tracks.map((track, idx) => {
                  const isCurrentlyPlaying = currentTrack?.id === track.id && isPlaying;
                  const isTrackSaved = isVideoSaved(track.id);

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
                      className={`group bg-[#121524] hover:bg-[#181c30] border rounded-2xl p-3.5 flex flex-col space-y-3 transition-all duration-200 cursor-pointer shadow-lg relative overflow-hidden ${
                        isCurrentlyPlaying
                          ? "border-[#ff5500]/60 ring-1 ring-[#ff5500]/40 shadow-[#ff5500]/10"
                          : "border-white/5 hover:border-white/20"
                      }`}
                    >
                      {/* Square Album Cover */}
                      <div className="aspect-square rounded-xl overflow-hidden bg-black/60 relative border border-white/5">
                        <img
                          src={track.thumbnail}
                          alt={track.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                          loading="lazy"
                        />

                        {/* Top Soundcloud Source Tag */}
                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[9px] font-bold tracking-wider uppercase text-white border border-white/10 flex items-center gap-1">
                          <Radio size={10} className="text-[#ff7700]" />
                          <span>SoundCloud</span>
                        </div>

                        {/* Duration Badge */}
                        {track.duration && (
                          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md font-mono text-[10px] text-white">
                            {track.duration}
                          </div>
                        )}

                        {/* Hover Play Overlay */}
                        <div
                          className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${
                            isCurrentlyPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                          }`}
                        >
                          <div className="w-12 h-12 rounded-full bg-[#ff5500] text-white flex items-center justify-center shadow-xl shadow-[#ff5500]/50 group-hover:scale-110 transition-transform">
                            {isCurrentlyPlaying ? (
                              <Pause size={20} className="fill-white" />
                            ) : (
                              <Play size={20} className="fill-white translate-x-0.5" />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Track Details */}
                      <div className="flex items-start justify-between gap-2 min-w-0 flex-1">
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-white truncate group-hover:text-[#ff7700] transition-colors leading-tight">
                            {track.title}
                          </h4>
                          <p className="text-[11px] text-neutral-400 truncate mt-1">
                            {track.artist || track.channelTitle || "SoundCloud Artist"}
                          </p>
                        </div>

                        {/* Quick Card Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSaveVideo(track);
                            }}
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-400 transition-colors"
                            title={isTrackSaved ? "Saved" : "Favorite"}
                          >
                            <Heart size={14} className={isTrackSaved ? "fill-rose-500 text-rose-500" : ""} />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              addToQueue(track);
                            }}
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
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
              /* COMPACT LIST VIEW */
              <div className="bg-[#121524] border border-white/10 rounded-2xl overflow-hidden shadow-xl divide-y divide-white/5">
                {tracks.map((track, idx) => {
                  const isCurrentlyPlaying = currentTrack?.id === track.id && isPlaying;
                  const isTrackSaved = isVideoSaved(track.id);

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
                      className={`flex items-center justify-between gap-4 p-3.5 hover:bg-white/5 transition-colors cursor-pointer group ${
                        isCurrentlyPlaying ? "bg-[#ff5500]/10" : ""
                      }`}
                    >
                      {/* Left: Index, Thumbnail, Title & Artist */}
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <span className="w-5 text-center text-xs font-mono text-neutral-500 group-hover:text-white">
                          {isCurrentlyPlaying ? (
                            <span className="w-2 h-2 rounded-full bg-[#ff5500] inline-block animate-ping" />
                          ) : (
                            idx + 1
                          )}
                        </span>

                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-black/60 shrink-0 border border-white/10 relative">
                          <img
                            src={track.thumbnail}
                            alt={track.title}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <h4
                            className={`text-xs font-bold truncate leading-tight ${
                              isCurrentlyPlaying ? "text-[#ff7700]" : "text-white group-hover:text-[#ff7700]"
                            }`}
                          >
                            {track.title}
                          </h4>
                          <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                            {track.artist || track.channelTitle || "SoundCloud Artist"}
                          </p>
                        </div>
                      </div>

                      {/* Right: Duration & Actions */}
                      <div className="flex items-center gap-3 shrink-0">
                        {track.duration && (
                          <span className="font-mono text-xs text-neutral-400 tabular-nums">
                            {track.duration}
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSaveVideo(track);
                          }}
                          className="p-1.5 text-neutral-400 hover:text-rose-400 transition-colors"
                          title={isTrackSaved ? "Saved" : "Favorite"}
                        >
                          <Heart size={15} className={isTrackSaved ? "fill-rose-500 text-rose-500" : ""} />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            addToQueue(track);
                          }}
                          className="p-1.5 text-neutral-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                          title="Add to queue"
                        >
                          <Plus size={15} />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyLink(track);
                          }}
                          className="p-1.5 text-neutral-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                          title="Share Link"
                        >
                          {copiedTrackId === track.id ? (
                            <Check size={15} className="text-emerald-400" />
                          ) : (
                            <Share2 size={15} />
                          )}
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

      {/* New Custom Playlist Modal */}
      {showNewPlaylistModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md bg-[#121524] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FolderPlus size={18} className="text-[#ff7700]" />
                <span>Create Playlist</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowNewPlaylistModal(false)}
                className="p-1.5 text-neutral-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreatePlaylist} className="space-y-4">
              <input
                type="text"
                value={newPlaylistTitle}
                onChange={(e) => setNewPlaylistTitle(e.target.value)}
                placeholder="Playlist Title (e.g. Late Night Coding, Study Vibes)"
                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-2xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#ff5500]"
                autoFocus
              />

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewPlaylistModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newPlaylistTitle.trim()}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#ff5500] to-[#ff3300] disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-[#ff5500]/30 cursor-pointer"
                >
                  Create Playlist
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audio Equalizer Modal */}
      <AudioEqualizerModal isOpen={isEqOpen} onClose={() => setIsEqOpen(false)} />
      <YtDlpPipelineDrawer isOpen={isPipelineOpen} onClose={() => setIsPipelineOpen(false)} />
    </div>
  );
}
