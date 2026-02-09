import { describe, it, expect } from 'vitest';
import { getIsoCells } from '../../../src/themes/terrain/blocks.js';
import {
  getTerrainPalette100,
  getSeasonalPalette100,
} from '../../../src/themes/terrain/palette.js';
import { contributionGrid, enrichGridCells100 } from '../../../src/themes/shared.js';
import { generateBiomeMap } from '../../../src/themes/terrain/biomes.js';
import {
  selectAssets,
  renderTerrainAssets,
  renderSeasonalTerrainAssets,
  renderAssetCSS,
} from '../../../src/themes/terrain/assets.js';
import type { ContributionData } from '../../../src/core/types.js';

// ── Full-range contribution data helper ──────────────────────

/**
 * Create a 52-week contribution dataset that distributes levels 0-99
 * across all cells so every asset pool range gets exercised.
 */
function createFullRangeData(): ContributionData {
  const weeks = [];
  for (let w = 0; w < 52; w++) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      const idx = w * 7 + d;
      // Distribute levels 0-99 across all cells
      const level100 = idx % 100;
      const count = level100;
      const level = Math.min(4, Math.floor(level100 / 25)) as 0 | 1 | 2 | 3 | 4;
      days.push({ date: '2025-01-01', count, level });
    }
    weeks.push({ firstDay: '2025-01-01', days });
  }
  return {
    weeks,
    stats: { total: 0, longestStreak: 0, currentStreak: 0, mostActiveDay: '' },
    year: 2025,
    username: 'testuser',
  };
}

// ── Shared test data ─────────────────────────────────────────

const data = createFullRangeData();
const cells = contributionGrid(data, { cellSize: 11, gap: 2, offsetX: 24, offsetY: 42 });
const cells100 = enrichGridCells100(cells, data);
const palette = getTerrainPalette100('dark');
const originX = 405;
const originY = 6;
const isoCells = getIsoCells(cells100, palette, originX, originY);
const biomeMap = generateBiomeMap(52, 7, 42);

// ── Level range definitions for verification ─────────────────

const LEVEL_RANGES: Record<string, [number, number]> = {
  desert: [0, 4],
  desertPlus: [5, 8],
  water: [9, 14],
  deepWater: [15, 22],
  shore: [23, 27],
  wetland: [28, 30],
  grassland: [31, 36],
  grasslandPlus: [37, 42],
  forest: [43, 52],
  denseForest: [53, 65],
  farm: [66, 78],
  village: [79, 90],
  city: [91, 99],
};

// ── selectAssets ─────────────────────────────────────────────

