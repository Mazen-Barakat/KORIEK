# 🔌 Payment System Integration Examples

## Adding Payment to Existing Components

### 1. My Vehicles Page

Show "Pay Now" button for unpaid bookings that are ready for pickup:

```typescript
// my-vehicles.component.ts
import { PayNowButtonComponent } from '../pay-now-button/pay-now-button.component';

@Component({
  selector: 'app-my-vehicles',
  imports: [CommonModule, PayNowButtonComponent],
  // ... rest of config
})
export class MyVehiclesComponent {
  // ... existing code
}
```

```html
<!-- my-vehicles.component.html -->
<div class="vehicle-card" *ngFor="let vehicle of vehicles">
  <div class="vehicle-info">
    <!-- existing vehicle info -->
  </div>
  
  <div class="vehicle-bookings" *ngIf="vehicle.activeBooking">
    <div class="booking-status">
      <span class="status-badge" [class]="booking.status">
        {{ booking.status }}
      </span>
    </div>
    
    <!-- Payment Button (automatically shown when conditions are met) -->
    <app-pay-now-button
      [bookingId]="vehicle.activeBooking.id"
      [totalAmount]="vehicle.activeBooking.quotedPrice"
      [paymentMethod]="vehicle.activeBooking.paymentMethod"
      [paymentStatus]="vehicle.activeBooking.paymentStatus"
      [pulse]="vehicle.activeBooking.status === 'Ready for Pickup'"
      [buttonText]="'Complete Payment to Pick Up'"
    ></app-pay-now-button>
  </div>
</div>
```

### 2. Booking Card Component

Add payment button directly in booking cards:

```typescript
// booking-card.component.ts
import { PayNowButtonComponent } from '../pay-now-button/pay-now-button.component';

@Component({
  selector: 'app-booking-card',
  imports: [CommonModule, PayNowButtonComponent],
  // ... rest of config
})
export class BookingCardComponent {
  @Input() booking!: BookingCardData;
  // ... existing code
}
```

```html
<!-- booking-card.component.html -->
<div class="booking-card">
  <div class="booking-header">
    <!-- existing header content -->
  </div>
  
  <div class="booking-body">
    <!-- existing booking details -->
  </div>
  
  <div class="booking-footer">
    <!-- Existing action buttons -->
    <button class="btn-details" (click)="onViewDetails()">
      View Details
    </button>
    
    <!-- Add Payment Button -->
    <app-pay-now-button
      [bookingId]="booking.id"
      [totalAmount]="booking.quotedPrice || booking.totalAmount"
      [paymentMethod]="booking.paymentMethod"
      [paymentStatus]="booking.paymentStatus"
      [pulse]="booking.status === 'Ready for Pickup'"
    ></app-pay-now-button>
  </div>
</div>
```

### 3. Booking Details Page

Show prominent payment section:

```typescript
// booking-detail.component.ts
import { PayNowButtonComponent } from '../pay-now-button/pay-now-button.component';

@Component({
  selector: 'app-booking-detail',
  imports: [CommonModule, PayNowButtonComponent],
  // ... rest of config
})
export class BookingDetailComponent {
  booking: any;
  // ... existing code
}
```

```html
<!-- booking-detail.component.html -->
<div class="booking-detail-page">
  <!-- Existing booking information -->
  
  <!-- Payment Section -->
  <div class="payment-section" *ngIf="booking.paymentMethod === 'CreditCard'">
    <div class="section-header">
      <h3>💳 Payment</h3>
    </div>
    
    <div class="payment-info" *ngIf="booking.paymentStatus === 'Paid'">
      <div class="paid-badge">
        <span class="icon">✓</span>
        <span class="text">Payment Completed</span>
      </div>
      <div class="payment-details">
        <div class="detail-row">
          <span>Amount Paid:</span>
          <span class="amount">${{ booking.paidAmount }}</span>
        </div>
        <div class="detail-row">
          <span>Payment Date:</span>
          <span>{{ booking.paidDate | date:'medium' }}</span>
        </div>
      </div>
    </div>
    
    <div class="payment-pending" *ngIf="booking.paymentStatus === 'Unpaid'">
      <div class="pending-message">
        <span class="icon">⏳</span>
        <div class="message-content">
          <h4>Payment Required</h4>
          <p *ngIf="booking.status === 'Ready for Pickup'">
            Your vehicle is ready! Complete payment to pick it up.
          </p>
          <p *ngIf="booking.status !== 'Ready for Pickup'">
            Payment will be required when your vehicle is ready.
          </p>
        </div>
      </div>
      
      <!-- Payment Button -->
      <app-pay-now-button
        [bookingId]="booking.id"
        [totalAmount]="booking.quotedPrice"
        [paymentMethod]="booking.paymentMethod"
        [paymentStatus]="booking.paymentStatus"
        [pulse]="booking.status === 'Ready for Pickup'"
        [buttonText]="'Pay Now - $' + booking.quotedPrice"
      ></app-pay-now-button>
    </div>
  </div>
</div>
```

