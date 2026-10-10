// SOURCE PREPARATION / NOT INSTALLED. Future read-only noninteractive probe.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {createHubStackBootPlan} from './hub-stack-boot-plan.mjs';
import {STACK_STAGES,createRuntimeDriver,processMatchesReceipt} from './hub-stack-driver.mjs';
const runFile=promisify(execFile),hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const fail=code=>{throw Error(`HUB_S4U_${code}`);};
export async function evaluateS4uReadiness(settings,context,driver){
 if(context?.ownerSid!==settings.ownerSid||context.logonType!==4||context.sessionId!==0||context.elevated!==false||context.profileAvailable!==true)fail('NONINTERACTIVE_IDENTITY_REJECTED');
 await driver.verifyPins(settings);
 const sql=await driver.sqlReady(settings);
 if(sql.ready!==true||sql.readOnlyProbe!==true||sql.database!==settings.database||sql.copyId!==settings.copyId)fail('SQL_IDENTITY_REJECTED');
 const services=[];
 for(const stage of STACK_STAGES){
  const owners=await driver.inspect(stage);
  if(owners.length===0){services.push({service:stage.name,state:'NOT_RUNNING'});continue;}
  const receipt=await driver.existingReceipt(stage);
  if(owners.length!==1||!processMatchesReceipt(owners[0],receipt,stage,settings))fail('FOREIGN_PORT_OWNER');
  await driver.validateReceiptPins(receipt,stage);await driver.readiness(stage,receipt);
  services.push({service:stage.name,state:'READONLY_READY'});
 }
 return {schemaVersion:1,probe:'S4U_READONLY',state:'PREFLIGHT_VERIFIED',observedAt:new Date().toISOString(),copyId:settings.copyId,database:settings.database,
  sourceCommit:settings.stackPackage.sourceCommit,noninteractiveBatchVerified:true,profileVerified:true,privateFilesAndDependenciesVerified:true,readOnlySqlVerified:true,
  services,actualBootTested:false,serviceStartup:false,providerRequests:false,humanAcceptance:'PENDING'};
}
function noReparse(target){for(let cursor=target;cursor.length>3;cursor=path.dirname(cursor))if(fs.lstatSync(cursor).isSymbolicLink())fail('REPARSE_REJECTED');}
export async function runS4uReadinessProbe({configPath,configSha256}){
 noReparse(configPath);const bytes=fs.readFileSync(configPath);if(hash(bytes)!==configSha256)fail('CONFIG_HASH_REJECTED');
 const settings=JSON.parse(bytes.toString('utf8').replace(/^\ufeff/,''));
 createHubStackBootPlan({...settings,currentOwnerSid:settings.ownerSid,startupConfig:{path:configPath,sha256:configSha256}});
 const own=fileURLToPath(import.meta.url),expected=path.join(settings.stackPackage.packageRoot,'scripts','canonical','hub-s4u-readiness-probe.mjs');
 if(process.platform!=='win32'||own.toLowerCase()!==expected.toLowerCase())fail('EXECUTION_PACKAGE_REJECTED');
 const shell=path.join(settings.windowsRoot,'System32','WindowsPowerShell','v1.0','powershell.exe');
 const helper=path.join(settings.stackPackage.packageRoot,'scripts','canonical','hub-s4u-readiness-probe.ps1');
 // Verify executable/helper source pins before invoking any identity helper.
 noReparse(helper);const manifestBytes=fs.readFileSync(path.join(settings.stackPackage.packageRoot,'release-manifest.json'));
 if(hash(manifestBytes)!==settings.stackPackage.manifestSha256)fail('MANIFEST_HASH_REJECTED');const manifest=JSON.parse(manifestBytes);
 for(const file of [own,helper]){const item=manifest.files?.find(row=>row.path.replaceAll('\\','/').toLowerCase()===path.relative(settings.stackPackage.packageRoot,file).replaceAll('\\','/').toLowerCase());if(!item||hash(fs.readFileSync(file))!==item.sha256)fail('PROBE_ENTRY_HASH_REJECTED');}
 const {stdout}=await runFile(shell,['-NoProfile','-NonInteractive','-File',helper,'-Action','Identity'],{windowsHide:true,timeout:10000,maxBuffer:4096});
 const context=JSON.parse(stdout.replace(/^\ufeff/,''));
 createHubStackBootPlan({...settings,currentOwnerSid:context.ownerSid,startupConfig:{path:configPath,sha256:configSha256}});
 return evaluateS4uReadiness(settings,context,await createRuntimeDriver(settings,{readOnlyProbe:true}));
}
if(process.argv[1]&&path.resolve(process.argv[1]).toLowerCase()===fileURLToPath(import.meta.url).toLowerCase()){
 try{const args=process.argv.slice(2);if(args.length!==4||args[0]!=='--config'||args[2]!=='--sha256')fail('ARGUMENTS_REJECTED');
  process.stdout.write(JSON.stringify(await runS4uReadinessProbe({configPath:args[1],configSha256:args[3]})));
 }catch(error){process.stderr.write(/^HUB_(?:S4U|STACK)_[A-Z_]+$/.test(error?.message??'')?error.message:'HUB_S4U_PROBE_FAILED');process.exitCode=1;}
}
