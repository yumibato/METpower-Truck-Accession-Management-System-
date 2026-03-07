import React from 'react';

export interface TooltipItem {
  key: string;
  label: string;
  color: string;
  unit?: string;
  formatter?: (value: number) => string;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: { dataKey: string; value: number }[];
  label?: string;
  items: TooltipItem[];
}

/**
 * Drop-in custom Recharts tooltip aligned to the design system.
 *
 * Usage:
 *   <Tooltip content={(props) => (
 *     <ChartTooltip {...props} items={[
 *       { key: 'tonnage', label: 'Tonnage', color: 'var(--chart-blue)', unit: ' t' },
 *     ]} />
 *   )} />
 */
export const ChartTooltip: React.FC<ChartTooltipProps> = ({ active, payload, label, items }) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="chart-tooltip">
      {label && <div className="chart-tooltip-label">{label}</div>}
      {items.map(item => {
        const found = payload.find(p => p.dataKey === item.key);
        if (!found) return null;
        const display = item.formatter
          ? item.formatter(found.value)
          : `${found.value?.toLocaleString()}${item.unit ?? ''}`;
        return (
          <div key={item.key} className="chart-tooltip-row">
            <div className="chart-tooltip-row-left">
              <span className="chart-tooltip-dot" style={{ background: item.color }} />
              <span className="chart-tooltip-item-label">{item.label}</span>
            </div>
            <span className="chart-tooltip-value">{display}</span>
          </div>
        );
      })}
    </div>
  );
};

export default ChartTooltip;
