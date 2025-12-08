import { Component, OnInit, OnDestroy, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { StarRatingComponent } from '../star-rating/star-rating.component';
import { ReviewService } from '../../services/review.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { ReviewSubmitDto, BookingDetails, WorkshopDetails } from '../../models/review.model';
import { trigger, state, style, transition, animate } from '@angular/animations';

@Component({
  selector: 'app-review-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, StarRatingComponent],
  templateUrl: './review-modal.component.html',
  styleUrls: ['./review-modal.component.css'],
  animations: [
    trigger('modalAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.95)' }),
        animate('200ms ease-out', style({ opacity: 1, transform: 'scale(1)' })),
      ]),
      transition(':leave', [
        animate('150ms ease-in', style({ opacity: 0, transform: 'scale(0.95)' })),
      ]),
    ]),
    trigger('backdropAnimation', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('200ms ease-out', style({ opacity: 1 })),
      ]),
      transition(':leave', [animate('150ms ease-in', style({ opacity: 0 }))]),
    ]),
    trigger('successAnimation', [
      state('hidden', style({ opacity: 0, transform: 'scale(0.5) translateY(20px)' })),
      state('visible', style({ opacity: 1, transform: 'scale(1) translateY(0)' })),
      transition('hidden => visible', [
        animate('500ms cubic-bezier(0.34, 1.56, 0.64, 1)'),
      ]),
    ]),
  ],
})
export class ReviewModalComponent implements OnInit, OnDestroy {
  @Input() bookingId!: number;
  @Output() close = new EventEmitter<void>();
  @Output() submitted = new EventEmitter<void>();

  private destroy$ = new Subject<void>();

  // Data
  booking: BookingDetails | null = null;
  workshop: WorkshopDetails | null = null;

  // Form fields
  rating: number = 0;
  comment: string = '';
  paidAmount: number = 0;
  maxCommentLength: number = 500;

  // UI States
  isLoading: boolean = false; // Start with false - show form immediately
  isSubmitting: boolean = false;
  loadError: string = '';
  submitError: string = '';
  hasSubmitted: boolean = false;

  // Validation
  showValidationErrors: boolean = false;

  constructor(
    private reviewService: ReviewService,
    private authService: AuthService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadData();
    this.preventBodyScroll();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.restoreBodyScroll();
  }

