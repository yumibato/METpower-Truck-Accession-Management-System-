# Click-to-Detail Feature - Testing Guide

## Pre-Test Checklist

- [ ] Application builds successfully (`npm run build`)
- [ ] No TypeScript compilation errors (`npm run lint`)
- [ ] Development server starts (`npm run dev`)
- [ ] Database contains sample data in `gas_monitoring` and `plant_utilities` tables
- [ ] Browser DevTools Console is open to check for warnings

## Test Suite 1: Gas Monitoring Visualization

### Test 1.1: Open Gas Monitoring Component
1. Start application: `npm run dev`
2. Navigate to Dashboard (if not default)
3. Scroll to "Gas Production & Usage Over Time" chart
4. **Expected:** Area chart displays with multiple colored areas (produced/used/flared gas)

### Test 1.2: Click on Chart Point
1. Hover over any point on the area chart
2. Observe cursor changes to pointer
3. Click on a visible data point
4. **Expected:** 
   - Info drawer slides in from right side
   - Drawer shows "gas Details" in header
   - Timestamp displays below header
   - Four metric cards show: Produced, Used, Flared, Pressure

### Test 1.3: Verify Gas Data Display
1. In open drawer, examine metric cards:
   - Produced: value in m³ (green color)
   - Used: value in m³ (blue color)
   - Flared: value in m³ (orange color)
   - Pressure: value in bar (purple color)
2. Scroll down to see:
   - Temperature: value in °C
   - Status: Badge showing "Good" or "Warning"
3. **Expected:** All values are numbers > 0, status is valid

### Test 1.4: Test Drawer Controls
1. Click "X" button in drawer header
   - **Expected:** Drawer closes, overlay disappears
2. Click chart again to reopen
3. Click overlay (semi-transparent area)
   - **Expected:** Drawer closes
4. Click chart again to reopen
5. Click fullscreen icon (arrow)
   - **Expected:** Drawer expands to full screen
6. Click fullscreen icon again
   - **Expected:** Drawer returns to side panel

### Test 1.5: Test View Source Button
1. With drawer open, look for "View Source" button (external link icon)
2. Click the button
3. **Expected:** 
   - Button is clickable
   - Console logs navigation intent (since Activity Log not yet integrated)
   - In future: navigates to Activity Log with source data

## Test Suite 2: Plant Utilities Visualization

### Test 2.1: Open Plant Utilities Component
1. Ensure Gas Monitoring is visible
2. Scroll down to "Daily Cost Trend" chart
3. **Expected:** Line chart displays with cost data over dates

### Test 2.2: Click on Chart Point
1. Hover over any point on the line chart
2. Observe cursor changes to pointer
3. Click on a data point
4. **Expected:**
   - Info drawer opens from right
   - Drawer shows "utilities Details"
   - Timestamp displays

### Test 2.3: Verify Utilities Data Display
1. Examine drawer content:
   - Two metric cards: Electricity (kWh), Water (m³)
   - Cost breakdown section showing:
     - Electricity Cost
     - Water Cost
   - Highlighted "Total Cost" box
   - Cost per Ton metric at bottom
2. **Expected:**
   - Electricity > 0 kWh
   - Water > 0 m³
   - All costs > 0 USD
   - Cost per Ton is reasonable value

### Test 2.4: Test Drawer Interactions
1. Click fullscreen button
   - **Expected:** Drawer expands to full screen
2. Notice the drawer content reorganizes
3. Click fullscreen button again
   - **Expected:** Returns to side panel

## Test Suite 3: Dark/Light Mode

### Test 3.1: Toggle Theme
1. Open drawer with chart data visible
2. Click theme toggle (usually in header/settings)
3. **Expected:**
   - Drawer background changes to dark colors
   - Text becomes light colored
   - Metric cards background changes
   - All content remains readable

### Test 3.2: Dark Mode Specific Elements
1. In dark mode, verify:
   - Header background is dark slate
   - Text is white/light gray
   - Borders are visible (lighter gray)
   - Buttons maintain contrast
   - Color badges (green/orange/blue) still visible
2. **Expected:** No content lost, all readable

## Test Suite 4: Responsive Behavior

### Test 4.1: Desktop View (>1024px)
1. Ensure window width > 1024px
2. Click chart point
3. **Expected:**
   - Drawer appears on right side
   - Width is ~384px (w-96)
   - Content visible without scrolling small dataset
   - Click overlay to close works

### Test 4.2: Tablet View (768px-1024px)
1. Resize to 900px width
2. Click chart point
3. **Expected:**
   - Drawer still appears on right
   - Drawer fits without pushing chart off screen
   - Fullscreen option available

### Test 4.3: Mobile View (<768px)
1. Resize to 375px width
2. Click chart point
3. **Expected:**
   - Drawer appears (may cover most of screen)
   - Fullscreen option available to maximize
   - Drawer scrollable if content exceeds screen

## Test Suite 5: Data Validation

