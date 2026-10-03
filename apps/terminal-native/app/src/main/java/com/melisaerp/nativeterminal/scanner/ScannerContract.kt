package com.melisaerp.nativeterminal.scanner

enum class ScannerProvider { DATA_WEDGE, HONEYWELL, NEWLAND }

fun scannerProvider(manufacturer: String): ScannerProvider =
    if (manufacturer.trim().equals("Honeywell", ignoreCase = true)) ScannerProvider.HONEYWELL
    else if (manufacturer.trim().equals("Newland", ignoreCase = true)) ScannerProvider.NEWLAND
    else ScannerProvider.DATA_WEDGE

/** Barcode contents remain text: leading zeroes, case and punctuation are significant. */
fun validatedHoneywellBarcode(version: Int, raw: String?): String? {
    if (version < 1) return null
    val value = raw?.trim().orEmpty()
    return value.takeIf { it.isNotEmpty() && it.length <= 160 && it.none(Char::isISOControl) }
}

/** Newland reports success explicitly; never repair or reinterpret a barcode's contents. */
fun validatedNewlandBarcode(state: String?, raw: String?): String? {
    if (state != "ok") return null
    val value = raw?.trim().orEmpty()
    return value.takeIf { it.isNotEmpty() && it.length <= 160 && it.none(Char::isISOControl) }
}
