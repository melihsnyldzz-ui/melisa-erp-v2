package com.melisaerp.nativeterminal.data

import com.melisaerp.nativeterminal.model.*

internal fun packingStorageKey(settings: Settings, id: Long) =
    "packing-sales-invoice-v1:${settings.apiUrl}|${settings.terminalCode}:$id"

internal fun packingListMark(receipt: PickingOrder, saved: PickingProgress?, verifiedRevision: String? = null): String? {
    if (saved == null || receipt.status != "FINALIZED" || !saved.order.isPackable || saved.order.id != receipt.id) return null
    val hasCount = saved.counts.values.any { it.toBigDecimalOrNull()?.signum() == 1 }
    if (!hasCount && saved.confirmedAt == null) return null
    if ((receipt.documentVersion.isBlank() || saved.order.documentVersion != receipt.documentVersion) && verifiedRevision != saved.order.revision)
        return if (saved.packingStatus == "PACKING_EXCEPTION") "PACKING_EXCEPTION · Fişi yeniden kontrol edin" else "Fiş değişmiş · kontrol edin"
    return when (saved.packingStatus) {
        "PACKED" -> "Paketlendi"
        "PACKING_EXCEPTION" -> "PACKING_EXCEPTION · Adet farkı var"
        "REVIEW_REQUIRED" -> "Adet farkı var · Yeniden kontrol gerekli"
        else -> "Devam ediliyor"
    }
}
