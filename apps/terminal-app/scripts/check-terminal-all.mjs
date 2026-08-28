import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const exportDir = join(process.cwd(), '.expo-export-check');
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const steps = [
  {
    label: 'Expo doctor',
    command: npxCommand,
    args: ['expo-doctor'],
  },
  {
    label: 'Working draft recovery smoke',
    command: 'node',
    args: ['scripts/check-terminal-working-draft.mjs'],
  },
  {
    label: 'Terminal API smoke',
    command: 'node',
    args: ['scripts/check-terminal-api.mjs'],
  },
  {
    label: 'Guarded submit check',
    command: 'node',
    args: ['scripts/check-terminal-submit.mjs'],
  },
  {
    label: 'Web export',
    command: npxCommand,
    args: ['expo', 'export', '--platform', 'web', '--output-dir', '.expo-export-check'],
  },
];

function cleanupExport() {
  if (existsSync(exportDir)) {
    rmSync(exportDir, { recursive: true, force: true });
  }
}

function runStep(step) {
  return new Promise((resolve) => {
    console.log(`\n== ${step.label} ==`);
    const command = process.platform === 'win32' ? 'cmd.exe' : step.command;
    const args = process.platform === 'win32'
      ? ['/d', '/s', '/c', [step.command, ...step.args].join(' ')]
      : step.args;
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit',
      shell: false,
    });

    child.on('close', (code) => {
      resolve(code || 0);
    });

    child.on('error', (error) => {
      console.error(error.message);
      resolve(1);
    });
  });
}

cleanupExport();

const results = [];

for (const step of steps) {
  const code = await runStep(step);
  results.push({ label: step.label, ok: code === 0 });

  if (code !== 0) {
    break;
  }
}

cleanupExport();

const passed = results.filter((result) => result.ok).length;
const failed = results.length - passed;

console.log('\nTerminal check summary');
for (const result of results) {
  console.log(`${result.ok ? 'PASS' : 'FAIL'} - ${result.label}`);
}
console.log(`SUMMARY: ${passed}/${steps.length} PASS`);

if (failed > 0 || passed !== steps.length) {
  process.exitCode = 1;
}
