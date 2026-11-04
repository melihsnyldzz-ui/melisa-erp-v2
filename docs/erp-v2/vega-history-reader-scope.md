# Vega geçmiş okuyucusunda kaynak ve dönem bağı

24 Ekim 2026 — D1/D2 kaynak teslimi. Gerçek Vega bağlantısı, arşiv yükleme, SQL değişikliği, çalışan uygulamaya kurulum veya insan kabulü yapılmadı.

## Değişen davranış

Mevcut legacy dönüşüm ve PREVIEW planı korunur. Okuyucu artık doğrulanmış manifestteki `database`, `companies`, `period`, `dateFrom` ve `dateToExclusive` kapsamını sorgu, satır doğrulaması, belge/satır ilişkisi, cari bağlantısı ve görünüm boyunca taşır. Aynı kayıt numarası başka şirket, dönem veya kaynak veritabanının kaydıyla birleştirilmez. Arşiv okumaları stok, cari veya kasa hareketi oluşturmaz.

Başlık ve satırın özgün tarihleri ayrı korunur; tarihlerin birbirine eşit olması şart değildir. Her kaydın tarihi kendi doğrulanmış dönem aralığında olmalı, satır aynı başlık ve belge ailesine bağlı kalmalıdır.

Eski çağrılar aynı `VEGA2026 / F0102,F0103 / D0007 / 2026` varsayılanını kullanır. Bu varsayılanın varlığı, gerçek arşivin kurulmuş olduğu anlamına gelmez. Yeni dönemler bu değişiklikte otomatik etkinleştirilmedi.

## Mevcut kodun bağlanma noktaları

- API sahibi `createVegaHistoryService({ approvedSources })` çağrısına gerçek, incelenmiş manifest kapsamlarını verir. Yapı kopyalanır ve kilitlenir. Aynı veritabanı/dönem için çelişen kayıtlar reddedilir.
- API sorgusu yalnız kayıtlı bir kapsamı `sourceDatabase` ve `period` ile birlikte seçebilir. Kayıtlı olmayan kaynak, F0104, dışarıdan tablo adı veya tarih aralığı kabul edilmez. Eski parametresiz dönem seçimi sabit 2026 kapsamıdır.
- Mevcut `VegaHistoryScreen` aynı manifestin `approvedSources` listesini alır. Başlıklar ve dönem seçimi manifest tarihlerini kullanır; veritabanı adından veya D kodundan yıl türetilmez. Kaynak değişince önceki cari/belge seçimi temizlenir ve eski bağlantı düğmeleri geçersizleşir.
- `VegaHistoryAccountLink` seçili `approvedSource` ile çalışır; kaynak/dönem ekran bağlamına ve mevcut URL düzenine taşınır. Ekran bağlamı onaylı listeyi genişletemez.
- Uygulamanın varsayılan servis/ekran kurulumuna gerçek manifesti bağlamak, gerçek metadata ve yükleme makbuzu ortaya çıktığında ERP sahibinin yapacağı iştir. HTTP/URL veya arşiv yanıtı kendi kendini onaylı kaynak ilan edemez.

## Şema ve metadata için açık kalanlar

Mevcut kaynakta `vega_history_account_links` için kanıtlanmış çok dönem şeması veya yükleyici bulunmuyor. Sabit eski 2026 hizmeti mevcut cari bağ sorgusuyla uyumludur. Birden fazla veya farklı dönem yapılandırıldığında cari bağ sorgusu **hem `source_database` hem `period`** alanlarını ve dönen satırdaki aynı bağı ister. Alanlar yoksa `HISTORY_ARCHIVE_NOT_READY`, yanlış bağ varsa `HISTORY_ARCHIVE_CORRUPT` döner; eski dönem eşleşmesiyle devam etmez. Bu kolonları ekleyen migration veya gerçek atama bu teslimde yapılmadı.

Mevcut paket-tarihi sorgusu bütün arşivin son paketini okur ve dönemle ilişkilendirilmiş metadata sözleşmesi yoktur. Yeni kapsam listesi kullanıldığında bu global tarih seçili dönemin tarihi diye gösterilmez; `captureCompletedAt` ve `importedAt` bilinmiyor (`null`) kalır. Gerçek yükleyicinin kaynak/dönem/paket kimliği bağını sağlaması ayrıca gerekir. Eski tek 2026 çağrısının tarih davranışı korunur.

Gerçek manifest, dönemlerin gerçek tarih sınırları, aileye göre tarih/döviz/cari kolonları, F0104 kapsamı ve kaynak ilişkiler hâlâ gerçek metadata gerektirir. Testteki D0001/2020 eşlemesi sentetik örnektir; gerçek Vega eşlemesi olarak kullanılamaz. Kullanıcının 1 Ocak 2020 başlangıç kararı kapsamdır, kaynakta her yılın bulunduğunun kanıtı değildir.

## Doğrulama ve teslim sınırı

- Mevcut 7 legacy dönüşüm testi korundu.
- 9 servis testi: kayıtlı dönem seçimi, sorgudan kapsam genişletememe, 2026 uyumu, kaynak kopyası, farklı dönem/şirket/veritabanı reddi, başlık/satır ailesi, ekstre bağlantısı, dönemli cari bağ ve eksik şema.
- 8 görünüm testi: çağrı parametreleri, seçili kapsam yanıtı, başlık/satır bağı, eski dönem düğmesinin reddi, cari bağ doğrulaması, URL, tarih etiketi ve mevcut ekranın gerçek React sunucu render'ı.
- İlgili 7 mevcut gezinme testi geçti. Toplam 31 hedefli kontrol, `offline-guard` ile ağ/SQL kapalı çalıştı.
- Web-admin build geçti; mevcut büyük paket boyutu ve lucide `use client` uyarıları kaldı.

Bu sonuç kaynak adayıdır. Gerçek arşiv okuması, yükleyici/şema, kurulu çok dönem ekranı, normal kullanıcı denemesi ve D1/D2 genel kabulü ayrı açık kalır. İkinci takip ağacı veya yeni aktarım motoru eklenmedi.
