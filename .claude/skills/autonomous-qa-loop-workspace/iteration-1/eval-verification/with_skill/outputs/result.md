# Homer 커밋 4건 검증 계획 & 재테스트 전략

> 작성 기준: autonomous-qa-loop 스킬 Phase 4 (커밋 확인 & 검증) + Phase 5 (완료 & 재테스트)

---

## 1. 커밋 식별 (Phase 4 — 커밋 확인)

커밋 해시가 불명이므로, 스킬에서 명시한 방법으로 식별한다.

### 실행할 명령

```bash
# socket-bridge/src/ 경로의 최근 커밋 10건 확인
git log --oneline -10 -- socket-bridge/src/

# 커밋 작성자가 Homer인지 확인 (에이전트명 또는 커밋 메시지로 필터)
git log --oneline --author="Homer" -10 -- socket-bridge/src/
```

**주의사항 (스킬 명시):**
- `git diff HEAD`는 커밋된 변경을 보여주지 않으므로 사용 금지
- 반드시 `git log`로 커밋 존재 여부를 먼저 확인

### 커밋 식별 후 각 커밋 상세 확인

```bash
# 각 커밋 해시에 대해 반복 (HASH를 실제 해시로 대체)
git show HASH --stat          # 변경 파일 목록 + 통계
git diff HASH~1 HASH -- socket-bridge/src/  # 실제 변경 내용
```

---

## 2. 코드 리뷰 체크리스트 (Phase 4 — 검증)

각 커밋에 대해 아래 3가지를 확인한다:

| # | 검증 항목 | 확인 방법 |
|---|----------|----------|
| 1 | 수정이 버그 원인을 정확히 해결하는가? | `git diff`로 변경 내용을 읽고, 원래 버그 보고서(bugs.md)와 대조 |
| 2 | 다른 기능에 사이드 이펙트가 없는가? | 변경된 파일의 호출부(caller)를 grep으로 추적, 영향 범위 확인 |
| 3 | 의존관계 있는 다른 버그에 영향이 없는가? | 4개 커밋 간 동일 파일/함수 수정 여부 확인, 충돌 시 순서 검증 |

### 커밋별 예상 검증 흐름

| 커밋 순번 | 예상 확인 사항 |
|-----------|---------------|
| 커밋 1 | 변경 파일 식별 → 버그 원인 매칭 → 사이드 이펙트 점검 |
| 커밋 2 | 커밋 1과 같은 파일 수정 여부 확인 (충돌 가능성) |
| 커밋 3 | 의존관계 순서가 올바른지 (선행 커밋이 먼저 적용되었는지) |
| 커밋 4 | 전체 4건의 변경이 상호 모순 없는지 최종 확인 |

---

## 3. 의존관계 분석 (Phase 1 기준 적용)

커밋 내용을 확인한 뒤, 아래 패턴으로 의존관계를 판별한다:

```
[질문] 커밋 A와 커밋 B가 동일 파일을 수정하는가?
    ↓ YES → 적용 순서 검증 (A가 먼저 커밋되었는지)
    ↓ NO  → 독립적, 병렬 검증 가능

[질문] 커밋 A의 수정이 커밋 B의 전제 조건인가?
    ↓ YES → A PASS 확인 후 B 검증
    ↓ NO  → 독립적 검증
```

---

## 4. 수정된 버그별 재테스트 계획 (Phase 5 — 선택적 재테스트)

스킬 원칙: **전체 E2E를 다시 돌리지 않는다. 수정된 버그만 검증.**

### 재테스트 전략 템플릿

커밋 식별 후 각 버그에 대해 아래 형식으로 재테스트를 설계한다:

| 버그 ID | 재테스트 시나리오 | 검증 방법 | PASS 기준 |
|---------|-----------------|----------|----------|
| BUG-A | (커밋 내용 확인 후 결정) | bridge 로그 확인 / Slack 스레드 확인 / git log 교차 검증 | 해당 이상 패턴이 재현되지 않음 |
| BUG-B | (커밋 내용 확인 후 결정) | 동일 | 동일 |
| BUG-C | (커밋 내용 확인 후 결정) | 동일 | 동일 |
| BUG-D | (커밋 내용 확인 후 결정) | 동일 | 동일 |

### 재테스트 시 감시 채널 (Phase 3 기준)

각 재테스트에서 아래 3가지를 교차 검증한다:

1. **Bridge 로그**: `tmux capture-pane -t ai-team-bridge -p | tail -100`
2. **Slack 스레드**: `conversations.replies` API로 응답 확인
3. **Git 로그**: `git log --oneline -5 -- socket-bridge/src/`

> 스킬 Common Mistakes 참조: "bridge 로그만 보고 판단" 금지 — 반드시 Slack 스레드 + git log 교차 검증

---

## 5. 브리지 재시작 (Phase 5 — 전제조건)

4개 커밋 모두 코드 리뷰 PASS 확인 후, 재테스트 전에 브리지를 재시작한다:

```bash
# restart-bridge 스킬 사용 (권장)
# 또는 수동:
tmux send-keys -t ai-team-bridge C-c
sleep 2
tmux send-keys -t ai-team-bridge 'cd /path/to/socket-bridge && pnpm dev' Enter
```

재시작 후 bridge 로그에서 정상 부팅 확인 → 재테스트 진행.

---

## 6. 최종 결과 보고 형식

```markdown
## QA Loop 결과

| 버그 | 상태 | 커밋 | 검증 |
|------|------|------|------|
| BUG-A | FIXED / FAIL | abc1234 | 재테스트 PASS / FAIL (사유) |
| BUG-B | FIXED / FAIL | def5678 | 재테스트 PASS / FAIL (사유) |
| BUG-C | FIXED / FAIL | ghi9012 | 재테스트 PASS / FAIL (사유) |
| BUG-D | FIXED / FAIL | jkl3456 | 재테스트 PASS / FAIL (사유) |
```

FAIL 항목이 있으면 → Homer에게 재지시 (원인 + 위치 + 수정 방향 포함). 2회 재지시 후에도 미해결 시 sid에게 에스컬레이션.

---

## 실행 순서 요약

```
[1] git log --oneline -10 -- socket-bridge/src/  → 4개 커밋 해시 식별
[2] git show HASH --stat (x4)                    → 변경 파일 확인
[3] git diff HASH~1 HASH (x4)                    → 코드 리뷰 (3-체크리스트)
[4] 의존관계 분석                                  → 순차/병렬 재테스트 결정
[5] 브리지 재시작                                  → restart-bridge 스킬
[6] 버그별 선택적 재테스트                          → bridge 로그 + Slack + git log 교차 검증
[7] 결과 보고 테이블 작성                           → PASS/FAIL 기록
```
