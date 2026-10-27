import fs from 'node:fs';
import path from 'node:path';
import { networkPolicy } from './canonical-test-network.mjs';
import {canonicalListenerPolicy} from './canonical-test-listeners.mjs';
import {BUSINESS_SESSION,validateBusinessSessionProfile,configureCanonicalBusinessSession} from './src/services/canonicalBusinessSessionContext.mjs';

export function canonicalGoal8Policy(config,{mode,writes}){
  if(config.goal8SyntheticDayProfile!==undefined&&typeof config.goal8SyntheticDayProfile!=='boolean')throw Error('TEST_GOAL8_PROFILE_CONFIG_REJECTED');
  if(config.goal8SqlProfileInstalled!==undefined&&typeof config.goal8SqlProfileInstalled!=='boolean')throw Error('TEST_GOAL8_SQL_CONFIG_REJECTED');
  // The shared supervisor config also starts the readonly native listener.
  // Profile selection has operational meaning only for the ERP writer.
  if(mode==='native')return {goal8DayProfile:false,goal8SqlInstalled:false};
  const goal8DayProfile=writes&&config.goal8SyntheticDayProfile===true;
  const goal8SqlInstalled=writes&&config.goal8SqlProfileInstalled===true;
  if(config.goal8SqlProfileInstalled===true&&!goal8SqlInstalled||goal8DayProfile&&!goal8SqlInstalled)throw Error('TEST_GOAL8_SQL_PROFILE_REQUIRED');
  if(config.goal8SyntheticDayProfile===true&&!goal8DayProfile)throw Error('TEST_GOAL8_PROFILE_MODE_REJECTED');
  return {goal8DayProfile,goal8SqlInstalled};
}

