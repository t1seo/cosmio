import { describe, it, expect } from 'vitest';
import {
  toIsoCells,
  renderTerrainBlocks,
  getIsoCells,
  renderSeasonalTerrainBlocks,
  THW,
  THH,
} from '../../../src/themes/terrain/blocks.js';
import {
  getTerrainPalette100,
  getSeasonalPalette100,
} from '../../../src/themes/terrain/palette.js';
import { contributionGrid, enrichGridCells100 } from '../../../src/themes/shared.js';
import type { GridCell100 } from '../../../src/themes/shared.js';
import { generateBiomeMap } from '../../../src/themes/terrain/biomes.js';
import { createMockContributionData } from '../../fixtures/contribution-data.js';

// ── Shared test data ──────────────────────────────────────────

const data = createMockContributionData();
const cells = contributionGrid(data, { cellSize: 11, gap: 2, offsetX: 24, offsetY: 42 });
const cells100 = enrichGridCells100(cells, data);
const palette = getTerrainPalette100('dark');
const originX = 436;
const originY = 50;

// ── THW and THH constants ─────────────────────────────────────

describe('THW and THH', () => {
  it('THW equals 8', () => {
    expect(THW).toBe(8);
  });

  it('THH equals 3.5', () => {
    expect(THH).toBe(3.5);
  });
});

// ── toIsoCells ────────────────────────────────────────────────

describe('toIsoCells', () => {
  const isoCells = toIsoCells(cells100, palette, originX, originY);

  it('converts all grid cells to isometric cells', () => {
    expect(isoCells.length).toBe(cells100.length);
  });

  it('each cell has required properties', () => {
    for (const cell of isoCells) {
      expect(cell).toHaveProperty('week');
      expect(cell).toHaveProperty('day');
      expect(cell).toHaveProperty('level100');
      expect(cell).toHaveProperty('height');
      expect(cell).toHaveProperty('isoX');
      expect(cell).toHaveProperty('isoY');
      expect(cell).toHaveProperty('colors');
      expect(cell.colors).toHaveProperty('top');
      expect(cell.colors).toHaveProperty('left');
      expect(cell.colors).toHaveProperty('right');
    }
  });

  it('sorts cells in drawing order (back to front)', () => {
    for (let i = 1; i < isoCells.length; i++) {
      const prev = isoCells[i - 1];
      const curr = isoCells[i];
      const sumPrev = prev.week + prev.day;
      const sumCurr = curr.week + curr.day;
      if (sumPrev !== sumCurr) {
        expect(sumPrev).toBeLessThanOrEqual(sumCurr);
      } else {
        expect(prev.week).toBeLessThanOrEqual(curr.week);
      }
    }
  });

  it('applies correct isometric projection formula', () => {
    // Find a cell with known week/day to verify the formula
    const cell = isoCells.find((c) => c.week === 5 && c.day === 3);
    expect(cell).toBeDefined();
    if (cell) {
      const expectedIsoX = originX + (5 - 3) * THW;
      const expectedIsoY = originY + (5 + 3) * THH;
      expect(cell.isoX).toBe(expectedIsoX);
      expect(cell.isoY).toBe(expectedIsoY);
    }
  });

  it('assigns height based on level via palette.getHeight', () => {
    for (const cell of isoCells) {
      const expectedHeight = palette.getHeight(cell.level100);
      expect(cell.height).toBe(expectedHeight);
    }
  });

  it('assigns colors based on level via palette.getElevation', () => {
    for (const cell of isoCells.slice(0, 20)) {
      const expectedColors = palette.getElevation(cell.level100);
      expect(cell.colors.top).toBe(expectedColors.top);
      expect(cell.colors.left).toBe(expectedColors.left);
      expect(cell.colors.right).toBe(expectedColors.right);
    }
  });

  it('level100 values are in range 0-99', () => {
    for (const cell of isoCells) {
      expect(cell.level100).toBeGreaterThanOrEqual(0);
      expect(cell.level100).toBeLessThanOrEqual(99);
    }
  });
});

// ── renderTerrainBlocks ───────────────────────────────────────

