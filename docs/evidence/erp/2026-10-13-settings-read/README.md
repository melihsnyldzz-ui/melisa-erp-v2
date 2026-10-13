# ERP16 / B08 — Ayarlar ve tarihli kurtarma bilgisi

13 Ekim 2026; ERP-DEC-050/053 ana devam kapsamında, yalnız salt okunur sistem görünümü. Eski kabul edilmiş yedek, restore veya Windows provaları tekrarlanmadı.

## Gerçek çalışan teslim

Uygulama source **0270d12a0870f382c0fdcd6783f6a22c91f798f3**, 1876 dosya; manifest **4383130eb6c15aa9b98d00872b5810dd317e967ca586fb6723b952f0a1af8882**. Web5234/API4184/native4186, DB02/copye16b70f0, actualT1=false. Ayarlar artık tarihli karşılaştırmayı **Kayıtlı kurtarma provası / Prova kontrol tarihi** olarak gösterir; güncel yedek doğrulandı demez. Root11/11, High GO, build ve secret scan0; normal15/16 önce–sonra iki summary GET'in eski alanları/rolleri aynı. Üç bağlantı hazır, Windows başlangıcı UNKNOWN, fiziksel kabul PENDING. Yeni ticari yazma, backup/restore veya eski prova tekrarı0. Startup225/CSS9/CRM kaynak ve sahibinin11staged kaydı/TEST125 korundu. B08🟡; UA20/32 bekliyor,49 toplam/9 tamam/39 kısmi/1 açık ve completeDelivery=false. Kaynak altı hostedCI kontrolü ödeme/harcama nedeniyle başlamadı; belge teslimi PR head'den ayrıca izlenir.

Normal adres: <http://192.168.1.46:5234/ornek-akis.html#settings>. Paket CANONICAL-COMPLETE-TEST-20261011-0270d12; logical packageId CANONICAL-TEST-0270d12a0870. Uygulama source, sonraki belge commit'i ve çalışan paket ayrı kimliklerdir. CRM09ca/nativeOrder60e ve özgün TEST125 edb3c8915ef kaynakları aynı. APKv22 değişmedi; HTTP kurulum ve APK HEAD doğrulandı, yeni cihaz kurulumu yapılmadı.

## Düzeltilen anlam

Önceki normal ekran, korunmuş shared recovery karşılaştırmasının comparedAt zamanını “Son başarılı yedek” olarak etiketliyordu. Bu zaman backup.completedAt veya yeni bir yedeğin tamamlanma zamanı değildir. Yeni API yalnız geçerli mühürlü copy kanıtında dört alanlı recoveryEvidence ekler: tarihsel karşılaştırma türü, kontrol tarihi, kayıtlı kapsam ve currentBackupVerified=false. Eski sekiz DTO alanı uyumluluk için korunur. Gerçek canonical backup.completedAt yolu aynı kalır.

Ekran artık **Kayıtlı kurtarma provası**, **Prova kontrol tarihi**, **Kayıtlı kapsam doğrulandı** ve **Güncel yedek: Henüz doğrulanmadı** der. Bozuk/tutarsız açık metadata gelirse eski başarılı değerler temizlenir; sır, dosya yolu veya ham kanıt gösterilmez. Eksik/null metadata normal canonical görünümü değiştirmez.

Korunmuş kanıtın kontrol tarihi 2026-10-09T21:00:45.9485948Z; Türkiye ekranında10Ekim00:00:45. Kapsam51kritik tablo/337modül ve kayıtlı native alanlardır; bütün veritabanı satırları veya sonraki işlemler değildir. Ayrı11Ekim kurtarma kanıtı kendi tarih/kapsamında korunur; yeni tekrar yapılmadı. Güncel backup dosyasının mevcutluğu/tazeliği bu görünümle kanıtlanmaz.

## Hedefli kontrol

- Root11/11 hedefli test, bağımsız High kaynak incelemesi, syntax/build ve source secret scan0.
- Aynı normal16 ve15 aktörle önce/sonra summary GET200; eski kullanıcı, yetki özeti, bağlantı durumları, terminal, backup/restore ve autostart alanları aynı. Yalnız paket/source ve taze kontrol zamanı değişir; tarihli metadata yeni. Kendi normal oturum giriş/çıkışı doğrulandı, ticari POST0.
- Üç servis exact API/native source-package-copy-DB ve kısıtlı SQL kimliğiyle hazır. Ayarlar'da CRM bağlantı satırı bulunmaz; bu CRM kapalı demek değildir. Ayrı gözetim heartbeat ve altı süreç guard'ı doğrulandı.
- Normal Chrome'da15/16, Yenile, yeni başlık/tarih/not, salt okunur görünüm ve üç hedefli genişlik incelendi. Gerçek viewport ölçümleri private browser-proof'tadır; settings/restore/reset yönetim kontrolü yok.

Tarayıcının mevcut yüzde80 yakınlaştırması korundu. Geçici sekme emülasyonu sıfırlandı; ilk browser viewport denemeleri bu sekmede etkili olmadı ve ayrı deneme olarak private kanıtta tutuldu.

| Hedef | Gerçek innerWidth | İçerik/clientWidth | scrollWidth |
| --- | ---: | ---: | ---: |
|1440|1440|1421|1421|
|1024 civarı|1023|1005|1005|
|390 içerik|408|390|390|

Orta görünüm tam1024 değildir; küçük görünümün408 innerWidth değeri masaüstü scrollbar/zoom farkını içerir. Bu ölçümler fiziksel Android cihaz testi veya kusursuz tüm ekran kabulü değildir.

Kaynakta değişen yalnız API service/test ve frontend controller/model/test olmak üzere5dosyadır. Route, SQL okuyucusu/yazıcısı, auth, kullanıcı rolleri, ticari hesaplama, startup225 veCSS9 değişmedi. Güncel ticari tabloları yeniden tarayıp bağımsız mutabakat yapıldığı iddia edilmez; yeni DB yazma/prova0 ve eski uygulama kanıtları korunur.

## Açık sınırlar

Windows otomatik başlangıç alanları bu copy okuyucusunda UNKNOWN; kurulu OPS02 teknik gözetim kanıtı gerçek Windows reboot/logon kabulü yerine geçmez. Terminal web yüzü hazır bilgisi personel/fiziksel kabul değildir; fiziksel barkod tekrar istenmez. Güncel yedek kapsamı, gerçek reboot ve UA20/UA32 insan sonucu açık. Genel ERP/LIVE teslimi tamamlanmadı; migration, temizlik, iptal edilen Hub giriş veya CRM işi başlatılmadı.

Private kanıt: C:/Sirket/ERP/evidence/ERP-COMPLETE01-20261013/private/b08-settings. API/oturum, ekran görüntüleri ve özel pipeline dosyaları GitHub'a yüklenmez. Public teslim yalnız kod/test ve bu sade teknik özettir.

GitHub: [PR23](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/23), branch codex/erp-finish-20261004. Source6check FAILURE_BILLING_NOT_STARTED; Vercel sonucu zorunluCI yerine kullanılmaz. Main merge/LIVE/Vega/T1/gerçek müşteri/ücretli servis yok.
