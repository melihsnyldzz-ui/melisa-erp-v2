import { pages, lessons, acceptanceChecks, serviceRows, futurePages } from './catalog.mjs';

// This portal only GETs its own configuration/status. It never reads login
// storage, injects tokens, approves work, or calls commercial ERP/CRM APIs.
const CONFIG_PATH = '/melisa-hub/config.json';
const STATUS_PATH = '/melisa-hub/status.json';
const TEST_ENVIRONMENT = 'ISOLATED_TEST_COPY';
const STATUS_MAX_AGE = 5 * 60 * 1000;
const REQUEST_TIMEOUT = 8000;
const POLL_INTERVAL = 30000;
const $ = id => document.getElementById(id);
const state = { config: null, status: null, refreshing: false, statusError: false, configError: false, configLoading: true, liveUrl: null, test125Url: null };

export function isPrivateHost(hostname) {
  const host = String(hostname).toLowerCase();
  const parts = host.split('.');
  if (parts.length !== 4 || !parts.every(part => /^(0|[1-9]\d{0,2})$/.test(part) && Number(part) <= 255)) return host.endsWith('.ts.net');
  const [a, b] = parts.map(Number);
  return a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 100 && b >= 64 && b <= 127);
}

export function safeInternalUrl(value, current = window.location, allowedPorts = [current.port]) {
  if (typeof value !== 'string' || !value || value.startsWith('//') || value.length > 1024 || /[\u0000-\u0020\\]/.test(value)) return null;
  try {
    const url = new URL(value, current.origin);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    if (['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'].includes(url.hostname.toLowerCase())) return null;
    if (url.hostname !== current.hostname || url.protocol !== current.protocol || !allowedPorts.includes(url.port)) return null;
    // Query values must never carry credentials or implicit login bypasses.
    if ([...url.searchParams.keys()].some(key => /token|password|secret|authorization|auth.?bypass/i.test(key))) return null;
    return url.href;
  } catch { return null; }
}

export function crmUrl(config, current = window.location) {
  if (config?.environment !== TEST_ENVIRONMENT || config?.crm?.enabled !== true || config.crm.validated !== true) return null;
  if (typeof config.crm.path === 'string') {
    if (!config.crm.path.startsWith('/') || config.crm.path.startsWith('//')) return null;
    const url = safeInternalUrl(config.crm.path, current);
    return url && new URL(url).origin === current.origin ? url : null;
  }
  // The audited CRM port is deliberately fixed; config cannot open another
  // service (chat/accounting etc.) merely by supplying an arbitrary port.
  if (config.crm.port !== 62700 || current.protocol !== 'http:') return null;
  const url = new URL('/', current.origin);
  url.port = '62700';
  return safeInternalUrl(url.href, current, ['62700']);
}

