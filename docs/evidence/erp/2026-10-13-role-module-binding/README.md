# ERP14 / C11 — mevcut rol ve modüller, Onaylar düzeltmesi

13 Ekim 2026; ERP-DEC-050/053 ana teslim kapsamında. Bu kayıt yeni rol yönetim sistemi veya yetki artışı değildir. Mevcut kabul edilmiş işlemler yeniden yapılmadı.

## Yeni çalışan sonuç

Çalışan uygulama source **747ac20647bf6b250a8f53a9c527e20f87796fef**, 1876 dosya, manifest **dd00c1db3b762b0222088dc61c106ca688691edcaccb1f51aec43fae895d8263**; web5234/API4184/native4186, DB02/copye16b70f0, actualT1=false. Normal Onaylar ekranı, İlker16 için sunucunun bildirdiği üç kaynaklı kısmi özeti artık gösterir. Personel15 onay toplamını göremez; mevcut izinli kaynak bölümlerine salt okunur geçiş onay yetkisi değildir. Değişiklik2frontend/test dosyası; root6/6, HighGO, build ve secret scan0. Değişen görünüm için yalnız2normal HOME GET karşılaştırıldı; eski veri, yetki ve üç kaynak aynı. B01’in eski14GET/provaları tekrar edilmedi. API0/startup225/CSS9/CRM kaynak+sahibinin11staged kaydı/TEST125 korunur; ticari yazma0. Mevcut15/16 modül kanıtları kendi tarih/source/kapsamıyla eşlendi. Gerçek personel–İlker–muhasebe kimlik matrisi ve UA18/32 açık; C11 genel durum🟡,49 toplam/9 tamam/39 kısmi/1 açık ve completeDelivery=false aynı. Source6CI ödeme/harcama nedeniyle başlamadı; belge HEAD ayrı.

Paket CANONICAL-COMPLETE-TEST-20261011-747ac20 / logical CANONICAL-TEST-747ac20647bf. Normal adres <http://192.168.1.46:5234/ornek-akis.html#approvals>. Uygulama source, sonraki belge commit'i ve çalışan paket ayrı kimliklerdir.

## Gözlenen hata ve dar düzeltme

Önceki e03 normal Onaylar ekranı, yetkili İlker16 için “Bekleyen işler şu anda okunamıyor” diyordu. Aynı sunucunun mevcut normal DTO'su available, approval capability true, count1, completefalse ve goods/count/purchase-return kaynaklarını bildiriyordu. Eski ekran tam dört kaynak, ayrıca sales-return beklediği için geçerli yanıtı reddediyordu. Bu somut görüntüleme arızası B01'in önceki yanlış probe/nonce kontrolünden ayrıdır.

Frontend okuyucusu şimdi yalnız sunucunun bildirdiği, bilinen dört türün boş olmayan tekil alt kümesini kabul eder. Eski dört kaynaklı yanıt ve mevcut mal kabulüyle sınırlı yanıt korunur. Satış iadesi kapsamı uydurulmaz; complete=false ve güvenli sayım şartı sürer. Boş/bilinmeyen/tekrarlı/sparse/bozuk kapsam reddedilir. Forbidden veya unavailable, sahte sıfır değildir. İzin/readiness bağlantı filtresi, sunucu guardları, metin/yeşil tasarım, onay/yazıcı ve hesaplama değişmedi.

Normal Chrome'da İlker16 için bir kontrol bekleyen kayıt ve üç mevcut kaynak bölümü göründü; personel15 “Onayları görüntüleme yetkiniz yok” gördü. Kaynak bölümüne gitmek onay vermek değildir. Ekranda yeni karar düğmesi veya ticari işlem yok. Yenile aynı yetki/kapsamı korudu. Fiziksel Android/personel kabulü değildir.

## Mevcut 15/16 modül eşlemesi

Aşağıdaki kontroller eski kabul ve makbuzlardan eşlenmiştir; bu tur yeniden denenmiş değildir. 15/16 ayrı doğrulanmış izole TEST kimlikleridir; üçüncü bir muhasebe hesabı veya gerçek çalışan kimliği varsayılmaz. Sunucu her istekte normal kimliği ve mevcut yetkiyi doğrular; UI tek başına güvenlik sınırı değildir.

