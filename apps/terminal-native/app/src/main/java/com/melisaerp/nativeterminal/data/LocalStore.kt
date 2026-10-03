package com.melisaerp.nativeterminal.data

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.room.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

val codec = Json { ignoreUnknownKeys = true; encodeDefaults = true }

class Vault(context: Context) {
    private val preferences = context.getSharedPreferences("native-session", Context.MODE_PRIVATE)
    private val alias = "melisa-native-v1"
    private val key: SecretKey by lazy { loadKey() }
    private fun loadKey(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(alias, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
        }.generateKey()
    }
    @Synchronized fun seal(plain: String): String {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, key)
        return Base64.encodeToString(cipher.iv + cipher.doFinal(plain.toByteArray(Charsets.UTF_8)), Base64.NO_WRAP)
    }
    @Synchronized fun open(encoded: String): String {
        val bytes = Base64.decode(encoded, Base64.NO_WRAP); require(bytes.size > 28)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(128, bytes.copyOfRange(0, 12)))
        return String(cipher.doFinal(bytes.copyOfRange(12, bytes.size)), Charsets.UTF_8)
    }
    suspend fun put(name: String, value: String?) = withContext(Dispatchers.IO) {
        val editor = preferences.edit()
        if (value == null) editor.remove(name) else editor.putString(name, seal(value))
        check(editor.commit()) { "Cihaz kaydı yapılamadı. İşlem tamamlanmadı." }
    }
    suspend fun get(name: String): String? = withContext(Dispatchers.IO) { preferences.getString(name, null)?.let(::open) }
}

@Entity(tableName = "drafts", indices = [Index(value = ["owner", "updatedAt"])])
data class DraftRow(@PrimaryKey val id: String, val owner: String, val updatedAt: Long, val payload: String)
@Entity(tableName = "workspace") data class WorkspaceRow(@PrimaryKey val owner: String, val activeId: String?)
@Entity(tableName = "quotes", primaryKeys = ["owner", "customerId", "productId"], indices = [Index(value = ["owner", "customerId", "code"])])
data class QuoteRow(val owner: String, val customerId: Long, val productId: Long, val code: String, val name: String, val payload: String)
@Entity(tableName = "barcodes", primaryKeys = ["owner", "customerId", "barcode", "productId"], indices = [Index(value = ["owner", "customerId", "barcode"])])
data class BarcodeRow(val owner: String, val customerId: Long, val barcode: String, val productId: Long)

@Entity(tableName = "catalog_state")
data class CatalogStateRow(@PrimaryKey val owner: String, val revision: String, val updatedAt: Long)

