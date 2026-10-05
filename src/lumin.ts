import { Game } from "./types";
import { isFnfGame, isFnfMod, formatCoverUrl } from "./utils";
import localZones from "./zones.json";

export interface LuminGameObject {
  id: string;
  name: string;
  image_token?: string;
  category?: string;
  [key: string]: any;
}

export interface LuminGetGamesOptions {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
}

export interface LuminGamesResponse {
  games: LuminGameObject[];
  total?: number;
  pages?: number;
}

export interface LuminGameUrlResult {
  url: string;
  meta?: Record<string, any>;
}

export interface LuminInitOptions {
  headless?: boolean;
  container?: string | HTMLElement;
  [key: string]: any;
}

type LuminEventCallback = (...args: any[]) => void;

/**
 * Derives genre / category tags from a game's name or id.
 */
function inferLuminTags(name: string, id: string): string[] {
  const tags: string[] = [];
  const lower = (name + " " + id).toLowerCase();

  if (isFnfGame(name)) {
    if (isFnfMod(name)) {
      tags.push("fnf-mod");
    } else {
      tags.push("fnf");
    }
  }
  if (lower.includes("mario") || lower.includes("sonic") || lower.includes("pokemon") || lower.includes("zelda") || lower.includes("retro") || lower.includes("arcade")) {
    tags.push("retro");
  }
  if (lower.includes("racing") || lower.includes("drive") || lower.includes("car") || lower.includes("drift") || lower.includes("bike") || lower.includes("moto")) {
    tags.push("driving");
  }
  if (lower.includes("shooter") || lower.includes("gun") || lower.includes("quake") || lower.includes("doom") || lower.includes("strike") || lower.includes("war")) {
    tags.push("shooting");
  }
  if (lower.includes("puzzle") || lower.includes("2048") || lower.includes("chess") || lower.includes("sudoku") || lower.includes("tetris") || lower.includes("brain")) {
    tags.push("puzzle");
  }
  if (lower.includes("action") || lower.includes("fight") || lower.includes("smash") || lower.includes("battle") || lower.includes("ninja") || lower.includes("runner")) {
    tags.push("action");
  }
  if (lower.includes("multiplayer") || lower.includes(".io") || lower.includes("pvp") || lower.includes("party")) {
    tags.push("multiplayer");
  }
  if (lower.includes("sports") || lower.includes("soccer") || lower.includes("football") || lower.includes("basketball") || lower.includes("golf")) {
    tags.push("sports");
  }
  if (tags.length === 0) {
    tags.push("arcade");
  }
  return tags;
}

const eventListeners: Map<string, Set<LuminEventCallback>> = new Map();
const imageBlobCache: Map<string, string> = new Map();

function emitEvent(event: string, ...args: any[]) {
  const listeners = eventListeners.get(event);
  if (listeners) {
    listeners.forEach((cb) => {
      try {
        cb(...args);
      } catch (err) {
        console.error(`[Lumin] Error in '${event}' event listener:`, err);
      }
    });
  }
}

let isInitialized = false;
let isHeadlessMode = false;
let activeContainer: HTMLElement | null = null;
let activeIframe: HTMLIFrameElement | null = null;

/**
 * Official Lumin SDK Implementation
 */
