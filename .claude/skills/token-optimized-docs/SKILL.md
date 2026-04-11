---
name: token-optimized-docs
description: Use when creating or editing any .md file in .memory/, docs/, .claude/agents/, .claude/context/, or ~/.claude/projects/*/memory/. Ensures documents follow token optimization rules so agents don't waste context on large files. Triggers on file creation, report writing, decision recording, spec authoring, and auto-memory writes.
---

# Token-Optimized Document Writing

## Overview

에이전트 세션당 Read 비용을 최소화하는 문서 작성 규칙. 56K→12K 토큰(78%) 절감 달성.
근거: `decisions/2026-04-07_read-cost-optimization.md`, `decisions/2026-04-06_meeting-10_Learnings...하드캡...`

## 핵심 규칙

### 1. Frontmatter 필수

모든 `.md` 파일에 YAML frontmatter 포함:

```yaml
---
date: 2026-04-10
topic: testing          # 허용: architecture|process|quality|memory|team|product|tooling|kanban|testing|operations|prompting|design-system|planning
roles: [frontend, backend]
summary: 한줄 요약 (에이전트가 이것만 보고 Read 여부 판단)
status: accepted        # accepted|superseded|deprecated
---
```

### 2. 인덱스 + 상세 분리

```
directory/
  _index.md          # 한줄 요약 테이블 (에이전트가 이것만 스캔)
  detail/            # 상세 파일 (필요할 때만 Read)
    topic-a.md
    topic-b.md
```

- `_index.md` 또는 `index.md`: **50줄 이하** 엄수
- 상세 파일: frontmatter summary만 보고 선택 Read

### 3. 50줄 Core + On-demand 분리

```
context/{role}/
  core.md            # 50줄 이하 — 세션 시작 시 항상 로드
  on-demand/         # 작업 시작 시에만 로드
    conventions.md
    examples.md
```

### 4. 역할별 선택 로드

`session-bootstrap.md` 로딩 정책 준수:
- **항상 로드**: `collision-prevention.md`
- **역할별**: `routing-rules.md` → Triage 전용, `react-process.md` → Frontend/Backend/Designer
- **On-demand**: `collaboration-rules.md` → 위임 시, `systematic-debugging.md` → 디버깅 시

### 5. Learnings 하드캡

- 전 에이전트 공통 **10개**
- 필터: `relevance → confidence(≥7) → recency(30일)`
- Wiggum 예외: `confidence(≥8) → recency → relevance`

### 6. Auto-Memory 파일 압축 규칙

`~/.claude/projects/*/memory/` — 세션 시작 시 MEMORY.md 전체가 항상 로드됨.

**MEMORY.md 인덱스 라인**
- 각 항목 **150자 이하**: `- [제목](파일.md) — 한줄 훅`
- 상세 설명은 절대 인덱스에 넣지 말 것

**개별 메모리 파일 내용**
- feedback/project 파일: **핵심 규칙 1~2줄 + How to apply 1줄**. Why 서술 제거.
- 다중 항목 규칙 → 테이블로 압축 (예: 모델 선택표)
- 파생 이슈는 별도 파일 금지 — 원인 파일에 1줄 메모로 통합

**Staleness 정리**
- 버그 수정 커밋 확인 후 해당 버그 메모리 파일 삭제
- 파일 내 특정 함수/파일 경로 인용은 코드 변경 후 주기적 검증

## Quick Reference

| 파일 유형 | 최대 줄 수 | 필수 요소 |
|----------|-----------|----------|
| _index.md | 50줄 | 한줄 요약 테이블 |
| core.md | 50줄 | 세션 시작 로드용 |
| 리포트/결정문 | 본문 50줄 + detail/ | frontmatter + summary |
| 에이전트 persona | 200줄 | scope frontmatter |
| 상세 파일 | 제한 없음 | frontmatter summary |
| auto-memory MEMORY.md | 항목당 1줄 (150자↓) | 파일 링크 + 한줄 훅 |
| auto-memory 개별 파일 | 핵심 규칙 3~5줄 | 규칙 + How to apply 1줄 |

## 체크리스트

문서 작성 완료 후:
1. frontmatter 5필드 존재? (`date`, `topic`, `roles`, `summary`, `status`)
2. 50줄 초과 시 인덱스/상세 분리했는가?
3. `_index.md` 테이블에 행 추가했는가?
4. 에이전트가 이 파일을 **언제** 읽는지 명확한가? (항상/역할별/on-demand)

**Auto-memory (`~/.claude/projects/*/memory/`) 추가 체크:**
5. Why 서술 없이 핵심 규칙 + How to apply 1줄로 작성했는가?
6. MEMORY.md 인덱스 라인이 150자 이하인가?
7. 파생 이슈는 별도 파일 대신 원인 파일에 통합했는가?
8. 버그 메모리 작성 전 해당 버그가 이미 수정됐는지 `git log` 확인했는가?

## Common Mistakes

| 실수 | 수정 |
|------|------|
| 263줄 단일 리포트 | 인덱스 50줄 + detail/ 분리 |
| frontmatter 없이 파일 생성 | 5필드 필수 |
| _index.md 미갱신 | 파일 추가 시 즉시 행 추가 |
| 전체 파일 일괄 로드 | summary 스캔 → 관련 파일만 Read |
| decisions 3월 파일 루트 유지 | `archive/2026-03/summary.md`로 이동 |
| auto-memory Why 서술 장황 | 핵심 규칙 + How to apply 1줄만 유지 |
| auto-memory 파생 이슈 별도 파일 생성 | 원인 파일에 1줄 메모로 통합 |
| auto-memory 수정된 버그 파일 방치 | 커밋 확인 후 즉시 삭제 |
| MEMORY.md 인덱스에 상세 설명 삽입 | 150자 이하 한줄 훅으로 교체 |
