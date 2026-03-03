# Click-to-Detail Feature Documentation

## Overview

The **Click-to-Detail** feature is a comprehensive, unified interaction pattern across all visualizations in the METPower Admin Dashboard. When users click on any data point in charts, they instantly receive detailed context through a dynamic side-drawer that adapts to the data type.

## Architecture

### 1. **Core Components**

#### **VisualizationData.ts** (`src/types/VisualizationData.ts`)
Standardized TypeScript interfaces for all visualization data types:
- `BaseVisualizationData` - Common properties (timestamp, source, sourceId)
- `GasVisualizationData` - Gas monitoring details (m³, pressure, temperature, status)
- `UtilitiesVisualizationData` - Energy/water costs and consumption
- `WeightVisualizationData` - Daily tonnage, hour breakdowns, supplier rankings
- `HeatmapVisualizationData` - Yard occupancy, TAT, safety alerts
- `ActivityVisualizationData` - Transaction history and status changes

#### **visualizationClickHandler.ts** (`src/utils/visualizationClickHandler.ts`)
Universal event handling utilities:
- `createVisualClickHandler()` - Factory function creating consistent click handlers
- `transformChartDataToVisualizationData()` - Converts raw chart data to standardized format
- `createViewSourceHandler()` - Handles navigation to Activity Log

#### **InfoDrawer.tsx** (`src/components/InfoDrawer.tsx`)
Dynamic detail panel that renders different content based on data type:
- Responsive right-side drawer (desktop) / full-screen (mobile)
- Collapsible sections for expanded content
- "View Source" button for Activity Log navigation
- Full-screen toggle for expanded report view
- Dark/light theme support

### 2. **Data Flow**

```
User Clicks Chart
    ↓
handleChartPointClick(rawData)
    ↓
transformChartDataToVisualizationData(rawData, type)
    ↓
handleChartClick(transformedData)
    ↓
setDrawerState({ isOpen: true, data: transformedData })
    ↓
<InfoDrawer /> renders appropriate content
```

## Integration Guide

### For GasMonitoring Component

```typescript
// 1. Import utilities
import InfoDrawer from './InfoDrawer';
import { DetailDrawerState, GasVisualizationData } from '../types/VisualizationData';
import { 
  createVisualClickHandler, 
  transformChartDataToVisualizationData 
} from '../utils/visualizationClickHandler';

// 2. Initialize drawer state
const [drawerState, setDrawerState] = useState<DetailDrawerState>({
  isOpen: false,
  data: null,
  isFullScreen: false,
});

// 3. Create click handlers
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
    // Visual feedback when viewing detail
  },
  onViewSource: (sourceId, sourceType) => {
    // Navigate to Activity Log
  }
});

// 4. Transform and trigger on chart click
const handleChartPointClick = (rawData: GasReadingData, index: number) => {
  const transformedData = transformChartDataToVisualizationData(
    rawData,
    'gas',
    { id: index }
  );
  if (transformedData) handleChartClick(transformedData);
};

// 5. Add onClick to chart
<AreaChart 
  data={data} 
  onClick={(state) => {
    if (state?.activeTooltipIndex !== undefined) {
      handleChartPointClick(data[state.activeTooltipIndex], state.activeTooltipIndex);
    }
  }}
>

// 6. Include InfoDrawer in JSX
<InfoDrawer
  isOpen={drawerState.isOpen}
  data={drawerState.data}
  onClose={() => setDrawerState(prev => ({ ...prev, isOpen: false }))}
  onViewSource={(sourceId, sourceType) => {
    // Handle navigation
  }}
  isFullScreen={drawerState.isFullScreen}
  onFullScreenToggle={(isFullScreen) => 
    setDrawerState(prev => ({ ...prev, isFullScreen }))
  }
/>
```

## Data Mapping

### Gas Monitoring Chart Click
**Source:** `GasMonitoring.tsx` Area/Line charts

**Details Displayed:**
- **Produced:** Total/avg gas produced (m³) in green
- **Used:** Total/avg gas used (m³) in blue  
- **Flared:** Total/avg gas flared (m³) in orange
- **Pressure:** Average pressure in bar (purple)
- **Temperature:** Average temperature in °C (red)
- **Status:** 'Good' or 'Warning' badge

### Plant Utilities Chart Click
**Source:** `PlantUtilities.tsx` Line/Bar charts

