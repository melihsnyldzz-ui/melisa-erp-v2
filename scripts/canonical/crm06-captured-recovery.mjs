// Bounded recovery ordering for an already captured TEST owner state.
// No OS/process/task/filesystem executor is imported. The sole ERP owner must
// supply the existing exact-handle stopper and supported startup/readback.
const names = new Set(['coreSupervisor', 'erpNative', 'erpApi', 'crmNativeOrder', 'crmCatalog', 'crmOrders', 'crmServer', 'hub']);
const refuse = () => { throw Error('CRM06_CAPTURED_RECOVERY_REJECTED'); };
const check = value => { if (!value) refuse(); };
export async function recoverCapturedTestOwner({plan, history = [], admit, persist, stop, absent, clear, start, readback}) {
  check(plan && /^[a-f0-9]{64}$/.test(plan.digest) && Array.isArray(plan.targets) && plan.targets.length === 8);
  check(new Set(plan.targets).size === 8 && plan.targets.every(n => names.has(n)));
  check([admit, persist, stop, absent, clear, start, readback].every(f => typeof f === 'function'));
  check(Array.isArray(history));
  const allowed = new Set(['PLAN', 'STOP_INTENT', 'STOPPED', 'CLEAR', 'START_INTENT', 'STARTED', 'COMPLETE', 'FAILED']);
  for (let i = 0; i < history.length; i++) {
    const e = history[i];
    check(e && e.sequence === i && e.digest === plan.digest && allowed.has(e.event));
    check(Object.keys(e).every(k => ['sequence', 'digest', 'event', 'target'].includes(k)));
    check(['STOP_INTENT', 'STOPPED'].includes(e.event) ? names.has(e.target) : e.target === undefined);
  }
  // A failed/ambiguous run cannot be silently retried or treated as complete.
  check(!history.some(e => e.event === 'FAILED'));
  const order = [{event:'PLAN'}, ...plan.targets.flatMap(target => [{event:'STOP_INTENT',target},{event:'STOPPED',target}]), ...['CLEAR','START_INTENT','STARTED','COMPLETE'].map(event=>({event}))];
  check(history.length <= order.length && history.every((e,i) => e.event === order[i].event && e.target === order[i].target));
  const events = history.slice();
  const save = async (event, target) => {
    const record = Object.freeze({sequence: events.length, digest: plan.digest, event, ...(target ? {target} : {})});
    // Persistence must finish before the following mutation; failure is fatal.
    check(await persist(record) === true);
    events.push(record);
  };
  if (events.some(e => e.event === 'COMPLETE')) {
    check(events.at(-1).event === 'COMPLETE' && await readback() === true);
    return {status: 'ALREADY_COMPLETE', stopped: 0, started: false};
  }
  check(await admit({replay: events.length > 0}) === true);
  if (!events.length) await save('PLAN');
  else check(events[0].event === 'PLAN');
  const started = events.some(e => e.event === 'STARTED');
  if (events.some(e => e.event === 'START_INTENT') && !started) refuse();
  let stopped = 0;
  try {
    if (!started) {
      for (const target of plan.targets) {
        const done = events.some(e => e.event === 'STOPPED' && e.target === target);
        const intent = events.some(e => e.event === 'STOP_INTENT' && e.target === target);
        if (done) { check(await absent(target) === true); continue; }
        if (!intent) await save('STOP_INTENT', target);
        // An interrupted intent can be completed from proven absence only.
        // A still-live target needs a new separately reviewed admission.
        if (intent) check(await absent(target) === true);
        else { check(['EXACT_OBSERVED_PROCESS_STOPPED', 'ALREADY_GONE'].includes(await stop(target))); check(await absent(target) === true); stopped++; }
        await save('STOPPED', target);
      }
      check(await clear() === true);
      if (!events.some(e=>e.event==='CLEAR')) await save('CLEAR');
      await save('START_INTENT');
      check(await start() === true);
      await save('STARTED');
    }
    check(await readback() === true);
    await save('COMPLETE');
    return {status: 'COMPLETE', stopped, started: !started};
  } catch (error) {
    // No automatic restore, action rollback, alternate stopper or retry.
    await save('FAILED');
    throw error;
  }
}
