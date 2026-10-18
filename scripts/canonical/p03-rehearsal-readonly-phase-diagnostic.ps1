# Fixed failed rehearsal only. Calls the sealed read-only mode; no cleanup/start/stop.
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue'
trap{$line=0;if($null-ne$_.InvocationInfo){$line=[int]$_.InvocationInfo.ScriptLineNumber};$kind=$_.Exception.GetType().Name;if($kind-cnotin@('PropertyNotFoundException','ParameterBindingException','PSInvalidCastException','ArgumentException','InvalidOperationException','RuntimeException','MethodInvocationException')){$kind='OtherException'};$code=if([string]$_.Exception.Message-cmatch'\bP03_[A-Z_]+\b'){$Matches[0]}else{'P03_REHEARSAL_DIAGNOSTIC_REJECTED'};[Console]::Error.WriteLine(($code+' TYPE_'+$kind+' LINE_'+$line));exit 1}
$root='C:\Sirket\ERP\rehearsal\P03-RECOVERY-20261018\run-a9f3edb13bab4c1ea805d550ce5480d2'
$profile=Join-Path $root 'profile.json';$before=Join-Path $root 'before.json';$engine=Join-Path $root 'recovery-engine.ps1'
$profileSha='87b8f1c5dcb6f92380d93ae4f5804dea55c0dd1148643efdf9f9105d82cefe71';$beforeSha='a99b3f3bbd6c16bb4761be10586b0d7f3ad63f843f5b6b99a8e6b25ed56add8f'
if((Get-FileHash -LiteralPath $profile -Algorithm SHA256).Hash.ToLowerInvariant()-cne$profileSha-or(Get-FileHash -LiteralPath $before -Algorithm SHA256).Hash.ToLowerInvariant()-cne$beforeSha){throw 'P03_REHEARSAL_DIAGNOSTIC_PIN'}
$common=@{Environment='Rehearsal';ProfilePath=$profile;ProfileSha256=$profileSha;BeforeImagePath=$before;BeforeImageSha256=$beforeSha}
# Prove the former argument shape fails in binding before any script body.
$bindingProbe={param([ValidateSet('Shared','Rehearsal')][string]$Environment)throw 'P03_REHEARSAL_DIAGNOSTIC_UNEXPECTED_BODY'}
$old=@('-Environment','Rehearsal');$oldRejected=$false
try{& $bindingProbe @old}catch{if($_.Exception.GetType().Name-cne'ParameterBindingValidationException'){throw};$oldRejected=$true}
if(-not$oldRejected){throw 'P03_REHEARSAL_DIAGNOSTIC_OLD_BINDING'}
# Preserve the corrected driver's exact invocation and conversion form.
$engineResult=(& $engine @common -Mode PreflightOld)|ConvertFrom-Json
if($engineResult.status-cne'OLD_PHYSICAL_PREFLIGHT'){throw 'P03_REHEARSAL_DIAGNOSTIC_STATUS'}
[ordered]@{status='READONLY_PHASE_CONVERSION_PASS';oldArrayBindingRejected=$oldRejected;oldErrorType='ParameterBindingValidationException';engineStatus=$engineResult.status;mutationExecuted=$false}|ConvertTo-Json
