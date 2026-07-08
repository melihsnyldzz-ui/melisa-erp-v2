# Melisa ERP v2 Gap Analysis

Generated on: 2026-06-29  
Source document: `docs/ERP_CODEBASE_ANALYSIS.md`

## Purpose

This document classifies the existing Melisa ERP v2 modules into a future operating model. The goal is to keep the core ERP focused, move adjacent capabilities to clearer product areas, and define a practical implementation backlog.

Classification labels:

- `KEEP`: keep as part of ERP core with only normal maintenance.
- `IMPROVE`: keep in ERP core, but polish functionality, UX, tests, or documentation.
- `REFACTOR`: keep capability, but change structure, boundaries, naming, or data flow.
- `REMOVE`: remove or retire because it is obsolete, duplicated, or confusing.
- `MOVE TO CRM`: move customer relationship and sales pipeline behavior out of ERP core.
- `MOVE TO MISSION CONTROL`: move operational monitoring, command center, admin, sync and health control.
- `MOVE TO MEDIA LIBRARY`: move image/media/catalog asset management.
- `MOVE TO AI`: move automation, analysis and intelligent recommendations.
- `MOVE TO KNOWLEDGE BASE`: move documentation, training, runbooks and help content.

## Target Product Boundaries

### ERP Core

ERP core should remain responsible for commercial truth:

- stock cards and barcodes
- product cost, price and stock quantity
- sales invoices
- purchase invoices
- customer and supplier account balances
- stock movements
- finance collections/payments
- currency rates
- audit and permissions needed to protect ERP writes

### CRM

CRM should own relationship workflows:

- customer pipeline
- offers and follow-up
- customer communication history
- WhatsApp/customer outreach planning
- customer-specific catalog follow-up
- risk/customer segmentation beyond accounting balance

Sprint 013 boundary contract:

- ERP remains the source of truth for product, stock, invoice, customer/supplier balance, finance, audit and permissions.
- CRM may consume public-safe product fields and permissioned internal customer summaries through explicit APIs or validated snapshots.
- CRM owns outreach planning, follow-up tasks, reminders, campaigns, message sequencing, communication history and customer-specific catalog follow-up.
- Sales offers and sales orders are CRM pipeline objects until they are converted into ERP drafts or finalized ERP commercial documents.
- CRM must not publicly expose prices, costs, margins, exact stock quantities, supplier private records, customer private records, financial records, risk scores, audit records, tokens or secrets.
- Automatic WhatsApp sending remains approval-gated and must not be added as an ERP Core behavior.

### Mission Control

Mission Control should own operator/admin supervision:

- dashboard command center
- terminal device status
- failed sync queue
- API/SQL health
- backup/reset/restore operations
- import monitoring and reconciliation
- period-close and operational alerts

### Media Library

Media Library should own product visuals and media operations:

- product image matching
- watermarking
- image coverage reports
- catalog media selection
- duplicate/missing image workflows
- bulk upload, rollback and review reports

### AI

AI should own intelligent suggestions and automation:

- anomaly detection
- product matching suggestions
- customer/supplier risk suggestions
- catalog/share recommendations
- import cleanup suggestions
- management summaries

### Knowledge Base

Knowledge Base should own durable learning and documentation:

- personnel training
- SOPs and runbooks
- release notes
- current status docs
- module map docs
- troubleshooting guides

## Module Classification

