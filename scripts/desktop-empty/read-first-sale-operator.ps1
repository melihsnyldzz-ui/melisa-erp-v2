# Internal protected handoff to the authorized normal TEST login form only.
# Invoke Pipe only from a private inherited pipe; never print its result to a
# terminal, tool output, transcript, source file, browser URL or API request.
param([ValidateSet('Check','Pipe','Show')][string]$Mode='Check')
$ErrorActionPreference='Stop';$clear=$null
try{
 if([Security.Principal.WindowsIdentity]::GetCurrent().Name -cne 'SEMIH\Xaser'){throw 'PROFILE_REJECTED'}
 $file='C:\Users\Xaser\Desktop\ERP\kurulum\melisa-desktop-test-operator.dpapi';$item=Get-Item -LiteralPath $file
 if($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or $item.Length -gt 8192){throw 'SECRET_FILE_REJECTED'}
 $clear=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($file),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
 if($clear.Length -ne 46 -or [Text.Encoding]::ASCII.GetString($clear) -cnotmatch '^A9![A-Za-z0-9_-]{43}$'){throw 'SECRET_FORMAT_REJECTED'}
 if($Mode -ceq 'Pipe'){
  if(-not [Console]::IsOutputRedirected -or -not [Console]::IsInputRedirected){throw 'PRIVATE_PIPE_REQUIRED'}
  $output=[Console]::OpenStandardOutput();$output.Write($clear);$output.Flush()
 }elseif($Mode -ceq 'Show'){
  Add-Type -AssemblyName System.Windows.Forms
  $form=[Windows.Forms.Form]::new();$form.Text='ERP deneme giriş bilgileri';$form.Width=470;$form.Height=170;$form.StartPosition='CenterScreen'
  $user=[Windows.Forms.Label]::new();$user.Text='Kullanıcı: erp_deneme';$user.SetBounds(15,15,420,25);$form.Controls.Add($user)
  $box=[Windows.Forms.TextBox]::new();$box.ReadOnly=$true;$box.UseSystemPasswordChar=$true;$box.Text=[Text.Encoding]::ASCII.GetString($clear);$box.SetBounds(15,45,420,25);$form.Controls.Add($box)
  $show=[Windows.Forms.CheckBox]::new();$show.Text='Parolayı bu bilgisayarda göster';$show.SetBounds(15,80,420,25);$show.Add_CheckedChanged({$box.UseSystemPasswordChar=-not $show.Checked});$form.Controls.Add($show)
  try{[void]$form.ShowDialog()}finally{$box.Clear();$form.Dispose()}
 }else{[Console]::WriteLine('{"username":"erp_deneme","canDecrypt":true,"plaintextReturned":false}')}
}catch{[Console]::Error.WriteLine('OPERATOR_SECRET_UNAVAILABLE');exit 1}
finally{if($clear){[Security.Cryptography.CryptographicOperations]::ZeroMemory($clear)}}
