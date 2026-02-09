import type { ColorMode } from '../../core/types.js';
import { lerp, clamp } from '../../utils/math.js';
import type { SeasonalTint } from './seasons.js';
import { getSeasonalTint, applyTintToHex, applyTintToRgb } from './seasons.js';

/** RGB color tuple */
type RGB = [number, number, number];

/** Colors for one elevation level: top face, left face, right face */
export interface ElevationColors {
  top: string;
  left: string;
  right: string;
}

/** Cloud rendering properties */
export interface CloudColors {
  fill: string;
  stroke: string;
  opacity: number;
}

/** Colors used for terrain assets */
export interface AssetColors {
  trunk: string;
  pine: string;
  leaf: string;
  bush: string;
  roofA: string;
  roofB: string;
  wall: string;
  wallShade: string;
  church: string;
  fence: string;
  wheat: string;
  sheep: string;
  sheepHead: string;
  cow: string;
  cowSpot: string;
  chicken: string;
  whale: string;
  whaleBelly: string;
  boat: string;
  sail: string;
  fish: string;
  flag: string;
  windmill: string;
  windBlade: string;
  well: string;
  chimney: string;
  path: string;
  water: string;
  waterLight: string;
  // New asset colors for 38-type expansion
  deer: string;
  horse: string;
  flower: string;
  flowerCenter: string;
  mushroom: string;
  mushroomCap: string;
  rock: string;
  boulder: string;
  palm: string;
  willow: string;
  seagull: string;
  dock: string;
  tent: string;
  tentStripe: string;
  hut: string;
  market: string;
  marketAwning: string;
  inn: string;
  innSign: string;
  blacksmith: string;
  anvil: string;
  castle: string;
  castleRoof: string;
  tower: string;
  bridge: string;
  cart: string;
  barrel: string;
  torch: string;
  torchFlame: string;
  cobble: string;
  smoke: string;
  bird: string;
  scarecrow: string;
  scarecrowHat: string;
  stump: string;
  riverOverlay: string;
  pondOverlay: string;
  reeds: string;
  fountain: string;
  fountainWater: string;
  canal: string;
  gardenTree: string;
  ricePaddy: string;
  ricePaddyWater: string;
  // New asset colors for 118-type expansion
  jellyfish: string;
  coral: string;
  turtle: string;
  buoy: string;
  lighthouse: string;
  crab: string;
  driftwood: string;
  sandcastle: string;
  tidePools: string;
  heron: string;
  shellfish: string;
  cattail: string;
  frog: string;
  lily: string;
  rabbit: string;
  fox: string;
  butterfly: string;
  butterflyWing: string;
  beehive: string;
  wildflower: string;
  tallGrass: string;
  birchBark: string;
  haybale: string;
  owl: string;
  squirrel: string;
  moss: string;
  fern: string;
  deadTree: string;
  log: string;
  berryBush: string;
  berry: string;
  spiderWeb: string;
  silo: string;
  pig: string;
  trough: string;
  haystack: string;
  orchard: string;
  orchardFruit: string;
  beeFarm: string;
  pumpkin: string;
  tavern: string;
  tavernSign: string;
  bakery: string;
  stable: string;
  gardenFence: string;
  laundry: string;
  doghouse: string;
  shrine: string;
  wagon: string;
  cathedral: string;
  cathedralWindow: string;
  library: string;
  clocktower: string;
  clockFace: string;
  statue: string;
  parkBench: string;
  warehouse: string;
  gatehouse: string;
  manor: string;
  manorGarden: string;
  signpost: string;
  lantern: string;
  lanternGlow: string;
  woodpile: string;
  puddle: string;
  campfire: string;
  campfireFlame: string;
  // ── Seasonal Asset Colors ────────────────────────────
  // Winter
  snowCap: string;
  snowGround: string;
  ice: string;
  icicle: string;
  frozenWater: string;
  igloo: string;
  sledWood: string;
  sledRunner: string;
  scarfRed: string;
  snowmanCoal: string;
  snowmanCarrot: string;
  winterBirdRed: string;
  winterBirdBrown: string;
  firewoodLog: string;
  bareBranch: string;
  frostWhite: string;
  // Spring
  cherryPetalPink: string;
  cherryPetalWhite: string;
  cherryTrunk: string;
  cherryBranch: string;
  tulipRed: string;
  tulipYellow: string;
  tulipPurple: string;
  tulipStem: string;
  sproutGreen: string;
  nestBrown: string;
  eggBlue: string;
  eggWhite: string;
  crocusPurple: string;
  crocusYellow: string;
  lambWool: string;
  birdhouseWood: string;
  gardenSoil: string;
  // Summer
  parasolRed: string;
  parasolBlue: string;
  parasolYellow: string;
  parasolStripe: string;
  beachTowelA: string;
  beachTowelB: string;
  sandcastleWall: string;
  surfboardBody: string;
  surfboardStripe: string;
  iceCreamCart: string;
  iceCreamUmbrella: string;
  hammockFabric: string;
  sunflowerPetal: string;
  sunflowerCenter: string;
  watermelonRind: string;
  watermelonFlesh: string;
  watermelonSeed: string;
  lemonadeStand: string;
  sprinklerMetal: string;
  poolWater: string;
  poolEdge: string;
  // Autumn
  mapleRed: string;
  mapleCrimson: string;
  mapleOrange: string;
  oakGold: string;
  oakBrown: string;
  birchYellow: string;
  ginkgoYellow: string;
  fallenLeafRed: string;
  fallenLeafOrange: string;
  fallenLeafGold: string;
  fallenLeafBrown: string;
  acornBody: string;
  acornCap: string;
  cornStalkColor: string;
  cornEar: string;
  harvestApple: string;
  harvestGrape: string;
  hotDrinkMug: string;
  hotDrinkSteam: string;
  wreathGreen: string;
  wreathBerry: string;
  // ── Extended Seasonal Colors ─────────────────────────────
  // Autumn extended
  autumnGold: string;
  autumnBronze: string;
  autumnBurgundy: string;
  autumnRust: string;
  autumnOlive: string;
  // Spring extended
  blossomPink: string;
  blossomWhite: string;
  peachPink: string;
  // Winter extended
  icicleBlue: string;
  christmasRed: string;
  christmasGold: string;
  christmasGreen: string;
  // ── Fruit Tree Colors ────────────────────────────────────
  appleRed: string;
  oliveGreen: string;
  oliveFruit: string;
  lemonYellow: string;
  orangeFruit: string;
  pearGreen: string;
  peachFruit: string;
  // ── Additional Livestock Colors ──────────────────────────
  donkey: string;
  goat: string;
  goatHorn: string;
  // ── Enhanced Asset Detail Colors ────────────────────────
  shadow: string;
  bushDark: string;
  leafLight: string;
  flowerAlt: string;
}

