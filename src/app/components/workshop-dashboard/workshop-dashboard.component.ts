import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, NgIf, NgFor } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BookingService, EnrichedBooking } from '../../services/booking.service';
import { DashboardMetrics, Job } from '../../models/booking.model';
import { ActionBadgeComponent } from '../shared/action-badge/action-badge.component';
import { SectionHeaderComponent } from '../shared/section-header/section-header.component';
import { BookingCardComponent, BookingCardData } from '../booking-card/booking-card.component';
import { AuthService } from '../../services/auth.service';
import { Subject, takeUntil } from 'rxjs';
import { NotificationService } from '../../services/notification.service';
import { WorkshopProfileService } from '../../services/workshop-profile.service';

export type CalendarViewMode = 'grid' | 'list' | 'timeline';
export type DensityLevel = 'low' | 'medium' | 'high' | 'critical';

interface StatusGroup {
  status: string;
  label: string;
  color: string;
  count: number;
  appointments: BookingCardData[];
}

interface CalendarDay {
  date: Date;
  dayName: string;
  dayNumber: number;
  isToday: boolean;
  appointments: BookingCardData[];
  densityLevel: DensityLevel;
  statusGroups: StatusGroup[];
  isExpanded: boolean;
}

@Component({
  selector: 'app-workshop-dashboard',
  standalone: true,
  imports: [CommonModule, NgIf, NgFor, RouterModule, ActionBadgeComponent, SectionHeaderComponent, BookingCardComponent],
  templateUrl: './workshop-dashboard.component.html',
  styleUrl: './workshop-dashboard.component.css',
})
export class WorkshopDashboardComponent implements OnInit, OnDestroy {
  // Expose Math for template
  Math = Math;

  metrics: DashboardMetrics = {
    monthlyRevenue: 0,
    revenueChange: 0,
    pendingPayouts: 0,
    payoutsChange: 0,
    shopRating: 0,
    totalReviews: 0,
    newBookingRequests: 0,
    quotesAwaitingApproval: 0,
    carsReadyForPickup: 0,
    activeJobs: 0,
  };

  private destroy$ = new Subject<void>();
  workshopProfileId: number = 0;

  isShopOpen: boolean = true;
  shopName: string = 'My Workshop';

  upcomingAppointments: any[] = [];
  recentActivity: any[] = [];

  currentDate: Date = new Date();
  currentMonth: string = '';
  currentYear: number = 0;
  calendarDays: CalendarDay[] = [];

  // Week navigation state
  weekStartDate: Date = new Date();
  allBookings: EnrichedBooking[] = [];
  isLoadingBookings = false;

  // View mode & density settings
  calendarViewMode: CalendarViewMode = 'grid';
  maxVisibleAppointments = 3; // Show this many before "+X more"
  expandedDayIndex: number | null = null;

  // Status configuration for grouping
  readonly statusConfig = [
    { status: 'pending', label: 'Pending', color: '#f59e0b' },
    { status: 'accepted', label: 'Confirmed', color: '#10b981' },
    { status: 'progress', label: 'In Progress', color: '#3b82f6' },
    { status: 'completed', label: 'Completed', color: '#22c55e' },
    { status: 'rejected', label: 'Cancelled', color: '#ef4444' },
  ];

  // (Location modal moved to workshop profile edit page)

