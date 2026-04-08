/**
 * report.ts
 *
 * results/ 디렉토리의 평가 결과를 읽어 Claude를 Judge로 호출하고,
 * 카테고리별 품질 점수·비용 비교 마크다운 리포트를 생성합니다.
 * 출력: results/report.md
 */

import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// 타입 정의
// ---------------------------------------------------------------------------

interface RunResult {
  response: string;
  input_tokens: number;
  output_tokens: number;
  total_cost_usd: number;
  latency_ms: number;
  tool_calls_count: number;
}

interface EvalResult {
  test_case_id: string;
  category: string;
  difficulty: string;
  prompt: string;
  context: string | null;
  expected_skills: string[];
  donald: RunResult;
  aiteam: RunResult;
  timestamp: string;
}

interface AgentScores {
  accuracy: number;
  completeness: number;
  expertise: number;
  actionability: number;
  conciseness: number;
  total: number;
  reasoning: string;
}

interface JudgeOutput {
  agent_a: AgentScores;
  agent_b: AgentScores;
  winner: 'agent_a' | 'agent_b' | 'tie';
  comparison_summary: string;
}

interface JudgedResult {
  test_case_id: string;
  category: string;
  difficulty: string;
  prompt: string;
  donald_scores: AgentScores;
  aiteam_scores: AgentScores;
  winner: 'donald' | 'aiteam' | 'tie';
  comparison_summary: string;
  donald_cost: number;
  aiteam_cost: number;
  donald_latency_ms: number;
  aiteam_latency_ms: number;
  donald_tokens: number;
  aiteam_tokens: number;
}

interface CategoryStats {
  count: number;
  donald_avg_quality: number;
  aiteam_avg_quality: number;
  donald_avg_cost: number;
  aiteam_avg_cost: number;
  donald_avg_latency: number;
  aiteam_avg_latency: number;
  donald_wins: number;
  aiteam_wins: number;
  ties: number;
}

// ---------------------------------------------------------------------------
// 상수
// ---------------------------------------------------------------------------

const MODEL = 'claude-sonnet-4-6';
const PRICING = {
  input_per_million: 3.0,
  output_per_million: 15.0,
} as const;

const CATEGORY_LABELS: Record<string, string> = {
  simple_qa: '단순 Q&A',
  code_review: '코드 리뷰',
  design_planning: '설계/기획',
  bug_fix: '버그 수정',
  cross_domain: '크로스 도메인',
};

// ---------------------------------------------------------------------------
// Judge 시스템 프롬프트 (judge-prompt.md 와 동기화)
// ---------------------------------------------------------------------------

const JUDGE_SYSTEM_PROMPT = `You are an impartial expert judge evaluating AI assistant responses. Your task is to score two responses (Agent A and Agent B) on the same task using a structured rubric.

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
- Do not output anything outside the JSON block.`;

// ---------------------------------------------------------------------------
// 유틸리티
// ---------------------------------------------------------------------------

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const calculateCost = (inputTokens: number, outputTokens: number): number => {
  return (
    (inputTokens / 1_000_000) * PRICING.input_per_million +
    (outputTokens / 1_000_000) * PRICING.output_per_million
  );
};

const avg = (nums: number[]): number => {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
};

const fmt = (n: number, decimals = 2): string => n.toFixed(decimals);
const fmtCost = (n: number): string => `$${n.toFixed(6)}`;
const fmtMs = (n: number): string => `${Math.round(n)}ms`;

// ---------------------------------------------------------------------------
// Judge 호출
// ---------------------------------------------------------------------------

/**
 * Claude를 Judge로 호출하여 두 에이전트 응답을 채점합니다.
 * @param client - Anthropic SDK 클라이언트
 * @param evalResult - 평가 결과 (두 에이전트의 응답 포함)
 */
const callJudge = async (
  client: Anthropic,
  evalResult: EvalResult,
): Promise<JudgeOutput> => {
  const contextBlock = evalResult.context
    ? `\n\n\`\`\`\n${evalResult.context}\n\`\`\``
    : '';

  const userMessage = `## Task
${evalResult.prompt}${contextBlock}

## Agent A Response (Donald — single agent)
${evalResult.donald.response}

## Agent B Response (ai-team — multi-agent)
${evalResult.aiteam.response}

Score both responses using the rubric in your system prompt. Output only JSON.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: JUDGE_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const rawText = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');

  // JSON 블록 추출 (마크다운 코드 펜스 대응)
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Judge 응답에서 JSON을 파싱할 수 없습니다: ${rawText}`);
  }

  return JSON.parse(jsonMatch[0]) as JudgeOutput;
};

