# ERP04 / A02 — son çalışan DB02 alış referansı — 13 Ekim 2026

Source **c3a84d0cbdfb5612851e2e5ca5ae4da255c7474c**;1879 dosya, manifest **df89806415e42c71051829d46c533879ac7831920ac90219e1949f973a7d8581**;5234/4184/4186,DB02/copye16b70f0,T1false. Normal yetkili ürün kartı ve API'de belge net referansı/kart alış ayrımı doğrulandı;26/26/GO ve preflight, yeni ticari yazma0. [Kanıt](../2026-10-13-price-reference/README.md). TEST125/CRM/roller/eski SQL guardlar korundu. Genel fiyat yazıcı404, DB02 fiyat revision/owner EXEC/tüketim bağımlılığı açık; A02/C09 ve UA26/32 kapanmadı. Source6CI ödeme/harcama nedeniyle başlamadı; completeDelivery=false. Aşağıdaki b79 ve eski kayıtlar tarihsel teslimlerdir.

# ERP03 / A01–B02 — son çalışan stok güven sunumu — 13 Ekim

Çalışan uygulama source **b79ce51db7af0f72bb7e72666dd11729d72e3578**, 1877 dosya, manifest **0f33efe6144ade8f3fb0ed025af99b5490034c7e48ada6d257b39ebf9e756b82**; web5234/API4184/native4186, DB02/copye16b70f0, actualT1=false. Normal liste ve kartta miktar NULL ise **Bilinmiyor**, miktar kayıtlı fakat hold/birim doğrulanmamış ise **Doğrulanmadı** görünür. Doğrulanmış sıfır ve işaretli negatif miktar mevcut exact gösterimle korunur. Üç frontend/test dosyası; root4/4, HighGO, build ve secret scan0. İki normal yetkili kart GET'inin bütün verisi ve readAt dışındaki metası önce–sonra aynı; API/native/veri/filtre/hesaplama/yetki değişikliği0, ticari yazma0. Startup225/CSS9/CRM kaynak ve sahibinin11staged kaydı/original TEST125/v22APK korunur. A01🟡, B02 geçmiş🟢 kabulü aynı;49 toplam/9 tamam/39 kısmi/1 açık, ERP-UA26/32 bekliyor, completeDelivery=false. Source6CI ödeme/harcama nedeniyle başlamadı; belge HEAD ayrı. [Stok güven durumu kanıtı](../2026-10-13-stock-card-trust/README.md)

Aşağıdaki C11 ve önceki kayıtlar tarihsel teslimlerdir; son runtimeb79ce51'tür.

# ERP14 / C11 — son çalışan rol/sunum bağlantısı — 13 Ekim

Çalışan uygulama source **747ac20647bf6b250a8f53a9c527e20f87796fef**, 1876 dosya, manifest **dd00c1db3b762b0222088dc61c106ca688691edcaccb1f51aec43fae895d8263**; web5234/API4184/native4186, DB02/copye16b70f0, actualT1=false. Normal Onaylar ekranı, İlker16 için sunucunun bildirdiği üç kaynaklı kısmi özeti artık gösterir. Personel15 onay toplamını göremez; mevcut izinli kaynak bölümlerine salt okunur geçiş onay yetkisi değildir. Değişiklik2frontend/test dosyası; root6/6, HighGO, build ve secret scan0. Değişen görünüm için yalnız2normal HOME GET karşılaştırıldı; eski veri, yetki ve üç kaynak aynı. B01’in eski14GET/provaları tekrar edilmedi. API0/startup225/CSS9/CRM kaynak+sahibinin11staged kaydı/TEST125 korunur; ticari yazma0. Mevcut15/16 modül kanıtları kendi tarih/source/kapsamıyla eşlendi. Gerçek personel–İlker–muhasebe kimlik matrisi ve UA18/32 açık; C11 genel durum🟡,49 toplam/9 tamam/39 kısmi/1 açık ve completeDelivery=false aynı. Source6CI ödeme/harcama nedeniyle başlamadı; belge HEAD ayrı. [Rol ve modül eşleme kanıtı](../2026-10-13-role-module-binding/README.md)

