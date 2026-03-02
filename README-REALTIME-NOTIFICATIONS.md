# Real-Time Push Notification System

## 🚀 Overview

Your METPower Admin Dashboard now features a **global, real-time notification system** powered by **WebSockets (Socket.IO)**. Every transaction create, update, delete, and restore operation instantly broadcasts notifications to all connected users without requiring page refresh or polling.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     USER ACTIONS                             │
│  (Create/Update/Delete/Restore Transaction)                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  EXPRESS API ENDPOINTS                       │
│  POST /api/transac                                           │
│  PUT /api/transac/:id                                        │
│  POST /api/transac/:id/trash                                 │
│  POST /api/transac/:id/restore                               │
│  POST /api/transac/bulk/trash                                │
│  POST /api/transac/bulk/restore                              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│            notifyActivity() Function                         │
│  • Saves notification to SQL Server                          │
│  • Emits 'new_notification' event via Socket.IO              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  WEBSOCKET SERVER                            │
│  Socket.IO broadcasts to all connected clients               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              NotificationContext (React)                     │
│  • Listens globally for 'new_notification' events            │
│  • Works on ANY page (Login, Dashboard, etc.)                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  TOAST NOTIFICATION UI                       │
│  • Color-coded by type (success/error/warning/info)          │
│  • Clickable to navigate to Activity Log                     │
│  • Auto-hide after 5 seconds (configurable)                  │
│  • Max 5 notifications shown at once                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 📡 WebSocket Events

### Server → Client

#### `new_notification`
Emitted whenever a transaction operation occurs.

**Payload:**
```typescript
{
  id: string;              // Notification ID
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;           // "✅ Transaction created"
  message?: string;        // "Truck [ABC-123] - Driver: John (TXN-001)"
  action: string;          // CREATE | UPDATE | DELETE | RESTORE | BULK_DELETE | BULK_RESTORE
  trans_id?: number;       // Transaction ID for navigation
  trans_no?: string;       // Transaction number
  username: string;        // User who performed action
  timestamp: string;       // ISO timestamp
  clickable: boolean;      // Whether notification can be clicked
  autoHide: boolean;       // Auto-dismiss after duration
  duration: number;        // Milliseconds (default: 5000)
}
```

### Client → Server

#### `authenticate`
Send after connection to join user-specific rooms.

**Payload:**
```typescript
{
  username: string;
  email?: string;
  userId?: number;
  role?: string;
}
```

#### `mark_read`
Mark a notification as read.

**Payload:**
```typescript
notificationId: string
```

#### `fetch_unread_count`
Request unread notification count for a user.

**Payload:**
```typescript
userId: number
```

---

## 🗄️ Database Schema

### `notifications` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT IDENTITY | Primary key |
| `user_id` | INT NULL | Target user (NULL = broadcast) |
| `username` | NVARCHAR(100) | Who triggered the notification |
| `type` | NVARCHAR(20) | success, error, warning, info |
| `title` | NVARCHAR(255) | "Transaction created" |
| `message` | NVARCHAR(MAX) | Details about the transaction |
| `action` | NVARCHAR(50) | CREATE, UPDATE, DELETE, etc. |
| `trans_id` | INT | Foreign key to transac table |
| `trans_no` | NVARCHAR(100) | Transaction number |
| `is_read` | BIT | Read status (default: 0) |
| `is_dismissed` | BIT | Dismissed status (default: 0) |
| `created_at` | DATETIME | Notification timestamp |
| `read_at` | DATETIME NULL | When marked as read |
| `metadata` | NVARCHAR(MAX) | JSON for additional data |

**Indexes:**
- `idx_notifications_user_id` (user_id, is_read, created_at)
- `idx_notifications_trans_id` (trans_id)
- `idx_notifications_is_read` (is_read, created_at)

**Foreign Keys:**
- `trans_id` → `transac.id` (DELETE SET NULL)

---

## 📝 Stored Procedures

### `sp_create_notification`

Creates a notification and returns it.

