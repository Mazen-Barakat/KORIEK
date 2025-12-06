# Backend API Contract - Booking Notification System Overhaul

## Base URL
```
https://localhost:44316/api
```

## Authentication
All endpoints require Bearer token authentication:
```
Authorization: Bearer {token}
```

---

## 📋 BOOKING ENDPOINTS

### 1. Get Enhanced Booking Details
**Endpoint:** `GET /Booking/{bookingId}/details`

**Description:** Retrieves complete booking information including customer, vehicle, service details, and response status.

**Request:**
```http
GET /api/Booking/123/details
Authorization: Bearer {token}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Booking details retrieved successfully.",
  "data": {
    "id": 123,
    "bookingId": 123,
    "bookingReference": "BK-2024-000123",
    
    "customerName": "Mohamed",
    "customerPhone": "+20 100 123 4567",
    "customerPhoto": "https://example.com/photos/ahmed.jpg",
    
    "vehicleInfo": "2022 Toyota Camry - ABC-1234",
    "vehicleMake": "Toyota",
    "vehicleModel": "Camry",
    "vehicleYear": 2022,
    "vehiclePlateNumber": "ABC-1234",
    
    "serviceType": "Oil Change",
    "serviceList": ["Oil Change"],
    "estimatedDuration": 90,
    "estimatedCost": 850.00,
    
    "exactAppointmentTime": "2024-01-15T14:30:00Z",
    "createdAt": "2024-01-10T10:00:00Z",
    
    "workshopName": "Elite Auto Service",
    "workshopAddress": "Cairo, Giza, Egypt",
    "workshopPhone": "+20 100 987 6543",
    
    "responseStatus": 0,
    "canChangeResponse": true,
    
    "carOwnerConfirmed": null,
    "workshopConfirmed": null,
    "bothConfirmed": false,
    
    "status": "Pending",
    "priority": "high"
  }
}
```

**Error Responses:**
- `404 Not Found` - Booking not found
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - User doesn't have access to this booking

---

### 2. Update Booking Response Status
**Endpoint:** `PUT /Booking/{bookingId}/response`

**Description:** Changes the workshop's response to a booking (Accept/Decline). Includes validation for business rules.

**Request:**
```http
PUT /api/Booking/123/response
Authorization: Bearer {token}
Content-Type: application/json

{
  "responseStatus": 1,
  "changedBy": "workshop"
}
```

**Request Body:**
```json
{
  "responseStatus": 1,  // 0=Pending, 1=Accepted, 2=Declined
  "changedBy": "workshop"  // or "customer"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Booking response updated successfully.",
  "data": {
    "bookingId": 123,
    "bookingReference": "BK-2024-000123",
    "previousStatus": 0,
    "newStatus": 1,
    "canChangeAgain": false,
    "lastResponseChangedAt": "2024-01-15T14:25:30Z",
    "responseChangedBy": "workshop"
  }
}
```

**Business Rules Validation:**

**Error Response (400 Bad Request) - Time has passed:**
```json
{
  "success": false,
  "message": "Cannot change response after appointment time has passed",
  "errorCode": "TIME_EXPIRED",
  "data": {
    "appointmentTime": "2024-01-15T14:30:00Z",
    "currentTime": "2024-01-15T14:35:00Z"
  }
}
```

**Error Response (400 Bad Request) - Acceptance is final:**
```json
{
  "success": false,
  "message": "Cannot change from Accepted status (acceptance is final)",
  "errorCode": "ACCEPTANCE_FINAL",
  "data": {
    "currentStatus": 1,
    "acceptedAt": "2024-01-15T14:00:00Z"
  }
}
```

**Error Response (400 Bad Request) - Invalid transition:**
```json
{
  "success": false,
  "message": "Invalid status transition",
  "errorCode": "INVALID_TRANSITION",
  "data": {
    "currentStatus": 3,
    "requestedStatus": 2,
    "allowedTransitions": []
  }
}
```

---

