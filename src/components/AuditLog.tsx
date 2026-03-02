import React, { useState, useEffect } from 'react';
import { Clock, User, FileEdit, Trash2, RotateCcw, Package, AlertCircle, ChevronLeft, ChevronRight, RefreshCw, X } from 'lucide-react';
import { transacApi, AuditLogEntry, AuditLogResult } from '../services/transacApi';
import { format, formatDistanceToNow } from 'date-fns';

interface AuditLogProps {
  transactionId?: number; // If provided, show audit for specific transaction
  onClose?: () => void;   // Close handler for modal view
}

// Action icon mapping
const getActionIcon = (action: string) => {
  switch (action) {
    case 'CREATE':
      return <FileEdit className="w-4 h-4 text-green-600 dark:text-green-400" />;
    case 'UPDATE':
      return <FileEdit className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
    case 'DELETE':
      return <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />;
    case 'RESTORE':
      return <RotateCcw className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
    case 'BULK_DELETE':
      return <Package className="w-4 h-4 text-red-600 dark:text-red-400" />;
    case 'BULK_RESTORE':
      return <Package className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
    case 'BULK_STATUS_UPDATE':
      return <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
    default:
      return <AlertCircle className="w-4 h-4 text-gray-600 dark:text-enterprise-muted" />;
  }
};

// Action label mapping
const getActionLabel = (action: string) => {
  switch (action) {
    case 'CREATE':
      return 'Created';
    case 'UPDATE':
      return 'Updated';
    case 'DELETE':
      return 'Moved to Trash';
    case 'RESTORE':
      return 'Restored';
    case 'BULK_DELETE':
      return 'Bulk Delete';
    case 'BULK_RESTORE':
      return 'Bulk Restore';
    case 'BULK_STATUS_UPDATE':
      return 'Bulk Status Update';
    default:
      return action;
  }
};

// Action color mapping
const getActionColor = (action: string) => {
  switch (action) {
    case 'CREATE':
      return 'bg-green-100 dark:bg-status-success/20 text-green-800 dark:text-status-success border-green-200 dark:border-status-success/30';
    case 'UPDATE':
      return 'bg-blue-100 dark:bg-status-info/20 text-blue-800 dark:text-status-info border-blue-200 dark:border-status-info/30';
    case 'DELETE':
    case 'BULK_DELETE':
      return 'bg-red-100 dark:bg-status-error/20 text-red-800 dark:text-status-error border-red-200 dark:border-status-error/30';
    case 'RESTORE':
    case 'BULK_RESTORE':
      return 'bg-emerald-100 dark:bg-status-success/20 text-emerald-800 dark:text-status-success border-emerald-200 dark:border-status-success/30';
    case 'BULK_STATUS_UPDATE':
      return 'bg-purple-100 dark:bg-status-info/20 text-purple-800 dark:text-status-info border-purple-200 dark:border-status-info/30';
    default:
      return 'bg-gray-100 dark:bg-midnight-700 text-gray-800 dark:text-enterprise-silver border-gray-200 dark:border-midnight-600';
  }
};

