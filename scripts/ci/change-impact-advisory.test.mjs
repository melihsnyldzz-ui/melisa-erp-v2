import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,realpathSync,readFileSync,chmodSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {classifyCiImpact,classifyWindowsImpact,hasFullBaseEvidence,inspectCiImpact,inspectGithubImpact} from './change-impact-advisory.mjs';
import {validateCustomerMetadataCI} from '../canonical/prepare-customer-master-metadata-package.mjs';
const base='a'.repeat(40),head='b'.repeat(40),zero='0'.repeat(40),old='c'.repeat(40),next='d'.repeat(40);
const row=(p,{status='M',oldMode='100644',newMode='100644',oldOid=old,newOid=next,other}={})=>Buffer.from(`:${oldMode} ${newMode} ${oldOid} ${newOid} ${status}\0${p}\0${other===undefined?'':other+'\0'}`);
function evidence(commit=base){const entry=(event,id)=>({event,id,head_sha:commit,path:'.github/workflows/ci.yml',run_attempt:1,status:'completed',conclusion:'success',fullScopeEvidence:{schema:'melisa-ci-full-run-attestation.v1',scope:'FULL',event,head_sha:commit,run_id:id,run_attempt:1,allAssertionsExecuted:true},jobs:['change-impact','windows-startup-test','quality-build-test','secret-scan'].map(name=>({name,status:'completed',conclusion:'success',steps:[{status:'completed',conclusion:'success'}]}))});return {push:entry('push',1),pull_request:entry('pull_request',2)};}
const input=(p='docs/evidence/erp/2026-11-04/receipt.md')=>({base,head,checkedOutHead:head,ancestryVerified:true,rawDiff:row(p),fullBaseEvidence:evidence()});
function safety(value){assert.equal(value.scannerRequired,true);assert.equal(value.buildRequired,true);assert.equal(value.exactHeadFullPushAndPrRequired,true);assert.equal(value.producerAdmission,false);assert.equal(value.installationAdmission,false);}
test('only regular added/modified evidence Markdown with trusted full base facts qualifies for advisory scope',()=>{
 for(const rawDiff of [row('docs/evidence/erp/2026-11-04/receipt.md'),row('docs/evidence/erp/2026-11-04/new.md',{status:'A',oldMode:'000000',oldOid:zero})]){const r=classifyCiImpact({...input(),rawDiff});assert.equal(r.scope,'DOCS_ONLY');safety(r);}
});
test('scanner/build and producer exact-head full gates persist for both classifications',()=>{for(const x of [input(),{...input(),rawDiff:row('apps/api/src/a.js')}])safety(classifyCiImpact(x));});
test('advisory Windows impact never asserts an untested job or grants producer authority',()=>{
 for(const event of ['push','pull_request']){
  const args={...input(),eventVerified:true};
  assert.equal(classifyWindowsImpact(args).scope,'DOCS_ONLY',event);
  assert.equal(classifyWindowsImpact({...args,fullRequested:true}).scope,'FULL',event);
  assert.equal(classifyWindowsImpact({...args,eventVerified:false}).scope,'FULL',event);
  assert.equal(classifyWindowsImpact({...args,rawDiff:row('apps/api/src/a.js')}).scope,'FULL',event);
  safety(classifyWindowsImpact(args));
 }
});
test('real producer rejects skipped Windows on either event and accepts only complete exact-head jobs',()=>{
 const pr={state:'open',head:{sha:base,ref:'codex/erp-p03-pr53-candidate-20261018'},base:{ref:'codex/erp-p03-integrated-candidate-20261017'}};
 const ev=evidence();const runs=[ev.push,ev.pull_request];const jobs=new Map(runs.map(r=>[r.id,structuredClone(r.jobs)]));
 assert.equal(validateCustomerMetadataCI(base,pr,runs,jobs).length,2);
 for(const event of ['push','pull_request']){const candidate=new Map([...jobs].map(([id,arr])=>[id,structuredClone(arr)]));candidate.get(ev[event].id).find(j=>j.name==='windows-startup-test').conclusion='skipped';assert.throws(()=>validateCustomerMetadataCI(base,pr,runs,candidate),/CI_STEPS/,event);}
 for(const event of ['push','pull_request']){const candidate=new Map([...jobs].map(([id,arr])=>[id,structuredClone(arr)]));candidate.get(ev[event].id).find(j=>j.name==='change-impact').conclusion='failure';assert.throws(()=>validateCustomerMetadataCI(base,pr,runs,candidate),/CI_STEPS/,event);}
 for(const event of ['push','pull_request']){const candidate=new Map([...jobs].map(([id,arr])=>[id,structuredClone(arr)]));candidate.set(ev[event].id,candidate.get(ev[event].id).filter(j=>j.name!=='change-impact'));assert.throws(()=>validateCustomerMetadataCI(base,pr,runs,candidate),/CI_JOBS/,event);}
 for(const event of ['push','pull_request']){const candidate=new Map([...jobs].map(([id,arr])=>[id,structuredClone(arr)]));candidate.get(ev[event].id).push({name:'impact',status:'completed',conclusion:'success',steps:[{status:'completed',conclusion:'success'}]});assert.throws(()=>validateCustomerMetadataCI(base,pr,runs,candidate),/CI_JOBS/,event);}
});
test('missing/wrong base, checkout mismatch, non-ancestor, empty/invalid diff always require full',()=>{
 for(const patch of [{base:null},{base:zero},{head:null},{checkedOutHead:'e'.repeat(40)},{base:head},{ancestryVerified:false},{rawDiff:Buffer.alloc(0)},{rawDiff:Buffer.from('malformed')},{rawDiff:Buffer.from([255,0])}])assert.equal(classifyCiImpact({...input(),...patch}).scope,'FULL');
});
test('evidence needs BOTH exact-base full push and PR with 4 successful jobs and no skipped steps',()=>{
 const good=evidence();assert(hasFullBaseEvidence(base,good));
 for(const mutate of [e=>delete e.push,e=>delete e.pull_request,e=>e.push.head_sha=head,e=>e.push.event='workflow_dispatch',e=>e.pull_request.run_attempt=2,e=>e.push.fullScopeEvidence.scope='DOCS_ONLY',e=>e.pull_request.fullScopeEvidence.scope='DOCS_ONLY',e=>e.push.fullScopeEvidence.run_id=8,e=>e.pull_request.fullScopeEvidence.event='push',e=>e.push.fullScopeEvidence.allAssertionsExecuted=false,e=>delete e.push.fullScopeEvidence,e=>delete e.pull_request.fullScopeEvidence,e=>e.push.jobs.pop(),e=>e.pull_request.jobs[0].steps[0].conclusion='skipped',e=>e.push.jobs[0].conclusion='failure',e=>e.pull_request.id=e.push.id]){const bad=structuredClone(good);mutate(bad);assert.equal(hasFullBaseEvidence(base,bad),false);assert.equal(classifyCiImpact({...input(),fullBaseEvidence:bad}).scope,'FULL');}
 assert.equal(classifyCiImpact({...input(),fullBaseEvidence:null}).scope,'FULL');
});
test('rename/copy/delete, unsafe case, symlink, executable, submodule and other sources require full',()=>{
 const pathCases=['docs/evidence/erp/AGENTS.md','docs/evidence/erp/2026/agents.md','docs/evidence/erp/../x.md','docs/evidence/erp/2026//x.md','docs/evidence/erp/2026/x.MD','docs/evidence/erp/2026/x.md\n','docs/evidence/other/x.md','docs/erp-v2/README.md','STATUS.md','.github/workflows/ci.yml','scripts/ci/run.mjs','apps/api/src/a.js','scripts/canonical/a.sql','packages/common/a.js'];
 for(const p of pathCases)assert.equal(classifyCiImpact({...input(),rawDiff:row(p)}).scope,'FULL',p);
 for(const patch of [{status:'D'},{status:'R100',other:'docs/evidence/erp/new.md'},{status:'C100',other:'docs/evidence/erp/new.md'},{status:'T'},{newMode:'120000'},{newMode:'100755'},{newMode:'160000'},{oldMode:'120000'},{oldOid:zero},{newOid:zero}])assert.equal(classifyCiImpact({...input(),rawDiff:row('docs/evidence/erp/2026/x.md',patch)}).scope,'FULL',JSON.stringify(patch));
 assert.equal(classifyCiImpact({...input(),rawDiff:Buffer.concat([row('docs/evidence/erp/2026/a.md'),row('docs/evidence/erp/2026/A.md')])}).scope,'FULL');
});
test('real disposable Git diff uses exact checked-out head and fails closed on missing or reverse base',()=>{
 const parent=realpathSync.native(os.tmpdir()),root=realpathSync.native(mkdtempSync(path.join(parent,'erp-ci-impact-fixture-'))),git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true}).trim();
 try{
  git('init','-q');git('config','user.name','Synthetic CI');git('config','user.email','fixture@example.invalid');mkdirSync(path.join(root,'docs','evidence','erp','sample'),{recursive:true});writeFileSync(path.join(root,'docs','evidence','erp','sample','proof.md'),'one\n');git('add','.');git('commit','-qm','base');const first=git('rev-parse','HEAD');
  writeFileSync(path.join(root,'docs','evidence','erp','sample','proof.md'),'two\n');git('add','.');git('commit','-qm','docs');const second=git('rev-parse','HEAD');
  assert.equal(inspectCiImpact({cwd:root,base:first,head:second,fullBaseEvidence:evidence(first)}).scope,'DOCS_ONLY');assert.equal(inspectCiImpact({cwd:root,base:first,head:second}).scope,'FULL');assert.equal(inspectCiImpact({cwd:root,base:'f'.repeat(40),head:second,fullBaseEvidence:evidence('f'.repeat(40))}).scope,'FULL');assert.equal(inspectCiImpact({cwd:root,base:second,head:first,fullBaseEvidence:evidence(second)}).scope,'FULL');
  writeFileSync(path.join(root,'STATUS.md'),'status\n');git('add','.');git('commit','-qm','release');const third=git('rev-parse','HEAD');assert.equal(inspectCiImpact({cwd:root,base:second,head:third,fullBaseEvidence:evidence(second)}).scope,'FULL');
  writeFileSync(path.join(root,'docs','evidence','erp','sample','proof.md'),'three\n');git('add','.');git('commit','-qm','docs with full request','-m','ERP-CI-FULL: required');const fourth=git('rev-parse','HEAD');
  for(const event of ['push','pull_request']){const result=inspectCiImpact({cwd:root,base:third,head:fourth,fullBaseEvidence:evidence(third)});assert.equal(result.scope,'FULL',event);assert.equal(result.reason,'FULL_EXPLICITLY_REQUESTED',event);safety(result);}
 }finally{assert.equal(path.dirname(realpathSync.native(root)),parent);assert.match(path.basename(root),/^erp-ci-impact-fixture-/);rmSync(root,{recursive:true});}
});
test('synthetic push and PR events validate actual commit tree, checkout, clean state and exact head full marker',()=>{
 const parent=realpathSync.native(os.tmpdir()),root=realpathSync.native(mkdtempSync(path.join(parent,'erp-ci-event-fixture-'))),git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true}).trim(),repo='melihsnyldzz-ui/melisa-erp-v2';
 try{
  git('init','-q');git('config','user.name','Synthetic CI');git('config','user.email','fixture@example.invalid');git('config','core.autocrlf','false');mkdirSync(path.join(root,'docs','evidence','erp'),{recursive:true});const file=path.join(root,'docs','evidence','erp','proof.md');writeFileSync(file,'one\n');git('add','.');git('commit','-qm','base');const first=git('rev-parse','HEAD'),initial=git('branch','--show-current');
  git('checkout','-qb','topic');writeFileSync(file,'two\n');git('add','.');git('commit','-qm','docs');const second=git('rev-parse','HEAD');
  const feature='codex/erp-p03-pr53-candidate-20261018',baseBranch='codex/erp-p03-integrated-candidate-20261017',pushRef='refs/heads/'+feature;
  const push={repository:{full_name:repo},ref:pushRef,before:first,after:second,deleted:false,forced:false};const common={cwd:root,githubRepository:repo};const inspect=(event,eventName,githubSha,githubRef=eventName==='push'?pushRef:'refs/pull/54/merge')=>inspectGithubImpact({...common,event,eventName,githubSha,githubRef});
  assert.equal(inspect(push,'push',second).scope,'DOCS_ONLY');
  assert.equal(inspectGithubImpact({...common,githubRepository:'other/repo',event:{...push,repository:{full_name:'other/repo'}},eventName:'push',githubSha:second,githubRef:pushRef}).scope,'FULL');
  for(const invalid of [{...push,before:zero},{...push,after:first},{...push,forced:true},{...push,deleted:true},{...push,ref:'refs/heads/main'},{...push,ref:undefined},{...push,repository:{full_name:'wrong/repo'}}])assert.equal(inspect(invalid,'push',second).scope,'FULL');
  assert.equal(inspect(push,'push',second,'refs/heads/main').scope,'FULL');
  assert.equal(inspect(push,'workflow_dispatch',second).scope,'FULL');assert.equal(inspect(push,'push',first).scope,'FULL');
  const eventPath=path.join(root,'.git','synthetic-event.json');writeFileSync(eventPath,JSON.stringify(push));const script=path.resolve('scripts/ci/change-impact-advisory.mjs');
  const cli=env=>execFileSync(process.execPath,[script,'--github-event'],{cwd:root,encoding:'utf8',env:{...process.env,...env},windowsHide:true}).trim();
  const githubEnv={GITHUB_EVENT_PATH:eventPath,GITHUB_EVENT_NAME:'push',GITHUB_SHA:second,GITHUB_REPOSITORY:repo,GITHUB_REF:pushRef};assert.equal(cli(githubEnv),'DOCS_ONLY');assert.equal(cli({...githubEnv,GITHUB_SHA:first}),'FULL');assert.equal(cli({...githubEnv,GITHUB_EVENT_PATH:path.join(root,'.git','missing')}),'FULL');
  writeFileSync(file,'dirty\n');assert.equal(inspect(push,'push',second).scope,'FULL');git('checkout','--','docs/evidence/erp/proof.md');
  git('checkout','-q',initial);git('merge','--no-ff','--no-edit','topic');const merge=git('rev-parse','HEAD');const pr={repository:{full_name:repo},number:54,action:'synchronize',pull_request:{base:{sha:first,ref:baseBranch,repo:{full_name:repo}},head:{sha:second,ref:feature,repo:{full_name:repo}}}};
  const prResult=inspect(pr,'pull_request',merge);assert.equal(prResult.scope,'DOCS_ONLY',JSON.stringify(prResult));
  for(const invalid of [{...pr,action:'closed'},{...pr,number:53},{...pr,pull_request:{...pr.pull_request,base:{...pr.pull_request.base,sha:second}}},{...pr,pull_request:{...pr.pull_request,base:{...pr.pull_request.base,ref:'main'}}},{...pr,pull_request:{...pr.pull_request,base:{...pr.pull_request.base,ref:undefined}}},{...pr,pull_request:{...pr.pull_request,head:{...pr.pull_request.head,sha:first}}},{...pr,pull_request:{...pr.pull_request,head:{...pr.pull_request.head,ref:'other'}}},{...pr,pull_request:{...pr.pull_request,head:{...pr.pull_request.head,repo:{full_name:'fork/other'}}}}])assert.equal(inspect(invalid,'pull_request',merge).scope,'FULL');
  assert.equal(inspect(pr,'pull_request',merge,'refs/pull/53/merge').scope,'FULL');
  git('checkout','-q','topic');writeFileSync(file,'three\n');git('add','.');git('commit','-qm','full request','-m','ERP-CI-FULL: required');const marker=git('rev-parse','HEAD');const markedPush={...push,before:second,after:marker};assert.equal(inspect(markedPush,'push',marker).reason,'FULL_EXPLICITLY_REQUESTED');
  git('checkout','--detach','-q',first);git('merge','--no-ff','--no-edit','topic');const markedMerge=git('rev-parse','HEAD');const markedPr={...pr,pull_request:{...pr.pull_request,head:{...pr.pull_request.head,sha:marker}}};assert.equal(inspect(markedPr,'pull_request',markedMerge).reason,'FULL_EXPLICITLY_REQUESTED');
  git('checkout','-q','topic');git('commit','-qm','empty','--allow-empty');const empty=git('rev-parse','HEAD');assert.equal(inspect({...push,before:marker,after:empty},'push',empty).scope,'FULL');
  git('mv','docs/evidence/erp/proof.md','docs/evidence/erp/renamed.md');git('commit','-qm','rename');const renamed=git('rev-parse','HEAD');assert.equal(inspect({...push,before:empty,after:renamed},'push',renamed).scope,'FULL');
  git('update-index','--chmod=+x','docs/evidence/erp/renamed.md');git('commit','-qm','mode');const executable=git('rev-parse','HEAD');assert.equal(inspect({...push,before:renamed,after:executable},'push',executable).scope,'FULL');
  mkdirSync(path.join(root,'apps','api'),{recursive:true});writeFileSync(path.join(root,'apps','api','source.mjs'),'// source\n');git('add','.');git('commit','-qm','source');const source=git('rev-parse','HEAD');assert.equal(inspect({...push,before:executable,after:source},'push',source).scope,'FULL');
  writeFileSync(eventPath,'{bad-json');assert.equal(cli({...githubEnv,GITHUB_SHA:source}),'FULL');
 }finally{assert.equal(path.dirname(realpathSync.native(root)),parent);assert.match(path.basename(root),/^erp-ci-event-fixture-/);rmSync(root,{recursive:true});}
});
test('actual workflow shell trusts only pinned classifier bytes from event base on push and PR',()=>{
 const parent=realpathSync.native(os.tmpdir()),root=realpathSync.native(mkdtempSync(path.join(parent,'erp-ci-trust-fixture-'))),git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true}).trim();
 const workflow=readFileSync(path.resolve('.github/workflows/ci.yml'),'utf8').replaceAll('\r\n','\n');
 const match=/      - name: Classify the exact GitHub event\n        id: impact\n        shell: bash\n        run: \|\n((?:          .+\n)+)/.exec(workflow);assert(match,'workflow classifier shell block missing');const shell=match[1].split('\n').filter(Boolean).map(line=>line.slice(10)).join('\n');
 const bash=process.platform==='win32'?path.join(process.env.ProgramFiles||'C:\\Program Files','Git','bin','bash.exe'):'bash';
 const shellPath=p=>process.platform==='win32'?'/'+p[0].toLowerCase()+p.slice(2).replaceAll('\\','/'):p;
 try{
  git('init','-q');git('config','user.name','Synthetic CI');git('config','user.email','fixture@example.invalid');git('config','core.autocrlf','false');
  const docs=path.join(root,'docs','evidence','erp');mkdirSync(docs,{recursive:true});const proof=path.join(docs,'proof.md');writeFileSync(proof,'one\n');git('add','.');git('commit','-qm','base no classifier');const absent=git('rev-parse','HEAD');
  writeFileSync(proof,'two\n');git('add','.');git('commit','-qm','docs no classifier');const docsAbsent=git('rev-parse','HEAD');
  const feature='codex/erp-p03-pr53-candidate-20261018',baseBranch='codex/erp-p03-integrated-candidate-20261017',repo='melihsnyldzz-ui/melisa-erp-v2',ref='refs/heads/'+feature,runner=path.join(root,'.git'),eventPath=path.join(runner,'synthetic-event.json'),out=path.join(runner,'synthetic-output.txt'),marker='SECRET_SENTINEL_NEVER_PRINT';
  const shimdir=path.join(runner,'fixture-bin');mkdirSync(shimdir);const shim=path.join(shimdir,'node');writeFileSync(shim,`#!/usr/bin/env bash\nif [ "$2" = "--github-event" ]; then\n  if [ "$CI_SYNTH_NODE_MODE" = "fail" ]; then exit 9; fi\n  if [ "$CI_SYNTH_NODE_MODE" = "invalid" ]; then printf '%s' 'invalid-${marker}'; exit 0; fi\nfi\nexec '${shellPath(process.execPath).replaceAll("'","'\\''")}' "$@"\n`);chmodSync(shim,0o755);
  const push=(before,after)=>({repository:{full_name:repo},ref,before,after,deleted:false,forced:false,private_marker:marker});
  const run=(event,eventName,head,githubRef,mode='normal')=>{writeFileSync(eventPath,JSON.stringify(event));writeFileSync(out,'');const stdout=execFileSync(bash,['-c',shell],{cwd:root,encoding:'utf8',windowsHide:true,env:{...process.env,PATH:shimdir+path.delimiter+process.env.PATH,CI_SYNTH_NODE_MODE:mode,GITHUB_EVENT_PATH:eventPath,GITHUB_EVENT_NAME:eventName,GITHUB_SHA:head,GITHUB_REPOSITORY:repo,GITHUB_REF:githubRef,RUNNER_TEMP:shellPath(runner),GITHUB_OUTPUT:shellPath(out)}});assert(!stdout.includes(marker));const output=readFileSync(out,'utf8').replaceAll('\r\n','\n');assert.match(output,/^scope=(FULL|DOCS_ONLY)\n$/);return output;};
  assert.equal(run(push(absent,docsAbsent),'push',docsAbsent,ref),'scope=FULL\n');
  mkdirSync(path.join(root,'scripts','ci'),{recursive:true});const classifier=path.join(root,'scripts','ci','change-impact-advisory.mjs');writeFileSync(classifier,readFileSync(path.resolve('scripts/ci/change-impact-advisory.mjs')));git('add','.');git('commit','-qm','classifier');const pinned=git('rev-parse','HEAD');
  writeFileSync(proof,'three\n');git('add','.');git('commit','-qm','docs pinned base');const docsPinned=git('rev-parse','HEAD');assert.equal(run(push(pinned,docsPinned),'push',docsPinned,ref),'scope=DOCS_ONLY\n');
  assert.equal(run(push(pinned,docsPinned),'push',docsPinned,ref,'fail'),'scope=FULL\n');assert.equal(run(push(pinned,docsPinned),'push',docsPinned,ref,'invalid'),'scope=FULL\n');
  writeFileSync(proof,'four\n');git('add','.');git('commit','-qm','force all','-m','ERP-CI-FULL: required');const fullHead=git('rev-parse','HEAD');assert.equal(run(push(docsPinned,fullHead),'push',fullHead,ref),'scope=FULL\n');
  writeFileSync(classifier,Buffer.concat([readFileSync(classifier),Buffer.from('\n// changed fixture\n')]));git('add','.');git('commit','-qm','change classifier');const changed=git('rev-parse','HEAD');assert.equal(run(push(fullHead,changed),'push',changed,ref),'scope=FULL\n');
  writeFileSync(proof,'five\n');git('add','.');git('commit','-qm','docs changed base');const changedBase=git('rev-parse','HEAD');assert.equal(run(push(changed,changedBase),'push',changedBase,ref),'scope=FULL\n');
  const pr=(base,head)=>({repository:{full_name:repo},number:54,action:'synchronize',pull_request:{base:{sha:base,ref:baseBranch,repo:{full_name:repo}},head:{sha:head,ref:feature,repo:{full_name:repo}}},private_marker:marker});
  git('checkout','--detach','-q',pinned);git('merge','--no-ff','--no-edit',docsPinned);const validMerge=git('rev-parse','HEAD');assert.equal(run(pr(pinned,docsPinned),'pull_request',validMerge,'refs/pull/54/merge'),'scope=DOCS_ONLY\n');
  git('checkout','--detach','-q',docsPinned);git('merge','--no-ff','--no-edit',fullHead);const fullMerge=git('rev-parse','HEAD');assert.equal(run(pr(docsPinned,fullHead),'pull_request',fullMerge,'refs/pull/54/merge'),'scope=FULL\n');
  git('checkout','--detach','-q',absent);git('merge','--no-ff','--no-edit',docsAbsent);const merge=git('rev-parse','HEAD');assert.equal(run(pr(absent,docsAbsent),'pull_request',merge,'refs/pull/54/merge'),'scope=FULL\n');
 }finally{assert.equal(path.dirname(realpathSync.native(root)),parent);assert.match(path.basename(root),/^erp-ci-trust-fixture-/);rmSync(root,{recursive:true});}
});
