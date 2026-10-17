package com.melisaerp.nativeterminal.data

import com.melisaerp.nativeterminal.model.*
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.serialization.json.*
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.net.URI
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class ApiFailure(val status: Int, val code: String, override val message: String) : IOException(message) {
    // Only access-token failures from requireAuth may refresh and replay a request.
    // A manager's wrong password is a business-level 401, not an expired operator session.
    val canRefreshSession get() = status == 401 && code in setOf("AUTH_TOKEN_REQUIRED", "AUTH_TOKEN_EXPIRED", "AUTH_TOKEN_INVALID")
    val sessionRejected get() = status == 401 && (canRefreshSession || code in setOf(
        "AUTH_USER_INVALID", "AUTH_USER_INACTIVE", "AUTH_REFRESH_REQUIRED", "AUTH_REFRESH_INVALID"
    ))
    // These failures occur before nativeCancelSale starts its transaction.
    // Unknown gateway 4xx responses cannot prove that cancellation did not commit.
    val cancelRejectedBeforeCommit get() = sessionRejected || (status in 400..499 && code in setOf(
        "AUTH_INVALID_CREDENTIALS", "AUTH_CREDENTIALS_REQUIRED", "NATIVE_APPROVAL_PERMISSION"
    ))
    // Only explicit validation/authorization rejections may unlock a submitted draft.
    // Unknown outcomes, ownership conflicts and effects/commit failures stay frozen.
    val saleRejectedBeforeCommit get() = sessionRejected || (status in 400..499 && code in setOf(
        "NATIVE_ID_INVALID", "NATIVE_VALUE_INVALID", "NATIVE_IDENTITY_REQUIRED", "NATIVE_SALE_INVALID",
        "NATIVE_QUANTITY_INVALID", "NATIVE_AUDIT_INVALID", "NATIVE_AUDIT_OWNER", "NATIVE_QUOTE_OWNER",
        "NATIVE_RATE_REQUIRED", "NATIVE_PRICE_PERMISSION", "NATIVE_PRICE_AUDIT_REQUIRED",
        "NATIVE_SNAPSHOT_INVALID", "NATIVE_SNAPSHOT_UNTRUSTED", "NATIVE_SNAPSHOT_EXPIRED",
        "NATIVE_APPROVAL_CHANGED", "NATIVE_APPROVAL_REVOKED", "NATIVE_CUSTOMER_CHANGED", "NATIVE_PRODUCT_CHANGED",
        "NATIVE_CUSTOMER_ROUTE_DENIED", "NATIVE_DEVICE_SCOPE_MISMATCH"
    ))
}
class ErpApi {
    // OkHttp must never retry a commercial POST behind the journal's back.
    private val client = OkHttpClient.Builder().connectTimeout(3, TimeUnit.SECONDS).readTimeout(8, TimeUnit.SECONDS)
        .callTimeout(10, TimeUnit.SECONDS).retryOnConnectionFailure(false).followRedirects(false).followSslRedirects(false).build()
    // Read-only requests can recover a stale pooled connection after Wi-Fi/server loss.
    private val readClient = client.newBuilder().retryOnConnectionFailure(true).build()
    suspend fun request(settings: Settings, route: String, token: String? = null, body: JsonObject? = null): JsonElement {
        val base = validateUrl(settings.apiUrl)
        val builder = Request.Builder().url(base + "/api" + route).header("Accept", "application/json")
        if (!token.isNullOrBlank()) builder.header("Authorization", "Bearer $token")
        if (body != null) builder.post(body.toString().toRequestBody("application/json".toMediaType()))
        val call = (if (body == null) readClient else client).newCall(builder.build())
        return suspendCancellableCoroutine { continuation ->
            continuation.invokeOnCancellation { call.cancel() }
            call.enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) { if (continuation.isActive) continuation.resumeWithException(e) }
                override fun onResponse(call: Call, response: Response) {
                    try { response.use {
                        // Gateways may return HTML/empty bodies. Preserve the HTTP status even
                        // when JSON is missing, and never surface parser diagnostics/body text.
                        val data = try { codec.parseToJsonElement(it.body?.string().orEmpty()) as? JsonObject }
                            catch (_: kotlinx.serialization.SerializationException) { null }
                        val success = (data?.get("success") as? JsonPrimitive)?.booleanOrNull
                        if (!it.isSuccessful || success == false) {
                            val error = data?.get("error") as? JsonObject
                            throw ApiFailure(it.code, (error?.get("code") as? JsonPrimitive)?.contentOrNull ?: "API_ERROR",
                                (error?.get("message") as? JsonPrimitive)?.contentOrNull ?: "ERP isteği tamamlanamadı. Bağlantıyı kontrol edin.")
                        }
                        // An unknown response is not proof that a sale succeeded or failed.
                        if (success != true || data?.containsKey("data") != true) {
                            throw IOException("ERP yanıtı okunamadı. Bağlantıyı kontrol edin.")
                        }
                        if (continuation.isActive) continuation.resume(data.getValue("data"))
                    } } catch (e: Exception) { if (continuation.isActive) continuation.resumeWithException(e) }
                }
            })
        }
    }
    companion object {
        fun validateUrl(value: String): String {
            val uri = URI(value.trim().trimEnd('/'))
            require(uri.userInfo == null && uri.query == null && uri.fragment == null && uri.path.orEmpty() in listOf("", "/")) { "Yalnız ERP sunucu adresini girin." }
            val host = uri.host.orEmpty()
            val parts = host.split('.').mapNotNull { it.toIntOrNull() }
            val lan = host == "localhost" || host == "127.0.0.1" || (parts.size == 4 && parts.all { it in 0..255 } &&
                (parts[0] == 10 || (parts[0] == 192 && parts[1] == 168) || (parts[0] == 172 && parts[1] in 16..31)))
            require(uri.scheme == "https" || (uri.scheme == "http" && lan)) { "HTTPS veya yerel ağ ERP adresi gerekli." }
            require(host.isNotBlank()); return uri.toString().trimEnd('/')
        }
    }
}
