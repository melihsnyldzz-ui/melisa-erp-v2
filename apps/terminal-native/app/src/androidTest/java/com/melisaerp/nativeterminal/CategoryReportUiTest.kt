package com.melisaerp.nativeterminal

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import com.melisaerp.nativeterminal.model.*
import org.junit.Rule
import org.junit.Test
import org.junit.Assert.assertTrue
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import android.graphics.Bitmap

/** Isolated UI only: no MainActivity, repository, session, API or receipt writes. */
class CategoryReportUiTest {
    @get:Rule val compose = createComposeRule()
    private fun line(id: Long, category: String?, quantity: String, price: String) =
        CategoryReportLine(id, "UI-$id", "Ürün $id", category, quantity, price)

    @Test fun cachedDialogShowsSourceAndReturnsToReceipt() {
        val report = CategoryReport(currency = "USD", discountRate = "5",
            items = listOf(line(1, "TAKIM", "190", "12.44"), line(2, "ELBİSE", "36", "13.50"), line(3, "TULUM", "8", "5.25")))
        val draft = Draft(id = "ui-fixture", owner = "isolated-ui", actorId = 1, customer = Customer(1, "1-PEŞİN $", "Örnek", "USD"),
            receipt = Receipt(1, "MN-ÖRNEK-104", "2026-09-15", "FINALIZED", "Örnek", "USD", "0"))
        var closed = false
        compose.setContent { MaterialTheme { CategoryReportDialog(CategoryReportUi(draft, report, loading = false, fromCache = true), { closed = true }, {}) } }
        compose.onNodeWithText("Kategori Raporu").assertIsDisplayed()
        compose.onNodeWithText("Cihazdaki son bilgiler · Bağlanınca yeniden açın").assertIsDisplayed()
        compose.waitForIdle()
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        File(instrumentation.targetContext.getExternalFilesDir(null), "category-report.png").outputStream().use {
            assertTrue(instrumentation.uiAutomation.takeScreenshot().compress(Bitmap.CompressFormat.PNG, 100, it))
        }
        compose.onNodeWithText("Satırlara dön").performClick()
        compose.runOnIdle { assertTrue(closed) }
    }

    @Test fun categoryOpensItsProductsAndClosesWithoutChangingAmounts() {
        val report = CategoryReport(currency = "USD", discountRate = "5",
            items = listOf(line(1, "TAKIM", "10", "2.50"), line(2, "TAKIM", "30", "3.50"), line(3, "TULUM", "8", "5.25")))
        compose.setContent { MaterialTheme { CategoryReportContent(report, Modifier.fillMaxSize()) } }
        compose.onNodeWithText("3 satır / 48 adet").assertIsDisplayed()
        compose.onNodeWithText("UI-1 · Ürün 1").assertDoesNotExist()
        compose.onNodeWithText("TAKIM").performClick()
        compose.onNodeWithText("UI-1 · Ürün 1").assertIsDisplayed()
        compose.onNodeWithText("UI-2 · Ürün 2").assertIsDisplayed()
        compose.onNodeWithText("UI-3 · Ürün 3").assertDoesNotExist()
        compose.onNodeWithText("TAKIM").performClick()
        compose.onNodeWithText("UI-1 · Ürün 1").assertDoesNotExist()
        compose.onNodeWithText("Fiş indirimi %5. Kategori tutarları indirim öncesidir.").assertIsDisplayed()
    }

    @Test fun longReceiptKeepsAllRowsAndAllowsScrollingToLastCategory() {
        val report = CategoryReport(currency = "TRY", items = (1L..45L).map { line(it, "Kategori ${it.toString().padStart(2, '0')}", "1", "1.01") })
        compose.setContent { MaterialTheme { CategoryReportContent(report, Modifier.fillMaxSize()) } }
        compose.onNodeWithText("45 satır / 45 adet").assertIsDisplayed()
        compose.onNode(hasScrollToNodeAction()).performScrollToNode(hasText("Kategori 45"))
        compose.onNodeWithText("Kategori 45").assertIsDisplayed().performClick()
        compose.onNode(hasScrollToNodeAction()).performScrollToNode(hasText("UI-45 · Ürün 45"))
        compose.onNodeWithText("UI-45 · Ürün 45").assertIsDisplayed()
    }

    @Test fun missingLegacyCategoryIsDistinctFromKnownUncategorizedProduct() {
        val report = CategoryReport(currency = "USD", items = listOf(line(1, null, "2", "3"), line(2, "", "1", "3")))
        compose.setContent { MaterialTheme { CategoryReportContent(report, Modifier.fillMaxSize()) } }
        compose.onNodeWithText("Kategori bilgisi yok").assertIsDisplayed()
        compose.onNodeWithText("Kategorisiz").assertIsDisplayed()
    }

    @Test fun expandedCategoryKeepsAllFortyFiveProductRowsReachable() {
        val report = CategoryReport(currency = "USD", items = (1L..45L).map { line(it, "TAKIM", "1", "2") })
        compose.setContent { MaterialTheme { CategoryReportContent(report, Modifier.fillMaxSize()) } }
        compose.onNodeWithText("TAKIM").performClick()
        compose.onNodeWithText("UI-45 · Ürün 45").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("45 satır / 45 adet").assertIsDisplayed()
    }
}
