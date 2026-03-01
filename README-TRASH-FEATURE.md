# Trash/Soft-Delete Implementation Guide

This guide explains how to implement a trash/recycle bin feature that allows users to move transactions to trash and restore them later, with automatic cleanup of old deleted items after 30 days.

## Files Created

1. **migration-trash-feature.sql** - Database schema changes
2. **trash-routes.js** - Express API endpoints
3. **cleanup-trash.js** - Automatic cleanup script
4. **This README** - Implementation instructions

---

## Step 1: Apply Database Migration

Run the SQL migration script to add the soft-delete columns and views:

### Option A: Using SQL Server Management Studio (SSMS)
1. Open **SSMS**
2. Connect to `ACERNAYTHROW\SQLEXPRESS` and select database `FTSS`
3. Open a new query window
4. Copy and paste the entire contents of `migration-trash-feature.sql`
5. Execute (F5)
6. Verify: You should see messages like "Added deleted_at column to dbo.transac"

### Option B: Using Command Line (sqlcmd)
```bash
sqlcmd -S ACERNAYTHROW\SQLEXPRESS -d FTSS -i migration-trash-feature.sql
```

### What Gets Created
- **Column**: `deleted_at` (DATETIME, NULL) on both `dbo.transac` and `dbo.users`
- **Index**: `IX_transac_deleted_at` for fast queries on deleted records
- **Views**:
  - `v_active_transactions` - Only shows records where `deleted_at IS NULL`
  - `v_trashed_transactions` - Only shows records where `deleted_at IS NOT NULL`
- **Stored Procedures**:
  - `sp_trash_transaction` - Move a record to trash
  - `sp_restore_transaction` - Restore from trash
  - `sp_cleanup_old_trash` - Permanently delete old trash (30+ days)

---

## Step 2: Integrate Backend Routes

Add trash routes to your Express server. Edit `server.js`:

### At the top (after imports), add:
```javascript
import { setupTrashRoutes } from './trash-routes.js';
```

### Inside the `sql.connect(config).then(pool => { ... })` block, add this line RIGHT BEFORE `app.listen(port, () => {`:

```javascript
// Setup trash/restore routes
setupTrashRoutes(app, pool, sql);
```

**Full context:**
```javascript
sql.connect(config)
  .then(pool => {
    console.log('✅ Connected to SQL Server successfully!');
    
    // ... existing routes (login, transac, etc.) ...

    // Setup trash/restore routes  <-- ADD THIS LINE
    setupTrashRoutes(app, pool, sql);

    app.listen(port, () => {
      console.log(`✅ Server running on port ${port}`);
    });
  })
```

---

## Step 3: Add Cleanup Script to package.json

Edit your `package.json` and add this line to the `"scripts"` section:

```json
"scripts": {
  "start": "node server.js",
  "server": "nodemon server.js",
  "client": "vite",
  "dev": "concurrently \"npm run server\" \"npm run client\"",
  "migrate": "node migrate-users.js",
  "create-admin": "node create-admin.js",
  "cleanup-trash": "node cleanup-trash.js"
}
```

---

## API Endpoints

Once routes are integrated, you can use these endpoints:

### 1. Move Transaction to Trash
```http
POST /api/transac/:id/trash
```
**Example:**
```bash
curl -X POST http://localhost:3001/api/transac/123/trash
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Transaction moved to trash",
  "transaction": { "id": 123, "trans_no": "TRK001", ... }
}
```

**Response (Error):**
```json
{ "error": "Transaction not found or already deleted" }
```

---

### 2. Restore Transaction from Trash
```http
POST /api/transac/:id/restore
```
**Example:**
```bash
curl -X POST http://localhost:3001/api/transac/123/restore
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Transaction restored from trash",
  "transaction": { "id": 123, "trans_no": "TRK001", ... }
}
```

---

### 3. Get All Trashed Transactions
```http
GET /api/trash?page=1&pageSize=20&sortBy=deleted_at&sortDir=DESC
```

**Query Parameters:**
- `page` - Page number (default: 1)
- `pageSize` - Records per page (default: 20, max: 200)
- `sortBy` - Column to sort by (default: id)
- `sortDir` - ASC or DESC (default: DESC)

**Response:**
```json
{
  "rows": [
    {
      "id": 123,
      "trans_no": "TRK001",
      "driver": "John Doe",
      "deleted_at": "2026-03-02T10:30:00.000Z",
      ...
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 45
}
```

---

### 4. Permanently Delete Old Trash (30+ Days)
```http
POST /api/trash/cleanup
Content-Type: application/json

{
  "daysOld": 30
}
```

**Via npm script (runs cleanup for 30 days):**
```bash
npm run cleanup-trash
```

