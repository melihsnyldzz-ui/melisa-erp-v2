// B7 contact-only companion to the existing clean native guard/journal pattern.
import {buildCleanDirectSaleDefinitions} from './clean-direct-sale-sql.mjs';
import {buildCleanFinanceRehearsalPredecessors} from './clean-finance-rehearsal-sql.mjs';
import {CLEAN_TARGET_SQL} from './clean-synthetic-sql.mjs';
import {CLEAN_LOGIN} from '../../apps/api/src/services/cleanSyntheticContext.mjs';
import {moduleHash} from './stage4-copy-sql.mjs';
const Q=s=>"N'"+s.replaceAll("'","''")+"'";
const deny="THROW 51967,'CLEAN_CONTACT_UNAVAILABLE',1;";
const active='SELECT 1 FROM dbo.clean_contact_intents WHERE session_id=@@SPID AND transaction_id=CURRENT_TRANSACTION_ID()';
export const CLEAN_CONTACT_FIXTURES=Object.freeze(['customer','supplier'].flatMap(kind=>[1,2,3,4].map(id=>({kind,id,code:id===1?`ORNEK-${kind==='customer'?'M':'T'}01`:`B4-ORNEK-${kind==='customer'?'M':'T'}${id===2?'':id===3?'-USD':'-EUR'}`,name:id===1?(kind==='customer'?'Örnek Mağaza':'Örnek Tedarikçi'):`B4 Örnek ${id===2?'':id===3?'USD ':'EUR '}${kind==='customer'?'Müşteri':'Tedarikçi'}`,currency:id<3?'TRY':id===3?'USD':'EUR'}))));
const access=`${CLEAN_TARGET_SQL}
 IF ORIGINAL_LOGIN() COLLATE Latin1_General_100_BIN2<>N'${CLEAN_LOGIN}' OR @@TRANCOUNT<>1 OR ISNULL(APPLOCK_MODE(N'public',N'CLEAN_STORE_DAY_20261022',N'Transaction'),N'NoLock') NOT IN(N'Shared',N'Exclusive') ${deny}
 IF @kind NOT IN(N'customer',N'supplier') OR @entity_id NOT BETWEEN 1 AND 4 OR @actor_id<>10018 OR NOT EXISTS(SELECT 1 FROM dbo.users u JOIN dbo.roles r ON r.id=u.role_id WHERE u.id=@actor_id AND u.username=N'semih' AND u.is_active=1 AND r.id=28 AND r.code=N'clean_test_administrator' AND r.is_active=1) OR EXISTS(SELECT 1 FROM (VALUES(@kind+N'.view'),(@kind+N'.edit')) k(permission_key) WHERE NOT EXISTS(SELECT 1 FROM dbo.permissions p WHERE p.role_id=28 AND p.permission_key=k.permission_key AND(p.can_view=1 OR p.can_create=1))) THROW 51970,'CLEAN_CONTACT_FORBIDDEN',1;
 IF EXISTS(SELECT 1 FROM erp_migration.operation_quarantine_holds WHERE entity=@kind AND native_id=@entity_id) THROW 51970,'CLEAN_CONTACT_FORBIDDEN',1;
 EXEC dbo.usp_clean_store_day_ready;EXEC dbo.usp_clean_contact_ready;
 DECLARE @code nvarchar(100),@name nvarchar(250),@currency nvarchar(3),@phone nvarchar(50),@city nvarchar(100),@country nvarchar(100),@rowversion binary(8);
 IF @kind=N'customer' SELECT @code=customer_code,@name=name,@currency=currency_code,@phone=phone,@city=city,@country=country,@rowversion=row_version FROM dbo.customers WITH(HOLDLOCK) WHERE id=@entity_id AND is_active=1 AND is_deleted=0;
 ELSE SELECT @code=supplier_code,@name=name,@currency=currency_code,@phone=phone,@city=city,@country=country,@rowversion=row_version FROM dbo.suppliers WITH(HOLDLOCK) WHERE id=@entity_id AND is_active=1 AND is_deleted=0;
 IF @code IS NULL OR NOT EXISTS(SELECT 1 FROM dbo.clean_contact_fixtures WHERE kind=@kind AND entity_id=@entity_id AND code COLLATE Latin1_General_100_BIN2=@code COLLATE Latin1_General_100_BIN2 AND name COLLATE Latin1_General_100_BIN2=@name COLLATE Latin1_General_100_BIN2 AND currency=@currency) ${deny}
 DECLARE @revision char(64)=CONVERT(char(64),HASHBYTES('SHA2_256',CONVERT(nvarchar(max),@kind)+N'|'+CONVERT(nvarchar(20),@entity_id)+N'|'+CONVERT(nvarchar(18),@rowversion,1)),2);`;