const AuditLog: React.FC<AuditLogProps> = ({ transactionId, onClose }) => {
  const [auditData, setAuditData] = useState<AuditLogResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const loadAuditData = async () => {
    setLoading(true);
    setError(null);
    try {
      let data: AuditLogResult;
      if (transactionId) {
        data = await transacApi.getTransactionAudit(transactionId, page, pageSize);
      } else {
        data = await transacApi.getAuditLog(page, pageSize);
      }
      setAuditData(data);
    } catch (err: any) {
      console.error('Failed to load audit data:', err);
      setError(err.message || 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditData();
  }, [transactionId, page]);

  const totalPages = auditData ? Math.ceil(auditData.total / pageSize) : 0;

  const formatDateTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return {
        full: format(date, 'MMM dd, yyyy \'at\' hh:mm a'),
        relative: formatDistanceToNow(date, { addSuffix: true })
      };
    } catch {
      return { full: dateStr, relative: dateStr };
    }
  };

  return (
    <div className={`${transactionId ? 'fixed inset-0 z-50 flex items-center justify-center bg-black dark:bg-black bg-opacity-50' : ''}`}>
      <div className={`bg-white dark:bg-midnight-800 rounded-lg shadow-lg ${transactionId ? 'w-11/12 max-w-4xl max-h-[90vh] overflow-hidden' : 'w-full'}`}>
        {/* Header */}
        <div className="bg-gray-50 dark:bg-midnight-750 px-6 py-4 border-b border-gray-200 dark:border-midnight-700 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Clock className="w-5 h-5 text-gray-600 dark:text-enterprise-muted" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-enterprise-text">
              {transactionId ? `Transaction #${transactionId} Activity Log` : 'Activity Log'}
            </h2>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={loadAuditData}
              disabled={loading}
              className="flex items-center space-x-2 px-3 py-2 text-sm bg-white dark:bg-midnight-700 border border-gray-300 dark:border-midnight-600 rounded-md hover:bg-gray-50 dark:hover:bg-midnight-600 text-gray-700 dark:text-enterprise-silver disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="flex items-center justify-center w-8 h-8 text-gray-500 dark:text-enterprise-muted hover:text-gray-700 dark:hover:text-enterprise-silver hover:bg-gray-100 dark:hover:bg-midnight-700 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className={`${transactionId ? 'overflow-y-auto max-h-[calc(90vh-140px)]' : ''} p-6 bg-white dark:bg-midnight-800`}>
          {loading && (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600 dark:text-neon-cyan-glow" />
              <span className="ml-2 text-gray-600 dark:text-enterprise-muted">Loading audit log...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-md p-4">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" />
                <span className="text-red-800 dark:text-red-400">{error}</span>
              </div>
            </div>
          )}

          {auditData && !loading && (
            <>
              {auditData.rows.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-enterprise-muted">
                  <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No activity found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {auditData.rows.map((entry: AuditLogEntry) => {
                    const dateTime = formatDateTime(entry.created_at);
                    return (
                      <div
                        key={entry.id}
                        className="bg-white dark:bg-midnight-750 border border-gray-200 dark:border-midnight-700 rounded-lg p-4 hover:shadow-md dark:hover:shadow-slate-900/50 transition-shadow"
                      >
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0">
                            {getActionIcon(entry.action)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-2">
                                <span className={`px-2 py-1 text-xs font-medium rounded border ${getActionColor(entry.action)}`}>
                                  {getActionLabel(entry.action)}
                                </span>
                                {!transactionId && entry.trans_no && (
                                  <span className="text-sm text-gray-600 dark:text-enterprise-muted">
                                    Transaction: {entry.trans_no}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-enterprise-muted">
                                <User className="w-4 h-4" />
                                <span>{entry.username}</span>
                              </div>
                            </div>
                            
                            {entry.details && (
                              <p className="text-sm text-gray-700 dark:text-enterprise-silver mb-2">{entry.details}</p>
                            )}
                            
                            {!transactionId && entry.driver && (
                              <p className="text-sm text-gray-600 dark:text-enterprise-muted mb-2">
                                Driver: {entry.driver}
                              </p>
                            )}
                            
                            <div className="flex items-center text-xs text-gray-500 dark:text-enterprise-muted">
                              <Clock className="w-3 h-3 mr-1" />
                              <span title={dateTime.full}>{dateTime.relative}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 dark:border-midnight-700">
                  <div className="text-sm text-gray-700 dark:text-enterprise-silver">
                    Page {page} of {totalPages} ({auditData.total} total entries)
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                      className="flex items-center px-3 py-1 text-sm border border-gray-300 dark:border-midnight-600 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-midnight-700 dark:bg-midnight-800 dark:text-enterprise-silver"
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Previous
                    </button>
                    <button
                      onClick={() => setPage(page + 1)}
                      disabled={page >= totalPages}
                      className="flex items-center px-3 py-1 text-sm border border-gray-300 dark:border-midnight-600 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-midnight-700 dark:bg-midnight-800 dark:text-enterprise-silver"
                    >
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuditLog;