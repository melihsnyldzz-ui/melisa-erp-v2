package com.melisaerp.nativeterminal

import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.Assert.assertTrue
import org.junit.Test

class WorkHandoffHttpTest {
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
