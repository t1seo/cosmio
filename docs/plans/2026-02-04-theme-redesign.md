# Cosmio Theme Redesign: Starfield + Solar System

> Replace 4 confusing themes with 2 intuitive, visually stunning themes that make contribution activity feel like cosmic achievement.

## Problem

Current 4 themes (Nebula, Constellation, Voyage, Defense) are visually complex but semantically unclear. Users can't intuit what the visualization represents. The contribution grid is either dissolved beyond recognition or buried under unrelated visual metaphors.

## Design Principles

1. **Grid stays visible** — The 52x7 contribution grid is the core data structure. Keep it recognizable.
2. **More activity = more visual reward** — Higher contributions produce richer, more beautiful effects.
3. **Instant readability** — Anyone should understand "bright = active" within 2 seconds.
4. **3D-like depth** — Use SVG gradients, shadows, and layering to create perceived depth.

---

## 1. Ten-Level System

GitHub provides 5 levels (0-4) via quartiles, but raw `contributionCount` is also available. We subdivide into 10 levels for smoother visual gradation.

### Level Mapping

The approach: keep GitHub's quartile boundaries for levels 0-4, then subdivide each non-zero quartile into 2 sub-levels based on whether the count is above or below the quartile median.

```typescript
// Compute 10-level from raw count using percentile-based thresholds
function computeLevel10(count: number, maxCount: number): 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 {
  if (count === 0) return 0;
  const ratio = count / Math.max(maxCount, 1);
  // Smooth curve mapping: more granularity at lower levels where most data lives
  if (ratio <= 0.05) return 1;  // barely active
  if (ratio <= 0.10) return 2;  // light
  if (ratio <= 0.18) return 3;  // light-medium
  if (ratio <= 0.28) return 4;  // medium
  if (ratio <= 0.40) return 5;  // medium-high
  if (ratio <= 0.52) return 6;  // high
  if (ratio <= 0.65) return 7;  // very high
  if (ratio <= 0.80) return 8;  // intense
  if (ratio <= 0.92) return 9;  // extreme
  return 9;                      // cap at 9 (max)
}
```

### Implementation

Add to `src/themes/shared.ts`:
- `computeLevel10(count, maxCount)` — Pure function
- `enrichGridCells(cells, data)` — Adds `level10` to each GridCell
- Export a `GridCell10` interface extending `GridCell` with `level10: 0-9`

---

## 2. Starfield Theme

**Concept**: Each contribution cell is a star in the night sky. No activity = void of space. More activity = brighter, larger, more vivid stars. High-streak periods trigger shooting star animations. The contribution grid becomes a star map.

### Visual Mapping (10 Levels)

| Level | Visual | Size | Color (Dark) | Color (Light) | Effect |
|-------|--------|------|-------------|---------------|--------|
| 0 | Empty void | — | transparent | transparent | Subtle dark dust |
| 1 | Dim speck | 2px | `#3b4559` | `#c8d1dc` | None |
| 2 | Faint star | 3px | `#5a6a82` | `#9aa8ba` | None |
| 3 | Small star | 4px | `#7b8fa8` | `#7b8fa8` | None |
| 4 | Medium star | 5px | `#8cb4d9` | `#5a8ab5` | Faint glow |
| 5 | Bright star | 5.5px | `#a8d0f0` | `#3e7aad` | Soft glow |
| 6 | Vivid star | 6px | `#c5e4ff` | `#2a6a9e` | Medium glow + twinkle |
| 7 | Brilliant star | 6.5px | `#dff0ff` | `#1d5e94` | Strong glow + twinkle |
| 8 | Radiant star | 7px | `#f0f8ff` | `#165388` | Bright glow + pulse |
| 9 | Supernova | 8px | `#ffffff` | `#0e4578` | Intense glow + pulse + rays |

### Star Rendering

Each star is a circle with optional radial gradient glow:

```
Level 0: nothing (or barely-visible dot at 0.05 opacity)
Level 1-3: simple <circle> with flat color
Level 4-6: <circle> + radial gradient glow (feGaussianBlur)
Level 7-9: <circle> + gradient glow + twinkle animation + optional cross rays
```

