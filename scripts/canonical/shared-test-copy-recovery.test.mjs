import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const file=fileURLToPath(new URL('./shared-test-copy-recovery.ps1',import.meta.url)),source=fs.readFileSync(file,'utf8');
test('shared recovery is one fresh finite target with no active overwrite or service action',()=>{
 assert.match(source,/\$copyDb='MELISA_ERP_CRM_SHARED_TEST_20261009_01'/);assert.match(source,/\$targets=@\(\$copyDb\)/);
 assert.match(source,/COPY_ONLY,CHECKSUM\$compression,NOINIT/);assert.match(source,/RESTORE VERIFYONLY.*WITH CHECKSUM/);assert.match(source,/Assert-Stage4Target \$copyDb/);
 assert.doesNotMatch(source,/WITH\s+REPLACE|DROP\s+DATABASE|ALTER DATABASE|SET READ_WRITE|SINGLE_USER|Stop-Process|Start-Process|RESTORE DATABASE \[\$sourceDb\]/i);
 for(const table of ['crm_order_v2_requests','crm_order_v2_intents','terminal_device_customer_routes','customer_route_assignments','sales_orders'])assert.ok(source.includes('dbo.'+table));
});
test('dot source has no SQL/file effects and protects both existing target and table/module drift',{skip:process.platform!=='win32'},()=>{
 const code=`$ErrorActionPreference='Stop'; . '${file.replaceAll("'","''")}' -Mode Rehearse;if($Mode -cne 'Rehearse'){throw 'REQUESTED_MODE_LOST'}; function Open-Stage4Connection {throw 'SQL_MUST_NOT_RUN'}; function New-Item {throw 'FILE_MUST_NOT_RUN'};
 function Blocked([scriptblock]$f){try{&$f;throw 'UNBLOCKED'}catch{if($_.Exception.Message -eq 'UNBLOCKED'){throw}}}
 $d=Join-Path $dataRoot ($copyDb+'.mdf');$l=Join-Path $dataRoot ($copyDb+'_log.ldf');Assert-Stage4Target $copyDb $d $l $false $false $false;Blocked {Assert-Stage4Target $copyDb $d $l $true $false $false};Blocked {Assert-Stage4Target $sourceDb $d $l $false $false $false};
 function Fixture([string]$db){$g=@{};foreach($t in $criticalTables){$g[$t]=@{count=1;basis=$hashBasis;fullRowsHashMultisetSHA256=('a'*64)}};return @{identity=@{server=$server;database=$db};groups=$g;modules=@(@{name='guard';disabled=0});schema=@(@{scale=8});databaseState=@(@{state_desc='ONLINE';is_read_only=$false;collation_name='Turkish_CI_AS'});coverage='bounded'}}
 $b=Fixture $sourceDb;$a=Fixture $sourceDb;$c=Fixture $copyDb;if((Shared-Compare $b $a $c).status -ne 'PASS'){throw 'VALID_PROOF'};$c.groups['dbo.crm_order_v2_requests'].count=2;if((Shared-Compare $b $a $c).status -ne 'FAIL'){throw 'DRAFT_DRIFT_MISSED'};$c=Fixture $copyDb;$c.modules[0].disabled=1;if((Shared-Compare $b $a $c).status -ne 'FAIL'){throw 'GUARD_DRIFT_MISSED'};'SHARED_OFFLINE_PASS'`;
 const result=spawnSync('pwsh',['-NoProfile','-NonInteractive','-Command',code],{encoding:'utf8',timeout:10000});assert.equal(result.status,0,result.stderr||result.stdout);assert.match(result.stdout,/SHARED_OFFLINE_PASS/);
});