export const Lumin = {
  /**
   * Initializes the Lumin SDK (supports headless mode).
   * Usage: await Lumin.init({ headless: true });
   */
  async init(options: LuminInitOptions = {}): Promise<boolean> {
    isInitialized = true;
    isHeadlessMode = !!options.headless;

    if (options.container) {
      if (typeof options.container === "string") {
        activeContainer = document.querySelector(options.container);
      } else if (options.container instanceof HTMLElement) {
        activeContainer = options.container;
      }
    }

    emitEvent("ready");
    return true;
  },

  /**
   * Fetches paginated games with optional filters.
   * Usage: const { games, total, pages } = await Lumin.getGames({ page: 1, limit: 20 });
   */
  async getGames(opts: LuminGetGamesOptions = {}): Promise<LuminGamesResponse> {
    try {
      const page = opts.page || 1;
      const limit = opts.limit || 50;
      const params = new URLSearchParams();
      if (page) params.set("page", String(page));
      if (limit) params.set("limit", String(limit));
      if (opts.search) params.set("search", opts.search);
      if (opts.category) params.set("category", opts.category);

      const res = await fetch(`/api/lumin-games?${params.toString()}`);
      if (!res.ok) return { games: [], total: 0, pages: 0 };

      const data = await res.json();
      const rawGames: LuminGameObject[] = Array.isArray(data) ? data : (data.games || []);
      const total = data.total ?? rawGames.length;
      const pages = data.pages ?? Math.ceil(total / limit);

      return {
        games: rawGames,
        total,
        pages,
      };
    } catch (err) {
      console.error("[Lumin] Failed to getGames:", err);
      return { games: [], total: 0, pages: 0 };
    }
  },

  /**
   * Returns a random selection of games.
   */
  async getRandomGames(count: number = 10): Promise<LuminGameObject[]> {
    const { games } = await this.getGames({ limit: 100 });
    const shuffled = [...games].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  },

  /**
   * Search games by query.
   */
  async search(query: string): Promise<LuminGameObject[]> {
    const { games } = await this.getGames({ search: query, limit: 100 });
    return games;
  },

  /**
   * Returns all available categories.
   */
  async getCategories(): Promise<string[]> {
    const { games } = await this.getGames({ limit: 200 });
    const categories = new Set<string>();
    for (const g of games) {
      if (g.category) categories.add(g.category);
    }
    return Array.from(categories);
  },

  /**
   * Resolves an image token to a direct image URL / blob URL as specified in Lumin Headless Mode.
   * Usage: const imgUrl = await Lumin.getImageUrl(game.image_token);
   */
  async getImageUrl(imageToken?: string): Promise<string> {
    if (!imageToken) return "";
    if (
      imageToken.startsWith("http://") ||
      imageToken.startsWith("https://") ||
      imageToken.startsWith("blob:") ||
      imageToken.startsWith("data:")
    ) {
      return imageToken;
    }

    let cleanToken = imageToken;
    if (cleanToken.startsWith("lumin-token:")) {
      cleanToken = cleanToken.slice("lumin-token:".length);
    } else if (cleanToken.startsWith("/api/lumin-icon/")) {
      cleanToken = cleanToken.slice("/api/lumin-icon/".length);
    }

    if (imageBlobCache.has(cleanToken)) {
      return imageBlobCache.get(cleanToken)!;
    }

    const proxyUrl = `/api/lumin-icon/${encodeURIComponent(cleanToken)}`;
    imageBlobCache.set(cleanToken, proxyUrl);
    return proxyUrl;
  },

  /**
   * Resolves a one-time playable iframe URL for a game.
   * Usage: const { url } = await Lumin.getGameUrl('snake-classic');
   */
  async getGameUrl(gameId: string): Promise<LuminGameUrlResult> {
    const cleanId = gameId.startsWith("lumin-") ? gameId.slice("lumin-".length) : gameId;
    try {
      const res = await fetch(`/api/lumin-game-url/${encodeURIComponent(cleanId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.url) {
          return { url: data.url, meta: data.meta || {} };
        }
      }
    } catch (err) {
      console.error(`[Lumin] getGameUrl error for ${gameId}:`, err);
    }
    return { url: "" };
  },

  /**
   * Loads a game directly into the container or fullscreen player.
   * Usage: await Lumin.loadGame('space-invaders');
   */
  async loadGame(gameId: string): Promise<boolean> {
    const cleanId = gameId.startsWith("lumin-") ? gameId.slice("lumin-".length) : gameId;
    const { url } = await this.getGameUrl(cleanId);
    if (!url) return false;

    emitEvent("gameStart", { id: cleanId, name: cleanId, url });

    if (activeContainer) {
      activeContainer.innerHTML = "";
      const iframe = document.createElement("iframe");
      iframe.src = url;
      iframe.setAttribute("allow", "autoplay; fullscreen; pointer-lock; gamepad; microphone; camera");
      iframe.setAttribute("allowfullscreen", "true");
      iframe.style.width = "100%";
      iframe.style.height = "100%";
      iframe.style.border = "none";
      activeContainer.appendChild(iframe);
      activeIframe = iframe;
      return true;
    }

    return true;
  },

  /**
   * Closes the active game.
   */
  endGame(): void {
    if (activeIframe) {
      try {
        activeIframe.src = "about:blank";
        activeIframe.remove();
      } catch {}
      activeIframe = null;
    }
    if (activeContainer) {
      activeContainer.innerHTML = "";
    }
    emitEvent("gameEnd");
  },

  /**
   * Safely cleanup SDK resources.
   */
  destroy(): void {
    this.endGame();
    eventListeners.clear();
    isInitialized = false;
    isHeadlessMode = false;
    activeContainer = null;
  },

  /**
   * Extracts direct iframe game URLs from the DOM (Method 2: Automated DOM Extraction).
   * Usage: Lumin.extractGameUrls();
   */
  extractGameUrls(containerSelector: string = "#games, #game-container"): string[] {
    const container = document.querySelector(containerSelector) || document.body;
    const iframes = container.querySelectorAll("iframe");
    const urls: string[] = [];

    iframes.forEach((iframe, index) => {
      const src = iframe.src;
      if (src && src !== "about:blank") {
        urls.push(src);
        console.log(`[Lumin Extraction] Game ${index + 1} URL:`, src);
      }
    });

    if (urls.length === 0) {
      console.log("[Lumin Extraction] No active game frames found in container.");
    }
    return urls;
  },

  /**
   * Event listener subscription.
   */
  on(event: string, callback: LuminEventCallback): void {
    if (!eventListeners.has(event)) {
      eventListeners.set(event, new Set());
    }
    eventListeners.get(event)!.add(callback);
  },

  /**
   * Event listener removal.
   */
  off(event: string, callback: LuminEventCallback): void {
    const listeners = eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  },
};

// Global assignment for universal access
declare global {
  interface Window {
    Lumin?: typeof Lumin;
  }
}

if (typeof window !== "undefined") {
  window.Lumin = Lumin;
}

export interface AssetLoadOptions {
  fallbackUrl?: string;
  signal?: AbortSignal;
  maxRetries?: number;
}

/**
 * Dynamic Asset Manager for LuminaSDK / LuminSDK.
 * Programmatically loads game images with caching, deduplication, and zero hardcoded extensions.
 */
export class LuminAssetManager {
  private static cache = new Map<string, string>();
  private static pending = new Map<string, Promise<string>>();
  private static maxCacheSize = 500;

  /**
   * Resolves any dynamic asset ID, token, path, or remote URL without hardcoded extensions.
   */
  public static async resolveAsset(
    assetRef?: string | null,
    options: AssetLoadOptions = {}
  ): Promise<string> {
    if (!assetRef || typeof assetRef !== "string") {
      return options.fallbackUrl || "";
    }

    const trimmed = assetRef.trim();
    if (!trimmed) return options.fallbackUrl || "";

    // Direct web or blob URLs
    if (/^(https?:|blob:|data:)/i.test(trimmed)) {
      return trimmed;
    }

    // Normalized asset key
    const cleanKey = trimmed.replace(/^(lumin-token:|\/api\/lumin-icon\/)/, "");

    if (this.cache.has(cleanKey)) {
      return this.cache.get(cleanKey)!;
    }

    if (this.pending.has(cleanKey)) {
      return this.pending.get(cleanKey)!;
    }

    const loadPromise = (async () => {
      try {
        const resolvedUrl = `/api/lumin-icon/${encodeURIComponent(cleanKey)}`;

        if (this.cache.size >= this.maxCacheSize) {
          const firstKey = this.cache.keys().next().value;
          if (firstKey) this.cache.delete(firstKey);
        }

        this.cache.set(cleanKey, resolvedUrl);
        return resolvedUrl;
      } catch (err) {
        console.warn(`[LuminAssetManager] Asset resolution error for "${cleanKey}":`, err);
        return options.fallbackUrl || "";
      } finally {
        this.pending.delete(cleanKey);
      }
    })();

    this.pending.set(cleanKey, loadPromise);
    return loadPromise;
  }

  /**
   * Batch resolves a collection of asset identifiers concurrently.
   */
  public static async resolveBatch(
    assetRefs: (string | undefined | null)[],
    options: AssetLoadOptions = {}
  ): Promise<string[]> {
    return Promise.all(assetRefs.map((ref) => this.resolveAsset(ref, options)));
  }

  /**
   * Clears the asset manager memory cache.
   */
  public static clearCache(): void {
    this.cache.clear();
    this.pending.clear();
  }
}

function findCatalogCover(name: string): string | null {
  const norm = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!norm) return null;
  
  // Try exact normalized match first
  let found = localZones.find((z) => {
    const zNorm = (z.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    return zNorm === norm;
  });
  if (found && found.cover) return found.cover;

  // Substring match
  found = localZones.find((z) => {
    const zNorm = (z.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    return zNorm.length > 2 && (zNorm.includes(norm) || norm.includes(zNorm));
  });
  if (found && found.cover) return found.cover;

  return null;
}

/**
 * High-level helper: Fetches all Lumin games adapted to the application's Game interface
 * using official LuminSDK Headless Mode and dynamic asset resolution.
 */
export async function fetchLuminGames(): Promise<Game[]> {
  try {
    await Lumin.init({ headless: true });
    const { games } = await Lumin.getGames({ limit: 2000 });

    const gamesWithImages = await Promise.all(
      games.map(async (g) => {
        const gameName = g.name || "Game";
        const gameId = String(g.id || "");
        const specialTags = inferLuminTags(gameName, gameId);
        if (g.category) {
          specialTags.push(g.category.toLowerCase());
        }

        // Try to match the game to a local high-quality cover in zones.json
        let coverUrl = findCatalogCover(gameName);
        if (coverUrl) {
          coverUrl = formatCoverUrl(coverUrl);
        } else {
          // Dynamic asset resolution via LuminAssetManager
          coverUrl = await LuminAssetManager.resolveAsset(g.image_token);
        }

        return {
          id: `lumin-${gameId}`,
          name: gameName,
          cover: coverUrl,
          url: `lumin:${gameId}`,
          author: undefined,
          featured: false,
          special: Array.from(new Set(specialTags)),
          source: "luminsdk" as const,
          luminId: gameId,
          _search: (gameName + " " + specialTags.join(" ")).toLowerCase(),
        };
      })
    );

    return gamesWithImages;
  } catch (err) {
    console.error("Failed to load Lumin games:", err);
    return [];
  }
}

/**
 * High-level helper: Resolves image token through LuminAssetManager.
 */
export async function getLuminImageUrl(imageToken: string): Promise<string> {
  return LuminAssetManager.resolveAsset(imageToken);
}

/**
 * High-level helper: Resolves game URL through Lumin.getGameUrl.
 */
export async function getLuminGameUrl(gameId: string): Promise<string | null> {
  const result = await Lumin.getGameUrl(gameId);
  return result.url || null;
}

/**
 * High-level helper: Embeds a Lumin game in an element.
 */
export async function embedLuminGame(
  containerEl: HTMLElement,
  luminId: string
): Promise<boolean> {
  await Lumin.init({ headless: true, container: containerEl });
  return Lumin.loadGame(luminId);
}

/**
 * High-level helper: Launches a Lumin game.
 */
export async function launchLuminGame(luminId: string): Promise<boolean> {
  return Lumin.loadGame(luminId);
}

/**
 * High-level helper: Closes any active game.
 */
export function closeLuminGame(): void {
  Lumin.endGame();
}

/**
 * Automatic background LuminSDK MPK asset extractor.
 */
export async function autoExtractLuminAssets(fileOrUrl: File | string): Promise<string[]> {
  try {
    const formData = new FormData();
    if (typeof fileOrUrl === "string") {
      const res = await fetch(fileOrUrl);
      if (!res.ok) return [];
      const blob = await res.blob();
      formData.append("file", blob, "package.mpk");
    } else {
      formData.append("file", fileOrUrl);
    }
    const res = await fetch("/api/extract-mpk-images", {
      method: "POST",
      body: formData,
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.images || []).map((img: { url: string }) => img.url);
  } catch {
    return [];
  }
}
