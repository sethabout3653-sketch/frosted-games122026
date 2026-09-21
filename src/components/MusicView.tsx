import React, { useState, useEffect, useDeferredValue, useRef } from "react";
import {
  Search,
  Flame,
  Radio,
  Headphones,
  Sparkles,
  Heart,
  History,
  Play,
  Pause,
  Plus,
  Compass,
  Check,
  Music2,
  Disc3,
  Coffee,
  Moon,
  Zap,
  Gamepad2,
  Guitar,
  Waves,
  ExternalLink,
  Loader2,
  X,
  ListPlus,
} from "lucide-react";
import { YouTubeVideo } from "../types";
import { useMusic } from "../context/MusicContext";
import { extractYouTubeId } from "./YouTubePlayer";

interface MoodCategory {
  id: string;
  label: string;
  icon: any;
  query: string;
  color: string;
}

const MOOD_CATEGORIES: MoodCategory[] = [
  { id: "trending", label: "Trending Hits", icon: Flame, query: "top trending songs 2026 music", color: "from-amber-500/20 to-rose-500/20" },
  { id: "lofi", label: "Lofi & Study", icon: Headphones, query: "lofi hip hop beats to relax study to 2026", color: "from-indigo-500/20 to-purple-500/20" },
  { id: "hiphop", label: "Hip-Hop & Rap", icon: Zap, query: "top hip hop hits 2026 audio", color: "from-yellow-500/20 to-orange-500/20" },
  { id: "pop", label: "Pop Hits", icon: Sparkles, query: "top pop songs 2026 official music video", color: "from-pink-500/20 to-rose-500/20" },
  { id: "rnb", label: "R&B & Soul", icon: Moon, query: "chill r&b soul music 2026", color: "from-purple-500/20 to-indigo-500/20" },
  { id: "edm", label: "EDM & Dance", icon: Radio, query: "edm electronic festival music 2026", color: "from-cyan-500/20 to-blue-500/20" },
  { id: "rock", label: "Indie & Rock", icon: Guitar, query: "indie alternative rock music 2026", color: "from-emerald-500/20 to-teal-500/20" },
  { id: "gaming", label: "Gaming & Synth", icon: Gamepad2, query: "gaming ost synthwave chill 2026", color: "from-violet-500/20 to-fuchsia-500/20" },
  { id: "acoustic", label: "Cozy Acoustic", icon: Coffee, query: "cozy acoustic guitar coffee house songs", color: "from-amber-600/20 to-yellow-600/20" },
  { id: "ambient", label: "Deep Ambient", icon: Waves, query: "deep ambient focus soundscapes study", color: "from-blue-600/20 to-cyan-600/20" },
];

