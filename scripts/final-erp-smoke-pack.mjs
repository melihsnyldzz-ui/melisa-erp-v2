import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const isWindows = process.platform === 'win32';
const npmCommand = isWindows ? 'npm.cmd' : 'npm';
const BASE_URL = (process.env.MELISA_API_BASE_URL || 'http://127.0.0.1:4100').replace(/\/+$/, '');
const WRITE_SMOKE_APPROVED = String(process.env.FINAL_ERP_WRITE_SMOKE_APPROVED || 'false').toLowerCase() === 'true';
const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');

const results = [];

function pushResult(name, status, detail = {}) {
  results.push({
    name,
    status,
    ...detail,
  });
}

function runCommand(name, command, args, options = {}) {
  const startedAt = Date.now();
  const spawnCommand = isWindows && command === npmCommand ? (process.env.ComSpec || 'cmd.exe') : command;
  const spawnArgs = isWindows && command === npmCommand ? ['/d', '/s', '/c', command, ...args] : args;
  const run = spawnSync(spawnCommand, spawnArgs, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    env: {
      ...process.env,
      ...(options.env || {}),
    },
  });

  const durationMs = Date.now() - startedAt;
  const output = `${run.stdout || ''}${run.stderr || ''}${run.error ? `\n${run.error.message}` : ''}`;
  const ok = run.status === 0;

  pushResult(name, ok ? 'passed' : 'failed', {
    command: [command, ...args].join(' '),
    spawnCommand: [spawnCommand, ...spawnArgs].join(' '),
    exitCode: run.status,
    durationMs,
    outputTail: output.trim().split(/\r?\n/).slice(-20),
  });

  if (!ok && options.required !== false) {
    const error = new Error(`${name} failed`);
    error.result = results.at(-1);
    throw error;
  }

  return ok;
}

async function apiRequest(method, path, body, token = '') {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || payload?.success === false) {
    const message = payload?.error?.message || payload?.message || `${method} ${path} failed`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

async function runLiveApiReadOnlySmoke() {
  try {
    const health = await apiRequest('GET', '/api/health');
    const login = await apiRequest('POST', '/api/auth/local-passwordless-admin', {});
    const token = login?.data?.accessToken || login?.data?.token || '';

    if (!token) {
      throw new Error('Local passwordless login did not return an access token');
    }

    const [auditCoverage, dashboardSummary, financeSummary] = await Promise.all([
      apiRequest('GET', '/api/audit/coverage', undefined, token),
      apiRequest('GET', '/api/dashboard/summary', undefined, token),
      apiRequest('GET', '/api/finance/summary', undefined, token),
    ]);

    pushResult('live-api-read-only-smoke', 'passed', {
      baseUrl: BASE_URL,
      health: health?.data?.status || 'unknown',
      auditAreas: auditCoverage?.data?.summary?.totalAreas ?? null,
      dashboardSource: dashboardSummary?.meta?.source || null,
      financeSource: financeSummary?.meta?.source || null,
    });
  } catch (error) {
    pushResult('live-api-read-only-smoke', 'warning', {
      baseUrl: BASE_URL,
      message: error.message,
      httpStatus: error.status || null,
      note: 'Live API read-only smoke needs a running API with local passwordless login enabled, or should be run in the approved local test setup.',
    });
  }
}

function runStaticAndBuildSmoke() {
  const commands = [
    ['api audit controller syntax', 'node', ['--check', 'apps/api/src/controllers/auditController.js']],
    ['api audit route syntax', 'node', ['--check', 'apps/api/src/routes/auditRoutes.js']],
    ['api audit service syntax', 'node', ['--check', 'apps/api/src/services/auditService.js']],
    ['web-admin navigation smoke', npmCommand, ['--prefix', 'apps/web-admin', 'run', 'smoke:navigation']],
    ['web-admin list scope smoke', npmCommand, ['--prefix', 'apps/web-admin', 'run', 'smoke:list-scope']],
    ['web-admin finance form smoke', npmCommand, ['--prefix', 'apps/web-admin', 'run', 'smoke:finance-form']],
    ['web-admin action clarity smoke', npmCommand, ['--prefix', 'apps/web-admin', 'run', 'smoke:action-clarity']],
    ['web-admin empty state smoke', npmCommand, ['--prefix', 'apps/web-admin', 'run', 'smoke:empty-state']],
    ['web-admin operational health smoke', npmCommand, ['--prefix', 'apps/web-admin', 'run', 'smoke:operational-health']],
    ['web-admin layout smoke', npmCommand, ['--prefix', 'apps/web-admin', 'run', 'smoke:layout']],
    ['web-admin invoice boundary smoke', npmCommand, ['--prefix', 'apps/web-admin', 'run', 'smoke:invoice-boundary']],
    ['web-admin crm whatsapp boundary smoke', npmCommand, ['--prefix', 'apps/web-admin', 'run', 'smoke:crm-whatsapp-boundary']],
    ['reporting decision support smoke', npmCommand, ['--prefix', 'apps/web-admin', 'run', 'smoke:reporting']],
    ['ai automation readiness smoke', npmCommand, ['--prefix', 'apps/web-admin', 'run', 'smoke:ai-readiness']],
    ['erp core path static smoke', npmCommand, ['--prefix', 'apps/web-admin', 'run', 'smoke:erp-core-path']],
    ['erp core read-only static smoke', npmCommand, ['--prefix', 'apps/web-admin', 'run', 'smoke:erp-core-read-only']],
    ['erp core write approval plan smoke', npmCommand, ['--prefix', 'apps/web-admin', 'run', 'smoke:erp-core-write-plan']],
    ['web-admin production build', npmCommand, ['--prefix', 'apps/web-admin', 'run', 'build']],
  ];

  for (const [name, command, args] of commands) {
    runCommand(name, command, args);
  }
}

function runOptionalWriteSmoke() {
  if (!WRITE_SMOKE_APPROVED) {
    pushResult('controlled-write-smoke', 'skipped', {
      reason: 'FINAL_ERP_WRITE_SMOKE_APPROVED is not true.',
      command: 'FINAL_ERP_WRITE_SMOKE_APPROVED=true node scripts/final-erp-smoke-pack.mjs',
      safety: 'This prevents accidental live DB writes during routine final smoke runs.',
    });
    return;
  }

  runCommand('controlled-write-smoke', 'node', ['scripts/sprint-019-erp-core-write-smoke.mjs']);
}

async function main() {
  const startedAt = new Date().toISOString();

  runStaticAndBuildSmoke();
  await runLiveApiReadOnlySmoke();
  runOptionalWriteSmoke();

  const failed = results.filter((item) => item.status === 'failed');
  const warnings = results.filter((item) => item.status === 'warning');
  const skipped = results.filter((item) => item.status === 'skipped');

  const report = {
    ok: failed.length === 0,
    startedAt,
    finishedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    writeSmokeApproved: WRITE_SMOKE_APPROVED,
    summary: {
      passed: results.filter((item) => item.status === 'passed').length,
      failed: failed.length,
      warnings: warnings.length,
      skipped: skipped.length,
      total: results.length,
    },
    finalTestingInterpretation: failed.length === 0
      ? 'Static/build smoke pack passed. Review warnings/skips before final human testing.'
      : 'Final smoke pack failed. Fix failed items before final human testing.',
    results,
  };

  console.log(JSON.stringify(report, null, 2));

  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    message: error.message,
    failedResult: error.result || null,
    results,
  }, null, 2));
  process.exit(1);
});
