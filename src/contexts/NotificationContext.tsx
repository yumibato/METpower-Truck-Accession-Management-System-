import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  autoHide?: boolean;
  duration?: number; // milliseconds
  trans_id?: number; // Transaction ID for clickable notifications
  clickable?: boolean; // Whether notification is clickable
  action?: string; // Action type (CREATE, UPDATE, DELETE, etc.)
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  socket: Socket | null; // Expose socket for authentication
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

const getIcon = (type: Notification['type']) => {
  switch (type) {
    case 'success':
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    case 'error':
      return <XCircle className="w-5 h-5 text-red-500" />;
    case 'warning':
      return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    case 'info':
      return <Info className="w-5 h-5 text-blue-500" />;
    default:
      return <Info className="w-5 h-5 text-gray-500" />;
  }
};

const getNotificationStyles = (type: Notification['type']) => {
  switch (type) {
    case 'success':
      return 'bg-[#0a1a2e] border-emerald-500/30 text-emerald-300 shadow-emerald-500/10';
    case 'error':
      return 'bg-[#0a1a2e] border-red-500/30 text-red-300 shadow-red-500/10';
    case 'warning':
      return 'bg-[#0a1a2e] border-amber-500/30 text-amber-300 shadow-amber-500/10';
    case 'info':
      return 'bg-[#0a1a2e] border-blue-500/30 text-blue-300 shadow-blue-500/10';
    default:
      return 'bg-[#0a1a2e] border-white/10 text-white/70 shadow-black/20';
  }
};

interface NotificationItemProps {
  notification: Notification;
  onClose: (id: string) => void;
  onNavigate?: (trans_id: number) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onClose, onNavigate }) => {
  React.useEffect(() => {
    if (notification.autoHide !== false) {
      const duration = notification.duration || 5000;
      const timer = setTimeout(() => {
        onClose(notification.id);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [notification, onClose]);

  const handleClick = () => {
    if (notification.clickable && notification.trans_id && onNavigate) {
      onNavigate(notification.trans_id);
      onClose(notification.id);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`max-w-sm w-full border rounded-xl shadow-2xl p-4 transition-all transform backdrop-blur-xl
        ${getNotificationStyles(notification.type)} 
        ${notification.clickable ? 'cursor-pointer hover:brightness-110 hover:scale-[1.02]' : ''}
        animate-in slide-in-from-right-full duration-300`}
    >
      <div className="flex items-start">
        <div className="flex-shrink-0">
          {getIcon(notification.type)}
        </div>
        <div className="ml-3 flex-1">
          <h4 className="text-sm font-semibold">{notification.title}</h4>
          {notification.message && (
            <p className="text-sm mt-1 opacity-90">{notification.message}</p>
          )}
          {notification.clickable && (
            <p className="text-xs mt-1 opacity-70 italic">Click to view details</p>
          )}
        </div>
        <div className="ml-4 flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose(notification.id);
            }}
            className="inline-flex rounded-md p-1 hover:bg-black hover:bg-opacity-10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-current"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

interface NotificationProviderProps {
  children: React.ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const navigate = useNavigate();

  // Initialize Socket.IO connection
  useEffect(() => {
    // Prevent double initialization in React StrictMode
    // Return empty cleanup on second run to prevent disconnect
    if (socketRef.current) {
      return () => {}; // Empty cleanup function for StrictMode second run
    }
    const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001';
    
    console.log('🔌 Connecting to WebSocket server:', SOCKET_URL);
    const socketInstance = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketInstance.on('connect', () => {
      console.log('✅ WebSocket connected:', socketInstance.id);
      
      // Authenticate with user data from localStorage/cookies if available
      const authData = localStorage.getItem('auth');
      if (authData) {
        try {
          const { username, email } = JSON.parse(authData);
          socketInstance.emit('authenticate', { username, email });
        } catch (err) {
          console.error('Failed to parse auth data for socket authentication');
        }
      }
    });

    socketInstance.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error);
    });

    socketInstance.on('disconnect', (reason) => {
      console.warn('🔌 WebSocket disconnected:', reason);
    });

    // Listen for real-time notifications
    socketInstance.on('new_notification', (notification: Omit<Notification, 'id'>) => {
      console.log('📬 Received real-time notification:', notification);
      
      const id = Date.now().toString() + Math.random().toString(36).substring(2);
      const newNotification: Notification = {
        id,
        autoHide: notification.autoHide ?? true,
        duration: notification.duration ?? 6000,
        ...notification,
      };
      
      setNotifications(prev => [newNotification, ...prev.slice(0, 4)]);
      
      // Dispatch events so all components can refresh immediately
      window.dispatchEvent(new CustomEvent('notification-received', { detail: notification }));
      window.dispatchEvent(new CustomEvent('data-changed', { detail: notification }));
      
      try {
        const audio = new Audio('/notification.mp3');
        audio.play().catch(() => {});
      } catch { /* ignore */ }
    });

    // Listen for lightweight data_changed events (emitted on every DB mutation)
    socketInstance.on('data_changed', (payload: { action: string; trans_id: number; timestamp: string }) => {
      window.dispatchEvent(new CustomEvent('data-changed', { detail: payload }));
    });

    setSocket(socketInstance);
    socketRef.current = socketInstance;

    // Cleanup on unmount - only disconnect the actual socket once
    return () => {
      console.log('🔌 Disconnecting WebSocket');
      socketInstance.disconnect();
      socketRef.current = null;
    };
  }, []);

  const addNotification = useCallback((notification: Omit<Notification, 'id'>) => {
    const id = Math.random().toString(36).substring(2);
    const newNotification: Notification = {
      id,
      autoHide: true,
      duration: 5000,
      ...notification,
    };
    
    setNotifications(prev => [newNotification, ...prev.slice(0, 4)]); // Keep max 5 notifications
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const handleNavigate = useCallback((trans_id: number) => {
    navigate(`/transactions?trans_id=${trans_id}`);
  }, [navigate]);

  return (
    <NotificationContext.Provider value={{
      notifications,
      addNotification,
      removeNotification,
      clearAll,
      socket,
    }}>
      {children}
      
      {/* Notification Container */}
      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
        {notifications.map((notification) => (
          <div key={notification.id} className="pointer-events-auto">
            <NotificationItem 
              notification={notification} 
              onClose={removeNotification}
              onNavigate={handleNavigate}
            />
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};

// Utility hooks for common notification types
export const useToast = () => {
  const { addNotification } = useNotifications();
  
  return {
    success: (title: string, message?: string) => 
      addNotification({ type: 'success', title, message }),
    error: (title: string, message?: string) => 
      addNotification({ type: 'error', title, message, autoHide: false }),
    warning: (title: string, message?: string) => 
      addNotification({ type: 'warning', title, message }),
    info: (title: string, message?: string) => 
      addNotification({ type: 'info', title, message }),
  };
};