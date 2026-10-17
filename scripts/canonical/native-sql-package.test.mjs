import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {NATIVE_SQL_PACKAGE as P,validateNativeSqlRepair,prepareNativeSqlPackage,parseNativeSqlPackageArgs} from './native-sql-package.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),full=(root,rel)=>path.win32.join(root,...rel.split('/'));
function fixture(){
 const nodes=new Map(),digests=new Map(),writes=[];let inode=0;
 const addDir=name=>{if(nodes.has(name))return;const parent=path.win32.dirname(name);if(parent!==name)addDir(parent);nodes.set(name,{directory:true,ino:++inode,dev:1,size:0,nlink:1,mtimeMs:1});};
 const addFile=(name,value)=>{addDir(path.win32.dirname(name));const bytes=Buffer.from(value);nodes.set(name,{content:bytes,ino:++inode,dev:1,size:bytes.length,nlink:1,mtimeMs:1});return bytes;};
 const addPinned=(name,value,hash)=>{const bytes=addFile(name,value);digests.set(sha(bytes),hash);return bytes;};
 const moduleValue={name:'msnodesqlv8',version:'5.2.0'},lockValue={name:'@melisa-erp/api',lockfileVersion:3,packages:{'node_modules/msnodesqlv8':{version:'5.2.0'}}};
 for(const root of [P.sourceRoot,P.donorRoot]){addPinned(full(root,P.modulePath),JSON.stringify(moduleValue),P.moduleSha256);addPinned(full(root,P.lockPath),JSON.stringify(lockValue),P.lockSha256);}
 const sourceManifest={packageId:'CANONICAL-TEST-'+P.sourceCommit.slice(0,12),sourceCommit:P.sourceCommit,node:'v24.15.0',builtAt:'2026-10-16T01:00:00.000Z',baselineReproduced:true,baselineMode:'PINNED_HISTORICAL',database:'MELISA_ERP_CRM_SHARED_TEST_20261009_02',files:[{path:P.lockPath,sha256:P.lockSha256}]};
 for(let index=1;index<P.declaredFiles;index++){const name='apps/api/src/fixture-'+String(index).padStart(4,'0')+'.mjs',bytes=addFile(full(P.sourceRoot,name),'export const n='+index+';');sourceManifest.files.push({path:name,sha256:sha(bytes)});}
 const donorManifest={packageId:'CANONICAL-TEST-'+P.donorCommit.slice(0,12),sourceCommit:P.donorCommit,files:[{path:P.lockPath,sha256:P.lockSha256}]};
 addPinned(full(P.sourceRoot,'release-manifest.json'),JSON.stringify(sourceManifest),P.sourceManifestSha256);addPinned(full(P.donorRoot,'release-manifest.json'),JSON.stringify(donorManifest),P.donorManifestSha256);
 addFile(full(P.sourceRoot,'apps/api/node_modules/msnodesqlv8/lib/sqlserver.native.js'),'module.exports = require("../build/Release/sqlserver.node");');
 addPinned(full(P.donorRoot,P.binaryPath),'MZ synthetic ABI137 binding',P.binarySha256);
 const fail=code=>{throw Object.assign(Error(code),{code});},realpath=name=>{const node=nodes.get(name);if(!node)fail('ENOENT');return node.alias??name;};realpath.native=realpath;
 const io={existsSync:name=>nodes.has(name),realpathSync:realpath,
  lstatSync:name=>{const node=nodes.get(name);if(!node)fail('ENOENT');return {...node,isFile:()=>!node.directory,isDirectory:()=>node.directory===true,isSymbolicLink:()=>node.link===true};},
  readFileSync:name=>{const node=nodes.get(name);if(!node||node.directory)fail('ENOENT');const bytes=Buffer.from(node.content);node.reads=(node.reads??0)+1;node.afterRead?.(node);return bytes;},
  readdirSync:(name,options)=>{assert.deepEqual(options,{withFileTypes:true});return [...nodes].filter(([key])=>key!==name&&path.win32.dirname(key)===name).map(([key,node])=>({name:path.win32.basename(key),isFile:()=>!node.directory,isDirectory:()=>node.directory===true,isSymbolicLink:()=>node.link===true}));},
  mkdirSync:name=>{if(nodes.has(name))fail('EEXIST');if(!nodes.get(path.win32.dirname(name))?.directory)fail('ENOENT');addDir(name);writes.push(name);},
  writeFileSync:(name,bytes,options)=>{assert.deepEqual(options,{flag:'wx'});if(nodes.has(name))fail('EEXIST');addFile(name,bytes);writes.push(name);}
 };
 const digest=bytes=>digests.get(sha(bytes))??sha(bytes);
 const model={sourceRoot:P.sourceRoot,donorRoot:P.donorRoot,destination:P.destination,sourceManifest,sourceManifestSha256:P.sourceManifestSha256,donorManifest,donorManifestSha256:P.donorManifestSha256,sourceModule:{value:moduleValue,sha256:P.moduleSha256},donorModule:{value:structuredClone(moduleValue),sha256:P.moduleSha256},sourceLock:{value:lockValue,sha256:P.lockSha256},donorLock:{value:structuredClone(lockValue),sha256:P.lockSha256},binarySha256:P.binarySha256};
 return {nodes,writes,io,digest,model,addFile,addDir,run:()=>prepareNativeSqlPackage({}, {io,digest,platform:'win32'})};
}
const immutable=f=>new Map([...f.nodes].filter(([,n])=>n.content).map(([name,n])=>[name,sha(n.content)]));
const unchanged=(f,before)=>{for(const [name,hash]of before)assert.equal(sha(f.nodes.get(name).content),hash,name);};

