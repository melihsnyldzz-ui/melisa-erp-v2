package com.melisaerp.nativeterminal

import kotlinx.coroutines.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test
import java.util.UUID

class WorkSessionHandoffTest {
    private class Fixture {
        val origin = "http://192.168.1.46:5244"
        val erp = "protected-work-session:erp:$origin"
        val crm = "protected-work-session:crm:http://192.168.1.46:62800"
        val values = mutableMapOf<String, String>()
        val calls = mutableListOf<Triple<String, String, JsonObject?>>()
        val lock = Mutex()
        var clock = 1_000_000L
        var family = UUID.randomUUID().toString()
        var userId = 15L
        var username = "ornek-satis"
        var relation = true
        var crmMeFailure = 0
        var closeFailure = false
        var meIdentityChange = false
        var invalidRevision = false
        var issued = 0
        var rotate = 0
        var beforeCall: (suspend (String) -> Unit)? = null
        val revoked = mutableSetOf<String>()
        val familyClosed = mutableSetOf<String>()
        private val erpFamilies = mutableMapOf<String, String>()
        private val crmGrants = mutableMapOf<String, Pair<Int, String>>()
        private val crmFamilies = mutableMapOf<Int, String>()
        private var prepared: JsonObject? = null
        private fun JsonObject.text(key: String) = get(key)!!.jsonPrimitive.content
        fun ownErp(): JsonObject {
            erpFamilies["erp-refresh-$family"] = family
            return buildJsonObject { put("accessToken", "erp-access-$family"); put("refreshToken", "erp-refresh-$family"); put("userId", userId.toString()); put("username", username); put("expiresAt", clock + 900000) }
        }
        private fun crmUser(id: Int): JsonObject = buildJsonObject {
            put("id", if (meIdentityChange) "wrong-person" else "clean-staff-20261022"); put("username", "ornek-personel"); put("role", "personel"); put("chatwootAgentId", 2); put("normalRefreshSession", true)
            put("permissions", buildJsonArray { add("crm.view") })
            put("terminalIdentity", buildJsonObject {
                put("version", 1); put("environmentId", "e662fd94-d797-4b3b-938a-d143ad758b67"); put("database", "MELISA_ERP_CLEAN_TEST_20261022")
                put("erpOrigin", origin); put("crmOrigin", origin.replace(":5244", ":62800")); put("erpUserId", userId); put("erpNormalSessionId", crmFamilies[id]!!)
                put("crmUserId", "clean-staff-20261022"); put("chatwootAgentId", 2)
                put("bindingRevision", if (invalidRevision) buildJsonArray { add("a".repeat(64)) } else JsonPrimitive("a".repeat(64))); put("expiresAt", clock + 30000)
            })
        }
        private fun crmResult(id: Int, version: Int = 0): JsonObject {
            val access = "crm-access-$id-$version"; val refresh = "crm-refresh-$id-$version"
            crmGrants[access] = id to "access"; crmGrants[refresh] = id to "refresh"
            return buildJsonObject { put("accessToken", access); put("refreshToken", refresh); put("expiresAt", clock + 900000); put("user", crmUser(id)) }
        }
        val core = WorkSessionHandoff(origin, { values[it] }, { key, value -> if (value == null) values.remove(key) else values[key] = value }, WorkHandoffTransport { realm, path, body, access ->
            calls.add(Triple(realm, path, body)); beforeCall?.invoke(path)
            when (path) {
                "/api/auth/session-confirm" -> {
                    val sid = erpFamilies[body!!.text("refreshToken")] ?: throw WorkHandoffError(401)
                    if (access != "erp-access-$sid" || sid in familyClosed) throw WorkHandoffError(401)
                    buildJsonObject { put("confirmed", true); put("normalTestSessionId", sid); put("expiresAt", clock + 900000); put("user", buildJsonObject { put("id", userId); put("username", username) }) }
                }
                "/api/auth/terminal-handoff/prepare" -> {
                    if (!relation || family in familyClosed || access != "erp-access-$family" || body!!.text("refreshToken") != "erp-refresh-$family") throw WorkHandoffError(403)
                    prepared = body
                    buildJsonObject { put("version", 1); put("code", "c".repeat(43)); put("requestId", body.text("requestId")); put("expiresAt", clock + 30000) }
                }
                "/api/live/auth/terminal-handoff" -> {
                    assertNull(access); assertNotNull(prepared)
                    assertEquals(setOf("code", "codeVerifier", "requestId", "deviceBinding", "erpOrigin", "crmOrigin"), body!!.keys)
                    assertFalse(body.toString().contains("erp-access")); assertFalse(body.toString().contains("erp-refresh"))
                    assertEquals(prepared!!.text("requestId"), body.text("requestId")); prepared = null
                    issued++; crmFamilies[issued] = family; crmResult(issued)
                }
                "/api/live/auth/me" -> {
                    if (crmMeFailure != 0) throw WorkHandoffError(crmMeFailure)
                    val id = crmGrants[access]?.first ?: throw WorkHandoffError(401)
                    if (!relation || id.toString() in revoked || crmFamilies[id] in familyClosed) throw WorkHandoffError(403)
                    crmUser(id)
                }
                "/api/live/auth/refresh" -> {
                    val id = crmGrants[body!!.text("refreshToken")]?.first ?: throw WorkHandoffError(401)
                    if (!relation || id.toString() in revoked || crmFamilies[id] in familyClosed) throw WorkHandoffError(403)
                    crmResult(id, ++rotate)
                }
                "/api/live/auth/logout" -> {
                    if (closeFailure) throw WorkHandoffError(503)
                    val id = crmGrants[body!!.text("refreshToken")]?.first ?: throw WorkHandoffError(401)
                    revoked.add(id.toString()); buildJsonObject { put("loggedOut", true) }
                }
                "/api/auth/logout" -> {
                    if (closeFailure) throw WorkHandoffError(503)
                    familyClosed.add(erpFamilies[body!!.text("refreshToken")]!!); buildJsonObject { put("loggedOut", true) }
                }
                else -> throw AssertionError("Unexpected static path")
            }
        }, { clock })
        suspend fun call(key: String, action: String, saved: JsonObject? = null): JsonObject? {
            val request = WorkProtectedRequest("fixture", action, saved)
            val epoch = if (action == "get") core.epoch() else core.invalidate()
            return lock.withLock { core.execute(key, request, epoch) }
        }
        suspend fun open(): JsonObject { call(erp, "put", ownErp()); return call(crm, "get")!! }
    }