/** A color anchor point for interpolation */
interface ColorAnchor {
  level: number;
  rgb: RGB;
}

/** A height anchor point for interpolation */
interface HeightAnchor {
  level: number;
  height: number;
}

/** 100-level terrain palette with smooth interpolation */
export interface TerrainPalette100 {
  getElevation(level: number): ElevationColors;
  getHeight(level: number): number;
  text: { primary: string; secondary: string; accent: string };
  bg: { subtle: string };
  cloud: CloudColors;
  assets: AssetColors;
  /** Pre-computed array for backward compatibility (10 sampled elevations) */
  elevations: ElevationColors[];
  /** Pre-computed array for backward compatibility (10 sampled heights) */
  heights: number[];
}

// ── Interpolation Engine ─────────────────────────────────────

function interpolateRGB(anchors: ColorAnchor[], level: number): RGB {
  const l = clamp(level, 0, 99);
  // Find surrounding anchors
  let lower = anchors[0];
  let upper = anchors[anchors.length - 1];
  for (let i = 0; i < anchors.length - 1; i++) {
    if (l >= anchors[i].level && l <= anchors[i + 1].level) {
      lower = anchors[i];
      upper = anchors[i + 1];
      break;
    }
  }
  /* v8 ignore start */
  if (lower.level === upper.level) return lower.rgb;
  /* v8 ignore stop */
  const t = (l - lower.level) / (upper.level - lower.level);
  return [
    Math.round(lerp(lower.rgb[0], upper.rgb[0], t)),
    Math.round(lerp(lower.rgb[1], upper.rgb[1], t)),
    Math.round(lerp(lower.rgb[2], upper.rgb[2], t)),
  ];
}

function interpolateHeight(anchors: HeightAnchor[], level: number): number {
  const l = clamp(level, 0, 99);
  let lower = anchors[0];
  let upper = anchors[anchors.length - 1];
  for (let i = 0; i < anchors.length - 1; i++) {
    if (l >= anchors[i].level && l <= anchors[i + 1].level) {
      lower = anchors[i];
      upper = anchors[i + 1];
      break;
    }
  }
  /* v8 ignore start */
  if (lower.level === upper.level) return lower.height;
  /* v8 ignore stop */
  const t = (l - lower.level) / (upper.level - lower.level);
  return Math.round(lerp(lower.height, upper.height, t));
}

function darken(rgb: RGB, factor: number): string {
  return `rgb(${Math.round(rgb[0] * factor)},${Math.round(rgb[1] * factor)},${Math.round(rgb[2] * factor)})`;
}

function rgbToHex(rgb: RGB): string {
  return '#' + rgb.map((c) => c.toString(16).padStart(2, '0')).join('');
}

function makeElevation(rgb: RGB): ElevationColors {
  return {
    top: rgbToHex(rgb),
    left: darken(rgb, 0.75),
    right: darken(rgb, 0.6),
  };
}

