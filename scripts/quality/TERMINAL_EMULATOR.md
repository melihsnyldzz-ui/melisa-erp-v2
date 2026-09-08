# Terminal emulator rehearsal

Run only against a separate, empty Android AVD. The existing physical terminal and user AVD are outside this rehearsal.

`node scripts/quality/terminal-fixture-server.mjs` starts a synthetic service on 127.0.0.1:4719. It imports no database or upstream client. The only accepted POST requests are fixture login, refresh, logout and the offline toggle. Business submission routes are denied. Do not expose it on a LAN or use real credentials.

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
