import type { IsoCell } from './blocks.js';
import type { TerrainPalette100, AssetColors } from './palette.js';
import type { BiomeContext } from './biomes.js';
import { seededRandom, clamp } from '../../utils/math.js';
import { getSeasonalPoolOverrides } from './seasons.js';

// ── Asset Type Definitions (38 total) ───────────────────────

type AssetType =
  // Water (9–22)
  | 'whale'
  | 'fish'
  | 'fishSchool'
  | 'boat'
  | 'seagull'
  | 'dock'
  | 'waves'
  | 'kelp'
  | 'coral'
  | 'jellyfish'
  | 'turtle'
  | 'buoy'
  | 'sailboat'
  | 'lighthouse'
  | 'crab'
  // Shore/Wetland (23–30)
  | 'rock'
  | 'boulder'
  | 'flower'
  | 'bush'
  | 'driftwood'
  | 'sandcastle'
  | 'tidePools'
  | 'heron'
  | 'shellfish'
  | 'cattail'
  | 'frog'
  | 'lily'
  // Grassland (31–42)
  | 'pine'
  | 'deciduous'
  | 'mushroom'
  | 'stump'
  | 'deer'
  | 'rabbit'
  | 'fox'
  | 'butterfly'
  | 'beehive'
  | 'wildflowerPatch'
  | 'tallGrass'
  | 'birch'
  | 'haybale'
  // Forest (43–65)
  | 'willow'
  | 'palm'
  | 'bird'
  | 'owl'
  | 'squirrel'
  | 'moss'
  | 'fern'
  | 'deadTree'
  | 'log'
  | 'berryBush'
  | 'spider'
  // Farm (66–78)
  | 'wheat'
  | 'fence'
  | 'scarecrow'
  | 'barn'
  | 'sheep'
  | 'cow'
  | 'chicken'
  | 'horse'
  | 'ricePaddy'
  | 'silo'
  | 'pigpen'
  | 'trough'
  | 'haystack'
  | 'orchard'
  | 'beeFarm'
  | 'pumpkin'
  | 'appleTree'
  | 'oliveTree'
  | 'lemonTree'
  | 'orangeTree'
  | 'pearTree'
  | 'peachTree'
  | 'donkey'
  | 'goat'
  // Village (79–90)
  | 'tent'
  | 'hut'
  | 'house'
  | 'houseB'
  | 'church'
  | 'windmill'
  | 'well'
  | 'tavern'
  | 'bakery'
  | 'stable'
  | 'garden'
  | 'laundry'
  | 'doghouse'
  | 'shrine'
  | 'wagon'
  // Town/City (91–99)
  | 'market'
  | 'inn'
  | 'blacksmith'
  | 'castle'
  | 'tower'
  | 'bridge'
  | 'cathedral'
  | 'library'
  | 'clocktower'
  | 'statue'
  | 'park'
  | 'warehouse'
  | 'gatehouse'
  | 'manor'
  // Biome blend
  | 'reeds'
  | 'fountain'
  | 'canal'
  | 'watermill'
  | 'gardenTree'
  | 'pondLily'
  // Cross-level decorations
  | 'cart'
  | 'barrel'
  | 'torch'
  | 'flag'
  | 'cobblePath'
  | 'smoke'
  | 'signpost'
  | 'lantern'
  | 'woodpile'
  | 'puddle'
  | 'campfire'
  // Seasonal: Winter
  | 'snowPine'
  | 'snowDeciduous'
  | 'snowman'
  | 'snowdrift'
  | 'igloo'
  | 'frozenPond'
  | 'icicle'
  | 'sled'
  | 'snowCoveredRock'
  | 'bareBush'
  | 'winterBird'
  | 'firewood'
  | 'houseWinter'
  | 'houseBWinter'
  | 'barnWinter'
  | 'churchWinter'
  | 'christmasTree'
  | 'winterLantern'
  | 'frozenFountain'
  // Seasonal: Spring
  | 'cherryBlossom'
  | 'cherryBlossomSmall'
  | 'cherryPetals'
  | 'tulip'
  | 'tulipField'
  | 'sprout'
  | 'nest'
  | 'lamb'
  | 'crocus'
  | 'rainPuddle'
  | 'birdhouse'
  | 'gardenBed'
  | 'cherryBlossomFull'
  | 'cherryBlossomBranch'
  | 'peachBlossom'
  | 'flowerBed'
  | 'wateringCan'
  | 'seedling'
  | 'robinBird'
  | 'butterflyGarden'
  | 'umbrella'
  // Seasonal: Summer
  | 'parasol'
  | 'beachTowel'
  | 'sandcastleSummer'
  | 'surfboard'
  | 'iceCreamCart'
  | 'hammock'
  | 'sunflower'
  | 'watermelon'
  | 'sprinkler'
  | 'lemonade'
  | 'fireflies'
  | 'swimmingPool'
  // Seasonal: Autumn
  | 'autumnMaple'
  | 'autumnOak'
  | 'autumnBirch'
  | 'autumnGinkgo'
  | 'fallenLeaves'
  | 'leafSwirl'
  | 'acorn'
  | 'cornStalk'
  | 'scarecrowAutumn'
  | 'harvestBasket'
  | 'hotDrink'
  | 'autumnWreath'
  | 'pumpkinPatch'
  | 'hayMaze'
  | 'appleBasket'
  | 'rake';

interface PlacedAsset {
  cell: IsoCell;
  type: AssetType;
  cx: number;
  cy: number;
  ox: number;
  oy: number;
  variant: number; // 0, 1, or 2 — selected by variantSeed
}

// ── Level100 → Asset Pool ───────────────────────────────────

interface AssetPool {
  types: AssetType[];
  chance: number;
}

/**
 * Apply density offset to a level for asset pool selection.
 * density=5 is neutral (no change), density=10 shifts +25, density=1 shifts -20.
 * Only affects which asset pool is selected, not terrain color/elevation.
 *
 * Level 0 (no activity) is always preserved — density never turns
 * empty days into active ones, and active days never become level 0.
 */
export function getEffectiveLevel(level100: number, density: number): number {
  if (level100 === 0) return 0;
  return clamp(level100 + (density - 5) * 5, 1, 99);
}

function getLevelPool100(level: number): AssetPool {
  // Desert (0–8): barren, rocks, occasional cactus-like features
  if (level <= 4)
    return { types: ['rock', 'boulder', 'stump', 'deadTree', 'puddle'], chance: 0.08 };
  if (level <= 8)
    return { types: ['rock', 'boulder', 'bush', 'stump', 'deadTree', 'signpost'], chance: 0.13 };
  // Water / Oasis (9–22): aquatic life
  if (level <= 14)
    return {
      types: [
        'whale',
        'fish',
        'fishSchool',
        'boat',
        'seagull',
        'dock',
        'waves',
        'kelp',
        'coral',
        'jellyfish',
        'turtle',
        'crab',
        'buoy',
      ],
      chance: 0.21,
    };
  if (level <= 22)
    return {
      types: [
        'fish',
        'fishSchool',
        'boat',
        'seagull',
        'waves',
        'dock',
        'kelp',
        'coral',
        'turtle',
        'sailboat',
        'lighthouse',
        'crab',
        'buoy',
      ],
      chance: 0.24,
    };
  // Shore / Wetland (23–30): transition to green
  if (level <= 27)
    return {
      types: [
        'rock',
        'boulder',
        'flower',
        'bush',
        'bird',
        'driftwood',
        'sandcastle',
        'tidePools',
        'heron',
        'shellfish',
        'cattail',
        'frog',
        'lily',
      ],
      chance: 0.21,
    };
  if (level <= 30)
    return {
      types: [
        'bush',
        'flower',
        'rock',
        'fence',
        'driftwood',
        'tidePools',
        'heron',
        'cattail',
        'frog',
        'lily',
        'puddle',
      ],
      chance: 0.24,
    };
  // Grassland (31–42): open plains
  if (level <= 36)
    return {
      types: [
        'bush',
        'flower',
        'mushroom',
        'deer',
        'bird',
        'rabbit',
        'fox',
        'butterfly',
        'wildflowerPatch',
        'tallGrass',
        'signpost',
        'puddle',
      ],
      chance: 0.29,
    };
  if (level <= 42)
    return {
      types: [
        'pine',
        'deciduous',
        'bush',
        'mushroom',
        'flower',
        'deer',
        'rabbit',
        'fox',
        'butterfly',
        'beehive',
        'birch',
        'haybale',
        'tallGrass',
        'lantern',
      ],
      chance: 0.33,
    };
  // Forest (43–65): dense green
  if (level <= 52)
    return {
      types: [
        'pine',
        'pine',
        'deciduous',
        'willow',
        'bird',
        'bush',
        'owl',
        'squirrel',
        'moss',
        'fern',
        'berryBush',
        'log',
        'woodpile',
      ],
      chance: 0.39,
    };
  if (level <= 58)
    return {
      types: [
        'pine',
        'deciduous',
        'willow',
        'palm',
        'bird',
        'pine',
        'stump',
        'owl',
        'moss',
        'fern',
        'deadTree',
        'log',
        'spider',
        'campfire',
      ],
      chance: 0.42,
    };
  if (level <= 65)
    return {
      types: [
        'deciduous',
        'willow',
        'pine',
        'palm',
        'bird',
        'mushroom',
        'squirrel',
        'berryBush',
        'fern',
        'moss',
        'log',
        'woodpile',
      ],
      chance: 0.36,
    };
  // Farm (66–78): livestock + crops + fruit trees
  if (level <= 70)
    return {
      types: [
        'wheat',
        'fence',
        'sheep',
        'goat',
        'chicken',
        'bush',
        'ricePaddy',
        'pumpkin',
        'orchard',
        'appleTree',
        'pearTree',
        'trough',
        'haystack',
        'signpost',
      ],
      chance: 0.39,
    };
  if (level <= 75)
    return {
      types: [
        'wheat',
        'fence',
        'scarecrow',
        'cow',
        'cow',
        'sheep',
        'goat',
        'chicken',
        'horse',
        'donkey',
        'ricePaddy',
        'silo',
        'pigpen',
        'trough',
        'orchard',
        'appleTree',
        'lemonTree',
        'orangeTree',
        'beeFarm',
        'pumpkin',
      ],
      chance: 0.46,
    };
  if (level <= 78)
    return {
      types: [
        'barn',
        'sheep',
        'goat',
        'cow',
        'cow',
        'horse',
        'horse',
        'donkey',
        'wheat',
        'fence',
        'chicken',
        'cart',
        'ricePaddy',
        'silo',
        'pigpen',
        'haystack',
        'orchard',
        'appleTree',
        'oliveTree',
        'lemonTree',
        'peachTree',
        'beeFarm',
        'haybale',
      ],
      chance: 0.5,
    };
  // Village (79–90): buildings emerge
  if (level <= 84)
    return {
      types: [
        'tent',
        'hut',
        'house',
        'well',
        'fence',
        'sheep',
        'barrel',
        'tavern',
        'bakery',
        'stable',
        'garden',
        'doghouse',
        'shrine',
        'lantern',
        'woodpile',
      ],
      chance: 0.5,
    };
  if (level <= 90)
    return {
      types: [
        'house',
        'houseB',
        'church',
        'windmill',
        'well',
        'barrel',
        'torch',
        'tavern',
        'bakery',
        'stable',
        'garden',
        'laundry',
        'wagon',
        'shrine',
        'lantern',
        'signpost',
      ],
      chance: 0.55,
    };
  // Town / City (91–99): dense civilization with nature
  if (level <= 95)
    return {
      types: [
        'house',
        'houseB',
        'market',
        'inn',
        'windmill',
        'flag',
        'cobblePath',
        'torch',
        'gardenTree',
        'flower',
        'bush',
        'cathedral',
        'library',
        'clocktower',
        'statue',
        'park',
        'warehouse',
        'lantern',
      ],
      chance: 0.62,
    };
  return {
    types: [
      'castle',
      'tower',
      'church',
      'market',
      'inn',
      'blacksmith',
      'bridge',
      'flag',
      'cobblePath',
      'gardenTree',
      'flower',
      'fountain',
      'cathedral',
      'library',
      'clocktower',
      'statue',
      'park',
      'gatehouse',
      'manor',
      'warehouse',
      'lantern',
    ],
    chance: 0.72,
  };
}

// ── Biome-Aware Blending ─────────────────────────────────────

function blendWithBiome(pool: AssetPool, ctx: BiomeContext, level: number): AssetPool {
  const types = [...pool.types];
  let chance = pool.chance;

  if (ctx.isRiver) {
    // River cells get water assets adapted to surrounding level
    if (level >= 91) types.push('bridge', 'canal');
    else if (level >= 66) types.push('watermill', 'canal', 'reeds', 'heron');
    else if (level >= 31) types.push('reeds', 'reeds', 'willow', 'frog', 'heron', 'cattail');
    else types.push('reeds', 'pondLily', 'lily', 'frog');
    chance = Math.max(chance, 0.35);
  } else if (ctx.isPond) {
    // Pond cells get pond-specific decorations
    if (level >= 79) types.push('fountain', 'pondLily', 'reeds', 'lily');
    else types.push('pondLily', 'pondLily', 'reeds', 'lily', 'frog', 'cattail');
    chance = Math.max(chance, 0.3);
  } else if (ctx.nearWater) {
    // Adjacent to water: edge vegetation
    if (level >= 79) types.push('fountain', 'gardenTree');
    else types.push('willow', 'reeds', 'bush', 'driftwood', 'heron');
    chance += 0.05;
  }

  if (ctx.forestDensity > 0.3) {
    // Forest overlay: add trees adapted to the level
    const treesToAdd = ctx.forestDensity > 0.6 ? 3 : 1;
    for (let i = 0; i < treesToAdd; i++) {
      if (level >= 91) types.push('gardenTree', 'flower');
      else if (level >= 79) types.push('gardenTree');
      else if (level >= 43) types.push('pine', 'deciduous', 'owl', 'squirrel', 'moss', 'fern');
      else types.push('pine', 'birch');
    }
    chance += ctx.forestDensity * 0.08;
  }

  // Unconditional high-level greenery: towns and cities always get some nature
  if (level >= 96) {
    types.push('gardenTree', 'fountain', 'park');
  } else if (level >= 91) {
    types.push('gardenTree', 'lantern');
  }

  return { types, chance: Math.min(chance, 0.65) };
}

// ── Neighbor Richness ───────────────────────────────────────

function computeRichness(cell: IsoCell, cellMap: Map<string, IsoCell>): number {
  let neighborSum = 0;
  let count = 0;
  for (let dw = -1; dw <= 1; dw++) {
    for (let dd = -1; dd <= 1; dd++) {
      if (dw === 0 && dd === 0) continue;
      const key = `${cell.week + dw},${cell.day + dd}`;
      const n = cellMap.get(key);
      if (n) {
        neighborSum += n.level100;
        count++;
      }
    }
  }
  if (count === 0) return 0;
  return neighborSum / (count * 99);
}

// ── Animation Budget ────────────────────────────────────────

/** Asset types that use SMIL animation elements (animate, animateTransform, animateMotion) */
const SMIL_ANIMATED_TYPES = new Set<AssetType>([
  'seagull',
  'waves',
  'bird',
  'windmill',
  'smoke',
  'fountain',
  'watermill',
  'jellyfish',
  'turtle',
  'butterfly',
  'bakery',
  'clocktower',
  'campfire',
]);

/** Asset types that use CSS animation classes (sway-gentle, sway-slow) */
const CSS_ANIMATED_TYPES = new Set<AssetType>(['cattail', 'tallGrass', 'laundry']);

// ── Asset Selection ─────────────────────────────────────────

export function selectAssets(
  isoCells: IsoCell[],
  seed: number,
  variantSeed?: number,
  biomeMap?: Map<string, BiomeContext>,
  seasonRotation?: number,
  density: number = 5,
): PlacedAsset[] {
  const rng = seededRandom(seed);
  const variantRng = seededRandom(variantSeed ?? seed);
  const assets: PlacedAsset[] = [];
  const smokeBudget = { remaining: 8 };
  const animBudget = { smil: 18, css: 15 };

  const cellMap = new Map<string, IsoCell>();
  for (const cell of isoCells) {
    cellMap.set(`${cell.week},${cell.day}`, cell);
  }

  for (const cell of isoCells) {
    const effectiveLevel = getEffectiveLevel(cell.level100, density);
    let pool = getLevelPool100(effectiveLevel);
    const biomeCtx = biomeMap?.get(`${cell.week},${cell.day}`);
    if (biomeCtx) pool = blendWithBiome(pool, biomeCtx, effectiveLevel);

    // Apply seasonal overrides if rotation is provided
    if (seasonRotation != null) {
      const { add, remove } = getSeasonalPoolOverrides(cell.week, seasonRotation, effectiveLevel);
      pool = {
        types: [...pool.types.filter((t) => !remove.has(t)), ...add] as AssetType[],
        chance: pool.chance,
      };
    }

    const richness = computeRichness(cell, cellMap);
    const finalChance = pool.chance + richness * 0.2;

    if (pool.types.length === 0) continue; // skip if seasonal filtering emptied the pool

    if (rng() < finalChance) {
      let type = pool.types[Math.floor(rng() * pool.types.length)];

      // Enforce smoke budget
      if (type === 'smoke' && smokeBudget.remaining <= 0) {
        type = 'barrel';
      } else if (type === 'smoke') {
        smokeBudget.remaining--;
      }

      const ox = (rng() - 0.5) * 3;
      const oy = (rng() - 0.5) * 1.5;
      let variant = Math.floor(variantRng() * 3);

      // Enforce animation budget: swap animated types to static fallback when exhausted
      if (SMIL_ANIMATED_TYPES.has(type)) {
        if (animBudget.smil > 0) animBudget.smil--;
        else type = 'barrel'; // swap to static asset
      }
      if (CSS_ANIMATED_TYPES.has(type)) {
        if (animBudget.css > 0) animBudget.css--;
        else variant = 0; // v=0 is always the static default
      }

      assets.push({ cell, type, cx: cell.isoX, cy: cell.isoY, ox, oy, variant });

      // High richness areas can get a second asset (relaxed threshold)
      if (richness > 0.4 && cell.level100 >= 25 && rng() < 0.4) {
        let type2 = pool.types[Math.floor(rng() * pool.types.length)];
        if (type2 === 'smoke' && smokeBudget.remaining <= 0) type2 = 'torch';
        else if (type2 === 'smoke') smokeBudget.remaining--;

        // Animation budget for second asset
        if (SMIL_ANIMATED_TYPES.has(type2)) {
          if (animBudget.smil > 0) animBudget.smil--;
          else type2 = 'barrel';
        }

        let variant2 = Math.floor(variantRng() * 3);
        if (CSS_ANIMATED_TYPES.has(type2)) {
          if (animBudget.css > 0) animBudget.css--;
          else variant2 = 0;
        }

        assets.push({
          cell,
          type: type2,
          cx: cell.isoX,
          cy: cell.isoY,
          ox: (rng() - 0.5) * 4,
          oy: (rng() - 0.5) * 2,
          variant: variant2,
        });
      }
    }
  }

  return assets;
}

// ── SVG Renderers ─────────────────────────────────────────

// Water assets

function svgWhale(x: number, y: number, c: AssetColors, v: number): string {
  if (v === 1) {
    // Diving variant — tail up, no spout
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="0" cy="-0.5" rx="3" ry="1.5" fill="${c.whale}" transform="rotate(-15)"/>` +
      `<ellipse cx="0" cy="0" rx="2" ry="0.8" fill="${c.whaleBelly}" opacity="0.5"/>` +
      `<path d="M2.5,-1.5 Q4,-3 5,-3.5 M2.5,-1.5 Q4,-2 5,-1" stroke="${c.whale}" fill="none" stroke-width="0.8"/>` +
      `<ellipse cx="5" cy="-3.5" rx="1" ry="0.4" fill="${c.whale}"/>` +
      `<ellipse cx="5" cy="-1" rx="1" ry="0.4" fill="${c.whale}"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // Baby whale variant — smaller, rounder
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="0" cy="-0.8" rx="2.2" ry="1.3" fill="${c.whale}"/>` +
      `<ellipse cx="0" cy="-0.3" rx="1.5" ry="0.6" fill="${c.whaleBelly}" opacity="0.5"/>` +
      `<path d="M2,-0.8 Q3,-0.8 3.5,-1.8 M2,-0.8 Q3,-0.8 3.5,0.2" stroke="${c.whale}" fill="none" stroke-width="0.7"/>` +
      `<ellipse cx="3.5" cy="-1.8" rx="0.8" ry="0.3" fill="${c.whale}"/>` +
      `<ellipse cx="3.5" cy="0.2" rx="0.8" ry="0.3" fill="${c.whale}"/>` +
      `<circle cx="-1.2" cy="-1" r="0.3" fill="#fff"/>` +
      `<circle cx="-1.2" cy="-1" r="0.15" fill="#222"/>` +
      `</g>`
    );
  }
  // Redesigned: rounder body, HORIZONTAL tail fluke, water spout
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="0" cy="-1.2" rx="3.5" ry="2" fill="${c.whale}"/>` +
    `<ellipse cx="0" cy="-0.5" rx="2.5" ry="1" fill="${c.whaleBelly}" opacity="0.5"/>` +
    // Horizontal tail fluke (key identifier)
    `<path d="M3,-1.2 Q4.5,-1.2 5,-2.5 M3,-1.2 Q4.5,-1.2 5,0" stroke="${c.whale}" fill="none" stroke-width="1"/>` +
    `<ellipse cx="5" cy="-2.5" rx="1.2" ry="0.4" fill="${c.whale}"/>` +
    `<ellipse cx="5" cy="0" rx="1.2" ry="0.4" fill="${c.whale}"/>` +
    // Eye
    `<circle cx="-2" cy="-1.5" r="0.4" fill="#fff"/>` +
    `<circle cx="-2" cy="-1.5" r="0.2" fill="#222"/>` +
    // Spout (3 diverging lines)
    `<line x1="-0.5" y1="-3.2" x2="-1.2" y2="-4.5" stroke="${c.waterLight}" stroke-width="0.3" opacity="0.6"/>` +
    `<line x1="-0.5" y1="-3.2" x2="-0.5" y2="-4.8" stroke="${c.waterLight}" stroke-width="0.3" opacity="0.6"/>` +
    `<line x1="-0.5" y1="-3.2" x2="0.2" y2="-4.5" stroke="${c.waterLight}" stroke-width="0.3" opacity="0.6"/>` +
    `</g>`
  );
}

function svgFish(x: number, y: number, c: AssetColors, v: number): string {
  if (v === 1) {
    // Pair variant — two fish
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="-1" cy="-0.5" rx="1.3" ry="0.5" fill="${c.fish}"/>` +
      `<polygon points="0.3,-0.5 1,-1.3 1,0.3" fill="${c.fish}"/>` +
      `<ellipse cx="1" cy="-1.5" rx="1.1" ry="0.4" fill="${c.fish}" opacity="0.8"/>` +
      `<polygon points="2.1,-1.5 2.6,-2.1 2.6,-0.9" fill="${c.fish}" opacity="0.8"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // Striped large variant
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="0" cy="-1" rx="2.2" ry="0.9" fill="${c.fish}"/>` +
      `<polygon points="2.2,-1 3.2,-2.2 3.2,0.2" fill="${c.fish}"/>` +
      `<line x1="-0.5" y1="-0.3" x2="-0.5" y2="-1.7" stroke="${c.whaleBelly}" stroke-width="0.3" opacity="0.4"/>` +
      `<line x1="0.5" y1="-0.3" x2="0.5" y2="-1.7" stroke="${c.whaleBelly}" stroke-width="0.3" opacity="0.4"/>` +
      `<circle cx="-1.3" cy="-1.1" r="0.3" fill="#fff"/>` +
      `</g>`
    );
  }
  // Redesigned: slender body, VERTICAL tail fin
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="0" cy="-0.8" rx="1.8" ry="0.7" fill="${c.fish}"/>` +
    // Vertical tail fin (key differentiator from whale)
    `<polygon points="1.8,-0.8 2.8,-2 2.8,0.4" fill="${c.fish}"/>` +
    `<circle cx="-1" cy="-0.9" r="0.25" fill="#fff"/>` +
    `</g>`
  );
}

function svgFishSchool(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="-1" cy="-0.5" rx="1" ry="0.4" fill="${c.fish}" opacity="0.8"/>` +
    `<ellipse cx="1" cy="-1.2" rx="0.8" ry="0.35" fill="${c.fish}" opacity="0.7"/>` +
    `<ellipse cx="0.5" cy="0" rx="0.9" ry="0.4" fill="${c.fish}" opacity="0.6"/>` +
    `</g>`
  );
}

function svgBoat(x: number, y: number, c: AssetColors, v: number): string {
  if (v === 1) {
    // Sailboat variant
    return (
      `<g transform="translate(${x},${y})">` +
      `<polygon points="-3,0 -2,-1.5 3,-1.5 3.5,0" fill="${c.boat}"/>` +
      `<line x1="0" y1="-1.5" x2="0" y2="-6" stroke="${c.trunk}" stroke-width="0.4"/>` +
      `<polygon points="0,-5.5 0,-2 2.5,-2.5" fill="${c.sail}" opacity="0.9"/>` +
      `<polygon points="0,-5 0,-2.5 -2,-3" fill="${c.sail}" opacity="0.7"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // Fishing boat variant (no sail, fishing rod)
    return (
      `<g transform="translate(${x},${y})">` +
      `<polygon points="-2.5,0 -1.5,-1 2.5,-1 3,0" fill="${c.boat}"/>` +
      `<line x1="2" y1="-1" x2="3.5" y2="-3" stroke="${c.trunk}" stroke-width="0.3"/>` +
      `<line x1="3.5" y1="-3" x2="4" y2="-1.5" stroke="${c.waterLight}" stroke-width="0.2" opacity="0.6"/>` +
      `</g>`
    );
  }
  return (
    `<g transform="translate(${x},${y})">` +
    `<polygon points="-3,0 -2,-1.5 3,-1.5 3.5,0" fill="${c.boat}"/>` +
    `<line x1="0" y1="-1.5" x2="0" y2="-6" stroke="${c.trunk}" stroke-width="0.4"/>` +
    `<polygon points="0,-5.5 0,-2 2.5,-2.5" fill="${c.sail}" opacity="0.9"/>` +
    `</g>`
  );
}

function svgSeagull(x: number, y: number, c: AssetColors, v: number): string {
  if (v === 1) {
    // Sitting variant — perched on water
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="0" cy="-1" rx="1.2" ry="0.7" fill="${c.seagull}"/>` +
      `<circle cx="-0.8" cy="-1.5" r="0.4" fill="${c.seagull}"/>` +
      `<polygon points="-1.2,-1.4 -1.7,-1.3 -1.2,-1.2" fill="${c.wheat}"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // Pair variant — two flying
    return (
      `<g transform="translate(${x},${y})">` +
      `<g>` +
      `<path d="M-1.5,-3 Q-0.5,-4.5 0.5,-3" stroke="${c.seagull}" fill="none" stroke-width="0.5"/>` +
      `<path d="M1,-4.5 Q2,-5.5 3,-4.5" stroke="${c.seagull}" fill="none" stroke-width="0.4" opacity="0.7"/>` +
      `<animateMotion path="M0,0 C2,-1 3,0 2,1 C1,2 -1,1 -2,0 C-3,-1 -1,-2 0,0" dur="10s" repeatCount="indefinite"/>` +
      `</g>` +
      `</g>`
    );
  }
  return (
    `<g transform="translate(${x},${y})">` +
    `<g>` +
    `<path d="M-2,-3 Q-1,-4.5 0,-3 Q1,-4.5 2,-3" stroke="${c.seagull}" fill="none" stroke-width="0.6"/>` +
    `<circle cx="0" cy="-3" r="0.4" fill="${c.seagull}"/>` +
    `<animateMotion path="M0,0 C2,-1 3,0 2,1 C1,2 -1,1 -2,0 C-3,-1 -1,-2 0,0" dur="10s" repeatCount="indefinite"/>` +
    `</g>` +
    `</g>`
  );
}

function svgDock(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-3" y="-0.5" width="6" height="1" fill="${c.dock}" rx="0.2"/>` +
    `<line x1="-2" y1="0.5" x2="-2" y2="1.5" stroke="${c.dock}" stroke-width="0.5"/>` +
    `<line x1="2" y1="0.5" x2="2" y2="1.5" stroke="${c.dock}" stroke-width="0.5"/>` +
    `</g>`
  );
}

function svgWaves(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<path d="M-3,-0.5 Q-1.5,-1.5 0,-0.5 Q1.5,0.5 3,-0.5" stroke="${c.waterLight}" fill="none" stroke-width="0.4" opacity="0.5">` +
    `<animate attributeName="d" values="M-3,-0.5 Q-1.5,-1.5 0,-0.5 Q1.5,0.5 3,-0.5;M-3,-0.3 Q-1.5,-1.2 0,-0.8 Q1.5,0.2 3,-0.3;M-3,-0.5 Q-1.5,-1.5 0,-0.5 Q1.5,0.5 3,-0.5" dur="4s" repeatCount="indefinite"/>` +
    `</path>` +
    `</g>`
  );
}

// Shore assets

function svgRock(x: number, y: number, c: AssetColors, v: number): string {
  if (v === 1) {
    // Rounded boulder with highlight
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="0" cy="-1" rx="2" ry="1.3" fill="${c.rock}"/>` +
      `<ellipse cx="-0.4" cy="-1.4" rx="1" ry="0.5" fill="${c.boulder}" opacity="0.6"/>` +
      `<ellipse cx="-0.6" cy="-1.2" rx="0.3" ry="0.15" fill="${c.snowCap}" opacity="0.3"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // Stacked rocks with shadow
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="0" cy="-0.2" rx="2.5" ry="0.8" fill="${c.shadow}" opacity="0.2"/>` +
      `<ellipse cx="0" cy="-0.5" rx="2.4" ry="0.7" fill="${c.rock}"/>` +
      `<ellipse cx="0.4" cy="-1.2" rx="1.6" ry="0.5" fill="${c.boulder}"/>` +
      `<ellipse cx="0.2" cy="-1.8" rx="0.8" ry="0.3" fill="${c.rock}"/>` +
      `<ellipse cx="-0.3" cy="-1.5" rx="0.2" ry="0.1" fill="${c.snowCap}" opacity="0.25"/>` +
      `</g>`
    );
  }
  // Default: angular rock with texture lines
  return (
    `<g transform="translate(${x},${y})">` +
    `<polygon points="-1.5,0 -1.2,-1.8 -0.2,-2.5 0.8,-2.2 1.5,-1 1.2,0" fill="${c.rock}"/>` +
    `<polygon points="-0.8,-0.5 -0.5,-1.6 0.3,-1.8 0.8,-1 0.5,-0.3" fill="${c.boulder}" opacity="0.5"/>` +
    `<line x1="-0.5" y1="-1.2" x2="0.3" y2="-1.5" stroke="${c.shadow}" stroke-width="0.15" opacity="0.3"/>` +
    `</g>`
  );
}

function svgBoulder(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="0" cy="-1.5" rx="2.5" ry="1.8" fill="${c.boulder}"/>` +
    `<ellipse cx="-0.5" cy="-2" rx="1.5" ry="1" fill="${c.rock}" opacity="0.5"/>` +
    `</g>`
  );
}

function svgFlower(x: number, y: number, c: AssetColors, v: number): string {
  if (v === 1) {
    // Yellow flower variant
    return (
      `<g transform="translate(${x},${y})">` +
      `<line x1="0" y1="0" x2="0" y2="-2.5" stroke="${c.pine}" stroke-width="0.3"/>` +
      `<circle cx="0" cy="-3" r="1" fill="${c.flowerCenter}"/>` +
      `<circle cx="0" cy="-3" r="0.4" fill="${c.flower}"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // Purple cluster variant
    return (
      `<g transform="translate(${x},${y})">` +
      `<line x1="-0.8" y1="0" x2="-0.8" y2="-2" stroke="${c.pine}" stroke-width="0.25"/>` +
      `<line x1="0.8" y1="0" x2="0.8" y2="-2.2" stroke="${c.pine}" stroke-width="0.25"/>` +
      `<circle cx="-0.8" cy="-2.5" r="0.7" fill="${c.wildflower}"/>` +
      `<circle cx="0.8" cy="-2.7" r="0.7" fill="${c.wildflower}"/>` +
      `<circle cx="0" cy="-2.3" r="0.5" fill="${c.wildflower}" opacity="0.8"/>` +
      `</g>`
    );
  }
  return (
    `<g transform="translate(${x},${y})">` +
    `<line x1="0" y1="0" x2="0" y2="-2.5" stroke="${c.pine}" stroke-width="0.3"/>` +
    `<circle cx="0" cy="-3" r="1" fill="${c.flower}"/>` +
    `<circle cx="0" cy="-3" r="0.4" fill="${c.flowerCenter}"/>` +
    `</g>`
  );
}

function svgBush(x: number, y: number, c: AssetColors, v: number): string {
  if (v === 1) {
    // Wide/flat multi-layer variant
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="0" cy="-0.6" rx="3.2" ry="1.2" fill="${c.bushDark}"/>` +
      `<ellipse cx="-0.8" cy="-1" rx="1.8" ry="0.9" fill="${c.bush}"/>` +
      `<ellipse cx="0.9" cy="-0.9" rx="1.6" ry="0.8" fill="${c.bush}"/>` +
      `<ellipse cx="0" cy="-1.2" rx="1.2" ry="0.6" fill="${c.leafLight}"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // Flowering variant with depth
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="0" cy="-1" rx="2.3" ry="1.6" fill="${c.bushDark}"/>` +
      `<ellipse cx="-0.5" cy="-1.5" rx="1.5" ry="1.1" fill="${c.bush}"/>` +
      `<ellipse cx="0.6" cy="-1.3" rx="1.3" ry="1" fill="${c.bush}"/>` +
      `<ellipse cx="0" cy="-1.8" rx="0.9" ry="0.6" fill="${c.leafLight}"/>` +
      `<circle cx="-0.9" cy="-2.1" r="0.35" fill="${c.flower}"/>` +
      `<circle cx="0.4" cy="-2.4" r="0.3" fill="${c.flowerAlt}"/>` +
      `<circle cx="0.9" cy="-1.8" r="0.28" fill="${c.flower}"/>` +
      `<circle cx="-0.3" cy="-2.6" r="0.25" fill="${c.flowerAlt}"/>` +
      `</g>`
    );
  }
  // Default: layered round bush
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="0" cy="-1" rx="2.2" ry="1.6" fill="${c.bushDark}"/>` +
    `<ellipse cx="-0.4" cy="-1.5" rx="1.4" ry="1" fill="${c.bush}"/>` +
    `<ellipse cx="0.5" cy="-1.3" rx="1.2" ry="0.9" fill="${c.bush}"/>` +
    `<ellipse cx="0" cy="-1.8" rx="0.8" ry="0.5" fill="${c.leafLight}"/>` +
    `</g>`
  );
}

// Grassland assets

function svgPine(x: number, y: number, c: AssetColors, v: number): string {
  if (v === 1) {
    // Short/bushy variant with layered foliage
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="0" cy="-0.2" rx="1" ry="0.3" fill="${c.shadow}" opacity="0.15"/>` +
      `<rect x="-0.4" y="-1.8" width="0.8" height="1.8" fill="${c.trunk}"/>` +
      `<polygon points="0,-5.5 -3.2,-1.5 3.2,-1.5" fill="${c.bushDark}"/>` +
      `<polygon points="0,-5.5 -2.8,-2 2.8,-2" fill="${c.pine}"/>` +
      `<polygon points="0,-7 -2.4,-3.5 2.4,-3.5" fill="${c.bushDark}" opacity="0.9"/>` +
      `<polygon points="0,-7 -2,-4 2,-4" fill="${c.pine}"/>` +
      `<polygon points="0,-8 -1.2,-5.5 1.2,-5.5" fill="${c.leafLight}" opacity="0.8"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // Wind-bent variant with depth
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="0.5" cy="-0.2" rx="1" ry="0.3" fill="${c.shadow}" opacity="0.15"/>` +
      `<path d="M0,0 Q0.4,-1.5 0.8,-3" stroke="${c.trunk}" fill="none" stroke-width="0.7"/>` +
      `<polygon points="1,-8.5 -1.8,-3 3.8,-3" fill="${c.bushDark}"/>` +
      `<polygon points="1,-8.5 -1.4,-3.5 3.4,-3.5" fill="${c.pine}"/>` +
      `<polygon points="1.2,-10 -0.8,-6 3.2,-6" fill="${c.bushDark}" opacity="0.9"/>` +
      `<polygon points="1.2,-10 -0.4,-6.5 2.8,-6.5" fill="${c.pine}"/>` +
      `<polygon points="1.2,-10.8 0,-7.5 2.4,-7.5" fill="${c.leafLight}" opacity="0.7"/>` +
      `</g>`
    );
  }
  // Default: tall pine with layered foliage and shadow
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="0" cy="-0.2" rx="0.8" ry="0.25" fill="${c.shadow}" opacity="0.15"/>` +
    `<rect x="-0.35" y="-2.5" width="0.7" height="2.5" fill="${c.trunk}"/>` +
    `<polygon points="0,-8.5 -2.8,-2 2.8,-2" fill="${c.bushDark}"/>` +
    `<polygon points="0,-8.5 -2.4,-2.5 2.4,-2.5" fill="${c.pine}"/>` +
    `<polygon points="0,-10.5 -2,-5.5 2,-5.5" fill="${c.bushDark}" opacity="0.9"/>` +
    `<polygon points="0,-10.5 -1.6,-6 1.6,-6" fill="${c.pine}"/>` +
    `<polygon points="0,-11.5 -0.9,-8 0.9,-8" fill="${c.leafLight}" opacity="0.7"/>` +
    `</g>`
  );
}

