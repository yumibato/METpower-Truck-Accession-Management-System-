# Postman API Examples for Cursor-based Search

## Environment Variables
Set up the following environment variable in Postman:
- `baseUrl`: http://localhost:3001

## API Endpoints

### 1. Health Check
**Method**: GET  
**URL**: `{{baseUrl}}/api/health`  
**Description**: Check API health and available features

**Expected Response**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "features": {
    "cursor_pagination": true,
    "timezone_aware_dates": true,
    "fuzzy_search": true
  }
}
```

### 2. Basic Search
**Method**: GET  
**URL**: `{{baseUrl}}/api/search?q=test&limit=10`  
**Description**: Basic search with pagination

**Query Parameters**:
- `q`: Search query term
- `limit`: Number of results to return (max 100)

### 3. Search with Date Range
**Method**: GET  
**URL**: `{{baseUrl}}/api/search?q=truck&start=2024-01-01T00:00:00+08:00&end=2024-12-31T23:59:59+08:00&limit=20`  
**Description**: Search with timezone-aware date range filtering

**Query Parameters**:
- `q`: Search query
- `start`: Start date with timezone (ISO 8601)
- `end`: End date with timezone (ISO 8601)
- `limit`: Page size

### 4. Fuzzy Search
**Method**: GET  
**URL**: `{{baseUrl}}/api/search?q=truk&fuzzy=1&limit=15`  
**Description**: Fuzzy search for misspelled terms

**Query Parameters**:
- `q`: Misspelled search term
- `fuzzy`: Enable fuzzy search (full-text) - "1" for enabled, "0" for disabled
- `limit`: Page size

### 5. Cursor Pagination - First Page
**Method**: GET  
**URL**: `{{baseUrl}}/api/search?sort=datelog_desc&limit=5`  
**Description**: Get first page of results with cursor

**Query Parameters**:
- `sort`: Sort order - datelog_desc, datelog_asc, id_desc, id_asc
- `limit`: Small page size for demonstration

**Test Script** (to save cursor):
```javascript
// Save cursor for next page
if (pm.response.code === 200 && pm.response.json().next_cursor) {
    pm.collectionVariables.set('next_cursor', pm.response.json().next_cursor);
    console.log('Saved cursor:', pm.response.json().next_cursor);
}
```

### 6. Cursor Pagination - Next Page
**Method**: GET  
**URL**: `{{baseUrl}}/api/search?sort=datelog_desc&limit=5&cursor={{next_cursor}}`  
**Description**: Get next page using cursor from previous request

**Query Parameters**:
- `sort`: Same sort order as first page
- `limit`: Same page size as first page
- `cursor`: Cursor from previous page

### 7. Get Suggestions
**Method**: GET  
**URL**: `{{baseUrl}}/api/search/suggestions?limit=10`  
**Description**: Get recent transactions for suggestions when no search results

**Query Parameters**:
- `limit`: Number of suggestions to return

### 8. Error Handling - Invalid Cursor
**Method**: GET  
**URL**: `{{baseUrl}}/api/search?cursor=invalid_cursor_token`  
**Description**: Test error handling with invalid cursor

**Expected Response**:
```json
{
  "error": "Invalid cursor format"
}
```

### 9. Error Handling - Invalid Date
**Method**: GET  
**URL**: `{{baseUrl}}/api/search?start=invalid-date`  
**Description**: Test error handling with invalid date format

**Expected Response**:
```json
{
  "error": "Invalid datetime format. Use ISO 8601 format."
}
```

## Collection Setup Instructions

1. **Create New Collection**: In Postman, click "New" → "Collection"
2. **Set Environment**: Create environment with `baseUrl` variable
3. **Add Requests**: Add each endpoint as a new request in the collection
4. **Set Test Scripts**: Add the provided test script to the first page request
5. **Run Collection**: Use the collection runner to test all endpoints

## Testing Workflow

1. **Health Check**: Verify API is running
2. **Basic Search**: Test simple search functionality
3. **Date Range**: Test timezone-aware filtering
4. **Fuzzy Search**: Test misspelled term handling
5. **Pagination**: Test cursor-based pagination flow
6. **Suggestions**: Test fallback when no results
7. **Error Handling**: Verify proper error responses

## Expected Response Format

All search responses follow this format:
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

## Tips for Testing

- **Save Environment**: Make sure to save the environment after setting variables
- **Check Cursor**: Verify the cursor is saved correctly after first page request
- **Test Timezones**: Try different timezone formats in date parameters
- **Test Edge Cases**: Try empty searches, invalid dates, malformed cursors
- **Performance**: Monitor response times for large result sets
