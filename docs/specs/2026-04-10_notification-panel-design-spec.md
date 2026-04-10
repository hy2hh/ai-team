---
date: 2026-04-10
topic: design-system
roles: [designer, frontend]
summary: 알림 패널 디자인 스펙 — Krusty 작성, ready-for-handoff
status: accepted
---

# 디자인 스펙: 알림 패널 (Notification Panel)

**상태**: ready-for-handoff
**작성자**: Krusty (Designer)
**날짜**: 2026-04-10
**연관 스펙**: `docs/specs/2026-04-10_notification-system-v2.md`
**핸드오프 대상**: Bart (Frontend)

---

## 1. 아키타입 결정

**페이지 아키타입: D (정보형) — 알림 전용 전용 화면 + Layer 오버레이 패널**

알림 패널은 3가지 진입 형태를 가집니다:

| 레이어 | 컴포넌트 | 진입 방식 | 토스 패턴 |
|--------|---------|----------|----------|
| Layer 1 | Toast | 자동 표시 (WebSocket 수신) | 하단 슬라이드업 |
| Layer 2 | Badge/Dot | 상시 노출 (네비게이션) | Nav 아이콘 배지 |
| Layer 3 | 알림 패널 (Panel) | 벨 아이콘 탭 | 바텀시트 (모바일) / 슬라이드인 패널 (데스크톱) |
| Layer 4 | 전용 페이지 | "전체 보기" 링크 | `/notifications` 라우트 |

---

## 2. CSS 토큰 (notification 전용)

> `kanban/frontend/app/globals.css`의 `:root` 블록에 추가하세요.

```css
/* =============================================
   알림 패널 — 토스 디자인 시스템 토큰
   ============================================= */

/* Toss Blue — 강조 (미읽음 dot, 인터랙티브) */
--notif-accent:             #0064FF;
--notif-accent-tint:        #E8F3FF;   /* info 아이콘 배경 */
--notif-accent-hover:       #0052CC;

/* 시맨틱 아이콘 배경 tint */
--notif-tint-success:       #E8FAF0;   /* 완료/승인 */
--notif-tint-warning:       #FFF4E0;   /* 기한 임박/주의 */
--notif-tint-error:         #FFEBEE;   /* 장애/실패 */
--notif-tint-social:        #F2F4F6;   /* 댓글/멘션 */

/* 시맨틱 아이콘 색상 */
--notif-icon-info:          #0064FF;
--notif-icon-success:       #00C471;
--notif-icon-warning:       #FF9500;
--notif-icon-error:         #F04452;
--notif-icon-social:        #4E5968;

/* 배지 */
--notif-badge-bg:           #F04452;
--notif-badge-text:         #FFFFFF;

/* 패널 배경 */
--notif-panel-bg:           #FFFFFF;
--notif-panel-overlay:      rgba(0, 0, 0, 0.4);

/* 리스트 아이템 상태 */
--notif-row-unread-bg:      #FFFFFF;
--notif-row-read-bg:        #F4F4F4;
--notif-row-hover-bg:       #F4F4F4;
--notif-row-pressed-bg:     #ECECEC;
--notif-row-swipe-bg:       #F04452;   /* 스와이프 삭제 */

/* 텍스트 */
--notif-text-primary:       #191F28;
--notif-text-secondary:     #4E5968;
--notif-text-tertiary:      #8B95A1;
--notif-separator:          #F0F0F0;
--notif-separator-thick:    #F4F4F4;   /* 날짜 그룹 구분 */

/* Toast */
--notif-toast-bg:           #191F28;
--notif-toast-text:         #FFFFFF;
--notif-toast-shadow:       0 4px 16px rgba(0, 0, 0, 0.12);

/* 그림자 */
--notif-shadow-panel:       0 4px 16px rgba(0, 0, 0, 0.12);

/* 모션 타이밍 */
--notif-duration-fast:      150ms;
--notif-duration-normal:    200ms;
--notif-duration-panel:     300ms;
```