### 3. Check Booking Time Status
**Endpoint:** `GET /Booking/{bookingId}/time-status`

**Description:** Returns precise timing information for a booking, including seconds until appointment time.

**Request:**
```http
GET /api/Booking/123/time-status
Authorization: Bearer {token}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "bookingId": 123,
    "bookingReference": "BK-2024-000123",
    "exactAppointmentTime": "2024-01-15T14:30:00Z",
    "currentTime": "2024-01-15T14:25:45Z",
    "hasArrived": false,
    "secondsUntilArrival": 255,
    "canStillChangeResponse": true,
    "responseStatus": 0,
    "status": "Confirmed"
  }
}
```

**Response (200 OK) - Time has arrived:**
```json
{
  "success": true,
  "data": {
    "bookingId": 123,
    "bookingReference": "BK-2024-000123",
    "exactAppointmentTime": "2024-01-15T14:30:00Z",
    "currentTime": "2024-01-15T14:30:05Z",
    "hasArrived": true,
    "secondsUntilArrival": -5,
    "canStillChangeResponse": false,
    "responseStatus": 0,
    "status": "Confirmed"
  }
}
```

---

### 4. Get Confirmation Status
**Endpoint:** `GET /Booking/{bookingId}/confirmation-status`

**Description:** Retrieves the confirmation status for both car owner and workshop, including deadline information.

**Request:**
```http
GET /api/Booking/123/confirmation-status
Authorization: Bearer {token}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "bookingId": 123,
    "carOwnerConfirmed": true,
    "workshopConfirmed": false,
    "bothConfirmed": false,
    "status": "Confirmed",
    "confirmationSentAt": "2024-01-15T14:30:00Z",
    "confirmationDeadline": "2024-01-15T14:45:00Z",
    "remainingSeconds": 542
  }
}
```

**Response (200 OK) - Both confirmed:**
```json
{
  "success": true,
  "data": {
    "bookingId": 123,
    "carOwnerConfirmed": true,
    "workshopConfirmed": true,
    "bothConfirmed": true,
    "status": "InProgress",
    "confirmationSentAt": "2024-01-15T14:30:00Z",
    "confirmationDeadline": "2024-01-15T14:45:00Z",
    "remainingSeconds": 0
  }
}
```

---

### 5. Get Bookings Due for Confirmation
**Endpoint:** `GET /Booking/due-for-confirmation`

**Description:** Retrieves all bookings within a specified time window that need confirmation (for background checks).

**Request:**
```http
GET /api/Booking/due-for-confirmation?windowSeconds=60
Authorization: Bearer {token}
```

**Query Parameters:**
- `windowSeconds` (optional, default: 60) - Time window in seconds to check
- `workshopId` (optional) - Filter by workshop
- `customerId` (optional) - Filter by customer

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "bookingId": 123,
      "bookingReference": "BK-2024-000123",
      "exactAppointmentTime": "2024-01-15T14:30:00Z",
      "responseStatus": 0,
      "secondsUntilAppointment": 45
    },
    {
      "bookingId": 124,
      "bookingReference": "BK-2024-000124",
      "exactAppointmentTime": "2024-01-15T14:31:00Z",
      "responseStatus": 2,
      "secondsUntilAppointment": 105
    }
  ],
  "count": 2
}
```

---

### 3. Confirm Appointment Arrival
**Endpoint:** `POST /Booking/confirm-appointment`

**Description:** Confirms that a party (car owner or workshop) has arrived for the appointment. When both parties confirm, the booking status changes to InProgress.

**Request:**
```http
POST /api/Booking/confirm-appointment
Authorization: Bearer {token}
Content-Type: application/json

