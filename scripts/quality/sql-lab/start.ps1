$ErrorActionPreference = 'Stop'
$labName = 'commerce-sql-20260908'
$candidateRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$labRoot = Join-Path $candidateRoot 'temp/sql-lab'
$privateRoot = Join-Path $env:USERPROFILE '.codex/backups/commerce-sql-lab-20260908'
if (Get-NetTCPConnection -LocalPort 51433 -State Listen -ErrorAction SilentlyContinue) { throw 'Test port already occupied' }
if ((docker ps -a --filter "name=^/$labName`$" --format '{{.Names}}')) { throw 'Lab already exists; inspect before resuming' }
if (Test-Path -LiteralPath "$labRoot/binding.json") { throw 'Lab binding already exists; inspect before resuming' }
New-Item -ItemType Directory -Path $labRoot -Force | Out-Null
New-Item -ItemType Directory -Path $privateRoot -Force | Out-Null
$labPassword = 'Qa!' + [Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(24)) + 'z9'
$labCredentials = @{ saPassword=$labPassword; appPassword=('Qa!' + [Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(24)) + 'z9') }
$labCredentials | ConvertTo-Json | Set-Content -LiteralPath "$privateRoot/credentials.json" -Encoding utf8
@("ACCEPT_EULA=Y", "MSSQL_PID=Developer", "MSSQL_SA_PASSWORD=$labPassword", 'MSSQL_MEMORY_LIMIT_MB=2048') | Set-Content -LiteralPath "$privateRoot/container.env" -Encoding ascii
docker network create --opt com.docker.network.bridge.enable_icc=false --label melisa.goal=commerce-no-messaging-20260908 $labName | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Network creation failed' }
docker volume create --label melisa.goal=commerce-no-messaging-20260908 $labName | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Volume creation failed' }
$labImage = 'mcr.microsoft.com/mssql/server@sha256:ba4c8329f48fb8f02e1416be6a930ebfd71268caee78aa985f3af4315e457c89'
$labContainerId = docker run -d --name $labName --hostname $labName --network $labName --restart no --cpus 2 --memory 3g --label melisa.goal=commerce-no-messaging-20260908 --env-file "$privateRoot/container.env" --publish 127.0.0.1:51433:1433 --volume "${labName}:/var/opt/mssql" $labImage
if ($LASTEXITCODE -ne 0) { throw 'Isolated SQL startup failed' }
@{ name=$labName; containerId=$labContainerId; image=$labImage; host='127.0.0.1'; port=51433; database='MELISA_ERP_V2'; isolated=$true; privateCredentials="$privateRoot/credentials.json"; createdAt=(Get-Date).ToUniversalTime().ToString('o') } | ConvertTo-Json | Set-Content -LiteralPath "$labRoot/binding.json" -Encoding utf8
Write-Output 'Isolated SQL lab created on loopback port 51433; no active ERP volume or network attached.'