### 3D Depth Effect

Create depth perception through 3 techniques:
1. **Background star field**: Tiny (1px), dim, slowly drifting dots behind the grid — gives parallax depth
2. **Radial glow**: Higher-level stars use `<radialGradient>` fill that simulates light emission
3. **Size variation**: Larger stars appear "closer" — creating a sense of depth in the star field

### Animations (max 50 elements)

- **Twinkle** (levels 6-9): SMIL `<animate>` on opacity, values `1;0.6;1`, dur `2-4s` with staggered delays. Apply to ~30 high-level stars max.
- **Pulse glow** (levels 8-9): CSS `@keyframes` scaling the glow radius, dur `3-5s`. Apply to ~10 max.
- **Shooting stars** (streak bonus): For each streak of 7+ days, render 1 shooting star animation (max 5). A diagonal line that traces across the streak cells with a gradient tail. SMIL translate + opacity.
- **Background drift**: 15-20 tiny background stars with slow SMIL translate animation, creating parallax.

### Color Palette

**Dark mode** — Stars are white/blue on deep space black:
```
Background: transparent (sits on GitHub's #0d1117)
Star colors: blue-white spectrum (#3b4559 → #ffffff)
Glow: radial gradient from star color to transparent
Text: #e6edf3 (primary), #8b949e (secondary)
```

**Light mode** — Stars are deep blue on white (inverted astronomy chart):
```
Background: transparent (sits on GitHub's #ffffff)
Star colors: deep blue spectrum (#c8d1dc → #0e4578)
Glow: radial gradient from star color to transparent
Text: #1f2328 (primary), #656d76 (secondary)
```

### Layout

```
┌──────────────────────────────────────────────────────┐
│ @username                                              │
│                                                        │
│  ✦ · ✦ ✦ ·  · ✦ ·  ★ ✦ ★  ·  ✦ ✦ ·  ★ ✦ ·  · ✦ ·  │
│  · ✦ ·  · ★  ✦ · ★  ✦ ·  ★ ✦ · ✦ ★  ✦ ·  ★ · ✦ ·   │
│  ✦ · ✦ ★ ·  ✦ · ✦  · ★ ·  ✦ · ✦ · ★  · ✦ · ✦ ★ ·   │  ← Grid cells as stars
│  · ★ ·  ✦ ·  · ✦ ·  ✦ · ✦  · ★ · ✦  ★ ·  ✦ · ✦ ·   │
│  ✦ · ✦ · ★  ✦ · ★  · ✦ ·  ★ · ✦ ✦ ·  ✦ ★ · ✦ · ★   │
│  · ✦ ★ ·  ✦ ·  · ★  ✦ · ✦  · ✦ · ★  · ✦ ·  ✦ ★ ·   │
│  ★ · ✦ ·  · ✦  ★ ·  · ✦ ★  ✦ · ★ ·  ✦ · ★  · ✦ ·   │
│           ~~~ shooting star ~~~~~~~~→                   │
│                                                        │
│ 1,247 contributions  7d streak  42d longest  Wednesday │
└──────────────────────────────────────────────────────┘
```

### File Structure

```
src/themes/starfield/
├── index.ts        — Theme composition + registration
├── palette.ts      — 10-level color definitions for dark/light
├── stars.ts        — Star rendering (circles, glows, rays)
├── effects.ts      — Shooting stars, background field, twinkle/pulse animations
```

---

## 3. Solar System Theme

**Concept**: The contribution grid becomes a miniature universe. Each cell evolves from empty void through cosmic objects as activity increases. Low activity = space dust. Medium = rocky planets. High = gas giants with rings. Maximum = blazing stars. The grid tells a story of cosmic creation powered by your code.

### Visual Mapping (10 Levels)