### Test 5.1: Null/Missing Data Handling
1. If database has incomplete records, click on those points
2. **Expected:**
   - Drawer still opens
   - Missing fields show "N/A" or "--"
   - No console errors or crashes

### Test 5.2: Date/Timestamp Formatting
1. Click multiple chart points on different dates
2. **Expected:**
   - Each timestamp formatted as human-readable date/time
   - Timestamps are accurate to data source
   - No invalid date displays

## Test Suite 6: Accessibility

### Test 6.1: Keyboard Navigation
1. Click chart point to open drawer
2. Press TAB repeatedly
3. **Expected:**
   - Focus visible on buttons (highlight/outline)
   - Can tab to: Close, Fullscreen, View Source buttons
   - Tab loops through focusable elements

### Test 6.2: Keyboard Close
1. Open drawer
2. Press ESC key
3. **Expected:** Drawer closes

### Test 6.3: Screen Reader (Optional)
1. Enable screen reader (built-in or VoiceOver/NVDA)
2. Open drawer
3. **Expected:**
   - Drawer title readable ("gas Details")
   - Metric labels and values announced
   - Button purposes clear

## Test Suite 7: Performance

### Test 7.1: Large Dataset Clicking
1. If chart has 100+ data points, click various points
2. **Expected:**
   - Drawer opens in < 100ms
   - No lag or jank
   - Smooth animations
   - Memory not spiking

### Test 7.2: Rapid Clicks
1. Click multiple chart points in rapid succession
2. **Expected:**
   - Drawer updates smoothly
   - Previous data replaced with new data
   - No duplicate drawers open
   - No console errors

### Test 7.3: Collapsible Sections (Future Tests)
*For Weight/Heatmap components when implemented:*
1. Click chart point that shows collapsible sections
2. Click section headers to expand/collapse
3. **Expected:**
   - Smooth expand/collapse animation
   - Content visible when expanded
   - No layout shift

## Test Suite 8: Integration Tests

### Test 8.1: Multiple Chart Switching
1. Have Gas and Utilities charts visible
2. Click point on Gas chart → drawer opens with gas data
3. Without closing drawer, click point on Utilities chart
4. **Expected:** Drawer smoothly updates to show utilities data
5. Close drawer

### Test 8.2: Chart Scroll + Click
1. Open Gas chart, scroll to bottom of chart
2. Click a low-positioned data point
3. **Expected:**
   - Drawer opens properly
   - Doesn't push chart out of view
   - All content accessible

## Error Scenarios (Negative Testing)

### Error 1.1: Click Non-Data Area
1. Click on chart axis or empty area (not a data point)
2. **Expected:** Drawer doesn't open

### Error 1.2: Rapid Open/Close
1. Click chart point
2. Immediately click close button
3. Immediately click chart again
4. **Expected:** No errors, drawer opens with new data

### Error 1.3: Theme Toggle During Drawer Open
1. Open drawer showing data
2. Toggle dark/light theme
3. **Expected:** Drawer updates theme without closing

## Performance Benchmarks

| Action | Target | Accept |
|--------|--------|--------|
| Drawer open time | < 50ms | < 100ms |
| Data transform | < 10ms | < 25ms |
| Render update | < 16ms | < 50ms |
| Click to visible | < 100ms | < 200ms |

## Test Data Requirements

### Gas Monitoring Test Data
```
- reading_date: Recent dates (last 7 days recommended)
- total_produced: 100-1000 m³
- total_used: 50-800 m³
- total_flared: 0-100 m³
- avg_pressure: 1-3 bar
- avg_temperature: 30-50 °C
- quality_status: 'Good' or 'Warning'
```

### Plant Utilities Test Data
```
- utility_date: Recent dates
- electricity_consumption: 10000-20000 kWh
- electricity_cost: 1000-5000 USD
- water_consumption: 500-1500 m³
- water_cost: 2000-10000 USD
- cost_per_ton: 50-200 USD
```

## Known Limitations (Pre-Release)

- [ ] Activity Log navigation not yet implemented
- [ ] Point highlight CSS not visually obvious
- [ ] Weight Trends component not yet created
- [ ] Industrial Heatmap component not yet created
- [ ] Export to PDF/CSV not implemented
- [ ] Keyboard shortcuts not all implemented

## Sign-Off Checklist

- [ ] All Test Suites 1-7 passed
- [ ] No errors in browser console
- [ ] No console warnings except expected ones
- [ ] Dark/light mode works correctly
- [ ] Responsive design verified
- [ ] All buttons clickable and functional  
- [ ] Data displays accurately
- [ ] Drawer opens/closes smoothly
- [ ] No performance issues observed
- [ ] Ready for production deployment

## Regression Testing (After Future Updates)

After implementing Weight Trends, Heatmap, or Activity Log integration:

1. Re-run all Test Suites 1-7
2. Add new tests for new components
3. Verify no existing functionality broken
4. Check performance hasn't degraded
5. Update this guide with new test scenarios

---

**Test Document Version:** 1.0  
**Last Updated:** March 2, 2026  
**Created By:** Development Team
