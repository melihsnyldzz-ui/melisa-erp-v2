import {pathToFileURL}from'node:url';
import sqlTcp from'mssql/tedious.js';
import{getTestPool,sql,ident,requireRule,save}from'./vega-native-migration-runtime.mjs';
const module=await import(pathToFileURL('C:/do-wt/melisa-mcp-readonly-20260917/apps/api/src/config/yeniErpDatabase.js'));
const config=module.loadYeniErpConfig('C:/do-wt/melisa-mcp-readonly-20260917/output/yeni-erp.local.json');
const tables=['product_source_aliases','product_prices','party_entities','party_currency_accounts','party_source_links','inventory_documents','inventory_document_items','financial_documents','financial_document_items','document_links','salesperson_aliases','migration_runs','migration_decisions'];
const pool=await getTestPool();
try{const principals=(await pool.request().input('login',sql.NVarChar(128),config.user).query("SELECT name FROM sys.database_principals WHERE sid=SUSER_SID(@login) AND type=N'S'")).recordset;requireRule(principals.length===1,'EXACT_READER_PRINCIPAL_REQUIRED');const principal=principals[0].name;requireRule(/^[a-zA-Z0-9_]+$/.test(principal),'READER_PRINCIPAL_IDENTIFIER');
 for(const table of tables)await pool.request().query(`GRANT SELECT ON OBJECT::dbo.${ident(table)} TO ${ident(principal)};`);
}finally{await pool.close();}
class Reader extends sqlTcp.ConnectionPool {request(){return new sqlTcp.Request(this);}}
const reader=new Reader(config);try{await reader.connect();const permission=await module.verifyYeniErpPermissions(reader);const checks=[];for(const table of tables){const row=(await reader.request().query(`SELECT HAS_PERMS_BY_NAME(N'dbo.${table}',N'OBJECT',N'SELECT') canRead,HAS_PERMS_BY_NAME(N'dbo.${table}',N'OBJECT',N'INSERT') canInsert,HAS_PERMS_BY_NAME(N'dbo.${table}',N'OBJECT',N'UPDATE') canUpdate,HAS_PERMS_BY_NAME(N'dbo.${table}',N'OBJECT',N'DELETE') canDelete`)).recordset[0];requireRule(row.canRead===1&&row.canInsert===0&&row.canUpdate===0&&row.canDelete===0,'READONLY_OBJECT_PERMISSIONS_REQUIRED');checks.push({table,...row});}const receipt={permission,checks,writePermissionsGranted:false};save('reader-permissions.json',receipt);console.log(JSON.stringify(receipt));}finally{await reader.close();}