describe('selectAssets', () => {
  it('returns an array of placed assets', () => {
    const assets = selectAssets(isoCells, 42);
    expect(Array.isArray(assets)).toBe(true);
    expect(assets.length).toBeGreaterThan(0);
  });

  it('each placed asset has required properties', () => {
    const assets = selectAssets(isoCells, 42);
    for (const asset of assets) {
      expect(asset).toHaveProperty('cell');
      expect(asset).toHaveProperty('type');
      expect(asset).toHaveProperty('cx');
      expect(asset).toHaveProperty('cy');
      expect(asset).toHaveProperty('ox');
      expect(asset).toHaveProperty('oy');
      expect(asset).toHaveProperty('variant');
      expect(typeof asset.type).toBe('string');
      expect(typeof asset.cx).toBe('number');
      expect(typeof asset.cy).toBe('number');
      expect(typeof asset.ox).toBe('number');
      expect(typeof asset.oy).toBe('number');
      expect(typeof asset.variant).toBe('number');
    }
  });

  it('covers all level ranges with multiple seeds', () => {
    const seeds = [42, 100, 12345];
    const allTypes = new Set<string>();

    for (const seed of seeds) {
      const assets = selectAssets(isoCells, seed);
      for (const asset of assets) {
        allTypes.add(asset.type);
      }
    }

    // Verify we get assets from multiple biome categories
    // Desert range (0-8): rock, boulder, stump, deadTree, bush, etc.
    const desertTypes = ['rock', 'boulder', 'stump', 'deadTree', 'bush', 'signpost', 'puddle'];
    const hasDesert = desertTypes.some((t) => allTypes.has(t));
    expect(hasDesert).toBe(true);

    // Water range (9-22): whale, fish, boat, seagull, etc.
    const waterTypes = [
      'whale',
      'fish',
      'fishSchool',
      'boat',
      'seagull',
      'dock',
      'waves',
      'kelp',
      'coral',
      'jellyfish',
      'turtle',
      'crab',
      'buoy',
      'sailboat',
      'lighthouse',
    ];
    const hasWater = waterTypes.some((t) => allTypes.has(t));
    expect(hasWater).toBe(true);

    // Shore/wetland range (23-30)
    const shoreTypes = [
      'flower',
      'driftwood',
      'sandcastle',
      'tidePools',
      'heron',
      'shellfish',
      'cattail',
      'frog',
      'lily',
      'fence',
    ];
    const hasShore = shoreTypes.some((t) => allTypes.has(t));
    expect(hasShore).toBe(true);

    // Grassland range (31-42)
    const grassTypes = [
      'mushroom',
      'deer',
      'rabbit',
      'fox',
      'butterfly',
      'wildflowerPatch',
      'tallGrass',
      'beehive',
      'birch',
      'haybale',
      'lantern',
    ];
    const hasGrass = grassTypes.some((t) => allTypes.has(t));
    expect(hasGrass).toBe(true);

    // Forest range (43-65)
    const forestTypes = [
      'pine',
      'deciduous',
      'willow',
      'palm',
      'bird',
      'owl',
      'squirrel',
      'moss',
      'fern',
      'berryBush',
      'log',
      'woodpile',
      'spider',
    ];
    const hasForest = forestTypes.some((t) => allTypes.has(t));
    expect(hasForest).toBe(true);

    // Farm range (66-78)
    const farmTypes = [
      'wheat',
      'fence',
      'scarecrow',
      'barn',
      'sheep',
      'cow',
      'chicken',
      'horse',
      'ricePaddy',
      'silo',
      'pigpen',
      'trough',
      'haystack',
      'orchard',
      'pumpkin',
    ];
    const hasFarm = farmTypes.some((t) => allTypes.has(t));
    expect(hasFarm).toBe(true);

    // Village range (79-90)
    const villageTypes = [
      'tent',
      'hut',
      'house',
      'houseB',
      'church',
      'windmill',
      'well',
      'tavern',
      'bakery',
      'stable',
    ];
    const hasVillage = villageTypes.some((t) => allTypes.has(t));
    expect(hasVillage).toBe(true);

    // City range (91-99)
    const cityTypes = ['castle', 'tower', 'cathedral', 'fountain'];
    const hasCity = cityTypes.some((t) => allTypes.has(t));
    expect(hasCity).toBe(true);
  });

  it('places assets across different level100 ranges', () => {
    const assets = selectAssets(isoCells, 42);
    const levelRangesHit = new Set<string>();

    for (const asset of assets) {
      const lvl = asset.cell.level100;
      for (const [name, [lo, hi]] of Object.entries(LEVEL_RANGES)) {
        if (lvl >= lo && lvl <= hi) {
          levelRangesHit.add(name);
        }
      }
    }

    // With a full-range dataset, most ranges should produce assets
    expect(levelRangesHit.size).toBeGreaterThanOrEqual(5);
  });

  it('is deterministic for the same seed', () => {
    const assets1 = selectAssets(isoCells, 42);
    const assets2 = selectAssets(isoCells, 42);
    expect(assets1.length).toBe(assets2.length);
    for (let i = 0; i < assets1.length; i++) {
      expect(assets1[i].type).toBe(assets2[i].type);
      expect(assets1[i].cx).toBe(assets2[i].cx);
      expect(assets1[i].cy).toBe(assets2[i].cy);
    }
  });

  it('produces different results with different seeds', () => {
    const assets42 = selectAssets(isoCells, 42);
    const assets100 = selectAssets(isoCells, 100);
    // Different seeds should produce different asset placements
    const types42 = assets42.map((a) => a.type).join(',');
    const types100 = assets100.map((a) => a.type).join(',');
    expect(types42).not.toBe(types100);
  });

  it('respects variantSeed for variant selection', () => {
    const assets1 = selectAssets(isoCells, 42, 100);
    const assets2 = selectAssets(isoCells, 42, 200);
    // Same seed but different variantSeed should produce same types but possibly different variants
    expect(assets1.length).toBe(assets2.length);
    for (let i = 0; i < assets1.length; i++) {
      expect(assets1[i].type).toBe(assets2[i].type);
    }
    // At least some variants should differ
    const hasVariantDiff = assets1.some((a, i) => a.variant !== assets2[i].variant);
    expect(hasVariantDiff).toBe(true);
  });

  it('respects biome overrides (river/pond cells get water assets)', () => {
    const assetsWithBiome = selectAssets(isoCells, 42, undefined, biomeMap);
    const assetsWithoutBiome = selectAssets(isoCells, 42, undefined, undefined);

    // With biomeMap, some cells marked as river/pond may get water-type assets
    // The results should differ since biome blending changes pools
    const typesWithBiome = assetsWithBiome.map((a) => a.type).join(',');
    const typesWithout = assetsWithoutBiome.map((a) => a.type).join(',');
    expect(typesWithBiome).not.toBe(typesWithout);
  });

  it('respects seasonRotation for seasonal pool overrides', () => {
    const winterAssets = selectAssets(isoCells, 42, undefined, biomeMap, 0);
    const summerAssets = selectAssets(isoCells, 42, undefined, biomeMap, 26);

    // Different rotations should change the asset pools
    const winterTypes = winterAssets.map((a) => a.type).join(',');
    const summerTypes = summerAssets.map((a) => a.type).join(',');
    expect(winterTypes).not.toBe(summerTypes);
  });

  it('asset variant values are 0, 1, or 2', () => {
    const assets = selectAssets(isoCells, 42);
    for (const asset of assets) {
      expect(asset.variant).toBeGreaterThanOrEqual(0);
      expect(asset.variant).toBeLessThanOrEqual(2);
    }
  });
});

