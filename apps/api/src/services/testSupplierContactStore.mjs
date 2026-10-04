import {createHash} from 'node:crypto';
import {supplierContactError,parseSupplierContact,supplierContactContext} from './testSupplierContactModel.mjs';
import {SUPPLIER_CARD_READY_SQL,SUPPLIER_CARD_PROC_HASH} from './supplierCardReadStore.mjs';

const hash=s=>createHash('sha256').update(s,'utf16le').digest('hex').toUpperCase();
export const CONTACT_GET_PROC='dbo.usp_get_test_supplier_contact_context';
export const CONTACT_SET_PROC='dbo.usp_update_test_supplier_contact';
export const CONTACT_TABLE='dbo.test_supplier_contact_requests';
export const CONTACT_ROW_GUARD='dbo.test_supplier_contact_guard';
export const CONTACT_JOURNAL_GUARD='dbo.test_supplier_contact_requests_guard';
export const CONTACT_READY_SQL=`${SUPPLIER_CARD_READY_SQL}
IF COALESCE(CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.usp_read_supplier_cards'))),2),'')<>'${SUPPLIER_CARD_PROC_HASH}' THROW 51077,'TEST_SUPPLIER_CONTACT_READER_DRIFT',1;
IF NOT EXISTS(SELECT 1 FROM dbo.suppliers s WHERE s.id=13373 AND s.supplier_code=N'TEST-DAILY-PUR-S' AND s.name=N'TEST GÜNLÜK ALIŞ İADE TEDARİKÇİ' AND s.currency_code=N'TRY' AND s.is_active=1 AND s.is_deleted=0 AND s.purchase_discount_rate=0 AND s.source_record_key IS NULL AND s.migration_run_id IS NULL AND s.source_payload_hash IS NULL AND s.source_payload_json IS NULL AND s.source_document_key IS NULL AND s.original_document_date IS NULL AND s.party_entity_id IS NULL AND s.source_notes IS NULL AND s.TELEFON1 IS NULL AND s.TELEFON2 IS NULL AND s.TELEFON3 IS NULL AND s.ADRESPOSTA IS NULL AND s.ADRESFATURA IS NULL AND s.ADRESSEVK IS NULL) OR EXISTS(SELECT 1 FROM dbo.party_source_links WHERE supplier_id=13373) OR EXISTS(SELECT 1 FROM erp_migration.operation_quarantine_holds WHERE entity=N'supplier' AND native_id=13373) THROW 51077,'TEST_SUPPLIER_CONTACT_FIXTURE_UNAVAILABLE',1;
IF (SELECT COUNT(*) FROM dbo.test_daily_scope WHERE flow=N'purchase' AND product_id=301986 AND supplier_id=13373)<>1 OR (SELECT COUNT(*) FROM dbo.test_purchase_fx_scope WHERE id=1 AND product_id=301986 AND supplier_id=13373)<>1 THROW 51077,'TEST_SUPPLIER_CONTACT_SCOPE_UNAVAILABLE',1;
IF EXISTS(SELECT 1 FROM dbo.test_purchase_fx_intents t JOIN dbo.purchase_invoices p ON p.id=t.invoice_id JOIN dbo.supplier_movements m ON m.purchase_invoice_id=p.id WHERE t.status=N'linked' AND ((p.status=N'draft' AND m.movement_type=N'purchase_invoice') OR (p.status=N'finalized' AND m.movement_type=N'purchase_invoice_cancel'))) THROW 51077,'TEST_SUPPLIER_CONTACT_POSTING_WINDOW',1;`;
const witness=a=>`(SELECT CONVERT(varchar(20),${a}.id) supplierId,${a}.supplier_code supplierCode,${a}.name supplierName,${a}.currency_code currency,${a}.phone phone,${a}.city city,${a}.country country,CONVERT(varchar(18),${a}.row_version,1) rowVersion FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)`;
const revision=a=>`CONVERT(char(64),HASHBYTES('SHA2_256',${witness(a)}),2)`;
const context=a=>`(SELECT JSON_QUERY((SELECT CONVERT(varchar(20),${a}.id) id,${a}.supplier_code supplierCode,${a}.name supplierName,${a}.currency_code currency,CONVERT(bit,1) synthetic FOR JSON PATH,WITHOUT_ARRAY_WRAPPER)) fixture,JSON_QUERY((SELECT ${a}.phone phone,${a}.city city,${a}.country country FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)) contact,${revision(a)} revision FOR JSON PATH,WITHOUT_ARRAY_WRAPPER)`;
const immutable=['id','supplier_code','name','email','address','currency_code','balance','is_active','is_deleted','passive_at','passive_reason','created_at','created_by','purchase_discount_rate','source_record_key','migration_run_id','source_payload_hash','source_payload_json','source_document_key','original_document_date','party_entity_id','source_notes','TELEFON1','TELEFON2','TELEFON3','ADRESPOSTA','ADRESFATURA','ADRESSEVK'];
const unchanged=(a,b,cols)=>`NOT EXISTS(SELECT ${cols.map(c=>`CONVERT(varbinary(max),${a}.[${c}])`).join(',')} EXCEPT SELECT ${cols.map(c=>`CONVERT(varbinary(max),${b}.[${c}])`).join(',')})`;
const contactsEqual=(a,b)=>unchanged(a,b,['phone','city','country']);
const requestColumns=['request_id','supplier_id','actor_id','operation','payload_json','payload_hash','before_json','before_revision','phone','city','country','created_at'];
// The reservation is the only authority for a contact UPDATE. No session bypass.
export const CONTACT_ROW_GUARD_SQL=`CREATE TRIGGER ${CONTACT_ROW_GUARD} ON dbo.suppliers WITH EXECUTE AS OWNER AFTER UPDATE AS BEGIN
SET NOCOUNT ON;
IF NOT (UPDATE(phone) OR UPDATE(city) OR UPDATE(country)) OR NOT EXISTS(SELECT 1 FROM inserted WHERE id=13373) RETURN;
${CONTACT_READY_SQL}
IF (SELECT COUNT(*) FROM inserted)<>1 OR (SELECT COUNT(*) FROM deleted)<>1 OR NOT EXISTS(SELECT 1 FROM inserted i JOIN deleted d ON d.id=i.id WHERE i.id=13373 AND i.updated_by=16 AND i.updated_at IS NOT NULL AND i.row_version<>d.row_version AND ${unchanged('i','d',immutable)} AND EXISTS(SELECT 1 FROM ${CONTACT_TABLE} r WHERE r.state=N'reserved' AND r.supplier_id=i.id AND r.actor_id=16 AND r.before_revision=${revision('d')} AND CONVERT(varbinary(max),r.before_json)=CONVERT(varbinary(max),${witness('d')}) AND ${contactsEqual('r','i')})) THROW 51077,'TEST_SUPPLIER_CONTACT_RESERVATION_REQUIRED',1;
END;`;
// completed requests are immutable; the one reserved -> completed transition
// binds both native row-version witnesses and the historical response DTO.
export const CONTACT_JOURNAL_GUARD_SQL=`CREATE TRIGGER ${CONTACT_JOURNAL_GUARD} ON ${CONTACT_TABLE} WITH EXECUTE AS OWNER AFTER INSERT,UPDATE,DELETE AS BEGIN
SET NOCOUNT ON;
${CONTACT_READY_SQL}
IF (SELECT COUNT(*) FROM inserted)<>1 OR (SELECT COUNT(*) FROM deleted)>1 THROW 51077,'TEST_SUPPLIER_CONTACT_JOURNAL_IMMUTABLE',1;
IF NOT EXISTS(SELECT 1 FROM deleted) BEGIN
 IF NOT EXISTS(SELECT 1 FROM inserted r JOIN dbo.suppliers s ON s.id=r.supplier_id CROSS APPLY(SELECT JSON_VALUE(r.payload_json,'$.phone') phone,JSON_VALUE(r.payload_json,'$.city') city,JSON_VALUE(r.payload_json,'$.country') country) p WHERE r.state=N'reserved' AND (SELECT COUNT(*) FROM dbo.test_supplier_contact_requests WHERE state=N'reserved')=1 AND r.actor_id=16 AND r.operation=N'supplier_contact_updated' AND r.before_revision=${revision('s')} AND CONVERT(varbinary(max),r.before_json)=CONVERT(varbinary(max),${witness('s')}) AND r.after_json IS NULL AND r.after_revision IS NULL AND r.response_json IS NULL AND r.completed_at IS NULL AND ISJSON(r.payload_json)=1 AND r.payload_hash=CONVERT(char(64),HASHBYTES('SHA2_256',r.payload_json),2) AND (SELECT COUNT(*) FROM OPENJSON(r.payload_json))=6 AND NOT EXISTS(SELECT 1 FROM OPENJSON(r.payload_json) j WHERE j.[key] COLLATE Latin1_General_100_BIN2 NOT IN(N'supplierId',N'requestId',N'expectedRevision',N'phone',N'city',N'country') OR (j.[key] IN(N'supplierId',N'requestId',N'expectedRevision') AND j.type<>1) OR (j.[key] IN(N'phone',N'city',N'country') AND j.type NOT IN(0,1))) AND (SELECT COUNT(DISTINCT [key] COLLATE Latin1_General_100_BIN2) FROM OPENJSON(r.payload_json))=6 AND JSON_VALUE(r.payload_json,'$.supplierId')=N'13373' AND CONVERT(varbinary(max),JSON_VALUE(r.payload_json,'$.requestId'))=CONVERT(varbinary(max),LOWER(CONVERT(nvarchar(36),r.request_id))) AND CONVERT(varbinary(max),JSON_VALUE(r.payload_json,'$.expectedRevision'))=CONVERT(varbinary(max),CONVERT(nvarchar(64),r.before_revision)) AND ${unchanged('r','p',['phone','city','country'])}) THROW 51077,'TEST_SUPPLIER_CONTACT_JOURNAL_RESERVATION_INVALID',1;
END ELSE BEGIN
 IF NOT EXISTS(SELECT 1 FROM inserted i JOIN deleted d ON d.request_id=i.request_id JOIN dbo.suppliers s ON s.id=i.supplier_id WHERE d.state=N'reserved' AND i.state=N'completed' AND ${unchanged('i','d',requestColumns)} AND i.completed_at IS NOT NULL AND i.after_revision=${revision('s')} AND CONVERT(varbinary(max),i.after_json)=CONVERT(varbinary(max),${witness('s')}) AND CONVERT(varbinary(max),i.response_json)=CONVERT(varbinary(max),${context('s')}) AND s.updated_by=16 AND CONVERT(varbinary(max),JSON_VALUE(i.after_json,'$.rowVersion'))<>CONVERT(varbinary(max),JSON_VALUE(i.before_json,'$.rowVersion')) AND ${contactsEqual('i','s')}) THROW 51077,'TEST_SUPPLIER_CONTACT_JOURNAL_IMMUTABLE',1;
END;
END;`;
export const CONTACT_ROW_GUARD_HASH=hash(CONTACT_ROW_GUARD_SQL);
export const CONTACT_JOURNAL_GUARD_HASH=hash(CONTACT_JOURNAL_GUARD_SQL);
const operational=`${CONTACT_READY_SQL}
IF COALESCE(CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'${CONTACT_ROW_GUARD}'))),2),'')<>'${CONTACT_ROW_GUARD_HASH}' OR COALESCE(OBJECTPROPERTY(OBJECT_ID(N'${CONTACT_ROW_GUARD}'),'ExecIsTriggerDisabled'),1)<>0 OR COALESCE(CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'${CONTACT_JOURNAL_GUARD}'))),2),'')<>'${CONTACT_JOURNAL_GUARD_HASH}' OR COALESCE(OBJECTPROPERTY(OBJECT_ID(N'${CONTACT_JOURNAL_GUARD}'),'ExecIsTriggerDisabled'),1)<>0 THROW 51077,'TEST_SUPPLIER_CONTACT_GUARD_DRIFT',1;`;
const transaction=`IF @@TRANCOUNT=0 OR NOT EXISTS(SELECT 1 FROM sys.dm_exec_sessions WHERE session_id=@@SPID AND transaction_isolation_level=4) THROW 51077,'TEST_SUPPLIER_CONTACT_TRANSACTION_REQUIRED',1;`;
const metadata=`CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'${CONTACT_GET_PROC}'))),2) getterHash,CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'${CONTACT_SET_PROC}'))),2) setterHash,CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'${CONTACT_ROW_GUARD}'))),2) rowGuardHash,CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'${CONTACT_JOURNAL_GUARD}'))),2) journalGuardHash`;
export const CONTACT_GET_SQL=`CREATE PROCEDURE ${CONTACT_GET_PROC} WITH EXECUTE AS OWNER AS BEGIN
SET NOCOUNT ON; ${transaction}
${operational}
SELECT ${context('s')} contextJson,CONVERT(bit,0) replayed,${metadata} FROM dbo.suppliers s WHERE s.id=13373;
END;`;
export const CONTACT_SET_SQL=`CREATE PROCEDURE ${CONTACT_SET_PROC}
 @request_id nvarchar(max),@expected_revision nvarchar(max),@phone nvarchar(max),@city nvarchar(max),@country nvarchar(max),@payload_json nvarchar(max),@payload_hash nvarchar(max),@actor_id bigint
WITH EXECUTE AS OWNER AS BEGIN
SET NOCOUNT ON; SET XACT_ABORT ON; ${transaction}
DECLARE @lock int; EXEC @lock=sys.sp_getapplock @Resource=N'MELISA-TEST-V70-SALES',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=15000;
IF @lock<0 THROW 51077,'TEST_SUPPLIER_CONTACT_LOCK_REQUIRED',1;
${operational}
IF @actor_id IS NULL OR @actor_id<>16 OR @request_id IS NULL OR DATALENGTH(@request_id)<>72 OR TRY_CONVERT(uniqueidentifier,@request_id) IS NULL OR CONVERT(varbinary(max),@request_id)<>CONVERT(varbinary(max),LOWER(CONVERT(nvarchar(36),TRY_CONVERT(uniqueidentifier,@request_id)))) OR SUBSTRING(@request_id,15,1) NOT IN(N'1',N'2',N'3',N'4',N'5') OR SUBSTRING(@request_id,20,1) NOT IN(N'8',N'9',N'a',N'b') OR @expected_revision IS NULL OR DATALENGTH(@expected_revision)<>128 OR @expected_revision COLLATE Latin1_General_100_BIN2 LIKE N'%[^0-9A-F]%' OR @payload_hash IS NULL OR DATALENGTH(@payload_hash)<>128 OR @payload_hash COLLATE Latin1_General_100_BIN2 LIKE N'%[^0-9A-F]%' OR @payload_json IS NULL OR DATALENGTH(@payload_json)>4096 OR ISJSON(@payload_json)<>1 OR @payload_hash<>CONVERT(char(64),HASHBYTES('SHA2_256',@payload_json),2) OR DATALENGTH(@phone)>80 OR DATALENGTH(@city)>200 OR DATALENGTH(@country)>200 OR EXISTS(SELECT 1 FROM (VALUES(@phone),(@city),(@country)) v(value) CROSS JOIN(SELECT TOP(100) ROW_NUMBER() OVER(ORDER BY object_id) n FROM sys.all_objects) pos WHERE pos.n<=DATALENGTH(v.value)/2 AND (UNICODE(SUBSTRING(v.value,pos.n,1)) BETWEEN 0 AND 31 OR UNICODE(SUBSTRING(v.value,pos.n,1))=127)) THROW 51077,'TEST_SUPPLIER_CONTACT_INPUT_INVALID',1;
-- Same UUID+payload replays the immutable historical response BEFORE CAS.
IF EXISTS(SELECT 1 FROM ${CONTACT_TABLE} WHERE request_id=CONVERT(uniqueidentifier,@request_id)) BEGIN
 IF NOT EXISTS(SELECT 1 FROM ${CONTACT_TABLE} WHERE request_id=CONVERT(uniqueidentifier,@request_id) AND state=N'completed' AND actor_id=16 AND payload_hash=@payload_hash AND CONVERT(varbinary(max),payload_json)=CONVERT(varbinary(max),@payload_json)) THROW 51079,'TEST_SUPPLIER_CONTACT_REQUEST_CONFLICT',1;
 SELECT response_json contextJson,CONVERT(bit,1) replayed,${metadata} FROM ${CONTACT_TABLE} WHERE request_id=CONVERT(uniqueidentifier,@request_id); RETURN;
END;
IF NOT EXISTS(SELECT 1 FROM dbo.suppliers s WITH(UPDLOCK,HOLDLOCK) WHERE s.id=13373 AND ${revision('s')}=@expected_revision) THROW 51078,'TEST_SUPPLIER_CONTACT_STALE',1;
-- Exact parameter/payload binding, including explicit nullable contacts.
IF (SELECT COUNT(*) FROM OPENJSON(@payload_json))<>6 OR (SELECT COUNT(DISTINCT [key] COLLATE Latin1_General_100_BIN2) FROM OPENJSON(@payload_json))<>6 OR EXISTS(SELECT 1 FROM OPENJSON(@payload_json) j WHERE j.[key] NOT IN(N'supplierId',N'requestId',N'expectedRevision',N'phone',N'city',N'country') OR (j.[key] IN(N'supplierId',N'requestId',N'expectedRevision') AND j.type<>1) OR (j.[key] IN(N'phone',N'city',N'country') AND j.type NOT IN(0,1))) OR NOT EXISTS(SELECT 1 WHERE CONVERT(varbinary(max),JSON_VALUE(@payload_json,'$.supplierId'))=CONVERT(varbinary(max),N'13373') AND CONVERT(varbinary(max),JSON_VALUE(@payload_json,'$.requestId'))=CONVERT(varbinary(max),@request_id) AND CONVERT(varbinary(max),JSON_VALUE(@payload_json,'$.expectedRevision'))=CONVERT(varbinary(max),@expected_revision) AND NOT EXISTS(SELECT CONVERT(varbinary(max),@phone),CONVERT(varbinary(max),@city),CONVERT(varbinary(max),@country) EXCEPT SELECT CONVERT(varbinary(max),JSON_VALUE(@payload_json,'$.phone')),CONVERT(varbinary(max),JSON_VALUE(@payload_json,'$.city')),CONVERT(varbinary(max),JSON_VALUE(@payload_json,'$.country')))) THROW 51077,'TEST_SUPPLIER_CONTACT_INPUT_INVALID',1;
INSERT ${CONTACT_TABLE}(request_id,supplier_id,actor_id,operation,payload_json,payload_hash,before_json,before_revision,phone,city,country,state,created_at)
SELECT CONVERT(uniqueidentifier,@request_id),13373,16,N'supplier_contact_updated',@payload_json,@payload_hash,${witness('s')},${revision('s')},@phone,@city,@country,N'reserved',SYSUTCDATETIME() FROM dbo.suppliers s WHERE s.id=13373;
DECLARE @changed TABLE(id bigint);
UPDATE s SET phone=@phone,city=@city,country=@country,updated_at=SYSUTCDATETIME(),updated_by=16 OUTPUT inserted.id INTO @changed FROM dbo.suppliers s WHERE s.id=13373 AND ${revision('s')}=@expected_revision;
IF (SELECT COUNT(*) FROM @changed)<>1 THROW 51078,'TEST_SUPPLIER_CONTACT_STALE',1;
UPDATE r SET state=N'completed',after_json=${witness('s')},after_revision=${revision('s')},response_json=${context('s')},completed_at=SYSUTCDATETIME() FROM ${CONTACT_TABLE} r JOIN dbo.suppliers s ON s.id=r.supplier_id WHERE r.request_id=CONVERT(uniqueidentifier,@request_id) AND r.state=N'reserved';
IF @@ROWCOUNT<>1 THROW 51077,'TEST_SUPPLIER_CONTACT_JOURNAL_REQUIRED',1;
SELECT response_json contextJson,CONVERT(bit,0) replayed,${metadata} FROM ${CONTACT_TABLE} WHERE request_id=CONVERT(uniqueidentifier,@request_id);
END;`;
export const CONTACT_GET_HASH=hash(CONTACT_GET_SQL);
export const CONTACT_SET_HASH=hash(CONTACT_SET_SQL);

