# Feature Spec: Memory Viewer 로그인 & 파일 편집 기능

**작성일**: 2026-04-07
**상태**: In Progress
**담당**: Krusty (디자인) → Bart (구현)

---

## 배경 & 목적

현재 Memory Viewer(포트 3002)는 인증 없이 누구나 접근 가능하고, 파일 읽기만 지원한다.
.memory/ 디렉토리의 에이전트 메모리 파일을 보호하고, 웹 UI에서 직접 편집할 수 있도록 한다.

---

## 요구사항

### 1. 인증 (Auth)

- 비로그인 상태로 모든 페이지 접근 시 `/login`으로 리다이렉트
- 로그인: 비밀번호 입력 방식 (환경변수 `MEMORY_VIEWER_PASSWORD` 또는 기본값)
- 세션: Next.js middleware + httpOnly 쿠키 (서버사이드 세션)
- 로그아웃: 쿠키 삭제 후 `/login` 리다이렉트
- Next.js `middleware.ts`로 모든 비-API 라우트 보호

### 2. 파일 편집 기능

- **파일 생성**: 새 .md 파일 생성 (경로 + 파일명 입력)
- **파일 수정**: 현재 뷰어에서 편집 모드 전환 (마크다운 에디터)
- **파일 저장**: PUT /api/files/[...path] API 추가

### 3. API 추가

기존 (읽기):
- GET /api/files — 파일 트리
- GET /api/files/[...path] — 파일 읽기

추가 (쓰기):
- PUT /api/files/[...path] — 파일 내용 저장 (create or update)
- POST /api/files — 새 파일 생성
- DELETE /api/files/[...path] — 파일 삭제 (선택사항)
- POST /api/auth/login — 로그인 (비밀번호 검증 → 쿠키 발급)
- POST /api/auth/logout — 로그아웃 (쿠키 삭제)

### 4. UI 변경

- `/login` 페이지 신규 (디자인 필요)
- 메인 페이지 상단: 로그아웃 버튼
- 마크다운 뷰어 우상단: "편집" 버튼 → 편집 모드 전환
- 편집 모드: textarea 또는 경량 마크다운 에디터
- 파일 트리: "새 파일" 버튼 추가

---

## 기술 결정

- **인증 방식**: 단순 비밀번호 + JWT 또는 signed cookie (복잡한 OAuth 불필요)
- **에디터**: `textarea` 기반 (CodeMirror 도입은 추후 검토)
- **세션 저장**: stateless (JWT in httpOnly cookie)

---

## 완료 조건

- [ ] 비로그인 시 `/login`으로 리다이렉트
- [ ] 로그인 성공 시 메인 대시보드 이동
- [ ] 파일 생성/수정/저장 동작 확인
- [ ] 디자인 시스템 토큰 사용 (Krusty 검토)
- [ ] QA(Chalmers) 검증 통과

---

## 파일 경로 참조

- 프론트엔드: `/Users/sid/git/ai-team/memory-viewer/`
- 컴포넌트: `/Users/sid/git/ai-team/memory-viewer/components/`
- API Routes: `/Users/sid/git/ai-team/memory-viewer/app/api/`
- 앱 스토어: `/Users/sid/git/ai-team/memory-viewer/stores/app-store.ts`
- 메인 페이지: `/Users/sid/git/ai-team/memory-viewer/app/page.tsx`
