import type { ReactElement, ReactNode } from 'react';
import './widget-card.css';

interface IWidgetHeaderProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Right-hand side: the freshness mark, a badge, a menu. */
  aside?: ReactNode;
  className?: string;
}

/**
 * The card header: title, optional subtitle and an aside on the right.
 * Renders nothing when all three are empty, so a captionless card does not
 * keep an empty row.
 */
export function WidgetHeader({
  title,
  subtitle,
  aside,
  className,
}: IWidgetHeaderProps): ReactElement | null {
  const hasTitle = title !== undefined && title !== null && title !== '';
  const hasSubtitle =
    subtitle !== undefined && subtitle !== null && subtitle !== '';
  if (!hasTitle && !hasSubtitle && (aside === undefined || aside === null)) {
    return null;
  }
  return (
    <header
      className={
        className ? `dash-card__header ${className}` : 'dash-card__header'
      }
    >
      <div className="dash-card__titles">
        {hasTitle && <h4 className="dash-card__title">{title}</h4>}
        {hasSubtitle && <p className="dash-card__subtitle">{subtitle}</p>}
      </div>
      {aside !== undefined && aside !== null && (
        <div className="dash-card__aside">{aside}</div>
      )}
    </header>
  );
}
