import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import Badge from './Badge';

interface StatProps {
  label: string;
  value: string | number;
  change?: number; // percentage change
  icon?: React.ReactNode;
  subMetrics?: { label: string; value: string | number }[];
}

const Stat: React.FC<StatProps> = ({ label, value, change, icon, subMetrics }) => {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;

  return (
    <div className="space-y-3">
      {/* Header with icon and label */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-text-muted dark:text-dark-text-muted">
          {label}
        </span>
        {icon && <span className="text-text-secondary dark:text-dark-text-secondary">{icon}</span>}
      </div>

      {/* Large number */}
      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-bold tracking-tight text-text-primary dark:text-dark-text-primary">
          {value}
        </span>
        {change !== undefined && (
          <Badge color={isPositive ? 'green' : isNegative ? 'red' : 'gray'}>
            {isPositive && <TrendingUp className="w-3 h-3 mr-1" />}
            {isNegative && <TrendingDown className="w-3 h-3 mr-1" />}
            {Math.abs(change)}%
          </Badge>
        )}
      </div>

      {/* Sub-metrics */}
      {subMetrics && subMetrics.length > 0 && (
        <div className="space-y-2 pt-3 border-t border-border dark:border-dark-border">
          {subMetrics.map((metric, idx) => (
            <div key={idx} className="flex items-center justify-between text-xs">
              <span className="text-text-secondary dark:text-dark-text-secondary">{metric.label}</span>
              <span className="font-medium text-text-primary dark:text-dark-text-primary">{metric.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Stat;
