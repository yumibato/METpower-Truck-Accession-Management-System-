-- Database Migration: Add Indexes for Cursor-based Search Performance
-- This script creates indexes to support efficient cursor pagination and search

-- 1. Primary index for cursor-based pagination (transac_date + id)
-- This is the most critical index for the cursor-based search
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_transac_datelog_id' AND object_id = OBJECT_ID('FTSS.dbo.transac'))
BEGIN
    CREATE INDEX idx_transac_datelog_id 
    ON FTSS.dbo.transac (transac_date DESC, id DESC);
    PRINT '✅ Created index idx_transac_datelog_id for cursor pagination';
END
ELSE
BEGIN
    PRINT '⚠️  Index idx_transac_datelog_id already exists';
END

-- 2. Additional index for ascending order queries
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_transac_datelog_id_asc' AND object_id = OBJECT_ID('FTSS.dbo.transac'))
BEGIN
    CREATE INDEX idx_transac_datelog_id_asc 
    ON FTSS.dbo.transac (transac_date ASC, id ASC);
    PRINT '✅ Created index idx_transac_datelog_id_asc for ascending cursor pagination';
END
ELSE
BEGIN
    PRINT '⚠️  Index idx_transac_datelog_id_asc already exists';
END

-- 3. Index for search fields (trans_no, plate, driver, product, del_comp)
-- This improves performance for text search queries
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_transac_search_fields' AND object_id = OBJECT_ID('FTSS.dbo.transac'))
BEGIN
    CREATE INDEX idx_transac_search_fields 
    ON FTSS.dbo.transac (trans_no, plate, driver, product, del_comp);
    PRINT '✅ Created index idx_transac_search_fields for search performance';
END
ELSE
BEGIN
    PRINT '⚠️  Index idx_transac_search_fields already exists';
END

-- 4. Composite index for date range queries with search
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_transac_date_search' AND object_id = OBJECT_ID('FTSS.dbo.transac'))
BEGIN
    CREATE INDEX idx_transac_date_search 
    ON FTSS.dbo.transac (transac_date DESC, trans_no, plate, driver, product);
    PRINT '✅ Created index idx_transac_date_search for date-filtered searches';
END
ELSE
BEGIN
    PRINT '⚠️  Index idx_transac_date_search already exists';
END

-- 5. Status index for filtering by status
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_transac_status' AND object_id = OBJECT_ID('FTSS.dbo.transac'))
BEGIN
    CREATE INDEX idx_transac_status 
    ON FTSS.dbo.transac (status DESC, transac_date DESC);
    PRINT '✅ Created index idx_transac_status for status filtering';
END
ELSE
BEGIN
    PRINT '⚠️  Index idx_transac_status already exists';
END

-- 6. Full-text catalog for advanced search (optional, for fuzzy search)
-- Note: This requires SQL Server to have full-text search enabled
IF NOT EXISTS (SELECT * FROM sys.fulltext_catalogs WHERE name = 'ft_transac_catalog')
BEGIN
    CREATE FULLTEXT CATALOG ft_transac_catalog AS DEFAULT;
    PRINT '✅ Created full-text catalog ft_transac_catalog';
END
ELSE
BEGIN
    PRINT '⚠️  Full-text catalog ft_transac_catalog already exists';
END

-- 7. Full-text index on searchable fields
IF NOT EXISTS (SELECT * FROM sys.fulltext_indexes WHERE object_id = OBJECT_ID('FTSS.dbo.transac'))
BEGIN
    CREATE FULLTEXT INDEX ON FTSS.dbo.transac(
        trans_no LANGUAGE 1033,
        plate LANGUAGE 1033,
        driver LANGUAGE 1033,
        product LANGUAGE 1033,
        del_comp LANGUAGE 1033
    )
    KEY INDEX PK_transac  -- Replace with your actual primary key name if different
    ON ft_transac_catalog
    WITH CHANGE_TRACKING AUTO;
    PRINT '✅ Created full-text index for fuzzy search';
END
ELSE
BEGIN
    PRINT '⚠️  Full-text index already exists';
END

-- 8. Statistics update for optimal query performance
UPDATE STATISTICS FTSS.dbo.transac;
PRINT '✅ Updated table statistics';

-- 9. Verify indexes were created
SELECT 
    i.name AS index_name,
    i.type_desc AS index_type,
    i.is_unique,
    i.is_primary_key,
    STRING_AGG(c.name, ', ') AS columns
FROM sys.indexes i
INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
WHERE i.object_id = OBJECT_ID('FTSS.dbo.transac')
    AND i.name IN (
        'idx_transac_datelog_id', 
        'idx_transac_datelog_id_asc', 
        'idx_transac_search_fields',
        'idx_transac_date_search',
        'idx_transac_status'
    )
GROUP BY i.name, i.type_desc, i.is_unique, i.is_primary_key
ORDER BY i.name;

PRINT '🎉 Migration completed successfully!';
PRINT '📊 Indexes created for optimal cursor-based search performance';