  /**
   * Load booking and workshop data in background (non-blocking)
   */
  private loadData(): void {
    if (!this.bookingId) {
      // Still allow the form to show even without bookingId
      console.warn('Review modal opened without bookingId');
      return;
    }

    // Create minimal booking object immediately so form can display
    this.booking = {
      id: this.bookingId,
      status: 'Completed',
      appointmentDate: new Date().toISOString(),
      paymentStatus: 'Paid',
      issueDescription: '',
      workShopProfileId: 0,
      carOwnerProfileId: 0,
      paidAmount: 0,
    } as BookingDetails;

    // Load actual booking details in background
    this.reviewService
      .getBookingById(this.bookingId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.booking = response.data;
            this.paidAmount = response.data.paidAmount || 0;

            // Fetch car owner profile ID from API
            this.loadCarOwnerProfile(this.bookingId);

            // Load workshop details
            this.loadWorkshopDetails(response.data.workShopProfileId);
          }
        },
        error: (error) => {
          console.error('Error loading booking:', error);
          // Don't show error - form is already visible and functional
        },
      });
  }

  /**
   * Load car owner profile to get carOwnerProfileId
   */
  private loadCarOwnerProfile(bookingId: number): void {
    this.reviewService
      .getCarOwnerProfileByBooking(bookingId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response && response.success && response.data && response.data.id) {
            // Store the carOwnerProfileId in the booking object
            if (this.booking) {
              this.booking.carOwnerProfileId = response.data.id;
              console.log('✅ Car owner profile ID loaded:', response.data.id);
            }
          } else {
            console.warn('⚠️ Car owner profile response invalid:', response);
          }
        },
        error: (error) => {
          console.error('❌ Error loading car owner profile:', error);
          // Don't fail the entire modal load if this fails
        },
      });
  }

  /**
   * Load workshop details
   */
  private loadWorkshopDetails(workshopId: number): void {
    this.reviewService
      .getWorkshopById(workshopId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.workshop = response.data;
          }
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading workshop:', error);
          // Don't show error for workshop details, just continue without it
          this.isLoading = false;
        },
      });
  }

  /**
   * Validate form
   */
  private validateForm(): boolean {
    if (this.rating === 0) {
      return false;
    }
    if (!this.comment || this.comment.trim().length === 0) {
      return false;
    }
    if (this.comment.length > this.maxCommentLength) {
      return false;
    }
    if (this.paidAmount < 0) {
      return false;
    }
    return true;
  }

  /**
   * Get form validation errors
   */
  getValidationErrors(): string[] {
    const errors: string[] = [];

    if (this.rating === 0) {
      errors.push('Please select a rating');
    }
    if (!this.comment || this.comment.trim().length === 0) {
      errors.push('Please enter your feedback');
    }
    if (this.comment.length > this.maxCommentLength) {
      errors.push(`Comment must be less than ${this.maxCommentLength} characters`);
    }
    if (this.paidAmount < 0) {
      errors.push('Paid amount cannot be negative');
    }

    return errors;
  }

  /**
   * Handle rating change
   */
  onRatingChange(newRating: number): void {
    this.rating = newRating;
    this.showValidationErrors = false;
  }

  /**
   * Handle comment input
   */
  onCommentInput(): void {
    this.showValidationErrors = false;
  }

  /**
   * Get remaining characters for comment
   */
  getRemainingCharacters(): number {
    return this.maxCommentLength - this.comment.length;
  }

  /**
   * Submit review
   */
  submitReview(): void {
    this.showValidationErrors = true;

    if (!this.validateForm()) {
      this.toastService.error('Validation Error', 'Please fill in all required fields correctly');
      return;
    }

    if (this.hasSubmitted) {
      this.toastService.warning('Already Submitted', 'You have already submitted this review');
      return;
    }

    if (!this.booking) {
      this.toastService.error('Error', 'Booking information not available');
      return;
    }

    // Get carOwnerProfileId from booking data (loaded from API)
    const carOwnerProfileId = this.booking.carOwnerProfileId;

    if (!carOwnerProfileId) {
      this.toastService.error('Error', 'Car owner profile ID not found. Please try again.');
      console.error('Booking data:', this.booking);
      return;
    }

    this.isSubmitting = true;
    this.submitError = '';

    const reviewData: ReviewSubmitDto = {
      rating: this.rating,
      comment: this.comment.trim(),
      paidAmount: this.paidAmount,
      createdAt: new Date().toISOString(),
      bookingId: this.booking.id,
      carOwnerProfileId: carOwnerProfileId,
      workShopProfileId: this.booking.workShopProfileId,
    };

    console.log('📝 Submitting review with data:', reviewData);

    this.reviewService
      .createReview(reviewData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.isSubmitting = false;
          if (response.success) {
            this.hasSubmitted = true;
            this.toastService.success('Review Submitted', 'Thank you for your feedback!', 5000);
            this.submitted.emit();

            // Close modal after brief delay to show success message
            setTimeout(() => {
              this.forceCloseModal();
            }, 500);
          } else {
            // Handle success: false responses from backend
            const responseMessage = response.message || '';
            const isAlreadyExists =
              responseMessage.toLowerCase().includes('already') ||
              responseMessage.toLowerCase().includes('review');

            if (isAlreadyExists) {
              // Show error message that review was already submitted
              this.toastService.error(
                'Review Already Exists',
                'You have already submitted a review for this booking.',
                5000
              );
              // Close the modal since review already exists
              setTimeout(() => {
                this.forceCloseModal();
              }, 500);
            } else {
              this.submitError = responseMessage || 'Failed to submit review';
              this.toastService.error('Submission Failed', this.submitError);
            }
          }
        },
        error: (error) => {
          console.error('Error submitting review:', error);
          this.isSubmitting = false;

          // Check if review already exists for this booking
          const errorMessage = error.error?.message || error.message || '';
          const isAlreadyExists =
            errorMessage.toLowerCase().includes('already') ||
            errorMessage.toLowerCase().includes('review') ||
            errorMessage.toLowerCase().includes('duplicate');

          if (isAlreadyExists) {
            // Show error message that review was already submitted
            this.toastService.error(
              'Review Already Exists',
              'You have already submitted a review for this booking.',
              5000
            );
            // Close the modal since review already exists
            setTimeout(() => {
              this.forceCloseModal();
            }, 500);
          } else {
            this.submitError = errorMessage || 'Failed to submit review. Please try again.';
            this.toastService.error('Submission Failed', this.submitError);
          }
        },
      });
  }

  /**
   * Close modal
   */
  closeModal(): void {
    if (!this.isSubmitting) {
      this.close.emit();
    }
  }

  /**
   * Force close modal (used after API responses)
   */
  forceCloseModal(): void {
    this.isSubmitting = false;
    this.close.emit();
  }

  /**
   * Handle backdrop click
   */
  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closeModal();
    }
  }

  /**
   * Prevent body scroll when modal is open
   */
  private preventBodyScroll(): void {
    document.body.style.overflow = 'hidden';
  }

  /**
   * Restore body scroll when modal is closed
   */
  private restoreBodyScroll(): void {
    document.body.style.overflow = '';
  }

  /**
   * Format date for display
   */
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * Get status badge class
   */
  getStatusClass(status: string): string {
    const statusLower = status.toLowerCase();
    if (statusLower === 'completed') return 'status-completed';
    if (statusLower === 'confirmed') return 'status-confirmed';
    if (statusLower === 'pending') return 'status-pending';
    if (statusLower === 'cancelled') return 'status-cancelled';
    return 'status-default';
  }

  /**
   * Get payment status badge class
   */
  getPaymentStatusClass(status: string): string {
    const statusLower = status.toLowerCase();
    if (statusLower === 'paid') return 'payment-paid';
    if (statusLower === 'unpaid') return 'payment-unpaid';
    if (statusLower === 'partial') return 'payment-partial';
    return 'payment-default';
  }
}
