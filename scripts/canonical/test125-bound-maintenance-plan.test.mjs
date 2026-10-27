import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import path from 'node:path';
const file=path.join(import.meta.dirname,'test125-bound-maintenance-plan.ps1');
const ps=path.join(process.env.SystemRoot||'C:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
const run=body=>execFileSync(ps,['-NoProfile','-NonInteractive','-Command',`. '${file.replaceAll("'","''")}' -Library; ${body}`],{encoding:'utf8'}).trim();
const win=(name,fn)=>test(name,{skip:process.platform!=='win32'},fn);
test('preparation contains no task/process mutation, runtime publication or database writer',()=>{
 const source=readFileSync(file,'utf8');
 assert.doesNotMatch(source,/^\s*(?:Stop-Process|Stop-ScheduledTask|Start-ScheduledTask|Register-ScheduledTask|Unregister-ScheduledTask|Write-ErpState|Invoke-Sqlcmd)\b/m);
 assert.doesNotMatch(source,/\.Stop\(|\.Run\(|applyProductCompletionPlan/);
 assert.match(source,/FileMode\]::CreateNew/);
});
win('library import is inert and CLI preserves execution flag across existing library parameters',()=>{
 assert.equal(run(`if(Get-Command Read-ErpStartupConfig){'PASS'}`),'PASS');
 const script=file.replaceAll("'","''");
 let failure;
 try{execFileSync(ps,['-NoProfile','-NonInteractive','-Command',`function Get-Content {throw 'FIXTURE_CONFIG_OBSERVED'};& '${script}'`],{encoding:'utf8'});}catch(error){failure=error;}
 assert.equal(failure?.status,1);
 assert.equal(JSON.parse(failure.stdout).code,'FIXTURE_CONFIG_OBSERVED');
});
const fixture=`
$cfg=[pscustomobject]@{RepoRoot='C:\\fixture\\repo';OwnerSid='S-1-fixture'};
$exe=Join-Path $env:SystemRoot 'System32\\WindowsPowerShell\\v1.0\\powershell.exe';
$argsText='-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "C:\\fixture\\repo\\scripts\\canonical\\start-owned-test.ps1" -StartupConfigPath "C:\\fixture\\startup.json"';
$task=[pscustomobject]@{TaskName='Melisa-ERP-TEST-Canonical';TaskPath='\\';State='Running';Settings=[pscustomobject]@{Enabled=$true;AllowHardTerminate=$true;MultipleInstances='IgnoreNew'};Principal=[pscustomobject]@{UserId='S-1-fixture';LogonType='Interactive';RunLevel='Limited'};Actions=@([pscustomobject]@{Execute=$exe;Arguments=$argsText;WorkingDirectory=$cfg.RepoRoot})};
`;
win('exact registered task identity accepts original; altered action, owner, state and restart policy reject',()=>{
 assert.equal(run(`${fixture}
 Assert-Test125MaintenanceTask $task $cfg 'C:\\fixture\\startup.json' | Out-Null;
 foreach($field in @('TaskName','State','owner','arguments','working','policy')){
  $copy=$task | ConvertTo-Json -Depth 8 | ConvertFrom-Json;
  switch($field){TaskName{$copy.TaskName='Other'} State{$copy.State='Ready'} owner{$copy.Principal.UserId='S-1-foreign'} arguments{$copy.Actions[0].Arguments+=' -Once'} working{$copy.Actions[0].WorkingDirectory='C:\\foreign'} policy{$copy.Settings.MultipleInstances='Parallel'}};
  $rejected=$false;try{Assert-Test125MaintenanceTask $copy $cfg 'C:\\fixture\\startup.json' | Out-Null}catch{$rejected=$true};if(!$rejected){throw 'ACCEPTED_BAD_TASK'}
 };'PASS'`),'PASS');
});
win('fresh boundary rejects changed PID birth, instance, source, task and package pins; observation time may advance',()=>{
 assert.equal(run(`
 $before=[pscustomobject]@{runId='run';source='source';database='TEST';startupHash='config';launcherHash='launcher';manifestHash='manifest';taskXmlHash='task';taskInstance='instance';supervisor=100;supervisorBirth='birth';children=@{api=@{pid=101;birth='child'}};observedAt='old'};
 $after=$before | ConvertTo-Json -Depth 8 | ConvertFrom-Json;$after.observedAt='new';Assert-Test125MaintenancePin $before $after;
 foreach($field in @('runId','source','database','startupHash','launcherHash','manifestHash','taskXmlHash','taskInstance','supervisor','supervisorBirth','children')){
  $after=$before | ConvertTo-Json -Depth 8 | ConvertFrom-Json;$after.$field='changed';$rejected=$false;try{Assert-Test125MaintenancePin $before $after}catch{$rejected=$true};if(!$rejected){throw 'ACCEPTED_STALE_BOUNDARY'}
 };'PASS'`),'PASS');
});
