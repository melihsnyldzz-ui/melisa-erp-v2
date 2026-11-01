import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import vm from 'node:vm';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {COLD_CURRENT as C,COLD_OWNER_FILES,COLD_PROOF_FILES,validateColdCurrentRecords,validateColdCurrentRaw,validateColdCiRun,validateColdCiEndpoint,writeColdCurrentNew,main} from './prepare-business-5244-cold-current-recovery.mjs';
const copy=x=>structuredClone(x),encode=x=>Buffer.from(JSON.stringify(x,null,2)+'\n');
function fixture(){return {
 failure:{sourceCommit:'6e13a67d7647729a599f7b6f82e7c09c916c101c',status:'FAILED_REVIEW_RECEIPT',scope:'TEST125-API-B6-WRITER-20261029',outcome:null,failure:'READPAIR_UNCLASSIFIED_FAILURE',stopCalls:0,startCalls:0,retireAttempts:0,apiRestarts:0,taskChanges:0,profileWrites:0,sqlWrites:0,primaryFailure:{site:{scriptLineNumber:1337}},restoreFailure:{site:{scriptLineNumber:545}},cleanupFailure:{site:{scriptLineNumber:1527}}},
 readback:{schema:'melisa-b6-post-recovery-failure-readback.v1',oldOwnerPresent:false,oldChildPresent:false,controllerPresent:false,webListenerCount:0,markerPresent:true,protectedListenersEqual:true,taskXmlSddlInstanceEqual:true,apiHealthEqual:true,erpRecordBytesEqual:true,originalSaleInputFilesEqual:true,installResultSha256:C.failureSha256,markerSha256:C.markerSha256,originalRequestId:C.originalRequestId,actualInstallInvocations:1,actualNormalDebuggerQuitInvocations:1,actualNewOwnerStarts:0,rollbackComplete:false,secondInstallCalls:0,commercialWrites:0,apiFiles:Array.from({length:4},()=>({equal:true})),legacyEntries:Array.from({length:56},()=>({equal:true})),protectedFiles:Array.from({length:4},()=>({equal:true})),protectedProcesses:Array.from({length:4},()=>({equal:true}))},
 summary:{task:'ERP-B6-POST-RECOVERY-INSTALL-20261101-1216',sourceCommit:'6e13a67d7647729a599f7b6f82e7c09c916c101c',command:{controllerPid:2696,controllerBirth:'134380102437098616',actualInvocations:1,exitCode:1},receiptSha256:C.failureSha256,markerSha256:C.markerSha256,protectedReadbackSha256:C.readbackSha256,observedNativePrimaryError:'B6_MANAGED_EXIT_SIGNAL_TIMEOUT',historicalFirstInstallError:'UNKNOWN',web5244:'DOWN',installed:false,rollbackComplete:false,newOwnerStarts:0,retireAttempts:0,apiRestarts:0,sqlWrites:0,taskChanges:0,configChanges:0,salesPostCount:0,secondInstallerCalls:0},
 before:{schema:'melisa-b6-pending-web-passive-before.v1',recordSha256:C.recordSha256,owner:{pid:33080,birth:'134379216568450540'},child:{pid:7052,birth:'134379217109250880'},entries:Array.from({length:56},(_,i)=>({path:String.raw`C:\Sirket\ERP\isolated-fixture\entry-${i}.ps1`,sha256:'a'.repeat(64)}))}
 };}
