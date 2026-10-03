package com.melisaerp.nativeterminal.data

import androidx.room.withTransaction
import com.melisaerp.nativeterminal.model.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import java.net.URLEncoder
import java.util.Locale

class TerminalRepository(val store: LocalStore, val vault: Vault, private val api: ErpApi = ErpApi()) {
    var settings = Settings(); private set
    var preferences = UiPreferences(); private set
    var session: Session? = null; private set
    private val renewal = Mutex()
    private val catalogSync = Mutex()
    private var forceFullCatalog = false
    private val sessions = Mutex()
    private var generation = 0L
    val owner get() = "${settings.apiUrl}|${settings.terminalCode}|${session?.user?.id ?: 0}"
    suspend fun restore() {
        preferences = vault.get("preferences")?.let { codec.decodeFromString<UiPreferences>(it) } ?: UiPreferences()
        settings = vault.get("settings")?.let { codec.decodeFromString<Settings>(it) } ?: Settings()
        session = vault.get("session:$settings")?.let { codec.decodeFromString<Session>(it) }
    }
    suspend fun savePreferences(next: UiPreferences) { vault.put("preferences", codec.encodeToString(next)); preferences = next }
    suspend fun options(): TerminalOptions = codec.decodeFromJsonElement(request("/settings?terminalCode=" + encode(settings.terminalCode)))
    suspend fun saveRates(usd: String, eur: String): TerminalOptions = codec.decodeFromJsonElement(request("/settings/rates", buildJsonObject {
        put("terminalCode", settings.terminalCode); put("rates", buildJsonObject { put("USD", usd); put("EUR", eur) })
    }))
    suspend fun bootstrapForMenu(): Bootstrap? = salesOrPackingBootstrap({ bootstrap() }) { orders("", 1) }
    suspend fun orders(query: String, page: Int): PickingPage = codec.decodeFromJsonElement(request("/packing-receipts?terminalCode=" + encode(settings.terminalCode) + "&page=$page&search=" + encode(query)))
    suspend fun order(id: Long): PickingDetail = codec.decodeFromJsonElement(request("/packing-receipts/$id?terminalCode=" + encode(settings.terminalCode)))
    suspend fun categoryReport(draft: Draft): CategoryReportResult {
        val expected = owner; val expectedGeneration = generation
        require(draft.owner == expected && session != null)
        val key = "category-report:$expected:${draft.id}"
        val saved = vault.get(key)?.let { codec.decodeFromString<StoredCategoryReport>(it) }
        fun checkOwner() = check(owner == expected && generation == expectedGeneration) { "Oturum veya bağlantı değişti." }
        val local = if (draft.receipt == null) {
            val quotes = mutableListOf<Quote>()
            draft.lines.map { it.quote.productId }.chunked(200).forEach { ids ->
                withContext(Dispatchers.IO) { store.dao().quotesByIds(expected, draft.customer.id, ids) }
                    .mapTo(quotes) { codec.decodeFromString<Quote>(vault.open(it.payload)) }
            }
            val categories = cachedReportCategories(saved, quotes)
            CategoryReport(currency = draft.customer.currency, discountRate = draft.discountRate,
                items = draft.lines.map { line -> CategoryReportLine(productId = line.quote.productId,
                    stockCode = line.quote.stockCode, productName = line.quote.productName,
                    category = categories[line.quote.productId] ?: line.quote.category,
                    quantity = line.quantity.toString(), unitPrice = line.unitPrice) })
        } else null
        checkOwner()
        val report = try {
            if (draft.receipt != null) {
                codec.decodeFromJsonElement<CategoryReport>(request("/sales/${draft.receipt.invoiceId}/category-report?terminalCode=" + encode(settings.terminalCode))).also {
                    check(it.invoiceId == draft.receipt.invoiceId && it.currency == draft.customer.currency) { "Fiş bilgisi uyuşmuyor." }
                }
            } else {
                val categories = mutableMapOf<Long, String>()
                local!!.items.map { it.productId }.distinct().chunked(200).forEach { ids ->
                    val data = request("/products/categories?terminalCode=" + encode(settings.terminalCode) + "&ids=" + ids.joinToString(",")).jsonObject
                    data["items"]!!.jsonArray.forEach { row ->
                        val item = row.jsonObject
                        categories[item["productId"]!!.jsonPrimitive.long] = item["category"]!!.jsonPrimitive.content
                    }
                }
                local.copy(items = local.items.map { it.copy(category = categories[it.productId]) })
            }
        } catch (e: Exception) {
            if (!categoryReportCanUseCache(e)) throw e
            checkOwner()
            val fallback = local ?: saved?.report?.takeIf { it.invoiceId == draft.receipt?.invoiceId }
            if (fallback == null) throw java.io.IOException("Rapor için ERP bağlantısı gerekli. Bağlanınca tekrar deneyin.", e)
            fallback.groups()
            return CategoryReportResult(fallback, fromCache = true)
        }
        report.groups()
        sessions.withLock { checkOwner(); vault.put(key, codec.encodeToString(StoredCategoryReport(report, System.currentTimeMillis()))) }
        return CategoryReportResult(report, fromCache = false)
    }
    private fun packingKey(id: Long, scope: Settings = settings) = packingStorageKey(scope, id)
    suspend fun picking(detail: PickingDetail): PickingProgress {
        require(detail.isPackable) { "Yalnız tamamlanan satış fişleri açılabilir." }
        val expected = owner; val expectedGeneration = generation; val scope = settings
        return withContext(Dispatchers.IO) {
            val saved = vault.get(packingKey(detail.id, scope))?.let { codec.decodeFromString<PickingProgress>(it) }
            check(owner == expected && generation == expectedGeneration)
            saved?.takeIf { it.order.isPackable && it.order.id == detail.id && it.order.revision == detail.revision }?.copy(order = detail) ?: PickingProgress(detail)
        }
    }
    suspend fun packingMarks(receipts: List<PickingOrder>): Map<Long, String> {
        val expected = owner; val expectedGeneration = generation; val scope = settings
        return withContext(Dispatchers.IO) {
            val marks = receipts.mapNotNull { receipt ->
                val saved = vault.get(packingKey(receipt.id, scope))?.let { codec.decodeFromString<PickingProgress>(it) }
                val verifiedRevision = if (saved != null && receipt.documentVersion.isBlank()) order(receipt.id).revision else null
                packingListMark(receipt, saved, verifiedRevision)?.let { receipt.id to it }
            }.toMap()
            check(owner == expected && generation == expectedGeneration)
            marks
        }
    }
    suspend fun savePicking(progress: PickingProgress) {
        require(progress.order.isPackable)
        val expected = owner; val expectedGeneration = generation; val scope = settings
        withContext(Dispatchers.IO) {
            sessions.withLock {
                check(session != null && owner == expected && generation == expectedGeneration && settings == scope)
                vault.put(packingKey(progress.order.id, scope), codec.encodeToString(progress))
            }
        }
    }

