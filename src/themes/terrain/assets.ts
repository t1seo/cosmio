import type { IsoCell } from './blocks.js';
import type { TerrainPalette, AssetColors } from './palette.js';
import { seededRandom } from '../../utils/math.js';

// ── Asset Type Definitions ──────────────────────────────────

type AssetType =
  | 'pine' | 'deciduous' | 'bush'
  | 'house' | 'houseB' | 'church' | 'windmill' | 'barn'
  | 'sheep' | 'cow' | 'chicken'
  | 'fence' | 'wheat' | 'well'
  | 'whale' | 'boat' | 'fish'
  | 'flag';

interface PlacedAsset {
  cell: IsoCell;
  type: AssetType;
  /** Center X of the top face */
  cx: number;
  /** Center Y of the top face */
  cy: number;
  /** Small offset for variety */
  ox: number;
  oy: number;
}

// ── Level → Asset Pool ──────────────────────────────────────

/** Which assets can appear at each level range */
const LEVEL_POOLS: Record<string, { types: AssetType[]; chance: number }> = {
  // Ocean: whales, boats, fish
  'ocean':  { types: ['whale', 'boat', 'fish', 'fish'], chance: 0.18 },
  // Shore/grass: bushes
  'shore':  { types: ['bush', 'bush', 'fence'], chance: 0.15 },
  // Grassland: trees start
  'grass':  { types: ['pine', 'deciduous', 'bush', 'sheep'], chance: 0.22 },
  // Forest: dense trees
  'forest': { types: ['pine', 'pine', 'deciduous', 'pine', 'bush'], chance: 0.35 },
  // Farm: livestock + crops
  'farm':   { types: ['sheep', 'cow', 'chicken', 'wheat', 'fence', 'barn', 'house'], chance: 0.35 },
  // Village: buildings
  'village':{ types: ['house', 'houseB', 'windmill', 'well', 'sheep', 'fence', 'pine'], chance: 0.40 },
  // Town: dense buildings
  'town':   { types: ['house', 'houseB', 'church', 'windmill', 'house', 'flag', 'well'], chance: 0.50 },
  // City: max density
  'city':   { types: ['church', 'house', 'houseB', 'house', 'windmill', 'flag', 'barn'], chance: 0.55 },
};

function getLevelPool(level: number) {
  if (level <= 1) return LEVEL_POOLS['ocean'];
  if (level === 2) return LEVEL_POOLS['shore'];
  if (level === 3) return LEVEL_POOLS['grass'];
  if (level <= 5) return LEVEL_POOLS['forest'];
  if (level === 6) return LEVEL_POOLS['farm'];
  if (level === 7) return LEVEL_POOLS['village'];
  if (level === 8) return LEVEL_POOLS['town'];
  return LEVEL_POOLS['city'];
}

// ── Neighbor Richness ───────────────────────────────────────

/**
 * Compute richness bonus based on neighboring cells' levels.
 * Consecutive high-commit areas get denser assets.
 */
function computeRichness(
  cell: IsoCell,
  cellMap: Map<string, IsoCell>,
): number {
  let neighborSum = 0;
  let count = 0;
  for (let dw = -1; dw <= 1; dw++) {
    for (let dd = -1; dd <= 1; dd++) {
      if (dw === 0 && dd === 0) continue;
      const key = `${cell.week + dw},${cell.day + dd}`;
      const n = cellMap.get(key);
      if (n) {
        neighborSum += n.level10;
        count++;
      }
    }
  }
  if (count === 0) return 0;
  // Average neighbor level / 9 gives 0–1 richness
  return neighborSum / (count * 9);
}

// ── Asset Selection ─────────────────────────────────────────

/**
 * Select which cells get assets and what type.
 * Returns array of placed assets sorted in drawing order.
 */
export function selectAssets(
  isoCells: IsoCell[],
  seed: number,
): PlacedAsset[] {
  const rng = seededRandom(seed);
  const assets: PlacedAsset[] = [];

  // Build lookup map for neighbor checks
  const cellMap = new Map<string, IsoCell>();
  for (const cell of isoCells) {
    cellMap.set(`${cell.week},${cell.day}`, cell);
  }

  for (const cell of isoCells) {
    const pool = getLevelPool(cell.level10);
    const richness = computeRichness(cell, cellMap);

    // Base chance + richness bonus (up to +20%)
    const finalChance = pool.chance + richness * 0.20;

    if (rng() < finalChance) {
      const typeIdx = Math.floor(rng() * pool.types.length);
      const type = pool.types[typeIdx];

      // Small positional offset for natural look
      const ox = (rng() - 0.5) * 3;
      const oy = (rng() - 0.5) * 1.5;

      assets.push({
        cell,
        type,
        cx: cell.isoX,
        cy: cell.isoY,
        ox,
        oy,
      });

      // High richness areas can get a second asset
      if (richness > 0.5 && cell.level10 >= 5 && rng() < 0.3) {
        const typeIdx2 = Math.floor(rng() * pool.types.length);
        assets.push({
          cell,
          type: pool.types[typeIdx2],
          cx: cell.isoX,
          cy: cell.isoY,
          ox: (rng() - 0.5) * 4,
          oy: (rng() - 0.5) * 2,
        });
      }
    }
  }

  return assets;
}

