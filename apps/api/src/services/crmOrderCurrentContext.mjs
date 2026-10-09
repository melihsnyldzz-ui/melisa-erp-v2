import {createHash} from 'node:crypto';
import {validateCurrentProductCatalogContext} from './currentProductCatalogContext.mjs';
import {crmV2Error,crmV2Conversation,crmV2Phone} from './crmOrderV2Contract.mjs';

export const CRM_SHARED_DATABASE='MELISA_ERP_CRM_SHARED_TEST_20261009_01';
export const CRM_EXTENDED_DATABASE='MELISA_ERP_CRM_SHARED_TEST_20261009_02';
export const CRM_SHARED_TOPOLOGIES=Object.freeze({
 [CRM_SHARED_DATABASE]:Object.freeze({login:'melisa_crm_shared_draft_20261009_01',crmOrigin:'http://127.0.0.1:62601',nativePort:62604,apiPort:4174,uiOrigin:'http://127.0.0.1:62600'}),
 [CRM_EXTENDED_DATABASE]:Object.freeze({login:'melisa_crm_shared_draft_20261009_02',crmOrigin:'http://127.0.0.1:62701',nativePort:62704,apiPort:4184,uiOrigin:'http://127.0.0.1:62700'}),
});
export const CRM_SHARED_SERVER='Semih\\MELISADEV';
export const CRM_SHARED_SOURCE_DATABASE='MELISA_ERP_SIRKET_TEST_20260929_01';
export const CRM_CURRENT_PROCEDURES=Object.freeze({customers:'dbo.usp_shared_crm_order_customers',create:'dbo.usp_shared_crm_order_create',read:'dbo.usp_shared_crm_order_read'});
const registered=new WeakSet();
let configured;
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/i.test(v);
const fail=()=>{throw crmV2Error('CRM_V2_TARGET_UNAVAILABLE',503);};
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};

// Only the bootstrap may install this finite copy context. Request JSON and
// environment variables cannot grant current-source writes in another database.
export function validateCrmOrderCurrentContext(input){
 if(input?.schemaVersion!=='melisa-crm-shared-test-context.v1'||input.actualT1!==false||input.sourceDatabase!==CRM_SHARED_SOURCE_DATABASE||!hash(input.backupSHA)||!hash(input.quarantineGuardHash)||!/^\b[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(input.copyId??''))fail();
 const t=input.target;
 const topology=CRM_SHARED_TOPOLOGIES[t?.database];
 if(!topology||t.server!==CRM_SHARED_SERVER||t.login!==topology.login||t.databaseUser!==t.login)fail();
 if(input.crmOrigin!==topology.crmOrigin||input.nativePort!==topology.nativePort||input.apiPort!==topology.apiPort||input.externalOperations!==false||input.stockEffect!==false||input.ledgerEffect!==false||input.reservationEffect!==false)fail();
 if(t.database===CRM_EXTENDED_DATABASE){
  if(!Array.isArray(input.approvedConversations)||input.approvedConversations.length<1||input.approvedConversations.length>100000)fail();
  const seen=new Set();for(const entry of input.approvedConversations){
   if(!entry||Object.keys(entry).sort().join()!=='conversationId,peer')fail();
   try{crmV2Conversation(entry.conversationId);crmV2Phone(entry.peer);}catch{fail();}
   if(seen.has(entry.conversationId))fail();seen.add(entry.conversationId);
  }
 }else if(Object.hasOwn(input,'approvedConversations'))fail();
 let catalog;try{catalog=validateCurrentProductCatalogContext(input.catalog);}catch{fail();}
 const result=freeze({...structuredClone(input),catalog:structuredClone(catalog)});registered.add(result);return result;
}
export function assertCrmOrderCurrentContext(context){if(!registered.has(context))fail();return context;}
export function crmOrderCurrentConversationAllowed(context,conversationId,peer){
 assertCrmOrderCurrentContext(context);
 return context.target.database===CRM_SHARED_DATABASE?conversationId==='55':context.approvedConversations.some(e=>e.conversationId===conversationId&&e.peer===peer);
}
export function assertCrmOrderCurrentIdentity(context,identity){
 assertCrmOrderCurrentContext(context);const t=context.target;
 if(identity?.databaseName!==t.database||identity.serverName!==t.server||identity.loginName!==t.login||identity.databaseUser!==t.databaseUser||identity.sysadmin!==0||identity.databaseControl!==0||identity.originalDatabaseAccess!==0||identity.liveDatabaseAccess!==0)fail();
 return identity;
}
export function configureCrmOrderCurrentContext(input,identity){
 if(configured)fail();const context=validateCrmOrderCurrentContext(input);assertCrmOrderCurrentIdentity(context,identity);configured=context;return context;
}
export const getCrmOrderCurrentContext=()=>configured??null;
export function crmOrderCurrentSource(context){
 const c=assertCrmOrderCurrentContext(context).catalog;
 return freeze({runId:c.runId,sourceAsOf:c.sourceAsOf,sourceHash:c.sourceHash,planHash:c.planHash,bindingsHash:c.bindingsHash,snapshotHash:c.snapshotHash,counts:{products:c.productCount,prices:c.priceCount},actualT1:false});
}
export const crmOrderCurrentSourceHash=context=>createHash('sha256').update(JSON.stringify(crmOrderCurrentSource(context)),'utf16le').digest('hex').toUpperCase();
