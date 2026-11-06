# Source helpers only. Dot-sourcing declares functions; it creates no secret,
# writes no files and makes no SQL connection. A separate reviewed supervisor
# must own access, safe file creation, identity and attempt/recovery handling.
function New-DesktopConnectSecretBytes {
    $random=[byte[]]::new(32)
    try {
        [Security.Cryptography.RandomNumberGenerator]::Fill($random)
        # Prefix enforces classes; the 43-character base64url tail carries 256
        # random bits. Strings are immutable and may live until GC: do not log.
        $tail=[Convert]::ToBase64String($random).TrimEnd('=').Replace('+','-').Replace('/','_')
        $text='A9!'+$tail
        if($text.Length -ne 46 -or $text -cnotmatch '^A9![A-Za-z0-9_-]{43}$'){throw 'SECRET_GENERATION_REJECTED'}
        $bytes=[Text.Encoding]::UTF8.GetBytes($text)
        return ,$bytes
    } finally {
        [Security.Cryptography.CryptographicOperations]::ZeroMemory($random)
    }
}
function Protect-DesktopConnectSecretBytes([byte[]]$secret) {
    if($null -eq $secret -or $secret.Length -ne 46){throw 'SECRET_LENGTH_REJECTED'}
    # CurrentUser requires the eventual process to run under the same Windows
    # identity and profile; do not put this in argv, environment or logs.
    return ,[Security.Cryptography.ProtectedData]::Protect($secret,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
}
function Clear-DesktopConnectSecretBytes([byte[]]$secret) {
    if($null -ne $secret){[Security.Cryptography.CryptographicOperations]::ZeroMemory($secret)}
}
function Save-DesktopConnectProtectedSecret([byte[]]$protected) {
    # Call only after one-attempt ownership is established. A partial file is
    # retained as UNKNOWN and must not be deleted or replaced automatically.
    if($null -eq $protected -or $protected.Length -lt 1 -or $protected.Length -gt 8192){throw 'PROTECTED_SECRET_REJECTED'}
    $directory='C:\Users\Xaser\Desktop\ERP\kurulum'
    $file='C:\Users\Xaser\Desktop\ERP\kurulum\melisa-desktop-test-app.dpapi'
    if([IO.Path]::GetDirectoryName($file) -cne $directory -or [IO.Path]::GetFullPath($file) -cne $file){throw 'SECRET_PATH_REJECTED'}
    $part=[IO.Path]::GetPathRoot($directory)
    foreach($name in $directory.Substring($part.Length).Split('\')){
        $part=Join-Path $part $name
        if(([IO.File]::GetAttributes($part) -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'SECRET_PATH_REJECTED'}
    }
    $stream=[IO.File]::Open($file,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
    try{$stream.Write($protected,0,$protected.Length);$stream.Flush($true)}finally{$stream.Dispose()}
}
function Unprotect-DesktopConnectSecretBytes([byte[]]$protected) {
    if($null -eq $protected -or $protected.Length -lt 1 -or $protected.Length -gt 8192){throw 'PROTECTED_SECRET_REJECTED'}
    $clear=[Security.Cryptography.ProtectedData]::Unprotect($protected,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
    if($clear.Length -ne 46){[Security.Cryptography.CryptographicOperations]::ZeroMemory($clear);throw 'SECRET_LENGTH_REJECTED'}
    return ,$clear
}
function Test-DesktopConnectProtectedSecret([byte[]]$secret,[byte[]]$protected) {
    $roundTrip=$null
    try {
        $roundTrip=Unprotect-DesktopConnectSecretBytes $protected
        return [Security.Cryptography.CryptographicOperations]::FixedTimeEquals($secret,$roundTrip)
    } finally {
        if($null -ne $roundTrip){[Security.Cryptography.CryptographicOperations]::ZeroMemory($roundTrip)}
    }
}
