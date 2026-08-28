import fs from 'node:fs';

const screen = fs.readFileSync('apps/web-admin/src/modules/whatsapp-crm/WhatsappCrmInboxScreen.jsx', 'utf8');
const service = fs.readFileSync('apps/web-admin/src/services/crmCustomer360Api.js', 'utf8');

const checks = [
  ['customer lookup is read only', service.includes('fetchCustomers') && service.includes('fetchCustomerDetail') && !service.includes('post(') && !service.includes('put(') && !service.includes('patch(')],
  ['phone matching uses normalized last ten digits', service.includes("digits.slice(-10)") && service.includes('comparablePhone(customer.phoneMasked)')],
  ['ambiguous phone fails closed', service.includes("status: 'ambiguous'") && service.includes('matches.length > 1')],
  ['customer 360 has explicit UI states', ['loading', 'matched', 'not-found', 'ambiguous', 'unverified-phone', 'error'].every((state) => screen.includes(`status === '${state}'`))],
  ['optional ERP reference stays read only', screen.includes('ERP referansı') && screen.includes('erpCustomer.balance') && screen.includes('recentMovements')],
  ['CRM-only contact does not expose ERP creation', screen.includes('yalnızca CRM içinde takip edilir') && !screen.includes('ERP carisi olarak kaydet')],
  ['fake local orders are not created', !screen.includes('local-product-') && !screen.includes('CRM-${String(Date.now())')],
];

let passed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (ok) passed += 1;
}

console.log(`SUMMARY: ${passed}/${checks.length} PASS`);
if (passed !== checks.length) process.exit(1);
