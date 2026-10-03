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
  Users,
  Compass,
  Library,
  ArrowLeft,
  BadgeCheck,
  TrendingUp,
  Clock,
  ExternalLink,
  Download,
  Loader2,
} from "lucide-react";
import { useMusic, Track } from "../context/MusicContext";
import { downloadFile } from "../utils/mediaUtils";

interface MusicViewProps {
  isActive?: boolean;
}

type TabType = "home" | "artists" | "genres" | "library" | "player";

interface ArtistInfo {
  id: string;
  name: string;
  genre: string;
  monthlyListeners: string;
  image: string;
  banner: string;
  bio: string;
  verified: boolean;
}

const FEATURED_ARTISTS: ArtistInfo[] = [
  {
    id: "the-weeknd",
    name: "The Weeknd",
    genre: "R&B / Pop",
    monthlyListeners: "108,450,210",
    image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80",
    banner: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80",
    bio: "Grammy-winning visionary Canadian artist blending alternative R&B, synth-pop, and dark cinematic production.",
    verified: true,
  },
  {
    id: "kendrick-lamar",
    name: "Kendrick Lamar",
    genre: "Hip-Hop / Rap",
    monthlyListeners: "74,120,800",
    image: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=400&q=80",
    banner: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80",
    bio: "Pulitzer Prize-winning lyrical mastermind acclaimed as one of the greatest and most influential rappers of his generation.",
    verified: true,
  },
  {
    id: "taylor-swift",
    name: "Taylor Swift",
    genre: "Pop / Indie",
    monthlyListeners: "105,980,440",
    image: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=400&q=80",
    banner: "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=1200&q=80",
    bio: "Global pop icon renowned for narrative songwriting, genre transformations, and historic cultural impact.",
    verified: true,
  },
  {
    id: "lofi-girl",
    name: "Lofi Girl",
    genre: "Lo-Fi / Study",
    monthlyListeners: "24,800,000",
    image: "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=400&q=80",
    banner: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1200&q=80",
    bio: "The legendary home of 24/7 peaceful beats to relax and study to, fostering a global community of focused creators.",
    verified: true,
  },
  {
    id: "odesza",
    name: "ODESZA",
    genre: "Electronic / Cinematic",
    monthlyListeners: "12,410,000",
    image: "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=400&q=80",
    banner: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1200&q=80",
    bio: "Electronic duo known for soaring cinematic synth landscapes, euphoric vocal chops, and epic live drumlines.",
    verified: true,
  },
  {
    id: "tycho",
    name: "Tycho",
    genre: "Ambient / Synthwave",
    monthlyListeners: "6,920,000",
    image: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=400&q=80",
    banner: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
    bio: "Ambient electronic producer and visual artist Scott Hansen crafting warm, nostalgic, sun-drenched audio journeys.",
    verified: true,
  },
  {
    id: "daft-punk",
    name: "Daft Punk",
    genre: "French House / Dance",
    monthlyListeners: "28,340,000",
    image: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=400&q=80",
    banner: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80",
    bio: "Grammy-winning electronic innovators who revolutionized modern dance music, synth-funk, and visual stagecraft.",
    verified: true,
  },
  {
    id: "billie-eilish",
    name: "Billie Eilish",
    genre: "Alt-Pop / Indie",
    monthlyListeners: "92,150,000",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
    banner: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80",
    bio: "Multi-Academy and Grammy Award winner known for boundary-pushing vocal styles, intimate lyricism, and bold minimalism.",
    verified: true,
  },
];

const GENRE_CATEGORIES = [
  { id: "all", name: "Trending Top 40", icon: Flame, query: "trending top music hits" },
  { id: "chillhop", name: "Lo-Fi & Study", icon: Headphones, query: "lofi hip hop radio study beats" },
  { id: "synthwave", name: "Synthwave 80s", icon: Sparkles, query: "synthwave retrowave chill beats" },
  { id: "electronic", name: "Electronic & Dance", icon: Radio, query: "electronic dance edm hits" },
  { id: "hiphop", name: "Hip-Hop & R&B", icon: Compass, query: "hip hop r&b trending tracks" },
  { id: "ambient", name: "Deep Focus & Calm", icon: Disc, query: "ambient deep focus concentration music" },
];

