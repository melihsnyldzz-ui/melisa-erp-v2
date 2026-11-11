# Single-product sales in the green desktop profile

The normal sale screen previously sent an empty second product slot to the preview API. The API and native workflow also required exactly two different products, so a valid one-product sale failed with a generic 503 response before a draft could be saved.

The screen now submits the selected product slots together with their matching quantity, quantity unit and optional price. Either visible slot can hold the only product. Preview, pricing approval, native draft, preparation/cartons, final check, dispatch, saved receipt and bounded cancellation accept one or two different products. Empty, duplicate, mismatched and more-than-two selections remain invalid. This change does not implement an arbitrary-length sale grid.

The persisted item count determines the exact expected reservations, stock movements and carton quantities. Dispatch still produces one customer/account posting for the invoice total. Native prices, costs, currencies, approvals, actor permissions, transaction scope, expected version, request UUID and replay checks remain mandatory. Two-product requests and their existing serialized bodies retain their meaning.

Targeted source tests cover either UI slot, series conversion, one-line price approval, real native draft/finalize with a synthetic transactional SQL driver, lost acknowledgement with the same request, and rollback on corrupt native outcomes. Existing two-product cases remain regression tests. These source tests do not establish installed SQL or normal-screen acceptance.

Installation and the one-product normal-screen/API/native readback are separate ERP-owner operations in the existing empty DB9 profile. The previous two-product synthetic invoice and its journal must remain unchanged. The coordinator owns the delivery plan; this document records behavior only. Full ERP, distinct business-role, collection, printing, device, final-empty-handover and human acceptance remain separate requirements.