// ── Dark Mode Anchors ────────────────────────────────────────

const DARK_COLOR_ANCHORS: ColorAnchor[] = [
  { level: 0, rgb: [160, 130, 90] }, // Desert sand
  { level: 4, rgb: [140, 120, 85] }, // Dry earth
  { level: 8, rgb: [100, 115, 100] }, // Scrubland
  { level: 12, rgb: [40, 80, 130] }, // Shallow water / oasis
  { level: 18, rgb: [30, 70, 120] }, // Deeper water
  { level: 24, rgb: [80, 130, 95] }, // Wetland shore
  { level: 30, rgb: [130, 160, 90] }, // Grassland
  { level: 40, rgb: [90, 145, 60] }, // Lush grass
  { level: 52, rgb: [55, 120, 42] }, // Forest
  { level: 65, rgb: [45, 105, 38] }, // Dense forest
  { level: 75, rgb: [90, 140, 55] }, // Rich green farmland
  { level: 85, rgb: [80, 125, 50] }, // Village green
  { level: 93, rgb: [70, 110, 52] }, // Town with parks
  { level: 99, rgb: [65, 100, 55] }, // Lush city
];

const DARK_HEIGHT_ANCHORS: HeightAnchor[] = [
  { level: 0, height: 0 },
  { level: 8, height: 0 },
  { level: 12, height: 0 }, // Water: flat
  { level: 18, height: 0 },
  { level: 24, height: 1 },
  { level: 30, height: 3 },
  { level: 40, height: 5 },
  { level: 52, height: 8 },
  { level: 65, height: 11 },
  { level: 75, height: 14 },
  { level: 85, height: 18 },
  { level: 93, height: 21 },
  { level: 99, height: 24 },
];

// ── Light Mode Anchors ───────────────────────────────────────

const LIGHT_COLOR_ANCHORS: ColorAnchor[] = [
  { level: 0, rgb: [195, 170, 130] }, // Desert sand
  { level: 4, rgb: [180, 158, 120] }, // Dry earth
  { level: 8, rgb: [145, 155, 135] }, // Scrubland
  { level: 12, rgb: [100, 160, 210] }, // Shallow water / oasis
  { level: 18, rgb: [85, 148, 200] }, // Deeper water
  { level: 24, rgb: [120, 168, 140] }, // Wetland shore
  { level: 30, rgb: [160, 195, 115] }, // Grassland
  { level: 40, rgb: [115, 175, 80] }, // Lush grass
  { level: 52, rgb: [75, 150, 58] }, // Forest
  { level: 65, rgb: [65, 135, 52] }, // Dense forest
  { level: 75, rgb: [115, 170, 75] }, // Rich green farmland
  { level: 85, rgb: [100, 155, 68] }, // Village green
  { level: 93, rgb: [90, 140, 65] }, // Town with parks
  { level: 99, rgb: [80, 128, 62] }, // Lush city
];

const LIGHT_HEIGHT_ANCHORS: HeightAnchor[] = DARK_HEIGHT_ANCHORS;

// ── Asset Colors ─────────────────────────────────────────────

