import { Game } from "../types";
import { BUILTIN_LUMIN_CATALOG } from "./luminCatalog";

export interface LuminRawGame {
  id: string;
  name: string;
  image_token: string;
  category?: string;
}

export interface LuminGetGamesResult {
  games: LuminRawGame[];
  total: number;
  pages: number;
}

declare global {
  interface Window {
    Lumin?: {
      init: (options: {
        headless?: boolean;
        container?: string | HTMLElement;
        theme?: string;
        onReady?: () => void;
        onGameStart?: (game: { id: string; name: string }) => void;
        onGameEnd?: () => void;
        onError?: (err: Error) => void;
        [key: string]: any;
      }) => Promise<any>;
      getGames: (opts?: { page?: number; limit?: number }) => Promise<LuminGetGamesResult>;
      getRandomGames?: (count?: number) => Promise<{ games: LuminRawGame[] }>;
      search?: (query: string) => Promise<{ games: LuminRawGame[] }>;
      getCategories?: () => Promise<string[]>;
      getGameUrl: (gameId: string) => Promise<{ url: string; meta?: any } | string>;
      getImageUrl: (imageToken: string) => Promise<string>;
      loadGame: (gameId: string) => Promise<void>;
      endGame?: () => void;
      closeGame?: () => void;
      destroy?: () => void;
      on?: (event: string, callback: (...args: any[]) => void) => void;
      off?: (event: string, callback: (...args: any[]) => void) => void;
    };
  }
}

let scriptLoadPromise: Promise<boolean> | null = null;
let initPromise: Promise<boolean> | null = null;
const imageTokenCache = new Map<string, string>();

/**
 * Loads the Lumin SDK script from CDN if not already in window
 */
export async function loadLuminScript(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (window.Lumin) return true;
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise<boolean>((resolve) => {
    const existing = document.querySelector('script[src*="luminsdk"], script[src*="lumin.min.js"]');
    if (existing) {
      if (window.Lumin) return resolve(true);
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      setTimeout(() => resolve(!!window.Lumin), 2000);
      return;
    }

    const cdnUrls = [
      "https://cdn.jsdelivr.net/gh/luminsdk/script@latest/lumin.min.js",
      "https://a.luminsdk.com/sdk/lumin.min.js",
      "https://unpkg.com/luminsdk/lumin.min.js"
    ];

    let attempted = 0;
    const tryNext = () => {
      if (window.Lumin) return resolve(true);
      if (attempted >= cdnUrls.length) {
        return resolve(!!window.Lumin);
      }
      const url = cdnUrls[attempted++];
      const script = document.createElement("script");
      script.src = url;
      script.async = true;
      script.onload = () => {
        if (window.Lumin) resolve(true);
        else setTimeout(() => resolve(!!window.Lumin), 1000);
      };
      script.onerror = () => {
        tryNext();
      };
      document.head.appendChild(script);
    };

    tryNext();
    setTimeout(() => resolve(!!window.Lumin), 4000);
  });

  return scriptLoadPromise;
}

/**
 * Initializes Lumin in headless mode:
 * await Lumin.init({ headless: true });
 */
export async function initLuminHeadless(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const loaded = await loadLuminScript();
    if (!loaded || !window.Lumin || typeof window.Lumin.init !== "function") {
      return false;
    }

    try {
      await window.Lumin.init({ headless: true });
      return true;
    } catch (err) {
      console.warn("[Lumin SDK] Init warning:", err);
      return false;
    }
  })();

  return initPromise;
}

/**
 * Resolves an image token to a direct playable / blob / CDN URL with in-memory caching
 */
export async function getLuminImageUrl(imageToken: string): Promise<string> {
  if (!imageToken) return "";
  if (imageTokenCache.has(imageToken)) {
    return imageTokenCache.get(imageToken)!;
  }

  try {
    const ready = await initLuminHeadless();
    if (ready && window.Lumin && typeof window.Lumin.getImageUrl === "function") {
      const url = await window.Lumin.getImageUrl(imageToken);
      if (url) {
        imageTokenCache.set(imageToken, url);
        return url;
      }
    }
  } catch (err) {
    console.warn("[Lumin SDK] Image url resolve note:", err);
  }

  // Fallback direct URL if token is already http or formatted
  if (imageToken.startsWith("http")) return imageToken;
  return `https://a.luminsdk.com/api/v1/icon/${imageToken}`;
}

/**
 * Fetches ALL games from Lumin in headless mode across all pages, search terms, and categories.
 */