function svgDeciduous(x: number, y: number, c: AssetColors, v: number): string {
  if (v === 1) {
    // Oval tall variant with layered canopy
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="0" cy="-0.2" rx="0.8" ry="0.25" fill="${c.shadow}" opacity="0.15"/>` +
      `<rect x="-0.35" y="-4.5" width="0.7" height="4.5" fill="${c.trunk}"/>` +
      `<line x1="-0.3" y1="-3.5" x2="-1" y2="-4.5" stroke="${c.trunk}" stroke-width="0.3"/>` +
      `<line x1="0.3" y1="-4" x2="0.8" y2="-5" stroke="${c.trunk}" stroke-width="0.25"/>` +
      `<ellipse cx="0" cy="-7.5" rx="2.3" ry="3.8" fill="${c.bushDark}"/>` +
      `<ellipse cx="-0.3" cy="-7" rx="1.8" ry="3" fill="${c.leaf}"/>` +
      `<ellipse cx="0.5" cy="-7.8" rx="1.4" ry="2.5" fill="${c.bush}" opacity="0.8"/>` +
      `<ellipse cx="-0.2" cy="-8.5" rx="1" ry="1.5" fill="${c.leafLight}" opacity="0.6"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // Multi-branch spread variant with depth
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="0" cy="-0.2" rx="1.5" ry="0.4" fill="${c.shadow}" opacity="0.15"/>` +
      `<rect x="-0.4" y="-3" width="0.8" height="3" fill="${c.trunk}"/>` +
      `<line x1="0" y1="-2.5" x2="-2" y2="-4" stroke="${c.trunk}" stroke-width="0.45"/>` +
      `<line x1="0" y1="-2.5" x2="2" y2="-4" stroke="${c.trunk}" stroke-width="0.45"/>` +
      `<circle cx="-2" cy="-5.5" r="2.3" fill="${c.bushDark}"/>` +
      `<circle cx="-2" cy="-5.5" r="2" fill="${c.leaf}"/>` +
      `<circle cx="-2.5" cy="-6" r="1.2" fill="${c.leafLight}" opacity="0.6"/>` +
      `<circle cx="2" cy="-5.5" r="2.3" fill="${c.bushDark}"/>` +
      `<circle cx="2" cy="-5.5" r="2" fill="${c.leaf}"/>` +
      `<circle cx="1.5" cy="-6" r="1.2" fill="${c.leafLight}" opacity="0.6"/>` +
      `<circle cx="0" cy="-6" r="2" fill="${c.bush}" opacity="0.8"/>` +
      `</g>`
    );
  }
  // Default: round canopy with layered depth
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="0" cy="-0.2" rx="1" ry="0.3" fill="${c.shadow}" opacity="0.15"/>` +
    `<rect x="-0.35" y="-3.5" width="0.7" height="3.5" fill="${c.trunk}"/>` +
    `<line x1="-0.2" y1="-3" x2="-1.2" y2="-4" stroke="${c.trunk}" stroke-width="0.3"/>` +
    `<line x1="0.2" y1="-2.8" x2="1" y2="-3.8" stroke="${c.trunk}" stroke-width="0.25"/>` +
    `<circle cx="0" cy="-6" r="3.2" fill="${c.bushDark}"/>` +
    `<circle cx="0" cy="-6" r="2.9" fill="${c.leaf}"/>` +
    `<circle cx="-1" cy="-5.5" r="2" fill="${c.bush}" opacity="0.75"/>` +
    `<circle cx="0.8" cy="-6.5" r="1.5" fill="${c.leafLight}" opacity="0.6"/>` +
    `</g>`
  );
}

function svgMushroom(x: number, y: number, c: AssetColors, v: number): string {
  if (v === 1) {
    // Brown cluster variant
    return (
      `<g transform="translate(${x},${y})">` +
      `<rect x="-1.2" y="-1.5" width="0.6" height="1.5" fill="${c.mushroom}"/>` +
      `<ellipse cx="-0.9" cy="-1.7" rx="1" ry="0.7" fill="${c.trunk}"/>` +
      `<rect x="0.5" y="-1.8" width="0.5" height="1.8" fill="${c.mushroom}"/>` +
      `<ellipse cx="0.75" cy="-2" rx="0.8" ry="0.6" fill="${c.trunk}"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // Tall/thin variant
    return (
      `<g transform="translate(${x},${y})">` +
      `<rect x="-0.3" y="-3" width="0.6" height="3" fill="${c.mushroom}"/>` +
      `<ellipse cx="0" cy="-3.2" rx="1" ry="0.6" fill="${c.mushroomCap}"/>` +
      `</g>`
    );
  }
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-0.4" y="-2" width="0.8" height="2" fill="${c.mushroom}"/>` +
    `<ellipse cx="0" cy="-2.2" rx="1.5" ry="1" fill="${c.mushroomCap}"/>` +
    `<circle cx="-0.5" cy="-2.5" r="0.3" fill="${c.mushroom}" opacity="0.7"/>` +
    `</g>`
  );
}

function svgStump(x: number, y: number, c: AssetColors, v: number): string {
  if (v === 1) {
    // With mushrooms variant
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="0" cy="-1.5" rx="1.5" ry="0.8" fill="${c.stump}"/>` +
      `<rect x="-1.5" y="-1.5" width="3" height="1.5" fill="${c.trunk}"/>` +
      `<ellipse cx="0" cy="-1.5" rx="1.5" ry="0.6" fill="${c.stump}" opacity="0.7"/>` +
      `<circle cx="1.2" cy="-1.2" r="0.4" fill="${c.mushroom}"/>` +
      `<circle cx="1.5" cy="-0.8" r="0.3" fill="${c.mushroom}" opacity="0.8"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // Mossy variant
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="0" cy="-1.5" rx="1.5" ry="0.8" fill="${c.stump}"/>` +
      `<rect x="-1.5" y="-1.5" width="3" height="1.5" fill="${c.trunk}"/>` +
      `<ellipse cx="0" cy="-1.5" rx="1.5" ry="0.6" fill="${c.moss}" opacity="0.6"/>` +
      `<ellipse cx="-0.5" cy="-1" rx="0.8" ry="0.3" fill="${c.moss}" opacity="0.4"/>` +
      `</g>`
    );
  }
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="0" cy="-1.5" rx="1.5" ry="0.8" fill="${c.stump}"/>` +
    `<rect x="-1.5" y="-1.5" width="3" height="1.5" fill="${c.trunk}"/>` +
    `<ellipse cx="0" cy="-1.5" rx="1.5" ry="0.6" fill="${c.stump}" opacity="0.7"/>` +
    `</g>`
  );
}

function svgDeer(x: number, y: number, c: AssetColors, v: number): string {
  if (v === 1) {
    // Grazing variant — head down
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="0" cy="-2" rx="2.2" ry="1.2" fill="${c.deer}"/>` +
      `<circle cx="-2.2" cy="-1.8" r="0.6" fill="${c.deer}"/>` +
      `<line x1="-2.5" y1="-2.4" x2="-2.8" y2="-3.2" stroke="${c.trunk}" stroke-width="0.25"/>` +
      `<line x1="-1.9" y1="-2.4" x2="-1.5" y2="-3.2" stroke="${c.trunk}" stroke-width="0.25"/>` +
      `<line x1="-1" y1="-0.8" x2="-1" y2="0" stroke="${c.deer}" stroke-width="0.4"/>` +
      `<line x1="1" y1="-0.8" x2="1" y2="0" stroke="${c.deer}" stroke-width="0.4"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // Walking variant — legs spread
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="0" cy="-2" rx="2.2" ry="1.2" fill="${c.deer}"/>` +
      `<circle cx="-2" cy="-3" r="0.7" fill="${c.deer}"/>` +
      `<line x1="-2.3" y1="-3.7" x2="-3" y2="-4.8" stroke="${c.trunk}" stroke-width="0.3"/>` +
      `<line x1="-1.7" y1="-3.7" x2="-1" y2="-4.8" stroke="${c.trunk}" stroke-width="0.3"/>` +
      `<line x1="-1.2" y1="-0.8" x2="-1.8" y2="0.3" stroke="${c.deer}" stroke-width="0.4"/>` +
      `<line x1="0.8" y1="-0.8" x2="1.5" y2="0.3" stroke="${c.deer}" stroke-width="0.4"/>` +
      `</g>`
    );
  }
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="0" cy="-2" rx="2.2" ry="1.2" fill="${c.deer}"/>` +
    `<circle cx="-2" cy="-3" r="0.7" fill="${c.deer}"/>` +
    // Antlers (key identifier)
    `<line x1="-2.3" y1="-3.7" x2="-3" y2="-5" stroke="${c.trunk}" stroke-width="0.3"/>` +
    `<line x1="-3" y1="-5" x2="-3.5" y2="-5.3" stroke="${c.trunk}" stroke-width="0.25"/>` +
    `<line x1="-1.7" y1="-3.7" x2="-1" y2="-5" stroke="${c.trunk}" stroke-width="0.3"/>` +
    `<line x1="-1" y1="-5" x2="-0.5" y2="-5.3" stroke="${c.trunk}" stroke-width="0.25"/>` +
    // Legs
    `<line x1="-1" y1="-0.8" x2="-1" y2="0" stroke="${c.deer}" stroke-width="0.4"/>` +
    `<line x1="1" y1="-0.8" x2="1" y2="0" stroke="${c.deer}" stroke-width="0.4"/>` +
    `</g>`
  );
}

// Forest assets

function svgWillow(x: number, y: number, c: AssetColors, v: number): string {
  if (v === 1) {
    // Short wide variant
    return (
      `<g transform="translate(${x},${y})">` +
      `<line x1="0" y1="0" x2="0" y2="-3" stroke="${c.trunk}" stroke-width="0.9"/>` +
      `<circle cx="0" cy="-4" r="2.5" fill="${c.willow}"/>` +
      `<path d="M-2.5,-3 Q-4,-1 -4,0" stroke="${c.willow}" fill="none" stroke-width="0.6" opacity="0.7"/>` +
      `<path d="M2.5,-3 Q4,-1 4,0" stroke="${c.willow}" fill="none" stroke-width="0.6" opacity="0.7"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // Gnarled trunk variant
    return (
      `<g transform="translate(${x},${y})">` +
      `<path d="M0,0 Q-1,-2.5 0.5,-5" stroke="${c.trunk}" fill="none" stroke-width="1"/>` +
      `<circle cx="0.5" cy="-6" r="1.8" fill="${c.willow}"/>` +
      `<path d="M-1,-5 Q-2.5,-3 -3,-1" stroke="${c.willow}" fill="none" stroke-width="0.5" opacity="0.7"/>` +
      `<path d="M2,-5 Q2.5,-3 2,-1" stroke="${c.willow}" fill="none" stroke-width="0.5" opacity="0.7"/>` +
      `</g>`
    );
  }
  return (
    `<g transform="translate(${x},${y})">` +
    `<line x1="0" y1="0" x2="0" y2="-5" stroke="${c.trunk}" stroke-width="0.8"/>` +
    `<circle cx="0" cy="-6" r="2" fill="${c.willow}"/>` +
    `<path d="M-2,-5 Q-3,-3 -3,-1" stroke="${c.willow}" fill="none" stroke-width="0.6" opacity="0.7"/>` +
    `<path d="M2,-5 Q3,-3 3,-1" stroke="${c.willow}" fill="none" stroke-width="0.6" opacity="0.7"/>` +
    `<path d="M-1,-5.5 Q-2,-3.5 -2.5,-2" stroke="${c.willow}" fill="none" stroke-width="0.4" opacity="0.5"/>` +
    `</g>`
  );
}

function svgPalm(x: number, y: number, c: AssetColors, v: number): string {
  if (v === 1) {
    // Curved trunk variant
    return (
      `<g transform="translate(${x},${y})">` +
      `<path d="M0,0 Q-2,-4 -1,-8" stroke="${c.trunk}" fill="none" stroke-width="0.7"/>` +
      `<path d="M-1,-8 Q2,-9 3,-7" stroke="${c.palm}" fill="none" stroke-width="0.8"/>` +
      `<path d="M-1,-8 Q-3,-9 -4,-7" stroke="${c.palm}" fill="none" stroke-width="0.8"/>` +
      `<path d="M-1,-8 Q1,-10 2,-9" stroke="${c.palm}" fill="none" stroke-width="0.6"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // Pair variant
    return (
      `<g transform="translate(${x},${y})">` +
      `<path d="M-1.5,0 Q-2,-3 -1,-6" stroke="${c.trunk}" fill="none" stroke-width="0.6"/>` +
      `<path d="M-1,-6 Q1,-7 2,-5.5" stroke="${c.palm}" fill="none" stroke-width="0.7"/>` +
      `<path d="M-1,-6 Q-3,-7 -3.5,-5.5" stroke="${c.palm}" fill="none" stroke-width="0.7"/>` +
      `<path d="M1.5,0 Q1,-3 2,-7" stroke="${c.trunk}" fill="none" stroke-width="0.6"/>` +
      `<path d="M2,-7 Q4,-8 4.5,-6.5" stroke="${c.palm}" fill="none" stroke-width="0.7"/>` +
      `<path d="M2,-7 Q0,-8 -0.5,-6.5" stroke="${c.palm}" fill="none" stroke-width="0.7"/>` +
      `</g>`
    );
  }
  return (
    `<g transform="translate(${x},${y})">` +
    `<path d="M0,0 Q-0.5,-4 0.5,-8" stroke="${c.trunk}" fill="none" stroke-width="0.7"/>` +
    `<path d="M0.5,-8 Q3,-9 4,-7" stroke="${c.palm}" fill="none" stroke-width="0.8"/>` +
    `<path d="M0.5,-8 Q-2,-9 -3,-7" stroke="${c.palm}" fill="none" stroke-width="0.8"/>` +
    `<path d="M0.5,-8 Q2,-10 3,-9" stroke="${c.palm}" fill="none" stroke-width="0.6"/>` +
    `<path d="M0.5,-8 Q-1,-10 -2,-9" stroke="${c.palm}" fill="none" stroke-width="0.6"/>` +
    `</g>`
  );
}

function svgBird(x: number, y: number, c: AssetColors, v: number): string {
  if (v === 1) {
    // Perched variant — sitting on invisible branch
    return (
      `<g transform="translate(${x},${y})">` +
      `<circle cx="0" cy="-4" r="0.6" fill="${c.bird}"/>` +
      `<ellipse cx="0" cy="-3.5" rx="0.5" ry="0.8" fill="${c.bird}"/>` +
      `<polygon points="-0.6,-4 -1,-3.9 -0.6,-3.8" fill="${c.wheat}"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // Pair variant — two V-shapes
    return (
      `<g transform="translate(${x},${y})">` +
      `<g>` +
      `<path d="M-1.5,-4 Q0,-5.5 1.5,-4" stroke="${c.bird}" fill="none" stroke-width="0.5"/>` +
      `<path d="M0,-5.5 Q1.5,-7 3,-5.5" stroke="${c.bird}" fill="none" stroke-width="0.4" opacity="0.7"/>` +
      `<animateTransform attributeName="transform" type="translate" values="0,0;4,-1;0,0" dur="12s" repeatCount="indefinite"/>` +
      `</g>` +
      `</g>`
    );
  }
  return (
    `<g transform="translate(${x},${y})">` +
    `<g>` +
    `<path d="M-1.5,-4 Q0,-5.5 1.5,-4" stroke="${c.bird}" fill="none" stroke-width="0.5"/>` +
    `<animateTransform attributeName="transform" type="translate" values="0,0;4,-1;0,0" dur="12s" repeatCount="indefinite"/>` +
    `</g>` +
    `</g>`
  );
}

// Farm assets

function svgWheat(x: number, y: number, c: AssetColors, v: number): string {
  if (v === 1) {
    // Ripe golden variant — denser, drooping heads
    return (
      `<g transform="translate(${x},${y})">` +
      `<line x1="-1.5" y1="0" x2="-1.5" y2="-4" stroke="${c.wheat}" stroke-width="0.35"/>` +
      `<line x1="0" y1="0" x2="0" y2="-4.5" stroke="${c.wheat}" stroke-width="0.35"/>` +
      `<line x1="1.5" y1="0" x2="1.5" y2="-3.8" stroke="${c.wheat}" stroke-width="0.35"/>` +
      `<line x1="-0.7" y1="0" x2="-0.7" y2="-4.2" stroke="${c.wheat}" stroke-width="0.25" opacity="0.7"/>` +
      `<ellipse cx="-1.5" cy="-4.3" rx="0.4" ry="0.7" fill="${c.wheat}"/>` +
      `<ellipse cx="0" cy="-4.8" rx="0.4" ry="0.7" fill="${c.wheat}"/>` +
      `<ellipse cx="1.5" cy="-4.1" rx="0.4" ry="0.7" fill="${c.wheat}"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // Harvested stubble variant — short cut stalks
    return (
      `<g transform="translate(${x},${y})">` +
      `<line x1="-2" y1="0" x2="-2" y2="-1.2" stroke="${c.wheat}" stroke-width="0.3" opacity="0.6"/>` +
      `<line x1="-0.5" y1="0" x2="-0.5" y2="-1" stroke="${c.wheat}" stroke-width="0.3" opacity="0.6"/>` +
      `<line x1="1" y1="0" x2="1" y2="-1.3" stroke="${c.wheat}" stroke-width="0.3" opacity="0.6"/>` +
      `<line x1="2.5" y1="0" x2="2.5" y2="-0.8" stroke="${c.wheat}" stroke-width="0.3" opacity="0.5"/>` +
      `</g>`
    );
  }
  return (
    `<g transform="translate(${x},${y})">` +
    `<line x1="-1.5" y1="0" x2="-1.5" y2="-4" stroke="${c.wheat}" stroke-width="0.3"/>` +
    `<line x1="0" y1="0" x2="0" y2="-4.5" stroke="${c.wheat}" stroke-width="0.3"/>` +
    `<line x1="1.5" y1="0" x2="1.5" y2="-3.8" stroke="${c.wheat}" stroke-width="0.3"/>` +
    `<circle cx="-1.5" cy="-4.2" r="0.5" fill="${c.wheat}"/>` +
    `<circle cx="0" cy="-4.8" r="0.5" fill="${c.wheat}"/>` +
    `<circle cx="1.5" cy="-4" r="0.5" fill="${c.wheat}"/>` +
    `</g>`
  );
}

function svgFence(x: number, y: number, c: AssetColors, v: number): string {
  const postCap = (px: number) =>
    `<polygon points="${px - 0.3},-3 ${px},-3.5 ${px + 0.3},-3" fill="${c.fence}"/>`;
  if (v === 1) {
    // L-corner variant with post caps
    return (
      `<g transform="translate(${x},${y})">` +
      `<line x1="-3" y1="-1.5" x2="0" y2="-1.5" stroke="${c.fence}" stroke-width="0.5"/>` +
      `<line x1="-3" y1="-2.3" x2="0" y2="-2.3" stroke="${c.fence}" stroke-width="0.4"/>` +
      `<rect x="-3.2" y="-3" width="0.5" height="3" fill="${c.fence}"/>` +
      `<rect x="-0.25" y="-3" width="0.5" height="3" fill="${c.fence}"/>` +
      postCap(-3) +
      postCap(0) +
      `<line x1="0" y1="-1.5" x2="3" y2="-1.5" stroke="${c.fence}" stroke-width="0.5"/>` +
      `<line x1="0" y1="-2.3" x2="3" y2="-2.3" stroke="${c.fence}" stroke-width="0.4"/>` +
      `<rect x="2.75" y="-3" width="0.5" height="3" fill="${c.fence}"/>` +
      postCap(3) +
      `</g>`
    );
  }
  if (v === 2) {
    // Gate variant with decorative posts
    return (
      `<g transform="translate(${x},${y})">` +
      `<line x1="-3" y1="-1.5" x2="-0.7" y2="-1.5" stroke="${c.fence}" stroke-width="0.5"/>` +
      `<line x1="0.7" y1="-1.5" x2="3" y2="-1.5" stroke="${c.fence}" stroke-width="0.5"/>` +
      `<line x1="-3" y1="-2.3" x2="-0.7" y2="-2.3" stroke="${c.fence}" stroke-width="0.4"/>` +
      `<line x1="0.7" y1="-2.3" x2="3" y2="-2.3" stroke="${c.fence}" stroke-width="0.4"/>` +
      `<rect x="-3.2" y="-3" width="0.5" height="3" fill="${c.fence}"/>` +
      `<rect x="-0.85" y="-3.5" width="0.4" height="3.5" fill="${c.fence}"/>` +
      `<rect x="0.55" y="-3.5" width="0.4" height="3.5" fill="${c.fence}"/>` +
      `<rect x="2.75" y="-3" width="0.5" height="3" fill="${c.fence}"/>` +
      postCap(-3) +
      `<circle cx="-0.65" cy="-3.7" r="0.25" fill="${c.fence}"/>` +
      `<circle cx="0.75" cy="-3.7" r="0.25" fill="${c.fence}"/>` +
      postCap(3) +
      `</g>`
    );
  }
  // Default: straight fence with posts and caps
  return (
    `<g transform="translate(${x},${y})">` +
    `<line x1="-3" y1="-1.5" x2="3" y2="-1.5" stroke="${c.fence}" stroke-width="0.5"/>` +
    `<line x1="-3" y1="-2.3" x2="3" y2="-2.3" stroke="${c.fence}" stroke-width="0.4"/>` +
    `<rect x="-3.2" y="-3" width="0.5" height="3" fill="${c.fence}"/>` +
    `<rect x="-0.25" y="-3" width="0.5" height="3" fill="${c.fence}"/>` +
    `<rect x="2.75" y="-3" width="0.5" height="3" fill="${c.fence}"/>` +
    postCap(-3) +
    postCap(0) +
    postCap(3) +
    `</g>`
  );
}

function svgScarecrow(x: number, y: number, c: AssetColors, v: number): string {
  if (v === 1) {
    // With crow variant
    return (
      `<g transform="translate(${x},${y})">` +
      `<line x1="0" y1="0" x2="0" y2="-6" stroke="${c.scarecrow}" stroke-width="0.5"/>` +
      `<line x1="-2.5" y1="-4" x2="2.5" y2="-4" stroke="${c.scarecrow}" stroke-width="0.4"/>` +
      `<circle cx="0" cy="-7" r="1" fill="${c.scarecrowHat}"/>` +
      `<rect x="-1.5" y="-8.2" width="3" height="0.8" fill="${c.scarecrowHat}" rx="0.2"/>` +
      `<path d="M2,-4.5 Q2.5,-5.5 3,-4.5" stroke="${c.bird}" fill="${c.bird}" stroke-width="0.3"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // Tattered variant — tilted, ragged
    return (
      `<g transform="translate(${x},${y})">` +
      `<line x1="0" y1="0" x2="0.3" y2="-5.5" stroke="${c.scarecrow}" stroke-width="0.5"/>` +
      `<line x1="-2" y1="-3.5" x2="2.5" y2="-4.2" stroke="${c.scarecrow}" stroke-width="0.4"/>` +
      `<circle cx="0.3" cy="-6.5" r="0.9" fill="${c.scarecrowHat}"/>` +
      `<rect x="-1" y="-7.6" width="2.8" height="0.7" fill="${c.scarecrowHat}" rx="0.2" transform="rotate(-8 0.3 -7)"/>` +
      `<path d="M-2,-3.5 L-2.5,-2.5" stroke="${c.scarecrow}" stroke-width="0.3" opacity="0.5"/>` +
      `</g>`
    );
  }
  return (
    `<g transform="translate(${x},${y})">` +
    `<line x1="0" y1="0" x2="0" y2="-6" stroke="${c.scarecrow}" stroke-width="0.5"/>` +
    `<line x1="-2.5" y1="-4" x2="2.5" y2="-4" stroke="${c.scarecrow}" stroke-width="0.4"/>` +
    `<circle cx="0" cy="-7" r="1" fill="${c.scarecrowHat}"/>` +
    `<rect x="-1.5" y="-8.2" width="3" height="0.8" fill="${c.scarecrowHat}" rx="0.2"/>` +
    `</g>`
  );
}

function svgBarn(x: number, y: number, c: AssetColors, v: number): string {
  if (v === 1) {
    // Large red barn variant
    return (
      `<g transform="translate(${x},${y})">` +
      `<polygon points="-4,0 0,2 4,0 4,-4.5 0,-2.5 -4,-4.5" fill="${c.roofA}" opacity="0.9"/>` +
      `<polygon points="-4,0 0,2 0,-2.5 -4,-4.5" fill="${c.wallShade}"/>` +
      `<polygon points="0,-7.5 -4.5,-4 0,-2.2 4.5,-4" fill="${c.roofA}"/>` +
      `<rect x="-0.5" y="-1.5" width="1" height="1.5" fill="${c.trunk}" opacity="0.5"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // Small shed variant
    return (
      `<g transform="translate(${x},${y})">` +
      `<rect x="-2" y="-2.5" width="4" height="2.5" fill="${c.wallShade}"/>` +
      `<polygon points="-2.5,-2.5 0,-4 2.5,-2.5" fill="${c.roofB}"/>` +
      `</g>`
    );
  }
  return (
    `<g transform="translate(${x},${y})">` +
    `<polygon points="-3,0 0,1.5 3,0 3,-3.5 0,-2 -3,-3.5" fill="${c.roofA}" opacity="0.8"/>` +
    `<polygon points="-3,0 0,1.5 0,-2 -3,-3.5" fill="${c.wallShade}"/>` +
    `<polygon points="0,-6 -3.5,-3.2 0,-1.8 3.5,-3.2" fill="${c.roofA}"/>` +
    `</g>`
  );
}

function svgSheep(x: number, y: number, c: AssetColors, v: number): string {
  // Fluffy sheep with clear wool body and dark face/legs
  if (v === 1) {
    // Grazing variant
    return (
      `<g transform="translate(${x},${y})">` +
      // Shadow
      `<ellipse cx="0" cy="-0.2" rx="2" ry="0.5" fill="${c.shadow}" opacity="0.15"/>` +
      // Wool body (fluffy cloud shape)
      `<ellipse cx="0" cy="-2" rx="2.2" ry="1.4" fill="${c.sheep}"/>` +
      `<circle cx="-1.3" cy="-2.3" r="1" fill="${c.sheep}"/>` +
      `<circle cx="1.3" cy="-2.3" r="1" fill="${c.sheep}"/>` +
      `<circle cx="0" cy="-2.8" r="0.9" fill="${c.sheep}"/>` +
      // Dark face (bent down grazing)
      `<ellipse cx="-1.8" cy="-1.2" rx="0.7" ry="0.5" fill="${c.sheepHead}"/>` +
      // Ears
      `<ellipse cx="-1.3" cy="-1.8" rx="0.25" ry="0.4" fill="${c.sheepHead}"/>` +
      // Legs (dark, sturdy)
      `<rect x="-1.1" y="-0.8" width="0.5" height="1" fill="${c.sheepHead}"/>` +
      `<rect x="0.6" y="-0.8" width="0.5" height="1" fill="${c.sheepHead}"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // Lying down
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="0" cy="-1" rx="2.5" ry="1" fill="${c.sheep}"/>` +
      `<circle cx="-1.5" cy="-1.3" r="0.8" fill="${c.sheep}"/>` +
      `<circle cx="1.2" cy="-1.2" r="0.7" fill="${c.sheep}"/>` +
      `<circle cx="-2.2" cy="-1.5" r="0.6" fill="${c.sheepHead}"/>` +
      `<circle cx="-2.4" cy="-1.6" r="0.1" fill="#222"/>` +
      `</g>`
    );
  }
  // Standing sheep - clear profile
  return (
    `<g transform="translate(${x},${y})">` +
    // Shadow
    `<ellipse cx="0" cy="-0.2" rx="1.8" ry="0.4" fill="${c.shadow}" opacity="0.15"/>` +
    // Wool body
    `<ellipse cx="0" cy="-2.2" rx="2" ry="1.3" fill="${c.sheep}"/>` +
    `<circle cx="-1.2" cy="-2.5" r="0.9" fill="${c.sheep}"/>` +
    `<circle cx="1" cy="-2.4" r="0.85" fill="${c.sheep}"/>` +
    `<circle cx="0" cy="-3" r="0.8" fill="${c.sheep}"/>` +
    // Dark head
    `<ellipse cx="-2" cy="-2.8" rx="0.7" ry="0.55" fill="${c.sheepHead}"/>` +
    // Eye
    `<circle cx="-2.1" cy="-2.9" r="0.12" fill="#222"/>` +
    // Ears
    `<ellipse cx="-1.5" cy="-3.3" rx="0.2" ry="0.35" fill="${c.sheepHead}" transform="rotate(-15 -1.5 -3.3)"/>` +
    // Four dark legs
    `<rect x="-1.2" y="-1" width="0.45" height="1.2" fill="${c.sheepHead}"/>` +
    `<rect x="-0.4" y="-1" width="0.45" height="1.2" fill="${c.sheepHead}"/>` +
    `<rect x="0.4" y="-1" width="0.45" height="1.2" fill="${c.sheepHead}"/>` +
    `<rect x="1" y="-1" width="0.45" height="1.2" fill="${c.sheepHead}"/>` +
    `</g>`
  );
}

function svgCow(x: number, y: number, c: AssetColors, v: number): string {
  // Large cow with distinct body, spots, head with horns, and 4 legs
  if (v === 1) {
    // Right-facing grazing
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="0" cy="-0.2" rx="2.5" ry="0.5" fill="${c.shadow}" opacity="0.15"/>` +
      // Body
      `<ellipse cx="0" cy="-2.2" rx="2.8" ry="1.6" fill="${c.cow}"/>` +
      // Spots
      `<ellipse cx="-0.5" cy="-2.5" rx="0.9" ry="0.7" fill="${c.cowSpot}"/>` +
      `<ellipse cx="1" cy="-1.8" rx="0.7" ry="0.5" fill="${c.cowSpot}"/>` +
      // Head (facing right, down)
      `<ellipse cx="2.5" cy="-1.5" rx="0.9" ry="0.7" fill="${c.cow}"/>` +
      `<ellipse cx="3" cy="-1.3" rx="0.5" ry="0.4" fill="${c.cowSpot}" opacity="0.6"/>` +
      // Horns
      `<line x1="2.2" y1="-2.1" x2="1.8" y2="-2.8" stroke="${c.fence}" stroke-width="0.3"/>` +
      `<line x1="2.8" y1="-2.1" x2="3.2" y2="-2.7" stroke="${c.fence}" stroke-width="0.3"/>` +
      // Eye
      `<circle cx="2.8" cy="-1.6" r="0.12" fill="#222"/>` +
      // Legs
      `<rect x="-1.5" y="-0.8" width="0.5" height="1" fill="${c.cow}"/>` +
      `<rect x="-0.5" y="-0.8" width="0.5" height="1" fill="${c.cow}"/>` +
      `<rect x="0.5" y="-0.8" width="0.5" height="1" fill="${c.cow}"/>` +
      `<rect x="1.3" y="-0.8" width="0.5" height="1" fill="${c.cow}"/>` +
      // Tail
      `<path d="M-2.8,-2.5 Q-3.5,-2 -3.2,-1" stroke="${c.cowSpot}" fill="none" stroke-width="0.25"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // Side profile
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="0" cy="-0.2" rx="2.5" ry="0.5" fill="${c.shadow}" opacity="0.15"/>` +
      // Body
      `<ellipse cx="0" cy="-2.2" rx="2.8" ry="1.6" fill="${c.cow}"/>` +
      // Large spot
      `<ellipse cx="0.3" cy="-2.3" rx="1.2" ry="0.9" fill="${c.cowSpot}"/>` +
      // Head
      `<ellipse cx="-2.5" cy="-2.8" rx="0.9" ry="0.7" fill="${c.cow}"/>` +
      // Muzzle
      `<ellipse cx="-3.2" cy="-2.6" rx="0.5" ry="0.4" fill="${c.cowSpot}" opacity="0.5"/>` +
      // Horns
      `<line x1="-2.8" y1="-3.4" x2="-3.2" y2="-4" stroke="${c.fence}" stroke-width="0.3"/>` +
      `<line x1="-2.2" y1="-3.4" x2="-1.8" y2="-4" stroke="${c.fence}" stroke-width="0.3"/>` +
      // Eye
      `<circle cx="-2.3" cy="-3" r="0.12" fill="#222"/>` +
      // Legs
      `<rect x="-1.3" y="-0.8" width="0.5" height="1" fill="${c.cow}"/>` +
      `<rect x="-0.3" y="-0.8" width="0.5" height="1" fill="${c.cow}"/>` +
      `<rect x="0.7" y="-0.8" width="0.5" height="1" fill="${c.cow}"/>` +
      `<rect x="1.5" y="-0.8" width="0.5" height="1" fill="${c.cow}"/>` +
      `</g>`
    );
  }
  // Default: classic left-facing cow
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="0" cy="-0.2" rx="2.5" ry="0.5" fill="${c.shadow}" opacity="0.15"/>` +
    // Body
    `<ellipse cx="0" cy="-2.2" rx="2.8" ry="1.6" fill="${c.cow}"/>` +
    // Spots
    `<ellipse cx="0.8" cy="-2.5" rx="1" ry="0.7" fill="${c.cowSpot}"/>` +
    `<ellipse cx="-0.8" cy="-1.7" rx="0.6" ry="0.5" fill="${c.cowSpot}"/>` +
    // Head
    `<ellipse cx="-2.5" cy="-2.8" rx="0.9" ry="0.7" fill="${c.cow}"/>` +
    `<ellipse cx="-3" cy="-2.6" rx="0.45" ry="0.35" fill="${c.cowSpot}" opacity="0.5"/>` +
    // Horns
    `<line x1="-2.8" y1="-3.4" x2="-3.3" y2="-4" stroke="${c.fence}" stroke-width="0.3"/>` +
    `<line x1="-2.2" y1="-3.4" x2="-1.7" y2="-4" stroke="${c.fence}" stroke-width="0.3"/>` +
    // Ear
    `<ellipse cx="-2" cy="-3.3" rx="0.25" ry="0.4" fill="${c.cow}"/>` +
    // Eye
    `<circle cx="-2.4" cy="-3" r="0.12" fill="#222"/>` +
    // Udder hint
    `<ellipse cx="0.5" cy="-0.9" rx="0.6" ry="0.3" fill="${c.cowSpot}" opacity="0.4"/>` +
    // Four legs
    `<rect x="-1.5" y="-0.8" width="0.55" height="1" fill="${c.cow}"/>` +
    `<rect x="-0.5" y="-0.8" width="0.55" height="1" fill="${c.cow}"/>` +
    `<rect x="0.5" y="-0.8" width="0.55" height="1" fill="${c.cow}"/>` +
    `<rect x="1.4" y="-0.8" width="0.55" height="1" fill="${c.cow}"/>` +
    // Tail
    `<path d="M2.8,-2.5 Q3.5,-2 3.2,-1" stroke="${c.cowSpot}" fill="none" stroke-width="0.3"/>` +
    `<ellipse cx="3.2" cy="-0.9" rx="0.3" ry="0.2" fill="${c.cowSpot}"/>` +
    `</g>`
  );
}

function svgChicken(x: number, y: number, c: AssetColors, v: number): string {
  // Recognizable chicken with red comb, round body, and yellow beak/legs
  if (v === 1) {
    // Pecking (head down)
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="0" cy="-0.1" rx="1" ry="0.25" fill="${c.shadow}" opacity="0.1"/>` +
      // Body
      `<ellipse cx="0" cy="-1.3" rx="1.3" ry="1" fill="${c.chicken}"/>` +
      // Tail feathers
      `<path d="M1.2,-1.5 Q2,-2 1.8,-2.8 Q1.5,-2.5 1.3,-1.8" fill="${c.chicken}"/>` +
      // Wing
      `<ellipse cx="0.2" cy="-1.4" rx="0.7" ry="0.5" fill="${c.trunk}" opacity="0.3"/>` +
      // Head (down, pecking)
      `<circle cx="-1.2" cy="-0.8" r="0.55" fill="${c.chicken}"/>` +
      // Red comb
      `<path d="M-1.2,-1.3 Q-1,-1.7 -0.9,-1.3 Q-0.7,-1.6 -0.6,-1.2" fill="${c.flag}"/>` +
      // Eye
      `<circle cx="-1.1" cy="-0.85" r="0.1" fill="#222"/>` +
      // Beak
      `<polygon points="-1.5,-0.7 -1.9,-0.6 -1.5,-0.5" fill="${c.wheat}"/>` +
      // Wattle
      `<ellipse cx="-1.3" cy="-0.5" rx="0.12" ry="0.2" fill="${c.flag}"/>` +
      // Legs
      `<line x1="-0.3" y1="-0.3" x2="-0.4" y2="0.3" stroke="${c.wheat}" stroke-width="0.2"/>` +
      `<line x1="0.4" y1="-0.3" x2="0.5" y2="0.3" stroke="${c.wheat}" stroke-width="0.2"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // With chicks
    return (
      `<g transform="translate(${x},${y})">` +
      // Mother hen
      `<ellipse cx="0" cy="-1.5" rx="1.4" ry="1.1" fill="${c.chicken}"/>` +
      `<path d="M1.3,-1.8 Q2,-2.5 1.8,-3.2" fill="${c.chicken}"/>` +
      `<circle cx="-1.2" cy="-2.2" r="0.6" fill="${c.chicken}"/>` +
      `<path d="M-1.2,-2.8 Q-1,-3.2 -0.85,-2.8 Q-0.7,-3.1 -0.6,-2.7" fill="${c.flag}"/>` +
      `<circle cx="-1" cy="-2.25" r="0.1" fill="#222"/>` +
      `<polygon points="-1.7,-2.1 -2.1,-2 -1.7,-1.9" fill="${c.wheat}"/>` +
      // Chicks (small yellow balls)
      `<circle cx="2.2" cy="-0.5" r="0.4" fill="${c.wheat}"/>` +
      `<circle cx="2.4" cy="-0.55" r="0.08" fill="#222"/>` +
      `<polygon points="2.5,-0.5 2.7,-0.45 2.5,-0.4" fill="${c.flag}" opacity="0.8"/>` +
      `<circle cx="3" cy="-0.6" r="0.35" fill="${c.wheat}"/>` +
      `<circle cx="3.15" cy="-0.65" r="0.07" fill="#222"/>` +
      `</g>`
    );
  }
  // Default: standing chicken
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="0" cy="-0.1" rx="1" ry="0.25" fill="${c.shadow}" opacity="0.1"/>` +
    // Body
    `<ellipse cx="0" cy="-1.5" rx="1.3" ry="1.1" fill="${c.chicken}"/>` +
    // Tail feathers (upward curve)
    `<path d="M1.2,-1.8 Q1.8,-2.5 1.6,-3.3 Q1.3,-2.8 1.1,-2" fill="${c.chicken}"/>` +
    // Wing detail
    `<ellipse cx="0.3" cy="-1.6" rx="0.6" ry="0.45" fill="${c.trunk}" opacity="0.25"/>` +
    // Head
    `<circle cx="-1" cy="-2.4" r="0.65" fill="${c.chicken}"/>` +
    // Red comb (distinctive)
    `<path d="M-1,-3.1 Q-0.8,-3.5 -0.7,-3 Q-0.5,-3.4 -0.4,-2.9 Q-0.2,-3.2 -0.1,-2.8" fill="${c.flag}"/>` +
    // Eye
    `<circle cx="-0.85" cy="-2.45" r="0.12" fill="#222"/>` +
    // Beak (yellow triangle)
    `<polygon points="-1.6,-2.3 -2,-2.2 -1.6,-2.1" fill="${c.wheat}"/>` +
    // Wattle (red)
    `<ellipse cx="-1.15" cy="-2" rx="0.15" ry="0.25" fill="${c.flag}"/>` +
    // Legs (yellow)
    `<line x1="-0.4" y1="-0.4" x2="-0.5" y2="0.3" stroke="${c.wheat}" stroke-width="0.25"/>` +
    `<line x1="0.4" y1="-0.4" x2="0.5" y2="0.3" stroke="${c.wheat}" stroke-width="0.25"/>` +
    // Feet
    `<path d="M-0.7,0.3 L-0.5,0.3 L-0.3,0.3" stroke="${c.wheat}" stroke-width="0.15" fill="none"/>` +
    `<path d="M0.3,0.3 L0.5,0.3 L0.7,0.3" stroke="${c.wheat}" stroke-width="0.15" fill="none"/>` +
    `</g>`
  );
}

function svgHorse(x: number, y: number, c: AssetColors, v: number): string {
  // Elegant horse with distinct neck, mane, and four legs
  if (v === 1) {
    // Galloping variant
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="0" cy="-0.2" rx="2.5" ry="0.5" fill="${c.shadow}" opacity="0.15"/>` +
      // Body
      `<ellipse cx="0" cy="-2.5" rx="2.5" ry="1.4" fill="${c.horse}"/>` +
      // Neck (arched)
      `<path d="M-2,-2.5 Q-2.5,-3.5 -2.2,-4.5 Q-2,-5 -1.5,-5.5" fill="${c.horse}" stroke="${c.horse}" stroke-width="1.2"/>` +
      // Head
      `<ellipse cx="-1.2" cy="-5.8" rx="0.9" ry="0.5" fill="${c.horse}"/>` +
      // Mane
      `<path d="M-2,-3.5 Q-2.5,-4 -2.3,-4.5 Q-2,-5 -1.5,-5.3" stroke="${c.trunk}" fill="none" stroke-width="0.5"/>` +
      // Ear
      `<polygon points="-1.4,-6.3 -1.2,-6.8 -1,-6.3" fill="${c.horse}"/>` +
      // Eye
      `<circle cx="-1" cy="-5.8" r="0.12" fill="#222"/>` +
      // Front legs (extended)
      `<rect x="-1.5" y="-1.3" width="0.5" height="1.8" fill="${c.horse}" transform="rotate(-20 -1.5 -1.3)"/>` +
      `<rect x="-0.5" y="-1.3" width="0.5" height="1.5" fill="${c.horse}" transform="rotate(15 -0.5 -1.3)"/>` +
      // Back legs
      `<rect x="1" y="-1.3" width="0.5" height="1.5" fill="${c.horse}"/>` +
      `<rect x="1.8" y="-1.3" width="0.5" height="1.8" fill="${c.horse}" transform="rotate(-10 1.8 -1.3)"/>` +
      // Tail
      `<path d="M2.5,-2.8 Q3.5,-2.5 3.8,-1.5 Q4,-0.5 3.5,0" stroke="${c.trunk}" fill="none" stroke-width="0.5"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // Rearing
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="0.5" cy="-0.2" rx="1.5" ry="0.4" fill="${c.shadow}" opacity="0.15"/>` +
      // Body (tilted)
      `<ellipse cx="0" cy="-3" rx="2.2" ry="1.3" fill="${c.horse}" transform="rotate(-25 0 -3)"/>` +
      // Neck
      `<path d="M-1.5,-3.5 Q-2,-5 -1.5,-6" fill="${c.horse}" stroke="${c.horse}" stroke-width="1.1"/>` +
      // Head
      `<ellipse cx="-1.2" cy="-6.5" rx="0.85" ry="0.5" fill="${c.horse}"/>` +
      // Mane
      `<path d="M-1.8,-4.5 Q-2.3,-5 -2,-5.8" stroke="${c.trunk}" fill="none" stroke-width="0.5"/>` +
      // Ear
      `<polygon points="-1.4,-7 -1.2,-7.5 -1,-7" fill="${c.horse}"/>` +
      // Front legs (raised)
      `<rect x="-1.2" y="-2.5" width="0.45" height="1.8" fill="${c.horse}" transform="rotate(-60 -1.2 -2.5)"/>` +
      `<rect x="-0.3" y="-2.5" width="0.45" height="1.6" fill="${c.horse}" transform="rotate(-45 -0.3 -2.5)"/>` +
      // Back legs
      `<rect x="0.8" y="-1.5" width="0.5" height="1.7" fill="${c.horse}"/>` +
      `<rect x="1.5" y="-1.5" width="0.5" height="1.7" fill="${c.horse}"/>` +
      `</g>`
    );
  }
  // Default: standing horse profile
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="0" cy="-0.2" rx="2.2" ry="0.5" fill="${c.shadow}" opacity="0.15"/>` +
    // Body
    `<ellipse cx="0" cy="-2.5" rx="2.5" ry="1.4" fill="${c.horse}"/>` +
    // Neck
    `<path d="M-2,-2.8 Q-2.3,-4 -2,-5" fill="${c.horse}" stroke="${c.horse}" stroke-width="1.2"/>` +
    // Head
    `<ellipse cx="-1.6" cy="-5.5" rx="1" ry="0.55" fill="${c.horse}"/>` +
    // Muzzle
    `<ellipse cx="-2.4" cy="-5.3" rx="0.4" ry="0.3" fill="${c.horse}"/>` +
    // Mane
    `<path d="M-1.8,-3.5 Q-2.5,-4 -2.2,-4.8 Q-2,-5.3 -1.5,-5.5" stroke="${c.trunk}" fill="none" stroke-width="0.6"/>` +
    // Ears
    `<polygon points="-1.8,-6 -1.6,-6.5 -1.4,-6" fill="${c.horse}"/>` +
    `<polygon points="-1.3,-6 -1.1,-6.4 -0.9,-6" fill="${c.horse}"/>` +
    // Eye
    `<circle cx="-1.4" cy="-5.5" r="0.12" fill="#222"/>` +
    // Nostril
    `<circle cx="-2.5" cy="-5.2" r="0.08" fill="#333"/>` +
    // Four legs
    `<rect x="-1.4" y="-1.2" width="0.5" height="1.4" fill="${c.horse}"/>` +
    `<rect x="-0.5" y="-1.2" width="0.5" height="1.4" fill="${c.horse}"/>` +
    `<rect x="0.6" y="-1.2" width="0.5" height="1.4" fill="${c.horse}"/>` +
    `<rect x="1.5" y="-1.2" width="0.5" height="1.4" fill="${c.horse}"/>` +
    // Hooves
    `<rect x="-1.45" y="0" width="0.55" height="0.25" fill="${c.trunk}"/>` +
    `<rect x="-0.55" y="0" width="0.55" height="0.25" fill="${c.trunk}"/>` +
    `<rect x="0.55" y="0" width="0.55" height="0.25" fill="${c.trunk}"/>` +
    `<rect x="1.45" y="0" width="0.55" height="0.25" fill="${c.trunk}"/>` +
    // Tail
    `<path d="M2.5,-2.8 Q3.2,-2.5 3,-1.5 Q2.8,-0.5 3.2,0" stroke="${c.trunk}" fill="none" stroke-width="0.6"/>` +
    `</g>`
  );
}

function svgDonkey(x: number, y: number, c: AssetColors, v: number): string {
  // Donkey - smaller than horse, gray, distinctive long ears
  /* v8 ignore start */
  const body = c.donkey || '#808080';
  /* v8 ignore stop */
  const dark = '#505050';
  const muzzle = '#a0a0a0';
  if (v === 1) {
    // Walking
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="0" cy="-0.2" rx="2" ry="0.4" fill="${c.shadow}" opacity="0.15"/>` +
      // Body
      `<ellipse cx="0" cy="-2" rx="2.2" ry="1.2" fill="${body}"/>` +
      // Neck
      `<path d="M-1.5,-2.2 Q-2,-3.2 -1.6,-4" fill="${body}" stroke="${body}" stroke-width="0.9"/>` +
      // Head
      `<ellipse cx="-1.3" cy="-4.3" rx="0.85" ry="0.5" fill="${body}"/>` +
      // Muzzle (lighter)
      `<ellipse cx="-2" cy="-4.1" rx="0.4" ry="0.3" fill="${muzzle}"/>` +
      // Long ears (distinctive!)
      `<ellipse cx="-1.6" cy="-5.2" rx="0.2" ry="0.6" fill="${body}"/>` +
      `<ellipse cx="-1" cy="-5.1" rx="0.2" ry="0.55" fill="${body}"/>` +
      // Eye
      `<circle cx="-1.2" cy="-4.4" r="0.1" fill="#222"/>` +
      // Legs
      `<rect x="-1.2" y="-0.9" width="0.45" height="1.2" fill="${body}"/>` +
      `<rect x="-0.3" y="-0.9" width="0.45" height="1.1" fill="${body}"/>` +
      `<rect x="0.5" y="-0.9" width="0.45" height="1.1" fill="${body}"/>` +
      `<rect x="1.2" y="-0.9" width="0.45" height="1.2" fill="${body}"/>` +
      // Hooves
      `<rect x="-1.25" y="0.1" width="0.5" height="0.2" fill="${dark}"/>` +
      `<rect x="1.15" y="0.1" width="0.5" height="0.2" fill="${dark}"/>` +
      // Tail
      `<path d="M2.2,-2.2 Q2.8,-2 2.5,-1" stroke="${dark}" fill="none" stroke-width="0.35"/>` +
      `</g>`
    );
  }
  // Default: standing
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="0" cy="-0.2" rx="2" ry="0.4" fill="${c.shadow}" opacity="0.15"/>` +
    // Body
    `<ellipse cx="0" cy="-2" rx="2.2" ry="1.2" fill="${body}"/>` +
    // Dark stripe on back
    `<line x1="-1" y1="-2.8" x2="1.5" y2="-2.8" stroke="${dark}" stroke-width="0.3"/>` +
    // Neck
    `<path d="M-1.5,-2.2 Q-2,-3.2 -1.6,-4" fill="${body}" stroke="${body}" stroke-width="0.9"/>` +
    // Head
    `<ellipse cx="-1.3" cy="-4.3" rx="0.85" ry="0.5" fill="${body}"/>` +
    // Muzzle (lighter)
    `<ellipse cx="-2" cy="-4.1" rx="0.4" ry="0.3" fill="${muzzle}"/>` +
    // Long ears (key feature!)
    `<ellipse cx="-1.6" cy="-5.2" rx="0.2" ry="0.65" fill="${body}"/>` +
    `<ellipse cx="-1.6" cy="-5.2" rx="0.12" ry="0.5" fill="${muzzle}" opacity="0.5"/>` +
    `<ellipse cx="-1" cy="-5.1" rx="0.2" ry="0.6" fill="${body}"/>` +
    `<ellipse cx="-1" cy="-5.1" rx="0.12" ry="0.45" fill="${muzzle}" opacity="0.5"/>` +
    // Eye
    `<circle cx="-1.2" cy="-4.4" r="0.1" fill="#222"/>` +
    // Nostril
    `<circle cx="-2.1" cy="-4" r="0.06" fill="#333"/>` +
    // Four legs
    `<rect x="-1.2" y="-0.9" width="0.45" height="1.1" fill="${body}"/>` +
    `<rect x="-0.3" y="-0.9" width="0.45" height="1.1" fill="${body}"/>` +
    `<rect x="0.5" y="-0.9" width="0.45" height="1.1" fill="${body}"/>` +
    `<rect x="1.2" y="-0.9" width="0.45" height="1.1" fill="${body}"/>` +
    // Hooves
    `<rect x="-1.25" y="0" width="0.5" height="0.2" fill="${dark}"/>` +
    `<rect x="-0.35" y="0" width="0.5" height="0.2" fill="${dark}"/>` +
    `<rect x="0.45" y="0" width="0.5" height="0.2" fill="${dark}"/>` +
    `<rect x="1.15" y="0" width="0.5" height="0.2" fill="${dark}"/>` +
    // Tail with tuft
    `<path d="M2.2,-2.2 Q2.8,-2 2.5,-1" stroke="${dark}" fill="none" stroke-width="0.35"/>` +
    `<ellipse cx="2.5" cy="-0.9" rx="0.25" ry="0.2" fill="${dark}"/>` +
    `</g>`
  );
}

function svgGoat(x: number, y: number, c: AssetColors, v: number): string {
  // Goat - white/gray/brown, curved horns, beard
  /* v8 ignore start */
  const body = c.goat || '#e8e0d0';
  const horn = c.goatHorn || '#b0a090';
  /* v8 ignore stop */
  const dark = '#8a7a60';
  if (v === 1) {
    // Grazing (head down)
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="0" cy="-0.2" rx="1.5" ry="0.35" fill="${c.shadow}" opacity="0.15"/>` +
      // Body
      `<ellipse cx="0" cy="-1.8" rx="2" ry="1.1" fill="${body}"/>` +
      // Head (down)
      `<ellipse cx="-2" cy="-1.2" rx="0.65" ry="0.5" fill="${body}"/>` +
      // Curved horns
      `<path d="M-2.3,-1.5 Q-2.8,-2.2 -2.5,-2.8" stroke="${horn}" fill="none" stroke-width="0.25"/>` +
      `<path d="M-1.8,-1.5 Q-1.3,-2.2 -1.6,-2.6" stroke="${horn}" fill="none" stroke-width="0.25"/>` +
      // Beard
      `<path d="M-2.4,-1 Q-2.6,-0.5 -2.4,-0.2" stroke="${dark}" fill="none" stroke-width="0.2"/>` +
      // Eye
      `<circle cx="-1.9" cy="-1.3" r="0.08" fill="#222"/>` +
      // Legs
      `<rect x="-0.8" y="-0.8" width="0.4" height="1" fill="${body}"/>` +
      `<rect x="0.5" y="-0.8" width="0.4" height="1" fill="${body}"/>` +
      // Short tail
      `<ellipse cx="2" cy="-2" rx="0.3" ry="0.2" fill="${body}"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // Brown variant
    const brownBody = '#c0a880';
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="0" cy="-0.2" rx="1.5" ry="0.35" fill="${c.shadow}" opacity="0.15"/>` +
      // Body
      `<ellipse cx="0" cy="-1.8" rx="2" ry="1.1" fill="${brownBody}"/>` +
      // Neck
      `<path d="M-1.5,-2 Q-1.8,-2.8 -1.5,-3.2" fill="${brownBody}" stroke="${brownBody}" stroke-width="0.6"/>` +
      // Head
      `<ellipse cx="-1.3" cy="-3.5" rx="0.6" ry="0.45" fill="${brownBody}"/>` +
      // Curved horns
      `<path d="M-1.6,-3.8 Q-2,-4.5 -1.7,-5" stroke="${horn}" fill="none" stroke-width="0.25"/>` +
      `<path d="M-1.1,-3.8 Q-0.7,-4.5 -1,-4.9" stroke="${horn}" fill="none" stroke-width="0.25"/>` +
      // Ears
      `<ellipse cx="-0.85" cy="-3.6" rx="0.3" ry="0.15" fill="${brownBody}" transform="rotate(20 -0.85 -3.6)"/>` +
      // Beard
      `<path d="M-1.6,-3.3 Q-1.8,-2.8 -1.6,-2.4" stroke="${dark}" fill="none" stroke-width="0.2"/>` +
      // Eye
      `<circle cx="-1.15" cy="-3.55" r="0.08" fill="#222"/>` +
      // Legs
      `<rect x="-1" y="-0.8" width="0.4" height="1" fill="${brownBody}"/>` +
      `<rect x="-0.2" y="-0.8" width="0.4" height="1" fill="${brownBody}"/>` +
      `<rect x="0.5" y="-0.8" width="0.4" height="1" fill="${brownBody}"/>` +
      `<rect x="1.1" y="-0.8" width="0.4" height="1" fill="${brownBody}"/>` +
      `</g>`
    );
  }
  // Default: standing white goat
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="0" cy="-0.2" rx="1.5" ry="0.35" fill="${c.shadow}" opacity="0.15"/>` +
    // Body
    `<ellipse cx="0" cy="-1.8" rx="2" ry="1.1" fill="${body}"/>` +
    // Neck
    `<path d="M-1.5,-2 Q-1.8,-2.8 -1.5,-3.2" fill="${body}" stroke="${body}" stroke-width="0.6"/>` +
    // Head
    `<ellipse cx="-1.3" cy="-3.5" rx="0.6" ry="0.45" fill="${body}"/>` +
    // Curved horns (key feature!)
    `<path d="M-1.6,-3.8 Q-2,-4.5 -1.7,-5" stroke="${horn}" fill="none" stroke-width="0.25"/>` +
    `<path d="M-1.1,-3.8 Q-0.7,-4.5 -1,-4.9" stroke="${horn}" fill="none" stroke-width="0.25"/>` +
    // Ears (horizontal)
    `<ellipse cx="-0.85" cy="-3.6" rx="0.3" ry="0.15" fill="${body}" transform="rotate(20 -0.85 -3.6)"/>` +
    // Beard (distinctive!)
    `<path d="M-1.6,-3.3 Q-1.9,-2.8 -1.7,-2.3" stroke="${dark}" fill="none" stroke-width="0.2"/>` +
    `<path d="M-1.5,-3.2 Q-1.7,-2.7 -1.5,-2.2" stroke="${dark}" fill="none" stroke-width="0.15"/>` +
    // Eye (horizontal pupil)
    `<ellipse cx="-1.15" cy="-3.55" rx="0.1" ry="0.06" fill="#222"/>` +
    // Muzzle
    `<ellipse cx="-1.7" cy="-3.35" rx="0.25" ry="0.18" fill="${horn}" opacity="0.5"/>` +
    // Four legs
    `<rect x="-1" y="-0.8" width="0.4" height="1" fill="${body}"/>` +
    `<rect x="-0.2" y="-0.8" width="0.4" height="1" fill="${body}"/>` +
    `<rect x="0.5" y="-0.8" width="0.4" height="1" fill="${body}"/>` +
    `<rect x="1.1" y="-0.8" width="0.4" height="1" fill="${body}"/>` +
    // Hooves
    `<rect x="-1.05" y="0" width="0.45" height="0.2" fill="${dark}"/>` +
    `<rect x="-0.25" y="0" width="0.45" height="0.2" fill="${dark}"/>` +
    `<rect x="0.45" y="0" width="0.45" height="0.2" fill="${dark}"/>` +
    `<rect x="1.05" y="0" width="0.45" height="0.2" fill="${dark}"/>` +
    // Short upright tail
    `<path d="M2,-2 Q2.3,-2.3 2.2,-2.6" stroke="${body}" fill="none" stroke-width="0.25"/>` +
    `</g>`
  );
}

function svgRicePaddy(x: number, y: number, c: AssetColors, v: number): string {
  // Isometric parallelogram terrace with water fill and rice plant stubs
  return (
    `<g transform="translate(${x},${y})">` +
    // Terrace edge (outer parallelogram)
    `<polygon points="-4,-1 0,-3 4,-1 0,1" fill="${c.ricePaddy}" stroke="${c.ricePaddy}" stroke-width="0.3"/>` +
    // Inner water fill
    `<polygon points="-3,-0.8 0,-2.4 3,-0.8 0,0.6" fill="${c.ricePaddyWater}" opacity="0.6"/>` +
    // Reflection lines
    `<line x1="-1.5" y1="-0.6" x2="1.5" y2="-1.8" stroke="#fff" stroke-width="0.2" opacity="0.25"/>` +
    `<line x1="-1" y1="0" x2="2" y2="-1.2" stroke="#fff" stroke-width="0.2" opacity="0.2"/>` +
    `<line x1="-2" y1="-0.3" x2="1" y2="-1.5" stroke="#fff" stroke-width="0.2" opacity="0.15"/>` +
    // Rice plant stubs along edges
    `<line x1="-2.5" y1="-0.5" x2="-2.5" y2="-2" stroke="${c.reeds}" stroke-width="0.3"/>` +
    `<line x1="-0.8" y1="-1.8" x2="-0.8" y2="-3.3" stroke="${c.reeds}" stroke-width="0.3"/>` +
    `<line x1="1" y1="-1.5" x2="1" y2="-3" stroke="${c.reeds}" stroke-width="0.3"/>` +
    `<line x1="2.5" y1="-0.5" x2="2.5" y2="-2" stroke="${c.reeds}" stroke-width="0.3"/>` +
    `</g>`
  );
}

// Village assets

function svgTent(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<polygon points="0,-6 -3.5,0 3.5,0" fill="${c.tent}"/>` +
    `<polygon points="0,-6 -1.5,0 1.5,0" fill="${c.tentStripe}" opacity="0.6"/>` +
    `<line x1="0" y1="-6" x2="0" y2="-7" stroke="${c.trunk}" stroke-width="0.3"/>` +
    `</g>`
  );
}

