import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { hookOutput, remember, runCheck } from './run.mjs';
const inconsistent = { issues: [{ code: 'FOCUS_COPY_MISMATCH', kind: 'inconsistency', at: 'focus', message: 'Kayıt çelişkisi.' }], wholeClosureGranted: false };
test('Stop can request one correction only and cannot loop on its own continuation', () => {
  const options = { eventName: 'Stop', changed: true, cacheSaved: true, allowStopContinuation: true };
  assert.equal(hookOutput(inconsistent, options).decision, 'block');
  assert.equal(hookOutput(inconsistent, { ...options, stopHookActive: true }).decision, undefined);
  assert.equal(hookOutput(inconsistent, { ...options, changed: false }).decision, undefined);
  assert.equal(hookOutput(inconsistent, { ...options, cacheSaved: false }).decision, undefined);
});
test('missing prerequisite never causes automatic continuation or permission decision', () => {
  const output = hookOutput({ issues: [{ code: 'NORMAL_ROLE_SESSION_REQUIRED', kind: 'check_required' }] },
    { eventName: 'Stop', changed: true, cacheSaved: true, allowStopContinuation: true });
  assert.equal(output.decision, undefined);
  assert.equal(output.permissionDecision, undefined);
});
test('unchanged result is quiet; cache only contains bounded non-secret metadata', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'melisa-check-test-'));
  const file = path.join(dir, 'cache.json');
  t.after(() => { for (const name of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, name)); fs.rmdirSync(dir); });
  assert.deepEqual(remember(file, inconsistent), { changed: true, cacheSaved: true });
  assert.deepEqual(remember(file, inconsistent), { changed: false, cacheSaved: true });
  assert.deepEqual(Object.keys(JSON.parse(fs.readFileSync(file, 'utf8'))).sort(), ['codes','recordedAt','schemaVersion','signature']);
});
test('unreadable source produces a bounded prerequisite result without echoing a secret or path', () => {
  const result = runCheck({ schemaVersion: 1, mode: 'audit', statePath: 'SECRET_FIXTURE_VALUE', trackerPath: 'missing' });
  assert.equal(result.issues[0].code, 'RECORD_READ_FAILED');
  assert.ok(!JSON.stringify(result).includes('SECRET_FIXTURE_VALUE'));
  assert.equal(result.wholeClosureGranted, false);
});

test('cache cannot overwrite source, config, aliases or an unrelated existing file', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'melisa-cache-guard-'));
  t.after(() => { for (const name of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, name)); fs.rmdirSync(dir); });
  const source = path.join(dir, 'source.json');
  fs.writeFileSync(source, '{"items":["preserve"]}');
  assert.equal(remember(source, inconsistent, { protectedPaths: [source] }).cacheSaved, false);
  assert.equal(remember(source, inconsistent).cacheSaved, false);
  assert.equal(fs.readFileSync(source, 'utf8'), '{"items":["preserve"]}');
  const alias = path.join(dir, 'alias.json'); fs.linkSync(source, alias);
  assert.equal(remember(alias, inconsistent, { protectedPaths: [source] }).cacheSaved, false);
  assert.equal(fs.readFileSync(alias, 'utf8'), '{"items":["preserve"]}');
});
