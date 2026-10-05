import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Game } from "../types";
import { formatGameUrl } from "../utils";
import { getLuminGameUrl } from "../lumin";
import {
  ArrowLeft,
  Maximize2,
  RefreshCw,
  Heart,
  Volume2
} from "lucide-react";
import { useFavorites } from "../lib/favorites";
import GameReactionsBar from "./GameReactionsBar";
import { sendBroadcastSignal } from "../lib/database";

interface GamePlayerProps {
  game: Game;
  onBack: () => void;
}

const SOUNDS = [
  { name: "MLG Airhorn", url: "https://www.myinstants.com/media/sounds/mlg-airhorn.mp3", emoji: "📣", color: "from-amber-500/10 to-orange-600/10 text-amber-300 border-amber-500/20" },
  { name: "Vine Boom", url: "https://www.myinstants.com/media/sounds/vine-boom.mp3", emoji: "💥", color: "from-red-500/10 to-rose-600/10 text-red-300 border-red-500/20" },
  { name: "Bruh Moment", url: "https://www.myinstants.com/media/sounds/bruh.mp3", emoji: "💀", color: "from-slate-600/10 to-slate-800/10 text-slate-300 border-slate-500/20" },
  { name: "Wet Fart", url: "https://www.myinstants.com/media/sounds/fart-meme-sound-effect_xd1ZVTX.mp3", emoji: "💨", color: "from-lime-600/10 to-green-700/10 text-lime-300 border-lime-500/20" },
  { name: "Sad Trombone", url: "https://www.myinstants.com/media/sounds/sad-trombone.mp3", emoji: "🎻", color: "from-blue-500/10 to-indigo-600/10 text-blue-300 border-blue-500/20" },
  { name: "Anime Wow", url: "https://www.myinstants.com/media/sounds/anime-wow.mp3", emoji: "✨", color: "from-pink-500/10 to-purple-600/10 text-pink-300 border-pink-500/20" },
  { name: "Laughter", url: "https://www.myinstants.com/media/sounds/skype-laughter.mp3", emoji: "😂", color: "from-yellow-400/10 to-amber-500/10 text-yellow-300 border-yellow-500/20" },
  { name: "Metal Pipe", url: "https://www.myinstants.com/media/sounds/metal-pipe-falling-sound-effect-meme_8fNbyZ4.mp3", emoji: "⚙️", color: "from-zinc-500/10 to-neutral-700/10 text-zinc-300 border-zinc-500/20" },
  { name: "Taco Bell", url: "https://www.myinstants.com/media/sounds/taco-bell-bong_q9D7v7X.mp3", emoji: "🔔", color: "from-violet-500/10 to-fuchsia-600/10 text-violet-300 border-violet-500/20" },
  { name: "Quack", url: "https://www.myinstants.com/media/sounds/duck-quack_SZvW2R1.mp3", emoji: "🦆", color: "from-emerald-500/10 to-teal-600/10 text-emerald-300 border-emerald-500/20" },
];