function svgHut(x: number, y: number, c: AssetColors, v: number): string {
  if (v === 1) {
    // Round hut variant
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="0" cy="-1.5" rx="2" ry="1.5" fill="${c.hut}"/>` +
      `<polygon points="-2.2,-1.5 0,-5 2.2,-1.5" fill="${c.roofB}"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // With porch variant
    return (
      `<g transform="translate(${x},${y})">` +
      `<rect x="-2" y="-3" width="4" height="3" fill="${c.hut}"/>` +
      `<polygon points="-2.5,-3 0,-5.5 2.5,-3" fill="${c.roofB}"/>` +
      `<rect x="2.5" y="-1.5" width="2" height="1.5" fill="${c.hut}" opacity="0.6"/>` +
      `<line x1="2.5" y1="-1.5" x2="4.5" y2="-1.5" stroke="${c.roofB}" stroke-width="0.3"/>` +
      `<line x1="4.5" y1="-1.5" x2="4.5" y2="0" stroke="${c.trunk}" stroke-width="0.3"/>` +
      `</g>`
    );
  }
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-2" y="-3" width="4" height="3" fill="${c.hut}"/>` +
    `<polygon points="-2.5,-3 0,-5.5 2.5,-3" fill="${c.roofB}"/>` +
    `</g>`
  );
}

function svgHouse(x: number, y: number, c: AssetColors, v: number, roofColor?: string): string {
  // v=1: blue roof, v=2: green roof+garden
  const roofOptions = [roofColor || c.roofA, '#4477aa', '#448844'];
  const roof = roofOptions[v] || roofOptions[0];
  return (
    `<g transform="translate(${x},${y})">` +
    `<polygon points="-2.5,0 0,1.2 2.5,0 2.5,-3 0,-1.8 -2.5,-3" fill="${c.wall}"/>` +
    `<polygon points="-2.5,0 0,1.2 0,-1.8 -2.5,-3" fill="${c.wallShade}"/>` +
    `<polygon points="0,-6 -3.2,-2.8 0,-1.5 3.2,-2.8" fill="${roof}"/>` +
    `<rect x="1" y="-6.5" width="1" height="2" fill="${c.chimney}"/>` +
    `</g>`
  );
}

function svgHouseB(x: number, y: number, c: AssetColors, v: number): string {
  return svgHouse(x, y, c, v, c.roofB);
}

function svgChurch(x: number, y: number, c: AssetColors, v: number): string {
  if (v === 1) {
    // Bell tower variant — wider tower with bell
    return (
      `<g transform="translate(${x},${y})">` +
      `<polygon points="-2,0 0,1 2,0 2,-5 0,-4 -2,-5" fill="${c.church}"/>` +
      `<polygon points="-2,0 0,1 0,-4 -2,-5" fill="${c.wallShade}"/>` +
      `<rect x="-1" y="-8.5" width="2" height="3.5" fill="${c.church}"/>` +
      `<polygon points="-1.3,-8.5 0,-10.5 1.3,-8.5" fill="${c.roofA}"/>` +
      `<circle cx="0" cy="-7" r="0.4" fill="${c.blacksmith}" opacity="0.5"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // Small chapel variant — compact, no tower
    return (
      `<g transform="translate(${x},${y})">` +
      `<rect x="-1.5" y="-3" width="3" height="3" fill="${c.church}"/>` +
      `<polygon points="-2,-3 0,-5 2,-3" fill="${c.roofA}"/>` +
      `<line x1="0" y1="-5.5" x2="0" y2="-5" stroke="${c.wall}" stroke-width="0.4"/>` +
      `<line x1="-0.5" y1="-5.2" x2="0.5" y2="-5.2" stroke="${c.wall}" stroke-width="0.4"/>` +
      `</g>`
    );
  }
  return (
    `<g transform="translate(${x},${y})">` +
    `<polygon points="-2,0 0,1 2,0 2,-5 0,-4 -2,-5" fill="${c.church}"/>` +
    `<polygon points="-2,0 0,1 0,-4 -2,-5" fill="${c.wallShade}"/>` +
    `<polygon points="0,-10 -2.5,-5 0,-3.8 2.5,-5" fill="${c.roofA}"/>` +
    `<line x1="0" y1="-12" x2="0" y2="-10" stroke="${c.wall}" stroke-width="0.5"/>` +
    `<line x1="-1" y1="-11" x2="1" y2="-11" stroke="${c.wall}" stroke-width="0.5"/>` +
    `</g>`
  );
}

function svgWindmill(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<polygon points="-1.5,0 1.5,0 1,-7 -1,-7" fill="${c.windmill}"/>` +
    // Animated blades via SMIL
    `<g>` +
    `<line x1="0" y1="-11" x2="0" y2="-3" stroke="${c.windBlade}" stroke-width="0.5"/>` +
    `<line x1="-4" y1="-7" x2="4" y2="-7" stroke="${c.windBlade}" stroke-width="0.5"/>` +
    `<animateTransform attributeName="transform" type="rotate" from="0 0 -7" to="360 0 -7" dur="8s" repeatCount="indefinite"/>` +
    `</g>` +
    `<circle cx="0" cy="-7" r="0.7" fill="${c.roofA}"/>` +
    `</g>`
  );
}

function svgWell(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    // Stone base with multiple stones visible
    `<ellipse cx="0" cy="-0.3" rx="2.3" ry="1.2" fill="${c.rock}"/>` +
    `<ellipse cx="0" cy="-0.6" rx="2.1" ry="1" fill="${c.well}" stroke="${c.boulder}" stroke-width="0.3"/>` +
    // Stone texture on rim
    `<ellipse cx="-1.2" cy="-0.5" rx="0.5" ry="0.25" fill="${c.boulder}" opacity="0.6"/>` +
    `<ellipse cx="0.8" cy="-0.4" rx="0.6" ry="0.3" fill="${c.boulder}" opacity="0.5"/>` +
    `<ellipse cx="-0.2" cy="-0.7" rx="0.4" ry="0.2" fill="${c.rock}" opacity="0.4"/>` +
    // Inner dark hole
    `<ellipse cx="0" cy="-0.6" rx="1.4" ry="0.6" fill="${c.shadow}" opacity="0.8"/>` +
    // Support posts
    `<rect x="-1.7" y="-4.2" width="0.4" height="3.7" fill="${c.trunk}"/>` +
    `<rect x="1.3" y="-4.2" width="0.4" height="3.7" fill="${c.trunk}"/>` +
    // Crossbeam
    `<rect x="-1.8" y="-4.4" width="3.6" height="0.35" fill="${c.trunk}"/>` +
    // Roof
    `<polygon points="0,-5.8 -2.5,-4.2 2.5,-4.2" fill="${c.roofB}"/>` +
    `<line x1="0" y1="-5.8" x2="-2.5" y2="-4.2" stroke="${c.shadow}" stroke-width="0.15" opacity="0.3"/>` +
    // Rope spool
    `<ellipse cx="0" cy="-4" rx="0.5" ry="0.2" fill="${c.fence}"/>` +
    `<rect x="-0.5" y="-4.2" width="1" height="0.4" fill="${c.fence}"/>` +
    // Rope
    `<path d="M0,-4 Q0.3,-3 0,-2 Q-0.2,-1.5 0,-1" stroke="${c.fence}" stroke-width="0.15" fill="none"/>` +
    // Bucket
    `<path d="M-0.35,-1.3 L-0.3,-0.6 L0.3,-0.6 L0.35,-1.3 Z" fill="${c.barrel}"/>` +
    `<ellipse cx="0" cy="-1.3" rx="0.35" ry="0.12" fill="${c.cart}"/>` +
    `</g>`
  );
}

// Town assets

function svgMarket(x: number, y: number, c: AssetColors, v: number): string {
  if (v === 1) {
    // With cart variant
    return (
      `<g transform="translate(${x},${y})">` +
      `<rect x="-3" y="-3" width="6" height="3" fill="${c.market}"/>` +
      `<polygon points="-3.5,-3 0,-5 3.5,-3" fill="${c.marketAwning}"/>` +
      `<rect x="-2" y="-1.5" width="1" height="0.8" fill="${c.barrel}" rx="0.2"/>` +
      `<rect x="4" y="-1.5" width="2.5" height="1.2" fill="${c.cart}"/>` +
      `<circle cx="4.5" cy="0" r="0.5" fill="${c.trunk}"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // Open stall variant — no back wall, posts only
    return (
      `<g transform="translate(${x},${y})">` +
      `<line x1="-3" y1="0" x2="-3" y2="-4" stroke="${c.trunk}" stroke-width="0.5"/>` +
      `<line x1="3" y1="0" x2="3" y2="-4" stroke="${c.trunk}" stroke-width="0.5"/>` +
      `<polygon points="-3.5,-4 0,-5.5 3.5,-4" fill="${c.marketAwning}"/>` +
      `<rect x="-2.5" y="-1" width="5" height="0.8" fill="${c.trunk}" opacity="0.4"/>` +
      `<rect x="-2" y="-1.5" width="1" height="0.8" fill="${c.barrel}" rx="0.2"/>` +
      `<rect x="0.5" y="-1.5" width="1" height="0.8" fill="${c.wheat}" rx="0.2"/>` +
      `</g>`
    );
  }
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-3" y="-3" width="6" height="3" fill="${c.market}"/>` +
    `<polygon points="-3.5,-3 0,-5 3.5,-3" fill="${c.marketAwning}"/>` +
    // Goods display
    `<rect x="-2" y="-1.5" width="1" height="0.8" fill="${c.barrel}" rx="0.2"/>` +
    `<rect x="0.5" y="-1.5" width="1" height="0.8" fill="${c.wheat}" rx="0.2"/>` +
    `</g>`
  );
}

function svgInn(x: number, y: number, c: AssetColors, v: number): string {
  if (v === 1) {
    // With dormer variant
    return (
      `<g transform="translate(${x},${y})">` +
      `<polygon points="-3,0 0,1.5 3,0 3,-4 0,-2.5 -3,-4" fill="${c.inn}"/>` +
      `<polygon points="-3,0 0,1.5 0,-2.5 -3,-4" fill="${c.wallShade}"/>` +
      `<polygon points="0,-7 -3.5,-3.8 0,-2.2 3.5,-3.8" fill="${c.roofB}"/>` +
      `<rect x="-1" y="-5.5" width="1.5" height="1.5" fill="${c.wall}"/>` +
      `<polygon points="-1,-5.5 -0.25,-6.5 0.5,-5.5" fill="${c.roofB}"/>` +
      `<rect x="3" y="-5" width="2" height="1.5" fill="${c.innSign}" rx="0.3"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // Outdoor seating variant
    return (
      `<g transform="translate(${x},${y})">` +
      `<polygon points="-3,0 0,1.5 3,0 3,-4 0,-2.5 -3,-4" fill="${c.inn}"/>` +
      `<polygon points="-3,0 0,1.5 0,-2.5 -3,-4" fill="${c.wallShade}"/>` +
      `<polygon points="0,-7 -3.5,-3.8 0,-2.2 3.5,-3.8" fill="${c.roofB}"/>` +
      `<rect x="3" y="-5" width="2" height="1.5" fill="${c.innSign}" rx="0.3"/>` +
      `<rect x="3.5" y="-1.5" width="2" height="0.5" fill="${c.trunk}" opacity="0.6"/>` +
      `<rect x="4" y="-1" width="0.5" height="1" fill="${c.trunk}" opacity="0.5"/>` +
      `</g>`
    );
  }
  return (
    `<g transform="translate(${x},${y})">` +
    `<polygon points="-3,0 0,1.5 3,0 3,-4 0,-2.5 -3,-4" fill="${c.inn}"/>` +
    `<polygon points="-3,0 0,1.5 0,-2.5 -3,-4" fill="${c.wallShade}"/>` +
    `<polygon points="0,-7 -3.5,-3.8 0,-2.2 3.5,-3.8" fill="${c.roofB}"/>` +
    // Sign
    `<rect x="3" y="-5" width="2" height="1.5" fill="${c.innSign}" rx="0.3"/>` +
    `</g>`
  );
}

function svgBlacksmith(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-2.5" y="-3" width="5" height="3" fill="${c.blacksmith}"/>` +
    `<polygon points="-3,-3 0,-5 3,-3" fill="${c.roofA}"/>` +
    // Anvil
    `<polygon points="-1,-0.5 1,-0.5 1.5,-1.5 -1.5,-1.5" fill="${c.anvil}"/>` +
    // Smoke from forge
    `<circle cx="1.5" cy="-5.5" r="0.8" fill="${c.smoke}" opacity="0.5"/>` +
    `</g>`
  );
}

function svgCastle(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    // Main body
    `<rect x="-3" y="-6" width="6" height="6" fill="${c.castle}"/>` +
    // Battlements
    `<rect x="-3" y="-7" width="1.5" height="1.2" fill="${c.castle}"/>` +
    `<rect x="-0.75" y="-7" width="1.5" height="1.2" fill="${c.castle}"/>` +
    `<rect x="1.5" y="-7" width="1.5" height="1.2" fill="${c.castle}"/>` +
    // Tower
    `<rect x="-1" y="-10" width="2" height="3.5" fill="${c.tower}"/>` +
    `<polygon points="-1.3,-10 0,-12 1.3,-10" fill="${c.castleRoof}"/>` +
    // Gate
    `<rect x="-0.8" y="-2" width="1.6" height="2" fill="${c.blacksmith}" rx="0.8" ry="0"/>` +
    `</g>`
  );
}

function svgTower(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-1.5" y="-8" width="3" height="8" fill="${c.tower}"/>` +
    `<polygon points="-2,-8 0,-11 2,-8" fill="${c.castleRoof}"/>` +
    // Window
    `<rect x="-0.5" y="-6" width="1" height="1.2" fill="${c.blacksmith}" rx="0.5" ry="0"/>` +
    `</g>`
  );
}

function svgBridge(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<path d="M-4,0 Q0,-2 4,0" fill="${c.bridge}" stroke="${c.trunk}" stroke-width="0.4"/>` +
    `<line x1="-3" y1="-0.8" x2="-3" y2="-2.5" stroke="${c.trunk}" stroke-width="0.4"/>` +
    `<line x1="3" y1="-0.8" x2="3" y2="-2.5" stroke="${c.trunk}" stroke-width="0.4"/>` +
    `<line x1="-3" y1="-2.5" x2="3" y2="-2.5" stroke="${c.trunk}" stroke-width="0.3"/>` +
    `</g>`
  );
}

// Cross-level decoration assets

function svgCart(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-2" y="-2" width="3.5" height="2" fill="${c.cart}"/>` +
    `<circle cx="-1.5" cy="0" r="0.8" fill="${c.trunk}" stroke="${c.fence}" stroke-width="0.2"/>` +
    `<circle cx="1" cy="0" r="0.8" fill="${c.trunk}" stroke="${c.fence}" stroke-width="0.2"/>` +
    `<line x1="2" y1="-1" x2="3.5" y2="-0.5" stroke="${c.trunk}" stroke-width="0.4"/>` +
    `</g>`
  );
}

function svgBarrel(x: number, y: number, c: AssetColors, v: number): string {
  // Barrel with metal bands and wood texture
  return (
    `<g transform="translate(${x},${y})">` +
    // Base shadow
    `<ellipse cx="0" cy="-0.1" rx="1.4" ry="0.6" fill="${c.shadow}" opacity="0.2"/>` +
    // Bottom rim
    `<ellipse cx="0" cy="-0.3" rx="1.3" ry="0.55" fill="${c.barrel}"/>` +
    // Main body
    `<rect x="-1.3" y="-2.6" width="2.6" height="2.3" fill="${c.barrel}" rx="0.2"/>` +
    // Wood grain lines
    `<line x1="-0.6" y1="-2.5" x2="-0.6" y2="-0.4" stroke="${c.trunk}" stroke-width="0.1" opacity="0.3"/>` +
    `<line x1="0.2" y1="-2.5" x2="0.2" y2="-0.4" stroke="${c.trunk}" stroke-width="0.1" opacity="0.3"/>` +
    `<line x1="0.9" y1="-2.5" x2="0.9" y2="-0.4" stroke="${c.trunk}" stroke-width="0.1" opacity="0.25"/>` +
    // Metal bands
    `<ellipse cx="0" cy="-0.6" rx="1.35" ry="0.25" fill="none" stroke="${c.shadow}" stroke-width="0.25"/>` +
    `<ellipse cx="0" cy="-1.5" rx="1.35" ry="0.25" fill="none" stroke="${c.shadow}" stroke-width="0.25"/>` +
    `<ellipse cx="0" cy="-2.4" rx="1.35" ry="0.25" fill="none" stroke="${c.shadow}" stroke-width="0.25"/>` +
    // Top rim
    `<ellipse cx="0" cy="-2.6" rx="1.3" ry="0.55" fill="${c.cart}"/>` +
    `<ellipse cx="0" cy="-2.6" rx="0.9" ry="0.35" fill="${c.barrel}" opacity="0.7"/>` +
    `</g>`
  );
}

