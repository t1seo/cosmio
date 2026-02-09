import { describe, it, expect } from 'vitest';
import {
  renderTerrainCSS,
  renderAnimatedOverlays,
  renderCelestials,
  renderClouds,
  renderWaterOverlays,
  renderWaterRipples,
  renderSnowParticles,
  renderFallingPetals,
  renderFallingLeaves,
} from '../../../src/themes/terrain/effects.js';
import { getTerrainPalette100 } from '../../../src/themes/terrain/palette.js';
import { getIsoCells } from '../../../src/themes/terrain/blocks.js';
import type { IsoCell } from '../../../src/themes/terrain/blocks.js';
import { contributionGrid, enrichGridCells100 } from '../../../src/themes/shared.js';
import { generateBiomeMap } from '../../../src/themes/terrain/biomes.js';
import { createMockContributionData } from '../../fixtures/contribution-data.js';

// ── Shared test data ──────────────────────────────────────────

const data = createMockContributionData();
const cells = contributionGrid(data, { cellSize: 11, gap: 2, offsetX: 24, offsetY: 42 });
const cells100 = enrichGridCells100(cells, data);
const darkPalette = getTerrainPalette100('dark');
const lightPalette = getTerrainPalette100('light');
const originX = 436;
const originY = 50;
const isoCells = getIsoCells(cells100, darkPalette, originX, originY);
const biomeMap = generateBiomeMap(52, 7, 42);

// ── renderTerrainCSS ──────────────────────────────────────────

describe('renderTerrainCSS', () => {
  const css = renderTerrainCSS(isoCells);

  it('contains @keyframes declarations', () => {
    expect(css).toContain('@keyframes');
  });

  it('contains flag-wave keyframes', () => {
    expect(css).toContain('@keyframes flag-wave');
  });

  it('contains sway-gentle keyframes', () => {
    expect(css).toContain('@keyframes sway-gentle');
  });

  it('contains sway-slow keyframes', () => {
    expect(css).toContain('@keyframes sway-slow');
  });

  it('generates water-shimmer CSS when water cells exist', () => {
    const hasWater = isoCells.some((c) => c.level100 >= 10 && c.level100 <= 22);
    if (hasWater) {
      expect(css).toContain('@keyframes water-shimmer');
      expect(css).toMatch(/\.water-\d+/);
    }
  });

  it('generates town-sparkle CSS when town cells exist', () => {
    const hasTown = isoCells.some((c) => c.level100 >= 90);
    if (hasTown) {
      expect(css).toContain('@keyframes town-sparkle');
      expect(css).toMatch(/\.sparkle-\d+/);
    }
  });

  it('generates river-shimmer CSS when biomeMap has river cells outside water zone', () => {
    const cssWithBiome = renderTerrainCSS(isoCells, biomeMap);
    const riverCells = isoCells.filter((c) => {
      const biome = biomeMap.get(`${c.week},${c.day}`);
      return biome && (biome.isRiver || biome.isPond) && c.level100 > 22;
    });
    if (riverCells.length > 0) {
      expect(cssWithBiome).toMatch(/\.river-shimmer-\d+/);
    }
  });
});

// ── renderAnimatedOverlays ────────────────────────────────────

describe('renderAnimatedOverlays', () => {
  const overlays = renderAnimatedOverlays(isoCells, darkPalette);

  it('returns g element with class "terrain-overlays"', () => {
    expect(overlays).toContain('<g class="terrain-overlays">');
    expect(overlays).toContain('</g>');
  });

  it('generates polygon overlays for water cells', () => {
    const hasWater = isoCells.some((c) => c.level100 >= 10 && c.level100 <= 22);
    if (hasWater) {
      expect(overlays).toContain('<polygon');
      expect(overlays).toMatch(/class="water-\d+"/);
    }
  });

  it('generates circle sparkle overlays for town cells', () => {
    const hasTown = isoCells.some((c) => c.level100 >= 90);
    if (hasTown) {
      expect(overlays).toContain('<circle');
      expect(overlays).toMatch(/class="sparkle-\d+"/);
    }
  });

  it('uses palette accent color for water overlays', () => {
    const hasWater = isoCells.some((c) => c.level100 >= 10 && c.level100 <= 22);
    if (hasWater) {
      expect(overlays).toContain(darkPalette.text.accent);
    }
  });
});

