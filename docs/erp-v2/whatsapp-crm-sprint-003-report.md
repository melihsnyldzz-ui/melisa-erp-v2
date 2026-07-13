# WhatsApp CRM Sprint 003 Report

## Goal

Run a controlled local integration smoke without connecting the main company WhatsApp number and without sending any real message.

## Completed Scope

- Installed `apps/whatsapp-crm-api` dependencies.
- Added `package-lock.json` for reproducible CRM API installs.
- Started only the local CRM PostgreSQL and Redis containers.
- Did not start the new Evolution API container because port `8080` was already in use by an existing local Evolution setup.
- Started the CRM API locally with test-only environment values.
- Posted a local Evolution-shaped webhook fixture to the CRM API.
- Verified webhook persistence into the CRM PostgreSQL database.
- Posted the same webhook fixture again and verified duplicate detection.
- Queried the read-only inbox endpoint with ERP auth and verified persisted conversation output.
- Added a reusable local integration smoke script.

## Local Smoke Result

Validated result:

- CRM health: ok
- PostgreSQL backend: enabled
- First webhook: accepted and persisted
- Duplicate webhook: accepted as duplicate
- Inbox source: postgres
- Conversation count: at least 1
- Unread count: at least 1

## Safety Result

- No main company WhatsApp number was connected.
- No QR pairing was performed.
- No real WhatsApp message was sent.
- No ERP stock, finance, order, or customer/supplier tables were written by the CRM service.
- Only the CRM test PostgreSQL database was written.

## Reusable Command

The local smoke script is:

```powershell
npm.cmd --prefix apps\whatsapp-crm-api run smoke:local
```

Required environment values:

- `WHATSAPP_CRM_SMOKE_WEBHOOK_SECRET`
- `WHATSAPP_CRM_SMOKE_ACCESS_TOKEN`
- optional `WHATSAPP_CRM_SMOKE_BASE_URL`

Do not print tokens or secrets in reports.

## Known Limitations

- Redis is running but idempotency is still in-memory.
- Evolution API was not started from this repo due to port `8080` conflict.
- Web-admin still enriches sparse API rows with presentation fallback data until the backend returns full profile fields.
- Attachment/media persistence is not implemented.
- Message sending is still not implemented.

## Recommended Sprint 004

Test-number Evolution connection:

- Decide whether to reuse the existing local Evolution service on port `8080` or move this repo's Evolution service to another port.
- Pair only a test WhatsApp number.
- Configure webhook delivery to the CRM API.
- Send one inbound test message from the test number.
- Verify the message appears in the CRM inbox.
- Keep outbound sending disabled.
