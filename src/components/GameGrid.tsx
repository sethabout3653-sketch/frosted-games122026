import React, { useState, useEffect, useRef, useMemo, memo } from "react";
import { Game } from "../types";
import GameCard from "./GameCard";
import { Gamepad2, ArrowRight } from "lucide-react";
import { motion } from "motion/react";

interface GameGridProps {
  games: Game[];
  onSelectGame: (game: Game) => void;
  favoriteIds?: Set<string>;
  onToggleFavorite?: (id: number | string) => void;
}

const ITEMS_PER_PAGE = 36;

const GameGrid = memo(function GameGrid({
  games,
  onSelectGame,
  favoriteIds,
  onToggleFavorite,
}: GameGridProps) {
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [games]);

  useEffect(() => {
    const target = sentinelRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => {
            if (prev < games.length) {
              return Math.min(prev + ITEMS_PER_PAGE, games.length);
            }
            return prev;
          });
        }
      },
      { rootMargin: "300px" }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [games.length]);

  const visibleGames = useMemo(
    () => games.slice(0, visibleCount),
    [games, visibleCount]
  );
  const hasMore = visibleCount < games.length;

  const handleLoadMore = () => {
    setVisibleCount((prev) => Math.min(prev + ITEMS_PER_PAGE, games.length));
  };

  if (games.length === 0) {
    return (
      <div
        id="grid-empty-state"
        style={{
          backgroundColor: "var(--theme-surface)",
          borderColor: "var(--theme-border-subtle)",
        }}
        className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-3xl border shadow-xl max-w-md mx-auto my-8 animate-fadeIn"
      >
        <div
          style={{
            backgroundColor: "var(--theme-accent)",
            borderColor: "var(--theme-border)",
          }}
          className="flex h-16 w-16 items-center justify-center rounded-2xl border text-neutral-300 mb-4 shadow-lg"
        >
          <Gamepad2 size={30} className="text-[var(--theme-text-accent)]" />
        </div>
        <h3 className="text-base font-bold text-white tracking-tight">No Games Found</h3>
        <p className="mt-1.5 text-xs text-neutral-400 max-w-xs leading-relaxed font-normal">
          Try clearing your search query or choosing a different genre filter.
        </p>
      </div>
    );
  }

  return (
    <div id="game-grid-container" className="flex flex-col gap-6">
      {/* High-Performance Dynamic Grid Layout */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
        {visibleGames.map((game) => (
          <div key={game.id} className="w-full h-full">
            <GameCard
              game={game}
              onSelect={onSelectGame}
              isFavorited={favoriteIds ? favoriteIds.has(String(game.id)) : undefined}
              onToggleFavorite={onToggleFavorite}
            />
          </div>
        ))}
      </div>

      {/* Sentinel for IntersectionObserver */}
      {hasMore && <div ref={sentinelRef} className="h-6 w-full pointer-events-none opacity-0" />}

      {/* Load More Button */}
      {hasMore && (
        <div className="flex justify-center pt-2 pb-6">
          <button
            id="load-more-btn"
            onClick={handleLoadMore}
            style={{
              backgroundColor: "var(--theme-surface)",
              borderColor: "var(--theme-border)",
            }}
            className="flex items-center gap-2 rounded-2xl px-6 py-3 border text-white font-bold text-xs transition-all duration-200 cursor-pointer shadow-lg hover:border-[var(--theme-border-strong)] hover:bg-white/5 active:scale-95"
          >
            <span>Load More ({games.length - visibleCount} remaining)</span>
            <ArrowRight size={14} className="text-[var(--theme-text-accent)]" />
          </button>
        </div>
      )}
    </div>
  );
});

export default GameGrid;