const DARK_ASSETS: AssetColors = {
  trunk: '#6b4226',
  pine: '#2a6e1e',
  leaf: '#3d8c2a',
  bush: '#357a22',
  roofA: '#c45435',
  roofB: '#d4924a',
  wall: '#d4c8a0',
  wallShade: '#b0a078',
  church: '#e0d8c0',
  fence: '#9e8a60',
  wheat: '#d4b840',
  sheep: '#e8e8e0',
  sheepHead: '#333',
  cow: '#8b5e3c',
  cowSpot: '#f5f0e0',
  chicken: '#d4a030',
  whale: '#4a7a9e',
  whaleBelly: '#8ab4c8',
  boat: '#8b6840',
  sail: '#e8e0d0',
  fish: '#70b0c8',
  flag: '#cc3333',
  windmill: '#c8b888',
  windBlade: '#d8d0b8',
  well: '#7a6a4a',
  chimney: '#8a6a4a',
  path: '#a09068',
  water: '#3a6a9e',
  waterLight: '#5a90be',
  deer: '#8a6030',
  horse: '#6e4422',
  flower: '#e06080',
  flowerCenter: '#f0d040',
  mushroom: '#e8dcc8',
  mushroomCap: '#c44030',
  rock: '#808080',
  boulder: '#6a6a6a',
  palm: '#4a8828',
  willow: '#558838',
  seagull: '#e0e0e0',
  dock: '#7a6040',
  tent: '#c8b888',
  tentStripe: '#cc4444',
  hut: '#a08860',
  market: '#d8c898',
  marketAwning: '#cc5533',
  inn: '#c8a878',
  innSign: '#d4a040',
  blacksmith: '#555555',
  anvil: '#444444',
  castle: '#a0a0a0',
  castleRoof: '#606080',
  tower: '#909090',
  bridge: '#8a7a5a',
  cart: '#8a6a40',
  barrel: '#7a5a30',
  torch: '#6a5030',
  torchFlame: '#ff9922',
  cobble: '#888878',
  smoke: 'rgba(180,180,180,0.4)',
  bird: '#444444',
  scarecrow: '#8a7040',
  scarecrowHat: '#5a4020',
  stump: '#6b4a26',
  riverOverlay: 'rgba(35,85,160,0.60)',
  pondOverlay: 'rgba(25,75,150,0.65)',
  reeds: '#6a8838',
  fountain: '#909090',
  fountainWater: '#70a8d0',
  canal: '#7a7a6a',
  gardenTree: '#4a9a3a',
  ricePaddy: '#8aaa48',
  ricePaddyWater: '#4a88b0',
  // New 118-type expansion colors
  jellyfish: '#9a70c0',
  coral: '#d06858',
  turtle: '#5a8848',
  buoy: '#cc4444',
  lighthouse: '#d8d0b8',
  crab: '#c06030',
  driftwood: '#8a7050',
  sandcastle: '#d8c890',
  tidePools: '#5a90b0',
  heron: '#a0a8b0',
  shellfish: '#c0a880',
  cattail: '#6a8838',
  frog: '#4a8830',
  lily: '#e088a0',
  rabbit: '#b0a090',
  fox: '#c06a28',
  butterfly: '#d070a0',
  butterflyWing: '#e0a040',
  beehive: '#c0a040',
  wildflower: '#d060d0',
  tallGrass: '#5a9838',
  birchBark: '#e0d8c8',
  haybale: '#c0a848',
  owl: '#8a7050',
  squirrel: '#a06030',
  moss: '#4a7a30',
  fern: '#3a8828',
  deadTree: '#6a5a40',
  log: '#7a5a30',
  berryBush: '#3a7828',
  berry: '#cc3030',
  spiderWeb: 'rgba(200,200,200,0.5)',
  silo: '#a0a0a0',
  pig: '#e0a8a0',
  trough: '#7a6a50',
  haystack: '#c8a838',
  orchard: '#4a8828',
  orchardFruit: '#cc4430',
  beeFarm: '#c8b060',
  pumpkin: '#d07020',
  tavern: '#a08860',
  tavernSign: '#8a6830',
  bakery: '#c8a878',
  stable: '#8a7050',
  gardenFence: '#e0d8c0',
  laundry: '#e0d8e8',
  doghouse: '#8a6030',
  shrine: '#a0a0a8',
  wagon: '#8a6840',
  cathedral: '#c0b8a8',
  cathedralWindow: '#4080c0',
  library: '#b0a088',
  clocktower: '#a0a0a0',
  clockFace: '#e8e0c8',
  statue: '#909098',
  parkBench: '#6a5a40',
  warehouse: '#8a8078',
  gatehouse: '#a09888',
  manor: '#c8b898',
  manorGarden: '#4a8838',
  signpost: '#7a6040',
  lantern: '#6a5a40',
  lanternGlow: '#ffc840',
  woodpile: '#7a5a30',
  puddle: '#5a88b8',
  campfire: '#6a5030',
  campfireFlame: '#ff6622',
  // Seasonal: Winter
  snowCap: '#e8eef5',
  snowGround: '#d8e2ee',
  ice: '#a0c0e0',
  icicle: '#b0d4f0',
  frozenWater: '#6090b8',
  igloo: '#dce8f2',
  sledWood: '#8a5a30',
  sledRunner: '#607080',
  scarfRed: '#cc3030',
  snowmanCoal: '#2a2a2a',
  snowmanCarrot: '#e07020',
  winterBirdRed: '#cc3030',
  winterBirdBrown: '#8a6040',
  firewoodLog: '#6a4020',
  bareBranch: '#6a5a4a',
  frostWhite: '#e0e8f0',
  // Seasonal: Spring
  cherryPetalPink: '#f5a0b8',
  cherryPetalWhite: '#f8e0e8',
  cherryTrunk: '#6a4030',
  cherryBranch: '#7a5040',
  tulipRed: '#e04050',
  tulipYellow: '#f0d040',
  tulipPurple: '#9050c0',
  tulipStem: '#5a9a40',
  sproutGreen: '#80d050',
  nestBrown: '#7a5530',
  eggBlue: '#a8d8e8',
  eggWhite: '#f0ece0',
  crocusPurple: '#8040b0',
  crocusYellow: '#e8c830',
  lambWool: '#f0ece5',
  birdhouseWood: '#a07040',
  gardenSoil: '#5a4030',
  // Seasonal: Summer
  parasolRed: '#e04040',
  parasolBlue: '#4080d0',
  parasolYellow: '#e8c820',
  parasolStripe: '#ffffff',
  beachTowelA: '#e05050',
  beachTowelB: '#4090d0',
  sandcastleWall: '#d8c090',
  surfboardBody: '#e0e0e0',
  surfboardStripe: '#e04040',
  iceCreamCart: '#f0e8d0',
  iceCreamUmbrella: '#e04040',
  hammockFabric: '#d09050',
  sunflowerPetal: '#f0c820',
  sunflowerCenter: '#5a3a20',
  watermelonRind: '#40a040',
  watermelonFlesh: '#e04040',
  watermelonSeed: '#2a2a2a',
  lemonadeStand: '#f0d880',
  sprinklerMetal: '#8090a0',
  poolWater: '#60b8e0',
  poolEdge: '#c0c8d0',
  // Seasonal: Autumn
  mapleRed: '#c83020',
  mapleCrimson: '#a02020',
  mapleOrange: '#d07020',
  oakGold: '#c8a030',
  oakBrown: '#8a6030',
  birchYellow: '#d8c040',
  ginkgoYellow: '#d8c830',
  fallenLeafRed: '#c04030',
  fallenLeafOrange: '#d08030',
  fallenLeafGold: '#d0a030',
  fallenLeafBrown: '#8a5a30',
  acornBody: '#8a6030',
  acornCap: '#5a3820',
  cornStalkColor: '#c8a860',
  cornEar: '#d8c060',
  harvestApple: '#c83030',
  harvestGrape: '#6030a0',
  hotDrinkMug: '#c8a060',
  hotDrinkSteam: '#d0d8e0',
  wreathGreen: '#507038',
  wreathBerry: '#c03030',
  // Extended Seasonal: Autumn
  autumnGold: '#d4a84b',
  autumnBronze: '#b07830',
  autumnBurgundy: '#8b2040',
  autumnRust: '#c05530',
  autumnOlive: '#8b8b40',
  // Extended Seasonal: Spring
  blossomPink: '#ffb6c1',
  blossomWhite: '#fff0f5',
  peachPink: '#ffd5cc',
  // Extended Seasonal: Winter
  icicleBlue: '#d0e8f8',
  christmasRed: '#c41e3a',
  christmasGold: '#ffd700',
  christmasGreen: '#228b22',
  // Fruit Trees
  appleRed: '#c41e3a',
  oliveGreen: '#808060',
  oliveFruit: '#4a4a30',
  lemonYellow: '#fff44f',
  orangeFruit: '#ff8c00',
  pearGreen: '#d1e231',
  peachFruit: '#ffcba4',
  // Additional Livestock
  donkey: '#808080',
  goat: '#e8e0d0',
  goatHorn: '#b0a090',
  // Enhanced asset detail colors
  shadow: '#1a1a2e',
  bushDark: '#2d5a3d',
  leafLight: '#6db86d',
  flowerAlt: '#e8a0c0',
};

