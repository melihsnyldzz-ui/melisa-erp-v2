# Melisa ERP v2 New Database Design

## Amac

Bu dokuman Melisa ERP v2 icin Vega'dan bagimsiz yeni SQL Server database tasarimini tanimlar. Hedef database adi `MELISA_ERP_V2` olarak belirlenmistir.

Bu sprintte yapilan is sadece dokumantasyon, klasor yapisi ve SQL script taslagi hazirligidir. SQL Server'a baglanti kurulmaz, script calistirilmaz, Vega veya baska bir database'e yazma yapilmaz.

## Kapsam ve Guvenlik Siniri

- Hedef database: `MELISA_ERP_V2`
- Vega database'e yazma yoktur.
- Vega test database dahil baska hicbir database'e mudahale yoktur.
- Ilk asamada sadece SQL Server uyumlu schema taslagi vardir.
- Scriptler production calistirma komutu degildir; review edilmeden uygulanmamalidir.
- ERP v2 tam muhasebe sistemi degildir. Stok, cari takip, satis, alis, katalog, terminal sync, raporlama ve audit odakli ticari ERP'dir.

## SQL Server Tasarim Standartlari

- Ana tablolar `dbo` schema altinda planlanir.
- Primary key standardi `BIGINT IDENTITY(1,1)` olarak kullanilir.
- Kod alanlari `NVARCHAR(30-80)` araliginda tutulur.
- Belge numaralari `NVARCHAR(30)` olarak planlanir.
- Para birimi kodlari `NVARCHAR(3)` olarak tutulur.
- Para tutarlari `DECIMAL(18,4)`, kur alanlari `DECIMAL(18,8)`, miktarlar `DECIMAL(18,3)` olarak planlanir.
- Tarih/saat alanlarinda `DATETIME2(0)` kullanilir.
- Kritik tablolarda `created_at`, `created_by`, `updated_at`, `updated_by` alanlari bulunur.
- Satir degisim takibi icin kritik tablolarda `ROWVERSION` kullanilir.
- Fiziksel silme yerine `is_active`, `is_deleted`, `passive_at`, `passive_reason` alanlari kullanilir.
- Hareket gormus urun, cari, tedarikci, fis ve belge kayitlari silinmez; sadece pasif/iptal edilir.

## Ana Tablo Gruplari

### Kullanici, Rol ve Yetki

- `roles`: patron, muhasebe, admin ve terminal kullanicisi gibi rol gruplari.
- `permissions`: rol bazli ekran ve islem yetkileri.
- `users`: web-admin ve terminal kullanicilari.

Kritik kurallar:

- Pasif kullanici sisteme giris yapamaz.
- Yetki degisikligi audit'e dusmelidir.
- Kritik islemler icin ekran bazli ve islem bazli yetkiler ayridir.

### Urun ve Stok Kartlari

- `products`: stok/urun karti ana kaydi.
- `product_barcodes`: ana barkod ve ek barkodlar.
- `product_images`: urun ve katalog gorsel referanslari.

Kritik kurallar:

- Ayni aktif barkod birden fazla urune baglanamaz.
- Hareket gormus urun silinmez.
- Pasif urun yeni fislerde secilemez.
- Urun para birimi hareket sonrasi kilitli kabul edilir.

### Cari ve Tedarikci

- `customers`: musteri/cari kartlari.
- `suppliers`: tedarikci kartlari.

Kritik kurallar:

- Hareket gormus cari veya tedarikci silinmez.
- Pasif cari yeni satis fisinde, pasif tedarikci yeni alis fisinde secilemez.
- Cari bakiye ticari takip amaclidir; resmi muhasebe defteri kapsami degildir.

### Fisler ve Stok Hareketleri

- `sales_invoices`
- `sales_invoice_items`
- `purchase_invoices`
- `purchase_invoice_items`
- `stock_movements`

Kritik kurallar:

