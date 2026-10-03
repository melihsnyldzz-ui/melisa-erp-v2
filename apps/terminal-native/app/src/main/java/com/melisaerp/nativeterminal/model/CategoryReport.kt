package com.melisaerp.nativeterminal.model

import kotlinx.serialization.Serializable
import java.math.BigDecimal
import java.math.MathContext
import java.text.Collator
import java.util.Locale

@Serializable data class CategoryReport(
    val invoiceId: Long? = null,
    val currency: String,
    val discountRate: String = "0",
    val items: List<CategoryReportLine>,
)

@Serializable data class CategoryReportLine(
    val productId: Long,
    val stockCode: String,
    val productName: String,
    val category: String? = null,
    val quantity: String,
    val unitPrice: String,
    val lineTotalOriginal: String? = null,
)

data class CategoryReportGroup(
    val category: String,
    val quantity: BigDecimal,
    val lineCount: Int,
    val totalAmount: BigDecimal,
    val averagePrice: BigDecimal,
    val items: List<CategoryReportLine>,
)

data class CategoryReportResult(val report: CategoryReport, val fromCache: Boolean)

/** Gross report: header discount is metadata and is never distributed over categories. */
fun CategoryReport.groups(): List<CategoryReportGroup> {
    reportDecimal(discountRate, "Fiş indirimi")
    val parsed = items.mapIndexed { index, line ->
        val quantity = reportDecimal(line.quantity, "${index + 1}. satır adedi")
        val unitPrice = reportDecimal(line.unitPrice, "${index + 1}. satır birim fiyatı")
        val amount = line.lineTotalOriginal?.let { reportDecimal(it, "${index + 1}. satır tutarı") }
            ?: quantity.multiply(unitPrice)
        ParsedCategoryReportLine(line, quantity, amount)
    }
    val collator = Collator.getInstance(Locale.forLanguageTag("tr-TR"))
    return parsed.groupBy { it.line.category }.map { (category, rows) ->
        val quantity = rows.fold(BigDecimal.ZERO) { total, row -> total.add(row.quantity) }
        val amount = rows.fold(BigDecimal.ZERO) { total, row -> total.add(row.amount) }
        CategoryReportGroup(
            category = when (category) {
                null -> "Kategori bilgisi yok"
                "" -> "Kategorisiz"
                else -> category
            },
            quantity = quantity,
            lineCount = rows.size,
            totalAmount = amount,
            // Keep precision for weighting; presentation decides the number of visible decimals.
            averagePrice = if (quantity.signum() == 0) BigDecimal.ZERO else amount.divide(quantity, MathContext.DECIMAL128),
            items = rows.map { it.line },
        )
    }.sortedWith { left, right ->
        val byQuantity = right.quantity.compareTo(left.quantity)
        if (byQuantity != 0) byQuantity else collator.compare(left.category, right.category)
    }
}

private data class ParsedCategoryReportLine(val line: CategoryReportLine, val quantity: BigDecimal, val amount: BigDecimal)

private fun reportDecimal(raw: String, field: String): BigDecimal {
    val value = raw.toBigDecimalOrNull()
        ?: throw IllegalArgumentException("$field geçerli bir sayı değil.")
    require(value.signum() >= 0) { "$field negatif olamaz." }
    return value
}
