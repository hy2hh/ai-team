# 회의 결정: 에이전트 승인 노이즈 최소화 설계 — Read vs Write 권한 분리 전략
> 회의 ID: 8
> 유형: architecture
> 일시: 2026-03-31T04:34:11.759Z
> 참여자: backend, secops, researcher

## 의견 요약
### backend
---

*🏗️ Homer — 백엔드 관점 의견*

---

*1. 핵심 의견*

Claude의 permissions 구조는 *이미 도구별 세분화가 가능한 구조*입니다. 문제는 "read/write가 묶여 있다"가 아니라, *read 계열 도구가 allow 리스트에 충분히 등록되지 않은 것*입니다. 해결책은 MCP 도구를 read/write로 명시적 분류 후, read 계열을 `settings.json`에 일괄 추가하는 것입니다.

---

*2. 근거*

*현재 설정 구조 확인:*

• `settings.json:3-10` — 
### secops
---

*🔒 Wiggum (SecOps) — 회의 #8 독립 의견*

---

*1. 핵심 의견*

Read 도구의 자동 승인은 *보안상 허용 가능*합니다. 다만 분류 기준은 "부작용 유무"가 아니라 *"되돌리기 가능 여부(reversibility)"*로 설정해야 합니다. Read 작업도 민감 데이터 노출 가능성이 있으나, 현재 우리 환경(사내 Slack workspace, 내부 Jira/Confluence)에서는 신뢰 경계 내 운영이므로 read 자동 승인의 리스크가 승인 노이즈 비용보다 낮습니다.

---

*2. 근거 (코
### researcher
system-reminder에서 제공된 MCP 도구 목록을 확인했습니다. 이제 분석 결과를 정리하겠습니다.

---

*🔭 Lisa — Researcher 관점 의견*

---

*1. 핵심 의견*

*HTTP 메서드 기반 분류(GET=Read, POST/PUT/DELETE=Write)가 업계 표준*이며, MCP 도구에도 동일 원칙 적용이 가능합니다. 현재 Claude Code의 permission 구조는 이미 도구별 세분화를 지원하므로, *Read 도구 일괄 허용 + Write 도구 개별 승인* 패턴으로 노이즈 90% 이상 감소

## 최종 결정
*✅ 회의 #8 종합 결정 — 에이전트 승인 노이즈 최소화 설계*

---

*합의된 사항 (전원 동의)*

• *Read 도구 자동 승인 허용:* 보안 리스크 < 승인 노이즈 비용 (사내 신뢰 경계 내 운영)
• *Claude Code 권한 구조 이미 충분:* 도구+경로 조합으로 세분화 가능 — 새 구조 불필요
• *문제 진단:* "Read/Write가 묶여 있다"가 아니라 *Read 계열 도구가 allow 리스트에 미등록*
• *해결 방향:* MCP 도구를 Read/Write로 분류 후, Read 계열을 `settings.json`에 일괄 추가

---

*충돌 분석*

• *충돌 없음:* Backend, SecOps, Researcher 모두 동일 결론 도달
• *미세 차이 (실질적 동일):*
  - Wiggum: "되돌리기 가능 여부(reversibility)" 기준
  - Lisa: "HTTP 메서드(GET=Read, POST/PUT/DELETE=Write)" 기준
  - 실제 적용 시 두 기준은 동일 결과 → *reversibility 기준 채택* (의도가 더 명확)

---

*최종 결정*

*1. 분류 원칙*

• *Read (자동 승인):* 시스템 상태를 변경하지 않고, 되돌리기가 불필요한 작업
• *Write (개별 승인):* 시스템 상태를 변경하거나, 되돌리기가 어려운 작업

*2. MCP 도구 분류 (현재 파악된 항목)*

*Read 계열 (자동 승인 대상):*
• Slack: `slack_get_channel_history`, `slack_get_thread_replies`, `slack_get_user_profile`, `slack_get_users`, `slack_list_channels`
• Atlassian: `ATLASSIAN_READ_TOOLS` 22개 (이미 분류됨)
• Delegation: `recommend_next_phase` (조회성)

*Write 계열 (개별 승인 유지):*
• Slack: `slack_post_message`, `slack_reply_to_thread`, `slack_add_reaction`
• Atlassian: `transition_issue`, `add_comment`, `log_work`, `edit_issue`
• Delegation: `delegate`, `delegate_sequential`, `convene_meeting`, `run_qa`

*3. 구현 방안*

`settings.json`의 `permissions.allow` 배열에 Read 계열 도구 패턴 추가:
```
"mcp__slack__slack_get_*"
"mcp__slack__slack_list_*"
"mcp__delegation__recommend_next_phase"
```

*4. 예외 처리*

• *민감 데이터 접근 도구:* 추후 민감 정보 조회 도구 추가 시 SecOps 리뷰 후 분류 결정
• *신규 MCP 도구:* 도입 시 reversibility 기준으로 분류 → Read면 allow 리스트 추가

---

*다음 행동 항목*

*P0 — 즉시 실행 (Homer)*

• `[ ]` `settings.json` 또는 `settings.local.json`에 Read 계열 MCP 도구 패턴 추가
• `[ ]` 적용 후 승인 프롬프트 빈도 측정 (before/after 비교)

*P1 — 문서화 (Marge)*

• `[ ]` `.claude/agents/shared/permissions-policy.md` 신규 생성 — Read/Write 분류 기준 + 도구 목록

*검증 기준 (DoD)*

• Read 계열 도구 호출 시 승인 프롬프트 없이 자동 실행
• Write 계열 도구는 기존대로 승인 요청 동작
• 예상 효과: 승인 노이즈 70-90% 감소

---

*핵심 인사이트*

> _"권한 분리의 기준은 '무엇을 하느냐'가 아니라 '되돌릴 수 있느냐'다."_

Read/Write 분류의 본질은 HTTP 메서드나 도구 이름이 아니라 *reversibility*다. 되돌릴 수 없는 작업만 사람 승인을 받고, 되돌릴 수 있는 작업은 자동화하는 것이 노이즈와 보안의 균형점이다.