test('native repair is one closed explicit prepare command and has no configurable roots',()=>{
 assert.equal(parseNativeSqlPackageArgs(['--prepare']),true);
 for(const args of [[],['--prepare','--prepare'],['--prepare','C:\\other'],['--root'],null,{},['--prepare=true']])assert.throws(()=>parseNativeSqlPackageArgs(args),/ARGUMENTS/);
 const io=new Proxy({},{get(){throw Error('UNEXPECTED_IO');}});
 assert.throws(()=>prepareNativeSqlPackage({}, {io,platform:'linux'}),/HOST/);
 for(const input of [{destination:'C:\\other'},{sourceRoot:P.sourceRoot},null])assert.throws(()=>prepareNativeSqlPackage(input,{io,platform:'win32'}),/SHAPE/);
});

test('metadata binds both immutable manifests exact roots version locks binary and 1980 declared hashes',()=>{
 const f=fixture(),before=structuredClone(f.model),result=validateNativeSqlRepair(f.model);assert.deepEqual(f.model,before);assert(Object.isFrozen(result));assert.deepEqual(result,{preservedDeclaredFiles:1980,addedNativeBindings:1});
 for(const change of [m=>m.sourceRoot+='-other',m=>m.donorRoot=m.donorRoot.toUpperCase(),m=>m.destination+='-other',m=>m.sourceManifestSha256='a'.repeat(64),m=>m.donorManifestSha256='a'.repeat(64),m=>m.sourceManifest.sourceCommit='a'.repeat(40),m=>m.donorManifest.sourceCommit='a'.repeat(40),m=>m.sourceManifest.files.pop(),m=>m.sourceModule.value.version='5.1.0',m=>m.donorModule.sha256='b'.repeat(64),m=>m.sourceLock.value.packages['node_modules/msnodesqlv8'].version='5.1.0',m=>m.donorLock.sha256='b'.repeat(64),m=>m.binarySha256='c'.repeat(64)]){const m=structuredClone(f.model);change(m);assert.throws(()=>validateNativeSqlRepair(m),/NATIVE_SQL_PACKAGE_/);}
});

test('manifest metadata rejects duplicate alias traversal existing binary and missing lock',()=>{
 const f=fixture();for(const change of [m=>m.sourceManifest.files[1]={...m.sourceManifest.files[0]},m=>m.sourceManifest.files[1]={path:P.lockPath.toUpperCase(),sha256:P.lockSha256},m=>m.sourceManifest.files[1].path='../escape',m=>m.sourceManifest.files[1].path='apps/api/NUL.js',m=>m.sourceManifest.files[1].path='apps/api/a:b',m=>m.sourceManifest.files[1].path='apps\\api\\other',m=>m.sourceManifest.files[1].sha256='bad',m=>m.sourceManifest.files[1].path=P.binaryPath,m=>m.sourceManifest.files[0].sha256='a'.repeat(64),m=>m.sourceManifest.nativeDependencyRepair={},m=>m.sourceManifest.files[1].extra=true]){const m=structuredClone(f.model);change(m);assert.throws(()=>validateNativeSqlRepair(m),/NATIVE_SQL_PACKAGE_/);}
});

