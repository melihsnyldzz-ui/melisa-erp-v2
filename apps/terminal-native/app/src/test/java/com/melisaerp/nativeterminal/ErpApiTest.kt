package com.melisaerp.nativeterminal

import com.melisaerp.nativeterminal.data.ErpApi
import com.melisaerp.nativeterminal.data.ApiFailure
import com.melisaerp.nativeterminal.model.Settings
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.jsonArray
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.SocketPolicy
import org.junit.Assert.*
import org.junit.Test
import java.io.IOException
import java.util.concurrent.TimeUnit

class ErpApiTest {
    private suspend fun response(body: String, status: Int = 200) = MockWebServer().use { server ->
        server.enqueue(MockResponse().setResponseCode(status).setBody(body))
        server.start(java.net.InetAddress.getByName("127.0.0.1"), 0)
        ErpApi().request(Settings("http://127.0.0.1:${server.port}", "TEST"), "/native-terminal/bootstrap")
    }

    @Test fun htmlGatewayErrorKeepsHttpStatusAndNeverShowsResponseBody() = runBlocking {
        try {
            response("<html>private gateway diagnostic</html>", 502)
            fail("Gateway error must reach offline handling")
        } catch (e: ApiFailure) {
            assertEquals(502, e.status)
            assertFalse(e.saleRejectedBeforeCommit)
            assertFalse(e.message.contains("private gateway"))
        }
    }

    @Test fun emptyUnauthorizedResponseNeverAuthorizesAutomaticRetry() = runBlocking {
        try {
            response("", 401)
            fail("Authentication status must survive an empty response")
        } catch (e: ApiFailure) {
            assertEquals(401, e.status)
            assertFalse(e.canRefreshSession)
            assertFalse(e.saleRejectedBeforeCommit)
        }
    }

    @Test fun invalidSuccessResponsesAreConnectionFailures() = runBlocking {
        for (body in listOf("", "<html>proxy login</html>", "[]", "null", "{", "{}")) {
            try {
                response(body)
                fail("An invalid ERP envelope must not be accepted: $body")
            } catch (e: IOException) {
                assertFalse("Unknown results must not unlock a submitted sale", e is ApiFailure && e.saleRejectedBeforeCommit)
            }
        }
    }

    @Test fun validSuccessEnvelopePreservesProductArray() = runBlocking {
        assertEquals(0, response("{\"success\":true,\"data\":[]}").jsonArray.size)
    }

    @Test fun wrongManagerPasswordDoesNotExpireOrRefreshOperatorSession() = runBlocking {
        try {
            response("{\"success\":false,\"error\":{\"code\":\"AUTH_INVALID_CREDENTIALS\",\"message\":\"Wrong manager password\"}}", 401)
            fail("Wrong manager credentials must be rejected")
        } catch (e: ApiFailure) {
            assertFalse("Do not replay the manager approval POST", e.canRefreshSession)
            assertFalse("Keep the operator signed in", e.sessionRejected)
            assertFalse(e.saleRejectedBeforeCommit)
        }
    }

    @Test fun expiredAccessTokenAllowsRefreshAfterMiddlewareRejection() = runBlocking {
        try {
            response("{\"success\":false,\"error\":{\"code\":\"AUTH_TOKEN_EXPIRED\",\"message\":\"Expired\"}}", 401)
            fail("Expired operator access token must be rejected")
        } catch (e: ApiFailure) {
            assertTrue(e.canRefreshSession)
            assertTrue(e.sessionRejected)
            assertTrue(e.saleRejectedBeforeCommit)
        }
    }

    @Test fun inactiveOperatorRequiresLoginWithoutAutomaticRefresh() {
        val failure = ApiFailure(401, "AUTH_USER_INACTIVE", "Inactive")
        assertFalse(failure.canRefreshSession)
        assertTrue(failure.sessionRejected)
        assertTrue(failure.saleRejectedBeforeCommit)
    }

    @Test fun unknownCancellationErrorCannotRestoreCompletedReceipt() = runBlocking {
        for (status in listOf(401, 404, 409, 429)) {
            try {
                response("<html>gateway</html>", status)
                fail("Expected rejection")
            } catch (e: ApiFailure) { assertFalse(e.cancelRejectedBeforeCommit) }
        }
        assertFalse(ApiFailure(409, "NATIVE_RECEIPT_REVIEW", "Review").cancelRejectedBeforeCommit)
        assertFalse(ApiFailure(503, "NATIVE_COMMIT_UNCONFIRMED", "Unknown commit").cancelRejectedBeforeCommit)
    }
    @Test fun explicitManagerRejectionRestoresReceiptWithoutLoggingOutOperator() {
        for ((status, code) in listOf(401 to "AUTH_INVALID_CREDENTIALS", 400 to "AUTH_CREDENTIALS_REQUIRED", 403 to "NATIVE_APPROVAL_PERMISSION")) {
            val failure = ApiFailure(status, code, "Rejected before cancellation")
            assertTrue(failure.cancelRejectedBeforeCommit)
            assertFalse(failure.sessionRejected)
            assertFalse(failure.canRefreshSession)
        }
    }

    @Test fun lostPostResponseNeverAutomaticallyRepeatsCommercialRequest() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setSocketPolicy(SocketPolicy.DISCONNECT_AFTER_REQUEST))
            server.enqueue(MockResponse().setBody("{\"success\":true,\"data\":{}}"))
            server.start(java.net.InetAddress.getByName("127.0.0.1"), 0)
            val settings = Settings("http://127.0.0.1:${server.port}", "TEST")
            try {
                ErpApi().request(settings, "/native-terminal/sales/submit", "test-token", buildJsonObject { put("id", "test-id") })
                fail("A lost response must stay uncertain")
            } catch (_: IOException) { }
            assertEquals("POST", server.takeRequest(1, TimeUnit.SECONDS)!!.method)
            assertNull("A commercial POST must not be retried", server.takeRequest(400, TimeUnit.MILLISECONDS))
            assertEquals(1, server.requestCount)
        }
    }
}
