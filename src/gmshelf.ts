import { Game } from "./types";
import { inferGameGenres, isFnfGame } from "./utils";
import localZones from "./zones.json";

// Quick seed games from gmshelf/ugs for instant zero-latency loading
export const SEED_GMSHELF_GAMES: Array<{ name: string; url: string; img?: string }> = [
  { name: "1v1.LOL", url: "/ugs/cl1v1lol.html" },
  { name: "2048", url: "/ugs/cl2048.html" },
  { name: "10 Bullets", url: "/ugs/cl10bullets.html" },
  { name: "10 Minutes Till Dawn", url: "/ugs/cl10minutestildawn.html" },
  { name: "12 MiniBattles", url: "/ugs/cl12minibattles.html" },
  { name: "1 on 1 Soccer", url: "/ugs/cl1on1soccer.html" },
  { name: "2048 Cupcakes", url: "/ugs/cl2048cupcakes.html" },
  { name: "BitLife", url: "/ugs/clbitlife.html" },
  { name: "Cookie Clicker", url: "/ugs/clcookieclicker.html" },
  { name: "Crossy Road", url: "/ugs/clcrossyroad.html" },
  { name: "Drive Mad", url: "/ugs/cldrivemad.html" },
  { name: "Geometry Dash", url: "/ugs/clgeometrydash.html" },
  { name: "Retro Bowl", url: "/ugs/clretrobowl.html" },
  { name: "Slope", url: "/ugs/clslope.html" },
  { name: "Subway Surfers", url: "/ugs/clsubwaysurfers.html" },
  { name: "Tunnel Rush", url: "/ugs/cltunnelrush.html" },
];

// Pre-index local zones for matching high-res covers
const catalogCoverMap = new Map<string, string>();
try {
  (localZones as any[]).forEach((z) => {
    if (z.name && z.cover) {
      const clean = z.name.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
      catalogCoverMap.set(clean, z.cover);
    }
  });
} catch {}

export function hashStringToId(str: string, index: number = 0): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return -2000000 - Math.abs(hash % 5000000) - (index % 1000);
}

// Generate aesthetic fallback SVG gradient card for games without covers
export function generateCoverFallback(name: string): string {
  const safeName = (name || "Game").replace(/[<>&"]/g, "").slice(0, 24);
  const initials = safeName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase() || "GM";

  // Pick deterministic palette
  const hash = Math.abs(
    name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0)
  );
  const gradients = [
    ["#3b82f6", "#1d4ed8"], // Blue
    ["#8b5cf6", "#6d28d9"], // Purple
    ["#ec4899", "#be185d"], // Pink
    ["#06b6d4", "#0e7490"], // Cyan
    ["#10b981", "#047857"], // Emerald
    ["#f59e0b", "#b45309"], // Amber
    ["#6366f1", "#4338ca"], // Indigo
    ["#f43f5e", "#be123c"], // Rose
  ];
  const [c1, c2] = gradients[hash % gradients.length];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${c1}" />
        <stop offset="100%" stop-color="${c2}" />
      </linearGradient>
    </defs>
    <rect width="400" height="300" fill="url(#g)" />
    <circle cx="200" cy="115" r="54" fill="rgba(255,255,255,0.15)" />
    <text x="200" y="130" font-family="system-ui, -apple-system, sans-serif" font-size="38" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="2">${initials}</text>
    <text x="200" y="210" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="700" fill="#ffffff" text-anchor="middle" opacity="0.95">${safeName}</text>
    <text x="200" y="235" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="600" fill="rgba(255,255,255,0.7)" text-anchor="middle" letter-spacing="1">GMSHELF / UGS</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function resolveGameCover(name: string, rawImg?: string): string {
  if (rawImg && !rawImg.includes("placeholder") && !rawImg.endsWith(".html")) {
    if (rawImg.startsWith("http://") || rawImg.startsWith("https://") || rawImg.startsWith("data:")) {
      return rawImg;
    }
  }

  // Check matching cover in catalog
  const clean = name.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
  const matched = catalogCoverMap.get(clean);
  if (matched) return matched;

  // Fallback to stylized procedural SVG cover
  return generateCoverFallback(name);
}

export function formatGmshelfGame(item: { name: string; url: string; img?: string }, idx: number): Game {
  const name = (item.name || "Untitled Game").trim();
  const rawUrl = item.url || "";
  const cleanUrl = rawUrl.replace(/^\/api\/ugs\//, "/").replace(/^\/ugs\//, "/");
  const idStr = rawUrl || name;
  const cover = resolveGameCover(name, item.img);
  const genres = inferGameGenres(name);
  const special = ["gmshelf", "ugs", ...genres];
  if (isFnfGame(name)) special.push("fnf");

  return {
    id: hashStringToId(idStr, idx),
    name,
    cover,
    url: rawUrl.startsWith("http") ? rawUrl : `/api/ugs${cleanUrl.startsWith("/") ? "" : "/"}${cleanUrl}`,
    gmshelfUrl: rawUrl,
    author: "gmshelf / ugs",
    authorLink: "https://github.com/gmshelf/ugs",
    featured: idx < 10,
    special,
    source: "gmshelf" as const,
    _search: `${name} gmshelf ugs ${special.join(" ")}`.toLowerCase(),
  };
}

export function getInitialGmshelfGames(): Game[] {
  return SEED_GMSHELF_GAMES.map((g, idx) => formatGmshelfGame(g, idx));
}

// Fetch the game list from gmshelf/ugs with cascading fallbacks
export async function fetchGmshelfGames(): Promise<Game[]> {
  const seed = getInitialGmshelfGames();

  // Mirrors in order of speed and stability
  const endpoints = [
    "https://raw.githack.com/gmshelf/ugs/main/ugs.json",
    "/api/gmshelf-games",
    "https://cdn.jsdelivr.net/gh/gmshelf/ugs@main/ugs.json",
    "/ugs.json",
    "https://raw.githubusercontent.com/gmshelf/ugs/main/ugs.json",
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json();
        const rawGames = Array.isArray(data) ? data : data.games || [];
        if (Array.isArray(rawGames) && rawGames.length > 0) {
          const formatted = rawGames
            .filter((g: any) => g && g.name && g.url)
            .map((g: any, idx: number) => formatGmshelfGame(g, idx));

          console.log(`⚡ [gmshelf] Fast-loaded ${formatted.length} games from ${endpoint}`);
          return formatted;
        }
      }
    } catch (err) {
      // Try next mirror
    }
  }

  console.warn("[gmshelf] Could not fetch ugs.json from remote, falling back to seed list.");
  return seed;
}

// Resolves a playable iframe URL for a gmshelf game
export function getGmshelfGameUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return "";
  let clean = pathOrUrl.trim();

  // If already full http(s) URL
  if (clean.startsWith("http://") || clean.startsWith("https://")) {
    return `/api/proxy?url=${encodeURIComponent(clean)}`;
  }

  // Strip duplicated /api/ugs/ or /ugs/ prefixes
  clean = clean.replace(/^\/api\/ugs\//, "/").replace(/^\/ugs\//, "/");
  if (!clean.startsWith("/")) {
    clean = "/" + clean;
  }

  // Return server proxy endpoint that strips iframe restrictions and injects base href
  return `/api/ugs${clean}`;
}

// Backward-compatible exports to replace LuminSDK smoothly
export const fetchLuminGames = fetchGmshelfGames;
export const getInitialLuminGames = getInitialGmshelfGames;
export const getLuminGameUrl = async (id: string): Promise<string> => getGmshelfGameUrl(id);
export const launchLuminNativePlayer = async (): Promise<void> => {};
export const closeLuminGame = (): void => {};
