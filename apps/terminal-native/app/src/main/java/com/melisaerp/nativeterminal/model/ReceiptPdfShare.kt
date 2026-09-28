package com.melisaerp.nativeterminal.model

import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel
import kotlinx.serialization.Serializable
import java.net.URI
import java.time.Instant

@Serializable data class ReceiptPdfShare(val url: String, val expiresAt: String, val documentNumber: String)

val Draft.canSharePdf: Boolean get() = state == DraftState.COMPLETED &&
    receipt?.let { it.invoiceId > 0 && it.status == "FINALIZED" && it.documentNumber.isNotBlank() } == true

// A share is transient display state. It is never saved in the draft or session vault.
class ReceiptQr internal constructor(val size: Int, private val cells: BooleanArray) {
    fun dark(x: Int, y: Int) = cells[y * size + x]
}

internal fun receiptQr(value: String): ReceiptQr {
    require(value.isNotBlank() && value.length <= 2048) { "PDF bağlantısı geçersiz." }
    val matrix = QRCodeWriter().encode(value, BarcodeFormat.QR_CODE, 0, 0, mapOf(
        EncodeHintType.CHARACTER_SET to "UTF-8",
        EncodeHintType.ERROR_CORRECTION to ErrorCorrectionLevel.M,
        EncodeHintType.MARGIN to 4,
    ))
    return ReceiptQr(matrix.width, BooleanArray(matrix.width * matrix.height) { index -> matrix[index % matrix.width, index / matrix.width] })
}

internal fun validatePdfShare(share: ReceiptPdfShare, settings: Settings, now: Long): Long {
    // Never allow an ERP response to turn the QR into a credential-bearing or foreign link.
    val invalid = "PDF bağlantısı doğrulanamadı. Yeniden deneyin."
    val uri = runCatching { URI(share.url) }.getOrNull() ?: throw IllegalArgumentException(invalid)
    val base = runCatching { URI(settings.apiUrl) }.getOrNull() ?: throw IllegalArgumentException(invalid)
    fun port(value: URI) = if (value.port >= 0) value.port else if (value.scheme == "https") 443 else 80
    require(share.url.length <= 2048 && uri.scheme in setOf("http", "https") && uri.scheme == base.scheme &&
        !uri.host.isNullOrBlank() && uri.host.equals(base.host, ignoreCase = true) && port(uri) == port(base) &&
        uri.host !in setOf("localhost", "127.0.0.1", "::1", "[::1]") &&
        uri.userInfo == null && uri.query == null && uri.fragment == null &&
        uri.path.matches(Regex("/native-receipts/[A-Za-z0-9_-]{43}\\.pdf")) &&
        share.documentNumber.isNotBlank()) { invalid }
    val expiry = runCatching { Instant.parse(share.expiresAt).toEpochMilli() }.getOrNull() ?: throw IllegalArgumentException(invalid)
    require(expiry > now && expiry - now <= 15 * 60_000L) { "PDF bağlantısının süresi dolmuş. Yeniden deneyin." }
    return expiry
}
