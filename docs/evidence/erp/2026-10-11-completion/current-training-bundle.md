# Güncel kurulum ve eğitim arşivi — 11 Ekim 2026

ERP-COMPLETE01 kapsamında gerçek yeni arşiv oluşturuldu. Eski ZIP ve 19 eski eğitim dosyası byte/hash karşılığı değişmedi. Yeni runtime, kaynak/geri dönüş kaydı, APK ve eğitim tek dosyada; özel config, korumalı giriş kaydı, yedek veya restore aracı arşive alınmadı. Ticari işlem, cihaz/SQL/replay testi veya tarayıcı oynatım denemesi tekrarlanmadı.

| Alan | Doğrulanan sonuç |
| --- | --- |
| Arşiv | `C:\Sirket\ERP\deliveries\ERP-TERMINAL-20261011\Melisa-Terminal-v22-guncel-teslim-20261011-38f2c4b.zip` |
| Boyut / SHA256 | 20.015.890 byte / `c7ace081c95ed8c2582fb3a526835f6f07671813a51ed4c82a07bd1c576d730b` |
| Üyelik | 18 dosya; her üyenin ZIP'ten geri okunan byte sayısı ve SHA256 değeri staging karşılığıyla aynı; CRC temiz |
| APK | v22 /45.326.137 byte /SHA256 `4cbbde0a389924cf25d4eebb9fdb3692ace15edae4219b348c8df78027803bcf`; build source `f3d223be8d9af2ed41888f0e894bd2ba05aa46d9` |
| Eğitim | 5 MP4 +5 poster; HTML'deki 10 medya bağlantısı arşivde mevcut; adım/ekran eşlemesi `training-manifest.json` |
| Rehber ve manifestler | `KURULUM.md`, `runtime-access-update.md`, `EGITIM_KAPSAMI.md`, `egitim.html`, `training-manifest.json`, `source-recovery-manifest.json`, `delivery-manifest.json` |
| Kaynak ayrımı | Uygulama ERP571d/CRM09ca/native60e; paket tabanı belge teslimi38f2c4b. Bu yeni ZIP medya çekimlerini bu source'a yükseltmez; APK source ve belge head ayrı |
| Eski arşiv | 20.074.928 byte /SHA256 `9f51dbe5d8a2152d793be8969cc04de0828e411901a5c6f13706d37aa351fefc`; korunmuş |

## Adımların gerçek eğitim kapsamı

- **Mal kabul önceki tam kayıt,40,9sn:** tedarikçi/döviz→yeni sayım→elle barkod→adet→kaydet→yeniden aç→İlker'e gönder→gönderildi. Source5b/shareda51; APK pini bilinmiyor. İlker onayı/stok işleme/alış faturası yok.
- **Gönderilmiş sayımı yeniden okuma,63sn:** aynı sayımın tedarikçi, kod/barkod/adet ve gönderilmiş durumunu açıp yeniden okur. ERP2fb/CRM17ff çekimi; yeni sayım/kaydet/gönder/onay/fatura göstermez. Başlık İlker onayı yapılmış izlenimi vermeyecek biçimde düzeltildi.
- **Satış,95sn:** müşteri/döviz→barkod→sepet→toplam/önizleme→taslak→tamamlama→aynı fişi geri okuma. ERP2fb/CRM17ff; yalnız izole TRY örneği. Tahsilat ve bütün mağaza kabulü yok.
- **Koli,87sn:** aynı fişte iki koliye1+1→kalan0→kaydet→yeniden aç. ERP9cc/CRM09ca; düzeltilmiş altyazılı v2 video hash'i aynı.
- **Müşterilerim,42sn:** atanmış geçmiş ve mevcut gönderilmemiş taslağı yeniden okuma. ERP9cc/CRM09ca; yeni taslak yazma/gönderme/AI/çeviri yok. Yalnız süreç kapatma sonrası taslak dayanıklılığı ayrı denenmiş sayılmaz.

Son kaynakta ekran eşlemesi normal v22 görev adları, korunmuş cihaz/kare kayıtları ve güncel571d mal kabul/CRM yeniden açılış gözlemine dayanır. 9cc→571d workflow/terminal kaynak farkı yok; 2fb→571d satış modülü aynı, koli UUID düzeltmesi9cc klibinde. Yeni video çekimi yapılmadı. Eğitim HTML'i tarayıcıda oynatılmadı; önceki politika reddi başka URL/araçla aşılmadı. Önceki offline görüntü/ses doğrulaması korunur. İnsan ERP-UA32 bekliyor; tüm eğitimler bitmiş/insan PASS denmez.

Kaynak/geri dönüş manifesti yalnız güvenli hash ve kaynak kimliği taşır. 11 Ekim10:13–10:14 tarihli yedeğin önceki ayrı hedef restore kanıtını tarihli referans olarak gösterir; sonradan oluşan bütün hareketlerin güncel yedeği veya yeni restore provası saymaz. Kod geri dönüşünde yenilenmiş korumalı sırlar ve oturum journal'ları korunur; aktif hedefe otomatik restore/reset yok.

Root arşiv makbuzu: private `recovery-proof/current-training-bundle-archive-receipt.json`. Yeni staging için Gitleaks redacted dir taraması exit0/bulgu0; sır/config/veritabanı kopyası okunmadı. Binary videolarda bütün hassas veriler yok iddiası verilmez; yerel şirket eğitimi/ham medya GitHub'a yüklenmedi. Bağımsız arşiv incelemesi GO:18/18 üye, APK,5video/5poster özgün hash,10medya/rehber linki, adım ve kaynak kapsamı doğrulandı; config/backup/token/private receipt üyesi0. Altı `sourceAnchors` hash'i fiziksel çalışma kopyasının byte değeridir. `workSales.js` Windows CRLF ve Git38f LF farkı nedeniyle ham Git blob hash'ine eşit değildir; normalize edilmiş içerik aynı. Diğer beş anchor ham Git38f byte karşılığıyla da eşittir. Altı ham Git hash'i eşit iddiası yok. Son head CI teslim makbuzunda ayrı kaydedilir. [Güncel runtime/erişim](test-access-remediation.md); kurulum adresi `http://192.168.1.46:5234/install.html`. Bu yeni ZIP'in HTTP üzerinden yayınlandığı veya browser oynatıldığı iddia edilmez.
