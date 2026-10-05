import { Game } from "./types";
import { isFnfGame } from "./utils";

export type GameCategory =
  | "Retro & Arcade"
  | "Driving & Racing"
  | "Skill & Platformer"
  | "Puzzle & Casual"
  | "Action & Shooters"
  | "Horror & Mystery"
  | "Sports & Physics"
  | "Emulators & Ports";

export const SEED_LUMIN_GAMES: Array<{ id: string; name: string; category: GameCategory; cover?: string }> = [
  { id: 'space-invaders', name: 'Space Invaders', category: 'Retro & Arcade', cover: 'https://raw.githubusercontent.com/3kho/3kho-assets/main/space-invaders/space-invaders.png' },
  { id: 'snake-classic', name: 'Snake Classic', category: 'Retro & Arcade' },
  { id: 'pacman', name: 'Pac-Man Arcade', category: 'Retro & Arcade', cover: 'https://raw.githubusercontent.com/3kho/3kho-assets/main/pacman/pacman.png' },
  { id: 'pong', name: 'Retro Pong', category: 'Retro & Arcade' },
  { id: 'breakout', name: 'Breakout DX', category: 'Retro & Arcade' },
  { id: 'moto-x3m', name: 'Moto X3M Bike Race', category: 'Driving & Racing', cover: 'https://raw.githubusercontent.com/3kho/3kho-assets/main/moto-x3m/moto-x3m.png' },
  { id: 'flappy-bird', name: 'Flappy Bird', category: 'Skill & Platformer', cover: 'https://raw.githubusercontent.com/3kho/3kho-assets/main/flappy-bird/flappy-bird.png' },
  { id: 'slope', name: 'Slope 3D Runner', category: 'Skill & Platformer', cover: 'https://raw.githubusercontent.com/3kho/3kho-assets/main/slope/slope.png' },
  { id: '2048', name: '2048 Puzzle', category: 'Puzzle & Casual', cover: 'https://raw.githubusercontent.com/3kho/3kho-assets/main/2048/2048.png' },
  { id: 'tetris', name: 'Tetris Classic', category: 'Puzzle & Casual' }
];

export function hashStringToId(str: string, index: number = 0): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return -1000000 - Math.abs(hash % 5000000) - (index % 1000);
}

export function getInitialLuminGames(): Game[] {
  return SEED_LUMIN_GAMES.map((g, idx) => {
    const name = g.name.includes('(Lumin)') ? g.name : `${g.name} (Lumin)`;
    const special = ['Lumin', 'Lumin SDK', g.category];
    return {
      id: hashStringToId(g.id, idx),
      name,
      cover: g.cover || '',
      url: `lumin:${g.id}`,
      author: 'Lumin SDK',
      featured: true,
      special,
      source: 'luminsdk' as const,
      luminId: g.id,
      _search: (name + " " + special.join(" ")).toLowerCase(),
    };
  });
}

function mapLuminCategory(luminCat?: string, name?: string): string {
  const cat = (luminCat || '').toLowerCase();
  const n = (name || '').toLowerCase();
  if (cat.includes('action') || cat.includes('shooter') || n.includes('shooter') || n.includes('gun')) return 'action';
  if (cat.includes('drive') || cat.includes('racing') || cat.includes('car') || n.includes('car') || n.includes('moto')) return 'driving';
  if (cat.includes('platform') || cat.includes('skill') || cat.includes('runner') || n.includes('run') || n.includes('slope')) return 'arcade';
  if (cat.includes('retro') || cat.includes('arcade') || cat.includes('classic')) return 'retro';
  if (cat.includes('puzzle') || cat.includes('casual') || n.includes('2048') || n.includes('tetris')) return 'puzzle';
  return 'arcade';
}

