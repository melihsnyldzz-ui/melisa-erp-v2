package com.melisaerp.nativeterminal

import com.melisaerp.nativeterminal.data.*
import com.melisaerp.nativeterminal.model.*
import java.io.IOException
import java.time.Instant
import kotlinx.coroutines.CancellationException
import org.junit.Assert.*
import org.junit.Test

class CategoryReportCacheTest {
    @Test fun authorizationAndNotFoundResponsesNeverFallBackToStoredCommercialData() {
        listOf(400, 401, 403, 404, 409, 429).forEach {
            assertFalse("HTTP $it", categoryReportCanUseCache(ApiFailure(it, "DENIED", "Denied")))
        }
        assertFalse(categoryReportCanUseCache(CancellationException()))
        assertFalse(categoryReportCanUseCache(IllegalStateException("Owner changed")))
    }

    @Test fun OnlyNetworkAndServerOutagesPermitCachedReport() {
        assertTrue(categoryReportCanUseCache(IOException("Network unavailable")))
        assertTrue(categoryReportCanUseCache(ApiFailure(503, "UNAVAILABLE", "Unavailable")))
    }

    @Test fun oldCatalogCannotOverwriteNewReportButLaterCatalogCanRefreshCategory() {
        val stored = StoredCategoryReport(CategoryReport(currency = "USD", items = listOf(
            CategoryReportLine(1, "ST-1", "Ürün", "TAKIM", "1", "2"))), Instant.parse("2026-09-15T10:00:00Z").toEpochMilli())
        val quote = Quote(1, "ST-1", "Ürün", stock = "2", unitPrice = "2", currency = "USD", exchangeRate = "1",
            customerId = 1, quoteToken = "isolated", quotedAt = "2026-09-15T09:00:00Z", category = "ESKİ")
        assertEquals("TAKIM", cachedReportCategories(stored, listOf(quote))[1])
        assertEquals("YENİ", cachedReportCategories(stored, listOf(quote.copy(category = "YENİ", quotedAt = "2026-09-15T11:00:00Z")))[1])
        assertEquals("TAKIM", cachedReportCategories(stored, listOf(quote.copy(category = null, quotedAt = "2026-09-15T11:00:00Z")))[1])
        assertEquals("ESKİ", cachedReportCategories(null, listOf(quote))[1])
    }
}
