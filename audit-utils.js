// Audit logging utilities for transaction tracking

/**
 * Logs an activity to the audit_log table
 * @param {Object} pool - SQL pool connection
 * @param {Object} sql - SQL object
 * @param {number} transactionId - ID of the transaction being audited
 * @param {string} action - Action performed (CREATE, UPDATE, DELETE, RESTORE, BULK_UPDATE, etc.)
 * @param {string} username - Username of the person performing the action
 * @param {number|null} userId - User ID if available
 * @param {string|null} details - Additional details about the action
 */
export async function logAuditEntry(pool, sql, transactionId, action, username, userId = null, details = null) {
  try {
    if (!pool || !transactionId || !action || !username) {
      console.warn('[AUDIT] Missing required parameters for audit log');
      return;
    }

    const request = pool.request();
    request.input('transaction_id', sql.Int, transactionId);
    request.input('user_id', sql.Int, userId);
    request.input('username', sql.NVarChar, username);
    request.input('action', sql.NVarChar, action);
    request.input('details', sql.NVarChar, details);

    await request.query(`
      INSERT INTO [FTSS].[dbo].[audit_log] 
      (transaction_id, user_id, username, action, details, created_at)
      VALUES (@transaction_id, @user_id, @username, @action, @details, GETUTCDATE())
    `);

    console.log(`[AUDIT] Logged action: ${action} for transaction ${transactionId} by ${username}`);
  } catch (err) {
    console.error('[AUDIT] Failed to log audit entry:', err.message);
    // Don't throw error to avoid breaking the main operation
  }
}

/**
 * Logs multiple audit entries for bulk operations
 * @param {Object} pool - SQL pool connection
 * @param {Object} sql - SQL object
 * @param {number[]} transactionIds - Array of transaction IDs
 * @param {string} action - Action performed
 * @param {string} username - Username of the person performing the action
 * @param {number|null} userId - User ID if available
 * @param {string|null} details - Additional details about the action
 */
export async function logBulkAuditEntries(pool, sql, transactionIds, action, username, userId = null, details = null) {
  try {
    if (!pool || !transactionIds || !transactionIds.length || !action || !username) {
      console.warn('[AUDIT] Missing required parameters for bulk audit log');
      return;
    }

    const request = pool.request();
    request.input('user_id', sql.Int, userId);
    request.input('username', sql.NVarChar, username);
    request.input('action', sql.NVarChar, action);
    request.input('details', sql.NVarChar, details);

    // Create value placeholders for each transaction
    const valueClauses = transactionIds.map((id, index) => {
      request.input(`transaction_id_${index}`, sql.Int, id);
      return `(@transaction_id_${index}, @user_id, @username, @action, @details, GETUTCDATE())`;
    }).join(', ');

    const insertSql = `
      INSERT INTO [FTSS].[dbo].[audit_log] 
      (transaction_id, user_id, username, action, details, created_at)
      VALUES ${valueClauses}
    `;

    await request.query(insertSql);

    console.log(`[AUDIT] Logged bulk action: ${action} for ${transactionIds.length} transactions by ${username}`);
  } catch (err) {
    console.error('[AUDIT] Failed to log bulk audit entries:', err.message);
    // Don't throw error to avoid breaking the main operation
  }
}

/**
 * Extract username from request headers/auth
 * This is a placeholder - modify based on your authentication system
 * @param {Object} req - Express request object
 * @returns {string} username
 */
export function extractUsername(req) {
  // This is a simplified approach - you might need to modify
  // based on how authentication is implemented in your system
  return req.headers['x-username'] || 
         req.body.username || 
         req.query.username || 
         req.user?.username || 
         'system';
}

/**
 * Extract user ID from request headers/auth
 * @param {Object} req - Express request object
 * @returns {number|null} user ID
 */
export function extractUserId(req) {
  return req.headers['x-user-id'] ? parseInt(req.headers['x-user-id'], 10) : 
         req.user?.id ? parseInt(req.user.id, 10) : 
         null;
}