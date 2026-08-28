import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const workspace = read('apps/web-admin/src/modules/whatsapp-crm/WhatsappCrmWorkspace.jsx');
const directory = read('apps/web-admin/src/modules/whatsapp-crm/CrmCustomerDirectoryScreen.jsx');
const sales = read('apps/web-admin/src/modules/whatsapp-crm/CrmSalesAssistantScreen.jsx');
const dashboard = read('apps/web-admin/src/modules/whatsapp-crm/CrmManagementDashboardScreen.jsx');
const data = read('apps/web-admin/src/modules/whatsapp-crm/crmWorkspaceData.js');
const css = read('apps/web-admin/src/modules/whatsapp-crm/crm-workspace.css');
const workspaceRoute = read('apps/web-admin/src/components/workspace/Workspace.jsx');

const checks = [
  ['CRM workspace exposes all four visual sections', ['Gelen Kutusu', 'Müşteri Rehberi', 'Teklif Hazırla', 'Yönetim Paneli'].every((text) => workspace.includes(text))],
  ['directory and dashboard use canonical workflow stage keys', directory.includes("'Gorusuluyor'") && directory.includes("'Teslimat'") && dashboard.includes("'Kazanildi'")],
  ['existing real inbox remains the messaging core', workspace.includes('WhatsappCrmInboxScreen') && workspaceRoute.includes('<WhatsappCrmWorkspace user={user} />')],
  ['directory is built only from live CRM conversations', directory.includes('data.conversations.filter') && !directory.includes('fetchCrmCustomer360ByPhone')],
  ['country owner and stage filters are present', ['Tüm ülkeler', 'Tüm personel', 'Tüm aşamalar'].every((text) => directory.includes(text))],
  ['sales assistant reads ERP products', sales.includes('fetchProducts') && sales.includes('API_BASE_URL')],
  ['quote uses the CRM contact without creating an ERP customer', sales.includes('contact: { name: selectedConversation.name') && !sales.includes("customerState.status !== 'matched'")],
  ['nonfunctional ERP order conversion is not shown', !sales.includes('Siparişe Dönüştür')],
  ['dashboard derives values from live CRM data', dashboard.includes('data.metrics') && dashboard.includes('data.conversations.forEach')],
  ['unavailable response-time metric is not shown', !dashboard.includes('İlk Cevap Süresi')],
  ['CRM contacts cannot open an ERP customer creation flow', !workspace.includes('initialCustomer') && !directory.includes('ERP Carisi Oluştur')],
  ['workspace data comes from CRM health and inbox APIs', data.includes('getWhatsappCrmHealth') && data.includes('getWhatsappCrmInbox')],
  ['desktop and mobile responsive layouts exist', css.includes('@media(max-width:1050px)') && css.includes('@media(max-width:700px)')],
];

let passed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (ok) passed += 1;
}
console.log(`SUMMARY: ${passed}/${checks.length} PASS`);
if (passed !== checks.length) process.exit(1);
