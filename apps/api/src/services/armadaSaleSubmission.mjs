import { encodeArmadaForm } from './armadaDocumentCodec.mjs';

export const ARMADA_SALE_ENDPOINT = 'http://192.168.1.42:4532/BelgeGonder.aspx';
const review = (reason, snapshot) => ({ state: 'REVIEW_REQUIRED', reason, mayResend: false,
  submissionAttempted: true, commercialEffect: null, documentNumber: snapshot?.expected?.documentNumber });

function cancelBody(body) {
  // A broken peer (or stream implementation) must not hold the result open.
  try { Promise.resolve(body?.cancel()).catch(() => {}); } catch {}
}

export async function readArmadaHandlerReceiptNumber(response, signal) {
  let reader, finished = false, onAbort;
  const aborted = new Promise((_, reject) => {
    onAbort = () => reject(new Error('ARMADA_RESPONSE_ABORTED'));
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) onAbort();
  });
  aborted.catch(() => {});
  const wait = (promise) => Promise.race([promise, aborted]);
  try {
    let text;
    if (typeof response?.body?.getReader === 'function') {
      reader = response.body.getReader();
      const bytes = Buffer.alloc(64);
      let length = 0;
      while (true) {
        const { done, value } = await wait(reader.read());
        if (done) { finished = true; break; }
        if (!(value instanceof Uint8Array) || value.byteLength === 0 || length + value.byteLength > bytes.length) return null;
        bytes.set(value, length); length += value.byteLength;
      }
      text = bytes.subarray(0, length).toString('latin1');
    } else if (typeof response?.text === 'function') {
      // Injected response stand-ins may expose text only. Real fetch responses
      // always use the bounded stream path above, including malformed bodies.
      text = await wait(response.text());
    } else return null;
    if (typeof text !== 'string' || text.length > 64 || Buffer.byteLength(text, 'utf8') > 64
      || !/^[ \t\r\n]*[1-9][0-9]{0,9}[ \t\r\n]*$/.test(text)) return null;
    const number = text.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '');
    return Number(number) <= 2147483647 ? number : null;
  } catch {
    return null;
  } finally {
    signal?.removeEventListener('abort', onAbort);
    if (!finished) cancelBody(reader || response?.body);
    try { reader?.releaseLock(); } catch {}
  }
}

