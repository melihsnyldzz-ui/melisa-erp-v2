# WhatsApp CRM Transformation Sprint 008 - Production Preflight

## Safe implementation complete

- Added a second explicit live-send approval gate.
- Effective send status is false unless test-only mode or human-approved live mode is active.
- Added a regression test for unapproved live sending.
- Separated CRM health from inbox loading so the screen reports partial failures accurately.
- Pinned the Evolution image to `evoapicloud/evolution-api:v2.2.3`.
- Started local PostgreSQL and Redis dependencies.
- Verified the real CRM read model: 14 conversations, dashboard counts, Customer 360, tasks, ERP product search, CRM quotes and disabled ERP-order conversion.

## Current runtime result

- CRM API health: OK.
- PostgreSQL inbox: OK.
- Effective outbound sending: disabled.
- Real message sent: no.
- ERP order written: no.

## Human approval gate

Before any test message, a human must provide/confirm the allowed test number and approve test-only configuration. Live-number approval remains a separate decision.

## Verification

- `node scripts/whatsapp-crm-production-preflight-smoke.mjs`
- `npm.cmd --prefix apps/whatsapp-crm-api test`
- `npm.cmd --prefix apps/web-admin run build`
- Browser verification on the real CRM inbox.

