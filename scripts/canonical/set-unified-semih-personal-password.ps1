param([Parameter(Mandatory=$true)][string]$ExpectedOwnerSid,[Parameter(Mandatory=$true)][string]$PinFile,[Parameter(Mandatory=$true)][string]$PinHash)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Host.UI.RawUI.WindowTitle='MELISA - Semih TEST parola belirleme'
$secure=$null;$repeat=$null;$plain=$null;$again=$null;$human=$null;$script:pendingBody=$null
try {
 if($PSVersionTable.PSVersion.Major -lt 7){throw 'POWERSHELL_7_REQUIRED'}
 if([Security.Principal.WindowsIdentity]::GetCurrent().User.Value -cne $ExpectedOwnerSid){throw 'OWNER_CHANGED'}
 if((Get-FileHash -LiteralPath $PinFile).Hash -cne $PinHash){throw 'SETUP_PINS_CHANGED'}
 $pins=Get-Content -LiteralPath $PinFile -Raw|ConvertFrom-Json
 if($pins.kind -cne 'SEMIH_PERSONAL_PASSWORD_LOCAL_SETUP' -or $pins.userId -ne 17 -or $pins.roleId -ne 17){throw 'SETUP_SCOPE_CHANGED'}
 function Lock-SemihSetupPins {
  if((Get-FileHash -LiteralPath $PinFile).Hash -cne $PinHash){throw 'SETUP_PINS_CHANGED'}
  $held=[Collections.Generic.List[IO.FileStream]]::new()
  try{
   foreach($file in $pins.files){
    $full=[IO.Path]::GetFullPath($file.path)
    if(!$full.StartsWith('C:\Sirket\ERP\',[StringComparison]::OrdinalIgnoreCase)){throw 'SETUP_PATH_SCOPE'}
    for($at=$full;$at;$at=[IO.Path]::GetDirectoryName($at)){if((Get-Item -LiteralPath $at -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'SETUP_REPARSE'}}
    $held.Add([IO.FileStream]::new($full,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read))
    if((Get-FileHash -LiteralPath $full).Hash -ine $file.sha256){throw 'SETUP_SOURCE_CHANGED'}
   }
   return ,$held
  }catch{foreach($stream in $held){$stream.Dispose()};throw}
 }
 function Invoke-SemihSetupChild([string]$Mode,[string]$Preparation) {
  $start=[Diagnostics.ProcessStartInfo]::new()
  $start.FileName=$pins.node;$start.UseShellExecute=$false;$start.CreateNoWindow=$true
  $start.RedirectStandardInput=$true;$start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true
  $start.ArgumentList.Add($pins.helper);$start.ArgumentList.Add($Mode);$start.ArgumentList.Add('--owner-sid');$start.ArgumentList.Add($ExpectedOwnerSid)
  if($Preparation){$start.ArgumentList.Add('--preparation');$start.ArgumentList.Add($Preparation)}
  $start.Environment.Clear()
  foreach($name in @('SystemRoot','WINDIR','ComSpec','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA','HOMEDRIVE','HOMEPATH')){$value=[Environment]::GetEnvironmentVariable($name);if($value){$start.Environment[$name]=$value}}
  $start.Environment['PATH']=$env:SystemRoot+'\System32;'+$env:SystemRoot+'\System32\WindowsPowerShell\v1.0'
  $child=[Diagnostics.Process]::new();$child.StartInfo=$start
  try {
   if(!$child.Start()){throw 'SETUP_CHILD_START'}
   # No plaintext function parameter or cmdlet pipeline for module logging.
   if($Mode -ceq '--apply' -and $script:pendingBody){$child.StandardInput.Write($script:pendingBody)}
   $child.StandardInput.Close();$outTask=$child.StandardOutput.ReadToEndAsync();$errTask=$child.StandardError.ReadToEndAsync()
   if(!$child.WaitForExit(45000)){$child.Kill();throw 'SETUP_CHILD_OUTCOME_REVIEW'}
   $output=$outTask.GetAwaiter().GetResult();$null=$errTask.GetAwaiter().GetResult()
   if($child.ExitCode -ne 0 -or $output.Length -gt 8192){throw 'SETUP_CHILD_OUTCOME_REVIEW'}
   return $output|ConvertFrom-Json
  } finally {$child.Dispose()}
 }
 function Invoke-PinnedSemihSetup([string]$Mode,[string]$Preparation){
  $held=Lock-SemihSetupPins
  try{return Invoke-SemihSetupChild $Mode $Preparation}finally{foreach($stream in $held){$stream.Dispose()}}
 }
 $prepared=Invoke-PinnedSemihSetup '--prepare' ''
 if($prepared.status -cne 'READY_FOR_HUMAN_NEW_PASSWORD' -or $prepared.username -cne 'unified-semih-test' -or $prepared.userId -ne 17 -or $prepared.roleId -ne 17 -or $prepared.sqlWrites -ne 0 -or $prepared.oldCredentialRead -ne $false){throw 'SETUP_PREPARATION_REJECTED'}
 Write-Host 'YALNIZ SEMIH TEST HESABI - 5244' -ForegroundColor Green
 Write-Host 'Kullanici: unified-semih-test'
 Write-Host 'Diger hesaplar, roller, ERP/CRM verileri ve 5194 degismeyecek.'
 Write-Host 'Yeni parola dosyaya veya sohbete yazilmaz. Eski parola okunmaz.'
 Write-Host 'Baska bir yerde kullanmadiginiz, 8-64 karakterlik bir parola secin.'
 $secure=Read-Host 'Yeni parola (ekranda gizli)' -AsSecureString
 $repeat=Read-Host 'Yeni parolayi tekrar yazin (ekranda gizli)' -AsSecureString
 if($secure.Length -lt 8 -or $secure.Length -gt 64 -or $repeat.Length -ne $secure.Length){throw 'PASSWORD_INPUT_REJECTED'}
 $a=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure);$b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($repeat)
 try{$plain=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($a);$again=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($b)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($a);[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b)}
 if(![string]::Equals($plain,$again,[StringComparison]::Ordinal) -or [Text.Encoding]::UTF8.GetByteCount($plain) -gt 72){throw 'PASSWORD_INPUT_REJECTED'}
 Write-Host 'Bu hesabinizdaki eski oturumlari kapatir; yeni parolanizla 5244 girisi yaparsiniz.'
 $confirmed=Read-Host 'Yalniz bu hesabin parolasini kaydetmek icin BEN BELIRLEDIM yazin; iptal icin Enter'
 if($confirmed -cne 'BEN BELIRLEDIM'){throw 'USER_CANCELLED'}
 $human=[Collections.Generic.Dictionary[string,string]]::new();$human.Add('password',$plain);$human.Add('confirmation','BEN BELIRLEDIM')
 $script:pendingBody=[Text.Json.JsonSerializer]::Serialize($human,[Collections.Generic.Dictionary[string,string]],[Text.Json.JsonSerializerOptions]::new())
 $result=Invoke-PinnedSemihSetup '--apply' $prepared.preparation
 $script:pendingBody=$null;$human.Clear();$plain=$null;$again=$null
 if($result.status -notin @('COMPLETED_USER_PASSWORD_SET','ALREADY_COMPLETED_NO_SECOND_UPDATE')){throw 'SETUP_RESULT_REVIEW'}
 Write-Host 'TAMAMLANDI. 5244 ekraninda unified-semih-test ve yeni parolanizla giris yapin.' -ForegroundColor Green
 Write-Host 'Parolanizi sohbete yazmayin. Acik kullanici sekmelerini kapatmayin.'
} catch {
 Write-Host 'Islem tamamlandigi dogrulanamadi veya iptal edildi. Ayni islemi tekrar baslatmayin; ajan kaydi kontrol edecek.' -ForegroundColor Yellow
} finally {
 $script:pendingBody=$null;$plain=$null;$again=$null
 if($human){$human.Clear()}
 if($secure){$secure.Dispose()};if($repeat){$repeat.Dispose()}
 [void](Read-Host 'Bu pencereyi kapatmak icin Enter')
}
