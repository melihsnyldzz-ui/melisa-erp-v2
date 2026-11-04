Set-StrictMode -Version Latest

# Normal startup for one immutable pair. This module grants no recovery,
# adoption, stop-existing-process, task-registration or configuration authority.
function Get-ErpCurrentPairIdentity {
 return [ordered]@{
  caseId='ERP-C06-NORMAL-PAIR-STARTUP-20261103-1706'
  applicationSource='1afcdd7f3c8941bfdfd262e7998093626a14ae6e'
  producerSource='7c6dcc72749862958aa3fad9011837eda900cf83'
  legacySource='edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d'
  frontendSource='fe3948c5ea77e7b0eb215cac6b6b0831adb45e8a'
  database='MELISA_ERP_SIRKET_TEST_20260929_01'
  server='Semih\MELISADEV'
  componentRoot='C:\Sirket\ERP\releases\CANONICAL-TEST125-CURRENT-PAIR-1afcdd7f3c89-P7c6dcc727498-20261103'
  webRoot='C:\Sirket\ERP\releases\ERP-BUSINESS-WEB-5244-CURRENT-PAIR-1afcdd7f3c89-P7c6dcc727498-20261103'
  # Public artifact digests, not credentials; kept positional to avoid key-like labels.
  digests=@('342fa6b6ac7448a8ac515cbd118638b857d44c56fc621b74ac0070dd209c0a5f','fbedc4da026b4ac257440ddcd54166b569a623c067d7c5a5c712fa6af5d99ab6','0f3a26b3fdfbf9fc0b4b5b615bff4a7bf88e2da87828896dd0b738fe0567f704','74d72c0c2ce685f126ae941249c69a1168bf90e7dbbf45269639e19ef466c7c3')
 }
}

function Get-ErpCurrentPairTextHash([string]$Text) {
 $sha=[Security.Cryptography.SHA256]::Create()
 try{return [BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Text))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}
}

