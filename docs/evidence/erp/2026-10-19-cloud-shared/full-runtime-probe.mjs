import {DatabaseSync} from 'node:sqlite';
import {resolveTestApiBase} from '../../../../apps/sites-workflow/src/workflow/testAdminSession.mjs';
import {terminalCrmUrl} from '../../../../apps/sites-workflow/src/workflow/personnelTerminalModel.mjs';
import {demoReadRequest,demoPartyRows} from '../../../../apps/sites-workflow/src/demo/demoWorkspace.js';
import {writeFileSync} from 'node:fs';
const location=new URL('https://melisa-ortak-sentetik-test.melihsnyldzz.chatgpt.site');
const output={kind:'offline-existing-source-compatibility-probe',networkAccess:false,environmentRead:false,productionAccess:false,sourceErp:'aa2035b4bf24062e107d0365452e8fc0d61d22dc',tests:[]};
const db=new DatabaseSync(':memory:');
for(const [name,sql] of [['SQL Server TOP/dbo query', 'SELECT TOP (1) id FROM dbo.users'],['SQL Server transaction application lock',"EXEC sys.sp_getapplock @Resource=N'synthetic-compatibility',@LockMode=N'Exclusive'"],['SQL Server procedure identity',"SELECT OBJECT_DEFINITION(OBJECT_ID(N'dbo.synthetic_procedure'))"]]) {
 let rejected=false;try{db.prepare(sql);}catch{rejected=true;}
 output.tests.push({name,sqliteRejected:rejected});if(!rejected)throw Error('Unexpected SQLite compatibility');
}db.close();
const originResult=resolveTestApiBase({location,apiBase:location.origin});
if(originResult!==null)throw Error('Unexpected origin grant');
output.tests.push({name:'Existing TEST frontend rejects hosted origin',result:originResult});
let terminalRejected=false;try{terminalCrmUrl(location);}catch{terminalRejected=true;}
if(!terminalRejected)throw Error('Unexpected terminal CRM origin grant');
output.tests.push({name:'Existing terminal CRM bridge rejects hosted origin',rejected:terminalRejected});
const customer=demoPartyRows('customer')[0];let unavailable;
try{demoReadRequest('/api/read-only-parties/customer/'+customer.id+'/movements');}catch(e){unavailable={code:e.code,status:e.status};}
if(unavailable?.code!=='DEMO_DATASET_UNAVAILABLE')throw Error('Unexpected demo movement availability');
output.tests.push({name:'Existing demo has no complete customer movements',...unavailable});
const q=demoReadRequest('/api/operational-queue');
output.tests.push({name:'Existing demo operational queue is incomplete',complete:q.data.complete,notConnected:q.data.groups?.filter(g=>g.state==='not_connected').map(g=>g.key)});
if(q.data.complete!==false)throw Error('Unexpected complete demo queue');
if(process.argv[2]) writeFileSync(process.argv[2],JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({checks:output.tests.length,pass:true,network:false,database:'fresh in-memory SQLite only'}));
