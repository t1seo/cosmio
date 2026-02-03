import type { ColorMode, ContributionData } from '../../core/types.js';
import { svgElement, svgGroup } from '../../core/svg.js';
import { cssKeyframes } from '../../core/animation.js';

// ── Grid Layout Constants ────────────────────────────────────────

/** Cell size in the contribution grid (px) */
const CELL_SIZE = 10;

/** Gap between cells (px) */
const GAP = 2;

/** Horizontal offset for the grid area (px) */
const OFFSET_X = 24;

/** Vertical offset for the grid area (px) */
const OFFSET_Y = 40;

/** Spacing between grid lines: cellSize + gap */
const GRID_STEP = CELL_SIZE + GAP;

/** Number of day rows (Sunday through Saturday) */
const DAY_ROWS = 7;

/** Y-coordinate of the celestial equator (center of the 7-day grid) */
const EQUATOR_Y = OFFSET_Y + 3.5 * GRID_STEP; // ~82px

// ── Grid Line Styles ─────────────────────────────────────────────

const GRID_STROKE: Record<ColorMode, string> = {
  dark: '#1E293B',
  light: '#F1F5F9',
};

const GRID_OPACITY: Record<ColorMode, number> = {
  dark: 0.15,
  light: 0.08,
};

// ── Celestial Equator Styles ─────────────────────────────────────

const EQUATOR_STROKE: Record<ColorMode, string> = {
  dark: '#3B82F6',
  light: '#60A5FA',
};

const EQUATOR_OPACITY = 0.25;

// ── Grid Renderer ────────────────────────────────────────────────

/**
 * Render the celestial coordinate grid background.
 *
 * Produces a subtle grid of vertical (weekly) and horizontal (daily) lines
 * that evoke celestial coordinate markings, plus a dashed "celestial equator"
 * reference line crossing the horizontal center of the contribution area.
 *
 * The entire grid is wrapped in a `<g class="grid-layer">` element so the
 * slow sky-rotation CSS animation can target it.
 *
 * Grid geometry:
 * - Vertical lines: one per week boundary, spaced 12px apart
 * - Horizontal lines: one per day boundary (7 lines), spaced 12px apart
 * - Celestial equator: dashed line at the vertical midpoint (y ~82px)
 *
 * @param data - Contribution data (week count determines vertical line count)
 * @param mode - Color mode (dark or light)
 * @returns SVG `<g>` element string containing the celestial grid
 */
export function renderCelestialGrid(data: ContributionData, mode: ColorMode): string {
  const weekCount = data.weeks.length;
  const stroke = GRID_STROKE[mode];
  const opacity = GRID_OPACITY[mode];

  const lines: string[] = [];

  // ── Vertical lines (week boundaries) ──────────────────────────
  // One line at the left edge of each week column
  for (let w = 0; w <= weekCount; w++) {
    const x = OFFSET_X + w * GRID_STEP;
    lines.push(
      svgElement('line', {
        x1: x,
        y1: OFFSET_Y,
        x2: x,
        y2: OFFSET_Y + DAY_ROWS * GRID_STEP,
        stroke,
        'stroke-width': 0.3,
        opacity,
      }),
    );
  }

  // ── Horizontal lines (day boundaries) ─────────────────────────
  // One line at the top edge of each day row
  const gridWidth = weekCount * GRID_STEP;
  for (let d = 0; d <= DAY_ROWS; d++) {
    const y = OFFSET_Y + d * GRID_STEP;
    lines.push(
      svgElement('line', {
        x1: OFFSET_X,
        y1: y,
        x2: OFFSET_X + gridWidth,
        y2: y,
        stroke,
        'stroke-width': 0.3,
        opacity,
      }),
    );
  }

  // ── Celestial equator ─────────────────────────────────────────
  lines.push(
    svgElement('line', {
      x1: OFFSET_X,
      y1: EQUATOR_Y,
      x2: OFFSET_X + gridWidth,
      y2: EQUATOR_Y,
      stroke: EQUATOR_STROKE[mode],
      'stroke-width': 0.3,
      'stroke-dasharray': '8 4',
      opacity: EQUATOR_OPACITY,
    }),
  );

  return svgGroup({ class: 'grid-layer' }, lines.join(''));
}

// ── Sky Rotation CSS ─────────────────────────────────────────────

/**
 * Generate the CSS keyframes and class rule for the subtle sky-rotation
 * animation applied to the celestial grid.
 *
 * The animation oscillates between 0deg and 0.5deg rotation over 60 seconds,
 * creating a barely perceptible parallax drift that reinforces the
 * celestial-sphere aesthetic without distracting from the contribution data.
 *
 * Animation spec:
 * ```css
 * @keyframes sky-rotate {
 *   0%   { transform: rotate(0deg); }
 *   100% { transform: rotate(0.5deg); }
 * }
 * .grid-layer {
 *   transform-origin: center;
 *   animation: sky-rotate 60s linear infinite alternate;
 * }
 * ```
 *
 * @returns CSS string containing the @keyframes block and `.grid-layer` class
 */
export function skyRotateCSS(): string {
  const keyframesCSS = cssKeyframes({
    name: 'sky-rotate',
    keyframes: {
      '0%': { transform: 'rotate(0deg)' },
      '100%': { transform: 'rotate(0.5deg)' },
    },
    duration: '60s',
    easing: 'linear',
    iterationCount: 'infinite',
    fillMode: 'none',
  });

  // Override the generated class to use the correct selector and add
  // transform-origin + alternate direction (cssKeyframes doesn't support
  // the `direction` property, so we append a targeted rule).
  const layerRule = [
    '.grid-layer {',
    '  transform-origin: center;',
    '  animation: sky-rotate 60s linear infinite alternate;',
    '}',
  ].join(' ');

  return `${keyframesCSS}\n${layerRule}`;
}
