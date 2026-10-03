package com.melisaerp.nativeterminal

import com.melisaerp.nativeterminal.data.*
import com.melisaerp.nativeterminal.model.*
import org.junit.Assert.*
import org.junit.Test

class PackingCacheTest {
    private val item = PickingItem(11, 21, "P21", "Test", "2")
    private fun detail() = PickingDetail(1, "F-TEST", "Test", "2026-09-15", "FINALIZED", "a", listOf(item), sourceType = "sales_invoice", documentVersion = "v1")
    private fun header() = PickingOrder(1, "F-TEST", "Test", "2026-09-15", 1, "FINALIZED", documentVersion = "v1")
    @Test fun changedOrUnknownInvoiceVersionDoesNotShowCurrentPackedMark() {
        val saved = PickingProgress(detail()).quantity(11, "2").checked(detail())
        assertEquals("Paketlendi", packingListMark(header(), saved))
        assertEquals("Fiş değişmiş · kontrol edin", packingListMark(header().copy(documentVersion = "v2"), saved))
        assertEquals("Fiş değişmiş · kontrol edin", packingListMark(header().copy(documentVersion = ""), saved))
        assertEquals("Paketlendi", packingListMark(header().copy(documentVersion = ""), saved, "a"))
        assertEquals("Fiş değişmiş · kontrol edin", packingListMark(header().copy(documentVersion = ""), saved, "different"))
    }
    @Test fun completedAndPartialMarksBelongOnlyToSameFinalizedSalesReceipt() {
        val saved = PickingProgress(detail()).quantity(11, "1")
        assertEquals("Devam ediliyor", packingListMark(header(), saved))
        assertNull(packingListMark(header().copy(id = 2), saved))
        assertNull(packingListMark(header().copy(status = "CANCELLED"), saved))
        assertNull(packingListMark(header(), saved.copy(order = detail().copy(sourceType = "sales_order"))))
        assertNull(packingListMark(header(), PickingProgress(detail())))
    }
    @Test fun storageSeparatesServerDeviceInvoiceAndOldOrderNamespace() {
        val scope = Settings("http://192.168.1.46:4116", "TC21")
        val key = packingStorageKey(scope, 1)
        assertNotEquals(key, packingStorageKey(scope.copy(apiUrl = "http://192.168.1.46:4114"), 1))
        assertNotEquals(key, packingStorageKey(scope.copy(terminalCode = "TC22"), 1))
        assertNotEquals(key, packingStorageKey(scope, 2))
        assertTrue(key.startsWith("packing-sales-invoice-v1:"))
        assertFalse(key.startsWith("picking:"))
    }
    @Test fun legacyShortOrExcessCompletionNeverAppearsPackedAndCountsArePreserved() {
        for (count in listOf("0", "1", "3")) {
            val saved = PickingProgress(detail(), mapOf(11L to count), confirmedAt = 1)
            assertEquals("REVIEW_REQUIRED", saved.packingStatus)
            assertEquals("Adet farkı var · Yeniden kontrol gerekli", packingListMark(header(), saved))
            assertEquals(count, saved.counts[11])
        }
    }
    @Test fun auditedExceptionStaysSeparateAfterSerializationAndEditInvalidatesIt() {
        val progress = PickingProgress(detail()).quantity(11, "1")
        val event = PackingConfirmation("44", "PACKING_EXCEPTION", 1, "a", 2, "operator", "2026-09-17T12:00:00Z", "Test reason", "1", "0",
            listOf(PackingLineAudit(11, 21, "2", "1", "1", "0")))
        val saved = progress.audited(event)
        val restored = codec.decodeFromString<PickingProgress>(codec.encodeToString(PickingProgress.serializer(), saved))
        assertEquals("PACKING_EXCEPTION", restored.packingStatus)
        assertEquals("PACKING_EXCEPTION · Adet farkı var", packingListMark(header(), restored))
        assertEquals(event, restored.confirmation)
        assertNull(restored.quantity(11, "2").confirmation)
        assertNull(restored.withoutConfirmation().confirmedAt)
        try { progress.audited(event.copy(status = "PACKED")); fail("Mismatch must never be normal") } catch (_: IllegalArgumentException) { }
        try { progress.audited(event.copy(reason = "")); fail("Reason required") } catch (_: IllegalArgumentException) { }
    }
}
