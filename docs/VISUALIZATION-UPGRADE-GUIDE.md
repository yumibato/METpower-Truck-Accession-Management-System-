# Visualization Upgrade Implementation Guide

**Status:** In Progress - Template applied to WeightTrends, remaining 13 components follow this pattern  
**Template Reference:** `src/components/WeightTrends.tsx` (see updated implementation)

---

## System Architecture

### New Files Created
- ✅ `src/components/ChartCard.tsx` — Universal wrapper (100% complete)
- ✅ `src/utils/chartConfig.ts` — Chart configuration utilities (100% complete)
- ✅ **CSS Updates:** `src/index.css` — Chart tokens, animations, card styles (100% complete)

### Template Component
- ✅ `src/components/WeightTrends.tsx` — Reference implementation (complete)

---

## Implementation Pattern

Each of the 14 visualization components follows this update pattern:

### 1. **Imports Update**

Replace old imports with new ones:

```typescript
// OLD
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// NEW
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { ChartCard } from './ChartCard';
import { chartGridConfig, chartXAxisConfig, chartYAxisConfig, chartTooltipConfig, chartTooltipConfigDark, chartLegendConfig } from '../utils/chartConfig';
```

### 2. **Dark Mode Hook**

Add if not already present:

```typescript
function useDarkMode() {
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains('dark')
  );
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('dark'));
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return isDark;
}
```

### 3. **Component Declaration**

Add dark mode state to main component:

```typescript
export default function ChartName() {
  const isDark = useDarkMode();
  // ... rest of state
}
```

### 4. **Recharts Config**

Replace all `<CartesianGrid>`, `<XAxis>`, `<Tooltip>`, `<Legend>` with:

```typescript
<CartesianGrid {...chartGridConfig} />
<XAxis {...chartXAxisConfig} />
<Tooltip {...(isDark ? chartTooltipConfigDark : chartTooltipConfig)} />
<Legend {...chartLegendConfig} />
```

### 5. **Card Wrapper**

Replace old card div wrapper:

```typescript
// OLD
<div className="bg-white dark:bg-midnight-900 rounded-xl border...">
  <div className="px-6 py-4...">
    <h3>Title</h3>
  </div>
  <div className="p-6">{chart}</div>
</div>

// NEW
<ChartCard 
  title="Chart Title"
  toggle={toggle ? { options: [...], onChange: handler, current } : undefined}
>
  {chart}
</ChartCard>
```

### 6. **Gradient Definitions**

Update gradients to use CSS variables:

```typescript
// OLD
<linearGradient id="colorGross" x1="0" y1="0" x2="0" y2="1">
  <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.6} />
  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
</linearGradient>

// NEW
<linearGradient id="gradBlue" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0%" stopColor='var(--chart-blue)' stopOpacity={0.15} />
  <stop offset="100%" stopColor='var(--chart-blue)' stopOpacity={0} />
</linearGradient>
```

### 7. **Color Usage**

Update all hardcoded colors to CSS variables:

```typescript
// OLD
stroke="#3b82f6"
fill="#22C55E"

// NEW
stroke='var(--chart-blue)'
fill='var(--chart-green)'
```

---

## Component-by-Component Checklist

### ✅ 1. WeightTrends (DONE)
- [x] Imports updated
- [x] Dark mode hook added
- [x] ChartCard wrapper applied
- [x] Recharts config applied
- [x] Gradients converted to CSS variables
- [x] Colors updated to variable syntax
- [x] ReferenceLine for selected date highlighting

**File:** `src/components/WeightTrends.tsx`

---

### 2. TransactionVolume
**Type:** Bar Chart  
**Key Changes:**
- Wrap in ChartCard
- Use `chartGridConfig`, `chartXAxisConfig`, `chartTooltipConfig`
- Update bar colors: `fill='var(--chart-blue)'`
- Add dynamic cell colors (busy vs normal days)
- Format: `barCategoryGap="35%"`, `barSize={10}`
- Add peak day annotation pill above top bar

**File:** `src/components/TransactionVolume.tsx`  
**Status:** Pending

---

### 3. ProductDistribution
**Type:** Donut Chart  
**Key Changes:**
- Use ChartCard with toggle (Trips/Weight)
- PieChart with `innerRadius="62%"`, `outerRadius="85%"`
- Update COLORS array to use CSS variables
- Add center label (absolute positioned SVG text)
- Update legend to use inline pills, not box
- Uses `chartLegendConfig`

**File:** `src/components/ProductDistribution.tsx`  
**Status:** Pending

---

