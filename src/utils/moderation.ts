/**
 * Comprehensive Content Moderation & Safety Engine
 * 
 * Strict Zero-Tolerance Enforcement against:
 * - Slurs (racial, ethnic, homophobic, transphobic, religious, ableist hate speech)
 * - Sexual & NSFW terms (pornography, explicit nude acts, sexualized content)
 * - Violence, real-world death threats, physical assault, doxxing, and SWAT threats
 * 
 * COMMUNITY POLICY: General swear words and profanities (e.g., 'shit', 'fuck', 'bitch', 'ass', 'damn', 'hell', 'crap', 'piss')
 * are explicitly PERMITTED in chat and media overlays.
 */

export const ALLOWED_EXCEPTIONS = new Set([
  "damn",
  "dammit",
  "damned",
  "damnit",
  "hell",
  "heck",
  "hellish",
]);

// 1. Slurs (racial, ethnic, homophobic, transphobic, religious, ableist)
const SLUR_PATTERNS: RegExp[] = [
  // Racial / Ethnic
  /\b(?:n+[i1!l|]+g+g+[e3a4r]+s?|n+[i1!l|]+g+a+s?|n+[i1!l|]+g+g+[a4]+h?s?)\b/i,
  /\b(?:k+[i1!l|]+k+[e3]+s?)\b/i,
  /\b(?:c+h+[i1!l|]+n+k+s?)\b/i,
  /\b(?:s+p+[i1!l|]+c+s?|s+p+[i1!l|]+k+s?)\b/i,
  /\b(?:w+e+t+b+a+c+k+s?)\b/i,
  /\b(?:c+o+o+n+s?)\b/i,
  /\b(?:b+e+a+n+e+r+s?)\b/i,
  /\b(?:g+o+o+k+s?)\b/i,
  /\b(?:r+a+g+h+e+a+d+s?|t+o+w+e+l+h+e+a+d+s?)\b/i,
  /\b(?:k+a+f+f+[i1!l|]+r+s?)\b/i,
  /\b(?:p+a+k+[i1!l|]+s?)\b/i,
  /\b(?:j+a+p+s?)\b/i,
  /\b(?:c+h+[o0]+n+k+y?|c+h+[i1!l|]+n+g+\s*c+h+[o0]+n+g+)\b/i,
  // Homophobic / Transphobic
  /\b(?:f+a+g+g+[o0]+t+s?|f+a+g+s?)\b/i,
  /\b(?:d+y+k+[e3]+s?)\b/i,
  /\b(?:t+r+a+n+n+y|t+r+a+n+n+[i1!l|]+e+s?)\b/i,
  /\b(?:s+h+e+m+a+l+[e3]+s?)\b/i,
  // Ableist
  /\b(?:r+e+t+a+r+d+s?|r+e+t+a+r+d+[e3]+d+|r+e+t+a+r+d+a+t+[i1!l|]+[o0]+n+)\b/i,
  /\b(?:s+p+a+s+t+[i1!l|]+c+s?)\b/i,
];

// 2. Curse words / Profanities (EXCLUDING "damn" and "hell" which are allowed)
const CURSE_PATTERNS: RegExp[] = [
  /\b(?:f+u+c*k+(?:[e3]r|[i1!l|]+n+g?|[e3]d|s|o+f+f+|b+o+y+|h+e+a+d+)?|f+u+k+|f+u+q+|f+u+c+c+)\b/i,
  /\b(?:m+o+t+h+[e3]r+f+u+c*k+[e3]r+s?|m+o+t+h+[e3]r+f+u+c*k+[i1!l|]+n+g?)\b/i,
  /\b(?:s+h+[i1!l|]+t+s?|s+h+[i1!l|]+t+t+[e3]r+|s+h+[i1!l|]+t+t+y|b+u+l+l+s+h+[i1!l|]+t+|d+o+g+s+h+[i1!l|]+t+|h+o+r+s+e+s+h+[i1!l|]+t+|d+i+p+s+h+[i1!l|]+t+)\b/i,
  /\b(?:b+[i1!l|]+t+c+h+(?:[e3]s|[e3]d|y|[i1!l|]+n+g)?)\b/i,
  /\b(?:a+s+s+(?:h+[o0]+l+[e3]|w+[i1!l|]+p+[e3]|m+u+n+c+h+[e3]r|c+l+o+w+n|f+a+c+e)?s?)\b/i,
  /\b(?:j+a+c+k+a+s+s+|d+u+m+b+a+s+s+|f+a+t+a+s+s+|b+a+d+a+s+s+|s+m+a+r+t+a+s+s+)\b/i,
  /\b(?:b+a+s+t+a+r+d+s?)\b/i,
  /\b(?:c+u+n+t+s?)\b/i,
  /\b(?:t+w+a+t+s?)\b/i,
  /\b(?:p+u+s+s+y|p+u+s+s+[i1!l|]+e+s)\b/i,
  /\b(?:d+[i1!l|]+c+k+(?:h+e+a+d|s)?)\b/i,
  /\b(?:c+[o0]+c+k+(?:s+u+c+k+[e3]r|h+e+a+d)?s?)\b/i,
  /\b(?:p+r+[i1!l|]+c+k+s?)\b/i,
  /\b(?:w+a+n+k+[e3]r+s?|w+a+n+k+[i1!l|]+n+g?)\b/i,
  /\b(?:w+h+[o0]+r+[e3]+s?|s+l+u+t+s?)\b/i,
  /\b(?:k+y+s|k+m+s)\b/i,
  /\b(?:s+t+f+u|g+t+f+o)\b/i,
];

