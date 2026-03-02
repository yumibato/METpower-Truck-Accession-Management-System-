import React, { useState, useEffect } from 'react';
import { Trash2, RotateCcw, Trash, ChevronLeft, ChevronRight, Search, AlertCircle } from 'lucide-react';
import Header from './Header';

interface Transaction {
  id: number;
  trans_no: string;
  driver: string;
  product: string;
  plate: string;
  deleted_at: string;
  transac_date: string;
  barge_details?: string;
  [key: string]: any;
}

export default function TrashBin() {
  const [trash, setTrash] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [sortBy, setSortBy] = useState('deleted_at');
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('DESC');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [permanentLoading, setPermanentLoading] = useState(false);

  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '') || 'http://localhost:3001';

  // Fetch trash data
  useEffect(() => {
    loadTrash();
  }, [page, sortBy, sortDir]);

  const loadTrash = async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sortBy,
        sortDir
      });

      const response = await fetch(`${apiBaseUrl}/api/trash?${query}`);
      if (!response.ok) throw new Error('Failed to fetch trash');

      const data = await response.json();
      setTrash(data.rows || []);
      setTotal(data.total || 0);
      setSelectedIds(new Set()); // Clear selection on new page
    } catch (err: any) {
      setError(err.message || 'Failed to load trash');
      setTrash([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (id: number) => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/transac/${id}/restore`, {
        method: 'POST'
      });

      if (!response.ok) throw new Error('Failed to restore');

      setTrash(trash.filter(t => t.id !== id));
      setSelectedIds(new Set(Array.from(selectedIds).filter(sid => sid !== id)));
    } catch (err: any) {
      setError(err.message || 'Failed to restore item');
    }
  };

  const handlePermanentDelete = async (id: number) => {
    if (!confirm('Permanently delete this item? This cannot be undone.')) return;

    try {
      setPermanentLoading(true);
      const response = await fetch(`${apiBaseUrl}/api/trash/cleanup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daysOld: 0 })
      });

      if (!response.ok) throw new Error('Failed to delete');

      // For now, just reload to show updated state
      loadTrash();
    } catch (err: any) {
      setError(err.message || 'Failed to permanently delete');
    } finally {
      setPermanentLoading(false);
    }
  };

  const handleRestoreAll = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Restore ${selectedIds.size} item(s)?`)) return;

    try {
      setPermanentLoading(true);
      const restorePromises = Array.from(selectedIds).map(id =>
        fetch(`${apiBaseUrl}/api/transac/${id}/restore`, { method: 'POST' })
      );

      await Promise.all(restorePromises);
      loadTrash();
    } catch (err: any) {
      setError(err.message || 'Failed to restore items');
    } finally {
      setPermanentLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.size === trash.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(trash.map(t => t.id)));
    }
  };

  const handleSelectOne = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSort = (column: string) => {
    if (sortBy === column) {
      setSortDir(sortDir === 'DESC' ? 'ASC' : 'DESC');
    } else {
      setSortBy(column);
      setSortDir('DESC');
    }
    setPage(1);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    return date.toLocaleDateString();
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <Header />
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <Trash2 className="h-8 w-8 text-red-500 dark:text-red-400" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Trash</h1>
            </div>
            <span className="text-sm text-gray-600 dark:text-slate-400">{total} items</span>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Search trash..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
            />
          </div>
        </div>

        {/* Toolbar */}
        {selectedIds.size > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border-t border-gray-200 dark:border-slate-700 px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
                {selectedIds.size} selected
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleRestoreAll}
                  disabled={permanentLoading}
                  className="inline-flex items-center space-x-2 px-3 py-2 rounded-lg bg-blue-600 dark:bg-blue-700 text-white hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Restore</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 mt-3">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600 dark:text-slate-400">Loading trash...</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && trash.length === 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <Trash2 className="mx-auto h-12 w-12 text-gray-400 dark:text-slate-500" />
            <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-slate-100">Your trash is empty</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
              Deleted items will appear here. Items deleted more than 30 days ago are permanently removed.
            </p>
          </div>
        </div>
      )}

      {/* Trash Table */}
      {!loading && trash.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-slate-750 border-b border-gray-200 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === trash.length && trash.length > 0}
                      onChange={handleSelectAll}
                      className="h-4 w-4 rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 cursor-pointer dark:bg-slate-700"
                    />
                  </th>
                  <th
                    onClick={() => handleSort('trans_no')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Transaction</span>
                      {sortBy === 'trans_no' && (
                        <span className="text-blue-600">{sortDir === 'DESC' ? '↓' : '↑'}</span>
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Driver
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Plate
                  </th>
                  <th
                    onClick={() => toggleSort('deleted_at')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Deleted</span>
                      {sortBy === 'deleted_at' && (
                        <span className="text-blue-600">{sortDir === 'DESC' ? '↓' : '↑'}</span>
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 dark:text-slate-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                {trash.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-slate-750 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => handleSelectOne(item.id)}
                        className="h-4 w-4 rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 cursor-pointer dark:bg-slate-700"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900 dark:text-slate-200">{item.trans_no || '-'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600 dark:text-slate-400">{item.driver || '-'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600 dark:text-slate-400">{item.product || '-'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600 dark:text-slate-400">{item.plate || '-'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-500 dark:text-slate-400">{formatDate(item.deleted_at)}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleRestore(item.id)}
                          title="Restore"
                          className="inline-flex items-center px-2 py-1 rounded text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handlePermanentDelete(item.id)}
                          title="Permanently delete"
                          className="inline-flex items-center px-2 py-1 rounded text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <Trash className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-slate-400">
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} items
            </p>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="inline-flex items-center px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                  const pageNum = Math.max(1, page - 2) + i;
                  if (pageNum > totalPages) return null;

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        pageNum === page
                          ? 'bg-blue-600 dark:bg-blue-700 text-white'
                          : 'border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-600'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="inline-flex items-center px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