export async function configureCanonicalTest(configPath, mode) {
  if (!path.isAbsolute(configPath || '') || !['erp','native'].includes(mode)) throw Error('TEST_ARGUMENT_REJECTED');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if(config.businessWorkface!==undefined)validateBusinessSessionProfile(config.businessWorkface);
  const expectedDatabase = 'MELISA_ERP_SIRKET_TEST_20260929_01';
  const readLogin = 'melisa_sirket_test_20260929_01';
  const writes = mode === 'erp' && config.salesEnabled === true;
  if(config.productPurchaseReferenceVersion!==undefined&&![1,2].includes(config.productPurchaseReferenceVersion))throw Error('TEST_PURCHASE_REFERENCE_VERSION_REJECTED');
  if(writes&&config.productPurchaseReferenceVersion===2&&(!/^[a-f0-9]{64}$/.test(config.productPurchaseReferenceManifestHash??'')||!/^[a-f0-9]{64}$/.test(config.productLastPurchaseReferenceManifestHash??'')))throw Error('TEST_LAST_PURCHASE_PIN_REQUIRED');
  const {goal8DayProfile,goal8SqlInstalled}=canonicalGoal8Policy(config,{mode,writes});
  const release=JSON.parse(fs.readFileSync(path.resolve('../../release-manifest.json'),'utf8'));
  const goal8Seal=config.goal8SyntheticDaySeal;
  if(goal8SqlInstalled&&(!goal8Seal||! /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(goal8Seal.dayId??'')||! /^[A-F0-9]{64}$/.test(goal8Seal.definitionHash??'')||goal8Seal.sourceCommit!==release.sourceCommit||goal8Seal.packageId!==release.packageId))throw Error('TEST_GOAL8_PROFILE_SEAL_REJECTED');
  if(mode==='erp'&&config.businessWorkface){
    const {verifyBusinessApiClosure}=await import('../../scripts/canonical/business-workface-api-closure.mjs');
    await verifyBusinessApiClosure(release,file=>fs.promises.readFile(path.resolve('../../',file)));
  }
  const expectedLogin = writes ? 'melisa_sirket_sales_test_20260929_01' : readLogin;
  if (config.database !== expectedDatabase || config.sqlUser !== readLogin || (writes && config.salesSqlUser !== expectedLogin) || config.server !== '127.0.0.1' || config.sqlPort !== 1433 || config.host !== '127.0.0.1' || config.erpPort !== 4144 || config.nativePort !== 4146 || config.webPort !== 5194) throw Error('TEST_CONFIG_IDENTITY_REJECTED');
  const listenerPolicy=canonicalListenerPolicy(config,{mode,writes});
  for (const key of Object.keys(process.env)) if (/^(SQL_|VEGA_|ARMADA_|WHATSAPP_|EVOLUTION_|CRM_|NAKLIYAT_|SMTP_|MAIL_|EMAIL_|JWT_|NATIVE_|TERMINAL_|PILOT_|MELISA_|SHIPPING_|SCHEDULE|WORKER_|HTTP_PROXY|HTTPS_PROXY|ALL_PROXY|NODE_OPTIONS)/i.test(key)) delete process.env[key];
  const port = mode === 'erp' ? 4144 : 4146;
  Object.assign(process.env, {
    NODE_ENV:'production', API_PORT:String(port), APP_NAME:'melisa-canonical-test',
    SQL_SERVER:config.server, SQL_PORT:'1433', SQL_DATABASE:expectedDatabase, SQL_USER:expectedLogin, SQL_PASSWORD:writes ? config.salesSqlPassword : config.sqlPassword,
    SQL_TRUSTED_CONNECTION:'false', SQL_READ_ONLY:String(!writes), SQL_ENCRYPT:'false', SQL_TRUST_SERVER_CERTIFICATE:'true',
    MELISA_TEST_SCOPED_SALES:String(writes), MELISA_TEST_STATELESS_AUTH:'true',
    MELISA_GOAL8_SYNTHETIC_DAY:String(goal8DayProfile),
    MELISA_GOAL8_SQL_PROFILE_INSTALLED:String(goal8SqlInstalled),
    MELISA_GOAL8_SYNTHETIC_DAY_SEAL:goal8SqlInstalled?JSON.stringify(goal8Seal):'',
    MELISA_PRODUCT_PURCHASE_REFERENCE_MANIFEST_HASH:writes&&/^[a-f0-9]{64}$/.test(config.productPurchaseReferenceManifestHash??'')?config.productPurchaseReferenceManifestHash:'',
    MELISA_PRODUCT_PURCHASE_REFERENCE_VERSION:writes?String(config.productPurchaseReferenceVersion??1):'1',
    MELISA_PRODUCT_LAST_PURCHASE_REFERENCE_MANIFEST_HASH:writes&&config.productPurchaseReferenceVersion===2?config.productLastPurchaseReferenceManifestHash:'',
    // Local sessions share one loopback address; each workflow refresh reads
    // several protected endpoints. Keep a bounded TEST rate without applying
    // the production fifteen-minute shared-IP budget to a local work session.
    RATE_LIMIT_ENABLED:'true', RATE_LIMIT_WINDOW_MS:'60000', RATE_LIMIT_MAX:'1000',
    JWT_ACCESS_SECRET:config.jwtAccessSecret, JWT_SECRET:config.jwtAccessSecret, JWT_REFRESH_SECRET:config.jwtRefreshSecret,
    JWT_ACCESS_EXPIRES_IN:'8h', NATIVE_TERMINAL_SIGNING_KEY:config.nativeSigningKey,
    MELISA_LOCAL_PASSWORDLESS_LOGIN:'false', MELISA_PILOT_RUNTIME:'true', MELISA_CANONICAL_TEST:'true', NATIVE_CUSTOMER_ROUTES_ENABLED:'false',
    WHATSAPP_ENABLED:'false', NAKLIYAT_ENABLED:'false', SMTP_ENABLED:'false', EMAIL_ENABLED:'false', WORKERS_ENABLED:'false', SCHEDULER_ENABLED:'false',
    MELISA_INVOICE_EXPORT_ENABLED:'false', TERMINAL_RECEIPT_PRINT_ENABLED:'false', TERMINAL_RECEIPT_PRINT_MODE:'disabled', TERMINAL_RECEIPT_PRINTER_NAME:'',
    TERMINAL_CATALOG_CACHE_DIR:path.resolve('.canonical-runtime/catalog'), PILOT_CATALOG_DIR:path.resolve('.canonical-runtime/pilot'),
    CORS_ORIGINS:listenerPolicy.corsOrigins.join(','),
  });
  if(mode==='erp'&&config.businessWorkface){
    if(! /^[A-Za-z0-9_-]{64,128}$/.test(config.businessSessionAccessSecret??'')||config.businessSessionAccessSecret===config.jwtAccessSecret)throw Error('AUTH_BUSINESS_TEST_TARGET_INVALID');
    process.env.MELISA_TEST_PROTECTED_SESSION_PATH=BUSINESS_SESSION.sessionPath;process.env.MELISA_BUSINESS_SESSION_SECRET=config.businessSessionAccessSecret;
  }
  for (const file of ['.env','.env.local']) if(fs.existsSync(path.resolve(file))) throw Error('TEST_DOTENV_REJECTED');
  const { env } = await import('./src/config/env.js');
  if(env.sql.database!==expectedDatabase || env.sql.readOnly!==!writes || env.sql.trustedConnection || env.vega.enabled || env.whatsapp.enabled || env.nakliyat.enabled || env.receiptPrinting.enabled || env.port!==port) throw Error('TEST_ENVIRONMENT_REJECTED');
  const { getSqlPool } = await import('./src/config/database.js');
  const pool = await getSqlPool();
  const identity = (await pool.request().query("SELECT DB_NAME() databaseName,CAST(SERVERPROPERTY('ServerName') AS nvarchar(128)) serverName,SUSER_SNAME() loginName,USER_NAME() databaseUser,IS_SRVROLEMEMBER('sysadmin') sysadmin,HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CONTROL') databaseControl,HAS_PERMS_BY_NAME('dbo.sales_invoices','OBJECT','INSERT') canInsertSales,HAS_DBACCESS('MELISA_ERP_PROD_CANDIDATE_20260917_01') liveDatabaseAccess")).recordset[0];
  const permissions = (await pool.request().query("SELECT permission_name FROM sys.fn_my_permissions(NULL,'DATABASE') WHERE permission_name IN ('INSERT','UPDATE','DELETE','EXECUTE','CONTROL','ALTER','TAKE OWNERSHIP') UNION SELECT p.permission_name FROM sys.tables t CROSS APPLY sys.fn_my_permissions(QUOTENAME(SCHEMA_NAME(t.schema_id))+'.'+QUOTENAME(t.name),'OBJECT') p WHERE p.permission_name IN ('INSERT','UPDATE','DELETE','ALTER','CONTROL','TAKE OWNERSHIP') UNION SELECT p.permission_name FROM sys.procedures t CROSS APPLY sys.fn_my_permissions(QUOTENAME(SCHEMA_NAME(t.schema_id))+'.'+QUOTENAME(t.name),'OBJECT') p WHERE p.permission_name='EXECUTE'")).recordset;
  if(identity.databaseName!==expectedDatabase || identity.serverName.toLowerCase()!=='semih\\melisadev' || identity.loginName!==expectedLogin || identity.databaseUser!==expectedLogin || identity.sysadmin!==0 || identity.databaseControl!==0 || identity.canInsertSales!==(writes?1:0) || identity.liveDatabaseAccess!==0 || (!writes && permissions.length)) throw Error('TEST_SQL_PERMISSION_REJECTED');
  if(writes){
    const guards=(await pool.request().query("SELECT COUNT(*) n FROM sys.triggers WHERE name IN(N'test_guard_products',N'test_guard_stock_movements',N'test_guard_sales_invoices',N'test_guard_customer_movements',N'test_guard_purchase_invoices',N'test_guard_supplier_movements',N'test_guard_finance_accounts',N'test_guard_finance_movements') AND is_disabled=0")).recordset[0];
    if(Number(guards.n)!==8 || permissions.some(p=>['CONTROL','ALTER','TAKE OWNERSHIP'].includes(p.permission_name)))throw Error('TEST_WRITER_GUARDS_REJECTED');
  }
  const businessSession=await configureCanonicalBusinessSession({config,identity,mode,port,writes,pool});
  return {config,env,pool,identity,port,networkPolicy,release,writes,listenerPolicy,businessSession};
}