// ---------------------------------------------------------------------------
// 마크다운 리포트 생성
// ---------------------------------------------------------------------------

/**
 * JudgedResult 배열에서 카테고리별 통계를 집계합니다.
 */
const aggregateByCategory = (
  results: JudgedResult[],
): Record<string, CategoryStats> => {
  const stats: Record<string, CategoryStats> = {};

  for (const r of results) {
    if (!stats[r.category]) {
      stats[r.category] = {
        count: 0,
        donald_avg_quality: 0,
        aiteam_avg_quality: 0,
        donald_avg_cost: 0,
        aiteam_avg_cost: 0,
        donald_avg_latency: 0,
        aiteam_avg_latency: 0,
        donald_wins: 0,
        aiteam_wins: 0,
        ties: 0,
      };
    }
    const s = stats[r.category];
    s.count += 1;
    s.donald_avg_quality += r.donald_scores.total;
    s.aiteam_avg_quality += r.aiteam_scores.total;
    s.donald_avg_cost += r.donald_cost;
    s.aiteam_avg_cost += r.aiteam_cost;
    s.donald_avg_latency += r.donald_latency_ms;
    s.aiteam_avg_latency += r.aiteam_latency_ms;
    if (r.winner === 'donald') s.donald_wins += 1;
    else if (r.winner === 'aiteam') s.aiteam_wins += 1;
    else s.ties += 1;
  }

  // 평균으로 변환
  for (const cat of Object.keys(stats)) {
    const s = stats[cat];
    s.donald_avg_quality /= s.count;
    s.aiteam_avg_quality /= s.count;
    s.donald_avg_cost /= s.count;
    s.aiteam_avg_cost /= s.count;
    s.donald_avg_latency /= s.count;
    s.aiteam_avg_latency /= s.count;
  }

  return stats;
};

/**
 * 전체 JudgedResult 배열로부터 마크다운 리포트를 생성합니다.
 */
