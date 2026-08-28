# WhatsApp CRM Transformation Sprint 005 - Product and Catalog

## Outcome

CRM operators can search the real ERP product catalog and persist product interest on a conversation without sending an external message.

## Delivered

- ERP product search by stock code, barcode or product name.
- Stock quantity, sale price and currency in selection results.
- Persistent CRM product-interest snapshots tied to the conversation.
- Product-interest read model in the inbox response.
- `crm.manage` protection on product-interest writes.

## Safety

- Product selection does not send WhatsApp messages.
- Product selection does not change ERP stock, price or order tables.
- Snapshots include ERP product ids and stock codes for traceability.

## Verification

- `node scripts/web-admin-crm-product-catalog-smoke.mjs`
- `npm.cmd --prefix apps/whatsapp-crm-api test`
- `npm.cmd --prefix apps/web-admin run build`

