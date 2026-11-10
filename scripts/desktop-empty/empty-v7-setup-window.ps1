# Native local first-owner form. Only the human may type and press Kaydet.
# No agent input, automatic Save, browser transfer, auth API or password log.
param([Parameter(Mandatory)][ValidatePattern('^[a-f0-9]{64}$')][string]$ExpectedDecisionSha256)
$ErrorActionPreference='Stop'
$root='C:/Users/Xaser/Desktop/ERP';$source=$root+'/runtime-clean-v7';$proofRoot=$root+'/kurulum/empty-profile-db9-v1'
$decisionFile=$proofRoot+'/root-first-owner-decision.v1.json';$privateRoot=$proofRoot+'/protected-sql-writer-v1'
$node='C:/Program Files/nodejs/node.exe';$held=[Collections.Generic.List[IO.FileStream]]::new();$ownerLock=$null;$script:body=$null
if('EmptySetupBoundedPipe' -as [type]){throw 'EMPTY_SETUP_TYPE_COLLISION'}
Add-Type -TypeDefinition @'
using System;using System.IO;using System.Text;using System.Threading.Tasks;
public static class EmptySetupBoundedPipe{
 public static async Task<string> Read(TextReader r,int max){var b=new char[1024];var text=new StringBuilder();bool over=false;for(;;){int n=await r.ReadAsync(b,0,b.Length).ConfigureAwait(false);if(n==0)return over?null:text.ToString();if(text.Length+n<=max&&!over)text.Append(b,0,n);else over=true;Array.Clear(b,0,n);}}
}
'@
function Assert-Ancestors([string]$p){$at=Get-Item -LiteralPath $p -Force;while($at){if(($at.Attributes-band[IO.FileAttributes]::ReparsePoint)-ne0){throw 'EMPTY_SETUP_REPARSE'};$at=if($at-is[IO.FileInfo]){$at.Directory}else{$at.Parent}}}
function Hold([string]$p,[string]$sha){
 Assert-Ancestors $p
 $s=[IO.File]::Open($p,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);$held.Add($s)
 if($sha-cnotmatch'^[a-f0-9]{64}$'-or[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($s)).ToLowerInvariant()-cne$sha){throw 'EMPTY_SETUP_PIN'}
}
function Public-New([string]$name,$v){
 if($name-cnotmatch'^[a-z0-9.-]+\.json$'){throw 'EMPTY_SETUP_OUTPUT'};Assert-Ancestors $proofRoot
 $s=[IO.File]::Open(($proofRoot+'/'+$name),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
 try{$b=[Text.UTF8Encoding]::new($false).GetBytes(($v|ConvertTo-Json -Depth 8)+"`n");$s.Write($b);$s.Flush($true)}finally{$s.Dispose()}
}
function Assert-PrivateRoot {
 Assert-Ancestors $privateRoot;$a=Get-Acl -LiteralPath $privateRoot;$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User
 $rules=@($a.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))
 if(!$a.AreAccessRulesProtected-or$a.GetOwner([Security.Principal.SecurityIdentifier]).Value-cne$sid.Value-or$rules.Count-ne1-or$rules[0].IdentityReference.Value-cne$sid.Value-or$rules[0].AccessControlType-ne'Allow'-or$rules[0].FileSystemRights-ne'FullControl'){throw 'EMPTY_SETUP_PRIVATE_ACL'}
}
function Child([string]$mode){
 $p=[Diagnostics.ProcessStartInfo]::new();$p.FileName=$node;$p.UseShellExecute=$false;$p.CreateNoWindow=$true;$p.WorkingDirectory=$source
 $p.RedirectStandardInput=$true;$p.RedirectStandardOutput=$true;$p.RedirectStandardError=$true;$p.Environment.Clear();$p.Environment['SystemRoot']='C:\Windows';$p.Environment['WINDIR']='C:\Windows';$p.Environment['NODE_ENV']='production'
 [void]$p.ArgumentList.Add(($source+'/scripts/desktop-empty/empty-v7-setup-local.mjs'));[void]$p.ArgumentList.Add($mode);[void]$p.ArgumentList.Add($ExpectedDecisionSha256)
 $child=[Diagnostics.Process]::new();$child.StartInfo=$p
 try{if(!$child.Start()){throw 'EMPTY_SETUP_CHILD'};if($mode-ceq'--apply'){$child.StandardInput.Write($script:body)};$child.StandardInput.Close()
  $o=[EmptySetupBoundedPipe]::Read($child.StandardOutput,256);$e=[EmptySetupBoundedPipe]::Read($child.StandardError,256)
  # A submitted setup child is never killed, retried or timed out.
  $child.WaitForExit();$text=$o.GetAwaiter().GetResult();$errors=$e.GetAwaiter().GetResult()
  if($child.ExitCode-ne0-or$null-eq$text-or$null-eq$errors-or$errors.Length-ne0){throw 'EMPTY_SETUP_OUTCOME_REVIEW_REQUIRED'};return $text
 }finally{$child.Dispose()}
}
try{
 $id=[Security.Principal.WindowsIdentity]::GetCurrent();$principal=[Security.Principal.WindowsPrincipal]::new($id)
 if($PSVersionTable.PSVersion-lt[version]'7.5'-or$id.Name-cne'SEMIH\Xaser'-or!$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'EMPTY_SETUP_WINDOWS_OWNER'}
 Assert-Ancestors $proofRoot
 Hold $decisionFile $ExpectedDecisionSha256;$d=Get-Content -Raw -LiteralPath $decisionFile|ConvertFrom-Json -AsHashtable -DateKind String
 if($d.state-cne'ROOT_EMPTY_V7_FIRST_SETUP_DECISION_V1'-or$d.ownerSid-cne$id.User.Value-or$d.schema7Accepted-ne$true-or$d.firstHumanOwnerAuthorized-ne$true-or$d.newSqlPrincipalAuthorized-ne$true){throw 'EMPTY_SETUP_DECISION'}
 Hold $PSCommandPath $d.windowSha256;Hold ($source+'/scripts/desktop-empty/empty-v7-setup-local.mjs') $d.localSourceSha256;Hold ($source+'/scripts/desktop-empty/empty-v7-setup-core.mjs') $d.coreSha256
 Hold $node '3331e1ffe19874215472217c5e94f5a0c6d8e18c4ac7111d3937aa0ad5e9b4a5'
 Hold ($proofRoot+'/runtime-package.json') $d.packageHash
 $pkg=Get-Content -Raw -LiteralPath ($proofRoot+'/runtime-package.json')|ConvertFrom-Json -AsHashtable -DateKind String
 foreach($entry in @($pkg.sources.GetEnumerator())+@($pkg.helpers.GetEnumerator())){if(($entry.Key-cnotmatch'^(apps/api/|packages/shared/|scripts/|infra/sql/migrations/)[A-Za-z0-9_./-]+\.(mjs|js|sql|ps1)$'-and$entry.Key-cne'scripts/canonical/fixtures/night-20261006-before.json')-or$entry.Key.Split('/')-contains'..'){throw 'EMPTY_SETUP_SOURCE_PATH'};Hold ($source+'/'+$entry.Key) $entry.Value}
 # Reuse the existing global schema owner; never manufacture a second owner.
 Assert-Ancestors ($root+'/desktop-empty-schema.owner.lock')
 $ownerLock=[IO.File]::Open(($root+'/desktop-empty-schema.owner.lock'),[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
 if((Child '--prepare')-cne'EMPTY_V7_HUMAN_FORM_READY'){throw 'EMPTY_SETUP_NOT_READY'}
 $prepared=Get-Content -Raw -LiteralPath ($proofRoot+'/preparation.json')|ConvertFrom-Json -DateKind String
 if($prepared.state-cne'EMPTY_V7_FIRST_SETUP_PREPARED'-or$prepared.decisionSha256-cne$ExpectedDecisionSha256-or$prepared.sqlWrites-ne0-or$prepared.nonce-cnotmatch'^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'){throw 'EMPTY_SETUP_PREPARATION'}
 Add-Type -AssemblyName System.Windows.Forms;Add-Type -AssemblyName System.Drawing
 $form=[Windows.Forms.Form]::new();$form.Text='ERP ilk kullanıcı kurulumu';$form.Size=[Drawing.Size]::new(510,405);$form.StartPosition='CenterScreen';$form.TopMost=$true
 $label=[Windows.Forms.Label]::new();$label.Text="İlk yönetici: kurulum`nYeni parolanızı kendiniz yazın. En az 8 karakter.";$label.Location=[Drawing.Point]::new(22,20);$label.Size=[Drawing.Size]::new(450,55);$form.Controls.Add($label)
 $first=[Windows.Forms.TextBox]::new();$first.UseSystemPasswordChar=$true;$first.MaxLength=64;$first.Location=[Drawing.Point]::new(22,90);$first.Width=450;$form.Controls.Add($first)
 $repeat=[Windows.Forms.TextBox]::new();$repeat.UseSystemPasswordChar=$true;$repeat.MaxLength=64;$repeat.Location=[Drawing.Point]::new(22,135);$repeat.Width=450;$form.Controls.Add($repeat)
 $status=[Windows.Forms.Label]::new();$status.Text='Parolayı tekrar yazın, ardından Kaydet düğmesine basın.';$status.Location=[Drawing.Point]::new(22,185);$status.Size=[Drawing.Size]::new(450,90);$form.Controls.Add($status)
 $save=[Windows.Forms.Button]::new();$save.Text='Kaydet';$save.Location=[Drawing.Point]::new(350,295);$save.Size=[Drawing.Size]::new(120,38);$form.Controls.Add($save)
 $cancel=[Windows.Forms.Button]::new();$cancel.Text='Kapat';$cancel.Location=[Drawing.Point]::new(22,295);$cancel.Size=[Drawing.Size]::new(110,38);$cancel.Add_Click({$form.Close()});$form.Controls.Add($cancel);$form.CancelButton=$cancel
 # No AcceptButton or automatic Save. Technical SQL credential generation is
 # inside this human click only and is unrelated to the human password.
 $save.Add_Click({
  $plain=$null;$again=$null;$technical=$null;$random=$null;$clear=$null;$cipher=$null;$stream=$null;$body=$null;$confirmed=$false
  try{
   $plain=$first.Text;$again=$repeat.Text
   if($plain.Length-lt8-or$plain.Length-gt64-or[Text.Encoding]::UTF8.GetByteCount($plain)-gt72-or![string]::Equals($plain,$again,[StringComparison]::Ordinal)){$status.Text='Parolalar aynı olmalı; 8-64 karakter, en çok 72 UTF-8 bayt.';return}
   $save.Enabled=$false;$cancel.Enabled=$false;$first.Enabled=$false;$repeat.Enabled=$false;$status.Text='Kurulum kaydediliyor. Pencereyi kapatmayın.';$form.Refresh()
   Assert-Ancestors $proofRoot
   if(Test-Path -LiteralPath $privateRoot){throw 'EMPTY_SETUP_PRIOR_PRIVATE_ROOT'}
   [void][IO.Directory]::CreateDirectory($privateRoot)
   $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User;$acl=[Security.AccessControl.DirectorySecurity]::new();$acl.SetOwner($sid);$acl.SetAccessRuleProtection($true,$false)
   $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow'));Set-Acl -LiteralPath $privateRoot -AclObject $acl;Assert-PrivateRoot
   $random=[byte[]]::new(32);[Security.Cryptography.RandomNumberGenerator]::Fill($random)
   $technical='A9!'+[Convert]::ToBase64String($random).TrimEnd('=').Replace('+','-').Replace('/','_')
   $clear=[Text.Encoding]::ASCII.GetBytes($technical)
   # Technical writer credential only. CurrentUser uses the same null entropy
   # as the existing starter; the owner-only new path and receipt bind context.
   $cipher=[Security.Cryptography.ProtectedData]::Protect($clear,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
   $stream=[IO.File]::Open(($privateRoot+'/sql-writer.dpapi'),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
   $body=@{password=$plain;passwordConfirmation=$again;confirmation=$true;technicalPassword=$technical;nonce=$prepared.nonce}
   $script:body=$body|ConvertTo-Json -Compress;$first.Clear();$repeat.Clear();$plain=$null;$again=$null
   if((Child '--apply')-cne'EMPTY_V7_FIRST_OWNER_SQL_COMMITTED_STORAGE_PENDING'){throw 'EMPTY_SETUP_UNCONFIRMED'}
   $confirmed=$true
   $result=Get-Content -Raw -LiteralPath ($proofRoot+'/sql-result.json')|ConvertFrom-Json -AsHashtable -DateKind String
   if($result.state-cne'EMPTY_V7_FIRST_OWNER_SQL_COMMITTED_STORAGE_PENDING'-or$result.operationId-cne$d.operationId-or$result.packageHash-cne$d.packageHash-or$result.strictTlsVerified-ne$true-or$result.username-cne'kurulum'-or$result.roleCode-cne'admin'){throw 'EMPTY_SETUP_RECEIPT'}
   Assert-PrivateRoot;$stream.Write($cipher);$stream.Flush($true);$stream.Dispose();$stream=$null
   $result.state='EMPTY_V7_FIRST_OWNER_SETUP_COMMITTED';$result.sqlCredentialCipherSha256=[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($cipher)).ToLowerInvariant();$result.windowsProtection='CurrentUser';$result.plaintextPasswordStored=$false
   Public-New 'first-owner-setup-receipt.v1.json' $result
   $status.ForeColor=[Drawing.Color]::DarkGreen;$status.Text="İlk kullanıcı kaydedildi: kurulum.`nBaşlangıç kabulü tamamlandıktan sonra normal ERP girişini kullanın."
  }catch{
   $status.ForeColor=[Drawing.Color]::DarkRed;$status.Text=if($confirmed){'Kayıt tamamlandı; saklama/başlangıç kabulü incelenmeli. Tekrar kaydetmeyin.'}else{'Sonuç incelenmeli. Tekrar kaydetmeyin.'}
   try{Public-New 'window-save-stopped.json' @{state=if($confirmed){'COMMITTED_FOLLOWUP_REQUIRED'}else{'OUTCOME_REVIEW_REQUIRED'};automaticRetryAllowed=$false}}catch{}
  }finally{if($stream){$stream.Dispose()};foreach($b in @($random,$clear,$cipher)){if($b){[Security.Cryptography.CryptographicOperations]::ZeroMemory($b)}};if($body){$body.Clear()};$script:body=$null;$plain=$null;$again=$null;$technical=$null;$first.Clear();$repeat.Clear();$cancel.Enabled=$true}
 })
 Public-New 'window-opened.json' @{state='EMPTY_V7_READY_FOR_HUMAN_ENTRY';operationId=$d.operationId;passwordEnteredByAgent=$false;sqlWrites=0}
 $form.Add_Shown({$first.Focus()});[void]$form.ShowDialog();$form.Dispose()
}catch{[Console]::Error.WriteLine('EMPTY_V7_FIRST_SETUP_WINDOW_STOPPED')}
finally{$script:body=$null;if($ownerLock){$ownerLock.Dispose()};foreach($s in $held){$s.Dispose()}}
