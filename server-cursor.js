import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import sql from 'mssql';
import crypto from 'crypto';

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
    ...(hasInstance && !dbPort ? { instanceName } : {})
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 }
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

// Cursor utilities
const encodeCursor = (datelog, id) => {
  const cursorData = JSON.stringify({ datelog, id });
  return Buffer.from(cursorData).toString('base64');
};

const decodeCursor = (cursor) => {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch (error) {
    throw new Error('Invalid cursor format');
  }
};

// Parse timezone-aware datetime
const parseDateTime = (dateTimeStr) => {
  if (!dateTimeStr) return null;
  
  // Handle ISO 8601 with timezone
  const date = new Date(dateTimeStr);
  if (isNaN(date.getTime())) {
    throw new Error('Invalid datetime format');
  }
  
  return date;
};

// Build search filters for cursor-based pagination
const buildSearchFilters = (query, useCursor = false) => {
  const whereClauses = [];
  const inputs = [];
  let cursorClause = '';

  const search = (query.q || '').trim();
  const fuzzy = query.fuzzy === '1';
  const start = parseDateTime(query.start);
  const end = parseDateTime(query.end);
  const sort = query.sort || 'datelog_desc';
  const cursor = query.cursor;

  // Search clause
  if (search) {
    if (fuzzy) {
      // For SQL Server, we'll use CONTAINS for full-text search
      whereClauses.push('(CONTAINS(trans_no, @search) OR CONTAINS(plate, @search) OR CONTAINS(driver, @search) OR CONTAINS(product, @search) OR CONTAINS(del_comp, @search))');
    } else {
      // Case-insensitive search
      whereClauses.push('(LOWER(trans_no) LIKE LOWER(@search) OR LOWER(plate) LIKE LOWER(@search) OR LOWER(driver) LIKE LOWER(@search) OR LOWER(product) LIKE LOWER(@search) OR LOWER(del_comp) LIKE LOWER(@search))');
    }
    inputs.push({ name: 'search', type: sql.NVarChar, value: fuzzy ? `"${search}"` : `%${search}%` });
  }

  // Date range filters
  if (start) {
    whereClauses.push('transac_date >= @start');
    inputs.push({ name: 'start', type: sql.DateTime2, value: start });
  }
  
  if (end) {
    whereClauses.push('transac_date < @end');
    inputs.push({ name: 'end', type: sql.DateTime2, value: end });
  }

  // Cursor-based pagination
  if (useCursor && cursor) {
    const cursorData = decodeCursor(cursor);
    
    // Determine order and build cursor clause
    if (sort === 'datelog_desc') {
      cursorClause = '(transac_date < @cursor_datelog OR (transac_date = @cursor_datelog AND id < @cursor_id))';
      inputs.push({ name: 'cursor_datelog', type: sql.DateTime2, value: new Date(cursorData.datelog) });
      inputs.push({ name: 'cursor_id', type: sql.Int, value: cursorData.id });
    } else if (sort === 'datelog_asc') {
      cursorClause = '(transac_date > @cursor_datelog OR (transac_date = @cursor_datelog AND id > @cursor_id))';
      inputs.push({ name: 'cursor_datelog', type: sql.DateTime2, value: new Date(cursorData.datelog) });
      inputs.push({ name: 'cursor_id', type: sql.Int, value: cursorData.id });
    }
  }

  if (cursorClause) {
    whereClauses.push(cursorClause);
  }

  return {
    whereSql: whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '',
    inputs
  };
};

// Get sort clause
const getSortClause = (sort = 'datelog_desc') => {
  const sortMap = {
    'datelog_desc': 'ORDER BY transac_date DESC, id DESC',
    'datelog_asc': 'ORDER BY transac_date ASC, id ASC',
    'id_desc': 'ORDER BY id DESC',
    'id_asc': 'ORDER BY id ASC'
  };
  return sortMap[sort] || sortMap['datelog_desc'];
};

