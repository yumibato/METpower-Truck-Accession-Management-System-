import React from 'react';

interface PillToggleProps {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  /** Optional aria label for the group */
  label?: string;
}

/**
 * Pill-style toggle group aligned to the design system.
 *
 * Uses `.chart-pill-toggle` CSS class from index.css.
 * Adapts to light/dark mode automatically via CSS vars.
 *
 * Usage:
 *   <PillToggle
 *     options={['Tonnage', 'Trips']}
 *     value={metric}
 *     onChange={setMetric}
 *   />
 */
export const PillToggle: React.FC<PillToggleProps> = ({ options, value, onChange, label }) => (
  <div className="chart-pill-toggle" role="group" aria-label={label}>
    {options.map(o => (
      <button
        key={o}
        type="button"
        onClick={() => onChange(o)}
        className={value === o ? 'active' : ''}
        aria-pressed={value === o}
      >
        {o}
      </button>
    ))}
  </div>
);

export default PillToggle;
