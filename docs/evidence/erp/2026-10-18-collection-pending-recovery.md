# Collection pending recovery — 18 October 2026

Base PR50 c36e38d7e6d1b55d10ca57643779dc76c46dca7b (CI39077428145 SUCCESS).

Two failing-before defects: (1) cancellation with both returned collection copies changed from5 to6 incorrectly completed; (2) a committed payment with a lost reply was marked rejected/done when its later replay received403. Both were reproduced with real source/service fixtures and DOM doubles.

Cancellation captures its original amount before awaiting POST and matches the reply against it. Selected-source initial definitive4xx can finalize rejection; replay/restored pending4xx cannot prove the previous transaction did not commit, so preserves its original pending UUID and blocks a new intent. Existing generic collection behavior unchanged; no additional persistent field or shared journal schema.

New regressions check immutable cancellation amount, lost reply then repeated denial across remount and exact replay with one financial effect, and fresh409 allowing a new preview. Root source review GO; independent aggregate110/110PASS,0fail/0skip on Node24.19.0 (13backend+97six frontend test files). Count includes helper/subagent tests; do not add totals.

Source only. No SQL/native/runtime/installation/actual customer/physical GUI/human acceptance/main/migration. Existing native scope and default-closed endpoints remain. General customer/currency collection remains open; original49+25 counters unchanged. Exact new head CI is separate.
