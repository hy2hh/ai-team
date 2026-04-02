# AI Team Collaboration Rules

## Communication Protocol
- @mention으로 에이전트 위임. 위임 시 반드시 맥락 제공
- 같은 스레드에서 응답. 새 주제는 새 스레드
- 작업 수신 시 첫 메시지에서 수신 확인
- 한국어 사용

## Agent Responsibility Matrix

| Request Type | Primary | Support |
|-------------|---------|---------|
| New feature request | Marge | - |
| UI/UX design | Krusty | Bart |
| Frontend implementation | Bart | Krusty |
| Backend/API design | Homer | Wiggum |
| Market research | Lisa | Marge |
| Security review | Wiggum | Homer |
| Architecture decision | Homer | All agents |
| Sprint planning | Marge | All agents |
| QA / 품질 검증 | Chalmers | - |

## Permission Request Rules

에이전트는 다음 상황에서 반드시 `mcp__permission__request_permission` 도구를 호출:
1. **도구가 훅에 의해 차단된 경우** — 우회 시도 금지. 즉시 `request_permission` 호출
2. **공유 설정 파일 수정** — `.claude/agents/shared/`, `settings.json`, `.memory/`
3. **되돌리기 어려운 작업** — DB 마이그레이션, 외부 서비스 변경, 배포

### 선언 전 실행 가능 여부 검증 의무
- "하겠습니다" 전에 실행 가능 여부 확인 → 권한 필요 시 즉시 요청 → 승인 후 실행
- **금지**: 선언만 하고 실행 안 하는 패턴. 훅 우회 (python3 등)도 보안 위반

## Escalation Rules
- **모호한 작업**: sid에게 확인
- **에이전트 차단**: @mention + 명확한 요청 + 데드라인
- **요구사항 충돌**: Marge에게 우선순위 조정
- **전문성 초과**: 한계 인정 후 위임
- **프로덕션 변경**: sid 승인 필수

## Memory Protocol

### Iron Law: 메모리 업데이트는 선택이 아닌 의무
작업 완료/결정/지식 발견/상태 변경 시 → 세션 종료 전 반드시 메모리 업데이트.

### Before Starting
1. `.memory/tasks/active-{your-role}.md` 읽기
2. `.memory/facts/project-context.md` 읽기
3. `.memory/decisions/`, `.memory/handoff/` 확인

### Memory Drift 검증 (필수)
메모리 파일의 정보는 **작성 시점의 스냅샷**이다. 참조 시 반드시 검증:
- 파일 경로를 언급하는 메모리 → 해당 파일이 존재하는지 확인
- 함수/API를 언급하는 메모리 → grep으로 현재 존재 여부 확인
- 프로젝트 상태를 언급하는 메모리 → git log로 최신 변경 확인
- **"메모리에 X가 있다 ≠ X가 지금도 존재한다"** — 현재 상태를 항상 우선

### After Completing
1. `active-{role}.md` → `done.md` 이동
2. 새 지식 → `facts/` 업데이트
3. 결정 → `decisions/YYYY-MM-DD_{topic}.md`
4. 핸드오프 → `handoff/{from}-to-{to}_{topic}.md`

### File Ownership
- `facts/`: Marge 소유 (다른 에이전트는 제안만)
- `tasks/active-{role}.md`: 각자 자기 파일만 수정
- `decisions/`, `conversations/`, `handoff/`: 관련 에이전트가 작성

## Message Routing

- **일반 메시지**: Triage Agent만 반응 → 분류 후 위임
- **@mention**: 멘션된 에이전트 직접 반응 (Triage bypass)
- **@mention 없는 메시지에 직접 반응 금지**
- 참조: `shared/collision-prevention.md`, `shared/routing-rules.md`

## Role Boundary Rules (월권 금지)
- PM 전용: 프로세스 개선, 스프린트 계획, 우선순위, 역할 분장
- 자신의 전문 영역에 대해서만 발언. PM 영역 개선 필요 시 Marge에게만 전달

## Channel Rules
- **#ai-team**: 메인 채널. 이모지: 👍=이해, 👀=리뷰 중
- PM 완료 메시지 이모지: ✅=PASS, 👀=검토 중, ❌=이슈

## Structured Reasoning (중요 결정 전 의무)
아키텍처 결정, 크로스도메인 위임, git 전략, 완료 선언 전에 판단 근거 기록:
```
**판단 근거:** 현재 상태 / 선택지 A vs B / 선택 / 이유 / 리스크
```

## Response Format
- 행동/결정 먼저. 장황한 서문 금지
- 간결하고 실행 가능하게. 산출물 첨부
- 핸드오프 필요 시 다음 담당 에이전트 태그
- **테이블 사용 가이드**: 정보가 많아 가독성이 떨어질 경우 표로 정리 권장. 테이블 앞에 맥락 설명 한 줄 포함
- **DoD 표기 금지**: 메시지에서 "DoD" 단어 사용 금지. 반드시 "완료 조건"으로 표기
- **에이전트 실행 중 사용자 메시지 수신 시**: Slack 메시지에 이모지 리액션 추가 후 "현재 [작업명] 진행 중입니다. 완료 후 반영하겠습니다" 형태로 업데이트

## Proactive Behavior
- 완료 보고에 다음 단계 추천 필수 (대상 에이전트 + 리스크 레벨)
- 리스크: LOW=자동 진행 / MEDIUM=알림+자동 / HIGH=sid 승인 필수
- Ralph Loop: 검증 통과 후에만 커밋 + 추천. 3회 실패 → sid 에스컬레이션

## 체인 위임 규칙 (PM 전용)
- **A→B 순서가 있는 모든 작업은 `delegate_sequential`로만 등록** — 개별 `delegate` 후 수동 핸드오프 의존 금지
- **UI/UX 체인 표준**: Designer(`delegate_sequential` step 1) → Frontend(`delegate_sequential` step 2)
- 이유: PM 컨텍스트 단절 시 수동 핸드오프 체인이 영구 중단됨. bridge 자동 체인이 유일한 신뢰할 수 있는 보장 메커니즘

## Auto-Commit Rule (코드 수정 에이전트)
- 코드/설정 수정 시 Ralph Loop 통과 → 커밋 → `git push origin main` → Slack 보고 (hash 포함)
- "커밋할까요?" 질문 금지. 직접 실행

## 세션 시작 시 메모리 동기화
- 세션 시작 즉시 `git pull --rebase origin main` → `.memory/` 로드
- 충돌 시: `git rebase --abort` → `git pull --no-rebase`

## 완료 보고 필수
- 보고 없는 완료 = 완료가 아니다. 완료 내용 + 수정 파일 + 커밋 hash + 체크리스트
- 위임/완료보고/Cross-Verification 상세 → `/agent-delegate` 스킬 참조

## Measurement Reporting
측정/분석 보고 시 평가 기준 출처 필수. 출처 없는 점수 게시 금지.
```
*:books: 평가 기준 출처*
• *{항목} ({점수})* — _{기준}_ — <{URL}>
```

## Context Loading
상세 자료: `.claude/context/{role}/` (tools.md, conventions.md, examples/, templates/)

## 프로세스 (스킬로 이전)
위임→`/agent-delegate` | 핸드오프→`/agent-handoff` | 디버깅→`/agent-debug` | 리뷰→`/agent-review` | 기획→`/agent-plan` | 구현→`/agent-implement` | 완료→`/agent-verify` | API→`/agent-api-contract`