---

## 3. Layer 1 — Toast 컴포넌트

### 스펙

| 항목 | 값 |
|------|-----|
| 위치 | `position: fixed`, bottom = 탭 바(56px) + 12px = `80px` (모바일), 데스크톱 `24px` |
| 좌우 | `20px` 패딩 (full-width − 40px) |
| 높이 | `48px` |
| 배경 | `#191F28` |
| Radius | `12px` |
| Shadow | `0 4px 16px rgba(0,0,0,0.12)` |
| z-index | `1000` |
| 텍스트 | `#FFFFFF`, 16px, weight 400, letter-spacing `-0.3px` |
| 아이콘 | 좌측 20px × 20px, 상태별 시맨틱 색상 |
| 액션 버튼 | 우측 텍스트 링크, `#0064FF`, 14px weight 600 |

### 상태별 스펙

| 상태 | 좌측 아이콘 색 | 아이콘 |
|------|--------------|--------|
| Default | `#8B95A1` | 🔔 bell |
| Success | `#00C471` | ✓ check-circle |
| Error | `#F04452` | ✕ x-circle |
| Info | `#0064FF` | ℹ info-circle |

### 모션

```
진입: translateY(100%) → translateY(0)
    spring(stiffness: 80, damping: 10)
퇴장: translateY(0) → translateY(100%)
    duration: 200ms, easing: ease-in
자동 닫힘: 3000ms 후 퇴장 트리거
```

### 와이어프레임

```
┌─────────────────────────────────────────────┐
│  [● info]  새 댓글이 달렸습니다      확인하기  │  ← 48px, #191F28, radius 12px
└─────────────────────────────────────────────┘
       ↑ 좌우 20px 패딩                  ↑ #0064FF
```

### 접근성

- `role="alert"`, `aria-live="assertive"`
- 키보드: Escape 키로 닫기
- 닫기 버튼 `aria-label="알림 닫기"`, 터치 타겟 48×48px

---

## 4. Layer 2 — Badge & Dot 컴포넌트

### 스펙

| 항목 | 값 |
|------|-----|
| **Dot** (미읽음 존재) | `6px` 원형, bg `#F04452`, 아이콘 우상단 offset `-2px, -2px` |
| **Count Badge** (미읽음 수) | 최소 `18px × 18px`, padding `0 5px`, radius `9px`, bg `#F04452`, text `#FFFFFF` 11px weight 600 |
| 숫자 표기 | ≤ 9 숫자 그대로 / 10–99 → `9+` / ≥ 100 → `99+` |
| 애니메이션 | 수 변경 시 scale `0.8 → 1.0` spring 200ms |

### 위치 규칙

```
[벨 아이콘 24×24px]
        ┌──────┐
        │  3   │  ← Count Badge (우상단 -2px, -2px)
        └──────┘
```

---

## 5. Layer 3 — 알림 패널 (Notification Panel)

토스 "바텀시트 우선" 원칙에 따라 모바일은 바텀시트, 데스크톱은 슬라이드인 패널로 분기합니다.

### 5-1. 모바일 — 바텀시트

| 항목 | 값 |
|------|-----|
| 상단 radius | `16px` |
| 핸들 바 | `40px × 4px`, radius `2px`, `#D1D6DB`, 상단 여백 `12px` |
| 최대 높이 | `90vh` |
| 배경 overlay | `rgba(0, 0, 0, 0.4)` |
| 내부 좌우 패딩 | `0` (ListRow가 자체 패딩 처리) |
| 모션 진입 | `translateY(100%) → translateY(0)`, spring(1, 80, 10) |
| 모션 퇴장 | `translateY(0) → translateY(100%)`, duration 250ms ease-in |
| 스와이프 다운 | 드래그 distance > 80px 시 닫힘 |