// Dependency injection keeps transport, crash and replay checks off live data.
// All dependencies are server-owned; no endpoint/template is accepted from HTTP.
export function createArmadaSaleSubmission({ journal, prepareSale, validateBeforeSend, readResult, fetchImpl = fetch, refreshUnattempted = false, makeReceipt, deferResult = false }) {
  async function submittedResult(intent, snapshot) {
    const acknowledgement = await journal.getSubmission(intent);
    return acknowledgement ? { ...acknowledgement, documentNumber: snapshot?.expected?.documentNumber,
      submissionAttempted: true, commercialEffect: null, mayResend: false }
      : review('ARMADA_SUBMISSION_UNCONFIRMED', snapshot);
  }
  async function reconcile(intent, snapshot) {
    try {
      const previous = await journal.inspect(intent);
      if (makeReceipt) {
        // A displayable receipt must use the durable, owned snapshot even on
        // the first submit response; never project the request or a cached DTO.
        snapshot = await journal.loadPrepared(intent);
        if (!snapshot) return review('PREPARED_SNAPSHOT_MISSING');
      }
      const expected = previous.state === 'VERIFIED'
        ? { ...snapshot.expected, vegaDocumentId: previous.documentId }
        : snapshot.expected;
      const result = await readResult(expected, { previouslyVerified: previous.state === 'VERIFIED' });
      if (result.state !== 'VERIFIED') return review(result.reason || 'VEGA_RESULT_UNCONFIRMED', snapshot);
      if (previous.state === 'VERIFIED' && (result.documentId !== previous.documentId
        || result.documentNumber !== previous.documentNumber)) return review('LINKED_DOCUMENT_CHANGED', snapshot);
      const receipt = makeReceipt ? makeReceipt({ intent, snapshot, result, checkedAt: new Date().toISOString() }) : undefined;
      if (previous.state !== 'VERIFIED') await journal.recordVerified(intent, result);
      const { receipt: ignoredReceipt, ...verified } = result;
      return { ...verified, ...(receipt ? { receipt } : {}), submissionAttempted: true, commercialEffect: true, mayResend: false };
    } catch (error) {
      return review(error?.code === 'ARMADA_RECEIPT_SNAPSHOT_INVALID' ? error.code : 'VEGA_RESULT_LOOKUP_FAILED', snapshot);
    }
  }
  return {
    async status(intent) {
      const attempt = await journal.inspect(intent);
      if (attempt.state === 'NOT_ATTEMPTED') return { state: 'NOT_ATTEMPTED', submissionAttempted: false,
        commercialEffect: false, mayResend: false };
      const snapshot = await journal.loadPrepared(intent);
      if (!snapshot) return review('PREPARED_SNAPSHOT_MISSING');
      return reconcile(intent, snapshot);
    },
    async submit(intent) {
      const previous = await journal.inspect(intent);
      if (deferResult) await journal.getSubmission(intent); // Orphan/corrupt acknowledgements cannot authorize a fresh send.
      let snapshot = refreshUnattempted && previous.state === 'NOT_ATTEMPTED' ? null : await journal.loadPrepared(intent);
      if (previous.state !== 'NOT_ATTEMPTED') {
        if (!snapshot) return review('PREPARED_SNAPSHOT_MISSING');
        if (deferResult || snapshot.sendMode === 'offline') return { ...await submittedResult(intent, snapshot), duplicate: true };
        return { ...await reconcile(intent, snapshot), duplicate: true };
      }
      if (!snapshot) {
        const prepared = await prepareSale(intent);
        snapshot = refreshUnattempted ? prepared : await journal.prepare(intent, prepared);
      }
      if (snapshot.endpoint !== ARMADA_SALE_ENDPOINT) throw Object.assign(new Error('Armada hedefi doğrulanamadı.'), { code: 'ARMADA_TARGET_INVALID', statusCode: 409 });
      // Perform schema encoding and final live preflight before recording any attempt.
      let body = encodeArmadaForm({ userId: snapshot.armadaUserId, document: snapshot.document });
      const validated = await validateBeforeSend(intent, snapshot);
      if (refreshUnattempted && validated) {
        snapshot = validated;
        if (snapshot.endpoint !== ARMADA_SALE_ENDPOINT) throw Object.assign(new Error('Armada hedefi doğrulanamadı.'), { code: 'ARMADA_TARGET_INVALID', statusCode: 409 });
        body = encodeArmadaForm({ userId: snapshot.armadaUserId, document: snapshot.document });
      }
      const claim = refreshUnattempted ? await journal.claimPrepared(intent, snapshot) : await journal.claim(intent);
      if (!claim.maySend) {
        const saved = await journal.loadPrepared(intent);
        return deferResult || saved?.sendMode === 'offline' ? { ...await submittedResult(intent, saved), duplicate: true } : reconcile(intent, saved);
      }
      const deferred = deferResult || snapshot.sendMode === 'offline';
      const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetchImpl(ARMADA_SALE_ENDPOINT, {
          method: 'POST', redirect: 'error', signal: controller.signal,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' }, body,
        });
        // Status codes and response numbers are not evidence of Vega completion.
        // The local handler also writes MESAJ errors with HTTP 200. Recognize
        // only a narrow numeric shape; keep its mixed-source ID opaque.
        if (deferred) {
          if (!response.ok || !Number.isInteger(response.status) || response.status < 200 || response.status >= 300) {
            cancelBody(response.body); return review('ARMADA_HTTP_UNCONFIRMED', snapshot);
          }
          const handlerReceiptNumber = await readArmadaHandlerReceiptNumber(response, controller.signal);
          if (!handlerReceiptNumber) return review('ARMADA_RESPONSE_UNCONFIRMED', snapshot);
          await journal.recordSubmitted(intent, { httpStatus: response.status, handlerReceiptNumber });
          return submittedResult(intent, snapshot);
        }
        await response.body?.cancel();
      } catch {
        // A timeout can occur after a completed sale. Reconcile; never retry POST.
        if (deferred) return review('ARMADA_TRANSPORT_UNCONFIRMED', snapshot);
      } finally {
        clearTimeout(timeout); controller.abort();
      }
      return reconcile(intent, snapshot);
    },
  };
}
