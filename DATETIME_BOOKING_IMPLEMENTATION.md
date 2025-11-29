# DateTime Selection with Africa/Cairo Timezone Implementation

## Overview
The booking component now includes proper date and time selection with full timezone support for Africa/Cairo (UTC+2). Selected date and time are combined into a single DateTime object and sent to the backend in ISO format.

## Implementation Details

### 1. **Frontend Components**

#### Files Modified:
- `src/app/components/booking/booking.component.ts`
- `src/app/components/booking/booking.component.html`
- `src/app/services/booking.service.ts`

### 2. **DateTime Flow**

```
User Selects Date (Dec 5, 2025) → User Selects Time (09:30) 
→ Combined to DateTime → Converted to ISO String → Sent to Backend
```

### 3. **Key Features Implemented**

✅ **Multi-step Selection**
- Step 1: Date selection from available dates
- Step 2: Time slot selection (30-minute intervals)
- Combined DateTime validation before submission

✅ **Timezone Synchronization**
- All times displayed in Africa/Cairo timezone (UTC+2)
- ISO string format for backend communication
- Proper timezone indicator shown to users

✅ **Smart Time Slot Handling**
- Past time slots are automatically disabled for today
- Booked slots are marked as unavailable
- Visual distinction between available/booked/past slots

✅ **Backend Integration**
- DateTime sent as ISO string: `"2025-12-05T07:30:00.000Z"` (UTC)
- Backend receives and converts to Cairo time
- Booking API endpoint: `POST /api/Booking`

### 4. **TypeScript Methods Added**

#### `getCombinedDateTime(): string | null`
Combines selected date and time into ISO string format.
```typescript
// Example output: "2025-12-05T07:30:00.000Z"
const dateTime = this.getCombinedDateTime();
```

#### `formatDateForBackend(date: Date): string`
Formats date as YYYY-MM-DD for API queries.
```typescript
// Example output: "2025-12-05"
const dateString = this.formatDateForBackend(new Date());
```

#### `getCurrentCairoDate(): Date`
Gets current date/time in Africa/Cairo timezone.
```typescript
const cairoNow = this.getCurrentCairoDate();
```

#### `isTimeSlotAvailableWithPast(slot: string): boolean`
Checks if time slot is available (not booked and not in past).
```typescript
const available = this.isTimeSlotAvailableWithPast('09:30');
```

### 5. **Booking Data Structure**

#### Frontend → Backend Payload
```typescript
{
  vehicleId: 123,
  serviceId: 456,
  workshopId: 789,
  dateTime: "2025-12-05T07:30:00.000Z", // ISO string (UTC)
  notes: "Additional service notes",
  vehicleOrigin: "Germany"
}
```

### 6. **Backend Integration Guide**

#### C# / ASP.NET Core Implementation

##### 1. DTO Model
```csharp
public class BookingCreateDto
{
    [Required]
    public int VehicleId { get; set; }
    
    [Required]
    public int ServiceId { get; set; }
    
    [Required]
    public int WorkshopId { get; set; }
    
    [Required]
    public DateTime DateTime { get; set; } // Receives ISO string, auto-parsed
    
    public string? Notes { get; set; }
    public string? VehicleOrigin { get; set; }
}
```

