# Melisa ERP durumu

3 Ekim 2026 — **kanonik kaynak ve teknik TEST smoke PASS; Sites ticari SQL entegrasyonu henüz tamam değil.**

- Kaynak: codex/canonical-live-20261003; paket commit dc2fdfeece74f7fd89d9b22f36c89264c4cd0710.
- LIVE baseline: 254 dosya hash'i; web 4/4 byte eşit yeniden derleme. API/native korunmuş; tek TEST ODBC adaptasyonu belgeli.
- TEST: 5194 **Sites yeşil arayüzü**, 4144/4146 ayrı TEST DB; salt okunur login ve LIVE DB erişimsizliği doğrulandı.
- Sites: v70/d559243 bulutta doğrulandı. 2351 yerel manifest dosyası / 10 yerel fark; yeşil uygulama ve devam kaynakları aynı kanonik repoda. Örnek akış localStorage kullanır; ticari SQL entegrasyonu olarak sunulmaz.
- Doğrulama: 354 Sites + 15 baseline testi; 26 smoke PASS; tarayıcıda yeşil ekran, konsol hatası yok.
- LIVE ve eski kaynaklar korundu; ana kirli ağacın 587 kaydı aynı. LIVE geçişi/ticari yazma yok.

**Kalan tek iş:** Sites'ın seçilen iş akışlarını kanonik API/SQL ile hedefli uzlaştırıp gerçek kullanım kabulünü tamamlamak.

[Bitirme planı](ERP_FINISH_PLAN.md) · [Kanıt ve sınırlar](https://github.com/melihsnyldzz-ui/melisa-erp-v2/blob/codex/canonical-live-20261003/docs/erp-v2/canonical-20261003/README.md) · [Kesin teslim](https://github.com/melihsnyldzz-ui/melisa-erp-v2/blob/codex/canonical-live-20261003/docs/erp-v2/canonical-20261003/delivery.json)
