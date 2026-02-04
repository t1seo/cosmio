import type { IsoCell } from './blocks.js';
import type { TerrainPalette100 } from './palette.js';
import { THW, THH } from './blocks.js';
import { seededRandom } from '../../utils/math.js';
import type { BiomeContext } from './biomes.js';

// ── Animation Budget ─────────────────────────────────────────
// Total: 50 max
//   Water shimmer:    up to 15
//   Town sparkle:     up to 10
//   Clouds:           4 (SMIL animateTransform)
//   Windmill:         4 (SMIL animateTransform)
//   Flag wave:        4 (CSS @keyframes)
// Total animated:     ~42/50

const MAX_WATER = 15;
const MAX_SPARKLE = 10;
const NUM_CLOUDS = 4;

// ── CSS Animations ───────────────────────────────────────────

export function renderTerrainCSS(isoCells: IsoCell[], biomeMap?: Map<string, BiomeContext>): string {
  const blocks: string[] = [];

  const hasWater = isoCells.some(c => c.level100 >= 10 && c.level100 <= 22);
  const hasTown = isoCells.some(c => c.level100 >= 90);

  if (hasWater) {
    blocks.push(
      `@keyframes water-shimmer {`
      + ` 0% { opacity: 0.7; }`
      + ` 50% { opacity: 1; }`
      + ` 100% { opacity: 0.7; }`
      + ` }`,
    );

    const waterCells = isoCells.filter(c => c.level100 >= 10 && c.level100 <= 22);
    const selected = selectEvenly(waterCells, MAX_WATER);
    for (let i = 0; i < selected.length; i++) {
      const dur = (3 + (i % 3) * 0.8).toFixed(1);
      const delay = ((i * 0.7) % 4).toFixed(1);
      blocks.push(
        `.water-${i} { animation: water-shimmer ${dur}s ease-in-out ${delay}s infinite; }`,
      );
    }
  }

  if (hasTown) {
    blocks.push(
      `@keyframes town-sparkle {`
      + ` 0% { opacity: 1; }`
      + ` 40% { opacity: 0.5; }`
      + ` 100% { opacity: 1; }`
      + ` }`,
    );

    const townCells = isoCells.filter(c => c.level100 >= 90);
    const selected = selectEvenly(townCells, MAX_SPARKLE);
    for (let i = 0; i < selected.length; i++) {
      const dur = (2 + (i % 4) * 0.5).toFixed(1);
      const delay = ((i * 0.9) % 3.5).toFixed(1);
      blocks.push(
        `.sparkle-${i} { animation: town-sparkle ${dur}s ease-in-out ${delay}s infinite; }`,
      );
    }
  }


  // River shimmer for river cells outside the natural water zone
  if (biomeMap) {
    const riverCells = isoCells.filter(c => {
      const biome = biomeMap.get(`${c.week},${c.day}`);
      return biome && (biome.isRiver || biome.isPond) && c.level100 > 22;
    });
    const selectedRiver = selectEvenly(riverCells, 8);
    if (selectedRiver.length > 0) {
      // Reuse the water-shimmer keyframe (already defined above if hasWater)
      if (!hasWater) {
        blocks.push(
          `@keyframes water-shimmer {`
          + ` 0% { opacity: 0.7; }`
          + ` 50% { opacity: 1; }`
          + ` 100% { opacity: 0.7; }`
          + ` }`,
        );
      }
      for (let i = 0; i < selectedRiver.length; i++) {
        const dur = (3.5 + (i % 3) * 0.6).toFixed(1);
        const delay = ((i * 0.8) % 3.5).toFixed(1);
        blocks.push(
          `.river-shimmer-${i} { animation: water-shimmer ${dur}s ease-in-out ${delay}s infinite; }`,
        );
      }
    }
  }

  // Windmill rotation (SMIL handles this, but flag wave needs CSS)
  blocks.push(
    `@keyframes flag-wave {`
    + ` 0% { transform: scaleX(1); }`
    + ` 50% { transform: scaleX(0.7); }`
    + ` 100% { transform: scaleX(1); }`
    + ` }`,
  );

  return blocks.join('\n');
}

// ── Animated Overlays ────────────────────────────────────────

