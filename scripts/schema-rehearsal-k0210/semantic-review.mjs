// Compares independently captured SQL JSON; this does not authenticate a
// process, prove a rollback, or authorize execution of an apply plan.
import {createHash} from 'node:crypto';
import {LOCAL_MASTER_DDL_SOURCE} from '../desktop-empty/local-master-schema-proposal.mjs';
import {SALE_WORKFLOW_SCHEMA_PROPOSAL} from '../desktop-empty/sale-workflow-schema-proposal.mjs';
const tables=new Set(['desktop_local_product_units','desktop_local_price_units','desktop_local_master_requests','desktop_sale_request_resolutions','desktop_sale_workflows','desktop_sale_reservations','desktop_sale_cartons','desktop_sale_carton_items','desktop_sale_workflow_requests']);
const parts=['schemas','synonyms','userTypes','objects','columns','keys','indexes','foreignKeys','checks','defaults'];
const digest=s=>createHash('sha256').update(Buffer.from(s,'utf16le')).digest('hex');
const removedChecks=new Set(['CK_desktop_empty_installation_version','CK_desktop_empty_installation_readonly']);
const addedCheck='CK_desktop_profile_version_mode';
const addedIndexes=new Set(['UX_desktop_local_price_identity','UX_desktop_sale_item_identity']);
const newChildren=[];for(const body of [...LOCAL_MASTER_DDL_SOURCE,...SALE_WORKFLOW_SCHEMA_PROPOSAL]){const t=/^\s*CREATE TABLE dbo\.([a-z_]+)\s*\(/i.exec(body)?.[1];if(!t)continue;for(const c of body.matchAll(/\bCONSTRAINT\s+([A-Za-z_][A-Za-z0-9_]*)\s+(PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK|DEFAULT)\b/gi)){const type={'PRIMARY KEY':'PK','FOREIGN KEY':'F',UNIQUE:'UQ',CHECK:'C',DEFAULT:'D'}[c[2].toUpperCase().replace(/\s+/g,' ')];newChildren.push([t,c[1],type]);}}
if(newChildren.length!==42||new Set(newChildren.map(x=>x[1])).size!==42)throw Error('K0210_CHILD_SOURCE_REJECTED');
const newIndexes=[...newChildren.filter(x=>x[2]==='PK'||x[2]==='UQ').map(([t,n])=>[t,n]),['desktop_local_product_units','UX_desktop_local_units_main'],['desktop_sale_reservations','IX_desktop_active_reservations']];
// SQL Server metadata rendering needs an independent real-target readback.
// Only these two logically equivalent canonical renderings are admitted.
const markerDefinitions=new Set(["([schema_version]=(1) AND [read_only]=(1) OR [schema_version]=(2) AND [read_only]=(0))","([schema_version]=(2) AND [read_only]=(0) OR [schema_version]=(1) AND [read_only]=(1))"]);
const fail=()=>{throw Error('K0210_SEMANTIC_REJECTED');};
const reviews=new WeakSet();
export function isRehearsalSemanticReview(value){return !!value&&reviews.has(value);}
function parse(json,sha){if(typeof json!=='string'||typeof sha!=='string'||!/^[a-f0-9]{64}$/.test(sha)||digest(json)!==sha)fail();let x;try{x=JSON.parse(json);}catch{fail();}if(!x||Object.getPrototypeOf(x)!==Object.prototype||Object.keys(x).sort().join(',')!==[...parts].sort().join(',')||parts.some(k=>!Array.isArray(x[k])))fail();return x;}
function project(o,kind,candidate){
 if(['schemas','synonyms','userTypes'].includes(kind))return true;
 if(kind==='objects'){
  if((tables.has(o.name)&&o.type?.trim()==='U'&&o.schemaName==='dbo'&&o.parentName===null)||tables.has(o.parentName))return false;
  if(o.parentName==='desktop_empty_installation'&&(candidate?o.name===addedCheck:removedChecks.has(o.name)))return false;
  return true;
 }
 if(tables.has(o.tableName))return false;
 if(kind==='checks'&&o.tableName==='desktop_empty_installation'&&(candidate?o.name===addedCheck:removedChecks.has(o.name)))return false;
 if(kind==='indexes'&&candidate&&addedIndexes.has(o.name)&&((o.name==='UX_desktop_local_price_identity'&&o.tableName==='product_prices')||(o.name==='UX_desktop_sale_item_identity'&&o.tableName==='sales_invoice_items')))return false;
 return true;
}
export function reviewRehearsalSemantic({baselineJson,baselineSha256,candidateJson,candidateSha256}={}){
 const b=parse(baselineJson,baselineSha256),c=parse(candidateJson,candidateSha256);
 const v1=new Set(b.objects.filter(x=>x.type?.trim()==='U').map(x=>x.name)),v2=new Set(c.objects.filter(x=>x.type?.trim()==='U').map(x=>x.name));
 if(v1.size!==27||v2.size!==36||[...tables].some(n=>v1.has(n)||!v2.has(n)))fail();
 const actualTables=c.objects.filter(x=>x.type?.trim()==='U'&&tables.has(x.name));if(actualTables.length!==9||actualTables.some(x=>x.schemaName!=='dbo'||x.parentName!==null))fail();
 const actualChildren=c.objects.filter(x=>tables.has(x.parentName));if(actualChildren.length!==newChildren.length||actualChildren.some(x=>x.schemaName!=='dbo'||x.parentSchema!=='dbo'||!newChildren.some(([t,n,k])=>x.parentName===t&&x.name===n&&x.type?.trim()===k))||new Set(actualChildren.map(x=>x.name)).size!==newChildren.length)fail();
 const actualIndexes=c.indexes.filter(x=>tables.has(x.tableName));if(actualIndexes.length!==newIndexes.length||actualIndexes.some(x=>x.schemaName!=='dbo'||!newIndexes.some(([t,n])=>x.tableName===t&&x.name===n))||new Set(actualIndexes.map(x=>x.name)).size!==newIndexes.length)fail();
 for(const n of removedChecks)if(b.checks.filter(x=>x.tableName==='desktop_empty_installation'&&x.name===n).length!==1||c.checks.some(x=>x.name===n))fail();
 for(const k of parts){const before=b[k].filter(x=>project(x,k,false)),after=c[k].filter(x=>project(x,k,true));if(JSON.stringify(before)!==JSON.stringify(after))fail();}
 if(c.checks.filter(x=>x.tableName==='desktop_empty_installation'&&x.name===addedCheck&&x.is_disabled===false&&x.is_not_trusted===false&&x.is_not_for_replication===false&&markerDefinitions.has(x.definition)).length!==1)fail();
 for(const n of addedIndexes)if(c.indexes.filter(x=>x.name===n).length!==1)fail();
 const review=Object.freeze({candidateSemanticSha256:candidateSha256,baselineSemanticSha256:baselineSha256,executionAuthorized:false,independentRollbackNotAuthenticated:true});reviews.add(review);return review;
}
