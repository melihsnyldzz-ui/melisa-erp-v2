import { isPostgresConfigured, query, transaction } from '../services/db.js';

function toNullable(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function getContactName(event) {
  return event.rawPayload?.data?.pushName
    || event.rawPayload?.pushName
    || event.rawPayload?.data?.name
    || event.phone
    || null;
}

function mapMessageDirection(direction) {
  return direction === 'outbound' ? 'out' : 'in';
}

async function ensureInstance(client, event) {
  const result = await client.query(`
    INSERT INTO crm_instances (provider, instance_key, display_name, status)
    VALUES ($1, $2, $3, 'connected')
    ON CONFLICT (instance_key)
    DO UPDATE SET
      provider = EXCLUDED.provider,
      display_name = COALESCE(NULLIF(EXCLUDED.display_name, ''), crm_instances.display_name),
      status = 'connected',
      updated_at = NOW()
    RETURNING id
  `, [event.provider, event.instanceKey, event.instanceKey]);

  return result.rows[0].id;
}

async function upsertContact(client, event) {
  if (!event.phone) return null;

  const result = await client.query(`
    INSERT INTO crm_contacts (provider, phone, display_name)
    VALUES ($1, $2, $3)
    ON CONFLICT (provider, phone)
    DO UPDATE SET
      display_name = COALESCE(EXCLUDED.display_name, crm_contacts.display_name),
      updated_at = NOW()
    RETURNING id
  `, [event.provider, event.phone, getContactName(event)]);

  return result.rows[0].id;
}

async function upsertConversation(client, { instanceId, contactId, event }) {
  if (!contactId) return null;

  const unreadIncrement = event.direction === 'inbound' ? 1 : 0;

  const result = await client.query(`
    INSERT INTO crm_conversations (instance_id, contact_id, status, last_message_at, unread_count)
    VALUES ($1, $2, 'open', $3, $4)
    ON CONFLICT (instance_id, contact_id) WHERE contact_id IS NOT NULL
    DO UPDATE SET
      last_message_at = GREATEST(
        COALESCE(crm_conversations.last_message_at, EXCLUDED.last_message_at),
        EXCLUDED.last_message_at
      ),
      unread_count = crm_conversations.unread_count + $4,
      updated_at = NOW()
    RETURNING id
  `, [instanceId, contactId, event.receivedAt, unreadIncrement]);

  return result.rows[0].id;
}

async function insertEvent(client, event) {
  const result = await client.query(`
    INSERT INTO crm_events (provider, event_id, event_type, instance_key, payload)
    VALUES ($1, $2, $3, $4, $5::jsonb)
    ON CONFLICT (provider, event_id) DO NOTHING
    RETURNING id
  `, [
    event.provider,
    event.eventId,
    event.eventType,
    event.instanceKey,
    JSON.stringify(event.rawPayload || {}),
  ]);

  return result.rows[0]?.id || null;
}

async function insertMessage(client, { conversationId, event }) {
  if (!conversationId || (!event.messageId && !event.text)) return null;

  const result = await client.query(`
    INSERT INTO crm_messages (
      conversation_id,
      provider,
      provider_message_id,
      direction,
      message_type,
      body,
      status,
      raw_payload,
      received_at
    )
    VALUES ($1, $2, $3, $4, 'text', $5, $6, $7::jsonb, $8)
    ON CONFLICT (provider, provider_message_id)
    DO UPDATE SET
      conversation_id = EXCLUDED.conversation_id,
      body = COALESCE(EXCLUDED.body, crm_messages.body),
      raw_payload = EXCLUDED.raw_payload
    RETURNING id
  `, [
    conversationId,
    event.provider,
    toNullable(event.messageId),
    event.direction,
    event.text || null,
    event.direction === 'outbound' ? 'sent' : 'received',
    JSON.stringify(event.rawPayload || {}),
    event.receivedAt,
  ]);

  return result.rows[0]?.id || null;
}

export async function persistWebhookEvent(event) {
  return transaction(async (client) => {
    const eventRowId = await insertEvent(client, event);

    if (!eventRowId) {
      return {
        duplicate: true,
        eventId: event.eventId,
      };
    }

    const instanceId = await ensureInstance(client, event);
    const contactId = await upsertContact(client, event);
    const conversationId = await upsertConversation(client, { instanceId, contactId, event });
    const messageId = await insertMessage(client, { conversationId, event });

    await client.query('UPDATE crm_events SET processed_at = NOW() WHERE id = $1', [eventRowId]);

    return {
      duplicate: false,
      eventId: event.eventId,
      instanceId,
      contactId,
      conversationId,
      messageId,
    };
  });
}

export async function persistOutboundMessage({ conversationId, providerResult }) {
  if (!conversationId) return null;

  const result = await transaction(async (client) => {
    const messageResult = await client.query(`
      INSERT INTO crm_messages (
        conversation_id,
        provider,
        provider_message_id,
        direction,
        message_type,
        body,
        status,
        raw_payload,
        received_at
      )
      VALUES ($1, $2, $3, 'outbound', 'text', $4, 'sent', $5::jsonb, $6)
      ON CONFLICT (provider, provider_message_id)
      DO UPDATE SET
        conversation_id = EXCLUDED.conversation_id,
        body = EXCLUDED.body,
        status = EXCLUDED.status,
        raw_payload = EXCLUDED.raw_payload
      RETURNING id, received_at
    `, [
      conversationId,
      providerResult.provider,
      toNullable(providerResult.providerMessageId),
      providerResult.text,
      JSON.stringify(providerResult.providerResponse || {}),
      providerResult.sentAt,
    ]);

    await client.query(`
      UPDATE crm_conversations
      SET
        last_message_at = GREATEST(COALESCE(last_message_at, $2), $2),
        updated_at = NOW()
      WHERE id = $1
    `, [conversationId, providerResult.sentAt]);

    return messageResult.rows[0] || null;
  });

  return result ? {
    id: result.id,
    direction: 'out',
    type: 'text',
    text: providerResult.text,
    time: new Date(result.received_at).toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Istanbul',
    }),
    status: 'sent',
    received_at: result.received_at,
  } : null;
}