    @Test fun emptyCrmRealmGetsOnlyTheBoundOwnGrantAndNeverErpCredentials() = runBlocking {
        val f = Fixture(); val saved = f.open()
        assertEquals("clean-staff-20261022", saved["userId"]!!.jsonPrimitive.content)
        assertEquals(1, f.issued); assertNotNull(f.values[f.crm + ":verified-link"])
        assertFalse(f.values[f.crm]!!.contains("erp-refresh")); assertFalse(f.values[f.crm]!!.contains("terminalIdentity"))
        assertTrue(f.calls.any { it.second == "/api/live/auth/me" })
    }
    @Test fun reopeningReusesOwnFamilyAndRefreshKeepsIdentityWithoutAnotherHandoff() = runBlocking {
        val f = Fixture(); val first = f.open(); assertEquals(first, f.call(f.crm, "get")); assertEquals(1, f.issued)
        f.clock += 850000; val renewed = f.call(f.crm, "get")!!
        assertEquals(1, f.issued); assertEquals(1, f.rotate); assertNotEquals(first["refreshToken"], renewed["refreshToken"])
        f.call(f.crm, "put", renewed); assertEquals(renewed, f.call(f.crm, "get"))
    }
    @Test fun relationRevocationClosesOwnServerGrantAndVaultAndCannotReissue() = runBlocking {
        val f = Fixture(); f.open(); f.relation = false
        assertTrue(runCatching { f.call(f.crm, "get") }.isFailure)
        assertNull(f.values[f.crm]); assertTrue("1" in f.revoked)
        assertTrue(runCatching { f.call(f.crm, "get") }.isFailure); assertEquals(1, f.issued)
    }
    @Test fun erpLogoutClosesBothFamiliesAndRepeatedClearIsIdempotent() = runBlocking {
        val f = Fixture(); f.open(); val old = f.family; f.call(f.erp, "clear")
        assertNull(f.values[f.erp]); assertNull(f.values[f.crm]); assertTrue(old in f.familyClosed); assertTrue("1" in f.revoked)
        f.call(f.erp, "clear"); assertTrue(runCatching { f.call(f.crm, "get") }.isFailure)
    }
    @Test fun pendingCloseSurvivesFailureAndBlocksNewIdentityUntilConfirmed() = runBlocking {
        val f = Fixture(); f.open(); f.closeFailure = true
        assertTrue(runCatching { f.call(f.erp, "clear") }.isFailure)
        assertNotNull(f.values[f.erp + ":pending-close"]); assertNotNull(f.values[f.crm + ":pending-close"])
        assertNull(f.values[f.erp]); assertNull(f.values[f.crm])
        f.family = UUID.randomUUID().toString(); f.userId = 18; f.username = "ornek-depo"
        assertTrue(runCatching { f.call(f.erp, "put", f.ownErp()) }.isFailure); assertNull(f.values[f.erp])
        f.closeFailure = false; f.call(f.erp, "put", f.ownErp()); assertNull(f.values[f.erp + ":pending-close"]); assertNull(f.values[f.crm + ":pending-close"])
    }
    @Test fun changingErpAccountClosesOnlyOldFamiliesBeforeOpeningTheNewPerson() = runBlocking {
        val f = Fixture(); f.open(); val previous = f.family
        f.family = UUID.randomUUID().toString(); f.userId = 18; f.username = "ornek-depo"; f.call(f.erp, "put", f.ownErp())
        assertTrue(previous in f.familyClosed); assertFalse(f.family in f.familyClosed); assertTrue("1" in f.revoked); assertNull(f.values[f.crm])
        assertNotNull(f.call(f.crm, "get")); assertEquals(2, f.issued)
    }
    @Test fun changedUserOrMalformedRevisionCannotPublishAndKnownGrantIsClosed() = runBlocking {
        for (revision in listOf(false, true)) {
            val f = Fixture(); f.call(f.erp, "put", f.ownErp()); if (revision) f.invalidRevision = true else f.meIdentityChange = true
            assertTrue(runCatching { f.call(f.crm, "get") }.isFailure); assertNull(f.values[f.crm]); assertTrue("1" in f.revoked)
        }
    }
    @Test fun lateIssuerResponseAfterClearCannotPublishAndItsOwnGrantIsRevoked() = runBlocking {
        val f = Fixture(); f.call(f.erp, "put", f.ownErp()); val entered = CompletableDeferred<Unit>(); val release = CompletableDeferred<Unit>()
        f.beforeCall = { if (it == "/api/live/auth/terminal-handoff") { entered.complete(Unit); release.await() } }
        val pending = async { runCatching { f.call(f.crm, "get") } }; entered.await()
        val clearing = async(start = CoroutineStart.UNDISPATCHED) { f.call(f.erp, "clear") }; release.complete(Unit)
        assertTrue(pending.await().isFailure); clearing.await(); assertTrue("1" in f.revoked); assertNull(f.values[f.crm]); assertNull(f.values[f.erp])
    }
    @Test fun staleQueuedMutationCannotDeleteAReplacementRealm() = runBlocking {
        val f = Fixture(); f.open(); val epoch = f.core.invalidate(); f.core.invalidate()
        assertTrue(runCatching { f.core.execute(f.crm, WorkProtectedRequest("old", "clear", null), epoch) }.isFailure)
        assertNotNull(f.values[f.crm]); assertTrue(f.revoked.isEmpty())
    }
    @Test fun transientReadFailureDoesNotPublishOrDestroyExistingRememberedFamily() = runBlocking {
        val f = Fixture(); val saved = f.open(); f.crmMeFailure = 503
        assertTrue(runCatching { f.call(f.crm, "get") }.isFailure); assertEquals(saved.toString(), f.values[f.crm]); assertTrue(f.revoked.isEmpty())
        f.crmMeFailure = 0; assertEquals(saved, f.call(f.crm, "get")); assertEquals(1, f.issued)
    }
    @Test fun missingErpFamilyOrWrongOwnPairCannotCreateCrmSession() = runBlocking {
        val f = Fixture(); assertTrue(runCatching { f.call(f.crm, "get") }.isFailure); assertEquals(0, f.issued)
        val wrong = JsonObject(f.ownErp() + ("userId" to JsonPrimitive("18")))
        assertTrue(runCatching { f.call(f.erp, "put", wrong) }.isFailure); assertNull(f.values[f.erp]); assertEquals(0, f.issued)
    }
}
