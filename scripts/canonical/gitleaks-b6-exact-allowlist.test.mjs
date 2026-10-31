import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { DIAGNOSTIC_PACKAGE } from './prepare-business-sale-preview-link-package.mjs';

// Only deterministic, unusable local canaries. No provider or runtime is contacted.
const config = fileURLToPath(new URL('../../.gitleaks.toml', import.meta.url));
const target = 'scripts/canonical/prepare-business-sale-preview-link-package.mjs';
const digest = DIAGNOSTIC_PACKAGE.baseApiHash;
const canary = createHash('sha256').update('MELISA_OFFLINE_NOT_A_CREDENTIAL').digest('hex');
const fakeProviderToken = 'ghp_' + createHash('sha256').update('MELISA_OFFLINE_INVALID_PROVIDER_TOKEN').digest('hex').slice(0, 36);
const fixtures = [
  { name: 'only the approved value, exact path and generic rule are suppressed', file: target, body: `baseApiHash:'${digest}'`, count: 0 },
  { name: 'a different value on the same line is reported', file: target, body: `baseApiHash:'${canary}'`, count: 1 },
  { name: 'the same value in another file is reported', file: 'scripts/canonical/another-producer.mjs', body: `baseApiHash:'${digest}'`, count: 1 },
  { name: 'a path suffix cannot borrow the exception', file: target + '.backup', body: `baseApiHash:'${digest}'`, count: 1 },
  { name: 'a path prefix cannot borrow the exception', file: 'other/' + target, body: `baseApiHash:'${digest}'`, count: 1 },
  { name: 'an extended value cannot borrow the exact digest exception', file: target, body: `baseApiHash:'${digest}a'`, count: 1 },
  { name: 'a second generic secret on the same physical line remains visible', file: target, body: `baseApiHash:'${digest}',apiKey:'${canary}'`, count: 1 },
  { name: 'another default rule remains active in the approved file', file: target, body: `baseApiHash:'${digest}'\nconst providerToken='${fakeProviderToken}';`, rule: 'github-pat' },
];

// Direct user approval on 31 October: these are a verified Git object and two
// frozen owner manifests, scoped to this producer and this scanner rule only.
const ownerTarget = 'scripts/canonical/prepare-business-sale-owner-bundle.mjs';
const ownerDigests = [
  '35d3eeb267e4292fd0aca3aece1dbaf9e1a7b34a',
  'd43f5cc715ac06ecc1da3df7a709375d0da913dd73e175dc63112ab21b4409d1',
  '6adda25daf5af69b72062475d6c937b7fb903e4199291189c68f9b6229b49869',
];
for (const [index, value] of ownerDigests.entries()) {
  for (const f of fixtures.slice(0, 8)) {
    fixtures.push({
      ...f,
      name: `owner metadata ${index + 1}: ${f.name}`,
      file: f.file.replace(target, ownerTarget),
      body: f.body.replaceAll(digest, value),
    });
  }
}

for (const f of fixtures) test(f.name, () => {
  const parent = fs.realpathSync(os.tmpdir());
  const root = fs.mkdtempSync(path.join(parent, 'melisa-gitleaks-exact-'));
  try {
    const source = path.join(root, 'source');
    const file = path.join(source, f.file);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, f.body);
    const template = path.join(root, 'empty-git-template');
    fs.mkdirSync(template);
    for (const args of [['init', '--quiet', '--template', template], ['add', '--', f.file]]) {
      const git = spawnSync('git', args, { cwd: source, encoding: 'utf8', windowsHide: true, timeout: 10000 });
      assert.ifError(git.error);
      assert.equal(git.status, 0, 'disposable staged Git fixture must initialize');
    }
    const report = path.join(root, 'redacted-findings.json');
    const run = spawnSync('gitleaks', ['git', '.', '--staged', '--config', config, '--redact=100', '--no-banner', '--log-level', 'error', '--report-format', 'json', '--report-path', report], { cwd: source, encoding: 'utf8', windowsHide: true, timeout: 30000 });
    assert.ifError(run.error);
    assert.ok([0, 1].includes(run.status), 'scanner must complete rather than fail parsing/configuration');
    const rows = fs.existsSync(report) ? JSON.parse(fs.readFileSync(report, 'utf8')) : [];
    if (f.rule) assert.ok(rows.some(r => r.RuleID === f.rule), 'unrelated default provider rule must still report');
    else assert.equal(rows.filter(r => r.RuleID === 'generic-api-key').length, f.count);
    assert.equal(run.status, f.count === 0 ? 0 : 1);
  } finally {
    const resolved = fs.realpathSync(root);
    assert.equal(path.dirname(resolved), parent);
    assert.ok(path.basename(resolved).startsWith('melisa-gitleaks-exact-'));
    fs.rmSync(resolved, { recursive: true });
  }
});
