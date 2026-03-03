import { useState, useEffect, useCallback } from 'react';
import { usePersistentState } from '../../hooks/usePersistentState';
import { Calendar, RotateCcw } from 'lucide-react';

interface StatusRow { status: string; count: number; }

const STATUS_COLORS: Record<string, string> = {
  Completed: '#10b981',
  Pending:   '#f59e0b',
  Rejected:  '#ef4444',
  Unknown:   '#9ca3af',
};
const DEFAULT_COLOR = '#6366f1';

function getColor(s: string) {
  return STATUS_COLORS[s] ?? DEFAULT_COLOR;
}

export default function StatusBreakdown() {
  const [data, setData]               = useState<StatusRow[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [startDate, setStartDate]     = usePersistentState('analytics-status-startDate', '');
  const [endDate, setEndDate]         = usePersistentState('analytics-status-endDate', '');
  const [dateReady, setDateReady]     = useState(() => !!(startDate && endDate));

  useEffect(() => {
    if (startDate && endDate) { setDateReady(true); return; }
    (async () => {
      try {
        const r = await fetch('/api/analytics/transac-date-range');
        const { minDate, maxDate } = await r.json();
        const today = new Date().toISOString().split('T')[0];
        setStartDate(minDate || today);
        setEndDate(maxDate || today);
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
      const r = await fetch(`/api/analytics/status-breakdown?startDate=${startDate}&endDate=${endDate}`);
      if (!r.ok) throw new Error('Failed');
      setData(await r.json()); setError('');
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [startDate, endDate]);

  useEffect(() => { if (dateReady) fetchData(); }, [dateReady, fetchData]);

  const total = data.reduce((s, d) => s + d.count, 0);

  // Build conic-gradient from data
  const conicSegments = (() => {
    let acc = 0;
    return data.map(d => {
      const pct = total > 0 ? (d.count / total) * 100 : 0;
      const seg = { color: getColor(d.status), from: acc, to: acc + pct };
      acc += pct;
      return seg;
    });
  })();

  const conicGradient = conicSegments.length
    ? `conic-gradient(${conicSegments.map(s => `${s.color} ${s.from.toFixed(2)}% ${s.to.toFixed(2)}%`).join(', ')})`
    : 'conic-gradient(#e5e7eb 0% 100%)';

  return (
    <div className="space-y-6">
      {/* Filter bar */}
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
          <button
            onClick={async () => { try { const r = await fetch('/api/analytics/transac-date-range'); const { minDate, maxDate } = await r.json(); const today = new Date().toISOString().split('T')[0]; setStartDate(minDate || today); setEndDate(maxDate || today); } catch { const today = new Date().toISOString().split('T')[0]; setStartDate(today); setEndDate(today); } }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-midnight-800 transition-colors">
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        </div>
      </div>

      {/* Panel */}
      <div className="bg-white dark:bg-midnight-900 rounded-xl border border-gray-200 dark:border-midnight-600 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-midnight-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Transaction Status Breakdown</h3>
        </div>

        {loading ? (
          <div className="h-72 flex flex-col items-center justify-center gap-3">
            <div className="animate-spin rounded-full h-7 w-7 border-2 border-blue-500 border-t-transparent" />
            <p className="text-xs text-gray-400 dark:text-gray-500">Loading…</p>
          </div>
        ) : error ? (
          <div className="h-72 flex items-center justify-center"><p className="text-sm text-red-500">{error}</p></div>
        ) : data.length === 0 ? (
          <div className="h-72 flex items-center justify-center"><p className="text-sm text-gray-400 dark:text-gray-500">No data for selected range.</p></div>
        ) : (
          <div className="p-6 flex flex-col lg:flex-row gap-8 items-center">

            {/* CSS Donut */}
            <div className="flex-shrink-0 flex flex-col items-center gap-3">
              <div className="relative" style={{ width: 180, height: 180 }}>
                <div
                  className="w-full h-full rounded-full"
                  style={{ background: conicGradient }}
                />
                {/* Hole */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="bg-white dark:bg-midnight-900 rounded-full flex flex-col items-center justify-center"
                    style={{ width: 104, height: 104 }}>
                    <span className="text-2xl font-bold text-gray-900 dark:text-gray-100 leading-none">
                      {total.toLocaleString()}
                    </span>
                    <span className="text-xs text-gray-400 mt-0.5">total</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Status cards */}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 w-full">
              {data.map(row => {
                const pct = total > 0 ? (row.count / total * 100) : 0;
                const color = getColor(row.status);
                return (
                  <div key={row.status}
                    className="rounded-xl border border-gray-100 dark:border-midnight-700 p-4 flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{row.status}</span>
                    </div>
                    <div className="flex items-end justify-between">
                      <span className="text-3xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                        {row.count.toLocaleString()}
                      </span>
                      <span className="text-sm font-bold tabular-nums" style={{ color }}>{pct.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 dark:bg-midnight-700 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
