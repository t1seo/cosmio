import type { GridCell100 } from '../shared.js';
import type { TerrainPalette100, ElevationColors } from './palette.js';
import type { BiomeContext } from './biomes.js';
import { getSeasonZone } from './seasons.js';

// ── Isometric Constants ──────────────────────────────────────

/** Half-width of one isometric tile (x-axis) */
const THW = 8;
/** Half-height of one isometric tile (y-axis) */
const THH = 3.5;

// ── Isometric Projection ─────────────────────────────────────

export interface IsoCell {
  /** Grid week index (0–51) */
  week: number;
  /** Grid day index (0–6) */
  day: number;
  /** 100-level intensity (0–99) */
  level100: number;
  /** Block height in pixels */
  height: number;
  /** Screen X of the isometric diamond center */
  isoX: number;
  /** Screen Y of the isometric diamond center */
  isoY: number;
  /** Pre-computed elevation colors for this cell */
  colors: ElevationColors;
}

/**
 * Convert grid cells to isometric coordinates with elevation.
 * Cells are sorted in drawing order (back to front).
 */
export function toIsoCells(
  cells: GridCell100[],
  palette: TerrainPalette100,
  originX: number,
  originY: number,
): IsoCell[] {
  const isoCells: IsoCell[] = [];
  let cellIndex = 0;
  const numWeeks = Math.ceil(cells.length / 7);

  for (let week = 0; week < numWeeks; week++) {
    for (let day = 0; day < 7; day++) {
      if (cellIndex >= cells.length) break;
      const cell = cells[cellIndex++];

      const isoX = originX + (week - day) * THW;
      const isoY = originY + (week + day) * THH;
      const height = palette.getHeight(cell.level100);
      const colors = palette.getElevation(cell.level100);

      isoCells.push({
        week,
        day,
        level100: cell.level100,
        height,
        isoX,
        isoY,
        colors,
      });
    }
  }

  // Sort by drawing order: back to front
  isoCells.sort((a, b) => {
    const sumA = a.week + a.day;
    const sumB = b.week + b.day;
    if (sumA !== sumB) return sumA - sumB;
    return a.week - b.week;
  });

  return isoCells;
}

// ── Water Color Blending ─────────────────────────────────────

/** Parse a hex color like "#aabbcc" or "rgb(r,g,b)" to [r,g,b] */
function parseColor(color: string): [number, number, number] {
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ];
  }
  const m = color.match(/(\d+)/g);
  /* v8 ignore start */
  if (m && m.length >= 3) return [+m[0], +m[1], +m[2]];
  /* v8 ignore stop */
  /* v8 ignore start */
  return [128, 128, 128];
  /* v8 ignore stop */
}

function toHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('');
}

