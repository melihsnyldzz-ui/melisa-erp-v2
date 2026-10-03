import { validRecordId } from './screenDeepLink.js';

const invoiceKey = { 'purchase-invoice': 'purchaseDraftId', 'sales-invoice': 'salesDraftId' };
let instanceSequence = 0;
export function nextWorkspaceTabInstanceId() { return `tab-instance-${++instanceSequence}`; }

export function bindSavedInvoiceToTab(tabs, tabId, instanceId, record, screenRegistry) {
  const current = tabs.find((tab) => tab.id === tabId && tab.instanceId === instanceId);
  if (!current) return tabs; // A late response must not bind to a closed/reopened tab.
  const screenId = current.screenId ?? current.id;
  const key = invoiceKey[screenId];
  if (!key) return tabs;
  const payload = { ...(current.payload || {}) };
  const baseLabel = screenRegistry[screenId]?.label || (screenId === 'sales-invoice' ? 'Satış Fişi' : 'Alış Fişi');
  let label = baseLabel;
  if (record === null) {
    delete payload[key];
    delete payload.invoiceNo;
    delete payload.documentNo;
  } else {
    const id = validRecordId(record?.id);
    if (!id) return tabs;
    const previousId = validRecordId(payload[key]);
    if (previousId && previousId !== id) return tabs;
    payload[key] = id;
    const documentNo = typeof record.documentNo === 'string' ? record.documentNo.trim() : '';
    if (documentNo) payload.invoiceNo = documentNo;
    label = `${baseLabel}: ${documentNo || `#${id}`}`;
  }
  return tabs.map((tab) => tab === current ? { ...tab, payload, label } : tab);
}

export function findMatchingInvoiceTab(tabs, candidate) {
  const screenId = candidate.screenId ?? candidate.id;
  const key = invoiceKey[screenId];
  const id = key ? validRecordId(candidate.payload?.[key]) : null;
  if (!id) return null;
  return tabs.find((tab) => (tab.screenId ?? tab.id) === screenId && validRecordId(tab.payload?.[key]) === id) || null;
}

export function resolveInvoiceTabOpen(tabs, candidate) {
  const screenId = candidate.screenId ?? candidate.id;
  const key = invoiceKey[screenId];
  if (!key) return { tab: candidate, existingTab: null };
  const savedId = validRecordId(candidate.payload?.[key]);
  const partyKey = screenId === 'sales-invoice' ? 'customerId' : 'supplierId';
  const partyId = candidate.payload?.[partyKey];
  const existingTab = savedId
    ? findMatchingInvoiceTab(tabs, candidate)
    : tabs.find((tab) => (tab.screenId ?? tab.id) === screenId && !validRecordId(tab.payload?.[key])
      && (!partyId || String(tab.payload?.[partyKey] ?? '') === String(partyId))) || null;
  if (existingTab) return { tab: candidate, existingTab };
  // Stable IDs survive save/reset. A new request must not reuse that ID when
  // its current tab now represents a different saved or unsaved invoice.
  const tab = tabs.some((current) => current.id === candidate.id)
    ? { ...candidate, id: `${candidate.id}:${candidate.instanceId}` }
    : candidate;
  return { tab, existingTab: null };
}
