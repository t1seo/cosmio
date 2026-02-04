# Maeul

Animated isometric terrain SVG generator for GitHub contribution graphs.

## Architecture

```
src/
├── api/client.ts          # GitHub GraphQL API client with retry
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
└── index.ts               # CLI entry (commander.js)
```

## Key Concepts

- **100-level system**: Contribution counts map to levels 0-99 for fine-grained terrain
- **Isometric projection**: `isoX = originX + (week - day) * THW`, `isoY = originY + (week + day) * THH`
- **originX = 436**: Right-aligned terrain (rightmost edge at ~x=800)
- **Season zones**: 8 zones (0-7), reversed so week 51 (rightmost) = winter. `w = 51 - w` before zone lookup
- **Hemisphere**: Southern hemisphere shifts by +26 weeks before zone lookup
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

## Testing

- Tests in `tests/` mirror `src/` structure
- `vitest` with no special setup
- Season tests use specific week numbers mapped to expected zones

## Conventions

- Gitmoji commit style: `emoji type: message`
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
- `THW = 7` (tile half-width), `THH = 4` (tile half-height)
- Grid: 52 weeks x 7 days
- Animation budget: 50 max (water 15, sparkle 10, clouds 2, windmills 4, flags 4)
