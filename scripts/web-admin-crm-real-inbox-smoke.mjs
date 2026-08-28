import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const source = fs.readFileSync(
  path.join(process.cwd(), 'apps', 'web-admin', 'src', 'modules', 'whatsapp-crm', 'WhatsappCrmInboxScreen.jsx'),
  'utf8',
);

const checks = [
  ['demo conversation dataset is removed', !source.includes('mockConversations') && !source.includes('Sara Al-Baghdadi')],
  ['API conversations are normalized without presentation fallback', !source.includes('...fallback') && source.includes("conversation.contactName || conversation.name || conversation.phone || 'Bilinmeyen WhatsApp kisisi'")],
  ['empty inbox has an explicit chat state', source.includes('function EmptyConversationPanel()') && source.includes('Bir konuşma seçin')],
  ['empty inbox has an explicit customer state', source.includes('function EmptyCustomerPanel()') && source.includes('Müşteri bilgisi bekleniyor')],
  ['active conversation can be null safely', source.includes('|| null;') && source.includes("activeId={activeConversation?.id || ''}")],
  ['decorative connection panel is removed', !source.includes('function ConnectionPanel({ conversations, health })')],
  ['customer assignment remains available', source.includes('aria-label="Temsilci sec"') && source.includes('assignWhatsappCrmConversation')],
  ['unmatched phone remains a CRM-only contact', source.includes('yalnızca CRM içinde takip edilir') && !source.includes('onCreateCustomer(activeConversation)')],
  ['resolved history is hidden from the default current inbox', source.includes("status: 'open', unreadOnly: false") && source.includes('<option value="resolved">Cozuldu</option>')],
  ['automatic refresh preserves the loaded conversation window', source.includes('loadedConversationLimitRef.current') && source.includes('limit: loadedConversationLimitRef.current') && source.includes('Number(nextOffset || 0) + incoming.length')],
];

let failed = 0;
for (const [label, passed] of checks) {
  if (!passed) failed += 1;
  console.log(`${passed ? 'PASS' : 'FAIL'} ${label}`);
}

console.log(`SUMMARY: ${checks.length - failed}/${checks.length} PASS`);
if (failed) process.exitCode = 1;
