param()
# Narrow protected-file writer. Input is delivered on stdin, never command args.
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$owner='S-1-5-21-2170750028-1005938530-2568122015-1001'
if([Security.Principal.WindowsIdentity]::GetCurrent().User.Value -cne $owner){throw 'P03_CREATE_OWNER'}
$text=[Console]::In.ReadToEnd();if($text.Length -gt 4194304){throw 'P03_CREATE_SIZE'}
$inputValue=$text|ConvertFrom-Json
if($inputValue.runId -cnotmatch '\A[a-f0-9]{32}\z'){throw 'P03_CREATE_RUN'}
$root='C:\Users\Xaser\AppData\Local';$runId=$inputValue.runId
for($part=$root;$part;$part=[IO.Path]::GetDirectoryName($part)){$item=Get-Item -LiteralPath $part -Force;if(($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'P03_CREATE_REPARSE'}}
function Security([bool]$directory){
 $acl=if($directory){[Security.AccessControl.DirectorySecurity]::new()}else{[Security.AccessControl.FileSecurity]::new()}
 $acl.SetOwner([Security.Principal.SecurityIdentifier]::new($owner));$acl.SetAccessRuleProtection($true,$false)
 foreach($sid in @($owner,'S-1-5-18')){
  $inherit=if($directory){[Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit'}else{[Security.AccessControl.InheritanceFlags]::None}
  [void]$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($sid),[Security.AccessControl.FileSystemRights]::FullControl,$inherit,[Security.AccessControl.PropagationFlags]::None,[Security.AccessControl.AccessControlType]::Allow))
 }
 return $acl
}
function WriteNew([string]$leaf,$value){
 $path=Join-Path $root $leaf
 if(Test-Path -LiteralPath $path){throw 'P03_CREATE_EXISTS'}
 $bytes=[Convert]::FromBase64String($value.bytesBase64)
 if($bytes.Length -lt 100 -or $bytes.Length -gt 1048576){throw 'P03_CREATE_FILE_SIZE'}
 $hash=[BitConverter]::ToString(([Security.Cryptography.SHA256]::Create()).ComputeHash($bytes)).Replace('-','').ToLowerInvariant()
 if($hash -cne $value.sha256){throw 'P03_CREATE_HASH'}
 $fileAcl=Security $false
 $stream=New-Object IO.FileStream($path,[IO.FileMode]::CreateNew,[Security.AccessControl.FileSystemRights]::Write,[IO.FileShare]::None,4096,[IO.FileOptions]::WriteThrough,$fileAcl)
 try{$stream.Write($bytes,0,$bytes.Length);$stream.Flush($true)}finally{$stream.Dispose()}
 $acl=Get-Acl -LiteralPath $path
 if(-not $acl.AreAccessRulesProtected -or $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -cne $owner -or @($acl.Access).Count -ne 2 -or (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -cne $hash){throw 'P03_CREATE_READBACK'}
 return [ordered]@{path=$path;sha256=$hash}
}
$before=ConvertFrom-Json ([Text.UTF8Encoding]::new($false,$true).GetString([Convert]::FromBase64String($inputValue.before.bytesBase64)))
$profile=ConvertFrom-Json ([Text.UTF8Encoding]::new($false,$true).GetString([Convert]::FromBase64String($inputValue.profile.bytesBase64)))
$beforePath=Join-Path $root ('MelisaERP-P03-before-'+$runId+'.json');$profilePath=Join-Path $root ('MelisaERP-P03-profile-'+$runId+'.json');$recoveryPath=Join-Path $root ('MelisaERP-P03-recovery-'+$runId)
if($before.schemaVersion -cne 'melisa-p03-owner-observation.v3' -or $before.runId -cne $runId -or $before.ownerSid -cne $owner -or $before.database -cne 'MELISA_ERP_CRM_SHARED_TEST_20261009_02' -or $before.actualT1 -cne $false -or $profile.schemaVersion -cne 'melisa-p03-physical-profile.v1' -or $profile.beforeImage.path -cne $beforePath -or $profile.beforeImage.sha256 -cne $inputValue.before.sha256 -or $profile.journalDirectory -cne $recoveryPath){throw 'P03_CREATE_SCOPE'}
$age=([DateTime]::UtcNow-[DateTime]::Parse($before.observedAt).ToUniversalTime()).TotalSeconds;if($age -lt 0 -or $age -ge 60){throw 'P03_CREATE_STALE'}
foreach($path in @($beforePath,$profilePath,$recoveryPath)){if(Test-Path -LiteralPath $path){throw 'P03_CREATE_EXISTS'}}
$beforeRef=WriteNew ('MelisaERP-P03-before-'+$runId+'.json') $inputValue.before
$profileRef=WriteNew ('MelisaERP-P03-profile-'+$runId+'.json') $inputValue.profile
$dirAcl=Security $true
$directory=New-Object IO.DirectoryInfo($recoveryPath)
$directory.Create($dirAcl)
$read=Get-Acl -LiteralPath $recoveryPath
if(-not $read.AreAccessRulesProtected -or $read.GetOwner([Security.Principal.SecurityIdentifier]).Value -cne $owner -or @($read.Access).Count -ne 2){throw 'P03_CREATE_DIRECTORY_READBACK'}
[ordered]@{status='CREATED_PROTECTED';beforeImage=$beforeRef;profile=$profileRef;journalDirectory=$recoveryPath;runtimeMutation=$false}|ConvertTo-Json -Compress
