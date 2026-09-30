/**
 * Global Theme Engine for Frosted Studying
 * Transforms all app-wide navy accents, surfaces, headers, footers,
 * and borders into custom curated palettes or dynamic RGB tones.
 */

export interface ThemeRgb {
  r: number;
  g: number;
  b: number;
}

export const DEFAULT_NAVY_THEME: ThemeRgb = {
  r: 80,
  g: 140,
  b: 255,
};

// Earlier builds auto-saved this coral default for every visitor, so treat it as "no choice made".
const LEGACY_DEFAULT_THEME: ThemeRgb = { r: 242, g: 140, b: 120 };

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function hexToRgb(hex: string): ThemeRgb | null {
  const clean = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(clean)) return null;
  const full = clean.length === 3
    ? clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2]
    : clean;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

export function hsvToRgb(h: number, s: number, v: number): ThemeRgb {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;

  if (h >= 0 && h < 60) {
    r = c; g = x; b = 0;
  } else if (h >= 60 && h < 120) {
    r = x; g = c; b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0; g = c; b = x;
  } else if (h >= 180 && h < 240) {
    r = 0; g = x; b = c;
  } else if (h >= 240 && h < 300) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

export function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (max !== min) {
    switch (max) {
      case rn: h = (gn - bn) / d + (gn < bn ? 6 : 0); break;
      case gn: h = (bn - rn) / d + 2; break;
      case bn: h = (rn - gn) / d + 4; break;
    }
    h *= 60;
  }

  return { h: Math.round(h), s, v };
}

/**
 * Calculates responsive, accessible, high-contrast surface shades from any RGB base.
 */
export function calculateThemeShades(r: number, g: number, b: number) {
  const cr = Math.max(0, Math.min(255, r));
  const cg = Math.max(0, Math.min(255, g));
  const cb = Math.max(0, Math.min(255, b));

  const { h, s } = rgbToHsv(cr, cg, cb);
  const isNeutral = s < 0.08;
  const effectiveSat = isNeutral ? 8 : Math.max(35, Math.min(88, s * 100));
  // Surfaces stay calmer than the accent so large areas never look garish.
  const surfaceSat = isNeutral ? 6 : Math.max(18, Math.min(48, effectiveSat * 0.6));
  const tone = (lightness: number, satBoost = 0) =>
    `hsl(${h}, ${Math.min(100, surfaceSat + satBoost).toFixed(1)}%, ${lightness}%)`;

  // Layered elevation ladder: each step reads as a distinct plane.
  const chatRail = tone(3.5);
  const darkest = tone(5);
  const chatBg = tone(6);
  const chatSidebar = tone(7.5);
  const surface = tone(9.5);
  const chatInput = tone(11);
  const hover = tone(14, 4);
  const chatHover = tone(14, 4);
  const accent = tone(20, 12);
  const chatActive = tone(23, 14);
  const accentHover = tone(28, 16);

  // Vibrant accent scale, always legible regardless of how dark the picked color is
  const ind100 = `hsl(${h}, ${effectiveSat}%, 96%)`;
  const ind200 = `hsl(${h}, ${effectiveSat}%, 90%)`;
  const ind300 = `hsl(${h}, ${effectiveSat}%, 80%)`;
  const ind400 = `hsl(${h}, ${effectiveSat}%, 70%)`;
  const ind500 = `hsl(${h}, ${effectiveSat}%, 60%)`;
  const ind600 = `hsl(${h}, ${effectiveSat}%, 50%)`;
  const ind700 = `hsl(${h}, ${Math.max(30, effectiveSat - 10)}%, 36%)`;
  const ind800 = `hsl(${h}, ${surfaceSat + 14}%, 22%)`;
  const ind900 = `hsl(${h}, ${surfaceSat + 8}%, 13%)`;
  const ind950 = `hsl(${h}, ${surfaceSat}%, 7%)`;

  const border = `hsla(${h}, ${effectiveSat}%, 65%, 0.22)`;
  const borderSubtle = `hsla(${h}, ${effectiveSat}%, 80%, 0.09)`;
  const borderStrong = `hsla(${h}, ${effectiveSat}%, 68%, 0.6)`;

  const textAccent = `hsl(${h}, ${Math.min(60, effectiveSat)}%, 92%)`;
  const textMuted = `hsl(${h}, ${Math.max(12, Math.min(30, effectiveSat * 0.4))}%, 70%)`;
  const glow = ind500;

  return {
    r: cr,
    g: cg,
    b: cb,
    h,
    sat: effectiveSat,
    surfaceSat,
    hex: rgbToHex(cr, cg, cb),
    darkest,
    surface,
    hover,
    accent,
    accentHover,
    chatBg,
    chatRail,
    chatSidebar,
    chatInput,
    chatHover,
    chatActive,
    ind500,
    ind600,
    ind400,
    ind300,
    ind200,
    ind100,
    ind700,
    ind800,
    ind900,
    ind950,
    border,
    borderSubtle,
    borderStrong,
    textAccent,
    textMuted,
    glow,
  };
}

