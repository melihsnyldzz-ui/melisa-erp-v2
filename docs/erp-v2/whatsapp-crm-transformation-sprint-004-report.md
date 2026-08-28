# WhatsApp CRM Transformation Sprint 004 - Workflow

## Outcome

CRM ownership, sales stages and follow-up tasks now use the authenticated ERP user and persistent CRM events.

## Delivered

- Removed hardcoded operator names from the CRM screen.
- Passed the authenticated ERP user through the application shell to CRM.
- Corrected the `Benim` filter to compare the real assigned user id.
- Added persistent follow-up tasks with a title and due date.
- Kept assignment, stages, notes and tags behind `crm.manage`.
- Stored tasks in the existing CRM event model; no schema migration was required.

## Verification

- `node scripts/web-admin-crm-workflow-smoke.mjs`
- `npm.cmd --prefix apps/whatsapp-crm-api test`
- `npm.cmd --prefix apps/web-admin run build`

