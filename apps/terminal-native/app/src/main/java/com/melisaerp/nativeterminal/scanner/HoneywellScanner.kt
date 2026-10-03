package com.melisaerp.nativeterminal.scanner

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.util.Log
import com.melisaerp.nativeterminal.model.UiPreferences
import java.util.UUID

/** Honeywell Data Collection Intent API; configuration lasts only for this foreground claim. */
class HoneywellScanner(
    private val context: Context,
    private val onScan: (String) -> Unit,
    private val onStatus: (String) -> Unit,
    private val preferences: () -> UiPreferences,
) : BarcodeScanner {
    private val owner = Any()
    private val foreground = HoneywellScanReceiver.foreground
    private val handler = Handler(Looper.getMainLooper())
    private var claimed = false
    private var softScanning = false
    private var tone: ToneGenerator? = null
    private val stopTimeout = Runnable { stopSoftScan() }
    private fun receive(value: String) {
        if (!claimed || !foreground.isOwner(owner)) return
        stopSoftScan()
        // Confirms delivery only; never log the barcode or infer physical acceptance from a claim.
        Log.i("MelisaScanner", "Honeywell scanner data received")
        onStatus("Honeywell tarama verisi alındı")
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

    override fun onResume() {
        if (claimed && foreground.isOwner(owner)) return
        try {
            context.packageManager.getPackageInfo(SERVICE_PACKAGE, 0)
            val scanAction = context.packageName + ".HONEYWELL_SCAN." + UUID.randomUUID()
            val properties = Bundle().apply {
                putBoolean("DPR_DATA_INTENT", true)
                putString("DPR_DATA_INTENT_ACTION", scanAction)
                putString("DPR_DATA_INTENT_CATEGORY", Intent.CATEGORY_DEFAULT)
                putString("DPR_DATA_INTENT_PACKAGE_NAME", context.packageName)
                putString("DPR_DATA_INTENT_CLASS_NAME", HoneywellScanReceiver::class.java.name)
                // The explicit receiver only forwards the current resumed claim's action.
                // Disable decoded content handlers so URLs/configuration barcodes remain plain data.
                putBoolean("DPR_LAUNCH_BROWSER", false)
                putBoolean("DPR_SCAN_TO_INTENT", false)
                putBoolean("DPR_LAUNCH_EZ_CONFIG", false)
                putString("DPR_PREFIX", "")
                putString("DPR_SUFFIX", "")
                // Preserve the complete label code in DCS; never infer or append a digit in the app.
                putBoolean("DEC_UPCA_CHECK_DIGIT_TRANSMIT", true)
                putBoolean("DEC_UPCA_NUMBER_SYSTEM_TRANSMIT", true)
                putBoolean("DEC_UPCA_TRANSLATE_TO_EAN13", false)
                putBoolean("DEC_EAN13_CHECK_DIGIT_TRANSMIT", true)
                putBoolean("DEC_EAN8_CHECK_DIGIT_TRANSMIT", true)
                // The app provides feedback after validation, honoring current preferences immediately.
                putBoolean("NTF_GOOD_READ_ENABLED", false)
                putBoolean("NTF_BAD_READ_ENABLED", false)
                putBoolean("NTF_VIBRATE_ENABLED", false)
            }
            // This reserved profile is intentionally absent: DCS loads factory defaults for it.
            // An omitted profile leaves the cached scanner's previous properties in place.
            send(Intent(ACTION_CLAIM).putExtra(EXTRA_SCANNER, "dcs.scanner.imager")
                .putExtra(EXTRA_PROFILE, "MelisaNativeFactory").putExtra(EXTRA_PROPERTIES, properties))
            claimed = true
            foreground.activate(owner, scanAction, ::receive)
            Log.i("MelisaScanner", "Honeywell scanner claim requested")
            onStatus("Honeywell tarayıcı · ilk okuma bekleniyor")
        } catch (_: PackageManager.NameNotFoundException) {
            onStatus("Honeywell tarayıcı servisi bulunamadı")
        } catch (_: Exception) {
            release()
            onStatus("Honeywell tarayıcı bağlantısı kurulamadı; uygulamayı yeniden açın")
        }
    }

    override fun trigger() {
        if (!claimed || !foreground.isOwner(owner)) {
            onStatus("Honeywell tarayıcı bağlantısı bekleniyor")
            return
        }
        if (softScanning) { stopSoftScan(); return }
        runCatching {
            send(Intent(ACTION_CONTROL).putExtra(EXTRA_SCAN, true))
            softScanning = true
            handler.postDelayed(stopTimeout, 6000)
        }.onFailure { onStatus("Honeywell tarama başlatılamadı") }
    }

    private fun stopSoftScan() {
        handler.removeCallbacks(stopTimeout)
        if (softScanning && foreground.isOwner(owner)) runCatching { send(Intent(ACTION_CONTROL).putExtra(EXTRA_SCAN, false)) }
        softScanning = false
    }

    private fun release() {
        // Revoke delivery first. A stale activity must not release or stop a newer owner's scanner.
        val ownedClaim = foreground.release(owner)
        handler.removeCallbacks(stopTimeout)
        softScanning = false
        claimed = false
        if (ownedClaim) {
            runCatching { send(Intent(ACTION_CONTROL).putExtra(EXTRA_SCAN, false)) }
            runCatching { send(Intent(ACTION_RELEASE)) }
            Log.i("MelisaScanner", "Honeywell scanner claim released")
        }
        tone?.release()
        tone = null
    }

    override fun onPause() = release()
    override fun onStop() = release()
    override fun close() = release()
    private fun send(intent: Intent) = context.sendBroadcast(intent.setPackage(SERVICE_PACKAGE))

    private companion object {
        const val SERVICE_PACKAGE = "com.intermec.datacollectionservice"
        const val ACTION_CLAIM = "com.honeywell.aidc.action.ACTION_CLAIM_SCANNER"
        const val ACTION_RELEASE = "com.honeywell.aidc.action.ACTION_RELEASE_SCANNER"
        const val ACTION_CONTROL = "com.honeywell.aidc.action.ACTION_CONTROL_SCANNER"
        const val EXTRA_SCANNER = "com.honeywell.aidc.extra.EXTRA_SCANNER"
        const val EXTRA_PROFILE = "com.honeywell.aidc.extra.EXTRA_PROFILE"
        const val EXTRA_PROPERTIES = "com.honeywell.aidc.extra.EXTRA_PROPERTIES"
        const val EXTRA_SCAN = "com.honeywell.aidc.extra.EXTRA_SCAN"
    }
}
