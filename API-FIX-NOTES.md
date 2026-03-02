# API Routing and Service Worker Fixes

## Issues Resolved

### 1. **Service Worker Was Caching API Responses**
**Problem**: The service worker was using `cacheFirst` strategy for all requests by default, which caused it to cache API responses (including error responses and HTML fallback pages). This resulted in:
- `SyntaxError: Unexpected token '<', "<!doctype"...` errors
- Serving stale cached HTML instead of fresh JSON API responses

**Solution**: Updated `public/sw.js` to:
- Skip ALL same-origin `/api/` requests from being cached
- Let them pass directly through to the network (no caching)
- Skip cross-origin requests entirely (they're not cached anyway)
- Bumped cache version from `v1.0.0` to `v1.0.1` to force cleanup of old cached data

### 2. **API Endpoint Configuration**
The `src/components/NotificationSettings.tsx` component already has correct API routing configured:
- `API_ROOT` defaults to `http://localhost:3001` (backend server)
- All three API endpoints use `withBase()` helper:
  - `GET /api/user/notification-settings` - Load user preferences
  - `POST /api/user/notification-settings` - Save preferences  
  - `POST /api/notifications/test` - Send test email

## Service Worker Changes

### Updated Fetch Strategy
```javascript
// CRITICAL: Skip ALL same-origin API requests - let them go directly to network
if (url.pathname.startsWith('/api/')) {
  event.respondWith(
    fetch(request).catch(() => {
      // Offline handling only
      if (request.mode === 'navigate') {
        return caches.match('/offline.html');
      }
      throw new Error('API call failed');
    })
  );
  return;
}
```

This ensures:
- API requests are NEVER cached
- They always go to the backend server for fresh data
- Only navigation requests in offline mode get the offline.html fallback
- Cross-origin requests to backend (http://localhost:3001) pass through untouched

## Browser Cache Clearing Required

The service worker cache has been updated with new version numbers. When you reload the page:
1. The browser will detect the new service worker version
2. The `activate` event will cleanup old cache entries
3. All subsequent API requests will fetch fresh data from the backend

**If you still see cached API errors:**
1. Open DevTools (F12)
2. Go to Application → Service Workers
3. Click "Unregister" for the old service worker
4. Clear Application Cache → Clear all
5. Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)

## Server Status

- **Backend**: Running on `http://localhost:3001`
  - Connected to SQL Server (FTSS database)
  - Email service initialized
  - API endpoints ready
  
- **Frontend**: Running on `http://localhost:5173`
  - Vite dev server ready
  - Service worker registered and active
  - Hot module replacement enabled

## Testing Notification Settings

1. Navigate to Dashboard tab
2. Click on "Notification Settings" 
3. The settings should now load without errors
4. Enter your email address
5. Click "Send Test Email" to verify the backend connection

Expected behavior:
- Settings load from backend ✓
- Test email sends without 404 errors ✓
- No "Unexpected token '<'" errors ✓
