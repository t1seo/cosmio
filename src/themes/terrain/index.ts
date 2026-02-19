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
import { contributionGrid, enrichGridCells100, renderTitle, renderStatsBar } from '../shared.js';
import { getSeasonalPalette100 } from './palette.js';
import { renderSeasonalTerrainBlocks, getIsoCells } from './blocks.js';
import {
  renderTerrainCSS,
  renderAnimatedOverlays,
  renderClouds,
  renderWaterOverlays,
  renderWaterRipples,
  renderCelestials,
  renderSnowParticles,
  renderFallingPetals,
  renderFallingLeaves,
} from './effects.js';
import { renderSeasonalTerrainAssets, renderAssetCSS } from './assets.js';
import { generateBiomeMap } from './biomes.js';
import { hash } from '../../utils/math.js';
import type { Hemisphere } from './seasons.js';
import { computeSeasonRotation } from './seasons.js';
import type { TerrainPalette100 } from './palette.js';

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
 * 2. Celestials (stars+moon or sun, deepest sky layer)
 * 3. Clouds (behind terrain for depth)
 * 4. Terrain blocks (isometric 3D, seasonally tinted)
 * 5. Water overlays (river/pond shimmer on blocks)
 * 6. Water ripples (static wavy lines on water surfaces)
 * 7. Assets (trees, buildings, animals — seasonal variants)
 * 8. Seasonal particles (snow, petals, leaves)
 * 9. Animated overlays (water shimmer, town sparkle)
 * 10. Title (top-left)
 * 11. Stats bar (bottom)
 */
function renderMode(data: ContributionData, options: ThemeOptions, mode: ColorMode): string {
  const hemisphere: Hemisphere = options.hemisphere || 'north';
  const density = options.density ?? 5;
  const oldestDate = new Date(data.weeks[0]?.days[0]?.date || new Date());
  const seasonRotation = computeSeasonRotation(oldestDate, hemisphere);
  const seed = hash(data.username + mode);
  const variantSeed = hash(data.username + String(data.year));

  // Build per-week seasonal palette array (52 weeks)
  const weekPalettes: TerrainPalette100[] = [];
  for (let w = 0; w < 52; w++) {
    weekPalettes.push(getSeasonalPalette100(mode, w, seasonRotation));
  }

  // Use mid-year (summer) palette as reference for shared utilities
  const palette = weekPalettes[26];

  // Build grid cells with 100-level intensity
  const cells = contributionGrid(data, {
    cellSize: 11,
    gap: 2,
    offsetX: 24,
    offsetY: 42,
  });
  const cells100 = enrichGridCells100(cells, data);

  // Compute isometric layout
  const originX = 405;
  const originY = 6;

  // Get isometric cells for effects and assets
  const isoCells = getIsoCells(cells100, palette, originX, originY);

  // Generate biome overlay (rivers, ponds, forests) with offset seed
  const biomeMap = generateBiomeMap(52, 7, seed + 7919);

  // Build layers
  const terrainCSS = renderTerrainCSS(isoCells, biomeMap);
  const assetCSS = renderAssetCSS();
  const css = terrainCSS + '\n' + assetCSS;

  const isDark = mode === 'dark';
  const celestials = renderCelestials(seed, palette, isDark);
  const clouds = renderClouds(seed, palette);

  // Use seasonal terrain blocks with per-week palettes
  const blocks = renderSeasonalTerrainBlocks(
    cells100,
    weekPalettes,
    originX,
    originY,
    seasonRotation,
    biomeMap,
  );

  const waterOverlays = renderWaterOverlays(isoCells, palette, biomeMap);
  const waterRipples = renderWaterRipples(isoCells, palette, biomeMap);

  // Use seasonal terrain assets with per-week palettes
  const assets = renderSeasonalTerrainAssets(
    isoCells,
    seed,
    weekPalettes,
    variantSeed,
    biomeMap,
    seasonRotation,
    density,
  );

  // Seasonal particle effects
  const snowParticles = renderSnowParticles(isoCells, seed, seasonRotation);
  const fallingPetals = renderFallingPetals(isoCells, seed, palette, seasonRotation);
  const fallingLeaves = renderFallingLeaves(isoCells, seed, palette, seasonRotation);

  const overlays = renderAnimatedOverlays(isoCells, palette);

  // Build ThemePalette bridge for shared utilities
  // Sample 5 anchor levels across the 100-level range
  const anchorLevels = [0, 20, 45, 70, 95];
  const levelColors = anchorLevels.map(
    (l): PaletteColor => ({
      hex: palette.getElevation(l).top,
      opacity: l === 0 ? 0.5 : 1,
    }),
  ) as [PaletteColor, PaletteColor, PaletteColor, PaletteColor, PaletteColor];

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
    celestials,
    clouds,
    blocks,
    waterOverlays,
    waterRipples,
    assets,
    snowParticles,
    fallingPetals,
    fallingLeaves,
    overlays,
    title,
    statsBar,
  ].join('\n');

  return svgRoot({ width: options.width, height: options.height }, content);
}

// ── Registration ─────────────────────────────────────────────

registerTheme(terrainTheme);
export { terrainTheme };
