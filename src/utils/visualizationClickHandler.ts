/**
 * Universal Click Event Handler for all visualizations
 * Standardizes data handling across Gas, Utilities, Weight, Heatmap, and Activity components
 */

import { VisualizationDataUnion } from '../types/VisualizationData';

export interface ClickEventCallbacks {
  onDetailOpen: (data: VisualizationDataUnion) => void;
  onDetailClose?: () => void;
  onHighlight?: (pointId: string | number) => void;
  onViewSource?: (sourceId: number, sourceType: string) => void;
}

/**
 * Central handler for all visualization clicks
 * Ensures consistent behavior and data structure across different chart types
 */
export const createVisualClickHandler = (callbacks: ClickEventCallbacks) => {
  return (data: VisualizationDataUnion) => {
    try {
      // Validate data structure
      if (!data || !data.type) {
        console.warn('Invalid visualization data:', data);
        return;
      }

      // Call the detail open callback
      callbacks.onDetailOpen(data);

      // Highlight the specific point if callback provided
      if (data.sourceId && callbacks.onHighlight) {
        callbacks.onHighlight(data.sourceId);
      }

      // Log interaction for analytics
      console.log(`[ClickToDetail] ${data.type} visualization clicked:`, {
        type: data.type,
        timestamp: data.timestamp,
        sourceId: data.sourceId,
      });
    } catch (error) {
      console.error('Error handling visualization click:', error);
    }
  };
};

/**
 * Handler for 'View Source' navigation to Activity Log
 */
export const createViewSourceHandler = (callbacks: ClickEventCallbacks) => {
  return (sourceId: number, sourceType: string = 'transaction') => {
    if (callbacks.onViewSource) {
      callbacks.onViewSource(sourceId, sourceType);
    }
  };
};

/**
 * Transform raw chart data to standardized visualization data
 * ⚠️ IMPORTANT: All timestamps must come from the database, never client-side generated
 * Used by individual components before calling handleVisualClick
 */
export const transformChartDataToVisualizationData = (
  rawData: any,
  type: string,
  metadata?: Record<string, any>
): VisualizationDataUnion | null => {
  try {
    switch (type) {
      case 'gas':
        // Database returns reading_date (from stored procedure sp_get_gas_trends)
        // IMPORTANT: reading_date is sourced from transac.transac_date (transaction date), not gas_monitoring.reading_datetime
        if (!rawData.reading_date && !rawData.reading_datetime) {
          console.warn('Gas data missing required reading_date (from transac_date) from database');
          return null;
        }
        return {
          type: 'gas',
          timestamp: rawData.reading_date || rawData.reading_datetime, // From database only
          produced: rawData.total_produced || rawData.avg_produced || 0,
          used: rawData.total_used || rawData.avg_used || 0,
          flared: rawData.total_flared || rawData.avg_flared || 0,
          pressure: rawData.avg_pressure || 0,
          temperature: rawData.avg_temperature || 0,
          status: rawData.quality_status || 'Good',
          date: rawData.reading_date || rawData.reading_datetime, // From database only
          source: 'gas_monitoring',
          sourceId: metadata?.id,
        };

      case 'utilities':
        // Database returns utility_date (from stored procedure sp_get_utilities_summary)
        // IMPORTANT: utility_date is sourced from transac.transac_date (transaction date), not plant_utilities.utility_date
        if (!rawData.utility_date) {
          console.warn('Utilities data missing required utility_date (from transac_date) from database');
          return null;
        }
        return {
          type: 'utilities',
          timestamp: rawData.utility_date, // From database only
          electricityKwh: rawData.electricity_consumed_kwh || 0,
          waterM3: rawData.water_consumption_m3 || 0,
          electricityCost: rawData.electricity_cost || 0,
          waterCost: rawData.water_cost || 0,
          totalCost: rawData.total_cost || 0,
          costPerTon: rawData.cost_per_ton_produced || 0,
          date: rawData.utility_date, // From database only
          source: 'plant_utilities',
          sourceId: metadata?.id,
        };

      case 'weight':
        // Must receive date from database
        if (!rawData.date) {
          console.warn('Weight data missing required date from database');
          return null;
        }
        return {
          type: 'weight',
          timestamp: rawData.date, // From database only
          totalTonnage: rawData.total_tonnage || 0,
          busiestHour: rawData.busiest_hour || '00:00',
          hourlyBreakdown: rawData.hourly_breakdown || [],
          topSuppliers: rawData.top_suppliers || [],
          truckCount: rawData.truck_count || 0,
          date: rawData.date, // From database only
          source: 'weight_trends',
          sourceId: metadata?.id,
        };

      case 'heatmap':
        // Must receive date from database
        if (!rawData.date && !rawData.time_block) {
          console.warn('Heatmap data missing required date or time_block from database');
          return null;
        }
        return {
          type: 'heatmap',
          timestamp: rawData.date || rawData.time_block, // From database only
          truckCount: rawData.truck_count || 0,
          averageTAT: rawData.average_tat || 0,
          safetyAlerts: rawData.safety_alerts || [],
          timeBlock: rawData.time_block || '00:00-01:00',
          date: rawData.date || rawData.time_block, // From database only
          source: 'heatmap',
          sourceId: metadata?.id,
        };

      case 'activity':
        // Must receive timestamp from database
        if (!rawData.timestamp) {
          console.warn('Activity data missing required timestamp from database');
          return null;
        }
        return {
          type: 'activity',
          timestamp: rawData.timestamp, // From database only
          transactionId: rawData.id || rawData.transactionId || 0,
          driverName: rawData.driver_name || rawData.driverName || 'Unknown',
          truckPlate: rawData.truck_plate || rawData.truckPlate || 'N/A',
          status: rawData.status || 'Pending',
          statusHistory: rawData.status_history || [],
          notes: rawData.notes,
          date: rawData.date || rawData.timestamp, // From database only
          source: 'activity_log',
          sourceId: rawData.id || rawData.transactionId,
        };

      default:
        console.warn(`Unknown visualization type: ${type}`);
        return null;
    }
  } catch (error) {
    console.error('Error transforming chart data:', error);
    return null;
  }
};
