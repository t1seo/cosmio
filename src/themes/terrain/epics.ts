import type { IsoCell } from './blocks.js';
import type { AssetColors, TerrainPalette100 } from './palette.js';
import type { BiomeContext } from './biomes.js';
import type { ContributionStats } from '../../core/types.js';
import type { ColorMode } from '../../core/types.js';
import { seededRandom, hash } from '../../utils/math.js';
import { computeRichness } from './assets.js';

// ── Types ──────────────────────────────────────────────────

export type EpicTier = 'rare' | 'epic' | 'legendary';

export type EpicBuildingType =
  // Rare — 7 natural + 7 landmark (14)
  | 'mountFuji'
  | 'colosseum'
  | 'giantSequoia'
  | 'coralReef'
  | 'pagoda'
  | 'torii'
  | 'geyser'
  | 'hotSpring'
  | 'eiffelTower'
  | 'grandCanyon'
  | 'windmillGrand'
  | 'oasis'
  | 'volcano'
  | 'giantMushroom'
  // Epic — 7 natural + 3 landmark (10)
  | 'aurora'
  | 'tajMahal'
  | 'giantWaterfall'
  | 'stBasils'
  | 'bambooGrove'
  | 'operaHouse'
  | 'glacierPeak'
  | 'bioluminescentPool'
  | 'meteorCrater'
  | 'bonsaiGiant'
  // Legendary — 5 natural + 1 structure (6)
  | 'floatingIsland'
  | 'crystalSpire'
  | 'dragonNest'
  | 'worldTree'
  | 'sakuraEternal'
  | 'ancientPortal';

export interface PlacedEpicBuilding {
  type: EpicBuildingType;
  tier: EpicTier;
  week: number;
  day: number;
  cx: number;
  cy: number;
}

// ── Tier Configuration ─────────────────────────────────────

interface TierConfig {
  minLevel: number;
  minRichness: number;
  baseChance: number;
  glowColor: string;
  statsGate: (stats: ContributionStats) => boolean;
}

const TIER_CONFIG: Record<EpicTier, TierConfig> = {
  rare: {
    minLevel: 88,
    minRichness: 0.45,
    baseChance: 0.018,
    glowColor: '#FFD700',
    statsGate: (s) => s.total >= 200 || s.longestStreak >= 7,
  },
  epic: {
    minLevel: 93,
    minRichness: 0.55,
    baseChance: 0.008,
    glowColor: '#9B59B6',
    statsGate: (s) => s.total >= 500 && s.longestStreak >= 14,
  },
  legendary: {
    minLevel: 97,
    minRichness: 0.65,
    baseChance: 0.003,
    glowColor: '#00CED1',
    statsGate: (s) => s.total >= 1000 && s.longestStreak >= 30,
  },
};

export { TIER_CONFIG };

// ── Building Definitions ───────────────────────────────────

interface EpicBuildingDef {
  type: EpicBuildingType;
  tier: EpicTier;
}

const EPIC_BUILDINGS: EpicBuildingDef[] = [
  // Rare (14) — 9 natural, 5 landmark
  { type: 'mountFuji', tier: 'rare' },
  { type: 'colosseum', tier: 'rare' },
  { type: 'giantSequoia', tier: 'rare' },
  { type: 'coralReef', tier: 'rare' },
  { type: 'pagoda', tier: 'rare' },
  { type: 'torii', tier: 'rare' },
  { type: 'geyser', tier: 'rare' },
  { type: 'hotSpring', tier: 'rare' },
  { type: 'eiffelTower', tier: 'rare' },
  { type: 'grandCanyon', tier: 'rare' },
  { type: 'windmillGrand', tier: 'rare' },
  { type: 'oasis', tier: 'rare' },
  { type: 'volcano', tier: 'rare' },
  { type: 'giantMushroom', tier: 'rare' },
  // Epic (10) — 7 natural, 3 landmark
  { type: 'aurora', tier: 'epic' },
  { type: 'tajMahal', tier: 'epic' },
  { type: 'giantWaterfall', tier: 'epic' },
  { type: 'stBasils', tier: 'epic' },
  { type: 'bambooGrove', tier: 'epic' },
  { type: 'operaHouse', tier: 'epic' },
  { type: 'glacierPeak', tier: 'epic' },
  { type: 'bioluminescentPool', tier: 'epic' },
  { type: 'meteorCrater', tier: 'epic' },
  { type: 'bonsaiGiant', tier: 'epic' },
  // Legendary (6) — 5 natural, 1 structure
  { type: 'floatingIsland', tier: 'legendary' },
  { type: 'crystalSpire', tier: 'legendary' },
  { type: 'dragonNest', tier: 'legendary' },
  { type: 'worldTree', tier: 'legendary' },
  { type: 'sakuraEternal', tier: 'legendary' },
  { type: 'ancientPortal', tier: 'legendary' },
];

export { EPIC_BUILDINGS };

// ── Selection Logic ────────────────────────────────────────

const MAX_EPIC_BUDGET = 3;
const MIN_MANHATTAN_DISTANCE = 3;

function manhattanDistance(a: PlacedEpicBuilding, w: number, d: number): number {
  return Math.abs(a.week - w) + Math.abs(a.day - d);
}

/**
 * Select epic buildings for the terrain.
 * Uses a 3-gate system: cell level, neighborhood richness, global stats.
 * Returns placed epic buildings (max 3) and a set of occupied cell keys.
 */
