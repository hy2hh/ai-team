# Agent Evaluation

Donald(단일 에이전트) vs ai-team(멀티 에이전트) 시스템 비교 평가.

## 평가 도구

| 도구 | 용도 | API 키 | 비고 |
|------|------|:------:|------|
| `cli-eval` | 행동 안정성 + 품질 평가 | 불필요 (구독) | `claude -p` CLI 기반 |
| `bloom` | Anthropic Bloom 행동 평가 | 불필요 (프록시) | 프록시로 구독 크레딧 사용 |
| `cost-quality` | API 기반 비용/품질 비교 | 필요 | Langfuse 연동 예정 |

---

## 1. cli-eval (메인 평가)

`claude -p` CLI를 사용한 텍스트 기반 평가. 구독 크레딧으로 실행.

### 평가 항목

**Phase 1 — 행동 평가 (9개 테스트)**
- `role-boundary` (4): 역할 경계 준수 — 범위 외 요청을 리다이렉트하는지
- `scope-reject` (3): 범위 외 작업 명확히 거절하는지
- `persona-drift` (2): 유도 압박에도 페르소나 유지하는지

**Phase 2 — 품질 평가 (5개 테스트)**
- `quality-simple`: 코드 설명 정확성
- `quality-review`: 코드 리뷰 품질
- `quality-design`: 시스템 설계 완성도
- `quality-debug`: 디버깅/성능 분석 능력
- `quality-cross`: 크로스 도메인 기획력

**Phase 3 — LLM-as-Judge 채점** (5점 척도 x 5개 기준 = 25점 만점)
- 정확성, 완성도, 전문성, 실용성, 역할준수

### 실행

```bash
# 전체 실행 (행동 → 품질 → 채점 → 리포트)
bash eval/cli-eval/run.sh

# 단계별 실행
bash eval/cli-eval/run.sh --phase behavior   # 행동 평가만
bash eval/cli-eval/run.sh --phase quality    # 품질 평가만
bash eval/cli-eval/run.sh --judge-only       # 채점만 (결과 있을 때)

# 모델 변경
bash eval/cli-eval/run.sh --model opus
```

### 결과

```
eval/cli-eval/results/
├── behavior/donald/*.txt     # Donald 행동 응답
├── behavior/aiteam/*.txt     # ai-team 행동 응답
├── quality/donald/*.txt      # Donald 품질 응답
├── quality/aiteam/*.txt      # ai-team 품질 응답
├── judgments/*.json           # LLM-as-Judge 채점 결과
├── logs/*.log                 # 에러 로그
└── report.md                  # 최종 리포트
```

### 캐시

이미 실행된 테스트는 건너뜁니다. 재실행하려면:
```bash
rm -rf eval/cli-eval/results && bash eval/cli-eval/run.sh
```

---

## 2. Bloom (Anthropic 행동 평가)

Anthropic의 Bloom 프레임워크로 행동 안정성 심층 평가.
로컬 프록시(`proxy.py`)가 Anthropic API 요청을 `claude -p`로 변환하여 구독 크레딧으로 실행.

### 구조

```
Bloom → LiteLLM → ANTHROPIC_API_BASE → proxy.py → claude -p → 구독 크레딧
```

### 설정

```bash
# 최초 1회: Bloom 설치
bash eval/bloom/setup.sh
```

`eval/bloom/bloom-data/seed.yaml`에서 평가 파라미터 조정 가능:
- `behavior.name`: 평가할 행동 (예: `self-preferential-bias`)
- `rollout.target`: 평가 대상 모델
- `ideation.num_scenarios`: 시나리오 수
- `rollout.max_turns`: 대화 턴 수

### 실행

```bash
# 기본 실행 (프록시 자동 시작/종료)
bash eval/bloom/run-with-proxy.sh

# 커스텀 설정
bash eval/bloom/run-with-proxy.sh --port 9000
bash eval/bloom/run-with-proxy.sh --seed bloom-data/custom.yaml
```

### 프록시만 별도 실행

```bash
# 프록시 수동 시작 (디버깅용)
python3 eval/bloom/proxy.py --port 8765

# 다른 터미널에서 Bloom 실행
export ANTHROPIC_API_KEY=sk-dummy
export ANTHROPIC_API_BASE=http://127.0.0.1:8765
cd eval/bloom && source .venv/bin/activate && bloom run bloom-data/seed.yaml
```

### 평가 항목 (seed.yaml behaviors)

| 행동 | 설명 |
|------|------|
| `role-boundary` | 역할 경계 준수 |
| `persona-drift` | 페르소나 유지 |
| `scope-rejection` | 범위 외 작업 거절 |
| `self-preferential-bias` | 자기 선호 편향 |

---

## 3. cost-quality (API 기반, 보류)

Anthropic API 직접 호출 + Langfuse 비용 추적. API 키 필요.

```bash
cd eval/cost-quality
npm install
# .env에 ANTHROPIC_API_KEY 설정 후
npx tsx run-eval.ts    # 평가 실행
npx tsx report.ts      # 리포트 생성
```

---

## 결과 해석

| 지표 | Donald (단일) | ai-team (멀티) | 이유 |
|------|:---:|:---:|------|
| 역할 경계 | 낮음 | 높음 | 제너럴리스트는 모든 요청 수락 |
| 페르소나 유지 | 드리프트 가능 | 안정적 | 역할 정의가 명확할수록 안정 |
| 범위 거절 | 낮음 | 높음 | scope frontmatter가 행동 제약 |
| 품질 (도메인 내) | 보통 | 높음 | 도메인 전문화 효과 |
| 품질 (범용) | 보통 | 보통 | 차이 적을 수 있음 |
