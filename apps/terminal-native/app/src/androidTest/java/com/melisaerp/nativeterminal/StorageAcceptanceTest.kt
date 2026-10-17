package com.melisaerp.nativeterminal

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.room.Room
import com.melisaerp.nativeterminal.data.*
import com.melisaerp.nativeterminal.model.*
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.encodeToString
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class StorageAcceptanceTest {
    @Test fun encryptedDraftSurvivesDatabaseReopenAndRemainsOwnerScoped() = runBlocking {
        val context=InstrumentationRegistry.getInstrumentation().targetContext
        val name="acceptance-${java.util.UUID.randomUUID()}.db"
        val vault=Vault(context)
        val quote=Quote(1,"3067","Ayıcık","123", listOf("123"),"-2","12.80","USD","47.8",10,"test-only","2026-09-14T12:00:00Z")
        val draft=Draft(owner="acceptance|1",actorId=1,customer=Customer(10,"1-PEŞİN $","Peşin","USD")).add(quote,2).price(1,"12.00").discount("5")
        var db=Room.databaseBuilder(context,LocalStore::class.java,name).build()
        try {
            val ciphertext=vault.seal(codec.encodeToString(draft)); assertFalse(ciphertext.contains("Ayıcık"))
            db.dao().save(DraftRow(draft.id,draft.owner,draft.updatedAt,ciphertext))
            db.dao().workspace(WorkspaceRow(draft.owner,draft.id)); db.close()
            db=Room.databaseBuilder(context,LocalStore::class.java,name).build()
            val row=db.dao().draft(draft.owner,db.dao().active(draft.owner)!!)!!
            val restored=codec.decodeFromString<Draft>(vault.open(row.payload))
            assertEquals(draft,restored); assertEquals("22.80",restored.total.toPlainString())
            assertTrue(db.dao().drafts("acceptance|another-user").isEmpty())
        } finally { db.close(); context.deleteDatabase(name) }
    }
    @Test fun indexedBarcodeAndExactCodePrecedence() = runBlocking {
        val context=InstrumentationRegistry.getInstrumentation().targetContext
        val db=Room.inMemoryDatabaseBuilder(context,LocalStore::class.java).build()
        try {
            db.dao().quotes(listOf(QuoteRow("a",1,1,"3067a","3067 takım","one"),QuoteRow("a",1,2,"3067","takım","two")))
            db.dao().barcodes(listOf(BarcodeRow("a",1,"001234",2)))
            assertEquals(2L,db.dao().search("a",1,"%3067%","3067","3067").first().productId)
            assertEquals(2L,db.dao().barcode("a",1,"001234").single().productId)
            assertEquals(2L,db.dao().search("a",1,"%001234%","001234","001234").single().productId)
            assertTrue(db.dao().search("b",1,"%001234%","001234","001234").isEmpty())
            assertTrue(db.dao().barcode("b",1,"001234").isEmpty())
        } finally { db.close() }
    }
}
