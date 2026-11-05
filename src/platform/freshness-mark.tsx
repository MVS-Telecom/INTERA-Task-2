import type { ReactElement } from 'react';
import './freshness-mark.css';

export type TFreshnessSource = 'rows' | 'metric' | 'silent';

interface IFreshnessMarkProps {
  source: TFreshnessSource;
  stale: boolean;
  lastSuccessAt: string | null;
  showLabel?: boolean;
}

const CLASS = 'dash-freshness';

export function FreshnessMark({
  source,
  stale,
  lastSuccessAt,
  showLabel = false,
}: IFreshnessMarkProps): ReactElement | null {
  if (stale) {
    const hint = lastSuccessAt
      ? `Данные устарели — последнее обновление: ${lastSuccessAt}`
      : 'Данные устарели';
    return (
      <span className={`${CLASS} ${CLASS}--stale`} role="status" title={hint}>
        <span className={`${CLASS}__dot`} aria-hidden="true" />
        Stale
      </span>
    );
  }

  if (source === 'silent') {
    return null;
  }

  if (source === 'metric') {
    const hint = lastSuccessAt ? `Обновлено: ${lastSuccessAt}` : 'Данные актуальны';
    return (
      <span
        className={`${CLASS} ${CLASS}--ring`}
        role="img"
        aria-label={hint}
        title={hint}
      />
    );
  }

  const liveHint = lastSuccessAt
    ? `Актуальные данные (${lastSuccessAt})`
    : 'Актуальные данные';
  return (
    <span
      className={`${CLASS} ${CLASS}--live`}
      role="img"
      aria-label={liveHint}
      title={liveHint}
    >
      <span className={`${CLASS}__dot`} aria-hidden="true" />
      {showLabel ? 'Live' : null}
    </span>
  );
}
