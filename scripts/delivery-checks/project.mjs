// Pure checks of the current work record. No IO, retest, authority or closure grant.
import {createHash} from 'node:crypto';
import {MAIN_IDS} from './audit.mjs';

const MAIN_ID_SET = new Set(MAIN_IDS);
const CONTEXT_KEYS = ['environment', 'runtime', 'identityRole', 'surface'];
const FIELDS = {
  main: ['ana id', 'ana baslik', 'ana id / sira'],
  step: ['guncel adim', 'simdiki adim', 'adim'],
  owner: ['sahip', 'sahibi'],
  completion: ['bitis kosulu', 'somut bitis kosulu', 'kapanis kosulu', 'bitis', 'kapanis'],
  evidence: ['mevcut kanit', 'kanit'],
  dependency: ['teknik bagimlilik', 'insan karari/engel', 'bagimlilik/engel', 'bagimlilik / engel', 'bagimlilik', 'engel'],
  next: ['bitince siradaki adim', 'bitince ayni basliktaki sonraki adim', 'sonraki adim', 'siradaki adim'],
  transition: ['crm06 tum ozgun kosullari kapaninca gecis'],
};
const MESSAGES = Object.freeze({
  PROJECT_RECORD_MISSING: 'Üstteki tek Sıradaki iş kaydı bulunamadı.',
  PROJECT_RECORD_AMBIGUOUS: 'Güncel iş kaydı birden fazla tablo veya yinelenen alan içeriyor.',
  PROJECT_FIELD_MISSING: 'Güncel iş kaydında gerekli bir alan eksik.',
  PROJECT_MAIN_INVALID: 'Güncel ana başlık kimliği doğrulanamadı.',
  PROJECT_MAIN_MISMATCH: 'ERP ve CRM güncel ana başlıkları farklı.',
  PROJECT_CLOSURE_GATE_REQUIRED: 'CRM06 ardından ERP09 geçişi özgün tüm koşullar ve gereken insan kabulüyle tam kapanışa bağlanmalı.',
  PREFLIGHT_MISSING: 'İsteğe bağlı önkoşul görünümü yok; önkoşullar doğrulanmış sayılmadı.',
  PREFLIGHT_INVALID: 'Önkoşul görünümü geçerli tek JSON kaydı değil.',
  PREREQUISITE_INVALID: 'Gerekli önkoşul tanımı geçersiz veya yinelenmiş.',
  PROOF_MISSING: 'Bu önkoşul için doğrulanmış kanıt eksik.',
  PROOF_AMBIGUOUS: 'Bu önkoşul için birden fazla kanıt kaydı var.',
  PROOF_BLOCKED: 'Bu önkoşulun hata veya engel kaydı çözülmedi.',
  PROOF_UNVERIFIED: 'Bu önkoşulun kanıtı doğrulanmış değil.',
  PROOF_REFERENCE_INVALID: 'Bu önkoşulun geçerli kanıt referansı yok.',
  CONTEXT_UNKNOWN: 'Bu önkoşulun gerekli güncel bağlamı bilinmiyor.',
  CONTEXT_CHANGED: 'Bu önkoşulun kanıt bağlamı güncel bağlamla eşleşmiyor.',
});
const issue = (code, at, kind = 'check_required') => ({code, kind, at, message: MESSAGES[code]});
const fold = value => value.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/\p{M}/gu, '').replace(/ı/g, 'i').trim();
const plain = value => value.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*`_]/g, '').trim();
const present = value => typeof value === 'string' && plain(value).length > 0 && !/^[-—–]+$/.test(plain(value));
function record(value) {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Object.values(descriptors).some(d => !Object.hasOwn(d, 'value'))) return null;
    return Object.fromEntries(Object.entries(descriptors).map(([key, d]) => [key, d.value]));
  } catch { return null; }
}
const opaqueId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)
  && !['unknown', 'unverified', 'pending', 'null', 'undefined'].includes(value.toLowerCase());
function evidenceReference(value) {
  if (typeof value !== 'string' || value.length > 512 || /\s/.test(value)) return false;
  if (/^(?:evidence|proof):[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value)) return true;
  if (/^docs\/evidence\/[A-Za-z0-9._/-]+\.(?:md|json|txt)$/.test(value)
      && !value.split('/').some(part => part === '.' || part === '..' || part === '')) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'github.com' && !url.username && !url.password
      && !url.port && !url.search && !url.hash
      && /^\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/(?:commit\/[a-f0-9]{40}|blob\/[a-f0-9]{40}\/docs\/evidence\/[A-Za-z0-9._/-]+\.(?:md|json|txt))$/.test(url.pathname)
      && !url.pathname.split('/').includes('..');
  } catch { return false; }
}
function proofFingerprint(id, keys, current, proofs) {
  const relevant = Array.isArray(keys) ? CONTEXT_KEYS.filter(key => keys.includes(key)) : [];
  const contextView = context => Object.fromEntries(relevant.map(key => [key, opaqueId(context?.[key]) ? context[key] : null]));
  const proofViews = proofs.map(proof => ({
    status: ['verified', 'blocked', 'error', 'failed'].includes(proof.status) ? proof.status : 'unverified',
    hasError: proof.error != null && proof.error !== false,
    context: contextView(record(proof.context)),
    evidenceRef: typeof proof.evidenceRef === 'string' && proof.evidenceRef.length <= 512 ? proof.evidenceRef : null,
  }));
  // Ordering changes and unrelated metadata must not reopen an unchanged check.
  const canonicalProofs = proofViews.map(value => JSON.stringify(value)).sort();
  return createHash('sha256').update(JSON.stringify({id, keys: relevant, current: contextView(current), proofs: canonicalProofs})).digest('hex');
}

/** required: [{id, contextKeys?}], proofs: [{requirementId,status,context,evidenceRef}].
 * contextKeys defaults to all four nonsensitive revision IDs. REUSE reuses the
 * declared evidence; it neither executes a check nor grants whole-job closure.
 */
export function evaluatePrerequisites({current, proofs, required} = {}) {
  const issues = [], requirements = [], now = record(current);
  if (!Array.isArray(required) || required.length === 0 || required.length > 128) {
    return {issues: [issue('PREFLIGHT_INVALID', 'required')], requirements, wholeClosureGranted: false};
  }
  const entries = Array.isArray(proofs) ? proofs.map(record) : [];
  const counts = new Map();
  for (const input of required) {
    const definition = record(input);
    if (opaqueId(definition?.id)) counts.set(definition.id, (counts.get(definition.id) ?? 0) + 1);
  }
  Array.from(required).forEach((input, index) => {
    const definition = record(input), id = opaqueId(definition?.id) ? definition.id : null;
    const at = `required[${index}]`, keys = definition && Object.hasOwn(definition, 'contextKeys') ? definition.contextKeys : CONTEXT_KEYS;
    const matching = id ? entries.filter(proof => proof?.requirementId === id) : [];
    const fingerprint = proofFingerprint(id, keys, now, matching);
    const finish = (decision, code) => {
      requirements.push({id: at, decision, code, fingerprint});
      if (code) issues.push(issue(code, at));
    };
    if (!id || counts.get(id) !== 1 || !Array.isArray(keys) || keys.length === 0
        || keys.some(key => !CONTEXT_KEYS.includes(key)) || new Set(keys).size !== keys.length) {
      finish('BLOCKED', 'PREREQUISITE_INVALID'); return;
    }
    if (!matching.length) { finish('CHECK_REQUIRED', 'PROOF_MISSING'); return; }
    if (matching.length !== 1) { finish('BLOCKED', 'PROOF_AMBIGUOUS'); return; }
    const proof = matching[0];
    if (['blocked', 'error', 'failed'].includes(proof.status) || proof.error != null && proof.error !== false) {
      finish('BLOCKED', 'PROOF_BLOCKED'); return;
    }
    if (proof.status !== 'verified') { finish('CHECK_REQUIRED', 'PROOF_UNVERIFIED'); return; }
    if (!evidenceReference(proof.evidenceRef)) { finish('CHECK_REQUIRED', 'PROOF_REFERENCE_INVALID'); return; }
    const context = record(proof.context);
    if (!now || !context || [now, context].some(value => Object.keys(value).some(key => !CONTEXT_KEYS.includes(key)))
        || keys.some(key => !opaqueId(now?.[key]) || !opaqueId(context?.[key]))) {
      finish('CHECK_REQUIRED', 'CONTEXT_UNKNOWN'); return;
    }
    if (keys.some(key => now[key] !== context[key])) { finish('CHECK_REQUIRED', 'CONTEXT_CHANGED'); return; }
    finish('REUSE', null);
  });
  return {issues, requirements, wholeClosureGranted: false};
}

function currentSection(markdown) {
  if (typeof markdown !== 'string') return null;
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  let fence = null, start = -1;
  for (let i = 0; i < lines.length; i++) {
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(lines[i]);
    if (marker) {
      if (!fence) fence = {char: marker[1][0], length: marker[1].length};
      else if (marker[1][0] === fence.char && marker[1].length >= fence.length && marker[2].trim() === '') fence = null;
      continue;
    }
    if (fence) continue;
    const heading = /^ {0,3}(#{2,6})\s+(.+?)\s*#*\s*$/.exec(lines[i]);
    if (!heading) continue;
    if (start < 0) {
      // The current record must be the first section, never a historical body hit.
      if (heading[1] !== '##' || !/^siradaki is(?:\s*[—–-]\s*.+)?$/.test(fold(plain(heading[2])))) return null;
      start = i + 1;
    } else if (heading[1] === '##') return lines.slice(start, i);
  }
  return start < 0 || fence ? null : lines.slice(start);
}
function cells(line) {
  if (!/^\s*\|/.test(line)) return null;
  const result = [], text = line.trim(); let cell = '';
  for (let i = 1; i < text.length; i++) {
    if (text[i] === '\\' && text[i + 1] === '|') { cell += '|'; i++; }
    else if (text[i] === '|') { result.push(cell.trim()); cell = ''; }
    else cell += text[i];
  }
  if (cell.trim()) result.push(cell.trim());
  return result.length === 2 ? result : null;
}
function readWorkRecord(section) {
  const rows = new Map(), labels = new Set(), blocks = [];
  let tableCount = 0, bulletCount = 0, inTable = false, fence = null, block = null, malformed = false;
  function add(key, value) {
    const field = Object.entries(FIELDS).find(([, names]) => names.includes(key))?.[0];
    if (!field) return false;
    if (labels.has(key) || rows.has(field) && field !== 'dependency') malformed = true;
    labels.add(key);
    rows.set(field, rows.has(field) ? rows.get(field) + ' ' + value : value);
    return true;
  }
  for (const line of section) {
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (marker) {
      if (!fence) {
        fence = {char: marker[1][0], length: marker[1].length};
        block = marker[2].trim() === 'melisa-preflight' ? [] : null;
      } else if (marker[1][0] === fence.char && marker[1].length >= fence.length && !marker[2].trim()) {
        if (block) blocks.push(block.join('\n')); fence = null; block = null;
      } else if (block) block.push(line);
      inTable = false; continue;
    }
    if (fence) { if (block) block.push(line); continue; }
    if (/^\s*\|/.test(line)) {
      if (!inTable) tableCount++;
      inTable = true;
      const row = cells(line);
      if (!row) { malformed = true; continue; }
      const key = fold(plain(row[0]));
      if (/^:?-+:?$/.test(key) || ['alan', 'baslik'].includes(key)) continue;
      add(key, row[1]);
    } else {
      inTable = false;
      const bullet = /^\s*[-*+]\s+\*\*([^*]+?):\*\*\s*(.*)$/.exec(line);
      if (bullet && add(fold(bullet[1]), bullet[2])) bulletCount++;
    }
  }
  return {rows, blocks, malformed: malformed || Boolean(fence), tableCount, bulletCount};
}
function closureGate(rows) {
  const transition = rows.get('transition');
  const text = fold(plain((rows.get('completion') ?? '') + ' ' + (rows.get('next') ?? '')
    + (transition ? ' CRM06 tüm özgün koşulları kapanınca geçiş: ' + transition : '')));
  return /crm06/.test(text) && /erp09/.test(text)
    && /(?:ozgun|k01[\s\S]*k02[\s\S]*k03)/.test(text)
    && /(?:tum|butun|tam)\b/.test(text) && /insan[\s\S]*kabul/.test(text)
    && /crm06\b[^.!?]{0,100}(?:kapanirsa|kapaninca|tamamlanirsa|tamamlaninca)/.test(text);
}

export function checkProjects({erpMarkdown, crmMarkdown} = {}) {
  const issues = [], mainIds = {ERP: null, CRM: null}, prerequisites = {ERP: null, CRM: null};
  for (const [project, markdown] of [['ERP', erpMarkdown], ['CRM', crmMarkdown]]) {
    const section = currentSection(markdown);
    if (!section) { issues.push(issue('PROJECT_RECORD_MISSING', project, 'inconsistency')); continue; }
    const {rows, blocks, malformed, tableCount, bulletCount} = readWorkRecord(section);
    if (malformed || !(tableCount === 1 && bulletCount === 0 || tableCount === 0 && bulletCount > 0)) issues.push(issue('PROJECT_RECORD_AMBIGUOUS', project, 'inconsistency'));
    for (const field of Object.keys(FIELDS).filter(key => key !== 'transition')) {
      if (!present(rows.get(field))) issues.push(issue('PROJECT_FIELD_MISSING', `${project}.${field}`, 'inconsistency'));
    }
    const main = plain(rows.get('main') ?? '');
    const match = /^(?:ERP|CRM|TER|DATA|EDU|REL)\d{2}\b/.exec(main);
    // Historical counters such as CRM25 are not members of the fixed main-ID set.
    const ids = new Set((main.match(/\b(?:ERP|CRM|TER|DATA|EDU|REL)\d{2}\b/g) ?? []).filter(id => MAIN_ID_SET.has(id)));
    if (!match || !MAIN_ID_SET.has(match[0]) || ids.size !== 1) issues.push(issue('PROJECT_MAIN_INVALID', `${project}.main`, 'inconsistency'));
    else mainIds[project] = match[0];
    if (mainIds[project] === 'CRM06' && !closureGate(rows)) issues.push(issue('PROJECT_CLOSURE_GATE_REQUIRED', `${project}.next`, 'inconsistency'));
    if (blocks.length === 0) { issues.push(issue('PREFLIGHT_MISSING', `${project}.preflight`)); continue; }
    try {
      if (blocks.length !== 1) throw Error();
      const projection = record(JSON.parse(blocks[0]));
      if (!projection || Object.keys(projection).some(key => !['current', 'required', 'proofs'].includes(key))) throw Error();
      const result = evaluatePrerequisites(projection); prerequisites[project] = result;
      issues.push(...result.issues.map(entry => ({...entry, at: `${project}.preflight.${entry.at}`})));
    } catch { issues.push(issue('PREFLIGHT_INVALID', `${project}.preflight`)); }
  }
  if (mainIds.ERP && mainIds.CRM && mainIds.ERP !== mainIds.CRM) issues.push(issue('PROJECT_MAIN_MISMATCH', 'ERP+CRM', 'inconsistency'));
  return {issues, mainIds, prerequisites, wholeClosureGranted: false};
}
