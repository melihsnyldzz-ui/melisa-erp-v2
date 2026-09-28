package com.melisaerp.nativeterminal

import com.melisaerp.nativeterminal.model.CategoryReport
import com.melisaerp.nativeterminal.model.CategoryReportLine
import com.melisaerp.nativeterminal.model.Quote
import com.melisaerp.nativeterminal.model.groups
import java.math.BigDecimal
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.junit.Assert.*
import org.junit.Test

class CategoryReportTest {
    private fun line(
        id: Long = 1,
        category: String? = "Takım",
        quantity: String = "1",
        price: String = "10",
        originalTotal: String? = null,
    ) = CategoryReportLine(id, "ST-$id", "Ürün $id", category, quantity, price, originalTotal)

    private fun report(vararg lines: CategoryReportLine, discount: String = "0") =
        CategoryReport(currency = "USD", discountRate = discount, items = lines.toList())

    private fun assertDecimal(expected: String, actual: BigDecimal) {
        assertEquals("Expected $expected, received ${actual.toPlainString()}", 0, BigDecimal(expected).compareTo(actual))
    }

    @Test fun averageIsWeightedByQuantityRatherThanAveragingUnitPrices() {
        val group = report(line(quantity = "1", price = "10"), line(id = 2, quantity = "9", price = "2")).groups().single()
        assertDecimal("10", group.quantity)
        assertDecimal("28", group.totalAmount)
        assertDecimal("2.8", group.averagePrice)
        assertEquals(2, group.lineCount)
    }

    @Test fun allRawLinesBeyondFortyAreIncluded() {
        val lines = (1L..64L).map { line(id = it, quantity = "1", price = "0.10") }
        val group = CategoryReport(currency = "USD", items = lines).groups().single()
        assertEquals(64, group.lineCount)
        assertEquals(lines, group.items)
        assertDecimal("64", group.quantity)
        assertDecimal("6.4", group.totalAmount)
        assertDecimal("0.1", group.averagePrice)
    }

    @Test fun originalLineTotalsTakePrecedenceAndHeaderDiscountIsNotApplied() {
        val lines = arrayOf(line(quantity = "2", price = "5", originalTotal = "9.99"), line(id = 2, price = "2"))
        val undiscounted = report(*lines).groups()
        val discounted = report(*lines, discount = "50").groups()
        assertEquals(undiscounted, discounted)
        assertDecimal("11.99", discounted.single().totalAmount)
        assertDecimal("3", discounted.single().quantity)
    }

    @Test fun quantitySortPrecedesTurkishAlphabeticalTieOrder() {
        val names = listOf("Şapka", "İçlik", "Çorap", "Suluk", "Islak", "Ceket")
        val lines = names.mapIndexed { index, name -> line(id = index.toLong(), category = name, quantity = "2") } +
            line(id = 100, category = "Zıbın", quantity = "2.001")
        assertEquals(listOf("Zıbın", "Ceket", "Çorap", "Islak", "İçlik", "Suluk", "Şapka"),
            CategoryReport(currency = "USD", items = lines).groups().map { it.category })
    }

    @Test fun missingLegacyCategoryAndKnownEmptyCategoryRemainDistinct() {
        val legacy = Json.decodeFromString<CategoryReport>("""{
            "currency":"USD","items":[
              {"productId":1,"stockCode":"A","productName":"A","quantity":"1","unitPrice":"2"},
              {"productId":2,"stockCode":"B","productName":"B","category":null,"quantity":"2","unitPrice":"3"},
              {"productId":3,"stockCode":"C","productName":"C","category":"","quantity":"4","unitPrice":"1"}
            ]
        }""")
        assertNull(legacy.invoiceId)
        assertEquals("0", legacy.discountRate)
        val groups = legacy.groups().associateBy { it.category }
        assertEquals(setOf("Kategori bilgisi yok", "Kategorisiz"), groups.keys)
        assertEquals(2, groups.getValue("Kategori bilgisi yok").lineCount)
        assertDecimal("3", groups.getValue("Kategori bilgisi yok").quantity)
        assertDecimal("4", groups.getValue("Kategorisiz").quantity)
        assertEquals(legacy, Json.decodeFromString<CategoryReport>(Json.encodeToString(legacy)))
    }