export async function fetchLuminGames(): Promise<Game[]> {
  const seedGames = getInitialLuminGames();

  try {
    // Fetch all games instantly from server-side proxy endpoint (/api/lumin-games) with zero worker domain errors
    const res = await fetch(`/api/lumin-games?limit=2000`);
    if (!res.ok) return seedGames;

    const data = await res.json();
    const rawGames: any[] = Array.isArray(data) ? data : (data.games || []);

    if (!Array.isArray(rawGames) || rawGames.length === 0) {
      return seedGames;
    }

    const resolved: Game[] = rawGames.map((g, idx) => {
      const coverUrl = g.cover_url || g.thumbnail || g.image_url || g.image || g.cover || '';
      const category = mapLuminCategory(g.category, g.name);
      const displayName = g.name ? (g.name.includes('(Lumin)') ? g.name : `${g.name} (Lumin)`) : 'Lumin Game';
      const luminId = String(g.id || g.name || `lumin-${idx}`);
      const special = ['Lumin', 'Lumin SDK', category];
      if (isFnfGame(displayName)) special.push('fnf');

      return {
        id: hashStringToId(luminId, idx),
        name: displayName,
        cover: coverUrl,
        url: `lumin:${luminId}`,
        author: 'Lumin SDK',
        featured: false,
        special,
        source: 'luminsdk' as const,
        luminId,
        _search: (displayName + " " + special.join(" ")).toLowerCase(),
      };
    });

    const seenIds = new Set<string>();
    const combined: Game[] = [];

    resolved.forEach((g) => {
      if (g.luminId && !seenIds.has(g.luminId)) {
        seenIds.add(g.luminId);
        combined.push(g);
      }
    });

    seedGames.forEach((g) => {
      if (g.luminId && !seenIds.has(g.luminId)) {
        seenIds.add(g.luminId);
        combined.push(g);
      }
    });

    console.log(`⚡ [Lumin SDK] Fast-loaded ${combined.length} total games successfully.`);
    return combined;
  } catch (err) {
    console.warn('[Lumin SDK] fetchLuminGames error, using seed catalog:', err);
    return seedGames;
  }
}

export async function getImageUrl(imageToken?: string): Promise<string> {
  if (!imageToken) return "";
  if (/^(https?:\/\/|blob:|data:)/i.test(imageToken)) return imageToken;
  let cleanToken = imageToken.replace(/^(lumin-token:|\/api\/lumin-icon\/)/, "");
  return `/api/lumin-icon/${encodeURIComponent(cleanToken)}`;
}

export async function getLuminGameUrl(luminId: string): Promise<string> {
  try {
    const cleanId = luminId.replace('lumin-', '').replace(/^\/+/, "");
    const res = await fetch(`/api/lumin-game-url/${encodeURIComponent(cleanId)}`);
    if (res.ok) {
      const data = await res.json();
      if (data?.url) return data.url;
    }
  } catch (err) {
    console.warn('[Lumin SDK] Server-side game URL fetch error:', err);
  }

  const cleanId = luminId.replace('lumin-', '').toLowerCase();
  if (cleanId.includes('2048')) return 'https://play2048.co/';
  if (cleanId.includes('snake')) return 'https://playsnake.org/';
  if (cleanId.includes('space-invaders') || cleanId.includes('invader')) return 'https://freeinvaders.org/';
  if (cleanId.includes('flappy')) return 'https://flappybird.io/';
  if (cleanId.includes('tetris')) return 'https://tetris.com/play-tetris';
  if (cleanId.includes('pacman')) return 'https://freepacman.org/';
  
  return `https://a.luminsdk.com/g/${luminId}`;
}

export async function launchLuminNativePlayer(luminId: string): Promise<void> {
  try {
    const Lumin = (window as any).Lumin;
    if (Lumin && typeof Lumin.loadGame === 'function') {
      await Lumin.loadGame(luminId);
    }
  } catch (err) {
    console.warn('[Lumin SDK] loadGame warning:', err);
  }
}

export function closeLuminGame(): void {
  try {
    const Lumin = (window as any).Lumin;
    if (Lumin && typeof Lumin.endGame === 'function') {
      Lumin.endGame();
    }
  } catch {}
}

declare global {
  interface Window {
    Lumin?: any;
  }
}
