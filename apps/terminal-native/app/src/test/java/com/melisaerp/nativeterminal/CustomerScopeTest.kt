package com.melisaerp.nativeterminal

import com.melisaerp.nativeterminal.data.ApiFailure
import com.melisaerp.nativeterminal.data.codec
import com.melisaerp.nativeterminal.model.*
import kotlinx.serialization.encodeToString
import org.junit.Assert.*
import org.junit.Test

class CustomerScopeTest {
    private val cash = Customer(1, "1-PEŞİN $", "Peşin dolar", "USD", true)
    private val tl = Customer(2, "2-PEŞİN TL", "Peşin lira", "TRY", true)
    private val route = CustomerRoute(11, "R11", "İstanbul")
    private val secondRoute = CustomerRoute(12, "R12", "Ankara")
    private val buyer = Customer(101, "C101", "İnci Bebek", "USD", false, route.id, route.name)
    private fun bootstrap() = Bootstrap(listOf(cash, tl, buyer), false, "Employee", saleEnabled = true,
        scope = CUSTOMER_ROUTE_SCOPE, customerScopeRevision = "a".repeat(64), routes = listOf(route, secondRoute))
    private fun quote() = Quote(9, "P9", "Ürün", stock = "8", unitPrice = "10.25", currency = "USD", exchangeRate = "40",
        customerId = cash.id, quoteToken = "unchanged-signed-template", quotedAt = "2026-09-16T00:00:00Z", priceScope = "currency-v1")

    @Test fun oneCustomerOneRouteAndMultipleAssignedRoutesAreKeptWithoutDuplicates() {
        val second = buyer.copy(id = 102, routeId = secondRoute.id, routeName = secondRoute.name)
        val result = bootstrap().copy(customers = listOf(cash, tl, buyer, buyer, second)).validatedCustomerScope()
        assertNull(result.customerScopeWarning)
        assertEquals(listOf(1L, 2L, 101L, 102L), result.customers.map { it.id })
        assertEquals(2, result.routes.size)
    }

    @Test fun noAssignedRouteMeansOnlyFixedCashCustomers() {
        val result = bootstrap().copy(customers = listOf(cash, tl), routes = emptyList()).validatedCustomerScope()
        assertEquals(listOf(cash, tl), result.customers)
        assertNull(result.allowedCustomer(buyer.id))
        assertNull(result.customerScopeWarning)
    }

    @Test fun legacyApiAcceptsOnlyExactCashCodeAndCurrency() {
        val old = Bootstrap(listOf(cash.copy(isCash = null), tl.copy(isCash = null), buyer.copy(isCash = null),
            cash.copy(id = 99, code = "PEŞİN"), cash.copy(id = 98, code = "3-PEŞİN €")), false, "Employee")
        val result = old.validatedCustomerScope()
        assertEquals(listOf(1L, 2L), result.customers.map { it.id })
        assertNull(result.customerScopeWarning)
        assertTrue(result.routes.isEmpty())
    }

    @Test fun invalidNewScopeFailsClosedRatherThanKeepingRouteCustomers() {
        val invalid = listOf(bootstrap().copy(customerScopeRevision = ""), bootstrap().copy(scope = "unknown"),
            bootstrap().copy(routes = emptyList()), bootstrap().copy(customers = listOf(cash, buyer.copy(isCash = null))),
            bootstrap().copy(customers = listOf(cash, buyer.copy(routeName = "Other"))),
            bootstrap().copy(customers = listOf(cash, buyer.copy(currency = "LL"))))
        invalid.forEach { input ->
            val result = input.validatedCustomerScope()
            assertNotNull(result.customerScopeWarning)
            assertTrue(result.customers.all { it.isVerifiedCash() })
            assertNull(result.allowedCustomer(buyer.id))
        }
    }

    @Test fun conflictingDuplicateCustomersOrRoutesNeverPickAnArbitraryGrant() {
        val conflicts = listOf(
            bootstrap().copy(customers = listOf(cash, buyer, buyer.copy(routeId = secondRoute.id, routeName = secondRoute.name))),
            bootstrap().copy(routes = listOf(route, route.copy(name = "Other"))),
            bootstrap().copy(customers = listOf(cash, cash.copy(id = 8), buyer)))
        conflicts.forEach { assertNotNull(it.validatedCustomerScope().customerScopeWarning); assertNull(it.allowedCustomer(buyer.id)) }
        assertTrue(Bootstrap(listOf(cash, cash.copy(id = 8)), false, "Employee").validatedCustomerScope().customers.isEmpty())
        assertTrue(Bootstrap(listOf(cash, buyer.copy(id = cash.id)), false, "Employee").validatedCustomerScope().customers.isEmpty())
    }

    @Test fun currencyTemplateBindsOnlyCustomerIdAndLeavesSignedPriceSnapshotUntouched() {
        val original = quote()
        val result = bindCachedQuote(original, bootstrap().requireCustomerAccess(buyer), cash)!!
        assertEquals(buyer.id, result.customerId)
        assertEquals(original, result.copy(customerId = original.customerId))
        assertEquals("unchanged-signed-template", result.quoteToken)
        assertEquals(cash.id, original.customerId)
    }

