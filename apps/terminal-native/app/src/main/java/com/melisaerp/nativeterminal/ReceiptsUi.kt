package com.melisaerp.nativeterminal

import android.app.DatePickerDialog
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.melisaerp.nativeterminal.model.*
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

private val ReceiptRed = Color(0xFFD92335)
private val ReceiptAmber = Color(0xFF996100)
private val Turkish = Locale.forLanguageTag("tr-TR")

internal fun receiptTitle(draft: Draft): String = draft.receipt?.documentNumber?.takeIf { it.isNotBlank() }
    ?: "Fiş " + draft.id.substringBefore('-').uppercase(Locale.ROOT)
private fun receiptAmount(draft: Draft): String = draft.receipt?.let { money(it.grandTotal, it.currency) }
    ?: money(draft.total, draft.customer.currency)
private fun receiptDay(draft: Draft): LocalDate = draft.receipt?.documentDate?.take(10)?.let {
    runCatching { LocalDate.parse(it) }.getOrNull()
} ?: Instant.ofEpochMilli(draft.updatedAt).atZone(ZoneId.systemDefault()).toLocalDate()
private fun receiptTime(draft: Draft): String = Instant.ofEpochMilli(draft.updatedAt)
    .atZone(ZoneId.systemDefault()).format(DateTimeFormatter.ofPattern("dd MMM, HH:mm", Turkish))

