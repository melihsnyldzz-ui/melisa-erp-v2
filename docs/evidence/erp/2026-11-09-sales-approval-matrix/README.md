# DES-19 indirim onayı: gerçek kurulum ve normal ekran

9 Kasım 2026, SEMIH üzerindeki ayrılmış yerel TEST. Sonuç: satış talebi → uygun karar veren → aynı satış taslağı. Fişe özel vade istisnası ve bütün ERP teslimi açık; insan/personel kabulü BEKLİYOR.

## Kaynak ve kurulum

PR123 / codex/erp-sales-approval-matrix-20261109; runtime kaynak `2e43de9a3662b9689dcc78b7ea61d1aa73771163`, paket `2991027a0191df74310b1969b09c8b4e144d6ad7aea893e6f69ae5230463cf18`. Runtime315kaynağın4'ü değişti,311'i aynı; frontend3CI girdisi3derlenmiş asset üzerinden sunuldu. Yerel junction/esbuild build reddi korundu; hosted artifact kuruldu.

Runtime [push CI](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/42593167929) ve [PR CI](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/42593174294) Windows dahil8iş/104adım SUCCESS. Offline SQL compiler87396faf runtime'a kurulmuş kaynak olarak gösterilmez; onun [push](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/42606184609) ve [PR](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/42606193212) koşuları da8iş/104adım SUCCESS.

İki yeni TEST hesabı pasif oluşturma ve etkinleştirme için ayrı gerçek rollback denemesi/native karşılaştırmadan sonra etkinleşti: müdür30016, patron30017, rol18, yalnız sales.view. Genel cari düzenleme veya finans hakkı eklenmedi. Rollback identity boşlukları kaydedildi; reseed yok. İlk eski setup UNKNOWN kanıtı korunur; tam47alan/identity/korunan satır eşliği etkisiz olduğunu doğruladı. Exact mevcut CUSTOMER_ACCOUNT_EXISTS terminali ve tam6kolon master journal hash'i bağlanarak ayrı v2 işlemler yürütüldü; eski istek/journal yeniden oynatılmadı.

Yeni uygulama bir kez başladı: owner42004/worker43112; yalnız127.0.0.1:5294 ve4294. Başlangıç sonrası47alan ve korunan registry satırları etkinleştirme sonuyla aynı. TLS kanıtı değişmeyen taşıma yapılandırmasından miras; yeni probe iddiası yok. SQL5240/eskiSQL31560 doğumları, DBguid c67f5317-9c0d-4831-aadd-fadc379a95d1 ve404SQL izni aynı. Son7kullanıcı/6rol/39uygulama izni/3ayar/208audit.

## Normal oturum sonucu

| Senaryo | Sonuç |
| --- | --- |
| Satışçı30013 | Etkin sınır %3.0000, %5 kayıt onaysız kapalı |
| %5.0001 talebi223, müdür30016 | Listede yok; numarayla normal Talebi aç GET403 |
| Aynı talep223, patron30017 | Gerekçeli tek POST200; karar224, Onaylandı |
| Tam %5.0000 talebi225, müdür30016 | Yalnız uygun bekleyen talep görünür; gerekçeli tek POST200, karar226 |
| Satışçı onayı kullanır | Talep225 seçildi; TRY cari/kur normal düğmeyle yüklendi; taze önizleme alındı |
| Aynı taslağı kaydetme | Tek POST201, UUIDf8d4e49c-da1c-46ac-9465-924f5009b05a; fiş19 DRAFT,24.0000−1.2000=22.8000TRY |
| Yenilenen onay paneli | Talep225, müdür30016, gerekçe/zaman ve Bağlı fiş19 aynı ekranda |
| İlgisiz görünürlük | Müdürde müşteri/ürün menüleri yok, genel fiş listesi200/boş. Doğrudan genel cari API403 normal oturumda denenmiş sayılmaz; önceki kaynak testleri ayrıdır |

