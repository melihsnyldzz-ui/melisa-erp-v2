import {createLazyVegaClient as createVegaProductClient} from '../services/lazyVegaClient.mjs';
import { createVegaProductStorage } from '../services/vegaProductStorage.js';
import { currency, display } from '../modules/vega/vegaReadModel.js';
import { loadAccountPage, matchesAccount } from './accountModel.js';
import './accounts.css';

const storage = name => { try { return window[name]; } catch { return undefined; } };
const client = createVegaProductClient({
  allowLocalTest: import.meta.env.VITE_TEST_READ_ONLY === 'true',
  baseUrl: import.meta.env.VITE_VEGA_PRODUCTS_BASE_URL || 'https://vega-api.melisababy.com',
  allowAccounts: true,
  storage: createVegaProductStorage(storage('localStorage'), storage('sessionStorage')),
});
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let dispose = () => {};
function mount() {
  dispose();
  const root = document.getElementById('liveAccounts');
  if (!root) return;
  const controller = new AbortController();
  let connected = false;
  let active = true, rows = [], cursor, complete = false, busy = false, page = 0, query = '', selectedCurrency = '', readAt = '', error = '';
  const seen = new Set();
  dispose = () => { active = false; controller.abort(); root.replaceChildren(); };
  const alive = () => active && root.isConnected;
  const options = { signal: controller.signal };
  function showError(cause) {
    error = cause.status === 401 ? 'Mevcut cari bağlantısı artık geçerli değil. Ekranı kullanmaya devam edebilirsiniz.' : cause.status === 403 ? 'Bu ERP hesabının cari görüntüleme yetkisi yok.' : cause.message || 'Cari bağlantısı kurulamadı. Tekrar deneyin.';
  }
  async function authorized(session) {
    if (!alive()) return;
    if (!session.data?.permissions?.includes('customer.view')) {
      connected = false; error = 'Mevcut bağlantıda cari görüntüleme yetkisi bulunmuyor.'; paint(); return;
    }
    connected = true; await load(false);
  }
  function shell() {
    root.innerHTML = `<section class="card panel"><div class="panel-head"><h2>Cari listesi</h2><span class="pill green">Yalnız görüntüleme</span></div><form class="filters" id="account-search-form"><input id="account-search" class="search" aria-label="Cari adı veya kodu" placeholder="Cari adı veya kodu ara" maxlength="120"><select class="filter" id="account-currency" aria-label="Cari dövizi"><option value="">Tüm dövizler</option></select><button class="btn primary" id="account-search-all" type="submit">Tüm carilerde ara</button><button class="btn" id="account-refresh" type="button">Yenile</button></form><div id="account-status" class="account-status" role="status" aria-live="polite"></div><div id="account-error" role="alert"></div><div class="tablewrap"><table><thead><tr><th>Cari kodu</th><th>Cari adı</th><th>Grup</th><th>Döviz</th></tr></thead><tbody id="account-rows"></tbody></table></div><div class="filters"><button class="btn" id="account-prev">Önceki</button><span id="account-page"></span><button class="btn" id="account-next">Sonraki</button></div></section><p class="notice">Kaynak: Vega 2026 · Cari kartları. Bakiye, vade ve hareket geçmişi bu ekrana henüz bağlı değil.</p>`;
    root.querySelector('#account-search').oninput = event => { query = event.target.value.trim(); page = 0; paint(); };
    root.querySelector('#account-currency').onchange = event => { selectedCurrency = event.target.value; page = 0; paint(); };
    root.querySelector('#account-search-form').onsubmit = event => { event.preventDefault(); page = 0; load(true); };
    root.querySelector('#account-refresh').onclick = restore;
    root.querySelector('#account-prev').onclick = () => { page = Math.max(0, page - 1); paint(); };
    root.querySelector('#account-next').onclick = async () => {
      if ((page + 1) * 50 < filtered().length) { page++; paint(); }
      else if (!complete) { await load(Boolean(query || selectedCurrency)); if ((page + 1) * 50 < filtered().length) page++; paint(); }
    };
  }
  const filtered = () => rows.filter(row => matchesAccount(row, query, selectedCurrency));
  function paint() {
    if (!alive() || !root.querySelector('#account-rows')) return;
    const visible = filtered(), count = Math.max(1, Math.ceil(visible.length / 50));
    page = Math.min(page, count - 1);
    root.querySelector('#account-rows').innerHTML = visible.slice(page * 50, (page + 1) * 50).map(row => `<tr><td>${escape(display(row.accountCode))}</td><td><b>${escape(display(row.name))}</b></td><td>${escape(display(row.groupCode))}</td><td>${escape(currency(row.currency))}</td></tr>`).join('') || `<tr><td colspan="4" class="account-empty">${!connected ? 'Gerçek cari bağlantısı henüz hazır değil. Diğer ekranları kullanabilirsiniz.' : busy ? 'Cari kartları okunuyor…' : error ? 'Cari listesi tamamlanamadı. Yeniden deneyin.' : complete ? 'Aramanızla eşleşen cari bulunamadı.' : 'Yüklenen kayıtlarda eşleşme yok. Tüm carilerde aramayı kullanın.'}</td></tr>`;
    const currencies = [...new Set(rows.filter(r => r.currency != null && r.currency !== '').map(r => String(r.currency)))].sort();
    root.querySelector('#account-currency').innerHTML = '<option value="">Tüm dövizler</option>' + currencies.map(value => `<option value="${escape(value)}" ${value === selectedCurrency ? 'selected' : ''}>${escape(currency(value))}</option>`).join('');
    root.querySelector('#account-status').textContent = !connected ? (busy ? 'Mevcut bağlantı kontrol ediliyor…' : 'Cari ekranı açık · Gerçek kayıtlar henüz yüklenmedi') : `${busy ? 'Okunuyor · ' : ''}${rows.length} cari yüklendi · ${visible.length} eşleşme${complete ? ' · Tüm liste tarandı' : ' · Liste henüz tamamlanmadı'}${readAt ? ' · Son okuma: ' + new Date(readAt).toLocaleString('tr-TR') : ''}`;
    root.querySelector('#account-error').innerHTML = error ? `<div class="notice amber">${escape(error)}${rows.length ? ' Gösterilen kayıtlar kısmi listedir.' : ''}<button class="btn small" id="account-reconnect">Bağlantıyı tekrar dene</button></div>` : '';
    if (error) root.querySelector('#account-reconnect').onclick = restore;
    root.querySelector('#account-page').textContent = !connected ? 'Veri bekleniyor' : `Sayfa ${page + 1} / ${count}${complete ? '' : ' (yüklenen)'}`;
    root.querySelector('#account-prev').disabled = busy || page === 0;
    root.querySelector('#account-next').disabled = !connected || busy || (complete && page + 1 >= count);
    root.querySelector('#account-refresh').disabled = busy;
    root.querySelector('#account-search-all').disabled = busy || !connected;
    root.querySelector('#account-search').disabled = !connected;
    root.querySelector('#account-currency').disabled = !connected;
  }
  async function load(all) {
    if (busy || !alive() || !connected) return;
    busy = true; error = ''; paint();
    try {
      let pages = 0;
      do {
        if (complete) break;
        const result = await loadAccountPage(client, cursor, options, seen);
        if (!alive()) return;
        const records = new Map(rows.map(row => [row.sourceId, row]));
        result.rows.forEach(row => records.set(row.sourceId, row)); rows = [...records.values()];
        cursor = result.nextCursor; complete = result.complete; readAt = result.readAt || readAt; pages++;
        paint();
        if (all && !complete && pages >= 200) throw new Error('Arama sınırına ulaşıldı; devam etmek için Tüm carilerde ara düğmesine tekrar basın.');
      } while (all && !complete && alive());
    } catch (cause) {
      if (!alive()) return;
      if (cause.status === 401 || cause.status === 403) { connected = false; rows = []; cursor = undefined; complete = false; seen.clear(); }
      showError(cause);
    } finally { busy = false; paint(); }
  }
  async function restore() {
    if (!alive() || busy) return;
    connected = false; rows = []; cursor = undefined; complete = false; seen.clear(); page = 0; readAt = ''; error = '';
    paint();
    if (!client.hasSession()) return;
    busy = true; paint();
    try {
      const session = await client.get('/api/auth/me', {}, options);
      busy = false;
      await authorized(session);
    } catch (cause) { if (alive()) showError(cause); }
    finally { busy = false; paint(); }
  }
  shell();
  restore();
}
document.addEventListener('workflow-render', mount);
mount();
