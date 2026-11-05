/**
 * A data value as a number for ARITHMETIC — sums, shares, bar lengths,
 * thresholds. A finite number stays as it is; a string counts when the whole
 * trimmed text is a number (a datasource may deliver an amount as text);
 * everything else is `null`, never `0`.
 *
 * `null`, `''` and booleans are `null` here — a bare `Number()` would turn the
 * first two into 0 and `true` into 1.
 */
export function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
