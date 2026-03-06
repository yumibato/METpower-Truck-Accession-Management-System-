import { useRef, useState, useEffect } from 'react';
import {
  TrendingUp, BarChart2, CalendarDays, Package, CheckCircle2,
  User, Truck, Navigation, LayoutGrid, Scale, Timer,
  PanelLeftClose, PanelLeftOpen, Recycle,
} from 'lucide-react';
import WeightTrends from '../WeightTrends';
import TransactionVolume from '../TransactionVolume';
import ProductDistribution from '../ProductDistribution';
import StatusBreakdown from '../analytics/StatusBreakdown';
import TopDrivers from '../analytics/TopDrivers';
import TopVehicles from '../analytics/TopVehicles';
import HourlyHeatmap from '../analytics/HourlyHeatmap';
import MonthlyTonnage from '../analytics/MonthlyTonnage';
import TurnaroundTime from '../analytics/TurnaroundTime';
import WeightRatio from '../analytics/WeightRatio';
import FleetTracking from '../analytics/FleetTracking';
import DailyWasteMonitoring from '../analytics/DailyWasteMonitoring';
import Header from '../Header';
import { usePersistentState } from '../../hooks/usePersistentState';

type TabKey = 'weight' | 'volume' | 'monthly' | 'products' | 'status' | 'drivers' | 'vehicles' | 'fleet' | 'heatmap' | 'ratio' | 'turnaround' | 'waste';

const ALL_TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'weight',     label: 'Weight Trends',       icon: <TrendingUp   className="w-4 h-4" /> },
  { key: 'volume',     label: 'Transaction Volume',  icon: <BarChart2    className="w-4 h-4" /> },
  { key: 'monthly',    label: 'Monthly Tonnage',     icon: <CalendarDays className="w-4 h-4" /> },
  { key: 'products',   label: 'Product Distribution',icon: <Package      className="w-4 h-4" /> },
  { key: 'status',     label: 'Status Breakdown',    icon: <CheckCircle2 className="w-4 h-4" /> },
  { key: 'drivers',    label: 'Top Drivers',         icon: <User         className="w-4 h-4" /> },
  { key: 'vehicles',   label: 'Top Vehicles',        icon: <Truck        className="w-4 h-4" /> },
  { key: 'fleet',      label: 'Fleet Tracking',      icon: <Navigation   className="w-4 h-4" /> },
  { key: 'heatmap',    label: 'Hourly Heatmap',      icon: <LayoutGrid   className="w-4 h-4" /> },
  { key: 'ratio',      label: 'Weight Ratio',        icon: <Scale        className="w-4 h-4" /> },
  { key: 'turnaround', label: 'Turnaround Time',     icon: <Timer        className="w-4 h-4" /> },
  { key: 'waste',      label: 'Daily Waste Monitoring', icon: <Recycle   className="w-4 h-4" /> },
];

const DEFAULT_ORDER = ALL_TABS.map(t => t.key);