export default function GamePlayer({ game, onBack }: GamePlayerProps) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const favorited = isFavorite(game.id);
  const [gameUrl, setGameUrl] = useState<string>("");
  const [broadcastSoundboard, setBroadcastSoundboard] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("frosted_broadcast_soundboard");
      if (saved !== null) return saved === "true";
    } catch {}
    return true;
  });

  const toggleBroadcast = useCallback(() => {
    setBroadcastSoundboard((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("frosted_broadcast_soundboard", String(next));
      } catch {}
      return next;
    });
  }, []);

  const playAndBroadcastSound = (soundUrl: string) => {
    const audio = new Audio(soundUrl);
    audio.volume = 0.65;
    audio.play().catch(() => {});

    if (broadcastSoundboard) {
      try {
        sendBroadcastSignal({
          type: "soundboard_played",
          targetUid: "all",
          sdp: JSON.stringify({ soundUrl })
        });
      } catch (e) {
        console.warn("Soundboard broadcast error:", e);
      }
    }
  };

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isLuminGame = game.source === "luminsdk" || (typeof game.id === "string" && game.id.startsWith("lumin-")) || !!game.luminId;
  const isSoundboard = game.id === "soundboard" || (game.name && game.name.toLowerCase().includes("soundboard"));

  // Load and resolve game URL
  useEffect(() => {
    let isCancelled = false;

    async function loadGame() {
      if (isSoundboard) {
        const sbUrl = game.url || "https://soundboardguys.com/";
        if (!isCancelled) {
          setGameUrl(sbUrl);
        }
        return;
      }

      if (isLuminGame) {
        const luminId = game.luminId || (typeof game.id === "string" && game.id.startsWith("lumin-") ? game.id.slice("lumin-".length) : String(game.id));
        const url = await getLuminGameUrl(luminId);
        if (!isCancelled && url) {
          setGameUrl(url);
        }
        return;
      }

      if (game.url) {
        const url = formatGameUrl(game.url);
        if (!isCancelled) {
          setGameUrl(url);
        }
      }
    }

    loadGame();

    return () => {
      isCancelled = true;
    };
  }, [game, isLuminGame, isSoundboard]);

  const handleFullscreen = () => {
    const target = containerRef.current || iframeRef.current;
    if (target) {
      if (target.requestFullscreen) {
        target.requestFullscreen();
      } else if ((target as any).webkitRequestFullscreen) {
        (target as any).webkitRequestFullscreen();
      } else if ((target as any).mozRequestFullScreen) {
        (target as any).mozRequestFullScreen();
      } else if ((target as any).msRequestFullscreen) {
        (target as any).msRequestFullscreen();
      }
    }
  };

  const handleReload = () => {
    if (iframeRef.current && gameUrl) {
      iframeRef.current.src = gameUrl;
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0a0f1d] text-white">
      {/* Dynamic Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#0f172a] shadow-md shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-all cursor-pointer"
            title="Go Back"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-sm font-bold text-neutral-100">{game.name}</h1>
            <p className="text-[10px] text-neutral-400 font-mono tracking-wider uppercase">
              {isLuminGame ? "Selenite" : "HTML5 Web Game"}
            </p>
          </div>
        </div>

        {/* Center Reactions Bar */}
        <div className="hidden md:flex items-center">
          <GameReactionsBar gameId={game.id} gameName={game.name} />
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Favorite Action */}
          <button
            onClick={() => toggleFavorite(game.id)}
            className={`flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
              favorited
                ? "bg-rose-500/20 border-rose-500/40 text-rose-300 hover:bg-rose-500/30"
                : "bg-white/5 border-white/5 text-neutral-300 hover:bg-white/10"
            }`}
          >
            <Heart size={14} className={favorited ? "fill-rose-400 text-rose-400" : ""} />
            <span className="hidden sm:inline">{favorited ? "Favorited" : "Favorite"}</span>
          </button>

          {/* Reload Action */}
          <button
            onClick={handleReload}
            className="flex h-8 px-3 items-center justify-center gap-1.5 rounded-lg border border-white/5 bg-white/5 text-xs font-semibold text-neutral-200 hover:bg-white/10 transition-all cursor-pointer"
            title="Reload game"
          >
            <RefreshCw size={13} />
            <span className="hidden sm:inline">Reload</span>
          </button>

          {/* Fullscreen Action */}
          <button
            onClick={handleFullscreen}
            className="flex h-8 px-3 items-center justify-center gap-1.5 rounded-lg bg-[#3b82f6] hover:bg-[#2563eb] text-xs font-bold text-white shadow-sm transition-all cursor-pointer"
            title="Fullscreen"
          >
            <Maximize2 size={13} />
            <span className="hidden sm:inline">Fullscreen</span>
          </button>
        </div>
      </div>

      {/* Main Game Container */}
      <div
        ref={containerRef}
        className={`relative flex-1 w-full bg-black flex flex-col justify-center items-center overflow-hidden ${
          isSoundboard ? "p-4 overflow-y-auto" : ""
        }`}
      >
        {isSoundboard ? (
          <div className="max-w-4xl w-full flex flex-col gap-6 py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-white/5 border border-white/5 backdrop-blur-md">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Volume2 size={16} className="text-blue-400" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-200">
                    Voice lounge Soundboard
                  </h2>
                </div>
                <p className="text-xs text-neutral-400">
                  Play sounds locally and broadcast them instantly to everyone in your current channel!
                </p>
              </div>
              <button
                onClick={toggleBroadcast}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-2 cursor-pointer ${
                  broadcastSoundboard
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                    : "bg-neutral-800 text-neutral-400 border-white/5"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${broadcastSoundboard ? "bg-emerald-400 animate-pulse" : "bg-neutral-600"}`} />
                Broadcast to Call: {broadcastSoundboard ? "ON" : "OFF"}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {SOUNDS.map((sound) => (
                <button
                  key={sound.name}
                  onClick={() => playAndBroadcastSound(sound.url)}
                  className={`group relative flex flex-col items-center justify-center p-4 rounded-xl border bg-gradient-to-br ${sound.color} hover:bg-opacity-20 hover:scale-[1.03] active:scale-95 transition-all duration-150 cursor-pointer text-center select-none overflow-hidden`}
                >
                  <span className="text-2xl mb-1.5 filter drop-shadow group-hover:scale-110 transition-transform duration-200">{sound.emoji}</span>
                  <span className="text-xs font-bold tracking-wide">{sound.name}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          gameUrl && (
            <iframe
              id="embedFrame"
              ref={iframeRef}
              src={gameUrl}
              title={`${game.name} game`}
              width="100%"
              height="100%"
              className="w-full h-full border-0"
              style={{ border: "none" }}
              allow="autoplay; encrypted-media; fullscreen; microphone; camera; gamepad; pointer-lock"
              allowFullScreen
            />
          )
        )}
      </div>
    </div>
  );
}
