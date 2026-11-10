// Finite schema-only reuse of the existing V3..V7 DDL. No SQL execution.
import {MASTER_V3_OPERATION_CHECK_SQL} from '../desktop-empty/master-v3-journal-sql.mjs';
import {MASTER_V4_OPERATION_CHECK_SQL} from '../desktop-empty/master-v4-journal-sql.mjs';
import {DESKTOP_MASTER_V5_CHECKS,DESKTOP_V5_CUSTOMER_MOVEMENT_CHECK} from '../../apps/api/src/config/desktopMasterV5Policy.mjs';
import {compileDesktopGoodsV6SchemaFragments,DESKTOP_GOODS_V6_ADDED_COLUMNS} from '../../apps/api/src/config/desktopGoodsV6Schema.mjs';
import {DESKTOP_FINANCE_PROPOSAL_SQL} from '../../apps/api/src/config/desktopFinanceSchemaProposal.mjs';
import {LOCAL_MASTER_BASE_TABLES} from '../desktop-empty/local-master-schema-proposal.mjs';
export const V2_ADDED_TABLES=Object.freeze(['desktop_local_product_units','desktop_local_price_units','desktop_local_master_requests','desktop_sale_request_resolutions','desktop_sale_workflows','desktop_sale_reservations','desktop_sale_cartons','desktop_sale_carton_items','desktop_sale_workflow_requests']);
export const OLD_TABLES=Object.freeze([...LOCAL_MASTER_BASE_TABLES,...V2_ADDED_TABLES].sort());
export const GOODS_TABLES=Object.freeze(['desktop_goods_receipts','desktop_goods_receipt_lines','desktop_goods_purchase_links','desktop_goods_requests']);
export const FINANCE_TABLES=Object.freeze(['finance_accounts','finance_account_movements','desktop_finance_requests']);
export const NEW_TABLES=Object.freeze([...GOODS_TABLES,...FINANCE_TABLES].sort());
export const ALL_TABLES=Object.freeze([...OLD_TABLES,...NEW_TABLES].sort());
export const ADDED_COLUMNS=Object.freeze([['suppliers','party_entity_id','bigint'],...DESKTOP_GOODS_V6_ADDED_COLUMNS].map(Object.freeze));
if(OLD_TABLES.length!==36||ALL_TABLES.length!==43||ADDED_COLUMNS.length!==15)throw Error('K0210_UPGRADE_SOURCE_DRIFT');
const strip=(sql,part)=>{if(sql.split(part).length!==2)throw Error('K0210_UPGRADE_SOURCE_DRIFT');return sql.replace(part,'');};
// Verbatim technical reference values from desktopGoodsV6Schema.mjs. These
// are NOT company credit/due/exchange policies. Rollback never inserts them.
export const SETTINGS_INSERT="INSERT dbo.system_settings(setting_group,setting_key,setting_value,value_type,is_active) VALUES(N'accounting',N'periodLockEnabled',N'false',N'boolean',1),(N'accounting',N'periodLockedThroughDate',NULL,N'string',1);";
export const SETTINGS_VERIFY=" IF (SELECT COUNT(*) FROM dbo.system_settings)<>2 OR (SELECT COUNT(*) FROM dbo.system_settings WHERE setting_group=N'accounting' AND is_active=1 AND ((setting_key=N'periodLockEnabled' AND setting_value=N'false' AND value_type=N'boolean') OR (setting_key=N'periodLockedThroughDate' AND setting_value IS NULL AND value_type=N'string')))<>2 THROW 51995,'DESKTOP_V6_SETTINGS_READBACK',1;";
export const CASH_INSERT="INSERT dbo.finance_accounts(account_code,account_name,account_type,currency_code,opening_balance,current_balance,is_active) VALUES(N'KASA-TRY',N'TRY Ana Kasa',N'cash',N'TRY',0,0,1);";
export const REFERENCE_ROWS=Object.freeze({settings:Object.freeze([{setting_group:'accounting',setting_key:'periodLockEnabled',setting_value:'false',value_type:'boolean',is_active:true},{setting_group:'accounting',setting_key:'periodLockedThroughDate',setting_value:null,value_type:'string',is_active:true}].map(Object.freeze)),cash:Object.freeze({account_code:'KASA-TRY',account_name:'TRY Ana Kasa',account_type:'cash',currency_code:'TRY',opening_balance:'0.0000',current_balance:'0.0000',is_active:true})});
// Exact schema statements extracted from master-v3-transition.mjs. Its
// following GRANT/operator/role writes are deliberately outside this slice.
export const V3_ADD_COLUMN='ALTER TABLE dbo.suppliers ADD party_entity_id bigint NULL;';
export const V3_SCHEMA=`ALTER TABLE dbo.suppliers WITH CHECK ADD CONSTRAINT FK_desktop_v3_supplier_entity FOREIGN KEY(party_entity_id) REFERENCES dbo.party_entities(id);
 CREATE UNIQUE INDEX UX_desktop_v3_supplier_entity ON dbo.suppliers(party_entity_id) WHERE party_entity_id IS NOT NULL;
 ALTER TABLE dbo.party_currency_accounts WITH CHECK ADD CONSTRAINT FK_desktop_v3_account_supplier FOREIGN KEY(supplier_id) REFERENCES dbo.suppliers(id);
 CREATE UNIQUE INDEX UX_desktop_v3_supplier_account ON dbo.party_currency_accounts(supplier_id,currency_code) WHERE supplier_id IS NOT NULL AND customer_id IS NULL;
 ALTER TABLE dbo.desktop_local_master_requests DROP CONSTRAINT CK_desktop_local_requests_operation;
 ALTER TABLE dbo.desktop_local_master_requests WITH CHECK ADD CONSTRAINT CK_desktop_local_requests_operation CHECK ${MASTER_V3_OPERATION_CHECK_SQL};
 ALTER TABLE dbo.desktop_empty_installation DROP CONSTRAINT CK_desktop_profile_version_mode;
 ALTER TABLE dbo.desktop_empty_installation WITH CHECK ADD CONSTRAINT CK_desktop_profile_version_mode CHECK((schema_version=1 AND read_only=1) OR (schema_version IN(2,3) AND read_only=0));
 UPDATE dbo.desktop_empty_installation SET schema_version=3 WHERE id=1 AND schema_version=2 AND read_only=0;
 IF @@ROWCOUNT<>1 THROW 51995,'MASTER_V3_MARKER_UPDATE',1;`;
