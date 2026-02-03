import type { ContributionData, ColorMode } from '../../core/types.js';
import { svgElement, svgGroup } from '../../core/svg.js';
import { cssKeyframes } from '../../core/animation.js';
import { hash } from '../../utils/math.js';
import { contributionGrid } from '../shared.js';
import { CONSTELLATION_DARK, CONSTELLATION_LIGHT } from './palette.js';

// ── Grid Layout ──────────────────────────────────────────────────

/** Cell size (px) for the constellation grid */
const CELL_SIZE = 10;

/** Gap between cells (px) */
const GAP = 2;

/** Horizontal offset from SVG left edge */
const OFFSET_X = 24;

/** Vertical offset from SVG top edge */
const OFFSET_Y = 40;

// ── Star Radii by Magnitude ─────────────────────────────────────

/** Star radius for each contribution level (L0 not rendered) */
const STAR_RADIUS: Record<1 | 2 | 3 | 4, number> = {
  1: 1.5,
  2: 2.0,
  3: 2.5,
  4: 3.5,
};

// ── L4 Cross-Ray Geometry ───────────────────────────────────────

/** Length of L4 lens-flare cross rays (px) */
const FLARE_LENGTH = 12;

/** Stroke width of cross rays (px) */
const FLARE_STROKE = 0.5;

/** Opacity of cross rays */
const FLARE_OPACITY = 0.4;

/** Ray angles in degrees: cardinal + diagonal */
const FLARE_ANGLES = [0, 90, 45, 135];

// ── Star Renderer ───────────────────────────────────────────────

/**
 * Render constellation stars from contribution data.
 *
 * Maps GitHub contribution levels to astronomical star magnitudes:
 * - L0: Empty sky (not rendered)
 * - L1: 4th magnitude, small dim circle
 * - L2: 3rd magnitude, medium circle
 * - L3: 2nd magnitude, circle with soft glow filter
 * - L4: 1st magnitude, large circle with bright glow and cross-ray flares
 *
 * Each star receives deterministic position jitter derived from its date,
 * ensuring identical output for the same input data.
 *
 * @param data - Complete contribution data for one year
 * @param mode - Color mode (dark or light)
 * @returns SVG `<g>` element string containing all star elements
 */
export function renderConstellationStars(data: ContributionData, mode: ColorMode): string {
  const palette = mode === 'dark' ? CONSTELLATION_DARK : CONSTELLATION_LIGHT;
  const cells = contributionGrid(data, {
    cellSize: CELL_SIZE,
    gap: GAP,
    offsetX: OFFSET_X,
    offsetY: OFFSET_Y,
  });

  const elements: string[] = [];

  for (const cell of cells) {
    if (cell.level === 0) {
      continue; // Empty sky — no star rendered
    }

    const level = cell.level;
    const color = palette.contribution.levels[level];
    const r = STAR_RADIUS[level];

    // Deterministic position jitter based on date hash
    const jitterX = (hash(cell.date) % 5) - 2;
    const jitterY = (hash(cell.date + 'y') % 5) - 2;
    const cx = parseFloat((cell.x + jitterX).toFixed(2));
    const cy = parseFloat((cell.y + jitterY).toFixed(2));

    // Build circle attributes
    const circleAttrs: Record<string, string | number> = {
      cx,
      cy,
      r,
      fill: color.hex,
      opacity: color.opacity,
      class: `star-l${level}`,
    };

    // Apply glow filters for brighter magnitudes
    if (level === 3) {
      circleAttrs.filter = 'url(#star-l3-glow)';
    } else if (level === 4) {
      circleAttrs.filter = 'url(#star-l4-glow)';
    }

    elements.push(svgElement('circle', circleAttrs));

    // L4 stars get cross-ray flares
    if (level === 4) {
      const halfLen = FLARE_LENGTH / 2;

      for (const angle of FLARE_ANGLES) {
        const rad = (angle * Math.PI) / 180;
        const dx = Math.cos(rad) * halfLen;
        const dy = Math.sin(rad) * halfLen;

        elements.push(
          svgElement('line', {
            x1: parseFloat((cx - dx).toFixed(2)),
            y1: parseFloat((cy - dy).toFixed(2)),
            x2: parseFloat((cx + dx).toFixed(2)),
            y2: parseFloat((cy + dy).toFixed(2)),
            stroke: color.hex,
            'stroke-width': FLARE_STROKE,
            opacity: FLARE_OPACITY,
            class: 'star-l4-flare',
          }),
        );
      }
    }
  }

  return svgGroup({ class: 'constellation-stars' }, elements.join(''));
}