@Dao interface StoreDao {
    @Query("SELECT * FROM catalog_state WHERE owner=:owner") suspend fun catalogState(owner: String): CatalogStateRow?
    @Upsert suspend fun catalogState(row: CatalogStateRow)
    @Query("DELETE FROM quotes WHERE owner=:owner") suspend fun clearQuotes(owner: String)
    @Query("DELETE FROM barcodes WHERE owner=:owner") suspend fun clearOwnerBarcodes(owner: String)
    @Query("DELETE FROM quotes WHERE owner=:owner AND productId IN (:ids)") suspend fun removeQuotes(owner: String, ids: List<Long>)
    @Query("DELETE FROM barcodes WHERE owner=:owner AND productId IN (:ids)") suspend fun removeBarcodes(owner: String, ids: List<Long>)
    @Query("DELETE FROM quotes WHERE owner=:owner AND customerId NOT IN (:customers)") suspend fun removeOtherCustomers(owner: String, customers: List<Long>)
    @Query("DELETE FROM barcodes WHERE owner=:owner AND customerId NOT IN (:customers)") suspend fun removeOtherCustomerBarcodes(owner: String, customers: List<Long>)
    @Query("DELETE FROM barcodes WHERE owner=:owner AND EXISTS(SELECT 1 FROM quotes q WHERE q.owner=:stage AND q.customerId=barcodes.customerId AND q.productId=barcodes.productId)") suspend fun clearChangedBarcodes(owner: String, stage: String)
    @Query("INSERT OR REPLACE INTO quotes(owner,customerId,productId,code,name,payload) SELECT :owner,customerId,productId,code,name,payload FROM quotes WHERE owner=:stage") suspend fun publishQuotes(owner: String, stage: String)
    @Query("INSERT OR REPLACE INTO barcodes(owner,customerId,barcode,productId) SELECT :owner,customerId,barcode,productId FROM barcodes WHERE owner=:stage") suspend fun publishBarcodes(owner: String, stage: String)
    @Query("SELECT COUNT(*) FROM quotes WHERE owner=:owner AND customerId=:customer") suspend fun quoteCount(owner: String, customer: Long): Int
    @Query("SELECT * FROM drafts WHERE owner=:owner ORDER BY updatedAt DESC") suspend fun drafts(owner: String): List<DraftRow>
    @Query("SELECT * FROM drafts WHERE owner=:owner AND id=:id") suspend fun draft(owner: String, id: String): DraftRow?
    @Query("DELETE FROM drafts WHERE owner=:owner AND id=:id") suspend fun deleteDraft(owner: String, id: String)
    @Upsert suspend fun save(row: DraftRow)
    @Upsert suspend fun workspace(row: WorkspaceRow)
    @Query("SELECT activeId FROM workspace WHERE owner=:owner") suspend fun active(owner: String): String?
    @Upsert suspend fun quotes(rows: List<QuoteRow>)
    @Query("SELECT * FROM quotes WHERE owner=:owner AND customerId=:customer AND productId IN (:products)")
    suspend fun quotesByIds(owner: String, customer: Long, products: List<Long>): List<QuoteRow>
    @Upsert suspend fun barcodes(rows: List<BarcodeRow>)
    @Query("DELETE FROM barcodes WHERE owner=:owner AND customerId=:customer AND productId=:product") suspend fun clearBarcodes(owner: String, customer: Long, product: Long)
    @Query("DELETE FROM barcodes WHERE owner=:owner AND customerId=:customer AND productId IN (:products)") suspend fun clearProductBarcodes(owner: String, customer: Long, products: List<Long>)
    @Query("SELECT q.* FROM quotes q WHERE q.owner=:owner AND q.customerId=:customer AND (q.code LIKE :pattern ESCAPE '\\' OR q.name LIKE :pattern ESCAPE '\\' OR EXISTS (SELECT 1 FROM barcodes b WHERE b.owner=q.owner AND b.customerId=q.customerId AND b.productId=q.productId AND b.barcode=:barcode)) ORDER BY CASE WHEN q.code=:exact THEN 0 ELSE 1 END, q.code LIMIT 30")
    suspend fun search(owner: String, customer: Long, pattern: String, exact: String, barcode: String): List<QuoteRow>
    @Query("SELECT q.* FROM quotes q INNER JOIN barcodes b ON b.owner=q.owner AND b.customerId=q.customerId AND b.productId=q.productId WHERE b.owner=:owner AND b.customerId=:customer AND b.barcode=:barcode LIMIT 2")
    suspend fun barcode(owner: String, customer: Long, barcode: String): List<QuoteRow>
}
@Database(entities = [DraftRow::class, WorkspaceRow::class, QuoteRow::class, BarcodeRow::class, CatalogStateRow::class], version = 2, exportSchema = true)
abstract class LocalStore : RoomDatabase() {
    abstract fun dao(): StoreDao
    companion object { fun create(context: Context) = Room.databaseBuilder(context, LocalStore::class.java, "native-terminal.db").addMigrations(object : androidx.room.migration.Migration(1, 2) {
        override fun migrate(db: androidx.sqlite.db.SupportSQLiteDatabase) {
            db.execSQL("CREATE TABLE IF NOT EXISTS catalog_state (owner TEXT NOT NULL, revision TEXT NOT NULL, updatedAt INTEGER NOT NULL, PRIMARY KEY(owner))")
        }
    }).build() }
}
