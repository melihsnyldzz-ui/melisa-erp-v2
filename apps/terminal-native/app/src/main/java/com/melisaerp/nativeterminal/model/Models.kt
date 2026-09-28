package com.melisaerp.nativeterminal.model

import kotlinx.serialization.Serializable
import java.math.BigDecimal
import java.math.RoundingMode
import java.text.NumberFormat
import java.util.Locale
import java.util.UUID

@Serializable data class Customer(val id: Long, val code: String, val name: String, val currency: String,
    val isCash: Boolean? = null, val routeId: Long? = null, val routeName: String? = null)
@Serializable data class CustomerRoute(val id: Long, val code: String, val name: String)
@Serializable data class Quote(
    val productId: Long, val stockCode: String, val productName: String,
    val barcode: String = "", val barcodes: List<String> = emptyList(), val stock: String,
    val unitPrice: String, val currency: String, val exchangeRate: String,
    val customerId: Long, val quoteToken: String, val quotedAt: String,
    val category: String? = null,
    val priceScope: String = "customer",
)
@Serializable data class Line(val quote: Quote, val quantity: Int = 1, val unitPrice: String = quote.unitPrice) {
    val overridden get() = unitPrice.toBigDecimal().compareTo(quote.unitPrice.toBigDecimal()) != 0
    val total get() = unitPrice.toBigDecimal().multiply(quantity.toBigDecimal())
}
@Serializable data class AuditChange(
    val id: String = UUID.randomUUID().toString(), val field: String, val productId: Long? = null,
    val oldValue: String, val newValue: String, val actorId: Long, val at: String = java.time.Instant.now().toString(),
)
@Serializable enum class DraftState { DRAFT, SUBMITTING, REVIEW_REQUIRED, COMPLETED, CANCELLED }
enum class ReceiptGroup { WAITING, DRAFTS, SENT, REVIEW }
@Serializable data class Receipt(
    val invoiceId: Long, val documentNumber: String, val documentDate: String, val status: String,
    val customerName: String, val currency: String, val grandTotal: String,
)
@Serializable data class Draft(
    val id: String = UUID.randomUUID().toString(), val owner: String, val actorId: Long,
    val customer: Customer, val lines: List<Line> = emptyList(), val discountRate: String = "0",
    val note: String = "", val changes: List<AuditChange> = emptyList(),
    val state: DraftState = DraftState.DRAFT, val receipt: Receipt? = null,
    val updatedAt: Long = System.currentTimeMillis(), val submissionJson: String? = null,
    val approvalToken: String? = null,
    val onHold: Boolean = false, val holdNote: String = "",
) {
    val canDeleteLocally get() = state == DraftState.DRAFT && receipt == null && submissionJson == null
    val discardableOnExit get() = canDeleteLocally && lines.isEmpty()
    val receiptGroup get() = when {
        state in setOf(DraftState.COMPLETED, DraftState.CANCELLED) && receipt != null -> ReceiptGroup.SENT
        canDeleteLocally -> if (onHold) ReceiptGroup.WAITING else ReceiptGroup.DRAFTS
        else -> ReceiptGroup.REVIEW
    }
    fun hold(note: String): Draft {
        editable()
        require(lines.isNotEmpty()) { "Boş fiş beklemeye alınamaz." }
        return copy(onHold = true, holdNote = note.trim().take(240), updatedAt = System.currentTimeMillis())
    }
    fun resumeFromHold(): Draft {
        editable()
        return copy(onHold = false, updatedAt = System.currentTimeMillis())
    }
    fun editHoldNote(note: String): Draft {
        editable()
        check(onHold) { "Bu fiş beklemeye alınmamış." }
        return copy(holdNote = note.trim().take(240), updatedAt = System.currentTimeMillis())
    }
    val subtotal get() = lines.fold(BigDecimal.ZERO) { a, l -> a + l.total }
    val total get() = (subtotal * (BigDecimal.ONE - discountRate.toBigDecimal().divide(BigDecimal(100)))).setScale(2, RoundingMode.HALF_UP)
    val quantity get() = lines.sumOf { it.quantity }
    fun editable() { check(canDeleteLocally) { "Bu fişin sonucu kontrol edilmeli; satırları değiştirilemez." } }
    fun add(quote: Quote, quantity: Int): Draft {
        editable(); require(quantity in 1..99999); require(quote.customerId == customer.id && quote.currency == customer.currency)
        val old = lines.find { it.quote.productId == quote.productId }
        // A repeat add keeps the price captured by the existing receipt line.
        val line = old?.copy(quantity = Math.addExact(old.quantity, quantity)) ?: Line(quote, quantity)
        require(line.quantity <= 99999)
        return changed(copy(lines = listOf(line) + lines.filterNot { it.quote.productId == quote.productId }))
    }
    fun quantity(productId: Long, quantity: Int): Draft {
        editable(); require(quantity in 1..99999)
        return changed(copy(lines = lines.map { if (it.quote.productId == productId) it.copy(quantity = quantity) else it }))
    }
    fun remove(productId: Long): Draft { editable(); return changed(copy(lines = lines.filterNot { it.quote.productId == productId })) }
    fun price(productId: Long, value: String): Draft {
        editable(); val price = decimal(value); require(price > BigDecimal.ZERO && price.scale() <= 2)
        val old = lines.first { it.quote.productId == productId }
        return changed(copy(lines = lines.map { if (it == old) it.copy(unitPrice = price.toPlainString()) else it },
            changes = changes + AuditChange(field = "price", productId = productId, oldValue = old.unitPrice, newValue = price.toPlainString(), actorId = actorId)))
    }
    fun discount(value: String): Draft {
        editable(); val rate = decimal(value); require(rate >= BigDecimal.ZERO && rate < BigDecimal(100) && rate.scale() <= 2)
        return changed(copy(discountRate = rate.toPlainString(), changes = changes + AuditChange(field = "discount", oldValue = discountRate, newValue = rate.toPlainString(), actorId = actorId)))
    }
    private fun changed(next: Draft) = next.copy(updatedAt = System.currentTimeMillis(), approvalToken = null, submissionJson = null)
}
fun decimal(value: String): BigDecimal = value.trim().replace(',', '.').toBigDecimal()
fun money(value: String, currency: String): String = money(value.toBigDecimal(), currency)
fun money(value: BigDecimal, currency: String): String = NumberFormat.getNumberInstance(Locale.forLanguageTag("tr-TR")).apply {
    minimumFractionDigits = 2; maximumFractionDigits = 2
}.format(value) + " " + when (currency) { "USD" -> "$"; "EUR" -> "€"; else -> "₺" }

