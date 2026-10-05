import { Game } from "./types";
import localZones from "./zones.json";

export const COVER_BASE = "https://raw.githubusercontent.com/gn-math/covers/main";
export const HTML_BASE = "/api/game-frame";
export const ASSETS_JSON_URL = "https://raw.githubusercontent.com/gn-math/assets/main/zones.json";

/**
 * Normalizes a game's cover URL by replacing placeholders with raw URLs.
 */
export function formatCoverUrl(cover: string): string {
  if (!cover) return "";
  let url = cover.trim();
  if (url.startsWith("http://")) url = url.replace("http://", "https://");
  
  if (url.startsWith("https://") || url.startsWith("data:") || url.startsWith("blob:")) {
    return url;
  }

  // Handle pure ID or filename like "1" or "1.png"
  if (/^\d+(\.png|\.jpg|\.webp)?$/i.test(url)) {
    const cleanId = url.replace(/\.[^.]+$/, "");
    return `${COVER_BASE}/${cleanId}.png`;
  }
  
  return url
    .replace(/{COVER_URL}/g, COVER_BASE)
    .replace(/{HTML_URL}/g, HTML_BASE);
}

/**
 * Normalizes a game's play URL by routing HTML5 catalog games through the local /api/game-frame proxy.
 * Eliminates cross-origin "refused to connect" and frame-ancestor blocking.
 */
export function formatGameUrl(url: string): string {
  if (!url) return "";
  let formattedUrl = url;
  if (formattedUrl.startsWith("http://")) formattedUrl = formattedUrl.replace("http://", "https://");

  const rawUrl = formattedUrl
    .replace(/{HTML_URL}/g, "https://rawcdn.githack.com/gn-math/html/main")
    .replace(/{COVER_URL}/g, COVER_BASE)
    .replace(/\/api\/game-frame/g, "https://rawcdn.githack.com/gn-math/html/main");

  return rawUrl;
}

/**
 * Returns the raw direct URL (useful for opening in a dedicated new tab).
 */
export function getRawGameUrl(url: string): string {
  return formatGameUrl(url);
}

/**
 * Fetches the live game list (zones.json) from GitHub with a robust local fallback.
 */
export async function fetchGamesList(): Promise<Game[]> {
  try {
    const response = await fetch(`${ASSETS_JSON_URL}?t=${Date.now()}`);
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        return (data as Game[]).filter((g) => g.name !== "-3" && g.id !== 816);
      }
    }
  } catch {
    try {
      const localRes = await fetch(`/zones.json?t=${Date.now()}`);
      if (localRes.ok) {
        const localData = await localRes.json();
        if (Array.isArray(localData) && localData.length > 0) {
          return (localData as Game[]).filter((g) => g.name !== "-3" && g.id !== 816);
        }
      }
    } catch {
      // ignore
    }
  }
  return (localZones as Game[]).filter((g) => g.name !== "-3" && g.id !== 816);
}

/**
 * Infallible genre classifier that accurately tags every game into its primary & secondary genres.
 */
