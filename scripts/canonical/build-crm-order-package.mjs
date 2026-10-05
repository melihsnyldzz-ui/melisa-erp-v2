import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export const CRM_ORDER_PACKAGE = Object.freeze({repository:'https://github.com/melihsnyldzz-ui/melisa-erp-v2.git',database:'MELISA_ERP_SIRKET_TEST_20260929_01',purpose:'crm-order-draft-only',port:62404,manifest:'release-manifest.json'});
// Exact official v5.2.0 release asset, independently checked against GitHub's
// published digest. Neither cache names nor caller-supplied hashes are authority.
export const CRM_NATIVE_DEPENDENCY = Object.freeze({name:'msnodesqlv8',version:'5.2.0',runtime:'node',abi:'137',platform:'win32',arch:'x64',assetId:428095421,artifactUrl:'https://github.com/TimelordUK/node-sqlserver-v8/releases/download/v5.2.0/msnodesqlv8-v5.2.0-node-v137-win32-x64.tar.gz',artifactSize:551409,artifactSha256:'67c366ce167096e8267e12b49b791902ef81b63649dbb18ad0dbf9824ef857ac',npmResolved:'https://registry.npmjs.org/msnodesqlv8/-/msnodesqlv8-5.2.0.tgz',npmIntegrity:'sha512-kSZnvGNo21EGon3HIZ9xkWTh9ndzkdKmfSLj4kKiam2ZqSN7c+ifcTRUpTq5hX8SZiVOlOzWWZFc6aYrxFEHUQ==',memberPath:'build/Release/sqlserver.node',binaryPath:'apps/api/node_modules/msnodesqlv8/build/Release/sqlserver.node',binarySize:1338368,binarySha256:'eb33a36bda5bd1f996d7282ba04ef3428a9d7c40e069f497580f56b784619581'});
export const CRM_PACKAGE_IMPORT_SMOKE="for (const name of ['bcrypt','express','mssql','mssql/msnodesqlv8.js']) { const m=await import(name); if(!m.default)throw Error('IMPORT_FAILED'); }";
const required=['apps/api/package.json','apps/api/package-lock.json','apps/api/canonical-test-env.mjs','apps/api/canonical-test-network.mjs','apps/api/start-crm-order-test.mjs','apps/api/src/routes/authRoutes.js','apps/api/src/routes/testCrmOrderRoutes.mjs','apps/api/src/services/testCrmOrderContract.mjs','apps/api/src/services/testCrmOrderService.mjs','apps/api/src/services/crmOrderTestRoutePolicy.mjs','apps/api/src/services/openingPriceService.js','apps/api/src/services/operationQuarantineService.js'];
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const blob=bytes=>crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`),bytes])).digest('hex');
const fail=code=>{throw Object.assign(new Error(code),{code});};
const hex=(value,n=64)=>typeof value==='string'&&new RegExp(`^[a-f0-9]{${n}}$`).test(value);
const samePath=(a,b)=>process.platform==='win32'?path.resolve(a).toLowerCase()===path.resolve(b).toLowerCase():path.resolve(a)===path.resolve(b);
const within=(root,value)=>{const relative=path.relative(root,value);return relative===''||!path.isAbsolute(relative)&&relative!=='..'&&!relative.startsWith('..'+path.sep);};
const keys=(value,expected)=>value&&typeof value==='object'&&!Array.isArray(value)&&JSON.stringify(Object.keys(value).sort())===JSON.stringify([...expected].sort());
export function safeCrmPackagePath(value){return typeof value==='string'&&value.length>0&&value.length<=500&&!/[\\<>:"|?*\u0000-\u001f\u007f]/.test(value)&&!value.startsWith('/')&&value.split('/').every(part=>part&&part!=='.'&&part!=='..'&&!/[ .]$/.test(part)&&!/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part));}
const emnapiRuntimePrefix='apps/api/node_modules/@emnapi/runtime/';
const privatePath=(value,lockedRuntime=false)=>value.split('/').some((part,index)=>!(lockedRuntime&&index===4&&value.startsWith(emnapiRuntimePrefix))&&/^(?:\.git|\.env(?:\..*)?|\.npmrc|\.netrc|runtime|logs|backups|uploads|credentials\.json|runtime-private\.json)$/i.test(part))||/\.(?:pem|key|p12|pfx|db|sqlite3?|log|bak)$/i.test(value);
export function crmPackageSourcePath(value){return safeCrmPackagePath(value)&&!privatePath(value)&&!/(?:^|\/)(?:tests?|__tests__)(?:\/|$)|\.test\.[^.]+$/i.test(value)&&(/^apps\/api\/(?:package(?:-lock)?\.json|canonical-test-(?:env|network)\.mjs|start-crm-order-test\.mjs)$/.test(value)||/^apps\/api\/src\/.+\.(?:js|mjs|json)$/.test(value)||/^packages\/shared\/(?:package\.json|src\/.+\.(?:js|mjs|json))$/.test(value));}
const payloadPath=value=>crmPackageSourcePath(value)||safeCrmPackagePath(value)&&!privatePath(value,true)&&/^apps\/api\/node_modules\/.+/.test(value);
function ancestors(directory){if(!path.isAbsolute(directory))fail('CRM_PACKAGE_ABSOLUTE_PATH_REQUIRED');let current=path.resolve(directory);while(true){const stat=fs.lstatSync(current);if(!stat.isDirectory()||stat.isSymbolicLink()||!samePath(fs.realpathSync.native(current),current))fail('CRM_PACKAGE_REPARSE_REJECTED');const parent=path.dirname(current);if(parent===current)break;current=parent;}}
function regular(root,relative){if(!safeCrmPackagePath(relative))fail('CRM_PACKAGE_PATH_REJECTED');const absolute=path.resolve(root,relative);if(!within(root,absolute)||samePath(root,absolute))fail('CRM_PACKAGE_PATH_REJECTED');ancestors(path.dirname(absolute));const stat=fs.lstatSync(absolute);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||!samePath(fs.realpathSync.native(absolute),absolute))fail('CRM_PACKAGE_LINK_REJECTED');return{absolute,stat};}
function publicBytes(name,bytes,lockedRuntime=false){if(privatePath(name,lockedRuntime))fail('CRM_PACKAGE_PRIVATE_FILE_REJECTED');if(!/\.(?:[cm]?js|json|html|css|md|txt|ya?ml|map)$/i.test(name))return;const value=bytes.toString('utf8');if(/-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{36,}|\bgithub_pat_[A-Za-z0-9_]{50,}|\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}|\bAKIA[A-Z0-9]{16}\b/.test(value))fail('CRM_PACKAGE_SECRET_REJECTED');}
// Read committed Git objects as raw Buffers, without archive/export attributes or
// working-tree line-ending conversion. The object hash is checked before export.
export function exportCrmPackageSources(root,entries,readBlob){
 ancestors(root);if(fs.readdirSync(root).length)fail('CRM_PACKAGE_SOURCE_DESTINATION_NOT_EMPTY');
 if(!Array.isArray(entries)||!entries.length||entries.length>100000||typeof readBlob!=='function')fail('CRM_PACKAGE_SOURCE_REJECTED');
 const names=new Set();for(const row of entries){if(!keys(row,['path','gitBlob'])||!crmPackageSourcePath(row.path)||!hex(row.gitBlob,40)||names.has(row.path.toLowerCase()))fail('CRM_PACKAGE_SOURCE_REJECTED');names.add(row.path.toLowerCase());}
 let total=0;for(const row of entries){const bytes=readBlob(row.gitBlob);if(!Buffer.isBuffer(bytes)||bytes.length>32*1024**2||(total+=bytes.length)>2*1024**3)fail('CRM_PACKAGE_SOURCE_BYTES_REJECTED');if(blob(bytes)!==row.gitBlob)fail('CRM_PACKAGE_SOURCE_HASH_MISMATCH');publicBytes(row.path,bytes);
 const target=path.resolve(root,row.path);if(!within(root,target)||samePath(root,target))fail('CRM_PACKAGE_PATH_REJECTED');fs.mkdirSync(path.dirname(target),{recursive:true});ancestors(path.dirname(target));fs.writeFileSync(target,bytes,{flag:'wx',mode:0o644});if(blob(fs.readFileSync(regular(root,row.path).absolute))!==row.gitBlob)fail('CRM_PACKAGE_SOURCE_HASH_MISMATCH');}
 return entries.length;
}
export function inventoryCrmPackage(root,{projection=false}={}){
 ancestors(root);const rows=[],names=new Set(),lockedRuntime=!projection&&verifyEmnapiRuntimeIdentity(root);let total=0;
 function walk(directory,relative=''){for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const name=relative?`${relative}/${entry.name}`:entry.name;if(!safeCrmPackagePath(name)||names.has(name.toLowerCase()))fail('CRM_PACKAGE_PATH_REJECTED');names.add(name.toLowerCase());const absolute=path.join(root,name),stat=fs.lstatSync(absolute);if(stat.isSymbolicLink()||!samePath(fs.realpathSync.native(absolute),absolute))fail('CRM_PACKAGE_REPARSE_REJECTED');if(stat.isDirectory()){walk(absolute,name);continue;}const file=regular(root,name);if(name===CRM_ORDER_PACKAGE.manifest&&!projection)continue;if(!projection&&!payloadPath(name))fail('CRM_PACKAGE_PAYLOAD_REJECTED');const bytes=fs.readFileSync(file.absolute);if(!projection)publicBytes(name,bytes,lockedRuntime);total+=file.stat.size;if(rows.length>=100000||total>2*1024**3)fail('CRM_PACKAGE_SIZE_REJECTED');rows.push({path:name,size:bytes.length,sha256:hash(bytes)});}}
 walk(root);return rows.sort((a,b)=>a.path.localeCompare(b.path,'en'));
}
export function validateCrmPackageLock(lock,manifest){
 if(lock?.lockfileVersion!==3||!lock.packages||!lock.packages['']||lock.name!==manifest?.name)fail('CRM_PACKAGE_LOCK_REJECTED');
 for(const field of ['dependencies','devDependencies','optionalDependencies'])if(JSON.stringify(Object.entries(lock.packages[''][field]||{}).sort())!==JSON.stringify(Object.entries(manifest[field]||{}).sort()))fail('CRM_PACKAGE_LOCK_MISMATCH');
 for(const [name,row]of Object.entries(lock.packages)){if(!name)continue;if(!safeCrmPackagePath(name)||!name.startsWith('node_modules/')||row.link||typeof row.version!=='string'||!/^https:\/\/registry\.npmjs\.org\/[^\s]+$/.test(row.resolved||'')||!/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(row.integrity||''))fail('CRM_PACKAGE_LOCK_REJECTED');}return true;
}
// This scoped dependency is named "runtime"; it is not a private runtime folder.
// Only its exact package root is exempt, after binding its metadata to the lock.
function verifyEmnapiRuntimeIdentity(root){
 if(!fs.existsSync(path.join(root,emnapiRuntimePrefix)))return false;
 let lock,api,pkg;try{lock=JSON.parse(fs.readFileSync(regular(root,'apps/api/package-lock.json').absolute));api=JSON.parse(fs.readFileSync(regular(root,'apps/api/package.json').absolute));pkg=JSON.parse(fs.readFileSync(regular(root,emnapiRuntimePrefix+'package.json').absolute));}catch{fail('CRM_PACKAGE_RUNTIME_DEPENDENCY_REJECTED');}
 validateCrmPackageLock(lock,api);const row=lock.packages['node_modules/@emnapi/runtime'];if(!row||pkg.name!=='@emnapi/runtime'||pkg.version!==row.version||row.resolved!==`https://registry.npmjs.org/@emnapi/runtime/-/runtime-${row.version}.tgz`)fail('CRM_PACKAGE_RUNTIME_DEPENDENCY_REJECTED');return true;
}
export function validateCrmNativeLock(lock,pkg){
 const row=lock?.packages?.['node_modules/msnodesqlv8'],pin=CRM_NATIVE_DEPENDENCY;
 if(!row||row.link||row.version!==pin.version||row.resolved!==pin.npmResolved||row.integrity!==pin.npmIntegrity||pkg?.name!==pin.name||pkg.version!==pin.version)fail('CRM_PACKAGE_NATIVE_LOCK_REJECTED');return true;
}
// Parse only the one regular USTAR member supplied by the pinned publisher.
// Synthetic tests exercise this pure decoder; create always checks both pins.
export function extractCrmNativeMember(archive){
 if(!Buffer.isBuffer(archive)||archive.length<18||archive.length>2*1024**2)fail('CRM_PACKAGE_NATIVE_ARCHIVE_REJECTED');
 let bytes;try{bytes=gunzipSync(archive,{maxOutputLength:16*1024**2});}catch{fail('CRM_PACKAGE_NATIVE_ARCHIVE_REJECTED');}
 if(bytes.length<1536||bytes.length%512)fail('CRM_PACKAGE_NATIVE_ARCHIVE_REJECTED');const header=bytes.subarray(0,512);
 function field(start,end){const raw=header.subarray(start,end),zero=raw.indexOf(0),value=zero<0?raw:raw.subarray(0,zero);if(zero>=0&&raw.subarray(zero).some(byte=>byte!==0))fail('CRM_PACKAGE_NATIVE_ARCHIVE_REJECTED');return value.toString('ascii');}
 const number=(start,end)=>{const value=header.subarray(start,end).toString('ascii').replace(/\0/g,'').trim();if(!/^[0-7]+$/.test(value))fail('CRM_PACKAGE_NATIVE_ARCHIVE_REJECTED');return parseInt(value,8);};
 const checksum=number(148,156);let actual=0;for(let i=0;i<512;i++)actual+=i>=148&&i<156?32:header[i];
 if(checksum!==actual||!header.subarray(257,265).equals(Buffer.from([117,115,116,97,114,0,48,48]))||field(0,100)!==CRM_NATIVE_DEPENDENCY.memberPath||field(345,500)!==''||field(157,257)!==''||header[156]!==48)fail('CRM_PACKAGE_NATIVE_ARCHIVE_REJECTED');
 const size=number(124,136),end=512+Math.ceil(size/512)*512;if(!Number.isSafeInteger(size)||size<=0||size>8*1024**2||end+1024>bytes.length||bytes.subarray(512+size,end).some(byte=>byte!==0)||bytes.subarray(end).some(byte=>byte!==0))fail('CRM_PACKAGE_NATIVE_ARCHIVE_REJECTED');return Buffer.from(bytes.subarray(512,512+size));
}
export function validateCrmNativeProvenance(value,files){
 const pin=CRM_NATIVE_DEPENDENCY;if(!keys(value,Object.keys(pin))||Object.entries(pin).some(([key,expected])=>value[key]!==expected))fail('CRM_PACKAGE_NATIVE_PROVENANCE_REJECTED');
 const binary=files?.find(row=>row.path===pin.binaryPath);if(!binary||binary.size!==pin.binarySize||binary.sha256!==pin.binarySha256||!files.some(row=>row.path==='apps/api/node_modules/msnodesqlv8/package.json'))fail('CRM_PACKAGE_NATIVE_BINARY_REJECTED');return true;
}
export function verifiedCrmNativeBinary(archive){
 const pin=CRM_NATIVE_DEPENDENCY;if(!Buffer.isBuffer(archive)||archive.length!==pin.artifactSize||hash(archive)!==pin.artifactSha256)fail('CRM_PACKAGE_NATIVE_ARTIFACT_HASH_MISMATCH');const bytes=extractCrmNativeMember(archive);if(bytes.length!==pin.binarySize||hash(bytes)!==pin.binarySha256)fail('CRM_PACKAGE_NATIVE_BINARY_HASH_MISMATCH');return bytes;
}
function materializeCrmNativeDependency(root,artifact,lock){
 const pin=CRM_NATIVE_DEPENDENCY;if(process.platform!==pin.platform||process.arch!==pin.arch||process.versions.modules!==pin.abi)fail('CRM_PACKAGE_NATIVE_TARGET_REJECTED');
 if(!path.isAbsolute(artifact||''))fail('CRM_PACKAGE_NATIVE_ARTIFACT_REQUIRED');const source=regular(path.dirname(artifact),path.basename(artifact));if(source.stat.size!==pin.artifactSize)fail('CRM_PACKAGE_NATIVE_ARTIFACT_HASH_MISMATCH');const archive=fs.readFileSync(source.absolute);
 const pkg=JSON.parse(fs.readFileSync(regular(root,'apps/api/node_modules/msnodesqlv8/package.json').absolute));validateCrmNativeLock(lock,pkg);const bytes=verifiedCrmNativeBinary(archive);
 const target=path.resolve(root,pin.binaryPath);if(!within(root,target)||samePath(root,target))fail('CRM_PACKAGE_PATH_REJECTED');fs.mkdirSync(path.dirname(target),{recursive:true});ancestors(path.dirname(target));fs.writeFileSync(target,bytes,{flag:'wx',mode:0o644});if(hash(fs.readFileSync(regular(root,pin.binaryPath).absolute))!==pin.binarySha256)fail('CRM_PACKAGE_NATIVE_BINARY_HASH_MISMATCH');return{...pin};
}
export function resolveCrmPackageNpm(node=process.execPath){for(const file of [path.join(path.dirname(node),'node_modules/npm/bin/npm-cli.js'),path.resolve(path.dirname(node),'../lib/node_modules/npm/bin/npm-cli.js')])if(fs.existsSync(file)&&fs.lstatSync(file).isFile())return file;fail('CRM_PACKAGE_NPM_REQUIRED');}
export function crmPackageBuildEnvironment(parent,userConfig,globalConfig){
 if(!path.isAbsolute(userConfig)||!path.isAbsolute(globalConfig)||samePath(userConfig,globalConfig))fail('CRM_PACKAGE_NPM_CONFIG_REJECTED');
 const env={};for(const name of ['SystemRoot','WINDIR','ComSpec','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA','HOME'])if(parent[name])env[name]=parent[name];
 env.PATH=[path.dirname(process.execPath),...(process.platform==='win32'?[path.join(parent.SystemRoot||'C:/Windows','System32')]:['/usr/bin','/bin'])].join(path.delimiter);
 return {...env,NODE_ENV:'production',npm_config_userconfig:userConfig,npm_config_globalconfig:globalConfig,npm_config_offline:'true',npm_config_ignore_scripts:'true',npm_config_audit:'false',npm_config_fund:'false',npm_config_update_notifier:'false',npm_config_bin_links:'false'};
}
// Published dotenv16.6.1 README examples contain a private-key placeholder.
// Omit only those two non-runtime documents; scanner and runtime files stay strict.
export function projectCrmRuntimeDocumentation(root,lock){
 if(lock.packages?.['node_modules/dotenv']?.version!=='16.6.1')return [];
 const files=['apps/api/node_modules/dotenv/README.md','apps/api/node_modules/dotenv/README-es.md'].map(name=>{const file=regular(root,name),bytes=fs.readFileSync(file.absolute);return{path:name,size:bytes.length,sha256:hash(bytes),absolute:file.absolute};});
 for(const file of files){const now=regular(root,file.path);if(now.stat.size!==file.size||hash(fs.readFileSync(now.absolute))!==file.sha256)fail('CRM_PACKAGE_PROJECTION_CHANGED');}
 for(const file of files)fs.unlinkSync(file.absolute);return files.map(({absolute,...evidence})=>evidence);
}
export function validateCrmPackageManifest(manifest){
 if(!keys(manifest,['schemaVersion','packageId','sourceCommit','sourceTree','sourceRepository','purpose','database','port','createdAtUtc','node','dependencyInstall','lockSha256','sourceFiles','files',...(manifest?.schemaVersion===2?['nativeDependency']:[])])||![1,2].includes(manifest.schemaVersion)||manifest.sourceRepository!==CRM_ORDER_PACKAGE.repository||!hex(manifest.sourceCommit,40)||!hex(manifest.sourceTree,40)||!/^CRM-ORDER-DRAFT-TEST-[A-Za-z0-9-]{1,100}$/.test(manifest.packageId)||manifest.purpose!==CRM_ORDER_PACKAGE.purpose||manifest.database!==CRM_ORDER_PACKAGE.database||manifest.port!==62404||!Number.isFinite(Date.parse(manifest.createdAtUtc))||manifest.dependencyInstall!=='npm-ci-offline-ignore-scripts'||!hex(manifest.lockSha256))fail('CRM_PACKAGE_MANIFEST_REJECTED');
 if(!keys(manifest.node,['version','platform','arch','sha256'])||manifest.node.version!==process.version||manifest.node.platform!==process.platform||manifest.node.arch!==process.arch||!hex(manifest.node.sha256))fail('CRM_PACKAGE_NODE_REJECTED');
 if(!Array.isArray(manifest.files)||manifest.files.length<required.length||manifest.files.length>100000||!Array.isArray(manifest.sourceFiles))fail('CRM_PACKAGE_MANIFEST_FILES_REJECTED');
 const names=new Set(),exactNames=new Set(),sources=new Set();for(const row of manifest.files){if(!keys(row,['path','size','sha256'])||!payloadPath(row.path)||names.has(row.path.toLowerCase())||!Number.isSafeInteger(row.size)||row.size<0||!hex(row.sha256))fail('CRM_PACKAGE_MANIFEST_FILES_REJECTED');names.add(row.path.toLowerCase());exactNames.add(row.path);}
 for(const row of manifest.sourceFiles){if(!keys(row,['path','gitBlob'])||!crmPackageSourcePath(row.path)||!hex(row.gitBlob,40)||sources.has(row.path)||!exactNames.has(row.path))fail('CRM_PACKAGE_SOURCE_REJECTED');sources.add(row.path);}
 for(const row of manifest.files)if(crmPackageSourcePath(row.path)&&!sources.has(row.path))fail('CRM_PACKAGE_SOURCE_REJECTED');
 for(const name of [...required,'apps/api/node_modules/bcrypt/package.json','apps/api/node_modules/express/package.json','apps/api/node_modules/mssql/package.json'])if(!names.has(name.toLowerCase()))fail('CRM_PACKAGE_REQUIRED_FILE_MISSING');if(manifest.schemaVersion===2){validateCrmNativeProvenance(manifest.nativeDependency,manifest.files);if(process.platform!==CRM_NATIVE_DEPENDENCY.platform||process.arch!==CRM_NATIVE_DEPENDENCY.arch||process.versions.modules!==CRM_NATIVE_DEPENDENCY.abi)fail('CRM_PACKAGE_NATIVE_TARGET_REJECTED');}return manifest;
}
export function verifyCrmOrderPackage({packageRoot,manifestSha256,nodePath=process.execPath}){
 if(!path.isAbsolute(packageRoot||'')||typeof manifestSha256!=='string'||!/^[a-fA-F0-9]{64}$/.test(manifestSha256))fail('CRM_PACKAGE_VERIFY_ARGUMENTS_REJECTED');ancestors(packageRoot);
 const file=regular(packageRoot,CRM_ORDER_PACKAGE.manifest),bytes=fs.readFileSync(file.absolute);if(bytes.length>16*1024**2||hash(bytes)!==manifestSha256.toLowerCase())fail('CRM_PACKAGE_MANIFEST_HASH_MISMATCH');
 let value;try{value=JSON.parse(bytes);}catch{fail('CRM_PACKAGE_MANIFEST_REJECTED');}const manifest=validateCrmPackageManifest(value);
 if(!samePath(nodePath,process.execPath)||hash(fs.readFileSync(nodePath))!==manifest.node.sha256)fail('CRM_PACKAGE_NODE_MISMATCH');
 const actual=inventoryCrmPackage(packageRoot);if(JSON.stringify(actual)!==JSON.stringify([...manifest.files].sort((a,b)=>a.path.localeCompare(b.path,'en'))))fail('CRM_PACKAGE_PAYLOAD_HASH_MISMATCH');
 for(const row of manifest.sourceFiles)if(blob(fs.readFileSync(regular(packageRoot,row.path).absolute))!==row.gitBlob)fail('CRM_PACKAGE_SOURCE_HASH_MISMATCH');
 const lockBytes=fs.readFileSync(regular(packageRoot,'apps/api/package-lock.json').absolute);if(hash(lockBytes)!==manifest.lockSha256)fail('CRM_PACKAGE_LOCK_MISMATCH');validateCrmPackageLock(JSON.parse(lockBytes),JSON.parse(fs.readFileSync(regular(packageRoot,'apps/api/package.json').absolute)));
 if(manifest.schemaVersion===2)validateCrmNativeLock(JSON.parse(lockBytes),JSON.parse(fs.readFileSync(regular(packageRoot,'apps/api/node_modules/msnodesqlv8/package.json').absolute)));
 return{packageId:manifest.packageId,sourceCommit:manifest.sourceCommit,sourceRepository:manifest.sourceRepository,purpose:manifest.purpose,database:manifest.database,port:manifest.port,manifestSha256:manifestSha256.toLowerCase(),files:actual.length};
}
function run(command,args,options,code){try{return execFileSync(command,args,{maxBuffer:32*1024**2,...options});}catch{fail(code);}}
export function createCrmOrderPackage({destination,sourceCommit,nativeArtifact,repoRoot=fileURLToPath(new URL('../../',import.meta.url))}){
 if(!path.isAbsolute(destination||'')||!hex(sourceCommit,40)||fs.existsSync(destination))fail('CRM_PACKAGE_NEW_DESTINATION_REQUIRED');ancestors(repoRoot);
 if(!path.isAbsolute(nativeArtifact||''))fail('CRM_PACKAGE_NATIVE_ARTIFACT_REQUIRED');if(process.platform!==CRM_NATIVE_DEPENDENCY.platform||process.arch!==CRM_NATIVE_DEPENDENCY.arch||process.versions.modules!==CRM_NATIVE_DEPENDENCY.abi)fail('CRM_PACKAGE_NATIVE_TARGET_REJECTED');
 const git=args=>run('git',['-C',repoRoot,...args],{encoding:'utf8'},'CRM_PACKAGE_GIT_FAILED').trim();
 if(git(['remote','get-url','origin'])!==CRM_ORDER_PACKAGE.repository||git(['remote','get-url','--push','origin'])!==CRM_ORDER_PACKAGE.repository||git(['rev-parse','HEAD'])!==sourceCommit||git(['status','--porcelain'])||!git(['branch','--show-current'])||git(['branch','--show-current'])==='main')fail('CRM_PACKAGE_SOURCE_IDENTITY_REJECTED');
 const common=path.resolve(repoRoot,git(['rev-parse','--git-common-dir'])),canonical=path.dirname(common),releases=path.resolve(canonical,'..','releases');ancestors(releases);
 if(!samePath(path.dirname(destination),releases)||within(canonical,destination)||!/^CRM-ORDER-DRAFT-TEST-[A-Za-z0-9-]{1,100}$/.test(path.basename(destination)))fail('CRM_PACKAGE_DESTINATION_REJECTED');
 const tree=git(['rev-parse',`${sourceCommit}^{tree}`]),entries=git(['ls-tree','-r','-z',sourceCommit,'--','apps/api','packages/shared']).split('\0').filter(Boolean).map(line=>{const match=/^(\d+) blob ([a-f0-9]{40})\t(.+)$/.exec(line);if(!match||match[1]!=='100644'&&match[1]!=='100755'||!safeCrmPackagePath(match[3]))fail('CRM_PACKAGE_GIT_ENTRY_REJECTED');if(privatePath(match[3])&&match[3]!=='apps/api/.env.example')fail('CRM_PACKAGE_PRIVATE_SOURCE_REJECTED');return{path:match[3],gitBlob:match[2]};});
 const selected=entries.filter(row=>crmPackageSourcePath(row.path));for(const name of required)if(!selected.some(row=>row.path===name))fail('CRM_PACKAGE_REQUIRED_SOURCE_MISSING');
 const scratch=path.join(releases,`.crm-order-build-${crypto.randomUUID()}`),payload=path.join(scratch,'payload');fs.mkdirSync(payload,{recursive:true});
 exportCrmPackageSources(payload,selected,gitBlob=>run('git',['-C',repoRoot,'cat-file','blob',gitBlob],{},'CRM_PACKAGE_GIT_BLOB_FAILED'));
 const api=path.join(payload,'apps/api'),lockBytes=fs.readFileSync(path.join(api,'package-lock.json')),lock=JSON.parse(lockBytes);validateCrmPackageLock(lock,JSON.parse(fs.readFileSync(path.join(api,'package.json'))));
 const userConfig=path.join(scratch,'user-empty.npmrc'),globalConfig=path.join(scratch,'global-empty.npmrc');fs.writeFileSync(userConfig,'',{flag:'wx'});fs.writeFileSync(globalConfig,'',{flag:'wx'});const env=crmPackageBuildEnvironment(process.env,userConfig,globalConfig);
 run(process.execPath,[resolveCrmPackageNpm(),'ci','--offline','--ignore-scripts','--no-audit','--no-fund','--omit=dev','--bin-links=false'],{cwd:api,env},'CRM_PACKAGE_OFFLINE_INSTALL_FAILED');
 const nativeDependency=materializeCrmNativeDependency(payload,nativeArtifact,lock);
 run(process.execPath,['--input-type=module','-e',CRM_PACKAGE_IMPORT_SMOKE],{cwd:api,env},'CRM_PACKAGE_IMPORT_SMOKE_FAILED');
 projectCrmRuntimeDocumentation(payload,lock);
 const files=inventoryCrmPackage(payload),manifest={schemaVersion:2,packageId:path.basename(destination),sourceCommit,sourceTree:tree,sourceRepository:CRM_ORDER_PACKAGE.repository,purpose:CRM_ORDER_PACKAGE.purpose,database:CRM_ORDER_PACKAGE.database,port:62404,createdAtUtc:new Date().toISOString(),node:{version:process.version,platform:process.platform,arch:process.arch,sha256:hash(fs.readFileSync(process.execPath))},dependencyInstall:'npm-ci-offline-ignore-scripts',lockSha256:hash(lockBytes),nativeDependency,sourceFiles:selected.sort((a,b)=>a.path.localeCompare(b.path,'en')),files};validateCrmPackageManifest(manifest);
 // Exclusive destination reservation and exclusive file copies prevent overwrite.
 fs.mkdirSync(destination);for(const row of files){const target=path.join(destination,row.path);fs.mkdirSync(path.dirname(target),{recursive:true});ancestors(path.dirname(target));fs.copyFileSync(regular(payload,row.path).absolute,target,fs.constants.COPYFILE_EXCL);fs.chmodSync(target,0o444);}
 const manifestBytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n');fs.writeFileSync(path.join(destination,CRM_ORDER_PACKAGE.manifest),manifestBytes,{flag:'wx',mode:0o444});
 const result=verifyCrmOrderPackage({packageRoot:destination,manifestSha256:hash(manifestBytes)});
 if(!within(releases,scratch)||samePath(releases,scratch)||!/^\.crm-order-build-[a-f0-9-]{36}$/.test(path.basename(scratch)))fail('CRM_PACKAGE_SCRATCH_PATH_REJECTED');
 inventoryCrmPackage(scratch,{projection:true});fs.rmSync(scratch,{recursive:true});return result;
}
if(process.argv[1]&&samePath(process.argv[1],fileURLToPath(import.meta.url))){
 try{const [mode,...args]=process.argv.slice(2),options={};if(args.length%2)fail('CRM_PACKAGE_ARGUMENTS_REJECTED');for(let i=0;i<args.length;i+=2){if(!['--destination','--source-commit','--native-artifact','--package-root','--manifest-sha256'].includes(args[i])||options[args[i]])fail('CRM_PACKAGE_ARGUMENTS_REJECTED');options[args[i]]=args[i+1];}let result;if(mode==='create'&&Object.keys(options).sort().join()===['--destination','--source-commit','--native-artifact'].sort().join())result=createCrmOrderPackage({destination:options['--destination'],sourceCommit:options['--source-commit'],nativeArtifact:options['--native-artifact']});else if(mode==='verify'&&Object.keys(options).sort().join()===['--package-root','--manifest-sha256'].sort().join())result=verifyCrmOrderPackage({packageRoot:options['--package-root'],manifestSha256:options['--manifest-sha256']});else fail('CRM_PACKAGE_ARGUMENTS_REJECTED');console.log(JSON.stringify(result));}catch(error){console.error(JSON.stringify({error:error.code||'CRM_PACKAGE_FAILED'}));process.exitCode=1;}
}
