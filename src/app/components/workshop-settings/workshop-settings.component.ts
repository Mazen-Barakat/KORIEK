import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil, timeout, catchError, of } from 'rxjs';
import { WorkshopProfileService } from '../../services/workshop-profile.service';
import { NotificationService } from '../../services/notification.service';
import { ToastService } from '../../services/toast.service';
import { CanComponentDeactivate } from '../../guards/unsaved-changes.guard';

interface WorkingHourEntry {
  day: string;
  from: string;
  to: string;
  isClosed: boolean;
}

interface NotificationPref {
  type: string;
  label: string;
  push: boolean;
  email: boolean;
  sms: boolean;
}

@Component({
  selector: 'app-workshop-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './workshop-settings.component.html',
  styleUrls: ['./workshop-settings.component.css'],
})
export class WorkshopSettingsComponent implements OnInit, OnDestroy, CanComponentDeactivate {
  private destroy$ = new Subject<void>();

  // Navigation
  sections = [
    { id: 'account', label: 'Account', icon: '👤' },
    { id: 'profile', label: 'Workshop Profile', icon: '🏪' },
    { id: 'hours', label: 'Working Hours', icon: '🕒' },
    { id: 'notifications', label: 'Notifications', icon: '🔔' },
    { id: 'team', label: 'Team & Staff', icon: '👥' },
    { id: 'payments', label: 'Payments & Billing', icon: '💳' },
    { id: 'security', label: 'Security & Access', icon: '🔒' },
    { id: 'support', label: 'Support', icon: '❓' },
  ];
  activeSection = 'account';

  // Dirty tracking
  isDirty = false;

  // Loading states
  isLoading = false;
  isSaving = false;

  // Profile data
  workshopProfileId = '';
  workshopName = '';

  // Account form
  accountForm = {
    ownerName: '',
    email: '',
    phone: '',
    address: '',
  };

  // Working hours
  workingHours: WorkingHourEntry[] = [];
  daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // Notification preferences
  notificationPrefs: NotificationPref[] = [
    { type: 'booking', label: 'Bookings', push: true, email: true, sms: false },
    { type: 'payment', label: 'Payments', push: true, email: true, sms: false },
    { type: 'review', label: 'Reviews', push: true, email: false, sms: false },
    { type: 'system', label: 'System Updates', push: true, email: true, sms: false },
  ];

  // Team stub
  teamMembers = [
    { id: 1, name: 'You (Owner)', email: 'owner@workshop.com', role: 'Admin' },
  ];

  // Support
  supportEmail = 'support@koriek.com';

