# 회의 결정: btcfi platform 예제 레포 — 스킬 vs CLI(쉘 스크립트) 적합성 결정
> 회의 ID: 17
> 유형: architecture
> 일시: 2026-04-13T04:20:35.134Z
> 참여자: backend, researcher

## 의견 요약
### backend
*1. 핵심 의견*

스킬 우선 + CLI 보조 구조가 맞습니다. 단, 백엔드 관점에서 핵심은 *스킬이 인프라 상태를 검증하는 가드 로직을 내장해야 한다*는 점입니다. btcfi DApp은 로컬 노드, 컨트랙트 배포 상태, RPC 엔드포인트 등 *외부 의존성이 많아서* 단순 코드 가이드만으로는 개발자가 막히는 지점이 많습니다. 스킬이 이 의존성 체크를 자동화해야 에이전트 DX가 성립합니다.

*2. 근거*

• *컨텍스트 주입 효율*: btcfi 워크플로우(지갑 연결 → 컨트랙트 호출 → tx 서명 → 상태 확인)는 각 단계마다 필요한 컨텍스트가 다릅니다. 스킬은 단계별로 관련 ABI, 네트워크 설정, 컨트랙트 주소를 모델에 직접 주입할 수 있지만, CLI는 stdout 텍스트를 파싱해야 해서 에이전트가 맥락을 놓칠 확률이 높습니다.

• *인프라 프리컨디션 검증*: 백엔드 경험상 DApp 예제 레포의 최대 이탈 원인은 "환경 안 맞음"입니다. 스킬 진입부에 다음을 bash로 검증하
### researcher
회의 #17 스레드에 리서치 의견을 제출했습니다.

*요약:*
• *스킬 우선 + llms.txt 표준 병행* 추천 — Bart 의견에 동의하되 llms.txt 레이어 추가를 강조
• 근거: llms.txt가 Anthropic·Cloudflare·Docker 등 주요 기업에서 채택된 에이전트 친화 표준으로 수렴 중이며, Claude Code 전용 스킬만으로는 다른 에이전트(Cursor, Copilot, OpenCode) 사용자를 커버 못함
• 3-layer 구조 제안: `CLAUDE.md`(최소 컨텍스트) + `llms.txt/llms-full.txt`(범용 에이전트 진입점) + `.claude/commands/`(도메인 스킬)
• CLI는 독립 제공 X, 스킬 내부 bash 호출로만 존재

## 최종 결정
회의 #17 종합 완료.

*처리 내역:*
• Frontend·Backend·Researcher *만장일치* → *스킬 우선 + llms.txt 표준 병행* 결정
• 충돌 사항 없음. Lisa의 llms.txt 레이어 제안이 Bart·Homer 안에 보강 채택됨
• 결정 파일 생성: `.memory/decisions/2026-04-13_meeting-17_btcfi-platform-스킬-vs-CLI-적합성-결정.md`
• `_index.md` 테이블 행 추가 완료
• Slack 스레드에 종합 결과 회신 완료

*핵심 결정:* 3-layer 구조 — `CLAUDE.md`(최소 토큰) + `llms.txt/llms-full.txt`(범용 에이전트 진입점) + `.claude/commands/`(도메인 스킬 4종). CLI는 스킬 내 bash 보조로만 존재하며 독립 제공하지 않음.