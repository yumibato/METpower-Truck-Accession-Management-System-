# Database-Driven Dates in Visualizations

**Requirement:** All visualization dates and times must come from the database, never from client-side calculations.

---

## Architecture

### Data Flow

```
SQL Database Tables
    ├─ gas_monitoring [reading_datetime]
    └─ plant_utilities [utility_date]
           ↓
Stored Procedures
    ├─ sp_get_gas_trends (returns: reading_date)
    └─ sp_get_utilities_summary (returns: utility_date)
           ↓
API Endpoints
    ├─ GET /api/analytics/gas-monitoring
    └─ GET /api/analytics/plant-utilities
           ↓
React Components (receive database dates)
    ├─ GasMonitoring (displays reading_date)
    └─ PlantUtilities (displays utility_date)
           ↓
Charts & Drawers (show database dates only)
```

---

## Database Source Truth

### Gas Monitoring

**Source Table:** `gas_monitoring`
**Date Column:** `reading_datetime` (DATETIME)
**API Returns:** `reading_date` (converted to DATE in stored procedure)
**Component Uses:** `reading_date` for chart X-axis, timestamp in drawer

**SQL:**
```sql
CAST([reading_datetime] AS DATE) AS [reading_date]
```

### Plant Utilities

**Source Table:** `plant_utilities`
**Date Column:** `utility_date` (DATE)
**API Returns:** `utility_date` directly
**Component Uses:** `utility_date` for chart X-axis, timestamp in drawer

**SQL:**
```sql
SELECT [utility_date], ...
FROM [dbo].[plant_utilities]
```

---

## Component Implementation

### Data Transformation (visualizationClickHandler.ts)

All dates are required from the database. No client-side fallbacks.

```typescript
// ✅ CORRECT - Date from database only
timestamp: rawData.reading_date,  // Required from DB

// ❌ WRONG - Client-side fallback
timestamp: rawData.reading_date || new Date().toISOString()
```

### Validation in Transformer

Each visualization type validates that date exists:

```typescript
case 'gas':
  if (!rawData.reading_date && !rawData.reading_datetime) {
    console.warn('Gas data missing required reading_date from database');
    return null;  // Reject data without database date
  }
  // Use database date only
  timestamp: rawData.reading_date || rawData.reading_datetime,
```

### Chart Components (GasMonitoring.tsx, PlantUtilities.tsx)

Charts display dates from database records:

```tsx
// XAxis shows dates from database
<XAxis 
  dataKey="reading_date"  // From database recordset
  stroke={currentTheme.axisStroke} 
/>

// Tooltip shows database date
<Tooltip 
  contentStyle={...}
  cursor={{ strokeDasharray: '3 3' }}
/>
```

---

## InfoDrawer Timestamps

Detail drawer displays timestamp from database record:

```tsx
// InfoDrawer receives data.timestamp from database
<div className="px-4 pt-4 pb-2">
  <span className="text-xs text-gray-500 dark:text-gray-400">
    {new Date(data.timestamp).toLocaleString()}
                    ↑
    Format database date for display
  </span>
</div>
```

**Timeline:**
1. Database stores `reading_datetime` or `utility_date`
2. Stored procedure returns as `reading_date` or `utility_date`
3. React component receives via API
4. Transform function validates it exists
5. Component displays using `.toLocaleString()`

---

## Client-Side Date Calculations

⚠️ **Important Distinction:**

**Allowed (for filtering/fetching):**
```typescript
// This is OK - used only to FETCH data, not display
const startDate = new Date();
startDate.setDate(startDate.getDate() - 7);
const response = await axios.get(url, {
  params: { startDate, endDate }  // Request filter only
});
```

**NOT Allowed (for display):**
```typescript
// This is WRONG - don't use client dates for display
timestamp: new Date().toISOString()  // ❌ Use database date instead
```

---

## Verification Checklist

