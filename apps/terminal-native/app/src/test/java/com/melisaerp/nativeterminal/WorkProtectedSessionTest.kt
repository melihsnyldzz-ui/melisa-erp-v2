package com.melisaerp.nativeterminal

import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test
import java.io.File

class WorkProtectedSessionTest {
    private val origin = "http://192.168.1.46:5234"
    private val page = "$origin/terminal.html?worktest=1#crm"
    private val policy = WorkProtectedSessionPolicy(origin)
    private val session = """{"accessToken":"opaque-access","refreshToken":"opaque-refresh","userId":"normal-personel","username":"agent-test","expiresAt":100000}"""
    @Test fun failedMainFrameCannotBecomeReadyWhenItsRequestedTaskUrlFinishes() {
        // Android calls onPageFinished even for its network-error page. A valid
        // requested URL does not establish a usable document or barcode target.
        assertFalse(workPageReady(true, true, "sales"))
        assertFalse(workPageReady(true, true, "goods"))
        assertFalse(workPageReady(false, false, "sales"))
        assertFalse(workPageReady(true, false, null))
        // A subsequent successful, protected page load may become ready again.
        assertTrue(workPageReady(true, false, "sales"))
        assertTrue(workPageReady(true, false, "home"))
    }
    @Test fun realmsAreExactAndNeverShared() {
        val erp = policy.key(origin, true, page)
        val crm = policy.key("http://192.168.1.46:62700", false, page)
        assertNotNull(erp); assertNotNull(crm); assertNotEquals(erp, crm)
        assertNull(policy.key(origin, false, page))
        assertNull(policy.key("http://192.168.1.46:62700", true, page))
        for (wrong in listOf("http://192.168.1.99:62700", "http://192.168.1.46:62701", "http://127.0.0.1:62700", "https://192.168.1.46:62700", "null")) assertNull(policy.key(wrong, false, page))
        assertNull(policy.key(origin, true, "http://192.168.1.46:5234/not-terminal"))
        assertNull(policy.key(origin, true, "http://other:5234/terminal.html"))
    }
    @Test fun messagesCannotChooseRealmMethodOrCarryPasswords() {
        val request = parseWorkProtectedRequest("""{"v":1,"id":"1","action":"put","session":$session}""")
        assertEquals("normal-personel", request.session!!["userId"]!!.jsonPrimitive.content)
        for (raw in listOf(
            """{"v":1,"id":"1","action":"get","origin":"$origin"}""",
            """{"v":1,"id":"1","action":"execute"}""",
            """{"v":1,"id":"1","action":"get","session":$session}""",
            """{"v":1,"id":"1","action":"put","session":{"password":"secret"}}""",
            """{"v":2,"id":"1","action":"clear"}"""
        )) assertTrue(runCatching { parseWorkProtectedRequest(raw) }.isFailure)
    }
    @Test fun expiredAccessCanBeReadForServerRefreshButMalformedIdentityCannot() {
        // No expiry bypass: the native layer only stores the token, never authorizes it.
        assertNotNull(parseWorkProtectedRequest("""{"v":1,"id":"1","action":"put","session":$session}""").session)
        for (invalid in listOf(session.replace("normal-personel", ""), session.replace("100000", "-1"), session.replace("opaque-access", ""))) {
            assertTrue(runCatching { parseWorkProtectedRequest("""{"v":1,"id":"1","action":"put","session":$invalid}""") }.isFailure)
        }
        val reply = Json.parseToJsonElement(protectedSessionReply("same_request", true)).jsonObject
        assertEquals("same_request", reply["id"]!!.jsonPrimitive.content)
        assertEquals(JsonNull, reply["session"])
    }
    @Test fun taskActivityCannotLoadAuthWithoutSuccessfullyInstalledProtectedListener() {
        // Source guard supplements pure realm tests where desktop JVM cannot construct WebView.
        val relative = "src/main/java/com/melisaerp/nativeterminal/WorkTasksActivity.kt"
        val sourceFile = generateSequence(File(System.getProperty("user.dir"))) { it.parentFile }
            .flatMap { sequenceOf(File(it, relative), File(it, "app/$relative")) }.first { it.isFile }
        val source = sourceFile.readText()
        assertTrue(source.contains("private var protectedStorageReady = false"))
        assertTrue(source.contains("savedInstanceState != null && protectedStorageReady"))
        assertTrue(source.contains("protectedStorageReady = runCatching"))
        assertTrue(source.contains("}.isSuccess"))
        assertTrue(source.contains("MelisaProtectedWork/1"))
        assertTrue(source.contains("protectedStorageReady && contract.allowedRequest"))
        assertTrue(source.contains("pageReady = workPageReady(protectedStorageReady, pageFailed, finishedTask)"))
        assertTrue(source.contains("if (pageReady) task = finishedTask"))
        assertTrue(source.contains("if (home || !pageReady) null else task"))
        val opening = source.substringAfter("private fun openTask(id: String)").substringBefore("private fun navigateHash")
        assertTrue(opening.indexOf("if (!protectedStorageReady)") in 0 until opening.indexOf("web.loadUrl"))
        assertTrue(opening.substringAfter("if (!protectedStorageReady)").substringBefore("message = \"\"; home = false").contains("return"))
    }
}
