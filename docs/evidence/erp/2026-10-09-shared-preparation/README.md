# ERP + CRM ortak TEST hazırlığı — ERP-CRM-PREP01

ERP-DEC-039 / CRM-DEC-007; ERP PR23 ve CRM PR3. Teknik hazırlık, geniş işletme testini başlatma veya insan kabulünü PASS yapma onayı değildir.

## Ortam ve koruma

- Normal TEST125 ve eski CRM624xx çalışmaya devam eder. Eğitim PR27 değişmedi.
- Güncel TEST125 COPY_ONLY/CHECKSUM yedeği doğrulandı ve yalnız yeni `MELISA_ERP_CRM_SHARED_TEST_20261009_01` hedefine gerçekten restore edildi. Aktif TEST'e restore/reset yapılmadı.
- ERP5224/API4174/native4176; CRM62600/gateway62601/catalog62602/orders62603/native62604. Native portlar loopback; şirket Wi-Fi yüzleri192.168.1.46. 625xx Windows ayrılmış port engeli nedeniyle kullanılmadı, işletim sistemi ağ ayarı değiştirilmedi.
- ERP uygulama source41a8e6c; CRM native draft source7b083a6; CRM UI/runtime source81754aa. Teslim HEAD, çalışma paketi ve eski TEST125/sourceedb3c891 ayrıdır.
- Yeni SQL kimlikleri yalnız yeni kopyaya bağlı; orijinal TEST/LIVE erişimi0, sysadmin/CONTROL0. Eski insan kullanıcıları/rolleri değiştirilmedi. Yeni sırlar repo dışında, sahibi+SYSTEM ACL ile korunur.
- CRM, mevcut Chatwoot verisini salt okunur tüketir. CRM mesaj veritabanı klonlandı iddiası yok. Incoming/provider worker, atama/read-state/dış mesaj yazması ve ücretli model çağrısı bu ortamda kapalı.

## Doğrulanan bağlantılar

| Bağlantı | Gerçek teknik kanıt | Sınır |
|---|---|---|
| Ortak katalog | ERP ve CRM normal ekranında güncel kaynak ürün, fotoğraf ve satış fiyatı/döviz okundu; 50 ürün sayfası korundu. | Kaynak8Ekim; atomik finalT1 veya bugünkü Vega stok sayımı değildir. |
| Native sipariş | Normal CRM ekranında mevcut ERP rolüyle tek taslak/tek satır oluşturuldu; ayrı GET ve yenileme aynı taslağı gösterdi. | Stok/cari/tahsilat/reservation etkisi0; taslak gerçek satış değildir. |
| Sipariş replay | Aynı UUID/body200; aynı UUID/değişmiş body409. Altı native kayıt grubunun sayısı ve tam satır özetleri aynı. | 18 kaynak/kimlik kontrolü ve14 replay kontrolü; önceki kaynak ve kopya digest biçimleri karıştırılmadı. |
| Müşteri kimliği | Kesin telefon eşleşmesi bulunmayınca otomatik eşleme yapılmadı; yalnız mevcut kartın açık gerekçeli TEST seçimi kullanıldı. | Gerçek WhatsApp kişisi↔cari ilişkisi doğrulanmış sayılmaz. |
| Personel | Mevcut crm-ahmet/Personel oturumu gerçek ekranda açıldı;22 atanmış sohbet ve başka kişiye ait sohbetin görünmemesi doğrulandı. | TESTADMIN gerçek patron değildir; CRM/ERP sayısal kimliği veya SSO uydurulmadı. LAN'da normal mevcut hesap gerekir. |
| AI / gönderim | Açılış çevirisi, composer çevirisi ve satış önerisi pasif; backend shared ortamda ücretli çağrı/dış yazmayı reddeder. | Gerçek ücretli çağrı veya müşteriye mesaj denemesi yapılmadı. |
| Zebra → İlker | Gerçek TC21 LAN terminalinde personel sayımı kaydedilip İlker'e gönderildi. | Bu tur barkod metni ADB ile girildi; önceki optik kanıt korunur, yeni fiziksel insan PASS yok. |
| Kabul → stok → alış → borç | Normal ERP ekranında personel gönderimi mevcut İlker rolüyle kabul edildi; tek stok etkisi. Aynı kabulden alış taslağı ve kesinleşmiş fatura oluşturuldu, tedarikçi döviz hesabı ve hareketi bağımsız SQL ile doğrulandı. | Yalnız yeni ortak kopya, mühürlü ürün/TRY prova tutarı; stok faturada tekrar artırılmadı. |
| Onay / fatura replay ve rol | Gerçek UI UUID'leriyle aynı hedef/body200/replayed, personel403. Farklı hedefle aynı fatura UUID409; ikinci stok veya finans etkisi0. | Ayrı tanı UUID'si bir no-op journal oluşturdu; journal adedi işletme işlem adedi değildir. |

