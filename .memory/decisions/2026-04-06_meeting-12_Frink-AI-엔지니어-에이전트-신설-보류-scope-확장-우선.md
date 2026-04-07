# 회의 결정: AI 엔지니어 에이전트(Frink) 신설 보류 — scope 확장 우선
> 회의 ID: 12
> 유형: planning
> 일시: 2026-04-06
> 참여자: backend, frontend, designer, secops, qa, researcher

## 결정
Frink 에이전트 신설을 **보류**하고 3단계 점진 접근을 채택한다.

## 근거
- 6명 중 5명 반대, Lisa만 조건부 찬성(scope 재정의 전제)
- 최근 스펙 6건 중 AI/ML 전담 0건 (QA), 월 2-3건 수준 (Frontend)
- 에이전트 추가 시 위임 경로 33% 증가·Guard Hook 패턴 추가 필요 (SecOps)
- 프롬프트 확장 벤치마크 열위 지적(Lisa) 유효하나, 현재 빈도에서는 유지보수 비용 > 전문화 이득

## 합의 사항
- 현 시점 Frink 독립 에이전트 신설은 시기상조 (전원)
- Homer/Bart scope 확장 우선 (전원)
- 데이터 기반 재평가 시점 필요 (전원)

## 액션 아이템

### Phase 1 — 즉시 (이번 주)
- Homer scope에 AI/ML 파이프라인 스킬 추가 (~15줄)
- Bart scope에 AI UI 컴포넌트 패턴 추가
- 태스크 로그에 `ai-ml` 태그 추가

### Phase 2 — 2주 관찰
- `ai-ml` 태그 태스크 빈도·Homer QA FAIL률 모니터링
- "AI Engineer 모드" 스킬 파일 설계 검토

### Phase 3 — 재평가 기준 (동시 충족 시 재논의)
- `ai-ml` 태스크 주 3회+ 또는 월 10건+
- Homer QA FAIL률 기존 대비 2배 이상 상승

## Lisa 소수 의견 (기록)
- "AI 엔지니어" → "시니어 풀스택 + 고난도 디버깅 전문"으로 scope 재정의 권장
- 업계 벤치마크: 전문화 > 범용화, 프롬프트 확장은 일관적 열위
- 태스크 빈도 충족 시 이 관점을 재평가에 반영할 것
