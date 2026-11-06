// Fixed local C06 test observation. It never grants package/install authority.
// Working-tree byte stability and transitive runtime inputs are NOT established.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
const repo = String.raw`C:\Sirket\ERP\worktrees\erp-p03-pr53-candidate-20261018`;
const isolatedRepo = String.raw`C:\Sirket\ERP\worktrees\erp-c06-targeted-0ffa-20261104`;
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
// Selected runtime and lock inputs supplement the fixed test roots. This is
// not a complete transitive dependency or immutable node_modules proof.
const added7abRuntimeInputs=Object.freeze([
 'scripts/canonical/local-c06-test-runner.mjs',
 'apps/api/package.json','apps/api/package-lock.json',
 'apps/sites-workflow/package.json','apps/sites-workflow/package-lock.json',
 'apps/api/src/config/database.js','apps/api/src/config/canonicalReadonlyAuthQuery.mjs',
 'apps/api/src/services/authService.js','apps/api/src/middleware/authMiddleware.js',
 'apps/api/src/services/c06SaleReadonlyMetadata.mjs','apps/api/src/routes/c06SaleReadonlyMetadataRoutes.mjs',
 'apps/sites-workflow/src/workflow/workSuppliers.js',
].map(p=>path.join(repo,...p.split('/'))));
export function localC06ObservedInputs7ab() { return [...localC06InputPaths7ab(),...added7abRuntimeInputs]; }

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

