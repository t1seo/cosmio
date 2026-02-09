import { describe, it, expect } from 'vitest';
import { terrainTheme } from '../../../src/themes/terrain/index.js';
import {
  createMockContributionData,
  createFullContributionData,
  createEmptyContributionData,
} from '../../fixtures/contribution-data.js';
import { computeStats } from '../../../src/core/stats.js';
import type { ThemeOptions, ContributionData } from '../../../src/core/types.js';

// ── Shared options ───────────────────────────────────────────

const defaultOptions: ThemeOptions = {
  title: '@testuser',
  width: 840,
  height: 240,
};

// ── Theme identity ──────────────────────────────────────────

describe('terrainTheme identity', () => {
  it('has name "terrain"', () => {
    expect(terrainTheme.name).toBe('terrain');
  });

  it('has displayName "Terrain"', () => {
    expect(terrainTheme.displayName).toBe('Terrain');
  });

  it('has a non-empty description', () => {
    expect(terrainTheme.description).toBeTruthy();
    expect(terrainTheme.description.length).toBeGreaterThan(0);
  });

  it('has a render function', () => {
    expect(typeof terrainTheme.render).toBe('function');
  });
});

// ── Render output structure ──────────────────────────────────

describe('terrainTheme.render', () => {
  const data = createMockContributionData();
  const result = terrainTheme.render(data, defaultOptions);

  it('returns an object with dark and light SVG strings', () => {
    expect(result).toHaveProperty('dark');
    expect(result).toHaveProperty('light');
    expect(typeof result.dark).toBe('string');
    expect(typeof result.light).toBe('string');
  });

  it('dark SVG contains svg root element', () => {
    expect(result.dark).toMatch(/^<svg/);
    expect(result.dark).toMatch(/<\/svg>$/);
  });

  it('light SVG contains svg root element', () => {
    expect(result.light).toMatch(/^<svg/);
    expect(result.light).toMatch(/<\/svg>$/);
  });

  it('both modes contain terrain-blocks layer', () => {
    expect(result.dark).toContain('terrain-blocks');
    expect(result.light).toContain('terrain-blocks');
  });

  it('both modes contain terrain-assets layer', () => {
    expect(result.dark).toContain('terrain-assets');
    expect(result.light).toContain('terrain-assets');
  });

  it('both modes contain terrain-clouds layer', () => {
    expect(result.dark).toContain('terrain-clouds');
    expect(result.light).toContain('terrain-clouds');
  });

  it('both modes contain stats-bar', () => {
    expect(result.dark).toContain('stats-bar');
    expect(result.light).toContain('stats-bar');
  });

  it('dark and light produce different SVGs', () => {
    expect(result.dark).not.toBe(result.light);
  });
});

// ── Empty data rendering ─────────────────────────────────────

describe('render with empty data (all zeros)', () => {
  const data = createEmptyContributionData();
  const result = terrainTheme.render(data, defaultOptions);

  it('renders dark SVG without errors', () => {
    expect(result.dark).toMatch(/^<svg/);
    expect(result.dark).toMatch(/<\/svg>$/);
  });

  it('renders light SVG without errors', () => {
    expect(result.light).toMatch(/^<svg/);
    expect(result.light).toMatch(/<\/svg>$/);
  });

  it('still contains terrain-blocks and terrain-assets', () => {
    expect(result.dark).toContain('terrain-blocks');
    expect(result.dark).toContain('terrain-assets');
    expect(result.light).toContain('terrain-blocks');
    expect(result.light).toContain('terrain-assets');
  });

  it('contains stats-bar with zero values', () => {
    expect(result.dark).toContain('stats-bar');
    expect(result.dark).toContain('0 contributions');
  });
});

// ── Full data rendering ──────────────────────────────────────

describe('render with full data (all level 4)', () => {
  const data = createFullContributionData();
  const result = terrainTheme.render(data, defaultOptions);

  it('renders dark SVG without errors', () => {
    expect(result.dark).toMatch(/^<svg/);
    expect(result.dark).toMatch(/<\/svg>$/);
  });

  it('renders light SVG without errors', () => {
    expect(result.light).toMatch(/^<svg/);
    expect(result.light).toMatch(/<\/svg>$/);
  });

  it('contains all expected layers', () => {
    expect(result.dark).toContain('terrain-blocks');
    expect(result.dark).toContain('terrain-assets');
    expect(result.dark).toContain('terrain-clouds');
    expect(result.dark).toContain('stats-bar');
  });

  it('SVGs are substantially long (complex terrain)', () => {
    // Full contribution data should produce large SVGs with many elements
    expect(result.dark.length).toBeGreaterThan(1000);
    expect(result.light.length).toBeGreaterThan(1000);
  });
});