{
  "bookingId": 123,
  "isConfirmed": true
}
```

**Request Body:**
```json
{
  "bookingId": 123,
  "isConfirmed": true  // true to confirm, false to decline
}
```

**Response (200 OK) - First party confirms:**
```json
{
  "success": true,
  "message": "Appointment confirmation updated successfully.",
  "data": {
    "id": 123,
    "status": "Confirmed",
    "carOwnerConfirmed": true,
    "workshopOwnerConfirmed": false,
    "confirmationSentAt": "2024-01-15T14:30:00Z",
    "confirmationDeadline": "2024-01-15T14:45:00Z"
  }
}
```

**Response (200 OK) - Both parties confirmed:**
```json
{
  "success": true,
  "message": "Appointment confirmation updated successfully.",
  "data": {
    "id": 123,
    "status": "InProgress",
    "carOwnerConfirmed": true,
    "workshopOwnerConfirmed": true,
    "confirmationSentAt": "2024-01-15T14:30:00Z",
    "confirmationDeadline": "2024-01-15T14:45:00Z"
  }
}
```

**Error Response (400 Bad Request) - Deadline expired:**
```json
{
  "success": false,
  "message": "Confirmation deadline has expired",
  "errorCode": "DEADLINE_EXPIRED"
}
```

---

## 🔔 NOTIFICATION ENDPOINTS

### 6. Get User Notifications
**Endpoint:** `GET /Notifications`

**Description:** Retrieves all notifications for the authenticated user.

**Request:**
```http
GET /api/Notifications
Authorization: Bearer {token}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": 456,
      "senderId": "user-123",
      "receiverId": "user-456",
      "message": "Your appointment at Elite Auto Service is now. Please confirm your arrival.",
      "type": 13,
      "isRead": false,
      "createdAt": "2024-01-15T14:30:00Z",
      "bookingId": 123,
      "title": "Confirm Your Appointment",
      "priority": "high",
      "confirmationDeadline": "2024-01-15T14:45:00Z"
    }
  ]
}
```

---

### 7. Get Unread Notification Count
**Endpoint:** `GET /Notifications/unread-count`

**Description:** Returns the count of unread notifications for the authenticated user.

**Request:**
```http
GET /api/Notifications/unread-count
Authorization: Bearer {token}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": 5
}
```

---

### 8. Mark Notification as Read
**Endpoint:** `PUT /Notifications/{id}/mark-read`

**Description:** Marks a specific notification as read.

**Request:**
```http
PUT /api/Notifications/456/mark-read
Authorization: Bearer {token}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Notification marked as read"
}
```

---

### 9. Create Enhanced Notification (Backend Only)
**Endpoint:** `POST /Notifications/enhanced`

**Description:** Creates a new notification with complete booking details. Called internally when bookings are created/updated.

**Request:**
```http
POST /api/Notifications/enhanced
Authorization: Bearer {token}
Content-Type: application/json