function assertPlan(p){assert.equal(p.caseId,C.id);assert.equal(p.originalRequestId,C.originalRequestId);assert.equal(p.historicalFirstInstallError,'UNKNOWN');assert.equal(p.newPrimaryError,'B6_MANAGED_EXIT_SIGNAL_TIMEOUT');assert.equal(p.currentOnly,true);for(const k of ['candidateInstallation','installed','applied','executionAuthority','admissionIssued','runtimeValidationComplete'])assert.equal(p[k],false,k);}
function reject(input,code){assert.throws(()=>validateColdCurrentRecords(input),e=>e.message===code);}
function rawFixture(input=fixture()){
 // Isolated crypto mapping makes synthetic bytes enter the REAL semantic/raw
 // validators. It never claims these synthetic bytes have actual private pins.
 const raw=Object.fromEntries(Object.entries(input).map(([k,v])=>[k,encode(v)]));
 const pins=new Map(Object.entries(raw).map(([k,b])=>[b.toString('hex'),C[k+'Sha256']]));
 return {raw,validate:isolatedSource(pins).validateRaw};
}
function isolatedSource(pins){
 const fakeCrypto={createHash(algorithm){assert.equal(algorithm,'sha256');let value;return {update(b){value=Buffer.from(b);return this;},digest(format){assert.equal(format,'hex');return pins.get(value.toString('hex'))??crypto.createHash(algorithm).update(value).digest(format);}};}};
 const blocked=()=>{throw new Error('UNEXPECTED_EXTERNAL_IO')};
 const context=vm.createContext({Buffer,Map,console,crypto:fakeCrypto,fs:new Proxy({}, {get:()=>blocked}),cp:new Proxy({}, {get:()=>blocked}),path,fileURLToPath,pathToFileURL,__metaUrl:'file:///inert/producer.mjs',process:{argv:['node','inert-fixture.test.mjs'],env:{}}});
 const source=fs.readFileSync(new URL('./prepare-business-5244-cold-current-recovery.mjs',import.meta.url),'utf8');
 vm.runInContext(source.replace(/^import .*;$/gm,'').replaceAll('export ','').replaceAll('import.meta.url','__metaUrl')+'\nglobalThis.validateRaw=validateColdCurrentRaw;globalThis.compile=compileColdCurrentArtifacts;globalThis.privatePins=PRIVATE_INPUTS;',context);
 return context;
}
test('cold Current records produce only the fixed passive recovery projection',()=>assertPlan(validateColdCurrentRecords(fixture())));
test('cold Current semantic validation leaves all original records and failed lineage immutable',()=>{const input=fixture(),before=JSON.stringify(input);assertPlan(validateColdCurrentRecords(input));assert.equal(JSON.stringify(input),before);});
test('cold Current raw validation reaches semantic checks through explicit synthetic hash mappings only',()=>{const f=rawFixture();assertPlan(f.validate(f.raw));});
test('cold Current projection is detached from later input mutations and contains no evidence or executable callbacks',()=>{const input=fixture(),p=validateColdCurrentRecords(input);input.summary.historicalFirstInstallError='rewritten';input.before.entries.length=0;assertPlan(p);assert.equal(Object.values(p).some(v=>typeof v==='function'||(v&&typeof v==='object')),false);});

