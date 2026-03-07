import { useState, useEffect, useCallback } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Calendar, Clock, RotateCcw, Bot } from 'lucide-react';
import InfoDrawer from './InfoDrawer';
import { ChartCard } from './ChartCard';
import { VisualizationDataUnion } from '../types/VisualizationData';
import {
  chartGridConfig,
  chartXAxisConfig,
  chartYAxisConfig,
  chartTooltipConfig,
  chartTooltipConfigDark,
  chartLegendConfig,
} from '../utils/chartConfig';

function useDarkMode() {
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains('dark')
  );
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('dark'));
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return isDark;
}

interface WeightData {
  transac_date: string;
  gross_weight: number;
  net_weight: number;
  tare_weight: number;
  count: number;
}

interface WeightTrendsProps {
  onViewSource?: () => void;
}

export default function WeightTrends({ onViewSource }: WeightTrendsProps) {
  const isDark = useDarkMode();
  const [data, setData] = useState<WeightData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedData, setSelectedData] = useState<VisualizationDataUnion | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Date/Time Range State — persisted across refreshes
  const [startDate, setStartDate] = usePersistentState<string>('weighttrends-startDate', '');
  const [endDate, setEndDate] = usePersistentState<string>('weighttrends-endDate', '');
  const [startTime, setStartTime] = usePersistentState<string>('weighttrends-startTime', '00:00');
  const [endTime, setEndTime] = usePersistentState<string>('weighttrends-endTime', '23:59');
  const [dateRangeReady, setDateRangeReady] = useState(() => !!(startDate && endDate));

  // Fetch min/max dates from the database on mount
  useEffect(() => {
    if (startDate && endDate) { setDateRangeReady(true); return; }
    (async () => {
      try {
        const res = await fetch('/api/analytics/transac-date-range');
        if (!res.ok) throw new Error('Failed to fetch date range');
        const { minDate, maxDate } = await res.json();
        const today = new Date().toISOString().split('T')[0];
        setStartDate(minDate || today);
        setEndDate(maxDate || today);
      } catch {
        const today = new Date().toISOString().split('T')[0];
        setStartDate(today);
        setEndDate(today);
      } finally {
        setDateRangeReady(true);
      }
    })();
  }, []);

  const fetchWeightTrends = useCallback(async () => {
    if (!startDate || !endDate) return;
    try {
      setLoading(true);
      const params = new URLSearchParams({ startDate, endDate, startTime, endTime });
      const response = await fetch(`/api/analytics/weight-trends?${params}`);
      if (!response.ok) throw new Error('Failed to fetch weight trends');
      const result = await response.json();
      setData(result);
      setError('');
    } catch (err: any) {
      console.error('Error fetching weight trends:', err);
      setError(err.message || 'Failed to load weight trends');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, startTime, endTime]);

  // Fetch chart data only after date range is populated from DB
  useEffect(() => {
    if (dateRangeReady) fetchWeightTrends();
  }, [dateRangeReady, fetchWeightTrends]);

  const handleChartClick = (point: any) => {
    setSelectedDate(point.transac_date);
    const transformedData: VisualizationDataUnion = {
      type: 'weight',
      timestamp: point.transac_date,
      date: point.transac_date,
      totalTonnage: point.gross_weight ?? 0,
      busiestHour: '',
      hourlyBreakdown: [],
      topSuppliers: [],
      truckCount: point.count ?? 0,
      source: 'transac',
      sourceId: point.count,
    };
    setSelectedData(transformedData);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStartDate(e.target.value);
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEndDate(e.target.value);
  };

  return (
    <div className="space-y-6">
      {/* ── Filter bar ── */}
      <div className="bg-white dark:bg-midnight-900 rounded-xl border border-gray-200 dark:border-midnight-600 shadow-sm">
        <div className="px-5 py-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-midnight-800 text-xs">
            <Calendar className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
            <input type="date" value={startDate} onChange={handleDateChange}
              className="bg-transparent text-xs focus:outline-none text-gray-800 dark:text-gray-200" />
            <span className="text-gray-400 dark:text-gray-600 select-none">–</span>
            <input type="date" value={endDate} onChange={handleEndDateChange}
              className="bg-transparent text-xs focus:outline-none text-gray-800 dark:text-gray-200" />
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-midnight-800 text-xs">
            <Clock className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
              className="bg-transparent text-xs focus:outline-none text-gray-800 dark:text-gray-200 w-16" />
            <span className="text-gray-400 dark:text-gray-600 select-none">–</span>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
              className="bg-transparent text-xs focus:outline-none text-gray-800 dark:text-gray-200 w-16" />
          </div>
          <button onClick={fetchWeightTrends}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm">
            Apply
          </button>
          <button onClick={async () => { try { const r = await fetch('/api/analytics/transac-date-range'); const { minDate, maxDate } = await r.json(); const today = new Date().toISOString().split('T')[0]; setStartDate(minDate || today); setEndDate(maxDate || today); setStartTime('00:00'); setEndTime('23:59'); } catch { const today = new Date().toISOString().split('T')[0]; setStartDate(today); setEndDate(today); setStartTime('00:00'); setEndTime('23:59'); } }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-midnight-800 transition-colors">
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        </div>
      </div>

      {/* Chart */}
      <ChartCard title="Daily Weight Trends">
        {loading ? (
          <div className="h-72 flex flex-col items-center justify-center gap-3">
            <div className="animate-spin rounded-full h-7 w-7 border-2 border-blue-500 border-t-transparent" />
            <p className="text-xs text-text-muted dark:text-dark-text-muted">Loading weight trends…</p>
          </div>
        ) : error ? (
          <div className="h-72 flex items-center justify-center">
            <p className="text-sm text-state-red dark:text-dark-state-red">{error}</p>
          </div>
        ) : data.length === 0 ? (
          <div className="h-72 flex items-center justify-center">
            <p className="text-sm text-text-muted dark:text-dark-text-muted">No data available for selected date range.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={data} margin={{ top: 8, right: 16, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradTonnage" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor='var(--chart-blue)' stopOpacity={0.15} />
                  <stop offset="100%" stopColor='var(--chart-blue)' stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradAvg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor='var(--chart-green)' stopOpacity={0.12} />
                  <stop offset="100%" stopColor='var(--chart-green)' stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...chartGridConfig} />
              <XAxis
                {...chartXAxisConfig}
                dataKey="transac_date"
                tickFormatter={(val) => {
                  const d = new Date(val);
                  return `${d.getMonth() + 1}/${d.getDate()}`;
                }}
              />
              <Tooltip
                {...(isDark ? chartTooltipConfigDark : chartTooltipConfig)}
                labelFormatter={(label) => {
                  const d = new Date(label);
                  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
                }}
                formatter={(value, name) => [
                  `${(value as number).toLocaleString()} kg`,
                  name === 'gross_weight' ? 'Gross' : name === 'net_weight' ? 'Net' : 'Tare'
                ]}
              />
              <Legend {...chartLegendConfig} />
              
              {/* Total Tonnage */}
              <Area
                dataKey="gross_weight"
                name="Gross Weight"
                stroke='var(--chart-blue)'
                strokeWidth={2}
                fill='url(#gradTonnage)'
                dot={false}
                activeDot={{ r: 5, fill: 'var(--chart-blue)', stroke: 'var(--bg-card)', strokeWidth: 2 }}
                onClick={(state: any) => state?.payload && handleChartClick(state.payload)}
              />
              
              {/* Average Weight */}
              <Area
                dataKey="net_weight"
                name="Net Weight"
                stroke='var(--chart-green)'
                strokeWidth={2}
                fill='url(#gradAvg)'
                dot={false}
                activeDot={{ r: 5, fill: 'var(--chart-green)', stroke: 'var(--bg-card)', strokeWidth: 2 }}
                onClick={(state: any) => state?.payload && handleChartClick(state.payload)}
              />
              
              {/* Highlight selected date */}
              {selectedDate && (
                <ReferenceLine x={selectedDate} stroke='var(--chart-blue)' strokeDasharray='3 3' strokeWidth={1.5} />
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Info Drawer */}
      {selectedData && (
        <InfoDrawer
          isOpen={true}
          data={selectedData}
          onClose={() => setSelectedData(null)}
          onViewSource={onViewSource}
        />
      )}
    </div>
  );
}
