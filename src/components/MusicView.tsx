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
  Terminal,
  Upload,
  Play,
  Plus,
  Disc,
  X,
  Volume2,
  FolderPlus,
  Layers,
  ArrowRight,
  Link as LinkIcon,
  Check,
} from "lucide-react";
import {
  useMusicPlayer,
  CURATED_RADIO_STATIONS,
  AudioTrack,
} from "../context/MusicPlayerContext";
import MusicPlayer from "./MusicPlayer";
import AudioEqualizerModal from "./AudioEqualizerModal";
import YtDlpPipelineDrawer from "./YtDlpPipelineDrawer";
import { getSavedVideos, getWatchHistory, toggleSaveVideo } from "../lib/youtubeStorage";

interface MusicViewProps {
  isActive?: boolean;
  onBackToHome?: () => void;
}

const SOUNDCLOUD_GENRES = [
  { id: "all", label: "Trending", icon: Flame },
  { id: "study", label: "Lofi & Chillhop", icon: Headphones },
  { id: "electronic", label: "Electronic / EDM", icon: Radio },
  { id: "hiphop", label: "Hip-Hop & Rap", icon: TrendingUp },
  { id: "favorites", label: "Favorites", icon: Heart },
  { id: "history", label: "Recently Played", icon: History },
  { id: "local", label: "Local Files", icon: Upload },
];

