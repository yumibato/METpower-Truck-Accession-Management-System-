import React from 'react';

interface MetricBadgeProps {
  /** Numeric delta — e.g. 12 for +12%, -5 for -5% */
  value: number;
  /** Override the positive/negative detection */
  positive?: boolean;
  /** Show a % sign after the value (default true) */
  percent?: boolean;
  /** Additional className */
  className?: string;
}

/**
 * Compact change-badge aligned to the design system.
 *
 * Uses `.metric-badge.positive` / `.metric-badge.negative` CSS classes from index.css,
 * so it automatically adapts to light/dark mode via CSS custom properties.
 *
 * Usage:
 *   <MetricBadge value={12} />        → ↑ 12%  (green)
 *   <MetricBadge value={-5} />        → ↓ 5%   (red)
 *   <MetricBadge value={3} percent={false} /> → ↑ 3
 */
export const MetricBadge: React.FC<MetricBadgeProps> = ({
  value,
  positive,
  percent = true,
  className = '',
}) => {
  const isPos = positive ?? value >= 0;
  const abs   = Math.abs(value);
  const label = percent ? `${abs}%` : `${abs}`;

  return (
    <span className={`metric-badge ${isPos ? 'positive' : 'negative'} ${className}`}>
      {isPos ? '↑' : '↓'} {label}
    </span>
  );
};

export default MetricBadge;
