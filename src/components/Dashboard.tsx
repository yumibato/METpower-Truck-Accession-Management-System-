import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import TransactionTable from './TransactionTable';
import Header from './Header';
import { Transaction } from '../types/Transaction';
import { transacApi } from '../services/transacApi';

export default function Dashboard() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('id');
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('DESC');
  const [refreshing, setRefreshing] = useState(false);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  
  // Prevent unnecessary re-fetches
  const isFirstLoad = useRef(true);
  const isMountedRef = useRef(true);

  const fetchTransactions = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    try {
      setLoading(true);
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
        setTransactions(result.rows);
        setTotal(result.total);
        setError('');
      }
    } catch (error: any) {
      console.error('Error fetching transactions:', error);
      if (isMountedRef.current) {
        setError(error.message || 'Failed to load transactions');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [page, pageSize, search, sortBy, sortDir, startDate, endDate]);

  const handleUpdateTransaction = async (id: number, transactionData: Partial<Transaction>) => {
    const updatedTransaction = await transacApi.update(id, transactionData);
    setTransactions(prev => prev.map(t => (t.id === id ? updatedTransaction : t)));
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

  if (loading && transactions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="w-full py-6 px-4 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Transactions Table */}
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
            onRefresh={handleManualRefresh}
            refreshing={refreshing}
            onDateRangeChange={handleDateRangeChange}
            startDate={startDate}
            endDate={endDate}
          />
        </div>
      </main>
    </div>
  );
}
