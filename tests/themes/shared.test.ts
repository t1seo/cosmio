import { describe, it, expect } from 'vitest';
import {
  renderTitle,
  renderStatsBar,
  contributionGrid,
  computeLevel10,
  enrichGridCells,
  computeLevel100,
  enrichGridCells100,
} from '../../src/themes/shared.js';
import type { ThemePalette } from '../../src/core/types.js';
import {
  createMockContributionData,
  createEmptyContributionData,
} from '../fixtures/contribution-data.js';

// ── Mock palette for renderTitle / renderStatsBar ────────────

const palette: ThemePalette = {
  text: { primary: '#e6edf3', secondary: '#8b949e', accent: '#7C3AED' },
  contribution: {
    levels: [
      { hex: '#161b22', opacity: 0.5 },
      { hex: '#0e4429', opacity: 1 },
      { hex: '#006d32', opacity: 1 },
      { hex: '#26a641', opacity: 1 },
      { hex: '#39d353', opacity: 1 },
    ],
  },
  background: { subtle: '#161b22' },
};

// ── renderTitle ──────────────────────────────────────────────

describe('renderTitle', () => {
  it('returns an SVG text element with the title', () => {
    const result = renderTitle('My Graph', palette);
    expect(result).toContain('<text');
    expect(result).toContain('My Graph');
    expect(result).toContain('</text>');
  });

  it('escapes XML characters in title', () => {
    const result = renderTitle('A & B <C> "D" \'E\'', palette);
    expect(result).toContain('A &amp; B &lt;C&gt; &quot;D&quot; &apos;E&apos;');
    expect(result).not.toContain('A & B');
  });

  it('uses palette text.primary as fill color', () => {
    const result = renderTitle('Test', palette);
    expect(result).toContain(`fill="${palette.text.primary}"`);
  });

  it('sets x, y, font-size, and font-weight attributes', () => {
    const result = renderTitle('Test', palette);
    expect(result).toContain('x="24"');
    expect(result).toContain('y="17"');
    expect(result).toContain('font-size="14"');
    expect(result).toContain('font-weight="600"');
  });
});

// ── renderStatsBar ───────────────────────────────────────────

describe('renderStatsBar', () => {
  const stats = {
    total: 1247,
    longestStreak: 42,
    currentStreak: 7,
    mostActiveDay: 'Wednesday',
  };

  it('wraps output in a g.stats-bar element', () => {
    const result = renderStatsBar(stats, palette);
    expect(result).toMatch(/^<g class="stats-bar">.*<\/g>$/);
  });

  it('contains 4 stat items as text elements', () => {
    const result = renderStatsBar(stats, palette);
    const textCount = (result.match(/<text /g) || []).length;
    expect(textCount).toBe(4);
  });

  it('formats numbers with comma separators', () => {
    const result = renderStatsBar(stats, palette);
    expect(result).toContain('1,247 contributions');
  });

  it('includes streak and most active day info', () => {
    const result = renderStatsBar(stats, palette);
    expect(result).toContain('7d current streak');
    expect(result).toContain('42d longest streak');
    expect(result).toContain('Most active: Wednesday');
  });

  it('uses palette text.secondary as fill color', () => {
    const result = renderStatsBar(stats, palette);
    expect(result).toContain(`fill="${palette.text.secondary}"`);
  });

  it('spaces stat items 200px apart horizontally', () => {
    const result = renderStatsBar(stats, palette);
    expect(result).toContain('x="24"');
    expect(result).toContain('x="224"');
    expect(result).toContain('x="424"');
    expect(result).toContain('x="624"');
  });
});

// ── contributionGrid ─────────────────────────────────────────

