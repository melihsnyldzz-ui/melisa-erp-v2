# PRODUCTION SWITCH — FINAL GO-LIVE

**PRODUCTION SWITCH: PASS**  
Run ID: `PRODUCTION-SWITCH-20260918-01`  
Tamamlanma zamanı: `2026-09-18 01:10 Europe/Istanbul`

## Sonuç

| Kontrol | Sonuç | Kanıt |
|---|---:|---|
| ERP production DB | PASS | `MELISA_ERP_PROD_CANDIDATE_20260917_01` |
| ERP runtime | PASS | `4114`, minimum yetkili SQL runtime, sysadmin=0, database CONTROL=0, DML=1, ALTER=0 |
| Terminal runtime | PASS | `4116`, aynı production DB ve aynı minimum yetkili runtime |
| Web runtime | PASS | `5188`, HTTP 200; ana ekran ile Satış, Alış, Stok, Müşteriler, Finans ve Ayarlar açıldı |
| Personel login | PASS | HTTP 200, `terminal_user` |
| Müdür login | PASS | HTTP 200, `owner_manager` |
| Patron login | PASS | HTTP 200, `admin` |
| TC21 fiziksel login | PASS | Zebra TC21, Melisa Native `1.0.0-candidate.18-t2`, canlı terminal adresi `4116` |
| Cari seçimi | PASS | TC21 üzerinde HANLAR / USD listelendi ve seçildi |
| Ürün arama | PASS | TC21 üzerinde `3008 BEBEDEX'S`, `0,22 USD` bulundu |
| İlk canlı satış | PASS | `MN-1e802899f0c64fd097d46fa769`, ERP id `34463`, HANLAR, 1 adet, 0,22 USD |
| Stok etkisi | PASS | Finalize ile -1; yetkili iptal ile başlangıca dönüş |
| Cari etkisi | PASS | HANLAR USD hesabı +0,22; iptal ile başlangıca dönüş |
| Duplicate finalize | PASS | HTTP 409 / `ALREADY_FINALIZED`; ikinci belge/stok/cari etkisi 0 |
| İptal geri dönüşü | PASS | Belge `cancelled`; stok ve cari net etki 0 |
| ERP ekran/API smoke | PASS | Satış, alış, müşteri, ürün/stok, tahsilat/ödeme, audit ve yetki uçları HTTP 200 |
| Schema parity | PASS | 0 fark |
| Açıklanamayan stok farkı | PASS | 0 |
| Cari+döviz farkı | PASS | 0; 1.044 hesap karşılaştırıldı |
| Duplicate etki | PASS | 0; belge, stok, cari, tedarikçi, finans ve terminal anahtarlarında duplicate yok |
| Terminal kayıtları | PASS | Kabul edilmiş 8 terminal olayının hash'i aynı; production smoke ile toplam 11 olay |
| STOCK-AUDIT-3 | PASS | 131 `MIGRATION_STOCK_CORRECTION`, toplam +12.464, 131 audit, finans etkisi 0 |
| STOCK-AUDIT-4 | PASS | `8031 MURAT BABY` birimi ADET, UNKNOWN 0, yeni ekonomik etki 0 |
| Rollback | PASS | Eski `MELISA_ERP_V2` değişmeden korundu; pre-switch ve post-switch CHECKSUM + RESTORE VERIFYONLY yedekleri hazır |

## Canlı servis durumu

- `Melisa-Production-20260918-Runtime`: **Running**, otomatik izleme açık.
- `Melisa-Production-Candidate-NightlyBackup`: **Ready**, günlük doğrulanmış backup görevi açık.
- Eski `Melisa-Pilot-20260913-Runtime`: **Disabled**.
- Eski `Melisa Vega Terminal API`: **Disabled**.
- Eski `MELISA_ERP_V2` yedek görevi açık bırakıldı; rollback tabanını yedeklemeye devam ediyor.
- Geçici LIVE-3 servisi `4233` kapatıldı.
- Yeni ERP ana sistem olarak açık bırakıldı.

## Rollback kanıtı

- Pre-switch eski canlı backup: 477.922.304 byte, CHECKSUM PASS, RESTORE VERIFYONLY PASS.
- Pre-switch production candidate backup: 6.667.341.824 byte, CHECKSUM PASS, RESTORE VERIFYONLY PASS.
- Smoke sonrası production backup: 6.668.128.256 byte, CHECKSUM PASS, RESTORE VERIFYONLY PASS.
- Eski `MELISA_ERP_V2` için satış, terminal, audit, stok ve cari hareket sayıları switch öncesiyle aynı kaldı.

## Nihai karar

- GO_LIVE_BLOCKER: **0**
- PRODUCTION SWITCH: **PASS**
- Ana ERP veritabanı: `MELISA_ERP_PROD_CANDIDATE_20260917_01`
- Rollback veritabanı: `MELISA_ERP_V2` (korundu, değiştirilmedi)

Makine yeniden başlatıldığında runtime görevi kullanıcının Windows oturumu açıldıktan sonra başlar. Yeni production yedek görevi de `Interactive` çalıştığı için planlanan saatte kullanıcının oturumunun açık olması gerekir.