### 4. GasMonitoring
**Type:** Composed Chart (Area + Line)  
**Key Changes:**
- Use ChartCard
- ComposedChart with dual Y-axes
- Add gradient fills for area components
- Add StatusIndicator dots (good/warning/critical)
- Pulse animation on warning/critical
- Colors: volumes (area) + pressure/temp (line)

**File:** `src/components/GasMonitoring.tsx`  
**Status:** Pending

---

### 5. PlantUtilities
**Type:** Multi-Chart (Line + Composed)  
**Key Changes:**
- Line chart for cost trend
- Two separate ComposedChart for electricity and water
- Use `chartPalettes.dual` colors
- Add ReferenceLine for average cost-per-ton
- Update bar colors: `fill='var(--chart-blue)'` (electricity), `fill='var(--chart-teal)'` (water)
- Line color: `stroke='var(--chart-pink)'` or `stroke='var(--chart-amber)'`

**File:** `src/components/PlantUtilities.tsx`  
**Status:** Pending

---

### 6. DailyWasteMonitoring
**Type:** Multi-Chart + Custom Gauge  
**Key Changes:**
- Bar chart with stacked substrate types
- Use `chartPalettes.substrate` colors
- Custom SVG gauge (target vs actual)
- Gauge colors: green (≥100%), amber (70–99%), red (<70%)
- Add center percentage display

**File:** `src/components/analytics/DailyWasteMonitoring.tsx`  
**Status:** Pending

---

### 7. HourlyHeatmap
**Type:** Custom SVG Grid  
**Key Changes:**
- 24 hours × 7 days grid
- Use `getHeatmapColor(intensity, isDark)` helper
- Cell size: 28×28px with 3px gap
- Hover: scale(1.2), shadow, tooltip
- Peak cell indicator: outline 2px solid `var(--chart-amber)`
- Row/col labels: 11px, `var(--text-muted)`

**File:** `src/components/analytics/HourlyHeatmap.tsx`  
**Status:** Pending

---

### 8. FleetTracking
**Type:** Stacked Area Chart  
**Key Changes:**
- Two areas: returning (green) + new (blue)
- Gradients: `gradReturn` and `gradNew`
- Use chartGridConfig, chartXAxisConfig
- Stack order: new on top of returning
- Colors: `var(--chart-blue)` and `var(--chart-green)`

**File:** `src/components/analytics/FleetTracking.tsx`  
**Status:** Pending

---

### 9. MonthlyTonnage
**Type:** Multi-Year Bar Chart  
**Key Changes:**
- Use ChartCard with toggle (Weight/Trips)
- 6 years of data, distinct colors
- `barSize: 7px`, `barCategoryGap: "20%"`
- Use `chartPalettes.multiv2` for year colors
- Toggle button styling: `.chart-pill-toggle`

**File:** `src/components/analytics/MonthlyTonnage.tsx`  
**Status:** Pending

---

### 10. TurnaroundTime
**Type:** Area + Reference Line  
**Key Changes:**
- Three areas: avg (solid), min & max (dashed)
- Colors: purple (avg), green (min), red (max)
- ReferenceLine for SLA/target
- Trip count overlay bar (subtle background)
- Gradients for avg line fill

**File:** `src/components/analytics/TurnaroundTime.tsx`  
**Status:** Pending

---

### 11. TopDrivers
**Type:** Ranked Horizontal Bar Chart  
**Key Changes:**
- BarChart with `layout="vertical"`
- Rank badges: "01", "02"... (monospace, left)
- Dynamic bar colors: selected = solid blue, others = 20% opacity
- Value labels: right of bar, 12px/600
- Use chartXAxisConfig, chartYAxisConfig

**File:** `src/components/analytics/TopDrivers.tsx`  
**Status:** Pending

---

### 12. TopVehicles
**Type:** Ranked Bar Chart (Teal variant)  
**Key Changes:**
- Same layout as TopDrivers
- Color theme: teal (`var(--chart-teal)`) instead of blue
- Plot number label: monospace font
- Selection state: hover/click highlight

**File:** `src/components/analytics/TopVehicles.tsx`  
**Status:** Pending

---

### 13. WeightRatio
**Type:** Stacked Bar Chart  
**Key Changes:**
- Three stacks: gross (blue), tare (gray), net (green)
- Net on top with rounded cap `radius={[4,4,0,0]}`
- Use `chartPalettes.weight` colors
- `barSize: 10`
- Legend: inline pills, not box

**File:** `src/components/analytics/WeightRatio.tsx`  
**Status:** Pending

---

