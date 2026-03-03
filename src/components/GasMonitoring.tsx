import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { AlertCircle, TrendingUp, Activity, Thermometer } from 'lucide-react';
import InfoDrawer from './InfoDrawer';
import { DetailDrawerState, GasVisualizationData } from '../types/VisualizationData';
import { createVisualClickHandler, transformChartDataToVisualizationData } from '../utils/visualizationClickHandler';

interface GasReadingData {
  reading_date?: string;
  reading_datetime?: string;
  total_produced?: number;
  avg_produced?: number;
  total_used?: number;
  avg_used?: number;
  total_flared?: number;
  avg_flared?: number;
  avg_pressure?: number;
  avg_temperature?: number;
  gas_volume_produced?: number;
  gas_volume_used?: number;
  gas_volume_flared?: number;
  gas_pressure?: number;
  temperature?: number;
  quality_status?: string;
}

interface GasMonitoringProps {
  onStatusChange?: (status: string) => void;
  onViewSource?: () => void;
}

const GasMonitoring: React.FC<GasMonitoringProps> = ({ onStatusChange, onViewSource }) => {
  const [data, setData] = useState<GasReadingData[]>([]);
  const [isDark, setIsDark] = useState(true);
  const [summary, setSummary] = useState({
    avgProduced: 0,
    avgUsed: 0,
    avgFlared: 0,
    avgPressure: 0,
    avgTemperature: 0,
    latestStatus: 'Good'
  });
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('7days');
  const [error, setError] = useState<string | null>(null);
  
  // Click-to-Detail state
  const [drawerState, setDrawerState] = useState<DetailDrawerState>({
    isOpen: false,
    data: null,
    isFullScreen: false,
    highlightedPoint: undefined
  });

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

  // Detect dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    
    checkDarkMode();
    
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    
    return () => observer.disconnect();
  }, []);

  // Theme configuration
  const theme = {
    dark: {
      bg: 'bg-gradient-to-br from-slate-800 to-slate-900',
      border: 'border-slate-700',
      gridStroke: '#475569',
      axisStroke: '#94a3b8',
      tooltipBg: '#1e293b',
      tooltipBorder: '#475569',
      textColor: '#cbd5e1',
      labelColor: '#94a3b8'
    },
    light: {
      bg: 'bg-gradient-to-br from-gray-50 to-gray-100',
      border: 'border-gray-200',
      gridStroke: '#e5e7eb',
      axisStroke: '#6b7280',
      tooltipBg: '#ffffff',
      tooltipBorder: '#e5e7eb',
      textColor: '#374151',
      labelColor: '#6b7280'
    }
  };

  const currentTheme = isDark ? theme.dark : theme.light;

  // Click-to-Detail handlers
  const handleChartClick = createVisualClickHandler({
    onDetailOpen: (data) => {
      setDrawerState(prev => ({
        ...prev,
        isOpen: true,
        data,
        highlightedPoint: data.sourceId,
      }));
    },
    onHighlight: (pointId) => {
      setDrawerState(prev => ({
        ...prev,
        highlightedPoint: pointId,
      }));
    },
    onViewSource: (sourceId, sourceType) => {
      // Navigate to Activity Log tab
      onViewSource?.();
    }
  });

  const handleChartPointClick = (rawData: GasReadingData, index: number) => {
    const transformedData = transformChartDataToVisualizationData(
      rawData,
      'gas',
      { id: index }
    );
    if (transformedData) {
      handleChartClick(transformedData);
    }
  };

  // Fetch gas monitoring data on mount and when date range changes
  useEffect(() => {
    fetchGasMonitoringData();
  }, [dateRange]);

  const fetchGasMonitoringData = async () => {
    try {
      setLoading(true);
      setError(null);

      const endDate = new Date();
      const startDate = new Date();
      
      switch (dateRange) {
        case '24hours':
          startDate.setDate(startDate.getDate() - 1);
          break;
        case '7days':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30days':
          startDate.setDate(startDate.getDate() - 30);
          break;
      }

      const response = await axios.get(`${API_URL}/analytics/gas-monitoring`, {
        params: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          groupByHour: dateRange === '24hours' ? 'true' : 'false'
        }
      });

      setData(response.data);

      // Calculate summary statistics
      if (response.data.length > 0) {
        const avgProduced = response.data.reduce((sum: number, row: GasReadingData) => 
          sum + (row.avg_produced || row.gas_volume_produced || 0), 0) / response.data.length;
        const avgUsed = response.data.reduce((sum: number, row: GasReadingData) => 
          sum + (row.avg_used || row.gas_volume_used || 0), 0) / response.data.length;
        const avgFlared = response.data.reduce((sum: number, row: GasReadingData) => 
          sum + (row.avg_flared || row.gas_volume_flared || 0), 0) / response.data.length;
        const avgPressure = response.data.reduce((sum: number, row: GasReadingData) => 
          sum + (row.avg_pressure || row.gas_pressure || 0), 0) / response.data.length;
        const avgTemperature = response.data.reduce((sum: number, row: GasReadingData) => 
          sum + (row.avg_temperature || row.temperature || 0), 0) / response.data.length;
        const latestStatus = response.data[0]?.quality_status || 'Good';

        setSummary({
          avgProduced: Math.round(avgProduced),
          avgUsed: Math.round(avgUsed),
          avgFlared: Math.round(avgFlared),
          avgPressure: Math.round(avgPressure * 100) / 100,
          avgTemperature: Math.round(avgTemperature * 10) / 10,
          latestStatus
        });

        onStatusChange?.(latestStatus);
      }

      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch gas monitoring data:', err);
      setError('Failed to load gas monitoring data');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Date Range Selector */}
      <div className="flex justify-between items-center">
        <h2 className={`text-2xl font-bold ${isDark ? 'text-cyan-400' : 'text-blue-600'}`}>Gas Monitoring & Trends</h2>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className={`px-4 py-2 rounded border ${
            isDark 
              ? 'bg-slate-700 text-white border-slate-600 hover:border-cyan-500' 
              : 'bg-white text-gray-900 border-gray-300 hover:border-blue-500'
          }`}
        >
          <option value="24hours">Last 24 Hours</option>
          <option value="7days">Last 7 Days</option>
          <option value="30days">Last 30 Days</option>
        </select>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-200">{error}</span>
        </div>
      )}

      {/* KPI Gauges */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Gas Produced */}
        <div className={`rounded-lg p-4 border transition ${
          isDark 
            ? 'bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 hover:border-cyan-500' 
            : 'bg-gradient-to-br from-green-50 to-emerald-100 border-green-200 hover:border-green-400'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className={`w-4 h-4 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Avg Produced</p>
          </div>
          <p className={`text-2xl font-bold ${isDark ? 'text-green-400' : 'text-green-700'}`}>{summary.avgProduced}</p>
          <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>m³</p>
        </div>

        {/* Gas Used */}
        <div className={`rounded-lg p-4 border transition ${
          isDark 
            ? 'bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 hover:border-cyan-500' 
            : 'bg-gradient-to-br from-blue-50 to-cyan-100 border-blue-200 hover:border-blue-400'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <Activity className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Avg Used</p>
          </div>
          <p className={`text-2xl font-bold ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>{summary.avgUsed}</p>
          <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>m³</p>
        </div>

        {/* Gas Flared */}
        <div className={`rounded-lg p-4 border transition ${
          isDark 
            ? 'bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 hover:border-cyan-500' 
            : 'bg-gradient-to-br from-orange-50 to-amber-100 border-orange-200 hover:border-orange-400'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className={`w-4 h-4 ${isDark ? 'text-orange-400' : 'text-orange-600'}`} />
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Avg Flared</p>
          </div>
          <p className={`text-2xl font-bold ${isDark ? 'text-orange-400' : 'text-orange-700'}`}>{summary.avgFlared}</p>
          <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>m³</p>
        </div>

        {/* Pressure */}
        <div className={`rounded-lg p-4 border transition ${
          isDark 
            ? 'bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 hover:border-cyan-500' 
            : 'bg-gradient-to-br from-purple-50 to-violet-100 border-purple-200 hover:border-purple-400'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <Activity className={`w-4 h-4 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Avg Pressure</p>
          </div>
          <p className={`text-2xl font-bold ${isDark ? 'text-purple-400' : 'text-purple-700'}`}>{summary.avgPressure}</p>
          <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>bar</p>
        </div>

        {/* Temperature */}
        <div className={`rounded-lg p-4 border transition ${
          isDark 
            ? 'bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 hover:border-cyan-500' 
            : 'bg-gradient-to-br from-red-50 to-rose-100 border-red-200 hover:border-red-400'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <Thermometer className={`w-4 h-4 ${isDark ? 'text-red-400' : 'text-red-600'}`} />
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Avg Temp</p>
          </div>
          <p className={`text-2xl font-bold ${isDark ? 'text-red-400' : 'text-red-700'}`}>{summary.avgTemperature}°C</p>
          <p className={`text-xs font-semibold ${summary.latestStatus === 'Good' ? (isDark ? 'text-green-400' : 'text-green-600') : (isDark ? 'text-yellow-400' : 'text-yellow-600')}`}>
            {summary.latestStatus}
          </p>
        </div>
      </div>

      {/* Gas Production vs Usage Chart */}
      <div className={`rounded-lg p-6 border ${
        isDark 
          ? 'bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700' 
          : 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200'
      }`}>
        <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-cyan-400' : 'text-blue-600'}`}>Gas Production vs Usage</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data} onClick={(state) => {
            if (state && state.activeTooltipIndex !== undefined && data[state.activeTooltipIndex]) {
              handleChartPointClick(data[state.activeTooltipIndex], state.activeTooltipIndex);
            }
          }}>
            <defs>
              <linearGradient id="colorProduced" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorUsed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={currentTheme.gridStroke} />
            <XAxis dataKey="reading_date" stroke={currentTheme.axisStroke} cursor="pointer" />
            <YAxis stroke={currentTheme.axisStroke} />
            <Tooltip 
              contentStyle={{ backgroundColor: currentTheme.tooltipBg, border: `1px solid ${currentTheme.tooltipBorder}`, cursor: 'pointer' }}
              labelStyle={{ color: isDark ? '#06b6d4' : '#2563eb' }}
              cursor="pointer"
            />
            <Legend wrapperStyle={{ color: currentTheme.textColor }} />
            <Area 
              type="monotone" 
              dataKey="total_produced" 
              stroke="#10b981" 
              fillOpacity={1} 
              fill="url(#colorProduced)"
              name="Produced (m³)"
            />
            <Area 
              type="monotone" 
              dataKey="total_used" 
              stroke="#3b82f6" 
              fillOpacity={1} 
              fill="url(#colorUsed)"
              name="Used (m³)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Flared Gas Trend */}
      <div className={`rounded-lg p-6 border ${
        isDark 
          ? 'bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700' 
          : 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200'
      }`}>
        <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>Gas Flared Trend</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={currentTheme.gridStroke} />
            <XAxis dataKey="reading_date" stroke={currentTheme.axisStroke} />
            <YAxis stroke={currentTheme.axisStroke} />
            <Tooltip 
              contentStyle={{ backgroundColor: currentTheme.tooltipBg, border: `1px solid ${currentTheme.tooltipBorder}` }}
              labelStyle={{ color: isDark ? '#06b6d4' : '#2563eb' }}
            />
            <Legend wrapperStyle={{ color: currentTheme.textColor }} />
            <Line 
              type="monotone" 
              dataKey="total_flared" 
              stroke={isDark ? '#f97316' : '#ea580c'} 
              dot={false}
              strokeWidth={2}
              name="Flared (m³)"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Pressure & Temperature Trend */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pressure Chart */}
        <div className={`rounded-lg p-6 border ${isDark ? 'bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700' : 'bg-white border-gray-200'}`}>
          <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>Gas Pressure</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke={currentTheme.gridStroke} />
              <XAxis dataKey="reading_date" stroke={currentTheme.axisStroke} />
              <YAxis stroke={currentTheme.axisStroke} />
              <Tooltip 
                contentStyle={{ backgroundColor: currentTheme.tooltipBg, border: `1px solid ${currentTheme.tooltipBorder}` }}
                labelStyle={{ color: isDark ? '#06b6d4' : '#2563eb' }}
              />
              <Line 
                type="monotone" 
                dataKey="avg_pressure" 
                stroke="#a855f7" 
                dot={false}
                strokeWidth={2}
                name="Pressure (bar)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Temperature Chart */}
        <div className={`rounded-lg p-6 border ${isDark ? 'bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700' : 'bg-white border-gray-200'}`}>
          <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-red-400' : 'text-red-600'}`}>Temperature</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke={currentTheme.gridStroke} />
              <XAxis dataKey="reading_date" stroke={currentTheme.axisStroke} />
              <YAxis stroke={currentTheme.axisStroke} />
              <Tooltip 
                contentStyle={{ backgroundColor: currentTheme.tooltipBg, border: `1px solid ${currentTheme.tooltipBorder}` }}
                labelStyle={{ color: isDark ? '#06b6d4' : '#2563eb' }}
              />
              <Line 
                type="monotone" 
                dataKey="avg_temperature" 
                stroke="#ef4444" 
                dot={false}
                strokeWidth={2}
                name="Temperature (°C)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Click-to-Detail Drawer */}
      <InfoDrawer
        isOpen={drawerState.isOpen}
        data={drawerState.data}
        onClose={() => setDrawerState(prev => ({ ...prev, isOpen: false, data: null }))}
        onViewSource={(sourceId, sourceType) => {
          onViewSource?.();
        }}
        isFullScreen={drawerState.isFullScreen}
        onFullScreenToggle={(isFullScreen) =>
          setDrawerState(prev => ({ ...prev, isFullScreen }))
        }
        highlightedPoint={drawerState.highlightedPoint}
      />
    </div>
  );
};

export default GasMonitoring;
