# AI 법률 서비스 MVP — UI 스펙
> 작성일: 2026-04-05
> 작성자: Krusty (Designer)
> 핸드오프 대상: Bart (Frontend)
> 기반: ai-legal-service Feature Spec

---

## 0. 서비스 디자인 기반

### 브랜드 컬러 (신규 서비스 정의)
| 토큰 | Hex | 용도 |
|------|-----|------|
| `--primary` | `#2563EB` | CTA 버튼, 강조, 링크 |
| `--primary-hover` | `#1D4FD8` | 버튼 hover 상태 |
| `--primary-subtle` | `#EFF6FF` | 배경 강조 (라이트) / `#1C2A4A` (다크) |

> 근거: 법률 서비스는 "신뢰(Trust)"가 핵심. Navy-Blue 계열이 권위·안정감을 전달. 신규 토큰으로 정의.

### 다크 모드 배경 (Blue 계열 → 네이비 틴트)
| 레이어 | 토큰 | Hex | 용도 |
|--------|------|-----|------|
| Level 0 | `--bg-base` | `#0B0F1A` | 페이지 배경 |
| Level 1 | `--bg-header` | `#141929` | Header, Sidebar |
| Level 2 | `--bg-card` | `#1C2236` | 카드 배경 |
| Level 3 | `--bg-input` | `#252D42` | Input, Sub-card |

### 텍스트 컬러 (다크 모드 기준)
| 토큰 | Hex | 용도 |
|------|-----|------|
| `--text-primary` | `#F0F4FF` | 제목·본문 |
| `--text-secondary` | `#9AAAC4` | 보조·설명 |
| `--text-tertiary` | `#5C6E8A` | 힌트·비중 낮음 |
| `--text-disabled` | `#3A4A60` | 비활성 UI |
| `--text-brand` | `#60A5FA` | 강조 (포인트컬러 라이트 버전) |
| `--text-danger` | `#EC2D30` | 에러·삭제 |
| `--text-success` | `#0C9D61` | 성공·확인 |
| `--text-warning` | `#FE9B0E` | 경고 |

### 면책 고지 컬러 (전 화면 공통)
```
--disclaimer-bg: #1C2236 (bg-card와 동일, 별도 border로 구분)
--disclaimer-border: #FE9B0E (warning — 법적 경고 성격)
--disclaimer-text: #9AAAC4 (secondary)
```

### 타이포그래피
- Font: Pretendard (단일)
- 정보 계층: Size + Weight 함께 사용
- 최소 본문: 16px (접근성 — 법률 서비스 40-60대 사용자 고려)

### Border Radius
| 맥락 | 값 |
|------|-----|
| 메인 CTA 버튼 (pill) | `9999px` |
| 카드 | `16px` |
| 카드 내부 / Input | `12px` |
| Badge / Tag | `8px` |
| Small Button | `8px` |

### 요금제 표시 컴포넌트 (전역)
- 구독: `₩39,000/월`
- 건별: `₩9,900/건`
- 위치: Header 우측, 문서 생성 시 결제 게이트

---

## 1. 온보딩 화면 (Onboarding)

### 아키타입
Type E (Utility) → Wizard 3-step

### 레이아웃