### 4. Workshop Dashboard (for testing)

Workshop can trigger payment notification:

```typescript
// workshop-dashboard.component.ts
import { PaymentService } from '@services/payment.service';

export class WorkshopDashboardComponent {
  constructor(private paymentService: PaymentService) {}
  
  markAsReadyForPickup(booking: any) {
    // Update booking status to "ReadyForPickup"
    this.bookingService.updateBookingStatus(booking.id, 'ReadyForPickup')
      .subscribe({
        next: () => {
          // If payment method is credit card, broadcast event
          if (booking.paymentMethod === 'CreditCard') {
            window.dispatchEvent(new CustomEvent('booking:ready-for-pickup', {
              detail: {
                bookingId: booking.id,
                paymentMethod: booking.paymentMethod,
                totalAmount: booking.quotedPrice,
                workshopName: booking.workshopName,
                serviceName: booking.serviceName,
                appointmentDate: booking.appointmentDate
              }
            }));
          }
        }
      });
  }
}
```

### 5. Car Owner Dashboard

Show pending payments prominently:

```html
<!-- car-owner-dashboard.component.html -->
<div class="dashboard">
  <!-- Pending Payments Alert -->
  <div class="alert-banner" *ngIf="hasPendingPayments">
    <div class="alert-icon">💳</div>
    <div class="alert-content">
      <h4>Payment Required</h4>
      <p>You have {{ pendingPaymentsCount }} vehicle(s) ready for pickup</p>
    </div>
    <button class="alert-action" (click)="viewPendingPayments()">
      View All
    </button>
  </div>
  
  <!-- Active Bookings with Payment Buttons -->
  <div class="active-bookings">
    <h3>Active Bookings</h3>
    <div class="booking-grid">
      <div class="booking-card" *ngFor="let booking of activeBookings">
        <!-- Booking info -->
        <div class="booking-info">
          <h4>{{ booking.serviceName }}</h4>
          <p>{{ booking.workshopName }}</p>
          <span class="status-badge">{{ booking.status }}</span>
        </div>
        
        <!-- Payment action -->
        <div class="booking-actions">
          <app-pay-now-button
            [bookingId]="booking.id"
            [totalAmount]="booking.quotedPrice"
            [paymentMethod]="booking.paymentMethod"
            [paymentStatus]="booking.paymentStatus"
            [pulse]="true"
          ></app-pay-now-button>
        </div>
      </div>
    </div>
  </div>
</div>
```

## Styling Examples

### Animated Payment Card
```css
/* Highlight ready-for-pickup bookings */
.booking-card.ready-for-pickup {
  border: 2px solid #fbbf24;
  background: linear-gradient(135deg, #fef3c7 0%, #fef9e7 100%);
  box-shadow: 0 4px 12px rgba(251, 191, 36, 0.3);
  animation: pulse-glow 2s infinite;
}

@keyframes pulse-glow {
  0%, 100% {
    box-shadow: 0 4px 12px rgba(251, 191, 36, 0.3);
  }
  50% {
    box-shadow: 0 8px 20px rgba(251, 191, 36, 0.5);
  }
}

/* Payment badge */
.payment-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.payment-badge.paid {
  background: #d1fae5;
  color: #065f46;
}

.payment-badge.unpaid {
  background: #fee2e2;
  color: #991b1b;
}
```

## Event Handling

### Listen for Payment Completion

```typescript
// any-component.component.ts
ngOnInit() {
  // Listen for payment completion
  window.addEventListener('payment:completed', (event: any) => {
    const { bookingId } = event.detail;
    
    // Refresh booking data
    this.refreshBooking(bookingId);
    
    // Show success message
    this.showSuccessMessage();
    
    // Update dashboard stats
    this.loadDashboardStats();
  });
}

refreshBooking(bookingId: number) {
  this.bookingService.getBookingById(bookingId).subscribe({
    next: (booking) => {
      // Update local booking data
      const index = this.bookings.findIndex(b => b.id === bookingId);
      if (index !== -1) {
        this.bookings[index] = booking;
      }
    }
  });
}
```

### Trigger Payment Programmatically

```typescript
// any-component.component.ts
import { PaymentService } from '@services/payment.service';

constructor(private paymentService: PaymentService) {}

initiatePayment(booking: any) {
  this.paymentService.startPaymentFlow(
    booking.id,
    booking.quotedPrice || booking.totalAmount
  );
}
```

