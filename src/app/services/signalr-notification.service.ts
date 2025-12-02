import { Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import * as signalR from '@microsoft/signalr';
import { HubConnection, HubConnectionState } from '@microsoft/signalr';
import { AuthService } from './auth.service';
import { NotificationService } from './notification.service';
import { ToastService } from './toast.service';
import { NotificationDto, NotificationType } from '../models/notification.model';
import { AppNotification } from '../models/wallet.model';

@Injectable({
  providedIn: 'root',
})
export class SignalRNotificationService {
  private hubConnection?: HubConnection;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000; // 3 seconds
  private isManualDisconnect = false;

  constructor(
    private authService: AuthService,
    private notificationService: NotificationService,
    private toastService: ToastService,
    private router: Router,
    private ngZone: NgZone
  ) {
    console.log('🔔 SignalRNotificationService initialized');
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
      console.log('✅ SignalR already connected');
      return;
    }

    // Check if connection is in progress
    if (this.hubConnection?.state === HubConnectionState.Connecting) {
      console.log('⏳ SignalR connection already in progress');
      return;
    }

    this.isManualDisconnect = false;

    try {
      // Build the hub connection
      this.hubConnection = new signalR.HubConnectionBuilder()
        .withUrl('https://localhost:44316/notificationHub', {
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
   * Setup SignalR event listeners for notifications
   */
  private setupEventListeners(): void {
    if (!this.hubConnection) return;

    // Listen for incoming notifications from the hub
    this.hubConnection.on('ReceiveNotification', (notificationDto: NotificationDto) => {
      // Run inside Angular zone to trigger change detection immediately
      this.ngZone.run(() => {
        console.log('📩 Received notification from SignalR:', notificationDto);

        // Map backend NotificationDto to frontend AppNotification
        const appNotification = this.mapToAppNotification(notificationDto);

        // Add notification to the notification service
        this.notificationService.addNotification(appNotification);

        // Show browser notification if permitted
        this.notificationService.showBrowserNotification({
          id: notificationDto.id.toString(),
          timestamp: new Date(notificationDto.createdAt),
          read: notificationDto.isRead,
          ...appNotification,
        });

        // Show toast notification for high-priority notifications
        this.showToastForNotification(notificationDto, appNotification);
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
      case NotificationType.JobStatusChanged:
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
          priority = 'high';
          break;
        case NotificationType.BookingAccepted:
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
      data: {
        notificationId: dto.id,
        senderId: dto.senderId,
        receiverId: dto.receiverId,
        bookingId: dto.bookingId,
        workshopId: dto.workshopId,
        notificationType: dto.type,
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
        return 'Booking Completed';
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

    // Show toast for booking-related notifications (workshop owners)
    if (dto.type === NotificationType.BookingCreated) {
      this.toastService.booking(title, message, {
        label: 'View Booking',
        callback: () => {
          if (dto.bookingId) {
            this.router.navigate(['/workshop/job-board'], {
              queryParams: { bookingId: dto.bookingId },
            });
          }
        },
      });
    }
    // Show toast for payment received
    else if (dto.type === NotificationType.PaymentReceived && dto.priority === 'high') {
      this.toastService.success(title, message, 6000);
    }
    // Show toast for quote approved
    else if (dto.type === NotificationType.QuoteApproved) {
      this.toastService.success(title, message, 5000);
    }
    // Show toast for booking accepted (car owners)
    else if (dto.type === NotificationType.BookingAccepted) {
      this.toastService.info(title, message, 5000);
    }
    // Show toast for high-priority notifications
    else if (appNotification.priority === 'high') {
      this.toastService.warning(title, message, 5000);
    }
  }

  /**
   * Load notifications from API when the connection starts.
   * This ensures any missed notifications while offline are retrieved.
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
      },
      error: (error) => {
        console.error('❌ Failed to load notifications from API:', error);
      }
    });
  }
}
