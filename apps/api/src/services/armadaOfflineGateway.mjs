import { randomUUID } from 'node:crypto';
import { createArmadaSubmissionJournal } from './armadaSubmissionJournal.mjs';
import { createArmadaSaleSubmission } from './armadaSaleSubmission.mjs';
import { readArmadaProfile, queryArmadaBridge } from './armadaReadBridgeClient.mjs';
import { queryArmadaVega } from './armadaVegaClientService.mjs';
import { normalizeDailySale } from './armadaDailyCompiler.mjs';
import { compileOfflineSale } from './armadaOfflineCompiler.mjs';
import { createArmadaReceipt } from './armadaReceipt.mjs';
import { pilotError } from './armadaPilotCompiler.mjs';

function dates() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, localDateTime: `${parts.day}.${parts.month}.${parts.year} ${parts.hour}:${parts.minute}:${parts.second}` };
}

export function createOfflineGateway({ loadProfile = readArmadaProfile, makeJournal = createArmadaSubmissionJournal,
  fetchImpl = fetch, uuid = randomUUID, readBridge = queryArmadaBridge, readVega = queryArmadaVega } = {}) {
  async function context(payload, actor, authorize) {
    const profile = await loadProfile(), intent = normalizeDailySale(payload, actor, profile);
    const journal = makeJournal(profile.dailyJournalDirectory), operator = await authorize(intent.terminalCode, actor.id);
    const enabled = () => { if (profile.dailyEnabled !== true) throw pilotError('ARMADA_DAILY_DISABLED', 'Terminal satış gönderimi kapalı. Fiş cihazda korunuyor.'); };
    const sender = createArmadaSaleSubmission({ journal, fetchImpl, refreshUnattempted: true, deferResult: true, makeReceipt: createArmadaReceipt,
      prepareSale: async () => { enabled(); return compileOfflineSale(intent, payload, profile, operator, { uid: uuid(), ...dates() }); },
      validateBeforeSend: async (_intent, snapshot) => { enabled(); return snapshot; },
      // This callback is called by explicit status only, never by offline submit.
      readResult: async (expected) => {
        const response = await readBridge(profile, 'link', expected.uid), rows = response.recordsets?.[0], link = rows?.[0];
        if (rows?.length !== 1 || String(link.uid).toLowerCase() !== expected.uid || link.terminalId !== expected.armadaTerminalId
          || link.documentType !== 33 || Number(link.customerId) !== expected.customerId || link.currency !== expected.currency
          || link.armadaDocumentNumber !== expected.documentNumber || !Number.isSafeInteger(link.vegaDocumentId) || link.vegaDocumentId < 1
          || (expected.vegaDocumentId && expected.vegaDocumentId !== link.vegaDocumentId)) return { state: 'REVIEW_REQUIRED', reason: 'ARMADA_UID_LINK_UNCONFIRMED' };
        return readVega({ operation: 'result', expected: { ...expected, vegaDocumentId: link.vegaDocumentId } });
      } });
    return { intent, journal, sender };
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
    async readiness() { throw pilotError('ARMADA_OFFLINE_NO_PREFLIGHT', 'Fiş indirilmiş kayıtlarla gönderilir; Vega ön kontrolü gerekmez.'); },
  };
}
