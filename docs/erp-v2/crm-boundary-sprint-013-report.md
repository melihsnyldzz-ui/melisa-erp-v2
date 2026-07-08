# Sprint 013 - CRM Boundary Planning Report

Date: 2026-07-08
Branch: `supervisor-live-smoke-001`

## Status

Completed.

## Scope

Sprint 013 defines the CRM boundary without implementing CRM screens, moving existing routes, sending WhatsApp messages, running database writes, running migrations, or deploying.

## Business Goal

Keep ERP Core focused on operational and commercial truth while reserving customer relationship, outreach, follow-up, and campaign workflows for a future CRM product area.

## Boundary Decision

ERP Core remains responsible for:

- Product cards, product codes, barcode references, brand, category, age range, gender, season, and primary image references.
- Stock quantity, stock movements, stock valuation, purchase cost, sale price, and currency snapshots.
- Customer and supplier cards for accounting-facing identity, balance, movement, and statement needs.
- Sales and purchase invoices, draft/finalize/cancel behavior, finance collections/payments, audit, and permissions.
- Public-safe product snapshot generation only when fields are filtered and validated.

CRM should own:

- Customer outreach planning.
- Follow-up tasks, reminders, next-contact dates, and sales-owner work queues.
- Campaign planning, campaign membership, message sequencing, and outreach result tracking.
- WhatsApp/customer communication history and manual or automated send workflow ownership.
- Customer-specific catalog follow-up and relationship notes.
- Customer reactivation, segmentation beyond accounting balance, and pipeline views.
- Sales offers and sales orders as pipeline objects before they become ERP commercial documents.

## ERP Data CRM May Consume

CRM may consume these ERP fields through explicit APIs or validated snapshots:

- Product ID or public product reference.
- Product code / stock code.
- Product name.
- Brand.
- Category.
- Age range.
- Gender.
- Public color labels or color dots.
- Season.
- Product image URL or primary media reference.
- New-arrival and best-seller style flags when they are intentionally published.
- Public in-stock signal, not unrestricted exact stock quantity by default.
- Customer ID, customer code, customer name, country, city, phone, and status for authenticated internal CRM use.
- Customer balance summary and last transaction dates for internal sales risk review, with permission checks.
- Invoice or order conversion references needed to trace a CRM opportunity into ERP commercial truth.

## Fields CRM Must Not Expose Publicly

CRM must not expose these fields to public/customer-facing channels unless Melih explicitly approves the exact use:

- Retail price, wholesale price, purchase price, cost, margin, supplier cost, or customer-specific price.
- Exact stock quantity when the public contract only allows stock signal.
- Internal notes, ERP tokens, user tokens, SQL identifiers, or private operational IDs.
- Supplier private records.
- Customer private records beyond the intended recipient context.
- Financial records, open balance, payment behavior, or risk score.
- Audit records, permission records, database connection details, or runtime secrets.

## Conversion Boundary

CRM may manage interest and pipeline state, but ERP remains the source of truth when business impact starts.

- CRM offer: relationship/pipeline object; no stock, cari, finance, or audit commercial effect.
- CRM order candidate: planned sales intent; no stock or customer balance effect until converted.
- ERP sales draft: ERP document; still no stock, cari, cost, or finance effect.
- ERP finalized sales invoice: commercial truth; stock, cari, cost, finance, and audit effects are handled by ERP.
- ERP cancellation: ERP-controlled reversal; CRM may observe status but must not directly mutate ERP transaction truth.

## WhatsApp And Outreach Boundary

WhatsApp remains approval-gated:

- CRM may prepare message drafts, campaign lists, and follow-up queues.
- CRM may open manual WhatsApp flows only when the operator reviews the message.
- Automatic sending requires explicit Melih approval for the run and the required environment approval flag.
- Messages must not promise price, stock, delivery, shipment, or payment terms before sales-team confirmation.
- ERP should not become the long-term WhatsApp automation surface.

## Menu And Navigation Review

Current ERP screens that should be treated as future CRM candidates:

- Sales offers and sales orders pipeline views.
- Catalog list when used for customer-facing sales enablement.
- WhatsApp planner.
- WhatsApp Web queue.
- Terminal catalog send and customer communication flows.
- Customer notes, reminders, relationship history, and reactivation views if added later.

Current ERP screens that should remain ERP Core:

- Stock list and product card.
- Customer and supplier cards for balance, movement, and statement operations.
- Sales and purchase invoice screens.
- Finance collection/payment screens.
- Stock movement, stock count, import, audit, and permission-protected operational views.

## Out Of Scope

- No CRM implementation.
- No screen migration.
- No route migration.
- No database migration.
- No CRM schema design.
- No external message sending.
- No AI customer automation.
- No production deploy.

## Tests And Checks

Documentation-only sprint checks:

- Required Melisa OS and local AI rules reviewed.
- `docs/ERP_GAP_ANALYSIS.md` CRM classifications reviewed.
- `docs/erp-v2/master-roadmap-v3.md` Sprint 013 scope reviewed.
- Navigation/menu boundary reviewed by static documentation and source search.
- No DB write, migration, backup/restore/reset, WhatsApp send, or deploy command was run.

## Human Approval Used

No risky approval was used. Sprint 013 stayed documentation-only and planning-only.

## Remaining Risks

- Existing ERP screens still contain catalog and WhatsApp workflow surfaces until a future approved CRM migration exists.
- Sales offers/orders can still confuse pipeline intent with ERP commercial truth unless labels and conversion boundaries are enforced in a later sprint.
- Customer risk and segmentation may need internal CRM permissions before any operator-facing implementation.

## Next Sprint Recommendation

Complete Sprint 014 - Reporting And Decision Support.

Reason: ERP Core, operations, media, catalog, WhatsApp, and CRM boundaries now have planning evidence. The next safe value is management reporting based on trusted ERP data, with explicit data-quality and permission boundaries.
