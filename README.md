<div align="center">

# Maeul in the Sky

**Transform your GitHub contributions into an animated isometric terrain**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-ready-2088FF?logo=githubactions&logoColor=white)](https://github.com/features/actions)
[![한국어](https://img.shields.io/badge/lang-%ED%95%9C%EA%B5%AD%EC%96%B4-blue)](./docs/README.ko.md)
[![日本語](https://img.shields.io/badge/lang-%E6%97%A5%E6%9C%AC%E8%AA%9E-blue)](./docs/README.ja.md)
[![中文](https://img.shields.io/badge/lang-%E4%B8%AD%E6%96%87-blue)](./docs/README.zh.md)

<br/>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/assets/preview-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset=".github/assets/preview-light.svg">
  <img alt="Maeul in the Sky terrain preview" src=".github/assets/preview-dark.svg" width="840">
</picture>

*Your contribution graph as a living village — with seasonal weather, flowing rivers, and animated clouds.*

</div>

## What is Maeul in the Sky?

Maeul in the Sky (천공의 마을) turns your GitHub contribution history into an animated isometric terrain SVG. *Maeul* (마을) is Korean for "village" — your contribution graph becomes a living village floating in the sky. Each day's contribution level becomes a terrain block — from deep water (no activity) to towering city buildings (peak activity). The terrain transitions through four seasons with 48 unique seasonal assets, biome generation (rivers, ponds, forests), and ambient animations.

### Highlights

- **Isometric 3D terrain** — 100-level elevation system mapped to your contribution data
- **4-season cycle** — Winter, Spring, Summer, Autumn with smooth transitions and 48 seasonal assets
- **Biome generation** — Procedural rivers, ponds, and forest clusters via seeded noise
- **118 terrain asset types** — Trees, buildings, windmills, snowmen, cherry blossoms, and more
- **Animated SVG** — Clouds drift, water shimmers, flags wave — pure SVG, no JavaScript
- **Dark & Light mode** — Generates both variants; auto-switches via `<picture>` tag
- **Hemisphere support** — Northern or Southern hemisphere seasonal mapping
- **GitHub Action** — Drop into any workflow for automated daily updates

### More Previews

| Sparse (Archipelago) | Maximum Density (Civilization) |
|:---:|:---:|
| ![](.github/assets/preview-sparse.svg) | ![](.github/assets/preview-max.svg) |

## Quick Start

### GitHub Action (recommended)

Add this workflow to `.github/workflows/maeul-sky.yml`:

```yaml
name: Generate Maeul in the Sky Terrain
on:
  schedule:
    - cron: '0 0 * * *'  # daily
  workflow_dispatch:

permissions:
  contents: write

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: t1seo/maeul-in-the-sky@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}

      - uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: 'chore: update maeul-in-the-sky terrain'
```

Then add this to your profile README:

```markdown
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./maeul-in-the-sky-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="./maeul-in-the-sky-light.svg">
  <img alt="GitHub contribution terrain" src="./maeul-in-the-sky-dark.svg" width="100%">
</picture>
```

### Action Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `github_token` | GitHub token for API access | `${{ github.token }}` |
| `theme` | Theme name | `terrain` |
| `title` | Custom title text | GitHub username |
| `output_dir` | Output directory | `./` |
| `year` | Target year | Current year |
| `hemisphere` | Seasonal mapping (`north` or `south`) | `north` |

### Customization Examples

```yaml
# Southern hemisphere (Australia, Brazil, etc.)
- uses: t1seo/maeul-in-the-sky@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    hemisphere: south

# Custom title
- uses: t1seo/maeul-in-the-sky@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    title: "My Coding Journey"

# Specific year
- uses: t1seo/maeul-in-the-sky@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    year: 2025
```

## How Does the Terrain Work?

Each square on your GitHub contribution graph becomes a terrain block. The more you contribute on a given day, the more developed that block becomes.

| Your activity | Terrain | What you'll see |
|:---:|:---:|:---|
| No commits | 🌊 Water | Ocean tiles — the empty sea |
| A few commits | 🏖️ Sand & Grass | Flat land begins to form |
| Regular commits | 🌲 Forest | Trees and vegetation grow |
| Above average | 🌾 Farmland | Fields, barns, windmills |
| Very active day | 🏘️ Village | Houses and small buildings |
| Peak activity | 🏙️ City | Tall buildings and towers |

> **It's relative to you, not absolute.** If you usually commit 2-3 times a day, then a 3-commit day already reaches village or city level. Someone who commits 20 times a day would need ~20 to reach the same level. The terrain reflects *your* personal rhythm.

**Two things shape your terrain:**

- **Commit every day** → Less ocean, more land appears across the map
- **Commit more on a given day** → That day's land upgrades from grass to forest to buildings

A consistent contributor who codes daily will have a lush island full of villages. A burst contributor who codes intensely a few days a week will have scattered but tall cities rising from the sea.

## License

[MIT](LICENSE) &copy; [t1seo](https://github.com/t1seo)
