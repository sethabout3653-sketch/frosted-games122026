import React, { useEffect, useState } from "react";
import { fetchGmshelfGames } from "../gmshelf";
import { Game } from "../types";
import { Play, Sparkles } from "lucide-react";

interface GmshelfGamesProps {
  className?: string;
  onSelectGame?: (game: Game) => void;
}

/**
 * Idiomatic React component showcasing games from gmshelf (ugs)
 */
export const GmshelfGames: React.FC<GmshelfGamesProps> = ({
  className = "",
  onSelectGame,
}) => {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    fetchGmshelfGames().then((list) => {
      if (mounted) {
        setGames(list.slice(0, 36));
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className={`gmshelf-wrapper w-full ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-400" />
          <h2 className="text-base font-semibold text-white tracking-wide">
            gmshelf Games (UGS)
          </h2>
        </div>
        <span className="text-xs text-white/50">{games.length} games available</span>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[4/3] rounded-xl bg-white/5 animate-pulse border border-white/10"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {games.map((g) => (
            <button
              key={g.id}
              onClick={() => onSelectGame?.(g)}
              className="group relative flex flex-col items-center justify-center aspect-[4/3] rounded-xl overflow-hidden bg-white/5 border border-white/10 hover:border-blue-500/50 hover:bg-white/10 transition-all text-left p-2"
            >
              <img
                src={g.cover}
                alt={g.name}
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              <div className="relative z-10 mt-auto w-full">
                <p className="text-xs font-semibold text-white truncate drop-shadow">
                  {g.name}
                </p>
                <p className="text-[10px] text-white/70">gmshelf / ugs</p>
              </div>
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-blue-600/90 text-white rounded-full p-1.5 shadow-lg">
                <Play className="w-3.5 h-3.5 fill-current" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default GmshelfGames;