    suspend fun configure(next: Settings) {
        ErpApi.validateUrl(next.apiUrl); require(next.terminalCode.matches(Regex("[A-Za-z0-9_-]{1,80}")))
        sessions.withLock { generation++; vault.put("settings", codec.encodeToString(next)); settings = next; session = null }
    }
    suspend fun login(username: String, password: String) {
        val (expectedSettings, expectedGeneration) = sessions.withLock { settings to ++generation }
        val data = api.request(expectedSettings, "/auth/terminal-login", body = buildJsonObject {
            put("username", username); put("password", password); put("terminalCode", expectedSettings.terminalCode)
        })
        val next = codec.decodeFromJsonElement<Session>(data)
        sessions.withLock {
            check(generation == expectedGeneration && settings == expectedSettings) { "Oturum veya bağlantı değişti." }
            vault.put("session:$expectedSettings", codec.encodeToString(next)); session = next
        }
    }
    suspend fun users(): JsonElement = api.request(settings, "/auth/terminal-users?terminalCode=${encode(settings.terminalCode)}")
    suspend fun logout() {
        val (previousSettings, old) = sessions.withLock {
            generation++; val previous = settings to session; vault.put("session:$settings", null); session = null; previous
        }
        try { old?.refreshToken?.let { api.request(previousSettings, "/auth/logout", body = buildJsonObject { put("refreshToken", it) }) } } catch (_: java.io.IOException) { }
    }
    suspend fun request(route: String, body: JsonObject? = null): JsonElement {
        val expectedOwner = owner
        val expectedSettings = settings; val expectedGeneration = generation
        val initial = session ?: throw ApiFailure(401, "LOGIN", "Personel girişi gerekli.")
        try {
            val result = api.request(settings, "/native-terminal$route", initial.accessToken, body)
            check(owner == expectedOwner && generation == expectedGeneration) { "Oturum veya bağlantı değişti." }; return result
        }
        catch (e: ApiFailure) {
            if (!e.canRefreshSession || initial.refreshToken == null) throw e
            renewal.withLock {
                check(owner == expectedOwner && generation == expectedGeneration)
                if (session?.accessToken == initial.accessToken) {
                    val refreshed = api.request(settings, "/auth/refresh", body = buildJsonObject { put("refreshToken", initial.refreshToken); put("terminalCode", expectedSettings.terminalCode) })
                    val next = initial.renewedBy(codec.decodeFromJsonElement<Session>(refreshed))
                    sessions.withLock {
                        check(next.user.id == initial.user.id && generation == expectedGeneration && settings == expectedSettings)
                        vault.put("session:$expectedSettings", codec.encodeToString(next)); session = next
                    }
                }
            }
            check(owner == expectedOwner && generation == expectedGeneration)
            // A recognized access-token rejection came from middleware before business work.
            val retried = api.request(expectedSettings, "/native-terminal$route", session!!.accessToken, body)
            check(owner == expectedOwner && generation == expectedGeneration); return retried
        }
    }
    suspend fun bootstrap(): Bootstrap {
        val expected = owner
        val result = try {
            val data = request("/bootstrap?terminalCode=${encode(settings.terminalCode)}")
            codec.decodeFromJsonElement<Bootstrap>(data).validatedCustomerScope()
        } catch (e: ApiFailure) {
            if (e.code !in setOf("NATIVE_CUSTOMER_ROUTES_SCHEMA_REQUIRED", "NATIVE_CUSTOMER_SCOPE_INVALID")) throw e
            check(owner == expected)
            cachedBootstrap()?.cashOnlyScopeWarning() ?: throw e
        } catch (e: kotlinx.serialization.SerializationException) {
            check(owner == expected)
            cachedBootstrap()?.cashOnlyScopeWarning() ?: throw e
        }
        check(owner == expected); vault.put("bootstrap:$expected", codec.encodeToString(result)); check(owner == expected); return result
    }

