/**
 * Content Moderation & Word Filter Engine
 * Enforces community safety guidelines across text, chat, usernames, and media searches.
 */

export interface ModerationResult {
  safe: boolean;
  category?: string;
  reason?: string;
  matchedWord?: string;
}

// Scunthorpe problem exceptions - words containing substrings that should not trigger false positives
export const ALLOWED_EXCEPTIONS = new Set<string>([
  "password",
  "passage",
  "pass",
  "passport",
  "classic",
  "class",
  "glasses",
  "grass",
  "brass",
  "bass",
  "mass",
  "asset",
  "assist",
  "assistant",
  "assemble",
  "assembly",
  "associate",
  "association",
  "assume",
  "assumption",
  "assignment",
  "analytics",
  "cockpit",
  "cocktail",
  "peacock",
  "hitchcock",
  "button",
  "butter",
  "butterfly",
  "document",
  "hello",
  "help",
  "sheet",
  "shirt",
  "scrap",
  "scrape",
  "scratch",
  "snicker",
  "dickens",
  "spaghetti",
  "title",
  "entitle",
  "shuttle",
  "canal",
  "penistone",
  "scunthorpe",
]);

/**
 * Normalizes input string by removing zero-width characters, decoding leetspeak,
 * and reducing excessively repeated letters to defeat obfuscation attempts.
 */
export function normalizeForSafety(text: string): string {
  if (!text) return "";
  let clean = text.toLowerCase();

  // Strip zero-width & invisible characters
  clean = clean.replace(/[\u200B-\u200D\uFEFF\u00A0\u2060\u180E]/g, "");

  // Normalize common leetspeak substitutions
  const leetMap: Record<string, string> = {
    "@": "a",
    "4": "a",
    "^": "a",
    "8": "b",
    "©": "c",
    "(": "c",
    "3": "e",
    "€": "e",
    "1": "i",
    "!": "i",
    "|": "i",
    "0": "o",
    "5": "s",
    "$": "s",
    "7": "t",
    "+": "t",
    "v": "u",
  };

  let deobfuscated = "";
  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    deobfuscated += leetMap[char] || char;
  }

  // Collapse repeated characters (e.g. "fuuuuck" -> "fuck", "shiiit" -> "shit")
  const collapsed = deobfuscated.replace(/(.)\1{2,}/g, "$1$1");

  return collapsed.trim();
}

// Regex patterns categorized by severity and policy violation
const HATE_SPEECH_PATTERNS: RegExp[] = [
  /\b(n+[i1!l]+g+[e3a@]+r*s?|n+[i1!l]+g+a+s?|n+[e3]+g+r+[o0]+e?s?)\b/i,
  /\b(f+[a@]+g+[o0]+t*s?|f+[a@]+g+s?)\b/i,
  /\b(k+[i1!]+k+[e3]+s?|c+[hH]+[i1!]+n+k+s?|g+[o0]+[o0]+k+s?)\b/i,
  /\b(t+r+[a@]+n+n+[yie]+s?|s+[hH]+[e3]+m+[a@]+l+[e3]+s?)\b/i,
  /\b(r+[e3]+t+[a@]+r+d+[s]?|r+[e3]+t+[a@]+r+d+[e3]+d+)\b/i,
  /\b(c+[o0]+[o0]+n+s?|w+[e3]+t+b+[a@]+c+k+s?|s+p+[i1!]+c+k?s?)\b/i,
  /\b(white\s*supremac|neo[\s-]*nazi|heil\s*hitler|swastika)\b/i,
];

const SEVERE_HARASSMENT_PATTERNS: RegExp[] = [
  /\b(k+y+s+|kill\s*your\s*self|go\s*die|hang\s*your\s*self|commit\s*suicide)\b/i,
  /\b(die\s*in\s*a\s*fire|slit\s*your\s*(wrists?|throat)|drink\s*bleach)\b/i,
  /\b(i\s*will\s*(kill|murder|hunt|shoot|stab|dox|doxx)\s*(you|ur))\b/i,
];

const EXPLICIT_PATTERNS: RegExp[] = [
  /\b(c+p+|c+s+a+m+|child\s*porn|pedo(phile|philia)?)\b/i,
  /\b(b+l+[o0]+w+j+[o0]+b+s?|c+u+m+s+[hH]+[o0]+t+s?|d+[i1!]+l+d+[o0]+s?)\b/i,
  /\b(d+[e3]+[e3]+p+t+[hH]+r+[o0]+a+t+|g+[a@]+n+g+b+[a@]+n+g+)\b/i,
  /\b(h+[e3]+n+t+[a@]+[i1!]|b+[uU]+k+k+[a@]+k+[e3]+)\b/i,
  /\b(p+[o0]+r+n+[o0]?g?r?a?p?h?y?|x+x+x+|r+e+d+t+u+b+e+|p+o+r+n+h+u+b+)\b/i,
];

