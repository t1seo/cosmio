<div align="center">

# Maeul in the Sky (天空之村)

**将你的 GitHub 贡献图转换为动画等距地形**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-ready-2088FF?logo=githubactions&logoColor=white)](https://github.com/features/actions)
[![English](https://img.shields.io/badge/lang-English-blue)](../README.md)
[![한국어](https://img.shields.io/badge/lang-%ED%95%9C%EA%B5%AD%EC%96%B4-blue)](./README.ko.md)
[![日本語](https://img.shields.io/badge/lang-%E6%97%A5%E6%9C%AC%E8%AA%9E-blue)](./README.ja.md)

<br/>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../.github/assets/preview-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="../.github/assets/preview-light.svg">
  <img alt="Maeul in the Sky 地形预览" src="../.github/assets/preview-dark.svg" width="840">
</picture>

*你的贡献图变成一个活的村庄 — 有四季变化、流淌的河流和飘动的云朵。*

</div>

## 什么是 Maeul in the Sky？

Maeul in the Sky（天空之村）将你的 GitHub 贡献历史转换为动画等距地形 SVG。*Maeul*（마을）在韩语中意为"村庄" — 你的贡献图变成一个漂浮在天空中的活村庄。每天的贡献等级变成一个地形方块 — 没有活动是深水，最大活动是高楼大厦。包含四季循环、48 个季节资产、生态群落生成（河流、池塘、森林）和环境动画。

### 主要功能

- **等距 3D 地形** — 100 级高度系统映射到贡献数据
- **四季循环** — 冬、春、夏、秋平滑过渡，包含 48 个季节资产
- **生态群落生成** — 通过种子噪声程序化生成河流、池塘、森林集群
- **118 种地形资产** — 树木、建筑、风车、雪人、樱花等
- **动画 SVG** — 云朵飘动、水面闪烁、旗帜飘扬 — 纯 SVG，无 JavaScript
- **深色和浅色模式** — 生成两种变体，通过 `<picture>` 标签自动切换
- **半球支持** — 北半球或南半球季节映射
- **GitHub Action** — 添加到工作流即可每日自动更新

## 快速开始

### GitHub Action（推荐）

在 `.github/workflows/maeul-sky.yml` 中添加工作流：

```yaml
name: Generate Maeul in the Sky Terrain
on:
  schedule:
    - cron: '0 0 * * *'  # 每天
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

然后添加到你的个人主页 README：

```markdown
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./maeul-in-the-sky-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="./maeul-in-the-sky-light.svg">
  <img alt="GitHub 贡献地形" src="./maeul-in-the-sky-dark.svg" width="100%">
</picture>
```

### Action 输入参数

| 输入 | 说明 | 默认值 |
|------|------|--------|
| `github_token` | API 访问用 GitHub 令牌 | `${{ github.token }}` |
| `theme` | 主题名称 | `terrain` |
| `title` | 自定义标题文字 | GitHub 用户名 |
| `output_dir` | 输出目录 | `./` |
| `year` | 目标年份 | 当前年份 |
| `hemisphere` | 季节映射（`north` 或 `south`） | `north` |

### 自定义示例

```yaml
# 南半球（澳大利亚、巴西等）
- uses: t1seo/maeul-in-the-sky@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    hemisphere: south

# 自定义标题
- uses: t1seo/maeul-in-the-sky@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    title: "My Coding Journey"

# 特定年份
- uses: t1seo/maeul-in-the-sky@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    year: 2025
```

## 地形是如何生成的？

GitHub 贡献图的每个格子变成一个地形方块。当天提交越多，地形就越发达。

| 活动量 | 地形 | 说明 |
|:---:|:---:|:---|
| 无提交 | 🌊 海洋 | 海洋方块 — 空旷的海 |
| 少量提交 | 🏖️ 沙地和草地 | 平坦的陆地出现 |
| 正常提交 | 🌲 森林 | 树木和植被生长 |
| 高于平均 | 🌾 农场 | 田野、谷仓、风车 |
| 活跃日 | 🏘️ 村庄 | 房屋和小建筑 |
| 最高活动 | 🏙️ 城市 | 高楼大厦和塔楼 |

> **不是绝对数值，而是相对于你自己的基准。** 如果你平时每天提交 2-3 次，那么 3 次提交就能达到村庄或城市级别。每天提交 20 次的人需要约 20 次才能达到同样的级别。地形反映的是*你自己的节奏*。

**决定地形的两个因素：**

- **每天提交** → 海洋减少，整个地图上出现更多陆地
- **单日多次提交** → 当天的土地从草地升级为森林再到建筑

每天坚持编程的人会拥有一个绿意盎然、村庄密布的岛屿。集中在几天高强度编程的人会看到海面上矗立着零星但高耸的城市。

## 许可证

[MIT](../LICENSE) &copy; [t1seo](https://github.com/t1seo)
