# AI Team Memory Index

> 세션 시작 진입점. 상세 규칙 → `full-index.md`

## 빠른 참조

| 경로 | 용도 |
|------|------|
| `facts/project-context.md` | 기술스택, 포트, 현재 Phase |
| `facts/team-profile.md` | 팀원, 역할, Slack 봇 |
| `tasks/active-{role}.md` | 내 진행 중 태스크 |
| `decisions/_index.md` | 전체 결정사항 한줄 요약 테이블 |
| `decisions/archive/2026-03/summary.md` | 3월 결정사항 압축 요약 |
| `handoff/index.md` | 핸드오프 목록 |
| `research/index.md` | 리서치 목록 |

## Session Start Checklist

1. Read `tasks/active-{your-role}.md`
2. Read `facts/project-context.md`
3. Scan `research/index.md` → 오늘 작업과 관련된 topic 파일 있으면 Read
4. Scan `facts/agents/{your-role}/` → operational 지식 있으면 Read
5. Check `handoff/index.md` → 본인 role 포함 파일만 Read
6. Check Slack #ai-team for unread mentions

> decisions 조회·작성 필요 시 → `/decision-ops` 스킬 호출

## 쓰기 규칙 요약

- **facts/**: `project-context.md`, `team-profile.md`는 Marge 관리. 나머지(`services.md` 등)와 `facts/agents/{role}/`는 관련 에이전트 직접 작성 (PM 승인 불필요)
- **tasks/**: 본인 `active-{role}.md`만 수정
- **decisions/**: frontmatter(`date/topic/roles/summary`) 필수 + `_index.md` 테이블 추가
- **handoff/**: `handoff/index.md` 업데이트 필수, 7일 후 삭제
- **heartbeats/**: `memory.db` SQLite 저장 — `.json` 파일 금지

> 상세 규칙 필요 시 → `full-index.md`
