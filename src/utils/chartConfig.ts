import { useMemo, DependencyList } from 'react';

/**
 * Recharts Configuration Utilities
 * Global defaults for all 14 chart components
 * Ensures consistency across the dashboard
 */

/**
 * Standard CartesianGrid configuration
 * Minimal, clean grid with design system colors
 */
export const chartGridConfig = {
  strokeDasharray: '0',
  stroke: 'var(--grid)',
  vertical: false,
  horizontalPoints: [],
};

/**
 * Standard XAxis configuration
 * No gridlines or axis lines, clean typography
 */
export const chartXAxisConfig = {
  axisLine: false,
  tickLine: false,
  tick: {
    fill: 'var(--text-muted)',
    fontSize: 11,
    fontFamily: 'DM Sans, sans-serif',
  },
};

/**
 * Standard YAxis configuration
 * Hidden by default unless critical for the chart
 */
export const chartYAxisConfig = {
  hide: true,
};

/**
 * Standard Tooltip configuration
 * Styled to match design system, smooth appearance
 */
export const chartTooltipConfig = {
  contentStyle: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
    padding: '10px 14px',
    fontFamily: 'DM Sans, sans-serif',
  },
  labelStyle: {
    color: 'var(--text-secondary)',
    fontSize: 11,
  },
  itemStyle: {
    color: 'var(--text-primary)',
    fontSize: 13,
    fontWeight: 600,
  },
  cursor: {
    fill: 'rgba(0,0,0,0.03)',
  },
};

/**
 * Dark mode tooltip cursor override
 * Lighter fill for better visibility on dark backgrounds
 */
export const chartTooltipConfigDark = {
  ...chartTooltipConfig,
  cursor: {
    fill: 'rgba(255,255,255,0.03)',
  },
};

/**
 * Standard Legend configuration
 * Inline, minimal styling with circular dots
 */
export const chartLegendConfig = {
  iconType: 'circle',
  iconSize: 7,
  wrapperStyle: {
    fontSize: 12,
    color: 'var(--text-secondary)',
    paddingTop: 12,
  },
};

/**
 * Gradient definitions object builder
 * Returns SVG defs for smooth area fills
 */
export const createGradientDefs = () => ({
  blue: { id: 'gradBlue', color: '#2563EB', opacity: 0.15 },
  green: { id: 'gradGreen', color: '#22C55E', opacity: 0.12 },
  pink: { id: 'gradPink', color: '#EC4899', opacity: 0.10 },
  amber: { id: 'gradAmber', color: '#F97316', opacity: 0.12 },
  purple: { id: 'gradPurple', color: '#8B5CF6', opacity: 0.15 },
  teal: { id: 'gradTeal', color: '#14B8A6', opacity: 0.12 },
  red: { id: 'gradRed', color: '#EF4444', opacity: 0.15 },
  indigo: { id: 'gradIndigo', color: '#6366F1', opacity: 0.12 },
});

/**
 * Color palette for different chart types
 * Use these for consistent coloring
 */
export const chartPalettes = {
  primary: ['#2563EB'],
  dual: ['#2563EB', '#22C55E'],
  triple: ['#2563EB', '#22C55E', '#EC4899'],
  multiv1: ['#2563EB', '#22C55E', '#EC4899', '#F97316', '#8B5CF6'],
  multiv2: ['#2563EB', '#22C55E', '#EC4899', '#F97316', '#8B5CF6', '#14B8A6'],
  substrate: {
    Pineapple: '#22C55E',
    Manure: '#F97316',
    Sludge: '#6366F1',
    Other: '#9CA3AF',
  },
  status: {
    Completed: '#22C55E',
    Pending: '#F97316',
    Rejected: '#EF4444',
    Unknown: '#9CA3AF',
  },
  weight: {
    gross: '#3B82F6',
    tare: '#9CA3AF',
    net: '#22C55E',
  },
};

/**
 * Active dot configuration for area/line charts
 * Smooth interaction feedback
 */
export const createActiveDotConfig = (color: string) => ({
  r: 5,
  fill: color,
  stroke: 'var(--bg-card)',
  strokeWidth: 2,
});

/**
 * Reference line styling
 * For SLA, target, or threshold lines
 */
export const referenceLineConfig = {
  stroke: '#9CA3AF',
  strokeDasharray: '4 3',
  strokeWidth: 1,
};

/**
 * Bar chart radius configuration
 * Applies rounded corners to top of bars
 */
export const barRadiusTop = [6, 6, 0, 0];
export const barRadiusRight = [0, 6, 6, 0];

/**
 * Standard responsive container config
 * Ensures charts scale properly
 */
export const responsiveContainerConfig = {
  width: '100%',
  height: 300, // Default, override per chart
};

/**
 * Animation configuration for chart elements
 * Smooth transitions on data updates
 */
export const animationConfig = {
  isAnimationActive: true,
  animationDuration: 600,
  animationEasing: 'ease-in-out' as const,
};

/**
 * Helper function to format large numbers in chart labels
 * 1234567 → "1.2M"
 */
export const formatChartNumber = (value: number): string => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return String(value);
};

/**
 * Helper function to format Y-axis percentages
 */
export const formatPercent = (value: number): string => {
  return `${Math.round(value)}%`;
};

/**
 * Helper function to format time values (minutes)
 * 150 → "2h 30m"
 */
export const formatMinutes = (minutes: number): string => {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

/**
 * Heatmap color intensity function
 * Returns color based on normalized value (0-1)
 */
export const getHeatmapColor = (
  intensity: number,
  isDark: boolean
): string => {
  if (isDark) {
    // Dark mode: low = #1E3A5F, high = #3B82F6
    return `rgba(59, 130, 246, ${0.08 + intensity * 0.92})`;
  }
  // Light mode: low = #EFF6FF, high = #1D4ED8
  return `rgba(29, 78, 216, ${0.08 + intensity * 0.92})`;
};

/**
 * Performance optimization: memoization helper
 * Use with useMemo for expensive chart data transformations
 */
export const useChartData = <T,>(data: T[], deps: DependencyList) => {
  return useMemo(() => data, deps);
};
