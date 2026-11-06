import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const script=readFileSync(new URL('./read-master-v5-permission-seed.ps1',import.meta.url),'utf8'),builder=readFileSync(new URL('./build-master-v5-package.mjs',import.meta.url),'utf8');
test('seed helper is fixed target, read-only, bounded and always disposes its process-owned connection',()=>{
 for(const part of ['DB_ID()<>5',"N'Semih\\MELISAERP'",'5240','c67f5317-9c0d-4831-aadd-fadc379a95d1','eb2888c2-51cb-4570-a933-397cf7e62806','schema_version=4',"CONNECTIONPROPERTY('net_transport')","IDENT_CURRENT(N'dbo.permissions')","-cne '42'",'MASTER_V5_PERMISSION_SEED_42_VERIFIED',"[Console]::Error.WriteLine('MASTER_V5_PERMISSION_SEED_REJECTED')",'$connection.Dispose()'])assert.ok(script.includes(part),part);
 assert.doesNotMatch(script,/\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE|GRANT|REVOKE|DROP)\s+(?:dbo\.|TABLE|LOGIN|ROLE|USER)/i);
 assert.match(builder,/scripts\/desktop-empty\/read-master-v5-permission-seed\.ps1/);
});