| Existing module | Current location | Classification | Reason | Recommended next action |
|---|---|---:|---|---|
| Authentication/session | API + web-admin | IMPROVE | Required for ERP operation, but open-admin fallback and production posture need clearer separation. | Keep in ERP core, document dev/prod auth modes, test token expiry. |
| Auth/admin overview | API + web-admin | MOVE TO MISSION CONTROL | User/permission supervision is operator/admin control, not daily ERP transaction work. | Keep API for now, present under Mission Control/Admin later. |
| Permission catalog | API service | IMPROVE | Core protection layer for ERP writes. | Normalize permission names, especially supplier permissions. |
| Audit logging | API service + auth admin | IMPROVE | Core accountability requirement. Current coverage/UI should become more explicit. | Add audit browser and coverage checks for critical writes. |
| Dashboard / Operation Desk | API + web-admin | MOVE TO MISSION CONTROL | This is command center behavior spanning ERP, finance, terminal and alerts. | Keep visible as first screen, but define as Mission Control product area. |
| Monitoring summary | API | MOVE TO MISSION CONTROL | Health/slow request/system monitoring belongs to operations. | Consolidate with terminal/admin health dashboard. |
| SQL health | API | MOVE TO MISSION CONTROL | DB health is an operator function. | Keep endpoint, add runbook and UI status panel. |
| Products / stock cards | API + web-admin | KEEP | Central ERP master data. | Continue stabilization and validation. |
| Product barcodes | API + web-admin | KEEP | Central to stock, sales, terminal scanning and import. | Keep in ERP core, strengthen duplicate handling UI. |
| Product images | API + web-admin | MOVE TO MEDIA LIBRARY | Media is important but should not clutter stock card operations. | Keep primary image reference in ERP, move bulk image work to Media Library. |
| Stock list | web-admin | IMPROVE | Core ERP list, but needs ongoing responsive and visual stabilization. | Keep, add image/filter UX regression checks. |
| Product card / Product 360 | web-admin | IMPROVE | Core ERP screen, now has live options/images but still needs polish. | Keep in ERP, improve supplier/category consistency and image UX. |
| Price list | web-admin | KEEP | Core ERP pricing view. | Keep, later add export/change audit if needed. |
| Stock movements | API + web-admin | KEEP | Core inventory ledger. | Keep, improve source drill-down and reconciliation. |
| Stock valuation | API + web-admin | KEEP | Core stock reporting. | Keep, add period and category filters. |
| Stock count | API + web-admin | IMPROVE | Core inventory adjustment, risk-sensitive. | Add approval/audit and operator checklist. |
| Customer/cari cards | API + web-admin | KEEP | Customer balance is ERP core. | Keep accounting-facing data in ERP. |
| Customer relationship details | web-admin panels | MOVE TO CRM | Product trace and relationship follow-up are CRM-flavored. | Keep balance/statement in ERP, move relationship panels to CRM later. |
| Customer movements | API + web-admin | KEEP | Core customer ledger. | Keep, improve filtering/export. |
| Customer statement | API + web-admin | KEEP | Core ERP/cari function. | Keep, improve printable/exportable statement. |
| Supplier/cari cards | API + web-admin | KEEP | Supplier account data is ERP core. | Keep, separate supplier permissions from customer permissions. |
| Supplier product trace | web-admin panels | IMPROVE | Useful for purchasing, but should remain tied to supplier purchasing context. | Keep in ERP purchase/supplier module for now. |
| Supplier movements | API + web-admin | KEEP | Core supplier ledger. | Keep, improve filters/export. |
| Supplier statement | API + web-admin | KEEP | Core ERP/cari function. | Keep, improve 360 layout and search reliability. |
| Sales invoices | API + web-admin | KEEP | Core ERP transaction. | Keep, strengthen tests around draft/finalize/cancel. |
| Sales invoice list | API + web-admin | KEEP | Core ERP transaction history. | Keep, improve category report/export if needed. |
| Sales offers | API + web-admin | MOVE TO CRM | Offers are pre-sale relationship workflow. | Move UI grouping to CRM; conversion to ERP order/invoice remains integrated. |
| Sales orders | API + web-admin | MOVE TO CRM | Orders can bridge CRM and ERP, but pipeline handling is CRM-like. | Move pipeline ownership to CRM, keep invoice conversion API. |
| Purchase invoices | API + web-admin | KEEP | Core ERP transaction. | Keep, strengthen supplier-product rule tests. |
| Bulk purchase entry | web-admin | IMPROVE | Valuable ERP purchasing accelerator, but UI/action layout needs polish. | Keep, improve row visibility and validation feedback. |
| Finance overview | API + web-admin | KEEP | Core finance summary. | Keep, clarify whether accounting reports are operational or official. |
| Collections/payments | API + web-admin | KEEP | Core cash/cari settlement. | Keep, add receipts/printing and audit checks. |
| Cash customer tracking | web-admin | IMPROVE | Useful operational finance view, but needs clear boundary. | Keep under ERP finance if tied to account balances. |
| Cash/bank ledger | API + web-admin | KEEP | Core operational finance. | Keep, improve reconciliation/export. |
| Accounting journal | API + web-admin | IMPROVE | Useful but may imply full accounting. | Keep as operational ledger; label carefully. |
| Accounting control | API + web-admin | MOVE TO MISSION CONTROL | Control/reconciliation is operator oversight. | Keep endpoint, group under Mission Control/Finance Control later. |
| Currency rates | API + web-admin | KEEP | Core ERP calculation dependency. | Keep, add audit and date-sensitive validation. |
| Catalog list | API + web-admin | MOVE TO CRM | Catalogs are customer-facing sales enablement. | Move customer catalog planning to CRM; keep product data source in ERP. |
| WhatsApp planner | API + web-admin | MOVE TO CRM | Outreach planning is CRM communication workflow. | Move to CRM communication area. |
| WhatsApp Web queue | API + web-admin | MOVE TO CRM | Sending workflow belongs to customer outreach, though it uses product media. | Move to CRM; pull images from Media Library. |
| Public catalog products | API | MOVE TO CRM | Public/customer-facing catalog API belongs outside ERP core. | Keep API compatible while moving product boundary. |
| Import products/customers/suppliers | API + web-admin | MOVE TO MISSION CONTROL | Imports are admin/data operations with risk and reconciliation needs. | Move to Mission Control Data Ops. |
| Import service | API | REFACTOR | Useful but should expose a safer dry-run/apply/report contract. | Refactor into import jobs with durable logs. |
| Cleanup service | API | MOVE TO MISSION CONTROL | Cleanup is dangerous operator/admin work. | Keep behind admin controls with preview/apply/report. |
| Settings | API + web-admin | IMPROVE | System settings are needed, but definitions are incomplete. | Keep core settings, split operational/admin settings later. |
| Definitions | web-admin | IMPROVE | Should become real reference data, not placeholder-like definitions. | Implement first-class reference tables where necessary. |
| Backup/reset scripts | API scripts/docs | MOVE TO MISSION CONTROL | Backup/restore belongs to operator control. | Wrap scripts in documented safe workflow. |
| Product image watermark script | API scripts | MOVE TO MEDIA LIBRARY | Media operation, not ERP transaction logic. | Turn into Media Library job with preview/apply/report. |
| Local image matching/import workflow | scripts/manual | MOVE TO MEDIA LIBRARY | Current work is operationally valuable but not productized. | Create documented dry-run + apply + rollback tooling. |
| Terminal API product/customer lookup | API | KEEP | Terminal lookup supports ERP warehouse/sales operations. | Keep stable and test offline assumptions. |
| Terminal sales submit | API | KEEP | Creates ERP sales transaction. | Keep, strengthen idempotency and queue handling. |
| Terminal WhatsApp share | API | MOVE TO CRM | Sharing products to customers is outreach. | Move to CRM/communication boundary later. |
| Terminal app Login/Home/Settings | terminal app | IMPROVE | Required terminal app foundation. | Keep and polish field usability. |
| Terminal Barcode/Product lookup | terminal app | KEEP | Core terminal operation. | Keep, test LAN/offline behavior. |
| Terminal New Sale | terminal app | KEEP | Core sales operation. | Keep, validate submit/idempotency. |
| Terminal Receipt Collection | terminal app | IMPROVE | Finance-related terminal action. | Keep if business wants field collections; add audit/receipt flow. |
| Terminal Customer Accounts | terminal app | IMPROVE | Useful but can drift into CRM. | Keep balance view only; move relationship notes to CRM later. |
| Terminal Catalog Send | terminal app | MOVE TO CRM | Customer communication workflow. | Move toward CRM/catalog share flow. |
| Terminal Sync Status/Data Update | terminal app | MOVE TO MISSION CONTROL | Device/sync health is operational control. | Keep app screen but manage centrally in Mission Control. |
| Terminal Reports | terminal app | REFACTOR | Reports on terminal can duplicate web reports. | Keep only field-essential summaries. |
| Terminal Field Test | terminal app | MOVE TO MISSION CONTROL | Diagnostic screen. | Keep hidden/admin oriented. |
| Electron desktop shell | desktop app | IMPROVE | Useful delivery surface, not separate business app. | Add packaging/update/runbook. |
| App shell / tabbed workspace | web-admin | IMPROVE | Good ERP working model, needs responsive hardening. | Keep and stabilize across resolutions. |
| Command palette / quick navigation | web-admin | KEEP | Improves ERP usability. | Keep, connect to permissions and recent screens. |
| Smart insights panel | web-admin | MOVE TO AI | Insight generation should be an AI/assistant layer. | Keep static insights minimal; move AI logic out. |
| Management reports | web-admin/API | MOVE TO MISSION CONTROL | Executive monitoring is command-center oriented. | Keep reports accessible, group under Mission Control later. |
| Export center | web-admin | KEEP | ERP users need export/print operations. | Keep, improve export coverage. |
| Mock/demo data and mock screens | web-admin/API | REMOVE | Confuses live ERP operation when mixed with real data. | Isolate to demo mode or remove from production paths. |
| Existing docs and training docs | docs | MOVE TO KNOWLEDGE BASE | Durable user/operator knowledge should be organized separately. | Keep docs, reorganize and update current status. |
| QA/stabilization docs | docs | MOVE TO KNOWLEDGE BASE | Process knowledge, not runtime ERP. | Keep and update per release. |