describe('contributionGrid', () => {
  const data = createMockContributionData();
  const options = { cellSize: 10, gap: 2, offsetX: 20, offsetY: 30 };

  it('returns cells with correct x positions based on week index', () => {
    const cells = contributionGrid(data, options);
    // First cell in week 0, day 0
    expect(cells[0].x).toBe(20);
    // First cell in week 1 (index 7 since each week has 7 days)
    expect(cells[7].x).toBe(20 + 1 * (10 + 2));
  });

  it('returns cells with correct y positions based on day index', () => {
    const cells = contributionGrid(data, options);
    expect(cells[0].y).toBe(30); // day 0
    expect(cells[1].y).toBe(30 + 1 * (10 + 2)); // day 1
    expect(cells[6].y).toBe(30 + 6 * (10 + 2)); // day 6
  });

  it('preserves level and count from contribution data', () => {
    const cells = contributionGrid(data, options);
    const firstDay = data.weeks[0].days[0];
    expect(cells[0].level).toBe(firstDay.level);
    expect(cells[0].count).toBe(firstDay.count);
  });

  it('preserves date from contribution data', () => {
    const cells = contributionGrid(data, options);
    expect(cells[0].date).toBe(data.weeks[0].days[0].date);
  });

  it('produces 7 cells per week', () => {
    const cells = contributionGrid(data, options);
    expect(cells.length).toBe(data.weeks.length * 7);
  });
});

// ── computeLevel10 ───────────────────────────────────────────

describe('computeLevel10', () => {
  it('returns 0 for zero contributions', () => {
    expect(computeLevel10(0, 20)).toBe(0);
  });

  it('returns 1 when maxCount is 0 or negative', () => {
    expect(computeLevel10(5, 0)).toBe(1);
    expect(computeLevel10(5, -10)).toBe(1);
  });

  it('returns 1 for ratio <= 0.06', () => {
    // ratio = 1/100 = 0.01
    expect(computeLevel10(1, 100)).toBe(1);
  });

  it('returns 2 for ratio in (0.06, 0.12]', () => {
    // ratio = 10/100 = 0.10
    expect(computeLevel10(10, 100)).toBe(2);
  });

  it('returns 3 for ratio in (0.12, 0.2]', () => {
    // ratio = 15/100 = 0.15
    expect(computeLevel10(15, 100)).toBe(3);
  });

  it('returns 4 for ratio in (0.2, 0.3]', () => {
    // ratio = 25/100 = 0.25
    expect(computeLevel10(25, 100)).toBe(4);
  });

  it('returns 5 for ratio in (0.3, 0.42]', () => {
    // ratio = 35/100 = 0.35
    expect(computeLevel10(35, 100)).toBe(5);
  });

  it('returns 6 for ratio in (0.42, 0.55]', () => {
    // ratio = 50/100 = 0.50
    expect(computeLevel10(50, 100)).toBe(6);
  });

  it('returns 7 for ratio in (0.55, 0.7]', () => {
    // ratio = 60/100 = 0.60
    expect(computeLevel10(60, 100)).toBe(7);
  });

  it('returns 8 for ratio in (0.7, 0.85]', () => {
    // ratio = 80/100 = 0.80
    expect(computeLevel10(80, 100)).toBe(8);
  });

  it('returns 9 for ratio > 0.85', () => {
    // ratio = 90/100 = 0.90
    expect(computeLevel10(90, 100)).toBe(9);
    expect(computeLevel10(100, 100)).toBe(9);
  });

  it('clamps ratio to [0,1] when count exceeds maxCount', () => {
    expect(computeLevel10(200, 100)).toBe(9);
  });
});

// ── enrichGridCells ──────────────────────────────────────────

describe('enrichGridCells', () => {
  it('adds level10 property to each cell', () => {
    const data = createMockContributionData();
    const cells = contributionGrid(data, { cellSize: 10, gap: 2, offsetX: 0, offsetY: 0 });
    const enriched = enrichGridCells(cells, data);

    for (const cell of enriched) {
      expect(cell).toHaveProperty('level10');
      expect(cell.level10).toBeGreaterThanOrEqual(0);
      expect(cell.level10).toBeLessThanOrEqual(9);
    }
  });

  it('assigns level10=0 for zero-count cells', () => {
    const data = createMockContributionData();
    const cells = contributionGrid(data, { cellSize: 10, gap: 2, offsetX: 0, offsetY: 0 });
    const enriched = enrichGridCells(cells, data);

    const zeroCells = enriched.filter((c) => c.count === 0);
    for (const cell of zeroCells) {
      expect(cell.level10).toBe(0);
    }
  });

  it('preserves original cell properties', () => {
    const data = createMockContributionData();
    const cells = contributionGrid(data, { cellSize: 10, gap: 2, offsetX: 5, offsetY: 10 });
    const enriched = enrichGridCells(cells, data);

    expect(enriched[0].x).toBe(cells[0].x);
    expect(enriched[0].y).toBe(cells[0].y);
    expect(enriched[0].count).toBe(cells[0].count);
    expect(enriched[0].date).toBe(cells[0].date);
  });

  it('returns same number of cells as input', () => {
    const data = createMockContributionData();
    const cells = contributionGrid(data, { cellSize: 10, gap: 2, offsetX: 0, offsetY: 0 });
    const enriched = enrichGridCells(cells, data);
    expect(enriched.length).toBe(cells.length);
  });
});

