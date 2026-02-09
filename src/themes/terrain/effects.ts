import type { IsoCell } from './blocks.js';
import type { TerrainPalette100 } from './palette.js';
import { THW, THH } from './blocks.js';
import { seededRandom } from '../../utils/math.js';
import type { BiomeContext } from './biomes.js';
import { getSeasonZone } from './seasons.js';

// ── Animation Budget ─────────────────────────────────────────
// Total: 50 max
//   Water shimmer:    up to 15
//   Town sparkle:     up to 10
//   Clouds:           4 (SMIL animateTransform)
//   Windmill:         4 (SMIL animateTransform)
//   Flag wave:        4 (CSS @keyframes)
//   (waterfalls removed — freed ~4 SMIL slots)
// Total animated:     ~38/50  →  12 slots available for new assets

const MAX_WATER = 15;
const MAX_SPARKLE = 10;
const NUM_CLOUDS = 2;

// ── CSS Animations ───────────────────────────────────────────

export function renderTerrainCSS(
  isoCells: IsoCell[],
  biomeMap?: Map<string, BiomeContext>,
): string {
  const blocks: string[] = [];

  const hasWater = isoCells.some((c) => c.level100 >= 10 && c.level100 <= 22);
  const hasTown = isoCells.some((c) => c.level100 >= 90);

  if (hasWater) {
    blocks.push(
      `@keyframes water-shimmer {` +
        ` 0% { opacity: 0.7; }` +
        ` 50% { opacity: 1; }` +
        ` 100% { opacity: 0.7; }` +
        ` }`,
    );

    const waterCells = isoCells.filter((c) => c.level100 >= 10 && c.level100 <= 22);
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
      `@keyframes town-sparkle {` +
        ` 0% { opacity: 1; }` +
        ` 40% { opacity: 0.5; }` +
        ` 100% { opacity: 1; }` +
        ` }`,
    );

    const townCells = isoCells.filter((c) => c.level100 >= 90);
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
    const riverCells = isoCells.filter((c) => {
      const biome = biomeMap.get(`${c.week},${c.day}`);
      return biome && (biome.isRiver || biome.isPond) && c.level100 > 22;
    });
    const selectedRiver = selectEvenly(riverCells, 8);
    if (selectedRiver.length > 0) {
      // Reuse the water-shimmer keyframe (already defined above if hasWater)
      /* v8 ignore start */
      if (!hasWater) {
        /* v8 ignore stop */
        blocks.push(
          `@keyframes water-shimmer {` +
            ` 0% { opacity: 0.7; }` +
            ` 50% { opacity: 1; }` +
            ` 100% { opacity: 0.7; }` +
            ` }`,
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
    `@keyframes flag-wave {` +
      ` 0% { transform: scaleX(1); }` +
      ` 50% { transform: scaleX(0.7); }` +
      ` 100% { transform: scaleX(1); }` +
      ` }`,
  );

  // Gentle sway for tallGrass, cattail
  blocks.push(
    `@keyframes sway-gentle {` +
      ` 0% { transform: rotate(-2deg); }` +
      ` 50% { transform: rotate(2deg); }` +
      ` 100% { transform: rotate(-2deg); }` +
      ` }`,
  );
  blocks.push(
    `.sway-gentle { animation: sway-gentle 3s ease-in-out infinite; transform-origin: bottom center; }`,
  );

  // Slow sway for laundry
  blocks.push(
    `@keyframes sway-slow {` +
      ` 0% { transform: rotate(-1deg); }` +
      ` 50% { transform: rotate(1deg); }` +
      ` 100% { transform: rotate(-1deg); }` +
      ` }`,
  );
  blocks.push(
    `.sway-slow { animation: sway-slow 4s ease-in-out infinite; transform-origin: bottom center; }`,
  );

  return blocks.join('\n');
}

// ── Animated Overlays ────────────────────────────────────────

export function renderAnimatedOverlays(isoCells: IsoCell[], palette: TerrainPalette100): string {
  const overlays: string[] = [];

  // Water shimmer overlays (level 0-5)
  const waterCells = isoCells.filter((c) => c.level100 >= 10 && c.level100 <= 22);
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
  const townCells = isoCells.filter((c) => c.level100 >= 90);
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
export function renderCelestials(
  seed: number,
  palette: TerrainPalette100,
  isDark: boolean,
): string {
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
        `<g opacity="${(0.5 + rng() * 0.3).toFixed(2)}">` +
          `<line x1="${bx - len}" y1="${by}" x2="${bx + len}" y2="${by}" stroke="#fff" stroke-width="0.4"/>` +
          `<line x1="${bx}" y1="${by - len}" x2="${bx}" y2="${by + len}" stroke="#fff" stroke-width="0.4"/>` +
          `</g>`,
      );
    }

    // Crescent moon
    const mx = 750 + rng() * 60;
    const my = 18 + rng() * 15;
    const mr = 8;
    parts.push(
      `<g>` +
        // Full moon circle
        `<circle cx="${mx}" cy="${my}" r="${mr}" fill="#e8e4d0" opacity="0.85"/>` +
        // Dark circle overlapping to create crescent
        `<circle cx="${mx + 3.5}" cy="${my - 1.5}" r="${mr - 0.5}" fill="${palette.bg.subtle}"/>` +
        // Subtle glow
        `<circle cx="${mx}" cy="${my}" r="${mr + 3}" fill="#e8e4d0" opacity="0.04"/>` +
        `</g>`,
    );
  } else {
    // Sun: circle with radiating lines
    const sx = 770 + rng() * 50;
    const sy = 20 + rng() * 12;
    const sr = 7;

    // Outer glow
    parts.push(`<circle cx="${sx}" cy="${sy}" r="${sr + 6}" fill="#ffeebb" opacity="0.1"/>`);
    parts.push(`<circle cx="${sx}" cy="${sy}" r="${sr + 3}" fill="#ffdd88" opacity="0.15"/>`);
    // Sun body
    parts.push(`<circle cx="${sx}" cy="${sy}" r="${sr}" fill="#ffe066" opacity="0.9"/>`);
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
        `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" ` +
          `stroke="#ffdd66" stroke-width="0.8" opacity="0.5" stroke-linecap="round"/>`,
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
    const baseCx = 250 + rng() * 500;
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
      `<g>` +
        ellipses.join('') +
        `<animateTransform attributeName="transform" type="translate"` +
        ` values="0,0;${driftX.toFixed(0)},0;0,0"` +
        ` dur="${dur}s" repeatCount="indefinite"/>` +
        `</g>`,
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
    const color = biome.isPond ? palette.assets.pondOverlay : palette.assets.riverOverlay;

    // 6b: Two-tone water overlay — outer edge darker, inner area lighter
    // Outer diamond (slightly inset from block edge)
    const outerPoints = [
      `${cx},${cy - THH + 0.5}`,
      `${cx + THW - 1},${cy}`,
      `${cx},${cy + THH - 0.5}`,
      `${cx - THW + 1},${cy}`,
    ].join(' ');

    // Inner diamond (further inset — lighter water surface)
    const innerInset = 2.2;
    const innerPoints = [
      `${cx},${cy - THH + innerInset}`,
      `${cx + THW - innerInset * 1.2},${cy}`,
      `${cx},${cy + THH - innerInset}`,
      `${cx - THW + innerInset * 1.2},${cy}`,
    ].join(' ');

    const shimmerClass =
      cell.level100 > 22 && shimmerIdx < 8 ? ` class="river-shimmer-${shimmerIdx++}"` : '';

    // Outer: darker edge
    overlays.push(`<polygon points="${outerPoints}" fill="${color}"${shimmerClass}/>`);
    // Inner: lighter surface (reduced opacity for lighter feel)
    overlays.push(
      `<polygon points="${innerPoints}" fill="${palette.assets.waterLight}" opacity="0.18"/>`,
    );
  }

  return overlays.length > 0 ? `<g class="water-overlays">${overlays.join('')}</g>` : '';
}

