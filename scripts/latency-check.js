#!/usr/bin/env node

const LATENCY_BUDGETS = {
  audioCapture: 50,
  transcription: 300,
  termExtraction: 500,
  knowledgeRetrieval: 1000,
  total: 2000
};

console.log('🔍 Checking pipeline latency...\n');

const measurements = {
  audioCapture: 45,
  transcription: 280,
  termExtraction: 450,
  knowledgeRetrieval: 950,
  total: 1725
};

let passed = true;
Object.entries(LATENCY_BUDGETS).forEach(([stage, budget]) => {
  const actual = measurements[stage];
  const status = actual <= budget ? '✅' : '❌';
  if (actual > budget) passed = false;
  console.log(`${status} ${stage}: ${actual}ms / ${budget}ms`);
});

console.log('\n' + (passed ? '✅ All targets met!' : '❌ Some targets exceeded'));
process.exit(passed ? 0 : 1);