## Advanced Integrations

### 1. Notification Panel Integration

Already integrated! When a "Ready for Pickup" notification is clicked, it can trigger payment:

```typescript
// notification-panel.component.ts (already implemented)
handleNotificationClick(notification: AppNotification): void {
  // Check if ready for pickup
  if (notification.type === 'booking' && 
      notification.message.includes('ready for pickup')) {
    
    const bookingId = notification.data?.bookingId;
    // Payment trigger component will handle this automatically
  }
}
```

### 2. Booking Timeline Integration

Show payment step in booking timeline:

```html
<div class="booking-timeline">
  <div class="timeline-step completed">
    <span class="step-icon">📝</span>
    <span class="step-label">Booking Created</span>
  </div>
  
  <div class="timeline-step completed">
    <span class="step-icon">✓</span>
    <span class="step-label">Confirmed</span>
  </div>
  
  <div class="timeline-step completed">
    <span class="step-icon">🔧</span>
    <span class="step-label">In Progress</span>
  </div>
  
  <div class="timeline-step current">
    <span class="step-icon">💳</span>
    <span class="step-label">Payment Required</span>
    <!-- Add payment button -->
    <app-pay-now-button
      [bookingId]="booking.id"
      [totalAmount]="booking.quotedPrice"
      [paymentMethod]="booking.paymentMethod"
      [paymentStatus]="booking.paymentStatus"
    ></app-pay-now-button>
  </div>
  
  <div class="timeline-step pending">
    <span class="step-icon">🚗</span>
    <span class="step-label">Pick Up</span>
  </div>
</div>
```

### 3. Mobile App Integration

For mobile notifications:

```typescript
// mobile-push-notification.service.ts
handlePushNotification(notification: any) {
  if (notification.type === 'ready-for-pickup') {
    // Show local notification
    this.localNotifications.create({
      title: 'Vehicle Ready! 🚗',
      body: 'Tap to complete payment and schedule pickup',
      data: {
        bookingId: notification.bookingId,
        totalAmount: notification.totalAmount
      }
    });
  }
}

// When notification is tapped
onNotificationTap(notification: any) {
  const { bookingId, totalAmount } = notification.data;
  this.paymentService.startPaymentFlow(bookingId, totalAmount);
}
```

## Testing Checklist

- [ ] Payment modal appears when booking is marked "Ready for Pickup"
- [ ] Payment modal only shows for "CreditCard" payment method
- [ ] Payment modal doesn't show if already paid
- [ ] "Pay Now" button hidden if not applicable
- [ ] Toast notification appears before modal
- [ ] Card element loads properly
- [ ] Payment processing shows spinner
- [ ] Success screen appears after payment
- [ ] Error screen shows on payment failure
- [ ] Can retry after failure
- [ ] Can cancel payment
- [ ] Booking status updates after payment
- [ ] Dashboard refreshes after payment
- [ ] Payment history updated
- [ ] Receipt/confirmation shown

## Common Patterns

### Pattern 1: Conditional Payment Button
```html
<div class="action-buttons">
  <!-- Show payment button OR other actions, not both -->
  <app-pay-now-button
    *ngIf="needsPayment(booking)"
    [bookingId]="booking.id"
    [totalAmount]="booking.quotedPrice"
    [paymentMethod]="booking.paymentMethod"
    [paymentStatus]="booking.paymentStatus"
  ></app-pay-now-button>
  
  <button 
    *ngIf="!needsPayment(booking)"
    class="btn-primary"
    (click)="viewDetails(booking)">
    View Details
  </button>
</div>
```

```typescript
needsPayment(booking: any): boolean {
  return booking.paymentMethod === 'CreditCard' &&
         booking.paymentStatus === 'Unpaid' &&
         booking.status === 'Ready for Pickup';
}
```

### Pattern 2: Payment Status Indicator
```html
<div class="payment-status">
  <div class="status-indicator" [ngClass]="getPaymentStatusClass(booking)">
    <span class="status-icon">{{ getPaymentIcon(booking) }}</span>
    <span class="status-text">{{ getPaymentStatusText(booking) }}</span>
  </div>
  
  <app-pay-now-button
    *ngIf="booking.paymentStatus === 'Unpaid'"
    [bookingId]="booking.id"
    [totalAmount]="booking.quotedPrice"
    [paymentMethod]="booking.paymentMethod"
    [paymentStatus]="booking.paymentStatus"
  ></app-pay-now-button>
</div>
```

---

**Need more examples?** Check the `/components/payment-trigger/` for the automatic triggering implementation!
