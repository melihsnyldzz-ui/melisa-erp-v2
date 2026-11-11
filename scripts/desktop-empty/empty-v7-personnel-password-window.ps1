param(
 [Parameter(Mandatory)][ValidatePattern('^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$')][string]$RosterOperationId,
 [Parameter(Mandatory)][ValidatePattern('^[a-f0-9]{64}$')][string]$ExpectedDecisionSha256,
 [Parameter(Mandatory)][ValidatePattern('^[a-f0-9]{64}$')][string]$ExpectedSelfSha256
)
# Human entry only. This window never connects to SQL, activates an account,
# reuses kurulum credentials, or prints a password/hash/private packet.
$ErrorActionPreference='Stop'
$a='C:/Users/Xaser/.codex/visualizations/2026/11/05/01a1aba4-ea01-7f13-93cc-98d60952a40a'
$source='C:/Sirket/ERP/melisa-erp-v2/.git/codex-worktrees/db9-r1-personnel-20261111'
$profile='C:/Users/Xaser/Desktop/ERP/kurulum/empty-profile-db9-v1'
$sid='S-1-5-21-2170750028-1005938530-2568122015-1001'
$rosterSha='b81f71c79a5722d7fa708295b040696c472e27fda50cfcd38c9ad5485b5d7dcb'
$node='C:/Program Files/nodejs/node.exe'
$people=@(
 @{key='sales';username='erp_db9_sales_test';label='Satışçı'},
 @{key='warehouse';username='erp_db9_warehouse_test';label='Depo'},
 @{key='manager';username='erp_db9_manager_test';label='Müdür onaycı'},
 @{key='boss';username='erp_db9_boss_test';label='Patron onaycı'},
 @{key='accounting';username='erp_db9_accounting_test';label='Muhasebe'},
 @{key='creditSetup';username='erp_db9_credit_setup_test';label='Limit / vade kurulum yetkilisi'}
)
$held=[Collections.Generic.List[IO.FileStream]]::new();$child=$null;$childStarted=$false;$privateInput=$null;$privateHashBytes=$null;$form=$null
$publicPath=$a+'/empty-v7-personnel-passwords-'+$RosterOperationId+'.json'
$privateBase=$profile+'/personnel-private-v1';$privateDirectory=$privateBase+'/'+$RosterOperationId
function Assert-PublicKeys($v,[string[]]$keys){if($v-isnot[Collections.IDictionary]-or(@($v.Keys|Sort-Object)-join',')-cne(@($keys|Sort-Object)-join',')){throw 'PASSWORD_WINDOW_SHAPE'}}
function No-Reparse([string]$p){$at=Get-Item -LiteralPath $p -Force;while($at){if($at.Attributes-band[IO.FileAttributes]::ReparsePoint){throw 'PASSWORD_WINDOW_REPARSE'};$at=if($at-is[IO.FileInfo]){$at.Directory}else{$at.Parent}}}
function Hold-Pin([string]$p,[string]$digest){
 if($digest-cnotmatch'^[a-f0-9]{64}$'){throw 'PASSWORD_WINDOW_HASH'};No-Reparse $p
 $h=[IO.File]::Open($p,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);$held.Add($h)
 if($h.Length-lt1-or$h.Length-gt134217728-or[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($h)).ToLowerInvariant()-cne$digest){throw 'PASSWORD_WINDOW_PIN'}
}
function Write-Public([string]$path,$value){
 No-Reparse ([IO.Path]::GetDirectoryName($path));$b=[Text.UTF8Encoding]::new($false).GetBytes(($value|ConvertTo-Json -Depth 20)+"`n")
 $s=[IO.File]::Open($path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read);try{$s.Write($b);$s.Flush($true)}finally{$s.Dispose()}
}
function Set-PrivateAcl([string]$p,[bool]$directory){
 $owner=[Security.Principal.SecurityIdentifier]::new($sid)
 $acl=if($directory){[Security.AccessControl.DirectorySecurity]::new()}else{[Security.AccessControl.FileSecurity]::new()}
 $acl.SetOwner($owner);$acl.SetAccessRuleProtection($true,$false)
 $inherit=if($directory){[Security.AccessControl.InheritanceFlags]::ContainerInherit-bor[Security.AccessControl.InheritanceFlags]::ObjectInherit}else{[Security.AccessControl.InheritanceFlags]::None}
 $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($owner,[Security.AccessControl.FileSystemRights]::FullControl,$inherit,[Security.AccessControl.PropagationFlags]::None,[Security.AccessControl.AccessControlType]::Allow))
 Set-Acl -LiteralPath $p -AclObject $acl
}
function Assert-PrivateAcl([string]$p){
 No-Reparse $p;$acl=Get-Acl -LiteralPath $p;$rules=@($acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))
 if(-not$acl.AreAccessRulesProtected-or$acl.GetOwner([Security.Principal.SecurityIdentifier]).Value-cne$sid-or$rules.Count-ne1-or$rules[0].IdentityReference.Value-cne$sid-or$rules[0].AccessControlType-ne'Allow'-or$rules[0].FileSystemRights-ne'FullControl'){throw 'PASSWORD_WINDOW_PRIVATE_ACL'}
}
function New-PrivateDirectory([string]$p){
 No-Reparse ([IO.Path]::GetDirectoryName($p));if(-not[PersonnelPasswordWindowNative]::CreateDirectory($p,[IntPtr]::Zero)){throw 'PASSWORD_WINDOW_DIRECTORY_EXISTS_OR_FAILED'}
 Set-PrivateAcl $p $true;Assert-PrivateAcl $p
}
function Protect-PrivateFile([string]$p,[byte[]]$bytes){
 $cipher=[Security.Cryptography.ProtectedData]::Protect($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
 try{$s=[IO.File]::Open($p,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);try{$s.Write($cipher);$s.Flush($true)}finally{$s.Dispose()};Set-PrivateAcl $p $false;Assert-PrivateAcl $p;return @{path=$p;sha256=[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($cipher)).ToLowerInvariant()}}
 finally{[Security.Cryptography.CryptographicOperations]::ZeroMemory($cipher)}
}
try{
 if($PSVersionTable.PSVersion-lt[version]'7.5'-or[IO.Path]::GetFullPath($PSCommandPath).Replace('\','/')-cne$source+'/scripts/desktop-empty/empty-v7-personnel-password-window.ps1'){throw 'PASSWORD_WINDOW_HOST'}
 $who=[Security.Principal.WindowsIdentity]::GetCurrent();if($who.Name-cne'SEMIH\Xaser'-or$who.User.Value-cne$sid-or$who.ImpersonationLevel.ToString()-cne'None'){throw 'PASSWORD_WINDOW_OWNER'}
 Hold-Pin $PSCommandPath $ExpectedSelfSha256
 $decisionPath=$a+'/empty-v7-personnel-password-decision-'+$RosterOperationId+'.json';Hold-Pin $decisionPath $ExpectedDecisionSha256
 $d=Get-Content -Raw -LiteralPath $decisionPath|ConvertFrom-Json -AsHashtable -DateKind String -Depth 30
 Assert-PublicKeys $d @('version','state','rosterOperationId','ownerSid','sourceHead','rosterSha256','files')
 if($d.version-ne1-or$d.state-cne'ROOT_EMPTY_V7_PERSONNEL_PASSWORD_DECISION_V1'-or$d.rosterOperationId-cne$RosterOperationId-or$d.ownerSid-cne$sid-or$d.sourceHead-cnotmatch'^[a-f0-9]{40}$'-or$d.rosterSha256-cne$rosterSha){throw 'PASSWORD_WINDOW_DECISION'}
 Assert-PublicKeys $d.files @('window','hasher','core')
 foreach($key in @('window','hasher','core')){
  $expected=$source+'/scripts/desktop-empty/'+@{window='empty-v7-personnel-password-window.ps1';hasher='empty-v7-personnel-password-hash.mjs';core='empty-v7-personnel-core.mjs'}[$key]
  Assert-PublicKeys $d.files[$key] @('path','sha256');if($d.files[$key].path-cne$expected){throw 'PASSWORD_WINDOW_SOURCE_PATH'};Hold-Pin $expected $d.files[$key].sha256
 }
 if($d.files.window.sha256-cne$ExpectedSelfSha256){throw 'PASSWORD_WINDOW_SELF'}
 Hold-Pin $node '3331e1ffe19874215472217c5e94f5a0c6d8e18c4ac7111d3937aa0ad5e9b4a5'
 Hold-Pin ($profile+'/runtime-package.json') '50fa9aa4cc1f8237f28b7294da0b3989abfa4c878c63edbae17d7a2324ce61df'
 if((Test-Path -LiteralPath $publicPath)-or(Test-Path -LiteralPath $privateDirectory)){throw 'PASSWORD_WINDOW_OPERATION_ALREADY_EXISTS'}
 Add-Type -AssemblyName System.Windows.Forms;Add-Type -AssemblyName System.Drawing
 Add-Type -TypeDefinition @'
using System;using System.IO;using System.Runtime.InteropServices;using System.Threading.Tasks;
public static class PersonnelPasswordWindowNative {
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]public static extern bool CreateDirectory(string path,IntPtr attributes);
 public static async Task<byte[]> ReadBounded(Stream s,int limit){var b=new byte[1024];var storage=new byte[limit];int used=0;try{for(;;){int n=await s.ReadAsync(b,0,b.Length).ConfigureAwait(false);if(n==0){var result=new byte[used];Buffer.BlockCopy(storage,0,result,0,used);return result;}if(used+n>limit)throw new InvalidDataException();Buffer.BlockCopy(b,0,storage,used,n);used+=n;Array.Clear(b,0,n);}}finally{Array.Clear(b,0,b.Length);Array.Clear(storage,0,storage.Length);}}
}
'@
 $form=[Windows.Forms.Form]::new();$form.Text='ERP TEST personel parolası — DB9';$form.ClientSize=[Drawing.Size]::new(650,555);$form.StartPosition='CenterScreen';$form.FormBorderStyle='FixedDialog';$form.MaximizeBox=$false;$form.MinimizeBox=$false;$form.TopMost=$true;$form.Font=[Drawing.Font]::new('Segoe UI',10)
 $intro=[Windows.Forms.Label]::new();$intro.SetBounds(22,18,606,60);$intro.Text="Yeni ortak parola yalnız bu bilgisayardaki aşağıdaki 6 TEST hesabına uygulanacak.`nMevcut kurulum hesabının parolası değişmeyecek.";$form.Controls.Add($intro)
 $list=[Windows.Forms.ListBox]::new();$list.SetBounds(22,85,606,150);foreach($p in $people){[void]$list.Items.Add($p.label+' — '+$p.username)};$form.Controls.Add($list)
 $label=[Windows.Forms.Label]::new();$label.SetBounds(22,252,606,25);$label.Text='Yeni TEST parolası (en az 8 karakter)';$form.Controls.Add($label)
 $password=[Windows.Forms.TextBox]::new();$password.SetBounds(22,280,606,30);$password.UseSystemPasswordChar=$true;$password.MaxLength=64;$form.Controls.Add($password)
 $label2=[Windows.Forms.Label]::new();$label2.SetBounds(22,320,606,25);$label2.Text='Yeni TEST parolasını tekrar yazın';$form.Controls.Add($label2)
 $confirm=[Windows.Forms.TextBox]::new();$confirm.SetBounds(22,348,606,30);$confirm.UseSystemPasswordChar=$true;$confirm.MaxLength=64;$form.Controls.Add($confirm)
 $status=[Windows.Forms.Label]::new();$status.SetBounds(22,395,606,60);$status.Text='Parolayı sohbete yazmayın. Bu pencere süre dolduğu için kapanmaz.';$form.Controls.Add($status)
 $save=[Windows.Forms.Button]::new();$save.SetBounds(22,480,250,42);$save.Text='6 TEST hesabı için parolayı kaydet';$form.Controls.Add($save)
 $close=[Windows.Forms.Button]::new();$close.SetBounds(460,480,168,42);$close.Text='Vazgeç / Kapat';$form.Controls.Add($close)
 $script:passwordSaved=$false;$script:passwordAttempted=$false
 $close.Add_Click({$form.Close()});$form.Add_Shown({$form.Activate();[void]$password.Focus()})
 $save.Add_Click({
  if($script:passwordAttempted){return}
  $p=$password.Text
  if($p.Length-lt8-or$p.Length-gt64-or[Text.Encoding]::UTF8.GetByteCount($p)-gt72-or$p.Contains([char]0)-or$p.Contains("`r")-or$p.Contains("`n")-or$p-cne$confirm.Text){$status.Text='İki alana aynı, en az 8 karakterlik parolayı yazın.';return}
  $script:passwordAttempted=$true;$save.Enabled=$false;$close.Enabled=$false;$status.Text='TEST parolası güvenli biçimde kaydediliyor…';$form.Refresh()
  try{
   $inputObject=@{version=1;rosterOperationId=$RosterOperationId;profileId='empty-db9-v7-v1';databaseGuid='6d773db9-bd69-4906-b791-d63a490ab1f2';rosterSha256=$rosterSha;password=$p;passwordConfirmation=$confirm.Text}
   $privateInput=[Text.UTF8Encoding]::new($false).GetBytes(($inputObject|ConvertTo-Json -Compress));$inputObject.password=$null;$inputObject.passwordConfirmation=$null;$inputObject=$null
   $psi=[Diagnostics.ProcessStartInfo]::new();$psi.FileName=$node;$psi.UseShellExecute=$false;$psi.CreateNoWindow=$true;$psi.WorkingDirectory=$source;$psi.RedirectStandardInput=$true;$psi.RedirectStandardOutput=$true;$psi.RedirectStandardError=$true;$psi.Environment.Clear();$psi.Environment['SystemRoot']='C:\Windows';$psi.Environment['WINDIR']='C:\Windows';$psi.Environment['NODE_ENV']='production'
   foreach($arg in @($d.files.hasher.path,$d.files.hasher.sha256,$d.files.core.sha256,$rosterSha)){$psi.ArgumentList.Add($arg)}
   $child=[Diagnostics.Process]::new();$child.StartInfo=$psi;if(-not$child.Start()){throw 'PASSWORD_WINDOW_WORKER_START'};$childStarted=$true
   $out=[PersonnelPasswordWindowNative]::ReadBounded($child.StandardOutput.BaseStream,8192);$err=[PersonnelPasswordWindowNative]::ReadBounded($child.StandardError.BaseStream,1024)
   $child.StandardInput.BaseStream.Write($privateInput);$child.StandardInput.Close();[Security.Cryptography.CryptographicOperations]::ZeroMemory($privateInput);$privateInput=$null
   $watch=[Diagnostics.Stopwatch]::StartNew();while(-not$child.WaitForExit(50)){if($out.IsFaulted-or$err.IsFaulted-or$watch.ElapsedMilliseconds-ge60000){throw 'PASSWORD_WINDOW_WORKER_BOUND'}}
   $privateHashBytes=$out.GetAwaiter().GetResult();if($child.ExitCode-ne0-or$err.GetAwaiter().GetResult().Length-ne0){throw 'PASSWORD_WINDOW_WORKER_FAILED'}
   $packet=[Text.UTF8Encoding]::new($false,$true).GetString($privateHashBytes)|ConvertFrom-Json -AsHashtable -DateKind String
   Assert-PublicKeys $packet @('version','rosterOperationId','profileId','databaseGuid','rosterSha256','origin','hashes');Assert-PublicKeys $packet.hashes @($people.key)
   if($packet.version-ne1-or$packet.rosterOperationId-cne$RosterOperationId-or$packet.profileId-cne'empty-db9-v7-v1'-or$packet.databaseGuid-cne'6d773db9-bd69-4906-b791-d63a490ab1f2'-or$packet.rosterSha256-cne$rosterSha-or$packet.origin-cne'HUMAN_ENTRY'-or@($packet.hashes.Values|Sort-Object -Unique).Count-ne6){throw 'PASSWORD_WINDOW_PACKET'}
   foreach($h in $packet.hashes.Values){if($h-cnotmatch'^\$2[aby]\$12\$[./A-Za-z0-9]{53}$'){throw 'PASSWORD_WINDOW_BCRYPT'}};$packet=$null
   if(Test-Path -LiteralPath $privateBase){Assert-PrivateAcl $privateBase}else{New-PrivateDirectory $privateBase};New-PrivateDirectory $privateDirectory
   $hashPacket=Protect-PrivateFile ($privateDirectory+'/hashes.dpapi') $privateHashBytes
   $logins=@();foreach($person in $people){$login=@{version=1;rosterOperationId=$RosterOperationId;profileId='empty-db9-v7-v1';databaseGuid='6d773db9-bd69-4906-b791-d63a490ab1f2';rosterSha256=$rosterSha;key=$person.key;username=$person.username;origin='HUMAN_ENTRY';password=$p};$b=[Text.UTF8Encoding]::new($false).GetBytes(($login|ConvertTo-Json -Compress));$login.password=$null;$login=$null;try{$ref=Protect-PrivateFile ($privateDirectory+'/login-'+$person.key+'.dpapi') $b;$logins+=@{key=$person.key;username=$person.username;path=$ref.path;sha256=$ref.sha256}}finally{[Security.Cryptography.CryptographicOperations]::ZeroMemory($b)}}
   Write-Public $publicPath @{version=1;state='EMPTY_V7_PERSONNEL_HUMAN_CREDENTIALS_PREPARED';rosterOperationId=$RosterOperationId;rosterSha256=$rosterSha;profileId='empty-db9-v7-v1';databaseGuid='6d773db9-bd69-4906-b791-d63a490ab1f2';ownerSid=$sid;origin='HUMAN_ENTRY';sharedTestPassword=$true;bcryptRounds=12;hashPacket=$hashPacket;loginPackets=$logins;sourceFiles=@{window=$ExpectedSelfSha256;hasher=$d.files.hasher.sha256;core=$d.files.core.sha256}}
   $script:passwordSaved=$true;$status.Text='TEST parolası kaydedildi. Pencereyi kapatabilirsiniz.'
  }catch{$status.Text='Parola kaydedilemedi. Pencereyi kapatabilirsiniz; işlem kaydını inceleyeceğim.';try{Write-Public $publicPath @{version=1;state='EMPTY_V7_PERSONNEL_PASSWORD_PREPARATION_FAILED';rosterOperationId=$RosterOperationId;SQLWrites=0;accountsCreated=0;automaticRetry=$false}}catch{}}
  finally{$p=$null;$password.Clear();$confirm.Clear();if($privateInput){[Security.Cryptography.CryptographicOperations]::ZeroMemory($privateInput)};if($privateHashBytes){[Security.Cryptography.CryptographicOperations]::ZeroMemory($privateHashBytes)};$privateInput=$null;$privateHashBytes=$null;if($child){try{if($childStarted-and-not$child.HasExited){$child.Kill();[void]$child.WaitForExit(10000)}}finally{$child.Dispose();$child=$null;$childStarted=$false}};$close.Enabled=$true}
 })
 [void]$form.ShowDialog()
 if(-not$script:passwordAttempted){Write-Public $publicPath @{version=1;state='EMPTY_V7_PERSONNEL_PASSWORD_ENTRY_CANCELLED';rosterOperationId=$RosterOperationId;SQLWrites=0;accountsCreated=0}}
}catch{[Console]::Error.WriteLine('PERSONNEL_PASSWORD_WINDOW_FAILED');exit 1}
finally{if($form){$form.Dispose()};if($privateInput){[Security.Cryptography.CryptographicOperations]::ZeroMemory($privateInput)};if($privateHashBytes){[Security.Cryptography.CryptographicOperations]::ZeroMemory($privateHashBytes)};foreach($h in $held){$h.Dispose()}}
