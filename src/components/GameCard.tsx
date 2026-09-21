import React, { memo } from "react";
import { Game } from "../types";
import { formatTagLabel, isFnfGame, isFnfMod } from "../utils";
import GameCover from "./GameCover";
import { Heart } from "lucide-react";
import { useFavorites } from "../lib/favorites";
import { useGameReactions } from "../lib/game-reactions";

interface GameCardProps {
  game: Game;
  onSelect: (game: Game) => void;
}

const GameCard = memo(function GameCard({
  game,
  onSelect,
}: GameCardProps) {
  // Filter out suggestions or non-playable elements
  if (game.id === -1) return null;

  const { isFavorite, toggleFavorite } = useFavorites();
  const { reactions } = useGameReactions(game.id);
  const favorited = isFavorite(game.id);

  const isMod = game.isMod ?? isFnfMod(game.name, game.special);
  const isFnf = isFnfGame(game.name, game.special);

  // Calculate top reaction if any
  const topReaction = React.useMemo(() => {
    const entries = Object.entries(reactions).filter(([_, users]) => users.length > 0);
    if (entries.length === 0) return null;
    entries.sort((a, b) => b[1].length - a[1].length);
    return { key: entries[0][0], count: entries[0][1].length };
  }, [reactions]);

  // Avoid duplicating FNF or FNF-mod in secondary tags since the primary badge handles it
  const rawTags = game.special
    ? game.special.filter((t) => {
        const clean = t.toLowerCase();
        if (clean === "luminsdk" || clean === "fnf" || clean === "fnf-mod") return false;
        return true;
      })
    : [];

  const tagsToShow = rawTags.slice(0, 2);

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    toggleFavorite(game.id);
  };

  return (
    <div
      id={`game-card-${game.id}`}
      onClick={() => onSelect(game)}
      className="game-card-item group relative cursor-pointer overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] p-2 text-left shadow-lg transition-all duration-200 ease-out hover:-translate-y-1.5 hover:border-white/15 hover:bg-white/[0.06] hover:shadow-xl hover:shadow-[var(--theme-glow)]/10 active:scale-[0.98]"
    >
      {/* Cover Image Container */}
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-neutral-950">
        <GameCover name={game.name} cover={game.cover} />

        {/* Favorite Heart Button */}
        <button
          id={`fav-btn-${game.id}`}
          type="button"
          onClick={handleFavoriteClick}
          className={`absolute top-2 right-2 z-20 flex h-7 w-7 items-center justify-center rounded-full backdrop-blur-md transition-all duration-150 cursor-pointer shadow-md ${
            favorited
              ? "bg-rose-500/90 text-white shadow-rose-500/30 scale-100 ring-2 ring-white/30"
              : "bg-black/60 text-white/70 hover:bg-black/85 hover:text-white hover:scale-110 opacity-0 group-hover:opacity-100 focus:opacity-100"
          }`}
          title={favorited ? "Remove from Favorites" : "Add to Favorites"}
          aria-label={favorited ? "Remove from Favorites" : "Add to Favorites"}
        >
          <Heart
            size={13}
            className={`transition-transform duration-200 ${
              favorited ? "fill-white text-white scale-110" : ""
            }`}
          />
        </button>

        {/* Top Reaction Badge if any */}
        {topReaction && (
          <div className="absolute top-2 left-2 z-10 flex items-center gap-1 rounded-md bg-black/80 backdrop-blur-sm px-1.5 py-0.5 text-[9px] font-bold text-white border border-white/10 shadow-sm">
            <span>{topReaction.key}</span>
            <span className="text-[8px] text-neutral-300 font-mono">{topReaction.count}</span>
          </div>
        )}

        {/* Tags Overlay */}
        <div className="absolute bottom-2 left-2 z-10 flex flex-wrap gap-1">
          {isMod ? (
            <span className="rounded-md bg-[var(--theme-indigo-500)] text-white px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider shadow-sm">
              FNF Mod
            </span>
          ) : isFnf ? (
            <span className="rounded-md bg-black/85 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider text-[var(--theme-indigo-200)] border border-white/10">
              FNF
            </span>
          ) : null}

          {tagsToShow.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-black/75 px-1.5 py-0.5 text-[8px] font-bold text-neutral-200 uppercase tracking-wider border border-white/5"
            >
              {formatTagLabel(tag)}
            </span>
          ))}
        </div>
      </div>

      {/* Meta Text */}
      <div className="mt-2.5 px-1 pb-1">
        <h3 className="truncate text-xs font-bold tracking-wide text-neutral-200 group-hover:text-white transition-colors">
          {game.name}
        </h3>
        {game.author ? (
          <p className="mt-0.5 truncate text-[10px] text-neutral-400 font-medium">
            {game.author}
          </p>
        ) : (
          <p className="mt-0.5 truncate text-[10px] text-neutral-500 font-medium">
            {isMod ? "FNF Mod" : isFnf ? "FNF" : tagsToShow.length > 0 ? formatTagLabel(tagsToShow[0]) : "Web"}
          </p>
        )}
      </div>
    </div>
  );
});

export default GameCard;
