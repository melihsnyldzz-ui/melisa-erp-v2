# CRM06 — mevcut ortak TEST servislerinin kurtarılması

14 Ekim 2026. ERP-COMPLETE01 içinde seçilen tek ana kapanış CRM06 / K01–K03'tür. Bu kayıt servis kurtarma ve veri korunması alt kanıtıdır; CRM06'nın tamamlandığı veya insan kabulünün verildiği anlamına gelmez.

## Olay ve yapılan işlem

13:00:10 Türkiye saatinde mevcut ortak supervisor sonlandı. Korumalı shell receipt Windows native çıkış kodunu `-1073740791` (`0xC0000409`) kaydetti; kesin neden bulunmadı. Bu kod tek başına kök neden veya veri kaybı kanıtı değildir. Hub süreci çalışmaya devam ediyordu; ortak uygulama portları dinlemiyordu.

Mevcut `Melisa-Terminal-Completion-Logon` görevi aynı kurulu paketle başlatıldı. Task tanımı, ayarlar, config, paket, SQL, roller ve veri değiştirilmedi. Yeni build, eski pakete dönüş, restore/reset/silme yapılmadı. Bu kurtarma kanıtı yeniden açılış kontrolü için kullanılacak; sırf tekrar test etmek için ek restart yapılmayacak.

## Taze doğrulama

- ERP/Hub/native source `7a41f6492273dd1ec0bcb086f820be5575372be8`; CRM source `5b6dfe5acf1c0c1ea301f66aea39bf2abcec8f36`. Eski `1be7277` hazırlık paketi yeni kurulum talebi sayılmadı.
- Mevcut settings SHA256 `7111125420c9a1f6bb7832dc022f849fbc873c55bf52c847ec68e53cb1856335` aynı. Altı gerçek OS süreç için source/owner/parent/creation/binding kontrolleri geçti.
- ERP API4184, native4186 ve CRM native62704 gerçek `/test-health` yanıtları aynı mühürlü DB02/copy kimliğini, `actualT1=false`, dış işlemler/otomatik işler kapalı ve dört yükseltilmiş SQL erişiminin sıfır olduğunu doğruladı. Hub5234 aynı source/copy/DB02/T1 kimliğinde.
- CRM62700/62701, katalog62702 ve orders62703 mevcut owned süreçlerdir. CRM gateway `/health`: `ok`, `crm-local`, `disabled-preparation`; provider/send/bridge/translation kapalı. `crm-health-status.json` gözlem zamanı `2026-10-14T10:42:11.856Z`, source5b6, state running, ERP/native ready. Katalog/orders için `/test-health` normal health sözleşmesi değildir; 404/401 servis arızası olarak değerlendirilmedi.
- Bağımsız salt okunur SQL karşılaştırmasında 21 iş/rol/journal tablosunun tam satır hashleri ve sayıları kesinti öncesiyle **21/21 aynı**. Yeni talep, stok/cari/fiş/satış etkisi oluşturulmadı.

Private eski guard'ın 10 saniyelik OS probe bütçesi doldu; yeni private kopyada yalnız timeout 180 saniyeye alındı. Pin ve bütün guard koşulları aynı kaldı; bağımsız inceleme GO. Üretim guard'ı veya paket değiştirilmedi. Yeni helper gerçek kontrolde başarılı oldu.

Ham SQL sonuçları, hesaplar ve kimlikler repo dışında korumalı kanıt alanındadır. Anonim kanıt hashleri:

| Kanıt | SHA256 |
| --- | --- |
| Private kurtarma guard helper | `BBDA87861726F35BB0C26DA1AC32E11D41CBFCF4E3C03EC9FF2B57F502FE8DF9` |
| 21 tablo karşılaştırma sonucu | `AF56997957114B339E19944693498EBD8A3CBFECC859415AAAE05239444DD040` |

14 Ekim 10:52 korumalı COPY_ONLY/CHECKSUM/HEADERONLY/VERIFYONLY DB02 yedeği korunur; aktif restore yapılmadı. Ayrı cihaz kopyası doğrulanmadı.

## CRM06 kapanış sınırı

CRM sahibi özgün K01/K02/K03, fb34 ürün talebi, atanmış personel/readback/yanlış personel403 ve kabul edilmiş ürün gönderme kanıtlarını son5b6 kapsamına eşler. Gerçek foto/kategori/arama ve fiyat/döviz; normal müşteri seç–adet değiştir–çıkar–yenile–tek talep; atanmış personel, yanlış personel reddi, yeniden açılışta korunma ve normal mobil şartlar birlikte kapanmalıdır. İlgi talebi ERP satışı, stok, belge veya gerçek müşteri mesajı değildir.

Korumalı normal issuer erişimi ve izinli tarayıcı yüzeyi eksikse bu somut bağımlılık açık kalır. View-only TEST agent veya TEST ADMIN normal personel yerine geçirilmez; parola/rol/grant/bypass yok. Kullanıcının CRM'de “Açtım” cevabı kaydedildi; bağlı yüzeyde HTTP dokümanı görülmeden GUI sonucu iddia edilmez, mevcut ret alternatif araçla aşılmaz. Bu alt kanıt 55 ana başlıktaki kapanış sayısını değiştirmez.

Çalışan adresler: [MELISA HUB](http://192.168.1.46:5234/melisa-hub/), [ERP](http://192.168.1.46:5234/ornek-akis.html#stock), [CRM](http://192.168.1.46:62700/). Adres/health kanıtı normal kullanıcı akışı veya insan PASS değildir.
