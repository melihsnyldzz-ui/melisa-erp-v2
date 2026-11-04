// Fixed local C06 test observation. It never grants package/install authority.
// Working-tree byte stability and transitive runtime inputs are NOT established.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
const repo = String.raw`C:\Sirket\ERP\worktrees\erp-p03-pr53-candidate-20261018`;
const nodeExe = String.raw`C:\Sirket\ERP\tools\node-v24.19.0\node.exe`;
const nodeSha256 = '3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237';
const guard = path.join(repo,'scripts','ci','offline-guard.cjs');
const tests = Object.freeze([
  'workBusinessSalesRead.test.mjs','workCustomerMaster.test.mjs',
  'workPurchasesRecovery.test.mjs','workCollectionsUnknownRecovery.test.mjs',
  'workCollectionsSelectedSource.test.mjs','workBusinessReceivingRead.test.mjs',
  'workCatalog.test.mjs',
].map(n=>path.join(repo,'apps','sites-workflow','src','workflow',n)));
const digest = b => crypto.createHash('sha256').update(b).digest('hex');
// Conservative literal-reference upper set from the seven test roots. These
// files are read/validated as source; this does not execute SQL or prove that
// dynamic paths, third-party packages or all runtime inputs were discovered.
const canonicalInputs=Object.freeze([
 'shared-business-collection-history-bootstrap.mjs','shared-business-collection-history-sql.mjs',
 'shared-business-daily-profit-revision.mjs','shared-business-daily-revision-sql.mjs',
 'shared-business-operation-quarantine-parent-revision-sql.mjs','shared-business-operation-quarantine-revision.mjs',
 'shared-business-product-price-bootstrap.mjs','shared-business-product-price-revision-contract.mjs',
 'shared-business-product-price-revision-sql.mjs','shared-business-product-price-sale-bootstrap.mjs',
 'shared-business-product-price-sale-sql.mjs','shared-business-selected-collection-revision-bootstrap.mjs',
 'shared-business-selected-collection-revision-sql.mjs','shared-business-selected-sale-effects-revision-sql.mjs',
 'shared-business-selected-sale-parent-revision-sql.mjs','shared-business-selected-sale-preview-sql.mjs',
 'shared-business-selected-sale-revision-bootstrap.mjs','shared-business-selected-sale-revision-contract.mjs',
 'shared-business-selected-sale-revision-sql.mjs','shared-business-selected-sale-write-scope-sql.mjs',
 'shared-business-stock-predicate-distinct-revision-sql.mjs','shared-business-stock-predicate-distinct-source.mjs',
 'shared-business-supplier-item-quarantine-parent-revision-sql.mjs','shared-business-supplier-item-quarantine-revision.mjs',
 'shared-test-copy-revision-sql.mjs','shared-test-copy-sql.mjs','stage4-copy-context-sql.mjs','stage4-copy-sql.mjs',
].map(n=>path.join(repo,'scripts','canonical',n)));
export function localC06InputPaths() { return [guard,...tests,...canonicalInputs]; }
// 7ab adds these test roots. Merely enumerating them is not a test run, a
// complete transitive-input proof, or an installation capability.
const added7abTests=Object.freeze([
 'apps/api/src/config/canonicalReadonlyAuthQuery.test.mjs',
 'apps/api/src/config/canonicalReadonlyExistingPool.test.mjs',
 'apps/api/src/services/c06SaleReadonlyMetadata.test.mjs',
 'apps/api/src/routes/c06SaleReadonlyMetadataRoutes.test.mjs',
 'apps/api/src/routes/c06SaleReadonlyMetadataAuthIntegration.test.mjs',
 'apps/sites-workflow/src/workflow/workSupplierCardSwitch.test.mjs',
].map(p=>path.join(repo,...p.split('/'))));
export function localC06InputPaths7ab() { return [...localC06InputPaths(),...added7abTests]; }

// Strict TAP summary: summaries must be singular, consistent, and complete.
export function parseC06Tap(text) {
  if (typeof text !== 'string' || !/^TAP version 13\r?\n/.test(text)) throw Error('C06_LOCAL_TAP_HEADER_'+(typeof text!=='string'?'TYPE':text.length===0?'EMPTY':text.startsWith('TAP')?'TAP':'OTHER'));
  const number = name => {
    const values = [...text.matchAll(new RegExp('^# '+name+' (\\d+)\\r?$','gm'))];
    if (values.length !== 1) throw Error('C06_LOCAL_TAP_SUMMARY');
    return Number(values[0][1]);
  };
  const count=number('tests'),passed=number('pass'),failed=number('fail'),cancelled=number('cancelled'),skipped=number('skipped'),todo=number('todo');
  if (!Number.isSafeInteger(count) || count<1 || count!==passed+failed+cancelled+skipped+todo || failed || cancelled || skipped || todo) throw Error('C06_LOCAL_TAP_RESULT');
  const plans=[...text.matchAll(/^1\.\.(\d+)\r?$/gm)],ok=[...text.matchAll(/^ok (\d+)(?:\s|$)/gm)];
  if (plans.length!==1 || Number(plans[0][1])!==count || ok.length!==count || ok.some((m,i)=>Number(m[1])!==i+1) || /^not ok\s/m.test(text)) throw Error('C06_LOCAL_TAP_PLAN');
  return {count,passed,failed,cancelled,skipped,todo};
}

// This returns an observation, not a PASS token. An unchanged working tree is
// not an immutable snapshot, and hashing the top-level tests omits dependencies.
export function observeC06LocalTests() {
  if (process.platform !== 'win32' || digest(fs.readFileSync(nodeExe)) !== nodeSha256) throw Error('C06_LOCAL_NODE');
  const inputs=localC06InputPaths().map(file=>({file,sha256:digest(fs.readFileSync(file))}));
  const env=Object.fromEntries(Object.entries(process.env).filter(([name])=>/^(SYSTEMROOT|WINDIR|TEMP|TMP|USERPROFILE|PATH|LANG|LC_ALL)$/i.test(name)));
  // Node's test harness sets this in worker processes; do not make the nested
  // runner emit the worker protocol instead of the requested TAP reporter.
  env.NODE_TEST_CONTEXT=undefined;
  const result=spawnSync(nodeExe,['--require',guard,'--test','--test-reporter=tap',...tests],{cwd:repo,env,encoding:'utf8',windowsHide:true,timeout:120000,maxBuffer:8*1024*1024});
  if (result.error || result.status!==0 || result.signal) throw Error('C06_LOCAL_EXECUTION');
  const summary=parseC06Tap(result.stdout);
  if (summary.count!==176) throw Error('C06_LOCAL_TEST_COUNT');
  const after=localC06InputPaths().map(file=>({file,sha256:digest(fs.readFileSync(file))}));
  if (JSON.stringify(inputs)!==JSON.stringify(after)) throw Error('C06_LOCAL_INPUT_DRIFT');
  return {schema:'c06-local-observation.v1',nodeSha256,inputs,summary,stdoutSha256:digest(Buffer.from(result.stdout)),stderrSha256:digest(Buffer.from(result.stderr)),coverage:'UNVERIFIED',sourceImmutability:'UNVERIFIED',testRunObserved:true,testRunVerified:false,executionAuthority:false};
}
