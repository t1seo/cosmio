import type { ContributionData, ContributionStats, ThemePalette } from '../core/types.js';
import { formatNumber } from '../core/svg.js';

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
    ` y="28"`,
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
        `<text`
        + ` x="${24 + i * 200}"`
        + ` y="224"`
        + ` font-family="${FONT_FAMILY}"`
        + ` font-size="11"`
        + ` fill="${palette.text.secondary}"`
        + `>${escapeXml(text)}</text>`,
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