describe('renderTerrainBlocks', () => {
  it('returns SVG g element with class "terrain-blocks"', () => {
    const svg = renderTerrainBlocks(cells100, palette, originX, originY);
    expect(svg).toMatch(/^<g class="terrain-blocks">/);
    expect(svg).toMatch(/<\/g>$/);
  });

  it('contains polygon elements', () => {
    const svg = renderTerrainBlocks(cells100, palette, originX, originY);
    expect(svg).toContain('<polygon');
  });

  it('handles biomeMap with river and pond cells getting water treatment', () => {
    const biomeMap = generateBiomeMap(52, 7, 42);
    const svg = renderTerrainBlocks(cells100, palette, originX, originY, biomeMap);
    expect(svg).toContain('<g class="terrain-blocks">');
    // Water treatment includes multi-layer surface (ellipse highlights)
    expect(svg).toContain('<ellipse');
  });

  it('natural water cells (level 9-22) get water treatment', () => {
    const svg = renderTerrainBlocks(cells100, palette, originX, originY);
    // The mock data includes cells with various levels, and those in 9-22 range
    // get water treatment which produces ellipse specular highlights
    const isoCells = toIsoCells(cells100, palette, originX, originY);
    const hasWaterLevelCells = isoCells.some((c) => c.level100 >= 9 && c.level100 <= 22);
    if (hasWaterLevelCells) {
      expect(svg).toContain('<ellipse');
      expect(svg).toContain('opacity="0.15"');
    }
  });

  it('produces different output with and without biomeMap', () => {
    const biomeMap = generateBiomeMap(52, 7, 42);
    const svgWithout = renderTerrainBlocks(cells100, palette, originX, originY);
    const svgWith = renderTerrainBlocks(cells100, palette, originX, originY, biomeMap);
    expect(svgWith).not.toBe(svgWithout);
  });

  it('works with light mode palette', () => {
    const lightPalette = getTerrainPalette100('light');
    const svg = renderTerrainBlocks(cells100, lightPalette, originX, originY);
    expect(svg).toContain('<g class="terrain-blocks">');
    expect(svg).toContain('<polygon');
  });
});

// ── getIsoCells ───────────────────────────────────────────────

describe('getIsoCells', () => {
  it('returns the same result as toIsoCells', () => {
    const fromGetIsoCells = getIsoCells(cells100, palette, originX, originY);
    const fromToIsoCells = toIsoCells(cells100, palette, originX, originY);

    expect(fromGetIsoCells.length).toBe(fromToIsoCells.length);
    for (let i = 0; i < fromGetIsoCells.length; i++) {
      expect(fromGetIsoCells[i].week).toBe(fromToIsoCells[i].week);
      expect(fromGetIsoCells[i].day).toBe(fromToIsoCells[i].day);
      expect(fromGetIsoCells[i].level100).toBe(fromToIsoCells[i].level100);
      expect(fromGetIsoCells[i].isoX).toBe(fromToIsoCells[i].isoX);
      expect(fromGetIsoCells[i].isoY).toBe(fromToIsoCells[i].isoY);
      expect(fromGetIsoCells[i].height).toBe(fromToIsoCells[i].height);
      expect(fromGetIsoCells[i].colors.top).toBe(fromToIsoCells[i].colors.top);
    }
  });

  it('returns an array of IsoCell objects', () => {
    const result = getIsoCells(cells100, palette, originX, originY);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });
});

// ── renderSeasonalTerrainBlocks ───────────────────────────────

describe('renderSeasonalTerrainBlocks', () => {
  // Generate 52 per-week palettes
  const weekPalettes = Array.from({ length: 52 }, (_, w) => getSeasonalPalette100('dark', w, 0));

  it('returns SVG g element with class "terrain-blocks"', () => {
    const svg = renderSeasonalTerrainBlocks(cells100, weekPalettes, originX, originY, 0);
    expect(svg).toMatch(/^<g class="terrain-blocks">/);
    expect(svg).toMatch(/<\/g>$/);
  });

  it('contains polygon elements', () => {
    const svg = renderSeasonalTerrainBlocks(cells100, weekPalettes, originX, originY, 0);
    expect(svg).toContain('<polygon');
  });

  it('handles winter frozen water (zone 0, 1, 7)', () => {
    // With rotation=0, early weeks are in winter zones (0, 1, 7)
    const biomeMap = generateBiomeMap(52, 7, 42);
    const svg = renderSeasonalTerrainBlocks(cells100, weekPalettes, originX, originY, 0, biomeMap);
    // Winter zones produce frozen water -- blocks rendered without the isWater=true flag
    // (rendered as normal blocks with ice colors), so the output should still have polygons
    expect(svg).toContain('<polygon');
  });

  it('handles non-winter water with water treatment', () => {
    const biomeMap = generateBiomeMap(52, 7, 42);
    // Rotation=26 shifts so early weeks become summer (non-winter)
    const summerPalettes = Array.from({ length: 52 }, (_, w) =>
      getSeasonalPalette100('dark', w, 26),
    );
    const svg = renderSeasonalTerrainBlocks(
      cells100,
      summerPalettes,
      originX,
      originY,
      26,
      biomeMap,
    );
    // Non-winter water cells get the water treatment with ellipse highlights
    expect(svg).toContain('<ellipse');
  });

  it('works with biomeMap parameter', () => {
    const biomeMap = generateBiomeMap(52, 7, 42);
    const svgWithBiome = renderSeasonalTerrainBlocks(
      cells100,
      weekPalettes,
      originX,
      originY,
      0,
      biomeMap,
    );
    const svgWithout = renderSeasonalTerrainBlocks(cells100, weekPalettes, originX, originY, 0);
    expect(svgWithBiome).not.toBe(svgWithout);
  });

  it('produces valid output with light mode seasonal palettes', () => {
    const lightPalettes = Array.from({ length: 52 }, (_, w) =>
      getSeasonalPalette100('light', w, 0),
    );
    const svg = renderSeasonalTerrainBlocks(cells100, lightPalettes, originX, originY, 0);
    expect(svg).toContain('<g class="terrain-blocks">');
    expect(svg).toContain('<polygon');
  });
});