Aşağıdaki B01 ve önceki kayıtlar tarihsel teslimlerdir; son runtime747ac20'dir.

# ERP02 / B01 — son çalışan Ana Sayfa kapsamı — 13 Ekim

Uygulama source **e03dcb5e1eb77006233c29e1f966fe38b825b6cd**, 1876 dosya; manifest **b836880054c54599fddbaee84795c5d240e7a857e67defda12f1ae915245cb97**. Web5234/API4184/native4186, DB02/copye16b70f0, actualT1=false. Normal Ana Sayfa **Günlük akış özeti** ve kapsam notuyla kayıtlı9Ekim günlük profilini gösterir;13Ekim son okuma ayrı. Aynı tarihli HOME2fiş ile geniş Raporlar5fiş kapsam farkıdır, yeni hesaplama değildir. Yetkiye bağlı **Raporları aç** ve normal mevcut kısa yollar doğrulandı; doğrulanmamış kayıt bağlantısı kapalı ve kayıt özelinde açıklanır. Root21/21, HighGO, build ve secret scan0; normal15/16 önce–sonra14GET slotu(12başarı/2yetkired) aynı. Ticari yazma0; API0/startup225/CSS9/CRM kaynak+sahibinin11staged kaydı/TEST125 korunur. B01🟡; kasa açılışı/vade/borç ve genel görev bağlantıları, OPS01 hız, UA05/17/32 insan kabulü açık.49 toplam/9 tamam/39 kısmi/1 açık ve completeDelivery=false aynı. Kaynak6hostedCI kontrolü ödeme/harcama nedeniyle başlamadı; belge HEAD ayrı izlenir. [Ana Sayfa kapsam kanıtı](../2026-10-13-home-daily-scope/README.md)

Aşağıdaki ERP16 ve önceki kayıtlar tarihsel teslimlerdir; güncel runtimee03dcb5'tir.

# ERP16 / B08 — son çalışan Ayarlar görünümü — 13 Ekim

Uygulama source **0270d12a0870f382c0fdcd6783f6a22c91f798f3**, 1876 dosya; manifest **4383130eb6c15aa9b98d00872b5810dd317e967ca586fb6723b952f0a1af8882**. Web5234/API4184/native4186, DB02/copye16b70f0, actualT1=false. Ayarlar artık tarihli karşılaştırmayı **Kayıtlı kurtarma provası / Prova kontrol tarihi** olarak gösterir; güncel yedek doğrulandı demez. Root11/11, High GO, build ve secret scan0; normal15/16 önce–sonra iki summary GET'in eski alanları/rolleri aynı. Üç bağlantı hazır, Windows başlangıcı UNKNOWN, fiziksel kabul PENDING. Yeni ticari yazma, backup/restore veya eski prova tekrarı0. Startup225/CSS9/CRM kaynak ve sahibinin11staged kaydı/TEST125 korundu. B08🟡; UA20/32 bekliyor,49 toplam/9 tamam/39 kısmi/1 açık ve completeDelivery=false. Kaynak altı hostedCI kontrolü ödeme/harcama nedeniyle başlamadı; belge teslimi PR head'den ayrıca izlenir. [Ayarlar okuma kanıtı](../2026-10-13-settings-read/README.md)

Aşağıdaki ERP15 ve önceki kayıtlar tarihsel teslimler olarak korunur; son runtime0270d12'dir.

# ERP15 / B07–C15 — son çalışan rapor görünümü — 13 Ekim son teslim

Source **b68aa1b7f6b3e6d044a6d275b587c0d849c03e38**,1876dosya/manifest5f7d8fe3a0ca75a7b867ad872ea14e76b970d3c4292c314654f58b2749bbe65c;5234/4184/4186/DB02/copye16b70f0/T1false. Rapor maliyeti artık kayıt var/yok olarak gösterir; kâr/proof iddiası yok. Root9/9/HighGO/build/secret0;46ortakGETsame+2USD,10native set aynı,10page/CSVparitesi+USD ayrı,8personelfinance403. Normal7rapor/dönem/döviz/stok50/Yenile ve gerçekCSVbyteeşliği kanıtlı; ticariyazma0. [Günlük rapor okuma kanıtı](../2026-10-13-daily-report-read/README.md). API0/startup225/CSS9/CRM11staged/TEST125 aynı. B07/C15🟡/UA19-UA32bekliyor/49-9-39-1/completeDeliveryfalse; genelişletme/tarihselVega/gerçekaçılış/insan veOPS01hız açık. Source6CI ödeme nedeniyle başlamadı; docHEAD ayrı.

