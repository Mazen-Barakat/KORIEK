-- DATABASE SCHEMA CHANGES FOR BOOKING NOTIFICATION SYSTEM OVERHAUL
-- Execute these SQL statements in order

-- =====================================================
-- 1. ADD BOOKING REFERENCE AND RESPONSE TRACKING TO BOOKINGS TABLE
-- =====================================================

-- Add booking reference column (auto-generated format: BK-YYYY-NNNNNN)
ALTER TABLE Bookings
ADD BookingReference NVARCHAR(20) NULL;

-- Add response status tracking
ALTER TABLE Bookings
ADD ResponseStatus INT NOT NULL DEFAULT 0;
-- 0 = Pending, 1 = Accepted, 2 = Declined, 3 = Confirmed, 4 = Expired

-- Add response change tracking
ALTER TABLE Bookings
ADD LastResponseChangedAt DATETIME2 NULL;

ALTER TABLE Bookings
ADD ResponseChangedBy NVARCHAR(50) NULL;
-- Values: 'workshop', 'customer', 'system'

-- Add exact appointment time tracking (stored with seconds precision)
ALTER TABLE Bookings
ADD ExactAppointmentTime DATETIME2 NOT NULL DEFAULT GETDATE();

-- =====================================================
-- 2. CREATE INDEX FOR BOOKING REFERENCES
-- =====================================================

CREATE UNIQUE INDEX IX_Bookings_BookingReference 
ON Bookings(BookingReference)
WHERE BookingReference IS NOT NULL;

-- =====================================================
-- 3. UPDATE EXISTING BOOKINGS WITH GENERATED REFERENCES
-- =====================================================

-- Generate booking references for existing bookings
WITH BookingYears AS (
    SELECT 
        BookingId,
        YEAR(CreatedAt) AS BookingYear,
        ROW_NUMBER() OVER (PARTITION BY YEAR(CreatedAt) ORDER BY BookingId) AS YearSequence
    FROM Bookings
    WHERE BookingReference IS NULL
)
UPDATE Bookings
SET BookingReference = 'BK-' + CAST(by.BookingYear AS VARCHAR(4)) + '-' + RIGHT('000000' + CAST(by.YearSequence AS VARCHAR(6)), 6)
FROM Bookings b
INNER JOIN BookingYears by ON b.BookingId = by.BookingId;

-- Make BookingReference NOT NULL after population
ALTER TABLE Bookings
ALTER COLUMN BookingReference NVARCHAR(20) NOT NULL;

-- =====================================================
-- 4. ENHANCE NOTIFICATIONS TABLE
-- =====================================================

-- Add booking reference to notifications for quick lookup
ALTER TABLE Notifications
ADD BookingReference NVARCHAR(20) NULL;

-- Add customer information fields
ALTER TABLE Notifications
ADD CustomerName NVARCHAR(200) NULL;

ALTER TABLE Notifications
ADD CustomerPhone NVARCHAR(20) NULL;

-- Add vehicle information fields
ALTER TABLE Notifications
ADD VehicleInfo NVARCHAR(500) NULL;

ALTER TABLE Notifications
ADD VehicleMake NVARCHAR(100) NULL;

ALTER TABLE Notifications
ADD VehicleModel NVARCHAR(100) NULL;

ALTER TABLE Notifications
ADD VehicleYear INT NULL;

ALTER TABLE Notifications
ADD VehiclePlateNumber NVARCHAR(50) NULL;

-- Add service information
ALTER TABLE Notifications
ADD ServiceType NVARCHAR(200) NULL;

ALTER TABLE Notifications
ADD EstimatedDuration INT NULL; -- in minutes

ALTER TABLE Notifications
ADD EstimatedCost DECIMAL(10, 2) NULL;

-- Add exact appointment time
ALTER TABLE Notifications
ADD ExactAppointmentTime DATETIME2 NULL;

-- Add response status
ALTER TABLE Notifications
ADD ResponseStatus INT NULL;

-- Add priority level
ALTER TABLE Notifications
ADD Priority NVARCHAR(20) NOT NULL DEFAULT 'medium';
-- Values: 'low', 'medium', 'high', 'urgent'

-- =====================================================
-- 5. CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Index for booking reference lookups
CREATE INDEX IX_Notifications_BookingReference 
ON Notifications(BookingReference)
WHERE BookingReference IS NOT NULL;