## Prioritized Implementation Backlog

### High Priority

1. **Separate live ERP from demo/mock behavior**
   - Classification: `REMOVE` / `REFACTOR`
   - Scope: remove production exposure to mock screen data, demo product/customer options and placeholder modules.
   - Outcome: operators see only live ERP behavior unless explicitly in demo mode.

2. **Create current status and runbook documentation**
   - Classification: `MOVE TO KNOWLEDGE BASE`
   - Scope: `current-status`, local startup, backup/restore, image import, GitHub review notes.
   - Outcome: ChatGPT/Codex/human reviewers understand what is real, partial, local-only or pending.

3. **Formalize product image import as Media Library workflow**
   - Classification: `MOVE TO MEDIA LIBRARY`
   - Scope: dry-run, confidence categories, preview report, apply, rollback report, coverage report.
   - Outcome: no more one-off manual scripts for image matching.

4. **Strengthen invoice finalize/cancel service tests**
   - Classification: `KEEP` / `IMPROVE`
   - Scope: sales and purchase drafts, finalize, cancel, stock movement, average cost, customer/supplier movement.
   - Outcome: core ERP commercial truth is protected.

5. **Fix permission boundary consistency**
   - Classification: `IMPROVE`
   - Scope: supplier permissions, finance permissions, import/settings permissions.
   - Outcome: route permissions match business ownership.

