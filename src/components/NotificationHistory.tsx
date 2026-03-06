import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Bell, CheckCircle, XCircle, AlertCircle, Info, Trash2, CheckCheck, Clock, RefreshCw, ChevronDown, ExternalLink, Truck, User, Package } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface Notification {
  id: number;
  user_id: number | null;
  username: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string | null;
  action: string | null;
  trans_id: number | null;
  trans_no: string | null;
  is_read: boolean;
  is_dismissed: boolean;
  created_at: string;
  read_at: string | null;
  metadata: string | null;
}

interface NotificationHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
}

const getIcon = (type: Notification['type']) => {
  switch (type) {
    case 'success': return <CheckCircle className="w-4 h-4 text-emerald-400" />;
    case 'error':   return <XCircle    className="w-4 h-4 text-red-400" />;
    case 'warning': return <AlertCircle className="w-4 h-4 text-amber-400" />;
    case 'info':    return <Info        className="w-4 h-4 text-blue-400" />;
    default:        return <Bell        className="w-4 h-4 text-white/50" />;
  }
};

const getTypeStyles = (type: Notification['type']) => {
  switch (type) {
    case 'success': return 'bg-emerald-500/8 border-emerald-500/20 hover:bg-emerald-500/12';
    case 'error':   return 'bg-red-500/8 border-red-500/20 hover:bg-red-500/12';
    case 'warning': return 'bg-amber-500/8 border-amber-500/20 hover:bg-amber-500/12';
    case 'info':    return 'bg-blue-500/8 border-blue-500/20 hover:bg-blue-500/12';
    default:        return 'bg-white/4 border-white/10 hover:bg-white/8';
  }
};

const getUnreadAccent = (type: Notification['type']) => {
  switch (type) {
    case 'success': return 'border-l-emerald-400';
    case 'error':   return 'border-l-red-400';
    case 'warning': return 'border-l-amber-400';
    case 'info':    return 'border-l-blue-400';
    default:        return 'border-l-cyan-400';
  }
};

const getStatusBadge = (status: string) => {
  const s = status.toLowerCase();
  if (s === 'complete' || s === 'completed' || s === 'outbound')
    return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25';
  if (s === 'inbound' || s === 'pending')
    return 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/25';
  if (s === 'void' || s === 'cancelled' || s === 'voided')
    return 'bg-red-500/12 text-red-400 border border-red-500/20';
  return 'bg-white/8 text-white/50 border border-white/12';
};

