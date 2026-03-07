import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  Download,
  Eye,
  Search,
  ArrowUpDown,
  Edit,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Calendar,
  X,
  Trash2,
  CheckSquare,
  Square,
  Package,
  AlertCircle,
  Filter,
  ChevronDown,
} from 'lucide-react';
import { transacApi, CalendarData, CalendarDay, FilterOptions } from '../services/transacApi';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { format } from 'date-fns';
import { Transaction } from '../types/Transaction';
import TransactionModal from './TransactionModal';
import { useToast } from '../contexts/NotificationContext';

// Text highlighting component
const HighlightText: React.FC<{ text: string; highlight: string }> = ({ text, highlight }) => {
  if (!highlight.trim() || !text) {
    return <span>{text}</span>;
  }

  const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
  
  return (
    <span>
      {parts.map((part, index) => 
        part.toLowerCase() === highlight.toLowerCase() ? (
          <mark key={index} className="bg-yellow-200 text-yellow-900 px-0.5 rounded font-medium">
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </span>
  );
};

type ColumnKey = keyof Transaction;

interface ColumnDefinition {
  key: ColumnKey;
  label: string;
  group: string;
  w: number;
  sortable?: boolean;
  frozen?: boolean;
  mono?: boolean;
  align?: 'left' | 'right' | 'center';
  accent?: string;
  className?: string;
  render?: (row: Transaction) => React.ReactNode;
}

const GRP_COLOR: Record<string, string> = {
  Identity:    '#3B82F6',
  Vehicle:     '#8B5CF6',
  Product:     '#22C55E',
  Weight:      '#F97316',
  Time:        '#14B8A6',
  Logistics:   '#6366F1',
  Destination: '#EC4899',
  Ops:         '#9CA3AF',
};

const STATUS_CFG: Record<string, { bg: string; color: string; dot: string }> = {
  Valid:     { bg: '#DCFCE7', color: '#16A34A', dot: '#22C55E' },
  Cancelled: { bg: '#FEE2E2', color: '#DC2626', dot: '#EF4444' },
  Void:      { bg: '#F3F4F6', color: '#6B7280', dot: '#9CA3AF' },
  Pending:   { bg: '#FEF3C7', color: '#D97706', dot: '#F97316' },
};

// Safe cell rendering function with highlighting
const renderCellContent = (transaction: Transaction, column: ColumnDefinition, searchTerm: string) => {
  try {
    if (column.render) {
      const rendered = column.render(transaction);
      if (searchTerm.trim() && typeof rendered === 'string') {
        return <HighlightText text={rendered} highlight={searchTerm} />;
      }
      return rendered;
    } else {
      const value = getTransactionValue(transaction, column.key);
      if (searchTerm.trim()) {
        return <HighlightText text={value} highlight={searchTerm} />;
      }
      return value;
    }
  } catch (error) {
    console.warn(`Error rendering column ${column.key}:`, error);
    const fallbackValue = getTransactionValue(transaction, column.key);
    if (searchTerm.trim()) {
      return <HighlightText text={fallbackValue} highlight={searchTerm} />;
    }
    return fallbackValue;
  }
};

const getTransactionValue = (transaction: Transaction, key: ColumnKey): string => {
  const value = transaction[key];
  return String(value ?? '');
};

const formatWeight = (value?: number | null | string) => {
  if (value === null || value === undefined || value === '') return '—';
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) return String(value);
  return `${numericValue.toLocaleString()} kg`;
};

const formatDateTime = (dateString?: string | null) => {
  if (!dateString) return '—';
  try {
    const normalized = typeof dateString === 'string' ? dateString.replace(' ', 'T') : dateString;
    return format(new Date(normalized), 'MMM dd, yyyy HH:mm');
  } catch {
    return dateString;
  }
};

const TABLE_COLUMNS: ColumnDefinition[] = [
  { key: 'id',            label: 'ID',           group: 'Identity',    w: 88,  sortable: true, mono: true, frozen: true },
  { key: 'trans_no',      label: 'Txn No.',      group: 'Identity',    w: 158, sortable: true, mono: true, frozen: true },
  { key: 'status',        label: 'Status',       group: 'Identity',    w: 114, sortable: true, frozen: true },
  { key: 'plate',         label: 'Plate',        group: 'Vehicle',     w: 112, sortable: true, mono: true },
  { key: 'type_veh',      label: 'Vehicle Type', group: 'Vehicle',     w: 130, sortable: true },
  { key: 'driver',        label: 'Driver',       group: 'Vehicle',     w: 148, sortable: true },
  { key: 'product',       label: 'Product',      group: 'Product',     w: 160, sortable: true },
  { key: 'no_of_bags',    label: 'No. of Bags',  group: 'Product',     w: 108, sortable: true, mono: true, align: 'right' },
  { key: 'gross_weight',  label: 'Gross Wt',     group: 'Weight',      w: 110, sortable: true, mono: true, align: 'right' },
  { key: 'tare_weight',   label: 'Tare Wt',      group: 'Weight',      w: 110, sortable: true, mono: true, align: 'right' },
  { key: 'net_weight',    label: 'Net Wt',        group: 'Weight',      w: 108, sortable: true, mono: true, align: 'right', accent: 'green' },
  { key: 'initial_net_wt',label: 'Init. Net Wt', group: 'Weight',      w: 120, sortable: true, mono: true, align: 'right' },
  { key: 'inbound_wt',    label: 'In. Weight',   group: 'Weight',      w: 114, sortable: true, mono: true, align: 'right' },
  { key: 'outbound_wt',   label: 'Out. Weight',  group: 'Weight',      w: 118, sortable: true, mono: true, align: 'right' },
  { key: 'inbound',       label: 'Inbound',      group: 'Time',        w: 160, sortable: true, mono: true,
    render: (row) => formatDateTime(row.inbound) },
  { key: 'outbound',      label: 'Outbound',     group: 'Time',        w: 160, sortable: true, mono: true,
    render: (row) => formatDateTime(row.outbound) },
  { key: 'transac_date',  label: 'Txn Date',     group: 'Time',        w: 118, sortable: true, mono: true,
    render: (row) => formatDateTime(row.transac_date) },
  { key: 'date',          label: 'Date',         group: 'Time',        w: 110, sortable: true, mono: true,
    render: (row) => formatDateTime(row.date) },
  { key: 'barge_details', label: 'Barge',        group: 'Logistics',   w: 110, sortable: true },
  { key: 'ws_no',         label: 'WS No.',       group: 'Logistics',   w: 110, sortable: true, mono: true },
  { key: 'dr_no',         label: 'DR No.',       group: 'Logistics',   w: 110, sortable: true, mono: true },
  { key: 'vessel_id',     label: 'Vessel ID',    group: 'Logistics',   w: 112, sortable: true, mono: true },
  { key: 'del_comp',      label: 'Company',      group: 'Destination', w: 148, sortable: true },
  { key: 'del_address',   label: 'Delivery',     group: 'Destination', w: 148, sortable: true },
  { key: 'weigher',       label: 'Weigher',      group: 'Ops',         w: 128, sortable: true },
  { key: 'remarks',       label: 'Remarks',      group: 'Ops',         w: 180, sortable: true },
];

// ── Saved Views ─────────────────────────────────────────────────────────────
const ALL_COL_KEYS = TABLE_COLUMNS.map(c => c.key as string);
const SAVED_VIEWS: Record<string, { label: string; iconType: 'operator'|'logistics'|'finance'|'all'; cols: string[] }> = {
  'Operator':    { label:'Operator',    iconType:'operator',  cols:['id','trans_no','status','plate','type_veh','driver','product','net_weight','inbound','outbound'] },
  'Logistics':   { label:'Logistics',   iconType:'logistics', cols:['id','trans_no','status','product','no_of_bags','net_weight','barge_details','ws_no','dr_no','vessel_id','del_comp'] },
  'Finance':     { label:'Finance',     iconType:'finance',   cols:['id','trans_no','status','product','no_of_bags','gross_weight','tare_weight','net_weight','initial_net_wt','del_comp','del_address','weigher','transac_date'] },
  'All Columns': { label:'All Columns', iconType:'all',       cols: ALL_COL_KEYS },
};

interface TransactionTableProps {
  transactions: Transaction[];
  onUpdate?: (id: number, data: Partial<Transaction>) => Promise<Transaction>;
  loading: boolean;
  page: number;
  pageSize: number;
  total: number;
  searchTerm: string;
  sortBy: string;
  sortDir: 'ASC' | 'DESC';
  onSearchChange: (value: string) => void;
  onSortChange: (key: string) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  fetchTransaction: (id: number) => Promise<Transaction>;
  onRefresh: () => Promise<void> | void;
  refreshing: boolean;
  onDateRangeChange?: (startDate: Date | null, endDate: Date | null) => void;
  startDate?: Date | null;
  endDate?: Date | null;
  highlightTransId?: number | null;
  highlightMode?: string | null;
  // Column filters
  statusFilter?: string | null;
  vehicleFilter?: string | null;
  productFilter?: string | null;
  onStatusFilterChange?: (v: string | null) => void;
  onVehicleFilterChange?: (v: string | null) => void;
  onProductFilterChange?: (v: string | null) => void;
  filterOptions?: FilterOptions;
}

const TransactionTable: React.FC<TransactionTableProps> = ({
  transactions,
  onUpdate,
  loading,
  page,
  pageSize,
  total,
  searchTerm: propSearchTerm,
  sortBy,
  sortDir,
  onSearchChange,
  onSortChange,
  onPageChange,
  onPageSizeChange,
  fetchTransaction,
  onRefresh,
  refreshing,
  onDateRangeChange,
  startDate,
  endDate,
  highlightTransId,
  highlightMode,
  statusFilter,
  vehicleFilter,
  productFilter,
  onStatusFilterChange,
  onVehicleFilterChange,
  onProductFilterChange,
  filterOptions,
}) => {
  const highlightRowRef = useRef<HTMLTableRowElement | null>(null);

  // Scroll to highlighted row after data loads
  useEffect(() => {
    if (!loading && highlightTransId && highlightRowRef.current) {
      setTimeout(() => {
        highlightRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 200);
    }
  }, [loading, highlightTransId, transactions]);
  const toast = useToast();
  // Simplified search state - just debounce and send to server
  const [localSearchTerm, setLocalSearchTerm] = useState(propSearchTerm || '');
  
  // Debounced search effect - send search directly to server
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearchTerm !== propSearchTerm) {
        console.log(`🔍 Server-driven search: "${localSearchTerm}"`);
        onSearchChange(localSearchTerm);
      }
    }, 500); // 500ms delay for better responsiveness
    
    return () => clearTimeout(timer);
  }, [localSearchTerm, propSearchTerm, onSearchChange]);
  
  // Update local search when prop changes
  useEffect(() => {
    if (propSearchTerm !== localSearchTerm) {
      setLocalSearchTerm(propSearchTerm || '');
    }
  }, [propSearchTerm]);

  // Memoize table columns for performance
  const MEMOIZED_TABLE_COLUMNS = useMemo(() => TABLE_COLUMNS, []);

  // ── Enhancement 1: Column Resizing ───────────────────────────────────────
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const resizingRef = useRef<{ key: string; startX: number; startW: number } | null>(null);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const r = resizingRef.current;
      if (!r) return;
      const newW = Math.min(400, Math.max(60, r.startW + (e.clientX - r.startX)));
      setColWidths(prev => ({ ...prev, [r.key]: newW }));
    };
    const onMouseUp = () => {
      if (resizingRef.current) {
        resizingRef.current = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  // ── Enhancement 2: Inline Status Editing ─────────────────────────────────
  const [editingStatus, setEditingStatus] = useState<number | null>(null);

  useEffect(() => {
    if (editingStatus === null) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-status-popover]')) setEditingStatus(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [editingStatus]);

  // ── Enhancement 3: Pin/Unpin Columns ─────────────────────────────────────
  const LOCKED_PINS = new Set(['id', 'trans_no', 'status']);
  const [pinnedCols, setPinnedCols] = useState<Set<string>>(new Set(['id', 'trans_no', 'status']));

  const togglePin = (key: string) => {
    if (LOCKED_PINS.has(key)) return;
    setPinnedCols(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // ── Enhancement 5: Row Hover Preview ─────────────────────────────────────
  const [hoverRow, setHoverRow] = useState<Transaction | null>(null);
  const [hoverY, setHoverY] = useState(0);

  // ── Reference design: density + row expansion ─────────────────────────────
  const [density, setDensity] = useState<'compact' | 'default' | 'comfortable'>('default');
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [expandedTab, setExpandedTab] = useState<string>('Identity');

  // ── Saved Views ───────────────────────────────────────────────────────────
  const [activeView, setActiveView]         = useState<string>('All Columns');
  const [hiddenCols, setHiddenCols]         = useState<Set<string>>(new Set());
  const [showViewsDropdown, setShowViewsDropdown] = useState(false);
  const [showColsPanel, setShowColsPanel]   = useState(false);
  const viewsDropdownRef = useRef<HTMLDivElement>(null);
  const colsPanelRef     = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (viewsDropdownRef.current && !viewsDropdownRef.current.contains(e.target as Node)) setShowViewsDropdown(false);
      if (colsPanelRef.current     && !colsPanelRef.current.contains(e.target as Node))     setShowColsPanel(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const applyView = (viewName: string) => {
    setActiveView(viewName);
    if (viewName === 'All Columns') {
      setHiddenCols(new Set());
    } else {
      const visible = new Set(SAVED_VIEWS[viewName].cols);
      setHiddenCols(new Set(ALL_COL_KEYS.filter(k => !visible.has(k))));
    }
    setShowViewsDropdown(false);
  };

  const toggleColVisibility = (key: string) => {
    setHiddenCols(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
    setActiveView('Custom');
  };

  const visibleColCount = ALL_COL_KEYS.length - hiddenCols.size;

  const orderedCols = useMemo(() => {
    const pinned = MEMOIZED_TABLE_COLUMNS.filter(c => pinnedCols.has(c.key as string) && !hiddenCols.has(c.key as string));
    const rest   = MEMOIZED_TABLE_COLUMNS.filter(c => !pinnedCols.has(c.key as string) && !hiddenCols.has(c.key as string));
    return [...pinned, ...rest];
  }, [MEMOIZED_TABLE_COLUMNS, pinnedCols, hiddenCols]);

  // Layout constants
  const CB_W  = 44;
  const ACT_W = 130;
  const ROW_H = { compact: 38, default: 52, comfortable: 68 }[density];

  // Frozen column layout
  const frozenCols    = orderedCols.filter(c => pinnedCols.has(c.key as string));
  const lastFrozenKey = frozenCols.length ? frozenCols[frozenCols.length - 1].key as string : null;

  const frozenLeft = useMemo(() => {
    const m: Record<string, number> = {};
    let off = CB_W + ACT_W;
    orderedCols.forEach(c => {
      if (pinnedCols.has(c.key as string)) {
        m[c.key as string] = off;
        off += (colWidths[c.key as string] ?? c.w);
      }
    });
    return m;
  }, [orderedCols, pinnedCols, colWidths]);

  const buildGroupSpans = (cols: ColumnDefinition[]) => {
    const spans: { group: string; span: number }[] = [];
    let cur = ''; let count = 0;
    cols.forEach(c => {
      if (c.group !== cur) {
        if (cur) spans.push({ group: cur, span: count });
        cur = c.group; count = 1;
      } else { count++; }
    });
    if (cur) spans.push({ group: cur, span: count });
    return spans;
  };

  const allGroups        = [...new Set(orderedCols.map(c => c.group))];
  const frozenGroupSpans = buildGroupSpans(frozenCols);
  const scrollGroupSpans = buildGroupSpans(orderedCols.filter(c => !pinnedCols.has(c.key as string)));

  // Glassmorphism tokens (dark mode aware)
  const isDark = document.documentElement.classList.contains('dark');
  const frzBg     = isDark ? 'rgba(18,18,18,0.85)'   : 'rgba(255,255,255,0.85)';
  const frzBgSel  = isDark ? 'rgba(30,58,95,0.90)'    : 'rgba(239,246,255,0.90)';
  const frzBgHd   = isDark ? 'rgba(12,12,12,0.92)'    : 'rgba(249,250,251,0.92)';
  const frzBlur   = 'blur(12px) saturate(1.6)';
  const frzBrd    = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const frzShd    = isDark
    ? '4px 0 24px rgba(0,0,0,0.7), inset -1px 0 0 rgba(255,255,255,0.04)'
    : '4px 0 20px rgba(0,0,0,0.10), inset -1px 0 0 rgba(0,0,0,0.04)';

  // Inline cell renderer (reference design style)
  const renderCell = (transaction: Transaction, col: ColumnDefinition): React.ReactNode => {
    const v = transaction[col.key];
    const str = String(v ?? '');
    if (col.key === 'id') return (
      <span style={{ fontSize: 12, fontWeight: 800, color: isDark ? '#60A5FA' : '#2563EB', fontFamily: "'DM Mono',monospace" }}>#{str}</span>
    );
    if (col.key === 'status') {
      const sc = STATUS_CFG[str] || STATUS_CFG['Void'];
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: sc.bg, color: sc.color, borderRadius: 999, padding: '3px 9px', fontSize: 11, fontWeight: 700 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: sc.dot, flexShrink: 0 }} />
          {str || 'Unknown'}
        </span>
      );
    }
    if (col.key === 'plate' && !str) return (
      <span style={{ color: '#F97316', fontSize: 11, fontStyle: 'italic', opacity: 0.75 }}>No plate</span>
    );
    if (col.key === 'net_weight') return (
      <span style={{ fontSize: 13, fontWeight: 800, color: isDark ? '#4ADE80' : '#16A34A', fontFamily: "'DM Mono',monospace" }}>{formatWeight(v as number)}</span>
    );
    if (['gross_weight','tare_weight','initial_net_wt','inbound_wt','outbound_wt'].includes(col.key as string))
      return <span style={{ fontSize: 12, fontFamily: "'DM Mono',monospace", color: isDark ? '#D4D4D8' : '#374151' }}>{formatWeight(v as number)}</span>;
    if (!str) return <span style={{ color: isDark ? '#3F3F46' : '#D1D5DB', fontSize: 12 }}>—</span>;
    if (col.render) {
      const rendered = col.render(transaction);
      return <span style={{ fontSize: 12, fontFamily: col.mono ? "'DM Mono',monospace" : "'DM Sans',sans-serif", color: col.mono ? (isDark ? '#E4E4E7' : '#374151') : (isDark ? '#A1A1AA' : '#6B7280') }}>{rendered}</span>;
    }
    return (
      <span style={{ fontSize: 12, color: col.mono ? (isDark ? '#E4E4E7' : '#374151') : (isDark ? '#A1A1AA' : '#6B7280'), fontFamily: col.mono ? "'DM Mono',monospace" : "'DM Sans',sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: (col.w || 120) - 16, display: 'block' }}>
        {str}
      </span>
    );
  };

  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [modalMode, setModalMode] = useState<'view' | 'edit'>('view');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [dateQuick, setDateQuick] = useState<'today'|'yesterday'|'week'|'month'|'custom'|null>(null);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(false);
  
  // Bulk Operations State
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showBulkStatusModal, setShowBulkStatusModal] = useState(false);
  const [bulkStatusValue, setBulkStatusValue] = useState('Valid');
  const [bulkError, setBulkError] = useState('');

  // Server-driven calendar data fetching
  const fetchCalendarData = async (year: number, month: number) => {
    setCalendarLoading(true);
    try {
      const data = await transacApi.getCalendarData(year, month);
      setCalendarData(data);
    } catch (error) {
      console.error('Failed to fetch calendar data:', error);
      setCalendarData(null);
    } finally {
      setCalendarLoading(false);
    }
  };

  // Get a consistent calendar reference date (always 1st day of the selected month)
  const getCalendarReferenceDate = () => {
    const baseDate = startDate || endDate || new Date();
    return new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  };

  // Fetch calendar data when month/year changes or when date picker opens
  useEffect(() => {
    if (showDatePicker) {
      const refDate = getCalendarReferenceDate();
      fetchCalendarData(refDate.getFullYear(), refDate.getMonth() + 1);
    }
  }, [showDatePicker]);

  const handleDayClick = (calendarDay: CalendarDay) => {
    if (!calendarDay.isInMonth) return;
    
    // Use pure string dates to avoid timezone issues completely
    const selectedDateStr = calendarDay.date; // Already in "YYYY-MM-DD" format
    
    // Convert to Date object for parent compatibility (with UTC noon)
    const [year, month, day] = selectedDateStr.split('-').map(Number);
    const selectedDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    
    if (!startDate || (startDate && endDate)) {
      // Start new selection
      setStartDateStr(selectedDateStr);
      setEndDateStr(null);
      onDateRangeChange?.(selectedDate, null);
    } else {
      // Complete the range
      setEndDateStr(selectedDateStr);
      if (selectedDate < startDate) {
        // Swap dates if end is before start
        setStartDateStr(selectedDateStr);
        setEndDateStr(getPureDateString(startDate));
        onDateRangeChange?.(selectedDate, startDate);
      } else {
        onDateRangeChange?.(startDate, selectedDate);
      }
    }
  };

  // Get date string without timezone conversion (pure UTC)
  const getPureDateString = (date: Date) => {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  };

  const isDateInRange = (day: Date | null, start: Date | null, end: Date | null) => {
    if (!day || !start || !end) return false;
    // Use pure UTC date strings for comparison
    const dayStr = getPureDateString(day);
    return dayStr >= (startDateStr || '') && dayStr <= (endDateStr || '');
  };

  const isDateSelected = (day: Date | null) => {
    if (!day) return false;
    // Use pure UTC date strings for comparison
    const dayStr = getPureDateString(day);
    return dayStr === (startDateStr || '') || dayStr === (endDateStr || '');
  };

  // No client-side filtering here; all date filtering is handled on the server.

  const openDetails = async (transactionId: number, mode: 'view' | 'edit') => {
    try {
      setDetailsLoading(true);
      const transaction = await fetchTransaction(transactionId);
      setSelectedTransaction(transaction);
      setModalMode(mode);
      setIsModalOpen(true);
    } catch (error) {
      console.error('Failed to load transaction details:', error);
      alert('Failed to load transaction details. Please try again.');
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleEditFromModal = () => {
    setModalMode('edit');
  };

  const handleSaveTransaction = async (data: Partial<Transaction>) => {
    if (!selectedTransaction || !onUpdate) return;
    
    await onUpdate(selectedTransaction.id, data);
    setIsModalOpen(false);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedTransaction(null);
  };

  // Delete transaction (move to trash)
  const [deleteLoading, setDeleteLoading] = useState(false);
  const handleDeleteTransaction = async (transactionId: number) => {
    if (!window.confirm('Move this transaction to trash?')) return;
    
    try {
      setDeleteLoading(true);
      const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '') || 'http://localhost:3001';
      const response = await fetch(`${apiBaseUrl}/api/transac/${transactionId}/trash`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!response.ok) {
        throw new Error('Failed to move transaction to trash');
      }
      
      // Refresh the transaction list
      await onRefresh();
    } catch (error: any) {
      console.error('Error deleting transaction:', error);
      alert(error.message || 'Failed to move transaction to trash');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Bulk Operations Handlers
  const toggleSelectId = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === transactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(transactions.map(t => t.id as number)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) {
      toast.warning('No Selection', 'Please select transactions to delete');
      return;
    }
    if (!window.confirm(`Move ${selectedIds.size} transaction(s) to trash?`)) return;

    setBulkLoading(true);
    setBulkError('');
    try {
      const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '') || 'http://localhost:3001';
      const idsArray = Array.from(selectedIds).map(id => Number(id));
      console.log('[BULK_DELETE] Sending IDs:', idsArray);
      const response = await fetch(`${apiBaseUrl}/api/transac/bulk/trash`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: idsArray })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[BULK_DELETE] Server error:', errorText);
        throw new Error('Failed to move transactions to trash');
      }

      toast.success('Success', `${selectedIds.size} transaction(s) moved to trash`);
      setSelectedIds(new Set());
      // Delayed refresh to reduce flickering
      setTimeout(() => onRefresh(), 500);
    } catch (error: any) {
      toast.error('Bulk Delete Failed', error.message || 'Failed to move transactions to trash');
      setBulkError(error.message || 'Failed to move transactions to trash');
      console.error('Error in bulk delete:', error);
    } finally {
      setBulkLoading(false);
    }
  };

  // Bulk restore function - available for future use
  // @ts-ignore - Intentionally unused, kept for future feature
  const _handleBulkRestore = async () => {
    if (selectedIds.size === 0) {
      toast.warning('No Selection', 'Please select transactions to restore');
      return;
    }
    if (!window.confirm(`Restore ${selectedIds.size} transaction(s)?`)) return;

    setBulkLoading(true);
    setBulkError('');
    try {
      await transacApi.bulkRestore(Array.from(selectedIds));
      toast.success('Success', `${selectedIds.size} transaction(s) restored`);
      setSelectedIds(new Set());
      // Delayed refresh to reduce flickering
      setTimeout(() => onRefresh(), 500);
    } catch (error: any) {
      toast.error('Bulk Restore Failed', error.message || 'Failed to restore transactions');
      setBulkError(error.message || 'Failed to restore transactions');
      console.error('Error in bulk restore:', error);
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkExport = async () => {
    if (selectedIds.size === 0) {
      toast.warning('No Selection', 'Please select transactions to export');
      return;
    }

    setBulkLoading(true);
    setBulkError('');
    try {
      await transacApi.bulkExportCsv(Array.from(selectedIds));
      toast.success('Export Complete', `${selectedIds.size} transaction(s) exported`);
    } catch (error: any) {
      toast.error('Export Failed', error.message || 'Failed to export transactions');
      setBulkError(error.message || 'Failed to export transactions');
      console.error('Error in bulk export:', error);
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkStatusUpdate = async () => {
    if (selectedIds.size === 0) {
      toast.warning('No Selection', 'Please select transactions to update');
      return;
    }

    setBulkLoading(true);
    setBulkError('');
    try {
      await transacApi.bulkUpdateStatus(Array.from(selectedIds), bulkStatusValue);
      toast.success('Status Updated', `${selectedIds.size} transaction(s) status updated to ${bulkStatusValue}`);
      setSelectedIds(new Set());
      setShowBulkStatusModal(false);
      // Delayed refresh to reduce flickering
      setTimeout(() => onRefresh(), 500);
    } catch (error: any) {
      toast.error('Status Update Failed', error.message || 'Failed to update transaction status');
      setBulkError(error.message || 'Failed to update transaction status');
      console.error('Error in bulk status update:', error);
    } finally {
      setBulkLoading(false);
    }
  };

  // CSV Export function
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportOption, setExportOption] = useState<'current' | 'date' | 'custom'>('current');
  const [customExportLimit, setCustomExportLimit] = useState<number>(100);
  const [customExportOffset, setCustomExportOffset] = useState<number>(0);
  const [isExporting, setIsExporting] = useState(false);
  const [exportCountdown, setExportCountdown] = useState<number>(0);
  const [exportProgress, setExportProgress] = useState<string>('');
  const [dateRangePreview, setDateRangePreview] = useState<number | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  
  // Drag functionality state
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Date picker drag functionality state
  const [isDraggingDate, setIsDraggingDate] = useState(false);
  const [dragPositionDate, setDragPositionDate] = useState({ x: 0, y: 0 });
  const [dragStartDate, setDragStartDate] = useState({ x: 0, y: 0 });
  
  // Store original date strings to avoid timezone issues
  const [startDateStr, setStartDateStr] = useState<string | null>(null);
  const [endDateStr, setEndDateStr] = useState<string | null>(null);
  
  // Automatic preview function when date range changes
  useEffect(() => {
    if (exportOption === 'date' && startDate && endDate) {
      previewDateRangeCount();
    } else {
      setDateRangePreview(null);
    }
  }, [startDate, endDate, exportOption]);
  
  // Preview function to count records in date range
  const previewDateRangeCount = async () => {
    if (!startDate || !endDate) {
      setDateRangePreview(null);
      return;
    }
    
    setIsPreviewing(true);
    setDateRangePreview(null);
    
    try {
      // Fetch count of records in date range
      const result = await transacApi.list({
        page: 1,
        pageSize: 1, // Only need to get the total count
        dateFrom: startDate.toISOString().split('T')[0],
        dateTo: endDate.toISOString().split('T')[0],
        ...(propSearchTerm && { search: propSearchTerm }),
        ...(sortBy && { sortBy }),
        ...(sortDir && { sortDir })
      });
      
      // The total should be in the result.total field
      const totalCount = result.total || 0;
      setDateRangePreview(totalCount);
      
    } catch (error) {
      console.error('Preview failed:', error);
      setDateRangePreview(0); // Show 0 on error to indicate failure
    } finally {
      setIsPreviewing(false);
    }
  };

  // Drag functionality handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - dragPosition.x,
      y: e.clientY - dragPosition.y
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    
    // Limit dragging within viewport
    const maxX = window.innerWidth - 400; // Approximate modal width
    const maxY = window.innerHeight - 300; // Approximate modal height
    
    setDragPosition({
      x: Math.max(-maxX/2, Math.min(maxX/2, newX)),
      y: Math.max(-maxY/2, Math.min(maxY/2, newY))
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Reset position when modal opens
  useEffect(() => {
    if (showExportModal) {
      setDragPosition({ x: 0, y: 0 });
    }
  }, [showExportModal]);

  // Date picker drag functionality handlers
  const handleDateMouseDown = (e: React.MouseEvent) => {
    setIsDraggingDate(true);
    setDragStartDate({
      x: e.clientX - dragPositionDate.x,
      y: e.clientY - dragPositionDate.y
    });
  };

  const handleDateMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingDate) return;
    
    const newX = e.clientX - dragStartDate.x;
    const newY = e.clientY - dragStartDate.y;
    
    // Limit dragging within viewport
    const maxX = window.innerWidth - 800; // Date picker is wider
    const maxY = window.innerHeight - 600; // Date picker is taller
    
    setDragPositionDate({
      x: Math.max(-maxX/2, Math.min(maxX/2, newX)),
      y: Math.max(-maxY/2, Math.min(maxY/2, newY))
    });
  };

  const handleDateMouseUp = () => {
    setIsDraggingDate(false);
  };

  // Reset date picker position when modal opens
  useEffect(() => {
    if (showDatePicker) {
      setDragPositionDate({ x: 0, y: 0 });
    }
  }, [showDatePicker]);

  // Format using stored strings (completely timezone-safe)
  const formatDateFromString = (dateStr: string | null) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-').map(Number);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[month - 1]} ${day}, ${year}`;
  };

  // Calculate days difference from date strings (completely timezone-safe)
  const calculateDaysFromStrings = (startStr: string | null, endStr: string | null) => {
    if (!startStr || !endStr) return 0;
    
    // Convert YYYY-MM-DD to days since epoch (pure math, no timezone)
    const [startYear, startMonth, startDay] = startStr.split('-').map(Number);
    const [endYear, endMonth, endDay] = endStr.split('-').map(Number);
    
    // Simple days calculation (not accounting for leap years in complex cases, but works for same year/month ranges)
    const startDate = new Date(startYear, startMonth - 1, startDay);
    const endDate = new Date(endYear, endMonth - 1, endDay);
    
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays + 1; // Include both start and end days
  };
  
  // Export individual row function
  const exportSingleRow = async (transaction: Transaction) => {
    try {
      setIsExporting(true);
      setExportProgress('Exporting single transaction...');
      
      // Generate CSV content for single transaction
      const headers = MEMOIZED_TABLE_COLUMNS.map(col => col.label).join(',');
      const row = MEMOIZED_TABLE_COLUMNS.map(col => {
        let value: string;
        
        // Use render function if available, otherwise get raw value
        if (col.render) {
          try {
            const rendered = col.render(transaction);
            // Extract text from React elements if needed
            if (typeof rendered === 'string') {
              value = rendered;
            } else if (rendered && typeof rendered === 'object' && 'props' in rendered) {
              // For React elements, try to get the text content
              value = String(rendered.props.children || '');
            } else {
              value = String(rendered || '');
            }
          } catch (renderError) {
            // If render function fails, get raw value
            const rawValue = transaction[col.key];
            value = String(rawValue ?? '');
          }
        } else {
          // Get raw value and format it properly
          const rawValue = transaction[col.key];
          
          // Handle different data types
          if (rawValue === null || rawValue === undefined) {
            value = '';
          } else if (col.key.includes('date') || col.key.includes('time')) {
            // Format dates properly
            value = formatDateTime(String(rawValue));
          } else if (col.key.includes('wt') || col.key.includes('weight')) {
            // Format weights properly
            value = formatWeight(rawValue);
          } else {
            value = String(rawValue);
          }
        }
        
        // Escape quotes and commas in values
        return `"${value.replace(/"/g, '""')}"`;
      }).join(',');
      
      const csvContent = `${headers}\n${row}`;
      
      // Create and download the CSV file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      // Generate filename with transaction details
      const transactionId = transaction.id || 'unknown';
      const transactionNo = transaction.trans_no || 'no-number';
      const date = transaction.inbound ? new Date(transaction.inbound).toISOString().split('T')[0] : 'no-date';
      
      link.setAttribute('href', url);
      link.setAttribute('download', `transaction_${transactionId}_${transactionNo}_${date}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setExportProgress('Single transaction exported successfully!');
      setTimeout(() => {
        setExportProgress('');
        setIsExporting(false);
      }, 2000);
      
    } catch (error) {
      console.error('Single row export failed:', error);
      alert('Failed to export transaction. Please try again.');
      setExportProgress('');
      setIsExporting(false);
    }
  };
  
  const exportToCSV = async (option: 'current' | 'date' | 'custom' = 'current') => {
    let countdownInterval: NodeJS.Timeout | null = null;
    let startTime = Date.now();
    let recordsProcessed = 0;
    let totalRecords = 0;
    
    try {
      setIsExporting(true);
      let dataToExport = transactions;
      
      // Set total records for progress calculation
      if (option === 'custom') {
        totalRecords = customExportLimit;
      } else if (option === 'date') {
        // For date range, we'll update this after fetching
        totalRecords = 1000; // Initial estimate, will be updated after fetch
      } else {
        totalRecords = dataToExport.length;
      }
      
      // Initial time estimation (will be updated dynamically)
      let estimatedTime = Math.max(3, Math.ceil(totalRecords / 50)); // Conservative estimate
      setExportCountdown(estimatedTime);
      setExportProgress(`Preparing export (${estimatedTime}s estimated)...`);
      
      // Dynamic countdown timer that adjusts based on actual performance
      countdownInterval = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000; // seconds elapsed
        const progress = recordsProcessed / totalRecords;
        
        if (progress > 0) {
          // Calculate actual rate and adjust estimate
          const rate = recordsProcessed / elapsed; // records per second
          const remainingRecords = totalRecords - recordsProcessed;
          const newEstimate = Math.max(1, Math.ceil(remainingRecords / rate));
          
          setExportCountdown(newEstimate);
        } else {
          // Still in preparation phase
          setExportCountdown(prev => Math.max(1, prev - 1));
        }
      }, 1000);
      
      // Handle different export options
      switch (option) {
        case 'current':
          // Export current view (already filtered transactions)
          dataToExport = transactions;
          setExportProgress(`Processing ${dataToExport.length} records...`);
          break;
          
        case 'date':
          // Export based on selected date range - fetch ALL records in range without pagination
          setExportProgress('Fetching date range data...');
          try {
            if (!startDate || !endDate) {
              throw new Error('Please select a date range first');
            }
            
            console.log(`Fetching ALL records in date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
            
            // Fetch ALL records in the date range - try single large request first, fallback to pagination
            let result: any;
            
            // First attempt: Try to get all records in one request
            try {
              result = await transacApi.list({
                page: 1,
                pageSize: 999999, // Very large number to get all records
                dateFrom: startDate.toISOString().split('T')[0],
                dateTo: endDate.toISOString().split('T')[0],
                exportMode: true, // Special flag to bypass pagination limits
                ...(propSearchTerm && { search: propSearchTerm }),
                ...(sortBy && { sortBy }),
                ...(sortDir && { sortDir })
              });
              
              console.log(`Single request result:`, {
                rowsReceived: result.rows?.length || 0,
                totalReported: result.total,
                previewCount: dateRangePreview
              });
              
              // If we didn't get all records, fallback to pagination
              if (dateRangePreview !== null && result.rows.length < dateRangePreview) {
                console.log('Single request didn\'t get all records, falling back to pagination...');
                throw new Error('Need pagination fallback');
              }
              
            } catch (error) {
              console.log('Using pagination fallback to fetch all records...');
              
              // Fallback: Use pagination to get all records
              let allData: Transaction[] = [];
              let currentPage = 1;
              const pageSize = 200; // Use the server's limit
              let hasMoreData = true;
              let targetCount = dateRangePreview || 0;
              
              while (hasMoreData) {
                setExportProgress(`Fetching page ${currentPage} (${allData.length}/${targetCount})...`);
                
                const pageResult = await transacApi.list({
                  page: currentPage,
                  pageSize: pageSize,
                  dateFrom: startDate.toISOString().split('T')[0],
                  dateTo: endDate.toISOString().split('T')[0],
                  ...(propSearchTerm && { search: propSearchTerm }),
                  ...(sortBy && { sortBy }),
                  ...(sortDir && { sortDir })
                });
                
                const pageData = pageResult.rows || [];
                allData.push(...pageData);
                
                console.log(`Page ${currentPage}: ${pageData.length} records, total: ${allData.length}`);
                
                // Stop if we got less than a full page or reached our target
                if (pageData.length < pageSize || (targetCount > 0 && allData.length >= targetCount)) {
                  hasMoreData = false;
                } else {
                  currentPage++;
                }
                
                // Safety check
                if (currentPage > 1000) {
                  console.warn('Stopping at 1000 pages to prevent infinite loop');
                  hasMoreData = false;
                }
              }
              
              // Create a result object that matches the expected format
              result = {
                rows: allData,
                total: allData.length,
                page: 1,
                pageSize: allData.length
              };
            }
            
            console.log(`API Result:`, {
              rowsReceived: result.rows?.length || 0,
              totalReported: result.total,
              previewCount: dateRangePreview
            });
            
            dataToExport = result.rows || [];
            recordsProcessed = dataToExport.length;
            totalRecords = dataToExport.length;
            
            if (dataToExport.length === 0) {
              throw new Error('No records found in the selected date range');
            }
            
            // Verify we got the expected number of records
            if (dateRangePreview !== null && dataToExport.length < dateRangePreview) {
              console.warn(`Warning: Got ${dataToExport.length} records but preview showed ${dateRangePreview}`);
            }
            
            setExportProgress(`Found ${dataToExport.length} records in date range...`);
            
          } catch (error) {
            if (countdownInterval) clearInterval(countdownInterval);
            console.error('Date range export failed:', error);
            
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            alert(`Date range export failed: ${errorMessage}\n\nPlease try:\n1. Select a valid date range\n2. Check your network connection\n3. Try a smaller date range`);
            
            setIsExporting(false);
            setExportProgress('');
            setExportCountdown(0);
            return;
          }
          break;
          
        case 'custom':
          // Custom export with user-defined limit and offset
          try {
            // Calculate which page to fetch based on offset and pageSize
            const recordsPerPage = pageSize || 10;
            
            // For custom export, we might need to fetch multiple pages if the range spans pages
            let allData: Transaction[] = [];
            let recordsToFetch = customExportLimit;
            let currentOffset = customExportOffset;
            let pagesProcessed = 0;
            
            console.log(`Custom export: Need ${customExportLimit} records starting from ${customExportOffset}`);
            setExportProgress(`Fetching data from page 1...`);
            
            // Fetch data in chunks if needed using the existing API service
            while (recordsToFetch > 0) {
              const currentPage = Math.floor(currentOffset / recordsPerPage) + 1;
              const fetchSize = Math.min(recordsToFetch, recordsPerPage);
              pagesProcessed++;
              
              console.log(`Fetching page ${currentPage} with ${fetchSize} records`);
              setExportProgress(`Fetching data from page ${pagesProcessed} (${currentPage})...`);
              
              // Use the existing API service to avoid CORS issues
              const result = await transacApi.list({
                page: currentPage,
                pageSize: fetchSize,
                ...(startDate && { dateFrom: startDate.toISOString().split('T')[0] }),
                ...(endDate && { dateTo: endDate.toISOString().split('T')[0] }),
                ...(propSearchTerm && { search: propSearchTerm }),
                ...(sortBy && { sortBy }),
                ...(sortDir && { sortDir })
              });
              
              console.log(`Page ${currentPage} response:`, result);
              
              // Extract transactions from response
              const pageData = result.rows || [];
              
              // Calculate how many records to take from this page
              const offsetInPage = currentOffset % recordsPerPage;
              const recordsFromThisPage = pageData.slice(offsetInPage, offsetInPage + recordsToFetch);
              
              console.log(`Taking ${recordsFromThisPage.length} records from page ${currentPage} (offset ${offsetInPage})`);
              
              allData.push(...recordsFromThisPage);
              
              // Update counters
              recordsToFetch -= recordsFromThisPage.length;
              currentOffset += recordsFromThisPage.length;
              
              // Update progress and timing
              recordsProcessed = allData.length;
              const progress = Math.round((recordsProcessed / totalRecords) * 100);
              setExportProgress(`Processed ${recordsProcessed}/${totalRecords} records (${progress}%)...`);
              
              // If we got less data than expected, we might be at the end
              if (recordsFromThisPage.length < fetchSize) {
                console.log('Reached end of available data');
                break;
              }
            }
            
            dataToExport = allData;
            console.log(`Final custom export data: ${dataToExport.length} records`);
            
            if (dataToExport.length === 0) {
              throw new Error('No data found for the specified range');
            }
            
          } catch (error) {
            if (countdownInterval) clearInterval(countdownInterval);
            console.error('Custom export failed completely:', error);
            
            // Show user-friendly error message
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            alert(`Custom export failed: ${errorMessage}\n\nPlease try:\n1. Smaller record count\n2. Different offset\n3. Check your network connection\n4. Verify the data range exists`);
            
            // Don't fallback to current data as it's misleading - instead exit
            setIsExporting(false);
            setExportProgress('');
            setExportCountdown(0);
            return;
          }
          break;
      }
      
      // CSV generation phase
      setExportProgress('Generating CSV file...');
      
      const headers = MEMOIZED_TABLE_COLUMNS.map(col => col.label).join(',');
      const rows = dataToExport.map((transaction, index) => {
        // Update progress during CSV generation
        recordsProcessed = index + 1;
        if (index % 50 === 0) { // Update more frequently for better feedback
          const progress = Math.round((recordsProcessed / totalRecords) * 100);
          setExportProgress(`Generating CSV: ${recordsProcessed}/${totalRecords} records (${progress}%)...`);
        }
        
        return MEMOIZED_TABLE_COLUMNS.map(col => {
          let value: string;
          
          // Use render function if available, otherwise get raw value
          if (col.render) {
            try {
              const rendered = col.render(transaction);
              // Extract text from React elements if needed
              if (typeof rendered === 'string') {
                value = rendered;
              } else if (rendered && typeof rendered === 'object' && 'props' in rendered) {
                // For React elements, try to get the text content
                value = String(rendered.props.children || '');
              } else {
                value = String(rendered || '');
              }
            } catch (renderError) {
              // If render function fails, get raw value
              const rawValue = transaction[col.key];
              value = String(rawValue ?? '');
            }
          } else {
            // Get raw value and format it properly
            const rawValue = transaction[col.key];
            
            // Handle different data types
            if (rawValue === null || rawValue === undefined) {
              value = '';
            } else if (col.key.includes('date') || col.key.includes('time')) {
              // Format dates properly
              value = formatDateTime(String(rawValue));
            } else if (col.key.includes('wt') || col.key.includes('weight')) {
              // Format weights properly
              value = formatWeight(rawValue);
            } else {
              value = String(rawValue);
            }
          }
          
          // Escape quotes and commas in values
          return `"${value.replace(/"/g, '""')}"`;
        }).join(',');
      }).join('\n');
      
      setExportProgress('Creating download file...');
      
      // Final update to ensure accurate timing
      recordsProcessed = totalRecords;
      
      const csvContent = `${headers}\n${rows}`;
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      // Generate descriptive filename
      const timestamp = new Date().toISOString().split('T')[0];
      let filename = `transactions_${timestamp}`;
      
      switch (option) {
        case 'current':
          filename += `_current_view_${dataToExport.length}_records`;
          break;
        case 'date':
          filename += `_date_range_${dataToExport.length}_records`;
          break;
        case 'custom':
          filename += `_custom_${customExportOffset}-${customExportOffset + dataToExport.length}_records`;
          break;
      }
      filename += '.csv';
      
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      
      setExportProgress('Downloading file...');
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clear countdown and show success
      if (countdownInterval) clearInterval(countdownInterval);
      
      // Log performance for future improvements
      const totalTime = (Date.now() - startTime) / 1000;
      const rate = totalRecords / totalTime;
      console.log(`Export Performance: ${totalRecords} records in ${totalTime.toFixed(2)}s (${rate.toFixed(2)} records/sec)`);
      
      setExportProgress(`✅ Export complete! ${dataToExport.length} records exported to ${filename}`);
      
      // Close export modal after successful export
      setTimeout(() => {
        setShowExportModal(false);
        setExportProgress('');
        setExportCountdown(0);
      }, 2000);
      
      // Client-side CSV export is complete - no server export needed
    } catch (error) {
      if (countdownInterval) clearInterval(countdownInterval);
      console.error('Export failed:', error);
      setExportProgress('❌ Export failed');
      alert('Failed to export data. Please try again.');
      setTimeout(() => {
        setExportProgress('');
        setExportCountdown(0);
      }, 3000);
    } finally {
      setIsExporting(false);
    }
  };

  const headerCells = useMemo(() => {
    const cells: Record<string, React.ReactNode> = {};
    MEMOIZED_TABLE_COLUMNS.forEach((column: ColumnDefinition) => {
      if (!column.sortable) {
        cells[column.key as string] = <span className="text-left w-full">{column.label}</span>;
      } else {
        const isActive = sortBy === (column.key as string);
        const directionSymbol = sortDir === 'ASC' ? '↑' : '↓';
        cells[column.key as string] = (
          <button
            onClick={() => onSortChange(column.key as string)}
            className={`flex items-center space-x-1 text-left w-full hover:text-blue-600 transition-colors ${isActive ? 'text-blue-600' : ''}`}
          >
            <span>{column.label}</span>
            <ArrowUpDown className="h-3 w-3" />
            {isActive && <span className="text-xs">{directionSymbol}</span>}
          </button>
        );
      }
    });
    return cells;
  }, [onSortChange, sortBy, sortDir, MEMOIZED_TABLE_COLUMNS]);

  // Server-driven pagination - use server data directly
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startIndex = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIndex = Math.min(page * pageSize, total);
  
  // Use server-provided data directly (no client-side filtering)
  const displayData = transactions;
  
  // Server-driven pagination handler
  const handlePageChange = (newPage: number) => {
    onPageChange(newPage);
  };

  // Generate page numbers for pagination
  const generatePageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      
      if (page <= 3) {
        for (let i = 2; i <= 4; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (page >= totalPages - 2) {
        // Avoid duplicate page 1 by starting from max(2, totalPages - 3)
        const startPage = Math.max(2, totalPages - 3);
        if (startPage > 2) {
          pages.push('...');
        }
        for (let i = startPage; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push('...');
        for (let i = page - 1; i <= page + 1; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  return (
    <>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
      @keyframes slideInHoverPanel{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:none}}
      @keyframes txFadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
      .tx-grp-th{font-size:9px;font-weight:800;letter-spacing:0.07em;text-transform:uppercase;padding:4px 12px;white-space:nowrap;position:sticky;top:0;z-index:30;border-right:1px solid;border-bottom:1px solid;}
      .tx-col-th{font-size:10px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;padding:0 12px;white-space:nowrap;cursor:pointer;user-select:none;border-right:1px solid;border-bottom:1px solid;position:sticky;transition:filter 0.12s;}
      .tx-col-th:hover{filter:brightness(0.96);}
      .tx-sort-ic{opacity:0.2;margin-left:3px;display:inline-flex;vertical-align:middle;transition:opacity 0.12s;}
      .tx-sort-ic.on{opacity:1;}
      .tx-td-cell{padding:0 12px;border-right:1px solid;border-bottom:1px solid;vertical-align:middle;overflow:hidden;transition:background 0.1s;}
      .tx-frozen-glass{-webkit-backdrop-filter:blur(12px) saturate(1.6);backdrop-filter:blur(12px) saturate(1.6);}
      .tx-tr-expand td{background:rgba(59,130,246,0.04)!important;}
    `}</style>
    <div className="min-h-screen">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        {/* Header Section */}
        <div className="mb-6">
          <div className="glass-card rounded-xl overflow-hidden">
            <div className="p-6">
              {/* Title Row */}
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
                <div className="mb-4 lg:mb-0">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-enterprise-text tracking-tight">Transaction Records</h1>
                  <p className="text-gray-600 dark:text-enterprise-muted text-sm mt-1">
                    {total === 0 ? '0 of 0 transactions' : `${startIndex} - ${endIndex} of ${total} transactions`}
                  </p>
                </div>
                
                {/* Action Buttons */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onRefresh()}
                    disabled={refreshing || loading}
                    className="btn-primary"
                    title="Refresh data"
                  >
                    <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">{refreshing ? 'Refreshing...' : 'Refresh'}</span>
                  </button>
                  {/* Row density toggle */}
                  <div style={{ display: 'flex', border: '1px solid', borderColor: 'var(--border, #E5E7EB)', borderRadius: 8, overflow: 'hidden' }}>
                    {([['compact','≡','Compact'],['default','☰','Default'],['comfortable','⊟','Comfortable']] as const).map(([d, icon, label], i) => (
                      <button key={d} onClick={() => setDensity(d)} title={`${label} rows`}
                        style={{ width: 30, height: 32, background: density === d ? 'var(--text-primary,#111)' : 'transparent', color: density === d ? 'white' : 'var(--text-muted,#9CA3AF)', border: 'none', borderRight: i < 2 ? '1px solid var(--border,#E5E7EB)' : 'none', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.12s', fontFamily: 'inherit' }}>
                        {icon}
                      </button>
                    ))}
                  </div>
                  {/* Saved Views dropdown */}
                  <div ref={viewsDropdownRef} style={{ position:'relative' }}>
                    <button
                      onClick={() => { setShowViewsDropdown(v => !v); setShowColsPanel(false); }}
                      style={{ display:'flex', alignItems:'center', gap:6, padding:'0 12px', height:36, borderRadius:8, border: showViewsDropdown ? '1px solid #1F2937' : '1px solid #E5E7EB', background: showViewsDropdown ? '#1F2937' : 'white', color: showViewsDropdown ? 'white' : '#374151', cursor:'pointer', fontSize:13, fontWeight:600, fontFamily:"'DM Sans',sans-serif", transition:'all 0.12s', whiteSpace:'nowrap' }}
                      title="Switch column view preset"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                      <span className="hidden sm:inline">{activeView}</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ opacity:0.6 }}><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                    {showViewsDropdown && (
                      <div style={{ position:'absolute', top:'calc(100% + 6px)', right:0, zIndex:200, background:'white', border:'1px solid #E5E7EB', borderRadius:12, boxShadow:'0 8px 32px rgba(0,0,0,0.14)', width:240, overflow:'hidden' }} className="dark:bg-midnight-800 dark:border-midnight-600">
                        <div style={{ padding:'10px 14px 6px', fontSize:10, fontWeight:800, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.08em', fontFamily:"'DM Sans',sans-serif" }}>Saved Views</div>
                        {Object.entries(SAVED_VIEWS).map(([key, view]) => {
                          const icons: Record<string, React.ReactNode> = {
                            operator:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/></svg>,
                            logistics: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 5v4h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
                            finance:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
                            all:       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
                          };
                          const isActive = activeView === key;
                          return (
                            <button key={key} onClick={() => applyView(key)}
                              style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'9px 14px', border:'none', cursor:'pointer', fontSize:13, fontWeight: isActive ? 600 : 400, background: isActive ? '#EFF6FF' : 'transparent', color: isActive ? '#1D4ED8' : '#374151', textAlign:'left', fontFamily:"'DM Sans',sans-serif", transition:'background 0.1s' }}
                              className="dark:hover:bg-midnight-700 dark:text-enterprise-silver"
                            >
                              <span style={{ color: isActive ? '#3B82F6' : '#9CA3AF', flexShrink:0 }}>{icons[view.iconType]}</span>
                              <span style={{ flex:1 }}>{view.label}</span>
                              {isActive && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
                            </button>
                          );
                        })}
                        <div style={{ margin:'6px 14px', borderTop:'1px solid #F3F4F6', paddingTop:8, paddingBottom:8, fontSize:11, color:'#9CA3AF', lineHeight:1.5, fontFamily:"'DM Sans',sans-serif" }} className="dark:border-midnight-600">
                          Views control which columns are visible. Customize further with the Columns button.
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Columns toggle panel */}
                  <div ref={colsPanelRef} style={{ position:'relative' }}>
                    <button
                      onClick={() => { setShowColsPanel(v => !v); setShowViewsDropdown(false); }}
                      style={{ display:'flex', alignItems:'center', gap:6, padding:'0 12px', height:36, borderRadius:8, border: showColsPanel ? '1px solid #1F2937' : '1px solid #E5E7EB', background: showColsPanel ? '#1F2937' : 'white', color: showColsPanel ? 'white' : '#374151', cursor:'pointer', fontSize:13, fontWeight:600, fontFamily:"'DM Sans',sans-serif", transition:'all 0.12s', whiteSpace:'nowrap', position:'relative' }}
                      title="Show/hide individual columns"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/></svg>
                      <span className="hidden sm:inline">Columns</span>
                      {hiddenCols.size > 0 && <span style={{ position:'absolute', top:-5, right:-5, background:'#3B82F6', color:'white', borderRadius:'50%', width:16, height:16, fontSize:10, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1 }}>{hiddenCols.size}</span>}
                    </button>
                    {showColsPanel && (
                      <div style={{ position:'absolute', top:'calc(100% + 6px)', right:0, zIndex:200, background:'white', border:'1px solid #E5E7EB', borderRadius:12, boxShadow:'0 8px 32px rgba(0,0,0,0.14)', width:260, maxHeight:400, overflowY:'auto' }} className="dark:bg-midnight-800 dark:border-midnight-600">
                        <div style={{ padding:'10px 14px 6px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                          <span style={{ fontSize:10, fontWeight:800, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.08em', fontFamily:"'DM Sans',sans-serif" }}>Columns ({visibleColCount}/{ALL_COL_KEYS.length})</span>
                          {hiddenCols.size > 0 && <button onClick={() => { setHiddenCols(new Set()); setActiveView('All Columns'); }} style={{ fontSize:11, color:'#3B82F6', background:'none', border:'none', cursor:'pointer', fontWeight:600, fontFamily:"'DM Sans',sans-serif" }}>Show all</button>}
                        </div>
                        {Object.entries(
                          TABLE_COLUMNS.reduce((acc, col) => {
                            const g = col.group;
                            if (!acc[g]) acc[g] = [];
                            acc[g].push(col);
                            return acc;
                          }, {} as Record<string, ColumnDefinition[]>)
                        ).map(([grp, cols]) => (
                          <div key={grp}>
                            <div style={{ padding:'6px 14px 2px', fontSize:9, fontWeight:800, color: GRP_COLOR[grp]||'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.08em', fontFamily:"'DM Sans',sans-serif" }}>{grp}</div>
                            {cols.map(col => {
                              const colKey = col.key as string;
                              const isVisible = !hiddenCols.has(colKey);
                              const isLocked = LOCKED_PINS.has(colKey);
                              return (
                                <label key={colKey} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 14px', cursor: isLocked ? 'default' : 'pointer', opacity: isLocked ? 0.55 : 1, fontFamily:"'DM Sans',sans-serif" }} className="hover:bg-gray-50 dark:hover:bg-midnight-700">
                                  <input type="checkbox" checked={isVisible} disabled={isLocked} onChange={() => !isLocked && toggleColVisibility(colKey)}
                                    style={{ accentColor:'#3B82F6', width:13, height:13, flexShrink:0, cursor: isLocked ? 'default' : 'pointer' }}
                                  />
                                  <span style={{ fontSize:12, color: isVisible ? '#374151' : '#9CA3AF', fontWeight: isVisible ? 500 : 400 }} className="dark:text-enterprise-silver">{col.label}</span>
                                  {isLocked && <svg width="9" height="9" viewBox="0 0 24 24" fill="#9CA3AF" style={{ marginLeft:'auto' }}><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2z"/></svg>}
                                </label>
                              );
                            })}
                          </div>
                        ))}
                        <div style={{ height:6 }} />
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => selectedIds.size > 0 ? handleBulkExport() : setShowExportModal(true)}
                    disabled={transactions.length === 0 || isExporting || bulkLoading}
                    className="btn-success"
                    title={selectedIds.size > 0 ? `Export ${selectedIds.size} selected` : "Export options"}
                  >
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">
                      {isExporting || bulkLoading ? 'Exporting...' : selectedIds.size > 0 ? `Export (${selectedIds.size})` : 'Export'}
                    </span>
                  </button>
                </div>
              </div>
              
              {/* Compact Filter Bar */}
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {/* Row 1: Search + Date quick pills + Status pills */}
                <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>

                  {/* Search */}
                  <div style={{ position:'relative', minWidth:220, flex:'1 1 220px', maxWidth:360 }}>
                    <Search style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', width:14, height:14, color:'#9CA3AF', pointerEvents:'none' }} />
                    <input
                      type="text"
                      placeholder="ID, plate, driver, product..."
                      value={localSearchTerm}
                      onChange={e => setLocalSearchTerm(e.target.value)}
                      disabled={loading}
                      style={{ width:'100%', paddingLeft:32, paddingRight: localSearchTerm ? 28 : 10, paddingTop:7, paddingBottom:7, border:'1px solid #E5E7EB', borderRadius:8, fontSize:13, fontFamily:"'DM Sans',sans-serif", background: localSearchTerm ? '#FFFBEB' : 'white', outline:'none', boxSizing:'border-box' }}
                      className="dark:bg-midnight-700 dark:border-midnight-600 dark:text-enterprise-silver"
                    />
                    {localSearchTerm && (
                      <button onClick={() => { setLocalSearchTerm(''); onSearchChange(''); }} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', padding:2, color:'#9CA3AF', display:'flex', alignItems:'center' }}>
                        <X style={{ width:12, height:12 }} />
                      </button>
                    )}
                  </div>

                  {/* Date quick-filter pills */}
                  <div style={{ display:'flex', alignItems:'center', gap:2, flexShrink:0 }}>
                    {([
                      ['today',     'Today'],
                      ['yesterday', 'Yesterday'],
                      ['week',      'This Week'],
                      ['month',     'This Month'],
                      ['custom',    'Custom'],
                    ] as const).map(([key, label]) => {
                      const isActive = dateQuick === key;
                      return (
                        <button key={key}
                          onClick={() => {
                            if (key === 'custom') {
                              setDateQuick('custom');
                              setShowDatePicker(true);
                              return;
                            }
                            const now = new Date();
                            const toStr = (d: Date) => d.toISOString().split('T')[0];
                            let s: string, e: string;
                            if (key === 'today') { s = e = toStr(now); }
                            else if (key === 'yesterday') { const y = new Date(now); y.setDate(y.getDate()-1); s = e = toStr(y); }
                            else if (key === 'week') { const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay()+6)%7)); s = toStr(mon); e = toStr(now); }
                            else { s = toStr(new Date(now.getFullYear(), now.getMonth(), 1)); e = toStr(now); }
                            if (isActive) {
                              setDateQuick(null);
                              setStartDateStr(null); setEndDateStr(null);
                              onDateRangeChange?.(null, null);
                            } else {
                              setDateQuick(key);
                              setStartDateStr(s); setEndDateStr(e);
                              onDateRangeChange?.(new Date(s), new Date(e));
                            }
                          }}
                          style={{ padding:'5px 11px', borderRadius:7, border: isActive ? '1.5px solid #1F2937' : '1px solid #E5E7EB', background: isActive ? '#1F2937' : 'white', color: isActive ? 'white' : '#374151', fontSize:12, fontWeight: isActive ? 600 : 500, cursor:'pointer', fontFamily:"'DM Sans',sans-serif", transition:'all 0.1s', whiteSpace:'nowrap' }}
                          className="dark:border-midnight-600 dark:bg-midnight-700 dark:text-enterprise-silver"
                        >{label}</button>
                      );
                    })}
                    {/* Show selected custom range */}
                    {dateQuick === 'custom' && startDateStr && (
                      <span style={{ fontSize:11, color:'#6B7280', paddingLeft:4, whiteSpace:'nowrap', fontFamily:"'DM Sans',sans-serif" }}>
                        {startDateStr}{endDateStr && endDateStr !== startDateStr ? ` – ${endDateStr}` : ''}
                      </span>
                    )}
                    {/* Clear date */}
                    {dateQuick && (
                      <button onClick={() => { setDateQuick(null); setStartDateStr(null); setEndDateStr(null); onDateRangeChange?.(null, null); }}
                        style={{ marginLeft:2, padding:'4px 6px', borderRadius:6, border:'none', background:'none', cursor:'pointer', color:'#9CA3AF', display:'flex', alignItems:'center' }} title="Clear date filter">
                        <X style={{ width:12, height:12 }} />
                      </button>
                    )}
                  </div>

                  {/* Separator */}
                  <div style={{ width:1, height:22, background:'#E5E7EB', flexShrink:0 }} className="dark:bg-midnight-600" />

                  {/* Status pills */}
                  <div style={{ display:'flex', alignItems:'center', gap:2, flexShrink:0 }}>
                    {(['All', 'Valid', 'Cancelled', 'Void', 'Pending'] as const).map(s => {
                      const isAll = s === 'All';
                      const isActive = isAll ? !statusFilter : statusFilter === s;
                      const cfg: Record<string, {dot:string; activeBg:string; activeColor:string}> = {
                        Valid:     { dot:'#22C55E', activeBg:'#DCFCE7', activeColor:'#16A34A' },
                        Cancelled: { dot:'#EF4444', activeBg:'#FEE2E2', activeColor:'#DC2626' },
                        Void:      { dot:'#9CA3AF', activeBg:'#F3F4F6', activeColor:'#6B7280' },
                        Pending:   { dot:'#F97316', activeBg:'#FEF3C7', activeColor:'#D97706' },
                      };
                      const c = cfg[s];
                      return (
                        <button key={s}
                          onClick={() => onStatusFilterChange?.(isAll ? null : isActive ? null : s)}
                          style={{
                            padding:'5px 11px', borderRadius:999, fontSize:12, fontWeight: isActive ? 700 : 500, cursor:'pointer',
                            fontFamily:"'DM Sans',sans-serif", display:'flex', alignItems:'center', gap:5, transition:'all 0.1s', whiteSpace:'nowrap',
                            border: isActive ? (isAll ? '1.5px solid #1F2937' : `1.5px solid ${c.dot}66`) : '1px solid #E5E7EB',
                            background: isActive ? (isAll ? '#1F2937' : c.activeBg) : 'white',
                            color: isActive ? (isAll ? 'white' : c.activeColor) : '#374151',
                          }}
                          className="dark:border-midnight-600 dark:bg-midnight-700 dark:text-enterprise-silver"
                        >
                          {!isAll && <span style={{ width:6, height:6, borderRadius:'50%', background: isActive ? c.activeColor : '#D1D5DB', display:'inline-block', flexShrink:0 }} />}
                          {s}
                        </button>
                      );
                    })}
                  </div>

                  {/* More filters toggle */}
                  {(filterOptions?.vehicles?.length || filterOptions?.products?.length) ? (
                    <button
                      onClick={() => setShowMoreFilters(v => !v)}
                      style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 11px', borderRadius:8, border: (vehicleFilter||productFilter||showMoreFilters) ? '1.5px solid #1F2937' : '1px solid #E5E7EB', background: (vehicleFilter||productFilter||showMoreFilters) ? '#1F2937' : 'white', color: (vehicleFilter||productFilter||showMoreFilters) ? 'white' : '#374151', fontSize:12, fontWeight:500, cursor:'pointer', fontFamily:"'DM Sans',sans-serif", flexShrink:0, transition:'all 0.1s' }}
                      className="dark:border-midnight-600 dark:bg-midnight-700 dark:text-enterprise-silver"
                    >
                      <Filter style={{ width:12, height:12 }} />
                      More
                      {(vehicleFilter || productFilter) && <span style={{ background:'#3B82F6', color:'white', borderRadius:'50%', width:14, height:14, fontSize:9, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>{[vehicleFilter,productFilter].filter(Boolean).length}</span>}
                      <ChevronDown style={{ width:11, height:11, opacity:0.6, transform: showMoreFilters ? 'rotate(180deg)' : 'none', transition:'transform 0.15s' }} />
                    </button>
                  ) : null}

                  {/* Results count / active filter chip */}
                  {localSearchTerm.trim() && (
                    <span style={{ fontSize:12, color:'#6B7280', whiteSpace:'nowrap', fontFamily:"'DM Sans',sans-serif" }}>
                      {displayData.length} result{displayData.length !== 1 ? 's' : ''} for <strong style={{ color:'#374151' }}>"{localSearchTerm}"</strong>
                    </span>
                  )}
                </div>

                {/* Row 2: More filters (vehicle + product) */}
                {showMoreFilters && (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:8, alignItems:'center', padding:'10px 14px', background:'#F9FAFB', borderRadius:10, border:'1px solid #E5E7EB' }} className="dark:bg-midnight-800 dark:border-midnight-600">
                    {/* Vehicle Type */}
                    {filterOptions?.vehicles?.length ? (
                      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                        <span style={{ fontSize:10, fontWeight:700, color:'#8B5CF6', textTransform:'uppercase', letterSpacing:'0.07em', fontFamily:"'DM Sans',sans-serif" }}>Vehicle Type</span>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                          <button onClick={() => onVehicleFilterChange?.(null)} style={{ padding:'4px 10px', borderRadius:999, fontSize:12, border: !vehicleFilter ? '1.5px solid #7C3AED' : '1px solid #DDD8FE', background: !vehicleFilter ? '#EDE9FE' : 'white', color: !vehicleFilter ? '#6D28D9' : '#374151', cursor:'pointer', fontFamily:"'DM Sans',sans-serif", fontWeight: !vehicleFilter ? 700 : 400 }}>All</button>
                          {filterOptions.vehicles.map(v => (
                            <button key={v} onClick={() => onVehicleFilterChange?.(vehicleFilter === v ? null : v)}
                              style={{ padding:'4px 10px', borderRadius:999, fontSize:12, border: vehicleFilter === v ? '1.5px solid #7C3AED' : '1px solid #E5E7EB', background: vehicleFilter === v ? '#EDE9FE' : 'white', color: vehicleFilter === v ? '#6D28D9' : '#374151', cursor:'pointer', fontFamily:"'DM Sans',sans-serif", fontWeight: vehicleFilter === v ? 700 : 400, whiteSpace:'nowrap' }}>{v}</button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {/* Product */}
                    {filterOptions?.products?.length ? (
                      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                        <span style={{ fontSize:10, fontWeight:700, color:'#22C55E', textTransform:'uppercase', letterSpacing:'0.07em', fontFamily:"'DM Sans',sans-serif" }}>Product</span>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                          <button onClick={() => onProductFilterChange?.(null)} style={{ padding:'4px 10px', borderRadius:999, fontSize:12, border: !productFilter ? '1.5px solid #16A34A' : '1px solid #DCFCE7', background: !productFilter ? '#DCFCE7' : 'white', color: !productFilter ? '#15803D' : '#374151', cursor:'pointer', fontFamily:"'DM Sans',sans-serif", fontWeight: !productFilter ? 700 : 400 }}>All</button>
                          {filterOptions.products.map(p => (
                            <button key={p} onClick={() => onProductFilterChange?.(productFilter === p ? null : p)}
                              style={{ padding:'4px 10px', borderRadius:999, fontSize:12, border: productFilter === p ? '1.5px solid #16A34A' : '1px solid #E5E7EB', background: productFilter === p ? '#DCFCE7' : 'white', color: productFilter === p ? '#15803D' : '#374151', cursor:'pointer', fontFamily:"'DM Sans',sans-serif", fontWeight: productFilter === p ? 700 : 400, whiteSpace:'nowrap' }}>{p}</button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {/* Clear all */}
                    {(vehicleFilter || productFilter) && (
                      <button onClick={() => { onVehicleFilterChange?.(null); onProductFilterChange?.(null); }}
                        style={{ marginLeft:'auto', padding:'5px 10px', borderRadius:7, border:'1px solid #FCA5A5', background:'white', color:'#EF4444', fontSize:12, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
                        Clear
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Date Picker Modal */}
        {showDatePicker && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-25 z-50 flex items-center justify-center p-4"
            onMouseMove={handleDateMouseMove}
            onMouseUp={handleDateMouseUp}
            onMouseLeave={handleDateMouseUp}
          >
            <div 
              className="bg-white border border-gray-200 rounded-lg shadow-xl max-w-4xl w-full max-h-screen overflow-y-auto cursor-move"
              style={{
                transform: `translate(${dragPositionDate.x}px, ${dragPositionDate.y}px)`,
                transition: isDraggingDate ? 'none' : 'transform 0.2s ease-out'
              }}
              onMouseDown={handleDateMouseDown}
            >
              <div className="flex justify-between items-center p-6 border-b border-gray-200">
                <div className="text-lg font-medium text-gray-700">
                  Select Date Range
                </div>
                <button
                  onClick={() => setShowDatePicker(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6">
                <div className="flex justify-end mb-4">
                <button
                  onClick={() => {
                    if (onDateRangeChange) {
                      onDateRangeChange(null, null);
                    }
                  }}
                  className="text-sm text-blue-600 dark:text-neon-cyan-glow hover:text-blue-800 dark:hover:text-neon-cyan-bright transition-colors"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  Clear Selection
                </button>
                </div>
                
                {/* Custom Date Picker UI */}
                <div className="space-y-4" onMouseDown={(e) => e.stopPropagation()}>
                  {/* Month/Year Selection */}
                  <div className="flex items-center justify-center space-x-4 mb-6">
                    <select
                      value={calendarData ? calendarData.month - 1 : getCalendarReferenceDate().getMonth()}
                      onChange={(e) => {
                        const currentMonth = parseInt(e.target.value);
                        const currentYear = calendarData ? calendarData.year : getCalendarReferenceDate().getFullYear();
                        fetchCalendarData(currentYear, currentMonth + 1);
                      }}
                      className="px-4 py-2 border border-gray-300 dark:border-midnight-600 rounded-lg focus:ring-2 focus:ring-neon-cyan-glow focus:border-transparent text-sm bg-white dark:bg-midnight-700 dark:text-enterprise-silver"
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      {['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'].map((month, index) => (
                        <option key={month} value={index}>{month}</option>
                      ))}
                    </select>
                    
                    <select
                      value={calendarData ? calendarData.year : getCalendarReferenceDate().getFullYear()}
                      onChange={(e) => {
                        const currentMonth = calendarData ? calendarData.month - 1 : getCalendarReferenceDate().getMonth();
                        const newYear = parseInt(e.target.value);
                        fetchCalendarData(newYear, currentMonth + 1);
                      }}
                      className="px-4 py-2 border border-gray-300 dark:border-midnight-600 rounded-lg focus:ring-2 focus:ring-neon-cyan-glow focus:border-transparent text-sm bg-white dark:bg-midnight-700 dark:text-enterprise-silver"
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>

                  {/* Calendar Grid */}
                  <div className="grid grid-cols-7 gap-1 text-center">
                    {/* Weekday headers */}
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                      <div key={index} className="text-xs font-medium text-gray-500 dark:text-enterprise-muted py-2">
                        {day}
                      </div>
                    ))}
                    
                    {calendarLoading ? (
                      <div className="col-span-7 text-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent mx-auto mb-2"></div>
                        <div className="text-sm text-gray-500 dark:text-enterprise-muted">Loading calendar...</div>
                      </div>
                    ) : calendarData ? (
                      calendarData.calendarDays.map((calendarDay, index) => {
                        // Create date using UTC noon for consistency
                        const dateStr = calendarDay.date;
                        const [year, month, day] = dateStr.split('-').map(Number);
                        const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
                        return (
                          <button
                            key={index}
                            onClick={() => handleDayClick(calendarDay)}
                            onMouseDown={(e) => e.stopPropagation()}
                            className={`p-2 text-sm rounded-lg transition-colors ${
                              !calendarDay.isInMonth
                                ? 'invisible'
                                : !calendarDay.hasTransactions
                                ? 'text-gray-400 dark:text-enterprise-muted hover:bg-gray-50 dark:hover:bg-midnight-700 cursor-pointer'
                                : isDateInRange(date, startDate ?? null, endDate ?? null)
                                ? 'bg-blue-600 dark:bg-neon-cyan-glow text-white'
                                : isDateSelected(date)
                                ? 'bg-blue-100 dark:bg-neon-cyan-glow/20 text-blue-600 dark:text-neon-cyan-glow'
                                : 'hover:bg-gray-100 dark:hover:bg-midnight-700 text-gray-700 dark:text-enterprise-silver cursor-pointer'
                            } ${calendarDay.isToday ? 'ring-2 ring-blue-400 dark:ring-neon-cyan-glow' : ''}`}
                            disabled={!calendarDay.isInMonth}
                          >
                            {calendarDay.day}
                          </button>
                        );
                      })
                    ) : (
                      <div className="col-span-7 text-center py-8 text-red-500 dark:text-red-400">
                        Failed to load calendar data
                      </div>
                    )}
                  </div>

                  {/* Date Range Display */}
                  <div className="mt-6 p-4 bg-gray-50 dark:bg-midnight-750 rounded-lg">
                    <div className="text-center text-sm text-gray-600 dark:text-enterprise-muted">
                      {startDateStr && endDateStr ? (
                        <>
                          <div className="font-medium text-gray-900 dark:text-enterprise-silver">
                            {formatDateFromString(startDateStr)} - {formatDateFromString(endDateStr)}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-enterprise-muted mt-1">
                            {calculateDaysFromStrings(startDateStr, endDateStr)} days selected
                          </div>
                        </>
                      ) : startDateStr ? (
                        <div className="font-medium text-gray-900 dark:text-enterprise-silver">
                          {formatDateFromString(startDateStr)}
                        </div>
                      ) : (
                        <div className="text-gray-500 dark:text-enterprise-muted">Select a date range</div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200">
                  <button
                    onClick={() => setShowDatePicker(false)}
                    className="btn-ghost"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setShowDatePicker(false);
                    }}
                    className="btn-primary"
                  >
                    Apply Date Range
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Actions Toolbar */}
        {selectedIds.size > 0 && (
          <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-4 shadow-md">
            {/* Error Messages */}
            {bulkError && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 rounded-lg flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <p className="text-red-800 text-sm">{bulkError}</p>
              </div>
            )}

            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-blue-600" />
                <span className="font-medium text-gray-900">
                  {selectedIds.size} transaction{selectedIds.size !== 1 ? 's' : ''} selected
                </span>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="text-sm text-gray-600 dark:text-enterprise-muted hover:text-gray-900 dark:hover:text-enterprise-silver transition-colors"
                >
                  Clear selection
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setShowBulkStatusModal(true)}
                  disabled={bulkLoading}
                  className="btn-primary"
                  title="Update status for selected transactions"
                >
                  <ArrowUpDown className="h-4 w-4" />
                  Status
                </button>

                <button
                  onClick={handleBulkDelete}
                  disabled={bulkLoading}
                  className="btn-danger"
                  title="Move selected transactions to trash"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Status Update Modal */}
        {showBulkStatusModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="glass-card rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-enterprise-text mb-4">Update Status</h2>
              <p className="text-gray-600 dark:text-enterprise-muted mb-4">Update status for {selectedIds.size} selected transaction(s)</p>
              
              <select
                value={bulkStatusValue}
                onChange={(e) => setBulkStatusValue(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-midnight-600 rounded-lg focus:ring-2 focus:ring-neon-cyan-glow focus:border-transparent mb-6 bg-white dark:bg-midnight-700 dark:text-enterprise-silver"
              >
                <option value="Valid">Valid</option>
                <option value="Pending">Pending</option>
                <option value="Void">Void</option>
                <option value="Rejected">Rejected</option>
              </select>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowBulkStatusModal(false)}
                  className="btn-ghost flex-1"
                  disabled={bulkLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkStatusUpdate}
                  disabled={bulkLoading}
                  className="btn-primary flex-1"
                >
                  {bulkLoading ? 'Updating...' : 'Update'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Table Container */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="text-gray-400 mb-6">
                <RefreshCw className="h-12 w-12 mx-auto animate-spin" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Loading transactions...
              </h3>
              <p className="text-gray-600">
                {propSearchTerm ? 'Searching for matching transactions...' : 'Fetching transaction data...'}
              </p>
            </div>
          ) : displayData.length === 0 ? (
            <div className="p-16 flex flex-col items-center">
              {/* Enhancement 4: Smart Empty State */}
              <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="mb-6">
                <rect x="10" y="16" width="60" height="52" rx="6" fill="#F3F4F6" />
                <rect x="18" y="28" width="44" height="4" rx="2" fill="#D1D5DB" />
                <rect x="18" y="38" width="32" height="4" rx="2" fill="#D1D5DB" />
                <rect x="18" y="48" width="38" height="4" rx="2" fill="#D1D5DB" />
                <circle cx="55" cy="55" r="16" fill="white" stroke="#3B82F6" strokeWidth="2" />
                <line x1="49" y1="49" x2="61" y2="61" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="61" y1="49" x2="49" y2="61" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-enterprise-silver mb-2">
                {localSearchTerm && statusFilter && statusFilter !== 'All'
                  ? `No ${statusFilter} results for "${localSearchTerm}"`
                  : localSearchTerm
                  ? `No results for "${localSearchTerm}"`
                  : statusFilter && statusFilter !== 'All'
                  ? `No ${statusFilter} transactions`
                  : 'No transactions found'}
              </h3>
              <p className="text-sm text-gray-500 dark:text-enterprise-muted mb-8 text-center max-w-sm">
                {localSearchTerm && statusFilter && statusFilter !== 'All'
                  ? 'Try clearing the status filter or changing your search term.'
                  : localSearchTerm
                  ? 'Try a different ID, plate number, or driver name.'
                  : statusFilter && statusFilter !== 'All'
                  ? `There are no ${statusFilter} transactions for the selected date range.`
                  : 'Try adjusting the date range or filters to find transactions.'}
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setLocalSearchTerm(''); onSearchChange(''); onStatusFilterChange?.(''); }}
                  className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-neon-cyan-glow border border-blue-300 dark:border-neon-cyan-glow/40 rounded-lg hover:bg-blue-50 dark:hover:bg-neon-cyan-glow/10 transition-colors"
                >
                  Clear filters
                </button>
                <button
                  onClick={() => { setLocalSearchTerm(''); onSearchChange(''); onStatusFilterChange?.(''); onDateRangeChange?.(null, null); }}
                  className="px-4 py-2 text-sm font-medium text-gray-500 dark:text-enterprise-muted rounded-lg hover:bg-gray-100 dark:hover:bg-midnight-700 transition-colors"
                >
                  Show all
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto overflow-y-visible">
              {highlightMode && (() => {
                const hlCount = displayData.filter(t =>
                  (highlightMode === 'void'           && t.status?.toLowerCase() === 'void') ||
                  (highlightMode === 'cancelled'      && t.status?.toLowerCase() === 'cancelled') ||
                  (highlightMode === 'missing-plates' && !t.plate?.trim())
                ).length;
                const hlLabel =
                  highlightMode === 'void'           ? 'void transactions' :
                  highlightMode === 'cancelled'      ? 'cancelled transactions' :
                  highlightMode === 'missing-plates' ? 'trips missing a plate number' :
                  'flagged rows';
                const hlColor =
                  highlightMode === 'cancelled'      ? '#EF4444' :
                  highlightMode === 'missing-plates' ? '#F97316' : '#F59E0B';
                return (
                  <div style={{
                    display:'flex', alignItems:'center', gap:10,
                    padding:'8px 16px',
                    background:`color-mix(in srgb, ${hlColor} 10%, var(--bg-card))`,
                    borderBottom:`1px solid color-mix(in srgb, ${hlColor} 30%, var(--border))`,
                    fontSize:13,
                  }}>
                    <span style={{ width:8, height:8, borderRadius:'50%', background:hlColor, flexShrink:0, display:'inline-block' }} />
                    <span style={{ color:'var(--text-secondary)' }}>
                      Highlighting{' '}
                      <strong style={{ color:hlColor }}>{hlCount}</strong>
                      {' '}{hlLabel} on this page. Click any highlighted row to inspect.
                    </span>
                  </div>
                );
              })()}
              <table style={{ borderCollapse:'collapse', tableLayout:'fixed', width:'max-content', minWidth:'100%', fontFamily:"'DM Sans',sans-serif" }}>
                <thead>
                  {/* ROW 1: Group header row */}
                  <tr style={{ height:24 }}>
                    <th
                      colSpan={2}
                      className="tx-frozen-glass"
                      style={{ position:'sticky', left:0, top:0, zIndex:30, background:frzBgHd, backdropFilter:frzBlur, WebkitBackdropFilter:frzBlur, borderRight:`1px solid ${frzBrd}`, borderBottom:`1px solid ${frzBrd}`, width:CB_W+ACT_W, minWidth:CB_W+ACT_W, boxSizing:'border-box' }}
                    />
                    {frozenGroupSpans.map((gs, i) => {
                      const firstFrz = frozenCols.find(c => c.group === gs.group);
                      return (
                        <th
                          key={'fg'+i}
                          colSpan={gs.span}
                          className="tx-grp-th tx-frozen-glass"
                          style={{
                            background: GRP_COLOR[gs.group]+'22',
                            backdropFilter: frzBlur,
                            WebkitBackdropFilter: frzBlur,
                            color: GRP_COLOR[gs.group],
                            borderColor: frzBrd,
                            position: 'sticky',
                            left: firstFrz ? frozenLeft[firstFrz.key as string] : undefined,
                            top: 0,
                            zIndex: 30,
                          }}
                        >{gs.group}</th>
                      );
                    })}
                    {scrollGroupSpans.map((gs, i) => (
                      <th
                        key={'sg'+i}
                        colSpan={gs.span}
                        className="tx-grp-th"
                        style={{
                          background: GRP_COLOR[gs.group]+'18',
                          color: GRP_COLOR[gs.group],
                          borderColor: 'var(--border)',
                          position: 'sticky',
                          top: 0,
                          zIndex: 10,
                        }}
                      >{gs.group}</th>
                    ))}
                  </tr>
                  {/* ROW 2: Column header row */}
                  <tr style={{ height:36 }}>
                    {/* Checkbox header */}
                    <th
                      className="tx-col-th tx-frozen-glass"
                      style={{ width:CB_W, minWidth:CB_W, left:0, top:'24px', zIndex:28, background:frzBgHd, backdropFilter:frzBlur, WebkitBackdropFilter:frzBlur, borderColor:frzBrd, borderTop:`2px solid ${GRP_COLOR['Identity']}`, position:'sticky', textAlign:'center', padding:'0 0' }}
                    >
                      <button
                        onClick={toggleSelectAll}
                        className="inline-flex items-center justify-center p-1 rounded hover:bg-gray-200 dark:hover:bg-midnight-700 transition-colors"
                        title={selectedIds.size === transactions.length && transactions.length > 0 ? "Deselect all" : "Select all"}
                      >
                        {selectedIds.size === transactions.length && transactions.length > 0 ? (
                          <CheckSquare className="h-4 w-4 text-blue-600 dark:text-neon-cyan-glow" />
                        ) : (
                          <Square className="h-4 w-4 text-gray-400 dark:text-enterprise-muted" />
                        )}
                      </button>
                    </th>
                    {/* Actions header */}
                    <th
                      className="tx-col-th tx-frozen-glass"
                      style={{ width:ACT_W, minWidth:ACT_W, left:CB_W, top:'24px', zIndex:28, background:frzBgHd, backdropFilter:frzBlur, WebkitBackdropFilter:frzBlur, borderColor:frzBrd, borderTop:`2px solid ${GRP_COLOR['Identity']}`, position:'sticky' }}
                    >
                      ACTIONS
                    </th>
                    {/* Column headers */}
                    {orderedCols.map((col: ColumnDefinition) => {
                      const colKey = col.key as string;
                      const isFrz = pinnedCols.has(colKey);
                      const isLast = colKey === lastFrozenKey;
                      const isPinned = pinnedCols.has(colKey);
                      const isLocked = LOCKED_PINS.has(colKey);
                      const gc = GRP_COLOR[col.group] || '#9CA3AF';
                      const cw = colWidths[colKey] ?? col.w;
                      return (
                        <th
                          key={colKey}
                          data-col={colKey}
                          className="tx-col-th select-none group"
                          style={{
                            width: cw,
                            minWidth: cw,
                            top: '24px',
                            zIndex: isFrz ? 28 : 12,
                            background: frzBgHd,
                            backdropFilter: frzBlur,
                            WebkitBackdropFilter: frzBlur,
                            borderColor: isFrz ? frzBrd : 'var(--border)',
                            color: gc,
                            left: isFrz ? frozenLeft[colKey] : undefined,
                            textAlign: (col.align || 'left') as React.CSSProperties['textAlign'],
                            borderTop: `2px solid ${gc}`,
                            position: 'sticky',
                            boxShadow: isLast ? frzShd : undefined,
                          }}
                          onClick={() => onSortChange(colKey)}
                        >
                          <div style={{ display:'flex', alignItems:'center', gap:4, paddingRight:8, position:'relative' }}>
                            <span style={{ flex:1 }}>{col.label}</span>
                            {/* Pin/lock button */}
                            <button
                              onClick={(e) => { e.stopPropagation(); togglePin(colKey); }}
                              title={isLocked ? 'Default pinned column' : isPinned ? 'Unpin column' : 'Pin column'}
                              className={`transition-opacity p-0.5 rounded hover:bg-gray-200 dark:hover:bg-midnight-600 flex-shrink-0 ${isPinned ? 'opacity-100 text-blue-500 dark:text-neon-cyan-glow' : 'opacity-0 group-hover:opacity-60 text-gray-400'}`}
                            >
                              {isLocked
                                ? <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
                                : <svg width="10" height="10" viewBox="0 0 24 24" fill={isPinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M12 2l2.4 6H20l-5 3.6 1.9 6L12 14l-4.9 3.6 1.9-6L4 8h5.6z"/></svg>
                              }
                            </button>
                            {/* Sort icon */}
                            <span className={`tx-sort-ic${sortBy === colKey ? ' on' : ''}`} style={{ color: gc }}>
                              {sortBy === colKey ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                            </span>
                            {/* Resize handle */}
                            <div
                              style={{ position:'absolute', right:0, top:0, width:5, height:'100%', cursor:'col-resize', zIndex:1 }}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const thEl = e.currentTarget.closest('th') as HTMLElement;
                                resizingRef.current = { key: colKey, startX: e.clientX, startW: thEl.offsetWidth };
                                document.body.style.cursor = 'col-resize';
                                document.body.style.userSelect = 'none';
                              }}
                            />
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {displayData.length === 0 && (
                    <tr>
                      <td colSpan={orderedCols.length + 2} style={{ padding:'48px 24px', textAlign:'center', background:'white' }} className="dark:bg-midnight-800">
                        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" style={{ margin:'0 auto 16px' }}>
                          <rect x="8" y="12" width="48" height="40" rx="6" fill="#F1F5F9" stroke="#CBD5E1" strokeWidth="2"/>
                          <rect x="14" y="22" width="14" height="3" rx="1.5" fill="#94A3B8"/>
                          <rect x="14" y="29" width="22" height="3" rx="1.5" fill="#CBD5E1"/>
                          <rect x="14" y="36" width="18" height="3" rx="1.5" fill="#CBD5E1"/>
                          <circle cx="44" cy="44" r="12" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="2"/>
                          <line x1="39" y1="44" x2="49" y2="44" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round"/>
                        </svg>
                        <div style={{ fontSize:16, fontWeight:700, color:'#374151', marginBottom:6 }} className="dark:text-enterprise-silver">
                          {(localSearchTerm || activeFilters?.status || activeFilters?.dateRange) ? 'No results match your filters' : 'No transactions found'}
                        </div>
                        <div style={{ fontSize:13, color:'#9CA3AF', marginBottom:20 }}>
                          {(localSearchTerm || activeFilters?.status || activeFilters?.dateRange)
                            ? 'Try adjusting your search terms or clearing the active filters.'
                            : 'Transactions will appear here once data is available.'}
                        </div>
                        {(localSearchTerm || activeFilters?.status || activeFilters?.dateRange) && (
                          <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
                            <button onClick={() => setLocalSearchTerm('')} style={{ padding:'7px 16px', borderRadius:8, border:'1px solid #E5E7EB', background:'white', fontSize:13, cursor:'pointer', color:'#374151' }}>
                              Clear search
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                  {displayData.map((transaction: Transaction, index: number) => {
                    const isSel = selectedIds.has(transaction.id as number);
                    const isExp = expandedRow === transaction.id;
                    const isHighlighted = !!highlightTransId && transaction.id === highlightTransId;
                    const isAlertHighlight =
                      (highlightMode === 'void'           && transaction.status?.toLowerCase() === 'void') ||
                      (highlightMode === 'cancelled'      && transaction.status?.toLowerCase() === 'cancelled') ||
                      (highlightMode === 'missing-plates' && !transaction.plate?.trim());
                    const alertBg =
                      highlightMode === 'cancelled'      ? 'rgba(239,68,68,0.09)'  :
                      highlightMode === 'missing-plates' ? 'rgba(249,115,22,0.09)' :
                                                           'rgba(245,158,11,0.09)';
                    const alertRing =
                      highlightMode === 'cancelled'      ? 'rgba(239,68,68,0.35)'  :
                      highlightMode === 'missing-plates' ? 'rgba(249,115,22,0.35)' :
                                                           'rgba(245,158,11,0.35)';
                    const rowBg = isHighlighted
                      ? 'rgba(34,211,238,0.08)'
                      : isAlertHighlight
                      ? alertBg
                      : isSel
                      ? frzBgSel
                      : index % 2 === 0 ? undefined : 'rgba(0,0,0,0.018)';
                    return (
                      <React.Fragment key={transaction.id}>
                        <tr
                          ref={isHighlighted ? highlightRowRef : undefined}
                          className={`transition-all duration-150${isExp ? ' tx-tr-expand' : ''}${isHighlighted ? ' animate-pulse-once' : ''}`}
                          style={{
                            height: ROW_H,
                            cursor: 'pointer',
                            background: rowBg,
                            boxShadow: isAlertHighlight && !isHighlighted ? `inset 3px 0 0 ${alertRing}, inset 0 0 0 1px ${alertRing}` : undefined,
                          }}
                          onClick={() => setExpandedRow(isExp ? null : (transaction.id as number))}
                          onMouseEnter={(e) => {
                            if (!editingStatus) {
                              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                              setHoverY(rect.top + rect.height / 2);
                              setHoverRow(transaction);
                            }
                          }}
                          onMouseLeave={() => setHoverRow(null)}
                        >
                          {/* Checkbox cell */}
                          <td
                            className="tx-td-cell tx-frozen-glass"
                            style={{ position:'sticky', left:0, zIndex:5, width:CB_W, minWidth:CB_W, background:isSel?frzBgSel:frzBg, backdropFilter:frzBlur, WebkitBackdropFilter:frzBlur, borderColor:frzBrd, textAlign:'center', padding:'0 0' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => toggleSelectId(transaction.id as number)}
                              className="inline-flex items-center justify-center p-1 rounded hover:bg-gray-200 dark:hover:bg-midnight-700 transition-colors"
                              title={isSel ? "Deselect" : "Select"}
                            >
                              {isSel ? (
                                <CheckSquare className="h-4 w-4 text-blue-600 dark:text-neon-cyan-glow" />
                              ) : (
                                <Square className="h-4 w-4 text-gray-400 dark:text-enterprise-muted" />
                              )}
                            </button>
                          </td>
                          {/* Actions cell */}
                          <td
                            className="tx-td-cell tx-frozen-glass"
                            style={{ position:'sticky', left:CB_W, zIndex:5, width:ACT_W, minWidth:ACT_W, background:isSel?frzBgSel:frzBg, backdropFilter:frzBlur, WebkitBackdropFilter:frzBlur, borderColor:frzBrd, padding:'0 6px' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                              <button
                                onClick={() => exportSingleRow(transaction)}
                                disabled={isExporting}
                                className="inline-flex items-center justify-center p-2 bg-green-50 hover:bg-green-100 text-green-600 rounded-lg transition-all duration-200 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Export Transaction"
                              >
                                <Download className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => openDetails(transaction.id as number, 'view')}
                                className="inline-flex items-center justify-center p-2 bg-blue-50 dark:bg-neon-cyan-glow/20 hover:bg-blue-100 dark:hover:bg-neon-cyan-glow/30 text-blue-600 dark:text-neon-cyan-glow rounded-lg transition-all duration-200 hover:scale-110"
                                title="View Details"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => openDetails(transaction.id as number, 'edit')}
                                className="inline-flex items-center justify-center p-2 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg transition-all duration-200 hover:scale-110"
                                title="Edit Transaction"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteTransaction(transaction.id as number)}
                                disabled={deleteLoading}
                                className="inline-flex items-center justify-center p-2 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg transition-all duration-200 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Move to Trash"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                          {/* Data cells */}
                          {orderedCols.map((col: ColumnDefinition) => {
                            const colKey = col.key as string;
                            const isFrz = pinnedCols.has(colKey);
                            const isLast = colKey === lastFrozenKey;
                            const cw = colWidths[colKey] ?? col.w;
                            const STATUS_OPTIONS = ['Valid', 'Pending', 'Void', 'Cancelled'] as const;
                            const tid = transaction.id as number;

                            if (colKey === 'status') {
                              const st = transaction.status || 'Unknown';
                              const sc = STATUS_CFG[st] || STATUS_CFG['Void'];
                              return (
                                <td
                                  key={colKey}
                                  className={`tx-td-cell${isFrz ? ' tx-frozen-glass' : ''}`}
                                  style={{
                                    width: cw,
                                    height: ROW_H,
                                    borderColor: isFrz ? frzBrd : 'var(--border)',
                                    position: isFrz ? 'sticky' : 'relative',
                                    zIndex: isFrz ? 5 : undefined,
                                    left: isFrz ? frozenLeft[colKey] : undefined,
                                    background: isFrz ? (isSel?frzBgSel:frzBg) : undefined,
                                    backdropFilter: isFrz ? frzBlur : undefined,
                                    WebkitBackdropFilter: isFrz ? frzBlur : undefined,
                                    boxShadow: isLast ? frzShd : undefined,
                                  }}
                                >
                                  <button
                                    data-status-popover="true"
                                    onClick={(e) => { e.stopPropagation(); setEditingStatus(editingStatus === tid ? null : tid); }}
                                    style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.dot}40`, borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display:'inline-flex', alignItems:'center', gap: 5 }}
                                  >
                                    <span style={{ width:6, height:6, borderRadius:'50%', background:sc.dot, display:'inline-block', flexShrink:0 }} />
                                    {st}
                                  </button>
                                  {editingStatus === tid && (
                                    <div
                                      data-status-popover="true"
                                      style={{ position:'absolute', top:'100%', left:0, zIndex:50, background:'white', border:'1px solid #E5E7EB', borderRadius:10, boxShadow:'0 6px 24px rgba(0,0,0,0.16)', width:160, padding:'8px 0', marginTop:4 }}
                                      className="dark:bg-midnight-800 dark:border-midnight-600"
                                    >
                                      <div style={{ fontSize:10, fontWeight:600, color:'#9CA3AF', padding:'4px 12px 8px', textTransform:'uppercase', letterSpacing:'0.06em' }}>Change Status</div>
                                      {STATUS_OPTIONS.map(opt => {
                                        const os = STATUS_CFG[opt] || STATUS_CFG['Void'];
                                        return (
                                          <button
                                            key={opt}
                                            data-status-popover="true"
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              if (opt !== st && onUpdate) await onUpdate(tid, { status: opt });
                                              setEditingStatus(null);
                                            }}
                                            style={{ display:'flex', alignItems:'center', gap:8, width:'100%', padding:'7px 12px', background: opt === st ? os.bg : 'transparent', border:'none', cursor:'pointer', fontSize:13, color: os.color, fontWeight: opt === st ? 600 : 400, textAlign:'left' }}
                                          >
                                            <span style={{ width:8, height:8, borderRadius:'50%', background:os.dot, display:'inline-block', flexShrink:0 }} />
                                            {opt}
                                            {opt === st && <span style={{ marginLeft:'auto', fontSize:11 }}>✓</span>}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </td>
                              );
                            }

                            return (
                              <td
                                key={colKey}
                                className={`tx-td-cell${isFrz ? ' tx-frozen-glass' : ''}`}
                                style={{
                                  width: cw,
                                  height: ROW_H,
                                  borderColor: isFrz ? frzBrd : 'var(--border)',
                                  textAlign: (col.align || 'left') as React.CSSProperties['textAlign'],
                                  position: isFrz ? 'sticky' : undefined,
                                  zIndex: isFrz ? 5 : undefined,
                                  left: isFrz ? frozenLeft[colKey] : undefined,
                                  background: isFrz ? (isSel?frzBgSel:frzBg) : undefined,
                                  backdropFilter: isFrz ? frzBlur : undefined,
                                  WebkitBackdropFilter: isFrz ? frzBlur : undefined,
                                  boxShadow: isLast ? frzShd : undefined,
                                }}
                              >
                                {renderCell(transaction, col)}
                              </td>
                            );
                          })}
                        </tr>
                        {/* Expandable row detail panel */}
                        {isExp && (
                          <tr className="tx-tr-expand">
                            <td
                              colSpan={orderedCols.length + 2}
                              style={{ padding:0, background:'rgba(59,130,246,0.04)', borderBottom:'2px solid rgba(59,130,246,0.26)' }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {/* Tab bar */}
                              <div style={{ display:'flex', gap:1, padding:'10px 16px 0 64px', borderBottom:'1px solid var(--border)' }}>
                                {allGroups.map(grp => (
                                  <button
                                    key={grp}
                                    onClick={(e) => { e.stopPropagation(); setExpandedTab(grp); }}
                                    style={{
                                      padding:'5px 12px',
                                      borderRadius:'7px 7px 0 0',
                                      fontSize:11,
                                      fontWeight:600,
                                      cursor:'pointer',
                                      border: expandedTab === grp ? `1px solid ${GRP_COLOR[grp]}55` : '1px solid transparent',
                                      borderBottom:'none',
                                      background: expandedTab === grp ? 'white' : 'transparent',
                                      color: expandedTab === grp ? GRP_COLOR[grp] : '#9CA3AF',
                                      marginBottom:-1,
                                      fontFamily:"'DM Sans',sans-serif",
                                    }}
                                  >{grp}</button>
                                ))}
                              </div>
                              {/* Tab content */}
                              <div style={{ padding:'16px 20px 18px 68px' }}>
                                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(210px,1fr))', gap:'14px 28px' }}>
                                  {TABLE_COLUMNS.filter(c => c.group === expandedTab).map(col => (
                                    <div key={col.key as string}>
                                      <div style={{ fontSize:9, fontWeight:700, color:GRP_COLOR[col.group]||'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:4 }}>{col.label}</div>
                                      <div>{renderCell(transaction, col)}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Enhancement 5: Row Hover Preview Panel */}
        {hoverRow && !editingStatus && (
          <div
            style={{
              position: 'fixed',
              right: 16,
              top: Math.max(80, hoverY - 120),
              width: 220,
              zIndex: 500,
              borderRadius: 12,
              padding: 16,
              animation: 'slideInHoverPanel 0.18s ease both',
              pointerEvents: 'none',
              boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
            }}
            className="bg-white dark:bg-midnight-800 border border-gray-200 dark:border-midnight-600"
          >
            <div style={{ fontFamily:"'DM Mono',monospace", fontSize:15, fontWeight:700, color:'#3B82F6', marginBottom:8 }}>
              #{hoverRow.id}
            </div>
            <div style={{ borderBottom:'1px solid #F3F4F6', marginBottom:8 }} className="dark:border-midnight-700" />
            {([
              { label:'Net Weight', value: formatWeight(hoverRow.net_weight), mono: true, color:'#16A34A' },
              { label:'Product',    value: String(hoverRow.product || '—') },
              { label:'Driver',     value: String(hoverRow.driver  || '—') },
              { label:'Plate',      value: String(hoverRow.plate   || '—'), mono: true },
              { label:'Inbound',    value: formatDateTime(hoverRow.inbound), mono: true },
            ] as { label:string; value:string; mono?:boolean; color?:string }[]).map(({ label, value, mono, color }) => (
              <div key={label} style={{ marginBottom: 7 }}>
                <div style={{ fontSize:9, fontWeight:600, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:2 }}>{label}</div>
                <div
                  style={{ fontSize:13, fontWeight: mono ? 700 : 500, fontFamily: mono ? "'DM Mono',monospace" : undefined, color: color || undefined }}
                  className="text-gray-800 dark:text-enterprise-silver"
                >{value}</div>
              </div>
            ))}
            {(() => {
              const st = hoverRow.status || 'Unknown';
              const scMap: Record<string,{bg:string;color:string;dot:string}> = {
                Valid:     {bg:'#DCFCE7',color:'#16A34A',dot:'#22C55E'},
                Cancelled: {bg:'#FEE2E2',color:'#DC2626',dot:'#EF4444'},
                Void:      {bg:'#F3F4F6',color:'#6B7280',dot:'#9CA3AF'},
                Pending:   {bg:'#FEF3C7',color:'#D97706',dot:'#F97316'},
              };
              const sc = scMap[st] || scMap['Void'];
              return (
                <div style={{ marginTop:4, display:'inline-flex', alignItems:'center', gap:5, background:sc.bg, color:sc.color, borderRadius:999, padding:'2px 10px', fontSize:11, fontWeight:600 }}>
                  <span style={{ width:6, height:6, borderRadius:'50%', background:sc.dot, display:'inline-block' }} />
                  {st}
                </div>
              );
            })()}
          </div>
        )}

        {/* Pagination Footer */}
        {total > 0 && (
          <div className="mt-6 bg-white/80 dark:bg-midnight-800/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 dark:border-midnight-700/20 p-6">
            <div className="flex flex-col lg:flex-row items-center justify-between space-y-4 lg:space-y-0">
              {/* Items per page selector */}
              <div className="flex items-center space-x-3">
                <span className="text-sm font-medium text-gray-700 dark:text-enterprise-silver">Show:</span>
                <select
                  value={pageSize}
                  onChange={(e) => onPageSizeChange(Number(e.target.value))}
                  className="px-4 py-2 border border-gray-200 dark:border-midnight-600 rounded-lg bg-white/90 dark:bg-midnight-700 backdrop-blur-sm text-sm focus:ring-2 focus:ring-neon-cyan-glow focus:border-transparent shadow-sm hover:shadow-md transition-all duration-200 dark:text-enterprise-silver"
                >
                  <option value={10}>10 rows</option>
                  <option value={20}>20 rows</option>
                  <option value={50}>50 rows</option>
                  <option value={100}>100 rows</option>
                </select>
                <span className="text-sm text-gray-600">per page</span>
              </div>

              {/* Page navigation */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePageChange(1)}
                  disabled={page === 1}
                  className="inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-600 dark:text-enterprise-silver bg-white/90 dark:bg-midnight-700/90 backdrop-blur-sm border border-gray-200 dark:border-midnight-600 rounded-lg shadow-sm hover:shadow-md hover:bg-white dark:hover:bg-midnight-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  aria-label="First page"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <ChevronLeft className="h-4 w-4 -ml-2" />
                </button>
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                  className="inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-600 dark:text-enterprise-silver bg-white/90 dark:bg-midnight-700/90 backdrop-blur-sm border border-gray-200 dark:border-midnight-600 rounded-lg shadow-sm hover:shadow-md hover:bg-white dark:hover:bg-midnight-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                {/* Page numbers */}
                {generatePageNumbers().map((pageNum, index) => (
                  <button
                    key={index}
                    onClick={() => typeof pageNum === 'number' && handlePageChange(pageNum)}
                    disabled={typeof pageNum !== 'number'}
                    className={`inline-flex items-center justify-center px-3 py-2 text-sm font-medium rounded-lg shadow-sm hover:shadow-md transition-all duration-200 ${
                      typeof pageNum !== 'number'
                        ? 'bg-gray-100 dark:bg-midnight-700 text-gray-400 dark:text-enterprise-muted cursor-not-allowed'
                        : pageNum === page
                        ? 'bg-blue-600 dark:bg-neon-cyan-glow text-white shadow-lg ring-2 ring-blue-500 dark:ring-neon-cyan-glow ring-offset-2 dark:ring-offset-midnight-950'
                        : 'bg-white/90 dark:bg-midnight-700/90 backdrop-blur-sm text-gray-600 dark:text-enterprise-silver border border-gray-200 dark:border-midnight-600 hover:bg-white dark:hover:bg-midnight-600 hover:shadow-md'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}

                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === totalPages}
                  className="inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-600 dark:text-enterprise-silver bg-white/90 dark:bg-midnight-700/90 backdrop-blur-sm border border-gray-200 dark:border-midnight-600 rounded-lg shadow-sm hover:shadow-md hover:bg-white dark:hover:bg-midnight-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handlePageChange(totalPages)}
                  disabled={page === totalPages}
                  className="inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-600 dark:text-enterprise-silver bg-white/90 dark:bg-midnight-700/90 backdrop-blur-sm border border-gray-200 dark:border-midnight-600 rounded-lg shadow-sm hover:shadow-md hover:bg-white dark:hover:bg-midnight-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  aria-label="Last page"
                >
                  <ChevronRight className="h-4 w-4" />
                  <ChevronRight className="h-4 w-4 -ml-2" />
                </button>
              </div>

              {/* Results count */}
              <div className="text-sm text-gray-600 dark:text-enterprise-muted text-center lg:text-right">
                Showing {startIndex} to {endIndex} of {total} results
              </div>
            </div>
          </div>
        )}

        {/* Transaction Modal */}
        {selectedTransaction && (
          <TransactionModal
            transaction={selectedTransaction}
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            mode={modalMode}
            onEdit={handleEditFromModal}
            onSave={handleSaveTransaction}
          />
        )}

        {detailsLoading && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40">
            <div className="bg-white px-6 py-4 rounded-lg shadow-lg text-gray-700 text-sm">
              Loading transaction details...
            </div>
          </div>
        )}

        {/* Export Options Modal */}
        {showExportModal && (
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <div 
              className="glass-card rounded-2xl shadow-2xl max-w-md w-full max-h-screen overflow-y-auto"
              style={{
                transform: `translate(${dragPosition.x}px, ${dragPosition.y}px)`,
                transition: isDragging ? 'none' : 'transform 0.2s ease-out'
              }}
            >
              <div className="p-6">
                <div 
                  className="flex items-center justify-between mb-6 cursor-move"
                  onMouseDown={handleMouseDown}
                >
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-enterprise-text">Export Options</h2>
                  <button
                    onClick={() => setShowExportModal(false)}
                    className="text-gray-400 dark:text-enterprise-muted hover:text-gray-600 dark:hover:text-enterprise-silver transition-colors cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Export Option 1: Current View */}
                  <div className="border border-gray-200 dark:border-midnight-600 rounded-lg p-4">
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="radio"
                        name="exportOption"
                        value="current"
                        checked={exportOption === 'current'}
                        onChange={(e) => setExportOption(e.target.value as 'current' | 'date' | 'custom')}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-enterprise-silver">Current View</div>
                        <div className="text-sm text-gray-500 dark:text-enterprise-muted">
                          Export {transactions.length} records currently displayed
                        </div>
                      </div>
                    </label>
                  </div>

                  {/* Export Option 2: Date Range */}
                  <div className="space-y-3">
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="radio"
                        value="date"
                        checked={exportOption === 'date'}
                        onChange={(e) => setExportOption(e.target.value as 'current' | 'date' | 'custom')}
                        className="w-4 h-4 text-emerald-600 border-gray-300 focus:ring-emerald-500"
                      />
                      <span className="text-gray-700 dark:text-enterprise-silver">Export by Date Range</span>
                    </label>
                    
                    {exportOption === 'date' && (
                      <div className="ml-7 space-y-3 p-4 bg-blue-50 dark:bg-neon-cyan-glow/20 border border-blue-200 dark:border-neon-cyan-glow/30 rounded-lg">
                        <div className="text-sm text-blue-800 dark:text-neon-cyan-glow font-medium mb-3">
                          Select date range to export all records within this period:
                        </div>
                        
                        {/* Date Range Inputs */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-enterprise-silver mb-2">
                              Start Date
                            </label>
                            <div className="relative">
                              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-enterprise-muted" />
                              <DatePicker
                                selected={startDate}
                                onChange={(date: Date | null) => onDateRangeChange?.(date, endDate || null)}
                                selectsStart
                                startDate={startDate}
                                endDate={endDate}
                                placeholderText="Select start date"
                                className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-midnight-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm bg-white dark:bg-midnight-700 dark:text-enterprise-silver"
                                isClearable
                                showMonthDropdown
                                showYearDropdown
                                scrollableYearDropdown
                                yearDropdownItemNumber={50}
                                dateFormat="MMM dd, yyyy"
                              />
                            </div>
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-enterprise-silver mb-2">
                              End Date
                            </label>
                            <div className="relative">
                              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-enterprise-muted" />
                              <DatePicker
                                selected={endDate}
                                onChange={(date: Date | null) => onDateRangeChange?.(startDate || null, date)}
                                selectsEnd
                                startDate={startDate}
                                endDate={endDate}
                                minDate={startDate || undefined}
                                placeholderText="Select end date"
                                className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-midnight-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm bg-white dark:bg-midnight-700 dark:text-enterprise-silver"
                                isClearable
                                showMonthDropdown
                                showYearDropdown
                                scrollableYearDropdown
                                yearDropdownItemNumber={50}
                                dateFormat="MMM dd, yyyy"
                              />
                            </div>
                          </div>
                        </div>
                        
                        {/* Quick Date Range Selection */}
                        <div className="mt-4">
                          <div className="text-sm font-medium text-gray-700 dark:text-enterprise-silver mb-2">Quick Selection:</div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => {
                                const today = new Date();
                                const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                                onDateRangeChange?.(firstDayOfMonth, today);
                              }}
                              className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
                            >
                              This Month
                            </button>
                            <button
                              onClick={() => {
                                const today = new Date();
                                const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                                const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
                                onDateRangeChange?.(lastMonth, lastMonthEnd);
                              }}
                              className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
                            >
                              Last Month
                            </button>
                            <button
                              onClick={() => {
                                const today = new Date();
                                const firstDayOfYear = new Date(today.getFullYear(), 0, 1);
                                onDateRangeChange?.(firstDayOfYear, today);
                              }}
                              className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
                            >
                              This Year
                            </button>
                            <button
                              onClick={() => {
                                const today = new Date();
                                const lastYear = new Date(today.getFullYear() - 1, 0, 1);
                                const lastYearEnd = new Date(today.getFullYear() - 1, 11, 31);
                                onDateRangeChange?.(lastYear, lastYearEnd);
                              }}
                              className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
                            >
                              Last Year
                            </button>
                            <button
                              onClick={() => {
                                const today = new Date();
                                const last30Days = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
                                onDateRangeChange?.(last30Days, today);
                              }}
                              className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
                            >
                              Last 30 Days
                            </button>
                            <button
                              onClick={() => {
                                const today = new Date();
                                const last90Days = new Date(today.getTime() - (90 * 24 * 60 * 60 * 1000));
                                onDateRangeChange?.(last90Days, today);
                              }}
                              className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
                            >
                              Last 90 Days
                            </button>
                            <button
                              onClick={() => {
                                const today = new Date();
                                const yesterday = new Date(today.getTime() - (24 * 60 * 60 * 1000));
                                onDateRangeChange?.(yesterday, today);
                              }}
                              className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
                            >
                              Yesterday
                            </button>
                            <button
                              onClick={() => {
                                const today = new Date();
                                const thisWeekStart = new Date(today.getTime() - (today.getDay() * 24 * 60 * 60 * 1000));
                                onDateRangeChange?.(thisWeekStart, today);
                              }}
                              className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
                            >
                              This Week
                            </button>
                          </div>
                        </div>
                        
                        {/* Date Range Status */}
                        <div className="mt-3 p-2 bg-white rounded border border-blue-200">
                          {startDate && endDate ? (
                            <div className="space-y-2">
                              <div className="text-sm text-green-700">
                                ✅ Exporting records from {formatDateFromString(startDateStr)} to {formatDateFromString(endDateStr)}
                              </div>
                              
                              {/* Automatic Preview Section */}
                              <div className="flex items-center justify-between">
                                <div className="text-sm text-gray-600">
                                  {isPreviewing ? (
                                    <span className="text-blue-600">
                                      <div className="flex items-center space-x-2">
                                        <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-600 border-t-transparent"></div>
                                        <span>Counting records...</span>
                                      </div>
                                    </span>
                                  ) : dateRangePreview !== null ? (
                                    <span className="font-medium text-blue-600">
                                      📊 {dateRangePreview.toLocaleString()} records found
                                    </span>
                                  ) : (
                                    <span className="text-gray-500">
                                      💡 Selecting date range...
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              {/* Preview Warning/Info */}
                              {dateRangePreview !== null && !isPreviewing && (
                                <div className="text-xs text-gray-500 mt-1">
                                  {dateRangePreview === 0 ? (
                                    <span className="text-amber-600">⚠️ No records found in this date range</span>
                                  ) : dateRangePreview > 5000 ? (
                                    <span className="text-blue-600">ℹ️ Large dataset - export may take some time</span>
                                  ) : (
                                    <span className="text-green-600">✓ Ready to export</span>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-sm text-amber-600">
                              ⚠️ Please select both start and end dates to enable export
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Export Option 3: Custom Export */}
                  <div className="border border-gray-200 dark:border-midnight-600 rounded-lg p-4">
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="radio"
                        name="exportOption"
                        value="custom"
                        checked={exportOption === 'custom'}
                        onChange={(e) => setExportOption(e.target.value as 'current' | 'date' | 'custom')}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-enterprise-silver">Custom Export</div>
                        <div className="text-sm text-gray-500 dark:text-enterprise-muted">
                          Export specific number of records
                        </div>
                      </div>
                    </label>
                    
                    {exportOption === 'custom' && (
                      <div className="mt-4 space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-enterprise-silver mb-1">
                            Number of records
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="10000"
                            value={customExportLimit}
                            onChange={(e) => setCustomExportLimit(Math.max(1, Math.min(10000, parseInt(e.target.value) || 100)))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-midnight-600 rounded-lg focus:ring-2 focus:ring-neon-cyan-glow focus:border-neon-cyan-glow text-sm bg-white dark:bg-midnight-700 dark:text-enterprise-silver"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-enterprise-silver mb-1">
                            Starting from record (offset)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={customExportOffset}
                            onChange={(e) => setCustomExportOffset(Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-midnight-600 rounded-lg focus:ring-2 focus:ring-neon-cyan-glow focus:border-neon-cyan-glow text-sm bg-white dark:bg-midnight-700 dark:text-enterprise-silver"
                          />
                        </div>
                        <div className="text-xs text-gray-500 dark:text-enterprise-muted">
                          Will export records {customExportOffset} to {customExportOffset + customExportLimit - 1}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200 dark:border-midnight-700">
                  <button
                    onClick={() => setShowExportModal(false)}
                    disabled={isExporting}
                    className="px-4 py-2 text-gray-700 dark:text-enterprise-silver bg-gray-100 dark:bg-midnight-700 hover:bg-gray-200 dark:hover:bg-midnight-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => exportToCSV(exportOption)}
                    disabled={isExporting || (exportOption === 'custom' && customExportLimit <= 0) || (exportOption === 'date' && (!startDate || !endDate))}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    {isExporting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        <span>Exporting...</span>
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" />
                        <span>
                          Export
                          {exportOption === 'date' && dateRangePreview !== null && (
                            <span className="ml-1 text-xs opacity-90">
                              ({dateRangePreview.toLocaleString()} records)
                            </span>
                          )}
                        </span>
                      </>
                    )}
                  </button>
                </div>

                {/* Export Progress Display */}
                {isExporting && (
                  <div className="mt-4 p-4 bg-blue-50 dark:bg-neon-cyan-glow/20 border border-blue-200 dark:border-neon-cyan-glow/30 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent"></div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-blue-900 dark:text-neon-cyan-glow">
                          {exportProgress}
                        </div>
                        {exportCountdown > 0 && (
                          <div className="text-xs text-blue-700 dark:text-neon-cyan-glow mt-1">
                            Estimated time remaining: {exportCountdown}s
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="mt-3 w-full bg-blue-100 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                        style={{ 
                          width: exportProgress.includes('%') 
                            ? exportProgress.match(/(\d+)%/)?.[1] + '%' || '0%'
                            : '0%' 
                        }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}

export default TransactionTable;