// ── Realistic mock data rendering ────────────────────────────

describe('render with realistic mock data', () => {
  const data = createMockContributionData();
  const _stats = computeStats(data.weeks);
  const result = terrainTheme.render(data, defaultOptions);

  it('renders valid SVGs', () => {
    expect(result.dark).toMatch(/^<svg/);
    expect(result.light).toMatch(/^<svg/);
  });

  it('includes the title in the SVG', () => {
    expect(result.dark).toContain('@testuser');
    expect(result.light).toContain('@testuser');
  });

  it('contains polygon elements for isometric blocks', () => {
    expect(result.dark).toContain('<polygon');
    expect(result.light).toContain('<polygon');
  });

  it('contains style element with CSS animations', () => {
    expect(result.dark).toContain('<style>');
    expect(result.dark).toContain('@keyframes');
  });

  it('recomputes stats from week data', () => {
    // The theme internally calls computeStats, which should produce valid stats
    // that appear in the stats bar
    expect(result.dark).toContain('contributions');
    expect(result.dark).toContain('streak');
  });
});

// ── Hemisphere option ────────────────────────────────────────

describe('render with hemisphere option', () => {
  const data = createMockContributionData();

  it('accepts hemisphere "north" without errors', () => {
    const result = terrainTheme.render(data, { ...defaultOptions, hemisphere: 'north' });
    expect(result.dark).toMatch(/^<svg/);
    expect(result.light).toMatch(/^<svg/);
  });

  it('accepts hemisphere "south" without errors', () => {
    const result = terrainTheme.render(data, { ...defaultOptions, hemisphere: 'south' });
    expect(result.dark).toMatch(/^<svg/);
    expect(result.light).toMatch(/^<svg/);
  });

  it('south hemisphere produces different output from north', () => {
    const northResult = terrainTheme.render(data, { ...defaultOptions, hemisphere: 'north' });
    const southResult = terrainTheme.render(data, { ...defaultOptions, hemisphere: 'south' });
    // Season rotation differs by ~26 weeks, so the seasonal coloring and assets differ
    expect(northResult.dark).not.toBe(southResult.dark);
  });

  it('south hemisphere SVGs contain all expected layers', () => {
    const result = terrainTheme.render(data, { ...defaultOptions, hemisphere: 'south' });
    expect(result.dark).toContain('terrain-blocks');
    expect(result.dark).toContain('terrain-assets');
    expect(result.dark).toContain('terrain-clouds');
    expect(result.dark).toContain('stats-bar');
  });
});

// ── Custom title ─────────────────────────────────────────────

describe('render with custom title', () => {
  const data = createMockContributionData();

  it('uses the provided title text', () => {
    const result = terrainTheme.render(data, { ...defaultOptions, title: 'My Custom Title' });
    expect(result.dark).toContain('My Custom Title');
    expect(result.light).toContain('My Custom Title');
  });
});

// ── Empty weeks data (fallback date branch) ─────────────────

describe('render with empty weeks array', () => {
  it('renders without errors when weeks array is empty', () => {
    const emptyWeeksData: ContributionData = {
      weeks: [],
      stats: { total: 0, longestStreak: 0, currentStreak: 0, mostActiveDay: '' },
      year: 2025,
      username: 'emptyweeksuser',
    };
    const result = terrainTheme.render(emptyWeeksData, defaultOptions);
    expect(result.dark).toMatch(/^<svg/);
    expect(result.dark).toMatch(/<\/svg>$/);
    expect(result.light).toMatch(/^<svg/);
    expect(result.light).toMatch(/<\/svg>$/);
  });

  it('renders with weeks that have empty days arrays', () => {
    const emptyDaysData: ContributionData = {
      weeks: [{ firstDay: '2025-01-01', days: [] }],
      stats: { total: 0, longestStreak: 0, currentStreak: 0, mostActiveDay: '' },
      year: 2025,
      username: 'emptydaysuser',
    };
    const result = terrainTheme.render(emptyDaysData, defaultOptions);
    expect(result.dark).toMatch(/^<svg/);
    expect(result.dark).toMatch(/<\/svg>$/);
  });
});
