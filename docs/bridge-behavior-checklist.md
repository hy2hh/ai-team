# AI Team Bridge 정상 동작 체크리스트

> 최종 업데이트: 2026-04-10
> 용도: 브리지 수정 후 회귀 검증, 신규 기능 추가 후 통합 테스트

---

## 1. 리액션 시스템

> **검증 방법:** Slack #ai-team 채널에서 메시지 전송 후 이모지 변화 직접 관찰

- [ ] 메시지 도착 시 🧠 `brain` 리액션 추가 (Triage 처리 중)
- [ ] 에이전트 실행 시작 시 🧠 제거 후 ⚒️ `writing_hand` 전환
- [ ] 에이전트 정상 완료 시 ⚒️ → ✅ `white_check_mark` 전환
- [ ] 에이전트 에러 시 ⚒️ 제거 시도 후 (실패해도) ❌ `x` 추가
- [ ] 취소 요청 시 ⚒️ → ⛔ `black_square_for_stop` 전환
- [ ] **위임받은 에이전트 봇**이 PM 위임 메시지에 ⚒️ 추가 (PM 봇 아님, Slack 리액션 작성자 확인)
- [ ] 에이전트 작업 완료 시 같은 에이전트 봇이 ⚒️ → ✅ 전환
- [ ] PM 재위임 시 `🔄 [agent] 재작업 요청` 알림 메시지 게시 + 다음 에이전트가 ⚒️ 추가

---

## 2. Hub Loop (PM 기반 위임)

> **검증 방법:** 일반 작업 요청 후 Slack 메시지 흐름 관찰. bridge 로그: `tmux capture-pane -t ai-team-bridge -p | grep "\[hub\]"`

- [ ] 사용자 메시지 분석 후 PM이 Slack에 상태 메시지 게시
- [ ] PM이 `delegate` 또는 `delegate_sequential` 도구 호출로 위임 대상 설정
- [ ] 단일 위임: PM 메시지 ⚒️ → 에이전트 실행 → ✅ 전환
- [ ] 병렬 위임: 각 에이전트 봇이 PM 메시지에 ⚒️ 동시 추가 → 순차 ✅ 전환
- [ ] hub-review 중 Slack에 중간 PM 메시지 노출 안 됨 (skipPosting=true)
- [ ] hub-review에서 PM이 파일 직접 수정 불가 (Edit 도구 없음) — 로그에서 `[pm] hub-review 모드: Edit 도구 비활성화` 확인
- [ ] PM 재위임 시 `🔄` 알림 메시지 게시 후 `currentPmTs` 갱신 — 로그에서 `[hub] PM 재위임 알림 게시 → currentPmTs 갱신` 확인
- [ ] PM 완료 시 최종 요약이 원본 "작업중" 메시지를 업데이트 (새 메시지 X)
- [ ] 사용자 원본 메시지 최종 ⚒️ → ✅ 전환

---

## 3. Sequential 위임 (delegate_sequential)

> **검증 방법:** "A 작업 후 B 작업 순서대로 해줘" 같이 순서 명시 요청. 로그: `grep "\[hub\].*순차"`

- [ ] Step별 순차 실행 (이전 step 완료 후 다음 step 시작)
- [ ] 각 step 시작 시 PM 위임 메시지에 ⚒️ 추가
- [ ] step 완료 시 ⚒️ → ✅ 전환
- [ ] 이전 step 결과가 다음 step 에이전트 컨텍스트에 자동 포함
- [ ] 중간 step 실패 시 후속 step 전부 스킵 + PM에 실패 알림
- [ ] 모든 step 완료 후 PM hub-review 실행
- [ ] **순차 워크플로 진행 중 PM Slack 메시지 없음** (최종 완료 후 1회만)

---

## 4. Cross-Verification

> **검증 방법:** 코드/디자인 변경을 포함한 작업 요청. 로그: `grep "\[cross-verify\]"`

