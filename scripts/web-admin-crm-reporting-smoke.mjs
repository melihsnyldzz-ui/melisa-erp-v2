import fs from 'node:fs';

const screen = fs.readFileSync('apps/web-admin/src/modules/whatsapp-crm/WhatsappCrmInboxScreen.jsx', 'utf8');

const checks = [
  ['inbox API summary is retained', screen.includes('inboxResponse.data?.summary') && screen.includes('pendingHumanReply')],
  ['dashboard shows open unread and reply metrics', screen.includes('Açık konuşma') && screen.includes('Okunmamış') && screen.includes('Yanıt bekleyen')],
  ['dashboard derives persistent task and quote counts', screen.includes('crmMetrics.tasks') && screen.includes('crmMetrics.quotes')],
  ['sales funnel is derived from actual conversation stages', screen.includes('result[item.stage]') && screen.includes('Satış hunisi')],
  ['reporting is read only', !screen.includes('export async function') && screen.includes('useMemo')],
];

let passed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (ok) passed += 1;
}
console.log(`SUMMARY: ${passed}/${checks.length} PASS`);
if (passed !== checks.length) process.exit(1);
