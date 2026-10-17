import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {prepareWorktestPackage,parseWorktestStageArguments,worktestSourceFiles} from './prepare-worktest-package.mjs';
import {worktestPackageSchema} from '../src/worktest-entry.mjs';
import {worktest} from '../src/protectedWorkSessionPolicy.mjs';
import {semihIdentityPath} from '../src/semihHostEntry.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex').toUpperCase();
async function fixture(t) {
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'melisa-worktest-stage-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));const repoRoot=path.join(root,'repo'),source=path.join(repoRoot,'apps','desktop','src');await fs.mkdir(source,{recursive:true});for(const f of worktestSourceFiles)await fs.writeFile(path.join(source,f),'// verified source '+f+'\n');
 const desktopSourceCommit='b'.repeat(40),runtimeSource='a'.repeat(40),runtimeManifestPath=path.join(root,'release-manifest.json'),runtimePinPath=path.join(root,'public-worktest-package.json'),pin={schemaVersion:worktestPackageSchema,sourceCommit:runtimeSource,copyId:worktest.copyId,databaseName:worktest.database,serverName:worktest.server},manifest={sourceCommit:runtimeSource,baselineReproduced:true,sharedTestCopy:{database:worktest.database,apiPort:4184,nativePort:4186,webPort:5234,nativeWrites:false,externalOperations:false,actualT1:false}};
 const pinBytes=Buffer.from(JSON.stringify(pin)),manifestBytes=Buffer.from(JSON.stringify(manifest));await fs.writeFile(runtimePinPath,pinBytes);await fs.writeFile(runtimeManifestPath,manifestBytes);
 const input={repoRoot,output:path.join(root,'new-stage'),desktopSourceCommit,runtimeManifestPath,runtimeManifestSHA256:sha(manifestBytes),runtimePinPath,runtimePinSHA256:sha(pinBytes)},state={root:repoRoot,head:desktopSourceCommit,origin:'https://github.com/melihsnyldzz-ui/melisa-erp-v2.git',pushOrigin:'https://github.com/melihsnyldzz-ui/melisa-erp-v2.git',dirty:false};return{root,source,input,pin,manifest,state,options:{inspectSource:()=>state}};
}
test('fresh source-only dedicated stage binds independent clean desktop HEAD and runtime public pin',async t=>{
 const f=await fixture(t),result=await prepareWorktestPackage(f.input,f.options);assert.equal(result.desktopSourceCommit,'b'.repeat(40));assert.equal(result.runtimeSourceCommit,'a'.repeat(40));assert.equal(result.servicesStarted,0);assert.equal(result.buildExecuted,false);assert.equal(result.credentialsIncluded,false);
 const pkg=JSON.parse(await fs.readFile(path.join(f.input.output,'package.json'),'utf8'));assert.equal(pkg.main,'src/worktest-entry.mjs');assert.equal(pkg.name,'melisa-calisma-test');assert.equal(pkg.build.appId,'com.melisababy.erp.worktest');assert.equal(pkg.build.electronVersion,'39.8.10');assert(!pkg.scripts);
 assert.deepEqual(await fs.readFile(path.join(f.input.output,'src','worktest-package.json')),await fs.readFile(f.input.runtimePinPath));
 for(const item of result.files)assert.equal(sha(await fs.readFile(path.join(f.input.output,item.path))),item.sha256);
 assert.deepEqual((await fs.readdir(path.join(f.input.output,'src'))).sort(),[...worktestSourceFiles,'worktest-package.json'].sort());await assert.rejects(()=>prepareWorktestPackage(f.input,f.options));
});
test('dirty or foreign source, wrong hash/target, existing stage and in-repository output are rejected before files publish',async t=>{
 const f=await fixture(t);
 for(const patch of [{dirty:true},{head:'c'.repeat(40)},{origin:'https://other.invalid/repo.git'},{pushOrigin:'https://other.invalid/repo.git'}])await assert.rejects(()=>prepareWorktestPackage(f.input,{inspectSource:()=>({...f.state,...patch})}));
 for(const patch of [{runtimeManifestSHA256:'0'.repeat(64)},{runtimePinSHA256:'0'.repeat(64)},{output:path.join(f.input.repoRoot,'new-output')},{desktopSourceCommit:'main'}])await assert.rejects(()=>prepareWorktestPackage({...f.input,...patch},f.options));
 await assert.rejects(()=>fs.stat(f.input.output),{code:'ENOENT'});
 const bytes=Buffer.from(JSON.stringify({...f.manifest,sharedTestCopy:{...f.manifest.sharedTestCopy,database:'LIVE'}}));await fs.writeFile(f.input.runtimeManifestPath,bytes);await assert.rejects(()=>prepareWorktestPackage({...f.input,runtimeManifestSHA256:sha(bytes)},f.options));
});
test('private extra pin fields, source reparse paths and changes during capture fail closed',async t=>{
 const f=await fixture(t),bytes=Buffer.from(JSON.stringify({...f.pin,password:'PRIVATE_NOT_ALLOWED'}));await fs.writeFile(f.input.runtimePinPath,bytes);await assert.rejects(()=>prepareWorktestPackage({...f.input,runtimePinSHA256:sha(bytes)},f.options));
 const clean=Buffer.from(JSON.stringify(f.pin));await fs.writeFile(f.input.runtimePinPath,clean);const outside=path.join(f.root,'outside-source');await fs.rename(f.source,outside);await fs.symlink(outside,f.source,process.platform==='win32'?'junction':'dir');await assert.rejects(()=>prepareWorktestPackage(f.input,f.options));if(process.platform==='win32')await fs.rmdir(f.source);else await fs.unlink(f.source);await fs.rename(outside,f.source);
 let calls=0;await assert.rejects(()=>prepareWorktestPackage(f.input,{inspectSource:()=>({...f.state,dirty:++calls>1})}));await assert.rejects(()=>fs.stat(f.input.output),{code:'ENOENT'});
});
test('CLI accepts only six explicit pin/stage arguments without arbitrary runtime/env options',()=>{
 const args=['--output','C:\\new-stage','--desktop-source-commit','b'.repeat(40),'--runtime-manifest','C:\\release-manifest.json','--runtime-manifest-sha256','A'.repeat(64),'--runtime-pin','C:\\worktest-package.json','--runtime-pin-sha256','B'.repeat(64)];assert.equal(parseWorktestStageArguments(args).desktopSourceCommit,'b'.repeat(40));
 for(const bad of [args.slice(0,-2),[...args,'--url','http://other'],['--env',...args.slice(1)],['--output','x',...args.slice(0,10)]])assert.throws(()=>parseWorktestStageArguments(bad));
});
test('optional Semih stage includes only credential helper source, fixed public pin and isolated app identity',async t=>{
 const f=await fixture(t),helperRoot=path.join(f.input.repoRoot,'scripts','canonical');await fs.mkdir(helperRoot,{recursive:true});
 for(const name of ['semih-test-local-credential.mjs','semih-test-credential.ps1'])await fs.writeFile(path.join(helperRoot,name),'// CODE ONLY '+name+'\n');
 const bytes=Buffer.from(JSON.stringify({...f.pin,semihTestEntry:{identityPath:semihIdentityPath,identitySHA256:'c'.repeat(64)}}));await fs.writeFile(f.input.runtimePinPath,bytes);
 const result=await prepareWorktestPackage({...f.input,runtimePinSHA256:sha(bytes)},f.options);assert.equal(result.appId,'com.melisababy.erp.semihworktest');assert.equal(result.credentialsIncluded,false);assert.equal(result.servicesStarted,0);
 assert.equal(result.files.length,worktestSourceFiles.length+4);assert(result.files.some(f=>f.path==='src/semih-test-local-credential.mjs'));assert(result.files.some(f=>f.path==='src/semih-test-credential.ps1'));
 assert(!result.files.some(f=>f.path.endsWith('.dpapi')||f.path.includes('erp-identity.json')));
 const pkg=JSON.parse(await fs.readFile(path.join(f.input.output,'package.json'),'utf8'));assert.equal(pkg.build.appId,result.appId);assert.equal(pkg.build.asar,false);
});
