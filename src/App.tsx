import React, { useState, useEffect, useMemo, useCallback, useDeferredValue } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Game } from "./types";
import { fetchGamesList, getUniqueTags, isFnfGame, isFnfMod, deduplicateGames, formatTagLabel } from "./utils";
import { fetchLuminGames, getLocalLuminGames, fetchLuminSessionId, getLocalLuminGamesWithSession } from "./lumin";
import Header from "./components/Header";
import GameGrid from "./components/GameGrid";
import GamePlayer from "./components/GamePlayer";
import Chat from "./components/Chat";
import YouTubeView from "./components/YouTubeView";
import AIAssistant from "./components/AIAssistant";
import BackgroundEditor, { DEFAULT_BACKGROUND, AppBackground } from "./components/BackgroundEditor";
import SettingsModal from "./components/SettingsModal";
import LoadingScreen from "./components/LoadingScreen";
import { applyTabCloak, getSavedTabCloak } from "./tabCloaks";
import { useActivityTracker } from "./lib/activity-tracker";
import { applyTheme, getSavedTheme } from "./utils/theme";
import localZones from "./zones.json";
import { CallProvider, useCall } from "./context/CallContext";
import IncomingCallNotification from "./components/IncomingCallNotification";
import ActiveCallModal from "./components/ActiveCallModal";
import { useFavorites } from "./lib/favorites";
import { purgeNonAllowedUsers } from "./lib/user-filter";
import { Sparkles, Gamepad2, Shuffle, Heart, Flame, Compass, Play } from "lucide-react";

const SOUNDBOARD_GAME: Game = {
  id: "soundboard",
  name: "Soundboard",
  cover: "https://soundboardguys.com/favicon.ico",
  url: "https://soundboardguys.com/",
  author: "Soundboard Guys",
  source: "catalog",
  special: ["all genres", "soundboard"],
};

function prepareGame(g: Game, defaultSource: "catalog" | "luminsdk" = "catalog"): Game {
  const isFnf = isFnfGame(g.name, g.special);
  const isMod = isFnf && isFnfMod(g.name, g.special);

  let sTags = g.special
    ? [
        ...g.special.filter((t) => {
          const clean = t.toLowerCase();
          return clean !== "luminsdk" && clean !== "fnf" && clean !== "fnf-mod";
        }),
      ]
    : [];

  if (isMod) {
    sTags.unshift("fnf-mod");
  } else if (isFnf) {
    sTags.unshift("fnf");
  }

  const searchTerms = [
    g.name,
    g.author || "",
    ...sTags,
    isFnf ? "fnf friday night funkin" : "",
    isMod ? "mod fnf mod fnf-mod" : "",
  ]
    .join(" ")
    .toLowerCase();

  return {
    ...g,
    source: g.source || defaultSource,
    special: sTags,
    isMod,
    _search: searchTerms,
  };
}

