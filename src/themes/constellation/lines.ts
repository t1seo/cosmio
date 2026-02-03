import type { ContributionData, ColorMode } from '../../core/types.js';
import { svgElement, svgGroup, svgText } from '../../core/svg.js';
import { cssKeyframes } from '../../core/animation.js';
import { hash, seededRandom } from '../../utils/math.js';
import { contributionGrid, type GridCell } from '../shared.js';
import { CONSTELLATION_LINE, CONSTELLATION_DARK, CONSTELLATION_LIGHT } from './palette.js';

// ── Layout Constants ────────────────────────────────────────────
// Must match the constellation stars renderer

const CELL_SIZE = 12;
const GAP = 2;
const OFFSET_X = 36;
const OFFSET_Y = 48;

/** Maximum number of labels rendered on the chart */
const MAX_LABELS = 6;

/** Minimum connected component size to receive a label */
const MIN_LABEL_SIZE = 10;

/** System font stack */
const FONT_FAMILY = "'Segoe UI', system-ui, sans-serif";

// ── Jitter ──────────────────────────────────────────────────────
// Deterministic position jitter per cell so line endpoints align
// with star centers. Uses the same hash-seeded formula as stars.ts.

function cellJitter(date: string): { jx: number; jy: number } {
  const rng = seededRandom(hash(date));
  const jx = (rng() - 0.5) * CELL_SIZE * 0.4;
  const jy = (rng() - 0.5) * CELL_SIZE * 0.4;
  return { jx, jy };
}

/** Cell center X accounting for jitter */
function cx(cell: GridCell): number {
  const { jx } = cellJitter(cell.date);
  return parseFloat((cell.x + CELL_SIZE / 2 + jx).toFixed(2));
}

/** Cell center Y accounting for jitter */
function cy(cell: GridCell): number {
  const { jy } = cellJitter(cell.date);
  return parseFloat((cell.y + CELL_SIZE / 2 + jy).toFixed(2));
}

// ── Grid Indexing ───────────────────────────────────────────────

/** Key for a cell by (week, day) position */
function cellKey(week: number, day: number): string {
  return `${week}:${day}`;
}

interface IndexedCell extends GridCell {
  week: number;
  day: number;
}

/**
 * Build a lookup from (week, day) position to its cell data.
 * Only includes cells with level > 0 (contributing days).
 */
function buildCellIndex(data: ContributionData): Map<string, IndexedCell> {
  const cells = contributionGrid(data, {
    cellSize: CELL_SIZE,
    gap: GAP,
    offsetX: OFFSET_X,
    offsetY: OFFSET_Y,
  });

  const index = new Map<string, IndexedCell>();
  let i = 0;

  for (let week = 0; week < data.weeks.length; week++) {
    const weekData = data.weeks[week];
    for (let day = 0; day < weekData.days.length; day++) {
      const cell = cells[i++];
      if (cell.level > 0) {
        index.set(cellKey(week, day), { ...cell, week, day });
      }
    }
  }

  return index;
}

// ── Adjacency & Line Segments ───────────────────────────────────

interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Generate line segments between adjacent contributing cells.
 *
 * Connection rules:
 * 1. Vertical — consecutive days within the same week (day, day+1)
 * 2. Horizontal — same weekday across adjacent weeks (week, week+1)
 */
function buildSegments(index: Map<string, IndexedCell>, totalWeeks: number): Segment[] {
  const segments: Segment[] = [];

  for (const cell of index.values()) {
    // Vertical: same week, next day
    const below = index.get(cellKey(cell.week, cell.day + 1));
    if (below) {
      segments.push({ x1: cx(cell), y1: cy(cell), x2: cx(below), y2: cy(below) });
    }

    // Horizontal: same day, next week
    const right = index.get(cellKey(cell.week + 1, cell.day));
    if (right) {
      segments.push({ x1: cx(cell), y1: cy(cell), x2: cx(right), y2: cy(right) });
    }
  }

  return segments;
}

// ── Connected Components (Union-Find) ───────────────────────────

class UnionFind {
  private parent: Map<string, string>;
  private rank: Map<string, number>;
  private size: Map<string, number>;

  constructor(keys: Iterable<string>) {
    this.parent = new Map();
    this.rank = new Map();
    this.size = new Map();
    for (const k of keys) {
      this.parent.set(k, k);
      this.rank.set(k, 0);
      this.size.set(k, 1);
    }
  }

  find(x: string): string {
    let root = x;
    while (this.parent.get(root) !== root) {
      root = this.parent.get(root)!;
    }
    // Path compression
    let current = x;
    while (current !== root) {
      const next = this.parent.get(current)!;
      this.parent.set(current, root);
      current = next;
    }
    return root;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;

    const rankA = this.rank.get(ra)!;
    const rankB = this.rank.get(rb)!;
    const sizeA = this.size.get(ra)!;
    const sizeB = this.size.get(rb)!;

    if (rankA < rankB) {
      this.parent.set(ra, rb);
      this.size.set(rb, sizeA + sizeB);
    } else if (rankA > rankB) {
      this.parent.set(rb, ra);
      this.size.set(ra, sizeA + sizeB);
    } else {
      this.parent.set(rb, ra);
      this.size.set(ra, sizeA + sizeB);
      this.rank.set(ra, rankA + 1);
    }
  }

