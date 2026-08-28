import { useCallback, useEffect, useMemo, useState } from 'react';
import { getWhatsappCrmHealth, getWhatsappCrmInbox } from '../../services/whatsappCrmApi.js';

export function countryFlag(code = '') {
  const normalized = String(code || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return '🏳️';
  return [...normalized].map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0))).join('');
}

export function contactInitials(name = '', phone = '') {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length > 1) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  if (parts.length === 1 && !/^\d+$/.test(parts[0])) return parts[0].slice(0, 2).toUpperCase();
  return String(phone || '--').slice(-2).padStart(2, '-');
}

export function normalizeCrmConversation(row, index = 0) {
  const identity = row?.phoneIdentity || {};
  const messages = Array.isArray(row?.messages) ? row.messages : [];
  const lastMessage = messages[messages.length - 1] || {};
  const name = row?.contactName || row?.name || row?.phone || 'Bilinmeyen müşteri';
  const phone = row?.phone || '';
  const quotes = Array.isArray(row?.quotes) ? row.quotes : [];
  const tasks = Array.isArray(row?.tasks) ? row.tasks : [];
  return {
    id: String(row?.id || `crm-${index}`),
    name,
    phone,
    remoteJid: row?.remoteJid || '',
    avatar: contactInitials(name, phone),
    avatarUrl: row?.profilePictureUrl || row?.avatarUrl || '',
    country: identity.countryName || 'Bilinmiyor',
    countryCode: identity.countryCode || '',
    flag: identity.flag || countryFlag(identity.countryCode),
    language: identity.language || 'Bilinmiyor',
    owner: row?.assignedUserName || 'Atanmadı',
    assignedUserId: row?.assignedUserId || null,
    stage: row?.stage || 'Yeni',
    status: row?.status || 'open',
    unread: Number(row?.unread || 0),
    lastMessageAt: row?.lastMessageAt || '',
    preview: lastMessage.text || row?.lastMessagePreview || '[Mesaj]',
    messages,
    tags: Array.isArray(row?.tags) ? row.tags : [],
    notes: row?.notes || '',
    tasks,
    quotes,
    products: Array.isArray(row?.productInterests) ? row.productInterests : [],
    capabilities: row?.capabilities || {},
  };
}

function parseInbox(payload) {
  const rows = Array.isArray(payload?.conversations)
    ? payload.conversations
    : Array.isArray(payload?.items) ? payload.items : [];
  return rows.map(normalizeCrmConversation);
}

export function quoteTotal(conversation) {
  return (conversation?.quotes || []).reduce((sum, quote) => {
    const value = Number(quote?.grandTotal ?? quote?.total ?? quote?.amount ?? 0);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
}

export function formatCrmMoney(value, currency = 'TRY') {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: currency || 'TRY',
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatContactTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function useCrmWorkspaceData({ refreshMs = 15000 } = {}) {
  const [state, setState] = useState({
    loading: true,
    error: null,
    health: null,
    conversations: [],
    summary: { open: 0, unread: 0, pendingHumanReply: 0 },
  });

  const refresh = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setState((current) => ({ ...current, loading: true }));
    const [healthResult, inboxResult] = await Promise.allSettled([
      getWhatsappCrmHealth(),
      getWhatsappCrmInbox({ limit: 100, offset: 0 }),
    ]);
    const health = healthResult.status === 'fulfilled' ? healthResult.value?.data : null;
    const inbox = inboxResult.status === 'fulfilled' ? inboxResult.value?.data : null;
    const error = inboxResult.status === 'rejected'
      ? inboxResult.reason
      : healthResult.status === 'rejected' ? healthResult.reason : null;
    setState((current) => ({
      loading: false,
      error,
      health: health || current.health,
      conversations: inbox ? parseInbox(inbox) : current.conversations,
      summary: inbox?.summary || current.summary,
    }));
  }, []);

  useEffect(() => {
    let active = true;
    refresh();
    const timer = window.setInterval(() => {
      if (active) refresh({ quiet: true });
    }, refreshMs);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [refresh, refreshMs]);

  const metrics = useMemo(() => {
    const stages = {};
    let tasks = 0;
    let quotes = 0;
    state.conversations.forEach((conversation) => {
      stages[conversation.stage] = (stages[conversation.stage] || 0) + 1;
      tasks += conversation.tasks.filter((task) => task.status !== 'done').length;
      quotes += conversation.quotes.length;
    });
    return {
      open: Number(state.summary?.open || 0),
      unread: Number(state.summary?.unread || 0),
      pending: Number(state.summary?.pendingHumanReply || 0),
      tasks,
      quotes,
      stages,
    };
  }, [state.conversations, state.summary]);

  return { ...state, metrics, refresh };
}
