import fs from 'node:fs';

const envSource = fs.readFileSync('apps/whatsapp-crm-api/src/config/env.js', 'utf8');
const envExample = fs.readFileSync('apps/whatsapp-crm-api/.env.example', 'utf8');
const sendService = fs.readFileSync('apps/whatsapp-crm-api/src/services/sendService.js', 'utf8');
const sendTests = fs.readFileSync('apps/whatsapp-crm-api/src/services/sendService.test.js', 'utf8');
const healthService = fs.readFileSync('apps/whatsapp-crm-api/src/services/healthService.js', 'utf8');
const compose = fs.readFileSync('docker-compose.whatsapp-crm.yml', 'utf8');
const screen = fs.readFileSync('apps/web-admin/src/modules/whatsapp-crm/WhatsappCrmInboxScreen.jsx', 'utf8');

const checks = [
  ['live approval defaults to false', envExample.includes('WHATSAPP_LIVE_SEND_APPROVED=false') && envSource.includes("booleanEnv('WHATSAPP_LIVE_SEND_APPROVED', false)")],
  ['unapproved live send fails closed', sendService.includes('WHATSAPP_CRM_LIVE_SEND_NOT_APPROVED') && sendService.includes('!env.whatsapp.liveSendApproved')],
  ['live approval guard has an automated test', sendTests.includes('fails closed when live sending has no explicit approval')],
  ['health exposes effective send state', healthService.includes('env.whatsapp.testNumberOnly || env.whatsapp.liveSendApproved')],
  ['Evolution image is pinned', compose.includes('evoapicloud/evolution-api:v2.2.3') && !compose.includes('evolution-api:latest')],
  ['health and inbox failures are separated', screen.includes('Promise.allSettled') && screen.includes("healthResult.status === 'fulfilled'")],
];

let passed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (ok) passed += 1;
}
console.log(`SUMMARY: ${passed}/${checks.length} PASS`);
if (passed !== checks.length) process.exit(1);