- [ ] hub loop 또는 sequential 위임 완료 후 자동 실행
- [ ] `changedFiles.length > 0`이어야 트리거 (파일 변경 없으면 검증 안 함) — hub loop, sequential 양쪽 모두 적용
- [ ] 동일 에이전트 복수 라운드 실행 시 마지막 결과만 검증 (중복 방지)
- [ ] `designer` → `frontend` + `qa` 검증
- [ ] `frontend` → `designer` + `backend` + `qa` 검증
- [ ] `backend` → `frontend` + `secops` + `qa` 검증
- [ ] `pm` → `researcher` 검증
- [ ] 변경 파일 내용을 코드가 직접 읽어서 검증자에게 주입
- [ ] 검증자 결과 Slack 노출 안 됨 (skipPosting=true)
- [ ] 응답 파싱: `VERDICT: PASS/WARN/FAIL`
- [ ] FAIL → Ralph Loop 자동 시작

---

## 5. Ralph Loop

> **검증 방법:** 의도적으로 FAIL이 날 작업 요청 (예: 불완전한 스펙). 로그: `grep "\[qa-loop\]"`

- [ ] Cross-verify 또는 Chalmers QA FAIL 시 자동 시작
- [ ] 재작업 에이전트에게 새 세션 강제 (`threadTopic` 설정) — 로그에서 `ralph-loop-iteration-N` 확인
- [ ] 이전 iteration 히스토리(실패 사유)가 다음 요청에 포함
- [ ] 재작업 → Cross-Verify → Chalmers QA 순서로 재검증
- [ ] PASS/WARN → 루프 탈출
- [ ] `MAX_RALPH_LOOP_ITERATIONS` 초과 시 sid에게 🔄 에스컬레이션 메시지

---

## 6. QA (Chalmers) 직접 위임

> **검증 방법:** `QA 실행 docs/specs/xxx.md` 명령 또는 일반 작업 완료 후 자동 QA 관찰

- [ ] specPath 있으면 Feature Spec AC 기반 E2E 검증 모드
- [ ] specPath 없으면 파일 기반 산출물 코드리뷰 모드
- [ ] QA 결과 Slack에 게시됨
- [ ] **QA FAIL 시 PM이 직접 파일 수정 안 함** — 로그에서 `[pm] hub-review 모드: Edit 도구 비활성화` 확인
- [ ] cross-verify 전체 PASS + specPath 감지 시 QA 자동 트리거 — 로그에서 `[qa-loop] QA 자동 실행` 확인

---

## 7. 칸반 카드 라이프사이클

> **검증 방법:** 칸반 서버(localhost:3000) 대시보드에서 카드 상태 변화 관찰

- [ ] 에이전트 위임 시 Backlog 카드 자동 생성 (agent별 1장)
- [ ] 에이전트 실행 시작 시 In Progress 이동
- [ ] 에이전트 작업 완료 시 Done 이동
- [ ] max_turns 도달 실패 시 Blocked 이동
- [ ] **칸반 서버 꺼진 상태**에서 작업 요청 → 에이전트가 정상 완료 (로그에 칸반 오류만 출력)

---

## 8. 이미지 처리

> **검증 방법:** Slack에 이미지 첨부 후 에이전트에게 전달. URL 만료 테스트는 오래된 메시지 URL 사용

- [ ] Slack `url_private` 이미지 다운로드 시 content-type 검증
- [ ] URL 만료 시 (HTML 반환) 에러 로깅 후 `null` 반환 — 로그에서 `이미지 다운로드 실패: 예상치 못한 content-type` 확인
- [ ] 에이전트에 "이미지 다운로드 실패" 메시지 전달, 에이전트가 이를 인지하고 계속 진행

---

## 9. 에러 처리

> **검증 방법:** 브리지 로그 관찰 + Slack 리액션 확인

- [ ] SDK 에러 시 retry 없으면 즉시 ❌, retry 있으면 마지막 실패 시 ❌
- [ ] 에이전트 타임아웃 시 ❌ + 타임아웃 로그
- [ ] Slack WebSocket 끊김 시 `/restart-bridge`로 재연결
- [ ] startup-recovery: 재시작 시 고아 ⚒️ 자동 정리 + Slack 알림