// ── renderCelestials ──────────────────────────────────────────

describe('renderCelestials', () => {
  it('dark mode renders stars and crescent moon', () => {
    const svg = renderCelestials(42, darkPalette, true);
    expect(svg).toContain('<g class="celestials">');
    // Stars are small circles
    expect(svg).toContain('<circle');
    // Bright stars have cross shapes (line elements)
    expect(svg).toContain('<line');
    // Moon: crescent made from overlapping circles
    expect(svg).toContain(darkPalette.bg.subtle);
  });

  it('light mode renders sun with rays', () => {
    const svg = renderCelestials(42, lightPalette, false);
    expect(svg).toContain('<g class="celestials">');
    // Sun body
    expect(svg).toContain('<circle');
    // Sun rays (8 lines)
    expect(svg).toContain('<line');
    // Sun colors
    expect(svg).toContain('#ffe066');
  });

  it('is deterministic with same seed', () => {
    const svg1 = renderCelestials(42, darkPalette, true);
    const svg2 = renderCelestials(42, darkPalette, true);
    expect(svg1).toBe(svg2);
  });

  it('produces different output with different seeds', () => {
    const svg1 = renderCelestials(42, darkPalette, true);
    const svg2 = renderCelestials(99, darkPalette, true);
    expect(svg1).not.toBe(svg2);
  });
});

// ── renderClouds ──────────────────────────────────────────────

describe('renderClouds', () => {
  const clouds = renderClouds(42, darkPalette);

  it('returns g element with class "terrain-clouds"', () => {
    expect(clouds).toContain('<g class="terrain-clouds">');
    expect(clouds).toContain('</g>');
  });

  it('contains ellipse elements for cloud shapes', () => {
    expect(clouds).toContain('<ellipse');
  });

  it('contains SMIL animateTransform for drift animation', () => {
    expect(clouds).toContain('animateTransform');
    expect(clouds).toContain('type="translate"');
    expect(clouds).toContain('repeatCount="indefinite"');
  });

  it('is deterministic with same seed', () => {
    const clouds2 = renderClouds(42, darkPalette);
    expect(clouds).toBe(clouds2);
  });

  it('produces different output with different seeds', () => {
    const clouds2 = renderClouds(99, darkPalette);
    expect(clouds).not.toBe(clouds2);
  });
});

// ── renderWaterOverlays ───────────────────────────────────────

describe('renderWaterOverlays', () => {
  it('returns empty string when no water biome cells exist', () => {
    const emptyBiomeMap = new Map<
      string,
      { isRiver: boolean; isPond: boolean; nearWater: boolean; forestDensity: number }
    >();
    for (let w = 0; w < 52; w++) {
      for (let d = 0; d < 7; d++) {
        emptyBiomeMap.set(`${w},${d}`, {
          isRiver: false,
          isPond: false,
          nearWater: false,
          forestDensity: 0,
        });
      }
    }
    const result = renderWaterOverlays(isoCells, darkPalette, emptyBiomeMap);
    expect(result).toBe('');
  });

  it('returns g.water-overlays when biome water exists', () => {
    const result = renderWaterOverlays(isoCells, darkPalette, biomeMap);
    // The biomeMap from generateBiomeMap has rivers and ponds
    const hasWaterBiome = Array.from(biomeMap.values()).some((ctx) => ctx.isRiver || ctx.isPond);
    if (hasWaterBiome) {
      expect(result).toContain('<g class="water-overlays">');
      expect(result).toContain('<polygon');
    }
  });

  it('uses pond overlay color for pond cells', () => {
    const result = renderWaterOverlays(isoCells, darkPalette, biomeMap);
    const hasPond = Array.from(biomeMap.values()).some((ctx) => ctx.isPond);
    if (hasPond) {
      expect(result).toContain(darkPalette.assets.pondOverlay);
    }
  });

  it('uses river overlay color for river cells', () => {
    const result = renderWaterOverlays(isoCells, darkPalette, biomeMap);
    const hasRiver = Array.from(biomeMap.values()).some((ctx) => ctx.isRiver && !ctx.isPond);
    if (hasRiver) {
      expect(result).toContain(darkPalette.assets.riverOverlay);
    }
  });
});