    @Test fun legacyQuoteJsonDefaultsCategoryToUnknownAndEmptyStringSurvives() {
        val legacyJson = """{"productId":1,"stockCode":"ST-1","productName":"Ürün","stock":"1",
            "unitPrice":"2.50","currency":"USD","exchangeRate":"47.80","customerId":10,
            "quoteToken":"unit-test-quote","quotedAt":"2026-09-15T12:00:00Z"}"""
        val legacy = Json.decodeFromString<Quote>(legacyJson)
        assertNull(legacy.category)
        val knownEmpty = legacy.copy(category = "")
        assertEquals("", Json.decodeFromString<Quote>(Json.encodeToString(knownEmpty)).category)
        assertEquals(legacy, Json.decodeFromString<Quote>(Json.encodeToString(legacy)))
    }

    @Test fun categoryCaseAndWhitespaceAreNeverNormalized() {
        val names = listOf("Takım", "takım", "Takım ", " Takım", " ")
        val groups = CategoryReport(currency = "USD", items = names.mapIndexed { index, name ->
            line(id = index.toLong(), category = name)
        }).groups()
        assertEquals(names.toSet(), groups.map { it.category }.toSet())
        assertEquals(names.size, groups.size)
        assertTrue(groups.all { it.lineCount == 1 })
    }

    @Test fun repeatedProductsStaySeparateRawLinesAndDecimalsAreNotRoundedEarly() {
        val lines = arrayOf(line(quantity = "0.125", price = "0.20"), line(quantity = "0.375", price = "0.30"))
        val group = report(*lines).groups().single()
        assertEquals(2, group.lineCount)
        assertEquals(lines.toList(), group.items)
        assertDecimal("0.500", group.quantity)
        assertDecimal("0.1375", group.totalAmount)
        assertDecimal("0.275", group.averagePrice)
    }

    @Test fun repeatingAverageHasDecimal128PrecisionWithoutChangingExactTotals() {
        val group = report(line(quantity = "3", price = "1", originalTotal = "1")).groups().single()
        assertDecimal("1", group.totalAmount)
        assertDecimal("0.3333333333333333333333333333333333", group.averagePrice)
    }

    @Test fun zeroQuantityLinesAreCountedAndZeroQuantityGroupHasZeroAverage() {
        val group = report(line(quantity = "0", price = "5"), line(id = 2, quantity = "0.000", price = "2")).groups().single()
        assertEquals(2, group.lineCount)
        assertDecimal("0", group.quantity)
        assertDecimal("0", group.totalAmount)
        assertDecimal("0", group.averagePrice)
        val mixed = report(line(quantity = "0", price = "5"), line(id = 2, quantity = "2", price = "3")).groups().single()
        assertEquals(2, mixed.lineCount)
        assertDecimal("3", mixed.averagePrice)
    }

    @Test fun invalidNumericValuesAreRejectedInsteadOfBecomingZero() {
        for (bad in listOf("", "not-a-number", "NaN", "Infinity", "1,20", "-1")) {
            assertThrows(IllegalArgumentException::class.java) { report(line(quantity = bad)).groups() }
            assertThrows(IllegalArgumentException::class.java) { report(line(price = bad)).groups() }
            assertThrows(IllegalArgumentException::class.java) { report(line(originalTotal = bad)).groups() }
            assertThrows(IllegalArgumentException::class.java) { report(line(), discount = bad).groups() }
        }
        // A supplied valid total does not hide an invalid unit price in the source line.
        assertThrows(IllegalArgumentException::class.java) { report(line(price = "bad", originalTotal = "2")).groups() }
    }

    @Test fun emptyReportContainsNoInventedGroups() {
        assertTrue(report().groups().isEmpty())
    }
}
