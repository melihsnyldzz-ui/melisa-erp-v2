package com.melisaerp.nativeterminal

import android.content.Intent
import android.os.SystemClock
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.melisaerp.nativeterminal.data.*
import com.melisaerp.nativeterminal.model.*
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** Real Compose UI + live read-only ERP + reversible TC21 network loss. No sales POST. */
@RunWith(AndroidJUnit4::class)
class UiOfflineAcceptanceTest {
    @get:Rule val ui = createEmptyComposeRule()
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private val context get() = instrumentation.targetContext
    private val repo get() = (context.applicationContext as TerminalApplication).repository
    private fun shell(command: String) = instrumentation.uiAutomation.executeShellCommand(command).use {
        android.os.ParcelFileDescriptor.AutoCloseInputStream(it).bufferedReader().readText()
    }
    private fun waitText(text: String, substring: Boolean = false) = ui.waitUntil(15000) {
        ui.onAllNodesWithText(text, substring = substring).fetchSemanticsNodes().isNotEmpty()
    }
    private fun current() = runBlocking { repo.active()!! }
    private fun find(query: String) {
        ui.onAllNodes(hasSetTextAction())[0].performTextReplacement(query)
    }
    private fun selectResult(code: String) {
        val matcher=hasText(code) and hasClickAction() and !hasSetTextAction()
        ui.waitUntil(15000) { ui.onAllNodes(matcher).fetchSemanticsNodes().isNotEmpty() }
        ui.onNode(matcher).performClick()
    }
    @Test fun compactUiScanDraftEditOfflineAndReconnect() {
        val original = runBlocking {
            repo.restore(); check(!repo.bootstrap().saleEnabled) { "Read-only runtime required" }
            val d=repo.drafts().first { it.note=="NATIVE V1 KABUL — YEREL TASLAK" && it.state==DraftState.DRAFT }
            repo.save(d); repo.search(d.customer.id,"2010 MOLLY BABY",false); d
        }
        val wifiWasEnabled=shell("cmd wifi status").contains("Wifi is enabled",true)
        check(wifiWasEnabled) { "TC21 Wi-Fi must initially be connected" }
        val scenario=ActivityScenario.launch(MainActivity::class.java)
        try {
            waitText("SATIŞI TAMAMLA")
            val q=original.lines.first().quote
            // Intent injection validates the receiver/UI pipeline; physical optical acceptance is separate.
            val scanStart=SystemClock.elapsedRealtime()
            repeat(20) {
                context.sendBroadcast(Intent(context.packageName+".SCAN").setPackage(context.packageName)
                    .addCategory(Intent.CATEGORY_DEFAULT).putExtra("com.symbol.datawedge.source","scanner")
                    .putExtra("com.symbol.datawedge.data_string",q.barcode))
            }
            waitText("FİŞE EKLE")
            assertEquals(original.quantity,current().quantity)
            println("NATIVE_METRICS rapid20PreviewMs=${SystemClock.elapsedRealtime()-scanStart}")
            ui.onNodeWithText("FİŞE EKLE").performClick()
            ui.waitUntil(10000) { current().quantity==original.quantity+1 }
            assertEquals(1,current().lines.size)
            ui.onNodeWithText(q.stockCode+" · "+q.productName).performClick()
            waitText("Birim fiyat")
            ui.onNodeWithText("Birim fiyat").assertIsNotEnabled()
            ui.onNode(hasText("Adet") and hasAnyAncestor(isDialog())).performTextReplacement("2")
            ui.onNodeWithText("Kaydet").performClick()
            ui.waitUntil(10000) { current().quantity==2 }
            ui.onNodeWithText("İndirim %${original.discountRate}").performClick()
            ui.onNode(hasSetTextAction() and hasAnyAncestor(isDialog())).performTextReplacement("4")
            ui.onNodeWithText("Kaydet").performClick()
            ui.waitUntil(10000) { current().discountRate=="4" }
            find("2010 MOLLY BABY"); selectResult("2010 MOLLY BABY")
            waitText("FİŞE EKLE"); ui.onNodeWithText("Stok: -1 ⚠").assertExists()
            ui.onNodeWithText("FİŞE EKLE").assertIsEnabled().performClick()
            ui.waitUntil(10000) { current().lines.size==2 }
            ui.onNodeWithText("2010 MOLLY BABY",substring=true).performClick()
            ui.onNodeWithText("Ürünü sil").performClick()
            ui.waitUntil(10000) { current().lines.size==1 }

            shell("svc wifi disable")
            waitText("Çevrimdışı · son bilinen fiyat")
            val offlineStart=SystemClock.elapsedRealtime()
            find(q.stockCode); selectResult(q.stockCode); waitText("FİŞE EKLE")
            ui.onNodeWithText("FİŞE EKLE").performClick()
            ui.waitUntil(10000) { current().quantity==3 }
            println("NATIVE_METRICS offlineSearchAndAddMs=${SystemClock.elapsedRealtime()-offlineStart}")
            ui.onNodeWithText("SATIŞI TAMAMLA").performClick(); waitText("Son kontrol")
            ui.onNodeWithText("Çevrimdışı satış tamamlanamaz.").assertExists()
            ui.onNodeWithText("Onayla").assertIsNotEnabled()
            assertEquals(DraftState.DRAFT,current().state)
            assertNull(current().submissionJson)
            ui.onNodeWithText("Geri").performClick()
            shell("svc wifi enable")
            ui.waitUntil(25000) { ui.onAllNodesWithText("Çevrimdışı · son bilinen fiyat").fetchSemanticsNodes().isEmpty() }
            assertEquals(3,current().quantity)
            ui.onNodeWithText("‹").performClick(); waitText("Cari seç")
            ui.onNodeWithText("3-PEŞİN € · EUR").performClick(); waitText("SATIŞI TAMAMLA")
            val next=current(); assertTrue(next.lines.isEmpty()); assertNotEquals(original.id,next.id)
            assertTrue(runBlocking { repo.drafts().any { it.id==original.id && it.quantity==3 } })
            ui.onNodeWithText("SATIŞI TAMAMLA").assertIsNotEnabled()
        } finally {
            if(wifiWasEnabled) shell("svc wifi enable")
            scenario.close()
            // Restore only our named local test draft. Other drafts and sessions remain intact.
            runBlocking { repo.save(original) }
        }
    }
}
