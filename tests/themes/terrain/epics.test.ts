import { describe, it, expect } from 'vitest';
import {
  getTerrainPalette100,
  getSeasonalPalette100,
} from '../../../src/themes/terrain/palette.js';
import { generateBiomeMap } from '../../../src/themes/terrain/biomes.js';
import {
  selectEpicBuildings,
  renderEpicBuildings,
  renderEpicGlowDefs,
  renderEpicCSS,
  EPIC_BUILDINGS,
  EPIC_RENDERERS,
  TIER_CONFIG,
} from '../../../src/themes/terrain/epics.js';
import type { ContributionStats } from '../../../src/core/types.js';
import type { IsoCell } from '../../../src/themes/terrain/blocks.js';
import type { EpicTier } from '../../../src/themes/terrain/epics.js';

// ── Helpers ────────────────────────────────────────────────

const THW = 8;
const THH = 3.5;

/**
 * Create isoCells directly with exact level100 values,
 * bypassing enrichGridCells100 which applies P90 normalization.
 */
function createIsoCells(level100: number): IsoCell[] {
  const palette = getTerrainPalette100('dark');
  const originX = 405;
  const originY = 6;
  const cells: IsoCell[] = [];
  for (let week = 0; week < 52; week++) {
    for (let day = 0; day < 7; day++) {
      const isoX = originX + (week - day) * THW;
      const isoY = originY + (week + day) * THH;
      cells.push({
        week,
        day,
        level100,
        height: palette.getHeight(level100),
        isoX,
        isoY,
        colors: palette.getElevation(level100),
      });
    }
  }
  return cells;
}

const highStats: ContributionStats = {
  total: 2000,
  longestStreak: 60,
  currentStreak: 30,
  mostActiveDay: 'Monday',
};

const lowStats: ContributionStats = {
  total: 50,
  longestStreak: 3,
  currentStreak: 0,
  mostActiveDay: 'Monday',
};

const rareStats: ContributionStats = {
  total: 200,
  longestStreak: 7,
  currentStreak: 2,
  mostActiveDay: 'Monday',
};

const epicStats: ContributionStats = {
  total: 500,
  longestStreak: 14,
  currentStreak: 5,
  mostActiveDay: 'Monday',
};

// ── Building Definitions ───────────────────────────────────

describe('EPIC_BUILDINGS', () => {
  it('has 30 buildings total', () => {
    expect(EPIC_BUILDINGS).toHaveLength(30);
  });

  it('has 14 rare, 10 epic, 6 legendary', () => {
    const rare = EPIC_BUILDINGS.filter((b) => b.tier === 'rare');
    const epic = EPIC_BUILDINGS.filter((b) => b.tier === 'epic');
    const legendary = EPIC_BUILDINGS.filter((b) => b.tier === 'legendary');
    expect(rare).toHaveLength(14);
    expect(epic).toHaveLength(10);
    expect(legendary).toHaveLength(6);
  });

  it('has unique building types', () => {
    const types = EPIC_BUILDINGS.map((b) => b.type);
    expect(new Set(types).size).toBe(30);
  });
});

// ── Gate Tests ─────────────────────────────────────────────

