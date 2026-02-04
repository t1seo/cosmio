<div align="center">

# Maeul in the Sky (천공의 마을)

**GitHub 기여 그래프를 애니메이션 아이소메트릭 지형으로 변환합니다**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-ready-2088FF?logo=githubactions&logoColor=white)](https://github.com/features/actions)
[![English](https://img.shields.io/badge/lang-English-blue)](../README.md)
[![日本語](https://img.shields.io/badge/lang-%E6%97%A5%E6%9C%AC%E8%AA%9E-blue)](./README.ja.md)
[![中文](https://img.shields.io/badge/lang-%E4%B8%AD%E6%96%87-blue)](./README.zh.md)

<br/>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../.github/assets/preview-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="../.github/assets/preview-light.svg">
  <img alt="Maeul in the Sky 지형 미리보기" src="../.github/assets/preview-dark.svg" width="840">
</picture>

*기여 그래프가 살아 있는 마을이 됩니다 — 계절 변화, 흐르는 강, 움직이는 구름과 함께.*

</div>

## Maeul in the Sky란?

Maeul in the Sky(천공의 마을)는 GitHub 기여 히스토리를 애니메이션 아이소메트릭 지형 SVG로 변환합니다. *Maeul*(마을)은 한국어로 "village"를 뜻합니다 — 기여 그래프가 하늘 위에 떠 있는 살아 있는 마을이 됩니다. 각 날의 기여 수준이 지형 블록이 됩니다 — 활동이 없으면 깊은 물, 최대 활동이면 높은 도시 건물. 4계절 순환과 48개의 계절 에셋, 바이옴 생성(강, 연못, 숲), 앰비언트 애니메이션을 포함합니다.

### 주요 기능

- **아이소메트릭 3D 지형** — 100단계 고도 시스템이 기여 데이터에 매핑
- **4계절 순환** — 겨울, 봄, 여름, 가을이 부드럽게 전환되며 48개의 계절 에셋 포함
- **바이옴 생성** — 시드 노이즈를 통한 절차적 강, 연못, 숲 클러스터 생성
- **118종 지형 에셋** — 나무, 건물, 풍차, 눈사람, 벚꽃 등
- **애니메이션 SVG** — 구름이 흘러가고, 물이 반짝이고, 깃발이 펄럭임 — 순수 SVG, JavaScript 없음
- **다크 & 라이트 모드** — 두 가지 변형을 생성하고 `<picture>` 태그로 자동 전환
- **반구 지원** — 북반구 또는 남반구 계절 매핑
- **GitHub Action** — 워크플로에 추가하면 매일 자동 업데이트

## 빠른 시작

### GitHub Action (권장)

`.github/workflows/maeul-sky.yml`에 워크플로를 추가하세요:

```yaml
name: Generate Maeul in the Sky Terrain
on:
  schedule:
    - cron: '0 0 * * *'  # 매일
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

그 다음 프로필 README에 추가:

```markdown
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./maeul-in-the-sky-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="./maeul-in-the-sky-light.svg">
  <img alt="GitHub 기여 지형" src="./maeul-in-the-sky-dark.svg" width="100%">
</picture>
```

### Action 입력값

| 입력 | 설명 | 기본값 |
|------|------|--------|
| `github_token` | API 접근용 GitHub 토큰 | `${{ github.token }}` |
| `theme` | 테마 이름 | `terrain` |
| `title` | 커스텀 타이틀 텍스트 | GitHub 사용자명 |
| `output_dir` | 출력 디렉토리 | `./` |
| `year` | 대상 연도 | 현재 연도 |
| `hemisphere` | 계절 매핑 (`north` 또는 `south`) | `north` |

### 커스텀 예시

```yaml
# 남반구 (호주, 브라질 등)
- uses: t1seo/maeul-in-the-sky@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    hemisphere: south

# 커스텀 타이틀
- uses: t1seo/maeul-in-the-sky@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    title: "My Coding Journey"

# 특정 연도
- uses: t1seo/maeul-in-the-sky@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    year: 2025
```

## 지형은 어떻게 만들어지나요?

GitHub 기여 그래프의 각 칸이 하나의 지형 블록이 됩니다. 그날 커밋을 많이 할수록 더 발전된 지형이 생깁니다.

| 활동량 | 지형 | 설명 |
|:---:|:---:|:---|
| 커밋 없음 | 🌊 바다 | 바다 타일 — 빈 바다 |
| 소량 커밋 | 🏖️ 모래 & 풀밭 | 평평한 땅이 나타남 |
| 보통 커밋 | 🌲 숲 | 나무와 초목이 자라남 |
| 평균 이상 | 🌾 농장 | 밭, 헛간, 풍차 |
| 활발한 날 | 🏘️ 마을 | 집과 작은 건물 |
| 최고 활동 | 🏙️ 도시 | 높은 건물과 타워 |

> **절대적인 수치가 아니라 본인 기준 상대값입니다.** 평소 하루에 2~3번 커밋하는 사람이라면 3번 커밋만으로도 마을이나 도시 레벨에 도달합니다. 하루 20번 커밋하는 사람은 ~20번 정도 커밋해야 같은 레벨이 됩니다. 지형은 *나만의 리듬*을 반영합니다.

**지형을 결정하는 두 가지:**

- **매일 커밋하기** → 바다가 줄어들고 지도 전체에 땅이 나타남
- **하루에 많이 커밋하기** → 그날의 땅이 풀밭에서 숲, 건물로 업그레이드

매일 꾸준히 코딩하는 사람은 마을이 가득한 울창한 섬이 만들어집니다. 며칠에 몰아서 집중적으로 코딩하는 사람은 바다 위로 우뚝 솟은 도시들이 듬성듬성 나타납니다.

## 라이선스

[MIT](../LICENSE) &copy; [t1seo](https://github.com/t1seo)