@Composable internal fun ReceiptsScreen(ui: TerminalUi, vm: TerminalViewModel) {
    var sentDate by rememberSaveable { mutableStateOf<String?>(LocalDate.now().toString()) }
    var selectedId by remember(ui.receiptGroup, sentDate) { mutableStateOf<String?>(null) }
    var showReview by remember { mutableStateOf(false) }
    var pendingDelete by remember { mutableStateOf<Draft?>(null) }
    var noteId by remember { mutableStateOf<String?>(null) }
    var holdId by remember { mutableStateOf<String?>(null) }
    val reviews = ui.drafts.filter { it.receiptGroup == ReceiptGroup.REVIEW }
    val waiting = ui.drafts.filter { it.receiptGroup == ReceiptGroup.WAITING }
    val drafts = ui.drafts.filter { it.receiptGroup == ReceiptGroup.DRAFTS }
    val sent = ui.drafts.filter { it.receiptGroup == ReceiptGroup.SENT }
    val visibleSent = sent.filter { sentDate == null || receiptDay(it).toString() == sentDate }
    val visible = when (ui.receiptGroup) {
        ReceiptGroup.WAITING -> waiting
        ReceiptGroup.DRAFTS -> drafts
        ReceiptGroup.SENT -> visibleSent
        ReceiptGroup.REVIEW -> emptyList()
    }
    val selected = visible.find { it.id == selectedId } ?: visible.firstOrNull()
    val listState = rememberLazyListState()
    LaunchedEffect(ui.receiptGroup, sentDate) { listState.scrollToItem(0) }
    Column(Modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().height(58.dp).padding(horizontal = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = vm::back, enabled = !ui.busy) { Icon(Icons.Outlined.ArrowBack, "Geri", tint = Green) }
            Text("Fişler", modifier = Modifier.weight(1f).padding(start = 4.dp), fontSize = 24.sp, fontWeight = FontWeight.Bold, color = Ink)
            TextButton(onClick = vm::newSale, enabled = !ui.busy, contentPadding = PaddingValues(horizontal = 8.dp)) {
                Icon(Icons.Outlined.Add, null, Modifier.size(24.dp)); Spacer(Modifier.width(2.dp)); Text("Yeni", fontSize = 15.sp)
            }
        }
        if (reviews.isNotEmpty()) {
            Surface(color = Color(0xFFFFF3D8), modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp), shape = RoundedCornerShape(7.dp)) {
                Row(Modifier.clickable(enabled = !ui.busy) { showReview = !showReview }.padding(horizontal = 9.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.ErrorOutline, null, tint = ReceiptAmber, modifier = Modifier.size(20.dp))
                    Text("Sonucu kontrol edilmeli (${reviews.size})", fontSize = 12.sp, fontWeight = FontWeight.Medium, color = ReceiptAmber, modifier = Modifier.weight(1f).padding(horizontal = 6.dp))
                    Icon(if (showReview) Icons.Outlined.ExpandLess else Icons.Outlined.ExpandMore, if (showReview) "Uyarıları kapat" else "Uyarıları aç", tint = ReceiptAmber)
                }
            }
        }
        ReceiptTabs(ui.receiptGroup, waiting.size, drafts.size, sent.size, !ui.busy, vm::selectReceiptGroup)
        Row(Modifier.fillMaxWidth().padding(horizontal = 13.dp).heightIn(min = 39.dp), verticalAlignment = Alignment.CenterVertically) {
            if (ui.receiptGroup != ReceiptGroup.SENT) {
                Text(if (ui.receiptGroup == ReceiptGroup.WAITING) "Ürün gelmesini bekleyen fişler" else "Hazırlamakta olduğunuz fişler", color = Muted, fontSize = 13.sp, modifier = Modifier.padding(vertical = 10.dp))
            } else {
                SentDateFilter(sentDate, !ui.busy) { sentDate = it }
            }
        }
        if (ui.busy) LinearProgressIndicator(Modifier.fillMaxWidth().height(2.dp))
        LazyColumn(Modifier.weight(1f).fillMaxWidth().padding(horizontal = 12.dp), state = listState, contentPadding = PaddingValues(bottom = 12.dp)) {
            if (showReview) {
                items(reviews, key = { "review-${it.id}" }) { draft ->
                    ReviewReceiptRow(draft, !ui.busy) { vm.openDraft(draft) }
                }
            }
            if (visible.isEmpty()) item {
                ReceiptEmpty(ui.receiptGroup, sentDate, sent.isNotEmpty(), vm::newSale, { sentDate = null }, !ui.busy)
            }
            items(visible, key = { it.id }) { draft ->
                ReceiptRow(draft, draft.id == selected?.id, !ui.busy,
                    select = { selectedId = draft.id },
                    editNote = { noteId = draft.id },
                    hold = { holdId = draft.id },
                    delete = { pendingDelete = draft })
            }
        }
        HorizontalDivider(color = Rule)
        Column(Modifier.fillMaxWidth().background(Color.White).padding(horizontal = 12.dp, vertical = 9.dp)) {
            Text(selected?.let { "Seçili: ${receiptTitle(it)}" } ?: "Bir fiş seçin", color = Muted, fontSize = 12.sp, modifier = Modifier.padding(bottom = 6.dp))
            if (ui.receiptGroup == ReceiptGroup.SENT && selected?.canSharePdf == true) {
                OutlinedButton(onClick = { selected?.let(vm::showPdfShare) }, enabled = !ui.busy,
                    modifier = Modifier.fillMaxWidth().height(45.dp).padding(bottom = 3.dp), shape = RoundedCornerShape(24.dp)) {
                    Icon(Icons.Outlined.QrCode, null, Modifier.size(21.dp)); Spacer(Modifier.width(8.dp))
                    Text("PDF paylaş", fontSize = 15.sp, fontWeight = FontWeight.Bold)
                }
                Spacer(Modifier.height(5.dp))
            }
            if (selected?.lines?.isNotEmpty() == true) OutlinedButton(onClick = { selected?.let(vm::showCategoryReport) }, enabled = !ui.busy, modifier = Modifier.fillMaxWidth()) { Text("Kategori Raporu") }
            Button(onClick = { selected?.let(vm::openDraft) }, enabled = selected != null && !ui.busy,
                modifier = Modifier.fillMaxWidth().height(46.dp), shape = RoundedCornerShape(24.dp), contentPadding = PaddingValues(horizontal = 16.dp)) {
                Text(if (ui.receiptGroup == ReceiptGroup.SENT) "Fişi görüntüle" else "Fişe devam et", modifier = Modifier.weight(1f), textAlign = TextAlign.Center, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                Icon(Icons.Outlined.ArrowForward, null, Modifier.size(23.dp))
            }
        }
    }
    pendingDelete?.let { target ->
        DeleteReceiptDialog(target, ui.busy, { pendingDelete = null }) { vm.deleteDraft(target); pendingDelete = null }
    }
    noteId?.let { id ->
        val target = ui.drafts.find { it.id == id }
        if (target != null && target.canDeleteLocally && target.onHold) {
            HoldNoteDialog("Bekleme notu", target.holdNote, ui.busy, { noteId = null }, "Kaydet") { note -> vm.updateHoldNote(target, note); noteId = null }
        }
    }
    holdId?.let { id ->
        val target = ui.drafts.find { it.id == id }
        if (target != null && target.canDeleteLocally && target.lines.isNotEmpty()) {
            HoldNoteDialog("Beklemeye al", target.holdNote, ui.busy, { holdId = null }) { note -> vm.holdListedDraft(target, note); holdId = null }
        }
    }
}

