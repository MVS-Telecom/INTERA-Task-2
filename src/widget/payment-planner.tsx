import { useMemo, type ReactElement } from 'react';
import { FreshnessMark } from '../platform/freshness-mark';
import { WidgetHeader } from '../platform/widget-card';
import { widgetCardClass } from '../platform/widget-card-class';
import type { ICollectionDataResult, TWidgetSize } from '../platform/widget-types';
import type { IProviderPaymentQueueRow } from '../types/provider-payment-queue';
import { computePaymentPlan } from './payment-planner-compute';
import { parsePaymentPlannerParams } from './payment-planner-params';
import './payment-planner.css';

const CLASS = 'dash-payment-planner';

export interface IPaymentPlannerWidgetProps {
  /** Raw widget configuration from dashboard YAML / parameter editor. */
  params?: Record<string, unknown>;
  /** Collection data envelope from INTERA runtime (`useCollectionData`). */
  data: ICollectionDataResult<IProviderPaymentQueueRow>;
  /** Optional explicit size override from the host container. */
  size?: TWidgetSize;
}

export function PaymentPlannerWidget({
  params,
  data,
  size,
}: IPaymentPlannerWidgetProps): ReactElement {
  const config = useMemo(() => parsePaymentPlannerParams(params), [params]);
  const effectiveSize = size ?? config.size;

  const plan = useMemo(
    () => computePaymentPlan(data.items, config),
    [data.items, config],
  );

  const header = (
    <WidgetHeader
      title={config.description}
      subtitle={config.subtitle}
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

  return (
    <article
      className={`${CLASS} ${widgetCardClass()}`}
      data-size={effectiveSize}
    >
      {header}
      <div className={`${CLASS}__placeholder`}>
        <strong>TODO: Реализуйте PaymentPlannerWidget</strong>
        <div>
          Размер: <code>{effectiveSize}</code> · Счетов во входном источнике:{' '}
          <code>{data.items.length}</code> · Выбрано в плане:{' '}
          <code>
            {plan.effectiveSelectedCount} / {plan.totalQueueCount}
          </code>
        </div>
      </div>
    </article>
  );
}
