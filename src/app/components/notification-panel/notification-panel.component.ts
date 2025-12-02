import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { NotificationService } from '../../services/notification.service';
import { AuthService } from '../../services/auth.service';
import { AppNotification } from '../../models/wallet.model';

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
  unreadCount: number = 0;
  isOpen: boolean = false;

  constructor(
    private notificationService: NotificationService,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Subscribe to notifications - updates automatically via SignalR
    this.notificationService
      .getNotifications()
      .pipe(takeUntil(this.destroy$))
      .subscribe((notifications) => {
        this.notifications = notifications.slice(0, 10); // Show last 10
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
  }

  closePanel(): void {
    this.isOpen = false;
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
      this.notificationService.markAsReadOnBackend(backendNotificationId, token)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            console.log(`✅ Notification ${backendNotificationId} marked as read`);
          },
          error: (err) => {
            console.error('❌ Failed to mark notification as read on backend:', err);
          }
        });
    }
  }

  markAllAsRead(): void {
    const token = this.authService.getToken();
    
    // Get all unread notifications before marking them as read
    const unreadNotifications = this.notifications.filter(n => !n.read);
    
    // Update locally first for immediate UI feedback
    this.notificationService.markAllAsRead();
    
    // Then sync each with backend
    if (token) {
      unreadNotifications.forEach(notification => {
        const backendNotificationId = notification.data?.notificationId?.toString() || notification.id;
        if (backendNotificationId) {
          this.notificationService.markAsReadOnBackend(backendNotificationId, token)
            .pipe(takeUntil(this.destroy$))
            .subscribe();
        }
      });
      console.log(`✅ Marked ${unreadNotifications.length} notifications as read on backend`);
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
      this.notificationService.markAsReadOnBackend(backendNotificationId, token)
        .pipe(takeUntil(this.destroy$))
        .subscribe();
    }

    // Handle navigation based on notification type
    if (notification.actionUrl) {
      this.router.navigate([notification.actionUrl]);
      this.closePanel();
    } else if (notification.type === 'booking' && notification.data?.bookingId) {
      // Navigate to booking detail or job board
      this.router.navigate(['/workshop/job-board'], {
        queryParams: { bookingId: notification.data.bookingId },
      });
      this.closePanel();
    } else if (notification.type === 'payment') {
      this.router.navigate(['/workshop/wallet']);
      this.closePanel();
    }
  }

  formatTime(date: Date): string {
    const now = new Date();
    const notificationDate = new Date(date);
    const diff = now.getTime() - notificationDate.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    // For older notifications, show Cairo local time
    return notificationDate.toLocaleString('en-EG', {
      timeZone: 'Africa/Cairo',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  getNotificationIcon(type: string): string {
    switch (type) {
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
}
