package com.melisaerp.nativeterminal

import com.melisaerp.nativeterminal.scanner.ForegroundScanDelivery
import com.melisaerp.nativeterminal.scanner.ScannerProvider
import com.melisaerp.nativeterminal.scanner.scannerProvider
import com.melisaerp.nativeterminal.scanner.validatedNewlandBarcode
import org.junit.Assert.*
import org.junit.Test

class NewlandScannerContractTest {
    @Test fun newlandSelectionDoesNotChangeHoneywellOrZebraSelection() {
        for (manufacturer in listOf("Newland", "newland", " NEWLAND ")) {
            assertEquals(ScannerProvider.NEWLAND, scannerProvider(manufacturer))
        }
        assertEquals(ScannerProvider.HONEYWELL, scannerProvider("Honeywell"))
        assertEquals(ScannerProvider.DATA_WEDGE, scannerProvider("Zebra Technologies"))
        assertEquals(ScannerProvider.DATA_WEDGE, scannerProvider("unknown"))
    }

    @Test fun successfulReadsPreserveFullUpcLeadingZeroesCaseAndPunctuation() {
        for (barcode in listOf("211234130672", "001234", "v211234130672", "A-12/3", "MİSİMOSİ-42", "A".repeat(160))) {
            assertEquals(barcode, validatedNewlandBarcode("ok", "  $barcode  "))
        }
    }

    @Test fun missingFailedOrUnexpectedStatesNeverBecomeProducts() {
        for (state in listOf(null, "", "fail", "OK", " ok ", "unknown")) {
            assertNull(validatedNewlandBarcode(state, "211234130672"))
        }
    }

    @Test fun malformedSuccessfulResultsNeverReachProductLookup() {
        for (raw in listOf(null, "", "   ", "A".repeat(161), "AB\nCD", "AB\u0000CD", "AB\u001dCD", "AB\u007fCD", "AB\u0085CD")) {
            assertNull(validatedNewlandBarcode("ok", raw))
        }
    }

    @Test fun fixedActionCannotForwardAnOldActivityCallbackToItsReplacement() {
        val gate = ForegroundScanDelivery()
        val oldOwner = Any()
        val newOwner = Any()
        val values = mutableListOf<String>()
        val action = "com.melisaerp.nativeterminal.NEWLAND_SCAN"
        gate.activate(oldOwner, action) { fail("Old activity must not receive") }
        gate.activate(newOwner, action) { values += it }
        assertFalse(gate.deliver(oldOwner, action, "stale"))
        assertFalse(gate.release(oldOwner))
        assertFalse(gate.deliver(newOwner, "other-action", "wrong-action"))
        assertTrue(gate.deliver(newOwner, action, "001234"))
        assertEquals(listOf("001234"), values)
    }

    @Test fun pauseAndResumeRequireANewRegistrationEvenWithTheSameAction() {
        val gate = ForegroundScanDelivery()
        val firstRegistration = Any()
        val secondRegistration = Any()
        val values = mutableListOf<String>()
        val action = "com.melisaerp.nativeterminal.NEWLAND_SCAN"
        assertFalse(gate.deliver(firstRegistration, action, "before-resume"))
        gate.activate(firstRegistration, action) { values += it }
        assertTrue(gate.release(firstRegistration))
        assertFalse(gate.deliver(firstRegistration, action, "after-pause"))
        gate.activate(secondRegistration, action) { values += it }
        assertFalse(gate.deliver(firstRegistration, action, "queued-before-pause"))
        assertTrue(gate.deliver(secondRegistration, action, "current"))
        assertEquals(listOf("current"), values)
        assertTrue(gate.release(secondRegistration))
    }
}
