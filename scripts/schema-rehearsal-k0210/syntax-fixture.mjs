// Offline grammar fixture only. No SQL connection or execution capability.
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {compileRehearsalEmptyObserver,compileRehearsalBootstrap} from './foundation.mjs';
import {compileRehearsalObserver,compileRehearsalTransition,compileRehearsalV2Observer} from './transition.mjs';
import {reviewRehearsalSemantic} from './semantic-review.mjs';
import {LOCAL_MASTER_BASE_TABLES,LOCAL_MASTER_DDL_SOURCE} from '../desktop-empty/local-master-schema-proposal.mjs';
import {SALE_WORKFLOW_SCHEMA_PROPOSAL} from '../desktop-empty/sale-workflow-schema-proposal.mjs';
import {REHEARSAL_SERVER,REHEARSAL_DATABASE} from './identity.mjs';
const m={server:REHEARSAL_SERVER,database:REHEARSAL_DATABASE,databaseId:11111,databaseGuid:'e2a89d24-3984-4bbf-8a3f-d1485c667234',databaseCreateTime:'2030-01-01T10:00:00.000',environmentId:'ab621184-82bf-4d09-8257-d2d9b0657372',adminPid:60101,adminProcessBirth:'2030-01-01T09:00:00.0000000Z',adminSid:'0x0102030405060708',sqlProcessId:60102,sqlProcessBirth:'2030-01-01T08:00:00.0000000Z'};
const newNames=['desktop_local_product_units','desktop_local_price_units','desktop_local_master_requests','desktop_sale_request_resolutions','desktop_sale_workflows','desktop_sale_reservations','desktop_sale_cartons','desktop_sale_carton_items','desktop_sale_workflow_requests'];
const oldChecks=['CK_desktop_empty_installation_version','CK_desktop_empty_installation_readonly'];
const v1={schemas:[],synonyms:[],userTypes:[],objects:[...LOCAL_MASTER_BASE_TABLES.map(name=>({name,type:'U',parentName:null})),...oldChecks.map(name=>({name,type:'C',parentName:'desktop_empty_installation'}))],columns:[],keys:[],indexes:[],foreignKeys:[],checks:oldChecks.map(name=>({name,tableName:'desktop_empty_installation'})),defaults:[]};
const child=[];for(const body of [...LOCAL_MASTER_DDL_SOURCE,...SALE_WORKFLOW_SCHEMA_PROPOSAL]){const t=/^\s*CREATE TABLE dbo\.([a-z_]+)\s*\(/i.exec(body)?.[1];if(!t)continue;for(const c of body.matchAll(/\bCONSTRAINT\s+([A-Za-z_][A-Za-z0-9_]*)\s+(PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK|DEFAULT)\b/gi)){const type={'PRIMARY KEY':'PK','FOREIGN KEY':'F',UNIQUE:'UQ',CHECK:'C',DEFAULT:'D'}[c[2].toUpperCase().replace(/\s+/g,' ')];child.push({name:c[1],type,parentName:t,parentSchema:'dbo',schemaName:'dbo'});}}
const v2=structuredClone(v1);v2.objects=v2.objects.filter(x=>!oldChecks.includes(x.name)).concat(newNames.map(name=>({name,type:'U',parentName:null,schemaName:'dbo'})),child,[{name:'CK_desktop_profile_version_mode',type:'C',parentName:'desktop_empty_installation'}]);v2.checks=[{name:'CK_desktop_profile_version_mode',tableName:'desktop_empty_installation',definition:'([schema_version]=(2) AND [read_only]=(0) OR [schema_version]=(1) AND [read_only]=(1))',is_disabled:false,is_not_trusted:false,is_not_for_replication:false}];v2.indexes=[...child.filter(x=>['PK','UQ'].includes(x.type)).map(x=>({name:x.name,tableName:x.parentName,schemaName:'dbo'})),{name:'UX_desktop_local_units_main',tableName:'desktop_local_product_units',schemaName:'dbo'},{name:'IX_desktop_active_reservations',tableName:'desktop_sale_reservations',schemaName:'dbo'},{name:'UX_desktop_local_price_identity',tableName:'product_prices'},{name:'UX_desktop_sale_item_identity',tableName:'sales_invoice_items'}];
const json=x=>JSON.stringify(x),sha=x=>createHash('sha256').update(Buffer.from(x,'utf16le')).digest('hex'),j1=json(v1),j2=json(v2),review=reviewRehearsalSemantic({baselineJson:j1,baselineSha256:sha(j1),candidateJson:j2,candidateSha256:sha(j2)});
const b={metadataSha256:'1'.repeat(64),securitySha256:'2'.repeat(64),identitySha256:'3'.repeat(64),markerSha256:'4'.repeat(64),objectIdsSha256:'5'.repeat(64),businessSha256:'6'.repeat(64),semanticSha256:sha(j1)};
export function emitSyntheticSyntaxFixture(){
 const previews=[
  ['empty',compileRehearsalEmptyObserver(m),0],
  ['bootstrap',compileRehearsalBootstrap(m,{metadataSha256:'a'.repeat(64),securitySha256:'b'.repeat(64)}),1],
  ['v1-observer',compileRehearsalObserver(m),0],
  ['rollback',compileRehearsalTransition(m,b,'rollback'),1],
  ['apply',compileRehearsalTransition(m,b,'apply',review),1],
  ['v2-observer',compileRehearsalV2Observer(m,b,review),1]
 ];
 return {kind:'K0210_SYNTHETIC_TSQL160_FIXTURE',executionAuthorized:false,sqlExecuted:false,
  identityIsSynthetic:true,identityFixture:m,baselineIsSynthetic:true,
  cases:previews.map(([name,p,minimumLiteralBodies])=>{
   if(p.executionAuthorized!==false||p.sqlTested!==false||typeof p.sql!=='string')throw Error('SYNTHETIC_DESCRIPTOR_REJECTED');
   return {name,sql:p.sql,sha256:p.sha256,minimumLiteralBodies};
  })};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 process.stdout.write(JSON.stringify(emitSyntheticSyntaxFixture()));
}
