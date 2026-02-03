import type { ColorMode } from '../../core/types.js';
import { svgElement, svgGroup } from '../../core/svg.js';
import { cssKeyframes } from '../../core/animation.js';
import { seededRandom, hash } from '../../utils/math.js';
import { NEBULA_STAR } from './palette.js';

// ── Constants ───────────────────────────────────────────────────

/** Total number of star particles to render */
const STAR_COUNT = 70;

/** ViewBox dimensions */
const VIEW_WIDTH = 840;
const VIEW_HEIGHT = 240;

/** Star size range (px) */
const MIN_RADIUS = 0.25; // 0.5px diameter
const MAX_RADIUS = 1.0; // 2px diameter

/** Star opacity range */
const MIN_OPACITY = 0.3;
const MAX_OPACITY = 0.8;

/** Twinkle animation duration (seconds) */
const TWINKLE_DURATION = 3;

/** Maximum random animation delay per star (seconds) */
const MAX_DELAY = 3;

/**
 * Star color distribution by mode.
 * Dark: 80% primary (#FDE68A), 20% secondary (#FFFFFF)
 * Light: 60% primary (#D97706), 40% secondary (#A78BFA)
 */
const STAR_COLORS: Record<ColorMode, { primary: string; secondary: string; threshold: number }> = {
  dark: { primary: NEBULA_STAR.dark, secondary: '#FFFFFF', threshold: 0.8 },
  light: { primary: NEBULA_STAR.light, secondary: '#A78BFA', threshold: 0.6 },
};

// ── Star Renderer ───────────────────────────────────────────────

/**
 * Generate an SVG group of star circle elements for the nebula background.
 *
 * Stars are deterministically placed using a seeded PRNG derived from the
 * provided seed string. Same seed always produces the same star field.
 *
 * Each star is a `<circle>` with:
 * - Random position across the full 840x240 viewBox
 * - Random radius between 0.5px and 2px (diameter)
 * - Color chosen by weighted random (mode-dependent distribution)
 * - Random opacity between 0.3 and 0.8
 * - CSS class "star" with a random animation-delay for staggered twinkle
 *
 * @param mode - Color mode (dark or light)
 * @param seed - Seed string for deterministic star placement
 * @returns SVG `<g>` element string containing all star circles
 */
export function renderStars(mode: ColorMode, seed: string): string {
  const rng = seededRandom(hash(seed));
  const colors = STAR_COLORS[mode];

  const circles: string[] = [];

  for (let i = 0; i < STAR_COUNT; i++) {
    const cx = parseFloat((rng() * VIEW_WIDTH).toFixed(2));
    const cy = parseFloat((rng() * VIEW_HEIGHT).toFixed(2));
    const r = parseFloat((MIN_RADIUS + rng() * (MAX_RADIUS - MIN_RADIUS)).toFixed(3));
    const fill = rng() < colors.threshold ? colors.primary : colors.secondary;
    const opacity = parseFloat((MIN_OPACITY + rng() * (MAX_OPACITY - MIN_OPACITY)).toFixed(2));
    const delay = parseFloat((rng() * MAX_DELAY).toFixed(2));

    circles.push(
      svgElement('circle', {
        cx,
        cy,
        r,
        fill,
        opacity,
        class: 'star',
        style: `animation-delay: ${delay}s`,
      }),
    );
  }

  return svgGroup({ class: 'star-field' }, circles.join(''));
}

// ── Twinkle CSS ─────────────────────────────────────────────────

/**
 * Generate the CSS `@keyframes` rule and class for the star twinkle animation.
 *
 * The twinkle effect uses only opacity changes (no filters) for performance.
 * Individual star delays are set inline via `animation-delay` on each element,
 * so the class rule does not include a delay.
 *
 * Animation spec:
 * ```
 * @keyframes star-twinkle {
 *   0%, 100% { opacity: 0.3; }
 *   50%      { opacity: 0.9; }
 * }
 * .star-twinkle { animation: star-twinkle 3s ease-in-out infinite; }
 * ```
 *
 * @returns CSS string containing @keyframes block and `.star` class rule
 */
export function starTwinkleCSS(): string {
  const keyframesCSS = cssKeyframes({
    name: 'star-twinkle',
    keyframes: {
      '0%, 100%': { opacity: '0.3' },
      '50%': { opacity: '0.9' },
    },
    duration: `${TWINKLE_DURATION}s`,
    easing: 'ease-in-out',
    iterationCount: 'infinite',
  });

  // The cssKeyframes helper generates a class rule keyed to the animation name
  // (.star-twinkle), but our circles use class="star". Add a .star rule that
  // references the same animation so the inline animation-delay takes effect.
  const starRule = `.star { animation: star-twinkle ${TWINKLE_DURATION}s ease-in-out infinite; }`;

  return `${keyframesCSS}\n${starRule}`;
}
