import React, { useState, useEffect, useDeferredValue } from "react";
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
  Upload,
  Play,
  Pause,
  Plus,
  Disc,
  X,
  Volume2,
  FolderPlus,
  LayoutGrid,
  List as ListIcon,
  Shuffle,
  Share2,
  Check,
  ListMusic,
  SlidersHorizontal,
} from "lucide-react";
import {
  useMusicPlayer,
  CURATED_RADIO_STATIONS,
  AudioTrack,
} from "../context/MusicPlayerContext";
import MusicPlayer from "./MusicPlayer";
import AudioEqualizerModal from "./AudioEqualizerModal";
import { getSavedVideos, getWatchHistory, toggleSaveVideo, isVideoSaved } from "../lib/youtubeStorage";

interface MusicViewProps {
  isActive?: boolean;
  onBackToHome?: () => void;
}

type MainTab = "discover" | "chillhop" | "synthwave" | "collection" | "player";

const FEATURED_ARTISTS = [
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
    playTrack,
    togglePlay,
    addToQueue,
    resolveAndPlayUrl,
    importLocalFiles,
    customPlaylists,
    createCustomPlaylist,
    activePreset,
  } = useMusicPlayer();

  const [activeTab, setActiveTab] = useState<MainTab>("discover");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const deferredSearch = useDeferredValue(searchQuery);
  const [tracks, setTracks] = useState<AudioTrack[]>(CURATED_RADIO_STATIONS);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isEqOpen, setIsEqOpen] = useState<boolean>(false);
  const [urlStatus, setUrlStatus] = useState<string | null>(null);
  const [copiedTrackId, setCopiedTrackId] = useState<string | null>(null);
  const [collectionSubTab, setCollectionSubTab] = useState<"favorites" | "history" | "playlists" | "local">("favorites");
  const [newPlaylistTitle, setNewPlaylistTitle] = useState("");
  const [showNewPlaylistModal, setShowNewPlaylistModal] = useState(false);

  const isDirectUrl = /^(https?:\/\/)?(www\.)?(soundcloud\.com|snd\.sc)\/.+$/i.test(
    searchQuery.trim()
  );

  const spotlightTrack = currentTrack || tracks[0] || CURATED_RADIO_STATIONS[0];
  const isSpotlightSaved = isVideoSaved(spotlightTrack?.id);

  // Fetch tracks based on tab & query
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

    if (activeTab === "player") {
      return;
    }

    async function fetchTracks() {
      setIsLoading(true);
      setUrlStatus(null);
      try {
        const query = deferredSearch.trim();

        if (query) {
          if (isDirectUrl) {
            setUrlStatus("Connecting to audio stream...");
            try {
              const res = await fetch(`/api/soundcloud/resolve?url=${encodeURIComponent(query)}`);
              if (res.ok) {
                const item = await res.json();
                if (!isCancelled && item && item.id) {
                  const resolved: AudioTrack = {
                    id: item.id,
                    title: item.title || "Audio Track",
                    channelTitle: item.artist || "Artist",
                    artist: item.artist || "Artist",
                    thumbnail: item.thumbnail || "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&q=80",
                    duration: item.duration || "3:30",
                    mediaType: "audio",
                    isMusic: true,
                    permalinkUrl: item.permalinkUrl || query,
                    mediaUrl: item.mediaUrl || `/api/soundcloud/stream?url=${encodeURIComponent(query)}`,
                    sourceType: "soundcloud",
                  };
                  setTracks([resolved]);
                  setUrlStatus(null);
                  setIsLoading(false);
                  return;
                }
              }
            } catch (e) {}
          }

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

    fetchTracks();

    return () => {
      isCancelled = true;
    };
  }, [activeTab, collectionSubTab, deferredSearch, isDirectUrl, customPlaylists]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    if (isDirectUrl) {
      setUrlStatus("Loading track...");
      const res = await resolveAndPlayUrl(query);
      if (res.success && res.track) {
        setUrlStatus(null);
      } else {
        setUrlStatus(`Could not load audio: ${res.error || "Please try another link"}`);
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
      <div
        style={{ borderColor: "var(--theme-border-subtle)" }}
        className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b"
      >
        {/* Brand & Subtitle */}
        <div className="flex items-center gap-3">
          <div
            style={{
              backgroundColor: "var(--theme-accent)",
              color: "#ffffff",
              boxShadow: "0 4px 20px var(--theme-border-strong)",
            }}
            className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
          >
            <Music size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Music
            </h1>
            <p
              style={{ color: "var(--theme-text-muted)" }}
              className="text-xs mt-0.5"
            >
              Lo-fi beats, study sessions, and your personal audio library
            </p>
          </div>
        </div>

        {/* Tab Switcher & View Controls */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full lg:w-auto">
          {/* Main Segmented Control */}
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
              <span>Collection</span>
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

          {/* Quick EQ & View Mode */}
          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            <button
              type="button"
              onClick={() => setIsEqOpen(true)}
              style={{
                backgroundColor: "var(--theme-surface)",
                borderColor: "var(--theme-border-subtle)",
                color: "var(--theme-text-accent)",
              }}
              className="p-2 rounded-xl border hover:bg-white/10 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-medium"
              title="Open Audio Equalizer"
            >
              <SlidersHorizontal size={14} style={{ color: "var(--theme-accent)" }} />
              <span className="hidden sm:inline">Equalizer</span>
            </button>

            {activeTab !== "player" && (
              <div
                style={{
                  backgroundColor: "var(--theme-surface)",
                  borderColor: "var(--theme-border-subtle)",
                }}
                className="flex items-center gap-1 p-1 border rounded-xl"
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
      </div>

      {/* Render Dedicated Player Tab */}
      {activeTab === "player" ? (
        <MusicPlayer onBack={() => setActiveTab("discover")} />
      ) : (
        <>
          {/* Spotlight Hero Section */}
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
                {/* Album Cover */}
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
                      <div
                        style={{ backgroundColor: "var(--theme-accent)" }}
                        className="w-1.5 h-6 rounded-full animate-bounce"
                      />
                      <div className="w-1.5 h-10 bg-white rounded-full animate-bounce [animation-delay:0.2s]" />
                      <div
                        style={{ backgroundColor: "var(--theme-accent)" }}
                        className="w-1.5 h-8 rounded-full animate-bounce [animation-delay:0.1s]"
                      />
                    </div>
                  )}
                </div>

                {/* Hero Details */}
                <div className="flex-1 min-w-0 space-y-3 text-center md:text-left">
                  <div className="space-y-1">
                    <div
                      style={{ color: "var(--theme-text-muted)" }}
                      className="flex items-center justify-center md:justify-start gap-2 text-xs"
                    >
                      <span>Featured</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono text-neutral-300">{spotlightTrack.duration || "3:30"}</span>
                    </div>

                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-snug">
                      {spotlightTrack.title}
                    </h2>
                    <p
                      style={{ color: "var(--theme-text-accent)" }}
                      className="text-sm font-medium"
                    >
                      {spotlightTrack.artist || spotlightTrack.channelTitle || "Artist"}
                    </p>
                  </div>

                  {/* Primary Actions */}
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
                      style={{
                        backgroundColor: "var(--theme-accent)",
                        color: "#ffffff",
                      }}
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
                      style={{
                        backgroundColor: "rgba(255,255,255,0.06)",
                        borderColor: "var(--theme-border-subtle)",
                      }}
                      className="px-4 py-2.5 rounded-xl border text-white font-semibold text-xs transition-colors hover:bg-white/10 cursor-pointer flex items-center gap-1.5"
                    >
                      <Plus size={14} />
                      <span>Add to Queue</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleSaveVideo(spotlightTrack)}
                      style={{
                        backgroundColor: "rgba(255,255,255,0.06)",
                        borderColor: "var(--theme-border-subtle)",
                      }}
                      className="p-2.5 rounded-xl border text-neutral-300 hover:text-rose-400 transition-colors cursor-pointer"
                      title={isSpotlightSaved ? "Saved to Favorites" : "Save to Favorites"}
                    >
                      <Heart size={16} className={isSpotlightSaved ? "fill-rose-500 text-rose-500" : ""} />
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab("player")}
                      style={{
                        backgroundColor: "rgba(255,255,255,0.06)",
                        borderColor: "var(--theme-border-subtle)",
                        color: "var(--theme-text-accent)",
                      }}
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
          <form onSubmit={handleSubmit} className="space-y-2">
            <div
              style={{
                backgroundColor: "var(--theme-surface)",
                borderColor: "var(--theme-border-subtle)",
              }}
              className="flex items-center gap-2 p-2 rounded-2xl border shadow-inner transition-colors focus-within:border-white/30"
            >
              <div
                style={{ color: "var(--theme-text-muted)" }}
                className="pl-3"
              >
                <Search size={16} />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tracks, artists, or paste a music link..."
                className="flex-1 bg-transparent text-sm text-white placeholder-neutral-500 focus:outline-none px-2"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="p-1.5 text-neutral-400 hover:text-white"
                >
                  <X size={15} />
                </button>
              )}

              <button
                type="submit"
                disabled={!searchQuery.trim()}
                style={{
                  backgroundColor: "var(--theme-accent)",
                  color: "#ffffff",
                }}
                className="px-4 py-2 rounded-xl disabled:opacity-40 font-bold text-xs transition-all cursor-pointer shrink-0 shadow-sm flex items-center gap-1.5"
              >
                <span>Search</span>
              </button>
            </div>

            {/* Quick Artist Suggestions */}
            {!searchQuery && activeTab !== "collection" && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs text-neutral-400">
                <span
                  style={{ color: "var(--theme-text-muted)" }}
                  className="text-[11px] font-medium shrink-0"
                >
                  Suggestions:
                </span>
                {FEATURED_ARTISTS.map((artist) => (
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

            {urlStatus && (
              <div
                style={{
                  backgroundColor: "var(--theme-surface)",
                  borderColor: "var(--theme-border-strong)",
                  color: "var(--theme-text-accent)",
                }}
                className="px-3.5 py-2 rounded-xl border text-xs flex items-center gap-2"
              >
                <span>{urlStatus}</span>
              </div>
            )}
          </form>

          {/* Collection Sub-Tabs */}
          {activeTab === "collection" && (
            <div
              style={{ borderColor: "var(--theme-border-subtle)" }}
              className="flex items-center justify-between gap-4 pb-2 border-b flex-wrap"
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCollectionSubTab("favorites")}
                  style={{
                    backgroundColor: collectionSubTab === "favorites" ? "var(--theme-accent)" : "rgba(255,255,255,0.04)",
                    color: collectionSubTab === "favorites" ? "#ffffff" : "var(--theme-text-muted)",
                  }}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  Favorites ({getSavedVideos().length})
                </button>

                <button
                  type="button"
                  onClick={() => setCollectionSubTab("history")}
                  style={{
                    backgroundColor: collectionSubTab === "history" ? "var(--theme-accent)" : "rgba(255,255,255,0.04)",
                    color: collectionSubTab === "history" ? "#ffffff" : "var(--theme-text-muted)",
                  }}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  Recently Played ({getWatchHistory().length})
                </button>

                <button
                  type="button"
                  onClick={() => setCollectionSubTab("playlists")}
                  style={{
                    backgroundColor: collectionSubTab === "playlists" ? "var(--theme-accent)" : "rgba(255,255,255,0.04)",
                    color: collectionSubTab === "playlists" ? "#ffffff" : "var(--theme-text-muted)",
                  }}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  Playlists ({customPlaylists.length})
                </button>

                <button
                  type="button"
                  onClick={() => setCollectionSubTab("local")}
                  style={{
                    backgroundColor: collectionSubTab === "local" ? "var(--theme-accent)" : "rgba(255,255,255,0.04)",
                    color: collectionSubTab === "local" ? "#ffffff" : "var(--theme-text-muted)",
                  }}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  Local Files
                </button>
              </div>

              {collectionSubTab === "playlists" && (
                <button
                  type="button"
                  onClick={() => setShowNewPlaylistModal(true)}
                  style={{
                    backgroundColor: "rgba(255,255,255,0.08)",
                    color: "#ffffff",
                  }}
                  className="px-3.5 py-1.5 rounded-xl hover:bg-white/15 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <FolderPlus size={14} />
                  <span>New Playlist</span>
                </button>
              )}
            </div>
          )}

          {/* Local Audio Dropzone */}
          {activeTab === "collection" && collectionSubTab === "local" && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              style={{
                backgroundColor: "var(--theme-surface)",
                borderColor: "var(--theme-border-strong)",
              }}
              className="border-2 border-dashed rounded-3xl p-12 text-center space-y-4 transition-colors cursor-pointer"
            >
              <div
                style={{
                  backgroundColor: "rgba(255,255,255,0.06)",
                  color: "var(--theme-text-accent)",
                }}
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
              >
                <Upload size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">Local Audio Files</h3>
                <p
                  style={{ color: "var(--theme-text-muted)" }}
                  className="text-xs max-w-md mx-auto"
                >
                  Drag and drop MP3, WAV, FLAC, or OGG tracks to play directly.
                </p>
              </div>
              <div>
                <label
                  style={{
                    backgroundColor: "var(--theme-accent)",
                    color: "#ffffff",
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md hover:opacity-90"
                >
                  <FolderPlus size={14} />
                  <span>Choose Files</span>
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

          {/* Track Catalog */}
          <div className="space-y-4">
            <div
              style={{ color: "var(--theme-text-muted)" }}
              className="flex items-center justify-between text-xs"
            >
              <span className="font-semibold uppercase tracking-wider text-neutral-300">
                {searchQuery
                  ? `Results for "${searchQuery}"`
                  : activeTab === "chillhop"
                  ? "Lo-Fi & Study Collection"
                  : activeTab === "synthwave"
                  ? "Synthwave Tracks"
                  : activeTab === "collection"
                  ? `${collectionSubTab.charAt(0).toUpperCase() + collectionSubTab.slice(1)}`
                  : "Curated Tracks"}
              </span>
              <span>{tracks.length} tracks</span>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div
                    key={i}
                    style={{ backgroundColor: "var(--theme-surface)" }}
                    className="rounded-2xl p-3.5 space-y-3 border border-white/5 animate-pulse"
                  >
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
                <p
                  style={{ color: "var(--theme-text-muted)" }}
                  className="text-xs max-w-sm mx-auto"
                >
                  Try searching for an artist like &quot;Chillhop Music&quot; or paste a link.
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
                      style={{
                        backgroundColor: "var(--theme-surface)",
                        borderColor: isCurrentlyPlaying ? "var(--theme-border-strong)" : "var(--theme-border-subtle)",
                        boxShadow: isCurrentlyPlaying ? "0 0 20px var(--theme-border-strong)" : "none",
                      }}
                      className="group border rounded-2xl p-3 flex flex-col space-y-3 transition-all duration-200 cursor-pointer relative overflow-hidden hover:bg-white/5"
                    >
                      {/* Album Thumbnail */}
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

                        {/* Hover Overlay */}
                        <div
                          className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${
                            isCurrentlyPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                          }`}
                        >
                          <div
                            style={{ backgroundColor: "var(--theme-accent)" }}
                            className="w-11 h-11 rounded-full text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform"
                          >
                            {isCurrentlyPlaying ? (
                              <Pause size={18} className="fill-white" />
                            ) : (
                              <Play size={18} className="fill-white translate-x-0.5" />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Details */}
                      <div className="flex items-start justify-between gap-2 min-w-0 flex-1">
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-white truncate leading-tight group-hover:underline">
                            {track.title}
                          </h4>
                          <p
                            style={{ color: "var(--theme-text-muted)" }}
                            className="text-[11px] truncate mt-1"
                          >
                            {track.artist || track.channelTitle || "Artist"}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSaveVideo(track);
                            }}
                            className="p-1 rounded-lg text-neutral-400 hover:text-rose-400 transition-colors"
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
              /* LIST VIEW */
              <div
                style={{
                  backgroundColor: "var(--theme-surface)",
                  borderColor: "var(--theme-border-subtle)",
                }}
                className="border rounded-2xl overflow-hidden shadow-sm divide-y divide-white/5"
              >
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
                      style={{
                        backgroundColor: isCurrentlyPlaying ? "rgba(255,255,255,0.06)" : "transparent",
                      }}
                      className="flex items-center justify-between gap-4 p-3 hover:bg-white/5 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <span className="w-5 text-center text-xs font-mono text-neutral-500 group-hover:text-white">
                          {isCurrentlyPlaying ? (
                            <span
                              style={{ backgroundColor: "var(--theme-accent)" }}
                              className="w-2 h-2 rounded-full inline-block animate-ping"
                            />
                          ) : (
                            idx + 1
                          )}
                        </span>

                        <div className="w-9 h-9 rounded-xl overflow-hidden bg-black/60 shrink-0 border border-white/10 relative">
                          <img
                            src={track.thumbnail}
                            alt={track.title}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-white truncate leading-tight group-hover:underline">
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

                      <div className="flex items-center gap-3 shrink-0">
                        {track.duration && (
                          <span
                            style={{ color: "var(--theme-text-muted)" }}
                            className="font-mono text-xs tabular-nums"
                          >
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
                        >
                          <Heart size={14} className={isTrackSaved ? "fill-rose-500 text-rose-500" : ""} />
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
                            handleCopyLink(track);
                          }}
                          className="p-1.5 text-neutral-400 hover:text-white transition-colors"
                        >
                          {copiedTrackId === track.id ? (
                            <Check size={14} className="text-emerald-400" />
                          ) : (
                            <Share2 size={14} />
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

      {/* New Playlist Modal */}
      {showNewPlaylistModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
          <div
            style={{
              backgroundColor: "var(--theme-surface)",
              borderColor: "var(--theme-border-subtle)",
            }}
            className="w-full max-w-md border rounded-3xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FolderPlus size={18} style={{ color: "var(--theme-accent)" }} />
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
                placeholder="Playlist Title"
                style={{
                  backgroundColor: "rgba(0,0,0,0.35)",
                  borderColor: "var(--theme-border-subtle)",
                }}
                className="w-full px-4 py-3 border rounded-2xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-white/40"
                autoFocus
              />

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewPlaylistModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newPlaylistTitle.trim()}
                  style={{
                    backgroundColor: "var(--theme-accent)",
                    color: "#ffffff",
                  }}
                  className="px-5 py-2.5 rounded-xl disabled:opacity-40 text-xs font-bold shadow-md cursor-pointer"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audio Equalizer Modal */}
      <AudioEqualizerModal isOpen={isEqOpen} onClose={() => setIsEqOpen(false)} />
    </div>
  );
}