Maskeli normal giriş kullanıldı; token/session enjeksiyonu yok. Auth sırasında Network kaydı kapalıydı; iş kanıtlarında header/token tutulmadı.

## Native kontrol ve kapsamı

SQL audit225→approval226→pricing.bound228→invoice19; aynı aktör, intent/quote hash, politika revizyonu, tam gövde ve UUID. CREATE_DRAFT journal COMMITTED/replayed=false/pricingProofRequired=true; header createdBy30013/DRAFT/22.8TRY/%5.

Taslak öncesi/sonrası yalnız5tablo değişti: audit+2, sale journal+1, workflow+1, invoice_items+2, invoices+1. Diğer32tablo hash/sayı eşit; stok, cari, finans ve registry değişmedi. Full local-master journal aynı. Eski206audit ve gözlenen eski başlık/workflow/journal satırları tek tek eşit. Eski invoice_items satırlarının ayrı önceki dump'ı yok; bunlar için tek tek eşlik iddiası yok. Kalem kanıtı toplam+2, değişen aggregate hash ve normal fişteki iki kalemdir. İlk verifier dosyasının geniş old206AuditsAndAllOldSaleRowsExact alanı bağımsız addendum ile bu kapsamda düzeltilmiştir; eski kanıt overwrite edilmedi.

Fiş18/17/15 ve tarihsel209 yeniden gönderilmedi. Onaylı223 kullanılmadan geçmişte kalır. Taslak19 kesinleştirilmedi; stok/cari tahakkuk veya ödeme tekrarı yok.

## Yerel kanıtlar ve kalan

Repo dışı dizin: C:/Users/Xaser/Desktop/ERP/kurulum/k10-sales-approval-matrix-v1.

- runtime-observed-ready.v2.json:62d139ea6b0a0e37eeb1a001a629e928561e50daf78d1327e00e0515cfc30dcd.
- normal-sales-approval-verification.v2.json:96e9684aae9b826c547bf32d465d6fb9977b8e4a47ef99964c5ed204b570016f.
- Bağımsız scoped GO/addendum normal-sales-approval-independent-review.v2.json:dfde44ef9499584ccc73575bce25e88577c793e7589b16b70d5113b17fc19168.
- Önceki/sonraki native snapshot:1966fc94c49c112dcf15117f68fb3dcf6fdcbbeeb2e52a337e74cf54abf11ec1 /3df1bd9d3563e0c2a07cc9bebcead5fb9e9c52d118ed6d14215a719b225a09b2.
- approved-sale-chain-native.v2.json:2095418864af725e684fc0a6fce9d03adf8a6e828bffe38cc1a7d87a44ab2d49; tek salt okunur işlem.
- gui-approved-sale-linked.dom.txt, mudur-onayli-fis-19.png, patron-onayi.png ve ayrı istek/karar/kayıt wire dosyaları.

Bir ilk müşteri liste GET'i401, aynı yüklemedeki ürün GET'i200 döndü. Tekrar giriş yok; aynı oturumda onay listesi/müşteri2/kurlar/son önizleme200 ve taslak201 oldu. Kaynak request-local auth.bind dalını gösteriyor; kesin alt neden bilinmiyor, düzeltilmiş sayılmadı. Onaylı TRY taslağı seçimi cari bağlamını otomatik yüklemedi; Şirket kurlarıyla doldur kullanıldı. İlk yükleme sürerken onay düğmesinin sessiz no-op olması da gözlendi; yeni iş POST'u tekrarlanmadı.

Sıradaki aynı K10 işi fişe özel vade istisnasıdır; kalıcı saveTerms eşdeğer sayılmaz. TEST deneme kayıtları içerir. Gerçek kullanım için boş son kurulum, bütün modüller, LAN ve insan/personel kabulü bu kanıtla kapanmaz. Özgün49yaprak/sayaçlar, main, LIVE ve Vega aynı.
