import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, interval, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { AppNotification, NotificationPreference } from '../models/wallet.model';
import { NotificationDto, NotificationType } from '../models/notification.model';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  // Start with empty notifications - real notifications come from SignalR
  private notificationsSubject = new BehaviorSubject<AppNotification[]>([]);

  private preferencesSubject = new BehaviorSubject<NotificationPreference[]>([
    { id: 'pref-001', type: 'payment', enabled: true, email: true, push: true, sms: false },
    { id: 'pref-002', type: 'booking', enabled: true, email: true, push: true, sms: true },
    { id: 'pref-003', type: 'review', enabled: true, email: false, push: true, sms: false },
    { id: 'pref-004', type: 'system', enabled: true, email: true, push: true, sms: false },
  ]);

  private unreadCountSubject = new BehaviorSubject<number>(0);
  private readonly API_URL = 'https://korik-demo.runasp.net/api/Notifications';

  constructor(private http: HttpClient) {
    this.startAutoNotificationSimulation();
    this.updateUnreadCount();
  }

  getNotifications(): Observable<AppNotification[]> {
    return this.notificationsSubject.asObservable();
  }

  getUnreadCount(): Observable<number> {
    return this.unreadCountSubject.asObservable();
  }

  /**
   * Get notification details from API including canStillConfirm and remainingSeconds
   * Used when reopening confirmation dialog from notification panel
   */
  getNotificationDetails(notificationId: number): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/${notificationId}/details`).pipe(
      map((response) => {
        // Backend returns: { success, data: { ...notification details } }
        return response.data || response;
      }),
      catchError((error) => {
        console.error('❌ Error fetching notification details:', error);
        throw error;
      })
    );
  }

  /**
   * Get all pending appointment confirmation notifications
   * Called on page load to restore any active confirmation dialogs
   * Returns notifications with canStillConfirm, remainingSeconds, etc.
   */
  getPendingConfirmations(): Observable<any[]> {
    return this.http.get<any>(`${this.API_URL}/pending-confirmations`).pipe(
      map((response) => {
        // Backend returns: { success, data: [...pending confirmations] }
        const data = response.data || response || [];
        console.log(`📥 Fetched ${data.length} pending confirmations from API`);
        return data;
      }),
      catchError((error) => {
        console.error('❌ Error fetching pending confirmations:', error);
        return of([]);
      })
    );
  }

  /**
   * Fetch unread count from backend
   */
  fetchUnreadCountFromBackend(token: string): void {
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });

    this.http
      .get<any>(`${this.API_URL}/unread-count`, { headers })
      .pipe(
        catchError((error) => {
          console.error('❌ Error fetching unread count from backend:', error);
          return of({ count: 0 });
        })
      )
      .subscribe((response) => {
        const count = response?.count ?? response?.data?.count ?? 0;
        this.unreadCountSubject.next(count);
        console.log(`📊 Unread count from backend: ${count}`);
      });
  }

  getPreferences(): Observable<NotificationPreference[]> {
    return this.preferencesSubject.asObservable();
  }

  markAsRead(notificationId: string): void {
    const notifications = this.notificationsSubject.value;
    const notification = notifications.find((n) => n.id === notificationId);
    if (notification) {
      notification.read = true;
      this.notificationsSubject.next([...notifications]);
      this.updateUnreadCount();
    }
  }

  markAllAsRead(): void {
    const notifications = this.notificationsSubject.value.map((n) => ({ ...n, read: true }));
    this.notificationsSubject.next(notifications);
    this.updateUnreadCount();
  }

  deleteNotification(notificationId: string): void {
    const notifications = this.notificationsSubject.value.filter((n) => n.id !== notificationId);
    this.notificationsSubject.next(notifications);
    this.updateUnreadCount();
  }

  addNotification(notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>): void {
    const newNotification: AppNotification = {
      ...notification,
      id: `notif-${Date.now()}`,
      timestamp: new Date(),
      read: false,
    };
    const notifications = [newNotification, ...this.notificationsSubject.value];

    // Emit the updated notifications array - this triggers UI updates via subscriptions
    this.notificationsSubject.next(notifications);

    // Update unread count - this triggers the badge update on the bell
    this.updateUnreadCount();

    // Show browser notification if permission granted
    this.showBrowserNotification(newNotification);

    // Log for debugging
    console.log(
      '🔔 New notification added:',
      newNotification.title,
      '| Total unread:',
      this.unreadCountSubject.value
    );
  }

  updatePreference(preferenceId: string, updates: Partial<NotificationPreference>): void {
    const preferences = this.preferencesSubject.value.map((pref) =>
      pref.id === preferenceId ? { ...pref, ...updates } : pref
    );
    this.preferencesSubject.next(preferences);
  }

  private updateUnreadCount(): void {
    const unreadCount = this.notificationsSubject.value.filter((n) => !n.read).length;
    this.unreadCountSubject.next(unreadCount);
  }

  public showBrowserNotification(notification: AppNotification): void {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/assets/icon.png',
        badge: '/assets/badge.png',
      });
    }
  }

  requestNotificationPermission(): void {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  // Mock notification simulation removed - real-time notifications now handled by SignalR
  // This method is kept for backward compatibility but does nothing
  private startAutoNotificationSimulation(): void {
    // Real-time notifications are now delivered via SignalR
    // This auto-simulation has been disabled
    console.log(
      'ℹ️ Mock notification simulation disabled - using SignalR for real-time notifications'
    );
  }

  // Get notifications by type
  getNotificationsByType(type: string): AppNotification[] {
    return this.notificationsSubject.value.filter((n) => n.type === type);
  }

  // Get notifications by priority
  getNotificationsByPriority(priority: string): AppNotification[] {
    return this.notificationsSubject.value.filter((n) => n.priority === priority);
  }

  // Clear all notifications
  clearAll(): void {
    this.notificationsSubject.next([]);
    this.updateUnreadCount();
  }

  /**
   * Fetch notifications from backend API for the logged-in user.
   * This is called on page load to retrieve any missed notifications.
   */
  fetchNotificationsFromApi(token: string): Observable<AppNotification[]> {
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });

    return this.http.get<any>(this.API_URL, { headers }).pipe(
      map((response: any) => {
        // Handle both direct array response and wrapped response
        const notificationsData = response.data || response || [];

        if (!Array.isArray(notificationsData)) {
          console.warn('⚠️ Unexpected notifications response format:', response);
          return [];
        }

        console.log(`📥 Fetched ${notificationsData.length} notifications from API`);

        // Map backend NotificationDto to AppNotification and add to the service
        const appNotifications: AppNotification[] = notificationsData.map((dto: NotificationDto) =>
          this.mapDtoToAppNotification(dto)
        );

        // Merge with existing notifications (avoid duplicates)
        this.mergeNotifications(appNotifications);

        return appNotifications;
      }),
      catchError((error) => {
        console.error('❌ Error fetching notifications from API:', error);
        return of([]);
      })
    );
  }

  /**
   * Map backend NotificationDto to frontend AppNotification model
   */
  private mapDtoToAppNotification(dto: NotificationDto): AppNotification {
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
      switch (dto.type) {
        case NotificationType.BookingCreated:
        case NotificationType.PaymentReceived:
        case NotificationType.BookingCancelled:
        case NotificationType.BookingReadyForPickup:
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
      id: dto.id.toString(),
      type,
      title,
      message: dto.message,
      priority,
      timestamp: new Date(dto.createdAt),
      read: dto.isRead,
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
      default:
        return 'New Notification';
    }
  }

  /**
   * Merge fetched notifications with existing ones, avoiding duplicates
   */
  private mergeNotifications(newNotifications: AppNotification[]): void {
    const existingNotifications = this.notificationsSubject.value;
    const existingIds = new Set(existingNotifications.map((n) => n.id));

    // Filter out duplicates and add new notifications
    const uniqueNew = newNotifications.filter((n) => !existingIds.has(n.id));

    if (uniqueNew.length > 0) {
      // Combine and sort by timestamp (newest first)
      const combined = [...uniqueNew, ...existingNotifications].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      this.notificationsSubject.next(combined);
      this.updateUnreadCount();
      console.log(`✅ Added ${uniqueNew.length} new notifications from API`);
    } else {
      console.log('ℹ️ No new notifications to add (all already exist)');
    }
  }

  /**
   * Mark notification as read on the backend
   */
  markAsReadOnBackend(notificationId: string, token: string): Observable<any> {
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });

    return this.http.put(`${this.API_URL}/${notificationId}/mark-read`, {}, { headers }).pipe(
      map((response) => {
        console.log(`✅ Notification ${notificationId} marked as read on backend`);
        return response;
      }),
      catchError((error) => {
        console.error('❌ Error marking notification as read on backend:', error);
        return of(null);
      })
    );
  }

  /**
   * Mark all notifications as read on the backend
   */
  markAllAsReadOnBackend(token: string): Observable<any> {
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });

    return this.http.put(`${this.API_URL}/mark-all-read`, {}, { headers }).pipe(
      map((response) => {
        console.log('✅ All notifications marked as read on backend');
        return response;
      }),
      catchError((error) => {
        console.error('❌ Error marking all notifications as read on backend:', error);
        return of(null);
      })
    );
  }

  /**
   * Add an appointment confirmation notification that can reopen the modal
   */
  addAppointmentConfirmationNotification(
    bookingId: number,
    confirmationDeadline: Date,
    bookingDetails?: any
  ): void {
    const notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'> = {
      type: 'appointment-confirmation',
      title: 'Appointment Confirmation Required',
      message: 'Tap to confirm or decline your appointment arrival',
      priority: 'high',
      confirmationDeadline: confirmationDeadline,
      actionLabel: 'Respond Now',
      data: {
        bookingId,
        bookingDetails,
        confirmationDeadline: confirmationDeadline.toISOString(),
      },
    };

    this.addNotification(notification);
    console.log('📋 Added appointment confirmation notification for booking:', bookingId);
  }

  /**
   * Remove notifications that have expired deadlines
   * Called periodically to clean up expired appointment confirmation notifications
   */
  removeExpiredConfirmationNotifications(): void {
    const now = new Date();
    const notifications = this.notificationsSubject.value;
    const filtered = notifications.filter((n) => {
      if (n.type === 'appointment-confirmation' && n.confirmationDeadline) {
        return new Date(n.confirmationDeadline) > now;
      }
      return true;
    });

    if (filtered.length < notifications.length) {
      this.notificationsSubject.next(filtered);
      this.updateUnreadCount();
      console.log(
        `🗑️ Removed ${notifications.length - filtered.length} expired confirmation notifications`
      );
    }
  }

  /**
   * Start periodic cleanup of expired notifications (every 30 seconds)
   */
  startPeriodicCleanup(): void {
    interval(30000).subscribe(() => {
      this.removeExpiredConfirmationNotifications();
    });
  }
}