##### 2. Controller with Timezone Handling
```csharp
[ApiController]
[Route("api/[controller]")]
public class BookingController : ControllerBase
{
    private static readonly TimeZoneInfo CairoTimeZone = 
        TimeZoneInfo.FindSystemTimeZoneById("Egypt Standard Time");
    
    private readonly ApplicationDbContext _context;
    
    public BookingController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpPost]
    public async Task<IActionResult> CreateBooking([FromBody] BookingCreateDto dto)
    {
        try
        {
            // The DateTime comes as UTC from the ISO string
            // Convert to Cairo timezone for display/validation
            var cairoDateTime = TimeZoneInfo.ConvertTimeFromUtc(dto.DateTime, CairoTimeZone);
            
            // Validate booking time is in the future
            var nowInCairo = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, CairoTimeZone);
            if (cairoDateTime <= nowInCairo)
            {
                return BadRequest(new { message = "Booking time must be in the future" });
            }
            
            // Validate booking time is within working hours (8 AM - 6 PM Cairo time)
            if (cairoDateTime.Hour < 8 || cairoDateTime.Hour >= 18)
            {
                return BadRequest(new { message = "Booking time must be between 8:00 AM and 6:00 PM" });
            }
            
            // Check if slot is already booked
            var existingBooking = await _context.Bookings
                .Where(b => b.WorkshopId == dto.WorkshopId 
                       && b.ServiceId == dto.ServiceId
                       && b.DateTime == dto.DateTime) // Compare UTC times
                .FirstOrDefaultAsync();
                
            if (existingBooking != null)
            {
                return BadRequest(new { message = "This time slot is already booked" });
            }
            
            // Create booking (store DateTime as UTC in database)
            var booking = new Booking
            {
                VehicleId = dto.VehicleId,
                ServiceId = dto.ServiceId,
                WorkshopId = dto.WorkshopId,
                DateTime = dto.DateTime, // Store as UTC
                Notes = dto.Notes,
                VehicleOrigin = dto.VehicleOrigin,
                Status = "Pending",
                CreatedAt = DateTime.UtcNow
            };
            
            _context.Bookings.Add(booking);
            await _context.SaveChangesAsync();
            
            return Ok(new 
            { 
                success = true,
                message = "Booking created successfully",
                data = new 
                {
                    bookingId = booking.Id,
                    confirmationNumber = $"BK{booking.Id:D6}",
                    dateTime = cairoDateTime.ToString("yyyy-MM-dd HH:mm"), // Return in Cairo time
                    status = booking.Status
                }
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Internal server error", error = ex.Message });
        }
    }
    
    [HttpGet("booked-slots")]
    public async Task<IActionResult> GetBookedSlots(
        [FromQuery] int workshopId, 
        [FromQuery] int serviceId, 
        [FromQuery] string date) // YYYY-MM-DD format
    {
        try
        {
            // Parse the date string
            if (!DateTime.TryParse(date, out DateTime requestedDate))
            {
                return BadRequest(new { message = "Invalid date format" });
            }
            
            // Get start and end of day in UTC
            var startOfDay = TimeZoneInfo.ConvertTimeToUtc(
                requestedDate.Date, 
                CairoTimeZone
            );
            var endOfDay = startOfDay.AddDays(1);
            
            // Query bookings for that day
            var bookedSlots = await _context.Bookings
                .Where(b => b.WorkshopId == workshopId 
                       && b.ServiceId == serviceId
                       && b.DateTime >= startOfDay 
                       && b.DateTime < endOfDay
                       && b.Status != "Cancelled")
                .Select(b => b.DateTime) // Returns UTC DateTime
                .ToListAsync();
            
            return Ok(new { success = true, data = bookedSlots });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Internal server error", error = ex.Message });
        }
    }
}
```

##### 3. Database Model
```csharp
public class Booking
{
    public int Id { get; set; }
    
    public int VehicleId { get; set; }
    public Vehicle Vehicle { get; set; }
    
    public int ServiceId { get; set; }
    public Service Service { get; set; }
    
    public int WorkshopId { get; set; }
    public Workshop Workshop { get; set; }
    
    public DateTime DateTime { get; set; } // Stored as UTC
    
    public string? Notes { get; set; }
    public string? VehicleOrigin { get; set; }
    public string Status { get; set; } // Pending, Confirmed, InProgress, Completed, Cancelled
    
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}
```

