package com.melisaerp.nativeterminal

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.melisaerp.nativeterminal.model.*

data class CategoryReportUi(val draft: Draft, val report: CategoryReport? = null,
    val loading: Boolean = true, val fromCache: Boolean = false, val error: String? = null)

@Composable internal fun CategoryReportDialog(state: CategoryReportUi, close: () -> Unit, retry: () -> Unit, returnLabel: String = "Satırlara dön") {
    Dialog(onDismissRequest = close, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(Modifier.fillMaxSize().systemBarsPadding(), color = Paper) {
            Column(Modifier.fillMaxSize().padding(12.dp)) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text("Kategori Raporu", fontWeight = FontWeight.Bold, fontSize = 18.sp, modifier = Modifier.weight(1f))
                    TextButton(onClick = close) { Text(returnLabel, fontSize = 12.sp) }
                }
                Text(receiptTitle(state.draft), fontSize = 12.sp, color = Muted)
                if (state.loading) LinearProgressIndicator(Modifier.fillMaxWidth().padding(vertical = 12.dp))
                state.error?.let {
                    Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(vertical = 12.dp))
                    OutlinedButton(onClick = retry) { Text("Tekrar dene") }
                }
                state.report?.let { report ->
                    if (state.fromCache) Text("Cihazdaki son bilgiler · Bağlanınca yeniden açın", fontSize = 12.sp, color = Muted, modifier = Modifier.padding(vertical = 6.dp))
                    CategoryReportContent(report, Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable internal fun CategoryReportContent(report: CategoryReport, modifier: Modifier = Modifier) {
    val groups = remember(report) { report.groups() }
    var expanded by remember(report) { mutableStateOf<Int?>(null) }
    Column(modifier) {
        Text("${report.items.size} satır / ${groups.sumOf { it.quantity }.stripTrailingZeros().toPlainString()} adet",
            fontSize = 12.sp, color = Muted, modifier = Modifier.padding(vertical = 8.dp))
        LazyColumn(Modifier.weight(1f).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp), contentPadding = PaddingValues(bottom = 12.dp)) {
            if (groups.isEmpty()) item { Text("Fişte ürün bulunmuyor.") }
            itemsIndexed(groups) { index, group ->
                Surface(shape = RoundedCornerShape(7.dp), color = Mint) {
                    Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min).clickable { expanded = if (expanded == index) null else index }) {
                        Spacer(Modifier.width(4.dp).fillMaxHeight().background(Green))
                        Column(Modifier.weight(1f).padding(10.dp)) {
                            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                Text(group.category, fontWeight = FontWeight.Bold, fontSize = 14.sp, modifier = Modifier.weight(1f).padding(end = 6.dp))
                                Text(money(group.totalAmount, report.currency), color = Color(0xFFCA2626), fontWeight = FontWeight.Bold, fontSize = 13.sp)
                            }
                            Text("${group.lineCount} satır / ${group.quantity.stripTrailingZeros().toPlainString()} adet / Ort. ${money(group.averagePrice, report.currency)}",
                                fontSize = 11.sp, color = Muted, modifier = Modifier.padding(top = 4.dp))
                        }
                    }
                }
                if (expanded == index) Column(Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 6.dp)) {
                    group.items.forEach { line ->
                        Text("${line.stockCode} · ${line.productName}", fontSize = 12.sp, fontWeight = FontWeight.Medium)
                        Text("${line.quantity.toBigDecimal().stripTrailingZeros().toPlainString()} × ${money(line.unitPrice, report.currency)}", fontSize = 12.sp, color = Muted)
                        HorizontalDivider(Modifier.padding(vertical = 6.dp))
                    }
                }
            }
        }
        HorizontalDivider()
        Row(Modifier.fillMaxWidth().padding(vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("Ara toplam", fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
            Text(money(groups.sumOf { it.totalAmount }, report.currency), fontWeight = FontWeight.Bold)
        }
        if (report.discountRate.toBigDecimal().signum() > 0) Text("Fiş indirimi %${report.discountRate}. Kategori tutarları indirim öncesidir.", fontSize = 12.sp, color = Muted)
    }
}
