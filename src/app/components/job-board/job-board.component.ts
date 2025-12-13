import { Component, OnInit, OnDestroy, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, forkJoin, of, Observable } from 'rxjs';
import { takeUntil, switchMap, map, catchError } from 'rxjs/operators';
import { BookingService, BookingResponse } from '../../services/booking.service';
import { WorkshopProfileService } from '../../services/workshop-profile.service';
import { CarsService } from '../../services/cars.service';
import { Job, JobStatus } from '../../models/booking.model';
import { HttpClient } from '@angular/common/http';
import { ConfirmationPopupComponent } from '../shared/confirmation-popup/confirmation-popup.component';
import { ToastService } from '../../services/toast.service';
import { ProfileService } from '../../services/profile.service';
import { environment } from '../../../environments/environment';
import { NotificationType } from '../../models/notification.model';

// Interface for real booking with enriched data
export interface RealBooking {
  id: number;
  status: string;
  appointmentDate: Date;
  issueDescription: string;
  paymentMethod: string;
  carId: number;
  workshopServiceId: number;
  // Enriched data
  customerName: string;
  customerAvatar?: string;
  carMake: string;
  carModel: string;
  carYear: number;
  carLicensePlate: string;
  serviceName: string;
  urgency: string;
  createdAt?: Date;
  fullProfile?: CarOwnerProfile; // Cache full profile to avoid re-loading
}

// Interface for car owner profile from API
interface CarOwnerProfile {
  id?: number;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  phoneNumber?: string;
  profileImageUrl?: string;
  country?: string;
  governorate?: string;
  city?: string;
}

