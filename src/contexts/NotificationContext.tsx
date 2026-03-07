import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';

export interface Notification {
  id       : string;
  type     : 'success' | 'error' | 'warning' | 'info';
  title    : string;
  message ?: string;
  autoHide?: boolean;
  duration?: number;
  trans_id?: number;
  clickable?: boolean;
  action  ?: string;
}

interface NotificationContextType {
  notifications   : Notification[];
  addNotification : (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
  clearAll        : () => void;
  socket          : Socket | null;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within a NotificationProvider');
  return context;
};

interface NotificationProviderProps { children: React.ReactNode; }

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [socket, setSocket]               = useState<Socket | null>(null);
  const socketRef                         = useRef<Socket | null>(null);
  const navigate                          = useNavigate();

  useEffect(() => {
    if (socketRef.current) return () => {};

    const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001';
    console.log('🔌 Connecting to WebSocket server:', SOCKET_URL);

    const s = io(SOCKET_URL, {
      transports       : ['websocket', 'polling'],
      reconnection     : true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    s.on('connect', () => {
      console.log('✅ WebSocket connected:', s.id);
      const authData = localStorage.getItem('auth');
      if (authData) {
        try {
          const { username, email } = JSON.parse(authData);
          s.emit('authenticate', { username, email });
        } catch { /* ignore */ }
      }
    });

    s.on('connect_error', (err) => console.error('❌ WebSocket error:', err));
    s.on('disconnect',    (r)   => console.warn('🔌 WebSocket disconnected:', r));

    s.on('new_notification', (notif: Omit<Notification, 'id'>) => {
      console.log('📬 Received real-time notification:', notif);
      const id = Date.now().toString() + Math.random().toString(36).substring(2);
      setNotifications(prev => [{
        id,
        autoHide: notif.autoHide ?? true,
        duration: notif.duration ?? 6000,
        ...notif,
      }, ...prev.slice(0, 4)]);
      window.dispatchEvent(new CustomEvent('notification-received', { detail: notif }));
      window.dispatchEvent(new CustomEvent('data-changed',          { detail: notif }));
      try { new Audio('/notification.mp3').play().catch(() => {}); } catch { /* ignore */ }
    });

    s.on('data_changed', (payload: { action: string; trans_id: number; timestamp: string }) => {
      window.dispatchEvent(new CustomEvent('data-changed', { detail: payload }));
    });

    setSocket(s);
    socketRef.current = s;

    return () => {
      console.log('🔌 Disconnecting WebSocket');
      s.disconnect();
      socketRef.current = null;
    };
  }, []);

  const addNotification = useCallback((notification: Omit<Notification, 'id'>) => {
    const id = Math.random().toString(36).substring(2);
    setNotifications(prev => [{ id, autoHide: true, duration: 5000, ...notification }, ...prev.slice(0, 4)]);
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAll = useCallback(() => setNotifications([]), []);

  void navigate; // keep in scope for future trans_id navigation

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, removeNotification, clearAll, socket }}>
      {children}
    </NotificationContext.Provider>
  );
};

/** Convenience hook — mirrors the old useToast API */
export const useToast = () => {
  const { addNotification } = useNotifications();
  return {
    success: (title: string, message?: string) => addNotification({ type: 'success', title, message }),
    error:   (title: string, message?: string) => addNotification({ type: 'error',   title, message, autoHide: false }),
    warning: (title: string, message?: string) => addNotification({ type: 'warning', title, message }),
    info:    (title: string, message?: string) => addNotification({ type: 'info',    title, message }),
  };
};