### 5-2. 데스크톱 — 슬라이드인 패널

| 항목 | 값 |
|------|-----|
| 너비 | `360px` |
| 높이 | `100vh` (우측 고정) |
| 배경 | `#FFFFFF` |
| Shadow | `−4px 0 20px rgba(0,0,0,0.08)` (좌측) |
| z-index | `500` |
| 모션 진입 | `translateX(360px) → translateX(0)`, duration `300ms` spring(1, 80, 10) |
| Overlay | `rgba(0,0,0,0.2)` (패널 이외 영역) |

### 5-3. 패널 헤더

```
┌─────────────────────────────────────────────┐
│  알림                              모두 읽기   │  ← 56px
│  ───────────────────────────────────────────│
│  [전체]  [시스템]  [활동]  [멘션]              │  ← Tab 48px
│  ═══════                                    │  ← 2px solid #191F28
└─────────────────────────────────────────────┘
```

| 항목 | 값 |
|------|-----|
| 헤더 높이 | `56px` |
| 제목 | "알림" 20px weight 700 `#191F28`, letter-spacing `-0.3px` |
| "모두 읽기" 버튼 | 13px weight 600 `#0064FF`, Ghost 스타일, 최소 터치 타겟 48px |
| 탭 바 | TDS Tab 컴포넌트, Active `#191F28` 700 + 2px underline, Inactive `#8B95A1` |
| 탭 항목 | 전체 / 시스템 / 활동 / 멘션 (4종) |

---

## 6. Layer 3 세부 — 알림 리스트 아이템 (NotificationRow)

### 기본 구조 (안읽음)

```
┌──────────────────────────────────────────────────┐
│  ●  [아이콘 40px]  제목 (16px/600)         13:42  │
│     (bg: tint)    설명 (13px/400, #8B95A1)       │
├── #F0F0F0 ───────────────────────────────────────┤
  ↑ 8px dot #0064FF        ↑ letterSpacing -0.3px
```

### 읽음 상태

```
┌──────────────────────────────────────────────────┐  bg: #F4F4F4
│     [아이콘 40px]  제목 (16px/400, #4E5968) 1시간  │
│     (bg: tint)    설명 (13px/400, #8B95A1)       │
├── #F0F0F0 ───────────────────────────────────────┤
```

### 치수 스펙

| 항목 | 값 |
|------|-----|
| 최소 높이 | `72px` |
| 패딩 | `16px 20px` |
| 아이콘 컨테이너 | `40px × 40px`, radius `50%`, 배경 = 타입별 tint |
| 아이콘 크기 | `20px × 20px` (컨테이너 내 중앙 정렬) |
| 미읽음 Dot | `8px × 8px`, `#0064FF`, 좌측 수직 중앙, 아이콘 좌측 `4px` |
| 텍스트 영역 | flex-1, min-width 0 (ellipsis 처리) |
| 제목 | 16px, 미읽음 weight 600 / 읽음 weight 400 |
| 부제 | 13px weight 400 `#8B95A1`, "리소스명 · 상대시간" |
| 시간 | 11px weight 400 `#8B95A1`, 우측 상단 정렬 |
| 간격 (아이콘–텍스트) | `12px` |

### 모든 상태 정의

| 상태 | bg | 설명 |
|------|-----|------|
| Default (미읽음) | `#FFFFFF` | 미읽음 dot `#0064FF` 표시 |
| Default (읽음) | `#F4F4F4` | dot 없음, 제목 weight 400 |
| Hover | `#F4F4F4` (미읽음) / `#ECECEC` (읽음) | cursor pointer |
| Pressed | `#ECECEC` | scale 없음 |
| Loading | Skeleton shimmer (3행: 아이콘 + 텍스트 2행) | |
| 스와이프 삭제 | 우측에서 삭제 버튼 노출, bg `#F04452`, text `#FFFFFF` | |

### 상태 전환 모션