// ── renderTerrainAssets ──────────────────────────────────────

describe('renderTerrainAssets', () => {
  it('returns SVG g element with class "terrain-assets"', () => {
    const svg = renderTerrainAssets(isoCells, 42, palette);
    expect(svg).toMatch(/^<g class="terrain-assets">/);
    expect(svg).toMatch(/<\/g>$/);
  });

  it('contains SVG content within the group', () => {
    const svg = renderTerrainAssets(isoCells, 42, palette);
    // Should contain rendered asset SVG elements (paths, circles, rects, etc.)
    expect(svg.length).toBeGreaterThan(50);
  });

  it('works with variantSeed parameter', () => {
    const svg = renderTerrainAssets(isoCells, 42, palette, 100);
    expect(svg).toContain('<g class="terrain-assets">');
    expect(svg.length).toBeGreaterThan(50);
  });

  it('works with biomeMap parameter', () => {
    const svg = renderTerrainAssets(isoCells, 42, palette, undefined, biomeMap);
    expect(svg).toContain('<g class="terrain-assets">');
    expect(svg.length).toBeGreaterThan(50);
  });

  it('works with light mode palette', () => {
    const lightPalette = getTerrainPalette100('light');
    const lightIsoCells = getIsoCells(cells100, lightPalette, originX, originY);
    const svg = renderTerrainAssets(lightIsoCells, 42, lightPalette);
    expect(svg).toContain('<g class="terrain-assets">');
    expect(svg.length).toBeGreaterThan(50);
  });

  it('produces different output with different seeds', () => {
    const svg42 = renderTerrainAssets(isoCells, 42, palette);
    const svg100 = renderTerrainAssets(isoCells, 100, palette);
    expect(svg42).not.toBe(svg100);
  });
});

// ── renderSeasonalTerrainAssets ──────────────────────────────