| Level | Object | Size | Visual Description |
|-------|--------|------|--------------------|
| 0 | Void | — | Empty or faint space dust (1-2 tiny dots) |
| 1 | Space dust | 2px | Small grey particle |
| 2 | Asteroid | 3px | Irregular rocky shape (slightly non-circular) |
| 3 | Small moon | 4px | Smooth grey sphere with subtle crater shadow |
| 4 | Rocky planet | 5px | Earth-tone sphere with radial gradient (3D look) |
| 5 | Ocean planet | 5.5px | Blue-green sphere with gradient and atmosphere rim |
| 6 | Gas giant | 6.5px | Large sphere with horizontal bands (Jupiter-like) |
| 7 | Ringed planet | 7px | Sphere + elliptical ring (Saturn-like) |
| 8 | Binary star | 7.5px | Warm-colored glowing sphere + small companion |
| 9 | Supergiant star | 8.5px | Bright, large, with corona and glow |

### 3D Sphere Technique

Create convincing 3D spheres using SVG `<radialGradient>`:

```svg
<!-- 3D sphere illusion -->
<radialGradient id="sphere-l4" cx="35%" cy="30%" r="65%">
  <stop offset="0%" stop-color="#c49a6c"/>    <!-- highlight -->
  <stop offset="50%" stop-color="#8b6914"/>   <!-- body -->
  <stop offset="100%" stop-color="#3d2e0a"/>  <!-- shadow -->
</radialGradient>
<circle cx="10" cy="10" r="5" fill="url(#sphere-l4)"/>
```

Key: offset the gradient center (cx="35%", cy="30%") to create a light-source illusion from top-left.

### Planet Details by Level

**Level 4 — Rocky Planet**: Simple radial gradient sphere. Colors: warm earth tones (dark) / muted browns (light).

**Level 5 — Ocean Planet**: Blue-green gradient + thin atmosphere ring (a slightly larger, semi-transparent circle around it). Could use `<feGaussianBlur>` on a ring for atmosphere.

**Level 6 — Gas Giant**: Larger sphere with 2-3 horizontal bands achieved via `<clipPath>` + `<rect>` stripes over the sphere. Colors: orange/brown bands like Jupiter.

**Level 7 — Ringed Planet**: Sphere + `<ellipse>` ring tilted at ~70deg angle. Ring uses a linear gradient for 3D look. The ring is clipped at the front-bottom to appear to go behind the planet.

**Level 8 — Binary Star**: Primary warm star (orange-yellow) with radial gradient glow + smaller companion star offset to the side. Both with glow animation.

**Level 9 — Supergiant Star**: Large bright circle with intense radial glow and animated corona (pulsing outer ring). Color: bright yellow-white core fading to orange edge.

### Symbol Definitions Strategy

Since many cells share the same level, define reusable `<symbol>` elements in `<defs>` for each level (per mode). Then `<use>` to stamp them at grid positions. This keeps SVG size manageable.

```svg
<defs>
  <symbol id="obj-0" viewBox="0 0 12 12"><!-- void --></symbol>
  <symbol id="obj-1" viewBox="0 0 12 12"><!-- dust --></symbol>
  ...
  <symbol id="obj-9" viewBox="0 0 12 12"><!-- supergiant --></symbol>
</defs>

<!-- Grid -->
<use href="#obj-4" x="100" y="50" width="12" height="12"/>
<use href="#obj-7" x="114" y="50" width="12" height="12"/>
```

### Animations (max 50 elements)

- **Planet rotation** (levels 6-7): Slow rotate animation on gas giant bands / ring tilt. SMIL animateTransform rotate, dur 20-40s. Apply to ~15 max.
- **Star glow pulse** (levels 8-9): SMIL animate on opacity of glow circle, dur 2-4s. Apply to ~15 max.
- **Atmospheric shimmer** (level 5): Subtle opacity pulse on atmosphere ring. SMIL, dur 5s. Apply to ~10 max.
- **Shooting star** (streak bonus): Same as Starfield theme — diagonal streak animation for 7+ day streaks.
- **Background nebula dust**: 5-10 very faint, slowly drifting particles for depth.

### Color Palette

