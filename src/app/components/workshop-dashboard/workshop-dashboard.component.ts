import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule, NgIf, NgFor } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BookingService, EnrichedBooking } from '../../services/booking.service';
import { DashboardMetrics, Job } from '../../models/booking.model';
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
  imports: [CommonModule, NgIf, NgFor, RouterModule, BookingCardComponent],
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
    private workshopProfileService: WorkshopProfileService,
    private cdr: ChangeDetectorRef
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
              this.metrics = { ...this.metrics, shopRating: data.rating };
            } else if (data.Rating !== undefined && data.Rating !== null) {
              this.metrics = { ...this.metrics, shopRating: data.Rating };
            }

            // Force change detection to render data immediately
            this.cdr.detectChanges();

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
          // Force change detection to render data immediately
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error loading bookings:', err);
          this.allBookings = [];
          this.setupCalendar();
          this.isLoadingBookings = false;
          this.cdr.detectChanges();
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

    // Calculate Monthly Revenue using the exact logic:
    // Sum all PaidAmount values and multiply by 0.88 (workshop's share)
    const currentMonthRevenue = bookings
      .reduce((sum, b) => sum + (b.paidAmount || 0), 0) * 0.88;

    // Calculate last month revenue for comparison (if needed)
    // For now, we'll keep the basic calculation, but you could filter by month if needed
    const lastMonthRevenue = 0; // Set to 0 or implement last month filtering if needed

    const revenueChange = lastMonthRevenue > 0
      ? ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
      : 0;

    // Calculate Active Jobs (only in progress - matching Job Board "In Progress" card)
    const activeJobs = bookings.filter(b => {
      const status = b.status.toLowerCase().trim();
      return status === 'inprogress' || status === 'in-progress' || status === 'in progress';
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

    // Calculate Pending Payouts using the exact logic:
    // Filter bookings with PaymentMethod = "CreditCard", sum PaidAmount, multiply by 0.88
    const pendingPayouts = bookings
      .filter(b => b.paymentMethod === 'CreditCard')
      .reduce((sum, b) => sum + (b.paidAmount || 0), 0) * 0.88;

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

  /**
   * Format shop rating to display nicely (max 1 decimal, no trailing zeros)
   */
  formatRating(rating: number): string {
    if (rating === null || rating === undefined) {
      return '0';
    }
    // Round to 1 decimal place and remove trailing zeros
    const rounded = Math.round(rating * 10) / 10;
    return rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(1);
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

  getWeekRevenue(): number {
    // Calculate revenue from current week's appointments
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // End of week (Saturday)
    endOfWeek.setHours(23, 59, 59, 999);

    let weekRevenue = 0;

    // Sum up revenue from appointments this week
    this.calendarDays.forEach(day => {
      const dayDate = new Date(day.date);
      if (dayDate >= startOfWeek && dayDate <= endOfWeek) {
        day.appointments.forEach(apt => {
          if (apt.status === 'Completed' || apt.status === 'Ready for Pickup') {
            // Estimate revenue per appointment (this should come from actual booking data)
            weekRevenue += 500; // Placeholder - replace with actual revenue calculation
          }
        });
      }
    });

    return weekRevenue;
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

  // ============================================
  // ANALYTICS METHODS
  // ============================================

  /**
   * Get the count of completed jobs
   */
  getCompletedJobsCount(): number {
    return this.allBookings.filter(b => {
      const status = b.status.toLowerCase();
      return status === 'completed' || status === 'paid';
    }).length;
  }

  /**
   * Calculate job completion rate percentage
   */
  getCompletionRate(): number {
    const total = this.allBookings.length;
    if (total === 0) return 0;
    const completed = this.getCompletedJobsCount();
    return Math.round((completed / total) * 100);
  }

  /**
   * Calculate customer satisfaction percentage based on ratings
   */
  getCustomerSatisfaction(): number {
    if (this.metrics.shopRating === 0) return 0;
    return Math.round((this.metrics.shopRating / 5) * 100);
  }

  /**
   * Get top services by revenue and booking count
   */
  getTopServices(): { name: string; count: number; revenue: number; percentage: number; color: string }[] {
    // Group bookings by service
    const serviceMap = new Map<string, { count: number; revenue: number }>();

    this.allBookings.forEach(booking => {
      const serviceName = booking.serviceName || 'Other Service';
      const revenue = this.estimateBookingRevenue(booking);

      if (serviceMap.has(serviceName)) {
        const existing = serviceMap.get(serviceName)!;
        existing.count++;
        existing.revenue += revenue;
      } else {
        serviceMap.set(serviceName, { count: 1, revenue });
      }
    });

    // Convert to array and sort by revenue
    const services = Array.from(serviceMap.entries())
      .map(([name, data]) => ({
        name,
        count: data.count,
        revenue: data.revenue,
        percentage: 0,
        color: ''
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5); // Top 5 services

    // Calculate percentages
    const maxRevenue = services.length > 0 ? services[0].revenue : 1;
    const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];

    services.forEach((service, index) => {
      service.percentage = Math.round((service.revenue / maxRevenue) * 100);
      service.color = colors[index] || '#6b7280';
    });

    return services;
  }

  /**
   * Get peak hours performance from booking data
   */
  getPeakHours(): { label: string; count: number; percentage: number; hour: number }[] {
    // Initialize hours array (6 AM to 10 PM in 2-hour blocks)
    const hourBlocks = [
      { start: 6, end: 8, label: '6-8 AM' },
      { start: 8, end: 10, label: '8-10 AM' },
      { start: 10, end: 12, label: '10-12 PM' },
      { start: 12, end: 14, label: '12-2 PM' },
      { start: 14, end: 16, label: '2-4 PM' },
      { start: 16, end: 18, label: '4-6 PM' },
      { start: 18, end: 20, label: '6-8 PM' },
      { start: 20, end: 22, label: '8-10 PM' }
    ];

    const hourCounts = hourBlocks.map(block => {
      const count = this.allBookings.filter(booking => {
        const bookingDate = new Date(booking.appointmentDate);
        const hour = bookingDate.getHours();
        return hour >= block.start && hour < block.end;
      }).length;

      return {
        label: block.label,
        count,
        percentage: 0,
        hour: block.start
      };
    });

    // Calculate percentages
    const maxCount = Math.max(...hourCounts.map(h => h.count), 1);
    hourCounts.forEach(hour => {
      hour.percentage = Math.round((hour.count / maxCount) * 100);
    });

    return hourCounts;
  }

  /**
   * Get insight text for peak hours
   */
  getPeakHoursInsight(): string {
    const hours = this.getPeakHours();
    const peakHour = hours.reduce((prev, current) =>
      (current.count > prev.count) ? current : prev
    );

    if (peakHour.count === 0) {
      return 'No bookings data available yet';
    }

    return `Peak time is ${peakHour.label} with ${peakHour.count} booking${peakHour.count !== 1 ? 's' : ''}`;
  }

  /**
   * Get weekly booking trends
   */
  getWeeklyTrends(): { label: string; count: number; percentage: number; isWeekend: boolean; isToday: boolean; dayIndex: number }[] {
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date().getDay();

    // Get bookings from current week
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
    weekStart.setHours(0, 0, 0, 0);

    const dayCounts = daysOfWeek.map((label, index) => {
      const count = this.allBookings.filter(booking => {
        const bookingDate = new Date(booking.appointmentDate);
        return bookingDate >= weekStart &&
               bookingDate.getDay() === index;
      }).length;

      return {
        label,
        count,
        percentage: 0,
        isWeekend: index === 0 || index === 6,
        isToday: index === today,
        dayIndex: index
      };
    });

    // Calculate percentages
    const maxCount = Math.max(...dayCounts.map(d => d.count), 1);
    dayCounts.forEach(day => {
      day.percentage = Math.round((day.count / maxCount) * 100);
    });

    return dayCounts;
  }

  /**
   * Get the busiest day of the week
   */
  getBusiestDayOfWeek(): string {
    const trends = this.getWeeklyTrends();
    const busiestDay = trends.reduce((prev, current) =>
      (current.count > prev.count) ? current : prev
    );

    if (busiestDay.count === 0) {
      return 'N/A';
    }

    return `${busiestDay.label} (${busiestDay.count})`;
  }

  /**
   * Get total bookings for current week
   */
  getTotalWeekBookings(): number {
    const trends = this.getWeeklyTrends();
    return trends.reduce((sum, day) => sum + day.count, 0);
  }

  /**
   * Export comprehensive workshop dashboard report as PDF
   */
  exportToPDF(): void {
    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Get data for the report
    const topServices = this.getTopServices();
    const peakHours = this.getPeakHours();
    const weeklyTrends = this.getWeeklyTrends();
    const completedJobsCount = this.getCompletedJobsCount();
    const completionRate = this.getCompletionRate();
    const customerSatisfaction = this.getCustomerSatisfaction();

    // Build top services rows
    const topServicesRows = topServices
      .map(
        (service) => `
      <tr>
        <td>${service.name}</td>
        <td class="amount">${service.revenue.toLocaleString()} EGP</td>
        <td>${service.count}</td>
        <td>
          <div class="progress-bar-container">
            <div class="progress-bar" style="width: ${service.percentage}%; background-color: ${service.color}"></div>
            <span class="progress-label">${service.percentage}%</span>
          </div>
        </td>
      </tr>
    `
      )
      .join('');

    // Build peak hours chart
    const peakHoursChart = peakHours
      .map(
        (hour) => `
      <div class="chart-bar-item">
        <div class="chart-bar-label">${hour.label}</div>
        <div class="chart-bar-container">
          <div class="chart-bar" style="width: ${hour.percentage}%">
            <span class="chart-bar-value">${hour.count}</span>
          </div>
        </div>
      </div>
    `
      )
      .join('');

    // Build weekly trends chart
    const weeklyTrendsChart = weeklyTrends
      .map(
        (day) => `
      <div class="chart-bar-item ${day.isWeekend ? 'weekend' : ''} ${day.isToday ? 'today' : ''}">
        <div class="chart-bar-label">${day.label}</div>
        <div class="chart-bar-container">
          <div class="chart-bar" style="height: ${day.percentage}%">
            <span class="chart-bar-value">${day.count}</span>
          </div>
        </div>
      </div>
    `
      )
      .join('');

    // Build recent bookings table
    const recentBookingsRows = this.allBookings
      .slice(0, 10) // Last 10 bookings
      .map(
        (booking) => `
      <tr>
        <td>${new Date(booking.appointmentDate).toLocaleDateString('en-US')}</td>
        <td>${booking.customerName || 'N/A'}</td>
        <td>${booking.serviceName || 'Service'}</td>
        <td><span class="status-badge ${booking.status.toLowerCase()}">${booking.status}</span></td>
        <td class="amount">${this.estimateBookingRevenue(booking).toLocaleString()} EGP</td>
      </tr>
    `
      )
      .join('');

    // Generate PDF-ready HTML
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Workshop Dashboard Report - ${this.shopName}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Segoe UI', Arial, sans-serif;
            color: #1f2937;
            line-height: 1.5;
            padding: 40px;
            max-width: 900px;
            margin: 0 auto;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 20px;
            border-bottom: 3px solid #ef4444;
            margin-bottom: 30px;
          }
          .header-left {
            display: flex;
            flex-direction: column;
          }
          .header-right {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 8px;
          }
          .logo { font-size: 28px; font-weight: 700; color: #ef4444; }
          .report-title { font-size: 14px; color: #6b7280; margin-top: 4px; }
          .report-date { font-size: 12px; color: #9ca3af; text-align: right; }

          .workshop-header {
            background: linear-gradient(135deg, #fee2e2 0%, #fef3c7 100%);
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 24px;
          }
          .workshop-name { font-size: 24px; font-weight: 700; color: #111827; }
          .workshop-subtitle { font-size: 14px; color: #6b7280; margin-top: 4px; }
          .workshop-details {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
            margin-top: 16px;
          }
          .detail-item { }
          .detail-label { font-size: 11px; color: #9ca3af; text-transform: uppercase; }
          .detail-value { font-size: 14px; font-weight: 600; color: #374151; }

          .section {
            margin-bottom: 28px;
            page-break-inside: avoid;
          }
          .section-title {
            font-size: 16px;
            font-weight: 700;
            color: #111827;
            padding-bottom: 8px;
            border-bottom: 2px solid #e5e7eb;
            margin-bottom: 16px;
          }

          .metrics-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin-bottom: 20px;
          }
          .metric-card {
            background: #f9fafb;
            border-radius: 8px;
            padding: 16px;
            text-align: center;
          }
          .metric-card.revenue { border-left: 4px solid #ef4444; }
          .metric-card.payout { border-left: 4px solid #f59e0b; }
          .metric-card.rating { border-left: 4px solid #10b981; }
          .metric-card.jobs { border-left: 4px solid #3b82f6; }
          .metric-number { font-size: 28px; font-weight: 700; }
          .metric-card.revenue .metric-number { color: #ef4444; }
          .metric-card.payout .metric-number { color: #f59e0b; }
          .metric-card.rating .metric-number { color: #10b981; }
          .metric-card.jobs .metric-number { color: #3b82f6; }
          .metric-label { font-size: 11px; color: #6b7280; text-transform: uppercase; margin-top: 4px; }

          .analytics-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
            margin-bottom: 20px;
          }
          .analytics-card {
            background: #f9fafb;
            border-radius: 8px;
            padding: 16px;
            text-align: center;
          }
          .analytics-value { font-size: 32px; font-weight: 700; color: #111827; }
          .analytics-label { font-size: 11px; color: #6b7280; text-transform: uppercase; margin-top: 4px; }
          .analytics-subtitle { font-size: 12px; color: #9ca3af; margin-top: 4px; }

          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
          }
          th {
            background: #f3f4f6;
            padding: 10px 12px;
            text-align: left;
            font-weight: 600;
            color: #374151;
            border-bottom: 2px solid #e5e7eb;
          }
          td {
            padding: 10px 12px;
            border-bottom: 1px solid #e5e7eb;
          }
          td.amount { text-align: right; font-weight: 600; color: #111827; }
          tr:last-child td { border-bottom: none; }

          .status-badge {
            display: inline-block;
            padding: 3px 10px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
          }
          .status-badge.pending { background: #fef3c7; color: #92400e; }
          .status-badge.accepted { background: #d1fae5; color: #065f46; }
          .status-badge.progress, .status-badge.inprogress { background: #dbeafe; color: #1e3a8a; }
          .status-badge.completed { background: #dcfce7; color: #166534; }
          .status-badge.rejected, .status-badge.cancelled { background: #fee2e2; color: #991b1b; }

          .progress-bar-container {
            position: relative;
            width: 100%;
            height: 24px;
            background: #e5e7eb;
            border-radius: 4px;
            overflow: hidden;
          }
          .progress-bar {
            height: 100%;
            background: #3b82f6;
            display: flex;
            align-items: center;
            justify-content: flex-end;
            padding-right: 8px;
            transition: width 0.3s ease;
          }
          .progress-label {
            position: absolute;
            right: 8px;
            top: 50%;
            transform: translateY(-50%);
            font-size: 10px;
            font-weight: 600;
            color: #fff;
            mix-blend-mode: difference;
          }

          .chart-bar-item {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 8px;
          }
          .chart-bar-label {
            min-width: 80px;
            font-size: 11px;
            font-weight: 600;
            color: #6b7280;
          }
          .chart-bar-container {
            flex: 1;
            height: 32px;
            background: #f3f4f6;
            border-radius: 4px;
            position: relative;
            overflow: hidden;
          }
          .chart-bar {
            height: 100%;
            background: #3b82f6;
            display: flex;
            align-items: center;
            justify-content: flex-end;
            padding-right: 8px;
          }
          .chart-bar-value {
            font-size: 11px;
            font-weight: 600;
            color: #fff;
          }

          .weekly-chart {
            display: flex;
            align-items: flex-end;
            justify-content: space-around;
            gap: 12px;
            height: 180px;
            padding: 12px;
            background: #f9fafb;
            border-radius: 8px;
            margin-bottom: 20px;
          }
          .weekly-chart .chart-bar-item {
            flex-direction: column;
            align-items: center;
            flex: 1;
            margin-bottom: 0;
          }
          .weekly-chart .chart-bar-container {
            width: 100%;
            height: 140px;
            background: #e5e7eb;
            display: flex;
            align-items: flex-end;
          }
          .weekly-chart .chart-bar {
            width: 100%;
            background: #3b82f6;
            justify-content: center;
            padding: 4px;
          }
          .weekly-chart .chart-bar-item.weekend .chart-bar { background: #f59e0b; }
          .weekly-chart .chart-bar-item.today .chart-bar { background: #ef4444; }
          .weekly-chart .chart-bar-label {
            margin-top: 8px;
            text-align: center;
          }

          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            color: #9ca3af;
            font-size: 11px;
          }

          .no-data { color: #9ca3af; font-style: italic; padding: 20px; text-align: center; }

          @media print {
            body { padding: 20px; }
            .section { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-left">
            <div class="logo">KORIEK</div>
            <div class="report-title">Workshop Dashboard Report</div>
          </div>
          <div class="header-right">
            <div class="report-date">Generated: ${today}</div>
          </div>
        </div>

        <div class="workshop-header">
          <div class="workshop-name">${this.shopName}</div>
          <div class="workshop-subtitle">Performance Overview & Analytics</div>
          <div class="workshop-details">
            <div class="detail-item">
              <div class="detail-label">Shop Status</div>
              <div class="detail-value">${this.isShopOpen ? 'Open' : 'Closed'}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Total Bookings</div>
              <div class="detail-value">${this.allBookings.length}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Report Date</div>
              <div class="detail-value">${today}</div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Key Performance Metrics</div>
          <div class="metrics-grid">
            <div class="metric-card revenue">
              <div class="metric-number">${this.formatCurrency(this.metrics.monthlyRevenue)}</div>
              <div class="metric-label">Monthly Revenue</div>
            </div>
            <div class="metric-card payout">
              <div class="metric-number">${this.formatCurrency(this.metrics.pendingPayouts)}</div>
              <div class="metric-label">Pending Payouts</div>
            </div>
            <div class="metric-card rating">
              <div class="metric-number">${this.formatRating(this.metrics.shopRating)}/5.0</div>
              <div class="metric-label">Shop Rating</div>
            </div>
            <div class="metric-card jobs">
              <div class="metric-number">${this.metrics.activeJobs}</div>
              <div class="metric-label">Active Jobs</div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Business Analytics</div>
          <div class="analytics-grid">
            <div class="analytics-card">
              <div class="analytics-value">${completedJobsCount}</div>
              <div class="analytics-label">Completed Jobs</div>
              <div class="analytics-subtitle">${completionRate}% completion rate</div>
            </div>
            <div class="analytics-card">
              <div class="analytics-value">${customerSatisfaction}%</div>
              <div class="analytics-label">Customer Satisfaction</div>
              <div class="analytics-subtitle">Based on ${this.metrics.totalReviews} reviews</div>
            </div>
            <div class="analytics-card">
              <div class="analytics-value">${this.metrics.newBookingRequests}</div>
              <div class="analytics-label">New Requests</div>
              <div class="analytics-subtitle">Pending approval</div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Top Services by Revenue</div>
          ${
            topServices.length > 0
              ? `
          <table>
            <thead>
              <tr>
                <th>Service Name</th>
                <th style="text-align: right;">Revenue</th>
                <th>Bookings</th>
                <th style="width: 200px;">Performance</th>
              </tr>
            </thead>
            <tbody>
              ${topServicesRows}
            </tbody>
          </table>
          `
              : '<div class="no-data">No service data available</div>'
          }
        </div>

        <div class="section">
          <div class="section-title">Peak Hours Performance</div>
          ${
            peakHours.length > 0
              ? `<div>${peakHoursChart}</div>`
              : '<div class="no-data">No booking time data available</div>'
          }
        </div>

        <div class="section">
          <div class="section-title">Weekly Booking Trends</div>
          ${
            weeklyTrends.length > 0
              ? `<div class="weekly-chart">${weeklyTrendsChart}</div>`
              : '<div class="no-data">No weekly trend data available</div>'
          }
        </div>

        <div class="section">
          <div class="section-title">Recent Bookings (Last 10)</div>
          ${
            this.allBookings.length > 0
              ? `
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Customer</th>
                <th>Service</th>
                <th>Status</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${recentBookingsRows}
            </tbody>
          </table>
          `
              : '<div class="no-data">No booking records found</div>'
          }
        </div>

        <div class="footer">
          <p>This report was automatically generated by KORIEK Workshop Management System.</p>
          <p>For questions or support, please contact us through the app.</p>
        </div>
      </body>
      </html>
    `;

    // Open print window
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();

      // Wait for content to load, then trigger print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 250);
      };
    }
  }
}
