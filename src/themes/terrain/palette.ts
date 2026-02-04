import type { ColorMode } from '../../core/types.js';

/** RGB color tuple */
type RGB = [number, number, number];

/** Colors for one elevation level: top face, left face, right face */
export interface ElevationColors {
  top: string;
  left: string;
  right: string;
}

/** Full terrain palette for one color mode */
export interface TerrainPalette {
  /** 10 elevation levels (index 0–9) */
  elevations: ElevationColors[];
  /** Block heights in pixels for each level (index 0–9) */
  heights: number[];
  /** Text colors */
  text: { primary: string; secondary: string; accent: string };
  /** Background hint */
  bg: { subtle: string };
  /** Cloud color */
  cloud: string;
  /** Asset colors for decorations */
  assets: AssetColors;
}

/** Colors used for terrain assets (trees, buildings, animals etc.) */
export interface AssetColors {
  trunk: string;
  pine: string;
  leaf: string;
  bush: string;
  roofA: string;
  roofB: string;
  wall: string;
  wallShade: string;
  church: string;
  fence: string;
  wheat: string;
  sheep: string;
  sheepHead: string;
  cow: string;
  cowSpot: string;
  chicken: string;
  whale: string;
  whaleBelly: string;
  boat: string;
  sail: string;
  fish: string;
  flag: string;
  windmill: string;
  windBlade: string;
  well: string;
  chimney: string;
  path: string;
  water: string;
  waterLight: string;
}

/** Darken an RGB color by a factor (0 = black, 1 = unchanged) */
function darken(rgb: RGB, factor: number): string {
  const r = Math.round(rgb[0] * factor);
  const g = Math.round(rgb[1] * factor);
  const b = Math.round(rgb[2] * factor);
  return `rgb(${r},${g},${b})`;
}

function rgbToHex(rgb: RGB): string {
  return '#' + rgb.map(c => c.toString(16).padStart(2, '0')).join('');
}

function makeElevation(rgb: RGB): ElevationColors {
  return {
    top: rgbToHex(rgb),
    left: darken(rgb, 0.75),
    right: darken(rgb, 0.60),
  };
}

// ── Dark Mode Colors ──────────────────────────────────────────
// Level 0 = ocean (no commits), Level 9 = thriving city (max commits)

const DARK_LEVELS: RGB[] = [
  [30, 70, 120],    // 0: Deep ocean — dark blue
  [50, 100, 155],   // 1: Shallow water — medium blue
  [140, 170, 100],  // 2: Shore/grass — pale yellow-green
  [80, 140, 55],    // 3: Grassland — green
  [50, 115, 40],    // 4: Forest — dark green
  [60, 120, 45],    // 5: Dense forest — deep green
  [145, 135, 70],   // 6: Farmland — golden
  [130, 115, 60],   // 7: Village outskirts — warm earth
  [120, 95, 55],    // 8: Town — brown
  [100, 80, 50],    // 9: City — dark earth (buildings on top)
];

// ── Light Mode Colors ─────────────────────────────────────────

const LIGHT_LEVELS: RGB[] = [
  [100, 155, 210],  // 0: Deep ocean
  [120, 175, 220],  // 1: Shallow water
  [165, 195, 120],  // 2: Shore/grass
  [105, 170, 75],   // 3: Grassland
  [75, 145, 60],    // 4: Forest
  [85, 150, 65],    // 5: Dense forest
  [175, 165, 90],   // 6: Farmland
  [160, 145, 80],   // 7: Village outskirts
  [145, 120, 75],   // 8: Town
  [125, 100, 65],   // 9: City
];

/** Block heights per level (pixels) — land gently rises, water is flat */
const HEIGHTS = [0, 0, 3, 5, 7, 9, 11, 14, 17, 20];

const DARK_ASSETS: AssetColors = {
  trunk: '#6b4226',
  pine: '#2a6e1e',
  leaf: '#3d8c2a',
  bush: '#357a22',
  roofA: '#c45435',
  roofB: '#d4924a',
  wall: '#d4c8a0',
  wallShade: '#b0a078',
  church: '#e0d8c0',
  fence: '#9e8a60',
  wheat: '#d4b840',
  sheep: '#e8e8e0',
  sheepHead: '#333',
  cow: '#8b5e3c',
  cowSpot: '#f5f0e0',
  chicken: '#d4a030',
  whale: '#4a7a9e',
  whaleBelly: '#8ab4c8',
  boat: '#8b6840',
  sail: '#e8e0d0',
  fish: '#70b0c8',
  flag: '#cc3333',
  windmill: '#c8b888',
  windBlade: '#d8d0b8',
  well: '#7a6a4a',
  chimney: '#8a6a4a',
  path: '#a09068',
  water: '#3a6a9e',
  waterLight: '#5a90be',
};

const LIGHT_ASSETS: AssetColors = {
  trunk: '#7a5030',
  pine: '#358025',
  leaf: '#4a9e35',
  bush: '#40882a',
  roofA: '#d05a3a',
  roofB: '#daa055',
  wall: '#f0e8d0',
  wallShade: '#d0c498',
  church: '#f0e8d8',
  fence: '#b09a68',
  wheat: '#dac040',
  sheep: '#f5f5f0',
  sheepHead: '#444',
  cow: '#9a6e45',
  cowSpot: '#fff',
  chicken: '#daa835',
  whale: '#4580aa',
  whaleBelly: '#90bcd0',
  boat: '#9a7848',
  sail: '#fff',
  fish: '#60a0b8',
  flag: '#dd3838',
  windmill: '#d8c898',
  windBlade: '#eee',
  well: '#8a7a55',
  chimney: '#9a7a55',
  path: '#b8a078',
  water: '#4578aa',
  waterLight: '#65a0cc',
};

export function getTerrainPalette(mode: ColorMode): TerrainPalette {
  const levels = mode === 'dark' ? DARK_LEVELS : LIGHT_LEVELS;
  return {
    elevations: levels.map(makeElevation),
    heights: HEIGHTS,
    text: mode === 'dark'
      ? { primary: '#e6edf3', secondary: '#8b949e', accent: '#58a6ff' }
      : { primary: '#1f2328', secondary: '#656d76', accent: '#0969da' },
    bg: { subtle: mode === 'dark' ? '#161b22' : '#f6f8fa' },
    cloud: mode === 'dark' ? 'rgba(200,210,220,0.10)' : 'rgba(255,255,255,0.45)',
    assets: mode === 'dark' ? DARK_ASSETS : LIGHT_ASSETS,
  };
}
