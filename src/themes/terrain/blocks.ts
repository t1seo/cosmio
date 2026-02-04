import type { GridCell100 } from '../shared.js';
import type { TerrainPalette100, ElevationColors } from './palette.js';
import type { BiomeContext } from './biomes.js';

// ── Isometric Constants ──────────────────────────────────────

/** Half-width of one isometric tile (x-axis) */
const THW = 7;
/** Half-height of one isometric tile (y-axis) */
const THH = 3;

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
  if (m && m.length >= 3) return [+m[0], +m[1], +m[2]];
  return [128, 128, 128];
}

function toHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(c => Math.round(c).toString(16).padStart(2, '0')).join('');
}

function toRgb(r: number, g: number, b: number): string {
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

/** Blend a color string toward a water blue target by strength (0-1) */
function blendColorTowardWater(color: string, waterRgb: [number, number, number], strength: number): string {
  const [r, g, b] = parseColor(color);
  const nr = r + (waterRgb[0] - r) * strength;
  const ng = g + (waterRgb[1] - g) * strength;
  const nb = b + (waterRgb[2] - b) * strength;
  return color.startsWith('#') ? toHex(nr, ng, nb) : toRgb(nr, ng, nb);
}

/** Blend an ElevationColors set toward water blue */
function blendWithWater(colors: ElevationColors, isDark: boolean): ElevationColors {
  const waterRgb: [number, number, number] = isDark ? [40, 80, 140] : [70, 140, 200];
  const strength = 0.35;
  return {
    top: blendColorTowardWater(colors.top, waterRgb, strength),
    left: blendColorTowardWater(colors.left, waterRgb, strength),
    right: blendColorTowardWater(colors.right, waterRgb, strength),
  };
}

// ── Block Rendering ──────────────────────────────────────────

function renderBlock(cell: IsoCell): string {
  const { isoX: cx, isoY: cy, height: h, colors } = cell;

  if (h === 0) {
    const topPoints = [
      `${cx},${cy - THH}`,
      `${cx + THW},${cy}`,
      `${cx},${cy + THH}`,
      `${cx - THW},${cy}`,
    ].join(' ');
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

  // Right face
  const rightPoints = [
    `${cx + THW},${cy}`,
    `${cx},${cy + THH}`,
    `${cx},${cy + THH + h}`,
    `${cx + THW},${cy + h}`,
  ].join(' ');
  parts.push(`<polygon points="${rightPoints}" fill="${colors.right}"/>`);

  // Top face (drawn last)
  const topPoints = [
    `${cx},${cy - THH}`,
    `${cx + THW},${cy}`,
    `${cx},${cy + THH}`,
    `${cx - THW},${cy}`,
  ].join(' ');
  parts.push(`<polygon points="${topPoints}" fill="${colors.top}" stroke="${colors.left}" stroke-width="0.3"/>`);

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
  const blocks = isoCells.map(cell => {
    if (biomeMap) {
      const biome = biomeMap.get(`${cell.week},${cell.day}`);
      if (biome && (biome.isRiver || biome.isPond)) {
        const blended = blendWithWater(cell.colors, isDark);
        return renderBlock({ ...cell, colors: blended });
      }
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

export { THW, THH };
