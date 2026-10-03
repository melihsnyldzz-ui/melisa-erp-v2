# Daily cash acceptance, 2026-09-09

Bounded acceptance in isolated SQL lab MELISA_ERP_V2, localhost 51433. API 54100 / web 54173. No production data, roles, settings or schemas changed. No messaging actions.

## Changes

Cash opening, expense, transfer and closing now check the existing accounting period lock inside their transaction before writing. Expense/transfer/close use the stored session business date, not an arbitrary date supplied by the caller. The existing 409 ACCOUNTING_PERIOD_LOCKED response is preserved. No new financial policy or permission is introduced.

Closed daily cash summaries show historical carry-forward as the main amount, with expected count and main-cash delivery separately labeled. Previously the unlabeled main amount showed the pre-close expected count even after cash had been delivered.

## Real SQL and browser evidence

Synthetic opening: TRY 100 + internal transfer 5; USD 20; EUR 30. Expenses: TRY 3, USD 2, EUR 4. Manual TRY 2 delivery yields expected 100 / 18 / 26. Browser closing: physical 99 / 18 / 26, carry 10 / 5 / 6, written reason for TRY shortage 1. Main cash delivery 89 / 13 / 20.

Final drawer balances: TRY 10, USD 5, EUR 6. Final main cash balances: TRY 96, USD 13, EUR 20 (main TRY initially 10). All five transfers have matched in/out amounts and zero net effect per currency. 17 financial movements and 6 action audit records. Closed overview contains nine visible drawer movements; opening balance adjustments are intentionally excluded from that list.

Four actual HTTP requests while a temporary lab accounting lock was active returned 409 ACCOUNTING_PERIOD_LOCKED with unchanged account balances and business table counts. Temporary test settings were restored. UI close without the shortage reason returned 400 with unchanged counts/balances. After closure, opening the same date, expense, transfer and repeated close returned 409; overview stayed unchanged. Prior products remain at 8 each, customer 40 and supplier 110.

The preparation helper first expected HTTP 200 for opening but received the correct 201 success. SQL was inspected before continuing; the opening was never replayed. Subsequent expenses used a separate one-shot checkpoint. Helpers never repeat an uncertain dispatched write automatically.

## Validation and boundaries

123 API tests including 12 period-lock cases; 231 web checks; API 149 and web 184 roots with zero type diagnostics; lint and web build pass (existing large-chunk advisory). Actual 1440-pixel open/closed views inspected; 1024-pixel summary view inspected. This is not full narrow-screen acceptance for every control.

Source graph refreshed to 8492 nodes / 26398 edges; 28 partial files, 0 skipped, 89 intentional exclusions; three cross-HTTP matches. Operated files directly read because coverage still reports metadata_changed after refresh. Cross matches are not live integration proof. Request shapes and existing permissions remain unchanged; locked-date writes are now rejected.

Full ERP acceptance remains open: cash concurrency, collection/payment routing while the drawer is open, cancellation/correction, report totals and missing exchange rates, plus source reconciliation. In particular financeService currently contains COALESCE(rate_to_try, 1); this requires separate report correctness testing and remediation, not an assumption that these totals are accepted.

Detailed evidence is maintained in Development OS audit/commerce-no-messaging-20260908/cash-register/acceptance.json. Production merge/deployment not performed.
