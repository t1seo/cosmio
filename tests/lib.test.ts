import { describe, it, expect } from 'vitest';
import {
  fetchContributions,
  computeStats,
  getTheme,
  listThemes,
  registerTheme,
} from '../src/lib.js';

// ── Export existence ─────────────────────────────────────────

describe('lib exports', () => {
  it('fetchContributions is a function', () => {
    expect(typeof fetchContributions).toBe('function');
  });

  it('computeStats is a function', () => {
    expect(typeof computeStats).toBe('function');
  });

  it('getTheme is a function', () => {
    expect(typeof getTheme).toBe('function');
  });

  it('listThemes is a function', () => {
    expect(typeof listThemes).toBe('function');
  });

  it('registerTheme is a function', () => {
    expect(typeof registerTheme).toBe('function');
  });
});

// ── Theme registration via import side-effect ────────────────

describe('built-in theme registration', () => {
  it('getTheme("terrain") returns the terrain theme', () => {
    const theme = getTheme('terrain');
    expect(theme).toBeDefined();
    expect(theme!.name).toBe('terrain');
  });

  it('terrain theme has a render function', () => {
    const theme = getTheme('terrain');
    expect(typeof theme!.render).toBe('function');
  });

  it('terrain theme has displayName and description', () => {
    const theme = getTheme('terrain');
    expect(theme!.displayName).toBeTruthy();
    expect(theme!.description).toBeTruthy();
  });

  it('listThemes includes "terrain"', () => {
    const themes = listThemes();
    expect(themes).toContain('terrain');
  });

  it('getTheme returns undefined for non-existent theme', () => {
    const theme = getTheme('nonexistent-theme');
    expect(theme).toBeUndefined();
  });
});

// ── computeStats basic contract ──────────────────────────────

describe('computeStats via lib', () => {
  it('returns stats object with expected properties', () => {
    const weeks = [
      {
        firstDay: '2025-01-05',
        days: [
          { date: '2025-01-05', count: 0, level: 0 as const },
          { date: '2025-01-06', count: 3, level: 2 as const },
          { date: '2025-01-07', count: 0, level: 0 as const },
          { date: '2025-01-08', count: 5, level: 3 as const },
          { date: '2025-01-09', count: 1, level: 1 as const },
          { date: '2025-01-10', count: 0, level: 0 as const },
          { date: '2025-01-11', count: 2, level: 1 as const },
        ],
      },
    ];

    const stats = computeStats(weeks);
    expect(stats).toHaveProperty('total');
    expect(stats).toHaveProperty('longestStreak');
    expect(stats).toHaveProperty('currentStreak');
    expect(stats).toHaveProperty('mostActiveDay');
    expect(typeof stats.total).toBe('number');
    expect(typeof stats.longestStreak).toBe('number');
    expect(typeof stats.currentStreak).toBe('number');
    expect(typeof stats.mostActiveDay).toBe('string');
  });
});