const LIGHT_ASSETS: AssetColors = {
  trunk: '#7a5030',
  pine: '#358025',
  leaf: '#4a9e35',
  bush: '#40882a',
  roofA: '#d05a3a',
  roofB: '#daa055',
  wall: '#f0e8d0',
  wallShade: '#d0c498',
  church: '#f0e8d8',
  fence: '#b09a68',
  wheat: '#dac040',
  sheep: '#f5f5f0',
  sheepHead: '#444',
  cow: '#9a6e45',
  cowSpot: '#fff',
  chicken: '#daa835',
  whale: '#4580aa',
  whaleBelly: '#90bcd0',
  boat: '#9a7848',
  sail: '#fff',
  fish: '#60a0b8',
  flag: '#dd3838',
  windmill: '#d8c898',
  windBlade: '#eee',
  well: '#8a7a55',
  chimney: '#9a7a55',
  path: '#b8a078',
  water: '#4578aa',
  waterLight: '#65a0cc',
  deer: '#9a7038',
  horse: '#7e5430',
  flower: '#f07090',
  flowerCenter: '#ffe050',
  mushroom: '#f0e8d8',
  mushroomCap: '#d05040',
  rock: '#909090',
  boulder: '#7a7a7a',
  palm: '#55a030',
  willow: '#609840',
  seagull: '#f0f0f0',
  dock: '#8a7050',
  tent: '#d8c898',
  tentStripe: '#dd5555',
  hut: '#b09870',
  market: '#e8d8a8',
  marketAwning: '#dd6644',
  inn: '#d8b888',
  innSign: '#e4b050',
  blacksmith: '#666666',
  anvil: '#555555',
  castle: '#b0b0b0',
  castleRoof: '#707090',
  tower: '#a0a0a0',
  bridge: '#9a8a6a',
  cart: '#9a7a50',
  barrel: '#8a6a38',
  torch: '#7a6038',
  torchFlame: '#ffaa33',
  cobble: '#989888',
  smoke: 'rgba(160,160,160,0.35)',
  bird: '#555555',
  scarecrow: '#9a8050',
  scarecrowHat: '#6a5030',
  stump: '#7a5a30',
  riverOverlay: 'rgba(60,130,210,0.55)',
  pondOverlay: 'rgba(50,120,200,0.60)',
  reeds: '#7a9848',
  fountain: '#a0a0a0',
  fountainWater: '#80b8e0',
  canal: '#8a8a7a',
  gardenTree: '#55aa45',
  ricePaddy: '#9aba58',
  ricePaddyWater: '#5a98c0',
  // New 118-type expansion colors
  jellyfish: '#b080d8',
  coral: '#e07868',
  turtle: '#6a9858',
  buoy: '#dd5555',
  lighthouse: '#f0e8d8',
  crab: '#d07040',
  driftwood: '#9a8060',
  sandcastle: '#e8d8a0',
  tidePools: '#6aa0c0',
  heron: '#b0b8c0',
  shellfish: '#d0b890',
  cattail: '#7a9848',
  frog: '#5a9838',
  lily: '#f098b0',
  rabbit: '#c0b0a0',
  fox: '#d07a38',
  butterfly: '#e080b0',
  butterflyWing: '#f0b050',
  beehive: '#d0b050',
  wildflower: '#e070e0',
  tallGrass: '#6aa848',
  birchBark: '#f0e8d8',
  haybale: '#d0b858',
  owl: '#9a8060',
  squirrel: '#b07040',
  moss: '#5a8a38',
  fern: '#4a9838',
  deadTree: '#7a6a50',
  log: '#8a6a40',
  berryBush: '#4a8838',
  berry: '#dd4040',
  spiderWeb: 'rgba(180,180,180,0.45)',
  silo: '#b0b0b0',
  pig: '#f0b8b0',
  trough: '#8a7a60',
  haystack: '#d8b848',
  orchard: '#55a038',
  orchardFruit: '#dd5540',
  beeFarm: '#d8c070',
  pumpkin: '#e08030',
  tavern: '#b09870',
  tavernSign: '#9a7838',
  bakery: '#d8b888',
  stable: '#9a8060',
  gardenFence: '#f0e8d0',
  laundry: '#f0e8f0',
  doghouse: '#9a7040',
  shrine: '#b0b0b8',
  wagon: '#9a7850',
  cathedral: '#d0c8b8',
  cathedralWindow: '#5090d0',
  library: '#c0b098',
  clocktower: '#b0b0b0',
  clockFace: '#f8f0d8',
  statue: '#a0a0a8',
  parkBench: '#7a6a50',
  warehouse: '#9a9088',
  gatehouse: '#b0a898',
  manor: '#d8c8a8',
  manorGarden: '#55a048',
  signpost: '#8a7050',
  lantern: '#7a6a50',
  lanternGlow: '#ffd850',
  woodpile: '#8a6a40',
  puddle: '#6a98c8',
  campfire: '#7a6038',
  campfireFlame: '#ff7733',
  // Seasonal: Winter
  snowCap: '#f0f4f8',
  snowGround: '#e4ecf4',
  ice: '#b0d0e8',
  icicle: '#c0e0f8',
  frozenWater: '#70a0c8',
  igloo: '#e8f0f8',
  sledWood: '#9a6a38',
  sledRunner: '#708090',
  scarfRed: '#dd4040',
  snowmanCoal: '#333333',
  snowmanCarrot: '#f08030',
  winterBirdRed: '#dd4040',
  winterBirdBrown: '#9a7050',
  firewoodLog: '#7a5030',
  bareBranch: '#7a6a5a',
  frostWhite: '#eef4f8',
  // Seasonal: Spring
  cherryPetalPink: '#f8b0c8',
  cherryPetalWhite: '#fce8f0',
  cherryTrunk: '#7a5040',
  cherryBranch: '#8a6050',
  tulipRed: '#f05060',
  tulipYellow: '#f8e050',
  tulipPurple: '#a060d0',
  tulipStem: '#6aaa50',
  sproutGreen: '#90e060',
  nestBrown: '#8a6540',
  eggBlue: '#b8e8f0',
  eggWhite: '#f8f4e8',
  crocusPurple: '#9050c0',
  crocusYellow: '#f0d838',
  lambWool: '#f8f4ed',
  birdhouseWood: '#b08050',
  gardenSoil: '#6a5040',
  // Seasonal: Summer
  parasolRed: '#f05050',
  parasolBlue: '#5090e0',
  parasolYellow: '#f0d030',
  parasolStripe: '#ffffff',
  beachTowelA: '#f06060',
  beachTowelB: '#50a0e0',
  sandcastleWall: '#e8d0a0',
  surfboardBody: '#f0f0f0',
  surfboardStripe: '#f05050',
  iceCreamCart: '#f8f0e0',
  iceCreamUmbrella: '#f05050',
  hammockFabric: '#e0a060',
  sunflowerPetal: '#f8d030',
  sunflowerCenter: '#6a4a30',
  watermelonRind: '#50b050',
  watermelonFlesh: '#f05050',
  watermelonSeed: '#333333',
  lemonadeStand: '#f8e890',
  sprinklerMetal: '#90a0b0',
  poolWater: '#70c8f0',
  poolEdge: '#d0d8e0',
  // Seasonal: Autumn
  mapleRed: '#d84030',
  mapleCrimson: '#b03030',
  mapleOrange: '#e08030',
  oakGold: '#d8b040',
  oakBrown: '#9a7040',
  birchYellow: '#e8d050',
  ginkgoYellow: '#e8d840',
  fallenLeafRed: '#d05040',
  fallenLeafOrange: '#e09040',
  fallenLeafGold: '#e0b040',
  fallenLeafBrown: '#9a6a40',
  acornBody: '#9a7040',
  acornCap: '#6a4830',
  cornStalkColor: '#d8b870',
  cornEar: '#e8d070',
  harvestApple: '#d84040',
  harvestGrape: '#7040b0',
  hotDrinkMug: '#d8b070',
  hotDrinkSteam: '#e0e8f0',
  wreathGreen: '#608048',
  wreathBerry: '#d04040',
  // Extended Seasonal: Autumn
  autumnGold: '#e0b85c',
  autumnBronze: '#c08840',
  autumnBurgundy: '#9b3050',
  autumnRust: '#d06540',
  autumnOlive: '#9b9b50',
  // Extended Seasonal: Spring
  blossomPink: '#ffc6d1',
  blossomWhite: '#fff8fb',
  peachPink: '#ffe5dc',
  // Extended Seasonal: Winter
  icicleBlue: '#e0f0ff',
  christmasRed: '#d42e4a',
  christmasGold: '#ffe720',
  christmasGreen: '#32a032',
  // Fruit Trees
  appleRed: '#d42e4a',
  oliveGreen: '#909070',
  oliveFruit: '#5a5a40',
  lemonYellow: '#ffff5f',
  orangeFruit: '#ff9c10',
  pearGreen: '#e1f241',
  peachFruit: '#ffdbb4',
  // Additional Livestock
  donkey: '#909090',
  goat: '#f0e8e0',
  goatHorn: '#c0b0a0',
  // Enhanced asset detail colors
  shadow: '#4a4a5e',
  bushDark: '#3d6a4d',
  leafLight: '#8dd88d',
  flowerAlt: '#f8b0d0',
};

