// One immutable derivative of the sealed f5 package. No npm, service, SQL or
// native-module execution; loading the binding remains a separate owner probe.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

export const NATIVE_SQL_PACKAGE=Object.freeze({
 sourceRoot:'C:\\Sirket\\ERP\\releases\\CANONICAL-COMPLETE-TEST-20261011-f5f672c',
 sourceCommit:'f5f672c439972b287f77ddd2c7750fa0c6369e87',
 sourceManifestSha256:'0e119c7256f8e34290973cd0e4c627e992906eb2641cf06fd830f853525af653',
 donorRoot:'C:\\Sirket\\ERP\\releases\\CANONICAL-COMPLETE-TEST-20261011-7a41f64',
 donorCommit:'7a41f6492273dd1ec0bcb086f820be5575372be8',
 donorManifestSha256:'93bd7814d64bb2092f42994d28285b9a25967d07f0413835d5c139b2872ad778',
 destination:'C:\\Sirket\\ERP\\releases\\CANONICAL-COMPLETE-TEST-20261011-f5f672c-native-ready',
 packageId:'CANONICAL-TEST-f5f672c43997-native-ready',
 declaredFiles:1980,
 binaryPath:'apps/api/node_modules/msnodesqlv8/build/Release/sqlserver.node',
 binarySha256:'f41bc6ba4ed5b0ed52db37a09584f2cfe01be24c3489fb9e033b98cf0116b185',
 modulePath:'apps/api/node_modules/msnodesqlv8/package.json',
 moduleSha256:'5c08510dd2ac1a657ffb1a2f560a710aeb07673ec684000366c3554ceebee33d',
 lockPath:'apps/api/package-lock.json',
 lockSha256:'091702d895de85dcb02e43e88b9dda5113466a2fa17803f06669aa17fc099aec',
 moduleVersion:'5.2.0',expectedNodeVersion:'24.19.0',expectedNodeAbi:137
});
const P=NATIVE_SQL_PACKAGE,sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const fail=code=>{throw Error('NATIVE_SQL_PACKAGE_'+code);};
const check=(v,code)=>{if(!v)fail(code);};
const exact=(o,keys)=>{check(o&&Object.getPrototypeOf(o)===Object.prototype&&Reflect.ownKeys(o).length===keys.length,'SHAPE');for(const key of keys){const d=Object.getOwnPropertyDescriptor(o,key);check(d?.enumerable&&Object.hasOwn(d,'value'),'SHAPE');}};
const hash64=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const relative=value=>typeof value==='string'&&value.length>0&&!/[\\\x00-\x1f<>:"|?*]/.test(value)&&value.split('/').every(s=>s&&s!=='.'&&s!=='..'&&!/[. ]$/.test(s)&&! /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(s));
const full=(root,rel)=>path.win32.join(root,...rel.split('/'));
const parse=bytes=>{try{return JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));}catch{fail('JSON');}};
function rows(manifest){
 check(manifest&&Array.isArray(manifest.files)&&manifest.files.length>0,'MANIFEST');const names=new Set();
 for(const row of manifest.files){exact(row,['path','sha256']);check(relative(row.path)&&hash64(row.sha256)&&row.path.toLowerCase()!=='release-manifest.json'&&!names.has(row.path.toLowerCase()),'MANIFEST_PATH');names.add(row.path.toLowerCase());}
 return names;
}

// Metadata-only contract; the caller below obtains each digest from stable
// regular-file bytes. Tests inject synthetic IO/digests, never a real package.
export function validateNativeSqlRepair(input){
 exact(input,['sourceRoot','donorRoot','destination','sourceManifest','sourceManifestSha256','donorManifest','donorManifestSha256','sourceModule','donorModule','sourceLock','donorLock','binarySha256']);
 check(input.sourceRoot===P.sourceRoot&&input.donorRoot===P.donorRoot&&input.destination===P.destination,'ROOT');
 check(input.sourceManifestSha256===P.sourceManifestSha256&&input.donorManifestSha256===P.donorManifestSha256,'MANIFEST_PIN');
 const {sourceManifest:s,donorManifest:d}=input;
 check(s.sourceCommit===P.sourceCommit&&s.packageId==='CANONICAL-TEST-'+P.sourceCommit.slice(0,12)&&!Object.hasOwn(s,'nativeDependencyRepair')&&s.files?.length===P.declaredFiles,'SOURCE');
 check(d.sourceCommit===P.donorCommit&&d.packageId==='CANONICAL-TEST-'+P.donorCommit.slice(0,12),'DONOR');
 const names=rows(s);rows(d);check(!names.has(P.binaryPath.toLowerCase()),'BINARY_EXISTS');
 for(const manifest of [s,d])check(manifest.files.some(row=>row.path===P.lockPath&&row.sha256===P.lockSha256),'LOCK_MANIFEST');
 for(const module of [input.sourceModule,input.donorModule]){exact(module,['value','sha256']);check(module.sha256===P.moduleSha256&&module.value?.name==='msnodesqlv8'&&module.value?.version===P.moduleVersion,'MODULE');}
 for(const lock of [input.sourceLock,input.donorLock]){exact(lock,['value','sha256']);check(lock.sha256===P.lockSha256&&lock.value?.packages?.['node_modules/msnodesqlv8']?.version===P.moduleVersion,'LOCK');}
 check(input.binarySha256===P.binarySha256,'BINARY_PIN');
 return Object.freeze({preservedDeclaredFiles:P.declaredFiles,addedNativeBindings:1});
}

