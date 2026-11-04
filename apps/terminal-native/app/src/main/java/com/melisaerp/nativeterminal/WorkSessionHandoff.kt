package com.melisaerp.nativeterminal

import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.*
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64
import java.util.UUID
import java.util.concurrent.atomic.AtomicLong

internal class WorkHandoffError(val status: Int = 403, val code: String = "TERMINAL_HANDOFF_INVALID") : Exception("Oturum bağlantısı doğrulanamadı.")
internal fun interface WorkHandoffTransport {
    suspend fun call(realm: String, path: String, body: JsonObject?, access: String?): JsonObject
}

/** The Activity owns the existing serial vault mutex. Invalidation occurs at
 * message receipt, before waiting for that mutex, so late replies cannot publish.
 * All durable values use the existing Keystore vault; none enter URL/parent JS.
 */
internal class WorkSessionHandoff(
    private val origin: String,
    private val read: suspend (String) -> String?,
    private val write: suspend (String, String?) -> Unit,
    private val transport: WorkHandoffTransport,
    private val now: () -> Long = System::currentTimeMillis,
    private val random: () -> String = { ByteArray(32).also { SecureRandom().nextBytes(it) }.let { Base64.getUrlEncoder().withoutPadding().encodeToString(it) } },
) {
    init { require(origin in setOf("http://127.0.0.1:5244", "http://192.168.1.46:5244")) }
    private val erp = "protected-work-session:erp:$origin"
    private val crmOrigin = origin.replace(":5244", ":62800")
    private val crm = "protected-work-session:crm:$crmOrigin"
    private val erpMeta = "$erp:verified-family"
    private val crmMeta = "$crm:verified-link"
    private val pendingErp = "$erp:pending-close"
    private val pendingCrm = "$crm:pending-close"
    private val device = "$erp:device"
    private val generation = AtomicLong()
    fun epoch(): Long = generation.get()
    fun invalidate(): Long = generation.incrementAndGet()
    private fun current(epoch: Long) { if (generation.get() != epoch) throw WorkHandoffError(409, "TERMINAL_HANDOFF_REPLACED") }
    private fun JsonObject.text(key: String) = (get(key) as? JsonPrimitive)?.takeIf { it.isString }?.content ?: throw WorkHandoffError()
    private fun JsonObject.number(key: String) = (get(key) as? JsonPrimitive)?.takeIf { !it.isString }?.longOrNull ?: throw WorkHandoffError()
    private fun objectOf(raw: String) = Json.parseToJsonElement(raw).jsonObject
    private fun record(raw: String): JsonObject = parseWorkProtectedRequest("""{"v":1,"id":"native_read","action":"put","session":$raw}""").session!!
    private fun recordFrom(result: JsonObject): JsonObject {
        val user = result["user"]?.jsonObject ?: throw WorkHandoffError()
        return record(buildJsonObject {
            put("accessToken", result.text("accessToken")); put("refreshToken", result.text("refreshToken"))
            put("userId", user.text("id")); put("username", user.text("username")); put("expiresAt", result.number("expiresAt"))
        }.toString())
    }
    private fun sameUser(saved: JsonObject, user: JsonObject) {
        if (user.text("id") != saved.text("userId") || user.text("username") != saved.text("username")) throw WorkHandoffError()
    }
    private fun sameErp(a: JsonObject, b: JsonObject) = a == b
    private suspend fun erpProof(saved: JsonObject): JsonObject {
        val result = transport.call("erp", "/api/auth/session-confirm", buildJsonObject { put("refreshToken", saved.text("refreshToken")) }, saved.text("accessToken"))
        val user = result["user"]?.jsonObject ?: throw WorkHandoffError()
        val id = user.number("id")
        val sid = result.text("normalTestSessionId")
        if (result["confirmed"] != JsonPrimitive(true) || id < 1 || id.toString() != saved.text("userId") || user.text("username") != saved.text("username") || result.number("expiresAt") <= now() || !sid.matches(UUID_V4)) throw WorkHandoffError()
        return buildJsonObject { put("userId", id.toString()); put("username", user.text("username")); put("sid", sid) }
    }
    private fun identity(user: JsonObject, erpFamily: JsonObject): JsonObject {
        val value = user["terminalIdentity"]?.jsonObject ?: throw WorkHandoffError()
        if (value.keys != IDENTITY_FIELDS || value.number("version") != 1L || value.text("environmentId") != ENVIRONMENT || value.text("database") != DATABASE || value.text("erpOrigin") != origin || value.text("crmOrigin") != crmOrigin || value.number("erpUserId").toString() != erpFamily.text("userId") || value.text("erpNormalSessionId") != erpFamily.text("sid") || !value.text("erpNormalSessionId").matches(UUID_V4) || value.text("crmUserId") != user.text("id") || value.number("chatwootAgentId") < 1 || value.number("chatwootAgentId") != user.number("chatwootAgentId") || !value.text("bindingRevision").matches(Regex("[a-f0-9]{64}")) || value.number("expiresAt") <= now() || value.number("expiresAt") > now() + 31000 || user.text("role") != "personel" || user["normalRefreshSession"] != JsonPrimitive(true) || listOf("testAdmin", "testPersonnel", "canAssign").any { user[it] == JsonPrimitive(true) }) throw WorkHandoffError()
        val permissions = user["permissions"]?.jsonArray?.map { it.jsonPrimitive.takeIf { v -> v.isString }?.content ?: throw WorkHandoffError() } ?: throw WorkHandoffError()
        if ("crm.view" !in permissions || permissions.any { it !in setOf("crm.view", "crm.send") }) throw WorkHandoffError()
        return value
    }
    private fun identityKey(value: JsonObject) = JsonObject(value.filterKeys { it != "expiresAt" })
    private suspend fun flush(key: String, realm: String) {
        val saved = read(key)?.let(::record) ?: return
        val result = transport.call(realm, if (realm == "erp") "/api/auth/logout" else "/api/live/auth/logout", buildJsonObject { put("refreshToken", saved.text("refreshToken")) }, null)
        if (result["loggedOut"] != JsonPrimitive(true)) throw WorkHandoffError(503, "TERMINAL_HANDOFF_CLOSE_UNCONFIRMED")
        write(key, null)
    }
    private suspend fun pending() { flush(pendingCrm, "crm"); flush(pendingErp, "erp") }
    private suspend fun closeCrm() {
        read(crm)?.let { if (read(pendingCrm) != null) throw WorkHandoffError(503); write(pendingCrm, it) }
        write(crm, null); write(crmMeta, null)
        flush(pendingCrm, "crm")
    }
    private suspend fun closeErp() {
        read(erp)?.let { if (read(pendingErp) != null) throw WorkHandoffError(503); write(pendingErp, it) }
        write(erp, null); write(erpMeta, null)
        closeCrm(); flush(pendingErp, "erp")
    }
    private suspend fun deviceBinding(): String {
        val seed = read(device) ?: random().also { require(it.matches(OPAQUE)); write(device, it) }
        require(seed.matches(OPAQUE))
        return MessageDigest.getInstance("SHA-256").digest(seed.toByteArray()).joinToString("") { "%02x".format(it.toInt() and 255) }
    }
    private suspend fun crmMe(saved: JsonObject, family: JsonObject): Pair<JsonObject, JsonObject> {
        val me = transport.call("crm", "/api/live/auth/me", null, saved.text("accessToken"))
        sameUser(saved, me)
        return me to identity(me, family)
    }
    private suspend fun saveCrm(saved: JsonObject, verified: JsonObject, epoch: Long) {
        current(epoch); write(crm, saved.toString()); write(crmMeta, verified.toString()); current(epoch)
    }

    suspend fun execute(key: String, request: WorkProtectedRequest, epoch: Long): JsonObject? {
        require(key == erp || key == crm)
        current(epoch); pending(); current(epoch)
        if (request.action == "clear") {
            if (key == erp) closeErp() else closeCrm()
            current(epoch); return null
        }
        if (key == erp) {
            if (request.action == "get") return read(erp)?.let(::record).also { current(epoch) }
            val incoming = request.session!!
            val verified = erpProof(incoming); current(epoch)
            val before = read(erpMeta)?.let(::objectOf)
            if (before == null || !sameErp(before, verified)) { closeErp(); current(epoch) }
            write(erp, incoming.toString()); write(erpMeta, verified.toString()); current(epoch)
            return null
        }
        val family = read(erpMeta)?.let(::objectOf) ?: throw WorkHandoffError()
        if (read(erp) == null) throw WorkHandoffError()
        if (request.action == "put") {
            val incoming = request.session!!
            val (_, verified) = crmMe(incoming, family); current(epoch)
            val before = read(crmMeta)?.let(::objectOf)
            if (before == null || identityKey(before) != identityKey(verified)) throw WorkHandoffError()
            saveCrm(incoming, verified, epoch); return null
        }
        var issued = false
        try {
            var saved = read(crm)?.let(::record)
            var pinned = read(crmMeta)?.let(::objectOf)
            if (saved != null && pinned == null) { closeCrm(); saved = null }
            if (saved == null) {
                val own = read(erp)?.let(::record) ?: throw WorkHandoffError()
                val verifier = random(); require(verifier.matches(OPAQUE))
                val requestId = UUID.randomUUID().toString()
                val binding = deviceBinding()
                val audience = buildJsonObject { put("requestId", requestId); put("deviceBinding", binding); put("erpOrigin", origin); put("crmOrigin", crmOrigin) }
                val prepared = transport.call("erp", "/api/auth/terminal-handoff/prepare", buildJsonObject {
                    audience.forEach { (k, v) -> put(k, v) }; put("refreshToken", own.text("refreshToken"))
                    put("codeChallenge", Base64.getUrlEncoder().withoutPadding().encodeToString(MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray())))
                }, own.text("accessToken"))
                current(epoch)
                if (prepared.number("version") != 1L || prepared.text("requestId") != requestId || prepared.number("expiresAt") <= now() || prepared.number("expiresAt") > now() + 31000 || !prepared.text("code").matches(OPAQUE)) throw WorkHandoffError()
                val result = transport.call("crm", "/api/live/auth/terminal-handoff", buildJsonObject {
                    audience.forEach { (k, v) -> put(k, v) }; put("code", prepared.text("code")); put("codeVerifier", verifier)
                }, null)
                saved = recordFrom(result); issued = true
                // Persist the own new grant before another suspend point, so a
                // known late response can always close only that own family.
                write(crm, saved.toString())
                current(epoch)
                pinned = identity(result["user"]!!.jsonObject, family)
                write(crmMeta, pinned.toString())
            }
            current(epoch)
            var active = saved ?: throw WorkHandoffError()
            if (active.number("expiresAt") <= now() + 60000) {
                val beforeRotation = active
                val result = transport.call("crm", "/api/live/auth/refresh", buildJsonObject { put("refreshToken", beforeRotation.text("refreshToken")) }, null)
                val rotated = recordFrom(result); sameUser(active, result["user"]!!.jsonObject)
                val verified = identity(result["user"]!!.jsonObject, family)
                if (pinned == null || identityKey(pinned) != identityKey(verified)) throw WorkHandoffError()
                active = rotated; saveCrm(active, verified, epoch); pinned = verified
            }
            val (_, fresh) = crmMe(active, family); current(epoch)
            if (pinned == null || identityKey(pinned) != identityKey(fresh)) throw WorkHandoffError()
            write(crmMeta, fresh.toString()); current(epoch)
            return active
        } catch (error: Throwable) {
            if (issued || generation.get() != epoch || error is WorkHandoffError && error.status in setOf(401, 403)) {
                withContext(NonCancellable) { closeCrm() }
            }
            throw error
        }
    }
    companion object {
        private const val ENVIRONMENT = "e662fd94-d797-4b3b-938a-d143ad758b67"
        private const val DATABASE = "MELISA_ERP_CLEAN_TEST_20261022"
        private val UUID_V4 = Regex("[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}", RegexOption.IGNORE_CASE)
        private val OPAQUE = Regex("[A-Za-z0-9_-]{43}")
        private val IDENTITY_FIELDS = setOf("version", "environmentId", "database", "erpOrigin", "crmOrigin", "erpUserId", "erpNormalSessionId", "crmUserId", "chatwootAgentId", "bindingRevision", "expiresAt")
    }
}
