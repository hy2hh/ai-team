# Toss Design Guide

> 📋 실행 플레이북 — 토스 스타일 재현을 위한 디자인 원칙 가이드
> 수집 기준: 2026-04-07 | 출처: toss.im CSS 직접 추출, TDS Mobile 공식 문서(tossmini-docs.toss.im), toss.tech 블로그

이 문서는 Krusty(Designer) 에이전트가 Toss 스타일 UI를 생성할 때 참고하는 기준 문서입니다.
ai-team 내부 대시보드, 칸반, 메모리 뷰어 등 내부 툴에 기본 적용됩니다.

---

## ✅ Do / ❌ Don't

### 색상

| ✅ Do | ❌ Don't |
|-------|---------|
| grey100(`#f2f4f6`)으로 섹션 배경 구분 | 장식 목적으로 유채색 사용 |
| CTA에 blue500(`#3182f6`) 단독 사용 | 그라디언트 배경 사용 |
| 수익은 red500(`#f04452`), 손실은 blue500 | 서구 관례(초록=수익) 적용 |
| 시맨틱 토큰(`fill.brand.default`)으로 참조 | 하드코딩 hex값 직접 사용 |
| 다크모드에서 배경 명도 차이로 레이어 구분 | 다크모드에서 shadow로 레이어 구분 |

### 타이포그래피

| ✅ Do | ❌ Don't |
|-------|---------|
| Pretendard 단일 사용 | 여러 서체 혼용 |
| size + weight 함께 위계 표현 | size만으로 또는 weight만으로 위계 표현 |
| 금액 표시에 Monospaced 숫자 | 금액에 proportional 숫자 혼용 |
| 한국어 본문 line-height 1.6 | 1.4 이하로 타이트하게 설정 |

### 레이아웃

| ✅ Do | ❌ Don't |
|-------|---------|
| 한 화면 한 목적 | 한 화면에 여러 목적 혼재 |
| 여백 의도적으로 넓게 (20px 기준) | 정보를 빽빽하게 압축 |
| Bottom Sheet로 선택지 제공 | 드롭다운 또는 별도 페이지로 선택지 제공 |
| 단일 컬럼 레이아웃 우선 | 3컬럼 이상 그리드 사용 |
| Skeleton UI로 로딩 표현 | Spinner 위주로 로딩 표현 |

### 컴포넌트

| ✅ Do | ❌ Don't |
|-------|---------|
| border 1px solid + 약한 무채색 | 2px 이상 굵은 border |
| 빈 상태에 최소 텍스트만 | 빈 상태에 일러스트 + CTA 배치 |
| 버튼 탭 시 `scale(0.97)` 즉각 피드백 | 탭 후 delay 있는 피드백 |
| Bottom Sheet top border-radius: 20px | 모달 사용 (Bottom Sheet 대신) |

---

## 1. 색상 팔레트 (Color System)

### Primitive Colors — Grey Scale (toss.im CSS 직접 추출 ✅)

| 토큰명 | Hex | 주요 용도 |
|--------|-----|---------|
| grey50 | `#f9fafb` | 최연한 배경, hover 오버레이 |
| grey100 | `#f2f4f6` | 섹션 배경, fill.neutral.weak |
| grey200 | `#e5e8eb` | border.default, divider |
| grey300 | `#d1d6db` | border.strong, 비활성 UI |
| grey400 | `#b0b8c1` | text.disabled |
| grey500 | `#8b95a1` | text.tertiary |
| grey600 | `#6b7684` | text.secondary |
| grey700 | `#4e5968` | text.secondary (강조) |
| grey800 | `#333d4b` | text.primary (보조) |
| grey900 | `#191f28` | text.primary (최고 대비) |

### Primitive Colors — 주요 유채색 (toss.im CSS 직접 추출 ✅)

| 토큰명 | Hex | 용도 |
|--------|-----|------|
| blue500 | `#3182f6` | Primary CTA (앱 UI 실 사용값) |
| blue600 | `#1b64da` | Primary hover 상태 |
| red500 | `#f04452` | 수익/상승 (한국 금융 관례) / Error |
| green500 | `#03b26c` | Success (비금융 맥락) |
| yellow500 | `#ffc342` | Warning |
| orange500 | `#fe9800` | 알림 배지 |
| purple500 | `#a234c7` | 기타 강조 |