Aşağıdaki ERP13/ERP12/ERP11 kayıtları kendi tarihsel paket/kanıtlarıyla korunur; son runtimeb68aa1b'dir.

# ERP13 / C10–C11 — mevcut sayım/iade görünümü — 13 Ekim son teslim

Source **0bf8f7df584fe975f912af7dea3507e41c1eebd2**,1876dosya/manifest8d4f77c234db50bf85cce6c89937a471b5ef7a45040832660a42302957bc8a8c;5234/4184/4186/DB02/copye16b70f0/T1false. Mevcut normal sayım/iade geçmişinde kayıtlı geri alma gerekçesi özgün gerekçeden ayrı, iptal sayım incelemesi salt okunur. Root17/17/HighGO/build/secretscan0;4GET/15native set aynı,2mevcut ters bağ/native journal doğrulandı, ticariyazma0. Normal15/16/Yenile/üç hedefli genişlik kanıtlı; API0/CSS9/startup225 veCRM11staged/TEST125 aynı. [Sayım–iade okuma kanıtı](../2026-10-13-count-return-read/README.md). C10/C11🟡; genelFX/çok satırlı iade/batchinverse/kimlik matrisi ve UA15/16/18/32bekliyor.49-9-39-1/completeDeliveryfalse aynı. Source6CI ödeme nedeniyle başlamadı; docHEAD ayrı.

Aşağıdaki ERP12/ERP11 kayıtları kendi tarihsel paket ve kanıtlarıyla korunur; son runtime0bf8f7d'dir.

# ERP12 / C08 — mevcut günlük finans okuması — 13 Ekim son kanıt

Çalışan source **f2f922af81be6a1852f49ee7a6cf5c6bdb7a1477** ve immutable f2f922a paketi aynı;5234/4184/4186/DB02/T1false. Normal16 mevcut tahsilat/ödeme/hesap/fiş-kabul geçmişi ve Yenile; personel15 ödeme403.17GETeski payload/9native recordset aynı;7nativefişbaşlığı (16günlük2+15readonlyuyum),1tahsilat/1ödeme/1hesap exacttutar-döviz-yön/journal bağlandı. Ticariyazma0; uygulama/paket/runtime/yetki değişimi0, eskiprova tekrarı0. [Günlük finans okuma kanıtı](docs/evidence/erp/2026-10-13-finance-daily-read/README.md). Hareketneti/bakiye/açılış ayrı; UNKNOWN açılış, banka/genelFX/günsonu/insan kabulü açık. C08/B06🟡,UA14/UA32bekliyor,49-9-39-1/completeDeliveryfalse aynı. SourceCI6ödemeengeli, yeni docHEAD ayrı.

Önceki ERP11 kaynak/paket kanıtı son çalışan sürümdür; yeniden build/restart gerekmedi.

# ERP11 / C02–C03 — kayıtlı fatura dayanağı — 13 Ekim son teslim

Source **f2f922af81be6a1852f49ee7a6cf5c6bdb7a1477**, 1876dosya/manifest2840ecbeaa17c84cd452e78de5738ee2ab494d36f7bb35756c26ce513857e26a;5234/4184/4186/DB02/copye16b70f0/T1false. Mevcut fatura kendi kayıtlı döviz/fiyat/toplamını, exact kabul–supplier–satır–ADET×1 ve native belge/cari kuru+tutarını gösterir; yeni taslak kuru ayrı. Root61/61/HighGO/build/secret scan0;19GET eski alanı aynı+8aynıyetkired;3nativefatura/4satır/stock-supplier geçmişi aynı, ticariyazma0. Chrome/üçgenişlik kanıtı; API2reader+2test/CSS9/startup225/CRM11staged/TEST125 korunur. [Alış–mal kabul görünümü kanıtı](docs/evidence/erp/2026-10-13-purchase-receipt/README.md). C02/C03/B05🟡,49-9-39-1/UA11-UA32bekliyor. Genel kapsam ve tarihsel reader snapshot sınırı açık; completeDelivery=false. Source6hostedCI ödeme nedeniyle başlamadı, docHEAD ayrı.

