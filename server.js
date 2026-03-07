import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import sql from 'mssql';
import bcrypt from 'bcrypt';
import { createServer } from 'http';
import { setupTrashRoutes } from './trash-routes.js';
import { logAuditEntry, extractUsername, extractUserId } from './audit-utils.js';
import { initializeSocketIO, notifyActivity } from './socket-io-server.js';
import { startDatabaseObserver } from './db-observer.js';

dotenv.config();

const app = express();
const allowedOrigin = process.env.CLIENT_ORIGIN || '*';
app.use(cors({ 
  origin: allowedOrigin,
  credentials: true 
}));
app.use(express.json());
app.use(express.static('public'));

const serverName = process.env.DB_SERVER || 'localhost';
const instanceName = (process.env.DB_INSTANCE || '').trim();
const hasInstance = Boolean(instanceName);
const dbPort = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : undefined;
const port = parseInt(process.env.PORT || '3001', 10);

const config = {
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
    connectionTimeout: 600000, // 10 minutes connection timeout
    requestTimeout: 600000, // 10 minutes query timeout for large exports
  },
  pool: { 
    max: 10, 
    min: 0, 
    idleTimeoutMillis: 30000,
    acquireTimeoutMillis: 600000, // 10 minutes to acquire connection
  }
};

console.log('Attempting to connect to SQL Server...');
console.log('Server:', config.server);
if (hasInstance && !dbPort) {
  console.log('Instance:', instanceName);
}
console.log('Database:', config.database);
console.log('User:', config.user || '(not set)');

if (hasInstance && dbPort) {
  console.warn('Both DB_INSTANCE and DB_PORT are set. Using DB_PORT and ignoring DB_INSTANCE.');
}

const TRANSAC_COLUMNS = [
  'id',
  'trans_no',
  'barge_details',
  'plate',
  'initial_net_wt',
  'inbound',
  'outbound',
  'driver',
  'type_veh',
  'product',
  'ws_no',
  'dr_no',
  'del_comp',
  'del_address',
  'gross_weight',
  'tare_weight',
  'net_weight',
  'inbound_wt',
  'outbound_wt',
  'remarks',
  'transac_date',
  'date',
  'status',
  'vessel_id',
  'weigher',
  'no_of_bags'
];

const SORTABLE_COLUMNS = {
  id: 'id',
  trans_no: 'trans_no',
  barge_details: 'barge_details',
  plate: 'plate',
  initial_net_wt: 'initial_net_wt',
  inbound: 'inbound',
  outbound: 'outbound',
  driver: 'driver',
  type_veh: 'type_veh',
  product: 'product',
  ws_no: 'ws_no',
  dr_no: 'dr_no',
  del_comp: 'del_comp',
  del_address: 'del_address',
  gross_weight: 'gross_weight',
  tare_weight: 'tare_weight',
  net_weight: 'net_weight',
  inbound_wt: 'inbound_wt',
  outbound_wt: 'outbound_wt',
  remarks: 'remarks',
  transac_date: 'transac_date',
  date: '[date]',
  status: 'status',
  vessel_id: 'vessel_id',
  weigher: 'weigher',
  no_of_bags: 'no_of_bags'
};

// Date format conversion function
const convertDateFormat = (searchTerm) => {
  const term = searchTerm.toLowerCase().trim();
  
  // Month name to number conversion
  const monthMap = {
    'jan': '01', 'january': '01',
    'feb': '02', 'february': '02', 
    'mar': '03', 'march': '03',
    'apr': '04', 'april': '04',
    'may': '05',
    'jun': '06', 'june': '06',
    'jul': '07', 'july': '07',
    'aug': '08', 'august': '08',
    'sep': '09', 'september': '09',
    'oct': '10', 'october': '10',
    'nov': '11', 'november': '11',
    'dec': '12', 'december': '12'
  };
  
  // Check if term matches any month name
  if (monthMap[term]) {
    return monthMap[term];
  }
  
  // Check for patterns like "Nov 2025", "November-2025", etc.
  const monthYearPattern = /^(\w{3,9})[\s\-\/](\d{4})$/i;
  const monthYearMatch = term.match(monthYearPattern);
  if (monthYearMatch && monthMap[monthYearMatch[1].toLowerCase()]) {
    return `${monthMap[monthYearMatch[1].toLowerCase()]}-${monthYearMatch[2]}`;
  }
  
  // Check for multiple date patterns to handle all formats
  // Try to match common date formats more directly
  const datePatterns = [
    // Pattern 1: Table format "MMM dd, yyyy HH:mm" like "Aug 13, 2025 23:54"
    /^(\w{3})\s+(\d{1,2}),\s+(\d{4})\s+(\d{1,2}:\d{2})$/i,
    // Pattern 2: "Month Day, Year" like "Aug 13, 2025" or "August 13, 2025"
    /^(\w{3,9})\s+(\d{1,2}),\s+(\d{4})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s?[AP]M)?))?$/i,
    // Pattern 3: "Month Day Year" like "Aug 13 2025" or "August 13 2025"
    /^(\w{3,9})\s+(\d{1,2})\s+(\d{4})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s?[AP]M)?))?$/i
  ];
  
  for (const pattern of datePatterns) {
    const match = term.match(pattern);
    if (match && monthMap[match[1].toLowerCase()]) {
      const month = monthMap[match[1].toLowerCase()];
      const day = String(match[2]).padStart(2, '0');
      const year = match[3];
      const time = match[4] || '';
      
      const baseDate = `${year}-${month}-${day}`;
      
      // If there's a time component, return both the full datetime and just the time part
      if (time) {
        return [baseDate + time, time]; // Return array for multiple search terms
      }
      
      return baseDate;
    }
  }
  
  // Return original term if no conversion needed
  return searchTerm;
};

const buildTransacFilters = (query) => {
  const whereClauses = [];
  const inputs = [];

  let search = (query.search || '').trim();
  const status = (query.status || '').trim();
  const rawDateFrom = query.dateFrom || null;
  const rawDateTo = query.dateTo || null;
  const useInbound = query.useInbound === 1 ? 1 : 0;

  // Clean up search term for weight values
  if (search) {
    // Remove commas, spaces, and "kg" units to handle formatted weight searches
    const cleanSearch = search
      .replace(/,/g, '')           // Remove commas
      .replace(/kg\s*$/i, '')       // Remove "kg" at end (case insensitive, with or without space)
      .replace(/\s+/g, '');        // Remove all spaces
    
    // Use both original and cleaned search terms for better matching
    const searchTerms = [search];
    if (cleanSearch !== search) {
      searchTerms.push(cleanSearch);
    }
    
    // Build search clauses for all terms
    const allSearchClauses = [];
    searchTerms.forEach((term, index) => {
      const convertedSearch = convertDateFormat(term);
      
      // Handle array results from date conversion (for datetime searches)
      const convertedTerms = Array.isArray(convertedSearch) ? convertedSearch : [convertedSearch];
      
      // Enhanced search across ALL database fields
      allSearchClauses.push(`(
        id LIKE @search${index} OR 
        trans_no LIKE @search${index} OR 
        barge_details LIKE @search${index} OR 
        plate LIKE @search${index} OR 
        initial_net_wt LIKE @search${index} OR 
        inbound LIKE @search${index} OR 
        outbound LIKE @search${index} OR 
        driver LIKE @search${index} OR 
        type_veh LIKE @search${index} OR 
        product LIKE @search${index} OR 
        ws_no LIKE @search${index} OR 
        dr_no LIKE @search${index} OR 
        del_comp LIKE @search${index} OR 
        del_address LIKE @search${index} OR 
        gross_weight LIKE @search${index} OR 
        tare_weight LIKE @search${index} OR 
        net_weight LIKE @search${index} OR 
        inbound_wt LIKE @search${index} OR 
        outbound_wt LIKE @search${index} OR 
        Remarks LIKE @search${index} OR 
        transac_date LIKE @search${index} OR 
        [date] LIKE @search${index} OR 
        status LIKE @search${index} OR 
        vessel_id LIKE @search${index} OR 
        weigher LIKE @search${index} OR 
        No_of_Bags LIKE @search${index}
      )`);
      
      // Use both original and converted search terms for better matching
      const searchValue = `%${term}%`;
      inputs.push({ name: `search${index}`, type: sql.NVarChar, value: searchValue });
      
      // If conversion happened, also add the converted terms
      convertedTerms.forEach((convTerm, convIndex) => {
        if (convTerm !== term) {
          allSearchClauses.push(`(
            transac_date LIKE @convsearch${index}_${convIndex} OR
            inbound LIKE @convsearch${index}_${convIndex} OR
            outbound LIKE @convsearch${index}_${convIndex} OR
            [date] LIKE @convsearch${index}_${convIndex} OR
            initial_net_wt LIKE @convsearch${index}_${convIndex} OR
            gross_weight LIKE @convsearch${index}_${convIndex} OR
            tare_weight LIKE @convsearch${index}_${convIndex} OR
            net_weight LIKE @convsearch${index}_${convIndex} OR
            inbound_wt LIKE @convsearch${index}_${convIndex} OR
            outbound_wt LIKE @convsearch${index}_${convIndex} OR
            No_of_Bags LIKE @convsearch${index}_${convIndex}
          )`);
          const convertedValue = `%${convTerm}%`;
          inputs.push({ name: `convsearch${index}_${convIndex}`, type: sql.NVarChar, value: convertedValue });
        }
      });
    });
    
    // Combine all search clauses with OR
    whereClauses.push(`(${allSearchClauses.join(' OR ')})`);
  }
  if (status) {
    whereClauses.push('status = @status');
    inputs.push({ name: 'status', type: sql.NVarChar, value: status });
  }

  const typeVeh = (query.typeVeh || '').trim();
  if (typeVeh) {
    whereClauses.push('type_veh = @typeVeh');
    inputs.push({ name: 'typeVeh', type: sql.NVarChar, value: typeVeh });
  }

  const product = (query.product || '').trim();
  if (product) {
    whereClauses.push('product = @product');
    inputs.push({ name: 'product', type: sql.NVarChar, value: product });
  }

  // Safe date filtering: use [date] as primary, then transac_date, then inbound
  // We work entirely with dates (no time) and rely on TRY_CONVERT to avoid crashes
  // If useInbound=1, we prefer inbound over transac_date
  const effectiveDateExpr = useInbound
    ? 'COALESCE(CAST([date] AS date), TRY_CONVERT(date, inbound), TRY_CONVERT(date, transac_date))'
    : 'COALESCE(CAST([date] AS date), TRY_CONVERT(date, transac_date), TRY_CONVERT(date, inbound))';

  const parseYyyyMmDd = (value) => {
    if (!value || typeof value !== 'string') return null;
    const parts = value.split('-');
    if (parts.length !== 3) return null;
    const [yearStr, monthStr, dayStr] = parts;
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
    // Create date at noon to avoid timezone shifting the day
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  };

  const parsedFrom = parseYyyyMmDd(rawDateFrom);
  if (parsedFrom) {
    whereClauses.push(`${effectiveDateExpr} >= @dateFrom`);
    inputs.push({ name: 'dateFrom', type: sql.Date, value: parsedFrom });
  }

  const parsedTo = parseYyyyMmDd(rawDateTo);
  if (parsedTo) {
    whereClauses.push(`${effectiveDateExpr} <= @dateTo`);
    inputs.push({ name: 'dateTo', type: sql.Date, value: parsedTo });
  }

  // Always exclude soft-deleted transactions
  whereClauses.push('COALESCE(deleted_at, CAST(NULL AS DATETIME)) IS NULL');

  return {
    whereSql: whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '',
    inputs
  };
};

const resolveSortColumn = (sortBy = 'id') => {
  const normalized = sortBy.toLowerCase();
  return SORTABLE_COLUMNS[normalized] || 'id';
};

const ALLOWED_COLUMNS = [
  'trans_no',
  'barge_details',
  'plate',
  'initial_net_wt',
  'inbound',
  'outbound',
  'driver',
  'type_veh',
  'product',
  'ws_no',
  'dr_no',
  'del_comp',
  'del_address',
  'gross_weight',
  'tare_weight',
  'net_weight',
  'inbound_wt',
  'outbound_wt',
  'Remarks',
  'transac_date',
  'date',
  'status',
  'vessel_id',
  'weigher',
  'No_of_Bags'
];