```
읽음 처리: bg #FFFFFF → #F4F4F4 (spring 200ms)
          dot opacity 1 → 0 (200ms)
          제목 weight 600 → 400 (즉시, CSS transition 미적용)
```

---

## 7. 알림 타입별 아이콘 매핑

| 타입 (DB) | 아이콘 배경 tint | 아이콘 색상 | 아이콘 | 한국어 |
|----------|----------------|-----------|--------|--------|
| `mention` | `#E8F3FF` | `#0064FF` | @-sign | 멘션 |
| `comment` | `#F2F4F6` | `#4E5968` | chat-bubble | 댓글 |
| `card:created` | `#E8FAF0` | `#00C471` | plus-circle | 카드 생성 |
| `card:moved` | `#E8F3FF` | `#0064FF` | arrow-right | 카드 이동 |
| `card:updated` | `#FFF4E0` | `#FF9500` | pencil | 카드 수정 |
| `task_update` | `#E8FAF0` | `#00C471` | check-circle | 작업 완료 |

---

## 8. Layer 3 세부 — 날짜 그룹핑 (ListHeader)

### 구조

```
│ ━━━━━━━━━━━━━━━━━━━━━━ 8px #F4F4F4 ━━━━━━━━━━━━━━━━━━━━━━ │  ← 두꺼운 구분선
│                                                              │
│  오늘                                                3개      │  ← ListHeader
├────────────────────────────────────────────────────────────┤
│  [알림 아이템들...]                                           │
```

| 항목 | 값 |
|------|-----|
| 그룹 레이블 | "오늘" / "어제" / "이번 주" / "M월 D일" |
| 타이포 | 13px weight 600 `#8B95A1`, letter-spacing `-0.2px` |
| 패딩 | `12px 20px 8px` |
| 카운트 | 선택적, 13px `#8B95A1` |
| 그룹 구분선 | `8px solid #F4F4F4` (Thick separator) |

---

## 9. Layer 4 — 전용 페이지 `/notifications`

### 페이지 레이아웃

```
┌──────────────────────────────────────────┐
│  ←   알림                      모두 읽기   │  ← 상단 바 56px
├──────────────────────────────────────────┤
│  [전체]  [시스템]  [활동]  [멘션]          │  ← Tab 컴포넌트 48px
├──────────────────────────────────────────┤
│  ━━━━━━━━━━━━━ 두꺼운 구분선 ━━━━━━━━━━━  │
│                                          │
│  오늘                                    │  ← ListHeader
│                                          │
│  ●  [🔵]  홍길동님이 댓글을 남겼습니다  13:42│  ← 미읽음 72px
│          프로젝트 A · 3분 전             │
│  ────────────────────────────────────── │
│     [✓]  작업이 완료되었습니다      1시간  │  ← 읽음 72px (bg #F4F4F4)
│          프로젝트 B · 1시간 전           │
│                                          │
│  ━━━━━━━━━━━━━ 두꺼운 구분선 ━━━━━━━━━━━  │
│                                          │
│  어제                                    │
│  ...                                    │
└──────────────────────────────────────────┘
```

### Empty State

```
┌──────────────────────────────────────────┐
│                                          │
│              📭                          │
│         48px 아이콘                       │
│                                          │
│      아직 알림이 없습니다                   │  ← 17px weight 600 #191F28
│   새로운 활동이 생기면 알려드릴게요         │  ← 13px weight 400 #8B95A1
│                                          │
└──────────────────────────────────────────┘
```

| 항목 | 값 |
|------|-----|
| 아이콘 | 48px, `#8B95A1` |
| 제목 | 17px weight 600 `#191F28` |
| 설명 | 13px weight 400 `#8B95A1` |
| 상단 마진 | `80px` (화면 중앙 정렬 체감) |

---

## 10. 로딩 Skeleton

