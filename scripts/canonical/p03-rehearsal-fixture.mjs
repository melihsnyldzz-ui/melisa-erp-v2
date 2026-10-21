// Real SQL-free loopback processes for the finite P03 OS recovery rehearsal.
// These endpoints are fixtures, never proof that ERP or database rollback works.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
export const REHEARSAL_ROOT='C:\\Sirket\\ERP\\rehearsal\\P03-RECOVERY-20261018';
export const REHEARSAL_PORTS=Object.freeze({erpNative:[4286],erpApi:[4284],crmNativeOrder:[62714],crmCatalog:[62712],crmOrders:[62713],crmServer:[62710,62711],hub:[5334]});
export const REHEARSAL_NODE='C:\\Sirket\\ERP\\tools\\node-v24.19.0\\node.exe';
const shell='C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const owner='S-1-5-21-2170750028-1005938530-2568122015-1001';
const need=(v,c)=>{if(!v)throw Error('P03_REHEARSAL_'+c);};
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
export function validateRehearsalFixtureArgs(args){
 need(args.length===6&&args[0]==='--role'&&args[2]==='--config'&&args[4]==='--generation','ARGUMENTS');
 const role=args[1],configPath=args[3],generation=args[5];
 need(Object.hasOwn(REHEARSAL_PORTS,role)||role==='coreSupervisor','ROLE');need(['old','new'].includes(generation),'GENERATION');
 need(new RegExp('^C:\\\\Sirket\\\\ERP\\\\rehearsal\\\\P03-RECOVERY-20261018\\\\run-[a-f0-9]{32}\\\\packages\\\\'+generation+'\\\\fixture-config\\.json$').test(configPath),'CONFIG_PATH');
 return {role,configPath,generation};
}
function powershell(code){return execFileSync(shell,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from("$ErrorActionPreference='Stop';"+code,'utf16le').toString('base64')],{windowsHide:true,encoding:'utf8',timeout:15000,env:{...process.env,PSModulePath:'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules'}}).trim();}
async function main(){
 const {role,configPath,generation}=validateRehearsalFixtureArgs(process.argv.slice(2));
 need(process.platform==='win32'&&process.execPath.toLowerCase()===REHEARSAL_NODE.toLowerCase(),'NODE');
 const bytes=fs.readFileSync(configPath),config=JSON.parse(bytes);need(config.environment==='P03_REHEARSAL'&&config.generation===generation&&config.database==='MELISA_ERP_P03_RESTORE_TEST_20261018_01'&&config.copyId==='P03-RECOVERY-REHEARSAL-20261018'&&config.actualT1===false,'CONFIG');
 need(path.win32.dirname(configPath)===config.packageRoot&&config.runRoot===path.win32.dirname(path.win32.dirname(config.packageRoot)),'ROOT');
 for(let q=configPath;;q=path.dirname(q)){need(!fs.lstatSync(q).isSymbolicLink(),'REPARSE');if(q===path.dirname(q))break;}
 const executable=path.join(config.packageRoot,'p03-rehearsal-fixture.mjs');
 if(role==='coreSupervisor'){
  const roles=generation==='new'&&config.partial===true?['erpNative']:['erpNative','erpApi','crmNativeOrder','crmCatalog','crmOrders','crmServer'];
  const children=roles.map(child=>spawn(process.execPath,['--no-maglev',executable,'--role',child,'--config',configPath,'--generation',generation],{windowsHide:true,stdio:'ignore'}));
  for(const child of children)child.once('error',()=>{process.exitCode=1;});
  setInterval(()=>{},1000);return;
 }
 const identity=JSON.parse(powershell(`$p=Get-CimInstance Win32_Process -Filter 'ProcessId=${process.pid}';$parent=Get-CimInstance Win32_Process -Filter ('ProcessId='+$p.ParentProcessId);$o=Invoke-CimMethod $p -MethodName GetOwnerSid;if($o.ReturnValue-ne0-or$o.Sid-cne'${owner}'){throw 'OWNER'};[ordered]@{pid=[int]$p.ProcessId;parentPid=[int]$p.ParentProcessId;creationTime=$p.CreationDate.ToUniversalTime().ToString('o');parentCreationTime=$parent.CreationDate.ToUniversalTime().ToString('o')}|ConvertTo-Json -Compress`));
 const receipt={run:config.runUuid,pid:identity.pid,parentPid:identity.parentPid,parentCreationTime:identity.parentCreationTime,creationTime:identity.creationTime,stage:role,sourceCommit:config.sourceCommit,configSha256:sha(bytes),copyId:config.copyId,actualT1:false};
 const leaf=generation==='new'?role+'.json':role+'-'+process.pid+'.json',target=path.win32.join(config.runRoot,'receipts-'+generation,leaf),data=Buffer.from(JSON.stringify(receipt,null,2)+'\n').toString('base64');
 powershell(`$s=[Security.AccessControl.FileSecurity]::new();$s.SetOwner([Security.Principal.SecurityIdentifier]::new('${owner}'));$s.SetAccessRuleProtection($true,$false);foreach($id in @('${owner}','S-1-5-18')){$s.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($id),'FullControl','Allow'))};$stream=[IO.FileStream]::new('${target}',[IO.FileMode]::CreateNew,[Security.AccessControl.FileSystemRights]::Write,[IO.FileShare]::None,4096,[IO.FileOptions]::WriteThrough,$s);try{$b=[Convert]::FromBase64String('${data}');$stream.Write($b,0,$b.Length);$stream.Flush($true)}finally{$stream.Dispose()};'CREATED'`);
 for(const port of REHEARSAL_PORTS[role]){
  const server=http.createServer((request,response)=>{if(request.method!=='GET'||request.url!=='/test-health'){response.writeHead(404);response.end();return;}response.setHeader('Content-Type','application/json');response.end(JSON.stringify({ok:true,environment:'P03_REHEARSAL',sqlFreeFixture:true,databaseName:config.database,sourceCommit:config.sourceCommit,generation,role,copyId:config.copyId,actualT1:false}));});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
 }
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)main().catch(()=>{process.stderr.write('P03_REHEARSAL_FIXTURE_FAILED\n');process.exitCode=1;});