| Modül | Personel15 kapsamı | İlker16 kapsamı | Korunan kanıt |
| --- | --- | --- | --- |
| Ana Sayfa | Yetkili günlük kayıt; finans/onay alanı gizli | Yetkili günlük akış ve kısmi onay | [B01](../2026-10-13-home-daily-scope/README.md) |
| Müşteri | Kanıtlı seçili müşteri/döviz geçmişini okur; genel düzenleme verilmedi | Mevcut kaynak müşteri/döviz okuması | [C05](../2026-10-13-open-account/README.md) |
| Genel ürün/tedarikçi kartı | Yeni tam genel kart matrisi bu eşlemede doğrulanmadı. Tarihsel TEST15 tedarikçi görüntüleme reddi korunur; müşteri okumasından tedarikçi yetkisi çıkarılmaz. | Önceki kart okuması ve tarihsel dar TEST düzenlemesi kendi DB/source sınırındadır; DB02 genel düzenleme izni değildir. | [Tarihsel tedarikçi kabulü](../../../erp-v2/canonical-20261004/supplier-card-acceptance.md) |
| Satış/fiş | Exact ürün-müşteri-döviz/kimlik bağı; mevcut satış kapsamı | Mevcut fiş/tahsilat okuması | [Terminal teslimi](../2026-10-11-completion/terminal-v22-delivery.md), [C05](../2026-10-13-open-account/README.md) |
| Mal kabulü | Sayım ve İlker'e gönderim; kendi kabulünü onaylayamaz | Mevcut onay yetkisi ve exact sayım/kabul bağı | [Görev devri](../2026-10-13-receiving-handoff/README.md) |
| Alış/fatura | Finanslı ofis okumaları403; izinli sayım görünümü | Kabul-fatura-kur/tutar okuması ve mevcut writer sınırı | [C02–C03](../2026-10-13-purchase-receipt/README.md) |
| Tahsilat/ödeme/kasa | Finans alanı gizli; ödeme403 | Mevcut hesabın ayrı döviz hareketleri ve yetkili bağ | [C08](../2026-10-13-finance-daily-read/README.md) |
| Sayım/iade | Salt okunur mevcut kayıt; finans gizli; farkı tek başına işleyemez | Mevcut stock.adjust/purchase.cancel ve kayıtlı ters bağ | [C10](../2026-10-13-count-return-read/README.md) |
| Raporlar | İzinli üç rapor; finanslı sayfa/export403, maliyet alanı gizli | Mevcut yedi rapor ve ayrı döviz/CSV | [B07–C15](../2026-10-13-daily-report-read/README.md) |
| Ayarlar | Kendi normal kimlik/rolünü okur; manage yetkisi verilmedi | Kendi kimlik/rol ve salt okunur sistem bilgisi | [B08](../2026-10-13-settings-read/README.md) |
| Onaylar | Forbidden/null; izinli kaynak kısa yolu karar yetkisi açmaz | Üç kaynaklı kısmi özet okunur | Bu turdaki2GET + yeni ekran kanıtı |
| Terminal/oturum | Aynı kimlik, korumalı oturum ve sunucu sınırı | Ayrı mevcut normal kimlik ve görev devri | [Erişim kanıtı](../2026-10-11-completion/test-access-remediation.md), [v22](../2026-10-11-completion/terminal-v22-delivery.md) |

Okuma200, redaction, düğme kapalı ve gerçek yazma403 birbirinin yerine kullanılmaz. Önceki satış/alış/sayım/iade yazma-replay-inverse ve çıkış/iptal makbuzları kendi tarih/DB/source sınırında korunur. E03→747 değişikliği yalnız görünüm olduğundan API/native/rol kodu aynı; geçmiş kanıt güncel fiziksel veya insan PASS'a çevrilmedi. Genel katalog/cari düzenleme, tüm yazma aksiyonları veya tüm olası rol kombinasyonları için yeni tam matris iddiası yok. ERP/CRM kullanıcıları token veya ad benzerliğiyle eşlenmedi. CRM işi paused kaldı.

## Hedefli teknik kanıt ve kalan bağımlılık

- Root6/6 değişen nativeApprovals testi, bağımsız High kaynak incelemesi, build ve dar secret scan0.
- İki yeni normal HOME GET yalnız değişen Onaylar görünümü içindir. B01 e03 sonrası makbuz önceki görüntü olarak tekrar kullanıldı. Payload yalnız readAt ayrılarak aynı bulundu;16 available/count1/exact3 kaynak ve15 forbidden/null korunur. Kendi yardımcı oturum giriş/çıkışı dışında ticari POST0.
- İlk süreç gözlemi tüm hizmetler açılmadan önce3/6 geldi; ilk makbuz korundu. Ek restart veya guard değişimi olmadan kalan hizmetler açılınca aynı kontrol geçti. Bu, Onaylar değişikliğiyle giderilmiş bir servis arızası değildir.
- Altı süreç/dört health/manifest/normal asset, DB02/copy ve original TEST125/source edb3c8915ef korundu. CRM09ca/nativeOrder60e, sahibinin11staged dosyası ve v22APK aynı; yeni cihaz kurulumu yok.
- Private c11-roles ekran/okuma/rol eşleme/verification makbuzları GitHub'a yüklenmez. SQL tablosu yeniden taranmadı; yedek/restore veya eski işlem provasının tekrarı yok.

C11'in mevcut15/16 normal modül okuma ve sunum alt kapsamı teknik olarak eşlendi; bu turdaki somut Onaylar arızası kapatıldı. Üç gerçek insanın kullanıcı/rol/iş devri, ayrı muhasebe kimliği ve geniş günlük işletim kabulü kanıtsızdır. Bu bağımlılık tahmin veya yeni grant ile kapatılmaz; diğer bağımsız yetkili işler bunu beklemez. ERP-UA18/32 bekliyor; genel49/9/39/1 ve completeDelivery=false değişmedi.

[PR23](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/23), branch codex/erp-finish-20261004. Source6CI FAILURE_BILLING_NOT_STARTED. Main/LIVE/Vega/T1/gerçek mesaj/ücretli servis, yeni kullanıcı/parola/rol veya iptal edilen giriş işi yok.
