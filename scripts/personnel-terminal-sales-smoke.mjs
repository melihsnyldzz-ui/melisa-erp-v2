import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(repoRoot, path), 'utf8');

const migration = read('infra/sql/migrations/0013_personnel_terminal_sales.sql');
const restrictionMigration = read('infra/sql/migrations/0014_personnel_operational_restrictions.sql');
const personnelService = read('apps/api/src/services/personnelService.js');
const terminalService = read('apps/api/src/services/terminalService.js');
const invoiceService = read('apps/api/src/services/invoiceDraftService.js');
const routes = read('apps/api/src/routes/personnelRoutes.js');
const apiIndex = read('apps/api/src/routes/index.js');
const screen = read('apps/web-admin/src/modules/settings/PersonnelDefinitionsScreen.jsx');
const navigation = read('apps/web-admin/src/data/mockNavigationData.js');
const workspace = read('apps/web-admin/src/components/workspace/Workspace.jsx');
const salesHeader = read('apps/web-admin/src/modules/sales/SalesInvoiceHeader.jsx');
const salesList = read('apps/web-admin/src/modules/sales/SalesInvoiceListScreen.jsx');
const styles = read('apps/web-admin/src/styles/personnel-definitions.css');

const checks = [
  ['migration is guarded to MELISA_ERP_V2', migration.includes("DB_NAME() <> N'MELISA_ERP_V2'")],
  ['restriction migration is guarded and range checked', restrictionMigration.includes("DB_NAME() <> N'MELISA_ERP_V2'") && restrictionMigration.includes('CK_employees_max_sale_discount')],
  ['restriction migration preserves sales and disables price override by default', restrictionMigration.includes('DF_employees_can_terminal_sale DEFAULT (1)') && restrictionMigration.includes('DF_employees_can_change_sale_price DEFAULT (0)')],
  ['migration creates a separate employee model', migration.includes('CREATE TABLE dbo.employees') && migration.includes('employee_code') && migration.includes('user_id BIGINT NULL')],
  ['terminal assignment and invoice ownership columns exist in migration', migration.includes('assigned_employee_id') && migration.includes('sales_invoices') && migration.includes('employee_id BIGINT NULL')],
  ['historical invoices are not guessed or backfilled', migration.includes('Existing sales are not assigned retrospectively') && !migration.includes('UPDATE dbo.sales_invoices SET employee_id')],
  ['personnel writes are protected by the global write guard', personnelService.match(/assertMelisaWriteEnabled\(\)/g)?.length >= 3],
  ['personnel and terminal writes are audited', ['employee_created', 'employee_updated', 'terminal_device_created', 'terminal_employee_assigned'].every((action) => personnelService.includes(action))],
  ['personnel totals avoid terminal and invoice join multiplication', personnelService.includes('OUTER APPLY') && personnelService.includes('terminal_summary') && personnelService.includes('sales_summary')],
  ['personnel routes require settings permission for writes', routes.match(/requirePermission\('settings\.manage'\)/g)?.length === 4],
  ['personnel routes are mounted in API', apiIndex.includes('personnelRoutes') && apiIndex.includes('apiRoutes.use(personnelRoutes)')],
  ['terminal sale resolves the logged in active personnel before draft creation', terminalService.includes('getTerminalOperatorContext(normalized.terminalCode, actor?.id)') && terminalService.includes('e.user_id = @operatorUserId')],
  ['terminal sale enforces employee sale permission and price restrictions', ['TERMINAL_EMPLOYEE_SALE_RESTRICTED', 'TERMINAL_EMPLOYEE_PRICE_CHANGE_RESTRICTED', 'TERMINAL_EMPLOYEE_DISCOUNT_LIMIT_EXCEEDED'].every((code) => terminalService.includes(code))],
  ['terminal and employee ids are copied into sales draft payload', terminalService.includes('terminalDeviceId: terminal.terminalDeviceId') && terminalService.includes('employeeId: terminal.employeeId')],
  ['sales invoice persists terminal and employee snapshots', invoiceService.includes('terminal_device_id') && invoiceService.includes('employee_id') && invoiceService.includes('@terminalDeviceId') && invoiceService.includes('@employeeId')],
  ['existing web sales remain readable before migration', invoiceService.includes('hasPersonnelSalesSchema') && invoiceService.includes('CAST(NULL AS BIGINT) AS employeeId') && invoiceService.includes("personnelReady ? 'terminal_device_id, employee_id,' : ''")],
  ['terminal response returns accountable employee and device', terminalService.includes('employee: invoice.employeeId') && terminalService.includes('terminal: invoice.terminalDeviceId')],
  ['personnel management screen supports employee creation, update and password reset', ['createPersonnelEmployee', 'updatePersonnelEmployee', 'resetAuthAdminUserPassword'].every((name) => screen.includes(name))],
  ['personnel creation can atomically create a hashed terminal login', personnelService.includes('bcrypt.hash(loginPassword, 12)') && personnelService.includes("code = N'terminal_user'") && personnelService.includes('loginAccountCreated')],
  ['personnel screen exposes automatic login credentials and password change', screen.includes('Terminal giriş hesabı') && screen.includes('İlk şifre') && screen.includes('Şifre Değiştir') && screen.includes('Yeni Şifreyi Kaydet')],
  ['personnel screen contains no terminal device creation or assignment', !screen.includes('createPersonnelTerminal') && !screen.includes('Terminal Ekle') && !screen.includes('Sorumlu personel')],
  ['personnel screen explains automatic terminal visibility', screen.includes('otomatik olarak terminal giriş listesinde görünür') && screen.includes('Terminal cihazı seçmeniz veya atama yapmanız gerekmez')],
  ['personnel screen is registered in navigation and workspace', navigation.includes("screenId: 'personnel-definitions'") && workspace.includes("'personnel-definitions':")],
  ['sales screens display employee and terminal ownership', salesHeader.includes('Personel / Terminal') && salesList.includes('<th>Personel</th>') && salesList.includes('<th>Terminal</th>')],
  ['personnel layout has desktop and mobile rules', styles.includes('.personnel-workspace') && styles.includes('@media (max-width: 1180px)') && styles.includes('@media (max-width: 760px)')],
];

const failed = checks.filter(([, passed]) => !passed);
for (const [name, passed] of checks) console.log(`${passed ? 'PASS' : 'FAIL'} - Personnel Terminal Sales / ${name}`);
console.log(`SUMMARY: ${checks.length - failed.length}/${checks.length} PASS`);
if (failed.length) process.exit(1);
