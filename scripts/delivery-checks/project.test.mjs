import test from 'node:test';
import assert from 'node:assert/strict';
import {checkProjects, evaluatePrerequisites} from './project.mjs';

const current = {environment: 'test-copy-r1', runtime: 'runtime-r2', identityRole: 'personnel-r3', surface: 'mobile-r4'};
const requirement = (id, contextKeys) => ({id, ...(contextKeys ? {contextKeys} : {})});
const proof = (requirementId, override = {}) => ({requirementId, status: 'verified', context: {...current}, evidenceRef: 'evidence:accepted-01', ...override});
const projection = {current, required: [requirement('normal-flow')], proofs: [proof('normal-flow')]};
const gatedNext = 'Özgün tüm CRM06 koşulları ve gereken insan kabulü değerlendirilir. Yalnız CRM06 tam kapanırsa ortak21 sıra1 ERP09 seçilir.';
const table = (overrides = {}, preflight = null) => {
  const fields = {'Ana ID': 'CRM06 — K01/K02/K03', 'Güncel adım': 'Normal müşteri/personel akışı', Sahip: 'CRM sahibi ve ERP sahibi',
    'Bitiş koşulu': 'Özgün koşullar, gereken insan kabulü ve bağımsız readback', 'Mevcut kanıt': 'Tarihli kabul korunur',
    'Teknik bağımlılık': 'Son mobil koşul', 'İnsan kararı/engel': 'Yeni parola istenmez', 'Bitince sıradaki adım': gatedNext, ...overrides};
  return '## Sıradaki iş\n\n| Alan | Güncel kayıt |\n| --- | --- |\n'
    + Object.entries(fields).filter(([, value]) => value !== undefined).map(([key, value]) => `| ${key} | ${value} |`).join('\n')
    + (preflight === null ? '' : '\n\n```melisa-preflight\n' + JSON.stringify(preflight) + '\n```')
    + '\n\n## Tarihsel checkpoint\nTamamlandı; ERP09.\n';
};
const bullet = (transition = 'Ortak21 sıra1 **ERP09 — Satış** seçilir.', preflight = null) => '# CRM durumu\n\n'
  + '## Sıradaki iş — CRM06 (tek etkin yürütme kaydı)\n\n'
  + '- **Ana ID / sıra:** **CRM06** — K01/K02/K03\n'
  + '- **Güncel adım:** Normal müşteri ve atanmış personel akışı\n'
  + '- **Sahibi:** CRM sahibi; ERP bağımsız readback\n'
  + '- **Somut bitiş koşulu:** Bütün özgün koşullar ve gereken insan kabulü\n'
  + '- **Mevcut kanıt:** Tarihli kanıt korunur\n'
  + '- **Bağımlılık / engel:** Son mobil kabul\n'
  + '- **Bitince aynı başlıktaki sonraki adım:** Aynı talebin tekrar/açılış kanıtı\n'
  + '- **CRM06 tüm özgün koşulları kapanınca geçiş:** ' + transition + '\n'
  + (preflight === null ? '' : '\n~~~melisa-preflight\n' + JSON.stringify(preflight) + '\n~~~\n')
  + '\n## Tarihsel checkpoint\nAna ID ERP09; tümü PASS.\n';
const codes = result => result.issues.map(entry => entry.code);

