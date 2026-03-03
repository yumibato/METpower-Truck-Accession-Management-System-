import React, { useState } from 'react';
import { X, Maximize2, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { VisualizationDataUnion } from '../types/VisualizationData';

interface InfoDrawerProps {
  isOpen: boolean;
  data: VisualizationDataUnion | null;
  onClose: () => void;
  onViewSource?: (sourceId: number, sourceType: string) => void;
  isFullScreen?: boolean;
  onFullScreenToggle?: (isFullScreen: boolean) => void;
  highlightedPoint?: string | number;
}

/**
 * Dynamic detail drawer that renders different content based on visualization data type
 * Supports Gas, Utilities, Weight, Heatmap, and Activity data
 */
const InfoDrawer: React.FC<InfoDrawerProps> = ({
  isOpen,
  data,
  onClose,
  onViewSource,
  isFullScreen = false,
  onFullScreenToggle,
  highlightedPoint,
}) => {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    details: true,
    history: true,
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  if (!isOpen || !data) return null;

  const renderContent = () => {
    switch (data.type) {
      case 'gas':
        return renderGasContent();
      case 'utilities':
        return renderUtilitiesContent();
      case 'weight':
        return renderWeightContent();
      case 'heatmap':
        return renderHeatmapContent();
      case 'activity':
        return renderActivityContent();
      default:
        return <div className="p-4 text-gray-500">Unknown data type</div>;
    }
  };

  const renderGasContent = () => {
    if (data.type !== 'gas') return null;
    const gasData = data;

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            label="Produced"
            value={gasData.produced.toFixed(2)}
            unit="m³"
            color="text-green-500"
          />
          <MetricCard
            label="Used"
            value={gasData.used.toFixed(2)}
            unit="m³"
            color="text-blue-500"
          />
          <MetricCard
            label="Flared"
            value={gasData.flared.toFixed(2)}
            unit="m³"
            color="text-orange-500"
          />
          <MetricCard
            label="Pressure"
            value={gasData.pressure.toFixed(2)}
            unit="bar"
            color="text-purple-500"
          />
        </div>

        <div className="border-t border-gray-200 dark:border-slate-700 pt-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Temperature</span>
            <span className="text-xl font-bold text-red-500">
              {gasData.temperature.toFixed(1)}°C
            </span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div
              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                gasData.status === 'Good'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}
            >
              Status: {gasData.status}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderUtilitiesContent = () => {
    if (data.type !== 'utilities') return null;
    const utilData = data;

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            label="Electricity"
            value={utilData.electricityKwh.toFixed(0)}
            unit="kWh"
            color="text-yellow-500"
          />
          <MetricCard
            label="Water"
            value={utilData.waterM3.toFixed(2)}
            unit="m³"
            color="text-blue-500"
          />
        </div>

        <div className="border-t border-gray-200 dark:border-slate-700 pt-4 space-y-3">
          <CostItem label="Electricity Cost" value={utilData.electricityCost} />
          <CostItem label="Water Cost" value={utilData.waterCost} />
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
            <div className="text-xs text-gray-600 dark:text-gray-400">Total Cost</div>
            <div className="text-2xl font-bold text-blue-600">
              ${utilData.totalCost.toFixed(2)}
            </div>
          </div>
          <div>
            <span className="text-xs font-medium">Cost per Ton: </span>
            <span className="font-semibold text-gray-900 dark:text-white">
              ${utilData.costPerTon.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const renderWeightContent = () => {
    if (data.type !== 'weight') return null;
    const weightData = data;

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            label="Total Tonnage"
            value={weightData.totalTonnage.toFixed(1)}
            unit="tons"
            color="text-blue-500"
          />
          <MetricCard
            label="Trucks"
            value={weightData.truckCount.toString()}
            unit="count"
            color="text-green-500"
          />
        </div>

        <div className="border-t border-gray-200 dark:border-slate-700 pt-4">
          <CollapsibleSection
            title="Busiest Hour Breakdown"
            isExpanded={expandedSections['busiest']}
            onToggle={() => toggleSection('busiest')}
          >
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {weightData.hourlyBreakdown.map((hour, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">{hour.hour}</span>
                  <span className="font-semibold">{hour.tonnage.toFixed(1)} tons</span>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        </div>

        <div className="border-t border-gray-200 dark:border-slate-700 pt-4">
          <CollapsibleSection
            title="Top 3 Suppliers"
            isExpanded={expandedSections['suppliers']}
            onToggle={() => toggleSection('suppliers')}
          >
            <div className="space-y-2">
              {weightData.topSuppliers.map((supplier, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">{idx + 1}. {supplier.name}</span>
                  <span className="font-semibold">{supplier.tonnage.toFixed(1)} tons</span>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        </div>
      </div>
    );
  };

  const renderHeatmapContent = () => {
    if (data.type !== 'heatmap') return null;
    const heatmapData = data;

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            label="Trucks in Yard"
            value={heatmapData.truckCount.toString()}
            unit="count"
            color="text-blue-500"
          />
          <MetricCard
            label="Avg. TAT"
            value={heatmapData.averageTAT.toFixed(0)}
            unit="min"
            color="text-purple-500"
          />
        </div>

        <div className="border-t border-gray-200 dark:border-slate-700 pt-4">
          <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
            Time Block: {heatmapData.timeBlock}
          </div>
        </div>

        {heatmapData.safetyAlerts.length > 0 && (
          <div className="border-t border-gray-200 dark:border-slate-700 pt-4">
            <CollapsibleSection
              title={`Safety Alerts (${heatmapData.safetyAlerts.length})`}
              isExpanded={expandedSections['alerts']}
              onToggle={() => toggleSection('alerts')}
            >
              <div className="space-y-2">
                {heatmapData.safetyAlerts.map((alert, idx) => (
                  <div key={idx} className="text-sm text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded">
                    {alert}
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          </div>
        )}
      </div>
    );
  };

  const renderActivityContent = () => {
    if (data.type !== 'activity') return null;
    const actData = data;

    return (
      <div className="space-y-4">
        <div className="bg-gray-50 dark:bg-slate-700/50 p-3 rounded-lg space-y-2">
          <div>
            <span className="text-xs text-gray-600 dark:text-gray-400">Transaction ID</span>
            <div className="font-semibold">#{actData.transactionId}</div>
          </div>
          <div>
            <span className="text-xs text-gray-600 dark:text-gray-400">Driver</span>
            <div className="font-semibold">{actData.driverName}</div>
          </div>
          <div>
            <span className="text-xs text-gray-600 dark:text-gray-400">Truck Plate</span>
            <div className="font-mono font-semibold">{actData.truckPlate}</div>
          </div>
          <div>
            <span className="text-xs text-gray-600 dark:text-gray-400">Current Status</span>
            <div className="inline-block mt-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded text-xs font-semibold">
              {actData.status}
            </div>
          </div>
        </div>

        {actData.statusHistory.length > 0 && (
          <div className="border-t border-gray-200 dark:border-slate-700 pt-4">
            <CollapsibleSection
              title="Status History"
              isExpanded={expandedSections['history']}
              onToggle={() => toggleSection('history')}
            >
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {actData.statusHistory.map((hist, idx) => (
                  <div key={idx} className="text-xs border-l-2 border-blue-300 pl-3 py-1">
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {hist.status}
                    </div>
                    <div className="text-gray-600 dark:text-gray-400">
                      {new Date(hist.timestamp).toLocaleString()}
                    </div>
                    <div className="text-gray-500 dark:text-gray-500">by {hist.userId}</div>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          </div>
        )}

        {actData.notes && (
          <div className="border-t border-gray-200 dark:border-slate-700 pt-4">
            <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
              Notes
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300">{actData.notes}</p>
          </div>
        )}
      </div>
    );
  };

  const drawerClasses = isFullScreen
    ? 'fixed inset-0 z-50'
    : 'fixed right-0 top-0 h-screen w-96 z-50 shadow-2xl border-l border-gray-200 dark:border-slate-700';

  const containerClasses = `${isFullScreen
    ? 'bg-white dark:bg-midnight-900 w-full h-full'
    : 'bg-white dark:bg-midnight-800 w-full h-full overflow-y-auto'} ${
    highlightedPoint === data?.sourceId ? 'ring-2 ring-blue-500' : ''
  }`;

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div className={drawerClasses}>
        <div className={containerClasses}>
          {/* Header */}
          <div className="sticky top-0 bg-white dark:bg-midnight-800 border-b border-gray-200 dark:border-slate-700 p-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white capitalize">
              {data?.type} Details
            </h2>
            <div className="flex items-center gap-2">
              {data?.sourceId && onViewSource && (
                <button
                  onClick={() => onViewSource(data.sourceId || 0, data.source || 'transaction')}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  title="View in Activity Log"
                >
                  <ExternalLink className="w-4 h-4 text-blue-600" />
                </button>
              )}
              {onFullScreenToggle && (
                <button
                  onClick={() => onFullScreenToggle(!isFullScreen)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  title="Toggle fullscreen"
                >
                  <Maximize2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          </div>

          {/* Timestamp */}
          <div className="px-4 pt-4 pb-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {new Date(data.timestamp).toLocaleString()}
            </span>
          </div>

          {/* Content */}
          <div className="px-4 pb-4">{renderContent()}</div>
        </div>
      </div>
    </>
  );
};

// Helper Components

const MetricCard: React.FC<{
  label: string;
  value: string;
  unit: string;
  color: string;
}> = ({ label, value, unit, color }) => (
  <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3">
    <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">{label}</div>
    <div className={`text-xl font-bold ${color}`}>{value}</div>
    <div className="text-xs text-gray-500 dark:text-gray-400">{unit}</div>
  </div>
);

const CostItem: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="flex justify-between items-center py-2">
    <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
    <span className="font-semibold text-gray-900 dark:text-white">${value.toFixed(2)}</span>
  </div>
);

const CollapsibleSection: React.FC<{
  title: string;
  children: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ title, children, isExpanded, onToggle }) => (
  <div>
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded transition-colors"
    >
      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</span>
      {isExpanded ? (
        <ChevronUp className="w-4 h-4 text-gray-600" />
      ) : (
        <ChevronDown className="w-4 h-4 text-gray-600" />
      )}
    </button>
    {isExpanded && <div className="pl-2">{children}</div>}
  </div>
);

export default InfoDrawer;