const WeightStat = ({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) => (
  <div className={`flex flex-col items-center justify-center py-2.5 rounded-xl border ${
    highlight ? 'bg-emerald-500/8 border-emerald-500/20' : 'bg-white/3 border-white/8'
  }`}>
    <span className={`text-sm font-bold font-mono tabular-nums ${highlight ? 'text-emerald-400' : 'text-white/80'}`}>
      {Number(value).toLocaleString()}
    </span>
    <span className={`text-[9px] uppercase tracking-widest mt-0.5 ${highlight ? 'text-emerald-400/60' : 'text-white/30'}`}>{label} kg</span>
  </div>
);


const getActionLabel = (action: string | null) => {
  if (!action) return null;
  const labels: Record<string, string> = {
    CREATE: 'Created', UPDATE: 'Updated', DELETE: 'Deleted',
    RESTORE: 'Restored', BULK_UPDATE: 'Bulk Updated',
    BULK_DELETE: 'Bulk Deleted', EXPORT: 'Exported', IMPORT: 'Imported',
  };
  return labels[action] ?? action;
};

const formatRelativeTime = (ts: string) => {
  try {
    return formatDistanceToNow(new Date(ts), { addSuffix: true });
  } catch {
    return ts;
  }
};

export default function NotificationHistory({ isOpen, onClose, onUnreadCountChange }: NotificationHistoryProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [visible, setVisible] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const navigate = useNavigate();
  const isMounted = useRef(true);
  // Ref to always call the latest fetchNotifications from event handlers (avoids stale closure)
  const fetchRef = useRef<() => void>(() => {});

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Animate in/out
  useEffect(() => {
    if (isOpen) {
      setVisible(false);
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      fetchNotifications();
    } else {
      setVisible(false);
      setExpandedId(null);
    }
  }, [isOpen]);

  // Re-fetch when filter changes while open
  useEffect(() => {
    if (isOpen) fetchNotifications();
  }, [filter]);

  // Keep ref in sync so live events always call the latest version
  useEffect(() => {
    fetchRef.current = fetchNotifications;
  });

  // Live refresh while panel is open — uses ref to avoid stale closure
  useEffect(() => {
    if (!isOpen) return;
    const handle = () => fetchRef.current();
    window.addEventListener('data-changed', handle);
    window.addEventListener('notification-received', handle);
    return () => {
      window.removeEventListener('data-changed', handle);
      window.removeEventListener('notification-received', handle);
    };
  }, [isOpen]);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/notifications`, {
        params: { pageSize: 100 },
        withCredentials: true,
      });
      if (!isMounted.current) return;

      let notifs: Notification[] = response.data.notifications || [];
      notifs = notifs.filter((n) => !n.is_dismissed);
      if (filter === 'unread') notifs = notifs.filter((n) => !n.is_read);

      setNotifications(notifs);
      onUnreadCountChange?.(notifs.filter((n) => !n.is_read).length);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [filter, onUnreadCountChange]);

  const markAsRead = async (id: number) => {
    try {
      await axios.put(`${API_URL}/notifications/${id}/read`, {}, { withCredentials: true });
      setNotifications(prev => {
        const next = prev.map(n => n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n);
        onUnreadCountChange?.(next.filter(n => !n.is_read).length);
        return next;
      });
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.put(`${API_URL}/notifications/mark-all-read`, {}, { withCredentials: true });
      setNotifications(prev => {
        const next = prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }));
        onUnreadCountChange?.(0);
        return next;
      });
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const dismissNotification = async (id: number) => {
    try {
      await axios.delete(`${API_URL}/notifications/${id}`, { withCredentials: true });
      setNotifications(prev => {
        const next = prev.filter(n => n.id !== id);
        onUnreadCountChange?.(next.filter(n => !n.is_read).length);
        return next;
      });
    } catch (error) {
      console.error('Failed to dismiss notification:', error);
    }
  };

  const dismissAll = async () => {
    try {
      await Promise.all(notifications.map(n =>
        axios.delete(`${API_URL}/notifications/${n.id}`, { withCredentials: true })
      ));
      setNotifications([]);
      onUnreadCountChange?.(0);
    } catch (error) {
      console.error('Failed to clear all notifications:', error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) markAsRead(notification.id);
    setExpandedId(prev => prev === notification.id ? null : notification.id);
  };

  const handleViewTransaction = (e: React.MouseEvent, notification: Notification) => {
    e.stopPropagation();
    navigate(`/transactions?trans_id=${notification.trans_id}`);
    onClose();
  };

  const handleViewInLog = (e: React.MouseEvent, notification: Notification) => {
    e.stopPropagation();
    navigate(`/activity-log?trans_id=${notification.trans_id}`);
    onClose();
  };

  if (!isOpen) return null;

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-hidden">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />

      {/* Slide-in Panel */}
      <div
        className={`absolute right-0 top-0 bottom-0 w-full max-w-[420px] flex flex-col
          bg-[#06101f] border-l border-blue-500/10 shadow-2xl
          transition-transform duration-300 ease-out
          ${visible ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex-shrink-0 bg-[#060d1f] border-b border-blue-500/10 px-5 pt-5 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-blue-500/10 rounded-lg">
                <Bell className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white leading-none">Notifications</h2>
                <p className="text-xs text-white/40 mt-0.5">
                  {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => fetchNotifications()}
                className="p-2 text-white/40 hover:text-white/80 hover:bg-white/8 rounded-lg transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onClose}
                className="p-2 text-white/40 hover:text-white/80 hover:bg-white/8 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2">
            {(['all', 'unread'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 py-1.5 px-3 rounded-lg text-sm font-medium transition-colors ${
                  filter === f
                    ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                    : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                }`}
              >
                {f === 'all' ? `All (${notifications.length})` : `Unread (${unreadCount})`}
              </button>
            ))}
          </div>

          {/* Action row */}
          {notifications.length > 0 && (
            <div className="flex gap-2 mt-3">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-medium text-cyan-400/80 hover:text-cyan-400 hover:bg-cyan-500/8 rounded-lg transition-colors border border-cyan-500/15 hover:border-cyan-500/30"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
              <button
                onClick={dismissAll}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-medium text-white/40 hover:text-red-400 hover:bg-red-500/8 rounded-lg transition-colors border border-white/8 hover:border-red-500/20"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Notification List */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
          {loading && notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3">
              <div className="w-7 h-7 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
              <p className="text-sm text-white/30">Loading...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-white/30">
              <Bell className="w-10 h-10 opacity-20" />
              <p className="text-sm">No notifications</p>
            </div>
          ) : (
            notifications.map(notification => {
              const isExpanded = expandedId === notification.id;
              let meta: Record<string, string> = {};
              try { if (notification.metadata) meta = JSON.parse(notification.metadata); } catch { /* ignore */ }
              const hasDetails = Object.keys(meta).length > 0 || !!notification.trans_id || !!notification.username;

              return (
              <div
                key={notification.id}
                className={`relative border rounded-xl transition-all duration-200
                  ${getTypeStyles(notification.type)}
                  ${!notification.is_read ? `border-l-2 ${getUnreadAccent(notification.type)}` : ''}
                `}
              >
                {/* Main row — always clickable to expand */}
                <div
                  className="group p-3.5 cursor-pointer"
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5 p-1.5 rounded-md bg-white/5">
                      {getIcon(notification.type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-white/90 truncate">
                          {notification.title}
                        </span>
                        {!notification.is_read && (
                          <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-cyan-400" />
                        )}
                        {hasDetails && (
                          <ChevronDown className={`flex-shrink-0 w-3.5 h-3.5 text-white/30 ml-auto transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        )}
                      </div>

                      {notification.message && (
                        <p className="text-xs text-white/55 mb-1.5 line-clamp-2">
                          {notification.message}
                        </p>
                      )}

                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="flex items-center gap-1 text-[11px] text-white/35">
                            <Clock className="w-2.5 h-2.5" />
                            {formatRelativeTime(notification.created_at)}
                          </span>
                          {notification.action && getActionLabel(notification.action) && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/8 text-white/40 font-medium">
                              {getActionLabel(notification.action)}
                            </span>
                          )}
                          {notification.trans_no && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400/80 font-mono">
                              #{notification.trans_no}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!notification.is_read && (
                            <button
                              onClick={(e) => { e.stopPropagation(); markAsRead(notification.id); }}
                              className="p-1 rounded text-white/40 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors"
                              title="Mark as read"
                            >
                              <CheckCheck className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); dismissNotification(notification.id); }}
                            className="p-1 rounded text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Dismiss"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expandable detail panel */}
                {isExpanded && hasDetails && (() => {
                  const hasTruck  = !!(meta.plate || meta.driver || meta.product || meta.trans_status);
                  const hasWeight = !!(meta.net_weight || meta.gross_weight || meta.tare_weight);
                  const hasOldNew = !!(meta.old_value || meta.new_value) && !hasTruck;
                  return (
                    <div className="border-t border-white/6 overflow-hidden">
                      <div className="p-3.5 space-y-3">

                        {/* ── Plate + Status header ─────────────────────── */}
                        {meta.plate && (
                          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/4 border border-white/8">
                            <div className="p-1.5 rounded-lg bg-cyan-500/10 flex-shrink-0">
                              <Truck className="w-4 h-4 text-cyan-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] text-white/30 uppercase tracking-wider leading-none mb-0.5">Plate No.</p>
                              <p className="text-base font-bold text-white font-mono tracking-widest leading-none">{meta.plate}</p>
                            </div>
                            {meta.trans_status && (
                              <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg capitalize flex-shrink-0 ${getStatusBadge(meta.trans_status)}`}>
                                {meta.trans_status}
                              </span>
                            )}
                          </div>
                        )}

                        {/* ── Driver / Product row ──────────────────────── */}
                        {(meta.driver || meta.product) && (
                          <div className={`grid gap-2 ${meta.driver && meta.product ? 'grid-cols-2' : 'grid-cols-1'}`}>
                            {meta.driver && (
                              <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white/3 border border-white/6 min-w-0">
                                <User className="w-3.5 h-3.5 text-blue-400/60 flex-shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-[9px] text-white/30 uppercase tracking-wider leading-none mb-0.5">Driver</p>
                                  <p className="text-xs text-white/75 truncate leading-none">{meta.driver}</p>
                                </div>
                              </div>
                            )}
                            {meta.product && (
                              <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white/3 border border-white/6 min-w-0">
                                <Package className="w-3.5 h-3.5 text-emerald-400/60 flex-shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-[9px] text-white/30 uppercase tracking-wider leading-none mb-0.5">Product</p>
                                  <p className="text-xs text-white/75 truncate leading-none">{meta.product}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* ── Weight stats ──────────────────────────────── */}
                        {hasWeight && (
                          <div className="grid grid-cols-3 gap-1.5">
                            {meta.gross_weight && <WeightStat label="Gross" value={meta.gross_weight} />}
                            {meta.tare_weight  && <WeightStat label="Tare"  value={meta.tare_weight} />}
                            {meta.net_weight   && <WeightStat label="Net"   value={meta.net_weight}  highlight />}
                          </div>
                        )}

                        {/* ── Old/New diff for non-transac tables ──────── */}
                        {hasOldNew && (
                          <div className="space-y-2">
                            {meta.old_value && meta.old_value !== 'null' && (() => {
                              let fields: Record<string, unknown> = {};
                              try { fields = JSON.parse(meta.old_value as string); } catch { fields = {}; }
                              return (
                                <div className="rounded-lg bg-red-500/5 border border-red-500/15 p-2.5">
                                  <p className="text-[9px] text-red-400/60 uppercase tracking-wider font-semibold mb-1.5">Before</p>
                                  {Object.entries(fields).filter(([, v]) => v != null && v !== '').map(([k, v]) => (
                                    <div key={k} className="flex gap-2 text-[11px] leading-relaxed">
                                      <span className="text-white/30 w-20 flex-shrink-0 capitalize">{k.replace(/_/g, ' ')}</span>
                                      <span className="text-white/55 font-mono truncate">{String(v)}</span>
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}
                            {meta.new_value && meta.new_value !== 'null' && (() => {
                              let fields: Record<string, unknown> = {};
                              try { fields = JSON.parse(meta.new_value as string); } catch { fields = {}; }
                              return (
                                <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/15 p-2.5">
                                  <p className="text-[9px] text-emerald-400/60 uppercase tracking-wider font-semibold mb-1.5">After</p>
                                  {Object.entries(fields).filter(([, v]) => v != null && v !== '').map(([k, v]) => (
                                    <div key={k} className="flex gap-2 text-[11px] leading-relaxed">
                                      <span className="text-white/30 w-20 flex-shrink-0 capitalize">{k.replace(/_/g, ' ')}</span>
                                      <span className="text-white/55 font-mono truncate">{String(v)}</span>
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {/* ── Footer: trans_no · actor · time ───────────── */}
                        <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                          {(notification.trans_no || meta.trans_no) && (
                            <span className="text-[10px] font-mono text-cyan-400/60 bg-cyan-500/8 px-1.5 py-0.5 rounded border border-cyan-500/15">
                              #{notification.trans_no || meta.trans_no}
                            </span>
                          )}
                          <span className="text-[10px] text-white/25">{notification.username}</span>
                          <span className="text-white/15 text-[10px]">·</span>
                          <span className="text-[10px] text-white/25 font-mono ml-auto">
                            {(() => { try { return format(new Date(notification.created_at), 'MMM d, yyyy HH:mm:ss'); } catch { return notification.created_at; } })()}
                          </span>
                        </div>
                      </div>

                      {/* ── Action buttons ────────────────────────────── */}
                      {notification.trans_id && (
                        <div className="px-3.5 pb-3.5 flex gap-2">
                          <button
                            onClick={(e) => handleViewTransaction(e, notification)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-white/70 hover:text-white hover:bg-white/8 rounded-xl transition-all border border-white/10 hover:border-white/20"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            View Transaction
                          </button>
                          <button
                            onClick={(e) => handleViewInLog(e, notification)}
                            className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-white/40 hover:text-cyan-400 hover:bg-cyan-500/8 rounded-xl transition-all border border-white/8 hover:border-cyan-500/20"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-blue-500/10 px-5 py-3">
          <p className="text-xs text-white/20 text-center">
            {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
            {filter === 'unread' ? ' · Unread only' : ''}
            {' · '}Updates live
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
