import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Trash2, RotateCcw, Trash, ChevronLeft, ChevronRight, Search, AlertCircle, Calendar, Weight } from 'lucide-react';
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
  const isMountedRef = useRef(true);

  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '') || 'http://localhost:3001';

  const loadTrash = useCallback(async (silent = false) => {
    if (!isMountedRef.current) return;
    if (!silent) setLoading(true);
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
      if (!isMountedRef.current) return;
      setTrash(data.rows || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      if (isMountedRef.current) setError(err.message || 'Failed to load trash');
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [page, pageSize, sortBy, sortDir, apiBaseUrl]);

  // Initial load + fallback poll every 20s
  useEffect(() => {
    isMountedRef.current = true;
    loadTrash();
    const iv = setInterval(() => loadTrash(true), 20000);
    return () => { isMountedRef.current = false; clearInterval(iv); };
  }, [loadTrash]);

  // Immediate refresh on any live DB change from socket
  useEffect(() => {
    const onDataChanged = () => loadTrash(true);
    window.addEventListener('data-changed', onDataChanged);
    return () => window.removeEventListener('data-changed', onDataChanged);
  }, [loadTrash]);

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

  const formatExactDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' · ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const formatTxDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatWeight = (w: any) => {
    if (w === null || w === undefined || w === '') return '-';
    const num = Number(w);
    if (isNaN(num)) return String(w);
    return num.toLocaleString() + ' kg';
  };

  const getStatusBadge = (status: any) => {
    if (!status) return <span className="text-gray-400 dark:text-enterprise-muted text-xs">-</span>;
    const s = String(status).toLowerCase();
    const colors = s === 'valid' || s.includes('complet') || s.includes('approv') || s.includes('done')
      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      : s.includes('pending') || s.includes('process')
      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
      : s.includes('reject') || s.includes('cancel')
      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
      : s === 'void'
      ? 'bg-slate-100 text-slate-600 dark:bg-slate-800/40 dark:text-slate-400'
      : 'bg-gray-100 text-gray-700 dark:bg-midnight-700 dark:text-enterprise-muted';
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors}`}>
        {status}
      </span>
    );
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="min-h-screen">
      <Header />
      {/* Header */}
      <div className="glass-nav border-b border-black/5 dark:border-white/8 sticky top-16 z-10">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <Trash2 className="h-8 w-8 text-red-500 dark:text-status-error" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-enterprise-text">Trash</h1>
            </div>
            <span className="text-sm text-gray-600 dark:text-enterprise-muted">{total} items</span>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400 dark:text-enterprise-muted" />
            <input
              type="text"
              placeholder="Search trash..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-midnight-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-midnight-700 dark:text-enterprise-silver dark:placeholder-enterprise-muted"
            />
          </div>
        </div>

        {/* Toolbar */}
        {selectedIds.size > 0 && (
          <div className="bg-blue-50 dark:bg-neon-cyan-glow/20 border-t border-gray-200 dark:border-midnight-700 px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-enterprise-silver">
                {selectedIds.size} selected
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleRestoreAll}
                  disabled={permanentLoading}
                  className="inline-flex items-center space-x-2 px-3 py-2 rounded-lg bg-blue-600 dark:bg-neon-cyan-glow text-white hover:bg-blue-700 dark:hover:bg-neon-cyan-bright disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
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
        <div className="w-full px-4 sm:px-6 lg:px-8 py-3 mt-3">
          <div className="bg-red-50 dark:bg-status-error/20 border border-red-200 dark:border-status-error/30 rounded-lg p-4 flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-red-500 dark:text-status-error flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-status-error">{error}</p>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600 dark:text-enterprise-muted">Loading trash...</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && trash.length === 0 && (
        <div className="w-full px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <Trash2 className="mx-auto h-12 w-12 text-gray-400 dark:text-enterprise-muted" />
            <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-enterprise-text">Your trash is empty</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-enterprise-muted">
              Deleted items will appear here. Items deleted more than 30 days ago are permanently removed.
            </p>
          </div>
        </div>
      )}

      {/* Trash Table */}
      {!loading && trash.length > 0 && (
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
          <div className="glass-card rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead className="bg-gray-50 dark:bg-midnight-750 border-b border-gray-200 dark:border-midnight-700">
                <tr>
                  <th className="px-4 py-3 text-left w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === trash.length && trash.length > 0}
                      onChange={handleSelectAll}
                      className="h-4 w-4 rounded border-gray-300 dark:border-midnight-600 text-blue-600 focus:ring-blue-500 cursor-pointer dark:bg-midnight-700"
                    />
                  </th>
                  <th
                    onClick={() => toggleSort('trans_no')}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-enterprise-silver uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-midnight-700"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Transaction</span>
                      {sortBy === 'trans_no' && (
                        <span className="text-blue-600 dark:text-neon-cyan-glow">{sortDir === 'DESC' ? '↓' : '↑'}</span>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => toggleSort('transac_date')}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-enterprise-silver uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-midnight-700"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Tx Date</span>
                      {sortBy === 'transac_date' && (
                        <span className="text-blue-600 dark:text-neon-cyan-glow">{sortDir === 'DESC' ? '↓' : '↑'}</span>
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-enterprise-silver uppercase tracking-wider">
                    Driver
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-enterprise-silver uppercase tracking-wider">
                    Plate / Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-enterprise-silver uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-enterprise-silver uppercase tracking-wider">
                    Barge Details
                  </th>
                  <th
                    onClick={() => toggleSort('gross_weight')}
                    className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-enterprise-silver uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-midnight-700"
                  >
                    <div className="flex items-center justify-end space-x-1">
                      <span>Gross Wt.</span>
                      {sortBy === 'gross_weight' && (
                        <span className="text-blue-600 dark:text-neon-cyan-glow">{sortDir === 'DESC' ? '↓' : '↑'}</span>
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-enterprise-silver uppercase tracking-wider">
                    Status
                  </th>
                  <th
                    onClick={() => toggleSort('deleted_at')}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-enterprise-silver uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-midnight-700"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Deleted</span>
                      {sortBy === 'deleted_at' && (
                        <span className="text-blue-600 dark:text-neon-cyan-glow">{sortDir === 'DESC' ? '↓' : '↑'}</span>
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-enterprise-silver uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-midnight-700">
                {trash.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-midnight-750 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => handleSelectOne(item.id)}
                        className="h-4 w-4 rounded border-gray-300 dark:border-midnight-600 text-blue-600 focus:ring-blue-500 cursor-pointer dark:bg-midnight-700"
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-sm font-semibold text-gray-900 dark:text-enterprise-silver">{item.trans_no || '-'}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center space-x-1 text-sm text-gray-600 dark:text-enterprise-muted">
                        <Calendar className="h-3.5 w-3.5 shrink-0 opacity-60" />
                        <span>{formatTxDate(item.transac_date)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-sm text-gray-700 dark:text-enterprise-silver">{item.driver || '-'}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-800 dark:text-enterprise-silver">{item.plate || '-'}</div>
                      {item.type_veh && (
                        <div className="text-xs text-gray-500 dark:text-enterprise-muted mt-0.5">{item.type_veh}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-sm text-gray-600 dark:text-enterprise-muted">{item.product || '-'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-500 dark:text-enterprise-muted">{item.barge_details || '-'}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end space-x-1 text-sm font-medium text-gray-700 dark:text-enterprise-silver">
                        <Weight className="h-3.5 w-3.5 opacity-50 shrink-0" />
                        <span>{formatWeight(item.gross_weight)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {getStatusBadge(item.status)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-700 dark:text-enterprise-silver">{formatDate(item.deleted_at)}</div>
                      <div className="text-xs text-gray-400 dark:text-enterprise-muted mt-0.5">{formatExactDate(item.deleted_at)}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={() => handleRestore(item.id)}
                          title="Restore transaction"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-blue-600 dark:text-neon-cyan-glow bg-blue-50 dark:bg-neon-cyan-glow/10 hover:bg-blue-100 dark:hover:bg-neon-cyan-glow/20 transition-colors"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span>Restore</span>
                        </button>
                        <button
                          onClick={() => handlePermanentDelete(item.id)}
                          title="Permanently delete"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-600 dark:text-status-error bg-red-50 dark:bg-status-error/10 hover:bg-red-100 dark:hover:bg-status-error/20 transition-colors"
                        >
                          <Trash className="h-3.5 w-3.5" />
                          <span>Delete</span>
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
            <p className="text-sm text-gray-600 dark:text-enterprise-muted">
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} items
            </p>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="inline-flex items-center px-3 py-2 rounded-lg border border-gray-300 dark:border-midnight-600 bg-white dark:bg-midnight-700 text-gray-700 dark:text-enterprise-silver hover:bg-gray-50 dark:hover:bg-midnight-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                          ? 'bg-blue-600 dark:bg-neon-cyan-glow text-white'
                          : 'border border-gray-300 dark:border-midnight-600 bg-white dark:bg-midnight-700 text-gray-700 dark:text-enterprise-silver hover:bg-gray-50 dark:hover:bg-midnight-600'
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
                className="inline-flex items-center px-3 py-2 rounded-lg border border-gray-300 dark:border-midnight-600 bg-white dark:bg-midnight-700 text-gray-700 dark:text-enterprise-silver hover:bg-gray-50 dark:hover:bg-midnight-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
