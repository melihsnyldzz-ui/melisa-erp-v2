import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const demand = (condition, code) => { if (!condition) throw Object.assign(new Error(code), { code }); };
const digest = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));

export function validateMapping(mapping) {
  demand(mapping.schemaVersion === 1 && mapping.mode === 'externally-supervised-test-observe-only', 'TEST_MAPPING_REJECTED');
  demand(mapping.database === 'MELISA_ERP_CRM_SHARED_TEST_20261009_02' && mapping.server === 'Semih\\MELISADEV', 'TEST_DATABASE_REJECTED');
  demand(/^[a-f0-9-]{36}$/.test(mapping.copyId) && /^[a-f0-9]{40}$/.test(mapping.sourceCommit), 'TEST_BINDING_REJECTED');
  demand(mapping.services?.length === 3, 'TEST_SERVICES_REQUIRED');
  demand(path.win32.isAbsolute(mapping.nodeExecutable) && /^[a-f0-9]{64}$/.test(mapping.nodeSha256), 'TEST_NODE_BINDING_REQUIRED');
  const ports = { erp: 4184, native: 4186, web: 5234 };
  demand(new Set(mapping.services.map(s => s.role)).size === 3, 'TEST_SERVICE_ROLES_REJECTED');
  for (const service of mapping.services) {
    demand(service.port === ports[service.role] && service.origin === `http://127.0.0.1:${service.port}`, 'TEST_ORIGIN_REJECTED');
    for (const file of [service.script, service.operationConfig, service.manifest]) demand(path.win32.isAbsolute(file), 'TEST_PATH_REQUIRED');
    for (const hash of [service.scriptSha256, service.operationSha256, service.manifestSha256]) demand(/^[a-f0-9]{64}$/.test(hash), 'TEST_HASH_REQUIRED');
    demand(typeof service.packageId === 'string' && service.packageId.startsWith('CANONICAL-TEST-'), 'TEST_PACKAGE_REJECTED');
  }
  return mapping;
}

export function verifyService(mapping, service, health, processInfo) {
  const h = health;
  demand(h.ok === true && h.environment === 'ISOLATED_TEST_COPY' && h.port === service.port, 'TEST_HEALTH_IDENTITY_MISMATCH');
  demand(h.databaseName === mapping.database && h.copyId === mapping.copyId && h.sourceCommit === mapping.sourceCommit && h.packageId === service.packageId, 'TEST_RUNTIME_BINDING_MISMATCH');
  demand(h.actualT1 === false, 'REAL_T1_REJECTED');
  if (service.role !== 'web') {
    demand(h.mode === service.role && h.serverName === mapping.server, 'TEST_ROLE_MISMATCH');
    demand(h.sysadmin === 0 && h.databaseControl === 0 && h.liveDatabaseAccess === 0 && h.originalDatabaseAccess === 0, 'TEST_SQL_BOUNDARY_MISMATCH');
    demand(h.externalOperations === false && h.automaticJobs === false, 'TEST_EXTERNAL_OPERATIONS_REJECTED');
    demand(h.writes === (service.role === 'erp') && h.sqlReadOnly === (service.role === 'native'), 'TEST_WRITE_BOUNDARY_MISMATCH');
  }
  verifyProcess(mapping, service, processInfo);
  return { role: service.role, origin: service.origin, port: service.port, pid: processInfo.pid, packageId: h.packageId, sourceCommit: h.sourceCommit, sqlReadOnly: h.sqlReadOnly ?? null, writes: h.writes ?? null, pass: true };
}

export function verifyProcess(mapping, service, processInfo) {
  const command = String(processInfo?.commandLine ?? '');
  // These launchers use plain absolute paths, optional outer quotes, and no
  // escaped quotes. Reject other Windows quoting forms instead of guessing.
  demand(!command.includes('\\"') && (command.match(/"/g) ?? []).length % 2 === 0, 'TEST_PROCESS_QUOTING_REJECTED');
  const args = (command.match(/"[^"\r\n]*"|[^\s"]+/g) ?? []).map(value => value.replace(/^"|"$/g, '').toLowerCase());
  const expected = [mapping.nodeExecutable, ...(service.role === 'web' ? [] : ['--no-maglev']), service.script, ...(service.role === 'web' ? [] : [service.role]), service.operationConfig].map(value => value.toLowerCase());
  demand(Number.isInteger(processInfo?.pid) && processInfo.pid > 0 && typeof processInfo.createdAt === 'string' && processInfo.createdAt.length > 10 && JSON.stringify(args) === JSON.stringify(expected), 'TEST_PROCESS_MISMATCH');
}

function listener(port) {
  const command = `$p=Get-NetTCPConnection -State Listen -LocalPort ${port} -ErrorAction Stop | Where-Object LocalAddress -eq '127.0.0.1' | Select-Object -First 1; if(-not $p){throw 'LISTENER_MISSING'}; $owner=Get-CimInstance Win32_Process -Filter ('ProcessId = '+$p.OwningProcess); [pscustomobject]@{pid=[int]$p.OwningProcess;commandLine=$owner.CommandLine;createdAt=$owner.CreationDate.ToUniversalTime().ToString('o')}|ConvertTo-Json -Compress`;
  return JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { encoding: 'utf8', windowsHide: true, timeout: 10000, stdio: ['ignore', 'pipe', 'ignore'] }));
}