**Dark mode**:
```
Void: transparent
Dust/Asteroid: #4a5568 → #718096
Moon: #a0aec0 with shadow #4a5568
Rocky planet: #c49a6c → #3d2e0a (earth tones)
Ocean planet: #4299e1 → #1a365d (blue)
Gas giant: #ed8936 → #744210 (orange/brown bands)
Ringed planet: #ecc94b → #744210 (golden ring, orange body)
Binary star: #fbd38d → #c05621 (warm orange-yellow glow)
Supergiant: #fefcbf → #f56565 (yellow-white core, red corona)
Text: #e6edf3 / #8b949e
```

**Light mode**: Slightly muted versions of the same palette, with darker outlines for visibility on white.

### Layout

Same grid structure as Starfield — the 52x7 grid sits in the main visualization area. Each cell is replaced with the corresponding celestial object symbol.

```
┌──────────────────────────────────────────────────────┐
│ @username                                              │
│                                                        │
│  · ○ ◐ ●  · ◐ ·  ☆ ○ ★  ·  ○ ◐ ·  ★ ○ ·  · ◐ ·    │
│  · ○ ·  · ☆  ◐ · ☆  ○ ·  ★ ◐ · ○ ☆  ○ ·  ★ · ○ ·   │
│  ○ · ○ ☆ ·  ○ · ◐  · ☆ ·  ○ · ◐ · ★  · ○ · ○ ☆ ·   │  ← Dust, moons, planets,
│  · ☆ ·  ○ ·  · ○ ·  ◐ · ○  · ☆ · ◐  ★ ·  ○ · ○ ·   │     gas giants, stars
│  ◐ · ○ · ☆  ○ · ★  · ○ ·  ☆ · ○ ◐ ·  ○ ☆ · ○ · ★   │
│  · ◐ ☆ ·  ○ ·  · ☆  ○ · ◐  · ○ · ★  · ○ ·  ○ ☆ ·   │
│  ★ · ○ ·  · ◐  ☆ ·  · ○ ★  ◐ · ★ ·  ○ · ☆  · ○ ·   │
│                                                        │
│ 1,247 contributions  7d streak  42d longest  Wednesday │
└──────────────────────────────────────────────────────┘
```

### File Structure

```
src/themes/solar/
├── index.ts        — Theme composition + registration
├── palette.ts      — 10-level color definitions + gradient specs
├── objects.ts      — Celestial object SVG symbol renderers (void→supergiant)
├── effects.ts      — Animations (rotation, glow, shimmer, shooting stars)
```

---

## 4. Implementation Plan

### Phase 1: Foundation (shared)
1. Add `GridCell10` type and `computeLevel10()` to `src/themes/shared.ts`
2. Add `enrichGridCells()` helper function
3. Update `LevelColors` type to support 10 levels (or add `LevelColors10`)

### Phase 2: Starfield Theme
1. Create `src/themes/starfield/palette.ts` — 10-level star colors for dark/light
2. Create `src/themes/starfield/stars.ts` — Star circle + glow rendering per level
3. Create `src/themes/starfield/effects.ts` — Shooting stars, background field, animations
4. Create `src/themes/starfield/index.ts` — Compose layers + register theme
5. Create `tests/themes/starfield.test.ts` — Snapshot + structural tests

### Phase 3: Solar System Theme
1. Create `src/themes/solar/palette.ts` — 10-level object colors + gradient definitions
2. Create `src/themes/solar/objects.ts` — Symbol renderers for each celestial object type
3. Create `src/themes/solar/effects.ts` — Rotation, glow, shimmer animations
4. Create `src/themes/solar/index.ts` — Compose layers + register theme
5. Create `tests/themes/solar.test.ts` — Snapshot + structural tests

### Phase 4: Cleanup
1. Remove old themes: nebula, constellation, voyage, defense (directories)
2. Update `src/index.ts`, `src/action.ts`, `src/lib.ts` imports
3. Update `scripts/generate-examples.ts` to reference new themes
4. Update documentation

### Phase 5: Polish
1. Generate example SVGs and visually review
2. Fine-tune colors, sizes, glow intensities
3. Verify animation count stays under 50
4. Verify GitHub rendering compatibility (no JS, no external resources)
