import { Component, OnInit, OnDestroy, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { PaymentModalComponent } from '../payment-modal/payment-modal.component';
import { PaymentService } from '../../services/payment.service';
import { BookingService } from '../../services/booking.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { SignalRNotificationService } from '../../services/signalr-notification.service';
import { environment } from '../../../environments/environment';

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
      [priceFrom]="selectedBooking.priceFrom"
      [priceTo]="selectedBooking.priceTo"
      (paymentSuccess)="handlePaymentSuccess()"
      (paymentCancelled)="handlePaymentCancelled()"
    ></app-payment-modal>
  `,
  styles: [],
})
export class PaymentTriggerComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  showPaymentModal = false;
  selectedBooking: any = {
    id: 0,
    totalAmount: 0,
    workshopName: '',
    serviceName: '',
    appointmentDate: '',
    priceFrom: 0,
    priceTo: 0,
  };

  constructor(
    private paymentService: PaymentService,
    private bookingService: BookingService,
    private authService: AuthService,
    private toastService: ToastService,
    private signalRService: SignalRNotificationService,
    private router: Router,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    console.log('💳 PaymentTriggerComponent initialized and listening for events');

    // Listen for "Ready for Pickup" notifications from SignalR
    this.signalRService.appointmentConfirmationReceived
      .pipe(takeUntil(this.destroy$))
      .subscribe((notification: any) => {
        console.log('📬 Notification received in payment-trigger:', notification);
        this.checkAndTriggerPayment(notification);
      });

    // Also check payment flow state
    this.paymentService.paymentFlow$.pipe(takeUntil(this.destroy$)).subscribe((flowState) => {
      if (flowState.active && flowState.bookingId && flowState.amount) {
        this.showPaymentModalForBooking(flowState.bookingId, flowState.amount);
      }
    });

    // Listen for booking status changes via global event (from SignalR notification service)
    if (typeof window !== 'undefined') {
      window.addEventListener('booking:status-changed', (event: any) => {
        const { bookingId, status } = event.detail || {};
        console.log('🎯 Booking status changed event received in payment-trigger:', {
          bookingId,
          status,
        });

        if (!bookingId || !status) {
          console.warn('⚠️ Missing bookingId or status in event');
          return;
        }

        const statusLower = status.toLowerCase();
        console.log('🔍 Checking status:', statusLower);

        // Check if status is ready for pickup
        if (
          statusLower === 'ready' ||
          statusLower === 'readyforpickup' ||
          statusLower === 'ready-for-pickup' ||
          statusLower.includes('ready')
        ) {
          console.log('✅ Ready for pickup detected! Triggering payment check immediately...');

          // Run in NgZone to ensure Angular change detection
          this.ngZone.run(() => {
            this.fetchBookingAndTriggerPayment(bookingId);
            // Force change detection immediately
            this.cdr.detectChanges();
          });
        } else {
          console.log('❌ Status not ready for pickup:', statusLower);
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
      next: async (response: any) => {
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
          totalAmount: booking.totalAmount,
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
          isUnpaid,
        });

        if (isCreditCard && isReadyForPickup && isUnpaid) {
          console.log('✅ All conditions met! Showing payment modal instantly...');

          // Show modal IMMEDIATELY with basic booking data
          this.ngZone.run(() => {
            this.selectedBooking = {
              id: bookingId,
              totalAmount: booking.quotedPrice || booking.totalAmount || 100,
              workshopName: 'Loading...',
              serviceName: 'Loading...',
              appointmentDate: booking.appointmentDate || new Date().toISOString(),
              priceFrom: 0,
              priceTo: 0,
            };
            this.showPaymentModal = true;
            console.log('💳 Payment modal opened instantly!');
            // Force immediate change detection
            this.cdr.detectChanges();
          });

          // Then fetch complete details in background and update
          this.fetchCompleteBookingDetails(
            bookingId,
            booking.workShopProfileId || booking.workshopProfileId,
            booking.workshopServiceId,
            booking.appointmentDate,
            booking.quotedPrice || booking.totalAmount || 100
          );
        } else {
          console.warn('⚠️ Payment modal not shown. Conditions not met:', {
            isCreditCard: `${isCreditCard} (paymentMethod: ${paymentMethod})`,
            isReadyForPickup: `${isReadyForPickup} (status: ${status})`,
            isUnpaid: `${isUnpaid} (paymentStatus: ${paymentStatus}, paidAmount: ${paidAmount})`,
          });
        }
      },
      error: (error) => {
        console.error('❌ Error fetching booking details:', error);
      },
    });
  }

  /**
   * Fetch complete booking details including workshop name and service name
   */
  private async fetchCompleteBookingDetails(
    bookingId: number,
    workshopProfileId: number,
    workshopServiceId: number,
    appointmentDate: string,
    totalAmount: number
  ): Promise<void> {
    try {
      // Fetch workshop profile
      const workshopResponse: any = await this.bookingService.http
        .get(
          `${environment.apiBase}/WorkShopProfile/Get-WorkShop-ById-Profile?id=${workshopProfileId}`
        )
        .toPromise();

      const workshopData = workshopResponse?.data || workshopResponse;
      const workshopName =
        workshopData?.name ||
        workshopData?.shopName ||
        workshopData?.workshopName ||
        'Auto Workshop';

      console.log('🏪 Workshop fetched:', workshopName);

      // Fetch workshop service to get serviceId and price range (MinPrice and MaxPrice)
      const workshopServiceResponse: any = await this.bookingService.http
        .get(`${environment.apiBase}/WorkshopService/${workshopServiceId}`)
        .toPromise();

      const workshopServiceData = workshopServiceResponse?.data || workshopServiceResponse;
      const serviceId = workshopServiceData?.serviceId;
      const minPrice = workshopServiceData?.minPrice || workshopServiceData?.MinPrice || 0;
      const maxPrice = workshopServiceData?.maxPrice || workshopServiceData?.MaxPrice || 0;

      console.log(
        '🔧 Workshop service fetched - serviceId:',
        serviceId,
        'Price range: $',
        minPrice,
        '- $',
        maxPrice
      );

      // Fetch service name from Services table
      let serviceName = 'Vehicle Service';
      if (serviceId) {
        const serviceResponse: any = await this.bookingService.http
          .get(`${environment.apiBase}/Service/${serviceId}`)
          .toPromise();

        const serviceData = serviceResponse?.data || serviceResponse;
        serviceName = serviceData?.name || serviceData?.serviceName || 'Vehicle Service';
        console.log('🛠️ Service name fetched:', serviceName);
      }

      // Show notification toast
      this.toastService.info(
        'Payment Required 💳',
        'Your vehicle is ready! Complete payment to proceed.',
        5000
      );

      // Update modal with complete fetched data including price range
      this.ngZone.run(() => {
        this.selectedBooking = {
          id: bookingId,
          totalAmount: totalAmount,
          workshopName: workshopName,
          serviceName: serviceName,
          appointmentDate: appointmentDate,
          priceFrom: minPrice,
          priceTo: maxPrice,
        };
        console.log('📋 Modal updated with complete details:', this.selectedBooking);
        // Force change detection to update view
        this.cdr.detectChanges();
      });
    } catch (error) {
      console.error('❌ Error fetching complete booking details:', error);

      // Update modal with default values if fetch fails
      this.ngZone.run(() => {
        this.selectedBooking = {
          ...this.selectedBooking,
          workshopName: 'Auto Workshop',
          serviceName: 'Vehicle Service',
        };
      });
    }
  }

  /**
   * Show payment modal with booking details
   */
  private showPaymentModalForBooking(bookingId: number, totalAmount: number, bookingData?: any) {
    // Run inside Angular zone to ensure change detection triggers
    this.ngZone.run(() => {
      this.selectedBooking = {
        id: bookingId,
        totalAmount: totalAmount,
        workshopName: bookingData?.workshopName || 'Auto Workshop',
        serviceName: bookingData?.serviceName || 'Vehicle Service',
        appointmentDate: bookingData?.appointmentDate || new Date().toISOString(),
        priceFrom: bookingData?.priceFrom || 0,
        priceTo: bookingData?.priceTo || 0,
      };

      this.showPaymentModal = true;
      console.log('💳 Payment modal triggered - showPaymentModal:', this.showPaymentModal);
      // Force change detection immediately
      this.cdr.detectChanges();
    });
  }

  /**
   * Handle successful payment
   */
  handlePaymentSuccess() {
    console.log('✅ Payment successful');
    this.showPaymentModal = false;

    // Show success notification
    this.toastService.success('Payment Complete! 🎉', 'You can now pick up your vehicle', 5000);

    // Navigate to booking details or my vehicles
    setTimeout(() => {
      this.router.navigate(['/my-vehicles']);
    }, 2000);

    // Broadcast event for other components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('payment:completed', {
          detail: { bookingId: this.selectedBooking.id },
        })
      );
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
