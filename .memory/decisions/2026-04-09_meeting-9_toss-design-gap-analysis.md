# 결정: 토스 디자인 시스템 잔여 갭 해소 (회의 #9)

**날짜**: 2026-04-09
**참여자**: Marge(PM), Krusty(Designer), Bart(Frontend), Homer(Backend)
**회의**: #9 (회의 #8 후속)

## 배경
회의 #8에서 Krusty를 Apple→토스 디자인 시스템으로 전면 전환 완료. 이후 Lisa 리서치에서 6개 갭 식별.

## 결정 사항

### 1. 색상 토큰 3계층 체계 도입 ✅
- Base(원시값) → Semantic(의미) → Component(바인딩) 3계층 구조 적용
- `examples/design-tokens.md` 전면 재작성 완료
- Tailwind config는 Semantic 계층 참조

### 2. TDS 11종 컴포넌트 카탈로그 추가 ✅
- `component-guide.md` §6에 4섹션 축약 형식으로 추가
- BottomCTA, Button, ListRow, ListHeader, Badge, Navigation, Tab, TopPager, Border, Asset, Paragraph
- 8섹션 full 템플릿: `templates/component-spec.md`

### 3. Closed Token Layer 전략 ✅
- `designer.md`에 "허용 토큰 범위" 화이트리스트 추가
- LLM이 유사값(`#3B82F6` 등) 발명 방지

### 4. 컴포넌트 스펙 템플릿 ✅
- `templates/component-spec.md` 신규 생성 (8섹션 full)
- 일반적으로는 §6의 4섹션 축약 사용, 필요 시 full 로드

### 5. 브랜드 컬러: `#3182F6` 유지 ✅
- `#0064FF`(brand.toss.im 공식)는 브랜드 아이덴티티(로고, 마케팅)용
- `#3182F6`은 토스 앱 제품 UI에서 실제 사용되는 블루
- "토스 스타일 디자이너" = 제품 UI 기준이므로 `#3182F6` 유지

### 6. 백엔드 영향: 없음 ✅
- 색상 매핑은 프론트엔드 CSS 토큰에서 처리 (Homer 확인)
- 멀티 디바이스 테마 동기화 필요 시 `user_preferences` API 추가 예정

## 변경 파일

| 파일 | 변경 |
|------|------|
| `examples/design-tokens.md` | 전면 재작성 — 3계층 구조 + Tailwind config 매핑 |
| `designer.md` | Closed Token Layer 화이트리스트 추가 |
| `component-guide.md` | §6 TDS 11종 컴포넌트 카탈로그 추가 |
| `templates/component-spec.md` | 신규 생성 — 8섹션 full 템플릿 |