// 3. Sexual / NSFW terms
const SEXUAL_PATTERNS: RegExp[] = [
  /\b(?:p+[o0]+r+n+[o0]?|p+[o0]+r+n+[o0]+g+r+a+p+h+y|p+[o0]+r+n+h+u+b+)\b/i,
  /\b(?:n+s+f+w|x+x+x)\b/i,
  /\b(?:h+[e3]+n+t+a+[i1!l|]+)\b/i,
  /\b(?:s+[e3]+x+(?:y|u+a+l|u+a+l+l+y|[i1!l|]+n+g)?)\b/i,
  /\b(?:s+[e3]+x+t+[i1!l|]+n+g)\b/i,
  /\b(?:b+l+[o0]+w+j+[o0]+b+s?|h+a+n+d+j+[o0]+b+s?)\b/i,
  /\b(?:d+[i1!l|]+l+d+[o0]+s?|v+[i1!l|]+b+r+a+t+[o0]+r+s?)\b/i,
  /\b(?:m+a+s+t+u+r+b+a+t+[e3]+|m+a+s+t+u+r+b+a+t+[i1!l|]+[o0]+n+|j+e+r+k+[i1!l|]+n+g?\s+o+f+f+)\b/i,
  /\b(?:[o0]+r+g+a+s+m+s?|[o0]+r+g+a+s+m+[i1!l|]+c+)\b/i,
  /\b(?:c+u+m+(?:s|m+[i1!l|]+n+g|s+h+[o0]+t+s?)?)\b/i,
  /\b(?:j+[i1!l|]+z+z+|s+[e3]+m+[e3]+n+)\b/i,
  /\b(?:b+[o0]+[o0]+b+s?|b+[o0]+[o0]+b+[i1!l|]+e+s?)\b/i,
  /\b(?:t+[i1!l|]+t+s?|t+[i1!l|]+t+t+[i1!l|]+e+s?|t+[i1!l|]+t+t+y)\b/i,
  /\b(?:p+[e3]+n+[i1!l|]+s+e?s?)\b/i,
  /\b(?:v+a+g+[i1!l|]+n+a+s?)\b/i,
  /\b(?:c+l+[i1!l|]+t+[o0]+r+[i1!l|]+s+|c+l+[i1!l|]+t+s?)\b/i,
  /\b(?:s+c+r+[o0]+t+u+m+|t+[e3]+s+t+[i1!l|]+c+l+[e3]+s?)\b/i,
  /\b(?:a+n+a+l+(?:l+y)?)\b/i,
  /\b(?:d+[e3]+[e3]+p+t+h+r+[o0]+a+t+)\b/i,
  /\b(?:n+u+d+[e3]+s?|n+u+d+[i1!l|]+t+y|n+a+k+[e3]+d+)\b/i,
  /\b(?:s+t+r+[i1!l|]+p+p+[e3]+r+s?|s+t+r+[i1!l|]+p+t+[e3]+a+s+[e3]+)\b/i,
  /\b(?:b+d+s+m+|b+[o0]+n+d+a+g+[e3]+|f+[e3]+t+[i1!l|]+s+h+)\b/i,
  /\b(?:g+a+n+g+b+a+n+g+|b+u+k+k+a+k+[e3]+)\b/i,
  /\b(?:[e3]+r+[o0]+t+[i1!l|]+c+a?)\b/i,
  /\b(?:i+n+c+[e3]+s+t+)\b/i,
  /\b(?:c+a+m+g+[i1!l|]+r+l+|o+n+l+y+f+a+n+s+)\b/i,
  // Moaning, Sensual, Erotic and Audio NSFW terms
  /\b(?:m+[o0]+a+n+(?:s|ing|ed|ers?)?|g+r+[o0]+a+n+(?:s|ing|ed)?)\b/i,
  /\b(?:e+r+[o0]+t+[i1!l|]+c+\s*s+[o0]+u+n+d+s?|s+[e3]+x+\s*s+[o0]+u+n+d+s?|s+[e3]+x+u+a+l+\s*n+[o0]+[i1!l|]+s+[e3]+s?)\b/i,
  /\b(?:s+[e3]+x+u+a+l+\s*p+a+n+t+[i1!l|]+n+g|e+r+[o0]+t+[i1!l|]+c+\s*m+[o0]+a+n+s?)\b/i,
  /\b(?:a+h+h+h+h+|u+h+h+h+h+|o+h+h+h+h+|y+a+a+a+m+e+t+e|y+a+m+e+t+e)\b/i,
  /\*(?:moan|moans|moaning|groan|groans|groaning|pants|panting|sensual|heavy\s+breathing)\*/i,
  /\[(?:moan|moans|moaning|groan|groans|groaning|pants|panting|sensual|erotic|sex\s+sounds)\]/i,
  /\((?:moan|moans|moaning|groan|groans|groaning|pants|panting|sensual|erotic|sex\s+sounds)\)/i,
];

