// Offline evidence classifier for a disposable PS5 fixture. No runtime authority.
export const FIXTURE_GUARD_MS = 60_000;
const need = (value, code) => { if (!value) throw new Error(code); };
const guid = value => typeof value === 'string' && /^[a-f0-9]{32}$/.test(value);
const birth = value => typeof value === 'string' && /^[1-9][0-9]{15,19}$/.test(value);
const stamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
export function plainTerminal(value) {
  need(typeof value === 'string', 'PTY_OUTPUT_TYPE');
  return value.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/\r/g, '');
}
export function validateReady(ready, expected) {
  need(ready?.schema === 'melisa-b6-pty-fixture-ready.v1', 'PTY_READY_SCHEMA');
  need(guid(expected?.nonce) && ready.nonce === expected.nonce, 'PTY_READY_NONCE');
  need(Number.isSafeInteger(expected.ownerPid) && expected.ownerPid > 0 && ready.ownerPid === expected.ownerPid, 'PTY_READY_PID');
  need(birth(expected.ownerBirth) && ready.ownerBirth === expected.ownerBirth, 'PTY_READY_BIRTH');
  need(ready.fixtureRoot === expected.fixtureRoot, 'PTY_READY_ROOT');
  need(ready.runspaceId === 1 && ready.guardMilliseconds === FIXTURE_GUARD_MS, 'PTY_READY_GUARD');
  need(stamp(ready.startedUtc) && stamp(ready.deadlineUtc) && Date.parse(ready.deadlineUtc) - Date.parse(ready.startedUtc) === FIXTURE_GUARD_MS, 'PTY_READY_DEADLINE');
  return Object.freeze({ ...ready });
}
export function validateDebugPrompt(output, ownerPid, runspaceId = 1) {
  need(Number.isSafeInteger(ownerPid) && ownerPid > 0 && runspaceId === 1, 'PTY_PROMPT_IDENTITY');
  const text = plainTerminal(output);
  // The process and runspace must occur on the same debugger prompt line.
  const line = text.split('\n').filter(value => value.trim()).at(-1) ?? '';
  const pattern = new RegExp('^\\[DBG\\]: \\[Process:' + ownerPid + '\\]: \\[Runspace' + runspaceId + '\\]: PS .+>> ?$');
  need(pattern.test(line), 'PTY_PROMPT_MISMATCH');
  return line;
}
export function classifyTrace(trace) {
  need(Array.isArray(trace?.events), 'PTY_TRACE_EVENTS');
  const phases = ['prompt-observed','q-dispatch','q-return','retained-exit-observed','signal-dispatch','controller-return'];
  let last = -1;
  for (const event of trace.events) {
    need(phases.includes(event.name), 'PTY_TRACE_PHASE');
    need(stamp(event.utc) && Number.isFinite(event.monotonicMs) && event.monotonicMs >= last, 'PTY_TRACE_CLOCK');
    last = event.monotonicMs;
  }
  const events = name => trace.events.filter(event => event.name === name);
  const first = name => events(name)[0];
  need(events('q-dispatch').length <= 1 && events('signal-dispatch').length <= 1, 'PTY_REPEATED_INPUT');
  need(phases.every(name => events(name).length <= 1), 'PTY_REPEATED_PHASE');
  const ready = validateReady(trace.ready, trace.expected);
  const q = first('q-dispatch');
  const signal = first('signal-dispatch');
  const prompt = first('prompt-observed');
  const exit = first('retained-exit-observed');
  const qReturn = first('q-return');
  const controllerReturn = first('controller-return');
  if (q) {
    need(prompt && prompt.monotonicMs <= q.monotonicMs, 'PTY_Q_WITHOUT_PROMPT');
    validateDebugPrompt(prompt.output, ready.ownerPid);
  }
  if (signal) need(q && qReturn && exit && q.monotonicMs <= qReturn.monotonicMs && qReturn.monotonicMs <= exit.monotonicMs && exit.monotonicMs <= signal.monotonicMs, 'PTY_SIGNAL_WITHOUT_EXIT');
  const deadline = Date.parse(ready.deadlineUtc);
  const late = trace.events.some(event => ['q-dispatch', 'q-return', 'signal-dispatch', 'controller-return'].includes(event.name) && Date.parse(event.utc) >= deadline);
  const receipt = trace.receipt;
  const hex = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
  const identity = receipt?.schema === 'melisa-b6-pty-fixture-result.v1' && receipt?.fixtureRoot === ready.fixtureRoot && receipt?.nonce === ready.nonce && receipt?.ownerPid === ready.ownerPid && receipt?.ownerBirth === ready.ownerBirth && receipt?.ownerExitCode === 0 && Number.isSafeInteger(trace.expected.controllerPid) && trace.expected.controllerPid > 0 && receipt?.controllerPid === trace.expected.controllerPid && birth(trace.expected.controllerBirth) && receipt?.controllerBirth === trace.expected.controllerBirth && hex(trace.expected.sourceSha256) && receipt?.sourceSha256 === trace.expected.sourceSha256 && hex(trace.expected.nativeSha256) && receipt?.nativeSha256 === trace.expected.nativeSha256;
  const complete = qReturn && controllerReturn && q && signal && q.monotonicMs <= qReturn.monotonicMs && signal.monotonicMs <= controllerReturn.monotonicMs;
  const elapsed = receipt?.elapsedMilliseconds;
  const success = complete && identity && receipt?.status === 'PASS' && receipt?.signalReads === 1 && receipt?.ownerExited === true && receipt?.mutexAcquired === true && receipt?.mutexAbandoned === false && receipt?.guardMilliseconds === FIXTURE_GUARD_MS && typeof elapsed === 'number' && Number.isFinite(elapsed) && elapsed >= 0 && elapsed < FIXTURE_GUARD_MS;
  const result = receipt?.status === 'FAILED' ? 'FAIL' : success && q && signal && !late ? 'PASS' : 'UNKNOWN';
  return Object.freeze({ result, lateObserved: late, qCalls: events('q-dispatch').length,
    signalCalls: events('signal-dispatch').length, transportDeliveryBoundProven: false,
    runtimeGo: false, automaticRetryAllowed: false,
    reason: result === 'PASS' ? 'ONE_MEASURED_FIXTURE_ONLY' : receipt?.status === 'FAILED' ? 'FIXTURE_REJECTED' : 'DELIVERY_OR_RECEIPT_NOT_PROVEN' });
}