@Composable private fun ReceiptTabs(group: ReceiptGroup, waiting: Int, drafts: Int, sent: Int, enabled: Boolean, select: (ReceiptGroup) -> Unit) {
    val groups = listOf(Triple(ReceiptGroup.WAITING, "Bekleyenler", waiting), Triple(ReceiptGroup.DRAFTS, "Taslaklar", drafts), Triple(ReceiptGroup.SENT, "Gönderilenler", sent))
    Surface(shape = RoundedCornerShape(10.dp), color = Color.White, border = BorderStroke(1.dp, Rule), modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp)) {
        Row(Modifier.height(48.dp)) {
            groups.forEachIndexed { index, (value, title, count) ->
                if (index > 0) VerticalDivider(color = Rule)
                Column(Modifier.weight(1f).fillMaxHeight().background(if (value == group) Mint else Color.Transparent)
                    .clickable(enabled = enabled) { select(value) }.padding(vertical = 7.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                    Text(title, color = if (value == group) Green else Ink, fontSize = 13.sp, lineHeight = 16.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                    Text(count.toString(), color = if (value == group) Green else Muted, fontSize = 13.sp, lineHeight = 16.sp, fontWeight = if (value == group) FontWeight.Bold else FontWeight.Normal)
                }
            }
        }
    }
}

@Composable private fun RowScope.SentDateFilter(date: String?, enabled: Boolean, change: (String?) -> Unit) {
    val context = LocalContext.current
    val selectedDate = date?.let(LocalDate::parse) ?: LocalDate.now()
    val label = when (date) { null -> "Tüm tarihler"; LocalDate.now().toString() -> "Bugün"; else -> selectedDate.format(DateTimeFormatter.ofPattern("dd.MM.yyyy")) }
    Text(label, color = Muted, fontSize = 12.sp, modifier = Modifier.weight(1f))
    TextButton(onClick = {
        DatePickerDialog(context, { _, year, month, day -> change(LocalDate.of(year, month + 1, day).toString()) }, selectedDate.year, selectedDate.monthValue - 1, selectedDate.dayOfMonth).show()
    }, enabled = enabled, contentPadding = PaddingValues(horizontal = 6.dp)) {
        Icon(Icons.Outlined.CalendarMonth, null, Modifier.size(17.dp)); Spacer(Modifier.width(3.dp)); Text("Tarih", fontSize = 12.sp)
    }
    TextButton(onClick = { change(if (date == null) LocalDate.now().toString() else null) }, enabled = enabled, contentPadding = PaddingValues(horizontal = 6.dp)) {
        Text(if (date == null) "Bugün" else "Tümü", fontSize = 12.sp)
    }
}

@Composable private fun ReceiptRow(draft: Draft, selected: Boolean, enabled: Boolean, select: () -> Unit, editNote: () -> Unit, hold: () -> Unit, delete: () -> Unit) {
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(7.dp)).background(if (selected) Mint else Color.Transparent)) {
        Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min)) {
            if (selected) Spacer(Modifier.width(4.dp).fillMaxHeight().background(Green))
            Column(Modifier.weight(1f)) {
                Row(Modifier.fillMaxWidth().clickable(enabled = enabled, onClick = select).padding(start = if (selected) 10.dp else 14.dp, end = 10.dp, top = 10.dp, bottom = 8.dp), verticalAlignment = Alignment.Top) {
                    Icon(if (selected) Icons.Outlined.CheckCircle else Icons.Outlined.RadioButtonUnchecked, if (selected) "Seçili" else "Fişi seç", tint = if (selected) Green else Color(0xFF939AA3), modifier = Modifier.padding(top = 3.dp, end = 10.dp).size(24.dp))
                    Column(Modifier.weight(1f)) {
                        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                            Text(draft.customer.code, color = Ink, fontSize = 16.sp, lineHeight = 19.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f).padding(end = 7.dp))
                            Text(receiptAmount(draft), color = Ink, fontSize = 16.sp, lineHeight = 19.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                        }
                        Text("${receiptTitle(draft)} · ${receiptTime(draft)}", color = Muted, fontSize = 11.sp, lineHeight = 14.sp, maxLines = 2, modifier = Modifier.padding(top = 3.dp))
                        Text("${draft.lines.size} çeşit · ${draft.quantity} adet", color = Muted, fontSize = 12.sp, lineHeight = 15.sp)
                        if (draft.state == DraftState.CANCELLED) Text("İptal edilmiş fiş", color = ReceiptRed, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
                        if (!selected && draft.onHold && draft.holdNote.isNotBlank()) Text(draft.holdNote, color = Ink, fontSize = 12.sp, lineHeight = 15.sp, maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 7.dp))
                    }
                }
                if (selected && draft.canDeleteLocally) {
                    HorizontalDivider(Modifier.padding(horizontal = 12.dp), color = Rule)
                    if (draft.onHold) {
                        Row(Modifier.padding(start = 13.dp, end = 12.dp, top = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Outlined.Schedule, null, tint = ReceiptAmber, modifier = Modifier.size(19.dp))
                            Text("Ürün bekleniyor", color = ReceiptAmber, fontSize = 13.sp, lineHeight = 16.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(start = 7.dp))
                        }
                        Text(draft.holdNote.ifBlank { "Bekleme notu eklenmedi." }, color = if (draft.holdNote.isBlank()) Muted else Ink, fontSize = 12.sp, lineHeight = 15.sp, maxLines = 3, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(start = 39.dp, end = 12.dp, top = 4.dp))
                    }
                    Row(Modifier.fillMaxWidth().padding(horizontal = 9.dp, vertical = 3.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                        if (draft.onHold) TextButton(onClick = editNote, enabled = enabled, contentPadding = PaddingValues(horizontal = 4.dp)) {
                            Icon(Icons.Outlined.Edit, null, Modifier.size(18.dp)); Spacer(Modifier.width(5.dp)); Text("Notu düzenle", fontSize = 12.sp)
                        } else TextButton(onClick = hold, enabled = enabled && draft.lines.isNotEmpty(), contentPadding = PaddingValues(horizontal = 4.dp)) {
                            Icon(Icons.Outlined.Schedule, null, Modifier.size(18.dp)); Spacer(Modifier.width(5.dp)); Text("Beklemeye al", fontSize = 12.sp)
                        }
                        TextButton(onClick = delete, enabled = enabled, colors = ButtonDefaults.textButtonColors(contentColor = ReceiptRed), contentPadding = PaddingValues(horizontal = 4.dp)) {
                            Icon(Icons.Outlined.DeleteOutline, null, Modifier.size(18.dp)); Spacer(Modifier.width(5.dp)); Text("Fişi sil", fontSize = 12.sp)
                        }
                    }
                }
            }
        }
    }
    HorizontalDivider(Modifier.padding(vertical = 6.dp), color = Rule)
}