Aşağıdaki a771/4c/3517 kayıtları kendi tarihsel teslimleridir.

# 13 Ekim son teslim — C05 müşteri/döviz bazında açık hesap görünümü

Çalışan source **a771afe29bde27762e88cf7095d4ff830ef25b30**,1874dosya/manifest8c1cafcb691c1ea38ddb0f743f52a4de76249735b1d377a3c0e6fe986e55a397; web5234/API4184/native4186/DB02. [C05 okuma/görünüm kanıtı](../2026-10-13-open-account/README.md).126kontrol/GO, readonly gerçekChrome/API/native kayıtları aynı,0ticariyazma. Seçili geçmiş ve Yenile/ödeme etiketi hazır; genel limit/vade/seçili tahsilat yazıcısı/insan kabulü açık. CRM09ca/native60e veTEST125 aynı; CSS9/startup225 korunur, v22APK HTTP hazır. Hostedsource6check ödeme/harcama nedeniyle başlamadı. C05🟡/UA32bekliyor/49-9-39-1, **completeDelivery=false**. Aşağıdaki4c/3517/814 kayıtları tarihsel teslimlerdir.

# 13 Ekim son güncelleme — çalışan4c mevcut sayımın İlker'e devri

Son web/API/native source **4c879f38d14f5edbf4ec0116731b001830dfeec3**,1872dosya/manifestaddb43dcead18912190d26b7dde18c60e30882400f9ddbd7f1f12108e10a9406. DB02/8port/heartbeat, CRM09ca/native60e ve TEST125 korundu. [TERM01 dar sunum](../2026-10-13-receiving-handoff/README.md): normal15/16 aynı pending kabulü ve bağlı gönderilmiş sayımı görüyor; personel onay/ret kapalı. Readonly inceleme/yenileme ve1440/1024/390 taşmasız; native kayıt hash'i aynı ve ticariyazma0.29hedefli kontrol/GO, iki exact eski not gösterimde Türkçe; raw/journal/POST aynı. API572/startup225/CSS7 hash'i değişmedi; v22installer/APK HTTP hazır. SonTC21 yeni belge/video ve insanUA32 bekler. OPS01 hız, gerçek reboot/logon ve hostedCI hesap engeli açık; **completeDelivery=false**. Aşağıdaki3517/814 metinleri tarihsel teslimlerdir.

# 13 Ekim güncellemesi — çalışan3517 gözetim düzeltmesi

Son çalışan web/API/native source **3517bb8f9455de118cb7c8661a89f416288c9981**;1870dosya/manifesteb18c6aa…50f6e92. DB02/copye16b70f0/T1false, CRM09ca/native60e ve TEST125 korunur. [OPS02 teknik teslimi](../2026-10-13-startup-observation/README.md):73offline kontrol/GO, final gerçekguard gölgeprova,8port/health/heartbeat ve4mevcutDTOhashsame. Bilinmeyenprobe sağlıklıstackcleanup/restart üretmez; kaynak guardları sürer. GerçekWindowsreboot/logon ve eski814exit1OSaşaması ayrı bilinmeyen/açık. Normalasset22/APIfile572aynı; installerHTTP200/APKv22same. Yeni tarayıcı/TC21insan kabulü yok,814normalgörselkanıtı değişmeyen UI için devralınır. Nativevideo/UA32/OPS01hız/hostedCIbilling açık. Genelteslim **completeDelivery=false**.

Aşağıdaki12Ekim814metni tarihsel önceki teslim olarak korunur; son runtime kimliği yukarıdadır.

