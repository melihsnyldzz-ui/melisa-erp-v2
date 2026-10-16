import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {HISTORICAL_WEB_BASELINE as pin,HISTORICAL_WEB_FILES as pinned,parseWebBaselineArgs,validateHistoricalWebBaseline,copyHistoricalWebBaseline} from './web-build-baseline.mjs';
import {parseTerminalArtifactArgs,TERMINAL_APK_PATH,TERMINAL_APK_SHA256} from './public-terminal-artifact.mjs';
import {resolveCopyBuildTarget} from './copy-build-target.mjs';

const prefix='apps/web-admin/dist-baseline-proof/',destination='C:\\Sirket\\ERP\\releases\\CANONICAL-COMPLETE-TEST-20261011-1234567';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const expected=()=>pinned.map(row=>({...row,kind:'web',rebuildSha256:row.sha256}));
function fixture(){
 const manifest={sourceCommit:pin.sourceCommit,packageId:'CANONICAL-TEST-'+pin.sourceCommit.slice(0,12),baselineReproduced:true,files:pinned.map(row=>({path:prefix+row.path,sha256:row.sha256}))};
 const model={packageRoot:pin.root,manifestSha256:pin.manifestSha256,manifest,expected:expected(),files:pinned.map(row=>({...row}))};
 const nodes=new Map(),digests=new Map(),writes=[];let inode=0;
 function addDir(name){if(nodes.has(name))return;const parent=path.win32.dirname(name);if(parent!==name)addDir(parent);nodes.set(name,{directory:true,ino:++inode,size:0,nlink:1,dev:1,mtimeMs:1});}
 function addFile(name,content){addDir(path.win32.dirname(name));nodes.set(name,{content:Buffer.from(content),ino:++inode,size:content.length,nlink:1,dev:1,mtimeMs:1});}
 function fail(code){throw Object.assign(Error(code),{code});}
 addDir(pin.root);addDir(path.win32.join(destination,'apps','web-admin'));
 const manifestBytes=Buffer.from(JSON.stringify(manifest));addFile(path.win32.join(pin.root,'release-manifest.json'),manifestBytes);digests.set(hash(manifestBytes),pin.manifestSha256);
 for(const [index,row]of pinned.entries()){const bytes=Buffer.alloc(row.bytes,index+1);addFile(path.win32.join(pin.root,...(prefix+row.path).split('/')),bytes);digests.set(hash(bytes),row.sha256);}
 const realpath=name=>{const node=nodes.get(name);if(!node)fail('ENOENT');return node.realpath??name;};realpath.native=realpath;
 const io={realpathSync:realpath,existsSync:name=>nodes.has(name),lstatSync:name=>{const n=nodes.get(name);if(!n)fail('ENOENT');return {...n,isDirectory:()=>n.directory===true,isFile:()=>!n.directory,isSymbolicLink:()=>n.link===true};},readFileSync:name=>{const n=nodes.get(name);if(!n||n.directory)fail('ENOENT');const bytes=Buffer.from(n.content);n.afterRead?.(n);return bytes;},mkdirSync:name=>{if(nodes.has(name))fail('EEXIST');if(!nodes.get(path.win32.dirname(name))?.directory)fail('ENOENT');addDir(name);writes.push(name);},writeFileSync:(name,bytes,options)=>{assert.deepEqual(options,{flag:'wx'});if(nodes.has(name))fail('EEXIST');addFile(name,bytes);writes.push(name);}};
 return {model,nodes,writes,io,digest:bytes=>digests.get(hash(bytes))??hash(bytes),run:()=>copyHistoricalWebBaseline({destination,expected:model.expected},{io,digest:bytes=>digests.get(hash(bytes))??hash(bytes),platform:'win32'})};
}

test('baseline option is explicit closed duplicate-free and preserves every existing copy flag',()=>{
 assert.deepEqual(parseWebBaselineArgs(),{historical:false,remaining:[]});
 for(const copy of ['--stage4-copy','--shared-test-copy','--business-test-copy']){
  assert.deepEqual(parseWebBaselineArgs([copy]),{historical:false,remaining:[copy]});
  assert.deepEqual(parseWebBaselineArgs(['--historical-web-baseline',copy]),{historical:true,remaining:[copy]});
 }
 for(const input of [['--historical-web-baseline','--historical-web-baseline'],['--historical-web-baseline=true'],['--historical-web-baseline','true'],['--historical-web-baseline','C:\\other'],['--unknown'],['--business-test-copy','--shared-test-copy'],['--business-test-copy','--business-test-copy'],null,{},['--historical-web-baseline',null]])assert.throws(()=>parseWebBaselineArgs(input),/ARGUMENTS_REJECTED/);
});

