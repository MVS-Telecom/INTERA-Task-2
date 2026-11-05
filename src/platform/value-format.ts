const NUMBER_LOCALE_RU = 'ru-RU';
const NUMBER_LOCALE_EU = 'de-DE';
const DATE_LOCALE = 'ru-RU';
const FRACTION_DIGITS_DEFAULT = 2;
const FRACTION_DIGITS_QUAD = 4;
const PERCENT_FRACTION_DIGITS = 1;
const MONTHS_IN_YEAR = 12;
const PERIOD_PREFIX_REGEX = /^(\d{4})-(\d{2})/;

const TRAFFIC_FORMAT_UNITS: Record<string, string> = {
  'traffic.mb': 'MB',
  'traffic.gb': 'GB',
  'traffic.tb': 'TB',
};

export interface IFormatCurrencyOptions {
  currencyCode?: string | null;
  minorUnits?: number | null;
}

function toDisplayString(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(
  value: number,
  locale: string,
  options: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

function formatDate(value: unknown): string | null {
  const date =
    value instanceof Date
      ? value
      : typeof value === 'string' || typeof value === 'number'
        ? new Date(value)
        : null;
  if (!date || Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat(DATE_LOCALE, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function formatPeriod(value: unknown, style: 'short' | 'long'): string {
  if (typeof value !== 'string') {
    return toDisplayString(value);
  }
  const match = PERIOD_PREFIX_REGEX.exec(value.trim());
  if (!match) {
    return toDisplayString(value);
  }
  const [, year, monthRaw] = match;
  const month = Number(monthRaw);
  if (month < 1 || month > MONTHS_IN_YEAR) {
    return toDisplayString(value);
  }

  if (style === 'short') {
    return `${monthRaw}.${year}`;
  }

  const date = new Date(Date.UTC(Number(year), month - 1, 1));
  return new Intl.DateTimeFormat(DATE_LOCALE, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function formatValue(
  value: unknown,
  formatType?: string,
  currencyOptions?: IFormatCurrencyOptions,
): string {
  if (!formatType || formatType === 'text') {
    return toDisplayString(value);
  }

  if (formatType === 'date') {
    return formatDate(value) ?? toDisplayString(value);
  }

  if (formatType === 'period.short') {
    return formatPeriod(value, 'short');
  }
  if (formatType === 'period.long') {
    return formatPeriod(value, 'long');
  }

  const numericValue = toNumber(value);
  if (numericValue === null) {
    return toDisplayString(value);
  }

  if (formatType === 'integer') {
    return formatNumber(numericValue, NUMBER_LOCALE_RU, {
      maximumFractionDigits: 0,
    });
  }
  if (formatType === 'decimal') {
    return formatNumber(numericValue, NUMBER_LOCALE_RU, {
      minimumFractionDigits: FRACTION_DIGITS_DEFAULT,
      maximumFractionDigits: FRACTION_DIGITS_DEFAULT,
    });
  }
  if (formatType === 'decimal4') {
    return formatNumber(numericValue, NUMBER_LOCALE_RU, {
      minimumFractionDigits: FRACTION_DIGITS_QUAD,
      maximumFractionDigits: FRACTION_DIGITS_QUAD,
    });
  }
  if (formatType === 'currency') {
    const code = currencyOptions?.currencyCode;
    const fractionDigits =
      currencyOptions?.minorUnits ?? FRACTION_DIGITS_DEFAULT;
    if (!code) {
      return formatNumber(numericValue, NUMBER_LOCALE_RU, {
        minimumFractionDigits: FRACTION_DIGITS_DEFAULT,
        maximumFractionDigits: FRACTION_DIGITS_DEFAULT,
      });
    }
    try {
      return formatNumber(numericValue, NUMBER_LOCALE_RU, {
        style: 'currency',
        currency: code,
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      });
    } catch {
      return `${formatNumber(numericValue, NUMBER_LOCALE_RU, {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      })} ${code}`;
    }
  }
  if (formatType === 'percent') {
    return formatNumber(numericValue, NUMBER_LOCALE_RU, {
      style: 'percent',
      minimumFractionDigits: PERCENT_FRACTION_DIGITS,
      maximumFractionDigits: PERCENT_FRACTION_DIGITS,
    });
  }

  const trafficUnit = TRAFFIC_FORMAT_UNITS[formatType];
  if (trafficUnit !== undefined) {
    const formatted = formatNumber(numericValue, NUMBER_LOCALE_EU, {
      minimumFractionDigits: FRACTION_DIGITS_DEFAULT,
      maximumFractionDigits: FRACTION_DIGITS_DEFAULT,
    });
    return `${formatted} ${trafficUnit}`;
  }

  return toDisplayString(value);
}
