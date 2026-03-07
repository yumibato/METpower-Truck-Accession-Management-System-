import { useState, useEffect, useCallback } from 'react';
import { usePersistentState } from '../../hooks/usePersistentState';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Calendar, RotateCcw } from 'lucide-react';
import { useDarkMode } from '../../hooks/useDarkMode';
import { ChartCard } from '../ChartCard';
import { chartGridConfig, chartXAxisConfig, chartTooltipConfig, chartTooltipConfigDark } from '../../utils/chartConfig';

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
            { label: 'Avg Net Payload %', value: `${avgNetPct.toFixed(1)}%`, color: 'var(--chart-green)', note: 'of gross weight is actual cargo' },
            { label: 'Avg Tare Weight %', value: `${avgTarePct.toFixed(1)}%`, color: 'var(--chart-amber)', note: 'of gross weight is vehicle/container' },
          ].map(c => (
            <div key={c.label} className="bg-white dark:bg-midnight-900 rounded-xl p-4 border border-gray-200 dark:border-midnight-600 shadow-sm" style={{ borderLeft: `3px solid ${c.color}` }}>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">{c.label}</p>
              <p className="text-2xl font-bold tabular-nums" style={{ color: c.color }}>{c.value}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{c.note}</p>
            </div>
          ))}
        </div>
      )}

      <ChartCard title="Tare vs Net Weight Ratio (% of Gross)">
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
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData} margin={{ top: 4, right: 20, left: -20, bottom: 0 }} barCategoryGap="30%">
              <CartesianGrid {...chartGridConfig} />
              <XAxis {...chartXAxisConfig} dataKey="label" interval={Math.max(0, Math.floor(chartData.length / 8) - 1)} />
              <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} hide />
              <Tooltip {...(isDark ? chartTooltipConfigDark : chartTooltipConfig)}
                formatter={(v: any, name: string) => {
                  if (name === 'net_pct')  return [`${v}%`, 'Net Payload'];
                  if (name === 'tare_pct') return [`${v}%`, 'Tare Weight'];
                  return [v, name];
                }} />
              <Legend
                formatter={(value) => {
                  const label = value === 'net_pct' ? 'Net Payload' : value === 'tare_pct' ? 'Tare Weight' : value;
                  return <span>{label}</span>;
                }} />
              <Bar dataKey="net_pct"  name="net_pct"  stackId="a" fill='var(--chart-green)' radius={[0, 0, 0, 0]} />
              <Bar dataKey="tare_pct" name="tare_pct" stackId="a" fill='var(--chart-amber)' radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}
