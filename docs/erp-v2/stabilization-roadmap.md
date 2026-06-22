# Melisa ERP v2 - Stabilizasyon Roadmap

## Amaç

Mevcut ERP'yi yeni büyük özellik eklemeden daha güvenilir, okunabilir ve kullanımı daha net hale getirmek.

Bu roadmap'in odağı:

- Yanıltıcı ekran davranışlarını azaltmak
- Kaydetmeden çıkma ve kısmi liste risklerini görünür yapmak
- Liste, form, hata ve boş durum metinlerini standartlaştırmak
- Smoke testlerle kritik web-admin davranışlarını korumak
- Canlı veri yazmadan doğrulanabilecek güvenli kontroller eklemek

## Kapsam Dışı

Bu stabilizasyon sürecinde aşağıdakiler yapılmaz:

- Yeni büyük modül geliştirme
- Plansız görsel tasarım değişikliği
- Yeni WhatsApp özelliği
- Onaysız SQL migration
- Onaysız canlı veri yazan test
- `.env.local`, API key veya şifre commit'i

## Çalışma Kuralları

- Sprintler küçük ve ayrı commitler halinde kapatılır.
- Her sprint sonunda ilgili smoke test ve web-admin build çalıştırılır.
- Ticari kural, API sözleşmesi veya DB şeması değiştirilecekse ayrıca onay alınır.
- WhatsApp servisi kapalıysa genel smoke raporunda bilinen dış bağımlılık riski olarak not edilir.
- Doküman ve kod değişiklikleri mümkün olduğunca ayrı commitlenir.

## Tamamlanan Stabilizasyon Sprintleri

### Sprint 1 - Dirty Tab ve Navigation Güvenliği

Commit: `d91252a fix(web-admin): scope dirty tab updates`

Yapılanlar:

- Dirty tab güncellemesi aktif sekme yerine ilgili tab id üzerinden scope edildi.
- Dirty sekme varken browser `beforeunload` uyarısı eklendi.
- Navigation smoke içinde dirty tab kontrolleri doğrulandı.

Doğrulama:

- Web-admin build geçti.
- Navigation smoke geçti.
- Genel ERP smoke'ta ERP kontrolleri geçti; WhatsApp uzak servisi kapalı olduğu için WhatsApp kontrolleri fail kaldı.

### Sprint 2 - Navigation Registry Smoke Genişletme

Commit: `8d81e4d test(web-admin): expand navigation registry smoke`

Yapılanlar:

- Sidebar aramasında Türkçe `ı/i` normalizasyonu düzeltildi.
- Navigation registry, sidebar, icon, label, role view ve workspace route eşleşmeleri statik smoke ile genişletildi.

Doğrulama:

- `smoke:navigation`: 19/19 PASS
- Web-admin build geçti.

### Sprint 3 - Liste Kapsam Uyarıları

Commit: `7d062c7 fix(web-admin): clarify partial invoice lists`

Yapılanlar:

- Satış ve alış fişi listelerinde API toplamı ekranda gelen satırdan büyükse kapsam uyarısı gösterildi.
- Kullanıcıya daha kesin sonuç için belge/cari/durum/tarih filtresiyle aramayı daraltması söylendi.
- `smoke:list-scope` eklendi ve genel ERP smoke'a bağlandı.

Doğrulama:

- `smoke:list-scope`: PASS
- `smoke:navigation`: PASS
- Web-admin build geçti.

### Sprint 4 - Tahsilat/Ödeme Dirty Form Takibi

Commit: `53ebb57 fix(web-admin): track dirty finance form`

Yapılanlar:

- Tahsilat/Ödeme ekranı `onDirtyChange` callback'ine bağlandı.
- Kullanıcı form alanlarını değiştirince sekme dirty hale geliyor.
- Kayıt başarılı olunca veya mod değişince dirty state temizleniyor.
- `smoke:finance-form` eklendi ve genel ERP smoke'a bağlandı.

Doğrulama:

- `smoke:finance-form`: PASS
- `smoke:navigation`: PASS
- Web-admin build geçti.

### Sprint 5 - Fiş Listesi İptal Aksiyon Netliği

Commit: `f8bb407 fix(web-admin): clarify invoice list cancel actions`

Yapılanlar:

- Satış ve alış fişi liste detayındaki yanıltıcı pasif `İptal Et` butonları kaldırıldı.
- Yerine sadece `FINALIZED` fişlerde aktif olan `İptal İçin Aç` aksiyonu eklendi.
- Gerçek iptal işlemi fiş ekranındaki yetkili toolbar akışında bırakıldı.
- `smoke:action-clarity` eklendi ve genel ERP smoke'a bağlandı.

Doğrulama:

- `smoke:action-clarity`: PASS
- `smoke:navigation`: PASS
- Web-admin build geçti.

### Sprint 6 - Teklif/Sipariş Boş Durum ve Metin Temizliği

Commit: `2bca057 fix(web-admin): clarify sales pipeline empty states`

Yapılanlar:

- Satış teklif/sipariş listesinde bozuk Türkçe görünen metinler temizlendi.
- API hatasında demo fallback kullanılmadığı açık yazıldı.
- Boş liste mesajı aksiyonlu hale getirildi.
- İlk 100 kayıt sınırı için kapsam uyarısı eklendi.
- `smoke:empty-state` eklendi ve genel ERP smoke'a bağlandı.

Doğrulama:

- `smoke:empty-state`: PASS
- `smoke:navigation`: PASS
- Web-admin build geçti.

## Güncel Smoke Durumu

Son genel smoke çıktısı:

- ERP API ve web-admin kontrolleri geçti.
- Web-admin stabilizasyon smoke kontrolleri geçti.
- WhatsApp uzak servisi kapalı olduğu için şu kontroller fail kalıyor:
  - `Sistem / WhatsApp API`
  - `WhatsApp / Instance connection state`

Bu iki fail mevcut web-admin stabilizasyon sprintlerinin regresyonu değildir; dış WhatsApp servis bağlantısı çalıştırılınca tekrar test edilmelidir.

## Sıradaki Önerilen Sprintler

### Sprint 7 - Dokümantasyon ve Release Toparlama

Hedef:

- Stabilizasyon commitlerini ve test durumunu dokümana geçirmek.
- GitHub branch linkini ve bilinen riskleri netleştirmek.
- Dokümanları ayrı commit olarak kapatmak.

Kabul kriterleri:

- Roadmap okunur Türkçe olmalı.
- README indeksinde roadmap linki yer almalı.
- Kod commitleriyle doküman commitleri ayrılmalı.

### Sprint 8 - Görsel QA ve Kritik Ekran Kontrolü

Hedef:

- Web-admin ana akışlarında 1366x768 ve 1920x1080 görünüm kontrolü yapmak.
- Operasyon Masası, Satış Fişi, Alış Fişi, Tahsilat/Ödeme, Stok Listesi ve Cari/Tedarikçi ekranlarında taşma veya karışıklık var mı bakmak.

Kabul kriterleri:

- Yeni özellik eklenmez.
- Sadece belirgin kullanılabilirlik veya taşma hataları küçük commitlerle düzeltilir.

### Sprint 9 - WhatsApp Servis Durumu

Hedef:

- ERP kodundan bağımsız olarak WhatsApp uzak servis bağlantısını doğrulamak.
- Genel smoke'taki iki fail'in servis kapalı olduğu için mi, config nedeniyle mi kaldığını netleştirmek.

Kabul kriterleri:

- Mesaj gönderimi yapılmadan health ve instance state kontrol edilir.
- Secret veya API key loglanmaz.
