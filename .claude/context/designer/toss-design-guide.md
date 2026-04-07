# Toss Design Guide

> 📋 실행 플레이북 — 토스 스타일 재현을 위한 디자인 원칙 가이드
> 수집 기준: 2026-04-07 | 출처: toss.tech, brand.toss.im, blog.toss.im

이 문서는 Krusty(Designer) 에이전트가 Toss 스타일 UI를 생성할 때 참고하는 기준 문서입니다.
ai-team 내부 대시보드, 칸반, 메모리 뷰어 등 내부 툴에 기본 적용됩니다.

---

## 1. 색상 팔레트 (Color System)

### 브랜드 컬러

| 이름 | Hex | 용도 |
|------|-----|------|
| Toss Blue | `#0064FF` | Primary CTA, 브랜드 강조 |
| Toss Gray | `#202632` | 텍스트, 다크 배경 |

> Toss Blue 공식: #0064FF (brand.toss.im 직접 확인). 앱 UI에서는 #1B64DA / #1F4EF5 변형도 사용됨 (WebSearch 기반 ⚠️)

### 시맨틱 컬러 토큰

토스는 **Target + Role + Variant** 3단 구조의 시맨틱 토큰 체계를 사용합니다.

```
fill.brand.default      → Toss Blue (#0064FF)
fill.brand.weak         → 연한 파랑 (배경, 선택 상태)
fill.neutral.default    → 기본 흰색/밝은 배경
fill.neutral.weak       → 섹션 구분 배경 (#F9FAFB 계열)

text.primary            → #202632 (최고 대비)
text.secondary          → #6B7684 계열 (보조 정보)
text.disabled           → #B0B8C1 계열

border.default          → #E8ECF0 계열
border.strong           → #C9CDD2 계열
```

### 컬러 스케일 원칙 (OKLCH 기반)

- OKLCH 색공간 적용 → 같은 스케일 번호 = 동일 인지 명도
- 라이트/다크 모드 1:1 자동 대응 별도 팔레트 운영
- 채도 단일 계열 사용 (파란색 계열로만 강약 표현, 다색 혼용 지양)

### 시맨틱 컬러 (성공/오류/경고)

| 상태 | 컬러 계열 | 용도 |
|------|----------|------|
| Success (수익/플러스) | 빨강 `#F04452` 계열 | 한국 금융 관례 — 상승은 빨간색 |
| Loss (손실/마이너스) | 파랑 `#0064FF` 계열 | 하락은 파란색 |
| Warning | 주황 계열 | 주의 알림 |
| Error | 빨강 계열 | 오류 상태 |
| Neutral badge | 그레이 배경 | 중립 상태 |

> 한국 금융 관례: 상승=빨강, 하락=파랑 (서구와 반대)

---

## 2. 타이포그래피 (Typography)

### 기본 서체

**Toss Product Sans** — 토스 자체 개발 서체 (산돌 + 이도타입 협업)
- 7가지 weight 지원
- 금융 맥락 최적화: %, 쉼표, 화살표, 수학 기호 재설계
- Proportional + Monospaced 숫자 지원

**대체 폰트**: `Pretendard` (오픈소스, 크로스플랫폼 권장 대안)

### 폰트 사이즈 계층

| 단계 | 크기 | Weight | 용도 |
|------|------|--------|------|
| Display | 30px | 700 (Bold) | 주요 금액, 히어로 숫자 |
| Title | 22~24px | 600 (Semibold) | 페이지 제목 |
| Body Large | 18~20px | 500 (Medium) | 주요 본문, 강조 정보 |
| Body | 16px | 400 (Regular) | 일반 본문 (가독성 최적) |
| Caption | 14px | 400 (Regular) | 보조 설명, 레이블 |
| Micro | 12px | 400 (Regular) | 날짜, 태그, 최소 정보 |

### 금액 표시 규칙

