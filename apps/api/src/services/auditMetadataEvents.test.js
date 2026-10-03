import test from 'node:test';
import assert from 'node:assert/strict';
import { changedFieldGroups, opaqueEntityRef, toAuditMetadataEvent, toAuditMetadataEvents, toVegaProductMetadataEvent } from './auditService.js';

test('metadata event exposes a stable opaque product reference without snapshots or values', () => {
  const event = toAuditMetadataEvent({
    id: 42,
    action: 'product_updated',
    entity_type: 'product',
    entity_id: 73,
    before_json: JSON.stringify({ brand: 'OLD', productName: 'Product', salePrice: 10 }),
    after_json: JSON.stringify({ brand: 'DEVOS-EVENT-TEST-1', productName: 'Product', salePrice: 12 }),
    created_at: '2026-08-28T12:00:00.000Z',
  });

  assert.deepEqual(event.changedFieldGroups, ['catalog', 'pricing']);
  assert.match(event.entityRef, /^PRODUCT-[A-F0-9]{16}$/);
  assert.equal(JSON.stringify(event).includes('DEVOS-EVENT-TEST-1'), false);
  assert.equal(JSON.stringify(event).includes('salePrice'), false);
  assert.equal(event.entityRef, opaqueEntityRef('product', 73));
});

test('metadata field groups contain no raw field names or values', () => {
  assert.deepEqual(
    changedFieldGroups('product', { productName: 'A', stockQuantity: 1 }, { productName: 'B', stockQuantity: 2 }),
    ['catalog', 'stock'],
  );
  assert.deepEqual(changedFieldGroups('unknown', { anything: 'A' }, { anything: 'B' }), []);
});

test('metadata event rejects unsupported actions and incomplete entity identity', () => {
  assert.equal(toAuditMetadataEvent({ id: 1, action: 'product_image_saved', entity_type: 'product', entity_id: 2 }), null);
  assert.equal(toAuditMetadataEvent({ id: 1, action: 'product_updated', entity_type: 'product', entity_id: null }), null);
});

test('bulk product metadata fans out only opaque per-product field groups', () => {
  const events = toAuditMetadataEvents({
    id: 88,
    action: 'products_bulk_updated',
    entity_type: 'product_bulk_update',
    entity_id: null,
    before_json: JSON.stringify({ rows: [{ id: 17, brand: 'OLD' }, { id: 9, productName: 'Old name' }] }),
    after_json: JSON.stringify({ rows: [{ id: 17, brand: 'DEVOS-EVENT-TEST-2' }, { id: 9, productName: 'New name' }] }),
    created_at: '2026-08-28T12:00:00.000Z',
  });

  assert.equal(events.length, 2);
  assert.deepEqual(events.map((event) => event.sourceEventId), ['audit-log:88:item:1', 'audit-log:88:item:2']);
  assert.deepEqual(events.map((event) => event.changedFieldGroups), [['catalog'], ['catalog']]);
  assert.equal(JSON.stringify(events).includes('DEVOS-EVENT-TEST-2'), false);
  assert.equal(JSON.stringify(events).includes('New name'), false);
});

test('Vega product metadata exposes only opaque grouped state fingerprints', () => {
  const event = toVegaProductMetadataEvent({ source_id: 161165, stock_code: '069 PAKEL', product_name: 'Product', brand: 'DEVOS-EVENT-TEST-2', status_code: 1 });
  assert.match(event.entityRef, /^VEGA_PRODUCT-[A-F0-9]{16}$/);
  assert.deepEqual(Object.keys(event.groupFingerprints).sort(), ['catalog', 'identity', 'pricing', 'status', 'stock']);
  assert.match(event.stateFingerprint, /^[A-F0-9]{32}$/);
  assert.equal(JSON.stringify(event).includes('DEVOS-EVENT-TEST-2'), false);
  assert.equal(JSON.stringify(event).includes('069 PAKEL'), false);
});
