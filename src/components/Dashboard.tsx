import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import TransactionTable from './TransactionTable';
import AuditLog from './AuditLog';
import Header from './Header';
import { Transaction } from '../types/Transaction';
import { transacApi } from '../services/transacApi';
import { usePersistentState } from '../hooks/usePersistentState';

export default function Dashboard() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // ✅ PERSISTENT STATE - Filters survive page refresh
  const [page, setPage] = usePersistentState('dashboard-page', 1);
  const [pageSize, setPageSize] = usePersistentState('dashboard-pageSize', 10);
  const [search, setSearch] = usePersistentState('dashboard-search', '');
  const [sortBy, setSortBy] = usePersistentState('dashboard-sortBy', 'id');
  const [sortDir, setSortDir] = usePersistentState<'ASC' | 'DESC'>('dashboard-sortDir', 'DESC');
  const [activeTab, setActiveTab] = usePersistentState<'transactions' | 'auditlog'>('dashboard-activeTab', 'transactions');
  
  // Regular state (no persistence needed)
  const [total, setTotal] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  
  // Prevent unnecessary re-fetches
  const isFirstLoad = useRef(true);
  const isMountedRef = useRef(true);

  const fetchTransactions = useCallback(async (silent = false) => {
    if (!isMountedRef.current) return;
    
    try {
      if (!silent) {
        setLoading(true);
      }
      const result = await transacApi.list({
        page,
        pageSize,
        search,
        sortBy,
        sortDir,
        dateFrom: startDate ? startDate.toISOString().slice(0, 10) : undefined,
        dateTo: endDate ? endDate.toISOString().slice(0, 10) : undefined
      });
      
      if (isMountedRef.current) {
        // Only update if data actually changed to prevent unnecessary re-renders
        const hasDataChanged = JSON.stringify(result.rows) !== JSON.stringify(transactions);
        if (hasDataChanged || total !== result.total) {
          setTransactions(result.rows);
          setTotal(result.total);
        }
        setError('');
      }
    } catch (error: any) {
      console.error('Error fetching transactions:', error);
      if (isMountedRef.current) {
        setError(error.message || 'Failed to load transactions');
      }
    } finally {
      if (isMountedRef.current && !silent) {
        setLoading(false);
      }
    }
  }, [page, pageSize, search, sortBy, sortDir, startDate, endDate, transactions, total]);

  const handleUpdateTransaction = async (id: number, transactionData: Partial<Transaction>) => {
    try {
      const updatedTransaction = await transacApi.update(id, transactionData);
      // Optimistic update - immediately update the local state
      setTransactions(prev => prev.map(t => (t.id === id ? updatedTransaction : t)));
      // Then do a silent background refresh after a short delay
      setTimeout(() => fetchTransactions(true), 1000);
      return updatedTransaction;
    } catch (error) {
      // If update fails, refresh to get correct state
      await fetchTransactions();
      throw error;
    }
    return updatedTransaction;
  };

  
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleSortChange = (key: string) => {
    setSortBy(prevSortBy => {
      if (prevSortBy === key) {
        setSortDir(prevDir => (prevDir === 'ASC' ? 'DESC' : 'ASC'));
        return prevSortBy;
      }
      setSortDir('DESC');
      return key;
    });
    setPage(1);
  };

  const handlePageChange = (nextPage: number) => {
    setPage(Math.max(1, nextPage));
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  const handleDateRangeChange = (start: Date | null, end: Date | null) => {
    setStartDate(start);
    setEndDate(end);
    setPage(1);
  };

  
  const fetchTransactionById = async (id: number) => {
    const transaction = await transacApi.get(id);
    return transaction;
  };

  useEffect(() => {
    isMountedRef.current = true;
    
    // Only fetch if this is first load or filters have changed
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      fetchTransactions();
    } else {
      // Reset to page 1 when filters change
      setPage(1);
      fetchTransactions();
    }

    // Cleanup on unmount
    return () => {
      isMountedRef.current = false;
    };
  }, [page, pageSize, search, sortBy, sortDir, startDate, endDate, fetchTransactions]);

  // Auto-refresh effect - balanced for real-time updates without flickering
  useEffect(() => {
    if (activeTab !== 'transactions') return;

    const interval = setInterval(() => {
      if (isMountedRef.current) {
        // Silent refresh - don't show loading spinner for auto-refresh
        fetchTransactions(true);
      }
    }, 10000); // 10 seconds - less aggressive to reduce flickering

    return () => clearInterval(interval);
  }, [activeTab, fetchTransactions]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    setError('');
    try {
      await transacApi.triggerRefresh();
    } catch (error: any) {
      console.error('Manual refresh failed:', error);
      setError(error?.message || 'Failed to trigger refresh');
    } finally {
      await fetchTransactions();
      setRefreshing(false);
    }
  };

  // Add immediate refresh after any transaction operations
  const handleTransactionOperation = async (operation: () => Promise<any>) => {
    try {
      await operation();
      // Immediate refresh after any database operation
      await fetchTransactions();
    } catch (error) {
      throw error; // Re-throw to let the component handle the error
    }
  };

  if (loading && transactions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-midnight-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neon-cyan-glow mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-enterprise-muted">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-midnight-950">
      <Header />
      
      <main className="w-full py-6 px-4 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-lg p-4">
            <p className="text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200 dark:border-midnight-700">
            <div className="flex justify-between items-center">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setActiveTab('transactions')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'transactions'
                      ? 'border-neon-cyan-glow text-blue-600 dark:text-neon-cyan-glow'
                      : 'border-transparent text-gray-500 dark:text-enterprise-muted hover:text-gray-700 dark:hover:text-enterprise-silver hover:border-gray-300 dark:hover:border-midnight-600'
                  }`}
                >
                  Transactions
                </button>
                <button
                  onClick={() => setActiveTab('auditlog')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'auditlog'
                      ? 'border-neon-cyan-glow text-blue-600 dark:text-neon-cyan-glow'
                      : 'border-transparent text-gray-500 dark:text-enterprise-muted hover:text-gray-700 dark:hover:text-enterprise-silver hover:border-gray-300 dark:hover:border-midnight-600'
                  }`}
                >
                  Activity Log
                </button>
              </nav>
              
              {/* Live indicator for transactions */}
              {activeTab === 'transactions' && (
                <div className="flex items-center space-x-2 text-sm text-green-600 dark:text-green-400 py-2">
                  <div className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full animate-pulse"></div>
                  <span>Auto-Sync</span>
                  {loading && (
                    <div className="w-3 h-3 border border-green-500 dark:border-green-400 border-t-transparent rounded-full animate-spin ml-1"></div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'transactions' && (
          <div>
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
              onRefresh={() => handleTransactionOperation(() => Promise.resolve())}
              refreshing={refreshing}
              onDateRangeChange={handleDateRangeChange}
              startDate={startDate}
              endDate={endDate}
            />
          </div>
        )}

        {activeTab === 'auditlog' && (
          <div>
            <AuditLog />
          </div>
        )}
      </main>
    </div>
  );
}