// ── Palette Factory ──────────────────────────────────────────

export function getTerrainPalette100(mode: ColorMode): TerrainPalette100 {
  const colorAnchors = mode === 'dark' ? DARK_COLOR_ANCHORS : LIGHT_COLOR_ANCHORS;
  const heightAnchors = mode === 'dark' ? DARK_HEIGHT_ANCHORS : LIGHT_HEIGHT_ANCHORS;

  const getElevation = (level: number): ElevationColors => {
    const rgb = interpolateRGB(colorAnchors, level);
    return makeElevation(rgb);
  };

  const getHeight = (level: number): number => {
    return interpolateHeight(heightAnchors, level);
  };

  // Pre-compute 10 sampled elevations for backward compatibility
  const sampleLevels = [0, 5, 12, 25, 40, 55, 70, 82, 92, 99];
  const elevations = sampleLevels.map((l) => getElevation(l));
  const heights = sampleLevels.map((l) => getHeight(l));

  return {
    getElevation,
    getHeight,
    elevations,
    heights,
    text:
      mode === 'dark'
        ? { primary: '#e6edf3', secondary: '#8b949e', accent: '#58a6ff' }
        : { primary: '#1f2328', secondary: '#656d76', accent: '#0969da' },
    bg: { subtle: mode === 'dark' ? '#161b22' : '#f6f8fa' },
    cloud:
      mode === 'dark'
        ? { fill: 'rgba(200,210,220,0.12)', stroke: 'rgba(200,210,220,0.06)', opacity: 0.8 }
        : { fill: 'rgba(190,205,220,0.35)', stroke: 'rgba(160,175,195,0.30)', opacity: 0.85 },
    assets: mode === 'dark' ? DARK_ASSETS : LIGHT_ASSETS,
  };
}

