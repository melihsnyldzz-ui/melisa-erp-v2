# Offline parse only: never dot-source or invoke the SQL capture wrapper.
$ErrorActionPreference='Stop'
$target=Join-Path $PSScriptRoot 'capture-shared-business-supplier-contact.ps1'
$tokens=$null
$parseErrors=$null
$ast=[System.Management.Automation.Language.Parser]::ParseFile($target,[ref]$tokens,[ref]$parseErrors)
if($null-eq $ast-or$parseErrors.Count-ne 0){throw 'SUPPLIER_CONTACT_CAPTURE_PARSE_FAILED'}
$convert=$ast.FindAll({param($node) $node-is[System.Management.Automation.Language.CommandAst]-and$node.GetCommandName()-eq 'ConvertFrom-Json'},$true)
if($convert.Count-ne 1-or$convert[0].Extent.Text-match 'AsHashtable'){throw 'SUPPLIER_CONTACT_CAPTURE_PS51_JSON_REQUIRED'}
Write-Output 'SUPPLIER_CONTACT_CAPTURE_PS_PARSE_OK'
