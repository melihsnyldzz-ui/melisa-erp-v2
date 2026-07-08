# AI And Automation Readiness

Date: 2026-07-08

## Purpose

This document defines how AI may support Melisa ERP v2 before any AI-assisted automation is implemented.

The rule is simple: AI may help analyze, summarize, explain, draft, and review, but humans remain responsible for business decisions and every action that changes ERP truth.

## Source Of Truth

- ERP data remains the operational source of truth.
- SQL Server remains the live business data store.
- Melisa OS defines company-level AI, secrets, public data, and release rules.
- ERP local docs define ERP-specific implementation, SQL, auth, inventory, finance, terminal, Electron, import, reporting, and audit rules.
- `docs/erp-v2/karar-defteri.md` remains authoritative for ERP business behavior unless Melisa OS overrides it at company-policy level.

## Allowed Read-Only AI Use Cases

AI may support these workflows when access is authenticated and scoped to the operator's permissions:

- Explain visible dashboard, report, stock, cari, sales, purchase, finance, import, terminal, and audit data.
- Summarize management reports with their visible assumptions and data-quality notes.
- Identify possible data-quality issues for human review.
- Draft internal investigation notes from read-only ERP screens or safe API responses.
- Draft customer or supplier follow-up notes without sending them.
- Suggest manual review checklists for stock, finance, import, catalog, media, terminal sync, and reporting.
- Help compare ERP behavior against documented rules.
- Help prepare test plans, smoke scripts, and documentation.

AI output must clearly separate known ERP data, inferred analysis, missing data, and required human verification.

## Prohibited AI Actions Without Explicit Approval

AI must not perform or trigger these actions without explicit Melih approval for the exact run:

- Create, update, delete, import, cleanup, reset, restore, or migrate ERP data.
- Finalize, cancel, or alter sales or purchase invoices.
- Change product stock, prices, currency, supplier, barcode, or product image assignments.
- Change customer or supplier balances, movements, payment terms, or risk decisions.
- Create finance collections, payments, account movements, or official accounting output.
- Send WhatsApp, SMS, email, catalog messages, or any external communication.
- Publish catalog snapshots, public product feeds, websites, or production deployments.
- Run backup, restore, reset, destructive scripts, or production maintenance actions.
- Change users, roles, permissions, auth behavior, or audit retention.
- Use or expose secrets, tokens, passwords, SQL credentials, or `.env.local` values.

## Human Approval Requirements

Any AI-assisted write path must require all of the following before implementation and before each risky execution:

- A named human owner.
- The exact action, target environment, target records, and expected business effect.
- A dry-run or preview where possible.
- Visible before/after summary.
- Audit trail with authenticated actor, timestamp, source, reason, and changed fields.
- Rollback or reversal plan where the business process supports reversal.
- Explicit approval from Melih when the action touches production, SQL writes, external messages, backup/restore/reset, deploys, permissions, finance, inventory, customer terms, pricing, or public data.

Approval cannot be inferred from a general sprint title or prior approval. It must match the exact risky action.

## Explanation And Traceability Requirements

AI-assisted analysis must include:

- Data source or screen/API context.
- Time period and filters used.
- Row limits, sampling limits, or missing-data warnings.
- Whether the result is operational decision support or official accounting output.
- A confidence or review note when source data may be incomplete.
- A human-verification step before business action.

AI-generated recommendations must not appear as final business decisions. They are review inputs only.

## Data Quality Boundaries

AI must treat these areas as review-required before business action:

- Negative stock.
- Products with missing supplier, barcode, price, currency, image, or movement history.
- Imported records with duplicate or suspicious-row warnings.
- Customer or supplier balances that have not been checked against statements.
- Sales or purchase drafts, cancelled documents, or incomplete finalize evidence.
- Average-cost or margin calculations affected by missing purchase history.
- Terminal sync failures or retry queues.
- Report totals affected by row limits or heavy-query boundaries.

## Public And External Communication Boundary

AI may draft text for internal review, but must not send or publish it.

Customer-facing content must obey the Melisa OS public product data contract:

- Product inquiry content may include product code and product name.
- Prices, exact stock, delivery promises, shipment terms, payment terms, customer-specific terms, supplier data, margins, costs, and internal notes require human confirmation before external sharing.
- Public snapshots must include only public-safe fields and must be validated before deployment.

## Future Automation Candidates

These candidates may be planned later, but each needs a separate approved sprint, implementation design, tests, and approval gates:

- Read-only AI report summarizer with visible assumptions.
- Data-quality review assistant for imports, products, stock, cari, and reports.
- Audit anomaly review helper.
- Terminal failed-sync triage assistant.
- Product media matching review assistant that stays dry-run by default.
- Catalog copy drafting assistant without automatic publishing or sending.
- CRM follow-up draft assistant without automatic outreach.

## Out Of Scope Until Explicitly Approved

- Autonomous ERP writes.
- Automatic WhatsApp or external message sending.
- Automatic price, stock, product, cari, finance, import, permission, or invoice changes.
- AI-created official accounting decisions.
- AI public publishing or production deploys.
- AI access that bypasses existing auth, permissions, audit, or secrets policy.

## Required Review Before Any AI Implementation Sprint

Before any code-level AI feature is implemented, review:

- Melisa OS AI rules and secrets policy.
- ERP local AI rules and safe change protocol.
- Auth and permission boundaries for the target screens or APIs.
- Audit coverage for any proposed action.
- Data quality limits in the affected module.
- Whether the feature can stay read-only.
- Required tests, including static safety smoke and UI/API smoke where relevant.
