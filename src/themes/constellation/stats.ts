import type { ContributionStats, ColorMode, ThemePalette } from '../../core/types.js';
import { svgElement, svgGroup, svgText, formatNumber } from '../../core/svg.js';
import { cssKeyframes } from '../../core/animation.js';
import { CONSTELLATION_DARK, CONSTELLATION_LIGHT } from './palette.js';

// ── Constants ───────────────────────────────────────────────────

/** Font family used for all stats text */
const FONT_FAMILY = "'Segoe UI', system-ui, sans-serif";

/** Font size for stat values (px) */
const VALUE_FONT_SIZE = 13;

/** Font size for stat labels (px) */
const LABEL_FONT_SIZE = 10;

/** X positions for each of the four stat items */
const STAT_X_POSITIONS = [24, 230, 436, 642] as const;

/** Y position for stat value text */
const VALUE_Y = 224;

/** Y position for stat label text */
const LABEL_Y = 224;

/** Y position for stat icons */
const ICON_Y = 218;

// ── Icon Builders ───────────────────────────────────────────────

/**
 * Star chart icon — a small four-point star with radiating dots.
 * Used for the "total contributions" stat. Rendered in gold/accent.
 */
function starChartIcon(x: number, y: number, palette: ThemePalette): string {
  const fill = palette.text.accent;

  return svgGroup({ transform: `translate(${x}, ${y})` }, [
    // Central four-point star
    svgElement('path', {
      d: 'M0,-4 L1,-1 L4,0 L1,1 L0,4 L-1,1 L-4,0 L-1,-1 Z',
      fill,
      opacity: 0.9,
    }),
    // Surrounding dots (chart feel)
    svgElement('circle', { cx: 3, cy: -3, r: 0.8, fill, opacity: 0.5 }),
    svgElement('circle', { cx: -3, cy: 2, r: 0.6, fill, opacity: 0.4 }),
  ].join(''));
}

/**
 * Three-star pattern icon — three stars of diminishing size in a row.
 * Used for the "longest streak" stat.
 */
function threeStarIcon(x: number, y: number, palette: ThemePalette): string {
  const fill = palette.contribution.levels[3].hex;

  return svgGroup({ transform: `translate(${x}, ${y})` }, [
    // Large star
    svgElement('path', {
      d: 'M-4,0 L-3.3,-0.7 L-4,-1.4 L-3.3,-0.7 L-2.6,-1.4 L-3.3,-0.7 L-2.6,0 L-3.3,-0.7 Z',
      fill,
      opacity: 0.9,
    }),
    svgElement('circle', { cx: -3.3, cy: -0.7, r: 1.2, fill, opacity: 0.9 }),
    // Medium star
    svgElement('circle', { cx: 0, cy: 0, r: 0.9, fill, opacity: 0.7 }),
    // Small star
    svgElement('circle', { cx: 3, cy: 0.5, r: 0.6, fill, opacity: 0.5 }),
    // Connecting lines
    svgElement('line', {
      x1: -2.1, y1: -0.4, x2: -0.9, y2: -0.1,
      stroke: fill, 'stroke-width': 0.4, opacity: 0.3,
    }),
    svgElement('line', {
      x1: 0.9, y1: 0.1, x2: 2.4, y2: 0.4,
      stroke: fill, 'stroke-width': 0.4, opacity: 0.3,
    }),
  ].join(''));
}

/**
 * Bright star with glow icon — a large star circle with a glow halo.
 * Used for the "most active day" stat.
 */
function brightStarIcon(x: number, y: number, palette: ThemePalette): string {
  const fill = palette.contribution.levels[4].hex;
  const glow = palette.contribution.levels[3].hex;

  return svgGroup({ transform: `translate(${x}, ${y})` }, [
    // Glow halo
    svgElement('circle', { cx: 0, cy: 0, r: 5, fill: glow, opacity: 0.2 }),
    // Core star
    svgElement('circle', { cx: 0, cy: 0, r: 2.5, fill, opacity: 0.95 }),
    // Cross rays
    svgElement('line', {
      x1: 0, y1: -4.5, x2: 0, y2: 4.5,
      stroke: fill, 'stroke-width': 0.4, opacity: 0.4,
    }),
    svgElement('line', {
      x1: -4.5, y1: 0, x2: 4.5, y2: 0,
      stroke: fill, 'stroke-width': 0.4, opacity: 0.4,
    }),
  ].join(''));
}

/**
 * Blinking cursor star icon — a small star with the `constellation-stat-pulse` animation class.
 * Used for the "current streak" stat.
 */
