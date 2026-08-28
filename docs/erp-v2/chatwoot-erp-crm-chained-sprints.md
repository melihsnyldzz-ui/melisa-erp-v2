# Chatwoot ERP CRM Chained Sprints

## Hedef

Tek şirket WhatsApp hattı Chatwoot'ta karşılanır. ERP web-admin ve el terminali aynı Chatwoot konuşmasını güvenli ERP API katmanı üzerinden kullanır. Ülke, personel ataması, müşteri bağlamı ve katalog işlemleri aynı konuşma kimliğine bağlıdır.

## Tetikleme kuralı

Her sprintin statik testleri, servis testleri ve build kapısı geçmeden sonraki sprint başlamaz. Zincir şu komutla doğrulanır:

```powershell
node scripts\chatwoot-erp-crm-sprint-chain.mjs
```

Başarısız kapıda zincir durur. Gerçek mesaj, migration, canlı ERP yazımı veya yayın işlemi zincire dahil değildir; bunlar exact-run insan onayı gerektirir.

## Sprint zinciri

| Sprint | Çıktı | Sonraki sprinti açan kapı |
| --- | --- | --- |
| S01 | Chatwoot sağlayıcısı ve tek konuşma kimliği | CRM API testlerinin tamamı geçer |
| S02 | Doğrulanmış telefondan ülke/bayrak; LID belirsizse fail-closed | WhatsApp güvenlik sınırı testi geçer |
| S03 | ERP personeli, Chatwoot ataması, rol/yetki ve audit | İş akışı ve personel sınırı testleri geçer |
| S04 | Chatwoot konuşmasına bağlı salt-okunur ERP Müşteri 360 | Customer 360 testi geçer |
| S05 | ERP ürün/katalog arama ve konuşmaya ürün ilgisi ekleme | Ürün/katalog testi geçer |
| S06 | Onaylı katalog gönderim taslağı ve teklif kapısı | Teklif/sipariş güvenlik testi geçer |
| S07 | Terminalde personel oturumu ile atanmış konuşmaları cevaplama | Terminal CRM güvenlik kontrolü geçer |
| S08 | E2E regresyon, güvenlik, sağlık, yedekleme ve cutover kontrolü | Preflight ve web build geçer |

## İnsan onayı kapıları

- Test numarasına ilk gerçek mesaj.
- Canlı müşteri mesajı veya katalog gönderimi.
- Chatwoot takım/otomasyon kurallarını canlı hesapta değiştirme.
- SQL migration veya veri backfill çalıştırma.
- ERP siparişi, fişi, stok veya cari etkisi oluşturan işlem.
- Production deployment ve cutover.

Android native klasörü ile Expo yapılandırmasının uyumu ayrı cihaz/yayın kapısıdır. Bu kontrol zinciri CRM özelliğini doğrular; APK yayın onayı vermez.

## Geri dönüş

`WHATSAPP_PROVIDER=evolution` mevcut sağlayıcıya geri döner. Chatwoot geçişinde `WHATSAPP_PROVIDER=chatwoot` kullanılır. Her iki durumda da `WHATSAPP_SEND_ENABLED=false` varsayılan emniyet kilididir.
