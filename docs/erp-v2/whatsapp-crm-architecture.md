# WhatsApp CRM Architecture

## Purpose

WhatsApp CRM is a new Melisa ERP v2 companion module for receiving WhatsApp conversations, tracking contacts, and preparing future customer communication workflows.

Sprint 001 creates the safe foundation only. It does not connect the main company WhatsApp number and it does not send real messages.

## Architecture Decision

- The user interface lives inside the existing ERP `web-admin` application.
- The CRM backend is a separate service in the same monorepo: `apps/whatsapp-crm-api`.
- The existing ERP API remains the owner of inventory, customer/supplier accounts, finance, and order data.
- WhatsApp CRM does not write directly to ERP inventory, finance, or order tables.
- Future ERP-side actions must go through the existing ERP API.
- Evolution API, PostgreSQL, and Redis run as separate Docker services for local/test usage.
- Provider integration is abstracted so Evolution/Baileys can be replaced or extended with Meta Cloud API later.

## Services

| Service | Path | Responsibility |
| --- | --- | --- |
| ERP API | `apps/api` | Auth, permissions, ERP business data |
| Web Admin | `apps/web-admin` | ERP and WhatsApp CRM user interface |
| WhatsApp CRM API | `apps/whatsapp-crm-api` | Webhooks, provider abstraction, CRM inbox API |
| Evolution API | Docker | WhatsApp session/provider bridge |
| PostgreSQL | Docker | WhatsApp CRM operational data |
| Redis | Docker | Future queue/idempotency/cache support |

## Auth And Permissions

The CRM API accepts the existing ERP bearer token and verifies it with the shared JWT secret. It then calls the ERP API `/api/auth/me` endpoint to keep ERP API as the source of truth for user identity and permissions.

New ERP permissions:

- `crm.view`
- `crm.manage`

Sprint 001 only requires `crm.view` for the read-only inbox skeleton.

## Provider Interface

The provider interface is defined in `apps/whatsapp-crm-api/src/providers/whatsappProvider.js`.

Current provider:

- `evolution`: implemented as an adapter skeleton in `evolutionProvider.js`

Future provider:

- `meta-cloud`: can be added without changing the inbox or webhook contract.

## Webhook Contract

Endpoint:

`POST /webhooks/evolution`

Security:

- Requires `WHATSAPP_CRM_WEBHOOK_SECRET`.
- Accepts the secret through `x-melisa-webhook-secret`, `x-evolution-webhook-secret`, or `apikey`.
- Uses timing-safe comparison.

Idempotency:

- Sprint 001 uses an in-memory TTL idempotency store.
- Redis-backed idempotency should be added before real production traffic.

## Data Model

Sprint 001 creates a PostgreSQL schema foundation:

- `crm_instances`
- `crm_contacts`
- `crm_conversations`
- `crm_messages`
- `crm_attachments`
- `crm_events`

The schema is located at:

`apps/whatsapp-crm-api/infra/postgres/001_initial_schema.sql`

## UI

The first screen is:

`WhatsApp CRM Gelen Kutusu`

Route/screen id:

`whatsapp-crm-inbox`

The screen is intentionally read-only in Sprint 001. It shows service status, inbox counters, safety boundaries, and a conversation table placeholder.

## Safety Boundaries

- Do not connect the main company WhatsApp number before test-number validation.
- Do not send real messages without explicit approval.
- Keep `WHATSAPP_SEND_ENABLED=false` by default.
- Keep `WHATSAPP_TEST_NUMBER_ONLY=true` by default.
- Do not place real tokens, QR secrets, or API keys in the repository.
- Do not write to ERP stock, finance, or order tables from WhatsApp CRM.

## Local Development

Start dependency containers:

```powershell
docker compose -f docker-compose.whatsapp-crm.yml up -d
```

Start CRM API after setting local environment values:

```powershell
npm.cmd --prefix apps\whatsapp-crm-api run dev
```

Start web-admin separately as usual.

## Current Limitations

- Webhook events can be persisted to PostgreSQL when `WHATSAPP_CRM_POSTGRES_URL` is configured.
- Inbox can read conversations/messages from PostgreSQL, but the UI still falls back to mock presentation data when no persisted conversations exist.
- Redis is prepared but not yet used for the idempotency store.
- Sending is intentionally not implemented.
- Evolution pairing with a real test number has not been executed.
- Attachments/media are modeled but not downloaded or stored yet.
- Role permission assignment in live databases may require an admin/permission update after deployment.
