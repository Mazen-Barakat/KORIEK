import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';

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

  // Pagination
  unverifiedPage: number = 1;
  verifiedPage: number = 1;
  pageSize: number = 10;
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
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.adminName = this.authService.getUserName() || 'Admin';
    this.loadPendingWorkshops();
    this.loadVerifiedWorkshops();
    this.loadRecentActivities();
  }

  private loadPendingWorkshops(): void {
    this.isLoading = true;
    const params = new HttpParams()
      .set('PageNumber', this.unverifiedPage.toString())
      .set('PageSize', this.pageSize.toString());

    this.http.get<any>(
      `${this.baseUrl}/WorkShopProfile/Get-All-Unverified-WorkShop-Profile`,
      { params }
    ).subscribe({
      next: (response) => {
        console.log('Unverified workshops response:', response);
        if (response.success && response.data) {
          this.pendingWorkshops = response.data.items || [];
          this.metrics.pendingApprovals = response.data.totalRecords || 0;
          this.unverifiedTotalPages = response.data.totalPages || 0;
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading pending workshops:', error);
        this.isLoading = false;
      }
    });
  }

  private loadVerifiedWorkshops(): void {
    this.isLoadingVerified = true;
    const params = new HttpParams()
      .set('PageNumber', this.verifiedPage.toString())
      .set('PageSize', this.pageSize.toString());

    this.http.get<any>(
      `${this.baseUrl}/WorkShopProfile/Get-All-WorkShop-Profiles`,
      { params }
    ).subscribe({
      next: (response) => {
        console.log('Verified workshops response:', response);
        if (response.success && response.data) {
          this.verifiedWorkshops = response.data.items || [];
          this.metrics.totalWorkshops = response.data.totalRecords || 0;
          this.verifiedTotalPages = response.data.totalPages || 0;
        }
        this.isLoadingVerified = false;
      },
      error: (error) => {
        console.error('Error loading verified workshops:', error);
        this.isLoadingVerified = false;
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

  approveWorkshop(workshopId: number): void {
    if (!confirm('Are you sure you want to verify this workshop?')) return;

    this.isLoading = true;
    this.http.put(
      `${this.baseUrl}/WorkShopProfile/Update-WorkShop-Profile-Status`,
      {
        id: workshopId,
        verificationStatus: 'Verified'
      }
    ).subscribe({
      next: (response) => {
        console.log('Workshop verified:', response);
        alert('Workshop verified successfully!');
        this.closeDetailModal();
        // Reload both lists
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

  rejectWorkshop(workshopId: number): void {
    if (!confirm('Are you sure you want to reject this workshop? Status will remain Unverified.')) return;

    this.isLoading = true;
    this.http.put(
      `${this.baseUrl}/WorkShopProfile/Update-WorkShop-Profile-Status`,
      {
        id: workshopId,
        verificationStatus: 'Unverified'
      }
    ).subscribe({
      next: (response) => {
        console.log('Workshop rejected:', response);
        alert('Workshop rejected. Status set to Unverified.');
        this.closeDetailModal();
        // Reload pending list
        this.loadPendingWorkshops();
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
}