function AppContent() {
  const [currentView, setCurrentView] = useState<"home" | "game" | "chat" | "youtube" | "assistant">("home");
  const [chatInitialTab, setChatInitialTab] = useState<"chat" | "voice" | "profile">("chat");
  const [autoJoinVoice, setAutoJoinVoice] = useState(false);
  const [activeVideoTitle, setActiveVideoTitle] = useState<string | null>(null);
  const { setOnOpenGroupVoice } = useCall();

  useEffect(() => {
    setOnOpenGroupVoice(() => {
      setCurrentView("chat");
      setChatInitialTab("voice");
      setAutoJoinVoice(true);
    });
  }, [setOnOpenGroupVoice]);

  const [showStartup, setShowStartup] = useState(true);
  const [games, setGames] = useState<Game[]>(() => {
    const catalogPrepared = (localZones as Game[])
      .filter((g) => g.id !== -1 && g.name !== "-3" && g.id !== 816)
      .map((g) => prepareGame(g, "catalog"));
    const luminPrepared = getLocalLuminGames()
      .filter((g) => g.name !== "-3" && g.id !== 816)
      .map((g) => prepareGame(g, "luminsdk"));
    const catalog = deduplicateGames(catalogPrepared, luminPrepared).sort((a, b) => (a?.name || "").localeCompare(b?.name || ""));
    return [SOUNDBOARD_GAME, ...catalog];
  });
  const [loadingLive, setLoadingLive] = useState(true);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [background, setBackground] = useState<AppBackground>(() => {
    try { return JSON.parse(localStorage.getItem("frosted_background") || "null") || DEFAULT_BACKGROUND; } catch { return DEFAULT_BACKGROUND; }
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isThemeOpen, setIsThemeOpen] = useState(false);

  useEffect(() => {
    const saved = getSavedTabCloak();
    if (saved) {
      applyTabCloak(saved);
    }
    const savedTheme = getSavedTheme();
    applyTheme(savedTheme.r, savedTheme.g, savedTheme.b);
  }, []);

  useEffect(() => {
    purgeNonAllowedUsers().catch(() => {});
    const safetyTimeout = window.setTimeout(() => setShowStartup(false), 5000);
    return () => window.clearTimeout(safetyTimeout);
  }, []);

  useEffect(() => {
    const keepAlivePing = () => {
      fetch("/api/ping", { cache: "no-store" }).catch(() => {});
    };
    const interval = window.setInterval(keepAlivePing, 10 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (currentView === "chat" || currentView === "game" || currentView === "assistant") {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, [currentView]);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDeferredValue(searchQuery);
  const [selectedTag, setSelectedTag] = useState("all");

  useActivityTracker({
    currentView,
    selectedGame,
    searchQuery: deferredSearch,
    selectedTag,
    activeVideoTitle,
  });

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleTagChange = useCallback((tag: string) => {
    setSelectedTag(tag);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadLibraries = async () => {
      try {
        const [liveGamesResult, luminGamesResult] = await Promise.allSettled([
          fetchGamesList(),
          fetchLuminGames(),
        ]);

        if (!isMounted) return;

        const baseList: Game[] = (
          liveGamesResult.status === "fulfilled"
            ? liveGamesResult.value
            : (localZones as Game[])
        )
          .filter((g) => g.id !== -1 && g.name !== "-3" && g.id !== 816)
          .map((g) => prepareGame(g, "catalog"));

        let luminList: Game[] = [];
        if (luminGamesResult.status === "fulfilled" && luminGamesResult.value.length > 0) {
          luminList = luminGamesResult.value;
        } else {
          const freshSessionId = await fetchLuminSessionId();
          if (freshSessionId) {
            luminList = getLocalLuminGamesWithSession(freshSessionId);
          } else {
            luminList = getLocalLuminGames();
          }
        }

        const luminPrepared = luminList.map((g) => prepareGame(g, "luminsdk"));
        const combined = deduplicateGames(baseList, luminPrepared).sort((a, b) => (a?.name || "").localeCompare(b?.name || ""));
        setGames([SOUNDBOARD_GAME, ...combined.filter((g) => g.id !== SOUNDBOARD_GAME.id)]);
        setLoadingLive(false);
      } catch {
        if (isMounted) {
          setLoadingLive(false);
        }
      }
    };

    loadLibraries();

    return () => {
      isMounted = false;
    };
  }, []);

  const tags = useMemo(() => {
    return getUniqueTags(games);
  }, [games]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("game")) {
      params.delete("game");
      const cleanSearch = params.toString();
      const cleanUrl = window.location.pathname + (cleanSearch ? `?${cleanSearch}` : "") + window.location.hash;
      window.history.replaceState({}, "", cleanUrl);
    }
  }, []);

  const { favoriteIds, toggleFavorite } = useFavorites();

  const handleSelectGame = useCallback((game: Game) => {
    if (showStartup) return;
    setSelectedGame(game);
    setCurrentView("game");
  }, [showStartup]);

  const handleBackToHub = useCallback(() => {
    setSelectedGame(null);
    setCurrentView("home");
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";
  }, []);

  const handleOpenChat = useCallback(() => {
    setCurrentView("chat");
  }, []);

  const handleOpenYouTube = useCallback(() => {
    setCurrentView("youtube");
  }, []);

  const handleOpenAssistant = useCallback(() => {
    setCurrentView("assistant");
  }, []);

  const handleRandomGame = useCallback(() => {
    if (games.length === 0) return;
    const playable = games.filter((g) => g.id !== -1);
    const random = playable[Math.floor(Math.random() * playable.length)];
    if (random) {
      handleSelectGame(random);
    }
  }, [games, handleSelectGame]);

  const processedGames = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    const hasQuery = query.length > 0;
    const isFavorites = selectedTag === "favorites";
    const hasTag = selectedTag !== "all" && !isFavorites;

    if (!hasQuery && !hasTag && !isFavorites) {
      return games;
    }

    return games.filter((g) => {
      if (isFavorites && !favoriteIds.has(String(g.id))) {
        return false;
      }
      if (hasTag && !g.special?.includes(selectedTag)) {
        return false;
      }
      if (hasQuery && g._search && !g._search.includes(query)) {
        return false;
      }
      return true;
    });
  }, [games, selectedTag, deferredSearch, favoriteIds]);

  const isSoundboardActive = currentView === "game" && (selectedGame?.id === "soundboard" || selectedGame?.name?.toLowerCase().includes("soundboard"));

  // Popular quick tags for pill filter row
  const quickPillTags = [
    { id: "all", label: "All Games" },
    { id: "favorites", label: "Favorites", isHeart: true },
    { id: "action", label: "Action" },
    { id: "retro", label: "Retro" },
    { id: "arcade", label: "Arcade" },
    { id: "puzzle", label: "Puzzle" },
    { id: "fnf", label: "FNF" },
    { id: "2-player", label: "2-Player" },
    { id: "driving", label: "Driving" },
    { id: "shooting", label: "Shooting" },
    { id: "soundboard", label: "Soundboard" },
  ];

  // Featured spotlight games for hero section
  const spotlightGame = useMemo(() => {
    return games.find((g) => g.name.toLowerCase().includes("slope") || g.name.toLowerCase().includes("geometry dash") || g.name.toLowerCase().includes("retro arcade") || g.name.toLowerCase().includes("soundboard")) || games[0];
  }, [games]);

  return (
    <>
      <AnimatePresence mode="wait">
        {showStartup && (
          <LoadingScreen onComplete={() => setShowStartup(false)} />
        )}
      </AnimatePresence>
      <div id="app-root" className={`${(currentView === "game" && !isSoundboardActive) || currentView === "chat" || currentView === "assistant" ? "h-screen overflow-hidden" : "min-h-screen"} ${showStartup ? "pointer-events-none select-none" : ""} text-white antialiased font-sans flex flex-col selection:bg-white/20 selection:text-white`} style={{ background: background.type === "image" ? `url(${background.value}) center / cover fixed` : background.value }}>
      
      {/* Interactive Top Header Component */}
      <Header
        searchQuery={searchQuery}
        setSearchQuery={handleSearchChange}
        selectedTag={selectedTag}
        setSelectedTag={handleTagChange}
        tags={tags}
        currentView={currentView}
        onGoHome={handleBackToHub}
        onChatClick={handleOpenChat}
        onYouTubeClick={handleOpenYouTube}
        onAssistantClick={handleOpenAssistant}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenTheme={() => setIsThemeOpen(true)}
        onRandomGame={handleRandomGame}
      />

      {/* Main Content Area */}
      <main className={`flex-1 w-full flex flex-col relative ${isSoundboardActive ? "min-h-0 overflow-visible" : "min-h-0"}`}>
        
        {/* Game Player View */}
        <motion.div 
          animate={{
            opacity: (currentView === "game" && selectedGame) ? 1 : 0,
            y: (currentView === "game" && selectedGame) ? 0 : 16,
            scale: (currentView === "game" && selectedGame) ? 1 : 0.99,
          }}
          initial={{ opacity: 0, y: 16, scale: 0.99 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          style={{ 
            pointerEvents: (currentView === "game" && selectedGame) ? "auto" : "none",
            transform: "translateZ(0)"
          }}
          className={`flex-1 w-full flex flex-col ${isSoundboardActive ? "min-h-0 overflow-visible" : "min-h-0"} ${(currentView === "game" && selectedGame) ? "" : "absolute inset-x-0 top-0 invisible h-0 overflow-hidden"}`}
        >
          {selectedGame && (
            <GamePlayer
              game={selectedGame}
              onBack={handleBackToHub}
            />
          )}
        </motion.div>

        {/* Catalog Grid View */}
        <motion.div 
          animate={{
            opacity: currentView === "home" ? 1 : 0,
            y: currentView === "home" ? 0 : 16,
            scale: currentView === "home" ? 1 : 0.99,
          }}
          initial={{ opacity: 0, y: 0, scale: 1 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          style={{ 
            pointerEvents: currentView === "home" ? "auto" : "none",
            transform: "translateZ(0)"
          }}
          className={`w-full max-w-7xl mx-auto px-4 py-5 md:px-8 flex-1 flex flex-col gap-6 ${currentView === "home" ? "" : "absolute inset-x-0 top-0 invisible h-0 overflow-hidden"}`}
        >
          {/* Spotlight Hero Banner (Visible when not actively searching) */}
          {!searchQuery && selectedTag === "all" && spotlightGame && (
            <div
              style={{
                backgroundColor: "var(--theme-surface)",
                borderColor: "var(--theme-border)",
              }}
              className="relative overflow-hidden rounded-3xl border p-5 sm:p-7 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-6 group"
            >
              {/* Glow Accent Backdrop */}
              <div
                className="absolute -right-16 -top-16 w-80 h-80 rounded-full blur-3xl opacity-30 pointer-events-none"
                style={{ backgroundColor: "var(--theme-accent-hover)" }}
              />

              <div className="flex-1 space-y-2.5 z-10 text-center sm:text-left">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase text-amber-300 bg-amber-500/15 border border-amber-500/30">
                  <Flame size={13} className="text-amber-400" />
                  <span>Featured Quick Launch</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {spotlightGame.name}
                </h1>
                <p className="text-xs sm:text-sm text-neutral-300 max-w-xl font-normal leading-relaxed">
                  Jump right into popular titles or explore the library of {games.length.toLocaleString()} unblocked games, social chat rooms, and study tools.
                </p>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-2">
                  <button
                    onClick={() => handleSelectGame(spotlightGame)}
                    style={{
                      backgroundColor: "var(--theme-accent)",
                      borderColor: "var(--theme-border-strong)",
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-2xl border text-xs font-bold text-white shadow-lg hover:border-white/40 hover:scale-102 active:scale-98 transition-all cursor-pointer"
                  >
                    <Play size={14} className="fill-white" />
                    <span>Play Now</span>
                  </button>

                  <button
                    onClick={handleRandomGame}
                    style={{
                      backgroundColor: "var(--theme-darkest)",
                      borderColor: "var(--theme-border-subtle)",
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-xs font-bold text-neutral-200 hover:text-white hover:border-[var(--theme-border)] hover:bg-white/5 active:scale-98 transition-all cursor-pointer"
                  >
                    <Shuffle size={14} className="text-amber-400" />
                    <span>Surprise Me</span>
                  </button>
                </div>
              </div>

              {/* Spotlight Thumbnail Card */}
              {spotlightGame.cover && (
                <div
                  onClick={() => handleSelectGame(spotlightGame)}
                  style={{ borderColor: "var(--theme-border-strong)" }}
                  className="w-32 h-32 sm:w-40 sm:h-40 rounded-2xl border overflow-hidden shadow-2xl shrink-0 cursor-pointer group-hover:scale-105 transition-transform duration-300 relative bg-black/60"
                >
                  <img
                    src={spotlightGame.cover}
                    alt={spotlightGame.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play size={24} className="fill-white text-white drop-shadow-md" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quick Genre Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar no-scrollbar select-none">
            {quickPillTags.map((pill) => {
              const isPillActive = selectedTag === pill.id;
              return (
                <button
                  key={pill.id}
                  onClick={() => handleTagChange(pill.id)}
                  style={{
                    backgroundColor: isPillActive
                      ? (pill.isHeart ? "rgba(244, 63, 94, 0.25)" : "var(--theme-accent)")
                      : "var(--theme-surface)",
                    borderColor: isPillActive
                      ? (pill.isHeart ? "rgba(244, 63, 94, 0.7)" : "var(--theme-border-strong)")
                      : "var(--theme-border-subtle)",
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-xs font-bold whitespace-nowrap transition-all duration-200 cursor-pointer shrink-0 shadow-sm active:scale-95 ${
                    isPillActive
                      ? (pill.isHeart ? "text-rose-300 ring-1 ring-rose-500/40" : "text-white ring-1 ring-white/20")
                      : "text-neutral-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {pill.isHeart && <Heart size={12} className={isPillActive ? "fill-rose-400 text-rose-400" : "text-rose-400"} />}
                  <span>{pill.label}</span>
                </button>
              );
            })}
          </div>

          {/* Catalog Grid View */}
          <section id="games-catalog-section" className="flex-1 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <h2 className="text-sm sm:text-base font-bold tracking-wider uppercase text-white flex items-center gap-2">
                  <span>Library ({processedGames.length.toLocaleString()})</span>
                </h2>
                {searchQuery && (
                  <span className="text-xs text-neutral-400 font-normal">
                    for &ldquo;{searchQuery}&rdquo;
                  </span>
                )}
              </div>
            </div>

            <GameGrid
              games={processedGames}
              onSelectGame={handleSelectGame}
              favoriteIds={favoriteIds}
              onToggleFavorite={toggleFavorite}
            />
          </section>
        </motion.div>

        {/* YouTube Browser & Player View */}
        <motion.div
          animate={{
            opacity: currentView === "youtube" ? 1 : 0,
            y: currentView === "youtube" ? 0 : 16,
            scale: currentView === "youtube" ? 1 : 0.99,
          }}
          initial={{ opacity: 0, y: 16, scale: 0.99 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          style={{
            pointerEvents: currentView === "youtube" ? "auto" : "none",
            transform: "translateZ(0)",
          }}
          className={`w-full flex-1 flex flex-col ${currentView === "youtube" ? "" : "absolute inset-x-0 top-0 invisible h-0 overflow-hidden"}`}
        >
          <YouTubeView
            isActive={currentView === "youtube"}
            onBackToHome={handleBackToHub}
            onActiveVideoChange={setActiveVideoTitle}
          />
        </motion.div>

        {/* Discord Chat View */}
        <motion.div 
          animate={{
            opacity: currentView === "chat" ? 1 : 0,
            y: currentView === "chat" ? 0 : 16,
            scale: currentView === "chat" ? 1 : 0.99,
          }}
          initial={{ opacity: 0, y: 16, scale: 0.99 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          style={{ 
            pointerEvents: currentView === "chat" ? "auto" : "none",
            transform: "translateZ(0)"
          }}
          className={`flex-1 w-full flex flex-col min-h-0 ${currentView === "chat" ? "" : "absolute inset-x-0 top-0 invisible h-0 overflow-hidden"}`}
        >
          <Chat
            isOpen={currentView === "chat"}
            onClose={handleBackToHub}
            onOpenVoiceChat={() => {
              setCurrentView("chat");
              setChatInitialTab("voice");
            }}
            initialTab={chatInitialTab}
            autoJoinVoice={autoJoinVoice}
            onVoiceSessionStarted={() => setAutoJoinVoice(false)}
            persistent
          />
        </motion.div>

        {/* AI Assistant View */}
        <motion.div
          animate={{
            opacity: currentView === "assistant" ? 1 : 0,
            y: currentView === "assistant" ? 0 : 16,
            scale: currentView === "assistant" ? 1 : 0.99,
          }}
          initial={{ opacity: 0, y: 16, scale: 0.99 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          style={{
            pointerEvents: currentView === "assistant" ? "auto" : "none",
            transform: "translateZ(0)",
          }}
          className={`flex-1 w-full flex flex-col min-h-0 ${currentView === "assistant" ? "" : "absolute inset-x-0 top-0 invisible h-0 overflow-hidden"}`}
        >
          <AIAssistant />
        </motion.div>
      </main>

      {/* Footer Branding Area (Home & YouTube view) */}
      {(currentView === "home" || currentView === "youtube") && (
        <footer id="app-footer" className="border-t border-[var(--theme-border-subtle)] bg-[var(--theme-darkest)]/90 px-4 py-6 md:px-8 text-center text-xs text-[var(--theme-text-muted)] backdrop-blur-md transition-colors duration-200">
          <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="font-medium text-neutral-300">
              Frosted Studying &bull; Fast, cozy, unblocked study library & games.
            </p>
            <div className="flex flex-wrap gap-4 font-semibold text-[var(--theme-text-accent)]">
              <a href="https://discord.gg/D4c9VFYWyU" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                Community
              </a>
              <span className="text-[var(--theme-border-subtle)]">|</span>
              <a href="https://github.com/gn-math" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                GN-Math
              </a>
            </div>
          </div>
        </footer>
      )}
  <BackgroundEditor
    background={background}
    onChange={setBackground}
    isOpen={isThemeOpen}
    onOpenChange={setIsThemeOpen}
  />
  <SettingsModal
    isOpen={isSettingsOpen}
    onClose={() => setIsSettingsOpen(false)}
    onOpenTheme={() => {
      setIsSettingsOpen(false);
      setIsThemeOpen(true);
    }}
  />

  {/* Real-time P2P Call Modals & In-App Top Right Notification */}
  <IncomingCallNotification />
  <ActiveCallModal />
  
  </div>
  </>
  );
}

export default function App() {
  return (
    <CallProvider>
      <AppContent />
    </CallProvider>
  );
}
