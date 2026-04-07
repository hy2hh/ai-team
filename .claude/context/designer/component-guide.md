# Apple 컴포넌트 선택 가이드

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
| Secondary 텍스트 | `rgba(0,0,0,0.8)` | 80% black |
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
