// One passive immutable derivative. No installation, SQL, credentials, task or host API.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import cp from 'node:child_process';import {pathToFileURL} from 'node:url';
import {runPinnedNpm} from './package-npm.mjs';
export const TEST125_CATALOG_PACKAGE=Object.freeze({
 base:'C:/Sirket/ERP/releases/CANONICAL-STAGE04-TEST-20261009-125',
 baseCommit:'edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d',
 baseManifest:'6fc93edbed59083155e43d8f70e43889e07dae77165d6a078ed172e85d0b9d00',
 component:'0a22177889268a00772ea25aa0b2a9f1578e4d64',
 destination:'C:/Sirket/ERP/releases/CANONICAL-TEST125-CATALOG-COMPAT-20261027-0a221778',
 evidence:'C:/Sirket/ERP/evidence/ERP-GREENCOMBINED-APIWEB-PREFLIGHT-20261026/private/business-catalog-20261027',
 database:'MELISA_ERP_SIRKET_TEST_20260929_01',
 overlays:['apps/api/src/services/currentProductCatalogContext.mjs','apps/sites-workflow/src/workflow/currentProductCatalogModel.mjs'],
 logger:'apps/api/src/utils/logger.js'
});
const P=TEST125_CATALOG_PACKAGE,sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const check=(ok,code)=>{if(!ok)throw Error('TEST125_PACKAGE_'+code);};
export function addCatalogLineageDiagnostic(bytes){
 const text=bytes.toString('utf8'),old='PRODUCT_NOT_FOUND PRODUCT_STOCK_CODE_DUPLICATE',next='PRODUCT_NOT_FOUND PRODUCT_PREVIOUS_CATALOG_LINEAGE PRODUCT_STOCK_CODE_DUPLICATE';
 check(text.split(old).length===2&&!text.includes('PRODUCT_PREVIOUS_CATALOG_LINEAGE'),'LOGGER_TEMPLATE');
 return Buffer.from(text.replace(old,next));
}
export function validateTest125Base(m,hash){
 check(hash===P.baseManifest&&m.sourceCommit===P.baseCommit&&m.packageId==='CANONICAL-TEST-'+P.baseCommit.slice(0,12)&&m.database===P.database&&m.apiPort===4144&&m.nativePort===4146&&m.webPort===5194&&m.writes===true&&m.nativeWrites===false&&m.writeScope==='existing-named-test-records'&&m.baselineReproduced===true&&Array.isArray(m.files),'BASE_IDENTITY');
 const names=new Set();for(const f of m.files){check(typeof f.path==='string'&&!f.path.includes('\\')&&!f.path.startsWith('/')&&f.path.split('/').every(p=>p&&p!=='.'&&p!=='..')&&/^[a-f0-9]{64}$/.test(f.sha256)&&!names.has(f.path.toLowerCase()),'BASE_FILES');names.add(f.path.toLowerCase());}
}
function regular(file){const s=fs.lstatSync(file);check(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1,'REGULAR_FILE');return s;}
function read(file){const a=regular(file),b=fs.readFileSync(file),z=regular(file);check(a.size===b.length&&a.ino===z.ino&&a.size===z.size&&a.mtimeMs===z.mtimeMs,'READ_CHANGED');return b;}
function enumerate(root,rel=''){
 const dir=path.join(root,rel);check(!fs.lstatSync(dir).isSymbolicLink(),'SYMLINK');
 return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{check(!e.isSymbolicLink(),'SYMLINK');const p=rel?rel+'/'+e.name:e.name;return e.isDirectory()?enumerate(root,p):[p];});
}
function annotate(file,bytes){if(!['is-akisi-taslagi.html','legacy-admin.html'].includes(file))return bytes;const label=file==='is-akisi-taslagi.html'?'TEST · SQL iş akışları · LIVE’dan ayrı':'TEST · Ayrı örnek ekran';return Buffer.from(bytes.toString('utf8').replace('<title>','<title>TEST · ').replace('<body>','<body><div style="position:fixed;bottom:0;right:0;z-index:2147483647;background:#854d0e;color:white;padding:4px 12px;font:12px sans-serif">'+label+' · '+P.baseCommit.slice(0,12)+'</div>'));}
export async function prepareTest125CatalogPackage({resumeKnownLoggerTemplateFailure=false}={}){
 check(process.platform==='win32','WINDOWS_REQUIRED');
 const repo=path.resolve(import.meta.dirname,'../..'),git=(...args)=>cp.execFileSync('git',args,{cwd:repo,windowsHide:true});
 check(git('remote','get-url','origin').toString().trim()==='https://github.com/melihsnyldzz-ui/melisa-erp-v2.git'&&git('remote','get-url','--push','origin').toString().trim()==='https://github.com/melihsnyldzz-ui/melisa-erp-v2.git','ORIGIN');
 const producerCommit=git('rev-parse','HEAD').toString().trim();
 check(git('diff','HEAD','--','scripts/canonical/prepare-test125-catalog-package.mjs','scripts/canonical/package-npm.mjs').length===0,'UNCOMMITTED_PRODUCER');
 const startup=JSON.parse(fs.readFileSync('C:/Sirket/ERP/runtime/canonical-test/startup-config.json','utf8'));
 check(path.resolve(startup.ReleaseRoot)===path.resolve(P.base)&&startup.SourceCommit===P.baseCommit&&startup.ManifestSha256.toLowerCase()===P.baseManifest&&startup.ExpectedDatabase===P.database,'CURRENT_TARGET');
 const baseBytes=read(P.base+'/release-manifest.json'),base=JSON.parse(baseBytes);validateTest125Base(base,sha(baseBytes));
 check(process.version===base.node,'NODE_VERSION');
 const baseline=P.evidence+'/test125-catalog-build-baseline',candidate=P.evidence+'/test125-catalog-build-candidate';
 if(resumeKnownLoggerTemplateFailure){check(fs.existsSync(P.destination)&&!fs.existsSync(P.destination+'/release-manifest.json')&&fs.existsSync(baseline)&&!fs.existsSync(candidate),'KNOWN_UNSEALED_STAGE_REQUIRED');}
 else check(!fs.existsSync(P.destination),'DESTINATION_EXISTS');
 const declared=new Map(base.files.map(f=>[f.path,f.sha256])),paths=enumerate(P.base),payload=paths.filter(p=>p!=='release-manifest.json');
 check(payload.every(p=>declared.has(p)||/^apps\/(?:api|web-admin|sites-workflow)\/node_modules\//.test(p)),'UNDECLARED_RUNTIME_FILE');
 const total=payload.reduce((n,p)=>n+regular(P.base+'/'+p).size,0),disk=fs.statfsSync('C:/');check(disk.bavail*disk.bsize>total+2*1024**3,'FREE_SPACE');
 if(!resumeKnownLoggerTemplateFailure)fs.mkdirSync(P.destination);const copied=[];
 for(const [i,p]of payload.entries()){
  const bytes=read(P.base+'/'+p),hash=sha(bytes);if(declared.has(p))check(hash===declared.get(p),'BASE_FILE_HASH');
  const out=P.destination+'/'+p;
  if(!resumeKnownLoggerTemplateFailure){fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,bytes,{flag:'wx'});}
  const expected=resumeKnownLoggerTemplateFailure&&P.overlays.includes(p)?sha(git('show',P.component+':'+p)):hash;
  check(sha(read(out))===expected,'COPY_HASH');copied.push({path:p,sha256:hash});
  if((i+1)%5000===0)console.log(JSON.stringify({phase:'PASSIVE_COPY',copied:i+1,total:payload.length}));
 }
 check(declared.size===base.files.length&&[...declared].every(([p])=>copied.some(r=>r.path===p)),'COPY_COVERAGE');
 const env={};for(const k of ['SystemRoot','WINDIR','ComSpec','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA','PATH','Path'])if(process.env[k])env[k]=process.env[k];
 Object.assign(env,{VITE_API_BASE_URL:'http://127.0.0.1:4144',VITE_VEGA_PRODUCTS_BASE_URL:'http://127.0.0.1:4144',VITE_MELISA_PILOT:'true',VITE_DEMO_MODE:'false',VITE_LOCAL_PASSWORDLESS_LOGIN:'false',VITE_TEST_READ_ONLY:'false'});
 if(!resumeKnownLoggerTemplateFailure)check(!fs.existsSync(baseline)&&!fs.existsSync(candidate),'BUILD_OUTPUT_EXISTS');
 const build=out=>runPinnedNpm(['run','build','--','--outDir',out],P.destination+'/apps/sites-workflow',env);
 if(!resumeKnownLoggerTemplateFailure)build(baseline);
 const baselineFiles=enumerate(baseline),baselineDiff=[];
 for(const file of baselineFiles){const expected=P.base+'/apps/sites-workflow/dist/'+file,bytes=annotate(file,read(baseline+'/'+file));if(!fs.existsSync(expected)||sha(bytes)!==sha(read(expected)))baselineDiff.push(file);}
 check(baselineDiff.length===0,'WEB_BASELINE_NOT_REPRODUCED');
 const sourceDelta=[];
 for(const file of P.overlays){const bytes=git('show',P.component+':'+file),before=read(P.base+'/'+file);fs.writeFileSync(P.destination+'/'+file,bytes);sourceDelta.push({path:file,before:sha(before),after:sha(bytes),componentCommit:P.component});}
 const loggerBefore=read(P.destination+'/'+P.logger);let loggerProjection='UNCHANGED_BASE_PRE_REGISTRY';
 if(loggerBefore.toString('utf8').includes('PRODUCT_NOT_FOUND PRODUCT_STOCK_CODE_DUPLICATE')){
  const loggerAfter=addCatalogLineageDiagnostic(loggerBefore);fs.writeFileSync(P.destination+'/'+P.logger,loggerAfter);sourceDelta.push({path:P.logger,before:sha(loggerBefore),after:sha(loggerAfter),componentCommit:P.component,kind:'EXACT_STATIC_CODE_INSERTION_ON_BASE'});loggerProjection='EXACT_STATIC_CODE_INSERTION';
 }else check(sha(loggerBefore)===declared.get(P.logger),'BASE_LOGGER_CHANGED');
 build(candidate);const webDelta=[];
 for(const file of enumerate(candidate)){
  const rel='apps/sites-workflow/dist/'+file,bytes=annotate(file,read(candidate+'/'+file)),dest=P.destination+'/'+rel;
  const before=fs.existsSync(dest)?sha(read(dest)):null,after=sha(bytes);
  if(before!==after){fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes);webDelta.push({path:rel,before,after});}
 }
 const expectedChanged=new Set([...sourceDelta,...webDelta].map(x=>x.path)),all=enumerate(P.destination),byBase=new Map(copied.map(r=>[r.path,r.sha256])),actualDelta=[],dependencies=[];
 for(const file of all){const hash=sha(read(P.destination+'/'+file)),old=byBase.get(file);if(hash!==old){check(expectedChanged.has(file),'UNEXPECTED_DELTA');actualDelta.push({path:file,before:old??null,after:hash});}if(/\/node_modules\//.test(file))dependencies.push({path:file,sha256:hash});}
 check(expectedChanged.size===actualDelta.length&&all.length===copied.length+actualDelta.filter(x=>x.before===null).length,'FINAL_INVENTORY');
 check(sha(read(P.base+'/release-manifest.json'))===P.baseManifest,'BASE_MANIFEST_CHANGED');
 for(const row of sourceDelta)check(sha(read(P.base+'/'+row.path))===row.before,'BASE_SOURCE_CHANGED');
 const files=base.files.map(row=>({path:row.path,sha256:sha(read(P.destination+'/'+row.path))}));
 for(const row of actualDelta.filter(r=>r.before===null))files.push({path:row.path,sha256:row.after});files.sort((a,b)=>a.path.localeCompare(b.path,'en'));
 const metadata={schemaVersion:'melisa-test125-catalog-compatibility-package.v1',basePackageRoot:P.base,baseSourceCommit:P.baseCommit,baseManifestSha256:P.baseManifest,componentSourceCommit:P.component,producerCommit,sourceDelta,loggerProjection,webDelta,actualDelta,payloadFiles:all.length,payloadBytes:total,preservedDependencyFiles:dependencies.length,dependencyInventorySha256:sha(Buffer.from(JSON.stringify(dependencies))),webBaselineReproduced:true,currentTarget:P.database,ports:{web:5194,native:4146,api:4144},installed:false};
 const manifest={...base,packageId:'CANONICAL-TEST-'+P.baseCommit.slice(0,12)+'-catalog-'+P.component.slice(0,8),builtAt:new Date().toISOString(),catalogCompatibility:metadata,files};
 const bytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n');fs.writeFileSync(P.destination+'/release-manifest.json',bytes,{flag:'wx'});
 const result={packageRoot:P.destination,packageId:manifest.packageId,baseSource:P.baseCommit,componentSource:P.component,producerCommit,manifestSha256:sha(bytes),declaredFiles:files.length,sourceDelta,loggerProjection,webDelta,payloadFiles:all.length,installed:false,sqlWrites:0,stopStart:0};
 fs.writeFileSync(P.evidence+'/active-221-passive-catalog-package.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){const mode=process.argv.slice(2).join(' ');if(!['--prepare','--resume-known-logger-template-failure'].includes(mode))throw Error('TEST125_PACKAGE_ARGUMENTS');await prepareTest125CatalogPackage({resumeKnownLoggerTemplateFailure:mode==='--resume-known-logger-template-failure'});}
