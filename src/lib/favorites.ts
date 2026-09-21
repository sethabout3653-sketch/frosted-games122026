import { useState, useEffect, useCallback } from "react";

const FAVORITES_STORAGE_KEY = "frosted_favorite_games";
const FAVORITES_CHANGE_EVENT = "frosted_favorites_changed";

/**
 * Get all favorite game IDs from localStorage.
 */
export function getFavoriteGameIds(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((id) => String(id));
    }
  } catch (e) {
    console.warn("Failed to load favorite games from storage:", e);
  }
  return [];
}

/**
 * Check if a specific game is in favorites.
 */
export function isGameFavorite(gameId: number | string): boolean {
  const ids = getFavoriteGameIds();
  return ids.includes(String(gameId));
}

/**
 * Toggle favorite status of a game. Dispatches a cross-component event.
 */
export function toggleFavoriteGame(gameId: number | string): boolean {
  const targetId = String(gameId);
  const current = getFavoriteGameIds();
  const index = current.indexOf(targetId);
  let updated: string[];
  let isNowFavorite: boolean;

  if (index >= 0) {
    updated = current.filter((id) => id !== targetId);
    isNowFavorite = false;
  } else {
    updated = [targetId, ...current];
    isNowFavorite = true;
  }

  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn("Failed to save favorites to localStorage:", e);
  }

  // Notify all components in the current window
  window.dispatchEvent(new CustomEvent(FAVORITES_CHANGE_EVENT, { detail: { gameId: targetId, isFavorite: isNowFavorite } }));
  return isNowFavorite;
}

/**
 * React hook for real-time reactive favorites management.
 */
export function useFavorites() {
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set(getFavoriteGameIds()));

  useEffect(() => {
    const handleUpdate = () => {
      setFavoriteIds(new Set(getFavoriteGameIds()));
    };

    window.addEventListener(FAVORITES_CHANGE_EVENT, handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      window.removeEventListener(FAVORITES_CHANGE_EVENT, handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const isFavorite = useCallback(
    (gameId: number | string) => {
      return favoriteIds.has(String(gameId));
    },
    [favoriteIds]
  );

  const toggle = useCallback((gameId: number | string) => {
    return toggleFavoriteGame(gameId);
  }, []);

  return {
    favoriteIds,
    isFavorite,
    toggleFavorite: toggle,
    count: favoriteIds.size,
  };
}
