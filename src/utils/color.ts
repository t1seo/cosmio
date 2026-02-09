import { lerp, clamp } from './math.js';

/**
 * Parse a hex color string to RGB components.
 * @param hex - Hex color string (e.g., "#7C3AED" or "7C3AED")
 * @returns RGB object with r, g, b in 0-255 range
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  // Remove # if present
  const cleanHex = hex.replace(/^#/, '');

  // Parse hex string
  const num = parseInt(cleanHex, 16);

  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;

  return { r, g, b };
}

/**
 * Convert RGB components to hex color string.
 * @param r - Red component (0-255)
 * @param g - Green component (0-255)
 * @param b - Blue component (0-255)
 * @returns Hex color string (e.g., "#7C3AED")
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const rHex = Math.round(clamp(r, 0, 255))
    .toString(16)
    .padStart(2, '0');
  const gHex = Math.round(clamp(g, 0, 255))
    .toString(16)
    .padStart(2, '0');
  const bHex = Math.round(clamp(b, 0, 255))
    .toString(16)
    .padStart(2, '0');

  return `#${rHex}${gHex}${bHex}`;
}

/**
 * Add opacity to a hex color, returning an rgba() string.
 * @param hex - Hex color string (e.g., "#7C3AED")
 * @param opacity - Opacity value (0-1)
 * @returns RGBA string (e.g., "rgba(124, 58, 237, 0.5)")
 */
export function withOpacity(hex: string, opacity: number): string {
  const { r, g, b } = hexToRgb(hex);
  const alpha = clamp(opacity, 0, 1);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Interpolate between two hex colors.
 * @param colorA - First hex color (e.g., "#FF0000")
 * @param colorB - Second hex color (e.g., "#0000FF")
 * @param t - Interpolation factor (0-1)
 * @returns Interpolated hex color
 */
export function lerpColor(colorA: string, colorB: string, t: number): string {
  const rgbA = hexToRgb(colorA);
  const rgbB = hexToRgb(colorB);

  const r = lerp(rgbA.r, rgbB.r, t);
  const g = lerp(rgbA.g, rgbB.g, t);
  const b = lerp(rgbA.b, rgbB.b, t);

  return rgbToHex(r, g, b);
}
