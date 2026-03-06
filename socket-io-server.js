/**
 * =====================================================
 * Real-Time Notifications with Socket.IO
 * =====================================================
 * This module handles WebSocket connections and broadcasts
 * transaction events to all connected clients in real-time.
 * =====================================================
 */

import { Server } from 'socket.io';

let io = null;

/**
 * Initialize Socket.IO server
 * @param {http.Server} httpServer - HTTP server instance
 * @param {string} clientOrigin - Allowed CORS origin
 */
export function initializeSocketIO(httpServer, clientOrigin = '*') {
  io = new Server(httpServer, {
    cors: {
      origin: clientOrigin,
      methods: ['GET', 'POST'],
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Handle user authentication
    socket.on('authenticate', (userData) => {
      socket.userData = userData;
      console.log(`✅ User authenticated: ${userData.username} (${socket.id})`);
      
      // Join user-specific room for targeted notifications
      if (userData.userId) {
        socket.join(`user_${userData.userId}`);
      }
      
      // Join role-specific room
      if (userData.role) {
        socket.join(`role_${userData.role}`);
      }
    });

    // Handle manual notification fetch request
    socket.on('fetch_unread_count', async (userId) => {
      // This would query the database for unread count
      // Implementation depends on your database setup
      console.log(`📬 Fetch unread count requested for user: ${userId}`);
    });

    // Handle mark as read
    socket.on('mark_read', (notificationId) => {
      console.log(`✓ Notification ${notificationId} marked as read`);
    });

    socket.on('disconnect', () => {
      const username = socket.userData?.username || 'Unknown';
      console.log(`🔌 Client disconnected: ${username} (${socket.id})`);
    });

    socket.on('error', (error) => {
      console.error(`❌ Socket error for ${socket.id}:`, error);
    });
  });

  console.log('✅ Socket.IO initialized and ready for real-time notifications');
  return io;
}

/**
 * Get the Socket.IO instance
 */
export function getIO() {
  if (!io) {
    throw new Error('Socket.IO not initialized! Call initializeSocketIO() first');
  }
  return io;
}

/**
 * Broadcast notification to all connected clients
 * @param {Object} notification - Notification object
 */
export function broadcastNotification(notification) {
  if (!io) {
    console.warn('⚠️ Socket.IO not initialized. Cannot broadcast notification.');
    return;
  }

  console.log(`📢 Broadcasting notification: ${notification.title}`);
  io.emit('new_notification', notification);
}

/**
 * Send notification to specific user
 * @param {number} userId - User ID
 * @param {Object} notification - Notification object
 */
export function sendToUser(userId, notification) {
  if (!io) {
    console.warn('⚠️ Socket.IO not initialized. Cannot send notification.');
    return;
  }

  console.log(`📧 Sending notification to user ${userId}: ${notification.title}`);
  io.to(`user_${userId}`).emit('new_notification', notification);
}

/**
 * Send notification to all users with specific role
 * @param {string} role - User role (admin, user, etc.)
 * @param {Object} notification - Notification object
 */
export function sendToRole(role, notification) {
  if (!io) {
    console.warn('⚠️ Socket.IO not initialized. Cannot send notification.');
    return;
  }

  console.log(`👥 Sending notification to role ${role}: ${notification.title}`);
  io.to(`role_${role}`).emit('new_notification', notification);
}

/**
 * Create and broadcast activity notification
 * @param {string} action - Action type (CREATE, UPDATE, DELETE, RESTORE)
 * @param {Object} transaction - Transaction data
 * @param {string} username - Username who performed the action
 * @param {Object} pool - SQL connection pool
 */
export async function notifyActivity(action, transaction, username, pool) {
  if (!io || !pool) return;

  const notificationTypes = {
    CREATE: { type: 'success', icon: '✅', verb: 'created' },
    UPDATE: { type: 'info', icon: '📝', verb: 'updated' },
    DELETE: { type: 'warning', icon: '🗑️', verb: 'moved to trash' },
    RESTORE: { type: 'success', icon: '♻️', verb: 'restored' },
    BULK_DELETE: { type: 'warning', icon: '📦', verb: 'bulk deleted' },
    BULK_RESTORE: { type: 'success', icon: '📦', verb: 'bulk restored' },
    BULK_STATUS_UPDATE: { type: 'info', icon: '📦', verb: 'bulk updated' }
  };

  const config = notificationTypes[action] || { type: 'info', icon: '📋', verb: 'modified' };
  
  const transNo = transaction.trans_no || transaction.id || 'N/A';
  const plate = transaction.plate || 'Unknown';
  const driver = transaction.driver || '';

  const notification = {
    id: Date.now().toString(),
    type: config.type,
    title: `${config.icon} Transaction ${config.verb}`,
    message: `Truck [${plate}]${driver ? ` - Driver: ${driver}` : ''} (${transNo})`,
    action,
    trans_id: transaction.id,
    trans_no: transNo,
    username,
    timestamp: new Date().toISOString(),
    clickable: true,
    autoHide: action !== 'DELETE', // Keep delete notifications visible
    duration: 5000
  };

  try {
    // Store in database for notification history
    const request = pool.request();
    await request
      .input('username', username)
      .input('type', notification.type)
      .input('title', notification.title)
      .input('message', notification.message)
      .input('action', action)
      .input('trans_id', transaction.id)
      .input('trans_no', transNo)
      .input('metadata', JSON.stringify({ plate, driver }))
      .execute('sp_create_notification');

    console.log(`💾 Notification saved to database: ${notification.title}`);
  } catch (error) {
    console.error('❌ Error saving notification to database:', error);
  }

  // Broadcast notification to all connected clients
  broadcastNotification(notification);

  // Also emit a lightweight data_changed event so UI components can
  // refresh immediately without needing to subscribe to full notifications
  if (io) {
    io.emit('data_changed', {
      action,
      trans_id: transaction.id,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Get statistics about connected clients
 */
export function getConnectionStats() {
  if (!io) return { connected: 0, rooms: [] };

  const sockets = io.sockets.sockets;
  const rooms = Array.from(io.sockets.adapter.rooms.keys());
  
  return {
    connected: sockets.size,
    rooms: rooms.filter(room => !rooms.includes(room)) // Filter out socket IDs
  };
}

export default {
  initializeSocketIO,
  getIO,
  broadcastNotification,
  sendToUser,
  sendToRole,
  notifyActivity,
  getConnectionStats
};
