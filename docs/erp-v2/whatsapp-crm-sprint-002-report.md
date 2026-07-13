# WhatsApp CRM Sprint 002 Report

## Goal

Move WhatsApp CRM from a frontend/backend skeleton toward a real read-only inbox by adding PostgreSQL persistence for incoming webhook events and a database-backed inbox read model.

## Completed Scope

- Added lazy PostgreSQL connection service.
- Added safe PostgreSQL configuration options.
- Added CRM repository layer.
- Added idempotent webhook event persistence.
- Added instance upsert.
- Added contact upsert.
- Added conversation upsert.
- Added message insert/update.
- Added database-backed inbox overview.
- Kept inbox read-only.
- Kept WhatsApp sending unavailable.
- Kept ERP stock, finance, order, and customer/supplier mutations outside the CRM service.

## Persistence Flow

1. Evolution webhook reaches `POST /webhooks/evolution`.
2. Webhook secret is validated.
3. Provider adapter normalizes the payload.
4. In-memory idempotency checks fast duplicates.
5. PostgreSQL `crm_events` unique key catches durable duplicates.
6. CRM instance, contact, conversation, and message rows are created or updated.
7. Inbox endpoint reads conversations and recent messages from PostgreSQL.

## Safe Fallback

If `WHATSAPP_CRM_POSTGRES_URL` is not configured:

- Inbox returns an empty safe read model.
- Health reports PostgreSQL as disabled.
- Webhook persistence fails closed instead of silently losing events.

## Not Implemented

- Real Evolution pairing.
- Real WhatsApp sending.
- Redis-backed idempotency.
- Attachment/media download and storage.
- ERP customer matching.
- Assignment persistence UI.
- Notes/tags/order conversion API.

## Tests

Run:

```powershell
npm.cmd --prefix apps\web-admin run smoke:whatsapp-crm
npm.cmd --prefix apps\web-admin run smoke:navigation
npm.cmd --prefix apps\web-admin run build
```

## Recommended Sprint 003

Connect a test WhatsApp instance only:

- Start Docker dependencies locally.
- Configure test-only Evolution instance.
- Verify webhook delivery using a test number.
- Confirm persisted messages appear in the CRM inbox.
- Keep sending disabled.
- Do not connect the main company number.