export function selectEpicBuildings(
  isoCells: IsoCell[],
  seed: number,
  stats: ContributionStats,
  biomeMap?: Map<string, BiomeContext>,
): { placed: PlacedEpicBuilding[]; epicCells: Set<string> } {
  const epicSeed = hash(String(seed) + 'epic');
  const rng = seededRandom(epicSeed);
  const placed: PlacedEpicBuilding[] = [];
  const epicCells = new Set<string>();

  // Build cell lookup map
  const cellMap = new Map<string, IsoCell>();
  for (const cell of isoCells) {
    cellMap.set(`${cell.week},${cell.day}`, cell);
  }

  // Pre-check which tiers pass the global stats gate (Gate 3)
  const passedTiers = new Set<EpicTier>();
  for (const tier of ['legendary', 'epic', 'rare'] as EpicTier[]) {
    if (TIER_CONFIG[tier].statsGate(stats)) {
      passedTiers.add(tier);
    }
  }

  // Filter buildings to only those whose tier passed the stats gate
  const eligibleBuildings = EPIC_BUILDINGS.filter((b) => passedTiers.has(b.tier));
  if (eligibleBuildings.length === 0) return { placed, epicCells };

  // Compute streak bonus multiplier
  let streakMultiplier = 1.0;
  if (stats.currentStreak >= 30) streakMultiplier = 1.44;
  else if (stats.currentStreak >= 7) streakMultiplier = 1.15;

  // Iterate cells in RNG-shuffled order for fairness
  const shuffled = [...isoCells];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  for (const cell of shuffled) {
    if (placed.length >= MAX_EPIC_BUDGET) break;

    const key = `${cell.week},${cell.day}`;

    // Skip water/river cells
    const biome = biomeMap?.get(key);
    if (biome?.isRiver || biome?.isPond) continue;

    // Anti-clustering: check distance from all placed epics
    const tooClose = placed.some(
      (p) => manhattanDistance(p, cell.week, cell.day) < MIN_MANHATTAN_DISTANCE,
    );
    if (tooClose) continue;

    // Gate 1: Find highest eligible tier for this cell's level
    const richness = computeRichness(cell, cellMap);

    // Try tiers from highest to lowest (legendary first for rarity priority)
    for (const tier of ['legendary', 'epic', 'rare'] as EpicTier[]) {
      if (!passedTiers.has(tier)) continue;
      const config = TIER_CONFIG[tier];

      // Gate 1: Cell level
      if (cell.level100 < config.minLevel) continue;

      // Gate 2: Neighborhood richness
      if (richness < config.minRichness) continue;

      // Compute final chance with richness bonus and streak multiplier
      const richnessExcess = richness - config.minRichness;
      const richnessBonus = 1 + Math.min(richnessExcess * 2, 0.5); // max +50%
      const finalChance = config.baseChance * richnessBonus * streakMultiplier;

      if (rng() < finalChance) {
        // Pick a random building of this tier
        const tierBuildings = eligibleBuildings.filter((b) => b.tier === tier);
        const building = tierBuildings[Math.floor(rng() * tierBuildings.length)];
        placed.push({
          type: building.type,
          tier,
          week: cell.week,
          day: cell.day,
          cx: cell.isoX,
          cy: cell.isoY,
        });
        epicCells.add(key);
        break; // Move to next cell
      }
      break; // Only try the highest eligible tier per cell
    }
  }

  return { placed, epicCells };
}

// ── SVG Renderers (30 wonders) ─────────────────────────────

type EpicRenderer = (x: number, y: number, c: AssetColors) => string;

// ── Rare Tier — Natural Wonders ──

function renderMountFuji(x: number, y: number, c: AssetColors): string {
  return (
    `<g transform="translate(${x},${y})">` +
    // Mountain body
    `<polygon points="-6,0 0,-12 6,0" fill="${c.boulder}"/>` +
    `<polygon points="0,-12 6,0 0,0" fill="${c.rock}" opacity="0.7"/>` +
    // Snow cap
    `<polygon points="-2.5,-8 0,-12 2.5,-8" fill="${c.snowCap}"/>` +
    `<polygon points="0,-12 2.5,-8 0,-8" fill="${c.snowGround}" opacity="0.8"/>` +
    // Snow edge detail
    `<path d="M-2.5,-8 Q-1.5,-7.2 0,-8 Q1.5,-7.2 2.5,-8" fill="${c.snowCap}" opacity="0.6"/>` +
    `</g>`
  );
}

function renderGiantSequoia(x: number, y: number, c: AssetColors): string {
  return (
    `<g transform="translate(${x},${y})">` +
    // Massive trunk
    `<rect x="-1.8" y="-6" width="3.6" height="6" fill="${c.trunk}" rx="0.8"/>` +
    `<rect x="-1.2" y="-6" width="2.4" height="6" fill="${c.trunk}" opacity="0.7"/>` +
    // Wide canopy layers
    `<ellipse cx="0" cy="-8" rx="5" ry="3" fill="${c.epicJade}"/>` +
    `<ellipse cx="-1.5" cy="-10" rx="3.5" ry="2.5" fill="${c.epicJade}" opacity="0.85"/>` +
    `<ellipse cx="1.5" cy="-10.5" rx="3" ry="2" fill="${c.epicJade}" opacity="0.8"/>` +
    `<ellipse cx="0" cy="-12" rx="2.5" ry="1.8" fill="${c.epicJade}" opacity="0.75"/>` +
    `</g>`
  );
}

