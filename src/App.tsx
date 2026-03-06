import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import TrashBin from './components/TrashBin';
import TransactionsPage from './components/pages/TransactionsPage';
import ActivityLogPage from './components/pages/ActivityLogPage';
import AnalyticsPage from './components/pages/AnalyticsPage';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import AIChat from './components/AIChat';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ThemeProvider } from './contexts/ThemeContext';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-gray-600 dark:text-enterprise-muted">Checking session...</div>
      </div>
    );
  }
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

/** Only mounts AIChat after auth is fully confirmed — never visible on login page */
function AuthenticatedAIChat() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading || !isAuthenticated) return null;
  return <AIChat />;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <NotificationProvider>
            <div className="relative min-h-screen bg-[#060d1f] transition-colors duration-200">

              {/* ── Global ambient glow orbs ── */}
              <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute -top-64 -left-64 w-[800px] h-[800px] rounded-full bg-blue-600/10 blur-[160px]" />
                <div className="absolute -bottom-32 -right-32 w-[600px] h-[600px] rounded-full bg-cyan-500/8 blur-[130px]" />
                <div className="absolute top-1/2 -translate-y-1/2 left-1/4 w-[400px] h-[400px] rounded-full bg-indigo-600/7 blur-[110px]" />
              </div>

              <div className="relative z-10">
                <Routes>
                <Route path="/login" element={<Login />} />
                <Route 
                  path="/dashboard" 
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/trash" 
                  element={
                    <ProtectedRoute>
                      <TrashBin />
                    </ProtectedRoute>
                  } 
                />
                <Route
                  path="/transactions"
                  element={
                    <ProtectedRoute>
                      <TransactionsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/activity-log"
                  element={
                    <ProtectedRoute>
                      <ActivityLogPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/analytics"
                  element={
                    <ProtectedRoute>
                      <AnalyticsPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="/" element={<Navigate to="/dashboard" />} />
              </Routes>
              <PWAInstallPrompt />
              <AuthenticatedAIChat />
              </div>
            </div>
          </NotificationProvider>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
