import type { Theme, ContributionData, ThemeOptions, ThemeOutput, ColorMode } from '../../core/types.js';
import { svgRoot, svgDefs, svgStyle } from '../../core/svg.js';
import { computeStats } from '../../core/stats.js';
import { registerTheme } from '../registry.js';
import { renderTitle } from '../shared.js';
import { NEBULA_DARK, NEBULA_LIGHT } from './palette.js';
import { allNebulaFilters } from './filters.js';
import { renderStars, starTwinkleCSS } from './stars.js';
import { renderNebulaBody, nebulaBreathCSS } from './body.js';
import { renderFilaments, filamentDriftCSS } from './filaments.js';
import { renderNebulaStats, statsPulseCSS } from './stats.js';

// ── Theme Definition ────────────────────────────────────────────

const nebulaTheme: Theme = {
  name: 'nebula',
  displayName: 'Nebula Map',
  description: 'Your coding activity becomes the light of a cosmic nebula',
  render(data: ContributionData, options: ThemeOptions): ThemeOutput {
    // Compute stats from contribution data (fills in API placeholders)
    const stats = computeStats(data.weeks);
    const dataWithStats: ContributionData = { ...data, stats };

    // Render both color modes
    const dark = renderMode(dataWithStats, options, 'dark');
    const light = renderMode(dataWithStats, options, 'light');

    return { dark, light };
  },
};

// ── Mode Renderer ───────────────────────────────────────────────

/**
 * Compose all visual layers into a complete SVG for one color mode.
 *
 * Layer order (back to front):
 * 1. Stars (ambient background particles)
 * 2. Nebula body (main contribution visualization)
 * 3. Filaments (gas tendrils for atmosphere)
 * 4. Title (top-left text)
 * 5. Stats overlay (bottom bar)
 *
 * @param data - Contribution data with computed stats
 * @param options - Theme options (title, width, height)
 * @param mode - Color mode (dark or light)
 * @returns Complete SVG string
 */
function renderMode(data: ContributionData, options: ThemeOptions, mode: ColorMode): string {
  const palette = mode === 'dark' ? NEBULA_DARK : NEBULA_LIGHT;

  // Collect all CSS animations
  const css = [
    starTwinkleCSS(),
    nebulaBreathCSS(),
    filamentDriftCSS(),
    statsPulseCSS(),
  ].join('\n');

  // Collect all SVG filter/gradient definitions
  const defs = svgDefs(allNebulaFilters(mode));

  // Build content layers (back to front)
  const content = [
    svgStyle(css),
    defs,
    renderStars(mode, data.username),
    renderNebulaBody(data, mode),
    renderFilaments(mode, data.username),
    renderTitle(options.title, palette),
    renderNebulaStats(data.stats, mode),
  ].join('\n');

  // Wrap in root SVG — no background fill (transparent for GitHub embedding)
  return svgRoot(
    {
      width: options.width,
      height: options.height,
      viewBox: `0 0 ${options.width} ${options.height}`,
    },
    content,
  );
}

// ── Registration ────────────────────────────────────────────────

registerTheme(nebulaTheme);

// ── Export ───────────────────────────────────────────────────────

export { nebulaTheme };
