package com.melisaerp.nativeterminal

import androidx.compose.foundation.layout.Column
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.text.AnnotatedString
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.melisaerp.nativeterminal.model.Quote
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** Isolated Compose controls only: no MainActivity, account, repository, network or device scanner. */
@RunWith(AndroidJUnit4::class)
class NumericEntryUiTest {
    @get:Rule val compose = createComposeRule()

    private fun quote() = Quote(
        productId = 101L,
        stockCode = "UI-101",
        productName = "Test ürünü",
        barcode = "001234",
        stock = "24",
        unitPrice = "4.90",
        currency = "USD",
        exchangeRate = "47.80",
        customerId = 10L,
        quoteToken = "isolated-ui-quote-1",
        quotedAt = "2026-09-15T10:00:00Z",
    )

    private fun quantityField() = compose.onNode(hasSetTextAction() and hasText("Adet"))
    private fun editableText(value: String) =
        SemanticsMatcher.expectValue(SemanticsProperties.EditableText, AnnotatedString(value))

    @Test fun untouchedPreviewAddsOneButBlankOrZeroCannotAdd() {
        val added = mutableListOf<Int>()
        compose.setContent {
            MaterialTheme { ProductPreview(quote(), canAdd = true, add = { added += it }) }
        }

        quantityField().assert(editableText("1"))
        compose.onNodeWithText("FİŞE EKLE").assertIsEnabled().performClick()
        compose.runOnIdle { assertEquals(listOf(1), added) }

        quantityField().performClick().assert(editableText(""))
        compose.onNodeWithText("FİŞE EKLE").assertIsNotEnabled()
        quantityField().performTextInput("0")
        quantityField().assert(editableText("0"))
        compose.onNodeWithText("FİŞE EKLE").assertIsNotEnabled()
        compose.runOnIdle { assertEquals(listOf(1), added) }

        quantityField().performTextReplacement("12")
        compose.onNodeWithText("FİŞE EKLE").assertIsEnabled().performClick()
        compose.runOnIdle { assertEquals(listOf(1, 12), added) }
    }

    @Test fun typedQuantitySurvivesRefocusAndFreshPriceUntilProductChanges() {
        var currentQuote by mutableStateOf(quote())
        var otherInput by mutableStateOf("")
        compose.setContent {
            MaterialTheme {
                Column {
                    ProductPreview(currentQuote, canAdd = true, add = {})
                    OutlinedTextField(otherInput, { otherInput = it }, label = { Text("Başka alan") },
                        modifier = Modifier.testTag("other-input"))
                }
            }
        }

        quantityField().performClick().assert(editableText(""))
        quantityField().performTextInput("12")
        compose.onNodeWithTag("other-input").performClick()
        quantityField().performClick().assert(editableText("12"))

        compose.runOnIdle {
            currentQuote = currentQuote.copy(quoteToken = "isolated-ui-quote-2", unitPrice = "5.10",
                quotedAt = "2026-09-15T10:01:00Z")
        }
        quantityField().assert(editableText("12"))
        compose.onNodeWithText("FİŞE EKLE").assertIsEnabled()

        compose.onNodeWithTag("other-input").performClick()
        compose.runOnIdle {
            currentQuote = currentQuote.copy(productId = 102L, stockCode = "UI-102", quoteToken = "isolated-ui-quote-3")
        }
        quantityField().assert(editableText("1"))
        quantityField().performClick().assert(editableText(""))
        compose.onNodeWithText("FİŞE EKLE").assertIsNotEnabled()
    }

    @Test fun searchKeyboardTogglePreservesLeadingZeroesAndAlphanumericText() {
        var query by mutableStateOf("")
        compose.setContent {
            MaterialTheme { ProductSearchField(query, { query = it }) }
        }
        val field = compose.onNode(hasSetTextAction())
        compose.onNodeWithText("ABC").assertIsDisplayed()
        field.performClick().performTextInput("00123")
        field.assert(editableText("00123"))
        compose.runOnIdle { assertEquals("00123", query) }

        // Text-entry semantics verify that the numeric keyboard request adds no digits-only filter.
        field.performTextReplacement("A-0012/v")
        field.assert(editableText("A-0012/v"))
        compose.onNodeWithText("ABC").performClick()
        compose.onNodeWithText("123").assertIsDisplayed()
        field.assert(editableText("A-0012/v"))
        field.performTextReplacement("Pamuklu tulum")
        compose.onNodeWithText("123").performClick()
        compose.onNodeWithText("ABC").assertIsDisplayed()
        field.assert(editableText("Pamuklu tulum"))
        compose.runOnIdle { assertEquals("Pamuklu tulum", query) }
    }
}
