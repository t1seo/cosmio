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
const NUM_CLOUDS = 2;

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

// ── Celestial Bodies ─────────────────────────────────────────

/**
 * Render celestial bodies in the sky area.
 * Dark mode: scattered stars + crescent moon.
 * Light mode: sun with rays.
 */
export function renderCelestials(seed: number, palette: TerrainPalette100, isDark: boolean): string {
  const rng = seededRandom(seed + 3331);
  const parts: string[] = [];

  if (isDark) {
    // Stars: small dots scattered in the upper sky area
    const numStars = 18 + Math.floor(rng() * 10);
    for (let i = 0; i < numStars; i++) {
      const sx = 30 + rng() * 780;
      const sy = 5 + rng() * 55;
      const sr = 0.3 + rng() * 0.6;
      const opacity = 0.3 + rng() * 0.5;
      parts.push(
        `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="${sr.toFixed(1)}" fill="#fff" opacity="${opacity.toFixed(2)}"/>`,
      );
    }

    // A few brighter stars (cross shape)
    for (let i = 0; i < 3; i++) {
      const bx = 60 + rng() * 720;
      const by = 8 + rng() * 40;
      const len = 1.2 + rng() * 0.8;
      parts.push(
        `<g opacity="${(0.5 + rng() * 0.3).toFixed(2)}">`
        + `<line x1="${bx - len}" y1="${by}" x2="${bx + len}" y2="${by}" stroke="#fff" stroke-width="0.4"/>`
        + `<line x1="${bx}" y1="${by - len}" x2="${bx}" y2="${by + len}" stroke="#fff" stroke-width="0.4"/>`
        + `</g>`,
      );
    }

    // Crescent moon
    const mx = 680 + rng() * 80;
    const my = 18 + rng() * 15;
    const mr = 8;
    parts.push(
      `<g>`
      // Full moon circle
      + `<circle cx="${mx}" cy="${my}" r="${mr}" fill="#e8e4d0" opacity="0.85"/>`
      // Dark circle overlapping to create crescent
      + `<circle cx="${mx + 3.5}" cy="${my - 1.5}" r="${mr - 0.5}" fill="${palette.bg.subtle}"/>`
      // Subtle glow
      + `<circle cx="${mx}" cy="${my}" r="${mr + 3}" fill="#e8e4d0" opacity="0.04"/>`
      + `</g>`,
    );
  } else {
    // Sun: circle with radiating lines
    const sx = 720 + rng() * 60;
    const sy = 20 + rng() * 12;
    const sr = 7;

    // Outer glow
    parts.push(
      `<circle cx="${sx}" cy="${sy}" r="${sr + 6}" fill="#ffeebb" opacity="0.1"/>`,
    );
    parts.push(
      `<circle cx="${sx}" cy="${sy}" r="${sr + 3}" fill="#ffdd88" opacity="0.15"/>`,
    );
    // Sun body
    parts.push(
      `<circle cx="${sx}" cy="${sy}" r="${sr}" fill="#ffe066" opacity="0.9"/>`,
    );
    // Core highlight
    parts.push(
      `<circle cx="${sx - 1.5}" cy="${sy - 1.5}" r="${sr * 0.45}" fill="#fff8cc" opacity="0.6"/>`,
    );
    // Rays (8 lines radiating outward)
    for (let r = 0; r < 8; r++) {
      const angle = (r / 8) * Math.PI * 2;
      const innerR = sr + 2;
      const outerR = sr + 5 + (r % 2) * 2; // alternating long/short
      const x1 = sx + Math.cos(angle) * innerR;
      const y1 = sy + Math.sin(angle) * innerR;
      const x2 = sx + Math.cos(angle) * outerR;
      const y2 = sy + Math.sin(angle) * outerR;
      parts.push(
        `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" `
        + `stroke="#ffdd66" stroke-width="0.8" opacity="0.5" stroke-linecap="round"/>`,
      );
    }
  }

  return `<g class="celestials">${parts.join('')}</g>`;
}

// ── Composite Clouds ─────────────────────────────────────────

