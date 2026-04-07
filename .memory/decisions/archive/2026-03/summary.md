# 2026년 3월 결정사항 요약 (아카이브)

> 개별 파일은 `/Users/sid/git/ai-team/.memory/decisions/` 루트에 원본 보관
> 상세 내용이 필요하면 해당 파일 직접 Read

## 결정사항 목록

| 날짜 | topic | 핵심 결정 | roles |
|------|-------|-----------|-------|
| 03-27 | process | 코드 리뷰 시 파일 직접 확인 필수 — researcher 오탐 사건 계기, 구조 추론 금지 | all |
| 03-28 | quality | 에이전트 자율 실행 품질 개선 — 카드 상세 모달 회고: 검증 단계 강화, 완료 기준 명확화 | all |
| 03-29 | prompting | CoVe/Self-Consistency/PoT 기법 → 적용 가치 낮음, "프롬프트 규칙 < 코드 강제" 원칙 유지 | all |
| 03-30 | prompting | Vercel v0 프롬프트 인사이트 적용 — 역할 특화 지시, 출력 형식 명확화, 간결성 강화 | all |
| 03-30 | operations | 컨설팅 진단 기반 팀 운영 개선 — 검증 루프 강화, Ralph Loop 도입 결정 | pm,backend |
| 03-30 | quality | Ralph Loop 근본 해결은 코드 강제 필요 — 컨텍스트 지시만으로 불충분하다는 결론 검증 | all |
| 03-30 | architecture | index.ts QA 실행 명령어 파싱 설계 — "QA 실행 docs/specs/xxx.md" → specPath 자동 추출 | backend |
| 03-30 | architecture | QA specPath 자동 전달 방안 — parseQACommand() 로직으로 Slack 명령어에서 경로 파싱 | backend |
| 03-31 | tooling | Claude Code vs Codex vs Gemini CLI 비교 → Claude Code 유지 (멀티에이전트 협업·MCP 우위) | all |
| 03-31 | tooling | Claude vs Codex 상세 비교 — Claude Code의 파일 조작·MCP·비용 효율 우위 확인 | all |
| 03-31 | architecture | 에이전트 승인 노이즈 최소화 — Read 자동 허용, Write만 승인 요청 (권한 분리 전략) | backend,secops |

## 핵심 패턴 (3월 전반)

1. **"코드 강제 > 프롬프트 지시"** 원칙이 여러 회의에서 반복 확인됨
2. Ralph Loop 도입 배경: 자율 실행 품질 문제를 구조적으로 해결하기 위함
3. 도구 비교 결과: Claude Code 생태계 유지 결정 (Codex/Gemini CLI 전환 없음)
4. QA 파이프라인 설계 기초 작업 완료 (specPath 파싱 → Chalmers QA로 이어짐)
