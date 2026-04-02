# Bifrost Design System — 토큰 & 스펙 레퍼런스

> 출처: `docs/reference_bifrost_design_system.md` (실 디자이너 검증)
> 이 파일은 조회용. 행동 규칙은 `designer.md` Critical Rules를 따른다.

---

## 1. 색상 토큰

### Gray Scale
| 토큰 | Hex |
|------|-----|
| gray-100 | #F7F7F7 |
| gray-200 | #EDEDED |
| gray-300 | #D9D9D9 |
| gray-400 | #B3B3B3 |
| gray-500 | #8C8C8C |
| gray-600 | #666666 |
| gray-700 | #4D4D4D |
| gray-800 | #333333 |
| gray-900 | #1A1A1A |

### Brand Scale (Pockie/Storybook 전용)
| 토큰 | Hex |
|------|-----|
| brand-100 | #F3F3FF |
| brand-200 | #D9D8F8 |
| brand-300 | #B3B1F1 |
| brand-400 | #8B89E0 |
| brand-500 | #6B69CC |
| brand-600 | #4D3D94 |
| brand-700 | #2E2D6A |
| brand-800 | #1B1B3C |
| **brand-point** | **#5F5BE2** |

### Semantic Colors
| 카테고리 | 700 (기준색) | 용도 |
|----------|------------|------|
| negative | #EC2D30 | 에러·삭제·위험 |
| warning  | #FE9B0E | 경고 |
| positive | #0C9D61 | 성공·확인 |
| message  | #3A70E2 | 정보·알림 |

### 서비스별 Primary 컬러
| 서비스 | Primary |
|--------|---------|
| Bifrost Network / Biquid | #FF474C |
| BTCFi Boost | #3467F4 |
| Pockie (Storybook) | #5F5BE2 |

---

## 2. 타이포그래피 토큰

| 레벨 | Tailwind 클래스 | 크기 | line-height |
|------|----------------|------|-------------|
| H1 | .text-h1 | 48px | 1.17 |
| H2 | .text-h2 | 40px | 1.2 |
| H3 | .text-h3 | 32px | 1.25 |
| H4 | .text-h4 | 24px | 1.33 |
| Subtitle | .text-subtitle | 20px | 1.4 |
| Body | .text-body | 16px | 1.5 |
| Body Small | .text-bodySm | 14px | 1.43 |
| Caption | .text-caption | 12px | 1.33 |

Font Weight: Light 300 / Regular 400 / Medium 500 / Bold 700 / Black 900

---

## 3. 다크 모드 배경

### 레이어 시스템 (biquid.io 기준)
| 레이어 | Hex | 위치 |
|--------|-----|------|
| Level 0 | #000000 | 페이지 배경 |
| Level 1 | #080808 | Header |
| Level 2 | #1E1E1E | 카드 배경 |
| Level 3 | #303030 | Input·서브카드 |
| Level 4 | #3D3D3D | 툴팁 |

