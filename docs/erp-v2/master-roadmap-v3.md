# ERP Master Roadmap v3

This document is the official business-first roadmap for Melisa ERP v2.

The roadmap follows the shared sprint standard from Melisa OS:

- `melisa-os/docs/project-management/sprint-template.md`

## Roadmap Principle

ERP Core must be completed before Operations, Growth, Intelligence, CRM, AI, Mission Control, or advanced automation work.

The business must first trust the commercial truth of the ERP:

- stock
- product cards
- customers and suppliers
- sales and purchase invoices
- finance collections and payments
- permissions
- audit
- backup and restore discipline

Only after these are stable should the project expand into operational command centers, customer growth workflows, catalog automation, or AI-assisted intelligence.

## Phase 1: ERP Core

### Sprint 001: Current ERP Status And Safety Baseline

**Phase:** ERP Core

**Business Problem:** The ERP implementation has moved faster than the documentation, so operators and AI agents can misunderstand what is complete, partial, risky, or local-only.

**Business Goal:** Create one trusted current-status baseline before new implementation work continues.

**Business KPI:** 100% of active modules classified as complete, partial, missing, or risky.

**Business Value:** Critical

**Priority:** P0

**Difficulty:** Low

**Owner:** Codex

**Reviewer:** ChatGPT

**Approver:** Melih

**Dependencies:** Existing ERP docs, current repository state, Melisa OS rules, current Git branch.

**Scope:**

- Document current ERP status.
- Identify live data, uploads, backups, WhatsApp, and secrets risks.
- List completed, partial, and missing modules.
- Define the next safe sprint sequence.

**Out of Scope:**

- Code changes.
- Database writes.
- New feature work.
- `.claude/` changes.

**Definition of Done:**

- Current status is documented in a clear business-readable format.
- Known risks and local-only limitations are explicit.
- Next sprint recommendation is written.
- Documentation-only commit is created.

**Required Tests:**

- Documentation link check.
- `git status --short`.
- Review that no code files changed.

**Risks:**

| Risk | Impact | Mitigation |
|---|---|---|
| Old docs conflict with current code | Medium | Mark stale sections and create a current-status document |
| GitHub does not show local DB/uploads state | High | Document local-only data boundaries clearly |

**Documentation to Update:**

- `docs/erp-v2/current-status.md`
- `docs/erp-v2/master-roadmap-v3.md`

### Sprint 002: Authentication And User Access Stabilization

**Phase:** ERP Core

**Business Problem:** If login, session, and permissions are unreliable, the ERP cannot safely be used by staff.

**Business Goal:** Ensure every user enters with real credentials and only sees/actions what they are allowed to use.

**Business KPI:** 0 known auth bypasses; 100% of protected ERP screens require valid auth.

**Business Value:** Critical

**Priority:** P0

**Difficulty:** Medium

**Owner:** Codex

**Reviewer:** ChatGPT

**Approver:** Melih

**Dependencies:** Admin credential access, auth DB, current auth middleware, permission catalog.

**Scope:**

- Verify login, logout, refresh, and session expiry.
- Verify protected API endpoints require tokens.
- Review permission boundaries for critical ERP actions.
- Document auth behavior for operators.

**Out of Scope:**

- Public user registration.
- Password recovery by email/SMS.
- New role model design beyond required fixes.

**Definition of Done:**

- Real login works.
- No fake admin or silent login fallback remains.
- Expired sessions return user to login clearly.
- Permission failures are understandable.

**Required Tests:**

- API auth smoke.
- Web-admin login smoke.
- Unauthorized endpoint checks.
- Web-admin build.

**Risks:**

| Risk | Impact | Mitigation |
|---|---|---|
| Wrong admin password blocks testing | High | Use approved admin reset flow only with human approval |
| Permission changes hide required screens | Medium | Test key owner/accounting workflows |

**Documentation to Update:**

- `docs/erp-v2/current-status.md`
- `docs/ai/local-agent-rules.md` if auth safety rules change

