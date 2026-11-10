// Offline package/read-source regression. Never runs the packager's real main,
// native setup executor, Windows window, driver, private store or SQL.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {EMPTY_V7_PROFILE_ID,EMPTY_V7_PUBLIC_PATH,EMPTY_V7_PUBLIC_BINDING_TEXT} from '../../apps/api/src/config/desktopEmptyV7Profile.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const builder=new URL('./build-master-v7-package.mjs',import.meta.url);
const migration='apps/api/scripts/vega-native-migration-store.mjs',fixture='scripts/canonical/fixtures/night-20261006-before.json';
const sha=b=>createHash('sha256').update(b).digest('hex');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
async function packageFixture(){
 const writes=new Map(),context=vm.createContext({Buffer,URL,process:{argv:['node',fileURLToPath(builder),'--prepare-empty-db9-candidate-only'],stdout:{write(){}}}});
 const virtual='C:/Sirket/ERP/melisa-erp-v2/.git/codex-worktrees/offline-package-fixture';
 const ownRead=file=>{assert(file.startsWith(virtual+'/'));return path.join(root,file.slice(virtual.length+1));};
 const web=virtual+'/apps/sites-workflow/dist-desktop-write-green/',assets=new Map([[web+'desktop-write-green.html','<script src="/assets/fixture.js"></script><link href="/assets/fixture.css">'],[web+'assets/fixture.js','offline asset'],[web+'assets/fixture.css','offline style']]);
 const fixtureRead=(f,encoding)=>assets.has(f)?(encoding?assets.get(f):Buffer.from(assets.get(f))):fs.readFileSync(ownRead(f),encoding);
 const fixtureStat=f=>assets.has(f)?{isFile:()=>true,isSymbolicLink:()=>false}:fs.lstatSync(ownRead(f));
 const modules={
  'node:crypto':{createHash},'node:path':{default:{...path,dirname:path.posix.dirname,resolve:(...parts)=>path.posix.normalize(parts.join('/'))}},'node:url':{fileURLToPath:()=>virtual+'/scripts/desktop-empty/build-master-v7-package.mjs'},
  'node:fs':{readFileSync:fixtureRead,readdirSync:(f,...a)=>fs.readdirSync(ownRead(f),...a),lstatSync:fixtureStat,existsSync:()=>false,mkdirSync(){},writeFileSync(f,b,o){assert.equal(o.flag,'wx');assert(!writes.has(f));writes.set(f,Buffer.from(b));}},
  'node:child_process':{execFileSync(exe,args){assert.equal(exe,'C:/Program Files/Git/cmd/git.exe');const tail=args.slice(3).join(' ');if(tail==='remote get-url origin')return 'https://github.com/melihsnyldzz-ui/melisa-erp-v2.git';if(tail==='status --porcelain')return '';assert.equal(tail,'rev-parse HEAD');return '4b63698854f42fb3fc13fda95881294a7c6b6154';}},
  './sql-login-runtime-integrity.mjs':{inspectDesktopRuntimeTree:()=>({sha256:'8acf2de20977d03c01b5e9ec467274b411a9029851ec34989f6040a8c4b4e346',entryCount:11623})},
  '../../apps/api/src/services/desktopFinalCancellationExportFence.mjs':{DESKTOP_FINAL_CANCELLATION_EXPORT_BINDING_TEXT:'unused legacy fixture'},
  '../../apps/api/src/config/desktopEmptyV7Profile.mjs':{EMPTY_V7_PROFILE_ID,EMPTY_V7_PUBLIC_PATH,EMPTY_V7_PUBLIC_BINDING_TEXT},
 };
 // BuildRoot's source provenance is mocked, not bypassed in production. The
 // actual builder source still enumerates and hashes real repository inputs.
 const source=read('scripts/desktop-empty/build-master-v7-package.mjs');
 const module=new vm.SourceTextModule(source,{context,identifier:builder.href,initializeImportMeta(meta){meta.url=builder.href;}});
 await module.link(specifier=>{assert(Object.hasOwn(modules,specifier),specifier);const values=modules[specifier];return new vm.SyntheticModule(Object.keys(values),function(){for(const [k,v]of Object.entries(values))this.setExport(k,v);},{context});});
 await module.evaluate();
 const candidate=[...writes.entries()].find(([f])=>f.endsWith('/master-v7-empty-db9-candidate-package.4b63698854f42fb3fc13fda95881294a7c6b6154.json'));
 assert(candidate);assert.equal(writes.size,2);assert(!writes.has('C:/Users/Xaser/Desktop/ERP/kurulum/master-v7-empty-db9-candidate-package.json'));return JSON.parse(candidate[1]);
}
function stage(pkg,omit,corrupt){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'melisa-v7-source-closure-'));
 // Module-format metadata only, matching the staged API's existing ESM format.
 fs.writeFileSync(path.join(dir,'package.json'),'{"type":"module"}\n');
 for(const [name,digest]of Object.entries(pkg.sources)){
  const bytes=fs.readFileSync(path.join(root,name));assert.equal(sha(bytes),digest);
  if(name===omit)continue;const file=path.join(dir,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,name===corrupt?Buffer.concat([bytes,Buffer.from('\nchanged')]):bytes);
 }
 return dir;
}
async function stagedCore(dir){return import(pathToFileURL(path.join(dir,'scripts/desktop-empty/empty-v7-setup-core.mjs')).href);}
async function runLoop(source,context){const m=new vm.SourceTextModule(source,{context});await m.link(()=>{throw Error('UNEXPECTED_IMPORT');});return m.evaluate();}
function cleanup(dir){const absolute=path.resolve(dir);assert.equal(path.dirname(absolute),path.resolve(os.tmpdir()));assert(path.basename(absolute).startsWith('melisa-v7-source-closure-'));fs.rmSync(absolute,{recursive:true,force:true});}
test('real passive builder payload imports and compiles first setup in an isolated staged source tree',async()=>{
 const pkg=await packageFixture();for(const name of [migration,fixture])assert.equal(pkg.sources[name],sha(fs.readFileSync(path.join(root,name))));
 const dir=stage(pkg);
 try{const core=await stagedCore(dir),plan=core.compileEmptyV7FirstSetup({adminPid:12345,adminSidHex:'0x01050000000000051500000011223344'});assert.equal(plan.kind,'EMPTY_V7_FIRST_SETUP_PREVIEW');assert.equal(plan.executionAuthorized,false);assert.equal(plan.requiresHumanSave,true);assert.equal(plan.target.databaseId,9);assert.equal(plan.sha256,sha(plan.sql));assert.equal(core.EMPTY_V7_SETUP_TABLES.length,43);}finally{cleanup(dir);}
});
test('either missing native catalog source rejects staged import; changed pinned source is not accepted',async()=>{
 const pkg=await packageFixture();
 for(const name of [migration,fixture]){
  const missing=stage(pkg,name);try{await assert.rejects(()=>stagedCore(missing),e=>e.code==='ENOENT');}finally{cleanup(missing);}
  const changed=stage(pkg,undefined,name);try{await assert.rejects(()=>stagedCore(changed),/DESKTOP_CATALOG_SOURCE_HASH_REJECTED/);}finally{cleanup(changed);}
 }
});
test('setup and worker source-key loops permit only the exact catalog JSON fixture',async()=>{
 const local=read('scripts/desktop-empty/empty-v7-setup-local.mjs'),worker=read('scripts/desktop-empty/start-master-v7-worker.mjs');
 const localLoop=local.slice(local.indexOf(' for(const [rel,sha]of Object.entries'),local.indexOf(' const owner=host(decision);'));
 const workerLoop=worker.slice(worker.indexOf(' for(const [name,digest] of Object.entries(pkg.sources))'),worker.indexOf(' const {openDesktopMasterV7TlsConnector'));
 for(const name of [fixture,'scripts/canonical/fixtures/other.json','scripts/canonical/fixtures/../night-20261006-before.json']){
  const valid=name===fixture,context=vm.createContext({pkg:{sources:{[name]:'digest'},helpers:{}},runtime:'fixture',root:'fixture',check(ok){if(!ok)throw Error('SOURCE_KEY');},hold(){},hash:()=> 'digest',readFile:async()=>Buffer.from('fixture')});
  if(valid){vm.runInContext(localLoop,context);await runLoop(workerLoop,context);}
  else{assert.throws(()=>vm.runInContext(localLoop,context),/SOURCE_KEY/);await assert.rejects(()=>runLoop(workerLoop,context));}
 }
 const window=read('scripts/desktop-empty/empty-v7-setup-window.ps1');assert(window.includes("-and$entry.Key-cne'"+fixture+"'"));assert(!window.includes('\\.(mjs|js|sql|ps1|json)'));
});
