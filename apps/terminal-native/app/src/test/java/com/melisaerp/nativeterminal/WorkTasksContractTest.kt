package com.melisaerp.nativeterminal

import org.junit.Assert.*
import org.junit.Test

class WorkTasksContractTest {
    private val c = WorkTasksContract("http://127.0.0.1:5234")
    @Test fun exactPairAndTasks() {
        WorkTasksContract.TASKS.forEach { assertTrue(c.allowedRequest(c.taskUrl(it), true)); assertEquals(it, c.taskOf(c.taskUrl(it))) }
        assertTrue(c.allowedRequest("http://127.0.0.1:4184/api/auth/me", false))
        assertFalse(c.allowedRequest("http://127.0.0.1:4214/api/auth/me", false))
        assertTrue(c.allowedRequest("http://127.0.0.1:62700/?terminal=1", false))
        assertFalse(c.allowedRequest("http://192.168.1.46:4184/api/auth/me", false))
        assertTrue(WorkTasksContract("http://192.168.1.46:5234").allowedRequest("http://192.168.1.46:4184/api/auth/me", false))
        assertTrue(c.allowedRequest("http://127.0.0.1:5234/api/terminal-cartons/receipts", false))
        assertTrue(c.allowedRequest("http://127.0.0.1:5234/api/terminal-cartons/receipts/123", false))
        assertTrue(c.allowedRequest("http://127.0.0.1:62700/api/live/crm/terminal/session", false))
        assertTrue(c.allowedRequest("http://127.0.0.1:5234/stage4-runtime.js", false))
        assertFalse(c.allowedRequest("http://192.168.1.46:5234/stage4-runtime.js", false))
        assertFalse(c.allowedRequest("http://127.0.0.1:5264/stage4-runtime.js", false))
        assertFalse(c.allowedRequest("http://127.0.0.1:4184/stage4-runtime.js", false))
        assertFalse(c.allowedRequest("http://127.0.0.1:5234/stage4-runtime.js/other", false))
        assertFalse(c.allowedRequest("http://127.0.0.1:5234/api/finance", false))
        assertFalse(c.allowedRequest("http://127.0.0.1:5234/api/terminal-cartons/receipts/123/delete", false))
    }
    @Test fun foreignAndUnsafePathsClosed() {
        listOf("file:///etc/test", "javascript:alert(1)", "http://127.0.0.1:5194/terminal.html", "http://127.0.0.1.evil:5234/terminal.html", "http://user@127.0.0.1:5234/terminal.html", "http://127.0.0.1:5234/assets/../private", "http://127.0.0.1:5234/assets/%2e%2e/private", "http://127.0.0.1:5234/ornek-akis.html").forEach { assertFalse(it, c.allowedRequest(it, true)) }
        assertFalse(c.allowedRequest("http://192.168.1.46:62700/", true))
        assertFalse(c.allowedRequest("http://192.168.1.46:4214/api/auth/me", true))
        assertFalse(c.allowedRequest("http://192.168.1.46:62700/unknown", false))
        assertFalse(c.allowedRequest("http://127.0.0.1:5234/assets/%2e%2e/private", false))
        assertFalse(c.allowedRequest("http://127.0.0.1:5234/assets/../private", false))
    }
    @Test fun foregroundAndResumeNeverReplay() {
        var t = 1000L; val gate = WorkScanGate { t }
        gate.page("sales", true); assertNull(gate.accept("0007"))
        gate.resume(); gate.page("sales", true); assertEquals("0007", gate.accept("0007")); assertNull(gate.accept("0007"))
        t += 601; assertEquals("0007", gate.accept("0007"))
        gate.pause(); assertNull(gate.accept("0008")); gate.resume(); assertNull(gate.accept("0008"))
        gate.page("crm", true); assertNull(gate.accept("0008")); gate.page("goods", true); assertNull(gate.accept("x\n0"))
        assertEquals("0161", gate.accept("0161"))
    }
    @Test fun separateScannerProfilePreservesOldInstall() {
        assertEquals("MelisaNativeV1", com.melisaerp.nativeterminal.scanner.scannerProfileName("com.melisaerp.nativeterminal"))
        assertEquals("MelisaNativeWorkTestV1", com.melisaerp.nativeterminal.scanner.scannerProfileName("com.melisaerp.nativeterminal.worktest"))
    }
    @Test fun barcodeAdapterIsTextAndCannotSelectLoginOrArbitraryCode() {
        val value = "0007\";fetch('https://foreign');\""
        val script = workScanScript("sales", value)!!
        assertTrue(script.contains(kotlinx.serialization.json.JsonPrimitive(value).toString()))
        assertTrue(script.contains("e.type==='password'"))
        assertTrue(script.contains("if(e.dispatchEvent(ev)&&e.form)e.form.requestSubmit()"))
        assertNull(workScanScript("crm", "0007"))
        assertNull(workScanScript("login", "0007"))
        assertNull(workScanScript("sales", "0007\n"))
        assertTrue(workScanScript("goods", "0161")!!.contains("\"0161\""))
    }
    @Test fun existingPersonnelBootstrapOnlyExactLoopbackPost() {
        val url = "http://127.0.0.1:62700/api/test-personnel/session"
        assertTrue(c.allowedRequest(url, false, "POST"))
        assertFalse(c.allowedRequest(url, false))
        assertFalse(c.allowedRequest(url, true, "POST"))
        listOf("GET", "HEAD", "PUT", "DELETE", "PATCH").forEach { assertFalse(c.allowedRequest(url, false, it)) }
        listOf("http://192.168.1.46:62700/api/test-personnel/session", "http://127.0.0.1:62701/api/test-personnel/session", "http://127.0.0.1:62700/api/test-admin/session", "$url/other", "$url?role=admin").forEach { assertFalse(c.allowedRequest(it, false, "POST")) }
        assertFalse(WorkTasksContract("http://192.168.1.46:5234").allowedRequest("http://192.168.1.46:62700/api/test-personnel/session", false, "POST"))
    }
    @Test fun homeSummaryOnlyExactApprovedOriginRead() {
        val url = "http://127.0.0.1:5234/api/terminal-worktest/home-summary"
        assertTrue(c.allowedRequest(url, false))
        assertTrue(c.allowedRequest(url, false, "GET"))
        assertFalse(c.allowedRequest(url, true, "GET"))
        listOf("POST", "HEAD", "PUT", "DELETE", "PATCH", "get").forEach { assertFalse(it, c.allowedRequest(url, false, it)) }
        listOf("$url?", "$url?copyId=other", "$url#", "$url#home", "$url/", "$url/other", "$url%2fother", "http://127.0.0.1:5234/api/terminal-worktest/other", "http://127.0.0.1:5234/api/terminal-worktest").forEach { assertFalse(it, c.allowedRequest(it, false, "GET")) }
        val lan = WorkTasksContract("http://192.168.1.46:5234")
        val lanUrl = "http://192.168.1.46:5234/api/terminal-worktest/home-summary"
        assertTrue(lan.allowedRequest(lanUrl, false, "GET"))
        assertFalse(lan.allowedRequest(lanUrl, true, "GET"))
        listOf("POST", "HEAD", "PUT", "DELETE", "PATCH", "get").forEach { assertFalse(it, lan.allowedRequest(lanUrl, false, it)) }
        listOf("?", "?copyId=other", "#home", "/", "/other", "%2fother").forEach { assertFalse(it, lan.allowedRequest(lanUrl + it, false, "GET")) }
    }
    @Test fun homeSummaryCannotFallThroughToAnotherApiOrigin() {
        val path = "/api/terminal-worktest/home-summary"
        listOf("http://127.0.0.1:5264", "http://127.0.0.1:4184", "http://127.0.0.1:62700", "http://127.0.0.1:62701", "http://127.0.0.1:62702", "http://127.0.0.1:62703", "http://192.168.1.46:5234", "http://localhost:5234", "https://127.0.0.1:5234", "http://127.0.0.1.evil:5234", "http://user@127.0.0.1:5234").forEach { assertFalse(it, c.allowedRequest(it + path, false, "GET")) }
        val lan = WorkTasksContract("http://192.168.1.46:5234")
        assertTrue(lan.allowedRequest("http://192.168.1.46:5234$path", false, "GET"))
        assertFalse(lan.allowedRequest("http://192.168.1.46:4184$path", false, "GET"))
        assertFalse(lan.allowedRequest("http://127.0.0.1:5234$path", false, "GET"))
        assertTrue(c.allowedRequest("http://127.0.0.1:4184/api/auth/me", false))
        assertTrue(c.allowedRequest("http://127.0.0.1:5234/api/terminal-cartons/receipts/123", false))
    }
}
