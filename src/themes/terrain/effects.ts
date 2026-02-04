import type { IsoCell } from './blocks.js';
import type { TerrainPalette } from './palette.js';
import { THW, THH } from './blocks.js';
import { seededRandom } from '../../utils/math.js';

// ── Animation Budget ─────────────────────────────────────────
// Total: 50 max
//   Water shimmer: up to 15
//   Snow sparkle:  up to 10
//   Clouds:        3
// Total animated:  ~28

const MAX_WATER = 15;
const MAX_SNOW = 10;
const NUM_CLOUDS = 3;

// ── CSS Animations ───────────────────────────────────────────

/**
 * Generate CSS @keyframes for terrain animations.
 */
export function renderTerrainCSS(isoCells: IsoCell[]): string {
  const blocks: string[] = [];

  const hasWater = isoCells.some(c => c.level10 <= 1);
  const hasSnow = isoCells.some(c => c.level10 === 9);

  if (hasWater) {
    blocks.push(
      `@keyframes water-shimmer {`
      + ` 0% { opacity: 0.7; }`
      + ` 50% { opacity: 1; }`
      + ` 100% { opacity: 0.7; }`
      + ` }`,
    );

    // Generate staggered water classes
    const waterCells = isoCells.filter(c => c.level10 <= 1);
    const selected = selectEvenly(waterCells, MAX_WATER);
    for (let i = 0; i < selected.length; i++) {
      const dur = (3 + (i % 3) * 0.8).toFixed(1);
      const delay = ((i * 0.7) % 4).toFixed(1);
      blocks.push(
        `.water-${i} { animation: water-shimmer ${dur}s ease-in-out ${delay}s infinite; }`,
      );
    }
  }

  if (hasSnow) {
    blocks.push(
      `@keyframes snow-sparkle {`
      + ` 0% { opacity: 1; }`
      + ` 40% { opacity: 0.6; }`
      + ` 100% { opacity: 1; }`
      + ` }`,
    );

    const snowCells = isoCells.filter(c => c.level10 === 9);
    const selected = selectEvenly(snowCells, MAX_SNOW);
    for (let i = 0; i < selected.length; i++) {
      const dur = (2 + (i % 4) * 0.5).toFixed(1);
      const delay = ((i * 0.9) % 3.5).toFixed(1);
      blocks.push(
        `.snow-${i} { animation: snow-sparkle ${dur}s ease-in-out ${delay}s infinite; }`,
      );
    }
  }

  return blocks.join('\n');
}

// ── Animated Overlays ────────────────────────────────────────

/**
 * Render animated overlay elements for water shimmer and snow sparkle.
 * These are separate from the blocks because we need CSS class references.
 */
export function renderAnimatedOverlays(
  isoCells: IsoCell[],
  palette: TerrainPalette,
): string {
  const overlays: string[] = [];

  // Water shimmer overlays (level 0-1)
  const waterCells = isoCells.filter(c => c.level10 <= 1);
  const selectedWater = selectEvenly(waterCells, MAX_WATER);
  for (let i = 0; i < selectedWater.length; i++) {
    const cell = selectedWater[i];
    const { isoX: cx, isoY: cy } = cell;
    // Small highlight diamond on the water surface
    const points = [
      `${cx},${cy - THH + 1}`,
      `${cx + THW - 2},${cy}`,
      `${cx},${cy + THH - 1}`,
      `${cx - THW + 2},${cy}`,
    ].join(' ');
    overlays.push(
      `<polygon points="${points}" fill="${palette.text.accent}" opacity="0.15" class="water-${i}"/>`,
    );
  }

  // Snow sparkle overlays (level 9)
  const snowCells = isoCells.filter(c => c.level10 === 9);
  const selectedSnow = selectEvenly(snowCells, MAX_SNOW);
  for (let i = 0; i < selectedSnow.length; i++) {
    const cell = selectedSnow[i];
    const { isoX: cx, isoY: cy } = cell;
    // Small bright dot on the snow peak
    overlays.push(
      `<circle cx="${cx}" cy="${cy - 1}" r="1.5" fill="#ffffff" opacity="0.8" class="snow-${i}"/>`,
    );
  }

  return `<g class="terrain-overlays">${overlays.join('')}</g>`;
}

// ── Clouds ───────────────────────────────────────────────────

/**
 * Render drifting cloud shapes across the terrain.
 * Uses SMIL <animate> for horizontal translation.
 */
export function renderClouds(seed: number, palette: TerrainPalette): string {
  const rng = seededRandom(seed);
  const clouds: string[] = [];

  for (let i = 0; i < NUM_CLOUDS; i++) {
    const cx = 100 + rng() * 600;
    const cy = 30 + rng() * 80;
    const w = 30 + rng() * 40;
    const h = 6 + rng() * 6;
    const dur = (25 + rng() * 20).toFixed(0);

    // Cloud as an ellipse
    const cloud =
      `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${(w / 2).toFixed(1)}" ry="${(h / 2).toFixed(1)}" fill="${palette.cloud}">`
      + `<animate attributeName="cx" values="${cx.toFixed(1)};${(cx + 120).toFixed(1)};${cx.toFixed(1)}" dur="${dur}s" repeatCount="indefinite"/>`
      + `</ellipse>`;

    clouds.push(cloud);
  }

  return `<g class="terrain-clouds">${clouds.join('')}</g>`;
}

// ── Helpers ──────────────────────────────────────────────────

function selectEvenly<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  const step = items.length / max;
  const result: T[] = [];
  for (let i = 0; i < max; i++) {
    result.push(items[Math.floor(i * step)]);
  }
  return result;
}
