import test from 'node:test';
import assert from 'node:assert/strict';
import { MAIN_IDS, checkAudit } from './audit.mjs';

function fixture() {
  const access = { status: 'installed_normal_flow_pending', installed: true, normalSessionReadyVerified: false, normalFlowVerified: false,
    provisioningOwner: 'ERP', sharedStoreMutationOwner: 'ERP', normalRoleAndFlowOwner: 'CRM',
    activation: { successfulTransitionReceipt: 'exec-fixture-activation', newSupervisorProcessCreatedAt: '2026-10-14T12:00:01Z',
      healthArtifactObservedAt: '2026-10-14T12:00:00Z', postTransitionHealthVerified: false } };
  const focus = { id: 'CRM06', status: 'in_progress', wholeClosureVerified: false, currentAccessPreparation: access,
    nextAfterWholeClosure: { id: 'ERP09', queueOrder: 1, onlyAfterCRM06WholeClosure: true },
    conditions: ['K01','K02','K03','request_flow','assignment_permissions','persistence_replay','current_runtime_mobile','no_erp_sale_effect','preservation_delivery'].map(id => ({ id, status: 'historical proof retained; final coverage pending' })) };
  const closed = ['ERP05','CRM02','CRM05','TER01','DATA01'];
  const items = MAIN_IDS.map(id => ({ id, status: closed.includes(id) ? 'Kapalı kapsam' : 'Kısmi' }));
  const counts = { total: 55, closedScoped: 5, partial: 50, blocked: 0, open: 0, closureItemRatioPct: 9.1 };
  const rows = Array.from({ length: 21 }, (_, index) => ({ order: index + 1, ids: [index === 1 ? 'CRM06' : MAIN_IDS[index]], owner: 'ERP' }));
  rows[1].closureFocus = structuredClone(focus);
  const item = items.find(item => item.id === 'CRM06');
  item.selectedMainClosure = structuredClone(focus);
  const tracker = { items, liveSteps: [{}, {}, {}], counts, executionQueue: { rows }, selectedMainClosure: structuredClone(focus),
    currentComparison: { activeMainIds: ['CRM06'], selectedMainClosure: structuredClone(focus) } };
  const state = { selectedMainClosure: focus, deliveryClosureBaseline: { ...counts },
    crmReadinessCoordination: { selectedMainClosure: structuredClone(focus) } };
  return { state, tracker };
}
const codes = result => result.issues.map(issue => issue.code);

test('installed setup with final flow pending and historical health is a valid intermediate record', () => {
  const input = fixture();
  input.tracker.historicalCheckpoint = { installed: false, wholeClosureVerified: true };
  assert.deepEqual(codes(checkAudit(input)), []);
  assert.equal(checkAudit(input).wholeClosureGranted, false);
});
test('missing fixed ID and fabricated closure count are detected without rewriting records', () => {
  const input = fixture();
  input.tracker.items[0].id = 'ERP02';
  input.tracker.counts.closedScoped = 6;
  const before = JSON.stringify(input);
  assert.ok(codes(checkAudit(input)).includes('MAIN_IDS_CHANGED'));
  assert.ok(codes(checkAudit(input)).includes('COUNT_MISMATCH'));
  assert.equal(JSON.stringify(input), before);
});
test('a single stale live view is detected but historical copies are not compared', () => {
  const input = fixture();
  input.tracker.currentComparison.selectedMainClosure.currentAccessPreparation.installed = false;
  assert.ok(codes(checkAudit(input)).includes('ACCESS_COPY_MISMATCH'));
});
test('source push and health alone cannot close CRM06', () => {
  const input = fixture();
  input.state.selectedMainClosure.wholeClosureVerified = true;
  input.state.selectedMainClosure.latestSourcePreparation = { remoteVerified: true, commit: 'a'.repeat(40), receipt: 'exec-push' };
  const result = checkAudit(input);
  assert.ok(codes(result).includes('PREPARATION_AS_CLOSURE'));
  assert.ok(codes(result).includes('CLOSURE_EVIDENCE_INCOMPLETE'));
  assert.equal(result.wholeClosureGranted, false);
});
test('current health assertion must belong to the replacement process', () => {
  const input = fixture();
  input.state.selectedMainClosure.currentAccessPreparation.activation.postTransitionHealthVerified = true;
  assert.ok(codes(checkAudit(input)).includes('HEALTH_PREDATES_RUNTIME'));
});
test('missing normal session is a targeted prerequisite, not a record failure or password request', () => {
  const result = checkAudit({ ...fixture(), step: 'normal-ui' });
  assert.deepEqual(codes(result).sort(), ['CURRENT_HEALTH_REQUIRED', 'NORMAL_ROLE_SESSION_REQUIRED']);
  assert.ok(result.issues.every(issue => issue.kind === 'check_required'));
});
test('CRM row ownership and ERP shared runtime ownership may differ legitimately', () => {
  const input = fixture();
  input.tracker.executionQueue.rows[1].owner = 'CRM';
  assert.deepEqual(codes(checkAudit(input)), []);
  input.state.selectedMainClosure.currentAccessPreparation.sharedStoreMutationOwner = 'CRM';
  assert.ok(codes(checkAudit(input)).includes('SHARED_OWNER_CONFLICT'));
});
test('invalid source proof and off-device claim are explicit contradictions', () => {
  const input = fixture();
  input.state.selectedMainClosure.latestSourcePreparation = { remoteVerified: true, commit: 'short', receipt: '' };
  input.tracker.preservationTracking = { machineLossProtectionClaimed: true, separateDeviceOrLocationCopyVerified: false };
  const result = checkAudit(input);
  assert.ok(codes(result).includes('REMOTE_PROOF_REFERENCE_MISSING'));
  assert.ok(codes(result).includes('OFF_DEVICE_PROTECTION_UNPROVEN'));
});
