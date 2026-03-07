import { useState, useEffect, useCallback } from 'react';
import { usePersistentState } from '../../hooks/usePersistentState';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { Calendar, RotateCcw } from 'lucide-react';
import { useDarkMode } from '../../hooks/useDarkMode';
import { ChartCard } from '../ChartCard';
import { chartGridConfig, chartXAxisConfig, chartTooltipConfig, chartTooltipConfigDark } from '../../utils/chartConfig';

interface Row {
  transac_date: string;
  avg_minutes: number;
  min_minutes: number;
  max_minutes: number;
  trips: number;
}

function fmtDate(d: string) {
  const dt = new Date(d);
  return `${dt.toLocaleString('default', { month: 'short' })} ${dt.getDate()}`;
}
function fmtMins(m: number) {
  if (m < 60) return `${Math.round(m)} min`;
  const h = Math.floor(m / 60); const rm = Math.round(m % 60);
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
}

export default function TurnaroundTime() {
  const isDark = useDarkMode();
  const [data, setData]           = useState<Row[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [startDate, setStartDate] = usePersistentState('analytics-turnaround-startDate', '');
  const [endDate, setEndDate]     = usePersistentState('analytics-turnaround-endDate', '');
  const [dateReady, setDateReady] = useState(() => !!(startDate && endDate));

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
      const r = await fetch(`/api/analytics/turnaround-time?startDate=${startDate}&endDate=${endDate}`);
      if (!r.ok) throw new Error('Failed');
      setData(await r.json()); setError('');
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [startDate, endDate]);

  useEffect(() => { if (dateReady) fetchData(); }, [dateReady, fetchData]);

  const overallAvg = data.length > 0 ? data.reduce((s, d) => s + d.avg_minutes, 0) / data.length : 0;

  const chartData = data.map(d => ({
    ...d,
    label: fmtDate(d.transac_date),
    avg_minutes: Math.round(d.avg_minutes),
  }));

  // Summary cards
  const fastestDay = data.reduce((a, b) => a.avg_minutes < b.avg_minutes ? a : b, data[0]);
  const slowestDay = data.reduce((a, b) => a.avg_minutes > b.avg_minutes ? a : b, data[0]);

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

      {!loading && !error && data.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Average Turnaround', value: fmtMins(overallAvg), color: 'var(--chart-blue)' },
            { label: 'Fastest Day', value: fastestDay ? `${fmtDate(fastestDay.transac_date)} (${fmtMins(fastestDay.avg_minutes)})` : '—', color: 'var(--chart-green)' },
            { label: 'Slowest Day',  value: slowestDay ? `${fmtDate(slowestDay.transac_date)} (${fmtMins(slowestDay.avg_minutes)})` : '—', color: 'var(--chart-red)' },
          ].map(c => (
            <div key={c.label} className="bg-white dark:bg-midnight-900 rounded-xl p-4 border border-gray-200 dark:border-midnight-600 shadow-sm" style={{ borderLeft: `3px solid ${c.color}` }}>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">{c.label}</p>
              <p className="text-2xl font-bold tabular-nums" style={{ color: c.color }}>{c.value}</p>
            </div>
          ))}
        </div>
      )}

      <ChartCard title="Average Turnaround Time per Day">
        {loading ? (
          <div className="h-80 flex flex-col items-center justify-center gap-3">
            <div className="animate-spin rounded-full h-7 w-7 border-2 border-blue-500 border-t-transparent" />
            <p className="text-xs text-gray-400 dark:text-gray-500">Loading…</p>
          </div>
        ) : error ? (
          <div className="h-80 flex items-center justify-center"><p className="text-sm text-red-500">{error}</p></div>
        ) : data.length === 0 ? (
          <div className="h-80 flex flex-col items-center justify-center text-gray-400 text-sm gap-2">
            <span>No turnaround data found.</span>
            <span className="text-xs">This requires valid inbound and outbound timestamps in the database.</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={chartData} margin={{ top: 4, right: 20, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="turnGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor='var(--chart-indigo)' stopOpacity={0.25} />
                  <stop offset="95%" stopColor='var(--chart-indigo)' stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...chartGridConfig} />
              <XAxis {...chartXAxisConfig} dataKey="label" interval={Math.max(0, Math.floor(chartData.length / 8) - 1)} />
              <YAxis hide />
              <Tooltip {...(isDark ? chartTooltipConfigDark : chartTooltipConfig)}
                formatter={(v: any, name: string) => {
                  if (name === 'avg_minutes') return [fmtMins(v), 'Avg'];
                  if (name === 'max_minutes') return [fmtMins(v), 'Slowest'];
                  if (name === 'min_minutes') return [fmtMins(v), 'Fastest'];
                  return [v, name];
                }} />
              {overallAvg > 0 && (
                <ReferenceLine y={Math.round(overallAvg)} stroke='var(--chart-amber)' strokeDasharray="6 3" strokeWidth={1.5}
                  label={{ value: `Avg: ${fmtMins(overallAvg)}`, fill: 'var(--chart-amber)', fontSize: 10, fontWeight: 600, position: 'right' }} />
              )}
              {/* Slowest day range */}
              <Area type="monotone" dataKey="max_minutes" name="max_minutes"
                stroke='var(--chart-red)' strokeWidth={1.5} strokeDasharray="4 3"
                fill="none" dot={false} legendType="none" />
              {/* Fastest day range */}
              <Area type="monotone" dataKey="min_minutes" name="min_minutes"
                stroke='var(--chart-green)' strokeWidth={1.5} strokeDasharray="4 3"
                fill="none" dot={false} legendType="none" />
              {/* Average turnaround */}
              <Area type="monotone" dataKey="avg_minutes" name="avg_minutes"
                stroke='var(--chart-indigo)' strokeWidth={2.5} fill="url(#turnGrad)" dot={false} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}