const buildMarkdownReport = (
  results: JudgedResult[],
  judgeTokensUsed: number,
  judgeCostUsd: number,
): string => {
  const categoryStats = aggregateByCategory(results);
  const generatedAt = new Date().toISOString();

  const totalDonaldCost = results.reduce((s, r) => s + r.donald_cost, 0);
  const totalAiTeamCost = results.reduce((s, r) => s + r.aiteam_cost, 0);
  const totalDonaldQuality = avg(results.map((r) => r.donald_scores.total));
  const totalAiTeamQuality = avg(results.map((r) => r.aiteam_scores.total));
  const totalDonaldLatency = avg(results.map((r) => r.donald_latency_ms));
  const totalAiTeamLatency = avg(results.map((r) => r.aiteam_latency_ms));

  const donaldWins = results.filter((r) => r.winner === 'donald').length;
  const aiTeamWins = results.filter((r) => r.winner === 'aiteam').length;
  const ties = results.filter((r) => r.winner === 'tie').length;

  // 비용 대비 품질 (점수 / 비용)
  const donaldCpq =
    totalDonaldCost > 0 ? totalDonaldQuality / totalDonaldCost : 0;
  const aiTeamCpq =
    totalAiTeamCost > 0 ? totalAiTeamQuality / totalAiTeamCost : 0;

  // ---------------------------------------------------------------------------
  // 리포트 조합
  // ---------------------------------------------------------------------------
  const lines: string[] = [];

  lines.push('# Donald vs ai-team 비용/품질 평가 리포트');
  lines.push('');
  lines.push(`생성일시: ${generatedAt}`);
  lines.push(`평가 모델: ${MODEL}`);
  lines.push(`총 테스트 케이스: ${results.length}개`);
  lines.push('');

  // 전체 요약
  lines.push('## 전체 요약');
  lines.push('');
  lines.push(
    '| 지표 | Donald (단일 에이전트) | ai-team (멀티 에이전트) | 차이 |',
  );
  lines.push('|------|----------------------|------------------------|------|');
  lines.push(
    `| 평균 품질 점수 (/25) | ${fmt(totalDonaldQuality)} | ${fmt(totalAiTeamQuality)} | ${fmt(totalAiTeamQuality - totalDonaldQuality, 2)} |`,
  );
  lines.push(
    `| 총 비용 | ${fmtCost(totalDonaldCost)} | ${fmtCost(totalAiTeamCost)} | ${fmtCost(totalAiTeamCost - totalDonaldCost)} |`,
  );
  lines.push(
    `| 평균 지연시간 | ${fmtMs(totalDonaldLatency)} | ${fmtMs(totalAiTeamLatency)} | ${fmtMs(totalAiTeamLatency - totalDonaldLatency)} |`,
  );
  lines.push(
    `| 승리 횟수 | ${donaldWins}승 | ${aiTeamWins}승 | ${ties}무 |`,
  );
  lines.push(
    `| 비용 대비 품질 (점수/$) | ${fmt(donaldCpq, 1)} | ${fmt(aiTeamCpq, 1)} | — |`,
  );
  lines.push('');

  // 카테고리별 비교
  lines.push('## 카테고리별 비교');
  lines.push('');
  lines.push(
    '| 카테고리 | 케이스 수 | Donald 품질 | ai-team 품질 | Donald 비용 | ai-team 비용 | Donald 지연 | ai-team 지연 | 승패 |',
  );
  lines.push(
    '|----------|-----------|------------|-------------|------------|-------------|------------|-------------|------|',
  );

  for (const [cat, s] of Object.entries(categoryStats)) {
    const label = CATEGORY_LABELS[cat] ?? cat;
    const winSummary = `D:${s.donald_wins} A:${s.aiteam_wins} 무:${s.ties}`;
    lines.push(
      `| ${label} | ${s.count} | ${fmt(s.donald_avg_quality)} | ${fmt(s.aiteam_avg_quality)} | ${fmtCost(s.donald_avg_cost)} | ${fmtCost(s.aiteam_avg_cost)} | ${fmtMs(s.donald_avg_latency)} | ${fmtMs(s.aiteam_avg_latency)} | ${winSummary} |`,
    );
  }
  lines.push('');

  // 세부 기준별 점수 (카테고리별)
  lines.push('## 세부 기준별 평균 점수');
  lines.push('');
  lines.push(
    '> 각 기준은 1–5점 척도. 형식: Donald / ai-team',
  );
  lines.push('');
  lines.push(
    '| 카테고리 | 정확성 | 완성도 | 전문성 | 실용성 | 효율성 |',
  );
  lines.push('|----------|--------|--------|--------|--------|--------|');

  for (const [cat, catResults] of Object.entries(
    results.reduce<Record<string, JudgedResult[]>>((acc, r) => {
      if (!acc[r.category]) acc[r.category] = [];
      acc[r.category].push(r);
      return acc;
    }, {}),
  )) {
    const label = CATEGORY_LABELS[cat] ?? cat;
    const dAcc = avg(catResults.map((r) => r.donald_scores.accuracy));
    const aAcc = avg(catResults.map((r) => r.aiteam_scores.accuracy));
    const dComp = avg(catResults.map((r) => r.donald_scores.completeness));
    const aComp = avg(catResults.map((r) => r.aiteam_scores.completeness));
    const dExp = avg(catResults.map((r) => r.donald_scores.expertise));
    const aExp = avg(catResults.map((r) => r.aiteam_scores.expertise));
    const dAct = avg(catResults.map((r) => r.donald_scores.actionability));
    const aAct = avg(catResults.map((r) => r.aiteam_scores.actionability));
    const dCon = avg(catResults.map((r) => r.donald_scores.conciseness));
    const aCon = avg(catResults.map((r) => r.aiteam_scores.conciseness));
    lines.push(
      `| ${label} | ${fmt(dAcc, 1)} / ${fmt(aAcc, 1)} | ${fmt(dComp, 1)} / ${fmt(aComp, 1)} | ${fmt(dExp, 1)} / ${fmt(aExp, 1)} | ${fmt(dAct, 1)} / ${fmt(aAct, 1)} | ${fmt(dCon, 1)} / ${fmt(aCon, 1)} |`,
    );
  }
  lines.push('');

  // 비용 대비 품질 분석
  lines.push('## 비용 대비 품질 분석 (Cost-per-Quality-Point)');
  lines.push('');
  lines.push(
    '> 품질 점수 1점을 얻는 데 드는 비용. 낮을수록 효율적입니다.',
  );
  lines.push('');
  lines.push('| 카테고리 | Donald $/점 | ai-team $/점 | 효율 우위 |');
  lines.push('|----------|------------|-------------|----------|');

  for (const [cat, s] of Object.entries(categoryStats)) {
    const label = CATEGORY_LABELS[cat] ?? cat;
    const dCpq =
      s.donald_avg_quality > 0
        ? s.donald_avg_cost / s.donald_avg_quality
        : Infinity;
    const aCpq =
      s.aiteam_avg_quality > 0
        ? s.aiteam_avg_cost / s.aiteam_avg_quality
        : Infinity;
    const winner =
      dCpq < aCpq ? 'Donald' : dCpq > aCpq ? 'ai-team' : '동일';
    lines.push(
      `| ${label} | ${fmtCost(dCpq)} | ${fmtCost(aCpq)} | ${winner} |`,
    );
  }
  lines.push('');

  // 전체 결론
  const overallWinner =
    totalAiTeamQuality > totalDonaldQuality
      ? 'ai-team'
      : totalDonaldQuality > totalAiTeamQuality
        ? 'Donald'
        : '동점';
  const costWinner =
    totalAiTeamCost < totalDonaldCost
      ? 'ai-team'
      : totalDonaldCost < totalAiTeamCost
        ? 'Donald'
        : '동일';
  const costRatio = totalAiTeamCost / (totalDonaldCost || 1);

  lines.push('## 결론');
  lines.push('');
  lines.push(`- **품질 우위**: ${overallWinner}`);
  lines.push(`- **비용 우위**: ${costWinner} (ai-team 비용 = Donald × ${fmt(costRatio, 2)})`);
  lines.push(
    `- **비용 대비 품질**: Donald ${fmt(donaldCpq, 1)}점/$ vs ai-team ${fmt(aiTeamCpq, 1)}점/$`,
  );
  lines.push('');

  // 케이스별 상세 결과
  lines.push('## 케이스별 상세 결과');
  lines.push('');

  for (const r of results) {
    const winnerLabel =
      r.winner === 'donald'
        ? 'Donald 승'
        : r.winner === 'aiteam'
          ? 'ai-team 승'
          : '무승부';

    lines.push(
      `### ${r.test_case_id} (${CATEGORY_LABELS[r.category] ?? r.category}, ${r.difficulty})`,
    );
    lines.push('');
    lines.push(`**태스크**: ${r.prompt.slice(0, 100)}${r.prompt.length > 100 ? '…' : ''}`);
    lines.push('');
    lines.push(
      `| 항목 | Donald | ai-team |`,
    );
    lines.push('|------|--------|---------|');
    lines.push(
      `| 품질 점수 (/25) | ${r.donald_scores.total} | ${r.aiteam_scores.total} |`,
    );
    lines.push(
      `| 비용 | ${fmtCost(r.donald_cost)} | ${fmtCost(r.aiteam_cost)} |`,
    );
    lines.push(
      `| 지연시간 | ${fmtMs(r.donald_latency_ms)} | ${fmtMs(r.aiteam_latency_ms)} |`,
    );
    lines.push(`| 결과 | **${winnerLabel}** | |`);
    lines.push('');
    lines.push(`**Judge 의견**: ${r.comparison_summary}`);
    lines.push('');
    lines.push(
      `<details><summary>Donald 채점 근거</summary>\n\n${r.donald_scores.reasoning}\n\n</details>`,
    );
    lines.push('');
    lines.push(
      `<details><summary>ai-team 채점 근거</summary>\n\n${r.aiteam_scores.reasoning}\n\n</details>`,
    );
    lines.push('');
  }

  // 평가 메타데이터
  lines.push('---');
  lines.push('');
  lines.push('## 평가 메타데이터');
  lines.push('');
  lines.push(`- Judge 모델: ${MODEL}`);
  lines.push(`- Judge 토큰 사용량: ${judgeTokensUsed.toLocaleString()}`);
  lines.push(`- Judge 비용: ${fmtCost(judgeCostUsd)}`);
  lines.push(`- 리포트 생성: ${generatedAt}`);
  lines.push('');

  return lines.join('\n');
};

