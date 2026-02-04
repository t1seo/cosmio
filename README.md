<div align="center">

# Maeul

**Transform your GitHub contributions into an animated isometric terrain**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-ready-2088FF?logo=githubactions&logoColor=white)](https://github.com/features/actions)
[![한국어](https://img.shields.io/badge/lang-%ED%95%9C%EA%B5%AD%EC%96%B4-blue)](./docs/README.ko.md)

<br/>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/assets/preview-dark.gif">
  <source media="(prefers-color-scheme: light)" srcset=".github/assets/preview-light.gif">
  <img alt="Maeul terrain preview" src=".github/assets/preview-dark.gif" width="840">
</picture>

*Your contribution graph as a living village — with seasonal weather, flowing rivers, and animated clouds.*

</div>

---

## What is Maeul?

Maeul (마을, Korean for "village") turns your GitHub contribution history into an animated isometric terrain SVG. Each day's contribution level becomes a terrain block — from deep water (no activity) to towering city buildings (peak activity). The terrain transitions through four seasons with 48 unique seasonal assets, biome generation (rivers, ponds, forests), and ambient animations.

### Highlights

- **Isometric 3D terrain** — 100-level elevation system mapped to your contribution data
- **4-season cycle** — Winter, Spring, Summer, Autumn with smooth transitions and 48 seasonal assets
- **Biome generation** — Procedural rivers, ponds, and forest clusters via seeded noise
- **118 terrain asset types** — Trees, buildings, windmills, snowmen, cherry blossoms, and more
- **Animated SVG** — Clouds drift, water shimmers, flags wave — pure SVG, no JavaScript
- **Dark & Light mode** — Generates both variants; auto-switches via `<picture>` tag
- **Hemisphere support** — Northern or Southern hemisphere seasonal mapping
- **GitHub Action** — Drop into any workflow for automated daily updates
- **CLI** — Generate locally with a single command

<details>
<summary><strong>More previews</strong></summary>

| Sparse (Archipelago) | Maximum Density (Civilization) |
|:---:|:---:|
| ![](.github/assets/preview-sparse.gif) | ![](.github/assets/preview-max.gif) |

</details>

---

## Quick Start

### GitHub Action (recommended)

Add this workflow to `.github/workflows/maeul.yml`:

```yaml
name: Generate Maeul Terrain
on:
  schedule:
    - cron: '0 0 * * *'  # daily
  workflow_dispatch:

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: t1seo/github-profile-maeul@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}

      - uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: 'chore: update maeul terrain'
```

Then add this to your profile README:

```markdown
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./maeul-terrain-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="./maeul-terrain-light.svg">
  <img alt="GitHub contribution terrain" src="./maeul-terrain-dark.svg" width="840">
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

---

## CLI Usage

```bash
# Install
npm install -g maeul

# Generate terrain SVGs
export GITHUB_TOKEN=ghp_your_token_here
maeul -u your-username

# Options
maeul -u octocat --year 2025 --hemisphere south -o ./output
```

### CLI Options

```
-u, --user <username>       GitHub username (required)
-t, --theme <name>          Theme name (default: terrain)
    --title <text>          Custom title text
-o, --output <dir>          Output directory (default: ./)
-y, --year <number>         Year to visualize
    --token <token>         GitHub PAT (or set GITHUB_TOKEN env)
    --hemisphere <value>    north or south (default: north)
```

---

## Development

```bash
git clone https://github.com/t1seo/github-profile-maeul.git
cd github-profile-maeul
npm install
npm run build
npm test
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Build with tsup |
| `npm run dev` | Watch mode |
| `npm test` | Run vitest |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |

---

## License

[MIT](LICENSE) &copy; [t1seo](https://github.com/t1seo)
