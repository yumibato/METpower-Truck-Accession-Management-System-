import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import sql from 'mssql';
import bcrypt from 'bcrypt';
import { setupTrashRoutes } from './trash-routes.js';

dotenv.config();

const app = express();
const allowedOrigin = process.env.CLIENT_ORIGIN || '*';
app.use(cors({ origin: allowedOrigin }));
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
  .then(pool => {
    console.log('✅ Connected to SQL Server successfully!');
    
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
          res.status(201).json(result.recordset[0]);
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
          res.json(result.recordset[0]);
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

    // Setup trash/restore routes
    setupTrashRoutes(app, pool, sql);

    app.listen(port, () => {
      console.log(`✅ Server running on port ${port}`);
      console.log(`📊 API available at: http://localhost:${port}/api`);
      console.log(`🔍 Test with: http://localhost:${port}/api/transac?page=1&pageSize=5`);
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