export function buildCleanContactDefinitions(){
 const prior={...buildCleanFinanceRehearsalPredecessors(),...buildCleanDirectSaleDefinitions().definitions},before={},definitions={};
 for(const [name,body] of Object.entries(prior).filter(([n])=>n.endsWith('_ready'))){
  before[name]=body;
  const projected=`SELECT ${Object.keys(prior).filter(n=>n.endsWith('_ready')||['clean_sale_customers_guard','clean_inbound_suppliers_guard'].includes(n)).map(n=>`MAX(CASE WHEN name=${Q(n)} THEN before_hash END) [${n}]`).join(',')} FROM dbo.clean_contact_manifest FOR JSON PATH,WITHOUT_ARRAY_WRAPPER`;
  let next=body.replace(/CONVERT\(char\(64\),HASHBYTES\('SHA2_256',OBJECT_DEFINITION\(OBJECT_ID\(N'dbo\.'\+(\w+)\.name\)\)\),2\)/g,(hash,a)=>`COALESCE(JSON_VALUE(@b7Predecessors,N'$.'+${a}.name),${hash})`);
  next=next.replace(/CONVERT\(char\(64\),HASHBYTES\('SHA2_256',(\w+)\.definition\),2\)/g,(hash,a)=>`COALESCE(JSON_VALUE(@b7Predecessors,N'$.'+d.name),${hash})`);
  if(next===body)throw Error('B7 ready hash projection missing '+name);
  definitions[name]=next.replace('SET NOCOUNT ON;',`SET NOCOUNT ON;EXEC dbo.usp_clean_contact_ready;DECLARE @b7Predecessors nvarchar(max)=(${projected});`);
 }
 for(const [name,table] of [['clean_sale_customers_guard','customers'],['clean_inbound_suppliers_guard','suppliers']]){
  const body=prior[name],at=body?.indexOf('AS BEGIN');if(!(at>=0))throw Error('B7 guard predecessor missing '+name);before[name]=body;
  definitions[name]=body.slice(0,at+8)+`\n IF EXISTS(${active}) BEGIN DECLARE @b7i nvarchar(max)=(SELECT * FROM inserted FOR JSON PATH,INCLUDE_NULL_VALUES),@b7d nvarchar(max)=(SELECT * FROM deleted FOR JSON PATH,INCLUDE_NULL_VALUES);EXEC dbo.usp_clean_contact_guard N'${table}',@b7i,@b7d;RETURN;END;\n`+body.slice(at+8);
 }
 definitions.usp_clean_contact_context=`CREATE PROCEDURE dbo.usp_clean_contact_context @kind nvarchar(8),@entity_id bigint,@actor_id bigint WITH EXECUTE AS OWNER AS BEGIN SET NOCOUNT ON;${access}
 DECLARE @contact nvarchar(max)=(SELECT @phone phone,@city city,@country country FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES);
 SELECT (SELECT N'melisa-'+@kind+N'-contact-context.v1' schemaVersion,CONVERT(varchar(36),'e662fd94-d797-4b3b-938a-d143ad758b67') copyId,CONVERT(char(64),HASHBYTES('SHA2_256',N'B7-20261024|'+@kind),2) sealHash,CONVERT(varchar(20),@entity_id) entityId,@code code,@name name,@revision revision,JSON_QUERY(@contact) contact FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES) context_json;END;`;
 definitions.usp_clean_contact_guard=`CREATE PROCEDURE dbo.usp_clean_contact_guard @table sysname,@inserted nvarchar(max),@deleted nvarchar(max) WITH EXECUTE AS OWNER AS BEGIN SET NOCOUNT ON;${CLEAN_TARGET_SQL}
 IF ORIGINAL_LOGIN() COLLATE Latin1_General_100_BIN2<>N'${CLEAN_LOGIN}' OR @@TRANCOUNT<>1 OR ISNULL(APPLOCK_MODE(N'public',N'CLEAN_STORE_DAY_20261022',N'Transaction'),N'NoLock')<>N'Exclusive' OR(SELECT COUNT(*) FROM dbo.clean_contact_intents WHERE session_id=@@SPID AND transaction_id=CURRENT_TRANSACTION_ID())<>1 OR(SELECT COUNT(*) FROM OPENJSON(@inserted))<>1 OR(SELECT COUNT(*) FROM OPENJSON(@deleted))<>1 ${deny}
 DECLARE @kind nvarchar(8),@id bigint,@actor bigint,@payload nvarchar(max),@before nvarchar(max);SELECT @kind=kind,@id=entity_id,@actor=actor_id,@payload=payload_json,@before=before_json FROM dbo.clean_contact_intents WHERE session_id=@@SPID AND transaction_id=CURRENT_TRANSACTION_ID();
 IF @table<>@kind+N's' OR ISNULL(TRY_CONVERT(bigint,JSON_VALUE(@inserted,'$[0].id')),-1)<>@id OR ISNULL(TRY_CONVERT(bigint,JSON_VALUE(@deleted,'$[0].id')),-1)<>@id OR @deleted COLLATE Latin1_General_100_BIN2<>@before COLLATE Latin1_General_100_BIN2 OR ISNULL(TRY_CONVERT(bigint,JSON_VALUE(@inserted,'$[0].updated_by')),-1)<>@actor ${deny}
 IF EXISTS(SELECT 1 FROM OPENJSON(JSON_QUERY(@inserted,'$[0]')) i FULL JOIN OPENJSON(JSON_QUERY(@deleted,'$[0]')) d ON i.[key]=d.[key] WHERE COALESCE(i.[key],d.[key]) NOT IN(N'phone',N'city',N'country',N'updated_at',N'updated_by',N'row_version') AND(i.[key] IS NULL OR d.[key] IS NULL OR i.type<>d.type OR ISNULL(i.value,N'') COLLATE Latin1_General_100_BIN2<>ISNULL(d.value,N'') COLLATE Latin1_General_100_BIN2)) ${deny}
 IF EXISTS(SELECT 1 FROM OPENJSON(JSON_QUERY(@inserted,'$[0]')) i JOIN OPENJSON(@payload) p ON i.[key]=p.[key] WHERE i.[key] IN(N'phone',N'city',N'country') AND(i.type<>p.type OR ISNULL(i.value,N'') COLLATE Latin1_General_100_BIN2<>ISNULL(p.value,N'') COLLATE Latin1_General_100_BIN2)) ${deny} END;`;
 definitions.usp_clean_contact_update=`CREATE PROCEDURE dbo.usp_clean_contact_update @kind nvarchar(8),@entity_id bigint,@actor_id bigint,@payload_json nvarchar(max) WITH EXECUTE AS OWNER AS BEGIN SET NOCOUNT ON;SET XACT_ABORT ON;${access}
 IF APPLOCK_MODE(N'public',N'CLEAN_STORE_DAY_20261022',N'Transaction')<>N'Exclusive' OR ISJSON(@payload_json)<>1 OR LEN(@payload_json)>4096 OR(SELECT COUNT(*) FROM OPENJSON(@payload_json))<>7 OR EXISTS(SELECT 1 FROM OPENJSON(@payload_json) WHERE [key] NOT IN(N'kind',N'entityId',N'requestId',N'expectedRevision',N'phone',N'city',N'country')) OR ISNULL(JSON_VALUE(@payload_json,'$.kind'),N'')<>@kind OR ISNULL(TRY_CONVERT(bigint,JSON_VALUE(@payload_json,'$.entityId')),-1)<>@entity_id ${deny}
 DECLARE @request uniqueidentifier=TRY_CONVERT(uniqueidentifier,JSON_VALUE(@payload_json,'$.requestId')),@hash char(64)=CONVERT(char(64),HASHBYTES('SHA2_256',@payload_json),2);
 IF @request IS NULL OR EXISTS(SELECT k.name FROM(VALUES(N'kind'),(N'entityId'),(N'requestId'),(N'expectedRevision'),(N'phone'),(N'city'),(N'country'))k(name) LEFT JOIN OPENJSON(@payload_json) p ON p.[key]=k.name GROUP BY k.name HAVING COUNT(p.[key])<>1) OR EXISTS(SELECT 1 FROM OPENJSON(@payload_json) WHERE [key] IN(N'phone',N'city',N'country') AND(type NOT IN(0,1) OR DATALENGTH(value)>CASE WHEN [key]=N'phone' THEN 80 ELSE 200 END OR value COLLATE Latin1_General_100_BIN2 LIKE N'%['+NCHAR(1)+N'-'+NCHAR(31)+NCHAR(127)+N'-'+NCHAR(159)+N']%' OR([key]=N'phone' AND value LIKE N'%*%'))) ${deny}
 IF EXISTS(SELECT 1 FROM dbo.clean_contact_requests WHERE request_id=@request) BEGIN IF NOT EXISTS(SELECT 1 FROM dbo.clean_contact_requests WHERE request_id=@request AND kind=@kind AND entity_id=@entity_id AND actor_id=@actor_id AND payload_hash=@hash AND payload_json COLLATE Latin1_General_100_BIN2=@payload_json COLLATE Latin1_General_100_BIN2) THROW 51969,'CLEAN_CONTACT_REQUEST_CONFLICT',1;EXEC dbo.usp_clean_contact_context @kind,@entity_id,@actor_id;SELECT CONVERT(bit,1) replayed;RETURN;END;
 IF ISNULL(JSON_VALUE(@payload_json,'$.expectedRevision'),N'') COLLATE Latin1_General_100_BIN2<>@revision COLLATE Latin1_General_100_BIN2 THROW 51968,'CLEAN_CONTACT_STALE',1;
 IF EXISTS(SELECT 1 FROM dbo.clean_contact_intents) OR EXISTS(SELECT 1 FROM dbo.clean_store_day_intents) OR EXISTS(SELECT 1 FROM dbo.clean_direct_sale_intents) OR EXISTS(SELECT 1 FROM dbo.clean_order_sale_intents) OR EXISTS(SELECT 1 FROM dbo.clean_finance_b4_intents) OR EXISTS(SELECT 1 FROM dbo.clean_finance_b4_fx_intents) OR EXISTS(SELECT 1 FROM dbo.clean_finance_b4_cash_intents) OR EXISTS(SELECT 1 FROM dbo.clean_store_inventory_intents) OR(SELECT COUNT(*) FROM dbo.clean_contact_requests)>=50 ${deny}
 DECLARE @before nvarchar(max),@after nvarchar(max);IF @kind=N'customer' SELECT @before=(SELECT * FROM dbo.customers WHERE id=@entity_id FOR JSON PATH,INCLUDE_NULL_VALUES);ELSE SELECT @before=(SELECT * FROM dbo.suppliers WHERE id=@entity_id FOR JSON PATH,INCLUDE_NULL_VALUES);
 INSERT dbo.clean_contact_intents(session_id,transaction_id,request_id,kind,entity_id,actor_id,payload_json,before_json)VALUES(@@SPID,CURRENT_TRANSACTION_ID(),@request,@kind,@entity_id,@actor_id,@payload_json,@before);
 IF @kind=N'customer' BEGIN UPDATE dbo.customers SET phone=JSON_VALUE(@payload_json,'$.phone'),city=JSON_VALUE(@payload_json,'$.city'),country=JSON_VALUE(@payload_json,'$.country'),updated_at=SYSUTCDATETIME(),updated_by=@actor_id WHERE id=@entity_id;SELECT @after=(SELECT * FROM dbo.customers WHERE id=@entity_id FOR JSON PATH,INCLUDE_NULL_VALUES);END
 ELSE BEGIN UPDATE dbo.suppliers SET phone=JSON_VALUE(@payload_json,'$.phone'),city=JSON_VALUE(@payload_json,'$.city'),country=JSON_VALUE(@payload_json,'$.country'),updated_at=SYSUTCDATETIME(),updated_by=@actor_id WHERE id=@entity_id;SELECT @after=(SELECT * FROM dbo.suppliers WHERE id=@entity_id FOR JSON PATH,INCLUDE_NULL_VALUES);END;
 INSERT dbo.clean_contact_requests(request_id,kind,entity_id,actor_id,payload_hash,payload_json,before_json,after_json)VALUES(@request,@kind,@entity_id,@actor_id,@hash,@payload_json,@before,@after);
 DELETE dbo.clean_contact_intents WHERE session_id=@@SPID AND transaction_id=CURRENT_TRANSACTION_ID();EXEC dbo.usp_clean_contact_context @kind,@entity_id,@actor_id;SELECT CONVERT(bit,0) replayed;END;`;
 definitions.clean_contact_intents_guard=`CREATE TRIGGER dbo.clean_contact_intents_guard ON dbo.clean_contact_intents AFTER INSERT,UPDATE,DELETE AS BEGIN IF USER_NAME()<>N'dbo' OR EXISTS(SELECT 1 FROM inserted WHERE session_id<>@@SPID OR transaction_id<>CURRENT_TRANSACTION_ID()) ${deny} END;`;
 definitions.clean_contact_requests_immutable=`CREATE TRIGGER dbo.clean_contact_requests_immutable ON dbo.clean_contact_requests AFTER INSERT,UPDATE,DELETE AS BEGIN IF USER_NAME()<>N'dbo' OR EXISTS(SELECT 1 FROM deleted) OR(SELECT COUNT(*) FROM inserted)<>1 OR NOT EXISTS(SELECT 1 FROM inserted i JOIN dbo.clean_contact_intents t ON t.request_id=i.request_id AND t.kind=i.kind AND t.entity_id=i.entity_id AND t.actor_id=i.actor_id AND t.session_id=@@SPID AND t.transaction_id=CURRENT_TRANSACTION_ID()) ${deny} END;`;
 for(const name of ['manifest','fixtures'])definitions['clean_contact_'+name+'_immutable']=`CREATE TRIGGER dbo.clean_contact_${name}_immutable ON dbo.clean_contact_${name} AFTER INSERT,UPDATE,DELETE AS BEGIN ${deny} END;`;
 definitions.usp_clean_contact_ready=`CREATE PROCEDURE dbo.usp_clean_contact_ready WITH EXECUTE AS OWNER AS BEGIN SET NOCOUNT ON;${CLEAN_TARGET_SQL}
 IF(SELECT COUNT(*) FROM dbo.clean_contact_manifest)<>B7_TOTAL OR EXISTS(SELECT 1 FROM dbo.clean_contact_manifest d LEFT JOIN sys.sql_modules m ON m.object_id=OBJECT_ID(N'dbo.'+d.name) WHERE m.object_id IS NULL OR d.after_hash<>CONVERT(char(64),HASHBYTES('SHA2_256',m.definition),2) OR m.uses_ansi_nulls<>1 OR m.uses_quoted_identifier<>1 OR(OBJECTPROPERTY(m.object_id,'IsTrigger')=1 AND OBJECTPROPERTY(m.object_id,'ExecIsTriggerDisabled')<>0)) ${deny}
 IF(SELECT COUNT(*) FROM dbo.clean_contact_fixtures)<>8 ${deny}
 ${CLEAN_CONTACT_FIXTURES.map(f=>`IF NOT EXISTS(SELECT 1 FROM dbo.clean_contact_fixtures WHERE kind=${Q(f.kind)} AND entity_id=${f.id} AND code COLLATE Latin1_General_100_BIN2=${Q(f.code)} COLLATE Latin1_General_100_BIN2 AND name COLLATE Latin1_General_100_BIN2=${Q(f.name)} COLLATE Latin1_General_100_BIN2 AND currency=${Q(f.currency)}) ${deny}`).join('\n')} END;`;
 definitions.usp_clean_contact_ready=definitions.usp_clean_contact_ready.replace('B7_TOTAL',Object.keys(definitions).length);
 return {before,definitions};
}
// Metadata inverse only before the first B7 contact journal entry. It never
// restores the database or deletes contact, sales, finance or migration history.
export function buildEmptyCleanContactInverseSql(){
 const {before,definitions}=buildCleanContactDefinitions();
 return `SET NOCOUNT ON;SET QUOTED_IDENTIFIER ON;SET ANSI_NULLS ON;SET XACT_ABORT ON;${CLEAN_TARGET_SQL}
 IF ISNULL(IS_SRVROLEMEMBER(N'sysadmin',ORIGINAL_LOGIN()),0)<>1 ${deny}
 BEGIN TRANSACTION;BEGIN TRY DECLARE @lock int;EXEC @lock=sys.sp_getapplock @Resource=N'CLEAN_STORE_DAY_20261022',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=5000;IF @lock<0 ${deny}
 EXEC dbo.usp_clean_contact_ready;IF EXISTS(SELECT 1 FROM dbo.clean_contact_requests) OR EXISTS(SELECT 1 FROM dbo.clean_contact_intents) ${deny}
 ${Object.entries(definitions).map(([n,b])=>`IF ISNULL(CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.${n}'))),2),N'')<>${Q(moduleHash(b))} ${deny}`).join('\n')}
 ${Object.entries(before).map(([n,b])=>`IF NOT EXISTS(SELECT 1 FROM dbo.clean_contact_manifest WHERE name=${Q(n)} AND before_hash=${Q(moduleHash(b))} AND before_definition COLLATE Latin1_General_100_BIN2=${Q(b)} COLLATE Latin1_General_100_BIN2) ${deny}`).join('\n')}
 ${Object.entries(before).map(([,b])=>`EXEC(${Q(b.replace(/^CREATE PROCEDURE/,'ALTER PROCEDURE').replace(/^CREATE TRIGGER/,'ALTER TRIGGER'))});`).join('\n')}
 ${Object.keys(definitions).filter(n=>!before[n]).map(n=>`DROP ${n.startsWith('usp_')?'PROCEDURE':'TRIGGER'} dbo.${n};`).join('\n')}
 DROP TABLE dbo.clean_contact_requests;DROP TABLE dbo.clean_contact_intents;DROP TABLE dbo.clean_contact_fixtures;DROP TABLE dbo.clean_contact_manifest;
 EXEC dbo.usp_clean_store_day_ready;EXEC dbo.usp_clean_direct_sale_ready;COMMIT;SELECT N'B7_EMPTY_METADATA_INVERSE_COMPLETE' result;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK;THROW;END CATCH;`;
}
export function buildCleanContactSql({probe=false}={}){
 const {before,definitions}=buildCleanContactDefinitions();
 return `SET NOCOUNT ON;SET QUOTED_IDENTIFIER ON;SET ANSI_NULLS ON;SET XACT_ABORT ON;${CLEAN_TARGET_SQL}
 IF ISNULL(IS_SRVROLEMEMBER(N'sysadmin',ORIGINAL_LOGIN()),0)<>1 ${deny}
 IF OBJECT_ID(N'dbo.clean_contact_manifest') IS NOT NULL BEGIN EXEC dbo.usp_clean_contact_ready;SELECT N'B7_ALREADY_INSTALLED' result;RETURN;END;
 SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;BEGIN TRANSACTION;BEGIN TRY
 DECLARE @lock int;EXEC @lock=sys.sp_getapplock @Resource=N'CLEAN_STORE_DAY_20261022',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=5000;IF @lock<0 ${deny}
 EXEC dbo.usp_clean_store_day_ready;EXEC dbo.usp_clean_direct_sale_ready;
 ${Object.entries(before).map(([n,b])=>`IF ISNULL(CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.${n}'))),2),N'')<>${Q(moduleHash(b))} THROW 51967,${Q('B7_PREDECESSOR_'+n)},1;`).join('\n')}
 CREATE TABLE dbo.clean_contact_manifest(name sysname PRIMARY KEY,before_hash char(64) NULL,after_hash char(64) NOT NULL,before_definition nvarchar(max) NULL);
 CREATE TABLE dbo.clean_contact_fixtures(kind nvarchar(8) NOT NULL,entity_id bigint NOT NULL,code nvarchar(100) NOT NULL,name nvarchar(250) NOT NULL,currency nvarchar(3) NOT NULL,PRIMARY KEY(kind,entity_id));
 INSERT dbo.clean_contact_fixtures VALUES ${CLEAN_CONTACT_FIXTURES.map(f=>`(${Q(f.kind)},${f.id},${Q(f.code)},${Q(f.name)},${Q(f.currency)})`).join(',')};
 CREATE TABLE dbo.clean_contact_intents(session_id int PRIMARY KEY,transaction_id bigint NOT NULL,request_id uniqueidentifier UNIQUE NOT NULL,kind nvarchar(8) NOT NULL,entity_id bigint NOT NULL,actor_id bigint NOT NULL,payload_json nvarchar(max) NOT NULL,before_json nvarchar(max) NOT NULL);
 CREATE TABLE dbo.clean_contact_requests(request_id uniqueidentifier PRIMARY KEY,kind nvarchar(8) NOT NULL,entity_id bigint NOT NULL,actor_id bigint NOT NULL,payload_hash char(64) NOT NULL,payload_json nvarchar(max) NOT NULL,before_json nvarchar(max) NOT NULL,after_json nvarchar(max) NOT NULL,created_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME());
 ${Object.entries(definitions).filter(([n])=>!n.endsWith('_immutable')).map(([n,b])=>`INSERT dbo.clean_contact_manifest VALUES(${Q(n)},${before[n]?Q(moduleHash(before[n])):'NULL'},${Q(moduleHash(b))},${before[n]?Q(before[n]):'NULL'});EXEC(${Q(b.replace(/^CREATE PROCEDURE/,before[n]?'ALTER PROCEDURE':'CREATE PROCEDURE').replace(/^CREATE TRIGGER/,before[n]?'ALTER TRIGGER':'CREATE TRIGGER'))});`).join('\n')}
 ${Object.entries(definitions).filter(([n])=>n.endsWith('_immutable')).sort(([a],[b])=>(a==='clean_contact_manifest_immutable'?1:0)-(b==='clean_contact_manifest_immutable'?1:0)).map(([n,b])=>`INSERT dbo.clean_contact_manifest(name,after_hash)VALUES(${Q(n)},${Q(moduleHash(b))});EXEC(${Q(b)});`).join('\n')}
 ${['manifest','fixtures','intents','requests'].map(t=>`DENY INSERT,UPDATE,DELETE ON dbo.clean_contact_${t} TO [${CLEAN_LOGIN}];`).join('\n')}
 GRANT SELECT ON dbo.clean_contact_requests TO [${CLEAN_LOGIN}];GRANT EXECUTE ON dbo.usp_clean_contact_context TO [${CLEAN_LOGIN}];GRANT EXECUTE ON dbo.usp_clean_contact_update TO [${CLEAN_LOGIN}];GRANT EXECUTE ON dbo.usp_clean_contact_ready TO [${CLEAN_LOGIN}];
 EXEC dbo.usp_clean_store_day_ready;EXEC dbo.usp_clean_direct_sale_ready;EXEC dbo.usp_clean_contact_ready;
 ${probe?"ROLLBACK;SELECT N'B7_METADATA_PROBE_ROLLED_BACK' result;":"COMMIT;SELECT N'B7_METADATA_INSTALLED' result;"}
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK;THROW;END CATCH;`;
}
