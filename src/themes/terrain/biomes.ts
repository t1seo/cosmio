import { seededRandom } from '../../utils/math.js';

/** Spatial context for a single grid cell, independent of contribution level */
export interface BiomeContext {
  /** Cell is part of a river path */
  isRiver: boolean;
  /** Cell is part of a pond/lake */
  isPond: boolean;
  /** Cell is adjacent to river or pond (but not water itself) */
  nearWater: boolean;
  /** Forest density 0–1 from nearest forest nucleus */
  forestDensity: number;
}

/**
 * Generate a biome overlay map for the entire grid.
 * Produces spatial features (rivers, ponds, forests) distributed
 * independently of contribution levels so that water and trees
 * appear naturally across all biome zones.
 *
 * @param weeks - Number of weeks (columns), typically 52
 * @param days - Number of days (rows), typically 7
 * @param seed - Deterministic seed
 * @returns Map keyed by "week,day" → BiomeContext
 */
export function generateBiomeMap(
  weeks: number,
  days: number,
  seed: number,
): Map<string, BiomeContext> {
  const rng = seededRandom(seed);
  const map = new Map<string, BiomeContext>();

  // Initialize all cells
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < days; d++) {
      map.set(`${w},${d}`, {
        isRiver: false,
        isPond: false,
        nearWater: false,
        forestDensity: 0,
      });
    }
  }

  // ── Layer 1: River Paths ────────────────────────────
  const NUM_RIVERS = 2;
  const riverBends: Array<{ w: number; d: number }> = [];

  for (let r = 0; r < NUM_RIVERS; r++) {
    // Stagger rivers across rows: first in top half, second in bottom half
    let day =
      r === 0
        ? Math.floor(rng() * Math.floor(days / 2))
        : Math.floor(days / 2) + Math.floor(rng() * Math.ceil(days / 2));

    for (let week = 0; week < weeks; week++) {
      const ctx = map.get(`${week},${day}`);
      /* v8 ignore start */
      if (ctx) ctx.isRiver = true;
      /* v8 ignore stop */

      // Drift: 60% straight, 20% up, 20% down
      const drift = rng();
      const prevDay = day;
      if (drift < 0.2) day = Math.max(0, day - 1);
      else if (drift > 0.8) day = Math.min(days - 1, day + 1);

      if (day !== prevDay) {
        riverBends.push({ w: week, d: day });
      }
    }
  }

  // ── Layer 2: Ponds at River Bends ───────────────────
  const numPonds = Math.min(riverBends.length, 1 + Math.floor(rng() * 2));
  const shuffledBends = riverBends
    .map((b) => ({ b, sort: rng() }))
    .sort((a, b) => a.sort - b.sort)
    .map((x) => x.b);

  for (let p = 0; p < numPonds; p++) {
    const center = shuffledBends[p];
    /* v8 ignore start */
    if (!center) break;
    /* v8 ignore stop */

    const pondSize = 2 + Math.floor(rng() * 3);
    const pondCells = [center];

    for (let i = 0; i < pondSize; i++) {
      const base = pondCells[Math.floor(rng() * pondCells.length)];
      const dw = Math.floor(rng() * 3) - 1;
      const dd = Math.floor(rng() * 3) - 1;
      const nw = base.w + dw;
      const nd = base.d + dd;
      if (nw >= 0 && nw < weeks && nd >= 0 && nd < days) {
        pondCells.push({ w: nw, d: nd });
      }
    }

    for (const pc of pondCells) {
      const ctx = map.get(`${pc.w},${pc.d}`);
      /* v8 ignore start */
      if (ctx) ctx.isPond = true;
      /* v8 ignore stop */
    }
  }

  // ── Mark nearWater ──────────────────────────────────
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < days; d++) {
      const ctx = map.get(`${w},${d}`)!;
      if (ctx.isRiver || ctx.isPond) continue;

      const neighbors = [
        map.get(`${w - 1},${d}`),
        map.get(`${w + 1},${d}`),
        map.get(`${w},${d - 1}`),
        map.get(`${w},${d + 1}`),
      ];
      if (neighbors.some((n) => n && (n.isRiver || n.isPond))) {
        ctx.nearWater = true;
      }
    }
  }

  // ── Layer 3: Forest Clusters ────────────────────────
  const numForests = 4 + Math.floor(rng() * 3);
  const nuclei: Array<{ w: number; d: number; radius: number }> = [];

  for (let f = 0; f < numForests; f++) {
    nuclei.push({
      w: Math.floor(rng() * weeks),
      d: Math.floor(rng() * days),
      radius: 2 + rng() * 3,
    });
  }

  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < days; d++) {
      const ctx = map.get(`${w},${d}`)!;
      let maxDensity = 0;

      for (const nucleus of nuclei) {
        const dist = Math.sqrt((w - nucleus.w) ** 2 + (d - nucleus.d) ** 2);
        if (dist < nucleus.radius) {
          const density = 1 - dist / nucleus.radius;
          if (density > maxDensity) maxDensity = density;
        }
      }

      ctx.forestDensity = maxDensity;
    }
  }

  return map;
}