export default function MusicView() {
  const {
    currentTrack,
    isPlaying,
    playTrack,
    togglePlay,
    addToQueue,
    isLiked,
    toggleLike,
    likedTracks,
    history,
  } = useMusic();

  const [activeTab, setActiveTab] = useState<"discover" | "liked" | "history">("discover");
  const [selectedMood, setSelectedMood] = useState<string>("trending");
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDeferredValue(searchQuery);

  const [tracks, setTracks] = useState<YouTubeVideo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Live autocomplete suggestions from YouTube as user types
  useEffect(() => {
    if (!deferredSearch || deferredSearch.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    let isSubscribed = true;
    const fetchSuggestions = async () => {
      try {
        const res = await fetch(`/api/youtube/suggest?q=${encodeURIComponent(deferredSearch)}`);
        if (res.ok) {
          const data = await res.json();
          if (isSubscribed && data.suggestions) {
            setSuggestions(data.suggestions);
          }
        }
      } catch (err) {
        // Ignore suggestion failures
      }
    };

    const timer = setTimeout(fetchSuggestions, 200);
    return () => {
      isSubscribed = false;
      clearTimeout(timer);
    };
  }, [deferredSearch]);

  // Load tracks when mood or search changes
  useEffect(() => {
    if (activeTab !== "discover") return;

    let isCancelled = false;
    setIsLoading(true);

    const loadMusic = async () => {
      try {
        let endpoint = "";
        if (deferredSearch.trim()) {
          // Direct search query
          endpoint = `/api/youtube/search?q=${encodeURIComponent(deferredSearch + " music")}`;
        } else {
          // Genre/mood trending tracks
          const moodObj = MOOD_CATEGORIES.find((m) => m.id === selectedMood);
          const q = moodObj ? moodObj.query : "top hits 2026 music";
          endpoint = `/api/youtube/search?q=${encodeURIComponent(q)}`;
        }

        const res = await fetch(endpoint);
        if (res.ok) {
          const data = await res.json();
          if (!isCancelled && Array.isArray(data.videos)) {
            setTracks(data.videos);
          }
        }
      } catch (err) {
        console.error("Failed to load music tracks:", err);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };

    loadMusic();

    return () => {
      isCancelled = true;
    };
  }, [activeTab, selectedMood, deferredSearch]);

  // Handle direct URL paste or submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    const raw = searchQuery.trim();
    if (!raw) return;

    // Check if it's a direct YouTube or YouTube Music link
    const extractedId = extractYouTubeId(raw);
    if (extractedId && extractedId.length === 11) {
      const directTrack: YouTubeVideo = {
        id: extractedId,
        title: `Playing YouTube Track (${extractedId})`,
        channelTitle: "YouTube Music",
        thumbnail: `https://i.ytimg.com/vi/${extractedId}/hqdefault.jpg`,
      };
      playTrack(directTrack);
      setSearchQuery("");
      return;
    }
  };

  const handleSelectSuggestion = (suggestion: string) => {
    setSearchQuery(suggestion);
    setShowSuggestions(false);
  };

  // Play a track and set the whole current list as queue
  const handlePlayCard = (track: YouTubeVideo) => {
    if (currentTrack?.id === track.id) {
      togglePlay();
    } else {
      const activeList = activeTab === "liked" ? likedTracks : activeTab === "history" ? history : tracks;
      playTrack(track, activeList);
    }
  };

  const currentMoodObj = MOOD_CATEGORIES.find((m) => m.id === selectedMood) || MOOD_CATEGORIES[0];

  return (
    <div id="music-view" className="w-full flex-1 flex flex-col space-y-6 pb-24 max-w-7xl mx-auto px-3 sm:px-6">
      {/* Warm Ambient Vibe Header Banner */}
      <div
        style={{
          borderColor: "var(--theme-border-subtle, rgba(255, 255, 255, 0.1))",
        }}
        className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-indigo-950/40 via-neutral-900/60 to-purple-950/30 p-6 sm:p-8 backdrop-blur-xl shadow-2xl"
      >
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-bold text-[var(--theme-text-accent,#818cf8)] shadow-sm">
              <Disc3 size={14} className={isPlaying ? "animate-spin text-indigo-400" : "text-indigo-400"} />
              <span>Cozy Listening Lounge</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Music from YouTube Music
            </h1>
            <p className="text-sm text-neutral-300 leading-relaxed">
              Explore hits, soothing study beats, hip-hop, indie, and chill playlists. Search any track or paste any link — it keeps playing while you study, chat, or game!
            </p>
          </div>

          {/* Quick tab switcher: Discover / Liked / History */}
          <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-black/40 border border-white/10 shrink-0 self-start md:self-center">
            <button
              type="button"
              onClick={() => setActiveTab("discover")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "discover"
                  ? "bg-[var(--theme-accent,#6366f1)] text-white shadow-md"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <Compass size={14} />
              <span>Discover</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("liked")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "liked"
                  ? "bg-[var(--theme-accent,#6366f1)] text-white shadow-md"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <Heart size={14} className={likedTracks.length > 0 ? "fill-red-400 text-red-400" : ""} />
              <span>Saved ({likedTracks.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "history"
                  ? "bg-[var(--theme-accent,#6366f1)] text-white shadow-md"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <History size={14} />
              <span>History</span>
            </button>
          </div>
        </div>

        {/* Ambient subtle glow blob */}
        <div className="absolute -right-10 -bottom-10 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Search Input Bar with Live YouTube Auto-Suggestions */}
      <div className="relative z-30">
        <form onSubmit={handleSearchSubmit} className="relative">
          <div
            style={{
              backgroundColor: "var(--theme-surface, rgba(24, 24, 32, 0.8))",
              borderColor: "var(--theme-border-subtle, rgba(255, 255, 255, 0.15))",
            }}
            className="flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-lg backdrop-blur-xl focus-within:ring-2 focus-within:ring-[var(--theme-accent,#6366f1)] transition-all"
          >
            <Search size={18} className="text-neutral-400 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Search any song, artist, album, or paste a YouTube Music link..."
              className="w-full bg-transparent text-sm text-white placeholder-neutral-400 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setShowSuggestions(false);
                }}
                className="p-1 text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            )}
            <button
              type="submit"
              style={{
                backgroundColor: "var(--theme-accent, #6366f1)",
              }}
              className="px-4 py-1.5 rounded-xl text-xs font-bold text-white shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0"
            >
              Search
            </button>
          </div>
        </form>

        {/* Live Auto-Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            style={{
              backgroundColor: "rgba(20, 22, 32, 0.96)",
              borderColor: "var(--theme-border-subtle, rgba(255, 255, 255, 0.12))",
            }}
            className="absolute top-full left-0 right-0 mt-2 rounded-2xl border shadow-2xl backdrop-blur-2xl overflow-hidden py-2 z-50 animate-in fade-in slide-in-from-top-1"
          >
            <div className="px-3 py-1 text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
              Instant YouTube Suggestions
            </div>
            {suggestions.map((sug, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectSuggestion(sug)}
                className="w-full px-4 py-2.5 flex items-center gap-3 text-left text-sm text-neutral-200 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
              >
                <Search size={14} className="text-neutral-500" />
                <span className="truncate">{sug}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Mood / Genre Selector Chips (Only when on Discover) */}
      {activeTab === "discover" && !searchQuery && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
              <Music2 size={13} />
              <span>Choose Your Vibe</span>
            </h3>
            <span className="text-xs text-neutral-500">Live updated streams</span>
          </div>

          <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-none">
            {MOOD_CATEGORIES.map((m) => {
              const Icon = m.icon;
              const isSelected = selectedMood === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedMood(m.id)}
                  style={{
                    backgroundColor: isSelected ? "var(--theme-accent, #6366f1)" : "var(--theme-surface, rgba(255,255,255,0.05))",
                    borderColor: isSelected ? "var(--theme-border, #818cf8)" : "var(--theme-border-subtle, rgba(255,255,255,0.1))",
                  }}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    isSelected
                      ? "text-white shadow-lg shadow-indigo-950/40 ring-1 ring-white/20 scale-105"
                      : "text-neutral-300 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <Icon size={14} className={isSelected ? "text-white" : "text-neutral-400"} />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Tab Header Title */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2.5">
          <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
            {activeTab === "discover" && (
              <>
                <span>{searchQuery ? `Results for "${searchQuery}"` : currentMoodObj.label}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-neutral-300 font-normal">
                  {tracks.length} tracks
                </span>
              </>
            )}
            {activeTab === "liked" && (
              <>
                <span>Saved Favorites</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-semibold border border-red-500/30">
                  {likedTracks.length}
                </span>
              </>
            )}
            {activeTab === "history" && (
              <>
                <span>Listening History</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-neutral-300 font-normal">
                  {history.length}
                </span>
              </>
            )}
          </h2>
        </div>

        {/* Quick Play All Button */}
        {((activeTab === "discover" && tracks.length > 0) ||
          (activeTab === "liked" && likedTracks.length > 0) ||
          (activeTab === "history" && history.length > 0)) && (
          <button
            type="button"
            onClick={() => {
              const list = activeTab === "liked" ? likedTracks : activeTab === "history" ? history : tracks;
              if (list.length > 0) {
                playTrack(list[0], list);
              }
            }}
            style={{
              backgroundColor: "var(--theme-accent, #6366f1)",
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <Play size={13} className="fill-white" />
            <span>Play All</span>
          </button>
        )}
      </div>

      {/* Main Track Display Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <Loader2 size={36} className="text-[var(--theme-text-accent,#818cf8)] animate-spin" />
          <p className="text-sm font-semibold text-neutral-300">Tuning into YouTube Music...</p>
        </div>
      ) : activeTab === "liked" && likedTracks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
          <Heart size={44} className="text-neutral-600" />
          <h3 className="text-base font-bold text-white">No saved tracks yet</h3>
          <p className="text-xs text-neutral-400 max-w-sm">
            Tap the heart icon on any track to save your favorite songs here for easy listening!
          </p>
          <button
            type="button"
            onClick={() => setActiveTab("discover")}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            Discover Music
          </button>
        </div>
      ) : activeTab === "history" && history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
          <History size={44} className="text-neutral-600" />
          <h3 className="text-base font-bold text-white">No listening history</h3>
          <p className="text-xs text-neutral-400 max-w-sm">
            Songs you listen to will automatically show up here so you can revisit them anytime.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {(activeTab === "liked" ? likedTracks : activeTab === "history" ? history : tracks).map(
            (track, idx) => {
              const isCurrent = currentTrack?.id === track.id;
              const liked = isLiked(track.id);

              return (
                <div
                  key={`${track.id}-${idx}`}
                  style={{
                    backgroundColor: isCurrent ? "rgba(99, 102, 241, 0.12)" : "var(--theme-surface, rgba(20, 22, 30, 0.7))",
                    borderColor: isCurrent ? "var(--theme-accent, #6366f1)" : "var(--theme-border-subtle, rgba(255, 255, 255, 0.08))",
                  }}
                  className={`group relative flex flex-col rounded-2xl border p-3 shadow-md hover:shadow-2xl transition-all duration-200 hover:-translate-y-1 ${
                    isCurrent ? "ring-1 ring-[var(--theme-accent,#6366f1)]" : ""
                  }`}
                >
                  {/* Artwork Container with Duration Badge & Play Overlay */}
                  <div
                    onClick={() => handlePlayCard(track)}
                    className="relative aspect-video sm:aspect-square w-full rounded-xl overflow-hidden bg-neutral-900 cursor-pointer shadow-inner"
                  >
                    <img
                      src={track.thumbnail}
                      alt={track.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />

                    {/* Track Duration Badge */}
                    {track.duration && (
                      <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/85 text-[11px] font-mono font-medium text-white shadow-sm">
                        {track.duration}
                      </span>
                    )}

                    {/* Play / Pause Center Floating Button */}
                    <div className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-[var(--theme-accent,#6366f1)] text-white shadow-xl flex items-center justify-center opacity-0 group-hover:opacity-100 group-hover:scale-105 active:scale-95 transition-all duration-200">
                      {isCurrent && isPlaying ? (
                        <Pause size={20} className="fill-white" />
                      ) : (
                        <Play size={20} className="fill-white ml-0.5" />
                      )}
                    </div>

                    {/* Now Playing equalizer indicator badge */}
                    {isCurrent && (
                      <div className="absolute top-2 left-2 px-2.5 py-1 rounded-full bg-black/80 backdrop-blur-md border border-indigo-500/40 text-[10px] font-bold text-indigo-300 flex items-center gap-1.5 shadow-md">
                        <Disc3 size={11} className={isPlaying ? "animate-spin" : ""} />
                        <span>{isPlaying ? "Playing" : "Paused"}</span>
                      </div>
                    )}
                  </div>

                  {/* Track Meta Details */}
                  <div className="mt-3 flex-1 flex flex-col justify-between">
                    <div>
                      <h4
                        onClick={() => handlePlayCard(track)}
                        className="text-sm font-bold text-white line-clamp-2 leading-snug cursor-pointer group-hover:text-[var(--theme-text-accent,#818cf8)] transition-colors"
                        title={track.title}
                      >
                        {track.title}
                      </h4>
                      <p className="text-xs text-neutral-400 mt-1 truncate">
                        {track.channelTitle || "YouTube Creator"}
                      </p>
                    </div>

                    {/* Bottom Card Actions: Like & Add to Queue */}
                    <div className="flex items-center justify-between pt-3 mt-2 border-t border-white/5">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => toggleLike(track)}
                          className="p-1.5 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                          title={liked ? "Remove from Liked" : "Save to Liked"}
                        >
                          <Heart size={15} className={liked ? "fill-red-400 text-red-400" : ""} />
                        </button>
                        <button
                          type="button"
                          onClick={() => addToQueue(track)}
                          className="p-1.5 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                          title="Add to Up Next Queue"
                        >
                          <ListPlus size={15} />
                        </button>
                      </div>

                      <a
                        href={`https://www.youtube.com/watch?v=${track.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-neutral-500 hover:text-neutral-300 p-1 transition-colors"
                        title="Open on YouTube"
                      >
                        <ExternalLink size={13} />
                      </a>
                    </div>
                  </div>
                </div>
              );
            }
          )}
        </div>
      )}
    </div>
  );
}