function svgTorch(x: number, y: number, c: AssetColors, v: number): string {
  if (v === 1) {
    // Ground stake variant
    return (
      `<g transform="translate(${x},${y})">` +
      `<line x1="0" y1="0.5" x2="0" y2="-3" stroke="${c.torch}" stroke-width="0.4"/>` +
      `<ellipse cx="0" cy="-3.5" rx="0.6" ry="0.8" fill="${c.torchFlame}" opacity="0.8"/>` +
      `<ellipse cx="0" cy="-3.7" rx="0.3" ry="0.5" fill="#ffdd44" opacity="0.9"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // Streetlamp variant
    return (
      `<g transform="translate(${x},${y})">` +
      `<line x1="0" y1="0" x2="0" y2="-5" stroke="${c.torch}" stroke-width="0.4"/>` +
      `<path d="M0,-5 Q1,-5.5 1,-5" stroke="${c.torch}" fill="none" stroke-width="0.3"/>` +
      `<rect x="0.5" y="-6" width="1" height="0.8" fill="${c.lantern}"/>` +
      `<rect x="0.65" y="-5.8" width="0.7" height="0.4" fill="${c.lanternGlow}" opacity="0.8"/>` +
      `</g>`
    );
  }
  return (
    `<g transform="translate(${x},${y})">` +
    `<line x1="0" y1="0" x2="0" y2="-4" stroke="${c.torch}" stroke-width="0.5"/>` +
    `<ellipse cx="0" cy="-4.5" rx="0.8" ry="1" fill="${c.torchFlame}" opacity="0.8"/>` +
    `<ellipse cx="0" cy="-4.8" rx="0.4" ry="0.6" fill="#ffdd44" opacity="0.9"/>` +
    `</g>`
  );
}

function svgFlag(x: number, y: number, c: AssetColors, v: number): string {
  if (v === 1) {
    // Blue pennant variant
    return (
      `<g transform="translate(${x},${y})">` +
      `<line x1="0" y1="0" x2="0" y2="-8" stroke="${c.trunk}" stroke-width="0.4"/>` +
      `<polygon points="0,-8 2.5,-6.5 0,-5" fill="#4477bb"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // Banner variant
    return (
      `<g transform="translate(${x},${y})">` +
      `<line x1="0" y1="0" x2="0" y2="-8" stroke="${c.trunk}" stroke-width="0.4"/>` +
      `<line x1="0" y1="-8" x2="2.5" y2="-8" stroke="${c.trunk}" stroke-width="0.3"/>` +
      `<rect x="0" y="-8" width="2.5" height="3" fill="${c.flag}" opacity="0.9"/>` +
      `</g>`
    );
  }
  return (
    `<g transform="translate(${x},${y})">` +
    `<line x1="0" y1="0" x2="0" y2="-8" stroke="${c.trunk}" stroke-width="0.4"/>` +
    `<polygon points="0,-8 3.5,-7 0,-5.5" fill="${c.flag}"/>` +
    `</g>`
  );
}

function svgCobblePath(x: number, y: number, c: AssetColors, v: number): string {
  if (v === 1) {
    // Lined variant — neat row
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="-2" cy="-0.3" rx="0.8" ry="0.35" fill="${c.cobble}" opacity="0.6"/>` +
      `<ellipse cx="-0.5" cy="-0.3" rx="0.7" ry="0.3" fill="${c.cobble}" opacity="0.55"/>` +
      `<ellipse cx="1" cy="-0.3" rx="0.8" ry="0.35" fill="${c.cobble}" opacity="0.5"/>` +
      `<ellipse cx="2.5" cy="-0.3" rx="0.7" ry="0.3" fill="${c.cobble}" opacity="0.5"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // Crossroads variant — X pattern
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="0" cy="-0.3" rx="0.8" ry="0.35" fill="${c.cobble}" opacity="0.6"/>` +
      `<ellipse cx="-1.5" cy="-0.8" rx="0.7" ry="0.3" fill="${c.cobble}" opacity="0.5"/>` +
      `<ellipse cx="1.5" cy="-0.8" rx="0.7" ry="0.3" fill="${c.cobble}" opacity="0.5"/>` +
      `<ellipse cx="-1.5" cy="0.2" rx="0.7" ry="0.3" fill="${c.cobble}" opacity="0.5"/>` +
      `<ellipse cx="1.5" cy="0.2" rx="0.7" ry="0.3" fill="${c.cobble}" opacity="0.5"/>` +
      `</g>`
    );
  }
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="-1" cy="-0.3" rx="1" ry="0.4" fill="${c.cobble}" opacity="0.6"/>` +
    `<ellipse cx="1" cy="0" rx="0.8" ry="0.35" fill="${c.cobble}" opacity="0.5"/>` +
    `<ellipse cx="0" cy="-0.8" rx="0.7" ry="0.3" fill="${c.cobble}" opacity="0.5"/>` +
    `</g>`
  );
}

function svgSmoke(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<circle cx="0" cy="-5" r="1" fill="${c.smoke}">` +
    `<animate attributeName="cy" values="-5;-8;-5" dur="4s" repeatCount="indefinite"/>` +
    `<animate attributeName="opacity" values="0.5;0.1;0.5" dur="4s" repeatCount="indefinite"/>` +
    `</circle>` +
    `<circle cx="0.5" cy="-6" r="0.7" fill="${c.smoke}">` +
    `<animate attributeName="cy" values="-6;-9;-6" dur="3.5s" repeatCount="indefinite"/>` +
    `<animate attributeName="opacity" values="0.4;0.08;0.4" dur="3.5s" repeatCount="indefinite"/>` +
    `</circle>` +
    `</g>`
  );
}

// Biome blend assets

function svgReeds(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<line x1="-1" y1="0" x2="-1.3" y2="-4" stroke="${c.reeds}" stroke-width="0.4"/>` +
    `<line x1="0" y1="0" x2="0.2" y2="-4.5" stroke="${c.reeds}" stroke-width="0.4"/>` +
    `<line x1="1" y1="0" x2="0.8" y2="-3.8" stroke="${c.reeds}" stroke-width="0.4"/>` +
    `<ellipse cx="-1.3" cy="-4.3" rx="0.3" ry="0.8" fill="${c.trunk}"/>` +
    `<ellipse cx="0.2" cy="-4.8" rx="0.3" ry="0.8" fill="${c.trunk}"/>` +
    `</g>`
  );
}

function svgFountain(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="0" cy="-0.5" rx="2.5" ry="1" fill="${c.fountain}" stroke="${c.boulder}" stroke-width="0.3"/>` +
    `<ellipse cx="0" cy="-0.3" rx="2" ry="0.7" fill="${c.fountainWater}" opacity="0.6"/>` +
    `<rect x="-0.4" y="-3" width="0.8" height="2.5" fill="${c.fountain}"/>` +
    `<line x1="0" y1="-3" x2="0" y2="-4.5" stroke="${c.fountainWater}" stroke-width="0.4" opacity="0.7">` +
    `<animate attributeName="y2" values="-4.5;-5.2;-4.5" dur="2s" repeatCount="indefinite"/>` +
    `</line>` +
    `<circle cx="-0.5" cy="-3.5" r="0.3" fill="${c.fountainWater}" opacity="0.4"/>` +
    `<circle cx="0.5" cy="-3.8" r="0.3" fill="${c.fountainWater}" opacity="0.4"/>` +
    `</g>`
  );
}

function svgCanal(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-3" y="-1" width="6" height="1" fill="${c.canal}"/>` +
    `<rect x="-2.5" y="-0.7" width="5" height="0.5" fill="${c.fountainWater}" opacity="0.5"/>` +
    `</g>`
  );
}

function svgWatermill(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-2" y="-4" width="4" height="4" fill="${c.wall}"/>` +
    `<polygon points="-2.5,-4 0,-6 2.5,-4" fill="${c.roofB}"/>` +
    `<g>` +
    `<circle cx="3" cy="-2" r="2" fill="none" stroke="${c.trunk}" stroke-width="0.5"/>` +
    `<line x1="3" y1="-4" x2="3" y2="0" stroke="${c.trunk}" stroke-width="0.3"/>` +
    `<line x1="1" y1="-2" x2="5" y2="-2" stroke="${c.trunk}" stroke-width="0.3"/>` +
    `<animateTransform attributeName="transform" type="rotate" from="0 3 -2" to="360 3 -2" dur="6s" repeatCount="indefinite"/>` +
    `</g>` +
    `</g>`
  );
}

function svgGardenTree(x: number, y: number, c: AssetColors, v: number): string {
  if (v === 1) {
    // Cone topiary variant
    return (
      `<g transform="translate(${x},${y})">` +
      `<line x1="0" y1="0" x2="0" y2="-2.5" stroke="${c.trunk}" stroke-width="0.5"/>` +
      `<polygon points="0,-7 -1.5,-2.5 1.5,-2.5" fill="${c.gardenTree}"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // Flowering pink variant
    return (
      `<g transform="translate(${x},${y})">` +
      `<line x1="0" y1="0" x2="0" y2="-2.5" stroke="${c.trunk}" stroke-width="0.5"/>` +
      `<circle cx="0" cy="-4" r="2" fill="${c.gardenTree}"/>` +
      `<circle cx="-0.8" cy="-4.5" r="0.4" fill="${c.flower}" opacity="0.8"/>` +
      `<circle cx="0.5" cy="-3.5" r="0.35" fill="${c.flower}" opacity="0.7"/>` +
      `<circle cx="0.8" cy="-4.8" r="0.3" fill="${c.flower}" opacity="0.6"/>` +
      `<circle cx="-0.3" cy="-3.2" r="0.3" fill="${c.flower}" opacity="0.7"/>` +
      `</g>`
    );
  }
  return (
    `<g transform="translate(${x},${y})">` +
    `<line x1="0" y1="0" x2="0" y2="-2.5" stroke="${c.trunk}" stroke-width="0.5"/>` +
    `<circle cx="0" cy="-4" r="2" fill="${c.gardenTree}"/>` +
    `<circle cx="-0.8" cy="-3.5" r="1.2" fill="${c.leaf}" opacity="0.6"/>` +
    `</g>`
  );
}

function svgPondLily(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="0" cy="-0.3" rx="1.5" ry="0.6" fill="${c.pine}" opacity="0.7"/>` +
    `<circle cx="0.3" cy="-0.5" r="0.4" fill="${c.flower}"/>` +
    `</g>`
  );
}

// ── New Water Assets ────────────────────────────────────────

function svgKelp(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<path d="M0,0 Q-1,-2 0,-4 Q1,-6 0,-7" stroke="${c.fern}" fill="none" stroke-width="0.6" opacity="0.7"/>` +
    `<path d="M1,0 Q2,-1.5 1,-3.5 Q0,-5 1,-6" stroke="${c.fern}" fill="none" stroke-width="0.5" opacity="0.6"/>` +
    `</g>`
  );
}

function svgCoral(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<path d="M0,0 Q-1,-2 -2,-3 M0,0 Q0,-2.5 -0.5,-4 M0,0 Q1,-2 2,-3" stroke="${c.coral}" fill="none" stroke-width="0.8"/>` +
    `<circle cx="-2" cy="-3" r="0.5" fill="${c.coral}"/>` +
    `<circle cx="-0.5" cy="-4" r="0.5" fill="${c.coral}"/>` +
    `<circle cx="2" cy="-3" r="0.5" fill="${c.coral}"/>` +
    `</g>`
  );
}

function svgJellyfish(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="0" cy="-2" rx="2" ry="1.5" fill="${c.jellyfish}" opacity="0.7">` +
    `<animate attributeName="cy" values="-2;-3;-2" dur="3s" repeatCount="indefinite"/>` +
    `</ellipse>` +
    `<path d="M-1.5,-0.5 Q-1.2,-1.5 -0.8,0" stroke="${c.jellyfish}" fill="none" stroke-width="0.3" opacity="0.5"/>` +
    `<path d="M-0.3,-0.5 Q0,-1.5 0.3,0" stroke="${c.jellyfish}" fill="none" stroke-width="0.3" opacity="0.5"/>` +
    `<path d="M0.8,-0.5 Q1.2,-1.5 1.5,0" stroke="${c.jellyfish}" fill="none" stroke-width="0.3" opacity="0.5"/>` +
    `</g>`
  );
}

function svgTurtle(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<g>` +
    `<ellipse cx="0" cy="-1" rx="2" ry="1.2" fill="${c.turtle}"/>` +
    `<ellipse cx="0" cy="-1.3" rx="1.5" ry="0.8" fill="${c.moss}" opacity="0.5"/>` +
    `<circle cx="-2" cy="-1.2" r="0.5" fill="${c.turtle}"/>` +
    `<circle cx="-2.3" cy="-1.3" r="0.12" fill="#222"/>` +
    `<animateTransform attributeName="transform" type="translate" values="0,0;3,0;0,0" dur="8s" repeatCount="indefinite"/>` +
    `</g>` +
    `</g>`
  );
}

function svgBuoy(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="0" cy="-0.3" rx="1.2" ry="0.5" fill="${c.waterLight}" opacity="0.3"/>` +
    `<rect x="-0.6" y="-2.5" width="1.2" height="2.2" fill="${c.buoy}" rx="0.3"/>` +
    `<rect x="-0.6" y="-1.8" width="1.2" height="0.5" fill="#fff"/>` +
    `<line x1="0" y1="-2.5" x2="0" y2="-3.5" stroke="${c.buoy}" stroke-width="0.3"/>` +
    `</g>`
  );
}

function svgSailboat(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<polygon points="-3.5,0 -2.5,-1.5 3.5,-1.5 4,0" fill="${c.boat}"/>` +
    `<line x1="0" y1="-1.5" x2="0" y2="-7" stroke="${c.trunk}" stroke-width="0.4"/>` +
    `<polygon points="0,-6.5 0,-2 3,-2.5" fill="${c.sail}" opacity="0.9"/>` +
    `<polygon points="0,-6 0,-2.5 -2,-3" fill="${c.sail}" opacity="0.7"/>` +
    `</g>`
  );
}

function svgLighthouse(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<polygon points="-1.5,0 1.5,0 1,-8 -1,-8" fill="${c.lighthouse}"/>` +
    `<rect x="-1.5" y="-1" width="3" height="1" fill="${c.rock}"/>` +
    `<rect x="-0.8" y="-9" width="1.6" height="1.2" fill="${c.lighthouse}" stroke="${c.rock}" stroke-width="0.2"/>` +
    `<polygon points="-1,-9 0,-10.5 1,-9" fill="${c.buoy}"/>` +
    `<circle cx="0" cy="-8.4" r="0.4" fill="${c.lanternGlow}" opacity="0.8"/>` +
    `</g>`
  );
}

function svgCrab(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="0" cy="-0.8" rx="1.5" ry="1" fill="${c.crab}"/>` +
    `<path d="M-1.5,-0.8 L-2.5,-1.8 L-2.8,-1.2" stroke="${c.crab}" fill="none" stroke-width="0.4"/>` +
    `<path d="M1.5,-0.8 L2.5,-1.8 L2.8,-1.2" stroke="${c.crab}" fill="none" stroke-width="0.4"/>` +
    `<circle cx="-0.5" cy="-1.2" r="0.15" fill="#222"/>` +
    `<circle cx="0.5" cy="-1.2" r="0.15" fill="#222"/>` +
    `</g>`
  );
}

// ── New Shore/Wetland Assets ────────────────────────────────

function svgDriftwood(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<path d="M-3,-0.3 Q-1,-1 1,-0.5 Q2.5,-0.2 3.5,0" stroke="${c.driftwood}" fill="none" stroke-width="0.8" stroke-linecap="round"/>` +
    `<path d="M1,-0.5 Q1.5,-1.5 2,-1.8" stroke="${c.driftwood}" fill="none" stroke-width="0.5"/>` +
    `</g>`
  );
}

function svgSandcastle(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-2" y="-2" width="4" height="2" fill="${c.sandcastle}"/>` +
    `<rect x="-1" y="-3.5" width="2" height="1.8" fill="${c.sandcastle}"/>` +
    `<rect x="-0.3" y="-4.5" width="0.6" height="1.2" fill="${c.sandcastle}"/>` +
    `<line x1="0" y1="-4.5" x2="0.8" y2="-4.5" stroke="${c.buoy}" stroke-width="0.2"/>` +
    `</g>`
  );
}

function svgTidePools(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="-1" cy="-0.3" rx="1.5" ry="0.6" fill="${c.tidePools}" opacity="0.5"/>` +
    `<ellipse cx="1.2" cy="-0.5" rx="1" ry="0.4" fill="${c.tidePools}" opacity="0.4"/>` +
    `<circle cx="-1.5" cy="-0.5" r="0.25" fill="${c.rock}"/>` +
    `<circle cx="0.8" cy="-0.3" r="0.2" fill="${c.rock}"/>` +
    `</g>`
  );
}

function svgHeron(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<line x1="0" y1="0" x2="0" y2="-3" stroke="${c.heron}" stroke-width="0.3"/>` +
    `<line x1="0.5" y1="0" x2="0.5" y2="-3" stroke="${c.heron}" stroke-width="0.3"/>` +
    `<ellipse cx="0.3" cy="-4" rx="1" ry="1.5" fill="${c.heron}"/>` +
    `<circle cx="-0.2" cy="-5.5" r="0.6" fill="${c.heron}"/>` +
    `<line x1="-0.8" y1="-5.4" x2="-1.8" y2="-5.2" stroke="${c.wheat}" stroke-width="0.3"/>` +
    `</g>`
  );
}

function svgShellfish(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="-1" cy="-0.3" rx="0.8" ry="0.5" fill="${c.shellfish}"/>` +
    `<ellipse cx="0.5" cy="-0.2" rx="0.6" ry="0.4" fill="${c.shellfish}" opacity="0.8"/>` +
    `<ellipse cx="1.5" cy="-0.5" rx="0.7" ry="0.45" fill="${c.shellfish}" opacity="0.7"/>` +
    `</g>`
  );
}

function svgCattail(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})" class="sway-gentle">` +
    `<line x1="-0.5" y1="0" x2="-0.7" y2="-4.5" stroke="${c.cattail}" stroke-width="0.3"/>` +
    `<line x1="0.5" y1="0" x2="0.3" y2="-5" stroke="${c.cattail}" stroke-width="0.3"/>` +
    `<ellipse cx="-0.7" cy="-5" rx="0.3" ry="0.9" fill="${c.trunk}"/>` +
    `<ellipse cx="0.3" cy="-5.5" rx="0.3" ry="0.9" fill="${c.trunk}"/>` +
    `</g>`
  );
}

function svgFrog(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="0" cy="-0.5" rx="1" ry="0.7" fill="${c.frog}"/>` +
    `<circle cx="-0.5" cy="-1.1" r="0.3" fill="${c.frog}"/>` +
    `<circle cx="0.5" cy="-1.1" r="0.3" fill="${c.frog}"/>` +
    `<circle cx="-0.5" cy="-1.2" r="0.12" fill="#222"/>` +
    `<circle cx="0.5" cy="-1.2" r="0.12" fill="#222"/>` +
    `</g>`
  );
}

function svgLily(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="0" cy="-0.2" rx="1.8" ry="0.7" fill="${c.pine}" opacity="0.6"/>` +
    `<path d="M0,-0.4 Q-0.3,-1.2 0,-1 Q0.3,-1.2 0,-0.4" fill="${c.lily}" opacity="0.9"/>` +
    `<circle cx="0" cy="-0.7" r="0.2" fill="${c.flowerCenter}"/>` +
    `</g>`
  );
}

// ── New Grassland Assets ────────────────────────────────────

function svgRabbit(x: number, y: number, c: AssetColors, v: number): string {
  if (v === 1) {
    // Hopping variant — legs extended
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="0" cy="-1" rx="1" ry="0.7" fill="${c.rabbit}"/>` +
      `<circle cx="-0.8" cy="-1.6" r="0.45" fill="${c.rabbit}"/>` +
      `<ellipse cx="-1" cy="-2.3" rx="0.18" ry="0.5" fill="${c.rabbit}"/>` +
      `<ellipse cx="-0.6" cy="-2.3" rx="0.18" ry="0.5" fill="${c.rabbit}"/>` +
      `<circle cx="-1" cy="-1.7" r="0.1" fill="#222"/>` +
      `<line x1="0.8" y1="-0.5" x2="1.5" y2="0.2" stroke="${c.rabbit}" stroke-width="0.3"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // Pair variant — two rabbits
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="-0.5" cy="-0.8" rx="1" ry="0.7" fill="${c.rabbit}"/>` +
      `<circle cx="-1.3" cy="-1.4" r="0.4" fill="${c.rabbit}"/>` +
      `<ellipse cx="-1.5" cy="-2" rx="0.15" ry="0.45" fill="${c.rabbit}"/>` +
      `<ellipse cx="-1.1" cy="-2" rx="0.15" ry="0.45" fill="${c.rabbit}"/>` +
      `<ellipse cx="1.5" cy="-0.6" rx="0.8" ry="0.5" fill="${c.rabbit}" opacity="0.8"/>` +
      `<circle cx="0.9" cy="-1" r="0.3" fill="${c.rabbit}" opacity="0.8"/>` +
      `</g>`
    );
  }
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="0" cy="-0.8" rx="1.2" ry="0.8" fill="${c.rabbit}"/>` +
    `<circle cx="-0.8" cy="-1.5" r="0.5" fill="${c.rabbit}"/>` +
    `<ellipse cx="-1.1" cy="-2.3" rx="0.2" ry="0.6" fill="${c.rabbit}"/>` +
    `<ellipse cx="-0.6" cy="-2.3" rx="0.2" ry="0.6" fill="${c.rabbit}"/>` +
    `<circle cx="-1" cy="-1.6" r="0.1" fill="#222"/>` +
    `</g>`
  );
}

function svgFox(x: number, y: number, c: AssetColors, v: number): string {
  if (v === 1) {
    // Curled up variant — sleeping
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="0" cy="-0.8" rx="1.5" ry="0.8" fill="${c.fox}"/>` +
      `<circle cx="-1" cy="-1.2" r="0.5" fill="${c.fox}"/>` +
      `<polygon points="-1.3,-1.7 -1.5,-2.1 -1,-1.8" fill="${c.fox}"/>` +
      `<polygon points="-0.7,-1.7 -0.5,-2.1 -1,-1.8" fill="${c.fox}"/>` +
      `<path d="M1.5,-0.5 Q1.2,-0.2 0.5,-0.5" stroke="${c.fox}" fill="none" stroke-width="0.5"/>` +
      `<circle cx="0.5" cy="-0.5" r="0.25" fill="#fff" opacity="0.8"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // Trotting variant — legs moving
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="0" cy="-1.5" rx="1.8" ry="0.9" fill="${c.fox}"/>` +
      `<circle cx="-1.5" cy="-2.3" r="0.55" fill="${c.fox}"/>` +
      `<polygon points="-1.8,-2.8 -2,-3.3 -1.5,-2.9" fill="${c.fox}"/>` +
      `<polygon points="-1.2,-2.8 -1,-3.3 -1.5,-2.9" fill="${c.fox}"/>` +
      `<circle cx="-1.7" cy="-2.4" r="0.1" fill="#222"/>` +
      `<line x1="-0.8" y1="-0.6" x2="-1.3" y2="0.3" stroke="${c.fox}" stroke-width="0.3"/>` +
      `<line x1="0.8" y1="-0.6" x2="1.3" y2="0.3" stroke="${c.fox}" stroke-width="0.3"/>` +
      `<path d="M1.8,-1.3 Q2.5,-1.5 3,-1" stroke="${c.fox}" fill="none" stroke-width="0.5"/>` +
      `</g>`
    );
  }
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="0" cy="-1.2" rx="1.8" ry="1" fill="${c.fox}"/>` +
    `<circle cx="-1.5" cy="-2" r="0.6" fill="${c.fox}"/>` +
    `<polygon points="-1.8,-2.6 -2,-3.2 -1.5,-2.7" fill="${c.fox}"/>` +
    `<polygon points="-1.2,-2.6 -1,-3.2 -1.5,-2.7" fill="${c.fox}"/>` +
    `<circle cx="-1.7" cy="-2.1" r="0.1" fill="#222"/>` +
    `<path d="M1.8,-1 Q2.5,-0.8 3,-1.5" stroke="${c.fox}" fill="none" stroke-width="0.6"/>` +
    `<circle cx="3" cy="-1.5" r="0.3" fill="#fff" opacity="0.8"/>` +
    `</g>`
  );
}

function svgButterfly(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<g>` +
    `<ellipse cx="-1" cy="-3.5" rx="1" ry="0.7" fill="${c.butterfly}" opacity="0.8"/>` +
    `<ellipse cx="1" cy="-3.5" rx="1" ry="0.7" fill="${c.butterflyWing}" opacity="0.8"/>` +
    `<ellipse cx="-0.6" cy="-2.8" rx="0.6" ry="0.4" fill="${c.butterflyWing}" opacity="0.7"/>` +
    `<ellipse cx="0.6" cy="-2.8" rx="0.6" ry="0.4" fill="${c.butterfly}" opacity="0.7"/>` +
    `<line x1="0" y1="-2.5" x2="0" y2="-4" stroke="${c.bird}" stroke-width="0.2"/>` +
    `<animateTransform attributeName="transform" type="translate" values="0,0;2,-1;-1,0.5;0,0" dur="6s" repeatCount="indefinite"/>` +
    `</g>` +
    `</g>`
  );
}

function svgBeehive(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<line x1="0" y1="-5" x2="0" y2="-7" stroke="${c.trunk}" stroke-width="0.5"/>` +
    `<path d="M-1,-5 Q1,-4.5 1,-5" stroke="${c.trunk}" fill="none" stroke-width="0.3"/>` +
    `<ellipse cx="0" cy="-3.5" rx="1.2" ry="1.8" fill="${c.beehive}"/>` +
    `<line x1="-1.2" y1="-3.5" x2="1.2" y2="-3.5" stroke="${c.trunk}" stroke-width="0.2" opacity="0.4"/>` +
    `<line x1="-1" y1="-2.5" x2="1" y2="-2.5" stroke="${c.trunk}" stroke-width="0.2" opacity="0.4"/>` +
    `<circle cx="0" cy="-1.8" r="0.25" fill="${c.trunk}"/>` +
    `</g>`
  );
}

function svgWildflowerPatch(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<circle cx="-1.5" cy="-1.5" r="0.5" fill="${c.flower}"/>` +
    `<circle cx="0" cy="-1.8" r="0.6" fill="${c.wildflower}"/>` +
    `<circle cx="1.2" cy="-1.3" r="0.5" fill="${c.butterflyWing}"/>` +
    `<circle cx="-0.5" cy="-1" r="0.4" fill="${c.flower}" opacity="0.8"/>` +
    `<circle cx="0.8" cy="-2" r="0.35" fill="${c.wildflower}" opacity="0.7"/>` +
    `<line x1="-1.5" y1="-1" x2="-1.5" y2="0" stroke="${c.pine}" stroke-width="0.2"/>` +
    `<line x1="0" y1="-1.2" x2="0" y2="0" stroke="${c.pine}" stroke-width="0.2"/>` +
    `<line x1="1.2" y1="-0.8" x2="1.2" y2="0" stroke="${c.pine}" stroke-width="0.2"/>` +
    `</g>`
  );
}

function svgTallGrass(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})" class="sway-gentle">` +
    `<line x1="-1" y1="0" x2="-1.3" y2="-3.5" stroke="${c.tallGrass}" stroke-width="0.4"/>` +
    `<line x1="0" y1="0" x2="0.2" y2="-4" stroke="${c.tallGrass}" stroke-width="0.4"/>` +
    `<line x1="1" y1="0" x2="0.8" y2="-3.2" stroke="${c.tallGrass}" stroke-width="0.4"/>` +
    `<line x1="-0.5" y1="0" x2="-0.8" y2="-3.8" stroke="${c.tallGrass}" stroke-width="0.3" opacity="0.7"/>` +
    `</g>`
  );
}

function svgBirch(x: number, y: number, c: AssetColors, v: number): string {
  if (v === 1) {
    // Cluster of 3 variant
    return (
      `<g transform="translate(${x},${y})">` +
      `<line x1="-2" y1="0" x2="-2" y2="-5.5" stroke="${c.birchBark}" stroke-width="0.5"/>` +
      `<circle cx="-2" cy="-6.5" r="1.5" fill="${c.leaf}" opacity="0.7"/>` +
      `<line x1="0" y1="0" x2="0" y2="-7" stroke="${c.birchBark}" stroke-width="0.6"/>` +
      `<circle cx="0" cy="-8" r="1.8" fill="${c.leaf}" opacity="0.8"/>` +
      `<line x1="2" y1="0" x2="2" y2="-5" stroke="${c.birchBark}" stroke-width="0.5"/>` +
      `<circle cx="2" cy="-6" r="1.3" fill="${c.leaf}" opacity="0.6"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // Leaning variant
    return (
      `<g transform="translate(${x},${y})">` +
      `<path d="M0,0 Q-1,-3.5 -0.5,-7" stroke="${c.birchBark}" fill="none" stroke-width="0.7"/>` +
      `<line x1="-0.7" y1="-2" x2="-0.3" y2="-2" stroke="${c.trunk}" stroke-width="0.2" opacity="0.5"/>` +
      `<line x1="-0.5" y1="-4.5" x2="-0.1" y2="-4.5" stroke="${c.trunk}" stroke-width="0.2" opacity="0.5"/>` +
      `<circle cx="-0.5" cy="-8.5" r="2" fill="${c.leaf}" opacity="0.8"/>` +
      `<circle cx="-1.5" cy="-8" r="1.3" fill="${c.leaf}" opacity="0.6"/>` +
      `</g>`
    );
  }
  return (
    `<g transform="translate(${x},${y})">` +
    `<line x1="0" y1="0" x2="0" y2="-7" stroke="${c.birchBark}" stroke-width="0.7"/>` +
    `<line x1="-0.2" y1="-2" x2="0.2" y2="-2" stroke="${c.trunk}" stroke-width="0.2" opacity="0.5"/>` +
    `<line x1="-0.2" y1="-4" x2="0.2" y2="-4" stroke="${c.trunk}" stroke-width="0.2" opacity="0.5"/>` +
    `<circle cx="0" cy="-8.5" r="2.2" fill="${c.leaf}" opacity="0.8"/>` +
    `<circle cx="-1" cy="-8" r="1.5" fill="${c.leaf}" opacity="0.6"/>` +
    `</g>`
  );
}

function svgHaybale(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="0" cy="-1" rx="2" ry="1" fill="${c.haybale}"/>` +
    `<rect x="-2" y="-1" width="4" height="1" fill="${c.haybale}"/>` +
    `<ellipse cx="0" cy="0" rx="2" ry="0.6" fill="${c.haybale}" opacity="0.7"/>` +
    `<line x1="-1.5" y1="-0.5" x2="1.5" y2="-0.5" stroke="${c.wheat}" stroke-width="0.2" opacity="0.4"/>` +
    `</g>`
  );
}

// ── New Forest Assets ───────────────────────────────────────

function svgOwl(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="0" cy="-2" rx="1.2" ry="1.5" fill="${c.owl}"/>` +
    `<circle cx="-0.4" cy="-2.5" r="0.5" fill="#fff"/>` +
    `<circle cx="0.4" cy="-2.5" r="0.5" fill="#fff"/>` +
    `<circle cx="-0.4" cy="-2.5" r="0.2" fill="#222"/>` +
    `<circle cx="0.4" cy="-2.5" r="0.2" fill="#222"/>` +
    `<polygon points="0,-2.1 -0.2,-1.8 0.2,-1.8" fill="${c.wheat}"/>` +
    `</g>`
  );
}

function svgSquirrel(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="0" cy="-0.8" rx="0.8" ry="0.6" fill="${c.squirrel}"/>` +
    `<circle cx="-0.6" cy="-1.3" r="0.4" fill="${c.squirrel}"/>` +
    `<circle cx="-0.7" cy="-1.4" r="0.1" fill="#222"/>` +
    `<path d="M0.8,-0.8 Q1.5,-1.5 1.2,-2.2" stroke="${c.squirrel}" fill="none" stroke-width="0.5"/>` +
    `</g>`
  );
}

function svgMoss(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="-1" cy="-0.2" rx="1.5" ry="0.5" fill="${c.moss}" opacity="0.7"/>` +
    `<ellipse cx="1" cy="-0.3" rx="1.2" ry="0.4" fill="${c.moss}" opacity="0.6"/>` +
    `<ellipse cx="0" cy="-0.1" rx="0.8" ry="0.3" fill="${c.moss}" opacity="0.5"/>` +
    `</g>`
  );
}

function svgFern(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<path d="M0,0 Q-2,-2 -3,-3.5" stroke="${c.fern}" fill="none" stroke-width="0.4"/>` +
    `<path d="M0,0 Q0,-2.5 0,-4" stroke="${c.fern}" fill="none" stroke-width="0.4"/>` +
    `<path d="M0,0 Q2,-2 3,-3.5" stroke="${c.fern}" fill="none" stroke-width="0.4"/>` +
    `<circle cx="-1" cy="-1.5" r="0.3" fill="${c.fern}" opacity="0.6"/>` +
    `<circle cx="1" cy="-1.5" r="0.3" fill="${c.fern}" opacity="0.6"/>` +
    `<circle cx="0" cy="-2.5" r="0.3" fill="${c.fern}" opacity="0.5"/>` +
    `</g>`
  );
}

function svgDeadTree(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<line x1="0" y1="0" x2="0" y2="-6" stroke="${c.deadTree}" stroke-width="0.8"/>` +
    `<line x1="0" y1="-4" x2="-2" y2="-5.5" stroke="${c.deadTree}" stroke-width="0.4"/>` +
    `<line x1="0" y1="-3" x2="1.5" y2="-4.5" stroke="${c.deadTree}" stroke-width="0.4"/>` +
    `<line x1="0" y1="-5" x2="-1" y2="-6.5" stroke="${c.deadTree}" stroke-width="0.3"/>` +
    `</g>`
  );
}

function svgLog(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-3" y="-1" width="6" height="1" fill="${c.log}" rx="0.5"/>` +
    `<ellipse cx="-3" cy="-0.5" rx="0.5" ry="0.5" fill="${c.trunk}"/>` +
    `<ellipse cx="3" cy="-0.5" rx="0.5" ry="0.5" fill="${c.trunk}"/>` +
    `</g>`
  );
}

function svgBerryBush(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="0" cy="-1.5" rx="2.2" ry="1.5" fill="${c.berryBush}"/>` +
    `<circle cx="-0.8" cy="-1.8" r="0.3" fill="${c.berry}"/>` +
    `<circle cx="0.5" cy="-2" r="0.3" fill="${c.berry}"/>` +
    `<circle cx="0" cy="-1.2" r="0.25" fill="${c.berry}"/>` +
    `<circle cx="1.2" cy="-1.5" r="0.25" fill="${c.berry}"/>` +
    `</g>`
  );
}

function svgSpider(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<line x1="-2.5" y1="-4" x2="2.5" y2="-1" stroke="${c.spiderWeb}" fill="none" stroke-width="0.15"/>` +
    `<line x1="-2.5" y1="-1" x2="2.5" y2="-4" stroke="${c.spiderWeb}" fill="none" stroke-width="0.15"/>` +
    `<line x1="0" y1="-5" x2="0" y2="0" stroke="${c.spiderWeb}" fill="none" stroke-width="0.15"/>` +
    `<path d="M-1.5,-1.5 Q0,-2 1.5,-1.5" stroke="${c.spiderWeb}" fill="none" stroke-width="0.12"/>` +
    `<path d="M-1,-3 Q0,-3.5 1,-3" stroke="${c.spiderWeb}" fill="none" stroke-width="0.12"/>` +
    `<circle cx="0" cy="-2.5" r="0.4" fill="${c.bird}"/>` +
    `</g>`
  );
}

// ── New Farm Assets ─────────────────────────────────────────

function svgSilo(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-1.2" y="-7" width="2.4" height="7" fill="${c.silo}"/>` +
    `<ellipse cx="0" cy="-7" rx="1.2" ry="0.5" fill="${c.silo}" opacity="0.8"/>` +
    `<polygon points="-1.2,-7 0,-8.5 1.2,-7" fill="${c.roofA}"/>` +
    `</g>`
  );
}

function svgPigpen(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-2.5" y="-1" width="5" height="1" fill="${c.fence}" opacity="0.5"/>` +
    `<ellipse cx="0" cy="-1" rx="1.2" ry="0.8" fill="${c.pig}"/>` +
    `<circle cx="-1" cy="-1.3" r="0.4" fill="${c.pig}"/>` +
    `<ellipse cx="-1.3" cy="-1.2" rx="0.25" ry="0.15" fill="#eaa"/>` +
    `</g>`
  );
}

function svgTrough(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-2" y="-1" width="4" height="0.8" fill="${c.trough}"/>` +
    `<line x1="-1.5" y1="-0.2" x2="-1.5" y2="0.5" stroke="${c.trunk}" stroke-width="0.3"/>` +
    `<line x1="1.5" y1="-0.2" x2="1.5" y2="0.5" stroke="${c.trunk}" stroke-width="0.3"/>` +
    `<rect x="-1.8" y="-0.8" width="3.6" height="0.5" fill="${c.tidePools}" opacity="0.4"/>` +
    `</g>`
  );
}

function svgHaystack(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<polygon points="-2,0 2,0 1.5,-3 -1.5,-3" fill="${c.haystack}"/>` +
    `<polygon points="-1.5,-3 0,-4.5 1.5,-3" fill="${c.haystack}"/>` +
    `</g>`
  );
}

function svgOrchard(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<line x1="0" y1="0" x2="0" y2="-3" stroke="${c.trunk}" stroke-width="0.6"/>` +
    `<circle cx="0" cy="-5" r="2.5" fill="${c.orchard}"/>` +
    `<circle cx="-1" cy="-4.5" r="0.35" fill="${c.orchardFruit}"/>` +
    `<circle cx="0.8" cy="-5.2" r="0.35" fill="${c.orchardFruit}"/>` +
    `<circle cx="0" cy="-3.8" r="0.3" fill="${c.orchardFruit}"/>` +
    `</g>`
  );
}

