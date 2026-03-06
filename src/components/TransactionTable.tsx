import React, { useMemo, useState, useEffect } from 'react';
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
  AlertCircle
} from 'lucide-react';
import { transacApi, CalendarData, CalendarDay } from '../services/transacApi';
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
  sortable?: boolean;
  className?: string;
  render?: (row: Transaction) => React.ReactNode;
}

// Safe cell rendering function with highlighting
const renderCellContent = (transaction: Transaction, column: ColumnDefinition, searchTerm: string) => {
  try {
    if (column.render) {
      const rendered = column.render(transaction);
      // If there's a search term and the rendered content is text, apply highlighting
      if (searchTerm.trim() && typeof rendered === 'string') {
        return <HighlightText text={rendered} highlight={searchTerm} />;
      }
      return rendered;
    } else {
      const value = getTransactionValue(transaction, column.key);
      // Apply highlighting to plain text values
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
  if (value === null || value === undefined || value === '') return '-';
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) return String(value);
  return `${numericValue.toLocaleString()} kg`;
};

const formatDateTime = (dateString?: string | null) => {
  if (!dateString) return '-';
  try {
    return format(new Date(dateString), 'MMM dd, yyyy HH:mm');
  } catch {
    return dateString;
  }
};

const TABLE_COLUMNS: ColumnDefinition[] = [
  { key: 'id', label: 'ID', sortable: true, render: (row) => `#${row.id}` },
  { key: 'trans_no', label: 'Transaction No.', sortable: true },
  { key: 'barge_details', label: 'Barge Details', sortable: true },
  {
    key: 'plate',
    label: 'Plate',
    sortable: true,
    render: (row) =>
      row.plate ? (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          {row.plate}
        </span>
      ) : (
        '-'
      )
  },
  { key: 'initial_net_wt', label: 'Initial Net Wt.', sortable: true, render: (row) => formatWeight(row.initial_net_wt) },
  { key: 'inbound', label: 'Inbound Date/Time', sortable: true, render: (row) => formatDateTime(row.inbound) },
  { key: 'outbound', label: 'Outbound Date/Time', sortable: true, render: (row) => formatDateTime(row.outbound) },
  { key: 'driver', label: 'Driver', sortable: true },
  { key: 'type_veh', label: 'Vehicle Type', sortable: true },
  { key: 'product', label: 'Product', sortable: true },
  { key: 'ws_no', label: 'WS No.', sortable: true },
  { key: 'dr_no', label: 'DR No.', sortable: true },
  { key: 'del_comp', label: 'Company', sortable: true, className: 'min-w-[120px]' },
  { key: 'del_address', label: 'Delivery Address', sortable: true, className: 'min-w-[150px]' },
  { key: 'gross_weight', label: 'Gross Weight', sortable: true, render: (row) => formatWeight(row.gross_weight) },
  { key: 'tare_weight', label: 'Tare Weight', sortable: true, render: (row) => formatWeight(row.tare_weight) },
  { key: 'net_weight', label: 'Net Weight', sortable: true, render: (row) => formatWeight(row.net_weight) },
  { key: 'inbound_wt', label: 'Inbound Weight', sortable: true, render: (row) => formatWeight(row.inbound_wt) },
  { key: 'outbound_wt', label: 'Outbound Weight', sortable: true, render: (row) => formatWeight(row.outbound_wt) },
  { key: 'remarks', label: 'Remarks', sortable: true, className: 'min-w-[200px]' },
  { key: 'transac_date', label: 'Transaction Date', sortable: true, render: (row) => formatDateTime(row.transac_date) },
  { key: 'date', label: 'Date', sortable: true, render: (row) => formatDateTime(row.date) },
  {
    key: 'status',
    label: 'Status',
    sortable: true,
    render: (row) => (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          row.status === 'Valid'
            ? 'bg-green-100 text-green-800'
            : row.status === 'Pending'
            ? 'bg-yellow-100 text-yellow-800'
            : row.status === 'Void'
            ? 'bg-gray-100 text-gray-800'
            : 'bg-red-100 text-red-800'
        }`}
      >
        {row.status || 'Unknown'}
      </span>
    )
  },
  { key: 'vessel_id', label: 'Vessel ID', sortable: true },
  { key: 'weigher', label: 'Weigher', sortable: true },
  { key: 'no_of_bags', label: 'No. of Bags', sortable: true }
];

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
  endDate
}) => {
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

  // Server-driven search - no client-side filtering needed

  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [modalMode, setModalMode] = useState<'view' | 'edit'>('view');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
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

  const headerCells = useMemo(
    () =>
      MEMOIZED_TABLE_COLUMNS.map((column: ColumnDefinition) => {
        if (!column.sortable) {
          return (
            <span key={column.key as string} className="text-left w-full">
              {column.label}
            </span>
          );
        }
        const isActive = sortBy === (column.key as string);
        const directionSymbol = sortDir === 'ASC' ? '↑' : '↓';
        return (
          <button
            key={column.key as string}
            onClick={() => onSortChange(column.key as string)}
            className={`flex items-center space-x-1 text-left w-full hover:text-blue-600 transition-colors ${
              isActive ? 'text-blue-600' : ''
            }`}
          >
            <span>{column.label}</span>
            <ArrowUpDown className="h-3 w-3" />
            {isActive && <span className="text-xs">{directionSymbol}</span>}
          </button>
        );
      }),
    [onSortChange, sortBy, sortDir, MEMOIZED_TABLE_COLUMNS]
  );

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
                    className="flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-neon-cyan-glow dark:hover:bg-neon-cyan-bright text-white font-medium rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Refresh data"
                  >
                    <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline ml-2">{refreshing ? 'Refreshing...' : 'Refresh'}</span>
                  </button>
                  <button
                    onClick={() => selectedIds.size > 0 ? handleBulkExport() : setShowExportModal(true)}
                    disabled={transactions.length === 0 || isExporting || bulkLoading}
                    className="flex items-center justify-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={selectedIds.size > 0 ? `Export ${selectedIds.size} selected` : "Export options"}
                  >
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline ml-2">
                      {isExporting || bulkLoading ? 'Exporting...' : selectedIds.size > 0 ? `Export (${selectedIds.size})` : 'Export'}
                    </span>
                  </button>
                </div>
              </div>
              
              {/* Controls Row */}
              <div className="flex flex-col md:flex-row gap-4">
                {/* Search Input */}
                <div className="flex-1 md:max-w-lg">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder={loading ? "Searching..." : `Search transactions...${localSearchTerm ? ` (searching for "${localSearchTerm}")` : ''}`}
                      value={localSearchTerm}
                      onChange={(e) => {
                        console.log('🔍 Search input changed:', e.target.value);
                        setLocalSearchTerm(e.target.value);
                      }}
                      disabled={loading}
                      className={`w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-neon-cyan-glow focus:border-neon-cyan-glow text-sm transition-colors duration-200 ${
                        loading ? 'bg-gray-100 cursor-not-allowed' : localSearchTerm ? 'bg-yellow-50 border-yellow-300' : 'bg-white'
                      }`}
                    />
                    {localSearchTerm && (
                      <button
                        onClick={() => {
                          console.log('🔍 Clearing search');
                          setLocalSearchTerm('');
                          onSearchChange('');
                        }}
                        disabled={loading}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors duration-200"
                        title="Clear search"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Search Results Indicator */}
                {localSearchTerm.trim() && (
                  <div className="flex-1 md:max-w-xs">
                    <div className="bg-blue-50 dark:bg-neon-cyan-glow/20 border border-blue-200 dark:border-neon-cyan-glow/30 rounded-lg px-3 py-2 text-sm">
                      <span className="font-medium text-blue-700 dark:text-neon-cyan-glow">
                        Found {displayData.length} result{displayData.length !== 1 ? 's' : ''} for 
                        <mark className="bg-yellow-200 dark:bg-yellow-900/40 text-yellow-900 dark:text-yellow-200 px-1 rounded mx-1">
                          "{localSearchTerm}"
                        </mark>
                      </span>
                    </div>
                  </div>
                )}
                
                {/* Date Range Picker */}
                <div className="flex-shrink-0">
                  <button
                    onClick={() => setShowDatePicker(!showDatePicker)}
                    disabled={loading}
                    className="flex items-center justify-center px-4 py-2.5 bg-white dark:bg-midnight-700 border border-gray-300 dark:border-midnight-600 rounded-lg hover:bg-gray-50 dark:hover:bg-midnight-600 text-gray-700 dark:text-enterprise-silver text-sm font-medium transition-colors duration-200"
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    <span className="whitespace-nowrap">
                      {startDateStr && endDateStr
                        ? `${formatDateFromString(startDateStr)} - ${formatDateFromString(endDateStr)}`
                        : startDateStr
                        ? formatDateFromString(startDateStr)
                        : 'Select date range'}
                    </span>
                  </button>
                </div>
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
                    className="px-6 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setShowDatePicker(false);
                    }}
                    className="px-6 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
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
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-neon-cyan-glow dark:hover:bg-neon-cyan-bright text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  title="Update status for selected transactions"
                >
                  <ArrowUpDown className="h-4 w-4" />
                  Status
                </button>

                <button
                  onClick={handleBulkDelete}
                  disabled={bulkLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
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
                  className="flex-1 px-4 py-2 bg-gray-200 dark:bg-midnight-700 hover:bg-gray-300 dark:hover:bg-midnight-600 text-gray-800 dark:text-enterprise-silver rounded-lg font-medium transition-colors"
                  disabled={bulkLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkStatusUpdate}
                  disabled={bulkLoading}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-neon-cyan-glow dark:hover:bg-neon-cyan-bright text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
            <div className="p-12 text-center">
              <div className="text-gray-400 dark:text-enterprise-muted mb-6">
                <Search className="h-12 w-12 mx-auto" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-enterprise-silver mb-3">
                {localSearchTerm ? 'No matching transactions found' : 'No transactions found'}
              </h3>
              <p className="text-gray-600 dark:text-enterprise-muted">
                {localSearchTerm ? 'Try adjusting your search terms or filters.' : 'Start by creating a new truck accession ticket.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto overflow-y-visible">
              <table className="min-w-[2000px] w-full">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-midnight-800 dark:to-midnight-800 border-b border-gray-200 dark:border-midnight-700">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-enterprise-muted uppercase tracking-wider w-12">
                      <button
                        onClick={toggleSelectAll}
                        className="inline-flex items-center justify-center p-1 rounded hover:bg-gray-200 dark:hover:bg-midnight-700 transition-colors"
                        title={selectedIds.size === transactions.length ? "Deselect all" : "Select all"}
                      >
                        {selectedIds.size === transactions.length && transactions.length > 0 ? (
                          <CheckSquare className="h-4 w-4 text-blue-600 dark:text-neon-cyan-glow" />
                        ) : (
                          <Square className="h-4 w-4 text-gray-400 dark:text-enterprise-muted" />
                        )}
                      </button>
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-enterprise-muted uppercase tracking-wider">
                      Actions
                    </th>
                    {MEMOIZED_TABLE_COLUMNS.map((column: ColumnDefinition, index: number) => (
                      <th
                        key={column.key as string}
                        className={`px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-enterprise-muted uppercase tracking-wider ${
                          column.className || ''
                        }`}
                      >
                        {headerCells[index]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-midnight-700">
                  {displayData.map((transaction: Transaction, index: number) => (
                    <tr 
                      key={transaction.id} 
                      className={`hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 dark:hover:from-midnight-800/50 dark:hover:to-midnight-800/50 transition-all duration-200 ${
                        index % 2 === 0 ? 'bg-white dark:bg-midnight-800' : 'bg-gray-50/50 dark:bg-midnight-800'
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-left text-sm font-medium">
                        <button
                          onClick={() => toggleSelectId(transaction.id as number)}
                          className="inline-flex items-center justify-center p-1 rounded hover:bg-gray-200 dark:hover:bg-midnight-700 transition-colors"
                          title={selectedIds.has(transaction.id as number) ? "Deselect" : "Select"}
                        >
                          {selectedIds.has(transaction.id as number) ? (
                            <CheckSquare className="h-4 w-4 text-blue-600 dark:text-neon-cyan-glow" />
                          ) : (
                            <Square className="h-4 w-4 text-gray-400 dark:text-enterprise-muted" />
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-left text-sm font-medium">
                        <div className="flex items-center justify-start space-x-2">
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
                      {MEMOIZED_TABLE_COLUMNS.map((column: ColumnDefinition) => (
                        <td
                          key={column.key as string}
                          className={`px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-enterprise-silver ${
                            column.className || ''
                          }`}
                        >
                          {renderCellContent(transaction, column, localSearchTerm)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

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
  );
}

export default TransactionTable;
