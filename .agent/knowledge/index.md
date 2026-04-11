# Knowledge Index

- [structural-enforcement.md](structural-enforcement.md) — LLM 지시 대신 구조적 강제 (도구 제거, 코드 주입)
- [hub-pattern-latency.md](hub-pattern-latency.md) — Hub 패턴 응답 시간은 의도된 트레이드오프 (2분+는 정상)
- Adaptive Harness 파이프라인: `~/.claude/adaptive-harness/`. Stop 훅 순서: event-logger → pattern-aggregator → discovery-logger → harness-evolver. changelog.md 없음 = 정상 (변경 없으면 생성 안 함). 동작 확인은 discoveries.jsonl 항목 수로.
- [vector-search-deferred.md](vector-search-deferred.md) — .memory/ 벡터 검색 도입 검토 (문서 수 1000+ 도달 시)
