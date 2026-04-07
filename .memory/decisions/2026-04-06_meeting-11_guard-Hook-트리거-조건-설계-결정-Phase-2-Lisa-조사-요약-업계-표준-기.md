# 회의 결정: guard Hook 트리거 조건 설계 결정 (Phase 2)

## Lisa 조사 요약 (업계 표준)

**기술 메커니즘**: Claude Code `PreToolUse` 훅 — `allow/deny/ask/defer` 4가지 반환값
**업계 표준 방식**: 정규식 패턴 매칭 + allowlist 예외 조합
**단계 접근 권장**: warn(로그만) → deny(차단) → ask(확인 요청)

**업계 표준 트리거 카테고리:**

| 카테고리 | 패턴 예시 | 위험도 |
|---------|-----------|--------|
| 재귀 삭제 | `rm -rf /`, `rm -rf ~`, `rm -rf *` | 🔴 치명 |
| Git 파괴 | `git reset --hard`, `git push --force`, `git checkout .` | 🔴 치명 |
| DB 파괴 | `DROP TABLE`, `TRUNCATE`, `FLUSHALL` | 🔴 치명 |
| 컨테이너 | `docker system prune`, `kubectl delete namespace` | 🟠 높음 |
| 파이프 실행 | `curl \| bash`, `wget \| sh` | 🟠 높음 |
| 권한 변경 | `chmod -R 777`, `chmod -R 000` | 🟡 중간 |
| 시스템 쓰기 | `/etc/`, `/usr/local/bin/` 대상 쓰기 | 🟡 중간 |
| 시크릿 노출 | `.env` 파일 직접 편집/출력 | 🟡 중간 |
| 클라우드 파괴 | `terraform destroy`, `aws ec2 terminate-instances` | 🟠 높음 |

**안전 예외(allowlist) 필수**: `rm -rf node_modules`, `dist`, `.next`, `build`, `coverage` → 허용

## 결정이 필요한 4가지 질문 (각 에이전트 의견 필요)

**Q1. 차단 범위**: 🔴 치명 카테고리만 차단? vs 🟠 높음까지 포함?
**Q2. 기본값 전략**: 즉시 deny로 시작? vs warn → deny 단계적 적용?
**Q3. allowlist 관리 주체**: 고정 목록(코드에 하드코딩)? vs 에이전트가 `.claude/hooks/allowlist.txt` 편집 가능?
**Q4. 에이전트별 차등**: Homer는 `terraform destroy --dry-run` 허용 등 에이전트별 예외? vs 전 에이전트 동일 규칙?

## 답변 가이드
각 질문에 대해: (1) 선호 옵션, (2) 근거, (3) 엣지케이스/우려사항 을 제시해주세요.
실제 구현 관점(Homer), 보안 관점(Wiggum), 실용성(Bart/Chalmers) 중심으로 의견 주세요.
> 회의 ID: 11
> 유형: architecture
> 일시: 2026-04-06T07:44:30.351Z
> 참여자: backend, secops, frontend, qa

## 의견 요약
### backend
회의 #11 스레드에 Backend 관점 의견을 제출 완료했습니다.

*요약:*
• *Q1*: 🔴 치명 → deny, 🟠 높음 → ask (2-tier 전략)
• *Q2*: 치명은 즉시 deny, 높음만 warn→ask 단계적 적용
• *Q3*: allowlist 하드코딩 — 에이전트 편집 허용 시 안전장치 무력화
• *Q4*: 전 에이전트 동일 — PreToolUse stdin에 에이전트 식별 수단 없음, 차등 인프라 비용 > 가치
• *구현*: `guard-check.sh` ~50줄 + `settings.json` PreToolUse 블록 추가, 반나절 내 완료 가능
### secops
회의 #11 스레드에 guard Hook 설계 의견 제출 완료했습니다.

*SecOps 입장 요약*: 4개 질문 모두 *가장 보수적인 옵션* 선택 — 🔴+🟠 즉시 deny, allowlist 하드코딩, 에이전트 동일 규칙. 핵심 근거는 3가지:

• 현재 런타임 강제 장치가 *0개* (`settings.json` 직접 확인 — PreToolUse Hook 없음)
• allowlist 에이전트 편집 허용은 CWE-284 안티패턴 (자기 비활성화 경로)
• 에이전트별 예외는 정규식 오류 시 곧 취약점으로 전환

추가로 *정규식 우회 패턴 테스트*(공백 변형, 플래그 분리 등)와 *fail-closed 원칙*(Hook 장애 시 deny 기본값)을 필수 요건으로 제안했습니다.
### frontend
*🖥️ Bart (Frontend) — 회의 #11 의견*

---

*1. 핵심 의견*

프론트엔드 에이전트 관점에서 guard Hook은 *🔴 치명만 즉시 deny, 🟠 높음은 warn으로 시작*하는 단계적 접근이 적합합니다. 프론트엔드 워크플로에서 `rm -rf`는 빌드 아티팩트 정리에 일상적으로 쓰이기 때문에, allowlist 없이 광범위 차단하면 정상 작업이 막히는 문제가 발생합니다.

---

*2. 질문별 의견*

*Q1. 차단 범위 → 🔴 치명만 deny, 🟠 높음은 warn*

• 근거: 현재 ai-team에서 Bart가 실행하는 Bash 명령 패턴을 확인한 결과, 위험 명령은 대부분 빌드 정리 목적
• `rm -rf node_modules/`, `rm -rf .next/`, `rm -rf dist/`, `rm -rf build/`, `rm -rf coverage/` — 전부 정상 워크플로
• 🟠 높음(컨테이너, 파이프 실행)까지 deny하면 Bart에겐
### qa
회의 #11 스레드에 QA 관점 의견 제출 완료했습니다.