function svgAppleTree(x: number, y: number, c: AssetColors, v: number): string {
  // Apple tree with red apples
  const leaf = c.orchard;
  /* v8 ignore start */
  const apple = c.appleRed || '#c41e3a';
  /* v8 ignore stop */
  const trunk = c.trunk;
  if (v === 1) {
    // Many apples
    return (
      `<g transform="translate(${x},${y})">` +
      `<rect x="-0.5" y="-1" width="1" height="3" fill="${trunk}"/>` +
      `<circle cx="0" cy="-4.5" r="2.5" fill="${leaf}"/>` +
      `<circle cx="-1.5" cy="-3.5" r="1.5" fill="${leaf}" opacity="0.9"/>` +
      `<circle cx="1.5" cy="-3.5" r="1.5" fill="${leaf}" opacity="0.85"/>` +
      `<circle cx="-1" cy="-4" r="0.35" fill="${apple}"/>` +
      `<circle cx="0.5" cy="-5" r="0.35" fill="${apple}"/>` +
      `<circle cx="1.2" cy="-4" r="0.3" fill="${apple}"/>` +
      `<circle cx="-0.3" cy="-3.5" r="0.3" fill="${apple}"/>` +
      `<circle cx="0" cy="-5.5" r="0.3" fill="${apple}"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // With fallen apples
    return (
      `<g transform="translate(${x},${y})">` +
      `<rect x="-0.5" y="-1" width="1" height="3" fill="${trunk}"/>` +
      `<circle cx="0" cy="-4.5" r="2.3" fill="${leaf}"/>` +
      `<circle cx="-1.2" cy="-3.5" r="1.3" fill="${leaf}" opacity="0.9"/>` +
      `<circle cx="1.2" cy="-3.5" r="1.3" fill="${leaf}" opacity="0.85"/>` +
      `<circle cx="-0.5" cy="-4.5" r="0.3" fill="${apple}"/>` +
      `<circle cx="0.8" cy="-4" r="0.3" fill="${apple}"/>` +
      `<circle cx="-1.5" cy="0.3" r="0.25" fill="${apple}" opacity="0.8"/>` +
      `<circle cx="0.8" cy="0.5" r="0.25" fill="${apple}" opacity="0.75"/>` +
      `</g>`
    );
  }
  // Standard apple tree
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-0.5" y="-1" width="1" height="3" fill="${trunk}"/>` +
    `<circle cx="0" cy="-4.5" r="2.5" fill="${leaf}"/>` +
    `<circle cx="-1.5" cy="-3.5" r="1.5" fill="${leaf}" opacity="0.9"/>` +
    `<circle cx="1.5" cy="-3.5" r="1.5" fill="${leaf}" opacity="0.85"/>` +
    `<circle cx="-1" cy="-4.2" r="0.35" fill="${apple}"/>` +
    `<circle cx="0.6" cy="-5" r="0.35" fill="${apple}"/>` +
    `<circle cx="0" cy="-3.8" r="0.3" fill="${apple}"/>` +
    `</g>`
  );
}

function svgOliveTree(x: number, y: number, c: AssetColors, v: number): string {
  // Mediterranean olive tree with silver-green foliage
  /* v8 ignore start */
  const leaf = c.oliveGreen || '#808060';
  const fruit = c.oliveFruit || '#4a4a30';
  /* v8 ignore stop */
  const trunk = c.trunk;
  if (v === 1) {
    // Gnarled old tree
    return (
      `<g transform="translate(${x},${y})">` +
      `<path d="M-0.3,2 Q-0.8,0 -0.5,-1 Q-0.2,-2 0,-2" stroke="${trunk}" fill="none" stroke-width="0.8"/>` +
      `<path d="M0.3,2 Q0.8,0 0.5,-1 Q0.2,-2 0,-2" stroke="${trunk}" fill="none" stroke-width="0.8"/>` +
      `<ellipse cx="0" cy="-4" rx="2.5" ry="1.8" fill="${leaf}" opacity="0.7"/>` +
      `<ellipse cx="-1.5" cy="-3.5" rx="1.2" ry="0.9" fill="${leaf}" opacity="0.6"/>` +
      `<ellipse cx="1.5" cy="-3.5" rx="1.2" ry="0.9" fill="${leaf}" opacity="0.55"/>` +
      `<circle cx="-0.8" cy="-3.8" r="0.2" fill="${fruit}"/>` +
      `<circle cx="0.5" cy="-4.2" r="0.2" fill="${fruit}"/>` +
      `<circle cx="1" cy="-3.5" r="0.18" fill="${fruit}"/>` +
      `</g>`
    );
  }
  // Standard olive tree
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-0.4" y="-1" width="0.8" height="3" fill="${trunk}"/>` +
    `<ellipse cx="0" cy="-3.5" rx="2.2" ry="1.6" fill="${leaf}" opacity="0.7"/>` +
    `<ellipse cx="-1.2" cy="-3" rx="1" ry="0.8" fill="${leaf}" opacity="0.6"/>` +
    `<ellipse cx="1.2" cy="-3" rx="1" ry="0.8" fill="${leaf}" opacity="0.55"/>` +
    `<circle cx="-0.5" cy="-3.5" r="0.18" fill="${fruit}"/>` +
    `<circle cx="0.6" cy="-3.8" r="0.18" fill="${fruit}"/>` +
    `</g>`
  );
}

function svgLemonTree(x: number, y: number, c: AssetColors, v: number): string {
  // Lemon tree with bright yellow lemons
  const leaf = c.palm; // bright green
  /* v8 ignore start */
  const lemon = c.lemonYellow || '#fff44f';
  /* v8 ignore stop */
  const trunk = c.trunk;
  if (v === 1) {
    // Heavy with lemons
    return (
      `<g transform="translate(${x},${y})">` +
      `<rect x="-0.4" y="-1" width="0.8" height="2.5" fill="${trunk}"/>` +
      `<circle cx="0" cy="-3.5" r="2" fill="${leaf}"/>` +
      `<circle cx="-1" cy="-2.8" r="1.2" fill="${leaf}" opacity="0.9"/>` +
      `<circle cx="1" cy="-2.8" r="1.2" fill="${leaf}" opacity="0.85"/>` +
      `<ellipse cx="-0.8" cy="-3.5" rx="0.35" ry="0.25" fill="${lemon}"/>` +
      `<ellipse cx="0.5" cy="-4" rx="0.35" ry="0.25" fill="${lemon}"/>` +
      `<ellipse cx="0.8" cy="-3" rx="0.3" ry="0.22" fill="${lemon}"/>` +
      `<ellipse cx="-0.2" cy="-2.8" rx="0.3" ry="0.22" fill="${lemon}"/>` +
      `</g>`
    );
  }
  // Standard lemon tree
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-0.4" y="-1" width="0.8" height="2.5" fill="${trunk}"/>` +
    `<circle cx="0" cy="-3.5" r="2" fill="${leaf}"/>` +
    `<circle cx="-1" cy="-2.8" r="1.2" fill="${leaf}" opacity="0.9"/>` +
    `<circle cx="1" cy="-2.8" r="1.2" fill="${leaf}" opacity="0.85"/>` +
    `<ellipse cx="-0.5" cy="-3.5" rx="0.3" ry="0.22" fill="${lemon}"/>` +
    `<ellipse cx="0.6" cy="-3.8" rx="0.3" ry="0.22" fill="${lemon}"/>` +
    `</g>`
  );
}

function svgOrangeTree(x: number, y: number, c: AssetColors, v: number): string {
  // Orange tree with orange fruits
  const leaf = c.orchard; // dark green
  /* v8 ignore start */
  const orange = c.orangeFruit || '#ff8c00';
  /* v8 ignore stop */
  const trunk = c.trunk;
  if (v === 1) {
    // Many oranges
    return (
      `<g transform="translate(${x},${y})">` +
      `<rect x="-0.5" y="-1" width="1" height="3" fill="${trunk}"/>` +
      `<circle cx="0" cy="-4.2" r="2.3" fill="${leaf}"/>` +
      `<circle cx="-1.3" cy="-3.2" r="1.3" fill="${leaf}" opacity="0.9"/>` +
      `<circle cx="1.3" cy="-3.2" r="1.3" fill="${leaf}" opacity="0.85"/>` +
      `<circle cx="-0.8" cy="-4" r="0.4" fill="${orange}"/>` +
      `<circle cx="0.5" cy="-4.5" r="0.35" fill="${orange}"/>` +
      `<circle cx="1" cy="-3.5" r="0.35" fill="${orange}"/>` +
      `<circle cx="-0.2" cy="-3.2" r="0.3" fill="${orange}"/>` +
      `</g>`
    );
  }
  // Standard orange tree
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-0.5" y="-1" width="1" height="3" fill="${trunk}"/>` +
    `<circle cx="0" cy="-4.2" r="2.3" fill="${leaf}"/>` +
    `<circle cx="-1.3" cy="-3.2" r="1.3" fill="${leaf}" opacity="0.9"/>` +
    `<circle cx="1.3" cy="-3.2" r="1.3" fill="${leaf}" opacity="0.85"/>` +
    `<circle cx="-0.6" cy="-4" r="0.4" fill="${orange}"/>` +
    `<circle cx="0.7" cy="-4.3" r="0.35" fill="${orange}"/>` +
    `</g>`
  );
}

function svgPearTree(x: number, y: number, c: AssetColors, v: number): string {
  // Pear tree with pear-shaped fruits
  const leaf = c.orchard;
  /* v8 ignore start */
  const pear = c.pearGreen || '#d1e231';
  /* v8 ignore stop */
  const trunk = c.trunk;
  if (v === 1) {
    // Ripe pears
    return (
      `<g transform="translate(${x},${y})">` +
      `<rect x="-0.5" y="-1" width="1" height="3" fill="${trunk}"/>` +
      `<circle cx="0" cy="-4.5" r="2.5" fill="${leaf}"/>` +
      `<circle cx="-1.5" cy="-3.5" r="1.5" fill="${leaf}" opacity="0.9"/>` +
      `<circle cx="1.5" cy="-3.5" r="1.5" fill="${leaf}" opacity="0.85"/>` +
      `<path d="M-0.8,-4.3 Q-0.8,-4.8 -0.6,-4.8 Q-0.4,-4.8 -0.4,-4.3 Q-0.4,-3.8 -0.6,-3.6 Q-0.8,-3.8 -0.8,-4.3" fill="${pear}"/>` +
      `<path d="M0.6,-4.8 Q0.6,-5.3 0.8,-5.3 Q1,-5.3 1,-4.8 Q1,-4.3 0.8,-4.1 Q0.6,-4.3 0.6,-4.8" fill="${pear}"/>` +
      `<path d="M0.3,-3.5 Q0.3,-4 0.5,-4 Q0.7,-4 0.7,-3.5 Q0.7,-3 0.5,-2.8 Q0.3,-3 0.3,-3.5" fill="${pear}"/>` +
      `</g>`
    );
  }
  // Standard pear tree
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-0.5" y="-1" width="1" height="3" fill="${trunk}"/>` +
    `<circle cx="0" cy="-4.5" r="2.5" fill="${leaf}"/>` +
    `<circle cx="-1.5" cy="-3.5" r="1.5" fill="${leaf}" opacity="0.9"/>` +
    `<circle cx="1.5" cy="-3.5" r="1.5" fill="${leaf}" opacity="0.85"/>` +
    `<path d="M-0.6,-4.5 Q-0.6,-5 -0.4,-5 Q-0.2,-5 -0.2,-4.5 Q-0.2,-4 -0.4,-3.8 Q-0.6,-4 -0.6,-4.5" fill="${pear}"/>` +
    `<path d="M0.7,-4 Q0.7,-4.5 0.9,-4.5 Q1.1,-4.5 1.1,-4 Q1.1,-3.5 0.9,-3.3 Q0.7,-3.5 0.7,-4" fill="${pear}"/>` +
    `</g>`
  );
}

function svgPeachTree(x: number, y: number, c: AssetColors, v: number): string {
  // Peach tree with peach fruits
  const leaf = c.orchard;
  /* v8 ignore start */
  const peach = c.peachFruit || '#ffcba4';
  /* v8 ignore stop */
  const trunk = c.trunk;
  if (v === 1) {
    // Ripe peaches
    return (
      `<g transform="translate(${x},${y})">` +
      `<rect x="-0.5" y="-1" width="1" height="3" fill="${trunk}"/>` +
      `<circle cx="0" cy="-4" r="2.2" fill="${leaf}"/>` +
      `<circle cx="-1.2" cy="-3.2" r="1.3" fill="${leaf}" opacity="0.9"/>` +
      `<circle cx="1.2" cy="-3.2" r="1.3" fill="${leaf}" opacity="0.85"/>` +
      `<circle cx="-0.6" cy="-4" r="0.4" fill="${peach}"/>` +
      `<circle cx="0.5" cy="-4.3" r="0.35" fill="${peach}"/>` +
      `<circle cx="0.8" cy="-3.3" r="0.35" fill="${peach}"/>` +
      `</g>`
    );
  }
  // Standard peach tree
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-0.5" y="-1" width="1" height="3" fill="${trunk}"/>` +
    `<circle cx="0" cy="-4" r="2.2" fill="${leaf}"/>` +
    `<circle cx="-1.2" cy="-3.2" r="1.3" fill="${leaf}" opacity="0.9"/>` +
    `<circle cx="1.2" cy="-3.2" r="1.3" fill="${leaf}" opacity="0.85"/>` +
    `<circle cx="-0.5" cy="-4" r="0.35" fill="${peach}"/>` +
    `<circle cx="0.6" cy="-4.2" r="0.35" fill="${peach}"/>` +
    `</g>`
  );
}

function svgBeeFarm(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-1.5" y="-2.5" width="3" height="2.5" fill="${c.beeFarm}"/>` +
    `<rect x="-1.5" y="-2.5" width="3" height="0.8" fill="${c.beeFarm}" stroke="${c.trunk}" stroke-width="0.2"/>` +
    `<rect x="-1.5" y="-1.7" width="3" height="0.8" fill="${c.beeFarm}" stroke="${c.trunk}" stroke-width="0.2"/>` +
    `<polygon points="-1.5,-2.5 0,-3.5 1.5,-2.5" fill="${c.roofB}"/>` +
    `</g>`
  );
}

function svgPumpkin(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="0" cy="-0.8" rx="1.5" ry="1" fill="${c.pumpkin}"/>` +
    `<ellipse cx="-0.5" cy="-0.8" rx="0.8" ry="1" fill="${c.pumpkin}" opacity="0.6"/>` +
    `<ellipse cx="0.5" cy="-0.8" rx="0.8" ry="1" fill="${c.pumpkin}" opacity="0.6"/>` +
    `<line x1="0" y1="-1.8" x2="0.3" y2="-2.3" stroke="${c.pine}" stroke-width="0.3"/>` +
    `</g>`
  );
}

// ── New Village Assets ──────────────────────────────────────

function svgTavern(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<polygon points="-2.5,0 0,1.2 2.5,0 2.5,-3.5 0,-2.3 -2.5,-3.5" fill="${c.tavern}"/>` +
    `<polygon points="-2.5,0 0,1.2 0,-2.3 -2.5,-3.5" fill="${c.wallShade}"/>` +
    `<polygon points="0,-6 -3,-3.3 0,-2 3,-3.3" fill="${c.roofB}"/>` +
    `<rect x="3" y="-5" width="1.5" height="1.2" fill="${c.tavernSign}" rx="0.2"/>` +
    `<circle cx="3.75" cy="-4.4" r="0.3" fill="${c.wheat}"/>` +
    `</g>`
  );
}

function svgBakery(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-2.5" y="-3.5" width="5" height="3.5" fill="${c.bakery}"/>` +
    `<polygon points="-3,-3.5 0,-5.5 3,-3.5" fill="${c.roofA}"/>` +
    `<rect x="1.5" y="-6.5" width="0.8" height="1.5" fill="${c.chimney}"/>` +
    `<circle cx="1.9" cy="-7.5" r="0.6" fill="${c.smoke}">` +
    `<animate attributeName="cy" values="-7.5;-9.5;-7.5" dur="3s" repeatCount="indefinite"/>` +
    `<animate attributeName="opacity" values="0.4;0.1;0.4" dur="3s" repeatCount="indefinite"/>` +
    `</circle>` +
    `</g>`
  );
}

function svgStable(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-3" y="-3" width="6" height="3" fill="${c.stable}"/>` +
    `<polygon points="-3.5,-3 0,-5 3.5,-3" fill="${c.roofB}"/>` +
    `<rect x="-1" y="-2" width="2" height="2" fill="${c.trunk}" opacity="0.6"/>` +
    `</g>`
  );
}

function svgGarden(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-3" y="-0.3" width="6" height="0.3" fill="${c.gardenFence}" opacity="0.5"/>` +
    `<line x1="-3" y1="-0.3" x2="-3" y2="-1.5" stroke="${c.gardenFence}" stroke-width="0.3"/>` +
    `<line x1="3" y1="-0.3" x2="3" y2="-1.5" stroke="${c.gardenFence}" stroke-width="0.3"/>` +
    `<line x1="-3" y1="-1" x2="3" y2="-1" stroke="${c.gardenFence}" stroke-width="0.2"/>` +
    `<circle cx="-1.5" cy="-0.8" r="0.4" fill="${c.flower}"/>` +
    `<circle cx="0" cy="-0.6" r="0.35" fill="${c.wildflower}"/>` +
    `<circle cx="1.5" cy="-0.7" r="0.4" fill="${c.butterflyWing}"/>` +
    `</g>`
  );
}

function svgLaundry(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})" class="sway-slow">` +
    `<line x1="-3" y1="0" x2="-3" y2="-4" stroke="${c.trunk}" stroke-width="0.4"/>` +
    `<line x1="3" y1="0" x2="3" y2="-4" stroke="${c.trunk}" stroke-width="0.4"/>` +
    `<line x1="-3" y1="-3.5" x2="3" y2="-3.5" stroke="${c.trunk}" stroke-width="0.2"/>` +
    `<rect x="-2" y="-3.5" width="1.5" height="2" fill="${c.laundry}" rx="0.1"/>` +
    `<rect x="0" y="-3.5" width="1.2" height="1.8" fill="${c.sail}" rx="0.1"/>` +
    `</g>`
  );
}

function svgDoghouse(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-1.5" y="-2" width="3" height="2" fill="${c.doghouse}"/>` +
    `<polygon points="-1.8,-2 0,-3.2 1.8,-2" fill="${c.roofA}"/>` +
    `<ellipse cx="0" cy="-0.5" rx="0.5" ry="0.6" fill="${c.trunk}" opacity="0.6"/>` +
    `<ellipse cx="2.5" cy="-0.5" rx="0.7" ry="0.5" fill="${c.deer}"/>` +
    `</g>`
  );
}

function svgShrine(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-0.8" y="-3" width="1.6" height="3" fill="${c.shrine}"/>` +
    `<polygon points="-1.2,-3 0,-4.2 1.2,-3" fill="${c.shrine}"/>` +
    `<rect x="-0.3" y="-2.5" width="0.6" height="0.6" fill="${c.fountain}" rx="0.1"/>` +
    `</g>`
  );
}

function svgWagon(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-3" y="-3" width="5" height="2.5" fill="${c.wagon}"/>` +
    `<path d="M-3,-3 Q-1.5,-5 2,-3" stroke="${c.wagon}" fill="${c.sail}" opacity="0.5" stroke-width="0.3"/>` +
    `<circle cx="-2" cy="0" r="0.8" fill="${c.trunk}" stroke="${c.fence}" stroke-width="0.2"/>` +
    `<circle cx="1.5" cy="0" r="0.8" fill="${c.trunk}" stroke="${c.fence}" stroke-width="0.2"/>` +
    `</g>`
  );
}

// ── New Town/City Assets ────────────────────────────────────

function svgCathedral(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<polygon points="-3,0 0,1.5 3,0 3,-6 0,-4.5 -3,-6" fill="${c.cathedral}"/>` +
    `<polygon points="-3,0 0,1.5 0,-4.5 -3,-6" fill="${c.wallShade}"/>` +
    `<polygon points="0,-10 -3.5,-5.5 0,-4 3.5,-5.5" fill="${c.roofA}"/>` +
    `<circle cx="0" cy="-7" r="1" fill="${c.cathedralWindow}" opacity="0.7"/>` +
    `<line x1="0" y1="-12" x2="0" y2="-10" stroke="${c.wall}" stroke-width="0.5"/>` +
    `<line x1="-0.8" y1="-11" x2="0.8" y2="-11" stroke="${c.wall}" stroke-width="0.4"/>` +
    `</g>`
  );
}

function svgLibrary(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-2.5" y="-4" width="5" height="4" fill="${c.library}"/>` +
    `<polygon points="-3,-4 0,-6 3,-4" fill="${c.roofB}"/>` +
    `<rect x="-1.5" y="-3.5" width="1" height="1.5" fill="${c.blacksmith}" rx="0.2"/>` +
    `<rect x="0.5" y="-3.5" width="1" height="1.5" fill="${c.blacksmith}" rx="0.2"/>` +
    `</g>`
  );
}

function svgClocktower(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-1.5" y="-10" width="3" height="10" fill="${c.clocktower}"/>` +
    `<polygon points="-2,-10 0,-12.5 2,-10" fill="${c.castleRoof}"/>` +
    `<circle cx="0" cy="-8" r="1.2" fill="${c.clockFace}"/>` +
    `<g>` +
    `<line x1="0" y1="-8" x2="0" y2="-9" stroke="${c.bird}" stroke-width="0.3"/>` +
    `<animateTransform attributeName="transform" type="rotate" values="-15 0 -8;15 0 -8;-15 0 -8" dur="4s" repeatCount="indefinite"/>` +
    `</g>` +
    `<line x1="0" y1="-8" x2="0.6" y2="-7.5" stroke="${c.bird}" stroke-width="0.2"/>` +
    `</g>`
  );
}

function svgStatue(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-1" y="-1.5" width="2" height="1.5" fill="${c.rock}"/>` +
    `<rect x="-0.6" y="-4" width="1.2" height="2.5" fill="${c.statue}"/>` +
    `<circle cx="0" cy="-4.5" r="0.6" fill="${c.statue}"/>` +
    `</g>`
  );
}

function svgPark(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<line x1="2" y1="0" x2="2" y2="-3" stroke="${c.trunk}" stroke-width="0.5"/>` +
    `<circle cx="2" cy="-4.5" r="2" fill="${c.gardenTree}"/>` +
    `<rect x="-3" y="-1" width="3" height="0.5" fill="${c.parkBench}"/>` +
    `<line x1="-3" y1="-1" x2="-3" y2="0" stroke="${c.parkBench}" stroke-width="0.3"/>` +
    `<line x1="0" y1="-1" x2="0" y2="0" stroke="${c.parkBench}" stroke-width="0.3"/>` +
    `</g>`
  );
}

function svgWarehouse(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-3.5" y="-3.5" width="7" height="3.5" fill="${c.warehouse}"/>` +
    `<polygon points="-4,-3.5 0,-5.5 4,-3.5" fill="${c.roofA}" opacity="0.8"/>` +
    `<rect x="-1" y="-2" width="2" height="2" fill="${c.blacksmith}" opacity="0.5"/>` +
    `</g>`
  );
}

function svgGatehouse(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-2" y="-6" width="4" height="6" fill="${c.gatehouse}"/>` +
    `<rect x="-1" y="-4" width="2" height="4" fill="${c.blacksmith}" rx="1" ry="0"/>` +
    `<rect x="-3" y="-7" width="2" height="1.5" fill="${c.tower}"/>` +
    `<rect x="1" y="-7" width="2" height="1.5" fill="${c.tower}"/>` +
    `</g>`
  );
}

function svgManor(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<polygon points="-3.5,0 0,1.8 3.5,0 3.5,-4.5 0,-2.7 -3.5,-4.5" fill="${c.manor}"/>` +
    `<polygon points="-3.5,0 0,1.8 0,-2.7 -3.5,-4.5" fill="${c.wallShade}"/>` +
    `<polygon points="0,-7.5 -4,-4.2 0,-2.5 4,-4.2" fill="${c.roofA}"/>` +
    `<rect x="1.5" y="-7.5" width="1" height="1.5" fill="${c.chimney}"/>` +
    `<rect x="-3.5" y="-0.5" width="1" height="0.5" fill="${c.manorGarden}"/>` +
    `</g>`
  );
}

// ── New Cross-level Assets ──────────────────────────────────

function svgSignpost(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<line x1="0" y1="0" x2="0" y2="-5" stroke="${c.signpost}" stroke-width="0.5"/>` +
    `<rect x="0" y="-5" width="2.5" height="0.8" fill="${c.signpost}" rx="0.1"/>` +
    `<rect x="-2.5" y="-4" width="2.5" height="0.8" fill="${c.signpost}" rx="0.1"/>` +
    `</g>`
  );
}

function svgLantern(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<line x1="0" y1="0" x2="0" y2="-4" stroke="${c.lantern}" stroke-width="0.4"/>` +
    `<rect x="-0.5" y="-5" width="1" height="1" fill="${c.lantern}"/>` +
    `<rect x="-0.3" y="-4.8" width="0.6" height="0.6" fill="${c.lanternGlow}" opacity="0.8"/>` +
    `<circle cx="0" cy="-4.5" r="1" fill="${c.lanternGlow}" opacity="0.15"/>` +
    `</g>`
  );
}

function svgWoodpile(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-2" y="-1.5" width="4" height="1.5" fill="${c.woodpile}"/>` +
    `<rect x="-1.8" y="-2.5" width="3.6" height="1" fill="${c.woodpile}"/>` +
    `<ellipse cx="-2" cy="-0.75" rx="0.4" ry="0.75" fill="${c.trunk}"/>` +
    `<ellipse cx="2" cy="-0.75" rx="0.4" ry="0.75" fill="${c.trunk}"/>` +
    `</g>`
  );
}

function svgPuddle(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="0" cy="-0.2" rx="2" ry="0.7" fill="${c.puddle}" opacity="0.4"/>` +
    `<ellipse cx="0.3" cy="-0.3" rx="1.2" ry="0.4" fill="${c.puddle}" opacity="0.25"/>` +
    `</g>`
  );
}

function svgCampfire(x: number, y: number, c: AssetColors, v: number): string {
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="0" cy="-0.2" rx="1.5" ry="0.5" fill="${c.rock}" opacity="0.5"/>` +
    `<line x1="-1" y1="-0.3" x2="0" y2="-0.8" stroke="${c.campfire}" stroke-width="0.4"/>` +
    `<line x1="1" y1="-0.3" x2="0" y2="-0.8" stroke="${c.campfire}" stroke-width="0.4"/>` +
    `<ellipse cx="0" cy="-1.8" rx="0.8" ry="1.2" fill="${c.campfireFlame}" opacity="0.8">` +
    `<animate attributeName="opacity" values="0.8;0.5;0.8" dur="1.5s" repeatCount="indefinite"/>` +
    `</ellipse>` +
    `<ellipse cx="0" cy="-2" rx="0.4" ry="0.7" fill="${c.lanternGlow}" opacity="0.9"/>` +
    `</g>`
  );
}

// ── Seasonal SVG Renderers ───────────────────────────────────

// ── Winter Assets ──────────────────────────────────────────

