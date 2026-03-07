import React from 'react';
import { MoreVertical } from 'lucide-react';

interface ChartCardProps {
  title: string;
  children: React.ReactNode;
  toggle?: {
    options: Array<{ label: string; value: string }>;
    onChange: (value: string) => void;
    current: string;
  };
  onMenuClick?: () => void;
}

/**
 * Universal wrapper for all 14 chart visualizations
 * Provides consistent styling, header, and interactions
 */
export const ChartCard: React.FC<ChartCardProps> = ({
  title,
  children,
  toggle,
  onMenuClick,
}) => {
  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <span className="chart-card-title">{title}</span>
        <div className="chart-card-actions">
          {toggle && (
            <div className="chart-pill-toggle">
              {toggle.options.map((option) => (
                <button
                  key={option.value}
                  className={`${toggle.current === option.value ? 'active' : ''}`}
                  onClick={() => toggle.onChange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
          <button
            className="chart-overflow-btn"
            onClick={onMenuClick}
            title="Chart options"
          >
            <MoreVertical size={16} />
          </button>
        </div>
      </div>
      <div className="chart-card-body">{children}</div>
    </div>
  );
};

/**
 * Status indicator dot with optional pulse animation
 * Used in GasMonitoring and similar components
 */
interface StatusIndicatorProps {
  status: 'good' | 'warning' | 'critical';
  label?: string;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  label,
}) => {
  const colorMap = {
    good: 'bg-state-green',
    warning: 'bg-state-amber',
    critical: 'bg-state-red',
  };

  const classNames =
    `chart-status-indicator ${status} ${colorMap[status]}`;

  return (
    <div className="flex items-center gap-2">
      <span className={classNames} />
      {label && (
        <span className="text-xs font-medium text-text-secondary dark:text-dark-text-secondary">
          {label}
        </span>
      )}
    </div>
  );
};

export default ChartCard;
