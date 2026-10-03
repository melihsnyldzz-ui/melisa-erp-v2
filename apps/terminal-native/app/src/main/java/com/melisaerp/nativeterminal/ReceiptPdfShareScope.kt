package com.melisaerp.nativeterminal

import com.melisaerp.nativeterminal.model.*

internal data class PdfShareRequestKey(val requestId: Long, val owner: String, val screen: Screen, val draft: Draft)

// A dismissed dialog, changed personnel, screen or receipt must not receive a late response.
internal fun pdfShareStillVisible(key: PdfShareRequestKey, currentRequest: Long?, owner: String,
    screen: Screen, group: ReceiptGroup, draft: Draft?): Boolean =
    currentRequest == key.requestId && owner == key.owner && screen == key.screen &&
        (screen == Screen.SALE || (screen == Screen.RECEIPTS && group == ReceiptGroup.SENT)) &&
        draft != null && draft == key.draft && draft.owner == owner && draft.canSharePdf
