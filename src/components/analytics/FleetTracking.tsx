import { useState, useEffect, useCallback } from 'react';
import { usePersistentState } from '../../hooks/usePersistentState';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Calendar, RotateCcw, Bot } from 'lucide-react';
import { useDarkMode } from '../../hooks/useDarkMode';

interface Row { year: number; month: number; total_vehicles: number; new_vehicles: number; returning_vehicles: number; }

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function FleetTracking() {
  const isDark = useDarkMode();
  const [data, setData]           = useState<Row[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [startDate, setStartDate] = usePersistentState('analytics-fleet-startDate', '');
  const [endDate, setEndDate]     = usePersistentState('analytics-fleet-endDate', '');
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
      const r = await fetch(`/api/analytics/fleet-tracking?startDate=${startDate}&endDate=${endDate}`);
      if (!r.ok) throw new Error('Failed');
      setData(await r.json()); setError('');
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [startDate, endDate]);

  useEffect(() => { if (dateReady) fetchData(); }, [dateReady, fetchData]);

  const chartData = data.map(d => ({
    ...d,
    label: `${MONTH_SHORT[d.month - 1]} ${d.year}`,
  }));

  const totalNew = data.reduce((s, d) => s + d.new_vehicles, 0);
  const totalAll = data.reduce((s, d) => s + d.total_vehicles, 0);

  const axisColor  = isDark ? '#9ca3af' : '#6b7280';
  const gridColor  = isDark ? '#374151' : '#e5e7eb';
  const tooltipBg  = isDark ? '#1e2433' : '#ffffff';
  const tooltipBdr = isDark ? '#374151' : '#d1d5db';
  const tooltipTxt = isDark ? '#f3f4f6' : '#111827';

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
            { label: 'Total Unique Vehicles', value: totalAll.toLocaleString(), color: '#6366f1' },
            { label: 'New Vehicles (first-time)', value: totalNew.toLocaleString(), color: '#10b981' },
            { label: 'Returning Rate', value: totalAll > 0 ? `${(((totalAll - totalNew) / totalAll) * 100).toFixed(1)}%` : '—', color: '#3b82f6' },
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
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">New vs Returning Vehicles Over Time</h3>
            <p className="text-xs text-gray-400 dark:text-enterprise-muted mt-0.5">Monthly distinct plates — green = first-time vehicles, blue = returning (seen in a previous month).</p>
          </div>
          <button
            onClick={() => {
              const totalNew = data.reduce((s, d) => s + d.new_vehicles, 0);
              const totalReturning = data.reduce((s, d) => s + d.returning_vehicles, 0);
              const latest = data.length ? data[data.length - 1] : null;
              const latestLabel = latest ? `${MONTH_SHORT[latest.month - 1]} ${latest.year}: ${latest.new_vehicles} new, ${latest.returning_vehicles} returning` : 'n/a';
              window.dispatchEvent(new CustomEvent('explain-chart', { detail: { message: `Explain the New vs Returning Vehicles chart (${startDate} to ${endDate}). Total new vehicles across period: ${totalNew}. Total returning: ${totalReturning}. Latest month: ${latestLabel}. Is the fleet growing or declining, what does the new-to-returning ratio mean for fleet health, are there months with unusual spikes in new vehicles, and what does this mean for operations?` } }));
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
          <div className="h-80 flex items-center justify-center"><p className="text-sm text-gray-400 dark:text-gray-500">No data.</p></div>
        ) : (
          <div className="p-6">
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={chartData} margin={{ top: 4, right: 20, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="newGrad"  x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="retGrad"  x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: axisColor, fontSize: 11 }} tickLine={false} axisLine={{ stroke: gridColor }}
                  interval={Math.max(0, Math.floor(chartData.length / 8) - 1)} />
                <YAxis tick={{ fill: axisColor, fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBdr}`, borderRadius: 8, color: tooltipTxt, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                  labelStyle={{ color: tooltipTxt, fontWeight: 600 }}
                  formatter={(v: any, name: string) => {
                    if (name === 'new_vehicles')       return [`${v} plates`, 'New Vehicles'];
                    if (name === 'returning_vehicles')  return [`${v} plates`, 'Returning Vehicles'];
                    if (name === 'total_vehicles')      return [`${v} plates`, 'Total Vehicles'];
                    return [v, name];
                  }}
                />
                <Legend
                  formatter={(value) => {
                    const lbl = value === 'new_vehicles' ? 'New Vehicles' : value === 'returning_vehicles' ? 'Returning Vehicles' : value;
                    return <span style={{ color: axisColor, fontSize: 12 }}>{lbl}</span>;
                  }}
                />
                <Area type="monotone" dataKey="returning_vehicles" name="returning_vehicles"
                  stroke="#3b82f6" strokeWidth={2} fill="url(#retGrad)" dot={false} activeDot={{ r: 5 }} />
                <Area type="monotone" dataKey="new_vehicles" name="new_vehicles"
                  stroke="#10b981" strokeWidth={2} fill="url(#newGrad)" dot={false} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
