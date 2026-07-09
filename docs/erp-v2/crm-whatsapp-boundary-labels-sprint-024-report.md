# Sprint 024: CRM And WhatsApp Final Testing Labels

Date: 2026-07-09

Status: Completed

Branch: `supervisor-live-smoke-001`

## Goal

Make CRM, catalog, and WhatsApp-adjacent ERP screens safe for final human testing by clearly labeling their boundaries.

Operators should not confuse manual preparation screens with active CRM automation or automatic WhatsApp sending.

## Scope Completed

- Added final-testing boundary labels to the catalog preparation screen.
- Added a local share-panel warning that catalog share text does not send messages to an external service.
- Added a final-testing boundary label to the WhatsApp planning screen.
- Added a final-testing boundary label to the WhatsApp Web queue screen.
- Clarified that even when the provider is configured, this ERP screen does not start automatic bulk sending.
- Updated dashboard quick actions from active sending language to manual preparation/review language.
- Updated Smart Insights WhatsApp language to manual copy/review language.
- Added a focused CRM/WhatsApp boundary smoke test.
- Added the new smoke test to the final ERP smoke pack.

## Business Result

Catalog and WhatsApp screens can remain visible during ERP final testing without implying that:

- CRM has already been implemented.
- Campaign tracking is active.
- Customer communication history is complete.
- WhatsApp messages are automatically sent from ERP.
- Provider readiness equals permission to send.

## Out Of Scope

- No CRM implementation.
- No WhatsApp sending.
- No campaign automation.
- No customer communication history feature.
- No DB writes.
- No SQL migrations.
- No production deploy.
- No backup, restore, reset, cleanup, or import apply.

## Tests Run

```powershell
node --check scripts\web-admin-crm-whatsapp-boundary-smoke.mjs
npm.cmd --prefix apps\web-admin run smoke:crm-whatsapp-boundary
npm.cmd --prefix apps\web-admin run build
```

## Test Result

CRM/WhatsApp boundary smoke:

| Check | Result |
|---|---|
| Catalog screen labels ERP as manual catalog preparation | Pass |
| Catalog share panel says it does not send external messages | Pass |
| WhatsApp planner labels future CRM ownership | Pass |
| WhatsApp queue labels manual-only operation | Pass |
| WhatsApp provider enabled text still requires manual control | Pass |
| Dashboard quick actions do not imply automatic WhatsApp sending | Pass |
| Smart Insights use manual WhatsApp copy language | Pass |

Build:

- Web-admin production build passed.

## Remaining Findings

No P1 CRM/WhatsApp final-testing label blocker remains from this sprint.

Remaining final-testing polish items:

- Terminal failed-sync and device operation validation.
- Settings and definitions business review with Melih.
- Live API read-only smoke rerun in the approved local test setup.

## Next Recommended Sprint

Sprint 025 should focus on terminal failed-sync and device validation.

Business reason:

- ERP Core and screen labels are now safer for final testing.
- The terminal app and terminal admin screens still need a focused pass so failed sync, offline device, and device status behavior are clear before operator training.
