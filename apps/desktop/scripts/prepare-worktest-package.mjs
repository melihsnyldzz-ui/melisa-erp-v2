import * as fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {validateWorktestPackage} from '../src/worktest-entry.mjs';
import {worktest} from '../src/protectedWorkSessionPolicy.mjs';

export const worktestSourceFiles=Object.freeze(['main.mjs','preload.cjs','protectedWorkSessionPolicy.mjs','protectedWorkSessionStore.mjs','worktest-entry.mjs']);
export const worktestDesktopMetadata=Object.freeze({name:'melisa-calisma-test',productName:'Melisa Çalışma TEST',appId:'com.melisababy.erp.worktest',electronVersion:'39.8.10'});
const sha=b=>createHash('sha256').update(b).digest('hex').toUpperCase();
const fail=()=>{throw new Error('WORKTEST_PACKAGE_STAGE_REJECTED');};
const inside=(candidate,parent)=>{const relative=path.relative(parent,candidate);return relative===''||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative));};
async function regularPath(file,{directory=false}={}) {
  const parsed=path.parse(file);let current=parsed.root;
  for(const part of path.relative(parsed.root,file).split(path.sep).filter(Boolean)){
    current=path.join(current,part);const stat=await fs.lstat(current);
    if(stat.isSymbolicLink()||(!stat.isDirectory() && current!==file))fail();
  }
  const stat=await fs.lstat(file);if(directory?!stat.isDirectory():!stat.isFile()||stat.nlink!==1)fail();
  return stat;
}
async function pinnedJson(file,expectedHash,maxBytes) {
  if(!path.isAbsolute(file)||!/^[A-Fa-f0-9]{64}$/.test(expectedHash??''))fail();
  const details=await regularPath(file);if(details.size>maxBytes)fail();const bytes=await fs.readFile(file);
  if(sha(bytes)!==expectedHash.toUpperCase())fail();return{bytes,value:JSON.parse(bytes.toString('utf8'))};
}
export function inspectDesktopSource(repoRoot) {
  const read=args=>execFileSync('git',args,{cwd:repoRoot,encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:1024*1024}).trim();
  return{root:read(['rev-parse','--show-toplevel']),head:read(['rev-parse','HEAD']),origin:read(['remote','get-url','origin']),pushOrigin:read(['remote','get-url','--push','origin']),dirty:read(['status','--porcelain','--untracked-files=all'])!==''};
}
export async function prepareWorktestPackage({repoRoot,output,desktopSourceCommit,runtimeManifestPath,runtimeManifestSHA256,runtimePinPath,runtimePinSHA256},{inspectSource=inspectDesktopSource}={}) {
  try {
    if(!path.isAbsolute(repoRoot)||!path.isAbsolute(output)||output!==path.resolve(output)||inside(output,repoRoot)||!/^[a-f0-9]{40}$/.test(desktopSourceCommit??''))fail();
    await regularPath(repoRoot,{directory:true});await regularPath(path.dirname(output),{directory:true});
    try{await fs.lstat(output);fail();}catch(e){if(e.code!=='ENOENT')throw e;}
    const assertSource=()=>{const s=inspectSource(repoRoot);if(path.resolve(s.root)!==path.resolve(repoRoot)||s.head!==desktopSourceCommit||s.dirty!==false||s.origin!=='https://github.com/melihsnyldzz-ui/melisa-erp-v2.git'||s.pushOrigin!==s.origin)fail();};
    assertSource();
    const manifest=await pinnedJson(runtimeManifestPath,runtimeManifestSHA256,32*1024*1024),publicPin=await pinnedJson(runtimePinPath,runtimePinSHA256,4096),pin=validateWorktestPackage(publicPin.value),m=manifest.value,c=m?.sharedTestCopy;
    if(m.sourceCommit!==pin.sourceCommit||m.baselineReproduced!==true||c?.database!==worktest.database||c.apiPort!==4184||c.nativePort!==4186||c.webPort!==5234||c.nativeWrites!==false||c.externalOperations!==false||c.actualT1!==false)fail();
    const captured=[];
    for(const name of worktestSourceFiles){const file=path.join(repoRoot,'apps','desktop','src',name),s=await regularPath(file);if(s.size>1024*1024)fail();captured.push({name,bytes:await fs.readFile(file)});}
    assertSource();
    for(const item of captured)if(!item.bytes.equals(await fs.readFile(path.join(repoRoot,'apps','desktop','src',item.name))))fail();
    const metadata={name:worktestDesktopMetadata.name,productName:worktestDesktopMetadata.productName,version:'0.1.0',private:true,type:'module',main:'src/worktest-entry.mjs',description:'Isolated DB02 normal Windows TEST client',build:{appId:worktestDesktopMetadata.appId,electronVersion:worktestDesktopMetadata.electronVersion,files:['src/**/*','package.json']}};
    const files=[...captured.map(r=>({path:'src/'+r.name,bytes:r.bytes})),{path:'src/worktest-package.json',bytes:publicPin.bytes},{path:'package.json',bytes:Buffer.from(JSON.stringify(metadata,null,2)+'\n')}];
    await fs.mkdir(output,{mode:0o700});await fs.mkdir(path.join(output,'src'),{mode:0o700});
    for(const item of files){const handle=await fs.open(path.join(output,item.path),'wx',0o600);try{await handle.writeFile(item.bytes);await handle.sync();}finally{await handle.close();}}
    const receipt={schemaVersion:'melisa-windows-worktest-stage.v1',desktopSourceCommit,runtimeSourceCommit:pin.sourceCommit,runtimeManifestSHA256:sha(manifest.bytes),runtimePinSHA256:sha(publicPin.bytes),copyId:pin.copyId,databaseName:pin.databaseName,appId:worktestDesktopMetadata.appId,electronVersion:'39.8.10',files:files.map(f=>({path:f.path,sha256:sha(f.bytes)})),buildExecuted:false,servicesStarted:0,credentialsIncluded:false};
    await fs.writeFile(path.join(output,'worktest-stage-manifest.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx',mode:0o600});
    return receipt;
  } catch { fail(); }
}
export function parseWorktestStageArguments(args) {
  const keys={'--output':'output','--desktop-source-commit':'desktopSourceCommit','--runtime-manifest':'runtimeManifestPath','--runtime-manifest-sha256':'runtimeManifestSHA256','--runtime-pin':'runtimePinPath','--runtime-pin-sha256':'runtimePinSHA256'},result={};
  if(args.length!==12)fail();
  for(let i=0;i<args.length;i+=2){const k=keys[args[i]];if(!k||Object.hasOwn(result,k)||typeof args[i+1]!=='string'||!args[i+1].length)fail();result[k]=args[i+1];}
  return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  const result=await prepareWorktestPackage({repoRoot:fileURLToPath(new URL('../../../',import.meta.url)),...parseWorktestStageArguments(process.argv.slice(2))});
  console.log(JSON.stringify({staged:true,desktopSourceCommit:result.desktopSourceCommit,runtimeSourceCommit:result.runtimeSourceCommit,files:result.files.length,servicesStarted:0,buildExecuted:false}));
}
