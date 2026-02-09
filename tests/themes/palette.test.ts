import { describe, it, expect } from 'vitest';
import {
  getTerrainPalette100,
  getSeasonalPalette100,
  getTerrainPalette,
} from '../../src/themes/terrain/palette.js';

// ── getTerrainPalette100 (dark mode) ─────────────────────────

describe('getTerrainPalette100 dark mode', () => {
  const dark = getTerrainPalette100('dark');

  it('returns flat height for desert and water levels', () => {
    expect(dark.getHeight(0)).toBe(0);
    expect(dark.getHeight(5)).toBe(0);
    expect(dark.getHeight(15)).toBe(0);
  });

  it('returns increasing heights for land levels', () => {
    const h30 = dark.getHeight(30);
    const h50 = dark.getHeight(50);
    const h90 = dark.getHeight(90);
    expect(h30).toBeGreaterThan(0);
    expect(h50).toBeGreaterThan(h30);
    expect(h90).toBeGreaterThan(h50);
  });

  it('interpolates colors smoothly', () => {
    const e0 = dark.getElevation(0);
    const e50 = dark.getElevation(50);
    const e99 = dark.getElevation(99);
    expect(e0.top).not.toBe(e50.top);
    expect(e50.top).not.toBe(e99.top);
  });

  it('elevation has top, left, and right faces', () => {
    const e = dark.getElevation(50);
    expect(e.top).toMatch(/^#[0-9a-f]{6}$/);
    expect(e.left).toMatch(/^rgb\(/);
    expect(e.right).toMatch(/^rgb\(/);
  });

  it('left face is darker than top, right face is darker than left', () => {
    const e = dark.getElevation(50);
    // left is darken(rgb, 0.75), right is darken(rgb, 0.6)
    // Extract rgb values to compare
    const topR = parseInt(e.top.slice(1, 3), 16);
    const leftMatch = e.left.match(/(\d+)/g);
    const rightMatch = e.right.match(/(\d+)/g);
    expect(leftMatch).not.toBeNull();
    expect(rightMatch).not.toBeNull();
    const leftR = Number(leftMatch![0]);
    const rightR = Number(rightMatch![0]);
    expect(leftR).toBeLessThan(topR);
    expect(rightR).toBeLessThan(leftR);
  });

  it('cloud has fill, stroke, and opacity', () => {
    expect(dark.cloud.fill).toBeTruthy();
    expect(dark.cloud.stroke).toBeTruthy();
    expect(dark.cloud.opacity).toBeGreaterThan(0);
  });

  it('has expanded asset colors', () => {
    expect(dark.assets.deer).toBeTruthy();
    expect(dark.assets.castle).toBeTruthy();
    expect(dark.assets.flower).toBeTruthy();
    expect(dark.assets.seagull).toBeTruthy();
    expect(dark.assets.jellyfish).toBeTruthy();
    expect(dark.assets.snowCap).toBeTruthy();
  });

  it('has text colors', () => {
    expect(dark.text.primary).toBe('#e6edf3');
    expect(dark.text.secondary).toBe('#8b949e');
    expect(dark.text.accent).toBe('#58a6ff');
  });

  it('has background subtle color', () => {
    expect(dark.bg.subtle).toBe('#161b22');
  });

  it('pre-computes 10 sampled elevations and heights', () => {
    expect(dark.elevations).toHaveLength(10);
    expect(dark.heights).toHaveLength(10);
  });
});

// ── getTerrainPalette100 (light mode) ────────────────────────

describe('getTerrainPalette100 light mode', () => {
  const light = getTerrainPalette100('light');

  it('returns different text colors from dark mode', () => {
    expect(light.text.primary).toBe('#1f2328');
    expect(light.text.secondary).toBe('#656d76');
    expect(light.text.accent).toBe('#0969da');
  });

  it('returns different background from dark mode', () => {
    expect(light.bg.subtle).toBe('#f6f8fa');
  });

  it('cloud has higher opacity than dark mode', () => {
    const dark = getTerrainPalette100('dark');
    expect(light.cloud.opacity).toBeGreaterThan(dark.cloud.opacity);
  });

  it('returns increasing heights for land levels', () => {
    const h30 = light.getHeight(30);
    const h50 = light.getHeight(50);
    const h90 = light.getHeight(90);
    expect(h30).toBeGreaterThan(0);
    expect(h50).toBeGreaterThan(h30);
    expect(h90).toBeGreaterThan(h50);
  });

  it('has light-mode asset colors', () => {
    expect(light.assets.trunk).toBeTruthy();
    expect(light.assets.pine).toBeTruthy();
  });
});

// ── getSeasonalPalette100 ────────────────────────────────────

describe('getSeasonalPalette100', () => {
  it('summer zone (week 30, rotation 0) returns palette similar to base', () => {
    const base = getTerrainPalette100('dark');
    const seasonal = getSeasonalPalette100('dark', 30, 0);

    // Summer has no tinting, so elevation colors should be identical
    const baseElev = base.getElevation(50);
    const seasonalElev = seasonal.getElevation(50);
    expect(seasonalElev.top).toBe(baseElev.top);
    expect(seasonalElev.left).toBe(baseElev.left);
    expect(seasonalElev.right).toBe(baseElev.right);
  });

  it('summer zone returns base assets unchanged', () => {
    const base = getTerrainPalette100('dark');
    const seasonal = getSeasonalPalette100('dark', 30, 0);

    expect(seasonal.assets.trunk).toBe(base.assets.trunk);
    expect(seasonal.assets.pine).toBe(base.assets.pine);
    expect(seasonal.assets.water).toBe(base.assets.water);
  });

  it('winter zone (week 2, rotation 0) applies snow coverage (lighter colors)', () => {
    const base = getTerrainPalette100('dark');
    const winter = getSeasonalPalette100('dark', 2, 0);

    // Winter tinting blends toward white, so colors should differ from base
    const baseElev = base.getElevation(50);
    const winterElev = winter.getElevation(50);
    expect(winterElev.top).not.toBe(baseElev.top);

    // Extract RGB from hex to verify lighter colors (snow shifts toward 240,244,250)
    const baseR = parseInt(baseElev.top.slice(1, 3), 16);
    const winterR = parseInt(winterElev.top.slice(1, 3), 16);
    // Winter should shift colors lighter due to snow coverage
    expect(winterR).not.toBe(baseR);
  });

  it('winter zone changes asset colors via tinting', () => {
    const base = getTerrainPalette100('dark');
    const winter = getSeasonalPalette100('dark', 2, 0);

    // Hex asset colors should be tinted
    expect(winter.assets.pine).not.toBe(base.assets.pine);
    expect(winter.assets.leaf).not.toBe(base.assets.leaf);
  });

  it('autumn zone (week 42, rotation 0) applies warm tinting', () => {
    const base = getTerrainPalette100('dark');
    const autumn = getSeasonalPalette100('dark', 42, 0);

    // Autumn warmth adds red, so red channel should increase
    const baseElev = base.getElevation(50);
    const autumnElev = autumn.getElevation(50);
    expect(autumnElev.top).not.toBe(baseElev.top);
  });

  it('autumn zone tints asset colors with warmth', () => {
    const base = getTerrainPalette100('dark');
    const autumn = getSeasonalPalette100('dark', 42, 0);

    expect(autumn.assets.trunk).not.toBe(base.assets.trunk);
  });

  it('spring zone (week 16, rotation 0) applies green tinting', () => {
    const base = getTerrainPalette100('dark');
    const spring = getSeasonalPalette100('dark', 16, 0);

    // Spring boosts green channel and saturation
    const baseElev = base.getElevation(50);
    const springElev = spring.getElevation(50);
    expect(springElev.top).not.toBe(baseElev.top);
  });

  it('spring zone tints asset colors', () => {
    const base = getTerrainPalette100('dark');
    const spring = getSeasonalPalette100('dark', 16, 0);

    expect(spring.assets.leaf).not.toBe(base.assets.leaf);
  });

  it('preserves text, bg, and cloud from base palette', () => {
    const base = getTerrainPalette100('dark');
    const winter = getSeasonalPalette100('dark', 2, 0);

    expect(winter.text).toEqual(base.text);
    expect(winter.bg).toEqual(base.bg);
    expect(winter.cloud).toEqual(base.cloud);
  });

  it('light mode seasonal palette works correctly', () => {
    const base = getTerrainPalette100('light');
    const winter = getSeasonalPalette100('light', 2, 0);

    // Winter should tint light mode too
    const baseElev = base.getElevation(50);
    const winterElev = winter.getElevation(50);
    expect(winterElev.top).not.toBe(baseElev.top);
  });

  it('pre-computes 10 sampled elevations and heights for seasonal palettes', () => {
    const winter = getSeasonalPalette100('dark', 2, 0);
    expect(winter.elevations).toHaveLength(10);
    expect(winter.heights).toHaveLength(10);
  });

  it('tints rgba asset colors preserving format', () => {
    const winter = getSeasonalPalette100('dark', 2, 0);
    // smoke is rgba in the base palette
    expect(winter.assets.smoke).toMatch(/^rgba\(/);
  });
});

// ── getTerrainPalette (legacy API) ───────────────────────────

describe('getTerrainPalette (legacy)', () => {
  it('returns elevations array with 10 entries', () => {
    const palette = getTerrainPalette('dark');
    expect(palette.elevations).toHaveLength(10);
    for (const e of palette.elevations) {
      expect(e).toHaveProperty('top');
      expect(e).toHaveProperty('left');
      expect(e).toHaveProperty('right');
    }
  });

  it('returns heights array with 10 entries', () => {
    const palette = getTerrainPalette('dark');
    expect(palette.heights).toHaveLength(10);
    for (const h of palette.heights) {
      expect(typeof h).toBe('number');
    }
  });

  it('returns text colors', () => {
    const palette = getTerrainPalette('dark');
    expect(palette.text.primary).toBe('#e6edf3');
    expect(palette.text.secondary).toBe('#8b949e');
    expect(palette.text.accent).toBe('#58a6ff');
  });

  it('returns background subtle color', () => {
    const palette = getTerrainPalette('dark');
    expect(palette.bg.subtle).toBe('#161b22');
  });

  it('returns cloud as a CSS color string (not CloudColors object)', () => {
    const darkPalette = getTerrainPalette('dark');
    expect(typeof darkPalette.cloud).toBe('string');
    expect(darkPalette.cloud).toBe('rgba(200,210,220,0.10)');

    const lightPalette = getTerrainPalette('light');
    expect(typeof lightPalette.cloud).toBe('string');
    expect(lightPalette.cloud).toBe('rgba(255,255,255,0.45)');
  });

  it('returns asset colors', () => {
    const palette = getTerrainPalette('dark');
    expect(palette.assets.trunk).toBeTruthy();
    expect(palette.assets.pine).toBeTruthy();
    expect(palette.assets.water).toBeTruthy();
  });

  it('light mode returns different colors than dark mode', () => {
    const dark = getTerrainPalette('dark');
    const light = getTerrainPalette('light');
    expect(dark.text.primary).not.toBe(light.text.primary);
    expect(dark.bg.subtle).not.toBe(light.bg.subtle);
    expect(dark.cloud).not.toBe(light.cloud);
  });
});

// ── Interpolation edge cases ────────────────────────────────

describe('interpolation at exact anchor levels', () => {
  const dark = getTerrainPalette100('dark');

  it('getElevation at level 0 returns the first anchor colors', () => {
    const e = dark.getElevation(0);
    // Level 0 anchor is rgb(160,130,90) for dark
    expect(e.top).toBe('#a0825a');
  });

  it('getElevation at level 99 returns the last anchor colors', () => {
    const e = dark.getElevation(99);
    // Level 99 anchor is rgb(65,100,55) for dark
    expect(e.top).toBe('#416437');
  });

  it('getHeight at level 0 returns 0 (first anchor)', () => {
    expect(dark.getHeight(0)).toBe(0);
  });

  it('getHeight at level 99 returns 24 (last anchor)', () => {
    expect(dark.getHeight(99)).toBe(24);
  });

  it('getElevation at exactly an anchor level (12) returns that color without interpolation', () => {
    // Level 12 anchor is rgb(40,80,130) for dark
    const e = dark.getElevation(12);
    expect(e.top).toBe('#285082');
  });

  it('getHeight at exactly an anchor level (52) returns that height without interpolation', () => {
    // Level 52 anchor height is 8
    expect(dark.getHeight(52)).toBe(8);
  });
});

// ── Seasonal palette colorShift branch ──────────────────────

describe('getSeasonalPalette100 colorShift and tinting paths', () => {
  it('winter palette (colorShift=0.35) applies color target blending to elevation', () => {
    const base = getTerrainPalette100('dark');
    const winter = getSeasonalPalette100('dark', 2, 0);
    // Winter colorShift > 0 means applyTintValues blends toward colorTarget [238,242,248]
    // Verify at level 50 that colors differ from base
    const baseE = base.getElevation(50);
    const winterE = winter.getElevation(50);
    expect(winterE.top).not.toBe(baseE.top);
    // Winter should shift RGB toward cooler/whiter tones
    const baseR = parseInt(baseE.top.slice(1, 3), 16);
    const winterR = parseInt(winterE.top.slice(1, 3), 16);
    expect(winterR).toBeGreaterThan(baseR); // shifted toward 238
  });

  it('autumn palette (colorShift=0.12) applies golden target blending', () => {
    const base = getTerrainPalette100('dark');
    const autumn = getSeasonalPalette100('dark', 42, 0);
    const baseE = base.getElevation(50);
    const autumnE = autumn.getElevation(50);
    expect(autumnE.top).not.toBe(baseE.top);
    // Autumn colorTarget is [210,170,60], warmth=15
    const baseR = parseInt(baseE.top.slice(1, 3), 16);
    const autumnR = parseInt(autumnE.top.slice(1, 3), 16);
    expect(autumnR).toBeGreaterThan(baseR); // shifted toward warmer red
  });

  it('spring palette (colorShift=0.05) applies subtle pink blending', () => {
    const base = getTerrainPalette100('dark');
    const spring = getSeasonalPalette100('dark', 16, 0);
    const baseE = base.getElevation(50);
    const springE = spring.getElevation(50);
    expect(springE.top).not.toBe(baseE.top);
  });

  it('seasonal palette tints rgba asset colors (smoke)', () => {
    const winter = getSeasonalPalette100('dark', 2, 0);
    // smoke is rgba(180,180,180,0.4) in base. After winter tint, still rgba
    expect(winter.assets.smoke).toMatch(/^rgba\(/);
    // Should be different from base due to winter tinting
    const base = getTerrainPalette100('dark');
    expect(winter.assets.smoke).not.toBe(base.assets.smoke);
  });

  it('seasonal palette tints hex asset colors', () => {
    const winter = getSeasonalPalette100('dark', 2, 0);
    // trunk is a hex color in base
    expect(winter.assets.trunk).toMatch(/^#[0-9a-f]{6}$/);
    const base = getTerrainPalette100('dark');
    expect(winter.assets.trunk).not.toBe(base.assets.trunk);
  });
});
