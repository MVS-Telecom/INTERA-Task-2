import {
  useEffect,
  useMemo,
  useState,
  type ReactElement,
} from 'react';
import { FreshnessMark } from '../platform/freshness-mark';
import { formatValue } from '../platform/value-format';
import { WidgetHeader } from '../platform/widget-card';
import { widgetCardClass } from '../platform/widget-card-class';
import type { ICollectionDataResult, TWidgetSize } from '../platform/widget-types';
import type { IProviderPaymentQueueRow } from '../types/provider-payment-queue';
import {
  computePaymentPlan,
  type ICurrencyTotal,
  type IPaymentPlanResult,
  type IProviderCurrencyBreakdownItem,
  type IQueueBillItem,
} from './payment-planner-compute';
import {
  parsePaymentPlannerParams,
  type IPaymentPlannerConfig,
  type TAmountFormat,
} from './payment-planner-params';
import './payment-planner.css';

const CLASS = 'dash-payment-planner';

const CHART_COLORS = [
  'var(--chart-blue)',
  'var(--chart-aqua)',
  'var(--chart-violet)',
  'var(--chart-orange)',
  'var(--chart-yellow)',
  'var(--chart-magenta)',
  'var(--chart-green)',
  'var(--chart-red)',
] as const;

const CURRENCY_SYMBOLS: Record<string, string> = {
  RUB: '₽',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

const QUARTER_CURRENCY_LIMIT = 2;

export interface IPaymentPlannerWidgetProps {
  /** Raw widget configuration from dashboard YAML / parameter editor. */
  params?: Record<string, unknown>;
  /** Collection data envelope from INTERA runtime (`useCollectionData`). */
  data: ICollectionDataResult<IProviderPaymentQueueRow>;
  /** Optional explicit size override from the host container. */
  size?: TWidgetSize;
}

function currencySymbol(name: string): string {
  return CURRENCY_SYMBOLS[name] ?? name;
}

function formatAmount(value: number, amountFormat: TAmountFormat): string {
  if (amountFormat === 'plain') {
    return value.toFixed(2);
  }
  return formatValue(value, 'decimal');
}

function formatMoney(
  value: number,
  currencyName: string,
  amountFormat: TAmountFormat,
): string {
  return `${formatAmount(value, amountFormat)} ${currencySymbol(currencyName)}`;
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

function formatDate(value: string): string {
  return formatValue(value, 'date');
}

function pluralRu(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) {
    return one;
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return few;
  }
  return many;
}

function billsLabel(count: number): string {
  return `${count} ${pluralRu(count, 'счёт', 'счёта', 'счетов')}`;
}

function selectionPercent(selected: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.round((selected / total) * 100);
}

function oldestSelectedDate(items: readonly IQueueBillItem[]): string | null {
  let oldest: string | null = null;
  for (const item of items) {
    if (!item.selected) {
      continue;
    }
    const date = item.row.provider_recv_date;
    if (!oldest || date < oldest) {
      oldest = date;
    }
  }
  return oldest;
}

function sortCurrencyTotals(
  totals: readonly ICurrencyTotal[],
): ICurrencyTotal[] {
  return [...totals].sort((a, b) => {
    if (b.totalAmount !== a.totalAmount) {
      return b.totalAmount - a.totalAmount;
    }
    return a.currencyName.localeCompare(b.currencyName);
  });
}

function titleForSize(
  config: IPaymentPlannerConfig,
  size: TWidgetSize,
): string {
  if (config.description !== 'Provider Payment Planner') {
    return config.description;
  }
  if (size === 'half') {
    return 'План платежей';
  }
  if (size === 'third') {
    return 'К оплате';
  }
  if (size === 'quarter') {
    return 'Платежи';
  }
  return config.description;
}

function subtitleForSize(
  config: IPaymentPlannerConfig,
  size: TWidgetSize,
  currencyCount: number,
): string | undefined {
  if (size !== 'full') {
    return undefined;
  }
  if (config.subtitle) {
    return config.subtitle;
  }
  return `Очередь к оплате по payment_rank · ${currencyCount} ${pluralRu(
    currencyCount,
    'валюта',
    'валюты',
    'валют',
  )}`;
}

function collectFilterOptions(rows: readonly IProviderPaymentQueueRow[]): {
  providers: Array<{ id: number; name: string }>;
  billingCycles: Array<{ id: number; name: string }>;
  currencies: Array<{ id: number; name: string }>;
} {
  const providers = new Map<number, string>();
  const billingCycles = new Map<number, string>();
  const currencies = new Map<number, string>();
  for (const row of rows) {
    providers.set(row.provider_id, row.provider_name);
    billingCycles.set(row.billing_cycle_id, row.billing_cycle_name);
    currencies.set(row.provider_currency_id, row.provider_currency_name);
  }
  return {
    providers: Array.from(providers, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
    billingCycles: Array.from(billingCycles, ([id, name]) => ({ id, name })).sort(
      (a, b) => a.name.localeCompare(b.name),
    ),
    currencies: Array.from(currencies, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
  };
}

function toggleCurrencyFilter(
  currencyId: number,
  currentIds: number[],
  allIds: number[],
): number[] {
  const active = currentIds.length === 0 ? [...allIds] : [...currentIds];
  const next = active.includes(currencyId)
    ? active.filter((id) => id !== currencyId)
    : [...active, currencyId];
  if (next.length === 0 || next.length === allIds.length) {
    return [];
  }
  return next;
}

function SelectedCountControl({
  selected,
  total,
  onChange,
  variant,
}: {
  selected: number;
  total: number;
  onChange: (value: number) => void;
  variant: 'full' | 'half';
}): ReactElement {
  const max = Math.max(0, total);
  const value = Math.min(Math.max(0, selected), max);

  if (variant === 'half') {
    return (
      <div className={`${CLASS}__select-card`}>
        <div className={`${CLASS}__select-card-top`}>
          <strong>
            {value} из {max} счетов
          </strong>
          <span>{selectionPercent(value, max)}%</span>
        </div>
        <input
          className={`${CLASS}__range`}
          type="range"
          min={0}
          max={max}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          aria-label="Счетов к оплате"
        />
      </div>
    );
  }

  return (
    <div className={`${CLASS}__slider`}>
      <span className={`${CLASS}__slider-caption`}>Счетов к оплате:</span>
      <span className={`${CLASS}__slider-badge`}>
        {value} / {max}
      </span>
      <input
        className={`${CLASS}__range`}
        type="range"
        min={0}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label="Счетов к оплате"
      />
      <div className={`${CLASS}__slider-steps`}>
        <button
          type="button"
          className={`${CLASS}__step-btn`}
          onClick={() => onChange(Math.max(0, value - 1))}
          disabled={value <= 0}
          aria-label="Уменьшить"
        >
          −
        </button>
        <input
          className={`${CLASS}__count-input`}
          type="number"
          min={0}
          max={max}
          value={value}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isFinite(next)) {
              onChange(Math.min(max, Math.max(0, Math.round(next))));
            }
          }}
          aria-label="Число счетов к оплате"
        />
        <button
          type="button"
          className={`${CLASS}__step-btn`}
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label="Увеличить"
        >
          +
        </button>
      </div>
    </div>
  );
}

