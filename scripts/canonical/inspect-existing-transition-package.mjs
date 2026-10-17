// Read-only inspection of an explicitly pinned, existing TEST transition bundle.
// No SQL connection, task/service mutation, process launch/stop, migration or restore.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

export const DB02 = 'MELISA_ERP_CRM_SHARED_TEST_20261009_02';
export const COPY_ID = 'e16b70f0-4057-428b-9abc-6bbcaf35fe82';
const ports = new Set([5194, 5234, 4184, 4186, 62700, 62701, 62702, 62703, 62704]);
const sha = /^[a-f0-9]{64}$/;
const commit = /^[a-f0-9]{40}$/;
const run = promisify(execFile);
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function fail(code) { throw new Error(code); }
function keys(obj, allowed) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj) || Object.keys(obj).some(k => !allowed.includes(k))) fail('UNKNOWN_FIELDS');
}
export function absoluteWithin(value, root) {
  if (typeof value !== 'string' || /[\r\n"<>|]/.test(value) || !/^[A-Z]:\\/i.test(value) || value.includes('/') || value.split('\\').some(p => p === '.' || p === '..')) fail('UNSAFE_PATH');
  const normalized = path.win32.normalize(value);
  if (normalized !== value || !value.toLowerCase().startsWith(root.toLowerCase() + '\\')) fail('WRONG_PATH_SCOPE');
  return value;
}
export function validateTransitionManifest(m) {
  keys(m, ['schemaVersion', 'database', 'copyId', 'actualT1', 'packages', 'services', 'evidence', 'missing', 'backup']);
  if (m.schemaVersion !== 1 || m.database !== DB02 || m.copyId !== COPY_ID || m.actualT1 !== false) fail('WRONG_TEST_TARGET');
  if (!Array.isArray(m.packages) || !m.packages.length || !Array.isArray(m.services) || !Array.isArray(m.evidence) || !Array.isArray(m.missing)) fail('INVALID_COLLECTION');
  const ids = new Set();
  for (const p of m.packages) {
    keys(p, ['id', 'rootPath', 'manifestSha256', 'sourceCommit', 'packageId']);
    if (!/^[a-z][a-z0-9-]{0,40}$/.test(p.id) || ids.has(p.id) || !sha.test(p.manifestSha256) || !commit.test(p.sourceCommit) || typeof p.packageId !== 'string') fail('BAD_PACKAGE_PIN');
    ids.add(p.id);
    absoluteWithin(p.rootPath, p.rootPath.startsWith('C:\\Sirket\\CRM\\') ? 'C:\\Sirket\\CRM\\releases' : 'C:\\Sirket\\ERP\\releases');
  }
  const seenPorts = new Set();
  for (const s of m.services) {
    keys(s, ['port', 'package', 'entry', 'health', 'mode']);
    if (!ports.has(s.port) || seenPorts.has(s.port) || !ids.has(s.package) || !['identity', 'html', 'process-only'].includes(s.health)) fail('UNAPPROVED_SERVICE');
    seenPorts.add(s.port);
    const p = m.packages.find(p => p.id === s.package);
    absoluteWithin(s.entry, p.rootPath);
    if (s.mode !== undefined && !['erp', 'native'].includes(s.mode)) fail('INVALID_MODE');
  }
  for (const e of m.evidence) {
    keys(e, ['id', 'filePath', 'sha256', 'kind']);
    if (!/^[a-z][a-z0-9-]{0,60}$/.test(e.id) || !sha.test(e.sha256) || !['document', 'restore', 'inverse-independent', 'inverse-fault', 'inverse-conflict', 'inverse-replay', 'backup-receipt'].includes(e.kind)) fail('BAD_EVIDENCE_PIN');
    absoluteWithin(e.filePath, 'C:\\Sirket\\ERP\\evidence');
  }
  if (m.backup) {
    keys(m.backup, ['filePath', 'sizeBytes', 'recordedSha256']);
    absoluteWithin(m.backup.filePath, 'C:\\Sirket\\ERP\\backups');
    if (!Number.isSafeInteger(m.backup.sizeBytes) || m.backup.sizeBytes < 1 || !sha.test(m.backup.recordedSha256)) fail('BAD_BACKUP_PIN');
  }
  if (m.missing.some(v => typeof v !== 'string' || v.length > 240)) fail('BAD_MISSING_LIST');
  return m;
}
export function validateEvidence(kind, j) {
  if (kind === 'restore') return j.restored === true && j.activeDatabaseOverwritten === false && j.database === 'MELISA_ERP_STAGE05_INVERSE_TEST_20261009_01';
  if (kind === 'inverse-independent') return j.passed === true && j.SELECTOnly === true && j.sqlWrites === 0 && j.identity?.database === 'MELISA_ERP_STAGE05_INVERSE_TEST_20261009_01';
  if (kind === 'inverse-fault') return j.status === 'PASS' && j.actualFaultReachedBeforeCommit === true && j.committedRecoveryEffects === 0 && j.originalLocalRowsPreserved === true && sha.test(j.beforeHash) && j.beforeHash === j.afterHash;
  if (kind === 'inverse-conflict') return j.status === 'PASS' && j.error === 'RECOVERY_UUID_BODY_CONFLICT' && j.committedEffects === 0;
  if (kind === 'inverse-replay') return j.status === 'REPLAY_NOOP' && j.actualT1 === false && j.target?.database === 'MELISA_ERP_STAGE05_INVERSE_TEST_20261009_01';
  if (kind === 'backup-receipt') return j.sourceDatabase === DB02 && j.copyOnly === true && j.checksum === true && j.verifyOnlyPassed === true && j.restorePerformed === false && j.activeOverwrite === false && j.liveConnected === false;
  return kind === 'document';
}
export function validateHealth(j, s, p) {
  return j?.ok === true && j.sourceCommit === p.sourceCommit && j.packageId === p.packageId && (j.databaseName ?? j.database) === DB02 && j.copyId === COPY_ID && j.actualT1 === false && (s.mode === undefined || j.mode === s.mode);
}
export function validateProcess(record, service) {
  if (!record || !Number.isSafeInteger(record.pid) || record.pid < 1 || !record.created || typeof record.command !== 'string' || record.executable?.toLowerCase() !== 'c:\\program files\\nodejs\\node.exe') return false;
  // Match an entire quoted or whitespace-delimited argument, never a substring.
  const escape = v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const prefix = `^"?${escape(record.executable)}"?\\s+(?:"${escape(service.entry)}"|${escape(service.entry)})(?=\\s|$)`;
  return new RegExp(prefix + (service.mode ? `\\s+"?${service.mode}"?(?=\\s|$)` : ''), 'i').test(record.command);
}
async function safeFile(file) {
  let cursor = file;
  while (path.dirname(cursor) !== cursor) {
    if ((await fs.lstat(cursor)).isSymbolicLink()) fail('REPARSE_POINT');
    cursor = path.dirname(cursor);
  }
  return fs.readFile(file);
}
async function processes() {
  const ps = '$ports=@(5194,5234,4184,4186,62700,62701,62702,62703,62704); @((Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object {$_.LocalPort -in $ports} | ForEach-Object {$p=Get-CimInstance Win32_Process -Filter ("ProcessId="+$_.OwningProcess); [pscustomobject]@{port=$_.LocalPort;pid=[int]$_.OwningProcess;executable=$p.ExecutablePath;command=$p.CommandLine;created=$p.CreationDate.ToString("o")}})) | ConvertTo-Json -Compress';
  const result = await run('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { timeout: 15000, maxBuffer: 300000 });
  const parsed = JSON.parse(result.stdout.trim() || '[]');
  return Array.isArray(parsed) ? parsed : [parsed];
}
async function get(port, health) {
  // Fixed loopback host, fixed paths, GET only, no cookies/auth/provider requests or redirects.
  const response = await fetch(`http://127.0.0.1:${port}${health === 'identity' ? '/test-health' : '/'}`, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(10000) });
  if (response.status !== 200 || Number(response.headers.get('content-length') || 0) > 2000000) fail('HEALTH_HTTP');
  const text = await response.text();
  if (text.length > 2000000) fail('HEALTH_BODY_LIMIT');
  return health === 'identity' ? JSON.parse(text) : text;
}
export async function inspectTransitionPackage(manifest, adapters = {}) {
  const m = validateTransitionManifest(manifest);
  const read = adapters.read ?? safeFile;
  const result = { schemaVersion: 1, observedAtUtc: new Date().toISOString(), database: DB02, copyId: COPY_ID, actualT1: false, readOnly: true, sqlConnected: false, restoredNow: false, runtimeChanged: false, packages: [], services: [], evidence: [], backup: null, missing: m.missing, readyForLive: false };
  const checked = new Map();
  for (const p of m.packages) {
    const row = { id: p.id, sourceCommit: p.sourceCommit, packageId: p.packageId, passed: false, checkedFiles: 0 };
    try {
      const bytes = await read(path.win32.join(p.rootPath, 'release-manifest.json'));
      if (digest(bytes) !== p.manifestSha256) fail('MANIFEST_CHANGED');
      const j = JSON.parse(bytes);
      const crm = j.kind === 'melisa-crm-test-package' && j.environment === 'TEST' && j.source?.repository === 'https://github.com/melihsnyldzz-ui/melisa-crm.git' && j.build?.isolatedPreparation === true;
      const actualSource = crm ? j.source.commit : j.sourceCommit;
      const actualPackage = crm ? path.win32.basename(p.rootPath) : j.packageId;
      if (actualSource !== p.sourceCommit || actualPackage !== p.packageId || !Array.isArray(j.files) || !j.files.length) fail('PACKAGE_IDENTITY');
      const seen = new Set();
      for (const entry of j.files) {
        if (typeof entry.path !== 'string' || /[\\:\r\n]/.test(entry.path) || entry.path.startsWith('/') || entry.path.split('/').some(v => !v || v === '.' || v === '..') || seen.has(entry.path) || !sha.test(entry.sha256)) fail('UNSAFE_MANIFEST_ENTRY');
        seen.add(entry.path);
        const file = path.win32.join(p.rootPath, ...entry.path.split('/'));
        if (digest(await read(file)) !== entry.sha256) fail('PACKAGE_FILE_CHANGED');
        row.checkedFiles++;
      }
      const required = m.services.filter(s => s.package === p.id).map(s => path.win32.relative(p.rootPath, s.entry).replaceAll('\\', '/'));
      if (required.some(v => !seen.has(v))) fail('ENTRY_NOT_PINNED');
      row.passed = true;
      checked.set(p.id, j);
    } catch (e) { row.error = e.code === 'ENOENT' ? 'FILE_MISSING' : /^[A-Z_]+$/.test(e.message) ? e.message : 'PACKAGE_CHECK_FAILED'; }
    result.packages.push(row);
  }
  let observed = [];
  try { observed = await (adapters.processes ?? processes)(); } catch { result.processInventoryError = 'PROCESS_INVENTORY_FAILED'; }
  for (const s of m.services) {
    const row = { port: s.port, package: s.package, processMatched: false, healthMatched: false, healthKind: s.health };
    const candidates = observed.filter(r => r.port === s.port);
    const p = m.packages.find(p => p.id === s.package);
    if (checked.has(s.package) && candidates.length && candidates.every(r => validateProcess(r, s))) {
      row.processMatched = true;
      row.pid = candidates[0].pid;
      row.created = candidates[0].created;
      if (s.health !== 'process-only') {
        try {
          const value = await (adapters.get ?? get)(s.port, s.health);
          if (s.health === 'identity') row.healthMatched = validateHealth(value, s, p);
          else {
            const entry = checked.get(p.id).files.find(v => ['apps/frontend/dist/client/index.html', 'dist/client/index.html', 'dist/index.html'].includes(v.path));
            row.healthMatched = Boolean(entry && digest(Buffer.from(value)) === entry.sha256);
            row.databaseConnectionProven = false;
          }
        } catch { row.error = 'HEALTH_UNAVAILABLE'; }
      }
    } else row.error = candidates.length ? 'PROCESS_OR_PACKAGE_MISMATCH' : 'PORT_NOT_LISTENING';
    result.services.push(row);
  }
  for (const e of m.evidence) {
    const row = { id: e.id, kind: e.kind, passed: false, historicalEvidence: true };
    try {
      const bytes = await read(e.filePath);
      if (digest(bytes) !== e.sha256) fail('EVIDENCE_CHANGED');
      if (!validateEvidence(e.kind, e.kind === 'document' ? null : JSON.parse(bytes))) fail('EVIDENCE_SEMANTICS');
      row.passed = true;
    } catch (err) { row.error = err.code === 'ENOENT' ? 'FILE_MISSING' : /^[A-Z_]+$/.test(err.message) ? err.message : 'EVIDENCE_CHECK_FAILED'; }
    result.evidence.push(row);
  }
  if (m.backup) {
    try {
      const stat = await (adapters.stat ?? fs.stat)(m.backup.filePath);
      result.backup = { present: stat.isFile(), sizeMatches: stat.size === m.backup.sizeBytes, sha256Recomputed: false, restorePerformed: false, recordedSha256: m.backup.recordedSha256 };
    } catch { result.backup = { present: false, sha256Recomputed: false, restorePerformed: false }; }
  }
  result.inspectionPassed = result.packages.every(r => r.passed) && result.evidence.every(r => r.passed) && result.services.every(r => r.processMatched && (r.healthKind === 'process-only' || r.healthMatched)) && (!m.backup || result.backup?.present && result.backup?.sizeMatches);
  return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.platform !== 'win32' || process.argv.length !== 4 || process.argv[2] !== '--manifest') fail('USAGE_MANIFEST_ONLY_WINDOWS');
    absoluteWithin(process.argv[3], 'C:\\Sirket\\ERP\\evidence');
    const report = await inspectTransitionPackage(JSON.parse(await safeFile(process.argv[3])));
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    if (!report.inspectionPassed) process.exitCode = 2;
  } catch (e) { process.stderr.write(`Inspection refused: ${/^[A-Z_]+$/.test(e.message) ? e.message : 'INVALID_INPUT'}\n`); process.exitCode = 2; }
}
