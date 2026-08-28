import fs from 'node:fs';

const screen = fs.readFileSync('apps/web-admin/src/modules/whatsapp-crm/WhatsappCrmInboxScreen.jsx', 'utf8');
const repository = fs.readFileSync('apps/whatsapp-crm-api/src/repositories/crmRepository.js', 'utf8');
const routes = fs.readFileSync('apps/whatsapp-crm-api/src/routes/conversationRoutes.js', 'utf8');

const checks = [
  ['products are searched from ERP API', screen.includes('fetchProducts') && screen.includes('ERP ürünü ara')],
  ['search results expose stock and sale price', screen.includes('product.stockQuantity') && screen.includes('product.salePrice')],
  ['product interest endpoint is protected', routes.includes("'/crm/conversations/:conversationId/product-interests'") && routes.includes("requireCrmPermission('crm.manage')")],
  ['product snapshot requires ERP identity fields', repository.includes('WHATSAPP_CRM_PRODUCT_INVALID') && repository.includes('productId') && repository.includes('stockCode')],
  ['product interests persist in existing event store', repository.includes("crm.conversation.product_interest_added") && repository.includes('product_interests')],
  ['no external WhatsApp message is sent by product selection', !repository.includes('sendText') && !repository.includes('sendMedia')],
];

let passed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (ok) passed += 1;
}
console.log(`SUMMARY: ${passed}/${checks.length} PASS`);
if (passed !== checks.length) process.exit(1);

