// Pure preparation reads pinned sources; publication/launch belong to the root driver.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {createRequire} from 'node:module';
export const LIGHT_ROOT=String.raw`C:\Sirket\ERP\rehearsal\ERP-LIGHT-REHEARSAL-20261019-1253`;
export const LIGHT_OLD=Object.freeze({source:'e59e07abf7ae2567cdc2adb93811fe29e0032fe5',manifest:'2b8115a7ad44854d48626717930857aff26a97ffd37e9dbbc4310ab675b869c7'});
export const LIGHT_NEW=Object.freeze({source:'01ef3e3aa3bd6b8cc4f05191e1ccdf58fb76c7f2',manifest:'8754f9cb11449ad1f784f16ce0425a129725847c1aa0b5397d5611c3fcc4edcf'});
export const lightSha=b=>crypto.createHash('sha256').update(b).digest('hex');
const need=(v,c)=>{if(!v)throw Error('P03_LIGHT_'+c);};
const bytes=x=>Buffer.from(JSON.stringify(x));
export function lightNoReparse(file){for(let p=path.resolve(file);;p=path.dirname(p)){const s=fs.lstatSync(p);need(!s.isSymbolicLink(),'REPARSE');if(path.dirname(p)===p)break;}}
function read(file){lightNoReparse(file);const s=fs.statSync(file);need(s.isFile()&&s.nlink===1&&s.size<8*1024*1024,'FILE');return fs.readFileSync(file);}
function packagePin(ref,expected){need(path.win32.isAbsolute(ref.root)&&/^[a-f0-9]{64}$/.test(ref.manifestSha256),'PACKAGE_REF');const raw=read(path.join(ref.root,'release-manifest.json'));need(lightSha(raw)===ref.manifestSha256&&(!expected||ref.manifestSha256===expected.manifest),'PACKAGE_MANIFEST');const m=JSON.parse(raw);need(/^[a-f0-9]{40}$/.test(m.sourceCommit)&&(!expected||m.sourceCommit===expected.source),'PACKAGE_SOURCE');return {root:ref.root,m,index:new Map(m.files.map(f=>[f.path.replaceAll('\\','/'),f.sha256]))};}
function sourceFile(pkg,name){need(pkg.index.has(name),'MISSING_SOURCE');const data=read(path.join(pkg.root,name));need(lightSha(data)===pkg.index.get(name),'SOURCE_HASH');return data;}
export function collectLightExpressPins(root){
 const req=createRequire(path.join(root,'apps/api/package.json')),seen=new Set(),files=[];
 const depRoot=(local,name)=>{need(/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i.test(name),'DEPENDENCY_NAME');const dirs=local.resolve.paths(name)??[];const dir=dirs.map(p=>path.join(p,name)).find(p=>p.startsWith(path.resolve(root)+path.sep)&&fs.existsSync(path.join(p,'package.json')));need(dir,'DEPENDENCY_MISSING');return dir;};const pending=[depRoot(req,'express')];
 while(pending.length){const dir=pending.pop();
  need(dir.startsWith(path.resolve(root)+path.sep),'DEPENDENCY_ESCAPE');if(seen.has(dir))continue;seen.add(dir);need(seen.size<=128,'DEPENDENCY_COUNT');
  const pkg=JSON.parse(read(path.join(dir,'package.json'))),local=createRequire(path.join(dir,'package.json'));
  const walk=p=>{for(const ent of fs.readdirSync(p,{withFileTypes:true})){const f=path.join(p,ent.name);need(!ent.isSymbolicLink(),'DEPENDENCY_REPARSE');if(ent.isDirectory()){if(ent.name!=='node_modules')walk(f);}else{need(ent.isFile()&&!f.endsWith('.node'),'DEPENDENCY_NATIVE');files.push({path:f,sha256:lightSha(read(f))});need(files.length<=3000,'DEPENDENCY_FILES');}}};walk(dir);
  for(const dep of Object.keys(pkg.dependencies??{}))pending.push(depRoot(local,dep));
 }
 files.push({path:path.join(root,'apps/api/package.json'),sha256:lightSha(read(path.join(root,'apps/api/package.json')))});
 return {root,packages:seen.size,files:files.sort((a,b)=>a.path.localeCompare(b.path))};
}
export function validateLightPackageManifest(m){
 const keys=['schemaVersion','environment','sourceCommit','launcherSource','generation','sqlFree','port','actualT1','childConfigSha256','files'];
 need(Object.keys(m).length===keys.length&&keys.every(k=>Object.hasOwn(m,k))&&m.schemaVersion==='melisa-p03-light-hub-package.v1'&&m.environment==='P03_LIGHT_REHEARSAL'&&m.sqlFree===true&&m.actualT1===false&&m.port===5354,'LIGHT_MANIFEST');
 need(['old','new'].includes(m.generation)&&m.sourceCommit===(m.generation==='old'?LIGHT_OLD.source:LIGHT_NEW.source)&&/^[a-f0-9]{40}$/.test(m.launcherSource)&&/^[a-f0-9]{64}$/.test(m.childConfigSha256),'LIGHT_SOURCE');
 const required=['app/melisaHubReadiness.mjs','launcher/sharedCopyWebApplication.mjs','launcher/start-hub-light-rehearsal.ps1','launcher/p03-light-hub-child.mjs',...['index.html','hub.css','hub.mjs','catalog.mjs'].map(n=>'web/melisa-hub/'+n)];
 need(m.files.length===required.length&&required.every(n=>m.files.filter(f=>f.path===n&&/^[a-f0-9]{64}$/.test(f.sha256)).length===1),'LIGHT_FILE_SET');return true;
}
export function buildLightHubRehearsal(request){
 need(Object.keys(request).sort().join('|')==='candidatePackage|launcherPackage|node|oldPackage|runId','REQUEST');need(/^[a-f0-9]{32}$/.test(request.runId),'RUN');
 const old=packagePin(request.oldPackage,LIGHT_OLD),candidate=packagePin(request.candidatePackage,LIGHT_NEW),launcher=packagePin(request.launcherPackage);
 need(request.oldPackage.root===String.raw`C:\Sirket\ERP\releases\CANONICAL-COMPLETE-TEST-20261018-e59e07abf7ae`&&request.candidatePackage.root===String.raw`C:\Sirket\ERP\releases\CANONICAL-CANDIDATE-TEST-20261019-01ef3e3a`,'SOURCE_ROOT');
 need(request.node.path===String.raw`C:\Sirket\ERP\tools\node-v24.19.0\node.exe`&&request.node.sha256==='3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237'&&(()=>{lightNoReparse(request.node.path);const stat=fs.statSync(request.node.path);need(stat.isFile()&&stat.nlink===1&&stat.size>0&&stat.size<160*1024*1024,'NODE_SIZE');return lightSha(fs.readFileSync(request.node.path))===request.node.sha256;})(),'NODE');
 need(launcher.root.startsWith(String.raw`C:\Sirket\ERP\releases\CANONICAL-`)&&path.win32.basename(launcher.root).endsWith(launcher.m.sourceCommit.slice(0,8)),'LAUNCHER_IMMUTABLE_ROOT');
 const deps=collectLightExpressPins(candidate.root),runRoot=path.win32.join(LIGHT_ROOT,'run-'+request.runId),artifacts=[],outputs=[];
 const staging='scripts/canonical/p03-rehearsal-driver.ps1';sourceFile(launcher,staging);
 const common=sourceFile(launcher,'scripts/canonical/start-hub-web.ps1');
 outputs.push({relative:'start-hub-web.ps1',data:common});
 for(const [generation,pkg] of [['old',old],['new',candidate]]){
  const family=generation==='old'?'CANONICAL-COMPLETE-TEST-20261018-e59e07abf7ae':'CANONICAL-CANDIDATE-TEST-20261019-01ef3e3a',base=generation+'/'+family,packageRoot=path.win32.join(runRoot,generation,family),operation=path.win32.join(runRoot,generation,'operation.json');
  const payload=[['app/melisaHubReadiness.mjs',sourceFile(pkg,'apps/api/src/services/melisaHubReadiness.mjs')],['launcher/sharedCopyWebApplication.mjs',sourceFile(launcher,'apps/api/src/services/sharedCopyWebApplication.mjs')],...['start-hub-light-rehearsal.ps1','p03-light-hub-child.mjs'].map(n=>['launcher/'+n,sourceFile(launcher,'scripts/canonical/'+n)]),...['index.html','hub.css','hub.mjs','catalog.mjs'].map(n=>['web/melisa-hub/'+n,sourceFile(pkg,'apps/sites-workflow/dist-business/melisa-hub/'+n)])];
  const files=payload.map(([name,data])=>({path:name,sha256:lightSha(data)}));
  const cfg={schemaVersion:'melisa-p03-light-hub-child.v1',environment:'P03_LIGHT_REHEARSAL',host:'127.0.0.1',port:5354,sqlFree:true,actualT1:false,packageRoot,applicationSource:pkg.m.sourceCommit,launcherSource:launcher.m.sourceCommit,generation,files,dependencies:deps};
  const manifest={schemaVersion:'melisa-p03-light-hub-package.v1',environment:'P03_LIGHT_REHEARSAL',sourceCommit:pkg.m.sourceCommit,launcherSource:launcher.m.sourceCommit,generation,sqlFree:true,port:5354,actualT1:false,childConfigSha256:lightSha(bytes(cfg)),files};validateLightPackageManifest(manifest);
  const startup={PackageRoot:packageRoot,SourceCommit:pkg.m.sourceCommit,ManifestSha256:lightSha(bytes(manifest)),OperationConfigPath:operation,HubConfigPath:path.win32.join(runRoot,generation,'hub.json'),NodePath:request.node.path,NodeSha256:request.node.sha256,OwnerSid:'S-1-5-21-2170750028-1005938530-2568122015-1001',RuntimeDir:path.win32.join(runRoot,generation,'private')};
  outputs.push(...payload.map(([name,data])=>({relative:base+'/'+name,data})),{relative:base+'/release-manifest.json',data:bytes(manifest)},{relative:generation+'/operation.json',data:bytes(cfg)},{relative:generation+'/hub.json',data:bytes({environment:'P03_LIGHT_REHEARSAL',pin:null})},{relative:generation+'/startup.json',data:bytes(startup)});
  artifacts.push({generation,applicationSource:pkg.m.sourceCommit,launcherSource:launcher.m.sourceCommit,manifestSha256:startup.ManifestSha256,startupPath:path.win32.join(runRoot,generation,'startup.json'),appModuleSha256:files[0].sha256});
 }
 return {runRoot,artifacts,outputs,stagingHelper:{path:path.join(launcher.root,staging),sha256:launcher.index.get(staging)},commonStarterSha256:lightSha(common),launcherSource:launcher.m.sourceCommit,dependencies:{packages:deps.packages,files:deps.files.length},sqlFree:true,sharedFullLaunchTested:false,normalActorVerified:false,dailyFlowReady:false};
}