# ERP-COMPLETE01 — çalışan fiş/koli okuyucusu ve son teslim sınırları

12 Ekim 2026. ERP-DEC-053 kapsamında ana iş devam etti; iptal edilen Hub giriş düğmesi etkinleştirilmedi. Yeni satış, stok/cari/kasa hareketi veya migration oluşturulmadı. İnsan UA32 bekliyor; genel ERP/LIVE kabulü yok.

## Gerçek çalışan tuple

- ERP web5234 / API4184 / native4186: **81427424cd0452f7dcf4b8e4439fda400c03f46b**, `CANONICAL-COMPLETE-TEST-20261011-8142742`, 1870 dosya.
- Paket manifest SHA256: `6103a7df9631ad4c9cd90df8aef747c479a1b8476e9566007317c5fe8a0c48ff`.
- DB: `Semih\MELISADEV / MELISA_ERP_CRM_SHARED_TEST_20261009_02`; copy `e16b70f0-4057-428b-9abc-6bbcaf35fe82`; actualT1=false.
- CRM mevcut09ca ve native sipariş60e paketleri korundu; yeni CRM kaynağı etkinleştirilmedi. Özgün TEST125 süreçleri değişmedi.
- v22 APK HTTP indirmesi doğrulandı: 45.326.137 bayt, SHA256 `4cbbde0a389924cf25d4eebb9fdb3692ace15edae4219b348c8df78027803bcf`. APK kaynağı ile web/API kaynağı ayrı.

## Yeni kaynak ve gerçek okuma

`e873e29`: sunucunun seçtiği tarihsel fiş/liste GET'inde yalnız tekrarlanan dış READY kaldırıldı. Aynı transaction/SPID/Shared lock/SERIALIZABLE, exact DB/login/copy/hash ve altı native revision doğrulaması yeni küçük fresh-proof katmanında korunur. Native owner context içindeki **iki READY çağrısı aynen sürer**; desteklenmeyen kayıt eski full doğrulamaya döner, drift kapalı reddedilir. Gerçek V3 profile: her örnekte fresh-proof1 / dış READY0 / owner-context1; native readonly transaction sonucu korunur.

`260c5f8`: mevcut sonraki50 düğmesi listenin üstüne de kondu; iki düğme aynı işlevi kullanır. `2005b05`: yalnız server original GET invoice upstream20s ve frontend carton GET30s; auth/me12s, metadata POST15s ve ticari POST60s sınırları aynı. Otomatik retry eklenmedi. **Timeout bütçesi artırmak hız optimizasyonu olarak sayılmadı.**

`8142742`: hızlı kod yazımında arama alanının her tuşta değiştirilmesi giderildi; 250ms/IME/lifecycle kontrolleri, caret ve diğer miktar alanlarının korunması eklendi. Kaydetme, UUID/body/journal, miktar, rol veya hesaplama değiştirilmedi.

Root hedefli kontroller: tarihsel okuyucunun8 yeni testi, session/gateway59 kontrol ve son carton20 kontrol geçti. Bağımsız kaynak incelemeleri GO. Paket build ve dar commit aralığı secret scan geçti. Bunlar insan kabulü değildir.

## Süreler — aynı mevcut kayıt, yeni ticari yazma0

| Okuma | Önce6a / loopback | Son814 / LAN |
| --- | ---: | ---: |
| 200 satırlı yeni tamamlanmış fiş |11258ms|9470ms|
| Fiş listesi50 |6576ms|5913ms|
| Koli fiş listesi |6374ms|4996ms|
| Mevcut200 satırlı iki kolili fiş |11161ms|4386ms|

Bunlar tekil gözlemlerdir; farklı loopback/LAN ve soğuk/ısınmış durumlar garanti/SLA veya kesin yüzde kazanç değildir. Her dört DTO SHA256 öncekiyle birebir aynı; normal15 own session logout doğrulandı. İlk814 ölçümü ortak API toparlanırken bağlantı kuramadan durdu; başarılı ölçümle gizlenmedi. Native owner-context hâlâ birkaç saniye maliyetlidir; OPS-01 tamamen kapanmadı.

