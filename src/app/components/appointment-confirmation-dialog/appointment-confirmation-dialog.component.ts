import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, Subscription, interval } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { SignalRNotificationService, AppointmentConfirmationNotification } from '../../services/signalr-notification.service';
import { BookingService } from '../../services/booking.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-appointment-confirmation-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './appointment-confirmation-dialog.component.html',
  styleUrls: ['./appointment-confirmation-dialog.component.css']
})
export class AppointmentConfirmationDialogComponent implements OnInit, OnDestroy {
  // Dialog visibility
  isVisible = false;

  // Current notification being displayed
  currentNotification: AppointmentConfirmationNotification | null = null;

  // Countdown timer
  remainingTime = '';
  isExpired = false;

  // Loading states
  isConfirming = false;
  isDeclining = false;

  // Queue for multiple notifications
  private notificationQueue: AppointmentConfirmationNotification[] = [];

  // Subscriptions
  private destroy$ = new Subject<void>();
  private timerSubscription?: Subscription;

  constructor(
    private signalRService: SignalRNotificationService,
    private bookingService: BookingService,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef
  ) {
    // Expose for testing via browser console
    (window as any).testAppointmentDialog = this.testDialog.bind(this);
  }

  ngOnInit(): void {
    console.log('🔔 AppointmentConfirmationDialogComponent initialized');
    console.log('💡 To test dialog, run in console: testAppointmentDialog(123)  (replace 123 with a booking ID)');

    // Subscribe to appointment confirmation notifications
    this.signalRService.appointmentConfirmationReceived
      .pipe(takeUntil(this.destroy$))
      .subscribe((notification) => {
        console.log('📬 Received appointment confirmation in dialog:', notification);
        this.handleIncomingNotification(notification);
      });
  }

  /**
   * Test method - can be called from browser console
   * Usage: testAppointmentDialog(123)
   */
  testDialog(bookingId: number = 999): void {
    console.log('🧪 Testing appointment confirmation dialog with bookingId:', bookingId);
    
    const testNotification: AppointmentConfirmationNotification = {
      notificationId: 999,
      bookingId: bookingId,
      message: 'TEST: Your appointment is ready. Please confirm your arrival.',
      title: 'Test Appointment Confirmation',
      confirmationDeadline: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes from now
      createdAt: new Date()
    };
    
    this.handleIncomingNotification(testNotification);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopTimer();
  }

  /**
   * Handle incoming notification
   */
  private handleIncomingNotification(notification: AppointmentConfirmationNotification): void {
    // Check if deadline has already passed
    const now = new Date();
    if (notification.confirmationDeadline < now) {
      console.log('⏰ Notification deadline already passed, ignoring');
      return;
    }

    // Add to queue
    this.notificationQueue.push(notification);

    // If no dialog is currently shown, show this one
    if (!this.isVisible) {
      this.showNextNotification();
    }
  }

  /**
   * Show the next notification in the queue
   */
  private showNextNotification(): void {
    if (this.notificationQueue.length === 0) {
      this.isVisible = false;
      this.currentNotification = null;
      this.cdr.detectChanges();
      return;
    }

    // Get next notification
    this.currentNotification = this.notificationQueue.shift()!;
    this.isVisible = true;
    this.isExpired = false;
    this.isConfirming = false;
    this.isDeclining = false;

    // Start countdown timer
    this.startTimer();

    console.log('🔔 Showing confirmation dialog for booking:', this.currentNotification.bookingId);
    this.cdr.detectChanges();
  }

  /**
   * Start the countdown timer
   */
  private startTimer(): void {
    this.stopTimer();

    // Update immediately
    this.updateRemainingTime();

    // Update every second
    this.timerSubscription = interval(1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.updateRemainingTime();
      });
  }

  /**
   * Stop the countdown timer
   */
  private stopTimer(): void {
    if (this.timerSubscription) {
      this.timerSubscription.unsubscribe();
      this.timerSubscription = undefined;
    }
  }

  /**
   * Update the remaining time display
   */
  private updateRemainingTime(): void {
    if (!this.currentNotification) return;

    const now = new Date();
    const deadline = new Date(this.currentNotification.confirmationDeadline);
    const diff = deadline.getTime() - now.getTime();

    if (diff <= 0) {
      this.remainingTime = 'Expired';
      this.isExpired = true;
      this.stopTimer();
      console.log('⏰ Confirmation deadline expired');
    } else {
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      this.remainingTime = `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
      console.log('🕐 Countdown:', this.remainingTime);
    }

    this.cdr.detectChanges();
  }

  /**
   * Confirm the appointment
   */
  confirmAppointment(): void {
    if (!this.currentNotification || this.isExpired || this.isConfirming || this.isDeclining) {
      return;
    }

    this.isConfirming = true;
    console.log('✔️ Confirming appointment:', this.currentNotification.bookingId);

    this.bookingService.confirmAppointment(this.currentNotification.bookingId, true)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('✔️ Appointment confirmed:', response);
          this.isConfirming = false;

          if (response.success) {
            this.toastService.success(
              'Appointment Confirmed',
              'Your arrival has been confirmed. Waiting for the other party to confirm.',
              5000
            );
          } else {
            this.toastService.warning(
              'Confirmation Issue',
              response.message || 'There was an issue confirming your appointment.',
              5000
            );
          }

          this.closeDialog();
        },
        error: (error) => {
          console.error('❌ Error confirming appointment:', error);
          this.isConfirming = false;

          const errorMessage = this.getErrorMessage(error);
          this.toastService.error(
            'Confirmation Failed',
            errorMessage,
            6000
          );
          this.cdr.detectChanges();
        }
      });
  }

  /**
   * Decline the appointment
   */
  declineAppointment(): void {
    if (!this.currentNotification || this.isExpired || this.isConfirming || this.isDeclining) {
      return;
    }

    this.isDeclining = true;
    console.log('❌ Declining appointment:', this.currentNotification.bookingId);

    this.bookingService.confirmAppointment(this.currentNotification.bookingId, false)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('❌ Appointment declined:', response);
          this.isDeclining = false;

          if (response.success) {
            this.toastService.info(
              'Appointment Declined',
              'The appointment has been marked as No Show.',
              5000
            );
          } else {
            this.toastService.warning(
              'Decline Issue',
              response.message || 'There was an issue declining your appointment.',
              5000
            );
          }

          this.closeDialog();
        },
        error: (error) => {
          console.error('❌ Error declining appointment:', error);
          this.isDeclining = false;

          const errorMessage = this.getErrorMessage(error);
          this.toastService.error(
            'Decline Failed',
            errorMessage,
            6000
          );
          this.cdr.detectChanges();
        }
      });
  }

  /**
   * Close the dialog and show next notification if any
   */
  closeDialog(): void {
    this.stopTimer();
    this.showNextNotification();
  }

  /**
   * Get user-friendly error message
   */
  private getErrorMessage(error: any): string {
    if (error?.error?.message) {
      return error.error.message;
    }

    if (error?.status === 401) {
      return 'You are not authorized to confirm this appointment.';
    }

    if (error?.status === 404) {
      return 'Booking not found.';
    }

    if (error?.status === 400) {
      return error?.error?.message || 'Invalid request. The booking may have already been processed.';
    }

    if (error?.status === 0) {
      return 'Unable to connect to the server. Please check your internet connection.';
    }

    return 'An unexpected error occurred. Please try again.';
  }
}
