-- ============================================================================
-- FTSS Database: Soft-Delete Trash Implementation
-- ============================================================================
-- This script adds trash/restore functionality without permanent deletion
-- ============================================================================

-- Step 1: Add deleted_at column to dbo.transac table
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'transac' AND COLUMN_NAME = 'deleted_at'
)
BEGIN
    ALTER TABLE dbo.transac
    ADD deleted_at DATETIME NULL;
    PRINT 'Added deleted_at column to dbo.transac';
END
ELSE
BEGIN
    PRINT 'deleted_at column already exists on dbo.transac';
END
GO

-- Step 2: Create index on deleted_at for query performance
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE object_id = OBJECT_ID('dbo.transac') AND name = 'IX_transac_deleted_at'
)
BEGIN
    CREATE INDEX IX_transac_deleted_at ON dbo.transac(deleted_at) INCLUDE (id, trans_no, driver);
    PRINT 'Created index on deleted_at column';
END
GO

-- Step 3: Add deleted_at column to dbo.users table
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'deleted_at'
)
BEGIN
    ALTER TABLE dbo.users
    ADD deleted_at DATETIME NULL;
    PRINT 'Added deleted_at column to dbo.users';
END
ELSE
    PRINT 'deleted_at column already exists on dbo.users';
GO

-- Step 4: Create view for active (non-deleted) transactions
IF OBJECT_ID('dbo.v_active_transactions', 'V') IS NOT NULL
    DROP VIEW dbo.v_active_transactions;
GO

CREATE VIEW dbo.v_active_transactions AS
SELECT 
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
    Remarks,
    transac_date,
    [date],
    status,
    vessel_id,
    weigher,
    No_of_Bags,
    deleted_at
FROM dbo.transac
WHERE deleted_at IS NULL;
GO

PRINT 'Created view v_active_transactions';

-- Step 5: Create view for trashed transactions
IF OBJECT_ID('dbo.v_trashed_transactions', 'V') IS NOT NULL
    DROP VIEW dbo.v_trashed_transactions;
GO

CREATE VIEW dbo.v_trashed_transactions AS
SELECT 
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
    Remarks,
    transac_date,
    [date],
    status,
    vessel_id,
    weigher,
    No_of_Bags,
    deleted_at
FROM dbo.transac
WHERE deleted_at IS NOT NULL;
GO

PRINT 'Created view v_trashed_transactions';

-- Step 6: Create stored procedure for soft-delete
IF OBJECT_ID('dbo.sp_trash_transaction', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_trash_transaction;
GO

CREATE PROCEDURE dbo.sp_trash_transaction
    @id INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        UPDATE dbo.transac
        SET deleted_at = GETUTCDATE()
        WHERE id = @id AND deleted_at IS NULL;
        
        IF @@ROWCOUNT = 0
            THROW 50001, 'Transaction not found or already deleted', 1;
        
        SELECT 'SUCCESS' AS result;
    END TRY
    BEGIN CATCH
        THROW;
    END CATCH
END;
GO

PRINT 'Created stored procedure sp_trash_transaction';

-- Step 7: Create stored procedure for restore
IF OBJECT_ID('dbo.sp_restore_transaction', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_restore_transaction;
GO

CREATE PROCEDURE dbo.sp_restore_transaction
    @id INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        UPDATE dbo.transac
        SET deleted_at = NULL
        WHERE id = @id AND deleted_at IS NOT NULL;
        
        IF @@ROWCOUNT = 0
            THROW 50002, 'Transaction not found in trash or already active', 1;
        
        SELECT 'SUCCESS' AS result;
    END TRY
    BEGIN CATCH
        THROW;
    END CATCH
END;
GO

PRINT 'Created stored procedure sp_restore_transaction';

-- Step 8: Create stored procedure for permanent cleanup (30+ days old)
IF OBJECT_ID('dbo.sp_cleanup_old_trash', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_cleanup_old_trash;
GO

CREATE PROCEDURE dbo.sp_cleanup_old_trash
    @daysOld INT = 30
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        DECLARE @deleteThreshold DATETIME = DATEADD(DAY, -@daysOld, GETUTCDATE());
        
        DELETE FROM dbo.transac
        WHERE deleted_at IS NOT NULL 
        AND deleted_at < @deleteThreshold;
        
        DECLARE @deletedRows INT = @@ROWCOUNT;
        SELECT 'SUCCESS' AS result, @deletedRows AS deleted_count;
    END TRY
    BEGIN CATCH
        THROW;
    END CATCH
END;
GO

PRINT 'Created stored procedure sp_cleanup_old_trash';

-- Step 9: Summary
PRINT '========================================================================';
PRINT 'Trash Feature Migration Complete!';
PRINT '========================================================================';
PRINT 'New columns: dbo.transac.deleted_at, dbo.users.deleted_at';
PRINT 'New views: v_active_transactions, v_trashed_transactions';
PRINT 'New procedures: sp_trash_transaction, sp_restore_transaction, sp_cleanup_old_trash';
PRINT '========================================================================';