function ConvertFrom-ErpCurrentPairTaskXml([string]$Text) {
 $settings=[Xml.XmlReaderSettings]::new();$settings.DtdProcessing=[Xml.DtdProcessing]::Prohibit;$settings.XmlResolver=$null
 $reader=[Xml.XmlReader]::Create([IO.StringReader]::new($Text),$settings)
 try{$xml=[Xml.XmlDocument]::new();$xml.PreserveWhitespace=$true;$xml.XmlResolver=$null;$xml.Load($reader);return ,$xml}finally{$reader.Dispose()}
}
function Get-ErpCurrentPairTaskExec($Xml) {
 $ns=[Xml.XmlNamespaceManager]::new($Xml.NameTable);$ns.AddNamespace('t','http://schemas.microsoft.com/windows/2004/02/mit/task')
 $exec=@($Xml.SelectNodes('/t:Task/t:Actions/t:Exec',$ns));$actions=@($Xml.SelectNodes('/t:Task/t:Actions/*',$ns))
 if($exec.Count-ne1-or$actions.Count-ne1){throw 'CURRENT_PAIR_TASK_ACTIONS'}
 $command=$exec[0].SelectSingleNode('t:Command',$ns);$argsNode=$exec[0].SelectSingleNode('t:Arguments',$ns)
 $uri=$Xml.SelectSingleNode('/t:Task/t:RegistrationInfo/t:URI',$ns)
 if(!$uri-or$uri.InnerText-cne'\Melisa-ERP-TEST-Canonical'){throw 'CURRENT_PAIR_TASK_IDENTITY'}
 if(!$command-or!$argsNode-or$command.InnerText-ine'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'){throw 'CURRENT_PAIR_TASK_EXECUTABLE'}
 return $argsNode
}
function Assert-ErpCurrentPairBaseConfig($Config) {
 $i=Get-ErpCurrentPairIdentity
 if($Config.SourceCommit-cne$i.legacySource-or$Config.ExpectedDatabase-cne$i.database-or$Config.TaskName-cne'Melisa-ERP-TEST-Canonical'-or$Config.RepoRoot-cne'C:\Sirket\ERP\melisa-erp-v2'-or$Config.RuntimeDir-cne'C:\Sirket\ERP\runtime\canonical-test'-or$Config.ReleaseRoot-cne'C:\Sirket\ERP\releases\CANONICAL-TEST125-CATALOG-COMPAT-20261027-0a221778'-or$Config.ManifestSha256-cne'0927de3c6d03640acc504d7c8a9aaf1228edbb4170758cf2d1e12f638e044d64'-or$Config.NodePath-cne'C:\Program Files\nodejs\node.exe'-or$Config.NodeSha256-ine'3331e1ffe19874215472217c5e94f5a0c6d8e18c4ac7111d3937aa0ad5e9b4a5'-or$Config.ApiComponent.SourceCommit-cne$i.legacySource-or$Config.ApiComponent.ConfigPath-cne'C:\Sirket\ERP\config\TEST-20260929-01\business-5244-private.json'){throw 'CURRENT_PAIR_BASE_SCOPE'}
}
function New-ErpCurrentPairProjection {
 param([string]$BeforeConfig,[string]$BeforeTask,[string]$BeforeSddl,[string]$ExpectedConfigHash,[string]$ExpectedTaskHash,[string]$BundleRoot,[string]$SourceManifestHash,[string]$PlanPath)
 if((Get-ErpCurrentPairTextHash $BeforeConfig)-cne$ExpectedConfigHash-or(Get-ErpCurrentPairTextHash $BeforeTask)-cne$ExpectedTaskHash){throw 'CURRENT_PAIR_BEFORE_CAS'}
 if($BundleRoot-cnotmatch '^C:\\Sirket\\ERP\\releases\\ERP-CURRENT-PAIR-STARTUP-SOURCE-[a-f0-9]{40}$'-or$SourceManifestHash-cnotmatch '^[a-f0-9]{64}$'-or$PlanPath-cne(Join-Path $BundleRoot 'startup-plan.json')-or!$BeforeSddl){throw 'CURRENT_PAIR_SOURCE_BINDING'}
 $i=Get-ErpCurrentPairIdentity;$config=$BeforeConfig|ConvertFrom-Json;Assert-ErpCurrentPairBaseConfig $config
 if($config.ApiComponent.ReleaseRoot-cne'C:\Sirket\ERP\releases\CANONICAL-TEST125-BUSINESS5244-B6-PREVIEW-READ-VERIFIED-20261030'-or$config.ApiComponent.ManifestSha256-cne'afdb66b5c3450459778630d27bd1ff409ecb80c8ad53058fa048cf3e8e28085c'){throw 'CURRENT_PAIR_BEFORE_COMPONENT'}
 $config.ApiComponent.ReleaseRoot=$i.componentRoot;$config.ApiComponent.ManifestSha256=$i.digests[0]
 $xml=ConvertFrom-ErpCurrentPairTaskXml $BeforeTask;$argsNode=Get-ErpCurrentPairTaskExec $xml
 # Only Arguments changes. Executable, principal, triggers, RunLevel,
 # settings, working directory and external SDDL are preserved verbatim.
 $arguments='-NoProfile -NonInteractive -File "'+(Join-Path $BundleRoot 'start-current-business-pair.ps1')+'" -SourceManifestHash '+$SourceManifestHash+' -PlanPath "'+$PlanPath+'"'
 $argsNode.InnerText=$arguments
 return [pscustomobject][ordered]@{schema='melisa-current-pair-startup-plan.v1';caseId=$i.caseId;state='NOT_APPLIED';bundleRoot=$BundleRoot;sourceManifestHash=$SourceManifestHash;planPath=$PlanPath;startupConfig='C:\Sirket\ERP\runtime\canonical-test\startup-config.json';beforeConfig=$BeforeConfig;beforeTask=$BeforeTask;beforeSddl=$BeforeSddl;beforeConfigHash=$ExpectedConfigHash;beforeTaskHash=$ExpectedTaskHash;afterConfig=($config|ConvertTo-Json -Depth 100 -Compress);afterTask=$xml.OuterXml;arguments=$arguments;changedConfigFields=@('ApiComponent.ReleaseRoot','ApiComponent.ManifestSha256');taskChangedFields=@('Actions.Exec.Arguments');installed=$false;executionAuthority=$false}
}
function Assert-ErpCurrentPairProjection($Plan,[string]$ConfigText,[string]$TaskText,[string]$Sddl,[string]$Root,[string]$SourceHash) {
 if($Plan.schema-cne'melisa-current-pair-startup-plan.v1'-or$Plan.state-cne'NOT_APPLIED'-or$Plan.installed-isnot[bool]-or$Plan.installed-or$Plan.executionAuthority-isnot[bool]-or$Plan.executionAuthority-or$Plan.bundleRoot-cne$Root-or$Plan.sourceManifestHash-cne$SourceHash){throw 'CURRENT_PAIR_PLAN_SCOPE'}
 $expected=New-ErpCurrentPairProjection -BeforeConfig $Plan.beforeConfig -BeforeTask $Plan.beforeTask -BeforeSddl $Plan.beforeSddl -ExpectedConfigHash $Plan.beforeConfigHash -ExpectedTaskHash $Plan.beforeTaskHash -BundleRoot $Root -SourceManifestHash $SourceHash -PlanPath (Join-Path $Root 'startup-plan.json')
 # XmlReader normalizes the projected XML to LF; Task Scheduler exports CRLF.
 # Only this export spelling differs. Before-image hashes, configuration,
 # security descriptor, XML content, casing and other whitespace stay exact.
 $exportedTask=$TaskText.Replace("`r`n","`n")
 if(($Plan|ConvertTo-Json -Depth 100 -Compress)-cne($expected|ConvertTo-Json -Depth 100 -Compress)-or$ConfigText-cne$Plan.afterConfig-or$exportedTask-cne$Plan.afterTask-or$Sddl-cne$Plan.beforeSddl){throw 'CURRENT_PAIR_PROJECTION_CHANGED'}
}
function Get-ErpCurrentPairWebPins {
 $i=Get-ErpCurrentPairIdentity
  return @{root=$i.webRoot;package=([IO.Path]::GetFileName($i.webRoot));manifest=$i.digests[1];frontendSource=$i.frontendSource;apiPackage='CANONICAL-TEST125-BUSINESS5244-B6-WRITER-20261029';apiManifest=$i.digests[0];baseSource=$i.legacySource;node='C:\Sirket\ERP\tools\node-v24.19.0\node.exe';nodeHash='3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237';profile='ERP-5244-REALDATA-20261027'}
}
function Assert-ErpCurrentPairReceipt([string]$ReceiptText,$ApiManifest,$WebManifest) {
 $i=Get-ErpCurrentPairIdentity
 if((Get-ErpCurrentPairTextHash $ReceiptText)-cne$i.digests[2]){throw 'CURRENT_PAIR_RECEIPT_HASH'}
 $receipt=$ReceiptText|ConvertFrom-Json
 if($receipt.schemaVersion-cne'melisa-current-business-pair-preparation.v1'-or$receipt.applicationSourceCommit-cne$i.applicationSource-or$receipt.producerSourceCommit-cne$i.producerSource-or$receipt.legacyApiSourceCommit-cne$i.legacySource-or$receipt.legacyWebSourceCommit-cne$i.frontendSource-or$receipt.apiRoot-cne$i.componentRoot-or$receipt.webRoot-cne$i.webRoot-or$receipt.apiManifestSha256-cne$i.digests[0]-or$receipt.webManifestSha256-cne$i.digests[1]){throw 'CURRENT_PAIR_RECEIPT_SCOPE'}
 foreach($m in @($ApiManifest,$WebManifest)){
  if($m.currentBusinessPair.applicationSourceCommit-cne$i.applicationSource-or$m.currentBusinessPair.producerSourceCommit-cne$i.producerSource-or$m.database-cne$i.database-or$m.actualT1-ne$false-or$m.externalOperations-ne$false){throw 'CURRENT_PAIR_MANIFEST_TUPLE'}
 }
 if($ApiManifest.sourceCommit-cne$i.legacySource-or$WebManifest.sourceCommit-cne$i.frontendSource-or$WebManifest.backendRoot-cne$i.componentRoot-or$WebManifest.backendManifestSha256-cne$i.digests[0]){throw 'CURRENT_PAIR_MANIFEST_LINK'}
}
# A configuration binding, never an OS/Job witness or stop/recovery grant.
if(!(Get-Variable ErpCurrentPairBindings -Scope Script -ErrorAction SilentlyContinue)){$script:ErpCurrentPairBindings=[Collections.Generic.List[object]]::new()}
function Get-ErpCurrentPairBinding($Binding) {
 $found=@($script:ErpCurrentPairBindings|Where-Object {[object]::ReferenceEquals($_.token,$Binding)})
 if($found.Count-ne1){throw 'CURRENT_PAIR_BINDING_REQUIRED'};$b=$found[0]
 if($b.closed-or$b.pid-ne$PID-or$b.thread-ne[Threading.Thread]::CurrentThread.ManagedThreadId-or($b.token|ConvertTo-Json -Compress)-cne$b.tokenText-or($b.config|ConvertTo-Json -Depth 100 -Compress)-cne$b.configText-or($b.plan|ConvertTo-Json -Depth 100 -Compress)-cne$b.planText){throw 'CURRENT_PAIR_BINDING_CHANGED'}
 return $b
}
function Get-ErpCurrentPairBoundPins($Binding) {[void](Get-ErpCurrentPairBinding $Binding);return Get-ErpCurrentPairWebPins}
function Assert-ErpCurrentPairPrivateProfile($Binding,$Api,$Manifest) {
 [void](Get-ErpCurrentPairBinding $Binding)
 # The already approved repaired profile, byte-pinned by the previous
 # Diagnostic contract. No profile/secret/role/activation delta is introduced.
 $bytes=Read-ErpBusinessSalePinnedFile 'C:\Sirket\ERP\config\TEST-20260929-01\business-5244-private.json' (Get-ErpCurrentPairIdentity).digests[3]
 $actual=[Text.Encoding]::UTF8.GetString($bytes)|ConvertFrom-Json
 if(($Api|ConvertTo-Json -Depth 100 -Compress)-cne($actual|ConvertTo-Json -Depth 100 -Compress)){throw 'CURRENT_PAIR_PROFILE_CHANGED'}
 Assert-ErpBusinessSaleWriterProfileFields $Api $Manifest
 $copy=$Api.PSObject.Copy();$copy.PSObject.Properties.Remove('businessSaleAdmission');$copy.PSObject.Properties.Remove('businessSaleWritesEnabled');return $copy
}
function Open-ErpCurrentPairBinding($Plan,[string]$ConfigText,[string]$TaskText,[string]$Sddl,[string]$Root,[string]$SourceHash,[string]$ReceiptText) {
 Assert-ErpCurrentPairProjection $Plan $ConfigText $TaskText $Sddl $Root $SourceHash
 $config=$ConfigText|ConvertFrom-Json
 Assert-ErpCurrentPairBaseConfig $config
 $api=Get-ErpApiComponentConfig $config;$i=Get-ErpCurrentPairIdentity
 if($api.ReleaseRoot-cne$i.componentRoot-or$api.ManifestSha256-cne$i.digests[0]){throw 'CURRENT_PAIR_COMPONENT_SCOPE'}
 $amPath=Join-Path $api.ReleaseRoot 'release-manifest.json'
 if((Get-FileHash -LiteralPath $amPath).Hash-ine$i.digests[0]){throw 'CURRENT_PAIR_API_HASH'}
 $am=Get-Content -LiteralPath $amPath -Raw|ConvertFrom-Json
 $wmPath=Join-Path $i.webRoot 'release-manifest.json'
 if((Get-FileHash -LiteralPath $wmPath).Hash-ine$i.digests[1]){throw 'CURRENT_PAIR_WEB_HASH'}
 $wm=Get-Content -LiteralPath $wmPath -Raw|ConvertFrom-Json
 Assert-ErpCurrentPairReceipt $ReceiptText $am $wm
 $token=[pscustomobject]@{caseId=$i.caseId;sourceManifestHash=$SourceHash}
 $planText=$Plan|ConvertTo-Json -Depth 100 -Compress
 $b=@{token=$token;tokenText=($token|ConvertTo-Json -Compress);config=$config;configText=$ConfigText;pid=$PID;thread=[Threading.Thread]::CurrentThread.ManagedThreadId;closed=$false;plan=($planText|ConvertFrom-Json);planText=$planText;root=$Root;sourceHash=$SourceHash}
 $script:ErpCurrentPairBindings.Add($b)
 try{
  $actual=Read-ErpStartupConfig $Plan.startupConfig -NormalPairBinding $token
  if(($actual|ConvertTo-Json -Depth 100 -Compress)-cne$ConfigText){throw 'CURRENT_PAIR_CONFIG_RACE'}
  return $token
 }catch{$b.closed=$true;throw}
}
function Read-ErpCurrentPairTask {
 $service=New-Object -ComObject 'Schedule.Service';$service.Connect();$task=$service.GetFolder('\').GetTask('Melisa-ERP-TEST-Canonical')
 # The preserved before-image includes owner, group and DACL (1|2|4).
 # This is READ_CONTROL only; no SACL request or security descriptor write.
 return @{xml=[string]$task.Xml;sddl=[string]$task.GetSecurityDescriptor(7)}
}
function Assert-ErpCurrentPairLiveBinding($Binding) {
 $b=Get-ErpCurrentPairBinding $Binding;$task=Read-ErpCurrentPairTask
 Assert-ErpCurrentPairProjection $b.plan ([IO.File]::ReadAllText($b.plan.startupConfig)) $task.xml $task.sddl $b.root $b.sourceHash
}
# This observation is issued only inline by the session after it created and
# verified both children. It is not a stop, SQL, deployment, or admission grant.
if(!(Get-Variable ErpCurrentPairObservations -Scope Script -ErrorAction SilentlyContinue)){$script:ErpCurrentPairObservations=[Collections.Generic.List[object]]::new()}
function Get-ErpCurrentPairObservationToken($Binding){
 $b=Get-ErpCurrentPairBinding $Binding
 if(!$b.ContainsKey('ownedObservationToken')-or$null-eq$b.ownedObservationToken){throw 'CURRENT_PAIR_OBSERVATION_NOT_ISSUED'}
 [void](Get-ErpCurrentPairOwnedObservation $b.ownedObservationToken)
 return $b.ownedObservationToken
}
function Get-ErpCurrentPairOwnedObservation($Observation){
 $rows=@($script:ErpCurrentPairObservations|Where-Object{[object]::ReferenceEquals($_.token,$Observation)})
 if($rows.Count-ne1){throw 'CURRENT_PAIR_OBSERVATION_NOT_ISSUED'};$r=$rows[0]
 if($r.closed-or$r.pid-ne$PID-or$r.thread-ne[Threading.Thread]::CurrentThread.ManagedThreadId-or$r.sid-cne[Security.Principal.WindowsIdentity]::GetCurrent().User.Value-or($Observation|ConvertTo-Json -Compress)-cne$r.tokenJson-or($r.facts|ConvertTo-Json -Compress)-cne$r.factsJson-or($r.definition|ConvertTo-Json -Depth 10 -Compress)-cne$r.definitionJson-or$r.definition.Name-cne'api'-or$r.definition.Port-ne4144){throw 'CURRENT_PAIR_OBSERVATION_CHANGED'}
 $b=Get-ErpCurrentPairBinding $r.binding
 if(!$b.ContainsKey('ownedObservationToken')-or![object]::ReferenceEquals($b.ownedObservationToken,$Observation)-or$b.config.OwnerSid-cne$r.sid-or![object]::ReferenceEquals($b.config,$r.config)){throw 'CURRENT_PAIR_OBSERVATION_BINDING_CHANGED'}
 if($null-eq$r.apiChild-or$r.apiChild.GetType()-ne[Diagnostics.Process]-or$null-eq$r.webChild-or$r.webChild.GetType()-ne[Business5244WebNative]-or$null-eq$r.seal-or$r.seal.GetType()-ne[Business5244PackageSeal]){throw 'CURRENT_PAIR_OBSERVATION_OWNER_CHANGED'}
 Assert-Business5244StartupLease -Lease $r.lease -Kind Owner
 $leaseRecord=Get-Business5244StartupRecord $r.lease
 if(!$leaseRecord.ContainsKey('ownedNatives')-or@($leaseRecord.ownedNatives|Where-Object{[object]::ReferenceEquals($_,$r.webChild)}).Count-ne1){throw 'CURRENT_PAIR_OBSERVATION_NATIVE_NOT_OWNED'}
 $r.seal.Validate();Assert-ErpCurrentPairLiveBinding $r.binding
 if($r.apiChild.HasExited-or$r.apiChild.Id-ne$r.facts.apiPid-or$r.apiChild.Handle-eq[IntPtr]::Zero-or$r.apiChild.StartTime.ToUniversalTime().ToString('o')-cne$r.facts.apiBirth-or$r.webChild.ChildPid-ne$r.facts.webPid-or$r.webChild.ChildBirth-cne$r.facts.webBirth-or$r.webChild.OwnerBirth-cne$r.facts.ownerBirth-or!$r.webChild.ChildAlive()){throw 'CURRENT_PAIR_OBSERVATION_CHILD_CHANGED'}
 $r.webChild.Validate();$pins=Get-ErpCurrentPairBoundPins $r.binding
 $owned=Assert-ErpOwnedProcess $r.facts.apiPid $r.config $r.definition $r.facts.apiBirth
 if(!$owned){throw 'CURRENT_PAIR_OBSERVATION_API_MISSING'}
 $apiRows=@(Get-ErpServiceListeners $r.definition $r.config)
 if(!$apiRows.Count-or@($apiRows|Where-Object{$_.OwningProcess-ne$r.facts.apiPid}).Count){throw 'CURRENT_PAIR_OBSERVATION_API_LISTENER_CHANGED'}
 [void](Assert-ErpHealth $r.config $r.definition);Assert-Business5244CreatedChild $r.webChild $pins
 $webRows=@(Get-NetTCPConnection -LocalPort 5244 -State Listen -ErrorAction Stop);Assert-Business5244OwnedListeners $webRows $r.facts.webPid
 $r.seal.Validate();Assert-Business5244StartupLease -Lease $r.lease -Kind Owner
 $owned=Assert-ErpOwnedProcess $r.facts.apiPid $r.config $r.definition $r.facts.apiBirth
 if(!$owned-or$r.apiChild.HasExited-or$r.apiChild.StartTime.ToUniversalTime().ToString('o')-cne$r.facts.apiBirth-or!$r.webChild.ChildAlive()-or$r.webChild.ChildPid-ne$r.facts.webPid-or$r.webChild.ChildBirth-cne$r.facts.webBirth){throw 'CURRENT_PAIR_OBSERVATION_CHILD_CHANGED'}
 $apiRows=@(Get-ErpServiceListeners $r.definition $r.config)
 if(!$apiRows.Count-or@($apiRows|Where-Object{$_.OwningProcess-ne$r.facts.apiPid}).Count){throw 'CURRENT_PAIR_OBSERVATION_API_LISTENER_CHANGED'}
 $webRows=@(Get-NetTCPConnection -LocalPort 5244 -State Listen -ErrorAction Stop);Assert-Business5244OwnedListeners $webRows $r.facts.webPid
 $r.seal.Validate();Assert-Business5244StartupLease -Lease $r.lease -Kind Owner
 return [pscustomobject]@{status='OWNED_PAIR_OBSERVATION_ONLY';apiPid=$r.facts.apiPid;apiBirth=$r.facts.apiBirth;webPid=$r.facts.webPid;webBirth=$r.facts.webBirth;ownerPid=$r.pid;apiPort=4144;webPort=5244;database=(Get-ErpCurrentPairIdentity).database;sqlAuthority=$false;stopAuthority=$false;installationAuthority=$false;actualT1=$false}
}
function Invoke-ErpCurrentPairSession($Binding,[switch]$SinglePass) {
 $b=Get-ErpCurrentPairBinding $Binding;$config=$b.config
 $mutex=[Threading.Mutex]::new($false,(Get-ErpMutexName $config.RepoRoot $config.OwnerSid));$held=$false;$lease=$null;$apiChild=$null;$webChild=$null;$apiBirth=$null;$seal=$null;$primary=$null;$observation=$null
 try{
  try{$held=$mutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$mutex.ReleaseMutex();throw 'CURRENT_PAIR_CANONICAL_ABANDONED'}
  if(!$held){throw 'CURRENT_PAIR_ALREADY_OWNED'}
  $lease=Enter-Business5244StartupLease -Kind Owner
  Assert-ErpCurrentPairLiveBinding $Binding
  $definition=@(Get-ErpServiceDefinitions $config|Where-Object {$_.Name-ceq'api'})
  if($definition.Count-ne1-or$definition[0].Port-ne4144){throw 'CURRENT_PAIR_TWO_SERVICE_SCOPE'};$definition=$definition[0]
  if(@(Get-ErpServiceListeners $definition $config).Count-or@(Get-NetTCPConnection -LocalPort 5244 -State Listen -ErrorAction SilentlyContinue).Count){throw 'CURRENT_PAIR_PORT_OCCUPIED_NO_ADOPTION'}
  Initialize-Business5244WebNative;$seal=[Business5244PackageSeal]::new()
  $seal.Add($config.ApiComponent.ConfigPath,(Get-ErpCurrentPairIdentity).digests[3])
  Assert-ErpRelease (Get-ErpApiComponentConfig $config) -RetainedSeal $seal|Out-Null
  $pins=Get-ErpCurrentPairBoundPins $Binding
  Assert-Business5244OwnedPackage $pins $seal -NormalPairBinding $Binding
  $seal.Freeze();$seal.Validate();Assert-ErpCurrentPairLiveBinding $Binding
  Assert-Business5244StartupLease $lease -Kind Owner
  if(@(Get-ErpServiceListeners $definition $config).Count-or@(Get-NetTCPConnection -LocalPort 5244 -State Listen -ErrorAction SilentlyContinue).Count){throw 'CURRENT_PAIR_PORT_CHANGED'}
  $argsList=@($definition.Script)+$definition.Args|ForEach-Object {'"'+$_+'"'}
  $apiChild=Start-Process -FilePath $config.NodePath -ArgumentList $argsList -WorkingDirectory $definition.WorkingDirectory -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $config.LogDir 'current-pair-api.out.log') -RedirectStandardError (Join-Path $config.LogDir 'current-pair-api.err.log')
  $apiBirth=$apiChild.StartTime.ToUniversalTime().ToString('o');[void]$apiChild.Handle
  $deadline=[DateTime]::UtcNow.AddSeconds(180);$ready=$false
  do{
   if($apiChild.HasExited){throw 'CURRENT_PAIR_API_EXITED'}
   Assert-Business5244StartupLease $lease -Kind Owner;Assert-ErpCurrentPairLiveBinding $Binding
   [void](Assert-ErpOwnedProcess $apiChild.Id $config $definition $apiBirth)
   try{$health=Assert-ErpHealth $config $definition;Assert-Business5244ApiHealth $health $pins;$ready=$true}catch{if($_.Exception.Message-like'TEST_STARTUP_*'-or$_.Exception.Message-ceq'BUSINESS_WEB_API_REJECTED'){throw}}
   if(!$ready){Start-Sleep -Milliseconds 250}
  }while(!$ready-and[DateTime]::UtcNow-lt$deadline)
  if(!$ready){throw 'CURRENT_PAIR_API_START_TIMEOUT'}
  $seal.Validate();Assert-ErpCurrentPairLiveBinding $Binding
  $webChild=New-Business5244PinnedChild $pins $lease -NormalPairBinding $Binding
  do{
   Assert-ErpCurrentPairLiveBinding $Binding;Assert-Business5244StartupLease $lease -Kind Owner;$seal.Validate()
   if($apiChild.HasExited-or!$webChild.ChildAlive()){throw 'CURRENT_PAIR_CHILD_EXITED_NO_RESTART'}
   [void](Assert-ErpOwnedProcess $apiChild.Id $config $definition $apiBirth)
   $rows=@(Get-ErpServiceListeners $definition $config)
   if(!$rows.Count-or@($rows|Where-Object {$_.OwningProcess-ne$apiChild.Id}).Count){throw 'CURRENT_PAIR_API_LISTENER_CHANGED'}
   [void](Assert-ErpHealth $config $definition);Assert-Business5244CreatedChild $webChild $pins
   $rows=@(Get-NetTCPConnection -LocalPort 5244 -State Listen -ErrorAction Stop);Assert-Business5244OwnedListeners $rows $webChild.ChildPid
   if($null-eq$observation){
    $token=[pscustomobject][ordered]@{schema='melisa-current-pair-owned-observation.v1';id=[guid]::NewGuid().ToString('N')}
    $facts=[pscustomobject][ordered]@{apiPid=$apiChild.Id;apiBirth=$apiBirth;webPid=$webChild.ChildPid;webBirth=$webChild.ChildBirth;ownerBirth=$webChild.OwnerBirth}
    $observation=@{token=$token;tokenJson=($token|ConvertTo-Json -Compress);facts=$facts;factsJson=($facts|ConvertTo-Json -Compress);binding=$Binding;config=$config;lease=$lease;apiChild=$apiChild;webChild=$webChild;seal=$seal;definition=$definition;definitionJson=($definition|ConvertTo-Json -Depth 10 -Compress);pid=$PID;thread=[Threading.Thread]::CurrentThread.ManagedThreadId;sid=$config.OwnerSid;closed=$false}
    [void]$script:ErpCurrentPairObservations.Add($observation);$b.ownedObservationToken=$token
   }
   if($SinglePass){return [pscustomobject]@{caseId=(Get-ErpCurrentPairIdentity).caseId;startedPorts=@(4144,5244);apiPid=$apiChild.Id;webPid=$webChild.ChildPid;metadata='UNKNOWN';masterwriter=$false}}
   Start-Sleep -Seconds 2
  }while($true)
 }catch{$primary=$_;throw}finally{
  if($null-ne$observation){$observation.closed=$true;if($b.ContainsKey('ownedObservationToken')){$b.Remove('ownedObservationToken')}}
  # Only children created by this invocation. No record adoption, old owner,
  # native4146, WEB5194, SQL, CRM or Vega stop/restart path exists here.
  $cleanupFailed=$false
  try{if($lease){Close-Business5244PinnedChildren $lease}}catch{$cleanupFailed=$true}
  try{if($apiChild-and!$apiChild.HasExited){$actual=Assert-ErpOwnedProcess $apiChild.Id $config $definition $apiBirth;if(!$actual-or$apiChild.StartTime.ToUniversalTime().ToString('o')-cne$apiBirth){throw 'CURRENT_PAIR_API_CLEANUP_IDENTITY'};$apiChild.Kill();if(!$apiChild.WaitForExit(5000)){throw 'CURRENT_PAIR_API_CLEANUP_UNCONFIRMED'}}}catch{$cleanupFailed=$true}
  try{if($apiChild){$apiChild.Dispose()}}catch{$cleanupFailed=$true}
  try{if($seal){$seal.Dispose()}}catch{$cleanupFailed=$true}
  try{if($lease){Exit-Business5244StartupLease $lease}}catch{$cleanupFailed=$true}
  try{if($held){$mutex.ReleaseMutex()}}catch{$cleanupFailed=$true}
  try{$mutex.Dispose()}catch{$cleanupFailed=$true}
  $b.closed=$true
  if($cleanupFailed){if($null-eq$primary){throw 'CURRENT_PAIR_CLEANUP_UNCONFIRMED'};try{[Console]::Error.WriteLine('CURRENT_PAIR_CLEANUP_UNCONFIRMED')}catch{}}
 }
}
