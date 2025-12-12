import { Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import * as signalR from '@microsoft/signalr';
import { HubConnection, HubConnectionState } from '@microsoft/signalr';
import { AuthService } from './auth.service';
import { NotificationService } from './notification.service';
import { ToastService } from './toast.service';
import { ReviewModalService } from './review-modal.service';
import { NotificationDto, NotificationType } from '../models/notification.model';
import { AppNotification } from '../models/wallet.model';
import { Subject } from 'rxjs';

// Interface for appointment confirmation requests
export interface AppointmentConfirmationNotification {
  notificationId: number;
  bookingId: number;
  message: string;
  title: string;
  confirmationDeadline: Date;
  createdAt: Date;
}
import { RoleHelper } from '../models/user-roles';

@Injectable({
  providedIn: 'root',
})
export class SignalRNotificationService {
  private hubConnection?: HubConnection;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000; // 3 seconds
  private isManualDisconnect = false;

  // Subject for appointment confirmation requests
  public appointmentConfirmationReceived = new Subject<AppointmentConfirmationNotification>();

  // Subject for confirmation status updates
  public confirmationStatusUpdate = new Subject<any>();

  // Track bookings that have already received confirmation in dialog
  private bookingsWithConfirmationReceived = new Set<number>();

  // Track processed notifications to prevent duplicates (notification ID -> timestamp)
  private processedNotifications = new Map<number, number>();
  private readonly NOTIFICATION_CACHE_DURATION = 60000; // 60 seconds

  constructor(
    private authService: AuthService,
    private notificationService: NotificationService,
    private toastService: ToastService,
    private reviewModalService: ReviewModalService,
    private router: Router,
    private ngZone: NgZone
  ) {
    console.log('🔔 SignalRNotificationService initialized');

    // Clean up old processed notifications every 2 minutes
    setInterval(() => this.cleanupProcessedNotifications(), 120000);
  }

  /**
   * Start the SignalR connection to the notification hub
   */
  async startConnection(): Promise<void> {
    // Check if user is authenticated
    if (!this.authService.isAuthenticated()) {
      console.log('⚠️ User not authenticated - skipping SignalR connection');
      return;
    }

    // Check if already connected
    if (this.hubConnection?.state === HubConnectionState.Connected) {
      console.log('✅ SignalR already connected - skipping duplicate connection');
      return;
    }

    // Check if connection is in progress
    if (this.hubConnection?.state === HubConnectionState.Connecting) {
      console.log('⏳ SignalR connection already in progress - skipping duplicate connection');
      return;
    }

    // If we have an existing connection that's disconnected, clean it up
    if (this.hubConnection) {
      console.log('🧹 Cleaning up old SignalR connection before starting new one');
      await this.stopConnection();
    }

    this.isManualDisconnect = false;

    try {
      // Build the hub connection
      this.hubConnection = new signalR.HubConnectionBuilder()
        .withUrl('https://localhost:44316/api/notificationHub', {
          accessTokenFactory: () => this.getAccessToken(),
        })
        .withAutomaticReconnect({
          nextRetryDelayInMilliseconds: (retryContext: signalR.RetryContext) => {
            // Exponential backoff: 0s, 2s, 10s, 30s, then 30s for subsequent attempts
            if (retryContext.previousRetryCount === 0) {
              return 0;
            } else if (retryContext.previousRetryCount === 1) {
              return 2000;
            } else if (retryContext.previousRetryCount === 2) {
              return 10000;
            } else {
              return 30000;
            }
          },
        })
        .configureLogging(signalR.LogLevel.Information)
        .build();

      // Setup event listeners before starting connection
      this.setupEventListeners();
      this.setupConnectionHandlers();

      // Start the connection
      await this.hubConnection.start();
      console.log('✅ SignalR connected successfully');
      this.reconnectAttempts = 0;

      // Join user-specific group after connection
      await this.joinUserGroup();

      // Fetch existing notifications from API after connection
      this.loadNotificationsFromApi();
    } catch (err) {
      console.error('❌ SignalR connection error:', err);
      this.handleReconnect();
    }
  }

  /**
   * Stop the SignalR connection
   */
  async stopConnection(): Promise<void> {
    this.isManualDisconnect = true;

    if (this.hubConnection) {
      try {
        // Remove event listeners before stopping
        this.removeEventListeners();

        await this.hubConnection.stop();
        console.log('🛑 SignalR disconnected');
      } catch (err) {
        console.error('❌ Error stopping SignalR connection:', err);
      }
    }
  }

  /**
   * Get the current connection state
   */
  getConnectionState(): HubConnectionState | undefined {
    return this.hubConnection?.state;
  }

  /**
   * Check if connection is active
   */
  isConnected(): boolean {
    return this.hubConnection?.state === HubConnectionState.Connected;
  }

  /**
   * Remove all event listeners to prevent duplicates
   */
  private removeEventListeners(): void {
    if (!this.hubConnection) return;

    try {
      this.hubConnection.off('ReceiveNotification');
      this.hubConnection.off('ConfirmationStatusUpdate');
      this.hubConnection.off('ReceiveBroadcast');
      console.log('🧹 Removed all SignalR event listeners');
    } catch (err) {
      console.warn('⚠️ Error removing event listeners:', err);
    }
  }

  /**
   * Setup SignalR event listeners for notifications
   */
  private setupEventListeners(): void {
    if (!this.hubConnection) return;

    // Remove any existing listeners first to prevent duplicates
    this.removeEventListeners();

    console.log('🔧 Setting up SignalR event listeners');

    // Listen for incoming notifications from the hub
    this.hubConnection.on('ReceiveNotification', (notificationDto: NotificationDto) => {
      // Run inside Angular zone to trigger change detection immediately
      this.ngZone.run(() => {
        console.log('📩 Received notification from SignalR:', notificationDto);
        console.log(
          '📩 Notification type:',
          notificationDto.type,
          'typeof:',
          typeof notificationDto.type
        );

        // Check if we've already processed this notification (prevent duplicates)
        if (this.isNotificationAlreadyProcessed(notificationDto.id)) {
          console.log('⚠️ Duplicate notification detected - skipping:', notificationDto.id);
          return;
        }

        // Mark this notification as processed
        this.markNotificationAsProcessed(notificationDto.id);

        // Check if this is an AppointmentConfirmationRequest
        if (
          this.isNotificationType(
            notificationDto.type,
            NotificationType.AppointmentConfirmationRequest
          )
        ) {
          console.log('🔔 Appointment confirmation request received:', notificationDto);

          // Check if booking status has changed (don't emit if already InProgress, completed, etc.)
          const notificationData = notificationDto as any;
          const status = notificationData.status || notificationData.bookingStatus;
          const jobStatus = notificationData.jobStatus;

          if (
            status === 'InProgress' ||
            jobStatus === 'in-progress' ||
            jobStatus === 'completed' ||
            jobStatus === 'ready' ||
            jobStatus === 'cancelled'
          ) {
            console.log(
              '⚠️ Skipping appointment confirmation - booking status already changed:',
              status || jobStatus
            );
          } else {
            this.handleAppointmentConfirmationRequest(notificationDto);
          }
        }

        // Map backend NotificationDto to frontend AppNotification
        const appNotification = this.mapToAppNotification(notificationDto);

        // Check if this is a self-action notification (user triggering notification about their own action)
        const currentUserId = this.authService.getUserId();
        const isSelfAction = notificationDto.senderId === currentUserId;

        // List of notification types that should be suppressed if user triggered them
        const selfActionTypes = [
          NotificationType.BookingCreated,
          NotificationType.BookingInProgress,
          NotificationType.BookingReadyForPickup,
          NotificationType.BookingCompleted,
          NotificationType.BookingCancelled,
          NotificationType.BookingAccepted,
        ];

        const shouldSuppressSelfAction =
          isSelfAction &&
          selfActionTypes.some((type) => this.isNotificationType(notificationDto.type, type));

        // Add notification to the notification service
        // Skip adding to notification panel if user triggered this action themselves
        if (!shouldSuppressSelfAction) {
          this.notificationService.addNotification(appNotification);
        } else {
          console.log(
            '🔕 Suppressing notification panel entry: User triggered their own action:',
            NotificationType[notificationDto.type]
          );
        }

        // Show toast notification for high-priority notifications
        // (Toast handler has its own filtering logic)
        this.showToastForNotification(notificationDto, appNotification);
      });
    });

    // Listen for confirmation status updates
    this.hubConnection.on('ConfirmationStatusUpdate', (update: any) => {
      this.ngZone.run(() => {
        console.log('🔄 Received confirmation status update from SignalR:', update);
        this.confirmationStatusUpdate.next(update);
      });
    });

    // Listen for broadcast messages (optional)
    this.hubConnection.on('ReceiveBroadcast', (message: string) => {
      console.log('📢 Broadcast message:', message);
    });
  }

  /**
   * Setup connection lifecycle handlers
   */
  private setupConnectionHandlers(): void {
    if (!this.hubConnection) return;

    // Handle reconnecting event
    this.hubConnection.onreconnecting((error?: Error) => {
      console.warn('🔄 SignalR reconnecting...', error);
    });

    // Handle reconnected event
    this.hubConnection.onreconnected(async (connectionId?: string) => {
      console.log('✅ SignalR reconnected. Connection ID:', connectionId);
      this.reconnectAttempts = 0;

      // Rejoin user group after reconnection
      await this.joinUserGroup();
    });

    // Handle closed event
    this.hubConnection.onclose((error?: Error) => {
      if (this.isManualDisconnect) {
        console.log('🛑 SignalR connection closed manually');
      } else {
        console.error('❌ SignalR connection closed unexpectedly:', error);
        this.handleReconnect();
      }
    });
  }

  /**
   * Join user-specific group for targeted notifications
   */
  private async joinUserGroup(): Promise<void> {
    const userId = this.authService.getUserId();
    const userRole = this.authService.getUserRole();

    if (!userId || !this.hubConnection) {
      console.warn('⚠️ Cannot join user group: missing userId or connection');
      return;
    }

    try {
      // Join user-specific group
      await this.hubConnection.invoke('JoinUserGroup', userId);
      console.log(`✅ Joined user group: User_${userId}`);

      // If user is a workshop owner, also join workshop group (if available)
      if (userRole === 'WORKSHOP') {
        const user = this.authService.getUser();
        if (user?.workshopId) {
          await this.hubConnection.invoke('JoinWorkshopGroup', user.workshopId.toString());
          console.log(`✅ Joined workshop group: Workshop_${user.workshopId}`);
        }
      }
    } catch (err) {
      console.error('❌ Error joining user group:', err);
    }
  }

  /**
   * Handle reconnection logic with exponential backoff
   */
  private handleReconnect(): void {
    if (this.isManualDisconnect) {
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(
        `❌ Max reconnection attempts (${this.maxReconnectAttempts}) reached. Giving up.`
      );
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;

    console.log(
      `🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms...`
    );

    setTimeout(() => {
      this.startConnection();
    }, delay);
  }

  /**
   * Get JWT access token for SignalR authentication
   */
  private getAccessToken(): string {
    const token = this.authService.getToken();
    if (!token) {
      console.warn('⚠️ No access token available for SignalR connection');
      return '';
    }
    return token;
  }

  /**
   * Check if notification type matches expected type
   * Handles both numeric and string type values from backend
   */
  private isNotificationType(dtoType: any, expectedType: NotificationType): boolean {
    // Direct numeric match
    if (dtoType === expectedType) return true;

    // String match for enum name
    const typeName = NotificationType[expectedType];
    if (typeof dtoType === 'string') {
      return dtoType === typeName || dtoType.toLowerCase() === typeName.toLowerCase();
    }

    return false;
  }

  /**
   * Map backend NotificationDto to frontend AppNotification model
   */
  private mapToAppNotification(
    dto: NotificationDto
  ): Omit<AppNotification, 'id' | 'timestamp' | 'read'> {
    // Determine notification type
    let type: AppNotification['type'] = 'system';
    let priority: AppNotification['priority'] = 'medium';

    switch (dto.type) {
      case NotificationType.BookingCreated:
      case NotificationType.BookingAccepted:
      case NotificationType.BookingRejected:
      case NotificationType.BookingCancelled:
      case NotificationType.BookingCompleted:
      case NotificationType.BookingReadyForPickup:
      case NotificationType.BookingInProgress:
      case NotificationType.JobStatusChanged:
      case NotificationType.AppointmentConfirmationRequest:
        type = 'booking';
        break;
      case NotificationType.PaymentReceived:
        type = 'payment';
        break;
      case NotificationType.QuoteSent:
      case NotificationType.QuoteApproved:
      case NotificationType.QuoteRejected:
        type = 'alert';
        break;
      case NotificationType.ReviewReceived:
        type = 'review';
        break;
      default:
        type = 'system';
    }

    // Determine priority
    if (dto.priority) {
      priority = dto.priority;
    } else {
      // Auto-assign priority based on type
      switch (dto.type) {
        case NotificationType.BookingCreated:
        case NotificationType.PaymentReceived:
        case NotificationType.BookingCancelled:
        case NotificationType.BookingReadyForPickup:
        case NotificationType.AppointmentConfirmationRequest:
        case NotificationType.BookingCompleted:
          priority = 'high';
          break;
        case NotificationType.BookingAccepted:
        case NotificationType.BookingInProgress:
        case NotificationType.QuoteSent:
        case NotificationType.QuoteApproved:
          priority = 'medium';
          break;
        default:
          priority = 'low';
      }
    }

    // Generate title if not provided
    const title = dto.title || this.generateNotificationTitle(dto.type);

    // Generate action URL if bookingId is present
    let actionUrl = dto.actionUrl;
    let actionLabel = dto.actionLabel;

    if (!actionUrl && dto.bookingId) {
      actionUrl = `/booking/${dto.bookingId}`;
      actionLabel = actionLabel || 'View Booking';
    }

    return {
      type,
      title,
      message: dto.message,
      priority,
      actionUrl,
      actionLabel,
      confirmationDeadline: dto.confirmationDeadline
        ? new Date(dto.confirmationDeadline)
        : undefined,
      data: {
        notificationId: dto.id,
        senderId: dto.senderId,
        receiverId: dto.receiverId,
        bookingId: dto.bookingId,
        workshopId: dto.workshopId,
        notificationType: dto.type,
        confirmationDeadline: dto.confirmationDeadline,
      },
    };
  }

  /**
   * Generate notification title based on type
   */
  private generateNotificationTitle(type: NotificationType): string {
    switch (type) {
      case NotificationType.BookingCreated:
        return 'New Booking Request';
      case NotificationType.BookingAccepted:
        return 'Booking Accepted';
      case NotificationType.BookingRejected:
        return 'Booking Rejected';
      case NotificationType.BookingCancelled:
        return 'Booking Cancelled';
      case NotificationType.BookingCompleted:
        return 'Service Completed ✅';
      case NotificationType.BookingReadyForPickup:
        return 'Vehicle Ready for Pickup 🚗';
      case NotificationType.BookingInProgress:
        return 'Service In Progress 🔧';
      case NotificationType.PaymentReceived:
        return 'Payment Received';
      case NotificationType.QuoteSent:
        return 'Quote Sent';
      case NotificationType.QuoteApproved:
        return 'Quote Approved';
      case NotificationType.QuoteRejected:
        return 'Quote Rejected';
      case NotificationType.JobStatusChanged:
        return 'Job Status Updated';
      case NotificationType.ReviewReceived:
        return 'New Review';
      case NotificationType.AppointmentConfirmationRequest:
        return 'Confirm Your Appointment ⏰';
      default:
        return 'New Notification';
    }
  }

  /**
   * Show toast notification for important notifications
   */
  private showToastForNotification(
    dto: NotificationDto,
    appNotification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>
  ): void {
    const title = appNotification.title;
    const message = appNotification.message;
    const messageLC = (dto.message || '').toLowerCase();

    // Get user role to determine if toast should be shown
    const userRole = this.authService.getUserRole();
    const isWorkshop = userRole === 'WORKSHOP' || userRole === 'Workshop';

    // Debug log to see what notification type we're receiving
    console.log('🔔 Processing notification:', {
      type: dto.type,
      typeName: NotificationType[dto.type],
      title: dto.title,
      message: dto.message,
      bookingId: dto.bookingId,
      userRole: userRole,
      isWorkshop: isWorkshop,
    });

    // =====================================================================
    // WORKAROUND FOR BACKEND BUG:
    // Backend sends WRONG notification types:
    // - "Mark as Ready" sends type=4 (BookingCompleted) instead of type=11 (BookingReadyForPickup)
    // - "Complete" sends type=5 (PaymentReceived) instead of type=4 (BookingCompleted)
    //
    // So we detect the ACTUAL intent by checking the MESSAGE CONTENT:
    // - "ready for pickup" in message = ReadyForPickup action (NO review modal)
    // - "has been completed" in message = Completed action (SHOW review modal)
    // =====================================================================

    const isReadyForPickupMessage =
      messageLC.includes('ready for pickup') || messageLC.includes('ready to be picked up');
    const isCompletedMessage =
      messageLC.includes('has been completed') ||
      messageLC.includes('booking has been completed') ||
      messageLC.includes('service completed');

    console.log('🔍 Message analysis:', {
      message: dto.message,
      isReadyForPickupMessage,
      isCompletedMessage,
    });

    // PRIORITY 1: Detect "Ready for Pickup" by message content (overrides wrong type)
    if (isReadyForPickupMessage && !isCompletedMessage) {
      console.log('🚗 Detected ReadyForPickup by message - NOT opening review modal');
      this.dispatchBookingStatusChangedEvent(dto.bookingId, 'ready');

      // Only show toast if user didn't trigger this action
      const currentUserId = this.authService.getUserId();
      const isSelfAction = dto.senderId === currentUserId;

      if (!isSelfAction) {
        this.toastService.success(title, message, 7000);
      } else {
        console.log(
          '🔕 Suppressing self-action notification: User marked booking as ready (detected by message)'
        );
      }
      // Explicitly NOT opening review modal - vehicle is just ready, not completed
      return;
    }

    // PRIORITY 2: Detect "Completed" by message content (overrides wrong type)
    if (isCompletedMessage) {
      console.log('✅ Detected BookingCompleted by message - will open review modal');
      this.dispatchBookingStatusChangedEvent(dto.bookingId, 'completed');

      // Only show toast if user didn't trigger this action
      const currentUserId = this.authService.getUserId();
      const isSelfAction = dto.senderId === currentUserId;

      if (!isSelfAction) {
        this.toastService.success(title, message, 7000);
        // Trigger review modal for car owners
        this.tryOpenReviewModal(dto.bookingId, 'CompletedMessage');
      } else {
        console.log(
          '🔕 Suppressing self-action notification: User marked booking as completed (detected by message)'
        );
      }
      return;
    }

    // Show toast for booking-related notifications (both car owners and workshops)
    if (this.isNotificationType(dto.type, NotificationType.BookingCreated)) {
      // Dispatch event so job-board can refresh and show new booking immediately
      this.dispatchBookingStatusChangedEvent(dto.bookingId, 'created');

      // Get current user ID to check if they are the sender
      const currentUserId = this.authService.getUserId();
      const isSelfNotification = dto.senderId === currentUserId;

      // Only show toast if this is NOT a self-notification (car owner creating their own booking)
      // Show toast for workshops (they receive bookings from customers)
      if (isWorkshop) {
        this.toastService.booking(title, message, {
          label: 'View Job Board',
          callback: () => {
            if (dto.bookingId) {
              this.router.navigate(['/workshop/job-board'], {
                queryParams: { bookingId: dto.bookingId },
              });
            }
          },
        });
      } else if (!isSelfNotification) {
        // Car owners should NOT see notifications for bookings they created themselves
        // Only show if someone else created a booking involving this user
        this.toastService.booking(title, message, {
          label: 'View Booking',
          callback: () => {
            if (dto.bookingId) {
              this.router.navigate(['/booking', dto.bookingId]);
            }
          },
        });
      } else {
        console.log('🔕 Suppressing self-notification: Car owner created their own booking');
      }
    }
    // Show toast for appointment confirmation request (both car owner and workshop owner)
    else if (this.isNotificationType(dto.type, NotificationType.AppointmentConfirmationRequest)) {
      // Don't show regular toast - the confirmation dialog will handle this
      console.log('🔔 Appointment confirmation request - dialog will handle display');
      this.dispatchBookingStatusChangedEvent(dto.bookingId, 'confirmation-required');
    }
    // Show toast for booking cancelled (notify the other party, not who cancelled)
    else if (this.isNotificationType(dto.type, NotificationType.BookingCancelled)) {
      // Dispatch event so job-board can refresh and remove cancelled booking
      this.dispatchBookingStatusChangedEvent(dto.bookingId, 'cancelled');

      // Only show toast if user didn't cancel the booking themselves
      const currentUserId = this.authService.getUserId();
      const isSelfAction = dto.senderId === currentUserId;

      if (!isSelfAction) {
        this.toastService.warning(title, message, 6000);
      } else {
        console.log('🔕 Suppressing self-action notification: User cancelled their own booking');
      }
    }
    // Show toast for booking ready for pickup (notify car owner)
    else if (dto.type === NotificationType.BookingReadyForPickup) {
      console.log('🚗 ReadyForPickup notification (by type) - NOT opening review modal');
      this.dispatchBookingStatusChangedEvent(dto.bookingId, 'ready');

      // Only show toast if user didn't trigger this action
      const currentUserId = this.authService.getUserId();
      const isSelfAction = dto.senderId === currentUserId;

      if (!isSelfAction) {
        this.toastService.success(title, message, 7000);
      } else {
        console.log('🔕 Suppressing self-action notification: User marked booking as ready');
      }
    }
    // Show toast for booking in progress (notify the other party, not the one who triggered it)
    else if (this.isNotificationType(dto.type, NotificationType.BookingInProgress)) {
      this.dispatchBookingStatusChangedEvent(dto.bookingId, 'inprogress');

      // Only show toast if user didn't trigger this status change
      const currentUserId = this.authService.getUserId();
      const isSelfAction = dto.senderId === currentUserId;

      if (!isSelfAction) {
        this.toastService.info(title, message, 6000);
      } else {
        console.log('🔕 Suppressing self-action notification: User confirmed arrival');
      }
    }
    // Show toast for booking completed (notify car owner)
    else if (dto.type === NotificationType.BookingCompleted) {
      console.log('✅ BookingCompleted notification (by type) - will open review modal');
      this.dispatchBookingStatusChangedEvent(dto.bookingId, 'completed');

      // Only show toast if user didn't trigger this action
      const currentUserId = this.authService.getUserId();
      const isSelfAction = dto.senderId === currentUserId;

      if (!isSelfAction) {
        this.toastService.success(title, message, 7000);
        this.tryOpenReviewModal(dto.bookingId, 'BookingCompleted');
      } else {
        console.log('🔕 Suppressing self-action notification: User marked booking as completed');
      }
    }
    // Show toast for payment received
    else if (dto.type === NotificationType.PaymentReceived) {
      this.toastService.success(title, message, 5000);
    }
    // Show toast for booking accepted (notify car owner, not workshop who accepted)
    else if (this.isNotificationType(dto.type, NotificationType.BookingAccepted)) {
      // Only show toast if user didn't accept the booking themselves
      const currentUserId = this.authService.getUserId();
      const isSelfAction = dto.senderId === currentUserId;

      if (!isSelfAction) {
        this.toastService.info(title, message, 6000);
      } else {
        console.log('🔕 Suppressing self-action notification: Workshop accepted their own booking');
      }
    }
    // Handle JobStatusChanged
    else if (dto.type === NotificationType.JobStatusChanged) {
      this.toastService.info(title, message, 6000);
    }
    // Show toast for high-priority notifications
    else if (appNotification.priority === 'high') {
      this.toastService.warning(title, message, 5000);
    }
  }

  /**
   * Try to open review modal for car owner
   * Centralized method to ensure consistent role checking
   */
  private tryOpenReviewModal(bookingId: number | undefined, source: string): void {
    if (!bookingId) {
      console.log(`📝 Cannot open review modal from ${source}: no bookingId`);
      return;
    }

    const userRole = this.authService.getUserRole();
    const isCarOwner = RoleHelper.isCarOwner(userRole);

    console.log(`📝 tryOpenReviewModal called from ${source}:`, {
      userRole,
      isCarOwner,
      bookingId,
    });

    if (isCarOwner) {
      console.log(`📝 Opening review modal for booking ${bookingId} (source: ${source})`);
      this.ngZone.run(() => {
        this.reviewModalService.openReviewModal(bookingId);
      });
    } else {
      console.log(`📝 Not opening review modal: user is not a car owner (role: ${userRole})`);
    }
  }

  /**
   * Dispatch a custom event when booking status changes via SignalR
   * This allows components like job-board to react to real-time updates
   */
  private dispatchBookingStatusChangedEvent(bookingId: number | undefined, status: string): void {
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('booking:status-changed', {
        detail: { bookingId, status },
      });
      window.dispatchEvent(event);
      console.log(
        `📢 Dispatched booking:status-changed event for booking ${bookingId} with status ${status}`
      );
    }
  }

  /**
   * Load notifications from API when the connection starts.
   * This ensures any missed notifications while offline are retrieved.
   * Also checks for pending appointment confirmation requests.
   */
  private loadNotificationsFromApi(): void {
    const token = this.authService.getToken();
    if (!token) {
      console.warn('⚠️ No auth token available - skipping notification fetch');
      return;
    }

    console.log('📥 Fetching existing notifications from API...');
    this.notificationService.fetchNotificationsFromApi(token).subscribe({
      next: (notifications) => {
        console.log(`✅ Loaded ${notifications.length} notifications from API`);

        // Fetch unread count from backend to sync with actual state
        this.notificationService.fetchUnreadCountFromBackend(token);

        // Check for pending appointment confirmation requests in fetched notifications
        this.checkForPendingAppointmentConfirmations();
      },
      error: (error) => {
        console.error('❌ Failed to load notifications from API:', error);
      },
    });
  }

  /**
   * Check for pending appointment confirmation requests in existing notifications
   * This handles cases where notifications were sent while user was offline
   */
  private checkForPendingAppointmentConfirmations(): void {
    // Get notifications from notification service
    this.notificationService
      .getNotifications()
      .subscribe((notifications) => {
        const unreadNotifications = notifications.filter((n) => !n.read);

        console.log(
          '🔍 Checking for pending appointment confirmations in',
          unreadNotifications.length,
          'unread notifications'
        );

        for (const notification of unreadNotifications) {
          // Check if this is an appointment confirmation request
          const notificationData = notification.data as any;

          if (notificationData?.notificationType !== undefined) {
            const isAppointmentConfirmation = this.isNotificationType(
              notificationData.notificationType,
              NotificationType.AppointmentConfirmationRequest
            );

            if (isAppointmentConfirmation && notificationData.bookingId) {
              console.log(
                '🔔 Found pending appointment confirmation in API notifications:',
                notificationData
              );

              // Check if booking status has changed
              const status = notificationData.status || notificationData.bookingStatus;
              const jobStatus = notificationData.jobStatus;

              if (
                status === 'InProgress' ||
                jobStatus === 'in-progress' ||
                jobStatus === 'completed' ||
                jobStatus === 'ready' ||
                jobStatus === 'cancelled'
              ) {
                console.log(
                  '⚠️ Skipping pending appointment confirmation - booking status already changed:',
                  status || jobStatus
                );
                continue;
              }

              // Create a NotificationDto-like object to process
              const dto: NotificationDto = {
                id: notificationData.notificationId || parseInt(notification.id) || 0,
                senderId: notificationData.senderId || '',
                receiverId: notificationData.receiverId || '',
                message: notification.message,
                type: NotificationType.AppointmentConfirmationRequest,
                isRead: notification.read,
                createdAt: notification.timestamp.toISOString(),
                bookingId: notificationData.bookingId,
                title: notification.title,
              };

              // Only process if not already read
              if (!notification.read) {
                this.handleAppointmentConfirmationRequest(dto);
              }
            }
          }
        }
      })
      .unsubscribe(); // Unsubscribe immediately after getting the value
  }

  /**
   * Handle appointment confirmation request notifications
   * Emits the notification to the appointmentConfirmationReceived Subject
   */
  private handleAppointmentConfirmationRequest(dto: NotificationDto): void {
    if (!dto.bookingId) {
      console.warn('⚠️ Appointment confirmation request missing bookingId');
      return;
    }

    // Calculate confirmation deadline (15 minutes from notification creation or use provided deadline)
    let confirmationDeadline: Date;
    if (dto.confirmationDeadline) {
      confirmationDeadline = new Date(dto.confirmationDeadline);
    } else {
      // Default: 15 minutes from now
      confirmationDeadline = new Date(Date.now() + 15 * 60 * 1000);
    }

    // Check if this booking has already received confirmation in dialog
    if (this.bookingsWithConfirmationReceived.has(dto.bookingId)) {
      console.log(
        `⏭️ Skipping appointment confirmation for booking ${dto.bookingId} - Already received confirmation in dialog`
      );
      return;
    }

    const confirmationNotification: AppointmentConfirmationNotification = {
      notificationId: dto.id,
      bookingId: dto.bookingId,
      message: dto.message,
      title: dto.title || 'Appointment Confirmation Required',
      confirmationDeadline: confirmationDeadline,
      createdAt: new Date(dto.createdAt),
    };

    console.log('🔔 Emitting appointment confirmation notification:', confirmationNotification);
    this.appointmentConfirmationReceived.next(confirmationNotification);

    // Mark this booking as having received confirmation
    this.bookingsWithConfirmationReceived.add(dto.bookingId);
  }

  /**
   * Check if a notification has already been processed
   */
  private isNotificationAlreadyProcessed(notificationId: number): boolean {
    return this.processedNotifications.has(notificationId);
  }

  /**
   * Mark a notification as processed with current timestamp
   */
  private markNotificationAsProcessed(notificationId: number): void {
    this.processedNotifications.set(notificationId, Date.now());
  }

  /**
   * Clean up old processed notifications to prevent memory leaks
   */
  private cleanupProcessedNotifications(): void {
    const now = Date.now();
    const keysToDelete: number[] = [];

    this.processedNotifications.forEach((timestamp, notificationId) => {
      if (now - timestamp > this.NOTIFICATION_CACHE_DURATION) {
        keysToDelete.push(notificationId);
      }
    });

    keysToDelete.forEach((key) => this.processedNotifications.delete(key));

    if (keysToDelete.length > 0) {
      console.log(`🧹 Cleaned up ${keysToDelete.length} old processed notifications`);
    }
  }
}