test('real ERP table and CRM bullet formats agree; absent optional projections stay unverified', () => {
  const result = checkProjects({erpMarkdown: table(), crmMarkdown: bullet()});
  assert.deepEqual(result.mainIds, {ERP: 'CRM06', CRM: 'CRM06'});
  assert.deepEqual(codes(result), ['PREFLIGHT_MISSING', 'PREFLIGHT_MISSING']);
  assert(result.issues.every(entry => entry.kind === 'check_required'));
  assert.equal(result.wholeClosureGranted, false);
});
test('all verified projections reuse evidence without granting whole-job closure', () => {
  const result = checkProjects({erpMarkdown: table({}, projection), crmMarkdown: bullet(undefined, projection)});
  assert.deepEqual(result.issues, []);
  assert.equal(result.prerequisites.ERP.requirements[0].decision, 'REUSE');
  assert.equal(result.prerequisites.CRM.requirements[0].decision, 'REUSE');
  assert.equal(result.wholeClosureGranted, false);
});
test('historical records and fenced forged headings never supply the current main ID', () => {
  const history = '\n## Sıradaki iş\n| Ana ID | CRM06 |\n```melisa-preflight\n' + JSON.stringify(projection) + '\n```';
  const result = checkProjects({erpMarkdown: table({'Ana ID': 'ERP09 — satış'}) + history, crmMarkdown: bullet()});
  assert.deepEqual(result.mainIds, {ERP: 'ERP09', CRM: 'CRM06'});
  assert(codes(result).includes('PROJECT_MAIN_MISMATCH'));
  assert.equal(result.prerequisites.ERP, null);
  const forged = '```markdown\n' + table() + '\n```\n## Tarihsel kayıt\n' + table();
  assert(codes(checkProjects({erpMarkdown: forged, crmMarkdown: bullet()})).includes('PROJECT_RECORD_MISSING'));
});
test('missing fields, invalid ID and a duplicate current record have bounded static diagnostics', () => {
  const sentinel = 'SYNTHETIC_PRIVATE_CANARY_123';
  const incomplete = table({'Ana ID': sentinel, Sahip: ' ', 'Mevcut kanıt': undefined})
    .replace('\n\n## Tarihsel', '\n\n| Alan | Güncel kayıt |\n| --- | --- |\n| Ana ID | CRM06 |\n\n## Tarihsel');
  const result = checkProjects({erpMarkdown: incomplete, crmMarkdown: bullet()});
  assert(codes(result).includes('PROJECT_RECORD_AMBIGUOUS'));
  assert(codes(result).includes('PROJECT_FIELD_MISSING'));
  assert(codes(result).includes('PROJECT_MAIN_INVALID'));
  assert(!JSON.stringify(result).includes(sentinel));
});
test('aliases are accepted and missing dependencies are not recovered from prose', () => {
  const aliases = table().replace('| Ana ID |', '| Ana başlık |').replace('| Bitiş koşulu |', '| Kapanış |')
    .replace('| Mevcut kanıt |', '| Kanıt |').replace('| Teknik bağımlılık |', '| Engel |')
    .replace('\n\n## Tarihsel', '\n\n- **Not:** Ek açıklama iş alanı değildir.\n\n## Tarihsel');
  assert(!checkProjects({erpMarkdown: aliases, crmMarkdown: bullet()}).issues.some(i => i.kind === 'inconsistency'));
  const missing = bullet().replace('- **Bağımlılık / engel:** Son mobil kabul', 'Bağımlılık prose içinde hazırdır.');
  assert(checkProjects({erpMarkdown: table(), crmMarkdown: missing}).issues.some(i => i.at === 'CRM.dependency'));
});
test('CRM06 cannot skip original closure or silently turn completed prose into ERP09 authority', () => {
  for (const next of ['ERP09 seçilir.', 'CRM06 tamamlandı; ERP09 seçilir.', 'CRM06 kapanmadan ERP09 seçilir.',
    'CRM06 kapanırsa ERP09 seçilir.', 'Tüm özgün CRM06 koşulları hazır. İnsan kabulü var. ERP09 seçilir.']) {
    const result = checkProjects({erpMarkdown: table({'Bitince sıradaki adım': next}), crmMarkdown: bullet()});
    assert(codes(result).includes('PROJECT_CLOSURE_GATE_REQUIRED'), next);
    assert.equal(result.wholeClosureGranted, false);
  }
});
test('malformed or duplicate preflight JSON cannot become verified evidence', () => {
  for (const block of ['```melisa-preflight\n{bad}\n```', '```melisa-preflight\ntrue\n```',
    '```melisa-preflight\n' + JSON.stringify({...projection, wholeClosureGranted: true}) + '\n```',
    '```melisa-preflight\n{}\n```\n```melisa-preflight\n{}\n```']) {
    const document = table().replace('\n\n## Tarihsel', '\n\n' + block + '\n\n## Tarihsel');
    const result = checkProjects({erpMarkdown: document, crmMarkdown: bullet()});
    assert(codes(result).includes('PREFLIGHT_INVALID'));
    assert.equal(result.wholeClosureGranted, false);
  }
});
test('accepted proofs stay reusable after unrelated prose or unneeded context changes', () => {
  const input = {current: {...current, surface: 'surface-next'}, required: [requirement('auth', ['identityRole'])], proofs: [proof('auth')]};
  const before = JSON.stringify(input);
  const result = evaluatePrerequisites(input);
  assert.deepEqual(result.requirements.map(({fingerprint, ...rest}) => rest), [{id: 'required[0]', decision: 'REUSE', code: null}]);
  assert.match(result.requirements[0].fingerprint, /^[a-f0-9]{64}$/);
  assert.deepEqual(result.issues, []);
  assert.equal(JSON.stringify(input), before);
});
test('runtime and surface changes require only proofs bound to the changed prerequisite', () => {
  const result = evaluatePrerequisites({current: {...current, surface: 'surface-next'},
    required: [requirement('auth', ['identityRole']), requirement('mobile', ['surface']), requirement('runtime', ['runtime'])],
    proofs: [proof('auth'), proof('mobile'), proof('runtime')]});
  assert.deepEqual(result.requirements.map(r => r.decision), ['REUSE', 'CHECK_REQUIRED', 'REUSE']);
  assert.deepEqual(codes(result), ['CONTEXT_CHANGED']);
});
test('every declared context revision must match exactly; missing and placeholder IDs are unknown', () => {
  for (const key of Object.keys(current)) {
    const changed = evaluatePrerequisites({current: {...current, [key]: current[key] + '-next'}, required: [requirement('flow')], proofs: [proof('flow')]});
    assert.equal(changed.requirements[0].code, 'CONTEXT_CHANGED');
    for (const invalid of [undefined, null, true, '', ' ', 'unknown', 'runtime revision', {revision: 'r1'}]) {
      const result = evaluatePrerequisites({current: {...current, [key]: invalid}, required: [requirement('flow')], proofs: [proof('flow')]});
      assert.equal(result.requirements[0].code, 'CONTEXT_UNKNOWN');
    }
  }
  assert.equal(evaluatePrerequisites({required: [requirement('flow')], proofs: [proof('flow')]}).requirements[0].code, 'CONTEXT_UNKNOWN');
});
test('verified status and a nonempty reference are both mandatory', () => {
  for (const reference of [true, false, 1, null, '', ' ', 'true', '../evidence.json', 'docs/evidence/../secret.json',
    'https://example.invalid/evidence', 'https://github.com/a/b/commit/' + 'a'.repeat(40) + '?token=fixture']) {
    const result = evaluatePrerequisites({current, required: [requirement('flow')], proofs: [proof('flow', {evidenceRef: reference})]});
    assert.equal(result.requirements[0].code, 'PROOF_REFERENCE_INVALID');
  }
  for (const status of ['unknown', 'pending', true, 'PASS', 'VERIFIED', undefined]) {
    assert.equal(evaluatePrerequisites({current, required: [requirement('flow')], proofs: [proof('flow', {status})]}).requirements[0].decision, 'CHECK_REQUIRED');
  }
  for (const evidenceRef of ['proof:receipt-01', 'docs/evidence/project/README.md', 'https://github.com/example/project/commit/' + 'a'.repeat(40)]) {
    assert.equal(evaluatePrerequisites({current, required: [requirement('flow')], proofs: [proof('flow', {evidenceRef})]}).requirements[0].decision, 'REUSE');
  }
});
test('an explicit proof failure blocks only that requirement and never requests credentials or authority', () => {
  const sentinel = 'SYNTHETIC_PRIVATE_CANARY_456';
  for (const override of [{status: 'error'}, {status: 'blocked'}, {status: 'failed'}, {error: sentinel}]) {
    const result = evaluatePrerequisites({current, required: [requirement('blocked'), requirement('accepted')], proofs: [proof('blocked', override), proof('accepted')]});
    assert.deepEqual(result.requirements.map(r => r.decision), ['BLOCKED', 'REUSE']);
    assert(!JSON.stringify(result).includes(sentinel));
    assert(!JSON.stringify(result).includes('password'));
    assert.equal(result.wholeClosureGranted, false);
  }
});
test('missing and ambiguous proof, invalid definitions and hostile accessors fail closed without IO', () => {
  assert.equal(evaluatePrerequisites({current, required: [requirement('flow')], proofs: []}).requirements[0].code, 'PROOF_MISSING');
  assert.equal(evaluatePrerequisites({current, required: [requirement('flow')], proofs: [proof('flow'), proof('flow')]}).requirements[0].decision, 'BLOCKED');
  for (const definition of [{id: true}, requirement('flow', []), {id: 'flow', contextKeys: null}, requirement('flow', ['secret']), requirement('flow', ['runtime', 'runtime'])]) {
    assert.equal(evaluatePrerequisites({current, required: [definition], proofs: [proof('flow')]}).requirements[0].code, 'PREREQUISITE_INVALID');
  }
  let calls = 0;
  const hostile = Object.defineProperty({}, 'identityRole', {enumerable: true, get() { calls++; throw Error('fixture'); }});
  const result = evaluatePrerequisites({current: hostile, required: [requirement('flow')], proofs: [proof('flow')]});
  assert.equal(result.requirements[0].code, 'CONTEXT_UNKNOWN');
  assert.equal(calls, 0);
  assert.equal(evaluatePrerequisites({current, required: Array(1), proofs: []}).requirements[0].code, 'PREREQUISITE_INVALID');
  assert.equal(evaluatePrerequisites({current, required: [requirement('flow'), requirement('flow')], proofs: [proof('flow')]}).requirements.length, 2);
});
test('a current main-ID cell cannot select two main headings or a zero ID', () => {
  for (const id of ['CRM06 / ERP09', 'ERP00', 'CRM00', 'ERP99', 'DATA99']) {
    assert(codes(checkProjects({erpMarkdown: table({'Ana ID': id}), crmMarkdown: bullet()})).includes('PROJECT_MAIN_INVALID'));
  }
});
test('the fixed 55-ID vocabulary permits subsequent terminal, data, education and release headings', () => {
  for (const id of ['TER01', 'DATA01', 'EDU01', 'REL01']) {
    const markdown = table({'Ana ID': id});
    const result = checkProjects({erpMarkdown: markdown, crmMarkdown: markdown});
    assert.deepEqual(result.mainIds, {ERP: id, CRM: id});
    assert(!result.issues.some(entry => entry.kind === 'inconsistency'));
  }
});
test('only fingerprints expose related context/reference changes to deduplication', () => {
  const evaluate = (context = current, accepted = proof('flow')) => evaluatePrerequisites({
    current: context, required: [requirement('flow', ['runtime'])], proofs: [accepted],
  }).requirements[0];
  const first = evaluate({...current, runtime: 'runtime-next-1'});
  const second = evaluate({...current, runtime: 'runtime-next-2'});
  assert.equal(first.code, second.code);
  assert.notEqual(first.fingerprint, second.fingerprint);
  assert.equal(first.fingerprint, evaluate({...current, runtime: 'runtime-next-1', surface: 'unrelated-surface'}).fingerprint);
  assert.notEqual(evaluate().fingerprint, evaluate(current, proof('flow', {evidenceRef: 'proof:accepted-02'})).fingerprint);
  assert.notEqual(evaluate().fingerprint, evaluate(current, proof('flow', {context: {...current, runtime: 'proof-runtime-next'}})).fingerprint);
  const serialized = JSON.stringify({first, second});
  assert(!serialized.includes('runtime-next-1'));
  assert(!serialized.includes('runtime-next-2'));
  assert(!serialized.includes('accepted-01'));
  assert.match(first.fingerprint, /^[a-f0-9]{64}$/);
});
test('opaque input IDs are used only for matching and never echoed into output', () => {
  const sentinel = 'SYNTHETIC_PRIVATE_REQUIREMENT_CANARY_789';
  const result = evaluatePrerequisites({current, required: [requirement(sentinel)], proofs: [proof(sentinel)]});
  assert.equal(result.requirements[0].decision, 'REUSE');
  assert.equal(result.requirements[0].id, 'required[0]');
  assert(!JSON.stringify(result).includes(sentinel));
  const checked = checkProjects({erpMarkdown: table({}, {current, required: [requirement(sentinel)], proofs: [proof(sentinel)]}), crmMarkdown: bullet()});
  assert(!JSON.stringify(checked).includes(sentinel));
});
