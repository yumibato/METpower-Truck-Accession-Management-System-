import { useState, useEffect, useCallback } from 'react';
import { usePersistentState } from '../../hooks/usePersistentState';
import { Calendar, RotateCcw, Bot } from 'lucide-react';
import { ChartCard } from '../ChartCard';

interface HeatCell { dow: number; hour: number; count: number; }

// SQL Server DATEPART(weekday,...) = 1=Sun, 2=Mon, ..., 7=Sat
const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function formatHour(h: number) {
  if (h === 0) return '12am';
  if (h === 12) return '12pm';
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

export default function HourlyHeatmap() {
  const [data, setData]           = useState<HeatCell[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [startDate, setStartDate] = usePersistentState('analytics-heatmap-startDate', '');
  const [endDate, setEndDate]     = usePersistentState('analytics-heatmap-endDate', '');
  const [dateReady, setDateReady] = useState(() => !!(startDate && endDate));
  const [hovered, setHovered]     = useState<{ dow: number; hour: number } | null>(null);

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
      const r = await fetch(`/api/analytics/hourly-heatmap?startDate=${startDate}&endDate=${endDate}`);
      if (!r.ok) throw new Error('Failed');
      setData(await r.json()); setError('');
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [startDate, endDate]);

  useEffect(() => { if (dateReady) fetchData(); }, [dateReady, fetchData]);

  // Build lookup: dow (1-7) × hour (0-23) → count
  const lookup = new Map<string, number>();
  let maxCount = 1;
  for (const cell of data) {
    const key = `${cell.dow}:${cell.hour}`;
    lookup.set(key, cell.count);
    if (cell.count > maxCount) maxCount = cell.count;
  }

  const getCell = (dow: number, hour: number) => lookup.get(`${dow}:${hour}`) ?? 0;

  // Get intensity colour (light blue → blue → indigo → purple)
  const cellBg = (count: number) => {
    if (count === 0) return undefined;
    const t = count / maxCount; // 0→1
    if (t < 0.25) return `rgba(59,130,246,${0.15 + t * 0.8})`;
    if (t < 0.5)  return `rgba(99,102,241,${0.35 + t * 0.6})`;
    if (t < 0.75) return `rgba(139,92,246,${0.55 + t * 0.4})`;
    return `rgba(168,85,247,${0.7 + t * 0.3})`;
  };

  const hoveredCount = hovered ? getCell(hovered.dow, hovered.hour) : 0;

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

      <ChartCard title="Hourly Traffic Heatmap">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-3">
            <div className="animate-spin rounded-full h-7 w-7 border-2 border-blue-500 border-t-transparent" />
            <p className="text-xs text-gray-400 dark:text-gray-500">Loading…</p>
          </div>
        ) : error ? (
          <div className="h-64 flex items-center justify-center"><p className="text-sm text-red-500">{error}</p></div>
        ) : (
          <div className="overflow-x-auto">
            {/* Hour labels row */}
            <div className="flex items-center gap-1 mb-2 ml-10">
              {HOURS.map(h => (
                <div key={h} className="flex-1 text-center text-[10px] text-gray-400 dark:text-enterprise-muted min-w-[22px]">
                  {h % 3 === 0 ? formatHour(h) : ''}
                </div>
              ))}
            </div>
            {/* Grid rows: one per day */}
            {[1,2,3,4,5,6,7].map(dow => (
              <div key={dow} className="flex items-center gap-1 mb-1">
                <div className="w-10 flex-shrink-0 text-xs text-right pr-2 font-medium text-gray-500 dark:text-enterprise-muted">
                  {DOW_LABELS[dow - 1]}
                </div>
                {HOURS.map(h => {
                  const count = getCell(dow, h);
                  const bg    = cellBg(count);
                  const isHov = hovered?.dow === dow && hovered?.hour === h;
                  return (
                    <div key={h}
                      className={`flex-1 min-w-[22px] h-7 rounded transition-all cursor-default flex items-center justify-center text-[10px] font-bold ${
                        count === 0
                          ? 'bg-gray-100 dark:bg-midnight-800'
                          : ''
                      } ${isHov ? 'ring-2 ring-blue-400 ring-offset-0 scale-110 z-10' : ''}`}
                      style={{ backgroundColor: count > 0 ? bg : undefined }}
                      onMouseEnter={() => setHovered({ dow, hour: h })}
                      onMouseLeave={() => setHovered(null)}
                    >
                      {isHov && count > 0 && (
                        <span className="text-white drop-shadow-md">{count}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
            {/* Scale legend */}
            <div className="flex items-center gap-2 mt-4 justify-end">
              <span className="text-xs text-gray-400 dark:text-enterprise-muted">Low</span>
              {[0.1, 0.3, 0.5, 0.7, 0.9].map(t => (
                <div key={t} className="w-6 h-4 rounded"
                  style={{ backgroundColor: cellBg(Math.round(t * maxCount)) ?? '#e5e7eb' }} />
              ))}
              <span className="text-xs text-gray-400 dark:text-enterprise-muted">High</span>
            </div>
            {hovered && (
              <p className="text-xs text-gray-500 dark:text-enterprise-muted mt-2 text-right">
                {DOW_LABELS[hovered.dow - 1]} {formatHour(hovered.hour)} — <strong className="text-gray-700 dark:text-gray-200">{hoveredCount} trips</strong>
              </p>
            )}
          </div>
        )}
      </ChartCard>
    </div>
  );
}
