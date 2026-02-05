import { describe, it, expect } from 'vitest';
import {
  computeSeasonRotation,
  getSeasonZone,
  getTransitionBlend,
  getSeasonalTint,
  lerpTint,
  applyTint,
  applyTintToHex,
  getSeasonalPoolOverrides,
} from '../../src/themes/terrain/seasons.js';
import type { SeasonZone, SeasonalTint } from '../../src/themes/terrain/seasons.js';

// ── computeSeasonRotation ───────────────────────────────────

describe('computeSeasonRotation', () => {
  it('returns 0 for a date on December 1', () => {
    expect(computeSeasonRotation(new Date(2025, 11, 1))).toBe(0);
  });

  it('returns ~9 for early February (9 weeks after Dec 1)', () => {
    const rotation = computeSeasonRotation(new Date(2025, 1, 3));
    expect(rotation).toBeGreaterThanOrEqual(8);
    expect(rotation).toBeLessThanOrEqual(10);
  });

  it('returns ~26 for early June (26 weeks after Dec 1)', () => {
    const rotation = computeSeasonRotation(new Date(2025, 5, 2));
    expect(rotation).toBeGreaterThanOrEqual(25);
    expect(rotation).toBeLessThanOrEqual(27);
  });

  it('uses previous year Dec 1 when date is before current year Dec 1', () => {
    // March 2025 → ref = Dec 1 2024
    const rotation = computeSeasonRotation(new Date(2025, 2, 3));
    expect(rotation).toBeGreaterThanOrEqual(12);
    expect(rotation).toBeLessThanOrEqual(14);
  });

  it('southern hemisphere adds 26 to rotation', () => {
    const north = computeSeasonRotation(new Date(2025, 1, 3), 'north');
    const south = computeSeasonRotation(new Date(2025, 1, 3), 'south');
    expect(south).toBe((north + 26) % 52);
  });

  it('always returns 0-51', () => {
    for (let month = 0; month < 12; month++) {
      const rot = computeSeasonRotation(new Date(2025, month, 15));
      expect(rot).toBeGreaterThanOrEqual(0);
      expect(rot).toBeLessThan(52);
    }
  });
});

// ── getSeasonZone (rotation-based) ──────────────────────────

describe('getSeasonZone', () => {
  // With rotation=0, week index maps directly to ZONE_BOUNDS
  it('rotation=0: week 0 → zone 0 (winter)', () => {
    expect(getSeasonZone(0, 0)).toBe(0);
  });

  it('rotation=0: week 10 → zone 1 (winter→spring)', () => {
    expect(getSeasonZone(10, 0)).toBe(1);
  });

  it('rotation=0: week 16 → zone 2 (spring)', () => {
    expect(getSeasonZone(16, 0)).toBe(2);
  });

  it('rotation=0: week 22 → zone 3 (spring→summer)', () => {
    expect(getSeasonZone(22, 0)).toBe(3);
  });

  it('rotation=0: week 30 → zone 4 (summer)', () => {
    expect(getSeasonZone(30, 0)).toBe(4);
  });

  it('rotation=0: week 36 → zone 5 (summer→autumn)', () => {
    expect(getSeasonZone(36, 0)).toBe(5);
  });

  it('rotation=0: week 42 → zone 6 (autumn)', () => {
    expect(getSeasonZone(42, 0)).toBe(6);
  });

  it('rotation=0: week 50 → zone 7 (autumn→winter)', () => {
    expect(getSeasonZone(50, 0)).toBe(7);
  });

  it('covers all 52 weeks without gaps (rotation=0)', () => {
    const zones: SeasonZone[] = [];
    for (let w = 0; w < 52; w++) {
      zones.push(getSeasonZone(w, 0));
    }
    for (let z = 0; z <= 7; z++) {
      expect(zones).toContain(z);
    }
  });

  // With rotation, week indices shift
  it('rotation=9 (Feb): week 0 → zone 1 (late winter/W→Sp)', () => {
    expect(getSeasonZone(0, 9)).toBe(1);
  });

  it('rotation=9 (Feb): week 47 → zone 0 (winter, ~Jan)', () => {
    expect(getSeasonZone(47, 9)).toBe(0);
  });

  it('rotation=9 (Feb): week 26 → zone 5 (summer→autumn, ~Aug)', () => {
    expect(getSeasonZone(26, 9)).toBe(5);
  });

  it('covers all zones with rotation=9', () => {
    const zones: SeasonZone[] = [];
    for (let w = 0; w < 52; w++) {
      zones.push(getSeasonZone(w, 9));
    }
    for (let z = 0; z <= 7; z++) {
      expect(zones).toContain(z);
    }
  });
});