    suspend fun confirmPicking(progress: PickingProgress, reason: String?): PickingProgress {
        require(progress.order.isPackable)
        if (reason == null) require(progress.complete) { "Eksik veya fazla ürün varken normal paketleme tamamlanamaz." }
        else require(reason.isNotBlank() && reason.trim().length <= 500) { "İstisna gerekçesi zorunlu (en fazla 500 karakter)." }
        val result = codec.decodeFromJsonElement<PackingConfirmation>(request("/packing-receipts/${progress.order.id}/check", buildJsonObject {
            put("terminalCode", settings.terminalCode); put("revision", progress.order.revision)
            put("requestId", java.util.UUID.randomUUID().toString())
            put("status", if (reason == null) "PACKED" else "PACKING_EXCEPTION")
            put("reason", reason?.trim().orEmpty())
            put("counts", buildJsonObject { progress.counts.forEach { (id, value) -> put(id.toString(), value) } })
        }))
        return progress.audited(result)
    }
    suspend fun cachedBootstrap(): Bootstrap? = vault.get("bootstrap:$owner")?.let { codec.decodeFromString<Bootstrap>(it).validatedCustomerScope() }
    suspend fun save(draft: Draft, active: Boolean = true) = withContext(Dispatchers.IO) {
        require(draft.owner == owner)
        val row = DraftRow(draft.id, draft.owner, draft.updatedAt, vault.seal(codec.encodeToString(draft)))
        store.withTransaction { store.dao().save(row); if (active) store.dao().workspace(WorkspaceRow(draft.owner, draft.id)) }
    }
    suspend fun leaveDraft(draft: Draft?) = withContext(Dispatchers.IO) {
        val expectedOwner = owner
        require(draft == null || draft.owner == expectedOwner)
        val row = draft?.takeUnless { it.discardableOnExit }?.let {
            DraftRow(it.id, it.owner, it.updatedAt, vault.seal(codec.encodeToString(it)))
        }
        sessions.withLock {
            check(owner == expectedOwner)
            store.withTransaction {
                if (row != null) store.dao().save(row)
                else if (draft != null) store.dao().deleteDraft(expectedOwner, draft.id)
                store.dao().workspace(WorkspaceRow(expectedOwner, null))
            }
        }
    }
    suspend fun clearActive() = store.dao().workspace(WorkspaceRow(owner, null))
    suspend fun active(): Draft? = withContext(Dispatchers.IO) { store.dao().active(owner)?.let { id -> store.dao().draft(owner, id)?.let { decode(it) } } }
    suspend fun drafts(): List<Draft> = withContext(Dispatchers.IO) { store.dao().drafts(owner).map { decode(it) } }
    suspend fun draft(id: String): Draft? = withContext(Dispatchers.IO) {
        val expectedOwner = owner
        val result = store.dao().draft(expectedOwner, id)?.let(::decode)
        check(owner == expectedOwner) { "Oturum veya bağlantı değişti." }
        result
    }
    suspend fun deleteLocalDraft(expected: Draft) = withContext(Dispatchers.IO) {
        sessions.withLock {
            check(session != null) { "Fişi silmek için personel oturumu gerekli." }
            val expectedOwner = owner
            val expectedGeneration = generation
            require(expected.owner == expectedOwner) { "Bu fiş başka bir oturuma ait." }
            store.withTransaction {
                check(session != null && owner == expectedOwner && generation == expectedGeneration) { "Oturum veya bağlantı değişti." }
                deleteLocalDraftRecord(store.dao(), expected, ::decode)
            }
        }
    }
    private fun decode(row: DraftRow): Draft = codec.decodeFromString(vault.open(row.payload))

