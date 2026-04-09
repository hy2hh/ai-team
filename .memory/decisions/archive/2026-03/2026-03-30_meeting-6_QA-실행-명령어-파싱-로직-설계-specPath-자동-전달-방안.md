---
date: 2026-03-30
topic: architecture
roles: [backend, researcher]
summary: QA specPath 자동 전달 — parseQACommand() Slack 명령어 경로 파싱 로직 설계
---

# 회의 결정: QA 실행 명령어 파싱 로직 설계 — specPath 자동 전달 방안
> 회의 ID: 6
> 유형: architecture
> 일시: 2026-03-30T22:23:43.460Z
> 참여자: backend, researcher

## 의견 요약
### backend
---

*🏗️ Homer — 백엔드 관점 의견*

---

*1. 핵심 의견*

`runRalphLoop()`는 Cross-verify FAIL 시 자동 호출되는 *재작업 루프*이므로, 사용자의 "QA 실행" 명령어 진입점으로 부적절합니다. specPath 기반 QA 모드 직접 실행은 `runChalmersQA()`를 호출하는 *별도 핸들러*를 만들고, 키워드 라우팅 단계에서 경로 패턴을 감지하여 분기해야 합니다.

---

*2. 근거*

현재 코드베이스 확인 결과:

• *`runRalphLoop()`의 목적:* Cross-
### researcher
업계 모범 사례와 현재 코드 구조를 교차 분석했습니다.

---

*🔭 Lisa — Researcher 관점 의견*

---

*1. 핵심 의견*

*키워드 라우팅 확장 방식*을 권장합니다. 현재 라우팅의 `ROUTING_RULES` 패턴 매칭에서 *QA 트리거 + specPath 캡처*를 동시에 처리하는 것이 기존 아키텍처와 가장 정합성이 높고, 업계의 "명시적 명령어(explicit command)" 트렌드와도 일치합니다.

---

*2. 근거*

*현재 코드 구조 분석:*
• `router.ts:37` — QA 키워

## 최종 결정
*✅ 회의 #6 종합 결정 — QA 실행 명령어 파싱 로직 설계 (회의 #5 수정)*

---

*합의된 사항 (전원 동의)*

• *키워드 라우팅 확장:* 기존 `ROUTING_RULES` 구조에 specPath 캡처 로직 추가
• *정규식 기반 파싱:* LLM 불필요, 0ms 결정론적 라우팅
• *파일 검증 시점:* 라우터가 아닌 실행 단계에서 (`runChalmersQA()` 진입 시)

---

*충돌 분석 — 회의 #5 결정 수정 필요*

Homer가 중요한 아키텍처 이슈를 제기:

• *회의 #5 결정:* `runRalphLoop(specPath)`에 specPath 전달
• *Homer 지적:* `runRalphLoop()`는 *Cross-verify FAIL 시 자동 호출되는 재작업 루프* — 사용자 명령어 진입점으로 부적절

*근거 (코드 확인):*
```
qa-loop.ts:342-414 — runRalphLoop() 흐름:
  1. requestRework() — 재작업 요청
  2. runCrossVerification() — 재검증
  3. runChalmersQA() — 최종 QA (루프 내부에서만 호출)
```

사용자가 "QA 실행"을 입력하면 *재작업 없이 바로 QA 검증*을 원하는 것. `runRalphLoop()`를 타면 불필요한 rework 단계가 실행됨.

---

*최종 결정 (회의 #5 수정)*

*1. 진입점 분리*

• *사용자 명령어 `QA 실행`:* 별도 핸들러 → `runChalmersQA()` 직접 호출
• *Cross-verify FAIL:* 기존 `runRalphLoop()` 유지 (자동 재작업 루프)

*2. 신규 핸들러 생성*

`qa-loop.ts`에 `runDirectQA()` 함수 신규 추가:
```typescript
export const runDirectQA = async (
  specPath: string,
  event: SlackEvent,
  pmApp: App,
): Promise<QAResult>
```

• 재작업 없이 `runChalmersQA()` 직접 호출
• specPath 파일 존재 검증 포함
• 결과를 Slack에 보고

*3. 라우팅 흐름*

```
"QA 실행 docs/specs/xxx.md"
    ↓
router.ts — parseQACommand() → { isQACommand: true, specPath: "..." }
    ↓
index.ts — QA 명령어 감지 시 runDirectQA() 호출
    ↓
qa-loop.ts — runDirectQA() → runChalmersQA()
```

*4. 명령어 패턴 (회의 #5와 동일)*

```
QA_COMMAND_PATTERN = /(?:QA|qa)\s*(?:실행|검증|run)\s+(docs\/specs\/[^\s]+\.md)/i
```

*5. specPath 없을 때 (회의 #5와 동일)*

에러 메시지 + 사용법 안내 (자동 선택 금지)

---

*다음 행동 항목 (수정됨)*

*P0 — Homer 담당 ✅ 완료 (2026-03-31)*

• `[x]` `router.ts` — `parseQACommand()` 함수 추가
• `[x]` `types.ts` — `RoutingResult`에 `specPath?: string`, `isQACommand?: boolean` 추가
• `[x]` `qa-loop.ts` — `runDirectQA()` 신규 함수 (재작업 없이 QA 직접 실행)
• `[x]` `index.ts` — QA 명령어 감지 시 `runDirectQA()` 분기 처리
• `[x]` 파일 존재 검증 + 에러 처리

*검증 기준 (완료 조건)*

• `QA 실행 docs/specs/xxx.md` → Chalmers QA 모드 직접 실행 (재작업 단계 없음)
• Cross-verify FAIL → 기존 `runRalphLoop()` 동작 유지
• 존재하지 않는 스펙 경로 → 명확한 에러 메시지
• `tsc --noEmit` 통과

---

*핵심 인사이트*

> _"진입점과 자동 루프를 분리하라"_

사용자 명시적 명령어(`QA 실행`)와 시스템 자동 트리거(`Cross-verify FAIL`)는 같은 검증 함수를 호출하더라도 *다른 경로*를 타야 한다. 재작업 루프에 사용자 명령어를 끼워넣으면 불필요한 단계가 실행되고 의도와 동작이 불일치한다.