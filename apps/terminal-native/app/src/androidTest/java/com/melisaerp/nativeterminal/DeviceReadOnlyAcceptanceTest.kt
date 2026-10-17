package com.melisaerp.nativeterminal

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.melisaerp.nativeterminal.data.*
import com.melisaerp.nativeterminal.model.*
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

/** Reads a one-use, private test fixture. No credentials are embedded in the APK. */
@RunWith(AndroidJUnit4::class)
class DeviceReadOnlyAcceptanceTest {
    @Test fun realErpLoginSearchCurrencyAndLocalRecovery() = runBlocking {
        val context=InstrumentationRegistry.getInstrumentation().targetContext
        val file=java.io.File(context.filesDir,"acceptance-config.json")
        check(file.exists()) { "One-use acceptance configuration required" }
        val config=try { codec.parseToJsonElement(file.readText()).jsonObject } finally { file.delete() }
        val repo=(context.applicationContext as TerminalApplication).repository
        repo.restore()
        repo.configure(Settings(config["apiUrl"]!!.jsonPrimitive.content,config["terminalCode"]!!.jsonPrimitive.content))
        repo.login(config["username"]!!.jsonPrimitive.content,config["password"]!!.jsonPrimitive.content)
        val bootstrap=repo.bootstrap()
        assertEquals(setOf("USD","EUR","TRY"),bootstrap.customers.map { it.currency }.toSet())
        val customer=bootstrap.customers.first { it.currency=="USD" }
        val quotes=repo.search(customer.id,"3067",false)
        assertTrue(quotes.isNotEmpty()); val selected=quotes.first()
        val exact=repo.search(customer.id,selected.stockCode,false)
        assertEquals(selected.productId,exact.first().productId)
        val byName=repo.search(customer.id,selected.productName,false)
        assertTrue(byName.any { it.productId==selected.productId })
        if(selected.barcode.isNotBlank())assertEquals(selected.productId,repo.search(customer.id,selected.barcode,true).single().productId)
        val cached=repo.cached(customer.id,selected.barcode,true)
        if(selected.barcode.isNotBlank())assertEquals(selected.productId,cached.single().productId)
        for(c in bootstrap.customers){val q=repo.search(c.id,selected.stockCode,false).first();assertEquals(c.currency,q.currency);assertTrue(q.unitPrice.toBigDecimal().signum()>0)}
        val draft=Draft(owner=repo.owner,actorId=repo.session!!.user.id,customer=customer,note="NATIVE V1 KABUL — YEREL TASLAK").add(selected,1).add(selected,1).quantity(selected.productId,3).discount("5")
        repo.save(draft)
        val recovered=repo.active()!!
        assertEquals(draft,recovered);assertEquals(1,recovered.lines.size);assertEquals(3,recovered.quantity)
        // Preserve this explicitly identified local draft for the real process-kill check.
    }
}
