import React, { memo } from "react";
import { Game } from "../types";
import { formatTagLabel, isFnfGame, isFnfMod } from "../utils";
import GameCover from "./GameCover";
import { Heart, Play } from "lucide-react";
import { toggleFavoriteGame } from "../lib/favorites";
import { getGameReactions } from "../lib/game-reactions";

interface GameCardProps {
  game: Game;
  onSelect: (game: Game) => void;
  isFavorited?: boolean;
  onToggleFavorite?: (id: number | string) => void;
}

const GameCard = memo(function GameCard({
  game,
  onSelect,
  isFavorited = false,
  onToggleFavorite,
}: GameCardProps) {
  if (game.id === -1) return null;

  const isMod = game.isMod ?? isFnfMod(game.name, game.special);
  const isFnf = isFnfGame(game.name, game.special);

  const topReaction = React.useMemo(() => {
    const reactions = getGameReactions(game.id);
    const entries = Object.entries(reactions).filter(([_, users]) => users.length > 0);
    if (entries.length === 0) return null;
    entries.sort((a, b) => b[1].length - a[1].length);
    return { key: entries[0][0], count: entries[0][1].length };
  }, [game.id]);

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
    if (onToggleFavorite) {
      onToggleFavorite(game.id);
    } else {
      toggleFavoriteGame(game.id);
    }
  };

  return (
    <div
      id={`game-card-${game.id}`}
      onClick={() => onSelect(game)}
      style={{
        backgroundColor: "var(--theme-surface)",
        borderColor: "var(--theme-border-subtle)",
      }}
      className="game-card-item group relative cursor-pointer overflow-hidden rounded-2xl border p-2 text-left shadow-md transition-all duration-200 ease-out hover:-translate-y-1 hover:border-[var(--theme-border-strong)] hover:shadow-xl active:scale-[0.98]"
    >
      {/* Cover Image Container */}
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-neutral-950">
        <div className="w-full h-full transition-transform duration-300 ease-out group-hover:scale-105">
          <GameCover name={game.name} cover={game.cover} />
        </div>

        {/* Hover Play Icon Overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center justify-center pointer-events-none">
          <div
            style={{
              backgroundColor: "var(--theme-accent)",
              borderColor: "var(--theme-border-strong)",
            }}
            className="w-10 h-10 rounded-full border shadow-xl flex items-center justify-center text-white scale-75 group-hover:scale-100 transition-transform duration-150"
          >
            <Play size={16} className="fill-white translate-x-0.5" />
          </div>
        </div>

        {/* Favorite Heart Button */}
        <button
          id={`fav-btn-${game.id}`}
          type="button"
          onClick={handleFavoriteClick}
          className={`absolute top-2 right-2 z-20 flex h-7.5 w-7.5 items-center justify-center rounded-full transition-all duration-150 cursor-pointer shadow-lg ${
            isFavorited
              ? "bg-rose-500 text-white shadow-rose-500/40 scale-100 ring-2 ring-white/40"
              : "bg-black/75 text-white/80 hover:bg-black hover:text-white hover:scale-110 opacity-0 group-hover:opacity-100 focus:opacity-100"
          }`}
          title={isFavorited ? "Remove from Favorites" : "Add to Favorites"}
          aria-label={isFavorited ? "Remove from Favorites" : "Add to Favorites"}
        >
          <Heart
            size={13}
            className={`transition-transform duration-150 ${
              isFavorited ? "fill-white text-white scale-110" : ""
            }`}
          />
        </button>

        {/* Top Reaction Badge if any */}
        {topReaction && (
          <div className="absolute top-2 left-2 z-10 flex items-center gap-1 rounded-lg bg-black/85 px-1.5 py-0.5 text-[9px] font-bold text-white border border-white/10 shadow-md">
            <span>{topReaction.key}</span>
            <span className="text-[8px] text-neutral-300 font-mono">{topReaction.count}</span>
          </div>
        )}

        {/* Tags Overlay */}
        <div className="absolute bottom-2 left-2 right-2 z-10 flex flex-wrap gap-1">
          {isMod ? (
            <span className="rounded-md bg-indigo-600/95 text-white px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider shadow-sm border border-indigo-400/40">
              FNF Mod
            </span>
          ) : isFnf ? (
            <span className="rounded-md bg-black/90 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider text-indigo-200 border border-white/10">
              FNF
            </span>
          ) : null}

          {tagsToShow.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-black/85 px-1.5 py-0.5 text-[8px] font-bold text-neutral-200 uppercase tracking-wider border border-white/10"
            >
              {formatTagLabel(tag)}
            </span>
          ))}
        </div>
      </div>

      {/* Meta Text */}
      <div className="mt-2.5 px-1 pb-1">
        <h3 className="truncate text-xs font-bold tracking-tight text-neutral-100 group-hover:text-[var(--theme-text-accent)] transition-colors">
          {game.name}
        </h3>
        <p className="mt-0.5 truncate text-[10px] text-neutral-400 font-medium">
          {game.author || (isMod ? "FNF Community Mod" : isFnf ? "Friday Night Funkin" : tagsToShow.length > 0 ? formatTagLabel(tagsToShow[0]) : "Arcade")}
        </p>
      </div>
    </div>
  );
});

export default GameCard;
