---
date: 2026-04-13
topic: architecture
roles: [frontend, backend, researcher]
summary: btcfi 예제 레포 에이전트 DX — 스킬 우선 + llms.txt 표준 병행, CLI는 스킬 내 bash 보조로만
status: accepted
---

# 회의 결정: btcfi platform 예제 레포 — 스킬 vs CLI(쉘 스크립트) 적합성 결정
> 회의 ID: 17
> 유형: architecture
> 일시: 2026-04-13
> 참여자: frontend(Bart), backend(Homer), researcher(Lisa)

## 배경
btcfi platform 예제 GitHub 레포에서, 워크플로우를 모르는 외부 개발자가 코딩 에이전트(Claude Code, Cursor, Copilot 등)를 사용해 동일 기능을 응용·구현할 수 있도록 지원 방식을 결정해야 함.

## 의견 요약

### frontend (Bart)
- **결론**: 스킬 우선, CLI는 보조
- DApp 예제는 컴포넌트 구조·지갑 연결·API 호출 패턴 등 "맥락 이해"가 핵심 → 스킬로 컨텍스트 직접 주입이 CLI stdout 파싱보다 정확
- CLI는 빌드/로컬 노드/배포 등 반복 실행 단순 작업만 → 스킬 내 bash 호출로 포함

### backend (Homer)
- **결론**: 스킬 우선 + 인프라 가드 로직 내장 필수
- DApp 예제 레포 최대 이탈 원인은 "환경 안 맞음" → 스킬 진입부에 노드 버전, 로컬 체인, 컨트랙트 배포 상태, .env 검증 자동화 필수
- 온체인 상태(잔고, allowance, nonce)가 오프체인 로직에 영향 → 스킬이 상태 조회 결과를 컨텍스트로 넘겨야 피드백 루프 성립
- 스킬 비대화 방지를 위해 도메인별 분리 필요 (setup / guide / contract / wallet / tx)
- 유일하게 CLI가 유리한 지점: `docker-compose up -d` 등 로컬 체인 기동

### researcher (Lisa)
- **결론**: 스킬 우선 + llms.txt 표준 병행
- llms.txt가 Anthropic·Cloudflare·Docker·HubSpot 등 주요 기업에서 채택된 에이전트 친화 표준으로 수렴 중
- Claude Code 전용 스킬만으로는 Cursor/Copilot/OpenCode 사용자 미커버 → llms.txt 레이어 필수
- 3-layer 구조 제안: CLAUDE.md(최소) + llms.txt(범용) + .claude/commands/(도메인 스킬)

## 최종 결정

### 합의 사항 (만장일치)
1. **스킬 우선, CLI 독립 제공 X** — 3명 전원 동의. CLI는 스킬 내 bash 호출로만 존재
2. **스킬의 핵심 가치 = 컨텍스트 주입** — 에이전트가 판단에 필요한 맥락(ABI, 네트워크 설정, 온체인 상태 등)을 직접 모델에 전달
3. **인프라 프리컨디션 검증 내장** — 스킬 진입 시 환경 자동 체크 (Homer 제안, 전원 동의)
4. **스킬 도메인별 분리** — 단일 거대 스킬 금지, 토큰 효율을 위해 단계별 분리

### 추가 채택: llms.txt 표준 병행 (Lisa 제안)
- **근거**: Claude Code 전용 구조만으로는 타 에이전트 사용자 커버 불가. 업계 표준 수렴 방향에 부합.
- CLAUDE.md는 최소 컨텍스트만, llms.txt/llms-full.txt로 범용 에이전트 진입점 제공

### 확정 레포 구조 (3-layer + 보조 CLI)

```
btcfi-dapp-starter/
├── CLAUDE.md                  # 프로젝트 맵 + 핵심 컨벤션 (최소 토큰)
├── llms.txt                   # 에이전트 친화 요약 (llmstxt.org 표준)
├── llms-full.txt              # 전체 아키텍처·API·컨트랙트 상세
├── .claude/
│   └── commands/
│       ├── setup.md           # 환경 검증 + 로컬 체인 기동 (가드 로직)
│       ├── scaffold.md        # 컴포넌트/컨트랙트 스캐폴딩
│       ├── deploy.md          # 빌드·테스트·배포 워크플로우
│       └── explain.md         # 아키텍처 설명 + 응용 가이드
└── scripts/
    ├── dev.sh                 # 보조: 로컬 개발 서버/체인
    ├── deploy.sh              # 보조: 컨트랙트 배포
    └── seed.sh                # 보조: 테스트 데이터
```

### 역할 분리 원칙
- **스킬**: 에이전트가 판단하는 데 필요한 컨텍스트 (what & why)
- **CLI(bash)**: 반복 실행되는 부작용(side effect) 명령 (how) — 스킬 내에서만 호출

### 리스크 및 완화
| 리스크 | 완화 방안 |
|--------|-----------|
| 스킬 유지보수 부담 (ABI 변경 등) | 스킬이 artifacts/ 디렉토리를 동적 참조, 하드코딩 금지 |
| llms-full.txt 크기 비대화 | 섹션별 분리 또는 MCPDoc 서버 활용 |
| CLAUDE.md + llms.txt + 스킬 3곳 싱크 | 자동 생성 파이프라인(Mintlify/Fern) 도입 검토 |
| OS별 로컬 체인 환경 차이 | setup 스킬에서 docker-compose 기반 표준화 |

## 다음 행동
1. btcfi 예제 레포에 위 3-layer 구조 스캐폴딩
2. setup.md 스킬에 인프라 가드 로직(노드 버전, 체인 상태, .env 검증) 우선 구현
3. llms.txt / llms-full.txt 초안 작성
4. CLAUDE.md 최소 컨텍스트 버전 작성