// ── renderWaterRipples ────────────────────────────────────────

describe('renderWaterRipples', () => {
  it('returns empty string when no water biome cells exist', () => {
    const emptyBiomeMap = new Map<
      string,
      { isRiver: boolean; isPond: boolean; nearWater: boolean; forestDensity: number }
    >();
    for (let w = 0; w < 52; w++) {
      for (let d = 0; d < 7; d++) {
        emptyBiomeMap.set(`${w},${d}`, {
          isRiver: false,
          isPond: false,
          nearWater: false,
          forestDensity: 0,
        });
      }
    }
    const result = renderWaterRipples(isoCells, darkPalette, emptyBiomeMap);
    expect(result).toBe('');
  });

  it('returns g.water-ripples with path elements when biome water exists', () => {
    const result = renderWaterRipples(isoCells, darkPalette, biomeMap);
    const hasWaterBiome = Array.from(biomeMap.values()).some((ctx) => ctx.isRiver || ctx.isPond);
    if (hasWaterBiome) {
      expect(result).toContain('<g class="water-ripples">');
      expect(result).toContain('<path');
    }
  });

  it('uses palette waterLight color for ripple strokes', () => {
    const result = renderWaterRipples(isoCells, darkPalette, biomeMap);
    const hasWaterBiome = Array.from(biomeMap.values()).some((ctx) => ctx.isRiver || ctx.isPond);
    if (hasWaterBiome) {
      expect(result).toContain(darkPalette.assets.waterLight);
    }
  });

  it('ripples have fill="none"', () => {
    const result = renderWaterRipples(isoCells, darkPalette, biomeMap);
    const hasWaterBiome = Array.from(biomeMap.values()).some((ctx) => ctx.isRiver || ctx.isPond);
    if (hasWaterBiome) {
      expect(result).toContain('fill="none"');
    }
  });
});

// ── renderSnowParticles ───────────────────────────────────────

describe('renderSnowParticles', () => {
  it('returns snow particles for winter rotation (rotation=0 places early weeks in winter)', () => {
    // With rotation=0, weeks 0-4 are zone 0 (winter), weeks 5-13 are zone 1, weeks 46-51 are zone 7
    const result = renderSnowParticles(isoCells, 42, 0);
    expect(result).toContain('<g class="snow-particles">');
    expect(result).toContain('<circle');
    expect(result).toContain('fill="#fff"');
  });

  it('returns empty string for summer rotation (no winter zones in early weeks)', () => {
    // With rotation=26, early weeks (0-4) map to rotated week 26-30 = zone 4 (summer)
    // All weeks shift into non-winter territory
    // Zone 0 (winter) = rotated weeks 0-4, so original weeks would need (w+26)%52 in [0-4]
    // That means w in [26,27,28,29,30 adjusted]... actually let's verify carefully:
    // For rotation=26: w=0 -> rotated=26 (zone 4 summer), w=26 -> rotated=0 (zone 0 winter)
    // So there ARE winter cells, just at different weeks. The function checks all isoCells.
    // We need a rotation where NO weeks map to winter zones 0,1,7
    // That's impossible since all 8 zones are covered for any rotation across 52 weeks.
    // Instead, test with an isoCells array that only has summer-zone weeks.
    const summerOnlyCells = isoCells.filter((c) => {
      const rotatedWeek = (c.week + 26) % 52;
      return rotatedWeek >= 28 && rotatedWeek <= 32;
    });
    const result = renderSnowParticles(summerOnlyCells, 42, 26);
    expect(result).toBe('');
  });

  it('is deterministic with same seed', () => {
    const result1 = renderSnowParticles(isoCells, 42, 0);
    const result2 = renderSnowParticles(isoCells, 42, 0);
    expect(result1).toBe(result2);
  });

  it('produces circles with white fill and varying opacity', () => {
    const result = renderSnowParticles(isoCells, 42, 0);
    if (result.length > 0) {
      expect(result).toMatch(/opacity="0\.\d+"/);
      expect(result).toContain('fill="#fff"');
    }
  });
});

