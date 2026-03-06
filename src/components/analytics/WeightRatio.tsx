import { useState, useEffect, useCallback } from 'react';
import { usePersistentState } from '../../hooks/usePersistentState';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Calendar, RotateCcw, Bot } from 'lucide-react';
import { useDarkMode } from '../../hooks/useDarkMode';

interface Row {
  transac_date: string;
  gross: number;
  tare: number;
  net: number;
  trips: number;
}

function fmtDate(d: string) {
  const dt = new Date(d);
  return `${dt.toLocaleString('default', { month: 'short' })} ${dt.getDate()}`;
}

export default function WeightRatio() {
  const isDark = useDarkMode();
  const [data, setData]           = useState<Row[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [startDate, setStartDate] = usePersistentState('analytics-ratio-startDate', '');
  const [endDate, setEndDate]     = usePersistentState('analytics-ratio-endDate', '');
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
      const r = await fetch(`/api/analytics/weight-ratio?startDate=${startDate}&endDate=${endDate}`);
      if (!r.ok) throw new Error('Failed');
      setData(await r.json()); setError('');
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [startDate, endDate]);

  useEffect(() => { if (dateReady) fetchData(); }, [dateReady, fetchData]);

  // Compute averages for summary
  const validRows = data.filter(d => d.gross > 0);
  const avgNetPct  = validRows.length > 0
    ? validRows.reduce((s, d) => s + (d.net ?? 0) / d.gross * 100, 0) / validRows.length : 0;
  const avgTarePct = validRows.length > 0
    ? validRows.reduce((s, d) => s + (d.tare ?? 0) / d.gross * 100, 0) / validRows.length : 0;

  const chartData = data.map(d => ({
    label: fmtDate(d.transac_date),
    tare_pct:    d.gross > 0 ? Math.round((d.tare ?? 0) / d.gross * 100) : 0,
    net_pct:     d.gross > 0 ? Math.round((d.net  ?? 0) / d.gross * 100) : 0,
    gross_t: Math.round((d.gross ?? 0) / 1000),
    trips: d.trips,
  }));

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

      {!loading && !error && validRows.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: 'Avg Net Payload %', value: `${avgNetPct.toFixed(1)}%`, color: '#10b981', note: 'of gross weight is actual cargo' },
            { label: 'Avg Tare Weight %', value: `${avgTarePct.toFixed(1)}%`, color: '#f59e0b', note: 'of gross weight is vehicle/container' },
          ].map(c => (
            <div key={c.label} className="bg-white dark:bg-midnight-900 rounded-xl p-4 border border-gray-200 dark:border-midnight-600 shadow-sm" style={{ borderLeft: `3px solid ${c.color}` }}>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">{c.label}</p>
              <p className="text-2xl font-bold tabular-nums" style={{ color: c.color }}>{c.value}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{c.note}</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white dark:bg-midnight-900 rounded-xl border border-gray-200 dark:border-midnight-600 shadow-sm overflow-hidden">
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100 dark:border-midnight-700">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Tare vs Net Weight Ratio (% of Gross)</h3>
            <p className="text-xs text-gray-400 dark:text-enterprise-muted mt-0.5">Stacked at 100% — green = payload, amber = container/vehicle weight.</p>
          </div>
          <button
            onClick={() => {
              const avgTarePct = data.length ? (data.reduce((s, d) => s + (d.gross > 0 ? d.tare / d.gross * 100 : 0), 0) / data.length).toFixed(1) : 'n/a';
              const avgNetPct = data.length ? (data.reduce((s, d) => s + (d.gross > 0 ? d.net / d.gross * 100 : 0), 0) / data.length).toFixed(1) : 'n/a';
              window.dispatchEvent(new CustomEvent('explain-chart', { detail: { message: `Explain the Tare vs Net Weight Ratio chart (${startDate} to ${endDate}). Average net payload: ${avgNetPct}% of gross. Average tare (vehicle weight): ${avgTarePct}% of gross. What does this ratio indicate about payload efficiency, is the tare weight normal or excessive, are there any dates with unusual ratios, and what can be done to improve net payload yield?` } }));
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
        ) : chartData.length === 0 ? (
          <div className="h-80 flex items-center justify-center"><p className="text-sm text-gray-400 dark:text-gray-500">No data.</p></div>
        ) : (
          <div className="p-6">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chartData} margin={{ top: 4, right: 20, left: 10, bottom: 0 }} barCategoryGap="30%">
                <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: axisColor, fontSize: 11 }} tickLine={false} axisLine={{ stroke: gridColor }}
                  interval={Math.max(0, Math.floor(chartData.length / 8) - 1)} />
                <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fill: axisColor, fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBdr}`, borderRadius: 8, color: tooltipTxt, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                  labelStyle={{ color: tooltipTxt, fontWeight: 600 }}
                  formatter={(v: any, name: string) => {
                    if (name === 'net_pct')  return [`${v}%`, 'Net Payload'];
                    if (name === 'tare_pct') return [`${v}%`, 'Tare Weight'];
                    return [v, name];
                  }}
                />
                <Legend
                  formatter={(value) => {
                    const label = value === 'net_pct' ? 'Net Payload' : value === 'tare_pct' ? 'Tare Weight' : value;
                    return <span style={{ color: axisColor, fontSize: 12 }}>{label}</span>;
                  }}
                />
                <Bar dataKey="net_pct"  name="net_pct"  stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                <Bar dataKey="tare_pct" name="tare_pct" stackId="a" fill="#f59e0b" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
