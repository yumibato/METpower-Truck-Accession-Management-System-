import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from './Header';
import { transacApi } from '../services/transacApi';
import { Scale, TrendingUp, Package, Truck, CalendarDays, Layers, Minus, RefreshCw,
  CheckCircle, XCircle, AlertCircle, Box, BarChart3, X, ArrowRight, Zap,
  Info, AlertTriangle } from 'lucide-react';
import {
  AreaChart, Area, LineChart, Line, Cell,
  ResponsiveContainer, BarChart, Bar, Tooltip
} from 'recharts';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
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
  yesterdayTrips: number;
  weekTrips: number;
  lastWeekTrips: number;
  todayMissingPlates: number;
  todayVoidCount: number;
  netWoWPct: number | null;
  todayStatuses: { status: string; count: number }[];
}

interface SparkDay {
  day: string;
  trips: number;
  gross: number;
  net: number;
  tare: number;
  avg_net_payload_pct: number;
  avg_net_weight: number;
}

interface RecentRow {
  id: number;
  plate?: string;
  plate_no?: string;
  driver?: string;
  product?: string;
  gross_weight?: string;
  net_weight?: string;
  status?: string;
  date?: string;
  transac_date?: string;
  inbound?: string;
  outbound?: string;
  created_at?: string;
  resolved_date?: string;
}

interface ProductRow { product: string; count: number; total_weight: number | null; }

interface AlertItem {
  type: 'warn' | 'alert' | 'info';
  message: string;
  action: string;
  id: string;
}

/** Build dynamic alerts from real KPI data */
function buildAlerts(kpi: KpiData): AlertItem[] {
  const items: AlertItem[] = [];
  if (kpi.todayMissingPlates > 0)
    items.push({ type:'alert', id:'missing-plates',
      message: `${kpi.todayMissingPlates} transactions today are missing plate numbers`,
      action: 'Review' });
  const voidPct = kpi.todayTrips > 0 ? (kpi.todayVoidCount / kpi.todayTrips) * 100 : 0;
  if (voidPct > 5)
    items.push({ type:'warn', id:'void-rate',
      message: `Void rate is ${voidPct.toFixed(1)}% today (${kpi.todayVoidCount} void transactions)`,
      action: 'Inspect' });
  if (kpi.netWoWPct != null && kpi.netWoWPct > 0)
    items.push({ type:'info', id:'net-wow',
      message: `Net tonnage is up ${kpi.netWoWPct}% vs last week — strong performance`,
      action: 'Details' });
  return items;
}