test('derivative preserves every original payload byte and build field and adds only one declared native file',()=>{
 const f=fixture(),before=immutable(f),result=f.run(),manifest=JSON.parse(f.nodes.get(full(P.destination,'release-manifest.json')).content);
 unchanged(f,before);assert.equal(result.declaredFiles,1981);assert.equal(result.preservedDeclaredFiles,1980);assert.equal(result.addedNativeBindings,1);assert.equal(result.nativeBindingLoaded,false);assert.equal(result.installed,false);assert.equal(result.sourceCommit,P.sourceCommit);
 assert.deepEqual(manifest.files.slice(0,1980),f.model.sourceManifest.files);assert.deepEqual(manifest.files.at(-1),{path:P.binaryPath,sha256:P.binarySha256});
 for(const [key,value]of Object.entries(f.model.sourceManifest))if(!['packageId','files'].includes(key))assert.deepEqual(manifest[key],value,key);
 assert.equal(manifest.packageId,P.packageId);assert.equal(manifest.nativeDependencyRepair.kind,'PINNED_BINARY_ADDITION');assert.equal(manifest.nativeDependencyRepair.expectedNodeAbi,137);assert.equal(manifest.nativeDependencyRepair.nativeBindingLoaded,false);
 for(const [name,node]of f.nodes)if(name.startsWith(P.sourceRoot+'\\')&&node.content&&!name.endsWith('\\release-manifest.json'))assert.deepEqual(f.nodes.get(P.destination+name.slice(P.sourceRoot.length)).content,node.content,name);
 assert.deepEqual(f.nodes.get(full(P.destination,P.binaryPath)).content,f.nodes.get(full(P.donorRoot,P.binaryPath)).content);assert(f.writes.every(name=>name===P.destination||name.startsWith(P.destination+'\\')));
 const writes=f.writes.length;assert.throws(()=>f.run(),/DESTINATION_EXISTS/);assert.equal(f.writes.length,writes);
});

test('real digest rejects synthetic pinned claims before creating a derivative',()=>{
 const f=fixture();assert.throws(()=>prepareNativeSqlPackage({}, {io:f.io,platform:'win32'}),/MANIFEST_PIN/);assert.equal(f.writes.length,0);
});

test('corrupt source manifest dependency metadata lock binary or declared source fails before any write',()=>{
 for(const [root,rel]of [[P.sourceRoot,'release-manifest.json'],[P.donorRoot,'release-manifest.json'],[P.sourceRoot,P.modulePath],[P.donorRoot,P.modulePath],[P.sourceRoot,P.lockPath],[P.donorRoot,P.lockPath],[P.donorRoot,P.binaryPath],[P.sourceRoot,'apps/api/src/fixture-0001.mjs']]){const f=fixture();f.nodes.get(full(root,rel)).content[0]^=1;assert.throws(()=>f.run(),/NATIVE_SQL_PACKAGE_/);assert.equal(f.writes.length,0,rel);}
 for(const rel of [P.binaryPath,'unexpected-private.json']){const f=fixture();f.addFile(full(P.sourceRoot,rel),'unexpected');assert.throws(()=>f.run(),/BINARY_EXISTS|UNDECLARED_PAYLOAD/);assert.equal(f.writes.length,0);}
});

test('source donor and destination ancestors reject reparse aliases and hardlinks before writes',()=>{
 for(const name of [P.sourceRoot,P.donorRoot,path.win32.dirname(P.destination),full(P.sourceRoot,'apps/api/node_modules')]){const f=fixture();f.nodes.get(name).link=true;assert.throws(()=>f.run(),/REPARSE/);assert.equal(f.writes.length,0);}
 for(const kind of ['hardlink','alias','link','changing']){const f=fixture(),node=f.nodes.get(full(P.donorRoot,P.binaryPath));if(kind==='hardlink')node.nlink=2;if(kind==='alias')node.alias='C:\\other';if(kind==='link')node.link=true;if(kind==='changing')node.afterRead=n=>{n.ino++;};assert.throws(()=>f.run(),/FILE/);assert.equal(f.writes.length,0);}
});

test('copy corruption leaves an incomplete new directory and never changes either immutable input',()=>{
 const f=fixture(),before=immutable(f),write=f.io.writeFileSync;f.io.writeFileSync=(name,bytes,options)=>{write(name,bytes,options);f.nodes.get(name).content[0]^=1;};assert.throws(()=>f.run(),/COPY/);unchanged(f,before);assert.equal(f.nodes.has(full(P.destination,'release-manifest.json')),false);assert(f.writes.every(name=>name.startsWith(P.destination)));
});

test('source drift during preparation is rejected and cannot publish a completed manifest',()=>{
 const f=fixture(),file=full(P.sourceRoot,'apps/api/src/fixture-0001.mjs'),node=f.nodes.get(file);node.afterRead=n=>{if(n.reads===2)n.content[0]^=1;};assert.throws(()=>f.run(),/SOURCE_CHANGED/);assert.equal(f.nodes.has(full(P.destination,'release-manifest.json')),false);
});