---

## 10. Triage 라우팅

> **검증 방법:** 다양한 메시지 패턴 전송 후 어느 에이전트가 응답하는지 관찰. 로그: `grep "\[route\]"`

- [ ] `@Bart` 등 @mention → Triage 개입 없이 해당 에이전트 직접 실행
- [ ] @mention 없는 메시지 → 키워드 매칭 → 매칭 없으면 LLM 분류
- [ ] "하이", "안녕", "감사해요" → LLM 분류 없이 PM으로 즉시 라우팅 (latency 낮음)
- [ ] 복수 도메인 키워드 (예: "디자인하고 프론트 구현해줘") → LLM이 parallel 모드 결정
- [ ] 스레드 메시지 → 해당 스레드 참여 에이전트만 후보, 없으면 PM fallback
- [ ] LLM 연속 5회 실패 시 circuit breaker 작동 → 60초 후 재시도 — 로그에서 `[circuit-breaker]` 확인

---

## 11. Claim 시스템 (중복 처리 방지)

> **검증 방법:** 동일 메시지에 두 에이전트가 동시 응답하는 경우가 없는지 관찰. 강제 테스트: 브리지 2개 인스턴스 실행 후 동일 메시지 전송 (단, 운영 환경에서는 금지). 로그: `grep "\[claim\]"`

- [ ] 동일 message_ts에 대한 claim은 한 번만 획득
- [ ] 중복 처리 시도 시 두 번째는 무시 (에이전트 실행 안 함)
- [ ] 2시간 이상 processing 유지 시 orphan 판정 → failed 전환 — DB 조회: `SELECT * FROM claims WHERE status='processing'`
- [ ] 재큐잉은 최대 2회까지만 허용 — DB에서 `version` 필드 확인
- [ ] 브리지 재시작 시 processing claim 일괄 failed 전환 후 최근 10분 내 실패 건 1회 재시도

---

## 12. 세션 관리

> **검증 방법:** 매우 긴 작업으로 max_turns 유도. 로그: `grep "\[mention-retry\]"`

- [ ] max_turns 도달 시 Slack에 "🔄 재시도 중 [N/3]" 알림 게시
- [ ] 재시도 시 기존 세션 ID로 resume (새 세션 생성 안 함) — 로그에서 `세션 재사용` 확인
- [ ] 최대 3회 재시도 후도 실패 시 Blocked 상태로 종료
- [ ] SESSION_TTL(72시간) 초과 세션 자동 정리 — `~/.claude-sessions/` 또는 `thread-sessions.json` 확인
- [ ] 세션 저장소 JSON 손상 시 백업 후 초기화 — 로그에서 백업 파일명 확인

---

## 13. 큐 시스템

> **검증 방법:** 동일 스레드에서 빠르게 여러 작업 연속 요청. 로그: `grep "\[queue\]"`

- [ ] 동일 스레드에 running 태스크 있으면 다음 태스크는 queued 대기
- [ ] 선행 태스크 완료 후 queued 태스크 자동 실행
- [ ] 의존 태스크(depends_on)는 선행 태스크 completed 후에만 실행
- [ ] 태스크 실패 시 의존 태스크 전부 skipped 처리
- [ ] 재시도 시 checkpoint로 부분 진행 복구 — DB: `SELECT * FROM task_queue WHERE status='queued'`

---

## 14. 에스컬레이션 (escalate_to_pm)

> **검증 방법:** 비PM 에이전트에게 PM 판단이 필요한 모호한 요청. 로그: `grep "\[escalation\]"`

- [ ] `escalate_to_pm` 도구가 비PM 에이전트에만 노출됨 (PM 실행 시 도구 목록에 없음)
- [ ] 에이전트가 escalate_to_pm 호출 시 PM으로 자동 재라우팅
- [ ] PM 재라우팅 시 에이전트 부분 응답 + 원본 요청 함께 전달
- [ ] PM이 hub 루프로 진입하여 이후 처리 담당

---

## 15. Auto-Proceed (승인 흐름)

