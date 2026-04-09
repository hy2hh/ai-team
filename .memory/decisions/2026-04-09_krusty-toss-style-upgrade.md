# 결정: Krusty 에이전트 토스(Toss) 디자인 시스템으로 전면 전환

**날짜**: 2026-04-09
**참여자**: Marge(PM), Krusty(Designer), Bart(Frontend), Homer(Backend), Lisa(Researcher)
**회의**: #8

## 배경
- sid 요청: 토스 스타일 디자인을 생성하는 AI 에이전트 구현
- Lisa 리서치: 토스 TDS 스펙, 디자인 토큰, AI 에이전트 스타일 주입 best practice 조사 완료

## 결정 사항

### 1. 전면 교체 (병존 아닌 전환)
- **근거**: Apple과 토스 병존(dual system)은 디자인 일관성 파괴 + 매 작업마다 "어떤 시스템?" 판단 비용 발생
- 3명 전원 합의

### 2. 변경 범위

| 파일 | 변경 내용 |
|------|----------|
| `.claude/agents/designer.md` | Identity, 토큰, 절대 금지, Workflow 전면 교체 (Apple → Toss) |
| `.claude/context/designer/toss-design-system.md` | 신규 생성 — 토스 전체 스펙 (232줄+) |
| `.claude/context/designer/component-guide.md` | 전면 교체 — 의사결정 트리, 체크리스트, 토큰 값 |
| `.claude/context/designer/conventions.md` | 서비스 타입 기본값 블록 업데이트 |
| `.claude/context/designer/toss-design-guide.md` | Deprecated 제거, active 참조로 변경 |
| `.claude/context/designer/apple-design-system.md` | `archive/` 이동 (삭제 아닌 보존) |

### 3. 토스 핵심 디자인 토큰 (적용됨)

| 항목 | 값 |
|------|-----|
| Primary Blue | `#3182F6` |
| 페이지 배경 | `#F4F4F4` |
| 카드 배경 | `#FFFFFF` |
| 본문 텍스트 | `#191F28` |
| 카드 radius | `16px` |
| 버튼 radius | `12px` |
| 버튼 높이 | `54px` |
| 터치 타겟 | `48px` |
| 폰트 | Toss Product Sans (fallback: Pretendard) |
| Hero 크기 | `32px` |
| 네비게이션 | 모바일 하단 탭 바, 데스크톱 미니멀 상단 |
| 로딩 | Skeleton shimmer (Spinner 금지) |
| 모션 | Spring 애니메이션, 바텀시트, 카운트업 |
| 좌우 패딩 | `20px` |
| 섹션 간격 | `32px` |

### 4. 백엔드 영향
- 없음. API/DB 변경 불필요. 색상·테마는 전부 프론트엔드 CSS 토큰에서 처리.

### 5. Frontend 후속 작업 (Bart 담당, 별도 태스크)
- `globals.css` 시맨틱 토큰 재정의
- `tailwind.config.ts` 폰트·radius·spacing 업데이트
- shadcn/ui 테마 오버라이드 (버튼/인풋/카드)
- Spinner → Skeleton shimmer 전환
- 모달 → 바텀시트 패턴 마이그레이션
- Spring 애니메이션 유틸리티 구축

## 리스크
- Toss Product Sans 라이선스 확인 필요 (대체: Pretendard 오픈소스)
- shadcn/ui 버튼 54px 오버라이드 깊어질 수 있음
- 카드 기반 UI 패러다임은 레이아웃 구조 자체 변경 수반

---

## 회의 #9 추가 결정 (2026-04-09)

### 6. 3계층 토큰 구조 도입
- Base(원시값) → Semantic(의미) → Component(바인딩)
- Tailwind config는 Semantic 계층 참조
- `examples/design-tokens.md` Apple→토스 전면 재작성 완료

### 7. TDS 11종 컴포넌트 카탈로그
- Badge, Border, BottomCTA, Button, Asset, ListRow, ListHeader, Navigation, Paragraph, Tab, TopPager
- `component-guide.md` §6에 4섹션 축약 형태로 추가

### 8. Closed Token Layer
- `designer.md` :117에 허용 토큰 화이트리스트 추가
- LLM이 유사값(`#3B82F6` 등) 발명 차단

### 9. 컴포넌트 스펙 8섹션 템플릿
- `templates/component-spec.md` 신규 생성
- 메타데이터/개요/해부도/토큰/Props/상태/코드예제/교차참조

### 추가 수정 파일
| 파일 | 변경 |
|------|------|
| `examples/design-tokens.md` | Apple 1계층 → 토스 3계층 전면 재작성 |
| `designer.md` :117 | Closed Token Layer 화이트리스트 추가 |
| `component-guide.md` :210 | §6 TDS 11종 컴포넌트 카탈로그 추가 |
| `templates/component-spec.md` | 신규 — 8섹션 full 스펙 템플릿 |