**Parameters:**
```sql
@username NVARCHAR(100)
@type NVARCHAR(20)
@title NVARCHAR(255)
@message NVARCHAR(MAX) = NULL
@action NVARCHAR(50) = NULL
@trans_id INT = NULL
@trans_no NVARCHAR(100) = NULL
@metadata NVARCHAR(MAX) = NULL
```

**Usage:**
```sql
EXEC sp_create_notification 
  @username = 'john.doe',
  @type = 'success',
  @title = 'Transaction Created',
  @message = 'Truck [ABC-123] entered',
  @action = 'CREATE',
  @trans_id = 42,
  @trans_no = 'TXN-001';
```

### `sp_mark_notifications_read`

Marks notifications as read.

**Parameters:**
```sql
@notification_ids NVARCHAR(MAX) = NULL  -- Comma-separated IDs or NULL for all unread
@user_id INT = NULL                      -- Optional user filter
```

**Usage:**
```sql
-- Mark specific notifications as read
EXEC sp_mark_notifications_read @notification_ids = '1,2,3';

-- Mark all unread notifications for a user as read
EXEC sp_mark_notifications_read @user_id = 5;

-- Mark all unread notifications as read
EXEC sp_mark_notifications_read;
```

---

## 🎨 Notification Types & Colors

| Type | Color | Icon | Use Case |
|------|-------|------|----------|
| **success** | Green | ✅ CheckCircle | CREATE, RESTORE operations |
| **error** | Red | ❌ XCircle | Failed operations, errors |
| **warning** | Yellow | ⚠️ AlertCircle | DELETE (trash) operations |
| **info** | Blue | ℹ️ Info | UPDATE, BULK operations |

---

## 🔧 Configuration

### Environment Variables

No additional environment variables needed! The system uses existing:
- `CLIENT_ORIGIN` - CORS allowed origin
- `PORT` - Server port (default: 3001)
- Database config (`DB_SERVER`, `DB_USER`, etc.)

### Client Configuration

The WebSocket connection URL is auto-detected from `VITE_API_URL`:

```typescript
const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001';
```

**Default:** `http://localhost:3001`

---

## 💻 Usage Examples

### Backend: Emit Custom Notification

```javascript
import { notifyActivity } from './socket-io-server.js';

// After creating a transaction
await notifyActivity('CREATE', transaction, username, pool);

// After updating a transaction
await notifyActivity('UPDATE', transaction, username, pool);

// After deleting a transaction
await notifyActivity('DELETE', transaction, username, pool);

// After restoring a transaction
await notifyActivity('RESTORE', transaction, username, pool);
```

### Frontend: Manual Notification

```typescript
import { useNotifications } from '@/contexts/NotificationContext';

const { addNotification } = useNotifications();

// Success notification
addNotification({
  type: 'success',
  title: 'Data Exported',
  message: '150 records exported to CSV',
  autoHide: true,
  duration: 5000
});

// Error notification (stays visible)
addNotification({
  type: 'error',
  title: 'Export Failed',
  message: 'Unable to connect to database',
  autoHide: false
});

// Clickable notification
addNotification({
  type: 'info',
  title: 'Transaction Updated',
  message: 'Click to view details',
  trans_id: 42,
  clickable: true,
  autoHide: true,
  duration: 8000
});
```

### Frontend: Toast Utility Hooks

```typescript
import { useToast } from '@/contexts/NotificationContext';

const toast = useToast();

// Quick success toast
toast.success('Saved successfully');

// Error with details
toast.error('Failed to save', 'Network connection lost');

// Warning
toast.warning('Disk space low');

// Info
toast.info('New version available');
```

---

## 🚦 Connection Status

### Client-Side Connection Monitoring

The NotificationContext logs WebSocket connection status:

```
🔌 Connecting to WebSocket server: http://localhost:3001
✅ WebSocket connected: socket_id_123
📬 Received real-time notification: { title: "Transaction created" }
🔌 WebSocket disconnected: transport close
```

### Server-Side Monitoring

