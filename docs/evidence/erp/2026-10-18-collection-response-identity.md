# Selected collection response identity — 18 October 2026

On PR49 source30619b9, a synthetic committed collection reply with corrupted amount was incorrectly accepted and journal marked done. The added regression failed before the fix.

The selected-source UI now compares documentDate and create amount/status or cancellation path ID/status. It also requires the response collection's seven identity/value fields to equal the matching invoice collection member before journal completion. Corrupted amount/date/status/ID remains pending and blocks navigation; same-UUID deliberate replay recovers with one financial effect. Existing generic behavior stays unchanged.

PR48 d2572177 service ceiling checks and13 tests are included without changing the existing500TRY native scope. Its configurable fixture price and PR45 invoice/collection revision shapes are both preserved.

Root independently reviewed source and ran107/107 targeted tests, zero failures/skips on Node24.19.0 (13 service+94 UI/session/navigation/journal). Synthetic service and DOM doubles only. No real SQL, installation, runtime/service/customer operation, main merge or migration. General customer/currency support and human acceptance remain open. Exact new head CI is separate.