function svgSnowPine(x: number, y: number, c: AssetColors, v: number): string {
  const snow = c.snowCap;
  const trunk = c.trunk;
  /* v8 ignore start */
  const icicle = c.icicleBlue || '#d0e8f8';
  /* v8 ignore stop */
  if (v === 1) {
    // Heavy snow with icicles
    return (
      `<g transform="translate(${x},${y})">` +
      `<rect x="-0.5" y="-1" width="1" height="3" fill="${trunk}"/>` +
      `<polygon points="0,-8 -3,-2 3,-2" fill="${c.pine}" opacity="0.6"/>` +
      `<polygon points="0,-8 -3,-2 3,-2" fill="${snow}" opacity="0.55"/>` +
      `<polygon points="0,-6 -2.5,-1.5 2.5,-1.5" fill="${snow}" opacity="0.6"/>` +
      `<ellipse cx="0" cy="-8" rx="1.5" ry="0.5" fill="${snow}"/>` +
      `<line x1="-2" y1="-3" x2="-2" y2="-2" stroke="${icicle}" stroke-width="0.12"/>` +
      `<line x1="-1" y1="-4" x2="-1" y2="-3" stroke="${icicle}" stroke-width="0.1"/>` +
      `<line x1="1.5" y1="-3.5" x2="1.5" y2="-2.5" stroke="${icicle}" stroke-width="0.12"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // Frosted blue with more detail
    return (
      `<g transform="translate(${x},${y})">` +
      `<rect x="-0.5" y="-1" width="1" height="3" fill="${trunk}"/>` +
      `<polygon points="0,-7.5 -3.5,-1 3.5,-1" fill="${c.ice}" opacity="0.5"/>` +
      `<polygon points="0,-6 -2.5,-2 2.5,-2" fill="${c.pine}" opacity="0.4"/>` +
      `<polygon points="0,-7.5 -2.5,-2.5 2.5,-2.5" fill="${snow}" opacity="0.45"/>` +
      `<ellipse cx="0" cy="-7.5" rx="1.2" ry="0.4" fill="${snow}"/>` +
      `<ellipse cx="-2" cy="-2.5" rx="0.8" ry="0.25" fill="${snow}" opacity="0.5"/>` +
      `<ellipse cx="2" cy="-2.5" rx="0.8" ry="0.25" fill="${snow}" opacity="0.5"/>` +
      `</g>`
    );
  }
  // Light snow with subtle icicles
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-0.5" y="-1" width="1" height="3" fill="${trunk}"/>` +
    `<polygon points="0,-7 -3,-1 3,-1" fill="${c.pine}"/>` +
    `<polygon points="0,-7 -1.5,-4 1.5,-4" fill="${snow}" opacity="0.45"/>` +
    `<ellipse cx="0.5" cy="-6" rx="1" ry="0.3" fill="${snow}" opacity="0.5"/>` +
    `<ellipse cx="-1.5" cy="-3" rx="0.7" ry="0.25" fill="${snow}" opacity="0.4"/>` +
    `<line x1="-2" y1="-2.5" x2="-2" y2="-1.8" stroke="${icicle}" stroke-width="0.08" opacity="0.7"/>` +
    `<line x1="2" y1="-2.5" x2="2" y2="-1.8" stroke="${icicle}" stroke-width="0.08" opacity="0.7"/>` +
    `</g>`
  );
}

function svgSnowDeciduous(x: number, y: number, c: AssetColors, v: number): string {
  const branch = c.bareBranch;
  const snow = c.snowCap;
  if (v === 1) {
    // Thin/tall
    return (
      `<g transform="translate(${x},${y})">` +
      `<line x1="0" y1="2" x2="0" y2="-5" stroke="${branch}" stroke-width="0.8"/>` +
      `<line x1="0" y1="-2" x2="-2" y2="-4" stroke="${branch}" stroke-width="0.4"/>` +
      `<line x1="0" y1="-3" x2="1.5" y2="-5" stroke="${branch}" stroke-width="0.4"/>` +
      `<line x1="0" y1="-1" x2="2" y2="-2.5" stroke="${branch}" stroke-width="0.4"/>` +
      `<ellipse cx="-1.5" cy="-4.2" rx="1" ry="0.4" fill="${snow}" opacity="0.6"/>` +
      `<ellipse cx="1.2" cy="-5.2" rx="0.8" ry="0.3" fill="${snow}" opacity="0.5"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // Wide/old
    return (
      `<g transform="translate(${x},${y})">` +
      `<rect x="-0.6" y="-1" width="1.2" height="3.5" fill="${branch}"/>` +
      `<line x1="0" y1="-1" x2="-3" y2="-3.5" stroke="${branch}" stroke-width="0.6"/>` +
      `<line x1="0" y1="-1.5" x2="2.5" y2="-4" stroke="${branch}" stroke-width="0.6"/>` +
      `<line x1="0" y1="0" x2="-2.5" y2="-1.5" stroke="${branch}" stroke-width="0.5"/>` +
      `<line x1="0" y1="0" x2="3" y2="-2" stroke="${branch}" stroke-width="0.5"/>` +
      `<ellipse cx="-2.5" cy="-3.7" rx="1.2" ry="0.5" fill="${snow}" opacity="0.55"/>` +
      `<ellipse cx="2" cy="-4.2" rx="1" ry="0.4" fill="${snow}" opacity="0.5"/>` +
      `<ellipse cx="0" cy="-2" rx="1.5" ry="0.4" fill="${snow}" opacity="0.4"/>` +
      `</g>`
    );
  }
  // Single tree
  return (
    `<g transform="translate(${x},${y})">` +
    `<line x1="0" y1="2" x2="0" y2="-4" stroke="${branch}" stroke-width="0.7"/>` +
    `<line x1="0" y1="-1.5" x2="-2.5" y2="-3.5" stroke="${branch}" stroke-width="0.4"/>` +
    `<line x1="0" y1="-2.5" x2="2" y2="-4.5" stroke="${branch}" stroke-width="0.4"/>` +
    `<line x1="0" y1="-0.5" x2="2" y2="-2" stroke="${branch}" stroke-width="0.4"/>` +
    `<ellipse cx="-2" cy="-3.7" rx="1" ry="0.35" fill="${snow}" opacity="0.5"/>` +
    `<ellipse cx="1.8" cy="-4.7" rx="0.8" ry="0.3" fill="${snow}" opacity="0.5"/>` +
    `</g>`
  );
}

function svgSnowman(x: number, y: number, c: AssetColors, v: number): string {
  const body = c.snowCap;
  const coal = c.snowmanCoal;
  const carrot = c.snowmanCarrot;
  const scarf = c.scarfRed;
  if (v === 1) {
    // With broom
    return (
      `<g transform="translate(${x},${y})">` +
      `<circle cx="0" cy="0" r="2.2" fill="${body}"/>` +
      `<circle cx="0" cy="-2.8" r="1.6" fill="${body}"/>` +
      `<circle cx="0" cy="-4.8" r="1.1" fill="${body}"/>` +
      `<circle cx="-0.4" cy="-5" r="0.2" fill="${coal}"/>` +
      `<circle cx="0.4" cy="-5" r="0.2" fill="${coal}"/>` +
      `<polygon points="0,-4.8 1.2,-4.6 0,-4.5" fill="${carrot}"/>` +
      `<rect x="-1" y="-3.6" width="2" height="0.4" rx="0.2" fill="${scarf}"/>` +
      `<line x1="2" y1="-3" x2="3.5" y2="-6" stroke="${c.bareBranch}" stroke-width="0.4"/>` +
      `<line x1="3.2" y1="-5.5" x2="3.8" y2="-6.5" stroke="${c.bareBranch}" stroke-width="0.3"/>` +
      `<line x1="3.2" y1="-5.5" x2="3.8" y2="-5.2" stroke="${c.bareBranch}" stroke-width="0.3"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // Melting
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="0" cy="0.5" rx="2.8" ry="1.5" fill="${body}"/>` +
      `<circle cx="0" cy="-1.5" r="1.8" fill="${body}"/>` +
      `<circle cx="0" cy="-3.2" r="1" fill="${body}"/>` +
      `<circle cx="-0.3" cy="-3.4" r="0.15" fill="${coal}"/>` +
      `<circle cx="0.3" cy="-3.4" r="0.15" fill="${coal}"/>` +
      `<polygon points="0,-3.2 1,-3 0,-2.9" fill="${carrot}"/>` +
      `<ellipse cx="0" cy="1.5" rx="3" ry="0.5" fill="${c.ice}" opacity="0.3"/>` +
      `</g>`
    );
  }
  // Classic
  return (
    `<g transform="translate(${x},${y})">` +
    `<circle cx="0" cy="0" r="2" fill="${body}"/>` +
    `<circle cx="0" cy="-2.5" r="1.5" fill="${body}"/>` +
    `<circle cx="0" cy="-4.3" r="1" fill="${body}"/>` +
    `<circle cx="-0.35" cy="-4.5" r="0.18" fill="${coal}"/>` +
    `<circle cx="0.35" cy="-4.5" r="0.18" fill="${coal}"/>` +
    `<polygon points="0,-4.3 1.2,-4.1 0,-4" fill="${carrot}"/>` +
    `<circle cx="0" cy="-2.2" r="0.15" fill="${coal}"/>` +
    `<circle cx="0" cy="-2.7" r="0.15" fill="${coal}"/>` +
    `<rect x="-1" y="-3.2" width="2" height="0.35" rx="0.15" fill="${scarf}"/>` +
    `<rect x="-1.2" y="-5.5" width="2.4" height="0.5" fill="${coal}"/>` +
    `<rect x="-0.8" y="-6" width="1.6" height="0.6" fill="${coal}"/>` +
    `</g>`
  );
}

function svgHouseWinter(x: number, y: number, c: AssetColors, v: number): string {
  // House with snow on roof and warm window glow
  const snow = c.snowCap;
  const warmGlow = '#ffa040';
  if (v === 1) {
    // With icicles
    return (
      `<g transform="translate(${x},${y})">` +
      `<polygon points="-2.5,0 0,1.2 2.5,0 2.5,-3 0,-1.8 -2.5,-3" fill="${c.wall}"/>` +
      `<polygon points="-2.5,0 0,1.2 0,-1.8 -2.5,-3" fill="${c.wallShade}"/>` +
      `<polygon points="0,-6 -3.2,-2.8 0,-1.5 3.2,-2.8" fill="${c.roofA}"/>` +
      `<polygon points="0,-6.3 -3.4,-2.6 -3.2,-2.8 0,-6" fill="${snow}" opacity="0.9"/>` +
      `<polygon points="0,-6.3 3.4,-2.6 3.2,-2.8 0,-6" fill="${snow}" opacity="0.85"/>` +
      `<rect x="1" y="-6.5" width="1" height="2" fill="${c.chimney}"/>` +
      `<ellipse cx="1.5" cy="-6.8" rx="0.6" ry="0.25" fill="${snow}"/>` +
      /* v8 ignore start */
      `<line x1="-2.8" y1="-2.5" x2="-2.8" y2="-1.8" stroke="${c.icicleBlue || '#d0e8f8'}" stroke-width="0.15"/>` +
      `<line x1="-2.2" y1="-2.3" x2="-2.2" y2="-1.5" stroke="${c.icicleBlue || '#d0e8f8'}" stroke-width="0.12"/>` +
      `<line x1="2.5" y1="-2.4" x2="2.5" y2="-1.6" stroke="${c.icicleBlue || '#d0e8f8'}" stroke-width="0.15"/>` +
      /* v8 ignore stop */
      `<rect x="-1" y="-1.5" width="0.6" height="0.6" fill="${warmGlow}" opacity="0.6"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // Heavy snow
    return (
      `<g transform="translate(${x},${y})">` +
      `<polygon points="-2.5,0 0,1.2 2.5,0 2.5,-3 0,-1.8 -2.5,-3" fill="${c.wall}"/>` +
      `<polygon points="-2.5,0 0,1.2 0,-1.8 -2.5,-3" fill="${c.wallShade}"/>` +
      `<polygon points="0,-6 -3.2,-2.8 0,-1.5 3.2,-2.8" fill="${c.roofA}"/>` +
      `<polygon points="0,-6.5 -3.5,-2.5 -3.2,-2.8 0,-6" fill="${snow}"/>` +
      `<polygon points="0,-6.5 3.5,-2.5 3.2,-2.8 0,-6" fill="${snow}" opacity="0.95"/>` +
      `<ellipse cx="-2" cy="-2.6" rx="0.8" ry="0.3" fill="${snow}"/>` +
      `<ellipse cx="2" cy="-2.6" rx="0.8" ry="0.3" fill="${snow}"/>` +
      `<rect x="1" y="-6.5" width="1" height="2" fill="${c.chimney}"/>` +
      `<ellipse cx="1.5" cy="-6.8" rx="0.8" ry="0.35" fill="${snow}"/>` +
      `</g>`
    );
  }
  // Default: light snow
  return (
    `<g transform="translate(${x},${y})">` +
    `<polygon points="-2.5,0 0,1.2 2.5,0 2.5,-3 0,-1.8 -2.5,-3" fill="${c.wall}"/>` +
    `<polygon points="-2.5,0 0,1.2 0,-1.8 -2.5,-3" fill="${c.wallShade}"/>` +
    `<polygon points="0,-6 -3.2,-2.8 0,-1.5 3.2,-2.8" fill="${c.roofA}"/>` +
    `<polygon points="0,-6.2 -3.3,-2.7 -3.2,-2.8 0,-6" fill="${snow}" opacity="0.85"/>` +
    `<polygon points="0,-6.2 3.3,-2.7 3.2,-2.8 0,-6" fill="${snow}" opacity="0.8"/>` +
    `<rect x="1" y="-6.5" width="1" height="2" fill="${c.chimney}"/>` +
    `<ellipse cx="1.5" cy="-6.7" rx="0.5" ry="0.2" fill="${snow}"/>` +
    `<rect x="-0.8" y="-1.3" width="0.5" height="0.5" fill="${warmGlow}" opacity="0.5"/>` +
    `</g>`
  );
}

function svgHouseBWinter(x: number, y: number, c: AssetColors, v: number): string {
  return svgHouseWinter(x, y, c, v);
}

function svgBarnWinter(x: number, y: number, c: AssetColors, v: number): string {
  // Barn with snow on roof
  const snow = c.snowCap;
  if (v === 1) {
    // Large barn with heavy snow
    return (
      `<g transform="translate(${x},${y})">` +
      `<polygon points="-4,0 0,2 4,0 4,-4.5 0,-2.5 -4,-4.5" fill="${c.roofA}" opacity="0.9"/>` +
      `<polygon points="-4,0 0,2 0,-2.5 -4,-4.5" fill="${c.wallShade}"/>` +
      `<polygon points="0,-7.5 -4.5,-4 0,-2.2 4.5,-4" fill="${c.roofA}"/>` +
      `<polygon points="0,-7.8 -4.7,-3.8 -4.5,-4 0,-7.5" fill="${snow}"/>` +
      `<polygon points="0,-7.8 4.7,-3.8 4.5,-4 0,-7.5" fill="${snow}" opacity="0.95"/>` +
      `<ellipse cx="-3.5" cy="-4" rx="1" ry="0.35" fill="${snow}"/>` +
      `<ellipse cx="3.5" cy="-4" rx="1" ry="0.35" fill="${snow}"/>` +
      `<rect x="-0.5" y="-1.5" width="1" height="1.5" fill="${c.trunk}" opacity="0.5"/>` +
      `</g>`
    );
  }
  // Default barn with snow
  return (
    `<g transform="translate(${x},${y})">` +
    `<polygon points="-3,0 0,1.5 3,0 3,-3.5 0,-2 -3,-3.5" fill="${c.roofA}" opacity="0.8"/>` +
    `<polygon points="-3,0 0,1.5 0,-2 -3,-3.5" fill="${c.wallShade}"/>` +
    `<polygon points="0,-6 -3.5,-3.2 0,-1.8 3.5,-3.2" fill="${c.roofA}"/>` +
    `<polygon points="0,-6.3 -3.7,-3 -3.5,-3.2 0,-6" fill="${snow}"/>` +
    `<polygon points="0,-6.3 3.7,-3 3.5,-3.2 0,-6" fill="${snow}" opacity="0.9"/>` +
    `<ellipse cx="0" cy="-6" rx="0.5" ry="0.2" fill="${snow}"/>` +
    `</g>`
  );
}

function svgChurchWinter(x: number, y: number, c: AssetColors, v: number): string {
  // Church with snow on roof and steeple
  const snow = c.snowCap;
  if (v === 1) {
    // Bell tower with snow
    return (
      `<g transform="translate(${x},${y})">` +
      `<polygon points="-2,0 0,1 2,0 2,-5 0,-4 -2,-5" fill="${c.church}"/>` +
      `<polygon points="-2,0 0,1 0,-4 -2,-5" fill="${c.wallShade}"/>` +
      `<rect x="-1" y="-8.5" width="2" height="3.5" fill="${c.church}"/>` +
      `<polygon points="-1.3,-8.5 0,-10.5 1.3,-8.5" fill="${c.roofA}"/>` +
      `<polygon points="-1.4,-8.3 0,-10.8 0,-10.5 -1.3,-8.5" fill="${snow}"/>` +
      `<polygon points="1.4,-8.3 0,-10.8 0,-10.5 1.3,-8.5" fill="${snow}" opacity="0.9"/>` +
      `<ellipse cx="0" cy="-8.5" rx="1.2" ry="0.3" fill="${snow}"/>` +
      `<circle cx="0" cy="-7" r="0.4" fill="${c.blacksmith}" opacity="0.5"/>` +
      `</g>`
    );
  }
  // Default church with snow
  return (
    `<g transform="translate(${x},${y})">` +
    `<polygon points="-2,0 0,1 2,0 2,-5 0,-4 -2,-5" fill="${c.church}"/>` +
    `<polygon points="-2,0 0,1 0,-4 -2,-5" fill="${c.wallShade}"/>` +
    `<polygon points="0,-10 -2.5,-5 0,-3.8 2.5,-5" fill="${c.roofA}"/>` +
    `<polygon points="0,-10.4 -2.7,-4.8 -2.5,-5 0,-10" fill="${snow}"/>` +
    `<polygon points="0,-10.4 2.7,-4.8 2.5,-5 0,-10" fill="${snow}" opacity="0.9"/>` +
    `<ellipse cx="0" cy="-5" rx="2" ry="0.4" fill="${snow}"/>` +
    `<line x1="0" y1="-12" x2="0" y2="-10" stroke="${c.wall}" stroke-width="0.5"/>` +
    `<line x1="-1" y1="-11" x2="1" y2="-11" stroke="${c.wall}" stroke-width="0.5"/>` +
    `</g>`
  );
}

function svgChristmasTree(x: number, y: number, c: AssetColors, v: number): string {
  // Decorated Christmas tree with star and ornaments
  /* v8 ignore start */
  const tree = c.christmasGreen || '#228b22';
  const star = c.christmasGold || '#ffd700';
  const red = c.christmasRed || '#c41e3a';
  const blue = c.icicleBlue || '#d0e8f8';
  const gold = c.christmasGold || '#ffd700';
  /* v8 ignore stop */
  if (v === 1) {
    // With presents underneath
    return (
      `<g transform="translate(${x},${y})">` +
      `<rect x="-0.3" y="-1" width="0.6" height="2" fill="${c.trunk}"/>` +
      `<polygon points="0,-7 -2.5,-1 2.5,-1" fill="${tree}"/>` +
      `<polygon points="0,-5.5 -2,-1.5 2,-1.5" fill="${tree}" opacity="0.9"/>` +
      `<polygon points="0,-4 -1.5,-2 1.5,-2" fill="${tree}" opacity="0.85"/>` +
      `<polygon points="-0.3,-7.5 0,-8 0.3,-7.5 0.1,-7.5 0.1,-7 -0.1,-7 -0.1,-7.5" fill="${star}"/>` +
      `<circle cx="-1" cy="-3" r="0.25" fill="${red}"/>` +
      `<circle cx="0.8" cy="-2.5" r="0.2" fill="${blue}"/>` +
      `<circle cx="-0.5" cy="-4.5" r="0.2" fill="${gold}"/>` +
      `<circle cx="0.5" cy="-5" r="0.25" fill="${red}"/>` +
      `<rect x="-1.5" y="0.5" width="0.8" height="0.6" fill="${red}"/>` +
      `<rect x="0.5" y="0.3" width="0.7" height="0.5" fill="${blue}"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // With string lights
    return (
      `<g transform="translate(${x},${y})">` +
      `<rect x="-0.3" y="-1" width="0.6" height="2" fill="${c.trunk}"/>` +
      `<polygon points="0,-7 -2.5,-1 2.5,-1" fill="${tree}"/>` +
      `<polygon points="0,-5.5 -2,-1.5 2,-1.5" fill="${tree}" opacity="0.9"/>` +
      `<polygon points="-0.3,-7.5 0,-8 0.3,-7.5 0.1,-7.5 0.1,-7 -0.1,-7 -0.1,-7.5" fill="${star}"/>` +
      `<circle cx="-1.5" cy="-2" r="0.15" fill="${red}"/>` +
      `<circle cx="-0.5" cy="-2.5" r="0.15" fill="${gold}"/>` +
      `<circle cx="0.5" cy="-2" r="0.15" fill="${blue}"/>` +
      `<circle cx="1.5" cy="-2.5" r="0.15" fill="${red}"/>` +
      `<circle cx="-1" cy="-4" r="0.15" fill="${blue}"/>` +
      `<circle cx="0" cy="-3.5" r="0.15" fill="${gold}"/>` +
      `<circle cx="1" cy="-4" r="0.15" fill="${red}"/>` +
      `<circle cx="-0.5" cy="-5.5" r="0.15" fill="${gold}"/>` +
      `<circle cx="0.5" cy="-5" r="0.15" fill="${blue}"/>` +
      `</g>`
    );
  }
  // Classic decorated tree
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-0.3" y="-1" width="0.6" height="2" fill="${c.trunk}"/>` +
    `<polygon points="0,-7 -2.5,-1 2.5,-1" fill="${tree}"/>` +
    `<polygon points="0,-5.5 -2,-1.5 2,-1.5" fill="${tree}" opacity="0.9"/>` +
    `<polygon points="0,-4 -1.5,-2 1.5,-2" fill="${tree}" opacity="0.85"/>` +
    `<polygon points="-0.3,-7.5 0,-8.2 0.3,-7.5 0.1,-7.5 0.1,-7 -0.1,-7 -0.1,-7.5" fill="${star}"/>` +
    `<circle cx="-1.2" cy="-2.5" r="0.3" fill="${red}"/>` +
    `<circle cx="1" cy="-3" r="0.25" fill="${gold}"/>` +
    `<circle cx="-0.3" cy="-4" r="0.25" fill="${blue}"/>` +
    `<circle cx="0.7" cy="-5" r="0.2" fill="${red}"/>` +
    `<circle cx="-0.5" cy="-5.8" r="0.2" fill="${gold}"/>` +
    `</g>`
  );
}

function svgWinterLantern(x: number, y: number, c: AssetColors, v: number): string {
  // Lamppost with warm glow and snow cap
  const post = c.lantern;
  const glow = c.lanternGlow;
  const snow = c.snowCap;
  if (v === 1) {
    // Double lantern
    return (
      `<g transform="translate(${x},${y})">` +
      `<line x1="0" y1="0" x2="0" y2="-5" stroke="${post}" stroke-width="0.4"/>` +
      `<line x1="0" y1="-4.5" x2="-1.5" y2="-4.5" stroke="${post}" stroke-width="0.25"/>` +
      `<line x1="0" y1="-4.5" x2="1.5" y2="-4.5" stroke="${post}" stroke-width="0.25"/>` +
      `<rect x="-2" y="-5.5" width="1" height="1" fill="${glow}" opacity="0.8"/>` +
      `<rect x="1" y="-5.5" width="1" height="1" fill="${glow}" opacity="0.8"/>` +
      `<ellipse cx="-1.5" cy="-5.7" rx="0.6" ry="0.2" fill="${snow}"/>` +
      `<ellipse cx="1.5" cy="-5.7" rx="0.6" ry="0.2" fill="${snow}"/>` +
      `<circle cx="-1.5" cy="-5" r="0.8" fill="${glow}" opacity="0.3"/>` +
      `<circle cx="1.5" cy="-5" r="0.8" fill="${glow}" opacity="0.3"/>` +
      `</g>`
    );
  }
  // Single lantern
  return (
    `<g transform="translate(${x},${y})">` +
    `<line x1="0" y1="0" x2="0" y2="-5" stroke="${post}" stroke-width="0.35"/>` +
    `<rect x="-0.5" y="-6" width="1" height="1.2" fill="${glow}" opacity="0.8"/>` +
    `<ellipse cx="0" cy="-6.2" rx="0.6" ry="0.25" fill="${snow}"/>` +
    `<circle cx="0" cy="-5.4" r="1" fill="${glow}" opacity="0.25"/>` +
    `<ellipse cx="0" cy="0" rx="0.8" ry="0.3" fill="${snow}" opacity="0.5"/>` +
    `</g>`
  );
}

function svgFrozenFountain(x: number, y: number, c: AssetColors, v: number): string {
  // Fountain with ice formations instead of water
  const stone = c.fountain;
  const ice = c.ice;
  /* v8 ignore start */
  const icicle = c.icicleBlue || '#d0e8f8';
  /* v8 ignore stop */
  if (v === 1) {
    // Heavily frozen
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="0" cy="0" rx="2.5" ry="1" fill="${stone}"/>` +
      `<ellipse cx="0" cy="-0.3" rx="2" ry="0.7" fill="${ice}" opacity="0.7"/>` +
      `<rect x="-0.4" y="-3" width="0.8" height="3" fill="${stone}"/>` +
      `<ellipse cx="0" cy="-3" rx="1" ry="0.4" fill="${stone}"/>` +
      `<polygon points="0,-5 -0.3,-3 0.3,-3" fill="${ice}"/>` +
      `<polygon points="-0.5,-4 -0.2,-3 -0.8,-3" fill="${icicle}"/>` +
      `<polygon points="0.5,-4.5 0.2,-3 0.8,-3" fill="${icicle}"/>` +
      `<polygon points="-1.5,-1 -1.5,-0.3 -1.3,-0.3" fill="${icicle}" opacity="0.8"/>` +
      `<polygon points="1.5,-1.2 1.5,-0.3 1.3,-0.3" fill="${icicle}" opacity="0.8"/>` +
      `</g>`
    );
  }
  // Light ice
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="0" cy="0" rx="2.5" ry="1" fill="${stone}"/>` +
    `<ellipse cx="0" cy="-0.3" rx="2" ry="0.7" fill="${ice}" opacity="0.6"/>` +
    `<rect x="-0.4" y="-3" width="0.8" height="3" fill="${stone}"/>` +
    `<ellipse cx="0" cy="-3" rx="1" ry="0.4" fill="${stone}"/>` +
    `<polygon points="-0.4,-3.8 -0.1,-3 -0.7,-3" fill="${icicle}" opacity="0.7"/>` +
    `<polygon points="0.4,-4 0.1,-3 0.7,-3" fill="${icicle}" opacity="0.7"/>` +
    `</g>`
  );
}

function svgSnowdrift(x: number, y: number, c: AssetColors, v: number): string {
  const snow = c.snowCap;
  if (v === 1) {
    // Large
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="0" cy="0" rx="3.5" ry="1.2" fill="${snow}"/>` +
      `<ellipse cx="-1" cy="-0.5" rx="2" ry="0.8" fill="${c.frostWhite}" opacity="0.6"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // Wind-shaped
    return (
      `<g transform="translate(${x},${y})">` +
      `<path d="M-3,0 Q-1,-1.5 2,-0.5 Q3,0 3.5,0.3" fill="${snow}" stroke="none"/>` +
      `<ellipse cx="0" cy="0.2" rx="3" ry="0.6" fill="${snow}" opacity="0.8"/>` +
      `</g>`
    );
  }
  // Small
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="0" cy="0" rx="2" ry="0.8" fill="${snow}"/>` +
    `<ellipse cx="0.3" cy="-0.3" rx="1.2" ry="0.5" fill="${c.frostWhite}" opacity="0.5"/>` +
    `</g>`
  );
}

function svgIgloo(x: number, y: number, c: AssetColors, v: number): string {
  const block = c.igloo;
  const ice = c.ice;
  if (v === 1) {
    // With entrance
    return (
      `<g transform="translate(${x},${y})">` +
      `<path d="M-3.5,0.5 Q-3.5,-3 0,-3.5 Q3.5,-3 3.5,0.5 Z" fill="${block}"/>` +
      `<path d="M-1,0.5 Q-1,-0.5 0,-0.8 Q1,-0.5 1,0.5 Z" fill="${ice}" opacity="0.5"/>` +
      `<line x1="-2" y1="-1" x2="2" y2="-1" stroke="${ice}" stroke-width="0.2" opacity="0.4"/>` +
      `<line x1="-2.5" y1="0" x2="2.5" y2="0" stroke="${ice}" stroke-width="0.2" opacity="0.4"/>` +
      `<path d="M2,0.5 Q2.5,0.3 3,0.5 Q3,-0.2 2.5,-0.3 Q2,-0.2 2,0.5 Z" fill="${block}" opacity="0.8"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // Half-built
    return (
      `<g transform="translate(${x},${y})">` +
      `<path d="M-3,0.5 Q-3,-1.5 0,-2 Q2,-1.5 2,0.5 Z" fill="${block}"/>` +
      `<rect x="2.5" y="-0.5" width="1" height="0.5" fill="${block}" opacity="0.7"/>` +
      `<rect x="2" y="0" width="1.2" height="0.5" fill="${block}" opacity="0.6"/>` +
      `<line x1="-1.5" y1="0" x2="1.5" y2="0" stroke="${ice}" stroke-width="0.2" opacity="0.3"/>` +
      `</g>`
    );
  }
  // Classic
  return (
    `<g transform="translate(${x},${y})">` +
    `<path d="M-3,0.5 Q-3,-3 0,-3.5 Q3,-3 3,0.5 Z" fill="${block}"/>` +
    `<line x1="-2" y1="-1" x2="2" y2="-1" stroke="${ice}" stroke-width="0.2" opacity="0.4"/>` +
    `<line x1="-2.5" y1="0" x2="2.5" y2="0" stroke="${ice}" stroke-width="0.2" opacity="0.4"/>` +
    `<line x1="-1" y1="-2" x2="1" y2="-2" stroke="${ice}" stroke-width="0.2" opacity="0.3"/>` +
    `</g>`
  );
}

function svgFrozenPond(x: number, y: number, c: AssetColors, v: number): string {
  const ice = c.ice;
  const crack = c.frozenWater;
  if (v === 1) {
    // With cracks
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="0" cy="0" rx="3" ry="1.2" fill="${ice}" opacity="0.7"/>` +
      `<line x1="-1" y1="-0.3" x2="1.5" y2="0.5" stroke="${crack}" stroke-width="0.3" opacity="0.5"/>` +
      `<line x1="0" y1="-0.5" x2="0.5" y2="0.8" stroke="${crack}" stroke-width="0.2" opacity="0.4"/>` +
      `<ellipse cx="0.5" cy="-0.2" rx="0.8" ry="0.3" fill="#fff" opacity="0.2"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // Thin ice
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="0" cy="0" rx="2.5" ry="1" fill="${ice}" opacity="0.5"/>` +
      `<ellipse cx="0" cy="0" rx="1.5" ry="0.6" fill="${crack}" opacity="0.3"/>` +
      `<ellipse cx="0.3" cy="-0.1" rx="0.5" ry="0.2" fill="#fff" opacity="0.15"/>` +
      `</g>`
    );
  }
  // Solid
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="0" cy="0" rx="3" ry="1.2" fill="${ice}" opacity="0.7"/>` +
    `<ellipse cx="0.5" cy="-0.2" rx="1.2" ry="0.5" fill="#fff" opacity="0.15"/>` +
    `</g>`
  );
}

function svgIcicle(x: number, y: number, c: AssetColors, v: number): string {
  const ice = c.icicle;
  if (v === 1) {
    // Cluster
    return (
      `<g transform="translate(${x},${y})">` +
      `<polygon points="-1.5,-1 -1.2,-1 -1,-3" fill="${ice}" opacity="0.7"/>` +
      `<polygon points="-0.3,-1 0,-1 0.2,-3.5" fill="${ice}" opacity="0.8"/>` +
      `<polygon points="0.8,-1 1.1,-1 1.2,-2.5" fill="${ice}" opacity="0.7"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // Thick
    return (
      `<g transform="translate(${x},${y})">` +
      `<polygon points="-0.5,-1 0.5,-1 0.2,-3.5 -0.2,-3.5" fill="${ice}" opacity="0.8"/>` +
      `<ellipse cx="0" cy="-1" rx="0.6" ry="0.2" fill="${ice}" opacity="0.5"/>` +
      `</g>`
    );
  }
  // Single
  return (
    `<g transform="translate(${x},${y})">` +
    `<polygon points="-0.2,-1 0.2,-1 0,-3" fill="${ice}" opacity="0.8"/>` +
    `</g>`
  );
}

function svgSled(x: number, y: number, c: AssetColors, v: number): string {
  const wood = c.sledWood;
  const runner = c.sledRunner;
  if (v === 1) {
    // With gifts
    return (
      `<g transform="translate(${x},${y})">` +
      `<rect x="-2.5" y="-1" width="5" height="0.5" rx="0.2" fill="${wood}"/>` +
      `<path d="M-2.5,-0.5 Q-3,-0.5 -3,0 L-2.5,0.2" fill="none" stroke="${runner}" stroke-width="0.4"/>` +
      `<path d="M2.5,-0.5 Q3,-0.5 3,0 L2.5,0.2" fill="none" stroke="${runner}" stroke-width="0.4"/>` +
      `<rect x="-1.5" y="-2.2" width="1.5" height="1.2" fill="${c.scarfRed}" rx="0.2"/>` +
      /* v8 ignore start */
      `<rect x="0.3" y="-1.8" width="1" height="0.8" fill="${c.sproutGreen || '#4a8828'}" rx="0.2"/>` +
      /* v8 ignore stop */
      `</g>`
    );
  }
  if (v === 2) {
    // With runner marks
    return (
      `<g transform="translate(${x},${y})">` +
      `<rect x="-2.5" y="-1" width="5" height="0.5" rx="0.2" fill="${wood}"/>` +
      `<path d="M-2.5,-0.5 Q-3,-0.5 -3,0 L-2.5,0.2" fill="none" stroke="${runner}" stroke-width="0.4"/>` +
      `<path d="M2.5,-0.5 Q3,-0.5 3,0 L2.5,0.2" fill="none" stroke="${runner}" stroke-width="0.4"/>` +
      `<line x1="-3" y1="0.3" x2="3" y2="0.3" stroke="${runner}" stroke-width="0.15" opacity="0.3"/>` +
      `<line x1="-3" y1="0.5" x2="3" y2="0.5" stroke="${runner}" stroke-width="0.15" opacity="0.2"/>` +
      `</g>`
    );
  }
  // Empty
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-2.5" y="-1" width="5" height="0.5" rx="0.2" fill="${wood}"/>` +
    `<path d="M-2.5,-0.5 Q-3,-0.5 -3,0 L-2.5,0.2" fill="none" stroke="${runner}" stroke-width="0.4"/>` +
    `<path d="M2.5,-0.5 Q3,-0.5 3,0 L2.5,0.2" fill="none" stroke="${runner}" stroke-width="0.4"/>` +
    `<line x1="-2" y1="-1" x2="-2" y2="-0.5" stroke="${wood}" stroke-width="0.3"/>` +
    `<line x1="2" y1="-1" x2="2" y2="-0.5" stroke="${wood}" stroke-width="0.3"/>` +
    `</g>`
  );
}

function svgSnowCoveredRock(x: number, y: number, c: AssetColors, v: number): string {
  const rock = c.rock;
  const snow = c.snowCap;
  if (v === 1) {
    // Large
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="0" cy="0" rx="2.5" ry="1.2" fill="${rock}"/>` +
      `<ellipse cx="0" cy="-0.8" rx="2" ry="0.6" fill="${snow}" opacity="0.7"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // Boulder
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="0" cy="0" rx="3" ry="1.5" fill="${c.boulder}"/>` +
      `<ellipse cx="-0.5" cy="-0.5" rx="2" ry="1" fill="${rock}"/>` +
      `<ellipse cx="-0.3" cy="-1" rx="2" ry="0.7" fill="${snow}" opacity="0.6"/>` +
      `</g>`
    );
  }
  // Small
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="0" cy="0" rx="1.5" ry="0.8" fill="${rock}"/>` +
    `<ellipse cx="0" cy="-0.5" rx="1.2" ry="0.4" fill="${snow}" opacity="0.6"/>` +
    `</g>`
  );
}

function svgBareBush(x: number, y: number, c: AssetColors, v: number): string {
  const branch = c.bareBranch;
  const frost = c.frostWhite;
  if (v === 1) {
    // Wide
    return (
      `<g transform="translate(${x},${y})">` +
      `<line x1="0" y1="0.5" x2="-2" y2="-2" stroke="${branch}" stroke-width="0.4"/>` +
      `<line x1="0" y1="0.5" x2="2" y2="-1.5" stroke="${branch}" stroke-width="0.4"/>` +
      `<line x1="0" y1="0.5" x2="0" y2="-2.5" stroke="${branch}" stroke-width="0.5"/>` +
      `<line x1="-1" y1="-1.2" x2="-2.5" y2="-2" stroke="${branch}" stroke-width="0.3"/>` +
      `<line x1="1" y1="-0.8" x2="2.5" y2="-1.5" stroke="${branch}" stroke-width="0.3"/>` +
      `<circle cx="-2" cy="-2" r="0.3" fill="${frost}" opacity="0.4"/>` +
      `<circle cx="2" cy="-1.5" r="0.3" fill="${frost}" opacity="0.4"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // With berries
    return (
      `<g transform="translate(${x},${y})">` +
      `<line x1="0" y1="0.5" x2="-1.5" y2="-2" stroke="${branch}" stroke-width="0.4"/>` +
      `<line x1="0" y1="0.5" x2="1.5" y2="-1.8" stroke="${branch}" stroke-width="0.4"/>` +
      `<line x1="0" y1="0.5" x2="0" y2="-2.5" stroke="${branch}" stroke-width="0.5"/>` +
      `<circle cx="-1" cy="-1.8" r="0.25" fill="${c.scarfRed}"/>` +
      `<circle cx="0.5" cy="-2" r="0.25" fill="${c.scarfRed}"/>` +
      `<circle cx="1" cy="-1.2" r="0.25" fill="${c.scarfRed}"/>` +
      `</g>`
    );
  }
  // Small
  return (
    `<g transform="translate(${x},${y})">` +
    `<line x1="0" y1="0.5" x2="-1.5" y2="-1.5" stroke="${branch}" stroke-width="0.4"/>` +
    `<line x1="0" y1="0.5" x2="1.5" y2="-1.5" stroke="${branch}" stroke-width="0.4"/>` +
    `<line x1="0" y1="0.5" x2="0" y2="-2" stroke="${branch}" stroke-width="0.5"/>` +
    `<circle cx="0" cy="-2" r="0.3" fill="${frost}" opacity="0.3"/>` +
    `</g>`
  );
}

function svgWinterBird(x: number, y: number, c: AssetColors, v: number): string {
  if (v === 1) {
    // Robin
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="0" cy="-1" rx="1.2" ry="0.8" fill="${c.winterBirdBrown}"/>` +
      `<circle cx="-0.8" cy="-1.5" r="0.5" fill="${c.winterBirdBrown}"/>` +
      `<circle cx="-1" cy="-1.6" r="0.12" fill="#fff"/>` +
      `<circle cx="-1" cy="-1.6" r="0.06" fill="#222"/>` +
      `<polygon points="-1.3,-1.5 -1.8,-1.4 -1.3,-1.3" fill="${c.snowmanCarrot}"/>` +
      `<ellipse cx="0.3" cy="-0.8" rx="0.6" ry="0.4" fill="${c.scarfRed}" opacity="0.7"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // Sparrow
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="0" cy="-1" rx="1" ry="0.7" fill="${c.winterBirdBrown}" opacity="0.8"/>` +
      `<circle cx="-0.6" cy="-1.4" r="0.45" fill="${c.winterBirdBrown}" opacity="0.9"/>` +
      `<circle cx="-0.8" cy="-1.5" r="0.1" fill="#222"/>` +
      `<polygon points="-1,-1.4 -1.5,-1.3 -1,-1.2" fill="${c.snowmanCarrot}" opacity="0.8"/>` +
      `</g>`
    );
  }
  // Cardinal red
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="0" cy="-1" rx="1.2" ry="0.8" fill="${c.winterBirdRed}"/>` +
    `<circle cx="-0.8" cy="-1.5" r="0.55" fill="${c.winterBirdRed}"/>` +
    `<polygon points="-0.6,-2 -0.5,-2.5 -0.3,-2" fill="${c.winterBirdRed}"/>` +
    `<circle cx="-1" cy="-1.6" r="0.12" fill="#fff"/>` +
    `<circle cx="-1" cy="-1.6" r="0.06" fill="#222"/>` +
    `<polygon points="-1.3,-1.5 -1.8,-1.4 -1.3,-1.3" fill="${c.snowmanCarrot}"/>` +
    `<circle cx="-0.5" cy="-1.3" r="0.25" fill="#222" opacity="0.5"/>` +
    `</g>`
  );
}

function svgFirewood(x: number, y: number, c: AssetColors, v: number): string {
  const log = c.firewoodLog;
  const snow = c.snowCap;
  if (v === 1) {
    // Large stack
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="-0.8" cy="0" rx="0.6" ry="0.35" fill="${log}"/>` +
      `<ellipse cx="0.8" cy="0" rx="0.6" ry="0.35" fill="${log}"/>` +
      `<ellipse cx="0" cy="0" rx="0.6" ry="0.35" fill="${log}"/>` +
      `<ellipse cx="-0.4" cy="-0.6" rx="0.6" ry="0.35" fill="${log}"/>` +
      `<ellipse cx="0.4" cy="-0.6" rx="0.6" ry="0.35" fill="${log}"/>` +
      `<ellipse cx="0" cy="-1.2" rx="0.6" ry="0.35" fill="${log}"/>` +
      `<ellipse cx="0" cy="-1.5" rx="1.5" ry="0.3" fill="${snow}" opacity="0.5"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // In shelter
    return (
      `<g transform="translate(${x},${y})">` +
      `<line x1="-2" y1="0.5" x2="-2" y2="-2" stroke="${c.bareBranch}" stroke-width="0.4"/>` +
      `<line x1="2" y1="0.5" x2="2" y2="-2" stroke="${c.bareBranch}" stroke-width="0.4"/>` +
      `<line x1="-2.2" y1="-2" x2="2.2" y2="-2" stroke="${c.bareBranch}" stroke-width="0.5"/>` +
      `<ellipse cx="-0.5" cy="0" rx="0.5" ry="0.3" fill="${log}"/>` +
      `<ellipse cx="0.5" cy="0" rx="0.5" ry="0.3" fill="${log}"/>` +
      `<ellipse cx="0" cy="-0.5" rx="0.5" ry="0.3" fill="${log}"/>` +
      `</g>`
    );
  }
  // Small pile
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="-0.5" cy="0" rx="0.5" ry="0.3" fill="${log}"/>` +
    `<ellipse cx="0.5" cy="0" rx="0.5" ry="0.3" fill="${log}"/>` +
    `<ellipse cx="0" cy="-0.5" rx="0.5" ry="0.3" fill="${log}"/>` +
    `<ellipse cx="0" cy="-0.8" rx="1" ry="0.2" fill="${snow}" opacity="0.4"/>` +
    `</g>`
  );
}

// ── Spring Assets ──────────────────────────────────────────

function svgCherryBlossom(x: number, y: number, c: AssetColors, v: number): string {
  const pink = v === 2 ? c.cherryPetalWhite : c.cherryPetalPink;
  const trunk = c.cherryTrunk;
  if (v === 1) {
    // Early bloom (sparse)
    return (
      `<g transform="translate(${x},${y})">` +
      `<rect x="-0.5" y="-1" width="1" height="3" fill="${trunk}"/>` +
      `<line x1="0" y1="-1" x2="-2" y2="-3" stroke="${c.cherryBranch}" stroke-width="0.5"/>` +
      `<line x1="0" y1="-1.5" x2="2" y2="-3.5" stroke="${c.cherryBranch}" stroke-width="0.5"/>` +
      `<circle cx="-2" cy="-3.2" r="1" fill="${pink}" opacity="0.5"/>` +
      `<circle cx="2" cy="-3.7" r="0.8" fill="${pink}" opacity="0.4"/>` +
      `<circle cx="0" cy="-3" r="0.6" fill="${pink}" opacity="0.3"/>` +
      `</g>`
    );
  }
  // Full bloom pink (or white for v=2)
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-0.5" y="-1" width="1" height="3" fill="${trunk}"/>` +
    `<line x1="0" y1="-1" x2="-2.5" y2="-3" stroke="${c.cherryBranch}" stroke-width="0.5"/>` +
    `<line x1="0" y1="-1.5" x2="2.5" y2="-3.5" stroke="${c.cherryBranch}" stroke-width="0.5"/>` +
    `<line x1="0" y1="-2" x2="0" y2="-4" stroke="${c.cherryBranch}" stroke-width="0.5"/>` +
    `<circle cx="-2" cy="-3.5" r="1.5" fill="${pink}" opacity="0.7"/>` +
    `<circle cx="2" cy="-4" r="1.3" fill="${pink}" opacity="0.65"/>` +
    `<circle cx="0" cy="-4.5" r="1.4" fill="${pink}" opacity="0.7"/>` +
    `<circle cx="-0.5" cy="-3" r="1" fill="${pink}" opacity="0.5"/>` +
    `<circle cx="1" cy="-3" r="0.8" fill="${pink}" opacity="0.45"/>` +
    `</g>`
  );
}

function svgCherryBlossomSmall(x: number, y: number, c: AssetColors, v: number): string {
  const pink = c.cherryPetalPink;
  const trunk = c.cherryTrunk;
  if (v === 1) {
    // Bush-sized
    return (
      `<g transform="translate(${x},${y})">` +
      `<rect x="-0.3" y="-0.5" width="0.6" height="2" fill="${trunk}"/>` +
      `<circle cx="0" cy="-1.5" r="1.5" fill="${pink}" opacity="0.6"/>` +
      `<circle cx="-0.5" cy="-1" r="0.8" fill="${pink}" opacity="0.5"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // Weeping style
    return (
      `<g transform="translate(${x},${y})">` +
      `<rect x="-0.3" y="-0.5" width="0.6" height="2" fill="${trunk}"/>` +
      `<circle cx="0" cy="-2" r="1.2" fill="${pink}" opacity="0.6"/>` +
      `<path d="M-1,-1.5 Q-2,0 -1.5,0.5" stroke="${c.cherryBranch}" fill="none" stroke-width="0.3"/>` +
      `<path d="M1,-1.5 Q2,0 1.5,0.5" stroke="${c.cherryBranch}" fill="none" stroke-width="0.3"/>` +
      `<circle cx="-1.5" cy="0" r="0.5" fill="${pink}" opacity="0.4"/>` +
      `<circle cx="1.5" cy="0" r="0.5" fill="${pink}" opacity="0.4"/>` +
      `</g>`
    );
  }
  // Sapling
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-0.3" y="-0.5" width="0.6" height="2" fill="${trunk}"/>` +
    `<circle cx="0" cy="-1.5" r="1" fill="${pink}" opacity="0.55"/>` +
    `</g>`
  );
}

function svgCherryPetals(x: number, y: number, c: AssetColors, v: number): string {
  const pink = c.cherryPetalPink;
  if (v === 1) {
    // Piled
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="0" cy="0" rx="2" ry="0.6" fill="${pink}" opacity="0.4"/>` +
      `<ellipse cx="0.5" cy="-0.2" rx="1" ry="0.3" fill="${pink}" opacity="0.5"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // Swirling
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="-0.5" cy="-0.5" rx="0.3" ry="0.15" fill="${pink}" opacity="0.6" transform="rotate(-20,-0.5,-0.5)"/>` +
      `<ellipse cx="0.8" cy="-1" rx="0.3" ry="0.15" fill="${pink}" opacity="0.5" transform="rotate(30,0.8,-1)"/>` +
      `<ellipse cx="0" cy="-1.5" rx="0.25" ry="0.12" fill="${pink}" opacity="0.55" transform="rotate(-45,0,-1.5)"/>` +
      `<ellipse cx="-0.3" cy="0.2" rx="0.25" ry="0.12" fill="${pink}" opacity="0.4"/>` +
      `</g>`
    );
  }
  // Scattered
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="-1" cy="0" rx="0.3" ry="0.15" fill="${pink}" opacity="0.5"/>` +
    `<ellipse cx="0.5" cy="0.3" rx="0.25" ry="0.12" fill="${pink}" opacity="0.45"/>` +
    `<ellipse cx="1.2" cy="-0.2" rx="0.3" ry="0.15" fill="${pink}" opacity="0.4"/>` +
    `<ellipse cx="-0.3" cy="-0.3" rx="0.2" ry="0.1" fill="${pink}" opacity="0.5"/>` +
    `</g>`
  );
}

function svgCherryBlossomFull(x: number, y: number, c: AssetColors, v: number): string {
  // Dense cherry blossom tree in full bloom
  const pink = c.blossomPink || c.cherryPetalPink;
  const white = c.blossomWhite || c.cherryPetalWhite;
  const trunk = c.cherryTrunk;
  if (v === 1) {
    // White/pink mix
    return (
      `<g transform="translate(${x},${y})">` +
      `<rect x="-0.6" y="-1" width="1.2" height="3.5" fill="${trunk}"/>` +
      `<circle cx="0" cy="-4.5" r="2.5" fill="${white}" opacity="0.7"/>` +
      `<circle cx="-1.8" cy="-3.5" r="1.8" fill="${pink}" opacity="0.65"/>` +
      `<circle cx="1.8" cy="-3.5" r="1.8" fill="${white}" opacity="0.6"/>` +
      `<circle cx="0" cy="-6" r="1.5" fill="${pink}" opacity="0.55"/>` +
      `<circle cx="-1" cy="-5" r="1" fill="${white}" opacity="0.5"/>` +
      `<circle cx="1" cy="-5" r="1" fill="${pink}" opacity="0.5"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // With falling petals
    return (
      `<g transform="translate(${x},${y})">` +
      `<rect x="-0.6" y="-1" width="1.2" height="3.5" fill="${trunk}"/>` +
      `<circle cx="0" cy="-4" r="2.3" fill="${pink}" opacity="0.7"/>` +
      `<circle cx="-1.5" cy="-3.2" r="1.6" fill="${pink}" opacity="0.65"/>` +
      `<circle cx="1.5" cy="-3.2" r="1.6" fill="${pink}" opacity="0.6"/>` +
      `<circle cx="0" cy="-5.5" r="1.3" fill="${pink}" opacity="0.55"/>` +
      `<ellipse cx="-2" cy="0.5" rx="0.3" ry="0.12" fill="${pink}" opacity="0.5"/>` +
      `<ellipse cx="1.5" cy="0.8" rx="0.25" ry="0.1" fill="${pink}" opacity="0.45"/>` +
      `<ellipse cx="0" cy="0.3" rx="0.2" ry="0.08" fill="${pink}" opacity="0.4"/>` +
      `</g>`
    );
  }
  // Classic full bloom
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-0.6" y="-1" width="1.2" height="3.5" fill="${trunk}"/>` +
    `<circle cx="0" cy="-4.5" r="2.8" fill="${pink}" opacity="0.7"/>` +
    `<circle cx="-2" cy="-3.5" r="2" fill="${pink}" opacity="0.65"/>` +
    `<circle cx="2" cy="-3.5" r="2" fill="${pink}" opacity="0.6"/>` +
    `<circle cx="0" cy="-6.5" r="1.5" fill="${pink}" opacity="0.55"/>` +
    `<circle cx="-1" cy="-5.5" r="1.2" fill="${pink}" opacity="0.5"/>` +
    `<circle cx="1" cy="-5.5" r="1.2" fill="${pink}" opacity="0.5"/>` +
    `</g>`
  );
}

function svgCherryBlossomBranch(x: number, y: number, c: AssetColors, v: number): string {
  // Small cherry blossom branch
  const pink = c.blossomPink || c.cherryPetalPink;
  const branch = c.cherryBranch;
  if (v === 1) {
    // Arching branch
    return (
      `<g transform="translate(${x},${y})">` +
      `<path d="M0,0 Q-1.5,-2 -3,-2" stroke="${branch}" fill="none" stroke-width="0.4"/>` +
      `<circle cx="-2.5" cy="-2.2" r="0.8" fill="${pink}" opacity="0.6"/>` +
      `<circle cx="-3.2" cy="-1.8" r="0.6" fill="${pink}" opacity="0.5"/>` +
      `<circle cx="-1.8" cy="-2" r="0.5" fill="${pink}" opacity="0.55"/>` +
      `</g>`
    );
  }
  // Upward branch
  return (
    `<g transform="translate(${x},${y})">` +
    `<path d="M0,0 Q0.5,-1.5 1,-3" stroke="${branch}" fill="none" stroke-width="0.35"/>` +
    `<circle cx="0.8" cy="-2.5" r="0.7" fill="${pink}" opacity="0.6"/>` +
    `<circle cx="1.2" cy="-3.2" r="0.5" fill="${pink}" opacity="0.55"/>` +
    `<circle cx="0.3" cy="-1.5" r="0.4" fill="${pink}" opacity="0.5"/>` +
    `</g>`
  );
}

function svgPeachBlossom(x: number, y: number, c: AssetColors, v: number): string {
  // Peach tree with lighter pink blossoms
  /* v8 ignore start */
  const pink = c.peachPink || '#ffd5cc';
  /* v8 ignore stop */
  const trunk = c.cherryTrunk;
  if (v === 1) {
    // Young tree
    return (
      `<g transform="translate(${x},${y})">` +
      `<rect x="-0.4" y="-1" width="0.8" height="3" fill="${trunk}"/>` +
      `<circle cx="0" cy="-3.5" r="2" fill="${pink}" opacity="0.65"/>` +
      `<circle cx="-1.2" cy="-2.8" r="1.2" fill="${pink}" opacity="0.55"/>` +
      `<circle cx="1.2" cy="-2.8" r="1.2" fill="${pink}" opacity="0.5"/>` +
      `<circle cx="0" cy="-4.8" r="0.8" fill="${pink}" opacity="0.5"/>` +
      `</g>`
    );
  }
  // Full peach tree
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-0.5" y="-1" width="1" height="3.5" fill="${trunk}"/>` +
    `<circle cx="0" cy="-4" r="2.5" fill="${pink}" opacity="0.65"/>` +
    `<circle cx="-1.5" cy="-3" r="1.5" fill="${pink}" opacity="0.55"/>` +
    `<circle cx="1.5" cy="-3" r="1.5" fill="${pink}" opacity="0.5"/>` +
    `<circle cx="0" cy="-5.5" r="1.2" fill="${pink}" opacity="0.5"/>` +
    `</g>`
  );
}

function svgFlowerBed(x: number, y: number, c: AssetColors, v: number): string {
  // Garden flower bed with mixed colorful flowers
  const soil = c.gardenSoil;
  const red = c.tulipRed;
  const yellow = c.tulipYellow;
  const purple = c.crocusPurple;
  if (v === 1) {
    // Rectangular bed
    return (
      `<g transform="translate(${x},${y})">` +
      `<rect x="-2" y="-0.3" width="4" height="0.8" rx="0.2" fill="${soil}"/>` +
      `<circle cx="-1.2" cy="-0.8" r="0.35" fill="${red}"/>` +
      `<circle cx="-0.4" cy="-0.9" r="0.3" fill="${yellow}"/>` +
      `<circle cx="0.4" cy="-0.7" r="0.35" fill="${purple}"/>` +
      `<circle cx="1.2" cy="-0.85" r="0.3" fill="${red}"/>` +
      `<line x1="-1.2" y1="-0.5" x2="-1.2" y2="-0.3" stroke="${c.sproutGreen}" stroke-width="0.12"/>` +
      `<line x1="0.4" y1="-0.4" x2="0.4" y2="-0.3" stroke="${c.sproutGreen}" stroke-width="0.12"/>` +
      `</g>`
    );
  }
  // Circular bed
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="0" cy="0" rx="1.8" ry="0.7" fill="${soil}"/>` +
    `<circle cx="-0.8" cy="-0.5" r="0.35" fill="${red}"/>` +
    `<circle cx="0" cy="-0.6" r="0.3" fill="${yellow}"/>` +
    `<circle cx="0.8" cy="-0.5" r="0.35" fill="${purple}"/>` +
    `<circle cx="-0.4" cy="-0.3" r="0.25" fill="${yellow}" opacity="0.9"/>` +
    `<circle cx="0.4" cy="-0.35" r="0.25" fill="${red}" opacity="0.9"/>` +
    `</g>`
  );
}

function svgWateringCan(x: number, y: number, c: AssetColors, _v: number): string {
  // Garden watering can
  /* v8 ignore start */
  const metal = c.sledRunner || '#607080';
  /* v8 ignore stop */
  const accent = c.sproutGreen;
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="0" cy="0" rx="1" ry="0.5" fill="${metal}"/>` +
    `<rect x="-0.8" y="-1.2" width="1.6" height="1.2" rx="0.2" fill="${metal}"/>` +
    `<path d="M0.6,-0.8 Q1.2,-1.2 1.8,-1" stroke="${metal}" fill="none" stroke-width="0.2"/>` +
    `<line x1="1.8" y1="-1" x2="2.5" y2="-0.5" stroke="${metal}" stroke-width="0.25"/>` +
    `<ellipse cx="2.5" cy="-0.4" rx="0.25" ry="0.15" fill="${metal}"/>` +
    `<path d="M-0.5,-1.2 Q-0.5,-2 0,-2 Q0.5,-2 0.5,-1.2" stroke="${accent}" fill="none" stroke-width="0.15"/>` +
    `</g>`
  );
}

function svgSeedling(x: number, y: number, c: AssetColors, v: number): string {
  // Small seedling sprouting
  const green = c.sproutGreen;
  const soil = c.gardenSoil;
  if (v === 1) {
    // Two leaves
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="0" cy="0.2" rx="0.6" ry="0.2" fill="${soil}"/>` +
      `<line x1="0" y1="0" x2="0" y2="-1" stroke="${green}" stroke-width="0.12"/>` +
      `<ellipse cx="-0.4" cy="-1.2" rx="0.35" ry="0.2" fill="${green}" transform="rotate(-30,-0.4,-1.2)"/>` +
      `<ellipse cx="0.4" cy="-1.2" rx="0.35" ry="0.2" fill="${green}" transform="rotate(30,0.4,-1.2)"/>` +
      `</g>`
    );
  }
  // Single leaf
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="0" cy="0.2" rx="0.5" ry="0.15" fill="${soil}"/>` +
    `<line x1="0" y1="0" x2="0" y2="-0.8" stroke="${green}" stroke-width="0.1"/>` +
    `<ellipse cx="0" cy="-1" rx="0.25" ry="0.4" fill="${green}"/>` +
    `</g>`
  );
}

function svgRobinBird(x: number, y: number, c: AssetColors, v: number): string {
  // Spring robin with red breast
  /* v8 ignore start */
  const brown = c.owl || '#8a7050';
  /* v8 ignore stop */
  const red = c.tulipRed;
  const beak = c.tulipYellow;
  if (v === 1) {
    // Singing (beak open)
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="0" cy="0" rx="0.8" ry="0.5" fill="${brown}"/>` +
      `<ellipse cx="0.2" cy="-0.1" rx="0.4" ry="0.35" fill="${red}"/>` +
      `<circle cx="0.7" cy="-0.3" r="0.35" fill="${brown}"/>` +
      `<polygon points="1,-0.3 1.3,-0.1 1,-0.15" fill="${beak}"/>` +
      `<polygon points="1,-0.3 1.3,-0.4 1,-0.35" fill="${beak}"/>` +
      `<circle cx="0.8" cy="-0.35" r="0.08" fill="#000"/>` +
      `<line x1="-0.6" y1="0.4" x2="-0.6" y2="0.7" stroke="${brown}" stroke-width="0.1"/>` +
      `</g>`
    );
  }
  // Standing
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="0" cy="0" rx="0.8" ry="0.5" fill="${brown}"/>` +
    `<ellipse cx="0.2" cy="-0.1" rx="0.4" ry="0.35" fill="${red}"/>` +
    `<circle cx="0.7" cy="-0.3" r="0.35" fill="${brown}"/>` +
    `<polygon points="1,-0.3 1.4,-0.25 1,-0.2" fill="${beak}"/>` +
    `<circle cx="0.8" cy="-0.35" r="0.08" fill="#000"/>` +
    `<line x1="-0.5" y1="0.4" x2="-0.5" y2="0.7" stroke="${brown}" stroke-width="0.08"/>` +
    `<line x1="0" y1="0.45" x2="0" y2="0.7" stroke="${brown}" stroke-width="0.08"/>` +
    `</g>`
  );
}

function svgButterflyGarden(x: number, y: number, c: AssetColors, v: number): string {
  // Multiple butterflies
  const wing1 = c.butterfly;
  const wing2 = c.butterflyWing;
  const wing3 = c.tulipPurple;
  if (v === 1) {
    // Three butterflies
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="-1" cy="-1" rx="0.5" ry="0.25" fill="${wing1}" opacity="0.7"/>` +
      `<ellipse cx="-1.5" cy="-1.2" rx="0.4" ry="0.2" fill="${wing2}" opacity="0.6"/>` +
      `<ellipse cx="0.5" cy="-0.5" rx="0.4" ry="0.2" fill="${wing3}" opacity="0.65"/>` +
      `<ellipse cx="0.1" cy="-0.6" rx="0.3" ry="0.15" fill="${wing2}" opacity="0.55"/>` +
      `<ellipse cx="1" cy="-1.5" rx="0.35" ry="0.18" fill="${wing1}" opacity="0.6"/>` +
      `<ellipse cx="0.7" cy="-1.6" rx="0.25" ry="0.12" fill="${wing3}" opacity="0.5"/>` +
      `</g>`
    );
  }
  // Two butterflies
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="-0.5" cy="-0.8" rx="0.5" ry="0.25" fill="${wing1}" opacity="0.7"/>` +
    `<ellipse cx="-1" cy="-1" rx="0.4" ry="0.2" fill="${wing2}" opacity="0.6"/>` +
    `<ellipse cx="0.8" cy="-1.2" rx="0.45" ry="0.22" fill="${wing3}" opacity="0.65"/>` +
    `<ellipse cx="0.4" cy="-1.3" rx="0.35" ry="0.17" fill="${wing1}" opacity="0.55"/>` +
    `</g>`
  );
}

function svgUmbrella(x: number, y: number, c: AssetColors, v: number): string {
  // Colorful umbrella
  const colors = [c.parasolRed, c.parasolBlue, c.parasolYellow];
  const color = colors[v] || c.parasolRed;
  const handle = c.trunk;
  if (v === 2) {
    // Open umbrella on ground
    return (
      `<g transform="translate(${x},${y})">` +
      `<path d="M-2,0 Q0,-2 2,0" fill="${color}" opacity="0.8"/>` +
      `<line x1="0" y1="0" x2="0" y2="0.8" stroke="${handle}" stroke-width="0.2"/>` +
      `<path d="M0,0.8 Q0.3,1 0.2,1.3" stroke="${handle}" fill="none" stroke-width="0.15"/>` +
      `</g>`
    );
  }
  // Closed umbrella leaning
  return (
    `<g transform="translate(${x},${y})">` +
    `<line x1="-0.3" y1="1" x2="0.5" y2="-2.5" stroke="${handle}" stroke-width="0.2"/>` +
    `<polygon points="0.4,-2.5 0.7,-2 0.6,-2.5 0.3,-2.5" fill="${color}"/>` +
    `<path d="M0.4,-2.5 L0.5,-1 L0.2,-1 Z" fill="${color}" opacity="0.8"/>` +
    `<path d="M-0.3,1 Q-0.5,1.2 -0.3,1.4" stroke="${handle}" fill="none" stroke-width="0.12"/>` +
    `</g>`
  );
}

function svgTulip(x: number, y: number, c: AssetColors, v: number): string {
  const colors = [c.tulipRed, c.tulipYellow, c.tulipPurple];
  const color = colors[v] || c.tulipRed;
  const stem = c.tulipStem;
  return (
    `<g transform="translate(${x},${y})">` +
    `<line x1="0" y1="0.5" x2="0" y2="-2" stroke="${stem}" stroke-width="0.4"/>` +
    `<path d="M-0.6,-2 Q0,-3.5 0.6,-2" fill="${color}"/>` +
    `<ellipse cx="0" cy="-2" rx="0.5" ry="0.2" fill="${color}" opacity="0.7"/>` +
    `<path d="M0.5,-0.5 Q1.5,-1 1.2,-0.2" fill="${stem}" opacity="0.6"/>` +
    `</g>`
  );
}

function svgTulipField(x: number, y: number, c: AssetColors, v: number): string {
  const stem = c.tulipStem;
  if (v === 1) {
    // Single color row
    const col = c.tulipRed;
    return (
      `<g transform="translate(${x},${y})">` +
      `<line x1="-1.5" y1="0.5" x2="-1.5" y2="-1.5" stroke="${stem}" stroke-width="0.3"/>` +
      `<path d="M-2,-1.5 Q-1.5,-2.8 -1,-1.5" fill="${col}"/>` +
      `<line x1="0" y1="0.5" x2="0" y2="-1.8" stroke="${stem}" stroke-width="0.3"/>` +
      `<path d="M-0.5,-1.8 Q0,-3 0.5,-1.8" fill="${col}"/>` +
      `<line x1="1.5" y1="0.5" x2="1.5" y2="-1.3" stroke="${stem}" stroke-width="0.3"/>` +
      `<path d="M1,-1.3 Q1.5,-2.5 2,-1.3" fill="${col}"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // With greenery
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="0" cy="0.3" rx="2.5" ry="0.5" fill="${stem}" opacity="0.3"/>` +
      `<line x1="-1" y1="0.3" x2="-1" y2="-1.5" stroke="${stem}" stroke-width="0.3"/>` +
      `<path d="M-1.4,-1.5 Q-1,-2.5 -0.6,-1.5" fill="${c.tulipYellow}"/>` +
      `<line x1="0.8" y1="0.3" x2="0.8" y2="-1.8" stroke="${stem}" stroke-width="0.3"/>` +
      `<path d="M0.4,-1.8 Q0.8,-3 1.2,-1.8" fill="${c.tulipPurple}"/>` +
      `</g>`
    );
  }
  // Mixed colors
  return (
    `<g transform="translate(${x},${y})">` +
    `<line x1="-1.5" y1="0.5" x2="-1.5" y2="-1.5" stroke="${stem}" stroke-width="0.3"/>` +
    `<path d="M-2,-1.5 Q-1.5,-2.8 -1,-1.5" fill="${c.tulipRed}"/>` +
    `<line x1="0" y1="0.5" x2="0" y2="-1.8" stroke="${stem}" stroke-width="0.3"/>` +
    `<path d="M-0.5,-1.8 Q0,-3 0.5,-1.8" fill="${c.tulipYellow}"/>` +
    `<line x1="1.5" y1="0.5" x2="1.5" y2="-1.3" stroke="${stem}" stroke-width="0.3"/>` +
    `<path d="M1,-1.3 Q1.5,-2.5 2,-1.3" fill="${c.tulipPurple}"/>` +
    `</g>`
  );
}

function svgSprout(x: number, y: number, c: AssetColors, v: number): string {
  const green = c.sproutGreen;
  if (v === 1) {
    // Pair
    return (
      `<g transform="translate(${x},${y})">` +
      `<line x1="-0.5" y1="0.5" x2="-0.5" y2="-0.5" stroke="${green}" stroke-width="0.3"/>` +
      `<path d="M-0.5,-0.5 Q-0.5,-1.2 0,-1" fill="${green}"/>` +
      `<line x1="0.5" y1="0.5" x2="0.5" y2="-0.3" stroke="${green}" stroke-width="0.3"/>` +
      `<path d="M0.5,-0.3 Q0.5,-1 1,-0.8" fill="${green}"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // With tiny leaf
    return (
      `<g transform="translate(${x},${y})">` +
      `<line x1="0" y1="0.5" x2="0" y2="-0.8" stroke="${green}" stroke-width="0.3"/>` +
      `<path d="M0,-0.8 Q0,-1.5 0.5,-1.2" fill="${green}"/>` +
      `<path d="M0,-0.3 Q0.5,-0.5 0.3,-0.1" fill="${green}" opacity="0.6"/>` +
      `</g>`
    );
  }
  // Single
  return (
    `<g transform="translate(${x},${y})">` +
    `<line x1="0" y1="0.5" x2="0" y2="-0.5" stroke="${green}" stroke-width="0.3"/>` +
    `<path d="M0,-0.5 Q0,-1.3 0.5,-1" fill="${green}"/>` +
    `</g>`
  );
}

function svgNest(x: number, y: number, c: AssetColors, v: number): string {
  const brown = c.nestBrown;
  const egg1 = c.eggBlue;
  const egg2 = c.eggWhite;
  if (v === 1) {
    // 3 eggs
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="0" cy="0" rx="1.8" ry="0.7" fill="${brown}"/>` +
      `<ellipse cx="0" cy="-0.2" rx="1.3" ry="0.4" fill="${brown}" opacity="0.7"/>` +
      `<ellipse cx="-0.5" cy="-0.4" rx="0.3" ry="0.4" fill="${egg1}"/>` +
      `<ellipse cx="0.2" cy="-0.4" rx="0.3" ry="0.4" fill="${egg1}"/>` +
      `<ellipse cx="0.8" cy="-0.3" rx="0.3" ry="0.35" fill="${egg2}"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // With baby bird
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="0" cy="0" rx="1.8" ry="0.7" fill="${brown}"/>` +
      `<ellipse cx="-0.5" cy="-0.4" rx="0.3" ry="0.4" fill="${egg1}"/>` +
      /* v8 ignore start */
      `<circle cx="0.5" cy="-0.8" r="0.5" fill="${c.winterBirdBrown || '#8a6040'}"/>` +
      `<polygon points="0.5,-0.8 0.9,-0.7 0.5,-0.6" fill="${c.snowmanCarrot || '#e07020'}" opacity="0.8"/>` +
      /* v8 ignore stop */
      `<circle cx="0.35" cy="-0.9" r="0.08" fill="#222"/>` +
      `</g>`
    );
  }
  // 2 eggs
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="0" cy="0" rx="1.5" ry="0.6" fill="${brown}"/>` +
    `<ellipse cx="0" cy="-0.2" rx="1" ry="0.35" fill="${brown}" opacity="0.7"/>` +
    `<ellipse cx="-0.3" cy="-0.4" rx="0.3" ry="0.4" fill="${egg1}"/>` +
    `<ellipse cx="0.3" cy="-0.4" rx="0.3" ry="0.4" fill="${egg2}"/>` +
    `</g>`
  );
}

function svgLamb(x: number, y: number, c: AssetColors, v: number): string {
  const wool = c.lambWool;
  /* v8 ignore start */
  const head = c.winterBirdBrown || '#6a5040';
  /* v8 ignore stop */
  if (v === 1) {
    // Playing
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="0" cy="-0.5" rx="1.5" ry="1" fill="${wool}"/>` +
      `<circle cx="-1.2" cy="-1.2" r="0.5" fill="${head}"/>` +
      `<circle cx="-1.4" cy="-1.3" r="0.08" fill="#222"/>` +
      `<line x1="-0.5" y1="0.5" x2="-0.8" y2="1.2" stroke="${head}" stroke-width="0.3"/>` +
      `<line x1="0.5" y1="0.5" x2="0.3" y2="1.2" stroke="${head}" stroke-width="0.3"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // With mother (larger sheep nearby)
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="2" cy="-0.8" rx="2" ry="1.3" fill="${c.sheep || wool}"/>` +
      `<circle cx="0.5" cy="-1.5" r="0.6" fill="#444"/>` +
      `<ellipse cx="-1.5" cy="-0.3" rx="1.2" ry="0.8" fill="${wool}"/>` +
      `<circle cx="-2.3" cy="-0.8" r="0.4" fill="${head}"/>` +
      `<circle cx="-2.5" cy="-0.9" r="0.06" fill="#222"/>` +
      `</g>`
    );
  }
  // Standing
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="0" cy="-0.5" rx="1.3" ry="0.9" fill="${wool}"/>` +
    `<circle cx="-1" cy="-1" r="0.45" fill="${head}"/>` +
    `<circle cx="-1.2" cy="-1.1" r="0.07" fill="#222"/>` +
    `<line x1="-0.5" y1="0.3" x2="-0.5" y2="1" stroke="${head}" stroke-width="0.25"/>` +
    `<line x1="0.5" y1="0.3" x2="0.5" y2="1" stroke="${head}" stroke-width="0.25"/>` +
    `</g>`
  );
}

function svgCrocus(x: number, y: number, c: AssetColors, v: number): string {
  const colors = [c.crocusPurple, c.crocusYellow, c.cherryPetalWhite];
  const color = colors[v] || c.crocusPurple;
  return (
    `<g transform="translate(${x},${y})">` +
    /* v8 ignore start */
    `<line x1="0" y1="0.5" x2="0" y2="-0.5" stroke="${c.tulipStem || '#5a9a40'}" stroke-width="0.3"/>` +
    /* v8 ignore stop */
    `<path d="M-0.4,-0.5 Q0,-1.5 0.4,-0.5" fill="${color}"/>` +
    `<line x1="0" y1="-0.8" x2="0" y2="-1.2" stroke="${c.crocusYellow}" stroke-width="0.2"/>` +
    `</g>`
  );
}

function svgRainPuddle(x: number, y: number, c: AssetColors, v: number): string {
  const water = c.poolWater || c.water;
  if (v === 1) {
    // With reflection
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="0" cy="0" rx="2" ry="0.8" fill="${water}" opacity="0.4"/>` +
      `<ellipse cx="0.3" cy="-0.1" rx="0.8" ry="0.3" fill="#fff" opacity="0.1"/>` +
      `<circle cx="-0.5" cy="-0.2" r="0.4" fill="${water}" opacity="0.15" stroke="${water}" stroke-width="0.2"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // In mud
    return (
      `<g transform="translate(${x},${y})">` +
      /* v8 ignore start */
      `<ellipse cx="0" cy="0" rx="1.8" ry="0.7" fill="${c.gardenSoil || '#5a4030'}" opacity="0.3"/>` +
      /* v8 ignore stop */
      `<ellipse cx="0" cy="0" rx="1.5" ry="0.5" fill="${water}" opacity="0.35"/>` +
      `</g>`
    );
  }
  // Small
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="0" cy="0" rx="1.5" ry="0.6" fill="${water}" opacity="0.35"/>` +
    `<ellipse cx="0.2" cy="-0.1" rx="0.6" ry="0.25" fill="#fff" opacity="0.1"/>` +
    `</g>`
  );
}