> ⚠️ 브랜드 공식 컬러 `#0064FF` (brand.toss.im)와 앱 실 사용 `#3182f6` 차이 존재.
> 웹 구현 시 `#3182f6` 사용, 브랜드 마케팅 소재는 `#0064FF` 사용.

### 시맨틱 컬러 토큰

```
fill.brand.default      → #3182f6 (Primary CTA)
fill.brand.weak         → blue100 계열 (배경, 선택 상태)
fill.neutral.default    → #ffffff (기본 흰색 배경)
fill.neutral.weak       → #f2f4f6 (섹션 구분 배경)

text.primary            → #191f28 (최고 대비, 제목·본문)
text.secondary          → #6b7684 (보조 정보)
text.tertiary           → #8b95a1 (힌트, 중요도 낮음)
text.disabled           → #b0b8c1 (비활성 UI)
text.brand              → #3182f6 (링크, 강조)
text.danger             → #f04452 (오류, 수익)

border.default          → #e5e8eb (기본 구분선)
border.strong           → #d1d6db (강조 구분선)
```

### 시맨틱 상태 컬러 (한국 금융 관례)

| 상태 | 컬러 | Hex |
|------|------|-----|
| 수익/상승 | 빨강 | `#f04452` |
| 손실/하락 | 파랑 | `#3182f6` |
| Warning | 주황 | `#fe9800` |
| Error (비금융) | 빨강 | `#f04452` |
| Success (비금융) | 그린 | `#03b26c` |

---

## 2. 타이포그래피 (Typography)

### 기본 서체

**Toss Product Sans** — 토스 자체 개발 서체 (7 weight)
**대체 폰트**: `Pretendard` (오픈소스, ai-team 구현 권장)

### 폰트 사이즈 계층 (수치 기반)

| 단계 | Size | Weight | Line-height | 용도 |
|------|------|--------|-------------|------|
| Display | 32px | 700 | 1.2 (120%) | 총자산, 히어로 금액 |
| Headline | 24px | 600 | 1.3 (130%) | 페이지 제목 |
| Title | 20px | 600 | 1.3 (130%) | 섹션 제목 |
| Body Large | 18px | 500 | 1.5 (150%) | 주요 본문, 강조 정보 |
| Body | 16px | 400 | 1.6 (160%) | 일반 본문 (가독성 최적) |
| Caption | 14px | 400 | 1.5 (150%) | 보조 설명, 레이블 |
| Micro | 12px | 400 | 1.4 (140%) | 날짜, 태그, 최소 정보 |

### 금액 표시 규칙

```
총자산/잔액:
  font-size: 32px | font-weight: 700 | font-variant-numeric: tabular-nums
  포맷: N,NNN,NNN원 (콤마 3자리 구분)

변동금액:
  font-size: 16~18px | font-weight: 500
  수익: +N,NNN원 (color: #f04452)
  손실: -N,NNN원 (color: #3182f6)

퍼센트:
  font-size: 14px
  포맷: (+12.34%) 괄호 포함

단위 "원":
  font-size: 금액 숫자의 60~70% 크기
```

---

## 3. 간격 시스템 (Spacing Scale)

### 4px 기반 배수 스케일

| 토큰 | 값 | 주요 용도 |
|------|----|---------|
| space-1 | 4px | 아이콘-텍스트 간격, 최소 내부 패딩 |
| space-2 | 8px | 아이템 내 요소 간격 |
| space-3 | 12px | 콤팩트 패딩, 뱃지 패딩 |
| space-4 | 16px | 기본 패딩, 섹션 내부 |
| space-5 | 20px | 화면 좌우 여백 (screen padding) |
| space-6 | 24px | 섹션 간 구분 |
| space-8 | 32px | 카드 간 간격, 큰 섹션 분리 |
| space-10 | 40px | 페이지 상단 여백 |
| space-12 | 48px | 하단 CTA 위 여백 |

### 화면 여백 (Screen Padding)

```
메인 화면 좌우:   20px
섹션 구분 내부:   16px
카드 내부:        20px (기본) / 16px (콤팩트)
리스트 좌우:      20px
Bottom Sheet:     20px 좌우, 24px 상단
```

---

## 4. 컴포넌트 스펙

### 카드 (Card)

```
배경:           #ffffff (라이트) / fill.neutral.weak 변형
border-radius:  16px (대형 카드) / 12px (중형) / 8px (소형)
padding:        20px (기본) / 16px (콤팩트)
shadow:         0px 2px 8px rgba(0,0,0,0.06) — 라이트모드만
border:         없음 (shadow로 구분) 또는 1px solid #e5e8eb
```

