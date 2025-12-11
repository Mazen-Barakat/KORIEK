import { Component, OnInit, OnDestroy, ViewChild, ElementRef, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { loadStripe, Stripe, StripeElements, StripeCardElement } from '@stripe/stripe-js';
import { PaymentService } from '../../services/payment.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-payment-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './payment-modal.component.html',
  styleUrls: ['./payment-modal.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PaymentModalComponent implements OnInit, OnDestroy {
  @Input() bookingId!: number;
  @Input() totalAmount!: number;
  @Input() workshopName!: string;
  @Input() serviceName!: string;
  @Input() appointmentDate!: string;

  @Output() paymentSuccess = new EventEmitter<void>();
  @Output() paymentCancelled = new EventEmitter<void>();

  @ViewChild('cardElement', { static: false }) cardElementRef!: ElementRef;

  private destroy$ = new Subject<void>();
  private stripe: Stripe | null = null;
  private cardElement: StripeCardElement | null = null;

  // Payment flow states
  currentStep: 'summary' | 'payment' | 'processing' | 'success' | 'error' = 'summary';

  // UI states
  processing = false;
  errorMessage = '';
  clientSecret = '';

  // Breakdown
  commissionAmount = 0;
  workshopAmount = 0;

  // Stripe publishable key - replace with your actual key
  private readonly STRIPE_PUBLISHABLE_KEY = 'pk_test_51RJbjDQp15bpiHsYgPe180tW0rzVXiS2QNabNsBIuGjtVOG5F4tjnVJNiabrNnwBfIgbebWl6XWn3TnFiAh54cIt00q1LAEPs0';

  constructor(
    private paymentService: PaymentService,
    private authService: AuthService,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    // Calculate commission breakdown
    const breakdown = this.paymentService.calculateCommissionBreakdown(this.totalAmount);
    this.commissionAmount = breakdown.commissionAmount;
    this.workshopAmount = breakdown.workshopAmount;

    // Initialize Stripe
    this.stripe = await loadStripe(this.STRIPE_PUBLISHABLE_KEY);

    if (!this.stripe) {
      this.errorMessage = 'Failed to initialize payment system';
      this.currentStep = 'error';
    }

    // Trigger change detection after async operations
    this.cdr.markForCheck();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();

    if (this.cardElement) {
      this.cardElement.destroy();
    }
  }

  /**
   * Move to payment step and initialize card element
   */
  async proceedToPayment() {
    this.currentStep = 'payment';
    this.errorMessage = '';

    // Trigger change detection to render card element container
    this.cdr.markForCheck();

    // Wait for view to update before mounting card element
    requestAnimationFrame(() => {
      this.initializeCardElement();
    });
  }

  /**
   * Initialize Stripe card element
   */
  private async initializeCardElement() {
    if (!this.stripe) {
      console.error('❌ Stripe not initialized');
      return;
    }

    try {
      // Check if container exists
      const cardElementContainer = document.getElementById('card-element');
      if (!cardElementContainer) {
        console.error('❌ Card element container not found');
        this.errorMessage = 'Payment form not ready. Please try again.';
        this.cdr.markForCheck();
        return;
      }

      // Destroy previous card element if it exists
      if (this.cardElement) {
        try {
          this.cardElement.destroy();
        } catch (e) {
          console.warn('⚠️ Error destroying previous card element:', e);
        }
        this.cardElement = null;
      }

      // Create new card element
      const elements = this.stripe.elements();
      this.cardElement = elements.create('card', {
        style: {
          base: {
            fontSize: '16px',
            color: '#1f2937',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            '::placeholder': {
              color: '#9ca3af'
            },
            iconColor: '#ef4444'
          },
          invalid: {
            color: '#ef4444',
            iconColor: '#ef4444'
          }
        },
        hidePostalCode: false
      });

      // Mount card element
      console.log('📌 Mounting card element...');
      this.cardElement.mount('#card-element');
      console.log('✅ Card element mounted successfully');

      // Listen for card errors
      this.cardElement.on('change', (event: any) => {
        if (event.error) {
          this.errorMessage = event.error.message;
          console.warn('⚠️ Card error:', event.error.message);
        } else {
          this.errorMessage = '';
        }
        this.cdr.markForCheck();
      });
    } catch (error) {
      console.error('❌ Error initializing card element:', error);
      this.errorMessage = 'Failed to load payment form. Please refresh and try again.';
      this.cdr.markForCheck();
    }
  }

  /**
   * Handle payment submission using modern Stripe API
   */
  async handlePayment() {
    if (!this.stripe || !this.cardElement) {
      this.errorMessage = 'Payment system not ready';
      console.error('❌ Stripe or card element not initialized');
      return;
    }

    // Set processing flag but keep the card element visible
    this.processing = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    console.log('💳 Starting payment process for booking:', this.bookingId);

    try {
      const token = this.authService.getToken();
      if (!token) {
        throw new Error('Authentication required. Please log in again.');
      }

      // Step 1: Create payment method from card element BEFORE unmounting it
      console.log('💳 Creating payment method from card...');
      const { error: pmError, paymentMethod } = await this.stripe.createPaymentMethod({
        type: 'card',
        card: this.cardElement,
        billing_details: {
          name: this.authService.getUserName() || 'Customer'
        }
      });

      if (pmError) {
        throw new Error(pmError.message || 'Failed to create payment method');
      }

      if (!paymentMethod) {
        throw new Error('No payment method created');
      }

      console.log('✅ Payment method created:', paymentMethod.id);

      // Step 2: Create payment intent on backend
      console.log('📤 Creating payment intent...');
      const response = await this.paymentService
        .createPaymentIntent(this.bookingId, this.totalAmount, token)
        .toPromise();

      if (!response || !response.success) {
        throw new Error(response?.message || 'Failed to create payment intent on backend');
      }

      this.clientSecret = response.data;
      console.log('✅ Payment intent created:', this.clientSecret);

      // NOW we can safely change to processing step - card data is captured
      this.currentStep = 'processing';
      this.cdr.markForCheck();

      // Step 3: Confirm payment with the payment method we already created
      console.log('🔐 Confirming payment with Stripe...');
      const { error, paymentIntent } = await this.stripe.confirmCardPayment(
        this.clientSecret,
        {
          payment_method: paymentMethod.id
        },
        { handleActions: true }
      );

      if (error) {
        // Payment failed
        console.error('❌ Payment error from Stripe:', error);
        this.errorMessage = error.message || 'Payment processing failed';
        this.currentStep = 'error';
        this.processing = false;
        this.cdr.markForCheck();

        this.toastService.error(
          'Payment Failed',
          this.errorMessage,
          4000
        );
        return;
      }

      if (!paymentIntent) {
        throw new Error('No payment intent returned from Stripe');
      }

      console.log('📊 Payment intent status:', paymentIntent.status);

      // Handle different payment statuses
      if (paymentIntent.status === 'succeeded') {
        console.log('✅ Payment succeeded on Stripe!');

        // Confirm payment success on backend
        // Since we're using custom Stripe Elements (not Checkout), we need to notify our backend
        console.log('📤 Confirming payment on backend...');
        try {
          await this.paymentService.confirmPaymentSuccess(
            this.bookingId,
            paymentIntent.id,
            token
          ).toPromise();
          console.log('✅ Payment confirmed on backend successfully');
        } catch (backendError: any) {
          console.error('⚠️ Failed to confirm payment on backend:', backendError);
          // Show warning but don't fail - payment already succeeded on Stripe
          this.toastService.error(
            'Warning',
            'Payment succeeded but backend update failed. Contact support if needed.',
            5000
          );
        }

        this.currentStep = 'success';
        this.processing = false;
        this.cdr.markForCheck();

        this.toastService.success(
          'Payment Successful! 🎉',
          'Your payment has been processed successfully',
          4000
        );

        // Emit success after a short delay to show success animation
        setTimeout(() => {
          this.paymentSuccess.emit();
        }, 2000);
      } else if (paymentIntent.status === 'processing') {
        console.log('⏳ Payment is still processing...');
        this.errorMessage = 'Payment is being processed. Please wait...';
        this.cdr.markForCheck();

        // Wait a bit and check status again
        setTimeout(() => {
          this.checkPaymentStatus(this.clientSecret);
        }, 2000);
      } else if (paymentIntent.status === 'requires_action') {
        console.log('🔐 Payment requires additional action (3D Secure)');
        this.errorMessage = 'Please complete the additional security check';
        this.cdr.markForCheck();
        // Stripe will handle this automatically with handleActions: true
      } else {
        throw new Error(`Unexpected payment status: ${paymentIntent.status}`);
      }

    } catch (error: any) {
      console.error('❌ Payment error:', error);
      this.errorMessage = error.message || 'An unexpected error occurred during payment';
      this.currentStep = 'error';
      this.processing = false;
      this.cdr.markForCheck();

      this.toastService.error(
        'Payment Error',
        this.errorMessage,
        4000
      );
    }
  }

  /**
   * Check payment status if it's still processing
   */
  private async checkPaymentStatus(clientSecret: string) {
    if (!this.stripe) return;

    console.log('🔍 Checking payment status...');
    const { paymentIntent, error } = await this.stripe.retrievePaymentIntent(clientSecret);

    if (error) {
      console.error('❌ Error retrieving payment intent:', error);
      this.errorMessage = error.message || 'Could not verify payment status';
      this.currentStep = 'error';
      this.processing = false;
      this.cdr.markForCheck();
      return;
    }

    if (paymentIntent?.status === 'succeeded') {
      console.log('✅ Payment confirmed as succeeded!');
      this.currentStep = 'success';
      this.processing = false;
      this.cdr.markForCheck();

      this.toastService.success(
        'Payment Successful! 🎉',
        'Your payment has been processed successfully',
        4000
      );

      setTimeout(() => {
        this.paymentSuccess.emit();
      }, 2000);
    } else {
      console.log('⏳ Payment still processing with status:', paymentIntent?.status);
      this.errorMessage = `Payment status: ${paymentIntent?.status}`;
      this.cdr.markForCheck();
    }
  }

  /**
   * Go back to summary
   */
  backToSummary() {
    this.currentStep = 'summary';
    this.errorMessage = '';

    // Destroy card element properly
    if (this.cardElement) {
      try {
        this.cardElement.destroy();
      } catch (e) {
        console.warn('⚠️ Error destroying card element:', e);
      }
      this.cardElement = null;
    }

    this.cdr.markForCheck();
  }

  /**
   * Retry payment after error
   */
  retryPayment() {
    this.currentStep = 'payment';
    this.errorMessage = '';

    this.cdr.markForCheck();

    requestAnimationFrame(() => {
      this.initializeCardElement();
    });
  }

  /**
   * Cancel payment flow
   */
  cancel() {
    // Destroy card element when canceling
    if (this.cardElement) {
      try {
        this.cardElement.destroy();
      } catch (e) {
        console.warn('⚠️ Error destroying card element:', e);
      }
      this.cardElement = null;
    }

    this.paymentCancelled.emit();
  }

  /**
   * Format currency
   */
  formatCurrency(amount: number): string {
    return amount.toFixed(2);
  }

  /**
   * Format date
   */
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
