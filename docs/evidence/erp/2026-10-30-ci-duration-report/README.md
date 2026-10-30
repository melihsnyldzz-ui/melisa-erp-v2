# Çevrimdışı CI süre raporu

30 Ekim 2026. Dal `codex/ci-duration-report-20261030`, taban `1b851c7572b630bbb76c19a74bea0b2e7b1d184f`.

Kullanıcının test/kurulum beklemesini ölçme yetkisi kapsamında ilk kaynak teslimidir. Araç mevcut yerel JSON/log dosyalarını okur ve JSON veya Markdown üretir. API, token, ağ, çocuk süreç veya canlı ortam gerektirmez. Hız kazancı uygulanmış değildir.

## Sahiplik ve mevcut araç kontrolü

Önce `AGENTS.md`, karar/pano kayıtları, mevcut CI çalıştırıcısı ve raporlama araçları incelendi. `scripts/ci` içinde aynı işi yapan araç bulunmadı. Canonical owner/paket araçları CI başarı kanıtı okuyor; ağ ve bakım işlemleri içerdikleri için bu araca import edilmedi.

Değişiklikler yalnız yeni araç, test, kendi fixture'ları ve bu kanıt klasörüdür. Mevcut Windows workflow'u, `scripts/canonical`, ortak `STATUS.md`, API/auth/config, SQL, servis veya kurulum dosyası değişmedi. Yerel ERP sahibinin B6 işi devralınmadı. Paylaşılan checkout veya ana dalda birleştirme yapılmadı.

## Kullanım

Repo kökünde, Node 24 ile:

```sh
node --require ./scripts/ci/offline-guard.cjs scripts/ci/workflow-timing-report.mjs --input scripts/ci/fixtures/workflow-timing-report/real-20261030.json --format markdown
node --require ./scripts/ci/offline-guard.cjs --test scripts/ci/workflow-timing-report.test.mjs
```

`--format json` varsayılandır. Çıktı stdout'a yazılır; araç dosya oluşturmaz veya mevcut dosyayı güncellemez. `--help` dışında yalnız `--input <yerel-dosya>` ve isteğe bağlı `--format json|markdown` kabul edilir. Uzak URL ve Windows UNC ayraç birleşimleri manifest ve log açılmadan reddedilir. Hatalı girdi sınırlı hata metni ve sıfır olmayan çıkış üretir; girdi/secret/path içeriği hata mesajına kopyalanmaz.

## Girdi sözleşmesi

```json
{
  "schemaVersion": "melisa-ci-timing-input.v1",
  "runs": [{
    "run": {
      "id": 1, "run_attempt": 1, "workflow_id": 123,
      "event": "push", "status": "completed", "conclusion": "success",
      "created_at": "2026-10-30T00:00:00Z",
      "run_started_at": "2026-10-30T00:00:02Z"
    },
    "jobs": [{
      "id": 11, "run_id": 1, "name": "Example",
      "status": "completed", "conclusion": "success",
      "queued_at": "2026-10-30T00:00:01Z",
      "started_at": "2026-10-30T00:00:03Z",
      "completed_at": "2026-10-30T00:00:12Z",
      "steps": [], "logPath": "local.log"
    }]
  }]
}
```

Bu küçük JSON yalnız sentetik sözleşme örneğidir. `logPath`, manifest klasörüne göre çözülen açık yerel dosyadır; alternatif `log` alanı doğrudan metin kabul eder. İkisi birlikte verilmez. Bilinmeyen saatler null veya eksik kalır. Job ve step alanları standart `started_at`/`completed_at` veya `startedAt`/`completedAt` olabilir; run için `createdAt`/`startedAt`, `headSha` ve job için `runId` karşılıkları da desteklenir. Çelişen çift alanlar reddedilir. Attempt `run_attempt` veya `attempt` olarak açıkça taşınabilir; bilinmeyen attempt uydurulmaz. Aynı run/attempt, belirsiz attempt tekrarı, yinelenen job/step ve yanlış run bağlantısı reddedilir.

## Ölçümlerin anlamı

- `workflowStartDelay`: run `created_at → run_started_at`. Tetiklemeden workflow başlangıcına gecikmedir; saf runner kuyruğu olduğu iddia edilmez.
- `queue`: job `queued_at → started_at`. `queued_at` yoksa UNKNOWN. Run oluşturulma zamanı job kuyruğunun yerine konmaz.
- `triggerToJobStart`: run oluşturulması → job başlangıcı; bağımlılık beklemesi de içerebilir.
- `execution`: tamamlanmış job veya step'in kendi başlangıç/bitişi. Eksik/geçersiz/ters saat UNKNOWN; süren job tamamlanmış süre üretmez.
- `reportedDuration`: kaynakça içeren açık `reported_duration_ms`; saat uçları türetilmez. Gerçek fixture'da GitHub'ın job özetindeki süredir.
- `observedLogSpan`: ilk ve son mevcut log zaman damgası; job execution veya queue yerine kullanılmaz. Node `duration_ms` de ayrıca korunur.

Workflow `updated_at` tamamlanma kanıtı değildir. Paralel job süreleri toplanıp workflow wall süresi yapılmaz. Date.now, güncel saat veya eksik alan için sıfır kullanılmaz; gerçek sıfır süre ayrı kalır.

