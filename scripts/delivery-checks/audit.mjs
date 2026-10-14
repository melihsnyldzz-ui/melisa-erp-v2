// Read-only checks of the existing delivery records. This never grants acceptance.
const GROUPS = { ERP: 17, CRM: 11, TER: 7, DATA: 10, EDU: 4, REL: 6 };
export const MAIN_IDS = Object.entries(GROUPS).flatMap(([prefix, count]) =>
  Array.from({ length: count }, (_, index) => prefix + String(index + 1).padStart(2, '0')));
const LABELS = { 'Kapalı kapsam': 'closedScoped', 'Kısmi': 'partial', 'Engelli': 'blocked', 'Açık': 'open' };
const CONDITION_IDS = ['K01', 'K02', 'K03', 'request_flow', 'assignment_permissions', 'persistence_replay', 'current_runtime_mobile', 'no_erp_sale_effect', 'preservation_delivery'];
const ref = value => typeof value === 'string' && value.trim().length > 0;
const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/i.test(value);
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const focusView = focus => ({ id: focus?.id, status: focus?.status, wholeClosureVerified: focus?.wholeClosureVerified });
const accessView = access => ({ status: access?.status, installed: access?.installed,
  normalSessionReadyVerified: access?.normalSessionReadyVerified, normalFlowVerified: access?.normalFlowVerified,
  activation: access?.activation?.successfulTransitionReceipt });

