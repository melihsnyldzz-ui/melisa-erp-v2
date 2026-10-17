import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
test('62401 remains blocked by default; dedicated helper requires exact verified TEST writer identity',()=>{
 const script=`const {enableCrmOrderTestGateway,networkPolicy}=await import('./canonical-test-network.mjs');
 if(networkPolicy.ports.includes(62401))throw Error('PORT_OPEN_BY_DEFAULT');
 const identity={databaseName:'MELISA_ERP_SIRKET_TEST_20260929_01',loginName:'melisa_sirket_sales_test_20260929_01',databaseUser:'melisa_sirket_sales_test_20260929_01',serverName:'Semih\\\\MELISADEV',sysadmin:0,databaseControl:0,liveDatabaseAccess:0};
 Object.assign(process.env,{MELISA_CANONICAL_TEST:'true',SQL_DATABASE:identity.databaseName,SQL_READ_ONLY:'false',MELISA_TEST_SCOPED_SALES:'true'});
 for(const change of [{sysadmin:1},{liveDatabaseAccess:1},{databaseControl:1},{databaseName:'OTHER'},{loginName:'OTHER'},{databaseUser:'OTHER'},{serverName:'OTHER'}]){let rejected=false;try{enableCrmOrderTestGateway({...identity,...change});}catch{rejected=true;}if(!rejected)throw Error('INVALID_IDENTITY_ACCEPTED');}
 process.env.SQL_READ_ONLY='true';let rejected=false;try{enableCrmOrderTestGateway(identity);}catch{rejected=true;}if(!rejected)throw Error('READ_ONLY_ACCEPTED');process.env.SQL_READ_ONLY='false';
 const policy=enableCrmOrderTestGateway(identity);if(!policy.ports.includes(62401)||policy.hosts.some(h=>!['127.0.0.1','localhost','::1'].includes(h))||policy.externalMessages!==false)throw Error('SCOPE_CHANGED');`;
 const preload=process.env.CI==='true'?['--require',fileURLToPath(new URL('../../scripts/ci/offline-guard.cjs',import.meta.url))]:[];
 const result=spawnSync(process.execPath,[...preload,'--input-type=module','-e',script],{cwd:new URL('.',import.meta.url),encoding:'utf8'});assert.equal(result.status,0,result.stderr);
});
