import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import TransactionTable from '../TransactionTable';
import Header from '../Header';
import { Transaction } from '../../types/Transaction';
import { transacApi } from '../../services/transacApi';
import { usePersistentState } from '../../hooks/usePersistentState';

export default function TransactionsPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const transIdParam = searchParams.get('trans_id');
  const highlightTransId = transIdParam ? parseInt(transIdParam, 10) : null;
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [page, setPage] = usePersistentState('transpage-page', 1);
  const [pageSize, setPageSize] = usePersistentState('transpage-pageSize', 10);
  const [search, setSearch] = usePersistentState('transpage-search', '');
  const [sortBy, setSortBy] = usePersistentState('transpage-sortBy', 'id');
  const [sortDir, setSortDir] = usePersistentState<'ASC' | 'DESC'>('transpage-sortDir', 'DESC');

  const [total, setTotal] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  const isMountedRef = useRef(true);

  const fetchTransactions = useCallback(async (silent = false) => {
    if (!isMountedRef.current) return;
    try {
      if (!silent) setLoading(true);
      const result = await transacApi.list({
        page,
        pageSize,
        search,
        sortBy,
        sortDir,
        dateFrom: startDate ? startDate.toISOString().slice(0, 10) : undefined,
        dateTo: endDate ? endDate.toISOString().slice(0, 10) : undefined,
      });
      if (isMountedRef.current) {
        setTransactions(result.rows);
        setTotal(result.total);
        setError('');
      }
    } catch (err: any) {
      if (isMountedRef.current) setError(err.message || 'Failed to load transactions');
    } finally {
      if (isMountedRef.current && !silent) setLoading(false);
    }
  }, [page, pageSize, search, sortBy, sortDir, startDate, endDate]);

  const handleUpdateTransaction = async (id: number, data: Partial<Transaction>) => {
    const updated = await transacApi.update(id, data);
    setTransactions(prev => prev.map(t => (t.id === id ? updated : t)));
    setTimeout(() => fetchTransactions(true), 1000);
    return updated;
  };

  const handleSearchChange = (value: string) => { setSearch(value); setPage(1); };
  const handleSortChange = (key: string) => {
    setSortBy(prev => {
      if (prev === key) { setSortDir(d => d === 'ASC' ? 'DESC' : 'ASC'); return prev; }
      setSortDir('DESC');
      return key;
    });
    setPage(1);
  };
  const handlePageChange = (p: number) => setPage(Math.max(1, p));
  const handlePageSizeChange = (s: number) => { setPageSize(s); setPage(1); };
  const handleDateRangeChange = (s: Date | null, e: Date | null) => { setStartDate(s); setEndDate(e); setPage(1); };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    setError('');
    try { await transacApi.triggerRefresh(); } catch (err: any) { setError(err?.message || 'Refresh failed'); }
    await fetchTransactions();
    setRefreshing(false);
  };

  const fetchTransactionById = async (id: number) => transacApi.get(id);

  useEffect(() => {
    isMountedRef.current = true;
    fetchTransactions();
    return () => { isMountedRef.current = false; };
  }, [fetchTransactions]);

  // When a highlight ID arrives from a notification link, jump to page 1 sorted by newest first
  useEffect(() => {
    if (highlightTransId) {
      setSortBy('id');
      setSortDir('DESC');
      setPage(1);
    }
  }, [highlightTransId]);

  // Auto-refresh every 10s as fallback
  useEffect(() => {
    const iv = setInterval(() => { if (isMountedRef.current) fetchTransactions(true); }, 10000);
    return () => clearInterval(iv);
  }, [fetchTransactions]);

  // Immediate refresh on any live DB change from socket
  useEffect(() => {
    const onDataChanged = () => { if (isMountedRef.current) fetchTransactions(true); };
    window.addEventListener('data-changed', onDataChanged);
    return () => window.removeEventListener('data-changed', onDataChanged);
  }, [fetchTransactions]);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="w-full py-6 px-4 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-lg p-4">
            <p className="text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}
        <TransactionTable
          transactions={transactions}
          onUpdate={handleUpdateTransaction}
          loading={loading}
          page={page}
          pageSize={pageSize}
          total={total}
          searchTerm={search}
          sortBy={sortBy}
          sortDir={sortDir}
          onSearchChange={handleSearchChange}
          onSortChange={handleSortChange}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          fetchTransaction={fetchTransactionById}
          onRefresh={handleManualRefresh}
          refreshing={refreshing}
          onDateRangeChange={handleDateRangeChange}
          startDate={startDate}
          endDate={endDate}
          highlightTransId={highlightTransId}
        />
      </main>
    </div>
  );
}