  /** Returns groups of keys, sorted by size descending */
  groups(): string[][] {
    const buckets = new Map<string, string[]>();
    for (const key of this.parent.keys()) {
      const root = this.find(key);
      if (!buckets.has(root)) buckets.set(root, []);
      buckets.get(root)!.push(key);
    }
    return [...buckets.values()].sort((a, b) => b.length - a.length);
  }
}

/**
 * Group contributing cells into connected components.
 */
function findComponents(
  index: Map<string, IndexedCell>,
  totalWeeks: number,
): string[][] {
  const uf = new UnionFind(index.keys());

  for (const cell of index.values()) {
    const key = cellKey(cell.week, cell.day);
    const belowKey = cellKey(cell.week, cell.day + 1);
    const rightKey = cellKey(cell.week + 1, cell.day);

    if (index.has(belowKey)) uf.union(key, belowKey);
    if (index.has(rightKey)) uf.union(key, rightKey);
  }

  return uf.groups();
}

// ── Label Generation ────────────────────────────────────────────

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'] as const;

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/**
 * Derive a Latin-style constellation label from the earliest date in the group.
 * Format: "<Month> <Roman numeral>" (e.g., "Mar III", "Jul I").
 */
function constellationLabel(
  group: string[],
  index: Map<string, IndexedCell>,
  ordinal: number,
): string {
  // Find earliest date in the component
  let earliest = '';
  for (const key of group) {
    const cell = index.get(key)!;
    if (earliest === '' || cell.date < earliest) {
      earliest = cell.date;
    }
  }

  const month = parseInt(earliest.slice(5, 7), 10) - 1;
  const monthName = MONTHS[month];
  const numeral = ROMAN[Math.min(ordinal, ROMAN.length - 1)];

  return `${monthName} ${numeral}`;
}

/**
 * Compute centroid of a connected component for label placement.
 */
function groupCentroid(
  group: string[],
  index: Map<string, IndexedCell>,
): { x: number; y: number } {
  let sumX = 0;
  let sumY = 0;
  for (const key of group) {
    const cell = index.get(key)!;
    sumX += cx(cell);
    sumY += cy(cell);
  }
  return {
    x: parseFloat((sumX / group.length).toFixed(2)),
    y: parseFloat((sumY / group.length).toFixed(2)),
  };
}

// ── Public API ──────────────────────────────────────────────────

/**
 * Render SVG constellation lines and labels.
 *
 * Generates line segments between adjacent contributing cells (vertical within
 * a week, horizontal across adjacent weeks) and labels for large connected
 * components (10+ cells) using Latin-style names derived from the streak's
 * starting month.
 *
 * @param data - Complete contribution data for one year
 * @param mode - Color mode (dark or light)
 * @returns SVG `<g>` element string containing lines and labels
 */
export function renderConstellationLines(data: ContributionData, mode: ColorMode): string {
  const palette = mode === 'dark' ? CONSTELLATION_DARK : CONSTELLATION_LIGHT;
  const lineColor = mode === 'dark' ? CONSTELLATION_LINE.dark : CONSTELLATION_LINE.light;
  const index = buildCellIndex(data);

  if (index.size === 0) {
    return svgGroup({ class: 'constellation-lines' }, '');
  }

  // Build line segments
  const segments = buildSegments(index, data.weeks.length);

  const lineElements = segments.map((seg) =>
    svgElement('line', {
      x1: seg.x1,
      y1: seg.y1,
      x2: seg.x2,
      y2: seg.y2,
      stroke: lineColor,
      'stroke-width': 0.8,
      'stroke-linecap': 'round',
      opacity: 0.5,
      class: 'constellation-line',
    }),
  );

  // Find connected components and generate labels for large ones
  const components = findComponents(index, data.weeks.length);
  const labelElements: string[] = [];
  let labelCount = 0;

  for (const group of components) {
    if (group.length < MIN_LABEL_SIZE) break; // Sorted descending, so we can stop early
    if (labelCount >= MAX_LABELS) break;

    const label = constellationLabel(group, index, labelCount);
    const centroid = groupCentroid(group, index);

    labelElements.push(
      svgText(centroid.x, centroid.y - 8, label, {
        fill: palette.text.secondary,
        'font-family': FONT_FAMILY,
        'font-size': 8,
        'font-style': 'italic',
        'letter-spacing': '0.08em',
        opacity: 0.4,
        'text-anchor': 'middle',
      }),
    );

    labelCount++;
  }

  const children = [...lineElements, ...labelElements].join('');
  return svgGroup({ class: 'constellation-lines' }, children);
}

// ── Draw Animation CSS ──────────────────────────────────────────

/**
 * Generate CSS `@keyframes` and class rule for the constellation line
 * drawing animation.
 *
 * Lines appear with a stroke-dasharray reveal effect that simulates
 * the line being drawn onto the chart.
 *
 * @returns CSS string with @keyframes draw-line and .constellation-line rule
 */
export function drawLineCSS(): string {
  return cssKeyframes({
    name: 'draw-line',
    keyframes: {
      from: { 'stroke-dashoffset': '20' },
      to: { 'stroke-dashoffset': '0' },
    },
    duration: '2s',
    easing: 'ease-out',
    iterationCount: 1,
    fillMode: 'forwards',
  }) + '\n.constellation-line { stroke-dasharray: 20; }';
}
