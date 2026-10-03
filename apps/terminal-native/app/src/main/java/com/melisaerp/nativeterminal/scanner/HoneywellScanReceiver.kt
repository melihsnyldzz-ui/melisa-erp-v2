package com.melisaerp.nativeterminal.scanner

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** DCS constructs an explicit ComponentName when DPR_DATA_INTENT_PACKAGE_NAME is set. */
class HoneywellScanReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action?.startsWith(context.packageName + ".HONEYWELL_SCAN.") != true) return
        val value = runCatching {
            validatedHoneywellBarcode(intent.getIntExtra("version", 0), intent.getStringExtra("data"))
        }.getOrNull() ?: return
        foreground.deliver(intent.action, value)
    }

    internal companion object {
        val foreground = ForegroundScanDelivery()
    }
}