**Details Displayed:**
- **Electricity:** Consumption (kWh) and cost
- **Water:** Consumption (m³) and cost
- **Total Cost:** Daily cost in highlighted box
- **Cost Per Ton:** Efficiency metric

### Weight Trends Chart Click
**Source:** Future `WeightTrends.tsx`

**Details Displayed:**
- **Total Tonnage:** Day's total in tons
- **Truck Count:** Number of trucks processed
- **Busiest Hour:** Collapsible breakdown by hour
- **Top 3 Suppliers:** Ranked by tonnage delivered

### Industrial Heatmap Click
**Source:** Future `IndustrialHeatmap.tsx`

**Details Displayed:**
- **Trucks in Yard:** Current occupancy
- **Avg TAT:** Average turnaround time (minutes)
- **Time Block:** Selected hour/period
- **Safety Alerts:** Collapsible list of incidents

### Activity Log Click
**Source:** Future Activity Log integration

**Details Displayed:**
- **Transaction ID:** Reference number
- **Driver:** Driver name
- **Truck Plate:** Vehicle identifier
- **Current Status:** Badge showing state
- **Status History:** Collapsible timeline of changes
- **Notes:** Optional transaction notes

## Implementation Checklist

- [x] Create `VisualizationData.ts` with TypeScript interfaces
- [x] Create `visualizationClickHandler.ts` with utilities
- [x] Create `InfoDrawer.tsx` with dynamic rendering
- [x] Integrate into `GasMonitoring.tsx`
- [x] Integrate into `PlantUtilities.tsx`
- [ ] Integrate into `TransactionTable.tsx` (Activity Log)
- [ ] Create `WeightTrends.tsx` component with integration
- [ ] Create `IndustrialHeatmap.tsx` component with integration
- [ ] Add Activity Log navigation routing
- [ ] Add visual highlight effect to clicked data points
- [ ] Add keyboard shortcuts (ESC to close drawer)
- [ ] Add analytics tracking for click events

## Usage Examples

### Investigating Gas Production Drop

1. User notices a dip in the "Gas Production vs Usage" area chart
2. Clicks on that point
3. InfoDrawer opens showing:
   - Produced: 523.45 m³
   - Used: 412.33 m³  
   - Pressure: 2.34 bar (possibly indicating maintenance event)
   - Temperature: 38.2°C
   - Status: Good
4. Clicks "View Source" 
5. Navigates to Activity Log showing sensor readings from that timestamp

### Analyzing Cost Anomaly

1. User spots unexpected spike in "Daily Cost Trend" chart
2. Clicks on that date
3. InfoDrawer displays:
   - Electricity: 15,230 kWh ($2,845.23)
   - Water: 823 m³ ($4,920.45) ← Higher than average
   - Total Cost: $7,765.68
4. Can then view source transaction to identify cause

## Keyboard Navigation

- **ESC** - Close info drawer
- **↑** - Collapse/expand sections within drawer
- **→** - Open full-screen view

## Styling & Theming

All drawer components support dark/light mode:
- **Dark Mode:** Slate backgrounds with cyan accents
- **Light Mode:** Light gray backgrounds with blue accents

Colors are dynamically applied via `isDark` state and theme objects.

## Future Enhancements

1. **Export Details** - Export drawer content as PDF/CSV
2. **Bookmarking** - Save important detail views
3. **Comparisons** - Compare two data points side-by-side
4. **Annotations** - Add notes to specific data points
5. **Alert Rules** - Create rules triggered by detail patterns
6. **Mobile Optimization** - Full-screen drawer behavior on mobile devices

## Troubleshooting

### Drawer doesn't open when clicking chart
- Ensure chart has `onClick` handler attached to `ResponsiveContainer`
- Check that `handleChartPointClick` is being called
- Verify `transformChartDataToVisualizationData` returns non-null value

### Info shows incorrect data type
- Verify `type` parameter passed to `transformChartDataToVisualizationData` matches data source
- Check TypeScript interface matches raw data structure  
- Look for typos in data property mappings

### Visual highlighting not working
- Set `highlightedPoint` in drawer state
- Create hover/highlight CSS classes on chart points
- Use Recharts' `activeIndex` prop to match state

---

**Last Updated:** March 2, 2026  
**Version:** 1.0 (MVP)
