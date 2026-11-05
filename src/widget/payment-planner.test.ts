import { describe, expect, it } from 'vitest';
import mockData from '../data/mock-payment-queue.json';
import type { IProviderPaymentQueueRow } from '../types/provider-payment-queue';
import { computePaymentPlan } from './payment-planner-compute';
import { parsePaymentPlannerParams } from './payment-planner-params';

const rows = mockData as IProviderPaymentQueueRow[];

describe('parsePaymentPlannerParams', () => {
  it('returns default config when params are undefined', () => {
    const config = parsePaymentPlannerParams(undefined);
    expect(config.description).toBe('Provider Payment Planner');
    expect(config.selectedCount).toBe(10);
    expect(config.rowLimit).toBe(10);
    expect(config.amountFormat).toBe('grouped');
    expect(config.currencyIds).toEqual([]);
  });

  it('clamps negative selectedCount to 0', () => {
    const config = parsePaymentPlannerParams({ selectedCount: -5 });
    expect(config.selectedCount).toBe(0);
  });
});

describe('computePaymentPlan', () => {
  it('sorts by payment_rank ASC then provider_bill_id ASC and selects first N', () => {
    const config = parsePaymentPlannerParams({ selectedCount: 6 });
    const plan = computePaymentPlan(rows, config);
    expect(plan.totalQueueCount).toBe(30);
    expect(plan.effectiveSelectedCount).toBe(6);
    expect(
      plan.queueItems
        .slice(0, 6)
        .map((item) => item.row.provider_bill_id),
    ).toEqual([77602, 77604, 77606, 77608, 77610, 77612]);
  });

  it('flags invalid/missing amounts and excludes them from currency totals', () => {
    const config = parsePaymentPlannerParams({ selectedCount: 20 });
    const plan = computePaymentPlan(rows, config);
    // Bills 77630 (null) and 77638 (-1200) are within the first 20 rows
    expect(plan.invalidSelectedCount).toBe(2);
    const invalidBill = plan.queueItems.find(
      (item) => item.row.provider_bill_id === 77630,
    );
    expect(invalidBill?.hasInvalidAmount).toBe(true);
  });

  it('applies filters before slicing first N bills and clamps effectiveSelectedCount', () => {
    const config = parsePaymentPlannerParams({
      providerId: 1770, // Inmarsat Global Ltd (4 bills in mock data)
      selectedCount: 10,
    });
    const plan = computePaymentPlan(rows, config);
    expect(plan.totalQueueCount).toBe(4);
    expect(plan.effectiveSelectedCount).toBe(4);
  });
});
