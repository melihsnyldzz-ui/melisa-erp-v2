// Offline compiler for the second, explicitly bounded business TEST copy.
// Source receipts and original trigger bodies remain provenance anchors.
import crypto from 'node:crypto';
import {COPY_DB,COPY_LOGIN,COPY_MUTABLE_TABLES,moduleHash,stage4CopySchema,stage4ReadySQL,stage4BeginSQL,stage4EffectsSQL,stage4RequestGuardSQL,immutableCopyTrigger,stage4GuardBranch,stage4ReadProcedure,stage4QuarantineProcedure} from './stage4-copy-sql.mjs';
import {preservedAggregate,changedFirstOrders,sharedActorPermissions,SHARED_WRITER} from './shared-test-copy-sql.mjs';
import {sharedGoodsCreatorGuardSQL} from './shared-test-copy-revision-sql.mjs';
import {BUSINESS_COPY_DATABASE,SHARED_COPY_DATABASE,ISOLATED_COPY_SOURCE_DATABASE,ISOLATED_COPY_SERVER,isolatedCopyHash,isolatedCopyJSON,validateIsolatedOperationCopyContext} from '../../apps/api/src/services/isolatedOperationCopyContext.mjs';
import {validateCurrentProductCatalogContext} from '../../apps/api/src/services/currentProductCatalogContext.mjs';
import {CATALOG_SQL_PROOF} from '../../apps/api/src/services/catalogSqlProof.mjs';
import {businessScopeHash} from './shared-business-scope.mjs';
import {businessCopyReadySQL,businessCopyBeginSQL,businessCopyNativeGuardSQL} from './shared-business-native-guards.mjs';
import {buildBusinessNativeChecks} from './shared-business-native-checks.mjs';
export const BUSINESS_WRITER='melisa_shared_test_rw_20261009_02';
export const BUSINESS_READER='melisa_shared_test_ro_20261009_02';
const check=(v,c)=>{if(!v)throw Error(c);};
const adapt=s=>s.replaceAll(COPY_DB,BUSINESS_COPY_DATABASE).replaceAll(COPY_LOGIN,BUSINESS_WRITER).replaceAll(SHARED_COPY_DATABASE,BUSINESS_COPY_DATABASE).replaceAll(SHARED_WRITER,BUSINESS_WRITER);
const table=s=>s.match(/\bON\s+(?:\[dbo\]|dbo)\.(?:\[([a-zA-Z0-9_]+)\]|([a-zA-Z0-9_]+))/i)?.slice(1).find(Boolean);
const compiled=e=>{const definition=adapt(e.definition);return {...e,definition,afterHash:moduleHash(definition.replace(/^ALTER\b/i,'CREATE'))};};
const exact=(s,n)=>`CONVERT(varchar(60),CONVERT(decimal(28,${n}),${s}))`;
const origin="N'ISOLATED_TEST_COPY' operationOrigin,CAST(0 AS bit) synthetic";
export function businessCopyContextSQL(){return adapt(`CREATE PROCEDURE dbo.usp_stage4_copy_context @copy_id uniqueidentifier,@actor_id bigint,@domain nvarchar(20),@supplier_id bigint=NULL,@currency nvarchar(3)=NULL WITH EXECUTE AS OWNER AS BEGIN SET NOCOUNT ON;
IF DB_NAME() COLLATE Latin1_General_100_BIN2<>N'${COPY_DB}' OR @@SERVERNAME<>N'Semih\\MELISADEV' THROW 51904,'BUSINESS_CONTEXT_TARGET',1;
EXEC dbo.usp_stage4_copy_ready @copy_id;
DECLARE @p nvarchar(max),@seal char(64),@backup char(64),@actor nvarchar(max),@context nvarchar(max),@revision char(64),@role bigint,@code nvarchar(80),@account bigint,@party bigint;
SELECT @p=profile_json,@seal=seal_hash,@backup=backup_sha FROM dbo.stage4_copy_manifest WHERE copy_id=@copy_id AND sealed=1;
IF JSON_VALUE(@p,'$.scopeKind')<>N'VERIFIED_BUSINESS_TEST' OR JSON_VALUE(@p,'$.actualT1')<>N'false' OR JSON_VALUE(@p,'$.target.database')<>DB_NAME() THROW 51904,'BUSINESS_CONTEXT_SEAL',1;
IF @domain<>N'inbound' THROW 51904,'BUSINESS_DOMAIN_NOT_VERIFIED',1;
SELECT @role=u.role_id,@code=r.code FROM dbo.users u JOIN dbo.roles r ON r.id=u.role_id AND r.is_active=1 JOIN OPENJSON(@p,'$.actors')WITH(id bigint,nativeRoleId bigint,nativeRoleCode nvarchar(80),permissionsRowsHash char(64))s ON s.id=u.id AND s.nativeRoleId=u.role_id AND s.nativeRoleCode=r.code WHERE u.id=@actor_id AND u.is_active=1 AND s.permissionsRowsHash=CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT x.* FROM dbo.permissions x WHERE x.role_id=u.role_id ORDER BY x.id FOR JSON PATH,INCLUDE_NULL_VALUES)),2);
IF @role IS NULL THROW 51904,'BUSINESS_ACTOR_DRIFT',1;
DECLARE @permissions TABLE(k nvarchar(160) PRIMARY KEY);INSERT @permissions SELECT DISTINCT CONVERT(nvarchar(160),v.value) FROM OPENJSON(@p,'$.actors')WITH(id bigint,permissions nvarchar(max) AS JSON)s CROSS APPLY OPENJSON(s.permissions)v WHERE s.id=@actor_id;
IF NOT EXISTS(SELECT 1 FROM @permissions WHERE k=N'goods.view') THROW 51904,'BUSINESS_INBOUND_FORBIDDEN',1;
SELECT @actor=(SELECT CONVERT(varchar(20),@actor_id) id,@code role,CAST(1 AS bit) active,JSON_QUERY(s.permissions) permissions FROM OPENJSON(@p,'$.actors')WITH(id bigint,permissions nvarchar(max) AS JSON)s WHERE s.id=@actor_id FOR JSON PATH,WITHOUT_ARRAY_WRAPPER);
IF @supplier_id IS NULL AND @currency IS NULL SELECT TOP(1) @supplier_id=s.id,@currency=s.currency FROM OPENJSON(@p,'$.suppliers')WITH(id bigint,currency nvarchar(3))s WHERE s.currency=N'TRY' AND EXISTS(SELECT 1 FROM OPENJSON(@p,'$.products')WITH(supplierId bigint)p WHERE p.supplierId=s.id) ORDER BY s.id;
IF @supplier_id IS NULL OR @currency IS NULL OR @currency NOT IN(N'TRY',N'USD',N'EUR') THROW 51904,'BUSINESS_SUPPLIER_SELECTION_REQUIRED',1;
SELECT @account=s.accountId,@party=s.partyId FROM OPENJSON(@p,'$.suppliers')WITH(id bigint,accountId bigint,partyId bigint,currency nvarchar(3),sourceKnown bit)s WHERE s.id=@supplier_id AND s.currency=@currency AND s.sourceKnown=1;
IF @account IS NULL OR (SELECT COUNT(*) FROM OPENJSON(@p,'$.suppliers')WITH(id bigint,currency nvarchar(3))s WHERE s.id=@supplier_id AND s.currency=@currency)<>1 THROW 51904,'BUSINESS_SUPPLIER_ACCOUNT_SCOPE',1;
DECLARE @products nvarchar(max),@supplier nvarchar(max),@warehouse nvarchar(max),@state nvarchar(max);
SELECT @products=COALESCE((SELECT CONVERT(varchar(20),p.id) id,p.stock_code stockCode,p.name,
 (SELECT TOP(1)b.barcode FROM dbo.product_barcodes b JOIN OPENJSON(s.barcodes)x ON x.value COLLATE Latin1_General_100_BIN2=b.barcode COLLATE Latin1_General_100_BIN2 WHERE b.product_id=p.id AND b.is_active=1 ORDER BY b.is_primary DESC,b.id) barcode,
 ${exact('p.current_stock_qty',3)} stockQuantityExact3,JSON_QUERY(N'{"label":"ADET","factorExact8":"1.00000000"}') unit,CAST(1 AS bit) writeEligible,${origin},s.purchasePriceExact8,s.purchaseCurrency,s.costExact4,${exact('p.average_cost_try',8)} stockUnitCostTryExact8
 FROM dbo.products p JOIN OPENJSON(@p,'$.products')WITH(id bigint,supplierId bigint,barcodes nvarchar(max) AS JSON,purchasePriceExact8 varchar(60),purchaseCurrency nvarchar(3),costExact4 varchar(60))s ON s.id=p.id
 WHERE s.supplierId=@supplier_id ORDER BY p.id FOR JSON PATH,INCLUDE_NULL_VALUES),N'[]');
IF (SELECT COUNT(*) FROM OPENJSON(@products))=0 THROW 51904,'BUSINESS_SUPPLIER_NO_VERIFIED_PRODUCTS',1;
SELECT @supplier=(SELECT CONVERT(varchar(20),c.id) id,c.supplier_code code,c.name,@currency currency,CONVERT(varchar(20),@account) accountId,CONVERT(varchar(20),@party) partyId,${exact('a.current_balance',4)} balanceExact4,${exact('a.current_balance',8)} balanceExact8,CAST(1 AS bit) writeEligible,${origin} FROM dbo.suppliers c JOIN dbo.party_currency_accounts a ON a.id=@account AND a.supplier_id=c.id AND a.currency_code=@currency WHERE c.id=@supplier_id FOR JSON PATH,WITHOUT_ARRAY_WRAPPER);
SELECT @warehouse=(SELECT CONVERT(varchar(20),id) id,name label FROM dbo.test_purchase_warehouses WHERE id=1 AND code=JSON_VALUE(@p,'$.warehouse.code') FOR JSON PATH,WITHOUT_ARRAY_WRAPPER);
IF @supplier IS NULL OR @warehouse IS NULL THROW 51904,'BUSINESS_NATIVE_SCOPE_DRIFT',1;
SELECT @state=(SELECT JSON_QUERY(@products) products,JSON_QUERY(@supplier) supplier,(SELECT COUNT_BIG(*) FROM dbo.stage4_copy_requests WHERE copy_id=@copy_id) requests FOR JSON PATH,WITHOUT_ARRAY_WRAPPER);
SET @revision=LOWER(CONVERT(varchar(64),HASHBYTES('SHA2_256',@state),2));
SELECT @context=(SELECT JSON_QUERY((SELECT N'melisa-work-inbound.v1' schemaVersion,N'native-test' source,JSON_VALUE(@p,'$.date') date,N'Europe/Istanbul' timeZone,N'ISOLATED_TEST_COPY' operationOrigin,LOWER(CONVERT(varchar(36),@copy_id)) copyId,@seal sealHash FOR JSON PATH,WITHOUT_ARRAY_WRAPPER)) meta,@revision revision,
 JSON_QUERY((SELECT ${origin},JSON_QUERY(@supplier) supplier,JSON_QUERY(@products) products,JSON_QUERY(@warehouse) warehouse FOR JSON PATH,WITHOUT_ARRAY_WRAPPER)) scope,JSON_QUERY(JSON_QUERY(@p,'$.currencyRates')) currencyRates FOR JSON PATH,WITHOUT_ARRAY_WRAPPER);
SELECT @context context_json,@actor actor_json,(SELECT CAST(1 AS bit) valid,LOWER(CONVERT(varchar(36),@copy_id)) copyId,@seal sealHash,@backup backupSHA,JSON_QUERY((SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.usp_stage4_copy_ready'))),2) ready,CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(@@PROCID)),2) context,CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.usp_stage4_copy_begin'))),2) [begin],CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.usp_stage4_copy_effects'))),2) effects FOR JSON PATH,WITHOUT_ARRAY_WRAPPER)) definitionHashes FOR JSON PATH,WITHOUT_ARRAY_WRAPPER) proof_json;
END;`);}

