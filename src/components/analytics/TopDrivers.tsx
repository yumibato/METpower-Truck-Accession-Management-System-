import { useState, useEffect, useCallback } from 'react';
import { usePersistentState } from '../../hooks/usePersistentState';
import { Calendar, RotateCcw } from 'lucide-react';
import { ChartCard } from '../ChartCard';

interface Row { driver: string; trips: number; total_weight: number; }

const PALETTE = [
  'var(--chart-blue)', 'var(--chart-green)', 'var(--chart-amber)', 'var(--chart-red)',
  'var(--chart-purple)', 'var(--chart-pink)', 'var(--chart-teal)', 'var(--chart-indigo)',
  '#84cc16', '#06b6d4', '#a855f7', '#e11d48', '#65a30d', '#0284c7', '#f59e0b',
];

export default function TopDrivers() {
  const [data, setData]           = useState<Row[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [startDate, setStartDate] = usePersistentState('analytics-drivers-startDate', '');
  const [endDate, setEndDate]     = usePersistentState('analytics-drivers-endDate', '');
  const [dateReady, setDateReady] = useState(() => !!(startDate && endDate));
  const [metric, setMetric]       = useState<'weight' | 'trips'>('weight');
  const [activeIdx, setActiveIdx] = useState<number | undefined>(undefined);

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
      const r = await fetch(`/api/analytics/top-drivers?startDate=${startDate}&endDate=${endDate}&limit=15`);
      if (!r.ok) throw new Error('Failed');
      setData(await r.json()); setError('');
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [startDate, endDate]);

  useEffect(() => { if (dateReady) fetchData(); }, [dateReady, fetchData]);

  const maxVal = Math.max(...data.map(d => metric === 'weight' ? d.total_weight : d.trips), 1);

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
        title="Top Drivers by Performance"
        toggle={{
          options: [
            { label: 'Tonnage', value: 'weight' },
            { label: 'Trips', value: 'trips' }
          ],
          onChange: (v) => setMetric(v as 'weight' | 'trips'),
          current: metric
        }}>
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-3">
            <div className="animate-spin rounded-full h-7 w-7 border-2 border-blue-500 border-t-transparent" />
            <p className="text-xs text-gray-400 dark:text-gray-500">Loading…</p>
          </div>
        ) : error ? (
          <div className="h-64 flex items-center justify-center"><p className="text-sm text-red-500">{error}</p></div>
        ) : data.length === 0 ? (
          <div className="h-64 flex items-center justify-center"><p className="text-sm text-gray-400 dark:text-gray-500">No data.</p></div>
        ) : (
          <div className="space-y-1">
            <div className="flex items-center gap-3 pb-2 border-b border-gray-100 dark:border-midnight-700 mb-3">
              <div className="w-3 flex-shrink-0" />
              <div className="w-7 text-xs font-semibold text-gray-400 dark:text-enterprise-muted">Rank</div>
              <div className="flex-1 text-xs font-semibold text-gray-400 dark:text-enterprise-muted uppercase tracking-wider">Driver</div>
              <div className="w-24 text-right text-xs font-semibold text-gray-400 dark:text-enterprise-muted">Trips</div>
              <div className="w-28 text-right text-xs font-semibold text-gray-400 dark:text-enterprise-muted">Tonnage</div>
            </div>
            {data.map((row, idx) => {
              const val    = metric === 'weight' ? row.total_weight : row.trips;
              const pct    = maxVal > 0 ? (val / maxVal) * 100 : 0;
              const color  = PALETTE[idx % PALETTE.length];
              const active = activeIdx === idx;
              return (
                <div key={row.driver}
                  className={`rounded-lg px-3 py-3 transition-colors cursor-default ${active ? 'bg-gray-50 dark:bg-midnight-800/70' : 'hover:bg-gray-50 dark:hover:bg-midnight-800/40'}`}
                  onMouseEnter={() => setActiveIdx(idx)} onMouseLeave={() => setActiveIdx(undefined)}>
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <span className="w-7 text-xs font-bold text-gray-400 dark:text-enterprise-muted">#{idx + 1}</span>
                    <span className="flex-1 text-sm font-semibold text-gray-800 dark:text-gray-200 truncate" title={row.driver}>{row.driver}</span>
                    <span className="w-24 text-right text-sm tabular-nums text-gray-700 dark:text-gray-300">{row.trips.toLocaleString()}</span>
                    <span className="w-28 text-right text-sm tabular-nums font-bold" style={{ color }}>
                      {row.total_weight ? `${(row.total_weight / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} t` : '—'}
                    </span>
                  </div>
                  <div className="mt-2 ml-10 h-2 rounded-full bg-gray-100 dark:bg-midnight-700 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color, opacity: active ? 1 : 0.75 }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ChartCard>
    </div>
  );
}