function renderCoralReef(x: number, y: number, c: AssetColors): string {
  return (
    `<g transform="translate(${x},${y})">` +
    // Reef base
    `<ellipse cx="0" cy="-0.5" rx="5" ry="1.5" fill="${c.coral}" opacity="0.5"/>` +
    // Branching coral structures
    `<path d="M-3,0 L-3,-4 L-4,-5 M-3,-3 L-2,-5" stroke="${c.coral}" stroke-width="0.8" fill="none"/>` +
    `<path d="M1,0 L1,-5 L0,-6.5 M1,-3 L2,-5" stroke="${c.epicMagic}" stroke-width="0.7" fill="none"/>` +
    `<path d="M3.5,0 L3.5,-3 L4,-4.5" stroke="${c.epicPortal}" stroke-width="0.6" fill="none"/>` +
    // Rounded coral heads
    `<circle cx="-3.5" cy="-5.2" r="0.8" fill="${c.coral}"/>` +
    `<circle cx="-1.8" cy="-5.3" r="0.6" fill="${c.coral}" opacity="0.8"/>` +
    `<circle cx="0" cy="-6.8" r="0.9" fill="${c.epicMagic}"/>` +
    `<circle cx="2.2" cy="-5.2" r="0.7" fill="${c.epicMagic}" opacity="0.8"/>` +
    `<circle cx="4" cy="-4.8" r="0.6" fill="${c.epicPortal}"/>` +
    `</g>`
  );
}

function renderGeyser(x: number, y: number, c: AssetColors): string {
  return (
    `<g transform="translate(${x},${y})">` +
    // Rocky mound
    `<ellipse cx="0" cy="0" rx="3" ry="1.2" fill="${c.rock}"/>` +
    `<ellipse cx="0" cy="-0.5" rx="2" ry="0.8" fill="${c.boulder}"/>` +
    // Erupting water column
    `<path d="M-0.8,-1 Q-0.5,-6 0,-9 Q0.5,-6 0.8,-1" fill="${c.epicCrystal}" opacity="0.5"/>` +
    `<path d="M-0.4,-1 Q0,-7 0.4,-1" fill="${c.epicCrystal}" opacity="0.3"/>` +
    // Steam/mist particles
    `<circle cx="-1" cy="-8" r="0.6" fill="${c.epicCrystal}" opacity="0.3"/>` +
    `<circle cx="0.8" cy="-9.5" r="0.5" fill="${c.epicCrystal}" opacity="0.25"/>` +
    `<circle cx="0" cy="-10.5" r="0.4" fill="${c.epicCrystal}" opacity="0.2"/>` +
    `</g>`
  );
}

function renderHotSpring(x: number, y: number, c: AssetColors): string {
  return (
    `<g transform="translate(${x},${y})">` +
    // Rocky rim
    `<ellipse cx="0" cy="0" rx="4.5" ry="2" fill="${c.rock}"/>` +
    // Warm pool
    `<ellipse cx="0" cy="-0.3" rx="3.5" ry="1.5" fill="${c.epicCrystal}" opacity="0.5"/>` +
    `<ellipse cx="0" cy="-0.5" rx="2.5" ry="1" fill="${c.epicPortal}" opacity="0.3"/>` +
    // Steam wisps
    `<path d="M-1.5,-1 Q-2,-3 -1,-4" stroke="${c.epicCrystal}" stroke-width="0.3" fill="none" opacity="0.4"/>` +
    `<path d="M0.5,-1 Q0,-3 1,-4.5" stroke="${c.epicCrystal}" stroke-width="0.3" fill="none" opacity="0.35"/>` +
    `<path d="M2,-1 Q2.5,-2.5 2,-3.5" stroke="${c.epicCrystal}" stroke-width="0.25" fill="none" opacity="0.3"/>` +
    `</g>`
  );
}

function renderGrandCanyon(x: number, y: number, c: AssetColors): string {
  return (
    `<g transform="translate(${x},${y})">` +
    // Layered rock strata — left wall
    `<polygon points="-6,0 -5,-6 -3,-5 -2,-7 -1,-3" fill="${c.boulder}"/>` +
    `<polygon points="-6,0 -5,-4 -3,-3 -1,-3 -1,0" fill="${c.rock}" opacity="0.7"/>` +
    // Right wall
    `<polygon points="1,-3 2,-7 3,-5 5,-6 6,0" fill="${c.boulder}"/>` +
    `<polygon points="1,-3 1,0 6,0 5,-4 3,-3" fill="${c.rock}" opacity="0.7"/>` +
    // Canyon floor hint
    `<line x1="-0.5" y1="0" x2="0.5" y2="0" stroke="${c.epicCrystal}" stroke-width="0.4" opacity="0.5"/>` +
    `</g>`
  );
}