function toRgb(r: number, g: number, b: number): string {
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

/** Blend a color string toward a water blue target by strength (0-1) */
function blendColorTowardWater(
  color: string,
  waterRgb: [number, number, number],
  strength: number,
): string {
  const [r, g, b] = parseColor(color);
  const nr = r + (waterRgb[0] - r) * strength;
  const ng = g + (waterRgb[1] - g) * strength;
  const nb = b + (waterRgb[2] - b) * strength;
  return color.startsWith('#') ? toHex(nr, ng, nb) : toRgb(nr, ng, nb);
}

/** Get water blend strength based on level and type (6d: depth variation) */
function getWaterBlendStrength(level: number, isRiver: boolean): number {
  if (isRiver) return 0.4; // consistent river look
  if (level <= 14) return 0.25; // shallow: subtle blend (oasis/lagoon)
  return 0.45; // deep: strong blend (ocean depth)
}

/** Blend an ElevationColors set toward water blue */
function blendWithWater(
  colors: ElevationColors,
  isDark: boolean,
  level?: number,
  isRiver?: boolean,
): ElevationColors {
  const waterRgb: [number, number, number] = isDark ? [40, 80, 140] : [70, 140, 200];
  /* v8 ignore start */
  const strength = level !== undefined ? getWaterBlendStrength(level, !!isRiver) : 0.35;
  /* v8 ignore stop */
  return {
    top: blendColorTowardWater(colors.top, waterRgb, strength),
    left: blendColorTowardWater(colors.left, waterRgb, strength),
    right: blendColorTowardWater(colors.right, waterRgb, strength),
  };
}

// ── Block Rendering ──────────────────────────────────────────

function renderBlock(cell: IsoCell, isWater = false): string {
  const { isoX: cx, isoY: cy, height: h, colors } = cell;

  if (h === 0) {
    const topPoints = [
      `${cx},${cy - THH}`,
      `${cx + THW},${cy}`,
      `${cx},${cy + THH}`,
      `${cx - THW},${cy}`,
    ].join(' ');

    if (isWater) {
      // 6a: Multi-layer water surface — base, lighter inner diamond, specular highlight
      const inset = 1.5;
      const innerPoints = [
        `${cx},${cy - THH + inset}`,
        `${cx + THW - inset * 1.5},${cy}`,
        `${cx},${cy + THH - inset}`,
        `${cx - THW + inset * 1.5},${cy}`,
      ].join(' ');
      return (
        `<polygon points="${topPoints}" fill="${colors.top}" stroke="${colors.left}" stroke-width="0.3"/>` +
        `<polygon points="${innerPoints}" fill="${colors.top}" opacity="0.3" style="filter:brightness(1.3)"/>` +
        `<ellipse cx="${cx + 1}" cy="${cy - 0.5}" rx="1.5" ry="0.6" fill="#fff" opacity="0.15"/>`
      );
    }

    return `<polygon points="${topPoints}" fill="${colors.top}" stroke="${colors.left}" stroke-width="0.3"/>`;
  }

  const parts: string[] = [];

  // Left face
  const leftPoints = [
    `${cx - THW},${cy}`,
    `${cx},${cy + THH}`,
    `${cx},${cy + THH + h}`,
    `${cx - THW},${cy + h}`,
  ].join(' ');
  parts.push(`<polygon points="${leftPoints}" fill="${colors.left}"/>`);

  // 6e: Side face water tinting — gradient overlay for elevated water cells
  if (isWater && h > 0) {
    // Darker overlay at the bottom half of left face for water depth
    const midY = cy + THH + h * 0.5;
    const leftGradPoints = [
      `${cx - THW},${cy + h * 0.5}`,
      `${cx},${midY}`,
      `${cx},${cy + THH + h}`,
      `${cx - THW},${cy + h}`,
    ].join(' ');
    parts.push(`<polygon points="${leftGradPoints}" fill="#1a3a6a" opacity="0.15"/>`);
  }

  // Right face
  const rightPoints = [
    `${cx + THW},${cy}`,
    `${cx},${cy + THH}`,
    `${cx},${cy + THH + h}`,
    `${cx + THW},${cy + h}`,
  ].join(' ');
  parts.push(`<polygon points="${rightPoints}" fill="${colors.right}"/>`);

  if (isWater && h > 0) {
    const midY = cy + THH + h * 0.5;
    const rightGradPoints = [
      `${cx + THW},${cy + h * 0.5}`,
      `${cx},${midY}`,
      `${cx},${cy + THH + h}`,
      `${cx + THW},${cy + h}`,
    ].join(' ');
    parts.push(`<polygon points="${rightGradPoints}" fill="#1a3a6a" opacity="0.12"/>`);
  }

  // Top face (drawn last)
  const topPoints = [
    `${cx},${cy - THH}`,
    `${cx + THW},${cy}`,
    `${cx},${cy + THH}`,
    `${cx - THW},${cy}`,
  ].join(' ');

  if (isWater) {
    // 6a: Multi-layer water surface on elevated water blocks
    const inset = 1.5;
    const innerPoints = [
      `${cx},${cy - THH + inset}`,
      `${cx + THW - inset * 1.5},${cy}`,
      `${cx},${cy + THH - inset}`,
      `${cx - THW + inset * 1.5},${cy}`,
    ].join(' ');
    parts.push(
      `<polygon points="${topPoints}" fill="${colors.top}" stroke="${colors.left}" stroke-width="0.3"/>`,
    );
    parts.push(
      `<polygon points="${innerPoints}" fill="${colors.top}" opacity="0.3" style="filter:brightness(1.3)"/>`,
    );
    parts.push(
      `<ellipse cx="${cx + 1}" cy="${cy - 0.5}" rx="1.5" ry="0.6" fill="#fff" opacity="0.15"/>`,
    );
  } else {
    parts.push(
      `<polygon points="${topPoints}" fill="${colors.top}" stroke="${colors.left}" stroke-width="0.3"/>`,
    );
  }

  return parts.join('');
}

// ── Public API ───────────────────────────────────────────────

/**
 * Render all isometric terrain blocks.
 * When biomeMap is provided, river/pond cells get blue-tinted block colors.
 */
export function renderTerrainBlocks(
  cells: GridCell100[],
  palette: TerrainPalette100,
  originX: number,
  originY: number,
  biomeMap?: Map<string, BiomeContext>,
): string {
  const isoCells = toIsoCells(cells, palette, originX, originY);
  // Detect dark mode from palette text color
  const isDark = palette.text.primary.startsWith('#e');
  const blocks = isoCells.map((cell) => {
    if (biomeMap) {
      const biome = biomeMap.get(`${cell.week},${cell.day}`);
      if (biome && (biome.isRiver || biome.isPond)) {
        const blended = blendWithWater(cell.colors, isDark, cell.level100, biome.isRiver);
        return renderBlock({ ...cell, colors: blended }, true);
      }
    }
    // Natural water zone cells (levels 9-22) also get water treatment
    if (cell.level100 >= 9 && cell.level100 <= 22) {
      const blended = blendWithWater(cell.colors, isDark, cell.level100, false);
      return renderBlock({ ...cell, colors: blended }, true);
    }
    return renderBlock(cell);
  });
  return `<g class="terrain-blocks">${blocks.join('')}</g>`;
}

/**
 * Get the computed isometric cells (for use by effects and assets).
 */
export function getIsoCells(
  cells: GridCell100[],
  palette: TerrainPalette100,
  originX: number,
  originY: number,
): IsoCell[] {
  return toIsoCells(cells, palette, originX, originY);
}

/**
 * Render seasonal terrain blocks.
 * Uses per-week palettes for seasonal coloring.
 * Winter zones get frozen water (ice surface instead of blue).
 * All zones get seasonal tinting via their per-week palette.
 */
export function renderSeasonalTerrainBlocks(
  cells: GridCell100[],
  weekPalettes: TerrainPalette100[],
  originX: number,
  originY: number,
  seasonRotation: number,
  biomeMap?: Map<string, BiomeContext>,
): string {
  // Build isometric cells using a reference palette (week 26 = summer)
  // The actual colors will be overridden per-week
  /* v8 ignore start */
  const refPalette = weekPalettes[26] || weekPalettes[0];
  /* v8 ignore stop */
  const isoCells = toIsoCells(cells, refPalette, originX, originY);
  const isDark = refPalette.text.primary.startsWith('#e');

  const blocks = isoCells.map((cell) => {
    // Get the per-week palette for this cell
    const weekIdx = Math.min(cell.week, weekPalettes.length - 1);
    const weekPalette = weekPalettes[weekIdx];
    const zone = getSeasonZone(cell.week, seasonRotation);

    // Recompute colors using the week-specific palette
    const colors = weekPalette.getElevation(cell.level100);
    const height = weekPalette.getHeight(cell.level100);
    const tintedCell = { ...cell, colors, height };

    // Determine if this is a water cell
    const biome = biomeMap?.get(`${cell.week},${cell.day}`);
    const isNaturalWater = cell.level100 >= 9 && cell.level100 <= 22;
    const isBiomeWater = biome && (biome.isRiver || biome.isPond);

    if (isBiomeWater || isNaturalWater) {
      // Winter zones (0) and near-winter transitions (7, 1) get frozen water
      const isWinterish = zone === 0 || zone === 7 || zone === 1;
      if (isWinterish && isNaturalWater) {
        // Frozen: use ice-like colors from the tinted palette
        /* v8 ignore start */
        const iceColors: ElevationColors = {
          top: weekPalette.assets.ice || colors.top,
          left: weekPalette.assets.frozenWater || colors.left,
          right: weekPalette.assets.frozenWater || colors.right,
        };
        /* v8 ignore stop */
        return renderBlock({ ...tintedCell, colors: iceColors }, false);
      }
      // Non-winter water: blend with water as normal
      const blended = blendWithWater(colors, isDark, cell.level100, !!biome?.isRiver);
      return renderBlock({ ...tintedCell, colors: blended }, true);
    }

    return renderBlock(tintedCell);
  });

  return `<g class="terrain-blocks">${blocks.join('')}</g>`;
}

export { THW, THH };
