import dotenv from 'dotenv';
import sql from 'mssql';
import bcrypt from 'bcrypt';

dotenv.config();

const saltRounds = 10;

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

async function createAdminUser() {
    let pool;
    try {
        console.log('Connecting to SQL Server...');
        pool = await sql.connect(dbConfig);
        console.log('✅ Connected successfully');
        
        const username = 'admin';
        const plainPassword = 'M3tp0w3r';
        
        // Hash the password so it's stored securely
        console.log(`Hashing password for user '${username}'...`);
        const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);
        
        const request = pool.request();
        request.input('username', sql.NVarChar, username);
        request.input('password', sql.NVarChar, hashedPassword);
        
        await request.query(`
            INSERT INTO dbo.users (username, password) 
            VALUES (@username, @password)
        `);
        
        console.log("✅ User 'admin' created successfully with a hashed password.");
    } catch (err) {
        if (err.message.includes('Violation of PRIMARY KEY constraint') || 
            err.message.includes('Violation of UNIQUE KEY constraint')) {
            console.log("⚠️  User 'admin' already exists in the database.");
        } else {
            console.error("❌ Error creating user:", err.message);
        }
    } finally {
        if (pool) {
            await pool.close();
        }
    }
}

createAdminUser();