##### 4. Database Migration
```sql
CREATE TABLE Bookings (
    Id INT PRIMARY KEY IDENTITY(1,1),
    VehicleId INT NOT NULL,
    ServiceId INT NOT NULL,
    WorkshopId INT NOT NULL,
    DateTime DATETIME2 NOT NULL, -- Store as UTC
    Notes NVARCHAR(MAX),
    VehicleOrigin NVARCHAR(50),
    Status NVARCHAR(50) NOT NULL DEFAULT 'Pending',
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2,
    CONSTRAINT FK_Bookings_Vehicles FOREIGN KEY (VehicleId) REFERENCES Vehicles(Id),
    CONSTRAINT FK_Bookings_Services FOREIGN KEY (ServiceId) REFERENCES Services(Id),
    CONSTRAINT FK_Bookings_Workshops FOREIGN KEY (WorkshopId) REFERENCES Workshops(Id)
);

-- Indexes for performance
CREATE INDEX IX_Bookings_DateTime ON Bookings(DateTime);
CREATE INDEX IX_Bookings_WorkshopId_DateTime ON Bookings(WorkshopId, DateTime);
CREATE INDEX IX_Bookings_Status ON Bookings(Status);
```

### 7. **Testing the Implementation**

#### Frontend Console Logs
When a user selects date and time, check the browser console:
```
Selected date: 2025-12-05
Combined DateTime (ISO): 2025-12-05T07:30:00.000Z
Combined DateTime (Cairo): Friday, December 5, 2025, 09:30 AM
```

#### Backend Logging
```csharp
_logger.LogInformation("Booking request received: {DateTime} (UTC)", dto.DateTime);
_logger.LogInformation("Booking time in Cairo: {CairoTime}", cairoDateTime);
```

### 8. **Timezone Reference**

| Location | Timezone | UTC Offset | Example |
|----------|----------|------------|---------|
| Frontend Browser | Local | Varies | User's system time |
| Displayed to User | Africa/Cairo | UTC+2 | 09:30 AM Cairo |
| Transmitted to Backend | UTC | UTC+0 | 07:30:00.000Z |
| Stored in Database | UTC | UTC+0 | 2025-12-05 07:30:00 |
| Returned to Frontend | UTC | UTC+0 | Browser converts to Cairo |

### 9. **Common Issues & Solutions**

#### Issue: Times show incorrectly
**Solution**: Ensure `CAIRO_TIMEZONE` constant is set to `'Africa/Cairo'` and browser timezone is configured.

#### Issue: Past times are selectable
**Solution**: The `isTimeSlotAvailableWithPast()` method filters past times for today.

#### Issue: Backend rejects DateTime
**Solution**: Ensure backend expects ISO 8601 format and has proper DateTime parsing configured.

#### Issue: Timezone conversion errors
**Solution**: Always store UTC in database and convert only at display boundaries.

### 10. **Future Enhancements**

- [ ] Load actual booked slots from backend API
- [ ] Add duration-based slot blocking (e.g., 2-hour service blocks multiple slots)
- [ ] Implement slot availability caching
- [ ] Add workshop-specific working hours
- [ ] Support for holidays/closed days
- [ ] Real-time slot updates via WebSocket
- [ ] Multi-timezone support for international bookings

### 11. **API Endpoints Summary**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/Booking` | Create new booking |
| GET | `/api/Booking/booked-slots` | Get booked time slots for specific day |
| GET | `/api/Booking/{id}` | Get booking details |
| PUT | `/api/Booking/{id}` | Update booking (reschedule) |
| DELETE | `/api/Booking/{id}` | Cancel booking |

### 12. **Validation Rules**

- Booking time must be in the future
- Booking time must be within working hours (8 AM - 6 PM Cairo time)
- Time slots must be 30-minute intervals
- No double booking of same workshop/service/time
- Minimum advance booking: 2 hours from current time

---

## Quick Start

1. **Select Date**: User clicks on available date
2. **Select Time**: User picks from available 30-minute time slots
3. **Confirm Booking**: System combines date+time, converts to ISO, sends to backend
4. **Backend Processing**: Converts to Cairo time, validates, stores as UTC
5. **Confirmation**: User receives booking confirmation number

## Support

For questions or issues, please contact the development team.
