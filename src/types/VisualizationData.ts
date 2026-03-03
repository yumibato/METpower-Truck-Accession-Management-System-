/**
 * Standardized data object for Click-to-Detail feature
 * Works across all visualization types in the dashboard
 */

export type VisualizationType = 'gas' | 'utilities' | 'weight' | 'heatmap' | 'activity';

export interface BaseVisualizationData {
  type: VisualizationType;
  timestamp: string;
  source?: string; // Reference to source table/log entry
  sourceId?: number; // ID for deep linking
}

// Gas Monitoring Detail
export interface GasVisualizationData extends BaseVisualizationData {
  type: 'gas';
  produced: number; // m³
  used: number; // m³
  flared: number; // m³
  pressure: number; // bar
  temperature: number; // °C
  status: 'Good' | 'Warning';
  date: string;
}

// Plant Utilities Detail
export interface UtilitiesVisualizationData extends BaseVisualizationData {
  type: 'utilities';
  electricityKwh: number;
  waterM3: number;
  electricityCost: number;
  waterCost: number;
  totalCost: number;
  costPerTon: number;
  date: string;
}

// Daily Weight Trends Detail
export interface WeightVisualizationData extends BaseVisualizationData {
  type: 'weight';
  totalTonnage: number;
  busiestHour: string;
  hourlyBreakdown: { hour: string; tonnage: number }[];
  topSuppliers: { name: string; tonnage: number }[];
  date: string;
  truckCount: number;
}

// Industrial Heatmap Detail
export interface HeatmapVisualizationData extends BaseVisualizationData {
  type: 'heatmap';
  truckCount: number;
  averageTAT: number; // minutes
  safetyAlerts: string[];
  timeBlock: string;
  date: string;
}

// Activity Log Detail
export interface ActivityVisualizationData extends BaseVisualizationData {
  type: 'activity';
  transactionId: number;
  driverName: string;
  truckPlate: string;
  status: string;
  statusHistory: { timestamp: string; status: string; userId: string }[];
  notes?: string;
  date?: string;
}

export type VisualizationDataUnion = 
  | GasVisualizationData 
  | UtilitiesVisualizationData 
  | WeightVisualizationData 
  | HeatmapVisualizationData 
  | ActivityVisualizationData;

export interface DetailDrawerState {
  isOpen: boolean;
  data: VisualizationDataUnion | null;
  isFullScreen: boolean;
  highlightedPoint?: string | number;
}
