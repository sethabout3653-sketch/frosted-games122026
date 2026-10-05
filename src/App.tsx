import React, { useState, useEffect, useMemo, useCallback, useDeferredValue } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Game, ChatProfile } from "./types";
import { fetchGamesList, getUniqueTags, isFnfGame, isFnfMod, deduplicateGames, inferGameGenres } from "./utils";
import { fetchLuminGames } from "./lumin";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import GenreScroller from "./components/GenreScroller";
import GameGrid from "./components/GameGrid";
import GamePlayer from "./components/GamePlayer";
import Chat from "./components/Chat";
import AIAssistant from "./components/AIAssistant";
import MusicView from "./components/MusicView";
import MusicDock from "./components/MusicDock";
import GlobalAnnouncements from "./components/GlobalAnnouncements";
import BackgroundEditor, { DEFAULT_BACKGROUND, AppBackground } from "./components/BackgroundEditor";
import SettingsModal from "./components/SettingsModal";
import LoadingScreen from "./components/LoadingScreen";
import { applyTabCloak, getSavedTabCloak } from "./tabCloaks";
import { useActivityTracker, getSavedProfile } from "./lib/activity-tracker";
import { applyTheme, getSavedTheme } from "./utils/theme";
import localZones from "./zones.json";
import { CallProvider, useCall } from "./context/CallContext";
import { MusicProvider } from "./context/MusicContext";
import IncomingCallNotification from "./components/IncomingCallNotification";
import ActiveCallModal from "./components/ActiveCallModal";
import { useFavorites } from "./lib/favorites";
import { purgeNonAllowedUsers } from "./lib/user-filter";
import { X } from "lucide-react";

const SOUNDBOARD_GAME: Game = {
  id: "soundboard",
  name: "Soundboard",
  cover: "https://play-lh.googleusercontent.com/LuIUTwJtvkVrSjIqp6ExcLF7pQKqTBeq91AioYogo0TtVnRWyTXh2xmXASI8MBWohVfCGFYjuiyekWzzXAciqp0=s0-br30",
  url: "https://soundboardguys.com/",
  author: "Soundboard Guys",
  source: "catalog",
  special: ["all genres", "soundboard", "rhythm"],
};

