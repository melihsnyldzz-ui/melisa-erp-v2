package com.melisaerp.nativeterminal

import android.graphics.Paint
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.melisaerp.nativeterminal.model.ReceiptQr
import kotlinx.coroutines.delay
import kotlin.math.floor
import kotlin.math.min

data class PdfShareUi(
    val requestId: Long, val draftId: String, val invoiceId: Long, val documentNumber: String,
    val loading: Boolean = true, val qr: ReceiptQr? = null, val expiresAt: Long = 0,
    val error: String? = null,
)

@Composable internal fun ReceiptPdfShareDialog(state: PdfShareUi, dismiss: () -> Unit, renew: () -> Unit) {
    var now by remember(state.requestId) { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(state.requestId, state.expiresAt) {
        while (true) { now = System.currentTimeMillis(); delay(1000) }
    }
    val expired = state.expiresAt > 0 && state.expiresAt <= now
    Dialog(onDismissRequest = dismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp).heightIn(max = 590.dp), color = Color.White, shape = RoundedCornerShape(16.dp)) {
            Column(Modifier.verticalScroll(rememberScrollState()).padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Text("Fişi telefona al", color = Ink, fontSize = 23.sp, fontWeight = FontWeight.Bold)
                Text(state.documentNumber, modifier = Modifier.padding(top = 6.dp), fontSize = 13.sp, color = Muted, textAlign = TextAlign.Center)
                Text("Telefonla okutun · Aynı Wi-Fi ağı", modifier = Modifier.padding(top = 12.dp, bottom = 8.dp), color = Ink, fontSize = 14.sp, textAlign = TextAlign.Center)
                if (state.loading) {
                    Box(Modifier.widthIn(max = 240.dp).fillMaxWidth().aspectRatio(1f), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            CircularProgressIndicator()
                            Text("PDF bağlantısı hazırlanıyor…", modifier = Modifier.padding(top = 16.dp), color = Muted, fontSize = 14.sp)
                        }
                    }
                } else if (expired || state.error != null) {
                    Box(Modifier.fillMaxWidth().heightIn(min = 160.dp).padding(vertical = 24.dp), contentAlignment = Alignment.Center) {
                        Text(if (expired) "QR kodun süresi doldu.\nYenileyip tekrar okutabilirsiniz." else state.error.orEmpty(), color = Muted, textAlign = TextAlign.Center, fontSize = 15.sp)
                    }
                } else state.qr?.let { qr ->
                    ReceiptQrCanvas(qr, Modifier.widthIn(max = 240.dp).fillMaxWidth().aspectRatio(1f))
                    val seconds = ((state.expiresAt - now).coerceAtLeast(0) + 999) / 1000
                    Text("Bağlantı ${seconds / 60}:${(seconds % 60).toString().padStart(2, '0')} geçerli", color = Muted, fontSize = 13.sp, modifier = Modifier.padding(top = 8.dp))
                    Text("Fiş telefonunuzda PDF olarak açılır.", color = Muted, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp), textAlign = TextAlign.Center)
                }
                Row(Modifier.fillMaxWidth().padding(top = 16.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedButton(onClick = dismiss, modifier = Modifier.weight(1f), shape = RoundedCornerShape(9.dp)) { Text("Kapat") }
                    if (!state.loading && (expired || state.error != null)) Button(onClick = renew, modifier = Modifier.weight(1f), shape = RoundedCornerShape(9.dp)) { Text("Yenile") }
                }
            }
        }
    }
}

@Composable private fun ReceiptQrCanvas(qr: ReceiptQr, modifier: Modifier) {
    val paint = remember { Paint().apply { color = android.graphics.Color.BLACK; isAntiAlias = false; isDither = false; style = Paint.Style.FILL } }
    Canvas(modifier.background(Color.White).semantics { contentDescription = "Fiş PDF bağlantısı QR kodu" }) {
        // Each QR module is an exact integer number of physical pixels; no bitmap interpolation.
        val cell = floor(min(size.width, size.height) / qr.size).toInt().coerceAtLeast(1)
        val left = floor((size.width - cell * qr.size) / 2)
        val top = floor((size.height - cell * qr.size) / 2)
        drawIntoCanvas { canvas ->
            for (y in 0 until qr.size) for (x in 0 until qr.size) if (qr.dark(x, y)) {
                canvas.nativeCanvas.drawRect(left + x * cell, top + y * cell, left + (x + 1) * cell, top + (y + 1) * cell, paint)
            }
        }
    }
}