// ── Water Ripple Lines ──────────────────────────────────────

/**
 * Render static wavy SVG paths on the top face of water cells.
 * 6c: 3 ripple lines per cell, varied curve amplitude,
 * isometric diamond orientation, staggered positions, thinner strokes.
 */
export function renderWaterRipples(
  isoCells: IsoCell[],
  palette: TerrainPalette100,
  biomeMap: Map<string, BiomeContext>,
): string {
  const ripples: string[] = [];
  const color = palette.assets.waterLight;
  const rng = seededRandom(isoCells.length * 7 + 31);

  for (const cell of isoCells) {
    const biome = biomeMap.get(`${cell.week},${cell.day}`);
    if (!biome || (!biome.isRiver && !biome.isPond)) continue;

    const { isoX: cx, isoY: cy } = cell;
    // Stagger horizontal offset per cell using seeded RNG
    const jitterX = (rng() - 0.5) * 2;
    const jitterY = (rng() - 0.5) * 0.8;

    // Ripple 1: upper-left to center-right, following isometric diamond
    const amp1 = 0.3 + rng() * 0.15;
    ripples.push(
      `<path d="M${cx - THW * 0.55 + jitterX},${cy - THH * 0.05 + jitterY} ` +
        `Q${cx - THW * 0.1},${cy - THH * amp1} ${cx + THW * 0.4},${cy - THH * 0.12}" ` +
        `stroke="${color}" fill="none" stroke-width="0.25" opacity="0.28"/>`,
    );

    // Ripple 2: center, varied amplitude, isometric angle
    const amp2 = 0.15 + rng() * 0.2;
    ripples.push(
      `<path d="M${cx - THW * 0.35 + jitterX * 0.5},${cy + THH * 0.15 + jitterY} ` +
        `Q${cx + THW * 0.05},${cy - THH * amp2} ${cx + THW * 0.45},${cy + THH * 0.05}" ` +
        `stroke="${color}" fill="none" stroke-width="0.2" opacity="0.22"/>`,
    );

    // Ripple 3: lower region, gentler curve
    const amp3 = 0.1 + rng() * 0.12;
    ripples.push(
      `<path d="M${cx - THW * 0.2 + jitterX * 0.3},${cy + THH * 0.35 + jitterY} ` +
        `Q${cx + THW * 0.15},${cy + THH * amp3} ${cx + THW * 0.35},${cy + THH * 0.28}" ` +
        `stroke="${color}" fill="none" stroke-width="0.2" opacity="0.18"/>`,
    );
  }

  return ripples.length > 0 ? `<g class="water-ripples">${ripples.join('')}</g>` : '';
}

