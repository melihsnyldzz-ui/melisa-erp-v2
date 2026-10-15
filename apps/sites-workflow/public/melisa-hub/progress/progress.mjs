import {validateSnapshot, projectPerformance, safeEvidenceUrl, duration, TIME_ZONE} from './model.mjs';
const $ = id => document.getElementById(id);
const number = new Intl.NumberFormat('tr-TR', {maximumFractionDigits: 1});
const date = (value, options = {}) => new Intl.DateTimeFormat('tr-TR', {timeZone: TIME_ZONE, day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit', ...options}).format(new Date(value));
const node = (tag, className = '', text) => { const n = document.createElement(tag); if (className) n.className = className; if (text !== undefined) n.textContent = String(text); return n; };
const link = (label, url) => { const n = node('a', 'evidence-link', label), safe = safeEvidenceUrl(url); if (safe) {n.href = safe; n.target = '_blank'; n.rel = 'noopener noreferrer';} else {n.removeAttribute('href'); n.textContent = 'Kaynak bağlantısı doğrulanamadı';} return n; };
const badge = (text, style = 'neutral') => node('span', `badge badge-${style}`, text);
const progress = (value, max, label) => { const p = node('progress'); p.max = max; p.value = value; p.setAttribute('aria-label', label); return p; };
let snapshot = null, period = 1;
function renderProjects() {
  const t = snapshot.totals, left = node('div'), right = node('div');
  $('progress-title').textContent = `${t.total} madde, tek kapsam`;
  left.append(node('p', 'eyebrow', 'TAM KAPANIŞ'), node('div', 'overall-number', `%${number.format(t.percent)}`), node('p', 'overall-label', `${t.complete} / ${t.total} madde tamamlandı`));
  const legend = node('div', 'overall-legend');
  legend.append(node('span', '', `${t.complete} tamam`), node('span', '', `${t.partial} kısmi`), node('span', '', `${t.open} açık`));
  right.append(progress(t.complete, t.total, 'Toplam tamamlanan maddeler'), legend, node('p', 'overall-label', 'Teknik alt teslimler ve bekleyen insan kabulü bu oranı yükseltmez.'));
  $('overall').replaceChildren(left, right);
  $('projects').replaceChildren(...snapshot.projects.map(p => {
    const card = node('article', 'project-card'), head = node('div', 'project-head'), counts = node('div', 'project-counts'), stages = node('div', 'project-stages');
    head.append(node('h3', '', p.id), node('span', 'project-percent', `%${number.format(p.percent)}`));
    counts.append(node('span', '', `${p.complete} tamam`), node('span', '', `${p.partial} kısmi`), node('span', '', `${p.open} açık`));
    for (const [label, value] of [['Son kaynak teslimi', 'Teknik kontroller geçti'], ['Son adayın kurulumu', 'Uygulanmadı'], ['Normal ekran / insan', 'Bekliyor']]) { const row = node('div', 'stage-row'); row.append(node('span', '', label), badge(value)); stages.append(row); }
    card.append(head, progress(p.complete, p.total, `${p.id} tamamlanan maddeler`), counts, stages, node('p', 'project-note', p.id === 'ERP' ? 'Yeni uyarlama kaynakta hazır. Yeni paket oluşturulmadı.' : 'Son paket hazır ve inaktif. TEST’e kurulmadı.'), link('Son GitHub teslimini incele ↗', p.deliveryUrl));
    return card;
  }));
  $('plan-sources').replaceChildren(...snapshot.projects.map(p => link(`${p.id} · özgün bitiş planı ↗`, p.sourceUrl)));
}
function metric(label, value, detail) { const m = node('article', 'metric'); m.append(node('p', 'metric-label', label), node('p', 'metric-value', value), node('small', '', detail)); return m; }
function renderPerformance() {
  const p = projectPerformance(snapshot, period), unknown = 'Ölçülemiyor';
  document.querySelectorAll('[data-period]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.period) === period)));
  const stateLabel = {snapshot:'Kayıtlı kanıt görüntüsü', stale:'Eski kanıt görüntüsü', unknown:'Kaynak doğrulanamıyor'}[p.state];
  $('snapshot-state').textContent = stateLabel;
  $('snapshot-state').className = `badge badge-${p.state === 'snapshot' ? 'neutral' : 'warning'}`;
  $('snapshot-time').textContent = `Son okuma kapsamı: ${date(snapshot.observedAt)} · İstanbul. Canlı telemetri değildir.`;
  $('load-state').textContent = p.state === 'unknown' ? 'Kaynak zamanı veya erişim kanıtı doğrulanamadı. Performans değerleri gösterilmiyor; plan sayıları son görüntüdür.' : p.state === 'stale' ? 'Bu görüntü 6 saatten eski. Değerler tarihli kanıttır; güncel servis veya dönem performansı olarak değerlendirmeyin.' : 'Plan sayıları kaynak kayıtlarından; süreler yalnız seçilmiş ana oturumlardan. Servis sağlığı veya insan kabulü ölçülmez.';
  $('load-state').classList.toggle('load-error', p.state !== 'snapshot');
  const earliest = snapshot.observations.length ? Math.min(...snapshot.observations.map(o=>o.start)) : null;
  const latest = snapshot.observations.length ? Math.max(...snapshot.observations.map(o=>o.end)) : null;
  $('coverage').textContent = `Seçilen dönem: ${period === 1 ? 'bugün' : `son ${period} gün`} · tamamlanma gününe göre, İstanbul saati. Görüntü toplam ${snapshot.observations.length} seçilmiş ana işi kapsar${earliest === null ? '' : ` (${date(earliest)} – ${date(latest)})`}. Dönemin tüm işleri ve ortalama performansı ölçülemiyor.${p.rejected ? ` ${p.rejected} eksik / çelişen kayıt dışlandı.` : ''}`;
  const ep = p.byProject.ERP.observedCount, cp = p.byProject.CRM.observedCount;
  $('metrics').replaceChildren(metric('Kanıtlı örnek ana işler', p.observedCount ?? unknown, `ERP ${ep ?? 'ölçülemiyor'} · CRM ${cp ?? 'ölçülemiyor'} · yardımcılar dahil değil`), metric('Örneklerde ort. görev süresi', duration(p.averageSeconds), `ERP ${duration(p.byProject.ERP.averageSeconds)} · CRM ${duration(p.byProject.CRM.averageSeconds)}`), metric('Dönemin toplam ana iş sayısı', unknown, 'Bu görüntü tam dönem telemetrisi içermez.'));
  $('unknown-metrics').replaceChildren(...[['Aktif çalışma', p.activeSeconds], ['Bekleme', p.waitingSeconds], ['Dot bildirim gecikmesi', p.callbackDelaySeconds], ['Devir → başlangıç / ACK', p.dispatchDelaySeconds]].map(([name,value]) => { const row = node('div','unknown-row'); row.append(node('dt','',name),node('dd','',duration(value))); return row; }));
  $('hourly').replaceChildren(...(p.hourly.length ? p.hourly.map(h => { const row = node('div','hour-row'); row.append(node('p','hour-label',`${date(h.start)} – ${date(h.start + 3600000, {day:undefined, month:undefined})}`)); for(const id of ['ERP','CRM']) { const r=node('div',`hour-project ${id.toLowerCase()}`); r.append(node('span','',id),h[id] ? progress(h[id],Math.max(3600,h.ERP,h.CRM),`${id} gözlenen duvar süresi`) : node('span','', '—'),node('output','',h[id] ? duration(h[id]) : 'Kanıt yok')); row.append(r); } return row; }) : [node('p','empty-message','Bu dönemde kullanılabilir ana oturum kanıtı yok; sıfır iş yapıldı anlamına gelmez.') ]));
  $('observations').replaceChildren(...(p.rows.length ? p.rows.map(o => { const r=node('article','observation'); r.append(node('h4','',`${o.project} · ${o.title}`),node('strong','',duration(o.seconds)),node('p','',`${date(o.start)} → ${date(o.end)}`),link('İlgili teslim kanıtı ↗',o.sourceUrl)); return r; }) : [node('p','empty-message','Seçilen dönem için ana iş kaydı bulunmuyor.') ]));
}
async function load() {
  $('refresh').disabled = true;
  try {
    const response = await fetch(new URL('./evidence.json', import.meta.url), {cache:'no-store', credentials:'omit', redirect:'error'});
    if (!response.ok) throw Error('SOURCE_UNAVAILABLE');
    snapshot = validateSnapshot(await response.json());
    renderProjects(); renderPerformance(); $('panel-content').hidden = false;
  } catch {
    $('load-state').textContent = 'Kanıt görüntüsü okunamadı veya doğrulanamadı. Güncel ilerleme / performans gösterilemiyor. Yeniden okuyabilirsiniz.';
    $('load-state').classList.add('load-error'); $('snapshot-state').textContent = 'Kaynak okunamadı';
    $('snapshot-state').className = 'badge badge-warning'; $('panel-content').hidden = true; snapshot = null;
  } finally { $('refresh').disabled = false; }
}
$('refresh').addEventListener('click', load);
document.querySelectorAll('[data-period]').forEach(b => b.addEventListener('click', () => {period = Number(b.dataset.period); if(snapshot) renderPerformance();}));
load();
