package com.melisaerp.nativeterminal

import com.melisaerp.nativeterminal.data.*
import com.melisaerp.nativeterminal.model.*
import java.lang.reflect.Proxy
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.encodeToString
import org.junit.Assert.*
import org.junit.Test

class LocalReceiptDeletionTest {
    private val customer = Customer(10, "cash", "Cash", "USD")
    private val quote = Quote(1, "P1", "Product", stock = "10", unitPrice = "5.00", currency = "USD",
        exchangeRate = "40", customerId = 10, quoteToken = "signed", quotedAt = "now")
    private fun draft(id: String = "target", owner: String = "server|terminal|1") =
        Draft(id = id, owner = owner, actorId = 1, customer = customer).add(quote, 2)

    // The production repository invokes this exact algorithm under its session lock
    // and Room transaction. This host test substitutes only DAO storage and decryption;
    // it does not claim to exercise Android SQLite rollback or Android Keystore.
    private class Store {
        val rows = mutableMapOf<Pair<String, String>, DraftRow>()
        val active = mutableMapOf<String, String?>()
        val writes = mutableListOf<String>()
        fun put(d: Draft) { rows[d.owner to d.id] = DraftRow(d.id, d.owner, d.updatedAt, codec.encodeToString(d)) }
        val dao: StoreDao = Proxy.newProxyInstance(StoreDao::class.java.classLoader, arrayOf(StoreDao::class.java)) { _, method, args ->
            when (method.name) {
                "draft" -> rows[args[0] as String to args[1] as String]
                "deleteDraft" -> {
                    val key = args[0] as String to args[1] as String
                    writes += "delete:$key"
                    rows.remove(key)
                    Unit
                }
                "active" -> active[args[0] as String]
                "workspace" -> {
                    val row = args[0] as WorkspaceRow
                    writes += "active:${row.owner}:${row.activeId}"
                    active[row.owner] = row.activeId
                    Unit
                }
                else -> error("Unexpected DAO operation: ${method.name}")
            }
        } as StoreDao
        fun delete(expected: Draft) = runBlocking {
            deleteLocalDraftRecord(dao, expected) { codec.decodeFromString<Draft>(it.payload) }
        }
    }

    @Test fun deletingHeldTargetPreservesOtherDraftsAndTheirActivePointer() {
        val target = draft().hold("Product expected")
        val other = draft("other")
        val store = Store().apply { put(target); put(other); active[target.owner] = other.id }
        store.delete(target)
        assertFalse(store.rows.containsKey(target.owner to target.id))
        assertTrue(store.rows.containsKey(other.owner to other.id))
        assertEquals(other.id, store.active[target.owner])
        assertEquals(listOf("delete:${target.owner to target.id}"), store.writes)
    }

    @Test fun deletingActiveDraftClearsOnlyItsOwnersActivePointer() {
        val target = draft()
        val foreign = draft("foreign", "server|terminal|2")
        val store = Store().apply { put(target); put(foreign); active[target.owner] = target.id; active[foreign.owner] = foreign.id }
        store.delete(target)
        assertNull(store.active[target.owner])
        assertEquals(foreign.id, store.active[foreign.owner])
        assertTrue(store.rows.containsKey(foreign.owner to foreign.id))
        assertEquals(listOf("delete:${target.owner to target.id}", "active:${target.owner}:null"), store.writes)
    }

    @Test fun confirmedSnapshotCannotDeleteAfterSubmissionStarts() {
        val shown = draft()
        for (current in listOf(shown.copy(state = DraftState.SUBMITTING, submissionJson = "frozen"),
            shown.copy(state = DraftState.REVIEW_REQUIRED, submissionJson = "frozen"))) {
            val store = Store().apply { put(current); active[current.owner] = current.id }
            assertThrows(IllegalStateException::class.java) { store.delete(shown) }
            assertTrue(store.writes.isEmpty())
            assertEquals(current.id, store.active[current.owner])
            assertEquals(current, codec.decodeFromString<Draft>(store.rows.getValue(current.owner to current.id).payload))
        }
    }

    @Test fun anyChangedSnapshotNeedsASecondFreshConfirmation() {
        val shown = draft().hold("First note")
        for (current in listOf(shown.quantity(1, 3), shown.editHoldNote("Changed"), shown.resumeFromHold())) {
            val store = Store().apply { put(current) }
            assertThrows(IllegalStateException::class.java) { store.delete(shown) }
            assertTrue(store.writes.isEmpty())
            assertEquals(1, store.rows.size)
        }
    }

    @Test fun nondeletableCurrentSnapshotNeverWritesEvenIfCallerSuppliesIt() {
        val receipt = Receipt(12, "MN12", "2026-09-15", "FINALIZED", "Cash", "USD", "10.00")
        val unsafe = listOf(draft().copy(submissionJson = "frozen"), draft().copy(receipt = receipt)) +
            DraftState.entries.filter { it != DraftState.DRAFT }.map { draft().copy(state = it, receipt = receipt) }
        for (current in unsafe) {
            val store = Store().apply { put(current) }
            assertThrows(IllegalStateException::class.java) { store.delete(current) }
            assertTrue(store.writes.isEmpty())
            assertEquals(1, store.rows.size)
        }
    }

    @Test fun wrongOwnerAndMissingTargetNeverClearExistingActiveDraft() {
        val target = draft()
        val store = Store().apply { put(target); active[target.owner] = target.id }
        assertThrows(IllegalStateException::class.java) { store.delete(target.copy(owner = "other-owner")) }
        assertThrows(IllegalStateException::class.java) { store.delete(target.copy(id = "missing")) }
        assertTrue(store.writes.isEmpty())
        assertEquals(target.id, store.active[target.owner])
        assertEquals(1, store.rows.size)
    }

    @Test fun repeatedDeleteDoesNotDeleteAnotherReceipt() {
        val target = draft()
        val other = draft("other")
        val store = Store().apply { put(target); put(other); active[target.owner] = other.id }
        store.delete(target)
        val writesAfterFirst = store.writes.toList()
        assertThrows(IllegalStateException::class.java) { store.delete(target) }
        assertEquals(writesAfterFirst, store.writes)
        assertTrue(store.rows.containsKey(other.owner to other.id))
        assertEquals(other.id, store.active[other.owner])
    }
}
