# Session Bootstrap (모든 에이전트 공통)

## Team Infrastructure
- **Team Channel**: #ai-team
- **Shared Memory**: `.memory/` (read CLAUDE.md for full protocol)
- **Collaboration Rules**: `shared/collaboration-rules.md`
- **React Process**: `shared/react-process.md`
- **Code Quality**: `shared/code-quality-standards.md`

## Session Start Protocol
1. `git pull --rebase origin main` (충돌 시: `git rebase --abort` → `git pull --no-rebase`)
2. Read `.memory/tasks/active-{role}.md`
3. Read `.memory/facts/project-context.md`
4. Check `.memory/facts/qa-metrics.md` — 자기 역할의 FAIL 빈도 확인 (자가 리뷰 우선순위 조정)
5. Check `.memory/decisions/lesson-*` — 자기 역할 관련 학습 항목 로드 (임시 체크리스트 추가)
6. Check `.memory/handoff/` — 대기 중인 핸드오프 확인

## Session End Protocol
1. Memory 업데이트 (collaboration-rules.md Memory Protocol 참조)
2. Slack 완료 보고 (행동 + 결과 + 다음 단계)

## 프로세스 (스킬 자동 로드)
위임→`/agent-delegate` | 핸드오프→`/agent-handoff` | 디버깅→`/agent-debug` | 리뷰→`/agent-review` | 기획→`/agent-plan` | 구현→`/agent-implement` | 완료→`/agent-verify` | API→`/agent-api-contract` | TDD→`/agent-tdd`

각 에이전트는 자기 역할에 해당하는 스킬만 사용한다.

## MCP 도구 실패 대응

MCP 도구(`mcp__slack__*` 등)가 `invalid_auth`, `missing_scope` 등으로 실패 시:

1. **`.mcp.json` 확인** → env 변수 매핑 확인 (예: `${SLACK_USER_TOKEN}`)
2. **`.env`에서 실제 토큰 값 확인** → 해당 변수명으로 검색
3. **curl로 직접 API 테스트** → `curl -H "Authorization: Bearer $TOKEN" https://slack.com/api/auth.test`
4. 토큰 유효하면 → curl로 직접 작업 진행 (MCP 서버 env 로딩 문제)

**금지:** 설정 파일 순회 탐색 (plugins/, settings.json, desktop_config 등). 위 3단계로 해결 안 되면 사용자에게 보고.

## 신규 에이전트 추가 시 필수 섹션
새 에이전트 페르소나 파일 생성 시 반드시 포함:
1. YAML frontmatter (name, description, scope, tools)
2. `공통: shared/session-bootstrap.md` 참조
3. 자가 리뷰 체크리스트 (역할 특화)
4. 역할 특화 프로세스 (에스컬레이션 대상 등)
