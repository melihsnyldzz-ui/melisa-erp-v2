import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const app = read('apps/terminal-app/App.js');
const screen = read('apps/terminal-app/src/screens/WhatsAppCrmScreen.js');
const service = read('apps/terminal-app/src/services/whatsappCrmService.js');

const checks = [
  ['CRM screen is registered in the terminal app', app.includes('WhatsAppCrmScreen')],
  ['inbox is loaded through the authenticated CRM gateway', service.includes("crmRequest(`/crm/inbox") && service.includes('{ token }')],
  ['send uses the selected conversation id', service.includes('conversationId: conversation?.id')],
  ['assignment uses the selected conversation id', service.includes('/assignment') && service.includes('conversationId')],
  ['terminal exposes mine and unassigned filters', screen.includes("key: 'mine'") && screen.includes("key: 'unassigned'")],
  ['terminal opens CRM with the authenticated ERP session without a second password form', !screen.includes('WhatsApp CRM Kilitli') && !screen.includes('CRM sifresi')],
  ['message input is guarded while sending', screen.includes('disabled={!messageText.trim() || sending}')],
  ['no Chatwoot or Evolution secret is embedded in the terminal service', !/api_access_token|EVOLUTION_API_KEY|CHATWOOT_API_ACCESS_TOKEN/.test(service)],
];

let passed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (ok) passed += 1;
}

console.log(`SUMMARY: ${passed}/${checks.length} PASS`);
if (passed !== checks.length) process.exit(1);
