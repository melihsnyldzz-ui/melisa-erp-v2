# Sprint 021: Whole ERP Screen Completion Audit

Date: 2026-07-09
Owner: Codex
Reviewer: ChatGPT
Approver: Melih

## Business Goal

Find screen-level blockers before final ERP testing. The ERP should not enter final testing with unmapped screens, broken navigation, hidden route errors, obvious responsive layout failures, or unclear mock/demo boundaries.

## Scope Completed

- Audited the web-admin menu and workspace route structure.
- Verified top menu, sidebar menu, screen registry, role views, display labels, icons, and workspace routes.
- Verified list-scope warnings for large sales and purchase invoice lists.
- Verified responsive/layout guardrails for dense ERP screens.
- Started a dedicated local test API/web-admin pair for Sprint 021 smoke:
  - API: `http://127.0.0.1:4112`
  - Web-admin: `http://127.0.0.1:5178`
- Logged in with local passwordless admin for read-only browser orientation.
- Fixed one navigation consistency issue found during audit:
  - `audit-log` screen module name now matches the existing Security/Güvenlik navigation convention.
  - Navigation smoke now accepts the repository's current encoded Security label variant.

## Screen Inventory

### Menu Screens Audited

41 visible menu screens were found:

- `dashboard`
- `operational-health`
- `stock-list`
- `product-card`
- `price-list`
- `stock-movements`
- `stock-valuation`
- `stock-count`
- `customer-list`
- `customer-card`
- `customer-movements`
- `customer-statement`
- `supplier-list`
- `supplier-card`
- `supplier-movements`
- `supplier-statement`
- `sales-invoice`
- `sales-invoice-list`
- `sales-offers`
- `sales-orders`
- `bulk-purchase-entry`
- `purchase-invoice`
- `purchase-invoice-list`
- `finance-overview`
- `collections-overview`
- `cash-customers`
- `cash-bank-ledger`
- `accounting-journal`
- `accounting-control`
- `catalog-list`
- `whatsapp-planner`
- `whatsapp-web-queue`
- `terminal-overview`
- `import-foundation`
- `reports-overview`
- `export-center`
- `definitions-overview`
- `settings-overview`
- `currency-rates`
- `auth-overview`
- `audit-log`

### Workspace Routes Audited

43 workspace routes were found. The extra non-menu routes are detail/card routes opened from list flows:

- `sales-offer`
- `sales-order`

## Result By Area

| Area | Result | Notes |
|---|---|---|
| Navigation registry | Ready | 19/19 navigation smoke checks pass. |
| Sidebar labels/icons | Ready | All visible sidebar items have labels and icons. |
| Workspace route mapping | Ready | All screen registry IDs have Workspace routes; no unmapped screen found. |
| Role views | Ready | Role view screen IDs resolve to registered screens. |
| Dense layout rules | Ready | 40/40 layout smoke checks pass. |
| Large sales/purchase lists | Ready | List-scope warnings and narrowing guidance pass. |
| Audit Log screen | Ready | Added in Sprint 020 and now included in navigation smoke. |
| Mock/demo boundary | Improve | Demo services are guarded by demo mode, but invoice fixture files are still imported for form defaults. |
| Catalog/WhatsApp | Improve / Move Later | Screens exist, but future ownership should move toward CRM/Media Library. Automatic sending remains approval-gated. |
| Terminal admin | Improve / Mission Control Later | Screen exists; final field-device operations still need a separate terminal/device validation pass. |
| Settings/definitions | Improve | Screens exist; business reference data completeness should be reviewed by Melih during final testing. |

## P0 Findings

No P0 screen-mapping blocker was found in Sprint 021.

Evidence:

- No visible menu screen is missing from `screenRegistry`.
- No registered screen is missing a Workspace route.
- No Workspace route points to an unknown screen.
- Web-admin build passes.

## P1 Findings

These should be handled before final testing if time allows:

