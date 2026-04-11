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
- [ ] `bash scripts/setup-aliases.sh` 실행
- [ ] `source ~/.zshrc` 로 적용
- [ ] `ai-status` 동작 확인
- [ ] `ai-restart` 동작 확인

### Phase 2 — Watchdog (완료 기준: 다운 감지 → Slack 알림 수신)
- [ ] `make -C scripts watch-install` 실행
- [ ] `crontab -l` 로 등록 확인
- [ ] bridge 수동 종료 → 5분 내 Slack 알림 수신 확인
- [ ] `scripts/incidents.log` 기록 확인

### Phase 3 — 습관 (완료 기준: 2주간 "bridge 재시작해줘" 요청 0회)
- [ ] bridge 재시작 필요 시 `ai-restart` 직접 실행
- [ ] 상태 확인 시 `ai-status` 직접 실행
- [ ] Claude에게 인프라 작업 요청 전 "스크립트로 가능한가?" 자문

---

## 다음 단계 (Phase 4 — 현재 미구현)

- **Bridge MCP 서버**: `bash headless-ops.sh status` → MCP 직접 호출로 전환 (Bash 셸아웃 제거)
  - 도입 기준: Bash tool 호출이 여전히 월 50회 이상일 때
- **메트릭 대시보드**: `scripts/incidents.log` → Slack daily summary 자동 발송
