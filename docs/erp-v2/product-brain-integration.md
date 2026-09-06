# Product Brain ERP integration

Date: 2026-09-06

This change provides the ERP read contract and best-effort media notifications
for the approved local Product Brain pilot. Product Brain owns only derived
profiles and its local job queue. ERP remains the commercial source of truth.

## Commercial read contract

Both the normal Vega product DTO and Product Intelligence DTO obtain sale
currency exclusively from `F0102TBLBIRIMLEREX.PB1`, selected with the existing
default-unit/main-unit/identity ordering. Price and currency belong to the same
selected unit. Supported source values are USD/$/US$, EUR/€ and TRY/TL/₺.

The response includes `currency`, `currencyTrustState`, and `currencySource`.
Recognized sale currency has `TRUSTED` and `ERP_SALE_UNIT`; absent or unsupported
currency has `null`, `UNAVAILABLE`, and `null`. A numeric price alone is not a
verified quotation. Purchase currency must never complete sale currency.
Existing internal purchase currency and cost normalization are preserved.

Missing or invalid stock/reservation values remain `null`. Zero and negative
values remain visible. Product Intelligence returns `availableQuantity: null`
if either component is unknown, and does not clamp negative availability. Sales
callers must reject unknown or negative commercial quantities. Series factor
and price-per-series must not be inferred from the unit name or photo.

Product Intelligence retains its existing movement ranking. Product Brain
catalog discovery and direct follow-up identity reads use the normal Vega
product endpoint; that endpoint does not require recent sales movement.

## Media notification

`saveVegaProductImage` and `removeVegaProductImage` invoke the notifier only
after successful audit and transaction commit. Existing auth, permissions,
write guards and transaction behavior are retained. A rollback produces no
notification. Notification I/O is asynchronous and is never awaited by the
photo request. Failure is logged only as
`PRODUCT_BRAIN_HINT_DEFERRED_TO_RECONCILIATION`, without private response details.

The notifier is disabled by default. Enable with `PB_NOTIFIER_ENABLED=true`
in the actual ERP server process and set `PB_EVENT_KEY_PATH` to the same local
event-key file used by Product Brain. The fallback path is
`~/.melisa-ai/product-brain/event-key`. No secret value belongs in this document,
logs, source control or process command lines.

Notifications are signed and sent only to
`http://127.0.0.1:4324/internal/media-changed`. Their body contains event identity,
source identity and `MEDIA_CHANGED`; it contains no photo or commercial facts.
The deadline is 1200 ms and redirects are rejected. Repeated saves at the same
address create fresh events; the receiver re-reads ERP. Receiver reconciliation
repairs missed hints after unavailability or restart.

## Verification and local release

Run from `apps/api` using Node 22.13+ (Node 24.15.0 used for this change):

```powershell
node --experimental-test-module-mocks --test src/services/*.test.js
```

The notifier lifecycle tests replace SQL, audit, filesystem and transport with
fixtures. They cover upload, replacement, repeat upload, removal, transaction
failures, nonblocking I/O and failed delivery. No live product photo, stock,
customer, invoice or other commercial record is modified by these tests.

For release, retain the running checkout and its dirty changes. Apply the small
integration to a separate release built from the verified current runtime,
preserving any existing image-write/rollback improvements. The image service
in a different dirty checkout must not be overwritten wholesale. Record the
running process, checkout/commit and rollback command before switching.

Read-only acceptance must verify actual API provenance and quantities under
the existing authorized credentials. Do not enable a new SQL identity, migrate
schemas or restart the live ERP merely to make fixture tests pass. Deployment,
the active notifier environment, shared-key readability and receiver recovery
must be verified separately; source tests alone do not prove LIVE_READY.

## Visual information in the Vega product card

The selected Vega product's Ürün 360 card has a separate `Görsel bilgiler`
section. `GET /api/vega/products/:sourceId/visual-profile` requires the existing
ERP authentication and `product.view` permission. It reads the approved local
image mapping and hashes its bytes, then reads the existing Product Brain
profile through backend-only HMAC `POST /internal/profile`. This internal POST
is a read operation: no inference, queue mutation, ERP write or human approval
is performed. The key is never sent to the browser.

Only visible colors, patterns, details, sleeves and style are projected.
`IMAGE_AI/AUTO_DERIVED` values with score at least 0.95 and `HUMAN/VERIFIED`
values are usable when both the profile image and field evidence match the
current image hash. The score is not a calibrated accuracy rate. Unknown and
rejected values do not become usable facts; pending review and stale human
corrections remain visibly distinct. Category, gender, age, material composition,
size, unit, prices and stock are excluded from this projection.

Storage remains the existing Product Brain derived SQLite profile store. This
does not create ERP-native SQL visual fields or repurpose product/customs/system
settings columns. No schema migration is required for the read projection.
The native local-product card is not linked by coincident numeric ID: this first
slice applies only to the existing Vega source identity in Ürün 360.

The visual read is separate from the normal product list and never makes base
ERP listing depend on Product Brain availability. The card shows unavailable,
no-image, pending and stale states and supports manual refresh. Reading details
does not trigger analysis or alter an existing human correction. The internal
profile endpoint and ERP card source still require an independently permitted
deployment; source/build verification is not a claim that this UI is live.