{
  "bookingId": 123,
  "userId": 789,
  "notificationType": 0,
  "priority": "high",
  
  "customerName": "Ahmed Mohamed",
  "customerPhone": "+20 100 123 4567",
  "vehicleInfo": "2022 Toyota Camry - ABC-1234",
  "serviceType": "Oil Change + Tire Rotation",
  "exactAppointmentTime": "2024-01-15T14:30:00Z",
  "estimatedCost": 850.00
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Notification created successfully",
  "data": {
    "notificationId": 456,
    "bookingReference": "BK-2024-000123",
    "createdAt": "2024-01-10T10:00:00Z"
  }
}
```

---

## 📊 SIGNALR HUB EVENTS

### Hub URL
```
wss://localhost:44316/notificationHub
```

### Receive Notification Event
**Event Name:** `ReceiveNotification`

**Description:** Triggered when a new notification is sent to the user. Used for appointment confirmation requests and other real-time notifications.

**Usage:**
```javascript
connection.on('ReceiveNotification', (notification) => {
  console.log('New notification:', notification);
  
  // Check notification type
  if (notification.type === 13) { // AppointmentConfirmationRequest
    // Show confirmation dialog
    showConfirmationDialog(notification);
  }
});
```

**Payload:**
```json
{
  "id": 456,
  "senderId": "user-123",
  "receiverId": "user-456",
  "message": "Your appointment is now. Please confirm.",
  "type": 13,
  "isRead": false,
  "createdAt": "2024-01-15T14:30:00Z",
  "bookingId": 123,
  "title": "Confirm Your Appointment",
  "priority": "high",
  "confirmationDeadline": "2024-01-15T14:45:00Z"
}
```

### Booking Response Changed Event
**Event Name:** `BookingResponseChanged`

**Description:** Triggered when a workshop accepts or declines a booking request.

**Usage:**
```javascript
connection.on('BookingResponseChanged', (data) => {
  console.log('Booking response changed:', data);
  
  // Update UI based on new status
  if (data.newStatus === 1) {
    showToast('Booking Accepted! ✅');
  } else if (data.newStatus === 2) {
    showToast('Booking Declined ❌');
  }
});
```

**Payload:**
```json
{
  "bookingId": 123,
  "bookingReference": "BK-2024-000123",
  "previousStatus": 0,
  "newStatus": 1,
  "changedBy": "workshop",
  "changedAt": "2024-01-15T14:25:30Z",
  "canChangeAgain": false
}
```

---

## 🔄 COMPLETE INTEGRATION WORKFLOW

### Appointment Confirmation Flow

**Step 1: Listen for Confirmation Request**
```typescript
connection.on('ReceiveNotification', (notification) => {
  if (notification.type === 13) {
    // AppointmentConfirmationRequest
    this.showConfirmationDialog(notification.bookingId);
  }
});
```

**Step 2: Get Booking Details for Dialog**
```typescript
async showConfirmationDialog(bookingId: number) {
  const details = await this.http.get(`/api/Booking/${bookingId}/details`).toPromise();
  
  // Open dialog with details
  this.dialog.open(ConfirmationDialogComponent, {
    data: details.data
  });
}
```

**Step 3: User Confirms/Declines**
```typescript
async confirmAppointment(bookingId: number, isConfirmed: boolean) {
  const response = await this.http.post('/api/Booking/confirm-appointment', {
    bookingId: bookingId,
    isConfirmed: isConfirmed
  }).toPromise();
  
  if (response.success) {
    if (response.data.status === 'InProgress') {
      this.showToast('Appointment started! Both parties confirmed.');
      this.closeDialog();
    } else {
      this.showToast('Waiting for other party to confirm...');
    }
  }
}
```

**Step 4: Poll for Status (Optional)**
```typescript
// Check confirmation status every 5 seconds
this.pollInterval = setInterval(async () => {
  const status = await this.http.get(`/api/Booking/${bookingId}/confirmation-status`).toPromise();
  
  if (status.data.bothConfirmed) {
    this.showToast('Both confirmed! Service started.');
    clearInterval(this.pollInterval);
    this.closeDialog();
  }
  
  // Update countdown
  this.remainingSeconds = status.data.remainingSeconds;
  
  // Check if deadline expired
  if (this.remainingSeconds <= 0) {
    this.showToast('Confirmation deadline expired.');
    clearInterval(this.pollInterval);
    this.closeDialog();
  }
}, 5000);
```

---

## 🔐 AUTHORIZATION RULES

### Workshop Access
- Can view all bookings for their workshop
- Can change response status for bookings assigned to them
- Can view customer details for their bookings
- Cannot view other workshops' bookings

### Customer Access
- Can view only their own bookings
- Can view response status changes
- Cannot change workshop response status
- Can view workshop details

### Admin Access
- Can view all bookings
- Can view all notifications
- Can manually change response status
- Can view all user details

---

## 📝 RESPONSE STATUS ENUM

```csharp
public enum BookingResponseStatus
{
    Pending = 0,      // Initial state, awaiting response
    Accepted = 1,     // Workshop accepted (FINAL - cannot change)
    Declined = 2,     // Workshop declined (can change to Accepted until time)
    Confirmed = 3,    // Customer confirmed after acceptance
    Expired = 4       // Time passed without response
}
```

---

## ⚠️ BUSINESS RULES SUMMARY

1. **Acceptance is Final**: Once status changes to `Accepted`, it cannot be changed to any other status
2. **Time-Based Restrictions**: No status changes allowed after appointment time has passed
3. **Decline to Accept**: Can change from `Declined` to `Accepted` until appointment time
4. **Pending Flexibility**: `Pending` status can change to either `Accepted` or `Declined`
5. **Modal Precision**: Confirmation modals trigger exactly at appointment time (within 1-second window)
6. **Reference Uniqueness**: Booking references are unique and follow format `BK-YYYY-NNNNNN`

---

## 🎯 PRIORITY LEVELS

- `low` - Non-urgent notifications
- `medium` - Standard booking notifications
- `high` - Booking requests, approaching appointments
- `urgent` - Immediate action required, time-critical

---

## 📱 NOTIFICATION TYPES (Extended)

```csharp
public enum NotificationType
{
    BookingCreated = 0,
    BookingAccepted = 1,
    BookingCancelled = 2,
    BookingInProgress = 3,
    BookingCompleted = 4,
    BookingReadyForPickup = 5,
    PaymentReceived = 6,
    PaymentPending = 7,
    PaymentFailed = 8,
    ReviewReceived = 9,
    JobStatusChanged = 10,
    WalletUpdated = 11,
    PasswordResetRequested = 12,
    AppointmentConfirmationRequest = 13,
    ResponseStatusChanged = 14  // NEW
}
```

---

## 🔄 DATA FLOW EXAMPLE

### Workshop Receives Booking Request

1. **Customer creates booking** → Backend creates booking with reference `BK-2024-000123`
2. **Backend sends SignalR event** → `ReceiveEnhancedNotification` with full details
3. **Frontend displays toast** → "New booking BK-2024-000123 from Ahmed Mohamed"
4. **Frontend adds to tracking** → `EnhancedBookingService` starts precision timer
5. **Notification panel shows** → Full details with Accept/Close buttons
6. **Workshop clicks Accept** → `PUT /Booking/123/response` with status `Accepted`
7. **Backend validates** → Checks time, current status, business rules
8. **Backend sends event** → `BookingResponseChanged` to customer
9. **Frontend updates UI** → Button shows "Accepted ✓", disables further changes
10. **Precision timer ticks** → At exact appointment time (14:30:00), modal appears
11. **Workshop confirms arrival** → Modal shows customer/vehicle details
12. **Booking starts** → Status progresses to InProgress

---

## 🛠️ IMPLEMENTATION CHECKLIST

### Backend Tasks
- [ ] Add database columns (BookingReference, ResponseStatus, etc.)
- [ ] Create stored procedures (sp_UpdateBookingResponseStatus, sp_GetBookingsDueForConfirmation)
- [ ] Implement GET /Booking/{id}/details endpoint
- [ ] Implement PUT /Booking/{id}/response endpoint with validation
- [ ] Implement GET /Booking/time-status endpoint
- [ ] Implement GET /Notifications/enhanced endpoint
- [ ] Update SignalR hub to send enhanced notification payloads
- [ ] Add BookingResponseChanged SignalR event
- [ ] Create booking reference generation trigger
- [ ] Add business rule validation middleware

### Frontend Tasks
- [ ] Create enhanced-booking-notification.model.ts ✅
- [ ] Create enhanced-booking.service.ts ✅
- [ ] Create enhanced-appointment-dialog component ✅
- [ ] Update signalr-notification.service.ts to use enhanced model
- [ ] Update notification-panel.component.ts to display booking references
- [ ] Add precision timer (checks every second) ✅
- [ ] Test acceptance finality logic
- [ ] Test decline-to-accept transition
- [ ] Test modal timing precision
- [ ] Add response status color coding
- [ ] Test with multiple concurrent bookings

---

## 📞 SUPPORT

For API issues or questions:
- Backend Team: backend@koriek.com
- Frontend Team: frontend@koriek.com
- DevOps: devops@koriek.com
