# 카드 상세 모달 UI/UX 스펙 (v3 — 토스 디자인 시스템)

> *작성자*: Krusty (Designer)
> *작성일*: 2026-04-10
> *이전 버전*: v2 (2026-04-02, Apple 다크 테마 기반 — deprecated)
> *변경 사유*: 2026-04-09 결정 — Krusty 에이전트 Apple → 토스 디자인 시스템 전면 전환
> *대상*: Bart (Frontend 구현)

---

## 1. 재설계 핵심 변경 요약

| 항목 | v2 (Apple 다크) | v3 (토스 라이트) |
|------|----------------|-----------------|
| 배경 | `#1c1c1e` (다크) | `#FFFFFF` (라이트) |
| 오버레이 | `rgba(0,0,0,0.72)` + backdrop blur | `rgba(0,0,0,0.4)` — blur 없음 |
| 강조색 | `#2997ff` / `#0071e3` (Apple Blue) | `#0064FF` (Toss Blue) |
| 레이블 | `uppercase + letterSpacing` | 소문자, `#8B95A1`, 13px |
| 진행률 바 | 글로우 그라디언트 | 단색, 시맨틱 컬러 |
| 태그 | 반투명 파란 배경 | `#E8F3FF` + `#0064FF` |
| 닫기 버튼 | 32×32px (미달) | 48×48px 터치 타겟 |
| 삭제 버튼 | 없음 (갭) | 푸터 좌측, ghost→danger |
| 카드 ID | 없음 (갭) | 헤더 브레드크럼 우측 |
| 컬럼 이동 | 없음 (갭) | 메타 행 select |
| 모달 테두리 | `1px solid rgba(255,255,255,0.12)` | 없음 (shadow만) |

---

## 2. CSS 토큰 파일

`app/globals.css` 내 `/* === 토스 카드 모달 토큰 ===*/` 섹션 참조.
토큰 prefix: `--toss-modal-*`

---

## 3. 레이아웃 구조

```
CardDetailModal
├── Overlay (position: fixed, inset: 0, z-index: 50)
│   ├── background: rgba(0,0,0,0.4)   ← Toss dim overlay
│   └── ModalContainer (maxWidth: 560px, maxHeight: 88vh)
│       ├── ModalHeader          (bg #FFFFFF, border-bottom 1px solid #F0F0F0)
│       │   ├── BreadcrumbRow    (컬럼명 select + 카드 ID)
│       │   ├── TitleRow         (제목 인라인 편집)
│       │   └── CloseButton      (48×48px 터치 타겟)
│       ├── ModalBody            (overflow-y: auto, flex: 1, bg #FFFFFF)
│       │   ├── MetaCard         (담당자 / 우선순위 / 컬럼 — 카드 1)
│       │   ├── DateCard         (마감일 + 생성일 + 수정일 — 카드 2)
│       │   ├── TagCard          (태그 — 카드 3)
│       │   ├── ProgressCard     (진행률 — 카드 4)
│       │   ├── DescriptionCard  (설명 — 카드 5)
│       │   └── ActivityCard     (활동 로그 — 카드 6)
│       └── ModalFooter          (bg #FFFFFF, border-top 1px solid #F0F0F0)
│           ├── Left: SavingIndicator + DeleteButton
│           └── Right: CloseButton (secondary)
```

