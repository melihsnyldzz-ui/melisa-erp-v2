package com.melisaerp.nativeterminal.data

import com.melisaerp.nativeterminal.model.Customer
import com.melisaerp.nativeterminal.model.Quote
import kotlinx.serialization.Serializable

@Serializable data class CatalogManifest(
    val changed: Boolean, val revision: String, val planId: String = "", val mode: String = "",
    val customers: List<Customer> = emptyList(), val total: Int = 0, val changedCount: Int = 0,
    val removedIds: List<Long> = emptyList(),
)
@Serializable data class CatalogPage(val revision: String, val quotes: List<Quote>, val nextId: Long? = null)

suspend fun downloadCatalog(
    plan: CatalogManifest,
    fetch: suspend (Long, Long) -> CatalogPage,
    stage: suspend (List<Quote>) -> Unit,
) {
    require(plan.changed && plan.revision.matches(Regex("[a-f0-9]{64}")))
    require(plan.mode in setOf("full", "delta") && plan.planId.isNotBlank())
    require(plan.total in 0..50000 && plan.changedCount in 0..plan.total)
    require(plan.mode != "full" || plan.changedCount == plan.total)
    require(plan.customers.isNotEmpty() && plan.customers.size <= 3 && plan.customers.map { it.id }.distinct().size == plan.customers.size)
    require(plan.removedIds.all { it > 0 } && plan.removedIds.distinct().size == plan.removedIds.size)
    for (customer in plan.customers) {
        var after = 0L
        var count = 0
        while (count < plan.changedCount) {
            val page = fetch(customer.id, after)
            check(page.revision == plan.revision && page.quotes.isNotEmpty() && page.quotes.size <= 200) { "Kart sayfası eksik veya değişmiş." }
            var last = after
            for (quote in page.quotes) {
                check(quote.productId > last && quote.customerId == customer.id && quote.currency == customer.currency)
                check(quote.productId !in plan.removedIds)
                last = quote.productId
            }
            count += page.quotes.size
            check(count <= plan.changedCount)
            check(if (count == plan.changedCount) page.nextId == null else page.nextId == last)
            stage(page.quotes)
            after = last
        }
        check(count == plan.changedCount)
    }
}
