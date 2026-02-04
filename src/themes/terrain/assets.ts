import type { IsoCell } from './blocks.js';
import type { TerrainPalette100, AssetColors } from './palette.js';
import type { BiomeContext } from './biomes.js';
import { seededRandom } from '../../utils/math.js';

// ── Asset Type Definitions (38 total) ───────────────────────

type AssetType =
  // Water (0–5)
  | 'whale' | 'fish' | 'fishSchool' | 'boat' | 'seagull' | 'dock' | 'waves'
  // Shore (6–15)
  | 'rock' | 'boulder' | 'flower' | 'bush'
  // Grassland (16–30)
  | 'pine' | 'deciduous' | 'mushroom' | 'stump' | 'deer'
  // Forest (31–60)
  | 'willow' | 'palm' | 'bird'
  // Farm (61–80)
  | 'wheat' | 'fence' | 'scarecrow' | 'barn' | 'sheep' | 'cow' | 'chicken' | 'horse' | 'ricePaddy'
  // Village (81–90)
  | 'tent' | 'hut' | 'house' | 'houseB' | 'church' | 'windmill' | 'well'
  // Town (91–99)
  | 'market' | 'inn' | 'blacksmith' | 'castle' | 'tower' | 'bridge'
  // Biome blend
  | 'reeds' | 'fountain' | 'canal' | 'watermill' | 'gardenTree' | 'pondLily'
  // Cross-level decorations
  | 'cart' | 'barrel' | 'torch' | 'flag' | 'cobblePath' | 'smoke';

interface PlacedAsset {
  cell: IsoCell;
  type: AssetType;
  cx: number;
  cy: number;
  ox: number;
  oy: number;
}

// ── Level100 → Asset Pool ───────────────────────────────────

interface AssetPool {
  types: AssetType[];
  chance: number;
}

function getLevelPool100(level: number): AssetPool {
  // Desert (0–8): barren, rocks, occasional cactus-like features
  if (level <= 4)  return { types: ['rock', 'boulder', 'stump'], chance: 0.06 };
  if (level <= 8)  return { types: ['rock', 'boulder', 'bush', 'stump'], chance: 0.10 };
  // Water / Oasis (9–22): aquatic life
  if (level <= 14) return { types: ['whale', 'fish', 'fishSchool', 'boat', 'seagull', 'dock', 'waves'], chance: 0.16 };
  if (level <= 22) return { types: ['fish', 'fishSchool', 'boat', 'seagull', 'waves', 'dock'], chance: 0.18 };
  // Shore / Wetland (23–30): transition to green
  if (level <= 27) return { types: ['rock', 'boulder', 'flower', 'bush', 'bird'], chance: 0.16 };
  if (level <= 30) return { types: ['bush', 'flower', 'rock', 'fence'], chance: 0.18 };
  // Grassland (31–42): open plains
  if (level <= 36) return { types: ['bush', 'flower', 'mushroom', 'deer', 'bird'], chance: 0.22 };
  if (level <= 42) return { types: ['pine', 'deciduous', 'bush', 'mushroom', 'flower', 'deer'], chance: 0.25 };
  // Forest (43–65): dense green
  if (level <= 52) return { types: ['pine', 'pine', 'deciduous', 'willow', 'bird', 'bush'], chance: 0.30 };
  if (level <= 58) return { types: ['pine', 'deciduous', 'willow', 'palm', 'bird', 'pine', 'stump'], chance: 0.32 };
  if (level <= 65) return { types: ['deciduous', 'willow', 'pine', 'palm', 'bird', 'mushroom'], chance: 0.28 };
  // Farm (66–78): livestock + crops
  if (level <= 70) return { types: ['wheat', 'fence', 'sheep', 'chicken', 'bush', 'ricePaddy'], chance: 0.30 };
  if (level <= 75) return { types: ['wheat', 'fence', 'scarecrow', 'cow', 'sheep', 'chicken', 'horse', 'ricePaddy'], chance: 0.35 };
  if (level <= 78) return { types: ['barn', 'sheep', 'cow', 'horse', 'wheat', 'fence', 'chicken', 'cart', 'ricePaddy'], chance: 0.38 };
  // Village (79–90): buildings emerge
  if (level <= 84) return { types: ['tent', 'hut', 'house', 'well', 'fence', 'sheep', 'barrel'], chance: 0.38 };
  if (level <= 90) return { types: ['house', 'houseB', 'church', 'windmill', 'well', 'barrel', 'torch'], chance: 0.42 };
  // Town / City (91–99): dense civilization with nature
  if (level <= 95) return { types: ['house', 'houseB', 'market', 'inn', 'windmill', 'flag', 'cobblePath', 'torch', 'gardenTree', 'flower', 'bush'], chance: 0.48 };
  return { types: ['castle', 'tower', 'church', 'market', 'inn', 'blacksmith', 'bridge', 'flag', 'cobblePath', 'gardenTree', 'flower', 'fountain'], chance: 0.55 };
}

// ── Biome-Aware Blending ─────────────────────────────────────