export async function readServiceHealth(mapping, service, getListener = listener, request = fetch) {
  const before = getListener(service.port);
  verifyProcess(mapping, service, before);
  const response = await request(`${service.origin}/test-health`, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(5000) });
  demand(response.ok, 'TEST_HEALTH_UNAVAILABLE');
  const health = await response.json();
  const after = getListener(service.port);
  verifyProcess(mapping, service, after);
  demand(before.pid === after.pid && before.createdAt === after.createdAt && before.commandLine === after.commandLine, 'TEST_PROCESS_CHANGED_DURING_PROBE');
  return verifyService(mapping, service, health, after);
}

export async function probeTest(mapping) {
  validateMapping(mapping);
  demand(digest(mapping.nodeExecutable) === mapping.nodeSha256, 'TEST_NODE_BINDING_CHANGED');
  const services = [];
  for (const service of mapping.services) {
    for (const [file, expected] of [[service.script, service.scriptSha256], [service.operationConfig, service.operationSha256], [service.manifest, service.manifestSha256]]) demand(digest(file) === expected, 'TEST_FILE_BINDING_CHANGED');
    const manifest = read(service.manifest);
    demand(manifest.packageId === service.packageId && manifest.sourceCommit === mapping.sourceCommit, 'TEST_MANIFEST_MISMATCH');
    const operation = read(service.operationConfig);
    demand(operation.database === mapping.database && operation.server === mapping.server && operation.copyContext?.copyId === mapping.copyId, 'TEST_OPERATION_BINDING_MISMATCH');
    services.push(await readServiceHealth(mapping, service));
  }
  return { pass: true, scope: 'TEST-health-and-process-observation-only', database: mapping.database, copyId: mapping.copyId, sourceCommit: mapping.sourceCommit, services, commercialFlowVerified: false, deploymentAllowed: false };
}

export function createObservedControl(config, mapping, probe = probeTest) {
  validateMapping(mapping);
  const blocked = async () => { throw Object.assign(new Error('EXTERNAL_TEST_OBSERVE_ONLY'), { code: 'EXTERNAL_TEST_OBSERVE_ONLY' }); };
  return {
    async status() {
      let git;
      try {
        const run = args => execFileSync('git', args, { cwd: mapping.repositoryRoot, encoding: 'utf8', windowsHide: true, timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
        demand(run(['remote', 'get-url', 'origin']) === 'https://github.com/melihsnyldzz-ui/melisa-erp-v2.git', 'REPOSITORY_ORIGIN_MISMATCH');
        git = { commit: run(['rev-parse', 'HEAD']), branch: run(['branch', '--show-current']), dirty: run(['status', '--porcelain']).length > 0 };
      } catch { git = { warning: 'GIT_IDENTITY_UNAVAILABLE' }; }
      let test;
      try {
        const health = await probe(mapping);
        test = { identity: mapping.identity, service: 'melisa-shared-test-external-supervisor', mode: mapping.mode, database: mapping.database, apiOrigin: 'http://127.0.0.1:4184', nativeOrigin: 'http://127.0.0.1:4186', webOrigin: 'http://127.0.0.1:5234', current: { commit: mapping.sourceCommit, copyId: mapping.copyId, artifactHash: null, artifactStatus: 'per-service-manifest-and-script-sha256-verified' }, health, lastReceipt: null };
      } catch (error) { test = { identity: mapping.identity, mode: mapping.mode, database: mapping.database, warning: error.code ?? 'TEST_OBSERVATION_FAILED', health: { pass: false }, deploymentAllowed: false }; }
      return { repository: config.repository, worktree: mapping.repositoryRoot, git, configuredSourceCommit: config.sourceCommit, environments: { TEST: test, LIVE: { identity: config.environments.LIVE.identity, observation: 'NOT_OBSERVED', configurationOnly: true } }, locked: fs.existsSync(path.join(config.stateRoot, 'operation.lock')), recovery: fs.existsSync(path.join(config.stateRoot, 'recovery.json')) ? 'EXISTING_RECOVERY_FENCE_PRESENT' : null, hostDeploymentEnabled: false, mode: mapping.mode };
    },
    async smoke(args) { demand(args?.environment === 'TEST', 'TEST_ONLY'); return probe(mapping); },
    execute: blocked, prepare: blocked, dryRunLive: blocked, observe: blocked, screenshot: blocked,
  };
}

export async function startObservedServer() {
  const root = path.join(process.env.LOCALAPPDATA, 'MelisaERPServer', 'deploy-mcp-control');
  const mapping = validateMapping(read(path.join(root, 'observed-test-mapping.json')));
  const library = path.join(root, 'source', '19437c7c7a8ce0b81d9cea5654ff606661d0c3b1', 'apps', 'deploy-mcp', 'server.mjs');
  const { createServer } = await import(pathToFileURL(library).href);
  const config = read(process.env.MELISA_DEPLOY_CONFIG);
  demand(Number(process.env.MELISA_DEPLOY_PORT) === 4213, 'CONTROL_PORT_REJECTED');
  const control = createObservedControl(config, mapping);
  const server = createServer(control, { token: process.env.MELISA_DEPLOY_TOKEN });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.on('error', () => { console.error('OBSERVED_CONTROL_START_FAILED'); process.exitCode = 1; });
  server.listen(4213, '127.0.0.1', () => console.log('Deploy Control ready; externally-supervised TEST observation only; deployment disabled.'));
  return server;
}