@Component({
  selector: 'app-job-board',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ConfirmationPopupComponent],
  templateUrl: './job-board.component.html',
  styleUrls: ['./job-board.component.css'],
})
export class JobBoardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private apiUrl = environment.apiBase;
  // Retry control for defensive re-loading when initial load returns empty
  private tryLoadRetries = 0;
  private readonly maxLoadRetries = 3;

  selectedTab: JobStatus = 'new';
  private _viewMode: 'kanban' | 'list' = 'kanban';

  get viewMode(): 'kanban' | 'list' {
    return this._viewMode;
  }

  set viewMode(value: 'kanban' | 'list') {
    this._viewMode = value;
    // Persist to localStorage
    try {
      localStorage.setItem('job-board-view-mode', value);
    } catch (e) {
      console.error('Error saving view mode to localStorage:', e);
    }
  }

  // List density mode
  private _listDensity: 'comfortable' | 'compact' = 'comfortable';

  get listDensity(): 'comfortable' | 'compact' {
    return this._listDensity;
  }

  set listDensity(value: 'comfortable' | 'compact') {
    this._listDensity = value;
    // Persist to localStorage
    try {
      localStorage.setItem('job-board-list-density', value);
    } catch (e) {
      console.error('Error saving list density to localStorage:', e);
    }
  }

  // Card density mode for kanban view
  private _cardDensity: 'comfortable' | 'compact' | 'dense' = 'comfortable';

  get cardDensity(): 'comfortable' | 'compact' | 'dense' {
    return this._cardDensity;
  }

  set cardDensity(value: 'comfortable' | 'compact' | 'dense') {
    this._cardDensity = value;
    // Persist to localStorage
    try {
      localStorage.setItem('job-board-card-density', value);
    } catch (e) {
      console.error('Error saving card density to localStorage:', e);
    }
  }

  // Real bookings from API
  workshopProfileId: number = 0;
  realBookings: RealBooking[] = [];
  isLoadingRealBookings = false;
  isRefreshing = false;
  lastUpdated: Date | null = null;
  autoRefreshEnabled = false;
  autoRefreshInterval = 30000; // 30 seconds default
  private autoRefreshTimer: any = null;

  // Categorized real bookings by status
  pendingBookings: RealBooking[] = []; // new requests (Pending)
  acceptedBookings: RealBooking[] = []; // upcoming (Accepted)
  inProgressBookings: RealBooking[] = []; // in progress
  readyForPickupBookings: RealBooking[] = []; // ready for pickup
  completedBookings: RealBooking[] = []; // completed

  // Keep mock jobs for backward compatibility (will be phased out)
  jobs: Job[] = [];
  newJobs: Job[] = [];
  upcomingJobs: Job[] = [];
  inProgressJobs: Job[] = [];
  readyJobs: Job[] = [];
  completedJobs: Job[] = [];

  searchQuery: string = '';
  filterUrgency: string = 'all';

  draggedJob: Job | null = null;

  // Confirmation popup state
  showDeclineConfirmation: boolean = false;
  bookingToDecline: RealBooking | null = null;

  // Accordion state - track which booking cards are expanded
  expandedBookings: Set<number> = new Set();

  // Tooltip state for car owner profile
  hoveredBookingId: number | null = null;
  tooltipProfile: CarOwnerProfile | null = null;
  tooltipLoading: boolean = false;
  tooltipPosition: { x: number; y: number } = { x: 0, y: 0 };

  // Default avatar path used when backend image is missing or fails to load
  defaultAvatar = 'Assets/images/default-profile.svg';

  // Image error handler to set default avatar when image fails to load
  setDefaultAvatar(event: Event): void {
    try {
      const img = event?.target as HTMLImageElement;
      if (!img) return;
      if (img.src && img.src.indexOf(this.defaultAvatar) === -1) {
        img.src = this.defaultAvatar;
      }
    } catch (e) {
      // ignore
    }
  }

  // Return a CSS class for avatar based on booking status
  getAvatarStatusClass(booking: RealBooking): string {
    if (!booking || !booking.status) return '';
    const status = booking.status.toLowerCase().trim();
    if (status === 'pending') return 'avatar-pending';
    if (status === 'accepted' || status === 'confirmed') return 'avatar-accepted';
    if (status === 'inprogress' || status === 'in-progress' || status === 'in progress')
      return 'avatar-inprogress';
    if (
      status === 'readyforpickup' ||
      status === 'ready-for-pickup' ||
      status === 'ready for pickup'
    )
      return 'avatar-ready';
    if (status === 'completed') return 'avatar-completed';
    return '';
  }

  // Resolve profile image URL for tooltip and other places
  getProfileImageUrl(profile?: CarOwnerProfile | null): string {
    if (!profile) return '';
    if (profile.profileImageUrl) {
      return this.profileService.getFullImageUrl(profile.profileImageUrl) || '';
    }
    return '';
  }

  constructor(
    private bookingService: BookingService,
    private workshopProfileService: WorkshopProfileService,
    private carsService: CarsService,
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private toastService: ToastService,
    private profileService: ProfileService
  ) {}

  ngOnInit(): void {
    // Load saved view mode from localStorage
    try {
      const savedViewMode = localStorage.getItem('job-board-view-mode');
      if (savedViewMode === 'kanban' || savedViewMode === 'list') {
        this._viewMode = savedViewMode;
      }
    } catch (e) {
      console.error('Error loading view mode from localStorage:', e);
    }

    // Load saved list density from localStorage
    try {
      const savedListDensity = localStorage.getItem('job-board-list-density');
      if (savedListDensity === 'comfortable' || savedListDensity === 'compact') {
        this._listDensity = savedListDensity;
      }
    } catch (e) {
      console.error('Error loading list density from localStorage:', e);
    }

    // Load card density preference
    try {
      const savedCardDensity = localStorage.getItem('job-board-card-density');
      if (
        savedCardDensity === 'comfortable' ||
        savedCardDensity === 'compact' ||
        savedCardDensity === 'dense'
      ) {
        this._cardDensity = savedCardDensity;
      }
    } catch (e) {
      console.error('Error loading card density from localStorage:', e);
    }

    // Load auto-refresh preference
    try {
      const savedAutoRefresh = localStorage.getItem('job-board-auto-refresh');
      if (savedAutoRefresh === 'true') {
        this.autoRefreshEnabled = true;
        this.startAutoRefresh();
      }
    } catch (e) {
      console.error('Error loading auto-refresh preference:', e);
    }

    // Check for tab query param
    this.route.queryParams.subscribe((params) => {
      if (params['tab']) {
        this.selectedTab = params['tab'] as JobStatus;
      }
    });

    // Load workshop profile first, then load real bookings
    this.loadWorkshopProfileAndBookings();

    // Keep mock jobs for backward compatibility
    this.loadJobs();

    // Listen for booking status changes triggered elsewhere (e.g., from notifications)
    window.addEventListener(
      'booking:status-changed',
      this.onExternalBookingStatusChanged as EventListener
    );
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh(); // Clean up auto-refresh timer
    this.destroy$.next();
    this.destroy$.complete();
    window.removeEventListener(
      'booking:status-changed',
      this.onExternalBookingStatusChanged as EventListener
    );
  }

  // Handler for external booking status change events
  private onExternalBookingStatusChanged = (event: any): void => {
    try {
      const detail = event?.detail || {};
      const status = detail.status || '';
      // Refresh bookings to pick up the change
      this.loadRealBookings();
      // If a booking was confirmed, switch to Upcoming tab so user sees it immediately
      if (status && status.toLowerCase() === 'confirmed') {
        this.selectedTab = 'upcoming';
      }
    } catch (e) {
      console.error('Error handling external booking status change event', e);
    }
  };

  // Handle clicks anywhere on the document to close tooltip
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    // Only close if tooltip is open and click is outside tooltip and customer name
    if (this.hoveredBookingId !== null) {
      if (!target.closest('.owner-tooltip') && !target.closest('.customer-name-hoverable')) {
        this.hideOwnerTooltip();
      }
    }
  }

  private loadWorkshopProfileAndBookings(): void {
    this.isLoadingRealBookings = true;
    this.workshopProfileService
      .getMyWorkshopProfile()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (resp: any) => {
          const data = resp?.data ?? resp;
          if (data && data.id) {
            this.workshopProfileId = Number(data.id);
            console.log('Workshop Profile ID loaded:', this.workshopProfileId);
            this.loadRealBookings();
          } else {
            console.error('No workshop profile ID found in response:', resp);
            this.isLoadingRealBookings = false;
          }
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error loading workshop profile:', err);
          this.isLoadingRealBookings = false;
          this.cdr.detectChanges();
        },
      });
  }

  private loadRealBookings(): void {
    if (!this.workshopProfileId) {
      console.warn('Workshop profile ID not available yet');
      return;
    }

    this.isLoadingRealBookings = true;

    this.bookingService
      .getBookingsByWorkshop(this.workshopProfileId)
      .pipe(
        takeUntil(this.destroy$),
        switchMap((bookings: BookingResponse[]) => {
          if (!bookings || bookings.length === 0) {
            return of([]);
          }

          // For each booking, fetch car owner profile and car details
          const enrichedRequests = bookings.map((booking) => {
            const carOwnerRequest = this.getCarOwnerByBookingId(booking.id);
            const carRequest = this.carsService.getCarById(booking.carId);
            const serviceRequest = this.getServiceName(booking.workshopServiceId);

            return forkJoin({
              carOwner: carOwnerRequest,
              car: carRequest,
              serviceName: serviceRequest,
            }).pipe(
              map(({ carOwner, car, serviceName }) => {
                const carData = car?.data ?? car;
                // Resolve avatar URL using ProfileService to handle relative or absolute paths
                const resolvedAvatar = carOwner?.profileImageUrl
                  ? this.profileService.getFullImageUrl(carOwner.profileImageUrl)
                  : undefined;

                return {
                  id: booking.id,
                  status: booking.status,
                  appointmentDate: new Date(booking.appointmentDate),
                  issueDescription: booking.issueDescription || '',
                  paymentMethod: booking.paymentMethod,
                  carId: booking.carId,
                  workshopServiceId: booking.workshopServiceId,
                  customerName: carOwner
                    ? `${carOwner.firstName || ''} ${carOwner.lastName || ''}`.trim() ||
                      'Unknown Customer'
                    : 'Unknown Customer',
                  customerAvatar: resolvedAvatar,
                  carMake: carData?.make || 'Unknown',
                  carModel: carData?.model || 'Unknown',
                  carYear: carData?.year || 0,
                  carLicensePlate: carData?.licensePlate || '',
                  serviceName: serviceName || 'Service',
                  urgency: this.determineUrgency(new Date(booking.appointmentDate)),
                  createdAt: booking.createdAt ? new Date(booking.createdAt) : undefined,
                  fullProfile: carOwner || undefined, // Store the full profile
                } as RealBooking;
              }),
              catchError(() =>
                of({
                  id: booking.id,
                  status: booking.status,
                  appointmentDate: new Date(booking.appointmentDate),
                  issueDescription: booking.issueDescription || '',
                  paymentMethod: booking.paymentMethod,
                  carId: booking.carId,
                  workshopServiceId: booking.workshopServiceId,
                  customerName: 'Unknown Customer',
                  carMake: 'Unknown',
                  carModel: 'Unknown',
                  carYear: 0,
                  carLicensePlate: '',
                  serviceName: 'Service',
                  urgency: 'normal',
                } as RealBooking)
              )
            );
          });

          return forkJoin(enrichedRequests);
        })
      )
      .subscribe({
        next: (enrichedBookings) => {
          this.realBookings = enrichedBookings;
          this.categorizeRealBookings();
          this.isLoadingRealBookings = false;
          this.lastUpdated = new Date(); // Update timestamp on successful load
          console.log('Bookings loaded successfully:', enrichedBookings.length);
          console.log(
            'Categorized - Pending:',
            this.pendingBookings.length,
            'Accepted:',
            this.acceptedBookings.length,
            'InProgress:',
            this.inProgressBookings.length,
            'Completed:',
            this.completedBookings.length
          );
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error loading real bookings:', err);
          this.isLoadingRealBookings = false;
          this.cdr.detectChanges();
        },
      });
  }

  private getCarOwnerByBookingId(bookingId: number): Observable<CarOwnerProfile | null> {
    return this.http.get<any>(`${this.apiUrl}/CarOwnerProfile/by-booking/${bookingId}`).pipe(
      map((response) => (response?.data || response) as CarOwnerProfile),
      catchError(() => of(null))
    );
  }

  private getServiceName(workshopServiceId: number): any {
    return this.http.get<any>(`${this.apiUrl}/WorkshopService/${workshopServiceId}`).pipe(
      switchMap((wsResponse: any) => {
        const wsData = wsResponse?.data || wsResponse;
        const serviceId = wsData?.serviceId;
        if (serviceId) {
          return this.http.get<any>(`${this.apiUrl}/Service/${serviceId}`).pipe(
            map((svcResponse) => {
              const svcData = svcResponse?.data || svcResponse;
              return svcData?.name || 'Service';
            }),
            catchError(() => of('Service'))
          );
        }
        return of(wsData?.name || 'Service');
      }),
      catchError(() => of('Service'))
    );
  }

  private determineUrgency(appointmentDate: Date): string {
    const now = new Date();
    const diffHours = (appointmentDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (diffHours < 24) return 'urgent';
    if (diffHours < 48) return 'high';
    if (diffHours < 72) return 'normal';
    return 'low';
  }

  private categorizeRealBookings(): void {
    // Ensure arrays are initialized
    this.pendingBookings = [];
    this.acceptedBookings = [];
    this.inProgressBookings = [];
    this.readyForPickupBookings = [];
    this.completedBookings = [];

    // Categorize bookings by status
    this.realBookings.forEach((booking) => {
      const status = booking.status.toLowerCase().trim();

      if (status === 'pending') {
        this.pendingBookings.push(booking);
      } else if (status === 'accepted' || status === 'confirmed') {
        this.acceptedBookings.push(booking);
      } else if (status === 'inprogress' || status === 'in-progress' || status === 'in progress') {
        this.inProgressBookings.push(booking);
      } else if (
        status === 'readyforpickup' ||
        status === 'ready-for-pickup' ||
        status === 'ready for pickup'
      ) {
        this.readyForPickupBookings.push(booking);
      } else if (status === 'completed') {
        this.completedBookings.push(booking);
      } else {
        console.warn('Unknown booking status:', booking.status, 'for booking:', booking.id);
      }
    });

    console.log('Bookings categorized:', {
      pending: this.pendingBookings.length,
      accepted: this.acceptedBookings.length,
      inProgress: this.inProgressBookings.length,
      readyForPickup: this.readyForPickupBookings.length,
      completed: this.completedBookings.length,
    });
  }

  // Confirm a booking (accept it)
  confirmBooking(booking: RealBooking, event: Event): void {
    event.stopPropagation();

    // Immediately update UI: remove from pending, add to accepted
    this.pendingBookings = this.pendingBookings.filter((b) => b.id !== booking.id);
    const confirmedBooking = { ...booking, status: 'Confirmed' };
    this.acceptedBookings = [confirmedBooking, ...this.acceptedBookings];

    // Switch to upcoming tab so user sees the confirmed booking immediately
    this.selectedTab = 'upcoming';

    this.http
      .put(`${this.apiUrl}/Booking/Update-Booking-Status`, { id: booking.id, status: 'Confirmed' })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          console.log(`Booking ${booking.id} confirmed`);
          // Show success toast
          this.toastService.success(
            'Booking Confirmed',
            `Booking from ${booking.customerName} for ${booking.carMake} ${booking.carModel} has been accepted`
          );
          // Reload bookings to ensure data consistency with backend
          this.loadRealBookings();
          // Trigger change detection to refresh UI
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error confirming booking:', err);
          this.toastService.error('Error', 'Failed to confirm booking');
          // Revert UI changes on error
          this.acceptedBookings = this.acceptedBookings.filter((b) => b.id !== booking.id);
          this.pendingBookings = [booking, ...this.pendingBookings];
          this.selectedTab = 'new';
          this.cdr.detectChanges();
        },
      });
  }

  // Decline a booking (reject it) - shows confirmation popup first
  declineBooking(booking: RealBooking, event: Event): void {
    event.stopPropagation();
    this.bookingToDecline = booking;
    this.showDeclineConfirmation = true;
  }

  // Handle decline confirmation from popup
  onDeclineConfirmed(): void {
    if (!this.bookingToDecline) return;

    const booking = this.bookingToDecline;

    // Immediately update UI: remove from pending
    this.pendingBookings = this.pendingBookings.filter((b) => b.id !== booking.id);

    this.http
      .put(`${this.apiUrl}/Booking/Update-Booking-Status`, { id: booking.id, status: 'Rejected' })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          console.log(`Booking ${booking.id} declined`);
          // Show success toast
          this.toastService.success(
            'Booking Declined',
            `Booking request from ${booking.customerName} has been declined`
          );
          // Reload bookings to ensure data consistency with backend
          this.loadRealBookings();
          // Trigger change detection to refresh UI
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error declining booking:', err);
          this.toastService.error('Error', 'Failed to decline booking');
          // Revert UI changes on error
          this.pendingBookings = [booking, ...this.pendingBookings];
          this.cdr.detectChanges();
        },
      });

    // Close popup and reset state
    this.showDeclineConfirmation = false;
    this.bookingToDecline = null;
  }

  // Handle decline cancellation from popup
  onDeclineCancelled(): void {
    this.showDeclineConfirmation = false;
    this.bookingToDecline = null;
  }

  // Mark an in-progress booking as ready for pickup
  markAsReady(booking: RealBooking, event: Event): void {
    event.stopPropagation();

    // Immediately update UI: remove from in-progress, add to ready for pickup
    this.inProgressBookings = this.inProgressBookings.filter((b) => b.id !== booking.id);
    const readyBooking = { ...booking, status: 'ReadyForPickup' };
    this.readyForPickupBookings = [readyBooking, ...this.readyForPickupBookings];

    // Switch to ready tab so user sees the booking immediately
    this.selectedTab = 'ready';

    this.http
      .put(`${this.apiUrl}/Booking/Update-Booking-Status`, {
        id: booking.id,
        status: 'ReadyForPickup',
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          console.log(`Booking ${booking.id} marked as ready for pickup`);
          // Show success toast
          this.toastService.success(
            'Ready for Pickup',
            `${booking.customerName}'s ${booking.carMake} ${booking.carModel} is ready!`
          );
          // Reload bookings to ensure data consistency with backend
          this.loadRealBookings();
          // Trigger change detection to refresh UI
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error marking booking as ready:', err);
          this.toastService.error('Error', 'Failed to mark booking as ready');
          // Revert UI changes on error
          this.readyForPickupBookings = this.readyForPickupBookings.filter(
            (b) => b.id !== booking.id
          );
          this.inProgressBookings = [booking, ...this.inProgressBookings];
          this.selectedTab = 'in-progress';
          this.cdr.detectChanges();
        },
      });
  }

  // Complete a booking (mark as completed after pickup)
  completeBooking(booking: RealBooking, event: Event): void {
    event.stopPropagation();

    // Immediately update UI: remove from ready for pickup, add to completed
    this.readyForPickupBookings = this.readyForPickupBookings.filter((b) => b.id !== booking.id);
    const completedBooking = { ...booking, status: 'Completed' };
    this.completedBookings = [completedBooking, ...this.completedBookings];

    // Switch to completed tab so user sees the booking immediately
    this.selectedTab = 'completed';

    this.http
      .put(`${this.apiUrl}/Booking/Update-Booking-Status`, { id: booking.id, status: 'Completed' })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          console.log(`Booking ${booking.id} completed`);
          // Show success toast
          this.toastService.success(
            'Booking Completed',
            `Service for ${booking.customerName}'s ${booking.carMake} ${booking.carModel} has been completed!`
          );
          // Reload bookings to ensure data consistency with backend
          this.loadRealBookings();
          // Trigger change detection to refresh UI
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error completing booking:', err);
          this.toastService.error('Error', 'Failed to complete booking');
          // Revert UI changes on error
          this.completedBookings = this.completedBookings.filter((b) => b.id !== booking.id);
          this.readyForPickupBookings = [booking, ...this.readyForPickupBookings];
          this.selectedTab = 'ready';
          this.cdr.detectChanges();
        },
      });
  }

  // Notify customer that their vehicle is ready for pickup
  notifyCustomer(booking: RealBooking, event: Event): void {
    event.stopPropagation();

    // Update booking with same ReadyForPickup status to trigger notification to car owner
    this.http
      .put(`${this.apiUrl}/Booking/Update-Booking-Status`, {
        id: booking.id,
        status: 'ReadyForPickup',
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          console.log(`Customer notified for booking ${booking.id} - vehicle ready for pickup`);
          this.toastService.success(
            'Customer Notified ✅',
            `${booking.customerName} has been notified that their ${booking.carMake} ${booking.carModel} is ready for pickup!`
          );
        },
        error: (err) => {
          console.error('Error notifying customer:', err);
          this.toastService.error(
            'Notification Failed',
            'Failed to send notification to customer. Please try again.'
          );
        },
      });
  }

  // View booking details
  viewBookingDetails(booking: RealBooking): void {
    this.router.navigate(['/workshop/job', booking.id.toString()]);
  }

  private loadJobs(): void {
    this.bookingService.getJobs().subscribe({
      next: (jobs) => {
        this.jobs = jobs;
        this.categorizeJobs();
      },
      error: (error) => {
        console.error('Error loading jobs:', error);
      },
    });
  }

  private categorizeJobs(): void {
    this.newJobs = this.jobs.filter((j) => j.status === 'new');
    this.upcomingJobs = this.jobs.filter((j) => j.status === 'upcoming');
    this.inProgressJobs = this.jobs.filter((j) => j.status === 'in-progress');
    this.readyJobs = this.jobs.filter((j) => j.status === 'ready');
    this.completedJobs = this.jobs.filter((j) => j.status === 'completed');
  }

  switchTab(tab: JobStatus): void {
    this.selectedTab = tab;
  }

  toggleViewMode(): void {
    this.viewMode = this.viewMode === 'kanban' ? 'list' : 'kanban';
  }

  getJobsByStatus(status: JobStatus): Job[] {
    switch (status) {
      case 'new':
        return this.newJobs;
      case 'upcoming':
        return this.upcomingJobs;
      case 'in-progress':
        return this.inProgressJobs;
      case 'ready':
        return this.readyJobs;
      case 'completed':
        return this.completedJobs;
      default:
        return [];
    }
  }

  getStatusLabel(status: JobStatus): string {
    const labels: Record<JobStatus, string> = {
      new: 'New Requests',
      upcoming: 'Upcoming',
      'in-progress': 'In Progress',
      ready: 'Ready for Pickup',
      completed: 'Completed',
      cancelled: 'Cancelled',
    };
    return labels[status];
  }

  getStatusCount(status: JobStatus): number {
    return this.getJobsByStatus(status).length;
  }

  getUrgencyClass(urgency: string): string {
    const classes: Record<string, string> = {
      urgent: 'urgency-urgent',
      high: 'urgency-high',
      normal: 'urgency-normal',
      low: 'urgency-low',
    };
    return classes[urgency] || 'urgency-normal';
  }

  getUrgencyLabel(urgency: string): string {
    return urgency.charAt(0).toUpperCase() + urgency.slice(1);
  }

  viewJobDetails(jobId: string): void {
    this.router.navigate(['/workshop/job', jobId]);
  }

  // Drag and Drop functionality
  onDragStart(event: DragEvent, job: Job): void {
    this.draggedJob = job;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/html', event.target as any);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  onDrop(event: DragEvent, newStatus: JobStatus): void {
    event.preventDefault();

    if (this.draggedJob && this.draggedJob.status !== newStatus) {
      this.updateJobStatus(this.draggedJob.id, newStatus);
    }

    this.draggedJob = null;
  }

  onDragEnd(): void {
    this.draggedJob = null;
  }

  updateJobStatus(jobId: string, newStatus: JobStatus): void {
    this.bookingService.updateJobStatus(jobId, newStatus).subscribe({
      next: () => {
        this.loadJobs();
        // TODO: Show success notification
        console.log('Job status updated successfully');
      },
      error: (error) => {
        console.error('Error updating job status:', error);
        // TODO: Show error notification
      },
    });
  }

  formatDate(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // Timeline interactivity - scroll to column
  scrollToColumn(columnId: string): void {
    const element = document.getElementById(columnId);
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });

      // Add temporary highlight effect
      element.classList.add('column-highlighted');
      setTimeout(() => {
        element.classList.remove('column-highlighted');
      }, 1500);
    }
  }

  refreshBookings(): void {
    if (this.isRefreshing) return;

    this.isRefreshing = true;
    this.loadRealBookings();
    this.lastUpdated = new Date();

    // Reset refreshing state after a minimum of 500ms for UX feedback
    setTimeout(() => {
      this.isRefreshing = false;
    }, 500);
  }

  getLastUpdatedText(): string {
    if (!this.lastUpdated) return '';

    const now = new Date();
    const diff = Math.floor((now.getTime() - this.lastUpdated.getTime()) / 1000);

    if (diff < 10) return 'Just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return 'Over a day ago';
  }

  toggleAutoRefresh(): void {
    this.autoRefreshEnabled = !this.autoRefreshEnabled;

    if (this.autoRefreshEnabled) {
      this.startAutoRefresh();
    } else {
      this.stopAutoRefresh();
    }

    // Persist preference
    try {
      localStorage.setItem('job-board-auto-refresh', this.autoRefreshEnabled.toString());
    } catch (e) {
      console.error('Error saving auto-refresh preference:', e);
    }
  }

  private startAutoRefresh(): void {
    this.stopAutoRefresh(); // Clear any existing timer
    this.autoRefreshTimer = setInterval(() => {
      this.refreshBookings();
    }, this.autoRefreshInterval);
  }

  private stopAutoRefresh(): void {
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer);
      this.autoRefreshTimer = null;
    }
  }

  getStageProgress(stage: string): number {
    const stages = ['received', 'diagnosing', 'repairing', 'testing', 'done'];
    const index = stages.indexOf(stage);
    return ((index + 1) / stages.length) * 100;
  }

  getStageLabel(stage: string): string {
    const labels: Record<string, string> = {
      received: 'Received',
      diagnosing: 'Diagnosing',
      repairing: 'Repairing',
      testing: 'Testing',
      done: 'Done',
    };
    return labels[stage] || stage;
  }

  // Accordion functionality
  toggleBookingExpanded(bookingId: number, event: Event): void {
    event.stopPropagation();
    event.preventDefault();

    if (this.expandedBookings.has(bookingId)) {
      this.expandedBookings.delete(bookingId);
      console.log('Collapsed booking:', bookingId);
    } else {
      this.expandedBookings.add(bookingId);
      console.log('Expanded booking:', bookingId);
    }

    // Force change detection
    this.cdr.detectChanges();
  }

  isBookingExpanded(bookingId: number): boolean {
    return this.expandedBookings.has(bookingId);
  }

  // TrackBy function for better performance with large lists
  trackByBookingId(index: number, booking: RealBooking): number {
    return booking.id;
  }

  // Tooltip methods for car owner profile - now click-based
  showOwnerTooltip(bookingId: number, event: Event): void {
    event.stopPropagation();

    // Toggle tooltip - if already showing this booking, hide it
    if (this.hoveredBookingId === bookingId) {
      this.hideOwnerTooltip();
      return;
    }

    // Get the position of the clicked element
    const target = event.target as HTMLElement;
    const rect = target.getBoundingClientRect();

    // Position tooltip to the right of the name, or left if not enough space
    const tooltipWidth = 350; // Approximate tooltip width
    const viewportWidth = window.innerWidth;
    const spaceOnRight = viewportWidth - rect.right;

    if (spaceOnRight > tooltipWidth + 20) {
      // Position to the right
      this.tooltipPosition = {
        x: rect.right + 10,
        y: rect.top,
      };
    } else {
      // Position to the left
      this.tooltipPosition = {
        x: rect.left - tooltipWidth - 10,
        y: rect.top,
      };
    }

    this.hoveredBookingId = bookingId;
    this.tooltipLoading = true;
    this.tooltipProfile = null;

    // Check if we already have the profile cached in the booking object
    const booking = this.realBookings.find((b) => b.id === bookingId);
    if (booking && booking.fullProfile) {
      this.tooltipProfile = booking.fullProfile;
      this.tooltipLoading = false;
      return;
    }

    // Fallback: Fetch car owner profile from API if not cached
    this.getCarOwnerByBookingId(bookingId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (profile) => {
          if (this.hoveredBookingId === bookingId) {
            this.tooltipProfile = profile;
            this.tooltipLoading = false;
            this.cdr.detectChanges();

            // Updates cache for next time
            if (booking && profile) {
              booking.fullProfile = profile;
            }
          }
        },
        error: (err) => {
          console.error('Error loading car owner profile:', err);
          this.tooltipLoading = false;
          this.cdr.detectChanges();
        },
      });
  }

  hideOwnerTooltip(): void {
    this.hoveredBookingId = null;
    this.tooltipProfile = null;
    this.tooltipLoading = false;
  }

  getFullAddress(profile: CarOwnerProfile | null): string {
    if (!profile) return '';
    const parts = [profile.city, profile.governorate, profile.country].filter((p) => p && p.trim());
    return parts.join(', ') || 'Address not available';
  }

  // Export all bookings to PDF
  exportToPDF(): void {
    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Calculate statistics
    const totalBookings = this.realBookings.length;
    const pendingCount = this.pendingBookings.length;
    const acceptedCount = this.acceptedBookings.length;
    const inProgressCount = this.inProgressBookings.length;
    const readyCount = this.readyForPickupBookings.length;
    const completedCount = this.completedBookings.length;

    // Helper to format date
    const formatDate = (date: Date) => {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    };

    // Helper to get urgency badge HTML
    const getUrgencyBadge = (urgency: string) => {
      const urgencyLower = urgency.toLowerCase();
      const urgencyMap: { [key: string]: string } = {
        urgent: 'Urgent',
        high: 'High',
        normal: 'Normal',
        low: 'Low',
      };
      const label = urgencyMap[urgencyLower] || urgency;
      return `<span class="urgency-badge ${urgencyLower}">${label}</span>`;
    };

    // Build booking rows for each status
    const buildBookingRows = (bookings: RealBooking[]) => {
      if (bookings.length === 0) {
        return '<tr><td colspan="6" class="no-data">No bookings in this category</td></tr>';
      }
      return bookings
        .map(
          (booking) => `
        <tr>
          <td>#${booking.id}</td>
          <td>${booking.customerName}</td>
          <td>${booking.carYear} ${booking.carMake} ${booking.carModel}</td>
          <td>${booking.serviceName}</td>
          <td>${formatDate(booking.appointmentDate)}</td>
          <td>${getUrgencyBadge(booking.urgency)}</td>
        </tr>
      `
        )
        .join('');
    };

    // Generate PDF-ready HTML with Apple-inspired design
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Workshop Bookings Report - KORIEK</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            color: #1d1d1f;
            line-height: 1.47059;
            padding: 40px;
            max-width: 1200px;
            margin: 0 auto;
            background: white;
          }

          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding-bottom: 28px;
            border-bottom: 2px solid #ef4444;
            margin-bottom: 36px;
          }
          .header-left { display: flex; flex-direction: column; gap: 6px; }
          .logo {
            font-size: 36px;
            font-weight: 700;
            color: #ef4444;
            letter-spacing: -0.03em;
          }
          .report-title {
            font-size: 17px;
            color: #6e6e73;
            font-weight: 500;
            letter-spacing: -0.015em;
          }
          .header-right { text-align: right; }
          .report-date {
            font-size: 14px;
            color: #86868b;
            font-weight: 400;
          }

          .summary-section {
            background: linear-gradient(135deg, #fee2e2 0%, #fecaca 50%, #fca5a5 100%);
            border-radius: 18px;
            padding: 32px;
            margin-bottom: 40px;
          }
          .summary-title {
            font-size: 22px;
            font-weight: 600;
            color: #1d1d1f;
            margin-bottom: 24px;
            letter-spacing: -0.02em;
          }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(6, 1fr);
            gap: 16px;
          }
          .summary-card {
            background: white;
            border-radius: 14px;
            padding: 24px 18px;
            text-align: center;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
          }
          .summary-card.total { border-left: 4px solid #ef4444; }
          .summary-card.pending { border-left: 4px solid #f87171; }
          .summary-card.accepted { border-left: 4px solid #dc2626; }
          .summary-card.in-progress { border-left: 4px solid #b91c1c; }
          .summary-card.ready { border-left: 4px solid #991b1b; }
          .summary-card.completed { border-left: 4px solid #7f1d1d; }
          .summary-number {
            font-size: 36px;
            font-weight: 700;
            margin-bottom: 8px;
            line-height: 1;
            letter-spacing: -0.03em;
          }
          .summary-card.total .summary-number { color: #ef4444; }
          .summary-card.pending .summary-number { color: #f87171; }
          .summary-card.accepted .summary-number { color: #dc2626; }
          .summary-card.in-progress .summary-number { color: #b91c1c; }
          .summary-card.ready .summary-number { color: #991b1b; }
          .summary-card.completed .summary-number { color: #7f1d1d; }
          .summary-label {
            font-size: 11px;
            color: #86868b;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            font-weight: 600;
          }

          .section {
            margin-bottom: 48px;
            page-break-inside: avoid;
          }
          .section-title {
            font-size: 20px;
            font-weight: 600;
            color: #1d1d1f;
            padding-bottom: 14px;
            border-bottom: 1.5px solid rgba(0, 0, 0, 0.08);
            margin-bottom: 24px;
            display: flex;
            align-items: center;
            gap: 12px;
            letter-spacing: -0.02em;
          }
          .section-count {
            font-size: 15px;
            color: #86868b;
            font-weight: 500;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
            background: white;
          }
          th {
            background: #f5f5f7;
            padding: 14px 16px;
            text-align: left;
            font-weight: 600;
            color: #1d1d1f;
            border-bottom: 1.5px solid rgba(0, 0, 0, 0.08);
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.6px;
          }
          td {
            padding: 16px;
            border-bottom: 0.5px solid rgba(0, 0, 0, 0.06);
            color: #1d1d1f;
            font-size: 14px;
          }
          tr:last-child td { border-bottom: none; }
          tr:hover { background: #fafafa; }

          .urgency-badge {
            display: inline-block;
            padding: 5px 12px;
            border-radius: 8px;
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.4px;
            text-transform: uppercase;
          }
          .urgency-badge.urgent { background: #ff3b30; color: white; }
          .urgency-badge.high { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 0.5px solid rgba(239, 68, 68, 0.2); }
          .urgency-badge.normal { background: rgba(0, 122, 255, 0.1); color: #007aff; border: 0.5px solid rgba(0, 122, 255, 0.2); }
          .urgency-badge.low { background: rgba(142, 142, 147, 0.1); color: #8e8e93; border: 0.5px solid rgba(142, 142, 147, 0.2); }

          .no-data {
            color: #86868b;
            font-style: italic;
            padding: 28px;
            text-align: center;
            font-size: 14px;
          }

          .footer {
            margin-top: 56px;
            padding-top: 28px;
            border-top: 1px solid rgba(0, 0, 0, 0.08);
            text-align: center;
            color: #86868b;
            font-size: 13px;
          }
          .footer-brand {
            color: #ef4444;
            font-weight: 600;
          }

          @media print {
            body { padding: 20px; }
            .section { page-break-inside: avoid; }
            tr { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-left">
            <div class="logo">KORIEK</div>
            <div class="report-title">Workshop Bookings Report</div>
          </div>
          <div class="header-right">
            <div class="report-date">Generated: ${today}</div>
          </div>
        </div>

        <div class="summary-section">
          <div class="summary-title">Booking Overview</div>
          <div class="summary-grid">
            <div class="summary-card total">
              <div class="summary-number">${totalBookings}</div>
              <div class="summary-label">Total</div>
            </div>
            <div class="summary-card pending">
              <div class="summary-number">${pendingCount}</div>
              <div class="summary-label">Pending</div>
            </div>
            <div class="summary-card accepted">
              <div class="summary-number">${acceptedCount}</div>
              <div class="summary-label">Accepted</div>
            </div>
            <div class="summary-card in-progress">
              <div class="summary-number">${inProgressCount}</div>
              <div class="summary-label">In Progress</div>
            </div>
            <div class="summary-card ready">
              <div class="summary-number">${readyCount}</div>
              <div class="summary-label">Ready</div>
            </div>
            <div class="summary-card completed">
              <div class="summary-number">${completedCount}</div>
              <div class="summary-label">Completed</div>
            </div>
          </div>
        </div>

        ${
          pendingCount > 0
            ? `
        <div class="section">
          <div class="section-title">
            Pending Bookings
            <span class="section-count">(${pendingCount})</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Booking ID</th>
                <th>Customer</th>
                <th>Vehicle</th>
                <th>Service</th>
                <th>Appointment</th>
                <th>Urgency</th>
              </tr>
            </thead>
            <tbody>
              ${buildBookingRows(this.pendingBookings)}
            </tbody>
          </table>
        </div>
        `
            : ''
        }

        ${
          acceptedCount > 0
            ? `
        <div class="section">
          <div class="section-title">
            Accepted Bookings
            <span class="section-count">(${acceptedCount})</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Booking ID</th>
                <th>Customer</th>
                <th>Vehicle</th>
                <th>Service</th>
                <th>Appointment</th>
                <th>Urgency</th>
              </tr>
            </thead>
            <tbody>
              ${buildBookingRows(this.acceptedBookings)}
            </tbody>
          </table>
        </div>
        `
            : ''
        }

        ${
          inProgressCount > 0
            ? `
        <div class="section">
          <div class="section-title">
            In Progress
            <span class="section-count">(${inProgressCount})</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Booking ID</th>
                <th>Customer</th>
                <th>Vehicle</th>
                <th>Service</th>
                <th>Appointment</th>
                <th>Urgency</th>
              </tr>
            </thead>
            <tbody>
              ${buildBookingRows(this.inProgressBookings)}
            </tbody>
          </table>
        </div>
        `
            : ''
        }

        ${
          readyCount > 0
            ? `
        <div class="section">
          <div class="section-title">
            Ready for Pickup
            <span class="section-count">(${readyCount})</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Booking ID</th>
                <th>Customer</th>
                <th>Vehicle</th>
                <th>Service</th>
                <th>Appointment</th>
                <th>Urgency</th>
              </tr>
            </thead>
            <tbody>
              ${buildBookingRows(this.readyForPickupBookings)}
            </tbody>
          </table>
        </div>
        `
            : ''
        }

        ${
          completedCount > 0
            ? `
        <div class="section">
          <div class="section-title">
            Completed Bookings
            <span class="section-count">(${completedCount})</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Booking ID</th>
                <th>Customer</th>
                <th>Vehicle</th>
                <th>Service</th>
                <th>Appointment</th>
                <th>Urgency</th>
              </tr>
            </thead>
            <tbody>
              ${buildBookingRows(this.completedBookings)}
            </tbody>
          </table>
        </div>
        `
            : ''
        }

        ${
          totalBookings === 0
            ? `
        <div class="section">
          <div class="no-data" style="padding: 80px; font-size: 16px;">
            No bookings available to export.
          </div>
        </div>
        `
            : ''
        }

        <div class="footer">
          <p>This report was generated by <span class="footer-brand">KORIEK</span> Workshop Management System</p>
          <p>© ${new Date().getFullYear()} All rights reserved</p>
        </div>
      </body>
      </html>
    `;

    // Open print window
    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();

      // Wait for content to load, then trigger print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 300);
      };
    } else {
      this.toastService.error(
        'Export Failed',
        'Failed to open print window. Please check your browser settings.'
      );
    }
  }
}