test('historical option composes with the unchanged approved APK parser and DB02 copy target',()=>{
 const terminal=parseTerminalArtifactArgs(['--historical-web-baseline','--business-test-copy','--terminal-apk-path',TERMINAL_APK_PATH,'--terminal-apk-sha256',TERMINAL_APK_SHA256]);
 const baseline=parseWebBaselineArgs(terminal.remaining),copy=resolveCopyBuildTarget(baseline.remaining);
 assert.equal(baseline.historical,true);assert.deepEqual(terminal.artifact,{file:TERMINAL_APK_PATH,sha256:TERMINAL_APK_SHA256});assert.equal(copy.database,'MELISA_ERP_CRM_SHARED_TEST_20261009_02');assert.equal(copy.dist,'dist-business');
});

test('historical proof binds the literal source manifest and four documentation hashes separately from current output',()=>{
 const f=fixture(),before=structuredClone(f.model),result=validateHistoricalWebBaseline(f.model);
 assert.deepEqual(f.model,before);assert(Object.isFrozen(result));assert.deepEqual(result,{baselineMode:'PINNED_HISTORICAL',baselineSourceCommit:pin.sourceCommit,baselineManifestSha256:pin.manifestSha256,baselineArtifactDirectory:prefix.slice(0,-1)});assert.equal(Object.hasOwn(result,'currentWebSourceCommit'),false);
 const document=JSON.parse(fs.readFileSync(new URL('../../docs/erp-v2/canonical-20261003/web-rebuild-proof.json',import.meta.url),'utf8'));
 assert.deepEqual(document.files.map(({path,bytes,sha256})=>({path,bytes,sha256})),pinned);
});

test('historical proof rejects wrong package source sha path and unverified baseline',()=>{
 for(const change of [f=>f.packageRoot+='-other',f=>f.packageRoot=f.packageRoot.toUpperCase(),f=>f.manifestSha256='a'.repeat(64),f=>f.manifest.sourceCommit='b'.repeat(40),f=>f.manifest.packageId+='-other',f=>f.manifest.baselineReproduced=false,f=>f.manifest.files=null]){const f=fixture().model;change(f);assert.throws(()=>validateHistoricalWebBaseline(f),/PACKAGE_REJECTED/);}
});

test('historical proof rejects wrong missing duplicate or aliased manifest artifact metadata',()=>{
 for(const change of [f=>f.manifest.files[0].sha256='0'.repeat(64),f=>f.manifest.files.pop(),f=>f.manifest.files.push({...f.manifest.files[0]}),f=>f.manifest.files[0].path=f.manifest.files[0].path.toUpperCase(),f=>f.manifest.files[0].path=prefix+'../index.html',f=>f.files[0].bytes--,f=>f.files[0].sha256='0'.repeat(64),f=>f.files.push({...f.files[0]}),f=>f.expected[0].sha256='0'.repeat(64),f=>f.expected[0].rebuildSha256='0'.repeat(64),f=>f.expected[0].bytes++,f=>f.expected.pop(),f=>f.expected[0].kind='other']){const f=fixture().model;change(f);assert.throws(()=>validateHistoricalWebBaseline(f),/FILES_REJECTED|FILE_PIN_REJECTED/);}
});

test('historical loader copies verified fixture bytes exclusively without writing to its immutable source',()=>{
 const f=fixture(),before=new Map([...f.nodes].map(([name,node])=>[name,node.content&&hash(node.content)])),result=f.run();
 assert.equal(result.baselineMode,'PINNED_HISTORICAL');assert.equal(f.writes.length,6);assert(f.writes.every(name=>name.startsWith(destination+'\\')));
 for(const [name,digest]of before)if(digest)assert.equal(hash(f.nodes.get(name).content),digest);
 for(const row of pinned)assert.deepEqual(f.nodes.get(path.win32.join(destination,...(prefix+row.path).split('/'))).content,f.nodes.get(path.win32.join(pin.root,...(prefix+row.path).split('/'))).content);
 assert.throws(()=>f.run(),/DESTINATION_REJECTED/);assert.equal(f.writes.length,6);
});

