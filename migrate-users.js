import dotenv from 'dotenv';
import sql from 'mssql';
import bcrypt from 'bcrypt';

dotenv.config();

const saltRounds = 10; // Computational cost for security

const hardcodedUsers = [
    { username: 'Administrator', password: 'YourRealPasswordHere' },
    { username: 'tatwa_admin', password: 'M3tpower' }
];

const serverName = process.env.DB_SERVER || 'localhost';
const instanceName = (process.env.DB_INSTANCE || '').trim();
const hasInstance = Boolean(instanceName);
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
    ...(hasInstance && !dbPort ? { instanceName } : {}),
    connectionTimeout: 600000,
    requestTimeout: 600000,
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 }
};

async function migrateUsers() {
    let pool;
    try {
        console.log('Connecting to SQL Server...');
        pool = await sql.connect(dbConfig);
        console.log('✅ Connected successfully');
        
        // Optional: Create users table if it doesn't exist
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'users')
            BEGIN
                CREATE TABLE dbo.users (
                    id INT PRIMARY KEY IDENTITY(1,1),
                    username NVARCHAR(255) UNIQUE NOT NULL,
                    password NVARCHAR(255) NOT NULL,
                    created_at DATETIME DEFAULT GETUTCDATE(),
                    updated_at DATETIME DEFAULT GETUTCDATE()
                );
                PRINT 'Created dbo.users table';
            END
        `);
        
        for (let user of hardcodedUsers) {
            try {
                // Create the hash (one-way transformation)
                const hashedPassword = await bcrypt.hash(user.password, saltRounds);
                
                // Insert into your actual FTSS users table
                const request = pool.request();
                request.input('username', sql.NVarChar, user.username);
                request.input('password', sql.NVarChar, hashedPassword);
                
                await request.query(`
                    INSERT INTO dbo.users (username, password) 
                    VALUES (@username, @password)
                `);
                
                console.log(`✅ Migrated: ${user.username}`);
            } catch (userErr) {
                if (userErr.message.includes('Violation of PRIMARY KEY constraint') || 
                    userErr.message.includes('Violation of UNIQUE KEY constraint')) {
                    console.log(`⚠️  ${user.username} already exists, skipping...`);
                } else {
                    console.error(`❌ Failed to migrate ${user.username}:`, userErr.message);
                }
            }
        }
        
        console.log('\n✅ User migration completed!');
    } catch (err) {
        console.error("❌ Migration failed:", err.message);
        process.exit(1);
    } finally {
        if (pool) {
            await pool.close();
        }
    }
}

migrateUsers();
