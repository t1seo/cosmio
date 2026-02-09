import { describe, it, expect } from 'vitest';
import { createNoise2D } from '../../src/utils/noise.js';

describe('createNoise2D', () => {
  it('should return a function', () => {
    const noise = createNoise2D(42);
    expect(typeof noise).toBe('function');
  });

  it('should return values in the [-1, 1] range', () => {
    const noise = createNoise2D(12345);

    for (let x = 0; x < 20; x++) {
      for (let y = 0; y < 20; y++) {
        const value = noise(x * 0.1, y * 0.1);
        expect(value).toBeGreaterThanOrEqual(-1);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });

  it('should be deterministic with the same seed and coordinates', () => {
    const noiseA = createNoise2D(42);
    const noiseB = createNoise2D(42);

    expect(noiseA(1.5, 2.5)).toBe(noiseB(1.5, 2.5));
    expect(noiseA(0, 0)).toBe(noiseB(0, 0));
    expect(noiseA(10.3, 7.8)).toBe(noiseB(10.3, 7.8));
  });

  it('should produce different values for different seeds', () => {
    const noiseA = createNoise2D(1);
    const noiseB = createNoise2D(999);

    // Test multiple coordinates to confirm they diverge
    const coords: [number, number][] = [
      [1.0, 2.0],
      [3.5, 4.5],
      [10.0, 10.0],
    ];

    let allSame = true;
    for (const [x, y] of coords) {
      if (noiseA(x, y) !== noiseB(x, y)) {
        allSame = false;
        break;
      }
    }

    expect(allSame).toBe(false);
  });

  it('should produce different values for different coordinates with the same seed', () => {
    const noise = createNoise2D(42);

    const v1 = noise(0, 0);
    const v2 = noise(5, 5);
    const v3 = noise(10, 10);

    // At least two of these should differ
    const unique = new Set([v1, v2, v3]);
    expect(unique.size).toBeGreaterThan(1);
  });

  it('should produce smooth values for nearby coordinates', () => {
    const noise = createNoise2D(42);

    const v1 = noise(1.0, 1.0);
    const v2 = noise(1.01, 1.01);

    // Nearby coordinates should produce similar values (smooth noise)
    expect(Math.abs(v1 - v2)).toBeLessThan(0.1);
  });
});
