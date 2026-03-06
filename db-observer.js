/**
 * =====================================================================
 * METpower — Centralized Database Observer
 * =====================================================================
 * Polls dbo.db_change_log every few seconds.
 * Every unprocessed row becomes:
 *   • A WebSocket toast notification (new_notification event)
 *   • A lightweight data_changed event so UI panels refresh instantly
 *
 * The rows themselves were written by SQL Server triggers on:
 *   dbo.transac, dbo.trucks, dbo.drivers, dbo.products, dbo.users
 *
 * Architecture:
 *   SQL Trigger → db_change_log → this poller → Socket.IO → React UI
 * =====================================================================
 */

import { getIO } from './socket-io-server.js';

// ── Configuration ──────────────────────────────────────────────────────
const POLL_INTERVAL_MS   = 3000;   // how often to poll (ms)
const BATCH_SIZE         = 20;     // max rows per poll cycle
const PURGE_INTERVAL_MS  = 3_600_000; // purge old processed rows every 1h

// Priority → notification type mapping
const PRIORITY_TYPE = {
  critical: 'error',
  high:     'warning',
  normal:   'info',
};

// Action → default notification type (overrides PRIORITY_TYPE for nice toasts)
const ACTION_TYPE = {
  INSERT: 'success',
  UPDATE: 'info',
  DELETE: 'error',
};

// ── Module state ────────────────────────────────────────────────────────
let _pool     = null;
let _sql      = null;
let _timer    = null;
let _purge    = null;
let _running  = false;
let _lastId   = 0;    // highest id we have already processed

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Start the database observer.
 * @param {import('mssql').ConnectionPool} pool  – active mssql pool
 * @param {import('mssql')}               sql   – mssql module
 */
export function startDatabaseObserver(pool, sql) {
  if (_running) {
    console.warn('[Observer] Already running — ignoring duplicate start()');
    return;
  }
  _pool    = pool;
  _sql     = sql;
  _running = true;

  console.log('🔭 [Observer] Database observer started. Polling every', POLL_INTERVAL_MS, 'ms…');

  // Warm up: find the highest already-processed id so we don't replay history
  _warmUp().then(() => {
    _timer = setInterval(_pollOnce, POLL_INTERVAL_MS);
    _purge = setInterval(_purgeProcessed, PURGE_INTERVAL_MS);
  }).catch(err => {
    console.error('[Observer] Warm-up failed:', err.message);
    // Still start polling even if warm-up fails
    _timer = setInterval(_pollOnce, POLL_INTERVAL_MS);
    _purge = setInterval(_purgeProcessed, PURGE_INTERVAL_MS);
  });
}

/**
 * Stop the observer (useful for clean shutdown).
 */
export function stopDatabaseObserver() {
  _running = false;
  if (_timer) clearInterval(_timer);
  if (_purge) clearInterval(_purge);
  _timer = _purge = null;
  console.log('🔭 [Observer] Stopped.');
}

// ── Internal helpers ────────────────────────────────────────────────────

async function _warmUp() {
  const req = _pool.request();
  const res = await req.query(`
    SELECT ISNULL(MAX(id), 0) AS max_id
    FROM [FTSS].[dbo].[db_change_log]
    WHERE is_processed = 1
  `);
  _lastId = res.recordset[0]?.max_id ?? 0;
  console.log(`[Observer] Warm-up complete. Resuming from id > ${_lastId}`);
}

