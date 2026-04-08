# Apple 컴포넌트 선택 가이드

> 전체 Apple 디자인 시스템 레퍼런스: `.claude/context/designer/apple-design-system.md`

---

## 0. Critical 색상 규칙

### 배경 (이진 리듬)
| 역할 | Hex | 용도 |
|------|-----|------|
| Dark Background | `#000000` | 몰입형 섹션, 히어로 |
| Light Background | `#f5f5f7` | 정보형 섹션, 기본 배경 |
| Primary Text (light bg) | `#1d1d1f` | 제목·본문 |
| Text (dark bg) | `#ffffff` | 다크 섹션 텍스트 |

### 강조색 (인터랙티브 요소 전용)
| 역할 | Hex | 용도 |
|------|-----|------|
| Apple Blue (CTA) | `#0071e3` | 버튼, 인터랙티브 요소 |
| Link Blue (light bg) | `#0066cc` | 텍스트 링크 |
| Link Blue (dark bg) | `#2997ff` | 다크 섹션 링크 |
| Focus Ring | `#0071e3` | 키보드 포커스 (2px solid) |

### 보조 색상
| 역할 | 값 | 용도 |
|------|----|------|
| Secondary Text | `rgba(0,0,0,0.80)` | 보조 설명 |
| Tertiary/Disabled | `rgba(0,0,0,0.48)` | 비활성 |
| Card Shadow | `rgba(0,0,0,0.22) 3px 5px 30px 0px` | Elevated card |
| Dark Surface | `#272729`–`#242426` | 다크 모드 레이어 |

**규칙:** `#0071e3` 외 유채색 강조 절대 금지. 총 3–5색 제한 (brand 1 + neutral 2–3 + accent 0–1). 배경색 override 시 텍스트 색상도 반드시 동시 override.

---

## 0.1 타이포그래피 (SF Pro)

| 역할 | Size | Weight | Line Height | Letter Spacing |
|------|------|--------|-------------|----------------|
| Display Hero | 56px | 600 | 1.07 | -0.28px |
| Section Heading | 40px | 600 | 1.10 | normal |
| Tile Heading | 28px | 400 | 1.14 | 0.196px |
| Card Title | 21px | 700 | 1.19 | 0.231px |
| Body | 17px | 400 | 1.47 | -0.374px |
| Body Emphasis | 17px | 600 | 1.24 | -0.374px |
| Button Large | 18px | 300 | 1.00 | normal |
| Link / Caption | 14px | 400 | 1.29–1.43 | -0.224px |
| Micro | 12px | 400/600 | 1.33 | -0.12px |

**서체 규칙:** `SF Pro Display` (20px+) / `SF Pro Text` (19px 이하) — 혼용 금지. Fallback: `Helvetica Neue, Helvetica, Arial, sans-serif`. 최대 2 폰트 패밀리. 음수 letter-spacing 필수. weight 800/900 절대 금지. 제목·카피에 `text-balance` / `text-pretty` 적용.

---

## 0.2 Border Radius 스케일

| 토큰 | 값 | 용도 |
|------|----|------|
| micro | 5px | 최소 요소 |
| standard | 8px | 버튼, 카드 |
| input | 11px | 인풋 필드 |
| panel | 12px | 패널, 시트 |
| pill | 980px | CTA 링크 ("Learn more") |
| circle | 50% | 미디어 컨트롤 |

---

## 0.3 Elevation & Shadow

| 레벨 | 처리 방식 | 용도 |
|------|----------|------|
| Flat | No shadow | 기본 섹션 |
| Navigation Glass | `backdrop-filter: saturate(180%) blur(20px)` + `rgba(0,0,0,0.80)` | Sticky nav |
| Subtle Lift | `rgba(0,0,0,0.22) 3px 5px 30px 0px` | Elevated card |
| Focus | `2px solid #0071e3` | 키보드 포커스 |

Shadow는 극히 드물게 — 대부분 요소는 shadow 없음.

---

## 0.4 레이아웃

- 기본 단위: 8px
- 최대 콘텐츠 너비: 980px, 중앙 정렬
- Hero: full-viewport-width, 단일 컬럼
- 섹션 구분: `#000000` / `#f5f5f7` 배경 교차 (거터 없음)
- 터치 타겟 최소: 44px
- 텍스트 입력 최소: 16px (iOS 줌 방지)
- Tailwind arbitrary 값 금지 — `p-[16px]` → `p-4`, `mx-[8px]` → `mx-2`
- 섹션 수직 패딩 최소 80px — 유틸리티 앱도 apple.com 여백 기준 적용

Navigation: Sticky 48px, `rgba(0,0,0,0.80)` + `backdrop-filter: saturate(180%) blur(20px)`. Glass effect 필수 — 불투명 nav 금지. Links: 12px SF Pro Text, white.

카드: Border 없음, 5–8px radius, Shadow: `rgba(0,0,0,0.22) 3px 5px 30px 0px` (elevated만).

---

## 1. 컴포넌트 선택 의사결정 트리