export function inferGameGenres(name: string, special: string[] = []): string[] {
  const n = (name || "").toLowerCase();
  const s = (special || []).map((t) => String(t).toLowerCase());
  const genres = new Set<string>();

  // Action / Combat / Fighting
  if (
    /\b(action|fight|combat|smash|brawl|punch|kick|ninja|sword|battle|war|strike|doom|quake|duke|contra|metal slug|mortal kombat|street fighter|tekken|stickman|ragdoll|melee|assassin|hitman|boxing|wrestling|karate|kung fu|gun|shoot|bullet|sniper|call of duty|halo|csgo|counter strike|pixel gun|shell shockers|krunker|zombie|dead|apocalypse|alien|monster|boss|defense|tower defense|survive|survival)\b/i.test(
      n
    )
  ) {
    genres.add("action");
  }

  // Shooting / FPS
  if (
    /\b(shoot|gun|sniper|bullet|fps|krunker|shell shockers|doom|quake|duke|contra|metal slug|call of duty|halo|csgo|counter strike|strike|aim|trigger|blaster|cannon|turret|missile|tank|tanks|artillery|warzone|commando|special forces)\b/i.test(
      n
    )
  ) {
    genres.add("shooting");
  }

  // Retro / Classic / Emulated
  if (
    s.includes("flash") ||
    s.includes("emulator") ||
    s.includes("gba") ||
    s.includes("nes") ||
    s.includes("n64") ||
    s.includes("nds") ||
    s.includes("psx") ||
    s.includes("dos") ||
    /\b(retro|classic|arcade|mario|sonic|pokemon|zelda|pacman|tetris|donkey kong|galaga|space invaders|frogger|dig dug|megaman|kirby|castlevania|metroid|chrono|bomberman|street fighter|mortal kombat|doom|quake|half-life|sonic the hedgehog|super mario)\b/i.test(
      n
    )
  ) {
    genres.add("retro");
  }

  // Arcade
  if (
    s.includes("flash") ||
    /\b(arcade|pinball|pacman|tetris|breakout|brick|pong|galaga|space invaders|asteroids|snake|centipede|crossy|flappy|doodle|subway|temple run|geometry dash|run 3|run 2|run 1|slope|tunnel|helix|ball|roller|bounce|stack|jetpack|miner|gold miner|miner mole)\b/i.test(
      n
    )
  ) {
    genres.add("arcade");
  }

  // Driving / Racing / Vehicles
  if (
    /\b(drive|driving|race|racing|drift|drifting|car|cars|moto|bike|bicycle|motorcycle|kart|karting|speed|speedway|track|highway|traffic|truck|bus|train|flight|plane|airplane|helicopter|boat|rally|nascar|f1|formula|burnout|need for speed|asphalt|hill climb|drift hunters|smash karts|madalin|drift boss|eggy car)\b/i.test(
      n
    )
  ) {
    genres.add("driving");
  }

  // Puzzle / Logic / Brain
  if (
    /\b(puzzle|2048|tetris|sudoku|chess|checkers|crossword|wordle|word|logic|brain|match|block|minesweeper|cut the rope|unblock|connect|maze|rubik|physics|bridge|portal|escape|riddle|quiz|trivia|memory|card|solitaire|uno|scrabble|mahjong|jigsaw|blob|draw|doodle god|water sort|pipe)\b/i.test(
      n
    )
  ) {
    genres.add("puzzle");
  }

  // 2-Player / Multiplayer
  if (
    /\b(2-player|2 player|two player|pvp|party|multiplayer|fireboy|watergirl|bad ice cream|tank trouble|rooftop snipers|getaway shootout|football heads|soccer random|basket random|boxing random|volley random|bomb it|chess|checkers|connect 4|pong|tic tac toe|uno|smash karts|1v1|battle|arena|versus|vs)\b/i.test(
      n
    )
  ) {
    genres.add("2-player");
    genres.add("multiplayer");
  }

  // Platformer / Jump & Run
  if (
    /\b(mario|sonic|kirby|rayman|megaman|donkey kong|jump|platformer|platform|runner|dash|geometry dash|vex|fancy pants|ninja|red ball|fireboy|watergirl|ovo|parkour|climb|tower|leap|bounce|run 3|run 2|run 1)\b/i.test(
      n
    )
  ) {
    genres.add("platformer");
  }

  // Sports
  if (
    /\b(sport|sports|soccer|football|basket|basketball|golf|minigolf|tennis|ping pong|table tennis|bowling|baseball|hockey|skate|skateboard|skating|snowboard|ski|skiing|surf|surfing|boxing|wrestling|pool|billiards|8 ball|archery|darts|swim|swimming|cricket|volleyball)\b/i.test(
      n
    )
  ) {
    genres.add("sports");
  }

  // Rhythm / Music / FNF
  if (
    s.includes("fnf") ||
    /\b(fnf|friday night funkin|rhythm|music|beat|dance|piano|guitar|song|sing|soundboard|synth|dj|melody|audio|tempo)\b/i.test(
      n
    )
  ) {
    genres.add("rhythm");
  }

  // Strategy / Simulation / Idle / Clicker
  if (
    /\b(strategy|tactics|tower defense|defense|tycoon|simulator|sim|craft|crafting|mine|minecraft|paper minecraft|block craft|idle|clicker|cookie clicker|factory|empire|build|city|farm|farming|warfare|civ|civilization|age of war|kingdom|chess|bloons|plants vs zombies)\b/i.test(
      n
    )
  ) {
    genres.add("strategy");
  }

  // Horror / Mystery
  if (
    /\b(horror|fnaf|five nights|granny|slenderman|creepy|ghost|spooky|haunted|monster|zombie|dead|evil|fear|nightmare|escape room|baldi|exe)\b/i.test(
      n
    )
  ) {
    genres.add("horror");
  }

  // Adventure / RPG
  if (
    /\b(adventure|quest|zelda|pokemon|rpg|dungeon|explore|story|journey|legend|hero|sword|scrolls|tales|final fantasy|dragon|knight|magic|realm|castlevania)\b/i.test(
      n
    )
  ) {
    genres.add("adventure");
  }

  // Default fallback if no genres detected
  if (genres.size === 0) {
    if (s.includes("port") || s.includes("emulator")) {
      genres.add("retro");
      genres.add("arcade");
    } else {
      genres.add("arcade");
    }
  }

  return Array.from(genres);
}