function svgBirdhouse(x: number, y: number, c: AssetColors, v: number): string {
  const wood = c.birdhouseWood;
  if (v === 1) {
    // Painted
    return (
      `<g transform="translate(${x},${y})">` +
      `<line x1="0" y1="0.5" x2="0" y2="-2" stroke="${wood}" stroke-width="0.5"/>` +
      /* v8 ignore start */
      `<rect x="-1" y="-3.5" width="2" height="1.5" fill="${c.parasolBlue || '#4080d0'}"/>` +
      `<polygon points="-1.2,-3.5 0,-4.5 1.2,-3.5" fill="${c.tulipRed || '#e04050'}"/>` +
      /* v8 ignore stop */
      `<circle cx="0" cy="-3" r="0.3" fill="#333"/>` +
      `<line x1="0" y1="-2.7" x2="0.5" y2="-2.5" stroke="${wood}" stroke-width="0.3"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // With bird
    return (
      `<g transform="translate(${x},${y})">` +
      `<line x1="0" y1="0.5" x2="0" y2="-2" stroke="${wood}" stroke-width="0.5"/>` +
      `<rect x="-1" y="-3.5" width="2" height="1.5" fill="${wood}"/>` +
      `<polygon points="-1.2,-3.5 0,-4.5 1.2,-3.5" fill="${wood}" opacity="0.8"/>` +
      `<circle cx="0" cy="-3" r="0.3" fill="#333"/>` +
      /* v8 ignore start */
      `<circle cx="1.2" cy="-3.8" r="0.4" fill="${c.winterBirdBrown || '#8a6040'}"/>` +
      `<ellipse cx="1.2" cy="-3.5" rx="0.5" ry="0.3" fill="${c.winterBirdBrown || '#8a6040'}"/>` +
      /* v8 ignore stop */
      `</g>`
    );
  }
  // Classic
  return (
    `<g transform="translate(${x},${y})">` +
    `<line x1="0" y1="0.5" x2="0" y2="-2" stroke="${wood}" stroke-width="0.5"/>` +
    `<rect x="-1" y="-3.5" width="2" height="1.5" fill="${wood}"/>` +
    `<polygon points="-1.2,-3.5 0,-4.5 1.2,-3.5" fill="${wood}" opacity="0.8"/>` +
    `<circle cx="0" cy="-3" r="0.3" fill="#333"/>` +
    `<line x1="0" y1="-2.7" x2="0.5" y2="-2.5" stroke="${wood}" stroke-width="0.3"/>` +
    `</g>`
  );
}

function svgGardenBed(x: number, y: number, c: AssetColors, v: number): string {
  const soil = c.gardenSoil;
  const green = c.sproutGreen;
  if (v === 1) {
    // Sprouts showing
    return (
      `<g transform="translate(${x},${y})">` +
      `<rect x="-2.5" y="-0.3" width="5" height="1" rx="0.3" fill="${soil}"/>` +
      `<line x1="-1.5" y1="-0.3" x2="-1.5" y2="-1" stroke="${green}" stroke-width="0.3"/>` +
      `<line x1="0" y1="-0.3" x2="0" y2="-0.8" stroke="${green}" stroke-width="0.3"/>` +
      `<line x1="1.5" y1="-0.3" x2="1.5" y2="-1.1" stroke="${green}" stroke-width="0.3"/>` +
      `<path d="M-1.5,-1 Q-1.5,-1.5 -1,-1.2" fill="${green}"/>` +
      `<path d="M1.5,-1.1 Q1.5,-1.6 2,-1.3" fill="${green}"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // With fence
    return (
      `<g transform="translate(${x},${y})">` +
      `<rect x="-2.5" y="-0.3" width="5" height="1" rx="0.3" fill="${soil}"/>` +
      `<line x1="-2.5" y1="-0.8" x2="2.5" y2="-0.8" stroke="${c.fence}" stroke-width="0.3"/>` +
      `<line x1="-2" y1="-1.3" x2="-2" y2="0" stroke="${c.fence}" stroke-width="0.3"/>` +
      `<line x1="2" y1="-1.3" x2="2" y2="0" stroke="${c.fence}" stroke-width="0.3"/>` +
      `<line x1="0" y1="-0.3" x2="0" y2="-0.7" stroke="${green}" stroke-width="0.3"/>` +
      `</g>`
    );
  }
  // Just planted
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-2" y="-0.3" width="4" height="0.8" rx="0.3" fill="${soil}"/>` +
    `<line x1="-1" y1="-0.1" x2="-1" y2="-0.1" stroke="${soil}" stroke-width="0.8"/>` +
    `<line x1="0.5" y1="-0.1" x2="0.5" y2="-0.1" stroke="${soil}" stroke-width="0.8"/>` +
    `</g>`
  );
}

// ── Summer Assets ──────────────────────────────────────────

function svgParasol(x: number, y: number, c: AssetColors, v: number): string {
  const colors = [c.parasolRed, c.parasolBlue, c.parasolYellow];
  const color = colors[v] || c.parasolRed;
  return (
    `<g transform="translate(${x},${y})">` +
    /* v8 ignore start */
    `<line x1="0" y1="0.5" x2="0" y2="-4" stroke="${c.bareBranch || '#6a5a4a'}" stroke-width="0.4"/>` +
    /* v8 ignore stop */
    `<path d="M-3,-4 Q0,-6 3,-4 L0,-4.5 Z" fill="${color}"/>` +
    `<path d="M-1.5,-4.2 Q0,-5 1.5,-4.2" fill="${c.parasolStripe}" opacity="0.3"/>` +
    `</g>`
  );
}

function svgBeachTowel(x: number, y: number, c: AssetColors, v: number): string {
  const colors = [c.beachTowelA, c.beachTowelB, c.parasolYellow];
  const color = colors[v] || c.beachTowelA;
  if (v === 2) {
    // With sunglasses
    return (
      `<g transform="translate(${x},${y})">` +
      `<rect x="-2.5" y="-0.3" width="5" height="1.5" rx="0.3" fill="${color}" opacity="0.8"/>` +
      `<circle cx="-0.3" cy="0.2" r="0.35" fill="#333" opacity="0.6"/>` +
      `<circle cx="0.4" cy="0.2" r="0.35" fill="#333" opacity="0.6"/>` +
      `<line x1="-0.3" y1="0.2" x2="0.4" y2="0.2" stroke="#333" stroke-width="0.15"/>` +
      `</g>`
    );
  }
  // Striped or solid
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-2.5" y="-0.3" width="5" height="1.5" rx="0.3" fill="${color}" opacity="0.8"/>` +
    (v === 0
      ? `<line x1="-2.5" y1="0.3" x2="2.5" y2="0.3" stroke="${c.parasolStripe}" stroke-width="0.3" opacity="0.4"/>`
      : '') +
    `</g>`
  );
}

function svgSandcastleSummer(x: number, y: number, c: AssetColors, v: number): string {
  const sand = c.sandcastleWall;
  if (v === 1) {
    // With flag
    return (
      `<g transform="translate(${x},${y})">` +
      `<rect x="-1.5" y="-1" width="3" height="1.5" fill="${sand}"/>` +
      `<rect x="-0.8" y="-2" width="1.6" height="1" fill="${sand}"/>` +
      `<rect x="-0.4" y="-2.8" width="0.8" height="0.8" fill="${sand}"/>` +
      /* v8 ignore start */
      `<line x1="0" y1="-2.8" x2="0" y2="-3.5" stroke="${c.bareBranch || '#6a5a4a'}" stroke-width="0.2"/>` +
      `<polygon points="0,-3.5 0.8,-3.2 0,-2.9" fill="${c.scarfRed || '#cc3030'}"/>` +
      /* v8 ignore stop */
      `</g>`
    );
  }
  if (v === 2) {
    // Elaborate
    return (
      `<g transform="translate(${x},${y})">` +
      `<rect x="-2" y="-0.5" width="4" height="1" fill="${sand}"/>` +
      `<rect x="-1.5" y="-1.5" width="1.2" height="1" fill="${sand}"/>` +
      `<rect x="0.3" y="-1.5" width="1.2" height="1" fill="${sand}"/>` +
      `<rect x="-0.5" y="-2.5" width="1" height="1" fill="${sand}"/>` +
      `<polygon points="-1.5,-1.5 -0.9,-2 -0.3,-1.5" fill="${sand}" opacity="0.8"/>` +
      `<polygon points="0.3,-1.5 0.9,-2 1.5,-1.5" fill="${sand}" opacity="0.8"/>` +
      `</g>`
    );
  }
  // Simple
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-1.2" y="-0.5" width="2.4" height="1" fill="${sand}"/>` +
    `<rect x="-0.6" y="-1.3" width="1.2" height="0.8" fill="${sand}"/>` +
    `<polygon points="-0.6,-1.3 0,-1.8 0.6,-1.3" fill="${sand}" opacity="0.8"/>` +
    `</g>`
  );
}

function svgSurfboard(x: number, y: number, c: AssetColors, v: number): string {
  const body = c.surfboardBody;
  const stripe = c.surfboardStripe;
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="0" cy="-2" rx="0.8" ry="3" fill="${body}" transform="rotate(${v === 1 ? -10 : v === 2 ? 10 : 5})"/>` +
    `<line x1="0" y1="-3.5" x2="0" y2="-0.5" stroke="${stripe}" stroke-width="0.3" opacity="0.6" transform="rotate(${v === 1 ? -10 : v === 2 ? 10 : 5})"/>` +
    `</g>`
  );
}

function svgIceCreamCartAsset(x: number, y: number, c: AssetColors, v: number): string {
  const cart = c.iceCreamCart;
  const umbrella = c.iceCreamUmbrella;
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-1.5" y="-1.5" width="3" height="2" rx="0.3" fill="${cart}"/>` +
    `<circle cx="-1" cy="0.8" r="0.4" fill="#555"/>` +
    `<circle cx="1" cy="0.8" r="0.4" fill="#555"/>` +
    /* v8 ignore start */
    `<line x1="0" y1="-1.5" x2="0" y2="-3.5" stroke="${c.bareBranch || '#6a5a4a'}" stroke-width="0.3"/>` +
    /* v8 ignore stop */
    `<path d="M-2,-3.5 Q0,-4.5 2,-3.5" fill="${umbrella}"/>` +
    /* v8 ignore start */
    (v === 1
      ? `<polygon points="1.5,-2 2.5,-2.3 1.5,-2.5" fill="${c.scarfRed || '#cc3030'}"/>`
      : '') +
    (v === 2
      ? `<rect x="-0.5" y="-2.5" width="1" height="0.8" rx="0.2" fill="${c.sunflowerPetal || '#f0c820'}"/>`
      : '') +
    /* v8 ignore stop */
    `</g>`
  );
}

function svgHammock(x: number, y: number, c: AssetColors, v: number): string {
  const fabric = c.hammockFabric;
  return (
    `<g transform="translate(${x},${y})">` +
    /* v8 ignore start */
    `<line x1="-3" y1="0" x2="-3" y2="-3" stroke="${c.bareBranch || '#6a5a4a'}" stroke-width="0.5"/>` +
    `<line x1="3" y1="0" x2="3" y2="-3" stroke="${c.bareBranch || '#6a5a4a'}" stroke-width="0.5"/>` +
    /* v8 ignore stop */
    `<path d="M-3,-2.5 Q0,-0.5 3,-2.5" fill="none" stroke="${fabric}" stroke-width="0.8"/>` +
    `<path d="M-2.5,-2.2 Q0,-0.2 2.5,-2.2" fill="${fabric}" opacity="0.5"/>` +
    /* v8 ignore start */
    (v === 2
      ? `<rect x="-1" y="-1.8" width="2" height="1" rx="0.3" fill="${c.beachTowelA || '#e05050'}" opacity="0.4"/>`
      : '') +
    /* v8 ignore stop */
    `</g>`
  );
}

function svgSunflower(x: number, y: number, c: AssetColors, v: number): string {
  const petal = c.sunflowerPetal;
  const center = c.sunflowerCenter;
  /* v8 ignore start */
  const stem = c.tulipStem || '#5a9a40';
  /* v8 ignore stop */
  const count = v === 2 ? 3 : v === 1 ? 2 : 1;
  const parts: string[] = [];
  for (let i = 0; i < count; i++) {
    const ox = i * 1.5 - (count - 1) * 0.75;
    const h = 3 + i * 0.5;
    parts.push(
      `<line x1="${ox}" y1="0.5" x2="${ox}" y2="${-h}" stroke="${stem}" stroke-width="0.4"/>`,
      `<circle cx="${ox}" cy="${-h}" r="0.6" fill="${center}"/>`,
    );
    for (let p = 0; p < 8; p++) {
      const angle = (p / 8) * Math.PI * 2;
      const px = ox + Math.cos(angle) * 1.2;
      const py = -h + Math.sin(angle) * 1.2;
      parts.push(
        `<ellipse cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" rx="0.5" ry="0.25" fill="${petal}" transform="rotate(${(p * 45).toFixed(0)},${px.toFixed(1)},${py.toFixed(1)})"/>`,
      );
    }
  }
  return `<g transform="translate(${x},${y})">${parts.join('')}</g>`;
}

function svgWatermelon(x: number, y: number, c: AssetColors, v: number): string {
  const rind = c.watermelonRind;
  const flesh = c.watermelonFlesh;
  const seed = c.watermelonSeed;
  if (v === 0) {
    // Whole
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="0" cy="0" rx="1.5" ry="1" fill="${rind}"/>` +
      `<line x1="-1" y1="0" x2="1" y2="0" stroke="${rind}" stroke-width="0.15" opacity="0.5"/>` +
      `</g>`
    );
  }
  if (v === 1) {
    // Half
    return (
      `<g transform="translate(${x},${y})">` +
      `<path d="M-1.5,0 A1.5,1 0 0 1 1.5,0 Z" fill="${rind}"/>` +
      `<path d="M-1.2,0 A1.2,0.8 0 0 1 1.2,0 Z" fill="${flesh}"/>` +
      `<circle cx="-0.3" cy="-0.2" r="0.12" fill="${seed}"/>` +
      `<circle cx="0.4" cy="-0.3" r="0.12" fill="${seed}"/>` +
      `</g>`
    );
  }
  // Slice
  return (
    `<g transform="translate(${x},${y})">` +
    `<path d="M-1,0 Q0,-1.5 1,0 Z" fill="${rind}"/>` +
    `<path d="M-0.8,0 Q0,-1.2 0.8,0 Z" fill="${flesh}"/>` +
    `<circle cx="-0.2" cy="-0.3" r="0.1" fill="${seed}"/>` +
    `<circle cx="0.3" cy="-0.4" r="0.1" fill="${seed}"/>` +
    `</g>`
  );
}

function svgSprinkler(x: number, y: number, c: AssetColors, v: number): string {
  const metal = c.sprinklerMetal;
  const water = c.poolWater || c.water;
  return (
    `<g transform="translate(${x},${y})">` +
    `<line x1="0" y1="0.5" x2="0" y2="-0.5" stroke="${metal}" stroke-width="0.5"/>` +
    `<circle cx="0" cy="-0.8" r="0.4" fill="${metal}"/>` +
    `<line x1="-1.5" y1="-2" x2="0" y2="-0.8" stroke="${water}" stroke-width="0.2" opacity="0.4"/>` +
    `<line x1="1.5" y1="-2" x2="0" y2="-0.8" stroke="${water}" stroke-width="0.2" opacity="0.4"/>` +
    `<line x1="0" y1="-2.5" x2="0" y2="-0.8" stroke="${water}" stroke-width="0.2" opacity="0.4"/>` +
    (v === 2
      ? `<path d="M-1.5,-2 Q0,-1.5 1.5,-2" fill="none" stroke="${water}" stroke-width="0.15" opacity="0.3"/>`
      : '') +
    `</g>`
  );
}

function svgLemonade(x: number, y: number, c: AssetColors, v: number): string {
  const stand = c.lemonadeStand;
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-2" y="-1.5" width="4" height="2" fill="${stand}"/>` +
    /* v8 ignore start */
    `<line x1="-2" y1="-1.5" x2="-2" y2="0.8" stroke="${c.bareBranch || '#6a5a4a'}" stroke-width="0.4"/>` +
    `<line x1="2" y1="-1.5" x2="2" y2="0.8" stroke="${c.bareBranch || '#6a5a4a'}" stroke-width="0.4"/>` +
    /* v8 ignore stop */
    (v >= 1
      ? `<rect x="-1" y="-2" width="2" height="0.5" rx="0.2" fill="${stand}" opacity="0.8"/>`
      : '') +
    /* v8 ignore start */
    `<circle cx="0" cy="-0.8" r="0.4" fill="${c.sunflowerPetal || '#f0c820'}" opacity="0.7"/>` +
    /* v8 ignore stop */
    `</g>`
  );
}

