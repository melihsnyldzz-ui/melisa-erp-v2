package com.melisaerp.nativeterminal.model

import kotlinx.serialization.Serializable
import java.math.BigDecimal

@Serializable data class UiPreferences(val sound: Boolean = true, val vibration: Boolean = true, val askToPrint: Boolean = true)
@Serializable data class CurrencyRate(val currency: String, val rateToTry: String? = null, val defined: Boolean, val rateDate: String)
@Serializable data class TerminalOptions(val rates: List<CurrencyRate>, val canEditRates: Boolean = false, val printerName: String = "", val paperFormat: String = "A4", val fetchedAt: String)
@Serializable data class PickingOrder(val id: Long, val documentNo: String, val customerName: String, val documentDate: String, val itemCount: Int, val status: String, val documentVersion: String = "")
@Serializable data class PickingPage(val orders: List<PickingOrder>, val page: Int, val hasMore: Boolean, val total: Int)
@Serializable data class PickingItem(val id: Long, val productId: Long, val stockCode: String, val productName: String, val quantity: String, val barcodes: List<String> = emptyList())
@Serializable data class PickingDetail(val id: Long, val documentNo: String, val customerName: String, val documentDate: String, val status: String, val revision: String, val items: List<PickingItem>, val sourceType: String = "", val documentVersion: String = "") {
    val isPackable get() = sourceType == "sales_invoice" && status == "FINALIZED"
}

private val packingMaximum = BigDecimal("999999999.999")
private val packingNumber = Regex("(?:[0-9]{1,12}(?:[.,][0-9]{1,3})?|[.,][0-9]{1,3})")
private fun packingQuantity(input: String): BigDecimal {
    val text = input.trim()
    require(packingNumber.matches(text)) { "Adedi en fazla 3 ondalık basamakla girin." }
    val value = decimal(text)
    require(value.signum() >= 0 && value <= packingMaximum) { "Adet 0 ile 999999999,999 arasında olmalı." }
    return value
}

@Serializable data class PackingLineAudit(val itemId: Long, val productId: Long, val expected: String, val counted: String, val missing: String, val extra: String)
@Serializable data class PackingConfirmation(val auditId: String, val status: String, val invoiceId: Long, val revision: String,
    val actorId: Long, val actorName: String, val recordedAt: String, val reason: String,
    val missingQuantity: String, val extraQuantity: String, val lines: List<PackingLineAudit>)
@Serializable data class PickingProgress(val order: PickingDetail, val counts: Map<Long, String> = emptyMap(), val confirmedAt: Long? = null,
    val confirmation: PackingConfirmation? = null) {
    fun count(id: Long): BigDecimal = counts[id]?.let(::packingQuantity) ?: BigDecimal.ZERO
    private fun item(id: Long): PickingItem = order.items.firstOrNull { it.id == id }
        ?: throw IllegalArgumentException("Bu ürün satırı fişte yok.")
    fun missingQuantity(id: Long): BigDecimal = (item(id).quantity.toBigDecimal() - count(id)).max(BigDecimal.ZERO)
    fun extraQuantity(id: Long): BigDecimal = (count(id) - item(id).quantity.toBigDecimal()).max(BigDecimal.ZERO)
    val totalMissingQuantity get() = order.items.fold(BigDecimal.ZERO) { total, item -> total + missingQuantity(item.id) }
    val totalExtraQuantity get() = order.items.fold(BigDecimal.ZERO) { total, item -> total + extraQuantity(item.id) }
    val totalCountedQuantity get() = order.items.fold(BigDecimal.ZERO) { total, item -> total + count(item.id) }
    val hasDifferences get() = order.items.any { count(it.id).compareTo(it.quantity.toBigDecimal()) != 0 }
    val complete get() = order.items.isNotEmpty() && !hasDifferences
    val completedLines get() = order.items.count { count(it.id).compareTo(it.quantity.toBigDecimal()) == 0 }
    val packingStatus get() = when {
        confirmation?.status == "PACKING_EXCEPTION" && confirmedAt != null -> "PACKING_EXCEPTION"
        confirmedAt != null && complete -> "PACKED"
        confirmedAt != null -> "REVIEW_REQUIRED"
        else -> "IN_PROGRESS"
    }
    fun withoutConfirmation() = copy(confirmedAt = null, confirmation = null)
    fun audited(result: PackingConfirmation): PickingProgress {
        require(result.invoiceId == order.id && result.revision == order.revision && result.auditId.isNotBlank() && result.actorId > 0)
        require(result.lines.size == order.items.size && result.lines.map { it.itemId }.toSet().size == order.items.size)
        result.lines.forEach { line ->
            val source = item(line.itemId)
            require(line.productId == source.productId && line.expected.toBigDecimal().compareTo(source.quantity.toBigDecimal()) == 0)
            require(line.counted.toBigDecimal().compareTo(count(line.itemId)) == 0)
            require(line.missing.toBigDecimal().compareTo(missingQuantity(line.itemId)) == 0 && line.extra.toBigDecimal().compareTo(extraQuantity(line.itemId)) == 0)
        }
        require(result.missingQuantity.toBigDecimal().compareTo(totalMissingQuantity) == 0 && result.extraQuantity.toBigDecimal().compareTo(totalExtraQuantity) == 0)
        require((result.status == "PACKED" && complete) || (result.status == "PACKING_EXCEPTION" && hasDifferences && result.reason.isNotBlank()))
        return copy(confirmedAt = java.time.Instant.parse(result.recordedAt).toEpochMilli(), confirmation = result)
    }

    private fun requirePackable() {
        require(order.isPackable) { "Paketleme için tamamlanmış bir satış fişi açın." }
    }

    fun quantity(id: Long, input: String): PickingProgress {
        requirePackable()
        item(id)
        val value = packingQuantity(input)
        return copy(counts = counts + (id to value.stripTrailingZeros().toPlainString()), confirmedAt = null, confirmation = null)
    }

    fun scan(input: String): PickingProgress {
        requirePackable()
        val code = input.trim()
        require(code.isNotEmpty()) { "Barkod veya ürün kodu girin." }
        val matching = order.items.filter { it.barcodes.contains(code) || it.stockCode.equals(code, ignoreCase = true) }
        require(matching.isNotEmpty()) { "Bu ürün fişte yok; başka bir ürün okutun." }
        require(matching.map { it.productId }.distinct().size == 1) { "Barkod birden fazla ürüne ait; ürün satırından adet girin." }
        // Repeated product lines fill in receipt order. Further scans remain visible as excess.
        val item = matching.firstOrNull { count(it.id) < it.quantity.toBigDecimal() } ?: matching.last()
        return quantity(item.id, (count(item.id) + BigDecimal.ONE).toPlainString())
    }

    fun checked(current: PickingDetail): PickingProgress {
        requirePackable()
        require(current.id == order.id && current.revision == order.revision && current.sourceType == order.sourceType && current.isPackable) {
            "Fiş değişti; paketleme listesini yeniden açın."
        }
        counts.forEach { (id, value) -> item(id); packingQuantity(value) }
        require(complete) { "Eksik veya fazla ürün varken normal paketleme tamamlanamaz." }
        return copy(confirmedAt = System.currentTimeMillis())
    }
}
