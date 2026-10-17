package com.melisaerp.nativeterminal

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.melisaerp.nativeterminal.data.Vault
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class WorkProtectedVaultAcceptanceTest {
    @Test fun tokenPairsReopenEncryptedAndLogoutClearsOnlyTheirOwnRealm() = runBlocking {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val marker = java.util.UUID.randomUUID().toString()
        // Fixture keys never replace an actual ERP or CRM person's saved grant.
        val erp = "acceptance:work-protected:erp:$marker"
        val crm = "acceptance:work-protected:crm:$marker"
        val plain = """{"accessToken":"fixture-access-$marker","refreshToken":"fixture-refresh-$marker","userId":"fixture-agent","username":"fixture","expiresAt":100000}"""
        val vault = Vault(context)
        try {
            vault.put(erp, plain); vault.put(crm, plain.replace("fixture-agent", "fixture-crm-agent"))
            val encrypted = context.getSharedPreferences("native-session", 0).getString(erp, null)!!
            assertFalse(encrypted.contains("fixture-access")); assertFalse(encrypted.contains("fixture-refresh")); assertFalse(encrypted.contains("fixture-agent"))
            val reopened = Vault(context)
            assertEquals(plain, reopened.get(erp)); assertTrue(reopened.get(crm)!!.contains("fixture-crm-agent"))
            reopened.put(erp, null); assertNull(reopened.get(erp)); assertNotNull(reopened.get(crm))
        } finally { vault.put(erp, null); vault.put(crm, null) }
    }
}
