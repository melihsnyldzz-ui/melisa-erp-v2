package com.melisaerp.nativeterminal

import com.melisaerp.nativeterminal.model.*
import com.melisaerp.nativeterminal.data.codec
import kotlinx.serialization.encodeToString
import org.junit.Assert.*
import org.junit.Test
import java.math.BigDecimal

class NavigationPickingTest {
    private fun order() = PickingDetail(1, "SAT-TEST", "TEST", "2026-09-15", "FINALIZED", "revision-a",
        listOf(PickingItem(11, 21, "TEST-21", "Test", "2", listOf("1001", "1002")), PickingItem(12, 22, "TEST-22", "Test 2", "1", listOf("1003"))),
        sourceType = "sales_invoice")
    private fun rejects(block: () -> Unit) { try { block(); fail("Expected rejection") } catch (_: IllegalArgumentException) { } }
    private fun sameQuantity(expected: String, actual: BigDecimal) = assertEquals(0, BigDecimal(expected).compareTo(actual))

    @Test fun backFollowsMenuHierarchy() {
        assertEquals(Screen.HOME, parentScreen(Screen.CUSTOMERS, true))
        assertEquals(Screen.CUSTOMERS, parentScreen(Screen.SALE, true))
        for (screen in listOf(Screen.RATES, Screen.PRINT_SETTINGS, Screen.SOUND_SETTINGS, Screen.CONNECTION)) assertEquals(Screen.SETTINGS, parentScreen(screen, true))
        assertEquals(Screen.ORDERS, parentScreen(Screen.PICKING, true))
        for (screen in listOf(Screen.PRODUCTS, Screen.RECEIPTS, Screen.SETTINGS, Screen.ORDERS)) assertEquals(Screen.HOME, parentScreen(screen, true))
        Screen.entries.forEach { assertEquals(Screen.LOGIN, parentScreen(it, false)) }
    }

    @Test fun alternateBarcodeCountsSameReceiptLineAndAllowsVisibleExcess() {
        val p = PickingProgress(order()).scan("1002").scan("1001")
        assertEquals("2", p.counts[11]); assertFalse(p.complete)
        val excess = p.scan("1001")
        assertEquals("3", excess.counts[11]); assertTrue(excess.hasDifferences)
        sameQuantity("1", excess.extraQuantity(11)); sameQuantity("1", excess.totalMissingQuantity)
        rejects { p.scan("unrelated") }
        assertTrue(p.scan("TEST-22").complete)
    }

    @Test fun duplicateProductLinesFillInOrderAndExcessRemainsOnLastLine() {
        val base = order()
        val p = PickingProgress(base.copy(items = listOf(base.items[0].copy(quantity = "1"), base.items[0].copy(id = 13, quantity = "1"))))
            .scan("1001").scan("1001")
        assertTrue(p.complete); assertEquals("1", p.counts[11]); assertEquals("1", p.counts[13])
        val excess = p.scan("1002")
        assertEquals("1", excess.counts[11]); assertEquals("2", excess.counts[13])
        sameQuantity("1", excess.totalExtraQuantity); assertEquals(1, excess.completedLines)
    }

    @Test fun ambiguousBarcodeCannotCountDifferentProducts() {
        val base = order()
        val p = PickingProgress(base.copy(items = base.items.map { it.copy(barcodes = listOf("shared")) }))
        rejects { p.scan("shared") }
        assertTrue(p.counts.isEmpty())
        assertEquals("1", p.quantity(11, "1").counts[11])
    }

    @Test fun rejectedScanLeavesLocalCountAndCompletionMarkUnchanged() {
        val p = PickingProgress(order()).quantity(11, "2").quantity(12, "1").checked(order())
        val before = codec.encodeToString(p)
        rejects { p.scan("not-in-receipt") }; rejects { p.scan(" ") }
        assertEquals(before, codec.encodeToString(p))
    }

    @Test fun quantityMayExceedReceiptAndEditingInvalidatesLocalCompletion() {
        val p = PickingProgress(order()).quantity(11, "2").quantity(12, "1").checked(order())
        assertNotNull(p.confirmedAt); assertNull(p.quantity(11, "1").confirmedAt)
        val excess = p.quantity(11, "3")
        assertNull(excess.confirmedAt); sameQuantity("1", excess.totalExtraQuantity)
        rejects { p.quantity(11, "-1") }; rejects { p.quantity(11, "0.1234") }
        rejects { p.quantity(999, "1") }
    }

    @Test fun checkedRejectsPartialAndExcessHelperCountsWithoutChangingReceipt() {
        val receipt = order()
        for (p in listOf(PickingProgress(receipt), PickingProgress(receipt).quantity(11, "1"), PickingProgress(receipt).quantity(11, "4"))) {
            assertTrue(p.hasDifferences)
            rejects { p.checked(receipt) }
            assertNull(p.confirmedAt); assertEquals(receipt, p.order)
        }
    }