- 거액 표시 (잔액, 자산): **Monospaced 숫자** + Display 크기 + Bold
- 단일 강조 금액: Proportional 숫자 사용 가능
- 콤마 구분: `1,234,567원` 형식 (3자리 구분)
- 소수점: `1,234.56원` (주식/ETF 소수점 지원)
- 수익률: `+12.3%` / `-5.2%` — 빨강/파랑 컬러 적용
- 단위 "원" 또는 "₩": 금액 숫자 크기보다 작게 표시

### 행간 (Line Height)

- 한국어 본문: 1.6 (160%)
- 제목: 1.3 (130%)
- 숫자/금액 Display: 1.2

---

## 3. 컴포넌트 패턴

### 핵심 TDS 컴포넌트 목록

Badge, Border, BottomCTA, Button, Asset, ListRow, ListHeader, Navigation, Paragraph, Tab, Top

### 카드 (Card)

```
배경: white (#FFFFFF) 또는 fill.neutral.weak
border-radius: 16px (대형 카드) / 12px (중형) / 8px (소형)
padding: 20px (기본) / 16px (콤팩트)
shadow: 0px 2px 8px rgba(0,0,0,0.06) — 가벼운 그림자
```

- 카드 하나 = 하나의 정보 단위
- 과도한 정보 압축 금지 — 필요한 것만 노출
- 카드 내 버튼 컬러는 카드 대표 색상과 연동 가능

### 리스트 아이템 (ListRow)

```
높이: 56px (기본) / 72px (아이콘+2줄) / 48px (콤팩트)
left:   아이콘 or 썸네일 (40px 원형 기본)
center: 제목 (body) + 서브 (caption)
right:  금액 or 화살표 or 토글
divider: 전체 폭 또는 left-inset (아이콘 폭 제외)
```

### 버튼 (Button)

```
Primary CTA (BottomCTA):
  배경: #0064FF | 텍스트: white | 높이: 56px | border-radius: 12px | full-width

Secondary:
  배경: fill.neutral.weak 또는 outlined
  텍스트: text.primary

텍스트 버튼:
  배경: none | 텍스트: text.brand 또는 text.secondary

disabled:
  opacity: 0.4 또는 fill.neutral.weak + text.disabled
```

### Bottom Sheet

```
진입: 하단 슬라이드업 (translateY 트랜지션)
top border-radius: 20px
드래그 핸들: 상단 중앙 4px × 36px 라운드 바 (#E8ECF0)
딤 배경: rgba(0,0,0,0.4)
최대 높이: 화면의 90%
```

### 뱃지 (Badge)

```
진행중:  Toss Blue 연한 배경 + 파란 텍스트
완료:    그린 계열
취소/실패: 그레이 계열
주의:    오렌지/레드 계열
숫자 알림: 원형 최소 16px, 빨간 배경 + white 텍스트
```

---

## 4. 여백 / 레이아웃 철학

### 간격 단위 (Spacing Scale)

토스는 **4 또는 8 기반 배수** 간격 체계를 사용합니다.

```
4, 8, 12, 16, 20, 24, 32, 40, 48px
```

### 화면 여백 (Screen Padding)

```
메인 화면 좌우:   20px
섹션 구분 내부:   16px
카드 내부:        20px
리스트 좌우:      20px
```

### 정보 밀도 원칙

- **한 화면 = 한 목적** — 다중 목적 화면 지양
- 불필요한 정보 제거 우선 (의미 없는 단어, 반복 정보 삭제)
- 사용자 스캔 패턴 고려 (F-pattern, 좌→우 읽기)
- 스크롤보다 화면 단계 이동 선호 (명확한 CTA → 다음 단계)
- 여백을 **의도적으로 크게** 사용 (빽빽한 금융 UI 거부)

### 그리드

- 단일 컬럼 레이아웃 우선
- 2컬럼 그리드: 카드 쌍, 아이콘 그리드 등 제한적 사용
- 8px 그리드 기반 정렬

---

## 5. 인터랙션 / 애니메이션 원칙

### 기본 원칙

- **빠르고 자연스럽게** — 애니메이션이 UX를 방해하지 않아야 함
- 물리 기반(Spring) 애니메이션 선호 (linear easing 지양)
- 사용자 행동에 즉각 반응 (지연 최소화)

### 트랜지션 속도

