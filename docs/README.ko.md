<div align="center">

# Maeul (마을)

**GitHub 기여 그래프를 애니메이션 아이소메트릭 지형으로 변환합니다**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-ready-2088FF?logo=githubactions&logoColor=white)](https://github.com/features/actions)
[![English](https://img.shields.io/badge/lang-English-blue)](../README.md)

<br/>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../.github/assets/preview-dark.gif">
  <source media="(prefers-color-scheme: light)" srcset="../.github/assets/preview-light.gif">
  <img alt="Maeul 지형 미리보기" src="../.github/assets/preview-dark.gif" width="840">
</picture>

*기여 그래프가 살아 있는 마을이 됩니다 — 계절 변화, 흐르는 강, 움직이는 구름과 함께.*

</div>

---

## Maeul이란?

Maeul(마을)은 GitHub 기여 히스토리를 애니메이션 아이소메트릭 지형 SVG로 변환합니다. 각 날의 기여 수준이 지형 블록이 됩니다 — 활동이 없으면 깊은 물, 최대 활동이면 높은 도시 건물. 4계절 순환과 48개의 계절 에셋, 바이옴 생성(강, 연못, 숲), 앰비언트 애니메이션을 포함합니다.

### 주요 기능

- **아이소메트릭 3D 지형** — 100단계 고도 시스템이 기여 데이터에 매핑
- **4계절 순환** — 겨울, 봄, 여름, 가을이 부드럽게 전환되며 48개의 계절 에셋 포함
- **바이옴 생성** — 시드 노이즈를 통한 절차적 강, 연못, 숲 클러스터 생성
- **118종 지형 에셋** — 나무, 건물, 풍차, 눈사람, 벚꽃 등
- **애니메이션 SVG** — 구름이 흘러가고, 물이 반짝이고, 깃발이 펄럭임 — 순수 SVG, JavaScript 없음
- **다크 & 라이트 모드** — 두 가지 변형을 생성하고 `<picture>` 태그로 자동 전환
- **반구 지원** — 북반구 또는 남반구 계절 매핑
- **GitHub Action** — 워크플로에 추가하면 매일 자동 업데이트
- **CLI** — 명령어 하나로 로컬 생성

---

## 빠른 시작

### GitHub Action (권장)

`.github/workflows/maeul.yml`에 워크플로를 추가하세요:

```yaml
name: Generate Maeul Terrain
on:
  schedule:
    - cron: '0 0 * * *'  # 매일
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

그 다음 프로필 README에 추가:

```markdown
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./maeul-terrain-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="./maeul-terrain-light.svg">
  <img alt="GitHub 기여 지형" src="./maeul-terrain-dark.svg" width="840">
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

---

## CLI 사용법

```bash
# 설치
npm install -g maeul

# 지형 SVG 생성
export GITHUB_TOKEN=ghp_your_token_here
maeul -u your-username

# 옵션 예시
maeul -u octocat --year 2025 --hemisphere south -o ./output
```

### CLI 옵션

```
-u, --user <username>       GitHub 사용자명 (필수)
-t, --theme <name>          테마 이름 (기본: terrain)
    --title <text>          커스텀 타이틀 텍스트
-o, --output <dir>          출력 디렉토리 (기본: ./)
-y, --year <number>         시각화할 연도
    --token <token>         GitHub PAT (또는 GITHUB_TOKEN 환경변수 설정)
    --hemisphere <value>    north 또는 south (기본: north)
```

---

## 개발

```bash
git clone https://github.com/t1seo/github-profile-maeul.git
cd github-profile-maeul
npm install
npm run build
npm test
```

### 스크립트

| 명령어 | 설명 |
|--------|------|
| `npm run build` | tsup으로 빌드 |
| `npm run dev` | 워치 모드 |
| `npm test` | vitest 실행 |
| `npm run lint` | ESLint 검사 |
| `npm run typecheck` | TypeScript 타입 체크 |

---

## 라이선스

[MIT](../LICENSE) &copy; [t1seo](https://github.com/t1seo)
