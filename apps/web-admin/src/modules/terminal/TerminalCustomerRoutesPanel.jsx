import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  createTerminalCustomerRoute, fetchTerminalCustomerRoutes,
  saveTerminalCustomerRouteAssignments, updateTerminalCustomerRoute,
} from '../../services/terminalCustomerRoutesApi.js';
import { searchTextIncludes } from '../../utils/searchText.js';
import {
  buildRouteAssignmentChanges, customerRouteId, customerRouteStatusLabel, deviceRouteIds, emptyRouteAssignmentDraft,
  pruneAppliedRouteDraft, routeCodeError, routeNameError, routeWriteFailureKind,
  setCustomerRouteDraft, toggleDeviceRouteDraft, validateCustomerRouteSnapshot,
} from './terminalCustomerRouteDraft.js';
import './terminal-customer-routes.css';

const newRoute = () => ({ id: '', routeCode: '', name: '', isActive: true });
const routeLabel = route => `${route.routeCode} / ${route.name}${route.isActive ? '' : ' (Pasif)'}`;

export function TerminalCustomerRoutesPanel({ permissions = [], onDirtyChange }) {
  const canManage = permissions.includes('settings.manage');
  const [snapshot, setSnapshot] = useState(null);
  const [draft, setDraft] = useState(emptyRouteAssignmentDraft);
  const [editor, setEditor] = useState(newRoute);
  const [customerSearch, setCustomerSearch] = useState('');
  const [routeFilter, setRouteFilter] = useState('all');
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [review, setReview] = useState(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  const readSequence = useRef(0);

  const savedRoute = snapshot?.routes.find(route => String(route.id) === String(editor.id));
  const editorDirty = editor.id
    ? !savedRoute || ['routeCode', 'name', 'isActive'].some(field => editor[field] !== savedRoute[field])
    : Boolean(editor.routeCode || editor.name);
  const assignmentState = useMemo(() => {
    if (!snapshot) return { changes: null, error: '', count: 0 };
    try {
      const changes = buildRouteAssignmentChanges(snapshot, draft);
      return { changes, error: '', count: changes.customerAssignments.length + changes.deviceAssignments.length };
    } catch (error) {
      return { changes: null, error: error.message, count: Object.keys(draft.customers).length + Object.keys(draft.devices).length };
    }
  }, [snapshot, draft]);
  const dirty = editorDirty || assignmentState.count > 0 || Boolean(review);

  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  function acceptSnapshot(next) {
    setSnapshot(next);
    setSelectedDeviceId(current => next.devices.some(device => String(device.id) === current) ? current : '');
  }

  async function readSnapshot({ forReview = false } = {}) {
    const sequence = ++readSequence.current;
    setLoading(true);
    try {
      const response = await fetchTerminalCustomerRoutes();
      const next = validateCustomerRouteSnapshot(response?.data);
      if (!mounted.current || sequence !== readSequence.current) return;
      acceptSnapshot(next);
      if (forReview) setReview(current => current ? { ...current, refreshed: true } : current);
      else if (snapshot && snapshot.revision !== next.revision && dirty) {
        setReview({ kind: 'stale', label: 'Güncelleme sırasında kayıtlar değişti.', refreshed: true });
      }
      setErrorMessage('');
    } catch (error) {
      if (mounted.current && sequence === readSequence.current) setErrorMessage(error.message || 'Rotalar ve cari listesi okunamadı.');
    } finally {
      if (mounted.current && sequence === readSequence.current) setLoading(false);
    }
  }

  useEffect(() => {
    if (canManage) readSnapshot();
  }, [canManage]);

  async function write(send, label, onConfirmed) {
    if (!canManage || busy.current || loading || review || !snapshot) return;
    busy.current = true;
    setPending(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const response = await send();
      const next = validateCustomerRouteSnapshot(response?.data);
      if (!mounted.current) return;
      acceptSnapshot(next);
      setDraft(current => pruneAppliedRouteDraft(next, current));
      onConfirmed?.(next);
      setSuccessMessage(`${label} kaydedildi.`);
    } catch (error) {
      if (!mounted.current) return;
      const kind = routeWriteFailureKind(error);
      setErrorMessage(error.message || 'Kayıt yanıtı alınamadı.');
      if (kind !== 'rejected') {
        setReview({ kind, label, refreshed: false });
        await readSnapshot({ forReview: true });
      }
    } finally {
      busy.current = false;
      if (mounted.current) setPending(false);
    }
  }

  function selectRoute(value) {
    const route = snapshot.routes.find(row => String(row.id) === value);
    // The select carries an exact ID; a missing option clears the previous identity.
    setEditor(route ? { id: route.id, routeCode: route.routeCode, name: route.name, isActive: route.isActive } : newRoute());
    setErrorMessage('');
    setSuccessMessage('');
  }

  function saveRoute(event) {
    event.preventDefault();
    if (!snapshot || busy.current) return;
    const validation = routeCodeError(snapshot, editor.routeCode, editor.id || null) || routeNameError(snapshot, editor.name);
    if (validation) { setErrorMessage(validation); return; }
    const body = { revision: snapshot.revision, routeCode: editor.routeCode.trim().toLocaleUpperCase('tr-TR'), name: editor.name.trim(), isActive: editor.isActive };
    const label = editor.id ? 'Rota değişikliği' : 'Yeni rota';
    write(() => editor.id ? updateTerminalCustomerRoute(editor.id, body) : createTerminalCustomerRoute(body), label, next => {
      const saved = next.routes.find(route => editor.id ? String(route.id) === String(editor.id) : route.routeCode === body.routeCode);
      setEditor(saved ? { id: saved.id, routeCode: saved.routeCode, name: saved.name, isActive: saved.isActive } : newRoute());
    });
  }

  function saveAssignments() {
    if (!assignmentState.changes || !assignmentState.count) return;
    write(() => saveTerminalCustomerRouteAssignments(assignmentState.changes), 'Cari ve cihaz atamaları');
  }

  const locked = !canManage || loading || pending || Boolean(review);
  const routes = snapshot?.routes || [];
  const cashCustomers = snapshot?.customers.filter(customer => customer.isCash) || [];
  const customers = snapshot?.customers.filter(customer => !customer.isCash
    && searchTextIncludes(`${customer.code} ${customer.name} ${customer.currency}`, customerSearch)
    && (routeFilter === 'all' || (routeFilter === 'none' ? customerRouteId(snapshot, customer.id, draft) === null
      : String(customerRouteId(snapshot, customer.id, draft)) === routeFilter))) || [];
  const selectedDevice = snapshot?.devices.find(device => String(device.id) === selectedDeviceId);
  const selectedRouteIds = selectedDevice ? deviceRouteIds(snapshot, selectedDevice.id, draft) : [];
  const savedDeviceRouteIds = selectedDevice ? deviceRouteIds(snapshot, selectedDevice.id) : [];
  const activeDeviceRoutes = selectedRouteIds.filter(id => routes.some(route => String(route.id) === String(id) && route.isActive));
  const deviceCustomerCount = selectedDevice ? snapshot.customers.filter(customer => customer.isAssignable
    && activeDeviceRoutes.some(id => String(id) === String(customerRouteId(snapshot, customer.id, draft)))).length : 0;
  const getRouteLabel = id => routes.find(route => String(route.id) === String(id))
    ? routeLabel(routes.find(route => String(route.id) === String(id))) : id === null ? 'Rotasız' : `Artık listede yok (#${id})`;

  if (!canManage) return <div className="list-state">Rota yönetimi için ayarları yönetme yetkisi gerekir.</div>;

  return (
    <section className="terminal-customer-routes" aria-label="Rotalar ve Cariler">
      <div className="dashboard-toolbar">
        <div className="dashboard-toolbar-title"><strong>Rotalar ve Cariler</strong><span>Her müşteri tek rota · Her cihaz birden fazla rota</span></div>
        <div className="dashboard-toolbar-actions">
          <button type="button" disabled={loading || pending} onClick={() => readSnapshot({ forReview: Boolean(review) })}>Güncel durumu oku</button>
          <button type="button" className="primary" disabled={locked || !assignmentState.count || Boolean(assignmentState.error)} onClick={saveAssignments}>
            {pending ? 'Kaydediliyor…' : `Atamaları kaydet${assignmentState.count ? ` (${assignmentState.count})` : ''}`}
          </button>
        </div>
      </div>
      {loading && <div className="list-state" role="status">Rotalar, bütün cariler ve cihazlar okunuyor…</div>}
      {errorMessage && <div className="list-state list-state-error" role="alert">{errorMessage}</div>}
      {successMessage && <div className="list-state" role="status">{successMessage}</div>}
      {assignmentState.error && <div className="list-state list-state-error" role="alert">{assignmentState.error}</div>}
      {review && <div className="terminal-route-review" role="alert">
        <strong>{review.kind === 'stale' ? 'Kayıtlar başka bir işlemde değişmiş.' : 'Kaydın sonucu doğrulanamadı.'}</strong>
        <p>Taslağınız korundu. Seçimlerinizi sunucudaki güncel kayıtlarla karşılaştırın.</p>
        <p>{review.refreshed ? 'Güncel kayıtlar okundu; tablolardaki “Kayıtlı rota” alanını ve rota listesini inceleyin.' : 'Güncel kayıtlar henüz okunamadı. Önce “Güncel durumu oku” düğmesini kullanın.'}</p>
        <button type="button" disabled={!review.refreshed || loading || pending} onClick={() => { setReview(null); setErrorMessage(''); }}>İnceledim, taslakla devam et</button>
      </div>}
      {snapshot && <>
        {Boolean(snapshot.unassignableDevices?.length) && <section className="erp-panel" aria-label="Rota atanamayan eski cihaz kayıtları">
          <div className="panel-title"><strong>Eski cihaz kayıtları</strong><span>Salt okunur</span></div>
          <ul>{snapshot.unassignableDevices.map((device, index) => <li key={`${device.legacyId}/${device.deviceCode}/${index}`}>
            {device.deviceCode || 'Kodsuz cihaz'} / {device.deviceName || 'Adsız cihaz'} · Kayıt kimliği: {device.legacyId || 'Bilinmiyor'}
            <strong> — Eski cihaz kaydı; rota atanamaz.</strong>
          </li>)}</ul>
        </section>}
        <section className="erp-panel terminal-route-cash-panel">
          <div className="panel-title"><strong>Her cihazdaki peşin cariler</strong><span>Sabit · Rotaya atanamaz</span></div>
          <div className="terminal-route-cash-list">{cashCustomers.map(customer => <span key={customer.id}>{customer.code} / {customer.name} · {customer.currency}</span>)}</div>
          <p>Rotası olmayan cihaz yalnız peşin carileri görür. Pasif rotalar terminalde müşteri göstermez.</p>
          {cashCustomers.length !== 3 && <div className="list-state list-state-error">Üç peşin cari tanımı doğrulanamadı. Cari tanımlarını kontrol edin.</div>}
        </section>
        <div className="terminal-routes-grid">
          <section className="erp-panel">
            <div className="panel-title"><strong>Rota tanımı</strong><span>{routes.length} rota</span></div>
            <form className="terminal-route-editor" onSubmit={saveRoute}>
              <label>Rota seç<select aria-label="Düzenlenecek rota" value={editor.id} disabled={locked || editorDirty} onChange={event => selectRoute(event.target.value)}>
                <option value="">Yeni rota</option>{routes.map(route => <option key={route.id} value={route.id}>{routeLabel(route)}</option>)}
              </select></label>
              <label>Rota kodu<input value={editor.routeCode} maxLength={80} disabled={locked} onChange={event => setEditor(current => ({ ...current, routeCode: event.target.value }))} /></label>
              <label>Rota adı<input value={editor.name} maxLength={200} disabled={locked} onChange={event => setEditor(current => ({ ...current, name: event.target.value }))} /></label>
              <label className="terminal-route-checkbox"><input type="checkbox" checked={editor.isActive} disabled={locked || !editor.id} onChange={event => setEditor(current => ({ ...current, isActive: event.target.checked }))} />Aktif rota</label>
              {savedRoute && <small>Kayıtlı: {routeLabel(savedRoute)}</small>}
              {editor.id && !editor.isActive && <small>Pasife alındığında bu rotadaki müşteriler cihaz listelerinde görünmez. Atamalar korunur.</small>}
              <div className="dashboard-toolbar-actions">
                <button type="submit" disabled={locked || !editorDirty}>{editor.id ? 'Rota değişikliğini kaydet' : 'Rota oluştur'}</button>
                <button type="button" disabled={locked || !editorDirty} onClick={() => selectRoute(String(editor.id))}>Rota düzenlemesini geri al</button>
              </div>
            </form>
          </section>
          <section className="erp-panel">
            <div className="panel-title"><strong>Cihaz rotaları</strong><span>Birden fazla seçilebilir</span></div>
            <div className="terminal-route-editor">
              <label>Cihaz<select aria-label="Rota atanacak cihaz" value={selectedDeviceId} disabled={loading || pending} onChange={event => setSelectedDeviceId(event.target.value)}>
                <option value="">Cihaz seçin</option>{snapshot.devices.map(device => <option key={device.id} value={device.id}>{device.deviceCode} / {device.deviceName}{device.isActive ? '' : ' (Pasif)'}</option>)}
              </select></label>
              {selectedDevice && <>
                <small>Kayıtlı rotalar: {savedDeviceRouteIds.length ? savedDeviceRouteIds.map(getRouteLabel).join(', ') : 'Yalnız peşin cariler'}</small>
                <div className="terminal-route-options">{routes.map(route => {
                  const checked = selectedRouteIds.some(id => String(id) === String(route.id));
                  return <label className="terminal-route-checkbox" key={route.id}><input type="checkbox" checked={checked}
                    disabled={locked || ((!route.isActive || !selectedDevice.isActive) && !checked)}
                    onChange={event => setDraft(current => toggleDeviceRouteDraft(snapshot, current, selectedDevice.id, route.id, event.target.checked))} />{routeLabel(route)}</label>;
                })}{!routes.length && <span>Önce bir rota oluşturun.</span>}</div>
                <strong>{activeDeviceRoutes.length ? `${activeDeviceRoutes.length} aktif rota · ${deviceCustomerCount} müşteri + peşin cariler` : 'Yalnız peşin cariler'}</strong>
                <button type="button" disabled={locked || !selectedRouteIds.length} onClick={() => setDraft(current => ({ ...current, devices: { ...current.devices, [selectedDevice.id]: [] } }))}>Bu cihazın rota seçimlerini kaldır</button>
              </>}
            </div>
          </section>
        </div>
        <section className="erp-panel">
          <div className="panel-title"><strong>Müşteri rotaları</strong><span>{customers.length} gösterilen / {snapshot.customers.filter(customer => !customer.isCash).length} müşteri</span></div>
          <div className="terminal-route-filters">
            <label>Müşteri ara<input value={customerSearch} onChange={event => setCustomerSearch(event.target.value)} placeholder="Cari kodu, adı veya para birimi" /></label>
            <label>Rota filtresi<select value={routeFilter} onChange={event => setRouteFilter(event.target.value)}><option value="all">Bütün rotalar</option><option value="none">Rotasız müşteriler</option>{routes.map(route => <option key={route.id} value={route.id}>{routeLabel(route)}</option>)}</select></label>
          </div>
          <div className="table-shell terminal-route-customer-table"><table className="erp-table"><thead><tr><th>Cari kodu</th><th>Müşteri</th><th>Döviz</th><th>Kayıtlı rota</th><th>Rota seçimi</th></tr></thead><tbody>
            {customers.map(customer => {
              const selectedId = customerRouteId(snapshot, customer.id, draft);
              const savedId = customerRouteId(snapshot, customer.id);
              const statusLabel = customerRouteStatusLabel(customer);
              return <tr key={customer.id} className={String(selectedId) !== String(savedId) ? 'terminal-route-changed' : ''}>
                <td>{customer.code}</td><td>{customer.name}{statusLabel && <small> ({statusLabel})</small>}</td><td>{customer.currency}</td><td>{getRouteLabel(savedId)}</td>
                <td><select aria-label={`${customer.code} rota seçimi`} value={selectedId ?? ''} disabled={locked}
                  onChange={event => setDraft(current => setCustomerRouteDraft(current, customer.id, event.target.value))}>
                  <option value="">Rotasız</option>
                  {selectedId !== null && !routes.some(route => String(route.id) === String(selectedId)) && <option value={selectedId} disabled>Seçilen rota artık listede yok</option>}
                  {routes.map(route => <option key={route.id} value={route.id} disabled={!route.isActive || !customer.isAssignable}>{routeLabel(route)}</option>)}
                </select></td>
              </tr>;
            })}
            {!customers.length && <tr><td colSpan="5">Aramaya uygun müşteri yok.</td></tr>}
          </tbody></table></div>
        </section>
      </>}
    </section>
  );
}
