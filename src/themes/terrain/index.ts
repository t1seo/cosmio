import type {
  Theme,
  ContributionData,
  ThemeOptions,
  ThemeOutput,
  ColorMode,
  ThemePalette,
  PaletteColor,
} from '../../core/types.js';
import { svgRoot, svgStyle } from '../../core/svg.js';
import { computeStats } from '../../core/stats.js';
import { registerTheme } from '../registry.js';
import { contributionGrid, enrichGridCells, renderTitle, renderStatsBar } from '../shared.js';
import { getTerrainPalette } from './palette.js';
import { renderTerrainBlocks, getIsoCells } from './blocks.js';
import { renderTerrainCSS, renderAnimatedOverlays, renderClouds } from './effects.js';
import { renderTerrainAssets, renderAssetCSS } from './assets.js';
import { hash } from '../../utils/math.js';

// ── Theme Definition ─────────────────────────────────────────

const terrainTheme: Theme = {
  name: 'terrain',
  displayName: 'Terrain',
  description: 'Your contributions build a living world — more code, richer civilization',
  render(data: ContributionData, options: ThemeOptions): ThemeOutput {
    const stats = computeStats(data.weeks);
    const dataWithStats: ContributionData = { ...data, stats };
    return {
      dark: renderMode(dataWithStats, options, 'dark'),
      light: renderMode(dataWithStats, options, 'light'),
    };
  },
};

// ── Mode Renderer ────────────────────────────────────────────

/**
 * Compose all visual layers into a complete SVG for one color mode.
 *
 * Layer order (back to front):
 * 1. Style (CSS animations)
 * 2. Clouds (behind terrain for depth)
 * 3. Terrain blocks (isometric 3D)
 * 4. Assets (trees, buildings, animals, ocean life)
 * 5. Animated overlays (water shimmer, snow sparkle)
 * 6. Title (top-left)
 * 7. Stats bar (bottom)
 */
function renderMode(
  data: ContributionData,
  options: ThemeOptions,
  mode: ColorMode,
): string {
  const palette = getTerrainPalette(mode);
  const seed = hash(data.username + mode);

  // Build grid cells with 10-level intensity
  const cells = contributionGrid(data, {
    cellSize: 11,
    gap: 2,
    offsetX: 24,
    offsetY: 42,
  });
  const cells10 = enrichGridCells(cells, data);

  // Compute isometric layout
  const originX = 268;
  const originY = 20;

  // Get isometric cells for effects and assets
  const isoCells = getIsoCells(cells10, palette, originX, originY);

  // Build layers
  const terrainCSS = renderTerrainCSS(isoCells);
  const assetCSS = renderAssetCSS();
  const css = terrainCSS + '\n' + assetCSS;

  const clouds = renderClouds(seed, palette);
  const blocks = renderTerrainBlocks(cells10, palette, originX, originY);
  const assets = renderTerrainAssets(isoCells, seed, palette);
  const overlays = renderAnimatedOverlays(isoCells, palette);

  // Build ThemePalette bridge for shared utilities
  const levelIndices = [0, 2, 4, 6, 8];
  const levelColors = levelIndices.map((i): PaletteColor => ({
    hex: palette.elevations[i].top,
    opacity: i === 0 ? 0.5 : 1,
  })) as [PaletteColor, PaletteColor, PaletteColor, PaletteColor, PaletteColor];

  const themePalette: ThemePalette = {
    text: palette.text,
    contribution: { levels: levelColors },
    background: palette.bg,
  };

  const title = renderTitle(options.title, themePalette);
  const statsBar = renderStatsBar(data.stats, themePalette);

  // Assemble
  const content = [
    svgStyle(css),
    clouds,
    blocks,
    assets,
    overlays,
    title,
    statsBar,
  ].join('\n');

  return svgRoot(
    { width: options.width, height: options.height },
    content,
  );
}

// ── Registration ─────────────────────────────────────────────

registerTheme(terrainTheme);
export { terrainTheme };