6. **Build Mission Control foundation**
   - Classification: `MOVE TO MISSION CONTROL`
   - Scope: SQL/API health, terminal status, failed sync, import jobs, backup/restore status, alerts.
   - Outcome: admin/operator work is separated from daily ERP transaction screens.

7. **Add whole-app smoke checklist/script**
   - Classification: `IMPROVE`
   - Scope: login, stock, product image, sales draft/finalize, purchase draft/finalize, finance collection/payment, reports.
   - Outcome: safer iteration before push/operator testing.

### Medium Priority

1. **Refactor sales offers/orders toward CRM boundary**
   - Classification: `MOVE TO CRM`
   - Scope: keep ERP conversion endpoints, move pipeline ownership and screens to CRM grouping.
   - Outcome: ERP remains transaction-focused.

2. **Move WhatsApp/catalog planning toward CRM + Media Library**
   - Classification: `MOVE TO CRM` / `MOVE TO MEDIA LIBRARY`
   - Scope: outreach planning in CRM, image selection/coverage in Media Library.
   - Outcome: cleaner product boundaries.

3. **Improve stock list and product card UX regression coverage**
   - Classification: `IMPROVE`
   - Scope: table sizing, hover previews, column density, category/supplier suggestions, responsive monitors.
   - Outcome: fewer layout regressions across computers.

