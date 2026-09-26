/**
 * Utility module for handling Scramjet proxy URLs and service worker registration
 */

export function isScramjetEligible(url: string): boolean {
  if (!url) return false;
  // External web game URLs that require proxying
  return (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.includes("now.gg") ||
    url.includes("poki.com") ||
    url.includes("crazygames.com")
  );
}

export function getScramjetGameUrl(url: string): string {
  if (!url) return "";
  if (!isScramjetEligible(url)) return url;

  // Encode URL for proxy route if needed
  try {
    const encoded = encodeURIComponent(url);
    return `/service/${encoded}`;
  } catch {
    return url;
  }
}

export async function registerScramjetServiceWorker(): Promise<boolean> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return false;
  }

  try {
    // Attempt registration if scramjet sw exists
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });
    return !!registration;
  } catch (err) {
    console.warn("Scramjet service worker registration skipped or unavailable:", err);
    return false;
  }
}
