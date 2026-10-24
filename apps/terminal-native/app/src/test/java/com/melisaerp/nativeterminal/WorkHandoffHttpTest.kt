package com.melisaerp.nativeterminal

import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.Assert.assertTrue
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class WorkHandoffHttpTest {
    @Test fun actualRequestsUseOnlyTheirFixedSameOriginAndKeepErpCredentialsOutOfCrm() {
        for (origin in listOf("http://127.0.0.1:5244", "http://192.168.1.46:5244")) {
            val client = WorkHandoffHttp(origin)
            val erp = client.requestFor("erp", "/api/auth/terminal-handoff/prepare", buildJsonObject { put("refreshToken", "own-erp-refresh") }, "own-erp-access")
            assertEquals(origin, erp.header("Origin")); assertEquals("Bearer own-erp-access", erp.header("Authorization"))
            val crm = client.requestFor("crm", "/api/live/auth/terminal-handoff", buildJsonObject { put("code", "one-use-code") }, null)
            assertEquals(origin.replace(":5244", ":62800"), crm.header("Origin")); assertNull(crm.header("Authorization")); assertNull(crm.header("Cookie"))
            assertTrue(crm.url.toString().startsWith(origin.replace(":5244", ":62800")))
            assertNull(crm.header("x-melisa-terminal-peer"))
        }
    }
    @Test fun arbitraryTargetsPeerRpcQueriesAndWrongMethodsFailBeforeAnyHttp() = runBlocking {
        assertTrue(runCatching { WorkHandoffHttp("http://192.168.1.46:5234") }.isFailure)
        val client = WorkHandoffHttp("http://127.0.0.1:5244")
        for ((realm, path) in listOf("erp" to "/api/auth/terminal-handoff/redeem", "erp" to "/api/auth/login", "crm" to "/api/live/auth/me?userId=other", "unknown" to "/api/live/auth/logout", "crm" to "http://other/api/live/auth/me")) {
            assertTrue(runCatching { client.call(realm, path, buildJsonObject {}, null) }.isFailure)
        }
        assertTrue(runCatching { client.call("crm", "/api/live/auth/me", buildJsonObject {}, null) }.isFailure)
        assertTrue(runCatching { client.call("erp", "/api/auth/logout", buildJsonObject { put("refreshToken", "fixture") }, "unsafe\nheader") }.isFailure)
    }
}
