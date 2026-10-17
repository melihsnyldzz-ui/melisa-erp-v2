import {createHash} from 'node:crypto';

export const TEST_SUPPLIER_CONTACT_ID = '13373';
export const supplierContactError = (code, message, statusCode = 400) => Object.assign(new Error(message), {code, message, statusCode});
const invalid = () => supplierContactError('TEST_SUPPLIER_CONTACT_INVALID', 'Telefon, şehir ve ülke bilgilerini kontrol edin.');
export function assertSupplierContactActor(actor) {
  if (String(actor?.id) !== '16' || !Array.isArray(actor.permissions)
      || !actor.permissions.includes('supplier.view') || !actor.permissions.includes('supplier.edit')) {
    throw supplierContactError('TEST_SUPPLIER_CONTACT_FORBIDDEN', 'Bu sentetik tedarikçi düzenlemesi için yetkiniz yok.', 403);
  }
}
export function assertSupplierContactId(id) {
  if (String(id) !== TEST_SUPPLIER_CONTACT_ID) throw supplierContactError('TEST_SUPPLIER_CONTACT_SCOPE', 'Yalnız ayrılmış TEST tedarikçisi düzenlenebilir.', 403);
}
export function parseSupplierContact(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)
      || Object.keys(body).length !== 5 || Object.keys(body).some(key => !['requestId', 'expectedRevision', 'phone', 'city', 'country'].includes(key))) throw invalid();
  if (typeof body.requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId)
      || typeof body.expectedRevision !== 'string' || !/^[a-f0-9]{64}$/i.test(body.expectedRevision)) throw invalid();
  for (const [key, max] of [['phone', 40], ['city', 100], ['country', 100]]) {
    const value = body[key];
    if (value !== null && (typeof value !== 'string' || value.length > max || /[\u0000-\u001f\u007f]/.test(value))) throw invalid();
  }
  const input = {requestId: body.requestId.toLowerCase(), expectedRevision: body.expectedRevision.toUpperCase(), phone: body.phone, city: body.city, country: body.country};
  const payloadJson = JSON.stringify({supplierId: TEST_SUPPLIER_CONTACT_ID, ...input});
  return {...input, payloadJson, payloadHash: createHash('sha256').update(payloadJson, 'utf16le').digest('hex').toUpperCase()};
}
export function supplierContactContext(raw) {
  if (!raw || raw.fixture?.id !== TEST_SUPPLIER_CONTACT_ID || raw.fixture.synthetic !== true || raw.fixture.currency !== 'TRY'
      || typeof raw.fixture.supplierCode !== 'string' || !raw.fixture.supplierCode || typeof raw.fixture.supplierName !== 'string' || !raw.fixture.supplierName
      || typeof raw.revision !== 'string' || !/^[A-F0-9]{64}$/.test(raw.revision) || !raw.contact
      || ['phone', 'city', 'country'].some(key => raw.contact[key] !== null && typeof raw.contact[key] !== 'string')) {
    throw supplierContactError('TEST_SUPPLIER_CONTACT_UNAVAILABLE', 'TEST tedarikçi iletişim kanıtı okunamıyor.', 503);
  }
  return {fixture: {id: raw.fixture.id, supplierCode: raw.fixture.supplierCode, supplierName: raw.fixture.supplierName, currency: 'TRY', synthetic: true},
    contact: {phone: raw.contact.phone, city: raw.contact.city, country: raw.contact.country}, revision: raw.revision};
}