### Sprint 003: Product And Stock Data Reliability

**Phase:** ERP Core

**Business Problem:** Sales, purchases, terminal scanning, catalog, and reporting all depend on correct product and stock data.

**Business Goal:** Make product cards and stock lists reliable enough for daily business operations.

**Business KPI:** Product search, barcode search, supplier/category suggestions, and stock list load correctly for the active product set.

**Business Value:** Critical

**Priority:** P0

**Difficulty:** Medium

**Owner:** Codex

**Reviewer:** ChatGPT

**Approver:** Melih

**Dependencies:** Product API, stock tables, product card UI, current product data quality.

**Scope:**

- Stabilize product list and product card behavior.
- Verify barcode handling.
- Verify supplier, brand, and category suggestions use real ERP data.
- Validate Turkish search normalization.
- Keep image references stable.

**Out of Scope:**

- Multi-warehouse stock.
- Shelf/floor/location tracking.
- Advanced media library workflows.

**Definition of Done:**

- Product list is searchable and usable.
- Product card saves expected core fields.
- Main supplier/category/brand options are consistent.
- Products with movement history are protected from unsafe deletion.

**Required Tests:**

- Product API smoke.
- Product list UI smoke.
- Search normalization checks.
- Web-admin build.

**Risks:**

| Risk | Impact | Mitigation |
|---|---|---|
| Dirty existing stock data hides code problems | Medium | Add data-quality reports instead of guessing |
| Large product list slows UI | Medium | Preserve pagination/filtering discipline |

**Documentation to Update:**

- `docs/erp-v2/current-status.md`
- Product data quality runbook if created

### Sprint 004: Customer And Supplier Ledger Reliability

**Phase:** ERP Core

**Business Problem:** Customer receivables and supplier payables must be trusted by management and accounting.

**Business Goal:** Make customer/supplier lists, cards, movements, and statements reliable.

**Business KPI:** Customer and supplier statements match movement totals for tested accounts.

**Business Value:** Critical

**Priority:** P0

**Difficulty:** Medium

**Owner:** Codex

**Reviewer:** ChatGPT

**Approver:** Melih

**Dependencies:** Customer/supplier APIs, movement tables, finance movements, statement screens.

**Scope:**

- Verify customer and supplier list completeness.
- Verify statement filters and balances.
- Improve supplier permission boundaries where needed.
- Clarify export/print expectations.

**Out of Scope:**

- Full official accounting.
- CRM notes and follow-up workflows.
- Check/senet or bank reconciliation modules.

**Definition of Done:**

- Customer/supplier search is complete and reliable.
- Movements and statements are understandable.
- Balance impact is clear.
- Supplier and customer permissions are not confused in critical flows.

**Required Tests:**

- Customer API smoke.
- Supplier API smoke.
- Statement screen checks.
- Web-admin build.

**Risks:**

| Risk | Impact | Mitigation |
|---|---|---|
| Imported cari data may be inconsistent | High | Add reconciliation/reporting before mass corrections |
| Supplier permissions reuse customer permissions | Medium | Separate permission naming in a controlled sprint |

**Documentation to Update:**

- `docs/erp-v2/current-status.md`
- Finance/cari runbook if created

### Sprint 005: Sales And Purchase Commercial Truth

**Phase:** ERP Core

**Business Problem:** Incorrect invoice finalization can damage stock, cost, profit, and customer/supplier balances.

**Business Goal:** Guarantee that draft invoices have no commercial effect and finalized invoices produce correct commercial effects.

**Business KPI:** 100% pass rate for approved sales/purchase draft-finalize-cancel smoke flow.

**Business Value:** Critical

**Priority:** P0

**Difficulty:** High

**Owner:** Codex

**Reviewer:** ChatGPT

**Approver:** Melih

**Dependencies:** Auth, product, customer, supplier, stock movement, finance ledgers, approved test data or explicit live DB approval.

**Scope:**

