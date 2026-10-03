# Terminal emulator rehearsal

Use a separate Android AVD, initially empty. The physical terminal and the user's existing AVD are outside this rehearsal.

The existing isolated Commerce_20260908 test AVD can be reused to verify an APK update preserves its synthetic data. The optional fixture flag `--unverified-submit` returns only a 503 TERMINAL_SALE_OUTCOME_UNVERIFIED error for sale submission. It performs no commercial operation; use it to verify the manual-review queue UI. The default fixture still denies business routes.

`node scripts/quality/terminal-fixture-server.mjs` starts a synthetic service on 127.0.0.1:4719. It imports no database or upstream client. By default only fixture login, refresh, logout and the offline toggle are accepted POST requests; business submission routes are denied. The optional error-only flag above adds a simulated failure response, never a sale. Do not expose it on a LAN or use real credentials.

The rehearsal used emulator-5580 with device port 4100 reversed to host port 4719. This keeps the app's localhost:4100 address separate from any real ERP listener. `emulator-state.ps1` captures this fixed emulator only; it accepts an optional `-Adb` path and writes screenshots/XML under temp/emulator. Confirm the serial belongs to the isolated AVD before use.

Verified on 2026-09-08 with the release APK (Android 37.1 x86_64, 16 KB pages):

- Synthetic personnel login; password keyboard leaves the submit control reachable.
- Download 2 products and 1 customer to the local cache.
- Customer search with Enter; barcode 8690000000001 resolves TEST-001, 125 TRY, stock 20.
- With fixture API returning 503, stock-code search plus Enter resolves TEST-002 from cache; barcode lookup also works from cache.
- Two local lines total 275 TRY. Forced app restart recovers the working draft. APK update preserves the session, cache and queued draft.
- Save the draft to the local queue, reopen and save the same draft: one pending record remains, no business submit request.
- Unknown barcode clears the previous selected product and success message, displays the error beside product entry, and leaves the two existing lines unchanged.
- Android status/navigation insets, reachable login Settings button, scrollable Home exit/refresh controls, and Settings keyboard verified visually.
- Terminal checkJs, root lint, safe terminal test runner and Android release build pass. Filtered AndroidRuntime/ReactNativeJS error log was empty.

The fixture account/data are explicitly synthetic. These results do not establish real ERP/Vega contract acceptance, server idempotency, scanner hardware behavior, printer behavior, older Android compatibility or production signing. Messaging controls were never invoked. Source clones and the user's existing AVD were preserved. Detailed screenshots, hashes and request evidence are recorded by the Development OS commerce audit.

## Queue-safety APK regression

The subsequent release APK SHA-256 `2ce8372b1e4f3e44a966c4ee301781578f11ed6393f6cb2ab2f08568da96f9a0` was installed over the test app without clearing its data. The previous two-product/one-customer cache and 275 TRY queued draft survived. Login and editing/resaving that draft still left exactly one record.

With the error-only fixture enabled, one explicit submit returned TERMINAL_SALE_OUTCOME_UNVERIFIED. The record remained for manual review with no edit/send/delete controls, no sent receipt and no automatic retry after an app restart. A new offline barcode/Enter lookup produced the correct 125 TRY product; an unknown barcode cleared the prior selected product and message without changing the existing line. Force-stop/restart recovered that one-line working draft. Android Back opened the draft-protection dialog; Save and Exit created one new 125 TRY pending record alongside the preserved manual-review record.

Filtered AndroidRuntime/ReactNativeJS errors: zero. The regression recorded 23 fixture requests: one login, one simulated sale failure, one offline toggle and reads. Messaging requests and real business operations: zero. The emulator and fixture were stopped with test data retained. This closes the previously pending native regression for this APK; physical scanner/printing and a real ERP read-contract UI flow remain outside this acceptance.
