-- Step 1: Drop the dependent index if it exists
IF EXISTS (
    SELECT 1
    FROM sys.indexes 
    WHERE object_id = OBJECT_ID(N'[FTSS].[dbo].[transac]')
    AND name = N'IX_transac_deleted_at'
)
BEGIN
    DROP INDEX [IX_transac_deleted_at] ON [FTSS].[dbo].[transac];
    PRINT 'Index "IX_transac_deleted_at" dropped.';
END
GO

-- Step 2: Alter the 'id' column to be NOT NULL if it is currently nullable
IF EXISTS (
    SELECT 1
    FROM sys.columns 
    WHERE Name = N'id'
    AND Object_ID = Object_ID(N'[FTSS].[dbo].[transac]')
    AND is_nullable = 1
)
BEGIN
    ALTER TABLE [FTSS].[dbo].[transac]
    ALTER COLUMN id INT NOT NULL;
    PRINT 'Column "id" in "transac" table altered to NOT NULL.';
END
ELSE
BEGIN
    PRINT 'Column "id" in "transac" table is already NOT NULL.';
END
GO

-- Step 3: Add a primary key to the transac table if it doesn't already have one
IF NOT EXISTS (
    SELECT * FROM sys.key_constraints 
    WHERE type = 'PK' 
    AND parent_object_id = OBJECT_ID(N'[FTSS].[dbo].[transac]') 
    AND name = 'PK_transac'
)
BEGIN
    ALTER TABLE [FTSS].[dbo].[transac]
    ADD CONSTRAINT PK_transac PRIMARY KEY (id);
    PRINT 'Primary key PK_transac created on transac table.';
END
ELSE
BEGIN
    PRINT 'Primary key PK_transac already exists on transac table.';
END
GO

-- Step 4: Create the audit_log table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[audit_log]') AND type in (N'U'))
BEGIN
  CREATE TABLE [dbo].[audit_log] (
    [id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [transaction_id] INT NOT NULL,
    [user_id] INT NULL,
    [username] NVARCHAR(255) NOT NULL,
    [action] NVARCHAR(50) NOT NULL,
    [details] NVARCHAR(MAX) NULL,
    [created_at] DATETIME2 DEFAULT GETUTCDATE() NOT NULL,
    CONSTRAINT FK_audit_log_transaction FOREIGN KEY (transaction_id) REFERENCES [FTSS].[dbo].[transac](id) ON DELETE CASCADE
  );
  PRINT 'Audit log table created successfully.';
END
ELSE
BEGIN
  PRINT 'Audit log table already exists.';
END
GO