- 카드 하나 = 하나의 정보 단위
- 카드 내 depth: 배경색 한 단계 올려서 표현 (흰색 → grey50)

### 리스트 아이템 (ListRow)

```
높이:   56px (기본) / 72px (아이콘+2줄) / 48px (콤팩트)
left:   아이콘 or 썸네일 (40px × 40px, border-radius: 50%)
center: 제목 (16px/400) + 서브 (14px/400, text.secondary)
right:  금액 or 화살표(>) or 토글
divider: 1px solid #e5e8eb, left-inset (아이콘 폭 + 16px)
padding: 0 20px
```

### 버튼 (Button)

```
Primary CTA (BottomCTA):
  배경:          #3182f6
  텍스트:        #ffffff, 16px, weight 600
  높이:          56px
  border-radius: 12px
  width:         full-width (좌우 20px 여백)
  hover:         #1b64da (blue600)
  disabled:      opacity 0.4

Secondary:
  배경:          #f2f4f6 (fill.neutral.weak)
  텍스트:        #191f28 (text.primary)
  높이:          48px
  border-radius: 8px

텍스트 버튼:
  배경:          transparent
  텍스트:        #3182f6 (text.brand)
  hover:         opacity 0.8

Ghost (outlined):
  border:        1px solid #e5e8eb
  텍스트:        text.primary
  hover:         background #f2f4f6
```

### Bottom Sheet

```
top border-radius: 20px
드래그 핸들:       4px × 36px, border-radius: 2px, 색상 #e5e8eb, 상단 중앙
딤 배경:           rgba(0,0,0,0.4)
최대 높이:         화면의 90%
진입 애니메이션:   350ms ease-out, translateY(100%) → translateY(0)
내부 패딩:         20px 좌우, 24px 상단
```

### 뱃지 (Badge)

```
진행중:    background #dbeafe, color #3182f6, border-radius: 4px, padding: 2px 8px, 12px/500
완료:      background #d1fae5, color #03b26c
취소/실패:  background #f2f4f6, color #6b7684
주의:      background #fee2e2, color #f04452
숫자 알림:  원형 최소 16px × 16px, background #f04452, color #ffffff, 12px/700
```

### Input

```
높이:          52px
border:        1px solid #e5e8eb (기본) → 1px solid #3182f6 (focus) → 1px solid #f04452 (error)
border-radius: 8px
padding:       0 16px
placeholder:   text.tertiary (#8b95a1)
label:         14px/500, text.secondary, margin-bottom: 8px
error text:    14px/400, text.danger (#f04452), margin-top: 4px
```

### Navigation (Bottom Tab)

```
높이:          56px + safe-area-inset-bottom
아이콘:        24px × 24px
활성 탭:       icon + label color: #3182f6
비활성 탭:     color: #b0b8c1
label:         10px/400
background:    #ffffff
border-top:    1px solid #e5e8eb
```

---

## 5. 레이아웃 아키타입

### A. 태스크 화면 (Task Screen)
> 단일 목적 작업: 송금, 결제, 설정 변경 등

```
┌─────────────────────┐
│ ← 뒤로   타이틀       │  ← Top Navigation (56px)
├─────────────────────┤
│                     │  ← 상단 여백 24px
│  [주요 입력 영역]    │  ← 카드 or 입력 폼 (20px 좌우 여백)
│                     │
│  [보조 정보]         │  ← caption (text.secondary)
│                     │
│                     │  ← 여백 (flex-grow)
├─────────────────────┤
│  [Primary CTA 버튼]  │  ← 56px, 20px 좌우 여백, 24px 상단 여백
│                     │  ← safe-area padding
└─────────────────────┘
```

### B. 리스트 화면 (List Screen)
> 거래 내역, 카드 목록, 알림 등

```
┌─────────────────────┐
│ 타이틀               │  ← 24px/600, padding: 20px
├─────────────────────┤
│ [섹션 헤더]          │  ← 12px/500, text.secondary, background: #f2f4f6, padding: 8px 20px
│ ─────────────────── │
│ [ListRow 1]         │  ← 56px 또는 72px
│ ─────────────────── │  ← 1px divider (inset)
│ [ListRow 2]         │
│ ─────────────────── │
│ [ListRow 3]         │
├─────────────────────┤
│ [섹션 헤더 2]        │
│ [ListRow ...]       │
└─────────────────────┘
```

