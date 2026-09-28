package com.melisaerp.nativeterminal

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.melisaerp.nativeterminal.model.*

internal val Ink = Color(0xFF111827)
internal val Muted = Color(0xFF4B5563)
internal val Green = Color(0xFF10784E)
internal val Mint = Color(0xFFE2F3E8)
internal val Rule = Color(0xFFE0E3E7)
internal val Paper = Color(0xFFFCFCFA)

@Composable internal fun PageHeader(title: String, back: () -> Unit) {
    Row(Modifier.fillMaxWidth().height(56.dp).padding(horizontal = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        IconButton(onClick = back) { Icon(Icons.Outlined.ArrowBack, contentDescription = "Geri", tint = Ink) }
        Text(title, fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Ink, modifier = Modifier.padding(start = 4.dp))
    }
    HorizontalDivider(color = Rule)
}
@Composable private fun IconDisc(icon: ImageVector, primary: Boolean = false, size: Int = 48) {
    Box(Modifier.size(size.dp).background(if (primary) Color.White.copy(alpha = .12f) else Mint, CircleShape), contentAlignment = Alignment.Center) {
        Icon(icon, null, Modifier.size((size * .54f).dp), tint = if (primary) Color.White else Color(0xFF064D35))
    }
}
@Composable private fun ActionTile(title: String, description: String, icon: ImageVector, modifier: Modifier = Modifier, primary: Boolean = false, compact: Boolean = false, click: () -> Unit) {
    Surface(onClick = click, modifier = modifier, shape = RoundedCornerShape(9.dp),
        color = if (primary) Green else Color.White, contentColor = if (primary) Color.White else Ink,
        border = if (primary) null else BorderStroke(1.dp, Rule)) {
        if (compact) Column(Modifier.padding(13.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                IconDisc(icon, size = 46); Spacer(Modifier.weight(1f)); Icon(Icons.Outlined.ChevronRight, null, Modifier.size(20.dp))
            }
            Spacer(Modifier.height(5.dp))
            Text(title, fontSize = 17.sp, fontWeight = FontWeight.Bold)
            Text(description, fontSize = 12.sp, color = Muted, maxLines = 1, overflow = TextOverflow.Ellipsis)
        } else Row(Modifier.padding(horizontal = 12.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            IconDisc(icon, primary, 50); Spacer(Modifier.width(13.dp))
            Column(Modifier.weight(1f)) {
                Text(title, fontSize = 19.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                Text(description, fontSize = 13.sp, color = if (primary) Color.White.copy(alpha = .94f) else Muted, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            Icon(Icons.Outlined.ChevronRight, null, Modifier.size(22.dp))
        }
    }
}
@Composable internal fun HomeScreen(ui: TerminalUi, vm: TerminalViewModel) {
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val dense = maxHeight < 570.dp
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 14.dp)) {
            Image(painterResource(R.drawable.melisa_wordmark), "Melisa baby", Modifier.width(if (dense) 144.dp else 158.dp).height(if (dense) 59.dp else 65.dp))
            Spacer(Modifier.height(if (dense) 8.dp else 13.dp))
            Text("Ana menü", fontSize = 30.sp, lineHeight = 36.sp, fontWeight = FontWeight.Bold, color = Ink)
            Text("Yapmak istediğiniz işlemi seçin", fontSize = 15.sp, color = Muted)
            Spacer(Modifier.height(if (dense) 15.dp else 20.dp))
            val rowHeight = if (dense) 76.dp else 82.dp
            ActionTile("Satış", "Cari seç ve satışa başla", Icons.Outlined.ShoppingCart, Modifier.fillMaxWidth().height(rowHeight), primary = true) { vm.navigate(Screen.CUSTOMERS) }
            Spacer(Modifier.height(8.dp))
            ActionTile("Sipariş Toplama", "Fişleri paketlerken kontrol et", Icons.Outlined.Inventory2, Modifier.fillMaxWidth().height(rowHeight)) { vm.navigate(Screen.ORDERS) }
            Spacer(Modifier.height(8.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ActionTile("Ürün Ara", "Kod, barkod veya ad", Icons.Outlined.Search, Modifier.weight(1f).height(124.dp), compact = true) { vm.navigate(Screen.PRODUCTS) }
                ActionTile("Fişler", "Taslaklar ve geçmiş", Icons.Outlined.ReceiptLong, Modifier.weight(1f).height(124.dp), compact = true) { vm.navigate(Screen.RECEIPTS) }
            }
            Spacer(Modifier.height(8.dp))
            ActionTile("Ayarlar", "Kur, yazıcı ve uygulama", Icons.Outlined.Settings, Modifier.fillMaxWidth().height(rowHeight)) { vm.navigate(Screen.SETTINGS) }
            if (ui.offline) Text("Çevrimdışı", color = MaterialTheme.colorScheme.error, fontSize = 12.sp, modifier = Modifier.padding(top = 5.dp))
        }
    }
}
@Composable internal fun CustomersScreen(ui: TerminalUi, vm: TerminalViewModel) {
    val bootstrap = ui.bootstrap?.validatedCustomerScope()
    var query by remember { mutableStateOf("") }
    var selectedRoute by remember(bootstrap?.customerScopeRevision) { mutableStateOf<Long?>(null) }
    val cash = bootstrap?.customers.orEmpty().filter { it.isVerifiedCash() }.sortedBy { it.code }
    val routed = bootstrap?.customers.orEmpty().filter { !it.isVerifiedCash() && it.matchesCustomerSearch(query) }
    val routes = bootstrap?.routes.orEmpty().filter { selectedRoute == null || it.id == selectedRoute }
    Column(Modifier.fillMaxSize()) {
        PageHeader("Satış", vm::back)
        Column(Modifier.padding(horizontal = 12.dp, vertical = 8.dp)) {
            Text("Peşinler", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Ink)
            Row(Modifier.fillMaxWidth().padding(top = 6.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                cash.forEach { customer ->
                    Surface(onClick = { vm.customer(customer) }, shape = RoundedCornerShape(9.dp), border = BorderStroke(1.dp, Rule),
                        color = Mint, modifier = Modifier.weight(1f).height(60.dp)) {
                        Column(Modifier.padding(8.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                            Text(when (customer.currency) { "USD" -> "$"; "EUR" -> "€"; else -> "₺" }, color = Green, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                            Text("Peşin ${customer.currency}", fontSize = 12.sp, color = Ink)
                        }
                    }
                }
            }
            bootstrap?.customerScopeWarning?.let { Text(it, color = MaterialTheme.colorScheme.error, fontSize = 12.sp, modifier = Modifier.padding(top = 8.dp)) }
            if (ui.offline) Text("Çevrimdışı · son alınan rota ve fiyatlar", color = MaterialTheme.colorScheme.error, fontSize = 12.sp, modifier = Modifier.padding(top = 6.dp))
            if (bootstrap?.customers.isNullOrEmpty()) {
                Text("Cari bilgileri alınamadı. ERP bağlantısını kontrol edin.", color = Muted)
                TextButton(onClick = { vm.reconnect() }) { Text("Yeniden dene") }
            }
            if (!bootstrap?.routes.isNullOrEmpty()) {
                OutlinedTextField(query, { query = it }, label = { Text("Cari adı veya kodu ara") }, singleLine = true,
                    leadingIcon = { Icon(Icons.Outlined.Search, null) }, modifier = Modifier.fillMaxWidth().padding(top = 8.dp))
                Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    FilterChip(selectedRoute == null, { selectedRoute = null }, label = { Text("Tüm rotalar") })
                    bootstrap?.routes.orEmpty().forEach { route ->
                        FilterChip(selectedRoute == route.id, { selectedRoute = route.id }, label = { Text(route.name) })
                    }
                }
            } else if (bootstrap?.customerScopeWarning == null && cash.isNotEmpty()) {
                Text("Bu cihazda rota carisi yok. Peşin satış seçebilirsiniz.", color = Muted, fontSize = 13.sp, modifier = Modifier.padding(top = 12.dp))
            }
        }
        LazyColumn(Modifier.weight(1f), contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            routes.forEach { route ->
                val customers = routed.filter { it.routeId == route.id }
                if (customers.isNotEmpty()) {
                    item(key = "route-${route.id}") { Text(route.name, fontWeight = FontWeight.Bold, color = Green, modifier = Modifier.padding(top = 6.dp)) }
                    items(customers, key = { "customer-${it.id}" }) { customer ->
                        Surface(onClick = { vm.customer(customer) }, shape = RoundedCornerShape(9.dp), border = BorderStroke(1.dp, Rule), color = Color.White) {
                            Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                                Column(Modifier.weight(1f)) {
                                    Text(customer.name, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Ink, maxLines = 2, overflow = TextOverflow.Ellipsis)
                                    Text("${customer.code} · ${customer.currency}", fontSize = 12.sp, color = Muted)
                                }
                                Icon(Icons.Outlined.ChevronRight, null, tint = Muted)
                            }
                        }
                    }
                }
            }
            if (routes.isNotEmpty() && routed.none { customer -> routes.any { it.id == customer.routeId } }) {
                item { Text("Bu seçimde cari bulunamadı.", color = Muted) }
            }
        }
    }
}
@Composable private fun SettingsRow(title: String, subtitle: String, icon: ImageVector, click: () -> Unit) {
    Surface(onClick = click, color = Color.White, modifier = Modifier.fillMaxWidth().height(79.dp)) {
        Row(Modifier.padding(horizontal = 15.dp), verticalAlignment = Alignment.CenterVertically) {
            IconDisc(icon, size = 50)
            Column(Modifier.weight(1f).padding(start = 13.dp)) {
                Text(title, fontSize = 17.sp, fontWeight = FontWeight.Bold, color = Ink)
                Text(subtitle, fontSize = 13.sp, color = Muted)
            }
            Icon(Icons.Outlined.ChevronRight, null, tint = Ink, modifier = Modifier.size(22.dp))
        }
    }
    HorizontalDivider(color = Rule)
}
@Composable internal fun SettingsHub(ui: TerminalUi, vm: TerminalViewModel) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
        PageHeader("Ayarlar", vm::back)
        Text("GENEL", color = Muted, fontSize = 12.sp, lineHeight = 16.sp, modifier = Modifier.padding(start = 15.dp, top = 17.dp, bottom = 11.dp))
        HorizontalDivider(color = Rule)
        SettingsRow("Kur Ayarları", "Para birimleri ve kurlar", Icons.Outlined.CurrencyExchange) { vm.navigate(Screen.RATES) }
        SettingsRow("Yazıcı ve Fiş Ayarları", "Yazdırma tercihleri", Icons.Outlined.Print) { vm.navigate(Screen.PRINT_SETTINGS) }
        SettingsRow("Ses ve Titreşim", "Tarama bildirimleri", Icons.Outlined.VolumeUp) { vm.navigate(Screen.SOUND_SETTINGS) }
        Text("BAĞLANTI", color = Muted, fontSize = 12.sp, lineHeight = 16.sp, modifier = Modifier.padding(start = 15.dp, top = 23.dp, bottom = 11.dp))
        HorizontalDivider(color = Rule)
        SettingsRow("Bağlantı Ayarları", "Sunucu ve terminal bağlantısı", Icons.Outlined.Link) { vm.navigate(Screen.CONNECTION) }
        Spacer(Modifier.height(26.dp))
        HorizontalDivider(color = Rule)
        Surface(onClick = { vm.logout() }, color = Color.White, modifier = Modifier.fillMaxWidth().height(62.dp)) {
            Row(Modifier.padding(horizontal = 20.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.Logout, null, tint = Color(0xFFD71930))
                Text("Çıkış yap", color = Color(0xFFD71930), fontWeight = FontWeight.Medium, fontSize = 17.sp, modifier = Modifier.weight(1f).padding(start = 18.dp))
                Icon(Icons.Outlined.ChevronRight, null, tint = Ink)
            }
        }
        HorizontalDivider(color = Rule)
    }
}
@Composable private fun WorkflowStatus(ui: TerminalUi, retry: () -> Unit) {
    if (ui.loadingWorkflow) LinearProgressIndicator(Modifier.fillMaxWidth())
    ui.workflowError?.let { message ->
        Text(message, color = MaterialTheme.colorScheme.error, fontSize = 13.sp, modifier = Modifier.padding(vertical = 8.dp))
        TextButton(onClick = retry) { Text("Yeniden dene") }
    }
}
@Composable internal fun RatesScreen(ui: TerminalUi, vm: TerminalViewModel) {
    Column(Modifier.fillMaxSize()) {
        PageHeader("Kur Ayarları", vm::back)
        Column(Modifier.verticalScroll(rememberScrollState()).padding(16.dp)) {
            WorkflowStatus(ui, vm::loadOptions)
            val options = ui.options
            var usd by remember(options) { mutableStateOf(options?.rates?.find { it.currency == "USD" }?.rateToTry.orEmpty()) }
            var eur by remember(options) { mutableStateOf(options?.rates?.find { it.currency == "EUR" }?.rateToTry.orEmpty()) }
            Text("ERP döviz kurları", fontWeight = FontWeight.Bold, fontSize = 20.sp, color = Ink)
            Text("1 birim dövizin TL karşılığı", fontSize = 14.sp, color = Muted, modifier = Modifier.padding(bottom = 16.dp))
            if (options != null) {
                for (currency in listOf("USD", "EUR")) {
                    val rate = options.rates.find { it.currency == currency }
                    OutlinedTextField(if (currency == "USD") usd else eur, { if (currency == "USD") usd = it else eur = it },
                        label = { Text(if (currency == "USD") "Dolar · USD" else "Euro · EUR") }, suffix = { Text("TL") },
                        readOnly = !options.canEditRates, enabled = !ui.loadingWorkflow, singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), modifier = Modifier.fillMaxWidth())
                    Text(if (rate?.defined == true) "Kayıt tarihi: " + rate.rateDate else "ERP'de kur tanımlı değil", color = Muted, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp, bottom = 12.dp))
                }
                Text("Türk lirası · 1 TL = 1 TL", fontSize = 14.sp)
                Text("Kur değişikliği yeni fiyat sorgularına uygulanır. Fişe eklenmiş satırların fiyatı korunur.", fontSize = 13.sp, color = Muted, modifier = Modifier.padding(vertical = 15.dp))
                if (options.canEditRates) {
                    val valid = listOf(usd, eur).all { runCatching { decimal(it) > java.math.BigDecimal.ZERO && decimal(it).scale() <= 8 }.getOrDefault(false) }
                    Button(onClick = { vm.saveRates(usd, eur) }, enabled = valid && !ui.loadingWorkflow, modifier = Modifier.fillMaxWidth()) { Text("Kurları kaydet") }
                } else Text("Kur değiştirme yetkisi olan personel kurları düzenleyebilir.", fontSize = 13.sp, color = Muted)
            }
            OutlinedButton(onClick = vm::loadOptions, enabled = !ui.loadingWorkflow, modifier = Modifier.fillMaxWidth()) { Icon(Icons.Outlined.Refresh, null); Spacer(Modifier.width(8.dp)); Text("ERP'den yenile") }
        }
    }
}
@Composable internal fun PrintSettingsScreen(ui: TerminalUi, vm: TerminalViewModel) {
    Column(Modifier.fillMaxSize()) {
        PageHeader("Yazıcı ve Fiş Ayarları", vm::back)
        Column(Modifier.padding(16.dp)) {
            WorkflowStatus(ui, vm::loadOptions)
            Text("A4 satış fişi", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Ink)
            Text("Yazıcı", color = Muted, modifier = Modifier.padding(top = 18.dp))
            Text(ui.options?.printerName?.takeIf { it.isNotBlank() } ?: "Yazıcı bilgisi alınamadı", fontSize = 15.sp, modifier = Modifier.padding(vertical = 8.dp))
            Text("Yazıcı ERP sunucusunda tanımlanır.", fontSize = 13.sp, color = Muted)
            HorizontalDivider(Modifier.padding(vertical = 15.dp), color = Rule)
            PreferenceSwitch("Satış sonrası yazdırma sorusu", "Satış tamamlandığında fiş basılsın mı diye sor.", ui.preferences.askToPrint) { vm.preferences(ui.preferences.copy(askToPrint = it)) }
            Text("Tamamlanan fişin Yazdır düğmesi her zaman kullanılabilir.", fontSize = 13.sp, color = Muted, modifier = Modifier.padding(top = 15.dp))
        }
    }
}
@Composable private fun PreferenceSwitch(title: String, description: String, checked: Boolean, change: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f).padding(end = 8.dp)) {
            Text(title, fontSize = 16.sp, fontWeight = FontWeight.Medium, color = Ink)
            Text(description, fontSize = 13.sp, color = Muted)
        }
        Switch(checked, change)
    }
}
@Composable internal fun SoundSettingsScreen(ui: TerminalUi, vm: TerminalViewModel) {
    Column(Modifier.fillMaxSize()) {
        PageHeader("Ses ve Titreşim", vm::back)
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
            PreferenceSwitch("Tarama sesi", "Barkod ulaştığında kısa bip çal.", ui.preferences.sound) { vm.preferences(ui.preferences.copy(sound = it)) }
            PreferenceSwitch("Titreşim", "Barkod ulaştığında hafif titreşim ver.", ui.preferences.vibration) { vm.preferences(ui.preferences.copy(vibration = it)) }
            HorizontalDivider(color = Rule)
            Text(ui.scanner, fontSize = 13.sp, color = Muted)
        }
    }
}
