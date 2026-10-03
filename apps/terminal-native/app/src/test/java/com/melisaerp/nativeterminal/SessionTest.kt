package com.melisaerp.nativeterminal

import com.melisaerp.nativeterminal.model.Session
import com.melisaerp.nativeterminal.model.User
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.junit.Assert.*
import org.junit.Test

class SessionTest {
    private val original = Session("access-1", "test-refresh", User(8, "operator"))
    @Test fun refreshWithoutNewTokenSurvivesPersistenceAndRepeatedRenewal() {
        val response = Json.decodeFromString<Session>("""{"accessToken":"access-2","user":{"id":8,"username":"operator","permissions":["updated"]}}""")
        val persisted = Json.encodeToString(original.renewedBy(response))
        val restored = Json.decodeFromString<Session>(persisted)
        val next = restored.renewedBy(response.copy(accessToken = "access-3"))
        assertEquals("test-refresh", next.refreshToken)
        assertEquals("access-3", next.accessToken)
        assertEquals(listOf("updated"), next.user.permissions)
    }
    @Test fun serverRotatedRefreshTokenReplacesPreviousToken() {
        assertEquals("rotated", original.renewedBy(original.copy(refreshToken = "rotated")).refreshToken)
    }
    @Test(expected = IllegalStateException::class) fun renewalCannotSwitchPersonnel() {
        original.renewedBy(original.copy(user = User(9, "different")))
    }
}