function WidgetFilters({
  options,
  providerId,
  billingCycleId,
  currencyIds,
  onProviderChange,
  onBillingCycleChange,
  onCurrencyToggle,
}: {
  options: ReturnType<typeof collectFilterOptions>;
  providerId: number | 'all';
  billingCycleId: number | 'all';
  currencyIds: number[];
  onProviderChange: (value: number | 'all') => void;
  onBillingCycleChange: (value: number | 'all') => void;
  onCurrencyToggle: (currencyId: number) => void;
}): ReactElement {
  return (
    <div className={`${CLASS}__filters`}>
      <label className={`${CLASS}__filter-field`}>
        <span>Поставщик</span>
        <select
          value={String(providerId)}
          onChange={(event) =>
            onProviderChange(
              event.target.value === 'all' ? 'all' : Number(event.target.value),
            )
          }
        >
          <option value="all">Все</option>
          {options.providers.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label className={`${CLASS}__filter-field`}>
        <span>Биллинговый цикл</span>
        <select
          value={String(billingCycleId)}
          onChange={(event) =>
            onBillingCycleChange(
              event.target.value === 'all' ? 'all' : Number(event.target.value),
            )
          }
        >
          <option value="all">Все</option>
          {options.billingCycles.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <div className={`${CLASS}__filter-field`}>
        <span>Валюты</span>
        <div className={`${CLASS}__filter-currencies`}>
          {options.currencies.map((item) => {
            const checked =
              currencyIds.length === 0 || currencyIds.includes(item.id);
            return (
              <label key={item.id} className={`${CLASS}__filter-check`}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onCurrencyToggle(item.id)}
                />
                <span>{item.name}</span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CurrencyTotalsPanel({
  totals,
  amountFormat,
  title,
  showBillCount = false,
  dense = false,
}: {
  totals: readonly ICurrencyTotal[];
  amountFormat: TAmountFormat;
  title?: string;
  showBillCount?: boolean;
  dense?: boolean;
}): ReactElement {
  const ordered = sortCurrencyTotals(totals);

  return (
    <div
      className={`${CLASS}__panel ${dense ? `${CLASS}__panel--dense` : ''}`}
    >
      {title ? <div className={`${CLASS}__panel-title`}>{title}</div> : null}
      <div className={`${CLASS}__currency-list`}>
        {ordered.map((item, index) => (
          <div
            key={item.currencyId}
            className={`${CLASS}__currency-row ${
              index === 0 ? `${CLASS}__currency-row--lead` : ''
            }`}
          >
            <span className={`${CLASS}__currency-amount`}>
              {formatMoney(item.totalAmount, item.currencyName, amountFormat)}
            </span>
            {showBillCount ? (
              <span className={`${CLASS}__currency-meta`}>
                {billsLabel(item.billCount)}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function ProviderShareBar({
  items,
}: {
  items: readonly IProviderCurrencyBreakdownItem[];
}): ReactElement | null {
  if (items.length === 0) {
    return null;
  }

  return (
    <div
      className={`${CLASS}__share-bar`}
      role="img"
      aria-label="Доли поставщиков"
    >
      {items.map((item, index) => (
        <span
          key={`${item.providerId}-${item.currencyId}`}
          className={`${CLASS}__share-seg`}
          style={{
            width: `${Math.max(item.sharePercent, 0)}%`,
            background: CHART_COLORS[index % CHART_COLORS.length],
          }}
          title={`${item.providerName}: ${formatPercent(item.sharePercent)}`}
        />
      ))}
    </div>
  );
}

function ProviderBreakdown({
  plan,
  amountFormat,
  currencyId,
  onCurrencyChange,
}: {
  plan: IPaymentPlanResult;
  amountFormat: TAmountFormat;
  currencyId: number | null;
  onCurrencyChange: (currencyId: number) => void;
}): ReactElement | null {
  const orderedCurrencies = sortCurrencyTotals(plan.currencyTotals);
  if (orderedCurrencies.length === 0) {
    return null;
  }

  const activeCurrency =
    orderedCurrencies.find((item) => item.currencyId === currencyId) ??
    orderedCurrencies[0];
  const items = plan.providerBreakdown.filter(
    (item) => item.currencyId === activeCurrency.currencyId,
  );

  return (
    <section className={`${CLASS}__panel ${CLASS}__breakdown`}>
      <div className={`${CLASS}__breakdown-head`}>
        <div className={`${CLASS}__panel-title`}>
          По поставщикам ({activeCurrency.currencyName})
        </div>
        {orderedCurrencies.length > 1 ? (
          <div className={`${CLASS}__currency-tabs`}>
            {orderedCurrencies.map((item) => (
              <button
                key={item.currencyId}
                type="button"
                className={`${CLASS}__currency-tab ${
                  item.currencyId === activeCurrency.currencyId
                    ? `${CLASS}__currency-tab--active`
                    : ''
                }`}
                onClick={() => onCurrencyChange(item.currencyId)}
              >
                {item.currencyName}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <ProviderShareBar items={items} />

      <ul className={`${CLASS}__provider-list`}>
        {items.map((item, index) => (
          <li
            key={`${item.providerId}-${item.currencyId}`}
            className={`${CLASS}__provider-item`}
          >
            <span
              className={`${CLASS}__provider-dot`}
              style={{ background: CHART_COLORS[index % CHART_COLORS.length] }}
            />
            <span className={`${CLASS}__provider-name`}>
              {item.providerName} ({item.billCount})
            </span>
            <span className={`${CLASS}__provider-meta`}>
              {formatMoney(item.totalAmount, item.currencyName, amountFormat)} ·{' '}
              {formatPercent(item.sharePercent)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function QueueTable({
  items,
  config,
  selectedBillId,
  onSelectBill,
}: {
  items: readonly IQueueBillItem[];
  config: IPaymentPlannerConfig;
  selectedBillId: number | null;
  onSelectBill: (billId: number) => void;
}): ReactElement {
  return (
    <div className={`${CLASS}__table-wrap`}>
      <table className={`${CLASS}__table`}>
        <thead>
          <tr>
            <th>RANK</th>
            <th>Поставщик / счёт</th>
            {config.showCustomerBills ? <th>Клиентский счёт</th> : null}
            <th>Дата</th>
            <th>Сумма</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const isActive = selectedBillId === item.row.provider_bill_id;
            return (
              <tr
                key={item.row.provider_bill_id}
                className={[
                  item.selected ? `${CLASS}__row--selected` : '',
                  item.hasInvalidAmount ? `${CLASS}__row--invalid` : '',
                  isActive ? `${CLASS}__row--active` : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => onSelectBill(item.row.provider_bill_id)}
              >
                <td className={`${CLASS}__rank`}>
                  #{item.rank ?? '—'}
                </td>
                <td>
                  <div className={`${CLASS}__cell-main`}>
                    {item.row.provider_name}
                  </div>
                  <div className={`${CLASS}__cell-sub`}>
                    {item.row.provider_bill_no} (#{item.row.provider_bill_id})
                  </div>
                </td>
                {config.showCustomerBills ? (
                  <td>
                    {item.hasCustomerBill ? (
                      <span>
                        {item.row.customer_bill_no}
                        {item.row.customer_name
                          ? ` · ${item.row.customer_name}`
                          : ''}
                      </span>
                    ) : (
                      <span className={`${CLASS}__muted`}>—</span>
                    )}
                  </td>
                ) : null}
                <td className={`${CLASS}__muted`}>
                  {formatDate(item.row.provider_recv_date)}
                </td>
                <td className={`${CLASS}__amount-cell`}>
                  {item.hasInvalidAmount || item.providerAmount === null ? (
                    <span className={`${CLASS}__invalid-note`}>
                      ⚠ Некорректная сумма (исключена)
                    </span>
                  ) : (
                    formatMoney(
                      item.providerAmount,
                      item.row.provider_currency_name,
                      config.amountFormat,
                    )
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BillDetails({
  item,
  config,
  onClose,
}: {
  item: IQueueBillItem;
  config: IPaymentPlannerConfig;
  onClose: () => void;
}): ReactElement {
  return (
    <aside className={`${CLASS}__details`}>
      <div className={`${CLASS}__details-head`}>
        <h5 className={`${CLASS}__section-title`}>Детали счёта</h5>
        <button
          type="button"
          className={`${CLASS}__link-btn`}
          onClick={onClose}
        >
          Закрыть
        </button>
      </div>
      <dl className={`${CLASS}__details-grid`}>
        <div>
          <dt>Поставщик</dt>
          <dd>
            {item.row.provider_name} ({item.row.provider_code})
          </dd>
        </div>
        <div>
          <dt>Счёт</dt>
          <dd>{item.row.provider_bill_no}</dd>
        </div>
        <div>
          <dt>Дата</dt>
          <dd>{formatDate(item.row.provider_recv_date)}</dd>
        </div>
        <div>
          <dt>Биллинговый цикл</dt>
          <dd>{item.row.billing_cycle_name}</dd>
        </div>
        <div>
          <dt>Сумма</dt>
          <dd>
            {item.hasInvalidAmount || item.providerAmount === null
              ? 'Некорректная сумма (исключена)'
              : formatMoney(
                  item.providerAmount,
                  item.row.provider_currency_name,
                  config.amountFormat,
                )}
          </dd>
        </div>
        <div>
          <dt>Rank</dt>
          <dd>#{item.rank ?? '—'}</dd>
        </div>
        {config.showCustomerBills && item.hasCustomerBill ? (
          <>
            <div>
              <dt>Клиентский счёт</dt>
              <dd>{item.row.customer_bill_no}</dd>
            </div>
            <div>
              <dt>Клиент</dt>
              <dd>
                {item.row.customer_name}
                {item.row.customer_inn ? ` · ИНН ${item.row.customer_inn}` : ''}
              </dd>
            </div>
            <div>
              <dt>Сумма клиента</dt>
              <dd>
                {item.customerAmount === null
                  ? '—'
                  : formatMoney(
                      item.customerAmount,
                      item.row.provider_currency_name,
                      config.amountFormat,
                    )}
              </dd>
            </div>
            {item.row.customer_comments ? (
              <div>
                <dt>Комментарий</dt>
                <dd>{item.row.customer_comments}</dd>
              </div>
            ) : null}
          </>
        ) : null}
      </dl>
    </aside>
  );
}

function StatusBlock({
  title,
  text,
  tone = 'muted',
}: {
  title: string;
  text: string;
  tone?: 'muted' | 'error';
}): ReactElement {
  return (
    <div
      className={`${CLASS}__status ${tone === 'error' ? `${CLASS}__status--error` : ''}`}
      role="status"
    >
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

function Skeleton(): ReactElement {
  return (
    <div className={`${CLASS}__skeleton`} aria-busy="true" aria-live="polite">
      <div className={`${CLASS}__skeleton-line`} />
      <div className={`${CLASS}__skeleton-line ${CLASS}__skeleton-line--short`} />
      <div className={`${CLASS}__skeleton-block`} />
      <div className={`${CLASS}__skeleton-block ${CLASS}__skeleton-block--tall`} />
    </div>
  );
}

function PlanBody({
  plan,
  config,
  size,
  selectedCount,
  onSelectedCountChange,
  selectedBillId,
  onSelectBill,
  breakdownCurrencyId,
  onBreakdownCurrencyChange,
  showQueue,
  onToggleQueue,
  currenciesExpanded,
  onExpandCurrencies,
  filterOptions,
  onProviderChange,
  onBillingCycleChange,
  onCurrencyToggle,
}: {
  plan: IPaymentPlanResult;
  config: IPaymentPlannerConfig;
  size: TWidgetSize;
  selectedCount: number;
  onSelectedCountChange: (value: number) => void;
  selectedBillId: number | null;
  onSelectBill: (billId: number | null) => void;
  breakdownCurrencyId: number | null;
  onBreakdownCurrencyChange: (currencyId: number) => void;
  showQueue: boolean;
  onToggleQueue: () => void;
  currenciesExpanded: boolean;
  onExpandCurrencies: () => void;
  filterOptions: ReturnType<typeof collectFilterOptions>;
  onProviderChange: (value: number | 'all') => void;
  onBillingCycleChange: (value: number | 'all') => void;
  onCurrencyToggle: (currencyId: number) => void;
}): ReactElement {
  const selectedBill =
    selectedBillId === null
      ? null
      : (plan.queueItems.find(
          (item) => item.row.provider_bill_id === selectedBillId,
        ) ?? null);
  const oldestDate = oldestSelectedDate(plan.queueItems);
  const orderedCurrencies = sortCurrencyTotals(plan.currencyTotals);
  const primaryCurrency =
    orderedCurrencies.find((item) => item.currencyId === breakdownCurrencyId) ??
    orderedCurrencies[0] ??
    null;
  const compactShareItems =
    primaryCurrency === null
      ? []
      : plan.providerBreakdown.filter(
          (item) => item.currencyId === primaryCurrency.currencyId,
        );

  if (size === 'quarter') {
    const visible = currenciesExpanded
      ? orderedCurrencies
      : orderedCurrencies.slice(0, QUARTER_CURRENCY_LIMIT);
    const hidden = currenciesExpanded
      ? []
      : orderedCurrencies.slice(QUARTER_CURRENCY_LIMIT);

    return (
      <div className={`${CLASS}__body ${CLASS}__body--quarter`}>
        <div className={`${CLASS}__hero-box`}>
          <strong>{plan.effectiveSelectedCount}</strong>
          <span>из {plan.totalQueueCount} к оплате</span>
        </div>

        {config.showSummary ? (
          <div className={`${CLASS}__quarter-currencies`}>
            <div className={`${CLASS}__panel-title`}>
              Валют в плане: {orderedCurrencies.length}
            </div>
            {visible.map((item) => (
              <div key={item.currencyId} className={`${CLASS}__currency-amount`}>
                {formatMoney(
                  item.totalAmount,
                  item.currencyName,
                  config.amountFormat,
                )}
              </div>
            ))}
            {hidden.length > 0 ? (
              <button
                type="button"
                className={`${CLASS}__more-chip`}
                onClick={onExpandCurrencies}
              >
                + ещё {hidden.length}{' '}
                {pluralRu(hidden.length, 'валюта', 'валюты', 'валют')} (
                {hidden.map((item) => item.currencyName).join(', ')})
              </button>
            ) : null}
          </div>
        ) : null}

        {!currenciesExpanded && hidden.length > 0 ? (
          <button
            type="button"
            className={`${CLASS}__action-btn`}
            onClick={onExpandCurrencies}
          >
            Все валюты →
          </button>
        ) : null}
      </div>
    );
  }

  if (size === 'third') {
    return (
      <div className={`${CLASS}__body ${CLASS}__body--third`}>
        <div className={`${CLASS}__hero-pair`}>
          <div className={`${CLASS}__hero-stat`}>
            <span className={`${CLASS}__hero-stat-main`}>
              {plan.effectiveSelectedCount}
            </span>
            <span className={`${CLASS}__hero-stat-sub`}>
              {' '}
              / {plan.totalQueueCount}
            </span>
          </div>
          <div className={`${CLASS}__hero-meta`}>
            счетов в плане · {plan.selectedProviderCount}{' '}
            {pluralRu(
              plan.selectedProviderCount,
              'поставщик',
              'поставщика',
              'поставщиков',
            )}
          </div>
        </div>

        {config.showSummary ? (
          <div className={`${CLASS}__currency-stack`}>
            {orderedCurrencies.map((item, index) => (
              <div
                key={item.currencyId}
                className={`${CLASS}__currency-amount ${
                  index === 0 ? `${CLASS}__currency-amount--lead` : ''
                }`}
              >
                {formatMoney(
                  item.totalAmount,
                  item.currencyName,
                  config.amountFormat,
                )}
              </div>
            ))}
          </div>
        ) : null}

        {config.showProviderBreakdown && primaryCurrency ? (
          <div className={`${CLASS}__share-block`}>
            <div className={`${CLASS}__panel-title`}>
              Доли поставщиков ({primaryCurrency.currencyName})
            </div>
            <ProviderShareBar items={compactShareItems} />
          </div>
        ) : null}

        <button
          type="button"
          className={`${CLASS}__action-btn`}
          onClick={onToggleQueue}
        >
          {showQueue ? 'Скрыть детали' : 'Открыть детали →'}
        </button>

        {showQueue ? (
          <QueueTable
            items={plan.visibleQueueItems}
            config={config}
            selectedBillId={selectedBillId}
            onSelectBill={(billId) => onSelectBill(billId)}
          />
        ) : null}
        {selectedBill ? (
          <BillDetails
            item={selectedBill}
            config={config}
            onClose={() => onSelectBill(null)}
          />
        ) : null}
      </div>
    );
  }

  if (size === 'half') {
    return (
      <div className={`${CLASS}__body ${CLASS}__body--half`}>
        <SelectedCountControl
          selected={selectedCount}
          total={plan.totalQueueCount}
          onChange={onSelectedCountChange}
          variant="half"
        />

        {config.showSummary ? (
          <CurrencyTotalsPanel
            totals={plan.currencyTotals}
            amountFormat={config.amountFormat}
            title="Сумма к оплате по валютам"
            showBillCount
          />
        ) : null}

        <div className={`${CLASS}__meta-list`}>
          <div>
            Поставщиков в плане:{' '}
            <strong>{plan.selectedProviderCount}</strong>
          </div>
          {oldestDate ? (
            <div>
              Старейший счёт: <strong>{formatDate(oldestDate)}</strong>
            </div>
          ) : null}
          {plan.invalidSelectedCount > 0 ? (
            <div className={`${CLASS}__warning-inline`}>
              Исключено некорректных:{' '}
              <strong>{billsLabel(plan.invalidSelectedCount)}</strong>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          className={`${CLASS}__action-btn`}
          onClick={onToggleQueue}
        >
          {showQueue ? 'Скрыть очередь платежей' : 'Открыть очередь платежей →'}
        </button>

        {showQueue ? (
          <QueueTable
            items={plan.visibleQueueItems}
            config={config}
            selectedBillId={selectedBillId}
            onSelectBill={(billId) => onSelectBill(billId)}
          />
        ) : null}
        {selectedBill ? (
          <BillDetails
            item={selectedBill}
            config={config}
            onClose={() => onSelectBill(null)}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className={`${CLASS}__body ${CLASS}__body--full`}>
      {config.showSummary ? (
        <div className={`${CLASS}__stats`}>
          <div className={`${CLASS}__stat`}>
            <strong>{plan.totalQueueCount}</strong>
            <span>счетов в очереди</span>
          </div>
          <div className={`${CLASS}__stat ${CLASS}__stat--accent`}>
            <strong>{plan.effectiveSelectedCount}</strong>
            <span>выбрано к оплате</span>
          </div>
          <div className={`${CLASS}__stat`}>
            <strong>{plan.selectedProviderCount}</strong>
            <span>поставщиков</span>
          </div>
        </div>
      ) : null}

      <WidgetFilters
        options={filterOptions}
        providerId={config.providerId}
        billingCycleId={config.billingCycleId}
        currencyIds={config.currencyIds}
        onProviderChange={onProviderChange}
        onBillingCycleChange={onBillingCycleChange}
        onCurrencyToggle={onCurrencyToggle}
      />

      {plan.totalQueueCount === 0 ? (
        <StatusBlock
          title="Нет счетов по фильтрам"
          text="Измените поставщика, биллинговый цикл или валюты."
        />
      ) : null}

      {(config.showSummary || config.showProviderBreakdown) &&
      plan.currencyTotals.length > 0 ? (
        <div className={`${CLASS}__summary-grid`}>
          {config.showSummary ? (
            <CurrencyTotalsPanel
              totals={plan.currencyTotals}
              amountFormat={config.amountFormat}
              title="Сумма по валютам"
              dense
            />
          ) : null}
          {config.showProviderBreakdown ? (
            <ProviderBreakdown
              plan={plan}
              amountFormat={config.amountFormat}
              currencyId={breakdownCurrencyId}
              onCurrencyChange={onBreakdownCurrencyChange}
            />
          ) : null}
        </div>
      ) : null}

      <SelectedCountControl
        selected={selectedCount}
        total={plan.totalQueueCount}
        onChange={onSelectedCountChange}
        variant="full"
      />

      {plan.invalidSelectedCount > 0 ? (
        <div className={`${CLASS}__warning`}>
          Исключено некорректных:{' '}
          {billsLabel(plan.invalidSelectedCount)}
        </div>
      ) : null}

      <QueueTable
        items={plan.visibleQueueItems}
        config={config}
        selectedBillId={selectedBillId}
        onSelectBill={(billId) => onSelectBill(billId)}
      />

      {selectedBill ? (
        <BillDetails
          item={selectedBill}
          config={config}
          onClose={() => onSelectBill(null)}
        />
      ) : null}
    </div>
  );
}

export function PaymentPlannerWidget({
  params,
  data,
  size,
}: IPaymentPlannerWidgetProps): ReactElement {
  const config = useMemo(() => parsePaymentPlannerParams(params), [params]);
  const effectiveSize = size ?? config.size;

  const [selectedCountOverride, setSelectedCountOverride] = useState<
    number | undefined
  >(undefined);
  const [providerOverride, setProviderOverride] = useState<
    number | 'all' | undefined
  >(undefined);
  const [billingCycleOverride, setBillingCycleOverride] = useState<
    number | 'all' | undefined
  >(undefined);
  const [currencyIdsOverride, setCurrencyIdsOverride] = useState<
    number[] | undefined
  >(undefined);
  const [selectedBillId, setSelectedBillId] = useState<number | null>(null);
  const [breakdownCurrencyId, setBreakdownCurrencyId] = useState<number | null>(
    null,
  );
  const [showQueue, setShowQueue] = useState(false);
  const [currenciesExpanded, setCurrenciesExpanded] = useState(false);

  // Compare currencyIds by value — parsePaymentPlannerParams always returns a new array.
  const currencyIdsKey = config.currencyIds.join(',');

  useEffect(() => {
    setSelectedCountOverride(undefined);
    setProviderOverride(undefined);
    setBillingCycleOverride(undefined);
    setCurrencyIdsOverride(undefined);
    setSelectedBillId(null);
  }, [
    config.selectedCount,
    config.providerId,
    config.billingCycleId,
    currencyIdsKey,
  ]);

  useEffect(() => {
    setCurrenciesExpanded(false);
  }, [effectiveSize, config.selectedCount]);

  const effectiveConfig = useMemo<IPaymentPlannerConfig>(
    () => ({
      ...config,
      providerId: providerOverride ?? config.providerId,
      billingCycleId: billingCycleOverride ?? config.billingCycleId,
      currencyIds: currencyIdsOverride ?? config.currencyIds,
    }),
    [config, providerOverride, billingCycleOverride, currencyIdsOverride],
  );

  const filterOptions = useMemo(
    () => collectFilterOptions(data.items),
    [data.items],
  );

  const plan = useMemo(
    () =>
      computePaymentPlan(data.items, effectiveConfig, {
        selectedCountOverride,
      }),
    [data.items, effectiveConfig, selectedCountOverride],
  );

  const requestedSelectedCount =
    selectedCountOverride ?? effectiveConfig.selectedCount;

  const header = (
    <WidgetHeader
      title={titleForSize(effectiveConfig, effectiveSize)}
      subtitle={subtitleForSize(
        effectiveConfig,
        effectiveSize,
        plan.currencyTotals.length || 0,
      )}
      aside={
        data.loaded ? (
          <FreshnessMark
            source="rows"
            stale={data.stale}
            lastSuccessAt={data.lastSuccessAt}
            showLabel={effectiveSize === 'full' || effectiveSize === 'half'}
          />
        ) : null
      }
    />
  );

  let content: ReactElement;
  if (data.loading && !data.loaded) {
    content = <Skeleton />;
  } else if (data.error !== null && !data.loaded) {
    content = (
      <StatusBlock
        title="Не удалось загрузить очередь"
        text={data.error}
        tone="error"
      />
    );
  } else if (data.loaded && data.items.length === 0) {
    content = (
      <StatusBlock
        title="Очередь пуста"
        text="В источнике provider-payment-queue нет счетов."
      />
    );
  } else {
    content = (
      <PlanBody
        plan={plan}
        config={effectiveConfig}
        size={effectiveSize}
        selectedCount={Math.min(
          Math.max(0, requestedSelectedCount),
          plan.totalQueueCount,
        )}
        onSelectedCountChange={setSelectedCountOverride}
        selectedBillId={selectedBillId}
        onSelectBill={setSelectedBillId}
        breakdownCurrencyId={breakdownCurrencyId}
        onBreakdownCurrencyChange={setBreakdownCurrencyId}
        showQueue={showQueue}
        onToggleQueue={() => setShowQueue((prev) => !prev)}
        currenciesExpanded={currenciesExpanded}
        onExpandCurrencies={() => setCurrenciesExpanded(true)}
        filterOptions={filterOptions}
        onProviderChange={setProviderOverride}
        onBillingCycleChange={setBillingCycleOverride}
        onCurrencyToggle={(currencyId) => {
          const allIds = filterOptions.currencies.map((item) => item.id);
          setCurrencyIdsOverride((prev) =>
            toggleCurrencyFilter(
              currencyId,
              prev ?? effectiveConfig.currencyIds,
              allIds,
            ),
          );
        }}
      />
    );
  }

  return (
    <article
      className={`${CLASS} ${widgetCardClass()}`}
      data-size={effectiveSize}
      data-refreshing={data.loading && data.loaded ? 'true' : undefined}
    >
      {header}
      {content}
    </article>
  );
}
