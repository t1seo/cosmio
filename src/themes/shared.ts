import type { ContributionData, ContributionStats, ThemePalette } from '../core/types.js';
import { formatNumber } from '../core/svg.js';
import { clamp } from '../utils/math.js';

/** 10-level intensity (0 = none, 9 = maximum) */
export type Level10 = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/** 100-level intensity (0 = none, 1–99 = min to max) */
export type Level100 = number;

/** A positioned contribution cell with 10-level intensity */
export interface GridCell10 extends GridCell {
  /** Fine-grained intensity level (0–9) */
  level10: Level10;
}

/** A positioned contribution cell with 100-level intensity */
export interface GridCell100 extends GridCell {
  /** Fine-grained intensity level (0–99) */
  level100: Level100;
}

/** System font stack confirmed working in SVG renderers */
const FONT_FAMILY = "'Segoe UI', system-ui, sans-serif";

/**
 * Render the SVG title text at the top-left of the card
 * @param title - Title text to display
 * @param palette - Theme color palette
 * @returns SVG text element string
 */
export function renderTitle(title: string, palette: ThemePalette): string {
  return [
    `<text`,
    ` x="24"`,
    ` y="17"`,
    ` font-family="${FONT_FAMILY}"`,
    ` font-size="14"`,
    ` fill="${palette.text.primary}"`,
    ` font-weight="600"`,
    `>${escapeXml(title)}</text>`,
  ].join('');
}

/**
 * Render the stats bar at the bottom of the card
 * @param stats - Computed contribution statistics
 * @param palette - Theme color palette
 * @returns SVG group element string containing stats
 */
export function renderStatsBar(stats: ContributionStats, palette: ThemePalette): string {
  const items = [
    `${formatNumber(stats.total)} contributions`,
    `${formatNumber(stats.currentStreak)}d current streak`,
    `${formatNumber(stats.longestStreak)}d longest streak`,
    `Most active: ${stats.mostActiveDay}`,
  ];

  const segments = items
    .map(
      (text, i) =>
        `<text` +
        ` x="${24 + i * 200}"` +
        ` y="233"` +
        ` font-family="${FONT_FAMILY}"` +
        ` font-size="11"` +
        ` fill="${palette.text.secondary}"` +
        `>${escapeXml(text)}</text>`,
    )
    .join('');

  return `<g class="stats-bar">${segments}</g>`;
}

/** A positioned contribution cell ready for rendering */
export interface GridCell {
  /** X coordinate */
  x: number;
  /** Y coordinate */
  y: number;
  /** Intensity level (0–4) */
  level: 0 | 1 | 2 | 3 | 4;
  /** Raw contribution count */
  count: number;
  /** ISO date string (YYYY-MM-DD) */
  date: string;
}

/**
 * Compute positioned grid cells from contribution data
 * @param data - Complete contribution data for one year
 * @param options - Layout configuration
 * @returns Flat array of positioned cells for themes to render
 */
export function contributionGrid(
  data: ContributionData,
  options: {
    cellSize: number;
    gap: number;
    offsetX: number;
    offsetY: number;
  },
): GridCell[] {
  const { cellSize, gap, offsetX, offsetY } = options;
  const cells: GridCell[] = [];

  for (let week = 0; week < data.weeks.length; week++) {
    const weekData = data.weeks[week];
    for (let day = 0; day < weekData.days.length; day++) {
      const dayData = weekData.days[day];
      cells.push({
        x: offsetX + week * (cellSize + gap),
        y: offsetY + day * (cellSize + gap),
        level: dayData.level,
        count: dayData.count,
        date: dayData.date,
      });
    }
  }

  return cells;
}

/**
 * Compute a fine-grained 10-level intensity from raw contribution count.
 * Level 0 = no contributions. Levels 1–9 are distributed using the ratio
 * of count to maxCount, with more granularity at lower levels where most data lives.
 * @param count - Raw contribution count for this day
 * @param maxCount - Maximum count across the entire year (for normalization)
 * @returns Level from 0–9
 */
export function computeLevel10(count: number, maxCount: number): Level10 {
  if (count === 0) return 0;
  if (maxCount <= 0) return 1;
  const ratio = clamp(count / maxCount, 0, 1);
  if (ratio <= 0.06) return 1;
  if (ratio <= 0.12) return 2;
  if (ratio <= 0.2) return 3;
  if (ratio <= 0.3) return 4;
  if (ratio <= 0.42) return 5;
  if (ratio <= 0.55) return 6;
  if (ratio <= 0.7) return 7;
  if (ratio <= 0.85) return 8;
  return 9;
}

/**
 * Enrich grid cells with 10-level intensity based on raw contribution counts.
 * @param cells - Positioned grid cells from contributionGrid()
 * @param data - Full contribution data (used to compute maxCount)
 * @returns New array of GridCell10 with level10 assigned
 */
export function enrichGridCells(cells: GridCell[], data: ContributionData): GridCell10[] {
  let maxCount = 0;
  for (const week of data.weeks) {
    for (const day of week.days) {
      if (day.count > maxCount) maxCount = day.count;
    }
  }

  return cells.map((cell) => ({
    ...cell,
    level10: computeLevel10(cell.count, maxCount),
  }));
}

/**
 * Compute a fine-grained 100-level intensity from raw contribution count.
 * Level 0 = no contributions. Levels 1–99 use a sqrt curve for a balanced
 * distribution that lets moderate activity reach village/city levels.
 * The effectiveMax should be the P90 of non-zero counts to prevent
 * outlier days from compressing the entire range.
 */
export function computeLevel100(count: number, maxCount: number): Level100 {
  if (count === 0) return 0;
  if (maxCount <= 0) return 1;
  const ratio = clamp(count / maxCount, 0, 1);
  const curved = Math.sqrt(ratio);
  return clamp(Math.round(curved * 98) + 1, 1, 99);
}

/**
 * Enrich grid cells with 100-level intensity based on raw contribution counts.
 * Uses the P90 of non-zero counts as the effective max, so outlier days
 * don't compress the entire range into low levels.
 */
export function enrichGridCells100(cells: GridCell[], data: ContributionData): GridCell100[] {
  const nonZeroCounts: number[] = [];
  for (const week of data.weeks) {
    for (const day of week.days) {
      if (day.count > 0) nonZeroCounts.push(day.count);
    }
  }

  // P90 of non-zero counts — outliers above this cap at level 99
  nonZeroCounts.sort((a, b) => a - b);
  const p90Index = Math.floor(nonZeroCounts.length * 0.9);
  const effectiveMax =
    nonZeroCounts.length > 0 ? nonZeroCounts[Math.min(p90Index, nonZeroCounts.length - 1)] : 1;

  return cells.map((cell) => ({
    ...cell,
    level100: computeLevel100(cell.count, effectiveMax),
  }));
}

/**
 * Escape special XML characters in text content
 * @param str - String to escape
 * @returns XML-safe string
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
