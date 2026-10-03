package com.melisaerp.nativeterminal

import android.os.Bundle
import android.net.ConnectivityManager
import android.net.Network
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.compose.ReportDrawnWhen
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.melisaerp.nativeterminal.model.*
import com.melisaerp.nativeterminal.scanner.BarcodeScanner
import com.melisaerp.nativeterminal.scanner.createBarcodeScanner

class MainActivity : ComponentActivity() {
    private val vm by viewModels<TerminalViewModel> { object : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST") override fun <T : ViewModel> create(modelClass: Class<T>): T =
            TerminalViewModel((application as TerminalApplication).repository) as T
    } }
    private lateinit var scanner: BarcodeScanner
    private val connectivity by lazy { getSystemService(ConnectivityManager::class.java) }
    private val networkCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) { runOnUiThread { vm.reconnect() } }
        override fun onLost(network: Network) { runOnUiThread { vm.networkLost() } }
    }
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState); enableEdgeToEdge()
        scanner = createBarcodeScanner(this, vm::scanInput, vm::scannerStatus) { vm.ui.value.preferences }
        setContent {
            MaterialTheme(
                colorScheme = lightColorScheme(primary = Green, secondary = Color(0xFF426452), background = Paper, surface = Paper, onSurface = Ink, onBackground = Ink),
                typography = Typography().let { type -> type.copy(
                    bodyLarge = type.bodyLarge.copy(letterSpacing = 0.sp, lineHeight = 22.sp),
                    bodyMedium = type.bodyMedium.copy(letterSpacing = 0.sp),
                    bodySmall = type.bodySmall.copy(letterSpacing = 0.sp)
                ) }
            ) {
                val ui by vm.ui.collectAsStateWithLifecycle()
                ReportDrawnWhen { ui.screen != Screen.LOADING }
                TerminalScreen(ui, vm, scanner::trigger)
            }
        }
    }
    override fun onStart() { super.onStart(); scanner.onStart(); vm.foreground(); connectivity.registerDefaultNetworkCallback(networkCallback) }
    override fun onStop() { connectivity.unregisterNetworkCallback(networkCallback); scanner.onStop(); vm.background(); super.onStop() }
    override fun onResume() { super.onResume(); scanner.onResume() }
    override fun onPause() { scanner.onPause(); super.onPause() }
    override fun onDestroy() { scanner.close(); super.onDestroy() }
}