function renderOasis(x: number, y: number, c: AssetColors): string {
  return (
    `<g transform="translate(${x},${y})">` +
    // Water pool
    `<ellipse cx="0" cy="0" rx="4" ry="1.5" fill="${c.epicCrystal}" opacity="0.5"/>` +
    `<ellipse cx="0" cy="-0.2" rx="3" ry="1" fill="${c.epicCrystal}" opacity="0.3"/>` +
    // Palm trees
    `<line x1="-2.5" y1="0" x2="-2.5" y2="-6" stroke="${c.trunk}" stroke-width="0.6"/>` +
    `<path d="M-2.5,-6 Q-4.5,-5 -5,-4" stroke="${c.palm}" stroke-width="0.5" fill="none"/>` +
    `<path d="M-2.5,-6 Q-0.5,-5 0.5,-5" stroke="${c.palm}" stroke-width="0.5" fill="none"/>` +
    `<path d="M-2.5,-6 Q-3,-4.5 -3.5,-3.5" stroke="${c.palm}" stroke-width="0.4" fill="none"/>` +
    `<line x1="2" y1="0" x2="2" y2="-5" stroke="${c.trunk}" stroke-width="0.5"/>` +
    `<path d="M2,-5 Q4,-4 4.5,-3" stroke="${c.palm}" stroke-width="0.4" fill="none"/>` +
    `<path d="M2,-5 Q0.5,-4 -0.5,-4" stroke="${c.palm}" stroke-width="0.4" fill="none"/>` +
    `</g>`
  );
}

// ── Rare Tier — Landmarks ──

function renderColosseum(x: number, y: number, c: AssetColors): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="0" cy="-2" rx="5" ry="3" fill="${c.epicMarble}"/>` +
    `<ellipse cx="0" cy="-2" rx="4" ry="2" fill="${c.wallShade}" opacity="0.4"/>` +
    `<rect x="-5" y="-5" width="10" height="3" fill="${c.epicMarble}"/>` +
    `<line x1="-4" y1="-5" x2="-4" y2="-2" stroke="${c.wall}" stroke-width="0.5"/>` +
    `<line x1="-2" y1="-5" x2="-2" y2="-2" stroke="${c.wall}" stroke-width="0.5"/>` +
    `<line x1="0" y1="-5" x2="0" y2="-2" stroke="${c.wall}" stroke-width="0.5"/>` +
    `<line x1="2" y1="-5" x2="2" y2="-2" stroke="${c.wall}" stroke-width="0.5"/>` +
    `<line x1="4" y1="-5" x2="4" y2="-2" stroke="${c.wall}" stroke-width="0.5"/>` +
    `</g>`
  );
}

function renderPagoda(x: number, y: number, c: AssetColors): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-2" y="-3" width="4" height="3" fill="${c.roofA}"/>` +
    `<polygon points="-4,-3 0,-4.5 4,-3" fill="${c.roofA}"/>` +
    `<rect x="-1.5" y="-6.5" width="3" height="2.5" fill="${c.roofA}"/>` +
    `<polygon points="-3,-6.5 0,-8 3,-6.5" fill="${c.roofA}"/>` +
    `<rect x="-1" y="-10" width="2" height="2.5" fill="${c.roofA}"/>` +
    `<polygon points="-2.5,-10 0,-12 2.5,-10" fill="${c.roofA}"/>` +
    `<line x1="0" y1="-12" x2="0" y2="-13" stroke="${c.epicGold}" stroke-width="0.4"/>` +
    `</g>`
  );
}

function renderTorii(x: number, y: number, c: AssetColors): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<line x1="-4" y1="0" x2="-4" y2="-8" stroke="${c.roofA}" stroke-width="1"/>` +
    `<line x1="4" y1="0" x2="4" y2="-8" stroke="${c.roofA}" stroke-width="1"/>` +
    `<path d="M-5,-7 Q0,-8.5 5,-7" stroke="${c.roofA}" stroke-width="0.8" fill="none"/>` +
    `<line x1="-4.5" y1="-6" x2="4.5" y2="-6" stroke="${c.roofA}" stroke-width="0.6"/>` +
    `</g>`
  );
}

function renderEiffelTower(x: number, y: number, c: AssetColors): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<line x1="-3" y1="0" x2="-0.5" y2="-10" stroke="${c.boulder}" stroke-width="0.5"/>` +
    `<line x1="3" y1="0" x2="0.5" y2="-10" stroke="${c.boulder}" stroke-width="0.5"/>` +
    `<line x1="0" y1="-10" x2="0" y2="-14" stroke="${c.boulder}" stroke-width="0.4"/>` +
    `<line x1="-2" y1="-3" x2="2" y2="-3" stroke="${c.boulder}" stroke-width="0.4"/>` +
    `<line x1="-1.3" y1="-6" x2="1.3" y2="-6" stroke="${c.boulder}" stroke-width="0.4"/>` +
    `<rect x="-1.5" y="-10.5" width="3" height="1" fill="${c.boulder}"/>` +
    `</g>`
  );
}

function renderWindmillGrand(x: number, y: number, c: AssetColors): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-2" y="-8" width="4" height="8" fill="${c.windmill}"/>` +
    `<polygon points="-2.5,-8 0,-10 2.5,-8" fill="${c.roofA}"/>` +
    `<g transform="translate(0,-7)">` +
    `<g>` +
    `<line x1="0" y1="0" x2="0" y2="-6" stroke="${c.windBlade}" stroke-width="0.8"/>` +
    `<line x1="0" y1="0" x2="6" y2="0" stroke="${c.windBlade}" stroke-width="0.8"/>` +
    `<line x1="0" y1="0" x2="0" y2="6" stroke="${c.windBlade}" stroke-width="0.8"/>` +
    `<line x1="0" y1="0" x2="-6" y2="0" stroke="${c.windBlade}" stroke-width="0.8"/>` +
    `<animateTransform attributeName="transform" type="rotate" values="0;360" dur="6s" repeatCount="indefinite"/>` +
    `</g>` +
    `</g>` +
    `<circle cx="0" cy="-7" r="0.6" fill="${c.boulder}"/>` +
    `</g>`
  );
}

