import { describe, expect, it } from 'vitest';
import mockData from '../data/mock-payment-queue.json';
import type { IProviderPaymentQueueRow } from '../types/provider-payment-queue';
import { computePaymentPlan } from './payment-planner-compute';
import { parsePaymentPlannerParams } from './payment-planner-params';

const rows = mockData as IProviderPaymentQueueRow[];

function baseRow(
  overrides: Partial<IProviderPaymentQueueRow>,
): IProviderPaymentQueueRow {
  return {
    ...rows[0],
    ...overrides,
  };
}

describe('parsePaymentPlannerParams', () => {
  it('returns default config when params are undefined', () => {
    const config = parsePaymentPlannerParams(undefined);
    expect(config.description).toBe('Provider Payment Planner');
    expect(config.selectedCount).toBe(10);
    expect(config.rowLimit).toBe(10);
    expect(config.amountFormat).toBe('grouped');
    expect(config.currencyIds).toEqual([]);
    expect(config.providerId).toBe('all');
    expect(config.billingCycleId).toBe('all');
    expect(config.showCustomerBills).toBe(true);
    expect(config.showProviderBreakdown).toBe(true);
    expect(config.showSummary).toBe(true);
  });

  it('clamps negative selectedCount to 0', () => {
    const config = parsePaymentPlannerParams({ selectedCount: -5 });
    expect(config.selectedCount).toBe(0);
  });

  it('reads description from title fallback and rowLimit from maxRows', () => {
    const config = parsePaymentPlannerParams({
      title: '  Queue Planner  ',
      maxRows: 50,
      amountFormat: 'plain',
    });
    expect(config.description).toBe('Queue Planner');
    expect(config.rowLimit).toBe(50);
    expect(config.amountFormat).toBe('plain');
  });

  it('deduplicates currencyIds and falls back on unknown enums', () => {
    const config = parsePaymentPlannerParams({
      currencyIds: [643, '840', 643, 'x', null],
      size: 'wide',
      amountFormat: 'scientific',
      rowLimit: 15,
    });
    expect(config.currencyIds).toEqual([643, 840]);
    expect(config.size).toBe('full');
    expect(config.amountFormat).toBe('grouped');
    expect(config.rowLimit).toBe(10);
  });

  it('tolerates null/invalid values without throwing', () => {
    const config = parsePaymentPlannerParams({
      description: null,
      subtitle: 12,
      selectedCount: '7.4',
      providerId: null,
      billingCycleId: 'nope',
      showSummary: 'yes',
      showCustomerBills: 0,
      showProviderBreakdown: undefined,
    });
    expect(config.description).toBe('Provider Payment Planner');
    expect(config.subtitle).toBe('');
    expect(config.selectedCount).toBe(7);
    expect(config.providerId).toBe('all');
    expect(config.billingCycleId).toBe('all');
    expect(config.showSummary).toBe(true);
    expect(config.showCustomerBills).toBe(true);
    expect(config.showProviderBreakdown).toBe(true);
  });
});