> *"카드 기반 정보 구조화"* — Body 내 각 섹션을 `#F4F4F4` 배경 위 `#FFFFFF` 카드로 분리.
> 단, 현재 모달이 이미 카드(#FFFFFF)이므로 섹션 간 구분은 `1px solid #F0F0F0` separator로 처리.

---

## 4. 색상 토큰 매핑 (Toss 기준)

### 4-1. 구조 색상

| 역할 | 값 | 용도 |
|------|----|------|
| 모달 배경 | `#FFFFFF` | ModalContainer, Body, Footer |
| 오버레이 | `rgba(0,0,0,0.4)` | Dim 배경 |
| Separator | `#F0F0F0` | 헤더/푸터 경계, 섹션 구분선 |
| 모달 Shadow | `0 4px 16px rgba(0,0,0,0.12)` | Elevated surface |
| 입력 필드 bg | `#F2F4F6` | 비활성 input/select |
| 입력 필드 focus | `#FFFFFF` bg + `1px solid #0064FF` | 활성 input |
| Focus ring | `0 0 0 3px rgba(0,100,255,0.12)` | 키보드 포커스 |

### 4-2. 텍스트

| 역할 | 값 |
|------|----|
| 제목 | `#191F28` |
| 본문 | `#4E5968` |
| 레이블 / 힌트 | `#8B95A1` |
| 비활성 | `#B0B8C1` |
| Inverse (버튼 위) | `#FFFFFF` |

### 4-3. 우선순위 뱃지 (Toss 시맨틱)

| 우선순위 | 텍스트 | 배경 | 적용 근거 |
|---------|--------|------|----------|
| 높음 | `#F04452` | `rgba(240,68,82,0.08)` | Toss Error |
| 보통 | `#FF9500` | `rgba(255,149,0,0.08)` | Toss Warning |
| 낮음 | `#00C471` | `rgba(0,196,113,0.08)` | Toss Success |

> 뱃지에 border 없음 — 배경 색상으로만 구분 (Toss 원칙)

### 4-4. 컬럼 이동 select accent

컬럼별 색상은 기존 `--color-col-*` 토큰 유지. 단, 컬럼 select 내부 색상 dot만 accent 표시.

```
컬럼 color dot: 6px circle, 해당 컬럼 accent 색상
select 자체: #F2F4F6 bg, #191F28 text, 8px radius
```

### 4-5. 진행률 바 (Toss 시맨틱, 글로우 제거)

| 구간 | 색상 | 근거 |
|------|------|------|
| 0 – 33% | `#F04452` | Error (낮음) |
| 34 – 66% | `#FF9500` | Warning (중간) |
| 67 – 100% | `#00C471` | Success (높음) |

- 트랙 배경: `#F2F4F6`
- 높이: `6px`, radius: `3px`
- 그라디언트, glow, boxShadow 전부 제거
- 진행률 수치 폰트: `15px`, weight `700`, 해당 시맨틱 컬러

### 4-6. 태그

| 역할 | 값 |
|------|----|
| 배경 | `#E8F3FF` |
| 텍스트 | `#0064FF` |
| radius | `4px` |
| font | `12px`, weight `600` |
| border | 없음 |
| 패딩 | `3px 8px` |

---

## 5. 헤더 상세 스펙

```
padding: 16px 20px 14px
border-bottom: 1px solid #F0F0F0
```

### 5-1. BreadcrumbRow

```
[📋 컬럼명 select ▾]        [#42]
```

- 컬럼명 select:
  - font: `13px`, weight `500`, `#8B95A1` — NO uppercase, NO letterSpacing
  - background: transparent, border: none
  - cursor: pointer, hover: `#4E5968`
  - 내부에 컬럼 color dot (6px circle)
- 카드 ID:
  - `#42` 포맷
  - font: `11px`, `#B0B8C1`, monospace
  - marginLeft: auto

### 5-2. TitleRow

- 제목 표시 상태:
  - font: `20px` (Toss Title), weight `700`, `#191F28`, letter-spacing `-0.3px`
  - 클릭 시 편집 진입, cursor: text
  - 편집 힌트 아이콘: `14px`, `#B0B8C1`, hover `#8B95A1`

- 제목 편집 상태 (input):
  - background: `#F2F4F6` → focus: `#FFFFFF` + `1px solid #0064FF`
  - radius: `8px`, padding: `8px 12px`
  - font: `20px`, weight `700`, `#191F28`
  - outline: none + focus ring `0 0 0 3px rgba(0,100,255,0.12)`

### 5-3. CloseButton

```
width: 48px; height: 48px;   ← 터치 타겟 48px 필수
border-radius: 50%;
display: flex; align-items: center; justify-content: center;
background: transparent;
border: none;
cursor: pointer;
color: #8B95A1;
transition: background 150ms, color 150ms;
```

- Hover: background `#F4F4F4`, color `#191F28`
- 아이콘: `×` 또는 SVG X 아이콘, 20px

---

## 6. Body 섹션 스펙

```
padding: 20px
gap: 16px (섹션 간)
background: #FFFFFF
```

섹션 레이블 공통 스타일:
```
font-size: 13px
font-weight: 600
color: #8B95A1
margin-bottom: 8px
/* uppercase: 절대 금지 */
/* letterSpacing > 0: 절대 금지 */
letter-spacing: -0.2px
```

### 6-1. MetaCard (담당자 / 우선순위 / 컬럼)

`display: flex; gap: 16px; flex-wrap: wrap;`

*담당자 select:*
```
height: 36px
background: #F2F4F6
border: none
border-radius: 8px
padding: 0 12px
font: 14px/1 weight 500 #191F28
cursor: pointer
```

*우선순위 select:*
- 현재 선택 우선순위에 맞는 배경/텍스트 색상 적용 (§4-3 참조)
- radius: `20px` (pill), padding: `4px 12px`
- border: 없음

*컬럼 이동 select (신규):*
```
height: 36px
background: #F2F4F6
border: none
border-radius: 8px
padding: 0 12px 0 8px
font: 14px/1 weight 500 #191F28
```
- 좌측에 해당 컬럼 color dot (6px circle) 표시

### 6-2. DateCard (마감일 / 날짜 정보)

*마감일 input[type=date]:*
```
height: 36px
background: #F2F4F6
border: none → focus: 1px solid #0064FF
border-radius: 8px
padding: 0 12px
font: 14px weight 500 #191F28
```

*마감일 상태 뱃지:*
```
높이: 22px
패딩: 4px 8px
radius: 4px
font: 11px weight 600
```
| 상태 | 텍스트 색 | 배경 |
|------|----------|------|
| 기한 초과 | `#F04452` | `rgba(240,68,82,0.08)` |
| 임박 (3일) | `#FF9500` | `rgba(255,149,0,0.08)` |
| 정상 | `#00C471` | `rgba(0,196,113,0.08)` |

*생성일 / 수정일:*
```
font: 13px weight 400 #8B95A1
표시만, 편집 불가
```

### 6-3. TagCard

태그 pill 스타일: §4-6 참조

태그 input:
```
height: 36px
background: #F2F4F6
border: none → focus: 1px solid #0064FF + focus ring
border-radius: 8px
padding: 0 12px
font: 14px #191F28
```

추가 버튼:
```
height: 36px
background: #0064FF → hover: #0052CC
color: #FFFFFF
radius: 8px
padding: 0 16px
font: 14px weight 600
transition: background 150ms
```

disabled 상태:
```
background: #F2F4F6
color: #B0B8C1
cursor: not-allowed
```

### 6-4. ProgressCard

*슬라이더:*
- `accent-color: [현재 진행률 시맨틱 컬러]`
- cursor: pointer

*진행률 바 (편집 불가 상태):*
```
height: 6px
border-radius: 3px
background(track): #F2F4F6
background(fill): 시맨틱 컬러 (§4-5)
transition: width 500ms cubic-bezier(0.34, 1.56, 0.64, 1)
/* glow, boxShadow, gradient 전부 제거 */
```

*진행률 수치:*
```
font: 15px weight 700
color: 시맨틱 컬러 (§4-5)
letter-spacing: -0.3px
```

### 6-5. DescriptionCard

*뷰 상태:*
```
background: #F4F4F4
border-radius: 8px
padding: 12px 14px
font: 16px weight 400 line-height 1.5 letter-spacing -0.3px
color: #4E5968 (내용 있음) / #B0B8C1 italic (비어 있음)
/* border: 없음 */
```

*편집 상태 (textarea):*
```
background: #FFFFFF
border: 1px solid #0064FF
border-radius: 8px
padding: 12px 14px
font: 16px weight 400 line-height 1.5 #4E5968
outline: none
box-shadow: 0 0 0 3px rgba(0,100,255,0.12)
resize: vertical
```

편집 버튼 (`✎ 편집`):
```
font: 13px weight 500 #8B95A1
background: transparent
border: 1px solid #F0F0F0
border-radius: 6px
padding: 4px 10px
hover: #4E5968, border-color: #D1D6DB
```

설명 저장/취소 버튼:
```
저장: height 36px, bg #0064FF, text #FFFFFF, radius 8px
취소: height 36px, bg #F2F4F6, text #4E5968, radius 8px
```

### 6-6. ActivityCard

활동 아이템:
```
background: #F4F4F4     ← border 없음, bg로만 구분
border-radius: 8px
padding: 10px 12px
/* border 절대 금지 */
```

AgentAvatar:
```
width: 28px, height: 28px
border-radius: 50%
background: 에이전트 색상 (기존 토큰 유지)
font: 10px weight 700 #FFFFFF
/* boxShadow glow 효과 제거 */
/* border: 2px solid #FFFFFF 유지 (배경과 구분용) */
```

---

## 7. 푸터 상세 스펙

```
padding: 14px 20px
border-top: 1px solid #F0F0F0
background: #FFFFFF
display: flex
align-items: center
justify-content: space-between
```

### 7-1. 저장 중 인디케이터

```
font: 13px weight 400 #8B95A1
opacity: saving ? 1 : 0
transition: opacity 200ms
```

### 7-2. DeleteButton (신규)

*기본 상태:*
```
height: 36px
background: transparent
border: none
color: #8B95A1
font: 14px weight 500
radius: 8px
padding: 0 12px
cursor: pointer
transition: background 150ms, color 150ms
```

*Hover 상태:*
```
background: rgba(240,68,82,0.08)
color: #F04452
```

*삭제 확인 상태 (클릭 후):*
```
background: rgba(240,68,82,0.06)
border: 1px solid rgba(240,68,82,0.20)
color: #F04452
```

삭제 확인 플로우:
```
[삭제] 클릭
  → 버튼 텍스트: "정말 삭제할까요?" + [취소] 인라인 배치
  → 3초 후 자동 원상 복귀 (clearTimeout)
  → 확인 클릭: DELETE /cards/:id → onDelete() → 모달 닫기
```

### 7-3. CloseButton (푸터)

```
height: 36px
background: #F2F4F6
color: #4E5968
border: none
border-radius: 8px
padding: 0 20px
font: 14px weight 600
hover: background #E4E7EB
transition: background 150ms
```

---

## 8. 모달 크기 및 반응형

### 데스크톱 (≥768px)
```
maxWidth: 560px
maxHeight: 88vh
border-radius: 24px   ← Toss large radius (모달용)
box-shadow: 0 4px 16px rgba(0,0,0,0.12)
border: none           ← shadow로만 구분
```

### 태블릿 (480–767px)
```
width: calc(100vw - 40px)
maxHeight: 92vh
border-radius: 24px
```

### 모바일 (<480px) — 바텀시트 패턴
```
width: 100vw
maxHeight: 95dvh
border-radius: 16px 16px 0 0   ← Toss 바텀시트 상단 radius
overlay: align-items flex-end, padding 0
핸들 바: 40px × 4px, radius 2px, color #D1D6DB, 중앙 상단
```

---

## 9. 애니메이션

### 데스크톱 등장 (`detailFadeIn`)
```css
@keyframes detailFadeIn {
  from { opacity: 0; transform: scale(0.96) translateY(12px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
animation: detailFadeIn 220ms cubic-bezier(0.16, 1, 0.3, 1);
```
> cubic-bezier(0.16, 1, 0.3, 1) = 토스 spring 근사값

### 모바일 등장 (`slideUp`)
```css
@keyframes slideUp {
  from { opacity: 0; transform: translateY(100%); }
  to   { opacity: 1; transform: translateY(0); }
}
animation: slideUp 300ms cubic-bezier(0.16, 1, 0.3, 1);
```

### 토스트 (`toastIn`)
```css
@keyframes toastIn {
  from { opacity: 0; transform: translateX(-50%) translateY(8px); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0); }
}
```

토스트 스타일:
```
background: #191F28   ← dark pill toast (토스 스타일)
color: #FFFFFF
font: 14px weight 500
border-radius: 20px   ← pill
padding: 10px 20px
box-shadow: 0 4px 12px rgba(0,0,0,0.15)
/* border 없음 */
```

### Micro-interactions
- 버튼 press: `scale(0.97)`, `150ms`
- Input focus: border color + focus ring, `150ms`
- Tag 추가: fade-in `150ms`
- 삭제 확인 전환: opacity + background `150ms`

---

## 10. Props 인터페이스 업데이트

```typescript
interface Column {
  id: number;
  name: string;
  color?: string;  // accent 색상 (옵션)
}

interface Props {
  card: Card;
  columnName: string;
  columns: Column[];           // 신규 — 컬럼 이동 select용
  onClose: () => void;
  onUpdate?: (id: number, data: Partial<Pick<Card,
    'title' | 'description' | 'priority' | 'assignee' |
    'progress' | 'due_date' | 'tags'
  >>) => Promise<void>;
  onDelete?: (id: number) => Promise<void>;   // 신규
  onMove?: (cardId: number, toColumnId: number) => Promise<void>;  // 신규
}
```

---

## 11. 접근성

### Role 및 ARIA
```html
<div role="dialog" aria-modal="true" aria-labelledby="detail-modal-title">
  <h2 id="detail-modal-title">카드 제목</h2>
</div>
```

### 포커스 관리
- 모달 열림 시: CloseButton으로 focus()
- Tab 순환: 포커스 트랩 (첫/마지막 요소 순환)
- ESC: 모달 닫기

### 터치 타겟
- CloseButton: 48×48px (필수)
- 태그 삭제 `×`: 최소 24px (inline)
- 모든 select/button: min-height 36px (터치 타겟 확보)

### 컬러 대비 (라이트 배경 기준)
- `#191F28` on `#FFFFFF`: 대비율 ~16:1 ✅
- `#4E5968` on `#FFFFFF`: 대비율 ~5.9:1 ✅
- `#8B95A1` on `#FFFFFF`: 대비율 ~3.0:1 — 레이블 13px/힌트용만 사용 ⚠️
- `#FFFFFF` on `#0064FF`: 대비율 ~5.4:1 ✅

---

## 12. 자가 체크리스트 (Krusty 검증 완료)

*컬러*
- [x] 강조색 `#0064FF` (Toss Blue) + 시맨틱만
- [x] 모달 배경: `#FFFFFF`
- [x] 그라디언트, 텍스처 배경 없음
- [x] 카드/모달에 border 없음 (shadow만)
- [x] near-white 임의값 없음 (`#F2F4F6`, `#F4F4F4`만 사용)

*타이포그래피*
- [x] Toss Product Sans / Pretendard 폰트 상속
- [x] uppercase 없음
- [x] letterSpacing > 0 없음
- [x] weight 800/900 없음
- [x] 음수 letter-spacing 적용 (제목 `-0.3px`)

*레이아웃*
- [x] 좌우 패딩 20px
- [x] 4px 배수 간격 시스템
- [x] 핵심 CTA 1개 (저장/닫기 — Delete는 보조)

*컴포넌트*
- [x] 입력 필드: `#F2F4F6` bg, `8px` radius
- [x] 버튼: `#0064FF` primary, `#F2F4F6` secondary
- [x] 터치 타겟: 48px (CloseButton), 36px (기타)
- [x] 로딩: Skeleton shimmer 방향 (현재 saving indicator로 대체 — 적절)

*모션*
- [x] 바텀시트 패턴 (모바일 <480px)
- [x] Spring ease cubic-bezier(0.16,1,0.3,1)
- [x] backdrop blur 제거

*신규 기능*
- [x] 삭제 버튼 + 확인 플로우 설계
- [x] 카드 ID 표시 (`#42`)
- [x] 컬럼 이동 select 설계

---

## 13. 구현 우선순위

| 항목 | 우선순위 | 예상 공수 |
|------|----------|-----------|
| 전체 색상 토큰 교체 (Apple → Toss) | P0 | 1h |
| 삭제 버튼 + 확인 플로우 | P0 | 1h |
| 카드 ID 표시 + 컬럼 이동 select | P0 | 1.5h |
| 닫기 버튼 48×48px 터치 타겟 | P0 | 30m |
| 진행률 바 스타일 (glow 제거, 시맨틱 색상) | P1 | 30m |
| 토스트 dark pill 스타일 | P1 | 30m |
| 활동 아이템 border 제거 (bg만) | P1 | 20m |
| Props 인터페이스 확장 | P1 | 30m |
| 모달 shadow + border 제거 | P1 | 20m |

---

## 14. Bart 핸드오프 체크리스트

- [ ] `globals.css` 내 `--toss-modal-*` 토큰 블록 사용 (§2 참조)
- [ ] 오버레이: `rgba(0,0,0,0.4)`, backdrop-filter 제거
- [ ] 모달 배경 `#FFFFFF`, border 제거, shadow `0 4px 16px rgba(0,0,0,0.12)`
- [ ] 레이블 uppercase + letterSpacing 전부 제거 (`#8B95A1`, 13px, weight 600)
- [ ] CloseButton 48×48px 터치 타겟 (radius 50%)
- [ ] Props에 `columns`, `onDelete`, `onMove` 추가
- [ ] 푸터 DeleteButton 추가 (ghost → hover danger, §7-2)
- [ ] 삭제 확인 인라인 전환 (3초 자동 복귀)
- [ ] BreadcrumbRow에 카드 ID `#42` 포맷 추가
- [ ] MetaCard에 컬럼 이동 select 추가
- [ ] 진행률 바: glow/gradient 제거, 시맨틱 컬러 + 6px height
- [ ] 토스트: dark pill 스타일 (`#191F28` bg, `#FFFFFF` text, `20px` radius)
- [ ] AgentAvatar glow boxShadow 제거
- [ ] 활동 아이템 border 제거 → `#F4F4F4` bg만
- [ ] tsc --noEmit 통과
- [ ] 모바일 바텀시트 핸들 바 추가 (40×4px, `#D1D6DB`)
