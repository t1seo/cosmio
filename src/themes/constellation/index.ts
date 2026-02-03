import type { Theme, ContributionData, ThemeOptions, ThemeOutput, ColorMode } from '../../core/types.js';
import { svgRoot, svgDefs, svgStyle } from '../../core/svg.js';
import { computeStats } from '../../core/stats.js';
import { registerTheme } from '../registry.js';
import { renderTitle } from '../shared.js';
import { CONSTELLATION_DARK, CONSTELLATION_LIGHT } from './palette.js';
import { allConstellationFilters } from './filters.js';
import { renderConstellationStars, scintillationCSS, lensFlareCSS } from './stars.js';
import { renderConstellationLines, drawLineCSS } from './lines.js';
import { renderCelestialGrid, skyRotateCSS } from './grid.js';
import { renderConstellationStats, constellationStatsPulseCSS } from './stats.js';

// ── Theme Definition ────────────────────────────────────────────

const constellationTheme: Theme = {
  name: 'constellation',
  displayName: 'Constellation Chart',
  description: 'Your coding activity mapped as stars and constellations on a celestial chart',
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
 * 1. Defs (SVG filters for star glow)
 * 2. Style (CSS animations)
 * 3. Celestial grid (coordinate background)
 * 4. Constellation lines (connecting adjacent stars)
 * 5. Stars (contribution star field)
 * 6. Title (top-left text)
 * 7. Stats overlay (bottom bar)
 *
 * @param data - Contribution data with computed stats
 * @param options - Theme options (title, width, height)
 * @param mode - Color mode (dark or light)
 * @returns Complete SVG string
 */
function renderMode(data: ContributionData, options: ThemeOptions, mode: ColorMode): string {
  const palette = mode === 'dark' ? CONSTELLATION_DARK : CONSTELLATION_LIGHT;

  // Collect all CSS animations
  const css = [
    scintillationCSS(),
    lensFlareCSS(),
    drawLineCSS(),
    skyRotateCSS(),
    constellationStatsPulseCSS(),
  ].join('\n');

  // Collect all SVG filter/gradient definitions
  const defs = svgDefs(allConstellationFilters());

  // Build content layers (back to front)
  const content = [
    defs,
    svgStyle(css),
    renderCelestialGrid(data, mode),
    renderConstellationLines(data, mode),
    renderConstellationStars(data, mode),
    renderTitle(options.title, palette),
    renderConstellationStats(data.stats, mode),
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

registerTheme(constellationTheme);

// ── Export ───────────────────────────────────────────────────────

export { constellationTheme };
