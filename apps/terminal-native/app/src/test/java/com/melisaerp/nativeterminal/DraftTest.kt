package com.melisaerp.nativeterminal

import com.melisaerp.nativeterminal.model.*
import com.melisaerp.nativeterminal.data.ErpApi
import org.junit.Assert.*
import org.junit.Test

class DraftTest {
    @Test fun onlyExplicitRejectionUnlocksSubmittedDraft() {
        assertTrue(com.melisaerp.nativeterminal.data.ApiFailure(403,"NATIVE_PRICE_PERMISSION","rejected").saleRejectedBeforeCommit)
        for (code in listOf("NATIVE_COMMIT_UNCONFIRMED","NATIVE_EFFECT_UNVERIFIED","NATIVE_IDEMPOTENCY_CONFLICT","NATIVE_RECEIPT_OWNER","NATIVE_RECEIPT_REVIEW","API_ERROR"))
            assertFalse(com.melisaerp.nativeterminal.data.ApiFailure(409,code,"unknown").saleRejectedBeforeCommit)
        assertFalse(com.melisaerp.nativeterminal.data.ApiFailure(503,"NATIVE_PRICE_PERMISSION","unavailable").saleRejectedBeforeCommit)
    }
    private val customer = Customer(10, "1-PEŞİN $", "Peşin USD", "USD")
    private fun quote(id: Long = 1, price: String = "12.80", stock: String = "16") = Quote(id, "3067", "Ayıcık Takım", "1234567890", listOf("1234567890"), stock, price, "USD", "47.8", 10, "signed-test", "2026-09-14T12:00:00Z")
    private fun draft() = Draft(owner = "test|1", actorId = 1, customer = customer)
    @Test fun missingReceiptCanRetryOnlyUnconfirmedFirstSubmission() {
        val pending = draft().copy(state = DraftState.REVIEW_REQUIRED, submissionJson = "frozen-payload")
        val missing = SaleResult("NOT_FOUND", mayResend = true)
        assertTrue(missing.permitsResubmit(pending))
        assertFalse(missing.copy(mayResend = false).permitsResubmit(pending))
        assertFalse(missing.permitsResubmit(pending.copy(submissionJson = null)))
        assertFalse(missing.permitsResubmit(pending.copy(state = DraftState.DRAFT)))
        val receipt = Receipt(123, "MN-TEST", "2026-09-14", "FINALIZED", "Cash", "USD", "12.80")
        assertFalse("Lost cancellation must never become a new sale", missing.permitsResubmit(pending.copy(receipt = receipt)))
        assertFalse(missing.permitsResubmit(pending.copy(state = DraftState.COMPLETED, receipt = receipt)))
    }
    @Test fun previewDoesNotMutateReceipt() { val d = draft(); val preview = quote(); assertTrue(d.lines.isEmpty()); assertEquals("12.80", preview.unitPrice) }
    @Test fun repeatAddMergesAndKeepsOriginalPrice() { val d = draft().add(quote(), 2).add(quote(price="19.00"), 1); assertEquals(1, d.lines.size); assertEquals(3, d.quantity); assertEquals("12.80", d.lines.single().unitPrice); assertEquals("38.40", d.total.toPlainString()) }
    @Test fun latestAddedProductAtTop() { val d = draft().add(quote(1),1).add(quote(2),1).add(quote(1),1); assertEquals(listOf(1L,2L),d.lines.map { it.quote.productId }) }
    @Test fun negativeStockCanBeAdded() { assertEquals(1, draft().add(quote(stock="-2"),1).quantity) }
    @Test fun quantityAndDelete() { val d = draft().add(quote(),1).quantity(1, 12); assertEquals(12,d.quantity); assertTrue(d.remove(1).lines.isEmpty()) }
    @Test fun priceAuditCarriesOriginalAndActor() { val d = draft().add(quote(),1).price(1,"10,50"); assertEquals("12.80",d.changes.single().oldValue); assertEquals("10.50",d.changes.single().newValue); assertEquals(1L,d.changes.single().actorId); assertTrue(d.lines.single().overridden); assertEquals("12.80",d.lines.single().quote.unitPrice) }
    @Test fun discountIsReceiptWide() { val d=draft().add(quote(),2).discount("5"); assertEquals("24.32",d.total.toPlainString()); assertEquals("12.80",d.lines.single().unitPrice) }
    @Test fun newSaleDoesNotReuseIdentityOrRows() { val old=draft().add(quote(),1); val next=draft(); assertNotEquals(old.id,next.id); assertEquals(1,old.lines.size); assertTrue(next.lines.isEmpty()) }
    @Test fun wrongCustomerOrCurrencyCannotMix() { assertThrows(IllegalArgumentException::class.java) { draft().add(quote().copy(currency="EUR"),1) }; assertThrows(IllegalArgumentException::class.java) { draft().add(quote().copy(customerId=11),1) } }
    @Test fun finalizedAndPendingReceiptsAreImmutable() { for(state in DraftState.entries.filter { it!=DraftState.DRAFT }) { val d=draft().add(quote(),1).copy(state=state); assertThrows(IllegalStateException::class.java) { d.add(quote(),1) }; assertThrows(IllegalStateException::class.java) { d.price(1,"5") }; assertThrows(IllegalStateException::class.java) { d.remove(1) } } }
    @Test fun invalidQuantitiesAndDiscountsRejected() { assertThrows(IllegalArgumentException::class.java) { draft().add(quote(),0) }; assertThrows(IllegalArgumentException::class.java) { draft().add(quote(),100000) }; assertThrows(IllegalArgumentException::class.java) { draft().discount("100") }; assertThrows(IllegalArgumentException::class.java) { draft().discount("-1") } }
    @Test fun editInvalidatesApproval() { val d=draft().add(quote(),1).copy(approvalToken="approval"); assertNull(d.quantity(1,2).approvalToken); assertNull(d.discount("4").approvalToken) }
    @Test fun unsafeServersRejected() { for(url in listOf("http://public.example.com","https://user:pass@example.com","https://example.com?token=secret","file:///tmp/api")) assertThrows(IllegalArgumentException::class.java) { ErpApi.validateUrl(url) }; assertEquals("http://192.168.1.46:4116",ErpApi.validateUrl("http://192.168.1.46:4116/")) }
}