@Composable private fun TerminalScreen(ui: TerminalUi, vm: TerminalViewModel, scan: () -> Unit) {
    val snackbar = remember { SnackbarHostState() }
    var approval by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(ui.message) { ui.message?.let { snackbar.showSnackbar(it, duration = SnackbarDuration.Short); vm.dismiss() } }
    BackHandler(ui.screen !in listOf(Screen.LOGIN, Screen.LOADING, Screen.HOME)) { if (!ui.busy) vm.back() }
    Scaffold(modifier = Modifier.fillMaxSize().systemBarsPadding().imePadding(), snackbarHost = { SnackbarHost(snackbar) }) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).padding(horizontal = if (ui.screen in listOf(Screen.SALE, Screen.LOGIN, Screen.PRODUCTS, Screen.CONNECTION)) 8.dp else 0.dp)) {
            if (ui.catalogUpdated) {
                Surface(color = Color(0xFFDDF3E3), contentColor = Color(0xFF176B37), modifier = Modifier.fillMaxWidth()) {
                    Text("Güncellendi", fontSize = 12.sp, fontWeight = FontWeight.Medium,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp))
                }
            }
            when (ui.screen) {
                Screen.LOADING -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
                Screen.LOGIN -> Login(ui, vm)
                Screen.HOME -> HomeScreen(ui, vm)
                Screen.SETTINGS -> SettingsHub(ui, vm)
                Screen.CONNECTION -> ConnectionSettingsScreen(ui, vm)
                Screen.RATES -> RatesScreen(ui, vm)
                Screen.PRINT_SETTINGS -> PrintSettingsScreen(ui, vm)
                Screen.SOUND_SETTINGS -> SoundSettingsScreen(ui, vm)
                Screen.ORDERS -> OrdersScreen(ui, vm)
                Screen.PICKING -> PickingScreen(ui, vm, scan)
                Screen.CUSTOMERS -> CustomersScreen(ui, vm)
                Screen.RECEIPTS -> ReceiptsScreen(ui, vm)
                Screen.PRODUCTS -> {
                    Row(verticalAlignment = Alignment.CenterVertically) { TextButton(onClick = vm::back) { Text("‹") }; Text("Ürün ara", fontWeight = FontWeight.Bold) }
                    PriceConnectionStatus(ui)
                    SearchBox(ui, vm, scan)
                    ui.preview?.let { q -> ProductPreview(q, false, {}) }
                    QuoteList(ui.quotes, vm::preview, Modifier.weight(1f))
                }
                Screen.SALE -> SaleScreen(ui, vm, scan) { approval = it }
            }
        }
    }
    ui.categoryReport?.let { CategoryReportDialog(it, vm::dismissCategoryReport, vm::retryCategoryReport, if (ui.screen == Screen.SALE) "Satırlara dön" else "Fişlere dön") }
    ui.pdfShare?.let { ReceiptPdfShareDialog(it, vm::dismissPdfShare, vm::renewPdfShare) }
    if (ui.review) ui.draft?.let { draft ->
        AlertDialog(onDismissRequest = vm::closeReview, title = { Text("Son kontrol") }, text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(draft.customer.code, fontWeight = FontWeight.Bold)
                Text("${draft.lines.size} ürün çeşidi · ${draft.quantity} adet")
                Text("İndirim: %${draft.discountRate}")
                Text(money(draft.total, draft.customer.currency), style = MaterialTheme.typography.titleLarge)
                if (ui.offline) Text("Çevrimdışı satış tamamlanamaz.", color = MaterialTheme.colorScheme.error)
                else if (ui.bootstrap?.saleEnabled != true) Text("Satış bağlantısı henüz hazır değil; fiş taslakta korunur.", color = MaterialTheme.colorScheme.error)
            }
        }, confirmButton = {
            val needsApproval = draft.discountRate.toBigDecimal() > 5.toBigDecimal() && draft.approvalToken == null
            Button(enabled = !ui.busy && !ui.offline && ui.bootstrap?.saleEnabled == true, onClick = { if (needsApproval) approval = "discount" else vm.submit() }) { Text(if (needsApproval) "Yetkili Onayı" else "Onayla") }
        }, dismissButton = { TextButton(onClick = vm::closeReview) { Text("Geri") } })
    }
    if (ui.printPrompt) AlertDialog(onDismissRequest = vm::dismiss, title = { Text("Fiş basılsın mı?") },
        confirmButton = { Button(onClick = vm::print) { Text("Yazdır") } }, dismissButton = { TextButton(onClick = vm::dismiss) { Text("Şimdi değil") } })
    approval?.let { kind -> ApprovalDialog(cancel = kind == "cancel", onDismiss = { approval = null }) { user, password -> vm.approve(user, password, kind == "cancel"); approval = null } }
}

