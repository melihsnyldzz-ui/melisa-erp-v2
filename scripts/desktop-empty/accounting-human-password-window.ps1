# Human-owned password entry and submission. The agent may open/observe this
# window but must never enter a password, click Save, or invoke --apply itself.
param(
 [Parameter(Mandatory)][string]$BindingFile,
 [Parameter(Mandatory)][ValidatePattern('^[a-f0-9]{64}$')][string]$ExpectedBindingSha256,
 [ValidatePattern('^v[1-9][0-9]{0,2}$')][string]$WindowAttemptLabel='v1'
)
$ErrorActionPreference='Stop'
$held=[Collections.Generic.List[IO.FileStream]]::new()
$proofRoot='C:/Users/Xaser/Desktop/ERP/kurulum/k10-role-gap-followup-v1/accounting-persona-v1/human-password-v1'
$script:pendingBody=$null
$schemaOwnerLock=$null
function Save-PublicState([string]$name,$value){
 $at=Get-Item -LiteralPath $proofRoot -Force
 while($at){if(($at.Attributes-band[IO.FileAttributes]::ReparsePoint)-ne0){throw 'HUMAN_PASSWORD_OUTPUT_REPARSE'};$at=if($at-is[IO.FileInfo]){$at.Directory}else{$at.Parent}}
 $p=Join-Path $proofRoot $(if($WindowAttemptLabel-ceq'v1'){$name}else{$WindowAttemptLabel+'-'+$name})
 $s=[IO.File]::Open($p,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
 try{$bytes=[Text.UTF8Encoding]::new($false).GetBytes(($value|ConvertTo-Json -Depth 5)+"`n");$s.Write($bytes);$s.Flush($true)}finally{$s.Dispose()}
}
function Hold-PinnedFile([string]$p,[string]$sha){
 $at=Get-Item -LiteralPath $p -Force
 if($at.PSIsContainer){throw 'HUMAN_PASSWORD_FILE'}
 while($at){if(($at.Attributes-band[IO.FileAttributes]::ReparsePoint)-ne0){throw 'HUMAN_PASSWORD_REPARSE'};$at=if($at-is[IO.FileInfo]){$at.Directory}else{$at.Parent}}
 $stream=[IO.File]::Open($p,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);$held.Add($stream)
 if([Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($stream)).ToLowerInvariant()-cne$sha){throw 'HUMAN_PASSWORD_SOURCE_CHANGED'}
}
function Assert-RunningTarget {
 if([Security.Principal.WindowsIdentity]::GetCurrent().Name-cne'SEMIH\Xaser'){throw 'HUMAN_PASSWORD_OWNER'}
 $proof=$script:binding.runtimeProof
 foreach($expected in $proof.processes){
  $p=Get-CimInstance Win32_Process -Filter ('ProcessId='+[int]$expected.ProcessId)
  if(!$p-or$p.ParentProcessId-ne$expected.ParentProcessId-or$p.CreationDate.ToUniversalTime().Ticks-ne[DateTimeOffset]::Parse($expected.CreationDate).UtcTicks-or$p.CommandLine-cne$expected.CommandLine-or$p.ExecutablePath-cne$expected.ExecutablePath){throw 'HUMAN_PASSWORD_RUNTIME_CHANGED'}
 }
 $sql=Get-CimInstance Win32_Process -Filter 'ProcessId=8440'
 if(!$sql-or$sql.CreationDate.ToUniversalTime().Ticks-ne[DateTimeOffset]::Parse('2026-11-10T00:32:27.3873190Z').UtcTicks){throw 'HUMAN_PASSWORD_SQL_CHANGED'}
 $ports=@(Get-NetTCPConnection -State Listen|Where-Object LocalPort -in 4294,5294)
 if($ports.Count-ne2-or@($ports|Where-Object {$_.LocalAddress-cne'127.0.0.1'-or$_.OwningProcess-ne18484}).Count-ne0-or@($ports.LocalPort|Sort-Object -Unique).Count-ne2){throw 'HUMAN_PASSWORD_PORTS_CHANGED'}
}
function Invoke-HumanPasswordChild([string]$Mode){
 Assert-RunningTarget
 $info=[Diagnostics.ProcessStartInfo]::new();$info.FileName=$script:binding.node;$info.UseShellExecute=$false;$info.CreateNoWindow=$true
 $info.RedirectStandardInput=$true;$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true
 $info.ArgumentList.Add($script:binding.helper);$info.ArgumentList.Add($Mode)
 $info.Environment.Remove('NODE_OPTIONS');$info.Environment.Remove('NODE_PATH')
 $p=[Diagnostics.Process]::new();$p.StartInfo=$info
 try{
  if(!$p.Start()){throw 'HUMAN_PASSWORD_CHILD_START'}
  if($Mode-ceq'--apply'){$p.StandardInput.Write($script:pendingBody)}
  $p.StandardInput.Close();$out=$p.StandardOutput.ReadToEndAsync();$err=$p.StandardError.ReadToEndAsync()
  # A mutation child is never killed/timed out/retried; it owns its transaction.
  $p.WaitForExit();$resultText=$out.GetAwaiter().GetResult();$errorText=$err.GetAwaiter().GetResult()
  if($p.ExitCode-ne0-or$resultText.Length-gt16000){
   if($Mode-ceq'--prepare'-and$errorText.Trim()-cmatch'^ACCOUNTING_HUMAN_[A-Z_]+$'){throw $errorText.Trim()}
   throw 'HUMAN_PASSWORD_OUTCOME_REVIEW_REQUIRED'
  }
  return $resultText|ConvertFrom-Json
 }finally{$p.Dispose()}
}
try{
 $bindingName=if($WindowAttemptLabel-ceq'v1'){'window-binding.json'}else{'window-binding.'+$WindowAttemptLabel+'.json'}
 if([IO.Path]::GetFullPath($BindingFile)-cne[IO.Path]::GetFullPath($proofRoot+'/'+$bindingName)){throw 'HUMAN_PASSWORD_BINDING_PATH'}
 Hold-PinnedFile $BindingFile $ExpectedBindingSha256
 $script:binding=Get-Content -LiteralPath $BindingFile -Raw|ConvertFrom-Json -DateKind String
 if($script:binding.kind-cne'ACCOUNTING_HUMAN_PASSWORD_WINDOW_V1'-or$script:binding.userId-ne30018-or$script:binding.roleId-ne19-or$script:binding.username-cne'erp_muhasebe_deneme'){throw 'HUMAN_PASSWORD_BINDING'}
 foreach($pin in $script:binding.pins){Hold-PinnedFile $pin.path $pin.sha256}
 $schemaOwnerLock=[IO.File]::Open('C:/Users/Xaser/Desktop/ERP/desktop-empty-schema.owner.lock',[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
 $ready=Invoke-HumanPasswordChild '--prepare'
 if($ready.status-cne'READY_FOR_HUMAN_PASSWORD'-or$ready.userId-ne30018-or$ready.roleId-ne19-or$ready.sqlWrites-ne0){throw 'HUMAN_PASSWORD_NOT_READY'}
 Add-Type -AssemblyName System.Windows.Forms
 Add-Type -AssemblyName System.Drawing
 $form=[Windows.Forms.Form]::new();$form.Text='ERP Muhasebe - Parola yenileme';$form.ClientSize=[Drawing.Size]::new(580,365)
 $form.StartPosition='CenterScreen';$form.FormBorderStyle='FixedDialog';$form.MaximizeBox=$false;$form.MinimizeBox=$false;$form.TopMost=$true
 $form.Font=[Drawing.Font]::new('Segoe UI',10)
 $title=[Windows.Forms.Label]::new();$title.Text='Muhasebe hesabının yeni parolası';$title.Location=[Drawing.Point]::new(22,20);$title.Size=[Drawing.Size]::new(535,30);$title.Font=[Drawing.Font]::new('Segoe UI',13,[Drawing.FontStyle]::Bold);$form.Controls.Add($title)
 $description=[Windows.Forms.Label]::new();$description.Text="Hesap: erp_muhasebe_deneme`nYalnız yerel ERP TEST hesabı. En az 8 karakter kullanın.`nParolayı sohbete yazmayın; diğer hesaplar ve yetkiler değişmez.";$description.Location=[Drawing.Point]::new(22,58);$description.Size=[Drawing.Size]::new(535,72);$form.Controls.Add($description)
 $label1=[Windows.Forms.Label]::new();$label1.Text='Yeni parola';$label1.Location=[Drawing.Point]::new(22,146);$label1.Size=[Drawing.Size]::new(160,26);$form.Controls.Add($label1)
 $first=[Windows.Forms.TextBox]::new();$first.Location=[Drawing.Point]::new(190,142);$first.Size=[Drawing.Size]::new(365,28);$first.UseSystemPasswordChar=$true;$first.MaxLength=64;$form.Controls.Add($first)
 $label2=[Windows.Forms.Label]::new();$label2.Text='Yeni parola tekrar';$label2.Location=[Drawing.Point]::new(22,187);$label2.Size=[Drawing.Size]::new(160,26);$form.Controls.Add($label2)
 $repeat=[Windows.Forms.TextBox]::new();$repeat.Location=[Drawing.Point]::new(190,183);$repeat.Size=[Drawing.Size]::new(365,28);$repeat.UseSystemPasswordChar=$true;$repeat.MaxLength=64;$form.Controls.Add($repeat)
 $status=[Windows.Forms.Label]::new();$status.Text='Hazır. Yeni parolayı iki kez girip kaydedin.';$status.Location=[Drawing.Point]::new(22,230);$status.Size=[Drawing.Size]::new(535,62);$form.Controls.Add($status)
 $save=[Windows.Forms.Button]::new();$save.Text='Parolayı kaydet';$save.Location=[Drawing.Point]::new(365,307);$save.Size=[Drawing.Size]::new(190,38);$form.Controls.Add($save)
 $cancel=[Windows.Forms.Button]::new();$cancel.Text='Kapat';$cancel.Location=[Drawing.Point]::new(22,307);$cancel.Size=[Drawing.Size]::new(110,38);$cancel.Add_Click({$form.Close()});$form.Controls.Add($cancel);$form.CancelButton=$cancel
 # No AcceptButton: Enter in a password box does not submit accidentally.
 $save.Add_Click({
  $plain=$null;$again=$null;$body=$null
  try{
   $plain=$first.Text;$again=$repeat.Text
   if($plain.Length-lt8-or$plain.Length-gt64-or[Text.Encoding]::UTF8.GetByteCount($plain)-gt72-or![string]::Equals($plain,$again,[StringComparison]::Ordinal)){
    $status.Text='Parolalar aynı olmalı; 8-64 karakter ve en çok 72 UTF-8 bayt kullanın.';return
   }
   $save.Enabled=$false;$cancel.Enabled=$false;$first.Enabled=$false;$repeat.Enabled=$false;$status.Text='Kaydediliyor. Pencereyi kapatmayın.';$form.Refresh()
   $body=[Collections.Generic.Dictionary[string,object]]::new();$body.Add('password',$plain);$body.Add('passwordConfirmation',$again);$body.Add('confirmation',$true)
   $script:pendingBody=[Text.Json.JsonSerializer]::Serialize($body,[Collections.Generic.Dictionary[string,object]],[Text.Json.JsonSerializerOptions]::new())
   $first.Clear();$repeat.Clear();$plain=$null;$again=$null
   $result=Invoke-HumanPasswordChild '--apply'
   if($result.status-cne'HUMAN_PASSWORD_SAVED'-or$result.userId-ne30018-or$result.roleId-ne19){throw 'HUMAN_PASSWORD_SAVE_UNCONFIRMED'}
   $status.ForeColor=[Drawing.Color]::DarkGreen;$status.Text="Parola kaydedildi.`nERP girişinde erp_muhasebe_deneme ve yeni parolanızı kullanın."
  }catch{
   $status.ForeColor=[Drawing.Color]::DarkRed;$status.Text="Kayıt doğrulanamadı. Tekrar denemeyin; ajan sonuç kaydını inceleyecek."
  }finally{$script:pendingBody=$null;if($body){$body.Clear()};$plain=$null;$again=$null;$first.Clear();$repeat.Clear();$cancel.Enabled=$true}
 })
 $form.Add_Shown({$first.Focus()})
 Save-PublicState 'window-opened.json' @{status='READY_FOR_HUMAN_ENTRY';time=[DateTime]::UtcNow.ToString('o');userId=30018;passwordEnteredByAgent=$false;sqlWrites=0;processId=$PID}
 [void]$form.ShowDialog();$form.Dispose()
}catch{
 if(Test-Path -LiteralPath $proofRoot){Save-PublicState 'window-failure.json' @{status='WINDOW_NOT_READY';time=[DateTime]::UtcNow.ToString('o');code=if($_.Exception.Message-cmatch'^[A-Z_]+$'){$_.Exception.Message}else{'LOCAL_WINDOW_NOT_READY'};automaticRetryAllowed=$false}}
}finally{$script:pendingBody=$null;if($schemaOwnerLock){$schemaOwnerLock.Dispose()};foreach($stream in $held){$stream.Dispose()}}