- Verify sales draft, finalize, and cancel.
- Verify purchase draft, finalize, and cancel.
- Verify stock movements and average cost.
- Verify customer/supplier movement impact.
- Verify duplicate finalize/cancel protection.

**Out of Scope:**

- New invoice features.
- Full accounting.
- E-invoice or official invoice integration.

**Definition of Done:**

- Draft invoices do not affect stock, cari, cost, or profit.
- Finalized invoices create correct stock and ledger effects.
- Cancellation behavior is auditable and controlled.
- Critical transaction risks are documented.

**Required Tests:**

- API commercial flow smoke.
- Stock movement verification.
- Customer/supplier movement verification.
- Audit verification.
- Web-admin build.

**Risks:**

| Risk | Impact | Mitigation |
|---|---|---|
| Live DB writes require approval | Critical | Use lab/test DB or explicit human approval |
| Test records pollute real data | High | Use clear QA prefixes and cleanup/passive strategy |

**Documentation to Update:**

- `docs/erp-v2/current-status.md`
- QA stabilization report

### Sprint 006: Finance Collections And Payments

**Phase:** ERP Core

**Business Problem:** If tahsilat and odeme are wrong, balances and management decisions become unreliable.

**Business Goal:** Make collection/payment entry safe, traceable, and understandable.

**Business KPI:** Tested collections/payments update the expected account balances and movement records.

**Business Value:** Critical

**Priority:** P1

**Difficulty:** Medium

**Owner:** Codex

**Reviewer:** ChatGPT

**Approver:** Melih

**Dependencies:** Customer/supplier ledgers, finance API, permissions, audit.

**Scope:**

- Verify collection and payment forms.
- Verify before/after balance display.
- Verify ledger movement creation.
- Clarify operational finance vs official accounting.

**Out of Scope:**

- Full bank reconciliation.
- Official accounting ledger.
- Check/senet.

**Definition of Done:**

- Collection/payment saves only with clear selected cari.
- Balance impact is visible before or after save.
- Movement records are traceable.
- Audit expectations are documented.

**Required Tests:**

- Finance form smoke.
- Finance API checks.
- Web-admin build.

**Risks:**

| Risk | Impact | Mitigation |
|---|---|---|
| Multi-currency balances confuse users | High | Label account and transaction currency clearly |
| Users expect official accounting | Medium | Document operational finance scope |

**Documentation to Update:**

- `docs/erp-v2/current-status.md`
- Finance operation notes if created

## Phase 2: Operations

### Sprint 007: Backup, Restore, And Reset Safety

**Phase:** Operations

**Business Problem:** A real ERP cannot be trusted without backup and restore confidence.

**Business Goal:** Protect the business from accidental data loss.

**Business KPI:** Backup process documented and restore verification path defined.

**Business Value:** Critical

**Priority:** P0

**Difficulty:** Medium

**Owner:** Codex

**Reviewer:** ChatGPT

**Approver:** Melih

**Dependencies:** SQL Server access, backup scripts, filesystem backup path, human approval for write/destructive operations.

**Scope:**

- Document backup, restore, reset, and verification process.
- Verify scripts target the correct DB.
- Define operator approval points.
- Define storage and retention expectations.

**Out of Scope:**

- Running destructive reset without approval.
- Production restore without approval.
- New backup product feature.

**Definition of Done:**

- Backup/restore runbook is clear.
- Reset scripts are documented as high risk.
- Human approval steps are explicit.

**Required Tests:**

- Read-only script review.
- Approved backup dry-run or backup execution if requested.
- Documentation review.

**Risks:**

| Risk | Impact | Mitigation |
|---|---|---|
| Wrong DB target | Critical | Require database guard and manual confirmation |
| Backup contains sensitive data | High | Store backups outside Git with restricted access |

**Documentation to Update:**

- `docs/erp-v2/backup-restore-plan.md`
- `docs/erp-v2/production-readiness-checklist.md`

### Sprint 008: Import And Cleanup Control

**Phase:** Operations

**Business Problem:** Bulk imports can damage stock and cari data if preview, validation, and rollback are weak.

