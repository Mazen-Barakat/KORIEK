# Booking DateTime Implementation - Cairo Timezone

## Overview
Enhanced the booking scheduling page to display all upcoming months and all time slots for each day, with proper Africa/Cairo timezone synchronization.

## Implementation Details

### 1. **Month Selection Flow**
The user now follows this sequence:
1. Select a **Month** (from 6 upcoming months)
2. Select a **Day** (all days in selected month from today onwards)
3. Select a **Time Slot** (all available slots for the selected day)

### 2. **Component Changes**

#### **booking.component.ts**

**New Properties:**
```typescript
selectedMonth: number | null = null;        // 0-11 (January = 0)
selectedYear: number | null = null;
availableMonths: { month: number; year: number; name: string; displayName: string }[] = [];
daysInMonth: Date[] = [];
readonly MONTH_NAMES = ['January', 'February', 'March', ...];
```

**New Methods:**
- `selectMonth(month, year)` - Sets selected month/year and generates days
- `generateDaysInMonth(month, year)` - Populates all days in selected month (from today onwards)
- `isMonthSelected(month, year)` - Checks if month is currently selected
- `getDayName(date)` - Returns short day name (MON, TUE, etc.)
- `getDayNumber(date)` - Returns day number (1-31)
- `isDateSelectedInMonth(date)` - Checks if specific date is selected

**Enhanced Methods:**
- `initializeAvailableDates()` - Now generates 6 upcoming months in `availableMonths` array
- `confirmBooking()` - Changed field name from `dateTime` to `appointmentDate`

### 3. **Service Changes**

#### **booking.service.ts**

**Updated Interface:**
```typescript
createBooking(bookingData: {
  vehicleId?: number;
  serviceId?: number;
  workshopId?: number;
  appointmentDate: string;  // Changed from 'dateTime' to match backend Bookings table
  notes?: string;
  vehicleOrigin?: string;
})
```

**Added Logging:**
- Console logs show both ISO/UTC format and Cairo timezone format for verification

### 4. **UI Changes**

#### **booking.component.html**

**New Sections:**
1. **Month Selection Grid:**
   - Displays 6 upcoming months
   - Shows month name and year
   - Highlights selected month

2. **Day Selection Grid:**
   - Only visible after month selection
   - Shows all days in selected month (from today onwards)
   - Displays day name (MON, TUE, etc.) and day number
   - Excludes past dates

3. **Time Slot Grid:**
   - Only visible after day selection
   - Shows all available time slots (08:00 - 17:30)
   - Labels unavailable slots as "Booked" or "Past"
   - Displays timezone info: "All times are in Africa/Cairo timezone (UTC+2)"

#### **booking.component.css**

**New Styles:**
```css
.month-grid          /* Grid layout for months */
.month-card          /* Individual month card */
.month-name          /* Month display name */
.month-year          /* Year display */
```

### 5. **DateTime Handling**

#### **Timezone Flow:**
1. **User Selection:** User picks date and time in local Cairo timezone
2. **Combination:** `getCombinedDateTime()` merges selectedDate + selectedTimeSlot
3. **Conversion:** DateTime is formatted as ISO 8601 string (UTC)
4. **Backend Storage:** Sent to backend with field name `appointmentDate`
5. **Database:** Backend stores in `Bookings.AppointmentDate` column (as DateTime synchronized to Cairo timezone)

#### **Example:**
```typescript
// User selects: December 15, 2024 @ 14:30 (Cairo time)
// getCombinedDateTime() returns: "2024-12-15T12:30:00.000Z" (ISO/UTC)
// Backend receives in appointmentDate field
// Backend converts to Cairo: 2024-12-15 14:30:00 (Africa/Cairo)
// Stored in Bookings.AppointmentDate column
```

### 6. **Backend Integration**

**Expected Backend DTO:**
```csharp
public class BookingCreateDto
{
    public int? VehicleId { get; set; }
    public int? ServiceId { get; set; }
    public int? WorkshopId { get; set; }
    public DateTime AppointmentDate { get; set; }  // Receives ISO string, stores as Cairo DateTime
    public string? Notes { get; set; }
    public string? VehicleOrigin { get; set; }
}
```

**Backend Processing:**
1. Parse ISO string from `AppointmentDate` field
2. Convert to Cairo timezone: `TimeZoneInfo.ConvertTimeFromUtc(utcDateTime, cairoTimeZone)`
3. Store in `Bookings.AppointmentDate` column

**API Endpoint:**
```
POST /api/Booking
Content-Type: application/json

{
  "vehicleId": 123,
  "serviceId": 456,
  "workshopId": 789,
  "appointmentDate": "2024-12-15T12:30:00.000Z",
  "notes": "Customer notes here",
  "vehicleOrigin": "Korean"
}
```

### 7. **Time Slot Management**

**Available Slots:**
- 08:00 to 17:30 (30-minute intervals)
- Total of 20 time slots per day

**Unavailability Logic:**
- **Past slots:** Blocked if current day and time has passed
- **Booked slots:** Retrieved from backend via `getBookedSlots()` method (ready for integration)

### 8. **User Experience**

**Progressive Disclosure:**
- Month selection → Day selection appears
- Day selection → Time slot selection appears
- Clear visual hierarchy with section cards

**Visual Feedback:**
- Selected items highlighted with red gradient
- Hover effects on all interactive elements
- Unavailable slots clearly labeled
- Timezone information prominently displayed

## Testing Checklist

- [ ] Month selection displays 6 upcoming months
- [ ] Day selection shows all days in selected month (excluding past dates)
- [ ] Time slots display all 20 available slots (08:00 - 17:30)
- [ ] Past time slots are disabled for current day
- [ ] Selected month/day/time are visually highlighted
- [ ] Console logs show correct ISO and Cairo formatted times
- [ ] Backend receives `appointmentDate` field with ISO string
- [ ] Backend stores DateTime in `Bookings.AppointmentDate` column
- [ ] Timezone conversion is accurate (UTC ↔ Africa/Cairo)

## Files Modified

1. `src/app/components/booking/booking.component.ts` - Added month/day selection logic
2. `src/app/components/booking/booking.component.html` - Updated UI with month/day/time grids
3. `src/app/components/booking/booking.component.css` - Added month grid styling
4. `src/app/services/booking.service.ts` - Changed field name to `appointmentDate`

## Next Steps

1. **Backend Implementation:**
   - Create `BookingCreateDto` with `AppointmentDate` property
   - Implement POST `/api/Booking` endpoint
   - Add timezone conversion logic
   - Store in `Bookings.AppointmentDate` table column

2. **Booked Slots Integration:**
   - Implement GET `/api/Booking/booked-slots` endpoint
   - Return array of booked time slots for workshop/service/date
   - Frontend already has `getBookedSlots()` method ready

3. **Testing:**
   - End-to-end booking flow with real backend
   - Verify timezone accuracy across different user timezones
   - Test edge cases (midnight, DST changes, etc.)
