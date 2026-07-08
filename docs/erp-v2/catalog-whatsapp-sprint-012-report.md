# Sprint 012 - Catalog And WhatsApp Sales Preparation Report

Date: 2026-07-08
Branch: `codex/erp-ui-modernization`

## Status

Completed.

## Scope

Sprint 012 prepared catalog and WhatsApp sales workflows without sending real messages, running migrations, deploying, or writing production data.

## What Changed

- Public catalog product output now exposes a public-safe stock signal instead of exact stock quantity.
- Public catalog output keeps prices, barcodes, costs, margins, customer data, supplier data, and financial fields out of the DTO.
- WhatsApp provider status now separates provider configuration from approved sending:
  - `configured`: provider settings are present.
  - `sendApproved`: explicit approval flag is enabled.
  - `sendEnabled`: both provider configuration and approval are present.
- Catalog and terminal WhatsApp send services now fail closed unless `WHATSAPP_SEND_APPROVED=true`.
- Web-admin catalog sharing text no longer includes prices.
- Web-admin WhatsApp queue no longer exposes automatic send controls; it remains a preparation and manual review queue.
- WhatsApp captions now tell the buyer that price and stock must be confirmed by the sales team.
- A static Sprint 012 safety smoke was added to guard the no-send and public-field boundaries.

## Public / Private Catalog Boundary

Public-safe fields:

- Product ID
- Product code / stock code
- Product name
- Brand
- Category
- Product image URL
- Public in-stock signal

Private fields that must not be exposed publicly:

- Retail price
- Wholesale price
- Purchase price
- Cost
- Margin
- Exact stock quantity
- Barcode
- Customer private data
- Supplier private data
- Internal notes
- ERP/database tokens
- Financial records

## WhatsApp Boundary

WhatsApp is preparation-first by default:

- Read-only status checks are allowed.
- Manual copy/open flows can prepare reviewed messages.
- Automatic sends are blocked unless Melih explicitly approves the run and `WHATSAPP_SEND_APPROVED=true` is set for that approved session.
- Message text must not promise price, stock, shipment, or delivery details before sales-team confirmation.

## CRM Boundary

ERP may hold the product and catalog source data, but customer outreach strategy, follow-up campaigns, message sequencing, and broader relationship workflows belong in the future CRM boundary. ERP should not become the long-term CRM automation surface.

## Tests

- `node scripts/sprint-012-catalog-whatsapp-safety-smoke.mjs`
- `node --check apps/api/src/config/env.js`
- `node --check apps/api/src/services/catalogService.js`
- `node --check apps/api/src/controllers/catalogController.js`
- `node --input-type=module -e "...sendCatalogToWhatsapp approval guard..."`
- `npm.cmd --prefix apps/web-admin run build`

Note: Node's native `--check` does not accept `.jsx` files in this project, so JSX validation is covered by the Vite build.

## Human Approval Used

No risky approval was used. No DB writes, migrations, backup/restore/reset actions, production deploys, or real WhatsApp sends were run.

## Remaining Risk

Existing catalog draft creation is still a write path and must only be exercised in approved local/lab conditions. Future CRM work should move customer outreach logic away from ERP Core while preserving ERP as the product source of truth.