-- Index for appointment time queries
CREATE INDEX IX_Bookings_ExactAppointmentTime 
ON Bookings(ExactAppointmentTime);

-- Index for response status queries
CREATE INDEX IX_Bookings_ResponseStatus 
ON Bookings(ResponseStatus);

-- =====================================================
-- 6. CREATE BOOKING REFERENCE GENERATION FUNCTION
-- =====================================================

-- This function generates new booking references
-- Format: BK-YYYY-NNNNNN (e.g., BK-2024-000001)

CREATE OR ALTER FUNCTION dbo.GenerateBookingReference(@BookingId INT, @CreatedAt DATETIME2)
RETURNS NVARCHAR(20)
AS
BEGIN
    DECLARE @Year INT = YEAR(@CreatedAt);
    DECLARE @Sequence INT;
    
    -- Get the sequence number for this year
    SELECT @Sequence = COUNT(*) + 1
    FROM Bookings
    WHERE YEAR(CreatedAt) = @Year AND BookingId < @BookingId;
    
    RETURN 'BK-' + CAST(@Year AS VARCHAR(4)) + '-' + RIGHT('000000' + CAST(@Sequence AS VARCHAR(6)), 6);
END;
GO

-- =====================================================
-- 7. CREATE TRIGGER FOR AUTO-GENERATING BOOKING REFERENCES
-- =====================================================

CREATE OR ALTER TRIGGER trg_Bookings_GenerateReference
ON Bookings
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE Bookings
    SET BookingReference = dbo.GenerateBookingReference(i.BookingId, i.CreatedAt)
    FROM Bookings b
    INNER JOIN inserted i ON b.BookingId = i.BookingId
    WHERE b.BookingReference IS NULL;
END;
GO

-- =====================================================
-- 8. CREATE VIEW FOR ENHANCED BOOKING NOTIFICATIONS
-- =====================================================

CREATE OR ALTER VIEW vw_EnhancedBookingNotifications AS
SELECT 
    n.NotificationId,
    n.BookingId,
    b.BookingReference,
    
    -- Customer info
    ISNULL(n.CustomerName, cu.FullName) AS CustomerName,
    ISNULL(n.CustomerPhone, cu.PhoneNumber) AS CustomerPhone,
    cu.ProfilePicture AS CustomerPhoto,
    
    -- Vehicle info
    ISNULL(n.VehicleInfo, 
        CAST(v.Year AS VARCHAR(4)) + ' ' + v.Make + ' ' + v.Model + ' - ' + v.PlateNumber
    ) AS VehicleInfo,
    ISNULL(n.VehicleMake, v.Make) AS VehicleMake,
    ISNULL(n.VehicleModel, v.Model) AS VehicleModel,
    ISNULL(n.VehicleYear, v.Year) AS VehicleYear,
    ISNULL(n.VehiclePlateNumber, v.PlateNumber) AS VehiclePlateNumber,
    
    -- Service info
    ISNULL(n.ServiceType, s.Name) AS ServiceType,
    ISNULL(n.EstimatedDuration, b.EstimatedDuration) AS EstimatedDuration,
    ISNULL(n.EstimatedCost, b.TotalCost) AS EstimatedCost,
    
    -- Timing
    ISNULL(n.ExactAppointmentTime, b.ExactAppointmentTime) AS ExactAppointmentTime,
    b.CreatedAt,
    
    -- Workshop info
    w.Name AS WorkshopName,
    w.Address AS WorkshopAddress,
    w.PhoneNumber AS WorkshopPhone,
    
    -- Response status
    ISNULL(n.ResponseStatus, b.ResponseStatus) AS ResponseStatus,
    b.LastResponseChangedAt,
    b.ResponseChangedBy,
    
    -- Notification metadata
    n.NotificationType,
    n.Title,
    n.Message,
    n.Priority,
    n.IsRead,
    n.UserId,
    n.CreatedAt AS NotificationCreatedAt
    
FROM Notifications n
INNER JOIN Bookings b ON n.BookingId = b.BookingId
LEFT JOIN Users cu ON b.CustomerId = cu.UserId
LEFT JOIN Vehicles v ON b.VehicleId = v.VehicleId
LEFT JOIN Services s ON b.ServiceId = s.ServiceId
LEFT JOIN Workshops w ON b.WorkshopId = w.WorkshopId
WHERE n.BookingId IS NOT NULL;
GO

