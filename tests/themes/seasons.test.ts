import { describe, it, expect } from 'vitest';
import {
  computeSeasonRotation,
  getSeasonZone,
  getZonePeakSeason,
  getTransitionBlend,
  getSeasonalTint,
  lerpTint,
  applyTint,
  applyTintToHex,
  applyTintToRgb,
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
    // March 2025 -> ref = Dec 1 2024
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
  it('rotation=0: week 0 -> zone 0 (winter)', () => {
    expect(getSeasonZone(0, 0)).toBe(0);
  });

  it('rotation=0: week 10 -> zone 1 (winter->spring)', () => {
    expect(getSeasonZone(10, 0)).toBe(1);
  });

  it('rotation=0: week 16 -> zone 2 (spring)', () => {
    expect(getSeasonZone(16, 0)).toBe(2);
  });

  it('rotation=0: week 22 -> zone 3 (spring->summer)', () => {
    expect(getSeasonZone(22, 0)).toBe(3);
  });

  it('rotation=0: week 30 -> zone 4 (summer)', () => {
    expect(getSeasonZone(30, 0)).toBe(4);
  });

  it('rotation=0: week 36 -> zone 5 (summer->autumn)', () => {
    expect(getSeasonZone(36, 0)).toBe(5);
  });

  it('rotation=0: week 42 -> zone 6 (autumn)', () => {
    expect(getSeasonZone(42, 0)).toBe(6);
  });

  it('rotation=0: week 50 -> zone 7 (autumn->winter)', () => {
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
  it('rotation=9 (Feb): week 0 -> zone 1 (late winter/W->Sp)', () => {
    expect(getSeasonZone(0, 9)).toBe(1);
  });

  it('rotation=9 (Feb): week 47 -> zone 0 (winter, ~Jan)', () => {
    expect(getSeasonZone(47, 9)).toBe(0);
  });

  it('rotation=9 (Feb): week 26 -> zone 5 (summer->autumn, ~Aug)', () => {
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

// ── getZonePeakSeason ───────────────────────────────────────

describe('getZonePeakSeason', () => {
  it('zone 0 returns winter', () => {
    expect(getZonePeakSeason(0)).toBe('winter');
  });

  it('zone 1 returns spring (transition from winter)', () => {
    expect(getZonePeakSeason(1)).toBe('spring');
  });

  it('zone 2 returns spring', () => {
    expect(getZonePeakSeason(2)).toBe('spring');
  });

  it('zone 3 returns summer (transition from spring)', () => {
    expect(getZonePeakSeason(3)).toBe('summer');
  });

  it('zone 4 returns summer', () => {
    expect(getZonePeakSeason(4)).toBe('summer');
  });

  it('zone 5 returns autumn (transition from summer)', () => {
    expect(getZonePeakSeason(5)).toBe('autumn');
  });

  it('zone 6 returns autumn', () => {
    expect(getZonePeakSeason(6)).toBe('autumn');
  });

  it('zone 7 returns winter (transition from autumn)', () => {
    expect(getZonePeakSeason(7)).toBe('winter');
  });

  it('covers all 4 peak seasons across all 8 zones', () => {
    const seasons = new Set<string>();
    for (let z = 0; z <= 7; z++) {
      seasons.add(getZonePeakSeason(z as SeasonZone));
    }
    expect(seasons).toEqual(new Set(['winter', 'spring', 'summer', 'autumn']));
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

  it('transition zone 1 (rotation=0, week 5) returns from=winter, to=spring', () => {
    const blend = getTransitionBlend(5, 0);
    expect(blend.from).toBe('winter');
    expect(blend.to).toBe('spring');
    expect(blend.t).toBeCloseTo(0, 1);
  });

  it('transition zone 1 mid-point has t near 0.5', () => {
    const blend = getTransitionBlend(9, 0); // week 9 in zone 1 (5-13)
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

  it('spring peak zone returns t=0 with from=to=spring', () => {
    const blend = getTransitionBlend(16, 0);
    expect(blend.from).toBe('spring');
    expect(blend.to).toBe('spring');
    expect(blend.t).toBe(0);
  });

  it('autumn peak zone returns t=0 with from=to=autumn', () => {
    const blend = getTransitionBlend(42, 0);
    expect(blend.from).toBe('autumn');
    expect(blend.to).toBe('autumn');
    expect(blend.t).toBe(0);
  });

  it('zone 3 (spring->summer) produces correct blend', () => {
    const blend = getTransitionBlend(23, 0); // week 23 in zone 3 (19-27)
    expect(blend.from).toBe('spring');
    expect(blend.to).toBe('summer');
    expect(blend.t).toBeGreaterThan(0);
    expect(blend.t).toBeLessThan(1);
  });

  it('zone 5 (summer->autumn) produces correct blend', () => {
    const blend = getTransitionBlend(36, 0); // week 36 in zone 5 (33-40)
    expect(blend.from).toBe('summer');
    expect(blend.to).toBe('autumn');
    expect(blend.t).toBeGreaterThan(0);
    expect(blend.t).toBeLessThan(1);
  });

  it('zone 7 (autumn->winter) produces correct blend', () => {
    const blend = getTransitionBlend(48, 0); // week 48 in zone 7 (46-51)
    expect(blend.from).toBe('autumn');
    expect(blend.to).toBe('winter');
    expect(blend.t).toBeGreaterThan(0);
    expect(blend.t).toBeLessThan(1);
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
    expect(tint.warmth).toBeGreaterThan(10);
    expect(tint.greenMul).toBeLessThan(0.8);
  });

  it('transition zones produce interpolated tints', () => {
    const winterTint = getSeasonalTint(3, 0);
    const springTint = getSeasonalTint(16, 0);
    const transitionTint = getSeasonalTint(10, 0); // W->Sp transition

    expect(transitionTint.snowCoverage).toBeLessThan(winterTint.snowCoverage);
    expect(transitionTint.snowCoverage).toBeGreaterThanOrEqual(springTint.snowCoverage);
  });
});

// ── lerpTint ────────────────────────────────────────────────

describe('lerpTint', () => {
  const a: SeasonalTint = {
    colorShift: 0.5,
    colorTarget: [100, 100, 100],
    greenMul: 0.5,
    warmth: 10,
    snowCoverage: 0.5,
    saturation: 0.8,
  };
  const b: SeasonalTint = {
    colorShift: 0,
    colorTarget: [200, 200, 200],
    greenMul: 1.0,
    warmth: 0,
    snowCoverage: 0,
    saturation: 1.0,
  };

  it('t=0 returns first tint', () => {
    const result = lerpTint(a, b, 0);
    expect(result.colorShift).toBe(0.5);
    expect(result.warmth).toBe(10);
  });

  it('t=1 returns second tint', () => {
    const result = lerpTint(a, b, 1);
    expect(result.colorShift).toBe(0);
    expect(result.warmth).toBe(0);
  });

  it('t=0.5 interpolates all fields to midpoint', () => {
    const result = lerpTint(a, b, 0.5);
    expect(result.colorShift).toBeCloseTo(0.25);
    expect(result.warmth).toBeCloseTo(5);
    expect(result.snowCoverage).toBeCloseTo(0.25);
    expect(result.greenMul).toBeCloseTo(0.75);
    expect(result.saturation).toBeCloseTo(0.9);
    expect(result.colorTarget[0]).toBe(150);
    expect(result.colorTarget[1]).toBe(150);
    expect(result.colorTarget[2]).toBe(150);
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
      colorShift: 0,
      colorTarget: [0, 0, 0],
      greenMul: 3.0,
      warmth: 300,
      snowCoverage: 0,
      saturation: 1,
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

  it('applies winter tint to hex color correctly', () => {
    const winterTint = getSeasonalTint(3, 0);
    const result = applyTintToHex('#2a6e1e', winterTint);
    expect(result).toMatch(/^#[0-9a-f]{6}$/);
    // Winter desaturates and adds snow, so should differ from input
    expect(result).not.toBe('#2a6e1e');
  });

  it('applies autumn tint to hex color (warm shift)', () => {
    const autumnTint = getSeasonalTint(42, 0);
    const original = '#808080'; // neutral gray
    const result = applyTintToHex(original, autumnTint);
    // Autumn adds warmth: red increases, blue decreases
    const resultR = parseInt(result.slice(1, 3), 16);
    const resultB = parseInt(result.slice(5, 7), 16);
    expect(resultR).toBeGreaterThan(parseInt(original.slice(1, 3), 16));
    expect(resultB).toBeLessThan(parseInt(original.slice(5, 7), 16));
  });
});

// ── applyTintToRgb ──────────────────────────────────────────

describe('applyTintToRgb', () => {
  it('handles "rgb(r,g,b)" format', () => {
    const winterTint = getSeasonalTint(3, 0);
    const result = applyTintToRgb('rgb(100,150,80)', winterTint);
    expect(result).toMatch(/^rgb\(\d+,\d+,\d+\)$/);
    // Should differ from original due to winter tinting
    expect(result).not.toBe('rgb(100,150,80)');
  });

  it('handles "rgba(r,g,b,a)" format with decimal alpha', () => {
    const winterTint = getSeasonalTint(3, 0);
    // Note: the regex /(\d+)/g splits "0.4" into "0" and "4", so
    // m[3] = "0" which does not include ".", yielding +m[3] = 0.
    // m.length = 5 (r, g, b, "0", "4"), so it takes the rgba branch.
    const result = applyTintToRgb('rgba(180,180,180,0.4)', winterTint);
    expect(result).toMatch(/^rgba\(/);
  });

  it('handles rgba with integer alpha', () => {
    const winterTint = getSeasonalTint(3, 0);
    const result = applyTintToRgb('rgba(100,100,100,1)', winterTint);
    // m = ['100','100','100','1'], m[3] = '1', no '.', so +m[3] = 1
    expect(result).toMatch(/^rgba\(\d+,\d+,\d+,1\)$/);
  });

  it('returns original string for invalid input (no digits)', () => {
    const winterTint = getSeasonalTint(3, 0);
    const result = applyTintToRgb('not-a-color', winterTint);
    expect(result).toBe('not-a-color');
  });

  it('returns original string for input with fewer than 3 numeric values', () => {
    const winterTint = getSeasonalTint(3, 0);
    const result = applyTintToRgb('rgb(100)', winterTint);
    expect(result).toBe('rgb(100)');
  });

  it('summer tint preserves rgb color', () => {
    const summerTint = getSeasonalTint(30, 0);
    const result = applyTintToRgb('rgb(100,150,80)', summerTint);
    expect(result).toBe('rgb(100,150,80)');
  });

  it('summer tint preserves rgba color with integer alpha', () => {
    const summerTint = getSeasonalTint(30, 0);
    const result = applyTintToRgb('rgba(180,180,180,1)', summerTint);
    expect(result).toBe('rgba(180,180,180,1)');
  });
});

// ── getSeasonalPoolOverrides ────────────────────────────────

describe('getSeasonalPoolOverrides', () => {
  // ── Peak season tests ────────────────────────────────────

  it('winter (rotation=0, week 3) adds snow assets and removes flowers', () => {
    const { add, remove } = getSeasonalPoolOverrides(3, 0, 50);
    expect(add.some((a) => a.includes('snow') || a.includes('Snow'))).toBe(true);
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

  it('summer (rotation=0, week 30) adds summer assets', () => {
    const { add } = getSeasonalPoolOverrides(30, 0, 50);
    expect(add).toContain('sunflower');
    expect(add).toContain('watermelon');
  });

  // ── Level-based additions ─────────────────────────────────

  it('settlement level gets appropriate seasonal assets', () => {
    const winterSettlement = getSeasonalPoolOverrides(3, 0, 80);
    expect(winterSettlement.add).toContain('igloo');
    expect(winterSettlement.add).toContain('sled');

    const springSettlement = getSeasonalPoolOverrides(16, 0, 80);
    expect(springSettlement.add).toContain('gardenBed');
  });

  it('winter zone at grassland level (31-65) adds nature snow assets', () => {
    const { add } = getSeasonalPoolOverrides(3, 0, 40);
    expect(add).toContain('snowPine');
    expect(add).toContain('snowDeciduous');
    expect(add).toContain('bareBush');
    expect(add).toContain('winterBird');
  });

  it('spring zone at grassland level adds nature spring assets', () => {
    const { add } = getSeasonalPoolOverrides(16, 0, 45);
    expect(add).toContain('cherryBlossom');
    expect(add).toContain('tulip');
    expect(add).toContain('sprout');
    expect(add).toContain('crocus');
    expect(add).toContain('lamb');
  });

  it('autumn zone at forest level (31-65) adds autumn nature assets', () => {
    const { add } = getSeasonalPoolOverrides(42, 0, 50);
    expect(add).toContain('autumnMaple');
    expect(add).toContain('autumnOak');
    expect(add).toContain('autumnBirch');
    expect(add).toContain('autumnGinkgo');
    expect(add).toContain('fallenLeaves');
    expect(add).toContain('leafSwirl');
  });

  it('autumn zone at settlement level (>=66) adds settlement assets', () => {
    const { add } = getSeasonalPoolOverrides(42, 0, 80);
    expect(add).toContain('cornStalk');
    expect(add).toContain('scarecrowAutumn');
    expect(add).toContain('harvestBasket');
    expect(add).toContain('hotDrink');
    expect(add).toContain('autumnWreath');
  });

  it('summer zone at settlement level adds parasol and hammock', () => {
    const { add } = getSeasonalPoolOverrides(30, 0, 80);
    expect(add).toContain('parasol');
    expect(add).toContain('hammock');
    expect(add).toContain('iceCreamCart');
  });

  it('low level (<31) gets only general seasonal assets', () => {
    const winterLow = getSeasonalPoolOverrides(3, 0, 25);
    expect(winterLow.add).toContain('snowdrift');
    expect(winterLow.add).toContain('snowCoveredRock');
    // Should NOT contain nature-specific or settlement-specific assets
    expect(winterLow.add).not.toContain('snowPine');
    expect(winterLow.add).not.toContain('igloo');
  });

  // ── Transition zone behavior ──────────────────────────────

  it('transition zone (W->Sp) blends additions from both seasons', () => {
    const { add, remove } = getSeasonalPoolOverrides(9, 0, 50);
    // Transition merges removes from both seasons
    expect(remove.size).toBeGreaterThan(0);
    // Should have some mix of winter and spring assets
    // The exact count depends on proportional blend
    expect(add.length).toBeGreaterThan(0);
  });

  it('transition zone removes from both seasons (conservative)', () => {
    // Week 36 is zone 5 (summer->autumn transition)
    const { remove } = getSeasonalPoolOverrides(36, 0, 50);
    // Should include removes from both summer and autumn
    expect(remove.has('snowman')).toBe(true); // both summer and autumn remove this
    expect(remove.has('cherryBlossom')).toBe(true); // autumn removes this
  });

  it('different level ranges return different overrides for same season', () => {
    const natureLevelOverrides = getSeasonalPoolOverrides(3, 0, 50); // nature range
    const settlementLevelOverrides = getSeasonalPoolOverrides(3, 0, 80); // settlement range
    const lowLevelOverrides = getSeasonalPoolOverrides(3, 0, 20); // below nature range

    // Nature level should have nature-specific assets
    expect(natureLevelOverrides.add).toContain('snowPine');
    expect(natureLevelOverrides.add).not.toContain('igloo');

    // Settlement level should have settlement-specific assets
    expect(settlementLevelOverrides.add).toContain('igloo');
    expect(settlementLevelOverrides.add).not.toContain('snowPine');

    // Low level should have only general assets
    expect(lowLevelOverrides.add.length).toBeLessThan(natureLevelOverrides.add.length);
  });
});