## Dar düzeltmeler

Güncel mühürlü ürün/fiyat/birim sözleşmesi, bağımsız ERP oturumu, finite ortak TEST runtime ve paket doğrulaması eklendi. Dedicated CRM native TDS driver'ı ODBC global Request çakışmasından ayrıldı; eski ODBC runtime davranışı korundu. Fotoğraf blob CSP ve aynı-host terminal CRM adresi düzeltildi. Mevcut personel prova oturumu yalnız finite62600 profilinde açılır. Fiyatlar iki ondalık gösterilir, ham hassasiyet korunur.

İlker onayında personel oluşturucusu korunur. Base copyId/profil mührü ve184 module manifest satırı değiştirilmeden üç sabit adapter için append-only revision kullanılır. SQL prova33 ticari grubu değiştirmeden rollback oldu; mevcut koruma trigger'ları kapatılmadı. Sadece yeni teknik SQL kimliklerine exact revision metadata okuması verildi; insan rolü genişletilmedi. Mevcut korumalı ACL tekrar sahiplik değişimi yapmadan doğrulanır; commit sonrası kanıt aşaması açık kaydedilir.

Eski ürünlere özel native stok CHECK koşulu silinmedi: aynı koşul korunup yalnız yeni kopyanın mühürlü iki ürün/tedarikçi/TRY/miktar/maliyet/aktör/SQL kimliği için dar koşul eklenir. SQL Server'ın derlediği tanım önce WITH CHECK transaction provasında kaydedilip rollback oldu; yalnız iki biçimsel değişiklik bağımsız doğrulandı. Sonraki uygulama exact derlenmiş tanım hash'i, güvenilir/etkin kısıt ve değişmeyen ticari sonuçlara bağlıdır. Altı hedefli negatif test geçti; miktar/maliyet/AND-OR değişimi bu kanıtla kabul edilmez.

Alış intent satırındaki eski fiyat CHECK de özgün koşulu korunarak yalnız ürün–mühürlü prova fiyatı çiftlerine genişletildi. Native header actor/döviz ve aynı-TX koruması değişmedi. Diğer dokuz kısıt aynı; source/target FK'leri doğru dbo kartlarına bağlı ve güvenilir. İki CHECK de exact derlenmiş hash ile WITH CHECK prova/rollback ve sonra yeni kopyada commit edildi; muhasebe etkisi0, rol değişikliği0. Son birleşik offline kapsam9/9; bağımsız review geçti. Alış taslağı stok/borç etkilemedi; kesinleştirme yalnız seçili tedarikçi hesabını etkiledi. Ekranda yeniden okuma aynı fatura ve borcu gösterdi.

Bağımsız son kontrol25 kritik tablo grubunda beklenen dar değişimleri ve13 değişmeyen grubu doğruladı; roller/hold/accepted kaynak/fiyat/kasa hareketleri aynı. Native stok ve tedarikçi tekil etkilerinin JSON hash'leri işlem kanıtıyla eşleşir; açık intent0. CRM altı native tablo grubu replay son mühürlü hash'iyle aynı. Journal6 kaydı5 anlamlı akış+1 tanı no-op olarak ayrıdır. Kaynak/hesap doğrulama durumları değiştirilmedi. Native invoice header aktör alanları boş kalır; işlem aktörü journal/draft/tedarikçi etkisinde kanıtlıdır, header dolu iddiası yok.

## Hız

Üç örneklemli API medyanları: first50 önce644/sonra655ms; next50 631/633ms; kod546/558ms; barkod394/444ms; kart224/241ms; mal kabul context79/85ms. Bu ölçüm UI açılışının tamamı veya tüm ağ koşullarının garantisi değildir. Belge taraması her liste isteğinde çalışmaz.

## Açık kabul ve kapsam

İşlem profili iki doğrulanmış ürünün güvenli kopyası, seçili müşteri/tedarikçi/kasa ve TRY ile sınırlıdır; okuma kataloğu daha geniştir. Tüm kartlar/tüm dövizler ve sınırsız günlük mağaza işletimi hazır ilan edilmez. Gerçek personel↔müşteri eşleşmesi, geniş insan/İlker kabulü, fiziksel terminal kullanımı ve Windows reboot kabulü bekler. Önceki UNKNOWN belgeler, gerçek kasa/banka açılışı ve LIVE/T1 kararları korunur. İnsan finish-tree renkleri ve UA sonuçları otomatik değişmedi.

Ham SQL sonuçları, tutarlar, dosya yolları/konfigürasyon sırları, fotoğraflar ve ekranlar yalnız repo dışındaki özel kanıt alanındadır. Geniş ortak işletme turu ayrıca kullanıcı onayı bekler. Bu hazırlık tesliminde DUR.
