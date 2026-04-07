---
name: decision-ops
description: decisions 읽기/쓰기 작업 시 호출. 관련 decisions 조회, 새 decision 작성, _index.md 업데이트 절차를 포함한다.
---

# Decision Ops

## 읽기 — 관련 decisions 찾기

### 1단계: _index.md 스캔 (항상 이것부터)

Read `.memory/decisions/_index.md` → `roles` 컬럼에 본인 역할 또는 `all` 포함된 행만 확인 → 해당 파일만 Read (최대 3개)

3월 이전 → `decisions/archive/2026-03/summary.md` 참조

### 2단계: grep 필터 (파일이 많을 때)

```bash
grep -rl "roles:.*frontend" .memory/decisions/*.md
grep -rl "topic: architecture" .memory/decisions/*.md
```

### 3단계: SQLite FTS (bridge 실행 중일 때)

```bash
sqlite3 .memory/memory.db "
  SELECT date, file_path, summary
  FROM decisions_fts
  WHERE (roles MATCH 'frontend' OR roles MATCH 'all')
  ORDER BY date DESC LIMIT 5;
"
```

---

## 쓰기 — 새 decision 작성

### 파일 생성 시 frontmatter 필수

```markdown
---
date: YYYY-MM-DD
topic: architecture|process|quality|memory|team|product|tooling|kanban|testing|operations|prompting
roles: [all] 또는 [frontend, backend, ...]
summary: 핵심 결정 한줄 (50자 이내)
---
```

### _index.md 테이블에 행 추가 (필수)

`.memory/decisions/_index.md` 해당 월 테이블에 행 추가:

```markdown
| MM-DD | `파일명` | roles | topic | 한줄요약 |
```

날짜 내림차순 유지. roles가 `all`이면 `all`로, 특정 역할만이면 쉼표 구분.

---

## 월간 아카이브 (PM 담당, 매월 초)

1. `decisions/archive/YYYY-MM/summary.md` 생성 (전월 decisions 압축 요약)
2. `_index.md`에서 전월 행 제거 후 "→ archive/YYYY-MM/summary.md 참조" 한 줄로 대체
