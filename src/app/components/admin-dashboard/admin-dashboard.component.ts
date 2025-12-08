import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { AdminService, WorkshopProfile as AdminWorkshopProfile, CarOwnerProfile, Car, Booking } from '../../services/admin.service';
import { AdminAnalyticsService } from '../../services/admin-analytics.service';
import { AdminDashboardStats } from '../../models/admin-dashboard-stats.model';

interface AdminMetrics {
  totalUsers: number;
  totalWorkshops: number;
  totalCarOwners: number;
  totalBookings: number;
  pendingApprovals: number;
  activeUsers: number;
  monthlyRevenue: number;
  revenueChange: number;
}

interface WorkshopProfile {
  id: number;
  name: string;
  description: string;
  numbersOfTechnicians: number;
  phoneNumber: string;
  rating: number;
  country: string;
  governorate: string;
  city: string;
  latitude: number;
  longitude: number;
  licenceImageUrl: string;
  logoImageUrl: string | null;
  verificationStatus: 'Pending' | 'Verified' | 'Rejected';
  workShopType: string;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent implements OnInit {
  adminName: string = '';
  metrics: AdminMetrics = {
    totalUsers: 0,
    totalWorkshops: 0,
    totalCarOwners: 0,
    totalBookings: 0,
    pendingApprovals: 0,
    activeUsers: 0,
    monthlyRevenue: 0,
    revenueChange: 0
  };

  recentActivities: any[] = [];
  pendingWorkshops: WorkshopProfile[] = [];
  verifiedWorkshops: WorkshopProfile[] = [];

  // Analytics data - initialized with empty structure for immediate display
  dashboardStats: AdminDashboardStats = {
    totalUsers: 0,
    totalWorkshops: 0,
    totalCarOwners: 0,
    totalCars: 0,
    totalBookings: 0,
    totalRevenue: 0,
    verifiedWorkshops: 0,
    pendingWorkshops: 0,
    averageWorkshopRating: 0,
    monthlyRevenue: [],
    bookingStatusDistribution: [],
    workshopTypeDistribution: [],
    verificationStatusDistribution: [],
    topPerformingWorkshops: [],
    carOriginDistribution: [],
    paymentMethodDistribution: [],
    topCarBrands: [],
    topCarModels: [],
    transmissionTypeDistribution: [],
    fuelTypeDistribution: [],
    fleetAgeDistribution: [],
    geographicDistribution: [],
    languagePreferences: [],
    customerInsights: {
      totalCustomers: 0,
      repeatCustomers: 0,
      repeatCustomerRate: 0,
      averageBookingsPerCustomer: 0,
      activeCustomers: 0,
      inactiveCustomers: 0
    },
    operationalMetrics: {
      averageLeadTime: 0,
      confirmationRate: 0,
      completionRate: 0,
      averageServiceValue: 0
    },
    ratingDistribution: [],
    revenueByWorkshopType: [],
    workshopSizeCategories: [],
    topWorkshopsByRevenue: []
  };
  isLoadingAnalytics: boolean = true;
  maxRevenueValue: number = 0;

  // Pagination
  unverifiedPage: number = 1;
  verifiedPage: number = 1;
  unverifiedPageSize: number = 10;
  verifiedPageSize: number = 5;
  unverifiedTotalPages: number = 0;
  verifiedTotalPages: number = 0;
  isLoading: boolean = false;
  isLoadingVerified: boolean = false;

  // Detail view
  selectedWorkshop: WorkshopProfile | null = null;
  isDetailModalOpen: boolean = false;

  private baseUrl = 'https://localhost:44316/api';

  constructor(
    private authService: AuthService,
    private router: Router,
    private http: HttpClient,
    private adminService: AdminService,
    private analyticsService: AdminAnalyticsService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    console.log('🚀 Admin Dashboard initializing...');
    this.adminName = this.authService.getUserName() || 'Admin';

    // Trigger change detection immediately to show empty state
    this.cdr.detectChanges();

    // Load all data immediately
    this.loadRecentActivities();
    this.loadAllDashboardData();
  }

  /**
   * Load all dashboard data in parallel for instant display
   */
  private loadAllDashboardData(): void {
    this.isLoading = true;
    this.isLoadingVerified = true;
    this.isLoadingAnalytics = true;

    console.log('🔄 Starting to load all dashboard data...');

    // Load everything in parallel with individual error handling
    forkJoin({
      unverifiedWorkshops: this.adminService.getUnverifiedWorkshops(this.unverifiedPage, this.unverifiedPageSize).pipe(
        catchError(err => {
          console.error('Failed to load unverified workshops:', err);
          return of({ items: [], pageNumber: 1, pageSize: 10, totalRecords: 0, totalPages: 0, hasPreviousPage: false, hasNextPage: false });
        })
      ),
      verifiedWorkshops: this.adminService.getAllWorkshops(this.verifiedPage, this.verifiedPageSize).pipe(
        catchError(err => {
          console.error('Failed to load verified workshops:', err);
          return of({ items: [], pageNumber: 1, pageSize: 5, totalRecords: 0, totalPages: 0, hasPreviousPage: false, hasNextPage: false });
        })
      ),
      allWorkshops: this.adminService.getAllWorkshopsUnpaginated().pipe(
        catchError(err => {
          console.error('Failed to load all workshops:', err);
          return of([]);
        })
      ),
      carOwners: this.adminService.getAllCarOwners().pipe(
        catchError(err => {
          console.error('Failed to load car owners:', err);
          return of([]);
        })
      ),
      cars: this.adminService.getAllCars().pipe(
        catchError(err => {
          console.error('Failed to load cars:', err);
          return of([]);
        })
      ),
      allBookings: this.adminService.getAllBookings().pipe(
        catchError(err => {
          console.error('Failed to load all bookings:', err);
          return of([]);
        })
      )
    }).subscribe({
      next: (data) => {
        console.log('📦 Raw API Response:', data);

        // Update pending workshops
        this.pendingWorkshops = data.unverifiedWorkshops?.items || [];
        this.metrics.pendingApprovals = data.unverifiedWorkshops?.totalRecords || 0;
        this.unverifiedTotalPages = data.unverifiedWorkshops?.totalPages || 0;
        this.isLoading = false;

        console.log('📊 Pending Workshops:', {
          count: this.pendingWorkshops.length,
          total: this.metrics.pendingApprovals,
          items: this.pendingWorkshops
        });

        // Update verified workshops
        this.verifiedWorkshops = data.verifiedWorkshops?.items || [];
        this.metrics.totalWorkshops = data.verifiedWorkshops?.totalRecords || 0;
        this.verifiedTotalPages = data.verifiedWorkshops?.totalPages || 0;
        this.isLoadingVerified = false;

        console.log('✅ Verified Workshops:', {
          count: this.verifiedWorkshops.length,
          total: this.metrics.totalWorkshops,
          items: this.verifiedWorkshops
        });

        // Log booking details
        console.log('📊 All Bookings:', {
          totalBookings: data.allBookings.length,
          completed: data.allBookings.filter(b => b.status === 'Completed').length,
          paid: data.allBookings.filter(b => b.paymentStatus === 'Paid').length,
          completedAndPaid: data.allBookings.filter(b => b.status === 'Completed' && b.paymentStatus === 'Paid').length,
          totalRevenue: data.allBookings
            .filter(b => b.status === 'Completed' && b.paymentStatus === 'Paid')
            .reduce((sum, b) => sum + (b.paidAmount || 0), 0),
          sampleBookings: data.allBookings.slice(0, 3)
        });

        // Calculate analytics with bookings data
        const calculatedStats = this.analyticsService.calculateDashboardStats(
          data.allWorkshops,
          data.carOwners,
          data.cars,
          data.allBookings
        );

        // Calculate total users
        const totalUsers = data.carOwners.length + data.allWorkshops.length;

        // Update metrics
        this.metrics.totalUsers = totalUsers;
        this.metrics.totalCarOwners = data.carOwners.length;
        this.metrics.totalBookings = data.allBookings.length;
        this.metrics.monthlyRevenue = calculatedStats.totalRevenue;

        // Update stats with correct counts from API
        this.dashboardStats = {
          ...calculatedStats,
          totalUsers: totalUsers,
          totalWorkshops: this.metrics.totalWorkshops,
          verifiedWorkshops: this.metrics.totalWorkshops,
          pendingWorkshops: this.metrics.pendingApprovals,
          totalCarOwners: data.carOwners.length,
          totalCars: data.cars.length
        };

        this.isLoadingAnalytics = false;

        this.maxRevenueValue = this.analyticsService.getMaxRevenueValue(
          this.dashboardStats.monthlyRevenue
        );

        // Force change detection to update the view immediately
        this.cdr.detectChanges();

        console.log('✅ All dashboard data loaded:', {
          pendingWorkshops: this.pendingWorkshops.length,
          verifiedWorkshops: this.verifiedWorkshops.length,
          totalBookings: this.metrics.totalBookings,
          totalRevenue: this.dashboardStats.totalRevenue,
          stats: this.dashboardStats
        });
      },
      error: (error) => {
        console.error('❌ Error loading dashboard data:', error);
        console.error('Error details:', {
          message: error.message,
          status: error.status,
          statusText: error.statusText,
          url: error.url,
          error: error.error
        });

        alert(`Failed to load dashboard data. Error: ${error.message || 'Unknown error'}. Please check console for details.`);

        this.isLoading = false;
        this.isLoadingVerified = false;
        this.isLoadingAnalytics = false;
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Pagination: Change page for unverified workshops
   */
  changeUnverifiedPage(page: number): void {
    if (page >= 1 && page <= this.unverifiedTotalPages) {
      this.unverifiedPage = page;
      this.loadPendingWorkshops();
    }
  }

  /**
   * Pagination: Change page for verified workshops
   */
  changeVerifiedPage(page: number): void {
    if (page >= 1 && page <= this.verifiedTotalPages) {
      this.verifiedPage = page;
      this.loadVerifiedWorkshops();
    }
  }

  /**
   * Get array of page numbers for pagination
   */
  getPageNumbers(totalPages: number): number[] {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  /**
   * Refresh all dashboard data
   */
  refreshDashboard(): void {
    this.loadAllDashboardData();
  }

  /**
   * Get bar height percentage for charts
   */
  getBarHeight(value: number): number {
    return this.analyticsService.calculateBarHeight(value, this.maxRevenueValue);
  }

  /**
   * Check if month is highest revenue month
   */
  isHighestMonth(month: any): boolean {
    if (this.dashboardStats.monthlyRevenue.length === 0) {
      return false;
    }
    const maxRevenue = Math.max(...this.dashboardStats.monthlyRevenue.map(m => m.revenue));
    return month.revenue === maxRevenue && month.revenue > 0;
  }

  /**
   * Get average booking value
   */
  getAverageBookingValue(): number {
    if (this.dashboardStats.totalBookings === 0) {
      return 0;
    }
    return this.dashboardStats.totalRevenue / this.dashboardStats.totalBookings;
  }

  /**
   * Get most common booking status
   */
  getMostCommonStatus(): string {
    if (this.dashboardStats.bookingStatusDistribution.length === 0) {
      return 'N/A';
    }
    const sorted = [...this.dashboardStats.bookingStatusDistribution].sort((a, b) => b.count - a.count);
    return sorted[0].status;
  }

  /**
   * Get most common booking status percentage
   */
  getMostCommonStatusPercentage(): number {
    if (this.dashboardStats.bookingStatusDistribution.length === 0) {
      return 0;
    }
    const sorted = [...this.dashboardStats.bookingStatusDistribution].sort((a, b) => b.count - a.count);
    return sorted[0].percentage;
  }

  /**
   * Load pending workshops for approval
   */
  private loadPendingWorkshops(): void {
    this.isLoading = true;

    this.adminService.getUnverifiedWorkshops(this.unverifiedPage, this.unverifiedPageSize).subscribe({
      next: (response) => {
        this.pendingWorkshops = response.items || [];
        this.metrics.pendingApprovals = response.totalRecords || 0;
        this.unverifiedTotalPages = response.totalPages || 0;
        this.isLoading = false;

        // Update analytics with pending count
        this.dashboardStats.pendingWorkshops = this.metrics.pendingApprovals;

        // Force change detection
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading pending workshops:', error);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Load verified workshops
   */
  private loadVerifiedWorkshops(): void {
    this.isLoadingVerified = true;

    this.adminService.getAllWorkshops(this.verifiedPage, this.verifiedPageSize).subscribe({
      next: (response) => {
        this.verifiedWorkshops = response.items || [];
        this.metrics.totalWorkshops = response.totalRecords || 0;
        this.verifiedTotalPages = response.totalPages || 0;
        this.isLoadingVerified = false;

        // Force change detection
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading verified workshops:', error);
        this.isLoadingVerified = false;
        this.cdr.detectChanges();
      }
    });
  }



  /**
   * Load bookings for analytics (background process)
   */
  private loadBookingsForAnalytics(topWorkshops: any[], allWorkshops: any[], carOwners: any[], cars: any[]): void {
    const bookingRequests = topWorkshops.map(w =>
      this.adminService.getBookingsByWorkshop(w.id)
    );

    if (bookingRequests.length === 0) return;

    console.log('🔄 Loading bookings for top', topWorkshops.length, 'workshops...');

    forkJoin(bookingRequests).subscribe({
      next: (bookingsArrays) => {
        const allBookings = bookingsArrays.flat();
        console.log('✅ Loaded bookings:', allBookings.length);

        // Recalculate with bookings using ALL workshops
        const statsWithBookings = this.analyticsService.calculateDashboardStats(
          allWorkshops,
          carOwners,
          cars,
          allBookings
        );

        // Preserve the total counts from API
        this.dashboardStats = {
          ...statsWithBookings,
          totalWorkshops: this.metrics.totalWorkshops,
          verifiedWorkshops: this.metrics.totalWorkshops,
          pendingWorkshops: this.metrics.pendingApprovals,
          totalCarOwners: carOwners.length,
          totalCars: cars.length
        };

        this.maxRevenueValue = this.analyticsService.getMaxRevenueValue(
          this.dashboardStats.monthlyRevenue
        );

        // Force change detection after bookings are loaded
        this.cdr.detectChanges();

        console.log('✅ Analytics with bookings:', this.dashboardStats);
      },
      error: (error) => {
        console.error('Error loading bookings:', error);
      }
    });
  }

  private loadRecentActivities(): void {
    // Keep mock data for now - you can implement this later
    this.recentActivities = [
      {
        id: 1,
        type: 'workshop_approval',
        icon: 'check-circle',
        title: 'Workshop Approved',
        description: 'AutoFix Workshop - Cairo',
        time: '15 minutes ago',
        color: 'green'
      },
      {
        id: 2,
        type: 'user_registered',
        icon: 'user-plus',
        title: 'New User Registration',
        description: 'John Doe registered as Car Owner',
        time: '1 hour ago',
        color: 'blue'
      }
    ];
  }

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }

  viewAllUsers(): void {
    this.router.navigate(['/admin/users']);
  }

  viewAllWorkshops(): void {
    this.router.navigate(['/admin/workshops']);
  }

  viewAllBookings(): void {
    this.router.navigate(['/admin/bookings']);
  }

  viewPendingApprovals(): void {
    this.router.navigate(['/admin/approvals']);
  }

  /**
   * Approve/Verify a workshop
   */
  approveWorkshop(workshopId: number): void {
    if (!confirm('Are you sure you want to verify this workshop?')) return;

    this.isLoading = true;

    this.adminService.verifyWorkshop(workshopId).subscribe({
      next: (response) => {
        console.log('Workshop verified:', response);
        alert('Workshop verified successfully!');
        this.closeDetailModal();
        // Reload both lists and analytics
        this.loadPendingWorkshops();
        this.loadVerifiedWorkshops();
      },
      error: (error) => {
        console.error('Error verifying workshop:', error);
        alert('Failed to verify workshop. Please try again.');
        this.isLoading = false;
      }
    });
  }

  /**
   * Reject a workshop
   */
  rejectWorkshop(workshopId: number): void {
    if (!confirm('Are you sure you want to reject this workshop? Status will remain Unverified.')) return;

    this.isLoading = true;

    this.adminService.rejectWorkshop(workshopId).subscribe({
      next: (response) => {
        console.log('Workshop rejected:', response);
        alert('Workshop rejected. Status set to Unverified.');
        this.closeDetailModal();
        // Reload pending list and analytics will update automatically
        this.loadPendingWorkshops();
        this.loadVerifiedWorkshops();
      },
      error: (error) => {
        console.error('Error rejecting workshop:', error);
        alert('Failed to reject workshop. Please try again.');
        this.isLoading = false;
      }
    });
  }

  viewWorkshopDetails(workshopId: number): void {
    this.router.navigate(['/workshop-profile', workshopId]);
  }

  getLocation(workshop: WorkshopProfile): string {
    const parts = [workshop.city, workshop.governorate, workshop.country].filter(p => p);
    return parts.join(', ') || 'Location not specified';
  }

  openDetailModal(workshop: WorkshopProfile): void {
    this.selectedWorkshop = workshop;
    this.isDetailModalOpen = true;
    document.body.style.overflow = 'hidden';
  }

  closeDetailModal(): void {
    this.selectedWorkshop = null;
    this.isDetailModalOpen = false;
    document.body.style.overflow = '';
  }

  buildAssetUrl(path: string): string {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    return `https://localhost:44316${path.startsWith('/') ? path : '/' + path}`;
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-EG', {
      style: 'currency',
      currency: 'EGP',
      minimumFractionDigits: 0
    }).format(amount);
  }

  getChangeIcon(change: number): string {
    return change >= 0 ? '↑' : '↓';
  }

  getChangeClass(change: number): string {
    return change >= 0 ? 'positive' : 'negative';
  }

  // ============================================
  // HELPER METHODS FOR NEW ANALYTICS
  // ============================================

  getPaymentColor(method: string): string {
    const colors: { [key: string]: string } = {
      'Cash': '#10b981',
      'Credit Card': '#3b82f6',
      'Debit Card': '#8b5cf6',
      'Unknown': '#6b7280'
    };
    return colors[method] || '#6b7280';
  }

  getWorkshopTypeColor(type: string): string {
    const colors: { [key: string]: string } = {
      'General Repair': '#3b82f6',
      'Specialized': '#8b5cf6',
      'Quick Service': '#10b981',
      'Body Shop': '#f59e0b',
      'Tire Service': '#ef4444'
    };
    return colors[type] || '#6b7280';
  }

  getSizeEmoji(category: string): string {
    if (category.includes('Small')) return '🏪';
    if (category.includes('Medium')) return '🏢';
    if (category.includes('Large')) return '🏭';
    return '🔧';
  }
}
