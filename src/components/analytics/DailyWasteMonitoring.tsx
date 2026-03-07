import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, PieChart, Pie, Cell, ComposedChart, Line,
  ReferenceLine, Dot,
} from 'recharts';
import {
  Calendar, RotateCcw, Download, ChevronDown, AlertTriangle,
  Leaf, Droplets, Package2, Target, Bot,
} from 'lucide-react';
import { usePersistentState } from '../../hooks/usePersistentState';
import { useDarkMode } from '../../hooks/useDarkMode';
import { ChartCard } from '../ChartCard';
import { chartGridConfig, chartXAxisConfig, chartYAxisConfig, chartTooltipConfig, chartTooltipConfigDark } from '../../utils/chartConfig';

// ── Types ──────────────────────────────────────────────────────────────────

interface FeedstockRow { day: string; substrate_category: string; trips: number; net_kg: number; gross_kg: number; }
interface SourceRow    { source: string; trips: number; net_kg: number; }
interface DailyTotal   { day: string; trips: number; net_kg: number; gross_kg: number; }
interface OutageEvent  { day: string; plant_area: string; cause_category: string; duration_hours: number; severity: string; }
interface DrillRow     { id: number; day: string; plate_no: string; driver: string; product: string; substrate_category: string; source: string; net_kg: number; gross_kg: number; tare_kg: number; status: string; } // plate aliased AS plate_no in SQL

type SubstrateFilter = 'All' | 'Pineapple' | 'Manure' | 'Sludge' | 'Other';

// ── Constants ──────────────────────────────────────────────────────────────

const SUBSTRATE_COLORS: Record<string, string> = {
  Pineapple: 'var(--chart-green)',
  Manure:    'var(--chart-amber)',
  Sludge:    'var(--chart-blue)',
  Other:     '#9ca3af',
};
const SOURCE_COLORS = [
  'var(--chart-green)', 'var(--chart-amber)', 'var(--chart-blue)',
  'var(--chart-pink)', '#9ca3af'
];
const RADIAN = Math.PI / 180;

function fmtDay(d: string): string {
  const dt = new Date(d);
  return `${dt.toLocaleString('en-US', { month: 'short' })} ${dt.getDate()}`;
}

// ── Gauge component ────────────────────────────────────────────────────────

