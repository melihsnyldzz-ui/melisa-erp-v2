# Offline public-source AST test ONLY. Never dot-source/invoke the production host.
$ErrorActionPreference='Stop'
$hostSource=Join-Path $PSScriptRoot 'lifecycle-root-runner.ps1'
$tokens=$null;$errors=$null
$tree=[Management.Automation.Language.Parser]::ParseFile($hostSource,[ref]$tokens,[ref]$errors)
if($errors.Count-ne0){throw 'PHASE_TEST_HOST_SYNTAX'}
$functions=@($tree.FindAll({param($n)$n-is[Management.Automation.Language.FunctionDefinitionAst]-and$n.Name-ceq'Get-WarehouseRuntimeProofName'},$true))
if($functions.Count-ne1){throw 'PHASE_TEST_MAPPING_DEFINITION'}
$mapping=$functions[0].Body
# The only executed production fragment must contain no commands/member calls.
if(@($mapping.FindAll({param($n)$n-is[Management.Automation.Language.CommandAst]-or$n-is[Management.Automation.Language.InvokeMemberExpressionAst]},$true)).Count-ne0){throw 'PHASE_TEST_MAPPING_NOT_PURE'}
$pure=$mapping.GetScriptBlock()
$pre=@($pure.Invoke('activate'));$post=@($pure.Invoke('deactivate'))
if($pre.Count-ne1-or[string]$pre[0]-cne'warehouse-lifecycle-preactivation-runtime-r2.json'){throw 'PHASE_TEST_PREACTIVATION_NAME'}
if($post.Count-ne1-or[string]$post[0]-cne'normal-form-source-runtime.json'){throw 'PHASE_TEST_DEACTIVATION_NAME'}
if([string]$pre[0]-ceq[string]$post[0]){throw 'PHASE_TEST_IMMUTABILITY_COLLISION'}
foreach($bad in @('observe','ACTIVATE','../runtime','')){$denied=$false;try{[void]$pure.Invoke($bad)}catch{$denied=$true};if(-not$denied){throw 'PHASE_TEST_BAD_ACTION_ACCEPTED'}}
$bound=@($tree.FindAll({param($n)$n-is[Management.Automation.Language.FunctionDefinitionAst]-and$n.Name-ceq'BoundJson'},$true))
if($bound.Count-ne1){throw 'PHASE_TEST_BOUND_JSON'}
$calls=@($bound[0].Body.FindAll({param($n)$n-is[Management.Automation.Language.CommandAst]-and$n.GetCommandName()-ceq'Get-WarehouseRuntimeProofName'},$true))
if($calls.Count-ne1-or$calls[0].CommandElements.Count-ne2-or$calls[0].CommandElements[1].Extent.Text-cne'$Action'){throw 'PHASE_TEST_PRODUCER_CONSUMER_BINDING'}
$normalSource=[IO.File]::ReadAllText((Join-Path $PSScriptRoot 'normal-form-contract.mjs'))
if(-not$normalSource.Contains("p.actualSourceFile!=='normal-form-source-'+kind+'.json'")){throw 'PHASE_TEST_NORMAL_FORM_FILENAME_DRIFT'}
[pscustomobject]@{state='WAREHOUSE_PHASE_SLOT_PURE_AST_TESTS_PASSED';syntaxErrors=0;mappingCases=6;distinctPrePostNames=$true;boundJsonConsumesAction=$true;normalFormFilenamePreserved=$true;productionHostInvoked=$false;sqlConnections=0}|ConvertTo-Json -Compress
