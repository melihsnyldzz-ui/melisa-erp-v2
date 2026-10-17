package com.melisaerp.nativeterminal.scanner

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.util.Log
import androidx.core.content.ContextCompat
import com.melisaerp.nativeterminal.model.UiPreferences

/** Newland Intent API. Output mode/action are provisioned once, never changed by activity lifecycle. */
class NewlandScanner(
    private val context: Context,
    private val onScan: (String) -> Unit,
    private val onStatus: (String) -> Unit,
    private val preferences: () -> UiPreferences,
) : BarcodeScanner {
    private val handler = Handler(Looper.getMainLooper())
    private var sessionOwner: Any? = null
    private var receiver: BroadcastReceiver? = null
    private var softScanning = false
    private var tone: ToneGenerator? = null
    private val stopTimeout = Runnable { stopSoftScan() }

    override fun onResume() {
        if (sessionOwner?.let(foreground::isOwner) == true) return
        release()
        // A new token and receiver also reject callbacks queued before pause/resume with the same action.
        val owner = Any()
        val scanReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                if (intent.action != RESULT_ACTION) return
                val value = runCatching {
                    validatedNewlandBarcode(intent.getStringExtra("SCAN_STATE"), intent.getStringExtra("SCAN_BARCODE1"))
                }.getOrNull() ?: return
                foreground.deliver(owner, intent.action, value)
            }
        }
        try {
            ContextCompat.registerReceiver(context, scanReceiver, IntentFilter(RESULT_ACTION), ContextCompat.RECEIVER_EXPORTED)
            receiver = scanReceiver
            sessionOwner = owner
            foreground.activate(owner, RESULT_ACTION, ::receive)
            onStatus("Newland tarayıcı · ilk okuma bekleniyor")
        } catch (_: Exception) {
            release()
            onStatus("Newland tarayıcı bağlantısı kurulamadı; uygulamayı yeniden açın")
        }
    }

    private fun receive(value: String) {
        val owner = sessionOwner ?: return
        if (!foreground.isOwner(owner)) return
        handler.removeCallbacks(stopTimeout)
        softScanning = false
        // Confirm delivery without recording product or customer data.
        Log.i("MelisaScanner", "Newland scanner data received")
        onStatus("Newland tarama verisi alındı")
        if (preferences().sound) runCatching {
            if (tone == null) tone = ToneGenerator(AudioManager.STREAM_NOTIFICATION, 55)
            tone?.startTone(ToneGenerator.TONE_PROP_BEEP, 55)
        }
        if (preferences().vibration) runCatching {
            context.getSystemService(Vibrator::class.java)?.vibrate(
                VibrationEffect.createOneShot(35, VibrationEffect.DEFAULT_AMPLITUDE))
        }
        onScan(value)
    }

    override fun trigger() {
        val owner = sessionOwner
        if (owner == null || !foreground.isOwner(owner)) {
            onStatus("Newland tarayıcı bağlantısı bekleniyor")
            return
        }
        if (softScanning) { stopSoftScan(); return }
        runCatching {
            context.sendBroadcast(Intent(ACTION_TRIGGER).putExtra("SCAN_TIMEOUT", 6))
            softScanning = true
            handler.postDelayed(stopTimeout, 6500)
        }.onFailure { onStatus("Newland tarama başlatılamadı") }
    }

    private fun stopSoftScan() {
        handler.removeCallbacks(stopTimeout)
        val owner = sessionOwner
        if (softScanning && owner != null && foreground.isOwner(owner)) {
            runCatching { context.sendBroadcast(Intent(ACTION_STOP)) }
        }
        softScanning = false
    }

    private fun release() {
        val owner = sessionOwner
        val scanReceiver = receiver
        val ownedSession = owner != null && foreground.release(owner)
        val wasSoftScanning = softScanning
        sessionOwner = null
        receiver = null
        softScanning = false
        handler.removeCallbacks(stopTimeout)
        // An old activity cannot stop the replacement's scanner. Hardware keys remain system-owned.
        if (ownedSession && wasSoftScanning) runCatching { context.sendBroadcast(Intent(ACTION_STOP)) }
        if (scanReceiver != null) runCatching { context.unregisterReceiver(scanReceiver) }
        tone?.release()
        tone = null
    }

    override fun onPause() = release()
    override fun onStop() = release()
    override fun close() = release()

    private companion object {
        val foreground = ForegroundScanDelivery()
        const val RESULT_ACTION = "com.melisaerp.nativeterminal.NEWLAND_SCAN"
        const val ACTION_TRIGGER = "nlscan.action.SCANNER_TRIG"
        const val ACTION_STOP = "nlscan.action.STOP_SCAN"
    }
}
