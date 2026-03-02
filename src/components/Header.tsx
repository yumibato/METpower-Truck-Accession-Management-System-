import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, User, Trash2, Zap, Bell } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import NotificationHistory from './NotificationHistory';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export default function Header() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [logoError, setLogoError] = useState(false);
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Fetch initial unread count
    fetchUnreadCount();
    
    // Poll for unread count every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    
    // Listen for real-time notification events
    const handleNewNotification = () => {
      fetchUnreadCount();
    };
    window.addEventListener('notification-received', handleNewNotification);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('notification-received', handleNewNotification);
    };
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const response = await axios.get(`${API_URL}/notifications/unread-count`, {
        withCredentials: true,
      });
      setUnreadCount(response.data.unread_count || 0);
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  };

  const handleLogout = () => {
    logout();
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="bg-white dark:bg-midnight-800 shadow-sm border-b border-gray-200 dark:border-midnight-700 transition-colors duration-200">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Title */}
          <div className="flex items-center space-x-3">
            <div className="h-10 w-auto flex items-center">
              {!logoError ? (
                <img 
                  src="/metpower-icon.svg" 
                  alt="METpower Logo" 
                  className="h-full w-auto object-contain"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded flex items-center justify-center">
                  <Zap className="h-6 w-6 text-white" />
                </div>
              )}
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-enterprise-text">
                METpower
              </h1>
              <p className="text-xs font-semibold text-gray-600 dark:text-enterprise-muted">
                Truck Accession System
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="hidden md:flex items-center space-x-1">
            <button
              onClick={() => navigate('/dashboard')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                isActive('/dashboard')
                  ? 'bg-blue-50 dark:bg-neon-cyan-glow/20 text-blue-600 dark:text-neon-cyan-glow border-b-2 border-blue-600 dark:border-neon-cyan-glow'
                  : 'text-gray-700 dark:text-enterprise-silver hover:bg-gray-50 dark:hover:bg-midnight-700'
              }`}
            >
              📊 Dashboard
            </button>
            <button
              onClick={() => navigate('/trash')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center space-x-2 ${
                isActive('/trash')
                  ? 'bg-red-50 dark:bg-status-error/20 text-red-600 dark:text-status-error border-b-2 border-red-600 dark:border-status-error'
                  : 'text-gray-700 dark:text-enterprise-silver hover:bg-gray-50 dark:hover:bg-midnight-700'
              }`}
            >
              <Trash2 className="h-4 w-4" />
              <span>Trash</span>
            </button>
          </div>

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            {/* Notification Bell */}
            <button
              onClick={() => setIsNotificationPanelOpen(true)}
              className="relative p-2 text-gray-700 dark:text-enterprise-silver hover:bg-gray-100 dark:hover:bg-midnight-700 rounded-lg transition-colors"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            
            <div className="flex items-center space-x-2 text-sm text-gray-700 dark:text-enterprise-silver">
              <User className="h-4 w-4" />
              <span className="font-medium">{user?.username}</span>
              <span className="text-gray-400 dark:text-enterprise-muted">|</span>
              <span className="text-gray-500 dark:text-enterprise-muted capitalize">{user?.role}</span>
            </div>
            
            <ThemeToggle />
            
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-enterprise-silver hover:text-red-600 dark:hover:text-status-error hover:bg-red-50 dark:hover:bg-status-error/20 rounded-lg transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>
      
      {/* Notification History Panel */}
      <NotificationHistory
        isOpen={isNotificationPanelOpen}
        onClose={() => setIsNotificationPanelOpen(false)}
        onUnreadCountChange={setUnreadCount}
      />
    </header>
  );
}