-- =====================================================
-- 9. CREATE STORED PROCEDURE FOR UPDATING RESPONSE STATUS
-- =====================================================

CREATE OR ALTER PROCEDURE sp_UpdateBookingResponseStatus
    @BookingId INT,
    @NewStatus INT, -- 0=Pending, 1=Accepted, 2=Declined, 3=Confirmed, 4=Expired
    @ChangedBy NVARCHAR(50), -- 'workshop', 'customer', 'system'
    @Result NVARCHAR(100) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @CurrentStatus INT;
    DECLARE @AppointmentTime DATETIME2;
    DECLARE @Now DATETIME2 = GETUTCDATE();
    
    -- Get current booking info
    SELECT 
        @CurrentStatus = ResponseStatus,
        @AppointmentTime = ExactAppointmentTime
    FROM Bookings
    WHERE BookingId = @BookingId;
    
    -- Validation: Check if booking exists
    IF @CurrentStatus IS NULL
    BEGIN
        SET @Result = 'ERROR: Booking not found';
        RETURN;
    END
    
    -- Validation: Cannot change after appointment time has passed
    IF @Now > @AppointmentTime
    BEGIN
        SET @Result = 'ERROR: Cannot change response after appointment time';
        RETURN;
    END
    
    -- Validation: Acceptance is FINAL (cannot change from Accepted to anything else)
    IF @CurrentStatus = 1 AND @NewStatus != 1
    BEGIN
        SET @Result = 'ERROR: Cannot change from Accepted status (acceptance is final)';
        RETURN;
    END
    
    -- Update the booking
    UPDATE Bookings
    SET 
        ResponseStatus = @NewStatus,
        LastResponseChangedAt = @Now,
        ResponseChangedBy = @ChangedBy
    WHERE BookingId = @BookingId;
    
    -- Update related notifications
    UPDATE Notifications
    SET ResponseStatus = @NewStatus
    WHERE BookingId = @BookingId;
    
    SET @Result = 'SUCCESS: Status updated to ' + CAST(@NewStatus AS VARCHAR(10));
END;
GO

-- =====================================================
-- 10. CREATE STORED PROCEDURE FOR CHECKING BOOKINGS DUE FOR CONFIRMATION
-- =====================================================

CREATE OR ALTER PROCEDURE sp_GetBookingsDueForConfirmation
    @WorkshopId INT = NULL,
    @CustomerId INT = NULL,
    @WindowSeconds INT = 60 -- Check bookings within 60 seconds of appointment time
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Now DATETIME2 = GETUTCDATE();
    DECLARE @WindowStart DATETIME2 = DATEADD(SECOND, -@WindowSeconds, @Now);
    DECLARE @WindowEnd DATETIME2 = DATEADD(SECOND, @WindowSeconds, @Now);
    
    SELECT 
        BookingId,
        BookingReference,
        ExactAppointmentTime,
        ResponseStatus,
        DATEDIFF(SECOND, @Now, ExactAppointmentTime) AS SecondsUntilAppointment
    FROM Bookings
    WHERE 
        ExactAppointmentTime BETWEEN @WindowStart AND @WindowEnd
        AND ResponseStatus IN (0, 2) -- Pending or Declined
        AND (@WorkshopId IS NULL OR WorkshopId = @WorkshopId)
        AND (@CustomerId IS NULL OR CustomerId = @CustomerId)
    ORDER BY ExactAppointmentTime;
END;
GO

-- =====================================================
-- 11. VERIFY SCHEMA CHANGES
-- =====================================================

-- Check if all columns were added successfully
SELECT 
    TABLE_NAME,
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME IN ('Bookings', 'Notifications')
    AND COLUMN_NAME IN (
        'BookingReference', 'ResponseStatus', 'LastResponseChangedAt', 
        'ResponseChangedBy', 'ExactAppointmentTime', 'CustomerName',
        'VehicleInfo', 'ServiceType', 'Priority'
    )
ORDER BY TABLE_NAME, COLUMN_NAME;

-- Check indexes
SELECT 
    i.name AS IndexName,
    t.name AS TableName,
    i.type_desc AS IndexType
FROM sys.indexes i
INNER JOIN sys.tables t ON i.object_id = t.object_id
WHERE t.name IN ('Bookings', 'Notifications')
    AND i.name LIKE 'IX_%'
ORDER BY t.name, i.name;

PRINT '✅ Database schema migration completed successfully!';
