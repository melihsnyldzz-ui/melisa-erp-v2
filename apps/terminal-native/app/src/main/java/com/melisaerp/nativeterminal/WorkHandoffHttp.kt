package com.melisaerp.nativeterminal

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.*
import okhttp3.CookieJar
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

/** Fixed clean TEST transport. No redirects, cookies, peer key, interceptor,
 * automatic HTTP replay, arbitrary URL or credential logging is supported. */
internal class WorkHandoffHttp(private val origin: String) : WorkHandoffTransport {
    init { require(origin in setOf("http://127.0.0.1:5244", "http://192.168.1.46:5244")) }
    private val erpApi = if (origin == "http://127.0.0.1:5244") "http://127.0.0.1:4194" else origin
    private val crmApi = origin.replace(":5244", ":62800")
    private val client = OkHttpClient.Builder().followRedirects(false).followSslRedirects(false)
        .retryOnConnectionFailure(false).cookieJar(CookieJar.NO_COOKIES)
        .callTimeout(3, TimeUnit.SECONDS).connectTimeout(2, TimeUnit.SECONDS).readTimeout(3, TimeUnit.SECONDS).build()
    override suspend fun call(realm: String, path: String, body: JsonObject?, access: String?): JsonObject = withContext(Dispatchers.IO) {
        val allowed = if (realm == "erp") setOf("/api/auth/session-confirm", "/api/auth/terminal-handoff/prepare", "/api/auth/logout")
            else if (realm == "crm") setOf("/api/live/auth/terminal-handoff", "/api/live/auth/me", "/api/live/auth/refresh", "/api/live/auth/logout") else emptySet()
        require(path in allowed && (body == null) == (path == "/api/live/auth/me"))
        val bytes = body?.toString(); require(bytes == null || bytes.toByteArray().size <= 32768)
        val request = Request.Builder().url((if (realm == "erp") erpApi else crmApi) + path)
            .header("Accept", "application/json").header("Cache-Control", "no-store")
        if (access != null) { require(access.isNotBlank() && access.length <= 8192 && access.none(Char::isISOControl)); request.header("Authorization", "Bearer $access") }
        if (bytes != null) request.post(bytes.toRequestBody("application/json".toMediaType()))
        try {
            client.newCall(request.build()).execute().use { response ->
                val responseBody = response.body ?: throw WorkHandoffError(503)
                if (responseBody.contentLength() > 65536) throw WorkHandoffError(503)
                val source = responseBody.source(); source.request(65537)
                if (source.buffer.size > 65536) throw WorkHandoffError(503)
                val payload = Json.parseToJsonElement(source.readUtf8()).jsonObject
                if (!response.isSuccessful || payload["success"] != JsonPrimitive(true)) {
                    val code = if (payload["error"]?.jsonObject?.get("code") == JsonPrimitive("AUTH_TOKEN_EXPIRED")) "AUTH_TOKEN_EXPIRED" else "TERMINAL_HANDOFF_INVALID"
                    throw WorkHandoffError(response.code, code)
                }
                payload["data"]?.jsonObject ?: throw WorkHandoffError(503)
            }
        } catch (error: WorkHandoffError) { throw error }
        catch (_: Exception) { throw WorkHandoffError(503) }
    }
}