// ── Natural water zone cells (level100 9-22) ─────────────────

describe('renderTerrainBlocks with explicit natural water cells', () => {
  // Create cells that are specifically in the natural water zone (level100 9-22)
  function makeWaterCells(): GridCell100[] {
    return [
      { x: 0, y: 0, level: 1, count: 1, date: '2025-01-01', level100: 9 },
      { x: 13, y: 0, level: 1, count: 2, date: '2025-01-02', level100: 15 },
      { x: 26, y: 0, level: 1, count: 3, date: '2025-01-03', level100: 22 },
      { x: 39, y: 0, level: 2, count: 5, date: '2025-01-04', level100: 50 },
    ];
  }

  it('applies water treatment to cells with level100 9-22 (no biomeMap)', () => {
    const waterCells = makeWaterCells();
    const svg = renderTerrainBlocks(waterCells, palette, originX, originY);
    // Water treatment produces multi-layer surface with specular highlights
    expect(svg).toContain('<ellipse');
    expect(svg).toContain('opacity="0.15"');
    expect(svg).toContain('filter:brightness(1.3)');
  });

  it('non-water cells (level100 > 22) are rendered as normal blocks', () => {
    const normalCells: GridCell100[] = [
      { x: 0, y: 0, level: 3, count: 10, date: '2025-01-01', level100: 50 },
      { x: 13, y: 0, level: 4, count: 15, date: '2025-01-02', level100: 80 },
    ];
    const svg = renderTerrainBlocks(normalCells, palette, originX, originY);
    // Normal blocks should not have the multi-layer water surface
    expect(svg).not.toContain('filter:brightness(1.3)');
  });
});

// ── Ice/frozen water in winter zones ─────────────────────────

describe('renderSeasonalTerrainBlocks with frozen water in winter', () => {
  // Create cells with level100 in the natural water zone (9-22)
  // and use rotation=0 so week 0 is winter zone 0
  function makeWinterWaterCells(): GridCell100[] {
    // Each cell will be placed in week 0 (winter zone 0 with rotation=0)
    // We need exactly 7 cells for 1 full week so toIsoCells assigns week=0
    return [
      { x: 0, y: 0, level: 1, count: 1, date: '2025-01-01', level100: 10 },
      { x: 13, y: 0, level: 1, count: 1, date: '2025-01-02', level100: 15 },
      { x: 26, y: 0, level: 1, count: 1, date: '2025-01-03', level100: 20 },
      { x: 39, y: 0, level: 1, count: 1, date: '2025-01-04', level100: 12 },
      { x: 52, y: 0, level: 1, count: 1, date: '2025-01-05', level100: 18 },
      { x: 65, y: 0, level: 1, count: 1, date: '2025-01-06', level100: 9 },
      { x: 78, y: 0, level: 1, count: 1, date: '2025-01-07', level100: 22 },
    ];
  }

  it('renders ice blocks for natural water cells in winter zones', () => {
    const winterWaterCells = makeWinterWaterCells();
    const winterPalettes = Array.from({ length: 52 }, (_, w) =>
      getSeasonalPalette100('dark', w, 0),
    );
    // rotation=0 means week 0 is zone 0 (winter peak)
    const svg = renderSeasonalTerrainBlocks(winterWaterCells, winterPalettes, originX, originY, 0);
    // Frozen water uses ice colors, rendered as normal block (isWater=false)
    // So there should be NO multi-layer water surface (no brightness filter)
    expect(svg).not.toContain('filter:brightness(1.3)');
    // But it should still have polygon elements
    expect(svg).toContain('<polygon');
    expect(svg).toContain('<g class="terrain-blocks">');
  });

  it('renders water treatment for natural water cells in summer zones', () => {
    const summerWaterCells: GridCell100[] = [];
    // Create 7*29 dummy cells so we get to week 28+ where summer is (zone 4)
    for (let i = 0; i < 7 * 29; i++) {
      const level100 = i >= 7 * 28 ? 15 : 50; // week 28+ gets water-level cells
      summerWaterCells.push({
        x: i * 13,
        y: 0,
        level: level100 <= 22 ? 1 : 3,
        count: level100 <= 22 ? 2 : 10,
        date: '2025-01-01',
        level100,
      });
    }

    const summerPalettes = Array.from({ length: 52 }, (_, w) =>
      getSeasonalPalette100('dark', w, 0),
    );
    const svg = renderSeasonalTerrainBlocks(summerWaterCells, summerPalettes, originX, originY, 0);
    // Summer water cells should get water treatment with multi-layer surface
    expect(svg).toContain('filter:brightness(1.3)');
    expect(svg).toContain('<ellipse');
  });
});