function directory(io,name){
 for(let cursor=name;;cursor=path.win32.dirname(cursor)){
  const stat=io.lstatSync(cursor);check(stat.isDirectory()&&!stat.isSymbolicLink()&&io.realpathSync.native(cursor).toLowerCase()===cursor.toLowerCase(),'REPARSE');
  if(path.win32.dirname(cursor)===cursor)break;
 }
}
function read(io,name,maxBytes=512*1024*1024){
 directory(io,path.win32.dirname(name));const before=io.lstatSync(name);
 check(before.isFile()&&!before.isSymbolicLink()&&before.nlink===1&&before.size<=maxBytes&&io.realpathSync.native(name).toLowerCase()===name.toLowerCase(),'FILE');
 const bytes=io.readFileSync(name),after=io.lstatSync(name);
 check(Buffer.isBuffer(bytes)&&bytes.length===before.size&&after.isFile()&&!after.isSymbolicLink()&&io.realpathSync.native(name).toLowerCase()===name.toLowerCase()&&['dev','ino','size','mtimeMs','nlink'].every(k=>before[k]===after[k]),'FILE_CHANGED');return bytes;
}
function inventory(io,root,digest){
 const files=[],directories=[],seen=new Set();
 const walk=(rel='')=>{const dir=rel?full(root,rel):root;directory(io,dir);for(const entry of io.readdirSync(dir,{withFileTypes:true})){
  const name=rel?rel+'/'+entry.name:entry.name;check(relative(name)&&!entry.isSymbolicLink()&&!seen.has(name.toLowerCase()),'PAYLOAD_PATH');seen.add(name.toLowerCase());
  if(entry.isDirectory()){directories.push(name);walk(name);}else{check(entry.isFile(),'PAYLOAD_TYPE');const bytes=read(io,full(root,name));files.push({path:name,sha256:digest(bytes)});}
 }};walk();files.sort((a,b)=>a.path.localeCompare(b.path,'en'));directories.sort((a,b)=>a.split('/').length-b.split('/').length||a.localeCompare(b,'en'));return {files,directories};
}
const sameRows=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

export function parseNativeSqlPackageArgs(args){check(Array.isArray(args)&&args.length===1&&args[0]==='--prepare','ARGUMENTS');return true;}

