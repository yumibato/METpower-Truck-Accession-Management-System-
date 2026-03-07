import { useState, useEffect, useCallback } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { Calendar, RotateCcw, Bot } from 'lucide-react';
import { ChartCard } from './ChartCard';
import { chartGridConfig, chartXAxisConfig, chartTooltipConfig, chartTooltipConfigDark } from '../utils/chartConfig';

interface VolumeData {
  transac_date: string;
  count: number;
}

interface TransactionVolumeProps {
  onViewSource?: () => void;
}

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

// Chart colors - use CSS variables for consistency
const CHART_COLORS = [
  'var(--chart-blue)', 'var(--chart-indigo)', 'var(--chart-purple)',
  'var(--chart-pink)', 'var(--chart-red)', 'var(--chart-amber)',
  'var(--chart-teal)', 'var(--chart-green)',
];

export default function TransactionVolume({ onViewSource: _onViewSource }: TransactionVolumeProps) {
  const isDark = useDarkMode();
  const [data, setData] = useState<VolumeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateRangeReady, setDateRangeReady] = useState(() => {
    try {
      const s = localStorage.getItem('volume-startDate');
      const e = localStorage.getItem('volume-endDate');
      return !!(s && JSON.parse(s) && e && JSON.parse(e));
    } catch { return false; }
  });
  const [startDate, setStartDate] = usePersistentState('volume-startDate', '');
  const [endDate, setEndDate] = usePersistentState('volume-endDate', '');

  // Init date range from DB
  useEffect(() => {
    if (startDate && endDate) { setDateRangeReady(true); return; }
    (async () => {
      try {
        const res = await fetch('/api/analytics/transac-date-range');
        if (!res.ok) throw new Error();
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

  const fetchData = useCallback(async () => {
    if (!startDate || !endDate) return;
    try {
      setLoading(true);
      const params = new URLSearchParams({ startDate, endDate });
      const res = await fetch(`/api/analytics/transaction-volume?${params}`);
      if (!res.ok) throw new Error('Failed to fetch data');
      setData(await res.json());
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load transaction volume');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    if (dateRangeReady) fetchData();
  }, [dateRangeReady, fetchData]);

  const totalTransactions = data.reduce((s, d) => s + d.count, 0);
  const peakDay = data.length ? data.reduce((a, b) => (a.count > b.count ? a : b)) : null;

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <div className="bg-white dark:bg-midnight-900 rounded-xl border border-gray-200 dark:border-midnight-600 shadow-sm">
        <div className="px-5 py-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-midnight-800 text-xs">
            <Calendar className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-xs focus:outline-none text-gray-800 dark:text-gray-200" />
            <span className="text-gray-400 dark:text-gray-600 select-none">–</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
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

      {/* Summary cards */}
      {!loading && !error && data.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white dark:bg-midnight-900 rounded-xl p-4 border border-gray-200 dark:border-midnight-600 shadow-sm" style={{ borderLeft: '3px solid var(--chart-blue)' }}>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">Total Transactions</p>
            <p className="text-2xl font-bold text-blue-500 tabular-nums">{totalTransactions.toLocaleString()}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">in selected range</p>
          </div>
          <div className="bg-white dark:bg-midnight-900 rounded-xl p-4 border border-gray-200 dark:border-midnight-600 shadow-sm" style={{ borderLeft: '3px solid var(--chart-indigo)' }}>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">Days with Data</p>
            <p className="text-2xl font-bold text-indigo-500 tabular-nums">{data.length.toLocaleString()}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">active days</p>
          </div>
          <div className="bg-white dark:bg-midnight-900 rounded-xl p-4 border border-gray-200 dark:border-midnight-600 shadow-sm" style={{ borderLeft: '3px solid var(--chart-amber)' }}>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">Busiest Day</p>
            {peakDay && (
              <>
                <p className="text-2xl font-bold text-amber-500 tabular-nums">{peakDay.count.toLocaleString()} trips</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {new Date(peakDay.transac_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Chart */}
      <ChartCard title="Daily Transaction Count">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-3">
            <div className="animate-spin rounded-full h-7 w-7 border-2 border-blue-500 border-t-transparent" />
            <p className="text-xs text-gray-400 dark:text-gray-500">Loading…</p>
          </div>
        ) : error ? (
          <div className="h-64 flex items-center justify-center">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        ) : data.length === 0 ? (
          <div className="h-64 flex items-center justify-center">
            <p className="text-sm text-gray-400 dark:text-gray-500">No data for selected date range.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={data} margin={{ top: 8, right: 16, left: -20, bottom: 0 }}>
              <CartesianGrid {...chartGridConfig} />
              <XAxis
                {...chartXAxisConfig}
                dataKey="transac_date"
                tickFormatter={(val) => {
                  const d = new Date(val);
                  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
                }}
              />
              <YAxis
                hide
                allowDecimals={false}
              />
              <Tooltip
                {...(isDark ? chartTooltipConfigDark : chartTooltipConfig)}
                cursor={{ fill: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }}
                labelFormatter={(label) => {
                  const d = new Date(label);
                  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
                }}
                formatter={(value) => [`${(value as number).toLocaleString()} transactions`, 'Count']}
              />
              <Bar dataKey="count" fill='var(--chart-blue)' radius={[6, 6, 0, 0]} maxBarSize={40}>
                {data.map((entry, idx) => (
                  <Cell
                    key={idx}
                    fill={entry.count > Math.max(...data.map(d => d.count)) * 0.75 ? 'var(--chart-blue)' : 'rgba(37, 99, 235, 0.25)'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}