function blendWithBiome(pool: AssetPool, ctx: BiomeContext, level: number): AssetPool {
  const types = [...pool.types];
  let chance = pool.chance;

  if (ctx.isRiver) {
    // River cells get water assets adapted to surrounding level
    if (level >= 91)      types.push('bridge', 'canal');
    else if (level >= 66) types.push('watermill', 'canal', 'reeds');
    else if (level >= 31) types.push('reeds', 'reeds', 'willow');
    else                  types.push('reeds', 'pondLily');
    chance = Math.max(chance, 0.35);
  } else if (ctx.isPond) {
    // Pond cells get pond-specific decorations
    if (level >= 79) types.push('fountain', 'pondLily', 'reeds');
    else             types.push('pondLily', 'pondLily', 'reeds');
    chance = Math.max(chance, 0.30);
  } else if (ctx.nearWater) {
    // Adjacent to water: edge vegetation
    if (level >= 79) types.push('fountain', 'gardenTree');
    else             types.push('willow', 'reeds', 'bush');
    chance += 0.05;
  }

  if (ctx.forestDensity > 0.3) {
    // Forest overlay: add trees adapted to the level
    const treesToAdd = ctx.forestDensity > 0.6 ? 3 : 1;
    for (let i = 0; i < treesToAdd; i++) {
      if (level >= 91)      types.push('gardenTree', 'flower');
      else if (level >= 79) types.push('gardenTree');
      else if (level >= 43) types.push('pine', 'deciduous');
      else                  types.push('pine');
    }
    chance += ctx.forestDensity * 0.08;
  }

  // Unconditional high-level greenery: towns and cities always get some nature
  if (level >= 96) {
    types.push('gardenTree', 'fountain');
  } else if (level >= 91) {
    types.push('gardenTree');
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

// ── Asset Selection ─────────────────────────────────────────

export function selectAssets(
  isoCells: IsoCell[],
  seed: number,
  biomeMap?: Map<string, BiomeContext>,
): PlacedAsset[] {
  const rng = seededRandom(seed);
  const assets: PlacedAsset[] = [];
  const smokeBudget = { remaining: 5 };

  const cellMap = new Map<string, IsoCell>();
  for (const cell of isoCells) {
    cellMap.set(`${cell.week},${cell.day}`, cell);
  }

  for (const cell of isoCells) {
    let pool = getLevelPool100(cell.level100);
    const biomeCtx = biomeMap?.get(`${cell.week},${cell.day}`);
    if (biomeCtx) pool = blendWithBiome(pool, biomeCtx, cell.level100);

    const richness = computeRichness(cell, cellMap);
    const finalChance = pool.chance + richness * 0.20;

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

      assets.push({ cell, type, cx: cell.isoX, cy: cell.isoY, ox, oy });

      // High richness areas can get a second asset
      if (richness > 0.5 && cell.level100 >= 30 && rng() < 0.3) {
        let type2 = pool.types[Math.floor(rng() * pool.types.length)];
        if (type2 === 'smoke' && smokeBudget.remaining <= 0) type2 = 'torch';
        else if (type2 === 'smoke') smokeBudget.remaining--;

        assets.push({
          cell, type: type2,
          cx: cell.isoX, cy: cell.isoY,
          ox: (rng() - 0.5) * 4, oy: (rng() - 0.5) * 2,
        });
      }
    }
  }

  return assets;
}

// ── SVG Renderers ─────────────────────────────────────────

// Water assets

function svgWhale(x: number, y: number, c: AssetColors): string {
  // Redesigned: rounder body, HORIZONTAL tail fluke, water spout
  return `<g transform="translate(${x},${y})">`
    + `<ellipse cx="0" cy="-1.2" rx="3.5" ry="2" fill="${c.whale}"/>`
    + `<ellipse cx="0" cy="-0.5" rx="2.5" ry="1" fill="${c.whaleBelly}" opacity="0.5"/>`
    // Horizontal tail fluke (key identifier)
    + `<path d="M3,-1.2 Q4.5,-1.2 5,-2.5 M3,-1.2 Q4.5,-1.2 5,0" stroke="${c.whale}" fill="none" stroke-width="1"/>`
    + `<ellipse cx="5" cy="-2.5" rx="1.2" ry="0.4" fill="${c.whale}"/>`
    + `<ellipse cx="5" cy="0" rx="1.2" ry="0.4" fill="${c.whale}"/>`
    // Eye
    + `<circle cx="-2" cy="-1.5" r="0.4" fill="#fff"/>`
    + `<circle cx="-2" cy="-1.5" r="0.2" fill="#222"/>`
    // Spout (3 diverging lines)
    + `<line x1="-0.5" y1="-3.2" x2="-1.2" y2="-4.5" stroke="${c.waterLight}" stroke-width="0.3" opacity="0.6"/>`
    + `<line x1="-0.5" y1="-3.2" x2="-0.5" y2="-4.8" stroke="${c.waterLight}" stroke-width="0.3" opacity="0.6"/>`
    + `<line x1="-0.5" y1="-3.2" x2="0.2" y2="-4.5" stroke="${c.waterLight}" stroke-width="0.3" opacity="0.6"/>`
    + `</g>`;
}

function svgFish(x: number, y: number, c: AssetColors): string {
  // Redesigned: slender body, VERTICAL tail fin
  return `<g transform="translate(${x},${y})">`
    + `<ellipse cx="0" cy="-0.8" rx="1.8" ry="0.7" fill="${c.fish}"/>`
    // Vertical tail fin (key differentiator from whale)
    + `<polygon points="1.8,-0.8 2.8,-2 2.8,0.4" fill="${c.fish}"/>`
    + `<circle cx="-1" cy="-0.9" r="0.25" fill="#fff"/>`
    + `</g>`;
}

function svgFishSchool(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    + `<ellipse cx="-1" cy="-0.5" rx="1" ry="0.4" fill="${c.fish}" opacity="0.8"/>`
    + `<ellipse cx="1" cy="-1.2" rx="0.8" ry="0.35" fill="${c.fish}" opacity="0.7"/>`
    + `<ellipse cx="0.5" cy="0" rx="0.9" ry="0.4" fill="${c.fish}" opacity="0.6"/>`
    + `</g>`;
}

function svgBoat(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    + `<polygon points="-3,0 -2,-1.5 3,-1.5 3.5,0" fill="${c.boat}"/>`
    + `<line x1="0" y1="-1.5" x2="0" y2="-6" stroke="${c.trunk}" stroke-width="0.4"/>`
    + `<polygon points="0,-5.5 0,-2 2.5,-2.5" fill="${c.sail}" opacity="0.9"/>`
    + `</g>`;
}

function svgSeagull(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    + `<path d="M-2,-3 Q-1,-4.5 0,-3 Q1,-4.5 2,-3" stroke="${c.seagull}" fill="none" stroke-width="0.6"/>`
    + `<circle cx="0" cy="-3" r="0.4" fill="${c.seagull}"/>`
    + `</g>`;
}

function svgDock(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    + `<rect x="-3" y="-0.5" width="6" height="1" fill="${c.dock}" rx="0.2"/>`
    + `<line x1="-2" y1="0.5" x2="-2" y2="1.5" stroke="${c.dock}" stroke-width="0.5"/>`
    + `<line x1="2" y1="0.5" x2="2" y2="1.5" stroke="${c.dock}" stroke-width="0.5"/>`
    + `</g>`;
}

function svgWaves(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    + `<path d="M-3,-0.5 Q-1.5,-1.5 0,-0.5 Q1.5,0.5 3,-0.5" stroke="${c.waterLight}" fill="none" stroke-width="0.4" opacity="0.5"/>`
    + `</g>`;
}

// Shore assets

function svgRock(x: number, y: number, c: AssetColors): string {
  return `<polygon points="${x - 1.5},${y} ${x - 1},${y - 2} ${x + 0.5},${y - 2.3} ${x + 1.5},${y - 1} ${x + 1},${y}" fill="${c.rock}"/>`;
}

function svgBoulder(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    + `<ellipse cx="0" cy="-1.5" rx="2.5" ry="1.8" fill="${c.boulder}"/>`
    + `<ellipse cx="-0.5" cy="-2" rx="1.5" ry="1" fill="${c.rock}" opacity="0.5"/>`
    + `</g>`;
}

function svgFlower(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    + `<line x1="0" y1="0" x2="0" y2="-2.5" stroke="${c.pine}" stroke-width="0.3"/>`
    + `<circle cx="0" cy="-3" r="1" fill="${c.flower}"/>`
    + `<circle cx="0" cy="-3" r="0.4" fill="${c.flowerCenter}"/>`
    + `</g>`;
}

function svgBush(x: number, y: number, c: AssetColors): string {
  return `<ellipse cx="${x}" cy="${y - 1.5}" rx="2" ry="1.5" fill="${c.bush}"/>`;
}

// Grassland assets

function svgPine(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    + `<line x1="0" y1="0" x2="0" y2="-2" stroke="${c.trunk}" stroke-width="0.6"/>`
    + `<polygon points="0,-8 -2.5,-2 2.5,-2" fill="${c.pine}"/>`
    + `<polygon points="0,-10 -1.8,-5 1.8,-5" fill="${c.pine}" opacity="0.85"/>`
    + `</g>`;
}

function svgDeciduous(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    + `<line x1="0" y1="0" x2="0" y2="-3" stroke="${c.trunk}" stroke-width="0.6"/>`
    + `<circle cx="0" cy="-5.5" r="2.8" fill="${c.leaf}"/>`
    + `<circle cx="-1.2" cy="-5" r="2" fill="${c.bush}" opacity="0.7"/>`
    + `</g>`;
}

function svgMushroom(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    + `<rect x="-0.4" y="-2" width="0.8" height="2" fill="${c.mushroom}"/>`
    + `<ellipse cx="0" cy="-2.2" rx="1.5" ry="1" fill="${c.mushroomCap}"/>`
    + `<circle cx="-0.5" cy="-2.5" r="0.3" fill="${c.mushroom}" opacity="0.7"/>`
    + `</g>`;
}

function svgStump(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    + `<ellipse cx="0" cy="-1.5" rx="1.5" ry="0.8" fill="${c.stump}"/>`
    + `<rect x="-1.5" y="-1.5" width="3" height="1.5" fill="${c.trunk}"/>`
    + `<ellipse cx="0" cy="-1.5" rx="1.5" ry="0.6" fill="${c.stump}" opacity="0.7"/>`
    + `</g>`;
}

function svgDeer(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    + `<ellipse cx="0" cy="-2" rx="2.2" ry="1.2" fill="${c.deer}"/>`
    + `<circle cx="-2" cy="-3" r="0.7" fill="${c.deer}"/>`
    // Antlers (key identifier)
    + `<line x1="-2.3" y1="-3.7" x2="-3" y2="-5" stroke="${c.trunk}" stroke-width="0.3"/>`
    + `<line x1="-3" y1="-5" x2="-3.5" y2="-5.3" stroke="${c.trunk}" stroke-width="0.25"/>`
    + `<line x1="-1.7" y1="-3.7" x2="-1" y2="-5" stroke="${c.trunk}" stroke-width="0.3"/>`
    + `<line x1="-1" y1="-5" x2="-0.5" y2="-5.3" stroke="${c.trunk}" stroke-width="0.25"/>`
    // Legs
    + `<line x1="-1" y1="-0.8" x2="-1" y2="0" stroke="${c.deer}" stroke-width="0.4"/>`
    + `<line x1="1" y1="-0.8" x2="1" y2="0" stroke="${c.deer}" stroke-width="0.4"/>`
    + `</g>`;
}

// Forest assets

function svgWillow(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    + `<line x1="0" y1="0" x2="0" y2="-5" stroke="${c.trunk}" stroke-width="0.8"/>`
    + `<circle cx="0" cy="-6" r="2" fill="${c.willow}"/>`
    // Drooping branches
    + `<path d="M-2,-5 Q-3,-3 -3,-1" stroke="${c.willow}" fill="none" stroke-width="0.6" opacity="0.7"/>`
    + `<path d="M2,-5 Q3,-3 3,-1" stroke="${c.willow}" fill="none" stroke-width="0.6" opacity="0.7"/>`
    + `<path d="M-1,-5.5 Q-2,-3.5 -2.5,-2" stroke="${c.willow}" fill="none" stroke-width="0.4" opacity="0.5"/>`
    + `</g>`;
}

function svgPalm(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    + `<path d="M0,0 Q-0.5,-4 0.5,-8" stroke="${c.trunk}" fill="none" stroke-width="0.7"/>`
    // Fan leaves
    + `<path d="M0.5,-8 Q3,-9 4,-7" stroke="${c.palm}" fill="none" stroke-width="0.8"/>`
    + `<path d="M0.5,-8 Q-2,-9 -3,-7" stroke="${c.palm}" fill="none" stroke-width="0.8"/>`
    + `<path d="M0.5,-8 Q2,-10 3,-9" stroke="${c.palm}" fill="none" stroke-width="0.6"/>`
    + `<path d="M0.5,-8 Q-1,-10 -2,-9" stroke="${c.palm}" fill="none" stroke-width="0.6"/>`
    + `</g>`;
}

function svgBird(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    + `<path d="M-1.5,-4 Q0,-5.5 1.5,-4" stroke="${c.bird}" fill="none" stroke-width="0.5"/>`
    + `</g>`;
}

// Farm assets

function svgWheat(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    + `<line x1="-1.5" y1="0" x2="-1.5" y2="-4" stroke="${c.wheat}" stroke-width="0.3"/>`
    + `<line x1="0" y1="0" x2="0" y2="-4.5" stroke="${c.wheat}" stroke-width="0.3"/>`
    + `<line x1="1.5" y1="0" x2="1.5" y2="-3.8" stroke="${c.wheat}" stroke-width="0.3"/>`
    + `<circle cx="-1.5" cy="-4.2" r="0.5" fill="${c.wheat}"/>`
    + `<circle cx="0" cy="-4.8" r="0.5" fill="${c.wheat}"/>`
    + `<circle cx="1.5" cy="-4" r="0.5" fill="${c.wheat}"/>`
    + `</g>`;
}

function svgFence(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    + `<line x1="-3" y1="-1.5" x2="3" y2="-1.5" stroke="${c.fence}" stroke-width="0.4"/>`
    + `<line x1="-3" y1="-2.5" x2="3" y2="-2.5" stroke="${c.fence}" stroke-width="0.4"/>`
    + `<line x1="-3" y1="0" x2="-3" y2="-3" stroke="${c.fence}" stroke-width="0.4"/>`
    + `<line x1="0" y1="0" x2="0" y2="-3" stroke="${c.fence}" stroke-width="0.4"/>`
    + `<line x1="3" y1="0" x2="3" y2="-3" stroke="${c.fence}" stroke-width="0.4"/>`
    + `</g>`;
}

function svgScarecrow(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    + `<line x1="0" y1="0" x2="0" y2="-6" stroke="${c.scarecrow}" stroke-width="0.5"/>`
    + `<line x1="-2.5" y1="-4" x2="2.5" y2="-4" stroke="${c.scarecrow}" stroke-width="0.4"/>`
    + `<circle cx="0" cy="-7" r="1" fill="${c.scarecrowHat}"/>`
    + `<rect x="-1.5" y="-8.2" width="3" height="0.8" fill="${c.scarecrowHat}" rx="0.2"/>`
    + `</g>`;
}

function svgBarn(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    + `<polygon points="-3,0 0,1.5 3,0 3,-3.5 0,-2 -3,-3.5" fill="${c.roofA}" opacity="0.8"/>`
    + `<polygon points="-3,0 0,1.5 0,-2 -3,-3.5" fill="${c.wallShade}"/>`
    + `<polygon points="0,-6 -3.5,-3.2 0,-1.8 3.5,-3.2" fill="${c.roofA}"/>`
    + `</g>`;
}

function svgSheep(x: number, y: number, c: AssetColors): string {
  // Fluffy multi-bump wool body with detailed head and 4 legs
  return `<g transform="translate(${x},${y})">`
    // Wool body: 5 overlapping circles for fluffy texture
    + `<circle cx="0" cy="-2" r="1.6" fill="${c.sheep}"/>`
    + `<circle cx="-1.2" cy="-2.2" r="1.3" fill="${c.sheep}"/>`
    + `<circle cx="1.2" cy="-2.2" r="1.3" fill="${c.sheep}"/>`
    + `<circle cx="-0.5" cy="-3" r="1.1" fill="${c.sheep}"/>`
    + `<circle cx="0.6" cy="-3" r="1.1" fill="${c.sheep}"/>`
    // Head with elliptical snout extending left
    + `<circle cx="-2" cy="-2.8" r="0.9" fill="${c.sheepHead}"/>`
    + `<ellipse cx="-2.8" cy="-2.6" rx="0.6" ry="0.4" fill="${c.sheepHead}"/>`
    // Ears (angled)
    + `<ellipse cx="-1.5" cy="-3.7" rx="0.3" ry="0.5" fill="${c.sheepHead}" transform="rotate(-20 -1.5 -3.7)"/>`
    + `<ellipse cx="-2.3" cy="-3.6" rx="0.3" ry="0.5" fill="${c.sheepHead}" transform="rotate(15 -2.3 -3.6)"/>`
    // Eye
    + `<circle cx="-2.1" cy="-3" r="0.15" fill="#fff"/>`
    // 4 legs
    + `<line x1="-1.2" y1="-0.8" x2="-1.2" y2="0.3" stroke="${c.sheepHead}" stroke-width="0.35"/>`
    + `<line x1="-0.3" y1="-0.6" x2="-0.3" y2="0.3" stroke="${c.sheepHead}" stroke-width="0.35"/>`
    + `<line x1="0.5" y1="-0.6" x2="0.5" y2="0.3" stroke="${c.sheepHead}" stroke-width="0.35"/>`
    + `<line x1="1.2" y1="-0.8" x2="1.2" y2="0.3" stroke="${c.sheepHead}" stroke-width="0.35"/>`
    + `</g>`;
}

function svgCow(x: number, y: number, c: AssetColors): string {
  // Redesigned: distinctive spots, proper head shape
  return `<g transform="translate(${x},${y})">`
    + `<ellipse cx="0" cy="-1.8" rx="2.5" ry="1.5" fill="${c.cow}"/>`
    // Spots
    + `<ellipse cx="0.8" cy="-2.2" rx="0.8" ry="0.6" fill="${c.cowSpot}"/>`
    + `<ellipse cx="-0.5" cy="-1.3" rx="0.6" ry="0.5" fill="${c.cowSpot}"/>`
    // Head
    + `<circle cx="-2.2" cy="-2.5" r="0.9" fill="${c.cow}"/>`
    + `<circle cx="-2.2" cy="-2.3" r="0.4" fill="${c.cowSpot}" opacity="0.5"/>`
    // Horns
    + `<line x1="-2.8" y1="-3.3" x2="-3.2" y2="-3.8" stroke="${c.fence}" stroke-width="0.3"/>`
    + `<line x1="-1.8" y1="-3.3" x2="-1.4" y2="-3.8" stroke="${c.fence}" stroke-width="0.3"/>`
    + `</g>`;
}

function svgChicken(x: number, y: number, c: AssetColors): string {
  // Redesigned: red comb is key identifier
  return `<g transform="translate(${x},${y})">`
    + `<ellipse cx="0" cy="-1" rx="1.2" ry="0.9" fill="${c.chicken}"/>`
    + `<circle cx="-1" cy="-1.6" r="0.6" fill="${c.chicken}"/>`
    // Red comb (key identifier)
    + `<path d="M-1,-2.2 Q-0.8,-2.8 -0.6,-2.2 Q-0.4,-2.7 -0.3,-2.1" fill="${c.flag}" stroke="none"/>`
    // Beak
    + `<polygon points="-1.5,-1.5 -2,-1.3 -1.5,-1.2" fill="${c.wheat}"/>`
    + `</g>`;
}

function svgHorse(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    + `<ellipse cx="0" cy="-2.2" rx="2.5" ry="1.3" fill="${c.horse}"/>`
    // Neck + head
    + `<path d="M-2,-2.5 Q-2.5,-4 -2,-5" stroke="${c.horse}" fill="${c.horse}" stroke-width="1"/>`
    + `<ellipse cx="-1.8" cy="-5.2" rx="1" ry="0.5" fill="${c.horse}"/>`
    // Legs
    + `<line x1="-1" y1="-1" x2="-1" y2="0" stroke="${c.horse}" stroke-width="0.4"/>`
    + `<line x1="1" y1="-1" x2="1" y2="0" stroke="${c.horse}" stroke-width="0.4"/>`
    // Tail
    + `<path d="M2.5,-2.5 Q3.5,-3 3,-1.5" stroke="${c.horse}" fill="none" stroke-width="0.4"/>`
    + `</g>`;
}

function svgRicePaddy(x: number, y: number, c: AssetColors): string {
  // Isometric parallelogram terrace with water fill and rice plant stubs
  return `<g transform="translate(${x},${y})">`
    // Terrace edge (outer parallelogram)
    + `<polygon points="-4,-1 0,-3 4,-1 0,1" fill="${c.ricePaddy}" stroke="${c.ricePaddy}" stroke-width="0.3"/>`
    // Inner water fill
    + `<polygon points="-3,-0.8 0,-2.4 3,-0.8 0,0.6" fill="${c.ricePaddyWater}" opacity="0.6"/>`
    // Reflection lines
    + `<line x1="-1.5" y1="-0.6" x2="1.5" y2="-1.8" stroke="#fff" stroke-width="0.2" opacity="0.25"/>`
    + `<line x1="-1" y1="0" x2="2" y2="-1.2" stroke="#fff" stroke-width="0.2" opacity="0.2"/>`
    + `<line x1="-2" y1="-0.3" x2="1" y2="-1.5" stroke="#fff" stroke-width="0.2" opacity="0.15"/>`
    // Rice plant stubs along edges
    + `<line x1="-2.5" y1="-0.5" x2="-2.5" y2="-2" stroke="${c.reeds}" stroke-width="0.3"/>`
    + `<line x1="-0.8" y1="-1.8" x2="-0.8" y2="-3.3" stroke="${c.reeds}" stroke-width="0.3"/>`
    + `<line x1="1" y1="-1.5" x2="1" y2="-3" stroke="${c.reeds}" stroke-width="0.3"/>`
    + `<line x1="2.5" y1="-0.5" x2="2.5" y2="-2" stroke="${c.reeds}" stroke-width="0.3"/>`
    + `</g>`;
}

// Village assets

function svgTent(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    + `<polygon points="0,-6 -3.5,0 3.5,0" fill="${c.tent}"/>`
    + `<polygon points="0,-6 -1.5,0 1.5,0" fill="${c.tentStripe}" opacity="0.6"/>`
    + `<line x1="0" y1="-6" x2="0" y2="-7" stroke="${c.trunk}" stroke-width="0.3"/>`
    + `</g>`;
}

function svgHut(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    + `<rect x="-2" y="-3" width="4" height="3" fill="${c.hut}"/>`
    + `<polygon points="-2.5,-3 0,-5.5 2.5,-3" fill="${c.roofB}"/>`
    + `</g>`;
}

function svgHouse(x: number, y: number, c: AssetColors, roofColor?: string): string {
  const roof = roofColor || c.roofA;
  return `<g transform="translate(${x},${y})">`
    + `<polygon points="-2.5,0 0,1.2 2.5,0 2.5,-3 0,-1.8 -2.5,-3" fill="${c.wall}"/>`
    + `<polygon points="-2.5,0 0,1.2 0,-1.8 -2.5,-3" fill="${c.wallShade}"/>`
    + `<polygon points="0,-6 -3.2,-2.8 0,-1.5 3.2,-2.8" fill="${roof}"/>`
    + `<rect x="1" y="-6.5" width="1" height="2" fill="${c.chimney}"/>`
    + `</g>`;
}

function svgHouseB(x: number, y: number, c: AssetColors): string {
  return svgHouse(x, y, c, c.roofB);
}

function svgChurch(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    + `<polygon points="-2,0 0,1 2,0 2,-5 0,-4 -2,-5" fill="${c.church}"/>`
    + `<polygon points="-2,0 0,1 0,-4 -2,-5" fill="${c.wallShade}"/>`
    + `<polygon points="0,-10 -2.5,-5 0,-3.8 2.5,-5" fill="${c.roofA}"/>`
    + `<line x1="0" y1="-12" x2="0" y2="-10" stroke="${c.wall}" stroke-width="0.5"/>`
    + `<line x1="-1" y1="-11" x2="1" y2="-11" stroke="${c.wall}" stroke-width="0.5"/>`
    + `</g>`;
}

function svgWindmill(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    + `<polygon points="-1.5,0 1.5,0 1,-7 -1,-7" fill="${c.windmill}"/>`
    // Animated blades via SMIL
    + `<g>`
    + `<line x1="0" y1="-11" x2="0" y2="-3" stroke="${c.windBlade}" stroke-width="0.5"/>`
    + `<line x1="-4" y1="-7" x2="4" y2="-7" stroke="${c.windBlade}" stroke-width="0.5"/>`
    + `<animateTransform attributeName="transform" type="rotate" from="0 0 -7" to="360 0 -7" dur="8s" repeatCount="indefinite"/>`
    + `</g>`
    + `<circle cx="0" cy="-7" r="0.7" fill="${c.roofA}"/>`
    + `</g>`;
}

function svgWell(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    + `<ellipse cx="0" cy="-0.5" rx="2" ry="1" fill="${c.well}" stroke="${c.fence}" stroke-width="0.3"/>`
    + `<line x1="-1.5" y1="-0.5" x2="-1.5" y2="-4" stroke="${c.trunk}" stroke-width="0.4"/>`
    + `<line x1="1.5" y1="-0.5" x2="1.5" y2="-4" stroke="${c.trunk}" stroke-width="0.4"/>`
    + `<polygon points="0,-5.5 -2.2,-3.8 2.2,-3.8" fill="${c.roofB}"/>`
    + `</g>`;
}

// Town assets

function svgMarket(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    + `<rect x="-3" y="-3" width="6" height="3" fill="${c.market}"/>`
    + `<polygon points="-3.5,-3 0,-5 3.5,-3" fill="${c.marketAwning}"/>`
    // Goods display
    + `<rect x="-2" y="-1.5" width="1" height="0.8" fill="${c.barrel}" rx="0.2"/>`
    + `<rect x="0.5" y="-1.5" width="1" height="0.8" fill="${c.wheat}" rx="0.2"/>`
    + `</g>`;
}

function svgInn(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    + `<polygon points="-3,0 0,1.5 3,0 3,-4 0,-2.5 -3,-4" fill="${c.inn}"/>`
    + `<polygon points="-3,0 0,1.5 0,-2.5 -3,-4" fill="${c.wallShade}"/>`
    + `<polygon points="0,-7 -3.5,-3.8 0,-2.2 3.5,-3.8" fill="${c.roofB}"/>`
    // Sign
    + `<rect x="3" y="-5" width="2" height="1.5" fill="${c.innSign}" rx="0.3"/>`
    + `</g>`;
}

function svgBlacksmith(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    + `<rect x="-2.5" y="-3" width="5" height="3" fill="${c.blacksmith}"/>`
    + `<polygon points="-3,-3 0,-5 3,-3" fill="${c.roofA}"/>`
    // Anvil
    + `<polygon points="-1,-0.5 1,-0.5 1.5,-1.5 -1.5,-1.5" fill="${c.anvil}"/>`
    // Smoke from forge
    + `<circle cx="1.5" cy="-5.5" r="0.8" fill="${c.smoke}" opacity="0.5"/>`
    + `</g>`;
}

function svgCastle(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    // Main body
    + `<rect x="-3" y="-6" width="6" height="6" fill="${c.castle}"/>`
    // Battlements
    + `<rect x="-3" y="-7" width="1.5" height="1.2" fill="${c.castle}"/>`
    + `<rect x="-0.75" y="-7" width="1.5" height="1.2" fill="${c.castle}"/>`
    + `<rect x="1.5" y="-7" width="1.5" height="1.2" fill="${c.castle}"/>`
    // Tower
    + `<rect x="-1" y="-10" width="2" height="3.5" fill="${c.tower}"/>`
    + `<polygon points="-1.3,-10 0,-12 1.3,-10" fill="${c.castleRoof}"/>`
    // Gate
    + `<rect x="-0.8" y="-2" width="1.6" height="2" fill="${c.blacksmith}" rx="0.8" ry="0"/>`
    + `</g>`;
}

function svgTower(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    + `<rect x="-1.5" y="-8" width="3" height="8" fill="${c.tower}"/>`
    + `<polygon points="-2,-8 0,-11 2,-8" fill="${c.castleRoof}"/>`
    // Window
    + `<rect x="-0.5" y="-6" width="1" height="1.2" fill="${c.blacksmith}" rx="0.5" ry="0"/>`
    + `</g>`;
}

function svgBridge(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    + `<path d="M-4,0 Q0,-2 4,0" fill="${c.bridge}" stroke="${c.trunk}" stroke-width="0.4"/>`
    + `<line x1="-3" y1="-0.8" x2="-3" y2="-2.5" stroke="${c.trunk}" stroke-width="0.4"/>`
    + `<line x1="3" y1="-0.8" x2="3" y2="-2.5" stroke="${c.trunk}" stroke-width="0.4"/>`
    + `<line x1="-3" y1="-2.5" x2="3" y2="-2.5" stroke="${c.trunk}" stroke-width="0.3"/>`
    + `</g>`;
}

// Cross-level decoration assets

function svgCart(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    + `<rect x="-2" y="-2" width="3.5" height="2" fill="${c.cart}"/>`
    + `<circle cx="-1.5" cy="0" r="0.8" fill="${c.trunk}" stroke="${c.fence}" stroke-width="0.2"/>`
    + `<circle cx="1" cy="0" r="0.8" fill="${c.trunk}" stroke="${c.fence}" stroke-width="0.2"/>`
    + `<line x1="2" y1="-1" x2="3.5" y2="-0.5" stroke="${c.trunk}" stroke-width="0.4"/>`
    + `</g>`;
}

function svgBarrel(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    + `<ellipse cx="0" cy="-0.3" rx="1.2" ry="0.5" fill="${c.barrel}"/>`
    + `<rect x="-1.2" y="-2.5" width="2.4" height="2.2" fill="${c.barrel}" rx="0.3"/>`
    + `<ellipse cx="0" cy="-2.5" rx="1.2" ry="0.5" fill="${c.cart}"/>`
    + `</g>`;
}

function svgTorch(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    + `<line x1="0" y1="0" x2="0" y2="-4" stroke="${c.torch}" stroke-width="0.5"/>`
    + `<ellipse cx="0" cy="-4.5" rx="0.8" ry="1" fill="${c.torchFlame}" opacity="0.8"/>`
    + `<ellipse cx="0" cy="-4.8" rx="0.4" ry="0.6" fill="#ffdd44" opacity="0.9"/>`
    + `</g>`;
}

function svgFlag(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    + `<line x1="0" y1="0" x2="0" y2="-8" stroke="${c.trunk}" stroke-width="0.4"/>`
    + `<polygon points="0,-8 3.5,-7 0,-5.5" fill="${c.flag}"/>`
    + `</g>`;
}

function svgCobblePath(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    + `<ellipse cx="-1" cy="-0.3" rx="1" ry="0.4" fill="${c.cobble}" opacity="0.6"/>`
    + `<ellipse cx="1" cy="0" rx="0.8" ry="0.35" fill="${c.cobble}" opacity="0.5"/>`
    + `<ellipse cx="0" cy="-0.8" rx="0.7" ry="0.3" fill="${c.cobble}" opacity="0.5"/>`
    + `</g>`;
}

function svgSmoke(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    + `<circle cx="0" cy="-5" r="1" fill="${c.smoke}">`
    + `<animate attributeName="cy" values="-5;-8;-5" dur="4s" repeatCount="indefinite"/>`
    + `<animate attributeName="opacity" values="0.5;0.1;0.5" dur="4s" repeatCount="indefinite"/>`
    + `</circle>`
    + `<circle cx="0.5" cy="-6" r="0.7" fill="${c.smoke}">`
    + `<animate attributeName="cy" values="-6;-9;-6" dur="3.5s" repeatCount="indefinite"/>`
    + `<animate attributeName="opacity" values="0.4;0.08;0.4" dur="3.5s" repeatCount="indefinite"/>`
    + `</circle>`
    + `</g>`;
}

// Biome blend assets

function svgReeds(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    + `<line x1="-1" y1="0" x2="-1.3" y2="-4" stroke="${c.reeds}" stroke-width="0.4"/>`
    + `<line x1="0" y1="0" x2="0.2" y2="-4.5" stroke="${c.reeds}" stroke-width="0.4"/>`
    + `<line x1="1" y1="0" x2="0.8" y2="-3.8" stroke="${c.reeds}" stroke-width="0.4"/>`
    + `<ellipse cx="-1.3" cy="-4.3" rx="0.3" ry="0.8" fill="${c.trunk}"/>`
    + `<ellipse cx="0.2" cy="-4.8" rx="0.3" ry="0.8" fill="${c.trunk}"/>`
    + `</g>`;
}

function svgFountain(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    + `<ellipse cx="0" cy="-0.5" rx="2.5" ry="1" fill="${c.fountain}" stroke="${c.boulder}" stroke-width="0.3"/>`
    + `<ellipse cx="0" cy="-0.3" rx="2" ry="0.7" fill="${c.fountainWater}" opacity="0.6"/>`
    + `<rect x="-0.4" y="-3" width="0.8" height="2.5" fill="${c.fountain}"/>`
    + `<line x1="0" y1="-3" x2="0" y2="-4.5" stroke="${c.fountainWater}" stroke-width="0.4" opacity="0.7">`
    + `<animate attributeName="y2" values="-4.5;-5.2;-4.5" dur="2s" repeatCount="indefinite"/>`
    + `</line>`
    + `<circle cx="-0.5" cy="-3.5" r="0.3" fill="${c.fountainWater}" opacity="0.4"/>`
    + `<circle cx="0.5" cy="-3.8" r="0.3" fill="${c.fountainWater}" opacity="0.4"/>`
    + `</g>`;
}

function svgCanal(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    + `<rect x="-3" y="-1" width="6" height="1" fill="${c.canal}"/>`
    + `<rect x="-2.5" y="-0.7" width="5" height="0.5" fill="${c.fountainWater}" opacity="0.5"/>`
    + `</g>`;
}

function svgWatermill(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    + `<rect x="-2" y="-4" width="4" height="4" fill="${c.wall}"/>`
    + `<polygon points="-2.5,-4 0,-6 2.5,-4" fill="${c.roofB}"/>`
    + `<g>`
    + `<circle cx="3" cy="-2" r="2" fill="none" stroke="${c.trunk}" stroke-width="0.5"/>`
    + `<line x1="3" y1="-4" x2="3" y2="0" stroke="${c.trunk}" stroke-width="0.3"/>`
    + `<line x1="1" y1="-2" x2="5" y2="-2" stroke="${c.trunk}" stroke-width="0.3"/>`
    + `<animateTransform attributeName="transform" type="rotate" from="0 3 -2" to="360 3 -2" dur="6s" repeatCount="indefinite"/>`
    + `</g>`
    + `</g>`;
}

function svgGardenTree(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    + `<line x1="0" y1="0" x2="0" y2="-2.5" stroke="${c.trunk}" stroke-width="0.5"/>`
    + `<circle cx="0" cy="-4" r="2" fill="${c.gardenTree}"/>`
    + `<circle cx="-0.8" cy="-3.5" r="1.2" fill="${c.leaf}" opacity="0.6"/>`
    + `</g>`;
}

function svgPondLily(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    + `<ellipse cx="0" cy="-0.3" rx="1.5" ry="0.6" fill="${c.pine}" opacity="0.7"/>`
    + `<circle cx="0.3" cy="-0.5" r="0.4" fill="${c.flower}"/>`
    + `</g>`;
}

// ── Render Dispatcher ───────────────────────────────────────

const RENDERERS: Record<AssetType, (x: number, y: number, c: AssetColors) => string> = {
  // Water
  whale: svgWhale,
  fish: svgFish,
  fishSchool: svgFishSchool,
  boat: svgBoat,
  seagull: svgSeagull,
  dock: svgDock,
  waves: svgWaves,
  // Shore
  rock: svgRock,
  boulder: svgBoulder,
  flower: svgFlower,
  bush: svgBush,
  // Grassland
  pine: svgPine,
  deciduous: svgDeciduous,
  mushroom: svgMushroom,
  stump: svgStump,
  deer: svgDeer,
  // Forest
  willow: svgWillow,
  palm: svgPalm,
  bird: svgBird,
  // Farm
  wheat: svgWheat,
  fence: svgFence,
  scarecrow: svgScarecrow,
  barn: svgBarn,
  sheep: svgSheep,
  cow: svgCow,
  chicken: svgChicken,
  horse: svgHorse,
  ricePaddy: svgRicePaddy,
  // Village
  tent: svgTent,
  hut: svgHut,
  house: svgHouse,
  houseB: svgHouseB,
  church: svgChurch,
  windmill: svgWindmill,
  well: svgWell,
  // Town
  market: svgMarket,
  inn: svgInn,
  blacksmith: svgBlacksmith,
  castle: svgCastle,
  tower: svgTower,
  bridge: svgBridge,
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
};

// ── Public API ──────────────────────────────────────────────

export function renderTerrainAssets(
  isoCells: IsoCell[],
  seed: number,
  palette: TerrainPalette100,
  biomeMap?: Map<string, BiomeContext>,
): string {
  const placed = selectAssets(isoCells, seed, biomeMap);
  const c = palette.assets;

  const svgParts = placed.map(a => {
    const renderer = RENDERERS[a.type];
    return renderer(a.cx + a.ox, a.cy + a.oy, c);
  });

  return `<g class="terrain-assets">${svgParts.join('')}</g>`;
}

export function renderAssetCSS(): string {
  return [
    `@keyframes tree-sway { 0% { transform: rotate(-1.5deg); } 50% { transform: rotate(1.5deg); } 100% { transform: rotate(-1.5deg); } }`,
  ].join('\n');
}
