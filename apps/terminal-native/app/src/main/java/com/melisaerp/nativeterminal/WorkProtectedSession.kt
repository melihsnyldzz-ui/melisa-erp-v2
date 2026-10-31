package com.melisaerp.nativeterminal

import kotlinx.serialization.json.*

/** The WebView reports the caller origin; JavaScript cannot select a realm. */
internal class WorkProtectedSessionPolicy(private val erpOrigin: String) {
    init { require(erpOrigin in WorkTasksContract.ORIGINS) }
    val crmOrigin = WorkTasksContract(erpOrigin).crmOrigin
    val origins = setOf(erpOrigin, crmOrigin)
    fun key(origin: String, mainFrame: Boolean, topUrl: String): String? {
        if (!WorkTasksContract(erpOrigin).allowedRequest(topUrl, true)) return null
        return when {
            origin == erpOrigin && mainFrame -> "protected-work-session:erp:$erpOrigin"
            origin == crmOrigin && !mainFrame -> "protected-work-session:crm:$crmOrigin"
            else -> null
        }
    }
}

internal data class WorkProtectedRequest(val id: String, val action: String, val session: JsonObject?)
internal fun parseWorkProtectedRequest(raw: String): WorkProtectedRequest {
    require(raw.length <= 20000)
    val data = Json.parseToJsonElement(raw).jsonObject
    require(data.keys.all { it in setOf("v", "id", "action", "session") })
    require(data["v"]?.jsonPrimitive?.intOrNull == 1)
    val id = data["id"]?.jsonPrimitive?.content.orEmpty()
    require(id.matches(Regex("[A-Za-z0-9_-]{1,80}")))
    val action = data["action"]?.jsonPrimitive?.content
    require(action in setOf("get", "put", "clear"))
    val session = if (action == "put") data["session"]?.jsonObject else null
    if (action == "put") {
        require(session != null && session.keys == setOf("accessToken", "refreshToken", "userId", "username", "expiresAt"))
        for (field in listOf("accessToken", "refreshToken", "userId", "username")) {
            val value = session[field]?.jsonPrimitive
            require(value?.isString == true)
            val text = value.content
            require(text.isNotBlank() && text.length <= (if (field.endsWith("Token")) 8192 else 160) && text.none(Char::isISOControl))
        }
        require((session["expiresAt"]?.jsonPrimitive?.longOrNull ?: 0L) in 1..9007199254740991L)
    } else require(!data.containsKey("session"))
    return WorkProtectedRequest(id, action!!, session)
}

internal fun protectedSessionReply(id: String, ok: Boolean, session: JsonElement? = null): String = buildJsonObject {
    put("v", 1); put("id", id); put("ok", ok); put("session", session ?: JsonNull)
}.toString()
