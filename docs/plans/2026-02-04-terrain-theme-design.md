# Isometric Terrain Theme Design

> Contribution data as a 3D isometric terrain — more code = taller mountains.

## Concept

The 52x7 contribution grid is projected into an isometric 3D view. Each cell becomes a block/column whose **height = contribution level**. Colors follow natural elevation: deep ocean (level 0) through green plains, brown mountains, to snow-capped peaks (level 9).

## Visual Specification

### Isometric Projection

Each cell at grid position `(week, day)` maps to screen coordinates:
```
x = originX + (week - day) * tileHalfW
y = originY + (week + day) * tileHalfH - elevation
```

Each block rendered as 3 polygons:
- **Top face** (brightest) — isometric diamond
- **Left face** (medium) — left side shadow
- **Right face** (darkest) — right side deep shadow

Drawing order: back to front (`week + day` ascending) for correct occlusion.

### Tile Sizing

Canvas: 840 x 240. Grid: 52 weeks x 7 days.

Target: tileHalfW ≈ 7, tileHalfH ≈ 3
- X span: 57 * 7 = 399px → centered in 840
- Y span: 57 * 3 + maxHeight = 171 + 35 = 206px → fits with title/stats

### Height & Color Mapping (10 Levels)

| Level | Height | Terrain | Top (Dark) | Top (Light) |
|-------|--------|---------|-----------|-------------|
| 0 | 0px | Deep ocean | `#1a3c5e` | `#a8c8e8` |
| 1 | 4px | Shallow water | `#2a6496` | `#7eb3d8` |
| 2 | 7px | Beach/sand | `#c2b280` | `#d4c494` |
| 3 | 11px | Plains | `#5a8c3c` | `#7aac5c` |
| 4 | 15px | Grassland | `#3d7a28` | `#5d9a48` |
| 5 | 19px | Forest/hills | `#2d6420` | `#4d8440` |
| 6 | 23px | Foothills | `#8b6914` | `#ab8934` |
| 7 | 27px | Mountain | `#6b4c24` | `#8b6c44` |
| 8 | 31px | Alpine rock | `#9a9a9a` | `#808080` |
| 9 | 35px | Snow peak | `#f0f0f0` | `#d8d8d8` |

Left face: 25% darker. Right face: 40% darker.

### Animations (budget: 50 max)

- **Water shimmer** (level 0-1): CSS opacity animation on ocean blocks, subtle 0.7↔1.0 oscillation. ~15 animated cells max.
- **Snow sparkle** (level 9): CSS opacity twinkle on peak blocks. ~10 animated cells max.
- **Clouds**: 2-3 small translucent cloud shapes drifting slowly across the terrain using SMIL translate. Adds atmosphere and depth.

### Stats & Title

- Title: top-left corner, above the terrain
- Stats bar: bottom of canvas, below the terrain
- Same shared utilities (renderTitle, renderStatsBar)

## File Structure

```
src/themes/terrain/
├── index.ts      — Theme composition + registration
├── palette.ts    — 10-level elevation colors for dark/light, face shading
├── blocks.ts     — Isometric block rendering (3-face polygons)
├── effects.ts    — Water shimmer, snow sparkle, cloud animations
```

## Implementation Notes

- Use `<polygon>` for block faces (3 points for top diamond, 4 for side faces)
- Blocks with elevation 0 (ocean) render as flat diamonds only (no sides)
- Drawing order is critical: iterate by (week + day) ascending, within same sum iterate by week ascending
- All randomness seeded via `hash(username + mode)` for determinism
- No `mix-blend-mode`, no JS, no external resources
