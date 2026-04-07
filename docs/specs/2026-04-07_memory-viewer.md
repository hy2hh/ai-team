# Feature Spec: .memory/ 뷰어 앱 (Obsidian 스타일)

**상태**: implemented
**작성자**: Marge  **날짜**: 2026-04-07
**담당 에이전트**: Frontend(Bart), Designer(Krusty)

---

## 문제
`.memory/` 파일시스템 기반 에이전트 공유 메모리를 웹 UI로 탐색·검색할 수 없어 운영 가시성이 부족하다. Obsidian 스타일의 뷰어로 문서 간 관계(백링크)와 구조를 직관적으로 파악할 수 있게 한다.

## 설계 결정
| 결정 | 선택한 방안 | 대안 | 선택 이유 |
|------|------------|------|----------|
| 프레임워크 | Next.js 16 + React 19 | Vite SPA | 칸반보드와 동일 스택, API Route 내장 |
| 포트 | 3002 | 3001 공유 | 칸반(3000)/백엔드(3001)와 독립 운영 |
| 상태관리 | Zustand | Context API | 칸반보드 패턴 일관성 |
| 마크다운 렌더링 | react-markdown + remark-gfm + rehype-highlight | MDX | 읽기 전용이므로 경량 선택 |
| 테마 | Bifrost 다크 테마 | 라이트/다크 토글 | 칸반보드 UI 일관성 |

## 인터페이스 계약
| 엔드포인트 | 메서드 | 요청 | 응답 | 에러 응답 |
|-----------|--------|------|------|----------|
| /api/files | GET | - | `FileNode[]` (트리 구조) | 500 |
| /api/files/[...path] | GET | path param | `{ content, metadata }` | 404 |
| /api/search?q= | GET | query string | `SearchResult[]` (max 50) | 400 |
| /api/backlinks?file= | GET | query string | `Backlink[]` | 400 |

## 구현 범위
### Phase 1 — 기본 뷰어 ✅ (완료)
- [x] 3-panel 레이아웃 (파일트리 | 마크다운뷰어 | 백링크/아웃라인)
- [x] 폴더별 색상 구분 (decisions, tasks, facts 등)
- [x] 전문 검색 (debounce 300ms, .md + .jsonl)
- [x] 백링크 패널 (파일 간 참조 관계)
- [x] 아웃라인 패널 (h1-h4 계층 추출)
- [x] 키보드 단축키 (⌘B, ⌘/, ⌘K)

### Phase 2 — Graph View (P1)
- [ ] 문서 간 참조 관계를 노드/엣지 그래프로 시각화
- [ ] 노드 클릭 시 해당 문서로 이동
- [ ] 폴더별 노드 색상 구분
- [ ] 줌/패닝 인터랙션

### Phase 3 — 인라인 편집 (P2, 향후)
- 마크다운 파일 직접 수정 지원

### 제외 (이번에 안 함)
- 실시간 파일 변경 감지 (WebSocket)
- 칸반보드 통합 네비게이션 (별도 스펙)

## 인수 조건 (Acceptance Criteria)

### Phase 1 Happy Path
- [x] Given 앱 시작 When localhost:3002 접속 Then 3-panel 레이아웃 렌더링
- [x] Given 파일트리 로드 When 폴더 클릭 Then 하위 파일 목록 토글
- [x] Given 파일 선택 When .md 파일 클릭 Then 마크다운 렌더링 + 메타데이터 표시
- [x] Given 검색 입력 When 키워드 입력 Then 300ms 후 검색 결과 표시 (최대 50건)
- [x] Given 파일 열림 When 백링크 탭 클릭 Then 해당 파일을 참조하는 문서 목록 표시

### Phase 1 에러 케이스
- [ ] Given .memory/ 비어있음 When 앱 접속 Then 빈 상태 안내 메시지 표시
- [ ] Given 존재하지 않는 파일 When API 호출 Then 404 응답 + UI 에러 표시
- [ ] Given 검색어 없음 When 빈 문자열 검색 Then 400 응답 또는 빈 결과

### Phase 2 Happy Path (Graph View)
- [ ] Given 앱 열림 When Graph View 탭 클릭 Then 노드/엣지 그래프 렌더링
- [ ] Given 그래프 표시 When 노드 클릭 Then 해당 문서가 메인 패널에 열림
- [ ] Given 그래프 표시 When 마우스 휠 Then 줌 인/아웃 동작
- [ ] Given 그래프 표시 When 노드 위에 호버 Then 파일명 + 연결 수 툴팁

## 참조 파일
- `memory-viewer/` — Phase 1 전체 구현
- `memory-viewer/app/api/backlinks/route.ts` — Graph View에서 재사용할 참조 관계 로직
- `memory-viewer/lib/types.ts` — 공유 타입 정의
- `kanban-board/` — UI 일관성 참조 (Bifrost 테마)

## 성공 기준
- [ ] Phase 1: `npm run build` 성공 + 런타임 에러 없음
- [ ] Phase 1: 에러 케이스 AC 전체 통과
- [ ] Phase 2: Graph View AC 전체 통과

## 메모
- Lisa 리서치: Obsidian UI/UX 분석 완료 (양방향 링크, Graph View WebGL, 4영역 레이아웃)
- Designer 색상 팔레트/컴포넌트 구조도 제공 완료
- 칸반보드(포트 3000)와 UI 일관성 유지 결정