### 14. StatusBreakdown
**Type:** Donut Chart  
**Key Changes:**
- Use `chartPalettes.status` colors
- `innerRadius="58%"`, `outerRadius="82%"`
- Center: total count + "Transactions" label
- Status list below (not legend box):
  - Colored dot + name + count + percent pill
  - Percent pill: STATUS_COLORS at 15% opacity

**File:** `src/components/analytics/StatusBreakdown.tsx`  
**Status:** Pending

---

## Global CSS Variables Reference

Available in all components via `var(--chart-*)`:

```css
--chart-blue    /* #2563EB light | #3B82F6 dark */
--chart-green   /* #22C55E light | #4ADE80 dark */
--chart-red     /* #EF4444 light | #F87171 dark */
--chart-pink    /* #EC4899 light | #F472B6 dark */
--chart-amber   /* #F97316 light | #FB923C dark */
--chart-purple  /* #8B5CF6 light | #A78BFA dark */
--chart-teal    /* #14B8A6 light | #2DD4BF dark */
--chart-indigo  /* #6366F1 light | #818CF8 dark */
--grid          /* #F3F4F6 light | #2A2A2A dark */
```

Also use:
```css
var(--bg-card)       /* Card background */
var(--bg-elevated)   /* Tooltip/modal background */
var(--text-primary)  /* Main text */
var(--text-secondary) /* Labels, captions */
var(--text-muted)    /* Disabled, placeholders */
var(--border)        /* Grid lines, dividers */
```

---

## Testing Checklist for Each Component

- [ ] Renders without errors in light mode
- [ ] Renders without errors in dark mode
- [ ] Dark mode toggle (via class) switches colors correctly
- [ ] Chart animates on first render
- [ ] Tooltip appears on hover with correct styling
- [ ] Legend displays correctly (inline pills, not box)
- [ ] Data labels use correct font (DM Sans)
- [ ] Colors match design system (no hardcoded hex)
- [ ] Margins/padding look balanced
- [ ] Responsive on mobile (width 100%)
- [ ] Click interactions work (drill-down, filters)

---

## Automated Migration Script Ideas

For teams wanting to speed up the remaining 13 components:

```bash
# Quick regex replacements (use with caution)
sed -i 's/<CartesianGrid.*/<CartesianGrid {...chartGridConfig} /g' src/components/*.tsx
sed -i 's/<XAxis.*/<XAxis {...chartXAxisConfig} /g' src/components/*.tsx
sed -i 's/<Tooltip.*/<Tooltip {...(isDark ? chartTooltipConfigDark : chartTooltipConfig)} /g' src/components/*.tsx
sed -i 's/stroke="#3b82f6"/stroke="var(--chart-blue)"/g' src/components/*.tsx
sed -i 's/stroke="#22C55E"/stroke="var(--chart-green)"/g' src/components/*.tsx
# ... and so on
```

**Note:** Manual review required after automated changes.

---

## Example: Before & After (TransactionVolume snippet)

### Before
```tsx
<BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
  <XAxis dataKey="transac_date" stroke={axisStroke} tick={{ fill: tickFill, fontSize: 11 }} />
  <Tooltip contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}` }} />
  <Bar dataKey="count" fill="#2563EB" radius={[6, 6, 0, 0]} />
</BarChart>
```

### After
```tsx
<BarChart data={data} margin={{ top: 8, right: 16, left: -20, bottom: 0 }}>
  <CartesianGrid {...chartGridConfig} />
  <XAxis {...chartXAxisConfig} dataKey="transac_date" />
  <Tooltip {...(isDark ? chartTooltipConfigDark : chartTooltipConfig)} />
  <Bar dataKey="count" fill='var(--chart-blue)' radius={[6, 6, 0, 0]}>
    {data.map((entry, i) => (
      <Cell key={i} fill={entry.count > threshold ? 'var(--chart-blue)' : 'rgba(37,99,235,0.25)'} />
    ))}
  </Bar>
</BarChart>
```

---

## Next Steps

1. **Component #2 (TransactionVolume):** Start with bar chart upgrade
2. **Component #3 (ProductDistribution):** Donut chart with toggle
3. **Continue systematically** through all 14 following the pattern above

Each component should be testable in isolation once updated.

---

## Support

- **Reference Implementation:** `src/components/WeightTrends.tsx`
- **Chart Config Utilities:** `src/utils/chartConfig.ts`
- **Component Wrapper:** `src/components/ChartCard.tsx`
- **CSS Variables:** `src/index.css` (search for `.chart-card`)

All tools are in place. Follow the pattern and update the remaining 13 components systematically.
