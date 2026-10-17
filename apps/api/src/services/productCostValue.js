// A missing opening cost is unknown; an explicitly stored zero is still zero.
export function nullableCost(value) {
  return value == null ? null : Number(value);
}
