# Sabah mal kabul → alış → tedarikçi hareketi

ERP-DEC-014 / ERP-INBOUND01. Teknik uygulama ve prova sürüyor; insan kabulü yok.

## Başlangıç

- Kanonik kaynak: `codex/erp-finish-20261004`, başlangıç HEAD `af8fd1ba4fce02f51147c0ce6f6638bba65ccd6d`, açık draft PR23.
- Çalışan başlangıç: TEST53, source `11f17341dc69002aed8c249878c468058afc8da5`; web5194/API4144/native4146; aynı ayrılmış şirket TEST veritabanı.
- [Önceki hız](before-53.json): LAN HTTP, gerçek yetkili uygulama oturumu, 50 ürün ve her ölçüm üç tekrar. İş verisi yazması yok.
- [İşlem öncesi SQL fotoğrafı](native-before.json): yalnız ayrılmış sentetik C01/C02 kayıtları ve gece akışını korumak için dar sentetik karşılaştırma. Ürün301985:29ADET,325503:2ADET; tedarikçi13370:−100TRY. Bunlar sıfırlanmayacak.
- Yeni tur başlangıcında gece ürünleri17/18ADET, borç100TRY, kasa300TRY idi. Önceki gece raporundaki değerler güncel başlangıç sayılmaz; bu turdan önceki değişimin kaynağı bu salt okunur ölçümle belirlenmedi.

## Prova kapsamı

1. Personel sayımı: iki ürün, miktar değiştirme, kısa/fazla/yanlış işareti, kalıcı taslak ve yenileme.
2. Tanınmayan barkod: sahte kart veya stok etkisi olmadan kalıcı “stok kartı gerekli”; İlker incelemesi ve çözümlenmeden kabul engeli.
3. Fiziksel kabul: iki stok yalnız bir kez artar; çift tıklama, tam istek tekrarı ve yanıt kaybında aynı işlem sonucu.
4. Alış taslağı/finalize: mevcut kaynak fiyatları60/80TRY, immutable snapshot; stok tekrar değişmez, borç doğru değişir, yenileme aynı kaydı getirir.
5. Ters kayıt: borç eski değerine döner; fiziksel kabul stokları korunur. Mal iadesi bu belge iptalinin yerine geçirilmez.
6. Personel/İlker yetkileri: personelde alış fiyatı/maliyet/borç yok; yetkisiz ürün/karantina/genel ticari yazma reddedilir.
7. Mevcut TRY/USD/EUR kaynak snapshot altyapısı: yeni kur tahmini veya iki ürünlü döviz desteği uydurulmaz.
8. Normal ekranlar: mal kabul, alış/fatura, tedarikçi hareketi, günlük işler;1440/1024/390 ve açılış hızları.

CRM, LIVE/Vega yazması, main merge, stok/borç reseti, gerçek ticari kartlarda genel yazma ve terminal uygulaması kapsam dışıdır. Aşağıdaki sonuçlar tamamlanmadan teknik hazır veya kullanıcı PASS iddiası yoktur.