Yalnız tamamlanmış başarılı run ve job'lar baseline'a girer; failed/cancelled/queued/inProgress kayıtlar nedenleriyle görünür fakat istatistiğe katılmaz. Başarı metadata'sıyla çelişen fail/cancelled Node sayıları da baseline'dan çıkarılır. Başarılı step süreleri kendi metadata'sından alınır. Log `Run → endgroup` aralığı execution sayılmaz: endgroup komut/ortam gösterimini test başlamadan kapatabilir. Özetlerin tüm saatleri adım aralığına sığmıyorsa veya saatleri eksikse grup unassigned kalır; job toplamları korunur.

Node spec/TAP üst düzey `tests/pass/fail/cancelled/skipped/todo`, `suites` ve `duration_ms` her invocation için korunur. İç içe TAP özetleri ve `1..N` planı tekrar toplanmaz. Eksik/kesik/yinelenmiş alanlı özet sıfır veya tamamlanmış sayılmaz; güvenli integer toplam sınırı aşılırsa toplam UNKNOWN olur. Toplamlar farklı koşularda benzersiz test kimliği sayısı değildir. Ham komutlar ve log metni rapora taşınmaz.

## Gerçek örnek ve yeniden üretme

[Üretilen rapor](observed-report.md), `scripts/ci/fixtures/workflow-timing-report/real-20261030.json` ve üç dar log fixture'ıyla aynı komuttan deterministik üretilir.

- [PR41022751790 / Windows123953647263](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/41022751790/job/123953647263)
- [Push41022745858 / Windows123953625815](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/41022745858/job/123953625815)
- [Aynı PR / kalite123953646935](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/41022751790/job/123953646935)

Step başlangıç/bitiş ve sonuçları public job sayfasının `check-step` alanlarından okunup bağlı GitHub aracının step numarası/adı/sonucuyla eşlendi. Loglar bağlı GitHub aracından alındı; fixture'da yalnız özgün zaman damgaları, grup sınırları ve Node özetleri tutuldu, komut içeriği çıkarıldı. Ham log veya token/worker/env bilgisi commit edilmedi. Job süreleri public GitHub özetinin açık değerleridir. Run/job kuyruk ve job başlangıç/bitiş uçları ile attempt exportta bulunmadığı için yeniden oluşturulmadı.

| Ölçüm | Bu fixture'da yeniden üretilen sonuç |
| --- | --- |
| Windows job özet süreleri | PR 13:16; push 19:22 |
| Business5244 step | PR 5:19; push 6:55 |
| B6 native profile/rollback step | PR 2:56; push 4:51 |
| Gerçek build step | 6 saniye; tek kalite örneği |
| Windows log sayaçları / her örnek | 1456 tests / 1446 pass / 0 fail / 0 cancelled / 10 skipped / 0 todo |
| Kalite log sayaçları | 3888 tests / 3848 pass / 0 fail / 0 cancelled / 40 skipped / 0 todo |

Koordinatörün altı başarılı koşul için verdiği 13:16–19:28, Business5244 5:19–7:01 ve build 6–10 saniye aralıklarının tamamı bu dar üç-job örneğinde yeniden ölçüldü diye sunulmaz. Bildirilen 2–3 saniyelik başlangıç gecikmesinin ham saatleri bu exportta yok; raporda UNKNOWN kalır. Tam run/job saat exportu eklendiğinde aynı araç bunları hesaplayabilir; canlı API/token gerekmez.

## Teknik doğrulama ve kalan kanıt

- Node v24.19.0, mevcut offline guard ile **11/11 PASS / 0 FAIL / 0 SKIP**.
- Eksik Run sınırı ve karma UNC yolu için önce iki hedefli FAIL üretildi; düzeltme sonrası iki negatif ve bütün on bir test geçti.
- Bağımsız salt okunur yeniden inceleme: iki P2 kapandı, açık P1/P2 yok. Reviewer'ın aynı testleri tekrar çalıştırması ek benzersiz test sayılmaz.
- Gerçek fixture üzerinde B6/Business5244/build süreleri ve pass/fail/skip değerleri sabit beklenen değerlerle doğrulanır. Yeniden sıralanan giriş aynı çıktı üretir.
- Mevcut CI `scripts/ci` dosyalarında syntax kontrolü yapar; yeni test dosyasını otomatik çalıştıran bir değişiklik yapılmadı. Yerel 11 testin PASS'i, hosted test yürütmesi olarak sunulmaz. Tam teslim commit'inin mevcut CI sonuçları PR'de ayrıca kaydedilir.

Araç en uzun başarılı test gruplarını yalnız **araştırma adayı** olarak sıralar. Dosya/geçici dizin, port, süreç, mutex, env ve cleanup sahipliği; sıra bağımlılıkları; aynı pass/fail/cancelled/skip sayılarının tekrarlı yalıtılmış ölçümü henüz incelenmelidir. Bu süreler bağımsızlık veya kazanılacak hızın kanıtı değildir. Workflow paralelleştirme, test/guard atlama, timeout/izin değişikliği, main merge, deploy, SQL veya servis işlemi yapılmadı. Ortak STATUS bu görevin açık talimatıyla değiştirilmedi.
