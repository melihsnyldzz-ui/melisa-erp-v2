import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(repoRoot, path), 'utf8');

const migration = read('infra/sql/migrations/0012_multi_currency_cash_sessions.sql');
const service = read('apps/api/src/services/cashRegisterService.js');
const financeService = read('apps/api/src/services/financeService.js');
const routes = read('apps/api/src/routes/cashRegisterRoutes.js');
const screen = read('apps/web-admin/src/modules/finance/CashRegisterScreen.jsx');
const navigation = read('apps/web-admin/src/data/mockNavigationData.js');
const workspace = read('apps/web-admin/src/components/workspace/Workspace.jsx');
const styles = read('apps/web-admin/src/styles/cash-register.css');

const checks = [
  ['migration is guarded to MELISA_ERP_V2', migration.includes("DB_NAME() <> N'MELISA_ERP_V2'")],
  ['migration creates drawer session count and category tables', ['cash_drawers', 'cash_sessions', 'cash_session_counts', 'expense_categories'].every((name) => migration.includes(`dbo.${name}`))],
  ['migration seeds TRY USD EUR drawer accounts', ['CEKMECE-', "(N'TRY'), (N'USD'), (N'EUR')"].every((text) => migration.includes(text))],
  ['expense categories include common operational choices', ['Yemek', 'Market', 'Kırtasiye', 'Kargo', 'Ulaşım', 'Temizlik', 'Bakım / Onarım', 'Personel', 'Diğer'].every((name) => migration.includes(name))],
  ['API exposes read open expense transfer and close routes', ['/finance/cash-register', '/finance/cash-register/open', '/finance/cash-register/expenses', '/finance/cash-register/transfers', '/finance/cash-register/close'].every((path) => routes.includes(path))],
  ['write operations remain guarded', ['openCashSession', 'createCashExpense', 'createCashTransfer', 'closeCashSession'].every((name) => service.includes(`export async function ${name}`)) && service.match(/assertMelisaWriteEnabled\(\)/g)?.length >= 4],
  ['opening and closing differences require notes', service.includes('CASH_REGISTER_OPENING_DIFFERENCE_NOTE_REQUIRED') && service.includes('CASH_REGISTER_CLOSING_DIFFERENCE_NOTE_REQUIRED')],
  ['cash expenses write an outgoing drawer movement', service.includes("sourceType: 'expense'") && service.includes("direction: 'out'")],
  ['cash transfers use balanced main and drawer entries', service.includes("partyType: 'main_cash'") && service.includes("partyType: 'cash_drawer'")],
  ['open cash session routes automatic cash movements to drawer', financeService.includes("if (accountType === 'cash')") && financeService.includes("cs.session_status = N'open'")],
  ['bank and card account resolution remains separate', financeService.includes("if (paymentMethod === 'bank') return 'bank'") && financeService.includes("if (paymentMethod === 'card') return 'card'")],
  ['screen shows independent TRY USD EUR summaries', screen.includes("const CURRENCIES = ['TRY', 'USD', 'EUR']") && screen.includes('cash-currency-summary')],
  ['screen supports opening expense transfer and closing workflows', ['submitOpen', 'submitExpense', 'submitTransfer', 'submitClose'].every((name) => screen.includes(`function ${name}`))],
  ['screen uses one exclusive action panel instead of stacked forms', screen.includes("const [activeAction, setActiveAction] = useState('expense')") && screen.includes('cash-action-tabs') && !screen.includes('<details className="erp-panel cash-close-details">')],
  ['cash actions use clear color coded command buttons', screen.includes('expense-tab') && screen.includes('transfer-tab') && screen.includes('close-tab') && styles.includes('.cash-action-tabs .expense-tab') && styles.includes('.cash-action-tabs .transfer-tab') && styles.includes('.cash-action-tabs .close-tab')],
  ['currency selection uses direct TRY USD EUR buttons', screen.includes('function CurrencyPicker') && screen.includes('cash-currency-buttons') && screen.includes('aria-pressed={value === currency}')],
  ['movement table exposes cumulative remaining balance', screen.includes('Kümülatif Kalan') && screen.includes('row.runningBalance')],
  ['movement list separates income expense and transfers', screen.includes('MOVEMENT_FILTERS') && screen.includes("id: 'income'") && screen.includes("id: 'expense'") && screen.includes("id: 'transfer'") && screen.includes('filteredMovements.map')],
  ['movement filters preserve API running balances', screen.includes('movementGroup(row)') && screen.includes('row.runningBalance') && styles.includes('.cash-movement-tabs button.active.income') && styles.includes('.cash-movement-tabs button.active.expense')],
  ['cash register is a registered finance screen', navigation.includes("screenId: 'cash-register'") && workspace.includes("'cash-register':")],
  ['layout has desktop and mobile hardening', styles.includes('.cash-register-workspace') && styles.includes('@media (max-width: 1100px)') && styles.includes('@media (max-width: 760px)')],
];

const failed = checks.filter(([, passed]) => !passed);
for (const [name, passed] of checks) console.log(`${passed ? 'PASS' : 'FAIL'} - Cash Register / ${name}`);
console.log(`SUMMARY: ${checks.length - failed.length}/${checks.length} PASS`);
if (failed.length) process.exit(1);