export async function fetchLuminGames(opts: { page?: number; limit?: number; fetchAll?: boolean } = { page: 1, limit: 100, fetchAll: true }): Promise<Game[]> {
  const builtinGames: Game[] = BUILTIN_LUMIN_CATALOG.map((g) => {
    const categoryTag = g.special?.[0] || "arcade";
    return {
      ...g,
      _search: `${g.name} ${categoryTag} lumin`.toLowerCase(),
    };
  });

  try {
    const ready = await initLuminHeadless();
    if (!ready || !window.Lumin || typeof window.Lumin.getGames !== "function") {
      return builtinGames;
    }

    let allRawGames: LuminRawGame[] = [];
    const limit = opts.limit || 100;

    // Fetch pages 1 through 20 in controlled batches of 4
    for (let batch = 0; batch < 5; batch++) {
      const pageNumbers = [batch * 4 + 1, batch * 4 + 2, batch * 4 + 3, batch * 4 + 4];
      const pageResults = await Promise.all(
        pageNumbers.map((p) => window.Lumin!.getGames({ page: p, limit }).catch(() => null))
      );
      for (const pRes of pageResults) {
        if (pRes?.games && Array.isArray(pRes.games)) {
          allRawGames.push(...pRes.games);
        }
      }
    }

    // Query categories if available
    if (typeof window.Lumin.getCategories === "function") {
      try {
        const categories = await window.Lumin.getCategories();
        if (Array.isArray(categories) && categories.length > 0) {
          const catResults = await Promise.all(
            categories.slice(0, 15).map((cat) => window.Lumin!.getGames({ category: cat, limit: 100 } as any).catch(() => null))
          );
          for (const cRes of catResults) {
            if (cRes?.games && Array.isArray(cRes.games)) {
              allRawGames.push(...cRes.games);
            }
          }
        }
      } catch {}
    }

    // Deduplicate games by ID & canonical name
    const seenIds = new Set<string>(builtinGames.map((g) => String(g.id).replace("lumin-", "").toLowerCase()));
    const liveGames: Game[] = [];

    for (const g of allRawGames) {
      if (!g || !g.id) continue;
      const key = String(g.id).toLowerCase().trim();
      if (seenIds.has(key)) continue;
      seenIds.add(key);

      const categoryTag = g.category ? g.category.toLowerCase().trim() : "arcade";
      liveGames.push({
        id: `lumin-${g.id}`,
        name: g.name || "Lumin Game",
        cover: g.image_token
          ? (g.image_token.startsWith("http") ? g.image_token : `https://a.luminsdk.com/api/v1/icon/${g.image_token}`)
          : "",
        url: `lumin:${g.id}`,
        source: "lumin",
        luminId: g.id,
        special: [categoryTag, "lumin"],
        _search: `${g.name} ${categoryTag} lumin`.toLowerCase(),
      });
    }

    return [...builtinGames, ...liveGames];
  } catch (err) {
    console.warn("[Lumin SDK] fetchLuminGames error:", err);
    return builtinGames;
  }
}

/**
 * Resolves a one-time game playable URL for custom <iframe> rendering:
 * const { url } = await Lumin.getGameUrl(gameId);
 */
export async function getLuminGamePlayUrl(luminId: string): Promise<string> {
  try {
    const ready = await initLuminHeadless();
    if (ready && window.Lumin && typeof window.Lumin.getGameUrl === "function") {
      const res: any = await window.Lumin.getGameUrl(luminId);
      if (typeof res === "string" && res) return res;
      if (res && typeof res === "object" && typeof res.url === "string") {
        return res.url;
      }
    }
  } catch (err) {
    console.warn("[Lumin SDK] getGameUrl warning:", err);
  }

  // Guaranteed direct play URL fallback
  return `https://a.luminsdk.com/play/${luminId}`;
}

/**
 * Loads a game in the built-in player:
 * await Lumin.loadGame(gameId);
 */
export async function loadLuminGame(gameId: string): Promise<void> {
  const ready = await initLuminHeadless();
  if (ready && window.Lumin && typeof window.Lumin.loadGame === "function") {
    await window.Lumin.loadGame(gameId);
  }
}

/**
 * Closes the built-in game player
 */
export function endLuminGame(): void {
  if (typeof window !== "undefined" && window.Lumin) {
    if (typeof window.Lumin.endGame === "function") {
      window.Lumin.endGame();
    } else if (typeof window.Lumin.closeGame === "function") {
      window.Lumin.closeGame();
    }
  }
}

/**
 * Event listener registration for Lumin events ('ready', 'gameStart', 'gameEnd', 'error')
 */
export function onLuminEvent(event: string, callback: (...args: any[]) => void): void {
  if (typeof window !== "undefined" && window.Lumin && typeof window.Lumin.on === "function") {
    window.Lumin.on(event, callback);
  }
}

export function offLuminEvent(event: string, callback: (...args: any[]) => void): void {
  if (typeof window !== "undefined" && window.Lumin && typeof window.Lumin.off === "function") {
    window.Lumin.off(event, callback);
  }
}
