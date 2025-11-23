import { Component, OnInit } from '@angular/core';
import { CommonModule, NgIf, NgFor } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BookingService } from '../../services/booking.service';
import { DashboardMetrics, Job } from '../../models/booking.model';
import { ActionBadgeComponent } from '../shared/action-badge/action-badge.component';
import { StatCardComponent } from '../shared/stat-card/stat-card.component';
import { SectionHeaderComponent } from '../shared/section-header/section-header.component';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-workshop-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    NgIf,
    NgFor,
    RouterModule,
    ActionBadgeComponent,
    StatCardComponent,
    SectionHeaderComponent
  ],
  templateUrl: './workshop-dashboard.component.html',
  styleUrl: './workshop-dashboard.component.css'
})
export class WorkshopDashboardComponent implements OnInit {
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
    activeJobs: 0
  };

  isShopOpen: boolean = true;
  shopName: string = 'My Workshop';
  
  upcomingAppointments: any[] = [];
  recentActivity: any[] = [];
  
  currentDate: Date = new Date();
  currentMonth: string = '';
  currentYear: number = 0;
  calendarDays: any[] = [];

  // (Location modal moved to workshop profile edit page)

  constructor(
    private bookingService: BookingService,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
    this.setupCalendar();
    this.loadRecentActivity();
  }

  /**
   * Check if we should request location and show the modal
   */
  // Location modal logic moved to `workshop-profile-edit` component

  private loadDashboardData(): void {
    this.bookingService.getDashboardMetrics().subscribe({
      next: (metrics) => {
        this.metrics = metrics;
      },
      error: (error) => {
        console.error('Error loading dashboard metrics:', error);
      }
    });
  }

  private setupCalendar(): void {
    const now = new Date();
    this.currentMonth = now.toLocaleDateString('en-US', { month: 'long' });
    this.currentYear = now.getFullYear();
    
    // Generate calendar days for current week
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    
    this.calendarDays = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      
      this.calendarDays.push({
        date: day,
        dayName: day.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: day.getDate(),
        isToday: day.toDateString() === now.toDateString(),
        appointments: this.getAppointmentsForDay(day)
      });
    }
  }

  private getAppointmentsForDay(date: Date): any[] {
    // Mock appointments - replace with actual data
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) return []; // Weekend
    
    return [
      {
        time: '09:00 AM',
        customer: 'Ahmed Hassan',
        vehicle: 'Toyota Camry',
        service: 'Engine Diagnostics'
      },
      {
        time: '11:30 AM',
        customer: 'Sara Mohamed',
        vehicle: 'Honda Civic',
        service: 'Brake Service'
      }
    ];
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
        color: 'blue'
      },
      {
        id: '2',
        type: 'quote',
        icon: 'document',
        title: 'Quote approved',
        description: 'Sara Mohamed - Brake Service',
        time: '1 hour ago',
        color: 'green'
      },
      {
        id: '3',
        type: 'ready',
        icon: 'check',
        title: 'Car ready for pickup',
        description: 'Mohamed Ali - Oil Change',
        time: '2 hours ago',
        color: 'purple'
      }
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
      maximumFractionDigits: 0
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
      day: 'numeric' 
    });
  }

  getTotalAppointments(): number {
    return this.calendarDays.reduce((total, day) => total + day.appointments.length, 0);
  }

  getAvailableSlots(): number {
    const totalDays = this.calendarDays.length;
    const slotsPerDay = 8; // Assuming 8 appointment slots per day
    const bookedSlots = this.getTotalAppointments();
    return (totalDays * slotsPerDay) - bookedSlots;
  }
}
