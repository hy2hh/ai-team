# Session Bootstrap (모든 에이전트 공통)

## Team Infrastructure
- **Team Channel**: #ai-team
- **Shared Memory**: `.memory/` (read CLAUDE.md for full protocol)
- **Collaboration Rules**: `shared/collaboration-rules.md`
- **React Process**: `shared/react-process.md`
- **Code Quality**: `shared/code-quality-standards.md`

## Shared 파일 로딩 정책 (토큰 절약)

**항상 로드 (모든 에이전트):**
- `shared/collision-prevention.md` — 단일 응답 보장 규칙

**역할별 로드 (해당 역할만):**
- `shared/routing-rules.md` → **Triage 전용**
- `shared/react-process.md` → Frontend / Backend / Designer만
- `shared/code-quality-standards.md` → Frontend / Backend만

**On-demand (작업 시작 시에만):**
- `shared/collaboration-rules.md` → 위임·핸드오프 수행 시
- `shared/processes/systematic-debugging.md` → 버그 디버깅 시
- `shared/api-contracts-protocol.md` → API 설계·변경 시
- `/agent-review` 스킬 → 코드 리뷰 시
- `/agent-verify` 스킬 → 완료 직전
- `/agent-handoff` 스킬 → 크로스 도메인 작업 시

## Session Start Protocol
1. `git pull --rebase origin main` (충돌 시: `git rebase --abort` → `git pull --no-rebase`)
2. Read `.memory/tasks/active-{role}.md`
3. Read `.memory/facts/project-context.md`
4. Check `.memory/facts/qa-metrics.md` — 자기 역할의 FAIL 빈도 확인 (자가 리뷰 우선순위 조정)
5. Scan `.memory/research/index.md` → 오늘 작업과 관련된 topic 파일 있으면 Read
6. Scan `.memory/facts/agents/{role}/` → 역할별 operational 지식 있으면 Read
7. Check `handoff/index.md` → 본인 role 포함 파일만 Read

> decisions 조회·작성 → `/decision-ops` 스킬 호출

## Session End Protocol
1. **Operational 지식 저장** — 아래 중 하나라도 해당하면 `facts/agents/{role}/` 즉시 업데이트:
   - 도구/MCP/API에서 문서에 없는 동작 발견
   - 반복될 수 있는 실수 패턴 또는 함정 확인
   - 시스템 제약/한계 발견 (rate limit, 인증 오류 패턴 등)
   - 다음 세션에서 알면 시간을 아낄 operational 사실
2. Memory 업데이트 (collaboration-rules.md Memory Protocol 참조)
3. Slack 완료 보고 (행동 + 결과 + 다음 단계)

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
