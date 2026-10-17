import { createHash } from 'node:crypto';
import { mkdir, open, readFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';

function fail(code) {
  const error = new Error(code);
  error.code = code;
  error.statusCode = 409;
  return error;
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

const validHandlerReceiptNumber = (value) => typeof value === 'string' && /^[1-9][0-9]{0,9}$/.test(value)
  && Number(value) <= 2147483647;

function canonical(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  throw fail('ARMADA_INTENT_INVALID');
}

function identity(intent) {
  const keys = ['company', 'period', 'terminalCode', 'clientEventId'];
  for (const key of keys) {
    if (typeof intent?.[key] !== 'string' || !intent[key].trim() || intent[key].length > 160) {
      throw fail('ARMADA_OPERATION_ID_REQUIRED');
    }
  }
  if (!Number.isSafeInteger(intent.actorUserId) || intent.actorUserId < 1) throw fail('ARMADA_ACTOR_REQUIRED');
  // Ownership stays in the fingerprint, not the operation key: another actor
  // cannot turn the same operation into a second transmission.
  return hash(canonical(Object.fromEntries(keys.map((key) => [key, intent[key]]))));
}

async function writeExclusive(path, value) {
  const handle = await open(path, 'wx', 0o600);
  try {
    await handle.writeFile(JSON.stringify(value), 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function readRecord(path) {
  try {
    const record = JSON.parse(await readFile(path, 'utf8'));
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      throw fail('ARMADA_JOURNAL_REVIEW_REQUIRED');
    }
    return record;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    // A partial file after a crash must never be treated as a missing attempt.
    throw fail('ARMADA_JOURNAL_REVIEW_REQUIRED');
  }
}

/**
 * Internal building block; not wired to a live route.
 * Requires a protected, persistent local directory on a single API host.
 * The caller must supply a server-validated immutable commercial snapshot;
 * never include credentials, PINs, or session tokens in that snapshot.
 */
export function createArmadaSubmissionJournal(directory) {
  if (!isAbsolute(directory || '')) throw fail('ARMADA_JOURNAL_ABSOLUTE_PATH_REQUIRED');

  async function inspect(intent) {
    const key = identity(intent);
    const fingerprint = hash(canonical(intent));
    const claim = await readRecord(join(directory, `${key}.attempt.json`));
    if (!claim) return { state: 'NOT_ATTEMPTED', key };
    if (![1, 2].includes(claim.version) || claim.key !== key || !claim.createdAt || !claim.fingerprint) {
      throw fail('ARMADA_JOURNAL_REVIEW_REQUIRED');
    }
    if (claim.fingerprint !== fingerprint) throw fail('ARMADA_OPERATION_CONTENT_CONFLICT');
    if (claim.version === 2 && (!claim.snapshot || claim.snapshotHash !== hash(canonical(claim.snapshot)))) {
      throw fail('ARMADA_JOURNAL_REVIEW_REQUIRED');
    }
    const outcome = await readRecord(join(directory, `${key}.verified.json`));
    if (!outcome) return { state: 'REVIEW_REQUIRED', key, attemptedAt: claim.createdAt };
    if (outcome.version !== 1 || outcome.key !== key || outcome.fingerprint !== fingerprint
      || !Number.isSafeInteger(outcome.documentId) || outcome.documentId < 1
      || typeof outcome.documentNumber !== 'string' || !outcome.documentNumber.trim()) {
      throw fail('ARMADA_JOURNAL_REVIEW_REQUIRED');
    }
    return { state: 'VERIFIED', key, documentId: outcome.documentId, documentNumber: outcome.documentNumber };
  }

  return {
    inspect,
    // Transport acknowledgement is distinct from verified commercial effects.
    async getSubmission(intent) {
      const current = await inspect(intent);
      const record = await readRecord(join(directory, `${current.key}.submitted.json`));
      if (!record) return null;
      if (current.state === 'NOT_ATTEMPTED' || record.version !== 1 || record.key !== current.key
        || record.fingerprint !== hash(canonical(intent)) || record.transportAccepted !== true
        || !Number.isInteger(record.httpStatus) || record.httpStatus < 200 || record.httpStatus >= 300
        || (Object.hasOwn(record, 'handlerReceiptNumber') && !validHandlerReceiptNumber(record.handlerReceiptNumber))
        || typeof record.acknowledgedAt !== 'string' || !Number.isFinite(Date.parse(record.acknowledgedAt))
        || new Date(record.acknowledgedAt).toISOString() !== record.acknowledgedAt) throw fail('ARMADA_JOURNAL_REVIEW_REQUIRED');
      return { state: 'SUBMITTED_PENDING_VERIFICATION', httpStatus: record.httpStatus, acknowledgedAt: record.acknowledgedAt,
        ...(record.handlerReceiptNumber ? { handlerReceiptNumber: record.handlerReceiptNumber } : {}) };
    },
    async recordSubmitted(intent, { httpStatus, handlerReceiptNumber }) {
      if (!Number.isInteger(httpStatus) || httpStatus < 200 || httpStatus >= 300) throw fail('ARMADA_HTTP_ACK_REQUIRED');
      if (handlerReceiptNumber !== undefined && !validHandlerReceiptNumber(handlerReceiptNumber)) throw fail('ARMADA_HANDLER_RECEIPT_INVALID');
      const current = await inspect(intent);
      if (current.state === 'NOT_ATTEMPTED') throw fail('ARMADA_ATTEMPT_REQUIRED');
      try {
        await writeExclusive(join(directory, `${current.key}.submitted.json`), { version: 1, key: current.key,
          fingerprint: hash(canonical(intent)), transportAccepted: true, httpStatus, acknowledgedAt: new Date().toISOString(),
          ...(handlerReceiptNumber !== undefined ? { handlerReceiptNumber } : {}) });
      } catch (error) {
        if (error.code !== 'EEXIST') throw fail('ARMADA_JOURNAL_WRITE_FAILED');
      }
      const recorded = await this.getSubmission(intent);
      if (handlerReceiptNumber !== undefined && recorded.handlerReceiptNumber !== handlerReceiptNumber) throw fail('ARMADA_HANDLER_RECEIPT_CONFLICT');
      return recorded;
    },
    // The original request owns the snapshot. Later requests cannot substitute
    // another actor, document, price, or UID, even after process restart.
    async loadPrepared(intent) {
      const key = identity(intent);
      const claim = await readRecord(join(directory, `${key}.attempt.json`));
      if (claim?.version === 2) {
        await inspect(intent);
        return claim.snapshot;
      }
      const record = await readRecord(join(directory, `${key}.prepared.json`));
      if (!record) return null;
      if (record.version !== 1 || record.key !== key || record.fingerprint !== hash(canonical(intent))) {
        throw fail('ARMADA_OPERATION_CONTENT_CONFLICT');
      }
      if (!record.snapshot || record.snapshotHash !== hash(canonical(record.snapshot))) {
        throw fail('ARMADA_JOURNAL_REVIEW_REQUIRED');
      }
      return record.snapshot;
    },
    async prepare(intent, snapshot) {
      const key = identity(intent);
      await mkdir(directory, { recursive: true, mode: 0o700 });
      try {
        await writeExclusive(join(directory, `${key}.prepared.json`), {
          version: 1, key, fingerprint: hash(canonical(intent)), snapshot,
          snapshotHash: hash(canonical(snapshot)), createdAt: new Date().toISOString(),
        });
      } catch (error) {
        if (error.code !== 'EEXIST') throw fail('ARMADA_JOURNAL_WRITE_FAILED');
      }
      return this.loadPrepared(intent);
    },
    // Daily sales persist the final snapshot and claim in one exclusive durable
    // record. Failed validation leaves no frozen draft. A crash after this write
    // remains ambiguous and must only reconcile, exactly like a v1 claim.
    async claimPrepared(intent, snapshot) {
      const key = identity(intent);
      await mkdir(directory, { recursive: true, mode: 0o700 });
      try {
        await writeExclusive(join(directory, `${key}.attempt.json`), {
          version: 2, key, fingerprint: hash(canonical(intent)), snapshot,
          snapshotHash: hash(canonical(snapshot)), createdAt: new Date().toISOString(),
        });
      } catch (error) {
        if (error.code !== 'EEXIST') throw fail('ARMADA_JOURNAL_WRITE_FAILED');
        return { ...await inspect(intent), maySend: false };
      }
      return { state: 'ATTEMPT_CLAIMED', key, maySend: true };
    },
    // Call immediately before the first network attempt, after all validation.
    // Only the process that receives maySend=true may initiate that attempt.
    async claim(intent) {
      const key = identity(intent);
      const fingerprint = hash(canonical(intent));
      await mkdir(directory, { recursive: true, mode: 0o700 });
      try {
        await writeExclusive(join(directory, `${key}.attempt.json`), {
          version: 1, key, fingerprint, createdAt: new Date().toISOString(),
        });
      } catch (error) {
        if (error.code !== 'EEXIST') throw fail('ARMADA_JOURNAL_WRITE_FAILED');
        return { ...await inspect(intent), maySend: false };
      }
      return { state: 'ATTEMPT_CLAIMED', key, maySend: true };
    },
    // Only call with a result verified against Vega header, lines and effects.
    // An HTTP OK, an Armada numeric response, or a stock delta is insufficient.
    async recordVerified(intent, { documentId, documentNumber }) {
      if (!Number.isSafeInteger(documentId) || documentId < 1
        || typeof documentNumber !== 'string' || !documentNumber.trim() || documentNumber.length > 80) {
        throw fail('ARMADA_VERIFIED_DOCUMENT_REQUIRED');
      }
      const current = await inspect(intent);
      if (current.state === 'NOT_ATTEMPTED') throw fail('ARMADA_ATTEMPT_REQUIRED');
      if (current.state === 'VERIFIED') {
        if (current.documentId !== documentId || current.documentNumber !== documentNumber) {
          throw fail('ARMADA_RESULT_CONFLICT');
        }
        return current;
      }
      try {
        await writeExclusive(join(directory, `${current.key}.verified.json`), {
          version: 1, key: current.key, fingerprint: hash(canonical(intent)),
          documentId, documentNumber, verifiedAt: new Date().toISOString(),
        });
      } catch (error) {
        if (error.code !== 'EEXIST') throw fail('ARMADA_JOURNAL_WRITE_FAILED');
      }
      const recorded = await inspect(intent);
      if (recorded.documentId !== documentId || recorded.documentNumber !== documentNumber) throw fail('ARMADA_RESULT_CONFLICT');
      return recorded;
    },
  };
}