// ── Seasonal Palette ─────────────────────────────────────────

/**
 * Apply a seasonal tint to all asset colors.
 * Returns a new AssetColors object with tinted hex/rgb values.
 * Colors that are not standard hex or rgb() are passed through unchanged.
 */
function tintAssetColors(assets: AssetColors, tint: SeasonalTint): AssetColors {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(assets)) {
    /* v8 ignore start */
    if (typeof value === 'string') {
      /* v8 ignore stop */
      if (value.startsWith('#') && value.length === 7) {
        result[key] = applyTintToHex(value, tint);
      } else if (value.startsWith('rgb')) {
        result[key] = applyTintToRgb(value, tint);
      } else {
        result[key] = value;
      }
    }
  }
  return result as unknown as AssetColors;
}

/**
 * Get a seasonal terrain palette for a specific week.
 * Wraps getTerrainPalette100 and applies seasonal tinting to
 * all elevation colors and asset colors.
 *
 * Summer (zone 4) returns the base palette unchanged.
 */
export function getSeasonalPalette100(
  mode: ColorMode,
  week: number,
  rotation: number = 0,
): TerrainPalette100 {
  const base = getTerrainPalette100(mode);
  const tint = getSeasonalTint(week, rotation);

  // Summer has no tinting — return base palette
  if (
    tint.colorShift === 0 &&
    tint.warmth === 0 &&
    tint.snowCoverage === 0 &&
    tint.greenMul === 1 &&
    tint.saturation === 1
  ) {
    return base;
  }

  const colorAnchors = mode === 'dark' ? DARK_COLOR_ANCHORS : LIGHT_COLOR_ANCHORS;
  const heightAnchors = mode === 'dark' ? DARK_HEIGHT_ANCHORS : LIGHT_HEIGHT_ANCHORS;

  const getElevation = (level: number): ElevationColors => {
    const rgb = interpolateRGB(colorAnchors, level);
    const tinted = [
      clamp(Math.round(applyTintValues(rgb[0], rgb[1], rgb[2], tint)[0]), 0, 255),
      clamp(Math.round(applyTintValues(rgb[0], rgb[1], rgb[2], tint)[1]), 0, 255),
      clamp(Math.round(applyTintValues(rgb[0], rgb[1], rgb[2], tint)[2]), 0, 255),
    ] as [number, number, number];
    return makeElevation(tinted);
  };

  const getHeight = (level: number): number => {
    return interpolateHeight(heightAnchors, level);
  };

  const sampleLevels = [0, 5, 12, 25, 40, 55, 70, 82, 92, 99];
  const elevations = sampleLevels.map((l) => getElevation(l));
  const heights = sampleLevels.map((l) => getHeight(l));

  return {
    getElevation,
    getHeight,
    elevations,
    heights,
    text: base.text,
    bg: base.bg,
    cloud: base.cloud,
    assets: tintAssetColors(base.assets, tint),
  };
}