export const V4_SCHEMA=`CREATE UNIQUE INDEX UX_desktop_v4_customer_currency ON dbo.party_currency_accounts(customer_id,currency_code) WHERE customer_id IS NOT NULL AND supplier_id IS NULL;
 ALTER TABLE dbo.desktop_local_master_requests DROP CONSTRAINT CK_desktop_local_requests_operation;
 ALTER TABLE dbo.desktop_local_master_requests WITH CHECK ADD CONSTRAINT CK_desktop_local_requests_operation CHECK ${MASTER_V4_OPERATION_CHECK_SQL};
 ALTER TABLE dbo.desktop_empty_installation DROP CONSTRAINT CK_desktop_profile_version_mode;
 ALTER TABLE dbo.desktop_empty_installation WITH CHECK ADD CONSTRAINT CK_desktop_profile_version_mode CHECK((schema_version=1 AND read_only=1) OR (schema_version IN(2,3,4) AND read_only=0));
 UPDATE dbo.desktop_empty_installation SET schema_version=4 WHERE id=1 AND schema_version=3 AND read_only=0;
 IF @@ROWCOUNT<>1 THROW 51995,'MASTER_V4_MARKER_UPDATE',1;`;
const changedChecks=Object.entries(DESKTOP_MASTER_V5_CHECKS).map(([name,definition])=>{const table=name.includes('resolution')?'desktop_sale_request_resolutions':name.includes('operation')?'desktop_sale_workflow_requests':'desktop_empty_installation';return `ALTER TABLE dbo.${table} DROP CONSTRAINT ${name};ALTER TABLE dbo.${table} WITH CHECK ADD CONSTRAINT ${name} CHECK ${definition};`;}).join('\n');
export const V5_SCHEMA=`${changedChecks}
ALTER TABLE dbo.customer_movements DROP CONSTRAINT CK_customer_movements_type;
ALTER TABLE dbo.customer_movements WITH CHECK ADD CONSTRAINT CK_customer_movements_type CHECK ${DESKTOP_V5_CUSTOMER_MOVEMENT_CHECK};
UPDATE dbo.desktop_empty_installation SET schema_version=5 WHERE id=1 AND schema_version=4 AND read_only=0;
IF @@ROWCOUNT<>1 THROW 51995,'MASTER_V5_MARKER_UPDATE',1;`;
const goods=compileDesktopGoodsV6SchemaFragments({mode:'apply'}).sql;
export const V6_SCHEMA=strip(goods,SETTINGS_INSERT+SETTINGS_VERIFY);
export const V7_SCHEMA=strip(DESKTOP_FINANCE_PROPOSAL_SQL,CASH_INSERT);
export const UPGRADE_SCHEMA_STAGES=Object.freeze([V3_ADD_COLUMN,V3_SCHEMA,V4_SCHEMA,V5_SCHEMA,V6_SCHEMA,V7_SCHEMA]);
// All inserts into existing identity tables are excluded from this DDL path.
if(UPGRADE_SCHEMA_STAGES.some(sql=>/\b(?:GRANT|DENY|REVOKE|CREATE\s+(?:LOGIN|USER|ROLE)|IDENTITY_INSERT|DBCC|RESEED)\b/i.test(sql))||UPGRADE_SCHEMA_STAGES.some(sql=>/\bINSERT\s+dbo\.(?!desktop_empty_installation\b)/i.test(sql)))throw Error('K0210_UPGRADE_SOURCE_DRIFT');
// Inventory only the seven finite CREATE TABLE literals above. This is not a
// general SQL parser; grammar is independently checked with TSql160Parser.
function splitColumns(body){let depth=0,quoted=false,start=0;const out=[];for(let i=0;i<body.length;i++){const c=body[i];if(c==="'"){if(quoted&&body[i+1]==="'"){i++;continue;}quoted=!quoted;}if(!quoted){if(c==='(')depth++;if(c===')')depth--;if(c===','&&depth===0){out.push(body.slice(start,i).trim());start=i+1;}}}out.push(body.slice(start).trim());return out;}
const ddl=UPGRADE_SCHEMA_STAGES.join('\n');
function bodyFor(name){const at=ddl.indexOf('CREATE TABLE dbo.'+name+'(');if(at<0)throw Error('K0210_UPGRADE_SOURCE_DRIFT');const start=at+('CREATE TABLE dbo.'+name+'(').length;let depth=1,quoted=false;for(let i=start;i<ddl.length;i++){if(ddl[i]==="'"){if(quoted&&ddl[i+1]==="'"){i++;continue;}quoted=!quoted;}if(!quoted){if(ddl[i]==='(')depth++;if(ddl[i]===')'&&--depth===0)return ddl.slice(start,i);}}throw Error('K0210_UPGRADE_SOURCE_DRIFT');}
export function columnShape(type){const m=/^(bigint|int|tinyint|bit|uniqueidentifier|date|datetime2|nvarchar|varchar|decimal|binary)(?:\((max|\d+)(?:,(\d+))?\))?$/i.exec(type);if(!m)throw Error('K0210_UPGRADE_SOURCE_DRIFT');const name=m[1].toLowerCase(),n=m[2]==='max'?-1:Number(m[2]??(name==='datetime2'?7:0)),scale=Number(m[3]??(name==='datetime2'?n:0));let length,precision=0;if(['nvarchar','varchar','binary'].includes(name))length=n===-1?-1:n*(name==='nvarchar'?2:1);else if(name==='decimal'){precision=n;length=n<=9?5:n<=19?9:n<=28?13:17;}else if(name==='datetime2'){length=n<=2?6:n<=4?7:8;precision=19+(n?1+n:0);}else{[length,precision]=({bigint:[8,19],int:[4,10],tinyint:[1,3],bit:[1,1],uniqueidentifier:[16,0],date:[3,10]})[name];}return {typeName:name,max_length:length,precision,scale};}
export const NEW_COLUMN_SHAPES=Object.freeze(NEW_TABLES.flatMap(tableName=>splitColumns(bodyFor(tableName)).filter(p=>!/^CONSTRAINT\s/i.test(p)).map(p=>{const m=/^(\w+)\s+((?:\w+)(?:\((?:max|\d+)(?:,\d+)?\))?)/.exec(p);if(!m)throw Error('K0210_UPGRADE_SOURCE_DRIFT');return Object.freeze({tableName,columnName:m[1],...columnShape(m[2]),is_nullable:! /\bNOT NULL\b/i.test(p),is_identity:/\bIDENTITY\s*\(/i.test(p),is_computed:false});})));
export const NEW_CHILDREN=Object.freeze(NEW_TABLES.flatMap(parentName=>[...bodyFor(parentName).matchAll(/\bCONSTRAINT\s+(\w+)\s+(PRIMARY\s+KEY|FOREIGN\s+KEY|REFERENCES|UNIQUE|CHECK|DEFAULT)\b/gi)].map(m=>Object.freeze({parentName,name:m[1],type:({'PRIMARY KEY':'PK','FOREIGN KEY':'F',REFERENCES:'F',UNIQUE:'UQ',CHECK:'C',DEFAULT:'D'})[m[2].toUpperCase().replace(/\s+/g,' ')]}))));
export const NEW_TABLE_INDEXES=Object.freeze([...NEW_CHILDREN.filter(x=>['PK','UQ'].includes(x.type)).map(x=>Object.freeze({tableName:x.parentName,name:x.name})),...[...ddl.matchAll(/CREATE UNIQUE INDEX\s+(\w+)\s+ON dbo\.(\w+)/gi)].filter(m=>NEW_TABLES.includes(m[2])).map(m=>Object.freeze({tableName:m[2],name:m[1]}))]);
