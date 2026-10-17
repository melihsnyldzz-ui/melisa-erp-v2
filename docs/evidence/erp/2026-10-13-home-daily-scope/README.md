# ERP02 / B01 — Ana Sayfa günlük akış kapsamı

13 Ekim 2026. Aynı ERP tamamlama çalışmasının dar sunum düzeltmesidir. Uygulama source: `e03dcb5`; kaynak incelemesi GO ve 1.876 dosyalı paket build sonucu hazırdır. Çalışan paket ve gerçek ekran kontrolü aşağıdaki son doğrulama bölümündedir.

## Kapsam ve kullanıcıya görünen düzeltme

Yalnız üç frontend dosyası değişmiştir: `workHome.js`, `workHomeModel.mjs`, `workHome.test.mjs`. API, ticari hesaplama, roller, CSS ve başlangıç düzeni değiştirilmemiştir.

Doğrulanmış günlük profilin Ana Sayfa satış özeti iki kayıt; aynı 9 Ekim gününün daha geniş satış raporu beş kayıttır. Fark, okuyucuların kasıtlı farklı kapsamından kaynaklanır; eksik satış veya tutar farkı diye sunulmaz. Ana Sayfa bu dar kapsamı **Günlük akış özeti** ve **Günlük akış satışları** olarak açıklar. İş günü 09.10.2026, son okuma 13.10.2026 ayrı tutulur; tarihli kayıtlar bugünkü Vega veya mağaza günü sayılmaz.

Kapsam etiketi yalnız doğrulanmış `VERIFIED_BUSINESS_TEST` profili, mevcut `dailySelectionReady === true` ve doğrulanmış günlük bootstrap birlikte bulunduğunda gösterilir. Eksik/false metadata veya eksik günlük profil eski etiketleri korur; varsa geçersiz metadata doğrulamada reddedilir. Bu bilgi yalnız sunum içindir; ticari kapsam veya yetki açmaz.

**Raporları aç** düğmesi mevcut normal rapor izni ile taze HOME capability/navigation durumunun kesişimine bağlıdır. Finans yolu ayrıca taze finans capability gerektirir. Yeni rapor API rotası, açılışta ek rapor taraması, rol veya izin eklenmez.

Varsayılan mal kabulü özetinin boş olması, seçilmiş başka bir tedarikçinin kayıtlarının da bulunmadığını göstermez. Tedarikçi değişimi veya kayıt eşlemesi tahmin edilmez. Eşleşmeyen eski görev kapalı kalır; **Bu kayıt için işlem bağlantısı henüz doğrulanmadı** açıklaması yalnız ilgili kaydın bağlantısını anlatır. Çalışan Mal Kabul kısa yolu kapatılmaz; doğrulanmış görevlerin bağlantıları korunur.

## Korunan sınırlar ve kalanlar

Bekleyen iş listesi en fazla beş kayıttır; kısmi bir kuyruktur ve bütünü yalnız iş günüyle sınırlı sayılmaz. Genel bekleyen borç/vade ve gerçek kasa-banka açılışları henüz doğrulanmış değildir. TRY/USD/EUR birleştirilmez; bilinmeyen alanlara sahte sıfır veya başarı yazılmaz.

21/21 hedefli offline test geçti, kaynak incelemesi GO. Metadata fallback/ret, eski izin ile taze yetki reddi, doğru Raporlar yönlendirmesi, eşleşmeyen görevin çalışmaması, eşleşen görevin korunması, escaping ve yenileme hatasında eski bilgilerin kaldırılması kontrol edildi. Bunlar insan kabulü veya runtime kanıtı değildir. İlk dört yanlış girişli okuma 400 aldı; geçerli kapsam okumalarıyla ayrı tutulur ve bu olumsuz denemeler başarılı kontrol gibi sunulmaz.

Genel B01 **🟡 kısmi** kalır. UA05/UA17/UA32 insan kabulü bekler. Genel ağaç 49 toplam / 9 tamam / 39 kısmi / 1 açık; `completeDelivery=false`. Altı GitHub CI kontrolü hesap/harcama engeli nedeniyle başlamamıştır; yerel test ve build CI PASS yerine geçmez.