  constructor(
    private bookingService: BookingService,
    private router: Router,
    private authService: AuthService,
    private notificationService: NotificationService,
    private workshopProfileService: WorkshopProfileService
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
    this.loadRecentActivity();

    // Subscribe to notifications and update new booking requests count
    this.notificationService
      .getNotifications()
      .pipe(takeUntil(this.destroy$))
      .subscribe((notifications: any[]) => {
        const bookingUnread = notifications.filter((n: any) => n.type === 'booking' && !n.read).length;
        this.metrics = { ...this.metrics, newBookingRequests: bookingUnread };
      });

    // Get current workshop profile id and load bookings
    this.workshopProfileService
      .getMyWorkshopProfile()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (resp: any) => {
          const data = resp?.data ?? resp;
          if (data && data.id) {
            this.workshopProfileId = Number(data.id);
            this.shopName = data.name || data.shopName || data.workshopName || 'My Workshop';

            // Update shop rating from profile if available
            if (data.rating !== undefined && data.rating !== null) {
              this.metrics.shopRating = data.rating;
            } else if (data.Rating !== undefined && data.Rating !== null) {
              this.metrics.shopRating = data.Rating;
            }

            this.loadWorkshopBookings();
          } else {
            this.setupCalendarWithoutBookings();
          }
        },
        error: (err: any) => {
          console.warn('Could not load workshop profile:', err);
          this.setupCalendarWithoutBookings();
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Check if we should request location and show the modal
   */
  // Location modal logic moved to `workshop-profile-edit` component

  private loadWorkshopBookings(): void {
    if (!this.workshopProfileId) {
      this.setupCalendarWithoutBookings();
      return;
    }

    this.isLoadingBookings = true;
    this.bookingService
      .getEnrichedBookingsByWorkshop(this.workshopProfileId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (bookings) => {
          this.allBookings = bookings;
          this.calculateMetricsFromBookings(bookings);
          this.setupCalendar();
          this.isLoadingBookings = false;
        },
        error: (err) => {
          console.error('Error loading bookings:', err);
          this.allBookings = [];
          this.setupCalendar();
          this.isLoadingBookings = false;
        },
      });
  }

  /**
   * Calculate dashboard metrics from booking data
   */
  private calculateMetricsFromBookings(bookings: EnrichedBooking[]): void {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    // Calculate Monthly Revenue (current month completed bookings)
    const currentMonthRevenue = bookings
      .filter(b => {
        const bookingDate = new Date(b.appointmentDate);
        return (
          bookingDate.getMonth() === currentMonth &&
          bookingDate.getFullYear() === currentYear &&
          (b.status.toLowerCase() === 'completed' || b.status.toLowerCase() === 'paid')
        );
      })
      .reduce((sum, b) => sum + (this.estimateBookingRevenue(b)), 0);

    // Calculate last month revenue for comparison
    const lastMonthRevenue = bookings
      .filter(b => {
        const bookingDate = new Date(b.appointmentDate);
        return (
          bookingDate.getMonth() === lastMonth &&
          bookingDate.getFullYear() === lastMonthYear &&
          (b.status.toLowerCase() === 'completed' || b.status.toLowerCase() === 'paid')
        );
      })
      .reduce((sum, b) => sum + (this.estimateBookingRevenue(b)), 0);

    const revenueChange = lastMonthRevenue > 0
      ? ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
      : 0;

    // Calculate Active Jobs (in progress or accepted)
    const activeJobs = bookings.filter(b => {
      const status = b.status.toLowerCase();
      return status === 'progress' || status === 'in-progress' || status === 'accepted' || status === 'approved';
    }).length;

    // Calculate New Requests (pending status)
    const newRequests = bookings.filter(b => {
      const status = b.status.toLowerCase();
      return status === 'pending' || status === 'new';
    }).length;

    // Calculate total reviews from completed bookings
    const completedBookings = bookings.filter(b =>
      b.status.toLowerCase() === 'completed' || b.status.toLowerCase() === 'paid'
    );

    // Calculate Ready for Pickup
    const readyForPickup = bookings.filter(b => {
      const status = b.status.toLowerCase();
      return status === 'ready' || status === 'ready for pickup';
    }).length;

    // Calculate Quotes Awaiting Approval (if you have this status)
    const quotesAwaiting = bookings.filter(b => {
      const status = b.status.toLowerCase();
      return status === 'quote sent' || status === 'awaiting approval' || status === 'pending approval';
    }).length;

    // Calculate Pending Payouts (85% of completed but unpaid bookings)
    const pendingPayouts = bookings
      .filter(b => {
        const status = b.status.toLowerCase();
        return status === 'completed' && b.paymentMethod;
      })
      .reduce((sum, b) => sum + (this.estimateBookingRevenue(b) * 0.85), 0);

    // Update metrics (keep existing shopRating from profile)
    this.metrics = {
      ...this.metrics, // Preserve existing values like shopRating from profile
      monthlyRevenue: currentMonthRevenue,
      revenueChange: Math.round(revenueChange * 10) / 10,
      pendingPayouts: pendingPayouts,
      payoutsChange: this.metrics.payoutsChange,
      totalReviews: completedBookings.length,
      newBookingRequests: newRequests,
      quotesAwaitingApproval: quotesAwaiting,
      carsReadyForPickup: readyForPickup,
      activeJobs: activeJobs,
    };
  }

  /**
   * Estimate revenue for a booking
   * Uses actual payment amount if available, otherwise estimates based on service type
   */
  private estimateBookingRevenue(booking: any): number {
    // If booking has paidAmount, use it
    if (booking.paidAmount && booking.paidAmount > 0) {
      return booking.paidAmount;
    }

    // Otherwise, estimate based on service name or type
    // You can customize these estimates based on your service catalog
    const serviceName = (booking.serviceName || '').toLowerCase();

    if (serviceName.includes('oil change')) return 300;
    if (serviceName.includes('brake')) return 800;
    if (serviceName.includes('engine')) return 1500;
    if (serviceName.includes('transmission')) return 2000;
    if (serviceName.includes('tire')) return 600;
    if (serviceName.includes('diagnostic')) return 400;
    if (serviceName.includes('battery')) return 500;
    if (serviceName.includes('ac') || serviceName.includes('air conditioning')) return 700;

    // Default estimate
    return 500;
  }

  private setupCalendarWithoutBookings(): void {
    this.allBookings = [];
    this.setupCalendar();
  }

  private loadDashboardData(): void {
    this.bookingService.getDashboardMetrics().subscribe({
      next: (metrics) => {
        this.metrics = metrics;
      },
      error: (error) => {
        console.error('Error loading dashboard metrics:', error);
      },
    });
  }

  private setupCalendar(): void {
    const now = new Date();

    // Initialize week start to current week if not already set
    if (!this.weekStartDate || this.weekStartDate.getTime() === 0) {
      this.weekStartDate = this.getWeekStart(now);
    }

    this.updateCalendarDisplay();
  }

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay(); // 0 = Sunday
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private updateCalendarDisplay(): void {
    const weekEnd = new Date(this.weekStartDate);
    weekEnd.setDate(weekEnd.getDate() + 6);

    // Update month/year display
    this.currentMonth = this.weekStartDate.toLocaleDateString('en-US', { month: 'long' });
    this.currentYear = this.weekStartDate.getFullYear();

    // If week spans two months, show both
    if (this.weekStartDate.getMonth() !== weekEnd.getMonth()) {
      this.currentMonth = `${this.weekStartDate.toLocaleDateString('en-US', { month: 'short' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short' })}`;
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    this.calendarDays = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(this.weekStartDate);
      day.setDate(this.weekStartDate.getDate() + i);

      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);

      const appointments = this.getAppointmentsForDay(day);
      const densityLevel = this.calculateDensity(appointments.length);
      const statusGroups = this.groupByStatus(appointments);

      this.calendarDays.push({
        date: day,
        dayName: day.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
        dayNumber: day.getDate(),
        isToday: dayStart.getTime() === now.getTime(),
        appointments,
        densityLevel,
        statusGroups,
        isExpanded: false,
      });
    }
  }

