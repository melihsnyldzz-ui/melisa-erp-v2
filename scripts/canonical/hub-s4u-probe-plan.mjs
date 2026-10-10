// SOURCE PREPARATION / NOT INSTALLED. Pure task review and recovery plan.
import path from 'node:path';
import crypto from 'node:crypto';
import {createHubStackBootPlan} from './hub-stack-boot-plan.mjs';
const fail=code=>{throw Error(`HUB_S4U_${code}`);};
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const xml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function createS4uProbePlan(input){
 if(!input||Object.keys(input).length!==3||!Object.hasOwn(input,'stack')||!Object.hasOwn(input,'probeId')||!Object.hasOwn(input,'probeEntrySha256'))fail('PLAN_FIELDS');
 const plan=createHubStackBootPlan(input.stack);
 if(!input.stack.privateSources||!input.stack.dependencyLocks||!input.stack.crmPrivateFiles)fail('DEPENDENCY_PINS_REQUIRED');
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(input.probeId)||!/^[a-f0-9]{64}$/.test(input.probeEntrySha256))fail('PROBE_PIN');
 const entry=path.win32.join(input.stack.stackPackage.packageRoot,'scripts','canonical','hub-s4u-readiness-probe.ps1');
 const args=`-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "${entry}" -Action Probe -StartupConfigPath "${input.stack.startupConfig.path}" -StartupConfigSha256 ${input.stack.startupConfig.sha256} -ProbeEntrySha256 ${input.probeEntrySha256} -ProbeId ${input.probeId}`;
 const taskXml=plan.task.xml.replace(/<Triggers>[\s\S]*?<\/Triggers>/,'<Triggers />').replace('<ExecutionTimeLimit>PT0S</ExecutionTimeLimit>','<ExecutionTimeLimit>PT90S</ExecutionTimeLimit>')
  .replace(/<Arguments>[\s\S]*?<\/Arguments>/,`<Arguments>${xml(args)}</Arguments>`);
 return {preparationOnly:true,installed:false,executed:false,name:`Melisa-Hub-TEST-S4U-Probe-${input.probeId}`,ownerSid:input.stack.ownerSid,logonType:'S4U',runLevel:'Limited',taskXml,
  schedulerRestartCount:0,maxSeconds:90,entryPath:entry,entrySha256:input.probeEntrySha256,
  resultPath:path.win32.join(input.stack.runtimeRoot,'hub-stable-stack',`s4u-probe-${input.probeId}.json`),
  permissionChanges:[],providerRequests:false,serviceStartup:false,automaticRecovery:false,
  prerequisites:['Explicit separate approval to register and run this exact temporary task','Same owner batch-logon rights; no automatic grants','Fresh pinned candidate/private config/dependency locks','Delete only this approved temporary probe task after preserving its result; no existing task replacement']};
}
export function createHubTaskRecoveryPlan(snapshot,{approvedDisableHubAtLogon=false}={}){
 const names=new Set(['Melisa-Hub-TEST-Stack','Melisa-Hub-TEST-Web']);
 if(!snapshot||Object.keys(snapshot).length!==8||snapshot.schemaVersion!==1||snapshot.taskPath!=='\\'||!names.has(snapshot.taskName)
  ||!/^S-1-5-21-(?:[1-9]\d*-){3}[1-9]\d*$/.test(snapshot.ownerSid)||typeof snapshot.xml!=='string'||snapshot.xml.length>65536
  ||typeof snapshot.sddl!=='string'||snapshot.sddl.length>8192||!snapshot.sddl.startsWith('O:')
  ||hash(snapshot.xml)!==snapshot.xmlSha256||hash(snapshot.sddl)!==snapshot.sddlSha256)fail('SNAPSHOT_REJECTED');
 if(!snapshot.xml.includes(`<UserId>${snapshot.ownerSid}</UserId>`)||!snapshot.xml.includes('<RunLevel>LeastPrivilege</RunLevel>')||/HighestAvailable|ServiceAccount/.test(snapshot.xml))fail('SNAPSHOT_PRINCIPAL_REJECTED');
 const steps=[{action:'PreserveExactXmlAndSddl',taskName:snapshot.taskName,xmlSha256:snapshot.xmlSha256,sddlSha256:snapshot.sddlSha256}];
 if(snapshot.taskName==='Melisa-Hub-TEST-Web'&&approvedDisableHubAtLogon===true)steps.push({action:'DisableOnlyApprovedHubAtLogon',requiresSeparateActivationApproval:true});
 steps.push({action:'RestoreExactTaskDefinitionAndSecurityDescriptor',requiresSeparateRecoveryApproval:true,restoreXmlSha256:snapshot.xmlSha256,restoreSddlSha256:snapshot.sddlSha256});
 return {reviewOnly:true,applied:false,steps,stopProcesses:false,restoreDatabase:false,changeRoles:false,changeBatchRights:false,protectedTasks:['Melisa-ERP-TEST-Canonical','Melisa-CRM-TEST-Completion']};
}