// ── SVG Renderers for Each Asset ────────────────────────────
// All assets are drawn relative to (x, y) which is the top-face center.
// Assets grow upward (negative y direction).

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

function svgBush(x: number, y: number, c: AssetColors): string {
  return `<ellipse cx="${x}" cy="${y - 1.5}" rx="2" ry="1.5" fill="${c.bush}"/>`;
}

function svgHouse(x: number, y: number, c: AssetColors, roofColor?: string): string {
  const roof = roofColor || c.roofA;
  return `<g transform="translate(${x},${y})">`
    // Wall (small isometric box)
    + `<polygon points="-2.5,0 0,1.2 2.5,0 2.5,-3 0,-1.8 -2.5,-3" fill="${c.wall}"/>`
    + `<polygon points="-2.5,0 0,1.2 0,-1.8 -2.5,-3" fill="${c.wallShade}"/>`
    // Roof
    + `<polygon points="0,-6 -3.2,-2.8 0,-1.5 3.2,-2.8" fill="${roof}"/>`
    // Chimney
    + `<rect x="1" y="-6.5" width="1" height="2" fill="${c.chimney}"/>`
    + `</g>`;
}

function svgHouseB(x: number, y: number, c: AssetColors): string {
  return svgHouse(x, y, c, c.roofB);
}

function svgChurch(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    // Tall body
    + `<polygon points="-2,0 0,1 2,0 2,-5 0,-4 -2,-5" fill="${c.church}"/>`
    + `<polygon points="-2,0 0,1 0,-4 -2,-5" fill="${c.wallShade}"/>`
    // Steeple roof
    + `<polygon points="0,-10 -2.5,-5 0,-3.8 2.5,-5" fill="${c.roofA}"/>`
    // Cross
    + `<line x1="0" y1="-12" x2="0" y2="-10" stroke="${c.wall}" stroke-width="0.5"/>`
    + `<line x1="-1" y1="-11" x2="1" y2="-11" stroke="${c.wall}" stroke-width="0.5"/>`
    + `</g>`;
}

function svgWindmill(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    // Tower
    + `<polygon points="-1.5,0 1.5,0 1,-7 -1,-7" fill="${c.windmill}"/>`
    // Blades (X shape)
    + `<line x1="0" y1="-11" x2="0" y2="-3" stroke="${c.windBlade}" stroke-width="0.5"/>`
    + `<line x1="-4" y1="-7" x2="4" y2="-7" stroke="${c.windBlade}" stroke-width="0.5"/>`
    // Hub
    + `<circle cx="0" cy="-7" r="0.7" fill="${c.roofA}"/>`
    + `</g>`;
}

function svgBarn(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    // Wider body
    + `<polygon points="-3,0 0,1.5 3,0 3,-3.5 0,-2 -3,-3.5" fill="${c.roofA}" opacity="0.8"/>`
    + `<polygon points="-3,0 0,1.5 0,-2 -3,-3.5" fill="${c.wallShade}"/>`
    // Barn roof
    + `<polygon points="0,-6 -3.5,-3.2 0,-1.8 3.5,-3.2" fill="${c.roofA}"/>`
    + `</g>`;
}

function svgSheep(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    + `<ellipse cx="0" cy="-1.5" rx="2.2" ry="1.3" fill="${c.sheep}"/>`
    + `<circle cx="-1.8" cy="-2.2" r="0.8" fill="${c.sheepHead}"/>`
    // Legs
    + `<line x1="-1" y1="-0.3" x2="-1" y2="0" stroke="${c.sheepHead}" stroke-width="0.3"/>`
    + `<line x1="1" y1="-0.3" x2="1" y2="0" stroke="${c.sheepHead}" stroke-width="0.3"/>`
    + `</g>`;
}

function svgCow(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    + `<ellipse cx="0" cy="-1.8" rx="2.5" ry="1.5" fill="${c.cow}"/>`
    + `<ellipse cx="0.5" cy="-2" rx="1" ry="0.8" fill="${c.cowSpot}"/>`
    + `<circle cx="-2.2" cy="-2.5" r="0.9" fill="${c.cow}"/>`
    // Horns
    + `<line x1="-2.8" y1="-3.3" x2="-3.2" y2="-3.8" stroke="${c.fence}" stroke-width="0.3"/>`
    + `<line x1="-1.8" y1="-3.3" x2="-1.4" y2="-3.8" stroke="${c.fence}" stroke-width="0.3"/>`
    + `</g>`;
}

