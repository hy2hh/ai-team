# 회의 결정: Claude Code vs Codex vs Gemini CLI 3파전 비교 — 우리 ai-team 시스템 관점에서 코딩 에이전트 성능, 멀티 에이전트 협업 지원, MCP 호환성, 비용, 컨텍스트 길이, 도구 사용 능력, 통합 용이성을 포함한 3자 비교 분석. 회의 #7(Claude vs Codex) 결론을 기반으로 Gemini CLI를 추가 비교 대상으로 포함.
> 회의 ID: 1
> 유형: ad-hoc
> 일시: 2026-03-31T08:26:02.818Z
> 참여자: researcher, backend, pm

## 의견 요약
### researcher
충분한 데이터를 수집했습니다. Researcher 관점에서 의견을 제시합니다.

---

*🔭 Lisa — Researcher 관점 의견*

---

*1. 핵심 의견*

Gemini CLI는 *비용 접근성과 컨텍스트 길이에서 강점*이 있으나, *멀티 에이전트 오케스트레이션 미지원*이 우리 ai-team 아키텍처와 구조적으로 호환되지 않습니다. 2026년 3월 기준 벤치마크 데이터를 종합하면, Claude Code 유지 결론은 여전히 유효하며 Gemini CLI 추가로 전환 트리거가 활성화되지 않습니다.

---

*2. 근거 (
### backend
현재 시스템의 SDK 의존성을 확인했습니다. 이제 백엔드 아키텍트 관점에서 의견을 제시합니다.

---

*🏗️ Homer (Backend) — 회의 #1 독립 의견*

---

*1. 핵심 의견*

백엔드 인프라 관점에서 *Claude Code 유지가 유일한 합리적 선택*입니다. 현재 시스템은 `@anthropic-ai/claude-agent-sdk`에 구조적으로 의존하며, MCP 서버 3개(`delegation`, `escalation`, `permission`)가 핵심 오케스트레이션 레이어입니다. Gemini CLI 또는 C
### pm
충분한 정보를 수집했습니다. PM 관점에서 의견을 제시합니다.

---

*🧭 PM(Marge) 회의 의견*

---

*1. 핵심 의견*

Claude Code 유지를 권장합니다. 단, 이번 조사에서 *Gemini CLI가 MCP를 네이티브 지원한다*는 예상 외 사실이 확인되었으므로, 회의 #7의 조건부 전환 트리거를 업데이트해야 합니다. 전환 비용(6개 에이전트 + bridge 재작성 + 프롬프트 튜닝 손실)이 현시점 이점을 압도하며, 성능 격차도 여전히 Claude 우위입니다.

---

*2. 근거 (검색 결과 기반)*



## 최종 결정
*✅ 회의 #1 최종 결정 — Claude Code vs Codex vs Gemini CLI 3파전 비교*

---

*합의된 사항 (전원 동의)*

• *Claude Code 유지 확정*: PM, Backend, Researcher 전원이 현시점 전환 불필요에 동의
• *전환 비용 > 이점*: 6개 에이전트 정의 + 3개 커스텀 MCP 서버(`delegation`, `escalation`, `permission`) + bridge 재작성 = 2-3주 풀타임 개발 + 리그레션 리스크
• *성능 우위 유지*: Claude Opus 4.6 (80.8%) > Gemini 3.1 Pro Preview (78.80%) > Gemini 2.5 Pro (73.1%) > Codex (64.7%)
• *배경 정보 정정*: Gemini CLI는 MCP를 *네이티브 지원함* — Google이 2026년 공식 관리형 MCP 서버까지 발표. "MCP 지원 여부 불명확"은 오정보였음

---

*충돌 분석*

• *충돌 없음*: 3개 에이전트 모두 동일 결론. 다만 강조점이 다름:
  - PM: 전환 트리거 업데이트 필요성
  - Backend: SDK 의존성(`@anthropic-ai/claude-agent-sdk`) + 인프라 재설계 비용
  - Researcher: 멀티 에이전트 오케스트레이션 미지원 (Gemini CLI의 구조적 한계)

---

*최종 결정*

*1. Claude Code 유지 (현상 유지)*

*2. 회의 #7 조건부 전환 트리거 업데이트:*

~삭제~:
• "Gemini가 MCP 지원 시" → 이미 지원함, 트리거 무효화

*신규 트리거 추가:*
• *성능 역전*: SWE-bench에서 Gemini > Claude + 2개월 연속 유지 시
• *비용 임계값*: 월 Claude 비용 $500 초과 + Gemini 성능 동등(±2%p) 시
• *생태계 의존도*: GCP/Firebase/BigQuery 작업이 로드맵의 30% 이상 점유 시
• *멀티 에이전트 지원*: Gemini CLI가 `--agent` 플래그 또는 동등한 subagent 오케스트레이션 기능 추가 시

*3. Codex 비교 대상 재정의:*
• "OpenAI Codex"는 GPT-5 계열로 대체됨 — 향후 비교 시 "GPT-5.x + Codex CLI" 또는 후속 제품으로 명명

---

*3자 비교 요약*

• *Claude Code*: 성능 1위, 멀티 에이전트 네이티브, MCP 생태계 선두, 유료
• *Gemini CLI*: 무료, 1M 컨텍스트, MCP 지원, 멀티 에이전트 오케스트레이션 미지원
• *Codex/GPT-5.x*: 성능 2위권, MCP 지원 제한적, 멀티 에이전트 별도 구축 필요

---

*다음 행동 항목*

• `[x]` *즉시*: 이 결정을 `.memory/decisions/`에 기록 — PM
• `[ ]` *이번 주*: 회의 #7 결정 문서에 "트리거 업데이트됨" 주석 추가 — PM
• `[ ]` *6개월 후 (2026-09)*: Gemini 4 출시 시점에 3자 비교 재수행 — Researcher 리드
• `[ ]` *분기별*: 비용 모니터링 + 트리거 조건 점검 — PM

---

*핵심 인사이트*

이번 회의의 가장 큰 수확은 *Gemini CLI MCP 지원 확인*입니다. 이는 "Claude가 MCP 생태계 독점"이라는 가정을 깨뜨리며, 향후 전환 결정 시 MCP 호환성이 더 이상 차별화 요소가 아님을 의미합니다. 전환 결정의 핵심 변수는 이제 *멀티 에이전트 오케스트레이션 지원 여부*와 *SWE-bench 성능 격차*로 좁혀졌습니다.