Ham okumalar, özel ekran görüntüleri, cari kimlikleri ve ticari tutarlar private kanıt alanında kalır; GitHub'a alınmaz.

## Son çalışan doğrulama

Uygulama source **e03dcb5e1eb77006233c29e1f966fe38b825b6cd**, 1876 dosya; manifest **b836880054c54599fddbaee84795c5d240e7a857e67defda12f1ae915245cb97**. Web5234/API4184/native4186, DB02/copye16b70f0, actualT1=false. Normal Ana Sayfa **Günlük akış özeti** ve kapsam notuyla kayıtlı9Ekim günlük profilini gösterir;13Ekim son okuma ayrı. Aynı tarihli HOME2fiş ile geniş Raporlar5fiş kapsam farkıdır, yeni hesaplama değildir. Yetkiye bağlı **Raporları aç** ve normal mevcut kısa yollar doğrulandı; doğrulanmamış kayıt bağlantısı kapalı ve kayıt özelinde açıklanır. Root21/21, HighGO, build ve secret scan0; normal15/16 önce–sonra14GET slotu(12başarı/2yetkired) aynı. Ticari yazma0; API0/startup225/CSS9/CRM kaynak+sahibinin11staged kaydı/TEST125 korunur. B01🟡; kasa açılışı/vade/borç ve genel görev bağlantıları, OPS01 hız, UA05/17/32 insan kabulü açık.49 toplam/9 tamam/39 kısmi/1 açık ve completeDelivery=false aynı. Kaynak6hostedCI kontrolü ödeme/harcama nedeniyle başlamadı; belge HEAD ayrı izlenir.

Paket CANONICAL-COMPLETE-TEST-20261011-e03dcb5; logical CANONICAL-TEST-e03dcb5e1eb7. Normal adres: <http://192.168.1.46:5234/ornek-akis.html#home>. Uygulama source, sonraki belge commit'i ve çalışan paket ayrı. CRM09ca/nativeOrder60e/özgün TEST125 edb3c8915ef aynı; yeni CRM işi veya iptal edilmiş Hub girişi açılmadı.

Chrome normal15/16 oturumunda kapsam başlığı/not, Raporlar bağlantısı, Yenile ve mevcut Mal Kabul kısa yolu salt okunur kontrol edildi. Seçili tedarikçi değişmedi; mevcut geçmiş kaybolmadı. Fiziksel Android/personel kabulü değildir. Kullanıcının80% zoom ayarı korunarak geçici responsive ölçüm yapıldı; override sonunda sıfırlandı.

| Hedef genişlik | window.innerWidth | body.clientWidth | body.scrollWidth |
| --- | --- | --- | --- |
| 1440 | 1440 | 1421 | 1421 |
| 1024 | 1023 | 1005 | 1005 |
| 390 | 408 | 390 | 390 |

Private kanıt C:/Sirket/ERP/evidence/ERP-COMPLETE01-20261013/private/b01-home: önce/sonra API, projection, süreç ve ekran kayıtları. Ham ticari veriler ve ekranlar GitHub'a yüklenmez.14karşılaştırmanın tamamında eski payload aynı; yalnız HOME meta.readAt taze okuma zamanı ve403 yanıtlarının meta.requestId istek kimliği karşılaştırmada ayrılır. İlk karşılaştırma değişken requestId nedeniyle durdu; ilk makbuz korundu ve yalnız bu metadata alanı ayırılarak aynı kayıtlar tekrar karşılaştırıldı. Bu bir uygulama hatası giderimi değildir. Yeni SQL tablo mutabakatı, yedek/restore veya eski işlem provasının yeniden yapıldığı iddia edilmez.

HOME API tekil süreleri: İlker16 önce3606ms / sonra4044ms; personel15 önce3220ms / sonra4045ms. Bunlar performans/SLA kabulü değildir; hız iyileşti iddiası yok. Bu teslim yeni ağır tarama eklemez; genel OPS01 hız açık kalır.

GitHub [PR23](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/23), branch codex/erp-finish-20261004. Source6check FAILURE_BILLING_NOT_STARTED; Vercel zorunluCI yerine kullanılmaz. Main/LIVE/Vega/T1/gerçek müşteri/ücretli servis yok.