  private calculateDensity(count: number): DensityLevel {
    if (count <= 2) return 'low';
    if (count <= 5) return 'medium';
    if (count <= 8) return 'high';
    return 'critical';
  }

  private groupByStatus(appointments: BookingCardData[]): StatusGroup[] {
    const groups: StatusGroup[] = [];

    for (const config of this.statusConfig) {
      const matching = appointments.filter(apt => {
        const s = (apt.status || '').toLowerCase();
        return s.includes(config.status);
      });

      if (matching.length > 0) {
        groups.push({
          status: config.status,
          label: config.label,
          color: config.color,
          count: matching.length,
          appointments: matching,
        });
      }
    }

    // Add any unmatched to "Other"
    const matchedIds = new Set(groups.flatMap(g => g.appointments.map(a => a.id)));
    const unmatched = appointments.filter(apt => !matchedIds.has(apt.id));
    if (unmatched.length > 0) {
      groups.push({
        status: 'other',
        label: 'Other',
        color: '#6b7280',
        count: unmatched.length,
        appointments: unmatched,
      });
    }

    return groups;
  }

  private getAppointmentsForDay(date: Date): BookingCardData[] {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    return this.allBookings
      .filter(booking => {
        const bookingDate = new Date(booking.appointmentDate);
        return bookingDate >= dayStart && bookingDate <= dayEnd;
      })
      .map(booking => ({
        id: booking.id,
        time: new Date(booking.appointmentDate).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }),
        customer: booking.customerName,
        service: booking.serviceName,
        status: booking.status,
      }))
      .sort((a, b) => a.time.localeCompare(b.time));
  }

  // Week navigation methods
  previousWeek(): void {
    this.weekStartDate = new Date(this.weekStartDate);
    this.weekStartDate.setDate(this.weekStartDate.getDate() - 7);
    this.updateCalendarDisplay();
  }

  nextWeek(): void {
    this.weekStartDate = new Date(this.weekStartDate);
    this.weekStartDate.setDate(this.weekStartDate.getDate() + 7);
    this.updateCalendarDisplay();
  }

  goToCurrentWeek(): void {
    this.weekStartDate = this.getWeekStart(new Date());
    this.updateCalendarDisplay();
  }

  getWeekRangeLabel(): string {
    const weekEnd = new Date(this.weekStartDate);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const startStr = this.weekStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    return `${startStr} - ${endStr}`;
  }

  isCurrentWeek(): boolean {
    const currentWeekStart = this.getWeekStart(new Date());
    return this.weekStartDate.getTime() === currentWeekStart.getTime();
  }

  // Placeholder for viewing booking details
  viewBookingDetails(bookingId: number): void {
    console.log('View booking details for id:', bookingId);
    // TODO: Navigate to booking detail or open modal
  }

  private loadRecentActivity(): void {
    this.recentActivity = [
      {
        id: '1',
        type: 'booking',
        icon: 'calendar',
        title: 'New booking request',
        description: 'Ahmed Hassan - Toyota Camry',
        time: '10 minutes ago',
        color: 'blue',
      },
      {
        id: '2',
        type: 'quote',
        icon: 'document',
        title: 'Quote approved',
        description: 'Sara Mohamed - Brake Service',
        time: '1 hour ago',
        color: 'green',
      },
      {
        id: '3',
        type: 'ready',
        icon: 'check',
        title: 'Car ready for pickup',
        description: 'Mohamed Ali - Oil Change',
        time: '2 hours ago',
        color: 'purple',
      },
    ];
  }

  toggleShopStatus(): void {
    this.isShopOpen = !this.isShopOpen;
    // TODO: Update shop status on backend
    console.log('Shop status:', this.isShopOpen ? 'Open' : 'Closed');
  }

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }

  navigateToProfile(): void {
    if (this.workshopProfileId) {
      this.router.navigate(['/workshop-profile', this.workshopProfileId]);
    } else {
      // Fallback to edit route if id not available
      this.router.navigate(['/workshop-profile-edit']);
    }
  }

  viewNewRequests(): void {
    this.router.navigate(['/workshop/job-board'], { queryParams: { tab: 'new' } });
  }

  viewPendingQuotes(): void {
    this.router.navigate(['/workshop/job-board'], { queryParams: { tab: 'upcoming' } });
  }

  viewReadyForPickup(): void {
    this.router.navigate(['/workshop/job-board'], { queryParams: { tab: 'ready' } });
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-EG', {
      style: 'currency',
      currency: 'EGP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  getChangeIcon(change: number): string {
    return change >= 0 ? 'trend-up' : 'trend-down';
  }

  getChangeClass(change: number): string {
    return change >= 0 ? 'positive' : 'negative';
  }

  getTimeOfDay(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Morning';
    if (hour < 18) return 'Afternoon';
    return 'Evening';
  }

  getCurrentDate(): string {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  getTotalAppointments(): number {
    return this.calendarDays.reduce((total, day) => total + day.appointments.length, 0);
  }

  getAvailableSlots(): number {
    const totalDays = this.calendarDays.length;
    const slotsPerDay = 8; // Assuming 8 appointment slots per day
    const bookedSlots = this.getTotalAppointments();
    return totalDays * slotsPerDay - bookedSlots;
  }

  // ============================================
  // VIEW MODE & DENSITY METHODS
  // ============================================

  setViewMode(mode: CalendarViewMode): void {
    this.calendarViewMode = mode;
    this.collapseAllDays();
  }

  toggleDayExpansion(dayIndex: number): void {
    if (this.expandedDayIndex === dayIndex) {
      this.expandedDayIndex = null;
      this.calendarDays[dayIndex].isExpanded = false;
    } else {
      // Collapse previously expanded
      if (this.expandedDayIndex !== null && this.calendarDays[this.expandedDayIndex]) {
        this.calendarDays[this.expandedDayIndex].isExpanded = false;
      }
      this.expandedDayIndex = dayIndex;
      this.calendarDays[dayIndex].isExpanded = true;
    }
  }

  collapseAllDays(): void {
    this.expandedDayIndex = null;
    this.calendarDays.forEach(day => day.isExpanded = false);
  }

  getVisibleAppointments(day: CalendarDay): BookingCardData[] {
    if (day.isExpanded || day.appointments.length <= this.maxVisibleAppointments) {
      return day.appointments;
    }
    return day.appointments.slice(0, this.maxVisibleAppointments);
  }

  getHiddenCount(day: CalendarDay): number {
    if (day.isExpanded) return 0;
    return Math.max(0, day.appointments.length - this.maxVisibleAppointments);
  }

  getDensityClass(day: CalendarDay): string {
    return `density-${day.densityLevel}`;
  }

  getDensityLabel(level: DensityLevel): string {
    switch (level) {
      case 'low': return 'Light';
      case 'medium': return 'Moderate';
      case 'high': return 'Busy';
      case 'critical': return 'Very Busy';
      default: return '';
    }
  }

  getStatusColor(status: string): string {
    const config = this.statusConfig.find(c => c.status === status);
    return config?.color || '#6b7280';
  }

  // Get counts by status for the week overview
  getWeekStatusCounts(): { status: string; label: string; count: number; color: string }[] {
    const counts: { [key: string]: number } = {};

    for (const day of this.calendarDays) {
      for (const apt of day.appointments) {
        const status = (apt.status || 'other').toLowerCase();
        counts[status] = (counts[status] || 0) + 1;
      }
    }

    return this.statusConfig
      .map(config => ({
        status: config.status,
        label: config.label,
        color: config.color,
        count: counts[config.status] || 0,
      }))
      .filter(item => item.count > 0);
  }

  getBusiestDay(): CalendarDay | null {
    if (this.calendarDays.length === 0) return null;
    return this.calendarDays.reduce((busiest, day) =>
      day.appointments.length > busiest.appointments.length ? day : busiest
    );
  }

  getPendingCount(): number {
    return this.calendarDays.reduce((total, day) => {
      return total + day.appointments.filter(apt =>
        (apt.status || '').toLowerCase().includes('pending')
      ).length;
    }, 0);
  }

  // Get all appointments for list view, sorted by date/time
  getAllAppointmentsSorted(): { day: CalendarDay; appointment: BookingCardData }[] {
    const all: { day: CalendarDay; appointment: BookingCardData }[] = [];

    for (const day of this.calendarDays) {
      for (const apt of day.appointments) {
        all.push({ day, appointment: apt });
      }
    }

    return all;
  }
}
