package com.melisaerp.nativeterminal.model

import java.util.Locale

const val CUSTOMER_ROUTE_SCOPE = "native-customer-routes-v1"
private val cashCurrencies = mapOf("1-PEŞİN $" to "USD", "2-PEŞİN TL" to "TRY", "3-PEŞİN €" to "EUR")
private const val SCOPE_WARNING = "Rota bilgisi doğrulanamadı. Yeni rotalı satış kapalı; mevcut fişler korundu. Bağlantıyı yenileyin."

fun Customer.isVerifiedCash() = id > 0 && cashCurrencies[code] == currency && isCash != false && routeId == null

/** Invalid or unknown scope never restores an older route grant. Only exact cash identities survive. */
fun Bootstrap.cashOnlyScopeWarning(message: String = SCOPE_WARNING): Bootstrap = copy(
    customers = customers.groupBy { it.id }.values.filter { rows -> rows.distinct().size == 1 }.map { it.first() }
        .filter { it.isVerifiedCash() }.map { it.copy(isCash = true, routeName = null) }
        .groupBy { it.code }.values.filter { it.size == 1 }.map { it.single() }.sortedBy { it.code },
    routes = emptyList(), customerScopeWarning = message,
)

fun Bootstrap.validatedCustomerScope(): Bootstrap {
    if (scope == null && customerScopeRevision.isEmpty() && routes.isEmpty()) {
        return cashOnlyScopeWarning().copy(customerScopeWarning = customerScopeWarning)
    }
    if (scope != CUSTOMER_ROUTE_SCOPE || !customerScopeRevision.matches(Regex("[a-f0-9]{64}"))) return cashOnlyScopeWarning()
    val routeGroups = routes.groupBy { it.id }
    val customerGroups = customers.groupBy { it.id }
    if (routeGroups.values.any { it.distinct().size != 1 } || customerGroups.values.any { it.distinct().size != 1 }) return cashOnlyScopeWarning()
    val uniqueRoutes = routeGroups.values.map { it.first() }
    if (uniqueRoutes.any { it.id <= 0 || it.code.isBlank() || it.name.isBlank() }) return cashOnlyScopeWarning()
    val byRoute = uniqueRoutes.associateBy { it.id }
    val uniqueCustomers = customerGroups.values.map { it.first() }
    if (uniqueCustomers.any { customer ->
        customer.id <= 0 || customer.code.isBlank() || customer.name.isBlank() || customer.currency !in setOf("TRY", "USD", "EUR") ||
            if (customer.isCash == true) !customer.isVerifiedCash() || customer.routeName != null
            else customer.isCash != false || customer.code in cashCurrencies || customer.routeId !in byRoute ||
                customer.routeName != byRoute[customer.routeId]?.name
    }) return cashOnlyScopeWarning()
    if (uniqueCustomers.filter { it.isCash == true }.map { it.code }.distinct().size != uniqueCustomers.count { it.isCash == true }) return cashOnlyScopeWarning()
    return copy(customers = uniqueCustomers, routes = uniqueRoutes)
}

fun Bootstrap.allowedCustomer(id: Long, currency: String? = null): Customer? = validatedCustomerScope().customers
    .find { it.id == id && (currency == null || it.currency == currency) }

fun Bootstrap.requireCustomerAccess(customer: Customer): Customer = allowedCustomer(customer.id, customer.currency)
    ?: error("Bu cari artık cihazın rotalarında yok veya para birimi değişmiş. Fiş korundu; rota atamasını kontrol edin.")

fun Bootstrap.cashAnchorFor(customer: Customer): Customer? = validatedCustomerScope().customers
    .find { it.isVerifiedCash() && it.currency == customer.currency }

/** The server must also verify the signed currency-v1 capability and current route access at submission. */
fun bindCachedQuote(quote: Quote, customer: Customer, anchor: Customer?): Quote? {
    if (quote.currency != customer.currency) return null
    if (quote.customerId == customer.id) return quote
    if (quote.priceScope != "currency-v1" || anchor == null || !anchor.isVerifiedCash() ||
        anchor.currency != customer.currency || quote.customerId != anchor.id) return null
    return quote.copy(customerId = customer.id)
}

fun Customer.matchesCustomerSearch(query: String): Boolean {
    val normalized = query.trim().lowercase(Locale.forLanguageTag("tr-TR"))
    return normalized.isEmpty() || code.lowercase(Locale.forLanguageTag("tr-TR")).contains(normalized) ||
        name.lowercase(Locale.forLanguageTag("tr-TR")).contains(normalized)
}
