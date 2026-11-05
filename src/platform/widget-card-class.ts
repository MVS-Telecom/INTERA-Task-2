import './widget-card.css';

/**
 * Class of a widget's outer card — the chrome every dashboard card shares.
 * `flush` drops the inset for cards whose sections pad themselves.
 */
export function widgetCardClass(options: { flush?: boolean } = {}): string {
  return options.flush ? 'dash-card dash-card--flush' : 'dash-card';
}
