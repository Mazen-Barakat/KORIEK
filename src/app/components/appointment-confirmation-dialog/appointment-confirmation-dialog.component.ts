import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, Subscription, interval } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { SignalRNotificationService } from '../../services/signalr-notification.service';
import { AppointmentConfirmationNotification } from '../../models/notification.model';
import { BookingService } from '../../services/booking.service';
import { ToastService } from '../../services/toast.service';
import { AuthService } from '../../services/auth.service';
import { CarsService } from '../../services/cars.service';
import { WorkshopProfileService } from '../../services/workshop-profile.service';
import { NotificationService } from '../../services/notification.service';

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

  // Countdown timer - NEVER RESETS
  remainingTime = '';
  isExpired = false;

  // Loading states
  isConfirming = false;

  // Confirmation status tracking
  carOwnerConfirmed = false;
  workshopConfirmed = false;
  userRole: string = '';
  hasCurrentUserConfirmed = false;

  // Booking details for display
  bookingDetails: {
    carOwnerFullName: string;
    carName: string;
    serviceName: string;
    isLoading: boolean;
  } = {
    carOwnerFullName: '',
    carName: '',
    serviceName: '',
    isLoading: false
  };

  // Active confirmation tracking - stores booking IDs with their deadline
  private activeConfirmations = new Map<number, Date>();

  // Track which bookings we've already shown dialogs for (to avoid duplicates)
  private shownBookingIds = new Set<number>();

  // Subscriptions
  private destroy$ = new Subject<void>();
  private timerSubscription?: Subscription;
  private bookingCheckSubscription?: Subscription;

  constructor(
    private signalRService: SignalRNotificationService,
    private bookingService: BookingService,
    private notificationService: NotificationService,
    private toastService: ToastService,
    private authService: AuthService,
    private carsService: CarsService,
    private workshopProfileService: WorkshopProfileService,
    private cdr: ChangeDetectorRef
  ) {
    // Expose for testing and external access via browser console
    (window as any).testAppointmentDialog = this.testDialog.bind(this);
    (window as any).reopenAppointmentDialog = this.reopenConfirmationDialog.bind(this);
  }

  ngOnInit(): void {
    console.log('🔔 AppointmentConfirmationDialogComponent initialized');
    console.log('💡 To test dialog, run in console: testAppointmentDialog(123)  (replace 123 with a booking ID)');
    console.log('💡 To reopen dialog, run: reopenAppointmentDialog(notificationId, bookingId)');

    // Get current user role
    this.userRole = this.authService.getUserRole() || '';

    // Subscribe to appointment confirmation notifications from SignalR (ReceiveNotification)
    this.signalRService.appointmentConfirmationReceived
      .pipe(takeUntil(this.destroy$))
      .subscribe((notification) => {
        console.log('📬 Received appointment confirmation in dialog:', notification);
        this.handleIncomingNotification(notification);
      });

    // Subscribe to confirmation status updates from SignalR (ConfirmationStatusUpdate)
    this.signalRService.confirmationStatusUpdate
      .pipe(takeUntil(this.destroy$))
      .subscribe((update) => {
        console.log('📊 Received confirmation status update:', update);
        this.handleConfirmationStatusUpdate(update);
      });

    // Check for pending confirmations on page load (handles page refresh)
    this.checkPendingConfirmationsOnLoad();

    // Start periodic check for bookings that are due now
    this.startBookingCheck();

    // Start periodic cleanup of expired confirmations (every 30 seconds)
    interval(30000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.cleanupExpiredConfirmations();
      });

    // Start periodic cleanup in notification service
    this.notificationService.startPeriodicCleanup();
  }

  /**
   * Check for pending confirmations on page load
   * Calls backend API to get any active confirmation notifications
   * This handles page refresh scenarios where user had an open confirmation dialog
   */
  private checkPendingConfirmationsOnLoad(): void {
    if (!this.authService.isAuthenticated()) {
      return;
    }

    console.log('🔍 Checking for pending confirmations on page load...');

    this.notificationService.getPendingConfirmations()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (pendingConfirmations: any[]) => {
          if (!pendingConfirmations || pendingConfirmations.length === 0) {
            console.log('✅ No pending confirmations found');
            return;
          }

          console.log(`📋 Found ${pendingConfirmations.length} pending confirmation(s)`);

          // Show dialogs for all pending confirmations that can still be confirmed
          pendingConfirmations.forEach((confirmation) => {
            if (confirmation.canStillConfirm && confirmation.remainingSeconds > 0) {
              console.log(`🔔 Restoring confirmation dialog for booking ${confirmation.bookingId}`);
              
              // Calculate deadline from remainingSeconds
              const deadline = new Date(Date.now() + (confirmation.remainingSeconds * 1000));
              
              // Create notification object to display
              const notification: AppointmentConfirmationNotification = {
                notificationId: confirmation.notificationId,
                bookingId: confirmation.bookingId,
                message: confirmation.message || 'Please confirm your arrival for the appointment',
                title: confirmation.title || 'Appointment Confirmation',
                confirmationDeadline: deadline,
                createdAt: confirmation.notificationCreatedAt ? new Date(confirmation.notificationCreatedAt) : new Date(),
                bookingDetails: {
                  customerName: confirmation.carOwnerName,
                  workshopName: confirmation.workshopName,
                  serviceName: confirmation.serviceName,
                  appointmentDate: confirmation.appointmentDate ? new Date(confirmation.appointmentDate) : undefined,
                  issueDescription: confirmation.issueDescription
                }
              };

              // Mark as active and show dialog
              this.activeConfirmations.set(confirmation.bookingId, deadline);
              this.shownBookingIds.add(confirmation.bookingId);
              this.showConfirmationDialog(notification);
            }
          });
        },
        error: (err) => {
          console.error('❌ Error fetching pending confirmations:', err);
        }
      });
  }

  /**
   * Start periodic check for bookings due now (every 30 seconds)
   */
  private startBookingCheck(): void {
    // Check immediately on load (after pending confirmations check)
    setTimeout(() => this.checkForDueBookings(), 3000);

    // Then check every 30 seconds
    this.bookingCheckSubscription = interval(30000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.checkForDueBookings();
      });
  }

  /**
   * Check for bookings that are due now and need confirmation
   */
  private checkForDueBookings(): void {
    if (!this.authService.isAuthenticated()) {
      return;
    }

    const userRole = this.authService.getUserRole();
    console.log('🔍 Checking for due bookings... (role:', userRole, ')');

    if (userRole === 'WORKSHOP' || userRole === 'Workshop') {
      this.checkWorkshopBookings();
    } else {
      this.checkCarOwnerBookings();
    }
  }

  /**
   * Check workshop bookings for due appointments
   */
  private checkWorkshopBookings(): void {
    // Use the workshop profile service to get the workshop ID first
    this.workshopProfileService.getMyWorkshopProfile()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          const data = response?.data ?? response;
          if (data && data.id) {
            const workshopId = Number(data.id);
            console.log('📍 Workshop ID loaded:', workshopId);
            
            // Now fetch bookings for this workshop
            this.bookingService.getBookingsByWorkshop(workshopId)
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: (bookingsResponse: any) => {
                  const bookings = bookingsResponse || [];
                  console.log('📋 Workshop bookings loaded:', bookings.length);
                  this.processBookingsForConfirmation(bookings, 'workshop');
                },
                error: (err) => {
                  console.error('Error fetching workshop bookings:', err);
                }
              });
          } else {
            console.log('No workshop ID found in profile response');
          }
        },
        error: (err) => {
          console.error('Error loading workshop profile:', err);
        }
      });
  }

  /**
   * Check car owner bookings for due appointments
   */
  private checkCarOwnerBookings(): void {
    // Use the cars service to get profile with cars
    this.carsService.getProfileWithCars()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          if (response?.success && response.data) {
            const cars = response.data.cars || [];
            console.log('🚗 Cars loaded:', cars.length);
            
            // Fetch bookings for each car using the query-string endpoint (avoids 404)
            for (const car of cars) {
              const url = `${this.bookingService.apiUrl}/Booking/ByCar?CarId=${car.id}&PageNumber=1&PageSize=50`;
              this.bookingService.http.get<any>(url)
                .pipe(takeUntil(this.destroy$))
                .subscribe({
                  next: (bookingsResponse: any) => {
                    // Support both paginated (data.items) and flat data arrays
                    const bookings = bookingsResponse?.data?.items || bookingsResponse?.data || bookingsResponse || [];
                    console.log(`📋 Bookings for car ${car.id}:`, Array.isArray(bookings) ? bookings.length : 0);
                    if (Array.isArray(bookings)) {
                      this.processBookingsForConfirmation(bookings, 'carOwner');
                    }
                  },
                  error: (err) => {
                    console.error(`Error fetching bookings for car ${car.id}:`, err);
                  }
                });
            }
          } else {
            console.log('No cars found in profile response');
          }
        },
        error: (err) => {
          console.error('Error loading car owner profile:', err);
        }
      });
  }

  /**
   * Process bookings and show confirmation dialog for those that are due now
   */
  private processBookingsForConfirmation(bookings: any[], userType: 'workshop' | 'carOwner'): void {
    const now = new Date();
    
    for (const booking of bookings) {
      // Only process Confirmed bookings
      if (booking.status !== 'Confirmed') {
        continue;
      }

      // Skip if we've already shown a dialog for this booking
      if (this.shownBookingIds.has(booking.id)) {
        continue;
      }

      const appointmentDate = new Date(booking.appointmentDate);
      
      // Calculate time difference to appointment (remaining time)
      const diffMinutes = (appointmentDate.getTime() - now.getTime()) / (1000 * 60);
      
      // Only show dialog if remaining time to appointment is less than 0.5 minutes (30 seconds)
      if (diffMinutes < 0.5 && diffMinutes >= 0) {
        console.log(`🔔 Found due booking ${booking.id} at ${appointmentDate.toISOString()}, remaining time: ${diffMinutes.toFixed(2)} minutes`);
        
        // Mark as shown to avoid duplicates
        this.shownBookingIds.add(booking.id);
        
        // Calculate confirmation deadline (15 minutes from appointment time)
        const confirmationDeadline = new Date(appointmentDate.getTime() + 15 * 60 * 1000);
        
        // Create notification
        const notification: AppointmentConfirmationNotification = {
          notificationId: 0,
          bookingId: booking.id,
          message: userType === 'workshop' 
            ? `Appointment is due now. Please confirm you're ready to start the service.`
            : `Your appointment is due now. Please confirm your arrival.`,
          title: 'Confirm Your Appointment',
          confirmationDeadline: confirmationDeadline,
          createdAt: now
        };
        
        this.handleIncomingNotification(notification);
      }
    }
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
    if (this.bookingCheckSubscription) {
      this.bookingCheckSubscription.unsubscribe();
    }
  }

  /**
   * Handle incoming notification from SignalR
   */
  private handleIncomingNotification(notification: AppointmentConfirmationNotification): void {
    const now = new Date();
    
    // Check if deadline has already passed
    if (notification.confirmationDeadline < now) {
      console.log('⏰ Notification deadline already passed, ignoring');
      return;
    }

    // Check if we already have an active confirmation for this booking
    if (this.activeConfirmations.has(notification.bookingId)) {
      console.log('ℹ️ Confirmation already active for booking:', notification.bookingId);
      return;
    }

    // Check booking status before showing dialog
    this.bookingService.getBookingById(notification.bookingId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (booking: any) => {
          const bookingData = booking?.data || booking;
          
          // Only show dialog if booking status is "Confirmed"
          if (bookingData.status !== 'Confirmed') {
            console.log('⚠️ Booking status is not Confirmed:', bookingData.status, '- Not showing dialog');
            return;
          }
          
          // Status is Confirmed, proceed to check for pending notification
          this.checkForPendingNotification(notification);
        },
        error: (err: any) => {
          console.error('❌ Error checking booking status:', err);
          // Don't show dialog if we can't verify status
        }
      });
  }

  /**
   * Handle confirmation status update from SignalR
   */
  private handleConfirmationStatusUpdate(update: any): void {
    const bookingId = update.bookingId;
    
    // Check if this update is for the currently displayed notification
    if (this.currentNotification?.bookingId === bookingId && this.isVisible) {
      if (update.shouldDismissDialog) {
        console.log('✅ Dismissing dialog - booking confirmed or expired');
        console.log('🔄 Resetting confirmation status values:', {
          carOwnerConfirmed: this.carOwnerConfirmed,
          workshopConfirmed: this.workshopConfirmed,
          hasCurrentUserConfirmed: this.hasCurrentUserConfirmed
        });
        
        // Close the dialog
        this.activeConfirmations.delete(bookingId);
        this.stopTimer();
        this.isVisible = false;
        this.currentNotification = null;
        
        // Reset confirmation status for next booking (InProgress)
        this.carOwnerConfirmed = false;
        this.workshopConfirmed = false;
        this.hasCurrentUserConfirmed = false;
        
        console.log('✅ Confirmation status reset to:', {
          carOwnerConfirmed: this.carOwnerConfirmed,
          workshopConfirmed: this.workshopConfirmed,
          hasCurrentUserConfirmed: this.hasCurrentUserConfirmed
        });
        
        this.cdr.detectChanges();
      } else {
        console.log('🔄 Updating dialog state with other party response');
        
        // Update the confirmation status
        this.carOwnerConfirmed = update.carOwnerConfirmed || false;
        this.workshopConfirmed = update.workshopConfirmed || false;
        
        // Update current user confirmation status
        if (this.userRole === 'WORKSHOP' || this.userRole === 'Workshop') {
          this.hasCurrentUserConfirmed = this.workshopConfirmed;
        } else {
          this.hasCurrentUserConfirmed = this.carOwnerConfirmed;
        }
        
        this.cdr.detectChanges();
      }
    }
  }

  /**
   * Check for pending notification in API before showing dialog
   */
  private checkForPendingNotification(notification: AppointmentConfirmationNotification): void {
    // Check if there's already a pending appointment confirmation notification for this booking
    this.notificationService.getNotifications()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (notifications: any[]) => {
          // Look for existing appointment confirmation notification for this booking
          const existingNotification = notifications.find((n: any) => 
            n.notificationType === 13 && // Appointment confirmation type
            n.bookingId === notification.bookingId &&
            !n.isRead
          );

          if (existingNotification) {
            console.log('ℹ️ Pending notification already exists for booking:', notification.bookingId, '- Skipping dialog');
            // Store the deadline but don't show dialog
            this.activeConfirmations.set(notification.bookingId, notification.confirmationDeadline);
            return;
          }

          // No pending notification found, proceed to show dialog
          console.log('✅ No pending notification found, showing dialog for booking:', notification.bookingId);
          this.activeConfirmations.set(notification.bookingId, notification.confirmationDeadline);
          this.showConfirmationDialog(notification);
        },
        error: (err) => {
          console.error('Error checking for pending notifications:', err);
          // On error, proceed to show dialog to avoid blocking user
          this.activeConfirmations.set(notification.bookingId, notification.confirmationDeadline);
          this.showConfirmationDialog(notification);
        }
      });
  }

  /**
   * Fetch booking details from backend endpoints
   */
  private fetchBookingDetails(bookingId: number): void {
    this.bookingDetails.isLoading = true;
    this.bookingDetails.carOwnerFullName = '';
    this.bookingDetails.carName = '';
    this.bookingDetails.serviceName = '';
    this.cdr.detectChanges();

    // Fetch the booking to get workshopServiceId and carId
    this.bookingService.getBookingById(bookingId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (bookingResponse: any) => {
          const booking = bookingResponse?.data || bookingResponse;
          const workshopServiceId = booking?.workshopServiceId;
          const bookingCarId = booking?.carId;

          console.log('📦 Booking data loaded:', booking);

          // Fetch car owner profile
          this.bookingService.getCarOwnerProfileByBooking(bookingId)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (carOwner: any) => {
                if (carOwner) {
                  const firstName = carOwner.firstName || '';
                  const lastName = carOwner.lastName || '';
                  this.bookingDetails.carOwnerFullName = `${firstName} ${lastName}`.trim() || 'Unknown';
                  console.log('👤 Car Owner:', this.bookingDetails.carOwnerFullName);
                  this.cdr.detectChanges();
                }
              },
              error: (err) => {
                console.error('Error fetching car owner:', err);
                this.bookingDetails.carOwnerFullName = 'Unknown';
                this.cdr.detectChanges();
              }
            });

          // Fetch car details
          if (bookingCarId) {
            this.carsService.getCarById(bookingCarId)
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: (carResponse: any) => {
                  const car = carResponse?.data || carResponse;
                  if (car) {
                    this.bookingDetails.carName = `${car.year || ''} ${car.make || ''} ${car.model || ''}`.trim() || 'Unknown Car';
                    console.log('🚗 Car:', this.bookingDetails.carName);
                    this.cdr.detectChanges();
                  }
                },
                error: (err) => {
                  console.error('Error fetching car:', err);
                  this.bookingDetails.carName = 'Unknown Car';
                  this.cdr.detectChanges();
                }
              });
          }

          // Fetch workshop service to get serviceId
          if (workshopServiceId) {
            this.bookingService.getWorkshopServiceById(workshopServiceId)
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: (workshopService: any) => {
                  const serviceId = workshopService?.serviceId;
                  if (serviceId) {
                    // Fetch the actual service name
                    this.bookingService.getServiceById(serviceId)
                      .pipe(takeUntil(this.destroy$))
                      .subscribe({
                        next: (service: any) => {
                          if (service) {
                            this.bookingDetails.serviceName = service.name || 'Unknown Service';
                            console.log('🔧 Service:', this.bookingDetails.serviceName);
                            this.bookingDetails.isLoading = false;
                            this.cdr.detectChanges();
                          }
                        },
                        error: (err) => {
                          console.error('Error fetching service:', err);
                          this.bookingDetails.serviceName = 'Unknown Service';
                          this.bookingDetails.isLoading = false;
                          this.cdr.detectChanges();
                        }
                      });
                  } else {
                    this.bookingDetails.serviceName = workshopService?.name || 'Unknown Service';
                    this.bookingDetails.isLoading = false;
                    this.cdr.detectChanges();
                  }
                },
                error: (err) => {
                  console.error('Error fetching workshop service:', err);
                  this.bookingDetails.serviceName = 'Unknown Service';
                  this.bookingDetails.isLoading = false;
                  this.cdr.detectChanges();
                }
              });
          } else {
            this.bookingDetails.isLoading = false;
            this.cdr.detectChanges();
          }
        },
        error: (err) => {
          console.error('Error fetching booking:', err);
          this.bookingDetails.carOwnerFullName = 'Unknown';
          this.bookingDetails.carName = 'Unknown Car';
          this.bookingDetails.serviceName = 'Unknown Service';
          this.bookingDetails.isLoading = false;
          this.cdr.detectChanges();
        }
      });
  }

  /**
   * Show the confirmation dialog
   */
  public showConfirmationDialog(notification: AppointmentConfirmationNotification): void {
    this.currentNotification = notification;
    this.isVisible = true;
    this.isExpired = false;
    this.isConfirming = false;
    
    // Reset confirmation status for the new booking
    this.carOwnerConfirmed = false;
    this.workshopConfirmed = false;
    this.hasCurrentUserConfirmed = false;

    // Fetch booking details for display
    this.fetchBookingDetails(notification.bookingId);

    // Check confirmation status from backend
    this.checkConfirmationStatus(notification.bookingId);

    // Start countdown timer that NEVER resets
    this.startTimer();

    console.log('🔔 Showing confirmation dialog for booking:', notification.bookingId);
    this.cdr.detectChanges();
  }

  /**
   * Reopen confirmation dialog from notification panel
   * Fetches notification details from API and checks if confirmation is still possible
   * @param notificationId The notification ID from the backend
   * @param bookingId The booking ID (for backward compatibility, now fetched from API)
   */
  public reopenConfirmationDialog(notificationId: number, bookingId?: number): void {
    // Check if already showing this booking
    if (bookingId && this.currentNotification?.bookingId === bookingId && this.isVisible) {
      console.log('ℹ️ Dialog already showing for this booking');
      return;
    }
    
    // Allow reopening from notification panel even if previously shown
    // Remove from shownBookingIds to allow reopening
    if (bookingId) {
      this.shownBookingIds.delete(bookingId);
    }

    console.log(`📡 Fetching notification details for notification ${notificationId}...`);

    // Fetch notification details from API to check canStillConfirm and get remainingSeconds
    this.notificationService.getNotificationDetails(notificationId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (details: any) => {
          console.log('📥 Notification details received:', details);
          
          if (!details.canStillConfirm) {
            console.log('⏰ Cannot confirm - deadline passed or already confirmed');
            this.toastService.warning(
              'Cannot Confirm',
              'This appointment can no longer be confirmed.',
              4000
            );
            return;
          }
          
          // Check if booking is InProgress (both confirmations null)
          if (details.bookingStatus === 'InProgress' || 
              (details.carOwnerConfirmed === null && details.workshopOwnerConfirmed === null)) {
            console.log('⚠️ Booking is already InProgress - not showing dialog');
            this.toastService.info(
              'Appointment In Progress',
              'This appointment has already started.',
              4000
            );
            return;
          }

          // Calculate deadline from remainingSeconds (backend-provided)
          const deadline = new Date(Date.now() + (details.remainingSeconds * 1000));
          
          console.log(`🔄 Reopening dialog for booking ${details.bookingId} with ${details.remainingSeconds}s remaining`);

          // Create notification object to display with preserved timer
          const notification: AppointmentConfirmationNotification = {
            notificationId: details.notificationId || notificationId,
            bookingId: details.bookingId,
            message: details.message || 'Please confirm your arrival for the appointment',
            title: details.title || 'Appointment Confirmation Required',
            confirmationDeadline: deadline,
            createdAt: details.notificationCreatedAt ? new Date(details.notificationCreatedAt) : new Date(),
            bookingDetails: details.bookingDetails || {
              customerName: details.carOwnerName,
              workshopName: details.workshopName,
              serviceName: details.serviceName,
              appointmentDate: details.appointmentDate ? new Date(details.appointmentDate) : undefined,
              issueDescription: details.issueDescription
            }
          };

          // Show the dialog with the preserved countdown timer
          this.showConfirmationDialog(notification);
        },
        error: (err) => {
          console.error('Error fetching notification details:', err);
          this.toastService.error(
            'Error',
            'Failed to load notification details.',
            4000
          );
        }
      });
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
   * Timer NEVER RESETS - it continues from the original deadline
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
      
      // Remove from active confirmations
      this.activeConfirmations.delete(this.currentNotification.bookingId);
      
      console.log('⏰ Confirmation deadline expired for booking:', this.currentNotification.bookingId);
      
      // Check if both parties confirmed - if not, mark as NoShow
      this.handleExpiredConfirmation(this.currentNotification.bookingId);
      
      // Close the dialog after showing expired message
      setTimeout(() => {
        this.isVisible = false;
        this.currentNotification = null;
        this.cdr.detectChanges();
      }, 3000); // Give user time to see "Expired" message
    } else {
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      this.remainingTime = `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
    }

    this.cdr.detectChanges();
  }

  /**
   * Handle expired confirmation - check if both parties confirmed and update to NoShow if needed
   */
  private handleExpiredConfirmation(bookingId: number): void {
    console.log('🔍 Checking confirmation status for expired booking:', bookingId);
    
    this.bookingService.getBookingConfirmationStatus(bookingId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            const { carOwnerConfirmed, workshopConfirmed, bothConfirmed } = response.data;
            
            // If not both confirmed, update status to NoShow
            if (!bothConfirmed) {
              console.log('❌ Not all parties confirmed. Updating booking status to NoShow...');
              console.log(`   Car Owner: ${carOwnerConfirmed ? '✅' : '❌'} | Workshop: ${workshopConfirmed ? '✅' : '❌'}`);
              
              this.bookingService.updateBookingStatus(bookingId, 'NoShow')
                .pipe(takeUntil(this.destroy$))
                .subscribe({
                  next: (updateResponse) => {
                    console.log('✅ Booking status updated to NoShow:', updateResponse);
                    this.toastService.warning(
                      'Appointment Missed',
                      'The booking has been marked as No-Show due to incomplete confirmation.',
                      5000
                    );
                  },
                  error: (err) => {
                    console.error('❌ Error updating booking status to NoShow:', err);
                    this.toastService.error(
                      'Update Failed',
                      'Failed to update booking status.',
                      4000
                    );
                  }
                });
            } else {
              console.log('✅ Both parties confirmed. No status update needed.');
            }
          }
        },
        error: (err) => {
          console.error('❌ Error checking confirmation status:', err);
        }
      });
  }

  /**
   * Check confirmation status for a booking
   */
  private checkConfirmationStatus(bookingId: number): void {
    this.bookingService.getBookingConfirmationStatus(bookingId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            // Use false as default for null values (don't treat null as InProgress here)
            this.carOwnerConfirmed = response.data.carOwnerConfirmed ?? false;
            this.workshopConfirmed = response.data.workshopConfirmed ?? false;
            
            // Check if current user has already confirmed
            if (this.userRole === 'WORKSHOP' || this.userRole === 'Workshop') {
              this.hasCurrentUserConfirmed = this.workshopConfirmed;
            } else {
              this.hasCurrentUserConfirmed = this.carOwnerConfirmed;
            }
            
            console.log('📊 Confirmation status:', {
              carOwnerConfirmed: this.carOwnerConfirmed,
              workshopConfirmed: this.workshopConfirmed,
              hasCurrentUserConfirmed: this.hasCurrentUserConfirmed
            });
            
            this.cdr.detectChanges();
          }
        },
        error: (err) => {
          console.error('Error fetching confirmation status:', err);
        }
      });
  }

  /**
   * Clean up expired confirmations periodically
   */
  private cleanupExpiredConfirmations(): void {
    const now = new Date();
    const expired: number[] = [];
    
    this.activeConfirmations.forEach((deadline, bookingId) => {
      if (deadline < now) {
        expired.push(bookingId);
      }
    });

    expired.forEach(bookingId => {
      this.activeConfirmations.delete(bookingId);
      console.log('🗑️ Removed expired confirmation for booking:', bookingId);
    });
  }

  /**
   * Confirm the appointment
   */
  confirmAppointment(): void {
    if (!this.currentNotification || this.isExpired || this.isConfirming || this.hasCurrentUserConfirmed) {
      return;
    }

    this.isConfirming = true;
    const bookingId = this.currentNotification.bookingId;
    const confirmationDeadline = this.currentNotification.confirmationDeadline;
    const confirmationSentAt = this.currentNotification.createdAt;
    
    console.log('✔️ Confirming appointment:', bookingId);
    console.log('📅 Confirmation deadline:', confirmationDeadline);
    console.log('📅 Confirmation sent at:', confirmationSentAt);

    this.bookingService.confirmAppointment(bookingId, true, confirmationDeadline, confirmationSentAt)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('✔️ Appointment confirmed:', response);
          this.isConfirming = false;

          if (response.success) {
            // Mark current user as confirmed
            this.hasCurrentUserConfirmed = true;
            
            // Update local confirmation status
            if (this.userRole === 'WORKSHOP' || this.userRole === 'Workshop') {
              this.workshopConfirmed = true;
            } else {
              this.carOwnerConfirmed = true;
            }

            // Only close dialog if BOTH parties have confirmed (explicitly true)
            const bothConfirmed = this.carOwnerConfirmed === true && this.workshopConfirmed === true;
            
            if (bothConfirmed) {
              console.log('✅ Both parties confirmed - Booking status now InProgress');
              console.log('🔄 Closing dialog as both parties confirmed:', {
                carOwnerConfirmed: this.carOwnerConfirmed,
                workshopConfirmed: this.workshopConfirmed,
                hasCurrentUserConfirmed: this.hasCurrentUserConfirmed
              });
              
              this.toastService.success(
                'Appointment Started',
                'Both parties confirmed! The appointment is now in progress.',
                5000
              );
              
              // Remove from active confirmations and close dialog
              this.activeConfirmations.delete(bookingId);
              this.stopTimer();
              this.isVisible = false;
              this.currentNotification = null;
              
              // Reset confirmation status for next booking (InProgress)
              this.carOwnerConfirmed = false;
              this.workshopConfirmed = false;
              this.hasCurrentUserConfirmed = false;
              
              console.log('✅ Confirmation status reset to:', {
                carOwnerConfirmed: this.carOwnerConfirmed,
                workshopConfirmed: this.workshopConfirmed,
                hasCurrentUserConfirmed: this.hasCurrentUserConfirmed
              });
            } else {
              this.toastService.success(
                'Confirmation Received',
                'Your confirmation has been recorded. Waiting for the other party to confirm.',
                5000
              );
              
              // Keep dialog open to show status, but disable confirm button
              this.cdr.detectChanges();
              
              // Start polling for other party's confirmation
              this.startPollingConfirmationStatus(bookingId);
            }
          } else {
            this.toastService.warning(
              'Confirmation Issue',
              response.message || 'There was an issue confirming your appointment.',
              5000
            );
          }
          
          this.cdr.detectChanges();
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
   * Start polling confirmation status to detect when other party confirms
   */
  private startPollingConfirmationStatus(bookingId: number): void {
    // Poll every 3 seconds for up to 5 minutes
    interval(3000)
      .pipe(
        takeUntil(this.destroy$),
        takeUntil(interval(5 * 60 * 1000)) // Stop after 5 minutes
      )
      .subscribe(() => {
        if (!this.isVisible || !this.currentNotification) {
          return;
        }
        
        this.bookingService.getBookingConfirmationStatus(bookingId)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (response) => {
              if (response.success && response.data) {
                // Update confirmation status (null values default to false)
                this.carOwnerConfirmed = response.data.carOwnerConfirmed ?? false;
                this.workshopConfirmed = response.data.workshopConfirmed ?? false;
                
                // Only close dialog if BOTH parties have actually confirmed (true values, not null)
                if (response.data.carOwnerConfirmed === true && response.data.workshopConfirmed === true) {
                  console.log('✅ Both parties confirmed via polling - Booking status now InProgress');
                  console.log('🔄 Resetting confirmation status values:', {
                    carOwnerConfirmed: this.carOwnerConfirmed,
                    workshopConfirmed: this.workshopConfirmed,
                    hasCurrentUserConfirmed: this.hasCurrentUserConfirmed
                  });
                  
                  this.toastService.success(
                    'Appointment Started',
                    'Both parties confirmed! The appointment is now in progress.',
                    5000
                  );
                  
                  // Close dialog
                  this.activeConfirmations.delete(bookingId);
                  this.stopTimer();
                  this.isVisible = false;
                  this.currentNotification = null;
                  
                  // Reset confirmation status for next booking (InProgress)
                  this.carOwnerConfirmed = false;
                  this.workshopConfirmed = false;
                  this.hasCurrentUserConfirmed = false;
                  
                  console.log('✅ Confirmation status reset to:', {
                    carOwnerConfirmed: this.carOwnerConfirmed,
                    workshopConfirmed: this.workshopConfirmed,
                    hasCurrentUserConfirmed: this.hasCurrentUserConfirmed
                  });
                }
                
                this.cdr.detectChanges();
              }
            }
          });
      });
  }

  /**
   * @deprecated Use closeDialog() instead
   * Decline/Close the appointment dialog
   * This closes the modal and keeps the notification in the panel
   */
  declineAppointment(): void {
    // Redirect to closeDialog for consistency
    this.closeDialog();
  }

  /**
   * Close the dialog
   * Creates a notification in the panel so user can reopen within 15-minute window
   */
  closeDialog(): void {
    if (this.currentNotification) {
      const bookingId = this.currentNotification.bookingId;
      
      // Mark booking as shown to prevent dialog from reappearing automatically
      this.shownBookingIds.add(bookingId);
      
      // Remove from active confirmations
      this.activeConfirmations.delete(bookingId);
      
      // Store notification in panel so user can reopen and confirm within 15-minute window
      // The notification already exists from backend, so we just need to ensure it's in the panel
      // and not dismissed. The user can click it anytime to reopen the dialog.
      this.notificationService.addNotification({
        title: this.currentNotification.title,
        message: this.currentNotification.message,
        type: 'appointment-confirmation',
        priority: 'high',
        actionLabel: 'Confirm Arrival',
        confirmationDeadline: this.currentNotification.confirmationDeadline,
        data: {
          bookingId: this.currentNotification.bookingId,
          notificationId: this.currentNotification.notificationId,
          appointmentDate: this.currentNotification.bookingDetails?.appointmentDate,
          confirmationDeadline: this.currentNotification.confirmationDeadline,
          workshopName: this.currentNotification.bookingDetails?.workshopName,
          notificationType: 13, // AppointmentConfirmationRequest
          canReopen: true
        }
      });
      
      console.log('🚪 Dialog closed for booking:', bookingId, '- Notification stored in panel for 15-minute window');
    }
    
    this.stopTimer();
    this.isVisible = false;
    this.currentNotification = null;
    this.cdr.detectChanges();
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