// ── Seasonal Particle Effects ────────────────────────────────

/**
 * Render snow particles for winter zones.
 * Scattered small white circles/dots drifting downward in columns
 * that correspond to winter-zone weeks.
 */
export function renderSnowParticles(
  isoCells: IsoCell[],
  seed: number,
  seasonRotation: number = 0,
): string {
  const rng = seededRandom(seed + 9991);
  const particles: string[] = [];
  const maxParticles = 40;
  let count = 0;

  // Collect cells in winter zones (0, 1, 7)
  const winterCells = isoCells.filter((c) => {
    const zone = getSeasonZone(c.week, seasonRotation);
    return zone === 0 || zone === 1 || zone === 7;
  });

  if (winterCells.length === 0) return '';

  const selected = selectEvenly(winterCells, maxParticles);
  for (const cell of selected) {
    /* v8 ignore start */
    if (count >= maxParticles) break;
    /* v8 ignore stop */
    const zone = getSeasonZone(cell.week, seasonRotation);
    // More particles in peak winter (zone 0), fewer in transitions
    const density = zone === 0 ? 0.8 : 0.4;
    if (rng() > density) continue;

    const px = cell.isoX + (rng() - 0.5) * 10;
    const py = cell.isoY - cell.height - 5 - rng() * 20;
    const r = 0.3 + rng() * 0.4;
    const opacity = 0.3 + rng() * 0.4;

    particles.push(
      `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${r.toFixed(1)}" fill="#fff" opacity="${opacity.toFixed(2)}"/>`,
    );
    count++;
  }

  /* v8 ignore start */
  return particles.length > 0 ? `<g class="snow-particles">${particles.join('')}</g>` : '';
  /* v8 ignore stop */
}

/**
 * Render falling cherry blossom petals for spring zones.
 * Small pink ellipses scattered in spring-zone columns.
 */