const mutations=[];
for(const k of ['stopCalls','startCalls','retireAttempts','apiRestarts','taskChanges','profileWrites','sqlWrites'])for(const value of [1,'0',false,null])mutations.push(['failure '+k+' '+String(value),x=>{x.failure[k]=value},'COLD_CURRENT_FAILURE_CHANGED']);
for(const [name,change] of [
 ['source',x=>x.failure.sourceCommit='a'.repeat(40)],['status',x=>x.failure.status='CandidateVerified'],['scope',x=>x.failure.scope='TEST125-API-OTHER'],['candidate outcome',x=>x.failure.outcome='CandidateVerified'],['failure code',x=>x.failure.failure='OTHER'],['primary location',x=>x.failure.primaryFailure.site.scriptLineNumber++],['restore missing',x=>delete x.failure.restoreFailure],['cleanup type',x=>x.failure.cleanupFailure.site.scriptLineNumber='1527']
])mutations.push([name,change,'COLD_CURRENT_FAILURE_CHANGED']);
for(const k of ['oldOwnerPresent','oldChildPresent','controllerPresent','webListenerCount','markerPresent','protectedListenersEqual','taskXmlSddlInstanceEqual','apiHealthEqual','erpRecordBytesEqual','originalSaleInputFilesEqual','installResultSha256','markerSha256','originalRequestId','actualInstallInvocations','actualNormalDebuggerQuitInvocations','actualNewOwnerStarts','rollbackComplete','secondInstallCalls','commercialWrites'])mutations.push(['readback '+k,x=>{const v=x.readback[k];x.readback[k]=typeof v==='boolean'?!v:typeof v==='number'?v+1:'wrong'},'COLD_CURRENT_READBACK_CHANGED']);
for(const k of ['newOwnerStarts','retireAttempts','apiRestarts','sqlWrites','taskChanges','configChanges','salesPostCount','secondInstallerCalls'])mutations.push(['summary counter '+k,x=>x.summary[k]=1,'COLD_CURRENT_SUMMARY_CHANGED']);
for(const [name,change] of [['summary source',x=>x.summary.sourceCommit='b'.repeat(40)],['controller pid',x=>x.summary.command.controllerPid++],['controller birth',x=>x.summary.command.controllerBirth+='0'],['controller invocations',x=>x.summary.command.actualInvocations=2],['receipt lineage',x=>x.summary.receiptSha256='0'.repeat(64)],['readback lineage',x=>x.summary.protectedReadbackSha256='0'.repeat(64)],['unknown first error',x=>x.summary.historicalFirstInstallError='ASSUMED'],['new primary error',x=>x.summary.observedNativePrimaryError='ASSUMED'],['installed',x=>x.summary.installed=true],['rollback claim',x=>x.summary.rollbackComplete=true]])mutations.push([name,change,'COLD_CURRENT_SUMMARY_CHANGED']);
for(const [name,change] of [['before schema',x=>x.before.schema+='x'],['record pin',x=>x.before.recordSha256='0'.repeat(64)],['owner pid',x=>x.before.owner.pid++],['owner birth type',x=>x.before.owner.birth=134379216568450540],['child pid',x=>x.before.child.pid++],['child birth',x=>x.before.child.birth+='0'],['missing entry',x=>x.before.entries.pop()],['duplicate entry',x=>x.before.entries[55]=copy(x.before.entries[0])]])mutations.push([name,change,'COLD_CURRENT_BEFORE_CHANGED']);
for(const [name,change,code] of mutations)test('cold Current exact semantic rejection: '+name,()=>{const input=fixture();assertPlan(validateColdCurrentRecords(input));change(input);reject(input,code);});
test('cold Current real SHA implementation refuses every synthetic unpinned evidence input',()=>{const input=fixture();for(const k of ['failure','readback','summary','before']){const f=rawFixture();assertPlan(f.validate(f.raw));const raw={...f.raw,[k]:Buffer.from('unpinned synthetic bytes')};assert.throws(()=>f.validate(raw),e=>e.message==='COLD_CURRENT_INPUT_PIN_CHANGED');}assert.throws(()=>validateColdCurrentRaw(Object.fromEntries(Object.entries(input).map(([k,v])=>[k,encode(v)]))),e=>e.message==='COLD_CURRENT_INPUT_PIN_CHANGED');});
for(const [name,change] of [
 ['null row',x=>x.before.entries[0]=null],
 ['nonstring path',x=>x.before.entries[0].path=1],
 ['relative path',x=>x.before.entries[0].path='relative.ps1'],
 ['parent traversal',x=>x.before.entries[0].path=String.raw`C:\Sirket\ERP\isolated-fixture\..\foreign.ps1`],
 ['case alias duplicate',x=>x.before.entries[55].path=x.before.entries[0].path.toUpperCase()],
 ['hash missing',x=>delete x.before.entries[0].sha256],
 ['hash type',x=>x.before.entries[0].sha256=1],
 ['hash nonhex',x=>x.before.entries[0].sha256='g'.repeat(64)],
 ['hash trailing LF',x=>x.before.entries[0].sha256+='\n'],
 ['extra row key',x=>x.before.entries[0].authority=true]
])test('cold Current rejects malformed before entry semantics: '+name,()=>{const input=fixture();assertPlan(validateColdCurrentRecords(input));change(input);reject(input,'COLD_CURRENT_BEFORE_CHANGED');});
for(const key of ['apiFiles','legacyEntries','protectedFiles','protectedProcesses'])for(const [name,change] of [
 ['missing',x=>delete x.readback[key]],['empty',x=>x.readback[key]=[]],['missing row',x=>x.readback[key].pop()],['extra row',x=>x.readback[key].push({equal:true})],['mismatch',x=>x.readback[key][0].equal=false],['string true',x=>x.readback[key][0].equal='true'],['null row',x=>x.readback[key][0]=null]
])test('cold Current requires exact readback array '+key+': '+name,()=>{const input=fixture();assertPlan(validateColdCurrentRecords(input));change(input);reject(input,'COLD_CURRENT_READBACK_CHANGED');});

