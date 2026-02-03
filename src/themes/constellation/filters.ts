import { svgFilter } from '../../core/svg.js';

/**
 * SVG filter for L4 (1st magnitude) star glow.
 *
 * Two-pass Gaussian blur creates a bright inner core with a soft outer halo,
 * merged with the original source graphic to preserve the sharp star center.
 *
 * Filter region extends 100% in each direction to prevent clipping of the
 * wide blur radius on the cross-ray flare elements.
 *
 * @returns SVG filter element string with id="star-l4-glow"
 */
export function starL4GlowFilter(): string {
  const primitives = [
    `<feGaussianBlur in="SourceGraphic" stdDeviation="3" result="outerBlur"/>`,
    `<feGaussianBlur in="SourceGraphic" stdDeviation="1" result="innerBlur"/>`,
    `<feMerge>`,
    `<feMergeNode in="outerBlur"/>`,
    `<feMergeNode in="innerBlur"/>`,
    `<feMergeNode in="SourceGraphic"/>`,
    `</feMerge>`,
  ].join('');

  return svgFilter('star-l4-glow', primitives, {
    x: '-100%',
    y: '-100%',
    width: '300%',
    height: '300%',
  });
}

/**
 * SVG filter for L3 (2nd magnitude) star glow.
 *
 * Single-pass Gaussian blur merged with the source graphic for a moderate
 * luminous halo around 2nd-magnitude stars.
 *
 * @returns SVG filter element string with id="star-l3-glow"
 */
export function starL3GlowFilter(): string {
  const primitives = [
    `<feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur"/>`,
    `<feMerge>`,
    `<feMergeNode in="blur"/>`,
    `<feMergeNode in="SourceGraphic"/>`,
    `</feMerge>`,
  ].join('');

  return svgFilter('star-l3-glow', primitives);
}

/**
 * Concatenate all constellation SVG filter definitions into a single string,
 * ready to be wrapped in `<defs>`.
 *
 * @returns All constellation filter SVG definitions
 */
export function allConstellationFilters(): string {
  return [starL4GlowFilter(), starL3GlowFilter()].join('');
}