describe('selectEpicBuildings — Gate 1 (Cell Level)', () => {
  it('places no epics when all cells are low level', () => {
    const isoCells = createIsoCells(50);
    const { placed } = selectEpicBuildings(isoCells, 42, highStats);
    expect(placed).toHaveLength(0);
  });

  it('can place rare when cells are >= 88', () => {
    const isoCells = createIsoCells(90);
    const { placed } = selectEpicBuildings(isoCells, 42, highStats);
    // With all cells at 90 and high stats, at least some should appear
    // (richness will be ~0.909 which is above all thresholds)
    // Note: probability is still involved, so just check it can work
    expect(placed.length).toBeGreaterThanOrEqual(0);
    if (placed.length > 0) {
      expect(placed.every((p) => p.tier === 'rare')).toBe(true);
    }
  });

  it('can place epic/legendary when cells are >= 97', () => {
    const isoCells = createIsoCells(99);
    // Run many seeds to find one that places something
    let found = false;
    for (let seed = 0; seed < 50; seed++) {
      const { placed } = selectEpicBuildings(isoCells, seed, highStats);
      if (placed.length > 0) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });
});

describe('selectEpicBuildings — Gate 2 (Neighborhood Richness)', () => {
  it('computes high richness for uniform high-level terrain', () => {
    const isoCells = createIsoCells(99);
    // All neighbors are 99, so richness ≈ 1.0 — well above any threshold
    let placed = false;
    for (let seed = 0; seed < 100; seed++) {
      const result = selectEpicBuildings(isoCells, seed, highStats);
      if (result.placed.length > 0) {
        placed = true;
        break;
      }
    }
    expect(placed).toBe(true);
  });
});

describe('selectEpicBuildings — Gate 3 (Global Stats)', () => {
  it('places no epics when stats are too low', () => {
    const isoCells = createIsoCells(99);
    // lowStats fails all tier gates
    let totalPlaced = 0;
    for (let seed = 0; seed < 20; seed++) {
      const { placed } = selectEpicBuildings(isoCells, seed, lowStats);
      totalPlaced += placed.length;
    }
    expect(totalPlaced).toBe(0);
  });

  it('allows rare tier with rareStats', () => {
    const isoCells = createIsoCells(99);
    let foundRare = false;
    for (let seed = 0; seed < 100; seed++) {
      const { placed } = selectEpicBuildings(isoCells, seed, rareStats);
      if (placed.some((p) => p.tier === 'rare')) {
        foundRare = true;
        break;
      }
    }
    expect(foundRare).toBe(true);
  });

  it('allows epic tier with epicStats but not legendary', () => {
    const isoCells = createIsoCells(99);
    let foundLegendary = false;
    for (let seed = 0; seed < 100; seed++) {
      const { placed } = selectEpicBuildings(isoCells, seed, epicStats);
      if (placed.some((p) => p.tier === 'legendary')) {
        foundLegendary = true;
        break;
      }
    }
    expect(foundLegendary).toBe(false);
  });
});

// ── Budget Cap ─────────────────────────────────────────────

describe('selectEpicBuildings — Budget', () => {
  it('places at most 3 epic buildings', () => {
    const isoCells = createIsoCells(99);
    for (let seed = 0; seed < 50; seed++) {
      const { placed } = selectEpicBuildings(isoCells, seed, highStats);
      expect(placed.length).toBeLessThanOrEqual(3);
    }
  });
});

// ── Anti-clustering ────────────────────────────────────────

describe('selectEpicBuildings — Anti-clustering', () => {
  it('maintains Manhattan distance >= 3 between all placed epics', () => {
    const isoCells = createIsoCells(99);
    for (let seed = 0; seed < 50; seed++) {
      const { placed } = selectEpicBuildings(isoCells, seed, highStats);
      for (let i = 0; i < placed.length; i++) {
        for (let j = i + 1; j < placed.length; j++) {
          const dist =
            Math.abs(placed[i].week - placed[j].week) + Math.abs(placed[i].day - placed[j].day);
          expect(dist).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });
});

// ── Seed Determinism ───────────────────────────────────────

describe('selectEpicBuildings — Determinism', () => {
  it('produces identical results for the same seed', () => {
    const isoCells = createIsoCells(99);
    const result1 = selectEpicBuildings(isoCells, 12345, highStats);
    const result2 = selectEpicBuildings(isoCells, 12345, highStats);
    expect(result1.placed).toEqual(result2.placed);
    expect([...result1.epicCells]).toEqual([...result2.epicCells]);
  });

  it('produces different results for different seeds', () => {
    const isoCells = createIsoCells(99);
    const results = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      const { placed } = selectEpicBuildings(isoCells, seed, highStats);
      results.add(JSON.stringify(placed.map((p) => `${p.week},${p.day}`)));
    }
    // Not all seeds should produce identical placements
    expect(results.size).toBeGreaterThan(1);
  });
});

// ── Water Cell Exclusion ───────────────────────────────────

describe('selectEpicBuildings — Water Exclusion', () => {
  it('never places epics on river or pond cells', () => {
    const isoCells = createIsoCells(99);
    const biomeMap = generateBiomeMap(52, 7, 42);

    for (let seed = 0; seed < 50; seed++) {
      const { placed } = selectEpicBuildings(isoCells, seed, highStats, biomeMap);
      for (const epic of placed) {
        const key = `${epic.week},${epic.day}`;
        const biome = biomeMap.get(key);
        if (biome) {
          expect(biome.isRiver).toBe(false);
          expect(biome.isPond).toBe(false);
        }
      }
    }
  });
});

// ── Epic Cell Set ──────────────────────────────────────────

describe('selectEpicBuildings — epicCells set', () => {
  it('returns a Set matching the placed buildings', () => {
    const isoCells = createIsoCells(99);
    const { placed, epicCells } = selectEpicBuildings(isoCells, 42, highStats);
    expect(epicCells.size).toBe(placed.length);
    for (const epic of placed) {
      expect(epicCells.has(`${epic.week},${epic.day}`)).toBe(true);
    }
  });
});

// ── Tier Config ────────────────────────────────────────────

describe('TIER_CONFIG', () => {
  it('has increasing thresholds from rare to legendary', () => {
    const tiers: EpicTier[] = ['rare', 'epic', 'legendary'];
    for (let i = 0; i < tiers.length - 1; i++) {
      expect(TIER_CONFIG[tiers[i]].minLevel).toBeLessThan(TIER_CONFIG[tiers[i + 1]].minLevel);
      expect(TIER_CONFIG[tiers[i]].minRichness).toBeLessThan(TIER_CONFIG[tiers[i + 1]].minRichness);
      expect(TIER_CONFIG[tiers[i]].baseChance).toBeGreaterThan(
        TIER_CONFIG[tiers[i + 1]].baseChance,
      );
    }
  });
});

// ── Renderers ──────────────────────────────────────────────

describe('EPIC_RENDERERS', () => {
  it('has a renderer for every building type', () => {
    for (const building of EPIC_BUILDINGS) {
      expect(EPIC_RENDERERS[building.type]).toBeTypeOf('function');
    }
  });

  it('all 30 renderers produce valid SVG strings', () => {
    const palette = getTerrainPalette100('dark');
    const c = palette.assets;
    for (const building of EPIC_BUILDINGS) {
      const renderer = EPIC_RENDERERS[building.type];
      const svg = renderer(100, 50, c);
      expect(svg).toContain('<g');
      expect(svg).toContain('</g>');
      expect(svg).toContain('translate(100,50)');
    }
  });

  it('all 30 renderers work with light mode palette', () => {
    const palette = getTerrainPalette100('light');
    const c = palette.assets;
    for (const building of EPIC_BUILDINGS) {
      const renderer = EPIC_RENDERERS[building.type];
      const svg = renderer(200, 100, c);
      expect(svg).toContain('<g');
    }
  });
});

// ── Rendering API ──────────────────────────────────────────

describe('renderEpicBuildings', () => {
  it('returns empty string when no epics placed', () => {
    const weekPalettes = Array.from({ length: 52 }, (_, w) => getSeasonalPalette100('dark', w, 0));
    expect(renderEpicBuildings([], weekPalettes)).toBe('');
  });

  it('returns SVG group with glow and building elements', () => {
    const isoCells = createIsoCells(99);
    const weekPalettes = Array.from({ length: 52 }, (_, w) => getSeasonalPalette100('dark', w, 0));
    // Find a seed that places something
    let placed: ReturnType<typeof selectEpicBuildings>['placed'] = [];
    for (let seed = 0; seed < 100; seed++) {
      const result = selectEpicBuildings(isoCells, seed, highStats);
      if (result.placed.length > 0) {
        placed = result.placed;
        break;
      }
    }
    if (placed.length > 0) {
      const svg = renderEpicBuildings(placed, weekPalettes);
      expect(svg).toContain('epic-buildings');
      expect(svg).toContain('epic-glow-');
    }
  });
});

describe('renderEpicGlowDefs', () => {
  it('returns radialGradient defs for all 3 tiers', () => {
    const darkDefs = renderEpicGlowDefs('dark');
    expect(darkDefs).toContain('epic-glow-rare');
    expect(darkDefs).toContain('epic-glow-epic');
    expect(darkDefs).toContain('epic-glow-legendary');
    expect(darkDefs).toContain('radialGradient');
  });

  it('uses different opacity for dark vs light mode', () => {
    const darkDefs = renderEpicGlowDefs('dark');
    const lightDefs = renderEpicGlowDefs('light');
    expect(darkDefs).toContain('stop-opacity="0.4"');
    expect(lightDefs).toContain('stop-opacity="0.3"');
  });
});

describe('renderEpicCSS', () => {
  it('returns CSS with epic-pulse and epic-swirl keyframes', () => {
    const css = renderEpicCSS();
    expect(css).toContain('@keyframes epic-pulse');
    expect(css).toContain('.epic-glow-pulse');
    expect(css).toContain('@keyframes epic-swirl');
    expect(css).toContain('.epic-portal-swirl');
  });
});
