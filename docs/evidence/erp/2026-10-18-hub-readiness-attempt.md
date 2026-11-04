# Hub readiness retry identity fix — 18 October 2026

Scope: P03 installation source blocker only. PowerShell variable names are case-insensitive; the readiness poll counter previously overwrote the caller's Attempt parameter, changing receipt identity and filenames. The polling counter is now independent; retry validation, receipt fields, watcher checks and ownership controls are unchanged.

Verification: regression source check fails before the change and passes after it; three relevant local static checks pass; JavaScript syntax passes. Existing Windows CI runs the extended p03-hub-lineage.test.mjs with 12 in-memory PowerShell scenarios (caller attempts 0–3, immediate/delayed readiness and timeout). Actual Windows CI outcome must be read on the exact PR head; local Linux has no PowerShell and is not Windows runtime evidence.

No Windows tasks, services, DB02, Vega, credentials, business data, package installation or LIVE change occurred. Real owner installation/recovery, CRM/Hub access and device/human acceptance remain open. No completion percentages or original acceptance counts change.