Ek readonly kaynak-fragment denemesi tam scope'tan türetilen781 satırda yapıldı. Önerilen semijoin hazırlığı daha hızlı çıkmadı; native metadata'ya uygulanmadı. 37 eski kontrol sayısı güncel scope sayısı yerine kullanılmadı; kalıcı veri/metadata yazılmadı.

## Normal ekran ve cihaz ayrımı

**Son814 normal tarayıcı / gerçek API:** korumalı mevcut15 TEST kaydıyla normal giriş;390 genişlik; üst50→100; hızlı0089→tek doğru satır;200/223/ikiREADY koli;122/101 ayrı; yenilemeden sonra aynı fiş ve iki koli tekrar okundu. Yeni koli, miktar değişikliği veya save yapılmadı. DOM'daki `terminal-BJqS1UT5.js` ve HTTP bytes hash'i son paketle aynı.

**Gerçek TC21:**2005 paketinde kapat-aç sonrası liste/200satır/223adet/2koli, üst50→100 ve mevcut2.koli101 görüldü. O açık sayfada hızlı0089 girişinin eksilmesi bulundu ve kaynakta düzeltildi. Son814 için uygulamayı kapat/başlat kontrolünü içeren komut **otomatik onay denetimince reddedildi**; ayrıntılı sebep verilmedi, tekrar denenmedi. Native hash navigasyonu açık belgenin JavaScript'ini yeniden yüklemediğinden sonraki eski belge çekimi **son814 cihaz kanıtı değildir**. Son kaynak için native yeni belge/kapat-aç, güncel video ve insan kabulü açık.

Başlangıçta crmServer processProbe exit1/2409ms hatası, altı ortak servisin cleanup/retry'ına yol açtı; bu sırada API erişilemedi. İkinci başlangıçta8 port/kimlikler düzeldi ve sonraki okumalar geçti. Ayrık OS/CIM/managed/owner sorgularından hangisinin hata verdiği henüz kanıtlı değil; guard kaldırılmadı. OPS-02 süreç kararlılığı ve gerçek reboot/logon açık kalır.

## Kullanılabilir dosyalar / eksik teslim

- APK kurulum: <http://192.168.1.46:5234/install.html>; önceki geçici pakette404 bulundu, son1870 dosyalı pakete APK/kurulum birlikte dahil edildi; HTTP200 ve APKhash doğrulandı.
- Normal ERP: <http://192.168.1.46:5234/ornek-akis.html>; terminal: <http://192.168.1.46:5234/terminal.html?worktest=1#packing>.
- Repo dışı güncel kısmi teslim: `C:\Sirket\ERP\deliveries\ERP-TERMINAL-20261012\guncel-8142742`; APK, kısa rehber, normal tarayıcı görseli ve hash manifesti. `completeDelivery=false`.
- Eski beş klip/dört görev korunur. Yeni deneme çekimleri eski WebView belgesi içerdiğinden son eğitim diye yayımlanmadı; final200 video bekliyor. Eğitim hazırlığı personel kabulü değildir.
- DHCP rezervasyonu ertelendi; Windows reboot/logon denenmedi. Gerçek müşteriye WhatsApp/ücretli AI/LIVE/Vega/T1/main değişikliği yok. Cari/ürün aktarımları, LL dışlaması, holdlar, fotoğraflar, maliyetler ve yedekler korundu.

GitHub PR23 source814 head hosted kontrolleri hesap ödeme/harcama engeli nedeniyle başlamadı. Vercel success bu kontrollerin veya insan kabulünün yerine geçmez. Bu dosyayı taşıyan sonraki teslim commit'i, çalışan814 paketten ayrı kaydedilir.

**Sıradaki teknik kapanış:** gözetim processProbe hatasının kesin OS aşamasını güvenli tanıyla belirle; kaynak/kimlik kontrollerini koruyarak kararlı başlangıcı kanıtla. Son native belge ve final eğitim teslimi hâlâ ayrı açık; reddedilen kapat/başlat işlemini farklı komutla tekrarlama.
