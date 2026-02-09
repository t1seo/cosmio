import { describe, it, expect } from 'vitest';
import { lerp, clamp, remap, hash, seededRandom } from '../../src/utils/math.js';

// ── lerp ───────────────────────────────────────────────────────────

describe('lerp', () => {
  it('should return midpoint at t=0.5', () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
  });

  it('should return start value at t=0', () => {
    expect(lerp(0, 10, 0)).toBe(0);
  });

  it('should return end value at t=1', () => {
    expect(lerp(0, 10, 1)).toBe(10);
  });

  it('should handle negative ranges', () => {
    expect(lerp(-10, 10, 0.5)).toBe(0);
  });

  it('should handle same start and end', () => {
    expect(lerp(5, 5, 0.5)).toBe(5);
  });

  it('should handle t outside [0, 1] (extrapolation)', () => {
    expect(lerp(0, 10, 2)).toBe(20);
    expect(lerp(0, 10, -1)).toBe(-10);
  });

  it('should handle fractional results', () => {
    expect(lerp(0, 1, 0.25)).toBeCloseTo(0.25);
    expect(lerp(0, 1, 0.75)).toBeCloseTo(0.75);
  });
});

// ── clamp ──────────────────────────────────────────────────────────

describe('clamp', () => {
  it('should return value when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('should clamp to min when value is below', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it('should clamp to max when value is above', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('should return min when value equals min', () => {
    expect(clamp(0, 0, 10)).toBe(0);
  });

  it('should return max when value equals max', () => {
    expect(clamp(10, 0, 10)).toBe(10);
  });

  it('should handle negative ranges', () => {
    expect(clamp(-5, -10, -1)).toBe(-5);
    expect(clamp(-15, -10, -1)).toBe(-10);
    expect(clamp(0, -10, -1)).toBe(-1);
  });

  it('should handle min equal to max', () => {
    expect(clamp(5, 3, 3)).toBe(3);
    expect(clamp(1, 3, 3)).toBe(3);
  });
});

// ── remap ──────────────────────────────────────────────────────────

describe('remap', () => {
  it('should remap midpoint from [0,10] to [0,100]', () => {
    expect(remap(5, 0, 10, 0, 100)).toBe(50);
  });

  it('should remap input minimum to output minimum', () => {
    expect(remap(0, 0, 10, 0, 100)).toBe(0);
  });

  it('should remap input maximum to output maximum', () => {
    expect(remap(10, 0, 10, 0, 100)).toBe(100);
  });

  it('should remap quarter point correctly', () => {
    expect(remap(2.5, 0, 10, 0, 100)).toBe(25);
  });

  it('should handle different output range', () => {
    expect(remap(5, 0, 10, 50, 150)).toBe(100);
  });

  it('should handle inverted output range', () => {
    expect(remap(0, 0, 10, 100, 0)).toBe(100);
    expect(remap(10, 0, 10, 100, 0)).toBe(0);
    expect(remap(5, 0, 10, 100, 0)).toBe(50);
  });

  it('should handle values outside input range (extrapolation)', () => {
    expect(remap(20, 0, 10, 0, 100)).toBe(200);
  });

  it('should handle negative input range', () => {
    expect(remap(0, -10, 10, 0, 100)).toBe(50);
  });
});

// ── hash ───────────────────────────────────────────────────────────

describe('hash', () => {
  it('should return a number', () => {
    expect(typeof hash('test')).toBe('number');
  });

  it('should return the same result for the same string', () => {
    expect(hash('hello')).toBe(hash('hello'));
  });

  it('should return different results for different strings (usually)', () => {
    const h1 = hash('hello');
    const h2 = hash('world');
    expect(h1).not.toBe(h2);
  });

  it('should return a non-negative integer (unsigned 32-bit)', () => {
    const result = hash('test-string');
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(0xffffffff);
    expect(Number.isInteger(result)).toBe(true);
  });

  it('should handle empty string', () => {
    const result = hash('');
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it('should differentiate similar strings', () => {
    const h1 = hash('abc');
    const h2 = hash('abd');
    expect(h1).not.toBe(h2);
  });

  it('should handle long strings', () => {
    const result = hash('a'.repeat(1000));
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThanOrEqual(0);
  });
});

// ── seededRandom ───────────────────────────────────────────────────

describe('seededRandom', () => {
  it('should return a function', () => {
    const rng = seededRandom(42);
    expect(typeof rng).toBe('function');
  });

  it('should return values in [0, 1)', () => {
    const rng = seededRandom(42);

    for (let i = 0; i < 100; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('should be deterministic with the same seed', () => {
    const rngA = seededRandom(42);
    const rngB = seededRandom(42);

    for (let i = 0; i < 20; i++) {
      expect(rngA()).toBe(rngB());
    }
  });

  it('should produce different sequences for different seeds', () => {
    const rngA = seededRandom(1);
    const rngB = seededRandom(999);

    let allSame = true;
    for (let i = 0; i < 10; i++) {
      if (rngA() !== rngB()) {
        allSame = false;
        break;
      }
    }

    expect(allSame).toBe(false);
  });

  it('should produce varied values (not all the same)', () => {
    const rng = seededRandom(42);
    const values = new Set<number>();

    for (let i = 0; i < 20; i++) {
      values.add(rng());
    }

    expect(values.size).toBeGreaterThan(1);
  });

  it('should have reasonable distribution across [0, 1)', () => {
    const rng = seededRandom(42);
    let belowHalf = 0;
    let aboveHalf = 0;
    const samples = 1000;

    for (let i = 0; i < samples; i++) {
      if (rng() < 0.5) {
        belowHalf++;
      } else {
        aboveHalf++;
      }
    }

    // Expect roughly even distribution (within 15%)
    expect(belowHalf).toBeGreaterThan(samples * 0.35);
    expect(aboveHalf).toBeGreaterThan(samples * 0.35);
  });
});
