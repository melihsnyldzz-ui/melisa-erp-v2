// Offline proposal only. Never opens SQL, writes data, authorizes execution,
// changes the existing bootstrap/probe, or creates a login or password.
import {createHash} from 'node:crypto';
import {compileDesktopEmptyBootstrap} from './bootstrap-sql.mjs';
import {compileDesktopSalesCurrencySchema} from './sales-currency-schema.mjs';

const SERVER='Semih\\MELISAERP',DATABASE='MELISA_ERP_DESKTOP_TEST_20261105';
const ENV='eb2888c2-51cb-4570-a933-397cf7e62806';
const BASE_SHA='9ab2cc9dca7437ac30233f005a3d6277ef0d5eab12310046c2033b2541aa120b';
const SALES_SHA='93dcf5a0cbcea37497eccd9d48fcc2e4bfef097a53a3e12072ed62d5e1dd9821';
const SALES_UTF16_SHA='6FEFDF323204652C1B6BAAE24DA93D7DEADBD96B20FD633585FB72291E987443';
const rows=Object.freeze([
 ['sales_invoices','account_currency','nvarchar',6,0,0],['sales_invoices','account_amount','decimal',9,18,4],
 ['sales_invoices','account_exchange_rate_snapshot','decimal',9,18,8],['sales_invoices','party_entity_id','bigint',8,19,0],['sales_invoices','party_currency_account_id','bigint',8,19,0],
 ['customer_movements','account_currency','nvarchar',6,0,0],['customer_movements','account_amount','decimal',9,18,4],
 ['customer_movements','document_exchange_rate_snapshot','decimal',9,18,8],['customer_movements','account_exchange_rate_snapshot','decimal',9,18,8],
 ['customer_movements','amount_try','decimal',9,18,4],['customer_movements','party_entity_id','bigint',8,19,0],['customer_movements','party_currency_account_id','bigint',8,19,0],
 ['customers','party_entity_id','bigint',8,19,0],['stock_movements','warehouse_name','nvarchar',160,0,0],
].map(Object.freeze));
const reject=code=>{throw Object.assign(new Error(code),{code});};
const hash=(value,encoding='utf8')=>createHash('sha256').update(value,encoding).digest('hex');
const literal=s=>"N'"+s.replaceAll("'","''")+"'";
function replaceOnce(text,from,to){const at=text.indexOf(from);if(at<0||text.indexOf(from,at+from.length)!==-1)reject('DESKTOP_SALES_BOOTSTRAP_ANCHOR_REJECTED');return text.slice(0,at)+to+text.slice(at+from.length);}
function optionsSnapshot(input){
 if(!input||typeof input!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(input)))reject('DESKTOP_SALES_BOOTSTRAP_OPTIONS_REJECTED');
 const d=Object.getOwnPropertyDescriptors(input),keys=Reflect.ownKeys(input),allowed=['server','database','baseSql','salesSnapshot'];
 if(keys.some(k=>typeof k!=='string'||!allowed.includes(k)||!Object.hasOwn(d[k],'value')||!d[k].enumerable||typeof d[k].value!=='string'))reject('DESKTOP_SALES_BOOTSTRAP_OPTIONS_REJECTED');
 return Object.fromEntries(keys.map(k=>[k,d[k].value]));
}
const checkSnapshot=`IF @desktop_sales_json IS NULL OR ISNULL(CONVERT(varchar(64),HASHBYTES('SHA2_256',CONVERT(varbinary(max),@desktop_sales_json)),2),'') COLLATE Latin1_General_100_BIN2<>N'${SALES_UTF16_SHA}'
 OR (SELECT COUNT_BIG(*) FROM OPENJSON(@desktop_sales_json,'$.batches'))<>4
 THROW 51995,'DESKTOP_SALES_BOOTSTRAP_SOURCE_REJECTED',1;`;
const expectedValues=rows.map(([table,name,type,max,precision,scale])=>`(${literal(table)},${literal(name)},${literal(type)},${max},${precision},${scale})`).join(',');
// Verify exactly the 14 proposed columns after the ALTERs. This does not claim
// complete metadata or all historical constraints on the 24 foundation tables.
const verifyMetadata=`DECLARE @desktop_sales_columns TABLE(table_name sysname,column_name sysname,type_name sysname,max_length int,precision_value int,scale_value int,PRIMARY KEY(table_name,column_name));
INSERT @desktop_sales_columns VALUES ${expectedValues};
IF EXISTS(SELECT 1 FROM @desktop_sales_columns e WHERE NOT EXISTS(
 SELECT 1 FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id
 JOIN sys.columns c ON c.object_id=t.object_id JOIN sys.types y ON y.user_type_id=c.user_type_id
 WHERE CONVERT(varbinary(256),s.name)=CONVERT(varbinary(256),N'dbo')
 AND CONVERT(varbinary(256),t.name)=CONVERT(varbinary(256),e.table_name)
 AND CONVERT(varbinary(256),c.name)=CONVERT(varbinary(256),e.column_name)
 AND CONVERT(varbinary(256),y.name)=CONVERT(varbinary(256),e.type_name)
 AND y.is_user_defined=0 AND c.max_length=e.max_length AND c.precision=e.precision_value AND c.scale=e.scale_value
 AND c.is_nullable=1 AND c.is_identity=0 AND c.is_computed=0 AND c.is_sparse=0 AND c.default_object_id=0))
 THROW 51995,'DESKTOP_SALES_BOOTSTRAP_METADATA_REJECTED',1;`;
