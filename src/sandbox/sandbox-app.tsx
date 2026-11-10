import { useEffect, useMemo, useState, type ReactElement } from 'react';
import mockQueue from '../data/mock-payment-queue.json';
import type {
  ICollectionDataResult,
  TWidgetRowLimit,
  TWidgetSize,
} from '../platform/widget-types';
import type { IProviderPaymentQueueRow } from '../types/provider-payment-queue';
import { PaymentPlannerWidget } from '../widget/payment-planner';
import {
  AMOUNT_FORMATS,
  type TAmountFormat,
} from '../widget/payment-planner-params';
import './sandbox.css';

type TDataStateMode =
  | 'ready'
  | 'stale'
  | 'refreshing'
  | 'loading'
  | 'empty'
  | 'error';

type TViewSizeMode = TWidgetSize | 'all';

const SIZE_LABELS: Record<TWidgetSize, string> = {
  full: 'XL · full (4/4 — ~880px)',
  half: 'L · half (1/2 — ~600px)',
  third: 'M · third (1/3 — ~400px)',
  quarter: 'S · quarter (1/4 — ~240px)',
};

const rows = mockQueue as IProviderPaymentQueueRow[];

export function SandboxApp(): ReactElement {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [viewSize, setViewSize] = useState<TViewSizeMode>('full');
  const [dataMode, setDataMode] = useState<TDataStateMode>('ready');

  const [description, setDescription] = useState('Provider Payment Planner');
  const [subtitle, setSubtitle] = useState(
    'Очередь к оплате по payment_rank · 4 валюты',
  );
  const [selectedCount, setSelectedCount] = useState(14);
  const [currencyIds, setCurrencyIds] = useState<number[]>([]);
  const [providerId, setProviderId] = useState<number | 'all'>('all');
  const [billingCycleId, setBillingCycleId] = useState<number | 'all'>('all');
  const [amountFormat, setAmountFormat] = useState<TAmountFormat>('grouped');
  const [rowLimit, setRowLimit] = useState<TWidgetRowLimit>(10);
  const [showCustomerBills, setShowCustomerBills] = useState(true);
  const [showProviderBreakdown, setShowProviderBreakdown] = useState(true);
  const [showSummary, setShowSummary] = useState(true);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const providers = useMemo(() => {
    const map = new Map<number, string>();
    for (const r of rows) {
      map.set(r.provider_id, r.provider_name);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, []);

  const currencies = useMemo(() => {
    const map = new Map<number, string>();
    for (const r of rows) {
      map.set(r.provider_currency_id, r.provider_currency_name);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, []);

  const billingCycles = useMemo(() => {
    const map = new Map<number, string>();
    for (const r of rows) {
      map.set(r.billing_cycle_id, r.billing_cycle_name);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, []);

  const dataEnvelope = useMemo<
    ICollectionDataResult<IProviderPaymentQueueRow>
  >(() => {
    switch (dataMode) {
      case 'loading':
        return {
          items: [],
          loading: true,
          loaded: false,
          error: null,
          stale: false,
          lastSuccessAt: null,
        };
      case 'refreshing':
        return {
          items: rows,
          loading: true,
          loaded: true,
          error: null,
          stale: false,
          lastSuccessAt: '2026-10-24T10:15:00Z',
        };
      case 'stale':
        return {
          items: rows,
          loading: false,
          loaded: true,
          error: null,
          stale: true,
          lastSuccessAt: '2026-10-24T08:40:00Z',
        };
      case 'empty':
        return {
          items: [],
          loading: false,
          loaded: true,
          error: null,
          stale: false,
          lastSuccessAt: '2026-10-24T10:15:00Z',
        };
      case 'error':
        return {
          items: [],
          loading: false,
          loaded: false,
          error:
            'Enigma API request timed out after 15000 ms for /api/ProviderPaymentQueue/bysky/query',
          stale: false,
          lastSuccessAt: null,
        };
      default:
        return {
          items: rows,
          loading: false,
          loaded: true,
          error: null,
          stale: false,
          lastSuccessAt: '2026-10-24T10:15:00Z',
        };
    }
  }, [dataMode]);

  const rawParams = useMemo<Record<string, unknown>>(
    () => ({
      description,
      subtitle,
      size: viewSize === 'all' ? 'full' : viewSize,
      selectedCount,
      currencyIds,
      providerId,
      billingCycleId,
      amountFormat,
      rowLimit,
      showCustomerBills,
      showProviderBreakdown,
      showSummary,
    }),
    [
      description,
      subtitle,
      viewSize,
      selectedCount,
      currencyIds,
      providerId,
      billingCycleId,
      amountFormat,
      rowLimit,
      showCustomerBills,
      showProviderBreakdown,
      showSummary,
    ],
  );

  const toggleCurrency = (cId: number) => {
    setCurrencyIds((prev) =>
      prev.includes(cId) ? prev.filter((id) => id !== cId) : [...prev, cId],
    );
  };

  const resetParams = () => {
    setDescription('Provider Payment Planner');
    setSubtitle('Очередь к оплате по payment_rank · 4 валюты');
    setSelectedCount(14);
    setCurrencyIds([]);
    setProviderId('all');
    setBillingCycleId('all');
    setAmountFormat('grouped');
    setRowLimit(10);
    setShowCustomerBills(true);
    setShowProviderBreakdown(true);
    setShowSummary(true);
  };

  return (
    <div className="sandbox-shell">
      <header className="sandbox-topbar">
        <div className="sandbox-brand">
          <span className="sandbox-brand__badge">INTERA</span>
          <span>Task 2 — Provider Payment Planner Widget</span>
        </div>

        <div className="sandbox-toolbar">
          <div className="sandbox-toolbar__group">
            <span className="sandbox-toolbar__label">Размер:</span>
            <div className="sandbox-seg">
              {(['full', 'half', 'third', 'quarter', 'all'] as const).map(
                (sz) => (
                  <button
                    key={sz}
                    type="button"
                    className={`sandbox-seg__btn ${viewSize === sz ? 'sandbox-seg__btn--active' : ''}`}
                    onClick={() => setViewSize(sz)}
                  >
                    {sz === 'all' ? 'Все 4' : sz}
                  </button>
                ),
              )}
            </div>
          </div>

          <div className="sandbox-toolbar__group">
            <span className="sandbox-toolbar__label">Состояние:</span>
            <div className="sandbox-seg">
              {(
                [
                  'ready',
                  'stale',
                  'refreshing',
                  'loading',
                  'empty',
                  'error',
                ] as const
              ).map((st) => (
                <button
                  key={st}
                  type="button"
                  className={`sandbox-seg__btn ${dataMode === st ? 'sandbox-seg__btn--active' : ''}`}
                  onClick={() => setDataMode(st)}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="sandbox-toolbar__group">
            <span className="sandbox-toolbar__label">Тема:</span>
            <div className="sandbox-seg">
              {(['light', 'dark'] as const).map((th) => (
                <button
                  key={th}
                  type="button"
                  className={`sandbox-seg__btn ${theme === th ? 'sandbox-seg__btn--active' : ''}`}
                  onClick={() => setTheme(th)}
                >
                  {th}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="sandbox-body">
        <section className="sandbox-stage">
          {viewSize === 'all' ? (
            <div className="sandbox-all-grid">
              <div className="sandbox-frame--full">
                <div className="sandbox-slot-label">{SIZE_LABELS.full}</div>
                <PaymentPlannerWidget
                  params={{ ...rawParams, size: 'full' }}
                  data={dataEnvelope}
                  size="full"
                />
              </div>
              <div className="sandbox-all-grid__bottom">
                {(['half', 'third', 'quarter'] as const).map((sz) => (
                  <div key={sz} className={`sandbox-frame--${sz}`}>
                    <div className="sandbox-slot-label">{SIZE_LABELS[sz]}</div>
                    <PaymentPlannerWidget
                      params={{ ...rawParams, size: sz }}
                      data={dataEnvelope}
                      size={sz}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className={`sandbox-frame--${viewSize}`}>
              <div className="sandbox-slot-label">{SIZE_LABELS[viewSize]}</div>
              <PaymentPlannerWidget
                params={rawParams}
                data={dataEnvelope}
                size={viewSize}
              />
            </div>
          )}
        </section>

        <aside className="sandbox-panel">
          <h3 className="sandbox-panel__title">Параметры виджета (params)</h3>

          <label className="sandbox-field">
            <span className="sandbox-field__label">Заголовок (description)</span>
            <input
              className="sandbox-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          <label className="sandbox-field">
            <span className="sandbox-field__label">
              Счетов к оплате (selectedCount: {selectedCount})
            </span>
            <input
              type="range"
              min={0}
              max={rows.length}
              value={selectedCount}
              onChange={(e) => setSelectedCount(Number(e.target.value))}
            />
          </label>

          <div className="sandbox-field">
            <span className="sandbox-field__label">
              Валюты (currencyIds — пусто = все)
            </span>
            <div className="sandbox-checks">
              {currencies.map(([id, name]) => (
                <label key={id} className="sandbox-check">
                  <input
                    type="checkbox"
                    checked={currencyIds.includes(id)}
                    onChange={() => toggleCurrency(id)}
                  />
                  <span>{name}</span>
                </label>
              ))}
            </div>
          </div>

          <label className="sandbox-field">
            <span className="sandbox-field__label">Поставщик (providerId)</span>
            <select
              className="sandbox-select"
              value={String(providerId)}
              onChange={(e) =>
                setProviderId(
                  e.target.value === 'all' ? 'all' : Number(e.target.value),
                )
              }
            >
              <option value="all">all (все поставщики)</option>
              {providers.map(([id, name]) => (
                <option key={id} value={id}>
                  {name} (#{id})
                </option>
              ))}
            </select>
          </label>

          <label className="sandbox-field">
            <span className="sandbox-field__label">
              Биллинговый цикл (billingCycleId)
            </span>
            <select
              className="sandbox-select"
              value={String(billingCycleId)}
              onChange={(e) =>
                setBillingCycleId(
                  e.target.value === 'all' ? 'all' : Number(e.target.value),
                )
              }
            >
              <option value="all">all (все циклы)</option>
              {billingCycles.map(([id, name]) => (
                <option key={id} value={id}>
                  {name} (#{id})
                </option>
              ))}
            </select>
          </label>

          <div className="sandbox-row-2">
            <label className="sandbox-field">
              <span className="sandbox-field__label">Формат (amountFormat)</span>
              <select
                className="sandbox-select"
                value={amountFormat}
                onChange={(e) =>
                  setAmountFormat(e.target.value as TAmountFormat)
                }
              >
                {AMOUNT_FORMATS.map((af) => (
                  <option key={af} value={af}>
                    {af}
                  </option>
                ))}
              </select>
            </label>

            <label className="sandbox-field">
              <span className="sandbox-field__label">Лимит строк (rowLimit)</span>
              <select
                className="sandbox-select"
                value={rowLimit}
                onChange={(e) =>
                  setRowLimit(Number(e.target.value) as TWidgetRowLimit)
                }
              >
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="sandbox-field">
            <span className="sandbox-field__label">Отображение блоков</span>
            <div className="sandbox-checks">
              <label className="sandbox-check">
                <input
                  type="checkbox"
                  checked={showSummary}
                  onChange={(e) => setShowSummary(e.target.checked)}
                />
                <span>showSummary</span>
              </label>
              <label className="sandbox-check">
                <input
                  type="checkbox"
                  checked={showProviderBreakdown}
                  onChange={(e) => setShowProviderBreakdown(e.target.checked)}
                />
                <span>showProviderBreakdown</span>
              </label>
              <label className="sandbox-check">
                <input
                  type="checkbox"
                  checked={showCustomerBills}
                  onChange={(e) => setShowCustomerBills(e.target.checked)}
                />
                <span>showCustomerBills</span>
              </label>
            </div>
          </div>

          <button
            type="button"
            className="sandbox-reset-btn"
            onClick={resetParams}
          >
            Сбросить параметры по умолчанию
          </button>
        </aside>
      </main>
    </div>
  );
}