const PROFANITY_PATTERNS: RegExp[] = [
  /\b(f+u+c+k+(e+r+|i+n+g+|s+|e+d+|o+f+f+)?)\b/i,
  /\b(m+o+t+h+e+r+f+u+c+k+(e+r+|i+n+g+|s+)?)\b/i,
  /\b(b+i+t+c+h+(e+s+|y+|i+n+g+)?)\b/i,
  /\b(c+u+n+t+(s+)?)\b/i,
  /\b(a+s+s+h+o+l+e+(s+)?)\b/i,
  /\b(d+i+c+k+h+e+a+d+(s+)?)\b/i,
];

const INAPPROPRIATE_GIF_PATTERNS: RegExp[] = [
  /\b(porn|hentai|nsfw|sex|nude|naked|blowjob|cum|dildo|tits|boobs|penis|dick|vagina|pussy|masturbat|erotic|gore|suicide|kys)\b/i,
];

/**
 * Checks text against all word filter categories and optional custom blacklisted words.
 */
export function checkTextModeration(
  input: string,
  customBlacklist: string[] = []
): ModerationResult {
  if (!input || !input.trim()) {
    return { safe: true };
  }

  const raw = input.trim();
  const normalized = normalizeForSafety(raw);

  // 1. Check custom blacklist first
  if (customBlacklist && customBlacklist.length > 0) {
    for (const forbidden of customBlacklist) {
      if (!forbidden || !forbidden.trim()) continue;
      const cleanForbidden = forbidden.trim().toLowerCase();
      // Match word boundaries or substring depending on length
      const regex = new RegExp(`\\b${escapeRegExp(cleanForbidden)}\\b`, "i");
      if (regex.test(raw) || regex.test(normalized)) {
        return {
          safe: false,
          category: "custom_blacklist",
          reason: `Blocked by moderator word filter: "${forbidden}"`,
          matchedWord: forbidden,
        };
      }
    }
  }

  // 2. Check Severe Harassment & Threats
  for (const pattern of SEVERE_HARASSMENT_PATTERNS) {
    if (pattern.test(raw) || pattern.test(normalized)) {
      return {
        safe: false,
        category: "harassment",
        reason: "Threats, violence, or self-harm incitement are strictly prohibited.",
      };
    }
  }

  // 3. Check Hate Speech & Slurs
  for (const pattern of HATE_SPEECH_PATTERNS) {
    if (pattern.test(raw) || pattern.test(normalized)) {
      return {
        safe: false,
        category: "hate_speech",
        reason: "Hate speech and slurs are strictly prohibited.",
      };
    }
  }

  // 4. Check Explicit Content
  for (const pattern of EXPLICIT_PATTERNS) {
    if (pattern.test(raw) || pattern.test(normalized)) {
      return {
        safe: false,
        category: "explicit",
        reason: "Explicit, adult, or illegal content is strictly prohibited.",
      };
    }
  }

  // 5. Check Profanity & Vulgarity (with Scunthorpe problem exception handling)
  for (const pattern of PROFANITY_PATTERNS) {
    const rawMatch = pattern.exec(raw);
    const normMatch = pattern.exec(normalized);
    const match = rawMatch || normMatch;

    if (match) {
      const matched = match[0].toLowerCase();
      // Verify matched word isn't part of an allowed exception
      let isExempt = false;
      for (const allowed of ALLOWED_EXCEPTIONS) {
        if (raw.toLowerCase().includes(allowed) || normalized.includes(allowed)) {
          // If the allowed word fully encompasses the match, grant exemption
          if (allowed.includes(matched)) {
            isExempt = true;
            break;
          }
        }
      }

      if (!isExempt) {
        return {
          safe: false,
          category: "profanity",
          reason: "Please keep chat and usernames clean and respectful.",
          matchedWord: matched,
        };
      }
    }
  }

  return { safe: true };
}

/**
 * GIF query safety check - Ensures searches for GIFs comply with community standards
 */
export function isQuerySafeForGif(query: string): { safe: boolean; reason?: string } {
  if (!query || !query.trim()) {
    return { safe: true };
  }

  const normalized = normalizeForSafety(query);

  // Check general moderation
  const textMod = checkTextModeration(query);
  if (!textMod.safe) {
    return {
      safe: false,
      reason: textMod.reason || "GIF search term violates community guidelines.",
    };
  }

  // Check GIF-specific inappropriate query patterns
  for (const pattern of INAPPROPRIATE_GIF_PATTERNS) {
    if (pattern.test(query) || pattern.test(normalized)) {
      return {
        safe: false,
        reason: "This search term is not permitted for GIFs.",
      };
    }
  }

  return { safe: true };
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
