import { useState, useEffect, useCallback } from 'react';
import { usePersistentState } from '../../hooks/usePersistentState';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, Cell,
} from 'recharts';
import { Calendar, RotateCcw } from 'lucide-react';
import { useDarkMode } from '../../hooks/useDarkMode';
import { ChartCard } from '../ChartCard';
import { chartGridConfig, chartXAxisConfig, chartTooltipConfig, chartTooltipConfigDark } from '../../utils/chartConfig';

interface RawRow { year: number; month: number; total_weight: number; trips: number; }

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const YEAR_COLORS = ['var(--chart-blue)','var(--chart-green)','var(--chart-amber)','var(--chart-red)','var(--chart-purple)','var(--chart-pink)'];

export default function MonthlyTonnage() {
  const isDark = useDarkMode();
  const [raw, setRaw]             = useState<RawRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [startDate, setStartDate] = usePersistentState('analytics-monthly-startDate', '');
  const [endDate, setEndDate]     = usePersistentState('analytics-monthly-endDate', '');
  const [dateReady, setDateReady] = useState(() => !!(startDate && endDate));
  const [metric, setMetric]       = useState<'weight' | 'trips'>('weight');

  useEffect(() => {
    if (startDate && endDate) { setDateReady(true); return; }
    (async () => {
      try {
        const r = await fetch('/api/analytics/transac-date-range');
        const { minDate, maxDate } = await r.json();
        const today = new Date().toISOString().split('T')[0];
        setStartDate(minDate || today); setEndDate(maxDate || today);
      } catch {
        const today = new Date().toISOString().split('T')[0];
        setStartDate(today); setEndDate(today);
      } finally { setDateReady(true); }
    })();
  }, []);

  const fetchData = useCallback(async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/analytics/monthly-tonnage?startDate=${startDate}&endDate=${endDate}`);
      if (!r.ok) throw new Error('Failed');
      setRaw(await r.json()); setError('');
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [startDate, endDate]);

  useEffect(() => { if (dateReady) fetchData(); }, [dateReady, fetchData]);

  // Collect unique years
  const years = Array.from(new Set(raw.map(r => r.year))).sort();

  // Pivot to [{month: 'Jan', '2024': 500, '2025': 700}, ...]
  const pivoted = MONTH_SHORT.map((label, mi) => {
    const row: Record<string, number | string> = { month: label };
    for (const y of years) {
      const found = raw.find(r => r.year === y && r.month === mi + 1);
      row[String(y)] = found ? (metric === 'weight' ? Math.round((found.total_weight || 0) / 1000) : found.trips) : 0;
    }
    return row;
  });

  const yLabel = metric === 'weight' ? 'Tonnes (t)' : 'Trips';
  const fmtY   = (v: number) => metric === 'weight' ? `${v.toLocaleString()} t` : v.toLocaleString();
  const fmtTip = (v: number) => metric === 'weight' ? `${v.toLocaleString()} t` : `${v.toLocaleString()} trips`;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-midnight-900 rounded-xl border border-gray-200 dark:border-midnight-600 shadow-sm">
        <div className="px-5 py-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-midnight-800 text-xs">
            <Calendar className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="bg-transparent text-xs focus:outline-none text-gray-800 dark:text-gray-200" />
            <span className="text-gray-400 dark:text-gray-600 select-none">–</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="bg-transparent text-xs focus:outline-none text-gray-800 dark:text-gray-200" />
          </div>
          <button onClick={fetchData}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm">
            Apply
          </button>
          <button onClick={async () => { try { const r = await fetch('/api/analytics/transac-date-range'); const { minDate, maxDate } = await r.json(); const today = new Date().toISOString().split('T')[0]; setStartDate(minDate || today); setEndDate(maxDate || today); } catch { const today = new Date().toISOString().split('T')[0]; setStartDate(today); setEndDate(today); } }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-midnight-800 transition-colors">
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        </div>
      </div>

      <ChartCard
        title="Monthly Tonnage Comparison (Year-over-Year)"
        toggle={{
          options: [
            { label: 'Tonnage', value: 'weight' },
            { label: 'Trips', value: 'trips' }
          ],
          onChange: (v) => setMetric(v as 'weight' | 'trips'),
          current: metric
        }}>
        {loading ? (
          <div className="h-80 flex flex-col items-center justify-center gap-3">
            <div className="animate-spin rounded-full h-7 w-7 border-2 border-blue-500 border-t-transparent" />
            <p className="text-xs text-gray-400 dark:text-gray-500">Loading…</p>
          </div>
        ) : error ? (
          <div className="h-80 flex items-center justify-center"><p className="text-sm text-red-500">{error}</p></div>
        ) : raw.length === 0 ? (
          <div className="h-80 flex items-center justify-center"><p className="text-sm text-gray-400 dark:text-gray-500">No data.</p></div>
        ) : (
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={pivoted} margin={{ top: 4, right: 20, left: -20, bottom: 0 }} barCategoryGap="20%">
              <CartesianGrid {...chartGridConfig} />
              <XAxis {...chartXAxisConfig} dataKey="month" />
              <YAxis hide={false} tickFormatter={fmtY} label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: 'var(--text-secondary)', fontSize: 11, dy: 40 }} />
              <Tooltip {...(isDark ? chartTooltipConfigDark : chartTooltipConfig)} formatter={(v: any) => [fmtTip(v as number)]} />
              <Legend />
              {years.map((y, i) => (
                <Bar key={y} dataKey={String(y)} name={String(y)} fill={YEAR_COLORS[i % YEAR_COLORS.length]} radius={[3, 3, 0, 0]}>
                  {pivoted.map((_, mi) => (
                    <Cell key={mi} fill={YEAR_COLORS[i % YEAR_COLORS.length]} />
                  ))}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}