function WasteGauge({ actual, target, isDark }: { actual: number; target: number; isDark: boolean }) {
  const pct   = target > 0 ? Math.min(actual / target, 1.1) : 0;
  const angle = -180 + pct * 180;  // -180° (left) → 0° (right)
  const cx = 110; const cy = 100; const r = 80;

  // Arc paths
  const polarToXY = (deg: number, radius: number) => ({
    x: cx + radius * Math.cos(deg * RADIAN),
    y: cy + radius * Math.sin(deg * RADIAN),
  });

  const arcPath = (startDeg: number, endDeg: number, rad: number) => {
    const s = polarToXY(startDeg, rad);
    const e = polarToXY(endDeg, rad);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${rad} ${rad} 0 ${large} 1 ${e.x} ${e.y}`;
  };

  const needle = polarToXY(angle, r - 8);
  const statusColor = pct >= 1 ? '#22c55e' : pct >= 0.75 ? '#f59e0b' : '#ef4444';
  const label       = pct >= 1 ? 'On Target' : pct >= 0.75 ? 'Near Target' : 'Below Target';

  return (
    <svg viewBox="0 0 220 120" className="w-full max-w-[200px] mx-auto overflow-visible">
      {/* Track arc */}
      <path d={arcPath(-180, 0, r)} fill="none" stroke={isDark ? '#374151' : '#e5e7eb'} strokeWidth={16} strokeLinecap="round" />
      {/* Fill arc */}
      <path d={arcPath(-180, -180 + Math.min(pct, 1) * 180, r)} fill="none" stroke={statusColor} strokeWidth={16} strokeLinecap="round" />
      {/* Needle */}
      <line x1={cx} y1={cy} x2={needle.x} y2={needle.y} stroke={statusColor} strokeWidth={3} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={5} fill={statusColor} />
      {/* Labels */}
      <text x={cx} y={cy + 22} textAnchor="middle" fontSize={14} fontWeight={700} fill={statusColor}>{(actual / 1000).toFixed(1)} t</text>
      <text x={cx} y={cy + 36} textAnchor="middle" fontSize={9} fill={isDark ? '#9ca3af' : '#6b7280'}>of {(target / 1000).toFixed(1)} t target</text>
      <text x={cx} y={cy + 48} textAnchor="middle" fontSize={8} fontWeight={600} fill={statusColor}>{label} · {(pct * 100).toFixed(0)}%</text>
      {/* Min / Max ticks */}
      <text x={cx - r - 4} y={cy + 4}  textAnchor="end"    fontSize={8} fill={isDark ? '#6b7280' : '#9ca3af'}>0</text>
      <text x={cx + r + 4} y={cy + 4}  textAnchor="start"  fontSize={8} fill={isDark ? '#6b7280' : '#9ca3af'}>{(target / 1000).toFixed(0)}t</text>
    </svg>
  );
}

// ── Custom pie label ───────────────────────────────────────────────────────

const PieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: { cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number; percent: number }) => {
  if (percent < 0.04) return null;
  const r = innerRadius + (outerRadius - innerRadius) * 0.55;
  return (
    <text x={cx + r * Math.cos(-midAngle * RADIAN)} y={cy + r * Math.sin(-midAngle * RADIAN)}
      fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

// ── CSV export helper ──────────────────────────────────────────────────────

function exportCSV(
  feedstock: FeedstockRow[],
  source: SourceRow[],
  _totals: DailyTotal[],
  startDate: string,
  endDate: string,
  subFilter: SubstrateFilter,
) {
  // Apply substrate filter to feedstock rows
  const filteredFeed = subFilter === 'All'
    ? feedstock
    : feedstock.filter(r => r.substrate_category === subFilter);

  // Re-aggregate daily totals from the filtered feedstock so numbers stay consistent
  const totalsByDay = new Map<string, { trips: number; net_kg: number; gross_kg: number }>();
  filteredFeed.forEach(r => {
    const key = r.day?.slice(0, 10) ?? '';
    const cur = totalsByDay.get(key) ?? { trips: 0, net_kg: 0, gross_kg: 0 };
    totalsByDay.set(key, {
      trips:    cur.trips    + (r.trips    ?? 0),
      net_kg:   cur.net_kg   + (r.net_kg   ?? 0),
      gross_kg: cur.gross_kg + (r.gross_kg ?? 0),
    });
  });
  const filteredTotals = [...totalsByDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, v]) => ({ day, ...v }));

  // Only show source rows that are relevant to the selected substrate
  const sourceSubstrates: Record<SubstrateFilter, string[]> = {
    All:       ['DOLE', 'Local Farms', 'MWSS/LWUA', 'Internal / Other'],
    Pineapple: ['DOLE'],
    Manure:    ['Local Farms'],
    Sludge:    ['MWSS/LWUA'],
    Other:     ['Internal / Other'],
  };
  const filteredSource = source.filter(s => sourceSubstrates[subFilter].includes(s.source));

  const subLabel = subFilter === 'All' ? 'All Substrates' : subFilter;
  const subSlug  = subFilter === 'All' ? 'all' : subFilter.toLowerCase();

  const rows: string[] = [
    `METPower Daily Waste Monitoring Export`,
    `Period: ${startDate} to ${endDate}`,
    `Feedstock Filter: ${subLabel}`,
    `Generated: ${new Date().toISOString()}`,
    ``,
    `--- DAILY FEEDSTOCK BREAKDOWN (${subLabel}) ---`,
    `Date,Substrate,Trips,Net Weight (kg),Gross Weight (kg)`,
    ...filteredFeed.map(r => `${r.day?.slice(0,10)},${r.substrate_category},${r.trips},${r.net_kg ?? 0},${r.gross_kg ?? 0}`),
    ``,
    `--- WASTE SOURCE DISTRIBUTION (${subLabel}) ---`,
    `Source,Trips,Net Weight (kg)`,
    ...filteredSource.map(r => `${r.source},${r.trips},${r.net_kg ?? 0}`),
    ``,
    `--- DAILY TOTALS SUMMARY (${subLabel}) ---`,
    `Date,Trips,Net Weight (kg),Gross Weight (kg)`,
    ...filteredTotals.map(r => `${r.day},${r.trips},${r.net_kg.toFixed(2)},${r.gross_kg.toFixed(2)}`),
    ``,
    `--- GRAND TOTAL ---`,
    `Trips,Net Weight (kg),Net Weight (t)`,
    `${filteredTotals.reduce((s, r) => s + r.trips, 0)},` +
    `${filteredTotals.reduce((s, r) => s + r.net_kg, 0).toFixed(2)},` +
    `${(filteredTotals.reduce((s, r) => s + r.net_kg, 0) / 1000).toFixed(3)}`,
  ];
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `waste-monitoring-${subSlug}-${startDate}-to-${endDate}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function DailyWasteMonitoring() {
  const isDark = useDarkMode();
  const [startDate, setStartDate] = usePersistentState('dwm-startDate', '');
  const [endDate,   setEndDate  ] = usePersistentState('dwm-endDate',   '');
  const [appliedStart, setAppliedStart] = useState(startDate);
  const [appliedEnd,   setAppliedEnd  ] = useState(endDate);
  const [dailyTarget,  setDailyTarget ] = usePersistentState('dwm-dailyTarget', 500); // tonnes/day
  const [gaugeDate,    setGaugeDate   ] = usePersistentState('dwm-gaugeDate',   '');
  const [subFilter,    setSubFilter   ] = usePersistentState<SubstrateFilter>('dwm-subFilter', 'All');

  const [feedstock, setFeedstock] = useState<FeedstockRow[]>([]);
  const [sourcePie, setSourcePie] = useState<SourceRow[]>([]);
  const [dailyTotals, setDailyTotals] = useState<DailyTotal[]>([]);
  const [outages,     setOutages    ] = useState<OutageEvent[]>([]);
  const [drill,       setDrill      ] = useState<{ date: string; substrate: SubstrateFilter } | null>(null);
  const [drillData,   setDrillData  ] = useState<DrillRow[]>([]);
  const [loading,     setLoading    ] = useState(false);
  const [drillLoading, setDrillLoading] = useState(false);
  const [dateReady,   setDateReady  ] = useState(false);
  const [editTarget,  setEditTarget ] = useState(false);
  const targetInputRef = useRef<HTMLInputElement>(null);

  // Init dates
  useEffect(() => {
    if (!startDate || !endDate) {
      fetch('/api/analytics/transac-date-range')
        .then(r => r.json())
        .then(d => {
          setStartDate(d.minDate ?? ''); setEndDate(d.maxDate ?? '');
          setAppliedStart(d.minDate ?? ''); setAppliedEnd(d.maxDate ?? '');
          if (!gaugeDate) setGaugeDate(d.maxDate ?? '');
          setDateReady(true);
        })
        .catch(() => setDateReady(true));
    } else {
      setAppliedStart(startDate); setAppliedEnd(endDate);
      if (!gaugeDate) setGaugeDate(endDate);
      setDateReady(true);
    }
  }, []);

  const fetchAll = useCallback((s: string, e: string) => {
    if (!s || !e) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/daily-waste/feedstock?startDate=${s}&endDate=${e}`).then(r => r.json()),
      fetch(`/api/daily-waste/source-pie?startDate=${s}&endDate=${e}`).then(r => r.json()),
      fetch(`/api/daily-waste/daily-totals?startDate=${s}&endDate=${e}`).then(r => r.json()),
    ])
      .then(([feed, src, totObj]) => {
        setFeedstock(Array.isArray(feed) ? feed : []);
        setSourcePie(Array.isArray(src) ? src : []);
        const totalsList = (totObj?.totals ?? []) as DailyTotal[];
        setDailyTotals(totalsList);
        setOutages((totObj?.outages ?? []) as OutageEvent[]);
        // Auto-set gaugeDate to last day in dataset
        if (totalsList.length && !gaugeDate) {
          setGaugeDate(totalsList[totalsList.length - 1].day);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [gaugeDate]);

  useEffect(() => { if (dateReady) fetchAll(appliedStart, appliedEnd); }, [dateReady, appliedStart, appliedEnd]);

  const handleReset = async () => {
    try {
      const d = await fetch('/api/analytics/transac-date-range').then(r => r.json());
      setStartDate(d.minDate ?? ''); setEndDate(d.maxDate ?? '');
      setAppliedStart(d.minDate ?? ''); setAppliedEnd(d.maxDate ?? '');
      setGaugeDate(d.maxDate ?? '');
    } catch {}
  };
  const handleApply = () => { setAppliedStart(startDate); setAppliedEnd(endDate); setDrill(null); };

  // Drill fetch
  useEffect(() => {
    if (!drill) { setDrillData([]); return; }
    setDrillLoading(true);
    fetch(`/api/daily-waste/drill?startDate=${drill.date}&endDate=${drill.date}&substrate=${encodeURIComponent(drill.substrate)}`)
      .then(r => r.json())
      .then(d => setDrillData(Array.isArray(d) ? d : []))
      .catch(() => setDrillData([]))
      .finally(() => setDrillLoading(false));
  }, [drill]);

  // ── Build chart data ────────────────────────────────────────────────────

  const allSubstrates = ['Pineapple', 'Manure', 'Sludge', 'Other'];

  // Group feedstock by day → pivot
  const feedstockByDay = new Map<string, Record<string, number> & { label: string }>();
  feedstock.forEach(r => {
    const key = r.day?.slice(0, 10);
    if (!key) return;
    if (!feedstockByDay.has(key)) feedstockByDay.set(key, { label: fmtDay(key) } as Record<string, number> & { label: string });
    const entry = feedstockByDay.get(key)!;
    entry[r.substrate_category] = (entry[r.substrate_category] ?? 0) + (r.net_kg ?? 0) / 1000;
  });
  const feedChartData = [...feedstockByDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);

  // Filter by substrate
  const visibleSubstrates = subFilter === 'All' ? allSubstrates : [subFilter];

  // Outage overlay chart data — merge daily totals + outage markers
  const outageSet = new Set(outages.map(o => o.day?.slice(0, 10)));
  const overlayData = dailyTotals.map(t => ({
    label: fmtDay(t.day?.slice(0, 10)),
    day:   t.day?.slice(0, 10),
    net_t: parseFloat(((t.net_kg ?? 0) / 1000).toFixed(2)),
    hasOutage: outageSet.has(t.day?.slice(0, 10)),
  }));

  // Gauge value
  const gaugeActual = dailyTotals.find(t => t.day?.slice(0, 10) === gaugeDate)?.net_kg ?? 0;
  const gaugeTarget = dailyTarget * 1000; // convert tonnes to kg

  // Filtered grand totals — respects subFilter and applied date range
  const filteredFeedstock = subFilter === 'All'
    ? feedstock
    : feedstock.filter(r => r.substrate_category === subFilter);

  const grandTrips    = filteredFeedstock.reduce((s, r) => s + (r.trips    ?? 0), 0);
  const grandNetKg    = filteredFeedstock.reduce((s, r) => s + (r.net_kg   ?? 0), 0);
  const grandGrossKg  = filteredFeedstock.reduce((s, r) => s + (r.gross_kg ?? 0), 0);

  // Unique days in filtered set (for avg)
  const filteredDays  = new Set(filteredFeedstock.map(r => r.day?.slice(0, 10))).size;
  const avgDailyKgF   = filteredDays > 0 ? grandNetKg / filteredDays : 0;

  // Outage count
  const totalOutages  = outages.length;

  // ── Styles ──────────────────────────────────────────────────────────────

  const card      = isDark ? 'bg-midnight-900 border-gray-700' : 'bg-white border-gray-200';
  const text      = isDark ? 'text-gray-100' : 'text-gray-900';
  const muted     = isDark ? 'text-gray-400' : 'text-gray-500';
  const inputCls  = isDark
    ? 'bg-midnight-800 border-gray-600 text-gray-200 focus:border-blue-500'
    : 'bg-white border-gray-300 text-gray-800 focus:border-blue-500';
  const rowHover  = isDark ? 'border-gray-800 hover:bg-midnight-800' : 'border-gray-100 hover:bg-gray-50';

  // ── Render ──────────────────────────────────────────────────────────────

  const divider = isDark ? 'border-gray-700' : 'border-gray-200';
  const sectionCard = `rounded-xl border shadow-sm ${card}`;
  const accentBar = (color: string) => ({ borderLeft: `3px solid ${color}` });

  return (
    <div className="space-y-5">

      {/* ════════════════════════════════════════════════════════════════
          HEADER + CONTROLS
      ════════════════════════════════════════════════════════════════ */}
      <div className={`${sectionCard} overflow-hidden`}>
        {/* Title row */}
        <div className={`px-5 py-3 flex items-center justify-between border-b ${divider}`}>
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 rounded-full bg-blue-500" />
            <div>
              <h3 className={`text-sm font-semibold ${text}`}>Daily Waste Monitoring</h3>
              <p className={`text-xs ${muted}`}>
                {appliedStart && appliedEnd ? `${appliedStart} — ${appliedEnd}` : 'All available data'}
                {subFilter !== 'All' && <span className="ml-2 font-medium" style={{ color: SUBSTRATE_COLORS[subFilter] }}>· {subFilter} only</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const totalNetTons = (feedstock.reduce((s, r) => s + r.net_kg, 0) / 1000).toFixed(1);
                const totalTrips = feedstock.reduce((s, r) => s + r.trips, 0);
                const substrates = [...new Set(feedstock.map(r => r.substrate_category))].join(', ') || 'n/a';
                const topSource = sourcePie.length ? sourcePie.sort((a, b) => (b.net_kg ?? 0) - (a.net_kg ?? 0))[0] : null;
                const topLabel = topSource ? `${(topSource as any).substrate_category ?? (topSource as any).source ?? 'Unknown'}` : 'n/a';
                window.dispatchEvent(new CustomEvent('explain-chart', { detail: { message: `Explain the Daily Waste Monitoring charts (${appliedStart || 'all'} to ${appliedEnd || 'all'}). Filter: ${subFilter}. Total net tonnage: ${totalNetTons}t across ${totalTrips} trips. Substrates present: ${substrates}. Top source: ${topLabel}. What are the daily trends, are volumes consistent or fluctuating, which substrate dominates, are there any concerning drops or spikes in waste intake, and what should operations adjust?` } }));
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-800/50 hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors shrink-0`}
              title="Ask AI to explain this chart"
            >
              <Bot className="w-3.5 h-3.5" /> Explain
            </button>
            <button
              onClick={() => exportCSV(feedstock, sourcePie, dailyTotals, appliedStart, appliedEnd, subFilter)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          </div>
        </div>

        {/* Controls row */}
        <div className="px-5 py-3 flex flex-wrap items-center gap-3">
          {/* Substrate pills */}
          <div className={`flex rounded-lg overflow-hidden border text-xs font-semibold ${isDark ? 'border-gray-600' : 'border-gray-200'}`}>
            {(['All', 'Pineapple', 'Manure', 'Sludge', 'Other'] as SubstrateFilter[]).map(s => (
              <button key={s} onClick={() => setSubFilter(s)}
                className={`px-3 py-1.5 transition-all duration-150 ${subFilter === s
                  ? 'text-white shadow-inner'
                  : isDark ? 'bg-midnight-800 text-gray-400 hover:text-gray-200 hover:bg-midnight-700'
                           : 'bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                style={subFilter === s ? { background: s === 'All' ? '#3b82f6' : SUBSTRATE_COLORS[s] } : {}}>
                {s}
              </button>
            ))}
          </div>

          {/* Date range */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs ${isDark ? 'border-gray-600 bg-midnight-800' : 'border-gray-200 bg-gray-50'}`}>
            <Calendar className={`w-3.5 h-3.5 ${muted}`} />
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className={`bg-transparent text-xs focus:outline-none ${text}`} />
            <span className={`${muted} select-none`}>–</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className={`bg-transparent text-xs focus:outline-none ${text}`} />
          </div>

          <button onClick={handleApply}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm">
            Apply
          </button>
          <button onClick={handleReset}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${isDark ? 'border-gray-600 text-gray-400 hover:bg-midnight-800' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          METRICS  —  Grand total respects filter + date range
      ════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Trips */}
        <div className={`${sectionCard} p-4`} style={accentBar('#3b82f6')}>
          <p className={`text-xs font-medium ${muted} mb-1`}>Total Trips</p>
          <p className="text-2xl font-bold text-blue-500">{grandTrips.toLocaleString()}</p>
          <p className={`text-xs mt-1 ${muted}`}>deliveries</p>
        </div>
        {/* Net Weight */}
        <div className={`${sectionCard} p-4`} style={accentBar('#10b981')}>
          <p className={`text-xs font-medium ${muted} mb-1`}>Total Net Weight</p>
          <p className="text-2xl font-bold text-emerald-500">{(grandNetKg / 1000).toFixed(2)} t</p>
          <p className={`text-xs mt-1 ${muted}`}>{grandNetKg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg</p>
        </div>
        {/* Gross Weight */}
        <div className={`${sectionCard} p-4`} style={accentBar('#f59e0b')}>
          <p className={`text-xs font-medium ${muted} mb-1`}>Total Gross Weight</p>
          <p className="text-2xl font-bold text-amber-500">{(grandGrossKg / 1000).toFixed(2)} t</p>
          <p className={`text-xs mt-1 ${muted}`}>{grandGrossKg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg</p>
        </div>
        {/* Avg / Outages */}
        <div className={`${sectionCard} p-4`} style={accentBar(totalOutages > 0 ? '#ef4444' : '#8b5cf6')}>
          <p className={`text-xs font-medium ${muted} mb-1`}>Avg Daily Net</p>
          <p className={`text-2xl font-bold text-purple-500`}>{(avgDailyKgF / 1000).toFixed(2)} t</p>
          <p className={`text-xs mt-1 ${muted}`}>
            {totalOutages > 0
              ? <span className="text-red-500 font-medium">⚠ {totalOutages} outage event{totalOutages > 1 ? 's' : ''}</span>
              : 'per day average'}
          </p>
        </div>
      </div>

      {/* Substrate breakdown chips — only when All selected */}
      {subFilter === 'All' && feedstock.length > 0 && (
        <div className={`${sectionCard} px-4 py-3`}>
          <p className={`text-xs font-semibold mb-2.5 ${muted} uppercase tracking-wide`}>Breakdown by substrate</p>
          <div className="flex flex-wrap gap-2">
            {['Pineapple', 'Manure', 'Sludge', 'Other'].map(sub => {
              const subRows  = feedstock.filter(r => r.substrate_category === sub);
              const subNet   = subRows.reduce((s, r) => s + (r.net_kg ?? 0), 0);
              const subTrips = subRows.reduce((s, r) => s + (r.trips  ?? 0), 0);
              if (!subTrips && !subNet) return null;
              const pct = grandNetKg > 0 ? (subNet / grandNetKg) * 100 : 0;
              return (
                <div key={sub} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs border
                  ${isDark ? 'bg-midnight-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: SUBSTRATE_COLORS[sub] }} />
                  <span className={`font-semibold ${text}`}>{sub}</span>
                  <span className={muted}>{subTrips.toLocaleString()} trips</span>
                  <span className="font-bold" style={{ color: SUBSTRATE_COLORS[sub] }}>{(subNet / 1000).toFixed(1)} t</span>
                  <span className={`text-xs ${muted}`}>({pct.toFixed(0)}%)</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          LOADING
      ════════════════════════════════════════════════════════════════ */}
      {loading && (
        <div className={`${sectionCard} p-12 flex flex-col items-center gap-3`}>
          <div className="animate-spin rounded-full h-9 w-9 border-2 border-blue-500 border-t-transparent" />
          <p className={`text-xs ${muted}`}>Loading waste data…</p>
        </div>
      )}

      {!loading && (
        <>
          {/* ════════════════════════════════════════════════════════════
              CHART 1 — Daily feedstock stacked bar
          ════════════════════════════════════════════════════════════ */}
          <ChartCard title="Daily Feedstock Breakdown">
            {feedChartData.length === 0 ? (
              <div className={`flex flex-col items-center justify-center h-44 gap-2 ${muted}`}>
                <Package2 className="w-8 h-8 opacity-30" />
                <span className="text-sm">No feedstock data in range</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={290}>
                <BarChart data={feedChartData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }} barCategoryGap="30%">
                  <CartesianGrid {...chartGridConfig} />
                  <XAxis {...chartXAxisConfig} dataKey="label" />
                  <YAxis hide unit="t" />
                  <Tooltip
                    {...(isDark ? chartTooltipConfigDark : chartTooltipConfig)}
                    formatter={(v: number, name: string) => [`${v.toFixed(2)} t`, name]}
                  />
                  <Legend />
                  {visibleSubstrates.map((s, i) => (
                    <Bar key={s} dataKey={s} stackId="a" name={s}
                      fill={SUBSTRATE_COLORS[s] ?? '#9ca3af'}
                      radius={i === visibleSubstrates.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                      cursor="pointer"
                      onClick={(data) => {
                        const day = feedstock.find(f => fmtDay(f.day?.slice(0, 10)) === data.label)?.day?.slice(0, 10);
                        if (day) setDrill({ date: day, substrate: s as SubstrateFilter });
                      }}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* ════════════════════════════════════════════════════════════
              CHART 2 — Source pie  +  Reconciliation gauge
          ════════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Source distribution */}
            <ChartCard title="Waste Source Distribution">
              {sourcePie.length === 0 ? (
                <div className={`flex flex-col items-center justify-center h-44 gap-2 ${muted}`}>
                  <Droplets className="w-8 h-8 opacity-30" />
                  <span className="text-sm">No source data</span>
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={sourcePie.map(s => ({ name: s.source, value: parseFloat(((s.net_kg ?? 0) / 1000).toFixed(2)) }))}
                        cx="50%" cy="50%" innerRadius={45} outerRadius={85} paddingAngle={2}
                        dataKey="value" labelLine={false} label={PieLabel}>
                        {sourcePie.map((_, i) => <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => [`${v.toFixed(2)} t`, '']}
                        contentStyle={{ background: isDark ? '#111827' : '#fff', border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`, borderRadius: 10, fontSize: 12 }} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Source legend table */}
                  <div className={`mt-1 pt-3 border-t ${divider} space-y-1`}>
                    {sourcePie.map((s, i) => (
                      <div key={s.source} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: SOURCE_COLORS[i % SOURCE_COLORS.length] }} />
                          <span className={muted}>{s.source}</span>
                        </span>
                        <span className={`font-semibold ${text}`}>{((s.net_kg ?? 0) / 1000).toFixed(1)} t
                          <span className={`ml-1.5 font-normal ${muted}`}>· {s.trips} trips</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </ChartCard>

            {/* Reconciliation gauge */}
            <ChartCard title="Daily Reconciliation">
              {/* Date picker for gauge */}
              <div className={`flex items-center gap-2 mb-4 px-3 py-1.5 rounded-lg border text-xs w-fit ${isDark ? 'border-gray-600 bg-midnight-800' : 'border-gray-200 bg-gray-50'}`}>
                <Calendar className={`w-3.5 h-3.5 ${muted}`} />
                <input type="date" value={gaugeDate} onChange={e => setGaugeDate(e.target.value)}
                  min={appliedStart} max={appliedEnd}
                  className={`bg-transparent text-xs focus:outline-none ${text}`} />
              </div>
              <WasteGauge actual={gaugeActual} target={gaugeTarget} isDark={isDark} />
              {/* That day's substrate breakdown */}
              <div className={`mt-4 pt-3 border-t ${divider} space-y-1.5`}>
                {allSubstrates.map(sub => {
                  const subRows = feedstock.filter(f => f.day?.slice(0, 10) === gaugeDate && f.substrate_category === sub);
                  const subKg = subRows.reduce((s, r) => s + (r.net_kg ?? 0), 0);
                  if (!subKg) return null;
                  const pct = gaugeActual > 0 ? (subKg / gaugeActual) * 100 : 0;
                  return (
                    <div key={sub} className="flex items-center gap-2 text-xs">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: SUBSTRATE_COLORS[sub] }} />
                      <span className={`flex-1 ${muted}`}>{sub}</span>
                      {/* mini progress bar */}
                      <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: SUBSTRATE_COLORS[sub] }} />
                      </div>
                      <span className={`font-semibold w-16 text-right ${text}`}>{(subKg / 1000).toFixed(2)} t</span>
                    </div>
                  );
                })}
              </div>
            </ChartCard>
          </div>

          {/* ════════════════════════════════════════════════════════════
              CHART 3 — Daily volume line + outage overlay
          ════════════════════════════════════════════════════════════ */}
          <div className={sectionCard}>
            <div className={`px-5 py-3 border-b ${divider} flex items-center gap-3`}>
              <div className="flex-1">
                <p className={`text-sm font-semibold ${text}`}>Processing Volume & Outage Overlay</p>
                <p className={`text-xs ${muted}`}>Daily net intake vs target · red markers indicate outage events</p>
              </div>
              {totalOutages > 0 && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800">
                  <AlertTriangle className="w-3 h-3" /> {totalOutages} outage{totalOutages > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="p-4">
              {overlayData.length === 0 ? (
                <div className={`flex flex-col items-center justify-center h-44 gap-2 ${muted}`}>
                  <Leaf className="w-8 h-8 opacity-30" />
                  <span className="text-sm">No volume data</span>
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={260}>
                    <ComposedChart data={overlayData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1f2937' : '#f3f4f6'} vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: isDark ? '#6b7280' : '#9ca3af' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10, fill: isDark ? '#6b7280' : '#9ca3af' }} axisLine={false} tickLine={false} unit="t" width={38} />
                      <Tooltip
                        cursor={{ stroke: isDark ? '#374151' : '#e5e7eb', strokeWidth: 1 }}
                        contentStyle={{ background: isDark ? '#111827' : '#fff', border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`, borderRadius: 10, fontSize: 12, padding: '8px 12px' }}
                        formatter={(v: number, name: string) => [name === 'net_t' ? `${v.toFixed(2)} t` : v, name === 'net_t' ? 'Processed' : name]}
                      />
                      <ReferenceLine y={dailyTarget} stroke="#f59e0b" strokeDasharray="5 3" strokeWidth={1.5}
                        label={{ value: `Target ${dailyTarget}t`, position: 'insideTopRight', fontSize: 10, fill: '#f59e0b', dy: -4 }} />
                      <Line dataKey="net_t" name="net_t" stroke="#3b82f6" strokeWidth={2.5} type="monotone"
                        fill="url(#lineGrad)"
                        dot={(props) => {
                          const { cx, cy, payload } = props;
                          if (payload?.hasOutage) {
                            return <Dot key={props.key} cx={cx} cy={cy} r={6} fill="#ef4444" stroke="#fff" strokeWidth={2} />;
                          }
                          return <Dot key={props.key} cx={cx} cy={cy} r={2.5} fill="#3b82f6" />;
                        }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                  {totalOutages > 0 && (
                    <div className={`mt-3 flex flex-wrap gap-2`}>
                      {outages.slice(0, 6).map((o, i) => (
                        <span key={i} className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border
                          ${isDark ? 'bg-red-900/20 border-red-800 text-red-400' : 'bg-red-50 border-red-200 text-red-600'}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                          {o.day?.slice(0, 10)}{o.cause_category ? ` · ${o.cause_category}` : ''}
                        </span>
                      ))}
                      {outages.length > 6 && <span className={`text-xs ${muted} py-1`}>+{outages.length - 6} more</span>}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════════
              DRILL-DOWN PANEL
          ════════════════════════════════════════════════════════════ */}
          {drill && (
            <div className={`${sectionCard} overflow-hidden`}>
              {/* Drill header */}
              <div className={`px-5 py-3 border-b ${divider} flex items-center justify-between`}
                style={{ borderLeft: `3px solid ${SUBSTRATE_COLORS[drill.substrate] ?? '#9ca3af'}` }}>
                <div className="flex items-center gap-3">
                  <div>
                    <p className={`text-sm font-semibold ${text}`}>Transaction Detail</p>
                    <p className={`text-xs ${muted}`}>
                      {drill.date}
                      {drill.substrate !== 'All' && <span className="ml-1 font-medium" style={{ color: SUBSTRATE_COLORS[drill.substrate] }}>· {drill.substrate}</span>}
                    </p>
                  </div>
                  {drillData.length > 0 && (
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                      {drillData.length} records
                    </span>
                  )}
                </div>
                <button onClick={() => setDrill(null)}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors
                    ${isDark ? 'border-gray-600 text-gray-400 hover:bg-midnight-800' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                  <ChevronDown className="w-3.5 h-3.5" /> Close
                </button>
              </div>

              <div className="p-4">
                {drillLoading ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-3">
                    <div className="animate-spin rounded-full h-7 w-7 border-2 border-blue-500 border-t-transparent" />
                    <p className={`text-xs ${muted}`}>Loading transactions…</p>
                  </div>
                ) : drillData.length === 0 ? (
                  <div className={`flex flex-col items-center justify-center py-10 gap-2 ${muted}`}>
                    <Package2 className="w-7 h-7 opacity-30" />
                    <p className="text-sm">No transactions found for this selection.</p>
                  </div>
                ) : (
                  <>
                    {/* Drill summary chips */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {[
                        { label: 'Trips',      value: drillData.length.toLocaleString(),                                                         color: 'text-blue-500' },
                        { label: 'Net Weight', value: `${(drillData.reduce((s, r) => s + (r.net_kg ?? 0), 0) / 1000).toFixed(2)} t`,             color: 'text-emerald-500' },
                        { label: 'Gross Wt',  value: `${(drillData.reduce((s, r) => s + (r.gross_kg ?? 0), 0) / 1000).toFixed(2)} t`,            color: 'text-amber-500' },
                        { label: 'Sources',    value: [...new Set(drillData.map(r => r.source))].join(' · '),                                     color: text },
                      ].map(c => (
                        <div key={c.label} className={`px-3 py-1.5 rounded-lg border text-xs ${isDark ? 'bg-midnight-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                          <span className={muted}>{c.label}: </span>
                          <span className={`font-semibold ${c.color}`}>{c.value}</span>
                        </div>
                      ))}
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto rounded-lg border" style={{ borderColor: isDark ? '#374151' : '#e5e7eb' }}>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className={isDark ? 'bg-gray-800' : 'bg-gray-50'}>
                            {['TX ID', 'Date', 'Plate', 'Driver', 'Product', 'Category', 'Source', 'Net kg', 'Gross kg', 'Status'].map(h => (
                              <th key={h} className={`text-left py-2.5 px-3 text-xs font-semibold uppercase tracking-wide ${muted} first:rounded-tl-lg last:rounded-tr-lg whitespace-nowrap`}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {drillData.map((r) => (
                            <tr key={r.id} className={`border-t transition-colors ${rowHover} ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
                              <td className="py-2 px-3 font-mono text-blue-500 font-medium whitespace-nowrap">#{r.id}</td>
                              <td className={`py-2 px-3 font-mono whitespace-nowrap ${text}`}>{r.day?.slice(0, 10)}</td>
                              <td className={`py-2 px-3 font-mono whitespace-nowrap ${text}`}>{r.plate_no}</td>
                              <td className={`py-2 px-3 whitespace-nowrap ${text}`}>{r.driver}</td>
                              <td className={`py-2 px-3 max-w-[140px] truncate ${muted}`} title={r.product}>{r.product}</td>
                              <td className="py-2 px-3 whitespace-nowrap">
                                <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                                  style={{ background: (SUBSTRATE_COLORS[r.substrate_category] ?? '#9ca3af') + '22', color: SUBSTRATE_COLORS[r.substrate_category] ?? '#9ca3af' }}>
                                  {r.substrate_category}
                                </span>
                              </td>
                              <td className={`py-2 px-3 whitespace-nowrap ${muted}`}>{r.source}</td>
                              <td className={`py-2 px-3 text-right font-semibold whitespace-nowrap ${text}`}>{(r.net_kg ?? 0).toLocaleString()}</td>
                              <td className={`py-2 px-3 text-right whitespace-nowrap ${muted}`}>{(r.gross_kg ?? 0).toLocaleString()}</td>
                              <td className="py-2 px-3 whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold
                                  ${r.status === 'completed'
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                                  {r.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        {/* Table footer totals */}
                        <tfoot>
                          <tr className={`border-t-2 font-semibold ${isDark ? 'border-gray-600 bg-gray-800' : 'border-gray-300 bg-gray-50'}`}>
                            <td colSpan={7} className={`py-2 px-3 text-xs ${muted}`}>TOTAL ({drillData.length} records)</td>
                            <td className={`py-2 px-3 text-right text-xs text-emerald-500`}>
                              {drillData.reduce((s, r) => s + (r.net_kg ?? 0), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </td>
                            <td className={`py-2 px-3 text-right text-xs text-amber-500`}>
                              {drillData.reduce((s, r) => s + (r.gross_kg ?? 0), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
