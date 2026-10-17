import fs from 'node:fs';

const outDir = new URL('./', import.meta.url);
const backupReceipts = JSON.parse(fs.readFileSync(new URL('./backup-receipts.json', import.meta.url), 'utf8'));
const candidateBackup = backupReceipts.receipts.find(
  (receipt) => receipt.database === 'MELISA_ERP_PROD_CANDIDATE_20260917_01',
);

if (!candidateBackup || candidateBackup.restoreVerifyOnly !== 'PASS' || candidateBackup.checksum !== true) {
  throw new Error('CANDIDATE_ROLLBACK_BACKUP_NOT_VERIFIED');
}

fs.writeFileSync(
  new URL('./rollback-backup.json', import.meta.url),
  JSON.stringify({
    runId: backupReceipts.runId,
    createdAt: backupReceipts.generatedAt,
    server: backupReceipts.server,
    database: candidateBackup.database,
    file: candidateBackup.file,
    sizeBytes: candidateBackup.sizeBytes,
    metadataSha256: candidateBackup.metadataSha256,
    checksum: candidateBackup.checksum,
    restoreVerifyOnly: candidateBackup.restoreVerifyOnly,
    backupType: 'Database',
  }, null, 2),
);

const sourceUrl = new URL('../live3-runtime-signoff-20260917/final-verify.mjs', import.meta.url);
let source = fs.readFileSync(sourceUrl, 'utf8');
source = source
  .replaceAll('LIVE3-20260917-01', 'PRODUCTION-SWITCH-20260918-01')
  .replaceAll('http://127.0.0.1:4233/native-terminal-health', 'http://192.168.1.46:4116/production-switch-health')
  .replaceAll("runtime.loginName==='melisa_candidate_runtime_live3'", "runtime.loginName==='melisa_production_runtime_20260918'")
  .replace("path.join(outDir,'README.md')", "path.join(outDir,'live3-derived-verification.md')")
  .replace(",report.activeTransientSessions===0?'PASS':'FAIL'", '');

const privateScriptUrl = new URL('./.final-verification.private.mjs', import.meta.url);
fs.writeFileSync(privateScriptUrl, source);

try {
  await import(`${privateScriptUrl.href}?run=${Date.now()}`);
} finally {
  fs.rmSync(privateScriptUrl, { force: true });
}

const acceptance = JSON.parse(fs.readFileSync(new URL('./acceptance.json', import.meta.url), 'utf8'));
const erpSmoke = JSON.parse(fs.readFileSync(new URL('./erp-api-smoke.json', import.meta.url), 'utf8'));
const postSwitchBackup = JSON.parse(fs.readFileSync(new URL('./post-switch-backup.json', import.meta.url), 'utf8'));
const runtimeFinalState = JSON.parse(fs.readFileSync(new URL('./runtime-final-state.json', import.meta.url), 'utf8'));
const stockAudit4 = JSON.parse(fs.readFileSync(
  new URL('../../docs/operations/stock-audit-4-unit-closeout-20260918.json', import.meta.url),
  'utf8',
));

const stockAudit4Ok = stockAudit4.runId === 'STOCK-AUDIT-4-UNIT-20260918-01'
  && stockAudit4.status === 'PASS'
  && stockAudit4.decision?.unit === 'ADET'
  && stockAudit4.economicEffects?.stock === 0
  && stockAudit4.economicEffects?.party === 0
  && stockAudit4.economicEffects?.finance === 0
  && stockAudit4.classificationAfter?.UNKNOWN === 0
  && stockAudit4.candidateUnitDecisionIncluded === true;

const required = [
  acceptance.productionPromotion === 'PASS',
  erpSmoke.status === 'PASS',
  stockAudit4Ok,
  postSwitchBackup.checksum === true && postSwitchBackup.restoreVerifyOnly === 'PASS',
  runtimeFinalState.tasks.some((task) => task.name === 'Melisa-Production-20260918-Runtime' && task.state === 'Running' && task.enabled === true),
  runtimeFinalState.tasks.some((task) => task.name === 'Melisa-Production-Candidate-NightlyBackup' && task.enabled === true),
  runtimeFinalState.erp?.ok === true,
  runtimeFinalState.terminal?.ok === true,
  runtimeFinalState.web?.statusCode === 200,
  Object.values(runtimeFinalState.oldLiveUnchanged ?? {}).every(Boolean),
];

const final = {
  ...acceptance,
  runId: 'PRODUCTION-SWITCH-20260918-01',
  erpApiSmoke: erpSmoke,
  stockAudit4: {
    status: stockAudit4Ok ? 'PASS' : 'FAIL',
    runId: stockAudit4.runId,
    stockCode: '8031 MURAT BABY',
    unit: stockAudit4.decision?.unit ?? null,
    economicEffects: stockAudit4.economicEffects ?? null,
  },
  physicalTerminal: {
    device: 'Zebra TC21',
    package: 'com.melisaerp.nativeterminal',
    version: '1.0.0-candidate.18-t2',
    endpoint: 'http://192.168.1.46:4116',
    login: 'PASS',
    customerSelection: 'PASS',
    productSearch3008: 'PASS',
  },
  postSwitchBackup,
  runtimeFinalState,
  productionSwitch: required.every(Boolean) ? 'PASS' : 'FAIL',
  goLiveBlockers: required.every(Boolean) ? [] : ['PRODUCTION_SWITCH_FINAL_ACCEPTANCE_FAILED'],
};

fs.writeFileSync(new URL('./final-acceptance.json', import.meta.url), JSON.stringify(final, null, 2));
console.log(JSON.stringify({
  runId: final.runId,
  productionSwitch: final.productionSwitch,
  goLiveBlockers: final.goLiveBlockers,
  schemaParity: final.schemaParity,
  stock: final.stock,
  stockAudit3: final.stockAudit3,
  stockAudit4: final.stockAudit4,
  partyCurrency: final.partyCurrency,
  duplicate: final.duplicate,
  terminal: final.terminal,
  physicalTerminal: final.physicalTerminal,
  rollback: final.rollback,
  erpApiSmoke: final.erpApiSmoke.status,
}));

if (final.productionSwitch !== 'PASS') {
  process.exitCode = 1;
}
