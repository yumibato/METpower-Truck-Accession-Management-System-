import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LineChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from 'recharts';
import { AlertCircle, DollarSign, Zap, Droplet, TrendingDown } from 'lucide-react';
import InfoDrawer from './InfoDrawer';
import { ChartCard } from './ChartCard';
import { chartGridConfig, chartXAxisConfig, chartTooltipConfig, chartTooltipConfigDark } from '../utils/chartConfig';
import { DetailDrawerState, UtilitiesVisualizationData } from '../types/VisualizationData';
import { createVisualClickHandler, transformChartDataToVisualizationData } from '../utils/visualizationClickHandler';

interface UtilityData {
  utility_date: string;
  electricity_consumed_kwh: number;
  water_consumption_m3: number;
  electricity_cost: number;
  water_cost: number;
  total_cost: number;
  cost_per_ton_produced: number;
  total_utility_cost?: number;
}

interface UtilitySummary {
  totalElectricityKwh: number;
  totalWaterM3: number;
  totalCost: number;
  averageDailyCost: number;
  averageCostPerTon: number;
  highestDailyCost: number;
  lowestDailyCost: number;
  recordCount: number;
}

interface PlantUtilitiesProps {
  onDataUpdate?: (summary: UtilitySummary) => void;
  onViewSource?: () => void;
}