// ── renderFallingPetals ───────────────────────────────────────

describe('renderFallingPetals', () => {
  it('returns petals for spring rotation (rotation=39 places early weeks in spring)', () => {
    // With rotation=39: week 0 -> rotated=39 => zone 6 (autumn)
    // We need weeks to land in spring zones (1, 2, 3)
    // Zone 2 (spring) = rotated weeks 14-18
    // week w: (w+39)%52 in [14-18] => w in range that gives rotated 14-18
    // w+39 = 14+52k => w = -25+52 = 27 (mod 52), etc.
    // Actually the function filters ALL isoCells for spring zones, so some weeks will be in spring.
    const result = renderFallingPetals(isoCells, 42, darkPalette, 39);
    expect(result).toContain('<g class="falling-petals">');
    expect(result).toContain('<ellipse');
  });

  it('returns empty string when no spring zone cells exist', () => {
    // Create cells only in summer zone with rotation=0
    // Zone 4 (summer) = rotated weeks 28-32
    const summerOnlyCells = isoCells.filter((c) => {
      const rotatedWeek = (c.week + 0) % 52;
      return rotatedWeek >= 28 && rotatedWeek <= 32;
    });
    const result = renderFallingPetals(summerOnlyCells, 42, darkPalette, 0);
    expect(result).toBe('');
  });

  it('uses cherry petal pink color from palette', () => {
    const result = renderFallingPetals(isoCells, 42, darkPalette, 39);
    if (result.length > 0) {
      expect(result).toContain(darkPalette.assets.cherryPetalPink);
    }
  });

  it('petals have rotation transforms', () => {
    const result = renderFallingPetals(isoCells, 42, darkPalette, 39);
    if (result.length > 0) {
      expect(result).toMatch(/transform="rotate\(/);
    }
  });
});

// ── renderFallingLeaves ───────────────────────────────────────

describe('renderFallingLeaves', () => {
  it('returns leaves for autumn rotation (rotation=13 places early weeks in autumn)', () => {
    // With rotation=13: week 0 -> rotated=13 => zone 1 (winter->spring)
    // Zone 6 (autumn) = rotated weeks 41-45
    // week w: (w+13)%52 in [41-45] => w = 28..32
    // Zone 5 (summer->autumn) = rotated weeks 33-40 => w = 20..27
    // Zone 7 (autumn->winter) = rotated weeks 46-51 => w = 33..38
    // So autumn cells (5,6,7) exist across a range of weeks
    const result = renderFallingLeaves(isoCells, 42, darkPalette, 13);
    expect(result).toContain('<g class="falling-leaves">');
    expect(result).toContain('<ellipse');
  });

  it('returns empty string when no autumn zone cells exist', () => {
    // Filter to only summer peak cells with rotation=0
    // Zone 4 (summer) = rotated weeks 28-32
    const summerOnlyCells = isoCells.filter((c) => {
      const rotatedWeek = (c.week + 0) % 52;
      return rotatedWeek >= 28 && rotatedWeek <= 32;
    });
    const result = renderFallingLeaves(summerOnlyCells, 42, darkPalette, 0);
    expect(result).toBe('');
  });

  it('uses autumn leaf colors from palette', () => {
    const result = renderFallingLeaves(isoCells, 42, darkPalette, 13);
    if (result.length > 0) {
      const leafColorSet = [
        darkPalette.assets.fallenLeafRed,
        darkPalette.assets.fallenLeafOrange,
        darkPalette.assets.fallenLeafGold,
        darkPalette.assets.mapleRed,
        darkPalette.assets.oakGold,
      ];
      const containsLeafColor = leafColorSet.some((color) => result.includes(color));
      expect(containsLeafColor).toBe(true);
    }
  });

  it('leaves have rotation transforms', () => {
    const result = renderFallingLeaves(isoCells, 42, darkPalette, 13);
    if (result.length > 0) {
      expect(result).toMatch(/transform="rotate\(/);
    }
  });

  it('is deterministic with same seed', () => {
    const result1 = renderFallingLeaves(isoCells, 42, darkPalette, 13);
    const result2 = renderFallingLeaves(isoCells, 42, darkPalette, 13);
    expect(result1).toBe(result2);
  });
});

// ── Water coverage: explicit water-level cells ──────────────────

describe('renderTerrainCSS with guaranteed water cells', () => {
  // Create IsoCell objects with level100 in the water range (10-22)
  const waterIsoCells: IsoCell[] = [
    {
      week: 0,
      day: 0,
      level100: 10,
      height: 0,
      isoX: 100,
      isoY: 50,
      colors: { top: '#285080', left: 'rgb(30,60,96)', right: 'rgb(24,48,77)' },
    },
    {
      week: 1,
      day: 0,
      level100: 15,
      height: 0,
      isoX: 108,
      isoY: 53.5,
      colors: { top: '#1e4678', left: 'rgb(23,53,90)', right: 'rgb(18,42,72)' },
    },
    {
      week: 2,
      day: 0,
      level100: 20,
      height: 0,
      isoX: 116,
      isoY: 57,
      colors: { top: '#1e4678', left: 'rgb(23,53,90)', right: 'rgb(18,42,72)' },
    },
  ];

  it('generates water-shimmer keyframes when water cells exist', () => {
    const css = renderTerrainCSS(waterIsoCells);
    expect(css).toContain('@keyframes water-shimmer');
    expect(css).toMatch(/\.water-\d+/);
  });

  it('generates per-cell water animation classes with timing', () => {
    const css = renderTerrainCSS(waterIsoCells);
    expect(css).toContain('.water-0');
    expect(css).toContain('.water-1');
    expect(css).toContain('.water-2');
    expect(css).toContain('ease-in-out');
    expect(css).toContain('infinite');
  });

  it('does not generate town-sparkle when no town cells exist', () => {
    const css = renderTerrainCSS(waterIsoCells);
    expect(css).not.toContain('@keyframes town-sparkle');
  });
});

describe('renderAnimatedOverlays with guaranteed water cells', () => {
  const waterIsoCells: IsoCell[] = [
    {
      week: 0,
      day: 0,
      level100: 12,
      height: 0,
      isoX: 100,
      isoY: 50,
      colors: { top: '#285080', left: 'rgb(30,60,96)', right: 'rgb(24,48,77)' },
    },
    {
      week: 1,
      day: 1,
      level100: 18,
      height: 0,
      isoX: 108,
      isoY: 57,
      colors: { top: '#1e4678', left: 'rgb(23,53,90)', right: 'rgb(18,42,72)' },
    },
  ];

  it('generates polygon water shimmer overlays', () => {
    const overlays = renderAnimatedOverlays(waterIsoCells, darkPalette);
    expect(overlays).toContain('<polygon');
    expect(overlays).toContain('class="water-0"');
    expect(overlays).toContain('class="water-1"');
    expect(overlays).toContain(darkPalette.text.accent);
    expect(overlays).toContain('opacity="0.15"');
  });

  it('polygon points form diamond shape from THW/THH constants', () => {
    const overlays = renderAnimatedOverlays(waterIsoCells, darkPalette);
    // First cell at isoX=100, isoY=50: diamond uses THW=8, THH=3.5
    // Points: (100, 50-3.5+1=47.5), (100+8-2=106, 50), (100, 50+3.5-1=52.5), (100-8+2=94, 50)
    expect(overlays).toContain('100,47.5');
    expect(overlays).toContain('106,50');
    expect(overlays).toContain('100,52.5');
    expect(overlays).toContain('94,50');
  });
});
