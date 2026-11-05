/**
 * Standard INTERA dashboard widget width fractions and data collection envelope.
 *
 * Size mapping to dashboard grid slots:
 * - `full`    (XL — 4/4 row width, ~880px)
 * - `half`    (L  — 3/4 or 1/2 width, ~600px)
 * - `third`   (M  — 1/3 row width, ~400px)
 * - `quarter` (S  — 1/4 row width, ~240px)
 */

export const WIDGET_SIZES = ['full', 'half', 'third', 'quarter'] as const;
export type TWidgetSize = (typeof WIDGET_SIZES)[number];

export const WIDGET_ROW_LIMITS = [10, 25, 50, 100] as const;
export type TWidgetRowLimit = (typeof WIDGET_ROW_LIMITS)[number];

/**
 * Envelope returned by `useCollectionData` in INTERA Core.
 *
 * Render invariant:
 * - Initial loading (`loading && !loaded`): show skeleton / loading state, do not render empty state.
 * - Background refresh (`loading && loaded`): keep the current view mounted so user search/selection is preserved!
 * - Error (`error !== null && !loaded`): show error placeholder.
 * - Stale (`stale === true`): render data with `<FreshnessMark source="rows" stale={true} />`.
 */
export interface ICollectionDataResult<TRow = Record<string, unknown>> {
  readonly items: readonly TRow[];
  readonly loading: boolean;
  readonly loaded: boolean;
  readonly error: string | null;
  readonly stale: boolean;
  readonly lastSuccessAt: string | null;
}
