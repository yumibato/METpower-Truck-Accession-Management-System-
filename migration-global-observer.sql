-- ============================================================
-- METpower Global Database Observer
-- ============================================================
-- Monitors dbo.transac, dbo.trucks, dbo.drivers,
--          dbo.products, dbo.users
-- Every INSERT / UPDATE / DELETE will:
--   1. Write a record to dbo.db_change_log  (pulled by Node.js)
--   2. Insert into dbo.notifications
--   3. Insert into dbo.audit_log  (with old_value + new_value)
-- ============================================================

USE [FTSS];
GO

-- ============================================================
-- SECTION 1 : db_change_log  (polling queue for Node.js)
-- ============================================================
IF NOT EXISTS (
    SELECT * FROM sys.objects
    WHERE object_id = OBJECT_ID(N'[dbo].[db_change_log]') AND type = 'U'
)
BEGIN
    CREATE TABLE [dbo].[db_change_log] (
        [id]           BIGINT IDENTITY(1,1) PRIMARY KEY,
        [table_name]   NVARCHAR(100)  NOT NULL,
        [action]       NVARCHAR(10)   NOT NULL,  -- INSERT | UPDATE | DELETE
        [entity_id]    NVARCHAR(100)  NULL,       -- PK value of changed row
        [entity_label] NVARCHAR(500)  NULL,       -- human-readable label
        [old_value]    NVARCHAR(MAX)  NULL,        -- JSON snapshot before
        [new_value]    NVARCHAR(MAX)  NULL,        -- JSON snapshot after
        [priority]     NVARCHAR(10)   NOT NULL DEFAULT 'normal', -- normal | high | critical
        [is_processed] BIT            NOT NULL DEFAULT 0,
        [created_at]   DATETIME2      NOT NULL DEFAULT GETDATE()
    );
    CREATE INDEX IX_db_change_log_processed ON [dbo].[db_change_log]([is_processed],[created_at]);
    PRINT '✅ Table dbo.db_change_log created.';
END
ELSE
    PRINT '⚠️  Table dbo.db_change_log already exists.';
GO

-- ============================================================
-- SECTION 2 : Enhance audit_log (add table_name, old/new, priority)
-- ============================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[audit_log]') AND name = 'table_name'
)
    ALTER TABLE [dbo].[audit_log] ADD [table_name] NVARCHAR(100) NULL;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[audit_log]') AND name = 'entity_id'
)
    ALTER TABLE [dbo].[audit_log] ADD [entity_id] NVARCHAR(100) NULL;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[audit_log]') AND name = 'old_value'
)
    ALTER TABLE [dbo].[audit_log] ADD [old_value] NVARCHAR(MAX) NULL;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[audit_log]') AND name = 'new_value'
)
    ALTER TABLE [dbo].[audit_log] ADD [new_value] NVARCHAR(MAX) NULL;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[audit_log]') AND name = 'priority'
)
    ALTER TABLE [dbo].[audit_log] ADD [priority] NVARCHAR(10) NOT NULL DEFAULT 'normal';
GO

-- Make transaction_id nullable so audit_log works for non-transac tables
-- (only alter if it currently has a NOT NULL constraint)
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[audit_log]')
      AND name = 'transaction_id'
      AND is_nullable = 0
)
BEGIN
    -- Drop FK first if it exists
    IF EXISTS (
        SELECT 1 FROM sys.foreign_keys
        WHERE name = 'FK_audit_log_transaction'
    )
        ALTER TABLE [dbo].[audit_log] DROP CONSTRAINT FK_audit_log_transaction;

    ALTER TABLE [dbo].[audit_log] ALTER COLUMN [transaction_id] INT NULL;
    PRINT '✅ audit_log.transaction_id made nullable.';
END
GO

PRINT '✅ audit_log schema enhancements applied.';
GO