4. **Create audit browser and audit coverage map**
   - Classification: `IMPROVE`
   - Scope: map critical writes to audit actions, expose searchable audit UI.
   - Outcome: accountability is visible, not just stored.

5. **Improve import reconciliation**
   - Classification: `MOVE TO MISSION CONTROL`
   - Scope: import summary, duplicate/suspicious records, rollback guidance, before/after count.
   - Outcome: safer bulk data operations.

6. **Add product data quality reports**
   - Classification: `KEEP` / `MOVE TO MISSION CONTROL`
   - Scope: no barcode, no image, no supplier, duplicate codes, suspicious price/cost/currency.
   - Outcome: cleaner operational data.

7. **Clarify accounting labels and finance scope**
   - Classification: `IMPROVE`
   - Scope: distinguish operational finance ledger from official accounting.
   - Outcome: users do not mistake ERP control reports for formal accounting output.

8. **Electron packaging runbook**
   - Classification: `IMPROVE`
   - Scope: install/run/update/shortcut process and common failures.
   - Outcome: more reliable desktop deployment.

9. **Terminal sync admin view**
   - Classification: `MOVE TO MISSION CONTROL`
   - Scope: failed queue, retry, duplicate submissions, device health.
   - Outcome: terminal operations become supportable.

### Low Priority

1. **Introduce shared packages where duplication is real**
   - Classification: `REFACTOR`
   - Scope: shared formatting, search normalization, DTO helpers, permission constants.
   - Outcome: `packages/` becomes useful without premature abstraction.

2. **OpenAPI/API reference generation**
   - Classification: `IMPROVE`
   - Scope: generate route documentation from Express route definitions.
   - Outcome: external review and testing are easier.

3. **Knowledge Base reorganization**
   - Classification: `MOVE TO KNOWLEDGE BASE`
   - Scope: group training docs, architecture docs, runbooks and release notes.
   - Outcome: less documentation sprawl.

4. **AI assistant layer planning**
   - Classification: `MOVE TO AI`
   - Scope: management summaries, anomaly detection, matching suggestions, natural language search.
   - Outcome: AI work is planned as a layer, not mixed into core ERP rules.

5. **Advanced customer relationship features**
   - Classification: `MOVE TO CRM`
   - Scope: customer notes, reminders, follow-up tasks, campaign outcomes.
   - Outcome: CRM can grow without burdening ERP core.

6. **Warehouse/depot-level inventory planning**
   - Classification: `IMPROVE`
   - Scope: only if business needs multi-location stock.
   - Outcome: avoid adding complexity until there is operational demand.

## Recommended Sequencing

1. Stabilize core ERP boundaries: products, stock, sales, purchase, finance, customer/supplier ledgers.
2. Remove or isolate mock/demo behavior.
3. Add Mission Control for risky/admin operations.
4. Productize Media Library image workflows.
5. Move sales pipeline and WhatsApp/catalog outreach toward CRM.
6. Organize docs into Knowledge Base.
7. Add AI only after data quality, logs and module boundaries are reliable.

## Notes for Future Review

- GitHub code does not contain the local SQL Server data or local uploaded product images.
- Product media links can exist in the local database even when source image files are not in Git.
- A reviewer should evaluate code architecture and documented workflows separately from current local business data.
- `ERP_CODEBASE_ANALYSIS.md` should be refreshed whenever route groups, modules or database migrations materially change.
