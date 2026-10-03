# Melisa Native Terminal

Yeşil temalı, Melisa amblemli Android el terminalinin yerelde geliştirilmiş Kotlin / Jetpack Compose kaynağıdır. Sürüm **1.0.0-candidate.18-t2**, versionCode **20**, paket **com.melisaerp.nativeterminal**.

## Korunan kaynak

29 Eylül 2026 tarihinde doğrulanan 70 kaynak dosyası, yerel değişiklikleriyle birlikte değiştirilmeden aktarılmıştır. Personel girişi, satış, cari seçimi, barkod/ürün arama, offline taslaklar, fişler, kategori raporu, paketleme, ayarlar ve Melisa görselleri dahildir. Android istemcisinde yeniden tasarım veya işleyiş değişikliği yapılmamıştır.

Kaynak kimliği T2-20260917-01'dir. Taban dalı codex/terminal-native-v1-20260914, taban HEAD'i 0e14256f13f03d5cf7610a955da7b5ec0a2b52b3'tür. Tabanın commit edilmemiş değişiklikleri ve sekiz dosyadaki T2 değişiklikleri bu aktarımda korunmuştur. Dosya bazlı SHA-256 ve köken bilgileri [source-provenance.json](source-provenance.json) içindedir.

## Geliştirme

- JDK 17; Android SDK 36; minSdk 28 / targetSdk 35.
- Gradle wrapper 8.14.3, Android Gradle Plugin 8.11.0, Kotlin 2.1.20.
- Bu dizin bağımsız Gradle projesidir. Android Studio ile bu dizini açın.
- Yerel SDK yolu ANDROID_HOME / ANDROID_SDK_ROOT veya Git dışında tutulan local.properties içindeki sdk.dir ile sağlanır; JDK için JAVA_HOME kullanılır.

Gerekli SDK ve bağımlılıklar sağlandıktan sonra Windows'ta:

```powershell
.\gradlew.bat testDebugUnitTest
.\gradlew.bat assembleDebug
```

Bu kaynak aktarımında yeni derleme, bağımlılık kurulumu veya cihaz testi çalıştırılmadı. Doğrulama dosya hash'leri, kayıtlı T2 yaması ve mevcut imzalı APK kimliği üzerinden yapıldı; yeni ticari kabul iddiası değildir.

## ERP bağlantısı

İstemci /api/native-terminal sözleşmesini kullanan uyumlu ERP sunucusuna ihtiyaç duyar. Bu aktarım **yalnız Android istemcisidir**; bu dalın mevcut apps/api koduna native endpoint, migration veya T2 paketleme audit desteği eklemez. Kaynak yüklemesi, mevcut GitHub backend'iyle uçtan uca çalıştığı anlamına gelmez.

API adresi, terminal kodu, personel oturumu ve rota/yetki atamaları ilgili ortamda ayrıca yapılandırılmalıdır. Kaynaktaki mevcut varsayılanlar korunmuştur; bir ortamı çalıştırmadan önce hedefi doğrulayın. Cihaz entegrasyon testleri ayrı özel fixture gerektirebilir; gerçek test oturumları ve fixture verileri dahil değildir.

## İmzalama ve hariç tutulanlar

Mevcut release Gradle ayarı ara APK için debug imzasını kullanır. Önceki cihazlara güncelleme dağıtımı için mevcut özel üretim anahtarı, alias, parolalar ve imza lineage ayrıca gerekir. Bunların hiçbiri Git'e alınmamıştır.

.env, gerçek şifre/token/oturum, müşteri/satış verisi, cihaz ekran arşivleri, APK, node_modules ve derleme önbellekleri dahil değildir. Test kodundaki yapay fixture değerleri korunmuştur. Eski Expo istemcisi ../terminal-app altında ayrı olarak kalır.
