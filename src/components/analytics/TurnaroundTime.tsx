import { useState, useEffect, useCallback } from 'react';
import { usePersistentState } from '../../hooks/usePersistentState';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { Calendar, RotateCcw, Bot } from 'lucide-react';
import { useDarkMode } from '../../hooks/useDarkMode';

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

  const axisColor  = isDark ? '#9ca3af' : '#6b7280';
  const gridColor  = isDark ? '#374151' : '#e5e7eb';
  const tooltipBg  = isDark ? '#1e2433' : '#ffffff';
  const tooltipBdr = isDark ? '#374151' : '#d1d5db';
  const tooltipTxt = isDark ? '#f3f4f6' : '#111827';

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
            { label: 'Average Turnaround', value: fmtMins(overallAvg), color: '#3b82f6' },
            { label: 'Fastest Day', value: fastestDay ? `${fmtDate(fastestDay.transac_date)} (${fmtMins(fastestDay.avg_minutes)})` : '—', color: '#10b981' },
            { label: 'Slowest Day',  value: slowestDay ? `${fmtDate(slowestDay.transac_date)} (${fmtMins(slowestDay.avg_minutes)})` : '—', color: '#ef4444' },
          ].map(c => (
            <div key={c.label} className="bg-white dark:bg-midnight-900 rounded-xl p-4 border border-gray-200 dark:border-midnight-600 shadow-sm" style={{ borderLeft: `3px solid ${c.color}` }}>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">{c.label}</p>
              <p className="text-2xl font-bold tabular-nums" style={{ color: c.color }}>{c.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white dark:bg-midnight-900 rounded-xl border border-gray-200 dark:border-midnight-600 shadow-sm overflow-hidden">
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100 dark:border-midnight-700">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Average Turnaround Time per Day</h3>
            <p className="text-xs text-gray-400 dark:text-enterprise-muted mt-0.5">Time between inbound and outbound timestamps. Only days with valid timestamps shown.</p>
          </div>
          <button
            onClick={() => {
              const avgTAT = data.length ? (data.reduce((s, d) => s + d.avg_minutes, 0) / data.length).toFixed(1) : 'n/a';
              const worst = data.length ? data.reduce((a, b) => b.avg_minutes > a.avg_minutes ? b : a) : null;
              const worstLabel = worst ? `${worst.transac_date} (${worst.avg_minutes.toFixed(1)} min)` : 'n/a';
              window.dispatchEvent(new CustomEvent('explain-chart', { detail: { message: `Explain the Average Turnaround Time chart (${startDate} to ${endDate}). Overall average TAT: ${avgTAT} minutes. Worst day: ${worstLabel}. Is the turnaround time acceptable for a waste processing facility, what days show bottlenecks, what is causing the spikes, and what operational changes could reduce turnaround times?` } }));
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-800/50 hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors shrink-0 ml-3"
            title="Ask AI to explain this chart"
          >
            <Bot className="w-3.5 h-3.5" /> Explain
          </button>
        </div>

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
          <div className="p-6">
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={chartData} margin={{ top: 4, right: 20, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="turnGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: axisColor, fontSize: 11 }} tickLine={false} axisLine={{ stroke: gridColor }}
                  interval={Math.max(0, Math.floor(chartData.length / 8) - 1)} />
                <YAxis tickFormatter={fmtMins} tick={{ fill: axisColor, fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBdr}`, borderRadius: 8, color: tooltipTxt, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                  labelStyle={{ color: tooltipTxt, fontWeight: 600 }}
                  formatter={(v: any, name: string) => {
                    if (name === 'avg_minutes') return [fmtMins(v), 'Avg Turnaround'];
                    if (name === 'trips') return [`${v} trips`, 'Trips'];
                    return [v, name];
                  }}
                />
                {overallAvg > 0 && (
                  <ReferenceLine y={Math.round(overallAvg)} stroke="#f59e0b" strokeDasharray="4 4"
                    label={{ value: `Avg: ${fmtMins(overallAvg)}`, fill: '#f59e0b', fontSize: 11, position: 'right' }} />
                )}
                <Area type="monotone" dataKey="avg_minutes" name="avg_minutes"
                  stroke="#6366f1" strokeWidth={2.5} fill="url(#turnGrad)" dot={false} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
