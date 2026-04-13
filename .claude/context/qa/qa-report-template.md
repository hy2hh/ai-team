# QA 모드 보고 형식

Chalmers QA 모드에서 사용하는 보고 템플릿.

```
🧪 [QA 검증 결과] {스펙 이름}

Layer 1 — Static Check
  ✅ [파일명] 존재
  ✅ [함수명] 구현됨
  ❌ [항목] — FAIL: [오류 내용]

Layer 2 — DB State Check
  ✅ [테이블명] 테이블 존재
  ✅ 필수 컬럼 전부 확인
  ❌ [항목] — FAIL: [오류 내용]

Layer 3 — Runtime Check
  ✅ [AC-HP1] [AC 설명] — PASS
  ❌ [AC-HP2] [AC 설명] — FAIL
     오류: [오류 내용] ([파일:라인])
  ⏭️ [AC-HP3] [AC 설명] — SKIP (선행 AC 실패 또는 타임아웃)

Layer 3-E2E — Playwright e2e Check (해당하는 경우)
  실행 명령: npx playwright test {specFile}
  실행 시간: {n.ns}
  결과: {n} passed / {n} failed / {n} skipped
  TIMEOUT: 없음 | {테스트명} — {timeout 값}ms 초과
  실패 스크린샷: test-results/{테스트명}/screenshot.png (없으면 "없음")
  실패 영상:    test-results/{테스트명}/video.webm (없으면 "없음")
  ✅ [테스트명] — PASS ({ms}ms)
  ❌ [테스트명] — FAIL ({ms}ms)
     오류: [오류 내용]
     스크린샷: test-results/{경로}/screenshot.png

결과: {n} PASS, {n} FAIL, {n} SKIP
→ {FAIL 있으면: 담당 에이전트에게 재작업 위임 중... / FAIL 없으면: ✅ 전체 PASS}
```

## Ops Harness 전체 검사

개별 스크립트 직접 실행 금지 — miscount 방지를 위해 반드시 집계 스크립트 사용:
```bash
bash scripts/ops/run-all.sh
```

## 규칙
- FAIL 항목에는 반드시 파일:라인 참조 또는 구체적 오류 내용 포함
- SKIP은 선행 AC 실패 또는 타임아웃인 경우에만 사용
- 결과 요약 줄에 정확한 PASS/FAIL/SKIP 카운트 명시
- FAIL 위임 대상은 도메인별 에스컬레이션 경로(react-process.md §7) 참조

## Layer 3-E2E Playwright 실행 절차

### 전제 조건 확인
1. `playwright.config.ts` 존재 여부 확인 (Glob)
2. 스펙 파일 존재 여부 확인 (Glob: `tests/e2e/**/*.spec.ts`)
3. 서버 기동 확인:
   - 백엔드: `curl -s http://localhost:3001/health`
   - 프론트엔드: `curl -s http://localhost:3003` (또는 config의 baseURL)
4. DB reset 엔드포인트 작동 확인 (테스트 격리 전제):
   - `curl -X POST http://localhost:3001/test/reset` → `{"ok":true}` 반환

### 실행
```bash
npx playwright test {specFile}
# 특정 테스트만: npx playwright test {specFile} -g "테스트명"
# UI 모드: npx playwright test --ui
# 디버그: npx playwright test --debug
```

### FAIL 시 스크린샷 경로 확인
- `playwright.config.ts`의 `screenshot: 'only-on-failure'` 설정 시 자동 저장
- 경로: `test-results/{프로젝트}-{테스트명}-{해시}/screenshot.png`
- 영상:  `test-results/{프로젝트}-{테스트명}-{해시}/video.webm`
- 트레이스: `npx playwright show-trace test-results/.../trace.zip`

### TIMEOUT 처리
- 타임아웃 발생 시 FAIL이 아닌 SKIP으로 처리 (브라우저/서버 무응답 구분)
- `page.waitForSelector` timeout(10000ms) vs `test.setTimeout` 구분하여 보고
- 재현 시도 1회 후 SKIP 처리: `npx playwright test --retries=1`

### Slack 보고 형식
Layer 3-E2E 결과를 QA 리포트에 포함하여 `mcp__slack__slack_reply_to_thread`로 보고.
FAIL 스크린샷은 파일 경로를 텍스트로 첨부 (예: `test-results/kanban-CRUD-생성-abc123/screenshot.png`).