// No configurable CLI roots, hashes, source or binary. Failure leaves an
// incomplete new directory for owner review; it never deletes or retries it.
export function prepareNativeSqlPackage(input={}, {io=fs,digest=sha,platform=process.platform}={}){
 exact(input,[]);check(platform==='win32','HOST');
 directory(io,P.sourceRoot);directory(io,P.donorRoot);directory(io,path.win32.dirname(P.destination));check(!io.existsSync(P.destination),'DESTINATION_EXISTS');
 const sourceBytes=read(io,full(P.sourceRoot,'release-manifest.json'),32*1024*1024),donorBytes=read(io,full(P.donorRoot,'release-manifest.json'),32*1024*1024);
 const sourceManifestSha256=digest(sourceBytes),donorManifestSha256=digest(donorBytes);
 check(sourceManifestSha256===P.sourceManifestSha256&&donorManifestSha256===P.donorManifestSha256,'MANIFEST_PIN');
 const sourceManifest=parse(sourceBytes),donorManifest=parse(donorBytes);
 const item=(root,rel)=>{const bytes=read(io,full(root,rel),32*1024*1024);return {value:parse(bytes),sha256:digest(bytes)};};
 const sourceModule=item(P.sourceRoot,P.modulePath),donorModule=item(P.donorRoot,P.modulePath),sourceLock=item(P.sourceRoot,P.lockPath),donorLock=item(P.donorRoot,P.lockPath);
 const binary=read(io,full(P.donorRoot,P.binaryPath)),binarySha256=digest(binary);
 validateNativeSqlRepair({sourceRoot:P.sourceRoot,donorRoot:P.donorRoot,destination:P.destination,sourceManifest,sourceManifestSha256,donorManifest,donorManifestSha256,sourceModule,donorModule,sourceLock,donorLock,binarySha256});
 check(!io.existsSync(full(P.sourceRoot,P.binaryPath)),'BINARY_EXISTS');
 const original=inventory(io,P.sourceRoot,digest),payload=original.files.filter(r=>r.path!=='release-manifest.json'),byName=new Map(payload.map(r=>[r.path,r]));
 for(const row of sourceManifest.files)check(byName.get(row.path)?.sha256===row.sha256,'DECLARED_FILE');
 const declared=new Set(sourceManifest.files.map(r=>r.path));for(const row of payload)check(declared.has(row.path)||/^apps\/(?:api|web-admin|sites-workflow)\/node_modules\//.test(row.path),'UNDECLARED_PAYLOAD');
 check(!payload.some(row=>row.path.toLowerCase()===P.binaryPath.toLowerCase()),'BINARY_EXISTS');
 const copied=[];io.mkdirSync(P.destination);directory(io,P.destination);
 for(const rel of original.directories){const target=full(P.destination,rel);directory(io,path.win32.dirname(target));io.mkdirSync(target);directory(io,target);}
 const write=(rel,value,expected)=>{const target=full(P.destination,rel);directory(io,path.win32.dirname(target));io.writeFileSync(target,value,{flag:'wx'});check(digest(read(io,target))===expected,'COPY');};
 for(const row of payload){const value=read(io,full(P.sourceRoot,row.path));check(digest(value)===row.sha256,'SOURCE_CHANGED');write(row.path,value,row.sha256);copied.push({...row});}
 for(const rel of ['apps/api/node_modules/msnodesqlv8/build','apps/api/node_modules/msnodesqlv8/build/Release'])if(!io.existsSync(full(P.destination,rel))){directory(io,path.win32.dirname(full(P.destination,rel)));io.mkdirSync(full(P.destination,rel));}
 check(digest(read(io,full(P.donorRoot,P.binaryPath)))===P.binarySha256,'DONOR_CHANGED');write(P.binaryPath,binary,P.binarySha256);
 const repair={schemaVersion:'melisa-native-sql-dependency-repair.v1',kind:'PINNED_BINARY_ADDITION',sourcePackage:{packageRoot:P.sourceRoot,sourceCommit:P.sourceCommit,manifestSha256:P.sourceManifestSha256},binarySource:{packageRoot:P.donorRoot,sourceCommit:P.donorCommit,manifestSha256:P.donorManifestSha256,path:P.binaryPath,sha256:P.binarySha256},module:'msnodesqlv8',moduleVersion:P.moduleVersion,modulePackageSha256:P.moduleSha256,apiPackageLockSha256:P.lockSha256,expectedNodeVersion:P.expectedNodeVersion,expectedNodeAbi:P.expectedNodeAbi,preservedDeclaredFiles:P.declaredFiles,addedDeclaredFiles:1,preservedPayloadFiles:payload.length,payloadInventorySha256:digest(Buffer.from(JSON.stringify(payload))),nativeBindingLoaded:false};
 const manifest={...sourceManifest,packageId:P.packageId,nativeDependencyRepair:repair,files:[...sourceManifest.files,{path:P.binaryPath,sha256:P.binarySha256}]};
 check(sameRows(inventory(io,P.sourceRoot,digest),original),'SOURCE_CHANGED');
 check(digest(read(io,full(P.donorRoot,'release-manifest.json')))===P.donorManifestSha256&&item(P.donorRoot,P.modulePath).sha256===P.moduleSha256&&item(P.donorRoot,P.lockPath).sha256===P.lockSha256,'DONOR_CHANGED');
 copied.push({path:P.binaryPath,sha256:P.binarySha256});copied.sort((a,b)=>a.path.localeCompare(b.path,'en'));check(sameRows(inventory(io,P.destination,digest).files,copied),'COPY_INVENTORY');
 const manifestBytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n'),manifestSha256=digest(manifestBytes);write('release-manifest.json',manifestBytes,manifestSha256);
 return Object.freeze({packageRoot:P.destination,sourceCommit:P.sourceCommit,manifestSha256,declaredFiles:manifest.files.length,preservedDeclaredFiles:P.declaredFiles,preservedPayloadFiles:payload.length,addedNativeBindings:1,nativeBindingLoaded:false,installed:false});
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{parseNativeSqlPackageArgs(process.argv.slice(2));console.log(JSON.stringify(prepareNativeSqlPackage()));}
 catch(error){console.error(/^NATIVE_SQL_PACKAGE_[A-Z_]+$/.test(error?.message??'')?error.message:'NATIVE_SQL_PACKAGE_FAILED');process.exitCode=1;}
}