function renderVolcano(x: number, y: number, c: AssetColors): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<polygon points="-5,0 -1.5,-8 1.5,-8 5,0" fill="${c.boulder}"/>` +
    `<ellipse cx="0" cy="-8" rx="1.8" ry="0.8" fill="#ff4500"/>` +
    `<ellipse cx="0" cy="-8" rx="1" ry="0.4" fill="#ff8c00"/>` +
    `<circle cx="-0.5" cy="-9.5" r="0.4" fill="#ff4500" opacity="0.7"/>` +
    `<circle cx="0.5" cy="-10" r="0.3" fill="#ff6600" opacity="0.6"/>` +
    `</g>`
  );
}

function renderGiantMushroom(x: number, y: number, c: AssetColors): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-0.8" y="-5" width="1.6" height="5" fill="${c.mushroom}"/>` +
    `<ellipse cx="0" cy="-6" rx="4.5" ry="3" fill="${c.mushroomCap}"/>` +
    `<circle cx="-2" cy="-6.5" r="0.6" fill="${c.mushroom}" opacity="0.6"/>` +
    `<circle cx="1.5" cy="-5.5" r="0.5" fill="${c.mushroom}" opacity="0.6"/>` +
    `<circle cx="0" cy="-7.5" r="0.4" fill="${c.mushroom}" opacity="0.6"/>` +
    `</g>`
  );
}

// ── Epic Tier — Natural Wonders ──

function renderAurora(x: number, y: number, c: AssetColors): string {
  return (
    `<g transform="translate(${x},${y})">` +
    // Shimmering aurora bands
    `<path d="M-6,-3 Q-3,-9 0,-6 Q3,-10 6,-4" stroke="${c.epicJade}" stroke-width="1.2" fill="none" opacity="0.5" class="epic-glow-pulse"/>` +
    `<path d="M-5,-4 Q-2,-10 1,-7 Q4,-11 6,-5" stroke="${c.epicPortal}" stroke-width="0.8" fill="none" opacity="0.4" class="epic-glow-pulse"/>` +
    `<path d="M-6,-2 Q-3,-7 0,-5 Q3,-8 5,-3" stroke="${c.epicMagic}" stroke-width="0.6" fill="none" opacity="0.35"/>` +
    // Subtle ground reference
    `<ellipse cx="0" cy="0" rx="3" ry="0.8" fill="${c.epicJade}" opacity="0.15"/>` +
    `</g>`
  );
}

function renderGiantWaterfall(x: number, y: number, c: AssetColors): string {
  return (
    `<g transform="translate(${x},${y})">` +
    // Cliff face
    `<rect x="-5" y="-10" width="4" height="10" fill="${c.boulder}"/>` +
    `<rect x="1" y="-10" width="4" height="10" fill="${c.rock}"/>` +
    // Waterfall stream
    `<rect x="-1" y="-10" width="2" height="10" fill="${c.epicCrystal}" opacity="0.5"/>` +
    `<rect x="-0.5" y="-10" width="1" height="10" fill="${c.epicCrystal}" opacity="0.3"/>` +
    // Green top
    `<ellipse cx="0" cy="-10.5" rx="5.5" ry="1.5" fill="${c.epicJade}"/>` +
    // Mist at base
    `<ellipse cx="0" cy="0.5" rx="3" ry="1" fill="${c.epicCrystal}" opacity="0.25"/>` +
    `</g>`
  );
}

function renderBambooGrove(x: number, y: number, c: AssetColors): string {
  return (
    `<g transform="translate(${x},${y})">` +
    // Bamboo stalks
    `<line x1="-3" y1="0" x2="-3" y2="-11" stroke="${c.epicJade}" stroke-width="0.6"/>` +
    `<line x1="-1.5" y1="0" x2="-1.5" y2="-13" stroke="${c.epicJade}" stroke-width="0.5"/>` +
    `<line x1="0" y1="0" x2="0" y2="-12" stroke="${c.epicJade}" stroke-width="0.6"/>` +
    `<line x1="1.5" y1="0" x2="1.5" y2="-11.5" stroke="${c.epicJade}" stroke-width="0.5"/>` +
    `<line x1="3" y1="0" x2="3" y2="-10" stroke="${c.epicJade}" stroke-width="0.6"/>` +
    // Nodes
    `<line x1="-3.3" y1="-4" x2="-2.7" y2="-4" stroke="${c.leaf}" stroke-width="0.3"/>` +
    `<line x1="-1.8" y1="-6" x2="-1.2" y2="-6" stroke="${c.leaf}" stroke-width="0.3"/>` +
    `<line x1="-0.3" y1="-5" x2="0.3" y2="-5" stroke="${c.leaf}" stroke-width="0.3"/>` +
    // Leaves
    `<path d="M-3,-8 Q-4.5,-7.5 -5,-7" stroke="${c.leaf}" stroke-width="0.3" fill="none"/>` +
    `<path d="M0,-9 Q1.5,-8.5 2.5,-8" stroke="${c.leaf}" stroke-width="0.3" fill="none"/>` +
    `<path d="M-1.5,-10 Q-3,-9.5 -4,-9" stroke="${c.leaf}" stroke-width="0.3" fill="none"/>` +
    `</g>`
  );
}

