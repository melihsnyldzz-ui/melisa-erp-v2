// Historical output is a separate provenance record, never the current build.
// Importing this module performs no IO. The package builder opts in explicitly.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

export const HISTORICAL_WEB_BASELINE=Object.freeze({
 root:'C:\\Sirket\\ERP\\releases\\CANONICAL-COMPLETE-TEST-20261011-7a41f64',
 sourceCommit:'7a41f6492273dd1ec0bcb086f820be5575372be8',
 manifestSha256:'93bd7814d64bb2092f42994d28285b9a25967d07f0413835d5c139b2872ad778'
});
const prefix='apps/web-admin/dist-baseline-proof/';
export const HISTORICAL_WEB_FILES=Object.freeze([
 {path:'assets/index-CjyxL4bG.js',bytes:1631056,sha256:'28fb441f8a1d985e2382719d8f961cd8348b8f23701b4f1100c9f795901f849a'},
 {path:'assets/index-WEZGfS6P.css',bytes:586683,sha256:'543667057ddd4e07ee98ff8053f759fb5260bfb6f9367b237d08fd990e132da1'},
 {path:'index.html',bytes:420,sha256:'da0a8f1087b07758954979ab8195b264834fac1d2e71ec9a25b5aa8a3fee01e1'},
 {path:'melisa-baby-watermark.png',bytes:82146,sha256:'81e27d4d5394eb147b573b86a0b6af4f7f97cb76216f2b4d37b5cc23395e77cb'}
].map(Object.freeze));
const fail=code=>{throw Error('HISTORICAL_WEB_BASELINE_'+code);};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const samePath=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
const safeRelative=value=>typeof value==='string'&&!value.includes('\\')&&!value.startsWith('/')&&value.split('/').every(part=>part&&part!=='.'&&part!=='..'&&!/[ .:]$/.test(part));

export function parseWebBaselineArgs(args=[]){
 const allowed=['--historical-web-baseline','--stage4-copy','--shared-test-copy','--business-test-copy'];
 if(!Array.isArray(args)||args.some(value=>!allowed.includes(value))||new Set(args).size!==args.length||args.filter(value=>value!=='--historical-web-baseline').length>1)fail('ARGUMENTS_REJECTED');
 return {historical:args.includes('--historical-web-baseline'),remaining:args.filter(value=>value!=='--historical-web-baseline')};
}

// The IO boundary supplies independently calculated digests and sizes. These
// literal pins also prevent a modified documentation baseline becoming trusted.
export function validateHistoricalWebBaseline({packageRoot,manifestSha256,manifest,expected,files}){
 const pin=HISTORICAL_WEB_BASELINE;
 if(packageRoot!==pin.root||manifestSha256!==pin.manifestSha256||manifest?.sourceCommit!==pin.sourceCommit||manifest.packageId!=='CANONICAL-TEST-'+pin.sourceCommit.slice(0,12)||manifest.baselineReproduced!==true||!Array.isArray(manifest.files))fail('PACKAGE_REJECTED');
 if(!Array.isArray(expected)||expected.length!==4||!Array.isArray(files)||files.length!==4)fail('FILES_REJECTED');
 for(const row of HISTORICAL_WEB_FILES){
  const document=expected.filter(value=>value?.path===row.path),captured=files.filter(value=>value?.path===row.path),entries=manifest.files.filter(value=>typeof value?.path==='string'&&value.path.toLowerCase()===(prefix+row.path).toLowerCase());
  if(document.length!==1||document[0].kind!=='web'||document[0].bytes!==row.bytes||document[0].sha256!==row.sha256||document[0].rebuildSha256!==row.sha256||captured.length!==1||captured[0].bytes!==row.bytes||captured[0].sha256!==row.sha256||entries.length!==1||entries[0].path!==prefix+row.path||entries[0].sha256!==row.sha256)fail('FILE_PIN_REJECTED');
 }
 return Object.freeze({baselineMode:'PINNED_HISTORICAL',baselineSourceCommit:pin.sourceCommit,baselineManifestSha256:pin.manifestSha256,baselineArtifactDirectory:prefix.slice(0,-1)});
}

function directory(io,filename){
 for(let cursor=filename;;cursor=path.win32.dirname(cursor)){
  const stat=io.lstatSync(cursor);
  if(!stat.isDirectory()||stat.isSymbolicLink()||!samePath(io.realpathSync.native(cursor),cursor))fail('REPARSE_REJECTED');
  if(path.win32.dirname(cursor)===cursor)break;
 }
}
function regularBytes(io,filename,maxBytes){
 directory(io,path.win32.dirname(filename));
 const before=io.lstatSync(filename);
 if(!before.isFile()||before.isSymbolicLink()||before.nlink!==1||before.size>maxBytes||!samePath(io.realpathSync.native(filename),filename))fail('FILE_REJECTED');
 const bytes=io.readFileSync(filename),after=io.lstatSync(filename);
 if(!Buffer.isBuffer(bytes)||bytes.length!==before.size||!after.isFile()||after.isSymbolicLink()||!samePath(io.realpathSync.native(filename),filename)||['dev','ino','mtimeMs','size','nlink'].some(key=>before[key]!==after[key]))fail('FILE_CHANGED');
 return bytes;
}

// IO/digest/platform injection is only for offline synthetic fixtures. The
// package builder uses the defaults and offers no flag to replace any pin.
export function copyHistoricalWebBaseline({destination,expected,packageRoot=HISTORICAL_WEB_BASELINE.root},{io=fs,digest=sha,platform=process.platform}={}){
 if(platform!=='win32'||packageRoot!==HISTORICAL_WEB_BASELINE.root)fail('PACKAGE_REJECTED');
 const releases=path.win32.dirname(packageRoot);
 if(typeof destination!=='string'||destination!==path.win32.resolve(destination)||path.win32.dirname(destination)!==releases||samePath(destination,packageRoot)||!/^CANONICAL-[A-Z0-9-]+-[a-f0-9]{7,12}$/.test(path.win32.basename(destination)))fail('DESTINATION_REJECTED');
 directory(io,packageRoot);
 const manifestBytes=regularBytes(io,path.win32.join(packageRoot,'release-manifest.json'),16*1024*1024);
 const manifestSha256=digest(manifestBytes);
 if(manifestSha256!==HISTORICAL_WEB_BASELINE.manifestSha256)fail('PACKAGE_REJECTED');
 let manifest;try{manifest=JSON.parse(manifestBytes);}catch{fail('PACKAGE_REJECTED');}
 const captured=HISTORICAL_WEB_FILES.map(row=>{
  if(!safeRelative(row.path))fail('FILE_PIN_REJECTED');
  const bytes=regularBytes(io,path.win32.join(packageRoot,...(prefix+row.path).split('/')),row.bytes);
  return {path:row.path,bytes:bytes.length,sha256:digest(bytes),content:bytes};
 });
 const fields=validateHistoricalWebBaseline({packageRoot,manifestSha256,manifest,expected,files:captured});
 const target=path.win32.join(destination,...prefix.slice(0,-1).split('/'));
 directory(io,path.win32.dirname(target));
 if(io.existsSync(target))fail('DESTINATION_REJECTED');
 io.mkdirSync(target);io.mkdirSync(path.win32.join(target,'assets'));
 for(const row of captured){
  const filename=path.win32.join(target,...row.path.split('/'));
  directory(io,path.win32.dirname(filename));
  io.writeFileSync(filename,row.content,{flag:'wx'});
  if(digest(regularBytes(io,filename,row.bytes))!==row.sha256)fail('COPY_REJECTED');
 }
 return fields;
}