/**
 * Apply the theme properties to document root (:root)
 */
export function applyTheme(r: number, g: number, b: number) {
  if (typeof document === "undefined") return;

  const shades = calculateThemeShades(r, g, b);
  const root = document.documentElement;

  root.style.setProperty("--theme-r", `${shades.r}`);
  root.style.setProperty("--theme-g", `${shades.g}`);
  root.style.setProperty("--theme-b", `${shades.b}`);
  root.style.setProperty("--theme-h", `${shades.h}`);
  root.style.setProperty("--theme-sat", `${shades.sat}%`);
  root.style.setProperty("--theme-surface-sat", `${shades.surfaceSat}%`);
  root.style.setProperty("--theme-primary", shades.ind500);
  root.style.setProperty("--theme-darkest", shades.darkest);
  root.style.setProperty("--theme-surface", shades.surface);
  root.style.setProperty("--theme-hover", shades.hover);
  root.style.setProperty("--theme-accent", shades.accent);
  root.style.setProperty("--theme-accent-hover", shades.accentHover);

  // Chat custom properties
  root.style.setProperty("--theme-chat-bg", shades.chatBg);
  root.style.setProperty("--theme-chat-rail", shades.chatRail);
  root.style.setProperty("--theme-chat-sidebar", shades.chatSidebar);
  root.style.setProperty("--theme-chat-input", shades.chatInput);
  root.style.setProperty("--theme-chat-hover", shades.chatHover);
  root.style.setProperty("--theme-chat-active", shades.chatActive);

  // Indigo replacement scale for whole-app theme propagation
  root.style.setProperty("--theme-indigo-500", shades.ind500);
  root.style.setProperty("--theme-indigo-600", shades.ind600);
  root.style.setProperty("--theme-indigo-400", shades.ind400);
  root.style.setProperty("--theme-indigo-300", shades.ind300);
  root.style.setProperty("--theme-indigo-200", shades.ind200);
  root.style.setProperty("--theme-indigo-100", shades.ind100);
  root.style.setProperty("--theme-indigo-700", shades.ind700);
  root.style.setProperty("--theme-indigo-800", shades.ind800);
  root.style.setProperty("--theme-indigo-900", shades.ind900);
  root.style.setProperty("--theme-indigo-950", shades.ind950);

  root.style.setProperty("--theme-border", shades.border);
  root.style.setProperty("--theme-border-subtle", shades.borderSubtle);
  root.style.setProperty("--theme-border-strong", shades.borderStrong);
  root.style.setProperty("--theme-text-accent", shades.textAccent);
  root.style.setProperty("--theme-text-muted", shades.textMuted);
  root.style.setProperty("--theme-glow", shades.glow);

  try {
    localStorage.setItem("frosted_theme_color", JSON.stringify({ r: shades.r, g: shades.g, b: shades.b }));
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("frosted-theme-change", {
          detail: { r: shades.r, g: shades.g, b: shades.b },
        })
      );
    }
  } catch {}
}

export function getSavedTheme(): ThemeRgb {
  if (typeof window === "undefined") return DEFAULT_NAVY_THEME;
  try {
    const raw = localStorage.getItem("frosted_theme_color");
    if (raw) {
      const parsed = JSON.parse(raw);
      const isLegacyDefault =
        parsed?.r === LEGACY_DEFAULT_THEME.r &&
        parsed?.g === LEGACY_DEFAULT_THEME.g &&
        parsed?.b === LEGACY_DEFAULT_THEME.b;
      if (isLegacyDefault) return DEFAULT_NAVY_THEME;
      if (typeof parsed?.r === "number" && typeof parsed?.g === "number" && typeof parsed?.b === "number") {
        return {
          r: Math.max(0, Math.min(255, parsed.r)),
          g: Math.max(0, Math.min(255, parsed.g)),
          b: Math.max(0, Math.min(255, parsed.b)),
        };
      }
    }
  } catch {}
  return DEFAULT_NAVY_THEME;
}