@Composable private fun ReviewReceiptRow(draft: Draft, enabled: Boolean, open: () -> Unit) {
    Surface(color = Color(0xFFFFF7E7), shape = RoundedCornerShape(7.dp), modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp)) {
        Column(Modifier.clickable(enabled = enabled, onClick = open).padding(11.dp)) {
            Text("${receiptTitle(draft)} · ${draft.customer.code}", color = Ink, fontWeight = FontWeight.Bold, fontSize = 13.sp)
            Text("${draft.quantity} adet · ${receiptAmount(draft)}", color = Muted, fontSize = 12.sp)
            Text("Gönderim sonucu belirsiz. Fiş korunuyor.", color = ReceiptAmber, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
            Row(Modifier.padding(top = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("Sonucu kontrol et", color = Green, fontWeight = FontWeight.Medium, fontSize = 12.sp)
                Icon(Icons.Outlined.ArrowForward, null, tint = Green, modifier = Modifier.padding(start = 5.dp).size(16.dp))
            }
        }
    }
}

@Composable private fun ReceiptEmpty(group: ReceiptGroup, date: String?, hasOtherSent: Boolean, newSale: () -> Unit, allDates: () -> Unit, enabled: Boolean) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 36.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(if (group == ReceiptGroup.WAITING) Icons.Outlined.Schedule else Icons.Outlined.ReceiptLong, null, tint = Green, modifier = Modifier.size(34.dp))
        Text(when (group) { ReceiptGroup.WAITING -> "Bekleyen fiş yok"; ReceiptGroup.DRAFTS -> "Taslak fiş yok"; else -> "Gönderilen fiş yok" }, fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Ink, modifier = Modifier.padding(top = 12.dp))
        Text(when (group) {
            ReceiptGroup.WAITING -> "Ürün beklediğiniz fişte Beklemeye al düğmesini kullanın."
            ReceiptGroup.DRAFTS -> "Hazırlamaya başladığınız dolu fişler burada görünür."
            else -> if (date != null) "Seçili tarihte gönderilen fiş bulunamadı." else "ERP'ye kaydedilen fişler burada görünür."
        }, color = Muted, fontSize = 13.sp, modifier = Modifier.padding(top = 8.dp))
        if (group == ReceiptGroup.DRAFTS) TextButton(onClick = newSale, enabled = enabled) { Text("Yeni satış") }
        if (group == ReceiptGroup.SENT && date != null && hasOtherSent) TextButton(onClick = allDates, enabled = enabled) { Text("Tüm tarihleri göster") }
    }
}