@Serializable data class User(val id: Long, val username: String, val displayName: String = "", val permissions: List<String> = emptyList())
@Serializable data class Session(val accessToken: String, val refreshToken: String? = null, val user: User) {
    fun renewedBy(next: Session): Session {
        check(next.user.id == user.id) { "Oturum personeli değişti." }
        require(next.accessToken.isNotBlank())
        return next.copy(refreshToken = next.refreshToken?.takeIf { it.isNotBlank() } ?: refreshToken)
    }
}
@Serializable data class Settings(val apiUrl: String = "", val terminalCode: String = "TERM-V2-001")
@Serializable data class Bootstrap(val customers: List<Customer>, val canChangeSalePrice: Boolean, val employeeName: String, val maxDiscount: Int = 5, val saleEnabled: Boolean = false,
    val scope: String? = null, val customerScopeRevision: String = "", val routes: List<CustomerRoute> = emptyList(),
    val customerScopeWarning: String? = null)
@Serializable data class SaleResult(val state: String, val receipt: Receipt? = null, val mayResend: Boolean = false) {
    fun permitsResubmit(draft: Draft) = state == "NOT_FOUND" && mayResend && receipt == null &&
        draft.receipt == null && draft.submissionJson != null &&
        draft.state in setOf(DraftState.SUBMITTING, DraftState.REVIEW_REQUIRED)
}
