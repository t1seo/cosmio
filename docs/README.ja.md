<div align="center">

# Maeul in the Sky (天空の村)

**GitHubコントリビューショングラフをアニメーション付きアイソメトリック地形に変換**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-ready-2088FF?logo=githubactions&logoColor=white)](https://github.com/features/actions)
[![English](https://img.shields.io/badge/lang-English-blue)](../README.md)
[![한국어](https://img.shields.io/badge/lang-%ED%95%9C%EA%B5%AD%EC%96%B4-blue)](./README.ko.md)
[![中文](https://img.shields.io/badge/lang-%E4%B8%AD%E6%96%87-blue)](./README.zh.md)

<br/>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../.github/assets/preview-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="../.github/assets/preview-light.svg">
  <img alt="Maeul in the Sky 地形プレビュー" src="../.github/assets/preview-dark.svg" width="840">
</picture>

*コントリビューショングラフが生きた村になります — 季節の変化、流れる川、動く雲とともに。*

</div>

## Maeul in the Skyとは？

Maeul in the Sky（天空の村）は、GitHubのコントリビューション履歴をアニメーション付きアイソメトリック地形SVGに変換します。*Maeul*（마을）は韓国語で「村」を意味します — コントリビューショングラフが空に浮かぶ生きた村になります。各日のコントリビューションレベルが地形ブロックになります — 活動なしは深い水、最大活動は高層ビル。4つの季節サイクルと48のシーズンアセット、バイオーム生成（川、池、森）、アンビエントアニメーションを含みます。

### 主な機能

- **アイソメトリック3D地形** — 100段階の高度システムがコントリビューションデータにマッピング
- **4つの季節サイクル** — 冬、春、夏、秋がスムーズに遷移し48のシーズンアセットを含む
- **バイオーム生成** — シードノイズによる手続き的な川、池、森クラスター生成
- **118種の地形アセット** — 木、建物、風車、雪だるま、桜など
- **アニメーションSVG** — 雲が流れ、水が輝き、旗がはためく — 純粋なSVG、JavaScriptなし
- **ダーク＆ライトモード** — 2つのバリアントを生成し`<picture>`タグで自動切替
- **半球サポート** — 北半球または南半球の季節マッピング
- **GitHub Action** — ワークフローに追加するだけで毎日自動更新

## クイックスタート

### GitHub Action（推奨）

`.github/workflows/maeul-sky.yml`にワークフローを追加：

```yaml
name: Generate Maeul in the Sky Terrain
on:
  schedule:
    - cron: '0 0 * * *'  # 毎日
  workflow_dispatch:

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

プロフィールREADMEに追加：

```markdown
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./maeul-in-the-sky-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="./maeul-in-the-sky-light.svg">
  <img alt="GitHubコントリビューション地形" src="./maeul-in-the-sky-dark.svg" width="840">
</picture>
```

### Action入力値

| 入力 | 説明 | デフォルト |
|------|------|------------|
| `github_token` | API接続用GitHubトークン | `${{ github.token }}` |
| `theme` | テーマ名 | `terrain` |
| `title` | カスタムタイトルテキスト | GitHubユーザー名 |
| `output_dir` | 出力ディレクトリ | `./` |
| `year` | 対象年 | 現在の年 |
| `hemisphere` | 季節マッピング（`north`または`south`） | `north` |

### カスタマイズ例

```yaml
# 南半球（オーストラリア、ブラジルなど）
- uses: t1seo/maeul-in-the-sky@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    hemisphere: south

# カスタムタイトル
- uses: t1seo/maeul-in-the-sky@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    title: "My Coding Journey"

# 特定の年
- uses: t1seo/maeul-in-the-sky@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    year: 2025
```

## 地形はどのように作られますか？

GitHubコントリビューショングラフの各マスが1つの地形ブロックになります。その日のコミットが多いほど、より発展した地形が生まれます。

| 活動量 | 地形 | 説明 |
|:---:|:---:|:---|
| コミットなし | 🌊 海 | 海タイル — 空の海 |
| 少量コミット | 🏖️ 砂＆草原 | 平らな土地が現れる |
| 通常コミット | 🌲 森 | 木と植物が育つ |
| 平均以上 | 🌾 農場 | 畑、納屋、風車 |
| 活発な日 | 🏘️ 村 | 家と小さな建物 |
| 最高活動 | 🏙️ 都市 | 高い建物とタワー |

> **絶対値ではなく、自分基準の相対値です。** 普段1日2〜3回コミットする人なら、3回のコミットだけで村や都市レベルに到達します。1日20回コミットする人は約20回必要です。地形は*あなた自身のリズム*を反映します。

**地形を決める2つの要素：**

- **毎日コミットする** → 海が減り、マップ全体に陸地が現れる
- **1日に多くコミットする** → その日の土地が草原から森、建物にアップグレード

毎日コーディングする人は村が並ぶ緑豊かな島になります。数日に集中的にコーディングする人は海から高くそびえる都市が点在します。

## ライセンス

[MIT](../LICENSE) &copy; [t1seo](https://github.com/t1seo)
