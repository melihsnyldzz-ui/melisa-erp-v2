import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import http from 'node:http';
import childProcess from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

test('preload blocks real network, subprocess and protected reads before dispatch',()=>{
 const fence=globalThis[Symbol.for('melisa.warehouse.offlineFence')];
 assert.equal(fence?.state,'PROCESS_NETWORK_AND_SECRET_READ_FENCE');
 const blocked=fn=>assert.throws(fn,{code:'WAREHOUSE_OFFLINE_BLOCKED'});
 blocked(()=>net.connect({host:'127.0.0.1',port:51433}));
 blocked(()=>http.get('http://127.0.0.1:4294/'));
 blocked(()=>globalThis.fetch('http://127.0.0.1:4294/'));
 blocked(()=>childProcess.execFileSync('never-start-this-broker'));
 blocked(()=>fs.readFileSync('C:/synthetic/private/example.json'));
 blocked(()=>fs.readFileSync('C:/synthetic/warehouse.dpapi'));
 blocked(()=>fs.openSync('C:/synthetic/protected-personas/example.json','r'));
 blocked(()=>fs.readFileSync('private/example.json'));
 blocked(()=>fs.readFileSync('protected-personas/example.json'));
 blocked(()=>fs.readdirSync('protected-personas'));
 blocked(()=>fs.readFileSync('C:/synthetic/warehouse.dpapi::$DATA'));
 blocked(()=>fs.readFileSync('C:/synthetic/private./example.json'));
 blocked(()=>fs.read(999999,Buffer.alloc(1),0,1,0,()=>{}));
 blocked(()=>fs.readSync(999999,Buffer.alloc(1),0,1,0));
 blocked(()=>fs.readv(999999,[Buffer.alloc(1)],0,()=>{}));
 blocked(()=>fs.readvSync(999999,[Buffer.alloc(1)],0));
 const counts=fence.snapshot();
 assert.ok(counts.network>=3);
 assert.ok(counts.process>=1);
 assert.ok(counts.protectedRead>=12);
});

test('descriptor reads require a guarded public open and stop again after close',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'melisa-wh-public-'));
 const file=path.join(directory,'fixture.txt');
 let descriptor;
 try{
  fs.writeFileSync(file,'PUBLIC_SYNTHETIC_FIXTURE',{flag:'wx'});
  descriptor=fs.openSync(file,'r');
  assert.equal(fs.readSync(descriptor,Buffer.alloc(1),0,1,0),1);
  const closed=descriptor;
  fs.closeSync(descriptor);descriptor=undefined;
  assert.throws(()=>fs.readSync(closed,Buffer.alloc(1),0,1,0),{code:'WAREHOUSE_OFFLINE_BLOCKED'});
 }finally{
  if(descriptor!==undefined)fs.closeSync(descriptor);
  fs.unlinkSync(file);fs.rmdirSync(directory);
 }
});
