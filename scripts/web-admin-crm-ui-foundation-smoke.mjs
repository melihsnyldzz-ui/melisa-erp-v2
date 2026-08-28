import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const screenPath = path.join(root, 'apps', 'web-admin', 'src', 'modules', 'whatsapp-crm', 'WhatsappCrmInboxScreen.jsx');
const cssPath = path.join(root, 'apps', 'web-admin', 'src', 'modules', 'whatsapp-crm', 'whatsapp-crm-v2.css');
const screen = fs.readFileSync(screenPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');

const checks = [
  ['CRM screen imports its isolated visual layer', screen.includes("import './whatsapp-crm-v2.css';")],
  ['CRM API state is visible in the header', screen.includes('wcrm-service-pill') && screen.includes('CRM API hazır')],
  ['default CRM workspace uses three operational columns', css.includes('grid-template-columns: minmax(250px, 300px) minmax(390px, 1fr) minmax(270px, 320px)')],
  ['connection detail is reserved for wide displays', css.includes('@media (min-width: 1800px)') && css.includes('.wcrm-connection-panel')],
  ['CRM uses green operational accent', css.includes('--wcrm-accent: #059669;')],
  ['CRM workspace is contained inside the available screen height', css.includes('height: 100%;') && css.includes('overflow: hidden;')],
  ['conversation list scrolls independently instead of extending the page', css.includes('.whatsapp-crm-screen .wcrm-conversation-list') && css.includes('max-height: none;') && css.includes('overflow-y: auto;')],
  ['chat and customer panels keep independent scroll boundaries', css.includes('.whatsapp-crm-screen .wcrm-message-stream') && css.includes('.whatsapp-crm-screen .wcrm-customer-panel') && css.includes('overscroll-behavior: contain;')],
];

let failed = 0;
for (const [label, passed] of checks) {
  if (!passed) failed += 1;
  console.log(`${passed ? 'PASS' : 'FAIL'} ${label}`);
}

console.log(`SUMMARY: ${checks.length - failed}/${checks.length} PASS`);
if (failed) process.exitCode = 1;