function svgFirefliesAsset(x: number, y: number, c: AssetColors, v: number): string {
  /* v8 ignore start */
  const glow = c.lanternGlow || '#ffc840';
  /* v8 ignore stop */
  const count = v === 0 ? 3 : v === 1 ? 6 : 1;
  const parts: string[] = [];
  if (v === 2) {
    // Jar
    parts.push(
      `<rect x="-0.5" y="-2" width="1" height="1.5" rx="0.2" fill="#fff" opacity="0.15"/>`,
    );
    parts.push(`<circle cx="0" cy="-1.5" r="0.2" fill="${glow}" opacity="0.8"/>`);
    parts.push(`<circle cx="-0.2" cy="-1" r="0.15" fill="${glow}" opacity="0.6"/>`);
  } else {
    for (let i = 0; i < count; i++) {
      const fx = (i - count / 2) * 1.5;
      const fy = -1 - i * 0.5;
      parts.push(`<circle cx="${fx}" cy="${fy}" r="0.2" fill="${glow}" opacity="0.7"/>`);
      parts.push(`<circle cx="${fx}" cy="${fy}" r="0.5" fill="${glow}" opacity="0.15"/>`);
    }
  }
  return `<g transform="translate(${x},${y})">${parts.join('')}</g>`;
}

function svgSwimmingPool(x: number, y: number, c: AssetColors, v: number): string {
  const water = c.poolWater;
  const edge = c.poolEdge;
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-3" y="-1" width="6" height="2.5" rx="0.5" fill="${edge}"/>` +
    `<rect x="-2.5" y="-0.5" width="5" height="1.5" rx="0.3" fill="${water}" opacity="0.7"/>` +
    /* v8 ignore start */
    (v === 1
      ? `<ellipse cx="0.5" cy="0" rx="0.8" ry="0.3" fill="${c.parasolYellow || '#e8c820'}" opacity="0.5"/>`
      : '') +
    /* v8 ignore stop */
    (v === 2
      ? `<line x1="2.5" y1="-1" x2="2.5" y2="-2.5" stroke="${edge}" stroke-width="0.3"/>`
      : '') +
    `</g>`
  );
}

// ── Autumn Assets ──────────────────────────────────────────

function svgAutumnMaple(x: number, y: number, c: AssetColors, v: number): string {
  const trunk = c.trunk;
  // v=0: mostly red/crimson, v=1: orange/gold mix, v=2: mixed with falling leaves
  if (v === 1) {
    // Orange-gold variant with layered foliage
    return (
      `<g transform="translate(${x},${y})">` +
      `<rect x="-0.6" y="-1" width="1.2" height="3.5" fill="${trunk}"/>` +
      `<circle cx="0" cy="-4" r="2.2" fill="${c.autumnGold}" opacity="0.7"/>` +
      `<circle cx="-1.5" cy="-3" r="1.5" fill="${c.mapleOrange}" opacity="0.65"/>` +
      `<circle cx="1.5" cy="-3" r="1.5" fill="${c.autumnRust}" opacity="0.6"/>` +
      `<circle cx="0" cy="-5.5" r="1" fill="${c.autumnBronze}" opacity="0.55"/>` +
      `<circle cx="-0.5" cy="-2.5" r="0.8" fill="${c.autumnGold}" opacity="0.5"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // Mixed colors with falling leaves
    return (
      `<g transform="translate(${x},${y})">` +
      `<rect x="-0.6" y="-1" width="1.2" height="3.5" fill="${trunk}"/>` +
      `<circle cx="0" cy="-3.8" r="2" fill="${c.mapleRed}" opacity="0.65"/>` +
      `<circle cx="-1.2" cy="-3" r="1.3" fill="${c.autumnGold}" opacity="0.6"/>` +
      `<circle cx="1.2" cy="-3" r="1.3" fill="${c.mapleCrimson}" opacity="0.55"/>` +
      `<circle cx="0" cy="-5" r="0.9" fill="${c.autumnBronze}" opacity="0.5"/>` +
      `<ellipse cx="-1.5" cy="0.5" rx="0.4" ry="0.15" fill="${c.mapleRed}" opacity="0.5"/>` +
      `<ellipse cx="1" cy="0.3" rx="0.3" ry="0.12" fill="${c.autumnGold}" opacity="0.45"/>` +
      `<ellipse cx="0" cy="0.6" rx="0.35" ry="0.12" fill="${c.mapleOrange}" opacity="0.4"/>` +
      `</g>`
    );
  }
  // v=0: Classic red maple with depth
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-0.6" y="-1" width="1.2" height="3.5" fill="${trunk}"/>` +
    `<circle cx="0" cy="-4" r="2.5" fill="${c.mapleRed}" opacity="0.7"/>` +
    `<circle cx="-1.5" cy="-3" r="1.5" fill="${c.mapleCrimson}" opacity="0.6"/>` +
    `<circle cx="1.5" cy="-3" r="1.5" fill="${c.mapleOrange}" opacity="0.55"/>` +
    `<circle cx="0" cy="-5.5" r="1.2" fill="${c.mapleRed}" opacity="0.5"/>` +
    `<circle cx="-0.8" cy="-2.5" r="0.9" fill="${c.mapleCrimson}" opacity="0.45"/>` +
    `</g>`
  );
}

function svgAutumnOak(x: number, y: number, c: AssetColors, v: number): string {
  const trunk = c.trunk;
  // v=0: gold/bronze, v=1: brown with some green, v=2: burgundy/rust mix
  if (v === 1) {
    // Late autumn with remaining green
    return (
      `<g transform="translate(${x},${y})">` +
      `<rect x="-0.7" y="-1" width="1.4" height="4" fill="${trunk}"/>` +
      `<circle cx="0" cy="-3.5" r="2.8" fill="${c.autumnBronze}" opacity="0.65"/>` +
      `<circle cx="-1.2" cy="-4.5" r="1.5" fill="${c.autumnOlive}" opacity="0.55"/>` +
      `<circle cx="1.5" cy="-4" r="1.3" fill="${c.oakBrown}" opacity="0.6"/>` +
      `<circle cx="-0.5" cy="-2.5" r="1" fill="${c.autumnBronze}" opacity="0.5"/>` +
      `<circle cx="0.5" cy="-5.5" r="0.8" fill="${c.autumnOlive}" opacity="0.4"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // Burgundy/rust dramatic colors
    return (
      `<g transform="translate(${x},${y})">` +
      `<rect x="-0.7" y="-1" width="1.4" height="4" fill="${trunk}"/>` +
      `<circle cx="0" cy="-3.5" r="2.6" fill="${c.autumnRust}" opacity="0.65"/>` +
      `<circle cx="-1.4" cy="-4.2" r="1.4" fill="${c.autumnBurgundy}" opacity="0.6"/>` +
      `<circle cx="1.3" cy="-3.8" r="1.5" fill="${c.autumnBronze}" opacity="0.55"/>` +
      `<circle cx="0" cy="-5.5" r="1" fill="${c.autumnRust}" opacity="0.5"/>` +
      `<ellipse cx="0" cy="0.5" rx="1.5" ry="0.3" fill="${c.autumnBurgundy}" opacity="0.3"/>` +
      `</g>`
    );
  }
  // v=0: Classic gold oak with acorn hints
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-0.7" y="-1" width="1.4" height="4" fill="${trunk}"/>` +
    `<circle cx="0" cy="-3.5" r="2.8" fill="${c.oakGold}" opacity="0.7"/>` +
    `<circle cx="-1.2" cy="-4.5" r="1.5" fill="${c.autumnGold}" opacity="0.6"/>` +
    `<circle cx="1.5" cy="-4" r="1.4" fill="${c.autumnBronze}" opacity="0.55"/>` +
    `<circle cx="-0.5" cy="-2.5" r="1" fill="${c.oakGold}" opacity="0.5"/>` +
    `<ellipse cx="0.8" cy="-2" rx="0.25" ry="0.35" fill="${c.acornBody}"/>` +
    `</g>`
  );
}

function svgAutumnBirch(x: number, y: number, c: AssetColors, v: number): string {
  const yellow = c.birchYellow;
  const bark = c.birchBark;
  if (v === 2) {
    // Half-bare
    return (
      `<g transform="translate(${x},${y})">` +
      `<rect x="-0.4" y="-1" width="0.8" height="4" fill="${bark}"/>` +
      `<line x1="0" y1="-2" x2="-2" y2="-3.5" stroke="${bark}" stroke-width="0.3"/>` +
      `<line x1="0" y1="-3" x2="1.5" y2="-4" stroke="${bark}" stroke-width="0.3"/>` +
      `<circle cx="-1.5" cy="-3.8" r="1" fill="${yellow}" opacity="0.4"/>` +
      `<circle cx="1" cy="-4.2" r="0.8" fill="${yellow}" opacity="0.35"/>` +
      `</g>`
    );
  }
  // Bright yellow / pale gold
  const opacity = v === 1 ? 0.55 : 0.7;
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-0.4" y="-1" width="0.8" height="4" fill="${bark}"/>` +
    `<circle cx="0" cy="-3" r="2" fill="${yellow}" opacity="${opacity}"/>` +
    `<circle cx="-1" cy="-2" r="1.2" fill="${yellow}" opacity="${opacity * 0.8}"/>` +
    `<circle cx="1" cy="-3.5" r="1" fill="${yellow}" opacity="${opacity * 0.7}"/>` +
    `</g>`
  );
}

function svgAutumnGinkgo(x: number, y: number, c: AssetColors, v: number): string {
  const yellow = c.ginkgoYellow;
  const trunk = c.trunk;
  if (v === 1) {
    // Half-fallen
    return (
      `<g transform="translate(${x},${y})">` +
      `<rect x="-0.4" y="-1" width="0.8" height="3" fill="${trunk}"/>` +
      `<circle cx="0" cy="-3" r="1.8" fill="${yellow}" opacity="0.55"/>` +
      `<ellipse cx="0" cy="0.5" rx="2" ry="0.4" fill="${yellow}" opacity="0.3"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // Golden carpet
    return (
      `<g transform="translate(${x},${y})">` +
      `<rect x="-0.4" y="-1" width="0.8" height="3" fill="${trunk}"/>` +
      `<circle cx="0" cy="-3" r="1.5" fill="${yellow}" opacity="0.4"/>` +
      `<ellipse cx="0" cy="0.5" rx="3" ry="0.8" fill="${yellow}" opacity="0.35"/>` +
      `</g>`
    );
  }
  // Full yellow
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-0.4" y="-1" width="0.8" height="3" fill="${trunk}"/>` +
    `<circle cx="0" cy="-3.2" r="2" fill="${yellow}" opacity="0.7"/>` +
    `<circle cx="-0.8" cy="-2.5" r="1" fill="${yellow}" opacity="0.5"/>` +
    `<circle cx="0.8" cy="-2.5" r="1" fill="${yellow}" opacity="0.5"/>` +
    `</g>`
  );
}

function svgFallenLeaves(x: number, y: number, c: AssetColors, v: number): string {
  const colors =
    v === 0
      ? [c.fallenLeafRed, c.fallenLeafOrange]
      : v === 1
        ? [c.fallenLeafGold, c.fallenLeafBrown]
        : [c.fallenLeafRed, c.fallenLeafGold, c.fallenLeafOrange];
  const parts: string[] = [];
  for (let i = 0; i < colors.length; i++) {
    const lx = (i - colors.length / 2) * 1.2;
    const ly = (i % 2) * 0.3;
    const rot = i * 35 - 20;
    parts.push(
      `<ellipse cx="${lx}" cy="${ly}" rx="0.6" ry="0.25" fill="${colors[i]}" opacity="0.7" transform="rotate(${rot},${lx},${ly})"/>`,
    );
  }
  return `<g transform="translate(${x},${y})">${parts.join('')}</g>`;
}

function svgLeafSwirl(x: number, y: number, c: AssetColors, v: number): string {
  const colors =
    v === 1
      ? [c.fallenLeafRed, c.mapleRed]
      : v === 2
        ? [c.fallenLeafGold, c.oakGold]
        : [c.fallenLeafRed, c.fallenLeafOrange, c.fallenLeafGold];
  const parts: string[] = [];
  for (let i = 0; i < colors.length; i++) {
    const angle = (i / colors.length) * Math.PI * 2;
    const radius = 1 + i * 0.3;
    const lx = Math.cos(angle) * radius;
    const ly = -1.5 + Math.sin(angle) * radius * 0.5;
    parts.push(
      `<ellipse cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" rx="0.4" ry="0.2" fill="${colors[i]}" opacity="0.65" transform="rotate(${(i * 60).toFixed(0)},${lx.toFixed(1)},${ly.toFixed(1)})"/>`,
    );
  }
  return `<g transform="translate(${x},${y})">${parts.join('')}</g>`;
}

function svgAcorn(x: number, y: number, c: AssetColors, v: number): string {
  const body = c.acornBody;
  const cap = c.acornCap;
  const count = v === 1 ? 2 : 1;
  const parts: string[] = [];
  for (let i = 0; i < count; i++) {
    const ax = i * 1 - (count - 1) * 0.5;
    if (v === 2) {
      // Cap separated
      parts.push(`<ellipse cx="${ax}" cy="0" rx="0.4" ry="0.5" fill="${body}"/>`);
      parts.push(`<ellipse cx="${ax + 0.5}" cy="0.1" rx="0.4" ry="0.25" fill="${cap}"/>`);
    } else {
      parts.push(`<ellipse cx="${ax}" cy="0" rx="0.4" ry="0.5" fill="${body}"/>`);
      parts.push(`<path d="M${ax - 0.45},-0.15 Q${ax},-0.45 ${ax + 0.45},-0.15" fill="${cap}"/>`);
      parts.push(
        `<line x1="${ax}" y1="-0.35" x2="${ax}" y2="-0.55" stroke="${cap}" stroke-width="0.15"/>`,
      );
    }
  }
  return `<g transform="translate(${x},${y})">${parts.join('')}</g>`;
}

function svgPumpkinPatch(x: number, y: number, c: AssetColors, v: number): string {
  // Cluster of pumpkins with vines
  const pumpkin = c.pumpkin;
  const stem = c.trunk;
  /* v8 ignore start */
  const vine = c.autumnOlive || '#8b8b40';
  /* v8 ignore stop */
  if (v === 1) {
    // Three pumpkins
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="-1" cy="0" rx="1" ry="0.7" fill="${pumpkin}"/>` +
      `<rect x="-1.15" y="-0.7" width="0.3" height="0.4" fill="${stem}"/>` +
      `<ellipse cx="0.8" cy="0.2" rx="0.8" ry="0.6" fill="${pumpkin}"/>` +
      `<rect x="0.65" y="-0.4" width="0.25" height="0.35" fill="${stem}"/>` +
      `<ellipse cx="0" cy="0.5" rx="0.6" ry="0.45" fill="${pumpkin}" opacity="0.9"/>` +
      `<path d="M-1.5,-0.3 Q-2,-0.8 -1.5,-1.2" stroke="${vine}" fill="none" stroke-width="0.15"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // Single large pumpkin
    return (
      `<g transform="translate(${x},${y})">` +
      `<ellipse cx="0" cy="0" rx="1.4" ry="1" fill="${pumpkin}"/>` +
      /* v8 ignore start */
      `<line x1="-0.5" y1="-0.9" x2="-0.5" y2="0.9" stroke="${c.autumnRust || '#c05530'}" stroke-width="0.1" opacity="0.3"/>` +
      `<line x1="0.5" y1="-0.9" x2="0.5" y2="0.9" stroke="${c.autumnRust || '#c05530'}" stroke-width="0.1" opacity="0.3"/>` +
      /* v8 ignore stop */
      `<rect x="-0.15" y="-1" width="0.3" height="0.5" fill="${stem}"/>` +
      `<path d="M0.1,-0.8 Q0.8,-1.2 1.2,-0.8" stroke="${vine}" fill="none" stroke-width="0.12"/>` +
      `</g>`
    );
  }
  // Default: two pumpkins
  return (
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="-0.6" cy="0" rx="0.9" ry="0.65" fill="${pumpkin}"/>` +
    `<rect x="-0.75" y="-0.65" width="0.25" height="0.35" fill="${stem}"/>` +
    `<ellipse cx="0.7" cy="0.15" rx="0.7" ry="0.5" fill="${pumpkin}" opacity="0.9"/>` +
    `<rect x="0.55" y="-0.35" width="0.22" height="0.3" fill="${stem}"/>` +
    `<path d="M-1,-0.2 Q-1.5,-0.5 -1.3,-1" stroke="${vine}" fill="none" stroke-width="0.12"/>` +
    `</g>`
  );
}

function svgHayMaze(x: number, y: number, c: AssetColors, v: number): string {
  // Hay bale maze for autumn festival
  const hay = c.haybale;
  /* v8 ignore start */
  const accent = c.autumnGold || '#d4a84b';
  /* v8 ignore stop */
  if (v === 1) {
    // L-shape arrangement
    return (
      `<g transform="translate(${x},${y})">` +
      `<rect x="-2" y="-0.8" width="4" height="1.2" rx="0.2" fill="${hay}"/>` +
      `<rect x="-2" y="-2" width="1.2" height="1.3" rx="0.2" fill="${hay}"/>` +
      `<line x1="-1.5" y1="-0.7" x2="-1.5" y2="0.3" stroke="${accent}" stroke-width="0.08"/>` +
      `<line x1="0" y1="-0.7" x2="0" y2="0.3" stroke="${accent}" stroke-width="0.08"/>` +
      `<line x1="1.5" y1="-0.7" x2="1.5" y2="0.3" stroke="${accent}" stroke-width="0.08"/>` +
      `</g>`
    );
  }
  // Default: single stack
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-1.5" y="-0.5" width="3" height="1" rx="0.2" fill="${hay}"/>` +
    `<rect x="-1" y="-1.3" width="2" height="0.9" rx="0.2" fill="${hay}" opacity="0.9"/>` +
    `<line x1="-0.8" y1="-0.4" x2="-0.8" y2="0.4" stroke="${accent}" stroke-width="0.08"/>` +
    `<line x1="0.8" y1="-0.4" x2="0.8" y2="0.4" stroke="${accent}" stroke-width="0.08"/>` +
    `</g>`
  );
}

function svgAppleBasket(x: number, y: number, c: AssetColors, v: number): string {
  // Basket full of apples
  /* v8 ignore start */
  const basket = c.nestBrown || '#7a5530';
  const apple = c.appleRed || '#c41e3a';
  const green = c.pearGreen || '#d1e231';
  /* v8 ignore stop */
  if (v === 1) {
    // Overflowing basket
    return (
      `<g transform="translate(${x},${y})">` +
      `<path d="M-1.2,0 Q-1.5,-1 0,-1 Q1.5,-1 1.2,0 L1,0.3 L-1,0.3 Z" fill="${basket}"/>` +
      `<circle cx="-0.5" cy="-0.8" r="0.4" fill="${apple}"/>` +
      `<circle cx="0.3" cy="-0.9" r="0.35" fill="${apple}"/>` +
      `<circle cx="0" cy="-0.5" r="0.4" fill="${green}"/>` +
      `<circle cx="-0.2" cy="-1.3" r="0.35" fill="${apple}"/>` +
      `<circle cx="0.5" cy="-0.4" r="0.3" fill="${apple}" opacity="0.9"/>` +
      `<path d="M-0.5,0.3 Q0,-0.2 0.5,0.3" stroke="${basket}" fill="none" stroke-width="0.1"/>` +
      `</g>`
    );
  }
  // Default basket
  return (
    `<g transform="translate(${x},${y})">` +
    `<path d="M-1,0 Q-1.3,-0.8 0,-0.8 Q1.3,-0.8 1,0 L0.8,0.2 L-0.8,0.2 Z" fill="${basket}"/>` +
    `<circle cx="-0.3" cy="-0.5" r="0.35" fill="${apple}"/>` +
    `<circle cx="0.3" cy="-0.6" r="0.3" fill="${apple}"/>` +
    `<circle cx="0" cy="-0.3" r="0.3" fill="${green}"/>` +
    `<path d="M-0.4,0.2 Q0,-0.1 0.4,0.2" stroke="${basket}" fill="none" stroke-width="0.08"/>` +
    `</g>`
  );
}

function svgRake(x: number, y: number, c: AssetColors, v: number): string {
  // Garden rake with leaves
  const handle = c.trunk;
  /* v8 ignore start */
  const metal = c.sledRunner || '#607080';
  const leaf = c.fallenLeafOrange || '#d08030';
  /* v8 ignore stop */
  if (v === 1) {
    // Rake with pile of leaves
    return (
      `<g transform="translate(${x},${y})">` +
      `<line x1="-1" y1="1" x2="1.5" y2="-3" stroke="${handle}" stroke-width="0.3"/>` +
      `<rect x="0.8" y="-3.2" width="1.5" height="0.3" fill="${metal}"/>` +
      `<line x1="0.9" y1="-3" x2="0.9" y2="-2.2" stroke="${metal}" stroke-width="0.12"/>` +
      `<line x1="1.3" y1="-3" x2="1.3" y2="-2.2" stroke="${metal}" stroke-width="0.12"/>` +
      `<line x1="1.7" y1="-3" x2="1.7" y2="-2.2" stroke="${metal}" stroke-width="0.12"/>` +
      `<line x1="2.1" y1="-3" x2="2.1" y2="-2.2" stroke="${metal}" stroke-width="0.12"/>` +
      `<ellipse cx="-1.5" cy="0.8" rx="1.2" ry="0.5" fill="${leaf}" opacity="0.6"/>` +
      /* v8 ignore start */
      `<ellipse cx="-1.2" cy="0.5" rx="0.8" ry="0.3" fill="${c.fallenLeafRed || '#c04030'}" opacity="0.5"/>` +
      /* v8 ignore stop */
      `</g>`
    );
  }
  // Simple rake
  return (
    `<g transform="translate(${x},${y})">` +
    `<line x1="0" y1="0.5" x2="0" y2="-2.5" stroke="${handle}" stroke-width="0.25"/>` +
    `<rect x="-0.8" y="-2.7" width="1.6" height="0.25" fill="${metal}"/>` +
    `<line x1="-0.6" y1="-2.5" x2="-0.6" y2="-1.8" stroke="${metal}" stroke-width="0.1"/>` +
    `<line x1="-0.2" y1="-2.5" x2="-0.2" y2="-1.8" stroke="${metal}" stroke-width="0.1"/>` +
    `<line x1="0.2" y1="-2.5" x2="0.2" y2="-1.8" stroke="${metal}" stroke-width="0.1"/>` +
    `<line x1="0.6" y1="-2.5" x2="0.6" y2="-1.8" stroke="${metal}" stroke-width="0.1"/>` +
    `</g>`
  );
}

function svgCornStalkAsset(x: number, y: number, c: AssetColors, v: number): string {
  const stalk = c.cornStalkColor;
  const ear = c.cornEar;
  const count = v === 1 ? 3 : 1;
  const parts: string[] = [];
  for (let i = 0; i < count; i++) {
    const sx = i * 1.2 - (count - 1) * 0.6;
    parts.push(
      `<line x1="${sx}" y1="0.5" x2="${sx}" y2="-3" stroke="${stalk}" stroke-width="0.4"/>`,
    );
    if (v === 2 || v === 0) {
      parts.push(`<ellipse cx="${sx + 0.5}" cy="-1.5" rx="0.3" ry="0.7" fill="${ear}"/>`);
    }
    parts.push(
      `<path d="M${sx},-2 Q${sx + 1.5},-2.5 ${sx + 1},-1" fill="${stalk}" opacity="0.5"/>`,
    );
    parts.push(
      `<path d="M${sx},-1.5 Q${sx - 1.5},-2 ${sx - 1},-0.5" fill="${stalk}" opacity="0.5"/>`,
    );
  }
  return `<g transform="translate(${x},${y})">${parts.join('')}</g>`;
}

function svgScarecrowAutumn(x: number, y: number, c: AssetColors, v: number): string {
  /* v8 ignore start */
  const hat = c.scarecrowHat || '#5a4020';
  const body = c.scarecrow || '#8a7040';
  /* v8 ignore stop */
  if (v === 1) {
    // With crow
    return (
      `<g transform="translate(${x},${y})">` +
      `<line x1="0" y1="1" x2="0" y2="-3" stroke="${body}" stroke-width="0.5"/>` +
      `<line x1="-2" y1="-1.5" x2="2" y2="-1.5" stroke="${body}" stroke-width="0.4"/>` +
      /* v8 ignore start */
      `<circle cx="0" cy="-3.5" r="0.8" fill="${c.lambWool || '#f0ece5'}"/>` +
      /* v8 ignore stop */
      `<rect x="-1.2" y="-4.5" width="2.4" height="0.5" fill="${hat}"/>` +
      `<rect x="-0.7" y="-5" width="1.4" height="0.6" fill="${hat}"/>` +
      `<circle cx="1.8" cy="-2" r="0.4" fill="#333"/>` +
      `<polygon points="1.8,-2 2.5,-2.1 1.8,-1.8" fill="#333"/>` +
      `</g>`
    );
  }
  if (v === 2) {
    // With pumpkin head
    return (
      `<g transform="translate(${x},${y})">` +
      `<line x1="0" y1="1" x2="0" y2="-3" stroke="${body}" stroke-width="0.5"/>` +
      `<line x1="-2" y1="-1.5" x2="2" y2="-1.5" stroke="${body}" stroke-width="0.4"/>` +
      /* v8 ignore start */
      `<circle cx="0" cy="-3.8" r="1" fill="${c.pumpkin || '#d07020'}"/>` +
      /* v8 ignore stop */
      `<polygon points="-0.3,-3.8 0,-4.3 0.3,-3.8" fill="#333"/>` +
      `<polygon points="0,-3.5 0.5,-3.3 0,-3.2" fill="#333"/>` +
      `</g>`
    );
  }
  // Classic
  return (
    `<g transform="translate(${x},${y})">` +
    `<line x1="0" y1="1" x2="0" y2="-3" stroke="${body}" stroke-width="0.5"/>` +
    `<line x1="-2" y1="-1.5" x2="2" y2="-1.5" stroke="${body}" stroke-width="0.4"/>` +
    /* v8 ignore start */
    `<circle cx="0" cy="-3.5" r="0.8" fill="${c.lambWool || '#f0ece5'}"/>` +
    /* v8 ignore stop */
    `<rect x="-1.2" y="-4.5" width="2.4" height="0.5" fill="${hat}"/>` +
    `<rect x="-0.7" y="-5" width="1.4" height="0.6" fill="${hat}"/>` +
    `<ellipse cx="0" cy="-1" rx="1.2" ry="1.5" fill="${body}" opacity="0.5"/>` +
    /* v8 ignore start */
    `<ellipse cx="-1" cy="-1.8" rx="0.4" ry="0.2" fill="${c.fallenLeafRed || '#c04030'}"/>` +
    /* v8 ignore stop */
    `</g>`
  );
}

function svgHarvestBasket(x: number, y: number, c: AssetColors, v: number): string {
  /* v8 ignore start */
  const basket = c.oakBrown || '#8a6030';
  /* v8 ignore stop */
  const contents =
    v === 0
      ? [c.harvestApple, c.harvestApple]
      : v === 1
        ? /* v8 ignore start */
          [c.sproutGreen || '#80d050', c.harvestApple, c.sunflowerPetal || '#f0c820']
        : /* v8 ignore stop */
          [c.harvestGrape, c.harvestGrape];
  return (
    `<g transform="translate(${x},${y})">` +
    `<path d="M-1.5,0 Q-1.8,-1 -1,-1.5 Q0,-1.8 1,-1.5 Q1.8,-1 1.5,0 Z" fill="${basket}"/>` +
    `<path d="M-1,-1.3 Q0,-2 1,-1.3" fill="none" stroke="${basket}" stroke-width="0.3"/>` +
    contents
      .map(
        (col, i) =>
          `<circle cx="${(i - (contents.length - 1) / 2) * 0.6}" cy="-1" r="0.35" fill="${col}"/>`,
      )
      .join('') +
    `</g>`
  );
}

function svgHotDrink(x: number, y: number, c: AssetColors, v: number): string {
  const mug = c.hotDrinkMug;
  const steam = c.hotDrinkSteam;
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect x="-0.6" y="-1" width="1.2" height="1.2" rx="0.2" fill="${mug}"/>` +
    `<path d="M0.6,-0.5 Q1.2,-0.5 1.2,-0.1 Q1.2,0.2 0.6,0.2" fill="none" stroke="${mug}" stroke-width="0.2"/>` +
    `<path d="M-0.3,-1.2 Q-0.3,-1.8 0,-1.5 Q0.3,-1.8 0.3,-1.2" fill="none" stroke="${steam}" stroke-width="0.2" opacity="0.5"/>` +
    (v >= 1
      ? `<path d="M0,-1.5 Q0.2,-2 0,-2.2" fill="none" stroke="${steam}" stroke-width="0.15" opacity="0.4"/>`
      : '') +
    `</g>`
  );
}

function svgAutumnWreath(x: number, y: number, c: AssetColors, v: number): string {
  const green = c.wreathGreen;
  const berry = c.wreathBerry;
  return (
    `<g transform="translate(${x},${y})">` +
    `<circle cx="0" cy="-1.5" r="1.5" fill="none" stroke="${green}" stroke-width="0.8"/>` +
    `<circle cx="0" cy="-1.5" r="1.2" fill="none" stroke="${green}" stroke-width="0.4" opacity="0.5"/>` +
    (v >= 1
      ? `<circle cx="0.8" cy="-0.8" r="0.2" fill="${berry}"/><circle cx="1" cy="-1" r="0.2" fill="${berry}"/>`
      : '') +
    /* v8 ignore start */
    (v === 2
      ? `<path d="M-0.3,-0.2 Q0,0.2 0.3,-0.2" fill="${c.scarfRed || '#cc3030'}" opacity="0.7"/>`
      : '') +
    /* v8 ignore stop */
    `</g>`
  );
}

// ── Render Dispatcher ───────────────────────────────────────

const RENDERERS: Record<AssetType, (x: number, y: number, c: AssetColors, v: number) => string> = {
  // Water
  whale: svgWhale,
  fish: svgFish,
  fishSchool: svgFishSchool,
  boat: svgBoat,
  seagull: svgSeagull,
  dock: svgDock,
  waves: svgWaves,
  kelp: svgKelp,
  coral: svgCoral,
  jellyfish: svgJellyfish,
  turtle: svgTurtle,
  buoy: svgBuoy,
  sailboat: svgSailboat,
  lighthouse: svgLighthouse,
  crab: svgCrab,
  // Shore/Wetland
  rock: svgRock,
  boulder: svgBoulder,
  flower: svgFlower,
  bush: svgBush,
  driftwood: svgDriftwood,
  sandcastle: svgSandcastle,
  tidePools: svgTidePools,
  heron: svgHeron,
  shellfish: svgShellfish,
  cattail: svgCattail,
  frog: svgFrog,
  lily: svgLily,
  // Grassland
  pine: svgPine,
  deciduous: svgDeciduous,
  mushroom: svgMushroom,
  stump: svgStump,
  deer: svgDeer,
  rabbit: svgRabbit,
  fox: svgFox,
  butterfly: svgButterfly,
  beehive: svgBeehive,
  wildflowerPatch: svgWildflowerPatch,
  tallGrass: svgTallGrass,
  birch: svgBirch,
  haybale: svgHaybale,
  // Forest
  willow: svgWillow,
  palm: svgPalm,
  bird: svgBird,
  owl: svgOwl,
  squirrel: svgSquirrel,
  moss: svgMoss,
  fern: svgFern,
  deadTree: svgDeadTree,
  log: svgLog,
  berryBush: svgBerryBush,
  spider: svgSpider,
  // Farm
  wheat: svgWheat,
  fence: svgFence,
  scarecrow: svgScarecrow,
  barn: svgBarn,
  sheep: svgSheep,
  cow: svgCow,
  chicken: svgChicken,
  horse: svgHorse,
  donkey: svgDonkey,
  goat: svgGoat,
  ricePaddy: svgRicePaddy,
  silo: svgSilo,
  pigpen: svgPigpen,
  trough: svgTrough,
  haystack: svgHaystack,
  orchard: svgOrchard,
  appleTree: svgAppleTree,
  oliveTree: svgOliveTree,
  lemonTree: svgLemonTree,
  orangeTree: svgOrangeTree,
  pearTree: svgPearTree,
  peachTree: svgPeachTree,
  beeFarm: svgBeeFarm,
  pumpkin: svgPumpkin,
  // Village
  tent: svgTent,
  hut: svgHut,
  house: svgHouse,
  houseB: svgHouseB,
  church: svgChurch,
  windmill: svgWindmill,
  well: svgWell,
  tavern: svgTavern,
  bakery: svgBakery,
  stable: svgStable,
  garden: svgGarden,
  laundry: svgLaundry,
  doghouse: svgDoghouse,
  shrine: svgShrine,
  wagon: svgWagon,
  // Town/City
  market: svgMarket,
  inn: svgInn,
  blacksmith: svgBlacksmith,
  castle: svgCastle,
  tower: svgTower,
  bridge: svgBridge,
  cathedral: svgCathedral,
  library: svgLibrary,
  clocktower: svgClocktower,
  statue: svgStatue,
  park: svgPark,
  warehouse: svgWarehouse,
  gatehouse: svgGatehouse,
  manor: svgManor,
  // Biome blend
  reeds: svgReeds,
  fountain: svgFountain,
  canal: svgCanal,
  watermill: svgWatermill,
  gardenTree: svgGardenTree,
  pondLily: svgPondLily,
  // Cross-level
  cart: svgCart,
  barrel: svgBarrel,
  torch: svgTorch,
  flag: svgFlag,
  cobblePath: svgCobblePath,
  smoke: svgSmoke,
  signpost: svgSignpost,
  lantern: svgLantern,
  woodpile: svgWoodpile,
  puddle: svgPuddle,
  campfire: svgCampfire,
  // Seasonal: Winter
  snowPine: svgSnowPine,
  snowDeciduous: svgSnowDeciduous,
  snowman: svgSnowman,
  snowdrift: svgSnowdrift,
  igloo: svgIgloo,
  frozenPond: svgFrozenPond,
  icicle: svgIcicle,
  sled: svgSled,
  snowCoveredRock: svgSnowCoveredRock,
  bareBush: svgBareBush,
  winterBird: svgWinterBird,
  firewood: svgFirewood,
  houseWinter: svgHouseWinter,
  houseBWinter: svgHouseBWinter,
  barnWinter: svgBarnWinter,
  churchWinter: svgChurchWinter,
  christmasTree: svgChristmasTree,
  winterLantern: svgWinterLantern,
  frozenFountain: svgFrozenFountain,
  // Seasonal: Spring
  cherryBlossom: svgCherryBlossom,
  cherryBlossomSmall: svgCherryBlossomSmall,
  cherryPetals: svgCherryPetals,
  tulip: svgTulip,
  tulipField: svgTulipField,
  sprout: svgSprout,
  nest: svgNest,
  lamb: svgLamb,
  crocus: svgCrocus,
  rainPuddle: svgRainPuddle,
  birdhouse: svgBirdhouse,
  gardenBed: svgGardenBed,
  cherryBlossomFull: svgCherryBlossomFull,
  cherryBlossomBranch: svgCherryBlossomBranch,
  peachBlossom: svgPeachBlossom,
  flowerBed: svgFlowerBed,
  wateringCan: svgWateringCan,
  seedling: svgSeedling,
  robinBird: svgRobinBird,
  butterflyGarden: svgButterflyGarden,
  umbrella: svgUmbrella,
  // Seasonal: Summer
  parasol: svgParasol,
  beachTowel: svgBeachTowel,
  sandcastleSummer: svgSandcastleSummer,
  surfboard: svgSurfboard,
  iceCreamCart: svgIceCreamCartAsset,
  hammock: svgHammock,
  sunflower: svgSunflower,
  watermelon: svgWatermelon,
  sprinkler: svgSprinkler,
  lemonade: svgLemonade,
  fireflies: svgFirefliesAsset,
  swimmingPool: svgSwimmingPool,
  // Seasonal: Autumn
  autumnMaple: svgAutumnMaple,
  autumnOak: svgAutumnOak,
  autumnBirch: svgAutumnBirch,
  autumnGinkgo: svgAutumnGinkgo,
  fallenLeaves: svgFallenLeaves,
  leafSwirl: svgLeafSwirl,
  acorn: svgAcorn,
  cornStalk: svgCornStalkAsset,
  scarecrowAutumn: svgScarecrowAutumn,
  harvestBasket: svgHarvestBasket,
  hotDrink: svgHotDrink,
  autumnWreath: svgAutumnWreath,
  pumpkinPatch: svgPumpkinPatch,
  hayMaze: svgHayMaze,
  appleBasket: svgAppleBasket,
  rake: svgRake,
};

// ── Public API ──────────────────────────────────────────────

export function renderTerrainAssets(
  isoCells: IsoCell[],
  seed: number,
  palette: TerrainPalette100,
  variantSeed?: number,
  biomeMap?: Map<string, BiomeContext>,
  density: number = 5,
): string {
  const placed = selectAssets(isoCells, seed, variantSeed, biomeMap, undefined, density);
  const c = palette.assets;

  const svgParts = placed.map((a) => {
    const renderer = RENDERERS[a.type];
    return renderer(a.cx + a.ox, a.cy + a.oy, c, a.variant);
  });

  return `<g class="terrain-assets">${svgParts.join('')}</g>`;
}

/**
 * Render seasonal terrain assets.
 * Uses per-week seasonal palette and asset pool overrides.
 */
export function renderSeasonalTerrainAssets(
  isoCells: IsoCell[],
  seed: number,
  weekPalettes: TerrainPalette100[],
  variantSeed?: number,
  biomeMap?: Map<string, BiomeContext>,
  seasonRotation?: number,
  density: number = 5,
): string {
  const placed = selectAssets(isoCells, seed, variantSeed, biomeMap, seasonRotation, density);

  const svgParts = placed.map((a) => {
    // Use per-week palette for this cell's week
    const weekIdx = Math.min(a.cell.week, weekPalettes.length - 1);
    const palette = weekPalettes[weekIdx];
    const c = palette.assets;
    const renderer = RENDERERS[a.type];
    return renderer(a.cx + a.ox, a.cy + a.oy, c, a.variant);
  });

  return `<g class="terrain-assets">${svgParts.join('')}</g>`;
}

export function renderAssetCSS(): string {
  return [
    `@keyframes tree-sway { 0% { transform: rotate(-1.5deg); } 50% { transform: rotate(1.5deg); } 100% { transform: rotate(-1.5deg); } }`,
  ].join('\n');
}