const sourceSha='a'.repeat(40),repoName='melihsnyldzz-ui/melisa-erp-v2';
function ciFixture(event='push',id=100){
 const run={id,head_sha:sourceSha,event,run_attempt:1,status:'completed',conclusion:'success',workflow_id:374179065,path:'.github/workflows/ci.yml',head_repository:{full_name:repoName}};
 const jobs={total_count:3,jobs:['quality-build-test','secret-scan','windows-startup-test'].map((name,i)=>({id:id+1+i,run_id:id,run_attempt:1,head_sha:sourceSha,name,status:'completed',conclusion:'success',steps:[{number:1,name:'fixture step',status:'completed',conclusion:'success'}]}))};
 return {run,jobs,event};
}
function validateCi(f){return validateColdCiRun(f.run,f.jobs,sourceSha,f.event);}
test('cold Current CI accepts exact push and PR terminal job triples',()=>{for(const event of ['push','pull_request']){const result=validateCi(ciFixture(event));assert.equal(result.jobs.length,3);assert.equal(result.event,event);assert.equal(result.attempt,1);}});
for(const [name,change,code] of [
 ['attempt2',f=>f.run.run_attempt=2,'RUN'],['wrong head',f=>f.run.head_sha='b'.repeat(40),'RUN'],['wrong workflow',f=>f.run.workflow_id++,'RUN'],['foreign repository',f=>f.run.head_repository.full_name='foreign/repo','RUN'],['wrong event',f=>f.run.event='workflow_dispatch','RUN'],['pending run',f=>f.run.status='in_progress','RUN'],['cancelled run',f=>f.run.conclusion='cancelled','RUN'],['zero run',f=>f.run.id=0,'RUN'],['unsafe run',f=>f.run.id=Number.MAX_SAFE_INTEGER+1,'RUN'],
 ['missing job',f=>f.jobs.jobs.pop(),'JOBSET'],['wrong total',f=>f.jobs.total_count=4,'JOBSET'],['wrong job run',f=>f.jobs.jobs[0].run_id++,'JOB'],['wrong job attempt',f=>f.jobs.jobs[0].run_attempt=2,'JOB'],['wrong job head',f=>f.jobs.jobs[0].head_sha='b'.repeat(40),'JOB'],['unknown job',f=>f.jobs.jobs[0].name='other','JOB'],['skipped job',f=>f.jobs.jobs[0].conclusion='skipped','JOB'],['duplicate id',f=>f.jobs.jobs[1].id=f.jobs.jobs[0].id,'DUPLICATE'],['duplicate name',f=>f.jobs.jobs[1].name=f.jobs.jobs[0].name,'DUPLICATE'],['missing steps',f=>f.jobs.jobs[0].steps=[],'STEP'],['cancelled step',f=>f.jobs.jobs[0].steps[0].conclusion='cancelled','STEP'],['skipped step',f=>f.jobs.jobs[0].steps[0].conclusion='skipped','STEP'],['pending step',f=>f.jobs.jobs[0].steps[0].status='in_progress','STEP'],['string step number',f=>f.jobs.jobs[0].steps[0].number='1','STEP']
])test('cold Current CI rejects '+name,()=>{const f=ciFixture();validateCi(f);change(f);assert.throws(()=>validateCi(f),e=>e.message==='COLD_CURRENT_CI_'+code);});
test('cold Current CI rejects newline-extended source digest',()=>{const f=ciFixture();validateCi(f);const bad=sourceSha+'\n';f.run.head_sha=bad;for(const j of f.jobs.jobs)j.head_sha=bad;assert.throws(()=>validateColdCiRun(f.run,f.jobs,bad,'push'),e=>e.message==='COLD_CURRENT_CI_SOURCE');});
test('cold Current CI endpoint accepts only four finite read route shapes',()=>{const base='repos/'+repoName;for(const p of ['/pulls/54',`/actions/runs?head_sha=${sourceSha}&per_page=100`,'/actions/runs/100/attempts/1','/actions/runs/100/attempts/1/jobs?per_page=100'])assert.equal(validateColdCiEndpoint(base+p),base+p);});
for(const tail of ['', '/', '/pulls/55','/../other','/%2e%2e/other','/actions/runs/100/rerun-failed-jobs','/actions/runs/100/attempts/2','/actions/runs/0/attempts/1','/actions/runs/100/attempts/1/jobs?per_page=101',`/actions/runs?head_sha=${sourceSha}&per_page=100&extra=1`,'/pulls/54\n'])test('cold Current CI endpoint rejects '+JSON.stringify(tail),()=>{assert.throws(()=>validateColdCiEndpoint('repos/'+repoName+tail),e=>e.message==='COLD_CURRENT_CI_ENDPOINT');});
test('cold Current CI rejects foreign or suffix repository endpoint',()=>{for(const p of ['repos/foreign/repo/pulls/54','repos/'+repoName+'-other/pulls/54'])assert.throws(()=>validateColdCiEndpoint(p),e=>e.message==='COLD_CURRENT_CI_ENDPOINT');});

