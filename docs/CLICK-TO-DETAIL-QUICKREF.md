# Click-to-Detail Quick Reference

## Copy-Paste Template for Adding Click-to-Detail to a New Visualization Component

### Step 1: Add Imports
```typescript
import InfoDrawer from './InfoDrawer';
import { DetailDrawerState } from '../types/VisualizationData';
import { 
  createVisualClickHandler, 
  transformChartDataToVisualizationData 
} from '../utils/visualizationClickHandler';
```

### Step 2: Initialize State
```typescript
const [drawerState, setDrawerState] = useState<DetailDrawerState>({
  isOpen: false,
  data: null,
  isFullScreen: false,
});
```

### Step 3: Create Handlers
```typescript
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
    setDrawerState(prev => ({ ...prev, highlightedPoint: pointId }));
  },
  onViewSource: (sourceId, sourceType) => {
    // TODO: Implement Activity Log navigation
    console.log(`Navigate to source: ${sourceId} (${sourceType})`);
  }
});

const handleChartPointClick = (rawData: YourDataType, index: number) => {
  const transformedData = transformChartDataToVisualizationData(
    rawData,
    'your_type', // Choose: 'gas' | 'utilities' | 'weight' | 'heatmap' | 'activity'
    { id: index }
  );
  if (transformedData) handleChartClick(transformedData);
};
```

### Step 4: Add Chart onClick
```typescript
<AreaChart
  data={data}
  onClick={(state) => {
    if (state?.activeTooltipIndex !== undefined && data[state.activeTooltipIndex]) {
      handleChartPointClick(data[state.activeTooltipIndex], state.activeTooltipIndex);
    }
  }}
>
  <XAxis cursor="pointer" />
  <Tooltip cursor={{ strokeDasharray: '3 3' }} />
</AreaChart>
```

### Step 5: Add InfoDrawer Component
```typescript
<InfoDrawer
  isOpen={drawerState.isOpen}
  data={drawerState.data}
  onClose={() => setDrawerState(prev => ({ ...prev, isOpen: false }))}
  onViewSource={(sourceId, sourceType) => {
    // Implement navigation to Activity Log
  }}
  isFullScreen={drawerState.isFullScreen}
  onFullScreenToggle={(isFullScreen) => 
    setDrawerState(prev => ({ ...prev, isFullScreen }))
  }
/>
```

---

## Type Reference

### For Gas Monitoring
```typescript
transformChartDataToVisualizationData(
  rawData, 
  'gas',
  { id: index }
)
```
**Expects rawData with:** `reading_date`, `total_produced`, `total_used`, `total_flared`, `avg_pressure`, `avg_temperature`, `quality_status`

### For Plant Utilities
```typescript
transformChartDataToVisualizationData(
  rawData,
  'utilities',
  { id: index }
)
```
**Expects rawData with:** `utility_date`, `electricity_consumption`, `electricity_cost`, `water_consumption`, `water_cost`, `cost_per_ton`

### For Weight Trends
```typescript
transformChartDataToVisualizationData(
  rawData,
  'weight',
  { id: index }
)
```
**Expects rawData with:** `date`, `total_tonnage`, `truck_count`, `busiest_hour`, `hourly_breakdown[]`, `top_suppliers[]`

### For Industrial Heatmap
```typescript
transformChartDataToVisualizationData(
  rawData,
  'heatmap',
  { id: index }
)
```
**Expects rawData with:** `time_block`, `truck_count`, `average_tat`, `safety_alerts[]`

### For Activity Log
```typescript
transformChartDataToVisualizationData(
  rawData,
  'activity',
  { id: index }
)
```
**Expects rawData with:** `id`, `driverName`, `truckPlate`, `status`, `statusHistory[]`, `notes`

---

## Common Patterns

### Handling Different Chart Types
```typescript
// For AreaChart
<AreaChart onClick={(state) => handleChartPointClick(...)}>

// For BarChart
<BarChart onClick={(state) => handleChartPointClick(...)}>

// For LineChart  
<LineChart onClick={(state) => handleChartPointClick(...)}>

// For ScatterChart
<ScatterChart onClick={(state) => handleChartPointClick(...)}>
```

### Custom Highlighting (Future)
```typescript
// In your chart, check drawerState.highlightedPoint
<Area 
  dot={(props) => {
    const isHighlighted = drawerState.highlightedPoint === props.dataKey;
    return (
      <circle
        {...props}
        fill={isHighlighted ? '#ff0000' : '#00ff00'}
        r={isHighlighted ? 8 : 4}
      />
    );
  }}
/>
```

### Activity Log Navigation
```typescript
onViewSource: (sourceId, sourceType) => {
  // Option 1: Navigate using react-router
  navigate(`/activity-log?source=${sourceId}&type=${sourceType}`);
  
  // Option 2: Open in new tab
  window.open(`/activity-log?source=${sourceId}`, '_blank');
  
  // Option 3: Scroll to Activity Log element
  const element = document.getElementById(`activity-${sourceId}`);
  element?.scrollIntoView({ behavior: 'smooth' });
},
```

---

## Testing Checklist

- [ ] Click opens drawer with data
- [ ] Close button closes drawer
- [ ] Full-screen toggle works
- [ ] View Source button appears and is clickable
- [ ] Drawer responds to ESC key
- [ ] Dark/light theme switching works
- [ ] Collapsible sections expand/collapse
- [ ] No TypeScript errors
- [ ] No console warnings (except unused highlightedPoint)

---

## Files Reference

| File | Purpose | Lines |
|------|---------|-------|
| `src/types/VisualizationData.ts` | Type definitions | 75 |
| `src/utils/visualizationClickHandler.ts` | Handlers & transformers | 140 |
| `src/components/InfoDrawer.tsx` | Detail component | 448 |
| `src/components/GasMonitoring.tsx` | ✅ Integrated | - |
| `src/components/PlantUtilities.tsx` | ✅ Integrated | - |
| `src/components/WeightTrends.tsx` | ⏳ To do | - |
| `src/components/IndustrialHeatmap.tsx` | ⏳ To do | - |

---

## API Examples

### Gas Monitoring Click
```json
{
  "type": "gas",
  "timestamp": "2024-03-15T14:32:00Z",
  "source": "sensor_001",
  "sourceId": "gas_reading_12345",
  "produced": 523.45,
  "used": 412.33,
  "flared": 111.12,
  "pressure": 2.34,
  "temperature": 38.2,
  "status": "Good"
}
```

### Utilities Chart Click
```json
{
  "type": "utilities",
  "timestamp": "2024-03-15T00:00:00Z",
  "source": "meter_group_001",
  "sourceId": "utilities_12345",
  "electricity": 15230,
  "electricityCost": 2845.23,
  "water": 823,
  "waterCost": 4920.45,
  "costPerTon": 125.33
}
```

---

## Keyboard Shortcuts (Planned)

| Key | Action |
|-----|--------|
| ESC | Close drawer |
| Ctrl+E | Export detail as PDF |
| Ctrl+B | Bookmark detail view |
| ← / → | Navigate between sections |

---

## Performance Tips

1. **Memoize transformed data** to avoid recalculations
2. **Use virtualization** for very large collapsed sections
3. **Lazy load** full-screen view content
4. **Debounce** highlight updates
5. **Cache** API calls for Activity Log navigation

---

**For detailed documentation, see: `docs/CLICK-TO-DETAIL-FEATURE.md`**