async function _pollOnce() {
  if (!_pool || !_running) return;

  try {
    // Fetch unprocessed rows newer than our last known id
    const req = _pool.request();
    req.input('lastId',    _sql.BigInt, _lastId);
    req.input('batchSize', _sql.Int,    BATCH_SIZE);

    const result = await req.query(`
      SELECT TOP (@batchSize)
        id, table_name, action, entity_id, entity_label,
        old_value, new_value, priority, created_at
      FROM [FTSS].[dbo].[db_change_log]
      WHERE id > @lastId
        AND is_processed = 0
      ORDER BY id ASC
    `);

    const rows = result.recordset;
    if (!rows.length) return;

    const ids  = rows.map(r => r.id);
    const maxId = Math.max(...ids);

    // Process each row — persist to notifications table then broadcast
    for (const row of rows) {
      await _saveNotification(row);
      _broadcast(row);
    }

    // Mark as processed in one UPDATE
    const idList = ids.join(',');
    const upd = _pool.request();
    await upd.query(`
      UPDATE [FTSS].[dbo].[db_change_log]
      SET is_processed = 1
      WHERE id IN (${idList})
    `);

    _lastId = maxId;

    console.log(`[Observer] Processed ${rows.length} change(s). Last id = ${_lastId}`);
  } catch (err) {
    console.error('[Observer] Poll error:', err.message);
  }
}

async function _saveNotification(row) {
  try {
    const title      = _buildTitle(row);
    const tableLabel = _tableFriendlyName(row.table_name);
    const notifType  = ACTION_TYPE[row.action] || PRIORITY_TYPE[row.priority] || 'info';
    const tbl        = (row.table_name || '').toLowerCase();

    // For transac rows: parse new_value JSON so the UI can display rich fields
    // instead of showing a raw JSON dump.
    let enriched = {
      table:     row.table_name,
      entity_id: String(row.entity_id || ''),
    };
    let message = row.entity_label || `${tableLabel} #${row.entity_id}`;

    if (tbl === 'transac') {
      const src = row.new_value || row.old_value || null;
      if (src) {
        try {
          const parsed = JSON.parse(src);
          const plate  = parsed.plate || null;
          const driver = parsed.driver || null;
          if (plate)              enriched.plate        = plate;
          if (driver)             enriched.driver       = driver;
          if (parsed.status)      enriched.trans_status = parsed.status;
          if (parsed.net_weight != null)   enriched.net_weight   = String(parsed.net_weight);
          if (parsed.gross_weight != null) enriched.gross_weight = String(parsed.gross_weight);
          if (parsed.tare_weight != null)  enriched.tare_weight  = String(parsed.tare_weight);
          if (parsed.product || parsed.product_name) enriched.product = parsed.product || parsed.product_name;
          if (parsed.trans_no) enriched.trans_no = parsed.trans_no;

          // Build a cleaner message line
          const parts = [];
          if (plate)  parts.push(`[${plate}]`);
          if (driver) parts.push(`Driver: ${driver}`);
          if (parts.length) message = parts.join(' · ');
        } catch { /* keep defaults */ }
      }
    } else {
      // For non-transac tables keep old/new for diff display
      if (row.old_value) enriched.old_value = row.old_value;
      if (row.new_value) enriched.new_value = row.new_value;
    }

    const metadata = JSON.stringify(enriched);

    const req = _pool.request();
    // For transac rows, populate trans_id + trans_no columns too
    const transIdVal  = (tbl === 'transac' && row.entity_id && !isNaN(Number(row.entity_id))) ? Number(row.entity_id) : null;
    const transNoVal  = enriched.trans_no || null;
    await req
      .input('username', _sql.NVarChar, 'system')
      .input('type',     _sql.NVarChar, notifType)
      .input('title',    _sql.NVarChar, title)
      .input('message',  _sql.NVarChar, message)
      .input('action',   _sql.NVarChar, row.action)
      .input('metadata', _sql.NVarChar, metadata)
      .query(`
        INSERT INTO [FTSS].[dbo].[notifications]
          ([username], [type], [title], [message], [action], [trans_id], [trans_no], [metadata])
        VALUES
          (@username, @type, @title, @message, @action,
           ${transIdVal !== null ? transIdVal : 'NULL'},
           ${transNoVal ? `'${transNoVal.replace(/'/g, "''")}'` : 'NULL'},
           @metadata)
      `);

    console.log(`[Observer] 💾 Saved notification for ${row.table_name} #${row.entity_id}`);
  } catch (err) {
    // Non-fatal: still broadcast even if DB save fails
    console.error('[Observer] Failed to save notification:', err.message);
  }
}