1. **Invoice fixture naming and mock boundary**
   - Problem: `SalesInvoiceScreen` and `PurchaseInvoiceScreen` still import `salesInvoiceMockData.js` / `purchaseInvoiceMockData.js` for default structures.
   - Business impact: Operators or reviewers may assume mock invoice data can appear in real mode.
   - Suggested fix: Rename fixture files to neutral defaults, or move default structures into `invoiceDefaults` files with no mock wording.
   - DB write/migration needed: No.
   - Test required: Web-admin build, sales/purchase invoice open smoke.

2. **CRM-bound screens need final-testing labels**
   - Problem: catalog and WhatsApp screens exist inside ERP, but roadmap says CRM/Media Library should own much of this later.
   - Business impact: Staff may treat outreach/campaign features as ERP Core completion items.
   - Suggested fix: Add clear read-only/approval-gated labels and keep automatic send disabled unless explicitly approved.
   - DB write/migration needed: No.
   - Test required: Catalog/WhatsApp screen smoke.

3. **Terminal admin requires separate operational validation**
   - Problem: Terminal screen exists, but actual device/offline queue behavior needs field workflow validation.
   - Business impact: ERP web can be ready while terminal operations still need device-level acceptance.
   - Suggested fix: Separate Sprint 023/024 terminal/device smoke.
   - DB write/migration needed: No for read-only validation; possible controlled write approval for terminal sale submit later.
   - Test required: Terminal lookup/sync/admin smoke.

4. **Settings and definitions need business content review**
   - Problem: The screens are wired, but reference data completeness is a business decision.
   - Business impact: Staff may not know which definitions are official.
   - Suggested fix: Melih reviews definitions/settings during final testing and marks unused items.
   - DB write/migration needed: Only if applying setting/reference changes.
   - Test required: Settings read/update smoke only with approval.

## P2 Findings

These can wait until after final testing:

- Move CRM/catalog/WhatsApp ownership out of ERP Core.
- Add detail drawer/modal for audit snapshots.
- Improve official report/export formatting.
- Add visual screenshot regression for every screen at multiple viewport sizes.
- Package Electron and terminal app acceptance runs.

## Mock/Demo Leftovers

The following demo/mock areas still exist:

- `apps/web-admin/src/demo/demoProducts.js`
- `apps/web-admin/src/demo/demoCustomers.js`
- `apps/web-admin/src/demo/demoSuppliers.js`
- `apps/web-admin/src/data/mockScreenData.js`
- `apps/web-admin/src/modules/sales/salesInvoiceMockData.js`
- `apps/web-admin/src/modules/purchase/purchaseInvoiceMockData.js`

Current assessment:

- Product/customer/supplier demo services are gated by `VITE_DEMO_MODE`.
- `mockScreenData.js` appears to be legacy/static screen content and should not be used for live ERP screens.
- Sales/purchase mock data files are used as default form structures and should be renamed or isolated before final testing.

## Checks Run

- `npm.cmd --prefix apps/web-admin run smoke:navigation`
  - Result: 19/19 pass after the audit-log module label fix.
- `npm.cmd --prefix apps/web-admin run smoke:list-scope`
  - Result: pass.
- `npm.cmd --prefix apps/web-admin run smoke:layout`
  - Result: 40/40 pass.
- `npm.cmd --prefix apps/web-admin run build`
  - Result: pass.
  - Existing warnings only:
    - lucide module directive warning
    - large bundle warning

## Acceptance Criteria

- Every visible ERP menu item resolves to a registered screen.
- Every registered screen resolves to a Workspace route.
- No unmapped screen is exposed in the menu.
- Layout guardrails pass for dense ERP screens.
- Screen-level completion gaps are classified as P0/P1/P2.
- Sprint status and roadmap can move to final smoke packaging.

## Next Recommended Sprint

Sprint 022 should create the final ERP smoke pack:

- one command or small set of commands for final testing
- API health/auth/read-only checks
- core write smoke using QA records only when approved
- web-admin navigation/layout checks
- audit coverage checks
- clear pass/fail final report
