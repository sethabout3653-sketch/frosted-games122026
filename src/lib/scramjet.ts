/**
 * Scramjet Proxy Client Integration
 * Exclusively active for the Soundboard Guys app.
 */

export const SCRAMJET_PREFIX = "/scramjet/service/";
export const SOUNDBOARD_TARGET_URL = "https://soundboardguys.com/";

/**
 * Scramjet XOR codec matching standard Scramjet implementation
 */
export function scramjetEncode(url: string): string {
  if (!url) return "";
  return encodeURIComponent(
    url
      .split("")
      .map((char, ind) =>
        ind % 2 === 0 ? String.fromCharCode(char.charCodeAt(0) ^ 2) : char
      )
      .join("")
  );
}

export function scramjetDecode(str: string): string {
  if (!str) return "";
  try {
    const decodedUri = decodeURIComponent(str);
    return decodedUri
      .split("")
      .map((char, ind) =>
        ind % 2 === 0 ? String.fromCharCode(char.charCodeAt(0) ^ 2) : char
      )
      .join("");
  } catch {
    return decodeURIComponent(str);
  }
}

/**
 * Checks if a game should run through the Scramjet proxy.
 * Only Soundboard Guys is routed through Scramjet.
 */
export function isScramjetEligible(gameId?: string | number, gameName?: string, gameUrl?: string, author?: string): boolean {
  if (gameId === "soundboard" || gameId === "soundboardguys") return true;
  if (author && author.toLowerCase().includes("soundboard guys")) return true;
  if (gameName && gameName.toLowerCase().includes("soundboard")) return true;
  if (gameUrl && (gameUrl.includes("soundboardguys.com") || gameUrl.includes("soundboard"))) return true;
  return false;
}

/**
 * Returns the proxied Scramjet URL for Soundboard Guys.
 */
export function getScramjetGameUrl(rawUrl: string = SOUNDBOARD_TARGET_URL): string {
  const normalized = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl.replace(/^\/+/, "")}`;
  return `${SCRAMJET_PREFIX}${encodeURIComponent(normalized)}`;
}

let swRegistered = false;

/**
 * Registers the Scramjet Service Worker when available.
 */
export async function registerScramjetServiceWorker(): Promise<boolean> {
  if (swRegistered) return true;
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return false;
  }

  try {
    await navigator.serviceWorker.register("/scramjet/scramjet.sw.js", {
      scope: "/scramjet/",
    });
    swRegistered = true;
    return true;
  } catch (err) {
    console.warn("[Scramjet] SW registration notice (falling back to Scramjet server gateway):", err);
    return false;
  }
}
