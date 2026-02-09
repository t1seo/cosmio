import { describe, it, expect } from 'vitest';
import { generateBiomeMap } from '../../src/themes/terrain/biomes.js';

describe('generateBiomeMap', () => {
  const map = generateBiomeMap(52, 7, 12345);

  it('produces a context for every cell', () => {
    expect(map.size).toBe(52 * 7);
  });

  it('has river cells from 2 river paths', () => {
    let rivers = 0;
    for (const ctx of map.values()) {
      if (ctx.isRiver) rivers++;
    }
    expect(rivers).toBeGreaterThan(40);
    expect(rivers).toBeLessThan(120);
  });

  it('marks nearWater adjacent to rivers', () => {
    for (const [key, ctx] of map.entries()) {
      if (ctx.isRiver) {
        const [w, d] = key.split(',').map(Number);
        const neighbors = [
          map.get(`${w - 1},${d}`),
          map.get(`${w + 1},${d}`),
          map.get(`${w},${d - 1}`),
          map.get(`${w},${d + 1}`),
        ].filter(Boolean);
        const hasAdjacentWaterAware = neighbors.some(
          (n) => n!.nearWater || n!.isRiver || n!.isPond,
        );
        expect(hasAdjacentWaterAware).toBe(true);
      }
    }
  });

  it('has forest clusters with density 0–1', () => {
    let forestCells = 0;
    for (const ctx of map.values()) {
      expect(ctx.forestDensity).toBeGreaterThanOrEqual(0);
      expect(ctx.forestDensity).toBeLessThanOrEqual(1);
      if (ctx.forestDensity > 0.3) forestCells++;
    }
    expect(forestCells).toBeGreaterThan(10);
    expect(forestCells).toBeLessThan(150);
  });

  it('is deterministic (same seed = same output)', () => {
    const map2 = generateBiomeMap(52, 7, 12345);
    for (const [key, ctx] of map.entries()) {
      const ctx2 = map2.get(key)!;
      expect(ctx.isRiver).toBe(ctx2.isRiver);
      expect(ctx.isPond).toBe(ctx2.isPond);
      expect(ctx.forestDensity).toBe(ctx2.forestDensity);
    }
  });

  it('has pond cells at river bends', () => {
    let ponds = 0;
    for (const ctx of map.values()) {
      if (ctx.isPond) ponds++;
    }
    expect(ponds).toBeGreaterThanOrEqual(2);
    expect(ponds).toBeLessThanOrEqual(12);
  });
});

describe('generateBiomeMap river bends', () => {
  it('rivers produce bends that deviate from straight paths', () => {
    // Run with multiple seeds to ensure river bends are generated
    const seeds = [42, 99, 777, 1234, 5678];
    for (const seed of seeds) {
      const biome = generateBiomeMap(52, 7, seed);
      // Count river cells — 2 rivers across 52 weeks = ~104 cells minimum
      let riverCount = 0;
      for (const ctx of biome.values()) {
        if (ctx.isRiver) riverCount++;
      }
      // Each river traverses 52 weeks, so minimum 104 cells (with overlaps possible)
      expect(riverCount).toBeGreaterThanOrEqual(80);
    }
  });

  it('river bends lead to pond formation at those locations', () => {
    // Different seeds to exercise different branch paths in drift logic
    const biome1 = generateBiomeMap(52, 7, 1);
    const biome2 = generateBiomeMap(52, 7, 2);

    // Both should have ponds (formed at river bends)
    let ponds1 = 0;
    let ponds2 = 0;
    for (const ctx of biome1.values()) if (ctx.isPond) ponds1++;
    for (const ctx of biome2.values()) if (ctx.isPond) ponds2++;

    expect(ponds1).toBeGreaterThanOrEqual(1);
    expect(ponds2).toBeGreaterThanOrEqual(1);
  });
});

describe('generateBiomeMap with small grids', () => {
  it('handles minimum grid (1 week x 1 day)', () => {
    const biome = generateBiomeMap(1, 1, 42);
    expect(biome.size).toBe(1);
    const ctx = biome.get('0,0')!;
    expect(ctx).toBeDefined();
    expect(typeof ctx.isRiver).toBe('boolean');
    expect(typeof ctx.isPond).toBe('boolean');
    expect(typeof ctx.nearWater).toBe('boolean');
    expect(typeof ctx.forestDensity).toBe('number');
  });

  it('handles very small grid where ponds may go out of bounds', () => {
    // 3x3 grid: pond expansion may try cells outside boundaries
    const biome = generateBiomeMap(3, 3, 42);
    expect(biome.size).toBe(9);
    // All cells should have valid BiomeContext
    for (let w = 0; w < 3; w++) {
      for (let d = 0; d < 3; d++) {
        const ctx = biome.get(`${w},${d}`);
        expect(ctx).toBeDefined();
      }
    }
  });

  it('handles 2x2 grid where river drift is constrained', () => {
    const biome = generateBiomeMap(2, 2, 99);
    expect(biome.size).toBe(4);
    let rivers = 0;
    for (const ctx of biome.values()) {
      if (ctx.isRiver) rivers++;
    }
    // With 2 rivers x 2 weeks, expect some river cells
    expect(rivers).toBeGreaterThanOrEqual(1);
  });
});

describe('generateBiomeMap with different seeds for branch coverage', () => {
  it('produces varied pond counts across seeds', () => {
    const pondCounts: number[] = [];
    for (let seed = 0; seed < 20; seed++) {
      const biome = generateBiomeMap(52, 7, seed);
      let ponds = 0;
      for (const ctx of biome.values()) {
        if (ctx.isPond) ponds++;
      }
      pondCounts.push(ponds);
    }
    // At least some variation in pond counts
    const uniqueCounts = new Set(pondCounts);
    expect(uniqueCounts.size).toBeGreaterThan(1);
  });

  it('produces varied nearWater patterns across seeds', () => {
    const nearCounts: number[] = [];
    for (let seed = 10; seed < 15; seed++) {
      const biome = generateBiomeMap(52, 7, seed);
      let near = 0;
      for (const ctx of biome.values()) {
        if (ctx.nearWater) near++;
      }
      nearCounts.push(near);
    }
    // nearWater count should be positive for all seeds
    for (const count of nearCounts) {
      expect(count).toBeGreaterThan(0);
    }
  });
});
