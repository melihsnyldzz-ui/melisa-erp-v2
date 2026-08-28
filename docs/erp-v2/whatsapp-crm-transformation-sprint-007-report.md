# WhatsApp CRM Transformation Sprint 007 - Dashboard and Reporting

## Outcome

The CRM screen now exposes a compact operational summary derived from the actual inbox read model.

## Delivered

- Open conversation, unread and human-reply counts from CRM API summary.
- Persistent open-task and CRM-quote counts.
- Sales funnel counts by conversation stage.
- Compact desktop ERP layout with no new database writes.

## Verification

- `node scripts/web-admin-crm-reporting-smoke.mjs`
- `npm.cmd --prefix apps/web-admin run build`
- Browser DOM verification of `CRM operasyon özeti` and all six metric blocks.