const QUICK_SUGGESTIONS = [
  "The Weeknd",
  "Kendrick Lamar",
  "Taylor Swift",
  "Lofi Girl",
  "ODESZA",
  "Tycho",
  "Daft Punk",
  "Billie Eilish",
  "Chillhop Beats",
  "Synthwave 80s",
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
    favorites,
    toggleFavorite,
    isFavorite,
  } = useMusic();

  const [activeTab, setActiveTab] = useState<TabType>("home");
  const [selectedGenre, setSelectedGenre] = useState("all");
  const [selectedArtist, setSelectedArtist] = useState<ArtistInfo | null>(null);
  const [artistTracks, setArtistTracks] = useState<Track[]>([]);
  const [artistLoading, setArtistLoading] = useState(false);

  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    try {
      const saved = localStorage.getItem("frosted_music_view_mode");
      if (saved === "grid" || saved === "list") return saved;
    } catch {}
    return "grid";
  });

  const changeViewMode = (mode: "grid" | "list") => {
    setViewMode(mode);
    try {
      localStorage.setItem("frosted_music_view_mode", mode);
    } catch {}
  };
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [tracks, setTracks] = useState<Track[]>([]);
  const [quickPicks, setQuickPicks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedTrackId, setCopiedTrackId] = useState<string | null>(null);
  const [followedArtists, setFollowedArtists] = useState<string[]>([]);
  const [downloadingTrackId, setDownloadingTrackId] = useState<string | null>(null);
  const [downloadSuccessId, setDownloadSuccessId] = useState<string | null>(null);

  // Greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  // Live debounced search as user types
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setDebouncedSearch("");
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedSearch(trimmed);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Format seconds to mm:ss
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs <= 0) return "0:00";
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${mins}:${s < 10 ? "0" : ""}${s}`;
  };

  // Main track fetching pipeline (supports Search, Genres, Home)
  useEffect(() => {
    const controller = new AbortController();

    if (activeTab === "library") {
      setTracks(favorites);
      return;
    }

    if (activeTab === "player" && !debouncedSearch.trim()) {
      return;
    }

    async function fetchTracks() {
      setIsLoading(true);
      try {
        const query = debouncedSearch.trim();
        let endpoint = "";

        if (query) {
          endpoint = `/api/music/search?q=${encodeURIComponent(query)}`;
        } else if (activeTab === "genres") {
          endpoint = `/api/music/trending?category=${selectedGenre}`;
        } else {
          endpoint = `/api/music/trending?category=all`;
        }

        const res = await fetch(endpoint, { signal: controller.signal });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.tracks)) {
            setTracks(data.tracks);
            if (!query && quickPicks.length === 0) {
              setQuickPicks(data.tracks.slice(0, 6));
            }
          }
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          // Keep existing tracks
        }
      } finally {
        setIsLoading(false);
      }
    }

    fetchTracks();

    return () => {
      controller.abort();
    };
  }, [activeTab, selectedGenre, debouncedSearch, favorites]);

  // Load artist details and tracks when an artist is selected
  useEffect(() => {
    if (!selectedArtist) return;

    let isMounted = true;
    setArtistLoading(true);

    fetch(`/api/music/artist?name=${encodeURIComponent(selectedArtist.name)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data && Array.isArray(data.tracks)) {
          setArtistTracks(data.tracks);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setArtistLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedArtist]);

  // Handle Search Submission (URLs or Text)
  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setDebouncedSearch(query);
    if (activeTab !== "home") {
      setActiveTab("home");
    }

    setIsLoading(true);

    try {
      if (/^https?:\/\//i.test(query) || /^[a-zA-Z0-9_-]{11}$/.test(query)) {
        try {
          const res = await fetch(`/api/music/resolve?url=${encodeURIComponent(query)}`);
          if (res.ok) {
            const track = await res.json();
            if (track && (track.id || track.youtubeId)) {
              setTracks((prev) => [track, ...prev.filter((t) => t.id !== track.id)]);
              setIsLoading(false);
              return;
            }
          }
        } catch (e) {}
      }

      const res = await fetch(`/api/music/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.tracks) && data.tracks.length > 0) {
          setTracks(data.tracks);
        }
      }
    } catch (err) {
      console.warn("Music search error:", err);
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

  const toggleFollowArtist = (artistId: string) => {
    setFollowedArtists((prev) =>
      prev.includes(artistId) ? prev.filter((id) => id !== artistId) : [...prev, artistId]
    );
  };

  const handleDownloadTrack = async (track: Track, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!track || downloadingTrackId === track.id) return;
    setDownloadingTrackId(track.id);
    try {
      const targetId = track.youtubeId || track.id;
      const downloadUrl = `/api/music/download?id=${encodeURIComponent(targetId)}&title=${encodeURIComponent(
        track.title || ""
      )}&artist=${encodeURIComponent(track.artist || "")}`;
      const fileName = `${track.artist || "Music"} - ${track.title || "Track"}.mp3`;
      await downloadFile(downloadUrl, fileName);
      setDownloadSuccessId(track.id);
      setTimeout(() => setDownloadSuccessId(null), 2500);
    } catch (err) {
      console.warn("Track download error:", err);
    } finally {
      setDownloadingTrackId(null);
    }
  };

  const spotlightTrack = currentTrack || tracks[0];

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 flex flex-col flex-1 animate-fadeIn pb-24">
      {/* Top Header & Search Bar */}
      <div
        style={{ borderColor: "var(--theme-border-subtle)" }}
        className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 pb-4 border-b"
      >
        <div className="flex items-center gap-3">
          <div
            style={{
              backgroundColor: "var(--theme-accent)",
              color: "#ffffff",
              boxShadow: "0 4px 18px var(--theme-border-strong)",
            }}
            className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-md"
          >
            <Music size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <span>SoundWave</span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-white/10 text-neutral-300 font-semibold tracking-wider">
                Full Audio
              </span>
            </h1>
            <p style={{ color: "var(--theme-text-muted)" }} className="text-xs mt-0.5 font-medium">
              Powered by music.youtube.com & yt-dlp
            </p>
          </div>
        </div>

        {/* Global Search Input */}
        <form onSubmit={handleSearchSubmit} className="flex-1 max-w-xl">
          <div
            style={{
              backgroundColor: "var(--theme-surface)",
              borderColor: "var(--theme-border-subtle)",
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-2xl border shadow-inner transition-colors focus-within:border-white/30"
          >
            <Search size={16} style={{ color: "var(--theme-text-muted)" }} className="shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value && activeTab !== "home" && !selectedArtist) {
                  setActiveTab("home");
                }
              }}
              placeholder="Search songs, artists, playlists, or paste a link..."
              className="flex-1 bg-transparent text-sm text-white placeholder-neutral-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="p-1 text-neutral-400 hover:text-white transition-colors"
              >
                <X size={15} />
              </button>
            )}
            <button
              type="submit"
              disabled={!searchQuery.trim()}
              style={{ backgroundColor: "var(--theme-accent)", color: "#ffffff" }}
              className="px-3.5 py-1.5 rounded-xl disabled:opacity-40 font-bold text-xs transition-all cursor-pointer shrink-0 shadow-sm"
            >
              Search
            </button>
          </div>
        </form>

        {/* Navigation Tabs */}
        <div
          style={{
            backgroundColor: "var(--theme-surface)",
            borderColor: "var(--theme-border-subtle)",
          }}
          className="flex items-center gap-1 p-1 border rounded-2xl overflow-x-auto no-scrollbar shrink-0"
        >
          <button
            type="button"
            onClick={() => {
              setSelectedArtist(null);
              setActiveTab("home");
            }}
            style={{
              backgroundColor: activeTab === "home" && !selectedArtist ? "var(--theme-accent)" : "transparent",
              color: activeTab === "home" && !selectedArtist ? "#ffffff" : "var(--theme-text-muted)",
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap"
          >
            <Compass size={14} />
            <span>Discover</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("artists");
            }}
            style={{
              backgroundColor: activeTab === "artists" || selectedArtist ? "var(--theme-accent)" : "transparent",
              color: activeTab === "artists" || selectedArtist ? "#ffffff" : "var(--theme-text-muted)",
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap"
          >
            <Users size={14} />
            <span>Artists</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedArtist(null);
              setActiveTab("genres");
            }}
            style={{
              backgroundColor: activeTab === "genres" && !selectedArtist ? "var(--theme-accent)" : "transparent",
              color: activeTab === "genres" && !selectedArtist ? "#ffffff" : "var(--theme-text-muted)",
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap"
          >
            <Radio size={14} />
            <span>Genres</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedArtist(null);
              setActiveTab("library");
            }}
            style={{
              backgroundColor: activeTab === "library" ? "var(--theme-accent)" : "transparent",
              color: activeTab === "library" ? "#ffffff" : "var(--theme-text-muted)",
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap"
          >
            <Heart size={14} />
            <span>Library ({favorites.length})</span>
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
      </div>

      {/* Quick Search Suggestions Pills */}
      {!searchQuery && !selectedArtist && activeTab === "home" && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs text-neutral-400">
          <span style={{ color: "var(--theme-text-muted)" }} className="text-[11px] font-semibold uppercase tracking-wider shrink-0">
            Suggested:
          </span>
          {QUICK_SUGGESTIONS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => {
                setSearchQuery(tag);
                setActiveTab("home");
              }}
              style={{
                backgroundColor: "var(--theme-surface)",
                borderColor: "var(--theme-border-subtle)",
              }}
              className="px-3 py-1 rounded-full border text-neutral-300 hover:text-white hover:border-white/20 transition-all cursor-pointer whitespace-nowrap text-xs font-medium"
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* ================================================================ */}
      {/* ARTIST TAB & PROFILE VIEW                                        */}
      {/* ================================================================ */}
      {(activeTab === "artists" || selectedArtist) && (
        <div className="space-y-6">
          {selectedArtist ? (
            /* Individual Artist Page */
            <div className="space-y-6 animate-fadeIn">
              {/* Back button */}
              <button
                type="button"
                onClick={() => setSelectedArtist(null)}
                className="flex items-center gap-2 text-xs font-semibold text-neutral-300 hover:text-white transition-colors cursor-pointer group"
              >
                <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                <span>Back to all artists</span>
              </button>

              {/* Artist Hero Header Banner */}
              <div
                style={{
                  backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.85) 100%), url(${selectedArtist.banner})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
                className="rounded-3xl p-6 sm:p-10 relative overflow-hidden shadow-2xl border border-white/10 flex flex-col justify-end min-h-[260px] sm:min-h-[320px]"
              >
                <div className="z-10 space-y-4">
                  <div className="flex items-center gap-2 text-white/90 text-xs font-semibold uppercase tracking-wider">
                    {selectedArtist.verified && (
                      <span className="flex items-center gap-1.5 bg-blue-500/30 text-blue-400 border border-blue-500/40 px-2.5 py-0.5 rounded-full backdrop-blur-md">
                        <BadgeCheck size={14} className="fill-blue-500 text-black" />
                        Verified Artist
                      </span>
                    )}
                    <span className="text-white/60">•</span>
                    <span>{selectedArtist.monthlyListeners} monthly listeners</span>
                  </div>

                  <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight drop-shadow-md">
                    {selectedArtist.name}
                  </h1>

                  <p className="text-xs sm:text-sm text-neutral-200 max-w-2xl leading-relaxed">
                    {selectedArtist.bio}
                  </p>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (artistTracks.length > 0) {
                          playTrack(artistTracks[0], artistTracks);
                        }
                      }}
                      style={{ backgroundColor: "var(--theme-accent)", color: "#ffffff" }}
                      className="flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
                    >
                      <Play size={18} className="fill-white" />
                      <span>Play Top Tracks</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleFollowArtist(selectedArtist.id)}
                      style={{
                        backgroundColor: followedArtists.includes(selectedArtist.id) ? "rgba(255,255,255,0.15)" : "transparent",
                        borderColor: "rgba(255,255,255,0.3)",
                      }}
                      className="px-5 py-3 rounded-2xl border text-white font-semibold text-sm hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      {followedArtists.includes(selectedArtist.id) ? "Following" : "Follow"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Popular Tracks Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                    <TrendingUp size={18} style={{ color: "var(--theme-accent)" }} />
                    <span>Popular Tracks</span>
                  </h3>
                  <span style={{ color: "var(--theme-text-muted)" }} className="text-xs">
                    {artistTracks.length} songs
                  </span>
                </div>

                {artistLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        style={{ backgroundColor: "var(--theme-surface)" }}
                        className="h-16 rounded-2xl animate-pulse border border-white/5"
                      />
                    ))}
                  </div>
                ) : artistTracks.length === 0 ? (
                  <div
                    style={{ backgroundColor: "var(--theme-surface)" }}
                    className="p-8 text-center rounded-2xl border border-white/5 text-neutral-400 text-xs"
                  >
                    No songs found for this artist.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {artistTracks.map((track, idx) => {
                      const isCurrent = currentTrack?.id === track.id && isPlaying;
                      const fav = isFavorite(track.id);

                      return (
                        <div
                          key={track.id}
                          onClick={() => playTrack(track, artistTracks)}
                          style={{
                            backgroundColor: isCurrent ? "rgba(255,255,255,0.08)" : "var(--theme-surface)",
                            borderColor: isCurrent ? "var(--theme-border-strong)" : "var(--theme-border-subtle)",
                          }}
                          className="flex items-center justify-between p-3 rounded-2xl border group hover:bg-white/10 transition-colors cursor-pointer gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <span className="w-5 text-center text-xs font-mono font-bold text-neutral-500 group-hover:hidden">
                              {idx + 1}
                            </span>
                            <Play size={14} className="w-5 hidden group-hover:block fill-white text-white shrink-0" />

                            <img
                              src={track.thumbnail}
                              alt={track.title}
                              className="w-11 h-11 rounded-xl object-cover shrink-0 border border-white/10 shadow-sm"
                              referrerPolicy="no-referrer"
                            />

                            <div className="min-w-0 flex-1">
                              <h4
                                className={`text-sm font-semibold truncate ${
                                  isCurrent ? "text-emerald-400" : "text-white"
                                }`}
                              >
                                {track.title}
                              </h4>
                              <p style={{ color: "var(--theme-text-muted)" }} className="text-xs truncate font-medium">
                                {track.artist}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span style={{ color: "var(--theme-text-muted)" }} className="text-xs font-mono">
                              {track.duration || "3:30"}
                            </span>

                            <button
                              type="button"
                              onClick={(e) => handleDownloadTrack(track, e)}
                              disabled={downloadingTrackId === track.id}
                              className="p-1.5 text-neutral-400 hover:text-cyan-400 transition-colors cursor-pointer"
                              title={downloadSuccessId === track.id ? "Downloaded!" : "Download MP3"}
                            >
                              {downloadingTrackId === track.id ? (
                                <Loader2 size={15} className="animate-spin text-cyan-400" />
                              ) : downloadSuccessId === track.id ? (
                                <Check size={15} className="text-emerald-400" />
                              ) : (
                                <Download size={15} />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavorite(track);
                              }}
                              className="p-1.5 text-neutral-400 hover:text-rose-400 transition-colors cursor-pointer"
                            >
                              <Heart size={16} className={fav ? "fill-rose-500 text-rose-500" : ""} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Artists Directory Grid */
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">Top Artists</h2>
                  <p style={{ color: "var(--theme-text-muted)" }} className="text-xs mt-0.5 font-medium">
                    Explore verified creators, stream full discographies, and follow your favorites
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {FEATURED_ARTISTS.map((artist) => (
                  <div
                    key={artist.id}
                    onClick={() => setSelectedArtist(artist)}
                    style={{
                      backgroundColor: "var(--theme-surface)",
                      borderColor: "var(--theme-border-subtle)",
                    }}
                    className="p-4 rounded-3xl border flex flex-col items-center text-center space-y-3 hover:bg-white/10 transition-all duration-200 cursor-pointer group hover:-translate-y-1 shadow-sm"
                  >
                    <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden border-2 border-white/10 relative shadow-lg group-hover:border-white/30 transition-all">
                      <img
                        src={artist.image}
                        alt={artist.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div
                          style={{ backgroundColor: "var(--theme-accent)" }}
                          className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg"
                        >
                          <Play size={16} className="fill-white text-white translate-x-0.5" />
                        </div>
                      </div>
                    </div>

                    <div className="w-full min-w-0">
                      <h4 className="text-sm sm:text-base font-bold text-white truncate flex items-center justify-center gap-1">
                        <span>{artist.name}</span>
                        {artist.verified && <BadgeCheck size={14} className="fill-blue-400 text-black shrink-0" />}
                      </h4>
                      <p style={{ color: "var(--theme-text-muted)" }} className="text-xs mt-0.5 truncate font-medium">
                        {artist.genre}
                      </p>
                      <span className="text-[10px] text-white/50 font-mono mt-1 block">
                        {artist.monthlyListeners} listeners
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* GENRES TAB                                                       */}
      {/* ================================================================ */}
      {activeTab === "genres" && !selectedArtist && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Browse Genres & Moods</h2>
            <p style={{ color: "var(--theme-text-muted)" }} className="text-xs mt-0.5 font-medium">
              Curated soundscapes tailored to focus, energy, and relaxation
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {GENRE_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isSelected = selectedGenre === cat.id;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedGenre(cat.id)}
                  style={{
                    backgroundColor: isSelected ? "var(--theme-accent)" : "var(--theme-surface)",
                    borderColor: isSelected ? "var(--theme-border-strong)" : "var(--theme-border-subtle)",
                    color: isSelected ? "#ffffff" : "var(--theme-text-muted)",
                  }}
                  className="p-4 rounded-2xl border flex flex-col items-center text-center space-y-2 cursor-pointer transition-all hover:scale-105 active:scale-95 shadow-sm"
                >
                  <Icon size={24} className={isSelected ? "text-white" : "text-neutral-400"} />
                  <span className="text-xs font-bold leading-tight text-white">{cat.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* HOME / DISCOVER TAB (SPOTIFY-STYLE DASHBOARD)                    */}
      {/* ================================================================ */}
      {activeTab === "home" && !selectedArtist && (
        <div className="space-y-8">
          {/* Quick Picks 6-Card Grid (Spotify Style Greeting) */}
          {!searchQuery && quickPicks.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {getGreeting()}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {quickPicks.map((pick) => {
                  const isCurrent = currentTrack?.id === pick.id && isPlaying;

                  return (
                    <div
                      key={pick.id}
                      onClick={() => playTrack(pick, quickPicks)}
                      style={{
                        backgroundColor: "var(--theme-surface)",
                        borderColor: isCurrent ? "var(--theme-border-strong)" : "var(--theme-border-subtle)",
                      }}
                      className="flex items-center gap-3 rounded-2xl border p-2 group hover:bg-white/10 transition-colors cursor-pointer relative overflow-hidden shadow-sm"
                    >
                      <img
                        src={pick.thumbnail}
                        alt={pick.title}
                        className="w-14 h-14 rounded-xl object-cover shrink-0 shadow-md"
                        referrerPolicy="no-referrer"
                      />

                      <div className="min-w-0 flex-1 pr-12">
                        <h4 className="text-xs sm:text-sm font-bold text-white truncate leading-snug">
                          {pick.title}
                        </h4>
                        <p style={{ color: "var(--theme-text-muted)" }} className="text-[11px] truncate mt-0.5 font-medium">
                          {pick.artist}
                        </p>
                      </div>

                      {/* Hover / Active Play Button */}
                      <div
                        style={{ backgroundColor: "var(--theme-accent)" }}
                        className={`absolute right-3 w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition-transform ${
                          isCurrent
                            ? "scale-100 opacity-100"
                            : "scale-0 opacity-0 group-hover:scale-100 group-hover:opacity-100"
                        }`}
                      >
                        {isCurrent ? (
                          <Pause size={14} className="fill-white text-white" />
                        ) : (
                          <Play size={14} className="fill-white text-white translate-x-0.5" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Featured Spotlight Card */}
          {!searchQuery && spotlightTrack && (
            <div
              style={{
                backgroundColor: "var(--theme-surface)",
                borderColor: "var(--theme-border-subtle)",
              }}
              className="rounded-3xl p-6 sm:p-8 border relative overflow-hidden shadow-xl flex flex-col md:flex-row items-center gap-6"
            >
              <div
                style={{
                  backgroundImage: `url(${spotlightTrack.thumbnail})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
                className="absolute inset-0 opacity-15 blur-2xl pointer-events-none"
              />

              <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-2xl overflow-hidden shadow-2xl shrink-0 border border-white/10 relative group">
                <img
                  src={spotlightTrack.thumbnail}
                  alt={spotlightTrack.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  referrerPolicy="no-referrer"
                />
                <button
                  type="button"
                  onClick={() => playTrack(spotlightTrack, tracks)}
                  style={{ backgroundColor: "var(--theme-accent)" }}
                  className="absolute inset-0 m-auto w-12 h-12 rounded-full flex items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:scale-110"
                >
                  <Play size={20} className="fill-white text-white translate-x-0.5" />
                </button>
              </div>

              <div className="flex-1 space-y-3 z-10 text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    Featured Spotlight
                  </span>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                    {spotlightTrack.duration || "Full Audio"}
                  </span>
                </div>

                <h3 className="text-xl sm:text-3xl font-black text-white tracking-tight leading-tight">
                  {spotlightTrack.title}
                </h3>

                <p style={{ color: "var(--theme-text-muted)" }} className="text-sm font-medium">
                  {spotlightTrack.artist}
                </p>

                <div className="flex items-center justify-center md:justify-start gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => playTrack(spotlightTrack, tracks)}
                    style={{ backgroundColor: "var(--theme-accent)", color: "#ffffff" }}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-2xl font-bold text-xs shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
                  >
                    <Play size={16} className="fill-white" />
                    <span>Play Now</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleFavorite(spotlightTrack)}
                    style={{
                      backgroundColor: "rgba(255,255,255,0.06)",
                      borderColor: "var(--theme-border-subtle)",
                    }}
                    className="p-2.5 rounded-2xl border text-neutral-300 hover:text-rose-400 transition-colors cursor-pointer"
                    title={isFavorite(spotlightTrack.id) ? "Saved" : "Favorite"}
                  >
                    <Heart size={16} className={isFavorite(spotlightTrack.id) ? "fill-rose-500 text-rose-500" : ""} />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleDownloadTrack(spotlightTrack, e)}
                    disabled={downloadingTrackId === spotlightTrack.id}
                    style={{
                      backgroundColor: "rgba(255,255,255,0.06)",
                      borderColor: "var(--theme-border-subtle)",
                    }}
                    className="p-2.5 rounded-2xl border text-neutral-300 hover:text-cyan-400 transition-colors cursor-pointer"
                    title={downloadSuccessId === spotlightTrack.id ? "Downloaded!" : "Download MP3"}
                  >
                    {downloadingTrackId === spotlightTrack.id ? (
                      <Loader2 size={16} className="animate-spin text-cyan-400" />
                    ) : downloadSuccessId === spotlightTrack.id ? (
                      <Check size={16} className="text-emerald-400" />
                    ) : (
                      <Download size={16} />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("player")}
                    style={{
                      backgroundColor: "rgba(255,255,255,0.06)",
                      borderColor: "var(--theme-border-subtle)",
                    }}
                    className="p-2.5 rounded-2xl border text-neutral-300 hover:text-white transition-colors cursor-pointer"
                    title="Open Full Player"
                  >
                    <Disc size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* TRACKS LIST / GRID (FOR HOME, GENRES, LIBRARY & SEARCH)          */}
      {/* ================================================================ */}
      {activeTab !== "player" && !selectedArtist && (
        <div className="space-y-4 pt-2">
          {/* Section Toolbar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white tracking-tight">
                {searchQuery
                  ? `Search results for "${searchQuery}"`
                  : activeTab === "library"
                  ? "Your Saved Library"
                  : activeTab === "genres"
                  ? `${GENRE_CATEGORIES.find((c) => c.id === selectedGenre)?.name || "Genre"} Tracks`
                  : "Trending & New Releases"}
              </h3>
              <span className="text-xs font-mono text-neutral-400">({tracks.length})</span>
            </div>

            {/* View Mode Toggle: Grid vs List Table */}
            <div
              style={{
                backgroundColor: "var(--theme-surface)",
                borderColor: "var(--theme-border-subtle)",
              }}
              className="flex items-center gap-1 p-1 border rounded-xl shrink-0 shadow-sm"
            >
              <button
                type="button"
                onClick={() => changeViewMode("grid")}
                style={{
                  backgroundColor: viewMode === "grid" ? "var(--theme-accent)" : "transparent",
                  color: viewMode === "grid" ? "#ffffff" : "var(--theme-text-muted)",
                }}
                className={`p-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  viewMode === "grid" ? "shadow-sm font-bold" : "hover:text-white"
                }`}
                title="Grid Card View (Image 2)"
              >
                <LayoutGrid size={15} />
              </button>
              <button
                type="button"
                onClick={() => changeViewMode("list")}
                style={{
                  backgroundColor: viewMode === "list" ? "var(--theme-accent)" : "transparent",
                  color: viewMode === "list" ? "#ffffff" : "var(--theme-text-muted)",
                }}
                className={`p-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  viewMode === "list" ? "shadow-sm font-bold" : "hover:text-white"
                }`}
                title="List Table View (Image 3)"
              >
                <ListIcon size={15} />
              </button>
            </div>
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
              className="p-16 text-center space-y-3 border rounded-3xl"
            >
              <Disc size={36} className="mx-auto text-neutral-500" />
              <p className="text-base font-bold text-white">No tracks found</p>
              <p style={{ color: "var(--theme-text-muted)" }} className="text-xs max-w-sm mx-auto">
                {activeTab === "library"
                  ? "You haven't saved any tracks yet. Click the heart icon on any song to save it here!"
                  : "Try searching for an artist like 'The Weeknd' or paste any YouTube Music URL."}
              </p>
            </div>
          ) : viewMode === "grid" ? (
            /* Modern Card Grid */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {tracks.map((track) => {
                const isCurrent = currentTrack?.id === track.id && isPlaying;
                const fav = isFavorite(track.id);

                return (
                  <div
                    key={track.id}
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
                    }}
                    className="p-3 rounded-2xl border flex flex-col space-y-3 group hover:bg-white/10 transition-all cursor-pointer relative shadow-sm"
                  >
                    <div className="aspect-square rounded-xl overflow-hidden bg-black/60 relative border border-white/10">
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

                      {/* Play Button Overlay */}
                      <div
                        style={{ backgroundColor: "var(--theme-accent)" }}
                        className={`absolute right-2.5 bottom-2.5 w-10 h-10 rounded-full flex items-center justify-center shadow-xl transition-all duration-200 ${
                          isCurrent
                            ? "opacity-100 scale-100"
                            : "opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100"
                        }`}
                      >
                        {isCurrent ? (
                          <Pause size={16} className="fill-white text-white" />
                        ) : (
                          <Play size={16} className="fill-white text-white translate-x-0.5" />
                        )}
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4
                        className={`text-xs sm:text-sm font-bold truncate leading-tight ${
                          isCurrent ? "text-emerald-400" : "text-white"
                        }`}
                      >
                        {track.title}
                      </h4>
                      <p style={{ color: "var(--theme-text-muted)" }} className="text-[11px] truncate mt-0.5 font-medium">
                        {track.artist}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-1 text-neutral-400 text-xs">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(track);
                        }}
                        className="p-1 hover:text-rose-400 transition-colors cursor-pointer"
                        title={fav ? "Saved" : "Favorite"}
                      >
                        <Heart size={14} className={fav ? "fill-rose-500 text-rose-500" : ""} />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleDownloadTrack(track, e)}
                        disabled={downloadingTrackId === track.id}
                        className="p-1 hover:text-cyan-400 transition-colors cursor-pointer"
                        title={downloadSuccessId === track.id ? "Downloaded!" : "Download MP3"}
                      >
                        {downloadingTrackId === track.id ? (
                          <Loader2 size={14} className="animate-spin text-cyan-400" />
                        ) : downloadSuccessId === track.id ? (
                          <Check size={14} className="text-emerald-400" />
                        ) : (
                          <Download size={14} />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          addToQueue(track);
                        }}
                        className="p-1 hover:text-white transition-colors cursor-pointer"
                        title="Add to queue"
                      >
                        <Plus size={14} />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShare(track);
                        }}
                        className="p-1 hover:text-white transition-colors cursor-pointer"
                        title="Copy link"
                      >
                        {copiedTrackId === track.id ? <Check size={14} className="text-emerald-400" /> : <Share2 size={14} />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Spotify-Style Track Table */
            <div
              style={{
                backgroundColor: "var(--theme-surface)",
                borderColor: "var(--theme-border-subtle)",
              }}
              className="rounded-3xl border overflow-hidden shadow-sm"
            >
              {/* Table Header */}
              <div
                style={{
                  borderBottomColor: "var(--theme-border-subtle)",
                  color: "var(--theme-text-muted)",
                }}
                className="grid grid-cols-12 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider border-b"
              >
                <div className="col-span-1 text-center">#</div>
                <div className="col-span-7 sm:col-span-8">Title</div>
                <div className="hidden sm:block sm:col-span-2 text-right">Time</div>
                <div className="col-span-4 sm:col-span-1 text-right">Actions</div>
              </div>

              {/* Table Body Rows */}
              <div className="divide-y divide-white/5">
                {tracks.map((track, idx) => {
                  const isCurrent = currentTrack?.id === track.id && isPlaying;
                  const fav = isFavorite(track.id);

                  return (
                    <div
                      key={track.id}
                      onClick={() => {
                        if (currentTrack?.id === track.id) {
                          togglePlay();
                        } else {
                          playTrack(track, tracks);
                        }
                      }}
                      className="grid grid-cols-12 items-center px-4 py-2.5 hover:bg-white/5 transition-colors cursor-pointer group"
                    >
                      {/* Track Number / Play Icon */}
                      <div className="col-span-1 flex items-center justify-center text-xs font-mono font-semibold">
                        <span className={`group-hover:hidden ${isCurrent ? "text-emerald-400" : "text-neutral-500"}`}>
                          {isCurrent ? <Disc size={14} className="animate-spin text-emerald-400" /> : idx + 1}
                        </span>
                        <Play size={14} className="hidden group-hover:block fill-white text-white" />
                      </div>

                      {/* Artwork + Title & Artist */}
                      <div className="col-span-7 sm:col-span-8 flex items-center gap-3 min-w-0 pr-2">
                        <img
                          src={track.thumbnail}
                          alt={track.title}
                          className="w-10 h-10 rounded-xl object-cover shrink-0 border border-white/10"
                          referrerPolicy="no-referrer"
                        />
                        <div className="min-w-0 flex-1">
                          <h4
                            className={`text-xs sm:text-sm font-semibold truncate leading-tight ${
                              isCurrent ? "text-emerald-400" : "text-white"
                            }`}
                          >
                            {track.title}
                          </h4>
                          <p style={{ color: "var(--theme-text-muted)" }} className="text-[11px] truncate mt-0.5 font-medium">
                            {track.artist}
                          </p>
                        </div>
                      </div>

                      {/* Duration */}
                      <div className="hidden sm:block sm:col-span-2 text-right text-xs font-mono text-neutral-400">
                        {track.duration || "3:30"}
                      </div>

                      {/* Action buttons */}
                      <div className="col-span-4 sm:col-span-1 flex items-center justify-end gap-1.5 text-neutral-400">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(track);
                          }}
                          className="p-1 hover:text-rose-400 transition-colors cursor-pointer"
                          title={fav ? "Saved" : "Favorite"}
                        >
                          <Heart size={14} className={fav ? "fill-rose-500 text-rose-500" : ""} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDownloadTrack(track, e)}
                          disabled={downloadingTrackId === track.id}
                          className="p-1 hover:text-cyan-400 transition-colors cursor-pointer"
                          title={downloadSuccessId === track.id ? "Downloaded!" : "Download MP3"}
                        >
                          {downloadingTrackId === track.id ? (
                            <Loader2 size={14} className="animate-spin text-cyan-400" />
                          ) : downloadSuccessId === track.id ? (
                            <Check size={14} className="text-emerald-400" />
                          ) : (
                            <Download size={14} />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            addToQueue(track);
                          }}
                          className="p-1 hover:text-white transition-colors cursor-pointer"
                          title="Add to queue"
                        >
                          <Plus size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShare(track);
                          }}
                          className="p-1 hover:text-white transition-colors cursor-pointer"
                          title="Share"
                        >
                          {copiedTrackId === track.id ? <Check size={14} className="text-emerald-400" /> : <Share2 size={14} />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* NOW PLAYING / TURNTABLE EXPANDED VIEW                            */}
      {/* ================================================================ */}
      {activeTab === "player" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fadeIn">
          {/* Left / Center Console */}
          <div
            style={{
              backgroundColor: "var(--theme-surface)",
              borderColor: "var(--theme-border-subtle)",
            }}
            className="lg:col-span-7 rounded-3xl border p-6 sm:p-10 flex flex-col space-y-8 relative overflow-hidden shadow-2xl"
          >
            {/* Backdrop glow */}
            <div
              style={{
                backgroundImage: `url(${currentTrack?.thumbnail})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
              className="absolute inset-0 opacity-20 blur-3xl pointer-events-none"
            />

            {/* Turntable Vinyl */}
            <div className="flex items-center justify-center z-10 py-4">
              <div className="relative w-64 h-64 sm:w-80 sm:h-80 flex items-center justify-center">
                <div
                  style={{
                    boxShadow: "0 0 50px rgba(0,0,0,0.8), inset 0 0 30px rgba(255,255,255,0.05)",
                    animationDuration: "12s",
                  }}
                  className={`w-full h-full rounded-full bg-gradient-to-tr from-neutral-900 via-neutral-950 to-neutral-900 border-4 border-neutral-800 flex items-center justify-center ${
                    isPlaying ? "animate-spin" : ""
                  }`}
                >
                  {/* Vinyl grooves */}
                  <div className="w-[85%] h-[85%] rounded-full border border-white/5 flex items-center justify-center">
                    <div className="w-[70%] h-[70%] rounded-full border border-white/5 flex items-center justify-center">
                      <div className="w-[50%] h-[50%] rounded-full border border-white/5" />
                    </div>
                  </div>

                  {/* Center Label */}
                  <div className="absolute w-28 h-28 rounded-full overflow-hidden border-2 border-white/20 shadow-2xl">
                    <img
                      src={currentTrack?.thumbnail || "https://i.ytimg.com/vi/5yx6BWlEVcY/hqdefault.jpg"}
                      alt="Vinyl Center"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div
                    style={{ backgroundColor: "var(--theme-surface)" }}
                    className="absolute w-5 h-5 rounded-full border border-white/40 shadow-inner"
                  />
                </div>
              </div>
            </div>

            {/* Track Info Header */}
            <div className="flex items-center justify-between gap-4 z-10 relative">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight truncate">
                    {currentTrack?.title || "No Track Playing"}
                  </h2>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider shrink-0 bg-emerald-500/15 text-emerald-400">
                    Full Audio
                  </span>
                </div>
                <p style={{ color: "var(--theme-text-muted)" }} className="text-sm font-medium truncate mt-0.5">
                  {currentTrack?.artist || "Select a song to start listening"}
                </p>
              </div>

              {currentTrack && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => handleDownloadTrack(currentTrack, e)}
                    disabled={downloadingTrackId === currentTrack.id}
                    className="p-3 rounded-2xl border border-white/10 hover:bg-white/10 text-neutral-300 hover:text-cyan-400 transition-colors cursor-pointer"
                    title={downloadSuccessId === currentTrack.id ? "Downloaded!" : "Download MP3"}
                  >
                    {downloadingTrackId === currentTrack.id ? (
                      <Loader2 size={18} className="animate-spin text-cyan-400" />
                    ) : downloadSuccessId === currentTrack.id ? (
                      <Check size={18} className="text-emerald-400" />
                    ) : (
                      <Download size={18} />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleFavorite(currentTrack)}
                    className="p-3 rounded-2xl border border-white/10 hover:bg-white/10 text-neutral-300 hover:text-rose-400 transition-colors cursor-pointer"
                    title={isFavorite(currentTrack.id) ? "Saved" : "Favorite"}
                  >
                    <Heart size={18} className={isFavorite(currentTrack.id) ? "fill-rose-500 text-rose-500" : ""} />
                  </button>
                </div>
              )}
            </div>

            {/* Scrubber Slider */}
            <div className="space-y-2 z-10 relative">
              <input
                type="range"
                min="0"
                max={duration > 0 ? duration : 100}
                value={currentTime}
                onChange={(e) => seek(parseFloat(e.target.value))}
                className="w-full accent-emerald-400 cursor-pointer h-1.5 rounded-lg bg-white/10"
              />
              <div className="flex items-center justify-between text-xs font-mono text-neutral-400">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Playback Controls */}
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
                className="p-3 rounded-2xl border border-white/10 text-neutral-200 hover:text-white transition-all cursor-pointer active:scale-95"
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
                className="p-3 rounded-2xl border border-white/10 text-neutral-200 hover:text-white transition-all cursor-pointer active:scale-95"
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
          </div>

          {/* Right Column: Up Next Queue */}
          <div
            style={{
              backgroundColor: "var(--theme-surface)",
              borderColor: "var(--theme-border-subtle)",
            }}
            className="lg:col-span-5 rounded-3xl border p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <Disc size={18} style={{ color: "var(--theme-accent)" }} />
                <span>Up Next in Queue</span>
              </h3>
              <span className="text-xs font-mono text-neutral-400">{queue.length} tracks</span>
            </div>

            {queue.length === 0 ? (
              <div className="p-10 text-center text-neutral-400 text-xs space-y-1">
                <p className="font-semibold text-white">Queue is empty</p>
                <p>Add songs from Discover or search to queue them up!</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto no-scrollbar">
                {queue.map((track, idx) => {
                  const isCurrent = currentTrack?.id === track.id;

                  return (
                    <div
                      key={`${track.id}-${idx}`}
                      onClick={() => playTrack(track, queue)}
                      className={`flex items-center justify-between p-2.5 rounded-2xl border transition-colors cursor-pointer group ${
                        isCurrent
                          ? "bg-white/10 border-white/20"
                          : "bg-transparent border-white/5 hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <img
                          src={track.thumbnail}
                          alt={track.title}
                          className="w-10 h-10 rounded-xl object-cover shrink-0"
                          referrerPolicy="no-referrer"
                        />
                        <div className="min-w-0 flex-1">
                          <h4 className={`text-xs font-semibold truncate ${isCurrent ? "text-emerald-400" : "text-white"}`}>
                            {track.title}
                          </h4>
                          <p style={{ color: "var(--theme-text-muted)" }} className="text-[11px] truncate">
                            {track.artist}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromQueue(idx);
                        }}
                        className="p-1.5 text-neutral-500 hover:text-rose-400 transition-colors cursor-pointer"
                        title="Remove"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