const SOUNDCLOUD_SUGGESTIONS = [
  "Chillhop Music",
  "Synthwave",
  "Flamingosis",
  "ODESZA",
  "San Holo",
  "Kudasai",
  "idealism",
  "SwuM",
  "MrSuicideSheep",
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
    isResolvingUrl,
    activePreset,
  } = useMusicPlayer();

  const [selectedGenre, setSelectedGenre] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const deferredSearch = useDeferredValue(searchQuery);
  const [tracks, setTracks] = useState<AudioTrack[]>(CURATED_RADIO_STATIONS);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isEqOpen, setIsEqOpen] = useState<boolean>(false);
  const [isPipelineOpen, setIsPipelineOpen] = useState<boolean>(false);
  const [urlStatus, setUrlStatus] = useState<string | null>(null);
  const [isFullPlayerMode, setIsFullPlayerMode] = useState<boolean>(false);

  const isDirectUrl = /^(https?:\/\/)?(www\.)?(soundcloud\.com|snd\.sc)\/.+$/i.test(
    searchQuery.trim()
  );

  // Exclusively query SoundCloud Search & Trending
  useEffect(() => {
    let isCancelled = false;

    if (selectedGenre === "favorites") {
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

    if (selectedGenre === "history") {
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

    if (selectedGenre === "local") {
      return;
    }

    async function fetchSoundCloudTracks() {
      setIsLoading(true);
      setUrlStatus(null);
      try {
        const query = deferredSearch.trim();

        if (query) {
          // 1. Direct SoundCloud URL Extraction
          if (isDirectUrl) {
            setUrlStatus("Resolving audio stream...");
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
                  setUrlStatus("Audio stream ready!");
                  setIsLoading(false);
                  return;
                }
              }
            } catch (e) {}
          }

          // 2. SoundCloud Search
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
          // Fetch SoundCloud trending by category
          const trendRes = await fetch(`/api/soundcloud/trending?category=${selectedGenre}`).catch(() => null);
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

        // Final curated SoundCloud fallback
        if (!isCancelled) {
          setTracks(CURATED_RADIO_STATIONS);
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
  }, [selectedGenre, deferredSearch, isDirectUrl]);

  // Handle Form Submit (Search or Direct Link)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    if (isDirectUrl) {
      setUrlStatus("Connecting to audio stream...");
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

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 space-y-6 flex flex-col flex-1 animate-fadeIn">
      {/* Top Header & Search Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-md">
            <Radio size={20} />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Music</span>
            </h1>
            <p className="text-xs text-neutral-400">
              Listen to your favorite tracks, playlists & audio
            </p>
          </div>
        </div>
      </div>

      {/* Direct Stream Resolver / Search Input */}
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="flex items-center gap-2 bg-[#121522] p-2 rounded-2xl border border-white/10 shadow-inner focus-within:border-indigo-500/60 transition-colors">
          <div className="pl-3 text-neutral-400">
            {isDirectUrl ? <LinkIcon size={16} className="text-indigo-400" /> : <Search size={16} />}
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tracks, artists, YouTube, SoundCloud, Bandcamp, or paste any music link..."
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

          <button
            type="submit"
            disabled={!searchQuery.trim()}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer shrink-0 shadow-md shadow-indigo-600/30 flex items-center gap-1.5"
          >
            {isDirectUrl ? (
              <>
                <Play size={12} className="fill-white" />
                <span>Play Track</span>
              </>
            ) : (
              <span>Search</span>
            )}
          </button>
        </div>

        {/* Quick Suggestion Pills */}
        {!searchQuery && selectedGenre === "all" && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar no-scrollbar text-xs text-neutral-400">
            <span className="text-[11px] font-bold text-neutral-500 mr-1 shrink-0">Featured Artists:</span>
            {SOUNDCLOUD_SUGGESTIONS.map((sug) => (
              <button
                key={sug}
                type="button"
                onClick={() => setSearchQuery(sug)}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white text-[11px] whitespace-nowrap transition-colors cursor-pointer shrink-0"
              >
                {sug}
              </button>
            ))}
          </div>
        )}

        {urlStatus && (
          <div className="px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs font-mono text-indigo-300 flex items-center gap-2">
            <span className="animate-spin">&bull;</span>
            <span>{urlStatus}</span>
          </div>
        )}
      </form>

      {/* Quick Genre Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar no-scrollbar select-none">
        {SOUNDCLOUD_GENRES.map((genre) => {
          const Icon = genre.icon;
          const isActive = selectedGenre === genre.id;
          return (
            <button
              key={genre.id}
              type="button"
              onClick={() => {
                setSelectedGenre(genre.id);
                setSearchQuery("");
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                isActive
                  ? "bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/30"
                  : "bg-white/5 border-white/5 text-neutral-400 hover:text-white hover:bg-white/10"
              }`}
            >
              <Icon size={14} className={isActive ? "text-white" : "text-neutral-400"} />
              <span>{genre.label}</span>
            </button>
          );
        })}
      </div>

      {/* Local Files Dropzone Mode */}
      {selectedGenre === "local" && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleFileDrop}
          className="border-2 border-dashed border-indigo-500/30 hover:border-indigo-500/60 bg-indigo-500/5 rounded-3xl p-10 text-center space-y-4 transition-colors cursor-pointer"
        >
          <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mx-auto">
            <Upload size={28} />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">Drag & Drop Audio Files</h3>
            <p className="text-xs text-neutral-400 max-w-md mx-auto">
              Play MP3, WAV, FLAC, M4A, or OGG tracks instantly with zero upload time.
            </p>
          </div>
          <div>
            <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors cursor-pointer shadow-lg shadow-indigo-600/30">
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

      {/* Track Grid Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-neutral-400">
          <span className="font-bold uppercase tracking-wider text-neutral-300">
            {selectedGenre === "favorites"
              ? "Favorite Saved Tracks"
              : selectedGenre === "history"
              ? "Recently Played Tracks"
              : searchQuery
              ? `Results for "${searchQuery}"`
              : "Audio Tracks"}
          </span>
          <span>{tracks.length} tracks</span>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div
                key={i}
                className="bg-[#121522] rounded-2xl p-3 space-y-3 border border-white/5 animate-pulse"
              >
                <div className="aspect-square rounded-xl bg-white/5" />
                <div className="h-4 bg-white/10 rounded w-3/4" />
                <div className="h-3 bg-white/5 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : tracks.filter((t) => t.sourceType === "soundcloud" || t.permalinkUrl?.includes("soundcloud.com") || t.id?.startsWith("sc-") || t.localFile).length === 0 ? (
          <div className="p-12 text-center text-neutral-400 space-y-2">
            <Disc size={32} className="mx-auto text-neutral-500" />
            <p className="text-sm font-semibold">No tracks found</p>
            <p className="text-xs text-neutral-500">Try searching for an artist like &quot;Chillhop Music&quot; or pasting a music link.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {tracks
              .filter((t) => t.sourceType === "soundcloud" || t.permalinkUrl?.includes("soundcloud.com") || t.id?.startsWith("sc-") || t.localFile)
              .map((track, idx) => {
              const isCurrentlyPlaying = currentTrack?.id === track.id && isPlaying;
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
                  className="group bg-[#121522] hover:bg-[#181c2e] border border-white/5 hover:border-indigo-500/40 rounded-2xl p-3 flex flex-col space-y-3 transition-all duration-200 cursor-pointer shadow-lg relative overflow-hidden"
                >
                  {/* Square Album Cover with Hover Play Icon */}
                  <div className="aspect-square rounded-xl overflow-hidden bg-black/50 relative border border-white/5">
                    <img
                      src={track.thumbnail}
                      alt={track.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                    />

                    {/* Audio Badge */}
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-indigo-600/90 backdrop-blur-md text-[9px] font-bold tracking-wider uppercase text-white border border-indigo-400/40 flex items-center gap-1 shadow-sm">
                      <Radio size={10} />
                      <span>Audio</span>
                    </div>

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
                      <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xl shadow-indigo-600/50 group-hover:scale-110 transition-transform">
                        {isCurrentlyPlaying ? (
                          <span className="w-3 h-3 rounded-full bg-white animate-ping" />
                        ) : (
                          <Play size={20} className="fill-white translate-x-0.5" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Track Info */}
                  <div className="flex items-start justify-between gap-2 min-w-0 flex-1">
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-white truncate group-hover:text-indigo-400 transition-colors">
                        {track.title}
                      </h4>
                      <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                        {track.artist || track.channelTitle || "Artist"}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        addToQueue(track);
                      }}
                      className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                      title="Add to queue"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Equalizer & Pipeline Modals */}
      <AudioEqualizerModal isOpen={isEqOpen} onClose={() => setIsEqOpen(false)} />
      <YtDlpPipelineDrawer isOpen={isPipelineOpen} onClose={() => setIsPipelineOpen(false)} />
    </div>
  );
}
