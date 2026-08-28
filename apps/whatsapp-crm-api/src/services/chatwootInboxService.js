import { env } from '../config/env.js';
import { resolvePhoneIdentity } from '../utils/phoneIdentity.js';
import { chatwootApiRequest } from './chatwootApiService.js';

const CHATWOOT_PAGE_SIZE = 25;
const CHATWOOT_MAX_OVERVIEW_LIMIT = CHATWOOT_PAGE_SIZE * 20;

function isChatwootSendEnabled() {
  if (!['chatwoot', 'evolution'].includes(env.whatsapp.provider) || !env.whatsapp.sendEnabled) return false;

  const providerConfigured = env.whatsapp.provider === 'chatwoot'
    ? Boolean(env.chatwoot.baseUrl && env.chatwoot.accountId && env.chatwoot.apiAccessToken)
    : Boolean(env.evolution.apiUrl && env.evolution.apiKey && env.evolution.instance);
  if (!providerConfigured) return false;

  return env.whatsapp.testNumberOnly
    ? env.whatsapp.allowedTestNumbers.length > 0
    : env.whatsapp.liveSendApproved;
}

function toIsoDate(value) {
  if (!value) return null;
  const numericValue = Number(value);
  const date = Number.isFinite(numericValue) ? new Date(numericValue * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function messageType(message) {
  const attachment = message?.attachments?.[0];
  if (attachment?.file_type === 'image') return 'image';
  if (attachment?.file_type === 'video') return 'video';
  if (attachment?.file_type === 'audio') return 'audio';
  if (attachment) return 'file';
  return 'text';
}

function mapMessage(message) {
  const attachment = message?.attachments?.[0] || {};
  return {
    id: message.id,
    direction: Number(message.message_type) === 1 ? 'out' : 'in',
    type: messageType(message),
    text: message.content || '',
    imageUrl: attachment.file_type === 'image' ? (attachment.data_url || attachment.thumb_url || '') : '',
    mediaUrl: attachment.data_url || '',
    thumbnailUrl: attachment.thumb_url || '',
    mimeType: attachment.content_type || '',
    fileName: attachment.file_name || '',
    fileSize: attachment.file_size || '',
    time: toIsoDate(message.created_at)
      ? new Date(toIsoDate(message.created_at)).toLocaleTimeString('tr-TR', {
        hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul',
      })
      : '',
    status: message.status || 'sent',
    received_at: toIsoDate(message.created_at),
  };
}

async function readMessages(conversation) {
  const response = await chatwootApiRequest(`/conversations/${conversation.id}/messages`);
  const rows = response?.payload || [];
  const workflow = rows
    .filter((message) => message.private && message.content_attributes?.melisa_crm)
    .map((message) => ({ id: message.id, ...message.content_attributes.melisa_crm }));
  return {
    messages: rows
      .filter((message) => !message.private && (Number(message.message_type) === 0 || Number(message.message_type) === 1))
      .slice(-20)
      .map(mapMessage),
    workflow,
  };
}

function workflowModel(entries = []) {
  const notes = entries.filter((item) => item.type === 'note').map((item) => item.data?.note).filter(Boolean);
  return {
    notes: notes.join('\n'),
    tasks: entries.filter((item) => item.type === 'task').map((item) => ({ id: item.id, ...item.data })),
    productInterests: entries.filter((item) => item.type === 'product').map((item) => ({ eventId: item.id, ...item.data?.product })),
    quotes: entries.filter((item) => item.type === 'quote').map((item) => ({ id: item.id, ...item.data?.quote, createdAt: item.createdAt })),
  };
}

function isGroupConversation(conversation) {
  const sender = conversation?.meta?.sender || {};
  return String(sender.identifier || '').toLowerCase().endsWith('@g.us')
    || String(sender.name || '').toLocaleUpperCase('tr-TR').includes('(GROUP)');
}

async function readAllConversationPages() {
  const conversations = [];
  let page = 1;
  let reportedTotal = 0;

  while (page <= 20) {
    const response = await chatwootApiRequest(`/conversations?status=all&page=${page}`);
    const rows = response?.data?.payload || [];
    reportedTotal = Number(response?.data?.meta?.all_count || reportedTotal || rows.length);
    conversations.push(...rows);

    if (rows.length < CHATWOOT_PAGE_SIZE || conversations.length >= reportedTotal) break;
    page += 1;
  }

  return conversations;
}

function erpUserIdForAgent(agentId) {
  const entry = [...env.chatwoot.agentPersonnelMap.entries()]
    .find(([, mappedAgentId]) => Number(mappedAgentId) === Number(agentId));
  return entry?.[0] || null;
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

export async function listChatwootInboxOverview({ limit = 25, offset = 0 } = {}) {
  const sendEnabled = isChatwootSendEnabled();
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const safeLimit = Math.min(Math.max(Number(limit) || CHATWOOT_PAGE_SIZE, 1), CHATWOOT_MAX_OVERVIEW_LIMIT);
  const allRows = await readAllConversationPages();
  const inboxRows = env.chatwoot.inboxId
    ? allRows.filter((conversation) => Number(conversation.inbox_id) === Number(env.chatwoot.inboxId))
    : allRows;
  const visibleRows = env.chatwoot.includeGroups
    ? inboxRows
    : inboxRows.filter((conversation) => !isGroupConversation(conversation));
  const rows = visibleRows.slice(safeOffset, safeOffset + safeLimit);
  const messagesByConversation = await mapWithConcurrency(rows, 5, readMessages);
  const total = visibleRows.length;

  const conversations = rows.map((conversation, rowIndex) => {
    const sender = conversation.meta?.sender || {};
    const assignee = conversation.meta?.assignee || null;
    const phone = sender.phone_number || '';
    const messageData = messagesByConversation[rowIndex] || { messages: [], workflow: [] };
    const messages = messageData.messages;
    const workflow = workflowModel(messageData.workflow);

    return {
      id: conversation.id,
      sourceId: conversation.id,
      source: 'chatwoot',
      status: conversation.status || 'open',
      assignedUserId: erpUserIdForAgent(assignee?.id),
      assignedUserName: assignee?.available_name || assignee?.name || '',
      chatwootAgentId: assignee?.id || null,
      teamName: conversation.meta?.team?.name || '',
      stage: conversation.custom_attributes?.melisa_stage || 'Yeni',
      contactName: sender.name || phone || sender.identifier || `Chatwoot ${conversation.id}`,
      displayName: sender.name || null,
      profilePictureUrl: sender.thumbnail || '',
      phone,
      phoneIdentity: resolvePhoneIdentity(phone),
      tags: conversation.labels || [],
      notes: workflow.notes,
      tasks: workflow.tasks,
      productInterests: workflow.productInterests,
      quotes: workflow.quotes,
      provider: 'chatwoot',
      instanceKey: `chatwoot-inbox-${conversation.inbox_id}`,
      remoteJid: sender.identifier || '',
      unread: Number(conversation.unread_count || 0),
      lastMessageAt: toIsoDate(conversation.last_activity_at || conversation.timestamp || conversation.updated_at),
      messages,
      capabilities: {
        read: true,
        send: sendEnabled,
        assign: env.chatwoot.agentPersonnelMap.size > 0,
        updateStatus: true,
        localWorkflow: true,
      },
    };
  });

  return {
    conversations,
    summary: {
      total,
      open: visibleRows.filter((item) => item.status === 'open').length,
      unread: visibleRows.reduce((sum, item) => sum + Number(item.unread_count || 0), 0),
      pendingHumanReply: conversations.filter((item) => item.status === 'open' && item.messages.at(-1)?.direction === 'in').length,
      source: 'chatwoot-crm',
    },
    pagination: {
      limit: safeLimit,
      offset: safeOffset,
      hasNext: safeOffset + conversations.length < total,
      nextOffset: safeOffset + conversations.length < total ? safeOffset + conversations.length : null,
      total,
    },
    capabilities: {
      read: true,
      send: sendEnabled,
      assign: env.chatwoot.agentPersonnelMap.size > 0,
      updateStatus: true,
      localWorkflow: true,
    },
    boundaries: [
      sendEnabled
        ? `Message sending is enabled through the guarded ${env.whatsapp.provider} outbound provider.`
        : 'Chatwoot message sending is disabled until the guarded send configuration is approved.',
      env.chatwoot.includeGroups ? 'Chatwoot group conversations are visible.' : 'Chatwoot group conversations are hidden from the customer inbox.',
      env.chatwoot.agentPersonnelMap.size > 0
        ? 'Chatwoot assignment is enabled only for explicitly mapped ERP personnel.'
        : 'Chatwoot assignment is disabled until ERP personnel are explicitly mapped.',
      'CRM stage, note, task, tag, product interest and quote data are persisted in Chatwoot without creating an ERP customer.',
      'ERP stock, finance and order mutations remain owned by the ERP API.',
    ],
  };
}