**Business Goal:** Make import and cleanup operations safe enough for controlled business use.

**Business KPI:** 100% of import apply operations have preview, validation, and result report.

**Business Value:** High

**Priority:** P1

**Difficulty:** High

**Owner:** Codex

**Reviewer:** ChatGPT

**Approver:** Melih

**Dependencies:** Import APIs, sample files, backup discipline, permissions, audit.

**Scope:**

- Review product/customer/supplier import flows.
- Standardize preview/apply/report behavior.
- Add duplicate and suspicious row reporting.
- Define cleanup safety rules.

**Out of Scope:**

- Blind import apply.
- Destructive cleanup without preview.
- Large data migration without backup.

**Definition of Done:**

- Import preview is mandatory.
- Apply results are auditable.
- Before/after counts are visible.
- Cleanup is controlled and documented.

**Required Tests:**

- Import preview test.
- Invalid file test.
- Small approved apply test if needed.
- Audit check.

**Risks:**

| Risk | Impact | Mitigation |
|---|---|---|
| Bad import corrupts live data | Critical | Require backup and preview before apply |
| Excel columns vary by supplier/source | Medium | Add column validation and clear errors |

**Documentation to Update:**

- Import runbook.
- `docs/erp-v2/current-status.md`

### Sprint 009: Operational Health And Monitoring

**Status:** Completed in `docs/erp-v2/operational-health-sprint-009-report.md`.

**Phase:** Operations

**Business Problem:** Operators need early warning when API, SQL, terminal sync, or imports fail.

**Business Goal:** Make operational health visible without mixing it into daily ERP transaction work.

**Business KPI:** API health, SQL health, failed sync count, and recent critical failures are visible in one operator view.

**Business Value:** High

**Priority:** P1

**Difficulty:** Medium

**Owner:** Codex

**Reviewer:** ChatGPT

**Approver:** Melih

**Dependencies:** Health endpoints, monitoring service, terminal sync tables, auth.

**Scope:**

- Verify API and SQL health.
- Verify failed terminal sync visibility.
- Verify import/finalize failure visibility.
- Keep monitoring read-only by default.

**Out of Scope:**

- Advanced AI alerting.
- Automatic repair actions.
- External notification sending.

**Definition of Done:**

- Operators can see health status.
- Critical failures are visible.
- Monitoring does not expose secrets.

**Required Tests:**

- `/api/health`.
- `/api/sql/health`.
- Monitoring summary check.
- Web-admin build.

**Risks:**

| Risk | Impact | Mitigation |
|---|---|---|
| Monitoring becomes noisy | Medium | Focus on critical operator actions |
| Logs expose sensitive info | High | Mask credentials/tokens |

**Documentation to Update:**

- Operations runbook.
- Production readiness checklist.

### Sprint 010: Visual Stability And Daily Usability

**Status:** Completed on 2026-07-08. See `docs/erp-v2/visual-stability-sprint-010-report.md`.

**Phase:** Operations

**Business Problem:** If screens overlap, hide buttons, or break on different computers, staff cannot use ERP confidently.

**Business Goal:** Stabilize daily screens for real office use.

**Business KPI:** Critical screens pass 1366x768 and 1920x1080 visual checks.

**Business Value:** High

**Priority:** P1

**Difficulty:** Medium

**Owner:** Codex

**Reviewer:** ChatGPT

**Approver:** Melih

**Dependencies:** Web-admin critical flows, browser verification, known screen list.

**Scope:**

- Check operation desk.
- Check stock list and product 360.
- Check sales and purchase invoice screens.
- Check finance entry.
- Check customer and supplier lists.

**Out of Scope:**

- Major redesign.
- Modern spacious SaaS transformation.
- New modules.

**Definition of Done:**

- Critical buttons remain visible.
- Tables and panels do not overlap.
- Dense ERP feel is preserved.
- Known layout risks are documented.

**Required Tests:**

- Web-admin build.
- Layout smoke.
- Browser screenshots at common resolutions.

