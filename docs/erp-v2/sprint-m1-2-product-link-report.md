# Sprint M1.2 — Product Link Acceptance Report

Tarih: 17.09.2026  
Migration run: `m12-20260917-01`  
Hedef: `MELISA_ERP_FULL_TEST_20260916`

## Sonuç

42.882 tarihi belge satırının tamamı sınıflandırıldı ve TEST'e yazıldı:

- **1.964** satır kanıtlı otomatik eşleşti.
- **40.918** satır `Manual Decision Required` olarak bırakıldı.
- Manuel liste `migration_decisions` içinde aynı run kimliğiyle saklandı.

Satırın mevcut kaynak alanları, miktar, fiyat, iskonto, tarih ve belge
bağlantıları değiştirilmedi. Yalnızca güvenli satırlarda mevcut `product_id`
alanı ve `product_link_status` güncellendi. Yeni stok hareketi, stok fişi,
belge veya cari/finans etkisi oluşturulmadı.

## Otomatik eşleşmeler

| Hedef satır tablosu | Sayı |
|---|---:|
| `sales_invoice_items` | 1.268 |
| `purchase_invoice_items` | 523 |
| `invoice_return_items` | 4 |
| `inventory_document_items` | 41 |
| `financial_document_items` | 128 |
| **Toplam** | **1.964** |

Eşleşme kanıtı yalnızca F0102 kaynak ürün kimliği alias'ı, benzersiz stok
kodu, benzersiz aktif barkod veya F0103 satır adının benzersiz stok kodu olduğu
durumlarda kabul edildi. F0103 tekrar eden tedarikçi kimlikleri ürün kimliği
olarak kullanılmadı; barkod çakışmaları otomatik çözülmedi.

## Manuel karar listesi

| Neden | Sayı |
|---|---:|
| `F0102_SOURCE_PRODUCT_NOT_IN_TARGET` | 5.353 |
| `F0103_GENERIC_STOCK_CODE_OR_NONUNIQUE_LINE_NAME` | 35.563 |
| `NO_UNIQUE_TARGET_PRODUCT` | 2 |
| **Toplam** | **40.918** |

Her kayıt `status=UNRESOLVED` ve `details_json.status=Manual Decision
Required` ile, kaynak satır anahtarı ve aday ürün kanıtı korunarak yazıldı.
Belirsiz barkod veya ürün eşleşmesi için tahmin yapılmadı.

## Güvenlik ve doğrulama

- TEST hedefi için `COPY_ONLY,CHECKSUM` yedeği alındı ve `RESTORE VERIFYONLY`
  başarılı oldu; geri yükleme çalıştırılmadı.
- Run `COMMITTED_M12_PRODUCT_LINK_REVIEW_REMAINS` durumunda commit edildi ve
  rollback yapılmadı.
- Kaynak satır yapısal hash'leri commit öncesi/sonrası aynı kaldı.
- Korunan terminal kayıtlarının hash'i değişmedi.
- Run kapsamında `stock_movements` ve `inventory_documents` ek kayıt sayısı
  sıfırdır.
- Vega2026 salt okunur kaldı; canlı ERP'ye yazılmadı.

Bağımsız Vega ↔ Yeni ERP karşılaştırması ve işletme kabulü bu raporla verilmiş
sayılmaz. Manuel kararlar kapatılmadan migration acceptance PASS değildir.