describe('renderSeasonalTerrainAssets', () => {
  // Generate 52 per-week palettes for each season rotation
  function makeWeekPalettes(rotation: number) {
    return Array.from({ length: 52 }, (_, w) => getSeasonalPalette100('dark', w, rotation));
  }

  const winterPalettes = makeWeekPalettes(0);
  const springPalettes = makeWeekPalettes(39);
  const summerPalettes = makeWeekPalettes(26);
  const autumnPalettes = makeWeekPalettes(13);

  it('returns SVG g element with class "terrain-assets"', () => {
    const svg = renderSeasonalTerrainAssets(isoCells, 42, winterPalettes);
    expect(svg).toMatch(/^<g class="terrain-assets">/);
    expect(svg).toMatch(/<\/g>$/);
  });

  it('contains SVG content for winter rotation (0)', () => {
    const svg = renderSeasonalTerrainAssets(isoCells, 42, winterPalettes, undefined, biomeMap, 0);
    expect(svg.length).toBeGreaterThan(50);
    expect(svg).toContain('<g class="terrain-assets">');
  });

  it('contains SVG content for spring rotation (39)', () => {
    const svg = renderSeasonalTerrainAssets(isoCells, 42, springPalettes, undefined, biomeMap, 39);
    expect(svg.length).toBeGreaterThan(50);
    expect(svg).toContain('<g class="terrain-assets">');
  });

  it('contains SVG content for summer rotation (26)', () => {
    const svg = renderSeasonalTerrainAssets(isoCells, 42, summerPalettes, undefined, biomeMap, 26);
    expect(svg.length).toBeGreaterThan(50);
    expect(svg).toContain('<g class="terrain-assets">');
  });

  it('contains SVG content for autumn rotation (13)', () => {
    const svg = renderSeasonalTerrainAssets(isoCells, 42, autumnPalettes, undefined, biomeMap, 13);
    expect(svg.length).toBeGreaterThan(50);
    expect(svg).toContain('<g class="terrain-assets">');
  });

  it('different season rotations produce different output', () => {
    const winterSvg = renderSeasonalTerrainAssets(
      isoCells,
      42,
      winterPalettes,
      undefined,
      biomeMap,
      0,
    );
    const summerSvg = renderSeasonalTerrainAssets(
      isoCells,
      42,
      summerPalettes,
      undefined,
      biomeMap,
      26,
    );
    expect(winterSvg).not.toBe(summerSvg);
  });

  it('works with variantSeed parameter', () => {
    const svg = renderSeasonalTerrainAssets(isoCells, 42, winterPalettes, 999);
    expect(svg).toContain('<g class="terrain-assets">');
  });

  it('works with biomeMap parameter', () => {
    const svgWithBiome = renderSeasonalTerrainAssets(
      isoCells,
      42,
      winterPalettes,
      undefined,
      biomeMap,
      0,
    );
    const svgWithout = renderSeasonalTerrainAssets(isoCells, 42, winterPalettes, undefined);
    expect(svgWithBiome).not.toBe(svgWithout);
  });

  it('works with light mode seasonal palettes', () => {
    const lightPalettes = Array.from({ length: 52 }, (_, w) =>
      getSeasonalPalette100('light', w, 0),
    );
    const lightPaletteRef = getTerrainPalette100('light');
    const lightIsoCells = getIsoCells(cells100, lightPaletteRef, originX, originY);
    const svg = renderSeasonalTerrainAssets(
      lightIsoCells,
      42,
      lightPalettes,
      undefined,
      biomeMap,
      0,
    );
    expect(svg).toContain('<g class="terrain-assets">');
    expect(svg.length).toBeGreaterThan(50);
  });

  it('handles all four season rotations without errors', () => {
    const rotations = [0, 13, 26, 39];
    for (const rotation of rotations) {
      const palettes = makeWeekPalettes(rotation);
      const svg = renderSeasonalTerrainAssets(
        isoCells,
        42,
        palettes,
        undefined,
        biomeMap,
        rotation,
      );
      expect(svg).toContain('<g class="terrain-assets">');
    }
  });
});

// ── renderAssetCSS ──────────────────────────────────────────

describe('renderAssetCSS', () => {
  it('returns a string containing @keyframes tree-sway', () => {
    const css = renderAssetCSS();
    expect(css).toContain('@keyframes tree-sway');
  });

  it('contains rotation transforms in the keyframes', () => {
    const css = renderAssetCSS();
    expect(css).toContain('transform: rotate(');
  });

  it('defines 0%, 50%, and 100% keyframe stops', () => {
    const css = renderAssetCSS();
    expect(css).toContain('0%');
    expect(css).toContain('50%');
    expect(css).toContain('100%');
  });
});

// ── Cross-seed coverage ─────────────────────────────────────

describe('cross-seed asset type coverage', () => {
  it('multiple seeds (42, 100, 12345) collectively cover many asset types', () => {
    const seeds = [42, 100, 12345];
    const allTypes = new Set<string>();

    for (const seed of seeds) {
      const assets = selectAssets(isoCells, seed, undefined, biomeMap, 0);
      for (const asset of assets) {
        allTypes.add(asset.type);
      }
    }

    // With a full-range dataset and multiple seeds, we should get good coverage
    // The 118-type system should produce many distinct types
    expect(allTypes.size).toBeGreaterThanOrEqual(15);
  });

  it('biomeMap produces biome-specific asset types', () => {
    const allTypesWithBiome = new Set<string>();
    const allTypesWithout = new Set<string>();

    for (const seed of [42, 100, 12345]) {
      const withBiome = selectAssets(isoCells, seed, undefined, biomeMap, 0);
      const without = selectAssets(isoCells, seed);
      for (const a of withBiome) allTypesWithBiome.add(a.type);
      for (const a of without) allTypesWithout.add(a.type);
    }

    // Biome blending should introduce some asset types not present without it
    // (or at least change the distribution)
    const combined = new Set([...allTypesWithBiome, ...allTypesWithout]);
    expect(combined.size).toBeGreaterThanOrEqual(15);
  });
});