**For custom days:**
```bash
npm run cleanup-trash 15     # Delete trash older than 15 days
node cleanup-trash.js 30     # Delete trash older than 30 days
```

**Response:**
```json
{
  "success": true,
  "message": "Permanently deleted 12 old trash items",
  "deleted_count": 12
}
```

---

## Frontend Integration (React)

### Add Delete Button to Dashboard
```tsx
// In your TransactionTable or Dashboard component
const handleDelete = async (id: number) => {
  try {
    const response = await fetch(`http://localhost:3001/api/transac/${id}/trash`, {
      method: 'POST'
    });
    if (response.ok) {
      // Refresh the table
      loadTransactions();
      showNotification('Moved to trash');
    }
  } catch (error) {
    console.error('Delete failed:', error);
  }
};

// In JSX:
<button onClick={() => handleDelete(transaction.id)} className="btn-delete">
  🗑️ Delete
</button>
```

### Add Trash Bin View
```tsx
// New component: TrashBin.tsx
import { useState, useEffect } from 'react';

export default function TrashBin() {
  const [trash, setTrash] = useState([]);

  useEffect(() => {
    fetch('http://localhost:3001/api/trash?pageSize=100')
      .then(r => r.json())
      .then(data => setTrash(data.rows));
  }, []);

  const handleRestore = async (id: number) => {
    await fetch(`http://localhost:3001/api/transac/${id}/restore`, {
      method: 'POST'
    });
    setTrash(trash.filter(t => t.id !== id));
  };

  return (
    <div className="trash-bin">
      <h2>🗑️ Trash Bin</h2>
      {trash.map(item => (
        <div key={item.id}>
          <p>{item.trans_no} - Deleted {new Date(item.deleted_at).toLocaleDateString()}</p>
          <button onClick={() => handleRestore(item.id)}>♻️ Restore</button>
        </div>
      ))}
    </div>
  );
}
```

---

## Automatic Cleanup (Optional: Scheduling)

### For Windows (Task Scheduler)
Create a scheduled task that runs every night:
```batch
node "D:\path\to\cleanup-trash.js" 30
```

### For Linux/macOS (Cron)
```bash
0 2 * * * cd /path/to/app && node cleanup-trash.js 30 >> cleanup.log 2>&1
```

### Or: Trigger via API
Call the cleanup endpoint from your admin panel on a schedule:
```javascript
// Example: Cleanup every night at 2 AM
setInterval(async () => {
  await fetch('http://localhost:3001/api/trash/cleanup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ daysOld: 30 })
  });
}, 24 * 60 * 60 * 1000);
```

---

## Database Cleanup Queries

### View all deleted items
```sql
SELECT id, trans_no, driver, deleted_at 
FROM dbo.transac 
WHERE deleted_at IS NOT NULL
ORDER BY deleted_at DESC;
```

### Count trash
```sql
SELECT COUNT(*) as trash_count FROM dbo.transac WHERE deleted_at IS NOT NULL;
```

### Permanently delete trash older than 30 days (manual)
```sql
DELETE FROM dbo.transac 
WHERE deleted_at IS NOT NULL 
AND deleted_at < DATEADD(DAY, -30, GETUTCDATE());
```

### Restore all deleted items
```sql
UPDATE dbo.transac SET deleted_at = NULL WHERE deleted_at IS NOT NULL;
```

---

## Key Features

✅ **Soft Delete**: Records remain in DB, just marked as deleted  
✅ **Restore**: Users can recover accidentally deleted items  
✅ **Auto-Cleanup**: Old trash (30+ days) is permanently deleted  
✅ **Pagination**: Trash view shows large numbers of deleted items  
✅ **SQL Injection Safe**: Uses parameterized queries  
✅ **Timezone Aware**: Uses GETUTCDATE() for consistent timestamps  

---

## Troubleshooting

### Error: "Invalid column name 'deleted_at'"
**Solution**: Run the migration script first (`migration-trash-feature.sql`)

### Error: "setupTrashRoutes is not a function"
**Solution**: Make sure you added `import { setupTrashRoutes } from './trash-routes.js'` at the top of server.js

### Cleanup script doesn't run
**Solution**: Make sure `cleanup-trash.js` is in the root directory and you ran `npm run cleanup-trash`

### Changes not showing in UI
**Solution**: Clear browser cache (Ctrl+Shift+Delete) and refresh database queries

---

## Summary

1. ✅ Run SQL migration (`migration-trash-feature.sql`)
2. ✅ Add `setupTrashRoutes()` to `server.js`
3. ✅ Add `cleanup-trash` script to `package.json`
4. ✅ Update frontend components to use trash endpoints
5. ✅ (Optional) Schedule cleanup with cron or Task Scheduler

Your app now has a Gmail-style trash bin with automatic 30-day cleanup!