    suspend fun synchronizeCatalog(): Boolean = catalogSync.withLock {
        try {
        val expectedOwner = owner
        val previous = store.dao().catalogState(expectedOwner)
        val manifest = codec.decodeFromJsonElement<CatalogManifest>(request("/catalog/version?terminalCode="+encode(settings.terminalCode)+"&baseRevision="+encode(if (forceFullCatalog) "" else previous?.revision ?: "")))
        if (!manifest.changed) {
            check(previous?.revision == manifest.revision)
            return@withLock false
        }
        val customerScope = cachedBootstrap() ?: error("Cari bilgileri alınamadı.")
        check(manifest.customers.all { it.isVerifiedCash() && customerScope.allowedCustomer(it.id, it.currency)?.isVerifiedCash() == true }) {
            "Çevrimdışı fiyat paketi peşin cari kapsamıyla uyuşmuyor. Mevcut kayıtlar korundu."
        }
        val staging = "$expectedOwner|catalog-staging"
        sessions.withLock {
            check(owner == expectedOwner)
            store.withTransaction { store.dao().clearOwnerBarcodes(staging); store.dao().clearQuotes(staging) }
        }
        downloadCatalog(manifest, { customer, after ->
            codec.decodeFromJsonElement<CatalogPage>(request("/catalog/page?terminalCode="+encode(settings.terminalCode)+"&planId="+encode(manifest.planId)+"&customerId=$customer&afterId=$after&limit=200"))
        }, { quotes -> remember(quotes, expectedOwner, staging) })
        sessions.withLock {
            check(owner == expectedOwner)
            store.withTransaction {
                val dao = store.dao()
                check(dao.catalogState(expectedOwner)?.revision == previous?.revision)
                for (customer in manifest.customers) check(dao.quoteCount(staging, customer.id) == manifest.changedCount)
                if (manifest.mode == "full") { dao.clearOwnerBarcodes(expectedOwner); dao.clearQuotes(expectedOwner) }
                else {
                    dao.clearChangedBarcodes(expectedOwner, staging)
                    for (ids in manifest.removedIds.chunked(400)) { dao.removeBarcodes(expectedOwner, ids); dao.removeQuotes(expectedOwner, ids) }
                }
                val customers = manifest.customers.map { it.id }
                dao.removeOtherCustomerBarcodes(expectedOwner, customers); dao.removeOtherCustomers(expectedOwner, customers)
                dao.publishQuotes(expectedOwner, staging); dao.publishBarcodes(expectedOwner, staging)
                for (customer in manifest.customers) check(dao.quoteCount(expectedOwner, customer.id) == manifest.total) { "Kart sayısı doğrulanamadı; önceki liste korunur." }
                dao.catalogState(CatalogStateRow(expectedOwner, manifest.revision, System.currentTimeMillis()))
                dao.clearOwnerBarcodes(staging); dao.clearQuotes(staging)
            }
        }
        android.util.Log.i("MelisaCatalog", "Published "+manifest.mode+": "+manifest.changedCount+" changed, "+manifest.removedIds.size+" removed, "+manifest.total+" products")
        forceFullCatalog = false
        true
        } catch (e: IllegalStateException) {
            // Keep the active cache; recover inconsistent deltas with a full snapshot next time.
            forceFullCatalog = true
            throw e
        }
    }