function svgChicken(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    + `<ellipse cx="0" cy="-1" rx="1.2" ry="0.9" fill="${c.chicken}"/>`
    + `<circle cx="-1" cy="-1.6" r="0.6" fill="${c.chicken}"/>`
    // Beak
    + `<polygon points="-1.5,-1.5 -2,-1.3 -1.5,-1.2" fill="${c.roofB}"/>`
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

function svgWell(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    // Base ring
    + `<ellipse cx="0" cy="-0.5" rx="2" ry="1" fill="${c.well}" stroke="${c.fence}" stroke-width="0.3"/>`
    // Poles
    + `<line x1="-1.5" y1="-0.5" x2="-1.5" y2="-4" stroke="${c.trunk}" stroke-width="0.4"/>`
    + `<line x1="1.5" y1="-0.5" x2="1.5" y2="-4" stroke="${c.trunk}" stroke-width="0.4"/>`
    // Roof
    + `<polygon points="0,-5.5 -2.2,-3.8 2.2,-3.8" fill="${c.roofB}"/>`
    + `</g>`;
}

function svgWhale(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    // Body
    + `<ellipse cx="0" cy="-1" rx="4" ry="1.8" fill="${c.whale}"/>`
    + `<ellipse cx="0.5" cy="-0.5" rx="3" ry="1" fill="${c.whaleBelly}" opacity="0.6"/>`
    // Tail
    + `<polygon points="3.5,-1 5,-2.5 5,0" fill="${c.whale}"/>`
    // Eye
    + `<circle cx="-2.5" cy="-1.2" r="0.4" fill="#fff"/>`
    // Spout
    + `<line x1="-1" y1="-2.8" x2="-1.5" y2="-4" stroke="${c.waterLight}" stroke-width="0.3" opacity="0.7"/>`
    + `<line x1="-1" y1="-2.8" x2="-0.5" y2="-4.2" stroke="${c.waterLight}" stroke-width="0.3" opacity="0.7"/>`
    + `</g>`;
}

function svgBoat(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    // Hull
    + `<polygon points="-3,0 -2,-1.5 3,-1.5 3.5,0" fill="${c.boat}"/>`
    // Mast
    + `<line x1="0" y1="-1.5" x2="0" y2="-6" stroke="${c.trunk}" stroke-width="0.4"/>`
    // Sail
    + `<polygon points="0,-5.5 0,-2 2.5,-2.5" fill="${c.sail}" opacity="0.9"/>`
    + `</g>`;
}

function svgFish(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    + `<ellipse cx="0" cy="-0.8" rx="2" ry="0.9" fill="${c.fish}"/>`
    + `<polygon points="1.8,-0.8 3,-1.8 3,0.2" fill="${c.fish}"/>`
    + `<circle cx="-1" cy="-1" r="0.3" fill="#fff"/>`
    + `</g>`;
}

function svgFlag(x: number, y: number, c: AssetColors): string {
  return `<g transform="translate(${x},${y})">`
    + `<line x1="0" y1="0" x2="0" y2="-8" stroke="${c.trunk}" stroke-width="0.4"/>`
    + `<polygon points="0,-8 3.5,-7 0,-5.5" fill="${c.flag}"/>`
    + `</g>`;
}

// ── Render Dispatcher ───────────────────────────────────────

const RENDERERS: Record<AssetType, (x: number, y: number, c: AssetColors) => string> = {
  pine: svgPine,
  deciduous: svgDeciduous,
  bush: svgBush,
  house: svgHouse,
  houseB: svgHouseB,
  church: svgChurch,
  windmill: svgWindmill,
  barn: svgBarn,
  sheep: svgSheep,
  cow: svgCow,
  chicken: svgChicken,
  fence: svgFence,
  wheat: svgWheat,
  well: svgWell,
  whale: svgWhale,
  boat: svgBoat,
  fish: svgFish,
  flag: svgFlag,
};

// ── Public API ──────────────────────────────────────────────

/**
 * Render all terrain assets as a single SVG group.
 * Assets are sorted in the same back-to-front order as blocks.
 */
export function renderTerrainAssets(
  isoCells: IsoCell[],
  seed: number,
  palette: TerrainPalette,
): string {
  const placed = selectAssets(isoCells, seed);
  const c = palette.assets;

  const svgParts = placed.map(a => {
    const renderer = RENDERERS[a.type];
    return renderer(a.cx + a.ox, a.cy + a.oy, c);
  });

  return `<g class="terrain-assets">${svgParts.join('')}</g>`;
}

/**
 * CSS for animated assets (tree sway).
 */
export function renderAssetCSS(): string {
  return [
    `@keyframes tree-sway { 0% { transform: rotate(-1.5deg); } 50% { transform: rotate(1.5deg); } 100% { transform: rotate(-1.5deg); } }`,
  ].join('\n');
}
