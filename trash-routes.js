// Trash/Restore Routes for Transaction Management
// Import this module and call setupTrashRoutes(app, pool) after sql.connect

import { logAuditEntry, logBulkAuditEntries, extractUsername, extractUserId } from './audit-utils.js';

export function setupTrashRoutes(app, pool, sql) {
  // ===== BULK OPERATIONS (MUST BE FIRST - before parameterized routes) =====
  
  // Bulk move to trash
  app.post('/api/transac/bulk/trash', async (req, res) => {
    try {
      console.log('[BULK_TRASH] Request body:', JSON.stringify(req.body));
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        console.log('[BULK_TRASH] Invalid IDs - received:', typeof ids, ids);
        return res.status(400).json({ error: 'Invalid IDs array' });
      }

      console.log(`[BULK_TRASH] Moving ${ids.length} transactions to trash`);

      const request = pool.request();
      const placeholders = ids.map((_, i) => `@id${i}`).join(',');
      ids.forEach((id, i) => {
        request.input(`id${i}`, sql.Int, id);
      });

      const result = await request.query(`
        UPDATE FTSS.dbo.transac
        SET deleted_at = GETUTCDATE()
        WHERE id IN (${placeholders}) AND deleted_at IS NULL
      `);

      const affectedRows = result.rowsAffected[0] || 0;
      console.log(`[BULK_TRASH] Moved ${affectedRows} transactions to trash`);

      // Log audit entries for affected transactions
      const username = extractUsername(req);
      const userId = extractUserId(req);
      const affectedIds = ids.slice(0, affectedRows); // Only log for actually affected rows
      await logBulkAuditEntries(pool, sql, affectedIds, 'BULK_DELETE', username, userId, `Bulk moved to trash (${affectedRows} items)`);

      res.json({
        success: true,
        message: `${affectedRows} transaction(s) moved to trash`,
        affected: affectedRows
      });
    } catch (err) {
      console.error('POST /api/transac/bulk/trash error:', err);
      res.status(500).json({ error: 'Failed to move transactions to trash', details: err.message });
    }
  });

  // Bulk restore from trash
  app.post('/api/transac/bulk/restore', async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Invalid IDs array' });
      }

      console.log(`[BULK_RESTORE] Restoring ${ids.length} transactions from trash`);

      const request = pool.request();
      const placeholders = ids.map((_, i) => `@id${i}`).join(',');
      ids.forEach((id, i) => {
        request.input(`id${i}`, sql.Int, id);
      });

      const result = await request.query(`
        UPDATE FTSS.dbo.transac
        SET deleted_at = NULL
        WHERE id IN (${placeholders}) AND deleted_at IS NOT NULL
      `);

      const affectedRows = result.rowsAffected[0] || 0;
      console.log(`[BULK_RESTORE] Restored ${affectedRows} transactions from trash`);

      // Log audit entries for affected transactions
      const username = extractUsername(req);
      const userId = extractUserId(req);
      const affectedIds = ids.slice(0, affectedRows); // Only log for actually affected rows
      await logBulkAuditEntries(pool, sql, affectedIds, 'BULK_RESTORE', username, userId, `Bulk restored from trash (${affectedRows} items)`);

      res.json({
        success: true,
        message: `${affectedRows} transaction(s) restored`,
        affected: affectedRows
      });
    } catch (err) {
      console.error('POST /api/transac/bulk/restore error:', err);
      res.status(500).json({ error: 'Failed to restore transactions', details: err.message });
    }
  });

  // Bulk update status
  app.put('/api/transac/bulk/status', async (req, res) => {
    try {
      const { ids, status } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Invalid IDs array' });
      }
      if (!status || typeof status !== 'string') {
        return res.status(400).json({ error: 'Invalid status' });
      }

      console.log(`[BULK_STATUS] Updating status to "${status}" for ${ids.length} transactions`);

      const request = pool.request();
      const placeholders = ids.map((_, i) => `@id${i}`).join(',');
      ids.forEach((id, i) => {
        request.input(`id${i}`, sql.Int, id);
      });
      request.input('status', sql.NVarChar, status);

      const result = await request.query(`
        UPDATE FTSS.dbo.transac
        SET status = @status
        WHERE id IN (${placeholders})
      `);

      const affectedRows = result.rowsAffected[0] || 0;
      console.log(`[BULK_STATUS] Updated status for ${affectedRows} transactions`);

      // Log audit entries for affected transactions
      const username = extractUsername(req);
      const userId = extractUserId(req);
      const affectedIds = ids.slice(0, affectedRows); // Only log for actually affected rows
      await logBulkAuditEntries(pool, sql, affectedIds, 'BULK_STATUS_UPDATE', username, userId, `Bulk status update to "${status}" (${affectedRows} items)`);

      res.json({
        success: true,
        message: `Status updated for ${affectedRows} transaction(s)`,
        affected: affectedRows
      });
    } catch (err) {
      console.error('PUT /api/transac/bulk/status error:', err);
      res.status(500).json({ error: 'Failed to update transaction status', details: err.message });
    }
  });

  // Bulk export to CSV
  app.post('/api/transac/bulk/export', async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Invalid IDs array' });
      }

      console.log(`[BULK_EXPORT] Exporting ${ids.length} transactions to CSV`);

      const request = pool.request();
      const placeholders = ids.map((_, i) => `@id${i}`).join(',');
      ids.forEach((id, i) => {
        request.input(`id${i}`, sql.Int, id);
      });

      const result = await request.query(`
        SELECT * FROM FTSS.dbo.transac
        WHERE id IN (${placeholders})
        ORDER BY id DESC
      `);

      const transactions = result.recordset || [];
      console.log(`[BULK_EXPORT] Retrieved ${transactions.length} transactions for export`);

      if (transactions.length === 0) {
        return res.status(404).json({ error: 'No transactions found to export' });
      }

      // Convert to CSV
      const columns = Object.keys(transactions[0]);
      const csvHeader = columns.map(col => `"${col}"`).join(',');
      const csvRows = transactions.map(row => 
        columns.map(col => {
          const val = row[col];
          if (val === null || val === undefined) return '""';
          const str = String(val).replace(/"/g, '""');
          return `"${str}"`;
        }).join(',')
      );

      const csv = [csvHeader, ...csvRows].join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="bulk_export_${new Date().toISOString().slice(0, 10)}.csv"`);
      res.send(csv);

      console.log(`[BULK_EXPORT] Successfully exported ${transactions.length} transactions`);
    } catch (err) {
      console.error('POST /api/transac/bulk/export error:', err);
      res.status(500).json({ error: 'Failed to export transactions', details: err.message });
    }
  });

  // ===== SINGLE TRANSACTION OPERATIONS =====
  
  // Move transaction to trash
  app.post('/api/transac/:id/trash', async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      console.log(`[TRASH] Attempting to move transaction ${id} to trash`);
      
      if (!id) {
        console.error('[TRASH] Invalid transaction ID:', id);
        return res.status(400).json({ error: 'Invalid transaction ID' });
      }

      if (!pool) {
        console.error('[TRASH] Pool is undefined');
        return res.status(500).json({ error: 'Database connection error' });
      }

      const request = pool.request();
      request.input('id', sql.Int, id);
      
      console.log(`[TRASH] Executing UPDATE query for ID: ${id}`);
      const updateResult = await request.query(`
        UPDATE FTSS.dbo.transac
        SET deleted_at = GETUTCDATE()
        WHERE id = @id AND deleted_at IS NULL
      `);

      console.log(`[TRASH] Update query affected`, updateResult.rowsAffected[0], 'rows');

      if (!updateResult.rowsAffected || updateResult.rowsAffected[0] === 0) {
        console.warn(`[TRASH] Transaction ${id} not found or already deleted`);
        return res.status(404).json({ error: 'Transaction not found or already deleted' });
      }

      // Fetch the updated transaction
      const selectRequest = pool.request();
      selectRequest.input('id', sql.Int, id);
      const selectResult = await selectRequest.query(`
        SELECT TOP 1 * FROM FTSS.dbo.transac WHERE id = @id
      `);

      const transaction = selectResult.recordset ? selectResult.recordset[0] : null;

      // Log audit entry
      const username = extractUsername(req);
      const userId = extractUserId(req);
      await logAuditEntry(pool, sql, id, 'DELETE', username, userId, 'Transaction moved to trash');

      console.log(`[TRASH] Successfully moved transaction ${id} to trash`);
      res.json({
        success: true,
        message: 'Transaction moved to trash',
        transaction: transaction
      });
    } catch (err) {
      console.error(`[TRASH] Error in POST /api/transac/:id/trash:`, err.message);
      console.error('[TRASH] Full error stack:', err.stack);
      res.status(500).json({ error: 'Failed to move to trash', details: err.message });
    }
  });

  // Restore transaction from trash
  app.post('/api/transac/:id/restore', async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      console.log(`[RESTORE] Attempting to restore transaction ${id} from trash`);
      
      if (!id) return res.status(400).json({ error: 'Invalid transaction ID' });

      if (!pool) {
        console.error('[RESTORE] Pool is undefined');
        return res.status(500).json({ error: 'Database connection error' });
      }

      const request = pool.request();
      request.input('id', sql.Int, id);
      
      const updateResult = await request.query(`
        UPDATE FTSS.dbo.transac
        SET deleted_at = NULL
        WHERE id = @id AND deleted_at IS NOT NULL
      `);

      if (!updateResult.rowsAffected || updateResult.rowsAffected[0] === 0) {
        console.warn(`[RESTORE] Transaction ${id} not found in trash or already active`);
        return res.status(404).json({ error: 'Transaction not found in trash or already active' });
      }

      // Fetch the restored transaction
      const selectRequest = pool.request();
      selectRequest.input('id', sql.Int, id);
      const selectResult = await selectRequest.query(`
        SELECT TOP 1 * FROM FTSS.dbo.transac WHERE id = @id
      `);

      const transaction = selectResult.recordset ? selectResult.recordset[0] : null;

      // Log audit entry
      const username = extractUsername(req);
      const userId = extractUserId(req);
      await logAuditEntry(pool, sql, id, 'RESTORE', username, userId, 'Transaction restored from trash');

      console.log(`[RESTORE] Successfully restored transaction ${id}`);
      res.json({
        success: true,
        message: 'Transaction restored from trash',
        transaction: transaction
      });
    } catch (err) {
      console.error(`[RESTORE] Error in POST /api/transac/:id/restore:`, err.message);
      console.error('[RESTORE] Full error stack:', err.stack);
      res.status(500).json({ error: 'Failed to restore from trash', details: err.message });
    }
  });

  // Get all trashed transactions (with pagination)
  app.get('/api/trash', async (req, res) => {
    try {
      console.log('[TRASH_GET] Getting trashed transactions');
      
      const page = Math.max(1, parseInt(req.query.page || '1', 10));
      const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize || '20', 10)));
      const offset = (page - 1) * pageSize;
      const sortBy = req.query.sortBy || 'id';
      const sortDir = (req.query.sortDir || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      // Validate sort column to prevent SQL injection
      const ALLOWED_SORT = ['id', 'trans_no', 'driver', 'product', 'transac_date', 'deleted_at'];
      const safeSortBy = ALLOWED_SORT.includes(sortBy.toLowerCase()) ? sortBy : 'id';

      if (!pool) {
        console.error('[TRASH_GET] Pool is undefined');
        return res.status(500).json({ error: 'Database connection error' });
      }

      const request = pool.request();
      request.input('offset', sql.Int, offset);
      request.input('pageSize', sql.Int, pageSize);

      console.log('[TRASH_GET] Executing count query');
      // Get total count
      const countResult = await request.query(`
        SELECT COUNT(*) as total FROM FTSS.dbo.transac WHERE deleted_at IS NOT NULL
      `);
      const total = countResult.recordset[0].total;
      console.log('[TRASH_GET] Total trashed items:', total);

      console.log('[TRASH_GET] Executing data query with offset:', offset, 'pageSize:', pageSize);
      // Get paginated trash data
      const dataResult = await request.query(`
        SELECT 
          id, trans_no, barge_details, plate, initial_net_wt, inbound, outbound,
          driver, type_veh, product, ws_no, dr_no, del_comp, del_address,
          gross_weight, tare_weight, net_weight, inbound_wt, outbound_wt,
          Remarks as remarks, transac_date, [date], status, vessel_id, weigher,
          No_of_Bags as no_of_bags, deleted_at
        FROM FTSS.dbo.transac 
        WHERE deleted_at IS NOT NULL
        ORDER BY ${safeSortBy} ${sortDir}
        OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
      `);

      console.log('[TRASH_GET] Data query returned', dataResult.recordset?.length || 0, 'rows');
      
      res.json({
        rows: dataResult.recordset || [],
        page,
        pageSize,
        total
      });
    } catch (err) {
      console.error('[TRASH_GET] Error in GET /api/trash:', err);
      console.error('[TRASH_GET] Full error stack:', err.stack);
      res.status(500).json({ error: 'Failed to fetch trash', details: err.message });
    }
  });

  // Permanently delete old trashed items (30+ days)
  app.post('/api/trash/cleanup', async (req, res) => {
    try {
      const daysOld = parseInt(req.body.daysOld || '30', 10);
      if (daysOld < 1 || daysOld > 365) {
        return res.status(400).json({ error: 'daysOld must be between 1 and 365' });
      }

      const request = pool.request();
      request.input('daysOld', sql.Int, daysOld);

      const result = await request.query(`
        DECLARE @deleteThreshold DATETIME = DATEADD(DAY, -@daysOld, GETUTCDATE());
        DECLARE @count INT = 0;
        
        SELECT @count = COUNT(*) FROM FTSS.dbo.transac 
        WHERE deleted_at IS NOT NULL AND deleted_at < @deleteThreshold;
        
        DELETE FROM FTSS.dbo.transac
        WHERE deleted_at IS NOT NULL AND deleted_at < @deleteThreshold;
        
        SELECT @count as deleted_count;
      `);

      const deletedCount = result.recordset[0].deleted_count;
      res.json({
        success: true,
        message: `Permanently deleted ${deletedCount} old trash items`,
        deleted_count: deletedCount
      });
    } catch (err) {
      console.error('POST /api/trash/cleanup error:', err);
      res.status(500).json({ error: 'Failed to cleanup trash' });
    }
  });
}
