package com.melisaerp.nativeterminal

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.melisaerp.nativeterminal.data.*
import com.melisaerp.nativeterminal.model.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*

data class TerminalUi(
    val screen: Screen = Screen.LOADING, val settings: Settings = Settings(), val users: List<Pair<String,String>> = emptyList(),
    val preferences: UiPreferences = UiPreferences(), val options: TerminalOptions? = null,
    val loadingWorkflow: Boolean = false, val workflowError: String? = null,
    val orders: List<PickingOrder> = emptyList(), val orderQuery: String = "", val ordersPage: Int = 1, val ordersHasMore: Boolean = false,
    val picking: PickingProgress? = null, val packingMarks: Map<Long, String> = emptyMap(),
    val categoryReport: CategoryReportUi? = null,
    val receiptGroup: ReceiptGroup = ReceiptGroup.WAITING, val pdfShare: PdfShareUi? = null,
    val bootstrap: Bootstrap? = null, val draft: Draft? = null, val drafts: List<Draft> = emptyList(),
    val query: String = "", val quotes: List<Quote> = emptyList(), val preview: Quote? = null,
    val catalogUpdated: Boolean = false, val offline: Boolean = false, val cachedPrices: Boolean = false, val searching: Boolean = false, val busy: Boolean = false,
    val message: String? = null, val review: Boolean = false, val printPrompt: Boolean = false,
    val scanner: String = "Tarayıcı bekleniyor", val allowRetry: Boolean = false,
)
class TerminalViewModel(private val repo: TerminalRepository) : ViewModel() {
    private val _ui = MutableStateFlow(TerminalUi()); val ui = _ui.asStateFlow()
    private val mutations = Mutex()
    private var categoryReportJob: Job? = null
    private var categoryReportSequence = 0L
    private var pdfShareJob: Job? = null
    private var pdfShareSequence = 0L
    private var searchJob: Job? = null
    private var workflowJob: Job? = null
    private var catalogJob: Job? = null
    private var connectionJob: Job? = null
    private var isForeground = false
    private val reconnectMutex = Mutex()
    private var lastCatalogSync = 0L
    private var lastBootstrapAt = 0L
    private var catalogNoticeJob: Job? = null
    init { launch {
        repo.restore(); set { copy(settings = repo.settings, preferences = repo.preferences) }
        if (repo.session == null) { set { copy(screen = Screen.LOGIN) }; loadUsers() }
        else {
            val cached = repo.cachedBootstrap(); val active = repo.active()
            set { copy(bootstrap = cached, draft = active, screen = if (active != null) Screen.SALE else Screen.HOME) }
            reconnect()
        }
    } }
    private fun set(block: TerminalUi.() -> TerminalUi) { _ui.value = _ui.value.block() }
    private fun launch(block: suspend () -> Unit) = viewModelScope.launch {
        try { block() } catch (e: CancellationException) { throw e }
        catch (e: Exception) {
            if (e is ApiFailure && e.sessionRejected && repo.session != null) expiredSession()
            else set { copy(busy = false, searching = false, message = e.message ?: "İşlem tamamlanamadı.") }
        }
    }
    private fun expiredSession() { dismissPdfShare(); dismissCategoryReport(); searchJob?.cancel(); catalogJob?.cancel(); catalogNoticeJob?.cancel(); set { copy(catalogUpdated = false, screen = Screen.LOGIN, busy = false, searching = false, loadingWorkflow = false, picking = null, packingMarks = emptyMap(), orders = emptyList(), review = false, message = "Oturum süresi doldu. Fiş korundu; yeniden giriş yapın.") }; loadUsers() }
    fun dismiss() = set { copy(message = null, printPrompt = false) }
    fun scannerStatus(status: String) = set { copy(scanner = status) }
    fun navigate(screen: Screen) = launch {
        if (_ui.value.busy) return@launch
        dismissPdfShare(); dismissCategoryReport(); searchJob?.cancel(); workflowJob?.cancel()
        set { copy(screen = screen, query = "", quotes = emptyList(), preview = null, searching = false, review = false, loadingWorkflow = false, workflowError = null) }
        if (screen == Screen.RECEIPTS) { val rows = repo.drafts(); if (_ui.value.screen == screen) set { copy(drafts = rows) } }
        if (screen in listOf(Screen.RATES, Screen.PRINT_SETTINGS)) loadOptions()
        if (screen == Screen.ORDERS) findOrders("", immediate = true)
    }
    fun back() = launch {
        if (_ui.value.categoryReport != null) { dismissCategoryReport(); return@launch }
        if (_ui.value.pdfShare != null) { dismissPdfShare(); return@launch }
        if (_ui.value.busy) return@launch
        searchJob?.cancel(); workflowJob?.cancel()
        mutations.withLock {
            val previous = _ui.value.screen
            if (previous == Screen.SALE) repo.leaveDraft(_ui.value.draft)
            set { copy(screen = parentScreen(previous, repo.session != null), draft = if (previous == Screen.SALE) null else draft,
                preview = null, query = "", quotes = emptyList(), searching = false, cachedPrices = false, review = false,
                workflowError = null, loadingWorkflow = false, picking = if (previous == Screen.PICKING) null else picking) }
        }
        if (_ui.value.screen == Screen.ORDERS) findOrders(_ui.value.orderQuery, immediate = true)
    }
    fun newSale() = launch {
        if (_ui.value.busy) return@launch
        dismissPdfShare(); dismissCategoryReport()
        mutations.withLock { repo.leaveDraft(_ui.value.draft); set { copy(screen = Screen.CUSTOMERS, draft = null, preview = null, query = "", quotes = emptyList(), review = false) } }
    }
    fun configure(url: String, code: String) = launch {
        dismissPdfShare(); dismissCategoryReport(); searchJob?.cancel(); catalogJob?.cancel(); catalogNoticeJob?.cancel(); lastCatalogSync = 0L; lastBootstrapAt = 0L
        mutations.withLock {
            require(_ui.value.draft == null) { "Önce fişten geri çıkın." }
            repo.configure(Settings(url.trim().trimEnd('/'), code.trim()))
            set { TerminalUi(screen = Screen.LOGIN, settings = repo.settings, preferences = repo.preferences, scanner = scanner) }
        }; loadUsers()
    }
    fun loadUsers() = launch {
        if (repo.settings.apiUrl.isBlank()) return@launch
        val data = repo.users().jsonObject
        set { copy(users = data["users"]!!.jsonArray.map { it.jsonObject.let { user -> user["username"]!!.jsonPrimitive.content to user["displayName"]!!.jsonPrimitive.content } }) }
    }
    fun login(username: String, password: String) = launch {
        dismissPdfShare(); dismissCategoryReport()
        lastCatalogSync = 0L; lastBootstrapAt = 0L; set { copy(busy = true) }; repo.login(username, password)
        val boot = repo.bootstrapForMenu(); val active = if (boot != null) repo.active() else null
        set { copy(busy = false, bootstrap = boot, draft = active, picking = null, orders = emptyList(), packingMarks = emptyMap(), workflowError = null, offline = false, screen = if (active == null) Screen.HOME else Screen.SALE) }
        syncCatalog()
    }
    fun logout() = launch { dismissPdfShare(); dismissCategoryReport(); workflowJob?.cancel(); searchJob?.cancel(); catalogJob?.cancel(); catalogNoticeJob?.cancel(); lastCatalogSync = 0L; lastBootstrapAt = 0L; repo.logout(); set { TerminalUi(screen = Screen.LOGIN, settings = repo.settings, preferences = repo.preferences) }; loadUsers() }
    fun reconnect() = launch {
        if (repo.session == null) return@launch
        if (!reconnectMutex.tryLock()) return@launch
        try {
            if (!_ui.value.offline && System.currentTimeMillis() - lastBootstrapAt < 5000) { syncCatalog(); return@launch }
            try { val wasOffline = _ui.value.offline; val boot = repo.bootstrapForMenu(); lastBootstrapAt = System.currentTimeMillis(); set { copy(bootstrap = boot, offline = false) }; syncCatalog(force = wasOffline) }
            catch (e: ApiFailure) {
                if (e.sessionRejected) expiredSession()
                else if (e.status >= 500) set { copy(offline = true) }
                else set { copy(message = e.message) }
            }
            catch (e: java.io.IOException) {
                android.util.Log.w("MelisaConnection", "ERP unavailable: ${e.javaClass.simpleName}")
                set { copy(offline = true) }
            }
        } finally { reconnectMutex.unlock() }
    }
    private fun syncCatalog(force: Boolean = false) {
        if (!isForeground || repo.session == null || _ui.value.bootstrap == null || _ui.value.screen == Screen.LOGIN) return
        if (catalogJob?.isActive == true || (!force && System.currentTimeMillis() - lastCatalogSync < 30000)) return
        lastCatalogSync = System.currentTimeMillis()
        catalogJob = viewModelScope.launch {
            try {
                if (repo.synchronizeCatalog()) {
                    catalogNoticeJob?.cancel()
                    set { copy(catalogUpdated = true) }
                    catalogNoticeJob = viewModelScope.launch {
                        delay(5000)
                        set { copy(catalogUpdated = false) }
                    }
                }
            } catch (e: CancellationException) { throw e }
            catch (e: ApiFailure) {
                if (e.sessionRejected) expiredSession()
                else if (e.status >= 500) set { copy(offline = true) }
                else android.util.Log.w("MelisaCatalog", "Refresh deferred: HTTP " + e.status)
            }
            catch (_: java.io.IOException) { set { copy(offline = true) } }
            catch (e: Exception) {
                android.util.Log.w("MelisaCatalog", "Refresh deferred: " + e.javaClass.simpleName)
                set { copy(message = "Veriler güncellenemedi; yerel kayıtlar korundu.") }
            } finally { lastCatalogSync = System.currentTimeMillis() }
        }
    }
    fun customer(customer: Customer) = launch {
        dismissPdfShare(); dismissCategoryReport()
        mutations.withLock {
            val selected = (_ui.value.bootstrap ?: error("Cari bilgileri alınamadı.")).requireCustomerAccess(customer)
            _ui.value.draft?.let { repo.save(it) }
            val draft = Draft(owner = repo.owner, actorId = repo.session!!.user.id, customer = selected)
            repo.save(draft); set { copy(draft = draft, screen = Screen.SALE, query = "", quotes = emptyList(), preview = null) }
        }
    }
    fun dismissCategoryReport() {
        categoryReportSequence++; categoryReportJob?.cancel()
        set { copy(categoryReport = null) }
    }
    fun showCategoryReport(target: Draft) {
        if (_ui.value.busy || target.owner != repo.owner || visiblePdfDraft(target.id) != target) return
        dismissPdfShare(); dismissCategoryReport(); searchJob?.cancel()
        val sequence = categoryReportSequence
        set { copy(categoryReport = CategoryReportUi(target), searching = false) }
        categoryReportJob = launch {
            try {
                check(repo.draft(target.id) == target) { "Fiş değişti. Yeniden açın." }
                val result = repo.categoryReport(target)
                if (sequence == categoryReportSequence && target.owner == repo.owner) set {
                    copy(categoryReport = CategoryReportUi(target, result.report, loading = false, fromCache = result.fromCache))
                }
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) {
                if (e is ApiFailure && e.sessionRejected) throw e
                if (sequence == categoryReportSequence && target.owner == repo.owner) set {
                    copy(categoryReport = CategoryReportUi(target, loading = false, error = e.message ?: "Kategori raporu alınamadı."))
                }
            }
        }
    }
    fun retryCategoryReport() { _ui.value.categoryReport?.draft?.let(::showCategoryReport) }
    fun selectReceiptGroup(group: ReceiptGroup) {
        if (!_ui.value.busy && group != ReceiptGroup.REVIEW) { dismissPdfShare(); dismissCategoryReport(); set { copy(receiptGroup = group) } }
    }
    fun openDraft(draft: Draft) = launch {
        dismissPdfShare(); dismissCategoryReport()
        mutations.withLock {
            if (_ui.value.busy) return@withLock
            require(draft.owner == repo.owner)
            val current = repo.draft(draft.id) ?: error("Fiş bulunamadı. Listeyi yeniden açın.")
            val next = when {
                current.receiptGroup == ReceiptGroup.REVIEW -> current.copy(state = DraftState.REVIEW_REQUIRED)
                current.onHold && current.canDeleteLocally -> current.resumeFromHold()
                else -> current
            }
            repo.save(next)
            set { copy(draft = next, screen = Screen.SALE, query = "", quotes = emptyList(), preview = null, review = false, allowRetry = false) }
        }
    }
    fun holdDraft(note: String) = launch {
        mutations.withLock {
            if (_ui.value.busy || _ui.value.screen != Screen.SALE) return@withLock
            val current = _ui.value.draft ?: return@withLock
            require(current.owner == repo.owner)
            check(repo.draft(current.id) == current) { "Fiş değişti. Yeniden açarak kontrol edin." }
            val next = current.hold(note)
            searchJob?.cancel()
            set { copy(busy = true) }
            repo.leaveDraft(next)
            val rows = repo.drafts()
            check(next.owner == repo.owner)
            set { copy(screen = Screen.RECEIPTS, receiptGroup = ReceiptGroup.WAITING, drafts = rows, draft = null,
                busy = false, review = false, query = "", quotes = emptyList(), preview = null, searching = false,
                message = "Fiş beklemeye alındı.") }
        }
    }
    fun holdListedDraft(draft: Draft, note: String) = changeListedDraft(draft, ReceiptGroup.WAITING) { it.hold(note) }
    fun updateHoldNote(draft: Draft, note: String) = changeListedDraft(draft, ReceiptGroup.WAITING) { it.editHoldNote(note) }
    private fun changeListedDraft(expected: Draft, group: ReceiptGroup, change: (Draft) -> Draft) = launch {
        mutations.withLock {
            if (_ui.value.busy || _ui.value.screen != Screen.RECEIPTS) return@withLock
            require(expected.owner == repo.owner)
            val current = repo.draft(expected.id) ?: error("Fiş bulunamadı. Listeyi yeniden açın.")
            check(current == expected) { "Fiş değişti. Listeyi yeniden açarak kontrol edin." }
            val next = change(current)
            set { copy(busy = true) }
            repo.save(next, active = false)
            val rows = repo.drafts()
            check(expected.owner == repo.owner)
            set { copy(drafts = rows, receiptGroup = group, busy = false) }
        }
    }
    // Called only by the second confirmation button; repository rechecks the displayed snapshot atomically.
    fun deleteDraft(expected: Draft) = launch {
        mutations.withLock {
            if (_ui.value.busy || _ui.value.screen != Screen.RECEIPTS) return@withLock
            set { copy(busy = true) }
            repo.deleteLocalDraft(expected)
            val rows = repo.drafts()
            check(expected.owner == repo.owner)
            set { copy(drafts = rows, draft = if (draft?.id == expected.id) null else draft,
                busy = false, message = "Fiş silindi.") }
        }
    }
    fun search(query: String, scan: Boolean = false) {
        val initial = _ui.value
        if (scan && searchJob?.isActive == true && initial.query == query) return
        if (initial.screen !in listOf(Screen.SALE, Screen.PRODUCTS) || (initial.screen == Screen.SALE && initial.draft?.state != DraftState.DRAFT)) return
        val customer = initial.draft?.customer ?: initial.bootstrap?.customers?.firstOrNull() ?: return
        searchJob?.cancel(); set { copy(query = query, preview = null, quotes = emptyList(), cachedPrices = false, searching = query.isNotBlank()) }
        if (query.isBlank()) return
        searchJob = launch {
            if (!scan) delay(200)
            (_ui.value.bootstrap ?: error("Cari bilgileri alınamadı.")).requireCustomerAccess(customer)
            val expectedOwner = repo.owner
            val cached = repo.cached(customer.id, query, scan)
            currentCoroutineContext().ensureActive()
            set { copy(quotes = if (!scan && offline) cached else emptyList(), preview = if (scan) cached.singleOrNull() else null, cachedPrices = cached.isNotEmpty()) }
            if (_ui.value.offline) {
                set { copy(searching = false, message = if (cached.isEmpty()) "Ürün veya çevrimdışı fiyatı bulunamadı. ERP'ye bağlanıp kartları güncelleyin." else if (scan && cached.size > 1) "Barkod birden fazla ürüne ait; kodla arayın." else null) }
                return@launch
            }
            try {
                val quotes = repo.search(customer.id, query, scan); currentCoroutineContext().ensureActive()
                check(repo.owner == expectedOwner)
                set { copy(offline = false, cachedPrices = false, searching = false, quotes = if (scan) emptyList() else quotes,
                    preview = if (scan) quotes.singleOrNull() else null,
                    message = if (quotes.isEmpty()) "Ürün bulunamadı" else if (scan && quotes.size > 1) "Barkod birden fazla ürüne ait; kodla arayın." else null) }
            } catch (e: CancellationException) { throw e }
            catch (e: java.io.IOException) {
                if (e is ApiFailure && e.status in 400..499) throw e
                val quotes = repo.cached(customer.id, query, scan); currentCoroutineContext().ensureActive()
                set { copy(offline = true, cachedPrices = quotes.isNotEmpty(), searching = false, quotes = if (scan) emptyList() else quotes,
                    preview = if (scan) quotes.singleOrNull() else null, message = if (quotes.isEmpty()) "Ürün veya çevrimdışı fiyatı bulunamadı. ERP'ye bağlanıp kartları güncelleyin." else if (scan && quotes.size > 1) "Barkod birden fazla ürüne ait; kodla arayın." else null) }
            }
        }
    }
    fun preview(quote: Quote) { if (!_ui.value.searching) set { copy(preview = quote, quotes = emptyList()) } }
    fun add(quantity: Int) {
        if (_ui.value.searching) return
        val quote = _ui.value.preview ?: return; val id = _ui.value.draft?.id ?: return
        launch { mutations.withLock {
            val old = _ui.value.draft ?: return@withLock; check(old.id == id)
            if (_ui.value.preview != quote) return@withLock
            (_ui.value.bootstrap ?: error("Cari bilgileri alınamadı.")).requireCustomerAccess(old.customer)
            val next = old.add(quote, quantity); repo.save(next)
            set { copy(draft = next, preview = null, query = "", quotes = emptyList(), message = null) }
        } }
    }
    fun edit(transform: (Draft) -> Draft) {
        val id = _ui.value.draft?.id ?: return
        launch { mutations.withLock { val old = _ui.value.draft ?: return@withLock; check(old.id == id)
            old.editable(); val next = transform(old); repo.save(next); set { copy(draft = next) }
        } }
    }
    fun review() { if (_ui.value.draft?.let { it.canDeleteLocally && it.lines.isNotEmpty() } == true && !_ui.value.busy) set { copy(review = true) } }
    fun closeReview() = set { copy(review = false) }
    fun submit() = launch {
        val frozen = mutations.withLock {
            val draft = _ui.value.draft ?: return@withLock null
            if (!draft.canDeleteLocally || _ui.value.busy) return@withLock null
            (_ui.value.bootstrap ?: error("Cari bilgileri alınamadı.")).requireCustomerAccess(draft.customer)
            require(!_ui.value.offline) { "Çevrimdışı satış tamamlanamaz. Taslak kaydedildi." }
            require(_ui.value.bootstrap?.saleEnabled == true) { "Satış bağlantısı henüz hazır değil. Taslak kaydedildi." }
            require(draft.lines.isNotEmpty())
            val next = draft.copy(state = DraftState.SUBMITTING, submissionJson = repo.payload(draft).toString())
            repo.save(next); set { copy(draft = next, busy = true, review = false, allowRetry = false) }; next
        } ?: return@launch
        sendFrozen(frozen)
    }
    private suspend fun sendFrozen(frozen: Draft) {
        try {
            val result = codec.decodeFromJsonElement<SaleResult>(repo.request("/sales/submit", codec.parseToJsonElement(frozen.submissionJson!!).jsonObject))
            result(frozen, result)
        } catch (e: CancellationException) { throw e }
        catch (e: Exception) {
            if (e is ApiFailure && e.saleRejectedBeforeCommit) {
                val next = frozen.copy(state = DraftState.DRAFT, submissionJson = null, approvalToken = null)
                repo.save(next)
                set { copy(draft = next, busy = false, allowRetry = false, message = e.message + " Fiş taslakta korundu.") }
                if (e.sessionRejected) expiredSession()
                return
            }
            val next = frozen.copy(state = DraftState.REVIEW_REQUIRED); repo.save(next)
            set { copy(draft = next, busy = false, message = "Satış sonucu doğrulanamadı. Fiş korundu; Sonucu Kontrol Et ile devam edin.") }
        }
    }
    private suspend fun result(draft: Draft, result: SaleResult) {
        val state = when(result.state) { "COMPLETED" -> DraftState.COMPLETED; "CANCELLED" -> DraftState.CANCELLED; else -> DraftState.REVIEW_REQUIRED }
        val next = draft.copy(state = state, receipt = result.receipt ?: draft.receipt); repo.save(next)
        set { copy(draft = next, busy = false, printPrompt = state == DraftState.COMPLETED && draft.receipt == null && preferences.askToPrint,
            allowRetry = result.permitsResubmit(draft), message = if (result.state == "NOT_FOUND") {
                if (result.permitsResubmit(draft)) "ERP'de kayıt yok. Aynı fişi yeniden deneyebilirsiniz."
                else "Fiş kaydı doğrulanamadı. Yeniden satış gönderilmez; yetkili kontrol etmeli."
            } else null) }
    }
    fun checkResult() = launch {
        val draft = _ui.value.draft ?: return@launch
        set { copy(busy = true) }
        val body = buildJsonObject { put("clientEventId", draft.id); put("terminalCode", repo.settings.terminalCode) }
        result(draft, codec.decodeFromJsonElement(repo.request("/sales/status", body)))
    }
    fun retry() = launch { val d = _ui.value.draft ?: return@launch
        require(!_ui.value.offline && _ui.value.bootstrap?.saleEnabled == true) { "Satış için ERP bağlantısı gerekli." }
        if (_ui.value.allowRetry && !_ui.value.busy && d.submissionJson != null && d.receipt == null) { set { copy(busy = true, allowRetry = false) }; sendFrozen(d) }
    }
    fun dismissPdfShare() {
        pdfShareSequence++
        pdfShareJob?.cancel(); pdfShareJob = null
        set { copy(pdfShare = null) }
    }
    private fun visiblePdfDraft(id: String): Draft? = when (_ui.value.screen) {
        Screen.RECEIPTS -> _ui.value.drafts.find { it.id == id }
        Screen.SALE -> _ui.value.draft?.takeIf { it.id == id }
        else -> null
    }
    private fun pdfShareCurrent(key: PdfShareRequestKey): Boolean = pdfShareStillVisible(key,
        _ui.value.pdfShare?.requestId, repo.owner, _ui.value.screen, _ui.value.receiptGroup, visiblePdfDraft(key.draft.id))
    fun showPdfShare(draft: Draft) {
        if (_ui.value.busy || !draft.canSharePdf || draft.owner != repo.owner || visiblePdfDraft(draft.id) != draft) return
        if (_ui.value.screen == Screen.RECEIPTS && _ui.value.receiptGroup != ReceiptGroup.SENT) return
        dismissPdfShare(); dismissCategoryReport()
        val key = PdfShareRequestKey(++pdfShareSequence, repo.owner, _ui.value.screen, draft)
        val receipt = draft.receipt ?: return
        val settings = repo.settings
        set { copy(pdfShare = PdfShareUi(key.requestId, draft.id, receipt.invoiceId, receipt.documentNumber), printPrompt = false) }
        pdfShareJob = viewModelScope.launch {
            try {
                check(repo.draft(draft.id) == draft) { "Fiş değişti. Yeniden açın." }
                currentCoroutineContext().ensureActive()
                if (!pdfShareCurrent(key)) return@launch
                val share = codec.decodeFromJsonElement<ReceiptPdfShare>(repo.request("/sales/${receipt.invoiceId}/pdf-share",
                    buildJsonObject { put("terminalCode", settings.terminalCode) }))
                val expiry = validatePdfShare(share, settings, System.currentTimeMillis())
                check(share.documentNumber == receipt.documentNumber) { "Fiş numarası doğrulanamadı." }
                val qr = withContext(Dispatchers.Default) { receiptQr(share.url) }
                currentCoroutineContext().ensureActive()
                if (pdfShareCurrent(key)) set { copy(pdfShare = pdfShare?.copy(loading = false, qr = qr, expiresAt = expiry)) }
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) {
                if (pdfShareCurrent(key)) {
                    if (e is ApiFailure && e.sessionRejected) expiredSession()
                    else set { copy(pdfShare = pdfShare?.copy(loading = false,
                        error = "PDF bağlantısı hazırlanamadı. Bağlantıyı kontrol edip yeniden deneyin.")) }
                }
            }
        }
    }
    fun renewPdfShare() {
        val state = _ui.value.pdfShare ?: return
        if (!state.loading) visiblePdfDraft(state.draftId)?.let(::showPdfShare) ?: dismissPdfShare()
    }
    fun print() = launch {
        val receipt = _ui.value.draft?.receipt ?: return@launch
        set { copy(printPrompt = false, busy = true) }
        repo.request("/sales/${receipt.invoiceId}/print", buildJsonObject { put("terminalCode", repo.settings.terminalCode) })
        set { copy(busy = false, message = "Fiş yazıcıya gönderildi.") }
    }
    fun approve(username: String, password: String, cancel: Boolean) = launch {
        val draft = _ui.value.draft ?: return@launch
        val body = buildJsonObject {
            put("username", username); put("password", password); put("terminalCode", repo.settings.terminalCode)
            put("kind", if (cancel) "cancel" else "discount"); put("sale", repo.payload(draft))
            draft.receipt?.let { put("invoiceId", it.invoiceId) }
        }
        set { copy(busy = true) }
        if (cancel) {
            val pending = draft.copy(state = DraftState.REVIEW_REQUIRED)
            repo.save(pending); set { copy(draft = pending, allowRetry = false) }
            try { result(draft, codec.decodeFromJsonElement(repo.request("/sales/cancel", body))) }
            catch (e: CancellationException) { throw e }
            catch (e: Exception) {
                if (e is ApiFailure && e.cancelRejectedBeforeCommit) {
                    repo.save(draft); set { copy(draft = draft, busy = false, message = e.message) }
                } else set { copy(busy = false, message = "İptal sonucu doğrulanamadı. Sonucu Kontrol Et ile devam edin.") }
            }
        } else {
            val data = repo.request("/approval", body).jsonObject
            mutations.withLock {
                check(_ui.value.draft == draft) { "Fiş değişti; onay yenilenmeli." }
                val next = draft.copy(approvalToken = data["approvalToken"]!!.jsonPrimitive.content); repo.save(next)
                set { copy(draft = next, busy = false, message = "Yetkili onayı alındı.") }
            }
        }
    }

