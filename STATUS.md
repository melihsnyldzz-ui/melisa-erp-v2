# Melisa ERP durumu

3 Ekim 2026 — **Yeşil Sites → kanonik API → gerçek TEST SQL: ayrılmış TEST kayıtları için teknik kabul PASS.**

- Paket kaynağı: `3eb36e70fddbbf4ff3a090e560153b5bfba7b3b8`; dal: `codex/canonical-live-20261003`.
- TEST: [yeşil Sites ekranı](http://127.0.0.1:5194/is-akisi-taslagi.html#home), API 4144; native 4146 salt okunur. DB: `MELISA_ERP_SIRKET_TEST_20260929_01`. LIVE DB erişimi yok.
- Önceki kabul servisleri hedefli olarak kanonik kaynağa alındı. Satış/alış, tahsilat, ödeme, iade ve sayım aynı kanonik invoice/finance/movement servislerini kullanır. İş kayıtları SQL’de; tarayıcı yalnız bekleyen istek/taslak kimliğini tutar. Örnek ekran ayrı kalır.
- Doğrulama: 354 Sites + 27 seçili kanonik test; 31 gerçek API/SQL kontrolü; 8 gerçek ekran yazma kontrolü; 16 ekran; 32 son smoke PASS. SQL dışı on tablonun diğer kayıt kontrol değerleri aynı.
- LIVE 254 dosya hash’i, sunulan HTML/JS/CSS ve süreçler aynı. Ana kirli ağacın 587 durum kaydı korunur. Eski paketler/kopyalar korunur; launcher yalnız bu kesin paketi hedefler.

**Kalan tek iş:** personelin TEST’te normal iş sırasını görerek iş kabulünü vermesi. Teknik kabul, ayrılmış TEST kayıtlarıyla sınırlıdır; tüm ticari kartlar, bütün Sites taslak özellikleri, fiziksel terminal veya LIVE geçişi için genel PASS değildir.

Fiyat/maliyet kanıtı ve geçmiş snapshot davranışı doğrulandı; kart fiyatı yazımı ve ayrıntılı çok satırlı alış taslağı açılmadı. DB’deki son USD/EUR kur tarihi 12 Eylül; güncel piyasa kuru iddiası yok.

[Bitirme planı](ERP_FINISH_PLAN.md) · [Ayrıntılı kabul](https://github.com/melihsnyldzz-ui/melisa-erp-v2/blob/codex/canonical-live-20261003/docs/erp-v2/canonical-20261003/sql-workflow-acceptance.md) · [Kesin teslim](https://github.com/melihsnyldzz-ui/melisa-erp-v2/blob/codex/canonical-live-20261003/docs/erp-v2/canonical-20261003/delivery.json)