```
사용자 액션이 필요한가?
├─ Yes: 어떤 종류?
│  ├─ 주요 CTA (페이지 레벨) → Pill CTA (#0071e3, 980px radius) 또는 Full-width Button
│  ├─ 보조 액션 → Pill Link ("Learn more", #0066cc, transparent bg)
│  ├─ 아이콘만 → Icon Button (aria-label 필수, 44px 터치 타겟)
│  ├─ 토글 → Toggle Switch
│  ├─ 선택 → Checkbox 또는 Segmented Control (배타적)
│  └─ 텍스트 입력 → Input (11px radius, 1px border on focus: #0071e3)
├─ No: 정보 표시
│  ├─ 히어로 → 56px SF Pro Display, dark bg (#000000)
│  ├─ 섹션 제목 → 40px SF Pro Display, 중앙 정렬
│  ├─ 제품 카드 → #f5f5f7 bg, 8px radius, no border, 28px Tile Heading
│  ├─ 리스트 → 심플 리스트 (no card chrome)
│  ├─ 로딩 → Skeleton (spinner 금지)
│  └─ 결과 화면 → 최소 텍스트 + CTA
└─ 오버레이가 필요한가?
   ├─ 확인/경고 → Alert (단일 버튼: OK / 이중: Cancel+Confirm)
   ├─ 선택지 → Action Sheet (iOS) 또는 Popover (macOS 스타일)
   ├─ 알림 → Toast/Banner (상단 슬라이드인)
   └─ 보충 설명 → Tooltip
```

## 2. 색상 적용 규칙

| 맥락 | 값 | 근거 |
|------|----|------|
| Light 섹션 배경 | `#f5f5f7` | Apple semantic |
| Dark 섹션 배경 | `#000000` | Apple semantic |
| Primary 텍스트 (light) | `#1d1d1f` | Near-black |
| Primary 텍스트 (dark) | `#ffffff` | White |
| Secondary 텍스트 | `rgba(0,0,0,0.80)` | 80% black |
| Tertiary/Disabled | `rgba(0,0,0,0.48)` | 48% black |
| Brand/CTA | `#0071e3` | Apple Blue |
| Link (light) | `#0066cc` | Link Blue |
| Link (dark) | `#2997ff` | Bright Blue |
| Focus | `#0071e3` | 2px solid |

## 3. 타이포그래피 적용 규칙

| 용도 | Size | Weight | Letter Spacing | 서체 |
|------|------|--------|----------------|------|
| 페이지 히어로 | 56px | 600 | -0.28px | SF Pro Display |
| 섹션 제목 | 40px | 600 | normal | SF Pro Display |
| 타일/카드 제목 | 28px | 400 | 0.196px | SF Pro Display |
| 카드 헤딩 | 21px | 700 | 0.231px | SF Pro Display |
| 본문 | 17px | 400 | -0.374px | SF Pro Text |
| 캡션/링크 | 14px | 400 | -0.224px | SF Pro Text |
| Nav 링크 | 12px | 400 | normal | SF Pro Text |

## 4. 오버레이 선택 규칙

| 상황 | 컴포넌트 |
|------|---------|
| 단순 확인 (확인 1개) | Alert (OK only) |
| 예/아니오 선택 | Alert (Cancel + Action) |
| 선택지 리스트 | Action Sheet |
| 짧은 피드백 | Toast/Banner |
| 복잡한 커스텀 | Modal Sheet |

## 5. Apple 자가 체크리스트 (산출물 출력 전 필수 점검)

**컬러**
- [ ] 총 3–5색 이하 (brand 1 + neutral 2–3 + accent 0–1)
- [ ] 강조색은 `#0071e3` (Apple Blue) 단 하나만
- [ ] 섹션 배경: `#000000` (dark) / `#f5f5f7` (light) 교차
- [ ] 그라디언트, 텍스처 배경 없음 (명시 요청 시 예외)
- [ ] 카드에 border 없음 (shadow로만 구분)
- [ ] 배경색 override 시 텍스트 색상도 동시 override

**타이포그래피**
- [ ] SF Pro Display (20px+) / SF Pro Text (19px 이하) 구분
- [ ] 최대 2 폰트 패밀리 (heading + body)
- [ ] 제목·중요 카피에 `text-balance` 또는 `text-pretty` 적용
- [ ] 모든 텍스트에 음수 letter-spacing (또는 0)
- [ ] weight 800/900 없음

**레이아웃**
- [ ] 최대 콘텐츠 너비 980px, 중앙 정렬
- [ ] 기본 단위 8px 준수
- [ ] Tailwind arbitrary 값 금지 (`p-[16px]` → `p-4`)
- [ ] Hero: full-viewport-width
- [ ] 섹션 구분: 배경색 교차 (거터/border 없음)

**컴포넌트**
- [ ] CTA: Pill (980px radius, `#0071e3`) 또는 Dark (`#1d1d1f`)
- [ ] Link: Pill transparent (`#0066cc` text/border)
- [ ] Nav: Glass effect (반투명 blur) 필수
- [ ] Shadow: `rgba(0,0,0,0.22) 3px 5px 30px 0px` 또는 없음
- [ ] 빈 상태: 텍스트만 (일러스트/CTA 없음)
- [ ] 로딩: Skeleton (Spinner 금지)

**접근성**
- [ ] 모든 컴포넌트 상태 정의 (Default/Hover/Active/Focus/Disabled/Loading/Error/Empty)
- [ ] 터치 타겟 44px 이상
- [ ] 대비 4.5:1 이상
- [ ] 모든 인터랙티브 요소에 aria-label
- [ ] Focus ring: `2px solid #0071e3`
