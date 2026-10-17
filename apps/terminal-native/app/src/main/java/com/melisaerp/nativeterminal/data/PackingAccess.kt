package com.melisaerp.nativeterminal.data

import com.melisaerp.nativeterminal.model.Bootstrap

// A valid personnel session may use packing without being authorized to sell.
// A separate authenticated packing read must succeed before accepting that mode.
internal suspend fun salesOrPackingBootstrap(sales: suspend () -> Bootstrap, packing: suspend () -> Unit): Bootstrap? = try {
    sales()
} catch (error: ApiFailure) {
    if (error.status != 403 || error.code !in setOf("AUTH_PERMISSION_DENIED", "TERMINAL_EMPLOYEE_SALE_RESTRICTED")) throw error
    packing()
    null
}
