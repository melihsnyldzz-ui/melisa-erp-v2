import fs from 'node:fs';

const screen = fs.readFileSync('apps/web-admin/src/modules/whatsapp-crm/WhatsappCrmInboxScreen.jsx', 'utf8');
const repository = fs.readFileSync('apps/whatsapp-crm-api/src/repositories/crmRepository.js', 'utf8');
const controller = fs.readFileSync('apps/whatsapp-crm-api/src/controllers/conversationController.js', 'utf8');
const chatwootWorkflow = fs.readFileSync('apps/whatsapp-crm-api/src/services/chatwootWorkflowService.js', 'utf8');

const checks = [
  ['quote requires a CRM contact and ERP product lines', repository.includes('WHATSAPP_CRM_QUOTE_INVALID') && repository.includes('contactSnapshot') && repository.includes('safeLines.length')],
  ['mixed currency quote fails closed', repository.includes('WHATSAPP_CRM_QUOTE_CURRENCY_MIXED')],
  ['quote is a persistent CRM draft', repository.includes("eventType: 'crm.conversation.quote_created'") && repository.includes("status: 'draft'")],
  ['controller states ERP order is not written', controller.includes('erpOrderWritten: false')],
  ['unimplemented ERP order conversion is not presented as an action', !screen.includes('ERP siparişine dönüştür (onay gerekli)') && !screen.includes('wcrm-order-gate')],
  ['quote creation button requires products but not an ERP customer', screen.includes('activeConversation.products.length === 0') && !screen.includes('!erpCustomer || activeConversation.products.length === 0')],
  ['Chatwoot quote is a private CRM record', chatwootWorkflow.includes("type: 'quote'") && chatwootWorkflow.includes('private: true')],
];

let passed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (ok) passed += 1;
}
console.log(`SUMMARY: ${passed}/${checks.length} PASS`);
if (passed !== checks.length) process.exit(1);
