import { getTestPool, save, protectedManifest } from './vega-native-migration-runtime.mjs';
const pool = await getTestPool();
try {
  const metadata = (await pool.request().query("SELECT t.name [table],c.name [column],ty.name type,c.max_length length,c.precision,c.scale,c.is_nullable nullable,c.is_computed computed,dc.definition [default] FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id JOIN sys.columns c ON c.object_id=t.object_id JOIN sys.types ty ON ty.user_type_id=c.user_type_id LEFT JOIN sys.default_constraints dc ON dc.object_id=c.default_object_id WHERE s.name=N'dbo' ORDER BY t.name,c.column_id")).recordset;
  const constraints = (await pool.request().query("SELECT OBJECT_NAME(parent_object_id) [table],name,definition FROM sys.check_constraints ORDER BY name")).recordset;
  const indexes = (await pool.request().query("SELECT t.name [table],i.name,i.is_unique,i.is_primary_key,i.is_unique_constraint,i.filter_definition,c.name [column],ic.key_ordinal FROM sys.tables t JOIN sys.indexes i ON i.object_id=t.object_id JOIN sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id WHERE i.is_unique=1 ORDER BY t.name,i.name,ic.key_ordinal")).recordset;
  const protectedRows = await protectedManifest(() => pool.request());
  save('target-schema.json', { metadata, constraints, indexes }); save('protected-before.json', protectedRows);
  console.log(JSON.stringify({ protectedRows, constraints: constraints.filter(c => /sales_invoices|purchase_invoices|invoice_returns|stock_movements|finance_account|customer_movements|supplier_movements/.test(c.table)), documentIndexes: indexes.filter(c => /sales_invoices|purchase_invoices|invoice_returns/.test(c.table)) }));
} finally { await pool.close(); }