function renderGlacierPeak(x: number, y: number, c: AssetColors): string {
  return (
    `<g transform="translate(${x},${y})">` +
    // Icy mountain
    `<polygon points="-5,0 -1,-10 1,-10 5,0" fill="${c.ice}"/>` +
    `<polygon points="-1,-10 1,-10 5,0 0,0" fill="${c.snowGround}" opacity="0.6"/>` +
    // Jagged ice peaks
    `<polygon points="-1,-10 0,-13 1,-10" fill="${c.snowCap}"/>` +
    `<polygon points="-3,-6 -2,-9 -1,-6" fill="${c.icicle}" opacity="0.5"/>` +
    `<polygon points="2,-5 3,-8 4,-5" fill="${c.icicle}" opacity="0.4"/>` +
    // Crevasse detail
    `<line x1="-2" y1="-3" x2="-1" y2="-5" stroke="${c.epicCrystal}" stroke-width="0.3" opacity="0.5"/>` +
    `</g>`
  );
}

function renderBioluminescentPool(x: number, y: number, c: AssetColors): string {
  return (
    `<g transform="translate(${x},${y})">` +
    // Dark rocky rim
    `<ellipse cx="0" cy="0" rx="5" ry="2" fill="${c.boulder}"/>` +
    // Glowing pool
    `<ellipse cx="0" cy="-0.3" rx="4" ry="1.5" fill="${c.epicPortal}" opacity="0.4" class="epic-glow-pulse"/>` +
    `<ellipse cx="0" cy="-0.5" rx="2.5" ry="0.9" fill="${c.epicPortal}" opacity="0.3" class="epic-glow-pulse"/>` +
    // Glowing specks
    `<circle cx="-1.5" cy="-0.3" r="0.3" fill="${c.epicPortal}" opacity="0.6" class="epic-glow-pulse"/>` +
    `<circle cx="1.2" cy="-0.5" r="0.25" fill="${c.epicCrystal}" opacity="0.5" class="epic-glow-pulse"/>` +
    `<circle cx="0" cy="0.2" r="0.2" fill="${c.epicPortal}" opacity="0.4"/>` +
    `</g>`
  );
}

function renderMeteorCrater(x: number, y: number, c: AssetColors): string {
  return (
    `<g transform="translate(${x},${y})">` +
    // Outer rim
    `<ellipse cx="0" cy="0" rx="5" ry="2.5" fill="${c.rock}"/>` +
    // Inner crater
    `<ellipse cx="0" cy="-0.3" rx="3.5" ry="1.5" fill="${c.boulder}" opacity="0.7"/>` +
    `<ellipse cx="0" cy="-0.2" rx="2" ry="0.8" fill="${c.shadow}" opacity="0.5"/>` +
    // Scattered debris
    `<circle cx="-4" cy="-1" r="0.4" fill="${c.rock}" opacity="0.6"/>` +
    `<circle cx="3.5" cy="0.5" r="0.5" fill="${c.rock}" opacity="0.5"/>` +
    `<circle cx="-2.5" cy="1" r="0.3" fill="${c.boulder}" opacity="0.4"/>` +
    // Faint glow at center
    `<circle cx="0" cy="-0.2" r="0.8" fill="${c.epicGold}" opacity="0.2"/>` +
    `</g>`
  );
}

// ── Epic Tier — Landmarks ──

function renderTajMahal(x: number, y: number, c: AssetColors): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-4" y="-4" width="8" height="4" fill="${c.epicMarble}"/>` +
    `<path d="M-2,-4 Q0,-10 2,-4" fill="${c.epicMarble}"/>` +
    `<circle cx="0" cy="-10" r="0.5" fill="${c.epicGold}"/>` +
    `<line x1="-5" y1="0" x2="-5" y2="-8" stroke="${c.epicMarble}" stroke-width="0.4"/>` +
    `<line x1="5" y1="0" x2="5" y2="-8" stroke="${c.epicMarble}" stroke-width="0.4"/>` +
    `<circle cx="-5" cy="-8.3" r="0.3" fill="${c.epicGold}"/>` +
    `<circle cx="5" cy="-8.3" r="0.3" fill="${c.epicGold}"/>` +
    `</g>`
  );
}

function renderStBasils(x: number, y: number, c: AssetColors): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-4" y="-4" width="8" height="4" fill="${c.epicMarble}"/>` +
    `<path d="M-3,-4 Q-3,-9 -3,-4" fill="none"/>` +
    `<path d="M-3,-6 Q-3,-10 -3,-6" fill="${c.roofA}"/>` +
    `<ellipse cx="-3" cy="-8" rx="1.2" ry="1.8" fill="${c.roofA}"/>` +
    `<ellipse cx="0" cy="-9" rx="1.4" ry="2" fill="${c.epicJade}"/>` +
    `<ellipse cx="3" cy="-8" rx="1.2" ry="1.8" fill="${c.epicMagic}"/>` +
    `<circle cx="-3" cy="-10" r="0.3" fill="${c.epicGold}"/>` +
    `<circle cx="0" cy="-11.2" r="0.4" fill="${c.epicGold}"/>` +
    `<circle cx="3" cy="-10" r="0.3" fill="${c.epicGold}"/>` +
    `</g>`
  );
}

function renderOperaHouse(x: number, y: number, c: AssetColors): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-5" y="-1" width="10" height="1.5" fill="${c.epicMarble}"/>` +
    `<path d="M-4,-1 Q-2,-7 0,-1" fill="${c.epicMarble}"/>` +
    `<path d="M-1,-1 Q1,-8 3,-1" fill="${c.epicMarble}"/>` +
    `<path d="M2,-1 Q4,-6 5,-1" fill="${c.epicMarble}"/>` +
    `</g>`
  );
}

