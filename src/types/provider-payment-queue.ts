/**
 * Canonical schema for the `provider-payment-queue` DataSource in `intera-enigma-integration`.
 *
 * Domain notes from `Intera.Enigma.Api` (`ProviderPaymentQueueController.cs`):
 * 1. `payment_rank` is produced by `ROW_NUMBER() OVER (PARTITION BY q.provider_id ORDER BY q.provider_recv_date, q.provider_bill_id)`.
 *    Because numbering is partitioned per provider, a multi-provider result contains `payment_rank = 1, 2, 3...`
 *    for EACH provider. Sorting the queue therefore requires `(payment_rank ASC, provider_bill_id ASC)` with
 *    stable original order for any remaining ties.
 * 2. Filtering (`providerId`, `billingCycleId`, `currencyIds`) scopes the queue BEFORE taking the first
 *    `selectedCount` bills.
 * 3. Every valid provider invoice has `provider_total_due > 0`. If a row arrives with `null`, `0`, `< 0`, or
 *    an unparseable string in `provider_total_due`, it must be flagged (`hasInvalidAmount = true`), kept visible
 *    in the table with a warning indicator, and excluded from currency/provider sum aggregates.
 */

export interface IProviderPaymentQueueRow {
  payment_rank: number | string | null;
  provider_id: number;
  provider_code: string;
  provider_name: string;
  provider_bill_id: number;
  provider_bill_no: string;
  provider_bill_code: number;
  provider_recv_date: string;
  provider_total_due: number | string | null;
  provider_currency_id: number;
  provider_currency_name: string;
  billing_cycle_id: number;
  billing_cycle_name: string;
  customer_id: number | null;
  customer_code: string | null;
  customer_name: string | null;
  customer_inn: string | null;
  customer_bill_id: number | null;
  customer_bill_no: string | null;
  customer_bill_code: number | null;
  customer_total_due: number | string | null;
  customer_comments: string | null;
}
