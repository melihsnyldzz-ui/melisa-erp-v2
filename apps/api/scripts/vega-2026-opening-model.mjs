import { decimal, textDecimal } from './vega-native-migration-adapters.mjs';

export const patchId = 'devir2026-20260917-01';
export const patchPrefix = 'VEGA2026-OPENING-ALIGNMENT/';
export const openingDate = '2026-01-01';
export const adjustmentLabel = 'Vega 2026 Devir Düzeltmesi';

// A document type alone is not proof of a January opening. Later dated
// debit/credit slips and type 90 operating documents must not enter this anchor.
export const is2026Opening = row => row.TARIH?.slice(0, 10) === openingDate
  && [103, 104].includes(Number(row.IZAHAT));

export function compareOpening(expected, movements, openingKeys) {
  let historical = 0n, alreadyEffectiveOpening = 0n, previousCorrection = 0n;
  for (const m of movements) {
    if (m.affects_balance === false || m.affects_balance === 0) continue;
    const effect = decimal(m.effect);
    if (m.source_record_key?.startsWith(patchPrefix)) previousCorrection += effect;
    else if (openingKeys.has(m.source_record_key)) alreadyEffectiveOpening += effect;
    else if (m.document_date < openingDate) historical += effect;
  }
  const before = historical + alreadyEffectiveOpening;
  const desired = decimal(expected);
  return Object.fromEntries(Object.entries({ historical, alreadyEffectiveOpening,
    previousCorrection, before, expected: desired, requiredCorrection: desired - before,
    after: before + previousCorrection, remaining: desired - before - previousCorrection,
  }).map(([k, v]) => [k, textDecimal(v)]));
}
