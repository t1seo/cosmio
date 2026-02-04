# Maeul in the Sky

Animated isometric terrain SVG generator for GitHub contribution graphs.

- **Package**: `maeul-in-the-sky`
- **CLI**: `maeul-sky`
- **SVG output**: `maeul-in-the-sky-dark.svg`, `maeul-in-the-sky-light.svg`

## Architecture

```
src/
├── api/
│   ├── client.ts          # GitHub GraphQL API client with retry
│   └── queries.ts         # GraphQL query strings
├── core/
│   ├── types.ts           # Shared type definitions
│   └── stats.ts           # Contribution statistics (streaks, totals)
├── themes/
│   ├── registry.ts        # Theme registration system
│   ├── shared.ts          # Grid layout, enrichment, title/stats bar
│   └── terrain/           # Isometric terrain theme
│       ├── index.ts       # Main renderer (entry point)
│       ├── blocks.ts      # Isometric block rendering (toIsoCells, renderBlock)
│       ├── palette.ts     # 100-level color palette with elevation mapping
│       ├── seasons.ts     # 4-season system (8 zones, tinting, asset overrides)
│       ├── biomes.ts      # Procedural biome generation (rivers, ponds, forests)
│       ├── effects.ts     # Clouds, celestials, water overlays, particles
│       └── assets.ts      # 118 terrain asset types (trees, buildings, etc.)
├── utils/
│   ├── math.ts            # seededRandom, lerp, clamp
│   ├── color.ts           # Color manipulation
│   └── noise.ts           # Simplex noise wrapper
├── index.ts               # CLI entry (commander.js)
└── action.ts              # GitHub Action entry point
```

## Key Concepts

- **100-level system**: Contribution counts map to levels 0-99 for fine-grained terrain
- **Isometric projection**: `isoX = originX + (week - day) * THW`, `isoY = originY + (week + day) * THH`
- **originX = 436**: Right-aligned terrain (rightmost edge at ~x=800)
- **Season zones**: 8 zones (0-7) aligned to calendar months via rotation. `w = (week + rotation) % 52` before zone lookup
- **Season rotation**: `computeSeasonRotation(oldestDate, hemisphere)` computes weeks from Dec 1 to the oldest data week
- **Hemisphere**: Southern hemisphere adds +26 to rotation (6-month shift)
- **Seeded RNG**: All procedural generation uses `seededRandom(seed)` for deterministic output
- **Biome map**: `Map<"week,day", BiomeContext>` — rivers follow noise-based paths, ponds form at low points

## Commands

```bash
npm run build        # Build with tsup (outputs dist/)
npm run dev          # Watch mode
npm test             # Run vitest
npm run lint         # ESLint
npm run typecheck    # TypeScript --noEmit
```

## Scripts

```bash
npx tsx scripts/generate-preview.ts    # Generate README preview SVGs (.github/assets/)
npx tsx scripts/generate-examples.ts   # Generate example SVGs (examples/)
npx tsx scripts/generate-cases.ts      # Generate case study SVGs (examples/cases/)
```

## Testing

- Tests in `tests/` mirror `src/` structure
- `vitest` with no special setup
- Season tests use specific week numbers mapped to expected zones

## Conventions

- Gitmoji commit style: `emoji type: message`
- **Always update CHANGELOG.md** when committing notable changes (new features, fixes, breaking changes)
- **Always create/update GitHub release** after pushing version changes: `gh release create vX.Y.Z` with notes matching CHANGELOG. Update the floating `v1` tag to point to the latest release.
- TypeScript strict mode
- ESM modules (`"type": "module"` in package.json)
- No default exports — named exports only
- Theme self-registration pattern (import triggers `registerTheme()`)

## Rendering Pipeline

1. Fetch contribution data via GitHub GraphQL API
2. Build grid cells with 100-level intensity (`enrichGridCells100`)
3. Generate seasonal palettes per week (`getSeasonalPalette100`)
4. Convert to isometric cells (`toIsoCells`)
5. Generate biome map (`generateBiomeMap`)
6. Render layers back-to-front: sky → celestials → clouds → terrain blocks → assets → water → overlays → particles → stats bar

## Important Constants

- SVG viewport: 840 x 240
- `THW = 8` (tile half-width), `THH = 3.5` (tile half-height)
- Grid: 52 weeks x 7 days
- Animation budget: 50 max (water 15, sparkle 10, clouds 2, windmills 4, flags 4)
