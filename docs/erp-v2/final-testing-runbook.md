# Melisa ERP v2 Final Testing Runbook

Date: 2026-07-09

Purpose: guide the first controlled human test of Melisa ERP v2 before calling the system feature-complete.

This runbook is for Melih, operators, and AI agents preparing ERP for final testing. It does not replace production readiness, backup/restore validation, or deployment approval.

## 1. Before Starting

Required checks:

1. Confirm the API, web-admin, SQL Server, and terminal app target the intended local/test environment.
2. Confirm `.env.local` and SQL credentials are not shared in chat, screenshots, Git, or reports.
3. Run the static final smoke pack:

```powershell
npm.cmd --prefix apps\web-admin run smoke:final-erp
```

4. Review warnings and skips. A warning may be acceptable for a local API that is not running, but failed checks must be fixed before final testing.
5. Decide whether write testing is approved. Do not run write tests accidentally.

## 2. Safe Read-Only Checks

These checks do not intentionally write to the ERP database:

1. Login and session:
   - Open web-admin.
   - Confirm login works.
   - Confirm logout works.
   - Confirm stale sessions return to login instead of showing broken pages.

2. Navigation:
   - Open each main menu group.
   - Confirm every visible screen loads or shows a clear API/permission message.
   - Confirm no mock/demo fixture data appears as live business truth.

3. Stock and product:
   - Search by stock code, barcode, product name, brand, category, and supplier.
   - Confirm Turkish `i`, `ı`, `İ`, `I` search variants work.
   - Open Product 360 / Stock 360.
   - Confirm image preview, stock, supplier, price, and movement fields are understandable.

4. Customer and supplier:
   - Search customer and supplier lists.
   - Sort balance columns high-to-low and low-to-high.
   - Open customer and supplier statements.
   - Confirm balances, movements, and list limits are visible.

5. Sales and purchase lists:
   - Open sales and purchase receipt lists.
   - Confirm draft/final/cancel labels are clear.
   - Confirm cancel actions are not shown as passive one-click list actions.

6. Finance:
   - Open collection/payment screens without saving.
   - Select customer/supplier and confirm expected balance preview is understandable.
   - Confirm operational finance is not presented as official accounting.

7. Reports:
   - Open management and periodic reports.
   - Confirm assumptions, row limits, data-quality notes, and export boundaries are visible.

8. Terminal and operational health:
   - Open Operational Health.
   - Open Terminal Management.
   - Confirm pending/failed sync counts are readable.
   - Confirm failed sync rows are review signals, not direct SQL cleanup instructions.

9. Settings and definitions:
   - Open System Settings, Definitions, and Currency Rates.
   - Confirm each screen states which actions write through the API and which business rules are affected.

## 3. Approval-Gated Write Checks

These checks can write to ERP data and require explicit Melih approval before execution:

1. Create a test supplier.
2. Create a test customer.
3. Create a purchase draft.
4. Finalize the purchase and confirm stock/cari effect.
5. Create a sales draft.
6. Finalize the sale and confirm stock/cari effect.
7. Cancel the finalized sale/purchase and confirm reversal behavior.
8. Create a customer collection.
9. Create a supplier payment.
10. Save settings, definitions, or currency rates.
11. Import apply.
12. Terminal sale send.

Approval text must include:

- Target environment.
- Exact action.
- Whether DB writes are allowed.
- Whether cleanup/reversal is expected.

## 4. Never Run During Routine Final Testing

Do not run these without a separate explicit approval:

- Backup restore or reset.
- Destructive SQL.
- Migration.
- Production deploy.
- WhatsApp or external message sending.
- Bulk media apply.
- Demo/test cleanup apply.
- Test archive apply or restore apply.
- Direct SQL correction.

## 5. Recommended Human Test Order

Use this order so failures are easier to diagnose:

1. Login and navigation.
2. Stock/product search and Product 360.
3. Customer and supplier list/statement read checks.
4. Purchase draft/finalize/cancel write check if approved.
5. Sales draft/finalize/cancel write check if approved.
6. Finance collection/payment write check if approved.
7. Reports and exports.
8. Terminal readiness and sync review.
9. Settings/definitions read review.
10. Final smoke pack rerun.

## 6. Stop Conditions

Stop final testing immediately if:

- A screen shows mock/demo data as live truth.
- A write action changes stock, cari, finance, or settings without clear operator confirmation.
- A finalized receipt does not create expected stock/cari/finance impact.
- A cancel action does not reverse expected stock/cari/finance impact.
- A permission error exposes data or action buttons that should be hidden.
- A secret, token, SQL credential, or private backup path is visible in UI/log output.
- WhatsApp or another external channel sends a message without explicit approval.
- Final smoke has any failed check.

## 7. Evidence To Record

For each final testing pass, record:

- Date and tester.
- Branch and commit hash.
- API/base URL.
- Whether write testing was approved.
- Smoke result summary.
- Screens tested.
- Issues found.
- Screenshots if useful, without exposing secrets.
- Decision: pass, pass with warnings, or fail.

## 8. Final Testing Done Criteria

ERP can move to final acceptance only when:

- Static final smoke passes with 0 failed checks.
- Approved write checks pass or are intentionally deferred.
- Read-only screens are understandable to operators.
- Business-rule boundaries are visible on risky screens.
- Known skips/warnings are documented.
- Open P0/P1 blockers are either fixed or explicitly accepted by Melih.
