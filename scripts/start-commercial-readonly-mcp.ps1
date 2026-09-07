param(
  [Parameter(Mandatory=$true)][string]$SecretDirectory,
  [ValidateRange(1,65535)][int]$McpPort=4113,
  [string]$MediaRoot,
  [ValidatePattern('^F[0-9]{4}$')][string]$MediaCompany
)
$ErrorActionPreference='Stop'
try {
  $repositoryRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
  $localSecrets=[IO.Path]::GetFullPath($SecretDirectory)
  if($localSecrets.Equals($repositoryRoot,[StringComparison]::OrdinalIgnoreCase) -or
     $localSecrets.StartsWith($repositoryRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){
    throw 'Secret storage must be outside the repository'
  }
  Get-ChildItem Env: | Where-Object {$_.Name -match '^(SQL_|VEGA_|BIONIC_|EXTERNAL_READ_ONLY_|MCP_READ_ONLY_|MELISA_MCP_|OPENAI_|CONTROL_PLANE_)'} | ForEach-Object {Remove-Item -LiteralPath ('Env:'+ $_.Name)}
  foreach($file in @('vega.env','bionic.env','external.env')){
    foreach($line in [IO.File]::ReadAllLines((Join-Path $localSecrets $file))){
      if($line -cmatch '^((?:BIONIC_[A-Z_]+)|EXTERNAL_READ_ONLY_API_KEY)=(.*)$'){
        $name=$Matches[1];$value=$Matches[2]
        if($value.StartsWith('"')){$value=$value|ConvertFrom-Json}
        if($name -eq 'EXTERNAL_READ_ONLY_API_KEY'){$name='MCP_READ_ONLY_TOKEN'}
        [Environment]::SetEnvironmentVariable($name,$value,'Process')
      }
    }
  }
  $env:MCP_READ_ONLY_HOST='127.0.0.1'
  $env:MCP_READ_ONLY_PORT=[string]$McpPort
  $env:MCP_READ_ONLY_MAX_ROWS='50'
  if($MediaRoot){
    $env:MCP_READ_ONLY_MEDIA_ROOT=(Resolve-Path -LiteralPath $MediaRoot).Path
    if(-not $MediaCompany){throw 'Explicit media company binding is required'}
    $env:MCP_READ_ONLY_MEDIA_COMPANY=$MediaCompany
  }
  # Customer access stays disabled unless a separate credential is supplied.
  $customerSecret=Join-Path $localSecrets 'mcp-customer.env'
  if(Test-Path -LiteralPath $customerSecret){
    foreach($line in [IO.File]::ReadAllLines($customerSecret)){
      if($line -cmatch '^MCP_READ_ONLY_CUSTOMER_TOKEN=(.*)$'){
        $value=$Matches[1]
        if($value.StartsWith('"')){$value=$value|ConvertFrom-Json}
        $env:MCP_READ_ONLY_CUSTOMER_TOKEN=$value
      }
    }
  }
  $env:MCP_READ_ONLY_AUDIT_DIR=Join-Path $localSecrets 'commercial-audit'
  $env:SQL_READ_ONLY='true'
  $env:NODE_ENV='production'
  Set-Location (Join-Path $repositoryRoot 'apps\api')
  & npm.cmd run start:mcp-readonly
  exit $LASTEXITCODE
}catch{
  [Console]::Error.WriteLine('Commercial read-only MCP startup failed; credentials suppressed.')
  exit 1
}