const executeSales=`${checkSnapshot}
DECLARE @desktop_sales_index int=0,@desktop_sales_batch nvarchar(max);
WHILE @desktop_sales_index<4
BEGIN
 SET @desktop_sales_batch=NULL;
 SELECT @desktop_sales_batch=[entry].[sql] FROM OPENJSON(@desktop_sales_json,'$.batches') AS [item]
 CROSS APPLY OPENJSON([item].[value]) WITH ([sql] nvarchar(max) '$.sql') AS [entry]
 WHERE [item].[key]=CONVERT(nvarchar(10),@desktop_sales_index);
 IF @desktop_sales_batch IS NULL OR DATALENGTH(@desktop_sales_batch)=0 THROW 51995,'DESKTOP_SALES_BOOTSTRAP_BATCH_REJECTED',1;
 EXEC sys.sp_executesql @desktop_sales_batch;
 SET @desktop_sales_index+=1;
END;
${verifyMetadata}
${checkSnapshot}`;
export const DESKTOP_SALES_BOOTSTRAP_LIMITS=Object.freeze({executionAuthorized:false,commercialData:'NONE',
 requiresIndependentReview:true,requiresTransactionalExecutor:true,requiresRealSqlRollbackAndReadback:true,
 completeSalesSchema:false,foundationFullMetadataVerified:false,accountAndAuthBootstrapIncluded:false,
 localUnitStorageIncluded:false,markerReadOnly:true,sourceOnly:true});
export function compileDesktopSalesBootstrap(input={}){
 const opts=optionsSnapshot(input);
 if((opts.server??SERVER)!==SERVER||(opts.database??DATABASE)!==DATABASE)reject('DESKTOP_SALES_BOOTSTRAP_TARGET_REJECTED');
 const base=compileDesktopEmptyBootstrap(),sales=compileDesktopSalesCurrencySchema();
 const source=opts.baseSql??base.sql,json=opts.salesSnapshot??JSON.stringify(sales);
 if(base.server!==SERVER||base.database!==DATABASE||base.environmentId!==ENV||base.sqlSha256!==BASE_SHA
  ||base.batchCount!==41||base.expectedTables.length!==27||base.executionRequirements.executionAuthorized!==false
  ||source!==base.sql||hash(source)!==BASE_SHA)reject('DESKTOP_SALES_BOOTSTRAP_BASE_REJECTED');
 if(sales.server!==SERVER||sales.database!==DATABASE||sales.batches.length!==4||sales.requirements.executionAuthorized!==false
  ||sales.requirements.commercialData!=='NONE'||json!==JSON.stringify(sales)||hash(json)!==SALES_SHA
  ||hash(json,'utf16le').toUpperCase()!==SALES_UTF16_SHA)reject('DESKTOP_SALES_BOOTSTRAP_SALES_REJECTED');
 let sql=replaceOnce(source,'BEGIN TRY\n BEGIN TRANSACTION;',`DECLARE @desktop_sales_json nvarchar(max)=${literal(json)};\nBEGIN TRY\n BEGIN TRANSACTION;`);
 sql=replaceOnce(sql,' -- Verify the complete expected user-table set before inserting the sole',` ${executeSales}\n -- Verify the complete expected user-table set before inserting the sole`);
 sql=replaceOnce(sql,' COMMIT TRANSACTION;',` ${checkSnapshot}\n COMMIT TRANSACTION;`);
 return Object.freeze({scope:'desktop-sales-bootstrap-offline-proposal-v1',server:SERVER,database:DATABASE,environmentId:ENV,
  sql,sqlSha256:hash(sql),baseSqlSha256:BASE_SHA,salesSnapshotSha256:SALES_SHA,ddlBatchCount:45,
  expectedTableCount:27,expectedCommercialEmptyTableCount:26,verifiedAddedColumns:rows.length,requirements:DESKTOP_SALES_BOOTSTRAP_LIMITS});
}
