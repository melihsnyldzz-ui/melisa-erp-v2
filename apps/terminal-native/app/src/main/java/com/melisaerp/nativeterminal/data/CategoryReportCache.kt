package com.melisaerp.nativeterminal.data

import com.melisaerp.nativeterminal.model.CategoryReport
import com.melisaerp.nativeterminal.model.Quote
import kotlinx.serialization.Serializable
import java.io.IOException
import java.time.Instant

@Serializable internal data class StoredCategoryReport(val report: CategoryReport, val savedAt: Long)

internal fun categoryReportCanUseCache(error: Exception): Boolean = when (error) {
    is ApiFailure -> error.status >= 500
    is IOException -> true
    else -> false
}

internal fun cachedReportCategories(saved: StoredCategoryReport?, quotes: List<Quote>): Map<Long, String?> {
    val categories = saved?.report?.items?.associate { it.productId to it.category }.orEmpty().toMutableMap()
    quotes.forEach { quote ->
        val newer = runCatching { Instant.parse(quote.quotedAt).toEpochMilli() > (saved?.savedAt ?: 0) }.getOrDefault(false)
        if (quote.category != null && (categories[quote.productId] == null || newer)) categories[quote.productId] = quote.category
    }
    return categories
}
