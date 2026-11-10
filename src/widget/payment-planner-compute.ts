import { toFiniteNumber } from '../platform/to-finite-number';
import type { IProviderPaymentQueueRow } from '../types/provider-payment-queue';
import type { IPaymentPlannerConfig } from './payment-planner-params';

/** Processed invoice row in the sorted queue. */
export interface IQueueBillItem {
  /** 1-based position in the filtered & sorted queue. */
  queuePosition: number;
  row: IProviderPaymentQueueRow;
  /** Numeric `payment_rank` (`null` if missing/invalid). */
  rank: number | null;
  /** Numeric `provider_total_due` (`null` if missing or `<= 0`). */
  providerAmount: number | null;
  /** `true` when `provider_total_due` is `null`, `<= 0`, or non-numeric. */
  hasInvalidAmount: boolean;
  /** `true` when `queuePosition <= effectiveSelectedCount`. */
  selected: boolean;
  /** Numeric `customer_total_due` (`null` if absent or non-numeric). */
  customerAmount: number | null;
  /** `true` when both `customer_bill_no` (non-empty) and a valid `customerAmount` are present. */
  hasCustomerBill: boolean;
}

/** Aggregated payment sum for a single currency across selected valid bills. */
export interface ICurrencyTotal {
  currencyId: number;
  currencyName: string;
  /** Total amount of selected valid bills in this currency. */
  totalAmount: number;
  /** Number of selected valid bills in this currency. */
  billCount: number;
  /** Number of unique providers in this currency among selected valid bills. */
  providerCount: number;
}

/** Per-provider payment share within a specific currency across selected valid bills. */
export interface IProviderCurrencyBreakdownItem {
  providerId: number;
  providerName: string;
  currencyId: number;
  currencyName: string;
  billCount: number;
  totalAmount: number;
  /** Share (`0..100`) of this provider's `totalAmount` within `currencyTotal.totalAmount`. */
  sharePercent: number;
}

/** Interactive UI overrides inside the widget (slider override, quick filter overrides). */
export interface IPaymentPlannerRuntimeState {
  selectedCountOverride?: number;
}

export interface IPaymentPlanResult {
  /** Total bills in the filtered queue. */
  totalQueueCount: number;
  /** Clamped number of selected bills: `Math.min(Math.max(0, selectedCount), totalQueueCount)`. */
  effectiveSelectedCount: number;
  /** Number of unique providers across selected valid bills. */
  selectedProviderCount: number;
  /** Count of selected bills that have `hasInvalidAmount === true` (excluded from sums). */
  invalidSelectedCount: number;
  /** Totals per currency for selected valid bills (never summing across currencies). */
  currencyTotals: ICurrencyTotal[];
  /** Provider breakdown per currency for selected valid bills, sorted by `totalAmount` descending. */
  providerBreakdown: IProviderCurrencyBreakdownItem[];
  /** Full filtered and sorted queue. */
  queueItems: IQueueBillItem[];
  /** Queue sliced to `config.rowLimit` for table display. */
  visibleQueueItems: IQueueBillItem[];
}

interface IIndexedRow {
  row: IProviderPaymentQueueRow;
  originalIndex: number;
  rank: number | null;
  providerAmount: number | null;
  hasInvalidAmount: boolean;
  customerAmount: number | null;
  hasCustomerBill: boolean;
}

function matchesFilters(
  row: IProviderPaymentQueueRow,
  config: IPaymentPlannerConfig,
): boolean {
  if (config.providerId !== 'all' && row.provider_id !== config.providerId) {
    return false;
  }
  if (
    config.billingCycleId !== 'all' &&
    row.billing_cycle_id !== config.billingCycleId
  ) {
    return false;
  }
  if (
    config.currencyIds.length > 0 &&
    !config.currencyIds.includes(row.provider_currency_id)
  ) {
    return false;
  }
  return true;
}

function compareQueueRows(a: IIndexedRow, b: IIndexedRow): number {
  const aHasRank = a.rank !== null;
  const bHasRank = b.rank !== null;
  if (aHasRank !== bHasRank) {
    return aHasRank ? -1 : 1;
  }
  if (a.rank !== null && b.rank !== null && a.rank !== b.rank) {
    return a.rank - b.rank;
  }
  if (a.row.provider_bill_id !== b.row.provider_bill_id) {
    return a.row.provider_bill_id - b.row.provider_bill_id;
  }
  return a.originalIndex - b.originalIndex;
}

/**
 * Pure computation of the provider payment plan from `provider-payment-queue` rows.
 *
 * Must NOT depend on React or DOM APIs.
 *
 * Key domain rules:
 * 1. Scope filters (`providerId`, `billingCycleId`, `currencyIds`) are applied BEFORE sorting and selecting
 *    the first `selectedCount` bills.
 * 2. Sorting order:
 *    - `payment_rank` ascending (valid finite ranks first; missing/invalid ranks last),
 *    - `provider_bill_id` ascending as tie-breaker (since Enigma partitions `payment_rank` by `provider_id`),
 *    - original array index (stable order).
 * 3. Selection: `effectiveSelectedCount = Math.min(Math.max(0, selectedCount), filteredQueue.length)`.
 *    The first `effectiveSelectedCount` items in the sorted queue have `selected = true`.
 * 4. Invalid amounts: if `toFiniteNumber(row.provider_total_due)` is `null` or `<= 0`, mark
 *    `hasInvalidAmount = true`. Never treat invalid amounts as `0` in aggregates — exclude them from
 *    `currencyTotals` and `providerBreakdown` and increment `invalidSelectedCount` when selected.
 * 5. Never sum amounts across different currencies.
 */
