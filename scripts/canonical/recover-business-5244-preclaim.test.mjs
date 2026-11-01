import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import cp from 'node:child_process';
const directory=import.meta.dirname;
for(const culture of ['tr-TR','en-US'])test(`Retained recovery actual shared preclaim and status contract under PS5.1 ${culture}`,{skip:process.platform!=='win32'},t=>{
 const parent=fs.realpathSync.native(process.env.RUNNER_TEMP||os.tmpdir());
 const temporary=fs.realpathSync.native(fs.mkdtempSync(path.join(parent,'b6-preclaim-')));
 try{
  const results=[];
  // Keep the existing 20s child budget. Partition the complete case set,
  // rather than extending a timeout or skipping slower failure paths.
  for(let group=0;group<4;group++){
   const target=path.join(temporary,`b6-preclaim-group-${group}`);fs.mkdirSync(target);
   const output=cp.execFileSync(path.join(process.env.SystemRoot??'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-File',path.join(directory,'recover-business-5244-preclaim.fixture.ps1'),'-Culture',culture,'-SourceDirectory',directory,'-TempRoot',target,'-Group',String(group)],{encoding:'utf8',windowsHide:true,timeout:20000,maxBuffer:1024*1024});
   const result=JSON.parse(output.trim());results.push(result);
   assert.equal(result.culture,culture);assert.match(result.psVersion,/^5\.1\./);assert.equal(result.group,group);assert.equal(result.failed,0);assert.equal(result.positiveGroupBaseline,true);
   assert.equal(result.sharedContract,'Open-B6RetainedRecoveryPreclaim');assert.equal(result.realRuntimeCalls,0);
  }
  const names=results.flatMap(r=>r.cases);assert.equal(new Set(names).size,names.length);assert.equal(names.length,results[0].totalCases);
  assert.equal(results.reduce((n,r)=>n+r.positive,0),3);assert(results.reduce((n,r)=>n+r.negative,0)>=75);assert.equal(results.reduce((n,r)=>n+r.statusCases,0),13);
  assert.equal(results[0].realLibraryVisibleAfterPreclaim,true);
  t.diagnostic(`${culture}: ${names.length} shared preclaim cases (${results.reduce((n,r)=>n+r.positive,0)} positive/${results.reduce((n,r)=>n+r.negative,0)} exact-code negative), 4 positive group baselines, 13 status cases, actual held library visibility; runtime calls 0`);
 }finally{
  assert.equal(fs.realpathSync.native(temporary),temporary);assert.equal(path.dirname(temporary),parent);assert(path.basename(temporary).startsWith('b6-preclaim-'));assert(!fs.lstatSync(temporary).isSymbolicLink());
  fs.rmSync(temporary,{recursive:true,force:true});
 }
});
