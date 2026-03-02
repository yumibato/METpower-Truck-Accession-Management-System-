import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, User, Trash2, Zap } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';

export default function Header() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [logoError, setLogoError] = useState(false);

  const handleLogout = () => {
    logout();
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="bg-white dark:bg-slate-800 shadow-sm border-b border-gray-200 dark:border-slate-700 transition-colors duration-200">
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
              <h1 className="text-lg font-bold text-gray-900 dark:text-slate-100">
                METpower
              </h1>
              <p className="text-xs font-semibold text-gray-600 dark:text-slate-400">
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
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'
              }`}
            >
              📊 Dashboard
            </button>
            <button
              onClick={() => navigate('/trash')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center space-x-2 ${
                isActive('/trash')
                  ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-b-2 border-red-600 dark:border-red-400'
                  : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'
              }`}
            >
              <Trash2 className="h-4 w-4" />
              <span>Trash</span>
            </button>
          </div>

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm text-gray-700 dark:text-slate-300">
              <User className="h-4 w-4" />
              <span className="font-medium">{user?.username}</span>
              <span className="text-gray-400 dark:text-slate-500">|</span>
              <span className="text-gray-500 dark:text-slate-400 capitalize">{user?.role}</span>
            </div>
            
            <ThemeToggle />
            
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
