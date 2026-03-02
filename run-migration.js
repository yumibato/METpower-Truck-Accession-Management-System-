/**
 * Run the notifications table migration
 * This script creates the notifications table and stored procedures
 */

import sql from 'mssql';
import { promises as fs } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_DATABASE || 'FTSS',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
};

async function runMigration() {
  try {
    console.log('🔌 Connecting to SQL Server...');
    const pool = await sql.connect(config);
    console.log('✅ Connected to database');

    console.log('📖 Reading migration file...');
    const migrationSQL = await fs.readFile('./migration-realtime-notifications.sql', 'utf8');

    // Split by GO statements and execute each batch
    const batches = migrationSQL
      .split(/^\s*GO\s*$/mi)
      .map(batch => batch.trim())
      .filter(batch => batch.length > 0);

    console.log(`📦 Found ${batches.length} SQL batches to execute`);

    for (let i = 0; i < batches.length; i++) {
      try {
        console.log(`⏳ Executing batch ${i + 1}/${batches.length}...`);
        await pool.request().query(batches[i]);
        console.log(`✅ Batch ${i + 1} completed`);
      } catch (batchError) {
        console.error(`❌ Error in batch ${i + 1}:`, batchError.message);
        throw batchError;
      }
    }

    console.log('✅ Migration completed successfully!');
    console.log('📊 Created:');
    console.log('   - notifications table');
    console.log('   - sp_create_notification stored procedure');
    console.log('   - sp_mark_notifications_read stored procedure');
    console.log('   - vw_unread_notification_counts view');
    console.log('   - 3 performance indexes');

    await pool.close();
    console.log('👋 Connection closed');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
