import test from 'node:test';
import assert from 'node:assert/strict';
import { validateMapping, verifyService, verifyProcess, readServiceHealth, createObservedControl } from './deploy-control-observed-test.mjs';

const mapping = {
  schemaVersion: 1, mode: 'externally-supervised-test-observe-only', identity: 'shared-test-db02',
  database: 'MELISA_ERP_CRM_SHARED_TEST_20261009_02', server: 'Semih\\MELISADEV',
  copyId: 'e16b70f0-4057-428b-9abc-6bbcaf35fe82', sourceCommit: 'f'.repeat(40), repositoryRoot: 'C:\\missing',
  nodeExecutable: 'C:\\test\\node.exe', nodeSha256: 'd'.repeat(64),
  services: Object.entries({ erp: 4184, native: 4186, web: 5234 }).map(([role, port]) => ({ role, port, origin: `http://127.0.0.1:${port}`, script: `C:\\test\\${role}.mjs`, operationConfig: 'C:\\test\\operation.json', manifest: 'C:\\test\\release-manifest.json', scriptSha256: 'a'.repeat(64), operationSha256: 'b'.repeat(64), manifestSha256: 'c'.repeat(64), packageId: 'CANONICAL-TEST-example' })),
};
function fixture(role) {
  const service = mapping.services.find(s => s.role === role);
  return { service, health: { ok: true, environment: 'ISOLATED_TEST_COPY', mode: role, port: service.port, databaseName: mapping.database, serverName: mapping.server, copyId: mapping.copyId, sourceCommit: mapping.sourceCommit, packageId: service.packageId, actualT1: false, sysadmin: 0, databaseControl: 0, liveDatabaseAccess: 0, originalDatabaseAccess: 0, externalOperations: false, automaticJobs: false, writes: role === 'erp', sqlReadOnly: role === 'native' }, process: { pid: 123, createdAt: '2026-10-18T00:00:00.000Z', commandLine: `${mapping.nodeExecutable} ${role === 'web' ? '' : '--no-maglev '}${service.script} ${role === 'web' ? '' : role + ' '}${service.operationConfig}` } };
}
test('accepts separately supervised ERP/native/web identities', () => {
  assert.equal(validateMapping(mapping), mapping);
  for (const role of ['erp', 'native', 'web']) { const f = fixture(role); assert.equal(verifyService(mapping, f.service, f.health, f.process).pass, true); }
});
test('wrong process is rejected before any HTTP request', async () => {
  const f = fixture('erp'); let requests = 0;
  await assert.rejects(readServiceHealth(mapping, f.service, () => ({ ...f.process, commandLine: 'node live.mjs' }), async () => { requests++; }), /TEST_PROCESS_MISMATCH/);
  assert.equal(requests, 0);
  for (const command of [f.process.commandLine.replace('erp.mjs', 'erp.mjs.other'), f.process.commandLine + ' --extra', f.process.commandLine.replace(mapping.nodeExecutable, 'C:\\wrong\\node.exe')]) assert.throws(() => verifyProcess(mapping, f.service, { ...f.process, commandLine: command }), /TEST_PROCESS_MISMATCH/);
});
test('PID reuse or a process change during health fails closed', async () => {
  const f = fixture('native'); let reads = 0;
  await assert.rejects(readServiceHealth(mapping, f.service, () => ({ ...f.process, createdAt: reads++ ? '2026-10-18T01:00:00.000Z' : f.process.createdAt }), async () => ({ ok: true, json: async () => f.health })), /TEST_PROCESS_CHANGED_DURING_PROBE/);
});
test('rejects LIVE, remote, duplicate role, and invalid process mappings', () => {
  for (const mutate of [m => m.database = 'PROD', m => m.services[0].origin = 'http://192.168.1.46:4184', m => m.services[1].role = 'erp']) {
    const changed = structuredClone(mapping); mutate(changed); assert.throws(() => validateMapping(changed));
  }
  const f = fixture('erp'); assert.throws(() => verifyService(mapping, f.service, f.health, { pid: 123, commandLine: 'node unrelated.mjs' }), /TEST_PROCESS_MISMATCH/);
});
test('rejects database/copy/package and isolation regressions', () => {
  for (const role of ['erp', 'native']) for (const [key, value] of Object.entries({ databaseName: 'PROD', copyId: 'other', sourceCommit: 'a'.repeat(40), packageId: 'other', actualT1: true, sysadmin: 1, databaseControl: 1, liveDatabaseAccess: 1, originalDatabaseAccess: 1, externalOperations: true, automaticJobs: true, mode: 'other' })) {
    const f = fixture(role); f.health[key] = value; assert.throws(() => verifyService(mapping, f.service, f.health, f.process), `${role}:${key}`);
  }
  const f = fixture('native'); f.health.writes = true; assert.throws(() => verifyService(mapping, f.service, f.health, f.process), /TEST_WRITE_BOUNDARY_MISMATCH/);
});
test('all lifecycle and browser actions are rejected before side effects', async () => {
  const control = createObservedControl({}, mapping, async () => { throw new Error('must not probe'); });
  for (const method of ['execute', 'prepare', 'dryRunLive', 'observe', 'screenshot']) await assert.rejects(control[method]({ environment: 'LIVE' }), /EXTERNAL_TEST_OBSERVE_ONLY/);
  await assert.rejects(control.smoke({ environment: 'LIVE' }), /TEST_ONLY/);
});
test('status keeps observation failure visible, never contacts LIVE', async () => {
  const config = { repository: 'melisa-erp-v2', stateRoot: 'C:\\missing', sourceCommit: 'old', environments: { LIVE: { identity: 'live' } } };
  const control = createObservedControl(config, mapping, async () => { throw Object.assign(new Error(), { code: 'TEST_PROCESS_MISMATCH' }); });
  const result = await control.status();
  assert.equal(result.environments.TEST.health.pass, false);
  assert.equal(result.environments.TEST.warning, 'TEST_PROCESS_MISMATCH');
  assert.equal(result.environments.LIVE.observation, 'NOT_OBSERVED');
  assert.equal(result.hostDeploymentEnabled, false);
});
