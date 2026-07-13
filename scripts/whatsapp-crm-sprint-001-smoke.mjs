import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');

const checks = [];

function addCheck(name, ok, detail = '') {
  checks.push({ name, ok, detail });
}

function read(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

function exists(relativePath) {
  return existsSync(resolve(repoRoot, relativePath));
}

const requiredFiles = [
  'apps/whatsapp-crm-api/package.json',
  'apps/whatsapp-crm-api/.env.example',
  'apps/whatsapp-crm-api/src/app.js',
  'apps/whatsapp-crm-api/src/server.js',
  'apps/whatsapp-crm-api/src/middleware/auth.js',
  'apps/whatsapp-crm-api/src/middleware/webhookSecurity.js',
  'apps/whatsapp-crm-api/src/providers/whatsappProvider.js',
  'apps/whatsapp-crm-api/src/providers/evolutionProvider.js',
  'apps/whatsapp-crm-api/src/routes/webhookRoutes.js',
  'apps/whatsapp-crm-api/src/services/db.js',
  'apps/whatsapp-crm-api/src/services/idempotencyStore.js',
  'apps/whatsapp-crm-api/infra/postgres/001_initial_schema.sql',
  'apps/whatsapp-crm-api/src/repositories/crmRepository.js',
  'apps/web-admin/src/modules/whatsapp-crm/WhatsappCrmInboxScreen.jsx',
  'apps/web-admin/src/services/whatsappCrmApi.js',
  'docker-compose.whatsapp-crm.yml',
  'docs/erp-v2/whatsapp-crm-architecture.md',
  'docs/erp-v2/whatsapp-crm-sprint-001-report.md',
];

for (const file of requiredFiles) {
  addCheck(`required file exists: ${file}`, exists(file));
}

const envExample = read('apps/whatsapp-crm-api/.env.example');
addCheck('send disabled by default', envExample.includes('WHATSAPP_SEND_ENABLED=false'));
addCheck('test number mode enabled by default', envExample.includes('WHATSAPP_TEST_NUMBER_ONLY=true'));
addCheck('webhook secret is placeholder only', envExample.includes('WHATSAPP_CRM_WEBHOOK_SECRET='));
addCheck('Evolution API key is placeholder only', envExample.includes('EVOLUTION_API_KEY='));

const authSource = read('apps/whatsapp-crm-api/src/middleware/auth.js');
addCheck('CRM auth verifies bearer token', authSource.includes('jwt.verify') && authSource.includes('Bearer'));
addCheck('CRM auth delegates to ERP auth/me', authSource.includes('/api/auth/me'));
addCheck('CRM permission middleware exists', authSource.includes('requireCrmPermission'));

const webhookSecuritySource = read('apps/whatsapp-crm-api/src/middleware/webhookSecurity.js');
addCheck('webhook secret is required', webhookSecuritySource.includes('WHATSAPP_CRM_WEBHOOK_SECRET') || webhookSecuritySource.includes('env.webhookSecret'));
addCheck('webhook uses timing-safe comparison', webhookSecuritySource.includes('timingSafeEqual'));

const webhookRoutesSource = read('apps/whatsapp-crm-api/src/routes/webhookRoutes.js');
addCheck('Evolution webhook route exists', webhookRoutesSource.includes('/evolution'));
addCheck('Evolution webhook route has security middleware', webhookRoutesSource.includes('requireWebhookSecret'));

const webhookControllerSource = read('apps/whatsapp-crm-api/src/controllers/webhookController.js');
addCheck('webhook persists normalized event', webhookControllerSource.includes('persistWebhookEvent'));
addCheck('webhook reports postgres persistence', webhookControllerSource.includes("persistence: 'postgres'"));

const idempotencySource = read('apps/whatsapp-crm-api/src/services/idempotencyStore.js');
addCheck('idempotency store exposes markEventOnce', idempotencySource.includes('markEventOnce'));

const dbSource = read('apps/whatsapp-crm-api/src/services/db.js');
addCheck('PostgreSQL service uses pg Pool', dbSource.includes('new pg.Pool'));
addCheck('PostgreSQL service fails closed when not configured', dbSource.includes('WHATSAPP_CRM_POSTGRES_NOT_CONFIGURED'));

const repositorySource = read('apps/whatsapp-crm-api/src/repositories/crmRepository.js');
addCheck('repository persists webhook events', repositorySource.includes('persistWebhookEvent'));
addCheck('repository upserts contacts', repositorySource.includes('upsertContact'));
addCheck('repository upserts conversations', repositorySource.includes('upsertConversation'));
addCheck('repository lists inbox overview', repositorySource.includes('listInboxOverview'));

const providerInterfaceSource = read('apps/whatsapp-crm-api/src/providers/whatsappProvider.js');
addCheck('provider interface defines normalizeWebhook', providerInterfaceSource.includes('normalizeWebhook'));
addCheck('provider interface does not send messages in Sprint 001', providerInterfaceSource.includes('sendMessage') && providerInterfaceSource.includes('not implemented'));

const evolutionProviderSource = read('apps/whatsapp-crm-api/src/providers/evolutionProvider.js');
addCheck('Evolution provider normalizes event id', evolutionProviderSource.includes('eventId'));
addCheck('Evolution provider normalizes message text', evolutionProviderSource.includes('text'));

const schemaSource = read('apps/whatsapp-crm-api/infra/postgres/001_initial_schema.sql');
for (const table of ['crm_instances', 'crm_contacts', 'crm_conversations', 'crm_messages', 'crm_attachments', 'crm_events']) {
  addCheck(`schema contains ${table}`, schemaSource.includes(table));
}
addCheck('schema has unique conversation per instance/contact', schemaSource.includes('idx_crm_conversations_instance_contact'));

const inboxControllerSource = read('apps/whatsapp-crm-api/src/controllers/inboxController.js');
addCheck('inbox controller is async read model', inboxControllerSource.includes('await getInboxOverview'));

const permissionCatalogSource = read('apps/api/src/services/permissionCatalog.js');
addCheck('ERP permission catalog has crm.view', permissionCatalogSource.includes('crm.view'));
addCheck('ERP permission catalog has crm.manage', permissionCatalogSource.includes('crm.manage'));

const workspaceSource = read('apps/web-admin/src/components/workspace/Workspace.jsx');
addCheck('Workspace imports WhatsApp CRM screen', workspaceSource.includes('WhatsappCrmInboxScreen'));
addCheck('Workspace route requires crm.view', workspaceSource.includes('whatsapp-crm-inbox') && workspaceSource.includes('crm.view'));

const navigationSource = read('apps/web-admin/src/data/mockNavigationData.js');
addCheck('top module includes WhatsApp CRM', navigationSource.includes("screenId: 'whatsapp-crm-inbox'"));
addCheck('screenRegistry includes WhatsApp CRM inbox', navigationSource.includes("'whatsapp-crm-inbox':"));

const sidebarSource = read('apps/web-admin/src/components/navigation/Sidebar.jsx');
addCheck('Sidebar displays WhatsApp CRM inbox', sidebarSource.includes("'whatsapp-crm-inbox': 'WhatsApp CRM Gelen Kutusu'"));
addCheck('Sidebar uses MessageCircle icon', sidebarSource.includes('MessageCircle'));

const topMenuSource = read('apps/web-admin/src/components/navigation/TopMenu.jsx');
addCheck('TopMenu icon map includes WhatsApp CRM', topMenuSource.includes("'WhatsApp CRM': MessageCircle"));

const webEnvSource = read('apps/web-admin/.env.example');
addCheck('web-admin env exposes CRM API base URL', webEnvSource.includes('VITE_WHATSAPP_CRM_API_BASE_URL'));

const composeSource = read('docker-compose.whatsapp-crm.yml');
for (const service of ['whatsapp-crm-postgres', 'whatsapp-crm-redis', 'evolution-api']) {
  addCheck(`compose contains ${service}`, composeSource.includes(`${service}:`));
}
addCheck('compose webhook points to local CRM API', composeSource.includes('/webhooks/evolution'));

const docsIndexSource = read('docs/erp-v2/README.md');
addCheck('docs index links architecture', docsIndexSource.includes('whatsapp-crm-architecture.md'));
addCheck('docs index links sprint report', docsIndexSource.includes('whatsapp-crm-sprint-001-report.md'));

const failures = checks.filter((check) => !check.ok);

for (const check of checks) {
  const prefix = check.ok ? 'PASS' : 'FAIL';
  console.log(`${prefix} ${check.name}${check.detail ? ` - ${check.detail}` : ''}`);
}

if (failures.length > 0) {
  console.error(`\nWhatsApp CRM Sprint 001 smoke failed: ${failures.length} failing checks.`);
  process.exit(1);
}

console.log(`\nWhatsApp CRM Sprint 001 smoke passed: ${checks.length} checks.`);