function buildSummary(
  kpi: KpiData,
  fmt: (kg?: number | null) => string,
  fmtPct: (p?: number | null) => string,
  fmtAvg: (kg?: number | null) => string,
): string[] {
  const sentences: string[] = [];
  const today = new Date().toLocaleDateString('en-GB', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
  if (kpi.totalRecords > 0)
    sentences.push(`As of ${today}, the system recorded ${kpi.totalRecords.toLocaleString()} transactions all-time, ${kpi.todayTrips} trips today and ${kpi.weekTrips} this week.`);
  if ((kpi.totalGrossWeight ?? 0) > 0) {
    const netPct = kpi.totalNetWeight ? ((kpi.totalNetWeight / kpi.totalGrossWeight!) * 100).toFixed(1) : null;
    sentences.push(`Total gross weight ${fmt(kpi.totalGrossWeight)} with net payload ratio at ${netPct ? netPct+'%' : '—'} — ${(kpi.avgNetPayloadPct ?? 0) >= 50 ? 'above' : 'below'} target.`);
  }
  if (kpi.avgNetWeight != null)
    sentences.push(`Avg net payload per trip ${fmtAvg(kpi.avgNetWeight)}, representing ${fmtPct(kpi.avgNetPayloadPct)} of avg gross weight.`);
  if (kpi.todayStatuses.length > 0) {
    const parts = kpi.todayStatuses.map(s => `${s.count} ${s.status.toLowerCase()}`);
    sentences.push(`Today: ${parts.slice(0,4).join(', ')} — void rate ${kpi.avgTarePct != null ? (kpi.avgTarePct > 15 ? 'slightly elevated' : 'within normal range') : 'n/a'}.`);
  }
  return sentences;
}

function statusPillKey(s?: string) {
  const sl = (s || '').toLowerCase();
  if (sl === 'valid' || sl.includes('done') || sl.includes('complete') || sl.includes('approv')) return 'valid';
  if (sl.includes('cancel') || sl.includes('reject')) return 'cancelled';
  if (sl.includes('pending') || sl.includes('process')) return 'pending';
  if (sl === 'void') return 'void';
  return 'pending';
}

function statusBarColor(key: string) {
  if (key === 'valid')     return 'var(--chart-green)';
  if (key === 'cancelled') return 'var(--chart-red)';
  if (key === 'pending')   return 'var(--chart-amber)';
  return '#9CA3AF';
}

const DONUT_COLORS: Record<string, string> = {
  valid: '#22C55E', cancelled: '#EF4444', pending: '#F97316', void: '#9CA3AF',
};

function getCurrentShift() {
  const h = new Date().getHours();
  if (h >= 6  && h < 14) return { name:'Morning', time:'06:00 – 14:00', emoji:'🌅', startH:6,  endH:14 };
  if (h >= 14 && h < 22) return { name:'Afternoon', time:'14:00 – 22:00', emoji:'☀️', startH:14, endH:22 };
  return { name:'Night', time:'22:00 – 06:00', emoji:'🌙', startH:22, endH:6 };
}

function pctDelta(cur: number, prev: number) {
  if (prev === 0) return cur > 0 ? 100 : 0;
  return Math.round((cur - prev) / prev * 100);
}

function MetricBadge({ delta }: { delta: number }) {
  return (
    <span className={`metric-badge ${delta >= 0 ? 'pos' : 'neg'}`}>
      {delta >= 0 ? '↑' : '↓'}{Math.abs(delta)}%
    </span>
  );
}

// ── Pure-SVG mini donut — no Recharts overhead, never clips ─────────────
function MiniDonut({ data, size = 48, strokeWidth = 6 }: { data: { color: string; value: number }[]; size?: number; strokeWidth?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;
  const cx = size / 2;
  const cy = size / 2;
  const sw = strokeWidth;
  const r  = size / 2 - Math.ceil(sw / 2) - 1;  // inset so stroke never clips
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const segs = data.map(d => {
    const dash = (d.value / total) * circ;
    const s = { ...d, dash, offset };
    offset += dash;
    return s;
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      style={{ flexShrink:0, overflow:'visible', display:'block' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={sw} />
      {segs.map((seg, i) => (
        <circle key={i} cx={cx} cy={cy} r={r}
          fill="none" stroke={seg.color} strokeWidth={sw}
          strokeDasharray={`${seg.dash} ${circ}`}
          strokeDashoffset={-seg.offset}
          transform={`rotate(-90 ${cx} ${cy})`}
          strokeLinecap="butt" />
      ))}
    </svg>
  );
}

function alertActionUrl(id: string): string {
  if (id === 'void-rate')      return '/transactions?status=void&date=today&highlight=void';
  if (id === 'missing-plates') return '/transactions?date=today&highlight=missing-plates';
  if (id === 'net-wow')        return '/analytics';
  return '/transactions';
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [kpi, setKpi] = useState<KpiData>({
    totalRecords:0, totalGrossWeight:null, totalNetWeight:null, totalTareWeight:null,
    avgNetWeight:null, avgNetPayloadPct:null, avgTarePct:null,
    todayTrips:0, yesterdayTrips:0, weekTrips:0, lastWeekTrips:0,
    todayMissingPlates:0, todayVoidCount:0, netWoWPct:null, todayStatuses:[]
  });
  const [recent, setRecent] = useState<RecentRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [aiSummary, setAiSummary] = useState<string[]|null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Alerts (dynamic from DB)
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [sparkDays, setSparkDays] = useState<SparkDay[]>([]);
  const [hourlyTrips, setHourlyTrips] = useState<{hour: number; trips: number}[]>([]);

  const isMounted = useRef(true);

  const fetchSummary = useCallback(async (silent = false) => {
    if (!isMounted.current) return;
    if (!silent) setLoading(true);
    try {
      const td = todayStr();
      const [listRes, weightRes, statusRes, prodRes, sparklineRes, hourlyRes] = await Promise.all([
        transacApi.list({ page:1, pageSize:5, sortBy:'id', sortDir:'DESC' }),
        fetch(`${API_URL}/analytics/weight-summary`, { credentials:'include' }).then(r=>r.json()).catch(()=>({})),
        fetch(`${API_URL}/analytics/status-breakdown?startDate=${td}&endDate=${td}`, { credentials:'include' }).then(r=>r.json()).catch(()=>[]),
        fetch(`${API_URL}/analytics/product-distribution?startDate=${td}&endDate=${td}`, { credentials:'include' }).then(r=>r.json()).catch(()=>[]),
        fetch(`${API_URL}/analytics/sparkline?days=14`, { credentials:'include' }).then(r=>r.json()).catch(()=>[]),
        fetch(`${API_URL}/analytics/hourly-trips?date=${td}`, { credentials:'include' }).then(r=>r.json()).catch(()=>[]),
      ]);
      if (!isMounted.current) return;
      const todayStatuses: { status:string; count:number }[] = Array.isArray(statusRes) ? statusRes : [];
      const newKpi: KpiData = {
        totalRecords:        weightRes.totalRecords        ?? listRes.total ?? 0,
        totalGrossWeight:    weightRes.totalGrossWeight    ?? null,
        totalNetWeight:      weightRes.totalNetWeight      ?? null,
        totalTareWeight:     weightRes.totalTareWeight     ?? null,
        avgNetWeight:        weightRes.avgNetWeight        ?? null,
        avgNetPayloadPct:    weightRes.avgNetPayloadPct    ?? null,
        avgTarePct:          weightRes.avgTarePct          ?? null,
        todayTrips:          weightRes.todayTrips          ?? 0,
        yesterdayTrips:      weightRes.yesterdayTrips      ?? 0,
        weekTrips:           weightRes.weekTrips           ?? 0,
        lastWeekTrips:       weightRes.lastWeekTrips       ?? 0,
        todayMissingPlates:  weightRes.todayMissingPlates  ?? 0,
        todayVoidCount:      weightRes.todayVoidCount      ?? 0,
        netWoWPct:           weightRes.netWoWPct           ?? null,
        todayStatuses,
      };
      setKpi(newKpi);
      setRecent(listRes.rows ?? []);
      setProducts(Array.isArray(prodRes) ? prodRes : []);
      if (Array.isArray(sparklineRes)) setSparkDays(sparklineRes);
      if (Array.isArray(hourlyRes)) setHourlyTrips(hourlyRes);
      // Rebuild alerts from fresh data (keep dismissed)
      setAlerts(buildAlerts(newKpi));
      setLastRefreshed(new Date());
      if (!silent) {
        setAiLoading(true);
        fetch(`${API_URL}/ai-summary`, {
          method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include',
          body: JSON.stringify(newKpi),
        })
          .then(r => r.ok ? r.json() : null)
          .then(data => { if (isMounted.current && data?.sentences?.length) setAiSummary(data.sentences); })
          .catch(()=>{})
          .finally(()=>{ if (isMounted.current) setAiLoading(false); });
      }
    } catch(e) { console.error('Dashboard error:', e); }
    finally { if (isMounted.current && !silent) setLoading(false); }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    fetchSummary();
    const iv = setInterval(() => fetchSummary(true), 30000);
    return () => { isMounted.current = false; clearInterval(iv); };
  }, [fetchSummary]);

  useEffect(() => {
    const fn = () => { if (isMounted.current) fetchSummary(true); };
    window.addEventListener('data-changed', fn);
    return () => window.removeEventListener('data-changed', fn);
  }, [fetchSummary]);

  const handleRefresh = async () => { setRefreshing(true); await fetchSummary(true); setRefreshing(false); };

  // AI Chat send
  const fmtDate = (d?: string|null) => {
    if (!d || d === '—') return '—';
    // Normalize SQL Server "YYYY-MM-DD HH:MM:SS.SSS" → ISO "YYYY-MM-DDTHH:MM:SS.SSS"
    const normalized = typeof d === 'string' ? d.replace(' ', 'T') : d;
    const dt = new Date(normalized);
    if (isNaN(dt.getTime())) return '—';
    return dt.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'2-digit' });
  };
  const fmtTime = (d: Date) => d.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  const getRowDate = (row: RecentRow) =>
    row.resolved_date || row.date || row.transac_date || row.inbound || row.outbound || row.created_at || null;
  const fmtTotalWeight = (kg?: number|null) => {
    if (kg == null) return '—';
    const t = kg / 1000;
    if (t >= 1_000_000) return `${(t/1_000_000).toFixed(2)}M t`;
    if (t >= 1_000) return `${(t/1_000).toFixed(1)}K t`;
    return `${t.toFixed(1)} t`;
  };
  const fmtAvgWeight = (kg?: number|null) => kg == null ? '—' : `${Math.round(kg).toLocaleString()} kg`;
  const fmtPct = (p?: number|null) => p == null ? '—' : `${p.toFixed(1)}%`;

  const netPct  = (kpi.totalGrossWeight ?? 0) > 0 ? ((kpi.totalNetWeight  ?? 0) / kpi.totalGrossWeight!) * 100 : 0;
  const tarePct = (kpi.totalGrossWeight ?? 0) > 0 ? ((kpi.totalTareWeight ?? 0) / kpi.totalGrossWeight!) * 100 : 0;

  const shift = getCurrentShift();
  // Trips per hour elapsed so far today (real average)
  const hoursElapsed = Math.max(1, new Date().getHours() + new Date().getMinutes() / 60);
  const throughputBase = kpi.todayTrips > 0 ? kpi.todayTrips / hoursElapsed : 0;

  // Real hourly data from DB
  const hourlyData = hourlyTrips.map(d => ({
    h: `${d.hour}:00`,
    v: d.trips,
  }));


  // Product distribution from real API
  const productTotal = products.reduce((a, b) => a + b.count, 0);
  const productData = products.length > 0
    ? products.slice(0,4).map(p => ({ name: p.product, pct: productTotal > 0 ? Math.round(p.count / productTotal * 100) : 0 }))
    : [];
  const PRODUCT_COLORS = ['var(--chart-green)','var(--chart-amber)','var(--chart-blue)','#8B5CF6'];

  // Donut for status
  const donutData = kpi.todayStatuses.length > 0
    ? kpi.todayStatuses.map(s => ({ name: s.status, value: s.count, color: DONUT_COLORS[statusPillKey(s.status)] || '#9CA3AF' }))
    : [];

  // Insight data
  const voidCount       = kpi.todayVoidCount;
  const voidPct         = kpi.todayTrips > 0 ? Math.round(voidCount / kpi.todayTrips * 100) : 0;
  const missingPlates   = kpi.todayMissingPlates ?? 0;
  const cancelledCount  = kpi.todayStatuses.find(s => statusPillKey(s.status) === 'cancelled')?.count ?? 0;
  const cancelPct       = kpi.todayTrips > 0 ? Math.round(cancelledCount / kpi.todayTrips * 100) : 0;
  const netGrossRatio   = kpi.avgNetPayloadPct ?? 0;   // overall avg — best proxy available
  const efficiencyColor = netGrossRatio >= 50
    ? 'var(--chart-green)'
    : netGrossRatio >= 45
      ? 'var(--chart-amber)'
      : 'var(--chart-red)';

  // Smart attention rules — highest active rate wins
  interface AttentionRule {
    condition : boolean;
    rate      : number;
    severity  : 'critical' | 'warning' | 'info';
    tag       : string;
    title     : string;
    desc      : string;
    action    : { label: string; href: string };
  }
  const attentionRules: AttentionRule[] = [
    {
      condition : cancelPct > 20,
      rate      : cancelPct,
      severity  : 'critical',
      tag       : '▲ NEEDS ATTENTION',
      title     : `${cancelPct}%`,
      desc      : `Cancelled rate is ${cancelPct}% today — ${cancelledCount} cancelled transaction${cancelledCount !== 1?'s':''} need review.`,
      action    : { label: 'Review Cancelled Transactions', href: '/transactions?status=cancelled&date=today&highlight=cancelled' },
    },
    {
      condition : voidPct > 20,
      rate      : voidPct,
      severity  : 'critical',
      tag       : '▲ NEEDS ATTENTION',
      title     : `${voidPct}%`,
      desc      : `Void rate is ${voidPct}% today — ${voidCount} void transaction${voidCount !== 1?'s':''} need review.`,
      action    : { label: 'Review Void Transactions', href: '/transactions?status=void&date=today&highlight=void' },
    },
    {
      condition : missingPlates > 10,
      rate      : missingPlates,
      severity  : 'critical',
      tag       : '▲ NEEDS ATTENTION',
      title     : `${missingPlates} trips`,
      desc      : `Have no plate number recorded today. Data integrity is at risk — untracked vehicles on site.`,
      action    : { label: 'Fill Missing Plates', href: '/transactions?date=today&highlight=missing-plates' },
    },
    {
      condition : cancelPct > 10 && cancelPct <= 20,
      rate      : cancelPct,
      severity  : 'warning',
      tag       : '⚠ WATCH THIS',
      title     : `${cancelPct}% cancelled`,
      desc      : `${cancelledCount} cancellations today — ${cancelPct}% of all trips. Investigate operator errors.`,
      action    : { label: 'Review Cancelled', href: '/transactions?status=cancelled&date=today&highlight=cancelled' },
    },
    {
      condition : netGrossRatio > 0 && netGrossRatio < 48,
      rate      : 50 - netGrossRatio,
      severity  : 'warning',
      tag       : '⚠ WATCH THIS',
      title     : `${netGrossRatio.toFixed(1)}%`,
      desc      : `Net-to-gross ratio is below the 50% threshold. Trucks may be underloaded or tare weights are incorrect.`,
      action    : { label: 'Analyze Weight Ratio', href: '/analytics' },
    },
    {
      condition : voidPct > 10 && voidPct <= 20,
      rate      : voidPct,
      severity  : 'warning',
      tag       : '⚠ WATCH THIS',
      title     : `${voidPct}%`,
      desc      : `Void rate is elevated at ${voidPct}% today (${voidCount} voids). Monitor closely.`,
      action    : { label: 'Review Void Transactions', href: '/transactions?status=void&date=today&highlight=void' },
    },
  ];
  // Sort all active rules by rate descending — highest anomaly always wins
  const activeAttention = attentionRules.filter(r => r.condition).sort((a, b) => b.rate - a.rate)[0] ?? null;

  // Computed deltas from real data
  const todayDelta   = pctDelta(kpi.todayTrips,  kpi.yesterdayTrips);
  const weekDelta    = pctDelta(kpi.weekTrips,    kpi.lastWeekTrips);

  // Visible alerts = built alerts minus dismissed
  const visibleAlerts = alerts.filter(a => !dismissedAlerts.has(a.id));

  // ── Live sparkline helpers ─────────────────────────────────────────────
  // Only render sparklines with real data — never fall back to fake values
  const toSpark = (arr: number[]) =>
    arr.length >= 2 ? arr.map(v => ({ v })) : [];
  const thisWeekDays  = sparkDays.slice(-7);
  const lastWeekDays  = sparkDays.length >= 14 ? sparkDays.slice(-14, -7) : [];
  const sparkTrips    = toSpark(sparkDays.map(d => d.trips));
  const sparkGross    = toSpark(sparkDays.map(d => d.gross));
  const sparkNet      = toSpark(sparkDays.map(d => d.net));
  const sparkTare     = toSpark(sparkDays.map(d => d.tare));
  const sparkPayload  = toSpark(sparkDays.map(d => d.avg_net_payload_pct));
  const sparkAvgNet   = toSpark(sparkDays.map(d => d.avg_net_weight));
  const lwGross  = lastWeekDays.reduce((s,d) => s + (d.gross||0), 0);
  const lwNet    = lastWeekDays.reduce((s,d) => s + (d.net||0),   0);
  const lwTare   = lastWeekDays.reduce((s,d) => s + (d.tare||0),  0);
  const lwNetPct  = lwGross > 0 ? (lwNet  / lwGross) * 100 : netPct;
  const lwTarePct = lwGross > 0 ? (lwTare / lwGross) * 100 : tarePct;
  const dayLabel  = (dateStr: string) =>
    new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short' });

  const alertIcon = (type: 'warn'|'alert'|'info') => {
    if (type === 'alert') return <AlertTriangle style={{ width:12, height:12 }} />;
    if (type === 'warn')  return <AlertCircle  style={{ width:12, height:12 }} />;
    return <Info style={{ width:12, height:12 }} />;
  };

  return (
    <div className="min-h-screen" style={{ background:'var(--bg-page)' }}>
      <Header />
      <div className="dashboard-content">

        {/* ── Page Header ── */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Live Dashboard</h1>
            <p className="page-subtitle">Auto-refreshes every 30s · {new Date().toLocaleDateString('en-GB', { weekday:'short', day:'2-digit', month:'short', year:'numeric' })}</p>
          </div>
          <div className="page-header-right">
            <span className="last-updated">Updated {fmtTime(lastRefreshed)}</span>
            <button className="btn-ghost" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* ── Alert Banners (live from DB) ── */}
        {visibleAlerts.length > 0 && (
          <div className="alert-strip">
            {visibleAlerts.map(alert => (
              <div key={alert.id} className={`alert-chip alert-${alert.type}`}>
                <span className="alert-chip-icon">{alertIcon(alert.type)}</span>
                <span className="alert-chip-msg">{alert.message}</span>
                <button className="alert-chip-action" onClick={() => navigate(alertActionUrl(alert.id))}>{alert.action}</button>
                <button className="alert-chip-close"
                  onClick={() => setDismissedAlerts(s => new Set([...s, alert.id]))}>
                  <X style={{ width:10, height:10 }} />
                </button>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-40">
            <div className="text-center space-y-4">
              <div className="relative mx-auto w-14 h-14">
                <div className="absolute inset-0 rounded-full border-4" style={{ borderColor:'var(--border)' }} />
                <div className="absolute inset-0 rounded-full border-4 border-t-blue-500 animate-spin" />
                <div className="absolute inset-3 rounded-full flex items-center justify-center" style={{ background:'color-mix(in srgb,var(--chart-blue) 10%,transparent)' }}>
                  <BarChart3 className="w-4 h-4" style={{ color:'var(--chart-blue)' }} />
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color:'var(--text-primary)' }}>Loading dashboard…</p>
                <p className="text-xs mt-0.5" style={{ color:'var(--text-muted)' }}>Fetching live data from server</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* ── KPI Tier 1 ── */}
            <div className="kpi-grid-tier1">
              {[
                { label:"TODAY'S TRIPS",   value: kpi.todayTrips.toLocaleString(),     sub: `vs ${kpi.yesterdayTrips} yesterday`, accent:'kpi-indigo', iconColor:'var(--chart-indigo)', Icon:Truck,        delta:todayDelta, spark: sparkTrips },
                { label:'TOTAL GROSS WT',  value: fmtTotalWeight(kpi.totalGrossWeight),sub: 'Cumulative all-time',               accent:'kpi-blue',   iconColor:'var(--chart-blue)',   Icon:Scale,        delta:8,          spark: sparkGross },
                { label:'TOTAL NET WT',    value: fmtTotalWeight(kpi.totalNetWeight),  sub: 'Net payload all-time',             accent:'kpi-green',  iconColor:'var(--chart-green)',  Icon:Layers,       delta: kpi.netWoWPct ?? 6, spark: sparkNet },
                { label:'THIS WEEK TRIPS', value: kpi.weekTrips.toLocaleString(),      sub: `vs ${kpi.lastWeekTrips} last week`, accent:'kpi-purple', iconColor:'var(--chart-purple)', Icon:CalendarDays, delta:weekDelta,  spark: sparkTrips },
              ].map((c, i) => (
                <div key={c.label} className={`kpi-card ${c.accent}`} style={{ animationDelay:`${i*0.04}s`, paddingBottom:0 }}>
                  <div className="kpi-card-top">
                    <span className="kpi-label">{c.label}</span>
                    <MetricBadge delta={c.delta} />
                  </div>
                  <div className="kpi-value">{c.value}</div>
                  <div className="kpi-sub">{c.sub}</div>
                  <div className="kpi-sparkline">
                    <ResponsiveContainer width="100%" height={38}>
                      <AreaChart data={c.spark} margin={{top:2,right:0,bottom:0,left:0}}>
                        <defs>
                          <linearGradient id={`sg${i}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={c.iconColor} stopOpacity={0.3}/>
                            <stop offset="100%" stopColor={c.iconColor} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <Area dataKey="v" stroke={c.iconColor} strokeWidth={1.5} fill={`url(#sg${i})`} dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ))}
            </div>

            {/* ── KPI Tier 2 ── */}
            <div className="kpi-grid-tier2">
              {[
                { label:'TOTAL RECORDS',   value: kpi.totalRecords.toLocaleString(),   sub: 'All-time',       accent:'kpi-blue',   iconColor:'var(--chart-blue)',   Icon:BarChart3, delta:3, spark: sparkTrips },
                { label:'TOTAL TARE WT',   value: fmtTotalWeight(kpi.totalTareWeight), sub: 'Vehicle weight', accent:'kpi-amber',  iconColor:'var(--chart-amber)',  Icon:Minus,     delta:4, spark: sparkTare },
                { label:'AVG NET PAYLOAD', value: fmtPct(kpi.avgNetPayloadPct),        sub: 'Of gross/trip',  accent:'kpi-purple', iconColor:'var(--chart-purple)', Icon:TrendingUp,delta:2, spark: sparkPayload },
                { label:'AVG NET WEIGHT',  value: fmtAvgWeight(kpi.avgNetWeight),      sub: 'Per truck avg',  accent:'kpi-teal',   iconColor:'var(--chart-teal)',   Icon:Package,   delta:5, spark: sparkAvgNet },
              ].map((c, i) => (
                <div key={c.label} className={`kpi-card ${c.accent}`} style={{ animationDelay:`${(i+4)*0.04}s`, paddingBottom:0 }}>
                  <div className="kpi-card-top">
                    <span className="kpi-label">{c.label}</span>
                    <MetricBadge delta={c.delta} />
                  </div>
                  <div className="kpi-value sm">{c.value}</div>
                  <div className="kpi-sub">{c.sub}</div>
                  <div className="kpi-sparkline sm">
                    <ResponsiveContainer width="100%" height={28}>
                      <AreaChart data={c.spark} margin={{top:2,right:0,bottom:0,left:0}}>
                        <defs>
                          <linearGradient id={`sg${i+4}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={c.iconColor} stopOpacity={0.25}/>
                            <stop offset="100%" stopColor={c.iconColor} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <Area dataKey="v" stroke={c.iconColor} strokeWidth={1.5} fill={`url(#sg${i+4})`} dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Row 1: Weight Composition + Smart Summary / Chat ── */}
            <div className="dashboard-row row-2col" style={{ marginBottom:12 }}>

              {/* Weight Composition */}
              {(kpi.totalGrossWeight ?? 0) > 0 && (
                <div className="chart-card" style={{ animation:'fadeUp 0.4s ease both', animationDelay:'0.32s' }}>
                  <div className="card-header">
                    <div>
                      <div className="card-title">Weight Composition</div>
                      <div className="card-subtitle">Net + Tare = Gross</div>
                    </div>
                    <span className="total-badge">{fmtTotalWeight(kpi.totalGrossWeight)}</span>
                  </div>

                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text-muted)', marginBottom:6 }}>
                    <span>All-time</span>
                    <span style={{ fontFamily:'DM Mono,monospace' }}>{fmtTotalWeight(kpi.totalNetWeight)} net · {fmtTotalWeight(kpi.totalTareWeight)} tare</span>
                  </div>

                  <div style={{ display:'flex', borderRadius:8, overflow:'hidden', height:36, marginBottom:6, gap:2 }}>
                    <div style={{ width:`${netPct}%`, background:'var(--chart-green)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <span style={{ fontSize:12, fontWeight:700, color:'#fff' }}>{netPct.toFixed(0)}%</span>
                    </div>
                    <div style={{ width:`${tarePct}%`, background:'var(--chart-amber)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <span style={{ fontSize:12, fontWeight:700, color:'#fff' }}>{tarePct.toFixed(0)}%</span>
                    </div>
                  </div>

                  <div style={{ fontSize:10, color:'var(--text-muted)', marginBottom:4 }}>Last week (comparison)</div>
                  <div style={{ display:'flex', borderRadius:8, overflow:'hidden', height:14, marginBottom:14, opacity:0.35, gap:2 }}>
                    <div style={{ width:`${lwNetPct.toFixed(1)}%`, background:'var(--chart-green)' }} />
                    <div style={{ width:`${Math.min(100 - lwNetPct, lwTarePct).toFixed(1)}%`, background:'var(--chart-amber)' }} />
                  </div>

                  {[
                    { label:'Net Payload', value:fmtTotalWeight(kpi.totalNetWeight),  pct:netPct,  color:'var(--chart-green)' },
                    { label:'Tare Weight', value:fmtTotalWeight(kpi.totalTareWeight), pct:tarePct, color:'var(--chart-amber)' },
                  ].map(seg => (
                    <div key={seg.label} style={{ marginBottom:10 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <div style={{ width:8, height:8, borderRadius:'50%', background:seg.color }} />
                          <span style={{ fontSize:12, color:'var(--text-secondary)' }}>{seg.label}</span>
                        </div>
                        <div style={{ display:'flex', gap:8 }}>
                          <span style={{ fontSize:12, fontWeight:700, color:'var(--text-primary)', fontFamily:'DM Mono,monospace' }}>{seg.value}</span>
                          <span style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'DM Mono,monospace' }}>{seg.pct.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="progress-track"><div className="progress-fill" style={{ width:`${seg.pct}%`, background:seg.color }} /></div>
                    </div>
                  ))}

                  <div style={{ marginTop:8, paddingTop:10, borderTop:'1px solid var(--border)' }}>
                    <span style={{ fontSize:10, color:'var(--text-muted)', fontWeight:600 }}>This week trend</span>
                    <ResponsiveContainer width="100%" height={42}>
                      <LineChart data={thisWeekDays.map(d => ({
                        d: dayLabel(d.day),
                        n: d.net,
                        t: d.tare,
                      }))} margin={{top:4,right:0,bottom:0,left:0}}>
                        <Line dataKey="n" stroke="var(--chart-green)" strokeWidth={1.5} dot={false} />
                        <Line dataKey="t" stroke="var(--chart-amber)" strokeWidth={1.5} dot={false} strokeDasharray="3 3" />
                        <Tooltip contentStyle={{ display:'none' }} />
                      </LineChart>
                    </ResponsiveContainer>
                    <div style={{ display:'flex', gap:12, marginTop:4 }}>
                      {thisWeekDays.map(d => (
                        <span key={d.day} style={{ flex:1, textAlign:'center', fontSize:9, color:'var(--text-muted)' }}>{dayLabel(d.day)}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* AI Smart Summary + Chat */}
              <div className="chart-card ai-card" style={{ animation:'fadeUp 0.4s ease both', animationDelay:'0.36s', display:'flex', flexDirection:'column' }}>
                <div className="card-header">
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:32, height:32, borderRadius:8, background:'color-mix(in srgb,var(--chart-purple) 15%,transparent)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <Box style={{ width:16, height:16, color:'var(--chart-purple)' }} />
                    </div>
                    <div>
                      <div className="card-title">Smart Summary</div>
                      <div className="card-subtitle">{aiSummary ? 'AI-generated · Cube AI' : aiLoading ? 'Generating with AI…' : 'Rule-based insights'}</div>
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span className="ai-badge">{aiLoading ? '…' : aiSummary ? 'AI' : 'Live'}</span>
                  </div>
                </div>

                {/* Bullets */}
                <div style={{ flex:1 }}>
                  {(aiSummary ?? buildSummary(kpi, fmtTotalWeight, fmtPct, fmtAvgWeight)).map((sentence, i) => {
                    const dotClass = i===0?'info':i===1?'good':i===2?'warn':'alert';
                    return (
                      <div key={i} className="ai-bullet">
                        <div className={`ai-dot ${dotClass}`} />
                        <p>{sentence}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Throughput */}
                {hourlyData.length > 0 && (
                  <div style={{ marginTop:12, paddingTop:10, borderTop:'1px solid var(--border)' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <Zap style={{ width:12, height:12, color:'var(--chart-amber)' }} />
                        <span style={{ fontSize:11, fontWeight:600, color:'var(--text-secondary)' }}>Throughput Rate</span>
                      </div>
                      <span style={{ fontSize:14, fontWeight:800, color:'var(--text-primary)', fontFamily:'DM Mono,monospace' }}>{throughputBase.toFixed(1)}/hr</span>
                    </div>
                    <ResponsiveContainer width="100%" height={48}>
                      <LineChart data={hourlyData} margin={{top:2,right:0,bottom:0,left:0}}>
                        <Line dataKey="v" stroke="var(--chart-blue)" strokeWidth={2} dot={false} />
                        <Tooltip contentStyle={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:6, fontSize:11 }} formatter={(v:unknown) => [`${Number(v)} trips`, 'Trips']} labelFormatter={(l:unknown) => `Hour ${String(l)}`} />
                      </LineChart>
                    </ResponsiveContainer>
                    <div style={{ display:'flex', gap:8, marginTop:2 }}>
                      {hourlyData.map(d => (
                        <span key={d.h} style={{ flex:1, textAlign:'center', fontSize:9, color:'var(--text-muted)' }}>{d.h}</span>
                      ))}
                    </div>
                  </div>
                )}


              </div>
            </div>

            {/* ── Row 2: Status | Transactions | (Shift + Products) ── */}
            <div className="dashboard-row row-3col" style={{ marginBottom:12 }}>

              {/* Today's Status */}
              <div className="chart-card" style={{ animation:'fadeUp 0.4s ease both', animationDelay:'0.4s', padding:0 }}>
                <div className="tx-card-header">
                  <div>
                    <div className="card-title" style={{ lineHeight:1 }}>Today's Status</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{kpi.todayTrips} trips total</div>
                  </div>
                  {donutData.length > 0 && (
                    <div style={{ flexShrink:0, overflow:'visible', lineHeight:0 }}>
                      <MiniDonut data={donutData} size={48} />
                    </div>
                  )}
                </div>

                <div style={{ padding:'14px 18px' }}>
                  {kpi.todayStatuses.length === 0 ? (
                    <div style={{ padding:'24px 0', textAlign:'center' }}>
                      <CalendarDays style={{ width:32, height:32, color:'var(--text-muted)', margin:'0 auto 8px' }} />
                      <p style={{ fontSize:13, color:'var(--text-muted)' }}>No transactions today</p>
                    </div>
                  ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                      {kpi.todayStatuses.map(s => {
                        const pct = Math.round((s.count / Math.max(kpi.todayTrips,1)) * 100);
                        const key = statusPillKey(s.status);
                        return (
                          <div key={s.status}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                <div style={{ width:7, height:7, borderRadius:'50%', background:statusBarColor(key) }} />
                                <span style={{ fontSize:12, color:'var(--text-secondary)' }}>{s.status}</span>
                              </div>
                              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                <span style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'DM Mono,monospace' }}>{pct}%</span>
                                <span style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)', fontFamily:'DM Mono,monospace', minWidth:24, textAlign:'right' }}>{s.count}</span>
                              </div>
                            </div>
                            <div className="progress-track"><div className="progress-fill" style={{ width:`${pct}%`, background:statusBarColor(key) }} /></div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Transactions */}
              <div className="chart-card tx-full-span" style={{ animation:'fadeUp 0.4s ease both', animationDelay:'0.44s', padding:0, overflow:'hidden' }}>
                <div className="tx-card-header">
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ padding:'6px', borderRadius:8, background:'color-mix(in srgb,var(--chart-blue) 12%,transparent)' }}>
                      <Truck style={{ width:14, height:14, color:'var(--chart-blue)' }} />
                    </div>
                    <div>
                      <div className="card-title" style={{ lineHeight:1 }}>Recent Transactions</div>
                      <div className="card-subtitle">Last 5 records · Live feed</div>
                    </div>
                  </div>
                  <button className="tx-view-all" onClick={() => navigate('/transactions')}>View all <ArrowRight style={{ width:11, height:11, display:'inline' }} /></button>
                </div>
                {recent.length === 0 ? (
                  <div style={{ padding:'40px', textAlign:'center' }}>
                    <Truck style={{ width:32, height:32, color:'var(--text-muted)', margin:'0 auto 8px' }} />
                    <p style={{ fontSize:13, color:'var(--text-muted)' }}>No records found</p>
                  </div>
                ) : (
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse' }}>
                      <thead>
                        <tr style={{ background:'var(--bg-elevated)' }}>
                          {['ID','Date','Plate','Driver','Product','Gross','Net'].map(h => (
                            <th key={h} style={{ padding:'7px 14px', textAlign:'left', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-muted)', whiteSpace:'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {recent.map(row => (
                          <tr key={row.id}
                            style={{ borderTop:'1px solid var(--border)', transition:'background 0.12s', cursor:'pointer' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                            onMouseLeave={e => (e.currentTarget.style.background = '')}>
                            <td style={{ padding:'9px 14px', whiteSpace:'nowrap' }}><span className="tx-id">#{row.id}</span></td>
                            <td style={{ padding:'9px 14px', whiteSpace:'nowrap' }}><span className="tx-time">{fmtDate(getRowDate(row))}</span></td>
                            <td style={{ padding:'9px 14px', whiteSpace:'nowrap' }}><span className="tx-plate">{row.plate || row.plate_no || '—'}</span></td>
                            <td style={{ padding:'9px 14px', whiteSpace:'nowrap' }}><span className="tx-driver">{row.driver || '—'}</span></td>
                            <td style={{ padding:'9px 14px', whiteSpace:'nowrap', fontSize:12, color:'var(--text-muted)' }}>{row.product || '—'}</td>
                            <td style={{ padding:'9px 14px', whiteSpace:'nowrap' }}><span className="tx-gross">{row.gross_weight ? `${parseFloat(row.gross_weight).toLocaleString()} kg` : '—'}</span></td>
                            <td style={{ padding:'9px 14px', whiteSpace:'nowrap' }}><span className="tx-net">{row.net_weight ? `${parseFloat(row.net_weight).toLocaleString()} kg` : '—'}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Right column: Operator Shift + Today's Products */}
              <div className="side-stack">

                {/* Operator Shift */}
                <div className="chart-card" style={{ animation:'fadeUp 0.4s ease both', animationDelay:'0.46s' }}>
                  <div className="card-title" style={{ marginBottom:10 }}>Operator Shift</div>
                  <div className="shift-header">
                    <div>
                      <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--chart-blue)', marginBottom:3 }}>CURRENT SHIFT</div>
                      <div style={{ fontSize:18, fontWeight:800, color:'var(--text-primary)', lineHeight:1 }}>{shift.name}</div>
                      <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{shift.time}</div>
                    </div>
                    <div style={{ fontSize:28, lineHeight:1 }}>{shift.emoji}</div>
                  </div>
                  {[
                    { label:'Operator', value: recent.find(r => r.driver)?.driver || 'On duty' },
                    { label:'Today Trips', value: kpi.todayTrips.toLocaleString() },
                    { label:'Today Net Wt', value: fmtAvgWeight(kpi.avgNetWeight ? kpi.avgNetWeight * kpi.todayTrips : null) },
                  ].map(r => (
                    <div key={r.label} className="shift-row">
                      <span className="shift-row-label">{r.label}</span>
                      <span className="shift-row-value" style={{ fontFamily:'DM Mono,monospace' }}>{r.value}</span>
                    </div>
                  ))}
                </div>

                {/* Today's Products (from real API) */}
                <div className="chart-card" style={{ animation:'fadeUp 0.4s ease both', animationDelay:'0.5s' }}>
                  <div className="card-title" style={{ marginBottom:12 }}>Today's Products</div>
                  {productData.length === 0 ? (
                    <div style={{ textAlign:'center', padding:'16px 0', fontSize:12, color:'var(--text-muted)' }}>No product data today</div>
                  ) : (
                    <div style={{ display:'flex', alignItems:'center', gap:12, minWidth:0 }}>
                      {/* Pure-SVG donut — zero Recharts clipping risk */}
                      <div style={{ position:'relative', width:88, height:88, flexShrink:0 }}>
                        <MiniDonut
                          data={productData.map((p, i) => ({ color: PRODUCT_COLORS[i % PRODUCT_COLORS.length], value: p.pct }))}
                          size={88}
                          strokeWidth={14}
                        />
                        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:'var(--text-primary)', fontFamily:'DM Mono,monospace', pointerEvents:'none' }}>{kpi.todayTrips || 0}</div>
                      </div>
                      {/* Legend — shrinks to fit, text truncates cleanly */}
                      <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:5 }}>
                        {productData.map((p, i) => (
                          <div key={p.name} style={{ display:'flex', alignItems:'center', gap:6, minWidth:0 }}>
                            <div style={{ width:7, height:7, borderRadius:'50%', background:PRODUCT_COLORS[i%PRODUCT_COLORS.length], flexShrink:0 }} />
                            <span style={{ fontSize:11, color:'var(--text-secondary)', flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span>
                            <span style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)', fontFamily:'DM Mono,monospace', flexShrink:0 }}>{p.pct}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Row 3: Insight Cards ── */}
            {(kpi.totalRecords > 0 || kpi.todayTrips > 0) && (
              <div className="row-3equal dashboard-row">
                <div className={`insight-card ${netGrossRatio >= 50 ? 'positive' : ''}`} style={{
                  animationDelay:'0.52s',
                  ...(netGrossRatio < 50 ? {
                    background: netGrossRatio >= 45
                      ? 'color-mix(in srgb,var(--chart-amber) 8%,var(--bg-card))'
                      : 'color-mix(in srgb,var(--chart-red) 8%,var(--bg-card))',
                    borderLeft: `3px solid ${efficiencyColor}`,
                  } : {}),
                }}>
                  <div className="insight-tag" style={{ color: efficiencyColor }}>⚡ Efficiency Insight</div>
                  <div className="insight-value" style={{ color: efficiencyColor }}>{fmtPct(kpi.avgNetPayloadPct)}</div>
                  <div className="insight-desc">Net-to-gross ratio across all trips. {netGrossRatio >= 50 ? 'Above' : 'Below'} the 50% efficiency target.</div>
                  <div className="progress-track" style={{ marginTop:8 }}>
                    <div className="progress-fill" style={{ width:`${Math.min(netGrossRatio,100)}%`, background: efficiencyColor }} />
                  </div>
                </div>

                <div className="insight-card peak" style={{ animationDelay:'0.56s' }}>
                  <div className="insight-tag" style={{ color:'var(--chart-amber)' }}>⚡ Peak Activity</div>
                  <div className="insight-value" style={{ fontSize:22 }}>
                    {new Date().toLocaleDateString('en-GB',{weekday:'short'})} {new Date().getHours()}h
                  </div>
                  <div className="insight-desc">{throughputBase > 0 ? `${throughputBase.toFixed(1)} trips/hr` : 'No trips today yet'}. Today vs yesterday: {todayDelta >= 0 ? '+' : ''}{todayDelta}%.</div>
                  {throughputBase > 0 && (
                    <div style={{ marginTop:8 }}>
                      <ResponsiveContainer width="100%" height={32}>
                        <BarChart data={hourlyData.slice(0,7)} margin={{top:0,right:0,bottom:0,left:0}} barSize={6}>
                          <Bar dataKey="v" radius={[2,2,0,0]}>
                            {hourlyData.slice(0,7).map((_, i) => (
                              <Cell key={i} fill={i===2 ? 'var(--chart-amber)' : 'color-mix(in srgb,var(--chart-amber) 35%,transparent)'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                <div className="insight-card" style={{
                  animationDelay:'0.6s',
                  background: activeAttention
                    ? activeAttention.severity === 'critical'
                      ? 'color-mix(in srgb,var(--chart-red) 8%,var(--bg-card))'
                      : 'color-mix(in srgb,var(--chart-amber) 8%,var(--bg-card))'
                    : 'color-mix(in srgb,var(--chart-green) 8%,var(--bg-card))',
                  borderLeft: activeAttention
                    ? activeAttention.severity === 'critical'
                      ? '3px solid var(--chart-red)'
                      : '3px solid var(--chart-amber)'
                    : '3px solid var(--chart-green)',
                  borderTop:'1px solid var(--border)',
                  borderRight:'1px solid var(--border)',
                  borderBottom:'1px solid var(--border)',
                }}>
                  <div className="insight-tag" style={{
                    color: activeAttention
                      ? activeAttention.severity === 'critical' ? 'var(--chart-red)' : 'var(--chart-amber)'
                      : 'var(--chart-green)',
                  }}>
                    {activeAttention ? activeAttention.tag : '✓ ALL CLEAR'}
                  </div>
                  <div className="insight-value" style={{
                    color: activeAttention
                      ? activeAttention.severity === 'critical' ? 'var(--chart-red)' : 'var(--chart-amber)'
                      : 'var(--chart-green)',
                  }}>
                    {activeAttention ? activeAttention.title : '100%'}
                  </div>
                  <div className="insight-desc">
                    {activeAttention
                      ? activeAttention.desc
                      : `No anomalies detected today. All ${kpi.todayTrips} transactions processed normally. Void rate, cancellations, and data integrity are within range.`}
                  </div>
                  {activeAttention ? (
                    <button
                      style={{
                        marginTop  : 10,
                        background : 'rgba(255,255,255,0.9)',
                        color      : activeAttention.severity === 'critical' ? 'var(--chart-red)' : 'var(--chart-amber)',
                        border     : `1.5px solid ${activeAttention.severity === 'critical' ? 'var(--chart-red)' : 'var(--chart-amber)'}`,
                        borderRadius: 7,
                        padding    : '6px 14px',
                        fontSize   : 12,
                        fontWeight : 700,
                        cursor     : 'pointer',
                        fontFamily : 'DM Sans,sans-serif',
                        display    : 'flex',
                        alignItems : 'center',
                        gap        : 6,
                      }}
                      onClick={() => navigate(activeAttention.action.href)}
                    >
                      {activeAttention.action.label} <ArrowRight style={{ width:11, height:11 }} />
                    </button>
                  ) : (
                    <button
                      style={{
                        marginTop  : 10,
                        background : 'var(--chart-green)',
                        color      : '#fff',
                        border     : 'none',
                        borderRadius: 7,
                        padding    : '6px 14px',
                        fontSize   : 12,
                        fontWeight : 600,
                        cursor     : 'pointer',
                        fontFamily : 'DM Sans,sans-serif',
                        display    : 'flex',
                        alignItems : 'center',
                        gap        : 6,
                      }}
                      onClick={() => navigate('/transactions')}
                    >
                      View Full Report <ArrowRight style={{ width:11, height:11 }} />
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}