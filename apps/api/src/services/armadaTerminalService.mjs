import { randomUUID } from 'node:crypto';
import { isAbsolute } from 'node:path';
import { createArmadaSubmissionJournal } from './armadaSubmissionJournal.mjs';
import { createArmadaSaleSubmission } from './armadaSaleSubmission.mjs';
import { createArmadaReceipt } from './armadaReceipt.mjs';
import { readArmadaProfile, queryArmadaBridge } from './armadaReadBridgeClient.mjs';
import { queryArmadaVega } from './armadaVegaClientService.mjs';
import { normalizeArmadaPilot, validatePilotReadings, compileArmadaPilot, getTerminalPilotRate, getPilotDocumentNumber, pilotError } from './armadaPilotCompiler.mjs';

function localDates(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`,
    localDateTime: `${parts.day}.${parts.month}.${parts.year} ${parts.hour}:${parts.minute}:${parts.second}` };
}

// One explicitly scoped pilot. General sale access is not enabled by this file.
export function createTerminalArmadaGateway({ loadProfile = readArmadaProfile, readBridge = queryArmadaBridge,
  readVega = queryArmadaVega, makeJournal = createArmadaSubmissionJournal, fetchImpl = fetch, uuid = randomUUID } = {}) {
  async function services(payload, actor, authorize) {
    const profile = await loadProfile();
    const intent = normalizeArmadaPilot(payload, actor, profile);
    if (!isAbsolute(profile.journalDirectory || '')) throw pilotError('ARMADA_JOURNAL_REQUIRED', 'Kalıcı Armada işlem günlüğü yapılandırılmadı.');
    await authorize(payload.terminalCode, actor.id);
    const journal = makeJournal(profile.journalDirectory);
    async function readings() {
      const bridge = await readBridge(profile, 'snapshot');
      const number = getPilotDocumentNumber(profile, bridge);
      const vega = await readVega({ operation: 'preflight', documentNumber: number });
      return { bridge, vega, number };
    }
    function requireEnabled() {
      if (profile.pilotEnabled !== true) throw pilotError('ARMADA_PILOT_DISABLED', 'Armada bağlantısının kurulumu ve ilk satış ön kontrolü tamamlanmadı.');
    }
    const sender = createArmadaSaleSubmission({ journal, fetchImpl, makeReceipt: createArmadaReceipt,
      prepareSale: async () => {
        requireEnabled();
        const { bridge, vega } = await readings();
        return compileArmadaPilot(intent, profile, bridge, vega, { uid: uuid(), ...localDates() });
      },
      validateBeforeSend: async (_intent, snapshot) => {
        requireEnabled();
        await authorize(payload.terminalCode, actor.id);
        if (snapshot.expected.date !== localDates().date) throw pilotError('ARMADA_PREPARED_DATE_CHANGED', 'Hazırlanan belge başka güne ait; gönderilmedi.');
        const { bridge, vega } = await readings();
        validatePilotReadings(profile, bridge, vega, snapshot.expected.documentNumber);
        if (snapshot.expected.armadaCounterNumber !== undefined
          && bridge.recordsets[0][0].nextNumber !== snapshot.expected.armadaCounterNumber) {
          throw pilotError('ARMADA_COUNTER_CHANGED', 'AHMET sayacı hazırlık sırasında değişti; gönderim yapılmadı.');
        }
        if (getTerminalPilotRate(_intent) !== snapshot.expected.exchangeRate) throw pilotError('ARMADA_RATE_CHANGED', 'Terminal fişinin kuru hazırlıktan sonra değişti; gönderilmedi.');
      },
      readResult: async (expected, { previouslyVerified = false } = {}) => {
        const result = await readBridge(profile, 'link', expected.uid);
        const links = result.recordsets?.[0];
        if (!Array.isArray(links) || links.length !== 1) return { state: 'REVIEW_REQUIRED', reason: 'ARMADA_UID_LINK_UNCONFIRMED' };
        const link = links[0];
        if (String(link.uid).toLowerCase() !== expected.uid || link.terminalId !== expected.armadaTerminalId
          || link.documentType !== 33 || Number(link.customerId) !== expected.customerId || link.currency !== expected.currency
          || link.armadaDocumentNumber !== expected.documentNumber || !Number.isSafeInteger(link.vegaDocumentId) || link.vegaDocumentId < 1
          || (expected.vegaDocumentId && expected.vegaDocumentId !== link.vegaDocumentId)) {
          return { state: 'REVIEW_REQUIRED', reason: 'ARMADA_UID_LINK_MISMATCH' };
        }
        const verified = await readVega({ operation: 'result', expected: { ...expected, vegaDocumentId: link.vegaDocumentId } });
        // The counter protects the first pilot acceptance. Later legitimate
        // AHMET sales may advance it; the saved Vega identity and effects still
        // have to verify on every status call.
        if (expected.armadaCounterNumber !== undefined && !previouslyVerified) {
          const current = await readBridge(profile, 'snapshot');
          if (current?.ok !== true || current.recordsets?.[0]?.length !== 1
            || current.recordsets[0][0].nextNumber !== expected.armadaCounterNumber) {
            return { state: 'REVIEW_REQUIRED', reason: 'ARMADA_COUNTER_CHANGED_AFTER_SEND', mayResend: false };
          }
        }
        return verified;
      },
    });
    return { profile, intent, journal, sender, readings };
  }
  return {
    async submit(payload, actor, authorize) {
      const api = await services(payload, actor, authorize);
      try { return await api.sender.submit(api.intent); }
      catch (error) {
        try {
          if ((await api.journal.inspect(api.intent)).state === 'NOT_ATTEMPTED') {
            error.submissionAttempted = false; error.commercialEffect = false;
          }
        } catch { /* A missing/corrupt journal never grants another attempt. */ }
        throw error;
      }
    },
    async status(payload, actor, authorize) {
      const api = await services(payload, actor, authorize);
      return api.sender.status(api.intent);
    },
    async readiness(payload, actor, authorize) {
      const api = await services(payload, actor, authorize);
      const existing = await api.journal.inspect(api.intent);
      if (existing.state !== 'NOT_ATTEMPTED') return { ready: false, code: 'ARMADA_PILOT_ALREADY_ATTEMPTED',
        message: 'Pilot gönderimi daha önce denenmiş. Yalnızca sonucu kontrol edilebilir.', submissionAttempted: true };
      const { bridge, vega } = await api.readings();
      const prepared = compileArmadaPilot(api.intent, api.profile, bridge, vega, { uid: uuid(), ...localDates() });
      return { ready: api.profile.pilotEnabled === true, code: api.profile.pilotEnabled ? 'ARMADA_PILOT_READY' : 'ARMADA_PILOT_DISABLED',
        message: api.profile.pilotEnabled ? 'Belirlenen tek pilot belge için ön kontrol tamamlandı.' : 'Ön kontrol tamamlandı; pilot gönderimi kapalı.',
        armadaTerminalId: api.profile.terminalId, documentNumber: prepared.expected.documentNumber,
        currency: 'USD', unitPrice: '8.47', quantity: '1', exchangeRate: prepared.expected.exchangeRate,
        exchangeRateSource: 'terminal', submissionAttempted: false };
    },
  };
}
const gateway = createTerminalArmadaGateway();
export const submitArmadaTerminalSale = (...args) => gateway.submit(...args);
export const getArmadaTerminalSaleStatus = (...args) => gateway.status(...args);
export const getArmadaTerminalSaleReadiness = (...args) => gateway.readiness(...args);