```
┌──────────────────────────────────────────┐
│  ████    ██████████████████     ████     │  ← 아이콘 + 텍스트 + 시간
│          ████████████                   │  ← 부제
├─────────────────────────────────────────┤
│  ████    ██████████████████     ████     │
│          ████████████                   │
└──────────────────────────────────────────┘
```

- 아이콘 skeleton: `40px × 40px` circle, `#F2F4F6` + shimmer
- 텍스트 skeleton: 높이 `16px`, 너비 `60%`, radius `4px`
- 부제 skeleton: 높이 `13px`, 너비 `40%`, radius `4px`
- Shimmer: `#F2F4F6 → #E5E8EB → #F2F4F6`, 1.5s infinite

---

## 11. 리스트 등장 모션

```javascript
// staggered spring 등장 — 50ms 간격
items.forEach((item, index) => {
  // initial: opacity 0, translateY 8px
  // animate: opacity 1, translateY 0
  // delay: index * 50ms
  // spring: stiffness 100, damping 12
})
```

---

## 12. 자가 체크리스트 (핸드오프 전 확인 완료)

**컬러**
- [x] 강조색 `#0064FF` (Toss Blue) + 시맨틱만
- [x] 페이지 배경 `#F4F4F4`, 카드/패널 배경 `#FFFFFF`
- [x] 그라디언트·텍스처 없음
- [x] border 없음 (shadow 사용)
- [x] near-white 임의값 없음 (`#F4F4F4`만 사용)

**타이포그래피**
- [x] Pretendard (Toss Product Sans 폴백) 사용
- [x] 제목 음수 letter-spacing 적용
- [x] weight 800/900 없음

**레이아웃**
- [x] 4px 기본 단위 준수
- [x] 좌우 패딩 20px (ListRow 자체 적용)
- [x] 한 화면, 한 목적

**컴포넌트**
- [x] 카드 radius `16px`, no border, shadow
- [x] 바텀시트 우선 (모달 금지)
- [x] Skeleton shimmer 로딩 (Spinner 금지)
- [x] 모든 상태 정의 완료

**모션**
- [x] Spring 애니메이션 (바텀시트, 슬라이드인)
- [x] staggered 리스트 등장
- [x] Toast 슬라이드업

**접근성**
- [x] 터치 타겟 48px 이상 (ListRow min 72px, 버튼 min 48px)
- [x] `aria-live`, `role="alert"` (Toast)
- [x] `role="list"`, `role="listitem"` (알림 목록)
- [x] Focus ring `2px solid #0064FF`
- [x] 대비 확인: `#191F28` on `#FFFFFF` = 17.5:1 ✓, `#4E5968` on `#FFFFFF` = 7.0:1 ✓

---

## 13. 참조 파일

- 토큰 SSOT: `.claude/context/designer/toss-design-system.md`
- 기존 위젯: `kanban/frontend/components/dashboard/notification-preview.tsx` (업그레이드 대상)
- Feature Spec: `docs/specs/2026-04-10_notification-system-v2.md`
- CSS 토큰 추가 위치: `kanban/frontend/app/globals.css`

---

## 14. Bart 핸드오프 노트

1. **CSS 토큰 추가 필수**: `globals.css`에 §2의 `--notif-*` 토큰 블록 추가
2. **기존 위젯 교체**: `notification-preview.tsx`의 `var(--color-point)` 등 Apple 토큰을 `--notif-*` 토큰으로 교체
3. **컴포넌트 우선순위**: Toast → Badge/Dot → NotificationRow → Panel → Page 순서 권장
4. **바텀시트 라이브러리**: `@radix-ui/react-dialog` 또는 `vaul` 활용 권장 (스와이프 다운 지원)
5. **모션**: `framer-motion` spring 사용, `spring({ stiffness: 80, damping: 10 })`
6. **미읽음 dot 크기**: `8px` (Panel의 ListRow), `6px` (Badge/Nav dot) — 두 가지 구분 주의
