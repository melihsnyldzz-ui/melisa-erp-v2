package com.melisaerp.nativeterminal

import java.net.URI
import kotlinx.serialization.json.JsonPrimitive

/** Explicit isolated TEST pair; an incoming intent, QR, or arbitrary URL cannot select a server. */
internal class WorkTasksContract(val origin: String) {
    init { require(origin in ORIGINS) }
    private val host = URI(origin).host
    private val apiOrigin = "http://$host:4184"
    private val crmOrigin = "http://$host:62700"
    private val crmApis = setOf("http://$host:62701", "http://$host:62702", "http://$host:62703")
    fun taskUrl(task: String): String { require(task in TASKS); return "$origin/terminal.html?worktest=1#$task" }
    fun allowedRequest(raw: String, mainFrame: Boolean, method: String = "GET"): Boolean = runCatching {
        val u = URI(raw)
        if (u.userInfo != null || u.scheme != "http" || u.host != host) return@runCatching false
        val site = "${u.scheme}://${u.host}:${u.port}"
        val path = u.rawPath.orEmpty()
        if (path.contains("%", true) || path.contains("\\") || path.split('/').any { it == ".." || it == "." }) return@runCatching false
        if (path == "/api/terminal-worktest" || path.startsWith("/api/terminal-worktest/"))
            return@runCatching !mainFrame && origin == "http://127.0.0.1:5234" && site == origin && path == "/api/terminal-worktest/home-summary" && u.rawQuery == null && u.rawFragment == null && method == "GET"
        if (path.startsWith("/api/test-personnel/") || path.startsWith("/api/test-admin/"))
            return@runCatching !mainFrame && site == "http://127.0.0.1:62700" && site == crmOrigin && path == "/api/test-personnel/session" && u.rawQuery == null && method == "POST"
        if (mainFrame) site == origin && path in setOf("/terminal.html", "/kullanim-egitimi.html")
        else (site == origin && (path == "/terminal.html" || path == "/kullanim-egitimi.html" || path == "/stage4-runtime.js" || path.startsWith("/assets/") || path.startsWith("/training/") || path == "/favicon.ico" || path.matches(Regex("/api/terminal-cartons/receipts(?:/[0-9]+)?")))) ||
            (site == apiOrigin && path.startsWith("/api/")) ||
            (site == crmOrigin && (path == "/" || path == "/mobile-preview" || path.startsWith("/assets/") || path.startsWith("/api/live/") || path == "/favicon.ico")) ||
            (site in crmApis && (path.startsWith("/api/") || path.startsWith("/crm/") || path.startsWith("/catalog/")))
    }.getOrDefault(false)
    fun taskOf(raw: String): String? = runCatching { URI(raw).takeIf { allowedRequest(raw, true) && it.path == "/terminal.html" }?.fragment?.takeIf { it in TASKS || it == "home" } }.getOrNull()
    companion object {
        val ORIGINS = setOf("http://192.168.1.46:5234", "http://127.0.0.1:5234")
        val TASKS = listOf("goods", "sales", "packing", "crm")
    }
}

/** Text-only adapter into the existing online screen's fixed barcode field. */
internal fun workScanScript(task: String, barcode: String): String? {
    if (barcode.isEmpty() || barcode.length > 160 || barcode.any(Char::isISOControl)) return null
    val selector = when (task) {
        "goods" -> "#count-scan,[name=scan]"
        "sales" -> "[data-sale-search] [name=search]"
        "packing" -> "[data-carton-scan]"
        else -> return null
    }
    fun text(s: String) = JsonPrimitive(s).toString()
    return """(()=>{if(location.hash!==${text("#$task")})return false;const e=document.querySelector(${text(selector)});if(!(e instanceof HTMLInputElement)||e.disabled||e.type==='password'||e.readOnly)return false;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${text(barcode)});e.dispatchEvent(new Event('input',{bubbles:true}));const ev=new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,cancelable:true});if(e.dispatchEvent(ev)&&e.form)e.form.requestSubmit();return true;})()"""
}

/** Do not queue scans across background/resume, navigation or a login field. */
internal class WorkScanGate(private val now: () -> Long = { android.os.SystemClock.elapsedRealtime() }) {
    private var foreground = false
    private var ready = false
    private var task: String? = null
    private var last = ""
    private var at = Long.MIN_VALUE
    fun resume() { foreground = true; last = ""; at = Long.MIN_VALUE }
    fun pause() { foreground = false; ready = false; last = ""; at = Long.MIN_VALUE }
    fun page(task: String?, ready: Boolean) { this.task = task; this.ready = ready }
    fun accept(raw: String): String? {
        if (!foreground || !ready || task !in setOf("goods", "sales", "packing")) return null
        val value = raw.trim()
        if (value.isEmpty() || value.length > 160 || value.any(Char::isISOControl)) return null
        val time = now()
        if (value == last && at != Long.MIN_VALUE && time - at < 600) return null
        last = value; at = time
        return value
    }
}