*요약:*
• *Q1*: 🔴 치명 3개만 차단 (현재 PreToolUse 훅 0개 → 점진적 도입)
• *Q2*: warn 1주 → deny 전환 (오탐률 측정 후)
• *Q3*: 고정 allowlist (에이전트 편집 불가, SecOps 리뷰 프로세스)
• *Q4*: 전 에이전트 동일 규칙 (검증 부담 7배 방지)
• *QA 특수 우려*: guard Hook 자체의 QA 계획 필수 + warn 로그 구조화 + QA Layer 3 테스트 명령 보호

## 최종 결정
:white_check_mark: *pm* 완료

*회의 #11 종합 — guard Hook 트리거 조건 최종 결정*

---

*1. 전원 합의 (Q3, Q4)*

• *Q3 — allowlist 고정 하드코딩*: 4명 전원 일치. 에이전트 편집 허용은 CWE-284 안티패턴 (Wiggum), guard 무력화 경로 (Homer/Bart). 변경 시 PR + SecOps 리뷰 필수.
• *Q4 — 전 에이전트 동일 규칙*: 4명 전원 일치. `PreToolUse` stdin에 에이전트 식별 수단 없음 (Homer), 차등 시 검증 부담 7배 (Chalmers).

---

*2. 충돌 지점 (Q1, Q2)*

*Q1 — 차단 범위:*

| 에이전트 | :red_circle: 치명 | :large_orange_circle: 높음 |
| --- | --- | --- |
| Homer | deny | ask |
| Wiggum | deny | deny |
| Bart | deny | warn |
| Chalmers | deny | 미적용 (점진적) |

:red_circle: 치명은 *전원 deny로 일치*. :large_orange_circle: 높음에서 갈림 — Wiggum만 즉시 deny, 나머지 3명은 warn 또는 ask.

*Q2 — 기본값 전략:*

| 에이전트 | :red_circle: 치명 | :large_orange_circle: 높음 |
| --- | --- | --- |
| Homer | 즉시 deny | warn → ask 단계 |
| Wiggum | 즉시 deny | 즉시 deny |
| Bart | 즉시 deny | warn 시작 |
| Chalmers | warn 1주 → deny | - |

:red_circle: 즉시 deny 3:1 (Chalmers만 warn 선행). :large_orange_circle:는 warn/ask 단계적 접근이 3:1.

---

*3. 최종 결정*

*2-Tier 전략 채택: :red_circle: 즉시 deny + :large_orange_circle: warn → deny 단계적 전환*

```
Tier 1 (🔴 치명) — 즉시 deny, 예외 없음
  • 재귀 삭제: rm -rf /, rm -rf ~, rm -rf *
  • Git 파괴: git reset --hard, git push --force, git checkout ., git restore .
  • DB 파괴: DROP TABLE, TRUNCATE, FLUSHALL

Tier 2 (🟠 높음) — warn 2주 → deny 전환
  • 컨테이너: docker system prune, kubectl delete namespace
  • 파이프 실행: curl | bash, wget | sh
  • 클라우드 파괴: terraform destroy, aws ec2 terminate-instances

🟡 중간 — Phase 2에서는 미적용, 데이터 수집 후 검토
  • chmod -R 777, /etc/ 쓰기, .env 편집

allowlist (하드코딩):
  • rm -rf node_modules|dist|.next|build|coverage|__pycache__|.turbo
  • 변경: PR + SecOps 리뷰 필수

fail-closed: Hook 스크립트 실패 시 deny 반환 (Wiggum 제안 수용)
정규식 우회 테스트: 공백 변형, 플래그 분리 패턴 포함 (Wiggum 제안 수용)
```

*근거:*
• :red_circle: 즉시 deny — 복구 불가능한 명령은 warn 단계가 무의미 (Homer/Bart/Wiggum 동의)
• :large_orange_circle: warn 먼저 — 현재 PreToolUse 훅 0개 상태에서 전면 deny는 오탐 폭발 위험 (Bart), 2주 오탐률 데이터 수집 후 deny 전환 (Chalmers 논거 수용)
• Chalmers의 ":red_circle:도 warn 선행" 제안은 기각 — 재귀 삭제/Git 파괴는 1회 실행으로 돌이킬 수 없어 warn 1주도 위험

---

*4. 다음 행동 항목*

• Homer: `guard-check.sh` + `settings.json` PreToolUse 블록 구현 (Phase 1+2 통합 위임)
• 포함 사항: Tier 1 deny 패턴, Tier 2 warn 패턴, allowlist, fail-closed, 정규식 우회 테스트
• Chalmers: guard Hook 자체 QA 계획 + warn 로그 구조화 검증 (Homer 구현 완료 후)
• 2주 후: warn 로그 분석 → Tier 2 deny 전환 여부 결정

Homer에게 Phase 1(Learnings JSONL) + Phase 2(guard Hook) 통합 위임 진행합니다.

## 구현 완료 (2026-04-06)
- **Status**: ✅ 완료
- **커밋**: `e7f1dd9` — guard-check.sh 7개 Critical 이슈 수정 + allowlist 오버매치 버그 수정
- **QA 검증**: 15/15 PASS (Tier1 deny 8건, Tier2 warn 2건, allowlist 2건, 일반 삭제 1건, fail-closed 1건, 플래그 분리 우회 1건)
- **settings.json 등록**: `settings.json:16-26` PreToolUse hook으로 등록 완료 (Bash|Write|Edit 매칭)
- **다음 마일스톤**: 2주 후 Tier 2 warn 로그 분석 → deny 전환 여부 결정