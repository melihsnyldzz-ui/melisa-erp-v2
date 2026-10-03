import { randomUUID } from 'node:crypto';
import { createArmadaSubmissionJournal } from './armadaSubmissionJournal.mjs';
import { createArmadaSaleSubmission } from './armadaSaleSubmission.mjs';
import { readArmadaProfile, queryArmadaBridge } from './armadaReadBridgeClient.mjs';
import { queryArmadaVega } from './armadaVegaClientService.mjs';
import { createTerminalArmadaGateway } from './armadaTerminalService.mjs';
import { normalizeDailySale, compileDailySale, dailyDocumentNumber } from './armadaDailyCompiler.mjs';
import { pilotError } from './armadaPilotCompiler.mjs';
import { verifyTerminalRateSnapshot } from './terminalRateSnapshot.mjs';
import { createArmadaReceipt } from './armadaReceipt.mjs';
import { createOfflineGateway } from './armadaOfflineGateway.mjs';

function dates() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, localDateTime: `${p.day}.${p.month}.${p.year} ${p.hour}:${p.minute}:${p.second}` };
}
export function createDailyGateway({ loadProfile = readArmadaProfile, readBridge = queryArmadaBridge, readVega = queryArmadaVega,
  makeJournal = createArmadaSubmissionJournal, fetchImpl = fetch, uuid = randomUUID } = {}) {
  async function context(payload, actor, authorize) {
    const profile = await loadProfile(), intent = normalizeDailySale(payload, actor, profile);
    const journal = makeJournal(profile.dailyJournalDirectory);
    const operator = await authorize(intent.terminalCode, actor.id);
    const enabled = () => { if (profile.dailyEnabled !== true) throw pilotError('ARMADA_DAILY_DISABLED', 'Terminal satış gönderimi kapalı. Fiş cihazda korunuyor.'); };
    async function prepare(id, dateInfo) {
      const trusted = verifyTerminalRateSnapshot({ snapshot: payload.rateSnapshot, profile, currency: intent.currency,
        exchangeRate: intent.exchangeRate, company: intent.company, period: intent.period });
      const bridge = await readBridge(profile, 'snapshot');
      const vega = await readVega({ operation: 'daily-preflight', intent, documentNumber: dailyDocumentNumber(intent) });
      vega.rates = trusted.rates;
      return { ...compileDailySale(intent, profile, bridge, vega, operator, { uid: id, ...dateInfo }), rateSnapshot: trusted.snapshot };
    }
    const sender = createArmadaSaleSubmission({ journal, fetchImpl, refreshUnattempted: true, makeReceipt: createArmadaReceipt,
      prepareSale: async () => { enabled(); return prepare(uuid(), dates()); },
      validateBeforeSend: async (_, snapshot) => {
        enabled();
        const freshOperator = await authorize(intent.terminalCode, actor.id);
        if (JSON.stringify(freshOperator) !== JSON.stringify(operator)) throw pilotError('ARMADA_AUTHORITY_CHANGED', 'Personel yetkisi değişti.');
        if (snapshot.expected.date !== dates().date) throw pilotError('ARMADA_PREPARED_DATE_CHANGED', 'Fiş başka gün hazırlanmış; inceleme gerekiyor.');
        const fresh = await prepare(snapshot.expected.uid, { date: snapshot.expected.date, localDateTime: snapshot.document.header.KayitTarihi });
        if (JSON.stringify(fresh.document) !== JSON.stringify(snapshot.document) || JSON.stringify(fresh.expected) !== JSON.stringify(snapshot.expected)) throw pilotError('ARMADA_PREPARED_CHANGED', 'Fişin kaynak bilgileri değişti; gönderilmedi. Fişi kontrol edip tekrar deneyin.');
        return fresh;
      },
      readResult: async (expected) => {
        const result = await readBridge(profile, 'link', expected.uid), rows = result.recordsets?.[0];
        const link = rows?.[0];
        if (rows?.length !== 1 || String(link.uid).toLowerCase() !== expected.uid || link.terminalId !== expected.armadaTerminalId
          || link.documentType !== 33 || Number(link.customerId) !== expected.customerId || link.currency !== expected.currency
          || link.armadaDocumentNumber !== expected.documentNumber || !Number.isSafeInteger(link.vegaDocumentId) || link.vegaDocumentId < 1
          || (expected.vegaDocumentId && expected.vegaDocumentId !== link.vegaDocumentId)) return { state: 'REVIEW_REQUIRED', reason: 'ARMADA_UID_LINK_UNCONFIRMED' };
        return readVega({ operation: 'result', expected: { ...expected, vegaDocumentId: link.vegaDocumentId } });
      } });
    return { profile, intent, journal, sender, prepare };
  }
  return {
    async submit(payload, actor, authorize) {
      const c = await context(payload, actor, authorize);
      try { return await c.sender.submit(c.intent); }
      catch (error) {
        try { if ((await c.journal.inspect(c.intent)).state === 'NOT_ATTEMPTED') { error.submissionAttempted = false; error.commercialEffect = false; } } catch {}
        throw error;
      }
    },
    async status(payload, actor, authorize) { const c = await context(payload, actor, authorize); return c.sender.status(c.intent); },
    async readiness(payload, actor, authorize) {
      const c = await context(payload, actor, authorize);
      if ((await c.journal.inspect(c.intent)).state !== 'NOT_ATTEMPTED') return { ready: false, code: 'ARMADA_ALREADY_ATTEMPTED', message: 'Bu fiş için yalnız sonucu kontrol edin.', submissionAttempted: true };
      const snapshot = await c.prepare(uuid(), dates());
      return { ready: c.profile.dailyEnabled === true, code: c.profile.dailyEnabled ? 'ARMADA_DAILY_READY' : 'ARMADA_DAILY_DISABLED',
        message: c.profile.dailyEnabled ? (snapshot.warnings.length ? 'Stok yetersiz; işletme sahibi kararıyla gönderime izin var.' : 'Vega gönderim ön kontrolü tamamlandı.') : 'Terminal satış gönderimi kapalı.',
        documentNumber: snapshot.expected.documentNumber, currency: c.intent.currency, exchangeRate: c.intent.exchangeRate,
        lines: c.intent.items.length, warnings: snapshot.warnings, submissionAttempted: false };
    },
  };
}
export function createArmadaSaleDispatcher({ loadProfile = readArmadaProfile, makeJournal = createArmadaSubmissionJournal,
  daily = createDailyGateway(), pilot = createTerminalArmadaGateway(), offline = createOfflineGateway() } = {}) {
  return async function dispatch(method, payload, actor, authorize) {
    const profile = await loadProfile();
    // Keep the old, immutable pilot journal reachable after installing this version.
    if (profile.legacyEventIds?.includes(payload.clientEventId)) return pilot[method](payload, actor, authorize);
    const intent = normalizeDailySale(payload, actor, profile), journal = makeJournal(profile.dailyJournalDirectory);
    const previous = await journal.inspect(intent);
    await journal.getSubmission(intent);
    if (previous.state !== 'NOT_ATTEMPTED') {
      const snapshot = await journal.loadPrepared(intent);
      return (snapshot?.sendMode === 'offline' ? offline : daily)[method](payload, actor, authorize);
    }
    // A missing proof must fail in the offline compiler, never downgrade a new
    // offline request to the legacy source-querying path.
    if (payload.sourceContract === 'armada-offline-v1' || Object.hasOwn(payload, 'offlineContext')) {
      return offline[method](payload, actor, authorize);
    }
    return daily[method](payload, actor, authorize);
  };
}
const dispatch = createArmadaSaleDispatcher();
export const submitArmadaTerminalSale = (...args) => dispatch('submit', ...args);
export const getArmadaTerminalSaleStatus = (...args) => dispatch('status', ...args);
export const getArmadaTerminalSaleReadiness = (...args) => dispatch('readiness', ...args);
