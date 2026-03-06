import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Lock, User, AlertCircle, Eye, EyeOff, Zap } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

export default function Login() {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [logoError, setLogoError] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth();
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setError('');
    try {
      // Use real backend
      const resp = await fetch(`${apiBaseUrl || 'http://localhost:3001'}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.message || data.error || 'Login failed. Please try again.');
      }
      const data = await resp.json();
      const token = data.token || 'session-token';
      const user = data.user || { username: formData.username, role: 'admin' };
      login(token, user);
      navigate('/dashboard');
    } catch (error: any) {
      setError(error.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden px-4">

      {/* Theme Toggle */}
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo + Title */}
        <div className="text-center mb-8">
          <div className="mx-auto h-20 w-auto flex items-center justify-center mb-5">
            {!logoError ? (
              <img
                src="/metpower-icon.svg"
                alt="METpower Logo"
                className="h-full w-auto object-contain drop-shadow-2xl"
                onError={() => setLogoError(true)}
              />
            ) : (
              <div className="h-20 w-20 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-xl shadow-cyan-500/30">
                <Zap className="h-10 w-10 text-white" />
              </div>
            )}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
            Truck Accession System
          </h1>
          <p className="mt-1.5 text-sm text-gray-500 dark:text-white/35 font-light">
            Administrator Login
          </p>
        </div>

        {/* Glass card */}
        <div className="glass-card rounded-3xl p-7 space-y-5">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-red-50/80 dark:bg-red-500/10 border border-red-200/60 dark:border-red-400/20">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}

            {/* Username */}
            <div className="space-y-1.5">
              <label htmlFor="username" className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-white/30">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-white/25" />
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="Enter your username"
                  className="glass-input w-full pl-10 pr-4 py-3 rounded-xl text-sm text-gray-900 placeholder-gray-400"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-white/30">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-white/25" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  className="glass-input w-full pl-10 pr-10 py-3 rounded-xl text-sm text-gray-900"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/25 hover:text-gray-600 dark:hover:text-white/50 transition-colors focus:outline-none"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white
                bg-gradient-to-r from-cyan-500 to-blue-500
                hover:from-cyan-400 hover:to-blue-400
                shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40
                focus:outline-none focus:ring-2 focus:ring-cyan-400/40
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all duration-200"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-gray-400/70 dark:text-white/15 mt-6 font-light">
          © 2025 METpower. All rights reserved.
        </p>
      </div>
    </div>
  );
}