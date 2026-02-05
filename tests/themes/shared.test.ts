import { describe, it, expect } from 'vitest';
import { computeLevel100 } from '../../src/themes/shared.js';

describe('computeLevel100', () => {
  it('returns 0 for zero contributions', () => {
    expect(computeLevel100(0, 20)).toBe(0);
  });

  it('returns low level for minimal contribution', () => {
    expect(computeLevel100(1, 100)).toBeGreaterThanOrEqual(1);
    expect(computeLevel100(1, 100)).toBeLessThan(25);
  });

  it('returns 99 for max contributions', () => {
    expect(computeLevel100(100, 100)).toBe(99);
  });

  it('spreads low values across more levels (log curve)', () => {
    const low = computeLevel100(5, 100);
    const mid = computeLevel100(50, 100);
    const high = computeLevel100(95, 100);
    expect(low).toBeGreaterThan(0);
    expect(mid).toBeGreaterThan(low);
    expect(high).toBeGreaterThan(mid);
    // Log curve: low values get more spread
    expect(low).toBeGreaterThan(15);
  });

  it('handles maxCount of 1', () => {
    expect(computeLevel100(1, 1)).toBe(99);
  });
});