test('historical loader rejects wrong root platform and destination before any source read or write',()=>{
 const io=new Proxy({},{get(){throw Error('UNEXPECTED_IO');}});
 for(const args of [{destination,expected:expected(),packageRoot:pin.root+'-other'},{destination:pin.root,expected:expected()},{destination:'C:\\other',expected:expected()},{destination:destination+'\\..',expected:expected()}])assert.throws(()=>copyHistoricalWebBaseline(args,{io,platform:'win32'}),/PACKAGE_REJECTED|DESTINATION_REJECTED/);
 assert.throws(()=>copyHistoricalWebBaseline({destination,expected:expected()},{io,platform:'linux'}),/PACKAGE_REJECTED/);
});

test('historical loader rejects source or destination ancestor junctions aliases and hardlinks',()=>{
 const files=[pin.root,path.win32.dirname(pin.root),path.win32.join(pin.root,'apps','web-admin','dist-baseline-proof'),path.win32.join(pin.root,'apps','web-admin','dist-baseline-proof','assets'),path.win32.join(destination,'apps')];
 for(const name of files){const f=fixture();f.nodes.get(name).link=true;assert.throws(()=>f.run(),/REPARSE_REJECTED/);assert.equal(f.writes.length,0);}
 for(const kind of ['link','alias','hardlink']){const f=fixture(),node=f.nodes.get(path.win32.join(pin.root,...(prefix+pinned[0].path).split('/')));if(kind==='link')node.link=true;if(kind==='alias')node.realpath='C:\\elsewhere';if(kind==='hardlink')node.nlink=2;assert.throws(()=>f.run(),/FILE_REJECTED/);assert.equal(f.writes.length,0);}
});

test('historical loader rejects changed bytes identity or manifest before creating any candidate artifact',()=>{
 for(const kind of ['manifest','bytes','identity']){const f=fixture(),name=kind==='manifest'?path.win32.join(pin.root,'release-manifest.json'):path.win32.join(pin.root,...(prefix+pinned[0].path).split('/')),node=f.nodes.get(name);if(kind==='identity')node.afterRead=n=>{n.ino++;};else node.content[0]^=1;assert.throws(()=>f.run(),/PACKAGE_REJECTED|FILE_PIN_REJECTED|FILE_CHANGED/);assert.equal(f.writes.length,0);}
});

test('historical loader default digest rejects a synthetic manifest even when its metadata claims the trusted source',()=>{
 const f=fixture();assert.throws(()=>copyHistoricalWebBaseline({destination,expected:f.model.expected},{io:f.io,platform:'win32'}),/PACKAGE_REJECTED/);assert.equal(f.writes.length,0);
});

test('historical copy readback rejects output corruption while leaving every source artifact unchanged',()=>{
 const f=fixture(),before=pinned.map(row=>hash(f.nodes.get(path.win32.join(pin.root,...(prefix+row.path).split('/'))).content)),write=f.io.writeFileSync;
 f.io.writeFileSync=(name,bytes,options)=>{write(name,bytes,options);f.nodes.get(name).content[0]^=1;};
 assert.throws(()=>f.run(),/COPY_REJECTED/);assert(f.writes.every(name=>name.startsWith(destination+'\\')));
 assert.deepEqual(pinned.map(row=>hash(f.nodes.get(path.win32.join(pin.root,...(prefix+row.path).split('/'))).content)),before);
});

test('package builder retains default baseline build and exact hash loop and builds current web separately',()=>{
 const code=fs.readFileSync(new URL('./build-package.mjs',import.meta.url),'utf8');
 assert(code.includes("else npm(['run','build','--','--outDir','dist-baseline-proof'],destination+'/apps/web-admin',env);"));
 assert(code.includes("for(const row of expected)if(sha(fs.readFileSync(destination+'/apps/web-admin/dist-baseline-proof/'+row.path))!==row.sha256)throw Error('BASELINE_REBUILD_MISMATCH:'+row.path);"));
 assert(code.indexOf('copyHistoricalWebBaseline({')<code.indexOf("throw Error('BASELINE_REBUILD_MISMATCH:'"));
 assert(code.indexOf("throw Error('BASELINE_REBUILD_MISMATCH:'")<code.indexOf("'dist-test'"));
 assert(code.includes('...(historicalBaseline?{...historicalBaseline,currentWebSourceCommit:sourceCommit}:{})'));assert(code.includes('baselineReproduced:true'));
});
