import { useState, useEffect, useMemo } from "react";

// Vite dynamic glob import of all assets across subdirectories
// Scales to hundreds of assets without manual switch statements
const assetModules = import.meta.glob<{ default: string }>(
  "../assets/**/*.{png,jpg,jpeg,webp,svg,gif,avif}",
  { eager: true }
);

// Map of normalized asset keys (e.g. "player", "player.png", "characters/player") to resolved runtime URLs
const assetMap: Record<string, string> = {};

for (const [path, module] of Object.entries(assetModules)) {
  const url = module.default;
  
  // Clean relative path, e.g., "../assets/covers/ovo.png" -> "covers/ovo.png"
  const normalizedPath = path.replace(/^\.\.\/assets\//, "");
  assetMap[normalizedPath.toLowerCase()] = url;

  // Base filename without directory or extension, e.g., "ovo"
  const fileName = normalizedPath.split("/").pop() || "";
  const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
  
  assetMap[fileName.toLowerCase()] = url;
  assetMap[nameWithoutExt.toLowerCase()] = url;
}

export interface UseGameAssetResult {
  url: string;
  isLoading: boolean;
  isError: boolean;
  hasAsset: boolean;
}

/**
 * Dynamic React Hook for loading game assets without hardcoded strings or switch statements.
 * Uses Vite's dynamic glob module mapping and runtime URL resolution.
 *
 * @param assetIdOrName - Dynamic name, token, ID, or relative path (e.g., "hero_idle", "characters/boss", "token-xyz")
 * @param fallbackUrl - Optional fallback URL/placeholder when the asset is not found
 */
export function useGameAsset(
  assetIdOrName?: string | null,
  fallbackUrl: string = ""
): UseGameAssetResult {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [resolvedUrl, setResolvedUrl] = useState<string>(fallbackUrl);
  const [isError, setIsError] = useState<boolean>(false);

  const cleanKey = useMemo(() => {
    if (!assetIdOrName || typeof assetIdOrName !== "string") return "";
    return assetIdOrName.trim().toLowerCase();
  }, [assetIdOrName]);

  useEffect(() => {
    if (!cleanKey) {
      setResolvedUrl(fallbackUrl);
      setIsLoading(false);
      setIsError(false);
      return;
    }

    // 1. Direct Web/Data/Blob URLs
    if (/^(https?:|data:|blob:|\/)/i.test(cleanKey)) {
      setResolvedUrl(cleanKey);
      setIsLoading(false);
      setIsError(false);
      return;
    }

    // 2. Lookup in dynamic Vite asset glob map
    const matchedUrl = assetMap[cleanKey];
    if (matchedUrl) {
      setResolvedUrl(matchedUrl);
      setIsLoading(false);
      setIsError(false);
      return;
    }

    // 3. Dynamic runtime URL resolver via Vite's `new URL`
    try {
      // Dynamic resolution
      const dynamicUrl = new URL(`../assets/${cleanKey}`, import.meta.url).href;
      setResolvedUrl(dynamicUrl);
      setIsLoading(false);
      setIsError(false);
    } catch {
      // Fallback
      setResolvedUrl(fallbackUrl);
      setIsLoading(false);
      setIsError(true);
    }
  }, [cleanKey, fallbackUrl]);

  return {
    url: resolvedUrl,
    isLoading,
    isError,
    hasAsset: !!resolvedUrl && resolvedUrl !== fallbackUrl,
  };
}

export default useGameAsset;