export function checkAudit({ state, tracker, step = 'records' } = {}) {
  const issues = [];
  const add = (code, at, message, kind = 'inconsistency') => issues.push({ code, kind, at, message });
  const counts = { total: 0, closedScoped: 0, partial: 0, blocked: 0, open: 0, closureItemRatioPct: 0 };
  if (!state || typeof state !== 'object' || !tracker || !Array.isArray(tracker.items)) {
    add('RECORD_INPUT_INVALID', 'records', 'Mevcut denetim ve teslim kayıtları okunamadı.');
    return { issues, counts, selectedId: null, wholeClosureGranted: false };
  }
  const items = tracker.items;
  const ids = items.map(item => item?.id);
  if (ids.length !== 55 || new Set(ids).size !== 55 || MAIN_IDS.some(id => !ids.includes(id)))
    add('MAIN_IDS_CHANGED', 'tracker.items', 'Sabit 55 ana kimlik kümesi eksik, yinelenmiş veya değiştirilmiş.');
  if (!Array.isArray(tracker.liveSteps) || tracker.liveSteps.length !== 3)
    add('LIVE_STEPS_CHANGED', 'tracker.liveSteps', 'Üç fiili LIVE adımı ana kapanışlardan ayrı korunmalı.');
  counts.total = items.length;
  for (const item of items) {
    if (Object.hasOwn(LABELS, item?.status)) counts[LABELS[item.status]]++;
    else add('ITEM_STATUS_UNKNOWN', 'tracker.items', 'Bir ana başlıkta tanımlanmamış durum etiketi var.');
  }
  counts.closureItemRatioPct = counts.total ? Math.round(counts.closedScoped / counts.total * 1000) / 10 : 0;
  for (const [key, value] of Object.entries(counts)) {
    if (tracker.counts?.[key] !== value) add('COUNT_MISMATCH', `tracker.counts.${key}`, 'Kaydedilmiş sayım ana maddelerden hesaplanan sayımla uyuşmuyor.');
  }
  for (const key of ['total', 'closedScoped', 'partial', 'blocked', 'open']) {
    if (state.deliveryClosureBaseline?.[key] !== counts[key]) add('BASELINE_COUNT_MISMATCH', `state.deliveryClosureBaseline.${key}`, 'Denetim görünümünün sayımı teslim tabanıyla uyuşmuyor.');
  }
  const rows = Array.isArray(tracker.executionQueue?.rows) ? tracker.executionQueue.rows : [];
  if (rows.length !== 21 || new Set(rows.map(row => row?.order)).size !== 21 ||
      Array.from({ length: 21 }, (_, n) => n + 1).some(n => !rows.some(row => row?.order === n)))
    add('QUEUE_ORDER_INVALID', 'tracker.executionQueue.rows', 'Ortak 21 sıra eksik veya yinelenmiş.');
  for (const row of rows) {
    if (!Array.isArray(row?.ids) || row.ids.length === 0 || row.ids.some(id => !MAIN_IDS.includes(id)) || !ref(row.owner))
      add('QUEUE_REFERENCE_INVALID', 'tracker.executionQueue.rows', 'Bir sıra tanımlı ana kimlik ve açık sahip bilgisi içermiyor.');
  }
  const focus = state.selectedMainClosure;
  const selectedId = focus?.id;
  if (!MAIN_IDS.includes(selectedId)) add('SELECTED_MAIN_INVALID', 'state.selectedMainClosure', 'Seçili ana başlık mevcut sabit kimliklerden biri olmalı.');
  const selectedItem = items.find(item => item?.id === selectedId);
  const selectedRow = rows.find(row => Array.isArray(row?.ids) && row.ids.includes(selectedId));
  const copies = [
    ['tracker.selectedMainClosure', tracker.selectedMainClosure],
    ['state.crmReadinessCoordination.selectedMainClosure', state.crmReadinessCoordination?.selectedMainClosure],
    ['tracker.selectedItem.selectedMainClosure', selectedItem?.selectedMainClosure],
    ['tracker.currentComparison.selectedMainClosure', tracker.currentComparison?.selectedMainClosure],
    ['tracker.selectedRow.closureFocus', selectedRow?.closureFocus]
  ];
  for (const [at, copy] of copies) {
    if (!copy || !same(focusView(focus), focusView(copy))) add('FOCUS_COPY_MISMATCH', at, 'Güncel ana iş görünümleri aynı odak ve kapanış durumunu göstermiyor.');
  }
  const access = focus?.currentAccessPreparation;
  const accessCopies = copies.map(([at, copy]) => [`${at}.currentAccessPreparation`, copy?.currentAccessPreparation]);
  accessCopies.push(['state.crmReadinessCoordination.currentAccessPreparation', state.crmReadinessCoordination?.currentAccessPreparation],
    ['tracker.selectedItem.currentAccessPreparation', selectedItem?.currentAccessPreparation],
    ['tracker.selectedRow.currentAccessPreparation', selectedRow?.currentAccessPreparation],
    ['tracker.latestTestAccessPreparation', tracker.latestTestAccessPreparation]);
  if (access) for (const [at, copy] of accessCopies) {
    if (copy && !same(accessView(access), accessView(copy))) add('ACCESS_COPY_MISMATCH', at, 'Güncel erişim görünümleri aynı kurulum ve normal akış durumunu göstermiyor.');
  }
  const activeIds = tracker.currentComparison?.activeMainIds;
  if (Array.isArray(activeIds) && activeIds.some(id => id !== selectedId))
    add('INDEPENDENT_SCOPE_DRIFT', 'tracker.currentComparison.activeMainIds', 'Seçili ana başlığa ek bağımsız aktif başlık kaydedilmiş.');
  if (selectedId === 'CRM06') {
    const next = focus?.nextAfterWholeClosure;
    if (next?.id !== 'ERP09' || next?.queueOrder !== 1 || next?.onlyAfterCRM06WholeClosure !== true)
      add('NEXT_MAIN_INVALID', 'state.selectedMainClosure.nextAfterWholeClosure', 'CRM06 sonrası ERP09 sırası özgün tam kapanışa bağlı olmalı.');
    if (access?.provisioningOwner !== 'ERP' || access?.sharedStoreMutationOwner !== 'ERP' || access?.normalRoleAndFlowOwner !== 'CRM')
      add('SHARED_OWNER_CONFLICT', 'state.selectedMainClosure.currentAccessPreparation', 'Ortak kurulum/store ERP, normal rol ve ekran akışı CRM sahipliğinde olmalı.');
    const conditions = Array.isArray(focus?.conditions) ? focus.conditions : [];
    if (conditions.length !== CONDITION_IDS.length || new Set(conditions.map(c => c?.id)).size !== CONDITION_IDS.length ||
        CONDITION_IDS.some(id => !conditions.some(c => c?.id === id)))
      add('ORIGINAL_CONDITIONS_CHANGED', 'state.selectedMainClosure.conditions', 'CRM06 özgün kapanış koşulları eksik veya değiştirilmiş.');
    const claimedClosed = focus?.wholeClosureVerified === true || selectedItem?.status === 'Kapalı kapsam';
    if (claimedClosed) {
      if (focus.wholeClosureVerified !== true || selectedItem?.status !== 'Kapalı kapsam' || access?.normalFlowVerified !== true)
        add('PREPARATION_AS_CLOSURE', 'state.selectedMainClosure', 'Tam kapanış iddiası ile normal çalışan akış kanıtı uyuşmuyor.');
      if (conditions.length !== CONDITION_IDS.length || !conditions.every(c => c?.verified === true && Array.isArray(c.evidenceRefs) && c.evidenceRefs.some(ref)))
        add('CLOSURE_EVIDENCE_INCOMPLETE', 'state.selectedMainClosure.conditions', 'Her özgün kapanış koşulu mevcut kanıt referansıyla doğrulanmalı; yeniden test gerekmez.');
    }
  }
  const source = focus?.latestSourcePreparation;
  if (source?.remoteVerified === true && (!sha(source.commit) || !ref(source.receipt)))
    add('REMOTE_PROOF_REFERENCE_MISSING', 'state.selectedMainClosure.latestSourcePreparation', 'Uzak kayıt iddiasında tam commit veya doğrulama makbuzu eksik.');
  const recovery = focus?.latestRecovery;
  if (recovery?.actualToolOutputsRead === true && ['healthReceipt', 'processGuardReceipt', 'dataComparisonReceipt'].some(k => !ref(recovery[k])))
    add('RECOVERY_PROOF_REFERENCE_MISSING', 'state.selectedMainClosure.latestRecovery', 'Okunduğu belirtilen kurtarma kanıtının referansı eksik.');
  const activation = access?.activation ?? state.latestTestAccessActivation;
  if (activation?.exactOwnedStopAndNewCoreStartReportedByReceipt === true && !ref(activation.successfulTransitionReceipt))
    add('ACTIVATION_PROOF_REFERENCE_MISSING', 'state.latestTestAccessActivation', 'Etkinleştirme iddiasının işlem makbuzu eksik.');
  if (activation?.postTransitionHealthVerified === true) {
    const healthAt = Date.parse(activation.postTransitionHealthObservedAt ?? activation.healthArtifactObservedAt);
    const processAt = Date.parse(activation.newSupervisorProcessCreatedAt);
    if (!Number.isFinite(healthAt) || !Number.isFinite(processAt) || healthAt < processAt)
      add('HEALTH_PREDATES_RUNTIME', 'state.latestTestAccessActivation', 'Sağlık kanıtı yeni çalışma sürecini doğrulamıyor.');
  }
  const preservation = tracker.preservationTracking;
  if (preservation?.machineLossProtectionClaimed === true && preservation?.separateDeviceOrLocationCopyVerified !== true)
    add('OFF_DEVICE_PROTECTION_UNPROVEN', 'tracker.preservationTracking', 'Ayrı konum kopyası olmadan makine kaybı koruması iddia edilmiş.');
  if (step === 'normal-ui') {
    if (activation && activation.postTransitionHealthVerified !== true)
      add('CURRENT_HEALTH_REQUIRED', 'selected.normal-ui', 'Yalnız bu ekran adımı için yeni çalışma sürecinin sağlık kanıtı gerekli.', 'check_required');
    if (access?.normalSessionReadyVerified !== true)
      add('NORMAL_ROLE_SESSION_REQUIRED', 'selected.normal-ui', 'Yalnız bu ekran adımı için desteklenen normal kimlik/rol oturum kanıtı gerekli; kullanıcıdan parola istenmez.', 'check_required');
  }
  return { issues, counts, selectedId: MAIN_IDS.includes(selectedId) ? selectedId : null, wholeClosureGranted: false };
}