// Get the fields to return
const getSelectFields = () => {
  return `
    id,
    trans_no,
    barge_details,
    plate,
    initial_net_wt,
    inbound,
    outbound,
    driver,
    type_veh,
    product,
    ws_no,
    dr_no,
    del_comp,
    del_address,
    gross_weight,
    tare_weight,
    net_weight,
    inbound_wt,
    outbound_wt,
    Remarks AS remarks,
    transac_date,
    [date],
    status,
    vessel_id,
    weigher,
    No_of_Bags AS no_of_bags
  `;
};

sql.connect(config)
  .then(pool => {
    console.log('✅ Connected to SQL Server successfully!');

    // New cursor-based search endpoint
    app.get('/api/search', async (req, res) => {
      try {
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '50', 10)));
        const sort = req.query.sort || 'datelog_desc';
        
        const { whereSql, inputs } = buildSearchFilters(req.query, true);
        const sortClause = getSortClause(sort);
        const selectFields = getSelectFields();

        const request = pool.request();
        inputs.forEach(({ name, type, value }) => request.input(name, type, value));
        request.input('limit', sql.Int, limit);

        const dataQuery = `
          SELECT TOP (@limit)
            ${selectFields}
          FROM FTSS.dbo.transac
          ${whereSql}
          ${sortClause}
        `;

        const result = await request.query(dataQuery);
        const items = result.recordset || [];

        // Generate cursor for next page
        let nextCursor = null;
        let hasMore = false;

        if (items.length === limit) {
          // Fetch one more item to check if there are more results
          const checkRequest = pool.request();
          inputs.forEach(({ name, type, value }) => checkRequest.input(name, type, value));
          checkRequest.input('limit', sql.Int, 1);
          
          // Use the last item as cursor for the check
          const lastItem = items[items.length - 1];
          checkRequest.input('cursor_datelog', sql.DateTime2, new Date(lastItem.transac_date));
          checkRequest.input('cursor_id', sql.Int, lastItem.id);

          const checkQuery = `
            SELECT TOP 1 id
            FROM FTSS.dbo.transac
            ${whereSql} AND (transac_date < @cursor_datelog OR (transac_date = @cursor_datelog AND id < @cursor_id))
            ${sortClause}
          `;

          const checkResult = await checkRequest.query(checkQuery);
          hasMore = checkResult.recordset.length > 0;

          if (hasMore) {
            nextCursor = encodeCursor(lastItem.transac_date, lastItem.id);
          }
        }

        res.json({
          items,
          next_cursor: nextCursor,
          has_more: hasMore,
          total_returned: items.length
        });

      } catch (err) {
        console.error('Search API error:', err);
        if (err.message === 'Invalid cursor format') {
          return res.status(400).json({ error: 'Invalid cursor format' });
        }
        if (err.message === 'Invalid datetime format') {
          return res.status(400).json({ error: 'Invalid datetime format. Use ISO 8601 format.' });
        }
        res.status(500).json({ error: 'Search failed', details: err.message });
      }
    });

    // Endpoint to get top 100 items (for suggestions when no results)
    app.get('/api/search/suggestions', async (req, res) => {
      try {
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '100', 10)));
        const sortClause = getSortClause('datelog_desc');
        const selectFields = getSelectFields();

        const request = pool.request();
        request.input('limit', sql.Int, limit);

        const dataQuery = `
          SELECT TOP (@limit)
            ${selectFields}
          FROM FTSS.dbo.transac
          ${sortClause}
        `;

        const result = await request.query(dataQuery);
        const items = result.recordset || [];

        res.json({
          items,
          total_returned: items.length
        });

      } catch (err) {
        console.error('Suggestions API error:', err);
        res.status(500).json({ error: 'Failed to fetch suggestions' });
      }
    });

    // Health check endpoint
    app.get('/api/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        features: {
          cursor_pagination: true,
          timezone_aware_dates: true,
          fuzzy_search: true
        }
      });
    });

    const serverPort = process.env.PORT || 3001;
    app.listen(serverPort, () => {
      console.log(`🚀 Server running on port ${serverPort}`);
      console.log(`📊 Cursor-based search API available at /api/search`);
      console.log(`💡 Suggestions endpoint available at /api/search/suggestions`);
    });

  })
  .catch(err => {
    console.error('❌ Failed to connect to SQL Server:', err);
    console.error('Please check your database connection settings in .env');
    process.exit(1);
  });