> **검증 방법:** MEDIUM/HIGH 리스크 작업 후 승인 대기 메시지 확인. LOW 리스크는 2분 대기 후 자동 진행 관찰

- [ ] 리스크 등급별 veto window 적용: LOW 2분, MEDIUM 5분, HIGH 무기한
- [ ] veto window 내 ❌ 리액션 또는 "거부" 텍스트로 취소 가능
- [ ] veto window 만료 시 자동 진행 (auto_approved) — 로그에서 `[auto-proceed] auto_approved` 확인
- [ ] 완료 조건(dodPendingItems) 미충족 시 MEDIUM 리스크도 자동 진행 차단
- [ ] 브리지 재시작 시 만료된 pending 승인 자동 처리

---

## 16. Lisa 리서치 모드

> **검증 방법:** Lisa에게 "~에 대해 리서치해줘" 요청 (depth 미지정)

- [ ] depth 미지정 시 Slack에 선택 버튼 메시지 게시 (academic / practical)
- [ ] 버튼 클릭 시 선택한 depth로 에이전트 실행
- [ ] 리서치 완료 후 PM이 결과 종합 후 Slack에 게시
- [ ] PM은 종합 메시지 게시 완료 후에만 다음 단계(회의 소집 등) 진행 가능
- [ ] 버튼 클릭 없이 타임아웃 시 기본 depth로 실행 또는 에러 처리 — 로그 확인

---

## 17. 회의 소집 (convene_meeting)

> **검증 방법:** 크로스 도메인 작업 요청 (예: "디자인과 백엔드 아키텍처를 함께 결정해줘"). 로그: `grep "\[meeting\]"`

- [ ] 크로스 도메인 작업/아키텍처 결정/의견 충돌 시 PM이 자율 소집
- [ ] 참여자에게 동일 주제를 **병렬로** 전달 (독립 의견 수집)
- [ ] 각 참여 에이전트가 **자신의 봇 토큰**으로 의견을 Slack에 직접 게시 (PM 봇 아님) — 리액션 작성자로 해당 에이전트 봇 확인, `[runtime] skipPosting=true` 로그 **없어야** 정상
- [ ] PM이 수집된 의견을 종합하고 최종 결정
- [ ] 결정 내용을 `.memory/decisions/{date}_meeting-{id}_{slug}.md`에 자동 기록 — 파일 존재 확인
- [ ] 이미 산출물을 완료한 에이전트는 회의에 재포함 안 함

---

## 18. Startup Recovery

> **검증 방법:** 작업 진행 중 `tmux kill-pane -t ai-team-bridge` 로 강제 종료 후 재시작. 로그: `grep "\[startup-recovery\]"`

- [ ] 재시작 시 processing 상태 claim 감지 → 미처리 태스크 Slack 알림
- [ ] 고아 ⚒️ 리액션 자동 제거 (비정상 종료로 남은 것)
- [ ] 처리 중이던 태스크 재라우팅 시도
- [ ] 미처리 태스크 없으면 `[startup-recovery] 미처리 태스크 없음` 로그
- [ ] orphan claim 감지 5분 주기 반복 실행 — 로그에서 주기적 `[claim]` 로그 확인

---

## 19. 취소 흐름

> **검증 방법:** 에이전트 실행 중 해당 메시지에 ⛔ 이모지 직접 추가

- [ ] ⛔ 리액션 감지 시 실행 중인 에이전트 즉시 중단
- [ ] 실행 전(라우팅 단계)이면 pendingCancellations 등록 → 시작 즉시 중단 — 로그에서 `사전 취소로 실행 건너뜀` 확인
- [ ] 스레드 내 queued 태스크 전부 skipped 처리
- [ ] 취소 후 Slack 상태 메시지 "⛔ 취소됨" 업데이트

---

## 20. Direct QA (specPath 기반)

> **검증 방법:** `QA 실행 docs/specs/xxx.md` 전송. 로그: `grep "\[qa-loop\].*직접"`

