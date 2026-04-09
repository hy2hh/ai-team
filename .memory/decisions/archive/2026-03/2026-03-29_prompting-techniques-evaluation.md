---
date: 2026-03-29
topic: prompting
roles: [all]
summary: CoVe/SC/PoT 프롬프팅 기법 적용 가치 낮음 — "코드 강제 > 프롬프트 지시" 원칙 재확인
---

# Decision: 프롬프팅 기법 3개(CoVe, Self-Consistency, PoT) 적용 가치 검증
Date: 2026-03-29
Decided by: Meeting (PM, Backend, Frontend, Researcher, SecOps)
Status: accepted

## Context
CoVe(Chain of Verification), Self-Consistency, Program of Thoughts 3개 프롬프팅 기법을
현재 AI Team 멀티 에이전트 프레임워크에 적용하는 것의 실질적 가치를 평가.

프로젝트 핵심 철학: "프롬프트 규칙 < 코드 강제" (buildContextRulesPrefix에서 규칙 주입,
bridge에서 도구 호출로 강제)

## Options Considered

### Option 1: 3개 기법 모두 적용 (Aggressive)
- CoVe를 cross-verify 프롬프트에 삽입
- Self-Consistency를 HIGH 리스크 회의에서 3회 독립 추론 + 다수결
- PoT를 Homer 페르소나에 추가
- 비용: Self-Consistency 3배, CoVe 1.5배, PoT 1.3배 토큰 증가
- A/B 테스트로 효과 검증 (표본 부족으로 통계 유의성 확보 어려움)

### Option 2: PoT만 선택적 적용 + 측정 인프라 (Balanced)
- Homer에 조건부 PoT 규칙 1줄 추가
- verification_results 메트릭 확장
- 1개월 데이터 수집 후 재판단

### Option 3: 아무것도 추가하지 않고 현행 시스템 코드 개선 (Conservative)
- cross-verify 2000자 제한 완화
- PASS/WARN/FAIL 파싱 구조화
- baseline 데이터 수집 먼저

## Decision

**Option 3 선택**: 3개 프롬프팅 기법 모두 현시점에서는 적용하지 않는다.

### 근거

1. **해결할 구체적 문제 미식별**: 기법 적용이 개선할 구체적 실패 사례나 metrics가 없다.
   cross-verify FAIL 비율, 회의 결정 품질 등의 baseline 데이터 자체가 없다.

2. **이미 동등/더 강력한 구조가 코드 레벨에서 존재**:
   - CoVe vs 현재: 서로 다른 에이전트(다른 페르소나, 다른 checkItems)가 이미 cross-verify.
     CoVe는 같은 모델의 자기검증이므로 본질적으로 열등하다.
   - Self-Consistency vs 현재: meeting.ts가 이미 다수 전문가의 독립 의견을 병렬 수집.
     같은 에이전트 3회 추론은 systematic bias를 공유하므로 pseudo-independence일 뿐.
   - PoT vs 현재: Homer에 이미 Bash 도구 + "EXPLAIN ANALYZE" 규칙이 존재.
     추가 프롬프트는 이미 가능한 행동의 재지시.

3. **프로젝트 철학과의 충돌**: buildContextRulesPrefix에 이미 "사실 기반 응답",
   "코드/파일을 직접 읽고 확인" 규칙이 존재. 프롬프트 기법 추가는 중복이며
   코드 강제라는 강점을 희석한다.

4. **비용 불균형**: Self-Consistency 3배 비용은 확정적, 효과는 불확실.
   열린 설계 문제에서 다수결의 효과는 학술적으로 미검증.

5. **더 급한 코드 레벨 개선 존재**:
   - cross-verify.ts의 producerResult.slice(0, 2000) 제한
   - PASS/WARN/FAIL 문자열 파싱의 불안정성
   - 검증자가 실제 파일을 보지 않는 구조적 문제

## Consequences

### 즉시 실행
- [ ] cross-verify 2000자 제한 완화 또는 변경 파일 경로 전달 (Homer)
- [ ] PASS/WARN/FAIL 파싱 구조화 (Homer)
- [ ] verification_results FAIL 비율 baseline 측정 (Marge)
- [ ] 멀티 에이전트 시스템 프롬프팅 기법 사례 조사 (Lisa, 대비용)

### 재논의 트리거 (Red Flags)
- cross-verify FAIL 비율 > 30%
- 회의 결정을 sid가 뒤집는 비율 > 50%
- Homer 성능 분석에서 코드 실행 없이 추측하는 사례 반복

### 1개월 후
- baseline 데이터 기반으로 프롬프팅 기법 재논의 여부 결정
- 효과가 확인될 구체적 문제가 있으면 Scenario 2(PoT + 측정)로 전환

## Key Insight
"프롬프팅 기법을 적용해야 하는가?"보다 "현재 시스템의 어떤 구체적 문제를 해결하려는가?"가
먼저 답해져야 한다. 문제 정의 없이 솔루션을 먼저 논의하는 것은 PM 원칙에 위배된다.
