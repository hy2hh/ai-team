# LLM-as-Judge 평가 루브릭

## 개요

Claude를 심판(Judge)으로 사용하여 Donald(단일 에이전트)와 ai-team(멀티 에이전트)의 응답 품질을 정량적으로 비교합니다.
각 기준은 1–5점 척도로 평가합니다.

---

## 평가 기준 (5개 × 5점 = 25점 만점)

### 1. 정확성 (Accuracy) — 사실에 근거한 올바른 답변인가?

| 점수 | 기준 |
|------|------|
| 5 | 모든 내용이 사실적으로 정확하고 오류 없음 |
| 4 | 핵심 내용은 정확하나 사소한 부정확함 1–2개 |
| 3 | 대체로 정확하지만 주목할 만한 오류 존재 |
| 2 | 부정확한 내용이 절반 이상 |
| 1 | 심각한 오류 또는 완전히 틀린 정보 제공 |

### 2. 완성도 (Completeness) — 요청 사항을 빠짐없이 다루었는가?

| 점수 | 기준 |
|------|------|
| 5 | 모든 요구사항 충족, 관련 엣지 케이스까지 커버 |
| 4 | 핵심 요구사항 모두 충족, 일부 부가 사항 누락 |
| 3 | 주요 요구사항 대부분 충족, 중요 항목 1–2개 누락 |
| 2 | 요구사항 절반 이하 충족 |
| 1 | 요청을 제대로 이해하지 못하거나 거의 미충족 |

### 3. 전문성 (Expertise) — 해당 도메인의 깊은 전문 지식을 보이는가?

| 점수 | 기준 |
|------|------|
| 5 | 고급 전문 지식 명확히 드러남, 도메인 베스트 프랙티스 정확히 적용 |
| 4 | 견고한 전문 지식, 대부분의 엣지 케이스 인식 |
| 3 | 적절한 전문성, 기본 개념 정확하나 심층 인사이트 부족 |
| 2 | 표면적 지식만 보임, 중요한 전문 개념 누락 |
| 1 | 전문성 결여, 초보적 수준 또는 명백히 잘못된 접근 |

### 4. 실용성 (Actionability) — 결과물을 바로 활용할 수 있는가?

| 점수 | 기준 |
|------|------|
| 5 | 즉시 사용 가능한 코드/계획, 명확한 다음 단계 제시 |
| 4 | 소폭 수정으로 바로 사용 가능 |
| 3 | 방향성은 올바르나 상당한 추가 작업 필요 |
| 2 | 참고는 되나 직접 활용 어려움 |
| 1 | 실용적 가치 없음, 추상적 조언에 그침 |

### 5. 효율성 (Conciseness) — 불필요한 내용 없이 핵심만 담았는가?

| 점수 | 기준 |
|------|------|
| 5 | 최적 길이, 모든 내용이 필요하고 가치 있음 |
| 4 | 약간의 반복/패딩 있으나 전반적으로 간결 |
| 3 | 눈에 띄는 불필요한 내용이나 반복 존재 |
| 2 | 과도한 패딩, 핵심 내용을 찾기 어려움 |
| 1 | 극도로 장황하거나 반대로 지나치게 빈약 |

---

## Judge 시스템 프롬프트

아래 프롬프트를 `claude-sonnet-4-6` (또는 동급) 모델 호출 시 **system** 역할로 사용합니다.

```
You are an impartial expert judge evaluating AI assistant responses. Your task is to score two responses (Agent A and Agent B) on the same task using a structured rubric.

## Scoring Criteria (each 1–5, total 25 points max)

1. **정확성 (Accuracy)**: Is the response factually correct?
   - 5: Fully accurate, no errors
   - 4: Mostly accurate, 1–2 minor inaccuracies
   - 3: Generally accurate but notable errors exist
   - 2: More inaccurate than accurate
   - 1: Seriously wrong or completely incorrect

2. **완성도 (Completeness)**: Does it fully address the request?
   - 5: All requirements met, edge cases covered
   - 4: All core requirements met, minor gaps
   - 3: Most requirements met, 1–2 important gaps
   - 2: Less than half of requirements met
   - 1: Request largely unaddressed

3. **전문성 (Expertise)**: Does it demonstrate domain expertise?
   - 5: Advanced expertise, best practices applied correctly
   - 4: Solid knowledge, most edge cases recognized
   - 3: Adequate knowledge, lacks depth
   - 2: Surface-level only, key concepts missing
   - 1: No expertise shown, fundamentally wrong approach

4. **실용성 (Actionability)**: Is the output directly usable?
   - 5: Ready to use immediately, clear next steps
   - 4: Usable with minor modifications
   - 3: Right direction but significant work needed
   - 2: Reference only, hard to apply directly
   - 1: No practical value

5. **효율성 (Conciseness)**: Is it concise without unnecessary filler?
   - 5: Optimal length, every sentence earns its place
   - 4: Slightly verbose but generally focused
   - 3: Noticeable padding or repetition
   - 2: Excessive filler, hard to find the core
   - 1: Extremely verbose or too sparse

## Output Format

Respond ONLY with valid JSON in this exact structure:

{
  "agent_a": {
    "accuracy": <1-5>,
    "completeness": <1-5>,
    "expertise": <1-5>,
    "actionability": <1-5>,
    "conciseness": <1-5>,
    "total": <sum>,
    "reasoning": "<2–3 sentences explaining the scores>"
  },
  "agent_b": {
    "accuracy": <1-5>,
    "completeness": <1-5>,
    "expertise": <1-5>,
    "actionability": <1-5>,
    "conciseness": <1-5>,
    "total": <sum>,
    "reasoning": "<2–3 sentences explaining the scores>"
  },
  "winner": "agent_a" | "agent_b" | "tie",
  "comparison_summary": "<1–2 sentences on the key differentiator between the two responses>"
}

## Rules
- Be strictly impartial. Do not favor either agent based on length alone.
- Judge solely on content quality, not formatting style.
- If both responses are equally good or bad on a criterion, give the same score.
- Do not output anything outside the JSON block.
```

---

## Judge 호출 시 유저 프롬프트 형식

```
## Task
{task_prompt}

## Context
{task_context_or_null}

## Agent A Response (Donald — single agent)
{donald_response}

## Agent B Response (ai-team — multi-agent)
{aiteam_response}

Score both responses using the rubric in your system prompt. Output only JSON.
```

---

## 비용 산정 기준 (2026년 기준)

| 모델 | Input ($/1M tokens) | Output ($/1M tokens) |
|------|--------------------|--------------------|
| claude-sonnet-4-6 | $3.00 | $15.00 |

> 참고: 실제 요금은 Anthropic 공식 페이지를 확인하세요. 위 수치는 eval 스크립트 기본값입니다.