function cursorStarIcon(x: number, y: number, palette: ThemePalette): string {
  const fill = palette.text.accent;

  return svgGroup({ transform: `translate(${x}, ${y})` }, [
    svgElement('path', {
      d: 'M0,-3 L0.8,-0.8 L3,0 L0.8,0.8 L0,3 L-0.8,0.8 L-3,0 L-0.8,-0.8 Z',
      fill,
      opacity: 0.9,
      class: 'constellation-stat-pulse',
    }),
  ].join(''));
}

// ── Stat Item Builder ───────────────────────────────────────────

/**
 * Render a single stat item with icon, value, and label.
 * Layout: [icon 8px gap] [value] [4px gap] [label]
 */
function statItem(
  x: number,
  icon: string,
  value: string,
  label: string,
  palette: ThemePalette,
): string {
  const valueEl = svgText(x + 12, VALUE_Y, value, {
    fill: palette.text.accent,
    'font-family': FONT_FAMILY,
    'font-size': VALUE_FONT_SIZE,
    'font-weight': 600,
  });

  // Approximate value width: ~7.5px per character at font-size 13
  const valueWidth = value.length * 7.5;

  const labelEl = svgText(x + 12 + valueWidth + 4, LABEL_Y, label, {
    fill: palette.text.secondary,
    'font-family': FONT_FAMILY,
    'font-size': LABEL_FONT_SIZE,
  });

  return `${icon}${valueEl}${labelEl}`;
}

// ── Public API ──────────────────────────────────────────────────

/**
 * Render the stats bar overlay at the bottom of the Constellation SVG.
 *
 * Displays four stat items across the bottom of the 840x240 viewBox:
 * 1. Total contributions (star chart icon, gold)
 * 2. Longest streak (three-star pattern icon)
 * 3. Most active day (bright star with glow icon)
 * 4. Current streak (blinking cursor star)
 *
 * @param stats - Computed contribution statistics
 * @param mode - Color mode (dark or light)
 * @returns SVG group string containing the stats overlay
 */
export function renderConstellationStats(stats: ContributionStats, mode: ColorMode): string {
  const palette = mode === 'dark' ? CONSTELLATION_DARK : CONSTELLATION_LIGHT;

  const items: string[] = [
    // Total contributions
    statItem(
      STAT_X_POSITIONS[0],
      starChartIcon(STAT_X_POSITIONS[0] + 4, ICON_Y, palette),
      formatNumber(stats.total),
      'contributions',
      palette,
    ),
    // Longest streak
    statItem(
      STAT_X_POSITIONS[1],
      threeStarIcon(STAT_X_POSITIONS[1] + 4, ICON_Y, palette),
      String(stats.longestStreak),
      'day streak',
      palette,
    ),
    // Most active day
    statItem(
      STAT_X_POSITIONS[2],
      brightStarIcon(STAT_X_POSITIONS[2] + 4, ICON_Y, palette),
      stats.mostActiveDay,
      '',
      palette,
    ),
    // Current streak
    statItem(
      STAT_X_POSITIONS[3],
      cursorStarIcon(STAT_X_POSITIONS[3] + 4, ICON_Y, palette),
      String(stats.currentStreak),
      'current',
      palette,
    ),
  ];

  return svgGroup({ class: 'constellation-stats' }, items.join(''));
}

/**
 * Generate the CSS for the pulsing current-streak cursor star animation.
 *
 * Animation spec:
 * ```
 * @keyframes constellation-stat-pulse {
 *   0%, 100% { opacity: 0.5; transform: scale(0.85); }
 *   50%      { opacity: 1; transform: scale(1.15); }
 * }
 * .constellation-stat-pulse {
 *   animation: constellation-stat-pulse 2s ease-in-out infinite;
 *   transform-origin: center;
 *   transform-box: fill-box;
 * }
 * ```
 *
 * @returns CSS string containing @keyframes block and `.constellation-stat-pulse` class rule
 */
export function constellationStatsPulseCSS(): string {
  const keyframesCSS = cssKeyframes({
    name: 'constellation-stat-pulse',
    keyframes: {
      '0%, 100%': { opacity: '0.5', transform: 'scale(0.85)' },
      '50%': { opacity: '1', transform: 'scale(1.15)' },
    },
    duration: '2s',
    easing: 'ease-in-out',
    iterationCount: 'infinite',
  });

  // Override the generated class to add transform-origin and transform-box
  const overrideRule = [
    '.constellation-stat-pulse {',
    '  animation: constellation-stat-pulse 2s ease-in-out infinite;',
    '  transform-origin: center;',
    '  transform-box: fill-box;',
    '}',
  ].join('\n');

  return `${keyframesCSS}\n${overrideRule}`;
}
