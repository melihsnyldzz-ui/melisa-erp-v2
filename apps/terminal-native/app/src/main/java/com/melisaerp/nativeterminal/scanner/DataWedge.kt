package com.melisaerp.nativeterminal.scanner

import com.melisaerp.nativeterminal.model.UiPreferences
import android.content.*
import android.content.pm.PackageManager
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.*
import android.util.Log
import androidx.core.content.ContextCompat
import java.security.MessageDigest
import kotlinx.coroutines.*

class DataWedge(private val context: Context, private val onScan: (String) -> Unit, private val onStatus: (String) -> Unit, private val preferences: () -> UiPreferences = { UiPreferences() }) {
    private var registered = false
    private val scanAction = context.packageName + ".SCAN"
    private var tone: ToneGenerator? = null
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private var configured = false
    private var configurationJob: Job? = null
    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            if (intent.action == scanAction) {
                if (intent.getStringExtra("com.symbol.datawedge.source") != "scanner") return
                val value = intent.getStringExtra("com.symbol.datawedge.data_string")?.trim().orEmpty()
                if (value.isEmpty() || value.length > 160 || value.any { it.isISOControl() }) return
                // Diagnose delivery without logging barcode contents or customer data.
                Log.i("MelisaScanner", "Scanner data received")
                if (preferences().sound) runCatching {
                    if (tone == null) tone = ToneGenerator(AudioManager.STREAM_NOTIFICATION, 55)
                    tone?.startTone(ToneGenerator.TONE_PROP_BEEP, 55)
                }
                if (preferences().vibration) context.getSystemService(Vibrator::class.java)?.vibrate(VibrationEffect.createOneShot(35, VibrationEffect.DEFAULT_AMPLITUDE))
                onScan(value)
            } else if (intent.action == "com.symbol.datawedge.api.RESULT_ACTION") {
                val command = intent.getStringExtra("COMMAND_IDENTIFIER")
                if (command == "MELISA_NATIVE_PROFILE") {
                    if (intent.getStringExtra("RESULT") == "SUCCESS") readAssociation()
                    else configurationResult(false, "DataWedge ayarı doğrulanamadı")
                } else if (command == "MELISA_NATIVE_ASSOCIATE") {
                    val success = intent.getStringExtra("RESULT") == "SUCCESS"
                    configurationResult(success, if (success) "DataWedge hazır" else "DataWedge profil bağlantısı doğrulanamadı")
                } else intent.getBundleExtra("com.symbol.datawedge.api.RESULT_GET_CONFIG")?.let { config ->
                    if (config.getString("PROFILE_NAME") == "MelisaNativeV1" && config.containsKey("APP_LIST")) {
                        @Suppress("DEPRECATION") val apps = config.getParcelableArrayList<Bundle>("APP_LIST").orEmpty()
                        if (apps.any { it.getString("PACKAGE_NAME") == context.packageName }) configurationResult(true, "DataWedge hazır")
                        else associate()
                    }
                }
            }
        }
    }
    fun start() {
        if (registered) return
        val filter = IntentFilter(scanAction).apply { addAction("com.symbol.datawedge.api.RESULT_ACTION"); addCategory(Intent.CATEGORY_DEFAULT) }
        ContextCompat.registerReceiver(context, receiver, filter, ContextCompat.RECEIVER_EXPORTED)
        registered = true
        if (!configured && configurationJob?.isActive != true) configurationJob = scope.launch {
            try {
                withContext(Dispatchers.IO) { context.packageManager.getPackageInfo("com.symbol.datawedge", 0); configure() }
                delay(5000)
                if (!configured) onStatus("DataWedge yanıtı bekleniyor; uygulamayı yeniden açın")
            } catch (_: PackageManager.NameNotFoundException) { onStatus("DataWedge bu cihazda bulunamadı") }
            catch (e: CancellationException) { throw e }
            catch (_: Exception) { onStatus("DataWedge ayarı doğrulanamadı") }
        }
    }
    fun stop() { if (registered) context.unregisterReceiver(receiver); registered = false; tone?.release(); tone = null }
    fun close() { stop(); scope.cancel() }
    private fun configurationResult(success: Boolean, message: String) {
        Log.i("MelisaScanner", if (success) "Profile configuration verified" else "Profile configuration failed")
        configured = success; configurationJob?.cancel(); onStatus(message)
    }
    private fun readAssociation() {
        val config = Bundle().apply { putString("PROFILE_NAME", "MelisaNativeV1"); putString("APP_LIST", "") }
        context.sendBroadcast(Intent("com.symbol.datawedge.api.ACTION").setPackage("com.symbol.datawedge").putExtra("com.symbol.datawedge.api.GET_CONFIG", config))
    }
    private fun associate() {
        val config = Bundle().apply {
            putString("PROFILE_NAME", "MelisaNativeV1"); putString("CONFIG_MODE", "UPDATE")
            putParcelableArray("APP_LIST", arrayOf(Bundle().apply { putString("PACKAGE_NAME", context.packageName); putStringArray("ACTIVITY_LIST", arrayOf("*")) }))
        }
        context.sendBroadcast(Intent("com.symbol.datawedge.api.ACTION").setPackage("com.symbol.datawedge")
            .putExtra("com.symbol.datawedge.api.SET_CONFIG", config).putExtra("SEND_RESULT", "LAST_RESULT").putExtra("COMMAND_IDENTIFIER", "MELISA_NATIVE_ASSOCIATE"))
    }
    fun trigger() = send("com.symbol.datawedge.api.SOFT_SCAN_TRIGGER", "TOGGLE_SCANNING")
    private fun send(extra: String, value: String) = context.sendBroadcast(Intent("com.symbol.datawedge.api.ACTION").setPackage("com.symbol.datawedge").putExtra(extra, value))
    @Suppress("DEPRECATION") private fun configure() {
        // DataWedge's SIGNATURE contract uses GET_SIGNATURES (Zebra SET_CONFIG sample).
        // After APK key rotation it returns the original certificate, whereas
        // apkContentsSigners returns the new one and silently prevents scan delivery.
        val signature = context.packageManager.getPackageInfo(context.packageName, PackageManager.GET_SIGNATURES).signatures!!.single()
        val sha1 = MessageDigest.getInstance("SHA-1").digest(signature.toByteArray()).joinToString("") { "%02X".format(it) }
        fun plugin(name: String, parameters: Bundle) = Bundle().apply { putString("PLUGIN_NAME", name); putString("RESET_CONFIG", "false"); putBundle("PARAM_LIST", parameters) }
        val config = Bundle().apply {
            putString("PROFILE_NAME", "MelisaNativeV1"); putString("PROFILE_ENABLED", "true"); putString("CONFIG_MODE", "CREATE_IF_NOT_EXIST")
            putParcelableArrayList("PLUGIN_CONFIG", arrayListOf(
                plugin("BARCODE", Bundle().apply { putString("scanner_input_enabled", "true"); putString("scanner_selection", "auto") }),
                plugin("KEYSTROKE", Bundle().apply { putString("keystroke_output_enabled", "false") }),
                plugin("INTENT", Bundle().apply {
                    putString("intent_output_enabled", "true"); putString("intent_action", scanAction); putString("intent_category", Intent.CATEGORY_DEFAULT); putString("intent_delivery", "2")
                    putParcelableArrayList("intent_component_info", arrayListOf(Bundle().apply { putString("PACKAGE_NAME", context.packageName); putString("SIGNATURE", sha1) }))
                })
            ))
        }
        context.sendBroadcast(Intent("com.symbol.datawedge.api.ACTION").setPackage("com.symbol.datawedge")
            .putExtra("com.symbol.datawedge.api.SET_CONFIG", config).putExtra("SEND_RESULT", "LAST_RESULT").putExtra("COMMAND_IDENTIFIER", "MELISA_NATIVE_PROFILE"))
    }
}
