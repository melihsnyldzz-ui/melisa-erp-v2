#!/usr/bin/env node
// Offline record reader. No credentials, browser, network, Git writes or service actions.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { checkAudit } from './audit.mjs';
import { checkProjects } from './project.mjs';

const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function readText(file) {
  if (typeof file !== 'string' || !path.isAbsolute(file)) throw new Error('PATH_REQUIRED');
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size > 16 * 1024 * 1024) throw new Error('INPUT_SIZE');
  return fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
}
function readJson(file) { return JSON.parse(readText(file)); }
function failure(code) {
  return { issues: [{ code, kind: 'check_required', at: 'record-input', message: 'Kontrol girdisi okunamadı; uygulama arızası veya kullanıcı izni eksikliği sonucu çıkarılmaz.' }], wholeClosureGranted: false };
}

export function runCheck(config) {
  if (config?.schemaVersion !== 1 || !['audit', 'projects'].includes(config.mode)) return failure('CONFIG_INVALID');
  try {
    let result;
    if (config.mode === 'audit') {
      const state = readJson(config.statePath);
      // Only the explicit configured tracker is read, never a path from untrusted tool input.
      result = checkAudit({ state, tracker: readJson(config.trackerPath), step: config.step ?? 'records' });
    } else {
      result = checkProjects({ erpMarkdown: readText(config.erpStatusPath), crmMarkdown: readText(config.crmStatusPath) });
    }
    return { ...result, wholeClosureGranted: false };
  } catch { return failure('RECORD_READ_FAILED'); }
}

export function hookOutput(result, { eventName, stopHookActive = false, changed = true, cacheSaved = false, allowStopContinuation = false } = {}) {
  const summary = result.issues.length
    ? `Melisa kayıt kontrolü: ${result.issues.filter(i => i.kind === 'inconsistency').length} kayıt çelişkisi, ${result.issues.filter(i => i.kind === 'check_required').length} ilgili adım kontrolü. Kodlar: ${[...new Set(result.issues.map(i => i.code))].slice(0,12).join(', ')}. Yalnız ilgili kaydı/eksik önkoşulu ele al; kabul edilmiş işi tekrar etme. Bu sonuç işlev veya insan kabulü değildir.`
    : 'Melisa kayıtları tutarlı. Mevcut Sıradaki iş kaydındaki yetkili adıma devam et; bu sonuç çalışan teslim veya insan kabulü değildir.';
  if (eventName === 'SessionStart') return { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: summary } };
  if (eventName === 'Stop' && changed && cacheSaved && allowStopContinuation && !stopHookActive && result.issues.some(i => i.kind === 'inconsistency'))
    return { decision: 'block', reason: summary + ' Bu bulgu için en fazla bir düzeltme devamı; çözülemiyorsa somut nedeni kaydet, tekrar döngüsü açma.' };
  if (changed && result.issues.length) return { systemMessage: summary };
  return {};
}

function canonical(file) {
  const absolute = path.resolve(file);
  let resolved;
  try { resolved = fs.realpathSync(absolute); }
  catch { try { resolved = path.join(fs.realpathSync(path.dirname(absolute)), path.basename(absolute)); } catch { resolved = absolute; } }
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}
function aliases(left, right) {
  if (canonical(left) === canonical(right)) return true;
  try { const a = fs.statSync(left), b = fs.statSync(right); return a.ino !== 0 && a.ino === b.ino && a.dev === b.dev; } catch { return false; }
}
function validCache(value) {
  return value && Object.keys(value).sort().join(',') === 'codes,recordedAt,schemaVersion,signature'
    && value.schemaVersion === 1 && /^[a-f0-9]{64}$/.test(value.signature)
    && Array.isArray(value.codes) && value.codes.length <= 256 && value.codes.every(code => typeof code === 'string' && /^[A-Z_]{1,80}$/.test(code))
    && typeof value.recordedAt === 'string' && Number.isFinite(Date.parse(value.recordedAt));
}

export function remember(cachePath, result, { protectedPaths = [] } = {}) {
  // Only result fingerprints/codes; no source text, accounts, secrets or delivery state.
  if (typeof cachePath !== 'string' || !path.isAbsolute(cachePath)) return { changed: true, cacheSaved: false };
  if (protectedPaths.some(file => typeof file === 'string' && path.isAbsolute(file) && aliases(cachePath, file))) return { changed: true, cacheSaved: false };
  const signature = digest({ issues: result.issues, selectedId: result.selectedId, mainIds: result.mainIds, counts: result.counts, prerequisites: result.prerequisites });
  let lock;
  let temp;
  try {
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    lock = fs.openSync(cachePath + '.lock', 'wx');
    let previous;
    if (fs.existsSync(cachePath)) {
      try { previous = readJson(cachePath); } catch { return { changed: true, cacheSaved: false }; }
      if (!validCache(previous)) return { changed: true, cacheSaved: false };
    }
    const changed = previous?.signature !== signature;
    if (changed) {
      temp = `${cachePath}.${crypto.randomUUID()}.tmp`;
      fs.writeFileSync(temp, JSON.stringify({ schemaVersion: 1, signature, codes: [...new Set(result.issues.map(i => i.code))], recordedAt: new Date().toISOString() }) + '\n', { flag: 'wx' });
      fs.renameSync(temp, cachePath);
      temp = undefined;
    }
    return { changed, cacheSaved: true };
  } catch { return { changed: true, cacheSaved: false }; }
  finally {
    if (lock !== undefined) { fs.closeSync(lock); try { fs.unlinkSync(cachePath + '.lock'); } catch {} }
    if (temp) try { fs.unlinkSync(temp); } catch {}
  }
}

export function main(argv = process.argv.slice(2)) {
  const isHook = argv.includes('--hook');
  let result;
  let config;
  let configPath;
  let event = {};
  try {
    const configIndex = argv.indexOf('--config');
    if (configIndex < 0 || !argv[configIndex + 1]) throw new Error('CONFIG_REQUIRED');
    configPath = path.resolve(argv[configIndex + 1]);
    config = readJson(configPath);
    if (isHook) {
      const input = fs.readFileSync(0, 'utf8');
      if (input.length > 65536) throw new Error('EVENT_SIZE');
      event = JSON.parse(input || '{}');
      if (!['SessionStart', 'Stop'].includes(event.hook_event_name)) throw new Error('EVENT_UNSUPPORTED');
    }
    result = runCheck(config);
  } catch { result = failure('CHECK_INPUT_INVALID'); }
  const remembered = remember(config?.cachePath, result, { protectedPaths: [configPath, config?.statePath, config?.trackerPath, config?.erpStatusPath, config?.crmStatusPath] });
  if (isHook) {
    process.stdout.write(JSON.stringify(hookOutput(result, { eventName: event.hook_event_name, stopHookActive: event.stop_hook_active === true,
      ...remembered, allowStopContinuation: config?.allowStopContinuation === true })) + '\n');
    return 0;
  }
  const status = result.issues.some(i => i.kind === 'inconsistency') ? 'INCONSISTENCY' : result.issues.length ? 'CHECK_REQUIRED' : 'RECORDS_CONSISTENT';
  process.stdout.write(JSON.stringify({ status, ...remembered, ...result, repeatAcceptedTests: false }, null, 2) + '\n');
  return status === 'INCONSISTENCY' ? 2 : status === 'CHECK_REQUIRED' ? 3 : 0;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main();
