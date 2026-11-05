/**
 * Defensive readers for widget `params`. Core validates params on save; these
 * keep an older or hand-edited layout rendering instead of failing, so each
 * falls back rather than throws.
 */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A string param as written; anything else is `''`. */
export function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** One of `allowed`, else `fallback` — an unknown value never reaches a renderer. */
export function readEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === 'string' &&
    (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}
