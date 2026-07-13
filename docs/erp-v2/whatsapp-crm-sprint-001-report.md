# WhatsApp CRM Sprint 001 Report

## Goal

Start the WhatsApp CRM project inside Melisa ERP v2 with a safe service skeleton, provider abstraction, webhook boundary, web-admin inbox entry point, local dependency containers, and technical documentation.

## Completed Scope

- Added `apps/whatsapp-crm-api` service skeleton.
- Added ERP-token based auth integration that delegates user/permission truth to ERP API.
- Added `crm.view` and `crm.manage` permission keys.
- Added WhatsApp provider interface.
- Added Evolution provider adapter skeleton.
- Added secured webhook endpoint: `POST /webhooks/evolution`.
- Added webhook idempotency guard using an in-memory TTL store.
- Added PostgreSQL data model for CRM instances, contacts, conversations, messages, attachments, and events.
- Added web-admin WhatsApp CRM inbox skeleton.
- Added WhatsApp CRM navigation entry in top menu, sidebar, workspace routing, and sales/patron role views.
- Added Docker Compose dependency stack for Evolution API, PostgreSQL, and Redis.
- Added `.env.example` entries without secrets.
- Added Sprint 001 smoke test.
- Added architecture documentation.

## Safety Result

- Main company WhatsApp number was not connected.
- No real WhatsApp message sending was implemented or executed.
- No ERP live data writes were added.
- No secret values were committed.
- Existing ERP API remains the source of truth for inventory, customer/supplier, finance, and order data.

## Tests

Run after the implementation:

```powershell
npm.cmd --prefix apps\web-admin run smoke:whatsapp-crm
npm.cmd --prefix apps\web-admin run smoke:navigation
npm.cmd --prefix apps\web-admin run build
```

## Known Risks

- The CRM API service has a new package manifest; dependencies must be installed before running the service.
- Sprint 001 idempotency is in-memory only. Redis-backed idempotency is required before production webhook traffic.
- The inbox screen is a skeleton and does not yet display persisted conversations.
- Live database role assignments may need to expose `crm.view` and `crm.manage` to selected users.
- Evolution API image/environment settings must be verified against the exact Evolution version before real test-number pairing.

## Recommended Sprint 002

Build the safe persistence and read model:

- Add PostgreSQL connection layer.
- Persist webhook events idempotently.
- Upsert contacts/conversations/messages.
- Add inbox list API from persisted data.
- Add webhook replay/smoke fixtures.
- Keep sending disabled.