    fun scanInput(value: String) { if (_ui.value.pdfShare != null || _ui.value.categoryReport != null) return; if (_ui.value.screen == Screen.PICKING) pickBarcode(value) else search(value, true) }
    fun preferences(next: UiPreferences) = launch { mutations.withLock { repo.savePreferences(next); set { copy(preferences = next) } } }
    fun loadOptions() {
        workflowJob?.cancel()
        val destination = _ui.value.screen
        workflowJob = launch {
            set { copy(loadingWorkflow = true, workflowError = null, options = null) }
            try { val result = repo.options(); if (_ui.value.screen == destination) set { copy(options = result, offline = false) } }
            catch (e: CancellationException) { throw e }
            catch (e: Exception) { if (e is ApiFailure && e.sessionRejected) throw e; if (_ui.value.screen == destination) set { copy(workflowError = e.message ?: "Ayarlar alınamadı.") } }
            finally { if (_ui.value.screen == destination) set { copy(loadingWorkflow = false) } }
        }
    }
    fun saveRates(usd: String, eur: String) = launch {
        if (_ui.value.busy) return@launch
        set { copy(busy = true, loadingWorkflow = true, workflowError = null) }
        try {
            val result = repo.saveRates(decimal(usd).toPlainString(), decimal(eur).toPlainString())
            set { copy(options = result, message = "ERP kurları güncellendi.") }; syncCatalog(force = true)
        } catch (e: CancellationException) { throw e }
        catch (e: Exception) { if (e is ApiFailure && e.sessionRejected) throw e; set { copy(options = null, workflowError = "Kur kaydı doğrulanamadı. ERP'den yenileyerek kontrol edin.") } }
        finally { set { copy(busy = false, loadingWorkflow = false) } }
    }
    fun findOrders(query: String, immediate: Boolean = false) {
        workflowJob?.cancel()
        set { copy(orderQuery = query, orders = emptyList(), ordersPage = 1, ordersHasMore = false, packingMarks = emptyMap(), workflowError = null, loadingWorkflow = true) }
        workflowJob = launch { if (!immediate) delay(250); readOrders(1, query) }
    }
    fun moreOrders() {
        if (_ui.value.loadingWorkflow || !_ui.value.ordersHasMore) return
        workflowJob = launch { set { copy(loadingWorkflow = true) }; readOrders(_ui.value.ordersPage + 1, _ui.value.orderQuery) }
    }
    private suspend fun readOrders(page: Int, query: String) {
        try {
            val result = repo.orders(query, page)
            val marks = repo.packingMarks(result.orders)
            if (_ui.value.screen == Screen.ORDERS && _ui.value.orderQuery == query) set {
                copy(orders = (if (page == 1) result.orders else orders + result.orders).distinctBy { it.id }, ordersPage = page, ordersHasMore = result.hasMore, packingMarks = (if (page == 1) marks else packingMarks + marks), workflowError = null)
            }
        } catch (e: CancellationException) { throw e }
        catch (e: Exception) { if (e is ApiFailure && e.sessionRejected) throw e; if (_ui.value.screen == Screen.ORDERS) set { copy(workflowError = e.message ?: "Tamamlanan fişler alınamadı.") } }
        finally { if (_ui.value.screen == Screen.ORDERS && _ui.value.orderQuery == query) set { copy(loadingWorkflow = false) } }
    }
    fun openOrder(id: Long) {
        workflowJob?.cancel()
        workflowJob = launch {
            set { copy(loadingWorkflow = true, workflowError = null) }
            try {
                val detail = repo.order(id); val progress = repo.picking(detail)
                repo.savePicking(progress)
                if (_ui.value.screen in listOf(Screen.ORDERS, Screen.PICKING)) set { copy(picking = progress, screen = Screen.PICKING) }
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { if (e is ApiFailure && e.sessionRejected) throw e; set { copy(workflowError = e.message ?: "Fiş açılamadı.") } }
            finally { set { copy(loadingWorkflow = false) } }
        }
    }
    fun pickBarcode(value: String) = updatePicking { it.scan(value) }
    fun pickQuantity(id: Long, value: String) = updatePicking { it.quantity(id, value) }
    private fun updatePicking(transform: (PickingProgress) -> PickingProgress) = launch {
        mutations.withLock {
            if (_ui.value.screen != Screen.PICKING || _ui.value.loadingWorkflow) return@withLock
            val current = _ui.value.picking ?: return@withLock
            val next = transform(current); repo.savePicking(next); set { copy(picking = next) }
        }
    }
    fun checkPicking(expected: PickingProgress, exceptionReason: String? = null) = launch {
        mutations.withLock {
            if (_ui.value.screen != Screen.PICKING || _ui.value.loadingWorkflow) return@withLock
            check(_ui.value.picking == expected) { "Sayım değişti; yeniden kontrol edin." }
            if (exceptionReason == null) require(expected.complete) { "Eksik veya fazla ürün varken normal paketleme tamamlanamaz." }
            set { copy(loadingWorkflow = true, workflowError = null) }
            try {
                val next = repo.confirmPicking(expected, exceptionReason)
                repo.savePicking(next)
                if (_ui.value.screen == Screen.PICKING && _ui.value.picking == expected) set { copy(picking = next,
                    message = if (next.packingStatus == "PACKING_EXCEPTION") "PACKING_EXCEPTION kaydedildi; normal tamamlanma değildir." else "Paketleme tam sayımla tamamlandı.") }
            } finally { set { copy(loadingWorkflow = false) } }
        }
    }
    fun uncheckPicking() = updatePicking { it.withoutConfirmation() }
    fun resetPicking(expected: PickingProgress) = launch {
        mutations.withLock {
            if (_ui.value.screen != Screen.PICKING || _ui.value.loadingWorkflow) return@withLock
            check(_ui.value.picking == expected) { "Sayım değişti; yeniden kontrol edin." }
            val next = PickingProgress(expected.order)
            repo.savePicking(next)
            set { copy(picking = next, message = "Yerel sayım sıfırlandı.") }
        }
    }

    fun foreground() {
        isForeground = true
        syncCatalog(force = true)
        if (connectionJob?.isActive == true) return
        connectionJob = viewModelScope.launch {
            while (isActive) {
                delay(5000)
                // An ERP outage need not change Wi-Fi, so onAvailable alone cannot recover it.
                // Read-only connection and catalog checks never submit a sale.
                if (repo.session != null && _ui.value.screen != Screen.LOGIN) {
                    if (_ui.value.offline) reconnect().join() else syncCatalog()
                }
            }
        }
    }
    fun background() { dismissPdfShare(); dismissCategoryReport(); isForeground = false; connectionJob?.cancel(); searchJob?.cancel(); catalogJob?.cancel(); catalogNoticeJob?.cancel(); set { copy(catalogUpdated = false, searching = false, query = "", preview = null, quotes = emptyList()) } }
    fun networkLost() = set { copy(offline = true) }
}