**Desktop (≥1024px)**
```
┌─────────────────────────────────────────────────────┐
│ [Logo: AI법률] [로그인] [시작하기 — pill, primary]  │  Header (--bg-header, backdrop-blur)
├─────────────────────────────────────────────────────┤
│                                                     │
│          ● ─── ○ ─── ○   ← Step Indicator          │
│        Step 1 Step 2 Step 3                         │
│                                                     │
│  ┌─────────────────────── max-w: 560px ──────────┐  │
│  │  H3 Bold  법률 문제 유형을 선택해주세요        │  │  카드 (--bg-card, radius 16px)
│  │  Body Sm  어떤 상황이신가요?                   │  │
│  │                                               │  │
│  │  [노동·임금] [계약·거래] [임대차] [이혼·가족]  │  │  ← Category Pills (grid 2×2)
│  │  [형사] [손해배상] [상속] [기타]              │  │
│  │                                               │  │
│  │  [다음 단계 →]  ← pill, primary, full-width   │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Mobile (< 768px)**
- Header: 로고 + 햄버거만 (Step Indicator 유지)
- 카드: 좌우 패딩 16px, full-width
- Category: grid 2×2 유지 (터치 타겟 min-height 56px)

### 컴포넌트 상세

#### Step Indicator
```
• Active:  ● filled, --primary, 크기 12px
• Done:    ✓ filled, --text-success
• Pending: ○ border-only, --text-tertiary
• 연결선: 1px, --bg-input
```

#### Category Card (선택 항목)
```
상태          배경             Border              텍스트
Default      --bg-input       1px --bg-input      --text-secondary
Hover        --bg-input       1px --primary        --text-primary
Selected     --primary-subtle 1px --primary        --primary (bold)
```
- 크기: min-height 64px (mobile: 56px), border-radius 12px
- 아이콘: 24px, 좌측 배치
- 텍스트: Body 16px Medium

#### CTA Button (다음 단계)
- Component: `<Button variant="primary" size="lg" fullWidth pill>`
- 비활성 조건: 카테고리 미선택 시 disabled 처리
- 텍스트: "다음 단계 →" / 마지막 step: "분석 시작"

---

### Step 2: 상황 상세 입력

```
┌───────────────────────────────────────────────┐
│ ← 이전  [노동·임금] ✓  ●●○  상황 상세 입력   │
│                                               │
│ SubCard ─────────────────────────────────────│  --bg-input, radius 12px
│  Label: 어떤 일이 있었나요?                   │
│  [Textarea 4행 — 자유 기술]                   │
│  Caption: 상세할수록 더 정확한 분석이 됩니다   │  --text-tertiary
├───────────────────────────────────────────────│
│  Label: 발생 시점                             │
│  [DatePicker Input]                           │
├───────────────────────────────────────────────│
│  Label: 관련 금액 (선택)                      │
│  [Input type="number" suffix="원"]            │
└───────────────────────────────────────────────┘