// ── computeLevel100 ─────────────────────────────────────────

describe('computeLevel100', () => {
  it('returns 0 for zero contributions', () => {
    expect(computeLevel100(0, 20)).toBe(0);
  });

  it('returns 1 when maxCount is 0 or negative', () => {
    expect(computeLevel100(5, 0)).toBe(1);
    expect(computeLevel100(5, -1)).toBe(1);
  });

  it('returns low level for minimal contribution', () => {
    const level = computeLevel100(1, 100);
    expect(level).toBeGreaterThanOrEqual(1);
    expect(level).toBeLessThan(25);
  });

  it('returns 99 for max contributions', () => {
    expect(computeLevel100(100, 100)).toBe(99);
  });

  it('uses sqrt curve so low values get more spread', () => {
    const low = computeLevel100(5, 100);
    const mid = computeLevel100(50, 100);
    const high = computeLevel100(95, 100);
    expect(low).toBeGreaterThan(0);
    expect(mid).toBeGreaterThan(low);
    expect(high).toBeGreaterThan(mid);
    expect(low).toBeGreaterThan(15);
  });

  it('handles maxCount of 1', () => {
    expect(computeLevel100(1, 1)).toBe(99);
  });

  it('clamps level between 1 and 99 for non-zero counts', () => {
    // Very small ratio
    expect(computeLevel100(1, 10000)).toBeGreaterThanOrEqual(1);
    // Count exceeds max (clamped ratio)
    expect(computeLevel100(200, 100)).toBe(99);
  });
});

// ── enrichGridCells100 ───────────────────────────────────────

describe('enrichGridCells100', () => {
  it('uses P90 for effective max to avoid outlier compression', () => {
    const data = createMockContributionData();
    const cells = contributionGrid(data, { cellSize: 10, gap: 2, offsetX: 0, offsetY: 0 });
    const enriched = enrichGridCells100(cells, data);

    // All cells should have level100
    for (const cell of enriched) {
      expect(cell).toHaveProperty('level100');
      if (cell.count === 0) {
        expect(cell.level100).toBe(0);
      } else {
        expect(cell.level100).toBeGreaterThanOrEqual(1);
        expect(cell.level100).toBeLessThanOrEqual(99);
      }
    }
  });

  it('handles all-zero data by using effectiveMax of 1', () => {
    const emptyData = createEmptyContributionData();
    const cells = contributionGrid(emptyData, { cellSize: 10, gap: 2, offsetX: 0, offsetY: 0 });
    const enriched = enrichGridCells100(cells, emptyData);

    for (const cell of enriched) {
      expect(cell.level100).toBe(0);
    }
  });

  it('preserves original cell properties', () => {
    const data = createMockContributionData();
    const cells = contributionGrid(data, { cellSize: 10, gap: 2, offsetX: 5, offsetY: 10 });
    const enriched = enrichGridCells100(cells, data);

    expect(enriched[0].x).toBe(cells[0].x);
    expect(enriched[0].y).toBe(cells[0].y);
    expect(enriched[0].count).toBe(cells[0].count);
    expect(enriched[0].date).toBe(cells[0].date);
  });

  it('returns same number of cells as input', () => {
    const data = createMockContributionData();
    const cells = contributionGrid(data, { cellSize: 10, gap: 2, offsetX: 0, offsetY: 0 });
    const enriched = enrichGridCells100(cells, data);
    expect(enriched.length).toBe(cells.length);
  });

  it('outlier counts above P90 cap at level 99', () => {
    // Build data with one massive outlier and many small values
    const data = createMockContributionData();
    // Inject a huge count into the first day
    data.weeks[0].days[0] = { ...data.weeks[0].days[0], count: 10000, level: 4 };

    const cells = contributionGrid(data, { cellSize: 10, gap: 2, offsetX: 0, offsetY: 0 });
    const enriched = enrichGridCells100(cells, data);

    // The outlier should be capped at 99
    expect(enriched[0].level100).toBe(99);
  });
});
