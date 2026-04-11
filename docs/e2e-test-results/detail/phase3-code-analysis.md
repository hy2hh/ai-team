---
date: 2026-04-10
topic: testing
roles: [all]
summary: Phase 3 코드 정적 분석 42항목 — 41 PASS / 1 FAIL (SESSION_TTL)
---

# Phase 3: 코드 정적 분석

서브에이전트가 소스 코드를 직접 읽어 검증.

| 섹션 | 항목 | 결과 | 증거 |
|------|------|------|------|
| 4 | changedFiles.length > 0 guard | PASS | cross-verify.ts:66 |
| 4 | VERIFY_MATRIX 매핑 | PASS | cross-verify.ts:104-152 |
| 4 | skipPosting=true (검증자) | PASS | cross-verify.ts:361 |
| 4 | VERDICT 파싱 | PASS | cross-verify.ts:369-381 |
| 5 | MAX_RALPH_LOOP_ITERATIONS | PASS | config.ts:60 (기본 3) |
| 5 | threadTopic 새 세션 | PASS | qa-loop.ts:362 |
| 5 | 히스토리 다음 iteration 전달 | PASS | qa-loop.ts:112-171 |
| 5 | PASS/WARN → 루프 탈출 | PASS | qa-loop.ts:543 |
| 9 | SDK error → ❌ 리액션 | PASS | agent-runtime.ts:2781-2807 |
| 9 | 타임아웃 처리 | PASS | agent-runtime.ts:2822 |
| 11 | 중복 claim 방지 | PASS | claim-db.ts:51-53 |
| 11 | 2시간 orphan 감지 | PASS | claim-db.ts:8, 126-173 |
| 11 | MAX_REQUEUE_ATTEMPTS=2 | PASS | claim-db.ts:10, 313 |
| 12 | max_turns 재시도 🔄 [N/3] | PASS | index.ts:773-808 |
| 12 | 세션 resume | PASS | index.ts:781-787 |
| 12 | SESSION_TTL | **FAIL** | config.ts:22 — 30일 (체크리스트: 72h) |
| 12 | JSON 손상 백업 | PASS | agent-runtime.ts:224-236 |
| 14 | escalate_to_pm 비PM만 | PASS | agent-runtime.ts:1721, 2139 |
| 14 | PM 재라우팅 + 부분 응답 | PASS | index.ts:824-849 |
| 15 | 리스크 LOW/MED/HIGH | PASS | risk-matrix.ts:24-28 |
| 15 | ❌/"거부" 취소 | PASS | auto-proceed.ts:241-314 |
| 15 | auto_approved 로깅 | PASS | auto-proceed.ts:163 |
| 19 | ⛔ → abort | PASS | index.ts:2993-3057 |
| 19 | pendingCancellations | PASS | agent-runtime.ts:410, 1530 |
| 19 | queued → skipped | PASS | queue-manager.ts:369 |
| 21 | 60s / 50 req sliding window | PASS | rate-limiter.ts:21-25 |
| 21 | waitQueue 1s drain | PASS | rate-limiter.ts:65 |
| 23 | 중복 실행 방지 | PASS | index.ts:2885 |
| 23 | version 재큐잉 추적 | PASS | claim-db.ts:30, 320 |
| 24 | 2+ impl → spec 필수 | PASS | agent-runtime.ts:1738-1768 |
| 24 | spec 없으면 위임 차단 | PASS | agent-runtime.ts:1747-1753 |
| 25 | 순환 핸드오프 경고 | PASS | index.ts:1121-1136 |
| 25 | 루프 강제 중단 | PASS | index.ts:1138-1143 |
| 26 | MAX_DELEGATION_DEPTH | PASS | config.ts:25 (기본 3) |
| 26 | 한도 → PM 최종 요약 | PASS | index.ts:1317, 1483-1507 |
| 27 | PM/hub-review → high | PASS | index.ts:1340 |
| 27 | 일반 위임 → standard | PASS | index.ts:1183 |
| 27 | cross-verify/QA → high | PASS | cross-verify.ts:363 |
| 27 | fast tier (Haiku) | PASS | config.ts:53 |
| 28 | Readonly 키워드 감지 | PASS | agent-runtime.ts:938-941 |
| 28 | Write/Edit 비활성화 | PASS | agent-runtime.ts:944-976 |
| 32 | SIGTERM 핸들링 | PASS | index.ts:3545-3546 |
| 32 | 세션 저장소 flush | PASS | index.ts:3529-3530 |
| 32 | WebSocket graceful disconnect | PASS | index.ts:3534-3540 |
