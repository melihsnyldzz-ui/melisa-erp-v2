import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const source = fileURLToPath(new URL('./watch-hub-stack.ps1', import.meta.url));
test('source preparation has pinned Probe/Start without task/network mutation or broad process stopping', () => {
  const text = fs.readFileSync(source, 'utf8');
  assert.match(text, /SOURCE PREPARATION \/ NOT INSTALLED/);
  assert.match(text, /HUB_STACK_ACTIVATION_DEPENDENCY_PINS_REQUIRED/);
  assert.match(text, /\$StartupConfigSha256/);
  assert.doesNotMatch(text, /\b(?:Stop-Process|Register-ScheduledTask|Set-ScheduledTask|Start-ScheduledTask|Unregister-ScheduledTask|Invoke-Expression)\b|\.Kill\(/i);
  assert.match(text, /\$arguments=@\(\('\"'\+\$driver\+'\"'\)/);
  assert.doesNotMatch(text, /test-supervisor\.mjs/);
  assert.match(text, /Get-NetTCPConnection/); assert.match(text, /Get-CimInstance/);
  assert.match(text, /PRIVATE|private/i);
});

test('PowerShell 5.1 offline dependency/budget/package/foreign-owner fixtures execute without real runtime access', {skip: process.platform !== 'win32'}, () => {
  const shell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const fixture = fileURLToPath(new URL('./watch-hub-stack.test.ps1', import.meta.url));
  const result = spawnSync(shell, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'RemoteSigned', '-File', fixture, '-SourcePath', source],
    {windowsHide: true, encoding: 'utf8', timeout: 20000});
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /HUB_STACK_OFFLINE_FIXTURES_PASS/);
  assert.equal((result.stdout.match(/PASS /g) || []).length, 6);
});
