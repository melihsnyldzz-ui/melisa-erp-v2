import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {spawnSync} from 'node:child_process';
const source=fs.readFileSync(new URL('./capture-shared-test-copy-input.ps1',import.meta.url),'utf8');
test('capture baseline groups typed SQL rows by native table without losing dictionary names',{skip:process.platform!=='win32'},()=>{
 assert.ok(source.includes('$rows.Add([pscustomobject]$row)'));assert.ok(source.includes('Group-Object -Property { $_.tableName }'));
 const code="$ErrorActionPreference='Stop';$rows=@([pscustomobject][ordered]@{schemaName='dbo';tableName='products';columnName='id';typeName='bigint'},[pscustomobject][ordered]@{schemaName='dbo';tableName='products';columnName='stock_code';typeName='nvarchar'},[pscustomobject][ordered]@{schemaName='dbo';tableName='work_trade_requests';columnName='id';typeName='uniqueidentifier'});$g=@($rows|Group-Object -Property { $_.tableName });if($g.Count -ne 2 -or @($g|Where-Object Name -eq 'products')[0].Count -ne 2 -or @($g|Where-Object Name -eq 'work_trade_requests')[0].Count -ne 1){throw 'GROUP_LOST'};foreach($t in $g){if($t.Name -cnotmatch '^[a-zA-Z0-9_]+$'){throw 'TABLE_NAME'}};'CAPTURE_GROUP_PASS'";
 const result=spawnSync('pwsh',['-NoProfile','-NonInteractive','-Command',code],{encoding:'utf8',timeout:10000});assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/CAPTURE_GROUP_PASS/);
});
test('capture saves permission flags and excludes private credential fields from typed input',()=>{
 assert.match(source,/actorPermissionRows=\$actorPermissionRows/);assert.match(source,/can_view=1 OR can_create=1 OR can_update=1 OR can_approve=1/);
 assert.doesNotMatch(source,/\$input\.(?:sqlPassword|salesSqlPassword|jwtAccessSecret|jwtRefreshSecret)|Write-Output\s+\$(?:old|current|profile)/);
});
