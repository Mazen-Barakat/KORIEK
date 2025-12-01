import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, interval } from 'rxjs';
import { AppNotification, NotificationPreference } from '../models/wallet.model';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private notificationsSubject = new BehaviorSubject<AppNotification[]>([
    {
      id: 'notif-001',
      type: 'booking',
      title: 'New Booking Request',
      message: 'John Smith requested a brake inspection for Toyota Camry',
      timestamp: new Date(2025, 10, 22, 9, 30),
      read: false,
      priority: 'high',
      actionUrl: '/workshop/job-board',
      actionLabel: 'View Request',
    },
    {
      id: 'notif-002',
      type: 'payment',
      title: 'Payment Received',
      message: 'You received $450.00 for completed service',
      timestamp: new Date(2025, 10, 21, 14, 30),
      read: false,
      priority: 'medium',
      actionUrl: '/workshop/wallet',
      actionLabel: 'View Transaction',
    },
    {
      id: 'notif-003',
      type: 'review',
      title: 'New Review',
      message: 'Sarah Johnson left a 5-star review',
      timestamp: new Date(2025, 10, 21, 10, 15),
      read: true,
      priority: 'low',
      actionUrl: '/workshop/reviews',
      actionLabel: 'View Review',
    },
  ]);

  private preferencesSubject = new BehaviorSubject<NotificationPreference[]>([
    { id: 'pref-001', type: 'payment', enabled: true, email: true, push: true, sms: false },
    { id: 'pref-002', type: 'booking', enabled: true, email: true, push: true, sms: true },
    { id: 'pref-003', type: 'review', enabled: true, email: false, push: true, sms: false },
    { id: 'pref-004', type: 'system', enabled: true, email: true, push: true, sms: false },
  ]);

  private unreadCountSubject = new BehaviorSubject<number>(2);

  constructor() {
    this.startAutoNotificationSimulation();
    this.updateUnreadCount();
  }

  getNotifications(): Observable<AppNotification[]> {
    return this.notificationsSubject.asObservable();
  }

  getUnreadCount(): Observable<number> {
    return this.unreadCountSubject.asObservable();
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
    this.notificationsSubject.next(notifications);
    this.updateUnreadCount();
    this.showBrowserNotification(newNotification);
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
}