- [ ] 메시지에서 specPath 패턴 감지 시 Chalmers 즉시 실행
- [ ] specPath 누락 시 사용법 안내 메시지 게시
- [ ] specPath 파일 미존재 시 에러 메시지 게시
- [ ] Chalmers 1회 호출 후 PASS/WARN/FAIL 결과 게시 (Ralph Loop 없음)
- [ ] cross-verify 전체 PASS + specPath 감지 시 QA 자동 트리거 — 로그에서 `[qa-loop] cross-verify 전체 PASS + specPath 감지` 확인

---

## 21. Rate Limiting

> **검증 방법:** 단일 스레드에서 빠르게 50개 이상 메시지 전송 (부하 테스트용, 운영 환경 주의). 로그: `grep "\[rate-limiter\]"`

- [ ] 60초 sliding window에서 최대 50 Slack API 요청 허용
- [ ] 슬롯 부족 시 waitQueue에 등록, 1초마다 drain — 로그에서 `[rate-limiter] 대기` 확인
- [ ] 모든 Slack API 호출에 rateLimited() 래퍼 적용
- [ ] 60초 경과 타임스탬프 자동 제거로 슬롯 회복

---

## 22. Heartbeat

> **검증 방법:** DB 직접 조회: `sqlite3 socket-bridge/data/memory.db "SELECT * FROM heartbeats;"`

- [ ] 브리지 시작 시 `role='bridge'`, `status='active'`, pid 등록
- [ ] 주기적으로 last_seen 갱신 (60초 간격)
- [ ] 10분 이상 미갱신 시 stale 판정 후 삭제 — 브리지 종료 후 10분 대기, DB 재조회로 확인

---

## 23. Collision Prevention

> **검증 방법:** 동시 실행 충돌 여부는 claim 시스템으로 방지됨 (11번과 연계). 로그: `grep "changes=0"` (중복 시도 로그)

- [ ] 동일 message_ts에 대해 에이전트가 중복 실행되지 않음
- [ ] 동시 처리 시도 시 첫 번째만 실행, 나머지는 무시
- [ ] version 필드로 재큐잉 한도 추적 — DB: `SELECT message_ts, version FROM claims WHERE version > 0`

---

## 24. Spec 강제 검증

> **검증 방법:** `docs/specs/` 파일 없는 상태에서 PM에게 "designer + frontend 동시 작업" 요청. 로그: `grep "\[enforcement\]"`

- [ ] PM이 2개 이상 구현 에이전트(designer/frontend/backend) 동시 위임 시 spec 파일 필수
- [ ] spec 파일 없으면 위임 차단 + 스펙 작성 요청 메시지 반환 — 로그에서 `[enforcement] delegate 차단` 확인
- [ ] spec 파일 있으면 정상 위임 진행

---

## 25. 순환 핸드오프 감지

> **검증 방법:** 에이전트가 서로를 무한 위임하는 시나리오 유도 (실제 테스트 어려움). 로그: `grep "\[hub\].*순환"`

- [ ] 동일 에이전트가 동일 허브 루프에서 재실행 요청 시 경고 로그 출력
- [ ] 모든 타겟이 이미 실행된 경우 루프 강제 중단 — 로그에서 `순환 루프 중단` 확인
- [ ] 루프 중단 후 PM 최종 요약 실행

---

## 26. MAX_DELEGATION_DEPTH 초과

> **검증 방법:** 위임이 계속 이어지는 복잡한 작업 요청 (depth=15 이상 유도). 로그: `grep "MAX_DELEGATION_DEPTH"`

- [ ] depth 한도 도달 시 루프 강제 종료
- [ ] 종료 후 PM 최종 요약 실행 (hub-review, skipPosting=false)
- [ ] 사용자 원본 메시지 ✅ 전환

---

## 27. Model Tier 선택

> **검증 방법:** 로그: `grep "\[runtime\].*모델 선택"`

- [ ] PM 초기 실행 및 hub-review → `high` (Opus)
- [ ] 일반 에이전트 위임 → `standard` (Sonnet) 기본
- [ ] PM이 `delegate(tier: 'fast')` 지정 시 해당 에이전트에 `fast` (Haiku) 적용
- [ ] cross-verify, Chalmers QA → `high` (검증은 항상 Opus)

