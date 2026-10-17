# ERP09 selected-source UI integration — 18 October 2026

Base: PR47 `51aa9ba22a3aa1c0ddac18a788e382b368773904`. UI source: PR45 `2910efb3f5fbdd4bcf3fcf3802cd78863175273b`.

Eleven source/test files carried forward. Ten match PR45 exactly. The only source overlap, workingCatalogSession.mjs, adds the PR45 explicit selected-source transport while preserving PR47 customerContactRecovery unchanged. No backend, native policy, dependencies or CI configuration changes.

93/93 targeted offline tests pass, zero failures/skips, Node24.19.0. Six suites: workCollectionsSelectedSource, selectedSourceCollectionHandoff, workingCatalogSession, customerContactSession, workTrade and readOnlyNavigation. Root independently reviewed the session delta and ran seven handoff/contact transport tests (included in the 93; do not add them). Synthetic service state and DOM doubles prove partial/full/cancel/replay and identity/route refusal; these are not a real browser or actual SQL execution.

No installation, SQL/grants, native writer activation, runtime/service changes, commercial data, customer messages, migration, main merge or human acceptance. Existing TRY500 selected native contract and default-closed API remain. General customer/currency collection remains open. Original counts unchanged. Exact new head CI must be checked separately.