    @Test fun oldCustomerBoundTokenCannotBeReboundOrCrossCurrencyCopied() {
        assertNull(bindCachedQuote(quote().copy(priceScope = "customer"), buyer, cash))
        assertNull(bindCachedQuote(quote().copy(priceScope = "unknown"), buyer, cash))
        assertNull(bindCachedQuote(quote(), buyer.copy(currency = "TRY"), tl))
        assertNull(bindCachedQuote(quote(), buyer, cash.copy(id = 3)))
        assertNull(bindCachedQuote(quote(), buyer, null))
        assertNull(bindCachedQuote(quote(), buyer, cash.copy(code = "Unverified cash")))
    }

    @Test fun normalCustomerBoundQuotesRemainUsableOnlyForTheirCustomer() {
        val direct = quote().copy(customerId = buyer.id, priceScope = "customer")
        assertEquals(direct, bindCachedQuote(direct, buyer, cash))
        assertNull(bindCachedQuote(direct, buyer.copy(id = 103), cash))
    }

    @Test fun routeRevocationPreservesFrozenPayloadIdentityReceiptAndApproval() {
        val frozen = Draft(owner = "server|terminal|operator", actorId = 7, customer = buyer)
            .add(bindCachedQuote(quote(), buyer, cash)!!, 2)
            .copy(state = DraftState.REVIEW_REQUIRED, submissionJson = "exact original request", approvalToken = "original approval")
        val before = codec.encodeToString(frozen)
        val revoked = bootstrap().copy(customers = listOf(cash, tl), customerScopeRevision = "b".repeat(64))
        assertNull(revoked.allowedCustomer(buyer.id))
        try { revoked.requireCustomerAccess(frozen.customer); fail("Revoked route accepted") } catch (_: IllegalStateException) { }
        assertEquals(before, codec.encodeToString(frozen))
        assertTrue(SaleResult("NOT_FOUND", mayResend = true).permitsResubmit(frozen))
        assertFalse(frozen.canDeleteLocally)
    }

    @Test fun newScopeFieldsDoNotChangeOldSerializedDraftIdentityOrFrozenBody() {
        val old = """{"id":"36fb5a5e-9bc8-42f4-ab15-123456789abc","owner":"owner","actorId":7,"customer":{"id":1,"code":"1-PEŞİN $","name":"Peşin dolar","currency":"USD"},"state":"SUBMITTING","submissionJson":"legacy-body-exact"}"""
        val restored = codec.decodeFromString<Draft>(old)
        assertEquals("36fb5a5e-9bc8-42f4-ab15-123456789abc", restored.id)
        assertEquals("legacy-body-exact", restored.submissionJson)
        assertEquals(DraftState.SUBMITTING, restored.state)
        assertNull(restored.customer.isCash)
        assertEquals(cash.id, bootstrap().requireCustomerAccess(restored.customer).id)
    }

    @Test fun scopeSchemaFailureKeepsCashAndWarningAcrossCacheRoundTrip() {
        val fallback = bootstrap().cashOnlyScopeWarning()
        val restored = codec.decodeFromString<Bootstrap>(codec.encodeToString(fallback)).validatedCustomerScope()
        assertEquals(listOf(1L, 2L), restored.customers.map { it.id })
        assertNotNull(restored.customerScopeWarning)
        assertNull(restored.allowedCustomer(buyer.id))
    }

    @Test fun onlyExplicitPreWriteRouteRejectionUnlocksDraftAnd503NeverRetries() {
        assertTrue(ApiFailure(403, "NATIVE_CUSTOMER_ROUTE_DENIED", "denied").saleRejectedBeforeCommit)
        assertTrue(ApiFailure(403, "NATIVE_DEVICE_SCOPE_MISMATCH", "denied").saleRejectedBeforeCommit)
        for (code in listOf("NATIVE_CUSTOMER_ROUTES_SCHEMA_REQUIRED", "NATIVE_CUSTOMER_SCOPE_INVALID")) {
            val error = ApiFailure(503, code, "unavailable")
            assertFalse(error.saleRejectedBeforeCommit)
            assertFalse(error.canRefreshSession)
        }
        assertFalse(ApiFailure(503, "NATIVE_CUSTOMER_ROUTE_DENIED", "unknown").saleRejectedBeforeCommit)
    }

    @Test fun turkishNameAndCodeSearchDoesNotRequireCashCustomersToMatch() {
        assertTrue(buyer.matchesCustomerSearch("inci"))
        assertTrue(buyer.matchesCustomerSearch("c101"))
        assertFalse(buyer.matchesCustomerSearch("ankara"))
        assertEquals(listOf(cash, tl), bootstrap().validatedCustomerScope().customers.filter { it.isVerifiedCash() })
    }
}
