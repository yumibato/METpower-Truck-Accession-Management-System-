import React, { useState } from 'react';
import { BarChart3, Zap, Droplet, TrendingUp } from 'lucide-react';
import GasMonitoring from './GasMonitoring';
import PlantUtilities from './PlantUtilities';

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

const AnalyticsDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'gas' | 'utilities'>('gas');
  const [gasStatus, setGasStatus] = useState('Good');
  const [utilitySummary, setUtilitySummary] = useState<UtilitySummary | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 border-b border-slate-700 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <BarChart3 className="w-8 h-8 text-cyan-400" />
            <h1 className="text-3xl font-bold text-white">Plant Analytics Dashboard</h1>
          </div>
          <p className="text-slate-400">Real-time monitoring and cost analysis for plant operations</p>
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Gas Status */}
            <div className="flex items-center gap-3 bg-slate-700/50 rounded-lg p-4">
              <div className={`w-3 h-3 rounded-full ${gasStatus === 'Good' ? 'bg-green-400' : 'bg-yellow-400'}`}></div>
              <div>
                <p className="text-xs text-slate-400">Gas System Status</p>
                <p className="text-sm font-semibold text-white">{gasStatus}</p>
              </div>
            </div>

            {/* Cost Summary */}
            {utilitySummary && (
              <>
                <div className="flex items-center gap-3 bg-slate-700/50 rounded-lg p-4">
                  <TrendingUp className="w-5 h-5 text-cyan-400" />
                  <div>
                    <p className="text-xs text-slate-400">Total Cost (30d)</p>
                    <p className="text-sm font-semibold text-cyan-400">${utilitySummary.totalCost.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-slate-700/50 rounded-lg p-4">
                  <Zap className="w-5 h-5 text-yellow-400" />
                  <div>
                    <p className="text-xs text-slate-400">Avg Daily Cost</p>
                    <p className="text-sm font-semibold text-yellow-400">${parseFloat(String(utilitySummary.averageDailyCost)).toFixed(2)}</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-slate-800 border-b border-slate-700 px-6">
        <div className="max-w-7xl mx-auto flex gap-2">
          <button
            onClick={() => setActiveTab('gas')}
            className={`px-6 py-4 font-medium border-b-2 transition ${
              activeTab === 'gas'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Gas Monitoring
            </div>
          </button>
          <button
            onClick={() => setActiveTab('utilities')}
            className={`px-6 py-4 font-medium border-b-2 transition ${
              activeTab === 'utilities'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <Droplet className="w-4 h-4" />
              Utilities & Costs
            </div>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto p-6">
        {activeTab === 'gas' ? (
          <GasMonitoring onStatusChange={setGasStatus} />
        ) : (
          <PlantUtilities onDataUpdate={setUtilitySummary} />
        )}
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
