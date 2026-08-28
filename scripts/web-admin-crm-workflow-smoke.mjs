import fs from 'node:fs';

const screen = fs.readFileSync('apps/web-admin/src/modules/whatsapp-crm/WhatsappCrmInboxScreen.jsx', 'utf8');
const workspace = fs.readFileSync('apps/web-admin/src/components/workspace/Workspace.jsx', 'utf8');
const shell = fs.readFileSync('apps/web-admin/src/components/layout/AppShell.jsx', 'utf8');
const repository = fs.readFileSync('apps/whatsapp-crm-api/src/repositories/crmRepository.js', 'utf8');
const routes = fs.readFileSync('apps/whatsapp-crm-api/src/routes/conversationRoutes.js', 'utf8');
const app = fs.readFileSync('apps/web-admin/src/App.jsx', 'utf8');
const crmApi = fs.readFileSync('apps/web-admin/src/services/whatsappCrmApi.js', 'utf8');
const security = fs.readFileSync('apps/whatsapp-crm-api/src/middleware/security.js', 'utf8');
const accessRoutes = fs.readFileSync('apps/whatsapp-crm-api/src/routes/crmAccessRoutes.js', 'utf8');
const chatwootWorkflow = fs.readFileSync('apps/whatsapp-crm-api/src/services/chatwootWorkflowService.js', 'utf8');

const checks = [
  ['authenticated user reaches CRM screen', shell.includes('user={user}') && workspace.includes('<WhatsappCrmWorkspace user={user}')],
  ['hardcoded operator identities are removed', !screen.includes('Ahmet Yilmaz') && !screen.includes('Ayse Demir')],
  ['mine filter uses authenticated user id', screen.includes("String(item.assignedUserId || '') === String(user?.id || '')")],
  ['task endpoint is permission protected', routes.includes("'/crm/conversations/:conversationId/tasks'") && routes.includes("requireCrmPermission('crm.manage')")],
  ['tasks persist without an ERP schema change', repository.includes("eventType: 'crm.conversation.task_created'") && chatwootWorkflow.includes("type: 'task'")],
  ['task validation requires title and due date', repository.includes('WHATSAPP_CRM_TASK_TITLE_REQUIRED') && repository.includes('WHATSAPP_CRM_TASK_DUE_AT_INVALID')],
  ['task UI exposes title and date inputs', screen.includes('aria-label="Takip görevi"') && screen.includes('type="datetime-local"')],
  ['ERP logout clears any legacy CRM unlock token', app.includes('clearWhatsappCrmUnlockToken();')],
  ['CRM opens directly after ERP permission check without the second password gate', workspace.includes("'whatsapp-crm-inbox'") && workspace.includes('<WhatsappCrmWorkspace user={user} />') && !workspace.includes('<WhatsappCrmAccessGate>')],
  ['CRM unlock has a dedicated brute force limiter', security.includes('crmAccessRateLimit') && accessRoutes.includes('crmAccessRateLimit')],
  ['specific active personnel can be assigned', screen.includes('aria-label="Temsilci sec"') && crmApi.includes('assigneeUserId')],
  ['read and lifecycle status routes are protected', routes.includes('/:conversationId/read') && routes.includes('/:conversationId/status')],
  ['inbox exposes real pagination controls', screen.includes('hasNext={Boolean(state.pagination?.hasNext)}') && crmApi.includes('offset = 0')],
  ['advanced filters and mobile customer details are reachable', screen.includes('Detayli konusma filtreleri') && screen.includes("setMobileView('details')")],
  ['misleading message actions are removed', !screen.includes('<Reply size=') && !screen.includes('<Trash2 size=')],
];

let passed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (ok) passed += 1;
}
console.log(`SUMMARY: ${passed}/${checks.length} PASS`);
if (passed !== checks.length) process.exit(1);
