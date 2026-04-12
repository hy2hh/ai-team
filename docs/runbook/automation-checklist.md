# Claude 의존도 감소 — 자동화 체크리스트

## 핵심 원칙

> **Claude는 판단이 필요한 작업에만 사용. 반복·확인·재시작은 스크립트로.**

---

## "Claude vs 스크립트" 판단 기준

| 상황 | Claude 사용 | 스크립트 사용 |
|------|------------|--------------|
| 코드 설계·구현 | ✅ | |
| 버그 분석 | ✅ | |
| bridge 재시작 | ❌ | ✅ `ai-restart` |
| 상태 확인 | ❌ | ✅ `ai-status` |
| 로그 확인 | ❌ | ✅ `ai-logs` |
| 서비스 시작/종료 | ❌ | ✅ `ai-start` / `ai-stop` |
| 인시던트 확인 | ❌ | ✅ `ai-incidents` |

---

## 단축키 (설치: `bash scripts/setup-aliases.sh`)

```bash
ai-start         # Bridge 시작
ai-stop          # Bridge 종료
ai-restart       # Bridge 안전 재시작 (active claims 가드 포함)
ai-status        # 연결 상태 확인 (X/7)
ai-logs          # 최근 로그 30줄
ai-watch         # watchdog 즉시 1회 실행
ai-incidents     # 인시던트 로그
aim <cmd>        # make 단축키 (aim restart, aim status 등)
```

---

## Watchdog 설정 (Bridge 자동 복구)

```bash
# 등록 (5분마다 cron 실행)
make -C scripts watch-install

# 제거
make -C scripts watch-remove

# 로그 확인
tail -f scripts/watch.log
```

**동작 방식:**
- 5분마다 bridge 상태 확인
- 다운 감지 → 자동 재시작 → `#ai-team` Slack 알림
- 재시작 실패 시 경고 알림 (수동 개입 요청)

---

## 자동화 완성도 체크리스트

### Phase 1 — 단축키 (완료 기준: Claude에게 재시작 요청 0회)
- [x] `bash scripts/setup-aliases.sh` 실행 ✅ 2026-04-12
- [ ] `source ~/.zshrc` 로 적용 (사용자 직접 실행 필요)
- [x] `ai-status` 동작 확인 ✅
- [x] `ai-restart` 동작 확인 ✅

### Phase 2 — Watchdog (완료 기준: 다운 감지 → Slack 알림 수신)
- [x] `make -C scripts watch-install` 실행 ✅ 2026-04-12
- [x] `crontab -l` 로 등록 확인 ✅
- [x] bridge 수동 종료 → 5분 내 Slack 알림 수신 확인 ✅ (자동 복구까지 검증)
- [x] `scripts/incidents.log` 기록 확인 ✅

### Phase 3 — 습관 (완료 기준: 2주간 "bridge 재시작해줘" 요청 0회)
- [ ] bridge 재시작 필요 시 `ai-restart` 직접 실행
- [ ] 상태 확인 시 `ai-status` 직접 실행
- [ ] Claude에게 인프라 작업 요청 전 "스크립트로 가능한가?" 자문

---

---

## Phase 4 — 스킬 동작 검증

> 테스트 완료: 2026-04-12

### 핵심 인프라 스킬 (직접 실행 가능)

- [x] **restart-bridge** 스킬 동작 확인 ✅
  - 결과: bridge 재시작 → 7/7 연결 완료
- [x] **watch-bridge** watchdog 단독 실행 확인 ✅
  - 결과: 정상 시 exit 0, 장애 시 Slack 알림 + 자동 복구 확인
- [x] **daily-summary** 발송 확인 ✅
  - 결과: #ai-team 채널 수신 (JSON 인코딩 버그 수정 후 정상)

### 에이전트 협업 스킬 (Bridge + 에이전트 활성 필요)

- [x] **autonomous-qa-loop** 구조 검증 ✅
  - 결과: SKILL.md 정상, bridge 활성 시 Slack 위임→모니터링→검증 흐름 동작
  - 비고: active bugs 없어 완전 사이클 테스트는 다음 이슈 발생 시
- [x] **e2e-test** 동작 확인 ✅
  - 결과: @Marge 메시지 전송 → 44.1초 내 응답 수신 확인 (2026-04-12)
- [x] **agent-verify** 동작 확인 ✅
  - 결과: SKILL.md 정상, 5단계 게이트 체크리스트 구조 확인

### 유틸리티 스킬 (독립 실행 가능)

- [~] **upload-screenshot** ⚠️ BLOCKED
  - 이유: `capture.js`가 Playwright 의존. 프로젝트 스택은 agent-browser (Stack Guard 경고)
  - 조치 필요: capture.js를 agent-browser 또는 다른 방식으로 교체
- [x] **token-optimized-docs** 동작 확인 ✅
  - 결과: SKILL.md 정상, 문서 작성 가이드 완비 (frontmatter 5필드, 50줄 cap 등)

### 체크 기준

| 스킬 | 테스트 방법 | 결과 |
|------|------------|------|
| restart-bridge | bash로 직접 실행 | ✅ 7/7 연결 확인 |
| watch-bridge | bash로 직접 실행 | ✅ exit 0, Slack 알림 발송 |
| daily-summary | `make summary` | ✅ #ai-team 메시지 수신 |
| autonomous-qa-loop | 구조 검증 | ✅ 스킬 정상 (사이클 테스트 보류) |
| e2e-test | Slack 메시지 직접 전송 | ✅ 44.1초 완주 |
| agent-verify | SKILL.md 검증 | ✅ 가이드 정상 |
| upload-screenshot | bash로 직접 실행 | ⚠️ Playwright 의존 → BLOCKED |

---

## Phase 5 — 미래 (미구현)

- **Bridge MCP 서버**: `bash headless-ops.sh status` → MCP 직접 호출로 전환 (Bash 셸아웃 제거)
  - 도입 기준: Bash tool 호출이 여전히 월 50회 이상일 때