// ---------------------------------------------------------------------------
// 메인 실행 로직
// ---------------------------------------------------------------------------

/**
 * 리포트 생성 파이프라인 진입점.
 * results/*.json 을 읽어 Judge로 채점 후 results/report.md 를 생성합니다.
 */
const main = async (): Promise<void> => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('오류: ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.');
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });

  const evalDir = path.dirname(new URL(import.meta.url).pathname);
  const resultsDir = path.join(evalDir, 'results');
  const reportPath = path.join(resultsDir, 'report.md');

  // results/*.json 파일 목록 (report.md 제외)
  const resultFiles = fs
    .readdirSync(resultsDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => path.join(resultsDir, f));

  if (resultFiles.length === 0) {
    console.error(
      `오류: ${resultsDir} 에 평가 결과 파일이 없습니다. 먼저 run-eval.ts를 실행하세요.`,
    );
    process.exit(1);
  }

  console.log(`\n리포트 생성 시작: ${resultFiles.length}개 결과 파일`);
  console.log(`Judge 모델: ${MODEL}\n`);

  const judgedResults: JudgedResult[] = [];
  let totalJudgeInputTokens = 0;
  let totalJudgeOutputTokens = 0;

  for (let i = 0; i < resultFiles.length; i++) {
    const filePath = resultFiles[i];

    const evalResult: EvalResult = JSON.parse(
      fs.readFileSync(filePath, 'utf-8'),
    );

    process.stdout.write(
      `[${i + 1}/${resultFiles.length}] Judge 채점 중: ${evalResult.test_case_id}...`,
    );

    try {
      const judgeOutput = await callJudge(client, evalResult);

      // Judge 토큰 추적 (근사치: 시스템 + 입력 + 출력)
      // 실제 토큰은 callJudge 내부에서 추적하지 않으므로 응답 길이 기반 추정
      const estimatedJudgeInput = 800 + evalResult.donald.response.length / 4 + evalResult.aiteam.response.length / 4;
      const estimatedJudgeOutput = 200;
      totalJudgeInputTokens += estimatedJudgeInput;
      totalJudgeOutputTokens += estimatedJudgeOutput;

      const winner =
        judgeOutput.winner === 'agent_a'
          ? 'donald'
          : judgeOutput.winner === 'agent_b'
            ? 'aiteam'
            : 'tie';

      judgedResults.push({
        test_case_id: evalResult.test_case_id,
        category: evalResult.category,
        difficulty: evalResult.difficulty,
        prompt: evalResult.prompt,
        donald_scores: judgeOutput.agent_a,
        aiteam_scores: judgeOutput.agent_b,
        winner,
        comparison_summary: judgeOutput.comparison_summary,
        donald_cost: evalResult.donald.total_cost_usd,
        aiteam_cost: evalResult.aiteam.total_cost_usd,
        donald_latency_ms: evalResult.donald.latency_ms,
        aiteam_latency_ms: evalResult.aiteam.latency_ms,
        donald_tokens:
          evalResult.donald.input_tokens + evalResult.donald.output_tokens,
        aiteam_tokens:
          evalResult.aiteam.input_tokens + evalResult.aiteam.output_tokens,
      });

      console.log(
        ` 완료 (${winner === 'donald' ? 'Donald 승' : winner === 'aiteam' ? 'ai-team 승' : '무승부'})`,
      );
    } catch (err) {
      console.error(` 오류: ${err}`);
    }

    if (i < resultFiles.length - 1) {
      await sleep(1000);
    }
  }

  if (judgedResults.length === 0) {
    console.error('오류: 채점된 결과가 없습니다.');
    process.exit(1);
  }

  // 마크다운 리포트 생성
  const judgeCost = calculateCost(
    totalJudgeInputTokens,
    totalJudgeOutputTokens,
  );
  const report = buildMarkdownReport(
    judgedResults,
    totalJudgeInputTokens + totalJudgeOutputTokens,
    judgeCost,
  );

  fs.writeFileSync(reportPath, report, 'utf-8');

  console.log(`\n리포트 저장: ${reportPath}`);
  console.log(`Judge 비용 (추정): ${fmtCost(judgeCost)}`);
  console.log('\n완료.');
};

main().catch((err) => {
  console.error('실행 실패:', err);
  process.exit(1);
});

/** 포맷 헬퍼 (외부 참조용) */
export { buildMarkdownReport, aggregateByCategory };
