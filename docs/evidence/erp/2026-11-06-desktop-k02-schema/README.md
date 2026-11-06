# K02-02 / K02-05 — installed V3 schema and K01-04 normal logout

K02-02's required table/column/FK/index comparison passed on the current dedicated desktop TEST. K02-05's draft/reservation/carton structures are included in the same complete comparison. No installation, rollback, sale, account/grant or service operation was repeated.

Target: `Semih\MELISAERP / MELISA_ERP_DESKTOP_TEST_20261105`, database5 / GUID `c67f5317-9c0d-4831-aadd-fadc379a95d1`, marker schema3. Observed through a fresh Windows integrated Shared Memory connection; server PID5240, administrator SID, exact database/server and environment marker were checked before metadata SELECTs.

Installed package `99C6DA2B7278DA9EF4A32F1FAC8DE57FC01E599DB3BD8CD645D3ECC9089D7AE3`; source head `701bc1b694b2b6393ecaacbefd2e09efb9bde2f1`. The collector verified this Git HEAD, a clean tracked tree and all184 installed source byte hashes before invoking the offline compilers. Sixty-one emitted batches include the initial foundation, native catalog, fourteen sales-currency columns, local master tables, sales workflow tables, V2 marker transition and V3 supplier transition. SQL strings were parsed offline; they were never sent to SQL.

| Compared scope | Result |
| --- | --- |
| User tables | All36, exact set, dbo only |
| Columns | All422: exact set, type, string/binary size, decimal precision/scale, datetime scale, nullability, identity seed/increment, no computed/sparse columns |
| Foreign keys | All47: ordered child/reference column mapping, referenced table, NO_ACTION actions, enabled/trusted/not-for-replication status |
| Indexes, including PK/UQ | All83: unique/PK/UQ/type, ordered keys/direction, included fields, finite filters, disabled/hypothetical/IGNORE_DUP_KEY flags |
| CHECK constraints | All30 names/parents, enabled/trusted status |

CHECK/default expression semantic equality is not claimed. Unnamed native PKs match their structure; named constraints/indexes match their catalog identity under the target's case-insensitive identifier rules. Two conditional migration ADDs already exist in the initial foundation and were checked for an identical column definition before being skipped. Empty included-column JSON subqueries are represented by SQL as NULL and interpreted as an empty list; other missing structures fail closed.

`k02-02-schema-comparison.json` records `K02_PACKAGE_SCHEMA_MATCH`, zero differences. Inventory SHA256 `7dad19e09987d1d94cad69b09cda4de38e2acd71dae97222c52074780ddfb4e9`; observed metadata object SHA256 `4fece4310a128f3baa401815e17de54f7af23076dabe8aa6fb4326b672c37fea`. The comparator pins the exact source and metadata input digests, source commit, installed manifest digest and per-batch hashes.

Thirteen offline altered-capture checks all rejected missing tables, changed column type/size/nullability/decimal scale, wrong FK target, untrusted FK, changed index order/filter/include/IGNORE_DUP_KEY, and missing/replaced CHECK names. These mutate in-memory captures only and never contact SQL or overwrite the real observation. Reproduce the positive comparison with `node compare-k02-schema.mjs --verify-capture` (read-only; no artifact rewrite) from this directory. The collector/observers are archived as `.txt` for inspection of the original fixed-target capture, not as new installation commands. The first comparator-only name-case diagnostic is preserved outside Git under `Desktop/ERP/kurulum`; it did not perform SQL writes.

Independent source review found the CHECK-set, source provenance and index option coverage gaps; these were corrected before the final comparison. The reviewer performed read-only inspection only; root executed all code/SQL/browser checks.

K01-04: a fresh normal `erp_deneme` login displayed the authenticated user and permitted menus; normal “Çıkış yap” returned the login form. Browser reload and the home button remained unauthenticated with no customer/product/sales menus. `k01-04-normal-logout.json` records this agent GUI result. Screenshot: `C:/Users/Xaser/Desktop/ERP/kanit/v3-cikis-yenileme-giris-gerekli.png`. No claim is made about revocation of a copied old bearer token, which was not inspected. The reader `kurulum` account and passwords were not changed.

Human commercial acceptance, LAN/LIVE, and full ERP completion remain pending. K07 purchasing/inbound work remains the second delivery; its V4 source investigation is preserved. The next R1 work is the remaining card atomicity/error handling and normal-session/card/sales acceptance gaps, using existing valid sales/restore evidence instead of repeating it.