-- ============================================================
-- SECTION 3 : HELPER stored procedure used by all triggers
-- ============================================================
-- sp_observer_write  writes simultaneously to:
--   db_change_log, notifications, audit_log
-- ============================================================
IF EXISTS (
    SELECT * FROM sys.objects
    WHERE object_id = OBJECT_ID(N'[dbo].[sp_observer_write]') AND type = 'P'
)
    DROP PROCEDURE [dbo].[sp_observer_write];
GO

CREATE PROCEDURE [dbo].[sp_observer_write]
    @table_name   NVARCHAR(100),
    @action       NVARCHAR(10),
    @entity_id    NVARCHAR(100),
    @entity_label NVARCHAR(500),
    @old_value    NVARCHAR(MAX) = NULL,
    @new_value    NVARCHAR(MAX) = NULL,
    @notif_type   NVARCHAR(20),   -- success | info | warning | error
    @notif_title  NVARCHAR(255),
    @notif_message NVARCHAR(MAX),
    @priority     NVARCHAR(10) = 'normal'
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT OFF;   -- don't kill the outer transaction on failure

    -- 1. db_change_log  (Node.js picks this up via polling)
    BEGIN TRY
        INSERT INTO [dbo].[db_change_log]
            (table_name, action, entity_id, entity_label, old_value, new_value, priority)
        VALUES
            (@table_name, @action, @entity_id, @entity_label, @old_value, @new_value, @priority);
    END TRY
    BEGIN CATCH
        PRINT 'sp_observer_write: db_change_log insert failed: ' + ERROR_MESSAGE();
    END CATCH

    -- 2. notifications
    BEGIN TRY
        INSERT INTO [dbo].[notifications]
            ([username], [type], [title], [message], [action], [metadata])
        VALUES
            ('system', @notif_type, @notif_title, @notif_message, @action,
             '{"table":"' + @table_name + '","entity_id":"' + ISNULL(@entity_id,'') + '"}');
    END TRY
    BEGIN CATCH
        PRINT 'sp_observer_write: notifications insert failed: ' + ERROR_MESSAGE();
    END CATCH

    -- 3. audit_log
    BEGIN TRY
        INSERT INTO [dbo].[audit_log]
            ([username], [action], [details], [table_name], [entity_id],
             [old_value], [new_value], [priority], [created_at])
        VALUES
            ('system', @action, @notif_message, @table_name, @entity_id,
             @old_value, @new_value, @priority, GETUTCDATE());
    END TRY
    BEGIN CATCH
        PRINT 'sp_observer_write: audit_log insert failed: ' + ERROR_MESSAGE();
    END CATCH
END;
GO
PRINT '✅ Stored procedure sp_observer_write created.';
GO


-- ============================================================
-- SECTION 4 : TRIGGER — dbo.transac
-- ============================================================
IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'trg_transac_observer')
    DROP TRIGGER [dbo].[trg_transac_observer];
GO

