import test from 'node:test';import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';import {readFileSync} from 'node:fs';import path from 'node:path';
const file=path.join(import.meta.dirname,'test125-bound-api-quiescence.ps1'),ps=path.join(process.env.SystemRoot||'C:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
const run=body=>execFileSync(ps,['-NoProfile','-NonInteractive','-Command',`. '${file.replaceAll("'","''")}'; ${body}`],{encoding:'utf8',timeout:20000}).trim();
const win=(name,fn)=>test(name,{skip:process.platform!=='win32'},fn);
win('negative approval batch requires its exact admission and rejects previous run receipt',()=>{
 assert.equal(run(`
 $selected='PRODUCT-b40b0745-1fa0-4970-b19f-1479cf75d67a';
 $a=[pscustomobject]@{schema='melisa-test125-bound-maintenance-preparation.v1';runId=$selected;source='edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d';database='MELISA_ERP_SIRKET_TEST_20260929_01';children=@{api=@{port=4144};native=@{port=4146};web=@{port=5194}}};
 Assert-Test125ApiAdmission $a $selected;
 $a.runId='PRODUCT-b1e30e7c-1349-47b0-b9e8-cad0ae164cc8';
 try{Assert-Test125ApiAdmission $a $selected;throw 'UNEXPECTED_ACCEPT'}catch{if($_.Exception.Message -ne 'TEST125_API_SCOPE_REJECTED'){throw}};
 'PASS'`),'PASS');
});
test('narrow library has no automatic task action, PID stop, SQL writer or host creation',()=>{
 const s=readFileSync(file,'utf8');assert.doesNotMatch(s,/Stop-Process|Stop-ScheduledTask|Start-ScheduledTask|Start-Process|applyProductCompletionPlan|Register-ScheduledTask/);
 assert.match(s,/TerminateProcess\(h,1\)/);assert.match(s,/\[Test125ApiKernel\]::Stop\(\$Binding.handle,\$Binding.birth\)/);
});
win('import is inert; wrong target, run, source or API port rejects before process access',()=>{
 assert.equal(run(`
 function Get-Test125BoundMaintenancePlan {throw 'UNEXPECTED_RUNTIME_ACCESS'}
 $a=[pscustomobject]@{schema='melisa-test125-bound-maintenance-preparation.v1';runId='PRODUCT-48099bf7-757f-451a-885c-68125da8c9e7';source='edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d';database='MELISA_ERP_SIRKET_TEST_20260929_01';children=@{api=@{port=4144};native=@{port=4146};web=@{port=5194}}};
 Assert-Test125ApiAdmission $a;
 foreach($field in @('runId','source','database','port')){$copy=$a | ConvertTo-Json -Depth 8 | ConvertFrom-Json;if($field -eq 'port'){$copy.children.api.port=4194}else{$copy.$field='foreign'};$rejected=$false;try{Open-Test125ApiQuiescence $copy | Out-Null}catch{if($_.Exception.Message -ne 'TEST125_API_SCOPE_REJECTED'){throw};$rejected=$true};if(!$rejected){throw 'ACCEPTED_FOREIGN'}};'PASS'`),'PASS');
});
win('real isolated process handle rejects wrong birth, stops only retained object, and cannot target next child',()=>{
 const node=process.execPath.replaceAll("'","''");
 assert.equal(run(`Initialize-Test125ApiKernel;
 $child=Start-Process -FilePath '${node}' -ArgumentList @('-e','"setTimeout(()=>{},15000)"') -WindowStyle Hidden -PassThru;
 $handle=$null;$other=$null;
 try{
  $p=Get-CimInstance Win32_Process -Filter ('ProcessId='+$child.Id);$birth=$p.CreationDate.ToUniversalTime().Ticks;
  $rejected=$false;try{$bad=[Test125ApiKernel]::Open($child.Id,$birth-10000000);$bad.Dispose()}catch{$rejected=$true};if(!$rejected -or $child.HasExited){throw 'WRONG_BIRTH_DID_NOT_REJECT'};
  $handle=[Test125ApiKernel]::Open($child.Id,$birth);
  $rejected=$false;try{[Test125ApiKernel]::Stop($handle,$birth-10000000)}catch{$rejected=$true};if(!$rejected -or $child.HasExited){throw 'WRONG_STOP_BIRTH'};
  [Test125ApiKernel]::Stop($handle,$birth);if(![Test125ApiKernel]::Exited($handle,$birth)){throw 'NOT_EXITED'};
  $other=Start-Process -FilePath '${node}' -ArgumentList @('-e','"setTimeout(()=>{},15000)"') -WindowStyle Hidden -PassThru;
  $rejected=$false;try{[Test125ApiKernel]::Stop($handle,$birth)}catch{$rejected=$true};if(!$rejected -or $other.HasExited){throw 'OLD_HANDLE_TARGETED_OTHER_CHILD'};
  'PASS'
 }finally{if($handle){$handle.Dispose()};foreach($own in @($child,$other)){if($own -and !$own.HasExited){$own.Kill();$own.WaitForExit()};if($own){$own.Dispose()}}}`),'PASS');
});
win('foreign binding cannot enter, stop, claim pause or release existing ownership',()=>{
 const commands=['Enter-'+ 'Test125ApiQuiescence','Stop-'+ 'Test125BoundApi','Test-'+ 'Test125ApiPhysicalPause','Close-'+ 'Test125ApiQuiescence'];
 const expected=['TEST125','API','BINDING','NOT','OWNED'].join('_');
 assert.equal(run(`foreach($command in @(${commands.map(s=>`'${s}'`).join(',')})){$rejected=$false;try{& $command ([pscustomobject]@{}) | Out-Null}catch{if($_.Exception.Message -ne '${expected}'){throw};$rejected=$true};if(!$rejected){throw 'FOREIGN_BINDING_ACCEPTED'}};'PASS'`),'PASS');
});

win('explicit selected product run is bound in fresh admission; old or arbitrary run cannot stand in',()=>{
 assert.equal(run(`
 $oldRun='PRODUCT-48099bf7-757f-451a-885c-68125da8c9e7';$newRun='PRODUCT-b1e30e7c-1349-47b0-b9e8-cad0ae164cc8';
 $a=[pscustomobject]@{schema='melisa-test125-bound-maintenance-preparation.v1';runId=$newRun;source='edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d';database='MELISA_ERP_SIRKET_TEST_20260929_01';children=@{api=@{port=4144};native=@{port=4146};web=@{port=5194}}};
 Assert-Test125ApiAdmission $a $newRun;
 $count=0;foreach($expected in @($oldRun,'PRODUCT-00000000-0000-4000-8000-000000000001')){try{Assert-Test125ApiAdmission $a $expected;throw 'UNEXPECTED_ACCEPT'}catch{if($_.Exception.Message -ne 'TEST125_API_SCOPE_REJECTED'){throw};$count++}};
 $a.runId=$oldRun;try{Assert-Test125ApiAdmission $a $newRun;throw 'OLD_RECEIPT_ACCEPTED'}catch{if($_.Exception.Message -ne 'TEST125_API_SCOPE_REJECTED'){throw};$count++};Assert-Test125ApiAdmission $a;
 function Read-ErpStartupConfig {throw 'UNEXPECTED_RUNTIME_ACCESS'};
 try{Get-Test125BoundMaintenancePlan -RunId 'PRODUCT-00000000-0000-4000-8000-000000000001';throw 'UNEXPECTED_ACCEPT'}catch{if($_.Exception.Message -ne 'TEST125_RUN_SCOPE_REJECTED'){throw};$count++};
 if($count -ne 4){throw 'NEGATIVE_COUNT'};'PASS'`),'PASS');
 const source=readFileSync(file,'utf8');assert.match(source,/Get-Test125BoundMaintenancePlan -RunId \$ExpectedRunId/);
});
