import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { NotificationService } from '../../services/notification.service';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { ReviewModalService } from '../../services/review-modal.service';
import { ToastService } from '../../services/toast.service';
import { AppNotification } from '../../models/wallet.model';
import { RoleHelper } from '../../models/user-roles';

@Component({
  selector: 'app-notification-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-panel.component.html',
  styleUrls: ['./notification-panel.component.css'],
  animations: [
    trigger('slideDown', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-10px)' }),
        animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
      transition(':leave', [
        animate('150ms ease-in', style({ opacity: 0, transform: 'translateY(-10px)' })),
      ]),
    ]),
  ],
})
export class NotificationPanelComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  notifications: AppNotification[] = [];
  allNotifications: AppNotification[] = []; // Store all notifications
  unreadCount: number = 0;
  isOpen: boolean = false;
  displayLimit: number = 20; // Initial display limit
  displayIncrement: number = 20; // How many to add when scrolling

  constructor(
    private notificationService: NotificationService,
    private authService: AuthService,
    private reviewModalService: ReviewModalService,
    private toastService: ToastService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private http: HttpClient
  ) {}

  // API base used for direct booking status updates from notification actions
  private readonly apiUrl = 'https://korik-demo.runasp.net/api';

  /**
   * Handle a notification action button click (e.g., Confirm/Decline for booking)
   * Attempts to perform the action on the backend and updates local state immediately.
   */
  onNotificationAction(notification: any, event: Event): void {
    event.stopPropagation();

    // Check if this is an appointment confirmation notification
    if (notification?.type === 'appointment-confirmation') {
      this.handleAppointmentConfirmationClick(notification);
      return;
    }

    // If this is a booking action and we have a bookingId, attempt to update booking status
    const bookingId = notification?.data?.bookingId;
    const actionLabel = (notification?.actionLabel || '').toLowerCase();

    if (notification?.type === 'booking' && bookingId) {
      // Decide target status based on action label
      let targetStatus = '';
      if (actionLabel.includes('confirm') || actionLabel.includes('accept')) {
        targetStatus = 'Confirmed';
      } else if (actionLabel.includes('decline') || actionLabel.includes('reject')) {
        targetStatus = 'Rejected';
      }

      if (targetStatus) {
        this.http
          .put(`${this.apiUrl}/Booking/Update-Booking-Status`, {
            id: bookingId,
            status: targetStatus,
          })
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              // Mark notification as read locally and update badge
              this.notificationService.markAsRead(notification.id);

              // Broadcast a global event so other components (job board, dashboard) can refresh
              try {
                window.dispatchEvent(
                  new CustomEvent('booking:status-changed', {
                    detail: { bookingId, status: targetStatus },
                  })
                );
              } catch (e) {
                // ignore if event cannot be dispatched
              }

              // Update UI immediately
              this.cdr.detectChanges();

              // Optionally navigate to job board and open Upcoming tab when confirming
              if (targetStatus === 'Confirmed') {
                this.router.navigate(['/workshop/job-board'], { queryParams: { tab: 'upcoming' } });
                this.closePanel();
              }
            },
            error: (err) => {
              console.error('Error performing notification action on backend:', err);
            },
          });
        return;
      }
    }

    // Default behaviour: navigate if actionUrl exists
    if (notification.actionUrl) {
      this.router.navigate([notification.actionUrl]);
      this.closePanel();
    }
  }

  ngOnInit(): void {
    // Subscribe to notifications - updates automatically via SignalR
    this.notificationService
      .getNotifications()
      .pipe(takeUntil(this.destroy$))
      .subscribe((notifications) => {
        this.allNotifications = notifications; // Store all notifications
        this.updateDisplayedNotifications(); // Update displayed notifications based on limit
        // Force change detection to update the UI immediately
        this.cdr.detectChanges();
      });

    // Subscribe to unread count - updates automatically via SignalR
    this.notificationService
      .getUnreadCount()
      .pipe(takeUntil(this.destroy$))
      .subscribe((count) => {
        this.unreadCount = count;
        // Force change detection to update the badge immediately
        this.cdr.detectChanges();
        console.log('🔔 Notification count updated:', count);
      });

    // Request browser notification permission on component init
    this.notificationService.requestNotificationPermission();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  togglePanel(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      // Reset display limit when opening panel
      this.displayLimit = 20;
      this.updateDisplayedNotifications();
    }
  }

  closePanel(): void {
    this.isOpen = false;
  }

  /**
   * Handle scroll event to load more notifications
   */
  onNotificationListScroll(event: Event): void {
    const element = event.target as HTMLElement;
    const scrollTop = element.scrollTop;
    const scrollHeight = element.scrollHeight;
    const clientHeight = element.clientHeight;

    // Check if user scrolled near bottom (within 50px)
    const isNearBottom = scrollTop + clientHeight >= scrollHeight - 50;

    if (isNearBottom && this.notifications.length < this.allNotifications.length) {
      // Load more notifications
      this.loadMoreNotifications();
    }
  }

  /**
   * Load more notifications by increasing the display limit
   */
  private loadMoreNotifications(): void {
    this.displayLimit += this.displayIncrement;
    this.updateDisplayedNotifications();
    this.cdr.detectChanges();
    console.log(
      `📄 Loaded more notifications. Now showing ${this.notifications.length} of ${this.allNotifications.length}`
    );
  }

  /**
   * Update displayed notifications based on current limit
   */
  private updateDisplayedNotifications(): void {
    this.notifications = this.allNotifications.slice(0, this.displayLimit);
  }

  markAsRead(notification: AppNotification, event: Event): void {
    event.stopPropagation();

    // Get the notification ID from data (backend ID) or use the string ID
    const backendNotificationId = notification.data?.notificationId?.toString() || notification.id;

    // Update locally first for immediate UI feedback
    this.notificationService.markAsRead(notification.id);

    // Then sync with backend
    const token = this.authService.getToken();
    if (token && backendNotificationId) {
      this.notificationService
        .markAsReadOnBackend(backendNotificationId, token)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            console.log(`✅ Notification ${backendNotificationId} marked as read`);
          },
          error: (err) => {
            console.error('❌ Failed to mark notification as read on backend:', err);
          },
        });
    }
  }

  markAllAsRead(): void {
    const token = this.authService.getToken();

    // Get all unread notifications before marking them as read
    const unreadNotifications = this.notifications.filter((n) => !n.read);

    // Update locally first for immediate UI feedback
    this.notificationService.markAllAsRead();

    // Then sync with backend using bulk endpoint
    if (token && unreadNotifications.length > 0) {
      this.notificationService
        .markAllAsReadOnBackend(token)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            console.log(
              `✅ Marked all ${unreadNotifications.length} notifications as read on backend`
            );
          },
          error: (err) => {
            console.error('❌ Failed to mark all as read on backend:', err);
          },
        });
    }
  }

  deleteNotification(notification: AppNotification, event: Event): void {
    event.stopPropagation();
    this.notificationService.deleteNotification(notification.id);
  }

  handleNotificationClick(notification: AppNotification): void {
    // Get the notification ID from data (backend ID) or use the string ID
    const backendNotificationId = notification.data?.notificationId?.toString() || notification.id;

    // Mark as read locally
    this.notificationService.markAsRead(notification.id);

    // Sync with backend
    const token = this.authService.getToken();
    if (token && backendNotificationId) {
      this.notificationService
        .markAsReadOnBackend(backendNotificationId, token)
        .pipe(takeUntil(this.destroy$))
        .subscribe();
    }

    // Check if this is an appointment confirmation request (NotificationType = 13)
    const notificationType = notification.data?.notificationType;
    if (notificationType === 13 || notificationType === 'AppointmentConfirmationRequest') {
      console.log('🔔 Appointment confirmation notification clicked');
      this.handleAppointmentConfirmationClick(notification);
      return;
    }

    // Check if this is a "completed" notification for a car owner
    // Backend sends wrong notification type (PaymentReceived instead of BookingCompleted)
    // So we detect by message content: "has been completed" or "booking has been completed"
    const messageLC = (notification.message || '').toLowerCase();
    const isCompletedNotification =
      messageLC.includes('has been completed') ||
      messageLC.includes('booking has been completed') ||
      messageLC.includes('service completed');
    const bookingId = notification.data?.bookingId;
    const userRole = this.authService.getUserRole();
    const isCarOwner = RoleHelper.isCarOwner(userRole);

    if (isCompletedNotification && bookingId && isCarOwner) {
      // Open review modal for car owner when clicking on completed notification
      console.log('📝 Opening review modal from notification click for booking:', bookingId);
      this.reviewModalService.openReviewModal(bookingId);
      this.closePanel();
      return;
    }

    // Handle navigation based on notification type
    if (notification.actionUrl) {
      this.router.navigate([notification.actionUrl]);
      this.closePanel();
    } else if (notification.type === 'booking' && bookingId) {
      // Navigate to booking detail or job board
      this.router.navigate(['/workshop/job-board'], {
        queryParams: { bookingId: bookingId },
      });
      this.closePanel();
    } else if (notification.type === 'payment') {
      // For payment notifications that are NOT completed bookings, go to wallet
      this.router.navigate(['/wallet']);
      this.closePanel();
    }
  }

  formatTime(date: Date): string {
    const now = new Date();
    // Parse the date - handle both string and Date objects
    let notificationDate = typeof date === 'string' ? new Date(date) : new Date(date);

    // Backend stores times 2 hours behind, so add 2 hours to correct it
    notificationDate = new Date(notificationDate.getTime() + 2 * 60 * 60 * 1000);

    // Calculate the time difference with corrected timestamp
    const diff = now.getTime() - notificationDate.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    // For older notifications, show the corrected time
    return notificationDate.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  getNotificationIcon(notification: AppNotification): string {
    // Check title for specific booking states
    const title = notification.title?.toLowerCase() || '';
    const message = notification.message?.toLowerCase() || '';

    // More specific icons based on notification content
    if (title.includes('ready for pickup') || message.includes('ready')) {
      return '🚗';
    }
    if (title.includes('completed') || message.includes('completed')) {
      return '✅';
    }
    if (title.includes('in progress') || message.includes('in progress')) {
      return '🔧';
    }
    if (title.includes('accepted') || message.includes('accepted')) {
      return '✔️';
    }
    if (title.includes('rejected') || title.includes('declined') || message.includes('rejected')) {
      return '❌';
    }
    if (title.includes('cancelled') || message.includes('cancelled')) {
      return '🚫';
    }

    // Fallback to type-based icons
    switch (notification.type) {
      case 'booking':
        return '📋';
      case 'payment':
        return '💰';
      case 'review':
        return '⭐';
      case 'system':
        return '⚙️';
      case 'alert':
        return '⚠️';
      default:
        return '🔔';
    }
  }

  getPriorityClass(priority: string): string {
    return `priority-${priority}`;
  }

  /**
   * Handle appointment confirmation notification click
   * Reopens the confirmation modal with the remaining timer
   * Fetches fresh data from backend API to ensure accuracy
   */
  private handleAppointmentConfirmationClick(notification: AppNotification): void {
    const bookingId = notification.data?.bookingId;
    const backendNotificationId = notification.data?.notificationId;

    if (!bookingId || !backendNotificationId) {
      console.warn('⚠️ Missing booking ID or notification ID for appointment confirmation');
      return;
    }

    console.log(
      `📬 Reopening appointment confirmation modal for booking ${bookingId}, notification ${backendNotificationId}`
    );

    // Call reopenAppointmentDialog with notification ID - it will fetch fresh data from API
    if ((window as any).reopenAppointmentDialog) {
      // New signature: reopenAppointmentDialog(notificationId, bookingId?)
      (window as any).reopenAppointmentDialog(backendNotificationId, bookingId);

      // Mark notification as read
      this.notificationService.markAsRead(notification.id);

      // Close the notification panel
      this.closePanel();
    } else {
      console.error('❌ Appointment dialog function not available');
      this.toastService.error(
        'Error',
        'Could not open confirmation dialog. Please refresh the page.',
        4000
      );
    }
  }
}
