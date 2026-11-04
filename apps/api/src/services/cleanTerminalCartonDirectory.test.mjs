import test from'node:test';import assert from'node:assert/strict';import{mkdtemp,mkdir,readFile,writeFile,rm}from'node:fs/promises';import{execFileSync}from'node:child_process';import path from'node:path';import os from'node:os';
test('Windows carton ACL reader uses native host module despite incompatible inherited module discovery', {skip:process.platform!=='win32'},async t=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'melisa-carton-acl-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const journal=path.join(root,'journal'),modules=path.join(root,'modules'),fake=path.join(modules,'Microsoft.PowerShell.Security');await mkdir(journal);await mkdir(fake,{recursive:true});
 // No fake executable code: emulate the real failed autoload with a missing
 // implementation and an advertised Get-Acl. Only the real OS module may run.
 await writeFile(path.join(fake,'Microsoft.PowerShell.Security.psd1'),"@{ModuleVersion='99.0.0';RootModule='missing.psm1';CmdletsToExport=@('Get-Acl','Set-Acl')}\n");
 const windows=process.env.SystemRoot??'C:\\Windows',powershell=path.join(windows,'System32','WindowsPowerShell','v1.0','powershell.exe'),native=path.join(windows,'System32','WindowsPowerShell','v1.0','Modules');
 const env={...process.env,PSModulePath:modules+path.delimiter+native},literal=s=>"'"+s.replaceAll("'","''")+"'";
 const setup=path.join(root,'setup.ps1');await writeFile(setup,`$ErrorActionPreference='Stop'\nImport-Module -Name "$PSHOME\\Modules\\Microsoft.PowerShell.Security\\Microsoft.PowerShell.Security.psd1" -ErrorAction Stop\n$s=[Security.Principal.WindowsIdentity]::GetCurrent().User;$a=New-Object Security.AccessControl.DirectorySecurity;$a.SetOwner($s);$a.SetAccessRuleProtection($true,$false);$a.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($s,'FullControl','ContainerInherit,ObjectInherit','None','Allow')));Set-Acl -LiteralPath ${literal(journal)} -AclObject $a\n`);
 execFileSync(powershell,['-NoProfile','-NonInteractive','-File',setup],{env,windowsHide:true,timeout:8000,stdio:'pipe'});
 const source=await readFile(new URL('./cleanTerminalCartonDirectory.ps1',import.meta.url),'utf8'),target="'C:\\Sirket\\ERP\\clean\\20261022\\runtime\\carton-packing'";assert.equal(source.split(target).length,2);
 const reader=path.join(root,'reader.ps1');await writeFile(reader,source.replace(target,()=>literal(journal)));
 assert.doesNotMatch(source,/EncodedCommand|ExecutionPolicy|Set-Acl/);
 assert.doesNotThrow(()=>execFileSync(powershell,['-NoProfile','-NonInteractive','-File',reader],{env,windowsHide:true,timeout:8000,stdio:'pipe'}));
});