export function businessCountBindingSchema(){return `CREATE TABLE dbo.work_business_count_bindings(count_id bigint NOT NULL PRIMARY KEY REFERENCES dbo.work_inbound_counts(id),supplier_id bigint NOT NULL REFERENCES dbo.suppliers(id),account_id bigint NOT NULL REFERENCES dbo.party_currency_accounts(id),currency nvarchar(3) NOT NULL CHECK(currency IN(N'TRY',N'USD',N'EUR')));`;}
export function businessCountBindingGuard(){return adapt(`CREATE TRIGGER dbo.business_count_bindings_guard ON dbo.work_business_count_bindings WITH EXECUTE AS OWNER AFTER INSERT,UPDATE,DELETE AS BEGIN SET NOCOUNT ON;
IF DB_NAME()<>N'${COPY_DB}' OR @@SERVERNAME<>N'Semih\\MELISADEV' OR ORIGINAL_LOGIN()<>N'${COPY_LOGIN}' OR EXISTS(SELECT 1 FROM deleted) OR(SELECT COUNT(*) FROM inserted)<>1 THROW 51904,'BUSINESS_COUNT_BINDING_IMMUTABLE',1;
IF EXISTS(SELECT 1 FROM inserted i WHERE NOT EXISTS(SELECT 1 FROM dbo.stage4_copy_intents n JOIN dbo.stage4_copy_manifest m ON m.copy_id=n.copy_id AND m.sealed=1 JOIN dbo.work_inbound_counts c ON c.id=i.count_id CROSS APPLY OPENJSON(m.profile_json,'$.suppliers')WITH(id bigint,accountId bigint,currency nvarchar(3))s WHERE n.session_id=@@SPID AND n.transaction_id=CURRENT_TRANSACTION_ID() AND n.operation=N'count_create' AND c.created_by=n.actor_id AND c.created_at>=n.created_at AND s.id=i.supplier_id AND s.accountId=i.account_id AND s.currency=i.currency AND JSON_VALUE(n.payload_json,'$.businessSupplierId')=CONVERT(varchar(20),i.supplier_id) AND JSON_VALUE(n.payload_json,'$.businessAccountId')=CONVERT(varchar(20),i.account_id) AND JSON_VALUE(n.payload_json,'$.businessCurrency')=i.currency)) THROW 51904,'BUSINESS_COUNT_BINDING_INTENT',1;END;`);}

