package com.melisaerp.nativeterminal.scanner

import android.content.Context
import android.os.Build
import com.melisaerp.nativeterminal.model.UiPreferences

/** Keeps each vendor's scanner ownership tied to its supported activity lifecycle. */
interface BarcodeScanner {
    fun onStart() {}
    fun onResume() {}
    fun onPause() {}
    fun onStop() {}
    fun trigger()
    fun close()
}

fun createBarcodeScanner(
    context: Context,
    onScan: (String) -> Unit,
    onStatus: (String) -> Unit,
    preferences: () -> UiPreferences,
): BarcodeScanner = when (scannerProvider(Build.MANUFACTURER)) {
    ScannerProvider.HONEYWELL -> HoneywellScanner(context, onScan, onStatus, preferences)
    ScannerProvider.NEWLAND -> NewlandScanner(context, onScan, onStatus, preferences)
    ScannerProvider.DATA_WEDGE -> object : BarcodeScanner {
        private val delegate = DataWedge(context, onScan, onStatus, preferences)
        override fun onStart() = delegate.start()
        override fun onStop() = delegate.stop()
        override fun trigger() = delegate.trigger()
        override fun close() = delegate.close()
    }
}
