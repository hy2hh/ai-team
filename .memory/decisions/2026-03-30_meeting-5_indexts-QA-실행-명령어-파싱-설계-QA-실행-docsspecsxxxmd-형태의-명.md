# 회의 결정: index.ts QA 실행 명령어 파싱 설계 — "QA 실행 docs/specs/xxx.md" 형태의 명령어를 인식하여 specPath를 runRalphLoop()에 전달하는 라우팅/파싱 로직 설계
> 회의 ID: 5
> 유형: architecture
> 일시: 2026-03-30T22:23:09.285Z
> 참여자: pm, backend, researcher

## 의견 요약
### pm
현재 코드를 확인했습니다. PM 관점에서 의견을 제시합니다.

---

*🧭 PM(Marge) — 회의 #5 독립 의견*

---

*1. 핵심 의견*

"QA 실행" 명령어는 *keyword 단계에서 정규식으로 감지 + specPath 추출*이 최적입니다. LLM 파싱은 과잉 — 명령어 형식이 구조화되어 있으면 정규식이 100% 정확하고 0ms 라우팅입니다. 사용자 경험상 `@Chalmers QA 실행 docs/specs/xxx.md` 형태가 가장 직관적입니다.

---

*2. 근거*

*현재 코드 구조 (직접 확인):*
• 
### backend
*🏗️ Homer — Backend Architect 의견*

---

*1. 핵심 의견*

*keyword 라우팅 단계에 QA 전용 파서를 추가하는 것이 최적*입니다. QA 명령어는 패턴이 명확하고(`/qa`, `QA 실행` + 스펙 경로), LLM 파싱 비용을 지불할 이유가 없습니다. 정규식 기반 파싱이 결정적(deterministic)이고 비용 0입니다.

---

*2. 근거 (코드 기반)*

현재 routing 구조 확인:
• `socket-bridge/src/index.ts`의 라우팅 흐름: mention 체크 → co
### researcher
이제 업계 트렌드와 유사 시스템 사례를 조사하여 의견을 제시하겠습니다.

---

*🔭 Lisa — Researcher 관점 의견*

---

*1. 핵심 의견*

*정규식 기반 파싱 + 키워드 단계 확장*이 가장 적합합니다. "QA 실행"은 명시적 명령어(intent)이므로 LLM 판단 없이 결정론적으로 라우팅해야 합니다. 업계 챗봇/CLI 도구들의 일관된 패턴은 *"명령어는 정규식, 자연어는 LLM"* 분리입니다.

---

*2. 근거*

*현재 코드베이스 사실 확인:*
• `router.ts:29-38` — 이미 키워드 기

## 최종 결정
*✅ 회의 #5 종합 결정 — QA 실행 명령어 파싱 설계*

---

*합의된 사항 (전원 동의)*

• *파싱 방식:* 정규식 기반 — LLM 파싱 불필요 (명령어 형식이 구조화됨)
• *감지 위치:* keyword 단계 확장 — 기존 `ROUTING_RULES` 구조 활용
• *결정론적 라우팅:* "명령어는 정규식, 자연어는 LLM" 분리 원칙 (업계 표준)
• *specPath 추출:* 정규식 캡처 그룹 사용
• *파일 검증 위치:* 라우터가 아닌 `runChalmersQA()` 진입 시점 (라우팅 지연 방지)

---

*충돌 분석*

• *충돌 없음:* PM, Backend, Researcher 모두 동일 결론. 각자 다른 관점(사용자 경험, 구현 구조, 업계 사례)에서 독립적으로 도달한 결론이 완전 일치.

---

*최종 결정*

*1. 명령어 패턴 (지원 범위)*

```
QA_COMMAND_PATTERN = /(?:QA|qa)\s*(?:실행|검증|run)\s+(docs\/specs\/[^\s]+\.md)/i
```

• 지원: `QA 실행 docs/specs/xxx.md`, `qa run docs/specs/xxx.md`, `QA 검증 docs/specs/xxx.md`
• `@Chalmers` 멘션은 기존 mention 단계에서 처리 → QA 명령어 패턴은 텍스트 본문만 파싱

*2. 구현 위치*

• `router.ts`에 `parseQACommand(text): { isQACommand: boolean, specPath?: string }` 신규 함수
• `RoutingResult` 타입에 `specPath?: string` 필드 추가
• `routeMessage()` 내 keyword 단계 직전에 QA 명령어 우선 감지

*3. specPath 없을 때 (fallback)*

• *에러 메시지 + 사용법 안내* (Option A 채택)
• 이유: 자동 선택은 의도 불일치 위험 — 명시적 실패가 안전

```
❌ 스펙 경로가 필요합니다.
사용법: QA 실행 docs/specs/YYYY-MM-DD_feature-name.md
```

*4. 파일 존재 검증*

• `runChalmersQA()` 진입 직후 `fs.existsSync(specPath)` 체크
• 파일 없으면 즉시 에러 반환 + Slack 메시지

*5. 중복 실행 방지 (AC-EC2)*

• 기존 `qa-loop.ts`의 `getLoopState(ts, agent)` 활용 — 동일 ts + qa 조합이면 스킵

---

*다음 행동 항목*

*P0 — 즉시 실행 (Homer)*

• `[ ]` `router.ts` — `parseQACommand()` 함수 추가 + `RoutingResult`에 `specPath` 필드
• `[ ]` `router.ts` — `routeMessage()`에서 keyword 단계 전 QA 명령어 감지 로직 삽입
• `[ ]` `types.ts` — `RoutingResult` 타입에 `specPath?: string` 추가
• `[ ]` `index.ts` — 라우팅 결과의 `specPath`를 `runRalphLoop()` 호출 시 전달
• `[ ]` `qa-loop.ts` — `runChalmersQA()` 시작부에 파일 존재 검증 + 에러 처리

*검증 기준 (DoD)*

• `QA 실행 docs/specs/2026-03-30_qa-agent.md` 입력 시 Chalmers가 QA 모드로 실행됨
• 존재하지 않는 스펙 경로 입력 시 명확한 에러 메시지 반환
• `tsc --noEmit` 통과 + 런타임 테스트

---

*핵심 인사이트*

> _"명령어는 정규식, 자연어는 LLM"_

구조화된 명령어에 LLM을 사용하는 것은 비용 낭비이자 비결정론적 동작의 원인이다. 0ms 정규식 파싱으로 100% 정확도를 달성할 수 있는 케이스에서 500ms+ LLM 호출은 정당화되지 않는다.