// ── Southern hemisphere via rotation ────────────────────────

describe('hemisphere via rotation', () => {
  it('south rotation = north rotation + 26', () => {
    const northRot = computeSeasonRotation(new Date(2025, 1, 3), 'north');
    const southRot = computeSeasonRotation(new Date(2025, 1, 3), 'south');
    // For each week, south should be 6 months shifted from north
    for (let w = 0; w < 52; w++) {
      const southZone = getSeasonZone(w, southRot);
      const equivalentNorthWeek = (w + 26) % 52;
      const northZone = getSeasonZone(equivalentNorthWeek, northRot);
      expect(southZone).toBe(northZone);
    }
  });
});

// ── getTransitionBlend ──────────────────────────────────────

describe('getTransitionBlend', () => {
  it('peak winter zone (rotation=0, week 3) returns t=0 with from=to=winter', () => {
    const blend = getTransitionBlend(3, 0);
    expect(blend.from).toBe('winter');
    expect(blend.to).toBe('winter');
    expect(blend.t).toBe(0);
  });

  it('transition zone 1 (rotation=0, week 7) returns from=winter, to=spring', () => {
    const blend = getTransitionBlend(7, 0);
    expect(blend.from).toBe('winter');
    expect(blend.to).toBe('spring');
    expect(blend.t).toBeCloseTo(0, 1);
  });

  it('transition zone 1 mid-point has t near 0.5', () => {
    const blend = getTransitionBlend(10, 0); // week 10 in zone 1 (7-12)
    expect(blend.from).toBe('winter');
    expect(blend.to).toBe('spring');
    expect(blend.t).toBeGreaterThan(0.3);
    expect(blend.t).toBeLessThan(0.7);
  });

  it('summer peak zone returns t=0 with from=to=summer', () => {
    const blend = getTransitionBlend(30, 0);
    expect(blend.from).toBe('summer');
    expect(blend.to).toBe('summer');
    expect(blend.t).toBe(0);
  });
});

// ── getSeasonalTint ─────────────────────────────────────────

describe('getSeasonalTint', () => {
  it('summer tint (rotation=0, week 30) has no color shift', () => {
    const tint = getSeasonalTint(30, 0);
    expect(tint.colorShift).toBe(0);
    expect(tint.warmth).toBe(0);
    expect(tint.snowCoverage).toBe(0);
    expect(tint.greenMul).toBe(1);
    expect(tint.saturation).toBe(1);
  });

  it('winter tint (rotation=0, week 3) has snow coverage and desaturation', () => {
    const tint = getSeasonalTint(3, 0);
    expect(tint.snowCoverage).toBeGreaterThan(0.3);
    expect(tint.saturation).toBeLessThan(0.7);
    expect(tint.greenMul).toBeLessThan(0.7);
  });

  it('spring tint (rotation=0, week 16) has green boost and saturation increase', () => {
    const tint = getSeasonalTint(16, 0);
    expect(tint.greenMul).toBeGreaterThan(1);
    expect(tint.saturation).toBeGreaterThan(1);
    expect(tint.snowCoverage).toBe(0);
  });

  it('autumn tint (rotation=0, week 42) has warmth and reduced green', () => {
    const tint = getSeasonalTint(42, 0);
    expect(tint.warmth).toBeGreaterThan(15);
    expect(tint.greenMul).toBeLessThan(0.75);
  });

  it('transition zones produce interpolated tints', () => {
    const winterTint = getSeasonalTint(3, 0);
    const springTint = getSeasonalTint(16, 0);
    const transitionTint = getSeasonalTint(10, 0); // W→Sp transition

    expect(transitionTint.snowCoverage).toBeLessThan(winterTint.snowCoverage);
    expect(transitionTint.snowCoverage).toBeGreaterThanOrEqual(springTint.snowCoverage);
  });
});

// ── lerpTint ────────────────────────────────────────────────

