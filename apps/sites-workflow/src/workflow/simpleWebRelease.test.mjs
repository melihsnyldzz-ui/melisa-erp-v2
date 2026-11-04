import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import cp from 'node:child_process';import {fileURLToPath} from 'node:url';
import {buildSimpleWebPair} from '../../business-web-package.mjs';
import {loadWebRelease,webSha256,validateWebRelease,assertWebRollbackCompatible,journalCreatorBytes,validateWebSettings} from '../../business-web-release.mjs';
import {backendProofBootstrap} from '../../business-web-gateway.mjs';
import {simpleWebFixture} from './simpleWebFixtures.mjs';
import {assertSimpleWebCi} from '../../../../scripts/canonical/prepare-simple-business-web.mjs';
const clone=value=>structuredClone(value);
function temp(action){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'melisa-simple-web-offline-'));try{return action(dir);}finally{fs.rmSync(dir,{recursive:true,force:true});}}
function save(root,release){for(const[p,b]of release.files){fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.writeFileSync(path.join(root,p),b,{flag:'wx'});}const m=path.join(root,'release-manifest.json');fs.writeFileSync(m,release.manifestBytes,{flag:'wx'});return m;}
function editInput(input,filename,transform){const b=transform(input.bytes.get(filename));input.bytes.set(filename,b);const m=JSON.parse(input.manifestBytes),entry=m.files.find(f=>f.path===filename);entry.bytes=b.length;entry.sha256=webSha256(b);input.manifestBytes=Buffer.from(JSON.stringify(m));input.digest=webSha256(input.manifestBytes);}
test('candidate/rollback are one explicit compatible protocol, retain both chunks and preserve selected HTML',()=>{
 const {pair}=simpleWebFixture();assertWebRollbackCompatible(pair.candidate.manifest,pair.rollback.manifest);assert.equal(pair.candidate.files.get('ui/ornek-akis.html').toString(),'next');assert.equal(pair.rollback.files.get('ui/ornek-akis.html').toString(),'old');for(const r of Object.values(pair))assert(r.files.has('ui/assets/old.js')&&r.files.has('ui/assets/next.js'));assert(Object.values(pair.candidate.manifest.activation).every(v=>v===false));
 temp(root=>{const p=save(root,pair.candidate);assert.equal(loadWebRelease(p,webSha256(pair.candidate.manifestBytes)).manifest.releaseId,pair.candidate.manifest.releaseId);fs.appendFileSync(path.join(root,'ui/assets/next.js'),'corrupt');assert.throws(()=>loadWebRelease(p,webSha256(pair.candidate.manifestBytes)),/WEB_RELEASE_BYTES/);});
});
test('source protocol, backend overlay, source file bytes and rollback identity cannot drift silently',()=>{
 for(const mode of ['manifest','source','backend']){const {input}=simpleWebFixture();if(mode==='manifest')input.candidate.digest='0'.repeat(64);if(mode==='source')input.candidate.bytes.set('apps/sites-workflow/business-preview-session.mjs',Buffer.from('corrupt'));if(mode==='backend'){const m=JSON.parse(input.previous.manifestBytes);m.backendManifestSha256='9'.repeat(64);input.previous.manifestBytes=Buffer.from(JSON.stringify(m));input.previous.digest=webSha256(input.previous.manifestBytes);}assert.throws(()=>buildSimpleWebPair(input),/WEB_PACKAGE_/);}
 const f=simpleWebFixture(),other=clone(f.pair.rollback.manifest);other.backend.manifestSha256='9'.repeat(64);assert.throws(()=>assertWebRollbackCompatible(f.release,other),/INCOMPATIBLE/);
});
test('journal helper closure is bound to actual selected/retained blobs; unrelated UI additions remain compatible',()=>{
 const file='apps/sites-workflow/src/workflow/workTradeModel.mjs';
 for(const name of ['bad','tradeId','tradeRevision','object','keys','canonicalId','canonicalUuid','canonicalWitness','createTradeJournal']){const {input}=simpleWebFixture();editInput(input.previous,file,b=>Buffer.from(b.toString().replace(new RegExp('((?:const|function) '+name+'[^\\n]*)'),'$1 // altered contract')));assert.throws(()=>buildSimpleWebPair(input),/WEB_(?:PACKAGE_JOURNAL_DRIFT|JOURNAL_SOURCE)/);}
 const {input}=simpleWebFixture();editInput(input.previous,file,b=>Buffer.concat([b,Buffer.from('\nexport const unrelatedUiAddition=true;\n')]));assert.doesNotThrow(()=>buildSimpleWebPair(input));
 const {pair}=simpleWebFixture(),release=pair.candidate,original=release.files.get('protocol/selected-work-trade.mjs');const changed=Buffer.from(original.toString().replace('const object=v=>','const object=v=>false&&'));release.files.set('protocol/selected-work-trade.mjs',changed);release.manifest.uiSource.journalSourceSha256=webSha256(changed);Object.assign(release.manifest.files.find(f=>f.path==='protocol/selected-work-trade.mjs'),{bytes:changed.length,sha256:webSha256(changed)});release.manifestBytes=Buffer.from(JSON.stringify(release.manifest));temp(root=>assert.throws(()=>loadWebRelease(save(root,release),webSha256(release.manifestBytes)),/WEB_JOURNAL_BYTES/));
 assert.throws(()=>journalCreatorBytes(Buffer.from('export function createTradeJournal(){}')),/WEB_JOURNAL_SOURCE/);
});
test('same asset path with different byte content is a rejected release, not a stale-tab fallback',()=>{const {input}=simpleWebFixture();const old=JSON.parse(input.previous.manifestBytes),asset=old.files.find(f=>f.path.endsWith('/assets/old.js'));const bytes=input.previous.bytes.get(asset.path);input.previous.bytes.delete(asset.path);asset.path=asset.path.replace('old.js','next.js');input.previous.bytes.set(asset.path,bytes);input.previous.manifestBytes=Buffer.from(JSON.stringify(old));input.previous.digest=webSha256(input.previous.manifestBytes);assert.throws(()=>buildSimpleWebPair(input),/ASSET_COLLISION/);});
test('closed release/settings schemas reject wildcard routes, false runtime authority, general proxy and API/IIS port overlap',()=>{
 const f=simpleWebFixture();for(const pathname of ['ui/../private.json','runtime/extra.mjs','ui/.env','ui/api/proxy']){const m=clone(f.release);m.files.push({path:pathname,bytes:1,sha256:'a'.repeat(64)});assert.throws(()=>validateWebRelease(m));}
 for(const change of [{runtimeStartAuthorized:false},{iisOrigin:'http://192.168.1.46:5254'},{iisOrigin:'http://127.0.0.1:4144'},{iisOrigin:'http://user:pass@127.0.0.1:5254'},{tailPeers:['8.8.8.8']},{releaseDigest:'0'.repeat(64)},{extra:true}])assert.throws(()=>validateWebSettings({...f.settings,...change},f.settings.releaseDigest));
});
test('passive producer requires exact first-attempt source CI with all three complete jobs and no skipped step',()=>{
 const source='1'.repeat(40),run={id:1,head_sha:source,head_repository:{full_name:'melihsnyldzz-ui/melisa-erp-v2'},event:'push',path:'.github/workflows/ci.yml',run_attempt:1,status:'completed',conclusion:'success'},result={total_count:3,jobs:['quality-build-test','secret-scan','windows-startup-test'].map((name,id)=>({id,name,head_sha:source,run_id:1,run_attempt:1,status:'completed',conclusion:'success',steps:[{status:'completed',conclusion:'success'}]}))};
 assert.equal(assertSimpleWebCi(run,result,source,'push').attempt,1);for(const field of ['head_sha','event','conclusion','status'])assert.throws(()=>assertSimpleWebCi({...run,[field]:'wrong'},result,source,'push'));assert.throws(()=>assertSimpleWebCi({...run,run_attempt:2},result,source,'push'));for(const change of [r=>r.jobs.pop(),r=>r.jobs[0].steps[0].conclusion='skipped',r=>r.jobs[0].head_sha='2'.repeat(40),r=>r.jobs[0].run_attempt=2]){const r=clone(result);change(r);assert.throws(()=>assertSimpleWebCi(run,r,source,'push'));}
});
test('PS5 pure backend snapshot rejects each actor/overlay drift and bootstrap seals executable helper through invocation', {skip:process.platform!=='win32',timeout:20000},()=>temp(root=>{
 const library=fileURLToPath(new URL('../../business-web-backend-proof.ps1',import.meta.url)),script=path.join(root,'snapshot-fixture.ps1');
 const content=`$ErrorActionPreference='Stop'
. '${library.replaceAll("'","''")}' -Library
$c=@{ExpectedDatabase='MELISA_ERP_SIRKET_TEST_20260929_01';TaskName='Melisa-ERP-TEST-Canonical';SourceCommit=('4'*40);ApiComponent=@{SourceCommit=('4'*40);ManifestSha256=('5'*64);ReleaseRoot='C:\\fixture-api';ConfigPath='C:\\fixture-api-private.json'};ReleaseRoot='C:\\fixture-base';ConfigPath='C:\\fixture-base-private.json';ManifestSha256=('6'*64);NodeSha256=('7'*64);OwnerSid='S-1-5-21-FIXTURE';NodePath='C:\\fixture-node.exe'}
$birth='2026-11-02T10:00:00.123456Z'
$snapshot=@{config=$c;apiManifest=@{sourceCommit=('4'*40);packageId='FIXTURE-API'};apiManifestSha256=('5'*64);baseManifestSha256=('6'*64);nodeSha256=('7'*64);owned=@{sourceCommit=('4'*40);supervisor=99;children=@{api=@{pid=101;createdAt=$birth};native=@{pid=102;createdAt=$birth}}};actors=@{api=@{pid=101;birth=$birth;ownerSid=$c.OwnerSid;executablePath=$c.NodePath;parentPid=99;listenerPids=@(101);commandLine='"C:\\fixture-node.exe" "C:\\fixture-api\\apps\\api\\start-canonical-test.mjs" erp "C:\\fixture-api-private.json"'};native=@{pid=102;birth=$birth;ownerSid=$c.OwnerSid;executablePath=$c.NodePath;parentPid=88;listenerPids=@(102);commandLine='"C:\\fixture-node.exe" "C:\\fixture-base\\apps\\api\\start-canonical-test.mjs" native "C:\\fixture-base-private.json"'}}}
$json=$snapshot|ConvertTo-Json -Depth 10 -Compress
$ok=Assert-SimpleWebBackendSnapshot $snapshot ('4'*40) 'FIXTURE-API' ('5'*64)
if(!$ok.ownerVerified-or$ok.sqlCalls-ne0-or$ok.runtimeWrites-ne0){throw 'FIXTURE_POSITIVE'}
$cases=@(
 @{code='WEB_BACKEND_OVERLAY_IDENTITY';change={$args[0].apiManifestSha256='8'*64}},
 @{code='WEB_BACKEND_OVERLAY_IDENTITY';change={$args[0].config.ApiComponent.SourceCommit='8'*40}},
 @{code='WEB_BACKEND_OVERLAY_IDENTITY';change={$args[0].config.ExpectedDatabase='LIVE'}},
 @{code='WEB_BACKEND_PROCESS_IDENTITY';change={$args[0].actors.api.pid=103}},
 @{code='WEB_BACKEND_PROCESS_IDENTITY';change={$args[0].actors.api.ownerSid='foreign'}},
 @{code='WEB_BACKEND_PROCESS_IDENTITY';change={$args[0].actors.api.birth='2026-11-02T10:00:00.123457Z'}},
 @{code='WEB_BACKEND_PROCESS_IDENTITY';change={$args[0].actors.native.listenerPids=@(102,999)}},
 @{code='WEB_BACKEND_PARENT_IDENTITY';change={$args[0].actors.api.parentPid=100}},
 @{code='WEB_BACKEND_COMMAND_IDENTITY';change={$args[0].actors.api.commandLine+=' extra'}},
 @{code='WEB_BACKEND_BINARY_IDENTITY';change={$args[0].nodeSha256='8'*64}}
)
foreach($case in $cases){$copy=$json|ConvertFrom-Json;&$case.change $copy;$rejected=$false;try{Assert-SimpleWebBackendSnapshot $copy ('4'*40) 'FIXTURE-API' ('5'*64)|Out-Null}catch{if($_.Exception.Message-cne$case.code){throw};$rejected=$true};if(!$rejected){throw 'FIXTURE_NEGATIVE_NOT_REJECTED'}}
[Console]::WriteLine('SYNTHETIC_SNAPSHOT_1_POSITIVE_10_EXACT_NEGATIVES')
`;
 fs.writeFileSync(script,content);const ps=String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`;let r=cp.spawnSync(ps,['-NoProfile','-NonInteractive','-File',script],{encoding:'utf8',timeout:15000,windowsHide:true});assert.equal(r.status,0,r.stdout+r.stderr);assert.match(r.stdout,/1_POSITIVE_10_EXACT_NEGATIVES/);
 const proof=path.join(root,'held-helper.ps1');fs.writeFileSync(proof,`param($ExpectedSource,$ExpectedPackage,$ExpectedManifestSha256,[switch]$FullHash)\n$denied=$false;try{[IO.File]::WriteAllText($Proof,'replaced')}catch{$denied=$true};if(!$denied){throw 'FIXTURE_NO_SOURCE_HOLD'};[Console]::WriteLine('SYNTHETIC_SOURCE_HELD')`);
 const quote=v=>"'"+v.replaceAll("'","''")+"'";const command=digest=>backendProofBootstrap+' '+[proof,digest,'4'.repeat(40),'FIXTURE-API','5'.repeat(64),'true'].map(quote).join(' ');
 r=cp.spawnSync(ps,['-NoProfile','-NonInteractive','-Command',command(webSha256(fs.readFileSync(proof)))],{encoding:'utf8',timeout:15000,windowsHide:true});assert.equal(r.status,0,r.stdout+r.stderr);assert.match(r.stdout,/SYNTHETIC_SOURCE_HELD/);
 r=cp.spawnSync(ps,['-NoProfile','-NonInteractive','-Command',command('0'.repeat(64))],{encoding:'utf8',timeout:15000,windowsHide:true});assert.equal(r.status,1);assert.doesNotMatch(r.stdout,/SYNTHETIC_SOURCE_HELD/);
}));