/** Internal helper — applies tint to raw RGB without hex conversion */
function applyTintValues(
  r: number,
  g: number,
  b: number,
  tint: SeasonalTint,
): [number, number, number] {
  // 1. Saturation
  const gray = 0.299 * r + 0.587 * g + 0.114 * b;
  let nr = gray + (r - gray) * tint.saturation;
  let ng = gray + (g - gray) * tint.saturation;
  let nb = gray + (b - gray) * tint.saturation;

  // 2. Green multiplier
  ng *= tint.greenMul;

  // 3. Warmth
  nr += tint.warmth;
  nb -= tint.warmth;

  // 4. Color shift (false branch unreachable: only summer has colorShift=0, and summer returns early)
  /* v8 ignore start */
  if (tint.colorShift > 0) {
    /* v8 ignore stop */
    nr = lerp(nr, tint.colorTarget[0], tint.colorShift);
    ng = lerp(ng, tint.colorTarget[1], tint.colorShift);
    nb = lerp(nb, tint.colorTarget[2], tint.colorShift);
  }

  // 5. Snow coverage
  if (tint.snowCoverage > 0) {
    nr = lerp(nr, 240, tint.snowCoverage);
    ng = lerp(ng, 244, tint.snowCoverage);
    nb = lerp(nb, 250, tint.snowCoverage);
  }

  return [
    clamp(Math.round(nr), 0, 255),
    clamp(Math.round(ng), 0, 255),
    clamp(Math.round(nb), 0, 255),
  ];
}

// ── Legacy API ────────────────────────────────────────────────

/** @deprecated Use getTerrainPalette100 instead */
export interface TerrainPalette {
  elevations: ElevationColors[];
  heights: number[];
  text: { primary: string; secondary: string; accent: string };
  bg: { subtle: string };
  cloud: string;
  assets: AssetColors;
}

/** @deprecated Use getTerrainPalette100 instead */
export function getTerrainPalette(mode: ColorMode): TerrainPalette {
  const p100 = getTerrainPalette100(mode);
  return {
    elevations: p100.elevations,
    heights: p100.heights,
    text: p100.text,
    bg: p100.bg,
    cloud: mode === 'dark' ? 'rgba(200,210,220,0.10)' : 'rgba(255,255,255,0.45)',
    assets: p100.assets,
  };
}
