import { useState, useEffect, useCallback, useRef } from 'react';
import Header from './Header';
import { transacApi } from '../services/transacApi';
import { BarChart3, Scale, TrendingUp, Package, Truck, CalendarDays, Layers, Minus, RefreshCw, CheckCircle, XCircle, AlertCircle, Box } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

interface KpiData {
  totalRecords: number;
  totalGrossWeight: number | null;
  totalNetWeight: number | null;
  totalTareWeight: number | null;
  avgNetWeight: number | null;
  avgNetPayloadPct: number | null;
  avgTarePct: number | null;
  todayTrips: number;
  weekTrips: number;
  todayStatuses: { status: string; count: number }[];
}

interface RecentRow {
  id: number;
  plate_no?: string;
  driver?: string;
  product?: string;
  gross_weight?: string;
  status?: string;
  date?: string;
  transac_date?: string;
  inbound?: string;
}

function buildSummary(
  kpi: KpiData,
  fmtTotalWeight: (kg?: number | null) => string,
  fmtPct: (p?: number | null) => string,
  fmtAvgWeight: (kg?: number | null) => string,
): string[] {
  const sentences: string[] = [];
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  if (kpi.totalRecords > 0) {
    sentences.push(
      `As of ${today}, the system has recorded a total of ${kpi.totalRecords.toLocaleString()} transactions across all time.`
    );
  }

  if (kpi.todayTrips > 0 && kpi.weekTrips > 0) {
    sentences.push(
      `Today, ${kpi.todayTrips} truck trip${kpi.todayTrips !== 1 ? 's were' : ' was'} processed — bringing this week's running total to ${kpi.weekTrips} trip${kpi.weekTrips !== 1 ? 's' : ''} since Monday.`
    );
  } else if (kpi.todayTrips === 0 && kpi.weekTrips > 0) {
    sentences.push(`No trips have been recorded yet today. This week has seen ${kpi.weekTrips} trip${kpi.weekTrips !== 1 ? 's' : ''} since Monday.`);
  } else if (kpi.todayTrips === 0 && kpi.weekTrips === 0) {
    sentences.push(`No trips have been recorded today or this week. The facility may be idle or awaiting the first transaction of the week.`);
  }

  if ((kpi.totalGrossWeight ?? 0) > 0) {
    const gross = kpi.totalGrossWeight!;
    const netPct = kpi.totalNetWeight ? ((kpi.totalNetWeight / gross) * 100).toFixed(1) : null;
    sentences.push(
      `Cumulative gross weight stands at ${fmtTotalWeight(kpi.totalGrossWeight)}, of which ${fmtTotalWeight(kpi.totalNetWeight)} (${
        netPct ? netPct + '%' : '—'
      }) was actual net payload and ${fmtTotalWeight(kpi.totalTareWeight)} was vehicle tare weight.`
    );
  }

  if (kpi.avgNetPayloadPct != null) {
    const pct = kpi.avgNetPayloadPct;
    const level = pct >= 65 ? 'high' : pct >= 50 ? 'moderate' : 'relatively low';
    sentences.push(
      `On average, each truck carries a ${level} net payload of ${fmtPct(pct)} its gross weight — approximately ${fmtAvgWeight(kpi.avgNetWeight)} per trip.`
    );
  }

  if (kpi.todayStatuses.length > 0) {
    const done      = kpi.todayStatuses.find(s => /done|complet|approv/i.test(s.status))?.count ?? 0;
    const pending   = kpi.todayStatuses.find(s => /pending|process|progress/i.test(s.status))?.count ?? 0;
    const cancelled = kpi.todayStatuses.find(s => /cancel|reject/i.test(s.status))?.count ?? 0;
    const parts: string[] = [];
    if (done > 0)      parts.push(`${done} completed`);
    if (pending > 0)   parts.push(`${pending} still in progress`);
    if (cancelled > 0) parts.push(`${cancelled} cancelled`);
    if (parts.length > 0)
      sentences.push(`Today's operational breakdown: ${parts.join(', ')}.`);
  }

  return sentences;
}

