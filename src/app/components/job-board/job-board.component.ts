import { Component, OnInit, OnDestroy } from '@angular/core';
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
}

// Interface for car owner profile from API
interface CarOwnerProfile {
  id?: number;
  firstName?: string;
  lastName?: string;
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
  styleUrls: ['./job-board.component.css']
})
export class JobBoardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private apiUrl = 'https://localhost:44316/api';
  // Retry control for defensive re-loading when initial load returns empty
  private tryLoadRetries = 0;
  private readonly maxLoadRetries = 3;
  
  selectedTab: JobStatus = 'new';
  viewMode: 'kanban' | 'list' = 'kanban';
  
  // Real bookings from API
  workshopProfileId: number = 0;
  realBookings: RealBooking[] = [];
  isLoadingRealBookings = false;
  
  // Categorized real bookings by status
  pendingBookings: RealBooking[] = [];      // new requests (Pending)
  acceptedBookings: RealBooking[] = [];     // upcoming (Accepted)
  inProgressBookings: RealBooking[] = [];   // in progress
  completedBookings: RealBooking[] = [];    // completed
  
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

  constructor(
    private bookingService: BookingService,
    private workshopProfileService: WorkshopProfileService,
    private carsService: CarsService,
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Check for tab query param
    this.route.queryParams.subscribe(params => {
      if (params['tab']) {
        this.selectedTab = params['tab'] as JobStatus;
      }
    });
    
    // Load workshop profile first, then load real bookings
    this.loadWorkshopProfileAndBookings();
    // Defensive retry in case initial load misses data due to timing/auth race
    // This will attempt to reload bookings a few times automatically.
    this.scheduleRetryIfNeeded();
    
    // Keep mock jobs for backward compatibility
    this.loadJobs();

    // Listen for booking status changes triggered elsewhere (e.g., from notifications)
    window.addEventListener('booking:status-changed', this.onExternalBookingStatusChanged as EventListener);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    window.removeEventListener('booking:status-changed', this.onExternalBookingStatusChanged as EventListener);
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
  }

  private loadWorkshopProfileAndBookings(): void {
    this.workshopProfileService.getMyWorkshopProfile()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (resp: any) => {
          const data = resp?.data ?? resp;
          if (data && data.id) {
            this.workshopProfileId = Number(data.id);
            this.loadRealBookings();
          }
        },
        error: (err) => {
          console.error('Error loading workshop profile:', err);
        }
      });
  }

  private loadRealBookings(): void {
    if (!this.workshopProfileId) return;
    
    this.isLoadingRealBookings = true;
    
    this.bookingService.getBookingsByWorkshop(this.workshopProfileId)
      .pipe(
        takeUntil(this.destroy$),
        switchMap((bookings: BookingResponse[]) => {
          if (!bookings || bookings.length === 0) {
            return of([]);
          }
          
          // For each booking, fetch car owner profile and car details
          const enrichedRequests = bookings.map(booking => {
            const carOwnerRequest = this.getCarOwnerByBookingId(booking.id);
            const carRequest = this.carsService.getCarById(booking.carId);
            const serviceRequest = this.getServiceName(booking.workshopServiceId);
            
            return forkJoin({
              carOwner: carOwnerRequest,
              car: carRequest,
              serviceName: serviceRequest
            }).pipe(
              map(({ carOwner, car, serviceName }) => {
                const carData = car?.data ?? car;
                return {
                  id: booking.id,
                  status: booking.status,
                  appointmentDate: new Date(booking.appointmentDate),
                  issueDescription: booking.issueDescription || '',
                  paymentMethod: booking.paymentMethod,
                  carId: booking.carId,
                  workshopServiceId: booking.workshopServiceId,
                  customerName: carOwner ? `${carOwner.firstName || ''} ${carOwner.lastName || ''}`.trim() || 'Unknown Customer' : 'Unknown Customer',
                  customerAvatar: carOwner?.profileImageUrl ? `https://localhost:44316${carOwner.profileImageUrl}` : undefined,
                  carMake: carData?.make || 'Unknown',
                  carModel: carData?.model || 'Unknown',
                  carYear: carData?.year || 0,
                  carLicensePlate: carData?.licensePlate || '',
                  serviceName: serviceName || 'Service',
                  urgency: this.determineUrgency(new Date(booking.appointmentDate)),
                  createdAt: booking.createdAt ? new Date(booking.createdAt) : undefined
                } as RealBooking;
              }),
              catchError(() => of({
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
                urgency: 'normal'
              } as RealBooking))
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
          // If we successfully loaded bookings, reset retry counter
          if (this.pendingBookings && this.pendingBookings.length > 0) {
            this.tryLoadRetries = 0;
          }
        },
        error: (err) => {
          console.error('Error loading real bookings:', err);
          this.isLoadingRealBookings = false;
          // Try again defensively if initial call failed
          this.retryLoadIfEmpty();
        }
      });
  }

  /**
   * Schedule initial retry attempts. This handles race conditions where auth/profile
   * information becomes available a short time after component init (e.g. other
   * services initialize). Will attempt to load bookings again until success or
   * until `maxLoadRetries` is reached.
   */
  private scheduleRetryIfNeeded(): void {
    // If we already have profile id, ensure bookings are loaded and run retry logic
    if (this.workshopProfileId) {
      this.loadRealBookings();
      this.retryLoadIfEmpty();
      return;
    }

    // Otherwise, poll briefly for the profile id to appear, then load bookings
    const checkProfile = () => {
      if (this.workshopProfileId) {
        this.loadRealBookings();
        this.retryLoadIfEmpty();
      } else if (this.tryLoadRetries < this.maxLoadRetries) {
        this.tryLoadRetries++;
        setTimeout(checkProfile, 1000 * this.tryLoadRetries);
      }
    };

    checkProfile();
  }

  /**
   * Retry loading bookings if pending bookings remain empty. Uses exponential backoff.
   */
  private retryLoadIfEmpty(): void {
    if (!this.workshopProfileId) return;

    const pendingCount = this.pendingBookings ? this.pendingBookings.length : 0;
    if (pendingCount === 0 && this.tryLoadRetries < this.maxLoadRetries) {
      const delay = 1000 * Math.pow(2, this.tryLoadRetries); // 1s, 2s, 4s...
      this.tryLoadRetries++;
      setTimeout(() => {
        this.loadRealBookings();
        // schedule another retry if still empty
        this.retryLoadIfEmpty();
      }, delay);
    } else if (pendingCount > 0) {
      this.tryLoadRetries = 0;
    }
  }

  private getCarOwnerByBookingId(bookingId: number): Observable<CarOwnerProfile | null> {
    return this.http.get<any>(`${this.apiUrl}/CarOwnerProfile/by-booking/${bookingId}`).pipe(
      map(response => (response?.data || response) as CarOwnerProfile),
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
            map(svcResponse => {
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
    this.pendingBookings = this.realBookings.filter(b => 
      b.status.toLowerCase() === 'pending'
    );
    this.acceptedBookings = this.realBookings.filter(b => 
      b.status.toLowerCase() === 'accepted' || b.status.toLowerCase() === 'confirmed'
    );
    this.inProgressBookings = this.realBookings.filter(b => 
      b.status.toLowerCase() === 'inprogress' || b.status.toLowerCase() === 'in-progress'
    );
    this.completedBookings = this.realBookings.filter(b => 
      b.status.toLowerCase() === 'completed'
    );
  }

  // Confirm a booking (accept it)
  confirmBooking(booking: RealBooking, event: Event): void {
    event.stopPropagation();
    
    // Immediately update UI: remove from pending, add to accepted
    this.pendingBookings = this.pendingBookings.filter(b => b.id !== booking.id);
    const confirmedBooking = { ...booking, status: 'Confirmed' };
    this.acceptedBookings = [confirmedBooking, ...this.acceptedBookings];
    
    // Switch to upcoming tab so user sees the confirmed booking immediately
    this.selectedTab = 'upcoming';
    
    this.http.put(`${this.apiUrl}/Booking/Update-Booking-Status`, { id: booking.id, status: 'Confirmed' })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          console.log(`Booking ${booking.id} confirmed`);
          // Reload bookings to ensure data consistency with backend
          this.loadRealBookings();
        },
        error: (err) => {
          console.error('Error confirming booking:', err);
          // Revert UI changes on error
          this.acceptedBookings = this.acceptedBookings.filter(b => b.id !== booking.id);
          this.pendingBookings = [booking, ...this.pendingBookings];
          this.selectedTab = 'new';
        }
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
    this.pendingBookings = this.pendingBookings.filter(b => b.id !== booking.id);
    
    this.http.put(`${this.apiUrl}/Booking/Update-Booking-Status`, { id: booking.id, status: 'Rejected' })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          console.log(`Booking ${booking.id} declined`);
          // Reload bookings to ensure data consistency with backend
          this.loadRealBookings();
        },
        error: (err) => {
          console.error('Error declining booking:', err);
          // Revert UI changes on error
          this.pendingBookings = [booking, ...this.pendingBookings];
        }
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
      }
    });
  }

  private categorizeJobs(): void {
    this.newJobs = this.jobs.filter(j => j.status === 'new');
    this.upcomingJobs = this.jobs.filter(j => j.status === 'upcoming');
    this.inProgressJobs = this.jobs.filter(j => j.status === 'in-progress');
    this.readyJobs = this.jobs.filter(j => j.status === 'ready');
    this.completedJobs = this.jobs.filter(j => j.status === 'completed');
  }

  switchTab(tab: JobStatus): void {
    this.selectedTab = tab;
  }

  toggleViewMode(): void {
    this.viewMode = this.viewMode === 'kanban' ? 'list' : 'kanban';
  }

  getJobsByStatus(status: JobStatus): Job[] {
    switch (status) {
      case 'new': return this.newJobs;
      case 'upcoming': return this.upcomingJobs;
      case 'in-progress': return this.inProgressJobs;
      case 'ready': return this.readyJobs;
      case 'completed': return this.completedJobs;
      default: return [];
    }
  }

  getStatusLabel(status: JobStatus): string {
    const labels: Record<JobStatus, string> = {
      'new': 'New Requests',
      'upcoming': 'Upcoming',
      'in-progress': 'In Progress',
      'ready': 'Ready for Pickup',
      'completed': 'Completed',
      'cancelled': 'Cancelled'
    };
    return labels[status];
  }

  getStatusCount(status: JobStatus): number {
    return this.getJobsByStatus(status).length;
  }

  getUrgencyClass(urgency: string): string {
    const classes: Record<string, string> = {
      'urgent': 'urgency-urgent',
      'high': 'urgency-high',
      'normal': 'urgency-normal',
      'low': 'urgency-low'
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
      }
    });
  }

  formatDate(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getStageProgress(stage: string): number {
    const stages = ['received', 'diagnosing', 'repairing', 'testing', 'done'];
    const index = stages.indexOf(stage);
    return ((index + 1) / stages.length) * 100;
  }

  getStageLabel(stage: string): string {
    const labels: Record<string, string> = {
      'received': 'Received',
      'diagnosing': 'Diagnosing',
      'repairing': 'Repairing',
      'testing': 'Testing',
      'done': 'Done'
    };
    return labels[stage] || stage;
  }
}