[다음 단계 →]  ← pill CTA
```

#### Input 컴포넌트
- `<Input>` 컴포넌트
- Focus: border `--primary`, 1px solid
- Error: border `--text-danger`, 하단 에러 메시지 12px

---

### Step 3: 요금제 확인 및 시작

```
┌───────────────────────────────────────────────┐
│  ●●●  시작 전 확인해주세요                    │
│                                               │
│  [구독 플랜 카드]  ←─ --bg-card, border primary│
│   ₩39,000/월                                 │
│   • 무제한 AI 상담                            │
│   • 케이스 대시보드                           │
│   • 판례 분석 무제한                          │
│  [구독 시작 →]                               │
│                                               │
│  또는                                         │
│                                               │
│  [건별 결제 카드]  ←─ --bg-card              │
│   ₩9,900/건                                  │
│   • 이번 건만 분석                            │
│  [건별로 시작 →]                             │
│                                               │
│ ┌─────────────────────────────────────────┐   │  면책 고지
│ │ ⚠ 이 서비스는 법률 정보를 제공하며,    │   │  border-left: 3px --text-warning
│ │   변호사의 법률 자문을 대체하지 않습니다.│   │  bg: --bg-card
│ └─────────────────────────────────────────┘   │
└───────────────────────────────────────────────┘
```

---

## 2. AI 판단 화면 (Analysis Result)

### 아키타입
Type B (Task) — 좌우 분할 (Desktop) / 스택 (Mobile)

### 레이아웃

**Desktop (≥1024px)**
```
┌─────────────────────────────────────────────────────────────────┐
│ [Logo] [케이스명: 임금체불 #2024-001]  [대시보드] [내 계정 ▾]  │  Header
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─── 좌 패널 (40%) ───────┐  ┌─── 우 패널 (60%) ────────────┐ │
│  │                         │  │                               │ │
│  │  [분석 요청 정보]        │  │  [승소 가능성 게이지]         │ │
│  │  카테고리: 노동·임금     │  │                               │ │
│  │  상황 요약 텍스트        │  │   70%                         │ │
│  │  발생일: 2024-01-15      │  │   ████████████░░░░░           │ │
│  │                         │  │   --text-success (70% 이상)   │ │
│  │  ─────────────────       │  │                               │ │
│  │  [대화 히스토리]         │  │  [분석 근거]                  │ │
│  │  AI: 안녕하세요...       │  │  판례 기반 3건 인용           │ │
│  │  나: 퇴직금을 못 받았어요│  │  • 대법원 2019다12345         │ │
│  │  AI: 판례 분석 결과...   │  │  • 서울고법 2021나67890       │ │
│  │                         │  │                               │ │
│  │  ─────────────────       │  │  [관련 법령]                  │ │
│  │  [입력창]               │  │  근로기준법 제36조, 제37조     │ │
│  │  [추가 질문 입력...]     │  │                               │ │
│  │  [전송 ↑]               │  │  [추천 다음 액션]             │ │
│  │                         │  │  [내용증명 생성 →] pill-primary│ │
│  └─────────────────────────┘  │  [변호사 연결 →] pill-outline  │ │
│                               └───────────────────────────────┘ │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐   │  면책 고지 — 화면 하단 고정
│  │ ⚠ AI 분석은 법률 정보 제공 목적이며, 실제 법률 자문이    │   │
│  │   아닙니다. 중요한 결정 전 반드시 변호사와 상담하세요.    │   │
│  └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

**Mobile (< 768px)**
- 우 패널 (승소 가능성 게이지 + 분석 근거) → 상단
- 좌 패널 (대화 UI) → 하단 (입력창 fixed bottom)
- 면책 고지 → 분석 결과 카드 하단에 인라인 배치

### 컴포넌트 상세

#### 승소 가능성 게이지
```
70% 이상: --text-success (#0C9D61)
40~69%:   --text-warning (#FE9B0E)
40% 미만: --text-danger  (#EC2D30)

구조:
  H2 Bold [수치%]
  Body Sm "판례 기반 승소 가능성"
  Progress Bar: height 8px, border-radius 9999px
    filled: 해당 semantic color
    track:  --bg-input
```

#### 판례 인용 카드
```
--bg-input, border-radius 12px, padding 16px
왼쪽: [법원 Badge] 대법원 / 고등법원 / 지방법원
제목: Body Bold [판례번호]
날짜: Caption --text-tertiary
요약: Body Sm --text-secondary (2줄 말줄임)
링크: Body Sm --text-brand "원문 보기 →" (외부 링크)
```
- 상태: Default / Hover (`GrayAlpha.50` 4% 오버레이)

#### AI 채팅 버블
```
AI 메시지:
  배경: --bg-card, border-radius 0 16px 16px 16px
  출처 표시: Caption --text-brand "[판례 #1]" 클릭 시 팝오버
  신뢰도 Badge: "높음/중간/낮음" — success/warning/danger

사용자 메시지:
  배경: --primary-subtle, border-radius 16px 0 16px 16px
  텍스트: --text-primary

스트리밍 중:
  Skeleton 컴포넌트 3행
```

#### 입력창 (채팅)
```
<Input>
  placeholder: "추가로 궁금한 점을 입력하세요..."
  suffix: [전송 버튼] Icon, --primary, 터치 타겟 44px
  border-radius: 9999px (pill)
  max-height: 120px (multiline auto-grow)
```

---

## 3. 문서 생성 화면 (Document Generation)

### 아키타입
Type B (Task) — Wizard 2-step + Preview

### 레이아웃

**Desktop (≥1024px)**
```
┌─────────────────────────────────────────────────────────────────┐
│ [Logo] [케이스: 임금체불 #001]  [대시보드] [내 계정 ▾]         │  Header
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌── 좌: 입력 폼 (45%) ───────┐  ┌── 우: 실시간 미리보기 (55%)─┐│
│  │                            │  │                             ││
│  │  ●─── ○   Step Indicator   │  │  [문서 미리보기]             ││
│  │  문서 설정  최종 확인       │  │                             ││
│  │                            │  │  내용증명                    ││
│  │  [문서 유형 선택]           │  │  ─────────────              ││
│  │  ○ 내용증명  ○ 계약서       │  │  발신인: 홍길동              ││
│  │  ○ 고소장   ○ 합의서        │  │  수신인: ○○회사              ││
│  │                            │  │  발송일: 2026-04-05          ││
│  │  [발신인 정보]  --bg-input  │  │                             ││
│  │  이름: [Input]             │  │  제목: 미지급 임금 지급       ││
│  │  주소: [Input]             │  │       촉구에 관한 내용증명   ││
│  │  연락처: [Input]           │  │                             ││
│  │                            │  │  본문 (AI 생성): ...         ││
│  │  [수신인 정보]  --bg-input  │  │                             ││
│  │  이름/법인명: [Input]      │  │  [편집 가능 영역]            ││
│  │  주소: [Input]             │  │                             ││
│  │                            │  │  ─────────────              ││
│  │  [청구 내용]               │  │  ⚠ 법적 자문 아님 고지       ││
│  │  금액: [Input 원]          │  │                             ││
│  │  사유: [Textarea]          │  │  [문서 다운로드 PDF ↓]       ││
│  │                            │  │  pill, outline              ││
│  │  [다음 단계 →]  pill-primary│  └─────────────────────────────┘│
│  └────────────────────────────┘                                 │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │  결제 안내
│  │ 💳 건별 결제: ₩9,900  [결제 후 다운로드 →]  pill-primary │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

**Mobile (< 768px)**
- 입력 폼 전체 너비
- 미리보기: "미리보기 보기" 버튼 → Bottom Sheet 슬라이드업
- 결제 바: fixed bottom (safe-area-inset-bottom 고려)

### 컴포넌트 상세

#### 문서 유형 선택 (Radio Card)
```
상태          배경             Border              아이콘
Default      --bg-input       1px --bg-input      --text-tertiary
Hover        --bg-input       1px --primary        --text-secondary
Selected     --primary-subtle 1px --primary        --primary
```
- 크기: min-height 72px, border-radius 12px
- 구성: 아이콘(24px) + 제목(Body Bold) + 설명(Caption, --text-secondary)
- 문서 유형: 📄 내용증명 / 📑 계약서 / ⚖️ 고소장 / 🤝 합의서

#### 실시간 미리보기
```
--bg-card, border-radius 16px, padding 24px
overflow-y: auto (max-height: calc(100vh - 200px))

문서 내용:
  폰트: 14px Regular, line-height 1.7 (문서 가독성)
  AI 생성 구간: 배경색 --primary-subtle 하이라이트
  편집 가능: contentEditable, focus border --primary

생성 중 상태:
  Skeleton 컴포넌트, 5행 (문서 본문 영역)
  Caption "--text-tertiary" "AI가 문서를 작성 중입니다..."
```

#### 결제 배너
```
--bg-card, border: 1px solid --primary, border-radius 16px
Left: 💳 Body Bold "₩9,900 / 건"
Right: <Button variant="primary" size="sm" pill> "결제 후 다운로드 →"
```

#### 다운로드 버튼 (결제 완료 후)
```
<Button variant="outline" size="md" pill fullWidth>
  "PDF 다운로드 ↓"
```

---

## 4. 케이스 대시보드 (Case Dashboard)

### 아키타입
Type C (Dashboard) — 사이드바 + 메인 콘텐츠

### 레이아웃

**Desktop (≥1024px)**
```
┌─────────────────────────────────────────────────────────────────┐
│ [Logo] AI법률                         [새 케이스 + ]  [계정 ▾]  │  Header (--bg-header)
├──────────────────┬──────────────────────────────────────────────┤
│                  │                                              │
│  사이드바 (240px)│  메인 (나머지)                               │
│  --bg-header     │  --bg-base                                   │
│                  │                                              │
│  📊 대시보드     │  안녕하세요, 홍길동님   Body Bold            │
│  ⚖️ 내 케이스   │  진행 중인 케이스 3건   Caption --secondary  │
│  📄 문서함       │                                              │
│  ❓ 도움말       │  ┌── KPI 카드 그리드 (3열) ─────────────────┐│
│                  │  │ [진행 중 3] [완료 5] [이번달 ₩39,000]   ││
│  ─────────────   │  └──────────────────────────────────────────┘│
│                  │                                              │
│  구독 현황       │  케이스 목록                                 │
│  ₩39,000/월      │  ┌──────────────────────────────────────────┐│
│  갱신: 05/05     │  │ [필터: 전체▾] [상태▾] [날짜▾] [검색 🔍]││
│  [플랜 관리 →]   │  ├──────────────────────────────────────────┤│
│                  │  │ 케이스 카드 리스트 (아래 상세)            ││
│                  │  │                                          ││
│                  │  └──────────────────────────────────────────┘│
│                  │                                              │
└──────────────────┴──────────────────────────────────────────────┘
```

**Mobile (< 768px)**
- 사이드바 → Bottom Tab Bar (5개 이하: 대시보드 / 케이스 / 문서 / 더보기)
- KPI 카드: 가로 스크롤 (스냅 슬라이더)
- 케이스 목록: 풀 너비 카드

### 컴포넌트 상세

#### KPI 카드 (3종)
```
--bg-card, border-radius 16px, padding 20px

[진행 중 케이스]
  Label: Caption --text-secondary "진행 중"
  Value: H3 Bold --text-primary "3"
  Sub: Body Sm --text-tertiary "건"
  Icon: ⚖️ (24px, --primary)

[완료 케이스]
  Label: Caption --text-secondary "완료"
  Value: H3 Bold --text-success "5"
  Sub: Body Sm --text-tertiary "건"
  Icon: ✅ (24px, --text-success)

[이번 달 결제]
  Label: Caption --text-secondary "이번 달"
  Value: H3 Bold --text-primary "₩39,000"
  Sub: Body Sm --text-tertiary "구독 중"
  Icon: 💳 (24px, --text-brand)
```

#### 케이스 카드
```
--bg-card, border-radius 16px, padding 20px
Hover: GrayAlpha.50 4% 오버레이 (cursor: pointer)

구조:
┌────────────────────────────────────────────────────┐
│ [카테고리 Badge] [상태 Badge]                [날짜]  │  ← top row
│ Body Bold "임금체불 — ○○회사 퇴직금 미지급"         │  ← title
│ Body Sm --text-secondary "분석 완료 · 승소가능성 70%" │  ← summary
│ [내용증명 생성됨 🗒] [판례 3건]                      │  ← 첨부 태그
└────────────────────────────────────────────────────┘
```

**카테고리 Badge**
```
<Badge> 컴포넌트
노동·임금: bg --primary-subtle, text --primary
임대차:    bg #1A3A2A, text #0C9D61
계약·거래: bg #2A1E40, text #A78BFA
형사:      bg #3A1A1A, text #EC2D30
```

**상태 Badge**
```
진행 중: bg --primary-subtle, text --primary, dot ●
분석 완료: bg #1A3A2A, text --text-success, dot ●
문서 생성됨: bg #1E2A3A, text --text-brand, dot ●
완료: bg --bg-input, text --text-tertiary, dot ○
```

#### 빈 상태 (케이스 없음)
```
Body Sm --text-tertiary "아직 케이스가 없습니다."
(일러스트, CTA 없음)
```

#### 사이드바 네비게이션
```
--bg-header, width 240px, padding-top 24px

메뉴 아이템:
  Default: Body --text-secondary, Icon --text-tertiary
  Hover: GrayAlpha.50 4% 오버레이
  Active: Body Bold --text-primary, Icon --primary,
          left border 3px --primary

구독 현황 박스 (사이드바 하단):
  --bg-card, border-radius 12px, padding 16px, margin 12px
  Label: Caption --text-secondary
  Value: Body Bold "₩39,000/월"
  갱신일: Caption --text-tertiary
  [플랜 관리]: Caption --text-brand, cursor pointer
```

---

## 5. 공통 컴포넌트

### Header (전 화면 공통)
```
--bg-header + backdrop-blur(12px)
height: 64px (mobile: 56px)
border-bottom: 1px solid rgba(255,255,255,0.06) — 약한 구분, strong border 금지

Left: Logo (28px height)
Center (mobile): 케이스명 또는 페이지명 (Body Bold)
Right:
  - 로그인 전: [로그인 텍스트] [시작하기 pill-primary]
  - 로그인 후: [새 케이스 + icon] [계정 아바타 ▾]
```

### 면책 고지 배너
```
공통 컴포넌트 <DisclaimerBanner>
배경: --bg-card
border-left: 3px solid --text-warning
padding: 12px 16px
아이콘: ⚠️ 18px, inline
텍스트: Body Sm --text-secondary
  "이 서비스는 법률 정보를 제공하며, 변호사의 법률 자문을 대체하지 않습니다.
   중요한 결정 전 반드시 전문 변호사와 상담하세요."

배치 규칙:
  - AI 판단 화면: fixed bottom, z-index 높음 (스크롤해도 보임)
  - 문서 생성: 미리보기 하단
  - 온보딩 Step 3: 요금제 선택 아래
```

### Toast / Snackbar
```
성공: "케이스가 생성되었습니다" → --text-success
에러: "분석에 실패했습니다. 다시 시도해주세요" → --text-danger
정보: "AI가 분석 중입니다..." → --text-brand (with Spinner)
위치: top-right (desktop) / top-center (mobile)
duration: 3000ms
```

---

## 6. 접근성 체크리스트

- [ ] 모든 인터랙티브 요소 터치 타겟 min 44px (법률 서비스 고령층 고려 48px 권장)
- [ ] 텍스트 입력 min 16px (iOS 줌 방지)
- [ ] 색상 대비 4.5:1 이상 (WCAG AA) — 특히 --text-secondary / --bg-card 조합 검증 필요
- [ ] 키보드 탐색 가능 (Tab 순서, Focus visible)
- [ ] 스크린 리더 aria-label: Badge, 게이지, 판례 인용 카드

---

## 7. Bart 핸드오프 체크리스트

- [ ] CSS 변수 (`--primary`, `--bg-base` 등) `globals.css`에 정의
- [ ] Pretendard 폰트 로드 (`next/font` 또는 CDN)
- [ ] 다크 모드 기본 설정 (법률 서비스 특성상 다크 우선)
- [ ] Tailwind config: `createTailwindConfig` from ui-kit-front 사용
- [ ] `<DisclaimerBanner>` 공통 컴포넌트 최우선 구현 (전 화면 필수)
- [ ] 게이지 컴포넌트: color threshold 로직 (70%↑ success / 40~69% warning / ~40% danger)
- [ ] 채팅 스트리밍: SSE 연결, Skeleton 로딩 상태
- [ ] 모바일: Bottom Sheet (문서 미리보기용), Bottom Tab Bar
- [ ] 결제 배너: fixed bottom, safe-area-inset-bottom