describe('computePaymentPlan', () => {
  it('sorts by payment_rank ASC then provider_bill_id ASC and selects first N', () => {
    const config = parsePaymentPlannerParams({ selectedCount: 6 });
    const plan = computePaymentPlan(rows, config);
    expect(plan.totalQueueCount).toBe(rows.length);
    expect(plan.effectiveSelectedCount).toBe(6);
    expect(
      plan.queueItems.slice(0, 6).map((item) => item.row.provider_bill_id),
    ).toEqual([77602, 77604, 77606, 77608, 77610, 77612]);
  });

  it('flags invalid/missing amounts and excludes them from currency totals', () => {
    const config = parsePaymentPlannerParams({ selectedCount: 20 });
    const plan = computePaymentPlan(rows, config);
    expect(plan.invalidSelectedCount).toBe(2);
    const invalidBill = plan.queueItems.find(
      (item) => item.row.provider_bill_id === 77630,
    );
    expect(invalidBill?.hasInvalidAmount).toBe(true);
    expect(invalidBill?.selected).toBe(true);
    expect(invalidBill?.providerAmount).toBeNull();

    const negative = plan.queueItems.find(
      (item) => item.row.provider_bill_id === 77638,
    );
    expect(negative?.hasInvalidAmount).toBe(true);
    expect(
      plan.providerBreakdown.some(
        (item) =>
          item.providerId === negative?.row.provider_id &&
          item.currencyId === negative.row.provider_currency_id &&
          item.totalAmount < 0,
      ),
    ).toBe(false);
  });

  it('applies filters before slicing first N bills and clamps effectiveSelectedCount', () => {
    const config = parsePaymentPlannerParams({
      providerId: 1770,
      selectedCount: 10,
    });
    const plan = computePaymentPlan(rows, config);
    expect(plan.totalQueueCount).toBe(4);
    expect(plan.effectiveSelectedCount).toBe(4);
  });

  it('never mixes currencies and keeps provider shares within a currency at 100%', () => {
    const config = parsePaymentPlannerParams({ selectedCount: 14 });
    const plan = computePaymentPlan(rows, config);

    expect(plan.currencyTotals.length).toBeGreaterThan(1);
    for (const currency of plan.currencyTotals) {
      const shares = plan.providerBreakdown.filter(
        (item) => item.currencyId === currency.currencyId,
      );
      const shareSum = shares.reduce((sum, item) => sum + item.sharePercent, 0);
      expect(shareSum).toBeCloseTo(100, 5);

      const amountSum = shares.reduce((sum, item) => sum + item.totalAmount, 0);
      expect(amountSum).toBeCloseTo(currency.totalAmount, 5);
      expect(shares.reduce((sum, item) => sum + item.billCount, 0)).toBe(
        currency.billCount,
      );
    }
  });

  it('respects selectedCountOverride from runtime state', () => {
    const config = parsePaymentPlannerParams({ selectedCount: 10 });
    const plan = computePaymentPlan(rows, config, {
      selectedCountOverride: 3,
    });
    expect(plan.effectiveSelectedCount).toBe(3);
    expect(plan.queueItems.filter((item) => item.selected)).toHaveLength(3);
  });

  it('marks customer bill presence only when bill no and amount are valid', () => {
    const config = parsePaymentPlannerParams({ selectedCount: 30 });
    const plan = computePaymentPlan(rows, config);
    const withoutCustomer = plan.queueItems.find(
      (item) => item.row.provider_bill_id === 77626,
    );
    expect(withoutCustomer?.hasCustomerBill).toBe(false);

    const withCustomer = plan.queueItems.find(
      (item) => item.row.provider_bill_id === 77602,
    );
    expect(withCustomer?.hasCustomerBill).toBe(true);
    expect(withCustomer?.customerAmount).toBe(240000);
  });

  it('places invalid ranks after valid ranks while keeping stable bill order', () => {
    const customRows: IProviderPaymentQueueRow[] = [
      baseRow({
        payment_rank: null,
        provider_bill_id: 90001,
        provider_total_due: 100,
      }),
      baseRow({
        payment_rank: 2,
        provider_bill_id: 90002,
        provider_total_due: 200,
      }),
      baseRow({
        payment_rank: 1,
        provider_bill_id: 90003,
        provider_total_due: 300,
      }),
    ];
    const config = parsePaymentPlannerParams({ selectedCount: 3 });
    const plan = computePaymentPlan(customRows, config);
    expect(plan.queueItems.map((item) => item.row.provider_bill_id)).toEqual([
      90003, 90002, 90001,
    ]);
  });

  it('limits visibleQueueItems by rowLimit', () => {
    const config = parsePaymentPlannerParams({
      selectedCount: 30,
      rowLimit: 10,
    });
    const plan = computePaymentPlan(rows, config);
    expect(plan.queueItems).toHaveLength(rows.length);
    expect(plan.visibleQueueItems).toHaveLength(10);
  });

  it('does not mutate the input rows array', () => {
    const copy = rows.map((row) => ({ ...row }));
    const before = JSON.stringify(copy);
    computePaymentPlan(copy, parsePaymentPlannerParams({ selectedCount: 5 }));
    expect(JSON.stringify(copy)).toBe(before);
  });

  it('selects nothing when selectedCount is 0', () => {
    const plan = computePaymentPlan(
      rows,
      parsePaymentPlannerParams({ selectedCount: 0 }),
    );
    expect(plan.effectiveSelectedCount).toBe(0);
    expect(plan.currencyTotals).toEqual([]);
    expect(plan.providerBreakdown).toEqual([]);
    expect(plan.selectedProviderCount).toBe(0);
    expect(plan.invalidSelectedCount).toBe(0);
  });

  it('filters by currency before taking first N', () => {
    const plan = computePaymentPlan(
      rows,
      parsePaymentPlannerParams({
        currencyIds: [643],
        selectedCount: 100,
      }),
    );
    expect(
      plan.queueItems.every((item) => item.row.provider_currency_id === 643),
    ).toBe(true);
    expect(plan.effectiveSelectedCount).toBe(plan.totalQueueCount);
  });

  it('keeps equal ranks ordered by provider_bill_id then original index', () => {
    const customRows: IProviderPaymentQueueRow[] = [
      baseRow({
        payment_rank: 1,
        provider_bill_id: 20,
        provider_total_due: 10,
        provider_id: 1,
      }),
      baseRow({
        payment_rank: 1,
        provider_bill_id: 10,
        provider_total_due: 20,
        provider_id: 2,
      }),
      baseRow({
        payment_rank: 1,
        provider_bill_id: 10,
        provider_total_due: 30,
        provider_id: 3,
      }),
    ];
    const plan = computePaymentPlan(
      customRows,
      parsePaymentPlannerParams({ selectedCount: 3 }),
    );
    expect(plan.queueItems.map((item) => item.row.provider_id)).toEqual([
      2, 3, 1,
    ]);
  });

  it('treats zero/empty/non-numeric amounts as invalid but keeps them selected', () => {
    const customRows: IProviderPaymentQueueRow[] = [
      baseRow({
        payment_rank: 1,
        provider_bill_id: 1,
        provider_total_due: 0,
        provider_currency_id: 1,
        provider_currency_name: 'AAA',
      }),
      baseRow({
        payment_rank: 1,
        provider_bill_id: 2,
        provider_total_due: '',
        provider_currency_id: 1,
        provider_currency_name: 'AAA',
      }),
      baseRow({
        payment_rank: 1,
        provider_bill_id: 3,
        provider_total_due: 'NaNish',
        provider_currency_id: 1,
        provider_currency_name: 'AAA',
      }),
      baseRow({
        payment_rank: 1,
        provider_bill_id: 4,
        provider_total_due: '1500',
        provider_currency_id: 1,
        provider_currency_name: 'AAA',
        provider_id: 42,
        provider_name: 'Valid Co',
      }),
    ];
    const plan = computePaymentPlan(
      customRows,
      parsePaymentPlannerParams({ selectedCount: 4 }),
    );
    expect(plan.invalidSelectedCount).toBe(3);
    expect(plan.currencyTotals).toEqual([
      {
        currencyId: 1,
        currencyName: 'AAA',
        totalAmount: 1500,
        billCount: 1,
        providerCount: 1,
      },
    ]);
    expect(plan.selectedProviderCount).toBe(1);
    expect(plan.providerBreakdown[0]?.sharePercent).toBe(100);
  });

  it('parses numeric string amounts from mock data as valid', () => {
    const plan = computePaymentPlan(
      rows,
      parsePaymentPlannerParams({ selectedCount: 30 }),
    );
    const strBill = plan.queueItems.find(
      (item) => item.row.provider_total_due === '148500',
    );
    expect(strBill?.hasInvalidAmount).toBe(false);
    expect(strBill?.providerAmount).toBe(148500);
  });
});