- ✅ Gas Monitoring chart uses `reading_date` (from DB)
- ✅ Plant Utilities chart uses `utility_date` (from DB)
- ✅ InfoDrawer timestamp comes from database record
- ✅ Transformer validates database dates exist
- ✅ No `new Date()` fallbacks in visualization data
- ✅ All date fields in chart data come from API response
- ✅ Console warnings if database date missing

---

## Testing Dates

To verify dates are from database:

### Gas Monitoring
1. Open browser DevTools → Network tab
2. Click Gas Monitoring tab
3. Find request to `/api/analytics/gas-monitoring`
4. Check response: every record has `reading_date` field
5. Chart displays these dates on X-axis
6. Click point → drawer shows same date as database

### Plant Utilities
1. Open browser DevTools → Network tab
2. Click Plant Utilities tab
3. Find request to `/api/analytics/plant-utilities`
4. Check response: every record has `utility_date` field
5. Chart displays these dates on X-axis
6. Click point → drawer shows same date as database

---

## API Response Format Expected

### Gas Data
```json
[
  {
    "reading_date": "2024-03-01",
    "total_produced": 523.45,
    "total_used": 412.33,
    "avg_pressure": 2.34,
    "avg_temperature": 38.2,
    "quality_status": "Good"
  },
  {
    "reading_date": "2024-03-02",
    ...
  }
]
```

### Utilities Data
```json
[
  {
    "utility_date": "2024-03-01",
    "electricity_consumed_kwh": 15230,
    "water_consumption_m3": 823,
    "electricity_cost": 2845.23,
    "water_cost": 4920.45,
    "total_cost": 7765.68,
    "cost_per_ton_produced": 125.33
  }
]
```

---

## Adding New Visualizations

When creating new visualization components:

1. **Ensure table has date column** in database
2. **Include date in stored procedure** result
3. **Return date in API response**
4. **Add validation** in transformer
5. **Use database date only** - no client fallbacks

```typescript
// Template
case 'mytype':
  if (!rawData.database_date_field) {
    console.warn('Data missing date from database');
    return null;
  }
  return {
    type: 'mytype',
    timestamp: rawData.database_date_field,  // From DB only
    // ... other fields
  };
```

---

## Benefits

✅ **Single source of truth** - all dates from database  
✅ **Consistency** - same date shown everywhere (chart → drawer → log)  
✅ **Auditability** - dates match database records exactly  
✅ **Timezone safety** - database handles timezone logic  
✅ **Data integrity** - can't accidentally show future/invalid dates  
✅ **Debugging** - easy to verify data matches database  

---

## Troubleshooting

### "Chart shows no data"
- Check if database has records with dates
- Verify stored procedure returns `reading_date`/`utility_date`
- Confirm API response includes date field

### "Date shows as NaN"
- Database date field is NULL
- API not returning date field
- Transformation function rejected data (check console)

### "Different dates in chart vs drawer"
- Chart using wrong dataKey
- Drawer using different field
- Both should use same database date field

### "Date is in future/past"
- Database date is wrong
- Timezone conversion issue
- Check database [reading_datetime] column directly

---

## Code References

**Files ensuring database-sourced dates:**

- [src/utils/visualizationClickHandler.ts](../src/utils/visualizationClickHandler.ts) - Transformation validation
- [src/components/GasMonitoring.tsx](../src/components/GasMonitoring.tsx) - Gas chart using reading_date
- [src/components/PlantUtilities.tsx](../src/components/PlantUtilities.tsx) - Utilities chart using utility_date
- [src/components/InfoDrawer.tsx](../src/components/InfoDrawer.tsx) - Display database timestamp
- [migration-plant-analytics.sql](../migration-plant-analytics.sql) - Database tables with date columns

---

**Status:** ✅ All visualization dates are database-sourced  
**Last Updated:** March 2, 2026  
**Requirement:** All dates must come from database, never client-side