---

## 28. Readonly 모드

> **검증 방법:** "검토만 해주세요", "수정 없이 확인만" 등 표현 포함 요청. 로그: `grep "\[readonly\]"`

- [ ] readonly 키워드 감지 시 Write/Edit 도구 비활성화 — 로그에서 `write 도구 비활성화 (readonly 모드 감지)` 확인
- [ ] 에이전트가 파일 수정 없이 분석/리뷰만 수행

---

## 29. Batch 메시지 처리

> **검증 방법:** 1~2초 내에 같은 스레드에 메시지 3개 연속 전송. 로그: `grep "\[batch\]"`

- [ ] 짧은 시간 내 연속 메시지를 하나로 묶어 단일 에이전트 실행
- [ ] 묶인 메시지 전체에 리액션 추가 (`batchTs` 추적)
- [ ] 에이전트에게 묶인 메시지 전체 컨텍스트 전달

---

## 30. 에이전트 시작 검증

> **검증 방법:** 브리지 시작 로그 확인: `tmux capture-pane -t ai-team-bridge -p | head -50`

- [ ] 시작 시 각 에이전트 persona 파일 존재 여부 검증
- [ ] 각 Slack Bot token으로 bot user ID 등록
- [ ] 검증 실패 시 에러 로그 + 해당 에이전트 비활성화
- [ ] 정상 시작 시 "N/6 연결됨" 카운트 완성

---

## 31. DB 초기화 및 마이그레이션

> **검증 방법:** `socket-bridge/data/memory.db` 삭제 후 브리지 재시작. `sqlite3 socket-bridge/data/memory.db ".tables"` 로 스키마 확인

- [ ] DB 파일 없을 시 자동 생성
- [ ] 최초 실행 시 모든 테이블 자동 생성 (claims, ralph_loop_state, heartbeats 등)
- [ ] 스키마 버전 마이그레이션 필요 시 자동 적용 — 로그에서 `[db] 마이그레이션` 확인

---

## 32. Shutdown 시퀀스

> **검증 방법:** `./scripts/stop-all.sh` 실행 후 로그 확인

- [ ] 종료 신호(SIGTERM) 수신 시 진행 중인 에이전트 작업 완료 대기 또는 중단
- [ ] 세션 저장소(thread-sessions.json) 즉시 flush
- [ ] Slack WebSocket 정상 종료 (graceful disconnect)
- [ ] 칸반 In Progress 카드 Blocked 처리 — 대시보드에서 확인

---

## 33. 메모리 시스템 — 세션 시작 순서

> **검증 방법:** 에이전트 세션 시작 직후 Slack 응답이나 로그에서 읽은 파일 순서 확인. 또는 에이전트에게 "세션 시작 시 뭘 읽었어?"라고 직접 질문

- [ ] 세션 시작 순서: `tasks/active-{role}.md` → `facts/project-context.md` → `research/index.md` → `facts/agents/{role}/` → `handoff/index.md` (이 순서대로)
- [ ] `handoff/index.md` 로드 시 본인 role 포함 항목만 Read (전체 파일 일괄 로드 안 함)
- [ ] `decisions/_index.md` 조회 시 3월 항목은 `archive/2026-03/summary.md`로 이동, 개별 파일 직접 Read 안 함
- [ ] `research/index.md` 확인 시 오늘 작업 관련 주제만 선택적 Read (전체 로드 안 함)

---

## 34. 메모리 시스템 — 에이전트 이름 및 역할

> **검증 방법:** 에이전트가 자기소개하거나 다른 에이전트를 언급할 때 이름 확인

- [ ] Designer → `Krusty` (Donald 아님)
- [ ] Researcher → `Lisa` (Donald 아님)
- [ ] `active-designer.md` 헤더 = "Active Tasks — Designer Krusty"
- [ ] `active-researcher.md` 헤더 = "Active Tasks — Researcher Lisa"
- [ ] `tasks/active.md` 인덱스에 "Donald" 문자열 없음 — `grep -c Donald .memory/tasks/active.md`가 0 반환

