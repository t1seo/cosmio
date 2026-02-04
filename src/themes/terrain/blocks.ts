import type { GridCell10 } from '../shared.js';
import type { TerrainPalette, ElevationColors } from './palette.js';

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
  /** 10-level intensity */
  level10: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  /** Block height in pixels */
  height: number;
  /** Screen X of the isometric diamond center (before elevation) */
  isoX: number;
  /** Screen Y of the isometric diamond center (before elevation) */
  isoY: number;
}

/**
 * Convert grid cells to isometric coordinates with elevation.
 * Cells are sorted in drawing order (back to front).
 */
export function toIsoCells(
  cells: GridCell10[],
  palette: TerrainPalette,
  originX: number,
  originY: number,
): IsoCell[] {
  // First pass: map grid positions to weeks/days
  // Grid cells come from contributionGrid with known layout:
  //   x = offsetX + week * (cellSize + gap)
  //   y = offsetY + day * (cellSize + gap)
  // We need to reverse-engineer week/day indices.
  // But it's simpler to compute from the cell's sequential position.

  const isoCells: IsoCell[] = [];
  let cellIndex = 0;

  // Determine number of weeks from the data
  const numWeeks = Math.ceil(cells.length / 7);

  for (let week = 0; week < numWeeks; week++) {
    for (let day = 0; day < 7; day++) {
      if (cellIndex >= cells.length) break;
      const cell = cells[cellIndex++];

      const isoX = originX + (week - day) * THW;
      const isoY = originY + (week + day) * THH;
      const height = palette.heights[cell.level10];

      isoCells.push({
        week,
        day,
        level10: cell.level10,
        height,
        isoX,
        isoY,
      });
    }
  }

  // Sort by drawing order: back to front
  // Higher (week + day) should be drawn later (in front)
  // Within same sum, higher week should be drawn later
  isoCells.sort((a, b) => {
    const sumA = a.week + a.day;
    const sumB = b.week + b.day;
    if (sumA !== sumB) return sumA - sumB;
    return a.week - b.week;
  });

  return isoCells;
}

// ── Block Rendering ──────────────────────────────────────────

/**
 * Render a single isometric block as 3 polygon faces.
 * Returns SVG string for the block.
 */
function renderBlock(cell: IsoCell, colors: ElevationColors): string {
  const { isoX: cx, isoY: cy, height: h } = cell;

  if (h === 0) {
    // Flat ocean tile — just the top diamond, no sides
    const topPoints = [
      `${cx},${cy - THH}`,      // top
      `${cx + THW},${cy}`,      // right
      `${cx},${cy + THH}`,      // bottom
      `${cx - THW},${cy}`,      // left
    ].join(' ');
    return `<polygon points="${topPoints}" fill="${colors.top}" stroke="${colors.left}" stroke-width="0.3"/>`;
  }

  const parts: string[] = [];

  // Left face (parallelogram)
  const leftPoints = [
    `${cx - THW},${cy}`,          // top-left of diamond
    `${cx},${cy + THH}`,          // bottom of diamond
    `${cx},${cy + THH + h}`,      // bottom of diamond + height
    `${cx - THW},${cy + h}`,      // top-left + height
  ].join(' ');
  parts.push(`<polygon points="${leftPoints}" fill="${colors.left}"/>`);

  // Right face (parallelogram)
  const rightPoints = [
    `${cx + THW},${cy}`,          // top-right of diamond
    `${cx},${cy + THH}`,          // bottom of diamond
    `${cx},${cy + THH + h}`,      // bottom + height
    `${cx + THW},${cy + h}`,      // top-right + height
  ].join(' ');
  parts.push(`<polygon points="${rightPoints}" fill="${colors.right}"/>`);

  // Top face (diamond) — drawn last so it's on top
  const topPoints = [
    `${cx},${cy - THH}`,          // top
    `${cx + THW},${cy}`,          // right
    `${cx},${cy + THH}`,          // bottom
    `${cx - THW},${cy}`,          // left
  ].join(' ');
  parts.push(`<polygon points="${topPoints}" fill="${colors.top}" stroke="${colors.left}" stroke-width="0.3"/>`);

  return parts.join('');
}

// ── Public API ───────────────────────────────────────────────

/**
 * Render all isometric terrain blocks.
 * @returns SVG group containing all blocks in correct drawing order
 */
export function renderTerrainBlocks(
  cells: GridCell10[],
  palette: TerrainPalette,
  originX: number,
  originY: number,
): string {
  const isoCells = toIsoCells(cells, palette, originX, originY);
  const blocks = isoCells.map(cell => {
    const colors = palette.elevations[cell.level10];
    return renderBlock(cell, colors);
  });
  return `<g class="terrain-blocks">${blocks.join('')}</g>`;
}

/**
 * Get the computed isometric cells (for use by effects.ts).
 */
export function getIsoCells(
  cells: GridCell10[],
  palette: TerrainPalette,
  originX: number,
  originY: number,
): IsoCell[] {
  return toIsoCells(cells, palette, originX, originY);
}

export { THW, THH };
