import { inferTier } from './src/queue-manager.js';

const cases = [
  { agent: 'qa',       task: '기능 검증',               expected: 'high' },
  { agent: 'secops',   task: '파일 정리',                expected: 'high' },
  { agent: 'frontend', task: 'API 설계 검토 및 리뷰',   expected: 'high' },
  { agent: 'backend',  task: '아키텍처 분석',            expected: 'high' },
  { agent: 'pm',       task: '의사결정 및 계획 수립',    expected: 'high' },
  { agent: 'frontend', task: 'sprint log 업데이트',     expected: 'fast' },
  { agent: 'researcher', task: '목록 정리 및 요약',     expected: 'fast' },
  { agent: 'backend',  task: '문서화 작업',              expected: 'fast' },
  { agent: 'frontend', task: 'Button 컴포넌트 구현',    expected: 'standard' },
  { agent: 'backend',  task: 'REST API 엔드포인트 구현', expected: 'standard' },
  { agent: 'designer', task: '카드 UI 디자인',           expected: 'standard' },
];

let pass = 0, fail = 0;
for (const c of cases) {
  const got = inferTier(c.agent, c.task);
  const ok = got === c.expected;
  ok ? pass++ : fail++;
  console.log((ok ? '✅' : '❌') + ` [${c.agent}] "${c.task}" → ${got} (expected: ${c.expected})`);
}
console.log(`\n총 ${pass + fail}개: ${pass} PASS, ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
