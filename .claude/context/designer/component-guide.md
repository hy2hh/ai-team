# 토스 컴포넌트 선택 가이드

> 전체 토스 디자인 시스템 레퍼런스: `.claude/context/designer/toss-design-system.md`

---

## 0. Critical 색상 규칙

### 배경
| 역할 | Light | Dark | 용도 |
|------|-------|------|------|
| Page Background | `#F4F4F4` | `#17171C` | 전체 배경 |
| Card Surface | `#FFFFFF` | `#2C2C35` | 카드, 입력 필드 |
| Primary Text | `#191F28` | `#ECECEC` | 제목·본문 |
| Inverse Text | `#FFFFFF` | `#191F28` | 컬러 배경 위 |

### 강조색 (인터랙티브 요소 전용)
| 역할 | Light | Dark | 용도 |
|------|-------|------|------|
| Toss Blue (CTA) | `#3182F6` | `#4D9BFF` | 버튼, 인터랙티브 요소 |
| Toss Blue Hover | `#1B64DA` | — | 호버 상태 |
| Focus Ring | `#3182F6` | — | 키보드 포커스 (2px solid) |

### 보조·시맨틱 색상
| 역할 | 값 | 용도 |
|------|----|------|
| Secondary Text | `#4E5968` | 보조 설명 |
| Tertiary/Disabled | `#8B95A1` | 비활성 |
| Card Shadow | `0 2px 8px rgba(0,0,0,0.08)` | 기본 카드 |
| Success | `#00C471` | 완료, 수익 |
| Warning | `#FF9500` | 주의 |
| Error | `#F04452` | 에러, 손실 |

**규칙:** `#3182F6` 외 커스텀 유채색 강조 금지. 시맨틱 컬러(성공/경고/에러)만 예외. 배경색 override 시 텍스트 색상도 반드시 동시 override.

---

## 0.1 타이포그래피 (Toss Product Sans / Pretendard)

| 역할 | Size | Weight | Line Height | Letter Spacing |
|------|------|--------|-------------|----------------|
| Display Hero | 32px | 700 | 1.3 | -0.4px |
| Section Heading | 24px | 700 | 1.4 | -0.3px |
| Title | 20px | 700 | 1.4 | -0.3px |
| Subtitle | 17px | 600 | 1.4 | -0.3px |
| Body | 16px | 400 | 1.5 | -0.3px |
| Body Emphasis | 16px | 600 | 1.5 | -0.3px |
| Caption | 13px | 400 | 1.4 | -0.2px |
| Micro | 11px | 400 | 1.3 | 0px |

**서체 규칙:** `Toss Product Sans` (Primary), `Pretendard` (Fallback). 혼용 금지. 최대 2 폰트 패밀리. 음수 letter-spacing. weight 800/900 절대 금지. 제목·카피에 `text-balance` / `text-pretty` 적용.

---

## 0.2 Border Radius 스케일

| 토큰 | 값 | 용도 |
|------|----|------|
| micro | 4px | 태그, 배지 |
| small | 8px | 인풋, 작은 요소 |
| standard | 12px | 버튼 |
| card | 16px | 카드, 바텀시트 |
| large | 24px | 큰 카드 |
| circle | 50% | 아바타 |

---

## 0.3 Elevation & Shadow

| 레벨 | 처리 방식 | 용도 |
|------|----------|------|
| Flat | No shadow | 페이지 배경 위 요소 |
| Card | `0 2px 8px rgba(0,0,0,0.08)` | 기본 카드 |
| Elevated | `0 4px 16px rgba(0,0,0,0.12)` | 바텀시트, 팝업 |
| Focus | `2px solid #3182F6` | 키보드 포커스 |

Shadow는 미세하게 — 토스는 배경색 차이(`#F4F4F4` vs `#FFFFFF`)와 최소 shadow로 위계 표현.

---

## 0.4 레이아웃