    @Test fun checkedRequiresSameFinalizedSalesInvoiceAndRevision() {
        val p = PickingProgress(order()).quantity(11, "2").quantity(12, "1")
        rejects { p.checked(order().copy(id = 9)) }
        rejects { p.checked(order().copy(revision = "changed")) }
        rejects { p.checked(order().copy(status = "CANCELLED")) }
        rejects { p.checked(order().copy(status = "CONFIRMED")) }
        rejects { p.checked(order().copy(sourceType = "sales_order")) }
        rejects { p.checked(order().copy(sourceType = "")) }
    }

    @Test fun checkedRejectsInvalidRestoredCountsAndForeignLineKeys() {
        val receipt = order()
        for (counts in listOf(mapOf(999L to "1"), mapOf(11L to "-1"), mapOf(11L to "0.0001"), mapOf(11L to "invalid"), mapOf(11L to "1e2147483647"))) {
            val restored = codec.decodeFromString<PickingProgress>(codec.encodeToString(PickingProgress(receipt, counts)))
            rejects { restored.checked(receipt) }
            assertNull(restored.confirmedAt)
        }
        for (counts in listOf(mapOf(11L to "0.125"), mapOf(11L to "3.125"))) {
            val restored = codec.decodeFromString<PickingProgress>(codec.encodeToString(PickingProgress(receipt, counts)))
            rejects { restored.checked(receipt) }
            assertNull(restored.confirmedAt); assertEquals(counts, restored.counts)
        }
    }
    @Test fun incompatibleOrLegacySourceCannotBeCountedOrMarked() {
        val invalid = listOf(order().copy(sourceType = ""), order().copy(sourceType = "sales_order"), order().copy(status = "DRAFT"), order().copy(status = "CANCELLED"))
        for (receipt in invalid) {
            assertFalse(receipt.isPackable)
            val p = PickingProgress(receipt)
            rejects { p.scan("1001") }; rejects { p.quantity(11, "1") }; rejects { p.checked(order()) }
        }
        val legacyJson = codec.encodeToString(order()).replace(",\"sourceType\":\"sales_invoice\"", "")
        val legacy = codec.decodeFromString<PickingDetail>(legacyJson)
        assertEquals("", legacy.sourceType); assertFalse(legacy.isPackable)
    }

    @Test fun decimalQuantityAndSerializedResumeStayExact() {
        val receipt = order().copy(items = listOf(order().items[0].copy(quantity = "1.5")))
        val p = PickingProgress(receipt).scan("1001")
        val excess = p.scan("1001")
        sameQuantity("0.5", excess.extraQuantity(11))
        val complete = p.quantity(11, "1,5")
        assertTrue(complete.complete)
        assertEquals(complete, codec.decodeFromString<PickingProgress>(codec.encodeToString(complete)))
        val marked = complete.checked(receipt)
        assertEquals(marked, codec.decodeFromString<PickingProgress>(codec.encodeToString(marked)))
        assertNull(marked.scan("1001").confirmedAt)
    }

    @Test fun differencesArePerLineSoMissingAndExtraNeverCancelEachOther() {
        val p = PickingProgress(order()).quantity(11, "1.125").quantity(12, "1.875")
        sameQuantity("0.875", p.missingQuantity(11)); sameQuantity("0", p.extraQuantity(11))
        sameQuantity("0", p.missingQuantity(12)); sameQuantity("0.875", p.extraQuantity(12))
        sameQuantity("0.875", p.totalMissingQuantity); sameQuantity("0.875", p.totalExtraQuantity)
        sameQuantity("3", p.totalCountedQuantity)
        assertTrue(p.hasDifferences); assertFalse(p.complete); assertEquals(0, p.completedLines)
        assertEquals("1.125", p.counts[11]); assertEquals("1.875", p.counts[12])
    }

    @Test fun quantitiesRejectInvalidOrUnboundedNumbersBeforeTheyCanOverflow() {
        val p = PickingProgress(order())
        for (input in listOf("", "-0.001", "NaN", "Infinity", "1e3", "1e2147483647", "1.2.3", "1,2,3", "1000000000", "999999999.9999", "0.0001", "999999999999999999999999999999")) {
            rejects { p.quantity(11, input) }
        }
        val maximum = p.quantity(11, "999999999.999")
        sameQuantity("999999999.999", maximum.count(11))
        rejects { maximum.scan("1001") }
        val totals = maximum.quantity(12, "999999999.999")
        sameQuantity("1999999999.998", totals.totalCountedQuantity)
    }

    @Test fun zeroAndCommaFractionsAreNormalizedWithoutFloatingPointLoss() {
        val p = PickingProgress(order()).quantity(11, " 0,100 ").quantity(12, ".125")
        assertEquals("0.1", p.counts[11]); assertEquals("0.125", p.counts[12])
        sameQuantity("0.225", p.totalCountedQuantity)
        assertEquals("0", p.quantity(11, "0.000").counts[11])
        assertEquals(p, codec.decodeFromString<PickingProgress>(codec.encodeToString(p)))
    }
}
