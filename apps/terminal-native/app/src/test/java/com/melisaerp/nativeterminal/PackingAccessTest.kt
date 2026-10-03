package com.melisaerp.nativeterminal

import com.melisaerp.nativeterminal.data.ApiFailure
import com.melisaerp.nativeterminal.data.salesOrPackingBootstrap
import com.melisaerp.nativeterminal.model.Bootstrap
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test
import java.io.IOException

class PackingAccessTest {
    @Test fun salesPersonnelKeepExistingBootstrapWithoutExtraRequest() = runBlocking {
        val expected = Bootstrap(emptyList(), false, "Test", saleEnabled = true)
        val actual = salesOrPackingBootstrap({ expected }) { error("Packing must not be requested") }
        assertSame(expected, actual)
    }
    @Test fun onlySalesRestrictionWithVerifiedPackingAccessAllowsMenu() = runBlocking {
        for (code in listOf("AUTH_PERMISSION_DENIED", "TERMINAL_EMPLOYEE_SALE_RESTRICTED")) {
            var verified = 0
            val actual = salesOrPackingBootstrap({ throw ApiFailure(403, code, "restricted") }) { verified++ }
            assertNull(actual)
            assertEquals(1, verified)
        }
    }
    @Test fun inactivePersonnelOrDeviceCannotUseSalesFallback() = runBlocking {
        for (code in listOf("TERMINAL_DEVICE_NOT_ACTIVE", "TERMINAL_EMPLOYEE_NOT_ASSIGNED")) {
            val expected = ApiFailure(409, code, "inactive")
            try {
                salesOrPackingBootstrap({ throw ApiFailure(403, "AUTH_PERMISSION_DENIED", "restricted") }) { throw expected }
                fail("Inactive context must be rejected")
            } catch (actual: ApiFailure) { assertSame(expected, actual) }
        }
    }
    @Test fun expiredSessionOrServerFailureCannotBecomePackingOnlySession() = runBlocking {
        for (expected in listOf(ApiFailure(401, "AUTH_TOKEN_EXPIRED", "expired"), ApiFailure(503, "DB", "offline"),
            ApiFailure(403, "OTHER_POLICY", "restricted"), IOException("network"))) {
            var called = false
            try {
                salesOrPackingBootstrap({ throw expected }) { called = true }
                fail("Failure must propagate")
            } catch (actual: IOException) { assertSame(expected, actual) }
            assertFalse(called)
        }
    }
}