**Risks:**

| Risk | Impact | Mitigation |
|---|---|---|
| Over-polishing delays core work | Medium | Fix only clear usability breaks |
| Dense ERP feel is lost | Medium | Preserve Vega/Wolvox-style density |

**Documentation to Update:**

- Visual QA report.
- Current status.

## Phase 3: Growth

### Sprint 011: Product Media Workflow

**Phase:** Growth

**Business Problem:** Missing or wrong product images reduce sales confidence and catalog quality.

**Business Goal:** Make product media matching, watermarking, and coverage controlled and reportable.

**Business KPI:** Image coverage report available by product/brand/supplier; applied image matches are traceable.

**Business Value:** High

**Priority:** P2

**Difficulty:** Medium

**Owner:** Codex

**Reviewer:** ChatGPT

**Approver:** Melih

**Dependencies:** Product data stability, uploads policy, image folders, watermark rules.

**Scope:**

- Define dry-run/report/apply workflow.
- Separate high-confidence and low-confidence matches.
- Document watermark behavior.
- Create coverage reporting plan.

**Out of Scope:**

- AI image generation.
- Unreviewed low-confidence bulk apply.
- Committing uploads to Git.

**Definition of Done:**

- Image operations are reportable.
- Risky matches require review.
- Rollback/undo strategy is documented.

**Required Tests:**

- Dry-run image matching.
- Small approved apply batch.
- Product image preview UI check.

**Risks:**

| Risk | Impact | Mitigation |
|---|---|---|
| Wrong image damages trust | High | Review low-confidence matches manually |
| Uploads are local runtime files | Medium | Document local storage boundaries |

**Documentation to Update:**

- Media workflow runbook.
- Current status.

### Sprint 012: Catalog And WhatsApp Sales Preparation

**Phase:** Growth

**Business Problem:** Sales staff need clean product sharing, but customer outreach must not destabilize ERP Core.

**Business Goal:** Prepare catalog and WhatsApp workflows after product/customer data is trustworthy.

**Business KPI:** Catalog data uses clean ERP product records; WhatsApp sends remain disabled unless explicitly approved.

**Business Value:** High

**Priority:** P2

**Difficulty:** High

**Owner:** Codex

**Reviewer:** ChatGPT

**Approver:** Melih

**Dependencies:** Product core, customer data, image coverage, WhatsApp rules in Melisa OS.

**Scope:**

- Verify catalog data source.
- Keep WhatsApp no-send safety by default.
- Define CRM boundary for customer outreach.
- Ensure catalog does not mutate ERP core incorrectly.

**Out of Scope:**

- Real external message sending without approval.
- Full CRM implementation.
- Online payment or cart flow.

**Definition of Done:**

- Catalog behavior is documented.
- WhatsApp status can be checked safely.
- Sending requires explicit approval.
- CRM boundary is clear.

**Required Tests:**

- Catalog API smoke.
- Catalog UI smoke.
- WhatsApp status read-only check.
- No-send safety check.

**Risks:**

| Risk | Impact | Mitigation |
|---|---|---|
| Accidental real WhatsApp send | Critical | Keep sending gated and approval-based |
| Catalog expands before ERP Core is stable | High | Enforce roadmap phase order |

**Documentation to Update:**

- Catalog/WhatsApp runbook.
- Current status.

### Sprint 013: CRM Boundary Planning

**Phase:** Growth

**Business Problem:** Customer relationship work can clutter ERP if not separated from accounting and transaction truth.

**Business Goal:** Define what belongs in future CRM versus ERP Core.

**Business KPI:** 100% of customer-facing growth workflows classified as ERP Core, CRM, or later.

**Business Value:** Medium

**Priority:** P3

**Difficulty:** Medium

**Owner:** Codex

**Reviewer:** ChatGPT

**Approver:** Melih

**Dependencies:** ERP Core stable, sales pipeline docs, catalog direction.

**Scope:**

