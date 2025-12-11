import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { PaymentModalComponent } from '../payment-modal/payment-modal.component';
import { PaymentService } from '../../services/payment.service';
import { BookingService } from '../../services/booking.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { SignalRNotificationService } from '../../services/signalr-notification.service';

@Component({
  selector: 'app-payment-trigger',
  standalone: true,
  imports: [CommonModule, PaymentModalComponent],
  template: `
    <app-payment-modal
      *ngIf="showPaymentModal"
      [bookingId]="selectedBooking.id"
      [totalAmount]="selectedBooking.totalAmount"
      [workshopName]="selectedBooking.workshopName"
      [serviceName]="selectedBooking.serviceName"
      [appointmentDate]="selectedBooking.appointmentDate"
      (paymentSuccess)="handlePaymentSuccess()"
      (paymentCancelled)="handlePaymentCancelled()"
    ></app-payment-modal>
  `,
  styles: []
})
export class PaymentTriggerComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  showPaymentModal = false;
  selectedBooking: any = {
    id: 0,
    totalAmount: 0,
    workshopName: '',
    serviceName: '',
    appointmentDate: ''
  };

  constructor(
    private paymentService: PaymentService,
    private bookingService: BookingService,
    private authService: AuthService,
    private toastService: ToastService,
    private signalRService: SignalRNotificationService,
    private router: Router
  ) {}

  ngOnInit() {
    // Listen for "Ready for Pickup" notifications from SignalR
    this.signalRService.appointmentConfirmationReceived
      .pipe(takeUntil(this.destroy$))
      .subscribe((notification: any) => {
        console.log('📬 Notification received:', notification);
        this.checkAndTriggerPayment(notification);
      });

    // Also check payment flow state
    this.paymentService.paymentFlow$
      .pipe(takeUntil(this.destroy$))
      .subscribe(flowState => {
        if (flowState.active && flowState.bookingId && flowState.amount) {
          this.showPaymentModalForBooking(
            flowState.bookingId,
            flowState.amount
          );
        }
      });

    // Listen for booking status changes via global event (from SignalR notification service)
    if (typeof window !== 'undefined') {
      window.addEventListener('booking:status-changed', (event: any) => {
        const { bookingId, status } = event.detail || {};
        console.log('🎯 Booking status changed event:', { bookingId, status });

        // Check if status is ready for pickup
        if (bookingId && status &&
            (status.toLowerCase().includes('ready') ||
             status.toLowerCase().includes('readyforpickup') ||
             status === 'ReadyForPickup')) {
          console.log('✅ Ready for pickup detected! Checking payment...');
          this.fetchBookingAndTriggerPayment(bookingId);
        }
      });

      // Also listen for the original event type
      window.addEventListener('booking:ready-for-pickup', (event: any) => {
        const { bookingId, paymentMethod, totalAmount } = event.detail || {};
        if (paymentMethod === 'CreditCard' && totalAmount && bookingId) {
          this.showPaymentModalForBooking(bookingId, totalAmount, event.detail);
        }
      });
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Check notification and trigger payment if conditions are met
   */
  private checkAndTriggerPayment(notification: any) {
    const notificationType = notification.notificationType || notification.type;
    const message = (notification.message || '').toLowerCase();

    // Check if this is a "Ready for Pickup" notification
    const isReadyForPickup =
      notificationType === 11 || // BookingReadyForPickup enum value
      notificationType === 'BookingReadyForPickup' ||
      message.includes('ready for pickup') ||
      message.includes('vehicle is ready');

    if (isReadyForPickup) {
      const bookingId = notification.bookingId;

      // Fetch booking details to check payment method
      if (bookingId) {
        this.fetchBookingAndTriggerPayment(bookingId);
      }
    }
  }

  /**
   * Fetch booking details and trigger payment if credit card
   */
  private fetchBookingAndTriggerPayment(bookingId: number) {
    const token = this.authService.getToken();
    if (!token) {
      console.error('❌ No auth token available');
      return;
    }

    console.log('🔍 Fetching booking details for ID:', bookingId);

    this.bookingService.getBookingById(bookingId).subscribe({
      next: (response: any) => {
        const booking = response.data || response;

        console.log('📊 Full booking response:', booking);

        // Check if payment method is Credit Card and payment is not yet made
        const paymentMethod = booking.paymentMethod || '';
        const paymentStatus = booking.paymentStatus || '';
        const paidAmount = booking.paidAmount;
        const status = booking.status || '';

        console.log('📋 Booking details check:', {
          bookingId,
          status,
          paymentMethod,
          paymentStatus,
          paidAmount,
          quotedPrice: booking.quotedPrice,
          totalAmount: booking.totalAmount
        });

        const isCreditCard =
          paymentMethod === 'CreditCard' ||
          paymentMethod === 'Credit Card' ||
          paymentMethod === '1' ||
          paymentMethod === 1;

        const isReadyForPickup =
          status.toLowerCase().includes('ready') ||
          status.toLowerCase().includes('readyforpickup') ||
          status === 'ReadyForPickup';

        const isUnpaid =
          paymentStatus === 'Unpaid' ||
          paymentStatus === 'Pending' ||
          !paidAmount ||
          paidAmount === 0;

        console.log('✓ Payment checks:', {
          isCreditCard,
          isReadyForPickup,
          isUnpaid
        });

        if (isCreditCard && isReadyForPickup && isUnpaid) {
          console.log('✅ All conditions met! Showing payment modal...');

          // Show notification toast first
          this.toastService.info(
            'Payment Required 💳',
            'Your vehicle is ready! Complete payment to proceed.',
            5000
          );

          // Trigger payment modal instantly (no delay)
          this.showPaymentModalForBooking(
            bookingId,
            booking.quotedPrice || booking.totalAmount || 100,
            booking
          );
        } else {
          console.warn('⚠️ Payment modal not shown. Conditions not met:', {
            isCreditCard: `${isCreditCard} (paymentMethod: ${paymentMethod})`,
            isReadyForPickup: `${isReadyForPickup} (status: ${status})`,
            isUnpaid: `${isUnpaid} (paymentStatus: ${paymentStatus}, paidAmount: ${paidAmount})`
          });
        }
      },
      error: (error) => {
        console.error('❌ Error fetching booking details:', error);
      }
    });
  }

  /**
   * Show payment modal with booking details
   */
  private showPaymentModalForBooking(
    bookingId: number,
    totalAmount: number,
    bookingData?: any
  ) {
    this.selectedBooking = {
      id: bookingId,
      totalAmount: totalAmount,
      workshopName: bookingData?.workshopName || 'Auto Workshop',
      serviceName: bookingData?.serviceName || 'Vehicle Service',
      appointmentDate: bookingData?.appointmentDate || new Date().toISOString()
    };

    this.showPaymentModal = true;
  }

  /**
   * Handle successful payment
   */
  handlePaymentSuccess() {
    console.log('✅ Payment successful');
    this.showPaymentModal = false;

    // Show success notification
    this.toastService.success(
      'Payment Complete! 🎉',
      'You can now pick up your vehicle',
      5000
    );

    // Navigate to booking details or my vehicles
    setTimeout(() => {
      this.router.navigate(['/my-vehicles']);
    }, 2000);

    // Broadcast event for other components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('payment:completed', {
        detail: { bookingId: this.selectedBooking.id }
      }));
    }
  }

  /**
   * Handle payment cancellation
   */
  handlePaymentCancelled() {
    console.log('❌ Payment cancelled');
    this.showPaymentModal = false;

    this.toastService.warning(
      'Payment Cancelled',
      'You can complete the payment later from your bookings',
      4000
    );
  }
}