export function renderAnimatedOverlays(
  isoCells: IsoCell[],
  palette: TerrainPalette100,
): string {
  const overlays: string[] = [];

  // Water shimmer overlays (level 0-5)
  const waterCells = isoCells.filter(c => c.level100 >= 10 && c.level100 <= 22);
  const selectedWater = selectEvenly(waterCells, MAX_WATER);
  for (let i = 0; i < selectedWater.length; i++) {
    const cell = selectedWater[i];
    const { isoX: cx, isoY: cy } = cell;
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

  // Town sparkle overlays (level 90+)
  const townCells = isoCells.filter(c => c.level100 >= 90);
  const selectedTown = selectEvenly(townCells, MAX_SPARKLE);
  for (let i = 0; i < selectedTown.length; i++) {
    const cell = selectedTown[i];
    const { isoX: cx, isoY: cy, height: h } = cell;
    overlays.push(
      `<circle cx="${cx}" cy="${cy - h - 1}" r="1" fill="#ffe080" opacity="0.7" class="sparkle-${i}"/>`,
    );
  }

  return `<g class="terrain-overlays">${overlays.join('')}</g>`;
}

// ── Composite Clouds ─────────────────────────────────────────

/**
 * Render drifting composite clouds with multiple overlapping ellipses.
 * Each cloud = 3-5 circles, Y-squashed ×0.5 for isometric perspective.
 * Uses SMIL animateTransform for drift animation.
 */
export function renderClouds(seed: number, palette: TerrainPalette100): string {
  const rng = seededRandom(seed);
  const clouds: string[] = [];

  for (let i = 0; i < NUM_CLOUDS; i++) {
    const baseCx = 60 + rng() * 650;
    const baseCy = 25 + rng() * 85;
    const baseW = 25 + rng() * 35;
    const numCircles = 3 + Math.floor(rng() * 3); // 3-5 circles
    const dur = (30 + rng() * 25).toFixed(0);
    const driftX = 80 + rng() * 60;

    const ellipses: string[] = [];
    for (let j = 0; j < numCircles; j++) {
      // Offset each circle from center
      const ox = (rng() - 0.5) * baseW * 0.8;
      const oy = (rng() - 0.5) * 6;
      const rx = (baseW * 0.3 + rng() * baseW * 0.3);
      const ry = rx * 0.45; // Y-squash for isometric

      ellipses.push(
        `<ellipse cx="${(baseCx + ox).toFixed(1)}" cy="${(baseCy + oy).toFixed(1)}"`
        + ` rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}"`
        + ` fill="${palette.cloud.fill}" stroke="${palette.cloud.stroke}" stroke-width="0.5"`
        + ` opacity="${palette.cloud.opacity}"/>`,
      );
    }

    // Wrap in a group with SMIL translation
    clouds.push(
      `<g>`
      + ellipses.join('')
      + `<animateTransform attributeName="transform" type="translate"`
      + ` values="0,0;${driftX.toFixed(0)},0;0,0"`
      + ` dur="${dur}s" repeatCount="indefinite"/>`
      + `</g>`,
    );
  }

  return `<g class="terrain-clouds">${clouds.join('')}</g>`;
}


// ── Water Overlays (Rivers & Ponds) ─────────────────────────

/**
 * Render semi-transparent water overlays on river and pond cells.
 * These sit on top of block faces, creating water flowing across
 * terrain at any elevation level.
 */
export function renderWaterOverlays(
  isoCells: IsoCell[],
  palette: TerrainPalette100,
  biomeMap: Map<string, BiomeContext>,
): string {
  const overlays: string[] = [];
  let shimmerIdx = 0;

  for (const cell of isoCells) {
    const biome = biomeMap.get(`${cell.week},${cell.day}`);
    if (!biome || (!biome.isRiver && !biome.isPond)) continue;

    const { isoX: cx, isoY: cy } = cell;
    const color = biome.isPond
      ? palette.assets.pondOverlay
      : palette.assets.riverOverlay;

    // Diamond overlay on top face (slightly inset)
    const points = [
      `${cx},${cy - THH + 0.5}`,
      `${cx + THW - 1},${cy}`,
      `${cx},${cy + THH - 0.5}`,
      `${cx - THW + 1},${cy}`,
    ].join(' ');

    const shimmerClass = cell.level100 > 22 && shimmerIdx < 8
      ? ` class="river-shimmer-${shimmerIdx++}"`
      : '';

    overlays.push(
      `<polygon points="${points}" fill="${color}"${shimmerClass}/>`,
    );
  }

  return overlays.length > 0
    ? `<g class="water-overlays">${overlays.join('')}</g>`
    : '';
}

// ── Waterfalls (Laputa-style) ────────────────────────────────

/**
 * Render waterfalls off edge river cells (week=0/51, day=0/6).
 * Max 2 waterfalls. Each has 3-4 animated blue streaks falling
 * downward plus a mist ellipse at the bottom.
 * Animation budget: ~4 SMIL animates.
 */
export function renderWaterfalls(
  isoCells: IsoCell[],
  palette: TerrainPalette100,
  biomeMap: Map<string, BiomeContext>,
): string {
  // Find edge river cells
  const edgeRiverCells = isoCells.filter(cell => {
    const biome = biomeMap.get(`${cell.week},${cell.day}`);
    if (!biome || !biome.isRiver) return false;
    return cell.week === 0 || cell.week === 51 || cell.day === 0 || cell.day === 6;
  });

  if (edgeRiverCells.length === 0) return '';

  // Pick up to 2 waterfalls
  const selected = edgeRiverCells.slice(0, 2);
  const waterfalls: string[] = [];
  const waterColor = palette.assets.waterLight;
  const waterDark = palette.assets.water;
  let animCount = 0;

  for (const cell of selected) {
    const { isoX: cx, isoY: cy, height: h } = cell;
    // Determine fall direction based on edge
    const fallX = cell.week === 0 ? -THW : cell.week === 51 ? THW : 0;
    const baseY = cy + THH + h;
    const fallLength = 18 + h;

    const streaks: string[] = [];
    // 3-4 blue streaks falling downward
    const numStreaks = 3 + (animCount < 3 ? 1 : 0);
    for (let s = 0; s < numStreaks; s++) {
      const sx = cx + fallX * 0.3 + (s - 1.5) * 1.2;
      const sy1 = baseY;
      const sy2 = baseY + fallLength;
      const strokeW = 0.6 + (s % 2) * 0.3;
      const opacity = 0.5 + (s % 2) * 0.15;

      if (animCount < 4) {
        // Animated streak: flowing downward effect
        streaks.push(
          `<line x1="${sx}" y1="${sy1}" x2="${sx + fallX * 0.1}" y2="${sy2}" `
          + `stroke="${waterColor}" stroke-width="${strokeW}" opacity="${opacity}" stroke-linecap="round">`
          + `<animate attributeName="y1" values="${sy1};${sy1 - 3};${sy1}" dur="${2 + s * 0.3}s" repeatCount="indefinite"/>`
          + `</line>`,
        );
        animCount++;
      } else {
        // Static streak (animation budget exhausted)
        streaks.push(
          `<line x1="${sx}" y1="${sy1}" x2="${sx + fallX * 0.1}" y2="${sy2}" `
          + `stroke="${waterColor}" stroke-width="${strokeW}" opacity="${opacity}" stroke-linecap="round"/>`,
        );
      }
    }

    // Mist ellipse at the bottom with pulsing opacity
    const mistY = baseY + fallLength + 2;
    const mistSvg = animCount < 4
      ? `<ellipse cx="${cx + fallX * 0.3}" cy="${mistY}" rx="4" ry="1.5" fill="${waterDark}" opacity="0.3">`
        + `<animate attributeName="opacity" values="0.2;0.4;0.2" dur="3s" repeatCount="indefinite"/>`
        + `</ellipse>`
      : `<ellipse cx="${cx + fallX * 0.3}" cy="${mistY}" rx="4" ry="1.5" fill="${waterDark}" opacity="0.3"/>`;

    waterfalls.push(
      `<g class="waterfall">${streaks.join('')}${mistSvg}</g>`,
    );
  }

  return waterfalls.length > 0
    ? `<g class="waterfalls">${waterfalls.join('')}</g>`
    : '';
}

// ── Water Ripple Lines ──────────────────────────────────────

/**
 * Render static wavy SVG paths on the top face of water cells.
 * 2 ripple lines per water cell for subtle surface texture.
 */
export function renderWaterRipples(
  isoCells: IsoCell[],
  palette: TerrainPalette100,
  biomeMap: Map<string, BiomeContext>,
): string {
  const ripples: string[] = [];
  const color = palette.assets.waterLight;

  for (const cell of isoCells) {
    const biome = biomeMap.get(`${cell.week},${cell.day}`);
    if (!biome || (!biome.isRiver && !biome.isPond)) continue;

    const { isoX: cx, isoY: cy } = cell;
    // Two wavy paths across the top face (isometric diamond)
    // Ripple 1: slight wave across upper half
    ripples.push(
      `<path d="M${cx - THW * 0.5},${cy - THH * 0.1} Q${cx - THW * 0.1},${cy - THH * 0.4} ${cx + THW * 0.4},${cy - THH * 0.15}" `
      + `stroke="${color}" fill="none" stroke-width="0.3" opacity="0.3"/>`,
    );
    // Ripple 2: slight wave across lower half
    ripples.push(
      `<path d="M${cx - THW * 0.3},${cy + THH * 0.2} Q${cx + THW * 0.1},${cy - THH * 0.1} ${cx + THW * 0.5},${cy + THH * 0.1}" `
      + `stroke="${color}" fill="none" stroke-width="0.25" opacity="0.25"/>`,
    );
  }

  return ripples.length > 0
    ? `<g class="water-ripples">${ripples.join('')}</g>`
    : '';
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