---

## 35. 메모리 시스템 — 읽기/쓰기 권한 준수

> **검증 방법:** 에이전트가 메모리 파일 수정 시 어느 파일을 수정하는지 확인

- [ ] 각 에이전트가 자기 `active-{role}.md`만 수정 (다른 에이전트 파일 수정 안 함)
- [ ] `facts/project-context.md`, `facts/team-profile.md` 수정 시 Marge만 — 다른 에이전트가 직접 수정하면 이상
- [ ] `facts/agents/{role}/` 파일은 해당 role 에이전트가 직접 작성 (PM 승인 요청 없음)
- [ ] `learnings/` 디렉토리에 신규 .jsonl 파일 생성 안 함 (deprecated — `facts/agents/{role}/context.md` 사용)
- [ ] `heartbeats/` 디렉토리에 `.json` 파일 없음 — `ls .memory/heartbeats/*.json 2>/dev/null` 빈 결과

---

## 36. 메모리 시스템 — decisions 인덱스 정합성

> **검증 방법:** 새 decision 파일 작성 후 _index.md에 행이 추가됐는지 확인

- [ ] 새 decision 파일 작성 시 `decisions/_index.md` 테이블에 행 자동 추가 (에이전트가 빠뜨리지 않음)
- [ ] frontmatter에 `date`, `topic`, `roles`, `summary` 4개 필드 모두 존재
- [ ] topic이 허용 목록 안에 있음: `architecture|process|quality|memory|team|product|tooling|kanban|testing|operations|prompting|design-system|planning`
- [ ] 3월 개별 파일은 `decisions/` 루트에 없음 — `ls .memory/decisions/2026-03-*.md 2>/dev/null` 빈 결과

---

## 37. 메모리 시스템 — Designer→Frontend 워크플로 체인

> **검증 방법:** UI 관련 작업 요청 후 위임 순서 확인

- [ ] UI 포함 작업 위임 시 Krusty(Designer) → Bart(Frontend) 순서로 sequential 실행
- [ ] Bart에게 디자인 스펙 없이 직접 UI 구현 위임 안 됨 (Krusty 스펙 선행 필수)
- [ ] 예외(버그 수정, 텍스트만 변경)는 Bart 직접 위임 허용

---

## 관련 파일 및 진단 명령어

| 기능 | 파일 | 진단 명령어 |
|------|------|------------|
| Hub Loop / Sequential / 리액션 | `socket-bridge/src/index.ts` | `grep "\[hub\]\|\[reaction\]"` |
| 에이전트 실행 / 도구 / 세션 | `socket-bridge/src/agent-runtime.ts` | `grep "\[runtime\]\|\[readonly\]\|\[pm\]"` |
| Cross-Verification | `socket-bridge/src/cross-verify.ts` | `grep "\[cross-verify\]"` |
| Ralph Loop / Chalmers QA | `socket-bridge/src/qa-loop.ts` | `grep "\[qa-loop\]"` |
| 칸반 연동 | `socket-bridge/src/kanban-sync.ts` | `grep "\[kanban"` |
| Triage 라우팅 | `socket-bridge/src/router.ts` | `grep "\[route\]\|\[triage\]"` |
| Claim / Collision | `socket-bridge/src/claim-db.ts` | `grep "\[claim\]"` |
| 큐 시스템 | `socket-bridge/src/queue-manager.ts` | `grep "\[queue\]"` |
| Auto-Proceed | `socket-bridge/src/auto-proceed.ts` | `grep "\[auto-proceed\]"` |
| Rate Limiting | `socket-bridge/src/rate-limiter.ts` | `grep "\[rate-limiter\]"` |
| Heartbeat | `socket-bridge/src/heartbeat.ts` | `sqlite3 data/memory.db "SELECT * FROM heartbeats"` |
| PM 행동 규칙 | `.claude/agents/pm.md` | — |

### 전체 로그 스트리밍
```bash
tmux capture-pane -t ai-team-bridge -p | tail -100
```
