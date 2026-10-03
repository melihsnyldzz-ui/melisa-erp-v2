import { normalizeSearchText } from '../../utils/searchText.js';

const key = value => String(value);
const validId = value => Number.isSafeInteger(Number(value)) && Number(value) > 0;
const sortedIds = values => [...values].map(Number).sort((a, b) => a - b);
const sameIds = (a, b) => JSON.stringify(sortedIds(a)) === JSON.stringify(sortedIds(b));

export function emptyRouteAssignmentDraft() {
  return { customers: {}, devices: {} };
}

export function validateCustomerRouteSnapshot(data) {
  const invalid = () => { throw new Error('Rota listesi eksik veya tutarsız geldi. Güncel durumu yeniden okuyun.'); };
  if (!data || typeof data.revision !== 'string' || !/^[a-f0-9]{64}$/i.test(data.revision)) invalid();
  for (const field of ['routes', 'customers', 'devices', 'customerAssignments', 'deviceAssignments']) {
    if (!Array.isArray(data[field])) invalid();
  }
  const ids = {};
  for (const field of ['routes', 'customers', 'devices']) {
    ids[field] = new Set();
    for (const row of data[field]) {
      if (!row || !validId(row.id) || ids[field].has(key(row.id))) invalid();
      ids[field].add(key(row.id));
    }
  }
  if (data.routes.some(route => typeof route.routeCode !== 'string' || !route.routeCode.trim()
    || typeof route.name !== 'string' || !route.name.trim() || typeof route.isActive !== 'boolean')) invalid();
  if (data.customers.some(customer => typeof customer.isCash !== 'boolean' || typeof customer.isAssignable !== 'boolean')) invalid();
  if (data.devices.some(device => typeof device.isActive !== 'boolean')) invalid();
  if (data.unassignableDevices !== undefined && (!Array.isArray(data.unassignableDevices)
    || data.unassignableDevices.some(device => !device || typeof device.legacyId !== 'string' || validId(device.legacyId)
      || typeof device.deviceCode !== 'string' || typeof device.deviceName !== 'string' || typeof device.isActive !== 'boolean'
      || device.reason !== 'LEGACY_INVALID_DEVICE_ID'))) invalid();
  const cashIds = new Set(data.customers.filter(customer => customer.isCash).map(customer => key(customer.id)));
  const seenCustomers = new Set();
  for (const row of data.customerAssignments) {
    if (!ids.customers.has(key(row.customerId)) || seenCustomers.has(key(row.customerId)) || cashIds.has(key(row.customerId))
      || (row.routeId !== null && !ids.routes.has(key(row.routeId)))) invalid();
    seenCustomers.add(key(row.customerId));
  }
  const seenDevices = new Set();
  for (const row of data.deviceAssignments) {
    if (!ids.devices.has(key(row.deviceId)) || seenDevices.has(key(row.deviceId)) || !Array.isArray(row.routeIds)
      || new Set(row.routeIds.map(key)).size !== row.routeIds.length || row.routeIds.some(id => !ids.routes.has(key(id)))) invalid();
    seenDevices.add(key(row.deviceId));
  }
  return data;
}

export function customerRouteId(snapshot, customerId, draft = emptyRouteAssignmentDraft()) {
  return Object.hasOwn(draft.customers, key(customerId)) ? draft.customers[key(customerId)]
    : snapshot.customerAssignments.find(row => key(row.customerId) === key(customerId))?.routeId ?? null;
}

export function deviceRouteIds(snapshot, deviceId, draft = emptyRouteAssignmentDraft()) {
  return Object.hasOwn(draft.devices, key(deviceId)) ? draft.devices[key(deviceId)]
    : snapshot.deviceAssignments.find(row => key(row.deviceId) === key(deviceId))?.routeIds ?? [];
}

export function setCustomerRouteDraft(draft, customerId, routeId) {
  return { ...draft, customers: { ...draft.customers, [key(customerId)]: routeId === '' || routeId === null ? null : Number(routeId) } };
}

export function toggleDeviceRouteDraft(snapshot, draft, deviceId, routeId, checked) {
  const selected = new Set(deviceRouteIds(snapshot, deviceId, draft).map(Number));
  if (checked) selected.add(Number(routeId)); else selected.delete(Number(routeId));
  return { ...draft, devices: { ...draft.devices, [key(deviceId)]: sortedIds([...selected]) } };
}