export function computePaymentPlan(
  rows: readonly IProviderPaymentQueueRow[],
  config: IPaymentPlannerConfig,
  runtimeState?: IPaymentPlannerRuntimeState,
): IPaymentPlanResult {
  const requestedCount =
    runtimeState?.selectedCountOverride !== undefined
      ? runtimeState.selectedCountOverride
      : config.selectedCount;

  const prepared: IIndexedRow[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (!matchesFilters(row, config)) {
      continue;
    }

    const rawAmount = toFiniteNumber(row.provider_total_due);
    const hasInvalidAmount = rawAmount === null || rawAmount <= 0;
    const customerAmount = toFiniteNumber(row.customer_total_due);
    const customerBillNo = row.customer_bill_no?.trim() ?? '';

    prepared.push({
      row,
      originalIndex: i,
      rank: toFiniteNumber(row.payment_rank),
      providerAmount: hasInvalidAmount ? null : rawAmount,
      hasInvalidAmount,
      customerAmount,
      hasCustomerBill: customerBillNo.length > 0 && customerAmount !== null,
    });
  }

  prepared.sort(compareQueueRows);

  const totalQueueCount = prepared.length;
  const effectiveSelectedCount = Math.min(
    Math.max(0, requestedCount),
    totalQueueCount,
  );

  const queueItems: IQueueBillItem[] = prepared.map((item, index) => ({
    queuePosition: index + 1,
    row: item.row,
    rank: item.rank,
    providerAmount: item.providerAmount,
    hasInvalidAmount: item.hasInvalidAmount,
    selected: index < effectiveSelectedCount,
    customerAmount: item.customerAmount,
    hasCustomerBill: item.hasCustomerBill,
  }));

  const selectedItems = queueItems.filter((item) => item.selected);
  const selectedValid = selectedItems.filter((item) => !item.hasInvalidAmount);
  const invalidSelectedCount = selectedItems.length - selectedValid.length;

  const providerIds = new Set<number>();
  for (const item of selectedValid) {
    providerIds.add(item.row.provider_id);
  }

  const currencyAcc = new Map<
    number,
    {
      currencyId: number;
      currencyName: string;
      totalAmount: number;
      billCount: number;
      providers: Set<number>;
    }
  >();
  const breakdownAcc = new Map<
    string,
    {
      providerId: number;
      providerName: string;
      currencyId: number;
      currencyName: string;
      billCount: number;
      totalAmount: number;
    }
  >();

  for (const item of selectedValid) {
    const amount = item.providerAmount;
    if (amount === null) {
      continue;
    }

    const currencyId = item.row.provider_currency_id;
    let currency = currencyAcc.get(currencyId);
    if (!currency) {
      currency = {
        currencyId,
        currencyName: item.row.provider_currency_name,
        totalAmount: 0,
        billCount: 0,
        providers: new Set<number>(),
      };
      currencyAcc.set(currencyId, currency);
    }
    currency.totalAmount += amount;
    currency.billCount += 1;
    currency.providers.add(item.row.provider_id);

    const breakdownKey = `${item.row.provider_id}:${currencyId}`;
    let breakdown = breakdownAcc.get(breakdownKey);
    if (!breakdown) {
      breakdown = {
        providerId: item.row.provider_id,
        providerName: item.row.provider_name,
        currencyId,
        currencyName: item.row.provider_currency_name,
        billCount: 0,
        totalAmount: 0,
      };
      breakdownAcc.set(breakdownKey, breakdown);
    }
    breakdown.billCount += 1;
    breakdown.totalAmount += amount;
  }

  const currencyTotals: ICurrencyTotal[] = Array.from(currencyAcc.values())
    .map((entry) => ({
      currencyId: entry.currencyId,
      currencyName: entry.currencyName,
      totalAmount: entry.totalAmount,
      billCount: entry.billCount,
      providerCount: entry.providers.size,
    }))
    .sort((a, b) => a.currencyName.localeCompare(b.currencyName));

  const currencyTotalById = new Map(
    currencyTotals.map((item) => [item.currencyId, item.totalAmount]),
  );

  const providerBreakdown: IProviderCurrencyBreakdownItem[] = Array.from(
    breakdownAcc.values(),
  )
    .map((entry) => {
      const currencyTotal = currencyTotalById.get(entry.currencyId) ?? 0;
      return {
        ...entry,
        sharePercent:
          currencyTotal > 0 ? (entry.totalAmount / currencyTotal) * 100 : 0,
      };
    })
    .sort((a, b) => {
      if (b.totalAmount !== a.totalAmount) {
        return b.totalAmount - a.totalAmount;
      }
      return a.providerName.localeCompare(b.providerName);
    });

  return {
    totalQueueCount,
    effectiveSelectedCount,
    selectedProviderCount: providerIds.size,
    invalidSelectedCount,
    currencyTotals,
    providerBreakdown,
    queueItems,
    visibleQueueItems: queueItems.slice(0, config.rowLimit),
  };
}
