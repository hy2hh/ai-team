# gstack 프로젝트 분석 및 ai-team 도입 방안

> 분석일: 2026-04-06
> 분석자: Main Agent (Opus 4.6)
> 소스: `/Users/sid/git/gstack`
> 대상: `/Users/sid/git/ai-team`

---

## 목차

1. [gstack 프로젝트 개요](#1-gstack-프로젝트-개요)
2. [gstack 핵심 아키텍처 패턴](#2-gstack-핵심-아키텍처-���턴)
3. [gstack 스킬 상세 분석](#3-gstack-스킬-상세-분���)
4. [ai-team 현재 상태 분석](#4-ai-team-현재-상태-분석)
5. [갭 분석: gstack vs ai-team](#5-갭-분석-gstack-vs-ai-team)
6. [도입 가능한 패턴 상세](#6-도입-가능한-패턴-상세)
7. [에���전트별 적용 방안](#7-에이전트별-적용-방안)
8. [우선순위 및 로드맵](#8-우선순위-및-로드���)

---

## 1. gstack 프로���트 개요

### 1.1 정체성

gstack은 Garry Tan(YC CEO)이 만든 **AI 엔지니어링 워크플로 프레임워크**다. Claude Code를 가상 엔지니어링 팀으로 변환하는 23개 이상의 구조화된 SKILL.md 파일과 persistent headless browser로 구성된다.

핵심 철학: "한 사람 + AI로 20명 팀이 할 일을 한다." 일일 10,000+ LOC, 주간 100+ 커밋을 파트타임으로 달성하는 것이 목표.

### 1.2 기술 스택

| 항목 | 기술 |
|------|------|
| 런타임 | Bun (Node.js 대체) |
| 브라우저 | Playwright + Chromium (데몬 모델) |
| 빌드 | `bun build --compile` (단일 바이너리 ~58MB) |
| 테스트 | Bun 네이티브 테스트 러너 + LLM-as-judge |
| 상태 관리 | JSONL 파일 기반 (SQLite는 쿠키 복호화만) |
| 호스트 지원 | Claude Code, Codex, Cursor, Factory, Kiro, OpenCode, Slate, OpenClaw |

### 1.3 디렉토리 구조

```
gstack/
├── browse/              # 헤드리스 브라우저 (Playwright CLI + Bun 서버)
│   ├── src/             # cli.ts, server.ts, browser-manager.ts, snapshot.ts
│   ├── test/            # 통합 테스트 + 픽스처
│   └── dist/            # 컴파일된 바이너리
├── hosts/               # 호스트별 설정 (claude.ts, codex.ts, cursor.ts 등 8개)
├── scripts/             # 빌드 파이프라인
│   ├── gen-skill-docs.ts     # 템플릿 → SKILL.md 생성기
│   ├── resolvers/             # 프리앰블, 디자인, 리뷰 등 리졸버
│   └── skill-check.ts        # 스킬 헬스 대시보드
├── test/                # 테스트 인프라 (40+ 파일)
│   ├── helpers/         # session-runner, llm-judge, eval-store, touchfiles
│   └── fixtures/        # ground truth, planted bugs
├── bin/                 # CLI 유틸리티 (28개)
│   ├── gstack-learnings-log     # 학습 기록
│   ├─��� gstack-learnings-search  # 학습 검색
│   ├── gstack-slug              # 프로젝트 식별자
│   ├── gstack-telemetry-log     # 분석 수집
│   └── gstack-timeline-log      # 타임라인 기록
├── lib/                 # 공유 라이브러리 (worktree.ts)
├── extension/           # Chrome 확장 (사이드 패널 + 활동 피드)
│
│ ── 스킬 디렉토리 (각각 SKILL.md.tmpl + SKILL.md) ──
├── office-hours/        # YC 오피스 아워 (제품 진단 + 브레인스톰)
├── plan-ceo-review/     # CEO 레벨 전략 리뷰
├── plan-eng-review/     # 엔지니어링 아키텍처 리뷰
├── plan-design-review/  # 디자인 감사 (0-10 채점)
├── plan-devex-review/   # 개발자 경험 감사
├── autoplan/            # 자동 리뷰 파이프라인 (CEO→디자인→엔지→DX)
├── review/              # PR 코드 리뷰 (도메인별 specialist 체크리스트)
├── design-review/       # 디자인 감사 + 수정 루프
├── design-consultation/ # 디자인 시스템 구축
├── design-shotgun/      # 빠른 디자인 탐색
├── design-html/         # HTML → 디자인 변환
├── devex-review/        # DX 감사 (실시간 타임 트래킹)
├── investigate/         # 체계적 디버깅 (5단계)
├── qa/                  # 실제 브라우저 QA 테스트
├── qa-only/             # 보고서만 (코드 변경 없음)
├── ship/                # 배포 워크플로 (테스트→리뷰→버전→PR)
├── land-and-deploy/     # 머지→배포→카나리 검증
├── document-release/    # 배포 후 문서 업데이트
├── canary/              # 배포 후 모니터링
├── benchmark/           # 성능 회귀 감지
├── cso/                 # 보안 감사 (OWASP + STRIDE)
├── retro/               # 주간 회고 (기여자별 분석)
├── learn/               # 프로젝트 학습 관리
├── checkpoint/          # 세션 상태 저장/복원
├── careful/             # 파괴적 명령 경고
├── freeze/              # 디렉토리별 편집 제한
├── guard/               # careful + freeze 통합
├── codex/               # 크로스 모델 리뷰 (Codex 2차 의견)
├── canary/              # 배포 후 시각적 모니터링
│
├── ETHOS.md             # 빌더 철학 (Boil the Lake, Search Before Building)
├── CLAUDE.md            # 개발 가이드
├── AGENTS.md            # 스킬 목록 + 빌드 명령
├── ARCHITECTURE.md      # 시스템 내부 구조
├── DESIGN.md            # 디자인 시스템
├── BROWSER.md           # 브라우저 명령 참조
└── conductor.json       # Conductor 오케스트레이션 설정
```

### 1.4 핵심 철학 (ETHOS.md)

#### 1. Boil the Lake — 완전한 구현의 비용은 거의 0

AI 지원 코딩 시대에 "90% 구현"과 "100% 구현"의 차이는 몇 분이다. 항상 100%를 선택한다.

| 작업 유형 | 사람 팀 | AI 지원 | 압축률 |
|-----------|---------|---------|--------|
| 보일러플레이트 | 2일 | 15분 | ~100x |
| 테스트 작성 | 1일 | 15분 | ~50x |
| 기능 구현 | 1주 | 30분 | ~30x |
| 버그 수정 + 회귀 테스트 | 4시간 | 15�� | ~20x |
| 아키텍처/설계 | 2일 | 4시간 | ~5x |
| 리서치/탐색 | 1일 | 3시간 | ~3x |

**Lake vs Ocean**: Lake(100% 테스트 커버리지, 전체 기능, 모든 엣지케이스)는 끓일 수 있다. Ocean(전체 시스템 재작성, 다분기 플랫폼 마이그레이션)은 안 된다. Lake를 끓이고 Ocean은 범위 밖으로 표시한다.

#### 2. Search Before Building — 3단계 지식 계층

- **Layer 1 (Tried-and-true)**: 표준 패턴, 검증된 접근법. 위험은 "당연한 답이 맞다고 가정"하는 것
- **Layer 2 (New-and-popular)**: 현재 베스트 프랙티스, 블로그, 트렌드. 검색하되 비판적으로 평가
- **Layer 3 (First-principles)**: 원리적 사고에서 나온 독창적 관찰. 가장 가치 있다

**Eureka Moment**: 검색의 최고 결과는 복사할 솔루션이 아니다. (1) 모든 사람이 왜 그렇게 하는지 이해 (Layer 1+2), (2) 그 가정에 원리적 추론 적용 (Layer 3), (3) 기존 접근이 틀린 이유 발견 — 이것이 "11점 만점 중 11점"

#### 3. User Sovereignty — AI는 추천, 사용자가 결정

두 AI 모델이 합의한 변경이라도 사용자 방향과 다르면 → 추천 제시 + 이유 설명 + 빠진 맥락 인정 + 질문. 절대 독단 행동 안 함.

---

## 2. gstack 핵심 아��텍처 패턴

### 2.1 Preamble Harness (14단계 부트스트랩)

모든 스킬이 실행될 때 자동으로 거치는 14단계 초기화 시퀀스:

```
1.  업데이트 확인 → gstack 업그레이드 가능 여부 탐지, 4가지 옵션 제시
2.  세션 추적 → ~/.gstack/sessions/${PPID} 마커 생성
3.  세션 정리 → 120분 이상 된 세션 파일 제거
4.  프로액티브 감지 → 설정 읽어서 다른 스킬로 자동 라우팅
5.  브랜치 감지 → git branch --show-current
6.  스킬 접두사 → 설정에서 네이밍 규칙 확인 (gstack-qa vs qa)
7.  레포 모드 → npm/python/rust/monorepo/unknown 자동 감지
8.  Lake 소개 → "Boil the Lake" 철학 최초 1회 소개
9.  텔레메트리 → 최초 1회 수집 동의 (community/anonymous/off)
10. 프로액티브 → 최초 1회 자동 호출 활성화 여부
11. 학습 로드 → ~/.gstack/projects/$SLUG/learnings.jsonl에서 관련 학습 검색
12. 타임라인 기록 → 스킬 시작 이벤트 기록 (로컬 전용)
13. 라우팅 규칙 → CLAUDE.md 스킬 라우팅 규칙 확인
14. 생성 세션 감지 → OPENCLAW_SESSION 환경변수 (인터랙티브 프롬프트 억제)
```

**ai-team 시사점**: 현재 ai-team의 session-bootstrap.md는 5단계(git pull, memory load, fact validation, task check, handoff check)뿐이다. gstack처럼 학습 로드, 성능 추적, 컨텍스트 자동 수집을 추가해야 한다.

### 2.2 Learnings System (자동 학습)

gstack의 가장 핵심적인 혁신. 모든 스킬이 작업 후 자동으로 학습을 기록하고, 다음 작업 전에 검색한다.

#### 저장 구조

```
~/.gstack/projects/{SLUG}/learnings.jsonl
```

각 줄은 하나의 학습 항목:

```json
{
  "skill": "review",
  "type": "pitfall",
  "key": "n-plus-one-lazy-loading",
  "insight": "lazy loading 설정 누락으로 N+1 쿼리 발생. includes() 확인 필수",
  "confidence": 8,
  "source": "observed",
  "files": ["src/api/users.ts", "src/models/user.ts"],
  "ts": "2026-04-01T10:00:00Z"
}
```

#### 학습 타입

| type | 설명 | 예시 |
|------|------|------|
| `pattern` | 반복되는 성공 패턴 | "API 라우트에서 zod 스키마 검증 패턴이 에러 감소" |
| `pitfall` | 반복되는 함정 | "React useEffect에서 cleanup 누락 → 메모리 릭" |
| `preference` | 사용자 선호 | "이 프로젝트는 Prisma 대신 Drizzle ORM 사용" |
| `architecture` | 아키텍처 인사이트 | "WebSocket 대신 SSE가 이 유스케이스에 적합" |
| `tool` | 도구 관련 학습 | "bun test는 --timeout 플래그 지원 안 함" |

#### 핵심 메커니즘

1. **Append-only 저장**: 수정 대신 새 항목 추가. 읽기 시 "latest winner" (같은 key+type 중 최신)로 dedup
2. **Confidence decay**: `observed`/`inferred` 소스는 30일마다 -1점 자동 감소. 오래된 지식은 자연 소멸
3. **Cross-project 검색**: `--cross-project` 플래그로 다른 프로젝트 학습도 참조 가능
4. **스킬 통합**: 대부분의 스킬이 시작 시 `{{LEARNINGS_SEARCH}}` 템플릿으로 관련 학습 로드, 종료 시 `{{LEARNINGS_LOG}}`로 새 학습 기록

#### 관련 CLI 도구

- `bin/gstack-learnings-log` — JSON 문자열을 받아 learnings.jsonl에 추가 (타임스탬프 자동 주입)
- `bin/gstack-learnings-search` — 타입/키워드 필터링, confidence decay 적용, dedup, 제한된 결과 반환

#### `/learn` 스킬 (학습 관리)

```
/learn          → 최근 20개 학습 표시 (타입별 그룹)
/learn search   → 키워드 검색
/learn prune    → 참조 파일 존재 확인, 모순 감지, 정리 제안
/learn export   → CLAUDE.md에 추가할 수 있는 마크다운 형식 출력
/learn stats    → 총 항목수, 타입별/소스별 분포, 평균 confidence
/learn add      → 수동 학습 추가
```

### 2.3 Hook 기반 안전장치

gstack은 SKILL.md 프론트매터에 hooks를 선언하여 도구 실행 전 자동 체크를 수행한다.

#### `/careful` — 파괴적 명령 경고

```yaml
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "bash ${CLAUDE_SKILL_DIR}/bin/check-careful.sh"
          statusMessage: "Checking for destructive commands..."
```

감지 패턴:

| 패턴 | 예시 | 위험 |
|------|------|------|
| `rm -rf` / `rm -r` | `rm -rf /var/data` | 재귀 삭제 |
| `DROP TABLE` / `DROP DATABASE` | `DROP TABLE users;` | 데이터 손실 |
| `TRUNCATE` | `TRUNCATE orders;` | 데이터 손실 |
| `git push --force` / `-f` | `git push -f origin main` | 히스토리 재작성 |
| `git reset --hard` | `git reset --hard HEAD~3` | 미커밋 작업 손실 |
| `git checkout .` / `git restore .` | `git checkout .` | 미커밋 작업 손실 |
| `kubectl delete` | `kubectl delete pod` | 프로덕션 영향 |
| `docker rm -f` / `docker system prune` | `docker system prune -a` | 컨테이너 손실 |

안전 예외: `rm -rf node_modules`, `.next`, `dist`, `__pycache__`, `.cache`, `build`, `.turbo`, `coverage`

#### `/freeze` — 디렉토리 범위 편집 제한

Edit/Write 도구 호출 전에 대상 파일이 허용 디렉토리 내에 있는지 확인. 디버깅 중 관련 없는 코드 수정 방지.

#### `/guard` — careful + freeze 통합

한 명령으로 파괴적 명령 경고 + 디렉토리 편집 제한을 동시 활성화.

### 2.4 Review Specialists

gstack의 `/review` 스킬은 도메인별 전문 체크리스트를 `review/specialists/` 디렉토리에 보관:

```
review/
├── checklist.md          # 리뷰 기준 매트릭스
├── TODOS-format.md       # 발견 사항 형식
├── greptile-triage.md    # Greptile 연동 분류
└── specialists/
    ├── api-contract.md     # API 표면 영역 검증
    ├── security.md         # 인젝션, 인증, CSRF, 암호화
    ├── testing.md          # 커버리지, 엣지케이스
    ├── performance.md      # N+1, 메모리 릭, 느린 경로
    ├── maintainability.md  # 코드 품질, 중복
    ├── red-team.md         # 적대적 사고
    └─��� data-migration.md   # 스키마 안전
```

각 specialist는 독립적으로 해당 도메인의 리뷰를 수행하고 결과를 통합한다. `/review`의 "Review Army" 템플릿 변수(`{{REVIEW_ARMY}}`)가 이 specialist들을 병렬로 실행한다.

### 2.5 Complexity-based Dispatch

gstack의 OpenClaw 통합에서 작업 복잡도에 따라 다른 수준의 지원을 제공:

| 레벨 | 기준 | 행동 |
|------|------|------|
| SIMPLE | <10 LOC, 명확한 수정 | 기본 프롬프트만 |
| MEDIUM | 다중 파일, 명확한 접근법 | gstack-lite CLAUDE.md 주입 |
| HEAVY | 사용자가 특정 스킬 지명 | 전체 스킬 로드 |
| FULL | 기능/프로젝트 범위 | 전체 gstack 로드 |
| PLAN | 코드 전 설계 필요 | gstack-plan 로드 |

### 2.6 Decision Classification (자동 결정 분류)

`/autoplan`에서 사용하는 결정 분류 체계:

| 분류 | 정의 | 행동 |
|------|------|------|
| **Mechanical** | 하나의 정답이 명확 | 자동 결정, 로그만 남김 |
| **Taste** | 합리적인 사람이 다르게 판단 가능 | 자동 결정 + 최종 게이트에서 보고 |
| **User Challenge** | 두 모델 모두 사용자 방향 변경 권장 | 절대 자동 결정 안 함, 사용자에게 반드시 질문 |

Taste 결정의 3가지 소스:
1. **Close approaches** — 상위 2개가 모두 유효하되 트레이드오프가 다름
2. **Borderline scope** — blast radius 내이지만 3-5 파일, 또는 radius가 모호
3. **Codex disagreements** — 다른 모델이 다르게 추천하며 타당한 근거 있음

### 2.7 6가지 자동 결정 원칙

`/autoplan`에서 중간 질문을 자동 응답하는 6가지 원칙:

1. **Choose completeness** — 더 많은 엣지케이스를 커버하는 방향 선택
2. **Boil lakes** — blast radius(수정 파일 + 직접 임포터) 내 모든 것 수정. blast radius 내 + CC 1일 미만(<5 파일, 새 인프라 없음) 확장은 자동 승인
3. **Pragmatic** — 두 옵션이 같은 효과면 깔끔한 쪽. 5초 선택, 5분이 아님
4. **DRY** — 기존 기능 중복이면 거부. 있는 것 재사용
5. **Explicit over clever** — 10줄 명확한 수정 > 200줄 추상화. 새 기여자가 30초에 읽을 수 있는 것 선택
6. **Bias toward action** — 머지 > 리뷰 싸이클 > 방치된 논의. 우려 표시하되 차단하지 않음

충돌 해결 (단계별 우선순위):
- **CEO 단계**: P1(completeness) + P2(boil lakes) 지배
- **Eng 단계**: P5(explicit) + P3(pragmatic) 지배
- **Design 단계**: P5(explicit) + P1(completeness) 지배

---

## 3. gstack 스킬 상세 분석

### 3.1 Think Phase (사고 단계)

#### `/office-hours` — YC 오피스 아워

역할: **YC 오피스 아워 파트너**. 솔루션 제안 전 문제 이해를 강제한다.

두 가지 모드:
- **Startup Mode**: 6가지 강제 질문 — 수요 현실, 현재 상태, 절실한 구체성, 가장 좁은 쐐기, 관찰, 미래 적합성
- **Builder Mode**: 디자인 씽킹 브레인스톰 — 해커톤, 학습, 오픈소스, 사이드 프로젝트

HARD GATE: 코드 출력 절대 금지. 디자인 문서만 생성.

운영 원칙:
- "구체성이 유일한 화폐" — 모호한 답변은 푸시
- "관심은 수요가 아니다" — 대기자 목록, 가입은 안 세. 행동, 돈, 패닉이 수요
- "사용자의 말이 창업자 피치를 이긴다" — 사용자가 묘사하는 가치가 진실
- "데모하지 말고 관찰하라" — 가이드된 워크스루는 의미 없음. 뒤에서 지켜보기

#### `/plan-ceo-review` — CEO 전략 리뷰

4가지 스코프 모드: expansion, selective, hold, reduction

#### `/plan-eng-review` — 엔지니어링 아키텍처 리뷰

데이터 플로, 상태 머신, 에러 경로, 테스트 매트릭스 검증

#### `/plan-design-review` — 디자인 감사

5가지 차원에서 0-10 채점. 각 차원에서 10점이 어떤 모습인지 설명. AI slop(AI가 만든 것 같은 제네릭 디자인) 감지.

### 3.2 Build Phase (구현 단계)

#### `/autoplan` — 자동 리뷰 파이프라인

CEO → Design → Eng → DX 순서로 자동 실행. 6가지 결정 원칙으로 중간 질문 자동 응답. Taste 결정만 최종 승인 게이트에서 보고.

**필수 순서**: CEO → Design → Eng → DX (병렬 실행 금지, 각 단계가 이전 결과 위에 빌드)

"자동 결정"의 의미:
- 분석은 그대로 수행 (코드 읽기, 다이어그램 생성, 표 작성)
- 판단만 6원칙으로 대체 (사용자 질문 대신)
- 예외: 전제(Phase 1)와 User Challenge는 절대 자동 결정 안 함

### 3.3 Review Phase (리뷰 단계)

#### `/review` — PR 코드 리뷰

단계:
1. 브랜치 확인 (기본 브랜치면 중단)
2. 체크리스트 로드 (`review/checklist.md`)
3. Greptile 리뷰 코멘트 확인 (있으면)
4. diff 가져오기 (`git fetch origin <base> --quiet && git diff origin/<base>`)
5. 학습 검색 (관련 과거 학습 로드)
6. Critical pass — SQL 안전, Race Condition, LLM 신뢰 경계, Shell Injection, Enum 완전성
7. Review Army — 도메인별 specialist 병렬 실행
8. Confidence 보정 — 각 발견 사항에 confidence 점수 부여

핵심 원칙: "Search-before-recommending" — 수정 패턴 추천 시 해당 프레임워크 버전의 현재 베스트 프랙티스인지 검증

#### `/codex` — 크로스 모델 리뷰

Claude와 OpenAI Codex가 모두 리뷰하고, 합의/고유 발견을 대시보드로 표���.

### 3.4 Test Phase (테스트 단계)

#### `/qa` — 실제 브라우저 QA

실제 Chromium 열어서 클릭, 양식 작성, 스크린샷 캡처. 버그 발견 시 자동 수정 + 회귀 테스트 + 재검증.

#### `/qa-only` — 보고서만 (코드 변경 없음)

`/qa`와 동일하지만 버그 보고서만 생성, 코드 수정 없음.

### 3.5 Ship Phase (배포 단계)

#### `/ship` — 완전 자동 배포

비대화형, 완전 자동화. `/ship` 입력 후 PR URL이 나올 때까지 중단 없이 실행.

단계:
1. Pre-flight: 브랜치 확인, git 상태, diff 크기
2. 리뷰 준비 대시보드: CEO/Design/Eng 리뷰 상태 확인
3. 테스트 실행 + 커버리지 감사
4. 버전 범프 (MICRO/PATCH 자동, MINOR/MAJOR만 질문)
5. CHANGELOG 자동 생성
6. bisectable 커밋 분할
7. Push
8. PR 생성

멈추는 경우만:
- 기본 브랜치에 있을 때
- 자동 해결 불가 머지 충돌
- 인브랜치 테스트 실패
- 리뷰에서 ASK 항목
- MINOR/MAJOR 버전 범프

멈추지 않는 경우:
- 미커밋 변경 (항상 포함)
- CHANGELOG 내용 (자동 생성)
- 커밋 메시지 승인 (자동)
- 다중 파일 변경 (자동 분할)

#### `/land-and-deploy` — 머지 → 배포 → 카나리

#### `/document-release` — 배포 후 문서 업데이트

README, ARCHITECTURE, CONTRIBUTING 등 모든 문서를 배포 내용에 맞게 자동 업데이트.

### 3.6 Monitor Phase (모니터링 단계)

#### `/canary` — 배포 후 시각적 모니터링

역할: **릴리스 신뢰성 엔지니어**. CI는 통과했지만 프로덕션에서 깨지는 것을 잡는다.

인수:
- `/canary <url>` — 10분 모니터링
- `/canary <url> --baseline` — 배포 전 베이스라인 캡처
- `/canary <url> --duration 5m` — 커스텀 모니터링 기간
- `/canary <url> --pages /,/dashboard,/settings` — 특정 페이지 모니터링
- `/canary <url> --quick` — 단일 패스 헬스 체크

모니터링 루프 (60초 간격):
1. 페이지 로드 실패 → CRITICAL
2. 새 콘솔 에러 (베이스라인에 없던 것) → HIGH
3. 성능 회귀 (로드 시간 2x 초과) → MEDIUM
4. 깨진 링크 (새 404) → LOW

핵심 원칙:
- **변화에 알림, 절대값에 알림 아님** — 베이스라인 대비 비교
- **거짓 경보 방지** — 2회 연속 체크에서 지속되는 패턴만 알림
- **스크린샷이 증거** — 모든 알림에 스크린샷 경로 포함

#### `/benchmark` — 성능 회귀 감지

역할: **성능 엔지니어**. 성능은 한 번에 큰 회귀로 죽지 않는다 — 천 개의 종이컷으로 죽는다.

측정 항목: TTFB, FCP, LCP, DOM Interactive, DOM Complete, Full Load, 번들 크기, CSS 크기, 총 요청 수, 총 전송 크기

회귀 임계값:
- 타이밍: >50% 증가 또는 >500ms 절대 증가 = REGRESSION
- 타이밍: >20% 증가 = WARNING
- 번들 크기: >25% 증가 = REGRESSION, >10% = WARNING
- 요청 수: >30% 증가 = WARNING

성능 예산 (업계 기준):
- FCP < 1.8s, LCP < 2.5s
- 총 JS < 500KB, 총 CSS < 100KB
- 총 전송 < 2MB, HTTP 요청 < 50개

### 3.7 Reflect Phase (회고 단계)

#### `/retro` — 주간 회고

역할: 시니어 IC/CTO 레벨 빌더를 위한 종합 엔지니어링 회고.

인수:
- `/retro` — 기본 7일
- `/retro 24h` / `14d` / `30d` — 커스텀 기간
- `/retro compare` — 현재 기간 vs 이전 동일 기간 비교
- `/retro global` — 크로스 프로젝트 회고 (모든 AI 코딩 도구)

수집 데이터 (병렬 실행):
1. 모든 커밋 (해시, 작성자, 시간, 제목, 변경 통계)
2. 커밋별 테스트 vs 프로덕션 LOC 분류
3. 커밋 타임스탬프 (세션 감지 + 시간별 분포)
4. 핫스팟 분석 (가장 자주 변경된 파일)
5. PR/MR 번호 추출
6. 작성자별 파일 핫스팟
7. 작성자별 커밋 수
8. Greptile 트리아지 히스토리 (있으면)
9. TODOS.md 백로그 (있으면)
10. 테스트 파일 수 + 기간 내 변경된 테스트 파일 수

메트릭: 커밋 수, 기여자 수, 머지된 PR 수, 삽입/삭제, 순 LOC, 테스트 LOC 비율, 활성 일수, 세션 수, 평균 LOC/세션시간, 백로그 건강도, 스킬 사용량, Eureka 모먼트

### 3.8 Safety Phase (안전 단계)

#### `/investigate` — 체계적 디버깅

**Iron Law: 근본 원인 조사 없이 수정 금지.**

5단계:
1. **Phase 1: Root Cause Investigation** — 증상 수집, 코드 읽기, 최근 변경 확인, 재현
2. **Scope Lock** — 영향 받는 모듈로 편집 범위 제한 (`/freeze` 연동)
3. **Phase 2: Pattern Analysis** — 패턴 매칭 테이블:
   - Race condition: 간헐적, 타이밍 의존적 → 공유 상태 동시 접근
   - Nil/null propagation: NoMethodError, TypeError → 옵셔널 값 누락 가드
   - State corruption: 불일치 데이터, 부분 업데이트 → 트랜잭션, 콜백, 훅
   - Integration failure: 타임아웃, 예상치 못한 응답 → 외부 API, 서비스 경계
   - Configuration drift: 로컬 동작, 스테이징/프로덕션 실패 → 환경변수, 기능 플래그, DB 상태
   - Stale cache: 오래된 데이터, 캐시 클리어로 수정 → Redis, CDN, 브라우저 캐시
4. **Phase 3: Hypothesis Testing** — 단일 가설 검증, 3-strike rule (3번 실패 시 강제 중단 + 아키텍처 재검토)
5. **Phase 4: Implementation** — 실패 테스트 먼저 작성, 단일 수정 (근본 원인만), 전체 테스트 스위트 실행

Debug Report 형식:
```
DEBUG REPORT
════════════════════════════════════════
Symptom:         [사용자가 관찰한 것]
Root cause:      [실제로 잘못된 것]
Fix:             [변경 내용, file:line 참조]
Evidence:        [테스트 출력, 수정 후 재현 시도]
Regression test: [새 테스트 file:line]
Related:         [TODOS.md 항목, 같은 영역 과거 버그, 아키텍처 노트]
Status:          DONE | DONE_WITH_CONCERNS | BLOCKED
════════════════════════════════════════
```

#### `/cso` — 보안 감사

역할: **Chief Security Officer**. 실제 침해 대응을 이끌고 이사회에 보안 포스처를 보고한 경험.

모드:
- `/cso` — 전체 일일 감사 (8/10 confidence gate)
- `/cso --comprehensive` — 월간 심층 스캔 (2/10 bar)
- `/cso --infra` — 인프라만
- `/cso --code` — 코드만
- `/cso --skills` — 스킬 공급망만
- `/cso --diff` — 브랜치 변경만
- `/cso --supply-chain` — 의존성만
- `/cso --owasp` ��� OWASP Top 10만

15단계:
- Phase 0: 아키텍처 멘탈 모델 + 스택 감지
- Phase 1: 공격 표면 센서스 (코드 + 인프라)
- Phase 2: 시크릿 고고학 (git 히스토리, .env, 하드코딩)
- Phase 3: 의존성 공급망
- Phase 4: CI/CD 파이프라인 보안
- Phase 5: 컨테이너/인프라 보안
- Phase 6: 네트워크/배포 보안
- Phase 7: LLM/AI 보안
- Phase 8: 스킬 공급망 스캔
- Phase 9: OWASP Top 10
- Phase 10: STRIDE 위협 모델링
- Phase 11: 능동적 검증
- Phase 12: Security Posture Report 생성
- Phase 13: 트렌드 추적 (이전 감사 대비)
- Phase 14: 학습 기록

### 3.9 Context Phase (컨텍스트 단계)

#### `/checkpoint` — 세션 상태 저장/복원

역할: **꼼꼼한 세션 노트를 유지하는 Staff Engineer**

저장 내용:
1. 작업 중인 것 — 고수준 목표 또는 기능
2. 내린 결정 — 아키텍처 선택, 트레이드오프, 접근법과 이유
3. 남은 작업 — 우선순위 순 구체적 다음 단계
4. 노트 — 주의사항, 차단된 항목, 열린 질문, 시도했지만 안 된 것

체크포인트 파일 형식:
```markdown
---
status: in-progress
branch: feat/auth
timestamp: 2026-03-31T14:30:00-07:00
session_duration_s: 3600
files_modified:
  - src/auth/login.ts
  - src/auth/session.ts
---

## Working on: Auth Refactor

### Summary
로그인 플로를 JWT에서 세션 기반으로 전환 중. 50% 진행.

### Decisions Made
- Redis 대신 DB 세션 선택 (운영 복잡성 감소)
- Refresh token rotation 구현 (보안 강화)

### Remaining Work
1. 로그아웃 엔드포인트 구현
2. 세션 만료 처리
3. 테스트 작성

### Notes
- cookie SameSite=Lax는 크로스 오리진 문제 발생 가능 → Strict로 변경 검토
- csrf 토큰은 다음 PR로 분리
```

크로스 브랜치 복원 지원: 한 브랜치에서 저장한 체크포인트를 다른 브랜치에서 복원 가능.

#### `/health` — 코드 품질 대시보드

역할: **CI 대시보드를 관리하는 Staff Engineer**

5개 카테고리 가중 점수:
- Type check (25%): tsc, pyright 등
- Lint (20%): biome, eslint, ruff 등
- Tests (30%): bun test, pytest, cargo test 등
- Dead code (15%): knip
- Shell lint (10%): shellcheck

0-10 점수 + 가중 합산 = Composite Score

트렌드 추적: `~/.gstack/projects/$SLUG/health-history.jsonl`에 JSONL로 기록, 최근 10회 추이 표시.

회귀 감지: 점수 하락 시 어떤 카테고리가 하락했는지, 구체적 에러/경고 상관관계 표시.

개선 제안: impact(weight × score deficit) 기준 우선순위 정렬.

---

## 4. ai-team 현재 상태 분석

### 4.1 에이전트 구성 (7+1)

| 에이전트 | 역할 | 도구 | 주요 강점 |
|----------|------|------|-----------|
| **Triage** | 메시지 라우팅 | Read, Write, Edit | 5초 분류, SQLite 클레임, 복합 작업 체이닝 |
| **Marge (PM)** | 제품 전략 | WebFetch, WebSearch, Read, Write, Edit | 로드맵, 이해관계자 정렬, 발견→출시 |
| **Krusty (Designer)** | UI/UX | Read, Write, Edit | Bifrost 디자인 시스템, 접근성 |
| **Bart (Frontend)** | React/TS | Read, Write, Edit, Bash, Glob, Grep | Core Web Vitals, 컴포넌트 아키텍처 |
| **Homer (Backend)** | 시스템 아키텍처 | Read, Write, Edit, Bash, Glob, Grep | DB 설계, API 계약, 마이크로서비스 |
| **Lisa (Researcher)** | 시장 조사 | WebFetch, WebSearch, Read, Write, Edit | 트렌드 분석, 경쟁 분석 |
| **Wiggum (SecOps)** | 보안 | Read, Write, Edit, Bash, Glob, Grep | STRIDE, OWASP, defense-in-depth |
| **Chalmers (QA)** | 품질 검증 | Bash, Read, Glob, Grep, Slack | 3단계 검증, 코드 리뷰, 학습 루프 |

### 4.2 공유 규칙

| 파일 | 역할 | 핵심 내용 |
|------|------|-----------|
| `routing-rules.md` | 3단계 라우팅 | @mention → 키워드 → LLM 폴백 |
| `collision-prevention.md` | 단일 응답자 보장 | SQLite claims 테이블 |
| `cross-domain-coordination.md` | 크로스 도메인 핸드오프 | `.memory/handoff/chain-{id}.md` |
| `session-bootstrap.md` | 세션 시작 프로토콜 | git pull → 메모리 로드 → 팩트 검증 |
| `collaboration-rules.md` | 협업 규칙 | 역할 경계, 권한, 구조적 추론 |
| `react-process.md` | 피드백 대응 | 9단계: 수신→분석→이의→재작업→자가리뷰→재검증→에스컬레이션→학습루프→훅분류 |
| `code-quality-standards.md` | 코드 품질 | 편집→즉시 에러 확인, TDD, 자가 리뷰 |

### 4.3 기존 스킬

```
.claude/skills/
├── agent-plan/         # 기획 프로토콜
├── agent-delegate/     # 위임 + 교차 검증
├── agent-handoff/      # 순차/병렬 작업 오케스트레이션
├── agent-implement/    # TDD 구현 파이프라인
├── agent-review/       # 코드 리뷰 (병렬 체크)
├── agent-tdd/          # Red-Green-Refactor 강제
├── agent-verify/       # 완료 전 검증
├── agent-debug/        # 체계적 디버깅 (4단계)
├── agent-api-contract/ # API 계약 라이프사이클
└── restart-bridge/     # 브릿지 재시작
```

### 4.4 메모리 구조

```
.memory/
├── facts/          # 영구 지식 (team-profile, project-context, services)
├── tasks/          # 에이전트별 활성 태스크 + 백로그 + 완료
├── decisions/      # YYYY-MM-DD_{topic}.md 아키텍처/전략 결정
├── handoff/        # 에이전트 간 지식 전달
├── conversations/  # 중요 크로스 에이전트 토론 (7일 만료)
└── claims/         # SQLite memory.db (브릿지 관리)
```

### 4.5 학습 메커니즘 (현재)

react-process.md §8에 정의:
- §8-1: 3회 동일 실패 → lesson 파일 → 체크리스트 승격
- §8-2: 3회 성공 패턴 → 스킬 후보 → PM 리뷰 → 스킬 승격
- §8-3: QA 메트릭 축적 (PASS/FAIL per agent/date/category)
- §8-4: Chalmers 메타 분석 (10회 QA마다 반복 실패 패턴 식별)
- §8-5: Triage 라우팅 적응 (3회 라우팅 오류 → 키워드 테이블 수정 제안)

---

## 5. 갭 분석: gstack vs ai-team

### 5.1 자가 학습 (Learn)

| 차원 | gstack | ai-team | 갭 |
|------|--------|---------|-----|
| 학습 기록 | 매 작업 자동 기록 (JSONL) | 3회 실패 후 수동 lesson 파일 | **수동 vs 자동**, 기록 임계값 차이 |
| 학습 검색 | 작업 시작 시 자동 검색 | 없음 | **작업 전 학습 활용 없음** |
| Confidence decay | 30일마다 -1점 자동 감소 | 없음 | **오래된 지식 소멸 메커니즘 없음** |
| Cross-project | 다른 프로젝트 학습 참조 가능 | 없음 | 단일 프로젝트 고립 |
| 학습 관리 | `/learn` 스킬 (검색, 정리, 내보내기, 통계) | 없음 | **학습 관리 도구 없음** |
| 양방향 학습 | 리뷰어/피리뷰어 모두 학습 | 한 방향만 (FAIL→Rule) | **대칭 학습 없음** |

### 5.2 자가 진단 (Self-Diagnose)

| 차�� | gstack | ai-team | 갭 |
|------|--------|---------|-----|
| 코드 헬스 | `/health` (5개 카테고리, 0-10 점수, 트렌드) | 없음 | **코드 품질 자동 측정 없음** |
| 성능 추적 | `/benchmark` (Core Web Vitals, 번들 크기) | 없음 | **성능 회귀 감지 없음** |
| 보안 감사 | `/cso` (15단계, OWASP, STRIDE) | Wiggum 수동 리뷰 | **구조화된 감사 프로토콜 부재** |
| 디버깅 | `/investigate` (5단계, scope lock, 3-strike) | `agent-debug` (4단계, scope lock 없음) | **Scope Lock, Pattern Table 없음** |
| 메모리 건강 | learnings prune (파일 존재 확인, 모순 감지) | 없음 | **메모리 무결성 검증 없음** |
| 규칙 효과성 | 없음 (양쪽 다) | 없음 | 양쪽 모두 갭 |

### 5.3 자율 행동 (Act Autonomously)

| 차원 | gstack | ai-team | 갭 |
|------|--------|---------|-----|
| 자동 리뷰 파이프라인 | `/autoplan` (CEO→Design→Eng→DX, 6원칙) | 핸드오프 체인 (판단 기준 없음) | **자동 판단 원칙 없음** |
| 결정 분류 | Mechanical/Taste/User Challenge | 없음 | **결정 자동화 수준 미분류** |
| 안전장치 | hooks (careful, guard, freeze) | 규칙 텍스트만 | **런타임 강제 장치 없음** |
| 배포 자동화 | `/ship` (비대화형 완전 자동) | 수동 | **배포 워크플로 없음** |
| 모니터링 | `/canary` (배포 후 자동 모니터링) | 없음 | **배포 후 검증 없음** |
| 복잡도 기반 디스패치 | SIMPLE/MEDIUM/HEAVY/FULL/PLAN | 키워드+LLM 분류 | **작업 복잡도 레벨 없음** |

### 5.4 파악/이해 (Understand)

| 차원 | gstack | ai-team | 갭 |
|------|--------|---------|-----|
| 부트스트랩 | 14단계 Preamble Harness | 5단계 session-bootstrap | **학습 로드, 텔레메트리, 프로액티브 감지 누락** |
| 스택 감지 | 자동 기술 스택 + 프레임워크 감지 | 없음 | **자동 컨텍스트 수집 없음** |
| 공격 표면 | 자동 Attack Surface Census | 수동 | **자동 공격 표면 매핑 없음** |
| 팀 철학 | ETHOS.md (모든 스킬에 자동 주입) | CLAUDE.md 규칙 (why 없음) | **판단 기준 통일 문서 없음** |
| 세션 컨텍스트 | `/checkpoint` (결정+남은작업+노트) | `.context-handoff.md` (git 스냅샷만) | **결정 내역, 주의사항 미포함** |
| 회고 | `/retro` (기여자별, 핫스팟, 트렌드) | 없음 | **팀 효율 자동 분석 없음** |
| 리뷰 specialists | 7개 도메인별 체크리스트 | Chalmers 일반 QA | **도메인 특화 리뷰 없음** |

---

## 6. 도입 가능한 패턴 상세

### 6.1 Learnings System (자동 학습)

**목표**: 모든 에이전트가 작업 후 자동으로 학습을 기록하고, 다음 작업 전에 관련 학습을 검색하는 시스템.

#### 구현 설계

저장 위치:
```
.memory/learnings/
  homer-learnings.jsonl    # Homer 백엔드 학습
  bart-learnings.jsonl     # Bart 프론트엔드 학습
  wiggum-learnings.jsonl   # Wiggum 보안 학습
  krusty-learnings.jsonl   # Krusty 디자인 학습
  marge-learnings.jsonl    # Marge PM 학습
  lisa-learnings.jsonl     # Lisa 리서치 학습
  chalmers-learnings.jsonl # Chalmers QA 학습
  triage-learnings.jsonl   # Triage 라우팅 학습
```

항목 형식 (gstack 호환):
```json
{
  "agent": "homer",
  "type": "pitfall",
  "key": "websocket-cleanup-missing",
  "insight": "WebSocket close 이벤트 핸들러에서 heartbeat interval 정리 누락 → 좀비 클라이언트 발생",
  "confidence": 9,
  "source": "observed",
  "files": ["socket-bridge/src/bridge.ts"],
  "ts": "2026-04-06T10:00:00Z",
  "related_decision": "2026-04-05_websocket-architecture.md"
}
```

#### 에이전트 페르소나에 추가할 행동

작업 시작 시:
```
## 학습 확인 (작업 시작 전 필수)
1. .memory/learnings/{내이름}-learnings.jsonl에서 현재 작업 관련 학습 검색
2. 관련 학습이 있으면 작업 계획에 반영 (과거 pitfall 회피, 성공 pattern 적용)
3. 다른 에이전트 학습도 교차 검색 (예: Homer 작업 시 wiggum-learnings.jsonl의 보안 관련 학습)
```

작업 완료 시:
```
## 학습 기록 (작업 완료 후 필수)
작업 중 발견한 다음 항목을 .memory/learnings/{내이름}-learnings.jsonl에 기록:
- 새로 발견한 pitfall (함정)
- 효과적이었던 pattern (패턴)
- 프로젝트 특유의 preference (선호)
- 아키텍처 인사이트
```

#### Confidence Decay 구현

읽기 시 적용 (gstack과 동일한 로직):
- `observed` (직접 관찰) / `inferred` (추론) 소스: 30일마다 -1점
- `user-stated` (사용자 명시) / `documented` (문서화) 소스: decay 없음
- confidence 0 이하 → 자동 무시 (표시하지 않음)

### 6.2 에이전트별 Health Check

**목표**: 각 에이전트가 자신의 도메인 건강도를 0-10 점수로 측정하고 추세를 추적.

#### Homer (Backend) Health Check

| 카테고리 | 가중치 | 10점 | 7점 | 4점 | 0점 |
|----------|--------|------|-----|-----|-----|
| API 건강 | 30% | 모든 엔드포인트 정상 | <5 에러 | <20 에러 | >=20 에러 |
| DB 건강 | 25% | 마이그레이션 일치, 인덱스 적절 | <5 이슈 | <20 이슈 | >=20 이슈 |
| 테스트 커버리지 | 25% | >90% | >80% | >60% | <=60% |
| 보안 | 20% | 알려진 취약점 0 | <3 | <10 | >=10 |

#### Bart (Frontend) Health Check

| 카테고리 | 가중치 | 10점 | 7점 | 4점 | 0점 |
|----------|--------|------|-----|-----|-----|
| 번들 크기 | 25% | 예산 내 | <10% 초과 | <25% 초과 | >=25% 초과 |
| 접근성 | 25% | WCAG 2.1 AA 100% | >90% | >70% | <=70% |
| 타입 안전 | 25% | tsc 에러 0 | <5 에러 | <20 에러 | >=20 에러 |
| 린트 | 25% | 린트 에러 0 | <5 | <20 | >=20 |

#### Wiggum (SecOps) Health Check

| 카테고리 | 가중치 | 10점 | 7점 | 4점 | 0점 |
|----------|--------|------|-----|-----|-----|
| 의존성 취약점 | 30% | 0 known | <3 medium | <5 high | critical 있음 |
| 시크릿 노출 | 30% | 0 노출 | git 히스토리에만 | 코드에 있음 | .env 커밋됨 |
| OWASP 준수 | 20% | Top 10 전부 통과 | >8 통과 | >5 통과 | <=5 통과 |
| 보안 헤더 | 20% | 전부 설정 | >80% | >50% | <=50% |

저장: `.memory/health/{agent}-health-history.jsonl`

### 6.3 Investigate 5-Phase (디버깅 강화)

현재 `agent-debug`에 추가할 gstack 패턴:

1. **Scope Lock** 추가:
```markdown
## Phase 1.5: Scope Lock
근본 원인 가설을 형성한 후, 영향 받는 모듈로 편집을 제한한다.
- 가장 좁은 디렉토리 식별
- 해당 디렉토리 외 Edit/Write 사용 시 경고
- "디버그 범위가 [dir]로 제한됨. 관련 없는 코드 변경을 방지합니다."
```

2. **Pattern Analysis Table** 추가:
```markdown
## Phase 2: Pattern Analysis
| 패턴 | 시그니처 | 조사 위치 |
|------|---------|----------|
| Race condition | 간헐적, 타이밍 의존적 | 공유 상태 동시 접근 |
| Nil/null propagation | TypeError, Cannot read | 옵셔널 값 가드 누락 |
| State corruption | 불일치 데이터 | 트랜잭션, 콜백, 훅 |
| Integration failure | 타임아웃, 예상치 못한 응답 | 외부 API, 서비스 경계 |
| Configuration drift | 로컬 동작, 스테이징 실패 | 환경변수, 기능 플래그 |
| Stale cache | 오래된 데이터 | Redis, CDN, 브라우저 캐시 |
```

3. **3-Strike Rule** 추가:
```markdown
## Phase 3: 3-Strike Rule
3번 가설 실패 시 STOP. 사용자에게 알림:
A) 새 가설로 계속 조사
B) 사람 리뷰 에스컬레이션
C) 로깅 추가하고 다음 발생 대기
```

4. **Debug Report** 구조화:
```markdown
## Phase 5: Debug Report
증상 / 근본 원인 / 수정 내용 / 증거 / 회귀 테스트 / 관련 항목 / 상태
상태: DONE | DONE_WITH_CONCERNS | BLOCKED
```

### 6.4 자동 결정 원칙 (핸드오프 체인용)

현재 ai-team의 핸드오프 체인에 적용할 6가지 원칙:

```markdown
## 핸드오프 체인 자동 결정 원칙

### 결정 분류
- **Mechanical**: 하나의 정답이 명확 → 자동 결정, 로그만 남김
  예: 린트 에러 수정, 타입 에러, import 정리
- **Taste**: 합리적인 판단 차이 가능 → 자동 결정 + 최종 보고
  예: API 설계 방식 A vs B, 컴포넌트 분리 수준
- **User Challenge**: 사용자 방향 변경 → 절대 자동 결정 안 함
  예: 요구사항 변경, 기술 스택 전환, 범위 확대/축소

### 6가지 원칙
1. 완전성 선택 — 더 많은 엣지케이스 커버
2. Lake 끓이기 — blast radius 내 모든 것 수정
3. 실용적 — 같은 효과면 깔끔한 쪽
4. DRY — 기존 기능 중복 거부
5. 명시적 > 영리한 — 10줄 명확 > 200줄 추상화
6. 행동 편향 — 머지 > 리뷰 루프 > 방치
```

### 6.5 팀 철학 문서 (ETHOS.md 대응)

ai-team 전용 원칙 문서를 `.claude/agents/shared/team-ethos.md`로 작성:

```markdown
# AI Team Builder Ethos

## 1. 검증 없이 완료 없다
AI 에이전트의 가장 큰 위험은 "아마도 됐을 거다"라는 착각이다.
실행 → 출력 확인 → 증거 제시 → 그 후에야 완료 선언.

## 2. 학습은 자동이다
매 작업에서 패턴, 함정, 인사이트를 기록한다.
3회 실패를 기다리지 않는다 — 1회에서 배운다.

## 3. 판단 기준을 명시한다
"좋을 것 같아서"가 아닌, 6가지 결정 원칙으로 판단한다.
Mechanical은 자동, Taste는 보고, User Challenge는 반드시 질문.

## 4. 도메인 경계를 존중한다
다른 에이전트의 영역은 핸드오프한다.
수평적 협업이지, 만능이 아니다.

## 5. 사용자가 최종 결정한다
두 에이전트가 합의해도 sid가 "아니"라면 아니다.
맥락은 항상 사용자가 더 많다.
```

### 6.6 Session Bootstrap 강화

현재 5단계를 14단계로 확장:

```
현재 (5단계):
1. git pull
2. .memory/facts/ 로드
3. .memory/tasks/active-{role}.md 로드
4. .memory/decisions/ 최근 확인
5. .memory/handoff/ 펜딩 확인

추가할 단계 (gstack 참조):
6.  학습 로드 — .memory/learnings/{role}-learnings.jsonl에서 최근 학습 검색
7.  헬스 확인 — .memory/health/{role}-health-history.jsonl 마지막 점수 확인
8.  다른 에이전트 학습 교차 확인 — 내 도메인 관련 다른 에이전트 학습
9.  메모리 무결성 — 참조된 파일 경로 존재 확인
10. 진행 중 핸드오프 체인 확인 — 내가 다음 단계인 체인
11. 최근 QA 메트릭 확인 — 내 최근 PASS/FAIL 비율
12. 컨텍스트 보고 — 로드된 컨텍스트 요약을 Slack 또는 로그에 기록
```

### 6.7 Review Specialists (리뷰 도메인 전문화)

Chalmers의 리뷰를 도메인별로 전문화:

```
.claude/context/qa/
├── backend-review-checklist.md     # (기존) 백엔드 리뷰
├── frontend-review-checklist.md    # (기존) 프론트엔드 리뷰
├── spec-compliance-review.md       # (기존) 스펙 준수
│
│ — 추가 specialist 체크리스트 —
├── specialists/
│   ├── api-contract-review.md      # API 계약 준수 (Homer↔Bart)
│   ├── security-review.md          # 보안 (인젝션, 인증, CSRF, 암호화)
│   ├── performance-review.md       # 성능 (N+1, 메모리 릭, 번들 크기)
│   ├── accessibility-review.md     # 접근성 (WCAG 2.1 AA)
│   ├── design-compliance-review.md # 디자인 시스템 준수 (Bifrost)
│   └── data-safety-review.md       # 데이터 안전 (마이그레이션, 스키마)
```

---

## 7. 에이전트별 적용 방안

### 7.1 Homer (Backend)

**gstack에서 가져올 것:**
1. `/investigate` 5-Phase + Scope Lock → `agent-debug` 스킬 강화
2. Learnings 자동 기록/검색 → DB 패턴, API 설계 함정 축적
3. Health Check → API 건강, DB 건강, 테스트 커버리지 자동 측정
4. `/careful` 패턴 → `.env` 수정, `DROP TABLE` 등 위험 명령 Hook 차단
5. 완료 선언 규칙 강화 → gstack의 "실행 → 출력 → 증거" 패턴 적용 (이미 부분적으로 있음)

**페르소나에 추가할 섹션:**
```markdown
## 자동 학습 프로토콜
- 작업 시작: .memory/learnings/homer-learnings.jsonl 검색
- 작업 완료: 발견한 pitfall/pattern 기록
- 리뷰 받은 후: 지적 사항을 pitfall로 기록 (confidence 9)

## 도메인 헬스 체크
- API 엔드포인트 응답 확인 (curl)
- DB 마이그레이션 상태 확인
- 테스트 스위트 실행 + 결과 기록
```

### 7.2 Bart (Frontend)

**gstack���서 가져올 것:**
1. `/benchmark` 패턴 → 번들 크기, Core Web Vitals 베이스라인 추적
2. `/design-review` 패턴 → 구현 후 디자인 스펙 대비 시각적 검증
3. Learnings 자동 기록/검색 → React 최적화, CSS 함정 축적
4. Health Check → 번들 크기, 접근성, 타입 안전, 린트 자동 측정

**페르소나에 추가할 섹션:**
```markdown
## 성능 베이스라인
- 구현 전: 번들 크기, 페이지 로드 시간 기록
- 구현 후: 동일 측정 → 회귀 감지
- 10% 이상 증가 시 경고

## 디자인 준수 검증
- Krusty 디자인 스펙 대비 구현 비교
- Bifrost 디자인 토큰 사용 여부 확인
```

### 7.3 Wiggum (SecOps)

**gstack에서 가져올 것:**
1. `/cso` 15단계 감사 프로토콜 → 구조화된 보안 감사 워크플로
2. 스택 감지 + 공격 표면 센서스 자동화
3. Confidence gate (일일 8/10, 월간 2/10) → 발견 사항 필터링
4. Learnings 자동 기록/검색 → 보안 패턴, 취약점 유형 축적
5. `/guard` 패턴 → 프로덕션 환경 작업 시 안전 모드

**페르소나에 추가할 섹션:**
```markdown
## 구조화된 보안 감사 프로토콜
Phase 0: 아키텍처 멘탈 모델 + 스택 감지
Phase 1: 공격 표면 센서스 (코드 + 인프라)
Phase 2: 시크릿 고고학 (git 히스토리)
Phase 3: 의존성 공급망
Phase 4-6: 인프라 보안
Phase 7: LLM/AI 보안
Phase 8-11: OWASP + STRIDE
Phase 12-14: 보고서 + 트렌드 + 학습

## 감사 모드
- 일일 (기본): 8/10 confidence gate — 확실한 것만 보고
- 월간 (--comprehensive): 2/10 bar — 가능성 있는 것도 보고
```

### 7.4 Krusty (Designer)

**gstack에서 가져올 것:**
1. `/design-consultation` 패턴 → 디자인 시스템 구축 워크플로
2. `/plan-design-review` 5차원 0-10 채점 → 디자인 품질 정량화
3. Learnings → 디자인 패턴, 사용성 함정, 접근성 이슈 축적

### 7.5 Marge (PM)

**gstack에서 가져올 것:**
1. `/retro` 패턴 → 주간 팀 회고 자동 생성
2. `/office-hours` 패턴 → 기능 제안 시 문제 이해 강제
3. `/autoplan` 결정 원칙 → 핸드오프 체인 자동 결정 관리
4. 팀 헬스 대시보드 → 에이전트별 헬스 점수 종합

### 7.6 Lisa (Researcher)

**gstack에서 가져올 것:**
1. Learnings → 리서치 패턴, 소스 신뢰도, 방법론 축적
2. `/learn export` → 리서치 결과를 구조화된 형식으로 축적

### 7.7 Chalmers (QA)

**gstack에서 가져올 것:**
1. Review Specialists → 도메인별 전문 체크리스트
2. `/qa` 브라우저 기반 QA → UI 자동 테스트 (computer use 연동 가능)
3. Learnings → QA 패턴, 반복 실패 영역 축적
4. 학습 기반 동적 체크리스트 → 과거 실패 영역 가중치 증가

### 7.8 Triage

**gstack에서 가져올 것:**
1. Complexity-based Dispatch → 작업 복잡도에 따른 에이전트 할당 수준
2. Confidence-scored Routing → 라우팅 성공/실패 추적, 자동 가중치 조절
3. Learnings → 라우팅 패턴, 오분류 사례 축적

---

## 8. 우선순위 및 로드맵

### 8.1 도입 우선순위 (Impact × 난이도)

| 순위 | 항목 | 대상 | Impact | 난이도 | 설명 |
|------|------|------|--------|--------|------|
| **1** | Learnings System | 전체 | ★★★★★ | 중 | 모든 에이전트에 자동 학습 능력. 가장 높은 ROI |
| **2** | Team Ethos 문서 | 전체 | ★★★★ | 하 | 판단 기준 통일. 6가지 결정 원칙 포함 |
| **3** | 자동 결정 원칙 | 핸드오프 체인 | ★★★★ | 하 | Mechanical/Taste/User Challenge 분류 |
| **4** | Session Bootstrap 강화 | 전체 | ★★★★ | 중 | 학습 로드, 헬스 확인, 교차 검색 추가 |
| **5** | Investigate 5-Phase | Homer, Bart | ★★★★ | 하 | Scope Lock, Pattern Table, 3-Strike |
| **6** | Review Specialists | Chalmers | ★★★ | 중 | 도메인별 전문 체크리스트 |
| **7** | 에이전트별 Health Check | 전체 | ★★★ | 중 | 도메인별 0-10 점수 + 트렌드 |
| **8** | CSO 감사 프로토콜 | Wiggum | ★★★ | 중 | 15단계 구조화된 보안 감사 |
| **9** | Retro 시스템 | Marge | ★★★ | 중 | 주간 팀 활동 자동 분석 |
| **10** | Checkpoint 강화 | 전체 | ★★ | 하 | 결정 내역, 남은 작업, 노트 포함 |
| **11** | Hook 기반 안전장치 | Homer, Wiggum | ★★ | 중 | 위험 명령 런타임 차단 |
| **12** | Benchmark 패턴 | Bart | ★★ | 중 | Core Web Vitals + 번들 크기 추적 |
| **13** | Canary 모니터링 | Homer, Bart | ★★ | 높 | 배포 후 자동 모니터링 |
| **14** | Complexity Dispatch | Triage | ★★ | 중 | 복잡도 기반 에이전트 할당 |

### 8.2 구현 Phase

#### Phase 1 — 기반 (1-2주)
- [ ] Learnings System 구현 (JSONL 구조, 기록/검색 로직)
- [ ] Team Ethos 문서 작성 (`shared/team-ethos.md`)
- [ ] 자동 결정 원칙 문서 (`shared/decision-principles.md`)
- [ ] Session Bootstrap 확장 (5단계 → 12단계)

#### Phase 2 — 에이전트 강화 (2-3주)
- [ ] 각 에이전트 페르소나에 학습 프로토콜 추가
- [ ] `agent-debug` 스킬에 5-Phase 패턴 통합
- [ ] Review Specialists 체크리스트 작성
- [ ] 에이전트별 Health Check 정의

#### Phase 3 — 자동화 (3-4주)
- [ ] CSO 감사 프로토콜 Wiggum 통합
- [ ] Retro 시스템 Marge 통합
- [ ] Checkpoint 강화
- [ ] Hook 기반 안전장치 구현

#### Phase 4 — 고급 (4-6주)
- [ ] Benchmark 패턴 Bart 통합
- [ ] Canary 모니터링 구현
- [ ] Complexity-based Dispatch Triage 통합
- [ ] 대칭 학습 (리뷰어↔피리뷰어 양방향)

---

## 부록 A: gstack 핵심 파일 참조 경로

| 파일 | 경로 | ai-team 적용 시 참조 |
|------|------|---------------------|
| Learnings 로그 스크립트 | `/Users/sid/git/gstack/bin/gstack-learnings-log` | 학습 기록 로직 |
| Learnings 검색 스크립트 | `/Users/sid/git/gstack/bin/gstack-learnings-search` | 검색 + decay 로직 |
| Learn 스킬 | `/Users/sid/git/gstack/learn/SKILL.md.tmpl` | 학습 관리 UI |
| Health 스킬 | `/Users/sid/git/gstack/health/SKILL.md.tmpl` | 헬스 대시보드 |
| Investigate 스킬 | `/Users/sid/git/gstack/investigate/SKILL.md.tmpl` | 디버깅 5단계 |
| CSO 스킬 | `/Users/sid/git/gstack/cso/SKILL.md.tmpl` | 보안 감사 15단계 |
| Careful 스킬 | `/Users/sid/git/gstack/careful/SKILL.md.tmpl` | Hook 안전장치 |
| Guard 스킬 | `/Users/sid/git/gstack/guard/SKILL.md.tmpl` | careful + freeze |
| Autoplan 스킬 | `/Users/sid/git/gstack/autoplan/SKILL.md.tmpl` | 자동 리뷰 파이프라인 |
| Retro 스킬 | `/Users/sid/git/gstack/retro/SKILL.md.tmpl` | 주간 회고 |
| Canary 스킬 | `/Users/sid/git/gstack/canary/SKILL.md.tmpl` | 배포 후 모니터링 |
| Benchmark 스킬 | `/Users/sid/git/gstack/benchmark/SKILL.md.tmpl` | 성능 회귀 감지 |
| Checkpoint 스킬 | `/Users/sid/git/gstack/checkpoint/SKILL.md.tmpl` | 세션 상태 저장 |
| Ship 스킬 | `/Users/sid/git/gstack/ship/SKILL.md.tmpl` | 배포 워크플로 |
| Review 스킬 | `/Users/sid/git/gstack/review/SKILL.md.tmpl` | 코드 리뷰 |
| Office Hours 스킬 | `/Users/sid/git/gstack/office-hours/SKILL.md.tmpl` | 제품 진단 |
| ETHOS 문서 | `/Users/sid/git/gstack/ETHOS.md` | 빌더 철학 |
| Review Specialists | `/Users/sid/git/gstack/review/specialists/` | 도메인별 체크리스트 |

## 부록 B: 용어 대조표

| gstack 용어 | ai-team 대응 | 설명 |
|-------------|-------------|------|
| Skill | 스킬 (`.claude/skills/`) | 구조화된 워크플로 |
| Preamble | session-bootstrap | 세션 시작 시 자동 실행 |
| Learnings | (없음 → 도입 필요) | 자동 축적 학습 |
| Checkpoint | `.context-handoff.md` | 세션 컨텍스트 저장 |
| Freeze | (없음 → 도입 가능) | 디렉토리 편집 제한 |
| Careful | (없음 → 도입 가능) | 위험 명령 경고 Hook |
| Guard | (없음 → 도입 가능) | careful + freeze |
| Lake | (개념 도입 필요) | 완전한 구현이 가능한 범위 |
| Ocean | (개념 도입 필요) | 불가능한 범위 |
| Mechanical decision | (도입 필요) | 자동 결정 가능 |
| Taste decision | (도입 필요) | 자동 결정 + 보고 |
| User Challenge | (도입 필요) | 절대 자동 결정 안 함 |
| Review Army | Chalmers + specialists | 도메인별 병렬 리뷰 |
| SLUG | (해당 없음) | 프로젝트 식별자 |
| Conductor | (해당 없음) | 멀티 워크스페이스 오케스트레이션 |

---

> 이 문서는 gstack (`/Users/sid/git/gstack`)과 ai-team (`/Users/sid/git/ai-team`)의 교차 분석 결과입니다.
> 각 에이전트는 자신의 도메인에 해당하는 섹션을 참조하여 개선 방향을 파악할 �� 있습니다.
> 구현 결정은 sid의 승인이 필요합니다.