- Classify sales offers/orders.
- Classify WhatsApp/customer follow-up.
- Classify customer notes and reminders.
- Preserve ERP customer balance/statement ownership.

**Out of Scope:**

- Building a CRM.
- Migrating screens.
- AI customer automation.

**Definition of Done:**

- CRM boundary is documented.
- ERP Core remains transaction-focused.
- No implementation starts before approval.

**Required Tests:**

- Documentation review.
- Navigation/menu boundary review.

**Risks:**

| Risk | Impact | Mitigation |
|---|---|---|
| CRM starts too early | High | Keep this sprint planning-only |
| Invoice and pipeline concepts mix | Medium | Define conversion boundaries clearly |

**Documentation to Update:**

- Gap analysis.
- CRM boundary document if created.

## Phase 4: Intelligence

### Sprint 014: Reporting And Decision Support

**Phase:** Intelligence

**Business Problem:** Management needs reliable answers about stock, profit, suppliers, and customer risk.

**Business Goal:** Turn trusted ERP data into useful business reports.

**Business KPI:** Key management reports load from trusted ERP data and can be reviewed/exported.

**Business Value:** High

**Priority:** P2

**Difficulty:** High

**Owner:** Codex

**Reviewer:** ChatGPT

**Approver:** Melih

**Dependencies:** ERP Core data reliability, finance reliability, supplier/customer ledger reliability.

**Scope:**

- Supplier performance reporting.
- Product risk and data quality reporting.
- Customer/supplier balance reporting.
- Export path for management reports.

**Out of Scope:**

- AI-generated decisions.
- Fully automated recommendations.
- Official accounting reports.

**Definition of Done:**

- Reports use trusted ERP data.
- Report assumptions are visible.
- Export/review path is clear.
- Slow/heavy queries are identified.

**Required Tests:**

- Report API smoke.
- Report UI smoke.
- Export smoke if available.
- Data sanity checks.

**Risks:**

| Risk | Impact | Mitigation |
|---|---|---|
| Bad source data misleads management | High | Pair reports with data-quality checks |
| Heavy queries slow ERP | Medium | Add filters and avoid uncontrolled full scans |

**Documentation to Update:**

- Reporting runbook.
- Current status.

### Sprint 015: AI And Automation Readiness

**Phase:** Intelligence

**Business Problem:** AI can help only if ERP data, permissions, audit, and workflows are already trustworthy.

**Business Goal:** Prepare safe AI-assisted analysis without allowing uncontrolled ERP writes.

**Business KPI:** AI use cases are documented with read/write boundaries and human approval rules.

**Business Value:** Medium

**Priority:** P3

**Difficulty:** High

**Owner:** Codex

**Reviewer:** ChatGPT

**Approver:** Melih

**Dependencies:** ERP Core complete, Operations stable, reporting stable, Melisa OS AI rules.

**Scope:**

- Define safe read-only AI use cases.
- Define approval requirements for any AI action.
- Define traceability and explanation requirements.
- Identify future automation candidates.

**Out of Scope:**

- Autonomous ERP writes.
- Automatic WhatsApp sending.
- Automatic price/stock/cari changes.
- AI features before data quality is reliable.

**Definition of Done:**

- AI boundaries are documented.
- No AI write path exists without approval.
- Use cases are explainable and auditable.
- Next AI sprint requires explicit approval.

**Required Tests:**

- Documentation review.
- Secrets policy review.
- Read-only data access review.

**Risks:**

| Risk | Impact | Mitigation |
|---|---|---|
| AI suggests wrong action from dirty data | High | Keep AI read-only until data quality improves |
| Automation bypasses human approval | Critical | Require explicit approval and audit for writes |

**Documentation to Update:**

- AI readiness document.
- `docs/ai/local-agent-rules.md` if AI safety rules change.

## Recommended First Command

After this roadmap is approved and committed, the next operational command should be:

```text
Complete Sprint 001.
```

Sprint 001 is intentionally documentation-first. It creates the stable business baseline required before more code work continues.