// Send only edited entities. Filtering the visible table never clears hidden assignments.
export function buildRouteAssignmentChanges(snapshot, draft) {
  const customerAssignments = [];
  const deviceAssignments = [];
  for (const [customerId, routeId] of Object.entries(draft.customers)) {
    const customer = snapshot.customers.find(row => key(row.id) === customerId);
    if (!customer || customer.isCash) throw new Error('Peşin veya artık listede bulunmayan cari rotaya atanamaz.');
    const before = customerRouteId(snapshot, customerId);
    if (key(before) === key(routeId)) continue;
    if (routeId !== null && (!customer.isAssignable || !snapshot.routes.some(route => key(route.id) === key(routeId) && route.isActive))) {
      throw new Error('Müşteri için seçilen rota artık aktif değil. Seçimi düzeltin.');
    }
    customerAssignments.push({ customerId: Number(customerId), routeId });
  }
  for (const [deviceId, routeIds] of Object.entries(draft.devices)) {
    const device = snapshot.devices.find(row => key(row.id) === deviceId);
    if (!device) throw new Error('Seçilen cihaz artık listede yok.');
    const before = deviceRouteIds(snapshot, deviceId);
    if (sameIds(before, routeIds)) continue;
    if ((routeIds.length && !device.isActive) || routeIds.some(id => !snapshot.routes.some(route => key(route.id) === key(id) && route.isActive))) {
      throw new Error('Cihaz için seçilen rota artık aktif değil. Seçimi düzeltin.');
    }
    deviceAssignments.push({ deviceId: Number(deviceId), routeIds: sortedIds(routeIds) });
  }
  return { revision: snapshot.revision, customerAssignments, deviceAssignments };
}

// A refreshed snapshot removes only confirmed edits; unsaved choices remain intact.
export function pruneAppliedRouteDraft(snapshot, draft) {
  const next = emptyRouteAssignmentDraft();
  for (const [id, routeId] of Object.entries(draft.customers)) {
    if (key(customerRouteId(snapshot, id)) !== key(routeId)) next.customers[id] = routeId;
  }
  for (const [id, routeIds] of Object.entries(draft.devices)) {
    if (!sameIds(deviceRouteIds(snapshot, id), routeIds)) next.devices[id] = [...routeIds];
  }
  return next;
}

export function routeNameError(snapshot, name, routeId = null) {
  const value = String(name ?? '').trim();
  if (!value) return 'Rota adı girin.';
  if (value.length > 200) return 'Rota adı en fazla 200 karakter olabilir.';
  if (/[\u0000-\u001f\u007f]/.test(value)) return 'Rota adı kontrol karakteri içeremez.';
  return '';
}

export function routeCodeError(snapshot, code, routeId = null) {
  const value = String(code ?? '').trim().toLocaleUpperCase('tr-TR');
  if (!value || value.length > 80 || /[\u0000-\u001f\u007f]/.test(value)) return 'Rota kodu 1–80 karakter olmalı ve kontrol karakteri içermemeli.';
  if (snapshot.routes.some(route => key(route.id) !== key(routeId) && normalizeSearchText(route.routeCode) === normalizeSearchText(value))) {
    return 'Bu kodla bir rota var. Mevcut rotayı seçin.';
  }
  return '';
}

export function routeWriteFailureKind(error) {
  if (['TERMINAL_ROUTE_CODE_EXISTS', 'TERMINAL_ROUTE_SCHEMA_REQUIRED', 'TERMINAL_ROUTE_LOCK_UNAVAILABLE', 'TERMINAL_ROUTE_DEVICE_REFERENCE_INVALID'].includes(error?.code)) return 'rejected';
  if (error?.status === 409) return 'stale';
  if ([400, 401, 403, 404, 422].includes(error?.status)) return 'rejected';
  return 'uncertain';
}

export function customerRouteStatusLabel(customer) {
  if (customer.isAssignable) return '';
  if (customer.isCash) return 'Peşin';
  if (customer.isDeleted) return 'Silinmiş';
  if (!['TRY', 'USD', 'EUR'].includes(String(customer.currency ?? '').trim().toUpperCase())) {
    return 'Native bu dövizi desteklemiyor';
  }
  return customer.isActive === false ? 'Pasif' : 'Rotaya atanamaz';
}
