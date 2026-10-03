# Commerce web / SQL kabulü — 2026-09-08

## Kanıtlanan kapsam

İzole `commerce-sql-20260908` SQL sunucusu (127.0.0.1:51433), uygulama API'si (127.0.0.1:54100) ve gerçek web-admin (127.0.0.1:54173) kullanıldı. Tarayıcı agent-browser 0.37.0, ayrı oturum ve yalnız 127.0.0.1 alan izniyle çalıştı. API yalnız test SQL portuna çıkabilir; Vega, dış HTTP, alt süreç, yazıcı ve mesajlaşma yolları kapalıdır. Test hesabı normal şifreli giriş yaptı; parolalar depo dışındadır. Uygulama SQL hesabında CREATE TABLE ve sysadmin yetkisi yoktur.

Tarayıcıdan TEST-WEB-P1 ürün kartı (30 TRY satış / 12 TRY alış / barkod 8692026090801), TEST-WEB-C1 müşteri ve TEST-WEB-S1 tedarikçi oluşturuldu. Telefon zorunluluğu boş girişte kaydı engelledi; yalnız yapay 0000000000 kullanıldı. Ürün açıkça test tedarikçisine bağlandı. Başlangıç stoku ve bakiyeler sıfırdı.

| Aşama | Stok | Müşteri bakiye | Tedarikçi bakiye | Kasa |
|---|---:|---:|---:|---:|
| 10 × 12 TRY alış taslağı | 0 | 0 | 0 | 0 |
| Alış kesinleştirme | 10 | 0 | 120 | 0 |
| 2 × 30 TRY satış taslağı | 10 | 0 | 120 | 0 |
| Satış kesinleştirme | 8 | 60 | 120 | 0 |
| 20 TRY tahsilat, 10 TRY ödeme | 8 | 40 | 110 | 10 |

Her aşama gerçek SQL SELECT ve beklenen değer assertions ile kontrol edildi. Bir alış, bir satış, iki stok hareketi ve iki kasa hareketi oluştu. Kalıcı test ürün/satış/müşteri ID 10002, tedarikçi/alış ID 1; SQL identity boşlukları hata değildir. Son kontrol `inspect-web.mjs finance-final` ile salt okunur tekrarlanabilir. Test verileri korunur; gerçek iş verisi kullanılmadı.

## Düzeltmeler

- Temiz şemada eksik `products.supplier_id`, 0018 migration ile nullable BIGINT ve doğrulanan foreign key olarak tanımlandı. Mevcut ürünlere tedarikçi tahmin edilmez. Migration yalnız test sunucusunda iki kez çalıştırıldı; ticari değerler korunur, geçersiz tedarikçi reddedilir. Üretim migration uygulanmadı.
- Stok listesi Vega (varsayılan, salt okunur) ve Melisa ERP kaynaklarını açık seçtirir. Kaynak değişimi görünümü yeniden kurarak seçili kayıt, düzenleme diyaloğu ve eski sonucu ayırır. Vega hata halinde de yazma kontrolleri açılmaz.
- Alıştaki genel ürün araması artık metni ayrıca barkod zorunluluğu olarak göndermez. Gerçek SQL ile ürün adı ve barkod seçimi doğrulandı; tedarikçi sınırı korunur.
- Kesinleşmiş/iptal fiş etiketleri taslaktan ayrıldı. Alış stok etkisi duruma göre gösterilir. Satışın saklanan eski stok metni güncel stok gibi sunulmaz. Fiş yeniden açılırken yanlış “ticari etki yok” ifadesi kaldırıldı.

Web typecheck 182 kök / 0 tanı; lint PASS; web güvenlik testleri ve gerçek React tablo render testleri PASS; web build PASS. Büyük bundle uyarısı sürer. Render testleri satış/alış yazma güvenliğinin yerine geçmez; yukarıdaki gerçek SQL kabulü ayrıdır. HTTP hataları içinde yapılandırılmamış Vega kaynağına ait beklenen 503 yanıtları vardır; genel sıfır hata iddiası yoktur.

## Açık işler — tam ERP kabulü değildir

- Müşteri, tedarikçi ve satış/alış listeleri halen Vega kaynağına sabit bağlı. Melisa kartları oluşturulabilse de bu listelerin kaynak ayrımı tamamlanmalı.
- Test isimli cari/fişler finans hareket sorgusunda bilinçli dışlanır. Bu örneklerle boş liste, tüm ticari raporların kabul kanıtı değildir. Sonraki testte ayrı SQL ortamındaki açıkça işaretlenmiş fakat filtreye takılmayan yapay örnekler kullanılmalı; üretim filtresi gevşetilmemeli.
- Stok Hareketleri: TEST-WEB-P1 sekmesi diğer ürünlerin hareketlerini de gösterdi. Bağlantıdaki ürün kapsamı aktarımı araştırılmalı.
- Varsayılan satış/alış belge numaraları “Taslak” / “Alış Taslağı” olarak saklandı. Yeni birden fazla fişte benzersiz numara akışı doğrulanmalı.
- Kasa açılış/kapanış, tam raporlar, düzeltme/iptal, çoklu döviz, stok sayım yetkisi ve diğer ticari senaryolar henüz tamamlanmadı.
- GitHub main / çalışan kaynak / korunan f639 uzlaştırması ve sonraki Product Brain, katalog/site, Terminal gerçek ürün kontratı, Shipping aşamaları açık.

Ana Development OS kayıtları ve ekran/SQL/log hashleri `reports/ERP_WEB_SQL_ACCEPTANCE_20260908.md` ve `audit/commerce-no-messaging-20260908/erp-web-sql-acceptance/acceptance.json` içindedir. Bu paket push, PR, merge veya deploy değildir.
