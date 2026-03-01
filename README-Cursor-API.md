# Cursor-based Search API Implementation

This implementation provides a reliable, fast, and consistent search experience using cursor-based pagination (keyset pagination) instead of traditional offset-based pagination.

## Overview

### Problems Solved
- **Inconsistent Results**: Offset pagination can miss or duplicate items when data changes between requests
- **Performance Issues**: Large OFFSET values cause poor database performance
- **Timezone Issues**: Date filters were not timezone-aware
- **Search Limitations**: Basic search lacked fuzzy matching and multi-field support

### Solutions Implemented
- **Cursor-based Pagination**: Uses opaque tokens for reliable pagination
- **Timezone-aware Dates**: All dates handled as ISO 8601 with timezone support
- **Enhanced Search**: Case-insensitive search with optional fuzzy matching
- **Optimized Indexes**: Database indexes for optimal performance

## API Endpoints

### 1. Search Endpoint
```
GET /api/search
```

#### Query Parameters
- `q` (string): Search query - searches across trans_no, plate, driver, product, del_comp
- `cursor` (string): Opaque cursor token from previous response
- `limit` (number): Results per page (default: 50, max: 100)
- `start` (string): ISO 8601 datetime with timezone (e.g., 2024-01-01T00:00:00+08:00)
- `end` (string): ISO 8601 datetime with timezone
- `sort` (string): Sort order - `datelog_desc`, `datelog_asc`, `id_desc`, `id_asc`
- `fuzzy` (string): Enable fuzzy search - `1` for enabled, `0` for disabled

#### Response Format
```json
{
  "items": [
    {
      "id": 123,
      "trans_no": "TRK001",
      "plate": "ABC123",
      "driver": "John Doe",
      "product": "Rice",
      "transac_date": "2024-01-15T10:30:00Z",
      // ... other fields
    }
  ],
  "next_cursor": "eyJkYXRlbG9nIjoiMjAyNC0wMS0xNVQxMDozMDowMFoiLCJpZCI6MTIzfQ==",
  "has_more": true,
  "total_returned": 50
}
```

### 2. Suggestions Endpoint
```
GET /api/search/suggestions
```

Returns recent transactions when no search results found.

#### Parameters
- `limit` (number): Number of suggestions (default: 100, max: 100)

#### Response
```json
{
  "items": [...],
  "total_returned": 100
}
```

### 3. Health Check
```
GET /api/health
```

Returns API status and available features.

## Frontend Integration

### Using the Cursor API

```typescript
import { cursorApi } from '../services/cursorApi';

// Search with filters
const result = await cursorApi.search({
  q: 'truck',
  start: '2024-01-01T00:00:00+08:00',
  end: '2024-12-31T23:59:59+08:00',
  limit: 50,
  sort: 'datelog_desc',
  fuzzy: '1'
});

// Get next page
if (result.next_cursor) {
  const nextPage = await cursorApi.search({
    cursor: result.next_cursor,
    limit: 50,
    sort: 'datelog_desc'
  });
}
```

### Cursor Pagination Pattern

```typescript
const [transactions, setTransactions] = useState([]);
const [nextCursor, setNextCursor] = useState(null);
const [hasMore, setHasMore] = useState(true);

const loadTransactions = async (cursor = null) => {
  const result = await cursorApi.search({
    q: searchTerm,
    cursor,
    limit: 50
  });
  
  if (cursor) {
    setTransactions(prev => [...prev, ...result.items]);
  } else {
    setTransactions(result.items);
  }
  
  setNextCursor(result.next_cursor);
  setHasMore(result.has_more);
};

// Load first page
loadTransactions();

// Load more (infinite scroll)
const loadMore = () => {
  if (hasMore && nextCursor) {
    loadTransactions(nextCursor);
  }
};
```

## Database Setup

### Required Indexes

Run the migration script to create necessary indexes:

```bash
# Run the SQL migration
sqlcmd -S your_server -d FTSS -i migration-cursor-indexes.sql
```

### Key Indexes Created
1. **Primary Cursor Index**: `(transac_date DESC, id DESC)`
2. **Ascending Index**: `(transac_date ASC, id ASC)`
3. **Search Index**: `(trans_no, plate, driver, product, del_comp)`
4. **Date-Search Composite**: `(transac_date DESC, trans_no, plate, driver, product)`
5. **Full-Text Index**: For fuzzy search support

## Postman Collection

Import the provided `postman-collection.json` to test the API endpoints.