```
Micro interaction (탭, 토글):    100~150ms
화면 전환:                        250~300ms
Bottom Sheet 슬라이드업:          350ms (ease-out)
모달 페이드인:                     200ms
```

### 피드백 패턴

- 버튼 탭: 즉각적 visual feedback (`scale(0.97)` 또는 `opacity: 0.8`)
- 카드 3D 인터랙션: 잡으면 회전 일시 정지 → 놓으면 자연 재개 (Spring)
- CTA 버튼 컬러: 현재 표시 중인 카드/콘텐츠 색상과 동기화

### 로딩 상태 (Skeleton UI)

```
배경: #F0F0F0 → #E0E0E0 shimmer
animation: 1.5s linear infinite
border-radius: 콘텐츠와 동일한 형태
Spinner보다 Skeleton 선호
```

### 메뉴 / 팝업 패턴

- Bottom Sheet: 하단에서 선택지 올라오는 기본 패턴
- **메뉴는 버튼 위치에서 직접 펼치기** 선호 — 물리적 거리 단축, A/B 테스트에서 클릭률 10% 향상
- OS 기본 컴포넌트 우선 활용 → 빠른 출시 우선

---

## 6. Financial UI 패턴

### 금액 표시 계층

```
총자산 / 잔액 (최상위):
  font-size: 28~32px | font-weight: 700 | Monospaced
  포맷: N,NNN,NNN원

변동금액 (2차):
  font-size: 16~18px | font-weight: 500
  수익: +N,NNN원 (빨강 #F04452)
  손실: -N,NNN원 (파랑 #0064FF)

퍼센트 (3차):
  font-size: 14px
  포맷: (+12.34%) 괄호 포함
```

### 진행 단계 (Step Indicator)

```
활성 단계:    Toss Blue filled circle + Bold 텍스트
완료 단계:    체크 아이콘 + 그레이 처리
미완료 단계:  빈 circle + 그레이 텍스트
연결선:       1px 그레이 수평선
```

### 거래 내역 리스트

```
Left:          서비스 로고 or 카테고리 아이콘 (40px 원형)
Center-top:    거래처명 (body, text.primary)
Center-bottom: 날짜/시간 (caption, text.secondary)
Right-top:     -N,NNN원 / +N,NNN원 (Bold + 컬러)
Right-bottom:  잔액 (caption, text.secondary)
```

### 상태 뱃지

| 상태 | 뱃지 스타일 | 텍스트 |
|------|------------|--------|
| 처리 중 | 주황 배경 | "처리중" |
| 완료 | 그린 배경 or 아이콘만 | "완료" |
| 실패/취소 | 그레이 배경 + 취소선 | "취소됨" |
| 주의 필요 | 빨강 강조 텍스트 | "확인 필요" |

---

## 7. 핵심 디자인 철학

1. **사용자 기만 없음** — 과장, 조작적 표현, 업계 용어 사용 금지
2. **명확한 언어** — 모든 사용자가 이해할 수 있는 쉬운 말
3. **한 화면 한 목적** — 집중을 방해하는 멀티 태스킹 UI 지양
4. **빠른 실험** — A/B 테스트로 검증, 완벽함보다 빠른 출시
5. **접근성 내재화** — 큰 텍스트 모드, 화면 읽기 기능 5원칙 준수
6. **일관성 우선** — 같은 컴포넌트는 모든 서비스에서 동일하게 동작

---

## 8. 참고 출처

- 토스 브랜드 리소스: https://brand.toss.im/
- TDS 컬러 시스템 업데이트 (7년만의 개편): https://toss.tech/article/tds-color-system-update
- 토스 프로덕트 산스 제작기: https://toss.im/tossfeed/article/beginning-of-tps
- 토스 디자인 시스템 원칙: https://toss.tech/article/toss-design-system
- 컴포넌트 설계 원칙: https://toss.tech/article/tds-component-making
- 카드 인터랙션 사례: https://toss.tech/article/touch-and-turn-tossbankcard
- 앱인토스 TDS 컴포넌트: https://developers-apps-in-toss.toss.im/design/components.html
