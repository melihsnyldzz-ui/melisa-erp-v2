package com.melisaerp.nativeterminal

import com.melisaerp.nativeterminal.scanner.ForegroundScanDelivery
import org.junit.Assert.*
import org.junit.Test

class ForegroundScanDeliveryTest {
    @Test fun backgroundDeliveryAndReleaseWithoutAnOwnerAreIgnored() {
        val gate = ForegroundScanDelivery()
        assertFalse(gate.deliver("claim-1", "123"))
        assertFalse(gate.release(Any()))
    }

    @Test fun onlyTheActiveClaimsActionReachesItsReceiver() {
        val gate = ForegroundScanDelivery()
        val owner = Any()
        val values = mutableListOf<String>()
        gate.activate(owner, "claim-1") { values += it }
        assertFalse(gate.deliver(null, "123"))
        assertFalse(gate.deliver("other-claim", "123"))
        assertTrue(gate.deliver("claim-1", "00123"))
        assertEquals(listOf("00123"), values)
    }

    @Test fun pauseClearsDeliveryAndResumeDoesNotAcceptQueuedPreviousEvents() {
        val gate = ForegroundScanDelivery()
        val owner = Any()
        val values = mutableListOf<String>()
        gate.activate(owner, "claim-1") { values += it }
        assertTrue(gate.release(owner))
        assertFalse(gate.isOwner(owner))
        assertFalse(gate.deliver("claim-1", "late-background"))
        gate.activate(owner, "claim-2") { values += it }
        assertFalse(gate.deliver("claim-1", "late-previous-claim"))
        assertTrue(gate.deliver("claim-2", "current"))
        assertEquals(listOf("current"), values)
    }

    @Test fun oldActivityCannotReleaseOrReceiveAfterItsReplacementClaimsScanner() {
        val gate = ForegroundScanDelivery()
        val oldOwner = Any()
        val newOwner = Any()
        val oldValues = mutableListOf<String>()
        val newValues = mutableListOf<String>()
        gate.activate(oldOwner, "old-claim") { oldValues += it }
        gate.activate(newOwner, "new-claim") { newValues += it }
        assertFalse(gate.isOwner(oldOwner))
        assertFalse(gate.release(oldOwner))
        assertTrue(gate.isOwner(newOwner))
        assertFalse(gate.deliver("old-claim", "stale"))
        assertTrue(gate.deliver("new-claim", "current"))
        assertTrue(oldValues.isEmpty())
        assertEquals(listOf("current"), newValues)
        assertTrue(gate.release(newOwner))
        assertFalse(gate.deliver("new-claim", "after-release"))
    }

    @Test fun ownershipUsesIdentityAndCannotBeReleasedByAnEqualObject() {
        data class Owner(val id: Int)
        val gate = ForegroundScanDelivery()
        val owner = Owner(1)
        gate.activate(owner, "claim") {}
        assertFalse(gate.release(Owner(1)))
        assertTrue(gate.isOwner(owner))
        assertTrue(gate.release(owner))
    }
}