CREATE TRIGGER [dbo].[trg_transac_observer]
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
            @notif_type   NVARCHAR(20),
            @priority     NVARCHAR(10),
            @title        NVARCHAR(255),
            @msg          NVARCHAR(MAX);

    SET @action = CASE
        WHEN EXISTS(SELECT 1 FROM inserted) AND EXISTS(SELECT 1 FROM deleted) THEN 'UPDATE'
        WHEN EXISTS(SELECT 1 FROM inserted) THEN 'INSERT'
        ELSE 'DELETE'
    END;

    -- Capture first affected row (triggers fire once per statement)
    IF @action IN ('INSERT','UPDATE')
    BEGIN
        SELECT TOP 1
            @entity_id    = CAST(i.id AS NVARCHAR),
            @entity_label = ISNULL(i.trans_no,'#'+ CAST(i.id AS NVARCHAR))
                            + ' | Plate: ' + ISNULL(i.plate,'?')
                            + ' | Driver: ' + ISNULL(i.driver,'?')
        FROM inserted i;

        SET @new_val = (
            SELECT TOP 1 id, trans_no, plate, driver, status,
                         gross_weight, net_weight, tare_weight
            FROM inserted
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        );
    END

    IF @action IN ('UPDATE','DELETE')
    BEGIN
        IF @entity_id IS NULL
            SELECT TOP 1 @entity_id = CAST(d.id AS NVARCHAR),
                         @entity_label = ISNULL(d.trans_no,'#'+ CAST(d.id AS NVARCHAR))
                                         + ' | Plate: ' + ISNULL(d.plate,'?')
                                         + ' | Driver: ' + ISNULL(d.driver,'?')
            FROM deleted d;

        SET @old_val = (
            SELECT TOP 1 id, trans_no, plate, driver, status,
                         gross_weight, net_weight, tare_weight
            FROM deleted
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        );
    END

    -- Set type + priority
    IF @action = 'DELETE'
    BEGIN
        SET @notif_type = 'error';
        SET @priority   = 'critical';
        SET @title      = '🗑️ Transaction Deleted';
        SET @msg        = 'Transaction ' + ISNULL(@entity_label,'unknown') + ' was permanently deleted.';
    END
    ELSE IF @action = 'INSERT'
    BEGIN
        SET @notif_type = 'success';
        SET @priority   = 'normal';
        SET @title      = '✅ New Transaction';
        SET @msg        = 'Transaction ' + ISNULL(@entity_label,'unknown') + ' was recorded.';
    END
    ELSE
    BEGIN
        SET @notif_type = 'info';
        SET @priority   = 'normal';
        SET @title      = '📝 Transaction Updated';
        SET @msg        = 'Transaction ' + ISNULL(@entity_label,'unknown') + ' was modified.';
    END

    -- NOTE: For transac, the Node.js API already calls sp_create_notification
    -- and broadcastNotification(). We only write to db_change_log + audit_log
    -- here to avoid duplicate notification rows and duplicate toast popups.
    -- The db-observer.js will emit data_changed (not new_notification) for transac.

    -- 1. db_change_log  (Node.js observer picks this up for data_changed refresh)
    BEGIN TRY
        INSERT INTO [dbo].[db_change_log]
            (table_name, action, entity_id, entity_label, old_value, new_value, priority)
        VALUES
            ('transac', @action, @entity_id, @entity_label, @old_val, @new_val, @priority);
    END TRY
    BEGIN CATCH
        PRINT 'trg_transac_observer: db_change_log insert failed: ' + ERROR_MESSAGE();
    END CATCH

    -- 2. audit_log  (permanent technical record with old + new values)
    BEGIN TRY
        INSERT INTO [dbo].[audit_log]
            ([username], [action], [details], [table_name], [entity_id],
             [old_value], [new_value], [priority], [created_at])
        VALUES
            ('system', @action, @msg, 'transac', @entity_id,
             @old_val, @new_val, @priority, GETUTCDATE());
    END TRY
    BEGIN CATCH
        PRINT 'trg_transac_observer: audit_log insert failed: ' + ERROR_MESSAGE();
    END CATCH
END;
GO
PRINT '✅ Trigger trg_transac_observer created.';
GO


-- ============================================================
-- SECTION 5 : TRIGGER — dbo.trucks
-- ============================================================
IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'trg_trucks_observer')
    DROP TRIGGER [dbo].[trg_trucks_observer];
GO

