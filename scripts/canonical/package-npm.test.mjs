import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runPinnedNpm} from './package-npm.mjs';

const node='C:\\Sirket\\ERP\\tools\\node-v24.19.0\\node.exe';
const npmCmd='C:\\Program Files\\nodejs\\npm.cmd';
const npmCli='C:\\Sirket\\ERP\\tools\\node-v24.19.0\\node_modules\\npm\\bin\\npm-cli.js';

test('npm install and build use the selected Node and its own CLI even when PATH has another Node installation',()=>{
 const calls=[];
 const execFileSync=(file,args,options)=>{calls.push({file,args,options});};
 const env={Path:'C:\\Program Files\\nodejs;C:\\Windows\\System32',VITE_API_BASE_URL:'http://127.0.0.1:4144'};
 const deps={execFileSync,existsSync:file=>file===npmCli,statSync:()=>({isFile:()=>true}),nodeExecPath:node,platform:'win32'};
 runPinnedNpm(['ci','--no-audit'],'C:\\candidate\\apps\\api',env,deps);
 runPinnedNpm(['run','build'],'C:\\candidate\\apps\\sites-workflow',env,deps);
 assert.equal(calls.length,2);
 for(const call of calls){
  assert.equal(call.file,node);
  assert.equal(call.args[0],npmCli);
  assert.equal(call.options.env.Path,'C:\\Sirket\\ERP\\tools\\node-v24.19.0;'+env.Path);
  assert.equal(call.options.env.VITE_API_BASE_URL,env.VITE_API_BASE_URL);
  assert.equal(call.options.windowsHide,true);
 }
 assert.deepEqual(calls[0].args.slice(1),['ci','--no-audit']);
 assert.deepEqual(calls[1].args.slice(1),['run','build']);
 assert.equal(env.Path,'C:\\Program Files\\nodejs;C:\\Windows\\System32');
});

test('missing npm CLI fails before package install or build',()=>{
 const calls=[];
 const execFileSync=(file,args)=>{calls.push({file,args});};
 assert.throws(()=>runPinnedNpm(['ci'],'C:\\candidate',{}, {execFileSync,existsSync:()=>false,nodeExecPath:node,platform:'win32'}),/PACKAGE_NPM_CLI_NOT_FOUND/);
 assert.equal(calls.length,0);
});

test('selected Node own npm CLI works without discovering any global npm.cmd',()=>{
 const localCli='C:\\Sirket\\ERP\\tools\\node-v24.19.0\\node_modules\\npm\\bin\\npm-cli.js',calls=[];
 runPinnedNpm(['ci'],'C:\\candidate',{}, {nodeExecPath:node,platform:'win32',existsSync:file=>file===localCli,statSync:()=>({isFile:()=>true}),execFileSync:(file,args,options)=>{assert.equal(file,node,'global discovery must not run');calls.push({file,args,options});}});
 assert.equal(calls.length,1);assert.deepEqual(calls[0].args,[localCli,'ci']);
});

test('injected Windows target always uses a semicolon even with a POSIX host path delimiter',async()=>{
 const syntheticPath='data:text/javascript;base64,'+Buffer.from("import path from 'node:path';export default {...path,delimiter:':'};").toString('base64');
 const source=(await readFile(new URL('./package-npm.mjs',import.meta.url),'utf8')).replace("import path from 'node:path';",'import path from '+JSON.stringify(syntheticPath)+';');
 const {runPinnedNpm:simulated}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64')),calls=[];
 simulated(['ci'],'C:\\candidate',{Path:'C:\\Windows\\System32'},{nodeExecPath:node,platform:'win32',existsSync:()=>true,statSync:()=>({isFile:()=>true}),execFileSync:(file,args,options)=>{if(file==='where.exe')return npmCmd;calls.push({file,args,options});}});
 assert.equal(calls[0].options.env.Path,'C:\\Sirket\\ERP\\tools\\node-v24.19.0;C:\\Windows\\System32');
});