// 4. Threats of violence, death, physical assault, doxxing, swatting, self-harm
const THREAT_PATTERNS: RegExp[] = [
  /\b(?:i+l+l+|i\s*will|im\s*gonna|i\s*am\s*going\s*to)\s*(?:k+i+l+l|m+u+r+d+e+r|e+x+t+e+r+m+i+n+a+t+e|s+l+a+u+g+h+t+e+r|s+h+o+o+t|s+t+a+b|s+l+i+t|g+u+t|e+n+d)\s*(?:y+o+u|u|y+a|u+r\s*f+a+m+i+l+y|u+r\s*l+i+f+e)\b/i,
  /\b(?:g+o\s*k+i+l+l\s*y+o+u+r+s+e+l+f|g+o\s*k+y+s|k+y+s|k+i+l+l\s*y+o+u+r\s*s+e+l+f|e+n+d\s*y+o+u+r\s*l+i+f+e|h+a+n+g\s*y+o+u+r+s+e+l+f)\b/i,
  /\b(?:d+i+e\s*b+i+t+c+h|i\s*h+o+p+e\s*y+o+u\s*d+i+e|y+o+u\s*s+h+o+u+l+d\s*d+i+e|g+o\s*d+i+e)\b/i,
  /\b(?:i+l+l+|i\s*will|im\s*gonna)\s*(?:b+e+a+t|s+m+a+s+h|b+r+e+a+k|h+u+r+t|p+u+n+c+h|s+t+r+a+n+g+l+e)\s*(?:y+o+u+r|y+o+u|u)\b/i,
  /\b(?:i\s*k+n+o+w\s*w+h+e+r+e\s*y+o+u\s*l+i+v+e|i\s*h+a+v+e\s*y+o+u+r\s*i+p|i\s*w+i+l+l\s*d+o+x+x|i+l+l\s*l+e+a+k\s*y+o+u+r)\b/i,
  /\b(?:s+w+a+t+t+i+n+g\s*y+o+u|s+w+a+t\s*y+o+u+r\s*h+o+u+s+e|b+o+m+b\s*y+o+u+r\s*h+o+u+s+e)\b/i,
];

