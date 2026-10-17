import test from 'node:test';
import assert from 'node:assert/strict';
import {runPinnedNpm} from './package-npm.mjs';

const node='C:\\Sirket\\ERP\\tools\\node-v24.19.0\\node.exe';
const npmCmd='C:\\Program Files\\nodejs\\npm.cmd';
const npmCli='C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js';

test('npm install and build use the selected Node even when npm.cmd belongs to another Node installation',()=>{
 const calls=[];
 const execFileSync=(file,args,options)=>{calls.push({file,args,options});return file==='where.exe'?npmCmd+'\r\n':'';};
 const env={Path:'C:\\Program Files\\nodejs;C:\\Windows\\System32',VITE_API_BASE_URL:'http://127.0.0.1:4144'};
 const deps={execFileSync,existsSync:file=>file===npmCli,nodeExecPath:node,platform:'win32'};
 runPinnedNpm(['ci','--no-audit'],'C:\\candidate\\apps\\api',env,deps);
 runPinnedNpm(['run','build'],'C:\\candidate\\apps\\sites-workflow',env,deps);
 assert.equal(calls.length,4);
 for(const call of [calls[1],calls[3]]){
  assert.equal(call.file,node);
  assert.equal(call.args[0],npmCli);
  assert.equal(call.options.env.Path,'C:\\Sirket\\ERP\\tools\\node-v24.19.0;'+env.Path);
  assert.equal(call.options.env.VITE_API_BASE_URL,env.VITE_API_BASE_URL);
  assert.equal(call.options.windowsHide,true);
 }
 assert.deepEqual(calls[1].args.slice(1),['ci','--no-audit']);
 assert.deepEqual(calls[3].args.slice(1),['run','build']);
 assert.equal(env.Path,'C:\\Program Files\\nodejs;C:\\Windows\\System32');
});

test('missing npm CLI fails before package install or build',()=>{
 const calls=[];
 const execFileSync=(file,args)=>{calls.push({file,args});return npmCmd+'\r\n';};
 assert.throws(()=>runPinnedNpm(['ci'],'C:\\candidate',{}, {execFileSync,existsSync:()=>false,nodeExecPath:node,platform:'win32'}),/PACKAGE_NPM_CLI_NOT_FOUND/);
 assert.equal(calls.length,1);
});