  constructor(
    private router: Router,
    private workshopProfileService: WorkshopProfileService,
    private notificationService: NotificationService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadSettings();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  canDeactivate(): boolean {
    if (this.isDirty) {
      return confirm('You have unsaved changes. Are you sure you want to leave?');
    }
    return true;
  }

  selectSection(sectionId: string): void {
    this.activeSection = sectionId;
  }

  markDirty(): void {
    this.isDirty = true;
  }

  private loadSettings(): void {
    this.isLoading = true;

    // Initialize working hours with defaults immediately so page is usable
    this.workingHours = this.daysOfWeek.map((day) => ({
      day,
      from: '09:00',
      to: '18:00',
      isClosed: day === 'Friday' || day === 'Saturday',
    }));

    // Load workshop profile with timeout to prevent infinite loading
    this.workshopProfileService
      .getMyWorkshopProfile()
      .pipe(
        timeout(8000),
        catchError((err) => {
          console.warn('Profile load failed or timed out:', err);
          return of(null);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (resp: any) => {
          const data = resp?.data ?? resp;
          if (data) {
            this.workshopProfileId = String(data.id || '');
            this.workshopName = data.name || data.shopName || 'My Workshop';
            this.accountForm.ownerName = data.ownerName || '';
            this.accountForm.email = data.email || '';
            this.accountForm.phone = data.phoneNumber || data.phone || '';
            this.accountForm.address = data.address || '';

            // Load working hours if we have an id
            if (data.id) {
              this.loadWorkingHours(data.id);
            }
          }
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Error loading profile:', err);
          this.isLoading = false;
        },
      });

    // Load notification preferences from service
    this.notificationService
      .getPreferences()
      .pipe(takeUntil(this.destroy$))
      .subscribe((prefs) => {
        prefs.forEach((pref) => {
          const match = this.notificationPrefs.find((np) => np.type === pref.type);
          if (match) {
            match.push = pref.push;
            match.email = pref.email;
            match.sms = pref.sms;
          }
        });
      });
  }

  private loadWorkingHours(workshopId: number): void {
    this.workshopProfileService
      .getWorkshopWorkingHours(workshopId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (hours: any[]) => {
          // Initialize all days
          this.workingHours = this.daysOfWeek.map((day) => {
            const existing = hours.find((h) => h.day === day);
            return {
              day,
              from: existing?.from || '09:00',
              to: existing?.to || '18:00',
              isClosed: existing?.isClosed ?? (day === 'Friday' || day === 'Saturday'),
            };
          });
        },
        error: (err) => {
          console.error('Error loading working hours:', err);
          // Initialize with defaults
          this.workingHours = this.daysOfWeek.map((day) => ({
            day,
            from: '09:00',
            to: '18:00',
            isClosed: day === 'Friday' || day === 'Saturday',
          }));
        },
      });
  }

  // Save handlers
  saveAccount(): void {
    this.isSaving = true;
    // In a real app, call API to update account info
    setTimeout(() => {
      this.isSaving = false;
      this.isDirty = false;
      this.toastService.success('Saved', 'Account settings saved');
    }, 500);
  }

  saveWorkingHours(): void {
    if (!this.workshopProfileId) {
      this.toastService.error('Error', 'Workshop profile not loaded');
      return;
    }

    // Validate hours
    for (const h of this.workingHours) {
      if (!h.isClosed && h.from >= h.to) {
        this.toastService.error('Invalid Hours', `${h.day}: open time must be before close time`);
        return;
      }
    }

    this.isSaving = true;
    const payload = this.workingHours.map((h) => ({
      workShopProfileId: Number(this.workshopProfileId),
      day: h.day,
      from: h.from,
      to: h.to,
      isClosed: h.isClosed,
    }));

    this.workshopProfileService
      .updateWorkshopWorkingHours(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.isSaving = false;
          this.isDirty = false;
          this.toastService.success('Saved', 'Working hours saved');
        },
        error: (err) => {
          console.error('Error saving working hours:', err);
          this.isSaving = false;
          this.toastService.error('Error', 'Failed to save working hours');
        },
      });
  }

  saveNotifications(): void {
    this.isSaving = true;
    // Update each preference in the service
    this.notificationPrefs.forEach((pref) => {
      // Find preference ID (mock)
      const prefId = `pref-${this.notificationPrefs.indexOf(pref) + 1}`.padStart(7, '0');
      this.notificationService.updatePreference(prefId, {
        push: pref.push,
        email: pref.email,
        sms: pref.sms,
      });
    });
    setTimeout(() => {
      this.isSaving = false;
      this.isDirty = false;
      this.toastService.success('Saved', 'Notification preferences saved');
    }, 300);
  }

  sendTestNotification(): void {
    this.notificationService.addNotification({
      type: 'system',
      title: 'Test Notification',
      message: 'This is a test notification from Settings.',
      priority: 'low',
    });
    this.toastService.info('Test Sent', 'Check the notification panel.');
  }

  // Navigation helpers
  goToProfile(): void {
    if (this.workshopProfileId) {
      this.router.navigate(['/workshop-profile', this.workshopProfileId]);
    } else {
      this.router.navigate(['/workshop-profile-edit']);
    }
  }

  goToEditProfile(): void {
    this.router.navigate(['/workshop-profile-edit']);
  }

  goToWallet(): void {
    this.router.navigate(['/workshop/wallet']);
  }

  goBack(): void {
    this.router.navigate(['/workshop/dashboard']);
  }

  // Copy hours from one day to all weekdays
  copyToWeekdays(sourceDay: string): void {
    const source = this.workingHours.find((h) => h.day === sourceDay);
    if (!source) return;

    const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday'];
    this.workingHours.forEach((h) => {
      if (weekdays.includes(h.day) && h.day !== sourceDay) {
        h.from = source.from;
        h.to = source.to;
        h.isClosed = source.isClosed;
      }
    });
    this.markDirty();
    this.toastService.info('Copied', 'Hours copied to weekdays');
  }

  // Team stub actions
  inviteTeamMember(): void {
    this.toastService.info('Coming Soon', 'Team invitations coming soon!');
  }

  // Security stub actions
  enableTwoFactor(): void {
    this.toastService.info('Coming Soon', 'Two-factor authentication coming soon!');
  }

  logoutAllSessions(): void {
    this.toastService.info('Coming Soon', 'Session management coming soon!');
  }

  changePassword(): void {
    this.toastService.info('Coming Soon', 'Password change coming soon!');
  }

  // Support
  contactSupport(): void {
    window.location.href = `mailto:${this.supportEmail}?subject=Support Request`;
  }
}