-- Only create if the table exists
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[trucks]') AND type = 'U')
BEGIN
    EXEC('
CREATE TRIGGER [dbo].[trg_trucks_observer]
ON [dbo].[trucks]
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @action  NVARCHAR(10),
            @id      NVARCHAR(100),
            @label   NVARCHAR(500),
            @old     NVARCHAR(MAX),
            @new     NVARCHAR(MAX),
            @ntype   NVARCHAR(20),
            @pri     NVARCHAR(10),
            @title   NVARCHAR(255),
            @msg     NVARCHAR(MAX);

    SET @action = CASE
        WHEN EXISTS(SELECT 1 FROM inserted) AND EXISTS(SELECT 1 FROM deleted) THEN ''UPDATE''
        WHEN EXISTS(SELECT 1 FROM inserted) THEN ''INSERT''
        ELSE ''DELETE''
    END;

    IF @action IN (''INSERT'',''UPDATE'')
    BEGIN
        SELECT TOP 1 @id = CAST(id AS NVARCHAR),
                     @label = ISNULL(plate, CAST(id AS NVARCHAR))
        FROM inserted;
        SET @new = (SELECT TOP 1 * FROM inserted FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
    END
    IF @action IN (''UPDATE'',''DELETE'')
    BEGIN
        IF @id IS NULL SELECT TOP 1 @id = CAST(id AS NVARCHAR), @label = ISNULL(plate,CAST(id AS NVARCHAR)) FROM deleted;
        SET @old = (SELECT TOP 1 * FROM deleted FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
    END

    IF @action = ''DELETE'' BEGIN SET @ntype=''error'';   SET @pri=''critical''; SET @title=''🚛 Truck Removed'';       SET @msg=''Truck ['' + ISNULL(@label,''?'') + ''] was removed from the system.''; END
    ELSE IF @action = ''INSERT'' BEGIN SET @ntype=''success''; SET @pri=''normal'';   SET @title=''🚛 New Truck Registered''; SET @msg=''Truck ['' + ISNULL(@label,''?'') + ''] was added to the fleet.''; END
    ELSE BEGIN SET @ntype=''info'';    SET @pri=''normal'';   SET @title=''🚛 Truck Updated'';        SET @msg=''Truck ['' + ISNULL(@label,''?'') + ''] details were modified.''; END

    EXEC [dbo].[sp_observer_write]
        @table_name=''trucks'', @action=@action, @entity_id=@id, @entity_label=@label,
        @old_value=@old, @new_value=@new, @notif_type=@ntype,
        @notif_title=@title, @notif_message=@msg, @priority=@pri;
END;
    ');
    PRINT '✅ Trigger trg_trucks_observer created.';
END
ELSE
    PRINT '⚠️  Table dbo.trucks not found — skipped trigger.';
GO


-- ============================================================
-- SECTION 6 : TRIGGER — dbo.drivers
-- ============================================================
IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'trg_drivers_observer')
    DROP TRIGGER [dbo].[trg_drivers_observer];
GO

IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[drivers]') AND type = 'U')
BEGIN
    EXEC('
CREATE TRIGGER [dbo].[trg_drivers_observer]
ON [dbo].[drivers]
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @action NVARCHAR(10), @id NVARCHAR(100), @label NVARCHAR(500),
            @old NVARCHAR(MAX), @new NVARCHAR(MAX),
            @ntype NVARCHAR(20), @pri NVARCHAR(10), @title NVARCHAR(255), @msg NVARCHAR(MAX);

    SET @action = CASE
        WHEN EXISTS(SELECT 1 FROM inserted) AND EXISTS(SELECT 1 FROM deleted) THEN ''UPDATE''
        WHEN EXISTS(SELECT 1 FROM inserted) THEN ''INSERT''
        ELSE ''DELETE''
    END;

    IF @action IN (''INSERT'',''UPDATE'')
    BEGIN
        SELECT TOP 1 @id = CAST(id AS NVARCHAR),
            @label = ISNULL(name, ISNULL(driver_name, CAST(id AS NVARCHAR)))
        FROM inserted;
        SET @new = (SELECT TOP 1 * FROM inserted FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
    END
    IF @action IN (''UPDATE'',''DELETE'')
    BEGIN
        IF @id IS NULL SELECT TOP 1 @id = CAST(id AS NVARCHAR),
            @label = ISNULL(name, ISNULL(driver_name, CAST(id AS NVARCHAR))) FROM deleted;
        SET @old = (SELECT TOP 1 * FROM deleted FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
    END

    IF @action = ''DELETE'' BEGIN SET @ntype=''error'';   SET @pri=''critical''; SET @title=''👤 Driver Removed'';     SET @msg=''Driver ['' + ISNULL(@label,''?'') + ''] was removed from the system.''; END
    ELSE IF @action = ''INSERT'' BEGIN SET @ntype=''success''; SET @pri=''normal''; SET @title=''👤 New Driver Added''; SET @msg=''Driver ['' + ISNULL(@label,''?'') + ''] was added to the system.''; END
    ELSE BEGIN SET @ntype=''info''; SET @pri=''normal''; SET @title=''👤 Driver Updated''; SET @msg=''Driver ['' + ISNULL(@label,''?'') + ''] profile was updated.''; END

    EXEC [dbo].[sp_observer_write]
        @table_name=''drivers'', @action=@action, @entity_id=@id, @entity_label=@label,
        @old_value=@old, @new_value=@new, @notif_type=@ntype,
        @notif_title=@title, @notif_message=@msg, @priority=@pri;
END;
    ');
    PRINT '✅ Trigger trg_drivers_observer created.';
END
ELSE
    PRINT '⚠️  Table dbo.drivers not found — skipped trigger.';
GO


-- ============================================================
-- SECTION 7 : TRIGGER — dbo.products
-- ============================================================
IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'trg_products_observer')
    DROP TRIGGER [dbo].[trg_products_observer];
GO

IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND type = 'U')
BEGIN
    EXEC('
CREATE TRIGGER [dbo].[trg_products_observer]
ON [dbo].[products]
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @action NVARCHAR(10), @id NVARCHAR(100), @label NVARCHAR(500),
            @old NVARCHAR(MAX), @new NVARCHAR(MAX),
            @ntype NVARCHAR(20), @pri NVARCHAR(10), @title NVARCHAR(255), @msg NVARCHAR(MAX);

    SET @action = CASE
        WHEN EXISTS(SELECT 1 FROM inserted) AND EXISTS(SELECT 1 FROM deleted) THEN ''UPDATE''
        WHEN EXISTS(SELECT 1 FROM inserted) THEN ''INSERT''
        ELSE ''DELETE''
    END;

    IF @action IN (''INSERT'',''UPDATE'')
    BEGIN
        SELECT TOP 1 @id = CAST(id AS NVARCHAR),
            @label = ISNULL(name, ISNULL(product_name, CAST(id AS NVARCHAR)))
        FROM inserted;
        SET @new = (SELECT TOP 1 * FROM inserted FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
    END
    IF @action IN (''UPDATE'',''DELETE'')
    BEGIN
        IF @id IS NULL SELECT TOP 1 @id = CAST(id AS NVARCHAR),
            @label = ISNULL(name, ISNULL(product_name, CAST(id AS NVARCHAR))) FROM deleted;
        SET @old = (SELECT TOP 1 * FROM deleted FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
    END

    IF @action = ''DELETE'' BEGIN SET @ntype=''error'';   SET @pri=''critical''; SET @title=''📦 Product Removed'';    SET @msg=''Product ['' + ISNULL(@label,''?'') + ''] was deleted from the catalog.''; END
    ELSE IF @action = ''INSERT'' BEGIN SET @ntype=''success''; SET @pri=''normal''; SET @title=''📦 New Product'';      SET @msg=''Product ['' + ISNULL(@label,''?'') + ''] was added to the catalog.''; END
    ELSE BEGIN SET @ntype=''info''; SET @pri=''normal''; SET @title=''📦 Product Updated''; SET @msg=''Product ['' + ISNULL(@label,''?'') + ''] details were changed.''; END

    EXEC [dbo].[sp_observer_write]
        @table_name=''products'', @action=@action, @entity_id=@id, @entity_label=@label,
        @old_value=@old, @new_value=@new, @notif_type=@ntype,
        @notif_title=@title, @notif_message=@msg, @priority=@pri;
END;
    ');
    PRINT '✅ Trigger trg_products_observer created.';
END
ELSE
    PRINT '⚠️  Table dbo.products not found — skipped trigger.';
GO


-- ============================================================
-- SECTION 8 : TRIGGER — dbo.users
-- ============================================================
IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'trg_users_observer')
    DROP TRIGGER [dbo].[trg_users_observer];
GO

IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[users]') AND type = 'U')
BEGIN
    EXEC('
CREATE TRIGGER [dbo].[trg_users_observer]
ON [dbo].[users]
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @action NVARCHAR(10), @id NVARCHAR(100), @label NVARCHAR(500),
            @old NVARCHAR(MAX), @new NVARCHAR(MAX),
            @ntype NVARCHAR(20), @pri NVARCHAR(10), @title NVARCHAR(255), @msg NVARCHAR(MAX);

    SET @action = CASE
        WHEN EXISTS(SELECT 1 FROM inserted) AND EXISTS(SELECT 1 FROM deleted) THEN ''UPDATE''
        WHEN EXISTS(SELECT 1 FROM inserted) THEN ''INSERT''
        ELSE ''DELETE''
    END;

    -- Deliberately exclude password from snapshot
    IF @action IN (''INSERT'',''UPDATE'')
    BEGIN
        SELECT TOP 1 @id = CAST(id AS NVARCHAR),
            @label = ISNULL(username, CAST(id AS NVARCHAR))
        FROM inserted;
        SET @new = (
            SELECT TOP 1 id, username, email, role, created_at
            FROM inserted
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        );
    END
    IF @action IN (''UPDATE'',''DELETE'')
    BEGIN
        IF @id IS NULL SELECT TOP 1 @id = CAST(id AS NVARCHAR),
            @label = ISNULL(username, CAST(id AS NVARCHAR)) FROM deleted;
        SET @old = (
            SELECT TOP 1 id, username, email, role, created_at
            FROM deleted
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        );
    END

    IF @action = ''DELETE'' BEGIN SET @ntype=''error'';   SET @pri=''critical''; SET @title=''🔒 User Account Deleted'';  SET @msg=''User account ['' + ISNULL(@label,''?'') + ''] was permanently deleted.''; END
    ELSE IF @action = ''INSERT'' BEGIN SET @ntype=''success''; SET @pri=''normal''; SET @title=''🔒 New User Created'';    SET @msg=''User account ['' + ISNULL(@label,''?'') + ''] was created.''; END
    ELSE BEGIN SET @ntype=''warning''; SET @pri=''high''; SET @title=''🔒 User Account Modified''; SET @msg=''User account ['' + ISNULL(@label,''?'') + ''] settings were changed.''; END

    EXEC [dbo].[sp_observer_write]
        @table_name=''users'', @action=@action, @entity_id=@id, @entity_label=@label,
        @old_value=@old, @new_value=@new, @notif_type=@ntype,
        @notif_title=@title, @notif_message=@msg, @priority=@pri;
END;
    ');
    PRINT '✅ Trigger trg_users_observer created.';
END
ELSE
    PRINT '⚠️  Table dbo.users not found — skipped trigger.';
GO


-- ============================================================
-- SECTION 9 : Clean-up job — auto-purge db_change_log > 24h
-- ============================================================
-- Keeps the polling table lean; processed rows older than 24h deleted
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sp_purge_change_log]') AND type = 'P')
    DROP PROCEDURE [dbo].[sp_purge_change_log];
GO

CREATE PROCEDURE [dbo].[sp_purge_change_log]
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM [dbo].[db_change_log]
    WHERE is_processed = 1
      AND created_at < DATEADD(HOUR, -24, GETDATE());
END;
GO
PRINT '✅ Stored procedure sp_purge_change_log created.';
GO


-- ============================================================
-- SUMMARY
-- ============================================================
PRINT '';
PRINT '=========================================================';
PRINT '  METpower Global Database Observer — Migration complete';
PRINT '=========================================================';
PRINT '  Tables    : db_change_log (new)';
PRINT '  Altered   : audit_log   (+ table_name, entity_id, old_value, new_value, priority)';
PRINT '  Procedures: sp_observer_write, sp_purge_change_log';
PRINT '  Triggers  : trg_transac_observer';
PRINT '             trg_trucks_observer  (if table exists)';
PRINT '             trg_drivers_observer (if table exists)';
PRINT '             trg_products_observer(if table exists)';
PRINT '             trg_users_observer   (if table exists)';
PRINT '=========================================================';
GO