export default function AnalyticsPage() {
  const [analyticsTab, setAnalyticsTab] = usePersistentState<TabKey>('dashboard-analyticsTab', 'weight');
  const [tabOrder, setTabOrder] = usePersistentState<TabKey[]>('analytics-tabOrder', DEFAULT_ORDER);
  const [minimized, setMinimized] = usePersistentState<boolean>('analytics-tabMinimized', false);

  // Ensure any newly added keys are appended (safe migration)
  const orderedKeys: TabKey[] = [
    ...tabOrder.filter(k => DEFAULT_ORDER.includes(k)),
    ...DEFAULT_ORDER.filter(k => !tabOrder.includes(k)),
  ];
  const orderedTabs = orderedKeys.map(k => ALL_TABS.find(t => t.key === k)!).filter(Boolean);

  // Always open on the first (leftmost) tab when the page mounts
  useEffect(() => {
    if (orderedKeys.length) setAnalyticsTab(orderedKeys[0]);
  }, []);

  // Drag state
  const dragIndex = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (i: number) => { dragIndex.current = i; };

  const handleDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    if (dragIndex.current !== null && dragIndex.current !== i) setDragOverIndex(i);
  };

  const handleDrop = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    const from = dragIndex.current;
    if (from === null || from === i) { setDragOverIndex(null); return; }
    const next = [...orderedKeys];
    const [moved] = next.splice(from, 1);
    next.splice(i, 0, moved);
    setTabOrder(next);
    setDragOverIndex(null);
    dragIndex.current = null;
  };

  const handleDragEnd = () => { setDragOverIndex(null); dragIndex.current = null; };

  return (
    <div className="min-h-screen">
      <Header />
      <main className="w-full py-6 px-4 sm:px-6 lg:px-8">
        <div className="space-y-6">
          {/* Analytics sub-navigation */}
          <div className="bg-white dark:bg-midnight-800 rounded-xl border border-gray-200 dark:border-midnight-700 shadow-sm overflow-hidden">
            <div className="flex items-stretch">
              {/* Scrollable tab list */}
              <div className="overflow-x-auto flex-1">
                <nav className={`flex select-none ${minimized ? 'px-1' : 'px-4'} min-w-max`}>
                  {orderedTabs.map((tab, i) => {
                    const isActive = analyticsTab === tab.key;
                    const isDragOver = dragOverIndex === i;
                    return (
                      <button
                        key={tab.key}
                        draggable
                        onClick={() => setAnalyticsTab(tab.key)}
                        onDragStart={() => handleDragStart(i)}
                        onDragOver={(e) => handleDragOver(e, i)}
                        onDrop={(e) => handleDrop(e, i)}
                        onDragEnd={handleDragEnd}
                        title={tab.label}
                        className={`relative group border-b-2 font-medium text-sm whitespace-nowrap transition-all cursor-grab active:cursor-grabbing
                          ${minimized ? 'py-3 px-3' : 'py-3 px-4'}
                          ${isActive
                            ? 'border-blue-500 text-blue-600 dark:text-neon-cyan-glow'
                            : 'border-transparent text-gray-500 dark:text-enterprise-muted hover:text-gray-700 dark:hover:text-enterprise-silver'}
                          ${isDragOver ? 'border-l-2 border-l-blue-400' : ''}`}
                      >
                        {isDragOver && (
                          <span className="pointer-events-none absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-blue-500" />
                        )}
                        {minimized ? (
                          /* Icon-only mode */
                          <span className="flex items-center justify-center">{tab.icon}</span>
                        ) : (
                          /* Full label mode */
                          <span className="flex items-center gap-1.5">
                            <span className={`opacity-50 group-hover:opacity-80 transition-opacity ${isActive ? 'opacity-80' : ''}`}>
                              {tab.icon}
                            </span>
                            <span className={`opacity-0 group-hover:opacity-40 transition-opacity text-xs leading-none ${isActive ? 'opacity-30' : ''}`}>⠿</span>
                            {tab.label}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Minimize toggle button */}
              <button
                onClick={() => setMinimized(!minimized)}
                title={minimized ? 'Expand tab labels' : 'Minimize to icons'}
                className="flex-shrink-0 flex items-center px-3 border-l border-gray-200 dark:border-midnight-700 text-gray-400 hover:text-blue-500 dark:hover:text-neon-cyan-glow transition-colors"
              >
                {minimized
                  ? <PanelLeftOpen  className="w-4 h-4" />
                  : <PanelLeftClose className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {analyticsTab === 'weight'     && <WeightTrends />}
          {analyticsTab === 'volume'     && <TransactionVolume />}
          {analyticsTab === 'monthly'    && <MonthlyTonnage />}
          {analyticsTab === 'products'   && <ProductDistribution />}
          {analyticsTab === 'status'     && <StatusBreakdown />}
          {analyticsTab === 'drivers'    && <TopDrivers />}
          {analyticsTab === 'vehicles'   && <TopVehicles />}
          {analyticsTab === 'fleet'      && <FleetTracking />}
          {analyticsTab === 'heatmap'    && <HourlyHeatmap />}
          {analyticsTab === 'ratio'      && <WeightRatio />}
          {analyticsTab === 'turnaround' && <TurnaroundTime />}
          {analyticsTab === 'waste'      && <DailyWasteMonitoring />}
        </div>
      </main>
    </div>
  );
}