    suspend fun remember(quotes: List<Quote>, expectedOwner: String = owner, cacheOwner: String = expectedOwner) = withContext(Dispatchers.IO) {
        check(expectedOwner == owner)
        // Keystore work stays outside the SQLite write transaction so scans can read cache meanwhile.
        val rows = quotes.map { QuoteRow(cacheOwner, it.customerId, it.productId, normalize(it.stockCode), normalize(it.productName), vault.seal(codec.encodeToString(it))) }
        val barcodes = quotes.flatMap { q -> q.barcodes.map { BarcodeRow(cacheOwner, q.customerId, it, q.productId) } }
        require(cacheOwner == expectedOwner || cacheOwner == "$expectedOwner|catalog-staging")
        sessions.withLock {
            check(expectedOwner == owner)
            store.withTransaction {
                store.dao().quotes(rows)
                for ((customer, products) in quotes.groupBy { it.customerId }) store.dao().clearProductBarcodes(cacheOwner, customer, products.map { it.productId })
                store.dao().barcodes(barcodes)
            }
        }
    }
    suspend fun cached(customer: Long, query: String, scan: Boolean): List<Quote> = withContext(Dispatchers.IO) {
        val expected = owner
        val bootstrap = cachedBootstrap() ?: return@withContext emptyList()
        val selected = bootstrap.allowedCustomer(customer) ?: return@withContext emptyList()
        val anchor = bootstrap.cashAnchorFor(selected)
        val normalized = normalize(query)
        val rows = listOfNotNull(customer, anchor?.id).distinct().flatMap { sourceCustomer ->
            if (scan) store.dao().barcode(expected, sourceCustomer, query.trim())
            else store.dao().search(expected, sourceCustomer, "%${normalized.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")}%", normalized, query.trim())
        }
        check(owner == expected)
        val current = cachedBootstrap() ?: return@withContext emptyList()
        if (current.customerScopeRevision != bootstrap.customerScopeRevision || current.allowedCustomer(customer, selected.currency) == null) return@withContext emptyList()
        rows.mapNotNull { bindCachedQuote(codec.decodeFromString<Quote>(vault.open(it.payload)), selected, anchor) }
            .distinctBy { it.productId }.take(if (scan) 2 else 30)
    }
    suspend fun search(customer: Long, query: String, scan: Boolean): List<Quote> {
        val expected = owner
        check(cachedBootstrap()?.allowedCustomer(customer) != null) { "Bu cari cihazın güncel rotalarında yok. Fiş korundu." }
        val route = "/products/search?terminalCode=${encode(settings.terminalCode)}&customerId=$customer&${if (scan) "barcode" else "q"}=${encode(query)}"
        val quotes = codec.decodeFromJsonElement<List<Quote>>(request(route))
        check(expected == owner)
        val selected = cachedBootstrap()?.allowedCustomer(customer) ?: error("Cari kapsamı değişti. Fiş korundu.")
        check(quotes.all { it.customerId == selected.id && it.currency == selected.currency }) { "Ürün fiyatı seçilen cariyle uyuşmuyor." }
        remember(quotes, expected); return quotes
    }
    fun payload(draft: Draft) = buildJsonObject {
        put("clientEventId", draft.id); put("terminalCode", settings.terminalCode); put("customerId", draft.customer.id)
        put("documentCurrency", draft.customer.currency); put("discountRate", draft.discountRate); put("note", draft.note)
        put("items", buildJsonArray { draft.lines.forEach { line -> add(buildJsonObject {
            put("productId", line.quote.productId); put("quantity", line.quantity); put("unitPrice", line.unitPrice); put("quoteToken", line.quote.quoteToken)
        }) } })
        put("changes", codec.encodeToJsonElement(draft.changes))
        draft.approvalToken?.let { put("approvalToken", it) }
    }
    companion object {
        fun normalize(v: String) = v.lowercase(Locale.forLanguageTag("tr-TR"))
        fun encode(v: String) = URLEncoder.encode(v, "UTF-8")
    }
}

// Called only inside the repository's session lock and Room transaction. Re-read the
// encrypted row after confirmation so a stale screen cannot delete a submitted sale.
internal suspend fun deleteLocalDraftRecord(dao: StoreDao, expected: Draft, decode: (DraftRow) -> Draft) {
    val row = dao.draft(expected.owner, expected.id) ?: error("Fiş artık cihazda bulunmuyor.")
    val current = decode(row)
    check(current == expected) { "Fiş değişti. Güncel fişi inceleyip yeniden onaylayın." }
    check(current.canDeleteLocally) { "Gönderilmiş veya sonucu belirsiz fiş cihazdan silinemez." }
    dao.deleteDraft(expected.owner, expected.id)
    if (dao.active(expected.owner) == expected.id) dao.workspace(WorkspaceRow(expected.owner, null))
}