- 기본 단위: 4px
- 좌우 패딩: 20px (모바일)
- 최대 콘텐츠 너비: 640px (모바일 중심), 1080px (데스크톱)
- 섹션 간격: 32px
- 카드 간격: 12px
- 터치 타겟 최소: 48px
- 텍스트 입력 최소: 16px (iOS 줌 방지)
- Tailwind arbitrary 값 금지 — `p-[20px]` → `p-5`

Navigation: 모바일 — 하단 탭 바 56px, `#FFFFFF`, 상단 1px `#F0F0F0`. 데스크톱 — 상단 미니멀 바.

카드: `#FFFFFF`, 16px radius, `0 2px 8px rgba(0,0,0,0.08)`, 패딩 20px. Border 없음.

---

## 1. 컴포넌트 선택 의사결정 트리

```
사용자 액션이 필요한가?
├─ Yes: 어떤 종류?
│  ├─ 주요 CTA (페이지 레벨) → Full-width Button (#3182F6, 12px radius, 54px height)
│  ├─ 보조 액션 → Secondary Button (#F2F4F6 bg, #4E5968 text)
│  ├─ 아이콘만 → Icon Button (aria-label 필수, 48px 터치 타겟)
│  ├─ 토글 → Toggle Switch
│  ├─ 선택 → Checkbox 또는 Chip Group (배타적)
│  └─ 텍스트 입력 → Input (8px radius, 54px height, #F2F4F6 bg)
├─ No: 정보 표시
│  ├─ 핵심 수치 → 카운트업 애니메이션 + 32px Hero
│  ├─ 정보 그룹 → 카드 (#FFFFFF, 16px radius, 20px padding)
│  ├─ 리스트 → 카드 내부 리스트 (separator: #F0F0F0)
│  ├─ 로딩 → Skeleton shimmer (Spinner 절대 금지)
│  └─ 결과 화면 → 최소 텍스트 + 단일 CTA
└─ 오버레이가 필요한가?
   ├─ 확인/경고 → 바텀시트 (모달 대신)
   ├─ 선택지 → 바텀시트 리스트
   ├─ 알림 → Toast (하단 슬라이드업)
   ├─ 복잡한 입력 → 바텀시트 (스크롤 가능)
   └─ 보충 설명 → Tooltip
```

## 2. 색상 적용 규칙

| 맥락 | 값 | 근거 |
|------|----|------|
| 페이지 배경 | `#F4F4F4` | Toss semantic |
| 카드 배경 | `#FFFFFF` | Surface |
| Primary 텍스트 | `#191F28` | Near-black |
| Secondary 텍스트 | `#4E5968` | Grey |
| Tertiary/Disabled | `#8B95A1` | Light grey |
| Brand/CTA | `#3182F6` | Toss Blue |
| Link | `#3182F6` | Same as brand |
| Focus | `#3182F6` | 2px solid |
| Success | `#00C471` | Green |
| Error | `#F04452` | Red |

## 3. 타이포그래피 적용 규칙

| 용도 | Size | Weight | Letter Spacing | 서체 |
|------|------|--------|----------------|------|
| 페이지 히어로 | 32px | 700 | -0.4px | Toss Product Sans |
| 섹션 제목 | 24px | 700 | -0.3px | Toss Product Sans |
| 카드 제목 | 20px | 700 | -0.3px | Toss Product Sans |
| 부제목 | 17px | 600 | -0.3px | Toss Product Sans |
| 본문 | 16px | 400 | -0.3px | Pretendard |
| 캡션 | 13px | 400 | -0.2px | Pretendard |
| 마이크로 | 11px | 400 | 0px | Pretendard |

## 4. 오버레이 선택 규칙

| 상황 | 컴포넌트 |
|------|---------|
| 단순 확인 | 바텀시트 (단일 버튼) |
| 예/아니오 선택 | 바텀시트 (Cancel + Action) |
| 선택지 리스트 | 바텀시트 리스트 |
| 짧은 피드백 | Toast (하단 슬라이드업) |
| 복잡한 입력 | 풀 바텀시트 (스크롤 가능) |
| 보충 설명 | Tooltip |