/**
 * Render drifting composite clouds with structured cumulus shapes.
 * Each cloud has a flat base + billowing top built from carefully
 * placed ellipses. Y-squashed ×0.45 for isometric perspective.
 * Uses SMIL animateTransform for drift animation.
 */
export function renderClouds(seed: number, palette: TerrainPalette100): string {
  const rng = seededRandom(seed);
  const clouds: string[] = [];

  for (let i = 0; i < NUM_CLOUDS; i++) {
    const baseCx = 120 + rng() * 550;
    const baseCy = 20 + rng() * 60;
    const scale = 0.8 + rng() * 0.5; // size variation
    const dur = (35 + rng() * 20).toFixed(0);
    const driftX = 60 + rng() * 50;

    const ellipses: string[] = [];
    const f = palette.cloud.fill;
    const s = palette.cloud.stroke;
    const o = palette.cloud.opacity;

    // Flat base: wide, short ellipse
    ellipses.push(
      `<ellipse cx="${baseCx}" cy="${baseCy}" rx="${(28 * scale).toFixed(1)}" ry="${(5 * scale).toFixed(1)}" fill="${f}" stroke="${s}" stroke-width="0.4" opacity="${o}"/>`,
    );
    // Left billow
    ellipses.push(
      `<ellipse cx="${(baseCx - 14 * scale).toFixed(1)}" cy="${(baseCy - 3 * scale).toFixed(1)}" rx="${(12 * scale).toFixed(1)}" ry="${(6 * scale).toFixed(1)}" fill="${f}" stroke="${s}" stroke-width="0.3" opacity="${o}"/>`,
    );
    // Center billow (tallest)
    ellipses.push(
      `<ellipse cx="${(baseCx - 2 * scale).toFixed(1)}" cy="${(baseCy - 6 * scale).toFixed(1)}" rx="${(14 * scale).toFixed(1)}" ry="${(8 * scale).toFixed(1)}" fill="${f}" stroke="${s}" stroke-width="0.3" opacity="${o}"/>`,
    );
    // Right billow
    ellipses.push(
      `<ellipse cx="${(baseCx + 12 * scale).toFixed(1)}" cy="${(baseCy - 3.5 * scale).toFixed(1)}" rx="${(11 * scale).toFixed(1)}" ry="${(5.5 * scale).toFixed(1)}" fill="${f}" stroke="${s}" stroke-width="0.3" opacity="${o}"/>`,
    );
    // Top highlight (small bright bump)
    ellipses.push(
      `<ellipse cx="${(baseCx - 4 * scale).toFixed(1)}" cy="${(baseCy - 9 * scale).toFixed(1)}" rx="${(7 * scale).toFixed(1)}" ry="${(4 * scale).toFixed(1)}" fill="${f}" stroke="none" opacity="${(o * 0.7).toFixed(2)}"/>`,
    );

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
 * Render waterfalls cascading off the side faces of edge river cells.
 * Water flows outward and downward from the isometric cliff edge,
 * using curved bezier paths for organic shape, with spray particles
 * and mist at the bottom.
 *
 * Max 2 waterfalls. Animation budget: ~4 SMIL animates.
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
  const parts: string[] = [];
  const wc = palette.assets.waterLight;  // lighter water
  const wd = palette.assets.water;       // darker water
  let animIdx = 0;

  for (const cell of selected) {
    const { isoX: cx, isoY: cy, height: h } = cell;

    // Determine which edge this cell is on → outward direction
    // Left edge (week=0): water flows to the left face
    // Right edge (week=51): water flows to the right face
    // Top edge (day=0): water flows up-left
    // Bottom edge (day=6): water flows down-right
    const isLeft = cell.week === 0;
    const isRight = cell.week === 51;
    const isTop = cell.day === 0;
    const isBottom = cell.day === 6;

    // Anchor: bottom of the side face where water starts
    // For left/top edges: water starts at the left face corner
    // For right/bottom edges: water starts at the right face corner
    let startX: number, startY: number;
    let outDx: number, outDy: number; // outward direction for curves

    if (isLeft || isTop) {
      startX = cx - THW;
      startY = cy + h;
      outDx = -1;
      outDy = 0.3;
    } else {
      startX = cx + THW;
      startY = cy + h;
      outDx = 1;
      outDy = 0.3;
    }

    const fallLen = 14 + h * 0.8;
    const elements: string[] = [];

    // Main water body: wide curved path (filled, not stroked)
    const bodyW = 3;
    elements.push(
      `<path d="M${startX - bodyW * 0.5},${startY}`
      + ` C${startX + outDx * 4 - bodyW * 0.7},${startY + fallLen * 0.3}`
      + ` ${startX + outDx * 6 - bodyW * 0.3},${startY + fallLen * 0.7}`
      + ` ${startX + outDx * 5},${startY + fallLen}`
      + ` L${startX + outDx * 5 + bodyW},${startY + fallLen}`
      + ` C${startX + outDx * 6 + bodyW * 0.3},${startY + fallLen * 0.7}`
      + ` ${startX + outDx * 4 + bodyW * 0.7},${startY + fallLen * 0.3}`
      + ` ${startX + bodyW * 0.5},${startY} Z"`
      + ` fill="${wd}" opacity="0.45"/>`,
    );

    // Flowing highlight streaks (thinner bezier curves inside the body)
    for (let s = 0; s < 3; s++) {
      const sOff = (s - 1) * 1.0;
      const sw = 0.5 + s * 0.15;
      const sOpacity = 0.5 - s * 0.1;
      const sx = startX + sOff;

      const pathD = `M${sx},${startY}`
        + ` Q${sx + outDx * 4},${startY + fallLen * 0.4}`
        + ` ${sx + outDx * 5 + sOff * 0.3},${startY + fallLen}`;

      if (animIdx < 4) {
        // Animated: dash-offset creates flowing effect
        elements.push(
          `<path d="${pathD}" stroke="${wc}" fill="none" stroke-width="${sw}" `
          + `opacity="${sOpacity}" stroke-linecap="round" stroke-dasharray="3 4">`
          + `<animate attributeName="stroke-dashoffset" values="0;-7" dur="${1.5 + s * 0.4}s" repeatCount="indefinite"/>`
          + `</path>`,
        );
        animIdx++;
      } else {
        elements.push(
          `<path d="${pathD}" stroke="${wc}" fill="none" stroke-width="${sw}" `
          + `opacity="${sOpacity}" stroke-linecap="round"/>`,
        );
      }
    }

    // Spray particles at the bottom (3-4 small dots)
    const sprayBaseX = startX + outDx * 5;
    const sprayBaseY = startY + fallLen;
    elements.push(
      `<circle cx="${sprayBaseX - 2}" cy="${sprayBaseY + 1}" r="0.6" fill="${wc}" opacity="0.3"/>`,
    );
    elements.push(
      `<circle cx="${sprayBaseX + 2.5}" cy="${sprayBaseY + 2}" r="0.5" fill="${wc}" opacity="0.25"/>`,
    );
    elements.push(
      `<circle cx="${sprayBaseX}" cy="${sprayBaseY + 3}" r="0.7" fill="${wc}" opacity="0.2"/>`,
    );

    // Mist cloud at bottom
    const mistSvg = animIdx < 4
      ? `<ellipse cx="${sprayBaseX}" cy="${sprayBaseY + 3}" rx="5" ry="2" fill="${wd}" opacity="0.2">`
        + `<animate attributeName="opacity" values="0.15;0.3;0.15" dur="3s" repeatCount="indefinite"/>`
        + `</ellipse>`
      : `<ellipse cx="${sprayBaseX}" cy="${sprayBaseY + 3}" rx="5" ry="2" fill="${wd}" opacity="0.2"/>`;
    elements.push(mistSvg);

    parts.push(`<g class="waterfall">${elements.join('')}</g>`);
  }

  return parts.length > 0
    ? `<g class="waterfalls">${parts.join('')}</g>`
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