const parseId = (value) => {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const getSqlTypeForColumn = (column) => {
  const lower = column.toLowerCase();
  if (column === 'No_of_Bags') return sql.Int;
  if (
    lower.includes('weight') ||
    lower.endsWith('_wt')
  ) {
    return sql.Decimal(18, 2);
  }
  if (['transac_date', 'date', 'inbound', 'outbound'].includes(lower)) {
    return sql.DateTime2;
  }
  return sql.NVarChar;
};

const collectPayloadEntries = (payload = {}, { skipNull = false } = {}) => {
  const entries = [];
  ALLOWED_COLUMNS.forEach(column => {
    if (!Object.prototype.hasOwnProperty.call(payload, column)) return;
    const value = payload[column];
    if (value === undefined) return;
    if (skipNull && value === null) return;
    entries.push({ column, value });
  });
  return entries;
};

const applyInputs = (request, entries) => {
  entries.forEach(({ column, value }) => {
    const normalizedValue = value === '' ? null : value;
    request.input(column, getSqlTypeForColumn(column), normalizedValue);
  });
};

sql.connect(config)
  .then(async pool => {
    console.log('✅ Connected to SQL Server successfully!');

    // ── Auto-create notifications table if it doesn't exist ──────────────
    try {
      await pool.request().query(`
        IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[FTSS].[dbo].[notifications]') AND type = 'U')
        BEGIN
          CREATE TABLE [FTSS].[dbo].[notifications] (
            [id]           INT IDENTITY(1,1) PRIMARY KEY,
            [user_id]      INT NULL,
            [username]     NVARCHAR(100) NULL,
            [type]         NVARCHAR(20)  NOT NULL DEFAULT 'info',
            [title]        NVARCHAR(255) NOT NULL,
            [message]      NVARCHAR(MAX) NULL,
            [action]       NVARCHAR(50)  NULL,
            [trans_id]     INT NULL,
            [trans_no]     NVARCHAR(100) NULL,
            [is_read]      BIT DEFAULT 0,
            [is_dismissed] BIT DEFAULT 0,
            [created_at]   DATETIME DEFAULT GETDATE(),
            [read_at]      DATETIME NULL,
            [metadata]     NVARCHAR(MAX) NULL
          );
          PRINT 'notifications table created';
        END
      `);
      console.log('✅ Notifications table ready.');
    } catch (tblErr) {
      console.warn('⚠️  Could not verify notifications table:', tblErr.message);
    }

    // ── Auto-create db_change_log table if it doesn't exist ──────────────
    try {
      await pool.request().query(`
        IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[db_change_log]') AND type = 'U')
        BEGIN
          CREATE TABLE [dbo].[db_change_log] (
            [id]           BIGINT IDENTITY(1,1) PRIMARY KEY,
            [table_name]   NVARCHAR(100)  NOT NULL,
            [action]       NVARCHAR(10)   NOT NULL,
            [entity_id]    NVARCHAR(100)  NULL,
            [entity_label] NVARCHAR(500)  NULL,
            [old_value]    NVARCHAR(MAX)  NULL,
            [new_value]    NVARCHAR(MAX)  NULL,
            [priority]     NVARCHAR(10)   NOT NULL DEFAULT 'normal',
            [is_processed] BIT            NOT NULL DEFAULT 0,
            [created_at]   DATETIME2      NOT NULL DEFAULT GETDATE()
          );
          CREATE INDEX IX_db_change_log_proc ON [dbo].[db_change_log]([is_processed],[created_at]);
          PRINT 'db_change_log table created';
        END
      `);
      console.log('✅ db_change_log table ready.');
    } catch (clErr) {
      console.warn('⚠️  Could not verify db_change_log table:', clErr.message);
    }

    // ── Auto-create / refresh transac observer trigger ───────────────────
    try {
      await pool.request().query(`
        CREATE OR ALTER TRIGGER [dbo].[trg_transac_observer]
        ON [dbo].[transac]
        AFTER INSERT, UPDATE, DELETE
        AS
        BEGIN
          SET NOCOUNT ON;
          DECLARE @action       NVARCHAR(10),
                  @entity_id    NVARCHAR(100),
                  @entity_label NVARCHAR(500),
                  @old_val      NVARCHAR(MAX),
                  @new_val      NVARCHAR(MAX),
                  @priority     NVARCHAR(10);

          SET @action = CASE
            WHEN EXISTS(SELECT 1 FROM inserted) AND EXISTS(SELECT 1 FROM deleted) THEN 'UPDATE'
            WHEN EXISTS(SELECT 1 FROM inserted) THEN 'INSERT'
            ELSE 'DELETE'
          END;

          IF @action IN ('INSERT','UPDATE')
          BEGIN
            SELECT TOP 1
              @entity_id    = CAST(i.id AS NVARCHAR(100)),
              @entity_label = ISNULL(i.trans_no, '#' + CAST(i.id AS NVARCHAR(100)))
                              + ' | Plate: '  + ISNULL(i.plate, '?')
                              + ' | Driver: ' + ISNULL(i.driver, '?')
            FROM inserted i;
            SET @new_val = (SELECT TOP 1 id,trans_no,plate,driver,status,gross_weight,net_weight,tare_weight FROM inserted FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
          END

          IF @action IN ('UPDATE','DELETE')
          BEGIN
            IF @entity_id IS NULL
              SELECT TOP 1
                @entity_id    = CAST(d.id AS NVARCHAR(100)),
                @entity_label = ISNULL(d.trans_no, '#' + CAST(d.id AS NVARCHAR(100)))
                                + ' | Plate: '  + ISNULL(d.plate, '?')
                                + ' | Driver: ' + ISNULL(d.driver, '?')
              FROM deleted d;
            SET @old_val = (SELECT TOP 1 id,trans_no,plate,driver,status,gross_weight,net_weight,tare_weight FROM deleted FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
          END

          SET @priority = CASE WHEN @action = 'DELETE' THEN 'critical' ELSE 'normal' END;

          BEGIN TRY
            INSERT INTO [dbo].[db_change_log]
              (table_name, action, entity_id, entity_label, old_value, new_value, priority)
            VALUES
              ('transac', @action, @entity_id, @entity_label, @old_val, @new_val, @priority);
          END TRY
          BEGIN CATCH
            -- Non-fatal: swallow so the original DML still succeeds
          END CATCH
        END
      `);
      console.log('✅ trg_transac_observer trigger ready.');
    } catch (trgErr) {
      console.warn('⚠️  Could not create transac trigger:', trgErr.message);
    }
    // ─────────────────────────────────────────────────────────────────────
    
    // Login endpoint with database-driven authentication
    app.post('/api/login', async (req, res) => {
      const { username, password } = req.body;

      // Validate inputs
      if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
      }

      try {
        const request = pool.request();
        request.input('username', sql.NVarChar, username);
        const result = await request.query('SELECT TOP 1 * FROM dbo.users WHERE Username = @username');

        const user = result.recordset[0];

        if (!user) {
          return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Compare the submitted password with the hashed password in DB
        const passwordHash = user.Password ?? user.password ?? user.password_hash ?? user.PasswordHash ?? null;
        if (!passwordHash) {
          console.error('Login error: password hash column not found in dbo.users');
          return res.status(500).json({ message: 'Server auth configuration error' });
        }

        const isMatch = await bcrypt.compare(password, passwordHash);

        if (isMatch) {
          const userId = user.id ?? user.ID ?? user.user_id ?? user.User_ID ?? user.userid ?? null;
          const resolvedUsername = user.Username ?? user.username ?? username;
          // Success: Return user info (not password)
          res.json({
            success: true,
            message: 'Login successful',
            user: { id: userId, username: resolvedUsername }
          });
        } else {
          return res.status(401).json({ message: 'Invalid credentials' });
        }
      } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'Server error during login' });
      }
    });

    // Health check endpoint
    app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Filter options – distinct values for dropdowns
    app.get('/api/transac/filter-options', async (req, res) => {
      try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query(`
          SELECT DISTINCT type_veh FROM TRANSAC WHERE type_veh IS NOT NULL AND type_veh <> '' AND COALESCE(deleted_at, CAST(NULL AS DATETIME)) IS NULL ORDER BY type_veh;
          SELECT DISTINCT product   FROM TRANSAC WHERE product   IS NOT NULL AND product   <> '' AND COALESCE(deleted_at, CAST(NULL AS DATETIME)) IS NULL ORDER BY product;
          SELECT DISTINCT status    FROM TRANSAC WHERE status    IS NOT NULL AND status    <> '' AND COALESCE(deleted_at, CAST(NULL AS DATETIME)) IS NULL ORDER BY status;
        `);
        res.json({
          vehicles : (result.recordsets[0] || []).map(r => r.type_veh),
          products : (result.recordsets[1] || []).map(r => r.product),
          statuses : (result.recordsets[2] || []).map(r => r.status),
        });
      } catch (err) {
        console.error('Filter options error:', err);
        res.status(500).json({ error: err.message });
      }
    });

    // Transaction data endpoint with pagination/filtering
    app.get('/api/transac', async (req, res) => {
      try {
        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize || '20', 10)));
        const offset = (page - 1) * pageSize;
        const sortBy = resolveSortColumn(req.query.sortBy || 'id');
        const sortDir = (req.query.sortDir || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        // Optional year/month handling (server expands to dateFrom/dateTo)
        const year = req.query.year ? parseInt(req.query.year, 10) : null;
        const month = req.query.month ? parseInt(req.query.month, 10) : null;
        const rawDateFrom = req.query.dateFrom || null;
        const rawDateTo = req.query.dateTo || null;
        const useInbound = req.query.useInbound === '1' ? 1 : 0;

        // Basic validation
        if (year && (year < 1900 || year > 2100)) {
          return res.status(400).json({ error: 'Invalid year. Must be 1900–2100.' });
        }
        if (month && (month < 1 || month > 12)) {
          return res.status(400).json({ error: 'Invalid month. Must be 1–12.' });
        }
        if (rawDateFrom && rawDateTo && rawDateFrom > rawDateTo) {
          return res.status(400).json({ error: 'dateFrom must be <= dateTo.' });
        }

        // Server-side expansion of year/month into dateFrom/dateTo
        let dateFrom = rawDateFrom;
        let dateTo = rawDateTo;
        if (year && month) {
          dateFrom = `${year}-${String(month).padStart(2, '0')}-01`;
          const lastDay = new Date(year, month, 0).getDate(); // month is 1-based, so month+1 gives next month, day 0 gives last day of previous month
          dateTo = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        } else if (year) {
          dateFrom = `${year}-01-01`;
          dateTo = `${year}-12-31`;
        }
        // If user already passed dateFrom/dateTo, they take precedence over year/month expansion

        console.log('Date filter params:', { rawDateFrom, rawDateTo, dateFrom, dateTo, useInbound });

        const { whereSql, inputs } = buildTransacFilters({ ...req.query, dateFrom, dateTo, useInbound });
        console.log('Generated WHERE clause:', whereSql);
        console.log('SQL inputs:', inputs);
        const request = pool.request();
        inputs.forEach(({ name, type, value }) => request.input(name, type, value));
        request.input('offset', sql.Int, offset);
        request.input('pageSize', sql.Int, pageSize);

        const dataQuery = `
          SELECT
            [id],
            [trans_no],
            [barge_details],
            [plate],
            [initial_net_wt],
            [inbound],
            [outbound],
            [driver],
            [type_veh],
            [product],
            [ws_no],
            [dr_no],
            [del_comp],
            [del_address],
            [gross_weight],
            [tare_weight],
            [net_weight],
            [inbound_wt],
            [outbound_wt],
            [Remarks] AS remarks,
            [transac_date],
            [date],
            [status],
            [vessel_id],
            [weigher],
            [No_of_Bags] AS no_of_bags,
            COALESCE(
              TRY_CONVERT(datetime, [date]),
              TRY_CONVERT(datetime, [transac_date]),
              TRY_CONVERT(datetime, [inbound]),
              TRY_CONVERT(datetime, [outbound])
            ) AS resolved_date,
            COUNT(*) OVER() AS total_count
          FROM FTSS.dbo.transac
          ${whereSql}
          ORDER BY ${sortBy} ${sortDir}
          OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;
        `;

        const result = await request.query(dataQuery);
        const rows = result.recordset || [];
        const total = rows.length ? rows[0].total_count : 0;
        const cleanedRows = rows.map(({ total_count, ...rest }) => rest);

        res.json({
          rows: cleanedRows,
          page,
          pageSize,
          total
        });
      } catch (err) {
        console.error('Failed to fetch transac data:', err);
        res.status(500).json({ error: 'Failed to fetch transac data' });
      }
    });

    // Calendar data endpoint
    app.get('/api/calendar', async (req, res) => {
      try {
        const year = parseInt(req.query.year || new Date().getFullYear().toString());
        const month = parseInt(req.query.month || (new Date().getMonth() + 1).toString());
        
        // Validate month (1-12)
        if (month < 1 || month > 12) {
          return res.status(400).json({ error: 'Invalid month. Must be between 1 and 12.' });
        }
        
        // Validate year (reasonable range)
        const currentYear = new Date().getFullYear();
        if (year < currentYear - 10 || year > currentYear + 1) {
          return res.status(400).json({ error: 'Invalid year range.' });
        }
        
        // Build query to get distinct dates that have transactions
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0); // Last day of the month
        
        const dateQuery = `
          SELECT DISTINCT 
            CAST(COALESCE(CAST([date] AS date), TRY_CONVERT(date, transac_date), TRY_CONVERT(date, inbound)) AS date) as transaction_date
          FROM FTSS.dbo.transac
          WHERE COALESCE(CAST([date] AS date), TRY_CONVERT(date, transac_date), TRY_CONVERT(date, inbound)) IS NOT NULL
            AND COALESCE(CAST([date] AS date), TRY_CONVERT(date, transac_date), TRY_CONVERT(date, inbound)) >= @startDate
            AND COALESCE(CAST([date] AS date), TRY_CONVERT(date, transac_date), TRY_CONVERT(date, inbound)) <= @endDate
          ORDER BY transaction_date
        `;
        
        const request = pool.request();
        request.input('startDate', sql.Date, startDate);
        request.input('endDate', sql.Date, endDate);
        
        const result = await request.query(dateQuery);
        
        // Extract available dates
        const availableDates = result.recordset.map(row => row.transaction_date);
        
        // Build calendar days array (42 days to cover all weeks)
        const calendarDays = [];
        const firstDay = new Date(year, month - 1, 1);
        const startOfMonth = new Date(firstDay);
        startOfMonth.setDate(startOfMonth.getDate() - firstDay.getDay()); // Start from Sunday of first week
        
        for (let i = 0; i < 42; i++) {
          const currentDate = new Date(startOfMonth);
          currentDate.setDate(startOfMonth.getDate() + i);
          
          // Check if this date is in the current month and has transactions
          const isInMonth = currentDate.getMonth() === month - 1 && currentDate.getFullYear() === year;
          const hasTransactions = availableDates.some(date => {
            const availableDate = new Date(date);
            return availableDate.toDateString() === currentDate.toDateString();
          });
          
          calendarDays.push({
            date: currentDate.toISOString().split('T')[0], // YYYY-MM-DD format
            day: currentDate.getDate(),
            isInMonth,
            hasTransactions,
            isToday: currentDate.toDateString() === new Date().toDateString()
          });
        }
        
        res.json({
          year,
          month,
          availableDates,
          calendarDays,
          totalAvailable: availableDates.length
        });
        
      } catch (error) {
        console.error('Calendar data fetch failed:', error);
        res.status(500).json({ error: 'Failed to fetch calendar data' });
      }
    });

    // CSV export endpoint - must come before :id route
    app.get('/api/transac/export', async (req, res) => {
      try {
        const sortBy = resolveSortColumn(req.query.sortBy || 'id');
        const sortDir = (req.query.sortDir || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        const { whereSql, inputs } = buildTransacFilters(req.query);
        const request = pool.request();
        inputs.forEach(({ name, type, value }) => request.input(name, type, value));

        // Set longer timeout for export queries (10 minutes)
        request.timeout = 600000;

        const exportQuery = `
          SELECT
            [id],
            [trans_no],
            [barge_details],
            [plate],
            [initial_net_wt],
            [inbound],
            [outbound],
            [driver],
            [type_veh],
            [product],
            [ws_no],
            [dr_no],
            [del_comp],
            [del_address],
            [gross_weight],
            [tare_weight],
            [net_weight],
            [inbound_wt],
            [outbound_wt],
            [Remarks] AS remarks,
            [transac_date],
            [date],
            [status],
            [vessel_id],
            [weigher],
            [No_of_Bags] AS no_of_bags
          FROM FTSS.dbo.transac
          ${whereSql}
          ORDER BY ${sortBy} ${sortDir};
        `;

        // Execute query and get all results (no limit)
        const result = await request.query(exportQuery);
        const rows = result.recordset || [];
        const columns = TRANSAC_COLUMNS;
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="transac_export.csv"');

        // Write CSV header
        res.write(columns.join(',') + '\n');

        let rowCount = 0;
        
        // Process rows in chunks to manage memory
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          rowCount++;
          
          const line = columns.map(col => {
            let value = row[col];
            if (value === null || value === undefined) return '';
            const str = String(value);
            if (str.includes('"')) return `"${str.replace(/"/g, '""')}"`;
            if (str.includes(',')) return `"${str}"`;
            return str;
          }).join(',');
          
          res.write(line + '\n');
          
          // Flush response buffer periodically for large exports
          if (rowCount % 1000 === 0) {
            res.flush();
          }
        }

        console.log(`Export completed: ${rowCount} rows exported (no limit)`);
        res.end();

      } catch (error) {
        console.error('Export error:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Export failed', details: error.message });
        }
      }
    });

    // Get single transaction
    app.get('/api/transac/:id', async (req, res) => {
      const id = parseId(req.params.id);
      if (!id) {
        return res.status(400).json({ error: 'Invalid id' });
      }
      try {
        const request = pool.request().input('id', sql.Int, id);
        const result = await request.query('SELECT * FROM FTSS.dbo.transac WHERE id = @id');
        if (!result.recordset || !result.recordset.length) {
          return res.status(404).json({ error: 'Not found' });
        }
        res.json(result.recordset[0]);
      } catch (err) {
        console.error('Failed to fetch transac record:', err);
        res.status(500).json({ error: 'Server error' });
      }
    });

    // Create transaction
    app.post('/api/transac', async (req, res) => {
      try {
        const entries = collectPayloadEntries(req.body, { skipNull: true });
        if (!entries.length) {
          return res.status(400).json({ error: 'No valid fields provided' });
        }

        const columnsSql = entries.map(({ column }) => `[${column}]`).join(', ');
        const valuesSql = entries.map(({ column }) => `@${column}`).join(', ');
        const insertSql = `
          INSERT INTO FTSS.dbo.transac (${columnsSql})
          OUTPUT INSERTED.*
          VALUES (${valuesSql});
        `;

        const transaction = new sql.Transaction(pool);
        try {
          await transaction.begin();
          const request = transaction.request();
          applyInputs(request, entries);
          const result = await request.query(insertSql);
          await transaction.commit();
          
          // Log audit entry for transaction creation
          const createdTransaction = result.recordset[0];
          if (createdTransaction && createdTransaction.id) {
            const username = extractUsername(req);
            const userId = extractUserId(req);
            await logAuditEntry(pool, sql, createdTransaction.id, 'CREATE', username, userId, 'Transaction created');
            
            // Broadcast real-time notification
            try {
              await notifyActivity('CREATE', createdTransaction, username, pool);
            } catch (notifyError) {
              console.error('Failed to send real-time notification:', notifyError);
            }
          }
          
          res.status(201).json(createdTransaction);
        } catch (errInner) {
          await transaction.rollback().catch(() => {});
          console.error('Failed to insert transac record:', errInner);
          res.status(500).json({ error: 'Insert failed' });
        }
      } catch (err) {
        console.error('POST /api/transac error:', err);
        res.status(500).json({ error: 'Server error' });
      }
    });

    // Update transaction
    app.put('/api/transac/:id', async (req, res) => {
      const id = parseId(req.params.id);
      if (!id) {
        return res.status(400).json({ error: 'Invalid id' });
      }
      try {
        const entries = collectPayloadEntries(req.body || {});
        if (!entries.length) {
          return res.status(400).json({ error: 'No valid fields to update' });
        }

        const setSql = entries.map(({ column }) => `[${column}] = @${column}`).join(', ');
        const updateSql = `
          UPDATE FTSS.dbo.transac
          SET ${setSql}
          OUTPUT INSERTED.*
          WHERE id = @id;
        `;

        const transaction = new sql.Transaction(pool);
        try {
          await transaction.begin();
          const request = transaction.request();
          request.input('id', sql.Int, id);
          applyInputs(request, entries);
          const result = await request.query(updateSql);
          await transaction.commit();
          if (!result.recordset || !result.recordset.length) {
            return res.status(404).json({ error: 'Not found' });
          }
          
          // Log audit entry for transaction update
          const updatedTransaction = result.recordset[0];
          const username = extractUsername(req);
          const userId = extractUserId(req);
          const changedFields = entries.map(e => e.column).join(', ');
          await logAuditEntry(pool, sql, id, 'UPDATE', username, userId, `Updated fields: ${changedFields}`);
          
          // Broadcast real-time notification
          try {
            await notifyActivity('UPDATE', updatedTransaction, username, pool);
          } catch (notifyError) {
            console.error('Failed to send real-time notification:', notifyError);
          }
          
          res.json(updatedTransaction);
        } catch (errInner) {
          await transaction.rollback().catch(() => {});
          console.error('Failed to update transac record:', errInner);
          res.status(500).json({ error: 'Update failed' });
        }
      } catch (err) {
        console.error('PUT /api/transac/:id error:', err);
        res.status(500).json({ error: 'Server error' });
      }
    });

    // Get audit log entries for a transaction
    app.get('/api/transac/:id/audit', async (req, res) => {
      const id = parseId(req.params.id);
      if (!id) {
        return res.status(400).json({ error: 'Invalid transaction id' });
      }
      try {
        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || '20', 10)));
        const offset = (page - 1) * pageSize;

        const request = pool.request();
        request.input('transaction_id', sql.Int, id);
        request.input('offset', sql.Int, offset);
        request.input('pageSize', sql.Int, pageSize);

        // Get total count
        const countResult = await request.query(`
          SELECT COUNT(*) as total FROM [FTSS].[dbo].[audit_log] 
          WHERE transaction_id = @transaction_id
        `);
        const total = countResult.recordset[0].total;

        // Get paginated audit data
        const auditResult = await request.query(`
          SELECT id, transaction_id, user_id, username, action, details, created_at
          FROM [FTSS].[dbo].[audit_log]
          WHERE transaction_id = @transaction_id
          ORDER BY created_at DESC
          OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
        `);

        res.json({
          rows: auditResult.recordset || [],
          page,
          pageSize,
          total
        });
      } catch (err) {
        console.error('GET /api/transac/:id/audit error:', err);
        res.status(500).json({ error: 'Failed to fetch audit log', details: err.message });
      }
    });

    // Get recent audit activity (general audit log)
    app.get('/api/audit', async (req, res) => {
      try {
        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || '20', 10)));
        const offset = (page - 1) * pageSize;

        const request = pool.request();
        request.input('offset', sql.Int, offset);
        request.input('pageSize', sql.Int, pageSize);

        // Get total count
        const countResult = await request.query(`
          SELECT COUNT(*) as total FROM [FTSS].[dbo].[audit_log]
        `);
        const total = countResult.recordset[0].total;

        // Get paginated audit data with basic transaction info
        const auditResult = await request.query(`
          SELECT 
            a.id, 
            a.transaction_id, 
            a.user_id, 
            a.username, 
            a.action, 
            a.details, 
            a.created_at,
            t.trans_no,
            t.driver
          FROM [FTSS].[dbo].[audit_log] a
          LEFT JOIN [FTSS].[dbo].[transac] t ON a.transaction_id = t.id
          ORDER BY a.created_at DESC
          OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
        `);

        res.json({
          rows: auditResult.recordset || [],
          page,
          pageSize,
          total
        });
      } catch (err) {
        console.error('GET /api/audit error:', err);
        res.status(500).json({ error: 'Failed to fetch audit log', details: err.message });
      }
    });

    // Setup trash/restore routes
    setupTrashRoutes(app, pool, sql);

    // ===== NOTIFICATION ENDPOINTS =====

    // Get notifications with pagination
    app.get('/api/notifications', async (req, res) => {
      try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 100;
        const offset = (page - 1) * pageSize;
        const userId = req.query.user_id ? parseInt(req.query.user_id) : null;

        const request = pool.request();
        request.input('offset', sql.Int, offset);
        request.input('pageSize', sql.Int, pageSize);

        let whereClause = '';
        if (userId) {
          request.input('userId', sql.Int, userId);
          whereClause = 'WHERE user_id = @userId OR user_id IS NULL';
        }

        // Get total count
        const countResult = await request.query(`
          SELECT COUNT(*) as total 
          FROM [FTSS].[dbo].[notifications]
          ${whereClause}
        `);
        const total = countResult.recordset[0].total;

        // Get paginated notifications
        const result = await request.query(`
          SELECT 
            id,
            user_id,
            username,
            type,
            title,
            message,
            action,
            trans_id,
            trans_no,
            is_read,
            is_dismissed,
            created_at,
            read_at,
            metadata
          FROM [FTSS].[dbo].[notifications]
          ${whereClause}
          ORDER BY created_at DESC
          OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
        `);

        res.json({
          notifications: result.recordset || [],
          page,
          pageSize,
          total
        });
      } catch (err) {
        console.error('GET /api/notifications error:', err);
        res.status(500).json({ error: 'Failed to fetch notifications', details: err.message });
      }
    });

    // Get unread notification count
    app.get('/api/notifications/unread-count', async (req, res) => {
      try {
        const userId = req.query.user_id ? parseInt(req.query.user_id) : null;

        const request = pool.request();
        
        let whereClause = 'WHERE is_read = 0 AND is_dismissed = 0';
        if (userId) {
          request.input('userId', sql.Int, userId);
          whereClause += ' AND (user_id = @userId OR user_id IS NULL)';
        }

        const result = await request.query(`
          SELECT COUNT(*) as unread_count
          FROM [FTSS].[dbo].[notifications]
          ${whereClause}
        `);

        res.json({ unread_count: result.recordset[0].unread_count });
      } catch (err) {
        console.error('GET /api/notifications/unread-count error:', err);
        res.status(500).json({ error: 'Failed to fetch unread count', details: err.message });
      }
    });

    // Mark notification as read
    app.put('/api/notifications/:id/read', async (req, res) => {
      try {
        const id = parseInt(req.params.id, 10);
        if (!id) {
          return res.status(400).json({ error: 'Invalid notification ID' });
        }

        const request = pool.request();
        request.input('id', sql.Int, id);

        await request.query(`
          UPDATE [FTSS].[dbo].[notifications]
          SET is_read = 1, read_at = GETDATE()
          WHERE id = @id
        `);

        res.json({ success: true, message: 'Notification marked as read' });
      } catch (err) {
        console.error('PUT /api/notifications/:id/read error:', err);
        res.status(500).json({ error: 'Failed to mark notification as read', details: err.message });
      }
    });

    // Mark all notifications as read
    app.put('/api/notifications/mark-all-read', async (req, res) => {
      try {
        const userId = req.body?.user_id ? parseInt(req.body.user_id) : null;

        const request = pool.request();
        
        let whereClause = 'WHERE is_read = 0';
        if (userId) {
          request.input('userId', sql.Int, userId);
          whereClause += ' AND (user_id = @userId OR user_id IS NULL)';
        }

        const result = await request.query(`
          UPDATE [FTSS].[dbo].[notifications]
          SET is_read = 1, read_at = GETDATE()
          ${whereClause}
        `);

        res.json({ 
          success: true, 
          message: 'All notifications marked as read',
          affected: result.rowsAffected[0] || 0
        });
      } catch (err) {
        console.error('PUT /api/notifications/mark-all-read error:', err);
        res.status(500).json({ error: 'Failed to mark notifications as read', details: err.message });
      }
    });

    // Delete/dismiss notification
    app.delete('/api/notifications/:id', async (req, res) => {
      try {
        const id = parseInt(req.params.id, 10);
        if (!id) {
          return res.status(400).json({ error: 'Invalid notification ID' });
        }

        const request = pool.request();
        request.input('id', sql.Int, id);

        await request.query(`
          UPDATE [FTSS].[dbo].[notifications]
          SET is_dismissed = 1
          WHERE id = @id
        `);

        res.json({ success: true, message: 'Notification dismissed' });
      } catch (err) {
        console.error('DELETE /api/notifications/:id error:', err);
        res.status(500).json({ error: 'Failed to dismiss notification', details: err.message });
      }
    });

    // ===== END NOTIFICATION ENDPOINTS =====

    // ===== GAS MONITORING ENDPOINTS =====

    // GET gas monitoring data with optional date range filtering
    app.get('/api/analytics/gas-monitoring', async (req, res) => {
      try {
        const { startDate, endDate, groupByHour } = req.query;
        const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Default 7 days
        const end = endDate ? new Date(endDate) : new Date();

        const request = pool.request();
        request.input('StartDate', sql.DateTime, start);
        request.input('EndDate', sql.DateTime, end);
        request.input('GroupByHour', sql.Bit, groupByHour === 'true' ? 1 : 0);

        const result = await request.execute('sp_get_gas_trends');
        res.json(result.recordset);
      } catch (err) {
        console.error('GET /api/analytics/gas-monitoring error:', err);
        res.status(500).json({ error: 'Failed to fetch gas monitoring data', details: err.message });
      }
    });

    // POST new gas monitoring reading
    app.post('/api/analytics/gas-monitoring', async (req, res) => {
      try {
        const { reading_datetime, gas_volume_produced, gas_volume_used, gas_volume_flared, gas_volume_stored, gas_pressure, temperature, quality_status } = req.body;
        const userId = extractUserId(req);

        const request = pool.request();
        request.input('reading_datetime', sql.DateTime, new Date(reading_datetime));
        request.input('gas_volume_produced', sql.Decimal(12, 2), gas_volume_produced);
        request.input('gas_volume_used', sql.Decimal(12, 2), gas_volume_used);
        request.input('gas_volume_flared', sql.Decimal(12, 2), gas_volume_flared);
        request.input('gas_volume_stored', sql.Decimal(12, 2), gas_volume_stored || null);
        request.input('gas_pressure', sql.Decimal(8, 2), gas_pressure || null);
        request.input('temperature', sql.Decimal(8, 2), temperature || null);
        request.input('quality_status', sql.NVarChar(50), quality_status || 'Good');
        request.input('created_by', sql.NVarChar(100), userId || 'SYSTEM');

        const result = await request.query(`
          INSERT INTO [dbo].[gas_monitoring] 
            ([reading_datetime], [gas_volume_produced], [gas_volume_used], [gas_volume_flared], 
             [gas_volume_stored], [gas_pressure], [temperature], [quality_status], [created_by])
          OUTPUT inserted.id, inserted.reading_datetime, inserted.gas_volume_produced, 
                 inserted.gas_volume_used, inserted.gas_volume_flared, inserted.created_at
          VALUES (@reading_datetime, @gas_volume_produced, @gas_volume_used, @gas_volume_flared, 
                  @gas_volume_stored, @gas_pressure, @temperature, @quality_status, @created_by)
        `);

        logAuditEntry(pool, null, userId, 'CREATE', 'gas_monitoring', `Added gas monitoring reading`, req);
        notifyActivity(app, { type: 'success', title: 'Gas Monitoring', message: 'New gas reading recorded' });

        res.status(201).json(result.recordset[0]);
      } catch (err) {
        console.error('POST /api/analytics/gas-monitoring error:', err);
        res.status(500).json({ error: 'Failed to create gas monitoring record', details: err.message });
      }
    });

    // ===== PLANT UTILITIES ENDPOINTS =====

    // GET utilities data with optional date range filtering
    app.get('/api/analytics/plant-utilities', async (req, res) => {
      try {
        const { startDate, endDate } = req.query;
        const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default 30 days
        const end = endDate ? new Date(endDate) : new Date();

        const request = pool.request();
        request.input('StartDate', sql.Date, start);
        request.input('EndDate', sql.Date, end);

        const result = await request.execute('sp_get_utilities_summary');
        res.json(result.recordset);
      } catch (err) {
        console.error('GET /api/analytics/plant-utilities error:', err);
        res.status(500).json({ error: 'Failed to fetch utilities data', details: err.message });
      }
    });

    // GET utilities summary (overview/dashboard)
    app.get('/api/analytics/plant-utilities/summary', async (req, res) => {
      try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const result = await pool.request()
          .input('StartDate', sql.Date, thirtyDaysAgo)
          .input('EndDate', sql.Date, new Date())
          .execute('sp_get_utilities_summary');

        const data = result.recordset;
        
        const summary = {
          totalElectricityKwh: data.reduce((sum, row) => sum + (row.electricity_consumed_kwh || 0), 0),
          totalWaterM3: data.reduce((sum, row) => sum + (row.water_consumption_m3 || 0), 0),
          totalCost: data.reduce((sum, row) => sum + (row.total_cost || 0), 0),
          averageDailyCost: data.length > 0 ? (data.reduce((sum, row) => sum + (row.total_cost || 0), 0) / data.length).toFixed(2) : 0,
          averageCostPerTon: data.length > 0 ? (data.reduce((sum, row) => sum + (row.cost_per_ton_produced || 0), 0) / data.length).toFixed(4) : 0,
          highestDailyCost: Math.max(...data.map(row => row.total_cost || 0)),
          lowestDailyCost: Math.min(...data.map(row => row.total_cost || 0)),
          recordCount: data.length
        };

        res.json(summary);
      } catch (err) {
        console.error('GET /api/analytics/plant-utilities/summary error:', err);
        res.status(500).json({ error: 'Failed to fetch utilities summary', details: err.message });
      }
    });

    // POST new utilities record
    app.post('/api/analytics/plant-utilities', async (req, res) => {
      try {
        const { utility_date, electricity_consumed_kwh, water_consumption_m3, electricity_cost, water_cost, cost_per_ton_produced, notes } = req.body;
        const userId = extractUserId(req);
        const totalCost = (electricity_cost || 0) + (water_cost || 0);

        const request = pool.request();
        request.input('utility_date', sql.Date, new Date(utility_date));
        request.input('electricity_consumed_kwh', sql.Decimal(12, 2), electricity_consumed_kwh);
        request.input('water_consumption_m3', sql.Decimal(12, 2), water_consumption_m3);
        request.input('electricity_cost', sql.Decimal(12, 2), electricity_cost);
        request.input('water_cost', sql.Decimal(12, 2), water_cost);
        request.input('total_cost', sql.Decimal(12, 2), totalCost);
        request.input('cost_per_ton_produced', sql.Decimal(10, 4), cost_per_ton_produced || null);
        request.input('notes', sql.NVarChar(500), notes || null);
        request.input('created_by', sql.NVarChar(100), userId || 'SYSTEM');

        const result = await request.query(`
          INSERT INTO [dbo].[plant_utilities]
            ([utility_date], [electricity_consumed_kwh], [water_consumption_m3], [electricity_cost], 
             [water_cost], [total_cost], [cost_per_ton_produced], [notes], [created_by])
          OUTPUT inserted.id, inserted.utility_date, inserted.electricity_consumed_kwh, 
                 inserted.electricity_cost, inserted.water_cost, inserted.total_cost, inserted.created_at
          VALUES (@utility_date, @electricity_consumed_kwh, @water_consumption_m3, @electricity_cost, 
                  @water_cost, @total_cost, @cost_per_ton_produced, @notes, @created_by)
        `);

        logAuditEntry(pool, null, userId, 'CREATE', 'plant_utilities', `Added utilities record for ${utility_date}`, req);
        notifyActivity(app, { type: 'success', title: 'Plant Utilities', message: 'New utilities record logged' });

        res.status(201).json(result.recordset[0]);
      } catch (err) {
        console.error('POST /api/analytics/plant-utilities error:', err);
        res.status(500).json({ error: 'Failed to create utilities record', details: err.message });
      }
    });

    // Weight Trends Analytics - Daily aggregate of gross/net/tare weights
    app.get('/api/analytics/weight-trends', async (req, res) => {
      try {
        const startDateStr = req.query.startDate || (() => {
          const d = new Date();
          d.setDate(d.getDate() - 30);
          return d.toISOString().split('T')[0];
        })();
        
        const endDateStr = req.query.endDate || new Date().toISOString().split('T')[0];
        const startTime = req.query.startTime || '00:00';
        const endTime = req.query.endTime || '23:59';

        if (!/^\d{4}-\d{2}-\d{2}$/.test(startDateStr) || !/^\d{4}-\d{2}-\d{2}$/.test(endDateStr)) return res.status(400).json({ error: 'Invalid date format' });
        const request = pool.request();

        const query = `
          SELECT 
            CAST(COALESCE(CAST([date] AS date), TRY_CONVERT(date, [transac_date]), TRY_CONVERT(date, [inbound])) AS date) as transac_date,
            SUM(TRY_CONVERT(DECIMAL(18,2), [gross_weight])) as gross_weight,
            AVG(TRY_CONVERT(DECIMAL(18,2), [net_weight])) as net_weight,
            AVG(TRY_CONVERT(DECIMAL(18,2), [tare_weight])) as tare_weight,
            COUNT(*) as count
          FROM [FTSS].[dbo].[transac]
          WHERE COALESCE(CAST([date] AS date), TRY_CONVERT(date, [transac_date]), TRY_CONVERT(date, [inbound])) >= CONVERT(date, '${startDateStr}')
            AND COALESCE(CAST([date] AS date), TRY_CONVERT(date, [transac_date]), TRY_CONVERT(date, [inbound])) <= CONVERT(date, '${endDateStr}')
            AND [deleted_at] IS NULL
          GROUP BY CAST(COALESCE(CAST([date] AS date), TRY_CONVERT(date, [transac_date]), TRY_CONVERT(date, [inbound])) AS date)
          ORDER BY transac_date ASC
        `;

        const result = await request.query(query);
        res.json(result.recordset || []);
      } catch (err) {
        console.error('GET /api/analytics/weight-trends error:', err);
        res.status(500).json({ error: 'Failed to fetch weight trends', details: err.message });
      }
    });

    // Transac Date Range - returns earliest and latest available transaction dates
    app.get('/api/analytics/transac-date-range', async (req, res) => {
      try {
        const request = pool.request();
        const query = `
          SELECT
            MIN(CAST(COALESCE(CAST([date] AS date), TRY_CONVERT(date, [transac_date]), TRY_CONVERT(date, [inbound])) AS date)) as min_date,
            MAX(CAST(COALESCE(CAST([date] AS date), TRY_CONVERT(date, [transac_date]), TRY_CONVERT(date, [inbound])) AS date)) as max_date
          FROM [FTSS].[dbo].[transac]
          WHERE [deleted_at] IS NULL
            AND COALESCE(CAST([date] AS date), TRY_CONVERT(date, [transac_date]), TRY_CONVERT(date, [inbound])) IS NOT NULL
        `;
        const result = await request.query(query);
        const row = result.recordset[0] || {};
        res.json({
          minDate: row.min_date ? new Date(row.min_date).toISOString().split('T')[0] : null,
          maxDate: row.max_date ? new Date(row.max_date).toISOString().split('T')[0] : null,
        });
      } catch (err) {
        console.error('GET /api/analytics/transac-date-range error:', err);
        res.status(500).json({ error: 'Failed to fetch date range', details: err.message });
      }
    });

    // Weight Summary - aggregate KPIs across all records
    app.get('/api/analytics/weight-summary', async (req, res) => {
      try {
        const request = pool.request();
        const result = await request.query(`
          SELECT
            COUNT(*) as total_records,
            SUM(TRY_CONVERT(DECIMAL(18,2), [gross_weight]))  as total_gross_weight,
            SUM(TRY_CONVERT(DECIMAL(18,2), [net_weight]))    as total_net_weight,
            SUM(TRY_CONVERT(DECIMAL(18,2), [tare_weight]))   as total_tare_weight,
            AVG(TRY_CONVERT(DECIMAL(18,2), [net_weight]))    as avg_net_weight,
            AVG(CASE WHEN TRY_CONVERT(DECIMAL(18,2), [gross_weight]) > 0
                THEN TRY_CONVERT(DECIMAL(18,2), [net_weight]) / TRY_CONVERT(DECIMAL(18,2), [gross_weight]) * 100
                ELSE NULL END) as avg_net_payload_pct,
            AVG(CASE WHEN TRY_CONVERT(DECIMAL(18,2), [gross_weight]) > 0
                THEN TRY_CONVERT(DECIMAL(18,2), [tare_weight]) / TRY_CONVERT(DECIMAL(18,2), [gross_weight]) * 100
                ELSE NULL END) as avg_tare_pct,
            SUM(CASE WHEN COALESCE(CAST([date] AS date), TRY_CONVERT(date, transac_date), TRY_CONVERT(date, inbound))
                          = CAST(GETDATE() AS DATE)
                THEN 1 ELSE 0 END) as today_trips,
            SUM(CASE WHEN COALESCE(CAST([date] AS date), TRY_CONVERT(date, transac_date), TRY_CONVERT(date, inbound))
                          = CAST(DATEADD(DAY,-1,GETDATE()) AS DATE)
                THEN 1 ELSE 0 END) as yesterday_trips,
            SUM(CASE WHEN COALESCE(CAST([date] AS date), TRY_CONVERT(date, transac_date), TRY_CONVERT(date, inbound))
                          >= DATEADD(DAY, -(DATEDIFF(DAY, '2000-01-03', GETDATE()) % 7), CAST(GETDATE() AS DATE))
                THEN 1 ELSE 0 END) as week_trips,
            SUM(CASE WHEN COALESCE(CAST([date] AS date), TRY_CONVERT(date, transac_date), TRY_CONVERT(date, inbound))
                          >= DATEADD(DAY, -(DATEDIFF(DAY, '2000-01-03', GETDATE()) % 7) - 7, CAST(GETDATE() AS DATE))
                      AND COALESCE(CAST([date] AS date), TRY_CONVERT(date, transac_date), TRY_CONVERT(date, inbound))
                          < DATEADD(DAY, -(DATEDIFF(DAY, '2000-01-03', GETDATE()) % 7), CAST(GETDATE() AS DATE))
                THEN 1 ELSE 0 END) as last_week_trips,
            SUM(CASE WHEN COALESCE(CAST([date] AS date), TRY_CONVERT(date, transac_date), TRY_CONVERT(date, inbound))
                          = CAST(GETDATE() AS DATE)
                      AND NULLIF(LTRIM(RTRIM([plate])), '') IS NULL
                THEN 1 ELSE 0 END) as today_missing_plates,
            SUM(CASE WHEN COALESCE(CAST([date] AS date), TRY_CONVERT(date, transac_date), TRY_CONVERT(date, inbound))
                          = CAST(GETDATE() AS DATE)
                      AND LOWER(LTRIM(RTRIM([status]))) = 'void'
                THEN 1 ELSE 0 END) as today_void_count,
            SUM(CASE WHEN COALESCE(CAST([date] AS date), TRY_CONVERT(date, transac_date), TRY_CONVERT(date, inbound))
                          >= DATEADD(DAY,-7,CAST(GETDATE() AS DATE))
                THEN TRY_CONVERT(DECIMAL(18,2), [net_weight]) ELSE 0 END) as this_week_net,
            SUM(CASE WHEN COALESCE(CAST([date] AS date), TRY_CONVERT(date, transac_date), TRY_CONVERT(date, inbound))
                          >= DATEADD(DAY,-14,CAST(GETDATE() AS DATE))
                      AND COALESCE(CAST([date] AS date), TRY_CONVERT(date, transac_date), TRY_CONVERT(date, inbound))
                          < DATEADD(DAY,-7,CAST(GETDATE() AS DATE))
                THEN TRY_CONVERT(DECIMAL(18,2), [net_weight]) ELSE 0 END) as last_week_net
          FROM [FTSS].[dbo].[transac]
          WHERE [deleted_at] IS NULL
        `);
        const row = result.recordset[0] || {};
        const thisWeekNet  = parseFloat(row.this_week_net  || 0);
        const lastWeekNet  = parseFloat(row.last_week_net  || 0);
        const netWoWPct    = lastWeekNet > 0 ? Math.round((thisWeekNet - lastWeekNet) / lastWeekNet * 100) : null;
        res.json({
          totalRecords:        row.total_records        ?? 0,
          totalGrossWeight:    row.total_gross_weight   != null ? parseFloat(row.total_gross_weight)  : null,
          totalNetWeight:      row.total_net_weight     != null ? parseFloat(row.total_net_weight)    : null,
          totalTareWeight:     row.total_tare_weight    != null ? parseFloat(row.total_tare_weight)   : null,
          avgNetWeight:        row.avg_net_weight       != null ? parseFloat(row.avg_net_weight)      : null,
          avgNetPayloadPct:    row.avg_net_payload_pct  != null ? parseFloat(row.avg_net_payload_pct) : null,
          avgTarePct:          row.avg_tare_pct         != null ? parseFloat(row.avg_tare_pct)        : null,
          todayTrips:          row.today_trips          ?? 0,
          yesterdayTrips:      row.yesterday_trips      ?? 0,
          weekTrips:           row.week_trips           ?? 0,
          lastWeekTrips:       row.last_week_trips      ?? 0,
          todayMissingPlates:  row.today_missing_plates ?? 0,
          todayVoidCount:      row.today_void_count     ?? 0,
          netWoWPct,
        });
      } catch (err) {
        console.error('GET /api/analytics/weight-summary error:', err);
        res.status(500).json({ error: 'Failed to fetch weight summary', details: err.message });
      }
    });

    // ── KPI sparkline — last N days of daily aggregates ─────────────────────
    app.get('/api/analytics/sparkline', async (req, res) => {
      try {
        const days = Math.min(Math.max(parseInt(req.query.days) || 14, 2), 30);
        const request = pool.request();
        const result = await request.query(`
          SELECT
            CAST(COALESCE(CAST([date] AS date), TRY_CONVERT(date, [transac_date]), TRY_CONVERT(date, [inbound])) AS date) AS day,
            COUNT(*) AS trips,
            ISNULL(SUM(TRY_CONVERT(DECIMAL(18,2), [gross_weight])), 0) AS gross,
            ISNULL(SUM(TRY_CONVERT(DECIMAL(18,2), [net_weight])),   0) AS net,
            ISNULL(SUM(TRY_CONVERT(DECIMAL(18,2), [tare_weight])),  0) AS tare,
            ISNULL(AVG(CASE WHEN TRY_CONVERT(DECIMAL(18,2), [gross_weight]) > 0
                       THEN TRY_CONVERT(DECIMAL(18,2), [net_weight]) / TRY_CONVERT(DECIMAL(18,2), [gross_weight]) * 100
                       ELSE NULL END), 0) AS avg_net_payload_pct,
            ISNULL(AVG(TRY_CONVERT(DECIMAL(18,2), [net_weight])), 0) AS avg_net_weight
          FROM [FTSS].[dbo].[transac]
          WHERE COALESCE(CAST([date] AS date), TRY_CONVERT(date, [transac_date]), TRY_CONVERT(date, [inbound]))
                >= CAST(DATEADD(DAY, -(${days - 1}), GETDATE()) AS DATE)
            AND [deleted_at] IS NULL
          GROUP BY CAST(COALESCE(CAST([date] AS date), TRY_CONVERT(date, [transac_date]), TRY_CONVERT(date, [inbound])) AS date)
          ORDER BY day ASC
        `);
        res.json((result.recordset || []).map(r => ({
          day:                r.day instanceof Date ? r.day.toISOString().split('T')[0] : r.day,
          trips:              Number(r.trips)              || 0,
          gross:              parseFloat(r.gross)          || 0,
          net:                parseFloat(r.net)            || 0,
          tare:               parseFloat(r.tare)           || 0,
          avg_net_payload_pct: parseFloat(r.avg_net_payload_pct) || 0,
          avg_net_weight:     parseFloat(r.avg_net_weight) || 0,
        })));
      } catch (err) {
        console.error('GET /api/analytics/sparkline error:', err);
        res.status(500).json({ error: 'Failed', details: err.message });
      }
    });

    // ── Hourly Trips — real per-hour trip count for a given date ───────────
    app.get('/api/analytics/hourly-trips', async (req, res) => {
      try {
        const dateStr = req.query.date
          ? req.query.date
          : new Date().toISOString().split('T')[0];
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr))
          return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
        const request = pool.request();
        const result = await request.query(`
          SELECT
            DATEPART(hour, COALESCE(
              TRY_CONVERT(datetime, [inbound]),
              TRY_CONVERT(datetime, [transac_date]),
              CAST(COALESCE(CAST([date] AS date), TRY_CONVERT(date, [transac_date])) AS datetime)
            )) AS hour,
            COUNT(*) AS trips
          FROM [FTSS].[dbo].[transac]
          WHERE
            COALESCE(CAST([date] AS date), TRY_CONVERT(date, [transac_date]), TRY_CONVERT(date, [inbound]))
              = CONVERT(date, '${dateStr}')
            AND [deleted_at] IS NULL
            AND COALESCE(
              TRY_CONVERT(datetime, [inbound]),
              TRY_CONVERT(datetime, [transac_date]),
              CAST(COALESCE(CAST([date] AS date), TRY_CONVERT(date, [transac_date])) AS datetime)
            ) IS NOT NULL
          GROUP BY DATEPART(hour, COALESCE(
            TRY_CONVERT(datetime, [inbound]),
            TRY_CONVERT(datetime, [transac_date]),
            CAST(COALESCE(CAST([date] AS date), TRY_CONVERT(date, [transac_date])) AS datetime)
          ))
          ORDER BY hour ASC
        `);
        res.json((result.recordset || []).map(r => ({
          hour:  Number(r.hour),
          trips: Number(r.trips) || 0,
        })));
      } catch (err) {
        console.error('GET /api/analytics/hourly-trips error:', err);
        res.status(500).json({ error: 'Failed', details: err.message });
      }
    });

    // Transaction Volume - daily count of transactions in a date range
    app.get('/api/analytics/transaction-volume', async (req, res) => {
      try {
        const startDateStr = req.query.startDate || (() => {
          const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0];
        })();
        const endDateStr = req.query.endDate || new Date().toISOString().split('T')[0];
        if (!/^\d{4}-\d{2}-\d{2}$/.test(startDateStr) || !/^\d{4}-\d{2}-\d{2}$/.test(endDateStr)) return res.status(400).json({ error: 'Invalid date format' });
        const request = pool.request();
        const query = `
          SELECT
            CAST(COALESCE(CAST([date] AS date), TRY_CONVERT(date, [transac_date]), TRY_CONVERT(date, [inbound])) AS date) as transac_date,
            COUNT(*) as count
          FROM [FTSS].[dbo].[transac]
          WHERE COALESCE(CAST([date] AS date), TRY_CONVERT(date, [transac_date]), TRY_CONVERT(date, [inbound])) >= CONVERT(date, '${startDateStr}')
            AND COALESCE(CAST([date] AS date), TRY_CONVERT(date, [transac_date]), TRY_CONVERT(date, [inbound])) <= CONVERT(date, '${endDateStr}')
            AND [deleted_at] IS NULL
          GROUP BY CAST(COALESCE(CAST([date] AS date), TRY_CONVERT(date, [transac_date]), TRY_CONVERT(date, [inbound])) AS date)
          ORDER BY transac_date ASC
        `;
        const result = await request.query(query);
        res.json(result.recordset || []);
      } catch (err) {
        console.error('GET /api/analytics/transaction-volume error:', err);
        res.status(500).json({ error: 'Failed to fetch transaction volume', details: err.message });
      }
    });

    // Product Distribution - count and total weight per product in a date range
    app.get('/api/analytics/product-distribution', async (req, res) => {
      try {
        const startDateStr = req.query.startDate || (() => {
          const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0];
        })();
        const endDateStr = req.query.endDate || new Date().toISOString().split('T')[0];
        if (!/^\d{4}-\d{2}-\d{2}$/.test(startDateStr) || !/^\d{4}-\d{2}-\d{2}$/.test(endDateStr)) return res.status(400).json({ error: 'Invalid date format' });
        const request = pool.request();
        const query = `
          SELECT
            ISNULL(NULLIF(LTRIM(RTRIM([product])), ''), 'Unknown') as product,
            COUNT(*) as count,
            SUM(TRY_CONVERT(DECIMAL(18,2), [gross_weight])) as total_weight
          FROM [FTSS].[dbo].[transac]
          WHERE COALESCE(CAST([date] AS date), TRY_CONVERT(date, [transac_date]), TRY_CONVERT(date, [inbound])) >= CONVERT(date, '${startDateStr}')
            AND COALESCE(CAST([date] AS date), TRY_CONVERT(date, [transac_date]), TRY_CONVERT(date, [inbound])) <= CONVERT(date, '${endDateStr}')
            AND [deleted_at] IS NULL
          GROUP BY ISNULL(NULLIF(LTRIM(RTRIM([product])), ''), 'Unknown')
          ORDER BY count DESC
        `;
        const result = await request.query(query);
        res.json(result.recordset || []);
      } catch (err) {
        console.error('GET /api/analytics/product-distribution error:', err);
        res.status(500).json({ error: 'Failed to fetch product distribution', details: err.message });
      }
    });

    // ── Status Breakdown ──────────────────────────────────────────────────
    app.get('/api/analytics/status-breakdown', async (req, res) => {
      try {
        const startDateStr = req.query.startDate || (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d.toISOString().split('T')[0]; })();
        const endDateStr   = req.query.endDate   || new Date().toISOString().split('T')[0];
        // Validate format (YYYY-MM-DD) to prevent SQL injection before inlining
        if (!/^\d{4}-\d{2}-\d{2}$/.test(startDateStr) || !/^\d{4}-\d{2}-\d{2}$/.test(endDateStr)) {
          return res.status(400).json({ error: 'Invalid date format' });
        }
        const request = pool.request();
        const result = await request.query(`
          SELECT
            ISNULL(NULLIF(LTRIM(RTRIM([status])),''),'Unknown') as status,
            COUNT(*) as count
          FROM [FTSS].[dbo].[transac]
          WHERE COALESCE(CAST([date] AS date), TRY_CONVERT(date,[transac_date]), TRY_CONVERT(date,[inbound])) >= CONVERT(date, '${startDateStr}')
            AND COALESCE(CAST([date] AS date), TRY_CONVERT(date,[transac_date]), TRY_CONVERT(date,[inbound])) <= CONVERT(date, '${endDateStr}')
            AND [deleted_at] IS NULL
          GROUP BY ISNULL(NULLIF(LTRIM(RTRIM([status])),''),'Unknown')
          ORDER BY count DESC
        `);
        res.json(result.recordset || []);
      } catch (err) { res.status(500).json({ error: 'Failed', details: err.message }); }
    });

    // ── Top Drivers by Tonnage ─────────────────────────────────────────────
    app.get('/api/analytics/top-drivers', async (req, res) => {
      try {
        const startDateStr = req.query.startDate || (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d.toISOString().split('T')[0]; })();
        const endDateStr   = req.query.endDate   || new Date().toISOString().split('T')[0];
        const limit = Math.min(parseInt(req.query.limit) || 15, 50);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(startDateStr) || !/^\d{4}-\d{2}-\d{2}$/.test(endDateStr)) return res.status(400).json({ error: 'Invalid date format' });
        const request = pool.request();
        request.input('limit', sql.Int, limit);
        const result = await request.query(`
          SELECT TOP (@limit)
            ISNULL(NULLIF(LTRIM(RTRIM([driver])),''),'Unknown') as driver,
            COUNT(*) as trips,
            SUM(TRY_CONVERT(DECIMAL(18,2),[gross_weight])) as total_weight
          FROM [FTSS].[dbo].[transac]
          WHERE COALESCE(CAST([date] AS date), TRY_CONVERT(date,[transac_date]), TRY_CONVERT(date,[inbound])) >= CONVERT(date, '${startDateStr}')
            AND COALESCE(CAST([date] AS date), TRY_CONVERT(date,[transac_date]), TRY_CONVERT(date,[inbound])) <= CONVERT(date, '${endDateStr}')
            AND [deleted_at] IS NULL
          GROUP BY ISNULL(NULLIF(LTRIM(RTRIM([driver])),''),'Unknown')
          ORDER BY total_weight DESC
        `);
        res.json(result.recordset || []);
      } catch (err) { res.status(500).json({ error: 'Failed', details: err.message }); }
    });

    // ── Top Vehicles by Trips ──────────────────────────────────────────────
    app.get('/api/analytics/top-vehicles', async (req, res) => {
      try {
        const startDateStr = req.query.startDate || (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d.toISOString().split('T')[0]; })();
        const endDateStr   = req.query.endDate   || new Date().toISOString().split('T')[0];
        const limit = Math.min(parseInt(req.query.limit) || 15, 50);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(startDateStr) || !/^\d{4}-\d{2}-\d{2}$/.test(endDateStr)) return res.status(400).json({ error: 'Invalid date format' });
        const request = pool.request();
        request.input('limit', sql.Int, limit);
        const result = await request.query(`
          SELECT TOP (@limit)
            ISNULL(NULLIF(LTRIM(RTRIM([plate])),''),'Unknown') as plate,
            COUNT(*) as trips,
            SUM(TRY_CONVERT(DECIMAL(18,2),[gross_weight])) as total_weight
          FROM [FTSS].[dbo].[transac]
          WHERE COALESCE(CAST([date] AS date), TRY_CONVERT(date,[transac_date]), TRY_CONVERT(date,[inbound])) >= CONVERT(date, '${startDateStr}')
            AND COALESCE(CAST([date] AS date), TRY_CONVERT(date,[transac_date]), TRY_CONVERT(date,[inbound])) <= CONVERT(date, '${endDateStr}')
            AND [deleted_at] IS NULL
          GROUP BY ISNULL(NULLIF(LTRIM(RTRIM([plate])),''),'Unknown')
          ORDER BY trips DESC
        `);
        res.json(result.recordset || []);
      } catch (err) { res.status(500).json({ error: 'Failed', details: err.message }); }
    });

    // ── Hourly Traffic Heatmap ─────────────────────────────────────────────
    app.get('/api/analytics/hourly-heatmap', async (req, res) => {
      try {
        const startDateStr = req.query.startDate || (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d.toISOString().split('T')[0]; })();
        const endDateStr   = req.query.endDate   || new Date().toISOString().split('T')[0];
        if (!/^\d{4}-\d{2}-\d{2}$/.test(startDateStr) || !/^\d{4}-\d{2}-\d{2}$/.test(endDateStr)) return res.status(400).json({ error: 'Invalid date format' });
        const request = pool.request();
        const result = await request.query(`
          SELECT
            DATEPART(weekday, COALESCE(TRY_CONVERT(datetime,[inbound]), TRY_CONVERT(datetime,[transac_date]),
              CAST(COALESCE(CAST([date] AS date), TRY_CONVERT(date,[transac_date])) AS datetime))) as dow,
            DATEPART(hour, COALESCE(TRY_CONVERT(datetime,[inbound]), TRY_CONVERT(datetime,[transac_date]),
              CAST(COALESCE(CAST([date] AS date), TRY_CONVERT(date,[transac_date])) AS datetime))) as hour,
            COUNT(*) as count
          FROM [FTSS].[dbo].[transac]
          WHERE COALESCE(CAST([date] AS date), TRY_CONVERT(date,[transac_date]), TRY_CONVERT(date,[inbound])) >= CONVERT(date, '${startDateStr}')
            AND COALESCE(CAST([date] AS date), TRY_CONVERT(date,[transac_date]), TRY_CONVERT(date,[inbound])) <= CONVERT(date, '${endDateStr}')
            AND [deleted_at] IS NULL
          GROUP BY
            DATEPART(weekday, COALESCE(TRY_CONVERT(datetime,[inbound]), TRY_CONVERT(datetime,[transac_date]),
              CAST(COALESCE(CAST([date] AS date), TRY_CONVERT(date,[transac_date])) AS datetime))),
            DATEPART(hour, COALESCE(TRY_CONVERT(datetime,[inbound]), TRY_CONVERT(datetime,[transac_date]),
              CAST(COALESCE(CAST([date] AS date), TRY_CONVERT(date,[transac_date])) AS datetime)))
          ORDER BY dow, hour
        `);
        res.json(result.recordset || []);
      } catch (err) { res.status(500).json({ error: 'Failed', details: err.message }); }
    });

    // ── Monthly Tonnage ────────────────────────────────────────────────────
    app.get('/api/analytics/monthly-tonnage', async (req, res) => {
      try {
        const startDateStr = req.query.startDate || (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 3); return d.toISOString().split('T')[0]; })();
        const endDateStr   = req.query.endDate   || new Date().toISOString().split('T')[0];
        if (!/^\d{4}-\d{2}-\d{2}$/.test(startDateStr) || !/^\d{4}-\d{2}-\d{2}$/.test(endDateStr)) return res.status(400).json({ error: 'Invalid date format' });
        const request = pool.request();
        const result = await request.query(`
          SELECT
            YEAR(COALESCE(CAST([date] AS date), TRY_CONVERT(date,[transac_date]), TRY_CONVERT(date,[inbound]))) as year,
            MONTH(COALESCE(CAST([date] AS date), TRY_CONVERT(date,[transac_date]), TRY_CONVERT(date,[inbound]))) as month,
            SUM(TRY_CONVERT(DECIMAL(18,2),[gross_weight])) as total_weight,
            COUNT(*) as trips
          FROM [FTSS].[dbo].[transac]
          WHERE COALESCE(CAST([date] AS date), TRY_CONVERT(date,[transac_date]), TRY_CONVERT(date,[inbound])) >= CONVERT(date, '${startDateStr}')
            AND COALESCE(CAST([date] AS date), TRY_CONVERT(date,[transac_date]), TRY_CONVERT(date,[inbound])) <= CONVERT(date, '${endDateStr}')
            AND [deleted_at] IS NULL
          GROUP BY
            YEAR(COALESCE(CAST([date] AS date), TRY_CONVERT(date,[transac_date]), TRY_CONVERT(date,[inbound]))),
            MONTH(COALESCE(CAST([date] AS date), TRY_CONVERT(date,[transac_date]), TRY_CONVERT(date,[inbound])))
          ORDER BY year ASC, month ASC
        `);
        res.json(result.recordset || []);
      } catch (err) { res.status(500).json({ error: 'Failed', details: err.message }); }
    });

    // ── Average Turnaround Time ────────────────────────────────────────────
    app.get('/api/analytics/turnaround-time', async (req, res) => {
      try {
        const startDateStr = req.query.startDate || (() => { const d = new Date(); d.setDate(d.getDate() - 90); return d.toISOString().split('T')[0]; })();
        const endDateStr   = req.query.endDate   || new Date().toISOString().split('T')[0];
        if (!/^\d{4}-\d{2}-\d{2}$/.test(startDateStr) || !/^\d{4}-\d{2}-\d{2}$/.test(endDateStr)) return res.status(400).json({ error: 'Invalid date format' });
        const request = pool.request();
        const result = await request.query(`
          SELECT
            CAST(COALESCE(CAST([date] AS date), TRY_CONVERT(date,[transac_date]), TRY_CONVERT(date,[inbound])) AS date) as transac_date,
            AVG(DATEDIFF(minute, TRY_CONVERT(datetime,[inbound]), TRY_CONVERT(datetime,[outbound]))) as avg_minutes,
            MIN(DATEDIFF(minute, TRY_CONVERT(datetime,[inbound]), TRY_CONVERT(datetime,[outbound]))) as min_minutes,
            MAX(DATEDIFF(minute, TRY_CONVERT(datetime,[inbound]), TRY_CONVERT(datetime,[outbound]))) as max_minutes,
            COUNT(*) as trips
          FROM [FTSS].[dbo].[transac]
          WHERE COALESCE(CAST([date] AS date), TRY_CONVERT(date,[transac_date]), TRY_CONVERT(date,[inbound])) >= CONVERT(date, '${startDateStr}')
            AND COALESCE(CAST([date] AS date), TRY_CONVERT(date,[transac_date]), TRY_CONVERT(date,[inbound])) <= CONVERT(date, '${endDateStr}')
            AND TRY_CONVERT(datetime,[inbound]) IS NOT NULL
            AND TRY_CONVERT(datetime,[outbound]) IS NOT NULL
            AND DATEDIFF(minute, TRY_CONVERT(datetime,[inbound]), TRY_CONVERT(datetime,[outbound])) BETWEEN 1 AND 1440
            AND [deleted_at] IS NULL
          GROUP BY CAST(COALESCE(CAST([date] AS date), TRY_CONVERT(date,[transac_date]), TRY_CONVERT(date,[inbound])) AS date)
          ORDER BY transac_date ASC
        `);
        res.json(result.recordset || []);
      } catch (err) { res.status(500).json({ error: 'Failed', details: err.message }); }
    });

    // ── Tare vs Net Weight Ratio ───────────────────────────────────────────
    app.get('/api/analytics/weight-ratio', async (req, res) => {
      try {
        const startDateStr = req.query.startDate || (() => { const d = new Date(); d.setDate(d.getDate() - 90); return d.toISOString().split('T')[0]; })();
        const endDateStr   = req.query.endDate   || new Date().toISOString().split('T')[0];
        if (!/^\d{4}-\d{2}-\d{2}$/.test(startDateStr) || !/^\d{4}-\d{2}-\d{2}$/.test(endDateStr)) return res.status(400).json({ error: 'Invalid date format' });
        const request = pool.request();
        const result = await request.query(`
          SELECT
            CAST(COALESCE(CAST([date] AS date), TRY_CONVERT(date,[transac_date]), TRY_CONVERT(date,[inbound])) AS date) as transac_date,
            SUM(TRY_CONVERT(DECIMAL(18,2),[gross_weight])) as gross,
            SUM(TRY_CONVERT(DECIMAL(18,2),[tare_weight]))  as tare,
            SUM(TRY_CONVERT(DECIMAL(18,2),[net_weight]))   as net,
            COUNT(*) as trips
          FROM [FTSS].[dbo].[transac]
          WHERE COALESCE(CAST([date] AS date), TRY_CONVERT(date,[transac_date]), TRY_CONVERT(date,[inbound])) >= CONVERT(date, '${startDateStr}')
            AND COALESCE(CAST([date] AS date), TRY_CONVERT(date,[transac_date]), TRY_CONVERT(date,[inbound])) <= CONVERT(date, '${endDateStr}')
            AND TRY_CONVERT(DECIMAL(18,2),[gross_weight]) > 0
            AND [deleted_at] IS NULL
          GROUP BY CAST(COALESCE(CAST([date] AS date), TRY_CONVERT(date,[transac_date]), TRY_CONVERT(date,[inbound])) AS date)
          ORDER BY transac_date ASC
        `);
        res.json(result.recordset || []);
      } catch (err) { res.status(500).json({ error: 'Failed', details: err.message }); }
    });

    // ── New vs Returning Vehicles ──────────────────────────────────────────
    app.get('/api/analytics/fleet-tracking', async (req, res) => {
      try {
        const startDateStr = req.query.startDate || (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 2); return d.toISOString().split('T')[0]; })();
        const endDateStr   = req.query.endDate   || new Date().toISOString().split('T')[0];
        if (!/^\d{4}-\d{2}-\d{2}$/.test(startDateStr) || !/^\d{4}-\d{2}-\d{2}$/.test(endDateStr)) return res.status(400).json({ error: 'Invalid date format' });
        const request = pool.request();
        const result = await request.query(`
          WITH first_appearance AS (
            SELECT
              NULLIF(LTRIM(RTRIM([plate])),'') as plate,
              MIN(CAST(COALESCE(CAST([date] AS date), TRY_CONVERT(date,[transac_date]), TRY_CONVERT(date,[inbound])) AS date)) as first_date
            FROM [FTSS].[dbo].[transac]
            WHERE [deleted_at] IS NULL AND NULLIF(LTRIM(RTRIM([plate])),'') IS NOT NULL
            GROUP BY NULLIF(LTRIM(RTRIM([plate])),'')
          ),
          monthly AS (
            SELECT
              YEAR(CAST(COALESCE(CAST([date] AS date), TRY_CONVERT(date,[transac_date]), TRY_CONVERT(date,[inbound])) AS date)) as year,
              MONTH(CAST(COALESCE(CAST([date] AS date), TRY_CONVERT(date,[transac_date]), TRY_CONVERT(date,[inbound])) AS date)) as month,
              NULLIF(LTRIM(RTRIM([plate])),'') as plate
            FROM [FTSS].[dbo].[transac]
            WHERE COALESCE(CAST([date] AS date), TRY_CONVERT(date,[transac_date]), TRY_CONVERT(date,[inbound])) >= CONVERT(date, '${startDateStr}')
              AND COALESCE(CAST([date] AS date), TRY_CONVERT(date,[transac_date]), TRY_CONVERT(date,[inbound])) <= CONVERT(date, '${endDateStr}')
              AND [deleted_at] IS NULL
              AND NULLIF(LTRIM(RTRIM([plate])),'') IS NOT NULL
            GROUP BY
              YEAR(CAST(COALESCE(CAST([date] AS date), TRY_CONVERT(date,[transac_date]), TRY_CONVERT(date,[inbound])) AS date)),
              MONTH(CAST(COALESCE(CAST([date] AS date), TRY_CONVERT(date,[transac_date]), TRY_CONVERT(date,[inbound])) AS date)),
              NULLIF(LTRIM(RTRIM([plate])),'')
          )
          SELECT
            m.year, m.month,
            COUNT(*) as total_vehicles,
            SUM(CASE WHEN YEAR(fa.first_date) = m.year AND MONTH(fa.first_date) = m.month THEN 1 ELSE 0 END) as new_vehicles,
            SUM(CASE WHEN YEAR(fa.first_date) < m.year OR (YEAR(fa.first_date) = m.year AND MONTH(fa.first_date) < m.month) THEN 1 ELSE 0 END) as returning_vehicles
          FROM monthly m
          JOIN first_appearance fa ON fa.plate = m.plate
          GROUP BY m.year, m.month
          ORDER BY m.year ASC, m.month ASC
        `);
        res.json(result.recordset || []);
      } catch (err) { res.status(500).json({ error: 'Failed', details: err.message }); }
    });

    // =========================================================================
    // DAILY WASTE MONITORING ENDPOINTS
    // =========================================================================

    // Substrate category expression (reused across queries)
    const substrateCaseExpr = `
      CASE
        WHEN LOWER(ISNULL([product],'')) LIKE '%pulp%'
          OR LOWER(ISNULL([product],'')) LIKE '%pineapple%'
          OR LOWER(ISNULL([product],'')) LIKE '%whole fruit%'
          OR LOWER(ISNULL([product],'')) LIKE '%fruit waste%'
        THEN 'Pineapple'
        WHEN LOWER(ISNULL([product],'')) LIKE '%sludge%'
          OR LOWER(ISNULL([product],'')) LIKE '%digestate%'
        THEN 'Sludge'
        WHEN LOWER(ISNULL([product],'')) LIKE '%manure%'
        THEN 'Manure'
        ELSE 'Other'
      END`;

    const sourceCaseExpr = `
      CASE
        WHEN LOWER(ISNULL([product],'')) LIKE '%pulp%'
          OR LOWER(ISNULL([product],'')) LIKE '%pineapple%'
          OR LOWER(ISNULL([product],'')) LIKE '%whole fruit%'
          OR LOWER(ISNULL([product],'')) LIKE '%fruit waste%'
        THEN 'DOLE'
        WHEN LOWER(ISNULL([product],'')) LIKE '%manure%'
        THEN 'Local Farms'
        WHEN LOWER(ISNULL([product],'')) LIKE '%sludge%'
          OR LOWER(ISNULL([product],'')) LIKE '%digestate%'
        THEN 'MWSS/LWUA'
        ELSE 'Internal / Other'
      END`;

    const dateExpr = `COALESCE(CAST([date] AS date), TRY_CONVERT(date, transac_date), TRY_CONVERT(date, inbound))`;

    // ── 1. Daily feedstock stacked bar data ──
    app.get('/api/daily-waste/feedstock', async (req, res) => {
      try {
        const startDate = req.query.startDate || '2025-01-01';
        const endDate   = req.query.endDate   || new Date().toISOString().split('T')[0];
        const [sy, sm, sd] = startDate.split('-').map(Number);
        const [ey, em, ed] = endDate.split('-').map(Number);
        const result = await pool.request()
          .input('sd', sql.Date, new Date(Date.UTC(sy, sm - 1, sd)))
          .input('ed', sql.Date, new Date(Date.UTC(ey, em - 1, ed)))
          .query(`
            SELECT
              CAST(${dateExpr} AS date) AS day,
              ${substrateCaseExpr} AS substrate_category,
              COUNT(*) AS trips,
              SUM(TRY_CONVERT(DECIMAL(18,2), net_weight))   AS net_kg,
              SUM(TRY_CONVERT(DECIMAL(18,2), gross_weight)) AS gross_kg
            FROM [FTSS].[dbo].[transac]
            WHERE [deleted_at] IS NULL
              AND ${dateExpr} BETWEEN @sd AND @ed
            GROUP BY
              CAST(${dateExpr} AS date),
              ${substrateCaseExpr}
            ORDER BY day, substrate_category
          `);
        res.json(result.recordset || []);
      } catch (err) {
        console.error('GET /api/daily-waste/feedstock error:', err);
        res.status(500).json({ error: 'Failed', details: err.message });
      }
    });

    // ── 2. Waste source pie chart ──
    app.get('/api/daily-waste/source-pie', async (req, res) => {
      try {
        const startDate = req.query.startDate || '2025-01-01';
        const endDate   = req.query.endDate   || new Date().toISOString().split('T')[0];
        const [sy, sm, sd] = startDate.split('-').map(Number);
        const [ey, em, ed] = endDate.split('-').map(Number);
        const result = await pool.request()
          .input('sd', sql.Date, new Date(Date.UTC(sy, sm - 1, sd)))
          .input('ed', sql.Date, new Date(Date.UTC(ey, em - 1, ed)))
          .query(`
            SELECT
              ${sourceCaseExpr} AS source,
              COUNT(*) AS trips,
              SUM(TRY_CONVERT(DECIMAL(18,2), net_weight)) AS net_kg
            FROM [FTSS].[dbo].[transac]
            WHERE [deleted_at] IS NULL
              AND ${dateExpr} BETWEEN @sd AND @ed
            GROUP BY ${sourceCaseExpr}
            ORDER BY net_kg DESC
          `);
        res.json(result.recordset || []);
      } catch (err) {
        console.error('GET /api/daily-waste/source-pie error:', err);
        res.status(500).json({ error: 'Failed', details: err.message });
      }
    });

    // ── 3. Daily totals (used for gauge + outage overlay) ──
    app.get('/api/daily-waste/daily-totals', async (req, res) => {
      try {
        const startDate = req.query.startDate || '2025-01-01';
        const endDate   = req.query.endDate   || new Date().toISOString().split('T')[0];
        const [sy, sm, sd] = startDate.split('-').map(Number);
        const [ey, em, ed] = endDate.split('-').map(Number);
        const [totalsRes, outagesRes] = await Promise.all([
          pool.request()
            .input('sd', sql.Date, new Date(Date.UTC(sy, sm - 1, sd)))
            .input('ed', sql.Date, new Date(Date.UTC(ey, em - 1, ed)))
            .query(`
              SELECT
                CAST(${dateExpr} AS date) AS day,
                COUNT(*) AS trips,
                SUM(TRY_CONVERT(DECIMAL(18,2), net_weight))   AS net_kg,
                SUM(TRY_CONVERT(DECIMAL(18,2), gross_weight)) AS gross_kg
              FROM [FTSS].[dbo].[transac]
              WHERE [deleted_at] IS NULL
                AND ${dateExpr} BETWEEN @sd AND @ed
              GROUP BY CAST(${dateExpr} AS date)
              ORDER BY day
            `),
          // Try to load outages — gracefully return empty if table doesn't exist
          pool.request()
            .input('sd', sql.Date, new Date(Date.UTC(sy, sm - 1, sd)))
            .input('ed', sql.Date, new Date(Date.UTC(ey, em - 1, ed)))
            .query(`
              IF OBJECT_ID('[FTSS].[dbo].[outages]', 'U') IS NOT NULL
                SELECT outage_date AS day, plant_area, cause_category, duration_hours, severity
                FROM [FTSS].[dbo].[outages]
                WHERE [deleted_at] IS NULL AND outage_date BETWEEN @sd AND @ed
                ORDER BY outage_date
              ELSE
                SELECT CAST(NULL AS date) AS day, CAST(NULL AS nvarchar(100)) AS plant_area,
                       CAST(NULL AS nvarchar(100)) AS cause_category,
                       CAST(NULL AS decimal(10,2)) AS duration_hours,
                       CAST(NULL AS nvarchar(20)) AS severity
                WHERE 1=0
            `),
        ]);
        res.json({
          totals:  totalsRes.recordset  || [],
          outages: outagesRes.recordset || [],
        });
      } catch (err) {
        console.error('GET /api/daily-waste/daily-totals error:', err);
        res.status(500).json({ error: 'Failed', details: err.message });
      }
    });

    // ── 4. Drill-down: raw transactions for a date range + substrate ──
    app.get('/api/daily-waste/drill', async (req, res) => {
      try {
        const startDate = req.query.startDate || '2025-01-01';
        const endDate   = req.query.endDate   || new Date().toISOString().split('T')[0];
        const substrate = req.query.substrate || null;
        const [sy, sm, sd] = startDate.split('-').map(Number);
        const [ey, em, ed] = endDate.split('-').map(Number);
        const request = pool.request()
          .input('sd', sql.Date, new Date(Date.UTC(sy, sm - 1, sd)))
          .input('ed', sql.Date, new Date(Date.UTC(ey, em - 1, ed)));
        let subWhere = '';
        if (substrate && substrate !== 'All') {
          // Build substrate WHERE from category
          const catMap = {
            Pineapple: `(LOWER(ISNULL([product],'')) LIKE '%pulp%' OR LOWER(ISNULL([product],'')) LIKE '%pineapple%' OR LOWER(ISNULL([product],'')) LIKE '%whole fruit%' OR LOWER(ISNULL([product],'')) LIKE '%fruit waste%')`,
            Sludge:    `(LOWER(ISNULL([product],'')) LIKE '%sludge%' OR LOWER(ISNULL([product],'')) LIKE '%digestate%')`,
            Manure:    `LOWER(ISNULL([product],'')) LIKE '%manure%'`,
          };
          subWhere = catMap[substrate] ? `AND ${catMap[substrate]}` : '';
        }
        const result = await request.query(`
          SELECT TOP 500
            id,
            CAST(${dateExpr} AS date) AS day,
            [plate] AS plate_no, driver, [product],
            ${substrateCaseExpr} AS substrate_category,
            ${sourceCaseExpr}    AS source,
            TRY_CONVERT(DECIMAL(18,2), net_weight)   AS net_kg,
            TRY_CONVERT(DECIMAL(18,2), gross_weight) AS gross_kg,
            TRY_CONVERT(DECIMAL(18,2), tare_weight)  AS tare_kg,
            [status]
          FROM [FTSS].[dbo].[transac]
          WHERE [deleted_at] IS NULL
            AND ${dateExpr} BETWEEN @sd AND @ed
            ${subWhere}
          ORDER BY ${dateExpr}, id
        `);
        res.json(result.recordset || []);
      } catch (err) {
        console.error('GET /api/daily-waste/drill error:', err);
        res.status(500).json({ error: 'Failed', details: err.message });
      }
    });

    // =========================================================================
    // ===== AI CHAT HELPERS =====

    function extractDateRange(msgs) {
      const lastUserMsg = [...msgs].reverse().find(m => m.role === 'user')?.content?.toLowerCase() || '';
      const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
      const now = new Date();
      let startDate = null, endDate = null, label = null;
      for (let i = 0; i < months.length; i++) {
        if (lastUserMsg.includes(months[i])) {
          const yearMatch = lastUserMsg.match(/20\d{2}/);
          const year = yearMatch ? parseInt(yearMatch[0]) : now.getFullYear();
          startDate = new Date(year, i, 1);
          endDate = new Date(year, i + 1, 0);
          label = months[i].charAt(0).toUpperCase() + months[i].slice(1) + ' ' + year;
          break;
        }
      }
      if (!startDate) {
        if (lastUserMsg.includes('today')) {
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          endDate   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          label = 'Today (' + now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) + ')';
        } else if (lastUserMsg.includes('this week')) {
          const dow = now.getDay();
          startDate = new Date(now); startDate.setDate(now.getDate() - dow);
          endDate = new Date(now); label = 'This week';
        } else if (lastUserMsg.includes('this month')) {
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now);
          label = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        } else if (lastUserMsg.includes('last month')) {
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          endDate   = new Date(now.getFullYear(), now.getMonth(), 0);
          label = new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        } else if (lastUserMsg.includes('this year')) {
          startDate = new Date(now.getFullYear(), 0, 1);
          endDate = new Date(now); label = String(now.getFullYear());
        }
      }
      return { startDate, endDate, label };
    }

    function isDataQuestion(msgs) {
      const t = [...msgs].reverse().find(m => m.role === 'user')?.content?.toLowerCase() || '';
      return ['how many','count','total','number of','transaction','weight','gross','net','tare',
        'product','status','valid','void','rejected','driver','vehicle','plate','weigher',
        'january','february','march','april','may','june','july','august','september',
        'october','november','december','this month','last month','this year','today',
        'this week','summary','report','breakdown'].some(kw => t.includes(kw));
    }

    async function fetchLiveDataForChat(msgs) {
      try {
        if (!isDataQuestion(msgs)) return null;
        const { startDate, endDate, label } = extractDateRange(msgs);
        const dateExpr = `COALESCE(CAST([date] AS date), TRY_CONVERT(date, transac_date), TRY_CONVERT(date, inbound))`;
        let where = 'WHERE deleted_at IS NULL';
        const r1 = pool.request();
        if (startDate && endDate) {
          r1.input('sd', sql.Date, startDate);
          r1.input('ed', sql.Date, endDate);
          where += ` AND ${dateExpr} BETWEEN @sd AND @ed`;
        }
        const sum = await r1.query(`
          SELECT COUNT(*) as total,
            SUM(CASE WHEN LOWER(TRIM(status))='valid'    THEN 1 ELSE 0 END) as valid_count,
            SUM(CASE WHEN LOWER(TRIM(status))='void'     THEN 1 ELSE 0 END) as void_count,
            SUM(CASE WHEN LOWER(TRIM(status))='rejected' THEN 1 ELSE 0 END) as rejected_count,
            SUM(CASE WHEN LOWER(TRIM(status))='pending'  THEN 1 ELSE 0 END) as pending_count,
            SUM(ISNULL(gross_weight,0)) as total_gross,
            SUM(ISNULL(net_weight,0))   as total_net,
            SUM(ISNULL(tare_weight,0))  as total_tare
          FROM FTSS.dbo.transac ${where}
        `);
        const r2 = pool.request();
        if (startDate && endDate) { r2.input('sd', sql.Date, startDate); r2.input('ed', sql.Date, endDate); }
        const prod = await r2.query(`
          SELECT TOP 10 ISNULL(NULLIF(TRIM(product),''),'(Unknown)') as product, COUNT(*) as cnt
          FROM FTSS.dbo.transac ${where} GROUP BY TRIM(product) ORDER BY cnt DESC
        `);
        const s = sum.recordset[0];
        const products = prod.recordset || [];
        const timestamp = new Date().toLocaleString('en-US', {
          month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
        });
        let ctx = `=== LIVE DATABASE DATA (retrieved: ${timestamp}) ===\n`;
        ctx += `Period: ${label || 'All time'}\n`;
        ctx += `Total transactions: ${s.total}\n`;
        ctx += `By status — Valid: ${s.valid_count}, Void: ${s.void_count}, Rejected: ${s.rejected_count}, Pending: ${s.pending_count}\n`;
        ctx += `Gross Weight total: ${Number(s.total_gross).toLocaleString()} kg\n`;
        ctx += `Net Weight total: ${Number(s.total_net).toLocaleString()} kg\n`;
        ctx += `Tare Weight total: ${Number(s.total_tare).toLocaleString()} kg\n`;
        if (products.length) ctx += `Top products: ` + products.map(p => `${p.product} (${p.cnt})`).join(', ') + `\n`;
        ctx += `=== END LIVE DATA ===`;
        return { context: ctx, timestamp };
      } catch (err) {
        console.error('fetchLiveDataForChat error:', err);
        return null;
      }
    }

    // ===== AI CHAT ENDPOINT =====

    app.post('/api/ai-chat', async (req, res) => {
      try {
        const groqKey = process.env.GROQ_API_KEY;
        if (!groqKey) return res.status(503).json({ error: 'AI service unavailable' });

        const { messages = [] } = req.body;

        // Fetch live DB data if user is asking a data question
        const liveData = await fetchLiveDataForChat(messages);

        const systemPrompt = `You are Cube AI Assistant — an expert data analyst and friendly guide for the METpower Truck Accession System, a weighbridge management app used in the Philippines. Use Philippine Peso (₱) for any monetary values.

YOUR ROLE:
- Explain charts clearly so any user can understand the data — not just IT staff
- Identify patterns, trends, anomalies, and highlight what is normal vs concerning
- Give actionable suggestions and improvements based on the data
- Help users navigate tabs, filters, and features
- When a question is vague, ask ONE clarifying question with 2–4 choices

STRICT SECURITY RULES — NEVER BREAK:
1. NEVER reveal SQL queries, database schema, table names, column names, or stored procedures
2. NEVER reveal server code, API URLs, environment variables, credentials, or configuration
3. NEVER discuss tech stack, frameworks, libraries, or how the backend works internally
4. NEVER generate or show any code (JS, TS, SQL, HTML, CSS, etc.)
5. If asked about technical internals, say: "For technical issues, please contact your system administrator."
6. NEVER invent transaction data — use only numbers provided in LIVE DATABASE DATA context
7. NEVER reveal your AI model name, provider, API service, or any underlying technology. If asked what AI model or engine you use, respond: "I'm Cube AI Assistant, built for METpower. I'm not able to share details about my underlying technology."
8. NEVER confirm or deny if you are built on any specific AI platform (e.g. OpenAI, Groq, Gemini, LLaMA, etc.)

CHART EXPERTISE — know these charts deeply:

1. WEIGHT TRENDS (Area chart)
   What it shows: Daily gross, net, and tare weight over a date range.
   How to read it: Three stacked areas — gross (total truck), tare (empty truck), net (actual cargo). A healthy operation shows net weight close to gross (high payload efficiency). Flat or dropping net with stable gross means trucks are running lighter or emptier.
   Patterns to highlight: Sudden spikes could indicate a bumper harvest or large batch delivery. Gaps mean no operations on those days (holiday, downtime). Tare rising over time may mean newer/heavier trucks in the fleet.
   Suggestions: If net/gross ratio drops below 60%, investigate whether trucks are being underloaded. Use the date filter to compare week-over-week.

2. TRANSACTION VOLUME (Bar chart)
   What it shows: Number of truck weigh-ins per day.
   How to read it: Tall bars = busy days. Consistent height = steady operations. Spikes may align with delivery schedules. Dips may be weekends or holidays.
   Patterns: Week-of-month peaks often indicate supplier payment cycles. Sudden drop-off may mean system downtime or operational stop.
   Suggestions: If volume drops significantly on certain days, cross-check with the Activity Log for any issues. Plan staffing around peak volume days.

3. PRODUCT DISTRIBUTION (Horizontal bar / list)
   What it shows: Breakdown of transactions and weight by product type (e.g. Pineapple pulp, Manure, Sludge).
   How to read it: Longer bar = more transactions or weight for that product. Switch between Trips and Weight views to see if one product dominates by count but not weight (or vice versa).
   Patterns: If one product is 70%+ of all trips, the operation is heavily dependent on it — a supply disruption would be critical. Diverse product mix is healthier.
   Suggestions: Watch for new product types appearing — they may need updated pricing or processing procedures. If a product has many trips but low weight, investigate if weighing is being done consistently.

4. MONTHLY TONNAGE
   What it shows: Total weight processed per month, usually as a bar or line.
   How to read it: An upward trend = growing operations. Seasonal dips are expected for agricultural products.
   Suggestions: Compare same month year-over-year to understand seasonal cycles. A sudden monthly drop warrants investigation.

5. STATUS BREAKDOWN (Pie/donut or bar)
   What it shows: Proportion of transactions by status — Valid, Void, Rejected, Pending.
   How to read it: Valid should dominate (ideally 90%+). High Void or Rejected rate signals data quality issues, disputes, or process problems.
   Patterns: If Rejected spikes on specific dates, check the Activity Log for what happened that day. Void transactions may indicate weighing errors or cancelled deliveries.
   Suggestions: If Void rate exceeds 5%, review the weighing process and staff training. Pending transactions that never resolve should be audited.

6. TOP DRIVERS
   What it shows: Drivers ranked by number of trips or total weight.
   How to read it: Top drivers handle the most volume. A very dominant single driver (50%+) may indicate over-reliance on one person or data entry errors.
   Suggestions: Recognize top performers. Flag unusually high trip counts for audit — they could be legitimate heavy users or entry duplication.

7. TOP VEHICLES
   What it shows: Vehicles (by plate) ranked by trips or weight.
   How to read it: Frequent vehicles = regular fleet. New plates appearing may be new supplier trucks.
   Suggestions: Vehicles with high trips but low average weight may need inspection. Vehicles with declining frequency may have been retired or redirected.

8. FLEET TRACKING
   What it shows: Vehicle activity and turnaround times across the fleet.
   How to read it: Fast turnaround = efficient weighing process. Long turnaround means trucks are waiting — possibly a bottleneck at the weighbridge.
   Suggestions: If average turnaround exceeds 30 minutes, investigate queue management at the gate. Schedule deliveries in time slots to spread the load.

9. HOURLY HEATMAP
   What it shows: Transaction volume by hour of day, across days of the week.
   How to read it: Dark/hot cells = peak hours. Most operations peak in the morning (7am–11am). Gaps may indicate shift changes or lunch breaks.
   Suggestions: If late-afternoon hours are consistently empty, consider adjusting gate operating hours. Peak hour clustering may cause queues — stagger delivery schedules.

10. WEIGHT RATIO
    What it shows: Net-to-gross weight ratio — how efficiently trucks are loaded.
    How to read it: Higher ratio = better cargo efficiency. Ratio below 50% means trucks are more than half empty on average.
    Suggestions: A declining weight ratio over time may mean smaller deliveries or partial loads. Work with suppliers to encourage full-load deliveries.

11. TURNAROUND TIME
    What it shows: Time from truck entry (inbound) to exit (outbound weight recording).
    How to read it: Short, consistent times = smooth operations. Outliers (very long times) may indicate system issues, disputes, or manual overrides.
    Suggestions: If average TAT exceeds 20 minutes, look for bottlenecks. Very fast TAT (under 2 minutes) may indicate data entry shortcuts — verify records are complete.

12. DAILY WASTE MONITORING
    What it shows: Waste material (substrates like pineapple pulp, sludge, manure) processed per day.
    How to read it: Consistent daily waste volume is normal for biogas plant feedstock. Drops may correlate with production slowdowns. Spikes may indicate large batch disposals.
    Suggestions: Track waste trends against production output. Unusual gaps may mean waste is being disposed via other channels — flag for audit.

SUGGESTION ENGINE RULES:
- When explaining a chart, always end with 1–2 concrete suggestions titled "What you can do:"
- Keep suggestions specific and actionable — not generic advice
- If data is provided, reference actual numbers in your suggestion
- If a metric is outside the healthy range described above, flag it clearly

CLARIFICATION FORMAT:
When a question is ambiguous, respond with a brief question and list choices on separate lines starting with "• " (bullet + space).

FORMATTING RULES:
- Write in plain, clear text — NEVER use markdown (no **, *, #, __, or leading dashes)
- Use "• " bullet only for choices and never for regular lists
- Use plain inline text for data points, e.g. "Total: 8,542 trips"

DATA INTEGRITY RULES:
- If LIVE DATABASE DATA is provided in context, use ONLY those numbers
- End responses that include live data with exactly: Source: Live database, retrieved [timestamp]
- If no live data is provided for a specific-number question, guide the user to the correct tab and filter

Tone: Friendly, clear, and confident. Write as if explaining to a smart non-technical supervisor who wants to make good decisions from the data.`;

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${groqKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            messages: [
              { role: 'system', content: systemPrompt },
              ...(liveData ? [{ role: 'system', content: liveData.context }] : []),
              ...messages.slice(-20),
            ],
            temperature: 0.65,
            max_tokens: 900,
          }),
        });

        if (!response.ok) {
          const err = await response.text();
          console.error('AI service error:', err);
          return res.status(502).json({ error: 'AI service error. Please try again.' });
        }

        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content ?? 'Sorry, I could not generate a response.';
        res.json({ reply });
      } catch (err) {
        console.error('AI chat error:', err);
        res.status(500).json({ error: 'Internal error' });
      }
    });

    app.post('/api/ai-summary', async (req, res) => {
      try {
        const groqKey = process.env.GROQ_API_KEY;
        if (!groqKey) return res.status(503).json({ error: 'AI service unavailable' });

        const kpi = req.body;

        const prompt = `You are a concise operational analyst for a truck weighbridge facility.
Given the following KPI data, write exactly 4 short bullet-point insights (no bullet symbols, just numbered 1–4).
Be factual, use the numbers, and keep each sentence under 30 words.

Data:
- Total transactions all-time: ${kpi.totalRecords?.toLocaleString() ?? 'N/A'}
- Trips today: ${kpi.todayTrips ?? 0}
- Trips this week: ${kpi.weekTrips ?? 0}
- Total gross weight: ${kpi.totalGrossWeight ? (kpi.totalGrossWeight / 1000).toFixed(2) + ' tonnes' : 'N/A'}
- Total net weight: ${kpi.totalNetWeight ? (kpi.totalNetWeight / 1000).toFixed(2) + ' tonnes' : 'N/A'}
- Total tare weight: ${kpi.totalTareWeight ? (kpi.totalTareWeight / 1000).toFixed(2) + ' tonnes' : 'N/A'}
- Average net payload per trip: ${kpi.avgNetWeight ? kpi.avgNetWeight.toFixed(0) + ' kg' : 'N/A'}
- Average net payload %: ${kpi.avgNetPayloadPct != null ? kpi.avgNetPayloadPct.toFixed(1) + '%' : 'N/A'}
- Today's status breakdown: ${JSON.stringify(kpi.todayStatuses ?? [])}

Return only 4 plain sentences, one per line, no preamble.`;

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${groqKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.4,
            max_tokens: 300,
          }),
        });

        if (!response.ok) {
          const err = await response.text();
          console.error('AI service error:', err);
          return res.status(502).json({ error: 'AI service error. Please try again.' });
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content ?? '';
        // Split into sentences, trim, filter empty lines
        const sentences = text.split('\n')
          .map(s => s.replace(/^\d+[\.\)]\s*/, '').trim())
          .filter(s => s.length > 0);

        res.json({ sentences });
      } catch (err) {
        console.error('AI summary error:', err);
        res.status(500).json({ error: 'Internal error' });
      }
    });

    // =========================================================================
    // ===== END ANALYTICS ENDPOINTS =====

    // Create HTTP server and initialize Socket.IO for real-time notifications
    const httpServer = createServer(app);
    const io = initializeSocketIO(httpServer, allowedOrigin);

    // Make pool and io available globally for real-time notifications
    app.set('sqlPool', pool);
    app.set('socketIO', io);

    // ── Start the Centralized Database Observer ──────────────────────────
    // Polls dbo.db_change_log (written by SQL triggers on transac, trucks,
    // drivers, products, users) and broadcasts real-time WebSocket events
    // for every INSERT / UPDATE / DELETE detected outside Node.js as well.
    startDatabaseObserver(pool, sql);

    httpServer.listen(port, () => {
      console.log(`✅ Server running on port ${port}`);
      console.log(`📊 API available at: http://localhost:${port}/api`);
      console.log(`🔍 Test with: http://localhost:${port}/api/transac?page=1&pageSize=5`);
      console.log(`🔌 WebSocket server ready for real-time notifications`);
    });

  })
  .catch(err => {
    console.error('❌ SQL Connection Error:', err.message);
    console.error('\nTroubleshooting tips:');
    console.error('1. Check if SQL Server is running');
    console.error('2. Verify SQL Server Browser service is running (for named instances)');
    console.error('3. Check TCP/IP is enabled in SQL Server Configuration Manager');
    console.error('4. Verify your .env file has correct credentials:');
    console.error('   DB_USER=your_username');
    console.error('   DB_PASSWORD=your_password');
    console.error('   DB_SERVER=localhost (or your server name)');
    console.error('   DB_INSTANCE=SQLEXPRESS (if using named instance, or omit for default)');
    console.error('   DB_DATABASE=FTSS');
    console.error('\nFull error details:', err);
    process.exit(1);
  });
