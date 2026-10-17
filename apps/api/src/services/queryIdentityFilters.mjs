// Optional filters may be absent, but a supplied malformed identity must never
// turn into an unfiltered list. Keep IDs exact within the API's numeric range.
export function parseOptionalQueryId(value, field, code = 'QUERY_ID_INVALID') {
  if (value === undefined) return null;
  const validShape = typeof value === 'number'
    || (typeof value === 'string' && /^[1-9]\d*$/.test(value));
  const id = validShape ? Number(value) : NaN;
  if (!Number.isSafeInteger(id) || id < 1) {
    const error = new Error(`${field} must be a positive safe integer`);
    error.code = code;
    error.statusCode = 400;
    throw error;
  }
  return id;
}