describe('lerpTint', () => {
  it('t=0 returns first tint', () => {
    const a: SeasonalTint = {
      colorShift: 0.5, colorTarget: [100, 100, 100],
      greenMul: 0.5, warmth: 10, snowCoverage: 0.5, saturation: 0.8,
    };
    const b: SeasonalTint = {
      colorShift: 0, colorTarget: [200, 200, 200],
      greenMul: 1.0, warmth: 0, snowCoverage: 0, saturation: 1.0,
    };
    const result = lerpTint(a, b, 0);
    expect(result.colorShift).toBe(0.5);
    expect(result.warmth).toBe(10);
  });

  it('t=1 returns second tint', () => {
    const a: SeasonalTint = {
      colorShift: 0.5, colorTarget: [100, 100, 100],
      greenMul: 0.5, warmth: 10, snowCoverage: 0.5, saturation: 0.8,
    };
    const b: SeasonalTint = {
      colorShift: 0, colorTarget: [200, 200, 200],
      greenMul: 1.0, warmth: 0, snowCoverage: 0, saturation: 1.0,
    };
    const result = lerpTint(a, b, 1);
    expect(result.colorShift).toBe(0);
    expect(result.warmth).toBe(0);
  });
});

// ── applyTint ───────────────────────────────────────────────

describe('applyTint', () => {
  it('summer tint (identity) preserves colors', () => {
    const summerTint = getSeasonalTint(30, 0);
    const [r, g, b] = applyTint(100, 150, 80, summerTint);
    expect(r).toBe(100);
    expect(g).toBe(150);
    expect(b).toBe(80);
  });

  it('winter tint shifts toward white/blue', () => {
    const winterTint = getSeasonalTint(3, 0);
    const [r] = applyTint(60, 140, 50, winterTint);
    expect(r).toBeGreaterThan(60);
  });

  it('autumn tint increases warmth (more red, less blue)', () => {
    const autumnTint = getSeasonalTint(42, 0);
    const [r, , b] = applyTint(100, 100, 100, autumnTint);
    expect(r).toBeGreaterThan(100);
    expect(b).toBeLessThan(100);
  });

  it('clamps to valid RGB range', () => {
    const extremeTint: SeasonalTint = {
      colorShift: 0, colorTarget: [0, 0, 0],
      greenMul: 3.0, warmth: 300, snowCoverage: 0, saturation: 1,
    };
    const [r, g, b] = applyTint(200, 200, 200, extremeTint);
    expect(r).toBeLessThanOrEqual(255);
    expect(g).toBeLessThanOrEqual(255);
    expect(b).toBeGreaterThanOrEqual(0);
  });
});

// ── applyTintToHex ──────────────────────────────────────────

describe('applyTintToHex', () => {
  it('returns valid hex color', () => {
    const result = applyTintToHex('#4a8828', getSeasonalTint(3, 0));
    expect(result).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('summer tint preserves hex color', () => {
    expect(applyTintToHex('#4a8828', getSeasonalTint(30, 0))).toBe('#4a8828');
  });
});

// ── getSeasonalPoolOverrides ────────────────────────────────

describe('getSeasonalPoolOverrides', () => {
  it('winter (rotation=0, week 3) adds snow assets and removes flowers', () => {
    const { add, remove } = getSeasonalPoolOverrides(3, 0, 50);
    expect(add.some(a => a.includes('snow') || a.includes('Snow'))).toBe(true);
    expect(remove.has('flower')).toBe(true);
    expect(remove.has('butterfly')).toBe(true);
  });

  it('spring (rotation=0, week 16) adds cherry blossoms and removes snow', () => {
    const { add, remove } = getSeasonalPoolOverrides(16, 0, 50);
    expect(add).toContain('cherryBlossom');
    expect(remove.has('snowman')).toBe(true);
  });

  it('autumn (rotation=0, week 42) adds maple trees and removes spring assets', () => {
    const { add, remove } = getSeasonalPoolOverrides(42, 0, 50);
    expect(add).toContain('autumnMaple');
    expect(remove.has('cherryBlossom')).toBe(true);
  });

  it('summer (rotation=0, week 30) removes winter/autumn assets', () => {
    const { remove } = getSeasonalPoolOverrides(30, 0, 50);
    expect(remove.has('snowman')).toBe(true);
    expect(remove.has('autumnMaple')).toBe(true);
  });

  it('settlement level gets appropriate seasonal assets', () => {
    const winterSettlement = getSeasonalPoolOverrides(3, 0, 80);
    expect(winterSettlement.add).toContain('igloo');
    expect(winterSettlement.add).toContain('sled');

    const springSettlement = getSeasonalPoolOverrides(16, 0, 80);
    expect(springSettlement.add).toContain('gardenBed');
  });
});