const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
function compileFixture(){
 const privateMapping=new Map(),context=isolatedSource(privateMapping);
 const files=new Map(COLD_OWNER_FILES.map(n=>[n,Buffer.from('inert source '+n)]));
 const p=Buffer.from('// synthetic committed producer, never executed\n');
 const e=Buffer.from("$expectedColdProducerSha256='"+digest(p)+"'\n");
 const n=Buffer.from('const string ExpectedEntryHash="'+digest(e)+'";\n');
 for(const [i,b]of [p,e,n].entries())files.set(COLD_PROOF_FILES[i],b);
 const inputs=new Map(context.privatePins.map(([name,,hash])=>{const b=Buffer.from('synthetic private fixture '+name);privateMapping.set(b.toString('hex'),hash);return [name,b];}));
 const ci=[validateCi(ciFixture('push',100)),validateCi(ciFixture('pull_request',200))];
 return {context,input:{source:sourceSha,files,ci,inputs},compile(input){return context.compile(input??this.input);}};
}
test('cold Current compiler emits a closed 15-file core and 10-file proof with current WEB only and every authority false',()=>{
 const f=compileFixture(),result=f.compile();assert.equal(result.core.size,15);assert.equal(result.proof.size,10);
 const manifest=JSON.parse(result.core.get('owner-manifest.json')),c=JSON.parse(result.core.get('cold-current-case.json')),receipt=JSON.parse(result.proof.get('preparation-receipt.json')),sources=JSON.parse(result.proof.get('source-manifest.json'));
 assert.equal(manifest.files.length,13);assert.equal(manifest.root,C.root);assert.equal(c.webSha256,C.webSha256);assert.equal(c.apiSha256,C.apiSha256);assert.equal(c.currentOnly,true);assert.equal(c.candidateInstallation,false);assert.equal(c.historicalFirstInstallError,'UNKNOWN');assert.equal(c.newPrimaryError,'B6_MANAGED_EXIT_SIGNAL_TIMEOUT');
 assert.equal(receipt.coreFiles,15);assert.equal(receipt.proofFiles,10);assert.equal(receipt.manifestSha256,digest(result.core.get('owner-manifest.json')));
 assert.equal(sources.producerSha256,digest(f.input.files.get(COLD_PROOF_FILES[0])));assert.equal(sources.entrySha256,digest(f.input.files.get(COLD_PROOF_FILES[1])));assert.equal(sources.nativeSha256,digest(f.input.files.get(COLD_PROOF_FILES[2])));
 for(const obj of [manifest,c,receipt,result.verification])for(const key of ['installed','applied','executionAuthority','admissionIssued','runtimeValidationComplete'])assert.equal(obj[key],false,key);
 for(const key of ['apiTransitionEnabled','readPairMaintenanceEnabled','recordingEnabled','actualT1','externalOperations'])assert.equal(manifest[key],false,key);
 assert(!result.core.get('cold-current-case.json').toString().includes('5457e450'));assert.equal(result.verification.receiptSha256,digest(result.proof.get('preparation-receipt.json')));
});
test('cold Current compiler is deterministic and never modifies its source or private input bytes',()=>{const f=compileFixture(),before=[...f.input.files,...f.input.inputs].map(([n,b])=>[n,b.toString('hex')]),first=f.compile(),second=f.compile();assert.deepEqual([...f.input.files,...f.input.inputs].map(([n,b])=>[n,b.toString('hex')]),before);for(const group of ['core','proof'])assert.deepEqual([...first[group]].map(([n,b])=>[n,b.toString('hex')]),[...second[group]].map(([n,b])=>[n,b.toString('hex')]));});
for(const [name,mutate,code]of [
 ['missing source',i=>i.files.delete(COLD_OWNER_FILES[0]),'SOURCE_CLOSURE'],['extra source',i=>i.files.set('foreign.ps1',Buffer.from('x')),'SOURCE_CLOSURE'],['empty source',i=>i.files.set(COLD_OWNER_FILES[0],Buffer.alloc(0)),'SOURCE_CLOSURE'],['nonbuffer source',i=>i.files.set(COLD_OWNER_FILES[0],'x'),'SOURCE_CLOSURE'],
 ['producer drift',i=>i.files.set(COLD_PROOF_FILES[0],Buffer.from('changed')),'SOURCE_PINS'],['entry drift',i=>i.files.set(COLD_PROOF_FILES[1],Buffer.from('changed')),'SOURCE_PINS'],['native pin drift',i=>i.files.set(COLD_PROOF_FILES[2],Buffer.from('ExpectedEntryHash="'+'0'.repeat(64)+'"')),'SOURCE_PINS'],
 ['missing private',i=>i.inputs.delete([...i.inputs.keys()][0]),'PRIVATE_CLOSURE'],['extra private',i=>i.inputs.set('foreign',Buffer.from('x')),'PRIVATE_CLOSURE'],['changed private',i=>i.inputs.set([...i.inputs.keys()][0],Buffer.from('changed')),'PRIVATE_PIN'],['wrong source CI',i=>i.ci[1].sourceCommit='b'.repeat(40),'CI_CLOSURE'],['wrong event order',i=>i.ci.reverse(),'CI_CLOSURE'],['missing CI',i=>i.ci.pop(),'CI_CLOSURE'],['attempt2 CI',i=>i.ci[0].attempt=2,'CI_CLOSURE'],['pending CI',i=>i.ci[0].status='in_progress','CI_CLOSURE']
 ,['CI missing jobs',i=>delete i.ci[0].jobs,'CI_CLOSURE'],['CI reused run',i=>i.ci[1].id=i.ci[0].id,'CI_CLOSURE'],['CI duplicate normalized job',i=>i.ci[0].jobs[1]=copy(i.ci[0].jobs[0]),'CI_CLOSURE'],['CI cancelled normalized step',i=>i.ci[0].jobs[0].steps[0].conclusion='cancelled','CI_CLOSURE']
])test('cold Current compiler rejects '+name,()=>{const f=compileFixture();f.compile();mutate(f.input);assert.throws(()=>f.compile(),e=>e.message==='COLD_CURRENT_'+code);});