// The added files contain nested node:test subtests: the top-level plan is
// therefore smaller than the summary's total test count. Check every nested
// plan and numbered result rather than treating the top-level plan as total.
export function parseC06Added7abTap(text) {
  if(typeof text!=='string'||!/^TAP version 13\r?\n/.test(text))throw Error('C06_7AB_TAP_HEADER');
  const number=name=>{const values=[...text.matchAll(new RegExp('^# '+name+' (\\d+)\\r?$','gm'))];if(values.length!==1)throw Error('C06_7AB_TAP_SUMMARY');return Number(values[0][1]);};
  const count=number('tests'),suites=number('suites'),passed=number('pass'),failed=number('fail'),cancelled=number('cancelled'),skipped=number('skipped'),todo=number('todo');
  if(!Number.isSafeInteger(count)||count<1||suites!==0||count!==passed||failed||cancelled||skipped||todo)throw Error('C06_7AB_TAP_RESULT');
  const groups=new Map([[0,{count:0,done:false,pending:null}]]);let total=0,headers=0;
  for(const line of text.split(/\r?\n/)){
    if(!/^(?:TAP version 13|\s*|\s*#.*|\s*---\s*|\s*\.\.\.\s*|\s*duration_ms:\s*[0-9.]+\s*|\s*type:\s*['"]test['"]\s*| *ok \d+(?:\s.*)?| *not ok \d+(?:\s.*)?| *1\.\.\d+\s*)$/.test(line))throw Error('C06_7AB_TAP_FORMAT');
    if(line==='TAP version 13'&&++headers!==1)throw Error('C06_7AB_TAP_HEADER');
    if(/^\s*not ok\b/.test(line)||/^\s*ok\s+\d+[^\r\n]*#\s*(?:SKIP|TODO)\b/i.test(line))throw Error('C06_7AB_TAP_RESULT');
    const opened=/^( *)# Subtest: (.*)$/.exec(line),result=/^( *)ok (\d+) - (.*)$/.exec(line),plan=/^( *)1\.\.(\d+)\s*$/.exec(line);
    if(/^ *ok\b/.test(line)&&!result)throw Error('C06_7AB_TAP_FORMAT');
    if(opened){const depth=opened[1].length;if(depth%4)throw Error('C06_7AB_TAP_PLAN');let g=groups.get(depth);
      if(!g){const parent=groups.get(depth-4);if(!parent||parent.done||parent.pending===null)throw Error('C06_7AB_TAP_PLAN');g={count:0,done:false,pending:null};groups.set(depth,g);}
      if(g.done||g.pending!==null)throw Error('C06_7AB_TAP_PLAN');g.pending=opened[2];}
    if(result){const depth=result[1].length,g=groups.get(depth),child=groups.get(depth+4);
      if(depth%4||!g||g.done||g.pending===null||g.pending!==result[3]||Number(result[2])!==g.count+1||(child&&!child.done))throw Error('C06_7AB_TAP_PLAN');
      if(child)groups.delete(depth+4);g.pending=null;g.count++;total++;}
    if(plan){const depth=plan[1].length,g=groups.get(depth);if(depth%4||!g||g.done||g.pending!==null||groups.has(depth+4)||g.count!==Number(plan[2]))throw Error('C06_7AB_TAP_PLAN');g.done=true;}
  }
  if(total!==count||groups.size!==1||!groups.get(0).done)throw Error('C06_7AB_TAP_PLAN');
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

// This observes only the six added 7ab test roots. It neither reruns nor
// claims the historical 176 tests and does not authorize package execution.
function observeAdded7abAtFixedRoot(root,scope) {
  if(process.platform!=='win32'||digest(fs.readFileSync(nodeExe))!==nodeSha256)throw Error('C06_LOCAL_NODE');
  if(!((root===repo&&scope==='PRODUCER')||(root===isolatedRepo&&scope==='ISOLATED')))throw Error('C06_7AB_ROOT');
  const remap=file=>{const relative=path.relative(repo,file);if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw Error('C06_7AB_INPUT_PATH');return path.join(root,relative);};
  const files=localC06ObservedInputs7ab().map(remap),runTests=added7abTests.map(remap),runGuard=remap(guard);
  if(files.length!==54||new Set(files).size!==files.length||runTests.length!==6)throw Error('C06_7AB_INPUT_SET');
  const inputs=files.map(file=>({file,sha256:digest(fs.readFileSync(file))}));
  const env=Object.fromEntries(Object.entries(process.env).filter(([name])=>/^(SYSTEMROOT|WINDIR|TEMP|TMP|USERPROFILE|PATH|LANG|LC_ALL)$/i.test(name)));
  env.NODE_TEST_CONTEXT=undefined;
  const result=spawnSync(nodeExe,['--require',runGuard,'--experimental-test-module-mocks','--test','--test-reporter=tap',...runTests],{cwd:root,env,encoding:'utf8',windowsHide:true,timeout:120000,maxBuffer:8*1024*1024});
  if(result.error||result.status!==0||result.signal)throw Error('C06_7AB_LOCAL_EXECUTION');
  const summary=parseC06Added7abTap(result.stdout);if(summary.count!==55)throw Error('C06_7AB_LOCAL_TEST_COUNT');
  const after=files.map(file=>({file,sha256:digest(fs.readFileSync(file))}));if(JSON.stringify(inputs)!==JSON.stringify(after))throw Error('C06_LOCAL_INPUT_DRIFT');
  if(digest(fs.readFileSync(nodeExe))!==nodeSha256)throw Error('C06_LOCAL_NODE_DRIFT');
  return {schema:'c06-7ab-added-local-observation.v1',scope,nodeSha256,inputs,executedTests:[...runTests],inputCoverage:'SELECTED_INPUTS_ONLY',summary,stdoutSha256:digest(Buffer.from(result.stdout)),stderrSha256:digest(Buffer.from(result.stderr)),historical176:'NOT_RUN',coverage:'UNVERIFIED',sourceImmutability:'UNVERIFIED',testRunObserved:true,testRunVerified:false,executionAuthority:false};
}
export function observeC06Added7abTests() { return observeAdded7abAtFixedRoot(repo,'PRODUCER'); }
// Exact, separate local fixture checkout; never used by the producer.
export function observeC06Added7abTestsIsolated() { return observeAdded7abAtFixedRoot(isolatedRepo,'ISOLATED'); }
