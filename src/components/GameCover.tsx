import React, { memo, useMemo, useState } from "react";
import { Gamepad2 } from "lucide-react";
import { formatCoverUrl } from "../utils";
import luminGamesList from "../lumin-games.json";
import localZones from "../zones.json";

const PRESET_GRADIENTS = [
  "from-indigo-600 via-indigo-700 to-violet-800",
  "from-blue-600 via-indigo-700 to-[#0c1642]",
  "from-rose-500 via-pink-600 to-purple-700",
  "from-amber-500 via-orange-600 to-rose-700",
  "from-blue-600 via-blue-700 to-indigo-800",
  "from-purple-600 via-fuchsia-700 to-pink-800",
];

function fallbackClass(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PRESET_GRADIENTS[Math.abs(hash) % PRESET_GRADIENTS.length];
}

function initials(name: string) {
  const words = name.replace(/[^a-zA-Z0-9\s]/g, "").trim().split(/\s+/).filter(Boolean);
  return words.length > 1 ? `${words[0][0]}${words[1][0]}`.toUpperCase() : (words[0]?.slice(0, 2) || "G").toUpperCase();
}

function getCanonical(str: string) {
  return str
    .toLowerCase()
    .trim()
    .replace(/['’":.-]/g, "")
    .replace(/\s+/g, " ");
}

function getCleanAlphanumeric(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Pre-index canonical game names and zone covers
const luminIconMap = new Map<string, string>();
const zoneCoverMap = new Map<string, string>();

try {
  // Index all LuminSDK images
  for (const g of luminGamesList) {
    if (g.image_token) {
      if (g.name) {
        luminIconMap.set(getCanonical(g.name), g.image_token);
        luminIconMap.set(getCleanAlphanumeric(g.name), g.image_token);
      }
      if (g.id) {
        luminIconMap.set(getCanonical(g.id), g.image_token);
        luminIconMap.set(getCleanAlphanumeric(g.id), g.image_token);
        const slug = g.id.split("/").pop();
        if (slug) {
          luminIconMap.set(getCleanAlphanumeric(slug), g.image_token);
        }
      }
    }
  }

  // Index all catalog zone covers
  for (const z of localZones) {
    if (z.name && z.cover) {
      const formatted = formatCoverUrl(z.cover);
      zoneCoverMap.set(getCanonical(z.name), formatted);
      zoneCoverMap.set(getCleanAlphanumeric(z.name), formatted);
    }
  }
} catch {}

/**
 * Searches through the whole SDK catalog for a game image token
 */
export function findLuminIconForGame(name: string): string | null {
  if (!name) return null;
  
  // 1. Direct canonical match
  const canon = getCanonical(name);
  if (luminIconMap.has(canon)) return luminIconMap.get(canon)!;

  // 2. Alphanumeric match
  const clean = getCleanAlphanumeric(name);
  if (luminIconMap.has(clean)) return luminIconMap.get(clean)!;

  // 3. Search through whole SDK list with fuzzy match
  for (const g of luminGamesList) {
    if (!g.image_token) continue;
    const gClean = getCleanAlphanumeric(g.name || "");
    if (gClean === clean || (gClean.length > 3 && clean.includes(gClean)) || (clean.length > 3 && gClean.includes(clean))) {
      return g.image_token;
    }
  }

  return null;
}

/**
 * Finds high-res cover image from zones catalog
 */
export function findZoneCoverForGame(name: string): string | null {
  if (!name) return null;
  const canon = getCanonical(name);
  if (zoneCoverMap.has(canon)) return zoneCoverMap.get(canon)!;

  const clean = getCleanAlphanumeric(name);
  if (zoneCoverMap.has(clean)) return zoneCoverMap.get(clean)!;

  for (const z of localZones) {
    if (!z.cover) continue;
    const zClean = getCleanAlphanumeric(z.name || "");
    if (zClean === clean || (zClean.length > 3 && clean.includes(zClean))) {
      return formatCoverUrl(z.cover);
    }
  }

  return null;
}

const coverSourceCache = new Map<string, string[]>();
const failedUrlSet = new Set<string>();

export const getCoverSources = (cover: string, name?: string): string[] => {
  const cacheKey = `${cover || ""}|${name || ""}`;
  const cached = coverSourceCache.get(cacheKey);
  if (cached) return cached;

  const sources: string[] = [];

  // 1. If explicit cover is provided
  if (cover) {
    const formatted = formatCoverUrl(cover);
    if (formatted) {
      sources.push(formatted);
      if (formatted.startsWith("http")) {
        sources.push(`/proxy-image?url=${encodeURIComponent(formatted)}`);
      }
    }
    if (formatted.includes("raw.githubusercontent.com/")) {
      const path = formatted.replace("https://raw.githubusercontent.com/", "");
      const [owner, repo, branch, ...rest] = path.split("/");
      sources.push(`https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/${rest.join("/")}`);
      sources.push(`https://raw.githack.com/${owner}/${repo}/${branch}/${rest.join("/")}`);
    }
  }

  // 2. Zone catalog cover match
  if (name) {
    const zoneCover = findZoneCoverForGame(name);
    if (zoneCover && !sources.includes(zoneCover)) {
      sources.push(zoneCover);
      if (zoneCover.startsWith("http")) {
        sources.push(`/proxy-image?url=${encodeURIComponent(zoneCover)}`);
      }
    }

    // 3. Whole LuminSDK cover search
    const luminToken = findLuminIconForGame(name);
    if (luminToken) {
      sources.push(`/api/lumin-icon/${luminToken}`);
    }
  }

  const result = [...new Set(sources)].filter((url) => !failedUrlSet.has(url));
  coverSourceCache.set(cacheKey, result);
  return result;
};

interface GameCoverProps {
  name: string;
  cover: string;
  className?: string;
}

const GameCover = memo(function GameCover({ name, cover, className = "" }: GameCoverProps) {
  const sources = useMemo(() => getCoverSources(cover, name), [cover, name]);
  const [index, setIndex] = useState(0);
  const currentUrl = sources[index];
  const failed = !currentUrl || index >= sources.length;

  const handleError = () => {
    if (currentUrl) {
      failedUrlSet.add(currentUrl);
    }
    setIndex((value) => value + 1);
  };

  return (
    <div className={`relative h-full w-full overflow-hidden bg-gradient-to-br ${fallbackClass(name)} ${className}`}>
      {!failed && (
        <img
          src={currentUrl}
          alt={`${name} cover`}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={handleError}
        />
      )}
      {failed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="absolute text-6xl font-black tracking-tighter text-white/10">{initials(name)}</span>
          <Gamepad2 className="relative text-white/90" size={38} />
          <span className="relative mt-2 rounded-full bg-black/25 px-2.5 py-0.5 text-[9px] font-extrabold tracking-widest text-white/95">PLAY</span>
        </div>
      )}
    </div>
  );
});

export default GameCover;