function ownTemp(fn){const parent=fs.realpathSync.native(process.env.RUNNER_TEMP||os.tmpdir()),temp=fs.realpathSync.native(fs.mkdtempSync(path.join(parent,'b6-cold-proof-')));try{return fn(temp);}finally{const resolved=fs.realpathSync.native(temp);assert.equal(path.dirname(resolved).toLowerCase(),parent.toLowerCase());assert(path.basename(resolved).startsWith('b6-cold-proof-'));assert(!fs.lstatSync(resolved).isSymbolicLink());fs.rmSync(resolved,{recursive:true,force:true});}}
test('cold Current CreateNew writer writes only own immutable outputs and refuses overwrite',()=>ownTemp(temp=>{const root=path.join(temp,'output'),files=new Map([['one.json',Buffer.from('{}\n')],['two.bin',Buffer.from('inert')]]);writeColdCurrentNew(root,files);for(const[n,b]of files)assert(fs.readFileSync(path.join(root,n)).equals(b));assert.throws(()=>writeColdCurrentNew(root,new Map([['one.json',Buffer.from('replace')]])),e=>e.message==='COLD_CURRENT_OUTPUT_EXISTS');assert(fs.readFileSync(path.join(root,'one.json')).equals(files.get('one.json')));}));
for(const name of ['../escape','nested/file',...(process.platform==='win32'?['nested\\file']:[]),path.resolve('absolute-output'),'','.','..'])test('cold Current CreateNew refuses nonleaf '+JSON.stringify(name),()=>ownTemp(temp=>{assert.throws(()=>writeColdCurrentNew(path.join(temp,'output'),new Map([[name,Buffer.from('x')]])),e=>e.message==='COLD_CURRENT_OUTPUT_LEAF');assert(!fs.existsSync(path.join(temp,'escape')));}));
test('cold Current CreateNew refuses a reparse ancestor',()=>ownTemp(temp=>{const target=path.join(temp,'target'),alias=path.join(temp,'alias');fs.mkdirSync(target);fs.symlinkSync(target,alias,process.platform==='win32'?'junction':'dir');try{assert.throws(()=>writeColdCurrentNew(path.join(alias,'output'),new Map([['one',Buffer.from('x')]])),e=>e.message==='COLD_CURRENT_REPARSE');assert(!fs.existsSync(path.join(target,'output')));}finally{if(process.platform==='win32')fs.rmdirSync(alias);else fs.unlinkSync(alias);}}));
test('cold Current main refuses unknown actions before any host source or CI lookup',()=>{for(const action of [undefined,'--apply','--prepare-other','--verify\n'])assert.throws(()=>main(action),e=>e.message==='COLD_CURRENT_FIXED_ACTION');});