const PlantUtilities: React.FC<PlantUtilitiesProps> = ({ onDataUpdate, onViewSource }) => {
  const [data, setData] = useState<UtilityData[]>([]);
  const [isDark, setIsDark] = useState(true);
  const [summary, setSummary] = useState<UtilitySummary>({
    totalElectricityKwh: 0,
    totalWaterM3: 0,
    totalCost: 0,
    averageDailyCost: 0,
    averageCostPerTon: 0,
    highestDailyCost: 0,
    lowestDailyCost: 0,
    recordCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30days');
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

  // Theme configuration - simplified with CSS variables
  const theme = {
    dark: {
      bg: 'bg-gradient-to-br from-slate-800 to-slate-900',
      border: 'border-slate-700',
      gridStroke: 'var(--grid)',
      axisStroke: '#94a3b8',
      tooltipBg: 'var(--bg-elevated)',
      tooltipBorder: 'var(--border)',
      textColor: '#cbd5e1',
      labelColor: '#94a3b8'
    },
    light: {
      bg: 'bg-gradient-to-br from-gray-50 to-gray-100',
      border: 'border-gray-200',
      gridStroke: 'var(--grid)',
      axisStroke: '#6b7280',
      tooltipBg: 'var(--bg-elevated)',
      tooltipBorder: 'var(--border)',
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

  const handleChartPointClick = (rawData: UtilityData, index: number) => {
    const transformedData = transformChartDataToVisualizationData(
      rawData,
      'utilities',
      { id: index }
    );
    if (transformedData) {
      handleChartClick(transformedData);
    }
  };

  useEffect(() => {
    fetchUtilitiesData();
  }, [dateRange]);

  const fetchUtilitiesData = async () => {
    try {
      setLoading(true);
      setError(null);

      const endDate = new Date();
      const startDate = new Date();
      
      switch (dateRange) {
        case '7days':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30days':
          startDate.setDate(startDate.getDate() - 30);
          break;
        case '90days':
          startDate.setDate(startDate.getDate() - 90);
          break;
        case '180days':
          startDate.setDate(startDate.getDate() - 180);
          break;
      }

      // Fetch detailed data
      const dataResponse = await axios.get(`${API_URL}/analytics/plant-utilities`, {
        params: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        }
      });

      setData(dataResponse.data);

      // Fetch summary
      const summaryResponse = await axios.get(`${API_URL}/analytics/plant-utilities/summary`);
      setSummary(summaryResponse.data);
      onDataUpdate?.(summaryResponse.data);

      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch utilities data:', err);
      setError('Failed to load utilities data');
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
        <h2 className={`text-2xl font-bold ${isDark ? 'text-cyan-400' : 'text-blue-600'}`}>Plant Utilities & Cost Analysis</h2>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className={`px-4 py-2 rounded border ${isDark ? 'bg-slate-700 text-white border-slate-600 hover:border-cyan-500' : 'bg-white text-gray-900 border-gray-300 hover:border-blue-500'}`}
        >
          <option value="7days">Last 7 Days</option>
          <option value="30days">Last 30 Days</option>
          <option value="90days">Last 90 Days</option>
          <option value="180days">Last 6 Months</option>
        </select>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-200">{error}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Cost */}
        <div className={`rounded-lg p-4 border transition ${
          isDark 
            ? 'bg-gradient-to-br from-red-900/30 to-slate-900 border-red-700/50 hover:border-red-500' 
            : 'bg-gradient-to-br from-red-50 to-rose-100 border-red-200 hover:border-red-400'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className={`w-5 h-5 ${isDark ? 'text-red-400' : 'text-red-600'}`} />
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Total Cost</p>
          </div>
          <p className={`text-3xl font-bold ${isDark ? 'text-red-400' : 'text-red-700'}`}>₱{summary.totalCost.toLocaleString('en-US', {maximumFractionDigits: 0})}</p>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>{summary.recordCount} days</p>
        </div>

        {/* Electricity */}
        <div className={`rounded-lg p-4 border transition ${
          isDark 
            ? 'bg-gradient-to-br from-yellow-900/30 to-slate-900 border-yellow-700/50 hover:border-yellow-500' 
            : 'bg-gradient-to-br from-yellow-50 to-amber-100 border-yellow-200 hover:border-yellow-400'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <Zap className={`w-5 h-5 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`} />
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Electricity</p>
          </div>
          <p className={`text-3xl font-bold ${isDark ? 'text-yellow-400' : 'text-yellow-700'}`}>{summary.totalElectricityKwh.toLocaleString('en-US', {maximumFractionDigits: 0})}</p>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>kWh</p>
        </div>

        {/* Water */}
        <div className={`rounded-lg p-4 border transition ${
          isDark 
            ? 'bg-gradient-to-br from-blue-900/30 to-slate-900 border-blue-700/50 hover:border-blue-500' 
            : 'bg-gradient-to-br from-blue-50 to-cyan-100 border-blue-200 hover:border-blue-400'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <Droplet className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Water</p>
          </div>
          <p className={`text-3xl font-bold ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>{summary.totalWaterM3.toLocaleString('en-US', {maximumFractionDigits: 0})}</p>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>m³</p>
        </div>

        {/* Avg Cost Per Ton */}
        <div className={`rounded-lg p-4 border transition ${
          isDark 
            ? 'bg-gradient-to-br from-purple-900/30 to-slate-900 border-purple-700/50 hover:border-purple-500' 
            : 'bg-gradient-to-br from-purple-50 to-violet-100 border-purple-200 hover:border-purple-400'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className={`w-5 h-5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Cost/Ton</p>
          </div>
          <p className={`text-3xl font-bold ${isDark ? 'text-purple-400' : 'text-purple-700'}`}>₱{typeof summary.averageCostPerTon === 'number' ? summary.averageCostPerTon.toFixed(2) : '0.00'}</p>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>avg daily</p>
        </div>
      </div>

      {/* Cost Trend Chart */}
      <ChartCard title="Daily Cost Trend">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} onClick={(state) => {
            if (state && state.activeTooltipIndex !== undefined && data[state.activeTooltipIndex]) {
              handleChartPointClick(data[state.activeTooltipIndex], state.activeTooltipIndex);
            }
          }}>
            <CartesianGrid {...chartGridConfig} />
            <XAxis {...chartXAxisConfig} dataKey="utility_date" />
            <YAxis hide />
            <Tooltip 
              {...(isDark ? chartTooltipConfigDark : chartTooltipConfig)}
              formatter={(value) => [`₱${typeof value === 'number' ? value.toFixed(2) : value}`, 'Cost']}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="total_cost" 
              stroke='var(--chart-red)' 
              dot={false}
              strokeWidth={2}
              name="Total Cost"
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Electricity vs Water Cost */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cost Breakdown */}
        <ChartCard title="Electricity vs Water Cost">
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={data}>
              <CartesianGrid {...chartGridConfig} />
              <XAxis {...chartXAxisConfig} dataKey="utility_date" />
              <YAxis hide />
              <Tooltip 
                {...(isDark ? chartTooltipConfigDark : chartTooltipConfig)}
                formatter={(value) => `₱${typeof value === 'number' ? value.toFixed(2) : value}`}
              />
              <Legend />
              <Bar dataKey="electricity_cost" fill='var(--chart-amber)' name="Electricity" />
              <Bar dataKey="water_cost" fill='var(--chart-blue)' name="Water" />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Consumption Trend */}
        <ChartCard title="Resource Consumption">
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={data}>
              <CartesianGrid {...chartGridConfig} />
              <XAxis {...chartXAxisConfig} dataKey="utility_date" />
              <YAxis yAxisId="left" hide />
              <YAxis yAxisId="right" orientation="right" hide />
              <Tooltip 
                {...(isDark ? chartTooltipConfigDark : chartTooltipConfig)}
              />
              <Legend />
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="electricity_consumed_kwh" 
                stroke='var(--chart-amber)'
                name="Electricity (kWh)"
                strokeWidth={2}
              />
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="water_consumption_m3" 
                stroke='var(--chart-blue)'
                name="Water (m³)"
                strokeWidth={2}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Cost Summary Statistics */}
      <div className={`rounded-lg p-6 border ${
        isDark 
          ? 'bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700' 
          : 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200'
      }`}>
        <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-cyan-400' : 'text-blue-600'}`}>Cost Statistics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className={`rounded p-4 ${
            isDark ? 'bg-slate-700/50' : 'bg-white/80'
          }`}>
            <p className={`text-xs mb-2 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Average Daily Cost</p>
            <p className={`text-2xl font-bold ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>${typeof summary.averageDailyCost === 'number' ? summary.averageDailyCost.toFixed(2) : '0.00'}</p>
          </div>
          <div className={`rounded p-4 ${
            isDark ? 'bg-slate-700/50' : 'bg-white/80'
          }`}>
            <p className={`text-xs mb-2 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Highest Daily Cost</p>
            <p className={`text-2xl font-bold ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>${typeof summary.highestDailyCost === 'number' ? summary.highestDailyCost.toFixed(2) : '0.00'}</p>
          </div>
          <div className={`rounded p-4 ${
            isDark ? 'bg-slate-700/50' : 'bg-white/80'
          }`}>
            <p className={`text-xs mb-2 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Lowest Daily Cost</p>
            <p className={`text-2xl font-bold ${isDark ? 'text-green-400' : 'text-green-600'}`}>${typeof summary.lowestDailyCost === 'number' ? summary.lowestDailyCost.toFixed(2) : '0.00'}</p>
          </div>
          <div className={`rounded p-4 ${
            isDark ? 'bg-slate-700/50' : 'bg-white/80'
          }`}>
            <p className={`text-xs mb-2 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Cost Range</p>
            <p className={`text-2xl font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
              ${typeof summary.highestDailyCost === 'number' && typeof summary.lowestDailyCost === 'number' ? (summary.highestDailyCost - summary.lowestDailyCost).toFixed(2) : '0.00'}
            </p>
          </div>
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

export default PlantUtilities;