The Socket.IO server logs all connections:

```
🔌 Client connected: socket_id_123
✅ User authenticated: john.doe (socket_id_123)
📢 Broadcasting notification: Transaction created
🔌 Client disconnected: john.doe (socket_id_123)
```

---

## 🎯 Clickable Notifications

When a notification has `clickable: true` and `trans_id`, users can:

1. **Click** the notification toast
2. **Navigate** to Dashboard → Activity Log tab
3. **Auto-filter** to the specific transaction ID

**URL Format:**
```
/dashboard?tab=auditlog&trans_id=42
```

**Visual Cue:**
- Hover effect: `hover:shadow-xl hover:scale-105`
- Subtitle text: "Click to view details"
- Cursor changes to pointer

---

## 🧪 Testing the System

### 1. Start the Server

```bash
npm run dev
```

You should see:
```
✅ Server running on port 3001
📊 API available at: http://localhost:3001/api
🔌 WebSocket server ready for real-time notifications
```

### 2. Open Multiple Browser Tabs

Open your app in 2-3 browser tabs/windows.

### 3. Create a Transaction

In one tab, create a new transaction.

**Expected Result:**
- All tabs instantly show a **green success notification**
- Title: "✅ Transaction created"
- Message: "Truck [plate] - Driver: name (TXN-001)"
- Notification auto-hides after 5 seconds

### 4. Update a Transaction

Edit any transaction.

**Expected Result:**
- All tabs show **blue info notification**
- Title: "📝 Transaction updated"

### 5. Delete a Transaction

Move a transaction to trash.

**Expected Result:**
- All tabs show **yellow warning notification**
- Title: "🗑️ Transaction moved to trash"
- Notification stays visible (autoHide: false)

### 6. Restore a Transaction

Restore from trash bin.

**Expected Result:**
- All tabs show **green success notification**
- Title: "♻️ Transaction restored"

### 7. Bulk Operations

Select 5 transactions and bulk delete.

**Expected Result:**
- All tabs show notification: "📦 Bulk deleted 5 transactions"

### 8. Click Notification

Click any transaction notification.

**Expected Result:**
- Navigates to Dashboard
- Opens Activity Log tab
- Filters to that transaction ID

---

## 🔍 Troubleshooting

### Notifications Not Appearing

**Check 1: WebSocket Connection**
Open browser DevTools → Console. Look for:
```
✅ WebSocket connected: socket_id_123
```

If you see errors:
- Verify server is running on port 3001
- Check CORS configuration
- Ensure firewall allows WebSocket connections

**Check 2: Server Logs**
Look for Socket.IO initialization:
```
✅ Socket.IO initialized and ready for real-time notifications
```

**Check 3: Database**
Verify notifications table exists:
```sql
SELECT * FROM FTSS.dbo.notifications ORDER BY created_at DESC;
```

### Notifications Not Saving to Database

**Check stored procedure:**
```sql
SELECT * FROM sys.procedures WHERE name = 'sp_create_notification';
```

**Test manually:**
```sql
EXEC sp_create_notification 
  @username = 'test',
  @type = 'info',
  @title = 'Test Notification',
  @message = 'Testing the system';
  
SELECT * FROM notifications;
```

### Navigation Not Working

**Check React Router:**
- Ensure `NotificationProvider` is inside `BrowserRouter`
- Verify `useNavigate()` is available

**Check URL parameter handling:**
- Dashboard should read `?tab=auditlog&trans_id=42`
- Activity Log should filter by trans_id

### Socket Connection Closes Immediately

**Check CORS:**
```javascript
// server.js
const allowedOrigin = process.env.CLIENT_ORIGIN || '*';
```

**Check transports:**
```javascript
// NotificationContext.tsx
transports: ['websocket', 'polling'],  // Fallback to polling if WebSocket fails
```

---

## 📊 Performance Considerations

### Database
- **3 indexes** on notifications table for fast queries
- **Foreign key** on trans_id for referential integrity
- **Stored procedures** for optimized inserts and updates

