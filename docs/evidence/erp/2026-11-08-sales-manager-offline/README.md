# Satış ve müdür TEST persona hazırlığı — çevrimdışı kaynak

Yeni iki normal rolün kurulumu mevcut operatör veya depo onayını genişletemez. Bu değişiklik sabit hedef için pasif kullanıcı kurulumunu ve iki bağlı hesabın güvenli pasifleştirilmesini SQL metni olarak üretir; SQL bağlantısı, yürütücü, aktivasyon, credential üretimi veya fiili erişim yetkisi içermez.

## Sabit kapsam

Hedef Semih\MELISAERP / MELISA_ERP_DESKTOP_TEST_20261105 / DB5 / GUID c67f5317-9c0d-4831-aadd-fadc379a95d1 / environment eb2888c2-51cb-4570-a933-397cf7e62806 / schema7 /43 tablo. Kurulu kaynak0ffc69cb, paket17b47032d23c618b2944e9a55201b0355d4009c794fecdf9af469088fc79a061. Yeni dal codex/erp-sales-manager-offline-20261108, tabanPR102/0ffc69cb. Bu dal çalışan runtime'a kurulmaz.

- desktop_sales_test / erp_sales_deneme: product.view, customer.view, sales.view/create/edit/finalize (6 mevcut anahtar).
- desktop_manager_test / erp_manager_deneme: aynı6 + sales.cancel (7). Finans ve product.edit yok; yeni permission anahtarı0 fakat13 atama ayrı erişim değişikliğidir.
- Roller aktif, yeni kullanıcılar pasif oluşturulur. Kullanıcıların aktivasyonu bu değişiklikte yoktur.
- Yeni policy üç kişiyi içerir: mevcut30002/rol5 açıkça%3 ve fiyat değiştirme kapalı olarak korunur; yeni satış varsayılan%3, müdür%5. Fiş fiyat değişimi ikisinde de kapalıdır. Yeni kimlikler yalnız INSERT OUTPUT ile bağlanır.

## Kod ve korumalar

sales-manager-persona-plan.mjs sabit typed plan ve sentetik işlem modelini; sales-manager-persona-sql.mjs yalnız createInactive/deactivate SQL metnini ve dış typed parametre sözleşmesini üretir. Secret değerleri API input veya output'una alınmaz; gerçek credential hash parametrelerini ancak gelecekte ayrı yetkili yürütücü sağlayabilir. Metin parametre bağlanmadan SQL batch olarak kullanılamaz.

SQL taslağı hedef/SID/Shared memory/schema denetimi, ambient ve implicit transaction reddi, SERIALIZABLE işlem ve mevcut ortak uygulama kilidini içerir. Policy COUNT tam0 değilse durur; mevcut satırı sessizce merge etmez. Açık veya uyumsuz başlık/workflow, bozuk veya COMMITTED olmayan journal, pricing işareti ve policy audit kaydı ilk INSERT öncesinde durdurur. Eski operator19 izinleri, users/roles/permissions/settings/audit satırları korunur. OUTPUT kimlikleri JS-safe pozitif aralık, tazelik ve korunmuş kimliklerle çakışmama açısından kontrol edilir. Yeni13 atama, iki pasif kullanıcı, iki rol, tek compact policy ve audit readback aynı işlemde doğrulanır.

Pasifleştirme önce iki hesabın da userID/ad/roleID/roleCode/rowversion bağını doğrular; sonra tek UPDATE ile yalnız ikisini kapatır. Dışarıdan doğrulanmış normal logout/drain ve bekleyen istek uzlaştırması ayrıca zorunludur. SHA veya boolean tek başına oturum bulunmadığını kanıtlamaz. Eski hesaplar silinmez, identity reseed yapılmaz. SQL IDENTITY sayaçları gerçek rollback'te ilerleyebilir; sentetik model bu engine davranışını kanıtlamaz.

## Mevcut kaydın politika etkisi

sales-manager-policy-impact.mjs yalnız caller'ın SHA ile bağladığı snapshot byte'larını inceler. Başlık/workflow/journal/audit kapsam sayıları, kimlik eşleşmeleri, COMMITTED sonuçları ve tarihler doğrulanır. Kaynak adının case/Türkçe harf/sondaki boşluk varyantları muhafazakâr biçimde pricing audit sayılır. Her sonuçta installAllowed=false, originVerified=false, browserPending=NOT_OBSERVABLE kalır.

Repo dışındaki doğrulanmış salt okunur snapshot ace333078233673af2c2375f04a4f332eeeb5c0bc345ff8caf4d5d48ce09d54e, 8 Kasım00:40:29.9748667UTC kaydında13 satış başlığı ve13 workflow tamamlanmış/iptal;74COMMITTED journal,183audit, açık başlık/workflow0, pricing işareti/audit0 gösterir. Bu kayıt anında görünür server-side engel bulunmadı. Bu, güncel SQL durumu, bütün tarayıcılardaki pending, policy satırının kesin COUNT'u veya fiili kurulum yetkisi değildir. Yeni policy revision mevcut önizlemeleri geçersizleştirir; mevcut pricing-bound taslak/onay olursa ayrıca ele alınmalıdır. Kurulum öncesi kilitli yeniden kontrol zorunludur.

## Doğrulama ve kalan

16 hedefli test, offline guard altında PASS/0skip. Bunlar yanlış hedef/secret input, mevcut policy, eksik key, açık/belirsiz işler, yedi kısmi işlem kesintisinde input korunumu, iki bağlı kimlik/rowversion, SQL guard sırası ve snapshot karşı örneklerini kapsar. Yeni altı kaynakta Gitleaks8.30.1 redacted stdin taraması bulgu0; JS syntax kontrolleri geçti. Bağımsız kaynak incelemesindeki transaction/kilit/journal/OUTPUT-ID ve kaynak karşılaştırması bulguları giderildi; NO_NEW_P1P2. Üç yeni test dosyası mevcut canonical CI yoluna açıkça eklendi. Bu head'in tam hosted CI sonucu PR üzerinde izlenir.

Gerçek SQL parser/metadata/kilit/transaction/rollback, normal iki persona girişi ve iki hesap/13atama/credential kurulumu NOT_RUN. Kaynak/compiler/model PASS, SQL veya rol kabulü değildir. Tamamlanmış fiş15 ve ürün hareketi kanıtları yeniden kullanıldı; satış/sevk/ödeme ve eski önizlemeler tekrarlanmadı. Açık hesap aşımında müdür/patron iş kuralı korunur; bu değişiklik kredi-limit/vade şeması veya taslak yazma sahipliği kararı icat etmez. Gerçek insan/cihaz/LIVE ve özgün kapanış sayıları değişmez.
