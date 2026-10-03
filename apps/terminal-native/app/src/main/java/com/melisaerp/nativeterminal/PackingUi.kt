package com.melisaerp.nativeterminal

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.melisaerp.nativeterminal.model.*
import java.math.BigDecimal

private val PackingAmber = Color(0xFF996100)
private fun quantityText(value: BigDecimal) = value.stripTrailingZeros().toPlainString()

@Composable private fun PackingStatus(ui: TerminalUi, retry: () -> Unit) {
    if (ui.loadingWorkflow) LinearProgressIndicator(Modifier.fillMaxWidth().padding(vertical = 4.dp))
    ui.workflowError?.let { error ->
        Text(error, color = MaterialTheme.colorScheme.error, fontSize = 13.sp, lineHeight = 17.sp)
        TextButton(onClick = retry, enabled = !ui.loadingWorkflow) { Text("Yeniden dene") }
    }
}

@Composable internal fun OrdersScreen(ui: TerminalUi, vm: TerminalViewModel) {
    Column(Modifier.fillMaxSize()) {
        PageHeader("Sipariş Toplama", vm::back)
        Column(Modifier.padding(horizontal = 12.dp)) {
            Text("Paketleme yardımcısı", fontWeight = FontWeight.Bold, fontSize = 18.sp, lineHeight = 22.sp, modifier = Modifier.padding(top = 10.dp))
            Text("İsterseniz bir fiş seçip ürünleri kontrol edin.", color = Muted, fontSize = 12.sp, lineHeight = 16.sp)
            OutlinedTextField(ui.orderQuery, vm::findOrders, label = { Text("Fiş no veya müşteri") }, singleLine = true, modifier = Modifier.fillMaxWidth().padding(top = 6.dp))
            PackingStatus(ui, { vm.findOrders(ui.orderQuery, immediate = true) })
            Text("Tamamlanan fişler", fontWeight = FontWeight.Medium, fontSize = 14.sp, lineHeight = 18.sp, modifier = Modifier.padding(vertical = 10.dp))
        }
        LazyColumn(Modifier.weight(1f).padding(horizontal = 12.dp)) {
            if (!ui.loadingWorkflow && ui.workflowError == null && ui.orders.isEmpty()) item {
                Text("Tamamlanan fiş bulunamadı.", color = Muted, fontSize = 14.sp)
            }
            items(ui.orders, key = { it.id }) { receipt ->
                Row(Modifier.fillMaxWidth().clickable(enabled = !ui.loadingWorkflow) { vm.openOrder(receipt.id) }.padding(vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(receipt.documentNo, fontWeight = FontWeight.Bold, fontSize = 14.sp, lineHeight = 18.sp, color = Ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(receipt.customerName, fontSize = 13.sp, lineHeight = 17.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(receipt.documentDate + " · " + receipt.itemCount + " çeşit", fontSize = 11.sp, lineHeight = 15.sp, color = Muted)
                        ui.packingMarks[receipt.id]?.let { mark ->
                            Text(mark, color = if (mark == "Paketlendi") Green else PackingAmber, fontSize = 12.sp, lineHeight = 16.sp, fontWeight = FontWeight.Medium)
                        }
                    }
                    Icon(Icons.Outlined.ChevronRight, null, tint = Muted)
                }
                HorizontalDivider(color = Rule)
            }
            if (ui.ordersHasMore) item {
                TextButton(onClick = vm::moreOrders, enabled = !ui.loadingWorkflow, modifier = Modifier.fillMaxWidth()) { Text("Diğer fişleri getir") }
            }
        }
        HorizontalDivider(color = Rule)
        Column(Modifier.padding(horizontal = 12.dp, vertical = 4.dp)) {
            Text("Sayım bu terminalde; tamamlamalar ERP audit kaydında tutulur.", fontSize = 11.sp, lineHeight = 15.sp, color = Muted)
            TextButton(onClick = { vm.findOrders(ui.orderQuery, immediate = true) }, enabled = !ui.loadingWorkflow, modifier = Modifier.fillMaxWidth()) {
                Icon(Icons.Outlined.Refresh, null, Modifier.size(20.dp)); Spacer(Modifier.width(6.dp)); Text("Listeyi yenile")
            }
        }
    }
}

@Composable internal fun PickingScreen(ui: TerminalUi, vm: TerminalViewModel, scan: () -> Unit) {
    val progress = ui.picking
    var manual by remember(progress?.order?.id) { mutableStateOf("") }
    var edit by remember(progress?.order?.id) { mutableStateOf<PickingItem?>(null) }
    var confirmDifference by remember { mutableStateOf<PickingProgress?>(null) }
    var confirmReset by remember { mutableStateOf<PickingProgress?>(null) }
    Column(Modifier.fillMaxSize()) {
        PageHeader("Paketleme", vm::back)
        Column(Modifier.padding(horizontal = 12.dp)) {
            PackingStatus(ui, { progress?.order?.id?.let(vm::openOrder) })
            if (progress != null) {
                Text(progress.order.documentNo, fontSize = 16.sp, lineHeight = 20.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 8.dp))
                Text(progress.order.customerName, fontSize = 12.sp, lineHeight = 16.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    OutlinedTextField(manual, { manual = it }, label = { Text("Barkod / ürün kodu", fontSize = 12.sp) }, singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number, autoCorrectEnabled = false), modifier = Modifier.weight(1f))
                    IconButton(onClick = scan, enabled = !ui.loadingWorkflow) { Icon(Icons.Outlined.QrCodeScanner, "Barkod tara") }
                }
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    TextButton(onClick = { vm.pickBarcode(manual); manual = "" }, enabled = manual.isNotBlank() && !ui.loadingWorkflow) { Text("Ürünü say") }
                    Spacer(Modifier.weight(1f))
                    Text("${progress.completedLines} / ${progress.order.items.size} satır", color = Muted, fontSize = 12.sp)
                }
                Text("Sayılan / Fişteki adet", fontSize = 11.sp, lineHeight = 15.sp, color = Muted)
            }
        }
        LazyColumn(Modifier.weight(1f).padding(horizontal = 12.dp)) {
            items(progress?.order?.items.orEmpty(), key = { it.id }) { item ->
                val done = progress?.count(item.id) ?: BigDecimal.ZERO
                val expected = item.quantity.toBigDecimal()
                val exact = done.compareTo(expected) == 0
                val excess = done > expected
                Row(Modifier.fillMaxWidth().background(if (exact) Mint else Color.Transparent), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f).clickable(enabled = !ui.loadingWorkflow) { edit = item }.padding(vertical = 9.dp)) {
                        Text(item.stockCode, fontSize = 14.sp, lineHeight = 18.sp, fontWeight = FontWeight.Bold)
                        Text(item.productName, fontSize = 11.sp, lineHeight = 15.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                    TextButton(onClick = { edit = item }, enabled = !ui.loadingWorkflow, contentPadding = PaddingValues(horizontal = 5.dp)) {
                        Text(quantityText(done) + " / " + quantityText(expected), color = if (excess) PackingAmber else if (exact) Green else Ink, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    }
                    IconButton(onClick = { vm.pickQuantity(item.id, if (exact) "0" else item.quantity) }, enabled = !ui.loadingWorkflow) {
                        Icon(if (exact) Icons.Outlined.CheckBox else Icons.Outlined.CheckBoxOutlineBlank, if (exact) "Satır sayımını kaldır" else "Satırın tamamını say", tint = if (exact) Green else Muted)
                    }
                }
                HorizontalDivider(color = Rule)
            }
        }
        if (progress != null) Column(Modifier.padding(horizontal = 12.dp, vertical = 8.dp)) {
            if (progress.hasDifferences && progress.totalCountedQuantity.signum() > 0) {
                Text("${quantityText(progress.totalMissingQuantity)} eksik · ${quantityText(progress.totalExtraQuantity)} fazla", color = PackingAmber, fontSize = 12.sp, lineHeight = 16.sp)
            }
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                val normal = progress.packingStatus == "PACKED"
                Text(when (progress.packingStatus) { "PACKED" -> "Bu terminalde paketlendi"; "PACKING_EXCEPTION" -> "PACKING_EXCEPTION · Adet farkı var"; "REVIEW_REQUIRED" -> "Adet farkı var · Yeniden kontrol gerekli"; else -> "İsteğe bağlı yerel kontrol" }, color = if (normal) Green else if (progress.confirmedAt != null) PackingAmber else Muted, fontSize = 12.sp, lineHeight = 16.sp, modifier = Modifier.weight(1f))
                TextButton(onClick = { confirmReset = progress }, enabled = !ui.loadingWorkflow && (progress.counts.isNotEmpty() || progress.confirmedAt != null), contentPadding = PaddingValues(horizontal = 3.dp)) { Text("Sıfırla", fontSize = 12.sp) }
            }
            if (progress.confirmedAt != null) {
                OutlinedButton(onClick = vm::uncheckPicking, enabled = !ui.loadingWorkflow, modifier = Modifier.fillMaxWidth()) { Text(if (progress.packingStatus == "PACKED") "Paketlendi işaretini kaldır" else "Yerel işareti kaldır") }
            } else {
                Button(onClick = { if (progress.hasDifferences) confirmDifference = progress else vm.checkPicking(progress) }, enabled = !ui.loadingWorkflow, modifier = Modifier.fillMaxWidth()) { Text("Paketlendi olarak işaretle") }
            }
        }
    }
    edit?.let { item ->
        var qty by remember(item.id) { mutableStateOf(progress?.count(item.id)?.let(::quantityText).orEmpty()) }
        val value = runCatching { decimal(qty) }.getOrNull()
        val valid = value != null && value.signum() >= 0 && value.scale() <= 3 && value <= BigDecimal("999999999.999")
        AlertDialog(onDismissRequest = { edit = null }, title = { Text(item.stockCode, fontSize = 19.sp) }, text = {
            Column {
                Text("Fişte ${item.quantity} adet", fontSize = 13.sp, color = Muted)
                OutlinedTextField(qty, { qty = it }, label = { Text("Sayılan adet") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal))
                if (value != null && value > item.quantity.toBigDecimal()) Text("Fiştekinden fazla; kontrol için kaydedilebilir.", color = PackingAmber, fontSize = 12.sp)
            }
        }, confirmButton = { Button(onClick = { vm.pickQuantity(item.id, qty); edit = null }, enabled = valid) { Text("Kaydet") } },
            dismissButton = { TextButton(onClick = { edit = null }) { Text("Vazgeç") } })
    }
    confirmDifference?.let { snapshot ->
        var reason by remember(snapshot) { mutableStateOf("") }
        AlertDialog(onDismissRequest = { confirmDifference = null }, title = { Text("Adetler fişle farklı", fontSize = 20.sp) }, text = {
            Column {
                Text("${quantityText(snapshot.totalMissingQuantity)} eksik · ${quantityText(snapshot.totalExtraQuantity)} fazla. Normal tamamlanamaz. Yetkili kullanıcı PACKING_EXCEPTION kaydedebilir.")
                OutlinedTextField(reason, { reason = it }, label = { Text("İstisna gerekçesi (zorunlu)") }, modifier = Modifier.fillMaxWidth())
            }
        }, confirmButton = { Button(onClick = { vm.checkPicking(snapshot, exceptionReason = reason); confirmDifference = null }, enabled = reason.isNotBlank() && reason.trim().length <= 500) { Text("İstisna kaydet") } },
            dismissButton = { TextButton(onClick = { confirmDifference = null }) { Text("Geri dön") } })
    }
    confirmReset?.let { snapshot ->
        AlertDialog(onDismissRequest = { confirmReset = null }, title = { Text("Yerel sayım sıfırlansın mı?", fontSize = 19.sp) }, text = { Text("Fişin ürünleri değişmez. Bu terminaldeki sayım ve paketlendi işareti temizlenir.") },
            confirmButton = { Button(onClick = { vm.resetPicking(snapshot); confirmReset = null }) { Text("Sıfırla") } },
            dismissButton = { TextButton(onClick = { confirmReset = null }) { Text("Vazgeç") } })
    }
}