- Taslak fis stok veya cari etki olusturmaz.
- Satis fisi kesinlesince stok duser ve cari hareket olusur.
- Alis fisi kesinlesince stok artar, tedarikci borcu olusur ve average cost guncellenir.
- Fis silinmez; iptal edilir.
- Stok hareketleri dogrudan kontrolsuz yazilmaz; kaynak belge/durum ile olusur.

### Doviz ve Kur

- `currency_rates`: gunluk veya operasyonel kur kayitlari.

Kritik kurallar:

- Fislerde kur snapshot'i saklanir.
- Gecmis belge sonradan kur degisince yeniden hesaplanmaz.
- TRY karsilik alanlari rapor ve dashboard icin ayrica tutulabilir.

### Katalog

- `catalogs`: katalog basligi ve musteri baglami.
- `catalog_items`: katalog urun satirlari.

Kritik kurallar:

- Pasif urun katalogda gosterilecekse durum bilgisi korunur.
- Katalog ticari fis yerine gecmez.

### Terminal Sync

- `terminal_devices`: terminal cihaz kayitlari.
- `terminal_sync_queue`: offline terminal olay kuyrugu.

Kritik kurallar:

- Terminal internet yokken satis kaydi olusturabilir.
- Sync geldiginde stok cakismasi olsa bile kayit kabul edilir.
- Eksi stok olusabilir; dashboard uyarisi uretilir.
- Duplicate request `client_request_id` ile engellenir.

### Audit

- `audit_logs`: kritik islem kayitlari.

Kritik kurallar:

- Fiyat degisikligi, fis iptal, stok duzeltme, yetki degisikligi, import ve terminal sync hatalari audit'e yazilir.
- Audit kaydi silinmez.

## Migration ve Seed Plani

Ilk dosya yapisi:

- `infra/sql/migrations/0001_melisa_erp_v2_initial_schema.sql`
- `infra/sql/seeds/0001_reference_roles_permissions.sql`

Migration taslagi:

- `MELISA_ERP_V2` database hedefini acik belirtir.
- Ana tablolar, foreign key'ler, check constraint'ler ve temel index'leri icerir.
- Seed data icermez.

Seed taslagi:

- Sistem rolleri ve temel permission key'lerini idempotent olarak hazirlar.
- Gercek kullanici, sifre veya credential icermez.

## Faz 1 Database Kapsami

Faz 1'de hedeflenen minimum DB hazirligi:

- Kullanici/rol/yetki temel tablolari.
- Urun, barkod, gorsel, cari, tedarikci ana kartlari.
- Satis/alis fis baslik ve satir tablolari.
- Stok hareket tablosu.
- Doviz snapshot altyapisi.
- Terminal cihaz ve sync queue tablolari.
- Audit log tablosu.

Bu fazda Vega import, Vega write-back, gercek terminal sync yazma ve production veri migrasyonu yoktur.

## Index ve Constraint Stratejisi

- Aktif barkod icin filtered unique index kullanilir.
- Stok kodu, cari kodu ve tedarikci kodu unique tutulur.
- Fislerde belge numarasi indekslenir.
- Satis/alis fislerinde musteri/tedarikci, tarih ve status alanlari rapor performansi icin indekslenir.
- Stok hareketlerinde `product_id`, `document_date`, `source_type`, `source_id` alanlari indekslenir.
- Terminal sync queue icin `status`, `terminal_device_id`, `client_request_id` indeksleri planlanir.
- Audit log icin entity, tarih ve kullanici indeksleri planlanir.

## Sonraki Faz Notlari

- Raporlama icin view veya materialized summary yaklasimi sonraki fazda degerlendirilebilir.
- Average cost hesaplama kesinlestirme transaction'i icinde yapilmalidir.
- Terminal sync idempotency testleri gercek cihaz akisi baslamadan tamamlanmalidir.
- Vega'dan aktarim gerekirse ayri import servisi ve audit izleriyle ele alinmalidir.
