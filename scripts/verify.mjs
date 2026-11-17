#!/usr/bin/env node
/**
 * Local verification: typecheck + unit tests + production build.
 * Usage: node scripts/verify.mjs
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

function run(command, args) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    console.error(`\n[verify] FAILED: ${command} ${args.join(' ')}`);
    process.exit(result.status ?? 1);
  }
}

if (!existsSync('package.json')) {
  console.error('[verify] Run from the repository root.');
  process.exit(1);
}

if (!existsSync('node_modules')) {
  run('npm', ['install']);
}

run('npm', ['run', 'typecheck']);
run('npm', ['test']);
run('npm', ['run', 'build']);

console.log('\n[verify] All checks passed: typecheck, tests, build.');