> **모달 대신 바텀시트 우선** — 토스에서 모달은 거의 사용하지 않음. 바텀시트로 대체.

## 5. 토스 자가 체크리스트 (산출물 출력 전 필수 점검)

**컬러**
- [ ] 강조색은 `#3182F6` (Toss Blue) + 시맨틱만
- [ ] 페이지 배경: `#F4F4F4`
- [ ] 카드 배경: `#FFFFFF`
- [ ] 그라디언트, 텍스처 배경 없음
- [ ] 카드에 border 없음 (shadow로만 구분)
- [ ] 배경색 override 시 텍스트 색상도 동시 override

**타이포그래피**
- [ ] Toss Product Sans / Pretendard 사용
- [ ] 최대 2 폰트 패밀리
- [ ] 제목·중요 카피에 `text-balance` 또는 `text-pretty` 적용
- [ ] 음수 letter-spacing 적용
- [ ] weight 800/900 없음

**레이아웃**
- [ ] 좌우 패딩 20px (모바일)
- [ ] 기본 단위 4px 준수
- [ ] Tailwind arbitrary 값 금지
- [ ] 한 화면, 한 목적 (핵심 CTA 1개)
- [ ] 카드 기반 정보 구조화

**컴포넌트**
- [ ] CTA: Full-width 12px radius, `#3182F6`, 54px height
- [ ] 카드: 16px radius, no border, subtle shadow
- [ ] Nav: 모바일 하단 탭 바 / 데스크톱 상단 미니멀
- [ ] Shadow: `0 2px 8px rgba(0,0,0,0.08)` (기본)
- [ ] 빈 상태: 일러스트 + 텍스트 + CTA
- [ ] 로딩: Skeleton shimmer (Spinner 금지)

**모션**
- [ ] 페이지 전환: Spring 애니메이션
- [ ] 오버레이: 바텀시트 우선 (모달 대신)
- [ ] 수치 표시: 카운트업 애니메이션
- [ ] 리스트: staggered 등장

**접근성**
- [ ] 모든 컴포넌트 상태 정의 (Default/Hover/Active/Focus/Disabled/Loading/Error/Empty)
- [ ] 터치 타겟 48px 이상
- [ ] 대비 4.5:1 이상
- [ ] 모든 인터랙티브 요소에 aria-label
- [ ] Focus ring: `2px solid #3182F6`

---

## 6. TDS 공식 컴포넌트 카탈로그

> 토스 디자인 시스템(TDS) 공개 11종 컴포넌트. 각 항목은 4섹션 축약 형식.
> 전체 8섹션 템플릿: `templates/component-spec.md`

### 6-1. BottomCTA

**개요**: 화면 하단 고정 CTA 버튼. 토스 핵심 패턴 — "한 화면, 한 목적"의 실체.

**토큰**: bg `#3182F6`, text `#FFFFFF`, height `54px`, radius `12px`, 좌우 margin `20px`, 하단 safe-area 대응.

**상태**: Default → Hover(`#1B64DA`) → Pressed(`#1957C2`) → Disabled(bg `#F2F4F6`, text `#B0B8C1`) → Loading(Skeleton shimmer).

**코드 예시**:
```tsx
<div className="fixed bottom-0 left-0 right-0 p-5 pb-safe bg-white">
  <button className="w-full h-[54px] rounded-xl bg-primary text-white font-semibold">
    다음
  </button>
</div>
```

### 6-2. Button

**개요**: 범용 버튼. BottomCTA와 달리 인라인 배치.

**토큰**: Primary — bg `#3182F6`, radius `12px`. Secondary — bg `#F2F4F6`, text `#4E5968`. Small — height `36px`, radius `8px`. Medium — height `44px`. Large — height `54px`.

