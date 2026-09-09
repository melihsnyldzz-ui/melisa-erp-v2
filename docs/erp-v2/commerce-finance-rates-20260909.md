# Finance summary exchange-rate acceptance

Bounded isolated lab acceptance, 2026-09-09. No production rates, accounts, stock, transactions, roles or settings were modified. No messaging actions.

## Correctness change

The previous finance summary converted a missing foreign exchange rate to 1. Real SQL demonstrated 106 TRY + 18 USD + 26 EUR incorrectly returning financeTryBalance 150 TRY with no rates present.

The summary now calculates TRY equivalents from the same native-currency breakdown it returns. A missing or non-positive selected rate makes only the affected metric null. Native currency amounts remain available; empty or zero positions stay valid zero totals. Rate selection uses the latest record on or before the report date, rejecting future rates and an invalid latest rate without falling back to older values.

Nullable fields: customerReceivables, customerAdvances, supplierPayables, supplierAdvances, todayCollections, todayPayments and financeTryBalance. Consumers must preserve null as unavailable, not coerce it to zero. conversion includes status, asOfDate, ratePolicy, selected rate/date details, missingCurrencies and missingByMetric. The report date retains the existing SQL UTC day basis; invoice-time snapshots are not rewritten by this report. This is a current balance/report conversion, not a replacement for historical transaction snapshots.

Finance Overview retains native balances, shows an unavailable TRY equivalent and a missing-rate notice. It also shows the reporting date/rate basis. Accounting Control forwards null and adds a warning check included in its warning total. Existing permissions and endpoint paths are unchanged.

## Evidence

- No rates: financeTryBalance null, native balances 106 TRY / 18 USD / 26 EUR; Finance Overview and Accounting Control visibly show the missing-rate state.
- Synthetic USD 40 and EUR 45: exact total 1996 TRY, verified by API and browser.
- A future USD rate 99 does not change 1996.
- Latest current USD rate zero, even with older valid USD 39: affected TRY total remains null; missing currency is USD only.
- Temporary inserted rate rows were removed and original empty rates/account balances verified unchanged. A browser-preview helper exited after stdin closed; its termination and exact two synthetic rate rows were verified before cleanup. The final scenarios were rerun with no interactive pause and restored their own rows in finally.
- 11 new pure conversion tests; 134 API tests, 231 web checks; API 150 and web 184 type roots, zero diagnostics; lint and build pass. Existing bundle-size advisory remains.

No production merge/deployment or full ERP/report acceptance is claimed. Other dashboard/report and stock-valuation paths still contain rate-to-one fallbacks; they require separate source-specific tests and fixes. Do not use this summary milestone to claim all reports are currency-safe. Cash concurrency, active-drawer routing, cancellation/correction and source reconciliation remain open.

Evidence: Development OS audit/commerce-no-messaging-20260908/finance-rates/acceptance.json. Synthetic rates are test values, not current market rates.