const unavailable=()=>supplierContactError('TEST_SUPPLIER_CONTACT_UNAVAILABLE','TEST iletişim düzenlemesi şu anda doğrulanamıyor.',503);
async function defaultRuntime(){const db=await import('../config/database.js');if(!db.isCanonicalTest())throw unavailable();return {pool:await db.getSqlPool(),sql:db.getSqlDriver()};}
export function createTestSupplierContactStore({getRuntime=defaultRuntime}={}){
 const execute=async(input)=>{let tx;try{
  const {pool,sql}=await getRuntime();tx=new sql.Transaction(pool);await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);const req=new sql.Request(tx);
  if(input){const parsed=parseSupplierContact({requestId:input.requestId,expectedRevision:input.expectedRevision,phone:input.phone,city:input.city,country:input.country});
   if(input.actorId!=='16'||input.payloadJson!==parsed.payloadJson||input.payloadHash!==parsed.payloadHash)throw unavailable();
   for(const [key,value] of Object.entries({request_id:parsed.requestId,expected_revision:parsed.expectedRevision,phone:parsed.phone,city:parsed.city,country:parsed.country,payload_json:parsed.payloadJson,payload_hash:parsed.payloadHash}))req.input(key,sql.NVarChar(sql.MAX),value);req.input('actor_id',sql.BigInt,'16');
  }
  const row=(await req.execute(input?CONTACT_SET_PROC:CONTACT_GET_PROC)).recordset?.[0];
  if(!row||row.getterHash!==CONTACT_GET_HASH||row.setterHash!==CONTACT_SET_HASH||row.rowGuardHash!==CONTACT_ROW_GUARD_HASH||row.journalGuardHash!==CONTACT_JOURNAL_GUARD_HASH||typeof row.replayed!=='boolean')throw unavailable();
  const context=supplierContactContext(JSON.parse(row.contextJson));await tx.commit();return input?{...context,replayed:row.replayed}:context;
 }catch(error){if(tx)try{await tx.rollback();}catch{}const numbers=[error?.number,error?.originalError?.info?.number,...(error?.precedingErrors??[]).map(e=>e.number)];if(numbers.includes(51078))throw supplierContactError('TEST_SUPPLIER_CONTACT_STALE','Kart değişti; güncel bilgileri yeniden açın.',409);if(numbers.includes(51079))throw supplierContactError('TEST_SUPPLIER_CONTACT_REQUEST_CONFLICT','Bu istek kimliği başka bir düzenlemeye ait.',409);throw unavailable();}};
 return {readTestSupplierContactContext:()=>execute(null),updateTestSupplierContact:execute};
}
const store=createTestSupplierContactStore();
export const readTestSupplierContactContext=store.readTestSupplierContactContext;
export const updateTestSupplierContact=store.updateTestSupplierContact;
