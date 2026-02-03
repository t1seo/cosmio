import type { ThemePalette } from '../../core/types.js';

// ── Dark Mode Palette ──────────────────────────────────────────
// Designed for GitHub dark background (#0d1117)
// Stars rendered as astronomical magnitudes: L4 = 1st magnitude (brightest)

export const CONSTELLATION_DARK: ThemePalette = {
  contribution: {
    levels: [
      { hex: '#1E293B', opacity: 0.15 }, // L0 — empty sky (no star rendered)
      { hex: '#D97706', opacity: 0.6 },  // L1 — 4th magnitude (Antares Copper)
      { hex: '#FBBF24', opacity: 0.75 }, // L2 — 3rd magnitude (Vega Amber)
      { hex: '#FDE68A', opacity: 0.9 },  // L3 — 2nd magnitude (Polaris Gold)
      { hex: '#FFFDF7', opacity: 1.0 },  // L4 — 1st magnitude (Sirius White)
    ],
  },
  text: {
    primary: '#E2E8F0',  // Moonlight
    secondary: '#94A3B8', // Star Dust
    accent: '#FBBF24',    // Solar Gold
  },
  background: {
    subtle: '#1E293B', // Night Grid lines
  },
};

// ── Light Mode Palette ─────────────────────────────────────────
// Designed for GitHub light background (#ffffff)
// Inverted magnitude scale: darker = brighter contribution

export const CONSTELLATION_LIGHT: ThemePalette = {
  contribution: {
    levels: [
      { hex: '#F1F5F9', opacity: 0.15 }, // L0 — empty sky (no star rendered)
      { hex: '#818CF8', opacity: 0.5 },   // L1 — 4th magnitude (Soft Indigo)
      { hex: '#4F46E5', opacity: 0.65 },  // L2 — 3rd magnitude (Indigo)
      { hex: '#3730A3', opacity: 0.8 },   // L3 — 2nd magnitude (Deep Indigo)
      { hex: '#1E1B4B', opacity: 1.0 },   // L4 — 1st magnitude (Midnight Core)
    ],
  },
  text: {
    primary: '#1E293B',  // Dark Slate
    secondary: '#64748B', // Mid Gray
    accent: '#2563EB',    // Deep Blue
  },
  background: {
    subtle: '#F1F5F9', // Light Grid lines
  },
};

// ── Constellation Line Color ───────────────────────────────────
// Stroke color for lines connecting consecutive contribution days

export const CONSTELLATION_LINE = { dark: '#94A3B8', light: '#CBD5E1' } as const;

// ── Star Glow Accent ───────────────────────────────────────────
// Glow effect color applied to L3/L4 magnitude stars

export const CONSTELLATION_GLOW = { dark: '#FBBF24', light: '#2563EB' } as const;