async function _purgeProcessed() {
  if (!_pool) return;
  try {
    const req = _pool.request();
    await req.query(`EXEC [FTSS].[dbo].[sp_purge_change_log]`);
    console.log('[Observer] Old change log entries purged.');
  } catch (err) {
    console.error('[Observer] Purge error:', err.message);
  }
}

function _broadcast(row) {
  let io;
  try {
    io = getIO();
  } catch {
    console.warn('[Observer] Socket.IO not ready — skipping broadcast.');
    return;
  }

  const tableLabel = _tableFriendlyName(row.table_name);
  const notifType  = ACTION_TYPE[row.action] || PRIORITY_TYPE[row.priority] || 'info';
  const isCritical = row.priority === 'critical';
  const tbl        = (row.table_name || '').toLowerCase();

  // ── Always emit data_changed so all UI panels / tables refresh ──────
  io.emit('data_changed', {
    source:    'db_observer',
    table:     row.table_name,
    action:    row.action,
    entity_id: row.entity_id,
    timestamp: row.created_at,
    priority:  row.priority,
  });

  const title   = _buildTitle(row);
  const message = row.entity_label || `${tableLabel} #${row.entity_id}`;

  const notification = {
    id:        `obs_${row.id}_${Date.now()}`,
    type:      notifType,
    title,
    message,
    action:    row.action,
    priority:  row.priority,
    table:     row.table_name,
    entity_id: row.entity_id,
    username:  'system',
    timestamp: row.created_at,

    // Keep critical notifications (deletes) visible until dismissed
    autoHide:  !isCritical,
    duration:  isCritical ? 0 : 6000,

    // Old / new value snapshots
    old_value: row.old_value ? _tryParse(row.old_value) : null,
    new_value: row.new_value ? _tryParse(row.new_value) : null,

    clickable: false,
  };

  // Toast push to ALL connected clients
  io.emit('new_notification', notification);

  console.log(`[Observer] 📢 Broadcast [${row.priority.toUpperCase()}] ${title}`);
}

function _buildTitle(row) {
  const icons = {
    transac:  { INSERT: '✅', UPDATE: '📝', DELETE: '🗑️' },
    trucks:   { INSERT: '🚛', UPDATE: '🚛', DELETE: '🚛' },
    drivers:  { INSERT: '👤', UPDATE: '👤', DELETE: '👤' },
    products: { INSERT: '📦', UPDATE: '📦', DELETE: '📦' },
    users:    { INSERT: '🔒', UPDATE: '🔒', DELETE: '🔒' },
  };
  const verbs = {
    INSERT: 'Entry',
    UPDATE: row.priority === 'high' || row.priority === 'critical' ? '⚠️ Modified' : 'Updated',
    DELETE: '🚨 Deleted',
  };

  const tbl  = row.table_name?.toLowerCase() ?? '';
  const icon = icons[tbl]?.[row.action] ?? '🔔';
  const verb = verbs[row.action] ?? 'Changed';

  // Special label for new transac rows (operator-entered truck transaction)
  if (tbl === 'transac' && row.action === 'INSERT') {
    return `📋 New Transaction Entry`;
  }

  return `${icon} ${_tableFriendlyName(row.table_name)} ${verb}`;
}

function _tableFriendlyName(name) {
  const map = {
    transac:  'Transaction',
    trucks:   'Truck',
    drivers:  'Driver',
    products: 'Product',
    users:    'User Account',
  };
  return map[(name || '').toLowerCase()] ?? name ?? 'Record';
}

function _tryParse(str) {
  try { return JSON.parse(str); } catch { return str; }
}

export default { startDatabaseObserver, stopDatabaseObserver };
