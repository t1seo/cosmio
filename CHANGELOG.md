# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-02-05

### Changed

- **Renamed to Maeul in the Sky** (천공의 마을) — package `maeul-in-the-sky`, CLI `maeul-sky`, SVG output `maeul-in-the-sky-{dark,light}.svg`.
- **Larger terrain tiles** — THW 7→8, THH 3→3.5, origin shifted left. ~14% bigger terrain with less empty space on the left.
- **Preview assets** — replaced GIFs with generated SVGs using rich sample data.
- **Level distribution** — switched from log curve to sqrt curve with P90 normalization. Moderate activity now reaches village/city levels instead of being compressed by outlier days.
- **README** — added "How Does the Terrain Work?" section explaining terrain mechanics with examples. Removed CLI and Development sections (not intended for local use).

## [1.0.1] - 2026-02-05

### Changed

- **Calendar-aligned rolling seasons** — seasons now match actual calendar months instead of using a fixed week-51 = winter mapping. A rotation offset is computed from the oldest contribution week's date relative to December 1, so the terrain always shows the correct season regardless of when data starts.
- **Season API signature** — all season functions (`getSeasonZone`, `getTransitionBlend`, `getSeasonalTint`, `getSeasonalPoolOverrides`) now accept a numeric `rotation` parameter instead of `hemisphere` string. Hemisphere is folded into the rotation via `computeSeasonRotation()`.
- **Preview GIFs** — regenerated at 2x resolution (1680×480) with calendar-aligned seasons.

## [1.0.0] - 2026-02-04

### Added

- **Isometric terrain theme** with 100-level elevation system mapped to GitHub contribution data
- **4-season cycle** (Winter, Spring, Summer, Autumn) with 8 transition zones and smooth color tinting
- **48 seasonal assets** — snowmen, cherry blossoms, sunflowers, autumn maples, and more
- **118 terrain asset types** — trees, buildings, windmills, scarecrows, flags, benches, and more
- **Biome generation** — procedural rivers, ponds, and forest clusters via seeded simplex noise
- **Animated SVG effects** — drifting clouds (SMIL), water shimmer, town sparkle, flag wave (CSS)
- **Celestial bodies** — stars and crescent moon (dark mode), sun with rays (light mode)
- **Seasonal particles** — falling snow, cherry blossom petals, autumn leaves
- **Dark & Light mode** — generates both variants with theme-aware palettes
- **Hemisphere support** — northern and southern hemisphere seasonal mapping
- **Right-aligned terrain** — grid positioned like GitHub's 3D contribution view
- **Season direction** — rightmost (most recent) weeks display current season
- **GitHub Action** — drop-in workflow with configurable inputs (theme, year, hemisphere, title)
- **CLI** — `maeul-sky -u <username>` with full option support
- **Stats bar** — total contributions, current streak, longest streak, most active day
- **Water system** — two-tone water overlays, ripple lines, river shimmer animations
- **Contribution statistics** — streak calculation, day-of-week analysis

[1.1.0]: https://github.com/t1seo/maeul-in-the-sky/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/t1seo/maeul-in-the-sky/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/t1seo/maeul-in-the-sky/releases/tag/v1.0.0