export function buildBusinessCopyBundle(input,scope){
 check(input.identity?.server===ISOLATED_COPY_SERVER&&input.identity.database===BUSINESS_COPY_DATABASE&&input.recoveryProof?.status==='PASS'&&input.recoveryProof.sourceBeforeAfterEqual===true&&input.recoveryProof.rawCopyMatchesSource===true,'BUSINESS_RAW_COPY_PROOF');
 const modules=input.modules,schema=input.schema;check(Array.isArray(modules)&&modules.length>=177&&Array.isArray(schema),'BUSINESS_COPY_MODULES');
 check(scope?.schemaVersion==='melisa-shared-business-scope.v1'&&scope.captureDatabase===BUSINESS_COPY_DATABASE&&/^[A-F0-9]{64}$/.test(scope.scopeHash),'BUSINESS_COPY_CAPTURE_SCOPE');
 const {scopeHash,...scopeBody}=scope;check(businessScopeHash(scopeBody)===scopeHash,'BUSINESS_COPY_CAPTURE_HASH');
 check(input.businessWrites===0&&input.currentFinanceDeltaContext?.accountIds?.length===283&&modules.length===337&&input.constraints?.length===227,'BUSINESS_COPY_SOURCE_COUNTS');
 const profile=structuredClone(input.profile);delete profile.sealHash;
 Object.assign(profile,{copyId:crypto.randomUUID(),date:'2026-10-09',sourceDatabase:ISOLATED_COPY_SOURCE_DATABASE,sourceCommit:input.sourceCommit,backupSHA:input.backupSHA.toUpperCase(),target:{server:ISOLATED_COPY_SERVER,database:BUSINESS_COPY_DATABASE,login:BUSINESS_WRITER,databaseUser:BUSINESS_WRITER},scopeKind:'VERIFIED_BUSINESS_TEST',businessScopeHash:scope.scopeHash,externalOperations:false,humanAccepted:false});
 profile.products=scope.products.filter(p=>p.goodsSourceBoundEligible===true).map(p=>({...p,priceIds:p.quotes.map(q=>q.quoteId),stockUnitCostTryExact8:p.costExact4+'0000'}));
 check(profile.products.length===1158&&scope.customers.length===375&&scope.suppliers.length===406,'BUSINESS_COPY_EXACT_VERIFIED_SCOPE');
 for(const p of profile.products)check(p.sourceKnown===true&&p.supplierBindingKnown===true&&p.supplierId!==null&&/^[A-Fa-f0-9]{64}$/.test(p.sourceWitnessHash)&&/^(?:0|[1-9]\d*)\.\d{4}$/.test(p.costExact4)&&Number(p.costExact4)>0&&Number(p.costExact4)<=1250&&p.unit==='ADET'&&p.unitFactorExact8==='1.00000000'&&p.quotes.length>0&&p.quotes.every(q=>q.verified===true&&q.mainUnit===true&&q.type==='sale'&&['TRY','USD','EUR'].includes(q.currency)&&Number(q.priceExact8)>0)&&(p.purchaseQuote===null&&p.purchasePriceExact8===null&&p.purchaseCurrency===null||p.purchaseQuote?.verified===true&&p.purchaseQuote.type==='purchase'&&p.purchaseQuote.unitSourceId===null&&p.purchaseQuote.currency===p.purchaseCurrency&&p.purchaseQuote.priceExact8===p.purchasePriceExact8&&Number(p.purchasePriceExact8)<=1179.80),'BUSINESS_COPY_PRODUCT_WITNESS');
 for(const kind of ['customers','suppliers'])profile[kind]=scope[kind].map(p=>{check(p.sourceKnown===true&&p.sourceAccountWitnessCount===1&&/^[A-Fa-f0-9]{64}$/.test(p.sourceWitnessHash)&&p.openingHumanAccepted===false,'BUSINESS_COPY_PARTY_WITNESS');return {...p};});
 profile.financeAccounts=scope.financeAccounts;
 profile.businessInvoiceMaxExact4='20000.0000';
 profile.currencyRates=[{currency:'TRY',rateExact8:'1.00000000',id:null,source:'IDENTITY_TRY',date:profile.date},...['USD','EUR'].map(currency=>{const r=scope.rates.filter(r=>r.currency===currency).sort((a,b)=>b.date.localeCompare(a.date)||Number(b.id)-Number(a.id))[0];check(r&&/^[1-9]\d*\.\d{8}$/.test(r.rateExact8)&&r.source&&r.date&&r.id,'BUSINESS_RATE_SOURCE_REQUIRED');return r;})];
 for(const a of profile.actors)a.permissions=sharedActorPermissions(a,input.actorPermissionRows[a.id]);
 profile.recoveryProof={...input.recoveryProof,schemaVersion:'melisa-shared-test.recovery-comparison.v1',comparedAt:input.recoveryProof.recordedAt};
 const current=validateCurrentProductCatalogContext(input.goal7SourceVersion);profile.currentProductSourceVersionRunId=current.runId;
 const replacements=[];
 for(const m of modules.filter(m=>m.schemaName==='dbo'&&m.type_desc==='SQL_TRIGGER')){
  if(/^(operation_quarantine_|supplier_identity_quarantine_v2_)/.test(m.name))replacements.push(compiled(stage4GuardBranch(m,{quarantine:true})));
  else if(COPY_MUTABLE_TABLES.includes(table(m.definition)))replacements.push(compiled(stage4GuardBranch(m)));
 }
 for(const m of modules.filter(m=>m.schemaName==='dbo'&&['usp_assert_operation_quarantine_v2','usp_check_operation_quarantine','usp_list_operation_quarantine'].includes(m.name)))replacements.push(compiled(stage4QuarantineProcedure(m)));
 const guardAggregate=preservedAggregate(modules,replacements);
 for(const name of Object.values(current.procedures)){const m=modules.find(m=>'dbo.'+m.name===name);check(m,'BUSINESS_CURRENT_READER');replacements.push(compiled(stage4ReadProcedure(m,guardAggregate,replacements)));}
 const add=(name,definition,kind='COPY_ONLY_PROOF')=>{const body=adapt(definition);return {name,definition:body,afterHash:moduleHash(body),kind};};
 const ready=businessCopyReadySQL(),guard=businessCopyNativeGuardSQL(schema);
 let effects=stage4EffectsSQL();
 // A native movement belongs to its exact account/currency. Multiple accounts
 // for one party cannot cross-join and falsely invalidate or sum currencies.
 effects=effects.replace("s ON s.id=m.customer_id WHERE m.id>","s ON s.id=m.customer_id AND s.accountId=m.party_currency_account_id WHERE m.id>").replace("s ON s.id=m.supplier_id WHERE m.id>","s ON s.id=m.supplier_id AND s.accountId=m.party_currency_account_id WHERE m.id>");
 effects=effects.replaceAll('WHERE CONVERT(decimal(38,8),c.balance)<>a.current_balance','WHERE c.currency_code=a.currency_code AND CONVERT(decimal(38,8),c.balance)<>a.current_balance');
 effects=effects.replace("IF @before IS NULL THROW 51904,'STAGE4_EFFECT_INTENT_REQUIRED',1;",`IF @before IS NULL THROW 51904,'STAGE4_EFFECT_INTENT_REQUIRED',1;
IF EXISTS(SELECT 1 FROM dbo.customer_movements m WHERE m.id>TRY_CONVERT(bigint,JSON_VALUE(@before,'$.maxCustomerId'))) OR EXISTS(SELECT 1 FROM dbo.supplier_movements m WHERE m.id>TRY_CONVERT(bigint,JSON_VALUE(@before,'$.maxSupplierId')) AND NOT EXISTS(SELECT 1 FROM OPENJSON(@p,'$.suppliers')WITH(id bigint,accountId bigint,partyId bigint,currency nvarchar(3))s WHERE s.id=m.supplier_id AND s.accountId=m.party_currency_account_id AND s.partyId=m.party_entity_id AND s.currency=m.currency_code AND m.balance_effect_exact IS NOT NULL)) THROW 51904,'BUSINESS_UNBOUND_NATIVE_MOVEMENT',1;`);
 const newDefinitions=[add('dbo.usp_stage4_copy_ready',ready),add('dbo.usp_stage4_copy_context',businessCopyContextSQL()),add('dbo.usp_stage4_copy_begin',businessCopyBeginSQL()),add('dbo.usp_stage4_copy_effects',effects),add('dbo.usp_stage4_copy_guard',guard),add('dbo.stage4_copy_requests_guard',stage4RequestGuardSQL()),add('dbo.business_count_bindings_guard',businessCountBindingGuard(),'BUSINESS_BINDING_GUARD')];
 for(const name of ['stage4_copy_manifest','stage4_copy_module_manifest','stage4_copy_effect_components'])newDefinitions.push(add('dbo.immutable_'+name,immutableCopyTrigger('dbo.immutable_'+name,'dbo.'+name),'COPY_PROOF_IMMUTABLE'));
 for(const name of COPY_MUTABLE_TABLES.filter(name=>schema.some(c=>c.schemaName==='dbo'&&c.tableName===name)))newDefinitions.push(add('dbo.stage4_guard_'+name,`CREATE TRIGGER dbo.stage4_guard_${name} ON dbo.${name} WITH EXECUTE AS OWNER AFTER INSERT,UPDATE,DELETE AS BEGIN SET NOCOUNT ON;DECLARE @i nvarchar(max)=(SELECT * FROM inserted FOR JSON PATH,INCLUDE_NULL_VALUES),@d nvarchar(max)=(SELECT * FROM deleted FOR JSON PATH,INCLUDE_NULL_VALUES);EXEC dbo.usp_stage4_copy_guard @table_name=N'${name}',@inserted=@i,@deleted=@d;END;`,'FINITE_COPY_NATIVE_GUARD'));
 profile.sql=Object.fromEntries(Object.entries({ready:'dbo.usp_stage4_copy_ready',context:'dbo.usp_stage4_copy_context',begin:'dbo.usp_stage4_copy_begin',effects:'dbo.usp_stage4_copy_effects'}).map(([k,name])=>[k,{name,hash:newDefinitions.find(m=>m.name===name).afterHash}]));
 const changedHashes=new Map(replacements.map(m=>[m.beforeHash,m.afterHash]));profile.catalogProof=Object.fromEntries(Object.entries(CATALOG_SQL_PROOF).map(([key,value])=>[key,key==='preservedGuardHash'?guardAggregate:changedHashes.get(value)||value]));
 profile.sealHash=isolatedCopyHash(profile);validateIsolatedOperationCopyContext(profile);
 const goal7SourceVersion={...current};for(const [key,procedure] of [['readerDefinitionHash','catalog'],['stockReaderDefinitionHash','stock'],['openingDetailDefinitionHash','detail'],['openingListDefinitionHash','list']])goal7SourceVersion[key]=replacements.find(m=>m.name===current.procedures[procedure]).afterHash;
 const config={host:'127.0.0.1',lanHost:'192.168.1.46',webPort:5234,erpPort:4184,nativePort:4186,server:ISOLATED_COPY_SERVER,database:BUSINESS_COPY_DATABASE,sqlUser:BUSINESS_READER,sqlPassword:crypto.randomBytes(48).toString('hex'),salesSqlUser:BUSINESS_WRITER,salesSqlPassword:crypto.randomBytes(48).toString('hex'),jwtAccessSecret:crypto.randomBytes(48).toString('hex'),jwtRefreshSecret:crypto.randomBytes(48).toString('hex'),copyContext:profile,goal7SourceVersion};
 for(const key of ['catalogMediaRoot','catalogMediaIndexSha256','catalogClassificationRoot','catalogClassificationIndexSha256','currentFinanceDeltaContext'])config[key]=input[key];
 const nativeChecks=buildBusinessNativeChecks(input.constraints,profile,guard);
 return {schemaSQL:adapt(stage4CopySchema())+businessCountBindingSchema(),copyId:profile.copyId,replacements,newDefinitions,moduleManifest:[...replacements,...newDefinitions].map(({name,beforeHash=null,afterHash,kind})=>({name,beforeHash,afterHash,kind})),sourceModuleHashes:modules.map(m=>({name:m.schemaName+'.'+m.name,hash:moduleHash(m.definition)})),sourceChecks:input.constraints,nativeChecks,originalFirstOrder:changedFirstOrders(modules,replacements),profileJSON:isolatedCopyJSON(profile),config,guardAggregate,businessWrites:0,normalRolesChanged:false};
}
