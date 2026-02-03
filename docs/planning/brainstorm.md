# Cosmio - Brainstorm Document

> GitHub contribution 데이터를 우주 테마 애니메이션 SVG로 변환하는 오픈소스 도구
>
> **Product Name: Cosmio** (Cosmos + io)

## 1. 프로젝트 개요

### 목표
기존 GitHub 프로필 장식 도구들(snake, 3D contrib)과 차별화된, **예술적이고 고급스러운** contribution 시각화 도구를 만든다.

### 확정 사항

| 항목 | 결정 |
|------|------|
| 프로젝트명 | **Cosmio** |
| 테마 | 우주 (4가지 뷰) |
| 기술 스택 | TypeScript + Node.js |
| 출력 형식 | Animated SVG (다크/라이트 모드) |
| 자동화 | GitHub Action |
| 추가 요소 | 통계 오버레이, 커스텀 타이틀 |
| 테스트 유저 | `t1seo` |

---

## 2. 경쟁 분석

| 프로젝트 | 테마 | 한계 |
|----------|------|------|
| [Platane/snk](https://github.com/Platane/snk) | 뱀 게임 | 귀엽지만 고급스럽지 않음 |
| [3D Contrib](https://github.com/yoshi389111/github-profile-3d-contrib) | 3D 막대 그래프 | 데이터 시각화 느낌, 감성 부족 |
| [GitHub Skyline](https://github.com/github/gh-skyline) | 3D 도시 | 프로필 README 임베딩 불가 (STL) |
| [Space Shooter](https://www.producthunt.com/products/github-space-shooter) | 우주 슈팅 | 게임성 위주, 세련되지 않음 |
| [Pac-Man Contrib](https://github.com/abozanona/pacman-contribution-graph) | 팩맨 | 레트로, 고급스러움과 거리 |

**핵심 발견**: 우주 테마로 "고급스럽고 세련된" contribution view는 아직 없다. 블루오션.

---

## 3. 4가지 테마 상세

### Phase 1: Nebula Map (성운 맵)

contribution 강도를 **성운(nebula)의 밝기와 색상**으로 표현한다.

- 기여가 많은 날 = 밝고 뜨거운 별 (흰색/청색)
- 기여가 적은 날 = 어두운 성간 먼지
- 전체 그래프가 하나의 성운 이미지를 형성
- **애니메이션**: 성운이 천천히 숨 쉬듯 맥동 (simplex noise 기반)
- **차별점**: 기존 격자 형태를 완전히 탈피, 유기적 형태

### Phase 2: Constellation (별자리 지도)

52주 x 7일의 contribution 데이터를 **별자리 지도**로 변환한다.

- 기여가 있는 날 = 별 (밝기 = 기여 횟수)
- 기여가 없는 날 = 빈 하늘
- 연속 기여일을 선으로 연결하여 **자동 생성 별자리** 형성
- streak이 길수록 더 큰/복잡한 별자리 패턴
- **애니메이션**: 별들이 반짝이고, 별자리 선이 하나씩 그려짐
- **차별점**: contribution 패턴이 곧 별자리가 됨 (데이터 = 아트)

### Phase 3: Space Voyage (우주 여행)

연초부터 현재까지의 contribution을 **우주선의 항해 경로**로 표현한다.

- 기여가 있는 날 = 항해 구간 (밝은 궤적)
- 기여가 없는 날 = 정지/표류
- 경유하는 행성/소행성 = 주요 이정표 (100회, 500회, 1000회 contribution)
- 기여 streak = 워프 드라이브 구간 (빛줄기 효과)
- 최종 목적지까지의 진행률 표시
- **애니메이션**: 우주선이 경로를 따라 이동, 별들이 뒤로 흘러감
- **차별점**: 스토리텔링 + 진행률 표시. 동적인 재미

### Phase 4: Alien Defense (외계인 침공 디펜스)

contribution 그래프 격자를 **방어 그리드**로 활용한다.

- 기여가 있는 셀 = 방어 유닛/포탑 배치
- 기여가 없는 셀 = 빈 공간
- 외계인 함대가 위에서 내려오고, contribution 유닛들이 방어
- 기여가 많을수록 방어력 강함 = 더 많은 외계인 격추
- **애니메이션**: 슈팅 이펙트, 폭발, 외계인 이동
- **차별점**: 게임성과 시각적 재미 모두 충족

---

## 4. 공통 요구사항

### 다크/라이트 모드
- 각 테마별 다크/라이트 버전 SVG 생성
- GitHub `<picture>` 태그로 `prefers-color-scheme` 자동 대응

### 통계 오버레이
- 총 contribution 수
- 최장 streak
- 가장 활발한 요일
- 현재 연속 기여일

### 커스텀 타이틀
- username 또는 사용자 지정 텍스트
- 우주 테마에 맞는 세련된 폰트 스타일

---

## 5. 아키텍처

```
github-contribution/
├── src/
│   ├── api/              # GitHub GraphQL API 데이터 수집
│   │   ├── client.ts     # GraphQL 클라이언트
│   │   └── queries.ts    # contribution 쿼리
│   ├── core/             # 공통 SVG 렌더링 엔진
│   │   ├── svg.ts        # SVG 빌더
│   │   ├── animation.ts  # 애니메이션 유틸
│   │   └── theme.ts      # 테마 인터페이스
│   ├── themes/           # 4개 테마 각각의 렌더러
│   │   ├── nebula/       # Phase 1
│   │   ├── constellation/# Phase 2
│   │   ├── voyage/       # Phase 3
│   │   └── defense/      # Phase 4
│   ├── utils/            # 유틸리티
│   │   ├── noise.ts      # simplex noise
│   │   ├── color.ts      # 색상 처리
│   │   └── math.ts       # 수학 헬퍼
│   └── index.ts          # CLI 엔트리포인트
├── action.yml            # GitHub Action 정의
├── .github/
│   └── workflows/        # 사용자용 워크플로우 예시
├── package.json
├── tsconfig.json
└── docs/
    └── planning/
        └── brainstorm.md # 이 문서
```

---

## 6. 기술 참고 자료

### SVG 애니메이션 기법
- SVG `<animate>`, `<animateTransform>` 네이티브 애니메이션
- Simplex noise를 이용한 유기적 형태 변화
- CSS keyframe을 SVG에 인라인으로 포함

### 데이터 소스
- GitHub GraphQL API (`contributionsCollection`)
- 52주 x 7일 = 364개 데이터 포인트
- 각 셀: 날짜, contribution 횟수, 레벨(0-4)

### 참고 프로젝트
- [d3-celestial](https://github.com/ofrohn/d3-celestial) - 별자리 지도 렌더링
- [thenextweb/constellation](https://github.com/thenextweb/constellation) - 별자리 애니메이션
- [simplex-noise.js](https://github.com/jwagner/simplex-noise) - 노이즈 생성
- [Smashing Magazine - Magical SVG Techniques](https://www.smashingmagazine.com/2022/05/magical-svg-techniques/)

---

## 7. 차별화 포인트

1. **기존 도구 대비**: snake/3D contrib = "귀여움/실용적" → Cosmio = **"예술적/고급스러움"**
2. **멀티 테마**: 하나의 Action으로 4가지 스타일 선택 가능
3. **다크/라이트 자동 대응**: GitHub 테마 연동
4. **오픈소스 플러그인 구조**: 커뮤니티가 커스텀 테마 추가 가능

---

## 8. 구현 로드맵

| Phase | 내용 | 의존성 |
|-------|------|--------|
| 0 | 공통 인프라 (API, SVG 엔진, CLI) | - |
| 1 | Nebula Map 테마 | Phase 0 |
| 2 | Constellation 테마 | Phase 0 |
| 3 | Space Voyage 테마 | Phase 0 |
| 4 | Alien Defense 테마 | Phase 0 |
| 5 | GitHub Action 패키징 | Phase 0 + 최소 1개 테마 |
| 6 | README / 문서화 / 데모 | 전체 |
