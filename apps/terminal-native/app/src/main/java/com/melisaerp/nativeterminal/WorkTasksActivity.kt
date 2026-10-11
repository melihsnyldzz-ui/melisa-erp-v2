package com.melisaerp.nativeterminal

import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.net.http.SslError
import android.os.Bundle
import android.webkit.*
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.melisaerp.nativeterminal.model.UiPreferences
import com.melisaerp.nativeterminal.scanner.BarcodeScanner
import com.melisaerp.nativeterminal.scanner.createBarcodeScanner
import org.json.JSONObject
import java.io.ByteArrayInputStream

/** Debug-only launcher. The original native activity, database and vault are untouched. */
class WorkTasksActivity : ComponentActivity() {
    private val contract by lazy { WorkTasksContract(BuildConfig.WORK_ORIGIN) }
    private val gate = WorkScanGate()
    private lateinit var scanner: BarcodeScanner
    private lateinit var web: WebView
    private var home by mutableStateOf(true)
    private var task by mutableStateOf<String?>(null)
    private var message by mutableStateOf("")
    private var loading by mutableStateOf(false)
    private var pageReady = false
    private var pageFailed = false
    private var resumed = false
    private val labels = linkedMapOf("goods" to "Mal kabul", "sales" to "Satış", "packing" to "Koli hazırlama", "crm" to "Müşterilerim")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        check(BuildConfig.DEBUG && packageName.endsWith(".worktest"))
        enableEdgeToEdge()
        web = createWorkView()
        scanner = createBarcodeScanner(this, ::deliverScan, { status ->
            message = if (status.contains("hazır", true)) "Barkod okuyucu hazır." else "Barkod bağlantısı doğrulanıyor."
        }) { UiPreferences() }
        if (savedInstanceState != null) {
            val restored = savedInstanceState.getString("task")?.takeIf { it in WorkTasksContract.TASKS }
            if (restored != null && web.restoreState(savedInstanceState) != null) { task = restored; home = false }
        }
        setContent {
            MaterialTheme(colorScheme = lightColorScheme(primary = Green, background = Paper, surface = Paper)) {
                BackHandler(!home) { requestHome() }
                Column(Modifier.fillMaxSize().systemBarsPadding().imePadding()) {
                    Surface(color = Color(0xFF163B2D), contentColor = Color.White) {
                        Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                            if (!home) TextButton(onClick = ::requestHome) { Text("‹ Ana sayfa", color = Color.White) }
                            Column(Modifier.weight(1f)) {
                                Text("MELİSA", fontWeight = FontWeight.Bold, fontSize = 19.sp)
                                Text(if (home) "Bugünkü işiniz" else labels[task].orEmpty(), fontSize = 13.sp)
                            }
                            if (!home && task in setOf("goods", "sales", "packing")) OutlinedButton(onClick = { scanner.trigger() }) { Text("Okut", color = Color.White) }
                        }
                    }
                    if (loading && !home) LinearProgressIndicator(Modifier.fillMaxWidth())
                    if (message.isNotBlank()) Text(message, Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 5.dp), fontSize = 12.sp)
                    Box(Modifier.weight(1f).fillMaxWidth()) {
                        // Keep one live page when the home overlay is visible; do not discard an unsaved draft/session.
                        AndroidView(factory = { web }, modifier = Modifier.fillMaxSize(), update = { it.visibility = if (home) android.view.View.INVISIBLE else android.view.View.VISIBLE })
                        if (home) Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("İşinizi seçin", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = Ink)
                            labels.forEach { (id, label) ->
                                Button(onClick = { openTask(id) }, modifier = Modifier.fillMaxWidth().heightIn(min = 72.dp)) {
                                    Column(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                                        Text(label, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                                        Text(when (id) { "goods" -> "Tedarikçi · barkod · adet · İlker'e gönder"; "sales" -> "Müşteri · barkod · satış satırları"; "packing" -> "Satış fişi · adetler · yeni koli"; else -> "Size atanmış müşteriler ve görüşmeler" }, fontSize = 12.sp)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun createWorkView(): WebView = WebView(this).apply {
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.allowFileAccess = false
        settings.allowContentAccess = false
        settings.setSupportMultipleWindows(false)
        settings.javaScriptCanOpenWindowsAutomatically = false
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        settings.safeBrowsingEnabled = true
        CookieManager.getInstance().setAcceptThirdPartyCookies(this, false)
        WebView.setWebContentsDebuggingEnabled(false)
        webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val allowed = contract.allowedRequest(request.url.toString(), request.isForMainFrame, request.method)
                if (!allowed) message = "Bu bağlantı çalışma alanının dışında."
                return !allowed
            }
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                if (contract.allowedRequest(request.url.toString(), request.isForMainFrame, request.method)) null
                else WebResourceResponse("text/plain", "UTF-8", 403, "Closed", mapOf("Cache-Control" to "no-store"), ByteArrayInputStream(ByteArray(0)))
            override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) { loading = true; pageReady = false; pageFailed = false; gate.page(null, false) }
            override fun onPageFinished(view: WebView, url: String) {
                loading = false; pageReady = contract.taskOf(url) != null
                task = contract.taskOf(url)?.takeIf { it != "home" } ?: task
                gate.page(if (home) null else task, resumed && pageReady)
            }
            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) { loading = false; pageReady = false; pageFailed = true; gate.page(null, false); message = "Çalışma alanına bağlanılamadı. Wi-Fi bağlantınızı kontrol edin." }
            }
            override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: SslError) { handler.cancel(); message = "Güvenli bağlantı doğrulanamadı." }
        }
        webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) { request.deny() }
        }
    }

    private fun openTask(id: String) {
        if (id !in WorkTasksContract.TASKS) return
        message = ""; home = false
        if (!pageReady || contract.taskOf(web.url.orEmpty()) == null) {
            task = id; loading = true; web.loadUrl(contract.taskUrl(id)); return
        }
        navigateHash(id) { changed -> if (changed) { task = id; gate.page(id, resumed && pageReady) } else message = "Önce açık kaydı kaydedin veya son işlemin sonucunu kontrol edin." }
    }

    private fun navigateHash(id: String, result: (Boolean) -> Unit) {
        gate.page(null, false)
        if (id != "home" && id !in WorkTasksContract.TASKS) return
        web.evaluateJavascript("window.location.hash=${JSONObject.quote("#$id")};") {
            web.postDelayed({ web.evaluateJavascript("window.location.hash===${JSONObject.quote("#$id")}") { value -> result(value == "true") } }, 80)
        }
    }

    private fun requestHome() {
        if (pageFailed) { home = true; gate.page(null, false); return }
        if (!pageReady) { message = "Bağlantı sonucunu bekleyin; açık kaydınız korunuyor."; return }
        navigateHash("home") { changed ->
            if (changed) { home = true; gate.page(null, false); message = "" }
            else { gate.page(task, resumed && pageReady); message = "Önce açık kaydı kaydedin veya son işlemin sonucunu kontrol edin." }
        }
    }

    private fun deliverScan(raw: String) {
        val value = gate.accept(raw) ?: return
        val currentTask = task ?: return
        // Fixed selectors and JSON text encoding only. No Android JS object, auth/token bridge, arbitrary method, or API call.
        val code = workScanScript(currentTask, value) ?: return
        web.evaluateJavascript(code) { result -> if (result != "true") message = "Önce müşteri veya tedarikçi seçip barkod alanını açın." }
    }

    override fun onStart() { super.onStart(); scanner.onStart() }
    override fun onResume() { super.onResume(); resumed = true; web.onResume(); scanner.onResume(); gate.resume(); gate.page(if (home) null else task, pageReady) }
    override fun onPause() { resumed = false; gate.pause(); scanner.onPause(); web.onPause(); super.onPause() }
    override fun onStop() { scanner.onStop(); super.onStop() }
    override fun onSaveInstanceState(outState: Bundle) { web.saveState(outState); if (!home) outState.putString("task", task); super.onSaveInstanceState(outState) }
    override fun onDestroy() { gate.pause(); scanner.close(); web.destroy(); super.onDestroy() }
}