### WebSocket
- **Max 5 notifications** displayed at once (prevents UI clutter)
- **Auto-hide** after 5 seconds (configurable per notification)
- **Reconnection logic** with exponential backoff
- **Connection pooling** reuses HTTP server

### Client
- **React Context** provides global access without prop drilling
- **useCallback** prevents unnecessary re-renders
- **Sound notification** (optional) can be added for audio alerts

---

## 🔐 Security

### Authentication
- Socket.IO connections can be authenticated via `authenticate` event
- User data stored in localStorage used to join user-specific rooms
- Tokens can be added for JWT authentication (future enhancement)

### Authorization
- Notifications can be targeted to specific users via `user_id`
- Role-based rooms allow admin-only notifications
- SQL Server permissions control who can create notifications

### Data Validation
- All notification data sanitized before saving
- SQL injection prevented via parameterized queries
- XSS prevention via React's built-in escaping

---

## 🎨 Customization

### Change Notification Duration

```typescript
addNotification({
  type: 'info',
  title: 'Important Message',
  autoHide: true,
  duration: 10000  // 10 seconds instead of default 5
});
```

### Disable Auto-Hide

```typescript
addNotification({
  type: 'error',
  title: 'Critical Error',
  autoHide: false  // Stays until manually dismissed
});
```

### Add Sound Alerts

Create `/public/notification.mp3` and the system will automatically play it on new notifications.

### Customize Colors

Edit [NotificationContext.tsx](src/contexts/NotificationContext.tsx):

```typescript
const getNotificationStyles = (type: Notification['type']) => {
  switch (type) {
    case 'success':
      return 'bg-midnight-800 border-neon-cyan-glow text-enterprise-text'; // Midnight theme
    // ... other types
  }
};
```

---

## 📈 Future Enhancements

### Planned Features
- [ ] **Notification History Panel** - View past 100 notifications
- [ ] **Unread Count Badge** - Header icon with badge
- [ ] **Mark as Read** - Persistent read status
- [ ] **Notification Preferences** - User settings for notification types
- [ ] **Desktop Notifications** - Browser push notifications API
- [ ] **Email Notifications** - Send emails for critical events
- [ ] **Notification Filtering** - Filter by type, date, transaction
- [ ] **User Targeting** - Send to specific users or roles

### Possible Integrations
- [ ] **SMS Notifications** via Twilio
- [ ] **Slack Integration** for team notifications
- [ ] **Microsoft Teams** webhooks
- [ ] **Mobile App** push notifications

---

## 📚 Related Files

### Backend
- [socket-io-server.js](socket-io-server.js) - WebSocket server and notification broadcaster
- [server.js](server.js) - Express server with Socket.IO integration
- [trash-routes.js](trash-routes.js) - DELETE and RESTORE with notifications
- [migration-realtime-notifications.sql](migration-realtime-notifications.sql) - Database schema
- [run-migration.js](run-migration.js) - Migration runner script

### Frontend
- [NotificationContext.tsx](src/contexts/NotificationContext.tsx) - Global notification system
- [Dashboard.tsx](src/components/Dashboard.tsx) - Main dashboard view
- [AuditLog.tsx](src/components/AuditLog.tsx) - Activity log with filtering

---

## 🤝 Support

For issues or questions about the real-time notification system:

1. Check console logs (client and server)
2. Verify WebSocket connection status
3. Test database connectivity
4. Check CORS configuration
5. Review stored procedures

## 🎉 Summary

Your METPower Admin Dashboard now has **enterprise-grade real-time push notifications**:

✅ **Instant Updates** - No polling, no refresh needed  
✅ **Multi-User Support** - All connected users see notifications  
✅ **Persistent History** - All notifications saved to SQL Server  
✅ **Clickable Actions** - Navigate directly to transaction details  
✅ **Type-Safe** - Full TypeScript support  
✅ **Production-Ready** - Reconnection logic, error handling, indexes  

**The system is live and ready to use!** 🚀