@Composable private fun DeleteReceiptDialog(draft: Draft, busy: Boolean, dismiss: () -> Unit, confirm: () -> Unit) {
    AlertDialog(onDismissRequest = { if (!busy) dismiss() }, containerColor = Color.White, shape = RoundedCornerShape(14.dp),
        title = { Text("Bu fiş silinsin mi?", color = Ink, fontSize = 21.sp, fontWeight = FontWeight.Bold) },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState())) {
                Text("${receiptTitle(draft)} · ${draft.customer.code}", color = Muted, fontSize = 14.sp)
                Text("${draft.lines.size} çeşit · ${draft.quantity} adet · ${receiptAmount(draft)}", color = Muted, fontSize = 14.sp, modifier = Modifier.padding(top = 5.dp))
                Text("Fiş ve içindeki ürünler silinecek.", color = Ink, fontSize = 15.sp, modifier = Modifier.padding(top = 17.dp))
            }
        },
        dismissButton = { OutlinedButton(onClick = dismiss, enabled = !busy, shape = RoundedCornerShape(8.dp)) { Text("Vazgeç", color = Muted) } },
        confirmButton = { Button(onClick = confirm, enabled = !busy && draft.canDeleteLocally, shape = RoundedCornerShape(8.dp), colors = ButtonDefaults.buttonColors(containerColor = ReceiptRed)) { Text("Fişi sil") } })
}

@Composable internal fun HoldNoteDialog(title: String, initial: String, busy: Boolean, dismiss: () -> Unit, confirmLabel: String = "Beklemeye al", confirm: (String) -> Unit) {
    var note by remember(initial) { mutableStateOf(initial) }
    AlertDialog(onDismissRequest = { if (!busy) dismiss() }, title = { Text(title, fontSize = 21.sp, fontWeight = FontWeight.Bold) },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState())) {
                Text("Gelecek ürünleri yazabilirsiniz. Not isteğe bağlıdır.", fontSize = 13.sp, color = Muted)
                OutlinedTextField(note, { note = it.take(240) }, enabled = !busy, label = { Text("Bekleme notu") }, modifier = Modifier.fillMaxWidth().padding(top = 10.dp), minLines = 2, maxLines = 4,
                    supportingText = { Text("${note.length}/240") })
            }
        },
        dismissButton = { TextButton(onClick = dismiss, enabled = !busy) { Text("Vazgeç") } },
        confirmButton = { Button(onClick = { confirm(note.trim()) }, enabled = !busy) { Text(confirmLabel) } })
}