// ── Scintillation CSS ───────────────────────────────────────────

/**
 * Generate CSS keyframes and class rules for star scintillation (twinkle).
 *
 * L1 through L3 stars have a subtle opacity flicker at different timings
 * to simulate atmospheric scintillation:
 * - L1: 3s cycle, opacity 0.4 -> 0.7
 * - L2: 3s cycle, opacity 0.6 -> 0.85
 * - L3: 3s cycle, opacity 0.75 -> 1.0
 *
 * @returns CSS string containing @keyframes blocks and class rules
 */
export function scintillationCSS(): string {
  const l1 = cssKeyframes({
    name: 'scintillate-l1',
    keyframes: {
      '0%, 100%': { opacity: '0.4' },
      '50%': { opacity: '0.7' },
    },
    duration: '3s',
    easing: 'ease-in-out',
    iterationCount: 'infinite',
  });

  const l2 = cssKeyframes({
    name: 'scintillate-l2',
    keyframes: {
      '0%, 100%': { opacity: '0.6' },
      '50%': { opacity: '0.85' },
    },
    duration: '3s',
    easing: 'ease-in-out',
    iterationCount: 'infinite',
    delay: '0.5s',
  });

  const l3 = cssKeyframes({
    name: 'scintillate-l3',
    keyframes: {
      '0%, 100%': { opacity: '0.75' },
      '50%': { opacity: '1.0' },
    },
    duration: '3s',
    easing: 'ease-in-out',
    iterationCount: 'infinite',
    delay: '1s',
  });

  // Map star classes to their scintillation animations
  const classRules = [
    `.star-l1 { animation: scintillate-l1 3s ease-in-out infinite; }`,
    `.star-l2 { animation: scintillate-l2 3s ease-in-out infinite 0.5s; }`,
    `.star-l3 { animation: scintillate-l3 3s ease-in-out infinite 1s; }`,
  ].join('\n');

  return [l1, l2, l3, classRules].join('\n');
}

// ── Lens Flare CSS ──────────────────────────────────────────────

/**
 * Generate CSS keyframes and class rule for L4 cross-ray rotation animation.
 *
 * The four flare lines slowly rotate 0 to 15 degrees over 6 seconds,
 * creating a subtle lens-flare shimmer on the brightest stars.
 * Uses `transform-origin: center` and `transform-box: fill-box` so the
 * rotation is relative to each flare line's own center.
 *
 * @returns CSS string containing @keyframes block and `.star-l4-flare` class rule
 */
export function lensFlareCSS(): string {
  const keyframes = cssKeyframes({
    name: 'lens-flare-rotate',
    keyframes: {
      '0%': { transform: 'rotate(0deg)' },
      '50%': { transform: 'rotate(15deg)' },
      '100%': { transform: 'rotate(0deg)' },
    },
    duration: '6s',
    easing: 'ease-in-out',
    iterationCount: 'infinite',
  });

  const flareRule = [
    `.star-l4-flare {`,
    `  animation: lens-flare-rotate 6s ease-in-out infinite;`,
    `  transform-origin: center;`,
    `  transform-box: fill-box;`,
    `}`,
  ].join('\n');

  return `${keyframes}\n${flareRule}`;
}