// 5. Obfuscated / Evaded patterns (spaced letters, punctuation)
const OBFUSCATED_PATTERNS = [
  { regex: /p[\s._\-*~+^#%&/\\|!@$]+o[\s._\-*~+^#%&/\\|!@$]+r[\s._\-*~+^#%&/\\|!@$]+n/i, type: "sexual term" },
  { regex: /n[\s._\-*~+^#%&/\\|!@$]+i[\s._\-*~+^#%&/\\|!@$]+g[\s._\-*~+^#%&/\\|!@$]+g/i, type: "slur" },
  { regex: /f[\s._\-*~+^#%&/\\|!@$]+a[\s._\-*~+^#%&/\\|!@$]+g/i, type: "slur" },
  { regex: /s[\s._\-*~+^#%&/\\|!@$]+e[\s._\-*~+^#%&/\\|!@$]+x/i, type: "sexual term" },
  { regex: /n[\s._\-*~+^#%&/\\|!@$]+u[\s._\-*~+^#%&/\\|!@$]+d[\s._\-*~+^#%&/\\|!@$]+e/i, type: "sexual term" },
];

// 5. Clean / Normalize text by unfolding Unicode homoglyphs and leetspeak
export function normalizeForSafety(input: string): string {
  if (!input) return "";

  // Remove zero-width characters and invisible joiners
  let str = input.replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E]/g, "");

  // Homoglyph conversion table
  const homoglyphs: Record<string, string> = {
    // Cyrillic & Greek
    "а": "a", "А": "a", "a": "a", "e": "e", "е": "e", "Е": "e", "o": "o", "о": "o", "О": "o",
    "р": "p", "Р": "p", "с": "c", "С": "c", "у": "y", "У": "y", "х": "x", "Х": "x", "і": "i",
    "І": "i", "ї": "i", "Ї": "i", "ј": "j", "Ј": "j", "ѕ": "s", "Ѕ": "s", "ո": "n", "ս": "u",
    // Fullwidth ASCII (FF01 - FF5E)
    "ａ": "a", "ｂ": "b", "ｃ": "c", "ｄ": "d", "ｅ": "e", "ｆ": "f", "ｇ": "g", "ｈ": "h",
    "ｉ": "i", "ｊ": "j", "ｋ": "k", "ｌ": "l", "ｍ": "m", "ｎ": "n", "ｏ": "o", "ｐ": "p",
    "ｑ": "q", "ｒ": "r", "ｓ": "s", "ｔ": "t", "ｕ": "u", "ｖ": "v", "ｗ": "w", "ｘ": "x",
    "ｙ": "y", "ｚ": "z",
  };

  str = str.split("").map((c) => homoglyphs[c] || c).join("").toLowerCase();

  // Normalize accented characters
  str = str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Leetspeak multi-char & standard conversions
  str = str.replace(/ph/g, "f")
           .replace(/vv/g, "w")
           .replace(/13/g, "b")
           .replace(/[@]/g, "a")
           .replace(/[$5]/g, "s")
           .replace(/[0]/g, "o")
           .replace(/[1!|]/g, "i")
           .replace(/[3]/g, "e")
           .replace(/[7+]/g, "t")
           .replace(/[4]/g, "a")
           .replace(/[8]/g, "b");

  return str;
}

export interface ModerationResult {
  safe: boolean;
  reason?: string;
  category?: "slur" | "curse word" | "sexual term";
}

/**
 * Checks text against all slurs, curse words, and sexual terms with zero quota limits.
 * Allows "damn" and "hell" as acceptable exceptions.
 */
export function checkTextModeration(input: string, customBlacklist: string[] = []): ModerationResult {
  if (!input || typeof input !== "string" || !input.trim()) {
    return { safe: true };
  }

  const raw = input.trim();
  const normalized = normalizeForSafety(raw);

  // 1. Check Threats of violence, death, harassment, or doxxing (Highest priority)
  for (const pattern of THREAT_PATTERNS) {
    if (pattern.test(raw) || pattern.test(normalized)) {
      return {
        safe: false,
        category: "threat" as any,
        reason: "Please keep the chat safe for everyone and avoid making threats, doxxing, or aggressive remarks.",
      };
    }
  }

  // 2. Custom blacklist check
  if (customBlacklist && customBlacklist.length > 0) {
    for (const word of customBlacklist) {
      if (!word) continue;
      const cleanW = normalizeForSafety(word);
      if (cleanW && (normalized.includes(cleanW) || new RegExp(`\\b${cleanW}\\b`, "i").test(normalized))) {
        return {
          safe: false,
          category: "curse word",
          reason: `Please avoid using restricted terms in chat: "${word}".`,
        };
      }
    }
  }

  // 2. Check Slurs (Highest priority)
  for (const pattern of SLUR_PATTERNS) {
    if (pattern.test(raw) || pattern.test(normalized)) {
      return {
        safe: false,
        category: "slur",
        reason: "Please keep the conversation respectful and avoid hate speech or slurs.",
      };
    }
  }

  // 3. Check Obfuscated patterns
  for (const item of OBFUSCATED_PATTERNS) {
    if (item.regex.test(raw)) {
      return {
        safe: false,
        category: item.type as any,
        reason: `Please avoid masked or altered ${item.type}s in chat.`,
      };
    }
  }

  // 4. Check Sexual & NSFW terms
  for (const pattern of SEXUAL_PATTERNS) {
    if (pattern.test(raw) || pattern.test(normalized)) {
      return {
        safe: false,
        category: "sexual term",
        reason: "Please keep chat friendly for everyone and avoid explicit or sexual language.",
      };
    }
  }

  // Note: General profanity/swearing is permitted per community guidelines.
  return { safe: true };
}

/**
 * Validates a GIF search query to enforce PG guidelines.
 */
export function isQuerySafeForGif(query: string): { safe: boolean; reason?: string } {
  if (!query || !query.trim()) return { safe: true };
  const check = checkTextModeration(query);
  if (!check.safe) {
    return { safe: false, reason: check.reason };
  }
  return { safe: true };
}


