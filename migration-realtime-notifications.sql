-- =====================================================
-- Real-Time Notifications System Migration
-- =====================================================
-- This adds support for storing notification history
-- and enables real-time push notifications via WebSockets
-- =====================================================

USE [FTSS];
GO

-- Create notifications table to store notification history
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[notifications]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[notifications] (
        [id] INT IDENTITY(1,1) PRIMARY KEY,
        [user_id] INT NULL,  -- NULL means broadcast to all users
        [username] NVARCHAR(100) NULL,
        [type] NVARCHAR(20) NOT NULL CHECK ([type] IN ('success', 'error', 'warning', 'info')),
        [title] NVARCHAR(255) NOT NULL,
        [message] NVARCHAR(MAX) NULL,
        [action] NVARCHAR(50) NULL,  -- CREATE, UPDATE, DELETE, RESTORE, etc.
        [trans_id] INT NULL,  -- Reference to transaction
        [trans_no] NVARCHAR(100) NULL,  -- Transaction number for quick reference
        [is_read] BIT DEFAULT 0,
        [is_dismissed] BIT DEFAULT 0,
        [created_at] DATETIME DEFAULT GETDATE(),
        [read_at] DATETIME NULL,
        [metadata] NVARCHAR(MAX) NULL,  -- JSON for additional data
        
        CONSTRAINT FK_notifications_transac FOREIGN KEY ([trans_id]) 
            REFERENCES [dbo].[transac]([id]) ON DELETE SET NULL
    );
    
    PRINT '✅ Table [dbo].[notifications] created successfully.';
END
ELSE
BEGIN
    PRINT '⚠️ Table [dbo].[notifications] already exists.';
END
GO

-- Create indexes for better query performance
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_notifications_user_id' AND object_id = OBJECT_ID(N'[dbo].[notifications]'))
BEGIN
    CREATE INDEX IX_notifications_user_id ON [dbo].[notifications]([user_id], [created_at] DESC);
    PRINT '✅ Index IX_notifications_user_id created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_notifications_trans_id' AND object_id = OBJECT_ID(N'[dbo].[notifications]'))
BEGIN
    CREATE INDEX IX_notifications_trans_id ON [dbo].[notifications]([trans_id]);
    PRINT '✅ Index IX_notifications_trans_id created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_notifications_is_read' AND object_id = OBJECT_ID(N'[dbo].[notifications]'))
BEGIN
    CREATE INDEX IX_notifications_is_read ON [dbo].[notifications]([user_id], [is_read], [created_at] DESC);
    PRINT '✅ Index IX_notifications_is_read created.';
END
GO

-- Create stored procedure to create notification and return it
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sp_create_notification]') AND type in (N'P', N'PC'))
    DROP PROCEDURE [dbo].[sp_create_notification];
GO

CREATE PROCEDURE [dbo].[sp_create_notification]
    @user_id INT = NULL,
    @username NVARCHAR(100) = NULL,
    @type NVARCHAR(20),
    @title NVARCHAR(255),
    @message NVARCHAR(MAX) = NULL,
    @action NVARCHAR(50) = NULL,
    @trans_id INT = NULL,
    @trans_no NVARCHAR(100) = NULL,
    @metadata NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @notification_id INT;
    
    INSERT INTO [dbo].[notifications] (
        [user_id], [username], [type], [title], [message], 
        [action], [trans_id], [trans_no], [metadata]
    )
    VALUES (
        @user_id, @username, @type, @title, @message,
        @action, @trans_id, @trans_no, @metadata
    );
    
    SET @notification_id = SCOPE_IDENTITY();
    
    -- Return the created notification
    SELECT 
        [id],
        [user_id],
        [username],
        [type],
        [title],
        [message],
        [action],
        [trans_id],
        [trans_no],
        [is_read],
        [is_dismissed],
        [created_at],
        [read_at],
        [metadata]
    FROM [dbo].[notifications]
    WHERE [id] = @notification_id;
END
GO

PRINT '✅ Stored procedure sp_create_notification created.';
GO

-- Create stored procedure to mark notifications as read
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sp_mark_notifications_read]') AND type in (N'P', N'PC'))
    DROP PROCEDURE [dbo].[sp_mark_notifications_read];
GO

CREATE PROCEDURE [dbo].[sp_mark_notifications_read]
    @user_id INT,
    @notification_ids NVARCHAR(MAX) = NULL  -- Comma-separated IDs, or NULL for all
AS
BEGIN
    SET NOCOUNT ON;
    
    IF @notification_ids IS NULL
    BEGIN
        -- Mark all unread notifications as read
        UPDATE [dbo].[notifications]
        SET [is_read] = 1, [read_at] = GETDATE()
        WHERE [user_id] = @user_id AND [is_read] = 0;
    END
    ELSE
    BEGIN
        -- Mark specific notifications as read
        UPDATE [dbo].[notifications]
        SET [is_read] = 1, [read_at] = GETDATE()
        WHERE [user_id] = @user_id 
        AND [id] IN (SELECT value FROM STRING_SPLIT(@notification_ids, ','));
    END
    
    SELECT @@ROWCOUNT AS affected_rows;
END
GO

PRINT '✅ Stored procedure sp_mark_notifications_read created.';
GO

-- Create view for unread notification counts
IF EXISTS (SELECT * FROM sys.views WHERE object_id = OBJECT_ID(N'[dbo].[vw_unread_notification_counts]'))
    DROP VIEW [dbo].[vw_unread_notification_counts];
GO

CREATE VIEW [dbo].[vw_unread_notification_counts] AS
SELECT 
    [user_id],
    [username],
    COUNT(*) AS unread_count,
    MAX([created_at]) AS latest_notification
FROM [dbo].[notifications]
WHERE [is_read] = 0 AND [is_dismissed] = 0
GROUP BY [user_id], [username];
GO

PRINT '✅ View vw_unread_notification_counts created.';
GO

-- Insert sample notification (for testing)
-- EXEC sp_create_notification 
--     @username = 'admin',
--     @type = 'info',
--     @title = 'Real-Time Notifications Enabled',
--     @message = 'Your notification system is now active and will receive live updates!',
--     @action = 'SYSTEM';

PRINT '🎉 Real-Time Notifications System migration completed successfully!';
PRINT '📝 Summary:';
PRINT '   - Table: dbo.notifications';
PRINT '   - Stored Procedures: sp_create_notification, sp_mark_notifications_read';
PRINT '   - View: vw_unread_notification_counts';
PRINT '   - Indexes: 3 indexes for performance optimization';
GO
