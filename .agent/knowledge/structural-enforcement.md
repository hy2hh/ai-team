# LLM 지시 대신 구조적 강제
> Auto-promoted: 2026-03-26 (8 occurrences in sprint logs)
> Last verified: 2026-03-26

## Summary
LLM에게 "X를 해라"라고 지시하는 것은 실행을 보장하지 않음. 특히 단일 턴 Agent SDK 호출에서는 더욱 불확실. 코드가 직접 처리하거나, 도구 접근을 제거하는 방식으로 구조적으로 강제해야 함.

## Evidence
- [2026-03-25]: "Slack에 응답하세요" 지시 → 일부 에이전트만 실행. formatSlackEventAsPrompt 모든 방식에 추가로 해결
- [2026-03-26]: "1번만 호출하세요" 지시 → 중복 포스팅. Slack 쓰기 도구 제거로 해결
- [2026-03-26]: ".memory/ 읽어라" 지시 → 단일 턴에서 미실행. 코드가 직접 주입으로 해결
- [2026-03-26]: 브로드캐스트 "자기 파트만" → 프롬프트 규칙 + 공유 메모리 주입으로 해결

## Pattern
지시(prompt) < 도구 제거(structural) < 코드 주입(programmatic)
