package com.melisaerp.nativeterminal

import com.google.zxing.BinaryBitmap
import com.google.zxing.RGBLuminanceSource
import com.google.zxing.common.HybridBinarizer
import com.google.zxing.qrcode.QRCodeReader
import com.melisaerp.nativeterminal.model.*
import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class ReceiptPdfShareTest {
    private val now = Instant.parse("2026-09-15T10:00:00Z").toEpochMilli()
    private val settings = Settings("http://192.168.1.46:4116", "TERM-V2-001")
    private val url = settings.apiUrl + "/native-receipts/" + "x".repeat(43) + ".pdf"
    private val share = ReceiptPdfShare(url, Instant.ofEpochMilli(now + 600_000).toString(), "MN-TEST")
    private val receipt = Receipt(123, "MN-TEST", "2026-09-15", "FINALIZED", "Peşin", "USD", "12.80")
    private val completed = Draft(id = "sent", owner = "local|terminal|1", actorId = 1,
        customer = Customer(10, "1-PEŞİN", "Peşin", "USD"), state = DraftState.COMPLETED, receipt = receipt)

    @Test fun onlyCompletedFinalizedReceiptsCanBeShared() {
        assertTrue(completed.canSharePdf)
        for (state in DraftState.entries.filter { it != DraftState.COMPLETED }) assertFalse(completed.copy(state = state).canSharePdf)
        assertFalse(completed.copy(receipt = null).canSharePdf)
        for (status in listOf("DRAFT", "CANCELLED", "FINALIZING", "")) assertFalse(completed.copy(receipt = receipt.copy(status = status)).canSharePdf)
        assertFalse(completed.copy(receipt = receipt.copy(invoiceId = 0)).canSharePdf)
    }

    @Test fun shareAcceptsOnlyTheExpectedServerPdfPathWithoutCredentials() {
        assertEquals(now + 600_000, validatePdfShare(share, settings, now))
        val bad = listOf(
            url.replace("192.168.1.46", "192.168.1.47"), url.replace(":4116", ":4114"),
            url.replace("http:", "https:"), url.replace("http://", "http://user:pass@"),
            url + "?accessToken=secret", url + "#secret", url.replace("native-receipts", "api/sales"),
            url.replace(".pdf", ".html"), url.replace("x".repeat(43), "x".repeat(42)),
            "javascript:alert(1)", "http://[broken", "",
        )
        bad.forEach { assertThrows(IllegalArgumentException::class.java) { validatePdfShare(share.copy(url = it), settings, now) } }
        assertThrows(IllegalArgumentException::class.java) {
            validatePdfShare(share.copy(url = url.replace("192.168.1.46", "127.0.0.1")), settings.copy(apiUrl = "http://127.0.0.1:4116"), now)
        }
    }

    @Test fun expiredInvalidOrExcessivelyLongSharesAreRejected() {
        for (expiry in listOf("broken", Instant.ofEpochMilli(now).toString(), Instant.ofEpochMilli(now - 1).toString(), Instant.ofEpochMilli(now + 16 * 60_000).toString())) {
            assertThrows(IllegalArgumentException::class.java) { validatePdfShare(share.copy(expiresAt = expiry), settings, now) }
        }
        assertThrows(IllegalArgumentException::class.java) { validatePdfShare(share.copy(documentNumber = ""), settings, now) }
    }

    @Test fun qrRoundTripsTheShareUrlAndTurkishUnicodeWithoutInterpolation() {
        for (text in listOf(url, "https://örnek.test/fiş/İĞŞçöü?müşteri=Melisa")) {
            val qr = receiptQr(text)
            val side = qr.size * 8
            val pixels = IntArray(side * side) { index -> if (qr.dark((index % side) / 8, (index / side) / 8)) 0xff000000.toInt() else 0xffffffff.toInt() }
            val decoded = QRCodeReader().decode(BinaryBitmap(HybridBinarizer(RGBLuminanceSource(side, side, pixels))))
            assertEquals(text, decoded.text)
            for (n in 0 until qr.size) for (margin in 0..3) {
                assertFalse(qr.dark(n, margin)); assertFalse(qr.dark(margin, n))
                assertFalse(qr.dark(n, qr.size - margin - 1)); assertFalse(qr.dark(qr.size - margin - 1, n))
            }
        }
    }

    @Test fun dismissedSupersededOrChangedReceiptCannotReceiveALateShare() {
        val key = PdfShareRequestKey(5, completed.owner, Screen.RECEIPTS, completed)
        fun matches(id: Long? = 5, owner: String = completed.owner, screen: Screen = Screen.RECEIPTS,
            group: ReceiptGroup = ReceiptGroup.SENT, draft: Draft? = completed) = pdfShareStillVisible(key, id, owner, screen, group, draft)
        assertTrue(matches())
        assertFalse(matches(id = null)); assertFalse(matches(id = 6)); assertFalse(matches(owner = "another-personnel"))
        assertFalse(matches(screen = Screen.HOME)); assertFalse(matches(screen = Screen.SALE)); assertFalse(matches(group = ReceiptGroup.DRAFTS))
        assertFalse(matches(draft = null)); assertFalse(matches(draft = completed.copy(id = "another-receipt")))
        assertFalse(matches(draft = completed.copy(state = DraftState.CANCELLED)))
        assertFalse(matches(draft = completed.copy(updatedAt = completed.updatedAt + 1)))
    }

    @Test fun completedSaleDetailMayShareWithoutChangingReceiptGroup() {
        val key = PdfShareRequestKey(7, completed.owner, Screen.SALE, completed)
        assertTrue(pdfShareStillVisible(key, 7, completed.owner, Screen.SALE, ReceiptGroup.DRAFTS, completed))
        assertFalse(pdfShareStillVisible(key, 7, completed.owner, Screen.SALE, ReceiptGroup.SENT, completed.copy(receipt = receipt.copy(status = "CANCELLED"))))
    }
}