function prepareGame(g: Game, defaultSource: "catalog" | "luminsdk" = "catalog"): Game {
  const isFnf = isFnfGame(g.name, g.special);
  const isMod = isFnf && isFnfMod(g.name, g.special);

  // Infer all accurate primary and secondary genres
  const inferredGenres = inferGameGenres(g.name, g.special);

  let sTags = g.special
    ? [
        ...g.special.filter((t) => {
          const clean = t.toLowerCase();
          return clean !== "luminsdk" && clean !== "fnf" && clean !== "fnf-mod";
        }),
      ]
    : [];

  // Merge inferred genres without duplicates
  inferredGenres.forEach((gen) => {
    if (!sTags.includes(gen)) {
      sTags.push(gen);
    }
  });

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
  const [currentView, setCurrentView] = useState<"home" | "game" | "chat" | "assistant" | "music">("home");
  const [chatInitialTab, setChatInitialTab] = useState<"chat" | "voice" | "profile">("chat");
  const [autoJoinVoice, setAutoJoinVoice] = useState(false);
  const [activeVideoTitle, setActiveVideoTitle] = useState<string | null>(null);
  const [profile, setProfile] = useState<ChatProfile | null>(getSavedProfile);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { setOnOpenGroupVoice } = useCall();

  const handleVoiceSessionStarted = useCallback(() => {
    setAutoJoinVoice(false);
  }, []);

  const handleOpenVoiceChat = useCallback(() => {
    setCurrentView("chat");
    setChatInitialTab("voice");
  }, []);

  useEffect(() => {
    setOnOpenGroupVoice(() => {
      setCurrentView("chat");
      setChatInitialTab("voice");
      setAutoJoinVoice(true);
    });
  }, [setOnOpenGroupVoice]);

  useEffect(() => {
    const handleProfileUpdate = (e: any) => {
      if (e.detail) setProfile(e.detail);
    };
    window.addEventListener("frosted_profile_updated", handleProfileUpdate);
    return () => window.removeEventListener("frosted_profile_updated", handleProfileUpdate);
  }, []);

  const [showStartup, setShowStartup] = useState(true);
  const [games, setGames] = useState<Game[]>(() => {
    const catalogPrepared = (localZones as Game[])
      .filter((g) => g.id !== -1 && g.name !== "-3" && g.id !== 816)
      .map((g) => prepareGame(g, "catalog"))
      .sort((a, b) => (a?.name || "").localeCompare(b?.name || ""));
    return [SOUNDBOARD_GAME, ...catalogPrepared];
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

  const handleNavigate = useCallback((view: "home" | "chat" | "assistant" | "music") => {
    if (view === "home" && selectedGame) {
      setSelectedGame(null);
    }
    setCurrentView(view);
    setIsMobileSidebarOpen(false);
  }, [selectedGame]);

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

  return (
    <>
      <AnimatePresence mode="wait">
        {showStartup && (
          <LoadingScreen onComplete={() => setShowStartup(false)} />
        )}
      </AnimatePresence>

      <div
        id="app-root"
        className={`h-screen w-screen overflow-hidden ${
          showStartup ? "pointer-events-none select-none" : ""
        } text-white antialiased font-sans flex flex-row selection:bg-white/20 selection:text-white`}
        style={{
          background:
            background.type === "image"
              ? `url(${background.value}) center / cover fixed`
              : background.value,
        }}
      >
        {/* Desktop Left Sidebar Rail */}
        <div className="hidden md:flex h-full shrink-0">
          <Sidebar
            currentView={currentView}
            onNavigate={handleNavigate}
            selectedTag={selectedTag}
            onSelectTag={handleTagChange}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenTheme={() => setIsThemeOpen(true)}
            profile={profile}
            collapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
          />
        </div>

        {/* Mobile Slide-Over Sidebar Drawer */}
        <AnimatePresence>
          {isMobileSidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMobileSidebarOpen(false)}
                className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 md:hidden"
              />
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="fixed inset-y-0 left-0 w-64 z-50 md:hidden shadow-2xl flex flex-col"
              >
                <div className="absolute top-3 right-3 z-50">
                  <button
                    onClick={() => setIsMobileSidebarOpen(false)}
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-white bg-black/40 border border-white/10"
                  >
                    <X size={16} />
                  </button>
                </div>
                <Sidebar
                  currentView={currentView}
                  onNavigate={handleNavigate}
                  selectedTag={selectedTag}
                  onSelectTag={handleTagChange}
                  onOpenSettings={() => {
                    setIsMobileSidebarOpen(false);
                    setIsSettingsOpen(true);
                  }}
                  onOpenTheme={() => {
                    setIsMobileSidebarOpen(false);
                    setIsThemeOpen(true);
                  }}
                  profile={profile}
                  collapsed={false}
                />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Central Main Viewport */}
        <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
          {/* Top Command & Search Bar */}
          <TopBar
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            selectedTag={selectedTag}
            onSelectTag={handleTagChange}
            tags={tags}
            totalGamesCount={games.length}
            onRandomGame={handleRandomGame}
            onToggleMobileSidebar={() => setIsMobileSidebarOpen((prev) => !prev)}
          />

          {/* Viewport Content Area */}
          <main
            className={`flex-1 w-full flex flex-col relative ${
              isSoundboardActive || currentView === "home" ? "overflow-y-auto" : "overflow-hidden"
            } custom-scrollbar`}
          >
            {/* 1. Game Player View */}
            <div
              className={`flex-1 w-full flex flex-col ${
                currentView === "game" && selectedGame
                  ? "flex"
                  : "hidden"
              }`}
            >
              {selectedGame && <GamePlayer game={selectedGame} onBack={handleBackToHub} />}
            </div>

            {/* 2. Catalog Grid View */}
            <div
              className={`w-full max-w-7xl mx-auto px-3 sm:px-6 py-4 flex-1 flex flex-col gap-4 ${
                currentView === "home"
                  ? "flex"
                  : "hidden"
              }`}
            >
              {/* Top Dedicated Genre Scroller */}
              <GenreScroller
                selectedTag={selectedTag}
                onSelectTag={handleTagChange}
                games={games}
                favoriteCount={favoriteIds.size}
              />

              <section id="games-catalog-section" className="flex-1 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xs sm:text-sm font-bold tracking-wider uppercase text-neutral-300">
                      <span>Library ({processedGames.length.toLocaleString()})</span>
                    </h2>
                    {searchQuery && (
                      <span className="text-xs text-neutral-400 font-normal">
                        matching &ldquo;{searchQuery}&rdquo;
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

              {/* Clean Minimalist Footer */}
              <footer className="mt-8 pt-4 pb-6 border-t border-[var(--theme-border-subtle)] text-center text-xs text-neutral-500">
                <p>Frosted &bull; Unblocked Library & Social Rooms</p>
              </footer>
            </div>

            {/* 3. Chat & Friends View */}
            <div
              className={`flex-1 w-full flex flex-col min-h-0 ${
                currentView === "chat"
                  ? "flex"
                  : "hidden"
              }`}
            >
              <Chat
                isOpen={currentView === "chat"}
                onClose={handleBackToHub}
                onOpenVoiceChat={handleOpenVoiceChat}
                initialTab={chatInitialTab}
                autoJoinVoice={autoJoinVoice}
                onVoiceSessionStarted={handleVoiceSessionStarted}
                persistent
              />
            </div>

            {/* 4. AI Study Assistant View */}
            <div
              className={`flex-1 w-full flex flex-col min-h-0 ${
                currentView === "assistant"
                  ? "flex"
                  : "hidden"
              }`}
            >
              <AIAssistant />
            </div>

            {/* 5. Music Lounge View */}
            <div
              className={`flex-1 w-full flex flex-col min-h-0 ${
                currentView === "music"
                  ? "flex"
                  : "hidden"
              }`}
            >
              <MusicView isActive={currentView === "music"} />
            </div>
          </main>
        </div>

        {/* Global Modals & Notifications */}
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

        <IncomingCallNotification />
        <ActiveCallModal />
        <GlobalAnnouncements />
        <MusicDock onExpand={() => handleNavigate("music")} />
      </div>
    </>
  );
}

export default function App() {
  return (
    <CallProvider>
      <MusicProvider>
        <AppContent />
      </MusicProvider>
    </CallProvider>
  );
}