function renderBonsaiGiant(x: number, y: number, c: AssetColors): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<path d="M0,0 Q-2,-3 -1,-5 Q-3,-5 -2,-7" stroke="${c.trunk}" stroke-width="1" fill="none"/>` +
    `<path d="M0,0 Q1,-2 2,-4 Q1,-5 1.5,-6" stroke="${c.trunk}" stroke-width="0.8" fill="none"/>` +
    `<ellipse cx="-2" cy="-8" rx="2.5" ry="1.8" fill="${c.epicJade}"/>` +
    `<ellipse cx="1.5" cy="-7" rx="2" ry="1.5" fill="${c.epicJade}"/>` +
    `<ellipse cx="0" cy="-9.5" rx="1.8" ry="1.2" fill="${c.epicJade}"/>` +
    `</g>`
  );
}

// ── Legendary Tier ──

function renderFloatingIsland(x: number, y: number, c: AssetColors): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<polygon points="-3,2 -1,-1 1,-1 3,2 1,4 -1,4" fill="${c.boulder}" opacity="0.7"/>` +
    `<polygon points="-2,1 0,-1 2,1" fill="${c.boulder}" opacity="0.5"/>` +
    `<ellipse cx="0" cy="-2" rx="4" ry="1.5" fill="${c.leaf}"/>` +
    `<rect x="-0.5" y="-5" width="1" height="3" fill="${c.trunk}"/>` +
    `<ellipse cx="0" cy="-6" rx="2" ry="1.5" fill="${c.epicJade}"/>` +
    `</g>`
  );
}

function renderCrystalSpire(x: number, y: number, c: AssetColors): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<polygon points="-2,0 -1,-8 0,-12 1,-8 2,0" fill="${c.epicCrystal}" opacity="0.8"/>` +
    `<polygon points="-1.5,-2 -0.5,-10 0,-12 0.5,-10 1.5,-2" fill="${c.epicCrystal}" opacity="0.5"/>` +
    `<polygon points="-3,0 -2,-5 -1,-2" fill="${c.epicCrystal}" opacity="0.4"/>` +
    `<polygon points="3,0 2,-5 1,-2" fill="${c.epicCrystal}" opacity="0.4"/>` +
    `<line x1="0" y1="-12" x2="0" y2="-13" stroke="${c.epicCrystal}" stroke-width="0.3" opacity="0.6"/>` +
    `</g>`
  );
}

function renderDragonNest(x: number, y: number, c: AssetColors): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="0" cy="-1" rx="5" ry="2" fill="${c.trunk}"/>` +
    `<ellipse cx="0" cy="-1.5" rx="3.5" ry="1.2" fill="${c.trunk}" opacity="0.6"/>` +
    `<ellipse cx="-1" cy="-2" rx="1" ry="1.2" fill="${c.epicGold}"/>` +
    `<ellipse cx="1" cy="-2" rx="1" ry="1.2" fill="${c.epicGold}"/>` +
    `<ellipse cx="0" cy="-2.5" rx="0.8" ry="1" fill="${c.epicCrystal}"/>` +
    `<path d="M3,-2 Q5,-6 4,-8 Q6,-7 5,-4" fill="${c.epicJade}" opacity="0.5"/>` +
    `</g>`
  );
}

function renderWorldTree(x: number, y: number, c: AssetColors): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-1.5" y="-6" width="3" height="6" fill="${c.trunk}" rx="0.5"/>` +
    `<ellipse cx="0" cy="-8" rx="5" ry="4" fill="${c.epicJade}"/>` +
    `<ellipse cx="-2" cy="-10" rx="3" ry="2.5" fill="${c.epicJade}" opacity="0.8"/>` +
    `<ellipse cx="2" cy="-10" rx="3" ry="2.5" fill="${c.epicJade}" opacity="0.8"/>` +
    `<ellipse cx="0" cy="-12" rx="2.5" ry="2" fill="${c.epicJade}" opacity="0.7"/>` +
    `<circle cx="-3" cy="-9" r="0.3" fill="${c.epicGold}" class="epic-glow-pulse"/>` +
    `<circle cx="2" cy="-11" r="0.3" fill="${c.epicGold}" class="epic-glow-pulse"/>` +
    `<circle cx="0" cy="-7" r="0.25" fill="${c.epicGold}" class="epic-glow-pulse"/>` +
    `<circle cx="-1" cy="-12" r="0.2" fill="${c.epicGold}" class="epic-glow-pulse"/>` +
    `</g>`
  );
}

function renderSakuraEternal(x: number, y: number, c: AssetColors): string {
  return (
    `<g transform="translate(${x},${y})">` +
    // Ancient trunk
    `<path d="M0,0 Q-1,-3 -0.5,-5" stroke="${c.trunk}" stroke-width="1.5" fill="none"/>` +
    `<path d="M-0.5,-5 Q-2,-6 -3,-7" stroke="${c.trunk}" stroke-width="0.8" fill="none"/>` +
    `<path d="M-0.5,-5 Q1,-6 2,-7" stroke="${c.trunk}" stroke-width="0.8" fill="none"/>` +
    // Massive blossom canopy
    `<ellipse cx="0" cy="-9" rx="5" ry="3.5" fill="${c.cherryPetalPink}"/>` +
    `<ellipse cx="-2" cy="-10.5" rx="3" ry="2" fill="${c.cherryPetalPink}" opacity="0.8"/>` +
    `<ellipse cx="2" cy="-10.5" rx="3" ry="2" fill="${c.cherryPetalWhite}" opacity="0.7"/>` +
    `<ellipse cx="0" cy="-12" rx="2" ry="1.5" fill="${c.cherryPetalPink}" opacity="0.6"/>` +
    // Falling petals
    `<circle cx="-4" cy="-5" r="0.3" fill="${c.cherryPetalPink}" opacity="0.6" class="epic-glow-pulse"/>` +
    `<circle cx="3" cy="-4" r="0.25" fill="${c.cherryPetalWhite}" opacity="0.5" class="epic-glow-pulse"/>` +
    `<circle cx="-2" cy="-3" r="0.2" fill="${c.cherryPetalPink}" opacity="0.4" class="epic-glow-pulse"/>` +
    `</g>`
  );
}