### C. 대시보드 화면 (Dashboard Screen)
> 홈, 자산 요약, 포트폴리오 등

```
┌─────────────────────┐
│ 로고/아바타  알림(🔔) │  ← Top bar (56px)
├─────────────────────┤
│ [메인 자산 카드]     │  ← radius:16px, margin: 0 20px
│  총자산 32px/700    │
│  변동 +/-           │
├─────────────────────┤
│ [퀵 액션 그리드]     │  ← 4~5개 아이콘 그리드
├─────────────────────┤
│ [섹션: 최근 거래]    │
│ [ListRow...]        │
│ [더보기 →]          │
└─────────────────────┘
```

### D. 모달 / Bottom Sheet
> 확인, 선택, 간단 입력 등

```
┌─────────────────────┐  ← 딤 배경 rgba(0,0,0,0.4)
│                     │
│ ┌─────────────────┐ │
│ │  ────           │ │  ← 드래그 핸들 (4×36px)
│ │                 │ │
│ │ [제목 20px/600] │ │
│ │ [내용 설명]      │ │
│ │                 │ │
│ │ [Primary CTA]   │ │
│ │ [Secondary]     │ │
│ └─────────────────┘ │  ← border-radius: 20px 20px 0 0
└─────────────────────┘
```

---

## 6. 인터랙션 / 애니메이션

### 트랜지션 속도

```
탭/토글 (micro):       100~150ms
화면 전환:             250~300ms
Bottom Sheet 슬라이드:  350ms ease-out
모달 페이드인:          200ms
Skeleton shimmer:      1.5s linear infinite
```

### 피드백 패턴

```
버튼 탭:    transform: scale(0.97), duration: 100ms
카드 탭:    opacity: 0.85, duration: 100ms
호버:       GrayAlpha 4% 오버레이 (중립) / BrandAlpha 4% (브랜드)
```

### Skeleton UI

```
배경:          linear-gradient(90deg, #f0f0f0, #e0e0e0, #f0f0f0)
animation:     shimmer 1.5s linear infinite
border-radius: 콘텐츠와 동일
Spinner 금지:  Skeleton 우선
```

---

## 7. Financial UI 패턴

### 금액 표시 계층

```
총자산 / 잔액 (최상위):
  font-size: 32px | font-weight: 700 | font-variant-numeric: tabular-nums
  color: #191f28

변동금액 (2차):
  font-size: 16~18px | font-weight: 500
  수익: +N,NNN원 (color: #f04452) | 손실: -N,NNN원 (color: #3182f6)

퍼센트 (3차):
  font-size: 14px | (+12.34%) 괄호 포함
```

### 거래 내역 리스트

```
Left:          서비스 로고 or 카테고리 아이콘 (40px 원형)
Center-top:    거래처명 (16px/400, text.primary)
Center-bottom: 날짜/시간 (14px/400, text.secondary)
Right-top:     -N,NNN원 / +N,NNN원 (16px/600 + 컬러)
Right-bottom:  잔액 (14px/400, text.secondary)
```

---

## 8. 핵심 디자인 철학

1. **사용자 기만 없음** — 과장, 조작적 표현, 업계 용어 사용 금지
2. **명확한 언어** — 모든 사용자가 이해할 수 있는 쉬운 말
3. **한 화면 한 목적** — 집중을 방해하는 멀티 태스킹 UI 지양
4. **빠른 실험** — A/B 테스트로 검증, 완벽함보다 빠른 출시
5. **접근성 내재화** — 대비 4.5:1 이상, 터치 타겟 44px
6. **일관성 우선** — 같은 컴포넌트는 모든 서비스에서 동일하게 동작

---

## 9. 참고 출처

- 토스 브랜드 리소스: https://brand.toss.im/
- TDS 컬러 시스템 업데이트: https://toss.tech/article/tds-color-system-update
- 토스 프로덕트 산스 제작기: https://toss.im/tossfeed/article/beginning-of-tps
- 토스 디자인 시스템 원칙: https://toss.tech/article/toss-design-system
- 컴포넌트 설계 원칙: https://toss.tech/article/tds-component-making
- 앱인토스 TDS 컴포넌트: https://developers-apps-in-toss.toss.im/design/components.html
- TDS Mobile 공식 문서: https://tossmini-docs.toss.im
