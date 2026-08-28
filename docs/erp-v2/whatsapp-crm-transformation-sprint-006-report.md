# WhatsApp CRM Transformation Sprint 006 - Quote and Order Gate

## Outcome

Matched customers and real ERP product interests can be converted into persistent CRM quote drafts. ERP order writing remains visibly locked behind human approval.

## Delivered

- Persistent CRM quote drafts with customer and line snapshots.
- Single-currency validation and calculated quote totals.
- Quote history in the customer panel.
- Explicit disabled `ERP siparişine dönüştür` control.
- API metadata proving the action did not write an ERP order.

## Safety

- No sales invoice, stock movement, balance or finance row is written.
- Mixed-currency quotes fail closed.
- Price snapshots are visible for operator confirmation; they are not sent externally.

## Verification

- `node scripts/web-admin-crm-quote-order-smoke.mjs`
- `npm.cmd --prefix apps/whatsapp-crm-api test`
- `npm.cmd --prefix apps/web-admin run build`