function statusColor(s?: string) {
  const sl = (s || '').toLowerCase();
  if (sl === 'valid' || sl.includes('done') || sl.includes('complete') || sl.includes('approved')) return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20';
  if (sl.includes('pending') || sl.includes('process')) return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20';
  if (sl.includes('cancel') || sl.includes('reject')) return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
  if (sl === 'void') return 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/40';
  return 'text-gray-600 dark:text-enterprise-muted bg-gray-100 dark:bg-midnight-700';
}

function statusIcon(s?: string) {
  const sl = (s || '').toLowerCase();
  if (sl === 'valid' || sl.includes('done') || sl.includes('complete') || sl.includes('approved')) return <CheckCircle className="w-3.5 h-3.5" />;
  if (sl.includes('cancel') || sl.includes('reject')) return <XCircle className="w-3.5 h-3.5" />;
  if (sl === 'void') return <AlertCircle className="w-3.5 h-3.5" />;
  return <AlertCircle className="w-3.5 h-3.5" />;
}

export default function Dashboard() {
  const [kpi, setKpi] = useState<KpiData>({ totalRecords: 0, totalGrossWeight: null, totalNetWeight: null, totalTareWeight: null, avgNetWeight: null, avgNetPayloadPct: null, avgTarePct: null, todayTrips: 0, weekTrips: 0, todayStatuses: [] });
  const [recent, setRecent] = useState<RecentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [aiSummary, setAiSummary] = useState<string[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const isMounted = useRef(true);
  
  const fetchSummary = useCallback(async (silent = false) => {
    if (!isMounted.current) return;
    if (!silent) setLoading(true);
    try {
      const td = todayStr();
      const [listRes, weightRes, statusRes] = await Promise.all([
        transacApi.list({ page: 1, pageSize: 5, sortBy: 'id', sortDir: 'DESC' }),
        fetch(`${API_URL}/analytics/weight-summary`, { credentials: 'include' }).then(r => r.json()).catch(() => ({})),
        fetch(`${API_URL}/analytics/status-breakdown?startDate=${td}&endDate=${td}`, { credentials: 'include' }).then(r => r.json()).catch(() => []),
      ]);
      if (!isMounted.current) return;

      const todayStatuses: { status: string; count: number }[] = Array.isArray(statusRes) ? statusRes : [];

      const newKpi: KpiData = {
        totalRecords:     weightRes.totalRecords     ?? listRes.total ?? 0,
        totalGrossWeight: weightRes.totalGrossWeight ?? null,
        totalNetWeight:   weightRes.totalNetWeight   ?? null,
        totalTareWeight:  weightRes.totalTareWeight  ?? null,
        avgNetWeight:     weightRes.avgNetWeight     ?? null,
        avgNetPayloadPct: weightRes.avgNetPayloadPct ?? null,
        avgTarePct:       weightRes.avgTarePct       ?? null,
        todayTrips:       weightRes.todayTrips       ?? 0,
        weekTrips:        weightRes.weekTrips        ?? 0,
        todayStatuses,
      };
      setKpi(newKpi);
      setRecent(listRes.rows ?? []);
      setLastRefreshed(new Date());
      // Fetch AI summary (non-blocking — failures fall back to rule-based)
      if (!silent) {
        setAiLoading(true);
        fetch(`${API_URL}/ai-summary`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(newKpi),
        })
          .then(r => r.ok ? r.json() : null)
          .then(data => { if (isMounted.current && data?.sentences?.length) setAiSummary(data.sentences); })
          .catch(() => {})
          .finally(() => { if (isMounted.current) setAiLoading(false); });
      }
    } catch (e) {
      console.error('Dashboard summary error:', e);
    } finally {
      if (isMounted.current && !silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    fetchSummary();
    // Fallback polling every 15 s in case socket is unavailable
    const iv = setInterval(() => fetchSummary(true), 15000);
    return () => { isMounted.current = false; clearInterval(iv); };
  }, [fetchSummary]);

  // Immediate refresh whenever any DB change fires via socket
  useEffect(() => {
    const onDataChanged = () => { if (isMounted.current) fetchSummary(true); };
    window.addEventListener('data-changed', onDataChanged);
    return () => window.removeEventListener('data-changed', onDataChanged);
  }, [fetchSummary]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchSummary(true);
    setRefreshing(false);
  };

  const fmtDate = (d?: string | null) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return d; }
  };

  const fmtTime = (d: Date) =>
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const getRowDate = (row: RecentRow) =>
    row.date || row.transac_date || row.inbound || '—';

  const fmtTotalWeight = (kg?: number | null) => {
    if (kg == null) return '—';
    const t = kg / 1000;
    if (t >= 1_000_000) return `${(t / 1_000_000).toFixed(2)}M t`;
    if (t >= 1_000) return `${(t / 1_000).toFixed(1)}K t`;
    return `${t.toFixed(1)} t`;
  };

  const fmtAvgWeight = (kg?: number | null) => {
    if (kg == null) return '—';
    return `${Math.round(kg).toLocaleString()} kg`;
  };

  const fmtPct = (p?: number | null) => {
    if (p == null) return '—';
    return `${p.toFixed(1)}%`;
  };

  const netPct  = (kpi.totalGrossWeight ?? 0) > 0 ? ((kpi.totalNetWeight  ?? 0) / kpi.totalGrossWeight!) * 100 : 0;
  const tarePct = (kpi.totalGrossWeight ?? 0) > 0 ? ((kpi.totalTareWeight ?? 0) / kpi.totalGrossWeight!) * 100 : 0;

  // Radial ring helper (SVG-based mini ring gauge)
  const Ring = ({ pct, color, size = 52 }: { pct: number; color: string; size?: number }) => {
    const r = (size - 8) / 2;
    const circ = 2 * Math.PI * r;
    const dash = (Math.min(pct, 100) / 100) * circ;
    return (
      <svg width={size} height={size} className="shrink-0 -rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none" strokeWidth={5}
          className="stroke-gray-100 dark:stroke-midnight-700" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" strokeWidth={5}
          stroke={color} strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round" style={{ transition: 'stroke-dasharray .7s ease' }} />
      </svg>
    );
  };

  return (
    <div className="min-h-screen">
      <Header />
      <main className="w-full py-6 px-4 sm:px-6 lg:px-8 space-y-5">

        {/* ── Page header ── */}
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 shadow-lg">
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
          <div className="relative flex items-center justify-between px-6 py-5">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm shadow-inner shrink-0">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white leading-none tracking-tight">Live Dashboard</h2>
                <p className="text-xs text-blue-100 mt-1 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Auto-refreshes every 30 s
                  </span>
                  <span className="text-blue-200/60">·</span>
                  <span className="text-blue-100/80">
                    {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-[10px] font-medium uppercase tracking-widest text-blue-200/70">Last updated</span>
                <span className="text-sm font-semibold text-white tabular-nums">{fmtTime(lastRefreshed)}</span>
              </div>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-white/15 hover:bg-white/25 active:bg-white/30 text-white rounded-xl border border-white/20 transition-all disabled:opacity-50 backdrop-blur-sm shadow-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-40">
            <div className="text-center space-y-4">
              <div className="relative mx-auto w-14 h-14">
                <div className="absolute inset-0 rounded-full border-4 border-blue-100 dark:border-midnight-700" />
                <div className="absolute inset-0 rounded-full border-4 border-t-blue-500 animate-spin" />
                <div className="absolute inset-3 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-blue-500" />
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-700 dark:text-enterprise-silver">Loading dashboard…</p>
                <p className="text-xs text-gray-400 dark:text-enterprise-muted mt-0.5">Fetching live data from server</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* ── Row 1: 4 primary KPI cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Total Records',  value: kpi.totalRecords.toLocaleString(), sub: 'All-time transactions',   icon: BarChart3,    color: '#3b82f6', bg: 'bg-blue-50   dark:bg-blue-900/20',  ring: null },
                { label: "Today's Trips",  value: kpi.todayTrips.toLocaleString(),   sub: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }), icon: Truck, color: '#6366f1', bg: 'bg-indigo-50 dark:bg-indigo-900/20', ring: null },
                { label: 'This Week',      value: kpi.weekTrips.toLocaleString(),    sub: 'Since Monday',             icon: CalendarDays, color: '#8b5cf6', bg: 'bg-violet-50 dark:bg-violet-900/20', ring: null },
                { label: 'Total Gross Wt.',value: fmtTotalWeight(kpi.totalGrossWeight), sub: 'Cumulative all-time', icon: Scale, color: '#10b981', bg: 'bg-emerald-50 dark:bg-emerald-900/20', ring: null },
              ].map(c => {
                const Icon = c.icon;
                return (
                  <div key={c.label} className="group glass-card rounded-2xl hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 overflow-hidden">
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-enterprise-muted leading-tight">{c.label}</p>
                        <div className={`p-2 rounded-xl ${c.bg} shrink-0`}>
                          <Icon className="w-4 h-4" style={{ color: c.color }} />
                        </div>
                      </div>
                      <p className="text-3xl font-extrabold text-gray-900 dark:text-enterprise-text tabular-nums leading-none">{c.value}</p>
                      <p className="text-xs text-gray-400 dark:text-enterprise-muted mt-2">{c.sub}</p>
                    </div>
                    <div className="h-0.5 w-full" style={{ background: `linear-gradient(to right, ${c.color}60, transparent)` }} />
                  </div>
                );
              })}
            </div>

            {/* ── Row 2: Weight KPIs with ring gauges ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Total Net Wt.',   value: fmtTotalWeight(kpi.totalNetWeight),  sub: 'Net payload',          icon: Layers,    color: '#22c55e', bg: 'bg-green-50  dark:bg-green-900/20',  ringPct: netPct },
                { label: 'Total Tare Wt.',  value: fmtTotalWeight(kpi.totalTareWeight), sub: 'Vehicle weight',        icon: Minus,     color: '#f97316', bg: 'bg-orange-50 dark:bg-orange-900/20', ringPct: tarePct },
                { label: 'Avg Net Payload', value: fmtPct(kpi.avgNetPayloadPct),         sub: 'of gross per trip',     icon: TrendingUp, color: '#a855f7', bg: 'bg-purple-50 dark:bg-purple-900/20', ringPct: kpi.avgNetPayloadPct ?? 0 },
                { label: 'Avg Net Weight',  value: fmtAvgWeight(kpi.avgNetWeight),       sub: 'Per truck average',     icon: Package,   color: '#14b8a6', bg: 'bg-teal-50   dark:bg-teal-900/20',   ringPct: null },
              ].map(c => {
                const Icon = c.icon;
                return (
                  <div key={c.label} className="group glass-card rounded-2xl hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 overflow-hidden">
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-enterprise-muted leading-tight flex-1 pr-2">{c.label}</p>
                        {c.ringPct !== null ? (
                          <div className="relative shrink-0">
                            <Ring pct={c.ringPct} color={c.color} size={48} />
                            <div className={`absolute inset-0 flex items-center justify-center`}>
                              <Icon className="w-3.5 h-3.5" style={{ color: c.color }} />
                            </div>
                          </div>
                        ) : (
                          <div className={`p-2 rounded-xl ${c.bg} shrink-0`}>
                            <Icon className="w-4 h-4" style={{ color: c.color }} />
                          </div>
                        )}
                      </div>
                      <p className="text-2xl font-extrabold text-gray-900 dark:text-enterprise-text tabular-nums leading-none">{c.value}</p>
                      <p className="text-xs text-gray-400 dark:text-enterprise-muted mt-2">{c.sub}</p>
                    </div>
                    <div className="h-0.5 w-full" style={{ background: `linear-gradient(to right, ${c.color}60, transparent)` }} />
                  </div>
                );
              })}
            </div>

            {/* ── Row 3: Weight Composition + Smart Summary side-by-side ── */}
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">

              {/* Weight Composition */}
              {(kpi.totalGrossWeight ?? 0) > 0 && (
                <div className="xl:col-span-2 glass-card rounded-2xl p-5 flex flex-col">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-midnight-700">
                      <Scale className="w-4 h-4 text-gray-500 dark:text-enterprise-muted" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-800 dark:text-enterprise-silver leading-none">Weight Composition</h3>
                      <p className="text-xs text-gray-400 dark:text-enterprise-muted mt-0.5">Net + Tare = Gross</p>
                    </div>
                    <span className="ml-auto text-sm font-bold text-gray-900 dark:text-enterprise-text">{fmtTotalWeight(kpi.totalGrossWeight)}</span>
                  </div>

                  {/* Segmented bar */}
                  <div className="flex rounded-xl overflow-hidden h-7 gap-0.5 mb-4">
                    <div className="bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-700 flex items-center justify-center"
                      style={{ width: `${netPct}%` }}>
                      <span className="text-[11px] font-bold text-white px-1 hidden sm:block truncate">{netPct.toFixed(0)}%</span>
                    </div>
                    <div className="bg-gradient-to-r from-orange-400 to-amber-400 transition-all duration-700 flex items-center justify-center"
                      style={{ width: `${tarePct}%` }}>
                      <span className="text-[11px] font-bold text-white px-1 hidden sm:block truncate">{tarePct.toFixed(0)}%</span>
                    </div>
                  </div>

                  <div className="space-y-3 mt-auto">
                    {[
                      { label: 'Net Payload', value: fmtTotalWeight(kpi.totalNetWeight),  pct: netPct,  color: '#22c55e', grad: 'from-green-500 to-emerald-400' },
                      { label: 'Tare Weight', value: fmtTotalWeight(kpi.totalTareWeight), pct: tarePct, color: '#f97316', grad: 'from-orange-400 to-amber-400' },
                    ].map(seg => (
                      <div key={seg.label}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-sm bg-gradient-to-br ${seg.grad}`} />
                            <span className="text-xs font-medium text-gray-600 dark:text-enterprise-silver">{seg.label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-900 dark:text-enterprise-text">{seg.value}</span>
                            <span className="text-[10px] text-gray-400 dark:text-enterprise-muted tabular-nums">{seg.pct.toFixed(1)}%</span>
                          </div>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-midnight-700 rounded-full h-1.5 overflow-hidden">
                          <div className={`h-1.5 rounded-full bg-gradient-to-r ${seg.grad} transition-all duration-700`}
                            style={{ width: `${seg.pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Smart Summary */}
              <div className={`${(kpi.totalGrossWeight ?? 0) > 0 ? 'xl:col-span-3' : 'xl:col-span-5'} glass-card rounded-2xl overflow-hidden`}>
                <div className="px-5 py-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm shrink-0">
                    <Box className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white leading-none">Smart Summary</p>
                    <p className="text-xs text-blue-100/80 mt-0.5">
                      {aiSummary ? 'AI-generated · Cube AI' : aiLoading ? 'Generating with AI...' : 'Rule-based insights'}
                    </p>
                  </div>
                  {aiLoading ? (
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-white/10 border border-white/20 text-blue-100">
                      <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      AI
                    </span>
                  ) : aiSummary ? (
                    <span className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-violet-500/20 border border-violet-400/30 text-violet-200">
                      <Box className="w-3 h-3" />
                      AI
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Live
                    </span>
                  )}
                </div>
                <div className="px-5 py-4 space-y-3 h-full">
                  {(aiSummary ?? buildSummary(kpi, fmtTotalWeight, fmtPct, fmtAvgWeight)).map((sentence, i) => (
                    <div key={i} className="flex items-start gap-3 group/item">
                      <div className="mt-1.5 w-5 h-5 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800/50 flex items-center justify-center shrink-0">
                        <span className="text-[9px] font-bold text-blue-500">{i + 1}</span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-enterprise-silver leading-relaxed">{sentence}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Row 4: Today's Status + Recent Transactions ── */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

              {/* Today's Status */}
              <div className="glass-card rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-black/5 dark:border-white/8 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <h3 className="text-sm font-bold text-gray-800 dark:text-enterprise-silver">Today's Status</h3>
                  <span className="ml-auto px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-midnight-700 text-xs font-semibold text-gray-500 dark:text-enterprise-muted">
                    {kpi.todayTrips} trip{kpi.todayTrips !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="p-5">
                  {kpi.todayStatuses.length === 0 ? (
                    <div className="py-10 flex flex-col items-center text-center gap-3">
                      <div className="w-14 h-14 rounded-full bg-gray-50 dark:bg-midnight-800 flex items-center justify-center">
                        <CalendarDays className="w-7 h-7 text-gray-200 dark:text-enterprise-muted" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-400 dark:text-enterprise-muted">No transactions today</p>
                        <p className="text-xs text-gray-300 dark:text-enterprise-muted mt-0.5">
                          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long' })}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {kpi.todayStatuses.map(s => {
                        const pct = Math.round((s.count / Math.max(kpi.todayTrips, 1)) * 100);
                        return (
                          <div key={s.status} className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusColor(s.status)}`}>
                                {statusIcon(s.status)}
                                <span className="truncate max-w-[100px]">{s.status}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-400 dark:text-enterprise-muted">{pct}%</span>
                                <span className="text-sm font-bold text-gray-800 dark:text-enterprise-text w-5 text-right">{s.count}</span>
                              </div>
                            </div>
                            <div className="w-full bg-gray-100 dark:bg-midnight-700 rounded-full h-1.5 overflow-hidden">
                              <div className="h-1.5 rounded-full bg-gradient-to-r from-blue-500 to-indigo-400 transition-all duration-500"
                                style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Transactions */}
              <div className="xl:col-span-2 glass-card rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-black/5 dark:border-white/8 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                      <Truck className="w-4 h-4 text-blue-500" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-800 dark:text-enterprise-silver leading-none">Recent Transactions</h3>
                      <p className="text-xs text-gray-400 dark:text-enterprise-muted mt-0.5">Last 5 records</p>
                    </div>
                  </div>
                  <span className="hidden sm:flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full bg-gray-100 dark:bg-midnight-700 text-gray-400 dark:text-enterprise-muted">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    Live feed
                  </span>
                </div>
                {recent.length === 0 ? (
                  <div className="py-14 text-center">
                    <Truck className="w-10 h-10 text-gray-200 dark:text-enterprise-muted mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-400 dark:text-enterprise-muted">No records found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-midnight-800/60 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-enterprise-muted">
                          <th className="px-5 py-3 whitespace-nowrap">ID</th>
                          <th className="px-4 py-3 whitespace-nowrap">Plate</th>
                          <th className="px-4 py-3 whitespace-nowrap">Driver</th>
                          <th className="px-4 py-3 whitespace-nowrap">Product</th>
                          <th className="px-4 py-3 whitespace-nowrap">Gross Wt.</th>
                          <th className="px-4 py-3 whitespace-nowrap">Date</th>
                          <th className="px-4 py-3 whitespace-nowrap">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recent.map((row, idx) => (
                          <tr key={row.id}
                            className={`border-t border-gray-50 dark:border-midnight-700/50 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors ${idx === 0 ? 'bg-blue-50/20 dark:bg-blue-900/5' : ''}`}>
                            <td className="px-5 py-3 whitespace-nowrap">
                              <span className="font-mono text-xs font-semibold text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded">#{row.id}</span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-800 dark:text-enterprise-silver">{row.plate_no || '—'}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-enterprise-silver">{row.driver || '—'}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-enterprise-muted">{row.product || '—'}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-700 dark:text-enterprise-silver tabular-nums">
                              {row.gross_weight ? `${parseFloat(row.gross_weight).toLocaleString()} kg` : '—'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-400 dark:text-enterprise-muted tabular-nums">{fmtDate(getRowDate(row))}</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${statusColor(row.status)}`}>
                                {statusIcon(row.status)}
                                {row.status || '—'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          </>
        )}
      </main>
    </div>
  );
}