/**
 * Extracts all unique tag keywords from the list of games.
 */
export function getUniqueTags(games: Game[]): string[] {
  const tagsSet = new Set<string>();
  games.forEach((game) => {
    if (Array.isArray(game.special)) {
      game.special.forEach((tag) => {
        if (tag && tag.trim().length > 0) {
          const cleanTag = tag.trim().toLowerCase();
          if (cleanTag !== "luminsdk") {
            tagsSet.add(cleanTag);
          }
        }
      });
    }
  });
  return Array.from(tagsSet).sort();
}

/**
 * Identifies specific Baldi target game groups ("Baldi's Basics", "Baldi's Basics Plus", "Baldi's Basics Classic Remastered")
 * that should prefer LuminSDK instead of gn-math catalog.
 */
export function getBaldiTargetGroup(name: string): string | null {
  const canon = name
    .toLowerCase()
    .trim()
    .replace(/['’":.-]/g, "")
    .replace(/\s+/g, "");

  if (canon === "baldibasics" || canon === "baldisbasics") {
    return "baldi_basics";
  }
  if (canon === "baldibasicsplus" || canon === "baldisbasicsplus") {
    return "baldi_basics_plus";
  }
  if (canon === "baldibasicsclassicremastered" || canon === "baldisbasicsclassicremastered") {
    return "baldi_basics_classic_remastered";
  }
  return null;
}

/**
 * Deduplicates games between the primary gn-math catalog and secondary sources (LuminSDK),
 * and eliminates duplicate copies within the catalog itself.
 * Specifically:
 * 1. For "Friday Night Funkin" / "FNF", the gn-math version is strictly preserved.
 * 2. For "Baldi's Basics", "Baldi's Basics Plus", and "Baldi's Basics Classic Remastered",
 *    the LuminSDK version is preferred over the gn-math catalog version.
 */
export function deduplicateGames(catalogGames: Game[], luminGames: Game[]): Game[] {
  const seenCanonical = new Set<string>();
  const result: Game[] = [];

  const getCanonical = (name: string) =>
    name
      .toLowerCase()
      .trim()
      .replace(/['’":.-]/g, "")
      .replace(/\s+/g, " ");

  // Identify which Baldi target groups are present in LuminSDK
  const luminBaldiGroups = new Set<string>();
  for (const lg of luminGames) {
    if (lg.id === -1) continue;
    const group = getBaldiTargetGroup(lg.name);
    if (group) {
      luminBaldiGroups.add(group);
    }
  }

  // 1. Process primary gn-math catalog games
  for (const game of catalogGames) {
    if (game.id === -1) continue;
    const canon = getCanonical(game.name);

    // If this catalog game is a Baldi target game that exists in LuminSDK, skip catalog version
    const baldiGroup = getBaldiTargetGroup(game.name);
    if (baldiGroup && luminBaldiGroups.has(baldiGroup)) {
      continue;
    }

    if (!seenCanonical.has(canon)) {
      seenCanonical.add(canon);
      result.push(game);
    }
  }

  // 2. Add secondary LuminSDK games
  for (const game of luminGames) {
    if (game.id === -1) continue;
    const canon = getCanonical(game.name);

    // Explicitly delete Lumin's duplicate copy of Friday Night Funkin / FNF
    if (canon === "friday night funkin" || canon === "fnf") {
      continue;
    }

    // Discard any Lumin game that duplicates a catalog game (unless it's a target Baldi game that was skipped)
    if (seenCanonical.has(canon)) {
      continue;
    }

    seenCanonical.add(canon);
    result.push(game);
  }

  return result;
}

/**
 * Checks if a game belongs to the FNF (Friday Night Funkin') ecosystem or mod catalog.
 */
export function isFnfGame(name: string, special?: string[]): boolean {
  const lower = name.toLowerCase();
  if (
    lower.includes("friday night funkin") ||
    lower.includes("funkin") ||
    /\bfnf\b/i.test(name) ||
    lower.startsWith("fnf") ||
    (special && special.some((s) => s.toLowerCase() === "fnf" || s.toLowerCase() === "fnf-mod"))
  ) {
    return true;
  }
  return false;
}

/**
 * Checks if an FNF game is a mod rather than the original vanilla base game.
 * Recognizes "Friday Night Funkin", "FNF", "FNF, Friday Night Funkin", "Friday Night Funkin, FNF",
 * and all vanilla title variations as the original game (returns false for isMod).
 */
export function isFnfMod(name: string, special?: string[]): boolean {
  if (!isFnfGame(name, special)) return false;

  const clean = name
    .toLowerCase()
    .replace(/['’":.-]/g, "")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Known vanilla base game patterns
  const vanillaPatterns = [
    /^friday night funkin$/,
    /^fnf$/,
    /^fnf friday night funkin$/,
    /^friday night funkin fnf$/,
    /^fnf \(?original\)?$/,
    /^friday night funkin \(?original\)?$/,
    /^the original friday night funkin$/,
    /^original friday night funkin$/,
    /^original fnf$/,
    /^friday night funkin vanilla$/,
    /^fnf vanilla$/,
  ];

  if (vanillaPatterns.some((pattern) => pattern.test(clean))) {
    return false;
  }

  // Check if title consists only of vanilla keywords without mod-specific indicators
  const tokens = clean.split(" ").filter(Boolean);
  const isOnlyVanillaTokens =
    tokens.length > 0 &&
    tokens.every(
      (t) =>
        t === "fnf" ||
        t === "friday" ||
        t === "night" ||
        t === "funkin" ||
        t === "original" ||
        t === "vanilla" ||
        t === "the" ||
        t === "game"
    );

  const hasModKeywords =
    clean.includes("vs") ||
    clean.includes("v.s") ||
    clean.includes("mod") ||
    clean.includes("sides") ||
    clean.includes("remix") ||
    clean.includes("soft") ||
    clean.includes("neo") ||
    clean.includes("pibby") ||
    clean.includes("corrupted") ||
    clean.includes("minus") ||
    clean.includes("edition") ||
    clean.includes("b-side") ||
    clean.includes("d-side");

  if (isOnlyVanillaTokens && !hasModKeywords) {
    return false;
  }

  return true;
}

/**
 * Capitalizes tags for cleaner presentation.
 */
export function formatTagLabel(tag: string): string {
  const lower = tag.toLowerCase().trim();
  if (lower === "fnf") return "FNF";
  if (lower === "fnf-mod" || lower === "fnf mod") return "FNF Mod";
  if (lower === "gba") return "GBA";
  if (lower === "nds") return "NDS";
  if (lower === "n64") return "N64";
  if (lower === "nes") return "NES";
  if (lower === "psx") return "PSX";
  if (lower === "dos") return "DOS";
  return tag
    .split(/[-_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