@Composable private fun ColumnScope.SaleScreen(ui: TerminalUi, vm: TerminalViewModel, scan: () -> Unit, approve: (String) -> Unit) {
    val d = ui.draft ?: return
    var editLine by remember { mutableStateOf<Line?>(null) }
    var editDiscount by remember { mutableStateOf(false) }
    var editNote by remember { mutableStateOf(false) }
    var holdNote by remember { mutableStateOf(false) }
    Row(Modifier.fillMaxWidth().height(40.dp), verticalAlignment = Alignment.CenterVertically) {
        TextButton(onClick = vm::back, enabled = !ui.busy, contentPadding = PaddingValues(0.dp), modifier = Modifier.width(40.dp)) { Text("‹", fontSize = 28.sp) }
        Text("${d.customer.code} · ${d.customer.currency}", fontSize = 14.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
    PriceConnectionStatus(ui)
    if (d.canDeleteLocally) {
        SearchBox(ui, vm, scan)
        ui.preview?.let { ProductPreview(it, true, vm::add, enabled = !ui.searching) }
        if (ui.quotes.isNotEmpty()) QuoteList(ui.quotes, vm::preview, Modifier.heightIn(max = 145.dp))
    } else {
        Text(when(d.state) { DraftState.COMPLETED -> "Tamamlandı · ${d.receipt?.documentNumber.orEmpty()}"; DraftState.CANCELLED -> "İptal · ${d.receipt?.documentNumber.orEmpty()}"; else -> "Satış sonucu kontrol edilmeli" }, fontWeight = FontWeight.Bold, modifier = Modifier.padding(vertical = 8.dp))
    }
    HorizontalDivider()
    LazyColumn(Modifier.weight(1f).fillMaxWidth()) {
        items(d.lines, key = { it.quote.productId }) { line ->
            Row(Modifier.fillMaxWidth().heightIn(min = 43.dp).clickable(enabled = d.canDeleteLocally) { editLine = line }, verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("${line.quote.stockCode}${if (line.overridden) " *" else ""} · ${line.quote.productName}", maxLines = 1, overflow = TextOverflow.Ellipsis, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                    Text("${line.quantity} × ${money(line.unitPrice, d.customer.currency)}", fontSize = 11.sp)
                }
                Text(money(line.total, d.customer.currency), fontWeight = FontWeight.Bold, fontSize = 12.sp)
                if (d.canDeleteLocally) TextButton(onClick = { vm.edit { it.remove(line.quote.productId) } }, contentPadding = PaddingValues(0.dp), modifier = Modifier.width(30.dp)) { Text("×", fontSize = 19.sp) }
            }
            HorizontalDivider(color = Color(0xFFECEFEB))
        }
    }
    if (d.lines.isNotEmpty()) TextButton(onClick = { vm.showCategoryReport(d) }, enabled = !ui.busy, modifier = Modifier.fillMaxWidth()) { Text("Kategori Raporu") }
    if (d.canDeleteLocally) {
        Row(Modifier.fillMaxWidth().heightIn(min = 42.dp), verticalAlignment = Alignment.CenterVertically) {
            TextButton(onClick = { editDiscount = true }, enabled = !ui.busy, contentPadding = PaddingValues(horizontal = 2.dp), modifier = Modifier.weight(1f)) { Text("İndirim %${d.discountRate}", fontSize = 11.sp, maxLines = 1) }
            TextButton(onClick = { editNote = true }, enabled = !ui.busy, contentPadding = PaddingValues(horizontal = 2.dp), modifier = Modifier.weight(1f)) { Text(if (d.note.isBlank()) "Not ekle" else "Notu düzenle", fontSize = 11.sp, maxLines = 1) }
            TextButton(onClick = { holdNote = true }, enabled = !ui.busy && d.canDeleteLocally && d.lines.isNotEmpty(), contentPadding = PaddingValues(horizontal = 2.dp), modifier = Modifier.weight(1f)) { Text("Beklemeye al", fontSize = 11.sp, maxLines = 1) }
        }
        Row(Modifier.fillMaxWidth().heightIn(min = 56.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) { Text("TOPLAM", fontSize = 10.sp); Text(money(d.total, d.customer.currency), fontWeight = FontWeight.Bold, fontSize = 19.sp) }
            Button(onClick = vm::review, enabled = d.lines.isNotEmpty() && !ui.busy, contentPadding = PaddingValues(horizontal = 12.dp)) { Text("SATIŞI TAMAMLA", fontSize = 11.sp) }
        }
    } else if (d.receiptGroup == ReceiptGroup.REVIEW) {
        Text("Fiş korunuyor. Yeni kayıt oluşturmadan sonucunu kontrol edin.", fontSize = 12.sp)
        Button(onClick = vm::checkResult, enabled = !ui.busy, modifier = Modifier.fillMaxWidth()) { Text(if (ui.busy) "Kontrol ediliyor…" else "Sonucu Kontrol Et") }
        if (ui.allowRetry) OutlinedButton(onClick = vm::retry, enabled = !ui.busy, modifier = Modifier.fillMaxWidth()) { Text("Aynı Fişi Tekrar Dene") }
    } else {
        Text(money(d.total, d.customer.currency), fontSize = 21.sp, fontWeight = FontWeight.Bold)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            if (d.state == DraftState.COMPLETED) TextButton(onClick = vm::print, enabled = !ui.busy) { Text("Yazdır") }
            if (d.canSharePdf) TextButton(onClick = { vm.showPdfShare(d) }, enabled = !ui.busy) { Text("PDF paylaş") }
            Button(onClick = vm::newSale, enabled = !ui.busy) { Text("Yeni Satış") }
        }
        if (d.state == DraftState.COMPLETED) TextButton(onClick = { approve("cancel") }, enabled = !ui.busy, modifier = Modifier.fillMaxWidth()) { Text("İptal / Düzeltme") }
    }
    editLine?.let { line -> LineDialog(line, ui.bootstrap?.canChangeSalePrice == true, { editLine = null }, { qty, price ->
        vm.edit { d0 -> var result = d0.quantity(line.quote.productId, qty); if (price != line.unitPrice) result = result.price(line.quote.productId, price); result }; editLine = null
    }, { vm.edit { it.remove(line.quote.productId) }; editLine = null }) }
    if (holdNote) HoldNoteDialog("Beklemeye al", d.holdNote, ui.busy, { holdNote = false }) { note -> vm.holdDraft(note); holdNote = false }
    if (editDiscount) ValueDialog("Fiş indirimi (%)", d.discountRate, true, { editDiscount = false }) { value -> vm.edit { it.discount(value) }; editDiscount = false }
    if (editNote) ValueDialog("Fiş notu", d.note, false, { editNote = false }) { value -> vm.edit { it.copy(note = value.take(200), approvalToken = null, updatedAt = System.currentTimeMillis()) }; editNote = false }
}

@Composable private fun PriceConnectionStatus(ui: TerminalUi) {
    if (ui.offline) Text("Çevrimdışı · son bilinen fiyat", color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
    else if (ui.cachedPrices && (ui.preview != null || ui.quotes.isNotEmpty())) {
        Text(if (ui.searching) "Güncel fiyat alınıyor…" else "Son bilinen fiyat · güncellemek için yeniden arayın", color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
    }
}
@Composable private fun SearchBox(ui: TerminalUi, vm: TerminalViewModel, scan: () -> Unit) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        ProductSearchField(ui.query, { vm.search(it) }, Modifier.weight(1f))
        TextButton(onClick = scan, modifier = Modifier.width(48.dp), contentPadding = PaddingValues(0.dp)) { Text("Tara", fontSize = 12.sp) }
    }
    if (ui.searching) LinearProgressIndicator(Modifier.fillMaxWidth().height(2.dp)) else Spacer(Modifier.height(2.dp))
}
@Composable internal fun ProductSearchField(value: String, onValueChange: (String) -> Unit, modifier: Modifier = Modifier) {
    var nameKeyboard by remember { mutableStateOf(false) }
    OutlinedTextField(value = value, onValueChange = onValueChange,
        placeholder = { Text("Kod / barkod / ürün ara", fontSize = 13.sp) }, singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = if (nameKeyboard) KeyboardType.Text else KeyboardType.Number, autoCorrectEnabled = false),
        trailingIcon = {
            TextButton(onClick = { nameKeyboard = !nameKeyboard }, contentPadding = PaddingValues(0.dp), modifier = Modifier.width(40.dp)) {
                Text(if (nameKeyboard) "123" else "ABC", fontSize = 11.sp)
            }
        }, modifier = modifier, textStyle = LocalTextStyle.current.copy(fontSize = 14.sp))
}
@Composable internal fun ProductPreview(q: Quote, canAdd: Boolean, add: (Int) -> Unit, enabled: Boolean = true) {
    // A fresh price for the same product must not discard the quantity being entered.
    var quantity by remember(q.customerId, q.productId, q.currency) { mutableStateOf("1") }
    var quantityTouched by remember(q.customerId, q.productId, q.currency) { mutableStateOf(false) }
    Column(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Text(q.stockCode, fontSize = 22.sp, fontWeight = FontWeight.Bold)
        var full by remember { mutableStateOf(false) }
        Text(q.productName, maxLines = if (full) 3 else 1, overflow = TextOverflow.Ellipsis, fontSize = 12.sp, modifier = Modifier.clickable { full = !full })
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Column(Modifier.weight(1f)) {
                Text(money(q.unitPrice, q.currency), fontSize = 18.sp, fontWeight = FontWeight.Bold)
                Text("Stok: ${q.stock}${if (q.stock.toBigDecimal().signum() < 0) " ⚠" else ""}", fontSize = 11.sp)
            }
            if (canAdd) {
                key(q.customerId, q.productId, q.currency) {
                    OutlinedTextField(quantity, { if (it.length <= 5 && it.all { digit -> digit in '0'..'9' }) quantity = it },
                        label = { Text("Adet", fontSize = 10.sp) }, placeholder = { Text("0", fontSize = 13.sp) },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), singleLine = true,
                        modifier = Modifier.width(62.dp).onFocusChanged { focus ->
                            if (focus.isFocused && !quantityTouched) {
                                quantityTouched = true
                                quantity = ""
                            }
                        }, textStyle = LocalTextStyle.current.copy(fontSize = 13.sp))
                }
                Button(onClick = { add(quantity.toInt()) }, enabled = enabled && (quantity.toIntOrNull() ?: 0) > 0, contentPadding = PaddingValues(horizontal = 10.dp)) { Text(if (enabled) "FİŞE EKLE" else "BEKLE", fontSize = 11.sp) }
            }
        }
    }
}
@Composable private fun QuoteList(quotes: List<Quote>, select: (Quote) -> Unit, modifier: Modifier) {
    LazyColumn(modifier.fillMaxWidth()) { items(quotes, key = { it.productId }) { q ->
        Row(Modifier.fillMaxWidth().clickable { select(q) }.padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) { Text(q.stockCode, fontWeight = FontWeight.Bold, fontSize = 13.sp); Text(q.productName, maxLines = 1, overflow = TextOverflow.Ellipsis, fontSize = 11.sp) }
            Text(money(q.unitPrice, q.currency), fontSize = 13.sp)
        }; HorizontalDivider()
    } }
}
@Composable private fun ColumnScope.Login(ui: TerminalUi, vm: TerminalViewModel) {
    var username by remember { mutableStateOf("") }; var password by remember { mutableStateOf("") }
    Text("Personel girişi", style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(vertical = 20.dp))
    LazyColumn(Modifier.weight(1f)) { items(ui.users) { user -> OutlinedButton(onClick = { username = user.first }, modifier = Modifier.fillMaxWidth()) { Text(user.second + if (username == user.first) " ✓" else "") } } }
    if (ui.users.isEmpty()) OutlinedTextField(username, { username = it }, label = { Text("Kullanıcı adı") }, singleLine = true, modifier = Modifier.fillMaxWidth())
    OutlinedTextField(password, { password = it }, label = { Text("Şifre") }, singleLine = true, visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password), modifier = Modifier.fillMaxWidth())
    Button(onClick = { vm.login(username, password); password = "" }, enabled = username.isNotBlank() && password.isNotBlank() && !ui.busy, modifier = Modifier.fillMaxWidth()) { Text(if (ui.busy) "Bağlanıyor…" else "Giriş") }
    TextButton(onClick = { vm.navigate(Screen.CONNECTION) }, modifier = Modifier.fillMaxWidth()) { Text("Bağlantı ayarları") }
}
@Composable private fun ColumnScope.ConnectionSettingsScreen(ui: TerminalUi, vm: TerminalViewModel) {
    var url by remember { mutableStateOf(ui.settings.apiUrl) }; var code by remember { mutableStateOf(ui.settings.terminalCode) }
    PageHeader("Bağlantı Ayarları", vm::back)
    OutlinedTextField(url, { url = it }, label = { Text("ERP sunucu adresi") }, placeholder = { Text("https://erp.ornek.com") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri), modifier = Modifier.fillMaxWidth())
    OutlinedTextField(code, { code = it }, label = { Text("Kayıtlı cihaz kodu") }, singleLine = true, modifier = Modifier.fillMaxWidth())
    Button(onClick = { vm.configure(url, code) }, modifier = Modifier.fillMaxWidth()) { Text("Kaydet ve giriş yap") }
    Text(ui.scanner, fontSize = 12.sp, modifier = Modifier.padding(vertical = 12.dp))
    Text("Melisa Native ${BuildConfig.VERSION_NAME}", fontSize = 12.sp)
    Spacer(Modifier.weight(1f))
    TextButton(onClick = vm::back) { Text("Geri") }
}
@Composable private fun ValueDialog(title: String, initial: String, numeric: Boolean, dismiss: () -> Unit, save: (String) -> Unit) {
    var value by remember { mutableStateOf(initial) }
    val valid = !numeric || runCatching {
        val rate = decimal(value)
        rate.signum() >= 0 && rate < 100.toBigDecimal() && rate.scale() <= 2
    }.getOrDefault(false)
    AlertDialog(onDismissRequest = dismiss, title = { Text(title) }, text = {
        OutlinedTextField(value, { if (it.length <= if (numeric) 8 else 200) value = it },
            isError = !valid && value.isNotEmpty(),
            supportingText = { if (numeric && !valid) Text("0–99,99 arasında bir yüzde girin. %5 üzeri yetkili onayı gerektirir.") },
            keyboardOptions = KeyboardOptions(keyboardType = if (numeric) KeyboardType.Decimal else KeyboardType.Text))
    }, confirmButton = { Button(onClick = { save(value) }, enabled = valid) { Text("Kaydet") } }, dismissButton = { TextButton(onClick = dismiss) { Text("Vazgeç") } })
}
@Composable private fun LineDialog(line: Line, canPrice: Boolean, dismiss: () -> Unit, save: (Int,String) -> Unit, remove: () -> Unit) {
    var qty by remember { mutableStateOf(line.quantity.toString()) }; var price by remember { mutableStateOf(line.unitPrice) }
    val valid = qty.toIntOrNull()?.let { it in 1..99999 } == true && runCatching { decimal(price).signum() > 0 && decimal(price).scale() <= 2 }.getOrDefault(false)
    AlertDialog(onDismissRequest = dismiss, title = { Text(line.quote.stockCode) }, text = {
        Column { OutlinedTextField(qty, { qty = it }, label = { Text("Adet") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
            OutlinedTextField(price, { price = it }, enabled = canPrice, label = { Text("Birim fiyat") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal))
            TextButton(onClick = remove) { Text("Ürünü sil", color = MaterialTheme.colorScheme.error) }
        }
    }, confirmButton = { Button(onClick = { save(qty.toInt(), decimal(price).toPlainString()) }, enabled = valid) { Text("Kaydet") } }, dismissButton = { TextButton(onClick = dismiss) { Text("Vazgeç") } })
}
@Composable private fun ApprovalDialog(cancel: Boolean, onDismiss: () -> Unit, approve: (String,String) -> Unit) {
    var username by remember { mutableStateOf("") }; var password by remember { mutableStateOf("") }
    AlertDialog(onDismissRequest = onDismiss, title = { Text(if (cancel) "İptal / Düzeltme talebi" else "Yetkili indirim onayı") }, text = {
        Column {
            if (cancel) Text("Yetkili onayında fiş iptal edilir; stok ve cari etkisi geri alınır. Düzeltme için yeni fiş açılır.", fontSize = 13.sp)
            OutlinedTextField(username, { username = it }, label = { Text("Yetkili kullanıcı") }, singleLine = true)
            OutlinedTextField(password, { password = it }, label = { Text("Yetkili şifresi") }, singleLine = true, visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password))
        }
    }, confirmButton = { Button(onClick = { approve(username, password); password = "" }, enabled = username.isNotBlank() && password.isNotBlank()) { Text(if (cancel) "Onayla ve İptal Et" else "Onayla") } }, dismissButton = { TextButton(onClick = onDismiss) { Text("Vazgeç") } })
}
