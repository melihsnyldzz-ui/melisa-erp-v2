// Entirely synthetic compiler/proof scaffold. It does not execute native SQL.
import {sharedCrmPriceFixture} from './shared-crm-price-test-fixture.mjs';
import {CUSTOMER_CONTACT_PREDECESSOR_NAMES as NAMES,CUSTOMER_CONTACT_CONTEXT,CUSTOMER_CONTACT_UPDATE,CUSTOMER_CONTACT_PROOF,CUSTOMER_CONTACT_PROJECTOR} from './shared-business-customer-contact-contract.mjs';
import {buildCustomerContactRevision,customerContactHash,customerContactJSON} from './shared-business-customer-contact-sql.mjs';
export async function customerContactFixture(){
 const f=await sharedCrmPriceFixture(),copy=f.args.copyContext;
 const map=new Map([...f.args.selectedBundle.replacements,...f.args.priceBundle.objects,...f.args.priceConsumerBundle.objects,...f.bundle.objects].map(m=>[m.name,m]));
 const parents=NAMES.map(name=>{
  let definition=map.get(name)?.definition;
  if(!definition)definition=`CREATE PROCEDURE ${name} @copy_id uniqueidentifier WITH EXECUTE AS OWNER AS BEGIN SET NOCOUNT ON;IF CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.usp_stage4_copy_ready'))),2) IS NULL THROW 51904,'OFFLINE_PARENT',1;END;`;
  if(!/WITH\s+EXECUTE\s+AS\s+OWNER/i.test(definition))definition=definition.replace(/\bAS\s+BEGIN/i,'WITH EXECUTE AS OWNER AS BEGIN');
  return{schemaName:'dbo',objectName:name.slice(4),objectType:name==='dbo.business_product_price_sale_link_guard'?'TR':'P',definition,definitionHash:customerContactHash(definition)};
 });
 const names=['id','customer_code','name','phone','email','city','country','address','currency_code','customer_type','balance','risk_limit','is_active','is_deleted','passive_at','passive_reason','created_at','created_by','updated_at','updated_by','row_version','source_record_key','migration_run_id','source_payload_hash','source_payload_json','source_document_key','original_document_date','party_entity_id','source_notes'];
 const schema=names.map((columnName,i)=>({schemaName:'dbo',tableName:'customers',ordinal:i+1,columnName,typeName:columnName==='id'?'bigint':columnName==='row_version'?'timestamp':'nvarchar',maxLength:columnName==='id'||columnName==='row_version'?8:columnName==='phone'?100:200,precision:columnName==='id'?19:0,scale:0,nullable:columnName!=='id'&&columnName!=='row_version',identityColumn:columnName==='id',computedColumn:false}));
 const input={copyContext:copy,contactActor:{id:'17',nativeRoleId:'2',nativeRoleCode:'admin',permissionsRowsHash:'A'.repeat(64)},parentModules:parents,schema};
 const bundle=buildCustomerContactRevision(input),revision=bundle.revision;
 const metadata={db:copy.target.database,server:copy.target.server,login:copy.target.login,databaseUser:copy.target.login,sysadmin:0,control:0,live:0,originalDatabaseAccess:0,sessionId:71,transactionId:'1001',transactionCount:1,transactionState:1,isolationLevel:4,copyLockMode:'Shared',contextExecute:1,updateExecute:1,proofExecute:1,proofViewDefinition:1,proofDefinitionHash:revision.modules.find(m=>m.name===CUSTOMER_CONTACT_PROOF).afterHash,registryPrivateAccess:0,projectorPrivateAccess:0};
 const proof={recordsets:[[{sessionId:71,transactionId:'1001',scopeHash:revision.scopeHash}],revision.modules.map((m,i)=>({copyId:copy.copyId,name:m.name,moduleType:m.moduleType,beforeHash:m.beforeHash,afterHash:m.afterHash,actualHash:m.afterHash,scopeHash:revision.scopeHash,revisionHash:revision.revisionHash,objectId:3000+i,parentName:m.name==='dbo.business_product_price_sale_link_guard'?'dbo.work_sales_links':null,moduleDisabled:0,immutableHash:revision.immutableTriggerHash,immutableDisabled:0})),[{scope_json:customerContactJSON(revision.scope)}]]};
 return{copy,input,bundle,metadata,proof,procedures:[CUSTOMER_CONTACT_CONTEXT,CUSTOMER_CONTACT_UPDATE,CUSTOMER_CONTACT_PROOF,CUSTOMER_CONTACT_PROJECTOR],nativeExecution:false};
}
