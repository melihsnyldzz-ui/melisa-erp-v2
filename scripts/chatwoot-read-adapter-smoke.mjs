import fs from 'node:fs';

const envSource = fs.readFileSync('apps/whatsapp-crm-api/src/config/env.js', 'utf8');
const inboxService = fs.readFileSync('apps/whatsapp-crm-api/src/services/inboxService.js', 'utf8');
const adapter = fs.readFileSync('apps/whatsapp-crm-api/src/services/chatwootInboxService.js', 'utf8');
const mapping = fs.readFileSync('apps/whatsapp-crm-api/src/services/chatwootPersonnelMappingService.js', 'utf8');
const assignment = fs.readFileSync('apps/whatsapp-crm-api/src/services/chatwootConversationService.js', 'utf8');
const routes = fs.readFileSync('apps/whatsapp-crm-api/src/routes/integrationRoutes.js', 'utf8');
const screen = fs.readFileSync('apps/web-admin/src/modules/whatsapp-crm/WhatsappCrmInboxScreen.jsx', 'utf8');

const checks = [
  ['Chatwoot read adapter defaults off', envSource.includes("booleanEnv('CHATWOOT_INBOX_READ_ENABLED', false)")],
  ['local inbox fallback defaults on', envSource.includes("booleanEnv('CHATWOOT_INBOX_FALLBACK_ENABLED', true)")],
  ['adapter reads conversations and messages only', adapter.includes('/conversations?status=all&page=') && adapter.includes('/messages') && !adapter.includes("method: 'POST'")],
  ['Chatwoot failure retains the local inbox', inboxService.includes('listInboxOverview(options)') && inboxService.includes('fallback: true')],
  ['guarded capabilities bind send to the approved outbound provider while protecting workflow mutations', adapter.includes('send: sendEnabled') && adapter.includes("env.whatsapp.liveSendApproved") && adapter.includes("['chatwoot', 'evolution']") && adapter.includes('updateStatus: false') && adapter.includes('localWorkflow: false')],
  ['assignment opens only after explicit personnel mapping', adapter.includes('assign: env.chatwoot.agentPersonnelMap.size > 0')],
  ['assignment targets the explicitly mapped Chatwoot agent', assignment.includes('agentPersonnelMap.get') && assignment.includes('assignee_id')],
  ['group conversations are hidden from the customer inbox by default', envSource.includes("booleanEnv('CHATWOOT_INCLUDE_GROUPS', false)") && adapter.includes('isGroupConversation')],
  ['personnel mapping fails ambiguous identities closed', mapping.includes("candidates.length === 1") && mapping.includes("mappingState: explicitAgent")],
  ['personnel mapping endpoint requires CRM management permission', routes.includes("requireCrmPermission('crm.manage')")],
  ['web screen respects source capabilities', screen.includes("conversation?.capabilities?.send === false") && screen.includes("selected.capabilities?.localWorkflow !== false")],
];

let failed = 0;
for (const [name, passed] of checks) {
  process.stdout.write(`${passed ? 'PASS' : 'FAIL'} ${name}\n`);
  if (!passed) failed += 1;
}

process.stdout.write(`SUMMARY: ${checks.length - failed}/${checks.length} PASS\n`);
if (failed) process.exitCode = 1;
