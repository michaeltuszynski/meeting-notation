#!/usr/bin/env node

console.log('🤖 Environment Check\n');

const { execSync } = require('child_process');
const checks = [
  { name: 'Node.js', cmd: 'node -v', required: true },
  { name: 'npm', cmd: 'npm -v', required: true },
  { name: 'Python venv', cmd: 'which python', required: true },
  { name: 'Claude Code', cmd: 'claude --version', required: false }
];

checks.forEach(check => {
  try {
    const result = execSync(check.cmd, { encoding: 'utf8' }).trim();
    console.log(`✅ ${check.name}: ${result}`);
  } catch (error) {
    console.log(`${check.required ? '❌' : '⚠️ '} ${check.name}: Not found`);
  }
});
