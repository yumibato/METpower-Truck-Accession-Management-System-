import { useState, useEffect } from 'react';
import { X, Bell, CheckCircle, XCircle, AlertCircle, Info, Trash2, CheckCheck, Clock } from 'lucide-react';
import { format } from 'date-fns';
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
    case 'success':
      return <CheckCircle className="w-5 h-5 text-status-success" />;
    case 'error':
      return <XCircle className="w-5 h-5 text-status-error" />;
    case 'warning':
      return <AlertCircle className="w-5 h-5 text-status-warning" />;
    case 'info':
      return <Info className="w-5 h-5 text-blue-500" />;
    default:
      return <Bell className="w-5 h-5 text-gray-500" />;
  }
};

const getTypeColor = (type: Notification['type']) => {
  switch (type) {
    case 'success':
      return 'bg-status-success/10 border-status-success/20';
    case 'error':
      return 'bg-status-error/10 border-status-error/20';
    case 'warning':
      return 'bg-status-warning/10 border-status-warning/20';
    case 'info':
      return 'bg-blue-500/10 border-blue-500/20';
    default:
      return 'bg-gray-100 dark:bg-midnight-700 border-gray-200 dark:border-midnight-600';
  }
};

export default function NotificationHistory({ isOpen, onClose, onUnreadCountChange }: NotificationHistoryProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, filter]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/notifications`, {
        params: { pageSize: 100 },
        withCredentials: true,
      });
      
      let notifs = response.data.notifications || [];
      
      if (filter === 'unread') {
        notifs = notifs.filter((n: Notification) => !n.is_read && !n.is_dismissed);
      } else {
        // Filter out dismissed notifications
        notifs = notifs.filter((n: Notification) => !n.is_dismissed);
      }
      
      setNotifications(notifs);
      
      // Update unread count
      const unreadCount = notifs.filter((n: Notification) => !n.is_read && !n.is_dismissed).length;
      onUnreadCountChange?.(unreadCount);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: number) => {
    try {
      await axios.put(`${API_URL}/notifications/${id}/read`, {}, { withCredentials: true });
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)
      );
      // Update unread count
      const unreadCount = notifications.filter(n => !n.is_read && !n.is_dismissed && n.id !== id).length;
      onUnreadCountChange?.(unreadCount);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.put(`${API_URL}/notifications/mark-all-read`, {}, { withCredentials: true });
      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );
      onUnreadCountChange?.(0);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const dismissNotification = async (id: number) => {
    try {
      await axios.delete(`${API_URL}/notifications/${id}`, { withCredentials: true });
      setNotifications(prev => prev.filter(n => n.id !== id));
      // Update unread count
      const dismissed = notifications.find(n => n.id === id);
      if (dismissed && !dismissed.is_read) {
        const unreadCount = notifications.filter(n => !n.is_read && !n.is_dismissed && n.id !== id).length;
        onUnreadCountChange?.(unreadCount);
      }
    } catch (error) {
      console.error('Failed to dismiss notification:', error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (notification.trans_id) {
      // Mark as read
      if (!notification.is_read) {
        markAsRead(notification.id);
      }
      // Navigate to Activity Log with transaction filter
      navigate(`/dashboard?tab=auditlog&trans_id=${notification.trans_id}`);
      onClose();
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      return format(new Date(timestamp), 'MMM dd, yyyy HH:mm');
    } catch {
      return timestamp;
    }
  };

  if (!isOpen) return null;

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Slide-in Panel */}
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white dark:bg-midnight-900 shadow-2xl transform transition-transform">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 dark:from-neon-cyan-glow/80 dark:to-purple-600 p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <Bell className="w-6 h-6" />
              <h2 className="text-xl font-bold">Notifications</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Filter Tabs */}
          <div className="flex space-x-2">
            <button
              onClick={() => setFilter('all')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-colors ${
                filter === 'all'
                  ? 'bg-white text-blue-600 dark:text-neon-cyan-glow'
                  : 'bg-white/20 hover:bg-white/30'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-colors ${
                filter === 'unread'
                  ? 'bg-white text-blue-600 dark:text-neon-cyan-glow'
                  : 'bg-white/20 hover:bg-white/30'
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>
          
          {/* Mark All as Read */}
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="mt-3 w-full py-2 px-4 bg-white/20 hover:bg-white/30 rounded-lg font-medium text-sm transition-colors flex items-center justify-center space-x-2"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Mark All as Read</span>
            </button>
          )}
        </div>

        {/* Notification List */}
        <div className="overflow-y-auto h-[calc(100vh-220px)] p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-neon-cyan-glow"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-enterprise-muted">
              <Bell className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm">No notifications</p>
            </div>
          ) : (
            notifications.map(notification => (
              <div
                key={notification.id}
                className={`border rounded-lg p-4 transition-all ${
                  getTypeColor(notification.type)
                } ${
                  notification.trans_id ? 'cursor-pointer hover:shadow-md' : ''
                } ${
                  !notification.is_read ? 'border-l-4 border-l-blue-500 dark:border-l-neon-cyan-glow' : ''
                }`}
                onClick={() => notification.trans_id && handleNotificationClick(notification)}
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {getIcon(notification.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-enterprise-text truncate">
                        {notification.title}
                      </h4>
                      {!notification.is_read && (
                        <span className="flex-shrink-0 ml-2 w-2 h-2 bg-blue-500 dark:bg-neon-cyan-glow rounded-full"></span>
                      )}
                    </div>
                    
                    {notification.message && (
                      <p className="text-sm text-gray-700 dark:text-enterprise-silver mb-2">
                        {notification.message}
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-enterprise-muted">
                      <div className="flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>{formatTimestamp(notification.created_at)}</span>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {notification.trans_id && (
                          <span className="text-blue-600 dark:text-neon-cyan-glow font-medium">
                            #{notification.trans_no}
                          </span>
                        )}
                        
                        {!notification.is_read && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(notification.id);
                            }}
                            className="text-blue-600 dark:text-neon-cyan-glow hover:underline"
                          >
                            Mark read
                          </button>
                        )}
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            dismissNotification(notification.id);
                          }}
                          className="text-gray-500 hover:text-red-600 dark:hover:text-status-error"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