export async function listInboxOverview({ limit = 100 } = {}) {
  if (!isPostgresConfigured()) {
    return {
      conversations: [],
      summary: {
        open: 0,
        unread: 0,
        pendingHumanReply: 0,
        source: 'postgres-disabled',
      },
      boundaries: [
        'PostgreSQL is not configured; inbox returns an empty safe read model.',
        'No WhatsApp send action exists in this endpoint.',
        'CRM still does not write directly to ERP stock, finance or order tables.',
      ],
    };
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const [summaryResult, conversationResult] = await Promise.all([
    query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'open')::int AS open,
        COALESCE(SUM(unread_count), 0)::int AS unread
      FROM crm_conversations
    `),
    query(`
      SELECT
        conversation.id,
        conversation.status,
        conversation.unread_count,
        conversation.last_message_at,
        contact.display_name,
        contact.phone,
        contact.tags,
        instance.provider,
        instance.instance_key,
        (
          SELECT COALESCE(
            message.raw_payload #>> '{data,key,remoteJid}',
            message.raw_payload #>> '{data,message,key,remoteJid}',
            message.raw_payload #>> '{key,remoteJid}',
            message.raw_payload #>> '{remoteJid}'
          )
          FROM crm_messages message
          WHERE message.conversation_id = conversation.id
          ORDER BY message.received_at DESC
          LIMIT 1
        ) AS remote_jid,
        COALESCE((
          SELECT json_agg(message_row ORDER BY message_row.received_at)
          FROM (
            SELECT
              message.id,
              CASE WHEN message.direction = 'outbound' THEN 'out' ELSE 'in' END AS direction,
              message.message_type AS type,
              message.body AS text,
              TO_CHAR(message.received_at AT TIME ZONE 'Europe/Istanbul', 'HH24:MI') AS time,
              message.status,
              message.received_at
            FROM crm_messages message
            WHERE message.conversation_id = conversation.id
            ORDER BY message.received_at DESC
            LIMIT 20
          ) message_row
        ), '[]'::json) AS messages
      FROM crm_conversations conversation
      LEFT JOIN crm_contacts contact ON contact.id = conversation.contact_id
      LEFT JOIN crm_instances instance ON instance.id = conversation.instance_id
      ORDER BY conversation.last_message_at DESC NULLS LAST, conversation.updated_at DESC
      LIMIT $1
    `, [safeLimit]),
  ]);

  const summary = summaryResult.rows[0] || { open: 0, unread: 0 };

  return {
    conversations: conversationResult.rows.map((row) => ({
      id: row.id,
      status: row.status,
      contactName: row.display_name,
      phone: row.phone,
      tags: row.tags || [],
      provider: row.provider,
      instanceKey: row.instance_key,
      remoteJid: row.remote_jid,
      unread: row.unread_count,
      lastMessageAt: row.last_message_at,
      messages: row.messages || [],
    })),
    summary: {
      open: summary.open || 0,
      unread: summary.unread || 0,
      pendingHumanReply: summary.unread || 0,
      source: 'postgres',
    },
    boundaries: [
      'Inbox is read-only.',
      'No real WhatsApp send action exists in this sprint.',
      'ERP stock, finance and order mutations remain owned by the ERP API.',
    ],
  };
}
