package com.melisaerp.nativeterminal

import com.melisaerp.nativeterminal.data.codec
import com.melisaerp.nativeterminal.model.*
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test

class ReceiptWorkflowTest {
    private val customer = Customer(10, "1-PEŞİN $", "Peşin USD", "USD")
    private val quote = Quote(1, "3067", "Ayıcık Takım", "12345", listOf("12345"), "16", "12.80", "USD", "47.8", 10, "signed", "now")
    private val receipt = Receipt(123, "MN-TEST", "2026-09-15", "FINALIZED", "Cash", "USD", "12.80")
    private fun draft() = Draft(id = "local-receipt", owner = "server|terminal|1", actorId = 1, customer = customer)
        .add(quote, 3).copy(note = "Satış notu", discountRate = "5", approvalToken = "approved", updatedAt = 1L)

    @Test fun legacyJsonStillLoadsAsOrdinaryDraft() {
        val old = codec.encodeToJsonElement(draft()).jsonObject
        assertTrue(old.containsKey("onHold"))
        val legacy = JsonObject(old.filterKeys { it !in setOf("onHold", "holdNote") })
        val restored = codec.decodeFromJsonElement<Draft>(legacy)
        assertFalse(restored.onHold)
        assertEquals("", restored.holdNote)
        assertEquals(ReceiptGroup.DRAFTS, restored.receiptGroup)
        assertEquals(draft(), restored)
    }

    @Test fun holdingPreservesCommercialFieldsAndApproval() {
        val original = draft()
        val held = original.hold("  3067 modelinden 10 adet gelecek  ")
        assertEquals(original.copy(onHold = true, holdNote = "3067 modelinden 10 adet gelecek", updatedAt = held.updatedAt), held)
        assertTrue(held.updatedAt > original.updatedAt)
        assertEquals(ReceiptGroup.WAITING, held.receiptGroup)
        assertTrue(held.canDeleteLocally)
        assertFalse(held.discardableOnExit)
    }

    @Test fun holdNoteIsSeparateBoundedAndSurvivesResumeAndSerialization() {
        val held = draft().hold("  " + "ü".repeat(260) + "  ")
        assertEquals(240, held.holdNote.length)
        assertEquals("Satış notu", held.note)
        assertEquals(held, codec.decodeFromString<Draft>(codec.encodeToString(held)))
        val resumed = held.resumeFromHold()
        assertFalse(resumed.onHold)
        assertEquals(held.holdNote, resumed.holdNote)
        assertEquals(ReceiptGroup.DRAFTS, resumed.receiptGroup)
        assertEquals(held.copy(onHold = false, updatedAt = resumed.updatedAt), resumed)
    }

    @Test fun onlyHeldEditableDraftCanChangeWaitingNote() {
        assertThrows(IllegalStateException::class.java) { draft().editHoldNote("note") }
        val original = draft().hold("İlk not")
        val changed = original.editHoldNote("  Son not  ")
        assertEquals(original.copy(holdNote = "Son not", updatedAt = changed.updatedAt), changed)
        assertEquals(240, changed.editHoldNote("a".repeat(241)).holdNote.length)
        assertEquals("", changed.editHoldNote("  ").holdNote)
    }

    @Test fun emptyDraftCannotBeHeldAndStillDiscardsOnExit() {
        val empty = draft().copy(lines = emptyList())
        assertTrue(empty.discardableOnExit)
        assertThrows(IllegalArgumentException::class.java) { empty.hold("Ürün bekleniyor") }
    }

    @Test fun allStateReceiptPayloadCombinationsFailClosedForDeletionAndGrouping() {
        for (state in DraftState.entries) for (hasReceipt in listOf(false, true))
            for (frozen in listOf(false, true)) for (held in listOf(false, true)) {
                val d = draft().copy(state = state, receipt = if (hasReceipt) receipt else null,
                    submissionJson = if (frozen) "payload" else null, onHold = held)
                val safe = state == DraftState.DRAFT && !hasReceipt && !frozen
                val label = "$state receipt=$hasReceipt frozen=$frozen held=$held"
                assertEquals(label, safe, d.canDeleteLocally)
                val group = when {
                    state in setOf(DraftState.COMPLETED, DraftState.CANCELLED) && hasReceipt -> ReceiptGroup.SENT
                    safe -> if (held) ReceiptGroup.WAITING else ReceiptGroup.DRAFTS
                    else -> ReceiptGroup.REVIEW
                }
                assertEquals(label, group, d.receiptGroup)
                if (!safe) {
                    assertThrows(label, IllegalStateException::class.java) { d.hold("Waiting") }
                    assertThrows(label, IllegalStateException::class.java) { d.resumeFromHold() }
                    assertThrows(label, IllegalStateException::class.java) { d.editHoldNote("Waiting") }
                    assertThrows(label, IllegalStateException::class.java) { d.quantity(1, 4) }
                }
            }
    }

    @Test fun cancellationWithExistingReceiptRemainsReviewUntilConfirmed() {
        val uncertain = draft().copy(state = DraftState.REVIEW_REQUIRED, receipt = receipt, onHold = true)
        assertEquals(ReceiptGroup.REVIEW, uncertain.receiptGroup)
        assertFalse(uncertain.canDeleteLocally)
        assertEquals(ReceiptGroup.SENT, uncertain.copy(state = DraftState.CANCELLED).receiptGroup)
    }
}