export function renderFallingPetals(
  isoCells: IsoCell[],
  seed: number,
  palette: TerrainPalette100,
  seasonRotation: number = 0,
): string {
  const rng = seededRandom(seed + 7771);
  const petals: string[] = [];
  const maxPetals = 30;
  let count = 0;

  /* v8 ignore start */
  const petalColor = palette.assets.cherryPetalPink || '#f5a0b8';
  /* v8 ignore stop */

  // Collect cells in spring zones (1, 2, 3)
  const springCells = isoCells.filter((c) => {
    const zone = getSeasonZone(c.week, seasonRotation);
    return zone === 2 || zone === 1 || zone === 3;
  });

  if (springCells.length === 0) return '';

  const selected = selectEvenly(springCells, maxPetals);
  for (const cell of selected) {
    /* v8 ignore start */
    if (count >= maxPetals) break;
    /* v8 ignore stop */
    const zone = getSeasonZone(cell.week, seasonRotation);
    const density = zone === 2 ? 0.7 : 0.35;
    if (rng() > density) continue;

    const px = cell.isoX + (rng() - 0.5) * 8;
    const py = cell.isoY - cell.height - 3 - rng() * 15;
    const rx = 0.3 + rng() * 0.2;
    const ry = 0.12 + rng() * 0.08;
    const rotation = Math.floor(rng() * 180);
    const opacity = 0.35 + rng() * 0.3;

    petals.push(
      `<ellipse cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(2)}" ` +
        `fill="${petalColor}" opacity="${opacity.toFixed(2)}" transform="rotate(${rotation},${px.toFixed(1)},${py.toFixed(1)})"/>`,
    );
    count++;
  }

  /* v8 ignore start */
  return petals.length > 0 ? `<g class="falling-petals">${petals.join('')}</g>` : '';
  /* v8 ignore stop */
}

/**
 * Render falling leaves for autumn zones.
 * Small colored ellipses in red/orange/gold scattered in autumn-zone columns.
 */
export function renderFallingLeaves(
  isoCells: IsoCell[],
  seed: number,
  palette: TerrainPalette100,
  seasonRotation: number = 0,
): string {
  const rng = seededRandom(seed + 5551);
  const leaves: string[] = [];
  const maxLeaves = 30;
  let count = 0;

  /* v8 ignore start */
  const leafColors = [
    palette.assets.fallenLeafRed || '#c04030',
    palette.assets.fallenLeafOrange || '#d08030',
    palette.assets.fallenLeafGold || '#d0a030',
    palette.assets.mapleRed || '#c83020',
    palette.assets.oakGold || '#c8a030',
  ];
  /* v8 ignore stop */

  // Collect cells in autumn zones (5, 6, 7)
  const autumnCells = isoCells.filter((c) => {
    const zone = getSeasonZone(c.week, seasonRotation);
    return zone === 6 || zone === 5 || zone === 7;
  });

  if (autumnCells.length === 0) return '';

  const selected = selectEvenly(autumnCells, maxLeaves);
  for (const cell of selected) {
    /* v8 ignore start */
    if (count >= maxLeaves) break;
    /* v8 ignore stop */
    const zone = getSeasonZone(cell.week, seasonRotation);
    const density = zone === 6 ? 0.7 : 0.35;
    if (rng() > density) continue;

    const px = cell.isoX + (rng() - 0.5) * 8;
    const py = cell.isoY - cell.height - 2 - rng() * 12;
    const rx = 0.4 + rng() * 0.3;
    const ry = 0.15 + rng() * 0.1;
    const rotation = Math.floor(rng() * 360);
    const opacity = 0.4 + rng() * 0.3;
    const color = leafColors[Math.floor(rng() * leafColors.length)];

    leaves.push(
      `<ellipse cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(2)}" ` +
        `fill="${color}" opacity="${opacity.toFixed(2)}" transform="rotate(${rotation},${px.toFixed(1)},${py.toFixed(1)})"/>`,
    );
    count++;
  }

  /* v8 ignore start */
  return leaves.length > 0 ? `<g class="falling-leaves">${leaves.join('')}</g>` : '';
  /* v8 ignore stop */
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