**상태**: Default / Hover / Pressed / Disabled / Loading.

**코드 예시**:
```tsx
<button className="h-11 px-4 rounded-xl bg-primary text-white">확인</button>
<button className="h-11 px-4 rounded-xl bg-gray-100 text-gray-700">취소</button>
```

### 6-3. ListRow

**개요**: 토스 UI의 근간. 좌측 아이콘/아바타 + 텍스트 + 우측 액세서리 구조.

**토큰**: height `min 56px`, 패딩 `16px 20px`, separator `#F0F0F0` 1px. 좌측 아이콘 영역 `40px` 원형(radius 50%).

**상태**: Default / Hover(bg `#F4F4F4`) / Pressed(bg `#ECECEC`) / Disabled.

**코드 예시**:
```tsx
<div className="flex items-center px-5 py-4 gap-3">
  <div className="w-10 h-10 rounded-full bg-gray-100 flex-shrink-0" />
  <div className="flex-1 min-w-0">
    <p className="text-base font-medium text-gray-900 truncate">제목</p>
    <p className="text-sm text-gray-500">설명</p>
  </div>
</div>
```

### 6-4. ListHeader

**개요**: 리스트 섹션의 헤더. 그룹 제목 + 선택적 액션 링크.

**토큰**: 패딩 `12px 20px`, 제목 `13px` weight 600, text `#8B95A1`. 액션 링크 `13px` text `#3182F6`.

**상태**: Static (인터랙션 없음).

### 6-5. Badge

**개요**: 상태 표시 라벨.

**토큰**: height `22px`, 패딩 `4px 8px`, radius `4px`, font `11px` weight 600. Blue bg `#E8F3FF` text `#3182F6`, Red bg `#FFEBEE` text `#F04452`, Green bg `#E8FAF0` text `#00C471`, Gray bg `#F2F4F6` text `#4E5968`.

**상태**: Static.

### 6-6. Navigation (하단 탭 바)

**개요**: 모바일 메인 내비게이션. 최대 5개 탭.

**토큰**: height `56px`, bg `#FFFFFF`, 상단 border `1px solid #F0F0F0`. 아이콘 `24px`, 라벨 `11px`. Active — text `#191F28`, Inactive — text `#8B95A1`.

**상태**: Default / Active / Badge(알림 dot `#F04452`, 6px).

### 6-7. Tab

**개요**: 콘텐츠 영역 내 탭 전환. 언더라인 스타일.

**토큰**: height `48px`, 패딩 `0 16px`. Active — text `#191F28` weight 700, underline `2px solid #191F28`. Inactive — text `#8B95A1` weight 400.

**상태**: Default / Active / Hover.

### 6-8. TopPager

**개요**: 상단 페이지 인디케이터. 스와이프 가능한 페이지 간 이동.

**토큰**: dot size `6px`, active dot `#191F28`, inactive dot `#D1D6DB`, dot 간격 `8px`.

**상태**: Active / Inactive (자동 전환).

### 6-9. Border (Separator)

**개요**: 섹션 구분선.

**토큰**: Thin — `1px solid #F0F0F0`. Thick — `8px solid #F4F4F4` (섹션 대구분).

**상태**: Static.

### 6-10. Asset (아이콘/일러스트)

**개요**: 토스 스타일 에셋 컨테이너. 원형 배경 + 아이콘 조합.

**토큰**: Small `32px`, Medium `40px`, Large `48px`. 배경 radius `50%`, 배경색 `#F2F4F6`. 아이콘 크기는 컨테이너의 60%.

**상태**: Static.

### 6-11. Paragraph

**개요**: 본문 텍스트 블록. 토스 기준 줄간격/letter-spacing 최적화.

**토큰**: font `16px`, weight 400, line-height 1.5, letter-spacing `-0.3px`, text `#191F28`. Secondary — text `#4E5968`.

**상태**: Static.
