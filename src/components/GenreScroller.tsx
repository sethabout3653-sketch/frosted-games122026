import React, { useRef, useState, useEffect, memo } from "react";
import {
  Gamepad2,
  Heart,
  Flame,
  Sparkles,
  Zap,
  Car,
  Crosshair,
  Brain,
  Users,
  Trophy,
  Music,
  Ghost,
  Shield,
  Compass,
  ChevronLeft,
  ChevronRight,
  Layers,
} from "lucide-react";
import { Game } from "../types";

export interface GenreCategory {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

export const ALL_GENRES: GenreCategory[] = [
  { id: "all", label: "All Games", icon: Layers },
  { id: "favorites", label: "Favorites", icon: Heart },
  { id: "action", label: "Action", icon: Flame },
  { id: "retro", label: "Retro", icon: Sparkles },
  { id: "arcade", label: "Arcade", icon: Gamepad2 },
  { id: "platformer", label: "Platformer", icon: Zap },
  { id: "driving", label: "Driving", icon: Car },
  { id: "shooting", label: "Shooting", icon: Crosshair },
  { id: "puzzle", label: "Puzzle", icon: Brain },
  { id: "2-player", label: "2-Player", icon: Users },
  { id: "multiplayer", label: "Multiplayer", icon: Users },
  { id: "sports", label: "Sports", icon: Trophy },
  { id: "rhythm", label: "Rhythm & Music", icon: Music },
  { id: "horror", label: "Horror", icon: Ghost },
  { id: "strategy", label: "Strategy", icon: Shield },
  { id: "adventure", label: "Adventure", icon: Compass },
];

interface GenreScrollerProps {
  selectedTag: string;
  onSelectTag: (tag: string) => void;
  games: Game[];
  favoriteCount: number;
}

export const GenreScroller = memo(function GenreScroller({
  selectedTag,
  onSelectTag,
  games,
  favoriteCount,
}: GenreScrollerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  // Compute game counts for each genre dynamically
  const genreCounts = React.useMemo(() => {
    const counts: Record<string, number> = {
      all: games.length,
      favorites: favoriteCount,
    };

    games.forEach((game) => {
      if (Array.isArray(game.special)) {
        game.special.forEach((tag) => {
          const clean = tag.toLowerCase().trim();
          counts[clean] = (counts[clean] || 0) + 1;
        });
      }
    });

    return counts;
  }, [games, favoriteCount]);

  const updateScrollArrows = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setShowLeftArrow(scrollLeft > 10);
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
  };

  useEffect(() => {
    updateScrollArrows();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener("scroll", updateScrollArrows, { passive: true });
      window.addEventListener("resize", updateScrollArrows);
      return () => {
        el.removeEventListener("scroll", updateScrollArrows);
        window.removeEventListener("resize", updateScrollArrows);
      };
    }
  }, [games.length]);

  const handleScroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = direction === "left" ? -280 : 280;
    scrollRef.current.scrollBy({ left: amount, behavior: "smooth" });
  };

  return (
    <div className="relative w-full group select-none">
      {/* Left Scroll Arrow */}
      {showLeftArrow && (
        <button
          onClick={() => handleScroll("left")}
          style={{
            backgroundColor: "var(--theme-surface)",
            borderColor: "var(--theme-border-strong)",
          }}
          className="absolute -left-1.5 top-1/2 -translate-y-1/2 z-20 flex h-8 w-8 items-center justify-center rounded-xl border text-neutral-300 hover:text-white shadow-xl hover:scale-105 transition-all cursor-pointer backdrop-blur-md"
          title="Scroll Left"
          aria-label="Scroll genres left"
        >
          <ChevronLeft size={16} />
        </button>
      )}

      {/* Genres Horizontal Scroller */}
      <div
        ref={scrollRef}
        className="flex items-center gap-2 overflow-x-auto px-1 py-1 no-scrollbar scroll-smooth"
      >
        {ALL_GENRES.map((cat) => {
          const isSelected = selectedTag === cat.id;
          const Icon = cat.icon;
          const count = genreCounts[cat.id] ?? 0;

          return (
            <button
              key={cat.id}
              onClick={() => onSelectTag(cat.id)}
              style={{
                backgroundColor: isSelected
                  ? "var(--theme-surface)"
                  : "var(--theme-darkest)",
                borderColor: isSelected
                  ? "var(--theme-border-strong)"
                  : "var(--theme-border-subtle)",
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border shrink-0 transition-all duration-150 cursor-pointer ${
                isSelected
                  ? "text-white shadow-sm font-bold scale-[1.02] border-[var(--theme-border-strong)]"
                  : "text-neutral-400 hover:text-neutral-200 hover:border-[var(--theme-border)] hover:bg-white/5"
              }`}
            >
              <Icon
                size={14}
                className={
                  isSelected
                    ? cat.id === "favorites"
                      ? "text-rose-400 fill-rose-400"
                      : "text-[var(--theme-text-accent)]"
                    : cat.id === "favorites"
                    ? "text-rose-400/70"
                    : "text-neutral-500"
                }
              />
              <span className="whitespace-nowrap">{cat.label}</span>

              {count > 0 && (
                <span
                  style={{
                    backgroundColor: isSelected
                      ? "var(--theme-accent)"
                      : "rgba(255, 255, 255, 0.06)",
                    borderColor: isSelected
                      ? "var(--theme-border-strong)"
                      : "var(--theme-border-subtle)",
                  }}
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md border ${
                    isSelected
                      ? "text-white font-bold"
                      : "text-neutral-400 font-medium"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Right Scroll Arrow */}
      {showRightArrow && (
        <button
          onClick={() => handleScroll("right")}
          style={{
            backgroundColor: "var(--theme-surface)",
            borderColor: "var(--theme-border-strong)",
          }}
          className="absolute -right-1.5 top-1/2 -translate-y-1/2 z-20 flex h-8 w-8 items-center justify-center rounded-xl border text-neutral-300 hover:text-white shadow-xl hover:scale-105 transition-all cursor-pointer backdrop-blur-md"
          title="Scroll Right"
          aria-label="Scroll genres right"
        >
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
});

export default GenreScroller;