function renderAncientPortal(x: number, y: number, c: AssetColors): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-4" y="-8" width="2" height="8" fill="${c.rock}" rx="0.5"/>` +
    `<rect x="2" y="-8" width="2" height="8" fill="${c.rock}" rx="0.5"/>` +
    `<path d="M-3,-8 Q0,-12 3,-8" fill="${c.rock}"/>` +
    `<ellipse cx="0" cy="-4" rx="2.5" ry="3.5" fill="${c.epicPortal}" opacity="0.4" class="epic-portal-swirl"/>` +
    `<ellipse cx="0" cy="-4" rx="1.5" ry="2.5" fill="${c.epicPortal}" opacity="0.3" class="epic-portal-swirl"/>` +
    `</g>`
  );
}

// ── Renderer Map ───────────────────────────────────────────

const EPIC_RENDERERS: Record<EpicBuildingType, EpicRenderer> = {
  // Rare — Natural
  mountFuji: renderMountFuji,
  giantSequoia: renderGiantSequoia,
  coralReef: renderCoralReef,
  geyser: renderGeyser,
  hotSpring: renderHotSpring,
  grandCanyon: renderGrandCanyon,
  oasis: renderOasis,
  volcano: renderVolcano,
  giantMushroom: renderGiantMushroom,
  // Rare — Landmarks
  colosseum: renderColosseum,
  pagoda: renderPagoda,
  torii: renderTorii,
  eiffelTower: renderEiffelTower,
  windmillGrand: renderWindmillGrand,
  // Epic — Natural
  aurora: renderAurora,
  giantWaterfall: renderGiantWaterfall,
  bambooGrove: renderBambooGrove,
  glacierPeak: renderGlacierPeak,
  bioluminescentPool: renderBioluminescentPool,
  meteorCrater: renderMeteorCrater,
  bonsaiGiant: renderBonsaiGiant,
  // Epic — Landmarks
  tajMahal: renderTajMahal,
  stBasils: renderStBasils,
  operaHouse: renderOperaHouse,
  // Legendary
  floatingIsland: renderFloatingIsland,
  crystalSpire: renderCrystalSpire,
  dragonNest: renderDragonNest,
  worldTree: renderWorldTree,
  sakuraEternal: renderSakuraEternal,
  ancientPortal: renderAncientPortal,
};

export { EPIC_RENDERERS };

// ── Public Rendering API ───────────────────────────────────

/**
 * Render radial gradient defs for epic glow effects.
 * Returns raw SVG content (not wrapped in <defs>).
 */
export function renderEpicGlowDefs(mode: ColorMode): string {
  const tiers: { id: string; color: string; darkOuter: number; lightOuter: number }[] = [
    { id: 'epic-glow-rare', color: '#FFD700', darkOuter: 0, lightOuter: 0 },
    { id: 'epic-glow-epic', color: '#9B59B6', darkOuter: 0, lightOuter: 0 },
    { id: 'epic-glow-legendary', color: '#00CED1', darkOuter: 0, lightOuter: 0 },
  ];

  return tiers
    .map(
      (t) =>
        `<radialGradient id="${t.id}">` +
        `<stop offset="0%" stop-color="${t.color}" stop-opacity="${mode === 'dark' ? 0.4 : 0.3}"/>` +
        `<stop offset="100%" stop-color="${t.color}" stop-opacity="0"/>` +
        `</radialGradient>`,
    )
    .join('');
}

/**
 * Render CSS keyframes for epic building animations.
 */
export function renderEpicCSS(): string {
  return [
    `@keyframes epic-pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 0.9; } }`,
    `.epic-glow-pulse { animation: epic-pulse 3s ease-in-out infinite; }`,
    `@keyframes epic-swirl { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`,
    `.epic-portal-swirl { animation: epic-swirl 8s linear infinite; transform-origin: center; }`,
  ].join('\n');
}

/**
 * Render all placed epic buildings with glow underlays.
 */
export function renderEpicBuildings(
  placed: PlacedEpicBuilding[],
  weekPalettes: TerrainPalette100[],
): string {
  if (placed.length === 0) return '';

  const parts = placed.map((epic) => {
    const weekIdx = Math.min(epic.week, weekPalettes.length - 1);
    const palette = weekPalettes[weekIdx];
    const c = palette.assets;
    const renderer = EPIC_RENDERERS[epic.type];

    const glowId = `epic-glow-${epic.tier}`;
    const glow = `<ellipse cx="${epic.cx}" cy="${epic.cy}" rx="8" ry="4" fill="url(#${glowId})" opacity="0.6"/>`;

    const building = renderer(epic.cx, epic.cy, c);
    return glow + building;
  });

  return `<g class="epic-buildings">${parts.join('')}</g>`;
}
