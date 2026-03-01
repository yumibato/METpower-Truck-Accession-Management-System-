import dotenv from 'dotenv';
import sql from 'mssql';

dotenv.config();

const serverName = process.env.DB_SERVER || 'localhost';
const instanceName = (process.env.DB_INSTANCE || '').trim();
const dbPort = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : undefined;

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: serverName,
  port: dbPort,
  database: process.env.DB_DATABASE || 'FTSS',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
    ...(instanceName && !dbPort ? { instanceName } : {})
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 }
};

async function cleanupOldTrash() {
  let pool;
  try {
    console.log('🗑️  Starting trash cleanup...');
    pool = await sql.connect(dbConfig);
    console.log('✅ Connected to SQL Server');

    // Default: delete trash older than 30 days
    const daysOld = parseInt(process.argv[2] || '30', 10);

    const request = pool.request();
    request.input('daysOld', sql.Int, daysOld);

    console.log(`⏳ Deleting records with deleted_at > ${daysOld} days ago...`);

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
    console.log(`✅ Cleanup complete! Permanently deleted ${deletedCount} old trash items.`);
  } catch (err) {
    console.error('❌ Cleanup failed:', err.message);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

cleanupOldTrash();
