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
          n => n!.nearWater || n!.isRiver || n!.isPond,
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