### 색온도 (Brand 컬러 기준)
- 레드 계열 → 무채색 (#000, #1A1A1A)
- 블루 계열 → 네이비 틴트 (#1C2130)

---

## 4. 라이트/다크 테마 토큰

| 불변 | 가변 |
|------|------|
| Primary 컬러 | 배경·카드 배경 |
| Semantic 컬러 | 주요 텍스트 |
| border-radius | border 색상·shadow 강도 |
| 컴포넌트 구조 | — |

---

## 5. Border Radius 상세

| 맥락 | 값 |
|------|-----|
| 공식 사이트 | 4px 통일 |
| DApp CTA / 메인 액션 | 32~9999px (pill) |
| DApp 헤더 버튼 | 16px |
| DApp 카드 | 16~24px |
| DApp 카드 내부 / Input | 8~16px |
| DApp 소형 버튼 | 8px |

---

## 6. 유채색 예외 허용 범위

UI 컴포넌트 외 장식적 유채색 허용:
- 3D 비주얼·히어로 섹션 메인 그래픽
- 마케팅 배너

---

## 7. 페이지 레이아웃 아키타입

### A: 랜딩 페이지
```
[반투명 Header + backdrop-blur]
[풀스크린 히어로: 비주얼 + 대형 타이틀(900) + CTA pill]
[마퀴 / 파트너 로고 (기획자 결정 — 필수 아님)]
[100vh 섹션 반복]
[Footer: 멀티 컬럼 링크 + 소셜]
```
> **히어로 3D/비디오 비주얼**: 필수 아님. 서비스 특성과 UX 목적에 따라 결정. 모든 서비스에 3D가 필요하지 않음.

### B: 태스크 페이지 (DApp 핵심)
```
[Header + 지갑 연결 버튼]
[싱글 컬럼 중앙, max-width ~672px]
[메인 카드 1개]
  ├─ 탭 (모드 전환)
  ├─ Sub-card: Input + Max 버튼 + 잔액
  ├─ 정보 행 (key-value)
  └─ CTA (pill, full-width)
```

### C: 대시보드
```
[사이드바 네비게이션]
[KPI 카드 그리드 (Bento UI 가능)]
[차트 / 테이블·리스트]
```

### D: 정보 페이지
```
[텍스트 중심, 섹션 gap 80-160px]
[pill 링크 / 외부 링크]
```

### E: 유틸리티 페이지
```
[싱글 컬럼, max-width 480px]
[폼 카드 1개: Input + 버튼]
```

---

## 8. 네비게이션 패턴

| 플랫폼 | 전략 |
|--------|------|
| 모바일 탭바 | 5개 이하 → 나머지는 더보기 |
| 모바일 전체 | 햄버거 → 전체화면 오버레이 |
| 웹 LNB | 카테고리 그룹핑 (접기/펼치기) |
| 웹 Header | 2depth (메인 + 서브) |
| 20~30+ 메뉴 | 검색으로 대체 |

---

## 9. 컴포넌트 라이브러리

**npm 패키지**: `@bifrost-platform/ui-kit-front`
**Storybook**: https://storybook.thebifrost.dev
**로컬 소스**: `/Users/hangheejo/git/ui-kit-front/src/components/`

### 컴포넌트 목록
Button, Input, Toggle, Tabs, Checkbox, Radio, Tooltip, Popover, Skeleton, Spinner, Slider, Pagination, Snackbar, Divider, Label, Profile, SegmentSlider, TabBar, Badge, Toast, Assets, Icon

### 패키지 구조
```typescript
// 컴포넌트
import { Button, Input, ... } from '@bifrost-platform/ui-kit-front';

// CSS (프로젝트 entry에서 1회)
import '@bifrost-platform/ui-kit-front/index.css';

// Tailwind 설정 (tailwind.config.ts)
import { createTailwindConfig } from '@bifrost-platform/ui-kit-front/config';
export default createTailwindConfig({ content: ['./src/**/*.{ts,tsx}'] });

// 디자인 토큰 (TypeScript)
import { colors, fontSize, fontWeight, theme } from '@bifrost-platform/ui-kit-front/types';
```

### 디자인 토큰 위치
`theme.ts`에 색상·타이포그래피·폰트웨이트 전체가 정의되어 있음.
컴포넌트 스펙 확인 시 로컬 소스를 직접 읽을 것. 정적 스펙 복사본보다 소스가 항상 최신.

---

## 10. 컴포넌트 Transition 기준

- 색상 변화: `transition-colors` 150~200ms
- 크기·위치 변화: `transition-all` 200~300ms
- Easing: Tailwind 기본 `cubic-bezier(0.4, 0, 0.2, 1)`

---

## 11. 정보 밀도

- **기본**: 넉넉한 여백 (가독성 우선)
- **데이터 집약 UI**: Compact 허용 — Spacing Primitive 한 단계 아래 값 사용
- 빈 상태: 텍스트만 (일러스트·CTA 없음)
