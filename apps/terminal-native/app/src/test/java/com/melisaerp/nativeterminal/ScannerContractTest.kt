package com.melisaerp.nativeterminal

import com.melisaerp.nativeterminal.scanner.ScannerProvider
import com.melisaerp.nativeterminal.scanner.scannerProvider
import com.melisaerp.nativeterminal.scanner.validatedHoneywellBarcode
import org.junit.Assert.*
import org.junit.Test

class ScannerContractTest {
    @Test fun honeywellDevicesUseTheirOwnScannerWhileExistingDevicesKeepDataWedge() {
        for (manufacturer in listOf("Honeywell", "honeywell", " HONEYWELL ")) {
            assertEquals(ScannerProvider.HONEYWELL, scannerProvider(manufacturer))
        }
        for (manufacturer in listOf("Zebra Technologies", "Zebra", "Symbol Technologies", "Motorola Solutions", "", "unknown")) {
            assertEquals(ScannerProvider.DATA_WEDGE, scannerProvider(manufacturer))
        }
    }

    @Test fun validScannerDataPreservesLeadingZeroesCaseAndProductPunctuation() {
        for (value in listOf("001234", "v211234130672", "A-12/3", "MİSİMOSİ-42")) {
            assertEquals(value, validatedHoneywellBarcode(1, "  $value  "))
        }
        assertEquals("A".repeat(160), validatedHoneywellBarcode(1, "A".repeat(160)))
        assertEquals("future", validatedHoneywellBarcode(2, "future"))
    }

    @Test fun missingMalformedOrOversizedScannerDataDoesNotReachProductLookup() {
        for (raw in listOf(null, "", "   ", "A".repeat(161), "AB\nCD", "AB\u0000CD", "AB\u001dCD", "AB\u007fCD", "AB\u0085CD")) {
            assertNull(raw, validatedHoneywellBarcode(1, raw))
        }
        assertNull(validatedHoneywellBarcode(0, "1234"))
        assertNull(validatedHoneywellBarcode(-1, "1234"))
    }
}
