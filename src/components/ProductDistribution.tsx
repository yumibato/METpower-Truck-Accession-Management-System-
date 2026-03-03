import { useState, useEffect, useCallback } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';
import { Calendar, RotateCcw } from 'lucide-react';

interface ProductData {
  product: string;
  count: number;
  total_weight: number;
}

interface ProductDistributionProps {
  onViewSource?: () => void;
}

const PALETTE = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
  '#06b6d4', '#a855f7', '#e11d48', '#65a30d', '#0284c7',
];



export default function ProductDistribution({ onViewSource: _onViewSource }: ProductDistributionProps) {
  const [data, setData] = useState<ProductData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateRangeReady, setDateRangeReady] = useState(() => {
    try {
      const s = localStorage.getItem('products-startDate');
      const e = localStorage.getItem('products-endDate');
      return !!(s && JSON.parse(s) && e && JSON.parse(e));
    } catch { return false; }
  });
  const [startDate, setStartDate] = usePersistentState('products-startDate', '');
  const [endDate, setEndDate] = usePersistentState('products-endDate', '');
  const [metric, setMetric] = useState<'count' | 'weight'>('count');
  const [activeIdx, setActiveIdx] = useState<number | undefined>(undefined);



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
      const res = await fetch(`/api/analytics/product-distribution?${params}`);
      if (!res.ok) throw new Error('Failed to fetch data');
      setData(await res.json());
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load product distribution');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    if (dateRangeReady) fetchData();
  }, [dateRangeReady, fetchData]);

  const totalCount  = data.reduce((s, d) => s + d.count, 0);
  const totalWeight = data.reduce((s, d) => s + (d.total_weight || 0), 0);

  const maxVal = Math.max(...data.map((d) => (metric === 'count' ? d.count : d.total_weight || 0)), 1);

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
          <div className="bg-white dark:bg-midnight-900 rounded-xl p-4 border border-gray-200 dark:border-midnight-600 shadow-sm" style={{ borderLeft: '3px solid #8b5cf6' }}>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">Unique Products</p>
            <p className="text-2xl font-bold text-purple-500 tabular-nums">{data.length}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">distinct types</p>
          </div>
          <div className="bg-white dark:bg-midnight-900 rounded-xl p-4 border border-gray-200 dark:border-midnight-600 shadow-sm" style={{ borderLeft: '3px solid #3b82f6' }}>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">Total Transactions</p>
            <p className="text-2xl font-bold text-blue-500 tabular-nums">{totalCount.toLocaleString()}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">trips recorded</p>
          </div>
          <div className="bg-white dark:bg-midnight-900 rounded-xl p-4 border border-gray-200 dark:border-midnight-600 shadow-sm" style={{ borderLeft: '3px solid #10b981' }}>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">Total Gross Weight</p>
            <p className="text-2xl font-bold text-emerald-500 tabular-nums">
              {(totalWeight / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} t
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{totalWeight.toLocaleString()} kg</p>
          </div>
        </div>
      )}

      {/* ── Main panel ─────────────────────────────────────── */}
      <div className="bg-white dark:bg-midnight-900 rounded-xl border border-gray-200 dark:border-midnight-600 shadow-sm overflow-hidden">

        {/* Panel header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-midnight-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Distribution by Product</h3>
          {/* Metric toggle */}
          <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-midnight-600 text-xs font-medium">
            {(['count', 'weight'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={`px-3 py-1.5 transition-colors ${
                  metric === m
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-midnight-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-midnight-700'
                }`}
              >
                {m === 'count' ? 'Trips' : 'Weight'}
              </button>
            ))}
          </div>
        </div>

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
          <div className="p-6 space-y-1">

            {/* Column headers */}
            <div className="flex items-center gap-3 pb-2 border-b border-gray-100 dark:border-midnight-700 mb-3">
              <div className="w-3 flex-shrink-0" />
              <div className="flex-1 text-xs font-semibold text-gray-400 dark:text-enterprise-muted uppercase tracking-wider">Product</div>
              <div className="w-28 text-right text-xs font-semibold text-gray-400 dark:text-enterprise-muted uppercase tracking-wider">Trips</div>
              <div className="w-28 text-right text-xs font-semibold text-gray-400 dark:text-enterprise-muted uppercase tracking-wider">Gross Weight</div>
              <div className="w-20 text-right text-xs font-semibold text-gray-400 dark:text-enterprise-muted uppercase tracking-wider">Share</div>
            </div>

            {/* Combined bar + stats rows */}
            {data.map((row, idx) => {
              const metricVal = metric === 'count' ? row.count : row.total_weight || 0;
              const fillPct   = maxVal > 0 ? (metricVal / maxVal) * 100 : 0;
              const share     = totalCount > 0 ? (row.count / totalCount) * 100 : 0;
              const color     = PALETTE[idx % PALETTE.length];
              const isActive  = activeIdx === idx;

              return (
                <div
                  key={row.product}
                  className={`rounded-lg px-3 py-3 transition-colors cursor-default ${
                    isActive
                      ? 'bg-gray-50 dark:bg-midnight-800/70'
                      : 'hover:bg-gray-50 dark:hover:bg-midnight-800/40'
                  }`}
                  onMouseEnter={() => setActiveIdx(idx)}
                  onMouseLeave={() => setActiveIdx(undefined)}
                >
                  {/* ── Top row: dot · name · stats ── */}
                  <div className="flex items-center gap-3">
                    {/* Rank dot */}
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />

                    {/* Product name */}
                    <span
                      className="flex-1 text-sm font-semibold text-gray-800 dark:text-gray-200 truncate"
                      title={row.product}
                    >
                      {row.product}
                    </span>

                    {/* Trips */}
                    <span className="w-28 text-right text-sm tabular-nums text-gray-700 dark:text-gray-300">
                      {row.count.toLocaleString()}
                      <span className="ml-1 text-xs text-gray-400 dark:text-enterprise-muted">trips</span>
                    </span>

                    {/* Weight */}
                    <span className="w-28 text-right text-sm tabular-nums text-gray-700 dark:text-gray-300">
                      {row.total_weight
                        ? `${(row.total_weight / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} t`
                        : '—'}
                    </span>

                    {/* Share badge */}
                    <span
                      className="w-20 text-right text-xs font-bold tabular-nums"
                      style={{ color }}
                    >
                      {share.toFixed(1)}%
                    </span>
                  </div>

                  {/* ── Bar row ── */}
                  <div className="mt-2 ml-6 h-2 rounded-full bg-gray-100 dark:bg-midnight-700 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${fillPct}%`,
                        backgroundColor: color,
                        opacity: isActive ? 1 : 0.75,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