### Collection Variables
- `baseUrl`: API base URL (default: http://localhost:3001)

### Example Requests

1. **Basic Search**:
   ```
   GET {{baseUrl}}/api/search?q=test&limit=10
   ```

2. **Date Range Search**:
   ```
   GET {{baseUrl}}/api/search?q=truck&start=2024-01-01T00:00:00+08:00&end=2024-12-31T23:59:59+08:00
   ```

3. **Cursor Pagination**:
   ```
   # First page
   GET {{baseUrl}}/api/search?limit=5
   
   # Next page (using cursor from first response)
   GET {{baseUrl}}/api/search?limit=5&cursor={{next_cursor}}
   ```

## Timezone Handling

### Best Practices
1. **Always send ISO 8601 with timezone**: `2024-01-15T10:30:00+08:00`
2. **Convert dates on client**: Use browser's timezone or let user select
3. **Server handles UTC conversion**: Dates are normalized server-side

### Date Range Examples
```javascript
// Today in user's timezone
const today = new Date();
const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

// Send to API
await cursorApi.search({
  start: start.toISOString(),      // "2024-01-15T00:00:00+08:00"
  end: end.toISOString()            // "2024-01-16T00:00:00+08:00"
});
```

## Performance Considerations

### Cursor vs Offset
- **Cursor**: O(1) performance regardless of page number
- **Offset**: O(n) performance, degrades with large offsets

### Query Optimization
- Limited fields returned for speed
- Efficient WHERE clauses with indexes
- No expensive COUNT(*) queries for total

### Memory Usage
- Server holds minimal state
- Cursors are opaque tokens (base64 encoded JSON)
- No server-side session storage

## Error Handling

### Common Errors
1. **Invalid Cursor**: `400 Bad Request` - "Invalid cursor format"
2. **Invalid Date**: `400 Bad Request` - "Invalid datetime format"
3. **Database Errors**: `500 Internal Server Error` - "Search failed"

### Client-Side Handling
```typescript
try {
  const result = await cursorApi.search(params);
  // Handle success
} catch (error) {
  if (error.message.includes('Invalid cursor')) {
    // Reset to first page
    loadTransactions(null);
  } else if (error.message.includes('Invalid datetime')) {
    // Show date format error to user
    showError('Please use valid date format');
  } else {
    // Generic error
    showError('Search failed. Please try again.');
  }
}
```

## Testing

### Unit Tests
Run the test suite:
```bash
npm test
```

### Test Coverage
- API endpoint responses
- Cursor encoding/decoding
- Date handling
- Error scenarios
- Performance tests

### Manual Testing
1. Use Postman collection
2. Test with various date ranges
3. Test pagination flow
4. Test search with special characters

## Migration Guide

### From Offset to Cursor

1. **Replace page/pageSize with cursor/limit**
2. **Remove total count from UI** (use "has_more" instead)
3. **Implement infinite scroll** instead of page numbers
4. **Update date pickers** to send ISO 8601 with timezone

### Frontend Changes
```typescript
// Old approach
const { page, pageSize, total } = usePagination();
const result = await api.get({ page, pageSize, search });

// New approach
const { items, nextCursor, hasMore } = useCursorPagination();
const result = await cursorApi.search({ q: search, limit: 50 });
```

## Security Considerations

### Cursor Security
- Cursors are base64-encoded JSON (not encrypted)
- Contains timestamp and ID (not sensitive data)
- Short TTL recommended for additional security

### Input Validation
- All query parameters validated
- SQL injection protection via parameterized queries
- Rate limiting recommended for production

## Monitoring

### Key Metrics
- Response time per endpoint
- Database query performance
- Error rates by type
- Cursor usage patterns

### Logging
- Search queries (for optimization)
- Cursor generation/usage
- Performance warnings
- Error details

## Troubleshooting

### Common Issues
1. **Missing results**: Check date range timezone
2. **Slow queries**: Verify indexes are created
3. **Cursor errors**: Ensure sort order is consistent
4. **Search not working**: Check full-text search setup

### Debug Queries
Enable query logging in development to see generated SQL.

## Future Enhancements

### Planned Features
1. **Advanced Filters**: Status, vehicle type, product filters
2. **Export Functionality**: CSV export with current filters
3. **Search Analytics**: Track popular searches
4. **Caching**: Redis caching for frequent queries

### Performance Improvements
1. **Read Replicas**: Offload search queries
2. **Partitioning**: Date-based table partitioning
3. **Elasticsearch**: For advanced search capabilities
