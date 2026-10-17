package com.melisaerp.nativeterminal

import com.melisaerp.nativeterminal.data.*
import com.melisaerp.nativeterminal.model.*
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Test

class CatalogSyncTest {
    private val customer = Customer(3, "cash", "Cash", "USD")
    private val plan = CatalogManifest(true, "a".repeat(64), "plan", "full", listOf(customer), 3, 3)
    private fun quote(id: Long) = Quote(id, "P"+id, "Product", stock="1", unitPrice="10.00",
        currency="USD", exchangeRate="40", customerId=3, quoteToken="signed", quotedAt="now")
    @Test fun downloadsEveryPageBeforeCompletion() = runTest {
        val staged=mutableListOf<Long>()
        downloadCatalog(plan, { _, after ->
            if(after==0L) CatalogPage(plan.revision,listOf(quote(1),quote(2)),2)
            else CatalogPage(plan.revision,listOf(quote(3)))
        }, { staged.addAll(it.map { q -> q.productId }) })
        assertEquals(listOf(1L,2L,3L),staged)
    }
    @Test fun interruptionDoesNotReachPublish() = runTest {
        var published=false
        val staged=mutableListOf<Long>()
        try {
            downloadCatalog(plan, { _, after ->
                if(after==0L) CatalogPage(plan.revision,listOf(quote(1)),1)
                else throw java.io.IOException("connection lost")
            }, { staged.addAll(it.map { q -> q.productId }) })
            published=true
        } catch (_: java.io.IOException) { }
        assertFalse(published);assertEquals(listOf(1L),staged)
    }
    @Test fun rejectsIncompleteOrCrossCustomerOrMixedRevisionPages() = runTest {
        val pages=listOf(
            CatalogPage(plan.revision,emptyList()),
            CatalogPage(plan.revision,listOf(quote(1)),null),
            CatalogPage("b".repeat(64),listOf(quote(1)),1),
            CatalogPage(plan.revision,listOf(quote(1),quote(1)),1),
            CatalogPage(plan.revision,listOf(quote(1).copy(customerId=4)),1),
            CatalogPage(plan.revision,listOf(quote(1).copy(currency="TRY")),1),
            CatalogPage(plan.revision,listOf(quote(1)),2)
        )
        for(page in pages) {
            var rejected=false
            try { downloadCatalog(plan,{_,_->page},{ fail("Invalid page was staged") }) }
            catch (_: IllegalStateException) { rejected=true }
            assertTrue(rejected)
        }
    }
    @Test fun removalOnlyDoesNotFetch() = runTest {
        downloadCatalog(plan.copy(mode="delta",total=0,changedCount=0,removedIds=listOf(1,2,3)),
            {_,_->error("No download required")},{error("No rows to stage")})
    }
    @Test fun rejectsInvalidManifest() = runTest {
        for(invalid in listOf(plan.copy(changed=false),plan.copy(changedCount=4),
            plan.copy(customers=listOf(customer,customer)),plan.copy(removedIds=listOf(1,1)))) {
            var rejected=false
            try { downloadCatalog(invalid,{_,_->error("Invalid plan fetched")},{}) }
            catch (_: IllegalArgumentException) { rejected=true }
            assertTrue(rejected)
        }
    }
    @Test fun repeatedAddKeepsThePriceAlreadyOnTheReceipt() {
        val original=Draft(owner="owner",actorId=8,customer=customer).add(quote(1),2)
        val updated=original.add(quote(1).copy(unitPrice="15.00"),1)
        assertEquals("10.00",updated.lines.single().unitPrice)
        assertEquals(3,updated.quantity)
    }
    @Test fun manyRoutedCustomersUseOnlyThreeCashPriceAnchors() = runTest {
        val anchors = listOf(Customer(1, "1-PEŞİN $", "Peşin", "USD", true), Customer(2, "2-PEŞİN TL", "Peşin", "TRY", true),
            Customer(3, "3-PEŞİN €", "Peşin", "EUR", true))
        val customers = (10L..109L).map { Customer(it, "C$it", "Cari $it", "USD", false, 5, "Rota") }
        val bootstrap = Bootstrap(anchors + customers, false, "Employee", scope = CUSTOMER_ROUTE_SCOPE,
            customerScopeRevision = "c".repeat(64), routes = listOf(CustomerRoute(5, "R5", "Rota"))).validatedCustomerScope()
        var fetched = 0
        downloadCatalog(plan.copy(customers = anchors, total = 1, changedCount = 1), { id, _ ->
            fetched++
            val anchor = anchors.single { it.id == id }
            CatalogPage(plan.revision, listOf(quote(1).copy(customerId = id, currency = anchor.currency, priceScope = "currency-v1")))
        }, {})
        assertEquals(3, fetched)
        assertEquals(103, bootstrap.customers.size)
        assertEquals(100, bootstrap.customers.count { it.isCash == false })
    }
    @Test fun routedCustomerExpansionCannotSilentlyMultiplyFullCatalogDownload() = runTest {
        var fetched = false
        try {
            downloadCatalog(plan.copy(customers = (1L..4L).map { customer.copy(id = it) }), { _, _ ->
                fetched = true; error("Expanded catalog should fail before fetching")
            }, {})
            fail("More than three anchors accepted")
        } catch (_: IllegalArgumentException) { }
        assertFalse(fetched)
    }
}
