/**
 * Run database migrations
 * This script runs all pending migrations in sequence
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

// List of migrations to run in order
const migrations = [
  'migration-realtime-notifications.sql',
  'migration-trash-feature.sql',
  'migration-plant-analytics.sql',
];

async function executeBatches(pool, sql) {
  const batches = sql
    .split(/^\s*GO\s*$/mi)
    .map(batch => batch.trim())
    .filter(batch => batch.length > 0);

  console.log(`  📦 Found ${batches.length} SQL batches`);

  for (let i = 0; i < batches.length; i++) {
    try {
      await pool.request().query(batches[i]);
    } catch (batchError) {
      console.error(`  ❌ Error in batch ${i + 1}:`, batchError.message);
      throw batchError;
    }
  }
}

async function runMigrations() {
  let pool;
  try {
    console.log('🔌 Connecting to SQL Server...');
    pool = await sql.connect(config);
    console.log('✅ Connected to database\n');

    for (const migrationFile of migrations) {
      try {
        console.log(`📖 Running migration: ${migrationFile}`);
        const migrationSQL = await fs.readFile(`./${migrationFile}`, 'utf8');
        await executeBatches(pool, migrationSQL);
        console.log(`✅ Migration completed: ${migrationFile}\n`);
      } catch (error) {
        console.error(`❌ Migration failed: ${migrationFile}`);
        console.error(error.message);
        throw error;
      }
    }

    console.log('🎉 All migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration process failed:', error.message);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

runMigrations();