export function availability(status, key, now = Date.now()) {
  const checkedAt = Date.parse(status?.checkedAt ?? '');
  const service = status?.services?.[key];
  if (!Number.isFinite(checkedAt) || now - checkedAt > STATUS_MAX_AGE || checkedAt - now > 60000 || !service) return { state: 'unknown', label: 'Doğrulanmadı', detail: '' };
  const details = typeof service.detail === 'string' ? service.detail.slice(0, 180) : '';
  if (service.state === 'reachable') return { state: 'reachable', label: 'Erişilebilir', detail: details };
  if (service.state === 'unreachable') return { state: 'unreachable', label: 'Erişilemiyor', detail: details };
  return { state: 'unknown', label: 'Doğrulanmadı', detail: details };
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function testEnabled() { return state.config?.environment === TEST_ENVIRONMENT && state.config?.erp?.enabled === true && state.config?.erp?.validated === true; }
function verifiedSpecialUrl(key) {
  const entry = state.config?.[key];
  // Current audited original TEST125 uses 5194. New live origins need a code
  // review before extension; a config flag cannot expose an arbitrary port.
  const allowedPorts = key === 'test125' ? [window.location.port, '5194'] : [window.location.port];
  return entry?.enabled === true && entry.validated === true ? safeInternalUrl(entry.url, window.location, allowedPorts) : null;
}
function destination(page) {
  if (page === 'test125') return state.test125Url;
  if (page === 'live') return state.liveUrl;
  if (page === 'training') return testEnabled() ? safeInternalUrl('/kullanim-egitimi.html#receiving') : null;
  const item = pages.find(entry => entry.id === page);
  if (!item || !testEnabled()) return null;
  return item.kind === 'crm' ? crmUrl(state.config) : safeInternalUrl(item.path);
}

function navigation(label, url, className = 'button button-outline') {
  const node = element(url ? 'a' : 'button', className, label);
  if (url) { node.href = url; }
  else { node.type = 'button'; node.disabled = true; }
  node.append(element('span', '', '↗'));
  node.lastElementChild.setAttribute('aria-hidden', 'true');
  return node;
}

function badge(label, kind = 'neutral') { return element('span', `badge badge-${kind}`, label); }
function statusBadge(service) {
  const value = availability(state.status, service);
  const node = badge(value.label, value.state === 'reachable' ? 'ready' : value.state === 'unreachable' ? 'error' : 'neutral');
  if (value.detail) node.title = value.detail;
  return node;
}

function drawWorkCard(item, url) {
  const card = element('article', 'work-card');
  const head = element('div', 'card-head');
  const icon = element('span', 'card-icon', item.icon || '＋');
  icon.setAttribute('aria-hidden', 'true');
  head.append(icon, badge('TEST', 'soft'));
  const copy = element('div');
  copy.append(element('h3', '', item.title), element('p', '', item.description));
  const value = availability(state.status, item.service);
  const health = element('div', 'card-status');
  health.dataset.state = value.state;
  const dot = element('span', `status-dot ${value.state === 'reachable' ? 'dot-ready' : value.state === 'unreachable' ? 'dot-error' : 'dot-unknown'}`);
  dot.setAttribute('aria-hidden', 'true');
  health.append(dot, document.createTextNode(value.label));
  const link = navigation(item.label || 'Ekranı aç', url);
  link.id = `work-open-${item.id}`;
  card.append(head, copy, health, link);
  return card;
}

function renderWork() {
  const focused = document.activeElement?.id;
  const container = $('work-cards');
  container.replaceChildren(...pages.map(item => drawWorkCard(item, destination(item.id))));
  container.setAttribute('aria-busy', String(state.configLoading));
  state.test125Url = verifiedSpecialUrl('test125');
  state.liveUrl = verifiedSpecialUrl('live');
  $('test125-link').disabled = !state.test125Url;
  $('test125-state').textContent = state.test125Url ? 'Adres doğrulandı · ayrı ortam' : 'Adres doğrulanmadı';
  $('test125-state').className = state.test125Url ? 'badge badge-soft' : 'badge badge-neutral';
  $('live-link').disabled = !state.liveUrl;
  $('live-state').textContent = state.liveUrl ? 'Canlı · uyarıyla açılır' : 'Erişim tanımlı değil';
  $('live-state').className = state.liveUrl ? 'badge badge-warning' : 'badge badge-neutral';
  const configured = Array.isArray(state.config?.links) ? state.config.links : [];
  const extensions = [...futurePages, ...configured].slice(0, 20).flatMap(entry => {
    if (!testEnabled() || entry?.verified !== true || entry.environment !== TEST_ENVIRONMENT || typeof entry.title !== 'string' || typeof entry.description !== 'string') return [];
    const url = safeInternalUrl(entry.path ?? entry.url);
    if (!url || new URL(url).origin !== window.location.origin) return [];
    return [drawWorkCard({ id: `extra-${extensionsId(entry)}`, title: entry.title.slice(0, 80), description: entry.description.slice(0, 200), service: String(entry.service ?? ''), icon: '＋' }, url)];
  });
  $('extra-cards').replaceChildren(...extensions);
  if (focused?.startsWith('work-open-')) restoreFocus(focused);
}

function extensionsId(entry) { return String(entry.path ?? entry.url ?? '').replace(/[^a-z0-9]/gi, '-').slice(0, 100); }
function restoreFocus(id) { const target = $(id); if (target && !target.disabled) target.focus({ preventScroll: true }); }

function renderLessons() {
  const focused = document.activeElement?.id;
  $('lesson-cards').replaceChildren(...lessons.map((lesson, index) => {
    const url = testEnabled() ? safeInternalUrl(`/kullanim-egitimi.html#${lesson.id}`) : null;
    const card = element(url ? 'a' : 'div', 'lesson-card');
    card.id = `lesson-open-${lesson.id}`;
    if (url) card.href = url;
    else card.setAttribute('aria-disabled', 'true');
    const number = element('span', 'lesson-number', String(index + 1).padStart(2, '0'));
    number.setAttribute('aria-hidden', 'true');
    const copy = element('div');
    copy.append(element('h3', '', lesson.title), element('p', '', lesson.description), element('span', 'lesson-time', url ? `${lesson.duration} · Dersi aç →` : `${lesson.duration} · Adres doğrulanıyor`));
    card.append(number, copy);
    return card;
  }));
  $('lesson-cards').setAttribute('aria-busy', String(state.configLoading));
  if (focused?.startsWith('lesson-open-') && $(focused)?.tagName === 'A') restoreFocus(focused);
}

function renderAcceptance() {
  $('acceptance-list').replaceChildren(...acceptanceChecks.map(check => {
    const item = element('li');
    const copy = element('div');
    copy.append(element('strong', '', check.title), element('p', '', check.detail));
    item.append(copy, badge('Bekliyor', 'warning'));
    return item;
  }));
}

function formatCheckedAt(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Istanbul' }).format(date);
}

function renderStatus() {
  const focused = document.activeElement?.id;
  const rows = serviceRows.map(service => {
    const row = element('tr');
    const title = element('td', '', service.label);
    const status = element('td');
    status.append(statusBadge(service.id));
    const detail = availability(state.status, service.id).detail;
    if (detail) status.append(element('span', 'service-detail', detail));
    const link = element('td');
    const url = destination(service.page);
    if (url && service.page !== 'live') { const launch = navigation('Aç', url, 'text-link'); launch.id = `status-open-${service.id}`; link.append(launch); }
    else if (url && service.page === 'live') {
      const live = element('button', 'button button-outline', 'Uyarıyla aç');
      live.type = 'button'; live.id = `status-open-${service.id}`; live.addEventListener('click', openLiveDialog); link.append(live);
    } else link.append(element('span', 'service-detail', state.configLoading ? 'Ayarlar kontrol ediliyor' : 'Adres doğrulanmadı'));
    row.append(title, status, link, element('td'));
    row.lastElementChild.append(badge('Bekliyor', 'warning'));
    return row;
  });
  $('status-rows').replaceChildren(...rows);
  if (focused?.startsWith('status-open-')) restoreFocus(focused);
  const checked = formatCheckedAt(state.status?.checkedAt);
  const fresh = Number.isFinite(Date.parse(state.status?.checkedAt)) && Date.now() - Date.parse(state.status.checkedAt) <= STATUS_MAX_AGE;
  $('status-meta').textContent = state.refreshing ? 'Bağlantı durumu yenileniyor…' : state.statusError ? 'Durum servisine ulaşılamadı. Ekranların erişimi doğrulanmadı.' : checked ? `Son sunucu kontrolü: ${checked} (Türkiye saati)${fresh ? '' : ' · Kontrol eski; yeniden doğrulama bekleniyor.'}` : 'Son kontrol henüz alınmadı. Ekranların erişimi doğrulanmadı.';
  $('refresh-status').disabled = state.refreshing;
}

function renderConfig() {
  const checked = formatCheckedAt(state.config?.checkedAt);
  const verified = testEnabled();
  $('header-environment').textContent = verified ? 'PAYLAŞILAN TEST KOPYASI' : 'Ortam doğrulanmadı';
  $('header-environment').className = verified ? 'badge badge-soft' : 'badge badge-neutral';
  $('work-environment-title').textContent = verified ? 'Paylaşılan test kopyası' : 'Ortam doğrulanmadı';
  $('environment-dot').className = `status-dot ${verified ? 'dot-warning' : 'dot-unknown'}`;
  $('environment-detail').textContent = verified ? 'ERP ve CRM için ayrılmış çalışma kopyası. TEST125 ve canlı ekranlar ayrı girişlerde tutulur.' : 'Bağlantı ayarları doğrulanana kadar iş ekranları açılmaz.';
  $('config-notice').className = verified ? 'notice' : 'notice notice-warning';
  $('config-notice-text').textContent = verified ? `Bu bölüm paylaşılan test ortamını açar. Test kaydı oluşturmadan önce sorumlunuzun senaryosunu izleyin.${checked ? ` Ayar kontrolü: ${checked}.` : ''}` : state.configLoading ? 'Bağlantı ayarları kontrol ediliyor…' : 'Portal bağlantı ayarlarına ulaşılamadı veya ortam doğrulanmadı. Yetkili sorumlu bağlantı ayarlarını kontrol etmelidir.';
  const access = state.config?.access;
  $('access-detail').textContent = access?.verified === true && typeof access.summary === 'string' ? access.summary.slice(0, 400) : 'Şirkette doğrulanmış LAN adresini kullanın. Evden erişim için Tailscale bağlantısı ve bu cihaza verilen erişim yetkisi gerekir.';
  $('access-verification').textContent = access?.verified === true && typeof access.clientVerification === 'string' ? access.clientVerification.slice(0, 250) : 'Bu cihazın uzaktan erişimi henüz portal tarafından doğrulanmadı.';
}

async function readJson(path) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const response = await fetch(path, { method: 'GET', cache: 'no-store', redirect: 'error', credentials: 'same-origin', signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('Unavailable');
    const value = await response.json();
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid document');
    return value;
  } finally { clearTimeout(timeout); }
}

async function loadConfig() {
  try {
    const config = await readJson(CONFIG_PATH);
    if (config.environment !== TEST_ENVIRONMENT || !Number.isFinite(Date.parse(config.checkedAt)) || Date.parse(config.checkedAt) - Date.now() > 60000) throw new Error('Unverified environment');
    state.config = config;
    state.configError = false;
  } catch { state.config = null; state.configError = true; }
  finally { state.configLoading = false; renderConfig(); renderWork(); renderLessons(); renderStatus(); }
}

async function refreshStatus() {
  if (state.refreshing) return;
  state.refreshing = true; renderStatus();
  try { state.status = await readJson(STATUS_PATH); state.statusError = false; }
  catch { state.status = null; state.statusError = true; }
  finally { state.refreshing = false; renderWork(); renderStatus(); }
}

function openLiveDialog() {
  if (!state.liveUrl) return;
  $('live-acknowledge').checked = false;
  $('confirm-live').disabled = true;
  const dialog = $('live-dialog');
  // Older terminal browsers keep live navigation closed if dialog is absent.
  if (typeof dialog.showModal === 'function') dialog.showModal();
}

function start() {
  renderAcceptance(); renderWork(); renderLessons(); renderStatus();
  $('refresh-status').addEventListener('click', () => { void loadConfig(); void refreshStatus(); });
  $('test125-link').addEventListener('click', () => { if (state.test125Url) window.location.assign(state.test125Url); });
  $('live-link').addEventListener('click', openLiveDialog);
  $('live-acknowledge').addEventListener('change', event => { $('confirm-live').disabled = !event.target.checked || !state.liveUrl; });
  $('confirm-live').addEventListener('click', () => { if (state.liveUrl && $('live-acknowledge').checked) { $('live-dialog').close(); window.location.assign(state.liveUrl); } });
  window.addEventListener('offline', () => { state.status = null; state.statusError = true; renderWork(); renderStatus(); });
  window.addEventListener('online', () => { void loadConfig(); void refreshStatus(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void refreshStatus(); });
  void loadConfig(); void refreshStatus();
  setInterval(() => { if (!document.hidden && navigator.onLine !== false) void refreshStatus(); }, POLL_INTERVAL);
  setInterval(() => { if (!document.hidden && navigator.onLine !== false) void loadConfig(); }, 5 * 60 * 1000);
}

if (typeof document !== 'undefined') start();
